import { Component, OnInit, AfterViewInit, ElementRef, ViewChildren, QueryList, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CaseStatus, CasePriority } from '../../../models/case.model';
import { PaymentStatus } from '../../../interfaces/case.interface';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { FlatpickrModule } from 'angularx-flatpickr';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import flatpickr from 'flatpickr';
import { CaseService } from '../../../services/case.service';
import { UserService } from '../../../../../service/user.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PRACTICE_AREA_FIELDS, PracticeAreaSection, PracticeAreaField } from '../../../shared/practice-area-fields.config';

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

  // Attorneys for dropdown
  attorneys: any[] = [];

  // Enums for template
  CaseStatus = CaseStatus;
  CasePriority = CasePriority;
  PaymentStatus = PaymentStatus;

  // Case types array for dropdown
  caseTypes = ['CIVIL', 'CRIMINAL', 'FAMILY', 'BUSINESS', 'REAL_ESTATE', 'IMMIGRATION', 'INTELLECTUAL_PROPERTY', 'OTHER'];

  // Practice areas array for dropdown (only areas with specific fields)
  practiceAreas = [
    'Personal Injury',
    'Criminal Defense',
    'Family Law',
    'Immigration Law',
    'Real Estate Law',
    'Intellectual Property',
    'Business Law',
    'Estate Planning',
    'Employment Law',
    'Bankruptcy',
    'Civil Litigation',
    'Other'
  ];

  // Practice area specific fields configuration
  currentPracticeAreaSections: PracticeAreaSection[] = [];
  practiceAreaFieldsConfig = PRACTICE_AREA_FIELDS;

  // Flatpickr instances for practice area date fields
  private practiceAreaDatePickers: any[] = [];

  // Billing types array for dropdown
  billingTypes = [
    { value: 'HOURLY', label: 'Hourly' },
    { value: 'FLAT_FEE', label: 'Flat Fee' },
    { value: 'CONTINGENCY', label: 'Contingency' },
    { value: 'PRO_BONO', label: 'Pro Bono' },
    { value: 'HYBRID', label: 'Hybrid' }
  ];

  @ViewChildren('filingDate, nextHearingDate, estimatedCompletionDate, statuteOfLimitationsDate') dateInputs: QueryList<ElementRef>;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private snackBar: MatSnackBar,
    private caseService: CaseService,
    private userService: UserService
  ) {
    this.caseForm = this.fb.group({
      caseNumber: ['', [Validators.required]],
      title: ['', [Validators.required]],
      status: [CaseStatus.OPEN, [Validators.required]],
      priority: [CasePriority.MEDIUM, [Validators.required]],
      type: ['CIVIL', [Validators.required]],
      practiceArea: ['', [Validators.required]],
      description: ['', [Validators.required]],

      // Client Information
      clientName: ['', [Validators.required]],
      clientEmail: ['', [Validators.required, Validators.email]],
      clientPhone: ['', [Validators.required]],
      clientAddress: [''],

      // Assignment
      leadAttorneyId: [''],

      // Court Information (optional at creation)
      countyName: [''],
      judgeName: [''],
      courtroom: [''],

      // Important Dates
      filingDate: ['', [Validators.required]],
      nextHearingDate: [''],
      estimatedCompletionDate: [''],
      statuteOfLimitationsDate: [''],

      // Billing Information
      billingType: ['HOURLY', [Validators.required]],
      hourlyRate: [0],
      retainerAmount: [0],
      paymentStatus: [PaymentStatus.PENDING]
    });
  }

  ngOnInit(): void {
    this.loadAttorneys();

    // Set default dates
    const today = new Date();

    // Generate a unique case number
    const uniqueCaseNumber = this.generateUniqueCaseNumber();

    this.caseForm.patchValue({
      caseNumber: uniqueCaseNumber,
      filingDate: today
    });

    // Subscribe to practice area changes
    this.caseForm.get('practiceArea')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        this.onPracticeAreaChange(value);
      });
  }

  onPracticeAreaChange(practiceArea: string): void {
    // Destroy existing practice area date pickers
    this.practiceAreaDatePickers.forEach(picker => picker.destroy());
    this.practiceAreaDatePickers = [];

    // Remove old practice area form controls
    const allFieldNames = this.getAllPracticeAreaFieldNames();
    allFieldNames.forEach(fieldName => {
      if (this.caseForm.contains(fieldName)) {
        this.caseForm.removeControl(fieldName);
      }
    });

    // Get the new practice area configuration
    this.currentPracticeAreaSections = this.practiceAreaFieldsConfig[practiceArea] || [];

    // Add new form controls for the selected practice area
    this.currentPracticeAreaSections.forEach(section => {
      section.fields.forEach(field => {
        const validators = field.required ? [Validators.required] : [];
        let defaultValue: any = '';
        if (field.type === 'checkbox') {
          defaultValue = false;
        } else if (field.type === 'number' || field.type === 'currency') {
          defaultValue = null;
        }
        this.caseForm.addControl(field.name, this.fb.control(defaultValue, validators));
      });
    });

    // Initialize date pickers for practice area date fields after view updates
    setTimeout(() => this.initPracticeAreaDatePickers(), 0);
  }

  private getAllPracticeAreaFieldNames(): string[] {
    const fieldNames: string[] = [];
    Object.values(this.practiceAreaFieldsConfig).forEach(sections => {
      sections.forEach(section => {
        section.fields.forEach(field => {
          if (!fieldNames.includes(field.name)) {
            fieldNames.push(field.name);
          }
        });
      });
    });
    return fieldNames;
  }

  private initPracticeAreaDatePickers(): void {
    this.currentPracticeAreaSections.forEach(section => {
      section.fields.forEach(field => {
        if (field.type === 'date') {
          const element = document.getElementById(`pa_${field.name}`);
          if (element) {
            const picker = flatpickr(element, {
              dateFormat: 'Y-m-d',
              altInput: true,
              altFormat: 'F j, Y',
              allowInput: true
            });
            this.practiceAreaDatePickers.push(picker);
          }
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // Clean up practice area date pickers
    this.practiceAreaDatePickers.forEach(picker => picker.destroy());
  }

  loadAttorneys(): void {
    this.userService.getAttorneys()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (attorneys) => {
          this.attorneys = attorneys;
        },
        error: (error) => {
          console.error('Error loading attorneys:', error);
        }
      });
  }

  /**
   * Generates a unique case number using current date and random values
   * Format: CASE-YYYY-MM-[5 random alphanumeric characters]
   */
  generateUniqueCaseNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    // Generate 5 random alphanumeric characters
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like I, O, 0, 1
    let randomPart = '';
    for (let i = 0; i < 5; i++) {
      randomPart += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return `CASE-${year}-${month}-${randomPart}`;
  }

  ngAfterViewInit(): void {
    // Initialize flatpickr for date inputs
    this.dateInputs.forEach(input => {
      flatpickr(input.nativeElement, {
        dateFormat: 'Y-m-d',
        altInput: true,
        altFormat: 'F j, Y',
        allowInput: true
      });
    });
  }

  onSubmit(): void {
    if (this.caseForm.invalid) {
      this.caseForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    // Format phone number to meet backend validation requirements (digits only)
    const phoneNumber = this.caseForm.value.clientPhone ?
      this.caseForm.value.clientPhone.replace(/\D/g, '') : '';

    // Build date objects only if values exist
    const filingDate = this.caseForm.value.filingDate ? new Date(this.caseForm.value.filingDate) : null;
    const nextHearingDate = this.caseForm.value.nextHearingDate ? new Date(this.caseForm.value.nextHearingDate) : null;
    const estimatedCompletionDate = this.caseForm.value.estimatedCompletionDate ? new Date(this.caseForm.value.estimatedCompletionDate) : null;
    const statuteOfLimitationsDate = this.caseForm.value.statuteOfLimitationsDate ? new Date(this.caseForm.value.statuteOfLimitationsDate) : null;

    // Transform form values to match API expectations - map to LegalCaseDTO
    const caseData: any = {
      caseNumber: this.caseForm.value.caseNumber,
      title: this.caseForm.value.title,
      clientName: this.caseForm.value.clientName,
      clientEmail: this.caseForm.value.clientEmail,
      clientPhone: phoneNumber,
      clientAddress: this.caseForm.value.clientAddress || '',
      status: this.caseForm.value.status,
      priority: this.caseForm.value.priority,
      type: this.caseForm.value.type,
      practiceArea: this.caseForm.value.practiceArea,
      description: this.caseForm.value.description,

      // Lead Attorney Assignment
      leadAttorneyId: this.caseForm.value.leadAttorneyId || null,

      // Court Information (only include if provided)
      courtInfo: this.caseForm.value.countyName ? {
        countyName: this.caseForm.value.countyName,
        judgeName: this.caseForm.value.judgeName || '',
        courtroom: this.caseForm.value.courtroom || ''
      } : null,
      countyName: this.caseForm.value.countyName || '',
      judgeName: this.caseForm.value.judgeName || '',
      courtroom: this.caseForm.value.courtroom || '',

      // Important Dates
      importantDates: {
        filingDate: filingDate,
        nextHearing: nextHearingDate,
        trialDate: estimatedCompletionDate,
        statuteOfLimitations: statuteOfLimitationsDate
      },
      filingDate: filingDate,
      nextHearing: nextHearingDate,
      trialDate: estimatedCompletionDate,
      statuteOfLimitationsDate: statuteOfLimitationsDate,

      // Billing Information
      billingInfo: {
        billingType: this.caseForm.value.billingType,
        hourlyRate: parseFloat(this.caseForm.value.hourlyRate) || 0,
        retainerAmount: parseFloat(this.caseForm.value.retainerAmount) || 0,
        totalHours: 0,
        totalAmount: 0,
        paymentStatus: this.caseForm.value.paymentStatus
      },
      billingType: this.caseForm.value.billingType,
      hourlyRate: parseFloat(this.caseForm.value.hourlyRate) || 0,
      retainerAmount: parseFloat(this.caseForm.value.retainerAmount) || 0,
      totalHours: 0,
      totalAmount: 0,
      paymentStatus: this.caseForm.value.paymentStatus
    };

    // Add practice area specific fields
    this.currentPracticeAreaSections.forEach(section => {
      section.fields.forEach(field => {
        const value = this.caseForm.value[field.name];
        if (value !== null && value !== undefined && value !== '') {
          if (field.type === 'date' && value) {
            caseData[field.name] = new Date(value);
          } else if (field.type === 'currency' || field.type === 'number') {
            caseData[field.name] = value ? parseFloat(value) : null;
          } else {
            caseData[field.name] = value;
          }
        }
      });
    });

    // Make the actual API call
    this.caseService.createCase(caseData).subscribe({
      next: (response) => {
        this.snackBar.open('Case created successfully', 'Close', {
          duration: 3000,
          horizontalPosition: 'end',
          verticalPosition: 'top'
        });
        this.router.navigate(['/legal/cases']);
      },
      error: (error) => {
        console.error('API error:', error);
        let errorMsg = 'Unknown error';
        
        if (error.error) {
          if (error.error.message) {
            errorMsg = error.error.message;
          } else if (error.error.reason) {
            errorMsg = error.error.reason;
          } else if (typeof error.error === 'string') {
            errorMsg = error.error;
          }
        } else if (error.message) {
          errorMsg = error.message;
        }
        
        this.errorMessage = 'Failed to create case: ' + errorMsg;
        console.error('Error creating case:', error);
        this.isLoading = false;
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/legal/cases']);
  }

  // Helper method to check if a field has errors
  hasError(field: string): boolean {
    const control = this.caseForm.get(field);
    return control ? (control.invalid && (control.dirty || control.touched)) : false;
  }

  // Helper method to get error message for a field
  getErrorMessage(field: string): string {
    const control = this.caseForm.get(field);
    if (!control) return '';

    if (control.hasError('required')) {
      return 'This field is required';
    }
    if (control.hasError('email')) {
      return 'Please enter a valid email address';
    }
    return '';
  }
} 