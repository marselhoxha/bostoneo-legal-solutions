import { HttpEvent, HttpEventType } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, BehaviorSubject, map, startWith, catchError, of } from 'rxjs';
import { DataState } from 'src/app/enum/datastate.enum';
import { CustomHttpResponse, Page } from 'src/app/interface/appstates';
import { Invoice } from 'src/app/interface/invoice';
import { State } from 'src/app/interface/state';
import { User } from 'src/app/interface/user';
import { CustomerService } from 'src/app/service/customer.service';
import { saveAs } from 'file-saver';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { NewinvoiceComponent } from '../newinvoice/newinvoice.component';
import Swal from 'sweetalert2';


@Component({
  selector: 'app-invoices',
  templateUrl: './invoices.component.html',
  styleUrls: ['./invoices.component.css'],
  changeDetection: ChangeDetectionStrategy.Default  // Keep default for dynamic data
})
export class InvoicesComponent  implements OnInit {
  invoicesState$: Observable<State<CustomHttpResponse<Page<Invoice> & User>>>;
  private dataSubject = new BehaviorSubject<CustomHttpResponse<Page<Invoice> & User>>(null);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();
  private currentPageSubject = new BehaviorSubject<number>(0);
  currentPage$ = this.currentPageSubject.asObservable();
  private showLogsSubject = new BehaviorSubject<boolean>(false);
  showLogs$ = this.showLogsSubject.asObservable();
  private fileStatusSubject = new BehaviorSubject<{ status: string, type: string, percent: number }>(undefined);
  fileStatus$ = this.fileStatusSubject.asObservable();
  readonly DataState = DataState;
  private modalRef: NgbModalRef;

  constructor(private router: Router, private customerService: CustomerService,private modalService: NgbModal,private cdRef: ChangeDetectorRef) { }

  ngOnInit(): void {
    // Initial load for invoices
    this.loadInvoices();

    this.invoicesState$ = this.customerService.invoices$()
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
  // Open the modal for creating a new invoice
  openNewInvoiceModal(): void {
    this.modalRef = this.modalService.open(NewinvoiceComponent, { size: 'lg', backdrop: 'static' });

    // Listen for when the modal is closed or an invoice is created
    this.modalRef.componentInstance.invoiceCreated.subscribe((newInvoice: any) => {
      this.onInvoiceCreated(newInvoice);
    });
  }
  // Close the modal
  closeModal(): void {
    if (this.modalRef) {
      this.modalRef.close(); // Closes the modal programmatically
    }
  }

  loadInvoices(): void {
    this.invoicesState$ = this.customerService.invoices$(this.currentPageSubject.value)
      .pipe(
        map(response => {
          console.log('Invoices reloaded', response);
          this.dataSubject.next(response);  // Update the data with the reloaded list
          return { dataState: DataState.LOADED, appData: response };
        }),
        startWith({ dataState: DataState.LOADING }),
        catchError((error: string) => {
          console.error(error);
          return of({ dataState: DataState.ERROR, error });
        })
      );
  }
  
  

  // Method called when a new invoice is created
  onInvoiceCreated(newInvoice: any): void {
    // Refresh the invoice table
    this.goToPage(this.currentPageSubject.value);  // This should reload the current page with updated data
    
    // Trigger change detection manually to update the view
     this.cdRef.detectChanges();
     
    // Close the modal after invoice creation
    if (this.modalRef) {
      this.modalRef.close();
    }
  }

  goToPage(pageNumber?: number): void {
    this.invoicesState$ = this.customerService.invoices$(pageNumber)
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

  goToNextOrPreviousPage(direction?: string): void {
    this.goToPage(direction === 'forward' ? this.currentPageSubject.value + 1 : this.currentPageSubject.value - 1);
  }



  deleteInvoice(invoiceId: number): void {
    // Show confirmation dialog using SweetAlert2
    Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to delete this invoice?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'No, cancel!',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        // If user confirms, proceed with deletion
        this.customerService.deleteInvoice$(invoiceId).subscribe(
          () => {
            console.log(`Invoice ${invoiceId} deleted successfully`);
  
            // Show success message using SweetAlert2
            Swal.fire({
              title: 'Deleted!',
              text: 'The invoice has been deleted successfully.',
              icon: 'success',
              timer: 2000,
              timerProgressBar: true,
              showConfirmButton: false
            });
  
            // Reload the first page of invoices after deletion
            this.goToPage(0);
  
            // Optionally, trigger change detection manually
            this.cdRef.detectChanges();
          },
          error => {
            console.error('Error deleting invoice:', error);
  
            // Show error message using SweetAlert2
            Swal.fire({
              title: 'Error!',
              text: 'There was a problem deleting the invoice.',
              icon: 'error',
              confirmButtonText: 'OK'
            });
          }
        );
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        // If user cancels, show cancellation message
        Swal.fire({
          title: 'Cancelled',
          text: 'Your invoice is safe :)',
          icon: 'info',
          timer: 2000,
          timerProgressBar: true,
          showConfirmButton: false
        });
      }
    });
  }
  

  

  report(): void {
    this.invoicesState$ = this.customerService.downloadInvoiceReport$()
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

}
