import { ChangeDetectionStrategy, Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { Observable, BehaviorSubject, switchMap, map, startWith, catchError, of } from 'rxjs';
import { DataState } from 'src/app/enum/datastate.enum';
import { CustomHttpResponse } from 'src/app/interface/appstates';
import { Client } from 'src/app/interface/client';
import { Invoice } from 'src/app/interface/invoice';
import { State } from 'src/app/interface/state';
import { User } from 'src/app/interface/user';
import { ClientService } from 'src/app/service/client.service';
import { InvoiceService } from 'src/app/service/invoice.service';
import { jsPDF as pdf } from 'jspdf';
import html2pdf from 'html2pdf.js';
import Swal from 'sweetalert2';
import { saveAs } from 'file-saver';
import { LegalCaseService } from 'src/app/modules/legal/services/legal-case.service';

// Define FlatpickrOptions locally since import is causing issues
interface FlatpickrOptions {
  altInput?: boolean;
  altFormat?: string;
  dateFormat?: string;
  defaultDate?: Date;
}

const INVOICE_ID = 'id';

@Component({
  selector: 'app-invoice',
  templateUrl: './invoice-detail.component.html',
  styleUrls: ['./invoice-detail.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvoiceDetailComponent implements OnInit {
  invoiceState$: Observable<State<any>>;
  private dataSubject = new BehaviorSubject<any>(null);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();
  readonly DataState = DataState;
  
  // New properties for inline editing and creation
  isNewInvoice = false;
  editMode = false; // New property to control edit mode
  editingField: { [key: string]: boolean } = {};
  
  // Edit mode properties
  editableInvoice: any = {
    clientId: null,
    clientName: '',
    legalCaseId: null,
    caseName: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
    notes: '',
    quantity: 1,
    rate: 0,
    subtotal: 0,
    taxRate: 8.25, // Default tax rate
    taxAmount: 0,
    totalAmount: 0
  };
  
  // Store full client and case details for display
  selectedClient: any = null;
  selectedCase: any = null;
  
  // Computed property to check if this is create mode
  get isCreateMode(): boolean {
    return this.isNewInvoice;
  }
  
  // Computed property to get the current mode for display
  get currentMode(): string {
    if (this.isNewInvoice) return 'Create';
    if (this.editMode) return 'Edit';
    return 'View';
  }
  
  invoiceItems: any[] = [{
    description: 'Legal Services',
    details: '',
    quantity: 1,
    rate: 0,
    total: 0
  }];
  
  clients$: Observable<any>;
  cases$: Observable<any>;
  
  dateConfig: FlatpickrOptions = {
    altInput: true,
    altFormat: 'M d, Y',
    dateFormat: 'Y-m-d',
    defaultDate: new Date()
  };
  
  // Add window property for print function
  window = window;

  constructor(
    private activatedRoute: ActivatedRoute, 
    private clientService: ClientService,
    private invoiceService: InvoiceService,
    private router: Router,
    private legalCaseService: LegalCaseService
  ) { }

  ngOnInit(): void {
    // Load clients and cases for dropdowns - extract arrays from API responses
    this.clients$ = this.clientService.allClients$().pipe(
      map((response: any) => {
        console.log('Clients response:', response);
        // The response structure is: { data: { page: { content: Client[] }, user: {...} }, ... }
        if (response?.data?.page?.content && Array.isArray(response.data.page.content)) {
          return response.data.page.content;
        } else if (response?.data?.content && Array.isArray(response.data.content)) {
          return response.data.content;
        } else if (response?.data && Array.isArray(response.data)) {
          return response.data;
        } else if (Array.isArray(response)) {
          return response;
        }
        console.warn('Unexpected clients response structure:', response);
        return [];
      }),
      catchError(error => {
        console.error('Error loading clients:', error);
        return of([]);
      })
    );
    
    this.cases$ = this.legalCaseService.getAllCases().pipe(
      map((response: any) => {
        console.log('Cases response:', response);
        // Handle different possible response structures
        if (response?.data?.page?.content && Array.isArray(response.data.page.content)) {
          return response.data.page.content;
        } else if (response?.data?.content && Array.isArray(response.data.content)) {
          return response.data.content;
        } else if (response?.data && Array.isArray(response.data)) {
          return response.data;
        } else if (Array.isArray(response)) {
          return response;
        }
        console.warn('Unexpected cases response structure:', response);
        return [];
      }),
      catchError(error => {
        console.error('Error loading cases:', error);
        return of([]);
      })
    );
    
    // Check if this is a new invoice creation or edit
    this.activatedRoute.paramMap.subscribe((params: ParamMap) => {
      const invoiceId = params.get(INVOICE_ID);
      const currentUrl = this.router.url;
      
      if (invoiceId === 'new' || currentUrl.includes('/invoices/new')) {
        // New invoice creation mode
        this.isNewInvoice = true;
        this.invoiceState$ = of({ 
          dataState: DataState.LOADED, 
          appData: { data: null } 
        });
        this.initializeNewInvoice();
      } else if (currentUrl.includes('/invoices/edit/') || invoiceId) {
        // Existing invoice editing mode
        this.isNewInvoice = false;
        const idToLoad = currentUrl.includes('/invoices/edit/') 
          ? currentUrl.split('/invoices/edit/')[1] 
          : invoiceId;
        this.loadExistingInvoice(+idToLoad);
      }
    });
  }

  private initializeNewInvoice(): void {
    // Initialize with default values for new invoice
    this.editableInvoice = {
      clientId: null,
      clientName: '',
      legalCaseId: null,
      caseName: '',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: '',
      quantity: 1,
      rate: 0,
      subtotal: 0,
      taxRate: 8.25,
      taxAmount: 0,
      totalAmount: 0
    };
    
    this.invoiceItems = [{
      description: 'Legal Services',
      details: '',
      quantity: 1,
      rate: 0,
      total: 0
    }];
    
    this.editMode = true; // New invoices start in edit mode
    this.calculateTotals();
  }

  private loadExistingInvoice(invoiceId: number): void {
    this.editMode = false; // Existing invoices start in view mode
    this.invoiceState$ = this.invoiceService.getInvoiceById(invoiceId)
      .pipe(
        map(response => {
          console.log(response);
          this.dataSubject.next(response);
          
          // Initialize invoice items from response
          if (response?.data) {
            this.initializeEditableInvoice(response.data);
          }
          
          return { dataState: DataState.LOADED, appData: response };
        }),
        startWith({ dataState: DataState.LOADING }),
        catchError((error: string) => {
          return of({ dataState: DataState.ERROR, error })
        })
      );
  }

  private initializeEditableInvoice(invoice: any): void {
    this.editableInvoice = {
      clientId: invoice.clientId || null,
      clientName: invoice.clientName || '',
      legalCaseId: invoice.legalCaseId || null,
      caseName: invoice.caseName || '',
      issueDate: invoice.issueDate ? invoice.issueDate.split('T')[0] : new Date().toISOString().split('T')[0],
      dueDate: invoice.dueDate ? invoice.dueDate.split('T')[0] : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: invoice.notes || '',
      quantity: 1,
      rate: invoice.subtotal || 0,
      subtotal: invoice.subtotal || 0,
      taxRate: invoice.taxRate || 8.25,
      taxAmount: invoice.taxAmount || 0,
      totalAmount: invoice.totalAmount || 0
    };
    
    // Load full client details if clientId exists
    if (invoice.clientId) {
      this.loadClientDetails(invoice.clientId);
    }
    
    // Load full case details if legalCaseId exists
    if (invoice.legalCaseId) {
      this.loadCaseDetails(invoice.legalCaseId);
    }
    
    this.initializeInvoiceItems(invoice);
  }

  private loadClientDetails(clientId: any): void {
    this.clientService.client$(clientId).subscribe({
      next: (clientResponse) => {
        if (clientResponse?.data?.client) {
          this.selectedClient = clientResponse.data.client;
          this.editableInvoice.clientName = this.selectedClient.name;
        }
      },
      error: (error) => {
        console.error('Error loading client details:', error);
        this.selectedClient = null;
      }
    });
  }

  private loadCaseDetails(caseId: any): void {
    this.legalCaseService.getCaseById(caseId).subscribe({
      next: (caseResponse: any) => {
        if (caseResponse?.data) {
          this.selectedCase = caseResponse.data;
          this.editableInvoice.caseName = this.selectedCase.title || this.selectedCase.caseName;
        } else if (caseResponse?.title) {
          this.selectedCase = caseResponse;
          this.editableInvoice.caseName = caseResponse.title;
        }
      },
      error: (error) => {
        console.error('Error loading case details:', error);
        this.selectedCase = null;
      }
    });
  }

  // Inline editing methods
  startEdit(fieldName: string): void {
    // Only allow editing if in edit mode
    if (!this.isInvoiceEditable) {
      return;
    }
    
    this.editingField[fieldName] = true;
    
    // Focus the input after a brief delay to allow Angular to render it
    setTimeout(() => {
      const inputElement = this.getInputElement(fieldName);
      if (inputElement) {
        inputElement.focus();
        if (inputElement.type === 'text' || inputElement.tagName === 'TEXTAREA') {
          inputElement.select();
        }
      }
    }, 100);
  }

  finishEdit(fieldName: string): void {
    this.editingField[fieldName] = false;
    
    // Recalculate totals if needed
    if (fieldName.includes('item-') || fieldName === 'taxRate') {
      this.calculateTotals();
    }
  }

  private getInputElement(fieldName: string): HTMLInputElement | HTMLTextAreaElement | null {
    const selectors = [
      `input[ng-reflect-name*="${fieldName}"]`,
      `textarea[ng-reflect-name*="${fieldName}"]`,
      `#${fieldName}Input`,
      `#${fieldName}Textarea`
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
      if (element) {
        return element;
      }
    }
    
    return null;
  }

  // Client and case selection handlers
  onClientChange(clientId: any): void {
    console.log('Client changed:', clientId);
    if (clientId) {
      this.editableInvoice.clientId = clientId;
      this.loadClientDetails(clientId);
    } else {
      this.selectedClient = null;
      this.editableInvoice.clientId = null;
      this.editableInvoice.clientName = '';
    }
    this.finishEdit('client');
  }

  onCaseChange(caseId: any): void {
    console.log('Case changed:', caseId);
    if (caseId) {
      this.editableInvoice.legalCaseId = caseId;
      this.loadCaseDetails(caseId);
    } else {
      this.selectedCase = null;
      this.editableInvoice.legalCaseId = null;
      this.editableInvoice.caseName = '';
    }
    this.finishEdit('case');
  }

  // Save invoice (works for both create and update)
  saveInvoice(): void {
    // Validate required fields
    if (!this.editableInvoice.clientId) {
      Swal.fire({
        title: 'Validation Error',
        text: 'Please select a client',
        icon: 'warning'
      });
      return;
    }

    if (this.invoiceItems.length === 0 || !this.invoiceItems.some(item => item.description && item.rate > 0)) {
      Swal.fire({
        title: 'Validation Error',
        text: 'Please add at least one invoice item with description and rate',
        icon: 'warning'
      });
      return;
    }

    this.isLoadingSubject.next(true);
    
    // Prepare invoice data - only send fields that exist in the backend Invoice model
    const invoiceData = {
      clientId: this.editableInvoice.clientId,
      clientName: this.editableInvoice.clientName,
      legalCaseId: this.editableInvoice.legalCaseId,
      caseName: this.editableInvoice.caseName,
      issueDate: this.editableInvoice.issueDate,
      dueDate: this.editableInvoice.dueDate,
      notes: this.editableInvoice.notes,
      subtotal: this.editableInvoice.subtotal,
      taxRate: this.editableInvoice.taxRate,
      taxAmount: this.editableInvoice.taxAmount,
      totalAmount: this.editableInvoice.totalAmount,
      status: 'DRAFT' as 'DRAFT'
    };

    const saveOperation = this.isNewInvoice 
      ? this.invoiceService.createInvoice(invoiceData)
      : this.invoiceService.updateInvoice(this.dataSubject.value?.data?.id, invoiceData);

    saveOperation.subscribe({
      next: (response) => {
        const successMessage = this.isNewInvoice ? 'Invoice created successfully' : 'Invoice updated successfully';
        
        Swal.fire({
          title: 'Success!',
          text: successMessage,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        }).then(() => {
          if (this.isNewInvoice) {
            // Navigate to the newly created invoice
            this.router.navigate(['/invoices', response.data.id]);
          } else {
            // Update the current data and exit edit mode
            this.dataSubject.next(response);
            this.initializeEditableInvoice(response.data);
            this.exitEditMode();
          }
        });
        
        this.isLoadingSubject.next(false);
      },
      error: (error) => {
        console.error('Error saving invoice:', error);
        Swal.fire({
          title: 'Error!',
          text: `Failed to ${this.isNewInvoice ? 'create' : 'update'} invoice`,
          icon: 'error'
        });
        this.isLoadingSubject.next(false);
      }
    });
  }

  cancelInvoice(): void {
    if (this.isNewInvoice) {
      this.router.navigate(['/invoices']);
    } else {
      this.router.navigate(['/invoices']);
    }
  }

  downloadPDF(): void {
    const invoiceData = this.dataSubject.value?.data;
    if (!invoiceData || !invoiceData.id) {
      Swal.fire({
        title: 'Error!',
        text: 'Invoice data not available',
        icon: 'error'
      });
      return;
    }

    this.isLoadingSubject.next(true);
    this.invoiceService.generateInvoicePdf(invoiceData.id).subscribe({
      next: (blob) => {
        saveAs(blob, `invoice-${invoiceData.invoiceNumber}.pdf`);
        Swal.fire({
          title: 'Success!',
          text: 'Invoice PDF downloaded successfully',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
        this.isLoadingSubject.next(false);
      },
      error: (error) => {
        console.error('Error downloading PDF:', error);
        Swal.fire({
          title: 'Error!',
          text: 'Failed to download invoice PDF',
          icon: 'error'
        });
        this.isLoadingSubject.next(false);
      }
    });
  }

  sendEmail(): void {
    const invoiceData = this.dataSubject.value?.data;
    if (!invoiceData || !invoiceData.id) {
      Swal.fire({
        title: 'Error!',
        text: 'Invoice data not available',
        icon: 'error'
      });
      return;
    }

    if (!invoiceData.clientId) {
      Swal.fire({
        title: 'Error!',
        text: 'Client information not available',
        icon: 'error'
      });
      return;
    }

    this.isLoadingSubject.next(true);
    
    this.clientService.client$(invoiceData.clientId).subscribe({
      next: (clientResponse) => {
        let clientEmail = '';
        
        if (clientResponse?.data?.client?.email) {
          clientEmail = clientResponse.data.client.email;
        }

        if (!clientEmail) {
          this.isLoadingSubject.next(false);
          Swal.fire({
            title: 'Error!',
            text: 'Client email address not found',
            icon: 'error'
          });
          return;
        }

        Swal.fire({
          title: 'Send Invoice Email',
          text: `Send invoice ${invoiceData.invoiceNumber} to ${clientEmail}?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Send Email',
          cancelButtonText: 'Cancel'
        }).then((result) => {
          if (result.isConfirmed) {
            this.invoiceService.sendInvoiceByEmail(invoiceData.id, clientEmail).subscribe({
              next: () => {
                Swal.fire({
                  title: 'Email Sent!',
                  text: 'Invoice has been sent successfully',
                  icon: 'success',
                  timer: 2000,
                  showConfirmButton: false
                });
                this.isLoadingSubject.next(false);
              },
              error: (error) => {
                console.error('Error sending email:', error);
                Swal.fire({
                  title: 'Error!',
                  text: 'Failed to send invoice email',
                  icon: 'error'
                });
                this.isLoadingSubject.next(false);
              }
            });
          } else {
            this.isLoadingSubject.next(false);
          }
        });
      },
      error: (error) => {
        console.error('Error loading client details:', error);
        this.isLoadingSubject.next(false);
        Swal.fire({
          title: 'Error!',
          text: 'Failed to load client information',
          icon: 'error'
        });
      }
    });
  }

  deleteInvoice(): void {
    const invoiceData = this.dataSubject.value?.data;
    if (!invoiceData || !invoiceData.id) {
      Swal.fire({
        title: 'Error!',
        text: 'Invoice data not available',
        icon: 'error'
      });
      return;
    }

    Swal.fire({
      title: 'Delete Invoice?',
      text: `Are you sure you want to delete invoice ${invoiceData.invoiceNumber}? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc3545'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isLoadingSubject.next(true);
        this.invoiceService.deleteInvoice(invoiceData.id).subscribe({
          next: () => {
            Swal.fire({
              title: 'Deleted!',
              text: 'Invoice has been deleted successfully',
              icon: 'success',
              timer: 2000,
              showConfirmButton: false
            }).then(() => {
              this.router.navigate(['/invoices']);
            });
          },
          error: (error) => {
            console.error('Error deleting invoice:', error);
            Swal.fire({
              title: 'Error!',
              text: 'Failed to delete invoice',
              icon: 'error'
            });
            this.isLoadingSubject.next(false);
          }
        });
      }
    });
  }

  calculateTotals(): void {
    // Calculate subtotal from all items
    this.editableInvoice.subtotal = this.invoiceItems.reduce((sum, item) => sum + (item.total || 0), 0);
    
    // Calculate tax
    this.editableInvoice.taxAmount = this.editableInvoice.subtotal * (this.editableInvoice.taxRate / 100);
    
    // Calculate total
    this.editableInvoice.totalAmount = this.editableInvoice.subtotal + this.editableInvoice.taxAmount;
  }
  
  initializeInvoiceItems(invoice: any): void {
    // Initialize with existing items or create default item
    if (invoice.items && invoice.items.length > 0) {
      this.invoiceItems = invoice.items.map((item: any) => ({
        description: item.description || '',
        details: item.details || '',
        quantity: item.quantity || 1,
        rate: item.rate || 0,
        total: (item.quantity || 1) * (item.rate || 0)
      }));
    } else {
      // Create default item based on invoice data
      this.invoiceItems = [{
        description: invoice.service || 'Legal Services',
        details: '',
        quantity: invoice.quantity || 1,
        rate: invoice.rate || invoice.subtotal || 0,
        total: invoice.subtotal || 0
      }];
    }
    
    this.calculateTotals();
  }
  
  calculateItemTotal(index: number): void {
    const item = this.invoiceItems[index];
    item.total = (item.quantity || 0) * (item.rate || 0);
    this.calculateTotals();
  }
  
  addItem(): void {
    this.invoiceItems.push({
      description: '',
      details: '',
      quantity: 1,
      rate: 0,
      total: 0
    });
  }
  
  removeItem(index: number): void {
    if (this.invoiceItems.length > 1) {
      this.invoiceItems.splice(index, 1);
      this.calculateTotals();
    } else {
      Swal.fire({
        title: 'Warning',
        text: 'Invoice must have at least one item',
        icon: 'warning'
      });
    }
  }

  // Edit mode control methods
  enterEditMode(): void {
    this.editMode = true;
  }

  exitEditMode(): void {
    this.editMode = false;
    // Clear any active editing fields
    this.editingField = {};
  }

  cancelEdit(): void {
    // Reset to original data
    const originalData = this.dataSubject.value?.data;
    if (originalData) {
      this.initializeEditableInvoice(originalData);
    }
    this.exitEditMode();
  }

  // Computed property to check if invoice is editable
  get isInvoiceEditable(): boolean {
    if (this.isNewInvoice) return true;
    const currentData = this.dataSubject.value?.data;
    const isNotPaid = currentData?.status !== 'PAID';
    return isNotPaid && this.editMode; // Must be not paid AND in edit mode
  }
  
  // Computed property to check if edit button should be shown
  get showEditButton(): boolean {
    if (this.isNewInvoice) return false;
    const currentData = this.dataSubject.value?.data;
    return currentData?.status !== 'PAID' && !this.editMode;
  }
}
