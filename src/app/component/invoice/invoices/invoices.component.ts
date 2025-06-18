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
    // Debug authentication status
    console.log('🔍 Invoices Component - Authentication Debug:');
    console.log('- Token exists:', !!localStorage.getItem('TOKEN'));
    console.log('- Token value:', localStorage.getItem('TOKEN')?.substring(0, 50) + '...');
    console.log('- All localStorage keys:', Object.keys(localStorage));
    
    // Initialize invoices state - Load initial data immediately
    this.loadInvoices();
  }

  // Helper method to load invoices (similar to client's searchClients$)
  private loadInvoices$(page: number = 0): Observable<InvoicePageResponse> {
    console.log('🔍 Loading invoices for page:', page);
    return this.invoiceService.getInvoices(page, 10).pipe(
      map(response => {
        console.log('📊 Raw invoice service response:', response);
        console.log('📊 Response data:', response.data);
        console.log('📊 Response data content:', response.data?.content);
        console.log('📊 Response data totalPages:', response.data?.totalPages);
        console.log('📊 Response data structure:', {
          hasData: !!response.data,
          hasContent: !!response.data?.content,
          contentLength: response.data?.content?.length,
          totalPages: response.data?.totalPages,
          totalElements: response.data?.totalElements,
          currentPage: response.data?.number
        });
        return response;
      }),
      catchError((error: any) => {
        console.error('❌ Error loading invoices:', error);
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

  // Load invoices based on the current page (similar to clients component)
  loadInvoices(): void {
    const currentPage = this.currentPageSubject.value;
    console.log('🔄 loadInvoices called for page:', currentPage);
    
    // Save scroll position for initial loads (except first load)
    if (currentPage > 0) {
      this.saveScrollPosition();
    }
    
    this.isLoadingSubject.next(true);
    this.invoicesState$ = this.loadInvoices$(currentPage)
      .pipe(
        map(response => {
          console.log('✅ loadInvoices - setting dataSubject with:', response);
          this.dataSubject.next(response);
          this.isLoadingSubject.next(false);
          
          // Restore scroll position if it was saved
          if (currentPage > 0 && this.savedScrollPosition > 0) {
            setTimeout(() => this.restoreScrollPosition(), 100);
          }
          
          return { dataState: DataState.LOADED, appData: response };
        }),
        catchError((error: string) => {
          console.error('❌ Error in loadInvoices:', error);
          this.isLoadingSubject.next(false);
          return of({ dataState: DataState.ERROR, error });
        })
      );
  }

  // Go to specific page (following client component pattern)
  goToPage(pageNumber?: number): void {
    console.log('🔄 goToPage called with pageNumber:', pageNumber);
    console.log('🔄 Current page before navigation:', this.currentPageSubject.value);
    
    // Prevent navigation if already loading or same page
    if (this.isLoadingSubject.value) {
      console.log('🔄 Navigation blocked - already loading');
      return;
    }
    
    if (pageNumber === this.currentPageSubject.value) {
      console.log('🔄 Navigation blocked - same page');
      return;
    }
    
    // Check bounds
    const totalPages = this.dataSubject.value?.data?.totalPages || 0;
    if (pageNumber < 0 || pageNumber >= totalPages) {
      console.log('🔄 Navigation blocked - out of bounds');
      return;
    }
    
    // Save current scroll position
    this.saveScrollPosition();
    
    // Update current page first
    this.currentPageSubject.next(pageNumber);
    
    // Set loading state without flickering
    this.isLoadingSubject.next(true);
    
    // Create a fresh observable for this page request
    this.invoicesState$ = this.loadInvoices$(pageNumber)
      .pipe(
        map(response => {
          console.log('🔄 Page response in goToPage:', response);
          console.log('🔄 Setting fresh data for page:', pageNumber);
          this.dataSubject.next(response);
          this.isLoadingSubject.next(false);
          
          // Restore scroll position after a brief delay to allow DOM updates
          setTimeout(() => this.restoreScrollPosition(), 100);
          
          return { dataState: DataState.LOADED, appData: response };
        }),
        catchError((error: string) => {
          console.error('❌ Error in goToPage:', error);
          this.isLoadingSubject.next(false);
          return of({ dataState: DataState.ERROR, error });
        })
      );
  }

  // Save current scroll position
  private saveScrollPosition(): void {
    this.savedScrollPosition = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    console.log('📍 Saved scroll position:', this.savedScrollPosition);
  }

  // Restore scroll position
  private restoreScrollPosition(): void {
    console.log('📍 Restoring scroll position to:', this.savedScrollPosition);
    
    // If the saved position is very close to the top, keep it at the top
    if (this.savedScrollPosition < 50) {
      return;
    }
    
    // Try to find the table element to ensure it's in view
    const tableElement = document.querySelector('#invoiceList');
    if (tableElement) {
      const tableTop = tableElement.getBoundingClientRect().top + window.pageYOffset;
      const tableBottom = tableTop + tableElement.clientHeight;
      
      // If the saved position would put the table out of view, adjust it
      if (this.savedScrollPosition < tableTop - 100) {
        this.savedScrollPosition = Math.max(tableTop - 100, 0);
      } else if (this.savedScrollPosition > tableBottom) {
        this.savedScrollPosition = tableTop - 50;
      }
    }
    
    window.scrollTo({
      top: this.savedScrollPosition,
      behavior: 'auto' // Use 'auto' for instant positioning
    });
  }

  // Go to next or previous page (following client component pattern)
  goToNextOrPreviousPage(direction?: string): void {
    const currentPage = this.currentPageSubject.value;
    const newPage = direction === 'forward' ? currentPage + 1 : currentPage - 1;
    
    // Prevent navigation if already loading or invalid page
    if (this.isLoadingSubject.value) {
      console.log('🔄 Navigation blocked - already loading');
      return;
    }
    
    // Check bounds
    const totalPages = this.dataSubject.value?.data?.totalPages || 0;
    if (newPage < 0 || newPage >= totalPages) {
      console.log('🔄 Navigation blocked - out of bounds');
      return;
    }
    
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
