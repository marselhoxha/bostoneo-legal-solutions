import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input,
  OnDestroy, OnInit, TemplateRef, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { NgbDropdownModule, NgbModal, NgbNavModule, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { NgApexchartsModule } from 'ng-apexcharts';
import { Subject } from 'rxjs';
import { debounceTime, take, takeUntil } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { environment } from '../../../../../../environments/environment';
import { WebSocketService } from '../../../../../core/services/websocket.service';
import { BackgroundTaskService } from '../../../services/background-task.service';

import { LegalCase } from '../../../interfaces/case.interface';
import { CaseService } from '../../../services/case.service';
import { PIMedicalSummaryService } from '../../ai-assistant/shared/services/pi-medical-summary.service';
import { PIMedicalRecordService, PIScanTrackingRow } from '../../ai-assistant/shared/services/pi-medical-record.service';
import { PIDocumentAnomaly, PIRiskRegister, PIRiskTier, PIRiskFactor } from '../../ai-assistant/shared/services/pi-medical-summary.service';
import { PIMedicalSummary, OpenItem, DiagnosisItem, ChronologyPhase, DemandScenario, FeeMode, TreatmentGap } from '../../ai-assistant/shared/models/pi-medical-summary.model';
import { PIMedicalRecord } from '../../ai-assistant/shared/models/pi-medical-record.model';
import { CaseDocumentsComponent } from '../case-documents/case-documents.component';
import { ProvenanceService, ProvenanceMap } from '../../../services/provenance.service';
import { ProvenanceMarkerComponent } from '../../../../../shared/components/provenance-marker/provenance-marker.component';
import { CaseExpenseService } from '../../../services/case-expense.service';
import { Expense } from '../../../../../interface/expense.interface';
import { CaseTaskService } from '../../../../../service/case-task.service';
import {
  CaseTask,
  TaskCreateRequest,
  TaskType,
  TaskPriority,
  TaskStatus,
} from '../../../../../interface/case-task';
import { AdversePartyService, AdverseParty } from '../../../services/adverse-party.service';
import { PISettlementService, PISettlementEvent } from '../../ai-assistant/shared/services/pi-settlement.service';
import {
  PICommunicationService,
  PICommunication,
  PICommunicationType,
  PICommunicationDirection,
  PICommunicationHealth,
} from '../../ai-assistant/shared/services/pi-communication.service';
import {
  PILienService,
  PILien,
  PILienType,
  PILienStatus,
} from '../../ai-assistant/shared/services/pi-lien.service';
import {
  PIDamageElementService,
  PIDamageElement,
  PIDamageElementType,
  PIConfidenceLevel,
} from '../../ai-assistant/shared/services/pi-damage-element.service';
import {
  PIDocumentRequestService,
  DocumentRequestLog,
} from '../../ai-assistant/shared/services/pi-document-request.service';
import { PIDocumentChecklistService } from '../../ai-assistant/shared/services/pi-document-checklist.service';
import { PIDocumentChecklist } from '../../ai-assistant/shared/models/pi-document-checklist.model';
import { BulkRequestWizardComponent } from '../../ai-assistant/shared/components/bulk-request-wizard/bulk-request-wizard.component';
import { CaseResearchComponent } from '../case-research/case-research.component';
import { UserService } from '../../../../../service/user.service';
import { TeamAssignmentModalComponent } from '../../../../../component/case-task/task-management/components/team-assignment-modal/team-assignment-modal.component';
import { CaseNotesService } from '../../../services/case-notes.service';
import { CaseActivitiesService } from '../../../services/case-activities.service';
import { CaseNote, CreateCaseNoteRequest } from '../../../models/case-note.model';
import { CaseActivity } from '../../../models/case-activity.model';
import { ActivityType } from '../../../interfaces/case.interface';
import { TimeTrackingService, TimeEntry } from '../../../../time-tracking/services/time-tracking.service';
import { TimerService, ActiveTimer } from '../../../../time-tracking/services/timer.service';
import {
  formatOpenItemType,
  getCausationExcerpt as sharedCausationExcerpt,
  getDiagnosesByRegion as sharedDiagnosesByRegion,
  getAdjusterSeverityClass as sharedAdjusterSeverity,
  getAdjusterTypeIcon as sharedAdjusterIcon,
  getOpenItemPriorityClass as sharedOpenItemPriority,
} from '../../ai-assistant/shared/utils/pi-medical-helpers';

interface PipelineStep {
  key: string;
  label: string;
  shortLabel: string;
  index: number;
}

interface SolCountdown {
  totalDays: number;
  label: string;
  severity: 'good' | 'warn' | 'urgent' | 'critical' | 'expired';
  fineText: string;
}

/** P9f — A single lien-holder line item on the closing statement. */
interface ClosingLienItem {
  holder: string;
  type: 'MEDICAL' | 'HEALTH_INS' | 'MEDICARE' | 'MEDICAID' | 'ATTORNEY' | 'OTHER';
  amount: number;
  status: 'OPEN' | 'NEGOTIATING' | 'RESOLVED';
}

/**
 * P9f — Closing-statement form state. Persisted in localStorage keyed by
 * case id until P10's liens tracker + a costs tracker provide canonical
 * sources. `feePercent` defaults to 33.33 (PI pre-suit standard) but is
 * editable so attorneys can set 40% (suit-filed), 25% (referral), etc.
 */
interface ClosingStatementForm {
  feePercent: number;
  costs: number;
  liens: ClosingLienItem[];
  /** Free-form note rendered into the PDF footer. */
  notes: string;
}

type KpiToneClass = '' | 'kpi-danger' | 'kpi-success';

interface HeroKpi {
  label: string;
  value: string;
  hint: string;          // can contain inline span tags for color
  toneClass?: KpiToneClass;
  icon?: string;         // ri-* class for the label glyph
}

interface NextMilestone {
  title: string;
  body: string;
}

type CritPriority = 'HIGH' | 'MEDIUM' | 'LOW';

interface CritAction {
  label: string;
  icon: string;
  key: string;
}

interface CritItem {
  id: string;
  title: string;
  detail: string;
  priority: CritPriority;
  actions?: CritAction[];
}

interface AttorneyChip {
  initials: string;
  fullName: string;
}

/** P13.b — Key Dates panel row. Tone maps to a Bootstrap variant for the icon chip. */
interface KeyDateRow {
  label: string;
  date: string | Date;
  daysUntil: number;
  tone: 'primary' | 'success' | 'info' | 'warning' | 'danger' | 'neutral';
  icon: string;
  isPast: boolean;
}

type PiTabId = 'overview' | 'caseFile' | 'damages' | 'strategy' | 'activity' | 'negotiation';

type PartyAvatarTone = 'pl' | 'def' | 'witness' | 'expert' | 'counsel';
type PartyRoleClass  = 'role-pl' | 'role-def' | 'role-wit' | 'role-exp' | 'role-counsel';

/**
 * Render-shape for a party card in the Case File → Parties section.
 * Top-level `phone`/`email` enable click-to-call / click-to-email handlers
 * without parsing the display rows. When AdverseParty CRUD ships in Batch C
 * the same shape is populated from the API via mapAdversePartyToView().
 */
interface PiPartyView {
  /** Backend party id when sourced from a real AdverseParty; absent for placeholders/mock. */
  id?: number;
  avatarType: PartyAvatarTone;
  initials: string;
  name: string;
  role: string;
  roleClass: PartyRoleClass;
  placeholder?: boolean;
  phone?: string;
  email?: string;
  rows: Array<{ icon: string; iconClass?: string; text?: string; html?: string; link?: string }>;
}

/**
 * Phase 4 of the PI case workflow migration: attorney-facing PI case shell.
 *
 * Layout follows the "command center" pattern:
 *   1. DARK HERO — case identity + 5 inline KPI tiles answering the four signals
 *      attorneys triage on first: where (stage), how soon (SOL), how much (specials,
 *      demand, net), and what's blocking (critical path count).
 *   2. TAB STRIP with elevator-pitch subtitles framing each tab's purpose.
 *   3. OVERVIEW tab is "where am I + what's next" — Case Stage card with auto-derive
 *      next-milestone callout, plus Critical Path blockers, plus Quick Actions and
 *      a Strategy Snapshot in the right rail.
 *
 * Other tabs (Case File / Damages / Strategy / Negotiation) hold placeholders here;
 * P5 wires their content. The shell must look complete on day one — placeholders
 * describe what's coming so the redesign reads as intentional, not unfinished.
 */
@Component({
  selector: 'app-pi-case-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    NgbNavModule,
    NgbDropdownModule,
    NgbTooltipModule,
    NgApexchartsModule,
    CaseDocumentsComponent,
    BulkRequestWizardComponent,
    CaseResearchComponent,
    ProvenanceMarkerComponent,
  ],
  templateUrl: './pi-case-detail.component.html',
  styleUrls: ['./pi-case-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PiCaseDetailComponent implements OnInit, OnDestroy {
  @Input() case: LegalCase | null = null;

  activeTab: PiTabId = 'overview';

  /**
   * P1 / V69 — Per-field provenance map keyed by dotted field path.
   * Loaded from {@code GET /legal-case/{id}/provenance} on case load and
   * passed to every {@code <app-provenance-marker>} via input. Empty map
   * means "no markers known" — markers only render where the backend has
   * stamped a source. Populated by intake / AI / portal / manual writes
   * server-side via {@code ProvenanceService.setProvenance()}.
   */
  caseProvenance: ProvenanceMap = {};

  /**
   * P3 — Case Costs (Damages tab). Expenses logged against this case,
   * fetched once on case load. Drives the Case Costs table between Pain &
   * Suffering and Liens, plus the "Costs & expenses" line on the Net-to-
   * Client breakdown. Empty array is the normal cold-start; the UI shows
   * a "no costs logged" placeholder rather than an error.
   */
  caseExpenses: Expense[] = [];
  /** P3 — Running total of caseExpenses; sourced from the dedicated /total endpoint so empty cases get 0 cleanly. */
  caseExpenseTotal = 0;

  /**
   * P5 — Live Communication Health summary (Activity tab 3-card band).
   * Loaded once on case open via `GET /api/pi/communications/{id}/health`.
   * Empty cases return a zero-valued structure (no nulls), so the
   * activityHealth getter can blend real data + display formatting safely.
   */
  commHealth: PICommunicationHealth | null = null;

  /** PI medical summary — drives Critical Path, Strategy Snapshot, and KPI hints. */
  medicalSummary: PIMedicalSummary | null = null;
  loadingMedicalSummary = false;

  /** Adjuster defense analysis — drives Strategy tab "Defense Vectors" accordion. */
  adjusterAnalysis: any = null;
  loadingAdjusterAnalysis = false;
  /** First two attack vectors expanded by default (matches legacy view's UX). */
  adjusterExpandedItems = new Set<number>([0, 1]);

  /** PI medical records — drives Case File tab "Medical Records" list. */
  medicalRecords: PIMedicalRecord[] = [];
  loadingMedicalRecords = false;
  /** First phase expanded by default in the Treatment Phases accordion. */
  phaseExpandedItems = new Set<number>([0]);

  /**
   * P15.a — Per-document scan tracking. Indexed by `documentId` so the records
   * list can render a status badge per row in O(1). Populated on case-load and
   * refreshed after every scan / retry.
   */
  scanTracking: PIScanTrackingRow[] = [];
  scanTrackingByDocId: Map<number, PIScanTrackingRow> = new Map();
  /** P15.a — True while a single-doc retry is in flight (disables the row's button). */
  retryingDocIds: Set<number> = new Set();

  // ============================================
  // P13b.1 — Scan Documents state
  // ============================================
  /** True while a scan is in flight. Disables Generate Summary + shows progress UI. */
  isScanningDocuments = false;
  /** WebSocket-driven scan progress payload. */
  scanProgress: { current: number; total: number; percentComplete: number; currentFile: string } | null = null;
  /** Final WebSocket payload after scan completes. */
  scanResult: any = null;
  /** Background-task ID so the global task tray reflects the scan. */
  private scanTaskId: string | null = null;
  /** 5-minute safety-timeout handle in case both WebSocket + polling fail. */
  private scanTimeoutId: any = null;
  /** Polling-fallback handle (5s ticks; bails when backend reports no active scan). */
  private scanPollId: any = null;
  /** Snapshot of medicalRecords.length BEFORE the scan starts — used to compute delta. */
  private preScanRecordCount = 0;

  // ============================================
  // P13b.2 — Generate Medical Summary state
  // ============================================
  /** True while AI summary generation is in flight. Blocks the button + shows the Swal loader. */
  isGeneratingSummary = false;
  /**
   * Set true when a scan completes — signals "your summary is now stale, regenerate it."
   * Cleared on successful summary generation.
   */
  summaryStale = false;

  // ============================================
  // P13.c — Case Info collapsible
  // ============================================
  /** Default-collapsed Case Info card on the Overview tab. */
  caseInfoExpanded = false;

  // ============================================
  // P13.d — Onboarding Checklist (intake-stage only)
  // ============================================
  /**
   * Hardcoded onboarding tasks shown only while `stage === INTAKE`. Each item
   * has a derived `isComplete` flag — auto-detected from already-loaded state
   * where possible, manual-checkbox (localStorage) where not. Action navigates
   * to the tab/modal where the user completes the task.
   *
   * Persistence key: `pi.onboarding.${caseId}` — JSON-encoded `string[]` of
   * item IDs the user has manually marked done.
   */
  private onboardingManuallyDone: Set<string> = new Set();

  /** Lazy-load the localStorage manual-done set when the case ID first arrives. */
  private hydrateOnboardingChecklist(caseId: number | string): void {
    try {
      const raw = localStorage.getItem(`pi.onboarding.${caseId}`);
      this.onboardingManuallyDone = new Set(raw ? JSON.parse(raw) : []);
    } catch {
      this.onboardingManuallyDone = new Set();
    }
  }

  /** Persist the manual-done set after a checkbox toggle. */
  private persistOnboardingChecklist(): void {
    if (!this.case?.id) return;
    try {
      localStorage.setItem(
        `pi.onboarding.${this.case.id}`,
        JSON.stringify(Array.from(this.onboardingManuallyDone))
      );
    } catch {
      // Storage full / disabled — ignore.
    }
  }

  /**
   * Whether the onboarding checklist should render. Only meaningful at INTAKE;
   * after the stage advances, attorney's focus shifts to Critical Path.
   * Reads `stageKey` (not `case.stage`) so the preview override correctly
   * hides this card on stages 2–7 even when the real case is at INTAKE.
   */
  get showOnboardingChecklist(): boolean {
    return this.stageKey === 'INTAKE';
  }

  /**
   * The 6 hardcoded onboarding tasks with derived completion state.
   * Auto-detected items: records requested (requestHistory), first call (communications).
   * Manual items: retainer, portal invite, PIP notice, police report — track via localStorage.
   */
  getOnboardingItems(): Array<{
    id: string;
    title: string;
    detail: string;
    icon: string;
    isComplete: boolean;
    autoDetected: boolean;
    onClick: () => void;
  }> {
    const manualDone = (id: string) => this.onboardingManuallyDone.has(id);

    return [
      {
        id: 'retainer',
        title: 'Retainer agreement uploaded',
        detail: 'Signed engagement letter on file in Case File → Documents.',
        icon: 'ri-file-edit-line',
        isComplete: manualDone('retainer'),
        autoDetected: false,
        onClick: () => { this.activeTab = 'caseFile'; },
      },
      {
        id: 'portal-invite',
        title: 'Client portal invite sent',
        detail: 'Client has access to upload documents and check case status.',
        icon: 'ri-mail-send-line',
        isComplete: manualDone('portal-invite'),
        autoDetected: false,
        onClick: () => { /* future: open invite modal */ this.toggleOnboardingItem('portal-invite'); },
      },
      {
        id: 'first-call',
        title: 'First client call logged',
        detail: 'Initial intake call captured in Communications log.',
        icon: 'ri-phone-line',
        isComplete: this.communications.some(c => c.type === 'CALL') || manualDone('first-call'),
        autoDetected: this.communications.some(c => c.type === 'CALL'),
        onClick: () => { this.activeTab = 'negotiation'; },
      },
      {
        id: 'pip-notice',
        title: 'PIP claim notice sent',
        detail: 'Notice of claim filed with the plaintiff PIP carrier.',
        icon: 'ri-shield-cross-line',
        isComplete: manualDone('pip-notice'),
        autoDetected: false,
        onClick: () => { this.toggleOnboardingItem('pip-notice'); },
      },
      {
        id: 'records-requested',
        title: 'Initial records requests sent',
        detail: 'Outbound records requests issued to identified providers.',
        icon: 'ri-folder-received-line',
        isComplete: (this.requestHistory?.length ?? 0) > 0 || manualDone('records-requested'),
        autoDetected: (this.requestHistory?.length ?? 0) > 0,
        onClick: () => { this.activeTab = 'caseFile'; },
      },
      {
        id: 'police-report',
        title: 'Police report obtained',
        detail: 'Police accident report uploaded to the case file.',
        icon: 'ri-shield-line',
        isComplete: manualDone('police-report'),
        autoDetected: false,
        onClick: () => { this.activeTab = 'caseFile'; },
      },
    ];
  }

  /**
   * Toggle a manual-tracked onboarding item and persist. Auto-detected items
   * ignore the toggle entirely — `isComplete` is OR'd against the data signal,
   * so a localStorage flag would be silently overridden. The UI hides the
   * click target on auto-detected items to make this contract clear.
   */
  toggleOnboardingItem(id: string): void {
    const item = this.getOnboardingItems().find(i => i.id === id);
    if (item?.autoDetected) return; // No-op — auto signal wins.

    if (this.onboardingManuallyDone.has(id)) {
      this.onboardingManuallyDone.delete(id);
    } else {
      this.onboardingManuallyDone.add(id);
    }
    this.persistOnboardingChecklist();
    this.cdr.markForCheck();
  }

  /** Number of completed onboarding items (for the progress badge). */
  get onboardingCompleteCount(): number {
    return this.getOnboardingItems().filter(i => i.isComplete).length;
  }

  /**
   * Onboarding ring `stroke-dasharray` — first value is the filled arc length,
   * second is the full circumference. SVG circle radius is 22 in a 50×50 box,
   * so the circumference is 2π·22 ≈ 138.23. The fill is rendered as a fraction
   * of complete/total items.
   */
  getOnboardingDashArray(): string {
    const items = this.getOnboardingItems();
    const total = items.length || 1;
    const done = this.onboardingCompleteCount || 0;
    const circumference = 2 * Math.PI * 22; // ≈ 138.23
    const filled = (circumference * done) / total;
    return `${filled.toFixed(2)} ${circumference.toFixed(2)}`;
  }

  /**
   * Overview stat-strip stage-progress ring (smaller, r=20). Shows what
   * fraction of the 7-step pipeline this case has cleared.
   */
  getStageProgressDashArray(): string {
    const idx = Math.max(0, this.getStageIndex());
    const total = this.STAGE_PIPELINE.length;
    const circumference = 2 * Math.PI * 20; // ≈ 125.66
    const filled = (circumference * idx) / total;
    return `${filled.toFixed(2)} ${circumference.toFixed(2)}`;
  }

  /** Stage progress as an integer percentage (0–100), for the ring center label. */
  getStageProgressPct(): number {
    const idx = Math.max(0, this.getStageIndex());
    const total = this.STAGE_PIPELINE.length;
    return Math.round((idx / total) * 100);
  }

  /** HIGH-priority critical path item count, for the stat-strip chip. */
  getCriticalPathHighCount(): number {
    return this.getCriticalPathItems().filter(i => i.priority === 'HIGH').length;
  }

  /**
   * Stage-aware Focus Card content. Each stage gets its own headline, accent
   * phrase, status pills, primary action, and color tone. Pulled from the
   * mockup-stages.html reference; pills derive from already-loaded case data
   * (onboarding items / critical path / treatment phases / etc.).
   */
  getFocus(): {
    toneClass: string; icon: string;
    title: string; accent?: string; titleTail: string;
    desc: string;
    pills: Array<{ icon: string; label: string; value: string; tone: string }>;
    primaryLabel: string; primaryIcon: string; primaryAction: string;
    secondaryLabel: string; secondaryIcon: string;
  } | null {
    const c = this.case;
    if (!c) return null;

    // Always read from the rendered stage (honours preview override) so the
    // focus card matches whatever stage the rest of the page is showing.
    const stage = this.stageKey;

    switch (stage) {
      case 'INVESTIGATION':
        return {
          toneClass: 'tone-cyan', icon: 'ri-search-eye-line',
          title: 'Lock down ', accent: 'liability & evidence', titleTail: ' before treatment matures.',
          desc: 'Liability accepted by GEICO. <strong>5 of 7 evidence items collected</strong>; 1 witness statement scheduled and accident-reconstruction decision due Jun 25. Vehicle disposal hold expires Jul 1.',
          pills: [
            { icon: 'ri-shield-check-line', label: 'Liability',     value: 'accepted',        tone: 'success' },
            { icon: 'ri-user-voice-line',   label: 'Witness #2',     value: 'scheduled Jun 22', tone: 'warn' },
            { icon: 'ri-microscope-line',   label: 'Expert',         value: 'decision due',     tone: 'warn' },
            { icon: 'ri-file-paper-line',   label: 'Policy limits',  value: 'requested',        tone: '' },
          ],
          primaryLabel: 'Continue investigation', primaryIcon: 'ri-arrow-right-line', primaryAction: 'investigate',
          secondaryLabel: 'Advance to treatment', secondaryIcon: 'ri-skip-forward-line',
        };
      case 'TREATMENT':
        return {
          toneClass: 'tone-amber', icon: 'ri-stethoscope-line',
          title: 'Document the ', accent: 'medical course to MMI', titleTail: '.',
          desc: '3 active providers · 0 treatment gaps · <strong>$42,180</strong> running specials. Orthopedic re-eval on <strong>Jun 18</strong> may declare MMI; PT block re-auth needed by Jun 24.',
          pills: [
            { icon: 'ri-stethoscope-line',         label: 'Active providers', value: '3',           tone: 'success' },
            { icon: 'ri-checkbox-circle-line',     label: 'Gaps > 30d',       value: '0',           tone: 'success' },
            { icon: 'ri-pulse-line',               label: 'MMI window',       value: 'approaching', tone: 'warn' },
            { icon: 'ri-money-dollar-circle-line', label: 'Specials',         value: '$42,180',     tone: '' },
          ],
          primaryLabel: 'Log treatment update', primaryIcon: 'ri-add-line', primaryAction: 'logTx',
          secondaryLabel: 'Advance to pre-demand', secondaryIcon: 'ri-skip-forward-line',
        };
      case 'PRE_DEMAND':
        return {
          toneClass: 'tone-purple', icon: 'ri-mail-send-line',
          title: 'Assemble the ', accent: 'demand package', titleTail: ' for August send.',
          desc: 'MMI declared Jul 14. Final specials locked at <strong>$61,420</strong>. <strong>4 of 8 components complete</strong>; wage-loss verification and demand calculation outstanding. Target send <strong>Aug 1, 2026</strong>.',
          pills: [
            { icon: 'ri-shield-check-line',         label: 'MMI',         value: 'declared', tone: 'success' },
            { icon: 'ri-checkbox-multiple-line',    label: 'Components',  value: '4 of 8',   tone: '' },
            { icon: 'ri-briefcase-line',            label: 'Wage-loss',   value: 'pending',  tone: 'warn' },
            { icon: 'ri-calculator-line',           label: 'Demand calc', value: 'todo',     tone: 'warn' },
          ],
          primaryLabel: 'Generate demand draft', primaryIcon: 'ri-magic-line', primaryAction: 'demand',
          secondaryLabel: 'Send for partner review', secondaryIcon: 'ri-eye-line',
        };
      case 'DEMAND_SENT':
        return {
          toneClass: '', icon: 'ri-send-plane-line',
          title: 'Wait — and ', accent: 'work the adjuster', titleTail: ' until response.',
          desc: 'Demand of <strong>$240,000</strong> delivered Aug 5. <strong>Day 12 of 30</strong>; follow-up scheduled Aug 22. If no response by <strong>Aug 31</strong>, escalate to supervising adjuster.',
          pills: [
            { icon: 'ri-mail-check-line',    label: 'Demand',     value: 'delivered',  tone: '' },
            { icon: 'ri-time-line',          label: 'Day',         value: '12 of 30',   tone: 'warn' },
            { icon: 'ri-calendar-line',      label: 'Follow-up',   value: 'Aug 22',     tone: '' },
            { icon: 'ri-alarm-warning-line', label: 'Escalation',  value: 'Sep 5',      tone: 'danger' },
          ],
          primaryLabel: 'Send follow-up', primaryIcon: 'ri-mail-send-line', primaryAction: 'logOffer',
          secondaryLabel: 'Log offer received', secondaryIcon: 'ri-mail-line',
        };
      case 'NEGOTIATION':
        return {
          toneClass: 'tone-teal', icon: 'ri-arrow-left-right-line',
          title: 'Bridge the ', accent: '$55,000 gap', titleTail: '.',
          desc: 'Latest counter from GEICO is <strong>$145,000</strong> against demand of $240,000. Client authorized to settle at <strong>$185,000</strong>. Mediation slot available Nov 4 if direct negotiation stalls.',
          pills: [
            { icon: 'ri-arrow-right-line', label: 'Current offer', value: '$145k',  tone: 'warn' },
            { icon: 'ri-user-line',        label: 'Authority',     value: '$185k',  tone: 'success' },
            { icon: 'ri-group-line',       label: 'Mediation',     value: 'Nov 4',  tone: '' },
            { icon: 'ri-court-line',       label: 'Suit deadline', value: 'Dec 1',  tone: '' },
          ],
          primaryLabel: 'Send counter $200k', primaryIcon: 'ri-mail-send-line', primaryAction: 'counter',
          secondaryLabel: 'Schedule mediation', secondaryIcon: 'ri-group-line',
        };
      case 'SETTLED':
        return {
          toneClass: 'tone-success', icon: 'ri-checkbox-circle-line',
          title: 'Release ', accent: '$108,420 to client', titleTail: ' and close out.',
          desc: 'Settlement of <strong>$185,000</strong> reached Feb 5; check received Feb 18 and deposited to IOLTA. Liens negotiated; <strong>4 closing tasks remain</strong>. Target archive Feb 24.',
          pills: [
            { icon: 'ri-bank-line',                label: 'Check',          value: 'received',     tone: 'success' },
            { icon: 'ri-money-dollar-circle-line', label: 'Liens',          value: '0 of 3 paid',  tone: 'warn' },
            { icon: 'ri-user-line',                label: 'Disbursement',   value: 'pending',      tone: 'warn' },
            { icon: 'ri-archive-line',             label: 'Archive',        value: 'Feb 24',       tone: '' },
          ],
          primaryLabel: 'Issue disbursement', primaryIcon: 'ri-bank-line', primaryAction: 'disburse',
          secondaryLabel: 'Send closing letter', secondaryIcon: 'ri-mail-send-line',
        };
      case 'INTAKE':
      default:
        return {
          toneClass: '', icon: 'ri-focus-3-line',
          title: 'Complete ', accent: 'intake essentials', titleTail: ' to unlock investigation.',
          desc: '5 of 6 onboarding items remain. Confirm client identity, mechanism of injury, ER on DOL, and police report. Target completion by <strong>May 14, 2026</strong> to keep the demand on track for August.',
          pills: [
            { icon: 'ri-shield-line',      label: 'Insurance carrier',  value: 'open',          tone: 'warn' },
            { icon: 'ri-police-car-line',  label: 'Police report',       value: 'not requested', tone: 'warn' },
            { icon: 'ri-stethoscope-line', label: 'Treatment provider',  value: 'missing',       tone: 'warn' },
          ],
          primaryLabel: 'Continue intake', primaryIcon: 'ri-arrow-right-line', primaryAction: 'continueIntake',
          secondaryLabel: 'Override & advance stage', secondaryIcon: 'ri-skip-forward-line',
        };
    }
  }

  /** Routes the focus-card primary CTA based on the action slug. */
  onFocusPrimary(fx: { primaryAction: string }): void {
    switch (fx.primaryAction) {
      case 'demand':         this.openLegiDraft('demand_letter'); break;
      case 'logTx':          this.activeTab = 'caseFile'; break;
      case 'logOffer':       this.quickAction('logOffer'); break;
      case 'counter':        this.openLegiDraft('demand_letter'); break;
      case 'disburse':       this.openFinalDispositionModal(); break; // P1.5 — was activeTab='negotiation'; closing statement form now lives in Overview Stage 7 card
      case 'continueIntake':
      case 'investigate':
      default:               this.activeTab = 'caseFile'; break;
    }
  }

  // ============================================
  // P13b.3 — Treatment Gap Detection
  // ============================================
  /** AI-detected treatment gaps (intervals > 30 days between visits). */
  treatmentGaps: TreatmentGap[] = [];
  /** True while the gap analysis API is in flight. */
  isAnalyzingGaps = false;
  /** Track whether we've ever loaded gaps for this case (so we can hide the empty state until first run). */
  treatmentGapsLoaded = false;

  /**
   * P5.4 — Demand calculator scenario state. Loaded from the medical summary's
   * demandScenario JSONB on mount; saved back via debounced PUT on every input
   * change. Defaults match the P&S norms used in the hero KPI estimate so the
   * dashboard doesn't shift when the calculator is first opened.
   */
  damageScenario: DemandScenario = this.defaultDamageScenario();
  damageSaving = false;
  damageSavedAt: string | null = null;
  /** Debounce sink — emits whenever an input changes; fires save 600ms after the last keystroke. */
  private damageInputs$ = new Subject<void>();

  /** P5.5 — Settlement events drive the Negotiation tab timeline. */
  settlementEvents: PISettlementEvent[] = [];
  loadingSettlementEvents = false;

  /**
   * P9e — Communications Log entries (calls / emails / letters / meetings)
   * shown on the Negotiation tab as a separate timeline from settlement
   * events. `commTypeFilter` is a client-side facet — null means "all".
   */
  communications: PICommunication[] = [];
  loadingCommunications = false;
  commTypeFilter: PICommunicationType | null = null;
  /** Form-state for the inline "log communication" modal (created in P9e.6). */
  newCommunication: PICommunication = this.blankCommunication();
  commSaving = false;

  /**
   * P10.c — Liens & Subrogation tracker. Surfaced on the Damages tab and
   * read by the closing-statement generator (P9f) for net-to-client.
   */
  liens: PILien[] = [];
  liensEffectiveTotal = 0;
  loadingLiens = false;
  /** Modal form state (templated edit for both add + edit, distinguished by `id`). */
  lienForm: PILien = this.blankLien();
  lienSaving = false;
  @ViewChild('lienModal') lienModalTpl!: TemplateRef<any>;

  /**
   * P10.d — Damage Elements. Persistent line-items by category that build
   * the structured damages model (consumed by the demand letter prompt + the
   * comparable-analysis AI flow). Backend lives at
   * `/api/pi/cases/{id}/damages/elements/*` (PIDamageCalculationController).
   */
  damageElements: PIDamageElement[] = [];
  loadingDamageElements = false;
  damageElementForm: PIDamageElement = this.blankDamageElement();
  damageElementSaving = false;
  damageElementSyncing = false;
  @ViewChild('damageElementModal') damageElementModalTpl!: TemplateRef<any>;

  /**
   * P11.a — Cross-document anomalies. Pure rules-based detection (no AI),
   * cheap to refresh on each case open. Surfaces in Strategy tab.
   */
  documentAnomalies: PIDocumentAnomaly[] = [];
  loadingAnomalies = false;

  /**
   * P12.a — Chronology table sort state. Defaults to newest-first (matches
   * how attorneys typically scan a case — most recent treatment to oldest).
   */
  chronologySortKey: 'date' | 'provider' | 'type' | 'charges' = 'date';
  chronologySortDir: 'asc' | 'desc' = 'desc';

  /**
   * P12.c — Records Requests state. We track three streams in parallel:
   *   - `requestHistory`: outbound requests already sent (read-only audit log)
   *   - `documentChecklist`: AI-generated to-do list of documents to chase
   *   - `selectedChecklistIds`: items the attorney ticked for bulk send
   *
   * Bulk-send launches the existing `BulkRequestWizardComponent` in a modal,
   * which handles preview + recipient resolution + dispatch.
   */
  requestHistory: DocumentRequestLog[] = [];
  documentChecklist: PIDocumentChecklist[] = [];
  selectedChecklistIds: Set<number> = new Set();
  loadingRequestHistory = false;
  loadingChecklist = false;
  bulkWizardOpen = false;
  @ViewChild('bulkRequestModal') bulkRequestModalTpl!: TemplateRef<any>;

  /**
   * P11.d — AI-generated risk register (3 tiers). Loaded as saved-state on
   * case open; generation is on-demand via the "Generate / Refresh" button.
   */
  riskRegister: PIRiskRegister | null = null;
  loadingRiskRegister = false;
  generatingRiskRegister = false;

  /**
   * P9c — Settlement Tracker chart options. Stays null until we have at least
   * one event with a non-zero amount; the template is gated on this so the
   * chart container collapses gracefully on quiet cases.
   */
  settlementChartOptions: any | null = null;

  /**
   * Demand letter + Strategy brief drafting both happen in LegiDraft (the AI
   * Workspace's drafting feature) — not in inline modals here. The Negotiation
   * tab cards just route attorneys to /legal/ai-assistant and let LegiDraft
   * handle prompt-building, generation, preview, and saving. We kept the
   * "Mark Demand Sent" settlement-event flow on the demand-letter card so
   * attorneys can record the send-event without re-opening LegiDraft.
   */

  /** P8 — inline modal templates for Case Settings + AI Settings. */
  @ViewChild('caseSettingsModal') caseSettingsModalTpl!: TemplateRef<any>;
  @ViewChild('aiSettingsModal') aiSettingsModalTpl!: TemplateRef<any>;
  @ViewChild('activityLogModal') activityLogModalTpl!: TemplateRef<any>;
  /** P13b.5 — Legal Research modal hosting the case-scoped <app-case-research> component. */
  @ViewChild('legalResearchModal') legalResearchModalTpl!: TemplateRef<any>;
  /** Working copy of editable case fields, hydrated when Case Settings opens.
   *  Note: `feeStructure` + `hourlyRate` arrive in P14 (V65 entity expansion);
   *  for P8 the modal only persists status. */
  caseSettingsDraft: { feeStructure: string; hourlyRate: number | null; status: string } = {
    feeStructure: 'PRE_SUIT_33',
    hourlyRate: null,
    status: 'ACTIVE',
  };
  caseSettingsSaving = false;

  /** Batch C — Adverse parties (plaintiff / defendant / witness / expert /
   *  counsel) loaded from the backend. liveParties=null = not loaded yet OR
   *  failure; the parties section falls back to the mock array so the page
   *  is never blank. liveParties=[] = loaded but empty (real "no parties yet"). */
  @ViewChild('partyFormModal') partyFormModalTpl!: TemplateRef<any>;
  liveParties: AdverseParty[] | null = null;
  loadingParties = false;
  partyDraft: AdverseParty = {
    name: '',
    partyType: 'WITNESS',
    email: '',
    phone: '',
    address: '',
    notes: '',
  };
  /** When set, the modal is in "edit" mode and submits via PUT. */
  editingPartyId: number | null = null;
  partySaving = false;
  readonly partyTypeOptions: Array<{ value: string; label: string; tone: PartyAvatarTone }> = [
    { value: 'PLAINTIFF',          label: 'Plaintiff',           tone: 'pl' },
    { value: 'DEFENDANT',          label: 'Defendant',           tone: 'def' },
    { value: 'WITNESS',            label: 'Witness',             tone: 'witness' },
    { value: 'EXPERT',             label: 'Expert',              tone: 'expert' },
    { value: 'OPPOSING_COUNSEL',   label: 'Opposing counsel',    tone: 'counsel' },
    { value: 'INSURANCE_ADJUSTER', label: 'Insurance adjuster',  tone: 'def' },
    { value: 'OTHER',              label: 'Other',               tone: 'witness' },
  ];

  /** Batch B — Add Task modal + live case-task list.
   *  Live tasks load via CaseTaskService.getTasksByCaseId() and replace the
   *  mock investigation list when present. Empty list = mock fallback so the
   *  Overview card stays useful even on cases without tasks yet. */
  @ViewChild('addTaskModal') addTaskModalTpl!: TemplateRef<any>;
  /** ViewChild on the existing Log Communication template ref (the chat-icon
   *  on a party card already passes this template ref via local variable, but
   *  Batch D handlers like logCall need to open it programmatically). */
  @ViewChild('logCommModal') logCommModalTpl!: TemplateRef<any>;
  liveCaseTasks: CaseTask[] | null = null;
  loadingCaseTasks = false;
  addTaskDraft: {
    title: string;
    description: string;
    taskType: TaskType;
    priority: TaskPriority;
    dueDate: string;
    estimatedHours: number | null;
  } = {
    title: '',
    description: '',
    taskType: TaskType.RESEARCH,
    priority: TaskPriority.MEDIUM,
    dueDate: '',
    estimatedHours: null,
  };
  addTaskSaving = false;
  /** Surfaced in the Add Task modal selects so we don't string-literal the enums. */
  readonly taskTypeOptions: Array<{ value: TaskType; label: string }> = [
    { value: TaskType.RESEARCH,         label: 'Research' },
    { value: TaskType.REVIEW,           label: 'Review' },
    { value: TaskType.DOCUMENT_PREP,    label: 'Document prep' },
    { value: TaskType.CLIENT_MEETING,   label: 'Client meeting' },
    { value: TaskType.COURT_APPEARANCE, label: 'Court appearance' },
    { value: TaskType.FILING,           label: 'Filing' },
    { value: TaskType.CORRESPONDENCE,   label: 'Correspondence' },
    { value: TaskType.OTHER,            label: 'Other' },
  ];
  readonly taskPriorityOptions: Array<{ value: TaskPriority; label: string }> = [
    { value: TaskPriority.LOW,    label: 'Low' },
    { value: TaskPriority.MEDIUM, label: 'Medium' },
    { value: TaskPriority.HIGH,   label: 'High' },
    { value: TaskPriority.URGENT, label: 'Urgent' },
  ];

  /** Batch A.3 — Edit Incident modal. Patches injuryDate / injuryType /
   *  injuryDescription / accidentLocation / comparativeNegligencePercent on
   *  legal_cases via the existing PATCH endpoint. */
  @ViewChild('editIncidentModal') editIncidentModalTpl!: TemplateRef<any>;
  editIncidentDraft: {
    injuryDate: string;
    injuryType: string;
    accidentLocation: string;
    injuryDescription: string;
    comparativeNegligencePercent: number | null;
  } = {
    injuryDate: '',
    injuryType: '',
    accidentLocation: '',
    injuryDescription: '',
    comparativeNegligencePercent: null,
  };
  editIncidentSaving = false;

  /**
   * P9a — Billing & Time Entries (Negotiation tab section).
   * Reads via TimeTrackingService case-scoped endpoints; the timer banner is
   * driven by TimerService.activeTimers$ so it ticks live without us polling.
   */
  caseTimeEntries: TimeEntry[] = [];
  loadingTimeEntries = false;
  caseTimeSummary: { totalHours: number; billableHours: number; totalAmount: number; pendingCount: number; entryCount: number } | null = null;
  /** Currently-running timer for THIS case (if any) — pulled from TimerService.activeTimers$. */
  activeCaseTimer: ActiveTimer | null = null;
  /** Live-updated formatted duration shown in the timer banner; refreshed by the timer subscription. */
  activeCaseTimerDuration = '00:00:00';
  /** Hourly rate hint for the log-time modal — derived from the current user's billing rate when available. */
  defaultBillingRate = 250;
  /** Quick-add form state for the log-time modal. */
  logTimeForm: { date: string; hours: number; description: string; billable: boolean; rate: number } = {
    date: new Date().toISOString().split('T')[0],
    hours: 0.25,
    description: '',
    billable: true,
    rate: this.defaultBillingRate,
  };
  submittingTimeEntry = false;
  startingTimer = false;
  @ViewChild('logTimeModal') logTimeModalTpl!: TemplateRef<any>;

  /**
   * P9b — Final Disposition. Captures the closing terms once a case settles:
   * settlement amount + date land on legal_cases directly; the case is also
   * flipped to stage=SETTLED (manual override) and status=CLOSED. The notes
   * field becomes a quick attorney memo recorded as a case note so the back
   * story (e.g. "release signed pending insurer wire") survives. The closing
   * statement (P9f) reads from these values.
   */
  @ViewChild('finalDispositionModal') finalDispositionModalTpl!: TemplateRef<any>;
  dispositionForm: { finalAmount: number | null; settlementDate: string; notes: string } = {
    finalAmount: null,
    settlementDate: new Date().toISOString().split('T')[0],
    notes: '',
  };
  submittingDisposition = false;

  /**
   * P9f — Closing Statement breakdown. Only meaningful when stage = SETTLED.
   *
   * Persistence is intentionally localStorage rather than a DB column for
   * v1: the closing statement is mostly derived (gross from
   * settlementFinalAmount, fee from feeStructure when P15 lands), with
   * costs + liens as the only attorney-input pieces. localStorage keyed
   * by case id keeps draft entries across reload until P10's liens
   * tracker / a costs tracker land — at which point closingStatement reads
   * from those tables directly and the localStorage fallback can be retired.
   */
  closingStatement: ClosingStatementForm = this.defaultClosingStatement();
  closingPdfGenerating = false;
  @ViewChild('closingStatementPdfRoot') closingPdfRoot?: ElementRef<HTMLElement>;

  /** P6 — Activity feed (cross-feature: case events, document uploads, notes, settlements). */
  recentActivities: CaseActivity[] = [];
  // Full unsliced list — surfaced in the ⋮ More → Audit Log modal so attorneys
  // can scroll the complete activity history beyond the Overview feed's cap.
  allActivities: CaseActivity[] = [];
  loadingActivities = false;
  /** Cap on Overview's compact feed; "View all" link routes to legacy view for full history. */
  readonly ACTIVITY_FEED_CAP = 8;

  /** P6 — Case notes (internal-only or client-shared). */
  caseNotes: CaseNote[] = [];
  loadingNotes = false;
  /** Quick-add form state. */
  showAddNoteForm = false;
  newNote: { title: string; content: string; isPrivate: boolean } = { title: '', content: '', isPrivate: true };
  savingNote = false;

  /**
   * Mirrors `enumeration/CaseStage.java` exactly so the visualizer agrees with
   * what V61's backfill / P2's CaseStageService produced.
   */
  readonly STAGE_PIPELINE: PipelineStep[] = [
    { key: 'INTAKE',         label: 'Intake',         shortLabel: 'Intake',       index: 0 },
    { key: 'INVESTIGATION',  label: 'Investigation',  shortLabel: 'Investigation', index: 1 },
    { key: 'TREATMENT',      label: 'Treatment',      shortLabel: 'Treatment',    index: 2 },
    { key: 'PRE_DEMAND',     label: 'Pre-Demand',     shortLabel: 'Pre-Demand',   index: 3 },
    { key: 'DEMAND_SENT',    label: 'Demand Sent',    shortLabel: 'Demand Sent',  index: 4 },
    { key: 'NEGOTIATION',    label: 'Negotiation',    shortLabel: 'Negotiation',  index: 5 },
    { key: 'SETTLED',        label: 'Settled',        shortLabel: 'Settled',      index: 6 },
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private caseService: CaseService,
    private medicalSummaryService: PIMedicalSummaryService,
    private medicalRecordService: PIMedicalRecordService,
    private settlementService: PISettlementService,
    private communicationService: PICommunicationService,
    private lienService: PILienService,
    private damageElementService: PIDamageElementService,
    private documentRequestService: PIDocumentRequestService,
    private documentChecklistService: PIDocumentChecklistService,
    private userService: UserService,
    private notesService: CaseNotesService,
    private activitiesService: CaseActivitiesService,
    private timeTrackingService: TimeTrackingService,
    private timerService: TimerService,
    private modalService: NgbModal,
    private webSocketService: WebSocketService,
    private backgroundTaskService: BackgroundTaskService,
    private provenanceService: ProvenanceService,
    private caseExpenseService: CaseExpenseService,
    private caseTaskService: CaseTaskService,
    private adversePartyService: AdversePartyService,
    private cdr: ChangeDetectorRef,
  ) {}

  /**
   * Reactive mirror of the `?previewStage=` query param. Updated via the
   * subscription wired in ngOnInit so a click on a switcher pill (which
   * navigates the same component with new query params) triggers change
   * detection. Reading `route.snapshot.queryParamMap` from a getter is
   * unreliable on query-only navigations — the snapshot doesn't always
   * refresh in time. Storing on `this` and subscribing fixes that.
   */
  previewStageOverride: string | null = null;

  ngOnInit(): void {
    // Wire debounced auto-save for the demand calculator. Subscribed once on init
    // so input changes coalesce into a single PUT.
    this.damageInputs$
      .pipe(debounceTime(600), takeUntil(this.destroy$))
      .subscribe(() => this.saveDamageScenario());

    // Track ?previewStage= query param so the stage switcher updates layout
    // immediately. Pure UI override — never mutates real case data.
    if (!environment.production) {
      this.route.queryParamMap
        .pipe(takeUntil(this.destroy$))
        .subscribe(map => {
          const v = map.get('previewStage');
          this.previewStageOverride = v ? v.toUpperCase() : null;
          this.cdr.detectChanges();
        });
    }

    // P13b.1 — Subscribe to medical scan progress + completion events. The backend
    // emits MEDICAL_SCAN_PROGRESS while documents are being analyzed and
    // MEDICAL_SCAN_COMPLETE when the worker finishes. Filtered to this case so a
    // scan running on a different case in another tab doesn't update our UI.
    this.webSocketService.getMessages().pipe(
      takeUntil(this.destroy$)
    ).subscribe((msg: any) => {
      const payload = msg?.data;
      if (!payload) return;
      const scanType = payload.type || msg?.type;
      if (scanType !== 'MEDICAL_SCAN_PROGRESS' && scanType !== 'MEDICAL_SCAN_COMPLETE') return;

      const msgCaseId = payload.caseId || msg?.caseId;
      if (msgCaseId && this.case?.id && msgCaseId !== Number(this.case.id)) return;

      if (scanType === 'MEDICAL_SCAN_PROGRESS' && this.isScanningDocuments) {
        this.scanProgress = {
          current: payload.current,
          total: payload.total,
          percentComplete: payload.percentComplete,
          currentFile: payload.currentFile,
        };
        if (this.scanTaskId) {
          this.backgroundTaskService.updateTaskProgress(
            this.scanTaskId, payload.percentComplete, `Scanning: ${payload.currentFile}`
          );
        }
        this.cdr.detectChanges();
        return;
      }

      if (scanType === 'MEDICAL_SCAN_COMPLETE' && this.isScanningDocuments) {
        if (payload.success === false) {
          if (this.scanTaskId) {
            this.backgroundTaskService.failTask(this.scanTaskId, payload.message || 'Scan failed');
          }
          this.completeScanCleanup();
          Swal.fire({
            icon: 'error',
            title: 'Scan Failed',
            text: payload.message || 'Document scan failed. Please try again.',
            confirmButtonText: 'OK',
          });
          this.cdr.detectChanges();
          return;
        }
        if (this.scanTaskId) {
          this.handleScanComplete(this.scanTaskId, payload);
        } else {
          this.completeScanCleanup();
          if (this.case?.id) this.loadMedicalRecords(Number(this.case.id));
          this.cdr.detectChanges();
        }
      }
    });

    if (this.case?.id) {
      // Parent component handed us a case — load the summary right away.
      this.loadMedicalSummary(this.case.id);
      return;
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.caseService.getCaseById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.case = response?.data?.case ?? response?.data ?? response;
          this.cdr.markForCheck();
          if (this.case?.id) this.loadMedicalSummary(this.case.id);
        },
        error: (err) => console.error('Failed to load case for PI shell', err)
      });
  }

  /**
   * Fetch the PI medical summary so Overview's Critical Path, Strategy Snapshot,
   * and several KPI hints have real data to render. If the summary doesn't exist
   * yet (case has no records / hasn't been generated), we leave `medicalSummary`
   * null and the UI shows its empty states.
   */
  private loadMedicalSummary(caseId: string | number): void {
    const numericId = typeof caseId === 'string' ? Number(caseId) : caseId;
    if (!Number.isFinite(numericId)) return;

    // P13b — reset transient AI-flow state when switching cases (or initial load).
    // Class-field initializers only run once per instance; if a parent reuses this
    // component across cases, treatmentGapsLoaded/summaryStale would leak from
    // case A into case B until the next user action.
    this.treatmentGaps = [];
    this.treatmentGapsLoaded = false;
    this.summaryStale = false;

    // P13.d — Pull the per-case onboarding-checkbox state from localStorage.
    this.hydrateOnboardingChecklist(numericId);
    // Don't reset isScanningDocuments / isGeneratingSummary / isAnalyzingGaps —
    // an in-flight operation against case A should keep its state until it
    // completes; switching cases mid-operation is rare and we'd rather show
    // a stuck spinner the user can investigate than silently drop the work.

    this.loadingMedicalSummary = true;
    this.medicalSummaryService.getMedicalSummary(numericId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ summary }) => {
          this.medicalSummary = summary ?? null;
          this.hydrateDamageScenarioFromSummary();
          this.loadingMedicalSummary = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          // Non-fatal — page still renders with empty states.
          console.warn('Failed to load PI medical summary', err);
          this.medicalSummary = null;
          this.loadingMedicalSummary = false;
          this.cdr.markForCheck();
        }
      });

    // Adjuster analysis fires in parallel — independent of summary; can be empty
    // for cases that haven't generated one yet.
    this.loadAdjusterAnalysis(numericId);

    // Medical records also fire in parallel — Case File tab consumes them.
    this.loadMedicalRecords(numericId);

    // P15.a — Per-document scan tracking for status badges + failed retry queue.
    this.loadScanTracking(numericId);

    // Settlement events power the Negotiation timeline.
    this.loadSettlementEvents(numericId);

    // P9e — Communications log (calls / emails / letters / meetings).
    this.loadCommunications(numericId);

    // P10.c — Liens & subrogation tracker (Damages tab).
    this.loadLiens(numericId);

    // P10.d — Persistent damage elements by category (Damages tab).
    this.loadDamageElements(numericId);

    // P11.a — Cross-document anomalies (Strategy tab).
    this.loadDocumentAnomalies(numericId);

    // P11.d — Risk register (Strategy tab) — load saved-state only; generation is on-demand.
    this.loadRiskRegister(numericId);

    // P12.c — Records request history + checklist (Case File tab).
    this.loadRequestHistory(numericId);
    this.loadDocumentChecklist(numericId);

    // P6 — Activity feed + notes for Overview's bottom row.
    this.loadActivities(numericId);
    this.loadNotes(numericId);

    // P9a — Billing & Time on the Negotiation tab.
    this.loadCaseTimeData(numericId);

    // P9f — Closing statement draft (localStorage only — no server round-trip).
    this.loadClosingStatementDraft(numericId);

    // P1 / V69 — Field provenance map; powers the i/c/A/m markers next to
    // facts on Overview / Case File / Damages / Strategy. Failure is
    // non-fatal: the map stays empty and markers don't render.
    this.loadProvenance(numericId);

    // P3 — Case Costs (Damages tab). Loaded once on case load; the table +
    // total are independently observable via the service after add/edit/
    // delete actions reroute through the existing /expenses pages.
    this.loadCaseExpenses(numericId);

    // P5 — Communication Health (Activity tab 3-card band). Server-derived
    // from the case's tenant-filtered communication timeline. Failure leaves
    // commHealth=null and the activityHealth getter falls back to mock
    // display strings, so the UI never shows a broken card.
    this.loadCommunicationHealth(numericId);

    // Batch B — live case tasks for the Open Investigation Tasks card.
    // Empty list keeps the mock fallback visible so an unfamiliar attorney
    // can still see what the section is for.
    this.loadCaseTasks(numericId);

    // Batch C — load adverse parties (plaintiff / defendant / witnesses / etc.)
    // for the Case File → Parties section. Empty list = render real "no parties
    // yet" empty card; HTTP failure falls back to the demo mock for context.
    this.loadParties(numericId);
  }

  /**
   * Loads the Communication Health summary that powers the Activity-tab
   * 3-card band. Cheap to refetch since the backend derives in-memory; we
   * could re-fire after every comm log/edit if needed (deferred until UX
   * feedback says stale numbers are a problem).
   */
  private loadCommunicationHealth(caseId: number): void {
    this.communicationService.getHealth(caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (health) => {
          this.commHealth = health ?? null;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('Failed to load communication health', err);
          this.commHealth = null;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Loads expenses + total in parallel and stashes them on the component.
   * Fired on case load and after any expense mutation that needs the table
   * to refresh (e.g., return from /expenses/edit/:id with caseId param).
   * Errors are non-fatal: empty list + zero total render as a "no costs"
   * empty state rather than blocking the page.
   */
  private loadCaseExpenses(caseId: number): void {
    this.caseExpenseService.getCaseExpenses(caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (rows) => {
          this.caseExpenses = rows ?? [];
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('Failed to load case expenses', err);
          this.caseExpenses = [];
          this.cdr.markForCheck();
        }
      });
    this.caseExpenseService.getCaseExpenseTotal(caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (total) => {
          this.caseExpenseTotal = Number.isFinite(total) ? total : 0;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('Failed to load case expense total', err);
          this.caseExpenseTotal = 0;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * P3 — Maps an ExpenseCategory.name (free-text) to a CSS modifier on
   * .cat-tag (deterministic, no DB-driven color so categories renamed via
   * the admin UI don't break styling). The mapping covers the common PI
   * categories; anything else falls back to "other".
   */
  caseCostCategoryClass(name: string | undefined | null): string {
    if (!name) return 'other';
    const n = name.toLowerCase();
    if (n.includes('filing'))     return 'filing';
    if (n.includes('record'))     return 'records';
    if (n.includes('expert'))     return 'expert';
    if (n.includes('deposition')) return 'deposition';
    if (n.includes('travel'))     return 'travel';
    if (n.includes('postage') || n.includes('courier')) return 'postage';
    if (n.includes('copy') || n.includes('print'))      return 'copy';
    return 'other';
  }

  /**
   * Routes to the existing /expenses/new page with this case pre-selected
   * via query param. The expense-form module accepts `?legalCaseId=` so the
   * dropdown lands pre-filled. Returning to the case page is the user's
   * job; we'll add a true inline modal in a follow-up ticket once the
   * existing form is refactored to support both routed + modal usage.
   */
  openAddCaseExpense(): void {
    if (!this.case?.id) return;
    this.router.navigate(['/expenses/new'], { queryParams: { legalCaseId: this.case.id } });
  }

  /** Routes to /expenses/edit/:id with the same pre-fill convention. */
  openEditCaseExpense(expense: Expense): void {
    if (!expense?.id) return;
    this.router.navigate(['/expenses/edit', expense.id]);
  }

  /**
   * Fetches the per-field provenance map from
   * {@code GET /legal-case/{id}/provenance} and stashes it on
   * {@code caseProvenance} for the marker components to read. Errors are
   * logged but never block the rest of the page — provenance is a UX
   * affordance, not load-bearing data.
   */
  private loadProvenance(caseId: number): void {
    this.provenanceService.getProvenance(caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (map) => {
          this.caseProvenance = map ?? {};
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('Failed to load case provenance', err);
          this.caseProvenance = {};
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Load the cross-feature case activity feed (case events, document uploads,
   * note adds, settlement events). Sliced to ACTIVITY_FEED_CAP for the Overview
   * compact display; "View all" link surfaces full history in the legacy view.
   */
  private loadActivities(caseId: number): void {
    this.loadingActivities = true;
    this.activitiesService.getActivitiesByCaseId(caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (activities: CaseActivity[]) => {
          const list = activities ?? [];
          this.allActivities = list;
          this.recentActivities = list.slice(0, this.ACTIVITY_FEED_CAP);
          this.loadingActivities = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('Failed to load case activities', err);
          this.allActivities = [];
          this.recentActivities = [];
          this.loadingActivities = false;
          this.cdr.markForCheck();
        }
      });
  }

  /** Load the case notes list. */
  private loadNotes(caseId: number | string): void {
    this.loadingNotes = true;
    this.notesService.getNotesByCaseId(caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          const notes = response?.data?.notes ?? (Array.isArray(response) ? response : []);
          this.caseNotes = notes;
          this.loadingNotes = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('Failed to load case notes', err);
          this.caseNotes = [];
          this.loadingNotes = false;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Re-fetch the case after an action that may have advanced its stage server-side
   * (e.g., logging a settlement event triggers CaseStageService → DEMAND_SENT).
   * Updates the local `case` so the hero pill, KPI strip, and pipeline visualizer
   * reflect the new state without a manual reload.
   */
  private refreshCase(caseId: string | number): void {
    this.caseService.getCaseById(String(caseId))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          const updated = response?.data?.case ?? response?.data ?? response;
          if (updated) {
            this.case = updated;
            this.cdr.markForCheck();
          }
        },
        error: (err) => console.warn('Failed to refresh case after settlement event', err),
      });
  }

  /**
   * Load PI settlement events for the case. Each event carries demandAmount /
   * offerAmount / counterAmount fields — the Negotiation timeline infers the
   * event "kind" from which fields are populated.
   */
  private loadSettlementEvents(caseId: number): void {
    this.loadingSettlementEvents = true;
    this.settlementService.getEvents(caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (events: PISettlementEvent[]) => {
          this.settlementEvents = events ?? [];
          this.loadingSettlementEvents = false;
          this.buildSettlementChartOptions();
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('Failed to load settlement events', err);
          this.settlementEvents = [];
          this.loadingSettlementEvents = false;
          this.settlementChartOptions = null;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * P9c — Build the ApexCharts options for the settlement tracker. Three
   * dotted lines on the same time axis: Demand (primary blue), Offer
   * (success green), Counter (warning amber). When the case is settled,
   * we append a "Final" datapoint so the chart visually closes out the arc.
   *
   * Only builds when there's at least one event-with-amount or a final
   * disposition; nulls out the options otherwise so the template hides
   * the chart container.
   */
  private buildSettlementChartOptions(): void {
    const events = (this.settlementEvents || []).slice().sort((a, b) => {
      const ad = new Date(a.eventDate || a.createdAt || 0).getTime();
      const bd = new Date(b.eventDate || b.createdAt || 0).getTime();
      return ad - bd;
    });

    const demandPoints: { x: number; y: number }[] = [];
    const offerPoints: { x: number; y: number }[] = [];
    const counterPoints: { x: number; y: number }[] = [];

    events.forEach(e => {
      const eventDateMs = new Date(e.eventDate || e.createdAt || 0).getTime();
      if (!Number.isFinite(eventDateMs)) return;
      if (e.demandAmount && Number(e.demandAmount) > 0) {
        demandPoints.push({ x: eventDateMs, y: Number(e.demandAmount) });
      }
      if (e.offerAmount && Number(e.offerAmount) > 0) {
        const offerDateMs = e.offerDate ? new Date(e.offerDate).getTime() : eventDateMs;
        offerPoints.push({ x: Number.isFinite(offerDateMs) ? offerDateMs : eventDateMs, y: Number(e.offerAmount) });
      }
      if (e.counterAmount && Number(e.counterAmount) > 0) {
        counterPoints.push({ x: eventDateMs, y: Number(e.counterAmount) });
      }
    });

    // Append the final disposition as a "Final" point — visually closes the arc
    // and provides a target marker that future offers/counters chase.
    const finalPoints: { x: number; y: number }[] = [];
    if (this.isSettled && this.case?.settlementFinalAmount && this.case?.settlementDate) {
      const finalDateMs = new Date(this.case.settlementDate as any).getTime();
      if (Number.isFinite(finalDateMs)) {
        finalPoints.push({ x: finalDateMs, y: Number(this.case.settlementFinalAmount) });
      }
    }

    const totalPoints = demandPoints.length + offerPoints.length + counterPoints.length + finalPoints.length;
    if (totalPoints === 0) {
      this.settlementChartOptions = null;
      return;
    }

    const series: any[] = [];
    if (demandPoints.length) series.push({ name: 'Demand', data: demandPoints });
    if (offerPoints.length) series.push({ name: 'Offer', data: offerPoints });
    if (counterPoints.length) series.push({ name: 'Counter', data: counterPoints });
    if (finalPoints.length) series.push({ name: 'Final', data: finalPoints });

    // Velzon palette: primary / success / warning / dark — keeps tones readable in both themes.
    const colors = ['#405189', '#0ab39c', '#f7b84b', '#212529'];

    this.settlementChartOptions = {
      series,
      chart: {
        type: 'line',
        height: 240,
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { enabled: true, easing: 'easeinout', speed: 600 },
        background: 'transparent',
      },
      stroke: { curve: 'straight', width: 2.5 },
      markers: {
        size: 5,
        strokeColors: '#fff',
        strokeWidth: 2,
        hover: { size: 7 },
      },
      colors: colors.slice(0, series.length),
      xaxis: {
        type: 'datetime',
        labels: { datetimeUTC: false, style: { fontSize: '11px' } },
      },
      yaxis: {
        labels: {
          formatter: (v: number) => {
            if (!Number.isFinite(v)) return '$0';
            if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
            if (v >= 1_000) return `$${Math.round(v / 1_000)}k`;
            return `$${Math.round(v)}`;
          },
          style: { fontSize: '11px' },
        },
      },
      tooltip: {
        x: { format: 'MMM d, yyyy' },
        y: { formatter: (v: number) => this.formatCurrency(v) },
      },
      grid: { strokeDashArray: 3, borderColor: 'rgba(0,0,0,.08)' },
      legend: { position: 'top', horizontalAlign: 'right', fontSize: '12px', markers: { size: 6 } },
      dataLabels: { enabled: false },
    };
  }

  /**
   * Fetch PI medical records for the Case File tab. Records list is independent of
   * the medical summary — even if the summary doesn't exist, individual records
   * may have been created (e.g., manually entered by a paralegal).
   */
  private loadMedicalRecords(caseId: number): void {
    this.loadingMedicalRecords = true;
    this.medicalRecordService.getRecordsByCaseId(caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (records: PIMedicalRecord[]) => {
          this.medicalRecords = records ?? [];
          this.loadingMedicalRecords = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('Failed to load PI medical records', err);
          this.medicalRecords = [];
          this.loadingMedicalRecords = false;
          this.cdr.markForCheck();
        }
      });
  }

  // ============================================
  // P13b.1 — Scan Documents handler chain
  //
  // Mirrors the legacy `personal-injury.component.ts:3945-3990` flow:
  //   1. Register a background task so the global tray reflects progress
  //   2. POST /scan-documents (returns 202 ACCEPTED, async)
  //   3. Subscribe to MEDICAL_SCAN_PROGRESS / MEDICAL_SCAN_COMPLETE WebSocket
  //      events (subscription wired in ngOnInit)
  //   4. Polling fallback every 5s — if backend reports no active scan, the
  //      WebSocket message was lost, so finalize manually
  //   5. 5-minute safety timeout in case both delivery channels fail
  // ============================================

  /**
   * Kick off a medical-document scan for the current case. The button is
   * disabled while a scan is in flight; a second click after a stuck scan
   * (no completion message in 5 min) safety-resets state before re-starting.
   */
  scanCaseDocuments(): void {
    if (!this.case?.id) return;

    // Safety: if a previous scan got stuck (no WebSocket completion + no poll
    // resolution), the user clicking again should reset state rather than block.
    if (this.isScanningDocuments && this.scanTaskId) {
      this.backgroundTaskService.failTask(this.scanTaskId, 'Previous scan did not complete. Starting new scan.');
      this.scanTaskId = null;
    }

    this.isScanningDocuments = true;
    this.scanResult = null;
    this.scanProgress = null;
    this.preScanRecordCount = this.medicalRecords.length;

    const taskId = this.backgroundTaskService.registerTask(
      'medical_scan',
      'Scanning Medical Documents',
      'Starting document scan...',
      { documentId: Number(this.case.id) }
    );
    this.scanTaskId = taskId;
    this.backgroundTaskService.startTask(taskId);

    this.clearScanTimeout();
    this.scanTimeoutId = setTimeout(() => {
      if (this.isScanningDocuments) {
        this.completeScanCleanup();
        this.backgroundTaskService.failTask(taskId, 'Scan timed out — no response from server.');
      }
    }, 5 * 60 * 1000);

    const caseId = Number(this.case.id);

    this.medicalRecordService.scanCaseDocuments(caseId).subscribe({
      next: () => {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'info',
          title: 'Document scan started',
          text: 'Scanning your medical documents in the background.',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true,
        });
        this.startScanPolling(caseId, taskId);
      },
      error: (err: any) => {
        console.error('Error starting document scan:', err);
        this.completeScanCleanup();
        this.backgroundTaskService.failTask(taskId, err.error?.message || 'Failed to start scan.');
        this.cdr.markForCheck();

        const isAlreadyScanning = err.status === 409;
        Swal.fire({
          icon: isAlreadyScanning ? 'info' : 'error',
          title: isAlreadyScanning ? 'Scan In Progress' : 'Scan Failed',
          text: err.error?.message || 'Failed to start document scan. Please try again.',
          confirmButtonText: 'OK',
        });
      },
    });
  }

  /** Cancel the safety timeout + stop polling. Used by both completion paths and ngOnDestroy. */
  private clearScanTimeout(): void {
    if (this.scanTimeoutId) {
      clearTimeout(this.scanTimeoutId);
      this.scanTimeoutId = null;
    }
    this.stopScanPolling();
  }

  /**
   * Poll the scan endpoint every 5s as a fallback for WebSocket delivery
   * failures. Strategy: try to start ANOTHER scan — if backend returns 202
   * (accepted, no scan running), the original scan must have finished and
   * we lost the WebSocket completion message. Up to 60 ticks (5 min) safety cap.
   */
  private startScanPolling(caseId: number, taskId: string): void {
    this.stopScanPolling();
    let pollCount = 0;
    this.scanPollId = setInterval(() => {
      pollCount++;
      if (!this.isScanningDocuments || pollCount > 60) {
        this.stopScanPolling();
        return;
      }
      this.medicalRecordService.scanCaseDocuments(caseId).subscribe({
        next: () => {
          // 202 = backend accepted a NEW scan = previous scan finished. The
          // WebSocket payload was lost; derive recordsCreated from a fresh fetch.
          if (this.isScanningDocuments) {
            this.stopScanPolling();
            this.medicalRecordService.getRecordsByCaseId(caseId)
              .pipe(take(1))
              .subscribe({
                next: (records: PIMedicalRecord[]) => {
                  const recordsCreated = Math.max(0, records.length - this.preScanRecordCount);
                  this.handleScanComplete(taskId, { recordsCreated });
                },
                error: () => this.handleScanComplete(taskId),
              });
          }
        },
        error: (err: any) => {
          if (err.status === 409) {
            // Still scanning — keep polling.
          } else {
            this.stopScanPolling();
          }
        },
      });
    }, 5000);
  }

  private stopScanPolling(): void {
    if (this.scanPollId) {
      clearInterval(this.scanPollId);
      this.scanPollId = null;
    }
  }

  /**
   * Called from BOTH the WebSocket completion handler AND the polling
   * fallback. Reloads records, refreshes the case, marks the medical summary
   * stale (so the Generate-Summary CTA emphasizes "needs refresh"), and
   * surfaces a result dialog to the attorney.
   */
  private handleScanComplete(taskId: string, payload?: any): void {
    this.completeScanCleanup();

    const recordsCreated = payload?.recordsCreated ?? 0;
    const documentsScanned = payload?.documentsScanned ?? 0;
    const caseId = Number(this.case?.id);

    this.backgroundTaskService.completeTask(taskId, {
      caseId,
      recordsCreated,
      documentsScanned,
      title: recordsCreated > 0
        ? `${recordsCreated} medical records created`
        : 'All documents already processed',
    });

    if (caseId) {
      this.loadMedicalRecords(caseId);
      // P15.a — Refresh per-doc status so badges reflect the latest scan outcomes.
      this.loadScanTracking(caseId);
      // Mark summary stale — the attorney should regenerate to incorporate new records.
      // Don't auto-clear `medicalSummary` here so they can still see prior diagnoses
      // while the regen runs; the staleness banner is enough to flag the gap.
      if (recordsCreated > 0) this.summaryStale = true;
    }

    this.scanResult = payload;
    if (recordsCreated > 0) {
      const detail = documentsScanned > 0 ? ` from ${documentsScanned} documents` : '';
      Swal.fire({
        icon: 'success',
        title: 'Scan Complete',
        html: `Created <strong>${recordsCreated}</strong> new medical records${detail}.<br><small class="text-muted">Click <strong>Generate Summary</strong> to update causation, diagnoses, and chronology with the new records.</small>`,
        confirmButtonText: 'OK',
      });
    } else {
      const detail = documentsScanned > 0
        ? `All <strong>${documentsScanned}</strong> documents have already been processed.<br>`
        : '';
      Swal.fire({
        icon: 'info',
        title: 'Scan Complete',
        html: `${detail}No new medical records found.`,
        confirmButtonText: 'OK',
      });
    }

    this.cdr.markForCheck();
  }

  /** Clean up scan state — used by both completion paths AND user-facing error paths. */
  private completeScanCleanup(): void {
    this.isScanningDocuments = false;
    this.scanProgress = null;
    this.scanTaskId = null;
    this.clearScanTimeout();
  }

  // ============================================
  // P15.a — Per-document scan tracking
  // ============================================

  /** Load scan-tracking for the case + index by documentId. Refresh after every scan. */
  private loadScanTracking(caseId: number): void {
    this.medicalRecordService.getScanTracking(caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (rows: PIScanTrackingRow[]) => {
          this.scanTracking = rows || [];
          const idx = new Map<number, PIScanTrackingRow>();
          for (const r of this.scanTracking) idx.set(r.documentId, r);
          this.scanTrackingByDocId = idx;
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          console.warn('Failed to load scan tracking', err);
          this.scanTracking = [];
          this.scanTrackingByDocId = new Map();
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Render-friendly status for a record's source document. Looks up the
   * tracking row by `documentId` (set on every PIMedicalRecord at scan time).
   * Returns null when no tracking row exists — record was created manually
   * (no underlying document) OR scan tracking hasn't loaded yet.
   */
  getRecordScanStatus(record: PIMedicalRecord): PIScanTrackingRow | null {
    if (!record.documentId) return null;
    return this.scanTrackingByDocId.get(Number(record.documentId)) || null;
  }

  /** Tone class for a scan-tracking badge — green / red / grey based on status. */
  scanStatusBadgeClass(status: PIScanTrackingRow['status']): string {
    switch (status) {
      case 'created':
      case 'merged':
        return 'bg-success-subtle text-success';
      case 'failed':
      case 'no_text':
        return 'bg-danger-subtle text-danger';
      case 'non_medical':
      case 'insurance':
        return 'bg-secondary-subtle text-secondary';
      default:
        return 'bg-light text-muted border';
    }
  }

  /** Human-readable label for a scan status. */
  scanStatusLabel(status: PIScanTrackingRow['status']): string {
    switch (status) {
      case 'created':     return 'Analyzed';
      case 'merged':      return 'Analyzed (merged)';
      case 'failed':      return 'Failed';
      case 'no_text':     return 'No text extracted';
      case 'non_medical': return 'Skipped — not medical';
      case 'insurance':   return 'Skipped — insurance ledger';
      default:            return 'Not scanned';
    }
  }

  /** Whether a row's scan status warrants a Retry button (operator can re-run AI). */
  isRetriableStatus(status: PIScanTrackingRow['status']): boolean {
    return status === 'failed' || status === 'no_text';
  }

  /**
   * Re-run AI analysis for a single document. Used by per-row Retry buttons
   * on Failed records and by the AI Settings modal's failed-retry queue.
   * Wraps `analyzeFileAndCreateRecord` with a per-doc loading flag so
   * concurrent retries don't disable each other.
   */
  retryAnalyze(documentId: number): void {
    if (!this.case?.id || this.retryingDocIds.has(documentId)) return;
    const caseId = Number(this.case.id);

    this.retryingDocIds.add(documentId);
    this.cdr.markForCheck();

    this.medicalRecordService.analyzeFileAndCreateRecord(caseId, documentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.retryingDocIds.delete(documentId);
          // Refresh: the retry might have created a new record OR re-failed.
          this.loadMedicalRecords(caseId);
          this.loadScanTracking(caseId);
          this.summaryStale = true;
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Retry complete',
            showConfirmButton: false,
            timer: 2500,
            timerProgressBar: true,
          });
        },
        error: (err: any) => {
          this.retryingDocIds.delete(documentId);
          this.cdr.markForCheck();
          Swal.fire({
            icon: 'error',
            title: 'Retry Failed',
            text: err.error?.message || 'Could not re-analyze this document. Check backend logs.',
            confirmButtonText: 'OK',
          });
        },
      });
  }

  /** Aggregate counts for the AI Settings modal snapshot (P15.b). */
  get scanSummaryCounts(): { analyzed: number; skipped: number; failed: number; unscanned: number } {
    const counts = { analyzed: 0, skipped: 0, failed: 0, unscanned: 0 };
    for (const row of this.scanTracking) {
      switch (row.status) {
        case 'created':
        case 'merged':
          counts.analyzed++; break;
        case 'non_medical':
        case 'insurance':
          counts.skipped++; break;
        case 'failed':
        case 'no_text':
          counts.failed++; break;
        default:
          counts.unscanned++;
      }
    }
    return counts;
  }

  /** Failed-analysis retry queue — surfaced in the AI Settings modal. */
  get failedScanRows(): PIScanTrackingRow[] {
    return this.scanTracking.filter(r => this.isRetriableStatus(r.status));
  }

  /**
   * P15.b — Batch-retry all failed analyses from the AI Settings modal. Each
   * `retryAnalyze` call is fire-and-forget (parallel dispatch), so all retries
   * land at the backend roughly simultaneously. Acceptable when N is small
   * (typical case has 1-3 failed scans). For >10 failures, consider serializing
   * via concatMap to spare Bedrock the spike — confirm token-cost ceiling first.
   *
   * Each retry's per-row tracking handles individual outcomes; one failure
   * doesn't block the others.
   */
  retryAllFailed(): void {
    const docIds = this.failedScanRows.map(r => r.documentId);
    if (docIds.length === 0) return;

    Swal.fire({
      title: `Retry ${docIds.length} failed scan${docIds.length === 1 ? '' : 's'}?`,
      text: 'Each document will be re-analyzed against the current AI prompt. This consumes tokens.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: `Retry ${docIds.length}`,
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#0ab39c',
    }).then(result => {
      if (!result.isConfirmed) return;
      // Parallel dispatch — see method comment.
      docIds.forEach(id => this.retryAnalyze(id));
    });
  }

  // ============================================
  // P13b.2 — Generate / Refresh Medical Summary
  //
  // Mirrors the legacy `personal-injury.component.ts:4385-4441` flow but with
  // the Generate-then-rerun dichotomy: the same backend endpoint generates a
  // fresh summary OR overwrites an existing one. Phased chronology, causation,
  // diagnoses, redFlags, providerSummary, missingRecords, and treatmentChronology
  // are ALL produced in the same backend call — no separate triggers needed.
  // ============================================

  /**
   * Whether the Generate-Summary button should be shown. Prevents the user
   * from generating a summary mid-scan (mirrors legacy interlock).
   */
  get canGenerateSummary(): boolean {
    return !!this.case?.id && !this.isScanningDocuments && !this.isGeneratingSummary;
  }

  /**
   * Generate or refresh the AI medical summary for the current case. Blocks
   * the UI with a Swal loading dialog while the backend runs the AI pipeline
   * (~30-60s typical). On success, refreshes the local summary state so all
   * Strategy / Case File / Damages tabs that read from `medicalSummary` update.
   */
  generateMedicalSummary(): void {
    if (!this.case?.id) return;

    if (this.isScanningDocuments) {
      Swal.fire({
        icon: 'info',
        title: 'Scan In Progress',
        text: 'Please wait for the document scan to finish before generating a summary. The summary needs all records to be accurate.',
        confirmButtonText: 'OK',
      });
      return;
    }

    this.isGeneratingSummary = true;
    this.cdr.markForCheck();

    Swal.fire({
      title: 'Generating Medical Summary',
      html: 'AI is analyzing your medical records…<br><small>This may take a minute.</small>',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    this.medicalSummaryService.generateMedicalSummary(Number(this.case.id))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (summary: PIMedicalSummary) => {
          this.medicalSummary = summary;
          this.summaryStale = false;
          this.isGeneratingSummary = false;
          // Refresh the rest of the dependent state (anomalies, adjuster analysis re-cache, etc.)
          if (this.case?.id) this.loadMedicalSummary(this.case.id);
          this.cdr.markForCheck();
          Swal.fire({
            icon: 'success',
            title: 'Summary Generated',
            html: `
              <div class="text-start">
                <p class="mb-1"><strong>Completeness:</strong> ${summary.completenessScore ?? 0}%</p>
                <p class="mb-1"><strong>Providers:</strong> ${summary.providerSummary?.length ?? 0}</p>
                <p class="mb-1"><strong>Diagnoses:</strong> ${summary.diagnosisList?.length ?? 0}</p>
                ${summary.redFlags?.length ? `<p class="mb-0 text-danger"><strong>Red flags:</strong> ${summary.redFlags.length}</p>` : ''}
              </div>`,
            confirmButtonText: 'View Summary',
          });
        },
        error: (err: any) => {
          console.error('Error generating medical summary:', err);
          this.isGeneratingSummary = false;
          this.cdr.markForCheck();
          Swal.fire({
            icon: 'error',
            title: 'Generation Failed',
            text: err.error?.message || 'Failed to generate medical summary. Make sure you have medical records first.',
            confirmButtonText: 'OK',
          });
        },
      });
  }

  // ============================================
  // P13b.3 — Detect Treatment Gaps
  //
  // Runs a pure-rules backend pass that finds intervals > 30 days between
  // visits and surfaces them as gap markers attached to the Case Timeline.
  // Cheaper than a full summary regen — single API call, no AI involved.
  // ============================================

  /**
   * Detect (or refresh) treatment gaps. Result is held in `treatmentGaps`
   * and rendered as a list inside the Case Timeline section.
   */
  analyzeTreatmentGaps(): void {
    if (!this.case?.id || this.isAnalyzingGaps) return;

    this.isAnalyzingGaps = true;
    this.cdr.markForCheck();

    this.medicalSummaryService.analyzeTreatmentGaps(Number(this.case.id))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (gaps: TreatmentGap[]) => {
          this.treatmentGaps = gaps || [];
          this.treatmentGapsLoaded = true;
          this.isAnalyzingGaps = false;
          this.cdr.markForCheck();

          if (this.treatmentGaps.length === 0) {
            Swal.fire({
              toast: true,
              position: 'top-end',
              icon: 'success',
              title: 'No treatment gaps detected',
              text: 'All visit intervals are under 30 days.',
              showConfirmButton: false,
              timer: 3500,
              timerProgressBar: true,
            });
          }
        },
        error: (err: any) => {
          console.error('Failed to analyze treatment gaps', err);
          this.isAnalyzingGaps = false;
          this.cdr.markForCheck();
          Swal.fire({
            icon: 'error',
            title: 'Gap Analysis Failed',
            text: err.error?.message || 'Could not analyze treatment gaps. Please try again.',
            confirmButtonText: 'OK',
          });
        },
      });
  }

  // ============================================
  // P13b.4 — Reprocess from cache (dev/staging only)
  //
  // Replays the cached AI extractions stored on `pi_scanned_documents.raw_extraction`
  // through the current persistence/merge logic — without paying Bedrock token cost.
  // Used during backend iteration; gated to localhost + staging hostnames so it never
  // shows up in production.
  // ============================================

  /**
   * Hostname gate. Visible on localhost / 127.0.0.1 and any host containing
   * "staging". Mirrors legacy `personal-injury.component.ts:4070-4076`.
   */
  isReprocessAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (host.includes('staging')) return true;
    return false;
  }

  /**
   * Re-run persistence/merge logic against cached AI extractions WITHOUT
   * calling Bedrock. Confirms first since this DELETES existing PIMedicalRecord
   * rows before replaying.
   */
  reprocessFromCache(): void {
    if (!this.case?.id) return;
    const caseId = Number(this.case.id);

    Swal.fire({
      title: 'Reprocess from cached AI extractions?',
      html: `This will <strong>delete the current medical records</strong> and rebuild them
             by replaying the cached AI responses through the current persistence/merge logic.<br><br>
             <strong>No Bedrock calls — $0 token cost.</strong><br><br>
             Useful when iterating on backend logic without re-scanning.
             <br><br><em>Records that haven't been scanned yet (no cached extraction) will be skipped —
             run a fresh scan first if needed.</em>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0ab39c',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Reprocess',
      cancelButtonText: 'Cancel',
    }).then(result => {
      if (!result.isConfirmed) return;

      Swal.fire({
        title: 'Reprocessing…',
        text: 'Replaying cached extractions through current logic.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      this.medicalRecordService.reprocessCaseDocuments(caseId).subscribe({
        next: (data: any) => {
          this.loadMedicalRecords(caseId);
          this.cdr.markForCheck();

          const replayed = data?.replayedDocuments ?? 0;
          const created = data?.recordsCreated ?? 0;
          const aiCallsAvoided = data?.aiCallsAvoided ?? 0;
          const errors: string[] = data?.errors ?? [];

          if (data?.success) {
            Swal.fire({
              icon: errors.length > 0 ? 'warning' : 'success',
              title: errors.length > 0 ? 'Reprocess completed with warnings' : 'Reprocess complete',
              html: `Replayed <strong>${replayed}</strong> cached extractions into <strong>${created}</strong> records.<br>
                     <span class="text-success"><i class="ri-coin-line"></i> ${aiCallsAvoided} AI calls avoided.</span>` +
                     (errors.length > 0 ? `<br><br><small class="text-muted">${errors.length} error(s): ${errors.slice(0, 3).join('; ')}</small>` : ''),
              confirmButtonText: 'OK',
            });
          } else {
            Swal.fire({
              icon: 'info',
              title: 'No cached extractions',
              text: data?.message || 'No cached AI extractions found for this case. Run a fresh scan first to populate the cache.',
              confirmButtonText: 'OK',
            });
          }
        },
        error: (err: any) => {
          console.error('Reprocess failed:', err);
          Swal.fire({
            icon: 'error',
            title: 'Reprocess failed',
            text: err.error?.message || err.message || 'Failed to reprocess case. Check backend logs.',
            confirmButtonText: 'OK',
          });
        },
      });
    });
  }

  /** Toggle a Treatment Phase expanded/collapsed. */
  togglePhase(index: number): void {
    if (this.phaseExpandedItems.has(index)) {
      this.phaseExpandedItems.delete(index);
    } else {
      this.phaseExpandedItems.add(index);
    }
    this.cdr.markForCheck();
  }

  /**
   * Format a phase's date range for the row meta line.
   * "Nov 6, 2025 → Nov 11, 2025" or "Nov 6, 2025" when only startDate is set.
   */
  formatPhaseRange(phase: ChronologyPhase): string {
    const start = phase.startDate ? this.formatShortDate(phase.startDate) : '';
    const end = phase.endDate ? this.formatShortDate(phase.endDate) : '';
    if (!start && !end) return '';
    if (start && end && start !== end) return `${start} → ${end}`;
    return start || end;
  }

  /** Sum billed amounts for the records assigned to a phase. */
  getPhaseBilledTotal(phase: ChronologyPhase): number {
    if (!phase.recordIds?.length || !this.medicalRecords?.length) return 0;
    const idSet = new Set(phase.recordIds);
    return this.medicalRecords
      .filter(r => r.id !== undefined && idSet.has(r.id))
      .reduce((sum, r) => sum + (r.billedAmount ?? 0), 0);
  }

  /**
   * Get the records assigned to a phase by its `recordIds` array.
   * Used for in-line drill-down inside the expanded phase body.
   */
  getRecordsForPhase(phase: ChronologyPhase): PIMedicalRecord[] {
    if (!phase.recordIds?.length || !this.medicalRecords?.length) return [];
    const idSet = new Set(phase.recordIds);
    return this.medicalRecords.filter(r => r.id !== undefined && idSet.has(r.id));
  }

  /** Short label for record type (e.g., "ER" → "Emergency Room"). */
  getRecordTypeLabel(type: string | undefined): string {
    const map: Record<string, string> = {
      ER:           'Emergency Room',
      FOLLOW_UP:    'Follow-up',
      SURGERY:      'Surgery',
      PT:           'Physical Therapy',
      IMAGING:      'Imaging',
      LAB:          'Laboratory',
      CONSULTATION: 'Consultation',
      CHIROPRACTIC: 'Chiropractic',
      PAIN_MGMT:    'Pain Mgmt',
      PRIMARY_CARE: 'Primary Care',
      OTHER:        'Other',
    };
    return map[(type || '').toUpperCase()] || (type || 'Record');
  }

  /**
   * Fetch the saved adjuster defense analysis (Tier 5b). This is generated
   * separately from the medical summary in the legacy AI assistant view; here
   * we just consume what's already there. 404 / no analysis = empty state with
   * "Generate Analysis" CTA.
   */
  private loadAdjusterAnalysis(caseId: number): void {
    this.loadingAdjusterAnalysis = true;
    this.medicalSummaryService.getSavedAdjusterAnalysis(caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          // Backend returns ApiResponse-shaped envelope; analysis lives at data.analysis
          this.adjusterAnalysis = response?.data?.analysis ?? response?.analysis ?? null;
          this.loadingAdjusterAnalysis = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          // 404 = no analysis on file yet, expected. Anything else = log + soft-fail.
          if (err?.status !== 404) {
            console.warn('Failed to load adjuster analysis', err);
          }
          this.adjusterAnalysis = null;
          this.loadingAdjusterAnalysis = false;
          this.cdr.markForCheck();
        }
      });
  }

  /** Toggle a Defense Vector expanded/collapsed. Matches legacy UX. */
  toggleAdjusterItem(index: number): void {
    if (this.adjusterExpandedItems.has(index)) {
      this.adjusterExpandedItems.delete(index);
    } else {
      this.adjusterExpandedItems.add(index);
    }
    this.cdr.markForCheck();
  }

  /** Severity badge class for a Defense Vector. */
  getAdjusterSeverityClass(severity: string | undefined | null): string {
    return sharedAdjusterSeverity(severity);
  }

  /** Remix Icon for a Defense Vector type. */
  getAdjusterTypeIcon(type: string | undefined | null): string {
    return sharedAdjusterIcon(type);
  }

  /** Velzon priority class for an OpenItem badge. */
  getOpenItemPriorityClass(priority: string | undefined | null): string {
    return sharedOpenItemPriority(priority);
  }

  /** Diagnoses grouped by anatomical region — for Strategy tab table. */
  getDiagnosesByRegion(): Array<{ region: string; items: DiagnosisItem[] }> {
    return sharedDiagnosesByRegion(this.medicalSummary?.diagnosisList);
  }

  /** Trigger generation of an adjuster defense analysis. */
  generateAdjusterAnalysis(): void {
    if (!this.case?.id) return;
    const numericId = Number(this.case.id);
    if (!Number.isFinite(numericId)) return;

    Swal.fire({
      title: 'Generating Adjuster Defense Analysis',
      html: 'AI is analyzing your medical records for potential adjuster attacks…<br><small>This may take a minute.</small>',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    this.medicalSummaryService.generateAdjusterAnalysis(numericId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (analysis: any) => {
          this.adjusterAnalysis = analysis;
          this.adjusterExpandedItems = new Set([0, 1]);
          this.cdr.markForCheck();
          Swal.fire({
            icon: 'success',
            title: 'Analysis Complete',
            text: `${analysis?.attackVectors?.length || 0} attack vector(s) found.`,
            confirmButtonText: 'View Analysis',
          });
        },
        error: (err) => {
          Swal.fire({
            icon: 'error',
            title: 'Analysis Failed',
            text: err?.error?.message || 'Failed to generate adjuster defense analysis.',
          });
        }
      });
  }

  ngOnDestroy(): void {
    // P13b.1 — Clear any pending scan timers so we don't keep polling a case
    // the user navigated away from.
    this.clearScanTimeout();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================
  // Identity helpers
  // ============================================

  getClientInitials(): string {
    const name = this.case?.clientName || '';
    return name
      .split(/\s+/).filter(Boolean).slice(0, 2)
      .map(p => p.charAt(0).toUpperCase()).join('') || '?';
  }

  /** Full case title — earlier iteration tried to split on " v. " for visual hierarchy
   *  but that mangled short titles. Full title with CSS truncation is the right call. */
  getCaseTitle(): string {
    return this.case?.title || '';
  }

  /** Attorney avatar chips for the meta line. Up to 3 initials. */
  getAttorneyChips(): AttorneyChip[] {
    const attorneys = this.case?.assignedAttorneys ?? [];
    return attorneys.slice(0, 3).map(a => ({
      initials: ((a.firstName?.[0] || '') + (a.lastName?.[0] || '')).toUpperCase() || '?',
      fullName: `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Unassigned',
    }));
  }

  // ============================================
  // Stage pipeline helpers
  // ============================================

  getStageIndex(): number {
    if (!this.case?.stage) return -1;
    const found = this.STAGE_PIPELINE.find(s => s.key === this.case!.stage);
    return found ? found.index : -1;
  }

  getStageStepClass(stepIndex: number): string {
    const current = this.getStageIndex();
    if (current === -1) return 'pending';
    if (stepIndex < current) return 'done';
    if (stepIndex === current) return 'active';
    return 'pending';
  }

  /** Bootstrap text/badge tone keyword (primary / warning / success / etc.) per stage. */
  getStageBadgeTone(stage?: string): string {
    switch (stage) {
      case 'INTAKE':         return 'secondary';
      case 'INVESTIGATION':  return 'info';
      case 'TREATMENT':      return 'primary';
      case 'PRE_DEMAND':
      case 'DEMAND_SENT':
      case 'NEGOTIATION':    return 'warning';
      case 'SETTLED':        return 'success';
      default:               return 'secondary';
    }
  }

  /** Velzon badge class for SOL countdown chip, by severity. */
  getSolBadgeClass(severity: SolCountdown['severity']): string {
    switch (severity) {
      case 'good':     return 'bg-success-subtle text-success';
      case 'warn':     return 'bg-warning-subtle text-warning';
      case 'urgent':
      case 'critical':
      case 'expired':  return 'bg-danger-subtle text-danger';
      default:         return 'bg-secondary-subtle text-secondary';
    }
  }

  formatStage(stage?: string): string {
    if (!stage) return 'Unstaged';
    const step = this.STAGE_PIPELINE.find(s => s.key === stage);
    return step?.label ?? stage;
  }

  // ============================================
  // SOL countdown
  // ============================================

  getSolCountdown(): SolCountdown | null {
    if (!this.case?.statuteOfLimitations) return null;
    const sol = new Date(this.case.statuteOfLimitations as any);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    sol.setHours(0, 0, 0, 0);
    const totalDays = Math.floor((sol.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (totalDays < 0) {
      return { totalDays, label: 'EXPIRED', severity: 'expired',
               fineText: `${Math.abs(totalDays)}d past SOL` };
    }
    if (totalDays < 30) {
      return { totalDays, label: `${totalDays}d to SOL`, severity: 'critical',
               fineText: this.formatSolDate(sol) };
    }
    if (totalDays < 180) {
      const months = Math.floor(totalDays / 30);
      return { totalDays, label: `${months}mo to SOL`, severity: 'urgent',
               fineText: this.formatSolDate(sol) };
    }
    if (totalDays < 365) {
      const months = Math.floor(totalDays / 30);
      return { totalDays, label: `${months}mo to SOL`, severity: 'warn',
               fineText: this.formatSolDate(sol) };
    }
    const years = Math.floor(totalDays / 365);
    const months = Math.floor((totalDays % 365) / 30);
    return { totalDays,
             label: months > 0 ? `${years}y ${months}mo to SOL` : `${years}y to SOL`,
             severity: 'good',
             fineText: this.formatSolDate(sol) };
  }

  private formatSolDate(d: Date): string {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  getDaysSinceLoss(): number | null {
    if (!this.case?.injuryDate) return null;
    const dol = new Date(this.case.injuryDate as any);
    const today = new Date();
    return Math.max(0, Math.floor((today.getTime() - dol.getTime()) / (1000 * 60 * 60 * 24)));
  }

  // ============================================
  // HERO KPIs — 5 inline tiles in the dark hero strip
  // ============================================

  /**
   * Returns the 5 KPI tiles for the dark hero. Order: Specials, PIP, Likely Demand,
   * Net to Client, Critical Path. Hints can contain `<span class="hint-strong|warn|good|danger">`
   * tags for inline color emphasis (rendered via [innerHTML] in the template).
   *
   * P5 will replace the "—" / "P5" hint placeholders for visit-count and critical-path
   * count once the medical-summary loader is wired into this shell.
   */
  getHeroKpis(): HeroKpi[] {
    const c = this.case;
    if (!c) return [];

    const specials = c.medicalExpensesTotal ?? 0;
    const pipUsed = c.clientInsurancePipDeductiblePaid ?? 0;
    const pipLimit = c.clientInsurancePipLimit ?? 0;
    const pipDed = c.clientInsurancePipDeductible ?? 0;
    const days = this.getDaysSinceLoss();

    const likelyDemand = this.estimateLikelyDemand();
    const range = this.estimateDemandRange();
    const netToClient = this.estimateNetToClient();
    const critItems = this.getCriticalPathItems();
    const highCount = critItems.filter(i => i.priority === 'HIGH').length;
    const topHigh = critItems.find(i => i.priority === 'HIGH');

    // Visit count + treatment span come from the loaded medical summary.
    const totalVisits = this.medicalSummary?.totalVisits;
    const totalProviders = this.medicalSummary?.totalProviders;
    const treatmentDuration = this.medicalSummary?.treatmentDurationDays;

    // Compose the Total Specials hint: prefer "N visits · M days" when summary
    // is loaded; fall back to days-since-DOL when only the case shell is loaded.
    let specialsHint: string;
    if (totalVisits && totalVisits > 0) {
      const daysPart = treatmentDuration && treatmentDuration > 0
        ? ` · <span class="hint-strong">${treatmentDuration}</span> days tx`
        : (days !== null ? ` · <span class="hint-strong">${days}</span> days` : '');
      specialsHint = `<span class="hint-strong">${totalVisits}</span> visit${totalVisits === 1 ? '' : 's'}${daysPart}`;
    } else if (days !== null) {
      specialsHint = `<span class="hint-strong">${days}</span> days in case`;
    } else {
      specialsHint = 'no DOL set';
    }

    return [
      {
        label: 'Total Specials',
        value: specials > 0 ? this.formatCurrency(specials) : '—',
        hint: specialsHint,
        icon: 'ri-stack-line',
      },
      {
        label: 'PIP Coverage',
        value: pipLimit > 0
          ? `${this.formatCurrencyCompact(pipUsed)} / ${this.formatCurrencyCompact(pipLimit)}`
          : '—',
        hint: pipLimit > 0
          ? `<span class="hint-strong">${this.formatCurrencyCompact(Math.max(0, pipLimit - pipUsed))}</span> left`
            + (pipDed > 0 ? ` · $${pipDed.toFixed(0)} ded` : '')
          : 'no PIP set',
        icon: 'ri-shield-check-line',
      },
      {
        label: 'Likely Demand',
        value: likelyDemand > 0 ? this.formatCurrency(likelyDemand) : '—',
        hint: range
          ? `range ${this.formatCurrencyCompact(range.low)}–${this.formatCurrencyCompact(range.high)}`
          : (totalProviders ? `from ${totalProviders} provider${totalProviders === 1 ? '' : 's'}` : 'awaiting specials'),
        icon: 'ri-line-chart-line',
      },
      {
        label: 'Net to Client (Est.)',
        value: netToClient > 0 ? this.formatCurrency(netToClient) : '—',
        hint: netToClient > 0
          ? `after 33⅓% fee + costs`
          : 'awaiting specials',
        toneClass: netToClient > 0 ? 'kpi-success' : '',
        icon: 'ri-hand-coin-line',
      },
      {
        label: 'Critical Path',
        value: highCount > 0
          ? `${highCount} HIGH`
          : (critItems.length > 0 ? `${critItems.length} open` : (this.medicalSummary ? 'clear' : '—')),
        hint: highCount > 0
          ? `<span class="hint-danger">${topHigh ? topHigh.title.toLowerCase() : 'missing reports'}</span>`
          : (critItems.length > 0
              ? `${critItems.length} item${critItems.length === 1 ? '' : 's'} pending review`
              : (this.medicalSummary ? 'no blockers identified' : 'awaiting summary')),
        toneClass: highCount > 0 ? 'kpi-danger' : (critItems.length === 0 && this.medicalSummary ? 'kpi-success' : ''),
        icon: 'ri-flashlight-line',
      },
    ];
  }

  // ============================================
  // Damages — single source of truth for the demand calculator
  // ============================================
  // The hero KPI strip and the Damages tab both consume these methods, so the
  // dashboard's "Likely Demand" / "Net to Client" tiles always agree with what
  // the calculator shows. The damageScenario field is the persisted state.
  // ============================================

  /** Defaults used when no scenario exists yet. Matches attorney-norm 3.0× P&S. */
  private defaultDamageScenario(): DemandScenario {
    return {
      multiplier: 3.0,
      wageLoss: 0,
      feeMode: 'PRE_SUIT_33',
      costs: 500,
      liens: 0,
    };
  }

  /**
   * After the medical summary loads, copy any persisted demandScenario into the
   * working state. If the summary was loaded fresh from the DB and the field is
   * absent, leave the defaults in place so the calculator still works.
   */
  private hydrateDamageScenarioFromSummary(): void {
    const persisted = this.medicalSummary?.demandScenario;
    if (!persisted) return;
    // Merge: persisted values override defaults; missing keys keep defaults.
    this.damageScenario = { ...this.defaultDamageScenario(), ...persisted };
    this.damageSavedAt = persisted.savedAt ?? null;
  }

  /**
   * Total specials feeding the demand calculator.
   *
   * Source preference:
   *   1. **Damage Elements (P10.d)** when populated — sum of all economic
   *      damage categories (PAST/FUTURE_MEDICAL, LOST_WAGES, EARNING_CAPACITY,
   *      HOUSEHOLD_SERVICES, MILEAGE). PAIN_SUFFERING is excluded since the
   *      calculator computes P&S separately via the multiplier.
   *   2. **Scratchpad** fallback (legacy P5.4 path) — `medicalExpensesTotal`
   *      from the case + the calculator's `wageLoss` field. Kept so existing
   *      cases without structured Damage Elements still produce sensible
   *      Range Scenarios + Net to Client tiles.
   *
   * As soon as the attorney adds even one Damage Element, the canonical
   * source flips. They can still use the scratchpad multiplier / fee mode /
   * costs / liens — the change is purely about where specials come from.
   */
  getSpecialsTotal(): number {
    if (this.damageElements && this.damageElements.length > 0) {
      const economic: PIDamageElementType[] = [
        'PAST_MEDICAL', 'FUTURE_MEDICAL', 'LOST_WAGES',
        'EARNING_CAPACITY', 'HOUSEHOLD_SERVICES', 'MILEAGE'
      ];
      return this.damageElements
        .filter(e => economic.includes(e.elementType))
        .reduce((sum, e) => sum + (Number(e.calculatedAmount) || 0), 0);
    }
    const medical = this.case?.medicalExpensesTotal ?? 0;
    const wage = this.damageScenario.wageLoss ?? 0;
    return medical + wage;
  }

  /** True when the demand calculator is reading from Damage Elements (P10.d) rather than the legacy scratchpad. */
  get specialsFromDamageElements(): boolean {
    return this.damageElements && this.damageElements.length > 0;
  }

  /** Pain & Suffering = specials × multiplier (multiplier override if passed). */
  getPainSuffering(multiplier?: number): number {
    const m = multiplier ?? this.damageScenario.multiplier ?? 3.0;
    return this.getSpecialsTotal() * m;
  }

  /** Gross demand = specials + P&S. */
  getGrossDemand(multiplier?: number): number {
    return this.getSpecialsTotal() + this.getPainSuffering(multiplier);
  }

  /** Attorney fee fraction based on the selected fee mode. */
  getFeeFraction(): number {
    return this.damageScenario.feeMode === 'SUIT_FILED_40' ? 0.40 : 1 / 3;
  }

  /** Net to client = gross − atty fee − costs − liens. */
  getNetToClient(multiplier?: number): number {
    const gross = this.getGrossDemand(multiplier);
    if (gross <= 0) return 0;
    const fee = gross * this.getFeeFraction();
    const costs = this.damageScenario.costs ?? 0;
    const liens = this.damageScenario.liens ?? 0;
    return Math.max(0, gross - fee - costs - liens);
  }

  /**
   * Three side-by-side scenarios for the Damages tab range card.
   * Conservative 2.0× · Likely 3.0× · Strong 4.0×.
   */
  getDemandRangeScenarios(): Array<{ label: string; multiplier: number; gross: number; net: number }> {
    return [
      { label: 'Conservative', multiplier: 2.0, gross: this.getGrossDemand(2.0), net: this.getNetToClient(2.0) },
      { label: 'Likely',       multiplier: 3.0, gross: this.getGrossDemand(3.0), net: this.getNetToClient(3.0) },
      { label: 'Strong',       multiplier: 4.0, gross: this.getGrossDemand(4.0), net: this.getNetToClient(4.0) },
    ];
  }

  // ============================================
  // P10.a — PIP State helpers
  // ============================================

  /**
   * Best-effort estimate of PIP dollars used so far. We don't have a dedicated
   * "pip_paid_to_date" column yet (slated for P15 when we batch-extract values
   * from PIP_LOG documents). For now: sum the medical-records charges that
   * fall within the PIP window — a conservative proxy that approximates real
   * usage as long as treating providers billed PIP first.
   */
  getPipUsedAmount(): number {
    const records = this.medicalRecords || [];
    if (records.length === 0) return 0;
    return records.reduce((sum, r: any) => {
      const charge = Number(r.totalCharges ?? r.amountBilled ?? 0);
      return sum + (Number.isFinite(charge) ? charge : 0);
    }, 0);
  }

  /** Percentage of PIP exhausted, clamped to [0, 100] for the progress bar. */
  getPipUsagePct(): number {
    const limit = Number(this.case?.clientInsurancePipLimit) || 0;
    if (limit <= 0) return 0;
    const used = this.getPipUsedAmount();
    return Math.max(0, Math.min(100, (used / limit) * 100));
  }

  /**
   * P13.a — Medical specials NOT covered by PIP, i.e., the portion the attorney
   * has to pursue from the at-fault carrier or 3rd-party coverage. Returned as
   * a non-negative number; if specials are still under PIP limit, gap = 0.
   *
   * Caveat: `getPipUsedAmount()` is a proxy (sum of billed charges in the PIP
   * window) rather than a true "PIP paid" figure. Underestimates gap when
   * carriers deny portions; overestimates when carriers haven't yet processed.
   * Will tighten when P15 surfaces a real `pip_paid_to_date` value.
   */
  getPipGap(): number {
    const specials = this.getSpecialsTotal();
    const pipLimit = Number(this.case?.clientInsurancePipLimit) || 0;
    return Math.max(0, specials - pipLimit);
  }

  /**
   * P13.b — Aggregate the case's date fields (LegalCase + ImportantDates) into
   * a single sorted list of upcoming events for the Overview Key Dates panel.
   * Past dates are excluded by default; toggle via `getKeyDates({ includePast: true })`.
   */
  getKeyDates(opts: { includePast?: boolean } = {}): KeyDateRow[] {
    const c = this.case;
    if (!c) return [];

    const now = Date.now();
    const dayMs = 86_400_000;

    const candidates: Array<{ label: string; iso: any; tone: KeyDateRow['tone']; icon: string }> = [
      { label: 'Date of Loss',     iso: c.injuryDate,                 tone: 'neutral', icon: 'ri-alert-line' },
      { label: 'Statute deadline', iso: (c as any).statuteOfLimitations, tone: 'danger',  icon: 'ri-shield-line' },
      { label: 'Filing date',      iso: c.importantDates?.filingDate, tone: 'info',    icon: 'ri-file-paper-2-line' },
      { label: 'Next hearing',     iso: c.importantDates?.nextHearing, tone: 'primary', icon: 'ri-scales-3-line' },
      { label: 'Trial date',       iso: c.importantDates?.trialDate,  tone: 'warning', icon: 'ri-gavel-line' },
      { label: 'Settlement date',  iso: c.settlementDate,             tone: 'success', icon: 'ri-handshake-line' },
    ];

    return candidates
      .filter(x => !!x.iso)
      .map(x => {
        const ts = new Date(x.iso as any).getTime();
        const days = Math.round((ts - now) / dayMs);
        return {
          label: x.label,
          date: x.iso as any,
          daysUntil: days,
          tone: x.tone,
          icon: x.icon,
          isPast: days < 0,
        } as KeyDateRow;
      })
      .filter(row => opts.includePast ? true : !row.isPast)
      .sort((a, b) => Math.abs(a.daysUntil) - Math.abs(b.daysUntil));
  }

  /**
   * Quick "X days from now" formatter for Key Dates rows. Past dates render as
   * "X days ago"; today renders as "today"; future as "in X days".
   */
  formatDaysUntil(days: number): string {
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    if (days === -1) return 'yesterday';
    if (days < 0) return `${Math.abs(days)} days ago`;
    return `in ${days} days`;
  }

  /**
   * P10.b — Heuristic: does this case have auto-policy structure that
   * makes BI/UM/UIM analysis meaningful? Used to gate the Coverage
   * Analysis card so it doesn't render on med-mal, premises, product
   * liability, or workplace cases where there's no at-fault driver.
   * Trigger if ANY auto-policy field is populated.
   *
   * P14 will replace this with the explicit `pi_subtype` enum (MVA / SLIP_FALL
   * / MED_MAL / etc.).
   */
  hasAutoCoverage(): boolean {
    const c = this.case;
    if (!c) return false;
    return Boolean(
      c.insurancePolicyLimit ||
      c.clientInsurancePipLimit ||
      c.clientInsuranceUmLimit ||
      c.clientInsuranceUimLimit ||
      c.clientInsuranceMedPayLimit
    );
  }

  // ============================================
  // P10.b — BI/UM/UIM coverage analysis
  // ============================================

  /**
   * Per-layer coverage analysis for the BI / UM / UIM stack.
   *
   * - **BI (primary)**: at-fault driver's bodily-injury policy. Active when
   *   `insurancePolicyLimit` is populated; the cap is the per-person limit.
   * - **UM**: client's own uninsured-motorist coverage. Activates when the
   *   at-fault driver is uninsured (heuristic: BI policy limit not on file).
   * - **UIM**: under-insured. Activates when BI is exhausted by the
   *   anticipated demand. Stacks ON TOP of BI per MA G.L. c. 175 § 113L.
   */
  getCoverageLayer(layer: 'BI' | 'UM' | 'UIM'): { amount: number; active: boolean; tone: 'primary' | 'info' | 'warning' | 'success' | 'secondary'; note: string } {
    const c = this.case;
    if (!c) return { amount: 0, active: false, tone: 'secondary', note: 'No case loaded' };

    const biCap   = Number(c.insurancePolicyLimit) || 0;
    const umCap   = Number(c.clientInsuranceUmLimit) || 0;
    const uimCap  = Number(c.clientInsuranceUimLimit) || 0;
    const grossDemand = this.getGrossDemand();

    if (layer === 'BI') {
      const active = biCap > 0;
      return {
        amount: biCap,
        active,
        tone: active ? 'primary' : 'secondary',
        note: active
          ? `${c.insuranceCompany || 'At-fault carrier'} · per-person limit`
          : 'At-fault BI not on file — request via § 112C disclosure',
      };
    }

    if (layer === 'UM') {
      // UM activates when at-fault is uninsured. Heuristic: no BI on file.
      // In production, this should be driven by an explicit "atFaultUninsured"
      // flag once the intake form (P14) collects it.
      const atFaultUninsured = biCap === 0;
      const active = atFaultUninsured && umCap > 0;
      return {
        amount: umCap,
        active,
        tone: active ? 'warning' : 'secondary',
        note: active
          ? 'At-fault appears uninsured — UM is primary recovery'
          : umCap > 0
            ? 'On file but inactive (at-fault has BI coverage)'
            : 'No UM coverage on policy',
      };
    }

    // UIM stacks when BI is exhausted by the anticipated demand.
    const biExhausted = biCap > 0 && grossDemand > biCap;
    const active = biExhausted && uimCap > 0;
    return {
      amount: uimCap,
      active,
      tone: active ? 'success' : 'secondary',
      note: active
        ? `BI exhausted by demand (${this.formatCurrencyCompact(grossDemand)} > ${this.formatCurrencyCompact(biCap)}) — UIM stacks`
        : uimCap > 0
          ? `Available; activates if demand exceeds ${this.formatCurrencyCompact(biCap)} BI cap`
          : 'No UIM coverage on policy',
    };
  }

  /**
   * Theoretical maximum recovery: BI + UIM if stacking applies; else BI;
   * else UM if at-fault is uninsured; else 0. MedPay never stacks against
   * BI for total liability recovery (it's a no-fault collateral source).
   */
  getMaxTheoreticalRecovery(): number {
    const bi  = this.getCoverageLayer('BI');
    const um  = this.getCoverageLayer('UM');
    const uim = this.getCoverageLayer('UIM');

    if (bi.active && uim.active)           return bi.amount + uim.amount;
    if (bi.active)                         return bi.amount;
    if (um.active)                         return um.amount;
    return 0;
  }

  // ============================================
  // P10.c — Liens & Subrogation tracker
  // ============================================

  /** Empty/default form state for the lien modal. */
  private blankLien(): PILien {
    return {
      holder: '',
      type: 'MEDICAL',
      originalAmount: 0,
      negotiatedAmount: undefined,
      status: 'OPEN',
      notes: '',
      assertedDate: new Date().toISOString().split('T')[0],
    };
  }

  /** Initial fetch of liens for the active case. Server also returns effective total. */
  private loadLiens(caseId: number): void {
    this.loadingLiens = true;
    this.lienService.list(caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.liens = response.liens ?? [];
          this.liensEffectiveTotal = response.effectiveTotal ?? 0;
          this.loadingLiens = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('Failed to load liens', err);
          this.liens = [];
          this.liensEffectiveTotal = 0;
          this.loadingLiens = false;
          this.cdr.markForCheck();
        }
      });
  }

  /** Open the modal in "add" mode — blank form. */
  openAddLienModal(): void {
    this.lienForm = this.blankLien();
    this.modalService.open(this.lienModalTpl, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false,
      container: 'body',
      windowClass: 'pi-modal-window',
    });
  }

  /** Open the modal in "edit" mode — clone the row so cancel discards changes cleanly. */
  openEditLienModal(lien: PILien): void {
    this.lienForm = { ...lien };
    this.modalService.open(this.lienModalTpl, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false,
      container: 'body',
      windowClass: 'pi-modal-window',
    });
  }

  /** Submit (POST for new, PUT for edit). Refresh effective total on success. */
  submitLien(modal: any): void {
    if (!this.case?.id) return;
    const numericId = Number(this.case.id);
    if (!Number.isFinite(numericId)) return;
    if (!this.lienForm.holder?.trim() || !this.lienForm.type) return;

    this.lienSaving = true;
    const op$ = this.lienForm.id
      ? this.lienService.update(this.lienForm.id, this.lienForm)
      : this.lienService.create(numericId, this.lienForm);

    op$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.lienSaving = false;
        modal?.close?.();
        // Re-fetch the full list so server-recomputed effectiveTotal stays
        // authoritative (cheaper to refetch than to reproduce the SUM logic
        // client-side, especially with the negotiated || original COALESCE).
        this.loadLiens(numericId);
      },
      error: (err) => {
        this.lienSaving = false;
        console.warn('Failed to save lien', err);
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Delete a lien with confirm. Optimistic remove, restore on error, refetch
   * to recompute effective total. Closing-statement integration relies on
   * this total being current.
   */
  deleteLien(lien: PILien): void {
    if (!lien.id || !this.case?.id) return;
    const id = lien.id;
    const caseId = Number(this.case.id);
    Swal.fire({
      icon: 'warning',
      title: 'Delete this lien?',
      html: `Remove the <strong>${this.formatCurrencyCompact(lien.negotiatedAmount ?? lien.originalAmount ?? 0)}</strong> lien from <strong>${lien.holder}</strong>? The closing statement will recalculate.`,
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#f06548',
    }).then((result) => {
      if (!result.isConfirmed) return;
      const previous = this.liens;
      this.liens = this.liens.filter(x => x.id !== id);
      this.cdr.markForCheck();
      this.lienService.delete(id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => this.loadLiens(caseId),
        error: (err) => {
          console.warn('Failed to delete lien; restoring', err);
          this.liens = previous;
          this.cdr.markForCheck();
        }
      });
    });
  }

  /** Display label for the lien-type enum. Mirrors P9f's label helper. */
  lienTypeLabel(type: PILienType): string {
    switch (type) {
      case 'MEDICAL':    return 'Medical Provider';
      case 'HEALTH_INS': return 'Health Insurance';
      case 'MEDICARE':   return 'Medicare';
      case 'MEDICAID':   return 'Medicaid';
      case 'ATTORNEY':   return 'Prior Attorney';
      case 'OTHER':      return 'Other';
      default:           return type;
    }
  }

  /** Bootstrap badge tone per status. */
  lienStatusToneClass(status: PILienStatus): string {
    switch (status) {
      case 'OPEN':        return 'bg-warning-subtle text-warning';
      case 'NEGOTIATING': return 'bg-info-subtle text-info';
      case 'RESOLVED':    return 'bg-success-subtle text-success';
      default:            return 'bg-secondary-subtle text-secondary';
    }
  }

  /** Negotiation savings per row — original minus negotiated when both set. */
  lienSavings(lien: PILien): number {
    const orig = Number(lien.originalAmount) || 0;
    const neg = Number(lien.negotiatedAmount);
    if (!orig || !Number.isFinite(neg)) return 0;
    return Math.max(0, orig - neg);
  }

  /** Total negotiation savings across all liens. */
  get totalLienSavings(): number {
    return this.liens.reduce((sum, l) => sum + this.lienSavings(l), 0);
  }

  /** Sum of asserted (original) amounts — the worst-case before negotiation. */
  get totalLienAsserted(): number {
    return this.liens.reduce((sum, l) => sum + (Number(l.originalAmount) || 0), 0);
  }

  // ============================================
  // P11.a — Cross-Document Anomalies
  // ============================================

  /** Initial fetch — pure rules-based, no AI, returns immediately. */
  private loadDocumentAnomalies(caseId: number): void {
    this.loadingAnomalies = true;
    this.medicalSummaryService.getDocumentAnomalies(caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (anomalies) => {
          this.documentAnomalies = anomalies ?? [];
          this.loadingAnomalies = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('Failed to load anomalies', err);
          this.documentAnomalies = [];
          this.loadingAnomalies = false;
          this.cdr.markForCheck();
        }
      });
  }

  /** Counts grouped by severity for the section trail badge. */
  get anomalyHighCount(): number {
    return this.documentAnomalies.filter(a => a.severity === 'HIGH').length;
  }
  get anomalyMediumCount(): number {
    return this.documentAnomalies.filter(a => a.severity === 'MEDIUM').length;
  }
  get anomalyLowCount(): number {
    return this.documentAnomalies.filter(a => a.severity === 'LOW').length;
  }

  /** Severity-tone mapping — used for icon background and chip class. */
  anomalySeverityClass(severity: 'HIGH' | 'MEDIUM' | 'LOW'): string {
    switch (severity) {
      case 'HIGH':   return 'tone-danger';
      case 'MEDIUM': return 'tone-warning';
      case 'LOW':    return 'tone-info';
      default:       return 'tone-secondary';
    }
  }

  /** Severity badge class for the chip. */
  anomalySeverityBadge(severity: 'HIGH' | 'MEDIUM' | 'LOW'): string {
    switch (severity) {
      case 'HIGH':   return 'bg-danger-subtle text-danger';
      case 'MEDIUM': return 'bg-warning-subtle text-warning';
      case 'LOW':    return 'bg-info-subtle text-info';
      default:       return 'bg-secondary-subtle text-secondary';
    }
  }

  // ============================================
  // P12.b — Case Timeline (aggregated event view)
  // ============================================

  /**
   * Unified timeline of case events — aggregates already-loaded data so
   * we don't pay another network round-trip. Sorted ascending (oldest first)
   * to read like a story; `caseTimelineRecent` flips to descending for the
   * "recent activity" panel. Each event is shaped:
   *   { id, kind, date, title, detail, tone, icon }.
   *
   * The existing standalone `app-timeline-view` component is keyed on
   * `analysisId` (action-item flow), not `caseId`, so embedding it here would
   * render the wrong data. This getter is the case-keyed equivalent.
   */
  get caseTimelineEvents(): Array<{
    id: string;
    kind: 'incident' | 'medical' | 'settlement' | 'communication' | 'activity' | 'milestone';
    date: string;
    title: string;
    detail?: string;
    tone: 'primary' | 'info' | 'warning' | 'success' | 'danger' | 'secondary';
    icon: string;
  }> {
    const events: Array<any> = [];

    // 1. Date of loss — anchor event
    if (this.case?.injuryDate) {
      events.push({
        id: 'incident',
        kind: 'incident',
        date: String(this.case.injuryDate),
        title: 'Date of loss',
        detail: this.case.injuryDescription || this.case.injuryType || '',
        tone: 'danger',
        icon: 'ri-error-warning-line',
      });
    }

    // 2. Medical record events — one per treatment_date
    for (const r of (this.medicalRecords || []) as any[]) {
      if (!r.treatmentDate) continue;
      events.push({
        id: `record-${r.id}`,
        kind: 'medical',
        date: String(r.treatmentDate),
        title: r.providerName || 'Medical record',
        detail: [r.recordType, r.keyFindings].filter(Boolean).slice(0, 1).join(' · '),
        tone: 'info',
        icon: 'ri-stethoscope-line',
      });
    }

    // 3. Settlement events
    for (const e of this.settlementEvents || []) {
      const date = e.eventDate || e.createdAt;
      if (!date) continue;
      const kind = this.getEventKind(e);
      events.push({
        id: `settlement-${e.id}`,
        kind: 'settlement',
        date: String(date),
        title: kind.label,
        detail: e.notes || '',
        tone: kind.tone as any,
        icon: kind.icon,
      });
    }

    // 4. Communications log entries
    for (const c of this.communications || []) {
      const date = c.eventDate || c.createdAt;
      if (!date) continue;
      const kind = this.getCommKind(c);
      events.push({
        id: `comm-${c.id}`,
        kind: 'communication',
        date: String(date),
        title: `${kind.label}${c.counterparty ? ' · ' + c.counterparty : ''}`,
        detail: c.subject || c.summary || '',
        tone: kind.tone as any,
        icon: kind.icon,
      });
    }

    // 5. Settlement disposition (if case is settled)
    if (this.isSettled && this.case?.settlementDate && this.case?.settlementFinalAmount) {
      events.push({
        id: 'final-disposition',
        kind: 'milestone',
        date: String(this.case.settlementDate),
        title: 'Case settled',
        detail: `Final amount: ${this.formatCurrency(Number(this.case.settlementFinalAmount))}`,
        tone: 'success',
        icon: 'ri-shield-check-line',
      });
    }

    // Sort ascending (oldest → newest) for the chronological reading.
    return events.sort((a, b) => {
      const at = new Date(a.date).getTime() || 0;
      const bt = new Date(b.date).getTime() || 0;
      return at - bt;
    });
  }

  /** Recent-first slice for compact panels — top 8 by default. */
  caseTimelineRecent(limit: number = 8): typeof this.caseTimelineEvents {
    return [...this.caseTimelineEvents].reverse().slice(0, limit);
  }

  /** Group events by month-year heading for the visual timeline rail. */
  get caseTimelineByMonth(): Array<{ heading: string; events: typeof this.caseTimelineEvents }> {
    const events = this.caseTimelineEvents;
    if (events.length === 0) return [];
    const groups = new Map<string, typeof events>();
    for (const e of events) {
      const d = new Date(e.date);
      if (isNaN(d.getTime())) continue;
      const heading = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
      if (!groups.has(heading)) groups.set(heading, [] as any);
      groups.get(heading)!.push(e);
    }
    return Array.from(groups.entries()).map(([heading, events]) => ({ heading, events }));
  }

  // ============================================
  // P12.c — Records Requests log
  // ============================================

  /** Load past outbound requests for the audit log. */
  private loadRequestHistory(caseId: number): void {
    this.loadingRequestHistory = true;
    this.documentRequestService.getCaseRequestHistory(caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (history) => {
          this.requestHistory = history ?? [];
          this.loadingRequestHistory = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('Failed to load request history', err);
          this.requestHistory = [];
          this.loadingRequestHistory = false;
          this.cdr.markForCheck();
        }
      });
  }

  /** Load the AI-generated documents checklist (drives bulk-send). */
  private loadDocumentChecklist(caseId: number): void {
    this.loadingChecklist = true;
    this.documentChecklistService.getChecklistByCaseId(caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (checklist) => {
          this.documentChecklist = checklist ?? [];
          this.loadingChecklist = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('Failed to load document checklist', err);
          this.documentChecklist = [];
          this.loadingChecklist = false;
          this.cdr.markForCheck();
        }
      });
  }

  /** Items not yet received — these are the candidates for bulk send. */
  get pendingChecklist(): PIDocumentChecklist[] {
    return this.documentChecklist.filter(item => !item.received);
  }

  /** Selected IDs as a plain array — Sets aren't directly bindable, so we expose this for the wizard input. */
  get selectedChecklistIdsArray(): number[] {
    return Array.from(this.selectedChecklistIds);
  }

  /** Numeric case id for template bindings — saves repeating `+case.id!` casts. */
  get numericCaseId(): number {
    return Number(this.case?.id) || 0;
  }

  toggleChecklistSelection(itemId: number | undefined): void {
    if (itemId == null) return;
    if (this.selectedChecklistIds.has(itemId)) {
      this.selectedChecklistIds.delete(itemId);
    } else {
      this.selectedChecklistIds.add(itemId);
    }
  }

  selectAllPendingChecklist(): void {
    for (const item of this.pendingChecklist) {
      if (item.id != null) this.selectedChecklistIds.add(item.id);
    }
  }

  clearChecklistSelection(): void {
    this.selectedChecklistIds.clear();
  }

  /** Open the BulkRequestWizard modal with currently-selected checklist items. */
  openBulkRequestWizard(): void {
    if (this.selectedChecklistIds.size === 0) {
      Swal.fire({
        icon: 'info',
        title: 'No items selected',
        text: 'Pick at least one pending checklist item to send a records request.',
        timer: 2400,
        showConfirmButton: false,
      });
      return;
    }
    this.bulkWizardOpen = true;
    const ref = this.modalService.open(this.bulkRequestModalTpl, {
      size: 'xl',
      backdrop: 'static',
      keyboard: false,
      container: 'body',
      windowClass: 'pi-modal-window',
    });
    ref.closed.subscribe(() => {
      this.bulkWizardOpen = false;
      // Re-fetch both streams after the wizard closes — items may have flipped to "requested"
      // and a new request log entry should appear in the history.
      if (this.case?.id) {
        const numericId = Number(this.case.id);
        this.loadRequestHistory(numericId);
        this.loadDocumentChecklist(numericId);
      }
      this.selectedChecklistIds.clear();
    });
    ref.dismissed.subscribe(() => {
      this.bulkWizardOpen = false;
      this.selectedChecklistIds.clear();
    });
  }

  /** Wizard completion handler — close modal + refresh data. */
  onBulkWizardCompleted(modal: any): void {
    if (this.case?.id) {
      const numericId = Number(this.case.id);
      Swal.fire({
        icon: 'success',
        title: 'Requests sent',
        text: 'Outbound requests dispatched. Check the request history below.',
        timer: 2200,
        showConfirmButton: false,
      });
    }
    modal?.close?.();
  }

  /** Wizard cancel handler — just close. */
  onBulkWizardCancelled(modal: any): void {
    modal?.dismiss?.();
  }

  /** Tone class for a request log row's channel status. */
  requestStatusBadge(status: string | undefined): string {
    return `bg-${this.documentRequestService.getChannelStatusColor(status || '')}-subtle text-${this.documentRequestService.getChannelStatusColor(status || '')}`;
  }

  /** Template wrapper — delegates to the (private) request service so AOT can bind to it. */
  getChannelIcon(channel: string | undefined): string {
    return this.documentRequestService.getChannelIcon(channel || '');
  }

  /** Template wrapper — see getChannelIcon. */
  getChannelLabel(channel: string | undefined): string {
    return this.documentRequestService.getChannelLabel(channel || '');
  }

  // ============================================
  // P12.b — Case Timeline (aggregated event view)
  // ============================================

  /** Toggle sort direction when same column re-clicked, else switch column + reset to asc/desc per type. */
  toggleChronologySort(key: 'date' | 'provider' | 'type' | 'charges'): void {
    if (this.chronologySortKey === key) {
      this.chronologySortDir = this.chronologySortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.chronologySortKey = key;
      // Date defaults to descending (newest first); strings/charges default to asc.
      this.chronologySortDir = key === 'date' || key === 'charges' ? 'desc' : 'asc';
    }
  }

  /** Caret icon for the active sort column header. Returns empty for inactive columns. */
  chronologySortCaret(key: 'date' | 'provider' | 'type' | 'charges'): string {
    if (this.chronologySortKey !== key) return 'ri-arrow-up-down-line text-muted';
    return this.chronologySortDir === 'asc' ? 'ri-arrow-up-line' : 'ri-arrow-down-line';
  }

  /**
   * Sorted view of medicalRecords for the Chronology table. Pure getter so it
   * recomputes whenever sort key/direction changes. Records[] is small (typically
   * <100 entries even for heavy treatment cases), so we don't memoize.
   */
  get sortedChronology(): PIMedicalRecord[] {
    const records = this.medicalRecords || [];
    if (records.length === 0) return [];

    const dir = this.chronologySortDir === 'asc' ? 1 : -1;
    const key = this.chronologySortKey;

    return [...records].sort((a: any, b: any) => {
      let av: any;
      let bv: any;
      switch (key) {
        case 'date':
          av = a.treatmentDate ? new Date(a.treatmentDate).getTime() : 0;
          bv = b.treatmentDate ? new Date(b.treatmentDate).getTime() : 0;
          return (av - bv) * dir;
        case 'provider':
          av = (a.providerName || '').toLowerCase();
          bv = (b.providerName || '').toLowerCase();
          return av.localeCompare(bv) * dir;
        case 'type':
          av = (a.recordType || '').toLowerCase();
          bv = (b.recordType || '').toLowerCase();
          return av.localeCompare(bv) * dir;
        case 'charges':
          av = Number(a.billedAmount ?? 0);
          bv = Number(b.billedAmount ?? 0);
          return (av - bv) * dir;
      }
    });
  }

  /** Icon per anomaly type for the marker. */
  anomalyTypeIcon(type: string): string {
    switch (type) {
      case 'PRE_DOL_TREATMENT':  return 'ri-time-line';
      case 'MISSING_DOL':        return 'ri-calendar-event-line';
      case 'INVERTED_DATES':     return 'ri-swap-line';
      case 'FUTURE_DATED':       return 'ri-calendar-2-line';
      case 'FAILED_SCAN':        return 'ri-error-warning-line';
      case 'INCOMPLETE_RECORDS': return 'ri-file-warning-line';
      case 'TREATMENT_GAP':      return 'ri-pause-circle-line';
      case 'NON_MEDICAL_VOLUME': return 'ri-folder-warning-line';
      default:                   return 'ri-alert-line';
    }
  }

  // ============================================
  // P11.d — Risk Register
  // ============================================

  /** Load saved register on mount (no AI call). */
  private loadRiskRegister(caseId: number): void {
    this.loadingRiskRegister = true;
    this.medicalSummaryService.getSavedRiskRegister(caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (register) => {
          this.riskRegister = register;
          this.loadingRiskRegister = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.riskRegister = null;
          this.loadingRiskRegister = false;
          this.cdr.markForCheck();
        }
      });
  }

  /** On-demand AI generation. ~5–10s typical. */
  generateRiskRegister(): void {
    if (!this.case?.id) return;
    if (!this.medicalSummary) {
      Swal.fire({
        icon: 'warning',
        title: 'Generate medical summary first',
        text: 'The risk register builds on the chronology + causation. Generate the medical summary, then come back here.',
      });
      return;
    }
    const numericId = Number(this.case.id);
    this.generatingRiskRegister = true;
    this.cdr.markForCheck();
    this.medicalSummaryService.generateRiskRegister(numericId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (register) => {
          this.riskRegister = register;
          this.generatingRiskRegister = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.generatingRiskRegister = false;
          this.cdr.markForCheck();
          Swal.fire({
            icon: 'error',
            title: 'Failed to generate risk register',
            text: err?.error?.message || err?.message || 'AI generation failed — please retry.',
          });
        }
      });
  }

  /** Score for a tier — preSuit uses likelihood, suit/trial use risk. */
  riskTierScore(tier: PIRiskTier | undefined): number {
    if (!tier) return 0;
    return Number(tier.likelihood ?? tier.risk ?? 0);
  }

  /**
   * Tone class per tier — preSuit higher = better (green); suit/trial higher = worse (red).
   * The label reflects the underlying scoring direction so we can pick from it.
   */
  riskTierTone(tier: PIRiskTier | undefined, kind: 'preSuit' | 'suit' | 'trial'): string {
    const score = this.riskTierScore(tier);
    if (kind === 'preSuit') {
      // higher likelihood = better
      if (score >= 70) return 'tone-success';
      if (score >= 45) return 'tone-warning';
      return 'tone-danger';
    }
    // suit/trial: higher risk = worse
    if (score >= 70) return 'tone-danger';
    if (score >= 45) return 'tone-warning';
    return 'tone-success';
  }

  /** Score-direction label for the tile header — explains what the number means. */
  riskTierMeaning(kind: 'preSuit' | 'suit' | 'trial'): string {
    switch (kind) {
      case 'preSuit': return 'Settlement likelihood';
      case 'suit':    return 'Litigation risk';
      case 'trial':   return 'Verdict risk';
    }
  }

  /** Icon for + / - factor impact. */
  riskFactorIcon(impact: '+' | '-'): string {
    return impact === '+' ? 'ri-arrow-up-line' : 'ri-arrow-down-line';
  }
  riskFactorTone(impact: '+' | '-'): string {
    return impact === '+' ? 'text-success' : 'text-danger';
  }

  // ============================================
  // P10.d — Damage Elements
  // ============================================

  private blankDamageElement(): PIDamageElement {
    return {
      elementType: 'PAST_MEDICAL',
      elementName: '',
      calculatedAmount: 0,
      confidenceLevel: 'MEDIUM',
      sourceDate: new Date().toISOString().split('T')[0],
    };
  }

  /** Initial fetch — uses existing /api/pi/cases/{id}/damages/elements endpoint. */
  private loadDamageElements(caseId: number): void {
    this.loadingDamageElements = true;
    this.damageElementService.list(caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (elements) => {
          this.damageElements = (elements || []).slice().sort((a, b) =>
            (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
          this.loadingDamageElements = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('Failed to load damage elements', err);
          this.damageElements = [];
          this.loadingDamageElements = false;
          this.cdr.markForCheck();
        }
      });
  }

  openAddDamageElementModal(typeHint?: PIDamageElementType): void {
    this.damageElementForm = this.blankDamageElement();
    if (typeHint) this.damageElementForm.elementType = typeHint;
    this.modalService.open(this.damageElementModalTpl, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false,
      container: 'body',
      windowClass: 'pi-modal-window',
    });
  }

  openEditDamageElementModal(element: PIDamageElement): void {
    this.damageElementForm = { ...element };
    this.modalService.open(this.damageElementModalTpl, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false,
      container: 'body',
      windowClass: 'pi-modal-window',
    });
  }

  submitDamageElement(modal: any): void {
    if (!this.case?.id) return;
    const numericId = Number(this.case.id);
    if (!Number.isFinite(numericId)) return;
    if (!this.damageElementForm.elementName?.trim()) return;

    this.damageElementSaving = true;
    const op$ = this.damageElementForm.id
      ? this.damageElementService.update(numericId, this.damageElementForm.id, this.damageElementForm)
      : this.damageElementService.create(numericId, this.damageElementForm);

    op$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.damageElementSaving = false;
        modal?.close?.();
        this.loadDamageElements(numericId);
      },
      error: (err) => {
        this.damageElementSaving = false;
        console.warn('Failed to save damage element', err);
        this.cdr.markForCheck();
      }
    });
  }

  deleteDamageElement(element: PIDamageElement): void {
    if (!element.id || !this.case?.id) return;
    const id = element.id;
    const caseId = Number(this.case.id);
    Swal.fire({
      icon: 'warning',
      title: 'Delete this damage element?',
      html: `Remove <strong>${element.elementName}</strong> (${this.formatCurrency(element.calculatedAmount)})?`,
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#f06548',
    }).then((result) => {
      if (!result.isConfirmed) return;
      const previous = this.damageElements;
      this.damageElements = this.damageElements.filter(x => x.id !== id);
      this.cdr.markForCheck();
      this.damageElementService.delete(caseId, id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => this.loadDamageElements(caseId),
        error: (err) => {
          console.warn('Failed to delete damage element; restoring', err);
          this.damageElements = previous;
          this.cdr.markForCheck();
        }
      });
    });
  }

  /**
   * "Sync from medical records" — backend creates / refreshes a single
   * PAST_MEDICAL element from the sum of medical records. Used as a quick-
   * start for cases where the medical chart is already populated.
   */
  syncMedicalToDamages(): void {
    if (!this.case?.id) return;
    const numericId = Number(this.case.id);
    this.damageElementSyncing = true;
    this.damageElementService.syncMedical(numericId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (element) => {
          this.damageElementSyncing = false;
          this.loadDamageElements(numericId);
          // Backend returns null when there are no medical records to sum
          // (or sum is $0). Show a different toast so the attorney isn't
          // left thinking a sync happened when nothing was available.
          if (element == null) {
            Swal.fire({
              icon: 'info', title: 'No medical records to sync',
              text: 'No medical-record charges on file. Add records first, or enter a Past Medical element manually.',
              timer: 2400, showConfirmButton: false,
            });
            return;
          }
          Swal.fire({
            icon: 'success', title: 'Medical specials synced',
            text: 'Past Medical element refreshed from medical records.',
            timer: 1800, showConfirmButton: false,
          });
        },
        error: (err) => {
          this.damageElementSyncing = false;
          this.cdr.markForCheck();
          console.warn('Failed to sync medical', err);
        }
      });
  }

  damageElementTypeLabel(type: PIDamageElementType): string {
    switch (type) {
      case 'PAST_MEDICAL':       return 'Past Medical';
      case 'FUTURE_MEDICAL':     return 'Future Medical';
      case 'LOST_WAGES':         return 'Lost Wages';
      case 'EARNING_CAPACITY':   return 'Lost Earning Capacity';
      case 'HOUSEHOLD_SERVICES': return 'Household Services';
      case 'PAIN_SUFFERING':     return 'Pain & Suffering';
      case 'MILEAGE':            return 'Mileage';
      case 'OTHER':              return 'Other';
      default:                   return type;
    }
  }

  /** Tone-class for the type chip — economic = primary, non-economic = warning, other = secondary. */
  damageElementTypeTone(type: PIDamageElementType): string {
    switch (type) {
      case 'PAST_MEDICAL':
      case 'FUTURE_MEDICAL':
      case 'LOST_WAGES':
      case 'EARNING_CAPACITY':
      case 'MILEAGE':
        return 'bg-primary-subtle text-primary';
      case 'PAIN_SUFFERING':
      case 'HOUSEHOLD_SERVICES':
        return 'bg-warning-subtle text-warning';
      default:
        return 'bg-secondary-subtle text-secondary';
    }
  }

  get totalDamageElements(): number {
    return this.damageElements.reduce((sum, e) => sum + (Number(e.calculatedAmount) || 0), 0);
  }

  /** Group elements by type for the per-category subtotals row. */
  get damageElementSubtotals(): { type: PIDamageElementType; label: string; total: number }[] {
    const types: PIDamageElementType[] = [
      'PAST_MEDICAL', 'FUTURE_MEDICAL', 'LOST_WAGES', 'EARNING_CAPACITY',
      'HOUSEHOLD_SERVICES', 'PAIN_SUFFERING', 'MILEAGE', 'OTHER'
    ];
    return types
      .map(t => ({
        type: t,
        label: this.damageElementTypeLabel(t),
        total: this.damageElements
          .filter(e => e.elementType === t)
          .reduce((sum, e) => sum + (Number(e.calculatedAmount) || 0), 0),
      }))
      .filter(row => row.total > 0);
  }

  /** Triggered by the calculator inputs — debounced save fires 600ms later. */
  onDamageInputChange(): void {
    this.damageInputs$.next();
  }

  /**
   * Persist the current scenario. Called by the debounced subject in ngOnInit
   * so input changes coalesce. Soft-fails so an offline blip doesn't disrupt
   * the calculator UX — the next save will retry.
   */
  saveDamageScenario(): void {
    if (!this.case?.id || !this.medicalSummary) {
      // No summary yet → nothing to attach the scenario to. Skip silently;
      // the user sees the live numbers either way.
      return;
    }
    const numericId = Number(this.case.id);
    if (!Number.isFinite(numericId)) return;

    this.damageSaving = true;
    this.cdr.markForCheck();

    this.medicalSummaryService.updateDemandScenario(numericId, this.damageScenario)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (summary: PIMedicalSummary) => {
          this.damageSaving = false;
          this.damageSavedAt = summary?.demandScenario?.savedAt ?? new Date().toISOString();
          // Keep the local medicalSummary in sync so reload doesn't clobber edits.
          if (this.medicalSummary) {
            this.medicalSummary.demandScenario = summary?.demandScenario ?? this.damageScenario;
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.damageSaving = false;
          console.warn('Failed to save demand scenario', err);
          this.cdr.markForCheck();
        }
      });
  }

  /** Used by the hero KPI strip — matches the Damages tab numbers exactly. */
  estimateLikelyDemand(): number {
    return this.getGrossDemand();
  }

  /** Range for hero KPI hint — uses the same conservative/strong endpoints. */
  estimateDemandRange(): { low: number; high: number } | null {
    if (this.getSpecialsTotal() <= 0) return null;
    return {
      low:  this.getGrossDemand(2.0),
      high: this.getGrossDemand(4.0),
    };
  }

  /** Used by the hero KPI strip — same fee/cost/lien math as the Damages tab. */
  private estimateNetToClient(): number {
    return this.getNetToClient();
  }

  // ============================================
  // Next Milestone — purple callout below stage track
  // ============================================

  /**
   * Returns a short "what's next" panel based on current stage. The body string
   * may contain inline `<span class="nm-target">` markup for the target-date emphasis.
   */
  getNextMilestone(): NextMilestone | null {
    const stage = this.case?.stage;
    if (!stage) return null;

    const targetDays = 14; // generic target window; P5 derives from actual blockers
    const target = new Date();
    target.setDate(target.getDate() + targetDays);
    const targetStr = this.formatShortDate(target);

    switch (stage) {
      case 'INTAKE':
        return {
          title: 'Complete Intake',
          body: `Confirm client identity, mechanism of injury, ER on DOL, and police report. Target completion: <span class="nm-target">${targetStr}</span> (${targetDays} days).`,
        };
      case 'INVESTIGATION':
        return {
          title: 'Open Treatment Plan',
          body: `Confirm provider list, request initial records, and verify PIP coverage. Target: <span class="nm-target">${targetStr}</span> (${targetDays} days).`,
        };
      case 'TREATMENT':
        return {
          title: 'Wait for MMI / Discharge',
          body: `Monitor treatment chronology. Move to Pre-Demand once final discharge note or MMI determination is on file.`,
        };
      case 'PRE_DEMAND':
        return {
          title: 'Send Demand Letter',
          body: `Resolve critical-path blockers below, then issue demand. Target send date: <span class="nm-target">${targetStr}</span> (${targetDays} days).`,
        };
      case 'DEMAND_SENT':
        return {
          title: 'Track Adjuster Response',
          body: `Demand sent — awaiting carrier response. Standard window: 30–45 days. Log the offer once received.`,
        };
      case 'NEGOTIATION':
        return {
          title: 'Counter / Settle',
          body: `Review last offer against case value range. Counter or accept; document the decision in the negotiation log.`,
        };
      case 'SETTLED':
        return {
          title: 'Wrap Up',
          body: `Settlement reached. Disburse funds, satisfy liens, close file.`,
        };
      default:
        return null;
    }
  }

  // ============================================
  // Critical Path
  // ============================================

  /**
   * P5.1 — returns critical-path blockers from `pi_medical_summaries.openItems`.
   * Sorted HIGH → MEDIUM → LOW so the most urgent rises to the top of the card.
   * Each OpenItem is rendered as a CritItem with the human-readable type label.
   *
   * Returns empty array when no summary is loaded yet — UI shows empty state.
   */
  getCriticalPathItems(): CritItem[] {
    const items = this.medicalSummary?.openItems;
    if (!items || items.length === 0) return [];

    const order: Record<CritPriority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return [...items]
      .sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9))
      .map((item, idx) => this.openItemToCritItem(item, idx));
  }

  private openItemToCritItem(item: OpenItem, idx: number): CritItem {
    return {
      id: `oi-${idx}-${item.type}`,
      title: formatOpenItemType(item.type),
      detail: item.description || '',
      priority: item.priority,
    };
  }

  /** CSS class for the priority pill on a critical-path item. */
  getPriorityClass(priority: CritPriority): string {
    switch (priority) {
      case 'HIGH':   return 'pri-high';
      case 'MEDIUM': return 'pri-med';
      case 'LOW':    return 'pri-low';
      default:       return 'pri-low';
    }
  }

  /**
   * Strategy Snapshot causation excerpt — first 1-2 sentences of the causation
   * summary for the right-rail panel. Returns empty string if no summary yet.
   */
  getCausationExcerpt(): string {
    return sharedCausationExcerpt(this.medicalSummary?.causationSummary);
  }

  /** Click handler for a critical-path item action link. Delegates to the
   *  shared label-dispatcher so we don't duplicate the keyword routing. */
  onCritAction(_item: CritItem, action: CritAction): void {
    this.onStageQuickAction(action.label);
  }

  // ============================================
  // Number formatting
  // ============================================

  formatCurrency(n: number): string {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }

  /** $1,200 → $1.2k, $12,500,000 → $12.5M  — tighter for KPI tiles. */
  formatCurrencyCompact(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
    return `$${Math.round(n)}`;
  }

  formatShortDate(d?: any): string {
    if (!d) return '';
    const date = new Date(d);
    return isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /**
   * Relative-time helper for the "Saved {{...}}" indicator on the calculator.
   * Shows "just now" / "Xm ago" / "Xh ago" / "Apr 29 3:42 PM" depending on age,
   * so attorneys see immediate feedback that their last edit persisted.
   */
  formatSavedTime(iso?: string | Date | null): string {
    if (!iso) return '';
    const date = iso instanceof Date ? iso : new Date(iso);
    const then = date.getTime();
    if (isNaN(then)) return '';
    const diffSec = Math.floor((Date.now() - then) / 1000);
    if (diffSec < 5)     return 'just now';
    if (diffSec < 60)    return `${diffSec}s ago`;
    if (diffSec < 3600)  return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return date.toLocaleDateString(undefined, {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  }

  // ============================================
  // Quick-action handlers
  // ============================================

  quickAction(
    key: 'logCall' | 'addNote' | 'requestRecord' | 'logOffer'
       | 'addParty' | 'uploadDoc' | 'generateRequest'
  ): void {
    if (key === 'addNote') {
      // P6 — open the inline form on the Overview tab and scroll to it.
      this.activeTab = 'overview';
      this.showAddNoteForm = true;
      this.cdr.markForCheck();
      // Defer scroll so the *ngIf has materialized the form in the DOM.
      setTimeout(() => {
        document.getElementById('pi-add-note-anchor')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
      return;
    }

    if (key === 'addParty') {
      // Navigate the user into the Parties section so they see the result of
      // the create, then open the modal.
      this.activeTab = 'caseFile';
      this.setCaseFileSection('parties');
      this.cdr.markForCheck();
      // Defer the modal open by a tick so the section materializes underneath.
      setTimeout(() => this.openAddPartyModal(), 60);
      return;
    }

    if (key === 'uploadDoc') {
      // Route the user into the Documents section; upload zone wires in a
      // follow-up batch (the docs grid currently renders mock data).
      this.activeTab = 'caseFile';
      this.setCaseFileSection('docs');
      this.cdr.markForCheck();
      return;
    }

    if (key === 'generateRequest') {
      // BulkRequestWizard already exists and is wired via openBulkRequestWizard().
      this.openBulkRequestWizard();
      return;
    }

    if (key === 'logCall') {
      // Wire to the existing Log Communication modal preset to CALL/OUT.
      this.newCommunication = {
        ...this.blankCommunication(),
        type: 'CALL',
        direction: 'OUT',
      } as PICommunication;
      this.modalService.open(this.logCommModalTpl, {
        size: 'lg', backdrop: 'static', keyboard: false, container: 'body',
        windowClass: 'pi-modal-window',
      });
      return;
    }

    if (key === 'requestRecord') {
      // Same destination as the sidebar Generate request quick-action.
      this.openBulkRequestWizard();
      return;
    }

    if (key === 'logOffer') {
      // Settlement offers are inbound emails/calls from the adjuster — surface
      // as a Log Communication preset so the activity timeline + comm health
      // both pick it up.
      this.newCommunication = {
        ...this.blankCommunication(),
        type: 'EMAIL',
        direction: 'IN',
        summary: 'Settlement offer received — ',
      } as PICommunication;
      this.modalService.open(this.logCommModalTpl, {
        size: 'lg', backdrop: 'static', keyboard: false, container: 'body',
        windowClass: 'pi-modal-window',
      });
      return;
    }
  }

  // ============================================
  // Tab change — small hook for future analytics
  // ============================================

  onTabChange(_id: string): void {
    // P5 may wire lazy data fetches here per tab
  }

  // ============================================
  // Header dropdown actions
  // ============================================

  switchToLegacyView(): void {
    if (!this.case?.id) return;
    sessionStorage.setItem(`legacyCaseView:${this.case.id}`, '1');
    this.router.navigate(['/legal/cases', this.case.id], { skipLocationChange: false })
      .then(() => window.location.reload());
  }

  resetStageToAuto(): void {
    if (!this.case?.id) return;
    Swal.fire({
      title: 'Reset stage to auto-derive?',
      text: 'The stage will be re-computed from medical records and settlement events. Your current manual stage will be overwritten.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0ab39c',
      confirmButtonText: 'Yes, reset to auto'
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.caseService.patchCase(this.case!.id as any, { stageManuallySet: false } as any)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response: any) => {
            const updated = response?.data?.case ?? response?.case ?? response;
            this.case = { ...this.case, ...updated } as LegalCase;
            this.cdr.markForCheck();
            Swal.fire('Reset', 'Stage will now auto-derive from case data.', 'success');
          },
          error: (err) => {
            const reason = err?.error?.message || err?.message || 'Failed to reset stage';
            Swal.fire('Error', reason, 'error');
          }
        });
    });
  }

  /**
   * Browser-native print of the entire case detail page. Attorneys use this
   * to drop a paper copy of the case overview into the physical file.
   * Uses window.print() rather than a custom PDF export — the page already
   * has print-friendly styling via the existing global @media print rules.
   */
  printCase(): void {
    window.print();
  }

  /**
   * Hand off to LegiDraft for brief / strategy memo drafting. Briefs live in
   * the AI Workspace's drafting wizard (legal_memo doc-type), not in this
   * component — see openLegiDraft above and the LegiDraft handoff comment.
   */
  draftBrief(): void {
    this.openLegiDraft('legal_memo');
  }

  // ============================================
  // LegiDraft handoff (replaces P5.5 demand-letter + P9d brief modals)
  //
  // Rather than duplicate AI-doc-generation in this component, the Negotiation
  // tab cards route attorneys to /legal/ai-assistant (LegiDraft). LegiDraft
  // owns prompt-building, generation, preview, and saving via its drafting
  // wizard + AI Workspace pipeline. The doc-type catalog (`demand_letter_pi`,
  // `legal_memo`, etc.) lives at backend/src/main/resources/templates/document-types/.
  // ============================================

  /**
   * Navigate directly to LegiDraft's drafting wizard with the current case
   * + an optional document type pre-selected. The deep-link target is
   *   /legal/ai-assistant/legispace/legidraft?caseId=<id>&docType=<slug>&autoStart=1
   * which:
   *   1. lands on the LegiDraft tab (matched by `legispaceWorkspaceMatcher`),
   *   2. pre-fills `selectedCaseId` from `caseId` (existing query-param hook),
   *   3. flips the workspace into wizard mode via `autoStart=1`,
   *   4. forwards `docType` into the wizard so it pre-selects the matching
   *      catalog entry and jumps to the Review step (DraftWizardComponent's
   *      `tryAutoAdvanceFromInitialState`).
   *
   * Without `docType`, the user lands on the wizard at Step 1 with PA +
   * jurisdiction already inherited from the case (still better than the old
   * dashboard route).
   */
  openLegiDraft(docType?: string): void {
    const queryParams: Record<string, any> = { autoStart: 1 };
    if (this.case?.id) queryParams['caseId'] = this.case.id;
    if (docType) queryParams['docType'] = docType;
    this.router.navigate(['/legal/ai-assistant/legispace/legidraft'], { queryParams });
  }

  /**
   * Mark the demand as sent — creates a settlement event so the timeline
   * picks it up + advances the case stage to DEMAND_SENT (auto-derived
   * server-side once the event is logged).
   *
   * Pre-LegiDraft-handoff this lived inside the demand-letter modal. Now
   * that drafting happens in LegiDraft, the attorney returns to this page
   * and clicks the "Mark Demand Sent" button to record the send-event.
   */
  markDemandSent(): void {
    if (!this.case?.id) return;
    const numericId = Number(this.case.id);
    if (!Number.isFinite(numericId)) return;

    const grossDemand = this.getGrossDemand();
    Swal.fire({
      icon: 'question',
      title: 'Mark demand as sent?',
      html: `Records a settlement event with demand <strong>${this.formatCurrency(grossDemand)}</strong> on <strong>${this.formatShortDate(new Date())}</strong> and advances the case stage to Demand Sent.`,
      showCancelButton: true,
      confirmButtonText: 'Mark sent',
      confirmButtonColor: '#0ab39c',
    }).then((result) => {
      if (!result.isConfirmed) return;

      const event: PISettlementEvent = {
        eventDate: new Date().toISOString().substring(0, 10),
        demandAmount: grossDemand,
        notes: 'Demand letter sent (drafted in LegiDraft).',
      };

      this.settlementService.createEvent(numericId, event)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (created) => {
            this.settlementEvents = [created, ...this.settlementEvents];
            this.buildSettlementChartOptions();
            this.cdr.markForCheck();
            Swal.fire({
              icon: 'success',
              title: 'Demand Recorded',
              text: 'Settlement event added. Case stage will auto-advance to Demand Sent.',
              timer: 2500,
              showConfirmButton: false,
            });
            // Re-fetch the case so the hero stage pill, KPI strip, and pipeline
            // visualizer reflect the auto-derived advance to DEMAND_SENT immediately.
            this.refreshCase(numericId);
          },
          error: (err) => {
            Swal.fire({
              icon: 'error',
              title: 'Failed to Record',
              text: err?.error?.message || 'Could not save the settlement event.',
            });
          }
        });
    });
  }

  // ============================================
  // P5.5 — Settlement event timeline helpers
  // ============================================

  // ============================================
  // P9e — Communications Log helpers
  // ============================================

  /**
   * Empty/default form state for the "Log Communication" modal. Defaults to
   * a CALL going OUT today — matches the most common attorney workflow
   * (calling out to the adjuster) so 80% of the time the user only fills
   * counterparty + summary and submits.
   */
  private blankCommunication(): PICommunication {
    return {
      type: 'CALL',
      direction: 'OUT',
      counterparty: '',
      subject: '',
      summary: '',
      eventDate: this.toLocalIsoNow(),
    };
  }

  /**
   * Now in `YYYY-MM-DDTHH:mm` (minutes precision, no seconds) — matches what
   * `<input type="datetime-local">` emits after user edits, so the round-trip
   * is consistent. Backend DTO pattern is set to match.
   */
  private toLocalIsoNow(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  /** Initial fetch of communications for the active case. */
  private loadCommunications(caseId: number): void {
    this.loadingCommunications = true;
    this.communicationService.list(caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (entries) => {
          this.communications = entries ?? [];
          this.loadingCommunications = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('Failed to load communications', err);
          this.communications = [];
          this.loadingCommunications = false;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Filtered view used by the timeline. `null` = show all; otherwise narrow
   * to a single channel. Filtering happens client-side because the backend
   * already returns the full list ordered DESC.
   */
  get filteredCommunications(): PICommunication[] {
    if (!this.commTypeFilter) return this.communications;
    return this.communications.filter(c => c.type === this.commTypeFilter);
  }

  setCommTypeFilter(type: PICommunicationType | null): void {
    this.commTypeFilter = type;
  }

  /** Icon + tone token per channel. Drives the marker bubble on the timeline. */
  getCommKind(c: PICommunication): { icon: string; tone: string; label: string } {
    switch (c.type) {
      case 'CALL':      return { icon: 'ri-phone-line',           tone: 'primary',   label: 'Call' };
      case 'EMAIL':     return { icon: 'ri-mail-line',            tone: 'info',      label: 'Email' };
      case 'LETTER':    return { icon: 'ri-mail-send-line',       tone: 'warning',   label: 'Letter' };
      case 'IN_PERSON': return { icon: 'ri-user-voice-line',      tone: 'success',   label: 'In-Person' };
      case 'MEETING':   return { icon: 'ri-team-line',            tone: 'success',   label: 'Meeting' };
      case 'OTHER':     return { icon: 'ri-chat-3-line',          tone: 'secondary', label: 'Other' };
      default:          return { icon: 'ri-chat-3-line',          tone: 'secondary', label: c.type };
    }
  }

  /** Direction arrow + label. Inbound = received, outbound = sent. */
  getCommDirection(direction: PICommunicationDirection | undefined): { icon: string; label: string } {
    switch (direction) {
      case 'IN':       return { icon: 'ri-arrow-down-line',   label: 'Received' };
      case 'OUT':      return { icon: 'ri-arrow-up-line',     label: 'Sent' };
      case 'INTERNAL': return { icon: 'ri-team-line',         label: 'Internal' };
      default:         return { icon: 'ri-arrow-left-right-line', label: '' };
    }
  }

  /** Open the Log Communication modal — implemented in P9e.6. */
  openLogCommunicationModal(modalRef: any): void {
    this.newCommunication = this.blankCommunication();
    this.modalService.open(modalRef, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false,
      container: 'body',
      windowClass: 'pi-modal-window',
    });
  }

  /** Submit the modal form and prepend the saved entry to the timeline. */
  submitCommunication(closeFn: () => void): void {
    if (!this.case?.id) return;
    const numericId = Number(this.case.id);
    if (!Number.isFinite(numericId)) return;

    // Quick validation — type + direction are enums set by the radio chips;
    // counterparty/summary are nice-to-have but not required at the API level.
    if (!this.newCommunication.type || !this.newCommunication.direction) return;

    this.commSaving = true;
    this.communicationService.create(numericId, this.newCommunication)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (saved) => {
          this.communications = [saved, ...this.communications];
          this.commSaving = false;
          this.newCommunication = this.blankCommunication();
          this.cdr.markForCheck();
          closeFn();
        },
        error: (err) => {
          this.commSaving = false;
          console.warn('Failed to log communication', err);
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Delete a logged communication. Optimistic — remove from array, restore
   * on error. Matches the case-notes deletion UX.
   */
  deleteCommunication(c: PICommunication): void {
    if (!c.id) return;
    const id = c.id;
    const previous = this.communications;
    this.communications = this.communications.filter(x => x.id !== id);
    this.cdr.markForCheck();

    this.communicationService.delete(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: (err) => {
          console.warn('Failed to delete communication; restoring', err);
          this.communications = previous;
          this.cdr.markForCheck();
        }
      });
  }

  // ============================================
  // P6 — Activity feed helpers
  // ============================================

  /**
   * Map an activity type to an icon + tone token. Used by the Overview activity
   * feed to colour-code each row by the kind of event.
   */
  getActivityKind(type: string | undefined | null): { icon: string; tone: string } {
    switch (type) {
      case ActivityType.CASE_CREATED:           return { icon: 'ri-folder-add-line',     tone: 'primary' };
      case ActivityType.CASE_UPDATED:           return { icon: 'ri-edit-line',           tone: 'info' };
      case ActivityType.STATUS_CHANGED:         return { icon: 'ri-flag-line',           tone: 'warning' };
      case ActivityType.DOCUMENT_UPLOADED:      return { icon: 'ri-upload-2-line',       tone: 'info' };
      case ActivityType.DOCUMENT_DOWNLOADED:    return { icon: 'ri-download-2-line',     tone: 'secondary' };
      case ActivityType.DOCUMENT_VERSION_ADDED: return { icon: 'ri-git-commit-line',     tone: 'info' };
      case ActivityType.NOTE_ADDED:             return { icon: 'ri-sticky-note-add-line',tone: 'success' };
      case ActivityType.NOTE_UPDATED:           return { icon: 'ri-edit-2-line',         tone: 'info' };
      case ActivityType.NOTE_DELETED:           return { icon: 'ri-delete-bin-line',     tone: 'danger' };
      case ActivityType.ASSIGNMENT_CHANGED:     return { icon: 'ri-user-shared-line',    tone: 'info' };
      case ActivityType.DEADLINE_SET:           return { icon: 'ri-calendar-event-line', tone: 'primary' };
      case ActivityType.DEADLINE_UPDATED:       return { icon: 'ri-calendar-event-line', tone: 'info' };
      case ActivityType.DEADLINE_MET:           return { icon: 'ri-check-double-line',   tone: 'success' };
      case ActivityType.DEADLINE_MISSED:        return { icon: 'ri-alarm-warning-line',  tone: 'danger' };
      case ActivityType.PAYMENT_RECEIVED:       return { icon: 'ri-money-dollar-circle-line', tone: 'success' };
      case ActivityType.PAYMENT_SCHEDULED:      return { icon: 'ri-money-dollar-circle-line', tone: 'info' };
      case ActivityType.PAYMENT_MISSED:         return { icon: 'ri-money-dollar-circle-line', tone: 'danger' };
      case ActivityType.HEARING_SCHEDULED:      return { icon: 'ri-court-line',          tone: 'primary' };
      case ActivityType.HEARING_COMPLETED:      return { icon: 'ri-court-line',          tone: 'success' };
      case ActivityType.HEARING_CANCELLED:      return { icon: 'ri-court-line',          tone: 'warning' };
      default:                                  return { icon: 'ri-pulse-line',          tone: 'secondary' };
    }
  }

  // ============================================
  // P6 — Notes flow
  // ============================================

  /** Open the inline add-note form on the Overview tab. */
  toggleAddNote(): void {
    this.showAddNoteForm = !this.showAddNoteForm;
    if (this.showAddNoteForm) {
      this.newNote = { title: '', content: '', isPrivate: true };
    }
    this.cdr.markForCheck();
  }

  cancelAddNote(): void {
    this.showAddNoteForm = false;
    this.newNote = { title: '', content: '', isPrivate: true };
    this.cdr.markForCheck();
  }

  /**
   * Persist a new case note. Backend logs a NOTE_ADDED activity automatically,
   * but we also refresh the activity feed so the new entry surfaces immediately.
   */
  submitNewNote(): void {
    if (!this.case?.id) return;
    const title = this.newNote.title.trim();
    const content = this.newNote.content.trim();
    if (!title || !content) {
      Swal.fire({ icon: 'warning', title: 'Missing fields', text: 'Title and content are required.' });
      return;
    }

    this.savingNote = true;
    this.cdr.markForCheck();

    const payload: CreateCaseNoteRequest = {
      caseId: this.case.id,
      title,
      content,
      isPrivate: this.newNote.isPrivate,
    };

    this.notesService.createNote(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (created: CaseNote) => {
          // Prepend so the freshest note is on top; backend response shape varies, fall through
          if (created) {
            this.caseNotes = [created, ...this.caseNotes];
          }
          this.savingNote = false;
          this.showAddNoteForm = false;
          this.newNote = { title: '', content: '', isPrivate: true };
          // Refresh activity feed so the new NOTE_ADDED entry appears above the fold.
          if (this.case?.id) this.loadActivities(Number(this.case.id));
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.savingNote = false;
          this.cdr.markForCheck();
          Swal.fire({
            icon: 'error',
            title: 'Failed to save note',
            text: err?.error?.message || err?.message || 'Could not save the note.',
          });
        }
      });
  }

  // ============================================
  // P9a — Billing & Time Entries (Negotiation tab)
  // ============================================

  /**
   * Fan-out loader for the Billing & Time section. We call entries + summary in
   * parallel and subscribe to the active-timer stream. The TimerService stream
   * emits per-second; we filter for THIS case so the section's banner ticks
   * without polling and stops the moment the timer ends elsewhere.
   */
  private loadCaseTimeData(caseId: number): void {
    if (!Number.isFinite(caseId)) return;
    this.loadCaseTimeEntries(caseId);
    this.loadCaseTimeSummary(caseId);
    this.subscribeActiveCaseTimer(caseId);
    // Seed TimerService.activeTimers$ from the backend so a timer started in
    // another tab/yesterday surfaces immediately. Without this we'd start with
    // an empty subject and miss any pre-existing running timer for this user,
    // letting the attorney accidentally double-start.
    this.bootstrapActiveTimers();
  }

  /** One-shot fetch that pushes any backend-running timers into the subject. Errors are non-fatal — banner just stays hidden. */
  private bootstrapActiveTimers(): void {
    const userId = this.userService.getCurrentUserId();
    if (!userId) return;
    this.timerService.getActiveTimers(Number(userId))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => { /* subject updated inside the service */ },
        error: (err) => console.warn('Failed to bootstrap active timers', err),
      });
  }

  private loadCaseTimeEntries(caseId: number): void {
    this.loadingTimeEntries = true;
    this.timeTrackingService.getTimeEntriesByCase(caseId, 0, 10)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          // The service unwraps `.data` itself, so the shape here is the inner
          // payload from the backend: { timeEntries: TimeEntry[], totalElements }.
          // We accept a couple of fallback shapes in case the endpoint is ever
          // adjusted to return a Spring page directly.
          const list = response?.timeEntries
            ?? response?.content
            ?? (Array.isArray(response) ? response : []);
          this.caseTimeEntries = Array.isArray(list) ? list : [];
          this.loadingTimeEntries = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('Failed to load time entries for case', err);
          this.caseTimeEntries = [];
          this.loadingTimeEntries = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadCaseTimeSummary(caseId: number): void {
    this.timeTrackingService.getCaseTimeComprehensiveSummary(caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: any) => {
          // Service already unwraps `.data` — `data` is the bare summary map.
          // Backend keys (per TimeTrackingServiceImpl#getCaseTimeSummary): totalHours,
          // billableHours, nonBillableHours, totalAmount, entryCount, pendingCount,
          // draftCount, approvedCount.
          this.caseTimeSummary = {
            totalHours: Number(data?.totalHours ?? 0),
            billableHours: Number(data?.billableHours ?? 0),
            totalAmount: Number(data?.totalAmount ?? 0),
            pendingCount: Number(data?.pendingCount ?? 0),
            entryCount: Number(data?.entryCount ?? 0),
          };
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('Failed to load case time summary', err);
          this.caseTimeSummary = null;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Subscribe to TimerService.activeTimers$ and surface only the timer for
   * THIS case. The service emits every second so the formattedDuration ticks
   * for free; we just snapshot it on each emission.
   */
  private subscribeActiveCaseTimer(caseId: number): void {
    this.timerService.activeTimers$
      .pipe(takeUntil(this.destroy$))
      .subscribe(timers => {
        const match = (timers || []).find(t => Number(t.legalCaseId) === Number(caseId)) || null;
        this.activeCaseTimer = match;
        this.activeCaseTimerDuration = match?.formattedDuration
          ?? this.formatTimerDuration(match?.currentDurationSeconds ?? match?.pausedDuration ?? 0);
        this.cdr.markForCheck();
      });
  }

  /** HH:MM:SS formatter for the timer banner — mirrors timer-widget's display. */
  formatTimerDuration(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const hh = Math.floor(s / 3600).toString().padStart(2, '0');
    const mm = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  /** Open the inline log-time form modal — a streamlined alternative to navigating to the full timesheet view. */
  openLogTimeModal(): void {
    // Reset draft each open so stale values from a previous cancel don't carry over.
    this.logTimeForm = {
      date: new Date().toISOString().split('T')[0],
      hours: 0.25,
      description: '',
      billable: true,
      rate: this.defaultBillingRate,
    };
    this.modalService.open(this.logTimeModalTpl, { size: 'md', backdrop: 'static', windowClass: 'pi-modal-window' });
  }

  /** POST a new time entry and refresh the case-scoped list/summary. Modal closes on success. */
  submitLogTime(modal: any): void {
    if (!this.case?.id) return;
    const f = this.logTimeForm;
    const userId = this.userService.getCurrentUserId();
    if (!userId) {
      Swal.fire({ icon: 'error', title: 'Not signed in', text: 'Could not determine your user account.' });
      return;
    }
    if (!f.description.trim() || f.hours <= 0) {
      Swal.fire({ icon: 'warning', title: 'Missing fields', text: 'Description and a positive hours value are required.' });
      return;
    }

    const payload: TimeEntry = {
      legalCaseId: Number(this.case.id),
      userId: Number(userId),
      date: f.date,
      hours: Number(f.hours),
      rate: Number(f.rate) || 0,
      description: f.description.trim(),
      status: 'DRAFT',
      billable: !!f.billable,
    };

    this.submittingTimeEntry = true;
    this.cdr.markForCheck();

    this.timeTrackingService.createTimeEntry(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.submittingTimeEntry = false;
          modal?.close?.();
          if (this.case?.id) {
            this.loadCaseTimeEntries(Number(this.case.id));
            this.loadCaseTimeSummary(Number(this.case.id));
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.submittingTimeEntry = false;
          this.cdr.markForCheck();
          Swal.fire({
            icon: 'error',
            title: 'Failed to log time',
            text: err?.error?.message || err?.message || 'Could not save the entry.',
          });
        }
      });
  }

  /** Start a timer for this case. The active-timer subscription will surface it in the banner. */
  startCaseTimer(): void {
    if (!this.case?.id) return;
    const userId = this.userService.getCurrentUserId();
    if (!userId) {
      Swal.fire({ icon: 'error', title: 'Not signed in', text: 'Could not determine your user account.' });
      return;
    }
    this.startingTimer = true;
    this.cdr.markForCheck();

    this.timerService.startTimer(Number(userId), {
      legalCaseId: Number(this.case.id),
      description: 'Negotiation work',
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.startingTimer = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.startingTimer = false;
          this.cdr.markForCheck();
          Swal.fire({
            icon: 'error',
            title: 'Could not start timer',
            text: err?.error?.message || err?.message || 'Timer service rejected the start request.',
          });
        }
      });
  }

  /** Stop the running timer for this case, if any. Refreshes the entries list so the new entry appears. */
  stopActiveTimer(): void {
    const t = this.activeCaseTimer;
    if (!t?.id) return;
    const userId = this.userService.getCurrentUserId();
    if (!userId) return;

    this.timerService.stopTimer(Number(userId), t.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Service updates activeTimers$ which clears our banner; just refresh
          // the case list/summary so the freshly-created entry surfaces.
          if (this.case?.id) {
            this.loadCaseTimeEntries(Number(this.case.id));
            this.loadCaseTimeSummary(Number(this.case.id));
          }
        },
        error: (err) => {
          Swal.fire({
            icon: 'error',
            title: 'Could not stop timer',
            text: err?.error?.message || err?.message || 'Timer service rejected the stop request.',
          });
        }
      });
  }

  /** Tone class for time-entry status badges — mirrors the timesheet view's color taxonomy. */
  getTimeEntryStatusTone(status: TimeEntry['status'] | string | undefined): string {
    switch (status) {
      case 'APPROVED':
      case 'BILLING_APPROVED':
        return 'success';
      case 'BILLED':
      case 'INVOICED':
        return 'primary';
      case 'SUBMITTED':
        return 'warning';
      case 'REJECTED':
        return 'danger';
      case 'DRAFT':
      default:
        return 'secondary';
    }
  }

  /** Route to the time-tracking dashboard (full module is mounted at /time-tracking).
   *  We pass caseId as a query param even though the dashboard doesn't filter by it
   *  today — keeps the link stable for when P9/P15 add case-scoped filtering there. */
  openFullTimesheet(): void {
    if (!this.case?.id) return;
    this.router.navigate(['/time-tracking/dashboard'], {
      queryParams: { caseId: this.case.id }
    });
  }

  // ============================================
  // P9b — Final Disposition
  // ============================================

  /** True once the case has been marked Settled — controls which view of the disposition card renders. */
  get isSettled(): boolean {
    return this.case?.stage === 'SETTLED';
  }

  /**
   * Open the disposition modal, pre-filling the form from any prior values
   * already on the case (lets attorneys edit a previously-entered amount).
   */
  openFinalDispositionModal(): void {
    const c = this.case;
    this.dispositionForm = {
      finalAmount: c?.settlementFinalAmount != null ? Number(c.settlementFinalAmount) : null,
      settlementDate: this.toDateInputString(c?.settlementDate) || new Date().toISOString().split('T')[0],
      notes: '',
    };
    this.modalService.open(this.finalDispositionModalTpl, { size: 'md', backdrop: 'static', windowClass: 'pi-modal-window' });
  }

  /**
   * PATCH the case with final amount/date plus the SETTLED stage flip, then
   * (optionally) drop the notes into a case note so the memo persists. The
   * status flip to CLOSED is intentional — a settled case is no longer
   * "active" for triage purposes; archive happens later via the ⋮ menu.
   */
  submitFinalDisposition(modal: any): void {
    if (!this.case?.id) return;
    const f = this.dispositionForm;
    if (f.finalAmount == null || !Number.isFinite(f.finalAmount) || f.finalAmount < 0) {
      Swal.fire({ icon: 'warning', title: 'Missing amount', text: 'Enter a non-negative settlement amount.' });
      return;
    }
    if (!f.settlementDate) {
      Swal.fire({ icon: 'warning', title: 'Missing date', text: 'Select a settlement date.' });
      return;
    }

    const payload: any = {
      settlementFinalAmount: Number(f.finalAmount),
      settlementDate: f.settlementDate,
      stage: 'SETTLED',
      stageManuallySet: true,
      status: 'CLOSED',
    };

    this.submittingDisposition = true;
    this.cdr.markForCheck();

    this.caseService.patchCase(this.case.id, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.submittingDisposition = false;
          modal?.close?.();

          // Audit-feed entry is now written server-side by LegalCaseServiceImpl#patchCaseFields
          // (logStatusChangeActivity). The settlement amount + date live on the case record
          // itself, and the memo below preserves the full disposition story in the Notes panel.

          const memo = f.notes.trim();
          if (memo && this.case?.id) {
            // Save a memo note alongside the disposition — keeps the back story
            // (e.g. "release signed pending wire") visible without burying it
            // in raw activity logs.
            this.notesService.createNote({
              caseId: this.case.id,
              title: `Final disposition — ${this.formatShortDate(f.settlementDate)}`,
              content: memo,
              isPrivate: true,
            } as CreateCaseNoteRequest)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: () => {
                  if (this.case?.id) this.loadNotes(this.case.id);
                },
                error: (err) => console.warn('Disposition saved but note failed', err),
              });
          }

          if (this.case?.id) {
            this.refreshCase(this.case.id);
            // Slight delay so the freshly-created activity entry has been
            // committed by the time we refetch — prevents the feed from
            // showing the old state until the next interaction.
            setTimeout(() => {
              if (this.case?.id) this.loadActivities(Number(this.case.id));
              // P9c — rebuild the settlement tracker so the "Final" datapoint
              // surfaces on the chart now that the case is SETTLED with an amount.
              this.buildSettlementChartOptions();
              this.cdr.markForCheck();
            }, 250);
          }
          Swal.fire({ icon: 'success', title: 'Disposition recorded', timer: 1800, showConfirmButton: false });
        },
        error: (err) => {
          this.submittingDisposition = false;
          this.cdr.markForCheck();
          Swal.fire({
            icon: 'error',
            title: 'Failed to save disposition',
            text: err?.error?.message || err?.message || 'Could not record the final disposition.',
          });
        }
      });
  }

  /** Coerce a Date | string | null into the YYYY-MM-DD format required by <input type="date">. */
  private toDateInputString(d: any): string {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  }

  // ============================================
  // P9f — Closing Statement
  // ============================================

  /** Used by the PDF DOM header — re-evaluated on render, no need to memoize. */
  get today(): Date {
    return new Date();
  }

  private defaultClosingStatement(): ClosingStatementForm {
    return { feePercent: 33.33, costs: 0, liens: [], notes: '' };
  }

  /** Stable localStorage key for the per-case closing-statement draft. */
  private closingStatementStorageKey(caseId: number | string): string {
    return `pi.closingStatement.${caseId}`;
  }

  /**
   * Restore the closing-statement draft from localStorage on case mount.
   * Validates the shape — anything unexpected resets to defaults so we
   * never show stale or corrupted form state.
   */
  private loadClosingStatementDraft(caseId: number): void {
    try {
      const raw = localStorage.getItem(this.closingStatementStorageKey(caseId));
      if (!raw) {
        this.closingStatement = this.defaultClosingStatement();
        return;
      }
      const parsed = JSON.parse(raw);
      this.closingStatement = {
        feePercent: typeof parsed?.feePercent === 'number' ? parsed.feePercent : 33.33,
        costs: typeof parsed?.costs === 'number' ? parsed.costs : 0,
        liens: Array.isArray(parsed?.liens) ? parsed.liens : [],
        notes: typeof parsed?.notes === 'string' ? parsed.notes : '',
      };
    } catch {
      this.closingStatement = this.defaultClosingStatement();
    }
  }

  /**
   * Persist the current draft. Called from input handlers; cheap enough
   * (small JSON, single key) that we don't need to debounce.
   */
  saveClosingStatementDraft(): void {
    if (!this.case?.id) return;
    try {
      localStorage.setItem(
        this.closingStatementStorageKey(this.case.id),
        JSON.stringify(this.closingStatement)
      );
    } catch {
      // Quota / private-mode failures are non-fatal — the form just won't survive a refresh.
    }
  }

  // ─── Computed totals ─────────────────────────────────────────────────────

  /** Gross settlement (read-only, from the disposition form on the case). */
  get closingGross(): number {
    const v = this.case?.settlementFinalAmount;
    return v != null ? Number(v) : 0;
  }

  get closingFeeAmount(): number {
    const pct = Number(this.closingStatement.feePercent) || 0;
    return this.closingGross * (pct / 100);
  }

  /**
   * Lien total flowing into the closing breakdown — sums BOTH sources so
   * attorneys never silently lose data.
   *
   *   - The `pi_liens` tracker (P10.c) — server-computed effective total
   *     (sum of negotiated || original).
   *   - localStorage manual entries on `closingStatement.liens` — legacy
   *     P9f path that pre-dates the tracker.
   *
   * In practice attorneys will use one or the other, not both. If they
   * happen to have both populated, summing surfaces the total they expect
   * (visible in both UIs). The migration path from manual → tracker is to
   * delete each manual line as it's added to the tracker.
   */
  get closingLienTotal(): number {
    const tracker = Number(this.liensEffectiveTotal) || 0;
    const manual = (this.closingStatement.liens || []).reduce(
      (sum, l) => sum + (Number(l.amount) || 0),
      0
    );
    return tracker + manual;
  }

  /** Whether legacy manual entries exist alongside tracker rows — drives a one-time migration prompt in the UI. */
  get hasLegacyClosingLiens(): boolean {
    return (this.closingStatement.liens || []).length > 0
      && (this.liens || []).length > 0;
  }

  get closingCosts(): number {
    return Number(this.closingStatement.costs) || 0;
  }

  get closingNetToClient(): number {
    return this.closingGross - this.closingFeeAmount - this.closingCosts - this.closingLienTotal;
  }

  // ─── Lien line-item handlers ─────────────────────────────────────────────

  addClosingLien(): void {
    this.closingStatement.liens = [
      ...this.closingStatement.liens,
      { holder: '', type: 'MEDICAL', amount: 0, status: 'OPEN' },
    ];
    this.saveClosingStatementDraft();
  }

  removeClosingLien(index: number): void {
    this.closingStatement.liens = this.closingStatement.liens.filter((_, i) => i !== index);
    this.saveClosingStatementDraft();
  }

  /** Display label for the lien-type enum. */
  closingLienTypeLabel(type: ClosingLienItem['type']): string {
    switch (type) {
      case 'MEDICAL':    return 'Medical Provider';
      case 'HEALTH_INS': return 'Health Insurance';
      case 'MEDICARE':   return 'Medicare';
      case 'MEDICAID':   return 'Medicaid';
      case 'ATTORNEY':   return 'Prior Attorney';
      case 'OTHER':      return 'Other';
      default:           return type;
    }
  }

  /**
   * Render the closing-statement DOM to PDF using client-side html2pdf.js.
   * Lazy-imported so the ~300kb dependency doesn't load until an attorney
   * actually clicks "Generate PDF". Filename mirrors the case title for
   * easy filing in the firm's document store.
   */
  async generateClosingStatementPdf(): Promise<void> {
    if (!this.closingPdfRoot?.nativeElement) {
      console.warn('Closing statement PDF root not yet rendered');
      return;
    }
    this.closingPdfGenerating = true;
    this.cdr.markForCheck();
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const filename = this.buildClosingPdfFilename();
      // Typed loose because html2pdf.js's @types insist on tuple shapes for
      // `margin` and `pagebreak.mode` that fight with inferred array literals.
      // The runtime config is plain JSON — `any` keeps things readable here.
      const opts: any = {
        margin:       [0.5, 0.5, 0.6, 0.5],
        filename,
        image:        { type: 'jpeg', quality: 0.96 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] },
      };
      await html2pdf().set(opts).from(this.closingPdfRoot.nativeElement).save();
    } catch (err) {
      console.warn('Failed to generate closing statement PDF', err);
    } finally {
      this.closingPdfGenerating = false;
      this.cdr.markForCheck();
    }
  }

  /** Filename: "Closing-Statement-{caseTitle slug}-{YYYYMMDD}.pdf". */
  private buildClosingPdfFilename(): string {
    const title = (this.case?.title || this.case?.caseNumber || `case-${this.case?.id}`)
      .toString()
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'case';
    const today = new Date();
    const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    return `Closing-Statement-${title}-${ymd}.pdf`;
  }

  // ============================================
  // P8 — ⋮ More menu handlers
  // ============================================

  /** Whether the Delete Case action should be enabled — admin/superadmin only. */
  get canDeleteCase(): boolean {
    return this.userService.isAdmin?.() === true;
  }

  /**
   * P13b.5 — Open case-scoped Legal Research in a modal. Embeds <app-case-research>,
   * which keeps a per-case conversation history via legalResearchService.getConversationsForCase
   * and emits (taskCreated) when the attorney converts a research finding into a case task.
   *
   * Previously routed to the GENERIC `/legal/legal-research-assistant` page (P8 wiring),
   * which lost case context — see "Discovered while building" in the project plan.
   */
  openLegalResearch(): void {
    if (!this.numericCaseId) return;
    this.modalService.open(this.legalResearchModalTpl, {
      size: 'xl',
      backdrop: 'static',
      keyboard: true,
      scrollable: true,
      container: 'body',
      windowClass: 'pi-modal-window',
    });
  }

  /**
   * P13b.5 — Refresh the activity feed when the embedded case-research component
   * spawns a task from a research finding, so the new task surfaces in Recent Activity
   * without forcing the user to re-open the case.
   */
  onLegalResearchTaskCreated(): void {
    if (this.case?.id) this.loadActivities(Number(this.case.id));
  }

  /**
   * Open the Manage Team modal — embeds the existing TeamAssignmentModalComponent.
   * On close, re-fetch the case so the header avatar chips reflect new assignments.
   */
  openManageTeam(): void {
    if (!this.case?.id) return;
    const ref = this.modalService.open(TeamAssignmentModalComponent, {
      size: 'lg',
      backdrop: 'static',
    });
    ref.componentInstance.data = {
      caseId: Number(this.case.id),
      currentTeamMembers: this.case.assignedAttorneys ?? [],
      availableUsers: [],
    };
    // Refresh case so the avatar stack picks up changes when the modal closes.
    ref.closed.subscribe(() => this.case?.id && this.refreshCase(this.case.id));
    ref.dismissed.subscribe(() => this.case?.id && this.refreshCase(this.case.id));
  }

  /** Open Case Settings modal; pre-populate with current case values. */
  openCaseSettings(): void {
    if (!this.case) return;
    this.caseSettingsDraft = {
      feeStructure: (this.case as any).feeStructure ?? 'PRE_SUIT_33',
      hourlyRate: (this.case as any).hourlyRate ?? null,
      status: this.case.status ?? 'ACTIVE',
    };
    this.modalService.open(this.caseSettingsModalTpl, { size: 'md', windowClass: 'pi-modal-window' });
  }

  /** Persist the Case Settings form. */
  saveCaseSettings(modal: any): void {
    if (!this.case?.id) return;
    this.caseSettingsSaving = true;
    this.cdr.markForCheck();

    // Only `status` is persisted in P8 — feeStructure + hourlyRate require the
    // P14 V65 entity expansion (those columns don't exist on legal_cases yet).
    const payload: any = {
      status: this.caseSettingsDraft.status,
    };

    this.caseService.patchCase(this.case.id, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.caseSettingsSaving = false;
          modal.close();
          if (this.case?.id) this.refreshCase(this.case.id);
          Swal.fire({ icon: 'success', title: 'Settings saved', timer: 1800, showConfirmButton: false });
        },
        error: (err) => {
          this.caseSettingsSaving = false;
          this.cdr.markForCheck();
          Swal.fire({ icon: 'error', title: 'Failed to save', text: err?.error?.message || err?.message || 'Could not save case settings.' });
        }
      });
  }

  // ============================================
  // Batch A.3 — Incident card actions
  // ============================================

  /** Pre-populate the Edit Incident draft from the loaded case and open the modal. */
  openEditIncidentModal(): void {
    if (!this.case) return;
    const c = this.case as any;
    const dol = c.injuryDate ? String(c.injuryDate).split('T')[0] : '';
    this.editIncidentDraft = {
      injuryDate: dol,
      injuryType: c.injuryType ?? '',
      accidentLocation: c.accidentLocation ?? '',
      injuryDescription: c.injuryDescription ?? '',
      comparativeNegligencePercent:
        typeof c.comparativeNegligencePercent === 'number' ? c.comparativeNegligencePercent : null,
    };
    this.modalService.open(this.editIncidentModalTpl, {
      size: 'lg', backdrop: 'static', windowClass: 'pi-modal-window'
    });
  }

  /** Persist the Edit Incident draft via the existing PATCH /legal-case/{id} endpoint. */
  submitEditIncident(modal: any): void {
    if (!this.case?.id) return;
    this.editIncidentSaving = true;
    this.cdr.markForCheck();

    const payload: any = {
      injuryDate: this.editIncidentDraft.injuryDate || null,
      injuryType: this.editIncidentDraft.injuryType?.trim() || null,
      accidentLocation: this.editIncidentDraft.accidentLocation?.trim() || null,
      injuryDescription: this.editIncidentDraft.injuryDescription?.trim() || null,
      comparativeNegligencePercent: this.editIncidentDraft.comparativeNegligencePercent,
    };

    this.caseService.patchCase(this.case.id, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          const updated = response?.data?.case ?? response?.case ?? response;
          this.case = { ...this.case, ...updated } as LegalCase;
          this.editIncidentSaving = false;
          modal.close();
          this.cdr.markForCheck();
          Swal.fire({ icon: 'success', title: 'Incident updated', timer: 1500, showConfirmButton: false });
        },
        error: (err) => {
          this.editIncidentSaving = false;
          this.cdr.markForCheck();
          Swal.fire({
            icon: 'error',
            title: 'Failed to save',
            text: err?.error?.message || err?.message || 'Could not update the incident.',
          });
        }
      });
  }

  /** Open Google Maps in a new tab using the case's accidentLocation. */
  openIncidentInMaps(): void {
    const loc = (this.case as any)?.accidentLocation?.trim();
    if (!loc) {
      Swal.fire('No incident location set', 'Add an incident location to enable map preview.', 'info');
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&q=${encodeURIComponent(loc)}`;
    window.open(url, '_blank', 'noopener');
  }

  /** Route to the Documents section so the user can upload a scene-diagram image. */
  addSceneDiagram(): void {
    this.activeTab = 'caseFile';
    this.setCaseFileSection('docs');
    this.cdr.markForCheck();
    Swal.fire({
      icon: 'info',
      title: 'Add scene diagram',
      html: `<div class="text-start text-muted small">
        Upload a scene diagram (PDF or image) from the Documents section. Tag
        it with category <b>scene_diagram</b> so it surfaces back here under
        the incident map preview.
      </div>`,
      confirmButtonText: 'Got it',
    });
  }

  // ============================================
  // Batch B — Case tasks (Investigation Tasks card)
  // ============================================

  /** Load tasks for this case from the backend; failure leaves liveCaseTasks=null
   *  so the mock fallback continues to render. */
  private loadCaseTasks(caseId: number): void {
    this.loadingCaseTasks = true;
    this.cdr.markForCheck();
    this.caseTaskService.getTasksByCaseId(caseId, 0, 100)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          // Backend returns { data: { tasks: Page<CaseTaskDTO> } }
          const tasks: CaseTask[] =
            response?.data?.tasks?.content ??
            response?.data?.tasks ??
            response?.data ??
            [];
          this.liveCaseTasks = Array.isArray(tasks) ? tasks : [];
          this.loadingCaseTasks = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('Failed to load case tasks; falling back to mock', err);
          this.liveCaseTasks = null;
          this.loadingCaseTasks = false;
          this.cdr.markForCheck();
        }
      });
  }

  /** Display rows for the Investigation Tasks table. Live tasks (when present)
   *  are mapped to the same shape the table already renders so we don't have
   *  to re-template. Empty live list = mock fallback for context. */
  getInvestigationTasksDisplay(): Array<{
    id?: number; done: boolean; title: string;
    ownerInitials: string; ownerName: string; ownerTone?: string;
    due: string; dueTone?: 'warn'|'dng'|'';
    status: string; statusClass: string;
  }> {
    if (!this.liveCaseTasks || this.liveCaseTasks.length === 0) {
      return this.getMockInvestigationTasks();
    }
    return this.liveCaseTasks.map(t => this.mapTaskToDisplayRow(t));
  }

  private mapTaskToDisplayRow(t: CaseTask): {
    id: number; done: boolean; title: string;
    ownerInitials: string; ownerName: string; ownerTone?: string;
    due: string; dueTone?: 'warn'|'dng'|'';
    status: string; statusClass: string;
  } {
    const owner = t.assignedToName || t.createdByName || 'Unassigned';
    const initials = owner.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '—';
    const due = t.dueDate ? new Date(t.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';
    const dueTone = this.computeDueTone(t.dueDate);
    const statusInfo = this.computeStatusDisplay(t.status);
    return {
      id: t.id,
      done: t.status === TaskStatus.COMPLETED,
      title: t.title,
      ownerInitials: initials,
      ownerName: owner,
      due,
      dueTone,
      status: statusInfo.label,
      statusClass: statusInfo.cls,
    };
  }

  private computeDueTone(dueDate?: Date): '' | 'warn' | 'dng' {
    if (!dueDate) return '';
    const due = new Date(dueDate).getTime();
    if (Number.isNaN(due)) return '';
    const diffDays = (due - Date.now()) / (1000 * 60 * 60 * 24);
    if (diffDays < 0) return 'dng';
    if (diffDays < 5) return 'warn';
    return '';
  }

  private computeStatusDisplay(status: TaskStatus): { label: string; cls: string } {
    switch (status) {
      case TaskStatus.COMPLETED:   return { label: 'Done',        cls: 'sp-done' };
      case TaskStatus.IN_PROGRESS: return { label: 'In progress', cls: 'sp-progress' };
      case TaskStatus.REVIEW:      return { label: 'Review',      cls: 'sp-progress' };
      case TaskStatus.BLOCKED:     return { label: 'Blocked',     cls: 'sp-todo' };
      case TaskStatus.CANCELLED:   return { label: 'Cancelled',   cls: 'sp-todo' };
      case TaskStatus.TODO:
      default:                     return { label: 'To do',       cls: 'sp-todo' };
    }
  }

  /** Open the Add Task modal pre-filled with sensible PI defaults. */
  openAddTaskModal(): void {
    if (!this.case?.id) return;
    this.addTaskDraft = {
      title: '',
      description: '',
      taskType: TaskType.RESEARCH,
      priority: TaskPriority.MEDIUM,
      dueDate: '',
      estimatedHours: null,
    };
    this.modalService.open(this.addTaskModalTpl, {
      size: 'lg', backdrop: 'static', windowClass: 'pi-modal-window'
    });
  }

  /** Persist via CaseTaskService.createTask and prepend the new task to the
   *  live list. Falls back to refetching the page on a partial response. */
  submitAddTask(modal: any): void {
    if (!this.case?.id) return;
    const caseIdNum = Number(this.case.id);
    if (!Number.isFinite(caseIdNum)) return;
    if (!this.addTaskDraft.title?.trim()) {
      Swal.fire('Title required', 'Give the task a short title before saving.', 'warning');
      return;
    }
    this.addTaskSaving = true;
    this.cdr.markForCheck();

    const payload: TaskCreateRequest = {
      caseId: caseIdNum,
      title: this.addTaskDraft.title.trim(),
      description: this.addTaskDraft.description?.trim() || undefined,
      taskType: this.addTaskDraft.taskType,
      priority: this.addTaskDraft.priority,
      dueDate: this.addTaskDraft.dueDate ? new Date(this.addTaskDraft.dueDate) : undefined,
      estimatedHours: this.addTaskDraft.estimatedHours ?? undefined,
    };

    this.caseTaskService.createTask(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resp: any) => {
          const created: CaseTask | undefined = resp?.data?.task ?? resp?.task;
          if (created) {
            this.liveCaseTasks = [created, ...(this.liveCaseTasks ?? [])];
          } else {
            // Couldn't extract — refetch to stay consistent.
            this.loadCaseTasks(caseIdNum);
          }
          this.addTaskSaving = false;
          modal.close();
          this.cdr.markForCheck();
          Swal.fire({ icon: 'success', title: 'Task added', timer: 1500, showConfirmButton: false });
        },
        error: (err) => {
          this.addTaskSaving = false;
          this.cdr.markForCheck();
          Swal.fire({
            icon: 'error',
            title: 'Failed to save task',
            text: err?.error?.message || err?.message || 'Could not create the task.',
          });
        }
      });
  }

  // ============================================
  // Batch D — Insurance / LOR / Provider / Docs wires
  //
  // These buttons sit on top of mock data (mockCoverages, mockLORs,
  // mockMedicalProviders, mockDocs). Building full CRUD for each would each
  // be its own Batch-C-sized full-stack feature, so for now we route to the
  // closest working flow and surface a clear "what's coming" message instead
  // of leaving them inert.
  // ============================================

  /** Open the Log Communication modal preset to a CALL with the named
   *  adjuster as counterparty. Used by the PIP-state Coverage Ops card and
   *  any other inline call shortcut. */
  callAdjuster(name?: string, email?: string): void {
    this.newCommunication = {
      ...this.blankCommunication(),
      type: 'CALL',
      direction: 'OUT',
      counterparty: name ?? '',
      summary: email ? `Call ${name} (${email})` : '',
    } as PICommunication;
    this.modalService.open(this.logCommModalTpl, {
      size: 'lg', backdrop: 'static', keyboard: false, container: 'body',
      windowClass: 'pi-modal-window',
    });
  }

  /** Generic "feature coming soon" message used to keep design-pass buttons
   *  responsive without faking persistence. The {@code detail} string is
   *  shown in the body so each button gets a specific, honest explanation
   *  rather than a vague stub. Used for low-priority cleanup buttons that
   *  don't fit anywhere else. */
  comingSoon(feature: string, detail?: string): void {
    Swal.fire({
      icon: 'info',
      title: feature,
      html: detail
        ? `<div class="text-start text-muted small">${detail}</div>`
        : `<div class="text-muted small">${feature} ships in a future iteration.</div>`,
    });
  }

  /** Send Letter of Representation — log it as an outbound certified letter
   *  in the communication timeline. The LOR draft itself can come from the
   *  AI drafter; this action records "we sent it". */
  sendLOR(carrierName?: string): void {
    this.newCommunication = {
      ...this.blankCommunication(),
      type: 'LETTER',
      direction: 'OUT',
      counterparty: carrierName ?? '',
      summary: 'Letter of Representation sent',
    } as PICommunication;
    this.modalService.open(this.logCommModalTpl, {
      size: 'lg', backdrop: 'static', keyboard: false, container: 'body',
      windowClass: 'pi-modal-window',
    });
  }

  /** Add coverage — surface a structured next-step message. Coverage CRUD is a
   *  separate full-stack build (insurance carrier + policy + adjuster
   *  entities) and is tracked as a follow-up. */
  addCoverage(): void {
    Swal.fire({
      icon: 'info',
      title: 'Add coverage — coming soon',
      html: `<div class="text-start text-muted small">
        Insurance coverage CRUD (carrier, policy, limits, adjuster, claim #) is a
        scoped feature on the roadmap. For now, you can capture coverage details
        in the case description or notes — they'll surface in the case file as
        the feature lands.
      </div>`,
    });
  }

  /** Add medical provider — same situation as Add coverage. The Medical tab
   *  surfaces real records via PIMedicalRecord, but the per-provider summary
   *  rows live on a future PIProvider entity. */
  addMedicalProvider(): void {
    Swal.fire({
      icon: 'info',
      title: 'Add provider — coming soon',
      html: `<div class="text-start text-muted small">
        The Provider summary rows (visit count, treatment range, specials total,
        records-status pill) are derived from the future PIProvider entity. In
        the meantime, providers surface automatically once their treatment
        records are scanned via <strong>Scan medical documents</strong>.
      </div>`,
    });
  }

  /** Wire the docs-grid Upload button — for now route into Case Documents flow. */
  uploadDocFromGrid(): void {
    this.activeTab = 'caseFile';
    this.setCaseFileSection('docs');
    this.cdr.markForCheck();
    Swal.fire({
      icon: 'info',
      title: 'Upload documents',
      html: `<div class="text-start text-muted small">
        Document uploads currently go through <strong>Case &nbsp;Documents</strong>
        on the legacy case detail. We're folding that flow into this page next —
        until then, click <strong>Switch to legacy view</strong> from the case
        menu to upload, then return here.
      </div>`,
    });
  }

  /** Open the "Engage expert" decision flow — placeholder until the decisions
   *  module ships (named comparable cases, expert vetting, retainer tracking). */
  engageExpert(): void {
    Swal.fire({
      icon: 'info',
      title: 'Engage expert',
      html: `<div class="text-start text-muted small">
        Expert-engagement decisions (accident reconstructionist, biomechanical,
        vocational, life-care planner) live on the upcoming Decisions module.
        The trigger here will open the relevant decision card once it lands.
      </div>`,
    });
  }

  /** Fired from the per-coverage row "⋮" menu. Surfaces the same structured
   *  message as Add coverage so the row stays informational. */
  coverageRowMore(): void {
    this.addCoverage();
  }

  // ============================================
  // Batch C — Adverse parties CRUD
  // ============================================

  private loadParties(caseId: number): void {
    this.loadingParties = true;
    this.cdr.markForCheck();
    this.adversePartyService.getPartiesForCase(caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (rows) => {
          this.liveParties = Array.isArray(rows) ? rows : [];
          this.loadingParties = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('Failed to load adverse parties; falling back to mock', err);
          this.liveParties = null;
          this.loadingParties = false;
          this.cdr.markForCheck();
        }
      });
  }

  /** What the parties grid actually iterates: live data when available,
   *  mock fallback otherwise. Empty live list returns a proper empty array
   *  so the grid renders the "Add party" CTA instead of mock cards. */
  getPartiesDisplay(): PiPartyView[] {
    if (this.liveParties === null) {
      return this.getMockParties();
    }
    return this.liveParties.map(p => this.mapAdversePartyToView(p));
  }

  /** True when we have a real (possibly-empty) live result rather than the mock. */
  get partiesAreLive(): boolean { return this.liveParties !== null; }

  /** Map AdverseParty → render-shape consumed by the existing party card. */
  private mapAdversePartyToView(p: AdverseParty): PiPartyView {
    const tone = this.partyAvatarToneFor(p.partyType);
    const roleClass: PartyRoleClass = ({
      pl: 'role-pl', def: 'role-def', witness: 'role-wit', expert: 'role-exp', counsel: 'role-counsel'
    } as Record<PartyAvatarTone, PartyRoleClass>)[tone];
    const initials = (p.name || '')
      .split(/\s+/).filter(Boolean).slice(0, 2)
      .map(s => s[0]?.toUpperCase() ?? '').join('') || '—';
    const rows: PiPartyView['rows'] = [];
    if (p.phone)   rows.push({ icon: 'ri-phone-line', text: p.phone });
    if (p.email)   rows.push({ icon: 'ri-mail-line',  text: p.email });
    if (p.address) rows.push({ icon: 'ri-map-pin-line', text: p.address });
    if (p.notes)   rows.push({ icon: 'ri-sticky-note-line', text: p.notes });
    if (rows.length === 0) {
      rows.push({ icon: 'ri-information-line', text: 'No contact info on file yet' });
    }
    return {
      id: p.id,
      avatarType: tone,
      initials,
      name: p.name || '—',
      role: this.partyRoleLabel(p.partyType),
      roleClass,
      phone: p.phone,
      email: p.email,
      rows,
    };
  }

  private partyAvatarToneFor(partyType?: string): PartyAvatarTone {
    switch ((partyType ?? '').toUpperCase()) {
      case 'PLAINTIFF':           return 'pl';
      case 'DEFENDANT':
      case 'INSURANCE_ADJUSTER':  return 'def';
      case 'EXPERT':              return 'expert';
      case 'OPPOSING_COUNSEL':    return 'counsel';
      case 'WITNESS':
      case 'OTHER':
      default:                    return 'witness';
    }
  }

  private partyRoleLabel(partyType?: string): string {
    const opt = this.partyTypeOptions.find(o => o.value === (partyType ?? '').toUpperCase());
    return opt ? opt.label : 'Party';
  }

  /** Open the Add Party modal with empty defaults. */
  openAddPartyModal(): void {
    this.editingPartyId = null;
    this.partyDraft = {
      name: '',
      partyType: 'WITNESS',
      email: '',
      phone: '',
      address: '',
      notes: '',
    };
    this.modalService.open(this.partyFormModalTpl, { size: 'lg', backdrop: 'static', windowClass: 'pi-modal-window' });
  }

  /** Open the Edit Party modal pre-filled from the live record. Falls back to a
   *  noop when the user clicks Edit on a mock card (no id). */
  openEditPartyModal(view: PiPartyView): void {
    if (!view.id || this.liveParties === null) {
      Swal.fire('Demo party', 'This card is mock data. Click Add party to create a real one.', 'info');
      return;
    }
    const live = this.liveParties.find(p => p.id === view.id);
    if (!live) return;
    this.editingPartyId = live.id ?? null;
    this.partyDraft = {
      name: live.name ?? '',
      partyType: live.partyType ?? 'WITNESS',
      email: live.email ?? '',
      phone: live.phone ?? '',
      address: live.address ?? '',
      notes: live.notes ?? '',
    };
    this.modalService.open(this.partyFormModalTpl, { size: 'lg', backdrop: 'static', windowClass: 'pi-modal-window' });
  }

  /** POST or PUT depending on editingPartyId. */
  submitPartyForm(modal: any): void {
    if (!this.case?.id) return;
    if (!this.partyDraft.name?.trim()) {
      Swal.fire('Name required', 'Give the party a name before saving.', 'warning');
      return;
    }
    const caseId = this.case.id;
    this.partySaving = true;
    this.cdr.markForCheck();

    const payload: AdverseParty = {
      ...this.partyDraft,
      name: this.partyDraft.name.trim(),
      email:   this.partyDraft.email?.trim() ?? '',
      phone:   this.partyDraft.phone?.trim() ?? '',
      address: this.partyDraft.address?.trim() ?? '',
      notes:   this.partyDraft.notes?.trim() ?? '',
    };

    const obs = this.editingPartyId
      ? this.adversePartyService.updateParty(caseId, this.editingPartyId, payload)
      : this.adversePartyService.createParty(caseId, payload);

    obs.pipe(takeUntil(this.destroy$)).subscribe({
      next: (saved) => {
        if (this.editingPartyId) {
          this.liveParties = (this.liveParties ?? []).map(p => p.id === saved.id ? saved : p);
        } else {
          this.liveParties = [...(this.liveParties ?? []), saved];
        }
        this.partySaving = false;
        modal.close();
        this.cdr.markForCheck();
        Swal.fire({
          icon: 'success',
          title: this.editingPartyId ? 'Party updated' : 'Party added',
          timer: 1500,
          showConfirmButton: false,
        });
      },
      error: (err) => {
        this.partySaving = false;
        this.cdr.markForCheck();
        Swal.fire({
          icon: 'error',
          title: 'Failed to save',
          text: err?.error?.message || err?.message || 'Could not save the party.',
        });
      }
    });
  }

  /** Delete with confirmation. */
  deleteParty(view: PiPartyView): void {
    if (!view.id || !this.case?.id) {
      Swal.fire('Demo party', 'This card is mock data and can\'t be deleted.', 'info');
      return;
    }
    const caseId = this.case.id;
    const partyId = view.id;
    const partyName = view.name;
    Swal.fire({
      title: `Delete ${partyName}?`,
      text: 'Their contact info and notes will be removed from this case. This can\'t be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f06548',
      confirmButtonText: 'Yes, delete',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.adversePartyService.deleteParty(caseId, partyId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.liveParties = (this.liveParties ?? []).filter(p => p.id !== partyId);
            this.cdr.markForCheck();
            Swal.fire({ icon: 'success', title: 'Party deleted', timer: 1200, showConfirmButton: false });
          },
          error: (err) => {
            Swal.fire({
              icon: 'error',
              title: 'Failed to delete',
              text: err?.error?.message || err?.message || 'Could not remove the party.',
            });
          }
        });
    });
  }

  /** Open AI Settings modal — placeholder for P15 expansion. */
  openAiSettings(): void {
    this.modalService.open(this.aiSettingsModalTpl, { size: 'md', windowClass: 'pi-modal-window' });
  }

  /**
   * Open the per-case Activity Log modal. Reuses `allActivities` (the unsliced
   * companion to `recentActivities` populated by loadActivities) so we don't
   * pay a second round-trip on open. The richer `audit_log` table — IP /
   * user-agent / raw-metadata level — is intentionally NOT surfaced here:
   * attorneys want "what happened on this case", which is exactly what the
   * case-activities feed already answers. Cross-org compliance auditing stays
   * on the existing /superadmin/audit-logs route.
   */
  openAuditLog(): void {
    this.modalService.open(this.activityLogModalTpl, { size: 'lg', scrollable: true, windowClass: 'pi-modal-window' });
  }

  /**
   * Share Case — JWT-signed read-only links require dedicated security work
   * (token scope, revocation, expiry). Stubbed for now; tracked as a follow-up.
   */
  shareCase(): void {
    Swal.fire({
      icon: 'info',
      title: 'Share Case (Read-Only)',
      html: 'Signed read-only share links are coming in a follow-up phase. They\'ll generate a token-protected URL that gives clients or co-counsel view-only access without a full account.',
    });
  }

  /**
   * Archive a case — moves it out of active workflow but preserves all data.
   * Reversible via Case Settings → Status override.
   */
  archiveCase(): void {
    if (!this.case?.id) return;
    Swal.fire({
      title: 'Archive this case?',
      text: 'It will move out of the active list but stay readable. You can unarchive from Case Settings.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0ab39c',
      confirmButtonText: 'Yes, archive',
    }).then((result) => {
      if (!result.isConfirmed || !this.case?.id) return;
      this.caseService.patchCase(this.case.id, { status: 'ARCHIVED' as any })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            if (this.case?.id) this.refreshCase(this.case.id);
            Swal.fire({ icon: 'success', title: 'Case archived', timer: 1800, showConfirmButton: false });
          },
          error: (err) => Swal.fire({ icon: 'error', title: 'Failed to archive', text: err?.error?.message || 'Could not archive case.' }),
        });
    });
  }

  /**
   * Delete a case — irreversible; gated to admin/partner role. Requires the
   * user to type the case number to confirm (defense against fat-finger clicks).
   */
  deleteCase(): void {
    if (!this.case?.id || !this.canDeleteCase) return;
    const expected = this.case.caseNumber || `case-${this.case.id}`;
    Swal.fire({
      title: 'Delete this case permanently?',
      html: `This cannot be undone. To confirm, type the case number:<br><strong>${expected}</strong>`,
      icon: 'warning',
      input: 'text',
      showCancelButton: true,
      confirmButtonColor: '#f06548',
      confirmButtonText: 'Delete forever',
      preConfirm: (typed: string) => {
        if (typed !== expected) {
          Swal.showValidationMessage('Case number does not match.');
          return false;
        }
        return true;
      },
    }).then((result) => {
      if (!result.isConfirmed || !this.case?.id) return;
      this.caseService.deleteCase(this.case.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            Swal.fire({ icon: 'success', title: 'Case deleted', timer: 1500, showConfirmButton: false });
            this.router.navigate(['/legal/cases']);
          },
          error: (err) => Swal.fire({ icon: 'error', title: 'Failed to delete', text: err?.error?.message || 'Could not delete case.' }),
        });
    });
  }

  /** Infer the kind of event from which fields are populated. */
  getEventKind(e: PISettlementEvent): { label: string; tone: string; icon: string } {
    if (e.counterAmount && e.counterAmount > 0) {
      return { label: 'Counter Offer', tone: 'warning', icon: 'ri-exchange-line' };
    }
    if (e.offerAmount && e.offerAmount > 0) {
      return { label: 'Offer Received', tone: 'info', icon: 'ri-mail-download-line' };
    }
    if (e.demandAmount && e.demandAmount > 0) {
      return { label: 'Demand Sent', tone: 'primary', icon: 'ri-mail-send-line' };
    }
    return { label: 'Settlement Event', tone: 'secondary', icon: 'ri-flag-line' };
  }

  // ============================================================
  // DAMAGES — mockup-faithful demo data + multiplier slider state
  // ============================================================
  /** Pain & suffering multiplier (1.5×–4.5× range). Demo state. */
  damagesMultiplier = 2.4;
  setDamagesMultiplier(v: number): void {
    this.damagesMultiplier = Math.max(1.5, Math.min(4.5, v));
  }
  get damagesMultiplierFillPct(): number {
    return Math.round(((this.damagesMultiplier - 1.5) / (4.5 - 1.5)) * 100);
  }
  /**
   * AI-suggested multiplier marker. P1.7 — sourced from
   * {@code medicalSummary.demandScenario.multiplier} when an AI summary has
   * been generated for the case. Falls back to 2.5 (typical PI midpoint) so
   * the slider/marker still renders pre-summary. The value drives the green
   * dot on the multiplier slider, the demand-range KPI hint, and the
   * Damages-tab Pain & Suffering section.
   */
  get damagesAiMultiplier(): number {
    const fromSummary = this.medicalSummary?.demandScenario?.multiplier;
    return Number.isFinite(fromSummary) && (fromSummary as number) > 0
      ? (fromSummary as number)
      : 2.5;
  }
  get damagesAiMultiplierPct(): number {
    return Math.round(((this.damagesAiMultiplier - 1.5) / (4.5 - 1.5)) * 100);
  }

  /** PIP State (left card in ops band). */
  readonly damagesPipState = {
    carrier: 'Progressive', claim: 'PIP-2026-3318',
    limit: 8000, used: 4580, remaining: 3420, deductible: '$200 paid',
    usedPct: 57,
    adjusterInitials: 'LP', adjusterName: 'Lina Park', adjusterExt: 'ext 220', adjusterEmail: 'pip@progressive.com',
  };

  /**
   * Recovery Layers stack (middle card in ops band) — sourced from the live
   * case (P3.4). Three layers: defendant's BI (insurancePolicyLimit), and
   * the plaintiff's UM / UIM coverages (clientInsuranceUm/UimLimit). Width
   * is rendered relative to the largest non-null layer so the bars compare
   * visually. A null/zero layer renders as "n/a · not on file" muted, which
   * is the right cold-start before the intake form has captured coverage.
   *
   * Note: there's no umbrella-policy field on LegalCase yet — the plan
   * mentioned it but the model doesn't carry it; deferred to a future
   * intake/coverage migration if the firm starts tracking umbrellas.
   */
  get damagesRecoveryLayers(): Array<{
    name: string; sub: string; widthPct: number;
    amount: string; muted?: boolean; fillClass: 'bi'|'um'|'uim'
  }> {
    const c = this.case as any;
    const bi  = this.toLayerAmount(c?.insurancePolicyLimit);
    const um  = this.toLayerAmount(c?.clientInsuranceUmLimit);
    const uim = this.toLayerAmount(c?.clientInsuranceUimLimit);
    const max = Math.max(bi.value, um.value, uim.value, 1); // avoid /0
    const widthFor = (v: number) => v > 0 ? Math.round((v / max) * 100) : 28;
    return [
      { name: 'BI',  sub: 'defendant',
        widthPct: widthFor(bi.value), amount: bi.label, muted: bi.value === 0, fillClass: 'bi'  },
      { name: 'UM',  sub: 'plaintiff',
        widthPct: widthFor(um.value), amount: um.label, muted: um.value === 0, fillClass: 'um'  },
      { name: 'UIM', sub: 'plaintiff · stacks',
        widthPct: widthFor(uim.value), amount: uim.label, muted: uim.value === 0, fillClass: 'uim' },
    ];
  }

  /** Helper — formats a coverage limit Double to display + numeric pair. */
  private toLayerAmount(raw: number | null | undefined): { value: number; label: string } {
    const v = Number(raw);
    if (!Number.isFinite(v) || v <= 0) return { value: 0, label: 'n/a' };
    return { value: v, label: this.formatCurrency(v) };
  }

  /** Liens snapshot (right card in ops band). */
  readonly damagesLiensSnapshot: Array<{ name: string; sub: string; amount: string; statusText: string; statusClass: 'neg'|'assert'|'req' }> = [
    { name: 'Blue Cross MA',     sub: 'health subrogation',           amount: '$11,420', statusText: 'Negotiating', statusClass: 'neg' },
    { name: 'Boston General',    sub: 'hospital lien · c. 111 §70A',  amount: '$4,820',  statusText: 'Asserted',    statusClass: 'assert' },
    { name: 'North End Ortho',   sub: 'treatment-on-lien',             amount: '$2,840',  statusText: 'Asserted',    statusClass: 'assert' },
    { name: 'Progressive PIP',   sub: 'offset, not lien',              amount: '$3,760',  statusText: 'Offset',      statusClass: 'req' },
  ];

  /** Specials by Provider stacked-bar legend. */
  readonly damagesSpecialsLegend: Array<{ widthPct: number; color: string; label: string }> = [
    { widthPct: 11.4, color: '#dc2626', label: 'ER · $4,820' },
    { widthPct: 26.9, color: '#6d28d9', label: 'PT · $11,340' },
    { widthPct: 14.7, color: '#a78bfa', label: 'Imaging · $6,200' },
    { widthPct: 6.7,  color: '#0e7490', label: 'Ortho · $2,840' },
    { widthPct: 21.2, color: '#3577f1', label: 'Pain mgmt · $8,960' },
    { widthPct: 1.3,  color: '#15803d', label: 'PCP · $540' },
    { widthPct: 2.8,  color: '#a16207', label: 'Pharmacy · $1,180' },
    { widthPct: 14.9, color: '#0d9488', label: 'Chiro · $6,300' },
  ];

  /** Specials by Provider table rows. */
  readonly damagesSpecialsRows: Array<{ name: string; sub: string; type: string; visits: string; billed: string; allowed: string; lien?: string; lienProv?: 'ai'|'manual'; net: string }> = [
    { name: 'Boston General ER',        sub: 'Dr. K. Reilly',        type: 'Emergency',  visits: '1',   billed: '$4,820',  allowed: '$4,820',  net: '$4,820' },
    { name: 'Cambridge PT & Sports',    sub: 'N. Patel, DPT',        type: 'PT',         visits: '14',  billed: '$11,340', allowed: '$11,340', net: '$11,340' },
    { name: 'Mass Imaging Partners',    sub: 'MRI L-spine + C-spine', type: 'Imaging',   visits: '2',   billed: '$6,200',  allowed: '$5,520',  lien: '$680',  lienProv: 'ai',     net: '$6,200' },
    { name: 'North End Orthopedics',    sub: 'Dr. R. Tanaka',        type: 'Specialist', visits: '3',   billed: '$2,840',  allowed: '$2,840',  net: '$2,840' },
    { name: 'Beacon Pain Management',   sub: 'Dr. L. Schmidt',       type: 'Specialist', visits: '4',   billed: '$8,960',  allowed: '$8,960',  net: '$8,960' },
    { name: 'Suffolk PCP Group',        sub: 'Dr. A. Yusuf',         type: 'PCP',        visits: '2',   billed: '$540',    allowed: '$540',    net: '$540' },
    { name: 'Beacon Pharmacy',          sub: '11 fills',             type: 'Pharmacy',   visits: '11',  billed: '$1,180',  allowed: '$1,180',  net: '$1,180' },
    { name: 'Project AAA Chiropractic', sub: 'Dr. T. Nguyen',        type: 'Chiro',      visits: '8',   billed: '$6,300',  allowed: '$5,800',  lien: '$500', lienProv: 'manual', net: '$6,300' },
  ];

  /** Lost wages rows. */
  readonly damagesWageRows: Array<{ period: string; reason: string; days: string; hourly: string; lost: string; pillClass: 'pill-success'|'pill-warn'; pillText: string }> = [
    { period: 'Apr 16 – Apr 22', reason: 'Acute injury · ER admit + bedrest', days: '5 days', hourly: '$26.30', lost: '$1,052', pillClass: 'pill-success', pillText: 'Verified · employer letter' },
    { period: 'Apr 23 – May 6',  reason: 'PT 3×/wk · partial work limit',     days: '7 days', hourly: '$26.30', lost: '$1,473', pillClass: 'pill-success', pillText: 'Verified · employer letter' },
    { period: 'May 9 (PT scheduled)', reason: 'Ortho consult day',            days: '1 day',  hourly: '$26.30', lost: '$210',   pillClass: 'pill-success', pillText: 'Verified' },
  ];

  /** Other Economic Damages line items. */
  readonly damagesOtherEconomic: Array<{ cat: 'medical'|'wage'|'property'|'oop'|'future'; catLabel: string; name: string; sub: string; amount: string; meta: string }> = [
    { cat: 'property', catLabel: 'Property', name: '2019 Honda Civic LX — total loss', sub: 'Suffolk Auto Body estimate $14,200 · GEICO total at $11,800 · gap $2,400 to insured value', amount: '$6,200', meta: 'final' },
    { cat: 'oop',      catLabel: 'OOP',      name: 'Mileage to medical appointments',   sub: '32 visits × ~14mi avg × IRS rate $0.67/mi', amount: '$300', meta: 'accumulating' },
    { cat: 'oop',      catLabel: 'OOP',      name: 'Prescription co-pays',              sub: '11 fills · client-supplied receipts',       amount: '$184', meta: 'final' },
    { cat: 'oop',      catLabel: 'OOP',      name: 'DME — cervical collar & lumbar support', sub: 'Walgreens · receipt on file',         amount: '$92',  meta: 'final' },
  ];

  /** Liens & Subrogation table rows. */
  readonly damagesLienRows: Array<{
    typePill: 'pill-info'|'pill-purple'|'pill-amber';
    typeLabel: string;
    holder: string; holderSub: string;
    asserted: string;
    negotiated?: string; negotiatedSub?: string;
    final: string; finalSub?: string;
    progress: Array<{ label: string; state: 'done'|'active'|'todo' }>;
    pillMuted?: boolean;
  }> = [
    { typePill: 'pill-info', typeLabel: 'Health insurance',
      holder: 'Blue Cross MA', holderSub: 'subrogation · group #421',
      asserted: '$11,420',
      negotiated: '−$3,997', negotiatedSub: 'negotiated 35%',
      final: '$7,423',
      progress: [{label:'Letter',state:'done'},{label:'Asserted',state:'done'},{label:'Negotiating',state:'active'},{label:'Final',state:'todo'}] },
    { typePill: 'pill-purple', typeLabel: 'Hospital lien',
      holder: 'Boston General Hospital', holderSub: 'M.G.L. c. 111 §70A',
      asserted: '$4,820',
      final: '$4,820', finalSub: 'est.',
      progress: [{label:'Letter',state:'done'},{label:'Asserted',state:'active'},{label:'Negotiating',state:'todo'},{label:'Final',state:'todo'}] },
    { typePill: 'pill-amber', typeLabel: 'Provider lien',
      holder: 'North End Orthopedics', holderSub: 'treatment-on-lien',
      asserted: '$2,840',
      final: '$2,840', finalSub: 'est.',
      progress: [{label:'Letter',state:'done'},{label:'Asserted',state:'active'},{label:'Negotiating',state:'todo'},{label:'Final',state:'todo'}] },
    { typePill: 'pill-info', typeLabel: 'PIP offset',
      holder: 'Progressive', holderSub: 'no-fault · paid-out tracking',
      asserted: '$3,760',
      final: '$0', finalSub: 'offsets demand',
      progress: [],
      pillMuted: true },
  ];

  /** Demand buildup right-rail rows. */
  readonly damagesBuildup: Array<{ label: string; value: string; type?: 'subtotal'|'ps'|'demand'; sub?: string }> = [
    { label: 'Medical specials', value: '$42,180' },
    { label: 'Lost wages',       value: '$8,640' },
    { label: 'Property damage',  value: '$6,200' },
    { label: 'Other / OOP',      value: '$776' },
    { label: 'Economic damages', value: '$57,796', type: 'subtotal' },
    { label: 'Pain & suffering', value: '$137,304', type: 'ps' },
    { label: 'Total demand', sub: 'range $185k–$240k', value: '$195,100', type: 'demand' },
  ];

  /** Net-to-client breakdown rows. */
  readonly damagesNetRows: Array<{ label: string; sub?: string; value: string; cls: 'gross'|'deduct'|'adjustment'|'totals' }> = [
    { label: 'Gross demand',          sub: 'at high end of AI range',  value: '$240,000', cls: 'gross' },
    { label: 'Attorney fees',         sub: '33⅓% contingent',           value: '−$80,000', cls: 'deduct' },
    { label: 'Costs & expenses',      sub: 'filing, expert, records',   value: '−$4,210',  cls: 'deduct' },
    { label: 'Liens (asserted)',      sub: '3 liens',                    value: '−$19,080', cls: 'deduct' },
    { label: 'Lien negotiation',      sub: 'BCBS −35% (est.)',          value: '+$3,997',  cls: 'adjustment' },
    { label: 'PIP offset',            sub: 'reduces gross',              value: '+$243',    cls: 'deduct' },
    { label: 'Net to client',                                            value: '$140,950', cls: 'totals' },
  ];

  /** Settlement scenarios (right rail). */
  readonly damagesScenarios: Array<{ name: string; sub: string; amount: string; active?: boolean }> = [
    { name: '$240,000 demand high',  sub: 'Net to client at AI demand high', amount: '$140,950' },
    { name: '$185,000 authority',    sub: 'Net at current client authority', amount: '$108,420', active: true },
    { name: '$145,000 last counter', sub: "Net at GEICO's most recent offer", amount: '$83,420' },
    { name: '$120,000 floor',        sub: 'Net at lowest acceptable',         amount: '$67,000' },
  ];

  // ============================================================
  // STRATEGY — sidebar navigation + section content registry
  // ============================================================
  /** Active strategy section. */
  strategySection: 'theory'|'liability'|'damages'|'defense'|'expert'|'risk'|'readiness' = 'theory';
  setStrategySection(s: 'theory'|'liability'|'damages'|'defense'|'expert'|'risk'|'readiness'): void {
    this.strategySection = s;
  }

  readonly strategySidebar: Array<{
    key: 'theory'|'liability'|'damages'|'defense'|'expert'|'risk'|'readiness';
    icon: string; label: string;
    count?: string; status: 'done'|'warn'|'empty'|'danger';
  }> = [
    { key: 'theory',    icon: 'ri-quill-pen-line',  label: 'Case theory',          status: 'done' },
    { key: 'liability', icon: 'ri-scales-3-line',   label: 'Liability & causation', status: 'done' },
    { key: 'damages',   icon: 'ri-line-chart-line', label: 'Damages justification', count: '47',   status: 'done' },
    { key: 'defense',   icon: 'ri-sword-line',      label: 'Defense playbook',      count: '5',    status: 'warn' },
    { key: 'expert',    icon: 'ri-user-star-line',  label: 'Expert plan',           count: '3',    status: 'done' },
    { key: 'risk',      icon: 'ri-test-tube-line',  label: 'Risk & EV analysis',    status: 'done' },
    { key: 'readiness', icon: 'ri-mail-send-line',  label: 'Demand readiness',      count: '4/8', status: 'warn' },
  ];

  /** Strategic posture band data. */
  readonly strategyPosture = {
    strengthScore: 78, strengthBand: 'Strong', strengthDashArray: '160 204',
    headline: 'Send demand at <span class="accent">$240k</span>; settle at <span class="accent">≥ $185k</span>; mediate by Nov 4 if direct stalls.',
    body: 'Liability is <strong>accepted</strong>. Damages support a 2.4–2.5× multiplier with one defensible weakness (mild pre-existing degenerative changes, manageable under <em>eggshell plaintiff</em> doctrine). Reach MMI before sending; target <strong>Aug 1 send</strong>.',
    positions: [
      { label: 'Demand',          sub: 'AI high',          value: '$240,000', cls: 'demand' },
      { label: 'Authority',       sub: 'client-confirmed', value: '$185,000', cls: 'authority' },
      { label: 'Walk-away',       sub: 'floor',            value: '$120,000', cls: 'walk' },
      { label: 'Litigation EV',   sub: 'risk-adjusted',     value: '$143,000', cls: 'litigation' },
      { label: 'Expected value',  sub: 'all paths',         value: '$165,000', cls: '' as const },
    ],
  };

  /** Theory — narrative + S/W + recommended sequence. */
  readonly strategyTheoryStrengths: Array<{ title: string; sub: string }> = [
    { title: 'Liability accepted by carrier.',                      sub: 'Marcus Reed (GEICO) confirmed Jun 3 — no comparative-fault assertion.' },
    { title: 'Police citation against defendant.',                  sub: 'Failure to stop in assured clear distance · objective fault marker for jury.' },
    { title: 'MRI-confirmed disc pathology.',                       sub: 'Bulges at C4-C5 and L4-L5 — objective injury, not just subjective complaint.' },
    { title: 'Continuous treatment, zero gaps.',                    sub: '112 days, 32 visits, 0 intervals over 30 days · forecloses mitigation defense.' },
    { title: 'Documented wage loss.',                                sub: '12 days verified by employer letter · W-2 + paystubs in flight.' },
    { title: 'MA collateral source rule applies.',                   sub: 'We can demand <em>billed</em> not <em>allowed</em> amounts — adds ~$1,180 to specials.' },
  ];
  readonly strategyTheoryWeaknesses: Array<{ title: string; sub: string }> = [
    { title: 'MMI not yet declared.',                                sub: 'Defense will argue "treatment ongoing — not at maximum recovery." Wait until Jun 18 ortho re-eval.' },
    { title: 'Pre-existing degenerative changes (mild).',           sub: 'MRI noted age-consistent disc disease at C5-C6 not linked to MVA. Mitigated by eggshell plaintiff doctrine.' },
    { title: 'No surgical recommendation.',                          sub: 'Caps multiplier upside; defense will argue soft-tissue only.' },
    { title: 'Chiropractic visits (8).',                            sub: 'Defense often attacks chiropractic post-MVA as gratuitous; PT visits are stronger evidence.' },
  ];
  readonly strategyRecommendations: Array<{ stage: string; body: string }> = [
    { stage: 'Stage 3 (now):',          body: 'Continue treatment to MMI · push wage-loss verification · request final records from North End Ortho &amp; Beacon Pain by Jun 24.' },
    { stage: 'Stage 4 (post-MMI):',     body: 'Lock specials · run damages calculation worksheet · partner review · target demand send <strong>Aug 1, 2026</strong>.' },
    { stage: 'Stage 5–6:',              body: 'Allow 30-day adjuster response window. If counter is below $145k, prep mediation for <strong>Nov 4</strong>. If still gridlocked by <strong>Dec 1</strong>, file suit (SOL Apr 16, 2029 — comfortable runway).' },
  ];

  /** Liability — causation chain. */
  readonly strategyCausationChain: Array<{ injury: string; code: string; link: string; strength: 'strong'|'medium'|'weak'; strengthLabel: string }> = [
    { injury: 'Cervical sprain', code: 'S13.4XXA',
      link: 'Direct mechanism — rear-end impact transferred kinetic energy to cervical spine. ER same-day intake at Boston General confirmed soft-tissue injury. <strong>MRI 5/4 confirmed disc bulge C4-C5.</strong> No pre-MVA cervical complaints in PCP records.',
      strength: 'strong', strengthLabel: 'Strong' },
    { injury: 'Lumbar sprain', code: 'S33.5XXA',
      link: 'Direct mechanism — same impact, lumbar engagement. ER chart documents lumbar tenderness same day. <strong>MRI 5/28 confirmed disc bulge L4-L5.</strong> No pre-MVA lumbar complaints.',
      strength: 'strong', strengthLabel: 'Strong' },
    { injury: 'Cervical disc disease', code: 'M50.30',
      link: 'Defense will argue contribution — MRI flagged mild degenerative changes consistent with age. <strong>Eggshell plaintiff doctrine</strong> (<em>McCarthy v. Nat\'l Distillers Prods.</em>) — defendant takes plaintiff as found. Pre-existing was asymptomatic; MVA was the trigger.',
      strength: 'medium', strengthLabel: 'Medium' },
    { injury: 'Chronic post-traumatic pain', code: 'G89.29',
      link: 'Pain management diagnosis (Dr. Schmidt). 4 trigger-point injections over 6 weeks. Continued at 112 days post-DOL with no resolution. Sleep disruption and reduced ROM document chronicity.',
      strength: 'strong', strengthLabel: 'Strong' },
    { injury: 'Lost earning capacity', code: 'future, contingent',
      link: 'Past lost wages confirmed for 12 days. Future earning-capacity loss <strong>not currently claimed</strong>. Engage vocational expert only if MMI reveals permanent restrictions.',
      strength: 'weak', strengthLabel: 'Contingent' },
  ];

  /** Damages justification — plaintiff/defense args. */
  readonly strategyArgsPlaintiff: Array<{ title: string; body: string }> = [
    { title: 'Objective injury.',           body: 'MRI-confirmed disc bulges (C4-C5, L4-L5) — not subjective complaint.' },
    { title: 'Substantial treatment.',      body: '32 visits across 8 providers in 112 days.' },
    { title: 'Active interventional care.', body: '4 trigger-point injections — escalation beyond conservative PT.' },
    { title: 'Documented work loss.',       body: '12 days verified · employer cooperation.' },
    { title: 'Measurable impairment.',      body: 'ROM restricted to 75% baseline at 112 days.' },
    { title: 'Chronic course.',             body: 'No resolution after 4 months — not a sprain that healed.' },
  ];
  readonly strategyArgsDefense: Array<{ title: string; body: string }> = [
    { title: 'Soft-tissue only.',           body: 'No fracture, no surgical recommendation, no permanent impairment finding.' },
    { title: 'Pre-existing changes.',       body: 'MRI flags age-consistent degenerative disc disease — could inflate multiplier.' },
    { title: 'Improvement trajectory.',     body: 'ROM improved from 50% (May) to 75% (Jun) — recovery in progress.' },
    { title: 'Returned to work.',           body: 'Plaintiff resumed work after only 12 days — limits hedonic damage claim.' },
    { title: 'Chiropractic visits.',        body: '8 chiro visits often attacked as gratuitous in MA practice.' },
  ];

  /** Comparable cases. */
  readonly strategyComparables: Array<{ name: string; court: string; outcomeKind: string; amount: string; facts: string; matchPct: number }> = [
    { name: 'Smith v. Allstate', court: 'Suffolk Superior · 2024 settle', outcomeKind: 'settlement', amount: '$187,000',
      facts: '<strong>Female 38</strong> · rear-end · MRI disc bulge L4-L5 · 28 visits PT + ortho · no surgery · employed accountant · 14 days lost wages.', matchPct: 92 },
    { name: 'Garcia v. State Farm', court: 'Suffolk Superior · 2023 settle', outcomeKind: 'settlement', amount: '$245,000',
      facts: '<strong>Female 41</strong> · rear-end · MRI disc bulge C5-C6 + L5-S1 · 38 visits · trigger-point injections · <strong>surgical recommendation declined</strong> · 18 days work loss.', matchPct: 88 },
    { name: 'Choi v. Liberty Mutual', court: 'Middlesex Superior · 2024 settle', outcomeKind: 'settlement', amount: '$158,000',
      facts: 'Female 33 · rear-end · MRI disc bulge L4-L5 · 22 visits · <strong>45-day treatment gap</strong> (defense argued mitigation) · employed.', matchPct: 82 },
    { name: "O'Brien v. Progressive", court: 'Suffolk Superior · 2024 verdict', outcomeKind: 'jury verdict', amount: '$214,500',
      facts: 'Female 36 · rear-end · MRI disc bulge C4-C5 · 30 visits · <strong>gone to verdict</strong> · jury awarded specials × 2.6 multiplier.', matchPct: 86 },
    { name: 'Tran v. GEICO', court: 'Norfolk Superior · 2023 settle', outcomeKind: 'settlement', amount: '$165,000',
      facts: 'Female 39 · rear-end · cervical strain · <strong>no MRI</strong> · 24 visits · 8 days work loss · soft-tissue only.', matchPct: 78 },
    { name: 'Davis v. Travelers', court: 'Suffolk Superior · 2024 mediation', outcomeKind: 'mediation', amount: '$201,500',
      facts: 'Female 34 · rear-end · MRI disc protrusion L5-S1 · 35 visits · trigger-point injections · employed paralegal.', matchPct: 90 },
  ];

  /** Percentile distribution. */
  readonly strategyPercentiles: Array<{ name: string; widthPct: number; amount: string; thisCase?: boolean; markerLeftPct?: number }> = [
    { name: '10th percentile', widthPct: 18, amount: '$78,000' },
    { name: '25th percentile', widthPct: 32, amount: '$118,000' },
    { name: 'Median',          widthPct: 48, amount: '$165,000' },
    { name: 'This case (AI)',  widthPct: 62, amount: '$210,000', thisCase: true, markerLeftPct: 62 },
    { name: '75th percentile', widthPct: 72, amount: '$245,000' },
    { name: '90th percentile', widthPct: 92, amount: '$310,000' },
  ];

  /** Defense playbook entries. */
  readonly strategyDefenses: Array<{
    title: string; severity: 'high'|'med'|'low'; severityLabel: string;
    attack: string; response: string; mitigationHtml: string;
  }> = [
    { title: 'Pre-existing degenerative changes', severity: 'high', severityLabel: 'High severity',
      attack: '"MRI shows mild degenerative disc disease at C5-C6 consistent with age. Plaintiff\'s pain is aggravation of pre-existing condition, not new injury caused by MVA. Damages must be apportioned."',
      response: '<strong>Eggshell plaintiff doctrine</strong> (<em>McCarthy v. Nat\'l Distillers</em>, 1956) — defendant takes plaintiff as he finds her. Pre-existing was asymptomatic; MVA was the trigger. PCP records pre-DOL show no neck/back complaints. Treating providers consistently attribute symptoms to MVA mechanism.',
      mitigationHtml: '✓ Pull all PCP records 3 years pre-DOL — confirm no prior complaints<br>⏳ Request "causation" letter from Dr. Tanaka explicitly tying disc bulges to MVA<br>⏳ Have Dr. Yusuf (PCP) document pre-MVA baseline in deposition if litigated' },
    { title: 'Multiplier inflation argument', severity: 'med', severityLabel: 'Medium severity',
      attack: '"Soft-tissue cervical/lumbar strain with no surgical lesion warrants 1.5–2.0× multiplier, not 2.5×. Plaintiff returned to work after 12 days. ROM improving."',
      response: 'MRI-confirmed disc bulges are objective evidence beyond soft-tissue. 4 trigger-point injections demonstrate escalation beyond conservative care. <em>Garcia v. State Farm</em> ($245k Suffolk 2023) settled at 2.7× with similar profile. Per-diem method yields $118k regardless of multiplier dispute.',
      mitigationHtml: '✓ Lead demand with multiplier of 2.5× and substitute per-diem table<br>⏳ Cite top-quartile comparables (Garcia, Davis, O\'Brien) explicitly in demand letter<br>⏳ Document MMI plateau before sending — strengthens chronicity argument' },
    { title: 'Chiropractic-treatment attack', severity: 'med', severityLabel: 'Medium severity',
      attack: '"8 chiropractic visits with Project AAA Chiropractic ($6,300) are gratuitous in light of concurrent PT. MA juries skeptical of chiro stacking on PT post-MVA."',
      response: 'Chiropractic preceded PT escalation; modalities are complementary not duplicative. Provider notes document distinct treatment goals. Plaintiff was discharged from chiro Jun 4 — not perpetual care.',
      mitigationHtml: '⏳ Consider de-emphasizing chiro line in demand letter narrative (still claim specials, but minimize prominence)<br>⏳ Lead demand-letter narrative with PT + ortho + pain mgmt; chiro as secondary detail' },
    { title: 'MMI not yet declared', severity: 'low', severityLabel: 'Low (timing only)',
      attack: '"Plaintiff has not reached maximum medical improvement. Demand is premature; values cannot be locked. Negotiation should await final treatment status."',
      response: 'Resolved by waiting until MMI before sending. Ortho re-eval Jun 18 likely to declare MMI. Demand send Aug 1 leaves comfortable runway.',
      mitigationHtml: '⏳ Confirm MMI declaration at Jun 18 ortho appointment<br>⏳ Do not send demand before MMI confirmation<br>✓ Target Aug 1 send respects MMI timing' },
    { title: 'Wage-loss verification challenge', severity: 'low', severityLabel: 'Low',
      attack: '"Wage-loss claim of $8,640 is incomplete — employer letter alone insufficient. Need W-2, paystubs, tax returns to verify pre-injury baseline income."',
      response: 'W-2 and paystubs in flight (request sent May 6). Tax authorization (4506-T) still unsigned but optional once paystubs verify income. Acme HR cooperative.',
      mitigationHtml: '⏳ <strong>Get tax authorization signed</strong> via client portal — needed for full income verification<br>⏳ Follow up with Acme HR for paystubs + W-2 by Jun 30<br>✓ Have employer letter on file — bridge document' },
  ];

  /** Expert plan. */
  readonly strategyExperts: Array<{
    icon: string; iconCls: 'neutral'|'amber'|'primary';
    title: string; sub: string;
    statusClass: 'skip'|'hold'|'engaged'|'consider'; statusLabel: string;
    triggerHtml: string;
    metaRows: Array<{ k: string; v: string }>;
  }> = [
    { icon: 'ri-microscope-line', iconCls: 'neutral',
      title: 'Accident reconstructionist', sub: 'Liability-related expert',
      statusClass: 'skip', statusLabel: 'Not needed',
      triggerHtml: '<strong>Reasoning:</strong> Liability accepted by GEICO with police citation against defendant. No comparative-fault claim. Mechanism is undisputed. Reconstruction would add cost without strategic value.<br><br><strong>Trigger to revisit:</strong> Only if defense reverses position on liability — no current indicators.',
      metaRows: [{k:'Cost (avoided)', v:'$4,000–$8,000'},{k:'Decision', v:'Skip'},{k:'By', v:'D. Altman · May 14'}] },
    { icon: 'ri-briefcase-4-line', iconCls: 'amber',
      title: 'Vocational expert', sub: 'Future earning capacity',
      statusClass: 'hold', statusLabel: 'On hold · pending MMI',
      triggerHtml: '<strong>Decision rule:</strong> Engage vocational expert <em>only if</em> MMI examination (Jun 18) reveals permanent restrictions affecting plaintiff\'s ability to perform her accountant duties or limits future earning capacity.<br><br><strong>Current expectation:</strong> Soft-tissue with improving ROM trajectory unlikely to produce permanent restrictions. Probability of engagement ~25%.<br><br><strong>If engaged:</strong> Adds future earning-capacity claim of est. $80–$150k to demand. Vocational expert testimony admissible per <em>MA R. Evid. 702</em>.',
      metaRows: [{k:'Cost', v:'$3,500 + $200/hr'},{k:'Decision deadline', v:'30d post-MMI'},{k:'Status', v:'Awaiting MMI'}] },
    { icon: 'ri-stethoscope-line', iconCls: 'primary',
      title: 'Medical expert (orthopedist)', sub: 'Causation & prognosis · for trial only',
      statusClass: 'consider', statusLabel: 'For litigation only',
      triggerHtml: '<strong>Decision rule:</strong> Treating providers\' records and Dr. Tanaka\'s ortho consult are sufficient for the demand letter. Engage retained medical expert <em>only if</em> case proceeds to litigation and we need testimony beyond what treating providers will offer.<br><br><strong>If retained:</strong> Will opine on (i) causation linking MVA to disc bulges, (ii) prognosis for chronic post-traumatic pain, (iii) defensibility of multiplier in front of jury.<br><br><strong>Bridge for now:</strong> Request "causation letter" from Dr. Tanaka tying disc bulges to MVA — costs $250-500 and may suffice for demand purposes.',
      metaRows: [{k:'Records review', v:'$5,000'},{k:'Testimony', v:'$400/hr'},{k:'Trigger', v:'Suit filed'}] },
  ];

  /** Risk & EV analysis rows. */
  readonly strategyEvRows: Array<{
    name: string; sub: string;
    probabilityPct: number; probabilityNote: string;
    amount: string; amountSub: string;
    contribution: string; recommended?: boolean;
  }> = [
    { name: 'Direct settlement',  sub: 'without mediation or suit', probabilityPct: 60, probabilityNote: '3–4 months · most likely path given liability acceptance', amount: '$175,000', amountSub: 'expected settle', contribution: '$105,000' },
    { name: 'Mediation',           sub: 'JAMS Boston · Nov 4 slot',  probabilityPct: 20, probabilityNote: '5–7 months · used if direct stalls below $145k',          amount: '$195,000', amountSub: 'expected settle', contribution: '$39,000' },
    { name: 'File suit + try',     sub: 'Suffolk Superior',          probabilityPct: 15, probabilityNote: '12–18 months · win rate ~70% · $25k expert/depo costs',  amount: '$143,000', amountSub: 'risk-adj. EV',    contribution: '$21,450' },
    { name: 'Walk away',            sub: 'case dropped or unrecoverable', probabilityPct: 5, probabilityNote: 'unlikely · would require defense reversal on liability', amount: '$0',       amountSub: 'net',             contribution: '$0' },
  ];

  /** Demand readiness checklist. */
  readonly strategyReadinessRing = { pct: 50, dashArray: '69 138', count: '4 of 8', target: 'Aug 1, 2026', daysLeft: 94 };
  readonly strategyReadinessChecklist: Array<{ name: string; meta: string; state: 'done'|'review'|'todo'; pillClass: 'pill-success'|'pill-info'|'pill-muted'; pillText: string }> = [
    { name: 'Medical narrative summary', meta: 'Generated Jul 19 · reviewed by D. Altman · attached to draft folder',                state: 'done',   pillClass: 'pill-success', pillText: 'Complete' },
    { name: 'Itemized billing summary',  meta: '$61,420 specials · 8 providers · UB-04 forms received except Beacon Pain',           state: 'done',   pillClass: 'pill-success', pillText: 'Complete' },
    { name: 'Photo & scene exhibit',     meta: '14 photos selected · scene + vehicle damage · client portal sourced',                state: 'done',   pillClass: 'pill-success', pillText: 'Complete' },
    { name: 'Liability narrative',       meta: 'Police report + witness statement incorporated · cited M.G.L. c. 89 §4A',           state: 'done',   pillClass: 'pill-success', pillText: 'Complete' },
    { name: 'Wage-loss documentation',   meta: 'W-2 received May 11 · paystubs requested May 6 (in flight) · tax auth not signed',  state: 'review', pillClass: 'pill-info',    pillText: 'In progress' },
    { name: 'Pain & suffering narrative', meta: 'Draft generated Jul 22 · awaiting partner review (sent to S. Kim)',                state: 'review', pillClass: 'pill-info',    pillText: 'Partner review' },
    { name: 'Demand calculation worksheet', meta: 'Run AI multiplier model · lock multiplier · partner-approved range · target Jul 28', state: 'todo', pillClass: 'pill-muted',  pillText: 'To do' },
    { name: 'Demand letter draft',        meta: 'Generate from above components when complete · partner sign-off required · target Jul 30', state: 'todo', pillClass: 'pill-muted', pillText: 'To do' },
  ];

  // ============================================================
  // ACTIVITY — communication health + filtered event feed
  // ============================================================
  /** Communication-health top band data. */
  /**
   * P5 — View-model for the Activity-tab 3-card health band. Synthesized
   * from {@link commHealth} when the backend has answered, falling back to
   * the design mock so the UI always renders. Display strings are formatted
   * here (hours → "6 hrs" / "2 days") so the template stays declarative.
   *
   * The mock fallback is intentional, not lazy — it's the empty-state
   * design and gives demo cases a meaningful look until real comm data
   * starts populating.
   */
  get activityHealth(): {
    avgResponseTime: string;
    lastAdjusterContact: string; adjusterName: string;
    longestIdle: string;
    awaitingCount: number; awaitingOldest: string;
    awaitingItems: Array<{ name: string; age: string; ageClass: 'dng' | 'warn' | '' }>;
    volumeNum: number; volumeLabel: string;
    volumeMix: Array<{ widthPct: number; color: string; label: string }>;
  } {
    const h = this.commHealth;
    if (!h) {
      // Pre-load AND error path. Returning the design mock here was wrong:
      // a transient 500 would silently surface fake party names ("M. Reed
      // (GEICO)", "Acme HR · re: paystubs") as if they were real comms.
      // Empty-state values let the cards render visibly empty so the user
      // notices something's missing instead of being deceived.
      return this.activityHealthEmpty;
    }
    // Build awaiting items (top 5 from the API, formatted into display rows)
    const awaitingItems = (h.awaitingItems ?? []).map(item => ({
      name: item.name,
      age: this.formatHoursLabel(item.ageHours),
      ageClass: this.awaitingAgeClass(item.ageHours),
    }));
    // Volume mix derived from typeBreakdown — sum to total then normalize
    const total = Math.max(1, h.volume14d);
    const mixColors: { [k: string]: string } = {
      EMAIL: 'var(--vz-info)',
      CALL: 'var(--vz-success)',
      LETTER: '#6d28d9',
      MEETING: '#b45309',
      IN_PERSON: '#0d9488',
      OTHER: 'var(--vz-secondary-color)',
    };
    const volumeMix = Object.entries(h.typeBreakdown ?? {}).map(([type, count]) => ({
      widthPct: Math.round((count / total) * 1000) / 10,
      color: mixColors[type] ?? mixColors['OTHER'],
      label: `${this.titleCase(type)} ${count}`,
    }));

    return {
      avgResponseTime: h.avgResponseHours != null
        ? this.formatHoursLabel(h.avgResponseHours)
        : '—',
      // Surfaces under a "Last inbound" label in the template (not "Last
      // adjuster contact") because the backend doesn't yet identify which
      // counterparty is the adjuster. Mislabeling would be worse than
      // labeling generically.
      lastAdjusterContact: h.lastInboundAt
        ? this.formatRelativeAge(h.lastInboundAt)
        : '—',
      adjusterName: '', // template's <small> is *ngIf'd off when empty
      longestIdle: h.oldestAwaitingAgeHours != null
        ? this.formatHoursLabel(h.oldestAwaitingAgeHours)
        : '—',
      awaitingCount: h.awaitingReplyCount,
      awaitingOldest: h.oldestAwaitingAgeHours != null
        ? this.formatHoursLabel(h.oldestAwaitingAgeHours)
        : '—',
      awaitingItems,
      volumeNum: h.volume14d,
      volumeLabel: h.volume14d === 1
        ? '1 communication past 14 days'
        : `${h.volume14d} communications past 14 days`,
      // Empty-case (legitimate cold-start: no comms) renders an empty bar
      // rather than the design mock — fake bars on a real case mislead
      // attorneys into thinking activity exists where it doesn't.
      volumeMix,
    };
  }

  /**
   * Empty-state shape returned by the getter when {@link commHealth} is
   * null (pre-load or HTTP failure). All numerics zero, all collections
   * empty, all display strings "—" — the cards render visibly empty so
   * the user can tell data is unavailable rather than being shown
   * fabricated values.
   *
   * Note: `activityHealthMock` was the previous fallback but it leaked
   * fake party names ("M. Reed (GEICO)", "Acme HR · re: paystubs") into
   * the UI on transient errors. P5 reviewer flagged the deception risk.
   */
  private readonly activityHealthEmpty = {
    avgResponseTime: '—',
    lastAdjusterContact: '—',
    adjusterName: '',
    longestIdle: '—',
    awaitingCount: 0,
    awaitingOldest: '—',
    awaitingItems: [] as Array<{ name: string; age: string; ageClass: 'dng' | 'warn' | '' }>,
    volumeNum: 0,
    volumeLabel: 'communications past 14 days',
    volumeMix: [] as Array<{ widthPct: number; color: string; label: string }>,
  };

  /** Hours → human label: "<1h" / "5h" / "2 days". */
  private formatHoursLabel(hours: number | null | undefined): string {
    if (hours == null || !Number.isFinite(hours)) return '—';
    if (hours < 1) return '<1h';
    if (hours < 24) return `${Math.round(hours)}h`;
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? '' : 's'}`;
  }

  /** Age class for awaiting-reply rows: red after 24h, amber after 8h. */
  private awaitingAgeClass(hours: number | null | undefined): 'dng' | 'warn' | '' {
    if (hours == null) return '';
    if (hours >= 24) return 'dng';
    if (hours >= 8)  return 'warn';
    return '';
  }

  /** ISO timestamp → "3 hrs ago" / "2 days ago". */
  private formatRelativeAge(iso: string | null | undefined): string {
    if (!iso) return '—';
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return '—';
    const hours = (Date.now() - then) / (1000 * 60 * 60);
    if (hours < 1) return 'just now';
    return this.formatHoursLabel(hours) + ' ago';
  }

  /** "EMAIL" → "Email", "IN_PERSON" → "In person". */
  private titleCase(s: string): string {
    if (!s) return s;
    return s.split('_').map(w =>
      w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join(' ');
  }

  /** Filter chips (visual only). */
  readonly activityFilterChips: Array<{ key: string; label: string; count: number; active: boolean; dotCls: string }> = [
    { key: 'communications', label: 'Communications', count: 94, active: true,  dotCls: 'communications' },
    { key: 'documents',      label: 'Documents',      count: 62, active: true,  dotCls: 'documents' },
    { key: 'casestate',      label: 'Case state',     count: 14, active: true,  dotCls: 'casestate' },
    { key: 'tasks',          label: 'Tasks',          count: 38, active: true,  dotCls: 'tasks' },
    { key: 'notes',          label: 'Notes',          count: 22, active: true,  dotCls: 'notes' },
    { key: 'system',         label: 'System',         count: 34, active: false, dotCls: 'system' },
  ];
  toggleActivityChip(c: { active: boolean }): void { c.active = !c.active; }

  /** Smart-view tabs. */
  activitySmartView: 'all'|'awaiting'|'starred'|'byMe'|'byPara'|'inbound'|'outbound' = 'all';
  setActivitySmartView(v: 'all'|'awaiting'|'starred'|'byMe'|'byPara'|'inbound'|'outbound'): void { this.activitySmartView = v; }
  readonly activitySmartViews: Array<{ key: 'all'|'awaiting'|'starred'|'byMe'|'byPara'|'inbound'|'outbound'; icon: string; label: string; count: number; warn?: boolean }> = [
    { key: 'all',      icon: 'ri-stack-line',         label: 'All',              count: 32 },
    { key: 'awaiting', icon: 'ri-mail-unread-line',   label: 'Awaiting reply',  count: 3, warn: true },
    { key: 'starred',  icon: 'ri-star-line',          label: 'Starred',         count: 2 },
    { key: 'byMe',     icon: 'ri-user-line',          label: 'By me',           count: 14 },
    { key: 'byPara',   icon: 'ri-team-line',          label: 'By paralegal',    count: 11 },
    { key: 'inbound',  icon: 'ri-mail-check-line',    label: 'Inbound only',    count: 8 },
    { key: 'outbound', icon: 'ri-mail-send-line',     label: 'Outbound only',   count: 17 },
  ];

  /** Active inbound/outbound seg-control. */
  activityDirection: 'all'|'outbound'|'inbound' = 'all';
  setActivityDirection(d: 'all'|'outbound'|'inbound'): void { this.activityDirection = d; }

  /** Day-grouped event feed (mockup-faithful). */
  readonly activityFeed: Array<{
    day: string; dow: string; stat: string;
    events: Array<{
      id: string;
      time: string;
      iconType: 'communications'|'documents'|'casestate'|'tasks'|'notes'|'system';
      icon: string;
      direction: 'outbound'|'inbound'|'internal'|'system';
      directionIcon: string;
      title: string; titleHtml?: string;
      detail: string;
      meta: Array<{ partyClass?: string; partyIcon?: string; text: string }>;
      who: string; channel: string;
      milestone?: boolean;
      awaiting?: boolean; awaitingAge?: string;
      bodyHtml?: string;
      attachments?: Array<{ icon: string; label: string }>;
      actions?: Array<{ icon: string; label: string }>;
      related?: Array<{ label: string }>;
    }>;
  }> = [
    { day: 'Today · Oct 16', dow: 'Wednesday', stat: '5 events · 2 comms · 1 milestone · 2 notes', events: [
      { id: 'a1', time: '9:30 am', iconType: 'communications', icon: 'ri-phone-line',
        direction: 'outbound', directionIcon: 'ri-arrow-up-line',
        title: 'Call w/ client to discuss $145k counter',
        detail: '22-min call. Reviewed demand range, comparable cases, defense arguments.',
        meta: [{ partyClass: 'party-client', partyIcon: 'ri-user-line', text: 'Sarah Mitchell' },{ text: '22 min' }],
        who: 'D. Altman', channel: 'phone',
        bodyHtml: '<p>22-minute call with client to walk through GEICO\'s $145k counter offer received Oct 14.</p><p>Reviewed: demand range posture (current $200k recommended, AI high $240k, authority $185k); comparable cases <em>Smith v. Allstate</em> ($187k Suffolk 2024) and <em>Garcia v. State Farm</em> ($245k Suffolk 2023); defense arguments around pre-existing degenerative changes and chiropractic visits.</p><p><strong>Client confirmed authority to settle at $185,000</strong> · would consider $170k floor for quick close. Noted preference to avoid mediation if direct negotiation can resolve. Asked about projected disbursement at each scenario.</p>',
        attachments: [{ icon: 'ri-file-text-line', label: 'call-notes-oct16.txt · 4 KB' }],
        actions: [{ icon: 'ri-edit-line', label: 'Edit notes' },{ icon: 'ri-printer-line', label: 'Print' },{ icon: 'ri-share-line', label: 'Share' },{ icon: 'ri-delete-bin-line', label: 'Delete' }],
        related: [{ label: '→ Strategy · Risk & EV' },{ label: '→ Damages · Settlement scenarios' }] },
      { id: 'a2', time: '9:14 am', iconType: 'notes', icon: 'ri-sticky-note-line',
        direction: 'internal', directionIcon: 'ri-circle-fill',
        title: 'Note added · "Adjuster posture shifting"',
        detail: 'M. Reed seems newly receptive to mediation framing — could be opportunity to push toward Nov 4 slot if direct fails.',
        meta: [{ text: 'Internal' },{ text: 'D. Altman' }],
        who: 'D. Altman', channel: 'internal note' },
      { id: 'a3', time: '8:45 am', iconType: 'casestate', icon: 'ri-shield-check-line',
        direction: 'system', directionIcon: 'ri-flashlight-line',
        title: 'Milestone · Client authority confirmed at $185,000',
        titleHtml: 'Milestone · Client authority confirmed at <strong>$185,000</strong>',
        detail: 'Auto-detected from call w/ client (9:30am note). Authority recorded; settlement scenarios on Damages tab updated.',
        meta: [{ partyClass: 'party-system', text: 'System' },{ text: 'auto-derived' }],
        who: 'System', channel: 'auto-derived',
        milestone: true },
      { id: 'a4', time: '7:18 am', iconType: 'communications', icon: 'ri-mail-line',
        direction: 'outbound', directionIcon: 'ri-arrow-up-line',
        title: 'Email to Karen Foster, Esq. (defense counsel)',
        titleHtml: 'Email to <em>Karen Foster, Esq.</em> (defense counsel)',
        detail: 'Forwarded supplemental medical records from North End Orthopedics to facilitate $145k counter response.',
        meta: [{ partyClass: 'party-defense', partyIcon: 'ri-shield-user-line', text: 'Defense' }],
        who: 'Paralegal', channel: 'email' },
      { id: 'a5', time: '7:02 am', iconType: 'notes', icon: 'ri-sticky-note-line',
        direction: 'internal', directionIcon: 'ri-circle-fill',
        title: 'Note added · "Mediator pre-screen call"',
        detail: 'Spoke briefly w/ JAMS scheduler re: Nov 4 slot. Confirmed availability; will hold pending Oct 21 deadline.',
        meta: [{ text: 'Internal' }],
        who: 'D. Altman', channel: 'internal note' },
    ]},
    { day: 'Yesterday · Oct 15', dow: 'Tuesday', stat: '3 events · all comms', events: [
      { id: 'b1', time: '4:42 pm', iconType: 'communications', icon: 'ri-phone-line',
        direction: 'outbound', directionIcon: 'ri-arrow-up-line',
        title: 'Voicemail to M. Reed · GEICO',
        titleHtml: 'Voicemail to <em>M. Reed</em> · GEICO',
        detail: 'Confirmed receipt of Oct 14 counter; flagged need to discuss before adjuster\'s typical 7-day response window expires.',
        meta: [{ partyClass: 'party-adjuster', text: 'Adjuster' },{ text: '2 min' }],
        who: 'D. Altman', channel: 'phone (vm)' },
      { id: 'b2', time: '2:30 pm', iconType: 'communications', icon: 'ri-mail-line',
        direction: 'outbound', directionIcon: 'ri-arrow-up-line',
        title: 'Email to Acme Inc · HR dept',
        titleHtml: 'Email to <em>Acme Inc · HR dept</em>',
        detail: 'Follow-up on outstanding paystub request; demanded delivery by Oct 22 to support demand calc finalization.',
        meta: [{ partyClass: 'party-internal', text: 'Employer' }],
        who: 'Paralegal', channel: 'email' },
      { id: 'b3', time: '10:12 am', iconType: 'communications', icon: 'ri-phone-line',
        direction: 'inbound', directionIcon: 'ri-arrow-down-line',
        title: 'Call from client (Sarah Mitchell)',
        titleHtml: 'Call from <em>client (Sarah Mitchell)</em>',
        detail: 'Quick check-in regarding $145k counter received Oct 14. Asked to schedule full discussion call for tomorrow morning.',
        meta: [{ partyClass: 'party-client', partyIcon: 'ri-user-line', text: 'Sarah Mitchell' },{ text: '4 min' }],
        who: 'D. Altman', channel: 'phone' },
    ]},
    { day: 'Oct 14', dow: 'Monday', stat: 'awaiting-reply highlights', events: [
      { id: 'c1', time: '2:42 pm', iconType: 'communications', icon: 'ri-mail-line',
        direction: 'inbound', directionIcon: 'ri-arrow-down-line',
        title: 'Email from Acme HR · re: paystub request',
        titleHtml: 'Email from <em>Acme HR</em> · re: paystub request',
        detail: '"We received your request. Please confirm which pay periods you need. Standard turnaround is 5-7 business days from confirmation."',
        meta: [{ partyClass: 'party-internal', partyIcon: 'ri-building-line', text: 'Acme HR' }],
        who: 'Inbox', channel: 'email',
        awaiting: true, awaitingAge: '2 days' },
      { id: 'c2', time: '11:30 am', iconType: 'communications', icon: 'ri-fax-fill',
        direction: 'inbound', directionIcon: 'ri-arrow-down-line',
        title: 'Fax from Beacon Pain Management · re: UB-04 request',
        titleHtml: 'Fax from <em>Beacon Pain Management</em> · re: UB-04 request',
        detail: '"Records request received. Please complete attached HIPAA authorization form including specific dates of service and we will process within 10 business days."',
        meta: [{ partyClass: 'party-provider', partyIcon: 'ri-hospital-line', text: 'Beacon Pain' }],
        who: 'Inbox', channel: 'fax',
        awaiting: true, awaitingAge: '10 hrs' },
    ]},
    { day: 'Oct 14', dow: 'Monday', stat: '4 events · 1 milestone · 2 comms · 1 doc', events: [
      { id: 'd1', time: '2:14 pm', iconType: 'casestate', icon: 'ri-arrow-down-line',
        direction: 'inbound', directionIcon: 'ri-arrow-down-line',
        title: 'Milestone · Counter offer received · $145,000',
        titleHtml: 'Milestone · Counter offer received · <strong>$145,000</strong>',
        detail: 'From M. Reed (GEICO). Cited Suffolk soft-tissue verdict comparables. Requested supplemental treatment notes.',
        meta: [{ partyClass: 'party-adjuster', text: 'Adjuster' },{ partyClass: 'party-system', text: 'Auto-logged offer' }],
        who: 'M. Reed (GEICO)', channel: 'email',
        milestone: true,
        bodyHtml: '<p>3-paragraph email response to our Oct 7 demand of $215,000.</p><p>Adjuster\'s stated rationale: "I\'ve reviewed your demand and considered the comparable Suffolk County jury verdicts you cited. While the medical specials are well-documented, our position is that the multiplier of 2.4 is excessive given the soft-tissue characterization and the absence of any surgical recommendation. Pre-existing degenerative changes documented on the C-spine MRI also support apportionment."</p><p>Counter: <strong>$145,000</strong>. Asked for supplemental treatment notes from North End Orthopedics (delivered Oct 16) and questioned whether plaintiff has reached MMI.</p><p><em>Auto-logged to Damages → Settlement scenarios. Auto-updated negotiation gap from N/A to $55,000.</em></p>',
        attachments: [{ icon: 'ri-mail-line', label: 'geico-counter-oct14.eml · 12 KB' },{ icon: 'ri-file-text-line', label: 'geico-rationale-attachment.pdf · 4 pp' }],
        actions: [{ icon: 'ri-mail-send-line', label: 'Reply' },{ icon: 'ri-edit-line', label: 'Edit log entry' },{ icon: 'ri-printer-line', label: 'Print' }],
        related: [{ label: '→ Damages · Settlement scenarios updated' },{ label: '→ Strategy · Defense playbook (multiplier inflation)' },{ label: '→ Decision panel · Overview Stage 6' }] },
      { id: 'd2', time: '2:14 pm', iconType: 'documents', icon: 'ri-file-text-line',
        direction: 'system', directionIcon: 'ri-flashlight-line',
        title: 'Document scanned & extracted · geico-counter-oct14.eml',
        titleHtml: 'Document scanned &amp; extracted · <em>geico-counter-oct14.eml</em>',
        detail: 'AI extracted offer amount ($145,000), recipient, and rationale. Logged to offer ladder. 0 errors.',
        meta: [{ partyClass: 'party-system', text: 'System' },{ partyClass: 'party-ai', text: 'AI' }],
        who: 'System', channel: 'AI extraction' },
      { id: 'd3', time: '11:45 am', iconType: 'communications', icon: 'ri-phone-line',
        direction: 'outbound', directionIcon: 'ri-arrow-up-line',
        title: 'Call w/ M. Reed re: pending counter',
        titleHtml: 'Call w/ <em>M. Reed</em> re: pending counter',
        detail: 'Adjuster confirmed counter forthcoming "by end of week." Pressed on multiplier dispute. Asked about willingness to mediate.',
        meta: [{ partyClass: 'party-adjuster', text: 'Adjuster' },{ text: '8 min' }],
        who: 'D. Altman', channel: 'phone' },
      { id: 'd4', time: '9:00 am', iconType: 'tasks', icon: 'ri-checkbox-circle-line',
        direction: 'internal', directionIcon: 'ri-circle-fill',
        title: 'Task completed · "Prepare counter-offer rationale doc"',
        detail: 'Memo summarizing Suffolk comparables and multiplier defense arguments saved to Case File · Documents.',
        meta: [{ partyClass: 'party-internal', text: 'Internal' }],
        who: 'Paralegal', channel: 'task' },
    ]},
    { day: 'Oct 7', dow: 'Monday', stat: '3 events · 1 milestone', events: [
      { id: 'e1', time: '11:00 am', iconType: 'casestate', icon: 'ri-mail-send-line',
        direction: 'outbound', directionIcon: 'ri-arrow-up-line',
        title: 'Milestone · Revised demand sent · $215,000',
        titleHtml: 'Milestone · Revised demand sent · <strong>$215,000</strong>',
        detail: 'Reduction reflects MMI declaration Jul 14 and treatment plateau. Cited O\'Brien v. Progressive ($214k verdict). Flagged willingness to mediate Nov 4.',
        meta: [{ partyClass: 'party-adjuster', text: 'Adjuster' }],
        who: 'D. Altman', channel: 'email',
        milestone: true },
      { id: 'e2', time: '10:42 am', iconType: 'documents', icon: 'ri-file-text-line',
        direction: 'outbound', directionIcon: 'ri-arrow-up-line',
        title: 'Document generated · revised-demand-letter-oct7.pdf',
        titleHtml: 'Document generated · <em>revised-demand-letter-oct7.pdf</em>',
        detail: '3-page revised demand. Used "PI · auto rear-end" template. 8 merge fields populated from case data.',
        meta: [{ partyClass: 'party-internal', text: 'Internal' },{ partyClass: 'party-ai', text: 'AI-assisted' }],
        who: 'D. Altman', channel: 'drafter drawer' },
      { id: 'e3', time: '9:18 am', iconType: 'notes', icon: 'ri-sticky-note-line',
        direction: 'internal', directionIcon: 'ri-circle-fill',
        title: 'Note added · "Strategy reset post-counter $135k"',
        detail: 'Decided to revise demand from $240k to $215k to signal movement; preserves authority cushion.',
        meta: [{ text: 'Internal' }],
        who: 'D. Altman', channel: 'internal note' },
    ]},
    { day: 'Sep 28', dow: 'Saturday', stat: '2 events · 1 milestone', events: [
      { id: 'f1', time: '10:42 am', iconType: 'casestate', icon: 'ri-arrow-down-line',
        direction: 'inbound', directionIcon: 'ri-arrow-down-line',
        title: 'Milestone · Counter received · $135,000',
        titleHtml: 'Milestone · Counter received · <strong>$135,000</strong>',
        detail: '2nd counter from M. Reed (GEICO). Argued mitigation re: chiropractic visits.',
        meta: [{ partyClass: 'party-adjuster', text: 'Adjuster' }],
        who: 'M. Reed (GEICO)', channel: 'email',
        milestone: true },
      { id: 'f2', time: '11:08 am', iconType: 'system', icon: 'ri-magic-line',
        direction: 'system', directionIcon: 'ri-flashlight-line',
        title: 'AI extraction · offer logged from email',
        detail: '$135,000 counter detected and added to offer ladder. Negotiation gap auto-updated.',
        meta: [{ partyClass: 'party-system', text: 'System' }],
        who: 'System', channel: 'auto-derived' },
    ]},
  ];

  /** Track which event is expanded (single-row at a time). */
  expandedActivityEventId: string | null = 'a1';
  toggleActivityEvent(id: string): void {
    this.expandedActivityEventId = this.expandedActivityEventId === id ? null : id;
  }

  // ============================================================
  // CASE FILE — sidebar navigation state + mock data registry
  // ============================================================
  // Mockup-faithful Case File implementation: a sidebar-driven 7-section
  // panel (Parties / Incident / Insurance / Medical / Auth / Docs /
  // Timeline) with sub-tabs inside Medical. State is local to this
  // component; mock data is hardcoded for the design pass and will be
  // wired to real services in a follow-up.

  /** Active Case File section (sidebar nav). */
  caseFileSection: 'parties'|'incident'|'insurance'|'medical'|'auth'|'docs'|'timeline' = 'parties';
  /** Active Medical sub-tab. */
  medicalSubTab: 'providers'|'chronology'|'phases'|'gaps'|'rr' = 'providers';

  setCaseFileSection(s: 'parties'|'incident'|'insurance'|'medical'|'auth'|'docs'|'timeline'): void {
    this.caseFileSection = s;
  }
  setMedicalSubTab(s: 'providers'|'chronology'|'phases'|'gaps'|'rr'): void {
    this.medicalSubTab = s;
  }
  /** Cross-link helper: jump to Medical → Records Requests from Authorizations. */
  jumpToMedicalRR(): void {
    this.caseFileSection = 'medical';
    setTimeout(() => this.medicalSubTab = 'rr', 0);
  }

  /** Readiness data — drives the circular progress ring + section status pills. */
  readonly caseFileReadiness: {
    pct: number; complete: number; total: number;
    sections: Array<{ key: string; label: string; status: 'done'|'partial'|'empty' }>;
  } = {
    pct: 72, complete: 5, total: 7,
    sections: [
      { key: 'parties',   label: 'Parties',         status: 'done' },
      { key: 'incident',  label: 'Incident',        status: 'done' },
      { key: 'insurance', label: 'Insurance',       status: 'done' },
      { key: 'medical',   label: 'Medical',         status: 'partial' },
      { key: 'auth',      label: 'Authorizations',  status: 'partial' },
      { key: 'docs',      label: 'Documents',       status: 'done' },
      { key: 'timeline',  label: 'Timeline',        status: 'done' },
    ],
  };

  /** Readiness ring SVG dasharray — out of circumference 138 (r=22). */
  getReadinessDashArray(): string {
    const circ = 2 * Math.PI * 22;          // ≈138.23
    const filled = (circ * this.caseFileReadiness.pct) / 100;
    return `${filled.toFixed(2)} ${circ.toFixed(2)}`;
  }

  /** Sidebar items — section + icon + count + status dot. */
  readonly caseFileSidebarItems: Array<{
    key: 'parties'|'incident'|'insurance'|'medical'|'auth'|'docs'|'timeline';
    icon: string; label: string; count: string; status: 'done'|'warn'|'empty';
  }> = [
    { key: 'parties',   icon: 'ri-team-line',         label: 'Parties',        count: '5',     status: 'done' },
    { key: 'incident',  icon: 'ri-car-line',          label: 'Incident',       count: '10/10', status: 'done' },
    { key: 'insurance', icon: 'ri-shield-line',       label: 'Insurance',      count: '4',     status: 'done' },
    { key: 'medical',   icon: 'ri-stethoscope-line',  label: 'Medical',        count: '8 · 32', status: 'warn' },
    { key: 'auth',      icon: 'ri-quill-pen-line',    label: 'Authorizations', count: '3/4',   status: 'warn' },
    { key: 'docs',      icon: 'ri-folder-2-line',     label: 'Documents',      count: '47',    status: 'done' },
    { key: 'timeline',  icon: 'ri-time-line',         label: 'Timeline',       count: '62',    status: 'done' },
  ];

  /** Parties — plaintiff, defendant, witness(es), expert(s), counsel. */
  getMockParties(): Array<PiPartyView> {
    return [
      { avatarType: 'pl', initials: 'SM', name: 'Sarah Mitchell', role: 'Plaintiff (Client)', roleClass: 'role-pl',
        phone: '(617) 555-0144', email: 'sarah.mitchell@example.com', rows: [
        { icon: 'ri-cake-2-line',     html: 'Born Mar 14, 1991 (35 y/o) <span class="prov intake" title="from intake form">i</span>' },
        { icon: 'ri-phone-line',      text: '(617) 555-0144' },
        { icon: 'ri-mail-line',       text: 'sarah.mitchell@example.com' },
        { icon: 'ri-map-pin-line',    text: '14 Beacon St #4B, Boston, MA 02108' },
        { icon: 'ri-briefcase-line',  html: 'Acme Inc · Senior Accountant · $4,200/mo <span class="prov client" title="client portal">c</span>' },
      ]},
      { avatarType: 'def', initials: 'RC', name: 'Robert Chen', role: 'Defendant', roleClass: 'role-def', rows: [
        { icon: 'ri-car-line',           text: '2022 Toyota Camry · plate XYZ-1234' },
        { icon: 'ri-shield-keyhole-line', html: 'GEICO · policy GA-90014 <span class="prov ai" title="extracted from police report">A</span>' },
        { icon: 'ri-map-pin-line',       html: '78 Park Dr, Brookline, MA 02446 <span class="prov ai" title="from police report">A</span>' },
        { icon: 'ri-mail-line',          link: 'Add email' },
        { icon: 'ri-checkbox-circle-line', iconClass: 'text-success', html: '<span style="color:var(--vz-success);font-weight:500;">Service confirmed</span>' },
      ]},
      { avatarType: 'witness', initials: 'JP', name: 'James Park', role: 'Passenger Witness', roleClass: 'role-wit',
        phone: '(617) 555-2218', rows: [
        { icon: 'ri-user-line',  text: 'Friend of plaintiff · was in passenger seat' },
        { icon: 'ri-phone-line', text: '(617) 555-2218' },
        { icon: 'ri-mic-line',   iconClass: 'text-success', html: 'Recorded statement Jun 7 · 14 min <span class="prov manual" title="manually entered">m</span>' },
        { icon: 'ri-attachment-line', link: 'park-statement-jun7.mp3' },
      ]},
      { avatarType: 'expert', initials: '+', name: 'Engage expert', role: 'Expert (optional)', roleClass: 'role-exp', placeholder: true, rows: [
        { icon: 'ri-information-line', html: '<span style="color:var(--vz-secondary-color);font-size:12px;">Decision pending: accident reconstructionist may be useful if liability becomes contested. <a href="javascript:void(0)" style="color:var(--vz-link-color, var(--vz-primary));text-decoration:none;">Open decision →</a></span>' },
      ]},
      { avatarType: 'counsel', initials: 'KF', name: 'Karen Foster, Esq.', role: 'Defense counsel', roleClass: 'role-counsel',
        phone: '(617) 555-7700', email: 'kfoster@hartfordlegal.com', rows: [
        { icon: 'ri-building-line',     text: 'Hartford Legal LLP' },
        { icon: 'ri-phone-line',        text: '(617) 555-7700 ext. 312' },
        { icon: 'ri-mail-line',         text: 'kfoster@hartfordlegal.com' },
        { icon: 'ri-shield-user-line',  text: 'Retained by GEICO Jun 18' },
      ]},
    ];
  }

  // ============================================
  // Party action handlers — Batch A.1
  // Phone/email use native tel:/mailto: protocols (browser handles dial app or
  // mail client). Portal-message falls back to logging an outbound CALL/EMAIL
  // communication since we don't have a real client portal yet.
  // ============================================

  callParty(p: PiPartyView): void {
    if (p.phone) {
      const digits = p.phone.replace(/[^0-9+]/g, '');
      window.location.href = `tel:${digits}`;
    } else {
      Swal.fire('No phone on file', `${p.name} doesn't have a phone number on record yet.`, 'info');
    }
  }

  emailParty(p: PiPartyView): void {
    if (p.email) {
      window.location.href = `mailto:${p.email}`;
    } else {
      Swal.fire('No email on file', `${p.name} doesn't have an email on record yet.`, 'info');
    }
  }

  /** Pre-fill the Log Communication modal with the party as the counterparty.
   *  Direction = 'OUT' (matches PICommunicationDirection's 'IN' | 'OUT' | 'INTERNAL'). */
  messagePartyComm(p: PiPartyView, modalRef: any): void {
    this.newCommunication = {
      ...this.blankCommunication(),
      counterparty: p.name,
      direction: 'OUT'
    } as PICommunication;
    this.modalService.open(modalRef, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false,
      container: 'body',
      windowClass: 'pi-modal-window',
    });
  }

  /** Per-party "more" menu — currently surfaces Delete since that's the most
   *  common follow-up to selecting a card. Edit lives on the pencil icon. */
  partyMore(p: PiPartyView): void {
    if (!p.id || !this.partiesAreLive) {
      Swal.fire({
        title: p.name,
        text: 'Demo card. Click Add party to create real ones — then edit/delete shows up here.',
        icon: 'info',
      });
      return;
    }
    this.deleteParty(p);
  }

  /** Per-party inline edit — opens the AdverseParty modal in update mode. */
  editParty(p: PiPartyView): void {
    this.openEditPartyModal(p);
  }

  /** Incident facts — left column has the map; right column the grid. */
  readonly mockIncidentFacts: Array<{ k: string; v: string; html?: string; pillSuccess?: string }> = [
    { k: 'Date',         v: 'April 16, 2026', html: 'April 16, 2026 <span class="prov intake" title="from intake form">i</span>' },
    { k: 'Time',         v: '7:42 AM', html: '7:42 AM <span class="prov ai" title="from police report">A</span>' },
    { k: 'Weather',      v: 'Clear · 52°F', html: 'Clear · 52°F <span class="prov ai" title="from police report">A</span>' },
    { k: 'Road',         v: 'Dry · daylight', html: 'Dry · daylight <span class="prov ai" title="from police report">A</span>' },
    { k: 'Mechanism',    v: 'Rear-end collision' },
    { k: 'Plaintiff role', v: 'Driver' },
    { k: 'Speed',        v: '~25 mph at impact', html: '~25 mph at impact <span class="prov ai" title="from police report">A</span>' },
    { k: 'Police report', v: '#2026-04812', pillSuccess: '#2026-04812' },
    { k: 'ER on DOL',    v: 'Yes · Boston General', pillSuccess: 'Yes · Boston General' },
    { k: 'Cited?',       v: 'Defendant: failure to stop in assured clear distance', html: 'Defendant: failure to stop in assured clear distance <span class="prov ai" title="from police report">A</span>' },
  ];

  /** Vehicle cards — plaintiff + defendant. */
  readonly mockVehicles: Array<{ name: string; tag: 'pl'|'def'; tagLabel: string; rows: Array<{ k: string; v: string; html?: string }> }> = [
    { name: '2019 Honda Civic LX', tag: 'pl', tagLabel: 'Plaintiff', rows: [
      { k: 'Plate',       v: 'ABC-1234 (MA)' },
      { k: 'VIN',         v: '2HGFC2F58KH541234' },
      { k: 'Damage',      v: 'Total loss · rear bumper, trunk, frame', html: '<span class="veh-status total">Total loss</span> · rear bumper, trunk, frame' },
      { k: 'Photos',      v: '8 photos · body shop estimate $14,200' },
      { k: 'Disposition', v: 'Salvage · pickup hold thru Jul 1' },
    ]},
    { name: '2022 Toyota Camry SE', tag: 'def', tagLabel: 'Defendant', rows: [
      { k: 'Plate',    v: 'XYZ-1234 (MA)' },
      { k: 'VIN',      v: '4T1G11AK7NU123456' },
      { k: 'Damage',   v: 'Front bumper, hood' },
      { k: 'Photos',   v: '4 photos (body shop)' },
      { k: 'Towed by', v: 'Allston Towing · receipt on file' },
    ]},
  ];

  /** Scene & vehicle photo thumbnails. */
  readonly mockIncidentPhotos: Array<{ caption: string; more?: number }> = [
    { caption: 'scene · IMG_0142' },
    { caption: 'scene · IMG_0143' },
    { caption: 'civic-rear' },
    { caption: 'civic-trunk' },
    { caption: 'camry-front' },
    { caption: '+9 more', more: 9 },
  ];

  /** Insurance & Claims — coverage table rows. */
  readonly mockCoverages: Array<{
    coverage: string; sub?: string;
    carrier: string; carrierSub?: string;
    claim?: string; claimHtml?: string;
    limits: string; limitsSub?: string;
    adjuster?: string; adjusterSub?: string;
    pillClass: 'pill-success'|'pill-info'|'pill-muted'|'pill-warn'|'pill-danger';
    pillText: string;
  }> = [
    { coverage: 'Liability (3rd-party)', sub: "Defendant's BI policy",
      carrier: 'GEICO', carrierSub: 'policy GA-90014',
      claimHtml: 'CLM-4471-A <span class="prov ai" title="extracted from LOR response">A</span>',
      limits: '$250k / $500k',
      adjuster: 'Marcus Reed', adjusterSub: 'ext 4471 · m.reed@geico.com',
      pillClass: 'pill-success', pillText: 'Confirmed · liability accepted' },
    { coverage: 'PIP', sub: "Plaintiff's no-fault",
      carrier: 'Progressive', carrierSub: 'policy MA-PIP-908',
      claim: 'PIP-2026-3318',
      limits: '$8,000', limitsSub: '$3,420 remaining',
      adjuster: 'Lina Park', adjusterSub: 'ext 220 · pip@progressive.com',
      pillClass: 'pill-info', pillText: 'Active · drawing' },
    { coverage: 'MedPay', sub: "Plaintiff's auto med",
      carrier: 'Progressive',
      claim: 'MED-2026-3318',
      limits: '$2,000', limitsSub: 'exhausted',
      adjusterSub: 'same as PIP',
      pillClass: 'pill-muted', pillText: 'Exhausted' },
    { coverage: 'Health insurance', sub: "Plaintiff's primary",
      carrier: 'Blue Cross MA', carrierSub: 'PPO group #421',
      claim: 'SUB-MITCHELL-S',
      limits: 'n/a',
      adjusterSub: 'Subrogation dept · liens@bcbsma.com',
      pillClass: 'pill-warn', pillText: 'Lien letter requested' },
    { coverage: 'UM / UIM', sub: "Plaintiff's underinsured",
      carrier: 'Progressive',
      claimHtml: '<span class="cell-sub">not yet opened</span>',
      limits: 'UM $100k · UIM $100k',
      adjusterSub: '—',
      pillClass: 'pill-muted', pillText: 'Available · not triggered' },
  ];

  /** Letters of Representation — sent log. */
  readonly mockLORs: Array<{ sent: string; to: string; toSub?: string; channel: string; channelIcon: string; ack: string; by: string }> = [
    { sent: 'Apr 28', to: 'GEICO claims dept',          toSub: 'Marcus Reed', channel: 'Certified mail', channelIcon: 'ri-mail-line', ack: "May 2 · ack'd",  by: 'D. Altman' },
    { sent: 'Apr 28', to: 'Progressive PIP/MedPay',                              channel: 'Certified mail', channelIcon: 'ri-mail-line', ack: "May 5 · ack'd",  by: 'D. Altman' },
    { sent: 'May 14', to: 'Blue Cross MA · subrogation',                          channel: 'Email',          channelIcon: 'ri-mail-line', ack: "May 16 · ack'd", by: 'D. Altman' },
  ];

  /** Medical → Providers (mock for design pass; mirrors mockup-casefile.html). */
  readonly mockMedicalProviders: Array<{
    name: string; sub: string; type: string; visits: string; range: string; specials: string;
    recordsClass: 'pill-success'|'pill-warn'; recordsText: string;
    statusClass: 'pill-active'|'pill-discharged'; statusText: string;
  }> = [
    { name: 'Boston General ER',        sub: 'Dr. K. Reilly · ER',                                       type: 'Emergency',   visits: '1',        range: 'Apr 16 · Apr 16',  specials: '$4,820',  recordsClass: 'pill-success', recordsText: 'complete',         statusClass: 'pill-discharged', statusText: 'Discharged' },
    { name: 'Cambridge PT & Sports',    sub: 'N. Patel, DPT',                                            type: 'PT',          visits: '14',       range: 'Apr 22 · ongoing', specials: '$11,340', recordsClass: 'pill-success', recordsText: 'complete',         statusClass: 'pill-active',     statusText: 'Active' },
    { name: 'Mass Imaging Partners',    sub: 'MRI L-spine · MRI C-spine',                                type: 'Imaging',     visits: '2',        range: 'May 4 · May 28',   specials: '$6,200',  recordsClass: 'pill-success', recordsText: 'complete',         statusClass: 'pill-discharged', statusText: 'Complete' },
    { name: 'North End Orthopedics',    sub: 'Dr. R. Tanaka',                                            type: 'Specialist',  visits: '3',        range: 'May 9 · ongoing',  specials: '$2,840',  recordsClass: 'pill-warn',    recordsText: 'request pending', statusClass: 'pill-active',     statusText: 'Active' },
    { name: 'Beacon Pain Management',   sub: 'Dr. L. Schmidt',                                           type: 'Specialist',  visits: '4',        range: 'May 15 · ongoing', specials: '$8,960',  recordsClass: 'pill-warn',    recordsText: 'request pending', statusClass: 'pill-active',     statusText: 'Active' },
    { name: 'Suffolk PCP Group',        sub: 'Dr. A. Yusuf',                                             type: 'PCP',         visits: '2',        range: 'Apr 18 · May 2',   specials: '$540',    recordsClass: 'pill-success', recordsText: 'complete',         statusClass: 'pill-discharged', statusText: 'Discharged' },
    { name: 'Beacon Pharmacy',          sub: 'cyclobenzaprine, gabapentin',                              type: 'Pharmacy',    visits: '11 fills', range: 'Apr 17 · ongoing', specials: '$1,180',  recordsClass: 'pill-success', recordsText: 'complete',         statusClass: 'pill-active',     statusText: 'Active' },
    { name: 'Project AAA Chiropractic', sub: 'Dr. T. Nguyen',                                            type: 'Chiro',       visits: '8',        range: 'Apr 23 · Jun 4',   specials: '$6,300',  recordsClass: 'pill-success', recordsText: 'complete',         statusClass: 'pill-discharged', statusText: 'Discharged' },
  ];

  /** Medical → Chronology (visit-level rows). */
  readonly mockChronology: Array<{
    date: string; provider: string; providerSub?: string; type: string;
    icds: Array<{ code?: string; desc: string }>; findings: string; billed: string; bold?: boolean;
  }> = [
    { date: 'Apr 16', provider: 'Boston General ER',  providerSub: 'Dr. K. Reilly', type: 'ER visit',
      icds: [{ code: 'S13.4XXA', desc: 'Sprain cervical spine' }, { code: 'S33.5XXA', desc: 'Sprain lumbar spine' }],
      findings: 'Multiple soft-tissue injuries cervical & lumbar; CT head/neck negative; discharged with cyclobenzaprine.',
      billed: '$4,820', bold: true },
    { date: 'Apr 17', provider: 'Beacon Pharmacy', providerSub: 'first fill', type: 'Pharmacy',
      icds: [{ desc: 'cyclobenzaprine 10mg, gabapentin 300mg' }],
      findings: 'Initial muscle relaxant + neuropathic pain regimen filled.',
      billed: '$148' },
    { date: 'Apr 18', provider: 'Suffolk PCP', providerSub: 'Dr. A. Yusuf', type: 'Office',
      icds: [{ code: 'M54.2', desc: 'Cervicalgia' }, { code: 'M54.5', desc: 'Low back pain' }],
      findings: 'Continued soft-tissue pain post-MVA. Referred to PT & pain management.',
      billed: '$270' },
    { date: 'Apr 22', provider: 'Cambridge PT', providerSub: 'N. Patel, DPT', type: 'PT eval',
      icds: [{ code: 'M54.2', desc: '' }, { code: 'M54.5', desc: '' }],
      findings: 'Cervical ROM limited 50% baseline; lumbar tenderness L4-L5. Plan: 3×/wk × 8 wks.',
      billed: '$290' },
    { date: 'May 2',  provider: 'Suffolk PCP', providerSub: 'Dr. A. Yusuf', type: 'Follow-up',
      icds: [{ code: 'M54.2', desc: '' }, { code: 'M54.5', desc: '' }],
      findings: 'Pain persistent despite conservative care; ordering MRI L-spine + C-spine.',
      billed: '$270' },
    { date: 'May 4',  provider: 'Mass Imaging', providerSub: 'MRI L-spine', type: 'Imaging',
      icds: [{ code: 'M51.16', desc: 'Disc disorder w/ radiculopathy lumbar' }],
      findings: 'Mild disc bulge L4-L5 without canal stenosis; minimal facet arthropathy.',
      billed: '$2,800', bold: true },
    { date: 'May 9',  provider: 'North End Ortho', providerSub: 'Dr. R. Tanaka', type: 'Consult',
      icds: [{ code: 'M54.16', desc: '' }, { code: 'M54.5', desc: '' }],
      findings: 'No fracture; soft-tissue cervical and lumbar strain. Conservative care continued; pain mgmt referral.',
      billed: '$840' },
    { date: 'May 15', provider: 'Beacon Pain Mgmt', providerSub: 'Dr. L. Schmidt', type: 'Initial',
      icds: [{ code: 'G89.29', desc: 'Chronic post-traumatic pain' }],
      findings: 'Trigger-point injection #1 to bilateral cervical paraspinals; plan 3 more over 6 wks.',
      billed: '$2,240', bold: true },
    { date: 'May 28', provider: 'Mass Imaging', providerSub: 'MRI C-spine', type: 'Imaging',
      icds: [{ code: 'M50.30', desc: 'Cervical disc degeneration' }],
      findings: 'Disc bulge C4-C5; mild central canal stenosis. No surgical recommendation.',
      billed: '$3,400', bold: true },
    { date: 'Jun 8',  provider: 'Cambridge PT', providerSub: 'session 12', type: 'PT',
      icds: [{ code: 'M54.2', desc: '' }, { code: 'M54.5', desc: '' }],
      findings: 'ROM at 75% baseline; treatment plan extended 4 wks.',
      billed: '$405' },
  ];

  /** Medical → Phases (AI-grouped narrative arcs). */
  readonly mockPhases: Array<{
    num: number; cls: 'acute'|'subacute'|'continued'|'maintenance';
    title: string; meta: string; billed: string;
    rationale: string;
    records?: Array<{ date: string; provider: string; sub?: string; billed?: string; muted?: boolean }>;
  }> = [
    { num: 1, cls: 'acute', title: 'Acute trauma response', meta: 'Apr 16 — May 5, 2026 · 19 days · 6 records · 2 providers', billed: '$5,508',
      rationale: 'Initial trauma response phase: ER intake same day as DOL with cervical/lumbar sprain; PCP follow-up confirmed persistent pain; first imaging ordered. Pain regimen filled; PT evaluation scheduled.',
      records: [
        { date: 'Apr 16', provider: 'Boston General ER',  sub: 'Dr. Reilly · S13.4 / S33.5', billed: '$4,820' },
        { date: 'Apr 17', provider: 'Beacon Pharmacy',     sub: 'first fill',                  billed: '$148' },
        { date: 'Apr 18', provider: 'Suffolk PCP',         sub: 'Dr. Yusuf',                   billed: '$270' },
        { date: 'Apr 22', provider: 'Cambridge PT',        sub: 'initial eval, N. Patel',     billed: '$290' },
        { date: 'May 2',  provider: 'Suffolk PCP',         sub: 'follow-up; MRI ordered',      billed: '$270' },
        { date: 'May 4',  provider: 'Mass Imaging',         sub: 'MRI L-spine',                billed: '$2,800' },
      ] },
    { num: 2, cls: 'subacute', title: 'Sub-acute conservative care', meta: 'May 6 — Jun 12, 2026 · 38 days · 18 records · 5 providers', billed: '$24,830',
      rationale: 'Active multi-modal conservative care: PT continued 3×/wk, ortho consult ruled out fracture and confirmed soft-tissue mechanism, pain management initiated trigger-point injection series, second MRI confirmed cervical disc disease. Treatment intensifying; client compliant with all visits.',
      records: [
        { date: 'May 9',         provider: 'North End Ortho',    sub: 'Dr. Tanaka · consult',                    billed: '$840' },
        { date: 'May 15',        provider: 'Beacon Pain Mgmt',   sub: 'initial · trigger-point injection',       billed: '$2,240' },
        { date: 'May 18-Jun 8',  provider: 'Cambridge PT',       sub: 'sessions 5-12',                            billed: '$3,240' },
        { date: 'May 22',        provider: 'Beacon Pain Mgmt',   sub: 'injection #2',                             billed: '$2,240' },
        { date: 'May 28',        provider: 'Mass Imaging',        sub: 'MRI C-spine',                              billed: '$3,400' },
        { date: 'May 8 / Jun 5', provider: 'Beacon Pain Mgmt',   sub: 'injections #3, #4',                        billed: '$4,480' },
        { date: '+ 11 more',     provider: 'PT, chiro, pharmacy fills…', billed: '$8,390', muted: true },
      ] },
    { num: 3, cls: 'continued', title: 'Continued treatment · pre-MMI', meta: 'Jun 13 — present · 8 records · 3 providers · ongoing', billed: '$11,842',
      rationale: 'Maintenance phase as PT plateaus at ~75% baseline ROM. Pain management continues; orthopedic re-evaluation Jun 18 may declare MMI. No surgical interventions indicated. Defense will likely focus arguments on this phase for mitigation.',
    },
  ];

  /** Medical → Gaps stats (success state — no gaps over 30d). */
  readonly mockGapStats: Array<{ v: string; l: string; tone?: 'success' }> = [
    { v: '8',  l: 'Providers' },
    { v: '32', l: 'Visits' },
    { v: '60', l: 'Treatment days' },
    { v: '0',  l: 'Gaps > 30d', tone: 'success' },
    { v: '18', l: 'Longest break (d)' },
  ];

  /** Medical → Records Requests (pending checklist). */
  readonly mockPendingRequests: Array<{ name: string; sub?: string; required: boolean; meta: string; metaWarn?: boolean }> = [
    { name: 'Treatment notes & office records', sub: 'Sessions 5-12', required: true,
      meta: 'North End Orthopedics · last requested Jun 12 (12 days ago) · no response — auto follow-up Jun 24',
      metaWarn: true },
    { name: 'Itemized billing (UB-04)', required: true,
      meta: 'Beacon Pain Management · last requested Jun 14 (10 days ago) · awaiting' },
  ];

  /** Medical → Records Requests (history log). */
  readonly mockRequestHistory: Array<{
    sent: string; to: string; toSub?: string; channel: string; channelIcon: string;
    document: string; status: string; statusClass: 'pill-success'|'pill-warn'; by: string;
  }> = [
    { sent: 'Jun 14', to: 'Beacon Pain Mgmt',  toSub: 'records@beaconpain.com', channel: 'Email + fax',     channelIcon: 'ri-mail-line', document: 'Itemized billing (UB-04)',          status: 'awaiting',           statusClass: 'pill-warn',    by: 'Paralegal' },
    { sent: 'Jun 12', to: 'North End Ortho',   toSub: 'fax 617-555-3022',       channel: 'Fax (certified)', channelIcon: 'ri-fax-fill',   document: 'Treatment notes (sessions 5-12)',  status: 'awaiting · 12d',    statusClass: 'pill-warn',    by: 'Paralegal' },
    { sent: 'May 30', to: 'Mass Imaging',                                       channel: 'Email',           channelIcon: 'ri-mail-line', document: 'MRI C-spine report + images',       status: 'received Jun 4',     statusClass: 'pill-success', by: 'Paralegal' },
    { sent: 'May 28', to: 'Cambridge PT',                                        channel: 'Email',           channelIcon: 'ri-mail-line', document: 'PT visit notes (sessions 1-10)',   status: 'received Jun 1',     statusClass: 'pill-success', by: 'Paralegal' },
    { sent: 'May 14', to: 'Boston General ER',                                   channel: 'Mail (certified)', channelIcon: 'ri-mail-line', document: 'ER chart + radiology',             status: 'received May 24',    statusClass: 'pill-success', by: 'D. Altman' },
    { sent: 'May 14', to: 'Suffolk PCP',                                         channel: 'Email',           channelIcon: 'ri-mail-line', document: 'Office records Apr 18 + May 2',   status: 'received May 19',    statusClass: 'pill-success', by: 'D. Altman' },
    { sent: 'May 6',  to: 'Acme Inc HR',                                         channel: 'Mail (certified)', channelIcon: 'ri-mail-line', document: 'Wage verification',                status: 'received May 11',    statusClass: 'pill-success', by: 'D. Altman' },
  ];

  /** Authorizations — list of signed/pending auth rows. */
  readonly mockAuths: Array<{
    icon: string; iconClass?: string; title: string; detail: string;
    signed: boolean; pillClass?: 'pill-success'; pillText?: string;
    showCta?: boolean;
  }> = [
    { icon: 'ri-shield-cross-line', title: 'HIPAA medical authorization',          detail: 'Signed Apr 18, 2026 · expires Apr 18, 2027 · used to request records from 8 providers',  signed: true,  pillClass: 'pill-success', pillText: 'Signed' },
    { icon: 'ri-briefcase-line',    title: 'Employer / wage authorization',         detail: 'Signed Apr 22, 2026 · used for W-2, paystubs, and HR statement from Acme Inc',          signed: true,  pillClass: 'pill-success', pillText: 'Signed' },
    { icon: 'ri-car-line',          title: 'DMV / driving record authorization',     detail: 'Signed Apr 22, 2026 · pulled MA DMV record May 1 (clean)',                            signed: true,  pillClass: 'pill-success', pillText: 'Signed' },
    { icon: 'ri-file-text-line',    iconClass: 'warn', title: 'Tax / income authorization (IRS Form 4506-T)', detail: 'Not yet signed · required to verify pre-injury income for wage-loss demand', signed: false, showCta: true },
  ];

  /** Authorizations — usage audit summary entries. */
  readonly mockAuthAudit: Array<{
    icon: string; toneClass: 'info'|'amber'|'success';
    title: string; detail: string; linkText?: string; linkAction?: 'rr'|'docs'|'';
    pendingText?: string;
  }> = [
    { icon: 'ri-shield-check-line', toneClass: 'info',
      title: 'HIPAA · used for 14 record requests across 8 providers',
      detail: 'Last used Jun 14 (10d ago) · expires Apr 18, 2027 · 2 requests currently outstanding',
      linkText: 'Manage requests in Medical', linkAction: 'rr' },
    { icon: 'ri-briefcase-line', toneClass: 'amber',
      title: 'Employer auth · used for 2 wage-document requests',
      detail: 'Wage verification received May 11 · paystubs / W-2 outstanding',
      linkText: 'View employer docs', linkAction: 'docs' },
    { icon: 'ri-car-line', toneClass: 'success',
      title: 'DMV auth · used once',
      detail: 'Driving record pulled May 1 — clean · auth dormant',
      pendingText: 'no pending' },
  ];

  /** Document filter chips. */
  readonly mockDocChips: Array<{ name: string; count: number; status: 'done'|'partial'|'empty' }> = [
    { name: 'Retainer & legal',    count: 4,  status: 'done' },
    { name: 'Medical records',     count: 22, status: 'done' },
    { name: 'Bills & statements',  count: 8,  status: 'done' },
    { name: 'Photos & evidence',   count: 14, status: 'done' },
    { name: 'Insurance',           count: 5,  status: 'done' },
    { name: 'Wage / employment',   count: 2,  status: 'partial' },
    { name: 'Correspondence',      count: 6,  status: 'done' },
  ];

  /** Documents grid. */
  readonly mockDocs: Array<{
    type: 'pdf'|'img'|'docx'|'xlsx'|'eml';
    name: string; meta: string;
    tags: Array<{ label: string; cls?: 'medical'|'ins'|'legal'|'evidence'|'wage' }>;
  }> = [
    { type: 'pdf',  name: 'Retainer agreement — signed',                    meta: '2.4 MB · uploaded Apr 18',         tags: [{ label: 'Retainer', cls: 'legal' }, { label: 'Signed' }] },
    { type: 'pdf',  name: 'Police report #2026-04812',                      meta: '8.1 MB · 14 pages · received Jun 4', tags: [{ label: 'Evidence', cls: 'evidence' }, { label: 'AI-extracted' }] },
    { type: 'pdf',  name: 'Boston General ER chart',                        meta: '12.6 MB · 22 pages · scanned',     tags: [{ label: 'Medical', cls: 'medical' }, { label: 'ER' }] },
    { type: 'pdf',  name: 'Cambridge PT — visit notes (sessions 1-10)',     meta: '14.2 MB · 38 pages',                tags: [{ label: 'Medical', cls: 'medical' }, { label: 'PT' }] },
    { type: 'pdf',  name: 'MRI L-spine report',                              meta: '3.8 MB · 6 pages · Mass Imaging',   tags: [{ label: 'Imaging', cls: 'medical' }] },
    { type: 'docx', name: 'Letter of representation — GEICO',                meta: '68 KB · sent Apr 28 (certified)',   tags: [{ label: 'LOR', cls: 'legal' }] },
    { type: 'img',  name: 'Scene photos — IMG_0142.jpg',                     meta: '4.4 MB · client portal',             tags: [{ label: 'Evidence', cls: 'evidence' }, { label: 'Scene' }] },
    { type: 'xlsx', name: 'Itemized billing — running tally',                meta: '112 KB · auto-generated',           tags: [{ label: 'Bills', cls: 'medical' }, { label: 'Auto' }] },
    { type: 'eml',  name: 'Adjuster reply — Marcus Reed',                    meta: 'Inbox · May 2 · 4 attachments',     tags: [{ label: 'Insurance', cls: 'ins' }] },
    { type: 'pdf',  name: 'HIPAA authorization — signed',                    meta: '96 KB · client portal · Apr 18',    tags: [{ label: 'Auth', cls: 'legal' }, { label: 'Signed' }] },
    { type: 'pdf',  name: 'Vehicle damage estimate — Suffolk Auto Body',     meta: '1.2 MB · $14,200 · Apr 22',          tags: [{ label: 'Property', cls: 'evidence' }] },
    { type: 'pdf',  name: 'Acme Inc — wage verification letter',             meta: '128 KB · employer · May 6',          tags: [{ label: 'Wage', cls: 'wage' }] },
  ];

  /** Timeline — month-grouped events. */
  readonly mockTimelineMonths: Array<{
    month: string;
    events: Array<{ when: string; mark: 'medical'|'legal'|'communication'|'event'|'gap'; icon: string; title: string; detail?: string }>;
  }> = [
    { month: 'June 2026', events: [
      { when: 'Jun 12', mark: 'legal',         icon: 'ri-mail-send-line',     title: 'Records request sent — North End Orthopedics', detail: 'Treatment notes & office records (sessions 5-12) · channel: certified mail · awaiting response (Day 12).' },
      { when: 'Jun 8',  mark: 'medical',       icon: 'ri-stethoscope-line',   title: 'Cambridge PT — session 12',                       detail: 'N. Patel, DPT · Continued progress; ROM at 75% baseline. Treatment plan extended 4 weeks.' },
      { when: 'Jun 7',  mark: 'legal',         icon: 'ri-user-voice-line',    title: 'Witness statement recorded — James Park',         detail: '14-min recorded statement; corroborates rear-end mechanism and impact severity.' },
      { when: 'Jun 4',  mark: 'legal',         icon: 'ri-file-paper-2-line',  title: 'Police report received — Suffolk PD',            detail: 'Report #2026-04812 · officer cites defendant for failure to stop in assured clear distance.' },
      { when: 'Jun 3',  mark: 'communication', icon: 'ri-phone-line',         title: 'Call w/ adjuster (Marcus Reed) — liability accepted', detail: '12-min call · GEICO accepts liability; comparative-fault not asserted. Specials updates requested.' },
    ]},
    { month: 'May 2026', events: [
      { when: 'May 28', mark: 'medical', icon: 'ri-image-line',        title: 'MRI cervical spine — Mass Imaging',           detail: 'Disc bulge C4-C5; mild central canal stenosis. No surgical recommendation.' },
      { when: 'May 15', mark: 'medical', icon: 'ri-stethoscope-line',  title: 'Pain management initial — Beacon Pain (Dr. Schmidt)', detail: 'Trigger-point injections recommended; first injection completed. Plan: 3 more over 6 weeks.' },
      { when: 'May 9',  mark: 'medical', icon: 'ri-stethoscope-line',  title: 'Orthopedic consult — Dr. Tanaka',              detail: 'No fracture; soft-tissue cervical and lumbar strain. Conservative care continued.' },
      { when: 'May 2',  mark: 'event',   icon: 'ri-shield-check-line', title: 'GEICO acknowledged LOR',                      detail: 'Claim CLM-4471-A opened; M. Reed assigned as adjuster.' },
    ]},
    { month: 'April 2026', events: [
      { when: 'Apr 28', mark: 'legal',   icon: 'ri-mail-send-line',   title: 'Letters of representation sent — GEICO & Progressive' },
      { when: 'Apr 22', mark: 'medical', icon: 'ri-stethoscope-line', title: 'PT initial evaluation — Cambridge PT',  detail: 'Cervical & lumbar strain. 3x/week × 8 weeks plan.' },
      { when: 'Apr 18', mark: 'legal',   icon: 'ri-quill-pen-line',   title: 'Retainer signed; HIPAA & employer authorizations executed', detail: 'Client portal · all signatures captured.' },
      { when: 'Apr 16', mark: 'event',   icon: 'ri-alert-line',       title: 'Date of loss · Boylston St & Berkeley St', detail: 'Rear-end collision · plaintiff transported to Boston General ER same day.' },
    ]},
  ];

  // ============================================================
  // Stage-aware Overview demo data
  // ============================================================
  // The Overview tab's primary card and right rail change shape per
  // stage. While the backend wiring catches up, these getters return
  // demo-quality mock data so attorneys (and product) can see what
  // each stage's Overview is supposed to surface. The data shape
  // mirrors mockup-stages.html section-by-section; HTML reads from
  // these via *ngSwitch on case.stage.
  // ============================================================

  /**
   * Returns the rendered stage key. Honours `previewStageOverride` (set by
   * the switcher) so design / product can preview all 7 stage layouts from a
   * single case URL without changing underlying data. Falls back to the real
   * case stage. Preview is non-prod only (handled in the subscription).
   */
  get stageKey(): string {
    if (this.previewStageOverride) return this.previewStageOverride;
    return this.case?.stage || 'INTAKE';
  }

  /**
   * True when the user is previewing a stage other than the case's actual
   * stage. Drives the "↩ Real stage" pill visibility.
   */
  get isStagePreviewing(): boolean {
    if (!this.previewStageOverride) return false;
    return this.previewStageOverride !== (this.case?.stage || 'INTAKE');
  }

  /**
   * Whether to render the stage-preview switcher bar. Visible in any non-prod
   * environment so design / product can click between stages and verify each
   * layout from one case URL. Hidden in prod builds.
   */
  get showStagePreviewSwitcher(): boolean {
    return !environment.production;
  }

  /** Stage keys exposed for preview switcher buttons. */
  readonly STAGE_PREVIEW_KEYS: ReadonlyArray<{ key: string; short: string }> = [
    { key: 'INTAKE',         short: 'Intake' },
    { key: 'INVESTIGATION',  short: 'Investigation' },
    { key: 'TREATMENT',      short: 'Treatment' },
    { key: 'PRE_DEMAND',     short: 'Pre-Demand' },
    { key: 'DEMAND_SENT',    short: 'Demand Sent' },
    { key: 'NEGOTIATION',    short: 'Negotiation' },
    { key: 'SETTLED',        short: 'Settled' },
  ];

  /**
   * Switches the previewed stage. Sets the override field directly (so the
   * view re-renders instantly) AND syncs to the URL via a query param (so
   * the URL is shareable / bookmarkable). The route subscription confirms
   * the field once the navigation resolves.
   */
  setStagePreview(stage: string): void {
    this.previewStageOverride = stage;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { previewStage: stage },
      queryParamsHandling: 'merge',
    });
    this.cdr.detectChanges();
  }

  /** Clears any active stage preview, returning the page to the case's real stage. */
  clearStagePreview(): void {
    this.previewStageOverride = null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { previewStage: null },
      queryParamsHandling: 'merge',
    });
    this.cdr.detectChanges();
  }

  /** Stage-tone class used on the stage-banner strip above each primary card. */
  getStageBannerClass(): string {
    switch (this.stageKey) {
      case 'INTAKE':         return 'sb-blue';
      case 'INVESTIGATION':  return 'sb-cyan';
      case 'TREATMENT':      return 'sb-amber';
      case 'PRE_DEMAND':     return 'sb-purple';
      case 'DEMAND_SENT':    return 'sb-blue';
      case 'NEGOTIATION':    return 'sb-teal';
      case 'SETTLED':        return 'sb-success';
      default:               return 'sb-blue';
    }
  }

  /** Single-line headline shown on the stage banner strip. */
  getStageBannerCopy(): { icon: string; label: string } {
    switch (this.stageKey) {
      case 'INTAKE':         return { icon: 'ri-flag-line',         label: 'Intake stage focus · Onboarding' };
      case 'INVESTIGATION':  return { icon: 'ri-search-eye-line',   label: 'Investigation stage focus · Liability & evidence' };
      case 'TREATMENT':      return { icon: 'ri-stethoscope-line',  label: 'Treatment stage focus · Provider tracking & specials' };
      case 'PRE_DEMAND':     return { icon: 'ri-mail-send-line',    label: 'Pre-demand stage focus · Package assembly' };
      case 'DEMAND_SENT':    return { icon: 'ri-send-plane-line',   label: 'Demand stage focus · Awaiting adjuster response' };
      case 'NEGOTIATION':    return { icon: 'ri-arrow-left-right-line', label: 'Negotiation stage focus · Bridging the gap' };
      case 'SETTLED':        return { icon: 'ri-checkbox-circle-line',  label: 'Settled · Closing & disbursement' };
      default:               return { icon: 'ri-flag-line',         label: 'Stage focus' };
    }
  }

  // ----- Stage 1: Onboarding Tasks (mockup-faithful, with Owner/Due/Status) -----
  /**
   * Returns the intake-stage onboarding checklist as a 5-column tasks list
   * matching the visual rhythm of investigation/treatment/etc. Mock data —
   * real wiring will replace this with the existing `getOnboardingItems()`
   * helper extended with owner + due fields once the backend supports them.
   */
  getMockOnboardingTasks(): Array<{
    done: boolean; auto?: boolean; title: string; sub: string;
    ownerInitials: string; ownerName: string; ownerTone?: 'info'|'unassigned';
    due: string; dueTone?: 'warn'|'dng'|'';
    status: string; statusClass: string;
  }> {
    return [
      { done: true,  auto: true,  title: 'Retainer agreement uploaded',
        sub: 'Detected Apr 18 via client portal',
        ownerInitials: 'SM', ownerName: 'Client',
        due: 'Apr 18',           dueTone: '',     status: 'Done',          statusClass: 'sp-done' },
      { done: false, title: 'Send client portal invite',
        sub: 'Required for secure document delivery',
        ownerInitials: 'DA', ownerName: 'David Altman',
        due: 'May 2 · in 2d',    dueTone: 'warn', status: 'To do',         statusClass: 'sp-todo' },
      { done: false, title: 'Confirm liability carrier',
        sub: 'Letter sent to GEICO; awaiting confirmation',
        ownerInitials: 'DA', ownerName: 'David Altman',
        due: 'May 5 · in 5d',    dueTone: 'warn', status: 'In progress',   statusClass: 'sp-progress' },
      { done: false, title: 'Request police report',
        sub: 'Suffolk PD Records — typical ETA 5–7 days',
        ownerInitials: '?', ownerName: 'Unassigned', ownerTone: 'unassigned',
        due: 'May 7',            dueTone: '',     status: 'To do',         statusClass: 'sp-todo' },
      { done: false, title: 'Add initial treatment provider',
        sub: 'ER and primary treating physician',
        ownerInitials: 'PL', ownerName: 'Paralegal', ownerTone: 'info',
        due: 'May 8',            dueTone: '',     status: 'To do',         statusClass: 'sp-todo' },
      { done: false, title: 'Collect scene & vehicle photos',
        sub: 'Upload to Case File → Evidence',
        ownerInitials: 'SM', ownerName: 'Client',
        due: 'May 10',           dueTone: '',     status: 'Waiting on client', statusClass: 'sp-waiting' },
    ];
  }

  /** Convenience getter for the count text in the onboarding card head. */
  get mockOnboardingDoneCount(): number {
    return this.getMockOnboardingTasks().filter(t => t.done).length;
  }

  // ----- Stage 2: Liability + Evidence -----
  getMockLiabilityState(): { label: string; value: string; sub: string } {
    return {
      label: 'Liability status',
      value: 'Accepted by GEICO · No comparative-fault dispute',
      sub: 'Confirmed by Marcus Reed via phone Jun 3, 2026',
    };
  }
  getMockEvidence(): Array<{ icon: string; tone: 'done'|'warn'|'todo'; name: string; meta: string }> {
    return [
      { icon: 'ri-police-car-line',  tone: 'done', name: 'Police report',           meta: 'Received Jun 4 · officer narrative supports liability' },
      { icon: 'ri-camera-line',      tone: 'done', name: 'Scene & vehicle photos',  meta: '14 photos · client-supplied + body shop' },
      { icon: 'ri-file-text-line',   tone: 'done', name: 'Vehicle damage estimate', meta: '$6,200 · Suffolk Auto Body' },
      { icon: 'ri-user-voice-line',  tone: 'done', name: 'Witness statement #1',    meta: 'James Park (passenger) · taken Jun 7' },
      { icon: 'ri-user-voice-line',  tone: 'warn', name: 'Witness statement #2',    meta: 'Maria Lopez · scheduled Jun 22' },
      { icon: 'ri-microscope-line',  tone: 'todo', name: 'Accident reconstruction', meta: 'Not yet engaged · evaluate need' },
      { icon: 'ri-stethoscope-line', tone: 'done', name: 'Initial medical records', meta: 'ER + PCP records on file' },
      { icon: 'ri-map-pin-line',     tone: 'todo', name: 'Scene diagram',           meta: 'Optional — based on dispute risk' },
    ];
  }
  getMockInvestigationTasks(): Array<{ done: boolean; title: string; ownerInitials: string; ownerName: string; ownerTone?: string; due: string; dueTone?: 'warn'|'dng'|''; status: string; statusClass: string }> {
    return [
      { done: false, title: 'Take statement from M. Lopez',                ownerInitials: 'DA', ownerName: 'David Altman', due: 'Jun 22',          dueTone: '',     status: 'Scheduled', statusClass: 'sp-progress' },
      { done: false, title: 'Decide: engage accident reconstructionist?',  ownerInitials: 'DA', ownerName: 'David Altman', due: 'Jun 25',          dueTone: '',     status: 'Decision',  statusClass: 'sp-todo' },
      { done: false, title: 'Request GEICO policy declarations',           ownerInitials: 'PL', ownerName: 'Paralegal',    ownerTone: 'info', due: 'Jun 18 · in 4d', dueTone: 'warn', status: 'To do',     statusClass: 'sp-todo' },
    ];
  }

  // ----- Stage 3: Treatment Providers -----
  getMockTreatmentAlert(): { tone: 'warn'|'info-tone'|'success-tone'|'danger'; icon: string; html: string; linkLabel?: string } {
    return {
      tone: 'warn', icon: 'ri-information-line',
      html: '<strong>Approaching MMI window.</strong> Last imaging shows improvement; ortho re-eval Jun 18 may declare MMI.',
      linkLabel: 'Open clinical timeline',
    };
  }
  getMockProviders(): Array<{ name: string; spec: string; type: string; visits: string; range: string; specials: string; status: string; statusClass: string }> {
    return [
      { name: 'Boston General ER',        spec: 'Dr. K. Reilly · ER',                                       type: 'Emergency',   visits: '1',       range: 'Apr 16 · Apr 16',     specials: '$4,820',  status: 'Discharged', statusClass: 'sp-done' },
      { name: 'Cambridge PT & Sports',    spec: 'N. Patel, DPT · Physical therapy',                         type: 'PT',          visits: '14',      range: 'Apr 22 · ongoing',    specials: '$11,340', status: 'Active',     statusClass: 'sp-progress' },
      { name: 'Mass Imaging Partners',    spec: 'MRI L-spine · MRI C-spine',                                type: 'Imaging',     visits: '2',       range: 'May 4 · May 28',      specials: '$6,200',  status: 'Complete',   statusClass: 'sp-done' },
      { name: 'North End Orthopedics',    spec: 'Dr. R. Tanaka · Orthopedic surgery consult',               type: 'Specialist',  visits: '3',       range: 'May 9 · ongoing',     specials: '$2,840',  status: 'Active',     statusClass: 'sp-progress' },
      { name: 'Beacon Pain Management',   spec: 'Dr. L. Schmidt · Pain mgmt & injections',                  type: 'Specialist',  visits: '4',       range: 'May 15 · ongoing',    specials: '$8,960',  status: 'Active',     statusClass: 'sp-progress' },
      { name: 'Suffolk PCP Group',        spec: 'Dr. A. Yusuf · Primary care',                              type: 'PCP',         visits: '2',       range: 'Apr 18 · May 2',      specials: '$540',    status: 'Discharged', statusClass: 'sp-done' },
      { name: 'Beacon Pharmacy',          spec: 'Prescription history (cyclobenzaprine, gabapentin)',       type: 'Pharmacy',    visits: '11 fills', range: 'Apr 17 · ongoing',   specials: '$1,180',  status: 'Active',     statusClass: 'sp-progress' },
      { name: 'Project AAA Chiropractic', spec: 'Dr. T. Nguyen · Chiropractic',                             type: 'Chiro',       visits: '8',       range: 'Apr 23 · Jun 4',      specials: '$6,300',  status: 'Discharged', statusClass: 'sp-done' },
    ];
  }

  // ----- Stage 4: Pre-demand package -----
  getMockDemandComponents(): Array<{ state: 'done'|'review'|'todo'; name: string; meta: string; status: string; statusClass: string }> {
    return [
      { state: 'done',   name: 'Medical narrative summary', meta: 'Generated Jul 19 · reviewed by D. Altman',                  status: 'Complete',    statusClass: 'sp-done' },
      { state: 'done',   name: 'Itemized billing summary',  meta: '$61,420 specials · 8 providers · auto-tabulated',          status: 'Complete',    statusClass: 'sp-done' },
      { state: 'done',   name: 'Photo & scene exhibit',     meta: '14 photos · selected for demand exhibit',                  status: 'Complete',    statusClass: 'sp-done' },
      { state: 'done',   name: 'Liability narrative',       meta: 'Police report + witness incorporated',                     status: 'Complete',    statusClass: 'sp-done' },
      { state: 'review', name: 'Wage-loss documentation',   meta: 'W-2 received · awaiting employer letter',                   status: 'In progress', statusClass: 'sp-progress' },
      { state: 'review', name: 'Pain & suffering narrative', meta: 'Draft generated · awaiting partner review',                status: 'Review',      statusClass: 'sp-progress' },
      { state: 'todo',   name: 'Demand calculation worksheet', meta: 'Run AI multiplier model · reviewed range $185k–$240k', status: 'To do',       statusClass: 'sp-todo' },
      { state: 'todo',   name: 'Demand letter draft',       meta: 'Generate from above components when complete',            status: 'To do',       statusClass: 'sp-todo' },
    ];
  }
  getMockPreDemandAlert(): { tone: 'info-tone'|'warn'|'success-tone'|'danger'; icon: string; html: string; linkLabel?: string } {
    return {
      tone: 'info-tone', icon: 'ri-information-line',
      html: '<strong>MMI declared Jul 14, 2026.</strong> Final medical specials locked at $61,420. Damages calculation ready for review.',
      linkLabel: 'Open Damages tab',
    };
  }

  // ----- Stage 5: Demand sent -----
  getMockDemandHero(): { amount: string; sentDate: string; adjuster: string; deadline: string; dayN: number; dayTotal: number; remaining: number; pct: number } {
    return {
      amount: '$240,000',
      sentDate: 'Aug 1, 2026',
      adjuster: 'Marcus Reed (GEICO)',
      deadline: 'Aug 31, 2026',
      dayN: 12, dayTotal: 30, remaining: 18, pct: 40,
    };
  }
  getMockCommLog(): Array<{ when: string; who: string; iconTone: 'success'|'info'|'warning'|'primary'|'danger'; icon: string; descHtml: string }> {
    return [
      { when: 'Aug 8, 11:14am', who: 'David Altman', iconTone: 'info',    icon: 'ri-phone-line',     descHtml: 'Voicemail to M. Reed confirming delivery and offering to clarify exhibits.' },
      { when: 'Aug 5, 9:02am',  who: 'System',       iconTone: 'success', icon: 'ri-mail-check-line', descHtml: 'Demand <strong>delivered</strong> (USPS certified · receipt signed by GEICO mailroom).' },
      { when: 'Aug 1, 4:48pm',  who: 'David Altman', iconTone: 'primary', icon: 'ri-mail-send-line',  descHtml: 'Demand letter <strong>$240,000</strong> sent — 47-page package incl. exhibits.' },
    ];
  }

  // ----- Stage 6: Negotiation ladder -----
  getMockOfferLadder(): {
    markers: Array<{ kind: 'demand'|'offer'|'current-offer'|'authority'; left: number; label: string; labelPos: 'above'|'below'; labelTone?: string }>;
    stats: Array<{ k: string; v: string }>;
    history: Array<{ when: string; who: string; pillKind: 'demand'|'counter'; amount: string; desc: string }>;
  } {
    return {
      markers: [
        { kind: 'offer',         left: 0,    label: '$0',                 labelPos: 'below' },
        { kind: 'offer',         left: 39.6, label: 'Counter $95k',        labelPos: 'above' },
        { kind: 'offer',         left: 56.3, label: '$135k',               labelPos: 'below' },
        { kind: 'current-offer', left: 60.4, label: 'Current $145k',       labelPos: 'above', labelTone: 'warn' },
        { kind: 'authority',     left: 77.1, label: 'Authority $185k',     labelPos: 'below', labelTone: 'success' },
        { kind: 'offer',         left: 83.3, label: '$200k',               labelPos: 'above' },
        { kind: 'demand',        left: 89.6, label: '$215k',               labelPos: 'below', labelTone: 'primary' },
        { kind: 'demand',        left: 100,  label: 'Demand $240k',         labelPos: 'above' },
      ],
      stats: [
        { k: 'Current gap',     v: '$55,000' },
        { k: 'Defense moved',   v: '+53%' },
        { k: 'Plaintiff moved', v: '−17%' },
      ],
      history: [
        { when: 'Oct 14', who: 'GEICO · M. Reed', pillKind: 'counter', amount: '$145,000', desc: 'Adjuster cites jury verdicts in similar Suffolk cases. Requested supplemental records.' },
        { when: 'Oct 7',  who: 'D. Altman',        pillKind: 'demand',  amount: '$215,000', desc: 'Reduction reflects updated MMI; flagged willingness to mediate.' },
        { when: 'Sep 28', who: 'GEICO · M. Reed', pillKind: 'counter', amount: '$135,000', desc: 'Argued mitigation re: chiropractic visits; we attached MA pattern jury instruction.' },
        { when: 'Sep 12', who: 'GEICO · M. Reed', pillKind: 'counter', amount: '$95,000',  desc: 'Initial response. Disputed pain & suffering multiplier.' },
        { when: 'Aug 1',  who: 'D. Altman',        pillKind: 'demand',  amount: '$240,000', desc: 'Initial demand letter delivered.' },
      ],
    };
  }
  getMockNegotiationAlert(): { tone: 'warn'; icon: string; html: string; actions: Array<{ label: string }> } {
    return {
      tone: 'warn', icon: 'ri-question-line',
      html: '<strong>Decision needed.</strong> Client authority is $185k. Counter to $200k or move to mediation? Mediation slot available Nov 4.',
      actions: [{ label: 'Counter $200k' }, { label: 'Schedule mediation' }, { label: 'File suit' }],
    };
  }

  // ----- Stage 7: Settled / disbursement -----
  getMockDisbursement(): { net: string; gross: string; reachedDate: string; checkDate: string; rows: Array<{ lbl: string; sub?: string; val: string; type?: 'gross'|'net' }> } {
    return {
      net: '$108,420.00',
      gross: '$185,000',
      reachedDate: 'Feb 5, 2027',
      checkDate: 'Feb 18',
      rows: [
        { lbl: 'Gross settlement',         val: '$185,000.00', type: 'gross' },
        { lbl: 'Attorney fees',            sub: '· 33⅓% contingent',  val: '−$61,654.50' },
        { lbl: 'Costs & expenses',         sub: '· filing, expert, records', val: '−$4,210.00' },
        { lbl: 'Health insurance lien',    sub: '· Blue Cross MA · negotiated 25% reduction', val: '−$8,565.00' },
        { lbl: 'PIP lien',                 sub: '· Progressive · waived', val: '−$0.00' },
        { lbl: 'Medical liens',            sub: '· 2 providers · negotiated total', val: '−$2,151.00' },
        { lbl: 'Net to Sarah Mitchell',    val: '$108,420.00',  type: 'net' },
      ],
    };
  }
  getMockClosingTasks(): Array<{ done: boolean; title: string; sub?: string; ownerInitials: string; ownerName: string; ownerTone?: string; due: string; dueTone?: 'warn'|'dng'|''; status: string; statusClass: string }> {
    return [
      { done: true,  title: 'Release executed by client',                        ownerInitials: 'SM', ownerName: 'Client',        due: 'Feb 8',           dueTone: '',     status: 'Done',         statusClass: 'sp-done' },
      { done: true,  title: 'Settlement check received & deposited to IOLTA',    ownerInitials: 'DA', ownerName: 'David Altman',  due: 'Feb 18',          dueTone: '',     status: 'Done',         statusClass: 'sp-done' },
      { done: true,  title: 'Lien negotiations finalized',                       ownerInitials: 'PL', ownerName: 'Paralegal',     ownerTone: 'info', due: 'Feb 19',  dueTone: '',     status: 'Done',         statusClass: 'sp-done' },
      { done: false, title: 'Pay liens & obtain releases', sub: 'Blue Cross MA, 2 medical providers', ownerInitials: 'PL', ownerName: 'Paralegal', ownerTone: 'info', due: 'Feb 22 · in 2d', dueTone: 'warn', status: 'In progress', statusClass: 'sp-progress' },
      { done: false, title: 'Issue disbursement check to client',                ownerInitials: 'DA', ownerName: 'David Altman',  due: 'Feb 22',          dueTone: '',     status: 'To do',        statusClass: 'sp-todo' },
      { done: false, title: 'Send closing & disbursement letter',                ownerInitials: 'DA', ownerName: 'David Altman',  due: 'Feb 23',          dueTone: '',     status: 'To do',        statusClass: 'sp-todo' },
      { done: false, title: 'Close matter & archive',                            ownerInitials: 'PL', ownerName: 'Paralegal',     ownerTone: 'info', due: 'Feb 24',  dueTone: '',     status: 'To do',        statusClass: 'sp-todo' },
    ];
  }

  // ----- Right rail: Damages Snapshot per stage -----
  getMockDamagesSnapshot(): { title: string; tag?: { label: string; tone: string }; rows: Array<{ k: string; v: string; vClass?: string }>; emptyNote?: string } {
    switch (this.stageKey) {
      case 'INVESTIGATION':
        return { title: 'Damages Snapshot', tag: { label: 'initial', tone: '' }, rows: [
          { k: 'Medical specials', v: '$8,420' },
          { k: 'Lost wages',       v: '$2,160' },
          { k: 'Property damage',  v: '$6,200' },
          { k: 'Demand range (est.)', v: '$45k–$95k', vClass: 'total' },
        ], emptyNote: 'Range will tighten as treatment progresses.' };
      case 'TREATMENT':
        return { title: 'Damages Snapshot', tag: { label: 'accumulating', tone: 'amber' }, rows: [
          { k: 'Medical specials', v: '$42,180' },
          { k: 'Lost wages',       v: '$8,640' },
          { k: 'Property damage',  v: '$6,200' },
          { k: 'Liens (est.)',     v: '$11,420' },
          { k: 'Demand range (AI)', v: '$135k–$190k', vClass: 'total' },
        ], emptyNote: 'Locks at MMI declaration.' };
      case 'PRE_DEMAND':
        return { title: 'Damages Snapshot', tag: { label: 'locked', tone: 'success' }, rows: [
          { k: 'Medical specials', v: '$61,420' },
          { k: 'Lost wages',       v: '$12,480' },
          { k: 'Property damage',  v: '$6,200' },
          { k: 'Liens',            v: '$11,420' },
          { k: 'Demand range (AI)', v: '$185k–$240k', vClass: 'total' },
        ] };
      case 'DEMAND_SENT':
        return { title: 'Demand Snapshot', tag: { label: 'sent', tone: 'primary' }, rows: [
          { k: 'Demand sent',         v: '$240,000' },
          { k: 'Med specials',        v: '$61,420' },
          { k: 'Wages + property',    v: '$18,680' },
          { k: 'P&S multiplier',      v: '2.4×' },
          { k: 'Walk-away authority', v: '$185,000', vClass: 'total' },
        ] };
      case 'NEGOTIATION':
        return { title: 'Settlement Posture', rows: [
          { k: 'Original demand',  v: '$240,000' },
          { k: 'Latest counter',   v: '$145,000', vClass: 'warn' },
          { k: 'Client authority', v: '$185,000', vClass: 'success' },
          { k: 'Recommended next', v: '$200,000' },
          { k: 'Current gap',      v: '$55,000', vClass: 'total' },
        ] };
      case 'SETTLED':
        return { title: 'Final Accounting', tag: { label: 'closed', tone: 'success' }, rows: [
          { k: 'Gross settlement',  v: '$185,000' },
          { k: 'Attorney fees',     v: '−$61,654' },
          { k: 'Costs & expenses',  v: '−$4,210' },
          { k: 'Liens (negotiated)', v: '−$10,716' },
          { k: 'Net to client',      v: '$108,420', vClass: 'total net' },
        ] };
      case 'INTAKE':
      default:
        return { title: 'Damages Snapshot', rows: [
          { k: 'Medical specials', v: '— pending records',     vClass: 'empty' },
          { k: 'Lost wages',       v: '— pending verification', vClass: 'empty' },
          { k: 'Property damage',  v: '— pending estimate',    vClass: 'empty' },
          { k: 'Demand range',     v: 'available after intake', vClass: 'total empty' },
        ], emptyNote: 'Estimate appears once initial records and wage data are on file.' };
    }
  }

  // ----- Right rail: Quick Actions per stage -----
  getMockQuickActions(): Array<{ icon: string; label: string; primary?: boolean; action?: string }> {
    switch (this.stageKey) {
      case 'INVESTIGATION': return [
        { icon: 'ri-folder-received-line', label: 'Request a record',         primary: true },
        { icon: 'ri-user-voice-line',     label: 'Log witness statement' },
        { icon: 'ri-microscope-line',     label: 'Engage expert' },
        { icon: 'ri-file-text-line',      label: 'Generate liability memo' },
        { icon: 'ri-camera-line',         label: 'Upload evidence' },
        { icon: 'ri-phone-line',          label: 'Log a call' },
      ];
      case 'TREATMENT': return [
        { icon: 'ri-stethoscope-line',     label: 'Log treatment update',     primary: true },
        { icon: 'ri-folder-received-line', label: 'Request records (provider)' },
        { icon: 'ri-money-dollar-circle-line', label: 'Request lien letter' },
        { icon: 'ri-add-line',             label: 'Add new provider' },
        { icon: 'ri-calendar-event-line',  label: 'Log appointment' },
        { icon: 'ri-file-list-line',       label: 'Request prognosis letter' },
      ];
      case 'PRE_DEMAND': return [
        { icon: 'ri-magic-line',           label: 'Run AI medical summary',   primary: true },
        { icon: 'ri-calculator-line',      label: 'Finalize damages calc' },
        { icon: 'ri-mail-send-line',       label: 'Generate demand draft' },
        { icon: 'ri-folder-received-line', label: 'Request final records' },
        { icon: 'ri-eye-line',             label: 'Send for partner review' },
        { icon: 'ri-user-line',            label: 'Schedule client review' },
      ];
      case 'DEMAND_SENT': return [
        { icon: 'ri-mail-line',           label: 'Log offer received',       primary: true },
        { icon: 'ri-mail-send-line',      label: 'Send adjuster follow-up' },
        { icon: 'ri-phone-line',          label: 'Schedule adjuster call' },
        { icon: 'ri-sticky-note-line',    label: 'Add note' },
        { icon: 'ri-arrow-up-line',       label: 'Escalate to supervisor' },
      ];
      case 'NEGOTIATION': return [
        { icon: 'ri-mail-send-line',      label: 'Send counter offer',       primary: true },
        { icon: 'ri-mail-line',           label: 'Log new offer' },
        { icon: 'ri-quill-pen-line',      label: 'Draft acceptance' },
        { icon: 'ri-group-line',          label: 'Schedule mediation' },
        { icon: 'ri-court-line',          label: 'File suit' },
        { icon: 'ri-user-line',           label: 'Discuss with client' },
      ];
      case 'SETTLED': return [
        { icon: 'ri-bank-line',           label: 'Issue disbursement check', primary: true },
        { icon: 'ri-money-dollar-circle-line', label: 'Pay liens' },
        { icon: 'ri-mail-send-line',      label: 'Send closing letter' },
        { icon: 'ri-file-text-line',      label: 'Generate disbursement statement' },
        { icon: 'ri-archive-line',        label: 'Close matter & archive' },
      ];
      case 'INTAKE':
      default: return [
        { icon: 'ri-mail-line',           label: 'Send client portal invite', primary: true },
        { icon: 'ri-phone-line',          label: 'Log a call' },
        { icon: 'ri-sticky-note-line',    label: 'Add a note' },
        { icon: 'ri-police-car-line',     label: 'Request police report' },
        { icon: 'ri-stethoscope-line',    label: 'Add treatment provider' },
        { icon: 'ri-shield-line',         label: 'Request policy declarations' },
      ];
    }
  }

  /** Routes a stage-specific quick-action label to the closest existing handler. */
  onStageQuickAction(label: string): void {
    const l = label.toLowerCase();
    if (l.includes('demand draft') || l.includes('counter') || l.includes('demand'))     return this.openLegiDraft('demand_letter');
    if (l.includes('log offer') || l.includes('log new offer'))                          return this.quickAction('logOffer');
    if (l.includes('log call') || l.includes('schedule adjuster call'))                  return this.quickAction('logCall');
    if (l.includes('add note') || l.includes('note'))                                    return this.quickAction('addNote');
    if (l.includes('request') && l.includes('record'))                                   return this.quickAction('requestRecord');
    if (l.includes('liability memo') || l.includes('memo') || l.includes('brief'))       return this.draftBrief();
    if (l.includes('mediation'))                                                         return (this.activeTab = 'negotiation', undefined as any);
    if (l.includes('archive') || l.includes('close matter'))                             return this.archiveCase();
    this.activeTab = 'caseFile';
  }

  /** Public hook for the activity refresh button — re-pulls the live feed. */
  refreshActivities(): void {
    if (this.case?.id) this.loadActivities(Number(this.case.id));
  }

  // ----- Recent Activity timeline (per stage, mockup-faithful) -----
  /**
   * Returns a stage-keyed timeline of activity events grouped into relative
   * clusters (Today / Earlier). Each event carries a tone-coded icon and an
   * actor label so the timeline reads at a glance. While we're in the design
   * pass this data drives the UI directly; once backend wiring lands, the
   * `recentActivities` array will be reshaped into this same format.
   */
  getMockActivityClusters(): Array<{ label: string; events: Array<{ when: string; who: string; tone: 'success'|'info'|'warning'|'primary'|'danger'|'neutral'; icon: string; descHtml: string }> }> {
    switch (this.stageKey) {
      case 'INVESTIGATION': return [
        { label: 'Today', events: [
          { when: '2:18pm',  who: 'David Altman', tone: 'info',    icon: 'ri-user-voice-line',  descHtml: 'Witness statement scheduled for <strong>M. Lopez · Jun 22</strong>.' },
        ]},
        { label: 'Earlier', events: [
          { when: 'Jun 7',  who: 'David Altman', tone: 'success', icon: 'ri-user-voice-line',   descHtml: 'Recorded statement from <strong>James Park</strong> (passenger witness).' },
          { when: 'Jun 4',  who: 'System',       tone: 'success', icon: 'ri-file-paper-line',   descHtml: '<strong>Police report received</strong> from Suffolk PD Records.' },
          { when: 'Jun 3',  who: 'David Altman', tone: 'success', icon: 'ri-shield-check-line', descHtml: 'Liability <strong>accepted by GEICO</strong> per phone call w/ M. Reed.' },
        ]},
      ];
      case 'TREATMENT': return [
        { label: 'Today', events: [
          { when: '8:48am', who: 'System', tone: 'success', icon: 'ri-stethoscope-line', descHtml: 'PT visit logged: <strong>Cambridge PT &amp; Sports</strong> · session 14.' },
        ]},
        { label: 'Earlier', events: [
          { when: 'Jun 12', who: 'Paralegal',    tone: 'info',    icon: 'ri-folder-received-line',    descHtml: 'Records request sent to <strong>North End Orthopedics</strong>.' },
          { when: 'Jun 10', who: 'System',       tone: 'warning', icon: 'ri-money-dollar-circle-line', descHtml: 'Monthly specials update: <strong>+$3,840</strong> · running total $42,180.' },
          { when: 'Jun 4',  who: 'David Altman', tone: 'primary', icon: 'ri-add-line',                 descHtml: 'Added provider: <strong>Beacon Pain Management</strong>.' },
        ]},
      ];
      case 'PRE_DEMAND': return [
        { label: 'Today', events: [
          { when: '10:12am', who: 'David Altman', tone: 'primary', icon: 'ri-magic-line', descHtml: 'Generated medical narrative summary using AI · reviewed.' },
        ]},
        { label: 'Earlier', events: [
          { when: 'Jul 19', who: 'System',       tone: 'success', icon: 'ri-shield-check-line',   descHtml: '<strong>MMI declared</strong> by Dr. Tanaka · final specials locked at $61,420.' },
          { when: 'Jul 16', who: 'Paralegal',    tone: 'info',    icon: 'ri-folder-received-line', descHtml: 'Final records received from Cambridge PT.' },
          { when: 'Jul 12', who: 'David Altman', tone: 'warning', icon: 'ri-mail-send-line',       descHtml: "Wage-loss verification request sent to client's employer." },
        ]},
      ];
      case 'DEMAND_SENT': return [
        { label: 'Today', events: [
          { when: '11:14am', who: 'David Altman', tone: 'info', icon: 'ri-phone-line', descHtml: 'Voicemail to M. Reed re: demand confirmation.' },
        ]},
        { label: 'Earlier', events: [
          { when: 'Aug 5',  who: 'System',       tone: 'success', icon: 'ri-mail-check-line', descHtml: 'Demand <strong>delivered</strong> · USPS certified · receipt signed.' },
          { when: 'Aug 1',  who: 'David Altman', tone: 'primary', icon: 'ri-mail-send-line',  descHtml: 'Sent demand letter <strong>$240,000</strong> · 47-page package.' },
          { when: 'Jul 31', who: 'D. Altman',    tone: 'info',    icon: 'ri-eye-line',         descHtml: 'Demand draft reviewed by partner · approved.' },
        ]},
      ];
      case 'NEGOTIATION': return [
        { label: 'Today', events: [
          { when: '9:30am', who: 'David Altman', tone: 'info', icon: 'ri-phone-line', descHtml: 'Call w/ client to discuss $145k offer · authorized $185k.' },
        ]},
        { label: 'Earlier', events: [
          { when: 'Oct 14', who: 'System',       tone: 'warning', icon: 'ri-mail-line',      descHtml: 'Counter received from GEICO: <strong>$145,000</strong>.' },
          { when: 'Oct 7',  who: 'David Altman', tone: 'primary', icon: 'ri-mail-send-line', descHtml: 'Sent revised demand of <strong>$215,000</strong>.' },
          { when: 'Sep 28', who: 'System',       tone: 'warning', icon: 'ri-mail-line',      descHtml: 'Counter received: <strong>$135,000</strong>.' },
        ]},
      ];
      case 'SETTLED': return [
        { label: 'Today', events: [
          { when: '9:14am', who: 'Paralegal', tone: 'info', icon: 'ri-shield-check-line', descHtml: 'Lien negotiations finalized · Blue Cross at 25% reduction.' },
        ]},
        { label: 'Earlier', events: [
          { when: 'Feb 18', who: 'David Altman',   tone: 'success', icon: 'ri-bank-line',       descHtml: 'Settlement check <strong>$185,000</strong> received and deposited to IOLTA.' },
          { when: 'Feb 8',  who: 'Sarah Mitchell', tone: 'success', icon: 'ri-quill-pen-line',  descHtml: 'Release agreement <strong>signed</strong> by client.' },
          { when: 'Feb 5',  who: 'David Altman',   tone: 'primary', icon: 'ri-handshake-line',   descHtml: 'Settlement reached: <strong>$185,000</strong> · post-mediation.' },
        ]},
      ];
      case 'INTAKE':
      default: return [
        { label: 'Today', events: [
          { when: '9:14am', who: 'Sarah Mitchell', tone: 'success', icon: 'ri-upload-cloud-line', descHtml: 'Uploaded <strong>retainer-signed.pdf</strong> via client portal.' },
          { when: '6:02am', who: 'David Altman',   tone: 'info',    icon: 'ri-phone-line',         descHtml: 'Logged 12-min initial intake call.' },
        ]},
        { label: 'Earlier', events: [
          { when: 'Yesterday', who: 'David Altman', tone: 'warning', icon: 'ri-mail-send-line',  descHtml: 'Sent <strong>letter of representation</strong> to GEICO.' },
          { when: 'Apr 27',    who: 'System',       tone: 'primary', icon: 'ri-folder-add-line', descHtml: 'Matter opened from intake form submission.' },
        ]},
      ];
    }
  }

  // ----- Notes (mockup-style: 2 demo notes, visibility-tagged) -----
  /**
   * Returns a small, mockup-faithful note set for the design phase. When
   * backend wiring lands the existing `caseNotes` array (already loaded by
   * `loadCaseNotes`) is the canonical source; this getter just gives the
   * design pass concrete content to render against.
   */
  getMockNotes(): Array<{ title: string; content: string; visibility: 'internal'|'shared'; author: string; authorInitials: string; authorTone?: string; when: string }> {
    return [
      { title: 'Adjuster contact',          visibility: 'internal', author: 'David Altman', authorInitials: 'DA', when: '2 days ago',
        content: 'Marcus Reed (GEICO ext. 4471). Liability accepted; pinged about specials updates.' },
      { title: 'Client comms preference',   visibility: 'shared',   author: 'Paralegal',    authorInitials: 'PL', authorTone: 'info', when: '5 days ago',
        content: 'Sarah prefers texts to email; available evenings after 6pm.' },
    ];
  }

  // ----- Right rail: Key Dates per stage -----
  getMockKeyDates(): Array<{ name: string; when: string; sub: string; cnt: string; cntTone?: 'warn'|'dng'|'' }> {
    switch (this.stageKey) {
      case 'INVESTIGATION': return [
        { name: 'Witness statement (Lopez)',  when: 'Jun 22',       sub: 'Office',         cnt: 'in 8 days',  cntTone: 'warn' },
        { name: 'Vehicle disposal hold',       when: 'Jul 1',        sub: 'Body shop',     cnt: 'in 17 days', cntTone: 'warn' },
        { name: 'Expert engagement decision',  when: 'Jun 25',       sub: 'Internal',      cnt: 'in 11 days', cntTone: 'warn' },
        { name: 'Statute of limitations',      when: 'Apr 16, 2029', sub: '3-yr MA tort',  cnt: '2y 9m' },
      ];
      case 'TREATMENT': return [
        { name: 'Ortho re-eval (MMI?)',        when: 'Jun 18',       sub: 'Dr. Tanaka',    cnt: 'in 4 days',  cntTone: 'warn' },
        { name: 'PT block re-auth',            when: 'Jun 24',       sub: 'Cambridge PT',   cnt: 'in 10 days', cntTone: 'warn' },
        { name: 'Pain mgmt follow-up',         when: 'Jul 8',        sub: 'Dr. Schmidt',   cnt: 'in 24 days' },
        { name: 'Target demand send',          when: 'Aug 1',        sub: 'Internal milestone', cnt: 'in 48 days' },
        { name: 'Statute of limitations',      when: 'Apr 16, 2029', sub: '3-yr MA tort',  cnt: '2y 8m' },
      ];
      case 'PRE_DEMAND': return [
        { name: 'Final records cutoff',        when: 'Jul 25',       sub: 'Demand prep',   cnt: 'in 4 days',  cntTone: 'warn' },
        { name: 'Partner review',              when: 'Jul 29',       sub: 'Internal',      cnt: 'in 8 days',  cntTone: 'warn' },
        { name: 'Demand send target',          when: 'Aug 1',        sub: 'External milestone', cnt: 'in 11 days', cntTone: 'warn' },
        { name: 'Statute of limitations',      when: 'Apr 16, 2029', sub: '3-yr MA tort',  cnt: '2y 8m' },
      ];
      case 'DEMAND_SENT': return [
        { name: 'Adjuster follow-up',          when: 'Aug 22',       sub: 'Scheduled call', cnt: 'in 8 days', cntTone: 'warn' },
        { name: 'Response deadline',           when: 'Aug 31',       sub: 'Demand window',  cnt: 'in 17 days', cntTone: 'dng' },
        { name: 'Escalation to supervisor',    when: 'Sep 5',        sub: 'If no response', cnt: 'in 22 days' },
        { name: 'Statute of limitations',      when: 'Apr 16, 2029', sub: '3-yr MA tort',   cnt: '2y 8m' },
      ];
      case 'NEGOTIATION': return [
        { name: 'Counter response window',     when: 'Oct 21',       sub: 'Adjuster typical', cnt: 'in 7 days', cntTone: 'warn' },
        { name: 'Mediation slot',              when: 'Nov 4',        sub: 'JAMS Boston',    cnt: 'in 21 days', cntTone: 'warn' },
        { name: 'Suit-filing deadline (internal)', when: 'Dec 1',    sub: 'If no settlement', cnt: 'in 48 days' },
        { name: 'Statute of limitations',      when: 'Apr 16, 2029', sub: '3-yr MA tort',   cnt: '2y 6m' },
      ];
      case 'SETTLED': return [
        { name: 'Lien releases by',            when: 'Feb 22',       sub: 'Health + medical', cnt: 'in 2 days', cntTone: 'warn' },
        { name: 'Disbursement to client',      when: 'Feb 22',       sub: 'IOLTA → client',  cnt: 'in 2 days', cntTone: 'warn' },
        { name: 'Closing letter sent',         when: 'Feb 23',       sub: 'Client confirmation', cnt: 'in 3 days' },
        { name: 'Matter archive',              when: 'Feb 24',       sub: '7-yr retention starts', cnt: 'in 4 days' },
      ];
      case 'INTAKE':
      default: return [
        { name: 'Retainer 30-day window',      when: 'May 17',       sub: 'Massachusetts rule', cnt: 'in 17 days', cntTone: 'warn' },
        { name: 'ER follow-up appt',           when: 'May 8',        sub: 'Boston General',  cnt: 'in 8 days',  cntTone: 'warn' },
        { name: 'Statute of limitations',      when: 'Apr 16, 2029', sub: '3-yr MA tort',    cnt: '2y 11m' },
      ];
    }
  }
}
