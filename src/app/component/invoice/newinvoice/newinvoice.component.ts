import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnInit, Output, AfterViewInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Observable, BehaviorSubject, map, startWith, catchError, of } from 'rxjs';
import { DataState } from 'src/app/enum/datastate.enum';
import { CustomHttpResponse } from 'src/app/interface/appstates';
import { Client } from 'src/app/interface/client';
import { State } from 'src/app/interface/state';
import { User } from 'src/app/interface/user';
import { ClientService } from 'src/app/service/client.service';
import { InvoiceService } from 'src/app/service/invoice.service';
import { LegalCase } from 'src/app/modules/legal/interfaces/case.interface';
import { LegalCaseService } from 'src/app/modules/legal/services/legal-case.service';
import { InvoiceTemplateService } from 'src/app/service/invoice-template.service';
import { InvoiceTemplate } from 'src/app/interface/invoice-template';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { Invoice } from 'src/app/interface/invoice';
import { InvoiceLineItem } from 'src/app/interface/invoice-line-item';
import flatpickr from 'flatpickr';
import { Instance } from 'flatpickr/dist/types/instance';


@Component({
  selector: 'app-newinvoice',
  templateUrl: './newinvoice.component.html',
  styleUrls: ['./newinvoice.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewinvoiceComponent implements OnInit, AfterViewInit, OnDestroy {
  invoiceForm: FormGroup;
  clients: any[] = [];
  cases: LegalCase[] = [];
  templates: InvoiceTemplate[] = [];
  statuses = ['DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED'];
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();
  readonly DataState = DataState;
  @Output() invoiceCreated = new EventEmitter<any>();
  
  private issueDatePicker: Instance | null = null;
  private dueDatePicker: Instance | null = null;


  constructor(
    private fb: FormBuilder,
    private clientService: ClientService,
    private invoiceService: InvoiceService,
    private legalCaseService: LegalCaseService,
    private templateService: InvoiceTemplateService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadClients();
    this.loadTemplates();
    this.setupFormValueChanges();
  }



  private loadTemplates(): void {
    this.templateService.getActiveTemplates().subscribe({
      next: (response) => {
        this.templates = response.data || [];
      },
      error: (error) => {
        console.error('Error loading templates:', error);
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initializeDatePickers();
    }, 100);
  }

  ngOnDestroy(): void {
    if (this.issueDatePicker) {
      this.issueDatePicker.destroy();
    }
    if (this.dueDatePicker) {
      this.dueDatePicker.destroy();
    }
  }

  private initializeForm(): void {
    const today = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // 30 days from now

    this.invoiceForm = this.fb.group({
      invoiceNumber: ['', Validators.required],
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

    // Generate invoice number
    this.generateInvoiceNumber();
  }

  private generateInvoiceNumber(): void {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.invoiceForm.patchValue({
      invoiceNumber: `INV-${year}${month}-${random}`
    });
  }

  private setupFormValueChanges(): void {
    // Auto-calculate tax and total when subtotal or tax rate changes
    this.invoiceForm.get('subtotal')?.valueChanges.subscribe(() => this.calculateTotals());
    this.invoiceForm.get('taxRate')?.valueChanges.subscribe(() => this.calculateTotals());
  }

  private calculateTotals(): void {
    const subtotal = this.invoiceForm.get('subtotal')?.value || 0;
    const taxRate = this.invoiceForm.get('taxRate')?.value || 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const totalAmount = subtotal + taxAmount;

    this.invoiceForm.patchValue({
      taxAmount: taxAmount,
      totalAmount: totalAmount
    }, { emitEvent: false });
  }

  private loadClients(): void {
    console.log('Loading ALL clients for invoice creation...');
    
    // Try newInvoice endpoint first which should return all clients
    this.clientService.newInvoice$().subscribe({
      next: (response: any) => {
        console.log('newInvoice response received:', response);
        
        // Handle multiple possible response formats from newInvoice endpoint
        let clientsList: any[] = [];
        
        if (response?.data?.clients && Array.isArray(response.data.clients)) {
          // Format: { data: { clients: [...] } }
          clientsList = response.data.clients;
        } else if (response?.data?.page?.content && Array.isArray(response.data.page.content)) {
          // Format: { data: { page: { content: [...] } } }
          clientsList = response.data.page.content;
        } else if (response?.data?.content && Array.isArray(response.data.content)) {
          // Format: { data: { content: [...] } }
          clientsList = response.data.content;
        } else if (response?.data && Array.isArray(response.data)) {
          // Format: { data: [...] }
          clientsList = response.data;
        } else if (Array.isArray(response)) {
          // Direct array format
          clientsList = response;
        } else {
          console.warn('Unexpected newInvoice response format:', response);
          clientsList = [];
        }
        
        this.clients = clientsList;
        console.log('All clients loaded via newInvoice endpoint:', this.clients.length, 'clients');
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('newInvoice endpoint failed, trying to load all clients via pagination:', error);
        
        // Fallback: Load all clients by using a large page size or multiple pages
        this.loadAllClientsWithPagination();
      }
    });
  }

  private loadAllClientsWithPagination(): void {
    console.log('Loading clients with large page size using service method...');
    
    // Use the new allClients$ method from the service
    this.clientService.allClients$().subscribe({
      next: (response: any) => {
        console.log('All clients response received:', response);
        
        // Handle multiple possible response formats
        let clientsList: any[] = [];
        
        if (response?.data?.page?.content && Array.isArray(response.data.page.content)) {
          clientsList = response.data.page.content;
        } else if (response?.data?.content && Array.isArray(response.data.content)) {
          clientsList = response.data.content;
        } else if (response?.data && Array.isArray(response.data)) {
          clientsList = response.data;
        } else if (Array.isArray(response)) {
          clientsList = response;
        }
        
        this.clients = clientsList;
        console.log('All clients loaded via service allClients$ method:', this.clients.length, 'clients');
        this.cdr.markForCheck();
      },
      error: (serviceError) => {
        console.error('Service allClients$ failed, using regular pagination:', serviceError);
        
        // Final fallback: Use the regular clients$ method (will show only first 10)
        this.clientService.clients$().subscribe({
          next: (response: any) => {
            let clientsList: any[] = [];
            
            if (response?.data?.page?.content && Array.isArray(response.data.page.content)) {
              clientsList = response.data.page.content;
            } else if (response?.data?.content && Array.isArray(response.data.content)) {
              clientsList = response.data.content;
            } else if (response?.data && Array.isArray(response.data)) {
              clientsList = response.data;
            } else if (Array.isArray(response)) {
              clientsList = response;
            }
            
            this.clients = clientsList;
            console.log('Limited clients loaded (first page only):', this.clients.length, 'clients');
            console.warn('Note: Only showing first page of clients. Consider adding client search functionality.');
            this.cdr.markForCheck();
          },
          error: (finalError) => {
            console.error('All client loading methods failed:', finalError);
            this.clients = [];
            this.cdr.markForCheck();
          }
        });
      }
    });
  }

  onClientChange(clientId: string): void {
    console.log('Client changed to:', clientId);
    
    if (clientId) {
      const client = this.clients.find(c => c.id === Number(clientId));
      console.log('Selected client:', client);
      
      // First try to get cases by client ID (preferred method)
      this.legalCaseService.getCasesByClient(Number(clientId)).subscribe({
        next: (response: any) => {
          console.log('Direct cases response for client:', response);
          
          // Extract cases from response
          let clientCases: any[] = [];
          if (response?.data?.page?.content && Array.isArray(response.data.page.content)) {
            clientCases = response.data.page.content;
          } else if (response?.data?.content && Array.isArray(response.data.content)) {
            clientCases = response.data.content;
          } else if (response?.data && Array.isArray(response.data)) {
            clientCases = response.data;
          } else if (Array.isArray(response)) {
            clientCases = response;
          }
          
          this.cases = clientCases;
          console.log('Cases loaded directly for client:', this.cases.length);
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.warn('Direct case loading failed, trying fallback method:', error);
          
          // Fallback: Load all cases and filter by client name
          this.legalCaseService.getAllCases(0, 1000).subscribe({
            next: (response: any) => {
              console.log('All cases response for filtering:', response);
              
              // Extract cases from various possible response formats
              let allCases: any[] = [];
              if (response?.data?.page?.content && Array.isArray(response.data.page.content)) {
                allCases = response.data.page.content;
              } else if (response?.data?.content && Array.isArray(response.data.content)) {
                allCases = response.data.content;
              } else if (response?.data?.cases && Array.isArray(response.data.cases)) {
                allCases = response.data.cases;
              } else if (Array.isArray(response)) {
                allCases = response;
              }
              
              if (client) {
                // Filter cases by client name since backend doesn't filter properly yet
                this.cases = allCases.filter((c: any) => 
                  c.clientName === client.name || 
                  c.clientId === Number(clientId) ||
                  c.client?.name === client.name ||
                  c.client?.id === Number(clientId)
                );
                                 console.log('Cases filtered by client name/ID:', this.cases.length);
                 this.cdr.markForCheck();
              } else {
                this.cases = [];
              }
            },
            error: (fallbackError) => {
              console.error('Fallback case loading also failed:', fallbackError);
              this.cases = [];
            }
          });
        }
      });
    } else {
      this.cases = [];
      this.invoiceForm.patchValue({ legalCaseId: '' });
      console.log('Client cleared, cases reset');
      this.cdr.markForCheck();
    }
  }

  onTemplateChange(templateId: string): void {
    if (!templateId) return;
    
    this.templateService.getTemplateById(+templateId).subscribe({
      next: (response) => {
        const template = response.data;
        if (template) {
          // Apply template settings
          this.invoiceForm.patchValue({
            taxRate: template.taxRate || 0,
            notes: template.notesTemplate || ''
          });
          
          // Clear existing line items
          while (this.lineItems.length !== 0) {
            this.lineItems.removeAt(0);
          }
          
          // Add template items
          if (template.templateItems && template.templateItems.length > 0) {
            template.templateItems.forEach(item => {
              if (!item.isOptional) {
                const lineItem = this.fb.group({
                  description: [item.description || '', Validators.required],
                  quantity: [item.defaultQuantity || 1, [Validators.required, Validators.min(0.01)]],
                  unitPrice: [item.defaultUnitPrice || 0, [Validators.required, Validators.min(0)]],
                  amount: [{value: (item.defaultQuantity || 1) * (item.defaultUnitPrice || 0), disabled: true}],
                  category: [item.category || ''],
                  serviceDate: ['']
                });
                
                // Set up value changes for this item
                lineItem.get('quantity')?.valueChanges.subscribe(() => this.calculateLineItemAmount(lineItem));
                lineItem.get('unitPrice')?.valueChanges.subscribe(() => this.calculateLineItemAmount(lineItem));
                
                this.lineItems.push(lineItem);
              }
            });
            
            // Recalculate totals
            this.calculateTotalsFromLineItems();
          }
        }
      },
      error: (error) => {
        Swal.fire('Error!', 'Failed to load template', 'error');
      }
    });
  }

  onSubmit(): void {
    if (this.invoiceForm.invalid) {
      Object.keys(this.invoiceForm.controls).forEach(key => {
        const control = this.invoiceForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
      return;
    }

    this.isLoadingSubject.next(true);
    const formValue = this.invoiceForm.getRawValue();
    
    // Get client details
    const client = this.clients.find(c => c.id === Number(formValue.clientId));
    const legalCase = this.cases.find(c => c.id === String(formValue.legalCaseId));

    const invoice: Invoice = {
      invoiceNumber: formValue.invoiceNumber,
      clientId: formValue.clientId,
      clientName: client?.name || '',
      legalCaseId: formValue.legalCaseId || null,
      caseName: legalCase?.title || null,
      issueDate: formValue.issueDate,
      dueDate: formValue.dueDate,
      subtotal: formValue.subtotal,
      taxRate: formValue.taxRate,
      taxAmount: formValue.taxAmount,
      totalAmount: formValue.totalAmount,
      status: formValue.status,
      notes: formValue.notes,
      lineItems: formValue.lineItems.map((item: any) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.quantity * item.unitPrice,
        category: item.category,
        serviceDate: item.serviceDate
      }))
    };

    this.invoiceService.createInvoice(invoice).subscribe({
      next: (response) => {
        this.isLoadingSubject.next(false);
        Swal.fire({
          title: 'Success!',
          text: 'Invoice created successfully',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        }).then(() => {
          this.invoiceCreated.emit(response);
          this.router.navigate(['/invoices', response.data.id, response.data.invoiceNumber]);
        });
      },
      error: (error) => {
        this.isLoadingSubject.next(false);
        Swal.fire({
          title: 'Error!',
          text: error.error?.message || 'Failed to create invoice',
          icon: 'error'
        });
      }
    });
  }

  onCancel(): void {
    this.router.navigate(['/invoices']);
  }

  // Line Items Methods
  get lineItems(): FormArray {
    return this.invoiceForm.get('lineItems') as FormArray;
  }

  createLineItem(): FormGroup {
    return this.fb.group({
      description: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(0.01)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      amount: [{value: 0, disabled: true}],
      category: [''],
      serviceDate: ['']
    });
  }

  addLineItem(): void {
    const lineItem = this.createLineItem();
    
    // Calculate amount when quantity or price changes
    lineItem.get('quantity')?.valueChanges.subscribe(() => this.calculateLineItemAmount(lineItem));
    lineItem.get('unitPrice')?.valueChanges.subscribe(() => this.calculateLineItemAmount(lineItem));
    
    this.lineItems.push(lineItem);
  }

  removeLineItem(index: number): void {
    this.lineItems.removeAt(index);
    this.calculateTotalsFromLineItems();
  }

  calculateLineItemAmount(lineItem: FormGroup): void {
    const quantity = lineItem.get('quantity')?.value || 0;
    const unitPrice = lineItem.get('unitPrice')?.value || 0;
    const amount = quantity * unitPrice;
    
    lineItem.patchValue({ amount }, { emitEvent: false });
    this.calculateTotalsFromLineItems();
  }

  calculateTotalsFromLineItems(): void {
    let subtotal = 0;
    
    this.lineItems.controls.forEach((lineItem) => {
      const amount = lineItem.get('amount')?.value || 0;
      subtotal += amount;
    });
    
    this.invoiceForm.patchValue({ subtotal }, { emitEvent: false });
    this.calculateTotals();
  }

  private initializeDatePickers(): void {
    const issueDateInput = document.querySelector('#issueDate') as HTMLInputElement;
    if (issueDateInput) {
      this.issueDatePicker = flatpickr(issueDateInput, {
        dateFormat: 'Y-m-d',
        altInput: true,
        altFormat: 'F j, Y',
        defaultDate: new Date(),
        onChange: (selectedDates) => {
          if (selectedDates.length > 0) {
            const formattedDate = this.formatDate(selectedDates[0]);
            this.invoiceForm.patchValue({ issueDate: formattedDate });
          }
        }
      });
    }

    const dueDateInput = document.querySelector('#dueDate') as HTMLInputElement;
    if (dueDateInput) {
      const defaultDueDate = new Date();
      defaultDueDate.setDate(defaultDueDate.getDate() + 30);
      
      this.dueDatePicker = flatpickr(dueDateInput, {
        dateFormat: 'Y-m-d',
        altInput: true,
        altFormat: 'F j, Y',
        defaultDate: defaultDueDate,
        onChange: (selectedDates) => {
          if (selectedDates.length > 0) {
            const formattedDate = this.formatDate(selectedDates[0]);
            this.invoiceForm.patchValue({ dueDate: formattedDate });
          }
        }
      });
    }
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

}
