/**
 * Template Filler — dedicated route for filling AILegalTemplate variables.
 *
 * Replaces the old FillAndGenerateComponent (form-only, embedded in the
 * AI workspace shell) with a document-preview-on-the-left + side-panel
 * layout that mirrors the template authoring page.
 *
 * Flow:
 *   1. Load template body + variable definitions; if a case is linked,
 *      fetch real DB-derived suggestions via /api/ai/templates/{id}/suggest-values.
 *   2. Render the body with empty `{{var}}` chips. As the attorney types
 *      (or links a case), chips switch to "filled" style with the value.
 *   3. Generate → POST /api/legal/ai-workspace/drafts/from-template
 *      (deterministic substitution, no AI in the core path).
 *   4. Transition to "Done" sub-state in place — show the rendered draft
 *      and offer Open-in-AI-Workspace / Back-to-templates.
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, debounceTime, finalize, map, takeUntil } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { Key } from 'src/app/enum/key.enum';
import { Template, TemplateVariable, TemplateService } from '../../../../services/template.service';
import { DocumentGenerationService, DraftFromTemplateRequest } from '../../../../services/document-generation.service';
import { LegalCaseService } from '../../../../services/legal-case.service';
import { NotificationService } from '../../../../services/notification.service';
import { PRACTICE_AREAS, JURISDICTIONS } from '../../../../shared/legal-constants';

interface VariableSuggestion {
  variableName: string;
  variableType: string;
  suggestedValue: string;
  source: string;
  confidence: number;
  isRequired: boolean;
}

interface PreparedVariable extends TemplateVariable {
  suggestion?: VariableSuggestion;
}

type UiState = 'fill' | 'submitting' | 'done';

@Component({
  selector: 'app-template-filler',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './template-filler.component.html',
  styleUrls: ['./template-filler.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TemplateFillerComponent implements OnInit, OnDestroy {
  templateId: number | null = null;
  template: Template | null = null;
  variables: TemplateVariable[] = [];
  form: FormGroup | null = null;

  loading = true;
  loadError: string | null = null;
  suggesting = false;

  availableCases: any[] = [];
  selectedCaseId: number | null = null;
  linkedCase: any | null = null;
  suggestions: Record<string, VariableSuggestion> = {};

  groupedVariables: { fromCase: PreparedVariable[]; custom: PreparedVariable[] } =
    { fromCase: [], custom: [] };

  uiState: UiState = 'fill';
  generatedDocument: { id: number; content: string; title: string; createdAt: Date } | null = null;

  previewHtml: SafeHtml = '';

  private apiUrl = `${environment.apiUrl}/api/ai/templates`;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private templateService: TemplateService,
    private documentGenerationService: DocumentGenerationService,
    private legalCaseService: LegalCaseService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      this.loadError = 'No template ID provided.';
      this.loading = false;
      return;
    }
    this.templateId = Number(idParam);

    const caseIdParam = this.route.snapshot.queryParamMap.get('caseId');
    if (caseIdParam) this.selectedCaseId = Number(caseIdParam);

    this.loadCases();
    this.loadTemplateData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============ Data loading ============

  private loadCases(): void {
    this.legalCaseService.getAllCases(0, 500)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.availableCases = response?.data?.cases || response?.cases || response?.content || [];
          if (this.selectedCaseId) {
            this.linkedCase = this.availableCases.find(c => c.id === this.selectedCaseId) || null;
          }
          this.cdr.markForCheck();
        },
        error: () => { this.availableCases = []; }
      });
  }

  private loadTemplateData(): void {
    if (!this.templateId) return;
    this.loading = true;
    this.loadError = null;

    const tpl$ = this.templateService.getTemplate(this.templateId).pipe(
      catchError(() => of(null as Template | null))
    );
    const vars$ = this.templateService.getTemplateVariables(this.templateId).pipe(
      catchError(() => of([] as TemplateVariable[]))
    );
    const sugs$ = this.selectedCaseId
      ? this.fetchSuggestions(this.templateId, this.selectedCaseId)
      : of([] as VariableSuggestion[]);

    forkJoin({ tpl: tpl$, variables: vars$, suggestions: sugs$ })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => { this.loading = false; this.cdr.markForCheck(); })
      )
      .subscribe(({ tpl, variables, suggestions }) => {
        if (!tpl) {
          this.loadError = 'Template not found or access denied.';
          return;
        }
        this.template = tpl;
        this.variables = variables;
        this.buildForm(variables, suggestions);
        this.updatePreview();
      });
  }

  private fetchSuggestions(templateId: number, caseId: number) {
    return this.http.post<{ variables: VariableSuggestion[] }>(
      `${this.apiUrl}/${templateId}/suggest-values`,
      { contextType: 'CASE', caseId },
      { headers: this.buildAuthHeaders() }
    ).pipe(
      map(r => r?.variables || []),
      catchError(() => of([] as VariableSuggestion[]))
    );
  }

  private refreshSuggestions(): void {
    if (!this.templateId || !this.selectedCaseId || !this.form) return;
    this.suggesting = true;
    this.cdr.markForCheck();

    this.fetchSuggestions(this.templateId, this.selectedCaseId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => { this.suggesting = false; this.cdr.markForCheck(); })
      )
      .subscribe(suggestions => {
        suggestions.forEach(s => {
          this.suggestions[s.variableName] = s;
          if (!this.form?.contains(s.variableName)) return;
          const current = this.form.get(s.variableName)?.value;
          // Only patch empty fields — never stomp attorney edits.
          if (!current && s.suggestedValue) {
            this.form.patchValue({ [s.variableName]: s.suggestedValue });
          }
        });
        this.regroupVariables();
      });
  }

  // ============ Form ============

  private buildForm(variables: TemplateVariable[], suggestions: VariableSuggestion[]): void {
    this.suggestions = {};
    suggestions.forEach(s => this.suggestions[s.variableName] = s);

    const group: Record<string, any> = {};
    variables
      .slice()
      .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999))
      .forEach(v => {
        const sug = this.suggestions[v.variableName];
        const initial = sug?.suggestedValue ?? v.defaultValue ?? '';
        group[v.variableName] = v.isRequired
          ? [initial, Validators.required]
          : [initial];
      });

    this.form = this.fb.group(group);
    this.regroupVariables();

    this.form.valueChanges
      .pipe(debounceTime(80), takeUntil(this.destroy$))
      .subscribe(() => this.updatePreview());
  }

  private regroupVariables(): void {
    const fromCase: PreparedVariable[] = [];
    const custom: PreparedVariable[] = [];
    this.variables.forEach(v => {
      const sug = this.suggestions[v.variableName];
      const sourceMatch = sug?.source && /case|client/i.test(sug.source);
      const dsMatch = /case|client|party/i.test(v.dataSource || '');
      (sourceMatch || dsMatch ? fromCase : custom).push({ ...v, suggestion: sug });
    });
    const byOrder = (a: PreparedVariable, b: PreparedVariable) =>
      (a.displayOrder ?? 999) - (b.displayOrder ?? 999);
    fromCase.sort(byOrder);
    custom.sort(byOrder);
    this.groupedVariables = { fromCase, custom };
  }

  // ============ Preview ============

  private updatePreview(): void {
    if (this.uiState === 'done' && this.generatedDocument) {
      // Backend already substituted variables — render the final body as-is,
      // wrapping paragraphs if it's plain-text (OCR-imported templates).
      this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(
        this.normalizeBodyHtml(this.generatedDocument.content, false, null)
      );
    } else {
      const body = this.template?.templateContent ?? '';
      const values = this.form?.value || {};
      this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(
        this.normalizeBodyHtml(body, true, values)
      );
    }
    this.cdr.markForCheck();
  }

  /**
   * Render a template body for the preview pane.
   *
   * Handles two body shapes:
   *   - HTML (templates created in the authoring CKEditor) — preserved as-is.
   *   - Plain text (OCR-imported scanned PDFs, .txt drops) — escaped, classified,
   *     and paragraph-wrapped so prose reflows naturally to the document width.
   *
   * When `withChips` is true, `{{var_name}}` placeholders are replaced with
   * styled chip spans (empty/filled) for the live-fill view. When false, the
   * body is rendered verbatim — used for the post-Generate "Done" state where
   * the backend has already done substitution.
   */
  private normalizeBodyHtml(body: string, withChips: boolean, values: Record<string, any> | null): string {
    if (!body) return '';
    const escape = (s: string) => s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const hasHtmlStructure = /<(p|div|br|h[1-6]|ul|ol|li|table|figure|section|article)\b/i.test(body);

    const substituteChips = (text: string): string => {
      if (!withChips) return text;
      return text.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_m, name) => {
        const raw = values?.[name];
        const v = raw != null ? String(raw).trim() : '';
        return v
          ? `<span class="tpl-chip filled" data-var="${name}">${escape(v)}</span>`
          : `<span class="tpl-chip empty" data-var="${name}">{{${name}}}</span>`;
      });
    };

    // HTML-bodied template (authored in CKEditor) — preserve the existing markup,
    // just inject chips. The author's intentional <p>/<br> govern layout.
    if (hasHtmlStructure) {
      return substituteChips(body);
    }

    // Plain-text body — paragraph-classify each block separated by blank lines.
    //
    // OCR / PDFTextStripper emit `\n` at every visual line break in the source
    // PDF, including mid-paragraph wraps. Treating every `\n` as <br> forces
    // those original page-width wraps into our preview, leaving prose looking
    // ragged and the doc visually empty on the right side.
    //
    // Heuristic: a block whose lines are ALL short (<60 chars) is a structural
    // block — an address, signature, or short list — where the line breaks are
    // semantically meaningful. Anything else is prose with hard-wrapped lines
    // that should collapse to soft spaces and reflow to the doc width.
    return body
      .split(/\n\s*\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => {
        const lines = p.split('\n').filter(l => l.trim().length > 0);
        const isStructural = lines.length >= 2 && lines.every(l => l.trim().length < 60);
        const escaped = escape(p);
        const chipped = substituteChips(escaped);
        return `<p>${chipped.replace(/\n/g, isStructural ? '<br>' : ' ')}</p>`;
      })
      .join('');
  }

  // ============ Event handlers ============

  onCaseChange(idRaw: string | number | null): void {
    const id = idRaw == null || idRaw === '' ? null : Number(idRaw);
    this.selectedCaseId = id;
    this.linkedCase = id ? this.availableCases.find(c => c.id === id) : null;
    if (id && this.templateId) this.refreshSuggestions();
    else this.cdr.markForCheck();
  }

  onPreviewClick(event: Event): void {
    const target = event.target as HTMLElement;
    const chip = target.closest('.tpl-chip') as HTMLElement | null;
    if (!chip) return;
    const name = chip.getAttribute('data-var');
    if (!name) return;
    const input = document.getElementById('tf-' + name) as HTMLInputElement | null;
    if (input) {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => input.focus(), 200);
    }
  }

  onGenerate(): void {
    if (!this.template?.id || !this.form) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.uiState = 'submitting';
    this.cdr.markForCheck();

    const values: Record<string, string> = {};
    Object.entries(this.form.value || {}).forEach(([k, v]) => {
      values[k] = (v ?? '').toString();
    });

    const request: DraftFromTemplateRequest = {
      templateId: this.template.id,
      caseId: this.selectedCaseId ?? null,
      variableValues: values
    };

    this.documentGenerationService.draftFromTemplate(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.generatedDocument = {
            id: response.documentId,
            content: response.document?.content || '',
            title: response.document?.title || this.template?.name || 'Draft',
            createdAt: new Date()
          };
          this.uiState = 'done';
          this.updatePreview();
          this.notificationService.success(
            'Draft created',
            `"${this.template?.name}" is ready in your documents.`
          );
        },
        error: (err) => {
          this.uiState = 'fill';
          const msg = err?.error?.error || err?.error?.message || 'Failed to create draft.';
          this.notificationService.error('Draft failed', msg);
          this.cdr.markForCheck();
        }
      });
  }

  onCancel(): void {
    // The bare /legal/ai-assistant redirects to the dashboard, which isn't
    // where the attorney came from. Send them to the LegiSpace draft tab,
    // which is the actual workspace shell.
    this.router.navigate(['/legal/ai-assistant/legispace/legidraft']);
  }

  onOpenInWorkspace(): void {
    if (!this.generatedDocument) return;
    // /legal/ai-assistant resolves to the dashboard (a different component).
    // The workspace component (which handles ?documentId= via openDocumentFromQuery)
    // lives at /legal/ai-assistant/legispace/legidraft.
    this.router.navigate(['/legal/ai-assistant/legispace/legidraft'], {
      queryParams: { documentId: this.generatedDocument.id }
    });
  }

  onBackToTemplates(): void {
    this.router.navigate(['/legal/ai-assistant/templates']);
  }

  // ============ Display helpers ============

  practiceAreaLabel(slug?: string | null): string {
    if (!slug) return '';
    return PRACTICE_AREAS.find(p => p.slug === slug.toLowerCase())?.name ?? slug;
  }

  jurisdictionLabel(nameOrCode?: string | null): string {
    if (!nameOrCode) return '';
    const lower = nameOrCode.toLowerCase();
    const match = JURISDICTIONS.find(j => j.name.toLowerCase() === lower)
      || JURISDICTIONS.find(j => j.code === lower);
    return match?.name ?? nameOrCode;
  }

  caseLabel(c: any): string {
    if (!c) return '';
    return c.title || c.caseName || c.caseNumber || `Case #${c.id}`;
  }

  prettifyName(name: string): string {
    return name.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
  }

  inputType(variableType: string | undefined): string {
    switch ((variableType || '').toUpperCase()) {
      case 'DATE': return 'date';
      case 'NUMBER': return 'number';
      case 'EMAIL': return 'email';
      case 'PHONE': return 'tel';
      default: return 'text';
    }
  }

  isLongText(variableType: string | undefined): boolean {
    return (variableType || '').toUpperCase() === 'TEXTAREA';
  }

  formatCreatedAt(d: Date | null | undefined): string {
    if (!d) return '';
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    });
  }

  get filledCount(): number {
    if (!this.form) return 0;
    return Object.values(this.form.value || {})
      .filter(v => (v ?? '').toString().trim().length > 0).length;
  }

  get totalVariables(): number {
    return this.variables.length;
  }

  get requiredMissingCount(): number {
    if (!this.form) return 0;
    return this.variables
      .filter(v => v.isRequired && !(this.form!.value || {})[v.variableName]?.toString().trim())
      .length;
  }

  trackByName(_i: number, v: TemplateVariable): string {
    return v.variableName;
  }

  private buildAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem(Key.TOKEN);
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    });
  }
}
