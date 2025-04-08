import { HttpEvent, HttpEventType } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, NgForm, Validators } from '@angular/forms';
import { EventType, Router } from '@angular/router';
import { Observable, BehaviorSubject, map, startWith, catchError, of, switchMap, distinctUntilChanged, shareReplay } from 'rxjs';
import { DataState } from 'src/app/enum/datastate.enum';
import { CustomHttpResponse, Page, Profile } from 'src/app/interface/appstates';
import { Customer } from 'src/app/interface/customer';
import { State } from 'src/app/interface/state';
import { User } from 'src/app/interface/user';
import { CustomerService } from 'src/app/service/customer.service';
import { saveAs } from 'file-saver';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { NewcustomerComponent } from '../newcustomer/newcustomer.component';
import Swal from 'sweetalert2';


@Component({
  selector: 'app-customers',
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush 

})
export class CustomersComponent implements OnInit {
  customersState$: Observable<State<CustomHttpResponse<Page<Customer> & User>>>;
  private dataSubject = new BehaviorSubject<CustomHttpResponse<Page<Customer> & User>>(null);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();
  private currentPageSubject = new BehaviorSubject<number>(0);
  currentPage$ = this.currentPageSubject.asObservable();
  private showLogsSubject = new BehaviorSubject<boolean>(false);
  showLogs$ = this.showLogsSubject.asObservable();
  private fileStatusSubject = new BehaviorSubject<{ status: string, type: string, percent: number }>(undefined);
  fileStatus$ = this.fileStatusSubject.asObservable();
  readonly DataState = DataState;
  private modalRef: NgbModalRef;  // To handle modal references


  constructor(private router: Router, private customerService: CustomerService, private modalService: NgbModal, private cdRef: ChangeDetectorRef) { }

  ngOnInit(): void {
    // Combine the customers and searchCustomers observables into one to prevent redundant state changes
    this.customersState$ = this.customerService.customers$().pipe(
      switchMap(() => this.customerService.searchCustomers$()), // Combine both calls
      map(response => {
        console.log(response);
        this.dataSubject.next(response);
        return { dataState: DataState.LOADED, appData: response };
      }),
      startWith({ dataState: DataState.LOADING }),
      distinctUntilChanged(), // Prevent re-emitting the same values
      shareReplay(1), // Cache the last emission to avoid redundant API calls
      catchError((error: string) => of({ dataState: DataState.ERROR, error }))
    );
  }

  
  // Open the modal for creating a new customer
  openNewCustomerModal(): void {
    this.modalRef = this.modalService.open(NewcustomerComponent, { size: 'md', backdrop: 'static' });

    // Listen for when the modal is closed and a new customer is created
    this.modalRef.componentInstance.customerCreated.subscribe((newCustomer: any) => {
      this.onCustomerCreated(newCustomer);
    });
  }

  // Method called when a new customer is created
  onCustomerCreated(newCustomer: any): void {
    // Make API call to create the customer on the backend
    this.customerService.newCustomer$(newCustomer).subscribe(() => {
      this.loadCustomers();  // Refresh customer list after adding new customer
    });

    // Optionally, close the modal
    if (this.modalRef) {
      this.modalRef.close();
    }
  }

  // Load customers based on the current page
  loadCustomers(): void {
    this.customersState$ = this.customerService.customers$(this.currentPageSubject.value)
      .pipe(
        map(response => {
          this.dataSubject.next(response);  // Update the data
          return { dataState: DataState.LOADED, appData: response };
        }),
        startWith({ dataState: DataState.LOADING }),
        catchError((error: string) => {
          return of({ dataState: DataState.ERROR, error });
        })
      );
  }

  searchCustomers(searchForm: NgForm): void {
    this.currentPageSubject.next(0);
    this.customersState$ = this.customerService.searchCustomers$(searchForm.value.name)
      .pipe(
        map(response => {
          console.log(response);
          this.dataSubject.next(response);
          return { dataState: DataState.LOADED, appData: response };
        }),
        startWith({ dataState: DataState.LOADED, appData: this.dataSubject.value }),
        catchError((error: string) => {
          return of({ dataState: DataState.ERROR, error })
        })
      )
  }

  deleteCustomer(customerId: number): void {
  // Show confirmation dialog using SweetAlert2
  Swal.fire({
    title: 'Are you sure?',
    text: 'Do you want to delete this customer?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, delete it!',
    cancelButtonText: 'No, cancel!',
    reverseButtons: true
  }).then((result) => {
    if (result.isConfirmed) {
      // If user confirms, proceed with deletion
      this.customerService.deleteCustomer$(customerId).subscribe(
        () => {
          console.log(`Customer ${customerId} deleted successfully`);

          // Show success message using SweetAlert2
          Swal.fire({
            title: 'Deleted!',
            text: 'The customer has been deleted successfully.',
            icon: 'success',
            timer: 2000,
            timerProgressBar: true,
            showConfirmButton: false
          });

          // Reload the first page of customers after deletion
          this.goToPage(0);

          // Optionally, trigger change detection manually
          this.cdRef.detectChanges();
        },
        error => {
          console.error('Error deleting customer:', error);

          // Detect if the error is a permission issue
          const errorMessage = error || 'There was a problem deleting the customer.';

          // Show the error message using SweetAlert2
          Swal.fire({
            title: 'Error!',
            text: errorMessage,
            icon: 'error',
            confirmButtonText: 'OK'
          });
        }
      );
    } else if (result.dismiss === Swal.DismissReason.cancel) {
      // If user cancels, show cancellation message
      Swal.fire({
        title: 'Cancelled',
        text: 'Your customer is safe :)',
        icon: 'info',
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: false
      });
    }
  });
}

  

  goToPage(pageNumber?: number, name?: string): void {
    this.customersState$ = this.customerService.searchCustomers$(name, pageNumber)
      .pipe(
        map(response => {
          console.log(response);
          this.dataSubject.next(response);
          this.currentPageSubject.next(pageNumber);
          return { dataState: DataState.LOADED, appData: response };
        }),
        startWith({ dataState: DataState.LOADED, appData: this.dataSubject.value }),
        catchError((error: string) => {
          return of({ dataState: DataState.LOADED, error, appData: this.dataSubject.value })
        })
      )
  }

  goToNextOrPreviousPage(direction?: string, name?: string): void {
    this.goToPage(direction === 'forward' ? this.currentPageSubject.value + 1 : this.currentPageSubject.value - 1, name);
  }

  selectCustomer(customer: Customer): void {
    this.router.navigate([`/customers/${customer.id}`]);
  }

  report(): void {
    this.customersState$ = this.customerService.downloadReport$()
      .pipe(
        map(response => {
          console.log(response);
          this.reportProgress(response);
          return { dataState: DataState.LOADED, appData: this.dataSubject.value };
        }),
        startWith({ dataState: DataState.LOADED, appData: this.dataSubject.value }),
        catchError((error: string) => {
          return of({ dataState: DataState.LOADED, error, appData: this.dataSubject.value })
        })
      )
  }

  private reportProgress(httpEvent: HttpEvent<string[] | Blob>): void {
    switch (httpEvent.type) {
      case HttpEventType.DownloadProgress || HttpEventType.UploadProgress:
        this.fileStatusSubject.next({ status: 'progress', type: 'Downloading...', percent: Math.round(100 * httpEvent.loaded / httpEvent.total) });
        break;
      case HttpEventType.ResponseHeader:
        console.log('Got response Headers', httpEvent);
        break;
      case HttpEventType.Response:
        saveAs(new File([<Blob>httpEvent.body], httpEvent.headers.get('File-Name'),
          { type: `${httpEvent.headers.get('Content-Type')};charset=utf-8` }));
        this.fileStatusSubject.next(undefined);
        break;
      default:
        console.log(httpEvent);
        break;
    }
  }

    /**
* Open modal
* @param content modal content
*/
// Open Modal with proper options
openModal(content: any) {
  this.modalService.open(content, {
    ariaLabelledBy: 'modal-basic-title',
    backdrop: 'static',  // This ensures the backdrop is properly handled
    keyboard: false      // Optional: Prevent closing the modal with the Esc key
  });
}



}
