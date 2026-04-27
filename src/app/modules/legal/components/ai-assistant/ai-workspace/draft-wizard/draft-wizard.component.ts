import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs';
import {
  COURT_LEVELS,
  getJurisdictionByName,
  getPracticeArea,
  JURISDICTIONS,
  PracticeAreaOption,
  PRACTICE_AREAS
} from '../../../../shared/legal-constants';
import { DocumentCatalogService } from '../../../../services/document-catalog.service';
import {
  CatalogEntry,
  CatalogTier,
  PracticeAreaCatalogResponse
} from '../../../../interfaces/document-catalog.interface';

/**
 * Legacy UI shapes retained for external consumers that still import these types.
 * The wizard itself now renders from {@link PracticeAreaCatalogResponse} — these
 * interfaces are no longer internally authoritative.
 */
export interface DocumentTypeItemUi {
  id: string;
  name: string;
  placeholderExample?: string;
}

export interface DocumentTypeCategoryUi {
  id: string;
  name: string;
  icon: string;
  expanded?: boolean;
  types: DocumentTypeItemUi[];
}

/** Payload the wizard emits on submit. Parent maps this to the backend DraftGenerationRequest. */
export interface DraftWizardResult {
  practiceArea: string;        // slug, e.g. 'pi'
  practiceAreaName: string;    // display, e.g. 'Personal Injury'
  documentType: string;        // BACKEND slug sent to the registry cascade, e.g. 'lor', 'motion_to_dismiss'
  documentTypeUiId: string;    // UI catalog id (used for display / selectedDocTypePill), e.g. 'letter-of-representation'
  documentTypeName: string;    // display name, e.g. 'Letter of Representation'
  jurisdiction: string;        // display name, e.g. 'Massachusetts'
  jurisdictionCode: string;    // ISO, e.g. 'ma'
  courtLevel: string;
  caseId: number | null;
  prompt: string;
  documentOptions: Record<string, any>;
}

const LOR_RECIPIENTS: Array<{ value: string; label: string; hint: string; tooltip: string }> = [
  {
    value: 'defendant_insurer',
    label: "Defendant's liability insurer",
    hint: 'For policy limits disclosure, liability claims',
    tooltip: 'Use when writing to the other driver or tortfeasor\u2019s insurance carrier to disclose representation and request policy limits.'
  },
  {
    value: 'client_insurer',
    label: "Client's own insurer",
    hint: 'For PIP, UIM/UM claims',
    tooltip: 'Use when writing to your client\u2019s own carrier for PIP, Med-Pay, or UIM/UM coverage claims.'
  },
  {
    value: 'defendant_counsel',
    label: 'Opposing counsel',
    hint: 'Notice of appearance',
    tooltip: 'Use once opposing counsel has appeared \u2014 establishes the channel for formal correspondence.'
  },
  {
    value: 'other_party',
    label: 'Other party / entity',
    hint: 'Third party, employer, etc.',
    tooltip: 'Use for employers, property owners, or third parties outside insurance channels. Add recipient details in the instructions.'
  }
];

// NOTE: `preservation_request` slug is intentionally retained as a catch-all for insurer-only
// supplementary requests. Sprint 4a relabels it to "Adjuster/supervisor assignment request" to
// match the approved mockup; the AI prompt copy surfaces the new intent.
const LOR_PURPOSES: Array<{ value: string; label: string; allowedRecipients: string[]; tooltip: string }> = [
  {
    value: 'representation_notice',
    label: 'Notice of representation',
    allowedRecipients: ['defendant_insurer', 'client_insurer', 'defendant_counsel', 'other_party'],
    tooltip: 'Always included. Establishes your firm as counsel of record and instructs direct communication to cease.'
  },
  {
    value: 'policy_limits_demand',
    label: 'Policy limits disclosure request',
    allowedRecipients: ['defendant_insurer'],
    tooltip: 'Requests disclosure of liability policy limits. Only applies when writing to the defendant\u2019s insurer.'
  },
  {
    value: 'pip_application_request',
    label: 'PIP application & benefits',
    allowedRecipients: ['client_insurer'],
    tooltip: 'Opens a PIP / Med-Pay claim with your client\u2019s own carrier. Requires the client\u2019s policy details on file.'
  },
  {
    value: 'uim_notice',
    label: 'UIM / UM coverage claim',
    allowedRecipients: ['client_insurer'],
    tooltip: 'Puts the client\u2019s carrier on notice of an under- / uninsured-motorist claim. Often paired with the PIP request.'
  },
  {
    value: 'preservation_request',
    label: 'Adjuster / supervisor assignment',
    allowedRecipients: ['defendant_insurer', 'client_insurer'],
    tooltip: 'Requests a named adjuster or supervisor for the file. Keeps future correspondence attributable to a specific person.'
  }
];

const MTD_GROUNDS: string[] = [
  'Lack of subject matter jurisdiction',
  'Lack of personal jurisdiction',
  'Improper venue',
  'Failure to state a claim',
  'Failure to join required party',
  'Insufficient service of process'
];

const INTERROG_TOPICS: string[] = [
  'Liability', 'Damages', 'Causation', 'Affirmative Defenses', 'Expert Witnesses', 'Document Production'
];

/** Doc-type UI ids that open Step 3 (config). All others skip straight to Step 4. */
const TYPES_WITH_CONFIG = new Set<string>([
  'letter-of-representation',
  'demand-letter',
  'motion-dismiss',
  'interrogatories'
]);

/**
 * Per-type visual metadata for the Step-2 doctype-card UI.
 * Icons come from Remix Icon (https://remixicon.com).
 * Missing ids fall back to a category-derived icon.
 */
const DOC_TYPE_META: Record<string, { icon: string; desc: string }> = {
  // Pleadings
  'complaint':                { icon: 'ri-file-list-3-line',     desc: 'Civil complaint — parties, facts, counts, prayer for relief' },
  'answer':                   { icon: 'ri-file-shield-2-line',   desc: 'Response to complaint — admissions, denials, defenses' },
  'counterclaim':             { icon: 'ri-arrow-go-back-line',   desc: 'Claim asserted against the plaintiff' },
  // Motions
  'motion-dismiss':           { icon: 'ri-close-circle-line',    desc: '12(b) grounds — jurisdiction, venue, failure to state a claim' },
  'motion-summary-judgment':  { icon: 'ri-focus-3-line',         desc: 'No genuine dispute of material fact' },
  'motion-compel':            { icon: 'ri-arrow-right-double-line', desc: 'Force discovery responses that were not provided' },
  'motion-suppress':          { icon: 'ri-eye-close-line',       desc: 'Exclude evidence — 4th/5th/6th Amendment or rule-based' },
  'motion-protective-order':  { icon: 'ri-shield-keyhole-line',  desc: 'Limit disclosure of confidential information' },
  // Discovery
  'interrogatories':          { icon: 'ri-question-answer-line', desc: 'Written questions requiring sworn answers' },
  'rfp':                      { icon: 'ri-folder-download-line', desc: 'Request for production of documents and things' },
  'rfa':                      { icon: 'ri-check-double-line',    desc: 'Request for admission of facts or genuineness' },
  'deposition-notice':        { icon: 'ri-mic-line',             desc: 'Notice of deposition — deponent, date, scope' },
  'subpoena':                 { icon: 'ri-article-line',         desc: 'Compel testimony or produce records' },
  // Correspondence
  'letter-of-representation': { icon: 'ri-mail-send-line',       desc: 'Notice of representation · policy limits · PIP · UIM · multi-purpose' },
  'demand-letter':            { icon: 'ri-money-dollar-box-line', desc: 'Settlement demand with damages breakdown' },
  'settlement-letter':        { icon: 'ri-handshake-line',       desc: 'Acceptance or counter-offer letter' },
  'settlement-offer':         { icon: 'ri-hand-coin-line',       desc: 'Monetary proposal with timeline and terms' },
  'opinion-letter':           { icon: 'ri-scales-line',          desc: 'Legal opinion memorandum' },
  'client-email':             { icon: 'ri-mail-line',            desc: 'Client update or status email' },
  'opposing-counsel-letter':  { icon: 'ri-user-settings-line',   desc: 'Communication with opposing counsel' },
  'medical-records-request':  { icon: 'ri-hospital-line',        desc: 'HIPAA-compliant records request for treating providers' },
  // PI-specific
  'settlement-release':       { icon: 'ri-check-line',           desc: 'Final release + indemnity on paid settlement' },
  'intake-questionnaire':     { icon: 'ri-clipboard-line',       desc: 'Initial intake · incident details · injuries · treatment providers' },
  'engagement-letter':        { icon: 'ri-quill-pen-line',       desc: 'Terms of representation · scope · client / firm duties' },
  'contingency-fee-agreement':{ icon: 'ri-money-dollar-circle-line', desc: 'Fee terms · costs handling · lien · settlement authority' },
  'hipaa-authorization':      { icon: 'ri-shield-user-line',     desc: 'PHI release for medical records · federally compliant' },
  // PI-specific (Wave 1)
  'notice-of-claim':                { icon: 'ri-megaphone-line',          desc: 'First notice of loss · carrier acknowledgment · prompt-notice trigger' },
  'settlement-distribution-statement': { icon: 'ri-pie-chart-line',       desc: 'Closing statement · fee · costs · lien payoffs · net to client' },
  'preservation-letter':            { icon: 'ri-shield-check-line',       desc: 'Spoliation hold · evidence categories · ESI · sanctions warning' },
  'vehicle-preservation-letter':    { icon: 'ri-roadster-line',           desc: 'Vehicle / EDR / ECM / dashcam preservation · 49 C.F.R. Part 563' },
  'surveillance-preservation-letter': { icon: 'ri-camera-lens-line',      desc: 'CCTV / body cam preservation · audit trail · incident-window scope' },
  'employment-records-auth':        { icon: 'ri-briefcase-line',          desc: 'Client-signed authorization · wage loss · GINA-compliant' },
  'physician-narrative-request':    { icon: 'ri-stethoscope-line',        desc: 'Treating provider narrative · causation · prognosis · AMA Guides 6th' },
  'letter-of-protection':           { icon: 'ri-first-aid-kit-line',      desc: 'Provider treats on lien against settlement · attorney-witnessed' },
  'policy-limits-demand':           { icon: 'ri-alarm-warning-line',      desc: 'Time-limited policy-limits demand · bad-faith setup · NAIC UCSPA' },
  'tribunal-offer-of-proof':        { icon: 'ri-government-line',         desc: 'M.G.L. c. 231 § 60B med-mal tribunal · SOC · breach · causation' },
  // Family
  'divorce-petition':         { icon: 'ri-user-unfollow-line',   desc: 'Complaint for divorce with grounds + requested relief' },
  'custody-motion':           { icon: 'ri-parent-line',          desc: 'Motion for legal/physical custody determination' },
  'financial-statement':      { icon: 'ri-bank-card-line',       desc: 'Probate & Family Court financial disclosure' },
  'modification-motion':      { icon: 'ri-refresh-line',         desc: 'Post-judgment modification of support/custody/alimony' },
  'restraining-order':        { icon: 'ri-shield-line',          desc: '209A protective order petition' },
  'parenting-plan':           { icon: 'ri-calendar-2-line',      desc: 'Custody + visitation schedule + decision-making allocation' },
  'child-support-worksheet':  { icon: 'ri-calculator-line',      desc: 'MA Child Support Guidelines computation' },
  'temporary-orders-motion':  { icon: 'ri-time-line',            desc: 'Motion for temporary orders pendente lite' },
  // Criminal
  'bail-motion':              { icon: 'ri-scales-3-line',        desc: 'Bail determination / modification motion' },
  'sentencing-memo':          { icon: 'ri-scales-2-line',        desc: 'Mitigation memorandum addressing sentencing factors' },
  'plea-agreement':           { icon: 'ri-handshake-line',       desc: 'Negotiated plea — counts, disposition, conditions' },
  'appeal-brief':             { icon: 'ri-book-open-line',       desc: 'Opening brief on criminal appeal' },
  // Contracts
  'contract-employment':      { icon: 'ri-user-star-line',       desc: 'Employment agreement — salary, benefits, restrictive covenants' },
  'contract-nda':             { icon: 'ri-lock-line',            desc: 'Mutual or one-way non-disclosure' },
  'contract-sale':            { icon: 'ri-shopping-cart-line',   desc: 'Purchase/sale agreement for goods or property' },
  'contract-service':         { icon: 'ri-tools-line',           desc: 'Services or consulting agreement' },
  'amendment':                { icon: 'ri-edit-2-line',          desc: 'Amend terms of an existing contract' },
  'clause':                   { icon: 'ri-code-box-line',        desc: 'Single contractual clause (arbitration, IP, etc.)' },
  // Estate
  'will':                     { icon: 'ri-quill-pen-line',       desc: 'Last will & testament with executor + bequests' },
  'rlt':                      { icon: 'ri-safe-line',            desc: 'Revocable living trust with funding instructions' },
  'dpoa':                     { icon: 'ri-user-settings-line',   desc: 'Durable power of attorney — financial agent' },
  'healthcare-proxy':         { icon: 'ri-heart-pulse-line',     desc: 'MGL c.201D healthcare decisions agent' },
  'hipaa-auth':               { icon: 'ri-shield-user-line',     desc: 'Authorization for protected health information release' },
  // Real Estate
  'psa':                      { icon: 'ri-home-5-line',          desc: 'Purchase & sale agreement — residential/commercial' },
  'lease':                    { icon: 'ri-key-2-line',           desc: 'Lease agreement with term, rent, and covenants' },
  'deed':                     { icon: 'ri-file-copy-2-line',     desc: 'Warranty or quitclaim deed for title transfer' },
  'closing-statement':        { icon: 'ri-file-chart-line',      desc: 'HUD-1 / CFPB closing disclosure schedule' },
  'loi':                      { icon: 'ri-draft-line',           desc: 'Letter of intent — non-binding term sheet' },
  // Appellate
  'appellate-brief':          { icon: 'ri-book-open-line',       desc: 'Opening brief on appeal' },
  'reply-brief':              { icon: 'ri-reply-line',           desc: 'Reply to appellee/respondent arguments' },
  // Other
  'legal-memo':               { icon: 'ri-file-text-line',       desc: 'Internal research memorandum' },
  'legal-argument':           { icon: 'ri-chat-quote-line',      desc: 'Standalone legal argument or section' },
  'affidavit':                { icon: 'ri-user-voice-line',      desc: 'Sworn written statement of a witness' },
  'settlement-agreement':     { icon: 'ri-check-line',           desc: 'Final settlement contract with releases' },
  'stipulation':              { icon: 'ri-git-merge-line',       desc: 'Agreed-upon facts or procedural points' },
  'notice':                   { icon: 'ri-notification-3-line',  desc: 'Notice to court, party, or witness' }
};

@Component({
  selector: 'app-draft-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbTooltipModule],
  templateUrl: './draft-wizard.component.html',
  styleUrls: ['./draft-wizard.component.scss']
})
export class DraftWizardComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @Input() availableCases: any[] = [];
  @Input() initialCaseId: number | null = null;
  @Input() initialPrompt = '';

  @Output() wizardSubmit = new EventEmitter<DraftWizardResult>();
  @Output() wizardCancel = new EventEmitter<void>();
  @Output() promptChange = new EventEmitter<string>();
  /** Sprint 4a — bubble up case changes so the Case Context panel can refresh. */
  @Output() caseSelectionChange = new EventEmitter<any | null>();

  readonly practiceAreas = PRACTICE_AREAS;
  readonly jurisdictions = JURISDICTIONS;
  readonly courtLevels = COURT_LEVELS;
  readonly lorRecipients = LOR_RECIPIENTS;
  readonly mtdGrounds = MTD_GROUNDS;
  readonly interrogTopics = INTERROG_TOPICS;

  currentStep: 1 | 2 | 3 | 4 = 1;
  selectedPracticeArea: PracticeAreaOption | null = null;
  /** Slug of the PA auto-populated from the open case — used to render the "CASE" badge on Step 1. */
  inheritedPracticeAreaSlug: string | null = null;
  /** Simplified selection kept for template + generation-flow compatibility. */
  selectedDocType: DocumentTypeItemUi | null = null;
  /** Full catalog entry for the currently selected doc type (drives backend slug + coverage flag). */
  selectedEntry: CatalogEntry | null = null;
  /** Step 2 free-text filter across doc-type names + descriptions. */
  docTypeSearch = '';
  selectedJurisdiction = '';
  selectedJurisdictionCode = '';
  selectedCourtLevel = 'DEFAULT';
  selectedCaseId: number | null = null;
  prompt = '';

  // Type-specific options
  lorRecipient = 'defendant_insurer';
  lorPurposes: string[] = ['representation_notice'];
  mtdSelectedGrounds: string[] = [];
  interrogCount = 25;
  interrogSelectedTopics: string[] = [];

  // Inline Case Strip picker state (replaces the right-rail panel).
  caseStripPickerOpen = false;
  caseStripPickerId: number | null = null;

  // ─── Sprint 5 — registry-driven catalog state ────────────────────────────
  catalog: PracticeAreaCatalogResponse | null = null;
  catalogLoading = false;
  catalogError: string | null = null;
  /** Tier ranks expanded by the user. Tier 1 is always expanded; search auto-expands all. */
  expandedTiers = new Set<number>([1]);
  private catalogSub: Subscription | null = null;
  private destroyed = false;

  constructor(
    private router: Router,
    private catalogService: DocumentCatalogService,
    // `zone` re-enters Angular's zone after awaiting native ES-module
    // dynamic imports (e.g. `await import('sweetalert2')`), which resolve
    // in the root zone and break CD on the subsequent state updates.
    // `host` is the wizard's root element — used by setStep() to scroll
    // the wizard into view when the user jumps between steps.
    private zone: NgZone,
    private host: ElementRef<HTMLElement>,
    // `cdr.detectChanges()` in the catalog-load subscribe callbacks forces a
    // synchronous CD tick on the wizard subtree. zone.run alone was not enough
    // to repaint the spinner → cards transition on PA switch after the
    // sweetalert confirm; detectChanges is a belt-and-suspenders guarantee.
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.hydrateFromCase();
    this.prompt = this.initialPrompt || '';
    if (this.initialCaseId != null) this.selectedCaseId = this.initialCaseId;
  }

  ngAfterViewInit(): void {
    // The wizard is mounted via *ngIf when the user clicks "+ New Draft" on
    // the dashboard — no route change fires, so Router's scrollPositionRestoration
    // doesn't help, and setStep() only runs on subsequent step transitions.
    // Without this hook the wizard inherits whatever scroll offset the dashboard
    // left, landing the user mid-page on step 1.
    this.scrollToTop();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialCaseId'] && this.initialCaseId != null) {
      this.selectedCaseId = this.initialCaseId;
    }
    if (changes['initialPrompt']) {
      this.prompt = this.initialPrompt || '';
    }
    // Retry hydration when either the id or the case list arrives — ai-workspace loads
    // userCases asynchronously, so availableCases is often empty on first mount.
    if (changes['initialCaseId'] || changes['availableCases']) {
      this.hydrateFromCase();
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.catalogSub?.unsubscribe();
  }

  /** Pull practice area + jurisdiction defaults from the pre-selected case. */
  private hydrateFromCase(): void {
    const caseId = this.initialCaseId ?? this.selectedCaseId;
    if (caseId == null) return;
    const c = this.availableCases.find((x: any) => x.id === caseId);
    if (!c) return;

    let paChanged = false;
    if (!this.selectedPracticeArea) {
      // Use the full fallback chain (practiceArea → effectivePracticeArea →
      // legacy `type`) so cases whose `practice_area` column is null — e.g.
      // older rows that only populate the legacy `type` column — still
      // inherit their PA. Without this fallback the wizard would land on
      // step 1 with nothing pre-selected and force the user to pick a PA
      // that the backend already knows.
      const paSlug = this.casePaSlug(c);
      if (paSlug) {
        this.selectedPracticeArea = getPracticeArea(paSlug) ?? null;
        this.inheritedPracticeAreaSlug = this.selectedPracticeArea?.slug ?? null;
        paChanged = !!this.selectedPracticeArea;
      }
    }
    if (!this.selectedJurisdiction && c.jurisdiction) {
      const j = getJurisdictionByName(c.jurisdiction);
      if (j) {
        this.selectedJurisdiction = j.name;
        this.selectedJurisdictionCode = j.code;
      } else {
        this.selectedJurisdiction = String(c.jurisdiction);
      }
    }
    if (paChanged) this.loadCatalog();
  }

  // ─── Step 1 ──────────────────────────────────────────────────────────────
  async selectPracticeArea(pa: PracticeAreaOption): Promise<void> {
    if (this.selectedPracticeArea?.slug === pa.slug) return;

    // Guard against drafting from the wrong practice area for a linked case.
    // Resolve the case's PA at click time (not from the pre-computed
    // `inheritedPracticeAreaSlug`) so the warning still fires if the user
    // clicks a tile before `availableCases` has finished loading — the
    // original scenario behind this guard.
    const casePaSlug = this.resolveLinkedCasePaSlug();
    if (casePaSlug && casePaSlug !== pa.slug) {
      const casePa = getPracticeArea(casePaSlug);
      const linked = this.selectedCaseObject
        ?? this.availableCases.find((c: any) => c.id === (this.initialCaseId ?? this.selectedCaseId));
      const caseName = linked?.title || linked?.caseNumber || 'this case';
      const Swal = (await import('sweetalert2')).default;
      const result = await Swal.fire({
        title: 'Practice area mismatch',
        html:
          `The linked case <b>${caseName}</b> is a <b>${casePa?.name ?? 'different practice area'}</b> matter, ` +
          `but you selected <b>${pa.name}</b>.<br><br>` +
          `Drafts from the wrong practice area may use the wrong templates and citations. Continue with ${pa.name}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: `Use ${pa.name}`,
        cancelButtonText: `Keep ${casePa?.name ?? 'case practice area'}`,
        confirmButtonColor: '#556ee6',
        allowEscapeKey: false,
        allowOutsideClick: false
      });
      if (!result.isConfirmed) return;
    }

    // `await import('sweetalert2')` above resolves in the root zone — re-enter
    // Angular's zone so loadCatalog()'s HTTP subscribe callback ticks CD when
    // the response lands (otherwise the spinner hangs until the next user event).
    this.zone.run(() => {
      this.selectedPracticeArea = pa;
      this.selectedEntry = null;
      this.selectedDocType = null;
      this.expandedTiers = new Set<number>([1]);
      this.loadCatalog();
    });
  }

  /**
   * Resolve a case object's practice-area slug. Mirrors the backend
   * `PracticeArea.fromString()` normalization so we recognize every shape the
   * DB might store:
   *   • slug               → `"pi"`, `"estate"`
   *   • display name       → `"Personal Injury"`, `"Estate Planning"`
   *   • Java enum name     → `"PERSONAL_INJURY"`, `"ESTATE_PLANNING"`
   *   • kebab/spaced variants of any of the above
   *
   * Field-fallback chain matches `LegalCaseDTO.getEffectivePracticeArea()`:
   * `practiceArea` → `effectivePracticeArea` → `type` — older cases store the
   * PA only on the legacy `type` column.
   *
   * Returns null if no value maps to a known PA.
   */
  private casePaSlug(c: any): string | null {
    if (!c) return null;
    const raw = c.practiceArea ?? c.effectivePracticeArea ?? c.type;
    if (!raw) return null;
    // Canonical form: lowercase, spaces/hyphens → underscores. This collapses
    // "pi", "PI", "Personal Injury", "personal-injury", and "PERSONAL_INJURY"
    // onto the same key space.
    const normalize = (s: string) => s.trim().toLowerCase().replace(/[-\s]+/g, '_');
    const normalized = normalize(String(raw));
    // Match against slug (`"pi"`) OR the enum-name equivalent of the display
    // name (`"Personal Injury"` → `"personal_injury"` = `PERSONAL_INJURY` lc).
    const hit = this.practiceAreas.find(
      p => p.slug === normalized || normalize(p.name) === normalized
    );
    return hit?.slug ?? null;
  }

  /**
   * Look up the currently-linked case's PA slug. Returns null if no case is
   * linked or the case list hasn't loaded yet. Used by `selectPracticeArea`
   * to avoid relying on the race-prone `inheritedPracticeAreaSlug` field.
   */
  private resolveLinkedCasePaSlug(): string | null {
    const caseId = this.selectedCaseId ?? this.initialCaseId;
    if (caseId == null) return null;
    const c = this.availableCases.find((x: any) => x.id === caseId);
    return this.casePaSlug(c);
  }

  canAdvanceFrom1(): boolean {
    return !!this.selectedPracticeArea;
  }

  // ─── Step 2 ──────────────────────────────────────────────────────────────
  /**
   * Fetch the per-PA tiered catalog from the backend. Jurisdiction is included so the
   * cascade can surface state-specific templates (`lor_pi_ma` shows as specific-match
   * while `lor_pi` would show as generic-match under PI-wy).
   */
  private loadCatalog(): void {
    const pa = this.selectedPracticeArea;
    if (!pa) return;
    this.catalogSub?.unsubscribe();
    this.catalogLoading = true;
    this.catalogError = null;
    // Wrap the subscribe callbacks in `zone.run` — without this, the HTTP
    // response lands in a zone where CD does not fire (state updates but the
    // template never re-renders until an unrelated event ticks CD). The outer
    // `zone.run` at the call sites only guarantees the *subscribe call* runs
    // in Angular's zone; it does not guarantee the async `next` emission does.
    this.catalogSub = this.catalogService
      .getCatalog(pa.slug, this.selectedJurisdictionCode || this.selectedJurisdiction || null)
      .subscribe({
        next: (res) => this.zone.run(() => {
          if (this.destroyed) return;
          this.catalog = res;
          this.catalogLoading = false;
          this.cdr.detectChanges();
        }),
        error: (err) => this.zone.run(() => {
          if (this.destroyed) return;
          this.catalog = null;
          this.catalogLoading = false;
          this.catalogError = 'Could not load document types. Please try again.';
          console.error('[DraftWizard] catalog load failed', err);
          this.cdr.detectChanges();
        })
      });
  }

  toggleTier(tierRank: number): void {
    if (tierRank === 1) return; // Tier 1 always open
    if (this.expandedTiers.has(tierRank)) this.expandedTiers.delete(tierRank);
    else this.expandedTiers.add(tierRank);
  }

  /** True when the tier is open. Search auto-expands every tier to surface matches. */
  isTierExpanded(tierRank: number): boolean {
    if (this.docTypeSearch.trim()) return true;
    return tierRank === 1 || this.expandedTiers.has(tierRank);
  }

  filterTierEntries(tier: CatalogTier): CatalogEntry[] {
    const q = this.docTypeSearch.trim().toLowerCase();
    if (!q) return tier.types;
    return tier.types.filter(t =>
      (t.displayName || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    );
  }

  tierHasMatches(tier: CatalogTier): boolean {
    return this.filterTierEntries(tier).length > 0;
  }

  /** True when the active search (if any) matches zero entries across every tier. */
  get hasAnyDocTypeMatches(): boolean {
    if (!this.docTypeSearch.trim()) return true;
    if (!this.catalog?.hasCoverage) return true;
    return this.catalog.tiers.some(t => this.tierHasMatches(t));
  }

  selectCatalogEntry(entry: CatalogEntry): void {
    this.selectedEntry = entry;
    this.selectedDocType = {
      id: entry.documentTypeUiId,
      name: entry.displayName
    };
  }

  needsConfig(entry: CatalogEntry | null): boolean {
    return !!entry && TYPES_WITH_CONFIG.has(entry.documentTypeUiId);
  }

  /** Remix Icon class for a catalog entry — falls back to category-derived default. */
  entryIcon(entry: CatalogEntry): string {
    return DOC_TYPE_META[entry.documentTypeUiId]?.icon
        || this.categoryFallbackIcon(entry.category)
        || 'ri-file-line';
  }

  /** Short one-line description — catalog response wins; local DOC_TYPE_META is the fallback. */
  entryDesc(entry: CatalogEntry): string {
    return entry.description
        || DOC_TYPE_META[entry.documentTypeUiId]?.desc
        || '';
  }

  private categoryFallbackIcon(category: string | null | undefined): string {
    switch (category) {
      case 'pleading':   return 'ri-file-list-3-line';
      case 'motion':     return 'ri-gavel-line';
      case 'discovery':  return 'ri-search-eye-line';
      case 'letter':     return 'ri-mail-line';
      case 'contract':   return 'ri-file-paper-2-line';
      case 'appellate':  return 'ri-bank-line';
      default:           return 'ri-file-line';
    }
  }

  /** Step 2 change-link → back to Step 1. */
  changePracticeArea(): void {
    this.setStep(1);
  }

  /**
   * Empty-state fallback on Step 2: drops the user into Step 3 with a blank
   * legal-memo baseline so they can still draft something even when their PA
   * has no coverage yet.
   */
  useBlankDocument(): void {
    const fallback: CatalogEntry = {
      documentType: 'legal_memo',
      documentTypeUiId: 'legal-memo',
      displayName: 'Legal Memo',
      category: 'other',
      description: 'Free-form document — attorney supplies the structure via instructions',
      hasSpecificTemplate: false
    };
    this.selectCatalogEntry(fallback);
    this.setStep(3);
  }

  /** Empty-state CTA → jump to the Template Library route. */
  openTemplateLibrary(): void {
    this.router.navigate(['/legal/ai-assistant/templates']);
  }

  /** Width (0-100) of the green connector-fill between step circles. */
  get connectorFillPct(): number {
    return Math.min(100, ((this.currentStep - 1) / 3) * 100);
  }

  canAdvanceFrom2(): boolean {
    return !!this.selectedEntry;
  }

  // ─── Step 3 ──────────────────────────────────────────────────────────────
  onJurisdictionChange(name: string): void {
    this.selectedJurisdiction = name;
    this.selectedJurisdictionCode = getJurisdictionByName(name)?.code ?? '';
    // Jurisdiction affects the cascade — re-fetch so hasSpecificTemplate flags are accurate
    // (e.g. switching from MA to WY flips most PI entries to generic fallback).
    if (this.selectedPracticeArea) this.loadCatalog();
  }

  /** Purposes visible based on the chosen recipient. Not-allowed purposes are dropped from the selection. */
  get availablePurposes() {
    return LOR_PURPOSES.filter(p => p.allowedRecipients.includes(this.lorRecipient));
  }

  /**
   * Every LOR purpose with UI state derived from the current recipient.
   * - `required`: representation_notice is always on and cannot be unchecked.
   * - `enabled`: visible purpose allowed for the current recipient.
   * - `lockHint`: explains why a disabled purpose is unavailable (shown instead of the label for disabled rows).
   */
  get allPurposesWithState(): Array<{ value: string; label: string; enabled: boolean; required: boolean; lockHint?: string; tooltip: string }> {
    return LOR_PURPOSES.map(p => {
      const required = p.value === 'representation_notice';
      const enabled = p.allowedRecipients.includes(this.lorRecipient);
      let lockHint: string | undefined;
      if (!enabled) {
        if (p.value === 'policy_limits_demand')    lockHint = "Not applicable — select Defendant's liability insurer";
        else if (p.value === 'pip_application_request' || p.value === 'uim_notice') lockHint = "Not applicable — select Client's own insurer";
        else if (p.value === 'preservation_request') lockHint = 'Not applicable — select an insurer recipient';
      }
      return { value: p.value, label: p.label, enabled, required, lockHint, tooltip: p.tooltip };
    });
  }

  onRecipientChange(value: string): void {
    this.lorRecipient = value;
    const allowed = new Set(this.availablePurposes.map(p => p.value));
    this.lorPurposes = this.lorPurposes.filter(v => allowed.has(v));
    if (this.lorPurposes.length === 0) this.lorPurposes = ['representation_notice'];
  }

  togglePurpose(value: string): void {
    const i = this.lorPurposes.indexOf(value);
    if (i >= 0) this.lorPurposes.splice(i, 1);
    else this.lorPurposes.push(value);
  }

  toggleGround(value: string): void {
    const i = this.mtdSelectedGrounds.indexOf(value);
    if (i >= 0) this.mtdSelectedGrounds.splice(i, 1);
    else this.mtdSelectedGrounds.push(value);
  }

  toggleTopic(value: string): void {
    const i = this.interrogSelectedTopics.indexOf(value);
    if (i >= 0) this.interrogSelectedTopics.splice(i, 1);
    else this.interrogSelectedTopics.push(value);
  }

  canAdvanceFrom3(): boolean {
    if (!this.selectedJurisdiction) return false;
    const id = this.selectedDocType?.id;
    if (id === 'letter-of-representation') return this.lorPurposes.length > 0;
    if (id === 'motion-dismiss')           return this.mtdSelectedGrounds.length > 0;
    if (id === 'interrogatories')          return this.interrogCount > 0 && this.interrogSelectedTopics.length > 0;
    return true;
  }

  // ─── Step 4 ──────────────────────────────────────────────────────────────
  /**
   * Best-guess of the JSON template the backend registry will resolve this request to.
   * Purely informational — the cascade happens server-side.
   */
  get resolvedTemplatePreview(): string {
    const docType = this.selectedEntry?.documentType;
    const pa = this.selectedPracticeArea?.slug;
    const state = this.selectedJurisdictionCode;
    if (!docType) return '—';
    if (pa && state) return `${docType}_${pa}_${state}.json`;
    if (state)       return `${docType}_${state}.json`;
    if (pa)          return `${docType}_${pa}.json`;
    return `${docType}.json`;
  }

  onPromptInput(v: string): void {
    this.prompt = v;
    this.promptChange.emit(v);
  }

  submit(): void {
    if (!this.selectedPracticeArea || !this.selectedEntry) return;
    const docOpts: Record<string, any> = {};
    const id = this.selectedEntry.documentTypeUiId;
    if (id === 'letter-of-representation') {
      docOpts['recipientType'] = this.lorRecipient;
      docOpts['purposes'] = [...this.lorPurposes];
    } else if (id === 'motion-dismiss') {
      docOpts['grounds'] = [...this.mtdSelectedGrounds];
    } else if (id === 'interrogatories') {
      docOpts['count'] = this.interrogCount;
      docOpts['topics'] = [...this.interrogSelectedTopics];
    }

    this.wizardSubmit.emit({
      practiceArea: this.selectedPracticeArea.slug,
      practiceAreaName: this.selectedPracticeArea.name,
      documentType: this.selectedEntry.documentType,
      documentTypeUiId: id,
      documentTypeName: this.selectedEntry.displayName,
      jurisdiction: this.selectedJurisdiction,
      jurisdictionCode: this.selectedJurisdictionCode,
      courtLevel: this.selectedCourtLevel,
      caseId: this.selectedCaseId,
      prompt: this.prompt.trim(),
      documentOptions: docOpts
    });
  }

  cancel(): void {
    this.wizardCancel.emit();
  }

  // ─── Sprint 4a — helpers for the focused layout ─────────────────────────
  get selectedCaseObject(): any | null {
    if (this.selectedCaseId == null) return null;
    return this.availableCases?.find((c: any) => c.id === this.selectedCaseId) ?? null;
  }

  get clientInsuranceMissing(): boolean {
    if (this.selectedDocType?.id !== 'letter-of-representation') return false;
    if (this.lorRecipient !== 'client_insurer') return false;
    const c = this.selectedCaseObject;
    if (!c) return false;
    return !c.clientInsuranceCompany;
  }

  get selectedRecipientLabel(): string | null {
    return LOR_RECIPIENTS.find(r => r.value === this.lorRecipient)?.label ?? null;
  }

  get selectedPurposeLabels(): string[] {
    return this.lorPurposes
      .map(v => LOR_PURPOSES.find(p => p.value === v)?.label)
      .filter((l): l is string => !!l);
  }

  /**
   * Change (or clear) the linked case. When the new case's PA conflicts with
   * the currently-selected PA, prompt the user to either switch to the case's
   * PA (resets doc-type selection and jumps back to step 2), keep their
   * current PA (link the case anyway), or cancel the change entirely.
   * Returns the caseId that ended up linked (null if cleared or cancelled),
   * so callers like `onCaseStripPick` know whether to run hydration.
   */
  async onCaseChange(caseId: number | null): Promise<number | null> {
    // Clearing the case, or no PA chosen yet → no conflict possible.
    if (caseId == null || !this.selectedPracticeArea) {
      this.selectedCaseId = caseId;
      this.caseSelectionChange.emit(this.selectedCaseObject);
      return caseId;
    }

    const newCase = this.availableCases.find((c: any) => c.id === caseId);
    const newCasePaSlug = this.casePaSlug(newCase);
    const currentPa = this.selectedPracticeArea;

    // Case has no PA, or matches current → link it without prompting.
    if (!newCasePaSlug || newCasePaSlug === currentPa.slug) {
      this.selectedCaseId = caseId;
      this.caseSelectionChange.emit(this.selectedCaseObject);
      return caseId;
    }

    const casePa = getPracticeArea(newCasePaSlug);
    const caseName = newCase?.title || newCase?.caseNumber || 'this case';
    const Swal = (await import('sweetalert2')).default;
    const result = await Swal.fire({
      title: 'Practice area mismatch',
      html:
        `The case <b>${caseName}</b> is a <b>${casePa?.name ?? 'different practice area'}</b> matter, ` +
        `but your draft is set to <b>${currentPa.name}</b>.<br><br>` +
        `Switching will reset your document-type selection. What would you like to do?`,
      icon: 'warning',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: `Switch to ${casePa?.name ?? 'case PA'}`,
      denyButtonText: `Keep ${currentPa.name}`,
      cancelButtonText: `Don't change case`,
      confirmButtonColor: '#556ee6',
      denyButtonColor: '#74788d',
      allowEscapeKey: false,
      allowOutsideClick: false
    });

    // Cancel — don't change the linked case at all.
    if (result.isDismissed) return this.selectedCaseId;

    // `await import('sweetalert2')` above resolves in the root zone — re-enter
    // Angular's zone so loadCatalog()'s HTTP subscribe callback ticks CD when
    // the response lands (otherwise the catalog spinner hangs on PA switch).
    this.zone.run(() => {
      // Confirm or Deny both link the new case; only Confirm switches the PA.
      this.selectedCaseId = caseId;
      this.caseSelectionChange.emit(this.selectedCaseObject);

      if (result.isConfirmed && casePa) {
        this.selectedPracticeArea = casePa;
        this.inheritedPracticeAreaSlug = casePa.slug;
        this.selectedEntry = null;
        this.selectedDocType = null;
        this.expandedTiers = new Set<number>([1]);
        this.loadCatalog();
        if (this.currentStep > 2) this.setStep(2);
      }
    });
    return caseId;
  }

  // ─── Sprint 4a+ — inline Case Strip ─────────────────────────────────────
  get caseStripTitle(): string {
    const c = this.selectedCaseObject;
    if (!c) return '';
    return c.title || c.caseName || c.caseNumber || `Case #${c.id}`;
  }

  openCaseStripPicker(): void {
    this.caseStripPickerOpen = true;
    this.caseStripPickerId = this.selectedCaseId;
  }

  cancelCaseStripPicker(): void {
    this.caseStripPickerOpen = false;
    this.caseStripPickerId = null;
  }

  async onCaseStripPick(idRaw: string | number | null): Promise<void> {
    const id = Number(idRaw);
    if (!id) return;
    // Await the PA-mismatch guard in onCaseChange — if the user cancels, we
    // leave the picker open so they can try again.
    const linkedId = await this.onCaseChange(id);
    if (linkedId !== id) return;
    this.caseStripPickerOpen = false;
    this.caseStripPickerId = null;
    // Re-run hydration so the picked case can populate jurisdiction (and PA
    // if none was set yet — onCaseChange only sets PA when the user confirms
    // a switch from a conflicting PA).
    this.hydrateFromCase();
  }

  openLinkedCase(): void {
    const c = this.selectedCaseObject;
    if (!c?.id) return;
    this.router.navigate(['/legal/cases', c.id]);
  }

  /** Called by the parent when "+ New Draft" starts a fresh wizard pass. */
  reset(): void {
    this.currentStep = 1;
    this.selectedPracticeArea = null;
    this.inheritedPracticeAreaSlug = null;
    this.selectedDocType = null;
    this.selectedEntry = null;
    this.docTypeSearch = '';
    this.selectedJurisdiction = '';
    this.selectedJurisdictionCode = '';
    this.selectedCourtLevel = 'DEFAULT';
    this.selectedCaseId = this.initialCaseId ?? null;
    this.prompt = '';
    this.lorRecipient = 'defendant_insurer';
    this.lorPurposes = ['representation_notice'];
    this.mtdSelectedGrounds = [];
    this.interrogCount = 25;
    this.interrogSelectedTopics = [];
    this.caseStripPickerOpen = false;
    this.caseStripPickerId = null;
    this.catalog = null;
    this.catalogLoading = false;
    this.catalogError = null;
    this.expandedTiers = new Set<number>([1]);
    this.catalogSub?.unsubscribe();
    this.catalogSub = null;
    this.hydrateFromCase();
  }

  // ─── Step navigation ─────────────────────────────────────────────────────
  /**
   * Resets window scroll to 0 so step 1 / the current step opens at the real
   * top of the page. Must be `window.scrollTo`, not `scrollIntoView({block:
   * 'start'})` — the app has a 100px fixed topbar at y=0, so aligning the
   * host's top edge with viewport y=0 puts the stepper behind the topbar and
   * users see the content starting ~100px down. `behavior: 'auto'` avoids the
   * smooth-scroll cancellation that can happen when paint / competing scrolls
   * fire on the same frame as mount.
   */
  private scrollToTop(): void {
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }, 0);
  }

  /**
   * Central step-change helper. Updates `currentStep` and scrolls to top so
   * each step opens cleanly. Shares its scroll logic with `ngAfterViewInit`
   * via `scrollToTop()` — the mount-time scroll case is not served by this
   * method alone because no `setStep` call fires when *ngIf first mounts the
   * wizard from the dashboard.
   */
  private setStep(n: 1 | 2 | 3 | 4): void {
    this.currentStep = n;
    this.scrollToTop();
  }

  goTo(step: 1 | 2 | 3 | 4): void {
    if (step === this.currentStep) return;
    if (step < this.currentStep) { this.setStep(step); return; }
    if (step === 2 && this.canAdvanceFrom1()) this.setStep(2);
    else if (step === 3 && this.canAdvanceFrom1() && this.canAdvanceFrom2()) this.setStep(3);
    else if (step === 4 && this.canAdvanceFrom1() && this.canAdvanceFrom2() && this.canAdvanceFrom3()) this.setStep(4);
  }

  next(): void {
    if (this.currentStep === 1 && this.canAdvanceFrom1()) {
      this.setStep(2);
    } else if (this.currentStep === 2 && this.canAdvanceFrom2()) {
      this.setStep(3);
    } else if (this.currentStep === 3 && this.canAdvanceFrom3()) {
      this.setStep(4);
    }
  }

  prev(): void {
    if (this.currentStep > 1) {
      this.setStep((this.currentStep - 1) as 1 | 2 | 3);
    }
  }

  /** Which step-indicators render. Step 3 always shown so jurisdiction is always collectable. */
  get visibleSteps(): Array<{ num: 1 | 2 | 3 | 4; label: string }> {
    return [
      { num: 1, label: 'Practice Area' },
      { num: 2, label: 'Document Type' },
      { num: 3, label: 'Configure' },
      { num: 4, label: 'Review' }
    ];
  }
}
