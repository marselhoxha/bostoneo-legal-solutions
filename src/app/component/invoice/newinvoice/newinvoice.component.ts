import { ChangeDetectionStrategy, Component, EventEmitter, OnInit, Output } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Observable, BehaviorSubject, map, startWith, catchError, of } from 'rxjs';
import { DataState } from 'src/app/enum/datastate.enum';
import { CustomHttpResponse, Page } from 'src/app/interface/appstates';
import { Customer } from 'src/app/interface/customer';
import { State } from 'src/app/interface/state';
import { User } from 'src/app/interface/user';
import { CustomerService } from 'src/app/service/customer.service';
import Swal from 'sweetalert2';
import { NotificationService } from 'src/app/service/notification.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';


@Component({
  selector: 'app-newinvoice',
  templateUrl: './newinvoice.component.html',
  styleUrls: ['./newinvoice.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewinvoiceComponent implements OnInit {
  newInvoiceState$: Observable<State<CustomHttpResponse<Customer[] & User>>>;
  private dataSubject = new BehaviorSubject<CustomHttpResponse<Customer[] & User>>(null);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();
  readonly DataState = DataState;
  @Output() invoiceCreated = new EventEmitter<any>(); // Emits event when invoice is created
  private destroy$ = new Subject<void>();


  constructor(private customerService: CustomerService, private notificationService: NotificationService) { }

  ngOnInit(): void {
    this.newInvoiceState$ = this.customerService.newInvoice$()
      .pipe(
        map(response => {
          console.log(response);
          this.dataSubject.next(response);
          return { dataState: DataState.LOADED, appData: response };
        }),
        startWith({ dataState: DataState.LOADING }),
        catchError((error: string) => {
          return of({ dataState: DataState.ERROR, error })
        })
      )
  }
  // Method to handle modal close
  closeModal(): void {
    this.invoiceCreated.emit(null);  // Optionally emit null to notify parent to close the modal
  }

  newInvoice(newInvoiceForm: NgForm): void {
    this.dataSubject.next({ ...this.dataSubject.value, message: null });
    this.isLoadingSubject.next(true);
    
    this.newInvoiceState$ = this.customerService.createInvoice$(newInvoiceForm.value.customerId, newInvoiceForm.value)
      .pipe(
        map(response => {
          console.log(response);
  
          // Reset the form after submission
          newInvoiceForm.reset({ status: 'PENDING' });
  
          // Stop the loading state
          this.isLoadingSubject.next(false);
  
          // Update the data subject with the new response
          this.dataSubject.next(response);
  
          // Emit the event to notify parent that a new invoice is created
          this.invoiceCreated.emit(response);
  
          // Show success alert using SweetAlert2
          Swal.fire({
            title: 'Invoice Created Successfully!',
            text: 'Your new invoice has been successfully added.',
            icon: 'success',
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: false
          });
  
          return { dataState: DataState.LOADED, appData: this.dataSubject.value };
        }),
        startWith({ dataState: DataState.LOADING }),
        catchError((error: string) => {
          // Stop loading on error
          this.isLoadingSubject.next(false);
  
          // Show error alert using SweetAlert2
          Swal.fire({
            title: 'Error!',
            text: 'There was a problem creating the invoice. Please try again.',
            icon: 'error',
            confirmButtonText: 'OK'
          });
  
          return of({ dataState: DataState.ERROR, error });
        })
      );
  }
  
  createInvoice(newInvoiceForm: NgForm) {
    this.isLoadingSubject.next(true);
    this.customerService.createInvoice$(newInvoiceForm.value.customerId, newInvoiceForm.value)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isLoadingSubject.next(false);
          // Show success alert using SweetAlert2
          Swal.fire({
            title: 'Invoice Created Successfully!',
            text: 'Your new invoice has been successfully added.',
            icon: 'success',
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: false
          });
          this.closeModal();
        },
        error: (error) => {
          this.isLoadingSubject.next(false);
          // Show error alert using SweetAlert2
          Swal.fire({
            title: 'Error!',
            text: 'There was a problem creating the invoice. Please try again.',
            icon: 'error',
            confirmButtonText: 'OK'
          });
        }
      });
  }

}
