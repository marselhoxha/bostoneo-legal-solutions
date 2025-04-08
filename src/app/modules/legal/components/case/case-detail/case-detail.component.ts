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

@Component({
  selector: 'app-case-detail',
  templateUrl: './case-detail.component.html',
  styleUrls: ['./case-detail.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FlatpickrModule
  ]
})
export class CaseDetailComponent implements OnInit, AfterViewInit {
  case: LegalCase | null = null;
  isLoading = false;
  error: string | null = null;
  isEditing = false;
  editForm: FormGroup;

  @ViewChildren('filingDate, nextHearing, trialDate') dateInputs: QueryList<ElementRef>;

  // Dummy data for demonstration
  dummyCases: LegalCase[] = [
    {
      id: '1',
      caseNumber: 'CASE-2024-001',
      title: 'Smith vs. Johnson',
      clientName: 'John Smith',
      clientEmail: 'john.smith@example.com',
      clientPhone: '(555) 123-4567',
      clientAddress: '123 Main St, Anytown, USA',
      status: CaseStatus.OPEN,
      priority: CasePriority.HIGH,
      description: 'Contract dispute regarding software development services',
      courtInfo: {
        courtName: 'District Court',
        judgeName: 'Judge Williams',
        courtroom: 'Room 101'
      },
      importantDates: {
        filingDate: new Date('2024-01-15'),
        nextHearing: new Date('2024-06-10'),
        trialDate: new Date('2024-08-20')
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
      title: 'Acme Corp vs. TechStart',
      clientName: 'Acme Corporation',
      clientEmail: 'legal@acmecorp.com',
      clientPhone: '(555) 987-6543',
      clientAddress: '456 Corporate Ave, Metropolis, USA',
      status: CaseStatus.IN_PROGRESS,
      priority: CasePriority.MEDIUM,
      description: 'Intellectual property infringement case',
      courtInfo: {
        courtName: 'Federal Court',
        judgeName: 'Judge Rodriguez',
        courtroom: 'Room 205'
      },
      importantDates: {
        filingDate: new Date('2024-02-05'),
        nextHearing: new Date('2024-05-15'),
        trialDate: new Date('2024-07-30')
      },
      documents: [],
      notes: [],
      billingInfo: {
        hourlyRate: 300,
        totalHours: 75,
        totalAmount: 22500,
        paymentStatus: PaymentStatus.PAID
      },
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-04-08')
    },
    {
      id: '3',
      caseNumber: 'CASE-2024-003',
      title: 'Williams Estate',
      clientName: 'Sarah Williams',
      clientEmail: 'sarah.williams@example.com',
      clientPhone: '(555) 456-7890',
      clientAddress: '789 Oak Lane, Springfield, USA',
      status: CaseStatus.PENDING,
      priority: CasePriority.LOW,
      description: 'Estate planning and distribution',
      courtInfo: {
        courtName: 'Probate Court',
        judgeName: 'Judge Thompson',
        courtroom: 'Room 103'
      },
      importantDates: {
        filingDate: new Date('2024-03-10'),
        nextHearing: new Date('2024-04-25'),
        trialDate: new Date('2024-05-15')
      },
      documents: [],
      notes: [],
      billingInfo: {
        hourlyRate: 200,
        totalHours: 30,
        totalAmount: 6000,
        paymentStatus: PaymentStatus.PENDING
      },
      createdAt: new Date('2024-03-05'),
      updatedAt: new Date('2024-04-10')
    },
    {
      id: '4',
      caseNumber: 'CASE-2024-004',
      title: 'Johnson Divorce',
      clientName: 'Michael Johnson',
      clientEmail: 'michael.johnson@example.com',
      clientPhone: '(555) 234-5678',
      clientAddress: '321 Pine St, Rivertown, USA',
      status: CaseStatus.CLOSED,
      priority: CasePriority.MEDIUM,
      description: 'Divorce proceedings and asset division',
      courtInfo: {
        courtName: 'Family Court',
        judgeName: 'Judge Martinez',
        courtroom: 'Room 302'
      },
      importantDates: {
        filingDate: new Date('2023-11-20'),
        nextHearing: new Date('2024-01-15'),
        trialDate: new Date('2024-02-10')
      },
      documents: [],
      notes: [],
      billingInfo: {
        hourlyRate: 275,
        totalHours: 60,
        totalAmount: 16500,
        paymentStatus: PaymentStatus.PAID
      },
      createdAt: new Date('2023-11-15'),
      updatedAt: new Date('2024-02-15')
    },
    {
      id: '5',
      caseNumber: 'CASE-2024-005',
      title: 'TechStart Patent',
      clientName: 'TechStart Inc.',
      clientEmail: 'legal@techstart.com',
      clientPhone: '(555) 876-5432',
      clientAddress: '555 Innovation Blvd, Tech City, USA',
      status: CaseStatus.OPEN,
      priority: CasePriority.URGENT,
      description: 'Patent infringement lawsuit',
      courtInfo: {
        courtName: 'Federal Court',
        judgeName: 'Judge Anderson',
        courtroom: 'Room 401'
      },
      importantDates: {
        filingDate: new Date('2024-03-25'),
        nextHearing: new Date('2024-04-30'),
        trialDate: new Date('2024-06-15')
      },
      documents: [],
      notes: [],
      billingInfo: {
        hourlyRate: 350,
        totalHours: 120,
        totalAmount: 42000,
        paymentStatus: PaymentStatus.PENDING
      },
      createdAt: new Date('2024-03-20'),
      updatedAt: new Date('2024-04-12')
    },
    {
      id: '6',
      caseNumber: 'CASE-2023-012',
      title: 'Brown Bankruptcy',
      clientName: 'Robert Brown',
      clientEmail: 'robert.brown@example.com',
      clientPhone: '(555) 345-6789',
      clientAddress: '777 Debt Lane, Financial District, USA',
      status: CaseStatus.ARCHIVED,
      priority: CasePriority.LOW,
      description: 'Chapter 7 bankruptcy filing',
      courtInfo: {
        courtName: 'Bankruptcy Court',
        judgeName: 'Judge Wilson',
        courtroom: 'Room 201'
      },
      importantDates: {
        filingDate: new Date('2023-09-10'),
        nextHearing: new Date('2023-10-05'),
        trialDate: new Date('2023-11-20')
      },
      documents: [],
      notes: [],
      billingInfo: {
        hourlyRate: 225,
        totalHours: 40,
        totalAmount: 9000,
        paymentStatus: PaymentStatus.PAID
      },
      createdAt: new Date('2023-09-05'),
      updatedAt: new Date('2023-12-01')
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
      // Get current date values or use defaults
      const filingDate = this.case.importantDates?.filingDate || new Date();
      const nextHearing = this.case.importantDates?.nextHearing || new Date();
      const trialDate = this.case.importantDates?.trialDate || new Date();
      
      this.editForm.patchValue({
        caseNumber: this.case.caseNumber,
        title: this.case.title,
        clientName: this.case.clientName,
        clientEmail: this.case.clientEmail || '',
        clientPhone: this.case.clientPhone || '',
        clientAddress: this.case.clientAddress || '',
        status: this.case.status,
        priority: this.case.priority,
        description: this.case.description,
        courtInfo: {
          courtName: this.case.courtInfo.courtName,
          judgeName: this.case.courtInfo.judgeName,
          courtroom: this.case.courtInfo.courtroom
        },
        filingDate: filingDate,
        nextHearing: nextHearing,
        trialDate: trialDate
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
}