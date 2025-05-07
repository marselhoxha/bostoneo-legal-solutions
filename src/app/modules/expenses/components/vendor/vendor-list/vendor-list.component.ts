import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ExpensesService } from '../../../../../service/expenses.service';
import { Vendor } from '../../../../../interface/expense.interface';
import { CustomHttpResponse } from '../../../../../interface/appstates';
import { NotificationService } from '../../../../../service/notification.service';
import { catchError, finalize, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-vendor-list',
  templateUrl: './vendor-list.component.html',
  styleUrls: ['./vendor-list.component.css']
})
export class VendorListComponent implements OnInit {
  vendors: Vendor[] = [];
  vendorForm: FormGroup;
  editingVendor: Vendor | null = null;
  loading = false;
  submitting = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private expensesService: ExpensesService,
    private notificationService: NotificationService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    this.vendorForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadVendors();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required]],
      contact: [''],
      taxId: ['']
    });
  }

  loadVendors(): void {
    console.log('loadVendors started, loading = true');
    this.loading = true;
    this.error = null;
    this.changeDetectorRef.detectChanges();
    
    this.expensesService.getVendors()
      .pipe(
        tap(response => {
          console.log('Loaded vendors:', response);
          this.vendors = response.data || [];
        }),
        catchError(error => {
          console.log('Error in getVendors catchError');
          this.error = 'Failed to load vendors. Please try again.';
          console.error('Error loading vendors:', error);
          this.changeDetectorRef.detectChanges();
          return of({ data: [], message: '', status: '', statusCode: 0 });
        })
      )
      .subscribe({
        next: () => {
          console.log('getVendors subscribe next');
          this.loading = false;
          this.changeDetectorRef.detectChanges();
        },
        error: (err) => {
          console.log('getVendors subscribe error (might not be reached)');
          this.error = 'Failed to load vendors. Please try again later.';
          this.loading = false;
          this.changeDetectorRef.detectChanges();
        },
        complete: () => {
          console.log('getVendors subscribe complete');
          if(this.loading) {
            this.loading = false;
            this.changeDetectorRef.detectChanges();
          }
        }
      });
  }

  onSubmit(): void {
    if (this.vendorForm.invalid) return;

    console.log('onSubmit started, submitting = true');
    this.submitting = true;
    this.error = null;
    this.changeDetectorRef.detectChanges();

    // Create a copy of form data to avoid reference issues
    const formData = { ...this.vendorForm.value };
    const isEditing = !!this.editingVendor;
    const vendorId = isEditing ? this.editingVendor.id : null;

    console.log(isEditing ? `Updating vendor ${vendorId}` : 'Creating new vendor', formData);

    const request = isEditing
      ? this.expensesService.updateVendor(vendorId!, formData)
      : this.expensesService.createVendor(formData);

    request
      .pipe(
        catchError(error => {
          this.error = `Failed to ${isEditing ? 'update' : 'create'} vendor. Please try again.`;
          console.error('Error saving vendor:', error);
          return of(null);
        }),
        finalize(() => {
          this.submitting = false;
          this.changeDetectorRef.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          if (response) {
            // Show success message
            Swal.fire({
              title: isEditing ? 'Updated!' : 'Created!',
              text: `Vendor has been successfully ${isEditing ? 'updated' : 'created'}.`,
              icon: 'success',
              timer: 2000,
              timerProgressBar: true,
              showConfirmButton: false
            });
            
            // Reset form
            this.resetForm();
            
            // Reload vendors to get fresh data
            this.loadVendors();
          }
        }
      });
  }

  editVendor(vendor: Vendor): void {
    // Make a deep copy to avoid reference issues
    this.editingVendor = {...vendor};
    
    // Reset form first to clear any previous values
    this.vendorForm.reset();
    
    // Then patch with the vendor values
    this.vendorForm.patchValue({
      name: vendor.name,
      contact: vendor.contact || '',
      taxId: vendor.taxId || ''
    });
    
    this.changeDetectorRef.detectChanges();
  }

  cancelEdit(): void {
    this.editingVendor = null;
    this.resetForm();
    this.changeDetectorRef.detectChanges();
  }

  deleteVendor(id: number): void {
    // Use SweetAlert2 for confirmation
    Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to delete this vendor? This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'No, cancel!',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        this.loading = true;
        this.error = null;
        this.changeDetectorRef.detectChanges();

        this.expensesService.deleteVendor(id)
          .pipe(
            catchError(error => {
              this.error = 'Failed to delete vendor. Please try again.';
              console.error('Error deleting vendor:', error);
              this.loading = false;
              this.changeDetectorRef.detectChanges();
              return of(null);
            })
          )
          .subscribe({
            next: (result) => {
              this.loading = false;
              
              if (result !== null) {
                // Show success message
                Swal.fire({
                  title: 'Deleted!',
                  text: 'Vendor has been successfully deleted.',
                  icon: 'success',
                  timer: 2000,
                  timerProgressBar: true,
                  showConfirmButton: false
                });
                
                // Reload the vendors
                this.loadVendors();
              }
            }
          });
      }
    });
  }

  private resetForm(): void {
    this.vendorForm.reset();
    this.editingVendor = null;
  }
} 
 