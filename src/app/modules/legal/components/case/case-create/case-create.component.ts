import { Component, OnInit, AfterViewInit, ElementRef, ViewChildren, QueryList, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CaseStatus, CasePriority } from '../../../models/case.model';
import { PaymentStatus } from '../../../interfaces/case.interface';
import { FlatpickrModule } from 'angularx-flatpickr';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import flatpickr from 'flatpickr';
import { CaseService } from '../../../services/case.service';
import { UserService } from '../../../../../service/user.service';
import { OrganizationService } from '../../../../../core/services/organization.service';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { PRACTICE_AREA_FIELDS, PracticeAreaSection, PracticeAreaField, groupPracticeAreaSections } from '../../../shared/practice-area-fields.config';
import { PRACTICE_AREAS, JURISDICTIONS } from '../../../shared/legal-constants';
import Swal from 'sweetalert2';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';

@Component({
  selector: 'app-case-create',
  templateUrl: './case-create.component.html',
  styleUrls: ['./case-create.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    FlatpickrModule
  ]
})
export class CaseCreateComponent implements OnInit, AfterViewInit, OnDestroy {
  private destroy$ = new Subject<void>();

  caseForm: FormGroup;
  isLoading = false;
  errorMessage = '';

  // Step wizard
  currentStep = 1;
  steps = [
    { number: 1, label: 'Client', icon: 'ri-user-line' },
    { number: 2, label: 'Case Details', icon: 'ri-folder-line' },
    { number: 3, label: 'Court & Dates', icon: 'ri-scales-3-line' },
    { number: 4, label: 'Review', icon: 'ri-check-double-line' }
  ];

  // Client search & selection
  clientCheckStatus: 'idle' | 'checking' | 'found' | 'new' = 'idle';
  existingClientName = '';
  clientSearchQuery = '';
  clientSearchResults: any[] = [];
  showClientResults = false;
  selectedClientId: number | null = null;
  clientMode: 'search' | 'new' | 'selected' = 'search';
  duplicateEmailClient: any = null;

  // Attorneys for dropdown
  attorneys: any[] = [];

  // Enums for template
  CaseStatus = CaseStatus;
  CasePriority = CasePriority;
  PaymentStatus = PaymentStatus;

  // Single source of truth — see src/app/modules/legal/shared/legal-constants.ts
  practiceAreas = PRACTICE_AREAS.map(p => p.name);

  currentPracticeAreaSections: PracticeAreaSection[] = [];
  practiceAreaFieldsConfig = PRACTICE_AREA_FIELDS;
  private practiceAreaDatePickers: any[] = [];

  // Rows of paired sections — pairGroup-tagged sections render side-by-side in a Bootstrap row.
  get practiceAreaSectionRows(): PracticeAreaSection[][] {
    return groupPracticeAreaSections(this.currentPracticeAreaSections);
  }

  billingTypes = [
    { value: 'HOURLY', label: 'Hourly' },
    { value: 'FLAT_FEE', label: 'Flat Fee' },
    { value: 'CONTINGENCY', label: 'Contingency' },
    { value: 'PRO_BONO', label: 'Pro Bono' },
    { value: 'HYBRID', label: 'Hybrid' }
  ];

  // Single source of truth — see src/app/modules/legal/shared/legal-constants.ts
  usJurisdictions = JURISDICTIONS.map(j => j.name);

  private stateCodeToName: Record<string, string> = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'DC': 'District of Columbia',
    'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois',
    'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana',
    'ME': 'Maine', 'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota',
    'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
    'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
    'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon',
    'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota',
    'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia',
    'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
  };

  @ViewChildren('filingDate, nextHearingDate, estimatedCompletionDate, statuteOfLimitationsDate') dateInputs: QueryList<ElementRef>;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private caseService: CaseService,
    private userService: UserService,
    private organizationService: OrganizationService,
    private cdr: ChangeDetectorRef,
    private http: HttpClient
  ) {
    this.caseForm = this.fb.group({
      caseNumber: ['', [Validators.required]],
      title: ['', [Validators.required]],
      status: [CaseStatus.OPEN, [Validators.required]],
      priority: [CasePriority.MEDIUM, [Validators.required]],
      practiceArea: ['', [Validators.required]],
      description: ['', [Validators.required]],
      clientName: ['', [Validators.required]],
      clientEmail: ['', [Validators.email]],
      clientPhone: [''],
      clientAddress: [''],
      leadAttorneyId: [''],
      jurisdiction: [''],
      countyName: [''],
      judgeName: [''],
      courtroom: [''],
      filingDate: [''],
      nextHearingDate: [''],
      estimatedCompletionDate: [''],
      statuteOfLimitationsDate: [''],
      billingType: ['HOURLY', [Validators.required]],
      hourlyRate: [0],
      retainerAmount: [0],
      paymentStatus: [PaymentStatus.PENDING]
    });
  }

  goBackToCases(): void {
    this.router.navigate(['/legal/cases']);
  }

  ngOnInit(): void {
    this.loadAttorneys();
    this.caseForm.patchValue({ caseNumber: this.generateUniqueCaseNumber() });

    // Pre-fill jurisdiction from org state
    const orgId = this.organizationService.getCurrentOrganizationId();
    if (orgId) {
      this.organizationService.getOrganizationById(orgId)
        .pipe(takeUntil(this.destroy$))
        .subscribe(org => {
          if (org?.state && this.stateCodeToName[org.state] && !this.caseForm.value.jurisdiction) {
            this.caseForm.patchValue({ jurisdiction: this.stateCodeToName[org.state] });
          }
        });
    }

    // Subscribe to practice area changes
    this.caseForm.get('practiceArea')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => this.onPracticeAreaChange(value));

    // No auto email check — we use search instead
  }

  // ==================== STEP WIZARD ====================

  getStepState(step: number): 'active' | 'completed' | 'pending' {
    if (step === this.currentStep) return 'active';
    if (step < this.currentStep) return 'completed';
    return 'pending';
  }

  canProceed(): boolean {
    switch (this.currentStep) {
      case 1: return this.isStepValid(1);
      case 2: return this.isStepValid(2);
      case 3: return true; // optional
      case 4: return true;
      default: return true;
    }
  }

  isStepValid(step: number): boolean {
    switch (step) {
      case 1: {
        return this.caseForm.get('clientName')!.valid && !this.duplicateEmailClient;
      }
      case 2: {
        const f = this.caseForm;
        const coreValid = f.get('title')!.valid && f.get('practiceArea')!.valid && f.get('description')!.valid;
        // Check practice area required fields
        let paValid = true;
        this.currentPracticeAreaSections.forEach(s => {
          s.fields.forEach(field => {
            if (field.required && this.caseForm.get(field.name)?.invalid) paValid = false;
          });
        });
        return coreValid && paValid;
      }
      default: return true;
    }
  }

  nextStep(): void {
    // Mark current step's fields as touched for validation display
    if (this.currentStep === 1) {
      ['clientName'].forEach(f => this.caseForm.get(f)?.markAsTouched());
    } else if (this.currentStep === 2) {
      ['title', 'practiceArea', 'description'].forEach(f => this.caseForm.get(f)?.markAsTouched());
      this.currentPracticeAreaSections.forEach(s => {
        s.fields.forEach(field => { if (field.required) this.caseForm.get(field.name)?.markAsTouched(); });
      });
    }
    if (!this.canProceed()) return;

    if (this.currentStep < 4) {
      this.currentStep++;
      this.cdr.markForCheck();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (this.currentStep === 3) {
        setTimeout(() => this.initDatePickers(), 100);
      }
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.cdr.markForCheck();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (this.currentStep === 2) {
        setTimeout(() => this.initPracticeAreaDatePickers(), 100);
      }
    }
  }

  goToStep(step: number): void {
    if (step < this.currentStep) {
      this.currentStep = step;
      this.cdr.markForCheck();
    }
  }

  // ==================== CLIENT EMAIL CHECK ====================

  searchClients(query: string): void {
    this.clientSearchQuery = query;
    if (!query || query.length < 2) {
      this.clientSearchResults = [];
      this.showClientResults = false;
      return;
    }
    this.http.get<any>(`${environment.apiUrl}/client/search-quick?q=${encodeURIComponent(query)}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.clientSearchResults = response?.data?.clients || [];
          this.showClientResults = this.clientSearchResults.length > 0;
          this.cdr.markForCheck();
        },
        error: () => {
          this.clientSearchResults = [];
          this.showClientResults = false;
        }
      });
  }

  selectClient(client: any): void {
    this.selectedClientId = client.id;
    this.existingClientName = client.name;
    this.clientMode = 'selected';
    this.showClientResults = false;
    this.caseForm.patchValue({
      clientName: client.name,
      clientEmail: client.email || '',
      clientPhone: client.phone || '',
      clientAddress: client.address || ''
    });
    this.cdr.markForCheck();
  }

  switchToNewClient(): void {
    this.clientMode = 'new';
    this.selectedClientId = null;
    this.existingClientName = '';
    this.showClientResults = false;
    this.clientSearchQuery = '';
    this.duplicateEmailClient = null;
    this.caseForm.patchValue({ clientName: '', clientEmail: '', clientPhone: '', clientAddress: '' });
    this.cdr.markForCheck();
  }

  checkDuplicateEmail(): void {
    const email = this.caseForm.get('clientEmail')?.value?.trim();
    this.duplicateEmailClient = null;
    if (!email || email.length < 3) return;

    this.http.get<any>(`${environment.apiUrl}/client/search-quick?q=${encodeURIComponent(email)}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const clients = response?.data?.clients || [];
          const match = clients.find((c: any) => c.email?.toLowerCase() === email.toLowerCase());
          if (match) {
            this.duplicateEmailClient = match;
          }
          this.cdr.markForCheck();
        }
      });
  }

  linkDuplicateClient(): void {
    if (this.duplicateEmailClient) {
      this.selectClient(this.duplicateEmailClient);
      this.duplicateEmailClient = null;
    }
  }

  clearSelectedClient(): void {
    this.clientMode = 'search';
    this.selectedClientId = null;
    this.existingClientName = '';
    this.clientSearchQuery = '';
    this.caseForm.patchValue({ clientName: '', clientEmail: '', clientPhone: '', clientAddress: '' });
    this.cdr.markForCheck();
  }

  // ==================== PRACTICE AREA ====================

  onPracticeAreaChange(practiceArea: string): void {
    this.practiceAreaDatePickers.forEach(picker => picker.destroy());
    this.practiceAreaDatePickers = [];
    const allFieldNames = this.getAllPracticeAreaFieldNames();
    allFieldNames.forEach(fieldName => {
      if (this.caseForm.contains(fieldName)) this.caseForm.removeControl(fieldName);
    });
    this.currentPracticeAreaSections = this.practiceAreaFieldsConfig[practiceArea] || [];
    this.currentPracticeAreaSections.forEach(section => {
      section.fields.forEach(field => {
        const validators = field.required ? [Validators.required] : [];
        let defaultValue: any = '';
        if (field.type === 'checkbox') defaultValue = false;
        else if (field.type === 'number' || field.type === 'currency') defaultValue = null;
        this.caseForm.addControl(field.name, this.fb.control(defaultValue, validators));
      });
    });
    setTimeout(() => this.initPracticeAreaDatePickers(), 0);
  }

  private getAllPracticeAreaFieldNames(): string[] {
    const fieldNames: string[] = [];
    Object.values(this.practiceAreaFieldsConfig).forEach(sections => {
      sections.forEach(section => {
        section.fields.forEach(field => {
          if (!fieldNames.includes(field.name)) fieldNames.push(field.name);
        });
      });
    });
    return fieldNames;
  }

  // Date fields that represent past events — cannot be in the future
  private pastDateFields = new Set(['injuryDate', 'arrestDate', 'marriageDate', 'filingDate', 'ipFilingDate']);

  private initPracticeAreaDatePickers(): void {
    this.currentPracticeAreaSections.forEach(section => {
      section.fields.forEach(field => {
        if (field.type === 'date') {
          const element = document.getElementById(`pa_${field.name}`);
          if (element) {
            const opts: any = { dateFormat: 'Y-m-d', altInput: true, altFormat: 'F j, Y', allowInput: true };
            if (this.pastDateFields.has(field.name)) {
              opts.maxDate = 'today';
            }
            const picker = flatpickr(element, opts);
            this.practiceAreaDatePickers.push(picker);
          }
        }
      });
    });
  }

  private initDatePickers(): void {
    ['filingDate', 'nextHearingDate', 'estimatedCompletionDate', 'statuteOfLimitationsDate'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !(el as any)._flatpickr) {
        const opts: any = { dateFormat: 'Y-m-d', altInput: true, altFormat: 'F j, Y', allowInput: true };
        if (this.pastDateFields.has(id)) {
          opts.maxDate = 'today';
        }
        flatpickr(el, opts);
      }
    });
  }

  // ==================== HELPERS ====================

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.practiceAreaDatePickers.forEach(picker => picker.destroy());
  }

  loadAttorneys(): void {
    this.userService.getAttorneys()
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (a) => { this.attorneys = a; }, error: (e) => console.error('Error loading attorneys:', e) });
  }

  generateUniqueCaseNumber(): string {
    const now = new Date();
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let rand = '';
    for (let i = 0; i < 5; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
    return `CASE-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${rand}`;
  }

  ngAfterViewInit(): void {
    // Date pickers initialized when entering step 3
  }

  getSelectedPracticeArea(): string {
    return this.caseForm.get('practiceArea')?.value || '';
  }

  getSelectedBillingType(): string {
    return this.billingTypes.find(b => b.value === this.caseForm.get('billingType')?.value)?.label || '';
  }

  getLeadAttorneyName(): string {
    const id = this.caseForm.get('leadAttorneyId')?.value;
    const a = this.attorneys.find(att => att.id == id);
    return a ? `${a.firstName} ${a.lastName}` : 'Not assigned';
  }

  // ==================== SUBMIT ====================

  onSubmit(): void {
    if (this.caseForm.invalid) {
      this.caseForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const phoneNumber = this.caseForm.value.clientPhone?.replace(/\D/g, '') || '';
    const formatDate = (date: any): string | null => {
      if (!date) return null;
      if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const caseData: any = {
      caseNumber: this.caseForm.value.caseNumber,
      title: this.caseForm.value.title,
      clientName: this.caseForm.value.clientName,
      clientEmail: this.caseForm.value.clientEmail,
      clientPhone: phoneNumber,
      clientAddress: this.caseForm.value.clientAddress || '',
      clientId: this.selectedClientId || null,
      status: this.caseForm.value.status,
      priority: this.caseForm.value.priority,
      practiceArea: this.caseForm.value.practiceArea,
      description: this.caseForm.value.description,
      leadAttorneyId: this.caseForm.value.leadAttorneyId || null,
      jurisdiction: this.caseForm.value.jurisdiction || '',
      countyName: this.caseForm.value.countyName || '',
      judgeName: this.caseForm.value.judgeName || '',
      courtroom: this.caseForm.value.courtroom || '',
      filingDate: formatDate(this.caseForm.value.filingDate),
      nextHearing: formatDate(this.caseForm.value.nextHearingDate),
      trialDate: formatDate(this.caseForm.value.estimatedCompletionDate),
      statuteOfLimitationsDate: formatDate(this.caseForm.value.statuteOfLimitationsDate),
      billingType: this.caseForm.value.billingType,
      hourlyRate: parseFloat(this.caseForm.value.hourlyRate) || 0,
      retainerAmount: parseFloat(this.caseForm.value.retainerAmount) || 0,
      totalHours: 0, totalAmount: 0,
      paymentStatus: this.caseForm.value.paymentStatus
    };

    // Add practice area specific fields
    this.currentPracticeAreaSections.forEach(section => {
      section.fields.forEach(field => {
        const value = this.caseForm.value[field.name];
        if (value !== null && value !== undefined && value !== '') {
          if (field.type === 'date') caseData[field.name] = formatDate(value);
          else if (field.type === 'currency' || field.type === 'number') caseData[field.name] = parseFloat(value) || null;
          else caseData[field.name] = value;
        } else {
          caseData[field.name] = null;
        }
      });
    });

    this.caseService.createCase(caseData).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        const createdCase = response?.data?.case || response?.case || {};
        const clientAction = createdCase.clientAction;
        const clientMsg = clientAction === 'CREATED'
          ? `<p class="mt-2 text-muted">New client <strong>${this.caseForm.value.clientName}</strong> was created and linked.</p>`
          : clientAction === 'LINKED'
          ? `<p class="mt-2 text-muted">Linked to existing client <strong>${this.existingClientName || this.caseForm.value.clientName}</strong>.</p>`
          : '';

        Swal.fire({
          icon: 'success',
          title: 'Case Created',
          html: `<p>Case <strong>${caseData.caseNumber}</strong> has been created successfully.</p>${clientMsg}`,
          confirmButtonColor: '#405189',
          confirmButtonText: 'View Case'
        }).then(() => {
          const caseId = createdCase.id;
          this.router.navigate(caseId ? ['/legal/cases', caseId] : ['/legal/cases']);
        });
      },
      error: (error) => {
        this.isLoading = false;
        let errorMsg = error?.error?.message || error?.error?.reason || error?.message || 'Unknown error';
        this.errorMessage = 'Failed to create case: ' + errorMsg;
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/legal/cases']);
  }

  hasError(field: string): boolean {
    const control = this.caseForm.get(field);
    return control ? (control.invalid && (control.dirty || control.touched)) : false;
  }

  getErrorMessage(field: string): string {
    const control = this.caseForm.get(field);
    if (!control) return '';
    if (control.hasError('required')) return 'This field is required';
    if (control.hasError('email')) return 'Please enter a valid email address';
    return '';
  }
}
