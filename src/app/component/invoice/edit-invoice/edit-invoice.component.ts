import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, BehaviorSubject } from 'rxjs';
import { DataState } from 'src/app/enum/datastate.enum';
// Removed unused imports for cleaner code
import { ClientService } from 'src/app/service/client.service';
import { InvoiceService } from 'src/app/service/invoice.service';
import { LegalCase } from 'src/app/modules/legal/interfaces/case.interface';
import { LegalCaseService } from 'src/app/modules/legal/services/legal-case.service';
import { InvoiceTemplateService } from 'src/app/service/invoice-template.service';
import { InvoiceTemplate } from 'src/app/interface/invoice-template';
import Swal from 'sweetalert2';
import { Invoice } from 'src/app/interface/invoice';
import flatpickr from 'flatpickr';
import { Instance } from 'flatpickr/dist/types/instance';
import { ApiResponseUtil } from 'src/app/core/utils/api-response.util';

@Component({
  selector: 'app-edit-invoice',
  templateUrl: './edit-invoice.component.html',
  styleUrls: ['./edit-invoice.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditInvoiceComponent implements OnInit, AfterViewInit, OnDestroy {
  invoiceForm: FormGroup;
  invoiceId: number;
  currentInvoice: Invoice | null = null;
  clients: any[] = [];
  cases: LegalCase[] = [];
  templates: InvoiceTemplate[] = [];
  statuses = ['DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED'];
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();
  readonly DataState = DataState;
  private submitAttempted = false;
  
  private issueDatePicker: Instance | null = null;
  private dueDatePicker: Instance | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private clientService: ClientService,
    private invoiceService: InvoiceService,
    private legalCaseService: LegalCaseService,
    private templateService: InvoiceTemplateService,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.invoiceId = +this.route.snapshot.params['id'];
    this.loadData();
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
    this.invoiceForm = this.fb.group({
      invoiceNumber: ['', Validators.required],
      clientId: ['', Validators.required],
      legalCaseId: [''],
      issueDate: ['', Validators.required],
      dueDate: ['', Validators.required],
      subtotal: [0, [Validators.required, Validators.min(0)]],
      taxRate: [0, [Validators.min(0), Validators.max(100)]],
      taxAmount: [{value: 0, disabled: true}],
      totalAmount: [{value: 0, disabled: true}],
      status: ['DRAFT', Validators.required],
      notes: [''],
      lineItems: this.fb.array([])
    });

    this.setupFormValueChanges();
  }

  private setupFormValueChanges(): void {
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

  private async loadData(): Promise<void> {
    try {
      this.isLoadingSubject.next(true);
      await Promise.all([
        this.loadClients(),
        this.loadTemplates(),
        this.loadInvoice()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      const errorMessage = ApiResponseUtil.extractErrorMessage(error);
      Swal.fire({
        title: 'Error',
        text: errorMessage,
        icon: 'error',
        confirmButtonText: 'OK'
      });
    } finally {
      this.isLoadingSubject.next(false);
      this.cdr.markForCheck();
    }
  }

  private loadClients(): Promise<void> {
    return new Promise((resolve) => {
      // Try newInvoice endpoint first which should return all clients
      this.clientService.newInvoice$().subscribe({
        next: (response: any) => {
          let clientsList: any[] = [];
          
          if (response?.data?.clients && Array.isArray(response.data.clients)) {
            clientsList = response.data.clients;
          } else if (response?.data?.page?.content && Array.isArray(response.data.page.content)) {
            clientsList = response.data.page.content;
          } else if (response?.data?.content && Array.isArray(response.data.content)) {
            clientsList = response.data.content;
          } else if (response?.data && Array.isArray(response.data)) {
            clientsList = response.data;
          } else if (Array.isArray(response)) {
            clientsList = response;
          }
          
          this.clients = clientsList;
          resolve();
        },
        error: () => {
          // Fallback: Try allClients method for complete client list
          this.clientService.allClients$().subscribe({
            next: (fallbackResponse: any) => {
              let fallbackClients: any[] = [];
              if (fallbackResponse?.data?.page?.content && Array.isArray(fallbackResponse.data.page.content)) {
                fallbackClients = fallbackResponse.data.page.content;
              } else if (fallbackResponse?.data?.content && Array.isArray(fallbackResponse.data.content)) {
                fallbackClients = fallbackResponse.data.content;
              } else if (fallbackResponse?.data && Array.isArray(fallbackResponse.data)) {
                fallbackClients = fallbackResponse.data;
              } else if (Array.isArray(fallbackResponse)) {
                fallbackClients = fallbackResponse;
              }
              
              this.clients = fallbackClients;
              console.warn('Edit Invoice: Loaded limited clients (fallback method):', this.clients.length);
              resolve();
            },
            error: () => {
              // Final fallback: try regular clients$ with first page
              this.clientService.clients$().subscribe({
                next: (finalResponse: any) => {
                  let finalClients: any[] = [];
                  if (finalResponse?.data?.page?.content && Array.isArray(finalResponse.data.page.content)) {
                    finalClients = finalResponse.data.page.content;
                  } else if (finalResponse?.data?.content && Array.isArray(finalResponse.data.content)) {
                    finalClients = finalResponse.data.content;
                  } else if (finalResponse?.data && Array.isArray(finalResponse.data)) {
                    finalClients = finalResponse.data;
                  } else if (Array.isArray(finalResponse)) {
                    finalClients = finalResponse;
                  }
                  
                  this.clients = finalClients;
                  console.warn('Edit Invoice: Loaded first page clients only:', this.clients.length);
                  resolve();
                },
                error: () => {
                  this.clients = [];
                  console.error('Edit Invoice: All client loading methods failed');
                  resolve();
                }
              });
            }
          });
        }
      });
    });
  }

  private loadTemplates(): Promise<void> {
    return new Promise((resolve) => {
      this.templateService.getActiveTemplates().subscribe({
        next: (response) => {
          this.templates = response.data || [];
          resolve();
        },
        error: () => {
          this.templates = [];
          resolve();
        }
      });
    });
  }

  private loadInvoice(): Promise<void> {
    return new Promise((resolve) => {
    this.invoiceService.getInvoiceById(this.invoiceId).subscribe({
        next: async (response) => {
          const invoice = (response as any).data || response;
          this.currentInvoice = invoice;
        
          // Check if invoice can be edited
          if (invoice?.status === 'PAID') {
            Swal.fire({
              title: 'Cannot Edit',
              text: 'This invoice has been paid and cannot be edited.',
              icon: 'warning',
              confirmButtonText: 'Go Back'
            }).then(() => {
              this.router.navigate(['/invoices']);
            });
            resolve();
            return;
          }

          // Load cases for the client
          if (invoice?.clientId) {
            await this.loadCasesForClient(invoice.clientId);
          }

          // Populate form
          this.invoiceForm.patchValue({
            invoiceNumber: invoice?.invoiceNumber || '',
            clientId: invoice?.clientId?.toString() || '',
            legalCaseId: invoice?.legalCaseId?.toString() || '',
            issueDate: this.formatDate(invoice?.issueDate),
            dueDate: this.formatDate(invoice?.dueDate),
            status: invoice?.status || 'DRAFT',
            subtotal: invoice?.subtotal || 0,
            taxRate: invoice?.taxRate || 0,
            taxAmount: invoice?.taxAmount || 0,
            totalAmount: invoice?.totalAmount || 0,
            notes: invoice?.notes || ''
          }, { emitEvent: false });
          
          // Load line items if they exist
          if (invoice?.lineItems && Array.isArray(invoice.lineItems)) {
            const lineItemsArray = this.invoiceForm.get('lineItems') as FormArray;
            lineItemsArray.clear();
            
            invoice.lineItems.forEach(item => {
              const lineItemGroup = this.createLineItem();
              lineItemGroup.patchValue({
                description: item.description || '',
                quantity: item.quantity || 1,
                unitPrice: item.unitPrice || 0,
                amount: item.amount || 0,
                category: item.category || ''
              });
              lineItemsArray.push(lineItemGroup);
            });
          }

          // Reset form state completely to prevent validation errors on load
          this.resetFormState();
          this.calculateTotalsFromLineItems();
          
          // Mark for change detection
          this.cdr.markForCheck();
          
          resolve();
      },
      error: (error) => {
          const errorMessage = ApiResponseUtil.extractErrorMessage(error);
        Swal.fire({
            title: 'Error',
            text: errorMessage,
            icon: 'error',
            confirmButtonText: 'OK'
        }).then(() => {
          this.router.navigate(['/invoices']);
        });
          resolve();
      }
      });
    });
  }

  private loadCasesForClient(clientId: number): Promise<void> {
    return new Promise((resolve) => {
      this.legalCaseService.getCasesByClient(clientId).subscribe({
        next: (response) => {
          if (response?.data?.page?.content) {
            this.cases = response.data.page.content;
          } else if (response?.data?.content) {
            this.cases = response.data.content;
          } else if (response?.data) {
            this.cases = Array.isArray(response.data) ? response.data : [];
          } else {
            this.cases = [];
          }
          resolve();
        },
        error: () => {
          this.legalCaseService.getAllCases(0, 1000).subscribe({
            next: (allResponse) => {
              const allCases = allResponse?.data?.page?.content || allResponse?.data?.content || [];
              const client = this.clients.find(c => c.id === clientId);
              this.cases = client ? allCases.filter(c => 
                c.clientName === client.name || c.clientId === clientId
              ) : [];
              resolve();
            },
            error: () => {
          this.cases = [];
          resolve();
            }
          });
        }
      });
    });
  }

  onClientChange(clientId: string): void {
    if (!clientId) {
      this.cases = [];
      this.invoiceForm.patchValue({ legalCaseId: '' });
      this.cdr.markForCheck();
      return;
  }

    this.loadCasesForClient(parseInt(clientId)).then(() => {
      this.cdr.markForCheck();
    });
  }

  onTemplateChange(templateId: string): void {
    if (!templateId) return;

    const template = this.templates.find(t => t.id === parseInt(templateId));
    if (template) {
      this.invoiceForm.patchValue({ 
        taxRate: template.taxRate || 0,
        notes: template.notesTemplate || ''
      });
      this.calculateTotals();
    }
  }

  onSubmit(): void {
    this.submitAttempted = true;
    
    if (this.invoiceForm.invalid) {
      this.markFormGroupTouched();
      this.cdr.markForCheck(); // Trigger change detection to show validation errors
      Swal.fire({
        title: 'Validation Error',
        text: 'Please fill all required fields correctly',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }

    if (this.currentInvoice?.status === 'PAID') {
      Swal.fire('Cannot Update', 'This invoice has been paid and cannot be updated.', 'warning');
      return;
    }

    this.isLoadingSubject.next(true);
    const formValue = this.invoiceForm.value;

    const invoiceData: Invoice = {
      invoiceNumber: formValue.invoiceNumber,
      clientId: parseInt(formValue.clientId),
      legalCaseId: formValue.legalCaseId ? parseInt(formValue.legalCaseId) : null,
      issueDate: formValue.issueDate,
      dueDate: formValue.dueDate,
      status: formValue.status,
      subtotal: formValue.subtotal,
      taxRate: formValue.taxRate,
      taxAmount: formValue.taxAmount,
      totalAmount: formValue.totalAmount,
      notes: formValue.notes,
      lineItems: formValue.lineItems
    };
      
    this.invoiceService.updateInvoice(this.invoiceId, invoiceData).subscribe({
        next: () => {
        this.isLoadingSubject.next(false);
          Swal.fire({
            title: 'Success!',
            text: 'Invoice updated successfully',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
          }).then(() => {
            this.router.navigate(['/invoices']);
          });
        },
        error: (error) => {
        this.isLoadingSubject.next(false);
        const errorMessage = ApiResponseUtil.extractErrorMessage(error);
          Swal.fire({
            title: 'Error!',
          text: errorMessage,
          icon: 'error',
          confirmButtonText: 'OK'
          });
        }
      });
  }

  onCancel(): void {
    this.router.navigate(['/invoices']);
  }

  get lineItems(): FormArray {
    return this.invoiceForm.get('lineItems') as FormArray;
  }

  createLineItem(): FormGroup {
    const lineItem = this.fb.group({
      description: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(0.01)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      amount: [{value: 0, disabled: true}],
      category: ['']
    });

    lineItem.get('quantity')?.valueChanges.subscribe(() => this.calculateLineItemAmount(lineItem));
    lineItem.get('unitPrice')?.valueChanges.subscribe(() => this.calculateLineItemAmount(lineItem));

    return lineItem;
  }

  addLineItem(): void {
    this.lineItems.push(this.createLineItem());
    this.calculateTotalsFromLineItems();
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
    const lineItems = this.lineItems.controls;
    const subtotal = lineItems.reduce((sum, item) => {
      return sum + (item.get('amount')?.value || 0);
    }, 0);

    this.invoiceForm.patchValue({ subtotal }, { emitEvent: false });
    this.calculateTotals();
  }

  private initializeDatePickers(): void {
    const issueDateElement = document.getElementById('issueDate');
    if (issueDateElement) {
      this.issueDatePicker = flatpickr(issueDateElement, {
        dateFormat: 'Y-m-d',
        allowInput: true,
        onChange: (selectedDates) => {
          if (selectedDates.length > 0) {
            this.invoiceForm.patchValue({
              issueDate: this.formatDate(selectedDates[0])
            });
          }
        }
      });
    }

    const dueDateElement = document.getElementById('dueDate');
    if (dueDateElement) {
      this.dueDatePicker = flatpickr(dueDateElement, {
        dateFormat: 'Y-m-d',
        allowInput: true,
        onChange: (selectedDates) => {
          if (selectedDates.length > 0) {
            this.invoiceForm.patchValue({
              dueDate: this.formatDate(selectedDates[0])
            });
          }
        }
      });
    }
  }

  private formatDate(date: any): string {
    if (!date) return '';
    
    if (typeof date === 'string') {
      return date.split('T')[0];
    }
    
    if (date instanceof Date) {
      return date.toISOString().split('T')[0];
    }
    
    return '';
  }

  private markFormGroupTouched(): void {
    Object.keys(this.invoiceForm.controls).forEach(key => {
      const control = this.invoiceForm.get(key);
      control?.markAsTouched();
      
      if (control instanceof FormArray) {
        control.controls.forEach(itemControl => {
          if (itemControl instanceof FormGroup) {
            Object.keys(itemControl.controls).forEach(itemKey => {
              itemControl.get(itemKey)?.markAsTouched();
            });
          }
        });
      }
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.invoiceForm.get(fieldName);
    // Show validation errors only after user interaction OR after form submission attempt
    // Don't show errors for fields that are still loading (empty but not yet populated)
    if (!field) return false;
    
    return field.invalid && (field.touched || field.dirty || this.submitAttempted);
  }

  // Helper method for line item validation
  isLineItemFieldInvalid(lineItem: any, fieldName: string): boolean {
    const field = lineItem.get(fieldName);
    if (!field) return false;
    
    return field.invalid && (field.touched || field.dirty || this.submitAttempted);
  }

  get canEdit(): boolean {
    return this.currentInvoice?.status !== 'PAID';
  }

  get isFormDisabled(): boolean {
    return this.currentInvoice?.status === 'PAID';
  }

  private resetFormState(): void {
    // Reset main form
    this.invoiceForm.markAsPristine();
    this.invoiceForm.markAsUntouched();
    
    // Reset all form controls
    Object.keys(this.invoiceForm.controls).forEach(key => {
      const control = this.invoiceForm.get(key);
      if (control) {
        control.markAsPristine();
        control.markAsUntouched();
        
        if (control instanceof FormArray) {
          control.controls.forEach(arrayControl => {
            if (arrayControl instanceof FormGroup) {
              arrayControl.markAsPristine();
              arrayControl.markAsUntouched();
              Object.keys(arrayControl.controls).forEach(arrayKey => {
                const innerControl = arrayControl.get(arrayKey);
                if (innerControl) {
                  innerControl.markAsPristine();
                  innerControl.markAsUntouched();
                }
              });
            }
          });
        }
      }
    });
    
    // Reset submission attempt flag
    this.submitAttempted = false;
    
    // Update form validity
    this.invoiceForm.updateValueAndValidity();
  }
}