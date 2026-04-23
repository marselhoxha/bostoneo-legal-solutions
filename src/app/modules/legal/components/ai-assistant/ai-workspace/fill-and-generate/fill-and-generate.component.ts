/**
 * Sprint 4c — Phase 4 · Fill & Generate (AILegalTemplate path)
 *
 * NOMENCLATURE
 *   Two "template" systems coexist in this app:
 *     • AILegalTemplate   — DB rows (id, name, body, variables). This component consumes these.
 *     • DocumentTypeTemplate — JSON files under resources/templates/document-types/ that the
 *                              backend 4-way cascade resolves at draft time. NOT this component.
 *
 * FLOW
 *   1. Parent passes a picked AILegalTemplate (via dashboard mini-card OR inline picker).
 *   2. This component loads the template's variable definitions
 *      (GET /api/ai/templates/{id}/variables) and, if a case is linked, asks the backend for
 *      AI-suggested values (POST /api/ai/templates/{id}/suggest-values).
 *   3. The attorney reviews the auto-filled values + adds optional extra instructions.
 *   4. On Generate, we emit a typed `FillAndGenerateResult` to the parent. The parent bridges
 *      to the existing SSE draft flow by stuffing `templateId`, `templateName`, and
 *      `templateVariables` into `wizardDocumentOptions` — the backend prompt-builder appends
 *      those verbatim into the AI prompt so the generated draft honors the filled values.
 *
 * WHY NOT CALL /generate-flexible DIRECTLY?
 *   `/generate-flexible` is a synchronous JSON endpoint used by AutoFillWizardComponent.
 *   Phase 4's spec explicitly routes through the existing SSE flow (`startCustomDraft`) so
 *   we get the streaming UX, workflow pills, and editor handoff the rest of LegiDraft
 *   already provides.
 */
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
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { forkJoin, Subject, of } from 'rxjs';
import { catchError, finalize, map, takeUntil } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { Key } from 'src/app/enum/key.enum';
import {
  Template,
  TemplateVariable,
  TemplateService
} from 'src/app/modules/legal/services/template.service';
import {
  PRACTICE_AREAS,
  JURISDICTIONS
} from 'src/app/modules/legal/shared/legal-constants';

/** Result emitted when the attorney clicks Generate. */
export interface FillAndGenerateResult {
  templateId: number;
  templateName: string;
  templatePracticeArea: string | null;
  templateJurisdiction: string | null;
  /** Backend document-type slug (e.g. 'lor', 'motion_to_dismiss') — drives the 4-way
   *  DocumentTypeTemplate registry cascade. Null if the template row doesn't declare one. */
  templateDocumentType: string | null;
  /** The AILegalTemplate's body (often HTML with {{placeholders}}). We embed this in the
   *  prompt so the AI follows THIS template's wording, not the generic registry scaffolding. */
  templateContent: string | null;
  caseId: number | null;
  variableValues: Record<string, string>;
  additionalInstructions: string;
}

interface VariableSuggestion {
  variableName: string;
  variableType: string;
  suggestedValue: string;
  source: string;
  confidence: number;
  isRequired: boolean;
}

/** Variables are rendered in two visual groups — pulled from case vs. attorney-authored. */
interface GroupedVariables {
  fromCase: Array<TemplateVariable & { suggestion?: VariableSuggestion }>;
  custom: Array<TemplateVariable & { suggestion?: VariableSuggestion }>;
}

@Component({
  selector: 'app-fill-and-generate',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './fill-and-generate.component.html',
  styleUrls: ['./fill-and-generate.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FillAndGenerateComponent implements OnInit, OnChanges, OnDestroy {
  @Input() template: Template | null = null;
  @Input() linkedCase: any | null = null;
  @Input() availableCases: any[] = [];

  @Output() submit = new EventEmitter<FillAndGenerateResult>();
  @Output() backToDashboard = new EventEmitter<void>();
  @Output() changeTemplate = new EventEmitter<void>();

  form!: FormGroup;
  groupedVariables: GroupedVariables = { fromCase: [], custom: [] };
  suggestions: Record<string, VariableSuggestion> = {};

  /** Full template row, loaded on init. The @Input `template` is often a lightweight
   *  projection from the picker (6 fields); we need the full row to forward
   *  `documentType` + `templateContent` to the SSE flow. */
  fullTemplate: Template | null = null;

  loading = false;
  suggesting = false;
  error: string | null = null;

  additionalInstructions = '';
  selectedCaseId: number | null = null;

  private apiUrl = `${environment.apiUrl}/api/ai/templates`;
  private destroy$ = new Subject<void>();

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private templateService: TemplateService,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({});
  }

  ngOnInit(): void {
    this.selectedCaseId = this.linkedCase?.id ?? null;
    this.loadTemplateData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Reload when a different template is swapped in (e.g. user clicks "Change template").
    const templateChanged =
      !!changes['template'] &&
      !changes['template'].firstChange &&
      changes['template'].currentValue?.id !== changes['template'].previousValue?.id;

    const caseChanged =
      !!changes['linkedCase'] &&
      !changes['linkedCase'].firstChange &&
      changes['linkedCase'].currentValue?.id !== changes['linkedCase'].previousValue?.id;

    if (templateChanged) {
      this.selectedCaseId = this.linkedCase?.id ?? null;
      this.loadTemplateData();
    } else if (caseChanged) {
      this.selectedCaseId = this.linkedCase?.id ?? null;
      if (this.template?.id) this.refreshAiSuggestions();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============ Data loading ============

  /** Parallel fetch: full template (for documentType + templateContent) + variable
   *  definitions + (optional) AI-suggested values. */
  private loadTemplateData(): void {
    if (!this.template?.id) return;

    this.loading = true;
    this.error = null;
    this.suggestions = {};
    this.fullTemplate = null;
    this.cdr.markForCheck();

    const template$ = this.templateService.getTemplate(this.template.id).pipe(
      catchError(() => of(null as Template | null))
    );
    const variables$ = this.templateService.getTemplateVariables(this.template.id).pipe(
      catchError(() => of([] as TemplateVariable[]))
    );
    const suggestions$ = this.linkedCase?.id
      ? this.fetchSuggestions(this.template.id, this.linkedCase.id)
      : of([] as VariableSuggestion[]);

    forkJoin({ tpl: template$, variables: variables$, suggestions: suggestions$ })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe(({ tpl, variables, suggestions }) => {
        this.fullTemplate = tpl;
        this.buildForm(variables, suggestions);
      });
  }

  /** Re-fetch only AI suggestions — used when the linked case changes. */
  private refreshAiSuggestions(): void {
    if (!this.template?.id || !this.linkedCase?.id) return;
    this.suggesting = true;
    this.cdr.markForCheck();

    this.fetchSuggestions(this.template.id, this.linkedCase.id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.suggesting = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe((suggestions: VariableSuggestion[]) => {
        // Only patch values for empty fields — don't stomp attorney edits.
        suggestions.forEach(s => {
          this.suggestions[s.variableName] = s;
          if (!this.form.contains(s.variableName)) return;
          const current = this.form.get(s.variableName)?.value;
          if (!current && s.suggestedValue) {
            this.form.patchValue({ [s.variableName]: s.suggestedValue });
          }
        });
      });
  }

  private fetchSuggestions(templateId: number, caseId: number) {
    const headers = this.buildAuthHeaders();
    const body = { contextType: 'CASE', caseId };
    return this.http
      .post<{ variables: VariableSuggestion[] }>(
        `${this.apiUrl}/${templateId}/suggest-values`,
        body,
        { headers }
      )
      .pipe(
        map(resp => resp?.variables || []),
        catchError(() => of([] as VariableSuggestion[]))
      );
  }

  private buildForm(variables: TemplateVariable[], suggestions: VariableSuggestion[]): void {
    // Index suggestions by variable name for fast lookup + summary badges.
    this.suggestions = {};
    suggestions.forEach(s => (this.suggestions[s.variableName] = s));

    const group: Record<string, any> = {};
    const fromCase: GroupedVariables['fromCase'] = [];
    const custom: GroupedVariables['custom'] = [];

    (variables || [])
      .slice()
      .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999))
      .forEach(v => {
        const sug = this.suggestions[v.variableName];
        const initial = sug?.suggestedValue ?? v.defaultValue ?? '';
        group[v.variableName] = v.isRequired
          ? [initial, Validators.required]
          : [initial];

        // Heuristic: if the backend returned a suggestion sourced from CASE/CLIENT (or
        // dataSource declares a case-derived field), show it in the "From case" group.
        const caseDerived = this.isCaseDerived(v, sug);
        (caseDerived ? fromCase : custom).push({ ...v, suggestion: sug });
      });

    this.form = this.fb.group(group);
    this.groupedVariables = { fromCase, custom };
  }

  private isCaseDerived(v: TemplateVariable, sug?: VariableSuggestion): boolean {
    if (sug?.source && /case|client/i.test(sug.source)) return true;
    const ds = (v.dataSource || '').toLowerCase();
    return ds.includes('case') || ds.includes('client') || ds.includes('party');
  }

  // ============ Event handlers ============

  onBack(): void {
    this.backToDashboard.emit();
  }

  onChangeTemplate(): void {
    this.changeTemplate.emit();
  }

  onGenerate(): void {
    if (!this.template?.id) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const variableValues: Record<string, string> = {};
    Object.entries(this.form.value || {}).forEach(([k, v]) => {
      variableValues[k] = (v ?? '').toString();
    });

    // Prefer the full row we fetched in loadTemplateData — it has documentType +
    // templateContent. Fall back to the @Input projection if the fetch errored.
    const merged = this.fullTemplate ?? this.template;

    this.submit.emit({
      templateId: this.template.id,
      templateName: merged?.name ?? this.template.name,
      templatePracticeArea: merged?.practiceArea ?? this.template.practiceArea ?? null,
      templateJurisdiction: merged?.jurisdiction ?? this.template.jurisdiction ?? null,
      templateDocumentType: merged?.documentType ?? null,
      templateContent: merged?.templateContent ?? null,
      caseId: this.selectedCaseId,
      variableValues,
      additionalInstructions: (this.additionalInstructions || '').trim()
    });
  }

  onCaseChange(idRaw: string | number | null): void {
    const id = idRaw == null || idRaw === '' ? null : Number(idRaw);
    this.selectedCaseId = id;
    const picked = id ? this.availableCases.find(c => c.id === id) : null;
    // Keep linkedCase in sync so AI-suggest refresh uses the right case id.
    if (picked) {
      this.linkedCase = picked;
      if (this.template?.id) this.refreshAiSuggestions();
    } else {
      this.linkedCase = null;
    }
  }

  // ============ Display helpers ============

  practiceAreaLabel(slug?: string | null): string {
    if (!slug) return '';
    return PRACTICE_AREAS.find(p => p.slug === slug.toLowerCase())?.name ?? slug;
  }

  jurisdictionLabel(nameOrCode?: string | null): string {
    if (!nameOrCode) return '';
    const lower = nameOrCode.toLowerCase();
    const match =
      JURISDICTIONS.find(j => j.name.toLowerCase() === lower) ||
      JURISDICTIONS.find(j => j.code === lower);
    return match?.name ?? nameOrCode;
  }

  inputType(variableType: string | undefined): string {
    switch ((variableType || '').toUpperCase()) {
      case 'DATE':     return 'date';
      case 'NUMBER':   return 'number';
      case 'CURRENCY': return 'number';
      case 'EMAIL':    return 'email';
      case 'PHONE':    return 'tel';
      default:         return 'text';
    }
  }

  isLongText(variableType: string | undefined): boolean {
    return (variableType || '').toUpperCase() === 'TEXTAREA';
  }

  filledCount(): number {
    const values = this.form?.value || {};
    return Object.values(values).filter(v => (v ?? '').toString().trim().length > 0).length;
  }

  totalVariables(): number {
    return this.groupedVariables.fromCase.length + this.groupedVariables.custom.length;
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
