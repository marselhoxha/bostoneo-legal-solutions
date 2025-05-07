import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ExpensesService } from '../../../../../service/expenses.service';
import { NotificationService } from '../../../../../service/notification.service';
import { Vendor } from '../../../../../interface/expense.interface';
import { Observable, catchError, finalize, of, switchMap, tap } from 'rxjs';

@Component({
  selector: 'app-vendor-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './vendor-form.component.html',
  styleUrls: ['./vendor-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VendorFormComponent implements OnInit {
  vendorForm: FormGroup;
  vendorId: number | null = null;
  isEdit = false;
  loading = false;
  submitting = false;
  errorMessage: string | null = null;

  constructor(
    private formBuilder: FormBuilder,
    private expensesService: ExpensesService,
    private notificationService: NotificationService,
    private router: Router,
    private route: ActivatedRoute,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    this.vendorForm = this.formBuilder.group({
      name: ['', [Validators.required]],
      contact: [''],
      taxId: ['']
    });
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(
      switchMap(params => {
        const id = params.get('id');
        if (id) {
          this.vendorId = +id;
          this.isEdit = true;
          return this.loadVendor(this.vendorId);
        }
        return of(null);
      })
    ).subscribe();
  }

  loadVendor(id: number): Observable<any> {
    this.loading = true;
    this.errorMessage = null;
    console.log('Loading vendor, setting loading to true');
    this.changeDetectorRef.markForCheck();
    
    return this.expensesService.getVendorById(id).pipe(
      tap(response => {
        console.log('Vendor loaded successfully:', response);
        if (response && response.data) {
          const vendor = response.data;
          
          this.vendorForm.patchValue({
            name: vendor.name || '',
            contact: vendor.contact || '',
            taxId: vendor.taxId || ''
          });
          console.log('Form patched with vendor data');
        } else {
          this.errorMessage = 'Vendor not found';
          console.error('Vendor data is null or undefined');
        }
      }),
      catchError(error => {
        this.errorMessage = `Failed to load vendor: ${error.message || 'Unknown error'}`;
        console.error('Error loading vendor:', error);
        return of(null);
      }),
      finalize(() => {
        this.loading = false;
        console.log('Vendor loading complete, setting loading to false');
        this.changeDetectorRef.markForCheck();
      })
    );
  }

  onSubmit(): void {
    if (this.vendorForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.vendorForm.controls).forEach(key => {
        const control = this.vendorForm.get(key);
        control?.markAsTouched();
      });
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.submitting = true;
    this.errorMessage = null;
    this.changeDetectorRef.markForCheck();

    const vendorData = this.vendorForm.value;
    
    const saveObservable = this.isEdit && this.vendorId
      ? this.expensesService.updateVendor(this.vendorId, vendorData)
      : this.expensesService.createVendor(vendorData);

    saveObservable.pipe(
      tap(response => {
        const message = this.isEdit ? 'Vendor updated successfully' : 'Vendor created successfully';
        this.notificationService.onSuccess(message);
        this.router.navigate(['/expenses/vendors']);
      }),
      catchError(error => {
        this.errorMessage = `Failed to ${this.isEdit ? 'update' : 'create'} vendor: ${error.message || 'Unknown error'}`;
        console.error(`Error ${this.isEdit ? 'updating' : 'creating'} vendor:`, error);
        this.notificationService.onError(this.errorMessage);
        this.changeDetectorRef.markForCheck();
        return of(null);
      }),
      finalize(() => {
        this.submitting = false;
        this.changeDetectorRef.markForCheck();
      })
    ).subscribe();
  }

  // Helper method to check if a control is invalid and touched
  isInvalid(controlName: string): boolean {
    const control = this.vendorForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  // Helper method to get error message for a control
  getErrorMessage(controlName: string): string {
    const control = this.vendorForm.get(controlName);
    if (!control) return '';
    
    if (control.hasError('required')) {
      return 'This field is required';
    }
    if (control.hasError('email')) {
      return 'Please enter a valid email address';
    }
    
    return 'Invalid input';
  }

  // Navigate back to vendor list
  cancel(): void {
    this.router.navigate(['/expenses/vendors']);
  }
} 
 