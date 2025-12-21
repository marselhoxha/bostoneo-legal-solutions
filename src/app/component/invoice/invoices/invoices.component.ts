import { HttpEvent, HttpEventType } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, BehaviorSubject, map, startWith, catchError, of, switchMap, distinctUntilChanged, shareReplay, throwError } from 'rxjs';
import { DataState } from 'src/app/enum/datastate.enum';
import { CustomHttpResponse, Page } from 'src/app/interface/appstates';
import { Invoice } from 'src/app/interface/invoice';
import { InvoicePageResponse } from 'src/app/interface/invoice-response';
import { State } from 'src/app/interface/state';
import { User } from 'src/app/interface/user';
import { ClientService } from 'src/app/service/client.service';
import { InvoiceService } from 'src/app/service/invoice.service';
import { ApiResponseUtil } from 'src/app/core/utils/api-response.util';
import { saveAs } from 'file-saver';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { NewinvoiceComponent } from '../newinvoice/newinvoice.component';
import Swal from 'sweetalert2';


@Component({
  selector: 'app-invoices',
  templateUrl: './invoices.component.html',
  styleUrls: ['./invoices.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvoicesComponent implements OnInit {
  Math = Math; // Expose Math for template
  invoicesState$: Observable<State<InvoicePageResponse>>;
  private dataSubject = new BehaviorSubject<InvoicePageResponse>(null);
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
  private savedScrollPosition = 0;

  constructor(
    private router: Router, 
    private clientService: ClientService,
    private invoiceService: InvoiceService,
    private modalService: NgbModal,
    private cdRef: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadInvoices();
  }

  // Helper method to load invoices
  private loadInvoices$(page: number = 0): Observable<InvoicePageResponse> {
    return this.invoiceService.getInvoices(page, 10).pipe(
      catchError((error: any) => {
        const errorMessage = ApiResponseUtil.extractErrorMessage(error);
        return throwError(() => new Error(errorMessage));
      })
    );
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
      this.modalRef.close();
    }
  }

  // Method called when a new invoice is created
  onInvoiceCreated(newInvoice: any): void {
    // Refresh the invoice list (go to first page)
    this.goToPage(0);
    
    // Close the modal after invoice creation
    if (this.modalRef) {
      this.modalRef.close();
    }
  }

  // Load invoices based on the current page
  loadInvoices(): void {
    const currentPage = this.currentPageSubject.value;

    if (currentPage > 0) {
      this.saveScrollPosition();
    }

    this.isLoadingSubject.next(true);
    this.invoicesState$ = this.loadInvoices$(currentPage)
      .pipe(
        map(response => {
          this.dataSubject.next(response);
          this.isLoadingSubject.next(false);

          if (currentPage > 0 && this.savedScrollPosition > 0) {
            setTimeout(() => this.restoreScrollPosition(), 100);
          }

          return { dataState: DataState.LOADED, appData: response };
        }),
        catchError((error: string) => {
          this.isLoadingSubject.next(false);
          return of({ dataState: DataState.ERROR, error });
        })
      );
  }

  // Go to specific page
  goToPage(pageNumber?: number): void {
    if (this.isLoadingSubject.value) return;
    if (pageNumber === this.currentPageSubject.value) return;

    const totalPages = this.dataSubject.value?.data?.totalPages || 0;
    if (pageNumber < 0 || pageNumber >= totalPages) return;

    this.saveScrollPosition();
    this.currentPageSubject.next(pageNumber);
    this.isLoadingSubject.next(true);

    this.invoicesState$ = this.loadInvoices$(pageNumber)
      .pipe(
        map(response => {
          this.dataSubject.next(response);
          this.isLoadingSubject.next(false);
          setTimeout(() => this.restoreScrollPosition(), 100);
          return { dataState: DataState.LOADED, appData: response };
        }),
        catchError((error: string) => {
          this.isLoadingSubject.next(false);
          return of({ dataState: DataState.ERROR, error });
        })
      );
  }

  private saveScrollPosition(): void {
    this.savedScrollPosition = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  private restoreScrollPosition(): void {
    if (this.savedScrollPosition < 50) return;

    const tableElement = document.querySelector('#invoiceList');
    if (tableElement) {
      const tableTop = tableElement.getBoundingClientRect().top + window.pageYOffset;
      const tableBottom = tableTop + tableElement.clientHeight;

      if (this.savedScrollPosition < tableTop - 100) {
        this.savedScrollPosition = Math.max(tableTop - 100, 0);
      } else if (this.savedScrollPosition > tableBottom) {
        this.savedScrollPosition = tableTop - 50;
      }
    }

    window.scrollTo({ top: this.savedScrollPosition, behavior: 'auto' });
  }

  goToNextOrPreviousPage(direction?: string): void {
    const currentPage = this.currentPageSubject.value;
    const newPage = direction === 'forward' ? currentPage + 1 : currentPage - 1;

    if (this.isLoadingSubject.value) return;

    const totalPages = this.dataSubject.value?.data?.totalPages || 0;
    if (newPage < 0 || newPage >= totalPages) return;

    this.goToPage(newPage);
  }

  deleteInvoice(invoiceId: number): void {
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
        this.invoiceService.deleteInvoice(invoiceId).subscribe(
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

            // Detect if the error is a permission issue
            const errorMessage = error || 'There was a problem deleting the invoice.';

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
          text: 'Your invoice is safe :)',
          icon: 'info',
          timer: 2000,
          timerProgressBar: true,
          showConfirmButton: false
        });
      }
    });
  }

  editInvoice(invoice: Invoice): void {
    // Navigate to edit invoice page
    this.router.navigate(['/invoices', invoice.id, 'edit']);
  }

  downloadPDF(invoiceId: number): void {
    this.invoiceService.generateInvoicePdf(invoiceId).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `invoice-${invoiceId}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Error downloading PDF:', error);
        Swal.fire({
          title: 'Error!',
          text: 'Failed to download PDF. Please try again.',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    });
  }

  sendInvoiceEmail(invoice: Invoice): void {
    Swal.fire({
      title: 'Send Invoice Email',
      html: `
        <div class="mb-3">
          <label for="email" class="form-label">Email Address:</label>
          <input type="email" id="email" class="form-control" placeholder="Enter email address" value="">
        </div>
        <div class="mb-3">
          <label for="subject" class="form-label">Subject:</label>
          <input type="text" id="subject" class="form-control" placeholder="Email subject" value="Invoice ${invoice.invoiceNumber}">
        </div>
        <div class="mb-3">
          <label for="message" class="form-label">Message:</label>
          <textarea id="message" class="form-control" rows="3" placeholder="Optional message"></textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Send Email',
      cancelButtonText: 'Cancel',
      preConfirm: () => {
        const email = (document.getElementById('email') as HTMLInputElement).value;
        const subject = (document.getElementById('subject') as HTMLInputElement).value;
        const message = (document.getElementById('message') as HTMLTextAreaElement).value;

        if (!email) {
          Swal.showValidationMessage('Please enter an email address');
          return false;
        }

        return { email, subject, message };
      }
    }).then((result) => {
      if (result.isConfirmed) {
        const { email, subject, message } = result.value;
        
        this.invoiceService.sendInvoiceByEmail(invoice.id, email, subject, message).subscribe({
          next: () => {
            Swal.fire({
              title: 'Success!',
              text: 'Invoice email sent successfully.',
              icon: 'success',
              timer: 2000,
              timerProgressBar: true,
              showConfirmButton: false
            });
          },
          error: (error) => {
            console.error('Error sending email:', error);
            Swal.fire({
              title: 'Error!',
              text: 'Failed to send email. Please try again.',
              icon: 'error',
              confirmButtonText: 'OK'
            });
          }
        });
      }
    });
  }

  changeStatus(invoice: Invoice): void {
    Swal.fire({
      title: 'Change Invoice Status',
      text: `Mark invoice ${invoice.invoiceNumber} as paid?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, mark as paid',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.invoiceService.changeInvoiceStatus(invoice.id, 'PAID').subscribe({
          next: () => {
            Swal.fire({
              title: 'Success!',
              text: 'Invoice status updated successfully.',
              icon: 'success',
              timer: 2000,
              timerProgressBar: true,
              showConfirmButton: false
            });
            
            // Refresh the current page
            this.goToPage(this.currentPageSubject.value);
          },
          error: (error) => {
            console.error('Error updating status:', error);
            Swal.fire({
              title: 'Error!',
              text: 'Failed to update invoice status. Please try again.',
              icon: 'error',
              confirmButtonText: 'OK'
            });
          }
        });
      }
    });
  }

  // Check if a date is overdue
  isOverdue(dueDate: string | Date): boolean {
    if (!dueDate) return false;
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  }

  report(): void {
    this.invoicesState$ = this.clientService.downloadInvoiceReport$()
      .pipe(
        map(response => {
          console.log(response);
          this.reportProgress(response);
          return { dataState: DataState.LOADED, appData: this.dataSubject.value };
        }),
        startWith({ dataState: DataState.LOADED, appData: this.dataSubject.value }),
        catchError((error: string) => {
          return of({ dataState: DataState.LOADED, error, appData: this.dataSubject.value });
        })
      );
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
