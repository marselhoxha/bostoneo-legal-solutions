import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EMPTY, Observable, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap, takeUntil, tap } from 'rxjs/operators';

import {
  TemplateService,
  TemplateSearchResult
} from '../../../../services/template.service';
import {
  PRACTICE_AREAS,
  JURISDICTIONS,
  getJurisdictionByName
} from '../../../../shared/legal-constants';

/**
 * Sprint 4c — Inline Template Picker (replaces the NgbModal-wrapped library).
 *
 * Rendered in-place by `ai-workspace` when `draftMode === 'template-picker'`.
 * Purely presentational: emits semantic events and lets the parent drive state
 * transitions.
 */
@Component({
  selector: 'app-template-picker-inline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './template-picker-inline.component.html',
  styleUrls: ['./template-picker-inline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TemplatePickerInlineComponent implements OnInit, OnChanges, OnDestroy {
  @Input() presetPracticeArea: string | null = null;
  @Input() presetJurisdiction: string | null = null;
  @Input() linkedCase: any | null = null;
  // Incremented by the parent to force a re-fetch (used after the import
  // wizard commits so just-imported templates appear in the grid).
  @Input() refreshToken = 0;

  @Output() templatePicked = new EventEmitter<TemplateSearchResult>();
  @Output() backToDashboard = new EventEmitter<void>();
  @Output() browseFullLibrary = new EventEmitter<void>();

  // Filter chips that are always visible regardless of case context. Each entry
  // is a PracticeArea slug — the `chipLabel()` lookup renders the display name.
  readonly practiceAreaChips = ['pi', 'family', 'criminal', 'civil', 'immigration'];

  templates: TemplateSearchResult[] = [];
  loading = false;
  error: string | null = null;

  searchQuery = '';
  activePracticeArea: string | null = null;
  activeJurisdiction: string | null = null;  // full name, e.g. "Massachusetts"

  page = 0;
  readonly pageSize = 8;
  hasMore = false;

  // The first matching template under case-preset filters is flagged as the
  // "suggested" pick — styled with a green border + SUGGESTED badge.
  suggestedId: number | null = null;

  // Debounced text-search signal.
  private searchDebounce$ = new Subject<string>();
  // Every fetch flows through this Subject + switchMap so a newer request
  // cancels any in-flight older one — prevents results from a stale chip
  // click overwriting the current filter state.
  private searchTrigger$ = new Subject<{ resetResults: boolean }>();
  private destroy$ = new Subject<void>();

  constructor(
    private templateService: TemplateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.activePracticeArea = this.normalizePracticeArea(this.presetPracticeArea);
    this.activeJurisdiction = this.normalizeJurisdictionName(this.presetJurisdiction);

    // Debounced text input → trigger a reset-search.
    this.searchDebounce$
      .pipe(
        debounceTime(220),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.searchTrigger$.next({ resetResults: true }));

    // Single search pipeline with auto-cancel on new trigger.
    this.searchTrigger$
      .pipe(
        switchMap(({ resetResults }) => this.fetchPage(resetResults)),
        takeUntil(this.destroy$)
      )
      .subscribe();

    this.searchTrigger$.next({ resetResults: true });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // If the linked case is swapped while the picker is open, re-apply the
    // preset filters and re-query. This keeps the picker in sync with the
    // right-rail case context without requiring the user to click Back.
    const presetsChanged =
      changes['presetPracticeArea']?.currentValue !== changes['presetPracticeArea']?.previousValue ||
      changes['presetJurisdiction']?.currentValue !== changes['presetJurisdiction']?.previousValue;
    // Parent bumps `refreshToken` after the import wizard commits — re-query
    // so new templates appear in the grid without the user touching filters.
    const refreshBumped =
      !!changes['refreshToken'] &&
      !changes['refreshToken'].firstChange &&
      changes['refreshToken'].currentValue !== changes['refreshToken'].previousValue;
    if (!presetsChanged && !refreshBumped) return;
    if (presetsChanged) {
      this.activePracticeArea = this.normalizePracticeArea(this.presetPracticeArea);
      this.activeJurisdiction = this.normalizeJurisdictionName(this.presetJurisdiction);
    }
    this.page = 0;
    this.searchTrigger$.next({ resetResults: true });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchDebounce$.complete();
    this.searchTrigger$.complete();
  }

  // ============ Event handlers ============

  onSearchChange(value: string): void {
    this.searchQuery = value;
    this.searchDebounce$.next(value || '');
  }

  togglePracticeAreaChip(slug: string): void {
    this.activePracticeArea = this.activePracticeArea === slug ? null : slug;
    this.page = 0;
    this.searchTrigger$.next({ resetResults: true });
  }

  toggleJurisdictionChip(): void {
    // Single chip shows the current jurisdiction name; clicking clears it.
    // Attorneys can reset to "All jurisdictions" to see templates outside
    // the case's state.
    this.activeJurisdiction = null;
    this.page = 0;
    this.searchTrigger$.next({ resetResults: true });
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.activePracticeArea = null;
    this.activeJurisdiction = null;
    this.page = 0;
    this.searchTrigger$.next({ resetResults: true });
  }

  onBack(): void {
    this.backToDashboard.emit();
  }

  onPick(tpl: TemplateSearchResult): void {
    if (!tpl) return;
    this.templatePicked.emit(tpl);
  }

  onImport(): void {
    this.browseFullLibrary.emit();
  }

  loadMore(): void {
    if (!this.hasMore || this.loading) return;
    this.page += 1;
    this.searchTrigger$.next({ resetResults: false });
  }

  trackById(_i: number, t: TemplateSearchResult): number {
    return t?.id;
  }

  // ============ Data fetching ============

  /**
   * Returns an observable for a single search page. Runs inside `switchMap`,
   * so if another trigger fires before this one resolves the prior request
   * is auto-unsubscribed (errors from aborted requests never surface).
   */
  private fetchPage(resetResults: boolean): Observable<TemplateSearchResult[]> {
    this.loading = true;
    this.error = null;
    if (resetResults) {
      this.templates = [];
    }
    this.cdr.markForCheck();

    const params: any = {
      page: this.page,
      size: this.pageSize
    };
    if (this.searchQuery?.trim()) params.q = this.searchQuery.trim();
    if (this.activePracticeArea) params.practiceArea = this.activePracticeArea;
    if (this.activeJurisdiction) params.jurisdiction = this.activeJurisdiction;

    return this.templateService.searchTemplates(params).pipe(
      tap((results: TemplateSearchResult[]) => {
        const batch = results || [];
        this.templates = resetResults ? batch : this.templates.concat(batch);
        this.hasMore = batch.length === this.pageSize;
        if (resetResults && this.activePracticeArea && this.activeJurisdiction) {
          this.suggestedId = this.templates[0]?.id ?? null;
        } else if (resetResults) {
          this.suggestedId = null;
        }
        this.loading = false;
        this.cdr.markForCheck();
      }),
      catchError(() => {
        this.loading = false;
        this.error = 'We could not load your templates. Try again or clear filters.';
        this.hasMore = false;
        this.cdr.markForCheck();
        return EMPTY;
      })
    );
  }

  // ============ Display helpers ============

  /** Currently-applied-filter summary that appears under the h4. */
  filterSummary(): string {
    const parts: string[] = [];
    if (this.activePracticeArea) {
      const name = PRACTICE_AREAS.find(p => p.slug === this.activePracticeArea)?.name;
      if (name) parts.push(name);
    }
    if (this.activeJurisdiction) parts.push(this.activeJurisdiction);
    if (parts.length === 0) return 'All templates · no filters applied';
    const cameFromCase = this.linkedCase
      ? ` (from linked case)`
      : '';
    return `filtered by ${parts.join(' + ')}${cameFromCase}`;
  }

  chipLabel(slug: string): string {
    return PRACTICE_AREAS.find(p => p.slug === slug)?.name ?? slug;
  }

  isChipActive(slug: string): boolean {
    return this.activePracticeArea === slug;
  }

  /** Map of template category/type → remix-icon class for the card icon. */
  iconFor(tpl: TemplateSearchResult): string {
    const hay = `${tpl?.category || ''} ${tpl?.name || ''}`.toLowerCase();
    if (hay.includes('letter of representation') || hay.includes('lor')) return 'ri-mail-send-line';
    if (hay.includes('demand')) return 'ri-money-dollar-box-line';
    if (hay.includes('motion to dismiss')) return 'ri-error-warning-line';
    if (hay.includes('motion to suppress')) return 'ri-shield-cross-line';
    if (hay.includes('motion')) return 'ri-article-line';
    if (hay.includes('complaint') || hay.includes('petition')) return 'ri-scales-3-line';
    if (hay.includes('retainer') || hay.includes('engagement')) return 'ri-hand-coin-line';
    if (hay.includes('interrogator') || hay.includes('discovery')) return 'ri-search-line';
    if (hay.includes('settlement')) return 'ri-handshake-line';
    if (hay.includes('contract') || hay.includes('agreement')) return 'ri-file-paper-2-line';
    if (hay.includes('brief') || hay.includes('memorandum') || hay.includes('memo')) return 'ri-book-open-line';
    if (hay.includes('affidavit')) return 'ri-quill-pen-line';
    if (hay.includes('subpoena')) return 'ri-article-line';
    if (hay.includes('deed') || hay.includes('closing')) return 'ri-home-smile-line';
    if (hay.includes('will') || hay.includes('trust')) return 'ri-safe-2-line';
    return 'ri-file-text-line';
  }

  paLabel(tpl: TemplateSearchResult): string {
    const pa = (tpl?.practiceArea || '').trim();
    if (!pa) return 'General';
    const match = PRACTICE_AREAS.find(p => p.slug === pa.toLowerCase());
    return match ? match.name : pa;
  }

  jurisdictionLabel(tpl: TemplateSearchResult): string {
    const jur = (tpl?.jurisdiction || '').trim();
    if (!jur) return '';
    const opt = getJurisdictionByName(jur);
    return opt ? opt.name : jur;
  }

  private normalizePracticeArea(slug: string | null | undefined): string | null {
    if (!slug) return null;
    const lower = slug.toLowerCase().trim();
    return PRACTICE_AREAS.find(p => p.slug === lower) ? lower : null;
  }

  private normalizeJurisdictionName(nameOrCode: string | null | undefined): string | null {
    if (!nameOrCode) return null;
    const found = getJurisdictionByName(nameOrCode);
    return found?.name ?? null;
  }
}
