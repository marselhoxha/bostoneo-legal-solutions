import { Component, OnInit, ChangeDetectorRef, AfterViewInit, ElementRef, ViewChildren, QueryList } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LegalCase, CaseStatus, CasePriority, PaymentStatus } from '../../../interfaces/case.interface';
import { CaseService } from '../../../services/case.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { FlatpickrModule } from 'angularx-flatpickr';
import flatpickr from 'flatpickr';
import { CaseNotesComponent } from '../case-notes/case-notes.component';
import { CaseDocumentsComponent } from '../case-documents/case-documents.component';
import { CaseTimelineComponent } from '../case-timeline/case-timeline.component';

@Component({
  selector: 'app-case-detail',
  templateUrl: './case-detail.component.html',
  styleUrls: ['./case-detail.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FlatpickrModule,
    CaseNotesComponent,
    CaseDocumentsComponent,
    CaseTimelineComponent
  ]
})
export class CaseDetailComponent implements OnInit, AfterViewInit {
  case: LegalCase | null = null;
  isLoading = false;
  error: string | null = null;
  isEditing = false;
  editForm: FormGroup;
  caseForm: FormGroup;

  @ViewChildren('filingDate, nextHearing, trialDate') dateInputs: QueryList<ElementRef>;

  // Dummy data for demonstration
  dummyCases: LegalCase[] = [
    {
      id: '1',
      caseNumber: 'CASE-2024-001',
      title: 'Smith vs. Johnson',
      clientName: 'John Smith',
      clientEmail: 'john.smith@email.com',
      clientPhone: '(555) 123-4567',
      clientAddress: '123 Main St, Anytown, USA',
      status: CaseStatus.OPEN,
      priority: CasePriority.HIGH,
      type: 'CIVIL_LITIGATION',
      description: 'Contract dispute between parties',
      courtInfo: {
        courtName: 'Superior Court of California',
        judgeName: 'Hon. Sarah Wilson',
        courtroom: 'Courtroom 3B'
      },
      importantDates: {
        filingDate: new Date('2024-01-15'),
        nextHearing: new Date('2024-05-20'),
        trialDate: new Date('2024-08-10')
      },
      documents: [],
      notes: [],
      billingInfo: {
        hourlyRate: 250,
        totalHours: 45,
        totalAmount: 11250,
        paymentStatus: PaymentStatus.PENDING
      },
      createdAt: new Date('2024-01-10'),
      updatedAt: new Date('2024-04-05')
    },
    {
      id: '2',
      caseNumber: 'CASE-2024-002',
      title: 'Brown Estate Planning',
      clientName: 'Mary Brown',
      clientEmail: 'mary.brown@email.com',
      clientPhone: '(555) 234-5678',
      clientAddress: '456 Oak Ave, Somewhere, USA',
      status: CaseStatus.IN_PROGRESS,
      priority: CasePriority.MEDIUM,
      type: 'ESTATE_PLANNING',
      description: 'Estate planning and trust formation',
      courtInfo: {
        courtName: 'Probate Court',
        judgeName: 'Hon. Robert Chen',
        courtroom: 'Courtroom 2A'
      },
      importantDates: {
        filingDate: new Date('2024-02-01'),
        nextHearing: new Date('2024-05-15'),
        trialDate: new Date('2024-07-30')
      },
      billingInfo: {
        hourlyRate: 300,
        totalHours: 25,
        totalAmount: 7500,
        paymentStatus: PaymentStatus.PAID
      },
      createdAt: new Date('2024-01-25'),
      updatedAt: new Date('2024-04-03')
    },
    {
      id: '3',
      caseNumber: 'CASE-2024-003',
      title: 'Davis Corporate Merger',
      clientName: 'Robert Davis',
      clientEmail: 'robert.davis@email.com',
      clientPhone: '(555) 345-6789',
      clientAddress: '789 Pine St, Business District, USA',
      status: CaseStatus.PENDING,
      priority: CasePriority.LOW,
      type: 'CORPORATE_MERGER',
      description: 'Corporate merger and acquisition',
      courtInfo: {
        courtName: 'Business Court',
        judgeName: 'Hon. Michael Thompson',
        courtroom: 'Courtroom 4C'
      },
      importantDates: {
        filingDate: new Date('2024-02-15'),
        nextHearing: new Date('2024-06-01'),
        trialDate: new Date('2024-09-15')
      },
      billingInfo: {
        hourlyRate: 400,
        totalHours: 60,
        totalAmount: 24000,
        paymentStatus: PaymentStatus.OVERDUE
      },
      createdAt: new Date('2024-02-10'),
      updatedAt: new Date('2024-04-01')
    },
    {
      id: '4',
      caseNumber: 'CASE-2024-004',
      title: 'Wilson Employment Dispute',
      clientName: 'Sarah Wilson',
      clientEmail: 'sarah.wilson@email.com',
      clientPhone: '(555) 456-7890',
      clientAddress: '321 Elm St, Downtown, USA',
      status: CaseStatus.CLOSED,
      priority: CasePriority.MEDIUM,
      type: 'EMPLOYMENT_LITIGATION',
      description: 'Employment discrimination case',
      courtInfo: {
        courtName: 'Employment Court',
        judgeName: 'Hon. Lisa Martinez',
        courtroom: 'Courtroom 1D'
      },
      importantDates: {
        filingDate: new Date('2024-01-20'),
        nextHearing: new Date('2024-04-10'),
        trialDate: new Date('2024-07-20')
      },
      billingInfo: {
        hourlyRate: 275,
        totalHours: 80,
        totalAmount: 22000,
        paymentStatus: PaymentStatus.PAID
      },
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-03-25')
    },
    {
      id: '5',
      caseNumber: 'CASE-2024-005',
      title: 'Taylor Immigration Case',
      clientName: 'James Taylor',
      clientEmail: 'james.taylor@email.com',
      clientPhone: '(555) 567-8901',
      clientAddress: '654 Maple Dr, Uptown, USA',
      status: CaseStatus.OPEN,
      priority: CasePriority.URGENT,
      type: 'IMMIGRATION',
      description: 'Immigration visa application',
      courtInfo: {
        courtName: 'Immigration Court',
        judgeName: 'Hon. David Kim',
        courtroom: 'Courtroom 5E'
      },
      importantDates: {
        filingDate: new Date('2024-03-01'),
        nextHearing: new Date('2024-05-25'),
        trialDate: new Date('2024-08-15')
      },
      billingInfo: {
        hourlyRate: 350,
        totalHours: 30,
        totalAmount: 10500,
        paymentStatus: PaymentStatus.PENDING
      },
      createdAt: new Date('2024-02-25'),
      updatedAt: new Date('2024-04-02')
    },
    {
      id: '6',
      caseNumber: 'CASE-2024-006',
      title: 'Anderson Patent Dispute',
      clientName: 'Patricia Anderson',
      clientEmail: 'patricia.anderson@email.com',
      clientPhone: '(555) 678-9012',
      clientAddress: '987 Cedar Ln, Tech Park, USA',
      status: CaseStatus.ARCHIVED,
      priority: CasePriority.LOW,
      type: 'INTELLECTUAL_PROPERTY',
      description: 'Patent infringement lawsuit',
      courtInfo: {
        courtName: 'Federal Court',
        judgeName: 'Hon. William Harris',
        courtroom: 'Courtroom 6F'
      },
      importantDates: {
        filingDate: new Date('2024-02-05'),
        nextHearing: new Date('2024-05-30'),
        trialDate: new Date('2024-09-01')
      },
      billingInfo: {
        hourlyRate: 450,
        totalHours: 100,
        totalAmount: 45000,
        paymentStatus: PaymentStatus.PAID
      },
      createdAt: new Date('2024-01-30'),
      updatedAt: new Date('2024-03-20')
    }
  ];

  caseStatuses = Object.values(CaseStatus);
  casePriorities = Object.values(CasePriority);

  private flatpickrInstances: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private caseService: CaseService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {
    this.editForm = this.fb.group({
      caseNumber: ['', Validators.required],
      title: ['', Validators.required],
      clientName: ['', Validators.required],
      clientEmail: [''],
      clientPhone: [''],
      clientAddress: [''],
      status: [CaseStatus.OPEN, Validators.required],
      priority: [CasePriority.MEDIUM, Validators.required],
      description: ['', Validators.required],
      courtInfo: this.fb.group({
        courtName: ['', Validators.required],
        judgeName: ['', Validators.required],
        courtroom: ['', Validators.required]
      }),
      filingDate: [null],
      nextHearing: [null],
      trialDate: [null]
    });

    this.caseForm = this.fb.group({
      caseNumber: [''],
      status: [''],
      filingDate: [''],
      nextHearing: [''],
      trialDate: [''],
      judge: [''],
      court: [''],
      jurisdiction: [''],
      description: [''],
      notes: ['']
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadCase(id);
    } else {
      this.error = 'Case ID not provided';
    }
  }

  ngAfterViewInit(): void {
    // Initialize flatpickr for date inputs when in edit mode
    if (this.isEditing) {
      this.initializeFlatpickr();
    }
  }

  // Method to initialize a single date picker
  initDatePicker(event: Event, controlName: string): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      // Destroy any existing instance for this input
      const existingInstance = this.flatpickrInstances.find(instance => 
        instance.input === input
      );
      
      if (existingInstance) {
        existingInstance.destroy();
        this.flatpickrInstances = this.flatpickrInstances.filter(instance => 
          instance !== existingInstance
        );
      }
      
      // Create a new instance
      const instance = flatpickr(input, {
        dateFormat: 'Y-m-d',
        altInput: true,
        altFormat: 'F j, Y',
        allowInput: true,
        defaultDate: this.editForm.get(controlName)?.value || new Date(),
        onChange: (selectedDates) => {
          if (selectedDates.length > 0) {
            this.editForm.get(controlName)?.setValue(selectedDates[0]);
          }
        }
      });
      
      this.flatpickrInstances.push(instance);
      
      // Open the calendar immediately
      instance.open();
    }
  }

  private initializeFlatpickr(): void {
    // Destroy any existing instances first
    this.destroyFlatpickrInstances();
    
    // Initialize new instances
    this.dateInputs.forEach(input => {
      const controlName = input.nativeElement.id;
      const formControl = this.editForm.get(controlName);
      
      if (formControl) {
        // Create a new flatpickr instance
        const instance = flatpickr(input.nativeElement, {
          dateFormat: 'Y-m-d',
          altInput: true,
          altFormat: 'F j, Y',
          allowInput: true,
          defaultDate: formControl.value || new Date(),
          onChange: (selectedDates) => {
            if (selectedDates.length > 0) {
              formControl.setValue(selectedDates[0]);
            }
          }
        });
        
        this.flatpickrInstances.push(instance);
      }
    });
  }

  private destroyFlatpickrInstances(): void {
    this.flatpickrInstances.forEach(instance => {
      if (instance && typeof instance.destroy === 'function') {
        instance.destroy();
      }
    });
    this.flatpickrInstances = [];
  }

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    if (this.isEditing) {
      this.updateFormWithCaseData();
      // Force change detection to update the view
      this.cdr.detectChanges();
      // Initialize Flatpickr after view updates with a longer timeout
      setTimeout(() => {
        this.initializeFlatpickr();
      }, 500);
    } else {
      // Clean up flatpickr instances when exiting edit mode
      this.destroyFlatpickrInstances();
    }
  }

  updateFormWithCaseData(): void {
    if (this.case) {
      this.editForm.patchValue({
        caseNumber: this.case.caseNumber,
        status: this.case.status,
        filingDate: this.case.importantDates.filingDate ? new Date(this.case.importantDates.filingDate) : null,
        nextHearing: this.case.importantDates.nextHearing ? new Date(this.case.importantDates.nextHearing) : null,
        trialDate: this.case.importantDates.trialDate ? new Date(this.case.importantDates.trialDate) : null,
        judge: this.case.courtInfo.judgeName,
        court: this.case.courtInfo.courtName,
        jurisdiction: this.case.courtInfo.courtroom,
        description: this.case.description,
        notes: this.case.notes
      });

      this.caseForm.patchValue({
        caseNumber: this.case.caseNumber,
        status: this.case.status,
        filingDate: this.case.importantDates.filingDate ? new Date(this.case.importantDates.filingDate) : null,
        nextHearing: this.case.importantDates.nextHearing ? new Date(this.case.importantDates.nextHearing) : null,
        trialDate: this.case.importantDates.trialDate ? new Date(this.case.importantDates.trialDate) : null,
        judge: this.case.courtInfo.judgeName,
        court: this.case.courtInfo.courtName,
        jurisdiction: this.case.courtInfo.courtroom,
        description: this.case.description,
        notes: this.case.notes
      });
    }
  }

  loadCase(id: string): void {
    this.isLoading = true;
    this.error = null;
    this.cdr.detectChanges();
    
    // Use dummy data instead of service call
    setTimeout(() => {
      try {
        const foundCase = this.dummyCases.find(c => c.id === id);
        if (foundCase) {
          this.case = foundCase;
          this.isLoading = false;
          this.cdr.detectChanges();
        } else {
          this.error = 'Case not found';
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      } catch (err) {
        console.error('Error loading case:', err);
        this.error = 'Failed to load case. Please try again later.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    }, 500);
  }

  saveCase(formData: any): void {
    if (this.editForm.valid && this.case) {
      this.isLoading = true;
      this.cdr.detectChanges();
      
      // Format dates
      const formattedData = {
        ...formData,
        importantDates: {
          filingDate: new Date(formData.importantDates.filingDate),
          nextHearing: new Date(formData.importantDates.nextHearing),
          trialDate: new Date(formData.importantDates.trialDate)
        }
      };
      
      // Update existing case
      setTimeout(() => {
        const updatedCase = {
          ...this.case,
          ...formattedData,
          updatedAt: new Date()
        };
        
        const index = this.dummyCases.findIndex(c => c.id === this.case?.id);
        if (index !== -1) {
          this.dummyCases[index] = updatedCase;
        }
        
        this.case = updatedCase;
        this.isEditing = false;
        this.isLoading = false;
        this.snackBar.open('Case updated successfully', 'Close', { duration: 3000 });
        this.cdr.detectChanges();
      }, 500);
    }
  }

  onCancel(): void {
    this.isEditing = false;
    this.cdr.detectChanges();
  }

  deleteCase(): void {
    if (this.case && confirm('Are you sure you want to delete this case?')) {
      this.isLoading = true;
      this.cdr.detectChanges();
      
      setTimeout(() => {
        const index = this.dummyCases.findIndex(c => c.id === this.case?.id);
        if (index !== -1) {
          this.dummyCases.splice(index, 1);
        }
        
        this.isLoading = false;
        this.snackBar.open('Case deleted successfully', 'Close', { duration: 3000 });
        this.router.navigate(['/legal/cases']);
        this.cdr.detectChanges();
      }, 500);
    }
  }

  getStatusClass(status: CaseStatus): string {
    return `status-${status.toLowerCase().replace('_', '-')}`;
  }

  getPriorityClass(priority: CasePriority): string {
    return `priority-${priority.toLowerCase()}`;
  }

  startEdit(): void {
    this.isEditing = true;
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.updateFormWithCaseData();
  }

  onSubmit(): void {
    if (this.caseForm.valid && this.case) {
      const updatedCase = {
        ...this.case,
        ...this.caseForm.value
      };
      
      this.caseService.updateCase(this.case.id, updatedCase).subscribe(
        (result) => {
          this.case = result;
          this.isEditing = false;
        },
        (error) => {
          console.error('Error updating case:', error);
        }
      );
    }
  }
}