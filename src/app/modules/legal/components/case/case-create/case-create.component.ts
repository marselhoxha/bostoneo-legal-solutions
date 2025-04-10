import { Component, OnInit, AfterViewInit, ElementRef, ViewChildren, QueryList } from '@angular/core';
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
export class CaseCreateComponent implements OnInit, AfterViewInit {
  caseForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  
  // Enums for template
  CaseStatus = CaseStatus;
  CasePriority = CasePriority;
  PaymentStatus = PaymentStatus;
  
  // Case types
  caseTypes = ['CIVIL', 'CRIMINAL', 'FAMILY', 'BUSINESS', 'REAL_ESTATE', 'IMMIGRATION', 'INTELLECTUAL_PROPERTY', 'OTHER'];

  @ViewChildren('filingDate, nextHearingDate, estimatedCompletionDate') dateInputs: QueryList<ElementRef>;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private snackBar: MatSnackBar,
    private caseService: CaseService
  ) {
    this.caseForm = this.fb.group({
      // Basic Information
      caseNumber: ['', [Validators.required]],
      title: ['', [Validators.required]],
      status: [CaseStatus.OPEN, [Validators.required]],
      priority: [CasePriority.MEDIUM, [Validators.required]],
      type: ['CIVIL', [Validators.required]],
      description: ['', [Validators.required]],
      
      // Client Information
      clientName: ['', [Validators.required]],
      clientEmail: ['', [Validators.required, Validators.email]],
      clientPhone: ['', [Validators.required]],
      clientAddress: [''],
      
      // Court Information
      courtName: ['', [Validators.required]],
      judgeName: ['', [Validators.required]],
      courtroom: [''],
      
      // Important Dates
      filingDate: ['', [Validators.required]],
      nextHearingDate: ['', [Validators.required]],
      estimatedCompletionDate: ['', [Validators.required]],
      
      // Billing Information
      hourlyRate: [0],
      totalHours: [0],
      totalAmount: [0],
      paymentStatus: [PaymentStatus.PENDING]
    });
  }

  ngOnInit(): void {
    // Set default dates
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const threeMonths = new Date();
    threeMonths.setMonth(threeMonths.getMonth() + 3);

    this.caseForm.patchValue({
      filingDate: today,
      nextHearingDate: nextMonth,
      estimatedCompletionDate: threeMonths
    });
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

    // Transform form values to match API expectations - map to LegalCaseDTO
    const caseData = {
      caseNumber: this.caseForm.value.caseNumber,
      title: this.caseForm.value.title,
      clientName: this.caseForm.value.clientName,
      clientEmail: this.caseForm.value.clientEmail,
      clientPhone: phoneNumber,
      clientAddress: this.caseForm.value.clientAddress,
      status: this.caseForm.value.status,
      priority: this.caseForm.value.priority,
      type: this.caseForm.value.type,
      description: this.caseForm.value.description,
      courtName: this.caseForm.value.courtName,
      judgeName: this.caseForm.value.judgeName,
      courtroom: this.caseForm.value.courtroom,
      filingDate: new Date(this.caseForm.value.filingDate),
      nextHearing: new Date(this.caseForm.value.nextHearingDate),
      trialDate: new Date(this.caseForm.value.estimatedCompletionDate),
      hourlyRate: parseFloat(this.caseForm.value.hourlyRate) || 0,
      totalHours: parseFloat(this.caseForm.value.totalHours) || 0,
      totalAmount: parseFloat(this.caseForm.value.totalAmount) || 0,
      paymentStatus: this.caseForm.value.paymentStatus
    };

    console.log('Sending case data to API:', caseData);

    // Make the actual API call
    this.caseService.createCase(caseData).subscribe({
      next: (response) => {
        console.log('API response:', response);
        this.snackBar.open('Case created successfully', 'Close', {
          duration: 3000,
          horizontalPosition: 'end',
          verticalPosition: 'top'
        });
        this.router.navigate(['/legal/cases']);
      },
      error: (error) => {
        console.error('API error:', error);
        this.errorMessage = 'Failed to create case: ' + (error.error?.message || error.message || 'Unknown error');
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