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
import Swal from 'sweetalert2';

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

  // Status and priority values for dropdowns
  caseStatuses = Object.values(CaseStatus);
  casePriorities = Object.values(CasePriority);
  paymentStatuses = Object.values(PaymentStatus);
  
  // Case types
  caseTypes = ['CIVIL', 'CRIMINAL', 'FAMILY', 'BUSINESS', 'REAL_ESTATE', 'IMMIGRATION', 'INTELLECTUAL_PROPERTY', 'OTHER'];
  
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
      type: [''],
      description: ['', Validators.required],
      courtName: [''],
      judgeName: [''],
      courtroom: [''],
      filingDate: [null],
      nextHearing: [null],
      trialDate: [null],
      hourlyRate: [0],
      totalHours: [0],
      totalAmount: [0],
      paymentStatus: [PaymentStatus.PENDING]
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
      description: ['']
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
    // Initialize flatpickr when in edit mode
    if (this.dateInputs && this.dateInputs.length > 0) {
      this.dateInputs.forEach(input => {
        this.initDatePicker(null, input.nativeElement.id);
      });
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
      // Extract values with proper null checks
      const filingDate = this.case.importantDates?.filingDate || (this.case as any).filingDate;
      const nextHearing = this.case.importantDates?.nextHearing || (this.case as any).nextHearing;
      const trialDate = this.case.importantDates?.trialDate || (this.case as any).trialDate;
      
      const courtName = this.case.courtInfo?.courtName || (this.case as any).courtName;
      const judgeName = this.case.courtInfo?.judgeName || (this.case as any).judgeName;
      const courtroom = this.case.courtInfo?.courtroom || (this.case as any).courtroom;
      
      const hourlyRate = this.case.billingInfo?.hourlyRate || (this.case as any).hourlyRate || 0;
      const totalHours = this.case.billingInfo?.totalHours || (this.case as any).totalHours || 0;
      const totalAmount = this.case.billingInfo?.totalAmount || (this.case as any).totalAmount || 0;
      const paymentStatus = this.case.billingInfo?.paymentStatus || (this.case as any).paymentStatus || 'PENDING';
      
      console.log('Billing info before form update:', {
        hourlyRate, totalHours, totalAmount, paymentStatus
      });

      this.editForm.patchValue({
        caseNumber: this.case.caseNumber,
        title: this.case.title,
        clientName: this.case.clientName,
        clientEmail: this.case.clientEmail,
        clientPhone: this.case.clientPhone,
        clientAddress: this.case.clientAddress,
        status: this.case.status,
        priority: this.case.priority,
        type: this.case.type,
        description: this.case.description,
        courtName,
        judgeName,
        courtroom,
        filingDate: filingDate ? new Date(filingDate) : null,
        nextHearing: nextHearing ? new Date(nextHearing) : null,
        trialDate: trialDate ? new Date(trialDate) : null,
        hourlyRate,
        totalHours,
        totalAmount,
        paymentStatus
      });

      this.caseForm.patchValue({
        caseNumber: this.case.caseNumber,
        status: this.case.status,
        filingDate: filingDate ? new Date(filingDate) : null,
        nextHearing: nextHearing ? new Date(nextHearing) : null,
        trialDate: trialDate ? new Date(trialDate) : null,
        judge: judgeName,
        court: courtName,
        jurisdiction: courtroom,
        description: this.case.description
      });
    }
  }

  loadCase(id: string): void {
    this.isLoading = true;
    this.error = null;
    this.cdr.detectChanges();
    
    // Use the service to get real data from the API
    this.caseService.getCaseById(id).subscribe({
      next: (response) => {
        console.log('Raw API response:', response);
        console.log('Case data structure:', response?.data?.case);
        
        // The backend returns data in a wrapper object
        if (response && response.data && response.data.case) {
          // Create the importantDates object if it doesn't exist
          const caseData = response.data.case;
          
          // Ensure importantDates exists
          if (!caseData.importantDates) {
            caseData.importantDates = {
              filingDate: caseData.filingDate || null,
              nextHearing: caseData.nextHearing || null,
              trialDate: caseData.trialDate || null
            };
          }
          
          // Ensure courtInfo exists
          if (!caseData.courtInfo) {
            caseData.courtInfo = {
              courtName: caseData.courtName || '',
              judgeName: caseData.judgeName || '',
              courtroom: caseData.courtroom || ''
            };
          }
          
          // Ensure billingInfo exists
          if (!caseData.billingInfo) {
            caseData.billingInfo = {
              hourlyRate: caseData.hourlyRate || 0,
              totalHours: caseData.totalHours || 0,
              totalAmount: caseData.totalAmount || 0,
              paymentStatus: caseData.paymentStatus || 'PENDING'
            };
          }
          
          this.case = caseData;
        } else {
          this.error = 'Case data not found or in unexpected format';
          console.warn('Unexpected response format:', response);
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading case:', err);
        if (err.status === 401) {
          this.error = 'Authentication required. Please log in to view case details.';
        } else if (err.status === 404) {
          this.error = 'Case not found.';
        } else {
          this.error = 'Failed to load case. ' + (err.error?.reason || err.error?.message || 'Please try again later.');
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  saveCase(): void {
    if (this.editForm.valid && this.case) {
      this.isLoading = true;
      this.error = null;
      this.cdr.detectChanges();
      
      // Extract form values
      const formValues = this.editForm.value;
      
      // Create properly formatted update data
      const updateData = {
        id: this.case.id,
        caseNumber: formValues.caseNumber,
        title: formValues.title,
        clientName: formValues.clientName,
        clientEmail: formValues.clientEmail,
        clientPhone: formValues.clientPhone,
        clientAddress: formValues.clientAddress,
        status: formValues.status,
        priority: formValues.priority,
        type: formValues.type,
        description: formValues.description,
        
        // Include both nested and flat fields for maximum compatibility
        courtInfo: {
          courtName: formValues.courtName,
          judgeName: formValues.judgeName,
          courtroom: formValues.courtroom
        },
        courtName: formValues.courtName,
        judgeName: formValues.judgeName,
        courtroom: formValues.courtroom,
        
        importantDates: {
          filingDate: formValues.filingDate ? new Date(formValues.filingDate) : null,
          nextHearing: formValues.nextHearing ? new Date(formValues.nextHearing) : null,
          trialDate: formValues.trialDate ? new Date(formValues.trialDate) : null
        },
        filingDate: formValues.filingDate ? new Date(formValues.filingDate) : null,
        nextHearing: formValues.nextHearing ? new Date(formValues.nextHearing) : null,
        trialDate: formValues.trialDate ? new Date(formValues.trialDate) : null,
        
        billingInfo: {
          hourlyRate: parseFloat(formValues.hourlyRate) || 0,
          totalHours: parseFloat(formValues.totalHours) || 0,
          totalAmount: parseFloat(formValues.totalAmount) || 0,
          paymentStatus: formValues.paymentStatus
        },
        hourlyRate: parseFloat(formValues.hourlyRate) || 0,
        totalHours: parseFloat(formValues.totalHours) || 0,
        totalAmount: parseFloat(formValues.totalAmount) || 0,
        paymentStatus: formValues.paymentStatus
      };
      
      console.log('Updating case with data:', updateData);
      
      // Call the API to update the case
      this.caseService.updateCase(this.case.id, updateData).subscribe({
        next: (response) => {
          console.log('Case updated successfully:', response);
          // Reload the case data after update
          this.loadCase(this.case!.id);
          this.isEditing = false;
          this.snackBar.open('Case updated successfully', 'Close', { duration: 3000 });
        },
        error: (error) => {
          console.error('Error updating case:', error);
          this.error = 'Failed to update case: ' + (error.error?.reason || error.error?.message || 'Please try again later.');
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        complete: () => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  onCancel(): void {
    this.isEditing = false;
    this.cdr.detectChanges();
  }

  deleteCase(): void {
    if (this.case) {
      Swal.fire({
        title: 'Are you sure?',
        text: `You are about to delete case "${this.case.title}". This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel'
      }).then((result) => {
        if (result.isConfirmed) {
          this.isLoading = true;
          this.cdr.detectChanges();
          
          this.caseService.deleteCase(this.case!.id).subscribe({
            next: () => {
              this.isLoading = false;
              Swal.fire({
                title: 'Deleted!',
                text: 'Case has been successfully deleted.',
                icon: 'success',
                confirmButtonColor: '#3085d6'
              }).then(() => {
                this.router.navigate(['/legal/cases']);
              });
            },
            error: (error) => {
              this.isLoading = false;
              console.error('Error deleting case:', error);
              Swal.fire({
                title: 'Error!',
                text: 'Failed to delete case: ' + (error.error?.message || 'Please try again later.'),
                icon: 'error',
                confirmButtonColor: '#3085d6'
              });
              this.cdr.detectChanges();
            }
          });
        }
      });
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
}