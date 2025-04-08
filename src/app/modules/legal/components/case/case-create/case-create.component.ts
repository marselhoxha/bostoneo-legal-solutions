import { Component, OnInit, AfterViewInit, ElementRef, ViewChildren, QueryList } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CaseStatus, CasePriority } from '../../../models/case.model';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { FlatpickrModule } from 'angularx-flatpickr';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import flatpickr from 'flatpickr';

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

  @ViewChildren('filingDate, nextHearingDate, estimatedCompletionDate') dateInputs: QueryList<ElementRef>;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.caseForm = this.fb.group({
      caseNumber: ['', [Validators.required]],
      title: ['', [Validators.required]],
      status: [CaseStatus.OPEN, [Validators.required]],
      priority: [CasePriority.MEDIUM, [Validators.required]],
      clientName: ['', [Validators.required]],
      clientEmail: ['', [Validators.required, Validators.email]],
      clientPhone: ['', [Validators.required]],
      description: ['', [Validators.required]],
      courtName: ['', [Validators.required]],
      judgeName: ['', [Validators.required]],
      filingDate: ['', [Validators.required]],
      nextHearingDate: ['', [Validators.required]],
      estimatedCompletionDate: ['', [Validators.required]]
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

    // Simulate API call
    setTimeout(() => {
      try {
        // Here you would typically make an API call to create the case
        console.log('Creating case:', this.caseForm.value);
        
        this.snackBar.open('Case created successfully', 'Close', {
          duration: 3000,
          horizontalPosition: 'end',
          verticalPosition: 'top'
        });

        this.router.navigate(['/legal/cases']);
      } catch (error) {
        this.errorMessage = 'Failed to create case. Please try again.';
        console.error('Error creating case:', error);
      } finally {
        this.isLoading = false;
      }
    }, 1000);
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