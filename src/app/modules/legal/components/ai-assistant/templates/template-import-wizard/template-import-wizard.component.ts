import { Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription, interval, of } from 'rxjs';
import { catchError, filter, switchMap, takeWhile } from 'rxjs/operators';
import Swal from 'sweetalert2';
// docx-preview renders an XWPF document straight into a DOM element — same visual
// fidelity as Word for paragraphs, tables, headers, and inline images. Bundle size
// is ~110 KB and there are zero native dependencies, so it's safe to load eagerly.
import { renderAsync as renderDocxAsync } from 'docx-preview';

import {
  AnalyzeResponse,
  ImportCommitResponse,
  ImportFileDecision,
  ImportFileStatus,
  ImportSessionResponse,
  RetokenizeRequest,
  TemplateImportService
} from '../../../../services/template-import.service';
import { JURISDICTIONS, PRACTICE_AREAS } from '../../../../shared/legal-constants';

/**
 * Per-file review state kept locally (not sent as-is). On commit the wizard
 * folds this into `ImportFileDecision[]` for the backend.
 */
interface ReviewState {
  fileId: string;
  file: File;                      // kept so we can re-upload for reanalyze
  action: 'IMPORT' | 'SKIP' | 'OVERWRITE';
  name: string;
  description: string;
  category: string;
  practiceArea: string;
  jurisdiction: string;
  isPrivate: boolean;
  rejectedKeys: Set<string>;
  renames: { [oldKey: string]: string };
  overwriteTemplateId?: number;
}

// Must match backend enum TemplateCategory exactly (17 values).
// See: backend/src/main/java/com/bostoneo/bostoneosolutions/enumeration/TemplateCategory.java
const TEMPLATE_CATEGORIES = [
  'MOTION','BRIEF','PLEADING','CONTRACT','CORRESPONDENCE',
  'DISCOVERY','SETTLEMENT','COURT_FILING','INTERNAL_MEMO','CLIENT_ADVICE',
  'RESEARCH_MEMO','OPINION_LETTER','IMMIGRATION_FORM','FAMILY_LAW_FORM',
  'CRIMINAL_MOTION','REAL_ESTATE_DOC','PATENT_APPLICATION'
];

const ACCEPTED_EXT = ['.pdf', '.docx', '.doc', '.zip'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;          // 10 MB per file
const MAX_BATCH_BYTES = 100 * 1024 * 1024;        // 100 MB per batch
const MAX_FILES = 50;
const POLL_INTERVAL_MS = 2000;

@Component({
  selector: 'app-template-import-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './template-import-wizard.component.html',
  styleUrls: ['./template-import-wizard.component.scss']
})
export class TemplateImportWizardComponent implements OnInit, OnDestroy {

  @Output() closed = new EventEmitter<void>();
  @Output() importCompleted = new EventEmitter<ImportCommitResponse>();

  // ------------------ wizard state ------------------
  currentStep = 1;
  readonly totalSteps = 4;

  // Step 1 — file queue (pre-upload)
  queuedFiles: File[] = [];
  isDragOver = false;
  uploadError = '';

  // Step 2 — session + polling
  sessionId: string | null = null;
  sessionFiles: ImportFileStatus[] = [];
  private pollSub?: Subscription;
  isUploading = false;
  isSessionExpired = false;

  // Step 3 — review
  reviewIndex = 0;
  reviewState: { [fileId: string]: ReviewState } = {};
  // Track which files have already been hydrated from AI analysis so we don't overwrite user edits on re-poll.
  private hydratedFileIds = new Set<string>();

  // Step 4 — commit
  isCommitting = false;
  commitResult?: ImportCommitResponse;

  // Static options
  readonly categories = TEMPLATE_CATEGORIES;
  readonly practiceAreas = PRACTICE_AREAS;
  readonly jurisdictions = JURISDICTIONS;

  // Sprint 1.6 — binary preview cache.
  // Holds the most-recently-fetched transformed bytes for the file at `reviewIndex`. Cached per fileId
  // so re-renders don't re-fetch, and the object URL is revoked on file-change / destroy to prevent leaks.
  // For DOCX the blob is rendered into `docxContainerRef` via docx-preview; for PDF the `safeUrl`
  // is bound to an iframe `[src]` exactly like the Sprint 1.5 local-blob path did.
  private binaryPreview: {
    fileId: string;
    format: 'DOCX' | 'PDF';
    blob: Blob;
    objectUrl: string;
    safeUrl?: SafeResourceUrl;
    docxRendered: boolean;
  } | null = null;

  previewLoading = false;
  previewError = '';
  isRetokenizing = false;

  @ViewChild('docxContainer', { static: false }) docxContainerRef?: ElementRef<HTMLDivElement>;

  constructor(
    private importService: TemplateImportService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
    this.clearBinaryPreview();
  }

  private clearBinaryPreview(): void {
    if (this.binaryPreview) {
      URL.revokeObjectURL(this.binaryPreview.objectUrl);
      this.binaryPreview = null;
    }
    if (this.docxContainerRef?.nativeElement) {
      this.docxContainerRef.nativeElement.innerHTML = '';
    }
  }

  // ==============================================================
  //                 STEP 1 — file queue & upload
  // ==============================================================

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDragOver = false;
    const files = e.dataTransfer?.files;
    if (files) this.addFiles(Array.from(files));
  }

  onFileInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files) this.addFiles(Array.from(input.files));
    input.value = ''; // allow re-selecting same file
  }

  private addFiles(files: File[]): void {
    this.uploadError = '';
    const accepted: File[] = [];

    for (const f of files) {
      const lower = f.name.toLowerCase();
      const extOk = ACCEPTED_EXT.some(x => lower.endsWith(x));
      if (!extOk) {
        this.uploadError = `Unsupported file type: ${f.name}. Accepted: ${ACCEPTED_EXT.join(', ')}`;
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        this.uploadError = `${f.name} exceeds 10 MB file limit.`;
        continue;
      }
      // Dedup by name+size locally so the same file dropped twice doesn't upload twice
      const dup = this.queuedFiles.find(q => q.name === f.name && q.size === f.size);
      if (dup) continue;
      accepted.push(f);
    }

    const merged = [...this.queuedFiles, ...accepted];
    if (merged.length > MAX_FILES) {
      this.uploadError = `Batch exceeds ${MAX_FILES}-file limit.`;
      return;
    }
    const total = merged.reduce((sum, f) => sum + f.size, 0);
    if (total > MAX_BATCH_BYTES) {
      this.uploadError = 'Batch exceeds 100 MB total size limit.';
      return;
    }
    this.queuedFiles = merged;
  }

  removeQueuedFile(i: number): void {
    this.queuedFiles.splice(i, 1);
  }

  get queuedTotalMB(): string {
    const b = this.queuedFiles.reduce((sum, f) => sum + f.size, 0);
    return (b / (1024 * 1024)).toFixed(1);
  }

  canAnalyze(): boolean {
    return this.queuedFiles.length > 0 && !this.isUploading;
  }

  analyze(): void {
    if (!this.canAnalyze()) return;
    this.isUploading = true;
    this.uploadError = '';

    this.importService.analyze(this.queuedFiles).subscribe({
      next: (res: AnalyzeResponse) => {
        this.sessionId = res.sessionId;
        // Initialize sessionFiles with QUEUED placeholders — server registers files synchronously
        this.sessionFiles = res.files.map(f => ({
          fileId: f.fileId,
          filename: f.filename,
          status: 'QUEUED'
        }));
        // Map uploaded File -> fileId so reanalyze can re-upload bytes
        this.queuedFiles.forEach((f, idx) => {
          const sf = res.files[idx];
          if (sf) {
            this.reviewState[sf.fileId] = this.makeDefaultReview(sf.fileId, f);
          }
        });
        this.isUploading = false;
        this.currentStep = 2;
        this.startPolling();
      },
      error: (err) => {
        this.isUploading = false;
        this.uploadError = err?.error?.error || err?.error?.message || 'Upload failed. Please try again.';
      }
    });
  }

  // ==============================================================
  //                 STEP 2 — polling
  // ==============================================================

  private startPolling(): void {
    if (!this.sessionId) return;
    this.pollSub?.unsubscribe();

    console.log('[import-poll] ✅ startPolling invoked v2 (catchError-inside-switchMap)', {
      sessionId: this.sessionId,
      intervalMs: POLL_INTERVAL_MS
    });

    // IMPORTANT: catchError lives INSIDE switchMap so a single failed getSession()
    // doesn't tear down the outer interval. A transient 5xx / CORS / network blip
    // used to kill polling permanently and freeze the UI on whatever status the
    // last successful poll returned (e.g., "Extracting…"). With the inner
    // catchError, transient errors emit a null sentinel which the filter drops,
    // and the next interval tick fires another request.
    let tick = 0;
    this.pollSub = interval(POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => {
          tick += 1;
          console.log(`[import-poll] tick #${tick} → GET /session/${this.sessionId}`);
          return this.importService.getSession(this.sessionId!).pipe(
            catchError((err) => {
              if (err?.status === 404) {
                // Session expired/not found — terminal. Stop polling and flag the UI.
                console.warn('[import-poll] session 404 — stopping poll', err);
                this.isSessionExpired = true;
                this.pollSub?.unsubscribe();
                return of(null);
              }
              // Transient failure — log and let the next tick retry.
              console.warn('[import-poll] tick failed, will retry:', err);
              return of(null);
            })
          );
        }),
        filter((resp): resp is ImportSessionResponse => resp !== null),
        takeWhile((resp: ImportSessionResponse) => !resp.allFinalized, true)
      )
      .subscribe({
        next: (resp: ImportSessionResponse) => {
          console.log('[import-poll] response',
            'allFinalized=' + resp.allFinalized,
            ...resp.files.map(f => `${f.filename}=${f.status}${f.errorMessage ? ' err=' + f.errorMessage : ''}`)
          );
          this.sessionFiles = resp.files;
          // Hydrate each file from AI analysis exactly once — subsequent poll ticks must NOT overwrite user edits.
          for (const f of resp.files) {
            if (f.status === 'READY' && f.analysis && this.reviewState[f.fileId] && !this.hydratedFileIds.has(f.fileId)) {
              console.log('[import-poll] hydrating review state for', f.filename);
              this.applyAnalysisToReview(f);
              this.hydratedFileIds.add(f.fileId);
            }
          }
        },
        error: (err) => {
          // Defensive: catchError above should swallow all HTTP errors, so this
          // only fires on something truly unexpected (operator bug, sync throw).
          console.error('[import-poll] ❌ subscription errored unexpectedly:', err);
          this.pollSub?.unsubscribe();
        },
        complete: () => {
          console.log('[import-poll] ✅ subscription complete (all files finalized)');
        }
      });
  }

  get readyCount(): number {
    return this.sessionFiles.filter(f => f.status === 'READY' || f.status === 'DUPLICATE').length;
  }

  get errorCount(): number {
    return this.sessionFiles.filter(f => f.status === 'ERROR').length;
  }

  get allFinalized(): boolean {
    return this.sessionFiles.length > 0 &&
      this.sessionFiles.every(f => f.status === 'READY' || f.status === 'ERROR' || f.status === 'DUPLICATE');
  }

  canContinueToReview(): boolean {
    // Allow review once at least one file is READY or DUPLICATE
    return this.sessionFiles.some(f => f.status === 'READY' || f.status === 'DUPLICATE');
  }

  goToReview(): void {
    this.pollSub?.unsubscribe();
    // Find first reviewable file
    this.reviewIndex = Math.max(0, this.sessionFiles.findIndex(f =>
      f.status === 'READY' || f.status === 'DUPLICATE'));
    this.currentStep = 3;
    // Kick off the first binary preview fetch. The render side is idempotent by fileId so repeat
    // calls (e.g., user bounces back to step 2 and returns) never re-download the same blob.
    this.refreshCurrentPreview();
  }

  statusIcon(status: string): string {
    switch (status) {
      case 'QUEUED':     return 'ri-time-line text-muted';
      case 'EXTRACTING': return 'ri-loader-4-line text-primary spin';
      case 'ANALYZING':  return 'ri-magic-line text-info spin';
      case 'READY':      return 'ri-checkbox-circle-fill text-success';
      case 'DUPLICATE':  return 'ri-file-copy-2-line text-warning';
      case 'ERROR':      return 'ri-close-circle-fill text-danger';
      default:           return 'ri-question-line';
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'QUEUED':     return 'Queued';
      case 'EXTRACTING': return 'Extracting text…';
      case 'ANALYZING':  return 'Analyzing with AI…';
      case 'READY':      return 'Ready';
      case 'DUPLICATE':  return 'Duplicate';
      case 'ERROR':      return 'Error';
      default:           return status;
    }
  }

  // ==============================================================
  //                 STEP 3 — review
  // ==============================================================

  get reviewableFiles(): ImportFileStatus[] {
    return this.sessionFiles.filter(f => f.status === 'READY' || f.status === 'DUPLICATE');
  }

  get currentReviewFile(): ImportFileStatus | null {
    return this.reviewableFiles[this.reviewIndex] ?? null;
  }

  get currentReviewState(): ReviewState | null {
    const f = this.currentReviewFile;
    return f ? this.reviewState[f.fileId] : null;
  }

  // ==================== Sprint 1.6 — binary preview ====================
  //
  // The wizard used to render PDFs from the attorney's local upload blob. That worked visually but
  // never showed the {{tokenized}} copy — attorneys couldn't tell what the template would actually
  // look like at draft time. Phase F swaps the source to the backend's cached transformed bytes:
  //   GET /session/{sid}/files/{fid}/preview?variant=transformed
  // returns the exact bytes that will be persisted on the AILegalTemplate, so "review" = "render
  // what will be saved". Toggling rejections or renaming keys triggers a /retokenize server roundtrip
  // then re-fetches — visually confirms every variable edit.
  //
  // Format is discovered from the backend's `binaryFormat` field, not the filename, because a
  // legacy .doc is extracted to text without a binary counterpart (`hasBinaryTemplate=false`) and
  // must fall through to the text preview even though the filename looks like Word.

  get isCurrentFilePdf(): boolean {
    return this.currentBinaryFormat === 'PDF';
  }

  get isCurrentFileDocx(): boolean {
    return this.currentBinaryFormat === 'DOCX';
  }

  get currentBinaryFormat(): 'DOCX' | 'PDF' | null {
    const f = this.currentReviewFile;
    if (!f || !f.hasBinaryTemplate || !f.binaryFormat) return null;
    return f.binaryFormat;
  }

  /** True when the backend has a tokenized binary cached for the current file. */
  get currentHasBinaryPreview(): boolean {
    return !!this.currentReviewFile?.hasBinaryTemplate;
  }

  /** Bound to `<iframe [src]>` in the template — safe URL for the current PDF preview blob. */
  get currentPdfSafeUrl(): SafeResourceUrl | null {
    if (!this.binaryPreview || this.binaryPreview.format !== 'PDF') return null;
    return this.binaryPreview.safeUrl ?? null;
  }

  /**
   * True once docx-preview has finished painting glyphs into the container. Until then the
   * container shows a small loading strip — without it, the gap between fetch-success and
   * render-complete flashes an empty 600px area.
   */
  get currentDocxRendered(): boolean {
    return !!(this.binaryPreview
      && this.binaryPreview.format === 'DOCX'
      && this.binaryPreview.docxRendered);
  }

  /**
   * Fetch the transformed bytes for the currently-focused file and render them.
   * Idempotent by fileId — calling this repeatedly with the same current file is a no-op unless
   * {@link force} is true (used after retokenize to bypass the fileId cache check).
   */
  refreshCurrentPreview(force = false): void {
    const f = this.currentReviewFile;
    if (!f || !this.sessionId) return;
    if (!f.hasBinaryTemplate || !f.binaryFormat) {
      // No binary path — clear any stale preview (e.g., user navigated from PDF → legacy .doc).
      this.clearBinaryPreview();
      return;
    }
    if (!force && this.binaryPreview?.fileId === f.fileId) return;

    this.clearBinaryPreview();
    this.previewLoading = true;
    this.previewError = '';

    this.importService.getFilePreview(this.sessionId, f.fileId, 'transformed').subscribe({
      next: (blob) => {
        const objectUrl = URL.createObjectURL(blob);
        const format = f.binaryFormat as 'DOCX' | 'PDF';
        this.binaryPreview = {
          fileId: f.fileId,
          format,
          blob,
          objectUrl,
          safeUrl: format === 'PDF'
            ? this.sanitizer.bypassSecurityTrustResourceUrl(`${objectUrl}#toolbar=0&navpanes=0`)
            : undefined,
          docxRendered: false
        };
        this.previewLoading = false;
        if (format === 'DOCX') this.renderDocxPreview();
      },
      error: (err) => {
        console.warn('[wizard] preview fetch failed', err);
        this.previewLoading = false;
        this.previewError = 'Preview unavailable. The original upload will be used on import.';
      }
    });
  }

  /**
   * Render the current DOCX blob into the view-child container. Runs after the fetch succeeds OR
   * after Angular instantiates the container (the user reaches step 3 with a DOCX selected).
   * We retry once via a microtask in case the view child isn't available yet — docx-preview is
   * async anyway, so the extra tick is free.
   */
  private renderDocxPreview(): void {
    const container = this.docxContainerRef?.nativeElement;
    const bp = this.binaryPreview;
    if (!bp || bp.format !== 'DOCX' || !bp.blob) return;
    if (!container) {
      // Container hasn't been projected yet; defer. Angular will run another tick after this method
      // returns, at which point docxContainerRef will be populated and we can try again.
      queueMicrotask(() => this.renderDocxPreview());
      return;
    }
    container.innerHTML = '';
    renderDocxAsync(bp.blob, container, undefined, {
      className: 'docx',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      useBase64URL: true,
      renderHeaders: true,
      renderFooters: true
    }).then(() => {
      if (this.binaryPreview) this.binaryPreview.docxRendered = true;
    }).catch((err) => {
      console.warn('[wizard] docx-preview render failed', err);
      this.previewError = 'Unable to render DOCX preview.';
    });
  }

  /**
   * POST /retokenize with the attorney's current rejections + renames, then re-fetch the transformed
   * preview so the viewer reflects the new tokenization. Swallows and logs failures — the retokenize
   * endpoint is advisory (the same decisions are re-sent on commit), so a transient backend error
   * doesn't break the wizard flow.
   */
  private retokenizeAndRefresh(): void {
    const f = this.currentReviewFile;
    const st = this.currentReviewState;
    if (!f || !st || !this.sessionId || !f.hasBinaryTemplate) return;
    if (this.isRetokenizing) return; // drop overlapping calls; next toggle re-fires

    const req: RetokenizeRequest = {
      rejectedVariableKeys: Array.from(st.rejectedKeys),
      variableRenames: { ...st.renames }
    };

    this.isRetokenizing = true;
    this.importService.retokenize(this.sessionId, f.fileId, req).subscribe({
      next: () => {
        this.isRetokenizing = false;
        this.refreshCurrentPreview(/* force */ true);
      },
      error: (err) => {
        this.isRetokenizing = false;
        console.warn('[wizard] retokenize failed — preview may be stale', err);
      }
    });
  }

  private makeDefaultReview(fileId: string, file: File): ReviewState {
    return {
      fileId,
      file,
      action: 'IMPORT',
      name: file.name.replace(/\.[^.]+$/, ''),
      description: '',
      // Default to CORRESPONDENCE (generic letters/notices); AI classification overrides this.
      category: 'CORRESPONDENCE',
      practiceArea: '',
      jurisdiction: '',
      isPrivate: false,
      rejectedKeys: new Set(),
      renames: {}
    };
  }

  private applyAnalysisToReview(f: ImportFileStatus): void {
    const state = this.reviewState[f.fileId];
    if (!state || !f.analysis) return;
    const a = f.analysis;

    if (a.suggestedName) state.name = a.suggestedName;
    if (a.suggestedDescription) state.description = a.suggestedDescription;

    const c = a.classification;
    if (c) {
      if (c.category) state.category = c.category.toUpperCase();
      if (c.practiceArea) state.practiceArea = c.practiceArea;
      if (c.jurisdiction) state.jurisdiction = this.normalizeJurisdictionCode(c.jurisdiction);
    }

    // Default action for duplicates
    if (f.status === 'DUPLICATE') {
      state.action = 'SKIP';
      state.overwriteTemplateId = f.duplicateOfTemplateId;
    }
  }

  private normalizeJurisdictionCode(raw: string): string {
    const lc = raw.toLowerCase().trim();
    // Accept either ISO code or full name from AI
    const byCode = this.jurisdictions.find(j => j.code === lc);
    if (byCode) return byCode.code;
    const byName = this.jurisdictions.find(j => j.name.toLowerCase() === lc);
    return byName ? byName.code : '';
  }

  toggleVariable(key: string): void {
    const st = this.currentReviewState;
    if (!st) return;
    if (st.rejectedKeys.has(key)) st.rejectedKeys.delete(key);
    else st.rejectedKeys.add(key);
    // Re-tokenize the cached binary so the preview reflects the attorney's decision immediately.
    this.retokenizeAndRefresh();
  }

  isRejected(key: string): boolean {
    return this.currentReviewState?.rejectedKeys.has(key) ?? false;
  }

  renameVariable(oldKey: string, newKey: string): void {
    const st = this.currentReviewState;
    if (!st || !newKey || newKey === oldKey) return;
    const clean = newKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!clean) return;
    st.renames[oldKey] = clean;
    // Same contract as toggleVariable — rewrite the cached binary so the preview re-renders with
    // the new token in place of the old one.
    this.retokenizeAndRefresh();
  }

  promptRename(oldKey: string): void {
    const current = this.currentReviewState?.renames[oldKey] ?? oldKey;
    Swal.fire({
      title: 'Rename Variable',
      input: 'text',
      inputValue: current,
      showCancelButton: true,
      confirmButtonText: 'Rename',
      inputValidator: (v) => (!v || !v.trim()) ? 'Variable name required' : null
    }).then(res => {
      if (res.isConfirmed && res.value) this.renameVariable(oldKey, res.value);
    });
  }

  effectiveKey(origKey: string): string {
    return this.currentReviewState?.renames[origKey] ?? origKey;
  }

  setAction(action: 'IMPORT' | 'SKIP' | 'OVERWRITE'): void {
    const st = this.currentReviewState;
    if (st) st.action = action;
  }

  setPrivacy(isPrivate: boolean): void {
    const st = this.currentReviewState;
    if (st) st.isPrivate = isPrivate;
  }

  confidencePct(c?: number): number {
    return c == null ? 0 : Math.round(c * 100);
  }

  get decisionCounts(): { import: number; skip: number; overwrite: number } {
    const counts = { import: 0, skip: 0, overwrite: 0 };
    for (const f of this.reviewableFiles) {
      const a = this.reviewState[f.fileId]?.action;
      if (a === 'IMPORT') counts.import++;
      else if (a === 'SKIP') counts.skip++;
      else if (a === 'OVERWRITE') counts.overwrite++;
    }
    return counts;
  }

  goToSummary(): void {
    this.currentStep = 4;
  }

  backToReview(): void {
    this.currentStep = 3;
  }

  // ==============================================================
  //                 STEP 4 — commit
  // ==============================================================

  commit(): void {
    if (!this.sessionId || this.isCommitting) return;
    this.isCommitting = true;

    const decisions: ImportFileDecision[] = this.reviewableFiles.map(f => {
      const st = this.reviewState[f.fileId];
      const rejectedKeys = Array.from(st.rejectedKeys);
      return {
        fileId: f.fileId,
        action: st.action,
        templateName: st.name,
        templateDescription: st.description,
        category: st.category,
        practiceArea: st.practiceArea,
        jurisdiction: st.jurisdiction,
        isPrivate: st.isPrivate,
        variableRenames: st.renames,
        rejectedVariableKeys: rejectedKeys,
        overwriteTemplateId: st.action === 'OVERWRITE' ? st.overwriteTemplateId : undefined
      };
    });

    this.importService.commit(this.sessionId, { decisions }).subscribe({
      next: (res) => {
        this.commitResult = res;
        this.isCommitting = false;
        Swal.fire({
          title: 'Import Complete',
          html: `<strong>${res.created}</strong> created, <strong>${res.overwritten}</strong> overwritten,`
               + ` <strong>${res.skipped}</strong> skipped`
               + (res.failed ? `, <strong>${res.failed}</strong> failed` : ''),
          icon: res.failed ? 'warning' : 'success'
        });
        this.importCompleted.emit(res);
      },
      error: (err) => {
        this.isCommitting = false;
        Swal.fire({
          title: 'Import Failed',
          text: err?.error?.message || err?.error?.error || 'Unable to commit import. Please retry.',
          icon: 'error'
        });
      }
    });
  }

  // ==============================================================
  //                 close / cleanup
  // ==============================================================

  close(): void {
    this.pollSub?.unsubscribe();
    this.closed.emit();
  }

  // Helpers for template
  severityClass(sev: string): string {
    switch (sev) {
      case 'ERROR':   return 'alert-danger';
      case 'WARNING': return 'alert-warning';
      default:        return 'alert-info';
    }
  }

  /** Mockup §7 — color-coded file-type chips on queued rows (pdf=red, docx=blue, zip=amber). */
  fileTypeSlug(filename: string): 'pdf' | 'docx' | 'doc' | 'zip' | 'other' {
    const lower = (filename || '').toLowerCase();
    if (lower.endsWith('.pdf')) return 'pdf';
    if (lower.endsWith('.docx')) return 'docx';
    if (lower.endsWith('.doc')) return 'doc';
    if (lower.endsWith('.zip')) return 'zip';
    return 'other';
  }

  fileTypeIcon(filename: string): string {
    switch (this.fileTypeSlug(filename)) {
      case 'pdf':  return 'ri-file-pdf-2-line';
      case 'docx': return 'ri-file-word-2-line';
      case 'doc':  return 'ri-file-word-2-line';
      case 'zip':  return 'ri-folder-zip-line';
      default:     return 'ri-file-line';
    }
  }

  /** Step 2 processing summary line: "Analyzing X of N files · Claude Sonnet". */
  get processingSummary(): string {
    const analyzing = this.sessionFiles.filter(f => f.status === 'ANALYZING' || f.status === 'EXTRACTING').length;
    const total = this.sessionFiles.length;
    const ready = this.readyCount;
    if (this.allFinalized) {
      return `All ${total} file${total === 1 ? '' : 's'} finalized · ${ready} ready`;
    }
    if (analyzing > 0) {
      return `Analyzing ${ready + 1} of ${total} files · Claude Sonnet`;
    }
    return `Queued ${total} file${total === 1 ? '' : 's'}…`;
  }
}
