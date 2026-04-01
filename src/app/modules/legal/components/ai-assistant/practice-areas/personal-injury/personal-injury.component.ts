import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, BehaviorSubject, Observable, of } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, switchMap, catchError, map, take } from 'rxjs/operators';
import { NgbNavModule, NgbDropdownModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { PracticeAreaBaseComponent } from '../../shared/practice-area-base.component';
import { AiResponseFormatterPipe } from '../../shared/ai-response-formatter.pipe';
import { AiResponseModalService } from '../../shared/services/ai-response-modal.service';
import { WorkspaceStateService } from '../../shared/services/workspace-state.service';
import { ToolHistoryItem } from '../../shared/models/tool-history.model';
import { CaseService } from '../../../../services/case.service';
import { LegalCase } from '../../../../interfaces/case.interface';
import { environment } from '../../../../../../../environments/environment';
import Swal from 'sweetalert2';
import { Chart, registerables } from 'chart.js';

// PI Professional Platform Services
import { PIMedicalRecordService } from '../../shared/services/pi-medical-record.service';
import { PIDocumentChecklistService } from '../../shared/services/pi-document-checklist.service';
import { PIDamageCalculationService } from '../../shared/services/pi-damage-calculation.service';
import { PIMedicalSummaryService } from '../../shared/services/pi-medical-summary.service';
import { BackgroundTaskService } from '../../../../services/background-task.service';
import {
  PIDocumentRequestService,
  DocumentRecipient,
  DocumentRequestLog,
  DocumentRequestTemplate,
  SendDocumentRequest,
  BulkSendResult
} from '../../shared/services/pi-document-request.service';
import { BulkRequestWizardComponent } from '../../shared/components/bulk-request-wizard/bulk-request-wizard.component';
import { PIProviderDirectoryService, ProviderDirectory } from '../../shared/services/pi-provider-directory.service';
import { PIPortfolioService, PIPortfolioStats } from '../../shared/services/pi-portfolio.service';
import { PISettlementService, PISettlementEvent } from '../../shared/services/pi-settlement.service';

// PI Professional Platform Models
import {
  PIMedicalRecord,
  RECORD_TYPES,
  PROVIDER_TYPES,
  FieldCitation,
  CitationMetadata
} from '../../shared/models/pi-medical-record.model';
import { CitationViewerModalComponent } from '../../citation-viewer-modal/citation-viewer-modal.component';
import {
  PIDocumentChecklist,
  DocumentCompletenessScore,
  DOCUMENT_TYPES,
  DOCUMENT_STATUSES
} from '../../shared/models/pi-document-checklist.model';
import {
  PIDamageElement,
  PIDamageCalculation,
  DAMAGE_ELEMENT_TYPES,
  CALCULATION_METHODS,
  CONFIDENCE_LEVELS,
  IRS_MILEAGE_RATE
} from '../../shared/models/pi-damage-calculation.model';
import {
  PIMedicalSummary,
  ProviderSummaryItem,
  DiagnosisItem,
  RedFlagItem,
  TreatmentGap
} from '../../shared/models/pi-medical-summary.model';

// AI Workspace Document Editor and Services
import { DocumentEditorComponent } from '../../ai-workspace/document-editor/document-editor.component';
import { DocumentGenerationService, DocumentTransformRequest } from '../../../../services/document-generation.service';
import { UserService } from '../../../../../../service/user.service';
import { WebSocketService } from '../../../../../../core/services/websocket.service';

// Register Chart.js components
Chart.register(...registerables);

interface DemandLetterVersion {
  id: number;
  versionNumber: number;
  content: string;
  wordCount: number;
  transformationType: string;
  createdAt: string;
}

interface MedicalProvider {
  id: string;
  name: string;
  specialty: string;
  treatmentDates: string;
  totalBills: number;
}

interface CaseValueCalculation {
  medicalExpenses: number;
  lostWages: number;
  futureMedical: number;
  economicDamages: number;
  multiplier: number;
  nonEconomicDamages: number;
  totalCaseValue: number;
  comparativeNegligence: number;
  adjustedCaseValue: number;
  policyLimit: number | null;
  realisticRecovery: number;
  // AI-calculated fields
  settlementRangeLow?: number;
  settlementRangeHigh?: number;
  caseStrength?: number;
  keyFactors?: string[];
  multiplierReasoning?: string;
  recommendations?: string;
  medicalToLimitRatio?: number;
  isUnderinsured?: boolean;
}

interface ActivityItem {
  id: string;
  toolType: string;
  title: string;
  timestamp: Date;
  data?: any;
}

@Component({
  selector: 'app-personal-injury',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    NgbNavModule,
    NgbDropdownModule,
    AiResponseFormatterPipe,
    BulkRequestWizardComponent,
    DocumentEditorComponent
  ],
  templateUrl: './personal-injury.component.html',
  styleUrls: ['./personal-injury.component.scss']
})
export class PersonalInjuryComponent extends PracticeAreaBaseComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('damageChart') damageChartRef!: ElementRef<HTMLCanvasElement>;
  private damageChart: Chart<'doughnut'> | null = null;

  private destroy$ = new Subject<void>();
  private caseSwitch$ = new Subject<void>();  // Cancels case-specific subscriptions on case switch

  // View State Management (Three-Mode Architecture: Dashboard, Workspace, Directory)
  viewMode: 'dashboard' | 'workspace' | 'directory' = 'dashboard';
  previousMode: 'dashboard' | 'workspace' = 'dashboard';
  activeTab: string = 'overview';

  // Sub-tab states for consolidated tabs
  documentsSubTab: 'demand-letter' | 'checklist' = 'checklist';
  medicalSubTab: 'records' | 'summary' | 'timeline' = 'records';

  // FAB and Search
  fabExpanded: boolean = false;
  globalSearch: string = '';

  // Case Context Integration
  linkedCase: LegalCase | null = null;
  caseSearchTerm$ = new BehaviorSubject<string>('');
  searchResults: LegalCase[] = [];
  isSearchingCases: boolean = false;
  showCaseDropdown: boolean = false;
  caseSearchInput: string = '';
  prefilledFromCase: boolean = false;

  // Portfolio Dashboard State
  portfolioStats: PIPortfolioStats | null = null;
  piCaseList: LegalCase[] = [];
  isLoadingPortfolio: boolean = false;
  isLoadingPICases: boolean = false;
  portfolioCasesPage: number = 0;
  portfolioCasesTotalPages: number = 0;
  portfolioCasesTotal: number = 0;
  portfolioSearchTerm: string = '';
  portfolioStatusFilter: string = '';

  // Dashboard Metrics
  latestCaseValue: number = 0;
  recentActivity: ActivityItem[] = [];

  // Case Value Calculator
  caseValueForm: FormGroup;
  calculatedValue: CaseValueCalculation | null = null;
  isCalculating: boolean = false;

  // Collapsible Sections State
  collapsedSections: { [key: string]: boolean } = {
    injury: false,
    economic: false,
    multiplier: false,
    liability: false
  };

  // Collapsible Damage Groups State (for consolidated Case Valuation tab)
  collapsedDamageGroups: { [key: string]: boolean } = {};

  // Demand Letter Generator
  demandForm: FormGroup;
  generatedDemand: string = '';
  isGeneratingDemand: boolean = false;

  // Demand Letter Document State (AI Workspace Integration)
  demandDocumentId: number | null = null;
  demandConversationId: number | null = null;
  demandDocumentContent: string = '';
  isEditingDemand: boolean = false;
  hasUnsavedDemandChanges: boolean = false;
  isSavingDemand: boolean = false;
  demandVersions: DemandLetterVersion[] = [];
  showDemandVersionHistory: boolean = false;
  isTransformingDemand: boolean = false;

  // Medical Providers Tracker
  medicalProviders: MedicalProvider[] = [];
  newProvider: MedicalProvider = {
    id: '',
    name: '',
    specialty: '',
    treatmentDates: '',
    totalBills: 0
  };

  // Settlement Tracker
  settlementForm: FormGroup;
  settlementHistory: any[] = [];

  // Injury Types
  injuryTypes = [
    { value: 'soft_tissue', label: 'Soft Tissue (Whiplash, Sprains)', multiplier: 1.5 },
    { value: 'fracture', label: 'Fractures / Broken Bones', multiplier: 2.5 },
    { value: 'disc_injury', label: 'Disc Herniation / Bulge', multiplier: 3.0 },
    { value: 'tbi', label: 'Traumatic Brain Injury (TBI)', multiplier: 4.0 },
    { value: 'spinal', label: 'Spinal Cord Injury', multiplier: 5.0 },
    { value: 'burn', label: 'Severe Burns', multiplier: 4.0 },
    { value: 'amputation', label: 'Amputation / Loss of Limb', multiplier: 5.0 },
    { value: 'wrongful_death', label: 'Wrongful Death', multiplier: 5.0 },
    { value: 'other', label: 'Other Serious Injury', multiplier: 2.5 }
  ];

  // Liability Options
  liabilityOptions = [
    { value: 'CLEAR', label: 'Clear Liability (100% Defendant Fault)' },
    { value: 'COMPARATIVE', label: 'Comparative Negligence (Shared Fault)' },
    { value: 'DISPUTED', label: 'Disputed Liability' }
  ];

  // Medical Specialties
  medicalSpecialties = [
    'Emergency Medicine',
    'Orthopedics',
    'Neurology',
    'Physical Therapy',
    'Chiropractic',
    'Pain Management',
    'Surgery',
    'Radiology',
    'Primary Care',
    'Psychology/Psychiatry',
    'Other'
  ];

  // ==========================================
  // PI Professional Platform Properties
  // ==========================================

  // Medical Records (Professional)
  medicalRecords: PIMedicalRecord[] = [];
  isLoadingMedicalRecords: boolean = false;
  isScanningDocuments: boolean = false;
  scanResult: any = null;
  scanProgress: { current: number; total: number; percentComplete: number; currentFile: string } | null = null;
  private scanTimeoutId: any = null;
  private scanTaskId: string | null = null;
  private scanPollId: any = null;
  private preScanRecordCount: number = 0;
  medicalRecordForm: FormGroup;
  editingMedicalRecord: PIMedicalRecord | null = null;
  recordTypes = RECORD_TYPES;
  providerTypes = PROVIDER_TYPES;

  // View Mode
  recordsViewMode: 'flat' | 'grouped' = 'flat';
  cachedGroupedRecords: Array<{ providerName: string; providerType: string; records: PIMedicalRecord[]; totalBilled: number; dateRange: string; collapsed: boolean }> | null = null;

  // Treatment Timeline
  treatmentGaps: TreatmentGap[] = [];
  isLoadingTimeline: boolean = false;

  // Medical Summary
  medicalSummary: PIMedicalSummary | null = null;
  isGeneratingSummary: boolean = false;
  isLoadingMedicalSummary: boolean = false;
  summaryExists: boolean = false;

  // Adjuster Defense Analysis
  adjusterAnalysis: any = null;
  isGeneratingAdjusterAnalysis: boolean = false;
  adjusterExpandedItems: Set<number> = new Set([0, 1]); // First two expanded by default

  // Document scan status
  scanStatus: any = null;
  hasUnscannedDocuments = false;
  unscannedCount = 0;

  // Document Checklist
  documentChecklist: PIDocumentChecklist[] = [];
  groupedDocuments: { type: string; label: string; icon: string; items: PIDocumentChecklist[]; receivedCount: number; totalCount: number }[] = [];
  isLoadingChecklist: boolean = false;
  documentCompleteness: DocumentCompletenessScore | null = null;
  documentTypes = DOCUMENT_TYPES;
  documentStatuses = DOCUMENT_STATUSES;

  // Document Request System (Smart Routing)
  selectedChecklistItem: PIDocumentChecklist | null = null;
  resolvedRecipient: DocumentRecipient | null = null;
  requestTemplates: DocumentRequestTemplate[] = [];
  selectedTemplate: DocumentRequestTemplate | null = null;
  requestHistory: DocumentRequestLog[] = [];
  isResolvingRecipient: boolean = false;
  isSendingRequest: boolean = false;
  isLoadingHistory: boolean = false;
  selectedChannel: string = 'EMAIL';
  customRecipient: {
    name: string;
    email: string;
    phone: string;
  } = { name: '', email: '', phone: '' };
  bulkSelectMode: boolean = false;
  selectedForBulk: Set<number> = new Set();
  showBulkWizard: boolean = false;
  bulkWizardItemIds: number[] = [];

  // Damage Elements (Professional)
  damageElements: PIDamageElement[] = [];
  damageCalculation: PIDamageCalculation | null = null;
  isLoadingDamages: boolean = false;
  isCalculatingDamages: boolean = false;
  damageElementTypes = DAMAGE_ELEMENT_TYPES;
  calculationMethods = CALCULATION_METHODS;
  confidenceLevels = CONFIDENCE_LEVELS;
  irsMileageRate = IRS_MILEAGE_RATE;

  // New Damage Element Form
  newDamageElement: Partial<PIDamageElement> = {
    elementType: 'PAST_MEDICAL',
    elementName: '',
    calculationMethod: 'ACTUAL',
    baseAmount: 0,
    calculatedAmount: 0,
    confidenceLevel: 'MEDIUM'
  };

  // Provider Directory
  providers: ProviderDirectory[] = [];
  filteredProviders: ProviderDirectory[] = [];
  isLoadingProviders: boolean = false;
  providerSearchTerm: string = '';
  providerTypeFilter: string = '';
  providerViewMode: 'cards' | 'table' = 'cards';
  showProviderModal: boolean = false;
  editingProvider: ProviderDirectory | null = null;
  isSavingProvider: boolean = false;
  expandedProviderId: number | null = null;
  selectedProvider: ProviderDirectory | null = null;

  // Getter for providers with records contact
  get providersWithRecordsContact(): number {
    return this.providers.filter(p => p.recordsEmail || p.recordsPhone).length;
  }

  // Getter for providers with billing contact
  get providersWithBillingContact(): number {
    return this.providers.filter(p => p.billingEmail || p.billingPhone).length;
  }

  // Get count of fully complete providers (has both records and billing contact)
  getCompleteProviders(): number {
    return this.providers.filter(p =>
      (p.recordsEmail || p.recordsPhone) && (p.billingEmail || p.billingPhone)
    ).length;
  }

  // Get providers without any contact info
  getProvidersWithoutContact(): number {
    return this.providers.filter(p =>
      !p.recordsEmail && !p.recordsPhone && !p.billingEmail && !p.billingPhone
    ).length;
  }

  // Get provider completeness percentage (based on having contact info)
  getProviderCompletenessPercent(): number {
    if (this.providers.length === 0) return 0;
    return Math.round((this.providersWithRecordsContact / this.providers.length) * 100);
  }

  // Get provider type counts for the mini breakdown
  getProviderTypeCounts(): { type: string; label: string; count: number; color: string; icon: string }[] {
    const typeCounts: { [key: string]: number } = {};
    const typeInfo: { [key: string]: { label: string; color: string; icon: string } } = {
      'HOSPITAL': { label: 'Hospital', color: '#f06548', icon: 'ri-hospital-line' },
      'CLINIC': { label: 'Clinic', color: '#0ab39c', icon: 'ri-stethoscope-line' },
      'IMAGING': { label: 'Imaging', color: '#299cdb', icon: 'ri-scan-line' },
      'PHYSICAL_THERAPY': { label: 'PT', color: '#f7b84b', icon: 'ri-walk-line' },
      'CHIROPRACTIC': { label: 'Chiro', color: '#7c3aed', icon: 'ri-body-scan-line' },
      'PHARMACY': { label: 'Pharmacy', color: '#ec4899', icon: 'ri-medicine-bottle-line' },
      'LABORATORY': { label: 'Lab', color: '#14b8a6', icon: 'ri-test-tube-line' },
      'URGENT_CARE': { label: 'Urgent Care', color: '#f97316', icon: 'ri-first-aid-kit-line' },
      'OTHER': { label: 'Other', color: '#64748b', icon: 'ri-building-2-line' }
    };

    this.providers.forEach(p => {
      const type = p.providerType || 'OTHER';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    return Object.entries(typeCounts)
      .map(([type, count]) => ({
        type,
        label: typeInfo[type]?.label || type,
        count,
        color: typeInfo[type]?.color || '#64748b',
        icon: typeInfo[type]?.icon || 'ri-building-2-line'
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  // Get provider contact status for card display
  getProviderContactStatus(provider: ProviderDirectory): { hasRecords: boolean; hasBilling: boolean; hasFees: boolean } {
    return {
      hasRecords: !!(provider.recordsEmail || provider.recordsPhone || provider.recordsFax),
      hasBilling: !!(provider.billingEmail || provider.billingPhone),
      hasFees: !!(provider.baseFee || provider.perPageFee || provider.rushFee)
    };
  }

  // Toggle provider card expansion
  toggleProviderExpand(providerId: number | undefined): void {
    if (!providerId) return;
    this.expandedProviderId = this.expandedProviderId === providerId ? null : providerId;
  }

  // Select provider to show in detail panel
  selectProvider(provider: ProviderDirectory): void {
    this.selectedProvider = this.selectedProvider?.id === provider.id ? null : provider;
  }

  // Get icon for provider type
  getProviderIcon(providerType: string): string {
    const icons: { [key: string]: string } = {
      'HOSPITAL': 'ri-hospital-line',
      'CLINIC': 'ri-stethoscope-line',
      'IMAGING': 'ri-scan-line',
      'LABORATORY': 'ri-test-tube-line',
      'PHARMACY': 'ri-capsule-line',
      'PHYSICAL_THERAPY': 'ri-walk-line',
      'CHIROPRACTOR': 'ri-body-scan-line',
      'SPECIALIST': 'ri-user-star-line',
      'PRIMARY_CARE': 'ri-heart-pulse-line',
      'EMERGENCY': 'ri-first-aid-kit-line',
      'SURGERY_CENTER': 'ri-surgical-mask-line',
      'MENTAL_HEALTH': 'ri-mental-health-line',
      'OTHER': 'ri-building-2-line'
    };
    return icons[providerType] || icons['OTHER'];
  }

  // Copy to clipboard with toast feedback
  copyToClipboard(text: string, label: string): void {
    navigator.clipboard.writeText(text).then(() => {
      // Show a brief toast notification
      const toast = document.createElement('div');
      toast.className = 'copy-toast';
      toast.innerHTML = `<i class="ri-check-line"></i> ${label} copied!`;
      document.body.appendChild(toast);
      setTimeout(() => toast.classList.add('show'), 10);
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 2000);
    });
  }

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private router: Router,
    private route: ActivatedRoute,
    private aiModalService: AiResponseModalService,
    private workspaceState: WorkspaceStateService,
    private caseService: CaseService,
    private medicalRecordService: PIMedicalRecordService,
    private documentChecklistService: PIDocumentChecklistService,
    private damageCalculationService: PIDamageCalculationService,
    private medicalSummaryService: PIMedicalSummaryService,
    private documentRequestService: PIDocumentRequestService,
    public providerDirectoryService: PIProviderDirectoryService,
    private modalService: NgbModal,
    private documentGenerationService: DocumentGenerationService,
    private userService: UserService,
    private portfolioService: PIPortfolioService,
    private settlementService: PISettlementService,
    private webSocketService: WebSocketService,
    private backgroundTaskService: BackgroundTaskService
  ) {
    super();

    // Initialize Case Value Calculator Form
    this.caseValueForm = this.fb.group({
      injuryType: ['soft_tissue', Validators.required],
      injuryDescription: [''],  // Optional - not required for calculation
      medicalExpenses: [0, [Validators.required, Validators.min(0)]],
      lostWages: [0, [Validators.required, Validators.min(0)]],
      futureMedical: [0, [Validators.min(0)]],
      customMultiplier: [null],
      liabilityAssessment: ['CLEAR', Validators.required],
      comparativeNegligence: [0, [Validators.min(0), Validators.max(100)]],
      policyLimit: [null, [Validators.min(0)]]
    });

    // Initialize Demand Letter Form
    this.demandForm = this.fb.group({
      clientName: ['', Validators.required],
      defendantName: ['', Validators.required],
      insuranceCompany: ['', Validators.required],
      adjusterName: [''],
      claimNumber: [''],
      accidentDate: ['', Validators.required],
      accidentLocation: ['', Validators.required],
      injuryType: ['', Validators.required],
      injuryDescription: ['', Validators.required],
      liabilityDetails: ['', Validators.required],
      medicalExpenses: [0, Validators.required],
      lostWages: [0],
      futureMedical: [0],
      policyLimit: [null],
      painSufferingMultiplier: [2.5, Validators.required],
      demandTotalOverride: [null]
    });

    // Initialize Settlement Form
    this.settlementForm = this.fb.group({
      demandAmount: [0, Validators.required],
      offerAmount: [0],
      offerDate: [''],
      counterAmount: [0],
      notes: ['']
    });

    // Initialize Medical Record Form (Professional)
    this.medicalRecordForm = this.fb.group({
      providerName: ['', Validators.required],
      providerType: [''],
      providerNpi: [''],
      providerAddress: [''],
      providerPhone: [''],
      recordType: ['FOLLOW_UP', Validators.required],
      treatmentDate: ['', Validators.required],
      treatmentEndDate: [''],
      billedAmount: [0],
      adjustedAmount: [0],
      paidAmount: [0],
      keyFindings: [''],
      treatmentProvided: [''],
      prognosisNotes: [''],
      workRestrictions: ['']
    });
  }

  ngOnInit(): void {
    // Handle deep-link query params (e.g., ?caseId=123&tab=medical&subtab=records)
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const targetTab = params['tab'];
      const targetSubTab = params['subtab'];
      const caseId = params['caseId'];

      if (caseId && !this.linkedCase) {
        // Auto-link the case, then navigate to the target tab after data loads
        this.caseService.getCaseById(caseId).subscribe({
          next: (response) => {
            if (response?.data?.case) {
              const caseData = response.data.case as LegalCase;
              this.caseSwitch$.next();
              this.resetCaseData();
              this.linkedCase = caseData;
              this.workspaceState.setLinkedCase(Number(caseData.id));
              this.previousMode = 'dashboard';
              this.viewMode = 'workspace';
              this.loadCaseData(String(caseData.id));
              // Set target tab after case is linked
              if (targetTab) {
                this.activeTab = targetTab;
                if (targetSubTab) this.medicalSubTab = targetSubTab;
              }
              this.cdr.detectChanges();
            }
          }
        });
      } else if (targetTab) {
        this.activeTab = targetTab;
        if (targetSubTab) this.medicalSubTab = targetSubTab;
        this.cdr.detectChanges();
      }
    });

    this.loadSavedData();
    this.loadRecentActivity();
    this.loadProviders();

    // Load portfolio data on init
    this.loadPortfolioStats();
    this.loadPICases();

    // Update multiplier when injury type changes
    this.caseValueForm.get('injuryType')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(injuryType => {
        // Clear custom multiplier when injury type changes
        if (!this.caseValueForm.get('customMultiplier')?.value) {
          this.cdr.detectChanges();
        }
      });

    // Set up case search with debounce
    this.caseSearchTerm$.pipe(
      takeUntil(this.destroy$),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(term => {
        if (!term || term.length < 2) {
          this.searchResults = [];
          return of(null);
        }
        this.isSearchingCases = true;
        return this.caseService.searchCases(term, 0, 10).pipe(
          catchError(() => of(null))
        );
      })
    ).subscribe(response => {
      this.isSearchingCases = false;
      if (response?.data?.page?.content) {
        // Filter to show only PI-related cases
        this.searchResults = response.data.page.content.filter((c: LegalCase) =>
          c.type?.toLowerCase().includes('personal injury') ||
          c.type?.toLowerCase().includes('pi') ||
          c.type?.toLowerCase().includes('injury') ||
          c.type?.toLowerCase().includes('accident')
        );
      } else {
        this.searchResults = [];
      }
      this.cdr.detectChanges();
    });

    // Listen for medical scan progress + completion via WebSocket.
    // Messages arrive as {type: "data", data: {type: "MEDICAL_SCAN_*", ...}}
    // OR as {type: "notification", data: {type: "MEDICAL_SCAN_*", ...}} (legacy)
    this.webSocketService.getMessages().pipe(
      takeUntil(this.destroy$)
    ).subscribe(msg => {
      // Extract the inner payload — the actual scan data is nested under msg.data
      const payload = msg?.data;
      if (!payload) return;

      // Check if this message is a medical scan message (check both nested type and top-level)
      const scanType = payload.type || msg?.type;
      if (scanType !== 'MEDICAL_SCAN_PROGRESS' && scanType !== 'MEDICAL_SCAN_COMPLETE') return;

      // Ignore messages for a different case
      const msgCaseId = payload.caseId || msg?.caseId;
      if (msgCaseId && this.linkedCase?.id && msgCaseId !== Number(this.linkedCase.id)) return;

      if (scanType === 'MEDICAL_SCAN_PROGRESS' && this.isScanningDocuments) {
        this.scanProgress = {
          current: payload.current,
          total: payload.total,
          percentComplete: payload.percentComplete,
          currentFile: payload.currentFile
        };
        if (this.scanTaskId) {
          this.backgroundTaskService.updateTaskProgress(
            this.scanTaskId, payload.percentComplete, `Scanning: ${payload.currentFile}`
          );
        }
        this.cdr.detectChanges();
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
            confirmButtonText: 'OK'
          });
          this.cdr.detectChanges();
          return;
        }

        if (this.scanTaskId) {
          this.handleScanComplete(this.scanTaskId, payload);
        } else {
          this.completeScanCleanup();
          this.loadMedicalRecords();
          this.cdr.detectChanges();
        }
      }
    });
  }

  ngAfterViewInit(): void {
    // Chart will be created when results are available
  }

  private clearScanTimeout(): void {
    if (this.scanTimeoutId) {
      clearTimeout(this.scanTimeoutId);
      this.scanTimeoutId = null;
    }
    this.stopScanPolling();
  }

  /**
   * Poll the scan endpoint every 5s as a fallback for when WebSocket delivery fails.
   * If the backend returns 202 (new scan started) instead of 409 (already scanning),
   * it means the previous scan finished — the WebSocket message was lost.
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
      // Try to start another scan — 409 means still scanning, 202 means done
      this.medicalRecordService.scanCaseDocuments(caseId).subscribe({
        next: () => {
          // Got 202 = backend accepted a NEW scan = previous scan is done.
          // The backend is now running a fresh (redundant) scan that will complete instantly.
          // Complete the original task and reload data.
          // WebSocket payload was lost — fetch records to derive the actual count.
          if (this.isScanningDocuments) {
            // Stop polling immediately to prevent duplicate completions from concurrent ticks
            this.stopScanPolling();
            this.medicalRecordService.getRecordsByCaseId(caseId)
              .pipe(take(1))
              .subscribe({
                next: (records) => {
                  const recordsCreated = Math.max(0, records.length - this.preScanRecordCount);
                  this.handleScanComplete(taskId, { recordsCreated });
                },
                error: () => this.handleScanComplete(taskId)
              });
          }
        },
        error: (err) => {
          if (err.status === 409) {
            // Still scanning — keep polling
          } else {
            // Some other error — stop polling, let timeout handle it
            this.stopScanPolling();
          }
        }
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
   * Handle scan completion — called from both WebSocket handler and polling fallback.
   * Reloads records, syncs case data, refreshes stat cards, and shows user feedback.
   */
  private handleScanComplete(taskId: string, payload?: any): void {
    this.completeScanCleanup();

    const recordsCreated = payload?.recordsCreated ?? 0;
    const documentsScanned = payload?.documentsScanned ?? 0;
    const caseId = Number(this.linkedCase?.id);

    // Complete the background task with descriptive result for the notification body
    this.backgroundTaskService.completeTask(taskId, {
      caseId,
      recordsCreated,
      documentsScanned,
      title: recordsCreated > 0
        ? `${recordsCreated} medical records created`
        : 'All documents already processed'
    });

    // Reload medical records
    this.loadMedicalRecords();

    // Reload the case object from backend so stat cards get fresh medicalExpensesTotal
    if (caseId) {
      this.caseService.getCaseById(String(caseId)).subscribe({
        next: (response) => {
          if (response?.data?.case) {
            this.linkedCase = response.data.case as any;
          }
          // Also sync damage elements so valuation tab is up to date
          this.syncMedicalToCase();
          this.loadDamageElements();
          this.cdr.detectChanges();
        },
        error: () => {
          this.syncMedicalToCase();
          this.cdr.detectChanges();
        }
      });

      // Mark summary as stale
      this.medicalSummary = null;
      this.summaryExists = false;
      this.adjusterAnalysis = null;
      this.hasUnscannedDocuments = false;
      this.unscannedCount = 0;
      this.loadMedicalSummary();
      this.loadSavedAdjusterAnalysis();
      this.loadScanStatus();
    }

    // Show Swal result dialog to the user (they're on the page)
    this.scanResult = payload;
    if (recordsCreated > 0) {
      const detail = documentsScanned > 0
        ? ` from ${documentsScanned} documents` : '';
      Swal.fire({
        icon: 'success',
        title: 'Scan Complete',
        html: `Created <strong>${recordsCreated}</strong> new medical records${detail}.`,
        confirmButtonText: 'OK',
        customClass: { confirmButton: 'btn btn-primary' },
        buttonsStyling: false
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
        customClass: { confirmButton: 'btn btn-primary' },
        buttonsStyling: false
      });
    }

    this.cdr.detectChanges();
  }

  private completeScanCleanup(taskId?: string): void {
    this.isScanningDocuments = false;
    this.scanProgress = null;
    this.scanTaskId = null;
    this.clearScanTimeout();
  }

  ngOnDestroy(): void {
    this.clearScanTimeout();
    this.destroy$.next();
    this.destroy$.complete();
    this.caseSwitch$.next();
    this.caseSwitch$.complete();
    if (this.damageChart) {
      this.damageChart.destroy();
    }
  }

  /**
   * Reset all case-specific data when switching between cases.
   * This prevents stale data from the previous case from persisting.
   */
  private resetCaseData(): void {
    // Clear data arrays
    this.medicalRecords = [];
    this.documentChecklist = [];
    this.groupedDocuments = [];
    this.damageElements = [];
    this.requestHistory = [];
    this.settlementHistory = [];

    // Clear calculations
    this.calculatedValue = null;
    this.damageCalculation = null;
    this.medicalSummary = null;
    this.documentCompleteness = null;

    // Clear editor states
    this.editingMedicalRecord = null;
    this.selectedChecklistItem = null;
    this.resolvedRecipient = null;
    this.selectedTemplate = null;
    this.requestTemplates = [];
    this.scanResult = null;

    // Clear UI states
    this.comparableAnalysisExpanded = false;
    this.collapsedDamageGroups = {};
    this.summaryExists = false;

    // Clear scan state
    if (this.scanTaskId) {
      this.backgroundTaskService.failTask(this.scanTaskId, 'Case changed — scan cancelled.');
    }
    this.completeScanCleanup();

    // Clear Phase 1-3 state
    this.treatmentGaps = [];
    this.adjusterAnalysis = null;
    this.adjusterExpandedItems = new Set([0, 1]);
    this.recordsViewMode = 'flat';
    this.cachedGroupedRecords = null;

    // Clear bulk selection
    this.bulkSelectMode = false;
    this.selectedForBulk.clear();
    this.showBulkWizard = false;
    this.bulkWizardItemIds = [];

    // Reset forms to defaults (not just patch)
    this.caseValueForm.reset({
      injuryType: 'soft_tissue',
      injuryDescription: '',
      medicalExpenses: 0,
      lostWages: 0,
      futureMedical: 0,
      customMultiplier: null,
      liabilityAssessment: 'CLEAR',
      comparativeNegligence: 0,
      policyLimit: null
    });

    this.demandForm.reset();
    this.settlementForm.reset();
    this.medicalRecordForm.reset({
      recordType: 'FOLLOW_UP',
      billedAmount: 0,
      adjustedAmount: 0,
      paidAmount: 0
    });

    // Reset new damage element form
    this.resetNewDamageElement();

    // Clear flags
    this.prefilledFromCase = false;
    this.runAnalysisAfterCalculation = false;

    // Reset latest case value for this session (not localStorage)
    this.latestCaseValue = 0;

    // Reset demand letter document state
    this.demandDocumentId = null;
    this.demandConversationId = null;
    this.demandDocumentContent = '';
    this.isEditingDemand = false;
    this.hasUnsavedDemandChanges = false;
    this.demandVersions = [];
    this.showDemandVersionHistory = false;
    this.generatedDemand = '';

    // Trigger change detection
    this.cdr.detectChanges();
  }

  loadSavedData(): void {
    const savedProviders = localStorage.getItem('pi_medical_providers');
    if (savedProviders) {
      this.medicalProviders = JSON.parse(savedProviders);
    }

    // Settlement history is now loaded per-case from the API via loadSettlementHistory()

    const savedCaseValue = localStorage.getItem('pi_latest_case_value');
    if (savedCaseValue) {
      this.latestCaseValue = parseFloat(savedCaseValue);
    }

    // Restore calculatedValue so LOW/LIKELY/HIGH survive navigation
    const savedCalcValue = localStorage.getItem('pi_calculated_value');
    if (savedCalcValue) {
      try {
        this.calculatedValue = JSON.parse(savedCalcValue);
      } catch (e) {
        // Ignore corrupted data
      }
    }
  }

  loadRecentActivity(): void {
    const savedActivity = localStorage.getItem('pi_recent_activity');
    if (savedActivity) {
      this.recentActivity = JSON.parse(savedActivity);
    }
  }

  saveRecentActivity(): void {
    localStorage.setItem('pi_recent_activity', JSON.stringify(this.recentActivity.slice(0, 10)));
  }

  // ==========================================
  // Portfolio Dashboard Methods
  // ==========================================

  /**
   * Load portfolio statistics for all PI cases
   */
  loadPortfolioStats(): void {
    this.isLoadingPortfolio = true;
    this.portfolioService.getPortfolioStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.portfolioStats = stats;
          this.isLoadingPortfolio = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading portfolio stats:', error);
          this.isLoadingPortfolio = false;
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Load paginated list of PI cases
   */
  loadPICases(page: number = 0): void {
    this.isLoadingPICases = true;
    this.portfolioCasesPage = page;

    const request = this.portfolioSearchTerm
      ? this.portfolioService.searchPICases(this.portfolioSearchTerm, page, 10)
      : this.portfolioStatusFilter
        ? this.portfolioService.getPICasesByStatus(this.portfolioStatusFilter, page, 10)
        : this.portfolioService.getPICases(page, 10);

    request.pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.piCaseList = response.content;
          this.portfolioCasesTotalPages = response.totalPages;
          this.portfolioCasesTotal = response.totalElements;
          this.isLoadingPICases = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading PI cases:', error);
          this.isLoadingPICases = false;
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Search PI cases in portfolio view
   */
  onPortfolioSearch(event: Event): void {
    const term = (event.target as HTMLInputElement).value;
    this.portfolioSearchTerm = term;
    this.portfolioStatusFilter = '';
    this.loadPICases(0);
  }

  /**
   * Filter PI cases by status
   */
  onPortfolioStatusFilter(status: string): void {
    this.portfolioStatusFilter = status;
    this.portfolioSearchTerm = '';
    this.loadPICases(0);
  }

  /**
   * Clear portfolio filters
   */
  clearPortfolioFilters(): void {
    this.portfolioSearchTerm = '';
    this.portfolioStatusFilter = '';
    this.loadPICases(0);
  }

  /**
   * Select a case from the portfolio list to open in workspace
   */
  selectCaseForWorkspace(caseItem: LegalCase): void {
    // Cancel any pending case-specific subscriptions
    this.caseSwitch$.next();

    // Reset all case data before loading new case
    this.resetCaseData();

    this.linkedCase = caseItem;
    this.workspaceState.setLinkedCase(Number(caseItem.id));

    // Switch to workspace mode and track previous mode
    this.previousMode = 'dashboard';
    this.viewMode = 'workspace';
    this.activeTab = 'overview';

    // Load full case details and all case-specific data
    this.loadCaseData(String(caseItem.id));

    this.cdr.detectChanges();

    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Return to dashboard view from workspace
   */
  backToDashboard(): void {
    this.viewMode = 'dashboard';
    this.linkedCase = null;
    this.resetCaseData();

    // Refresh dashboard data
    this.loadPortfolioStats();
    this.loadPICases(0);

    this.cdr.detectChanges();

    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Navigate to provider directory mode
   */
  openProviderDirectory(): void {
    // Track where we came from so we can navigate back
    if (this.viewMode === 'dashboard' || this.viewMode === 'workspace') {
      this.previousMode = this.viewMode;
    }
    this.viewMode = 'directory';
    this.cdr.detectChanges();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Return from provider directory to previous mode
   */
  backFromDirectory(): void {
    this.viewMode = this.previousMode;
    this.cdr.detectChanges();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Get status badge class for case list
   */
  getStatusBadgeClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'ACTIVE': 'bg-success-subtle text-success',
      'OPEN': 'bg-info-subtle text-info',
      'IN_PROGRESS': 'bg-primary-subtle text-primary',
      'PENDING': 'bg-warning-subtle text-warning',
      'CLOSED': 'bg-secondary-subtle text-secondary',
      'ARCHIVED': 'bg-dark-subtle text-dark'
    };
    return statusClasses[status] || 'bg-secondary-subtle text-secondary';
  }

  /**
   * Get estimated case value for the all-cases table.
   * Priority: DB-persisted damage calculation midValue > settlement demand.
   */
  getCaseValueDisplay(caseItem: LegalCase): number {
    // estimatedCaseValue = midValue from PIDamageCalculation, set by backend
    if (caseItem.estimatedCaseValue && caseItem.estimatedCaseValue > 0) {
      return caseItem.estimatedCaseValue;
    }
    if (caseItem.settlementDemandAmount && caseItem.settlementDemandAmount > 0) {
      return caseItem.settlementDemandAmount;
    }
    return 0;
  }

  /**
   * Get completeness class based on score percentage
   */
  getCompletenessClass(score: number): string {
    if (score >= 80) {
      return 'high';
    } else if (score >= 50) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  // Expose Math for template
  Math = Math;

  /**
   * Get client initials for avatar
   */
  getClientInitials(clientName: string): string {
    if (!clientName) return '?';
    const parts = clientName.trim().split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return clientName.substring(0, 2).toUpperCase();
  }

  /**
   * Get the opposing party name (insurance company, defendant, or extracted from title)
   */
  getOpposingPartyName(caseItem: LegalCase): string {
    // 1. Try insurance company first (most common for PI cases)
    if (caseItem.insuranceCompany && caseItem.insuranceCompany.trim()) {
      return caseItem.insuranceCompany.trim();
    }

    // 2. Try defendant name
    if (caseItem.defendantName && caseItem.defendantName.trim()) {
      return caseItem.defendantName.trim();
    }

    // 3. Try to extract from title (format: "Client v. Defendant" or "Client vs. Defendant")
    if (caseItem.title) {
      const title = caseItem.title.trim();
      // Match both " v. " and " vs. " patterns (case insensitive)
      const vsMatch = title.match(/\s+v\.?\s+/i);
      if (vsMatch) {
        const parts = title.split(vsMatch[0]);
        if (parts.length >= 2 && parts[1].trim()) {
          return parts[1].trim();
        }
      }
    }

    // 4. Fallback: return the full title if nothing else works
    return caseItem.title || 'Unknown';
  }

  /**
   * Get injury type icon
   */
  getInjuryTypeIcon(injuryType: string): string {
    const icons: { [key: string]: string } = {
      'soft_tissue': 'ri-body-scan-line',
      'fracture': 'ri-first-aid-kit-line',
      'disc_injury': 'ri-spine-line',
      'tbi': 'ri-brain-line',
      'spinal': 'ri-accessibility-line',
      'burn': 'ri-fire-line',
      'amputation': 'ri-hand-heart-line',
      'wrongful_death': 'ri-heart-pulse-line',
      'other': 'ri-stethoscope-line'
    };
    return icons[injuryType] || 'ri-stethoscope-line';
  }

  /**
   * Get injury type label
   */
  getInjuryTypeLabel(injuryType: string): string {
    const injury = this.injuryTypes.find(i => i.value === injuryType);
    if (injury) {
      // Return shortened version
      const label = injury.label.split('(')[0].trim();
      return label.length > 15 ? label.substring(0, 15) + '...' : label;
    }
    return injuryType || 'Unknown';
  }

  /**
   * Get status icon for enhanced status badge
   */
  getStatusIcon(status: string): string {
    const icons: { [key: string]: string } = {
      'ACTIVE': 'ri-pulse-line',
      'OPEN': 'ri-folder-open-line',
      'IN_PROGRESS': 'ri-loader-4-line',
      'PENDING': 'ri-time-line',
      'IN_SETTLEMENT': 'ri-scales-3-line',
      'CLOSED': 'ri-checkbox-circle-line',
      'ARCHIVED': 'ri-archive-line'
    };
    return icons[status] || 'ri-folder-line';
  }

  /**
   * Format status for display
   */
  formatStatus(status: string): string {
    const labels: { [key: string]: string } = {
      'ACTIVE': 'Active',
      'OPEN': 'Open',
      'IN_PROGRESS': 'In Progress',
      'PENDING': 'Pending',
      'IN_SETTLEMENT': 'Settlement',
      'CLOSED': 'Closed',
      'ARCHIVED': 'Archived'
    };
    return labels[status] || status;
  }

  /**
   * Calculate days since case was opened
   */
  getDaysOpen(caseItem: LegalCase): number {
    if (!caseItem.createdAt) return 0;
    const created = new Date(caseItem.createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get visible page numbers for pagination
   */
  getVisiblePages(): number[] {
    const total = this.portfolioCasesTotalPages;
    const current = this.portfolioCasesPage;
    const pages: number[] = [];

    if (total <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 0; i < total; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(0);

      if (current > 3) {
        pages.push(-1); // Ellipsis
      }

      // Show pages around current
      const start = Math.max(1, current - 1);
      const end = Math.min(total - 2, current + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }

      if (current < total - 4) {
        pages.push(-1); // Ellipsis
      }

      // Always show last page
      if (!pages.includes(total - 1)) {
        pages.push(total - 1);
      }
    }

    return pages;
  }

  /**
   * Get pipeline percentage for a given status
   */
  getPipelinePercent(status: string): number {
    if (!this.portfolioStats) return 0;
    const total = this.portfolioStats.totalCases || 1;
    switch (status) {
      case 'active':
        return Math.round((this.portfolioStats.activeCases / total) * 100);
      case 'pending':
        return Math.round((this.portfolioStats.pendingCases / total) * 100);
      case 'settlement':
        return Math.round((this.portfolioStats.casesInSettlement / total) * 100);
      case 'closed':
        return Math.round((this.portfolioStats.closedCases / total) * 100);
      default:
        return 0;
    }
  }

  /**
   * Provider Directory modal state
   */
  addActivity(toolType: string, title: string, data?: any): void {
    const activity: ActivityItem = {
      id: Date.now().toString(),
      toolType,
      title,
      timestamp: new Date(),
      data
    };
    this.recentActivity.unshift(activity);
    this.recentActivity = this.recentActivity.slice(0, 10); // Keep only last 10
    this.saveRecentActivity();
  }

  // ==========================================
  // View Navigation
  // ==========================================

  openTool(toolId: string): void {
    this.activeTab = toolId;
    this.cdr.detectChanges();

    // Create chart if opening valuation tab and there are results
    if ((toolId === 'valuation' || toolId === 'case-value') && this.calculatedValue) {
      setTimeout(() => this.createDamageChart(), 100);
    }

    // Load existing demand letter if opening documents tab with demand-letter sub-tab
    if ((toolId === 'documents' && this.documentsSubTab === 'demand-letter') && this.linkedCase?.id && !this.generatedDemand) {
      this.loadExistingDemandLetter();
    }

    // Load demand letter if directly opening demand-letter (backward compatibility)
    if (toolId === 'demand-letter' && this.linkedCase?.id && !this.generatedDemand) {
      this.loadExistingDemandLetter();
    }
  }

  /**
   * Load existing demand letter for the linked case
   */
  private loadExistingDemandLetter(): void {
    if (!this.linkedCase?.id) return;

    const userId = this.userService.getCurrentUserId();
    this.http.get<any>(`${environment.apiUrl}/api/ai/personal-injury/demand-letter/case/${this.linkedCase.id}?userId=${userId}`)
      .pipe(takeUntil(this.caseSwitch$))
      .subscribe({
        next: (response) => {
          if (response.success && response.demandLetter) {
            this.generatedDemand = response.demandLetter;
            this.demandDocumentId = response.documentId || null;
            this.demandConversationId = response.conversationId || null;
            this.demandDocumentContent = this.convertMarkdownContent(response.demandLetter);
            this.cdr.detectChanges();
          }
        },
        error: (error) => {
          // No existing demand letter or error - that's okay, user can generate a new one
        }
      });
  }

  goToOverviewTab(): void {
    this.activeTab = 'overview';
  }

  openActivityItem(activity: ActivityItem): void {
    this.openTool(activity.toolType);
    // Could also restore the activity data here if needed
  }

  openQuickCalculator(): void {
    this.activeTab = 'valuation';
  }

  toggleSection(sectionKey: string): void {
    this.collapsedSections[sectionKey] = !this.collapsedSections[sectionKey];
  }

  // ==========================================
  // Case Value Calculator Methods
  // ==========================================

  getMultiplier(): number {
    const customMultiplier = this.caseValueForm.get('customMultiplier')?.value;
    if (customMultiplier && customMultiplier > 0) {
      return customMultiplier;
    }
    const injuryType = this.caseValueForm.get('injuryType')?.value;
    const injury = this.injuryTypes.find(i => i.value === injuryType);
    return injury?.multiplier || 2.0;
  }

  getSliderFillPercent(): number {
    const multiplier = this.getMultiplier();
    const percent = ((multiplier - 1) / 4) * 100; // Maps 1-5 to 0-100%
    // Clamp to 0-100% to handle multipliers outside 1-5 range
    return Math.max(0, Math.min(100, percent));
  }

  onMultiplierSliderChange(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.caseValueForm.patchValue({ customMultiplier: value });
  }

  /**
   * Handle liability assessment change - adjust comparative negligence for consistency
   */
  onLiabilityChange(liability: string): void {
    if (liability === 'CLEAR') {
      // Clear liability means 100% defendant fault, so comparative negligence should be 0
      this.caseValueForm.patchValue({ comparativeNegligence: 0 });
    }
  }

  /**
   * Check if comparative negligence is at a level that may bar recovery
   */
  getComparativeNegligenceWarning(): string | null {
    const comparativeNegligence = this.caseValueForm.get('comparativeNegligence')?.value || 0;
    const liability = this.caseValueForm.get('liabilityAssessment')?.value;

    if (comparativeNegligence >= 100) {
      return 'At 100% comparative negligence, the client cannot recover any damages.';
    }
    if (comparativeNegligence >= 50) {
      return `At ${comparativeNegligence}% comparative negligence, recovery may be barred in modified comparative fault states (including Massachusetts).`;
    }
    if (liability === 'CLEAR' && comparativeNegligence > 0) {
      return 'Clear liability was selected but comparative negligence is greater than 0. Consider adjusting one of these values.';
    }
    return null;
  }

  getEconomicPercent(): number {
    if (!this.calculatedValue) return 0;
    const total = this.calculatedValue.economicDamages + this.calculatedValue.nonEconomicDamages;
    if (total === 0) return 0;
    return Math.round((this.calculatedValue.economicDamages / total) * 100);
  }

  getNonEconomicPercent(): number {
    if (!this.calculatedValue) return 0;
    return 100 - this.getEconomicPercent();
  }

  calculateCaseValue(): void {
    // Enhanced form validation with user feedback
    if (this.caseValueForm.invalid) {
      this.markFormGroupTouched(this.caseValueForm);

      // Build list of missing/invalid fields
      const errors: string[] = [];
      if (this.caseValueForm.get('injuryType')?.invalid) {
        errors.push('Injury Type is required');
      }
      if (this.caseValueForm.get('liabilityAssessment')?.invalid) {
        errors.push('Liability Assessment is required');
      }
      if (this.caseValueForm.get('medicalExpenses')?.invalid) {
        errors.push('Medical Expenses must be a valid amount (0 or greater)');
      }
      if (this.caseValueForm.get('lostWages')?.invalid) {
        errors.push('Lost Wages must be a valid amount (0 or greater)');
      }

      Swal.fire({
        icon: 'error',
        title: 'Missing Required Fields',
        html: errors.length > 0 ? errors.map(e => `• ${e}`).join('<br>') : 'Please fill in all required fields',
        confirmButtonText: 'OK'
      });
      return;
    }

    // Auto-sync damage values from system data before calculating
    this.autoSyncDamageValues();

    const formData = this.caseValueForm.value;
    const medicalExpenses = formData.medicalExpenses || 0;
    const lostWages = formData.lostWages || 0;
    const futureMedical = formData.futureMedical || 0;

    // Also check damage elements for economic values (in case form wasn't synced)
    const damageElementTotal = this.damageElements
      .filter(e => ['PAST_MEDICAL', 'LOST_WAGES', 'FUTURE_MEDICAL', 'EARNING_CAPACITY', 'HOUSEHOLD_SERVICES', 'MILEAGE', 'OTHER_ECONOMIC'].includes(e.elementType || ''))
      .reduce((sum, e) => sum + (e.calculatedAmount || e.baseAmount || 0), 0);

    // Validate that at least one economic damage value is entered (either in form OR in damage elements)
    if (medicalExpenses === 0 && lostWages === 0 && futureMedical === 0 && damageElementTotal === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'No Economic Damages',
        html: 'Please enter at least one economic damage value:<br><br>' +
              '• <b>Past Medical Expenses</b> - Medical bills incurred<br>' +
              '• <b>Lost Wages</b> - Income lost due to injury<br>' +
              '• <b>Future Medical</b> - Estimated future treatment costs<br><br>' +
              'Or add damage elements in the Damage Elements section.',
        confirmButtonText: 'Got it'
      });
      return;
    }

    this.isCalculating = true;

    // Properly handle policyLimit = 0 (don't treat 0 as null due to falsy evaluation)
    const policyLimitValue = formData.policyLimit !== null && formData.policyLimit !== undefined
      ? formData.policyLimit
      : null;

    // Call AI to calculate case value
    this.http.post<any>(`${environment.apiUrl}/api/ai/personal-injury/calculate-case-value`, {
      injuryType: formData.injuryType,
      injuryDescription: formData.injuryDescription,
      liabilityAssessment: formData.liabilityAssessment,
      comparativeNegligence: formData.comparativeNegligence || 0,
      medicalExpenses: formData.medicalExpenses || 0,
      lostWages: formData.lostWages || 0,
      futureMedical: formData.futureMedical || 0,
      policyLimit: policyLimitValue
    }).subscribe({
      next: (response) => {
        if (response.success && response.calculation) {
          const calc = response.calculation;

          this.calculatedValue = {
            medicalExpenses: formData.medicalExpenses || 0,
            lostWages: formData.lostWages || 0,
            futureMedical: formData.futureMedical || 0,
            economicDamages: calc.economicDamages || 0,
            multiplier: calc.recommendedMultiplier || 2,
            nonEconomicDamages: calc.nonEconomicDamages || 0,
            totalCaseValue: calc.totalCaseValue || 0,
            comparativeNegligence: formData.comparativeNegligence || 0,
            adjustedCaseValue: calc.totalCaseValue || 0,
            policyLimit: policyLimitValue,
            realisticRecovery: calc.realisticRecovery || 0,
            // AI-specific fields
            settlementRangeLow: calc.settlementRangeLow,
            settlementRangeHigh: calc.settlementRangeHigh,
            caseStrength: calc.caseStrength,
            keyFactors: calc.keyFactors,
            multiplierReasoning: calc.multiplierReasoning,
            recommendations: calc.recommendations,
            medicalToLimitRatio: calc.medicalToLimitRatio,
            isUnderinsured: calc.isUnderinsured
          };

          // Update latest case value
          this.latestCaseValue = calc.realisticRecovery || calc.totalCaseValue || 0;
          localStorage.setItem('pi_latest_case_value', this.latestCaseValue.toString());

          // Persist calculatedValue so LOW/LIKELY/HIGH survive navigation
          localStorage.setItem('pi_calculated_value', JSON.stringify(this.calculatedValue));

          // Add to activity
          this.addActivity('case-value', `${this.formatCompactCurrency(this.latestCaseValue)} Case Value (AI)`);

          // Save settlement analysis to database if we have a linked case
          if (this.linkedCase?.id) {
            this.damageCalculationService.saveSettlementAnalysis(Number(this.linkedCase.id), {
              ...calc,
              generatedAt: new Date().toISOString()
            }).subscribe({
              next: (savedCalc) => {
                // Update local damageCalculation with saved values
                if (savedCalc) {
                  this.damageCalculation = savedCalc;
                }
              },
              error: (err) => console.error('Error saving settlement analysis:', err)
            });

            // Auto-save key valuation fields to the case entity so backend calculations work
            this.caseService.patchCase(String(this.linkedCase.id), {
              painSufferingMultiplier: calc.recommendedMultiplier || this.getMultiplier(),
              medicalExpensesTotal: formData.medicalExpenses || 0,
              lostWages: formData.lostWages || 0,
              futureMedicalEstimate: formData.futureMedical || 0
            } as any).subscribe({
              next: () => {
                this.linkedCase!.painSufferingMultiplier = calc.recommendedMultiplier || this.getMultiplier();
                this.linkedCase!.medicalExpensesTotal = formData.medicalExpenses || 0;
                this.linkedCase!.lostWages = formData.lostWages || 0;
                this.linkedCase!.futureMedicalEstimate = formData.futureMedical || 0;
              },
              error: (err) => console.error('Error auto-saving valuation fields:', err)
            });
          }

          // Create chart
          setTimeout(() => this.createDamageChart(), 100);

          this.isCalculating = false;
          this.cdr.detectChanges();

          // Run comprehensive analysis if flag is set
          if (this.runAnalysisAfterCalculation && this.linkedCase) {
            this.runAnalysisAfterCalculation = false;
            this.calculateComprehensiveDamages();
          }
        } else {
          // Fallback to local calculation if AI fails
          this.calculateCaseValueLocal();
        }
      },
      error: (err) => {
        console.error('AI calculation failed, using local:', err);
        this.calculateCaseValueLocal();
      }
    });
  }

  // Fallback local calculation
  calculateCaseValueLocal(): void {
    const formData = this.caseValueForm.value;
    const medicalExpenses = formData.medicalExpenses || 0;
    const lostWages = formData.lostWages || 0;
    const futureMedical = formData.futureMedical || 0;
    const economicDamages = medicalExpenses + lostWages + futureMedical;
    const multiplier = this.getMultiplier();
    const nonEconomicDamages = economicDamages * multiplier;
    const totalCaseValue = economicDamages + nonEconomicDamages;
    const comparativeNegligence = formData.comparativeNegligence || 0;
    const adjustedCaseValue = totalCaseValue * (1 - comparativeNegligence / 100);
    // Properly handle policyLimit = 0 (don't treat 0 as null due to falsy evaluation)
    const policyLimit = formData.policyLimit !== null && formData.policyLimit !== undefined
      ? formData.policyLimit
      : null;
    // If policyLimit is set (including 0), cap the recovery at that limit
    const realisticRecovery = policyLimit !== null ? Math.min(adjustedCaseValue, policyLimit) : adjustedCaseValue;

    this.calculatedValue = {
      medicalExpenses,
      lostWages,
      futureMedical,
      economicDamages,
      multiplier,
      nonEconomicDamages,
      totalCaseValue,
      comparativeNegligence,
      adjustedCaseValue,
      policyLimit,
      realisticRecovery
    };

    this.latestCaseValue = realisticRecovery;
    localStorage.setItem('pi_latest_case_value', realisticRecovery.toString());
    localStorage.setItem('pi_calculated_value', JSON.stringify(this.calculatedValue));
    this.addActivity('case-value', `${this.formatCompactCurrency(realisticRecovery)} Case Value`);
    setTimeout(() => this.createDamageChart(), 100);
    this.isCalculating = false;
    this.cdr.detectChanges();

    // Run comprehensive analysis if flag is set
    if (this.runAnalysisAfterCalculation && this.linkedCase) {
      this.runAnalysisAfterCalculation = false;
      this.calculateComprehensiveDamages();
    }
  }

  createDamageChart(): void {
    if (!this.calculatedValue || !this.damageChartRef) return;

    // Destroy existing chart
    if (this.damageChart) {
      this.damageChart.destroy();
    }

    const ctx = this.damageChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.damageChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Economic', 'Non-Economic'],
        datasets: [{
          data: [this.calculatedValue.economicDamages, this.calculatedValue.nonEconomicDamages],
          backgroundColor: ['#405189', '#0ab39c'],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '60%',
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.raw as number;
                return ` ${context.label}: ${this.formatCurrency(value)}`;
              }
            }
          }
        }
      }
    });
  }

  requestAIAnalysis(): void {
    if (!this.calculatedValue) return;

    const formData = this.caseValueForm.value;
    this.http.post<any>(`${environment.apiUrl}/api/ai/personal-injury/analyze-case-value`, {
      ...formData,
      calculatedValue: this.calculatedValue
    }).subscribe({
      next: (response) => {
        if (response.success && response.analysis) {
          const contextInfo = {
            'Injury Type': this.injuryTypes.find(i => i.value === formData.injuryType)?.label || formData.injuryType,
            'Estimated Case Value': this.formatCurrency(this.calculatedValue!.adjustedCaseValue)
          };
          this.aiModalService.openCaseValueAnalysis(response.analysis, contextInfo);
        }
      },
      error: (err) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to get AI analysis. Please try again.',
          customClass: { confirmButton: 'btn btn-primary' }
        });
      }
    });
  }

  exportResults(): void {
    // TODO: Implement export functionality
    Swal.fire({
      icon: 'info',
      title: 'Export',
      text: 'Export functionality coming soon!',
      customClass: { confirmButton: 'btn btn-primary' }
    });
  }

  // ==========================================
  // Demand Letter Generator Methods
  // ==========================================

  calculateDemandTotal(): number {
    const medical = this.demandForm.get('medicalExpenses')?.value || 0;
    const wages = this.demandForm.get('lostWages')?.value || 0;
    const future = this.demandForm.get('futureMedical')?.value || 0;
    const multiplier = this.demandForm.get('painSufferingMultiplier')?.value || 2.5;
    const economic = medical + wages + future;
    const nonEconomic = economic * multiplier;
    return economic + nonEconomic;
  }

  getEffectiveDemandTotal(): number {
    const override = this.demandForm.get('demandTotalOverride')?.value;
    return (override !== null && override !== undefined && override !== '') ? +override : this.calculateDemandTotal();
  }

  resetDemandTotal(): void {
    this.demandForm.get('demandTotalOverride')?.setValue(null);
  }

  isDemandOverridden(): boolean {
    const override = this.demandForm.get('demandTotalOverride')?.value;
    return override !== null && override !== undefined && override !== '';
  }

  generateDemandLetter(): void {
    if (this.demandForm.invalid) {
      this.markFormGroupTouched(this.demandForm);
      return;
    }

    // Check medical records + summary prerequisites — demand letters need structured medical data
    if (this.medicalRecords.length === 0 || !this.medicalSummary) {
      const missingRecords = this.medicalRecords.length === 0;
      const missingSummary = !this.medicalSummary;
      let message = '';
      if (missingRecords && missingSummary) {
        message = 'You need to scan your medical documents and generate a medical summary before creating a demand letter.<br><br>' +
          '<strong>Step 1:</strong> Go to the <strong>Medical Records</strong> tab and click <strong>"Scan Case Documents"</strong>.<br>' +
          '<strong>Step 2:</strong> Go to the <strong>Medical Summary</strong> tab and click <strong>"Generate Summary"</strong>.';
      } else if (missingRecords) {
        message = 'You need to scan your medical documents before generating a demand letter.<br><br>Go to the <strong>Medical Records</strong> tab and click <strong>"Scan Case Documents"</strong> to extract medical data from your uploaded files.';
      } else {
        message = 'You need to generate a medical summary before creating a demand letter.<br><br>Go to the <strong>Medical Summary</strong> tab and click <strong>"Generate Summary"</strong> to create a consolidated medical narrative.';
      }
      Swal.fire({
        icon: 'warning',
        title: missingRecords ? 'Medical Records Required' : 'Medical Summary Required',
        html: message,
        confirmButtonText: missingRecords
          ? '<i class="ri-hospital-line me-1"></i> Go to Medical Records'
          : '<i class="ri-file-list-3-line me-1"></i> Go to Medical Summary',
        showCancelButton: true,
        cancelButtonText: 'Cancel',
        customClass: { confirmButton: 'btn btn-primary', cancelButton: 'btn btn-light' }
      }).then((result) => {
        if (result.isConfirmed) {
          this.activeTab = 'medical';
          this.medicalSubTab = missingRecords ? 'records' : 'summary';
          this.cdr.detectChanges();
        }
      });
      return;
    }

    this.isGeneratingDemand = true;
    const formData = this.demandForm.value;
    const totalDemand = this.getEffectiveDemandTotal();
    const userId = this.userService.getCurrentUserId();

    // Build case context for AI (if case is linked)
    const caseContext = this.linkedCase ? {
      caseNumber: this.linkedCase.caseNumber,
      clientName: this.linkedCase.clientName,
      caseType: this.linkedCase.type,
      status: this.linkedCase.status,
      description: this.linkedCase.description,
      filingDate: this.linkedCase.importantDates?.filingDate,
      courtInfo: this.linkedCase.courtInfo ?
        `${this.linkedCase.courtInfo.countyName || ''} - ${this.linkedCase.courtInfo.judgeName || ''}` : null
    } : null;

    const requestData = {
      ...formData,
      totalDemand,
      mode: 'detailed',  // Always use thorough detailed mode
      painSufferingAmount: (formData.medicalExpenses + formData.lostWages + formData.futureMedical) * formData.painSufferingMultiplier,
      caseContext,
      // Request workspace save for editing
      saveToWorkspace: true,
      caseId: this.linkedCase?.id ? Number(this.linkedCase.id) : null
    };

    this.http.post<any>(`${environment.apiUrl}/api/ai/personal-injury/generate-demand-letter?userId=${userId}`, requestData)
      .pipe(takeUntil(this.caseSwitch$))
      .subscribe({
        next: (response) => {
          if (response.success && response.demandLetter) {
            this.generatedDemand = response.demandLetter;

            // Store document ID and conversation ID for workspace integration
            // Keep isEditingDemand = false to show preview panel (not inline Quill editor)
            // User can click "Edit in AI Workspace" button to open full editor
            if (response.documentId) {
              this.demandDocumentId = response.documentId;
              this.demandConversationId = response.conversationId || null;
              this.demandDocumentContent = this.convertMarkdownContent(response.demandLetter);
              // Don't set isEditingDemand = true - show preview instead
              this.hasUnsavedDemandChanges = false;
            }

            // Add to activity
            this.addActivity('demand-letter', `${formData.clientName} v. ${formData.defendantName}`);

            // Don't open modal - show inline editor instead
          } else {
            this.generatedDemand = 'Error generating demand letter. Please try again.';
            Swal.fire({
              icon: 'error',
              title: 'Generation Failed',
              text: 'Could not generate demand letter. Please try again.',
              customClass: { confirmButton: 'btn btn-primary' }
            });
          }
          this.isGeneratingDemand = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error generating demand letter:', error);
          this.isGeneratingDemand = false;
          this.cdr.detectChanges();

          // Handle specific backend validation errors
          const errorCode = error.error?.error;
          if (errorCode === 'MEDICAL_RECORDS_REQUIRED' || errorCode === 'MEDICAL_SUMMARY_REQUIRED') {
            const isRecords = errorCode === 'MEDICAL_RECORDS_REQUIRED';
            Swal.fire({
              icon: 'warning',
              title: isRecords ? 'Medical Records Required' : 'Medical Summary Required',
              html: error.error?.message,
              confirmButtonText: isRecords
                ? '<i class="ri-hospital-line me-1"></i> Go to Medical Records'
                : '<i class="ri-file-list-3-line me-1"></i> Go to Medical Summary',
              showCancelButton: true,
              cancelButtonText: 'Cancel',
              customClass: { confirmButton: 'btn btn-primary', cancelButton: 'btn btn-light' }
            }).then((result) => {
              if (result.isConfirmed) {
                this.activeTab = 'medical';
                this.medicalSubTab = isRecords ? 'records' : 'summary';
                this.cdr.detectChanges();
              }
            });
          } else {
            this.generatedDemand = 'Error connecting to AI service. Please try again later.';
            Swal.fire({
              icon: 'error',
              title: 'Connection Error',
              text: 'Could not connect to AI service. Please try again later.',
              customClass: { confirmButton: 'btn btn-primary' }
            });
          }
        }
      });
  }

  // ==========================================
  // Demand Letter Editor Methods
  // ==========================================

  /**
   * Open the demand letter in AI Workspace for advanced editing
   */
  openInAIWorkspace(): void {
    if (!this.demandConversationId) {
      console.error('No conversation ID available');
      return;
    }
    // Navigate to AI Workspace with the conversation ID
    // Use the query params that AI Workspace expects
    this.router.navigate(['/legal/ai-assistant/legispace'], {
      queryParams: {
        openConversation: this.demandConversationId,
        taskType: 'draft',
        backendId: this.demandConversationId
      }
    });
  }

  /**
   * Called when editor content changes
   */
  onDemandContentChange(content: string): void {
    this.demandDocumentContent = content;
    this.hasUnsavedDemandChanges = true;
  }

  /**
   * Save document to backend
   */
  saveDemandDocument(): void {
    if (!this.demandDocumentId) return;

    this.isSavingDemand = true;
    const title = `Demand Letter - ${this.linkedCase?.clientName || 'Draft'}`;

    this.documentGenerationService.saveDocument(
      this.demandDocumentId,
      this.demandDocumentContent,
      title
    ).pipe(takeUntil(this.caseSwitch$))
    .subscribe({
      next: () => {
        this.hasUnsavedDemandChanges = false;
        this.isSavingDemand = false;
        this.generatedDemand = this.demandDocumentContent; // Sync
        this.loadDemandVersions();
        Swal.fire({
          icon: 'success',
          title: 'Saved',
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: 'swal-toast' }
        });
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSavingDemand = false;
        console.error('Error saving demand letter:', err);
        Swal.fire({
          icon: 'error',
          title: 'Save Failed',
          text: 'Please try again',
          customClass: { confirmButton: 'btn btn-primary' }
        });
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Transform document with AI
   */
  transformDemand(transformationType: string): void {
    if (!this.demandDocumentId) return;

    this.isTransformingDemand = true;
    const request: DocumentTransformRequest = {
      documentId: this.demandDocumentId,
      transformationType: transformationType,
      transformationScope: 'FULL_DOCUMENT',
      fullDocumentContent: this.demandDocumentContent,
      jurisdiction: 'Massachusetts',
      documentType: 'demand_letter',
      caseId: this.linkedCase?.id ? Number(this.linkedCase.id) : undefined
    };

    this.documentGenerationService.transformDocument(request)
      .pipe(takeUntil(this.caseSwitch$))
      .subscribe({
        next: (response) => {
          this.demandDocumentContent = this.convertMarkdownContent(response.transformedContent);
          this.hasUnsavedDemandChanges = true;
          this.isTransformingDemand = false;
          Swal.fire({
            icon: 'success',
            title: 'Transformation Applied',
            text: response.explanation || `${transformationType} completed`,
            timer: 2000,
            showConfirmButton: false,
            customClass: { popup: 'swal-toast' }
          });
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isTransformingDemand = false;
          console.error('Error transforming demand letter:', err);
          Swal.fire({
            icon: 'error',
            title: 'Transformation Failed',
            text: 'Could not apply transformation. Please try again.',
            customClass: { confirmButton: 'btn btn-primary' }
          });
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Export to PDF/DOCX
   */
  exportDemand(format: 'pdf' | 'docx'): void {
    if (!this.demandDocumentId) {
      // If no document ID, export raw content
      this.exportDemandContent(format);
      return;
    }

    const userId = this.userService.getCurrentUserId();
    this.documentGenerationService.exportDocument(this.demandDocumentId, format)
      .subscribe({
        next: (response) => {
          const blob = response.body;
          if (blob) {
            // Extract filename from Content-Disposition header or use default
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `Demand_Letter.${format}`;
            if (contentDisposition) {
              const matches = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
              if (matches && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
              }
            }
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            window.URL.revokeObjectURL(url);
          }
        },
        error: (err) => {
          console.error('Export failed:', err);
          Swal.fire({
            icon: 'error',
            title: 'Export Failed',
            text: 'Could not export document. Please try again.',
            customClass: { confirmButton: 'btn btn-primary' }
          });
        }
      });
  }

  /**
   * Export raw content (when document hasn't been saved to workspace)
   */
  private exportDemandContent(format: 'pdf' | 'docx'): void {
    const title = `Demand Letter - ${this.linkedCase?.clientName || 'Draft'}`;
    const content = this.demandDocumentContent || this.generatedDemand;

    const exportFn = format === 'pdf'
      ? this.documentGenerationService.exportContentToPDF(content, title, 'demand_letter')
      : this.documentGenerationService.exportContentToWord(content, title);

    exportFn.subscribe({
      next: (response) => {
        const blob = response.body;
        if (blob) {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Demand_Letter.${format}`;
          a.click();
          window.URL.revokeObjectURL(url);
        }
      },
      error: (err) => {
        console.error('Export failed:', err);
        Swal.fire({
          icon: 'error',
          title: 'Export Failed',
          text: 'Could not export document.',
          customClass: { confirmButton: 'btn btn-primary' }
        });
      }
    });
  }

  /**
   * Load version history
   */
  loadDemandVersions(): void {
    if (!this.demandDocumentId) return;

    const userId = this.userService.getCurrentUserId();
    this.documentGenerationService.getDocumentVersions(this.demandDocumentId, userId)
      .pipe(takeUntil(this.caseSwitch$))
      .subscribe({
        next: (versions) => {
          this.demandVersions = versions;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading versions:', err);
        }
      });
  }

  /**
   * Toggle version history sidebar
   */
  toggleDemandVersionHistory(): void {
    this.showDemandVersionHistory = !this.showDemandVersionHistory;
    if (this.showDemandVersionHistory) {
      this.loadDemandVersions();
    }
  }

  /**
   * Restore a previous version
   */
  restoreDemandVersion(version: DemandLetterVersion): void {
    Swal.fire({
      title: 'Restore Version?',
      text: `This will replace current content with version ${version.versionNumber}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Restore',
      cancelButtonText: 'Cancel',
      customClass: {
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-soft-secondary ms-2'
      },
      buttonsStyling: false
    }).then(result => {
      if (result.isConfirmed) {
        this.demandDocumentContent = this.convertMarkdownContent(version.content);
        this.hasUnsavedDemandChanges = true;
        this.showDemandVersionHistory = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Reset to form view (discard current edit)
   */
  resetDemandEditor(): void {
    if (this.hasUnsavedDemandChanges) {
      Swal.fire({
        title: 'Discard Changes?',
        text: 'You have unsaved changes. Are you sure you want to start over?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Discard',
        cancelButtonText: 'Keep Editing',
        customClass: {
          confirmButton: 'btn btn-danger',
          cancelButton: 'btn btn-soft-secondary ms-2'
        },
        buttonsStyling: false
      }).then(result => {
        if (result.isConfirmed) {
          this.clearDemandEditorState();
        }
      });
    } else {
      this.clearDemandEditorState();
    }
  }

  private clearDemandEditorState(): void {
    this.demandDocumentId = null;
    this.demandConversationId = null;
    this.demandDocumentContent = '';
    this.isEditingDemand = false;
    this.hasUnsavedDemandChanges = false;
    this.demandVersions = [];
    this.showDemandVersionHistory = false;
    this.generatedDemand = '';
    this.cdr.detectChanges();
  }

  exportDemandLetter(): void {
    // Legacy export - redirect to new export
    this.exportDemand('pdf');
  }

  // ==========================================
  // Medical Provider Tracker Methods
  // ==========================================

  addMedicalProvider(): void {
    if (!this.newProvider.name || this.newProvider.totalBills <= 0) {
      return;
    }

    this.medicalProviders.push({
      ...this.newProvider,
      id: Date.now().toString()
    });

    localStorage.setItem('pi_medical_providers', JSON.stringify(this.medicalProviders));

    // Add to activity
    this.addActivity('medical-tracker', `Added: ${this.newProvider.name}`);

    // Reset form
    this.newProvider = {
      id: '',
      name: '',
      specialty: '',
      treatmentDates: '',
      totalBills: 0
    };

    // Update case value form with new total
    this.updateMedicalExpensesTotal();
  }

  confirmRemoveProvider(id: string): void {
    Swal.fire({
      title: 'Remove Provider?',
      text: 'Are you sure you want to remove this medical provider?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, remove',
      cancelButtonText: 'Cancel',
      customClass: {
        confirmButton: 'btn btn-danger me-2',
        cancelButton: 'btn btn-secondary'
      },
      buttonsStyling: false
    }).then((result) => {
      if (result.isConfirmed) {
        this.removeProvider(id);
      }
    });
  }

  removeProvider(id: string): void {
    this.medicalProviders = this.medicalProviders.filter(p => p.id !== id);
    localStorage.setItem('pi_medical_providers', JSON.stringify(this.medicalProviders));
    this.updateMedicalExpensesTotal();
  }

  updateMedicalExpensesTotal(): void {
    const total = this.getTotalMedicalBills();
    this.caseValueForm.patchValue({ medicalExpenses: total });
    this.demandForm.patchValue({ medicalExpenses: total });
  }

  getTotalMedicalBills(): number {
    // Use medicalRecords (database) as primary source
    if (this.medicalRecords.length > 0) {
      return this.medicalRecords.reduce((sum, r) => sum + (r.billedAmount || 0), 0);
    }
    // Fallback to localStorage medicalProviders if no records
    return this.medicalProviders.reduce((sum, p) => sum + p.totalBills, 0);
  }

  getTotalMedicalPaid(): number {
    return this.medicalRecords.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
  }

  getTotalMedicalOutstanding(): number {
    return this.getTotalMedicalBills() - this.getTotalMedicalPaid();
  }

  // --- Lien Tracking Helpers ---

  getTotalLiens(): number {
    return this.medicalRecords
      .filter(r => r.lienAmount && r.lienAmount > 0)
      .reduce((sum, r) => sum + (r.lienAmount || 0), 0);
  }

  getUniqueLienHolders(): number {
    const holders = new Set(
      this.medicalRecords
        .filter(r => r.lienHolder && r.lienHolder.trim())
        .map(r => r.lienHolder!.trim().toLowerCase())
    );
    return holders.size;
  }

  getLienBreakdown(): Array<{ holder: string; amount: number }> {
    const map = new Map<string, number>();
    for (const r of this.medicalRecords) {
      if (r.lienHolder && r.lienHolder.trim() && r.lienAmount && r.lienAmount > 0) {
        const key = r.lienHolder.trim();
        map.set(key, (map.get(key) || 0) + r.lienAmount);
      }
    }
    return Array.from(map.entries())
      .map(([holder, amount]) => ({ holder, amount }))
      .sort((a, b) => b.amount - a.amount);
  }

  // --- Record Type Breakdown ---

  getRecordTypeBreakdown(): Array<{ type: string; label: string; count: number }> {
    const map = new Map<string, number>();
    for (const r of this.medicalRecords) {
      const type = r.recordType || 'OTHER';
      map.set(type, (map.get(type) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([type, count]) => ({
        type,
        label: this.getRecordTypeLabel(type),
        count
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Group medical records by provider name for the grouped view.
   * Cached to preserve collapse state across change detection cycles.
   */
  getGroupedRecords(): Array<{ providerName: string; providerType: string; records: PIMedicalRecord[]; totalBilled: number; dateRange: string; collapsed: boolean }> {
    if (this.cachedGroupedRecords) return this.cachedGroupedRecords;
    this.cachedGroupedRecords = this.buildGroupedRecords();
    return this.cachedGroupedRecords;
  }

  private buildGroupedRecords(): Array<{ providerName: string; providerType: string; records: PIMedicalRecord[]; totalBilled: number; dateRange: string; collapsed: boolean }> {
    const map = new Map<string, PIMedicalRecord[]>();
    for (const r of this.medicalRecords) {
      const key = r.providerName || 'Unknown Provider';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }

    return Array.from(map.entries()).map(([name, records]) => {
      const totalBilled = records.reduce((sum, r) => sum + (r.billedAmount || 0), 0);
      const dates = records.filter(r => r.treatmentDate).map(r => r.treatmentDate).sort();
      const dateRange = dates.length > 0
        ? (dates.length === 1 ? dates[0] : `${dates[0]} — ${dates[dates.length - 1]}`)
        : 'No dates';
      return {
        providerName: name,
        providerType: records[0]?.providerType || '',
        records,
        totalBilled,
        dateRange,
        collapsed: false
      };
    });
  }

  getMaxRecordTypeCount(): number {
    const breakdown = this.getRecordTypeBreakdown();
    return breakdown.length > 0 ? Math.max(...breakdown.map(b => b.count)) : 1;
  }

  getCitationCount(record: PIMedicalRecord): number {
    if (!record.citationMetadata) return 0;
    return Object.keys(record.citationMetadata).length;
  }

  getTotalLostWages(): number {
    // Only use damage elements with type LOST_WAGES
    // Do NOT fallback to case record - values should only come from explicit damage elements
    return this.damageElements
      .filter(e => e.elementType === 'LOST_WAGES')
      .reduce((sum, e) => sum + (e.calculatedAmount || e.baseAmount || 0), 0);
  }

  getTotalFutureMedical(): number {
    // Only use damage elements with type FUTURE_MEDICAL
    // Do NOT fallback to case record - values should only come from explicit damage elements
    return this.damageElements
      .filter(e => e.elementType === 'FUTURE_MEDICAL')
      .reduce((sum, e) => sum + (e.calculatedAmount || e.baseAmount || 0), 0);
  }

  autoSyncDamageValues(): void {
    // Auto-sync medical expenses from BOTH medical records AND PAST_MEDICAL damage elements
    const medicalFromRecords = this.getTotalMedicalBills();
    const medicalFromElements = this.damageElements
      .filter(e => e.elementType === 'PAST_MEDICAL')
      .reduce((sum, e) => sum + (e.calculatedAmount || e.baseAmount || 0), 0);
    // Use whichever is greater (they might have both, or just one)
    const medicalExpenses = Math.max(medicalFromRecords, medicalFromElements);

    // Get lost wages and future medical from damage elements
    const lostWages = this.getTotalLostWages();
    const futureMedical = this.getTotalFutureMedical();

    // Build patch object - include values that are > 0
    const caseValuePatch: any = {};
    const demandPatch: any = {};

    // Always update medical expenses (even if 0, to clear stale values)
    if (medicalExpenses > 0) {
      caseValuePatch.medicalExpenses = medicalExpenses;
      demandPatch.medicalExpenses = medicalExpenses;
    }

    // Only update lost wages if there's actual data
    if (lostWages > 0) {
      caseValuePatch.lostWages = lostWages;
      demandPatch.lostWages = lostWages;
    }

    // Only update future medical if there's actual data
    if (futureMedical > 0) {
      caseValuePatch.futureMedical = futureMedical;
      demandPatch.futureMedical = futureMedical;
    }

    // Update Case Value Calculator form (only if we have values to patch)
    if (Object.keys(caseValuePatch).length > 0) {
      this.caseValueForm.patchValue(caseValuePatch);
    }

    // Update Demand Letter form (only if we have values to patch)
    if (Object.keys(demandPatch).length > 0) {
      this.demandForm.patchValue(demandPatch);
    }
  }

  getUniqueProviderCount(): number {
    const uniqueProviders = new Set(this.medicalRecords.map(r => r.providerName?.toLowerCase()));
    return uniqueProviders.size;
  }

  getMedicalDateRange(): { start: Date | null; end: Date | null } {
    if (this.medicalRecords.length === 0) {
      return { start: null, end: null };
    }
    const dates = this.medicalRecords
      .map(r => r.treatmentDate ? new Date(r.treatmentDate) : null)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());

    if (dates.length === 0) {
      return { start: null, end: null };
    }
    return { start: dates[0], end: dates[dates.length - 1] };
  }

  getProviderTypeClass(providerType: string): string {
    const classMap: Record<string, string> = {
      'HOSPITAL': 'emergency',
      'EMERGENCY_ROOM': 'emergency',
      'CLINIC': 'primary-care',
      'ORTHOPEDIC': 'orthopedics',
      'NEUROLOGY': 'neurology',
      'PHYSICAL_THERAPY': 'physical-therapy',
      'CHIROPRACTIC': 'chiropractic',
      'PAIN_MANAGEMENT': 'pain-management',
      'SURGERY_CENTER': 'surgery',
      'IMAGING': 'radiology',
      'RADIOLOGY': 'radiology',
      'PRIMARY_CARE': 'primary-care',
      'MENTAL_HEALTH': 'psychology'
    };
    return classMap[providerType] || 'default';
  }

  getProviderTypeIcon(providerType: string): string {
    const icons: Record<string, string> = {
      'HOSPITAL': 'ri-hospital-line',
      'EMERGENCY_ROOM': 'ri-first-aid-kit-line',
      'CLINIC': 'ri-stethoscope-line',
      'ORTHOPEDIC': 'ri-body-scan-line',
      'NEUROLOGY': 'ri-brain-line',
      'PHYSICAL_THERAPY': 'ri-walk-line',
      'CHIROPRACTIC': 'ri-body-scan-line',
      'PAIN_MANAGEMENT': 'ri-medicine-bottle-line',
      'SURGERY_CENTER': 'ri-surgical-mask-line',
      'IMAGING': 'ri-scan-line',
      'RADIOLOGY': 'ri-scan-line',
      'PRIMARY_CARE': 'ri-stethoscope-line',
      'MENTAL_HEALTH': 'ri-mental-health-line',
      'PHARMACY': 'ri-capsule-line'
    };
    return icons[providerType] || 'ri-hospital-line';
  }

  getProviderTypeLabel(providerType: string): string {
    const type = this.providerTypes.find(t => t.value === providerType);
    return type?.label || providerType || '';
  }

  getRecordTypeLabel(recordType: string): string {
    const type = this.recordTypes.find(t => t.value === recordType);
    return type?.label || recordType || '';
  }

  openQuickAddModal(): void {
    this.editingMedicalRecord = null;
    this.medicalRecordForm.reset({
      recordType: 'FOLLOW_UP',
      billedAmount: 0,
      adjustedAmount: 0,
      paidAmount: 0
    });

    Swal.fire({
      title: 'Quick Add Medical Record',
      html: `
        <div class="text-start">
          <div class="mb-3">
            <label class="form-label">Provider Name *</label>
            <input type="text" id="swal-provider-name" class="form-control" placeholder="e.g., Boston Medical Center">
          </div>
          <div class="row mb-3">
            <div class="col-6">
              <label class="form-label">Provider Type</label>
              <select id="swal-provider-type" class="form-select">
                <option value="">Select type...</option>
                ${this.providerTypes.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
              </select>
            </div>
            <div class="col-6">
              <label class="form-label">Treatment Date *</label>
              <input type="date" id="swal-treatment-date" class="form-control">
            </div>
          </div>
          <div class="mb-3">
            <label class="form-label">Billed Amount *</label>
            <div class="input-group">
              <span class="input-group-text">$</span>
              <input type="number" id="swal-billed-amount" class="form-control" placeholder="0">
            </div>
          </div>
          <a href="javascript:void(0)" class="text-primary small" id="swal-show-more">
            <i class="ri-add-line me-1"></i>More Details
          </a>
          <div id="swal-more-fields" style="display: none;" class="mt-3">
            <div class="mb-3">
              <label class="form-label">Key Findings</label>
              <textarea id="swal-key-findings" class="form-control" rows="2" placeholder="Important clinical findings..."></textarea>
            </div>
            <div class="row mb-3">
              <div class="col-6">
                <label class="form-label">Paid Amount</label>
                <div class="input-group">
                  <span class="input-group-text">$</span>
                  <input type="number" id="swal-paid-amount" class="form-control" placeholder="0">
                </div>
              </div>
              <div class="col-6">
                <label class="form-label">Record Type</label>
                <select id="swal-record-type" class="form-select">
                  ${this.recordTypes.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="row mb-3">
              <div class="col-6">
                <label class="form-label">Lien Holder</label>
                <input type="text" id="swal-lien-holder" class="form-control" placeholder="e.g., Medicare, BCBS">
              </div>
              <div class="col-6">
                <label class="form-label">Lien Amount</label>
                <div class="input-group">
                  <span class="input-group-text">$</span>
                  <input type="number" id="swal-lien-amount" class="form-control" placeholder="0">
                </div>
              </div>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '<i class="ri-add-line me-1"></i> Add Record',
      cancelButtonText: 'Cancel',
      customClass: {
        confirmButton: 'btn btn-primary me-2',
        cancelButton: 'btn btn-secondary'
      },
      buttonsStyling: false,
      width: 500,
      didOpen: () => {
        const showMore = document.getElementById('swal-show-more');
        const moreFields = document.getElementById('swal-more-fields');
        if (showMore && moreFields) {
          showMore.onclick = () => {
            moreFields.style.display = moreFields.style.display === 'none' ? 'block' : 'none';
            showMore.innerHTML = moreFields.style.display === 'none'
              ? '<i class="ri-add-line me-1"></i>More Details'
              : '<i class="ri-subtract-line me-1"></i>Less Details';
          };
        }
      },
      preConfirm: () => {
        const providerName = (document.getElementById('swal-provider-name') as HTMLInputElement).value;
        const treatmentDate = (document.getElementById('swal-treatment-date') as HTMLInputElement).value;
        const billedAmount = parseFloat((document.getElementById('swal-billed-amount') as HTMLInputElement).value) || 0;

        if (!providerName || !treatmentDate) {
          Swal.showValidationMessage('Provider name and treatment date are required');
          return false;
        }

        return {
          providerName,
          providerType: (document.getElementById('swal-provider-type') as HTMLSelectElement).value,
          treatmentDate,
          billedAmount,
          paidAmount: parseFloat((document.getElementById('swal-paid-amount') as HTMLInputElement)?.value) || 0,
          keyFindings: (document.getElementById('swal-key-findings') as HTMLTextAreaElement)?.value || '',
          recordType: (document.getElementById('swal-record-type') as HTMLSelectElement)?.value || 'FOLLOW_UP',
          lienHolder: (document.getElementById('swal-lien-holder') as HTMLInputElement)?.value || '',
          lienAmount: parseFloat((document.getElementById('swal-lien-amount') as HTMLInputElement)?.value) || 0
        };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.saveQuickAddRecord(result.value);
      }
    });
  }

  saveQuickAddRecord(data: any): void {
    if (!this.linkedCase?.id) return;

    const recordData: PIMedicalRecord = {
      caseId: Number(this.linkedCase.id),
      providerName: data.providerName,
      providerType: data.providerType,
      treatmentDate: data.treatmentDate,
      billedAmount: data.billedAmount,
      paidAmount: data.paidAmount,
      keyFindings: data.keyFindings,
      recordType: data.recordType,
      lienHolder: data.lienHolder || undefined,
      lienAmount: data.lienAmount || undefined
    };

    this.medicalRecordService.createRecord(Number(this.linkedCase.id), recordData).subscribe({
      next: () => {
        this.loadMedicalRecords();
        this.addActivity('medical-records', `Added: ${data.providerName}`);
        Swal.fire({
          icon: 'success',
          title: 'Record Added',
          text: `${data.providerName} has been added to medical records.`,
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: (err) => {
        console.error('Error creating record:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to create medical record'
        });
      }
    });
  }

  openRecordDetailModal(record: PIMedicalRecord): void {
    const hasCitations = record.citationMetadata && Object.keys(record.citationMetadata).length > 0;
    const cm = record.citationMetadata || {};

    // Helper to generate a citation link for a field
    const citLink = (field: string): string => {
      const cite = cm[field] as any;
      if (!cite || !cite.page) return '';
      return `<a class="citation-link-inline" data-field="${field}" title="View source document at page ${cite.page}"><i class="ri-file-text-line"></i> p.${cite.page}</a>`;
    };

    Swal.fire({
      title: record.providerName,
      html: `
        <div class="text-start">
          <div class="d-flex align-items-center gap-2 mb-3">
            <span class="badge bg-primary-subtle text-primary">${this.getRecordTypeLabel(record.recordType)}</span>
            <span class="badge bg-info-subtle text-info">${this.getProviderTypeLabel(record.providerType)}</span>
            ${hasCitations ? `<span class="badge bg-success-subtle text-success"><i class="ri-link me-1"></i>${this.getCitationCount(record)} sources</span>` : ''}
          </div>

          <div class="row g-3 mb-3">
            <div class="col-6">
              <div class="text-muted small d-flex align-items-center gap-1">Treatment Date ${citLink('treatmentDate')}</div>
              <div class="fw-medium">${record.treatmentDate ? new Date(record.treatmentDate).toLocaleDateString() : 'Not specified'}</div>
            </div>
            ${record.treatmentEndDate ? `
            <div class="col-6">
              <div class="text-muted small">End Date</div>
              <div class="fw-medium">${new Date(record.treatmentEndDate).toLocaleDateString()}</div>
            </div>
            ` : ''}
          </div>

          <div class="row g-3 mb-3">
            <div class="col-4">
              <div class="text-muted small d-flex align-items-center gap-1">Billed ${citLink('billedAmount')}</div>
              <div class="fw-semibold">${this.formatCurrency(record.billedAmount || 0)}</div>
            </div>
            <div class="col-4">
              <div class="text-muted small">Adjusted</div>
              <div class="fw-medium">${this.formatCurrency(record.adjustedAmount || 0)}</div>
            </div>
            <div class="col-4">
              <div class="text-muted small">Paid</div>
              <div class="fw-medium text-success">${this.formatCurrency(record.paidAmount || 0)}</div>
            </div>
          </div>

          ${record.lienHolder ? `
          <div class="row g-3 mb-3">
            <div class="col-6">
              <div class="text-muted small">Lien Holder</div>
              <div class="fw-medium">${record.lienHolder}</div>
            </div>
            <div class="col-6">
              <div class="text-muted small">Lien Amount</div>
              <div class="fw-medium text-danger">${this.formatCurrency(record.lienAmount || 0)}</div>
            </div>
          </div>
          ` : ''}

          ${record.keyFindings ? `
          <div class="mb-3">
            <div class="text-muted small mb-1 d-flex align-items-center gap-1">Key Findings ${citLink('keyFindings')}</div>
            <div class="p-2 bg-light rounded small">${record.keyFindings}</div>
          </div>
          ` : ''}

          ${record.diagnoses && record.diagnoses.length > 0 ? `
          <div class="mb-3">
            <div class="text-muted small mb-1 d-flex align-items-center gap-1">Diagnoses ${cm['diagnoses'] ? '<a class="citation-link-inline" data-field="diagnoses"><i class="ri-file-text-line"></i></a>' : ''}</div>
            <div class="p-2 bg-light rounded small">
              ${record.diagnoses.map(d => `<div class="d-flex align-items-center gap-2 py-1"><span class="badge bg-primary-subtle text-primary" style="font-family:monospace;font-size:11px;">${d.icd_code || '—'}</span> <span>${d.description || ''}${d.primary ? ' <span class="badge bg-info-subtle text-info" style="font-size:10px;">primary</span>' : ''}</span></div>`).join('')}
            </div>
          </div>
          ` : ''}

          ${record.treatmentProvided ? `
          <div class="mb-3">
            <div class="text-muted small mb-1 d-flex align-items-center gap-1">Treatment Provided ${citLink('treatmentProvided')}</div>
            <div class="p-2 bg-light rounded small">${record.treatmentProvided}</div>
          </div>
          ` : ''}

          ${record.prognosisNotes ? `
          <div class="mb-3">
            <div class="text-muted small mb-1">Prognosis</div>
            <div class="p-2 bg-light rounded small">${record.prognosisNotes}</div>
          </div>
          ` : ''}

          ${hasCitations ? '<div class="text-muted" style="font-size:11px;border-top:1px solid #f3f6f9;padding-top:8px;"><i class="ri-information-line me-1"></i>Click any <span style="background:rgba(10,179,156,.1);color:#0ab39c;padding:1px 4px;border-radius:3px;font-size:10px;">p.X</span> link to view the source document at that page.</div>' : ''}
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '<i class="ri-edit-line me-1"></i> Edit',
      cancelButtonText: 'Close',
      customClass: {
        confirmButton: 'btn btn-primary me-2',
        cancelButton: 'btn btn-secondary'
      },
      buttonsStyling: false,
      width: 580,
      didRender: () => {
        // Attach click handlers to inline citation links
        document.querySelectorAll('.citation-link-inline').forEach((el) => {
          (el as HTMLElement).style.cssText = 'display:inline-flex;align-items:center;gap:3px;font-size:10px;background:rgba(10,179,156,.1);color:#0ab39c;padding:1px 6px;border-radius:3px;cursor:pointer;text-decoration:none;';
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            const field = (el as HTMLElement).dataset['field'];
            if (field) {
              Swal.close();
              setTimeout(() => this.openCitation(record, field), 200);
            }
          });
        });
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.editMedicalRecord(record);
        this.openEditRecordModal();
      }
    });
  }

  openEditRecordModal(): void {
    if (!this.editingMedicalRecord) return;

    Swal.fire({
      title: 'Edit Medical Record',
      html: `
        <div class="text-start">
          <div class="mb-3">
            <label class="form-label">Provider Name *</label>
            <input type="text" id="swal-edit-provider-name" class="form-control" value="${this.editingMedicalRecord.providerName || ''}">
          </div>
          <div class="row mb-3">
            <div class="col-6">
              <label class="form-label">Provider Type</label>
              <select id="swal-edit-provider-type" class="form-select">
                <option value="">Select type...</option>
                ${this.providerTypes.map(t => `<option value="${t.value}" ${t.value === this.editingMedicalRecord?.providerType ? 'selected' : ''}>${t.label}</option>`).join('')}
              </select>
            </div>
            <div class="col-6">
              <label class="form-label">Record Type</label>
              <select id="swal-edit-record-type" class="form-select">
                ${this.recordTypes.map(t => `<option value="${t.value}" ${t.value === this.editingMedicalRecord?.recordType ? 'selected' : ''}>${t.label}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="row mb-3">
            <div class="col-6">
              <label class="form-label">Treatment Date *</label>
              <input type="date" id="swal-edit-treatment-date" class="form-control" value="${this.editingMedicalRecord.treatmentDate || ''}">
            </div>
            <div class="col-6">
              <label class="form-label">End Date</label>
              <input type="date" id="swal-edit-treatment-end" class="form-control" value="${this.editingMedicalRecord.treatmentEndDate || ''}">
            </div>
          </div>
          <div class="row mb-3">
            <div class="col-4">
              <label class="form-label">Billed</label>
              <div class="input-group">
                <span class="input-group-text">$</span>
                <input type="number" id="swal-edit-billed" class="form-control" value="${this.editingMedicalRecord.billedAmount || 0}">
              </div>
            </div>
            <div class="col-4">
              <label class="form-label">Adjusted</label>
              <div class="input-group">
                <span class="input-group-text">$</span>
                <input type="number" id="swal-edit-adjusted" class="form-control" value="${this.editingMedicalRecord.adjustedAmount || 0}">
              </div>
            </div>
            <div class="col-4">
              <label class="form-label">Paid</label>
              <div class="input-group">
                <span class="input-group-text">$</span>
                <input type="number" id="swal-edit-paid" class="form-control" value="${this.editingMedicalRecord.paidAmount || 0}">
              </div>
            </div>
          </div>
          <div class="mb-3">
            <label class="form-label">Key Findings</label>
            <textarea id="swal-edit-findings" class="form-control" rows="2">${this.editingMedicalRecord.keyFindings || ''}</textarea>
          </div>
          <div class="mb-3">
            <label class="form-label">Treatment Provided</label>
            <textarea id="swal-edit-treatment" class="form-control" rows="2">${this.editingMedicalRecord.treatmentProvided || ''}</textarea>
          </div>
          <div class="mb-3">
            <label class="form-label">Prognosis Notes</label>
            <textarea id="swal-edit-prognosis" class="form-control" rows="2">${this.editingMedicalRecord.prognosisNotes || ''}</textarea>
          </div>
          <div class="row mb-3">
            <div class="col-6">
              <label class="form-label">Lien Holder</label>
              <input type="text" id="swal-edit-lien-holder" class="form-control" value="${this.editingMedicalRecord.lienHolder || ''}" placeholder="e.g., Medicare, BCBS">
            </div>
            <div class="col-6">
              <label class="form-label">Lien Amount</label>
              <div class="input-group">
                <span class="input-group-text">$</span>
                <input type="number" id="swal-edit-lien-amount" class="form-control" value="${this.editingMedicalRecord.lienAmount || 0}">
              </div>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '<i class="ri-save-line me-1"></i> Save Changes',
      cancelButtonText: 'Cancel',
      customClass: {
        confirmButton: 'btn btn-primary me-2',
        cancelButton: 'btn btn-secondary'
      },
      buttonsStyling: false,
      width: 600,
      preConfirm: () => {
        const providerName = (document.getElementById('swal-edit-provider-name') as HTMLInputElement).value;
        const treatmentDate = (document.getElementById('swal-edit-treatment-date') as HTMLInputElement).value;

        if (!providerName || !treatmentDate) {
          Swal.showValidationMessage('Provider name and treatment date are required');
          return false;
        }

        return {
          providerName,
          providerType: (document.getElementById('swal-edit-provider-type') as HTMLSelectElement).value,
          recordType: (document.getElementById('swal-edit-record-type') as HTMLSelectElement).value,
          treatmentDate,
          treatmentEndDate: (document.getElementById('swal-edit-treatment-end') as HTMLInputElement).value || null,
          billedAmount: parseFloat((document.getElementById('swal-edit-billed') as HTMLInputElement).value) || 0,
          adjustedAmount: parseFloat((document.getElementById('swal-edit-adjusted') as HTMLInputElement).value) || 0,
          paidAmount: parseFloat((document.getElementById('swal-edit-paid') as HTMLInputElement).value) || 0,
          keyFindings: (document.getElementById('swal-edit-findings') as HTMLTextAreaElement).value,
          treatmentProvided: (document.getElementById('swal-edit-treatment') as HTMLTextAreaElement).value,
          prognosisNotes: (document.getElementById('swal-edit-prognosis') as HTMLTextAreaElement).value,
          lienHolder: (document.getElementById('swal-edit-lien-holder') as HTMLInputElement)?.value || null,
          lienAmount: parseFloat((document.getElementById('swal-edit-lien-amount') as HTMLInputElement)?.value) || null
        };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value && this.editingMedicalRecord?.id) {
        this.saveEditedRecord(result.value);
      }
    });
  }

  saveEditedRecord(data: any): void {
    if (!this.linkedCase?.id || !this.editingMedicalRecord?.id) return;

    const recordData: PIMedicalRecord = {
      ...data,
      caseId: Number(this.linkedCase.id)
    };

    this.medicalRecordService.updateRecord(
      Number(this.linkedCase.id),
      this.editingMedicalRecord.id,
      recordData
    ).subscribe({
      next: () => {
        this.loadMedicalRecords();
        this.resetMedicalRecordForm();
        Swal.fire({
          icon: 'success',
          title: 'Record Updated',
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: (err) => {
        console.error('Error updating record:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to update medical record'
        });
      }
    });
  }

  syncMedicalToCalculator(): void {
    const total = this.getTotalMedicalBills();
    this.caseValueForm.patchValue({ medicalExpenses: total });
    this.demandForm.patchValue({ medicalExpenses: total });

    Swal.fire({
      icon: 'success',
      title: 'Synced',
      html: `Medical expenses of <strong>${this.formatCurrency(total)}</strong> synced to Case Value Calculator.`,
      timer: 2500,
      showConfirmButton: false
    });
  }

  /**
   * Patch the case record with the current medical total so stat cards
   * and the portfolio dashboard reflect the latest billing amounts.
   */
  private syncMedicalToCase(): void {
    if (!this.linkedCase?.id) return;
    const medicalTotal = this.getTotalMedicalBills();
    this.caseService.patchCase(String(this.linkedCase.id), {
      medicalExpensesTotal: medicalTotal
    } as any).subscribe({
      next: () => {
        if (this.linkedCase) {
          this.linkedCase.medicalExpensesTotal = medicalTotal;
        }
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to sync medical total to case:', err)
    });
  }

  getSpecialtyClass(specialty: string): string {
    const classMap: Record<string, string> = {
      'Emergency Medicine': 'emergency',
      'Orthopedics': 'orthopedics',
      'Neurology': 'neurology',
      'Physical Therapy': 'physical-therapy',
      'Chiropractic': 'chiropractic',
      'Pain Management': 'pain-management',
      'Surgery': 'surgery',
      'Radiology': 'radiology',
      'Primary Care': 'primary-care',
      'Psychology/Psychiatry': 'psychology'
    };
    return classMap[specialty] || 'default';
  }

  // ==========================================
  // Settlement Tracker Methods
  // ==========================================

  /**
   * Load settlement history from the API for the current case
   */
  loadSettlementHistory(): void {
    if (!this.linkedCase?.id) {
      this.settlementHistory = [];
      return;
    }

    this.settlementService.getEvents(Number(this.linkedCase.id))
      .pipe(takeUntil(this.caseSwitch$))
      .subscribe({
        next: (events) => {
          this.settlementHistory = events.map(e => ({
            id: e.id,
            date: e.eventDate || e.createdAt,
            demandAmount: e.demandAmount,
            offerAmount: e.offerAmount,
            offerDate: e.offerDate,
            counterAmount: e.counterAmount,
            notes: e.notes
          }));
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading settlement history:', err);
          this.settlementHistory = [];
        }
      });
  }

  addSettlementEvent(): void {
    if (this.settlementForm.invalid || !this.linkedCase?.id) {
      if (!this.linkedCase?.id) {
        Swal.fire({
          icon: 'warning',
          title: 'No Case Linked',
          text: 'Please link a case before adding settlement events.',
          customClass: { confirmButton: 'btn btn-primary' }
        });
      }
      return;
    }

    const event: PISettlementEvent = {
      demandAmount: this.settlementForm.value.demandAmount,
      offerAmount: this.settlementForm.value.offerAmount || null,
      offerDate: this.settlementForm.value.offerDate || null,
      counterAmount: this.settlementForm.value.counterAmount || null,
      notes: this.settlementForm.value.notes || null
    };

    this.settlementService.createEvent(Number(this.linkedCase.id), event)
      .pipe(takeUntil(this.caseSwitch$))
      .subscribe({
        next: (created) => {
          // Add to local history
          this.settlementHistory.push({
            id: created.id,
            date: created.eventDate || created.createdAt,
            demandAmount: created.demandAmount,
            offerAmount: created.offerAmount,
            offerDate: created.offerDate,
            counterAmount: created.counterAmount,
            notes: created.notes
          });

          // Add to activity
          this.addActivity('settlement', `${this.formatCompactCurrency(event.demandAmount)} Settlement Event`);

          // Reset form
          this.settlementForm.reset();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error creating settlement event:', err);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to save settlement event. Please try again.',
            customClass: { confirmButton: 'btn btn-primary' }
          });
        }
      });
  }

  /**
   * Delete a single settlement event
   */
  deleteSettlementEvent(eventId: number, index: number): void {
    Swal.fire({
      title: 'Delete Event?',
      text: 'Are you sure you want to delete this settlement event?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      customClass: {
        confirmButton: 'btn btn-danger me-2',
        cancelButton: 'btn btn-secondary'
      },
      buttonsStyling: false
    }).then((result) => {
      if (result.isConfirmed) {
        this.settlementService.deleteEvent(eventId)
          .pipe(takeUntil(this.caseSwitch$))
          .subscribe({
            next: () => {
              this.settlementHistory.splice(index, 1);
              this.cdr.detectChanges();
            },
            error: (err) => {
              console.error('Error deleting settlement event:', err);
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to delete settlement event. Please try again.',
                customClass: { confirmButton: 'btn btn-primary' }
              });
            }
          });
      }
    });
  }

  confirmClearHistory(): void {
    if (!this.linkedCase?.id) return;

    Swal.fire({
      title: 'Clear Settlement History?',
      text: 'Are you sure you want to clear all settlement history? This cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, clear all',
      cancelButtonText: 'Cancel',
      customClass: {
        confirmButton: 'btn btn-danger me-2',
        cancelButton: 'btn btn-secondary'
      },
      buttonsStyling: false
    }).then((result) => {
      if (result.isConfirmed) {
        this.clearSettlementHistory();
      }
    });
  }

  clearSettlementHistory(): void {
    if (!this.linkedCase?.id) {
      this.settlementHistory = [];
      return;
    }

    this.settlementService.clearAllEvents(Number(this.linkedCase.id))
      .pipe(takeUntil(this.caseSwitch$))
      .subscribe({
        next: () => {
          this.settlementHistory = [];
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error clearing settlement history:', err);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to clear settlement history. Please try again.',
            customClass: { confirmButton: 'btn btn-primary' }
          });
        }
      });
  }

  getLatestDemand(): number {
    if (this.settlementHistory.length === 0) return 0;
    const latest = this.settlementHistory[this.settlementHistory.length - 1];
    return latest.demandAmount || 0;
  }

  getLatestOffer(): number {
    if (this.settlementHistory.length === 0) return 0;
    const latest = this.settlementHistory[this.settlementHistory.length - 1];
    return latest.offerAmount || 0;
  }

  getNegotiationGap(): number {
    return this.getLatestDemand() - this.getLatestOffer();
  }

  getOfferPercent(): number {
    const demand = this.getLatestDemand();
    const offer = this.getLatestOffer();
    if (demand === 0) return 0;
    return Math.min(100, (offer / demand) * 100);
  }

  // ==========================================
  // Case Context Integration Methods
  // ==========================================

  onCaseSearchInput(event: Event): void {
    const term = (event.target as HTMLInputElement).value;
    this.caseSearchInput = term;
    this.caseSearchTerm$.next(term);
    this.showCaseDropdown = term.length >= 2;
  }

  selectCase(caseItem: LegalCase): void {
    // Cancel any pending case-specific subscriptions
    this.caseSwitch$.next();

    // Reset all case data before loading new case
    this.resetCaseData();

    this.linkedCase = caseItem;
    this.caseSearchInput = '';
    this.searchResults = [];
    this.showCaseDropdown = false;
    this.workspaceState.setLinkedCase(Number(caseItem.id));

    // Switch to workspace mode
    this.viewMode = 'workspace';
    this.activeTab = 'overview';

    // Load full case details and prefill forms
    this.loadCaseData(caseItem.id);
  }

  unlinkCase(): void {
    // Cancel any pending case-specific subscriptions
    this.caseSwitch$.next();

    // Reset case-specific data
    this.resetCaseData();

    this.linkedCase = null;
    this.prefilledFromCase = false;
    this.workspaceState.setLinkedCase(null);

    // Return to dashboard view
    this.viewMode = 'dashboard';

    // Refresh dashboard stats
    this.loadPortfolioStats();
    this.loadPICases(0);

    this.cdr.detectChanges();

    Swal.fire({
      icon: 'info',
      title: 'Returned to Dashboard',
      text: 'You can select another case from the dashboard.',
      timer: 2000,
      showConfirmButton: false,
      customClass: { popup: 'swal2-sm' }
    });
  }

  loadCaseData(caseId: string): void {
    this.caseService.getCaseById(caseId).subscribe({
      next: (response) => {
        if (response?.data?.case) {
          const caseData = response.data.case as LegalCase;
          this.linkedCase = caseData;
          this.prefillFormsFromCase(caseData);
          this.prefilledFromCase = true;
          this.cdr.detectChanges();

          // Load all professional platform data for the linked case
          this.loadMedicalRecords();
          // Treatment gaps are lazy-loaded when user clicks the Timeline tab
          this.loadDocumentChecklist();
          this.loadDamageElements(true);  // Load calculation when first linking case
          this.loadMedicalSummary();
          this.loadSavedAdjusterAnalysis();
          this.loadScanStatus();
          this.loadExistingDemandLetter(); // Load any previously generated demand letter
          this.loadSettlementHistory(); // Load settlement negotiation history

          Swal.fire({
            icon: 'success',
            title: 'Case Linked',
            html: `<strong>${caseData.caseNumber}</strong> has been linked.<br>Forms have been pre-filled with case data.`,
            timer: 3000,
            showConfirmButton: false,
            customClass: { popup: 'swal2-sm' }
          });
        }
      },
      error: (err) => {
        console.error('Error loading case data:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to load case data. Please try again.',
          customClass: { confirmButton: 'btn btn-primary' }
        });
      }
    });
  }

  /**
   * Builds a liability narrative from existing case fields for auto-populating the demand letter form.
   */
  private buildLiabilityNarrative(caseData: LegalCase): string {
    if (!caseData) return '';

    const parts: string[] = [];

    // Accident description with date and location
    if (caseData.accidentLocation && caseData.injuryDate) {
      const dateStr = this.formatReadableDate(caseData.injuryDate);
      parts.push(`On ${dateStr}, the accident occurred at ${caseData.accidentLocation}.`);
    } else if (caseData.injuryDate) {
      const dateStr = this.formatReadableDate(caseData.injuryDate);
      parts.push(`On ${dateStr}, the accident occurred.`);
    }

    // Defendant fault statement
    if (caseData.defendantName) {
      parts.push(`${caseData.defendantName} was negligent and at fault for causing this collision.`);
    }

    // Liability assessment explanation
    const assessment = caseData.liabilityAssessment || 'CLEAR';
    if (assessment === 'CLEAR') {
      parts.push('Liability is clear and undisputed.');
    } else if (assessment === 'COMPARATIVE') {
      const percent = caseData.comparativeNegligencePercent || 0;
      parts.push(`Comparative negligence may apply at ${percent}%.`);
    } else if (assessment === 'DISPUTED') {
      parts.push('Liability is disputed by the defendant.');
    }

    return parts.join(' ');
  }

  /**
   * Formats a date as a readable string (e.g., "October 14, 2025")
   */
  private formatReadableDate(date: Date | string): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  /**
   * Converts raw markdown (or HTML) content to Quill-compatible HTML.
   * Markdown headers → <h1>/<h2>/<h3>, bold → <strong>, lists → <ul>/<ol>,
   * and markdown tables → single <pre class="ql-syntax"> code blocks.
   * Quill doesn't support native tables, so code blocks give the best visual result.
   */
  /**
   * Convert markdown content for the document editor.
   * CKEditor 5 handles tables natively, so no special workarounds needed.
   * Also migrates any legacy Quill HTML if content was previously saved by Quill.
   */
  private convertMarkdownContent(content: string): string {
    if (!content) return content;
    // Pass through as-is — CKEditor handles markdown tables natively
    // The QuillHtmlMigrator will handle any legacy ql-syntax blocks if present
    return content;
  }

  prefillFormsFromCase(caseData: LegalCase): void {
    // RESET forms first to clear any stale values from previous case
    this.caseValueForm.reset({
      injuryType: 'soft_tissue',
      injuryDescription: '',
      medicalExpenses: 0,
      lostWages: 0,
      futureMedical: 0,
      customMultiplier: null,
      liabilityAssessment: 'CLEAR',
      comparativeNegligence: 0,
      policyLimit: null
    });

    // THEN patch with new case data
    // NOTE: Economic values (medicalExpenses, lostWages, futureMedical) are NOT pre-filled from case record
    // They should only come from actual data sources:
    // - Medical records (billedAmount) via autoSyncDamageValues()
    // - Damage elements via autoSyncDamageValues()
    // This prevents stale/orphan values from showing when there's no actual supporting data
    const injuryDesc = caseData.injuryDescription || caseData.description || '';
    this.caseValueForm.patchValue({
      injuryType: caseData.injuryType || 'soft_tissue',
      injuryDescription: injuryDesc,
      medicalExpenses: 0,  // Will be populated from medical records/damage elements if they exist
      lostWages: 0,  // Will be populated from damage elements if they exist
      futureMedical: 0,  // Will be populated from damage elements if they exist
      customMultiplier: caseData.painSufferingMultiplier || null,
      liabilityAssessment: caseData.liabilityAssessment || 'CLEAR',
      comparativeNegligence: caseData.comparativeNegligencePercent || 0,
      policyLimit: caseData.insurancePolicyLimit || null
    });

    // Reset and patch demand form
    // NOTE: Economic values are NOT pre-filled from case record (same reason as above)
    this.demandForm.reset();
    this.demandForm.patchValue({
      clientName: caseData.clientName || '',
      defendantName: caseData.defendantName || '',
      insuranceCompany: caseData.insuranceCompany || '',
      adjusterName: caseData.insuranceAdjusterName || '',
      accidentDate: caseData.injuryDate ? this.formatDateForInput(caseData.injuryDate) : '',
      accidentLocation: caseData.accidentLocation || '',
      injuryType: caseData.injuryType || '',
      injuryDescription: injuryDesc,  // Use same fallback as caseValueForm
      liabilityDetails: this.buildLiabilityNarrative(caseData),
      medicalExpenses: 0,  // Will be populated from medical records/damage elements if they exist
      lostWages: 0,  // Will be populated from damage elements if they exist
      futureMedical: 0,  // Will be populated from damage elements if they exist
      policyLimit: caseData.insurancePolicyLimit || null,
      painSufferingMultiplier: caseData.painSufferingMultiplier || 2.5
    });

    // Reset and patch settlement form
    this.settlementForm.reset();
    this.settlementForm.patchValue({
      demandAmount: caseData.settlementDemandAmount || 0,
      offerAmount: caseData.settlementOfferAmount || 0,
      offerDate: '',
      counterAmount: 0,
      notes: ''
    });

    // Load medical providers from case data (if JSON string)
    if (caseData.medicalProviders) {
      try {
        const providers = JSON.parse(caseData.medicalProviders);
        if (Array.isArray(providers)) {
          this.medicalProviders = providers;
          localStorage.setItem('pi_medical_providers', JSON.stringify(this.medicalProviders));
        }
      } catch (e) {
        // Could not parse medical providers from case - continue with defaults
      }
    }
  }

  formatDateForInput(date: Date | string): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  // Save methods for syncing back to case
  saveCaseValueToCase(): void {
    if (!this.linkedCase || !this.calculatedValue) return;

    const formData = this.caseValueForm.value;
    const updateData = {
      injuryType: formData.injuryType,
      injuryDescription: formData.injuryDescription,
      medicalExpensesTotal: formData.medicalExpenses,
      lostWages: formData.lostWages,
      futureMedicalEstimate: formData.futureMedical,
      painSufferingMultiplier: this.getMultiplier(),
      liabilityAssessment: formData.liabilityAssessment,
      comparativeNegligencePercent: formData.comparativeNegligence
    };

    this.caseService.patchCase(String(this.linkedCase.id), updateData as any).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Saved to Case',
          text: 'Case value data has been saved to the linked case.',
          timer: 2500,
          showConfirmButton: false
        });
      },
      error: () => {
        Swal.fire({
          icon: 'error',
          title: 'Save Failed',
          text: 'Could not save data to case. Please try again.',
          customClass: { confirmButton: 'btn btn-primary' }
        });
      }
    });
  }

  saveMedicalProvidersToCase(): void {
    if (!this.linkedCase) return;

    const medicalTotal = this.getTotalMedicalBills();
    const updateData = {
      medicalProviders: JSON.stringify(this.medicalProviders),
      medicalExpensesTotal: medicalTotal
    };

    this.caseService.patchCase(String(this.linkedCase.id), updateData as any).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Saved to Case',
          text: 'Medical providers have been saved to the linked case.',
          timer: 2500,
          showConfirmButton: false
        });
      },
      error: () => {
        Swal.fire({
          icon: 'error',
          title: 'Save Failed',
          text: 'Could not save medical providers to case. Please try again.',
          customClass: { confirmButton: 'btn btn-primary' }
        });
      }
    });
  }

  saveSettlementToCase(): void {
    if (!this.linkedCase) return;

    const formData = this.settlementForm.value;
    const updateData = {
      settlementDemandAmount: formData.demandAmount || this.getLatestDemand(),
      settlementOfferAmount: formData.offerAmount || this.getLatestOffer()
    };

    this.caseService.patchCase(String(this.linkedCase.id), updateData as any).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Saved to Case',
          text: 'Settlement data has been saved to the linked case.',
          timer: 2500,
          showConfirmButton: false
        });
      },
      error: () => {
        Swal.fire({
          icon: 'error',
          title: 'Save Failed',
          text: 'Could not save settlement data to case. Please try again.',
          customClass: { confirmButton: 'btn btn-primary' }
        });
      }
    });
  }

  saveDemandDataToCase(): void {
    if (!this.linkedCase) return;

    const formData = this.demandForm.value;
    const updateData = {
      defendantName: formData.defendantName,
      insuranceCompany: formData.insuranceCompany,
      insuranceAdjusterName: formData.adjusterName,
      insurancePolicyLimit: formData.policyLimit,
      accidentLocation: formData.accidentLocation
    };

    this.caseService.patchCase(String(this.linkedCase.id), updateData as any).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Saved to Case',
          text: 'Demand letter data has been saved to the linked case.',
          timer: 2500,
          showConfirmButton: false
        });
      },
      error: () => {
        Swal.fire({
          icon: 'error',
          title: 'Save Failed',
          text: 'Could not save demand data to case. Please try again.',
          customClass: { confirmButton: 'btn btn-primary' }
        });
      }
    });
  }

  // Get dashboard stats from linked case
  getLinkedCaseValue(): number {
    // 1. In-memory AI result from current session (freshest — just calculated)
    if (this.calculatedValue?.realisticRecovery && this.calculatedValue.realisticRecovery > 0) {
      return this.calculatedValue.realisticRecovery;
    }
    // 2. DB-persisted damage calculation midValue (the "LIKELY" value shown on Valuation tab)
    if (this.damageCalculation?.midValue && this.damageCalculation.midValue > 0) {
      return this.damageCalculation.midValue;
    }
    // 3. DB-persisted adjusted total as fallback
    if (this.damageCalculation?.adjustedDamagesTotal && this.damageCalculation.adjustedDamagesTotal > 0) {
      return this.damageCalculation.adjustedDamagesTotal;
    }
    // 4. Settlement demand amount
    if (this.linkedCase?.settlementDemandAmount && this.linkedCase.settlementDemandAmount > 0) {
      return this.linkedCase.settlementDemandAmount;
    }
    return 0;
  }

  getLinkedCaseMedicalTotal(): number {
    if (!this.linkedCase) return this.getTotalMedicalBills();
    return this.linkedCase.medicalExpensesTotal || this.getTotalMedicalBills();
  }

  getDaysSinceInjury(): number | null {
    if (!this.linkedCase?.injuryDate) return null;
    const injuryDate = new Date(this.linkedCase.injuryDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - injuryDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  closeCaseDropdown(): void {
    setTimeout(() => {
      this.showCaseDropdown = false;
    }, 200);
  }

  // ==========================================
  // PI Professional Platform Methods
  // ==========================================

  // --- Medical Records (Professional) ---

  loadMedicalRecords(): void {
    if (!this.linkedCase?.id) return;

    this.isLoadingMedicalRecords = true;
    this.medicalRecordService.getRecordsByCaseId(Number(this.linkedCase.id))
      .pipe(takeUntil(this.caseSwitch$))
      .subscribe({
        next: (records) => {
          this.medicalRecords = records;
          this.isLoadingMedicalRecords = false;
          this.cachedGroupedRecords = null; // Invalidate grouped view cache
          // Auto-sync medical expenses to form from actual records
          this.autoSyncDamageValues();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading medical records:', err);
          this.isLoadingMedicalRecords = false;
          this.cdr.detectChanges();
        }
      });
  }

  // --- Treatment Timeline ---

  loadTreatmentGaps(): void {
    if (!this.linkedCase?.id) return;
    this.isLoadingTimeline = true;
    this.medicalSummaryService.analyzeTreatmentGaps(Number(this.linkedCase.id))
      .pipe(takeUntil(this.caseSwitch$))
      .subscribe({
        next: (gaps) => {
          this.treatmentGaps = gaps || [];
          this.isLoadingTimeline = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.treatmentGaps = [];
          this.isLoadingTimeline = false;
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Merge medical records and treatment gaps into a single chronological list.
   * Each item has a type ('record' | 'gap') for template rendering.
   */
  getTimelineItems(): Array<{ type: 'record' | 'gap'; data: any }> {
    const items: Array<{ type: 'record' | 'gap'; data: any; sortDate: string }> = [];

    for (const record of this.medicalRecords) {
      items.push({ type: 'record', data: record, sortDate: record.treatmentDate || '9999-12-31' });
    }
    for (const gap of this.treatmentGaps) {
      // Place gap after the last event before the gap (use gapStart + 0.5 day trick)
      items.push({ type: 'gap', data: gap, sortDate: gap.gapStart + 'T12:00:00' });
    }

    items.sort((a, b) => a.sortDate.localeCompare(b.sortDate));
    return items.map(({ type, data }) => ({ type, data }));
  }

  /**
   * Group timeline items by date for rendering date headers.
   */
  getTimelineDateGroups(): Array<{ date: string; items: Array<{ type: 'record' | 'gap'; data: any }> }> {
    const timelineItems = this.getTimelineItems();
    const groups: Array<{ date: string; items: Array<{ type: 'record' | 'gap'; data: any }> }> = [];
    let currentDate = '';

    for (const item of timelineItems) {
      const itemDate = item.type === 'record' ? item.data.treatmentDate : item.data.gapStart;
      if (!itemDate) continue;
      const dateKey = itemDate.substring(0, 10); // YYYY-MM-DD

      if (item.type === 'gap') {
        // Gaps always get their own entry (not grouped with records)
        groups.push({ date: '__gap__', items: [item] });
        currentDate = '';
      } else if (dateKey !== currentDate) {
        currentDate = dateKey;
        groups.push({ date: dateKey, items: [item] });
      } else {
        groups[groups.length - 1].items.push(item);
      }
    }
    return groups;
  }

  /**
   * Get the timeline bar segments for the horizontal overview.
   * Returns active treatment clusters and gap segments.
   */
  /**
   * Build segments for the horizontal timeline bar using flex-grow proportions.
   * Active treatment clusters and gap periods alternate to fill the full width.
   * widthPct is used as flex-grow (proportional to days in each segment).
   */
  getTimelineBarSegments(): Array<{ type: 'active' | 'gap'; startPct: number; widthPct: number; label: string }> {
    if (this.medicalRecords.length === 0) return [];

    const dates = this.medicalRecords
      .filter(r => r.treatmentDate)
      .map(r => new Date(r.treatmentDate).getTime())
      .sort((a, b) => a - b);

    if (dates.length === 0) return [];

    // Group dates into clusters (within 7 days = same treatment period)
    const clusters: Array<{ start: number; end: number }> = [];
    let clusterStart = dates[0];
    let clusterEnd = dates[0];

    for (let i = 1; i < dates.length; i++) {
      if (dates[i] - clusterEnd <= 7 * 86400000) {
        clusterEnd = dates[i];
      } else {
        clusters.push({ start: clusterStart, end: clusterEnd });
        clusterStart = dates[i];
        clusterEnd = dates[i];
      }
    }
    clusters.push({ start: clusterStart, end: clusterEnd });

    const segments: Array<{ type: 'active' | 'gap'; startPct: number; widthPct: number; label: string }> = [];
    const DAY_MS = 86400000;

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      // Active segment — minimum 5 days of visual weight so it's visible
      const clusterDays = Math.max(Math.round((cluster.end - cluster.start) / DAY_MS) + 1, 5);
      const dateLabel = new Date(cluster.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      segments.push({
        type: 'active',
        startPct: 0, // not used with flexbox, kept for interface compat
        widthPct: clusterDays, // flex-grow value
        label: dateLabel
      });

      // Gap between this cluster and next
      if (i < clusters.length - 1) {
        const nextCluster = clusters[i + 1];
        const gapDays = Math.round((nextCluster.start - cluster.end) / DAY_MS);
        if (gapDays > 0) {
          segments.push({
            type: 'gap',
            startPct: 0,
            widthPct: gapDays, // flex-grow value — proportional to actual gap size
            label: `${gapDays}-day gap`
          });
        }
      }
    }

    return segments;
  }

  getTimelineDateRange(): { start: string; end: string; days: number } {
    const dates = this.medicalRecords
      .filter(r => r.treatmentDate)
      .map(r => r.treatmentDate)
      .sort();
    if (dates.length === 0) return { start: '', end: '', days: 0 };
    const start = dates[0];
    const end = dates[dates.length - 1];
    const days = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
    return { start, end, days };
  }

  scanCaseDocuments(): void {
    if (!this.linkedCase?.id) return;

    // Reset stuck state from previous failed scan (safety guard)
    if (this.isScanningDocuments && this.scanTaskId) {
      this.backgroundTaskService.failTask(this.scanTaskId, 'Previous scan did not complete. Starting new scan.');
      this.scanTaskId = null;
    }

    this.isScanningDocuments = true;
    this.scanResult = null;
    this.scanProgress = null;
    this.preScanRecordCount = this.medicalRecords.length;

    // Register as a background task (like document drafting)
    const taskId = this.backgroundTaskService.registerTask(
      'medical_scan',
      'Scanning Medical Documents',
      'Starting document scan...',
      { documentId: Number(this.linkedCase.id) }
    );
    this.scanTaskId = taskId;
    this.backgroundTaskService.startTask(taskId);

    // Safety timeout — reset state if no completion message arrives within 5 minutes
    this.clearScanTimeout();
    this.scanTimeoutId = setTimeout(() => {
      if (this.isScanningDocuments) {
        this.completeScanCleanup(taskId);
        this.backgroundTaskService.failTask(taskId, 'Scan timed out — no response from server.');
      }
    }, 5 * 60 * 1000);

    const caseId = Number(this.linkedCase.id);

    // Backend returns 202 immediately and processes async — result arrives via WebSocket
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
          showClass: { popup: 'animate__animated animate__fadeInRight animate__faster' },
          hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' }
        });

        // Polling fallback: WebSocket delivery can fail silently.
        // Poll every 5s — if backend no longer has an active scan for this case,
        // it means the scan completed and the WebSocket message was lost.
        this.startScanPolling(caseId, taskId);
      },
      error: (err) => {
        console.error('Error starting document scan:', err);
        this.isScanningDocuments = false;
        this.scanProgress = null;
        this.clearScanTimeout();
        this.backgroundTaskService.failTask(taskId, err.error?.message || 'Failed to start scan.');
        this.scanTaskId = null;
        this.cdr.detectChanges();

        const isAlreadyScanning = err.status === 409;
        Swal.fire({
          icon: isAlreadyScanning ? 'info' : 'error',
          title: isAlreadyScanning ? 'Scan In Progress' : 'Scan Failed',
          text: err.error?.message || 'Failed to start document scan. Please try again.',
          confirmButtonText: 'OK'
        });
      }
    });
  }

  saveMedicalRecord(): void {
    if (!this.linkedCase?.id || this.medicalRecordForm.invalid) {
      this.markFormGroupTouched(this.medicalRecordForm);
      return;
    }

    const recordData: PIMedicalRecord = {
      ...this.medicalRecordForm.value,
      caseId: Number(this.linkedCase.id)
    };

    if (this.editingMedicalRecord?.id) {
      // Update existing
      this.medicalRecordService.updateRecord(
        Number(this.linkedCase.id),
        this.editingMedicalRecord.id,
        recordData
      ).subscribe({
        next: () => {
          this.loadMedicalRecords();
          this.resetMedicalRecordForm();
          Swal.fire({
            icon: 'success',
            title: 'Record Updated',
            timer: 2000,
            showConfirmButton: false
          });
        },
        error: (err) => {
          console.error('Error updating record:', err);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to update medical record'
          });
        }
      });
    } else {
      // Create new
      this.medicalRecordService.createRecord(Number(this.linkedCase.id), recordData).subscribe({
        next: () => {
          this.loadMedicalRecords();
          this.resetMedicalRecordForm();
          Swal.fire({
            icon: 'success',
            title: 'Record Added',
            timer: 2000,
            showConfirmButton: false
          });
        },
        error: (err) => {
          console.error('Error creating record:', err);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to create medical record'
          });
        }
      });
    }
  }

  editMedicalRecord(record: PIMedicalRecord): void {
    this.editingMedicalRecord = record;
    this.medicalRecordForm.patchValue({
      providerName: record.providerName,
      providerType: record.providerType,
      providerNpi: record.providerNpi,
      providerAddress: record.providerAddress,
      providerPhone: record.providerPhone,
      recordType: record.recordType,
      treatmentDate: record.treatmentDate,
      treatmentEndDate: record.treatmentEndDate,
      billedAmount: record.billedAmount,
      adjustedAmount: record.adjustedAmount,
      paidAmount: record.paidAmount,
      keyFindings: record.keyFindings,
      treatmentProvided: record.treatmentProvided,
      prognosisNotes: record.prognosisNotes,
      workRestrictions: record.workRestrictions
    });
  }

  deleteMedicalRecord(record: PIMedicalRecord): void {
    if (!this.linkedCase?.id || !record.id) return;

    Swal.fire({
      title: 'Delete Record?',
      text: `Are you sure you want to delete the record for ${record.providerName}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      customClass: {
        confirmButton: 'btn btn-danger me-2',
        cancelButton: 'btn btn-secondary'
      },
      buttonsStyling: false
    }).then((result) => {
      if (result.isConfirmed) {
        this.medicalRecordService.deleteRecord(Number(this.linkedCase!.id), record.id!).subscribe({
          next: () => {
            this.loadMedicalRecords();
            Swal.fire({
              icon: 'success',
              title: 'Deleted',
              timer: 2000,
              showConfirmButton: false
            });
          },
          error: (err) => {
            console.error('Error deleting record:', err);
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Failed to delete medical record'
            });
          }
        });
      }
    });
  }

  clearAllMedicalRecords(): void {
    if (!this.linkedCase?.id || !this.medicalRecords?.length) return;

    Swal.fire({
      title: 'Clear All Records?',
      text: 'This will permanently delete all medical records for this case. You can re-scan documents afterwards to repopulate them.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, clear all',
      cancelButtonText: 'Cancel',
      customClass: {
        confirmButton: 'btn btn-danger me-2',
        cancelButton: 'btn btn-secondary'
      },
      buttonsStyling: false
    }).then((result) => {
      if (result.isConfirmed) {
        this.medicalRecordService.deleteAllRecords(Number(this.linkedCase!.id)).subscribe({
          next: () => {
            // Clear stale case value state so dashboard shows $0 immediately
            this.latestCaseValue = 0;
            this.calculatedValue = null;
            this.damageCalculation = null;
            localStorage.removeItem('pi_latest_case_value');
            localStorage.removeItem('pi_calculated_value');
            // Sync medical expenses to valuation tab — triggers deletion of stale
            // PAST_MEDICAL damage element (backend returns null when totalBilled = $0)
            this.damageCalculationService.syncMedicalExpenses(Number(this.linkedCase!.id)).subscribe({
              next: () => this.loadDamageElements(),
              error: () => this.loadDamageElements()
            });
            // Reload case to pick up the zeroed medicalExpensesTotal from backend,
            // then show confirmation toast only after the UI state is updated
            const showClearedToast = () => Swal.fire({
              icon: 'success',
              title: 'Cleared',
              text: 'All medical records deleted. You can now re-scan documents.',
              timer: 3000,
              showConfirmButton: false
            });
            this.caseService.getCaseById(String(this.linkedCase!.id)).subscribe({
              next: (response) => {
                if (response?.data?.case) {
                  this.linkedCase = response.data.case as any;
                }
                this.loadMedicalRecords();
                this.cdr.detectChanges();
                showClearedToast();
              },
              error: () => {
                this.loadMedicalRecords();
                showClearedToast();
              }
            });
          },
          error: (err) => {
            console.error('Error clearing records:', err);
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Failed to delete medical records'
            });
          }
        });
      }
    });
  }

  resetMedicalRecordForm(): void {
    this.editingMedicalRecord = null;
    this.medicalRecordForm.reset({
      recordType: 'FOLLOW_UP',
      billedAmount: 0,
      adjustedAmount: 0,
      paidAmount: 0
    });
  }

  // --- Medical Summary ---

  loadMedicalSummary(): void {
    if (!this.linkedCase?.id) return;

    this.isLoadingMedicalSummary = true;
    this.medicalSummaryService.getMedicalSummary(Number(this.linkedCase.id))
      .pipe(takeUntil(this.caseSwitch$))
      .subscribe({
        next: (result) => {
          this.medicalSummary = result.summary;
          this.summaryExists = result.exists;
          this.isLoadingMedicalSummary = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading medical summary:', err);
          this.isLoadingMedicalSummary = false;
          this.cdr.detectChanges();
        }
      });
  }

  generateMedicalSummary(): void {
    if (!this.linkedCase?.id) return;

    if (this.isScanningDocuments) {
      Swal.fire({
        icon: 'info',
        title: 'Scan In Progress',
        text: 'Please wait for the document scan to finish before generating a summary. The summary needs all records to be accurate.',
        confirmButtonText: 'OK'
      });
      return;
    }

    this.isGeneratingSummary = true;
    this.cdr.detectChanges();

    Swal.fire({
      title: 'Generating Medical Summary',
      html: 'AI is analyzing your medical records...<br><small>This may take a minute.</small>',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.medicalSummaryService.generateMedicalSummary(Number(this.linkedCase.id)).subscribe({
      next: (summary) => {
        this.medicalSummary = summary;
        this.summaryExists = true;
        this.isGeneratingSummary = false;
        this.cdr.detectChanges();
        Swal.fire({
          icon: 'success',
          title: 'Summary Generated',
          html: `
            <div class="text-start">
              <p><strong>Completeness Score:</strong> ${summary.completenessScore}%</p>
              <p><strong>Providers:</strong> ${summary.providerSummary?.length || 0}</p>
              <p><strong>Diagnoses:</strong> ${summary.diagnosisList?.length || 0}</p>
              ${summary.redFlags?.length > 0 ? `<p class="text-danger"><strong>Red Flags:</strong> ${summary.redFlags.length}</p>` : ''}
            </div>
          `,
          confirmButtonText: 'View Summary'
        });
      },
      error: (err) => {
        console.error('Error generating summary:', err);
        this.isGeneratingSummary = false;
        this.cdr.detectChanges();
        Swal.fire({
          icon: 'error',
          title: 'Generation Failed',
          text: err.error?.message || 'Failed to generate medical summary. Make sure you have medical records entered.'
        });
      }
    });
  }

  // --- Adjuster Defense Analysis ---

  loadSavedAdjusterAnalysis(): void {
    if (!this.linkedCase?.id) return;
    this.medicalSummaryService.getSavedAdjusterAnalysis(Number(this.linkedCase.id)).subscribe({
      next: (result: any) => {
        if (result?.data?.exists && result.data.analysis) {
          this.adjusterAnalysis = result.data.analysis;
          this.adjusterExpandedItems = new Set([0, 1]);
        }
        this.cdr.detectChanges();
      },
      error: () => {} // Silently fail — user can regenerate
    });
  }

  loadScanStatus(): void {
    if (!this.linkedCase?.id) return;
    this.medicalSummaryService.getScanStatus(Number(this.linkedCase.id)).subscribe({
      next: (result: any) => {
        console.log('Scan status response:', result);
        this.scanStatus = result?.data?.scanStatus;
        this.hasUnscannedDocuments = this.scanStatus?.hasUnscannedDocuments || false;
        this.unscannedCount = this.scanStatus?.unscannedDocuments || 0;
        console.log('hasUnscannedDocuments:', this.hasUnscannedDocuments, 'unscanned:', this.unscannedCount);
        this.cdr.detectChanges();
      },
      error: (err: any) => { console.error('Scan status error:', err); }
    });
  }

  generateAdjusterAnalysis(): void {
    if (!this.linkedCase?.id) return;

    if (this.isScanningDocuments) {
      Swal.fire({
        icon: 'info',
        title: 'Scan In Progress',
        text: 'Please wait for the document scan to finish before generating an analysis. The analysis needs all records to be accurate.',
        confirmButtonText: 'OK'
      });
      return;
    }

    this.isGeneratingAdjusterAnalysis = true;
    this.cdr.detectChanges();

    Swal.fire({
      title: 'Analyzing Case Vulnerabilities',
      html: 'AI is predicting adjuster attack strategies...<br><small>This may take a minute.</small>',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });

    this.medicalSummaryService.generateAdjusterAnalysis(Number(this.linkedCase.id)).subscribe({
      next: (analysis) => {
        this.adjusterAnalysis = analysis;
        this.isGeneratingAdjusterAnalysis = false;
        this.adjusterExpandedItems = new Set([0, 1]); // Expand first two by default
        this.cdr.detectChanges();
        Swal.close();
      },
      error: (err) => {
        console.error('Error generating adjuster analysis:', err);
        this.isGeneratingAdjusterAnalysis = false;
        this.cdr.detectChanges();
        Swal.fire({
          icon: 'error',
          title: 'Analysis Failed',
          text: err.error?.message || 'Failed to generate adjuster defense analysis.'
        });
      }
    });
  }

  toggleAdjusterItem(index: number): void {
    if (this.adjusterExpandedItems.has(index)) {
      this.adjusterExpandedItems.delete(index);
    } else {
      this.adjusterExpandedItems.add(index);
    }
  }

  getAdjusterSeverityClass(severity: string): string {
    switch (severity?.toUpperCase()) {
      case 'HIGH': return 'bg-danger-subtle text-danger';
      case 'MEDIUM': return 'bg-warning-subtle text-warning';
      case 'LOW': return 'bg-info-subtle text-info';
      default: return 'bg-secondary-subtle text-secondary';
    }
  }

  getAdjusterTypeIcon(type: string): string {
    switch (type) {
      case 'TREATMENT_GAP': return 'ri-timer-flash-line';
      case 'PRE_EXISTING': return 'ri-heart-pulse-line';
      case 'EXCESSIVE_TREATMENT': return 'ri-scales-3-line';
      case 'CAUSATION': return 'ri-link-unlink-m';
      case 'MISSING_DOCUMENTATION': return 'ri-file-unknow-line';
      case 'BILLING_CONCERNS': return 'ri-money-dollar-circle-line';
      default: return 'ri-error-warning-line';
    }
  }

  // --- Document Checklist ---

  loadDocumentChecklist(): void {
    if (!this.linkedCase?.id) return;

    this.isLoadingChecklist = true;
    this.documentChecklistService.getChecklistByCaseId(Number(this.linkedCase.id))
      .pipe(takeUntil(this.caseSwitch$))
      .subscribe({
        next: (checklist) => {
          // Sort by ID to maintain stable order
          this.documentChecklist = checklist.sort((a, b) => (a.id || 0) - (b.id || 0));
          this.updateGroupedDocuments();
          this.isLoadingChecklist = false;
          this.loadDocumentCompleteness();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading checklist:', err);
          this.isLoadingChecklist = false;
          this.cdr.detectChanges();
        }
      });
  }

  initializeDocumentChecklist(): void {
    if (!this.linkedCase?.id) return;

    this.isLoadingChecklist = true;
    this.documentChecklistService.initializeDefaultChecklist(Number(this.linkedCase.id)).subscribe({
      next: (checklist) => {
        this.documentChecklist = checklist.sort((a, b) => (a.id || 0) - (b.id || 0));
        this.updateGroupedDocuments();
        this.isLoadingChecklist = false;
        this.loadDocumentCompleteness();
        this.cdr.detectChanges();
        Swal.fire({
          icon: 'success',
          title: 'Checklist Initialized',
          text: `${checklist.length} document items created`,
          timer: 2500,
          showConfirmButton: false
        });
      },
      error: (err) => {
        console.error('Error initializing checklist:', err);
        this.isLoadingChecklist = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Initialize checklist - wrapper method for template binding
   */
  initializeChecklist(): void {
    this.initializeDocumentChecklist();
  }

  resetDocumentChecklist(): void {
    if (!this.linkedCase?.id) return;

    Swal.fire({
      title: 'Reset Checklist?',
      text: 'This will delete all checklist items and their status, then create a fresh default checklist. This cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f06548',
      cancelButtonColor: '#878a99',
      confirmButtonText: 'Yes, Reset',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isLoadingChecklist = true;
        this.documentChecklistService.resetChecklist(Number(this.linkedCase.id)).subscribe({
          next: (checklist) => {
            this.documentChecklist = checklist.sort((a, b) => (a.id || 0) - (b.id || 0));
            this.updateGroupedDocuments();
            this.isLoadingChecklist = false;
            this.loadDocumentCompleteness();
            this.cdr.detectChanges();
            Swal.fire({
              icon: 'success',
              title: 'Checklist Reset',
              text: `${checklist.length} document items created`,
              timer: 2500,
              showConfirmButton: false
            });
          },
          error: (err) => {
            console.error('Error resetting checklist:', err);
            this.isLoadingChecklist = false;
            this.cdr.detectChanges();
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Failed to reset checklist'
            });
          }
        });
      }
    });
  }

  loadDocumentCompleteness(): void {
    if (!this.linkedCase?.id) return;

    this.documentChecklistService.getCompletenessScore(Number(this.linkedCase.id))
      .pipe(takeUntil(this.caseSwitch$))
      .subscribe({
        next: (completeness) => {
          this.documentCompleteness = completeness;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading completeness:', err);
        }
      });
  }

  markDocumentReceived(item: PIDocumentChecklist): void {
    if (!this.linkedCase?.id || !item.id) return;

    this.documentChecklistService.markAsReceived(Number(this.linkedCase.id), item.id).subscribe({
      next: () => {
        // Reload everything fresh from server
        this.loadDocumentChecklist();
        Swal.fire({
          icon: 'success',
          title: 'Document Received',
          timer: 1500,
          showConfirmButton: false
        });
      },
      error: (err) => {
        console.error('Error marking received:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to mark document as received'
        });
      }
    });
  }

  /**
   * Change the status of a document checklist item
   */
  changeDocumentStatus(item: PIDocumentChecklist, newStatus: string): void {
    if (!this.linkedCase?.id || !item.id) return;

    // Skip if same status
    if (item.status === newStatus) return;

    const isNowReceived = newStatus === 'RECEIVED';

    const updatedItem: PIDocumentChecklist = {
      ...item,
      status: newStatus,
      received: isNowReceived,
      receivedDate: isNowReceived ? new Date().toISOString().split('T')[0] : item.receivedDate
    };

    this.documentChecklistService.updateChecklistItem(
      Number(this.linkedCase.id),
      item.id,
      updatedItem
    ).subscribe({
      next: () => {
        // Reload everything fresh from server
        this.loadDocumentChecklist();
        const statusLabel = this.getStatusLabel(newStatus);
        Swal.fire({
          icon: 'success',
          title: 'Status Updated',
          text: `Document status changed to ${statusLabel}`,
          timer: 1500,
          showConfirmButton: false
        });
      },
      error: (err) => {
        console.error('Error updating status:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to update document status'
        });
      }
    });
  }

  /**
   * Delete a document checklist item with confirmation
   */
  deleteDocumentChecklistItem(item: PIDocumentChecklist): void {
    if (!this.linkedCase?.id || !item.id) return;

    const docName = item.documentSubtype || this.getDocumentTypeLabel(item.documentType);

    Swal.fire({
      title: 'Remove from Checklist?',
      html: `<p>Are you sure you want to remove <strong>${docName}</strong> from the document checklist?</p>
             <p class="text-muted small">This will not delete any uploaded files.</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Yes, remove it',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.documentChecklistService.deleteChecklistItem(
          Number(this.linkedCase!.id),
          item.id!
        ).subscribe({
          next: () => {
            // Remove from local array immediately for responsive UI
            this.documentChecklist = this.documentChecklist.filter(d => d.id !== item.id);
            this.updateGroupedDocuments();
            this.loadDocumentCompleteness();
            this.cdr.detectChanges();

            Swal.fire({
              icon: 'success',
              title: 'Removed',
              text: `${docName} has been removed from the checklist`,
              timer: 1500,
              showConfirmButton: false
            });
          },
          error: (err) => {
            console.error('Error deleting checklist item:', err);
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Failed to remove document from checklist'
            });
          }
        });
      }
    });
  }

  /**
   * Open smart document request dialog with auto-resolved recipient
   */
  requestDocument(item: PIDocumentChecklist): void {
    if (!this.linkedCase?.id || !item.id) return;

    this.selectedChecklistItem = item;
    this.resolvedRecipient = null;
    this.selectedTemplate = null;
    this.requestHistory = [];
    this.selectedChannel = 'EMAIL';
    this.customRecipient = { name: '', email: '', phone: '' };
    this.isResolvingRecipient = true;

    // Show loading modal
    Swal.fire({
      title: 'Resolving Recipient...',
      html: `<div class="text-muted">Looking up contact information for ${this.getDocumentTypeLabel(item.documentType)}</div>`,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    // Resolve recipient from medical records, case data, or provider directory
    this.documentRequestService.resolveRecipient(Number(this.linkedCase.id), item.id).subscribe({
      next: (recipient) => {
        this.resolvedRecipient = recipient;
        this.isResolvingRecipient = false;

        // Load templates for this document type
        this.documentRequestService.getTemplates(item.documentType).subscribe({
          next: (templates) => {
            this.requestTemplates = templates;
            if (recipient.suggestedTemplateCode) {
              this.selectedTemplate = templates.find(t => t.templateCode === recipient.suggestedTemplateCode) || null;
            }
            Swal.close();
            this.showRequestDialog();
          },
          error: () => {
            Swal.close();
            this.showRequestDialog();
          }
        });
      },
      error: (err) => {
        console.error('Error resolving recipient:', err);
        this.isResolvingRecipient = false;
        Swal.close();
        // Show dialog anyway with manual entry
        this.showRequestDialog();
      }
    });
  }

  /**
   * Show the smart document request dialog
   */
  private showRequestDialog(): void {
    if (!this.selectedChecklistItem) return;

    const item = this.selectedChecklistItem;
    const recipient = this.resolvedRecipient;
    const resolved = recipient?.resolved || false;

    // Build channel options based on available contact methods
    const channelOptions: { [key: string]: string } = {};
    if (resolved) {
      if (recipient?.email) channelOptions['EMAIL'] = 'Email';
      if (recipient?.phone) channelOptions['SMS'] = 'SMS';
    } else {
      channelOptions['EMAIL'] = 'Email';
      channelOptions['SMS'] = 'SMS';
    }

    const hasChannels = Object.keys(channelOptions).length > 0;
    const defaultChannel = recipient?.email ? 'EMAIL' : (recipient?.phone ? 'SMS' : 'EMAIL');

    Swal.fire({
      title: `Request ${this.getDocumentTypeLabel(item.documentType)}`,
      width: 600,
      html: `
        <div class="text-start">
          <!-- Recipient Info -->
          <div class="mb-3">
            <label class="form-label fw-semibold">Recipient</label>
            ${resolved ? `
              <div class="alert alert-success py-2 mb-2">
                <i class="ri-check-line me-2"></i>
                <strong>${recipient?.recipientName || 'Unknown'}</strong>
                <small class="d-block text-muted">${recipient?.resolutionMessage}</small>
              </div>
              <div class="row g-2">
                ${recipient?.email ? `
                <div class="col-md-6">
                  <div class="input-group input-group-sm">
                    <span class="input-group-text"><i class="ri-mail-line"></i></span>
                    <input type="text" class="form-control" value="${recipient.email}" readonly>
                  </div>
                </div>` : ''}
                ${recipient?.phone ? `
                <div class="col-md-6">
                  <div class="input-group input-group-sm">
                    <span class="input-group-text"><i class="ri-phone-line"></i></span>
                    <input type="text" class="form-control" value="${recipient.phone}" readonly>
                  </div>
                </div>` : ''}
              </div>
            ` : `
              <div class="alert alert-warning py-2 mb-2">
                <i class="ri-information-line me-2"></i>
                ${recipient?.resolutionMessage || 'Manual entry required'}
              </div>
              <div class="row g-2">
                <div class="col-12">
                  <input type="text" class="form-control form-control-sm" id="swal-recipient-name"
                         placeholder="Recipient Name" value="${item.providerName || ''}">
                </div>
                <div class="col-md-6">
                  <input type="email" class="form-control form-control-sm" id="swal-recipient-email"
                         placeholder="Email Address">
                </div>
                <div class="col-md-6">
                  <input type="tel" class="form-control form-control-sm" id="swal-recipient-phone"
                         placeholder="Phone Number">
                </div>
              </div>
            `}
          </div>

          <!-- Channel Selection -->
          <div class="mb-3">
            <label class="form-label fw-semibold">Send Via</label>
            <div class="btn-group w-100" role="group">
              ${Object.entries(channelOptions).map(([value, label]) => `
                <input type="radio" class="btn-check" name="channel" id="channel-${value}"
                       value="${value}" ${value === defaultChannel ? 'checked' : ''}>
                <label class="btn btn-outline-primary" for="channel-${value}">
                  <i class="${this.documentRequestService.getChannelIcon(value)} me-1"></i> ${label}
                </label>
              `).join('')}
            </div>
          </div>

          <!-- Template Selection -->
          ${this.requestTemplates.length > 0 ? `
          <div class="mb-3">
            <label class="form-label fw-semibold">Message Template</label>
            <select class="form-select form-select-sm" id="swal-template">
              <option value="">-- Select Template --</option>
              ${this.requestTemplates.map(t => `
                <option value="${t.id}" ${t.id === this.selectedTemplate?.id ? 'selected' : ''}>
                  ${t.templateName} ${t.isSystem ? '(System)' : ''}
                </option>
              `).join('')}
            </select>
          </div>
          ` : ''}

          <!-- Document Fee -->
          <div class="mb-3">
            <label class="form-label fw-semibold">Document Fee (Optional)</label>
            <div class="input-group input-group-sm">
              <span class="input-group-text">$</span>
              <input type="number" class="form-control" id="swal-doc-fee" placeholder="0.00" step="0.01" min="0">
            </div>
            <small class="text-muted">Track document acquisition costs</small>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '<i class="ri-send-plane-line me-1"></i> Send Request',
      cancelButtonText: 'Cancel',
      customClass: {
        confirmButton: 'btn btn-primary me-2',
        cancelButton: 'btn btn-secondary'
      },
      buttonsStyling: false,
      preConfirm: () => {
        const channelEl = document.querySelector('input[name="channel"]:checked') as HTMLInputElement;
        const templateEl = document.getElementById('swal-template') as HTMLSelectElement;
        const feeEl = document.getElementById('swal-doc-fee') as HTMLInputElement;

        // Get recipient info (either resolved or manual)
        let recipientName = recipient?.recipientName || '';
        let recipientEmail = recipient?.email || '';
        let recipientPhone = recipient?.phone || '';

        if (!resolved) {
          const nameEl = document.getElementById('swal-recipient-name') as HTMLInputElement;
          const emailEl = document.getElementById('swal-recipient-email') as HTMLInputElement;
          const phoneEl = document.getElementById('swal-recipient-phone') as HTMLInputElement;
          recipientName = nameEl?.value || '';
          recipientEmail = emailEl?.value || '';
          recipientPhone = phoneEl?.value || '';
        }

        const channel = channelEl?.value || 'EMAIL';
        if (channel === 'EMAIL' && !recipientEmail) {
          Swal.showValidationMessage('Email address is required for email channel');
          return false;
        }
        if (channel === 'SMS' && !recipientPhone) {
          Swal.showValidationMessage('Phone number is required for SMS channel');
          return false;
        }

        return {
          channel,
          templateId: templateEl?.value ? parseInt(templateEl.value) : null,
          documentFee: feeEl?.value ? parseFloat(feeEl.value) : null,
          recipientName,
          recipientEmail,
          recipientPhone
        };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.sendDocumentRequest(result.value);
      }
    });
  }

  /**
   * Send the document request
   */
  private sendDocumentRequest(formData: any): void {
    if (!this.linkedCase?.id || !this.selectedChecklistItem?.id) return;

    this.isSendingRequest = true;

    const request: SendDocumentRequest = {
      recipientType: this.resolvedRecipient?.recipientType || 'MANUAL',
      recipientName: formData.recipientName,
      recipientEmail: formData.recipientEmail,
      recipientPhone: formData.recipientPhone,
      channel: formData.channel,
      templateId: formData.templateId,
      documentFee: formData.documentFee
    };

    Swal.fire({
      title: 'Sending Request...',
      html: `<div class="text-muted">Sending ${formData.channel.toLowerCase()} to ${formData.recipientName || formData.recipientEmail}</div>`,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.documentRequestService.sendRequest(
      Number(this.linkedCase.id),
      this.selectedChecklistItem.id,
      request
    ).subscribe({
      next: (logEntry) => {
        this.isSendingRequest = false;
        this.loadDocumentChecklist();

        const success = logEntry.channelStatus === 'SENT';
        Swal.fire({
          icon: success ? 'success' : 'warning',
          title: success ? 'Request Sent' : 'Request Logged',
          html: success
            ? `<p>${formData.channel} sent to <strong>${formData.recipientName || formData.recipientEmail}</strong></p>`
            : `<p>Request logged but delivery status: ${logEntry.channelStatus}</p>`,
          timer: 3000,
          showConfirmButton: false
        });

        this.selectedChecklistItem = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error sending request:', err);
        this.isSendingRequest = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to send document request. Please try again.',
          customClass: { confirmButton: 'btn btn-primary' }
        });
      }
    });
  }

  /**
   * View request history for a checklist item
   */
  viewRequestHistory(item: PIDocumentChecklist): void {
    if (!this.linkedCase?.id || !item.id) return;

    this.isLoadingHistory = true;

    Swal.fire({
      title: 'Request History',
      html: '<div class="text-center py-3"><span class="spinner-border spinner-border-sm"></span> Loading...</div>',
      showConfirmButton: false,
      allowOutsideClick: true
    });

    this.documentRequestService.getRequestHistory(Number(this.linkedCase.id), item.id).subscribe({
      next: (history) => {
        this.requestHistory = history;
        this.isLoadingHistory = false;

        if (history.length === 0) {
          Swal.fire({
            title: 'Request History',
            html: `<div class="text-center py-4 text-muted">
              <i class="ri-mail-send-line fs-1 d-block mb-2"></i>
              <p>No requests have been sent for this document yet.</p>
            </div>`,
            confirmButtonText: 'Close',
            customClass: { confirmButton: 'btn btn-secondary' },
            buttonsStyling: false
          });
          return;
        }

        const historyHtml = history.map(log => `
          <div class="border-bottom pb-2 mb-2">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <strong>${log.recipientName || log.recipientEmail}</strong>
                <span class="badge bg-${this.documentRequestService.getChannelStatusColor(log.channelStatus)} ms-2">
                  ${log.channelStatus}
                </span>
              </div>
              <small class="text-muted">${new Date(log.sentAt).toLocaleDateString()}</small>
            </div>
            <div class="small text-muted">
              <i class="${this.documentRequestService.getChannelIcon(log.channel)} me-1"></i>
              ${this.documentRequestService.getChannelLabel(log.channel)}
              ${log.documentFee ? ` | Fee: $${log.documentFee.toFixed(2)}` : ''}
            </div>
          </div>
        `).join('');

        Swal.fire({
          title: `Request History (${history.length})`,
          html: `<div class="text-start" style="max-height: 300px; overflow-y: auto;">${historyHtml}</div>`,
          confirmButtonText: 'Close',
          customClass: { confirmButton: 'btn btn-secondary' },
          buttonsStyling: false
        });
      },
      error: (err) => {
        console.error('Error loading history:', err);
        this.isLoadingHistory = false;
        Swal.close();
      }
    });
  }

  /**
   * Toggle bulk select mode
   */
  toggleBulkSelectMode(): void {
    this.bulkSelectMode = !this.bulkSelectMode;
    if (!this.bulkSelectMode) {
      this.selectedForBulk.clear();
    }
    this.cdr.detectChanges();
  }

  /**
   * Toggle item selection for bulk request
   */
  toggleBulkSelection(item: PIDocumentChecklist, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (!item.id) return;
    if (this.selectedForBulk.has(item.id)) {
      this.selectedForBulk.delete(item.id);
    } else {
      this.selectedForBulk.add(item.id);
    }
    this.cdr.detectChanges();
  }

  /**
   * Check if item is selected for bulk
   */
  isSelectedForBulk(itemId: number): boolean {
    return this.selectedForBulk.has(itemId);
  }

  /**
   * Send bulk document requests - opens the wizard
   */
  sendBulkRequests(): void {
    if (!this.linkedCase?.id || this.selectedForBulk.size === 0) return;
    // Store the selected IDs as an array before opening the wizard
    // This prevents creating new array references on every change detection
    this.bulkWizardItemIds = Array.from(this.selectedForBulk);
    this.showBulkWizard = true;
    this.cdr.detectChanges();
  }

  /**
   * Handle bulk wizard completion
   */
  onBulkWizardCompleted(result: BulkSendResult): void {
    this.showBulkWizard = false;
    this.bulkSelectMode = false;
    this.selectedForBulk.clear();
    this.loadDocumentChecklist();

    // Show success message
    const hasErrors = result.failedCount > 0;
    Swal.fire({
      icon: hasErrors ? 'warning' : 'success',
      title: 'Bulk Request Complete',
      html: `
        <div class="text-start">
          <p><strong>${result.sentCount}</strong> documents sent successfully</p>
          ${result.emailsSent > 0 ? `<p class="text-muted"><i class="ri-mail-line me-1"></i>${result.emailsSent} email(s)</p>` : ''}
          ${result.smsSent > 0 ? `<p class="text-muted"><i class="ri-smartphone-line me-1"></i>${result.smsSent} SMS message(s)</p>` : ''}
          ${result.skippedCount > 0 ? `<p class="text-muted">${result.skippedCount} item(s) skipped</p>` : ''}
          ${result.failedCount > 0 ? `<p class="text-danger"><strong>${result.failedCount}</strong> request(s) failed</p>` : ''}
        </div>
      `,
      confirmButtonText: 'OK',
      customClass: { confirmButton: 'btn btn-primary' },
      buttonsStyling: false
    });
  }

  /**
   * Handle bulk wizard cancellation
   */
  onBulkWizardCancelled(): void {
    this.showBulkWizard = false;
  }

  // --- Damage Calculation (Professional) ---

  /**
   * Load damage elements for the linked case
   * @param loadCalculation - Whether to also load the saved damage calculation (default: false)
   *                          Set to true only when first linking a case
   */
  loadDamageElements(loadCalculation: boolean = false): void {
    if (!this.linkedCase?.id) return;

    this.isLoadingDamages = true;
    this.damageCalculationService.getDamageElements(Number(this.linkedCase.id))
      .pipe(takeUntil(this.caseSwitch$))
      .subscribe({
        next: (elements) => {
          this.damageElements = elements;
          this.isLoadingDamages = false;
          // Only load calculation if explicitly requested (e.g., when linking a case)
          if (loadCalculation) {
            this.loadDamageCalculation();
          }
          // Auto-sync damage values to form from actual elements
          this.autoSyncDamageValues();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading damage elements:', err);
          this.isLoadingDamages = false;
          this.cdr.detectChanges();
        }
      });
  }

  loadDamageCalculation(): void {
    if (!this.linkedCase?.id) return;

    this.damageCalculationService.getDamageCalculation(Number(this.linkedCase.id))
      .pipe(takeUntil(this.caseSwitch$))
      .subscribe({
        next: (calculation) => {
          this.damageCalculation = calculation;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading damage calculation:', err);
        }
      });
  }

  addDamageElement(): void {
    if (!this.linkedCase?.id || !this.newDamageElement.elementName) return;

    const element: PIDamageElement = {
      caseId: Number(this.linkedCase.id),
      elementType: this.newDamageElement.elementType || 'PAST_MEDICAL',
      elementName: this.newDamageElement.elementName,
      calculationMethod: this.newDamageElement.calculationMethod || 'ACTUAL',
      baseAmount: this.newDamageElement.baseAmount || 0,
      calculatedAmount: this.newDamageElement.calculatedAmount || this.newDamageElement.baseAmount || 0,
      confidenceLevel: this.newDamageElement.confidenceLevel || 'MEDIUM',
      notes: this.newDamageElement.notes
    };

    this.damageCalculationService.createDamageElement(Number(this.linkedCase.id), element).subscribe({
      next: () => {
        this.loadDamageElements();
        this.resetNewDamageElement();
        Swal.fire({
          icon: 'success',
          title: 'Damage Element Added',
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: (err) => {
        console.error('Error adding damage element:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to add damage element'
        });
      }
    });
  }

  deleteDamageElement(element: PIDamageElement): void {
    if (!this.linkedCase?.id || !element.id) return;

    Swal.fire({
      title: 'Delete Damage Element?',
      text: `Are you sure you want to delete "${element.elementName}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      customClass: {
        confirmButton: 'btn btn-danger me-2',
        cancelButton: 'btn btn-secondary'
      },
      buttonsStyling: false
    }).then((result) => {
      if (result.isConfirmed) {
        this.damageCalculationService.deleteDamageElement(
          Number(this.linkedCase!.id),
          element.id!
        ).subscribe({
          next: () => {
            this.loadDamageElements();
            Swal.fire({
              icon: 'success',
              title: 'Deleted',
              timer: 2000,
              showConfirmButton: false
            });
          },
          error: (err) => {
            console.error('Error deleting element:', err);
          }
        });
      }
    });
  }

  clearValuation(): void {
    if (!this.linkedCase?.id || !this.damageElements?.length) return;

    Swal.fire({
      title: 'Clear All Valuation Data?',
      text: 'This will delete all damage elements and the calculation for this case. You can re-calculate afterwards.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, clear all',
      cancelButtonText: 'Cancel',
      customClass: {
        confirmButton: 'btn btn-danger me-2',
        cancelButton: 'btn btn-secondary'
      },
      buttonsStyling: false
    }).then((result) => {
      if (result.isConfirmed) {
        this.damageCalculationService.clearAllDamageData(Number(this.linkedCase!.id)).subscribe({
          next: () => {
            this.damageElements = [];
            this.damageCalculation = null;
            this.calculatedValue = null;
            this.latestCaseValue = 0;
            localStorage.removeItem('pi_latest_case_value');
            localStorage.removeItem('pi_calculated_value');
            this.loadDamageElements();
            this.cdr.detectChanges();
            Swal.fire({
              icon: 'success',
              title: 'Cleared',
              text: 'All valuation data has been removed.',
              timer: 2500,
              showConfirmButton: false
            });
          },
          error: (err) => {
            console.error('Error clearing valuation:', err);
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Failed to clear valuation data'
            });
          }
        });
      }
    });
  }

  calculateComprehensiveDamages(): void {
    if (!this.linkedCase?.id) return;

    this.isCalculatingDamages = true;
    const caseContext = {
      injuryType: this.linkedCase.injuryType || this.caseValueForm.get('injuryType')?.value,
      jurisdiction: 'Massachusetts'
    };

    this.damageCalculationService.calculateDamagesWithAI(
      Number(this.linkedCase.id),
      caseContext
    ).subscribe({
      next: (calculation) => {
        this.damageCalculation = calculation;
        this.isCalculatingDamages = false;

        // Auto-expand comparable analysis if available
        if (calculation.comparableAnalysis?.success && calculation.comparableAnalysis.analysis) {
          this.comparableAnalysisExpanded = true;
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error calculating damages:', err);
        this.isCalculatingDamages = false;
        this.cdr.detectChanges();
      }
    });
  }

  syncMedicalExpenses(): void {
    if (!this.linkedCase?.id) return;

    this.damageCalculationService.syncMedicalExpenses(Number(this.linkedCase.id)).subscribe({
      next: (element) => {
        this.loadDamageElements();

        // If element is null/undefined, it means there were no medical records to sync
        if (!element) {
          Swal.fire({
            icon: 'info',
            title: 'No Medical Records',
            text: 'No medical records found to sync. Add medical records first in the Medical Records tab.',
            confirmButtonText: 'OK'
          });
        } else {
          Swal.fire({
            icon: 'success',
            title: 'Medical Expenses Synced',
            html: `Past medical expenses updated: <strong>${this.formatCurrency(element.calculatedAmount || element.baseAmount || 0)}</strong>`,
            timer: 2500,
            showConfirmButton: false
          });
        }
      },
      error: (err) => {
        console.error('Error syncing medical expenses:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to sync medical expenses'
        });
      }
    });
  }

  resetNewDamageElement(): void {
    this.newDamageElement = {
      elementType: 'PAST_MEDICAL',
      elementName: '',
      calculationMethod: 'ACTUAL',
      baseAmount: 0,
      calculatedAmount: 0,
      confidenceLevel: 'MEDIUM'
    };
  }

  getDamageTypeIcon(type: string): string {
    const found = this.damageElementTypes.find(t => t.value === type);
    return found?.icon || 'ri-file-list-line';
  }

  getDamageTypeLabel(type: string): string {
    const found = this.damageElementTypes.find(t => t.value === type);
    return found?.label || type;
  }

  // ==========================================
  // Grouped Damage Elements Methods (for consolidated Case Valuation tab)
  // ==========================================

  /**
   * Toggle collapse state for a damage group
   */
  toggleDamageGroup(groupKey: string): void {
    this.collapsedDamageGroups[groupKey] = !this.collapsedDamageGroups[groupKey];
  }

  /**
   * Get damage elements filtered by category/type
   */
  getDamageElementsByCategory(category: string): PIDamageElement[] {
    return this.damageElements.filter(e => e.elementType === category);
  }

  /**
   * Get total for a damage category
   */
  getDamageCategoryTotal(category: string): number {
    return this.getDamageElementsByCategory(category)
      .reduce((sum, e) => sum + (e.calculatedAmount || e.baseAmount || 0), 0);
  }

  /**
   * Get damage elements that don't fit main categories
   */
  getOtherDamageElements(): PIDamageElement[] {
    const mainCategories = ['PAST_MEDICAL', 'LOST_WAGES', 'FUTURE_MEDICAL', 'PAIN_SUFFERING'];
    return this.damageElements.filter(e => !mainCategories.includes(e.elementType));
  }

  /**
   * Get total for "other" damage elements
   */
  getOtherDamagesTotal(): number {
    return this.getOtherDamageElements()
      .reduce((sum, e) => sum + (e.calculatedAmount || e.baseAmount || 0), 0);
  }

  /**
   * Calculate economic damages from elements (for summary bar)
   */
  getEconomicDamagesFromElements(): number {
    const economicTypes = ['PAST_MEDICAL', 'FUTURE_MEDICAL', 'LOST_WAGES', 'FUTURE_LOST_WAGES', 'PROPERTY_DAMAGE', 'OUT_OF_POCKET'];
    return this.damageElements
      .filter(e => economicTypes.includes(e.elementType))
      .reduce((sum, e) => sum + (e.calculatedAmount || e.baseAmount || 0), 0);
  }

  /**
   * Calculate non-economic damages from elements (for summary bar)
   */
  getNonEconomicDamagesFromElements(): number {
    const nonEconomicTypes = ['PAIN_SUFFERING', 'EMOTIONAL_DISTRESS', 'LOSS_CONSORTIUM', 'LOSS_ENJOYMENT'];
    return this.damageElements
      .filter(e => nonEconomicTypes.includes(e.elementType))
      .reduce((sum, e) => sum + (e.calculatedAmount || e.baseAmount || 0), 0);
  }

  /**
   * Check if there's actual damage data (medical records or damage elements with values)
   * Used to prevent showing stale saved calculations when there's no supporting data
   */
  hasActualDamageData(): boolean {
    // Check for medical records with billed amounts
    const hasMedicalRecords = this.medicalRecords.some(r => (r.billedAmount || 0) > 0);
    // Check for damage elements with values
    const hasDamageElements = this.damageElements.some(e => (e.calculatedAmount || e.baseAmount || 0) > 0);
    return hasMedicalRecords || hasDamageElements;
  }

  // ==========================================
  // Executive Panel Helper Methods
  // ==========================================

  /**
   * Toggle for comparable analysis expandable section
   */
  comparableAnalysisExpanded: boolean = false;

  /**
   * Get CSS class for case strength ring based on score
   */
  getStrengthClass(strength: number): string {
    if (strength >= 7) return 'strength-high';
    if (strength >= 4) return 'strength-medium';
    return 'strength-low';
  }

  /**
   * Calculate the position of the policy limit marker on the value range bar
   * Returns percentage (0-100) based on where policy limit falls within the value range
   */
  getPolicyLimitPosition(): number {
    const policyLimit = this.caseValueForm.get('policyLimit')?.value || 0;
    if (policyLimit <= 0) return 0;

    const high = this.damageCalculation?.highValue || this.calculatedValue?.settlementRangeHigh || 0;
    if (high <= 0) return 100;

    const position = (policyLimit / high) * 100;
    return Math.min(Math.max(position, 0), 100);
  }

  /**
   * Calculate width percentages for the value range bar segments
   */
  getValueBarWidth(segment: 'low' | 'likely' | 'high'): number {
    const rawLow = this.damageCalculation?.lowValue || this.calculatedValue?.settlementRangeLow || 0;
    const rawLikely = this.damageCalculation?.midValue || this.calculatedValue?.realisticRecovery || 0;
    const rawHigh = this.damageCalculation?.highValue || this.calculatedValue?.settlementRangeHigh || 0;

    // Ensure proper ordering (AI might return out-of-order ranges)
    const sortedLow = Math.min(rawLow, rawLikely, rawHigh);
    const sortedHigh = Math.max(rawLow, rawLikely, rawHigh);
    // Calculate middle value (sum of all three minus min and max)
    const sortedLikely = rawLow + rawLikely + rawHigh - sortedLow - sortedHigh;

    // Equal distribution fallback if high is 0 or negative
    if (sortedHigh <= 0) return 33;

    // Use high as 100% baseline
    const total = sortedHigh;

    switch (segment) {
      case 'low':
        return Math.max(0, Math.min(100, (sortedLow / total) * 100));
      case 'likely':
        return Math.max(0, Math.min(100, ((sortedLikely - sortedLow) / total) * 100));
      case 'high':
        return Math.max(0, Math.min(100, ((sortedHigh - sortedLikely) / total) * 100));
      default:
        return 33;
    }
  }

  /**
   * Get positive/strengthening factors from key factors
   */
  getPositiveFactors(): string[] {
    if (!this.calculatedValue?.keyFactors) return [];
    const factors = this.calculatedValue.keyFactors;

    // Negative keywords - if any of these are present, it's NOT a positive factor
    const negativeKeywords = ['gap', 'weak', 'disputed', 'concern', 'limited', 'pre-existing', 'insufficient', 'lacking', 'missing', 'delay'];

    // Positive keywords
    const positiveKeywords = ['clear liability', 'clear', 'documented', 'consistent', 'supported', 'strong', 'significant', 'favorable', 'objective', 'verifiable', '0% comparative', '0% negligence'];

    return factors.filter(f => {
      const lower = f.toLowerCase();
      // Must contain at least one positive keyword
      const hasPositive = positiveKeywords.some(keyword => lower.includes(keyword));
      // Must NOT contain any negative keywords
      const hasNegative = negativeKeywords.some(keyword => lower.includes(keyword));
      return hasPositive && !hasNegative;
    }).slice(0, 3);
  }

  /**
   * Get negative/weakening factors from key factors
   */
  getNegativeFactors(): string[] {
    if (!this.calculatedValue?.keyFactors) return [];
    const factors = this.calculatedValue.keyFactors;

    // Negative keywords that indicate weakening factors
    const negativeKeywords = ['gap', 'weak', 'disputed', 'concern', 'limited', 'pre-existing', 'insufficient', 'lacking', 'missing', 'delay', 'inconsistent', 'question', 'doubt'];

    // Positive keywords - if these are present WITHOUT negative keywords, it's not a negative factor
    const positiveKeywords = ['clear liability', 'clear', 'documented', 'consistent', 'supported', 'strong', 'significant', 'favorable', 'objective', 'verifiable', '0% comparative', '0% negligence'];

    return factors.filter(f => {
      const lower = f.toLowerCase();
      // Must contain at least one negative keyword
      const hasNegative = negativeKeywords.some(keyword => lower.includes(keyword));
      // Check if it's primarily positive (shouldn't be in negative column)
      const hasPrimaryPositive = positiveKeywords.some(keyword => lower.includes(keyword));

      // Include in negative if it has negative keywords, unless it's clearly positive
      // "Clear liability" should never appear in negative column
      if (lower.includes('clear liability') || lower.includes('0% comparative') || lower.includes('0% negligence')) {
        return false;
      }
      return hasNegative;
    }).slice(0, 3);
  }

  /**
   * Flag to indicate we should run comprehensive analysis after calculation
   */
  private runAnalysisAfterCalculation: boolean = false;

  /**
   * Combined calculate and analyze - runs both calculation and AI analysis
   */
  calculateAndAnalyze(): void {
    // Validate form first - if invalid, don't proceed
    if (this.caseValueForm.invalid) {
      this.markFormGroupTouched(this.caseValueForm);
      return;
    }

    // Set flag to run comprehensive analysis after calculation completes
    if (this.linkedCase) {
      this.runAnalysisAfterCalculation = true;
    }

    // Run the case value calculation (will trigger comprehensive analysis via flag)
    this.calculateCaseValue();
  }

  /**
   * Reset/clear case value calculation and start fresh
   */
  resetCaseValueCalculation(): void {
    Swal.fire({
      title: 'Reset Calculation?',
      text: 'This will clear the current calculation results. Form values will be preserved.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Reset',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#f06548'
    }).then((result) => {
      if (result.isConfirmed) {
        this.calculatedValue = null;
        this.damageCalculation = null;
        this.latestCaseValue = 0;
        localStorage.removeItem('pi_latest_case_value');
        localStorage.removeItem('pi_calculated_value');

        // Destroy the chart if it exists
        if (this.damageChart) {
          this.damageChart.destroy();
          this.damageChart = null;
        }

        this.cdr.detectChanges();

        Swal.fire({
          icon: 'success',
          title: 'Reset Complete',
          text: 'Calculation results have been cleared.',
          timer: 1500,
          showConfirmButton: false
        });
      }
    });
  }

  getStatusColor(status: string): string {
    const found = this.documentStatuses.find(s => s.value === status);
    return found?.color || 'secondary';
  }

  getStatusLabel(status: string): string {
    const found = this.documentStatuses.find(s => s.value === status);
    return found?.label || status;
  }

  getDocumentTypeLabel(type: string): string {
    const found = this.documentTypes.find(t => t.value === type);
    return found?.label || type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  getDocumentTypeIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'POLICE_REPORT': 'ri-shield-line',
      'MEDICAL_RECORDS': 'ri-file-list-3-line',
      'MEDICAL_BILLS': 'ri-money-dollar-circle-line',
      'WAGE_DOCUMENTATION': 'ri-briefcase-line',
      'INSURANCE': 'ri-shield-check-line',
      'PHOTOGRAPHS': 'ri-camera-line',
      'WITNESS': 'ri-user-voice-line',
      'EXPERT': 'ri-user-star-line',
      'OTHER': 'ri-file-line'
    };
    return icons[type] || 'ri-file-line';
  }

  getCompletenessPercent(): number {
    if (!this.documentCompleteness) return 0;
    return Math.min(this.documentCompleteness.completenessPercent, 100);
  }

  getMissingDocuments(): any[] {
    return this.documentChecklist.filter(item => item.status === 'MISSING');
  }

  getDocumentCountByStatus(status: string): number {
    return this.documentChecklist.filter(item => item.status === status).length;
  }

  /**
   * TrackBy function for document checklist - includes status to trigger re-render on status change
   */
  trackByDocId(index: number, item: PIDocumentChecklist): string {
    return `${item.id || index}-${item.status}`;
  }

  /**
   * TrackBy function for groups - includes counts to trigger re-render
   */
  trackByGroupType(index: number, group: { type: string; receivedCount: number; totalCount: number }): string {
    return `${group.type}-${group.receivedCount}-${group.totalCount}`;
  }

  /**
   * Toggle collapse state for document group (uses same collapsedDamageGroups object)
   */
  toggleDocumentGroup(groupType: string): void {
    this.collapsedDamageGroups[groupType] = !this.collapsedDamageGroups[groupType];
    this.cdr.detectChanges();
  }

  /**
   * Update checklist item status (wrapper for changeDocumentStatus)
   */
  updateChecklistItemStatus(item: PIDocumentChecklist, newStatus: string): void {
    this.changeDocumentStatus(item, newStatus);
  }

  /**
   * Update the cached grouped documents - call this when documentChecklist changes
   */
  updateGroupedDocuments(): void {
    const groups: { [key: string]: PIDocumentChecklist[] } = {};

    // Group by document type - create fresh copies to ensure change detection
    this.documentChecklist.forEach(item => {
      const type = item.documentType || 'OTHER';
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push({ ...item });
    });

    // Define order of groups
    const typeOrder = ['POLICE_REPORT', 'MEDICAL_RECORDS', 'MEDICAL_BILLS', 'INSURANCE', 'WAGE_DOCUMENTATION', 'PHOTOGRAPHS', 'WITNESS', 'EXPERT', 'OTHER'];

    // Convert to array and sort by predefined order - create new array reference
    this.groupedDocuments = [...typeOrder
      .filter(type => groups[type] && groups[type].length > 0)
      .map(type => ({
        type,
        label: this.getDocumentTypeLabel(type),
        icon: this.getDocumentTypeIcon(type),
        items: [...groups[type].sort((a, b) => (a.id || 0) - (b.id || 0))],
        receivedCount: groups[type].filter(i => i.status === 'RECEIVED').length,
        totalCount: groups[type].length
      }))];
  }

  /**
   * Get group completion status class
   */
  getGroupStatusClass(group: { receivedCount: number; totalCount: number }): string {
    if (group.receivedCount === group.totalCount) return 'group-complete';
    if (group.receivedCount > 0) return 'group-partial';
    return 'group-pending';
  }

  getConfidenceColor(level: string): string {
    const found = this.confidenceLevels.find(c => c.value === level);
    return found?.color || 'secondary';
  }

  // ==========================================
  // Smart Citation Methods
  // ==========================================

  /**
   * Check if a medical record has citation metadata for a specific field
   */
  hasCitation(record: PIMedicalRecord, fieldName: string): boolean {
    if (!record.citationMetadata || !record.documentId) {
      return false;
    }
    const citation = record.citationMetadata[fieldName];
    return citation !== undefined && citation !== null;
  }

  /**
   * Get citation data for a specific field
   */
  getCitation(record: PIMedicalRecord, fieldName: string): FieldCitation | null {
    if (!this.hasCitation(record, fieldName)) {
      return null;
    }
    return record.citationMetadata![fieldName] as FieldCitation;
  }

  /**
   * Get the field value for display in the citation viewer
   */
  getFieldValue(record: PIMedicalRecord, fieldName: string): string {
    const fieldValues: Record<string, string | undefined> = {
      treatmentDate: record.treatmentDate,
      providerName: record.providerName,
      recordType: record.recordType,
      keyFindings: record.keyFindings,
      treatmentProvided: record.treatmentProvided
    };
    return fieldValues[fieldName] || '';
  }

  /**
   * Open the citation viewer modal for a specific field
   */
  openCitation(record: PIMedicalRecord, fieldName: string): void {
    // Only open if there's citation data and a linked document
    if (!this.hasCitation(record, fieldName)) {
      // If no citation but document exists, still allow viewing the document
      if (record.documentId) {
        this.openDocumentViewer(record);
      }
      return;
    }

    const citation = this.getCitation(record, fieldName);
    if (!citation) return;

    const modalRef = this.modalService.open(CitationViewerModalComponent, {
      size: 'lg',
      centered: true,
      backdrop: 'static',
      windowClass: 'citation-viewer-modal-window'
    });

    modalRef.componentInstance.documentId = record.documentId;
    modalRef.componentInstance.documentName = record.documentName || `Document #${record.documentId}`;
    modalRef.componentInstance.fieldName = fieldName;
    modalRef.componentInstance.fieldValue = this.getFieldValue(record, fieldName);
    modalRef.componentInstance.citation = citation;
  }

  /**
   * Open document viewer without citation navigation (fallback)
   */
  openDocumentViewer(record: PIMedicalRecord): void {
    if (!record.documentId) return;

    const modalRef = this.modalService.open(CitationViewerModalComponent, {
      size: 'lg',
      centered: true,
      backdrop: 'static',
      windowClass: 'citation-viewer-modal-window'
    });

    modalRef.componentInstance.documentId = record.documentId;
    modalRef.componentInstance.documentName = record.documentName || `Document #${record.documentId}`;
    modalRef.componentInstance.fieldName = '';
    modalRef.componentInstance.fieldValue = '';
    modalRef.componentInstance.citation = null;
  }

  // ==========================================
  // Helper Methods
  // ==========================================

  getSpecialtyIcon(specialty: string): string {
    const icons: Record<string, string> = {
      'Emergency Medicine': 'ri-hospital-line',
      'Orthopedics': 'ri-body-scan-line',
      'Neurology': 'ri-brain-line',
      'Physical Therapy': 'ri-walk-line',
      'Chiropractic': 'ri-body-scan-line',
      'Pain Management': 'ri-medicine-bottle-line',
      'Surgery': 'ri-surgical-mask-line',
      'Radiology': 'ri-scan-line',
      'Primary Care': 'ri-stethoscope-line',
      'Psychology/Psychiatry': 'ri-mental-health-line'
    };
    return icons[specialty] || 'ri-hospital-line';
  }

  getToolIcon(toolType: string): string {
    const icons: Record<string, string> = {
      'case-value': 'ri-calculator-line',
      'demand-letter': 'ri-file-text-line',
      'medical-tracker': 'ri-hospital-line',
      'settlement': 'ri-money-dollar-circle-line'
    };
    return icons[toolType] || 'ri-tools-line';
  }

  getToolName(toolType: string): string {
    const names: Record<string, string> = {
      'case-value': 'Case Value Calculator',
      'demand-letter': 'Demand Letter Generator',
      'medical-tracker': 'Medical Provider Tracker',
      'settlement': 'Settlement Tracker'
    };
    return names[toolType] || toolType;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  formatCompactCurrency(amount: number): string {
    if (amount === 0) return '$0';
    if (amount >= 1000000) {
      return '$' + (amount / 1000000).toFixed(1) + 'M';
    }
    if (amount >= 1000) {
      return '$' + Math.round(amount / 1000) + 'K';
    }
    return this.formatCurrency(amount);
  }

  formatActivityTime(timestamp: Date | string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // ==========================================
  // Provider Directory Methods
  // ==========================================

  loadProviders(): void {
    this.isLoadingProviders = true;
    this.providerDirectoryService.getAllProviders().subscribe({
      next: (providers) => {
        this.providers = providers;
        this.filteredProviders = providers;
        this.isLoadingProviders = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading providers:', err);
        this.isLoadingProviders = false;
        this.cdr.detectChanges();
      }
    });
  }

  filterProviders(): void {
    const term = this.providerSearchTerm.toLowerCase().trim();
    let filtered = this.providers;

    // Filter by search term
    if (term) {
      filtered = filtered.filter(p =>
        p.providerName?.toLowerCase().includes(term) ||
        p.city?.toLowerCase().includes(term) ||
        p.state?.toLowerCase().includes(term) ||
        p.providerType?.toLowerCase().includes(term) ||
        p.recordsEmail?.toLowerCase().includes(term) ||
        p.billingEmail?.toLowerCase().includes(term)
      );
    }

    // Filter by provider type
    if (this.providerTypeFilter) {
      filtered = filtered.filter(p => p.providerType === this.providerTypeFilter);
    }

    this.filteredProviders = filtered;
  }

  showAddProviderModal(): void {
    this.editingProvider = {
      providerName: '',
      providerType: '',
      mainPhone: '',
      mainEmail: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      recordsContactName: '',
      recordsPhone: '',
      recordsEmail: '',
      recordsFax: '',
      billingContactName: '',
      billingPhone: '',
      billingEmail: '',
      baseFee: undefined,
      perPageFee: undefined,
      rushFee: undefined,
      notes: ''
    };
    this.showProviderModal = true;
  }

  editProvider(provider: ProviderDirectory): void {
    this.editingProvider = { ...provider };
    this.showProviderModal = true;
  }

  closeProviderModal(): void {
    this.showProviderModal = false;
    this.editingProvider = null;
  }

  saveProvider(): void {
    if (!this.editingProvider?.providerName) return;

    this.isSavingProvider = true;

    const saveObs = this.editingProvider.id
      ? this.providerDirectoryService.updateProvider(this.editingProvider.id, this.editingProvider)
      : this.providerDirectoryService.createProvider(this.editingProvider);

    saveObs.subscribe({
      next: () => {
        this.isSavingProvider = false;
        this.closeProviderModal();
        this.loadProviders();
        Swal.fire({
          icon: 'success',
          title: 'Provider Saved',
          text: `${this.editingProvider?.providerName} has been ${this.editingProvider?.id ? 'updated' : 'added'} to the directory.`,
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: (err) => {
        console.error('Error saving provider:', err);
        this.isSavingProvider = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to save provider. Please try again.'
        });
      }
    });
  }

  deleteProvider(provider: ProviderDirectory): void {
    Swal.fire({
      title: 'Delete Provider?',
      text: `Are you sure you want to delete "${provider.providerName}" from the directory?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#f06548',
      customClass: {
        confirmButton: 'btn btn-danger me-2',
        cancelButton: 'btn btn-secondary'
      },
      buttonsStyling: false
    }).then((result) => {
      if (result.isConfirmed && provider.id) {
        this.providerDirectoryService.deleteProvider(provider.id).subscribe({
          next: () => {
            this.loadProviders();
            Swal.fire({
              icon: 'success',
              title: 'Deleted',
              text: 'Provider has been removed from the directory.',
              timer: 2000,
              showConfirmButton: false
            });
          },
          error: (err) => {
            console.error('Error deleting provider:', err);
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Failed to delete provider. Please try again.'
            });
          }
        });
      }
    });
  }
}
