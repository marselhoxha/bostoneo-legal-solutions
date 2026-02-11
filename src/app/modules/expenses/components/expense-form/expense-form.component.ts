import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ExpensesService } from '../../../../service/expenses.service';
import { Expense, ExpenseCategory, Vendor } from '../../../../interface/expense.interface';
import { CustomHttpResponse, Page } from '../../../../interface/appstates';
import { map, tap, catchError } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import { ClientService } from '../../../../service/client.service';
import { InvoiceService } from '../../../../service/invoice.service';
import { CaseService } from '../../../legal/services/case.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { NotificationService } from '../../../../service/notification.service';
import { NotificationManagerService, NotificationCategory, NotificationPriority } from '../../../../core/services/notification-manager.service';
import { Key } from '../../../../enum/key.enum';
import { environment } from '../../../../../environments/environment';

interface Client {
  id: number;
  name: string;
  // Add other client properties as needed
}

@Component({
  selector: 'app-expense-form',
  templateUrl: './expense-form.component.html',
  styleUrls: ['./expense-form.component.scss']
})
export class ExpenseFormComponent implements OnInit {
  expenseForm: FormGroup;
  loading = false;
  submitting = false;
  error: string | null = null;
  vendors: Vendor[] = [];
  clients: Client[] = [];
  categories: ExpenseCategory[] = [];
  invoices: any[] = [];
  legalCases: any[] = [];
  isEditMode = false;
  expenseId: number | null = null;
  selectedFile: File | null = null;
  receiptPreviewUrl: string | null = null;

  // Expense data saved when loaded in edit mode, to be applied after all dropdowns are loaded
  private pendingExpenseData: any = null;

  constructor(
    private fb: FormBuilder,
    private expensesService: ExpensesService,
    private route: ActivatedRoute,
    private router: Router,
    private changeDetectorRef: ChangeDetectorRef,
    private clientService: ClientService,
    private invoiceService: InvoiceService,
    private caseService: CaseService,
    private http: HttpClient,
    private notificationService: NotificationService,
    private notificationManager: NotificationManagerService
  ) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format for flatpickr
    
    this.expenseForm = this.fb.group({
      amount: ['', [Validators.required, Validators.min(0.01)]],
      currency: ['USD', [Validators.required]],
      date: [today, [Validators.required]],
      description: [''],
      tax: [0, [Validators.min(0)]],
      vendorId: ['', [Validators.required]],
      clientId: ['', [Validators.required]],
      categoryId: ['', [Validators.required]],
      invoiceId: [''],
      legalCaseId: ['']
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.expenseId = +id;

      // In edit mode, first load the expense data and store it
      this.loading = true;
      this.expensesService.getExpense(this.expenseId)
        .subscribe({
          next: (response) => {
            // Extract the expense data from the response
            const expense = response.data;

            // Store the expense data to apply after dropdown options are loaded
            this.pendingExpenseData = expense;

            // Now load all the dropdown data
            this.loadInitialData();
          },
          error: (error) => {
            console.error('Error loading expense:', error);
            this.error = 'Failed to load expense data for editing.';
            this.loading = false;
          }
        });
    } else {
      // In create mode, just load the initial data
      this.loadInitialData();
    }
  }

  private loadInvoices() {
    // Use the InvoiceService to fetch invoices
    return this.invoiceService.getInvoices(0, 100).pipe(
      tap(response => {
        // Cast to any to avoid TypeScript errors
        const data = response?.data as any;

        // Try different paths to find the invoice array
        if (data?.content && Array.isArray(data.content)) {
          this.invoices = data.content;
        } else if (data?.page?.content && Array.isArray(data.page.content)) {
          this.invoices = data.page.content;
        } else if (Array.isArray(data)) {
          this.invoices = data;
        } else {
          console.error('No valid invoice array found in data:', data);
          // Create a fallback invoice for testing
          this.invoices = [
            { id: 999, invoiceNumber: 'TEST-001' },
            { id: 998, invoiceNumber: 'TEST-002' }
          ];
        }
      }),
      catchError(error => {
        console.error('Error loading invoices:', error);
        this.invoices = [
          { id: 2001, invoiceNumber: 'INV-ERROR-2001' },
          { id: 2002, invoiceNumber: 'INV-ERROR-2002' }
        ];
        return of(null);
      })
    );
  }

  private loadInvoicesDirect() {
    const token = localStorage.getItem(Key.TOKEN);
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });

    return this.http.get(`${environment.apiUrl}/client/invoice/list?page=0&size=100`, { headers }).pipe(
      tap((response: any) => {
        const data = response?.data as any;

        if (data?.page?.content && Array.isArray(data.page.content)) {
          this.invoices = data.page.content;
        } else if (data?.content && Array.isArray(data.content)) {
          this.invoices = data.content;
        } else if (Array.isArray(data)) {
          this.invoices = data;
        } else {
          console.warn('Could not extract invoices from response, using test data');
          this.invoices = [
            { id: 1001, invoiceNumber: 'INV-TEST-1001' },
            { id: 1002, invoiceNumber: 'INV-TEST-1002' },
            { id: 1003, invoiceNumber: 'INV-TEST-1003' }
          ];
        }
      }),
      catchError(error => {
        console.error('Error loading invoices directly:', error);
        this.invoices = [
          { id: 2001, invoiceNumber: 'INV-ERROR-2001' },
          { id: 2002, invoiceNumber: 'INV-ERROR-2002' }
        ];
        return of(null);
      })
    );
  }

  // Modified to better handle the extraction of IDs from expense data
  private applyPendingExpenseData(): void {
    if (!this.pendingExpenseData) return;

    // Format date properly
    let expenseDate: string;
    if (this.pendingExpenseData.date) {
      const date = new Date(this.pendingExpenseData.date);
      expenseDate = date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    } else {
      expenseDate = new Date().toISOString().split('T')[0];
    }

    // Collect all relationship IDs
    let vendorId = '';
    let clientId = '';
    let categoryId = '';
    let invoiceId = '';
    let legalCaseId = '';

    // Extract vendor information from nested object
    if (this.pendingExpenseData.vendor?.id) {
      vendorId = this.pendingExpenseData.vendor.id.toString();
    }

    // Extract client information
    if (this.pendingExpenseData.client?.id) {
      clientId = this.pendingExpenseData.client.id.toString();
    }

    // Extract category information
    if (this.pendingExpenseData.category?.id) {
      categoryId = this.pendingExpenseData.category.id.toString();
    }

    // Extract invoice information
    if (this.pendingExpenseData.invoice?.id) {
      invoiceId = this.pendingExpenseData.invoice.id.toString();
    }

    // Extract legalCaseId
    if (this.pendingExpenseData.legalCaseId) {
      legalCaseId = this.pendingExpenseData.legalCaseId.toString();
    } else if (this.pendingExpenseData.legalCase?.id) {
      legalCaseId = this.pendingExpenseData.legalCase.id.toString();
    }

    // Set form values with what we were able to extract
    const formValues = {
      amount: this.pendingExpenseData.amount,
      currency: this.pendingExpenseData.currency || 'USD',
      date: expenseDate,
      description: this.pendingExpenseData.description || '',
      tax: this.pendingExpenseData.tax || 0,
      vendorId: vendorId,
      clientId: clientId,
      categoryId: categoryId,
      invoiceId: invoiceId,
      legalCaseId: legalCaseId
    };

    // Patching the form values
    this.expenseForm.patchValue(formValues);

    // Clear the pending data
    this.pendingExpenseData = null;
    this.loading = false;
    this.changeDetectorRef.detectChanges();
  }
  
  // Modified to call applyPendingExpenseData at the end
  private loadInitialData(): void {
    this.loading = true;
    this.error = null;
    this.changeDetectorRef.detectChanges();

    // First load the main data without invoices
    forkJoin({
      vendors: this.expensesService.getVendors(),
      clients: this.expensesService.getClients(),
      categories: this.expensesService.getCategories(),
      legalCases: this.caseService.getCases(0, 100)
    })
    .subscribe({
      next: (results) => {
        // Process vendors
        if (results.vendors?.data) {
          this.vendors = results.vendors.data;
        }

        // Process clients
        if (results.clients?.data) {
          this.clients = results.clients.data;
        }

        // Process categories
        if (results.categories) {
          this.categories = results.categories;
        }

        // Process legal cases
        if (results.legalCases?.data?.page?.content) {
          this.legalCases = results.legalCases.data.page.content;
        }

        // Try to load all invoices using the new method that supports size parameter
        this.clientService.allInvoices$(0, 100).subscribe({
          next: (response) => {
            // Cast to any to avoid TypeScript errors with accessing potential properties
            const data = response?.data as any;

            // Try different paths to find invoices
            if (data?.page?.content && Array.isArray(data.page.content)) {
              this.invoices = data.page.content;
            } else if (data?.content && Array.isArray(data.content)) {
              this.invoices = data.content;
            } else if (Array.isArray(data)) {
              this.invoices = data;
            } else {
              console.warn("Could not find invoices in the expected response structure");
              // If no invoices found in allInvoices response, try direct method
              this.loadInvoicesDirect().subscribe();
            }

            // Now that all dropdowns are loaded, apply pending expense data if in edit mode
            if (this.pendingExpenseData) {
              this.applyPendingExpenseData();
            } else {
              this.loading = false;
              this.changeDetectorRef.detectChanges();
            }
          },
          error: (error) => {
            console.error('Error loading all invoices:', error);
            // Fall back to direct HTTP method
            this.loadInvoicesDirect().subscribe({
              next: () => {
                if (this.pendingExpenseData) {
                  this.applyPendingExpenseData();
                } else {
                  this.loading = false;
                  this.changeDetectorRef.detectChanges();
                }
              },
              error: (directError) => {
                console.error('Direct invoice loading also failed:', directError);
                // Fall back to original method as last resort
                this.loadInvoices().subscribe({
                  next: () => {
                    if (this.pendingExpenseData) {
                      this.applyPendingExpenseData();
                    } else {
                      this.loading = false;
                      this.changeDetectorRef.detectChanges();
                    }
                  },
                  error: () => {
                    console.warn('All invoice loading methods failed');
                    if (this.pendingExpenseData) {
                      this.applyPendingExpenseData();
                    } else {
                      this.loading = false;
                      this.changeDetectorRef.detectChanges();
                    }
                  }
                });
              }
            });
          }
        });
      },
      error: (error) => {
        console.error('Error loading initial data:', error);
        this.error = 'Failed to load required data. Please try again.';
        this.loading = false;
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      
      // Create a preview URL for the selected file
      if (this.selectedFile) {
        // Revoke previous URL to prevent memory leaks
        if (this.receiptPreviewUrl) {
          URL.revokeObjectURL(this.receiptPreviewUrl);
        }
        
        // Create new object URL for preview
        this.receiptPreviewUrl = URL.createObjectURL(this.selectedFile);
      }
    } else {
      this.selectedFile = null;
      this.receiptPreviewUrl = null;
    }
  }

  cancel(): void {
    this.router.navigate(['/expenses']);
  }

  /**
   * Send notification when expense is submitted
   */
  private async notifyExpenseSubmitted(expenseData: any, isEdit: boolean): Promise<void> {
    try {
      // Get approvers and finance team
      const financeManagers = await this.notificationManager.getUsersByRole('FINANCE_MANAGER');
      const expenseApprovers = await this.notificationManager.getUsersByRole('EXPENSE_APPROVER');

      const categoryName = this.categories.find(c => c.id == expenseData.categoryId)?.name || 'Unknown';
      const vendorName = this.vendors.find(v => v.id == expenseData.vendorId)?.name || 'Unknown';
      
      const title = isEdit ? 'Expense Updated' : 'New Expense Submitted';
      const message = `${isEdit ? 'Updated' : 'New'} expense: $${expenseData.amount} for ${categoryName} from ${vendorName}`;

      await this.notificationManager.sendNotification(
        NotificationCategory.SYSTEM, // Using SYSTEM since there's no EXPENSE category
        title,
        message,
        expenseData.amount > 1000 ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
        {
          primaryUsers: expenseApprovers,
          secondaryUsers: financeManagers
        },
        `/expenses`,
        {
          entityId: this.expenseId || null,
          entityType: 'expense',
          additionalData: {
            amount: expenseData.amount,
            category: categoryName,
            vendor: vendorName,
            date: expenseData.date,
            description: expenseData.description,
            isEdit
          }
        }
      );
    } catch (error) {
      console.error('Failed to send expense notification:', error);
    }
  }

  onSubmit(): void {
    if (this.expenseForm.valid) {
      this.submitting = true;
      const expenseData = this.expenseForm.value;
      
      if (expenseData.date) {
        const date = new Date(expenseData.date);
        date.setHours(12, 0, 0, 0);
        expenseData.date = date.toISOString().slice(0, 19);
      }

      if (!expenseData.categoryId) {
        this.error = 'Category is required';
        this.submitting = false;
        return;
      }
      expenseData.categoryId = Number(expenseData.categoryId);

      if (!expenseData.vendorId) {
        this.error = 'Vendor is required';
        this.submitting = false;
        return;
      }
      expenseData.vendorId = Number(expenseData.vendorId);

      if (!expenseData.clientId) {
        this.error = 'Client is required';
        this.submitting = false;
        return;
      }
      expenseData.clientId = Number(expenseData.clientId);

      expenseData.amount = Number(expenseData.amount);
      expenseData.tax = Number(expenseData.tax);
      
      const request$ = this.isEditMode && this.expenseId
        ? this.expensesService.updateExpense(this.expenseId, expenseData)
        : this.expensesService.createExpense(expenseData);

      request$.subscribe({
        next: (response) => {
          // Send expense submission notification (existing)
          this.notifyExpenseSubmitted(expenseData, this.isEditMode);

          this.router.navigate(['/expenses']);
        },
        error: (error) => {
          console.error('Error saving expense:', error);
          this.error = error.error?.message || 'Failed to save expense. Please try again later.';
          this.submitting = false;
        }
      });
    } else {
      Object.keys(this.expenseForm.controls).forEach(key => {
        const control = this.expenseForm.get(key);
        control?.markAsTouched();
      });
    }
  }

  private loadExpense(): void {
    if (this.expenseId) {
      this.loading = true;
      this.expensesService.getExpense(this.expenseId).subscribe({
        next: (response: CustomHttpResponse<Expense>) => {
          const expense = response.data;

          // Convert relevant IDs to strings for form comparison
          const vendorId = expense.vendor?.id?.toString() || '';
          const clientId = expense.client?.id?.toString() || '';
          const categoryId = expense.category?.id?.toString() || '';
          const invoiceId = expense.invoice?.id?.toString() || '';
          const legalCaseId = expense.legalCaseId?.toString() || '';

          const formValues = {
            date: expense.date ? new Date(expense.date) : null,
            amount: expense.amount || '',
            description: expense.description || '',
            tax: expense.tax || 0,
            vendorId,
            clientId,
            categoryId,
            invoiceId,
            legalCaseId
          };

          this.expenseForm.patchValue(formValues);
          this.loading = false;
        },
        error: (error: HttpErrorResponse) => {
          console.error('Error loading expense:', error);
          this.notificationService.onError('Failed to load expense data');
          this.loading = false;
        }
      });
    }
  }

  private createForm(): void {
    this.expenseForm = this.fb.group({
      date: [new Date(), [Validators.required]],
      amount: ['', [Validators.required, Validators.min(0)]],
      description: ['', [Validators.required]],
      notes: [''],
      reference: [''],
      tax: [0, [Validators.min(0)]],
      vendorId: ['', [Validators.required]],
      clientId: ['', [Validators.required]],
      categoryId: ['', [Validators.required]],
      invoiceId: [''],
      legalCaseId: ['']
    });
  }

  // When populating the dropdowns, ensure we're working with string IDs
  private loadVendors(): void {
    this.expensesService.getVendors().subscribe({
      next: (response: CustomHttpResponse<Vendor[]>) => {
        this.vendors = response.data || [];
      },
      error: (error: HttpErrorResponse) => {
        console.error('Error loading vendors:', error);
        this.notificationService.onError('Failed to load vendors');
      }
    });
  }
} 
