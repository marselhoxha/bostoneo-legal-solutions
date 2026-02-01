import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, BehaviorSubject, Observable, of } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, switchMap, catchError, map } from 'rxjs/operators';
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

// Register Chart.js components
Chart.register(...registerables);

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
    BulkRequestWizardComponent
  ],
  templateUrl: './personal-injury.component.html',
  styleUrls: ['./personal-injury.component.scss']
})
export class PersonalInjuryComponent extends PracticeAreaBaseComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('damageChart') damageChartRef!: ElementRef<HTMLCanvasElement>;
  private damageChart: Chart<'doughnut'> | null = null;

  private destroy$ = new Subject<void>();

  // View State Management (Tab-based)
  activeTab: string = 'dashboard';

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

  // Demand Letter Generator
  demandForm: FormGroup;
  generatedDemand: string = '';
  isGeneratingDemand: boolean = false;
  demandMode: 'express' | 'detailed' = 'express';

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
  medicalRecordForm: FormGroup;
  editingMedicalRecord: PIMedicalRecord | null = null;
  recordTypes = RECORD_TYPES;
  providerTypes = PROVIDER_TYPES;

  // Medical Summary
  medicalSummary: PIMedicalSummary | null = null;
  isGeneratingSummary: boolean = false;
  summaryExists: boolean = false;

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
    private aiModalService: AiResponseModalService,
    private workspaceState: WorkspaceStateService,
    private caseService: CaseService,
    private medicalRecordService: PIMedicalRecordService,
    private documentChecklistService: PIDocumentChecklistService,
    private damageCalculationService: PIDamageCalculationService,
    private medicalSummaryService: PIMedicalSummaryService,
    private documentRequestService: PIDocumentRequestService,
    public providerDirectoryService: PIProviderDirectoryService,
    private modalService: NgbModal
  ) {
    super();

    // Initialize Case Value Calculator Form
    this.caseValueForm = this.fb.group({
      injuryType: ['soft_tissue', Validators.required],
      injuryDescription: ['', Validators.required],
      medicalExpenses: [0, [Validators.required, Validators.min(0)]],
      lostWages: [0, [Validators.required, Validators.min(0)]],
      futureMedical: [0, [Validators.min(0)]],
      customMultiplier: [null],
      liabilityAssessment: ['CLEAR', Validators.required],
      comparativeNegligence: [0, [Validators.min(0), Validators.max(100)]]
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
      painSufferingMultiplier: [2.5, Validators.required]
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
    this.loadSavedData();
    this.loadRecentActivity();
    this.loadProviders();

    // Update multiplier when injury type changes
    this.caseValueForm.get('injuryType')?.valueChanges.subscribe(injuryType => {
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
  }

  ngAfterViewInit(): void {
    // Chart will be created when results are available
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.damageChart) {
      this.damageChart.destroy();
    }
  }

  loadSavedData(): void {
    const savedProviders = localStorage.getItem('pi_medical_providers');
    if (savedProviders) {
      this.medicalProviders = JSON.parse(savedProviders);
    }

    const savedHistory = localStorage.getItem('pi_settlement_history');
    if (savedHistory) {
      this.settlementHistory = JSON.parse(savedHistory);
    }

    const savedCaseValue = localStorage.getItem('pi_latest_case_value');
    if (savedCaseValue) {
      this.latestCaseValue = parseFloat(savedCaseValue);
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

    // Create chart if opening case value and there are results
    if (toolId === 'case-value' && this.calculatedValue) {
      setTimeout(() => this.createDamageChart(), 100);
    }
  }

  backToDashboard(): void {
    this.activeTab = 'dashboard';
  }

  openActivityItem(activity: ActivityItem): void {
    this.openTool(activity.toolType);
    // Could also restore the activity data here if needed
  }

  openQuickCalculator(): void {
    this.activeTab = 'case-value';
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
    return ((multiplier - 1) / 4) * 100; // Maps 1-5 to 0-100%
  }

  onMultiplierSliderChange(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.caseValueForm.patchValue({ customMultiplier: value });
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
    if (this.caseValueForm.invalid) {
      this.markFormGroupTouched(this.caseValueForm);
      return;
    }

    this.isCalculating = true;
    const formData = this.caseValueForm.value;

    // Calculate locally first for immediate feedback
    const medicalExpenses = formData.medicalExpenses || 0;
    const lostWages = formData.lostWages || 0;
    const futureMedical = formData.futureMedical || 0;
    const economicDamages = medicalExpenses + lostWages + futureMedical;
    const multiplier = this.getMultiplier();
    const nonEconomicDamages = economicDamages * multiplier;
    const totalCaseValue = economicDamages + nonEconomicDamages;
    const comparativeNegligence = formData.comparativeNegligence || 0;
    const adjustedCaseValue = totalCaseValue * (1 - comparativeNegligence / 100);

    this.calculatedValue = {
      medicalExpenses,
      lostWages,
      futureMedical,
      economicDamages,
      multiplier,
      nonEconomicDamages,
      totalCaseValue,
      comparativeNegligence,
      adjustedCaseValue
    };

    // Update latest case value
    this.latestCaseValue = adjustedCaseValue;
    localStorage.setItem('pi_latest_case_value', adjustedCaseValue.toString());

    // Add to activity
    this.addActivity('case-value', `${this.formatCompactCurrency(adjustedCaseValue)} Case Value`);

    // Create chart
    setTimeout(() => this.createDamageChart(), 100);

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

    // Call AI for detailed analysis
    this.http.post<any>(`${environment.apiUrl}/api/ai/personal-injury/analyze-case-value`, {
      ...formData,
      calculatedValue: this.calculatedValue,
      caseContext
    }).subscribe({
      next: (response) => {
        if (response.success && response.analysis) {
          const contextInfo = {
            'Injury Type': this.injuryTypes.find(i => i.value === formData.injuryType)?.label || formData.injuryType,
            'Medical Expenses': `$${medicalExpenses.toLocaleString()}`,
            'Lost Wages': `$${lostWages.toLocaleString()}`,
            'Future Medical': `$${futureMedical.toLocaleString()}`,
            'Multiplier': `${multiplier}x`,
            'Estimated Case Value': `$${adjustedCaseValue.toLocaleString()}`
          };
          this.aiModalService.openCaseValueAnalysis(response.analysis, contextInfo);
        }
        this.isCalculating = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isCalculating = false;
        this.cdr.detectChanges();
      }
    });
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

  setDemandMode(mode: 'express' | 'detailed'): void {
    this.demandMode = mode;
  }

  calculateDemandTotal(): number {
    const medical = this.demandForm.get('medicalExpenses')?.value || 0;
    const wages = this.demandForm.get('lostWages')?.value || 0;
    const future = this.demandForm.get('futureMedical')?.value || 0;
    const multiplier = this.demandForm.get('painSufferingMultiplier')?.value || 2.5;
    const economic = medical + wages + future;
    const nonEconomic = economic * multiplier;
    return economic + nonEconomic;
  }

  generateDemandLetter(): void {
    if (this.demandForm.invalid) {
      this.markFormGroupTouched(this.demandForm);
      return;
    }

    this.isGeneratingDemand = true;
    const formData = this.demandForm.value;
    const totalDemand = this.calculateDemandTotal();

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
      mode: this.demandMode,
      painSufferingAmount: (formData.medicalExpenses + formData.lostWages + formData.futureMedical) * formData.painSufferingMultiplier,
      caseContext
    };

    this.http.post<any>(`${environment.apiUrl}/api/ai/personal-injury/generate-demand-letter`, requestData)
      .subscribe({
        next: (response) => {
          if (response.success && response.demandLetter) {
            this.generatedDemand = response.demandLetter;

            // Add to activity
            this.addActivity('demand-letter', `${formData.clientName} v. ${formData.defendantName}`);

            const contextInfo = {
              'Client': formData.clientName,
              'Defendant': formData.defendantName,
              'Insurance Company': formData.insuranceCompany,
              'Accident Date': formData.accidentDate,
              'Total Demand': `$${totalDemand.toLocaleString()}`
            };
            this.aiModalService.openDemandLetter(response.demandLetter, contextInfo);
          } else {
            this.generatedDemand = 'Error generating demand letter. Please try again.';
          }
          this.isGeneratingDemand = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error generating demand letter:', error);
          this.generatedDemand = 'Error connecting to AI service. Please try again later.';
          this.isGeneratingDemand = false;
          this.cdr.detectChanges();
        }
      });
  }

  exportDemandLetter(): void {
    // TODO: Implement export functionality
    Swal.fire({
      icon: 'info',
      title: 'Export',
      text: 'Export functionality coming soon!',
      customClass: { confirmButton: 'btn btn-primary' }
    });
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
          recordType: (document.getElementById('swal-record-type') as HTMLSelectElement)?.value || 'FOLLOW_UP'
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
      recordType: data.recordType
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

    Swal.fire({
      title: record.providerName,
      html: `
        <div class="text-start">
          <div class="d-flex align-items-center gap-2 mb-3">
            <span class="badge bg-primary-subtle text-primary">${this.getRecordTypeLabel(record.recordType)}</span>
            <span class="badge bg-info-subtle text-info">${this.getProviderTypeLabel(record.providerType)}</span>
            ${hasCitations ? '<span class="badge bg-success-subtle text-success"><i class="ri-link me-1"></i>Has Citations</span>' : ''}
          </div>

          <div class="row g-3 mb-3">
            <div class="col-6">
              <div class="text-muted small">Treatment Date</div>
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
              <div class="text-muted small">Billed</div>
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

          ${record.keyFindings ? `
          <div class="mb-3">
            <div class="text-muted small mb-1">Key Findings</div>
            <div class="p-2 bg-light rounded small">${record.keyFindings}</div>
          </div>
          ` : ''}

          ${record.treatmentProvided ? `
          <div class="mb-3">
            <div class="text-muted small mb-1">Treatment Provided</div>
            <div class="p-2 bg-light rounded small">${record.treatmentProvided}</div>
          </div>
          ` : ''}

          ${record.prognosisNotes ? `
          <div class="mb-3">
            <div class="text-muted small mb-1">Prognosis</div>
            <div class="p-2 bg-light rounded small">${record.prognosisNotes}</div>
          </div>
          ` : ''}
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '<i class="ri-edit-line me-1"></i> Edit',
      cancelButtonText: 'Close',
      showDenyButton: hasCitations,
      denyButtonText: '<i class="ri-link me-1"></i> View Sources',
      customClass: {
        confirmButton: 'btn btn-primary me-2',
        denyButton: 'btn btn-soft-info me-2',
        cancelButton: 'btn btn-secondary'
      },
      buttonsStyling: false,
      width: 550
    }).then((result) => {
      if (result.isConfirmed) {
        this.editMedicalRecord(record);
        this.openEditRecordModal();
      } else if (result.isDenied && hasCitations) {
        // Open citation viewer for first available citation
        const firstField = Object.keys(record.citationMetadata || {})[0];
        if (firstField) {
          this.openCitation(record, firstField);
        }
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
          prognosisNotes: (document.getElementById('swal-edit-prognosis') as HTMLTextAreaElement).value
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

  addSettlementEvent(): void {
    if (this.settlementForm.invalid) {
      return;
    }

    const event = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      ...this.settlementForm.value
    };

    this.settlementHistory.push(event);
    localStorage.setItem('pi_settlement_history', JSON.stringify(this.settlementHistory));

    // Add to activity
    this.addActivity('settlement', `${this.formatCompactCurrency(this.settlementForm.value.demandAmount)} Settlement Event`);

    // Reset form
    this.settlementForm.reset();
  }

  confirmClearHistory(): void {
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
    this.settlementHistory = [];
    localStorage.removeItem('pi_settlement_history');
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
    this.linkedCase = caseItem;
    this.caseSearchInput = '';
    this.searchResults = [];
    this.showCaseDropdown = false;
    this.workspaceState.setLinkedCase(Number(caseItem.id));

    // Load full case details and prefill forms
    this.loadCaseData(caseItem.id);
  }

  unlinkCase(): void {
    this.linkedCase = null;
    this.prefilledFromCase = false;
    this.workspaceState.setLinkedCase(null);
    Swal.fire({
      icon: 'info',
      title: 'Case Unlinked',
      text: 'The case has been unlinked. Form data is preserved.',
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
          this.loadDocumentChecklist();
          this.loadDamageElements();
          this.loadMedicalSummary();

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

  prefillFormsFromCase(caseData: LegalCase): void {
    // Pre-fill Case Value Calculator form
    this.caseValueForm.patchValue({
      injuryType: caseData.injuryType || 'soft_tissue',
      injuryDescription: caseData.injuryDescription || '',
      medicalExpenses: caseData.medicalExpensesTotal || 0,
      lostWages: caseData.lostWages || 0,
      futureMedical: caseData.futureMedicalEstimate || 0,
      customMultiplier: caseData.painSufferingMultiplier || null,
      liabilityAssessment: caseData.liabilityAssessment || 'CLEAR',
      comparativeNegligence: caseData.comparativeNegligencePercent || 0
    });

    // Pre-fill Demand Letter form
    this.demandForm.patchValue({
      clientName: caseData.clientName || '',
      defendantName: caseData.defendantName || '',
      insuranceCompany: caseData.insuranceCompany || '',
      adjusterName: caseData.insuranceAdjusterName || '',
      accidentDate: caseData.injuryDate ? this.formatDateForInput(caseData.injuryDate) : '',
      accidentLocation: caseData.accidentLocation || '',
      injuryType: caseData.injuryType || '',
      injuryDescription: caseData.injuryDescription || '',
      medicalExpenses: caseData.medicalExpensesTotal || 0,
      lostWages: caseData.lostWages || 0,
      futureMedical: caseData.futureMedicalEstimate || 0,
      policyLimit: caseData.insurancePolicyLimit || null,
      painSufferingMultiplier: caseData.painSufferingMultiplier || 2.5
    });

    // Pre-fill Settlement form
    this.settlementForm.patchValue({
      demandAmount: caseData.settlementDemandAmount || 0,
      offerAmount: caseData.settlementOfferAmount || 0
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
        console.log('Could not parse medical providers from case');
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

    this.caseService.updateCase(String(this.linkedCase.id), updateData).subscribe({
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

    this.caseService.updateCase(String(this.linkedCase.id), updateData).subscribe({
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

    this.caseService.updateCase(String(this.linkedCase.id), updateData).subscribe({
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

    this.caseService.updateCase(String(this.linkedCase.id), updateData).subscribe({
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
    if (!this.linkedCase) return this.latestCaseValue;
    const medical = this.linkedCase.medicalExpensesTotal || 0;
    const wages = this.linkedCase.lostWages || 0;
    const future = this.linkedCase.futureMedicalEstimate || 0;
    const multiplier = this.linkedCase.painSufferingMultiplier || 2;
    const economic = medical + wages + future;
    const total = economic + (economic * multiplier);
    const negligence = this.linkedCase.comparativeNegligencePercent || 0;
    return total * (1 - negligence / 100);
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
    this.medicalRecordService.getRecordsByCaseId(Number(this.linkedCase.id)).subscribe({
      next: (records) => {
        this.medicalRecords = records;
        this.isLoadingMedicalRecords = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading medical records:', err);
        this.isLoadingMedicalRecords = false;
        this.cdr.detectChanges();
      }
    });
  }

  scanCaseDocuments(): void {
    if (!this.linkedCase?.id) return;

    this.isScanningDocuments = true;
    this.scanResult = null;

    Swal.fire({
      title: 'Scanning Documents',
      html: 'Analyzing case documents with AI...<br><small>This may take a minute.</small>',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.medicalRecordService.scanCaseDocuments(Number(this.linkedCase.id)).subscribe({
      next: (result) => {
        this.scanResult = result;
        this.isScanningDocuments = false;
        this.loadMedicalRecords(); // Refresh the records list
        this.cdr.detectChanges();

        Swal.fire({
          icon: result.recordsCreated > 0 ? 'success' : 'info',
          title: 'Scan Complete',
          html: `
            <div class="text-start">
              <p><strong>Documents Scanned:</strong> ${result.documentsScanned}</p>
              <p><strong>Records Created:</strong> ${result.recordsCreated}</p>
              ${result.errors?.length > 0 ? `<p class="text-warning"><strong>Errors:</strong> ${result.errors.length}</p>` : ''}
            </div>
            ${result.recordsCreated > 0 ? '<p class="text-success mt-2">Medical records have been auto-populated from your documents.</p>' : '<p class="text-muted mt-2">No new medical documents found to process.</p>'}
          `,
          confirmButtonText: 'View Records'
        }).then(() => {
          // Navigate to Medical Records tab to show the auto-populated records
          this.activeTab = 'medical-records';
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        console.error('Error scanning documents:', err);
        this.isScanningDocuments = false;
        this.cdr.detectChanges();

        Swal.fire({
          icon: 'error',
          title: 'Scan Failed',
          text: err.error?.message || 'Failed to scan documents. Please try again.',
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

    this.medicalSummaryService.getMedicalSummary(Number(this.linkedCase.id)).subscribe({
      next: (result) => {
        this.medicalSummary = result.summary;
        this.summaryExists = result.exists;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading medical summary:', err);
      }
    });
  }

  generateMedicalSummary(): void {
    if (!this.linkedCase?.id) return;

    this.isGeneratingSummary = true;
    this.medicalSummaryService.generateMedicalSummary(Number(this.linkedCase.id)).subscribe({
      next: (summary) => {
        this.medicalSummary = summary;
        this.summaryExists = true;
        this.isGeneratingSummary = false;
        this.cdr.detectChanges();
        Swal.fire({
          icon: 'success',
          title: 'Summary Generated',
          text: `Completeness Score: ${summary.completenessScore}%`,
          timer: 3000,
          showConfirmButton: false
        });
      },
      error: (err) => {
        console.error('Error generating summary:', err);
        this.isGeneratingSummary = false;
        this.cdr.detectChanges();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.error?.message || 'Failed to generate medical summary. Make sure you have medical records entered.'
        });
      }
    });
  }

  // --- Document Checklist ---

  loadDocumentChecklist(): void {
    if (!this.linkedCase?.id) return;

    this.isLoadingChecklist = true;
    this.documentChecklistService.getChecklistByCaseId(Number(this.linkedCase.id)).subscribe({
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
        this.documentChecklist = checklist;
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

  loadDocumentCompleteness(): void {
    if (!this.linkedCase?.id) return;

    this.documentChecklistService.getCompletenessScore(Number(this.linkedCase.id)).subscribe({
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

    const previousStatus = item.status;
    const previousReceived = item.received;

    // Update local state immediately for responsive UI - create new array reference
    this.documentChecklist = this.documentChecklist.map(d => {
      if (d.id === item.id) {
        return {
          ...d,
          status: 'RECEIVED',
          received: true,
          receivedDate: new Date().toISOString().split('T')[0]
        };
      }
      return d;
    });
    this.updateGroupedDocuments();
    this.cdr.detectChanges();

    this.documentChecklistService.markAsReceived(Number(this.linkedCase.id), item.id).subscribe({
      next: () => {
        this.loadDocumentCompleteness();
        Swal.fire({
          icon: 'success',
          title: 'Document Received',
          timer: 1500,
          showConfirmButton: false
        });
      },
      error: (err) => {
        console.error('Error marking received:', err);
        // Revert on error - create new array reference
        this.documentChecklist = this.documentChecklist.map(d => {
          if (d.id === item.id) {
            return { ...d, status: previousStatus, received: previousReceived };
          }
          return d;
        });
        this.updateGroupedDocuments();
        this.cdr.detectChanges();
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

    const previousStatus = item.status;
    const previousReceived = item.received;
    const isNowReceived = newStatus === 'RECEIVED';

    // Update local state immediately - create new array reference
    this.documentChecklist = this.documentChecklist.map(d => {
      if (d.id === item.id) {
        return {
          ...d,
          status: newStatus,
          received: isNowReceived,
          receivedDate: isNowReceived ? new Date().toISOString().split('T')[0] : d.receivedDate
        };
      }
      return d;
    });
    this.updateGroupedDocuments();
    this.cdr.detectChanges();

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
        this.loadDocumentCompleteness();
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
        // Revert on error - create new array reference
        this.documentChecklist = this.documentChecklist.map(d => {
          if (d.id === item.id) {
            return { ...d, status: previousStatus, received: previousReceived };
          }
          return d;
        });
        this.updateGroupedDocuments();
        this.cdr.detectChanges();
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

  loadDamageElements(): void {
    if (!this.linkedCase?.id) return;

    this.isLoadingDamages = true;
    this.damageCalculationService.getDamageElements(Number(this.linkedCase.id)).subscribe({
      next: (elements) => {
        this.damageElements = elements;
        this.isLoadingDamages = false;
        this.loadDamageCalculation();
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

    this.damageCalculationService.getDamageCalculation(Number(this.linkedCase.id)).subscribe({
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
        this.cdr.detectChanges();

        // Show AI analysis in modal if available
        if (calculation.comparableAnalysis?.success && calculation.comparableAnalysis.analysis) {
          this.aiModalService.openCaseValueAnalysis(
            calculation.comparableAnalysis.analysis,
            {
              'Total Damages': this.formatCurrency(calculation.adjustedDamagesTotal || 0),
              'Economic': this.formatCurrency(calculation.economicDamagesTotal || 0),
              'Non-Economic': this.formatCurrency(calculation.nonEconomicDamagesTotal || 0),
              'Value Range': `${this.formatCurrency(calculation.lowValue || 0)} - ${this.formatCurrency(calculation.highValue || 0)}`
            }
          );
        }
      },
      error: (err) => {
        console.error('Error calculating damages:', err);
        this.isCalculatingDamages = false;
        this.cdr.detectChanges();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to calculate damages'
        });
      }
    });
  }

  syncMedicalExpenses(): void {
    if (!this.linkedCase?.id) return;

    this.damageCalculationService.syncMedicalExpenses(Number(this.linkedCase.id)).subscribe({
      next: () => {
        this.loadDamageElements();
        Swal.fire({
          icon: 'success',
          title: 'Medical Expenses Synced',
          text: 'Past medical expenses updated from medical records',
          timer: 2500,
          showConfirmButton: false
        });
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
   * TrackBy function for document checklist to prevent unnecessary re-renders
   */
  trackByDocId(index: number, item: PIDocumentChecklist): number {
    return item.id || index;
  }

  /**
   * TrackBy function for groups
   */
  trackByGroupType(index: number, group: { type: string }): string {
    return group.type;
  }

  /**
   * Update the cached grouped documents - call this when documentChecklist changes
   */
  updateGroupedDocuments(): void {
    const groups: { [key: string]: PIDocumentChecklist[] } = {};

    // Group by document type
    this.documentChecklist.forEach(item => {
      const type = item.documentType || 'OTHER';
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(item);
    });

    // Define order of groups
    const typeOrder = ['POLICE_REPORT', 'MEDICAL_RECORDS', 'MEDICAL_BILLS', 'INSURANCE', 'WAGE_DOCUMENTATION', 'PHOTOGRAPHS', 'WITNESS', 'EXPERT', 'OTHER'];

    // Convert to array and sort by predefined order
    this.groupedDocuments = typeOrder
      .filter(type => groups[type] && groups[type].length > 0)
      .map(type => ({
        type,
        label: this.getDocumentTypeLabel(type),
        icon: this.getDocumentTypeIcon(type),
        items: groups[type].sort((a, b) => (a.id || 0) - (b.id || 0)),
        receivedCount: groups[type].filter(i => i.status === 'RECEIVED').length,
        totalCount: groups[type].length
      }));
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
  // Sample Data Loaders
  // ==========================================

  loadCaseValueSample(): void {
    this.caseValueForm.patchValue({
      injuryType: 'disc_injury',
      injuryDescription: 'L4-L5 disc herniation with radiculopathy following rear-end motor vehicle collision. Client underwent 6 months of physical therapy and received epidural steroid injections. Ongoing pain affecting daily activities and work capacity.',
      medicalExpenses: 45000,
      lostWages: 18000,
      futureMedical: 25000,
      liabilityAssessment: 'CLEAR',
      comparativeNegligence: 0
    });
  }

  loadDemandSample(): void {
    this.demandForm.patchValue({
      clientName: 'John Smith',
      defendantName: 'Jane Doe',
      insuranceCompany: 'ABC Insurance Company',
      adjusterName: 'Michael Johnson',
      claimNumber: 'CLM-2024-123456',
      accidentDate: '2024-06-15',
      accidentLocation: 'Intersection of Main Street and Oak Avenue, Boston, MA',
      injuryType: 'disc_injury',
      injuryDescription: 'L4-L5 disc herniation with radiculopathy. Client experienced immediate neck and back pain following the collision. MRI confirmed disc herniation at L4-L5 level with nerve root impingement.',
      liabilityDetails: 'Defendant failed to stop at red light and struck client vehicle from behind while client was lawfully stopped. Police report confirms defendant at fault. No contributing factors from client.',
      medicalExpenses: 45000,
      lostWages: 18000,
      futureMedical: 25000,
      policyLimit: 100000,
      painSufferingMultiplier: 3.0
    });

    // Also load sample medical providers
    this.medicalProviders = [
      {
        id: '1',
        name: 'Boston Medical Center ER',
        specialty: 'Emergency Medicine',
        treatmentDates: '2024-06-15',
        totalBills: 8500
      },
      {
        id: '2',
        name: 'Dr. Sarah Wilson',
        specialty: 'Orthopedics',
        treatmentDates: '2024-06-20 - 2024-12-15',
        totalBills: 12000
      },
      {
        id: '3',
        name: 'Boston Physical Therapy',
        specialty: 'Physical Therapy',
        treatmentDates: '2024-07-01 - 2024-12-31',
        totalBills: 18000
      },
      {
        id: '4',
        name: 'Advanced Imaging Center',
        specialty: 'Radiology',
        treatmentDates: '2024-06-18, 2024-09-15',
        totalBills: 6500
      }
    ];
    localStorage.setItem('pi_medical_providers', JSON.stringify(this.medicalProviders));
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
