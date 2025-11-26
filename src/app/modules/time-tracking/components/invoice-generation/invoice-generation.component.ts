import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TimeTrackingService, TimeEntry } from '../../services/time-tracking.service';
import { InvoiceService as TimeTrackingInvoiceService, Invoice as TimeTrackingInvoice } from '../../services/invoice.service';
import { ClientService } from '../../../../service/client.service';
import { LegalCaseService } from '../../../legal/services/legal-case.service';
import { Invoice } from '../../../../interface/invoice';
import Swal from 'sweetalert2';
import { HttpClient } from '@angular/common/http';
import { saveAs } from 'file-saver';
import { environment } from 'src/environments/environment';
import flatpickr from 'flatpickr';
import { Instance } from 'flatpickr/dist/types/instance';
import { NgSelectModule } from '@ng-select/ng-select';
import { Key } from '../../../../enum/key.enum';

interface Client {
  id: number;
  name: string;
  email: string;
  type?: string;
  status?: string;
}

interface LegalCase {
  id: number;
  client_id: number;
  case_number: string;
  title: string;
  client_name: string;
  status: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

// Create a simpler interface for invoice creation from time entries
interface InvoiceFromTimeEntries {
  clientId: number;
  clientName?: string;
  legalCaseId?: number;
  caseName?: string;
  issueDate: string;
  dueDate: string;
  taxRate: number;
  status: string;
  notes?: string;
}

@Component({
  selector: 'app-invoice-generation',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule, NgSelectModule],
  templateUrl: './invoice-generation.component.html',
  styleUrls: ['./invoice-generation.component.scss']
})
export class InvoiceGenerationComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('issueDatePicker') issueDatePicker!: ElementRef;
  @ViewChild('dueDatePicker') dueDatePicker!: ElementRef;
  
  // Form and data
  invoiceForm: FormGroup;
  timeEntries: TimeEntry[] = [];
  clients: Client[] = [];
  cases: LegalCase[] = [];
  filteredCases: LegalCase[] = [];
  users: User[] = [];
  selectedEntries: Set<number> = new Set();
  
  // UI state
  loading = false;
  loadingClients = false;
  loadingCases = false;
  isGenerating = false;
  error: string | null = null;
  
  // Invoice preview data
  previewData = {
    subtotal: 0,
    taxAmount: 0,
    totalAmount: 0,
    selectedEntriesCount: 0
  };
  
  // Generated invoice
  generatedInvoice: TimeTrackingInvoice | null = null;
  
  // Date pickers
  private issueDatePickerInstance: Instance | null = null;
  private dueDatePickerInstance: Instance | null = null;
  
  // Statuses for invoice
  statuses = ['DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED'];
  
  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private timeTrackingService: TimeTrackingService,
    private invoiceService: TimeTrackingInvoiceService,
    private clientService: ClientService,
    private legalCaseService: LegalCaseService,
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.checkAuthenticationStatus();
    this.initializeForm();
    this.loadClients();
    this.loadUsers();
    this.setupFormListeners();
  }

  ngAfterViewInit(): void {
    this.setupDatePickers();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.issueDatePickerInstance) {
      this.issueDatePickerInstance.destroy();
    }
    if (this.dueDatePickerInstance) {
      this.dueDatePickerInstance.destroy();
    }
  }

  private initializeForm(): void {
    const today = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // 30 days from now

    this.invoiceForm = this.fb.group({
      clientId: ['', Validators.required],
      legalCaseId: [''],
      issueDate: [today.toISOString().split('T')[0], Validators.required],
      dueDate: [dueDate.toISOString().split('T')[0], Validators.required],
      subtotal: [0, [Validators.required, Validators.min(0)]],
      taxRate: [0, [Validators.min(0), Validators.max(100)]],
      taxAmount: [{value: 0, disabled: true}],
      totalAmount: [{value: 0, disabled: true}],
      status: ['DRAFT', Validators.required],
      notes: [''],
      lineItems: this.fb.array([])
    });
  }

  private setupDatePickers(): void {
    // Issue date picker
    if (this.issueDatePicker?.nativeElement) {
      this.issueDatePickerInstance = flatpickr(this.issueDatePicker.nativeElement, {
        dateFormat: 'Y-m-d',
        defaultDate: new Date(),
        onChange: (selectedDates) => {
          if (selectedDates.length > 0) {
            this.invoiceForm.patchValue({
              issueDate: selectedDates[0].toISOString().split('T')[0]
            });
          }
        }
      });
    }

    // Due date picker
    if (this.dueDatePicker?.nativeElement) {
      this.dueDatePickerInstance = flatpickr(this.dueDatePicker.nativeElement, {
        dateFormat: 'Y-m-d',
        defaultDate: this.getDefaultDueDate(),
        minDate: new Date(),
        onChange: (selectedDates) => {
          if (selectedDates.length > 0) {
            this.invoiceForm.patchValue({
              dueDate: selectedDates[0].toISOString().split('T')[0]
            });
          }
        }
      });
    }
  }

  private setupFormListeners(): void {
    // Listen for client selection changes
    const clientSub = this.invoiceForm.get('clientId')?.valueChanges.subscribe(clientId => {
      console.log('Client selected:', clientId);
      
      // Enable/disable legal case selection based on client selection
      const legalCaseControl = this.invoiceForm.get('legalCaseId');
      if (clientId) {
        legalCaseControl?.enable();
        this.loadCases(clientId);
        this.loadUnbilledEntries(clientId);
      } else {
        legalCaseControl?.disable();
        legalCaseControl?.setValue(null);
        this.filteredCases = [];
        this.timeEntries = [];
        this.selectedEntries.clear();
        this.updatePreviewData();
      }
    });

    // Listen for legal case selection changes
    const caseSub = this.invoiceForm.get('legalCaseId')?.valueChanges.subscribe(caseId => {
      const clientId = this.invoiceForm.get('clientId')?.value;
      if (clientId) {
        console.log('Case selected:', caseId);
        this.loadUnbilledEntries(clientId, caseId);
      }
    });

    // Listen for tax rate changes
    const taxSub = this.invoiceForm.get('taxRate')?.valueChanges.subscribe(() => {
      this.updateTotals();
    });

    this.subscriptions.push(clientSub!, caseSub!, taxSub!);
  }

  private loadClients(): void {
    console.log('🔄 Starting to load clients...');
    this.loadingClients = true;
    this.clientService.allClients$().subscribe({
      next: (response: any) => {
        console.log('✅ All clients response received:', response);
        console.log('📑 Response type:', typeof response);
        console.log('📑 Response keys:', response ? Object.keys(response) : 'null');
        
        // Handle the actual response structure
        if (response && response.data) {
          console.log('📑 Response.data:', response.data);
          console.log('📑 Response.data type:', typeof response.data);
          console.log('📑 Response.data keys:', Object.keys(response.data));
          
          // Based on the logs, it looks like response.data has {page: {...}, user: {...}}
          // Let's specifically check for the page structure
          if (response.data.page) {
            console.log('📑 Response.data.page:', response.data.page);
            console.log('📑 Response.data.page keys:', Object.keys(response.data.page));
            
            if (response.data.page.content && Array.isArray(response.data.page.content)) {
              console.log('✅ Found clients in response.data.page.content:', response.data.page.content.length, 'clients');
              console.log('✅ First client sample:', response.data.page.content[0]);
              this.clients = response.data.page.content;
            } else {
              console.warn('⚠️ response.data.page.content is not an array:', response.data.page.content);
              this.clients = [];
            }
          }
          // Fallback: Check for direct content array: response.data.content
          else if (response.data.content && Array.isArray(response.data.content)) {
            console.log('✅ Found clients in response.data.content:', response.data.content.length, 'clients');
            this.clients = response.data.content;
          }
          // Fallback: Check if response.data is directly an array
          else if (Array.isArray(response.data)) {
            console.log('✅ Found clients in response.data array:', response.data.length, 'clients');
            this.clients = response.data;
          }
          // Fallback: Handle case where response.data has clients or other properties
          else if (response.data.clients && Array.isArray(response.data.clients)) {
            console.log('✅ Found clients in response.data.clients:', response.data.clients.length, 'clients');
            this.clients = response.data.clients;
          }
          else {
            console.warn('⚠️ Unexpected response.data structure. Checking all properties:', response.data);
            // Try to find any array property that might contain clients
            const arrayProperties = Object.keys(response.data).filter(key => 
              Array.isArray(response.data[key])
            );
            console.log('🔍 Array properties found:', arrayProperties);
            
            if (arrayProperties.length > 0) {
              const firstArrayProp = arrayProperties[0];
              console.log(`🔍 Using first array property '${firstArrayProp}':`, response.data[firstArrayProp]);
              this.clients = response.data[firstArrayProp];
            } else {
              console.warn('⚠️ No array properties found. Setting clients to empty array.');
              this.clients = [];
            }
          }
        } else {
          console.warn('⚠️ No response.data found:', response);
          this.clients = [];
        }
        
        console.log('📋 Final clients array:', this.clients);
        console.log('📋 Clients count:', this.clients.length);
        console.log('📋 Clients sample (first 3):', this.clients.slice(0, 3));
        
        this.loadingClients = false;
        // Trigger change detection
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Error loading clients:', error);
        console.error('❌ Error type:', typeof error);
        console.error('❌ Error keys:', error ? Object.keys(error) : 'null');
        console.error('❌ Error status:', error?.status);
        console.error('❌ Error message:', error?.message);
        console.error('❌ Error error:', error?.error);
        
        this.clients = [];
        this.loadingClients = false;
        this.cdr.detectChanges();
      }
    });
  }

  private loadUsers(): void {
    // Load users if needed for assignment
    // Implementation depends on your user service
  }

  private loadCases(clientId: number): void {
    this.loadingCases = true;
    this.legalCaseService.getCasesByClient(clientId).subscribe({
      next: (response: any) => {
        if (response.data && response.data.content) {
          this.filteredCases = response.data.content;
        } else {
          this.filteredCases = [];
        }
        this.loadingCases = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading cases:', error);
        this.filteredCases = [];
        this.loadingCases = false;
        this.cdr.detectChanges();
      }
    });
  }

  private loadUnbilledEntries(clientId: number, caseId?: number): void {
    this.loading = true;
    this.invoiceService.getUnbilledTimeEntries(clientId, caseId).subscribe({
      next: (entries) => {
        this.timeEntries = entries || [];
        this.loading = false;
        this.cdr.detectChanges();

        this.updatePreviewData();
      },
      error: (error) => {
        console.error('Error loading unbilled entries:', error);
        this.timeEntries = [];
        this.loading = false;
        this.cdr.detectChanges();

        this.updatePreviewData();
      }
    });
  }

  // Line Items Management
  get lineItems(): FormArray {
    return this.invoiceForm.get('lineItems') as FormArray;
  }

  addLineItem(): void {
    const lineItem = this.fb.group({
      description: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(0.01)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      amount: [{value: 0, disabled: true}],
      category: [''],
      serviceDate: [new Date().toISOString().split('T')[0]]
    });

    // Listen for quantity and unit price changes
    lineItem.get('quantity')?.valueChanges.subscribe(() => this.calculateLineItemAmount(lineItem));
    lineItem.get('unitPrice')?.valueChanges.subscribe(() => this.calculateLineItemAmount(lineItem));

    this.lineItems.push(lineItem);
  }

  removeLineItem(index: number): void {
    this.lineItems.removeAt(index);
    this.updateTotals();
  }

  private calculateLineItemAmount(lineItem: FormGroup): void {
    const quantity = lineItem.get('quantity')?.value || 0;
    const unitPrice = lineItem.get('unitPrice')?.value || 0;
    const amount = quantity * unitPrice;
    lineItem.patchValue({ amount }, { emitEvent: false });
    this.updateTotals();
  }

  private updateTotals(): void {
    let subtotal = 0;

    // Calculate from line items only (both time entries and manual line items)
    this.lineItems.controls.forEach(control => {
      const quantity = control.get('quantity')?.value || 0;
      const unitPrice = control.get('unitPrice')?.value || 0;
      const amount = control.get('amount')?.value || 0;
      
      // Use the calculated amount from the line item
      subtotal += amount || (quantity * unitPrice);
    });

    const taxRate = this.invoiceForm.get('taxRate')?.value || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const totalAmount = subtotal + taxAmount;

    console.log('💰 Updating totals:', { subtotal, taxRate, taxAmount, totalAmount });

    this.invoiceForm.patchValue({
      subtotal,
      taxAmount,
      totalAmount
    }, { emitEvent: false });

    this.updatePreviewData();
  }

  // Time Entry Selection
  toggleEntrySelection(entry: TimeEntry): void {
    if (!entry.id) return;
    
    if (this.selectedEntries.has(entry.id)) {
      // Remove from selected entries
      this.selectedEntries.delete(entry.id);
      // Remove corresponding line item
      this.removeTimeEntryLineItem(entry.id);
    } else {
      // Add to selected entries
      this.selectedEntries.add(entry.id);
      // Add corresponding line item
      this.addTimeEntryLineItem(entry);
    }
    this.updateTotals();
  }

  selectAll(): void {
    this.timeEntries.forEach(entry => {
      if (entry.id && !this.selectedEntries.has(entry.id)) {
        this.selectedEntries.add(entry.id);
        this.addTimeEntryLineItem(entry);
      }
    });
    this.updateTotals();
  }

  deselectAll(): void {
    // Remove all time entry line items
    this.selectedEntries.forEach(entryId => {
      this.removeTimeEntryLineItem(entryId);
    });
    this.selectedEntries.clear();
    this.updateTotals();
  }

  private addTimeEntryLineItem(entry: TimeEntry): void {
    if (!entry.id) return;

    const lineItem = this.fb.group({
      description: [{value: `${entry.description} (${entry.date})`, disabled: true}],
      quantity: [{value: entry.hours, disabled: true}],
      unitPrice: [{value: entry.rate, disabled: true}],
      amount: [{value: entry.hours * entry.rate, disabled: true}],
      category: [{value: 'TIME_ENTRY', disabled: true}],
      serviceDate: [{value: entry.date, disabled: true}],
      timeEntryId: [entry.id], // Hidden field to track which time entry this represents
      isTimeEntry: [true] // Flag to identify time entry line items
    });

    this.lineItems.push(lineItem);
  }

  private removeTimeEntryLineItem(timeEntryId: number): void {
    const lineItemsArray = this.lineItems;
    for (let i = lineItemsArray.length - 1; i >= 0; i--) {
      const lineItem = lineItemsArray.at(i);
      if (lineItem?.get('timeEntryId')?.value === timeEntryId) {
        lineItemsArray.removeAt(i);
        break;
      }
    }
  }

  private updatePreviewData(): void {
    let subtotal = 0;
    let selectedEntriesCount = this.selectedEntries.size;

    // Calculate from line items only (both time entries and manual)
    this.lineItems.controls.forEach(control => {
      const amount = control.get('amount')?.value || 0;
      subtotal += amount;
    });

    const taxRate = this.invoiceForm.get('taxRate')?.value || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const totalAmount = subtotal + taxAmount;

    this.previewData = {
      subtotal,
      taxAmount,
      totalAmount,
      selectedEntriesCount
    };
  }

  // Invoice Generation
  generateInvoice(): void {
    if (!this.validateForm()) {
      return;
    }

    // Check if there are items to invoice
    if (this.selectedEntries.size === 0 && this.lineItems.length === 0) {
      Swal.fire({
        title: 'No Items Selected',
        text: 'Please select time entries or add line items to generate an invoice.',
        icon: 'warning'
      });
      return;
    }

    this.isGenerating = true;
    const formValue = this.invoiceForm.value;
    
    // Get selected client and case information
    const client = this.clients.find(c => c.id === Number(formValue.clientId));
    const legalCase = this.filteredCases.find(c => c.id === formValue.legalCaseId);

    // Calculate current totals manually from ALL line items (including disabled ones)
    let subtotal = 0;
    console.log('🔍 Debug line items calculation:');
    console.log('Total line items:', this.lineItems.length);
    
    this.lineItems.controls.forEach((control, index) => {
      // Get values directly from the control, regardless of disabled state
      const quantity = control.get('quantity')?.value || 0;
      const unitPrice = control.get('unitPrice')?.value || 0;
      const amount = control.get('amount')?.value || (quantity * unitPrice);
      const isTimeEntry = control.get('isTimeEntry')?.value || false;
      
      console.log(`Line item ${index}:`, {
        quantity: quantity,
        unitPrice: unitPrice,
        amount: amount,
        isTimeEntry: isTimeEntry,
        calculation: quantity * unitPrice
      });
      
      subtotal += amount;
    });

    const taxRate = formValue.taxRate || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const totalAmount = subtotal + taxAmount;

    console.log('📑 Manual totals calculation:', { 
      lineItemsCount: this.lineItems.length,
      subtotal, 
      taxRate, 
      taxAmount, 
      totalAmount 
    });

    // Also debug the time entries themselves
    console.log('🕐 Time entries debug:');
    this.timeEntries.forEach((entry, index) => {
      if (this.selectedEntries.has(entry.id!)) {
        console.log(`Selected time entry ${index}:`, {
          id: entry.id,
          hours: entry.hours,
          rate: entry.rate,
          amount: entry.hours * entry.rate,
          description: entry.description
        });
      }
    });

    // Create base invoice object for time entries (matching service structure)
    const baseInvoice: any = {
      clientId: formValue.clientId,
      clientName: client?.name || '',
      legalCaseId: formValue.legalCaseId || null,
      caseName: legalCase?.title || null,
      issueDate: formValue.issueDate,
      dueDate: formValue.dueDate,
      taxRate: taxRate,
      notes: formValue.notes || ''
    };

    console.log('Invoice request data:', baseInvoice);
    console.log('Selected time entries:', Array.from(this.selectedEntries));

    // Check if we have selected time entries
    if (this.selectedEntries.size > 0) {
      // Use the new endpoint for time entries
      console.log('Creating invoice from time entries:', Array.from(this.selectedEntries));
      
      this.invoiceService.createInvoiceFromTimeEntries(baseInvoice, Array.from(this.selectedEntries)).subscribe({
        next: (response: any) => {
          this.isGenerating = false;
          this.generatedInvoice = response;
          
          // Clear selected entries since they are now invoiced
          this.selectedEntries.clear();
          
          // Remove time entry line items since they're now invoiced
          this.removeAllTimeEntryLineItems();
          
          // Refresh the unbilled entries list
          const currentClientId = this.invoiceForm.get('clientId')?.value;
          const currentCaseId = this.invoiceForm.get('legalCaseId')?.value;
          if (currentClientId) {
            this.loadUnbilledEntries(currentClientId, currentCaseId);
          }
          
          this.cdr.detectChanges();
          
          Swal.fire({
            title: 'Success!',
            text: 'Invoice created successfully from time entries',
            icon: 'success',
            showCancelButton: true,
            confirmButtonText: 'Download PDF',
            cancelButtonText: 'View Invoice',
            reverseButtons: true
          }).then((result) => {
            if (result.isConfirmed) {
              this.downloadPdf();
            } else if (result.dismiss === Swal.DismissReason.cancel) {
              this.router.navigate(['/invoices', response.id, response.invoiceNumber]);
            }
          });
        },
        error: (error) => {
          this.isGenerating = false;
          console.error('Invoice creation error:', error);
          const errorMessage = error?.error?.message || error?.message || 'Failed to create invoice from time entries';
          Swal.fire({
            title: 'Error!',
            text: errorMessage,
            icon: 'error'
          });
        }
      });
    } else {
      // Use the old endpoint for manual line items only
      console.log('Creating invoice from manual line items');
      
      const invoice: TimeTrackingInvoice = {
        clientId: formValue.clientId,
        clientName: client?.name || '',
        legalCaseId: formValue.legalCaseId || null,
        caseName: legalCase?.title || null,
        issueDate: formValue.issueDate,
        dueDate: formValue.dueDate,
        subtotal: formValue.subtotal || 0,
        taxRate: formValue.taxRate || 0,
        taxAmount: formValue.taxAmount || 0,
        totalAmount: formValue.totalAmount || 0,
        status: formValue.status,
        notes: formValue.notes || '',
        timeEntryIds: [] // Empty for manual line items
      };

      this.invoiceService.createInvoice(invoice).subscribe({
        next: (response: any) => {
          this.isGenerating = false;
          this.generatedInvoice = response;
          
          Swal.fire({
            title: 'Success!',
            text: 'Invoice created successfully',
            icon: 'success',
            showCancelButton: true,
            confirmButtonText: 'Download PDF',
            cancelButtonText: 'View Invoice',
            reverseButtons: true
          }).then((result) => {
            if (result.isConfirmed) {
              this.downloadPdf();
            } else if (result.dismiss === Swal.DismissReason.cancel) {
              this.router.navigate(['/invoices', response.id, response.invoiceNumber]);
            }
          });
        },
        error: (error) => {
          this.isGenerating = false;
          console.error('Invoice creation error:', error);
          const errorMessage = error?.error?.message || error?.message || 'Failed to create invoice';
          Swal.fire({
            title: 'Error!',
            text: errorMessage,
            icon: 'error'
          });
        }
      });
    }
  }

  private removeAllTimeEntryLineItems(): void {
    const lineItemsArray = this.lineItems;
    for (let i = lineItemsArray.length - 1; i >= 0; i--) {
      const lineItem = lineItemsArray.at(i);
      if (lineItem?.get('isTimeEntry')?.value) {
        lineItemsArray.removeAt(i);
      }
    }
  }

  downloadPdf(): void {
    if (!this.generatedInvoice?.id) {
      Swal.fire({
        title: 'Error!',
        text: 'No invoice available for download',
        icon: 'error'
      });
      return;
    }

    this.invoiceService.generateInvoicePdf(this.generatedInvoice.id).subscribe({
      next: (event) => {
        if (event instanceof Blob) {
          saveAs(event, `invoice-${this.generatedInvoice!.invoiceNumber}.pdf`);
          Swal.fire({
            title: 'Success!',
            text: 'Invoice PDF downloaded successfully',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
          });
        }
      },
      error: (error) => {
        console.error('Error downloading PDF:', error);
        Swal.fire({
          title: 'Error!',
          text: 'Failed to download PDF. Please try again.',
          icon: 'error'
        });
      }
    });
  }

  private validateForm(): boolean {
    if (this.invoiceForm.invalid) {
      Object.keys(this.invoiceForm.controls).forEach(key => {
        const control = this.invoiceForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
      
      Swal.fire({
        title: 'Form Invalid',
        text: 'Please fill in all required fields.',
        icon: 'warning'
      });
      return false;
    }
    return true;
  }

  onCancel(): void {
    this.router.navigate(['/time-tracking/billing']);
  }

  // Utility Methods
  getTotalUnbilledHours(): number {
    return this.timeEntries.reduce((total, entry) => total + (entry.hours || 0), 0);
  }

  getTotalSelectedHours(): number {
    return this.timeEntries
      .filter(entry => entry.id && this.selectedEntries.has(entry.id))
      .reduce((total, entry) => total + (entry.hours || 0), 0);
  }

  trackByEntryId(index: number, entry: TimeEntry): number {
    return entry.id || index;
  }

  generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `INV-${year}${month}${day}-${random}`;
  }

  getSelectedClientName(): string {
    const clientId = this.invoiceForm.get('clientId')?.value;
    const client = this.clients.find(c => c.id === Number(clientId));
    return client?.name || '';
  }

  getSelectedClientEmail(): string {
    const clientId = this.invoiceForm.get('clientId')?.value;
    const client = this.clients.find(c => c.id === Number(clientId));
    return client?.email || '';
  }

  getSelectedCaseName(): string {
    const caseId = this.invoiceForm.get('legalCaseId')?.value;
    const legalCase = this.filteredCases.find(c => c.id === caseId);
    return legalCase?.title || '';
  }

  getUserName(userId: number): string {
    const user = this.users.find(u => u.id === userId);
    return user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name : 'Unknown User';
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'DRAFT': return 'Draft';
      case 'PENDING': return 'Pending';
      case 'PAID': return 'Paid';
      case 'OVERDUE': return 'Overdue';
      case 'CANCELLED': return 'Cancelled';
      default: return status;
    }
  }

  private getDefaultDueDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 30); // 30 days from now
    return date.toISOString().split('T')[0];
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem(Key.TOKEN);
    if (!token) {
      return false;
    }
    
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        return false;
      }
      
      const payload = JSON.parse(atob(tokenParts[1]));
      const isExpired = Date.now() > payload.exp * 1000;
      return !isExpired;
    } catch (e) {
      return false;
    }
  }

  private checkAuthenticationStatus(): void {
    const token = localStorage.getItem(Key.TOKEN);
    const refreshToken = localStorage.getItem(Key.REFRESH_TOKEN);
    
    console.log('🔐 Authentication Status Check:');
    console.log('🔐 Token Key:', Key.TOKEN);
    console.log('🔐 Refresh Token Key:', Key.REFRESH_TOKEN);
    console.log('🔐 Token exists:', !!token);
    console.log('🔐 Token length:', token?.length || 0);
    console.log('🔐 Refresh token exists:', !!refreshToken);
    console.log('🔐 Refresh token length:', refreshToken?.length || 0);
    
    if (token) {
      const tokenParts = token.split('.');
      console.log('🔐 Token parts count:', tokenParts.length);
      if (tokenParts.length === 3) {
        try {
          const payload = JSON.parse(atob(tokenParts[1]));
          console.log('🔐 Token payload:', payload);
          console.log('🔐 Token expires:', new Date(payload.exp * 1000));
          console.log('🔐 Token expired:', Date.now() > payload.exp * 1000);
        } catch (e) {
          console.error('🔐 Failed to decode token:', e);
        }
      }
    } else {
      console.warn('🔐 No authentication token found - user needs to log in first');
    }
  }
} 