import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ExpensesService } from '../../../../service/expenses.service';
import { Expense, ExpenseCategory, Vendor } from '../../../../interface/expense.interface';
import { CustomHttpResponse, Page } from '../../../../interface/appstates';
import { map, tap, catchError } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import { CustomerService } from '../../../../service/customer.service';
import { CaseService } from '../../../legal/services/case.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { NotificationService } from '../../../../service/notification.service';

interface Customer {
  id: number;
  name: string;
  // Add other customer properties as needed
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
  customers: Customer[] = [];
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
    private customerService: CustomerService,
    private caseService: CaseService,
    private http: HttpClient,
    private notificationService: NotificationService
  ) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format for flatpickr
    
    this.expenseForm = this.fb.group({
      amount: ['', [Validators.required, Validators.min(0.01)]],
      currency: ['USD', [Validators.required]],
      date: [today, [Validators.required]],
      description: [''],
      tax: [0, [Validators.min(0)]],
      vendorId: ['', [Validators.required]],
      customerId: ['', [Validators.required]],
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
      console.log(`Edit mode detected for expense ID: ${this.expenseId}`);
      
      // In edit mode, first load the expense data and store it
      this.loading = true;
      this.expensesService.getExpense(this.expenseId)
        .subscribe({
          next: (response) => {
            // Log the complete raw response
            console.log('EXPENSE API RESPONSE:', JSON.stringify(response, null, 2));
            
            // Extract the expense data from the response
            const expense = response.data;
            console.log('Extracted expense data:', JSON.stringify(expense, null, 2));
            
            // Detailed property logging for debugging
            console.log('EXPENSE PROPERTIES DUMP:');
            console.log('- expense.id:', expense.id, typeof expense.id);
            console.log('- expense.amount:', expense.amount, typeof expense.amount);
            console.log('- expense.vendor:', expense.vendor, typeof expense.vendor);
            console.log('- expense.vendorId:', expense.vendorId, typeof expense.vendorId);
            console.log('- expense.customer:', expense.customer, typeof expense.customer);
            console.log('- expense.customerId:', expense.customerId, typeof expense.customerId);
            console.log('- expense.category:', expense.category, typeof expense.category);
            console.log('- expense.categoryId:', expense.categoryId, typeof expense.categoryId);
            console.log('- expense.invoice:', expense.invoice, typeof expense.invoice);
            console.log('- expense.invoiceId:', expense.invoiceId, typeof expense.invoiceId);
            console.log('- expense.legalCaseId:', expense.legalCaseId, typeof expense.legalCaseId);
            
            // Store the expense data to apply after dropdown options are loaded
            this.pendingExpenseData = expense;
            
            // Now load all the dropdown data
            this.loadInitialData();
          },
          error: (error) => {
            console.error('Error directly loading expense:', error);
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
    console.log('Loading invoices separately');
    
    // Use a direct HTTP call to fetch invoices with full error debugging
    return this.customerService.invoices$(0).pipe(  // Only accepts page parameter
      tap(response => {
        console.log('Raw invoices response:', JSON.stringify(response));
        
        // Cast to any to avoid TypeScript errors
        const data = response?.data as any;
        
        // Try different paths to find the invoice array
        if (data?.page?.content && Array.isArray(data.page.content)) {
          this.invoices = data.page.content;
          console.log(`Loaded ${this.invoices.length} invoices from page.content`, this.invoices);
        } else if (data?.content && Array.isArray(data.content)) {
          this.invoices = data.content;
          console.log(`Loaded ${this.invoices.length} invoices from content`, this.invoices);
        } else if (Array.isArray(data)) {
          this.invoices = data;
          console.log(`Loaded ${this.invoices.length} invoices from data array`, this.invoices);
        } else {
          console.error('No valid invoice array found in data:', data);
          // Create a fallback invoice for testing
          this.invoices = [
            { id: 999, invoiceNumber: 'TEST-001' },
            { id: 998, invoiceNumber: 'TEST-002' }
          ];
          console.log('Using fallback test invoices:', this.invoices);
        }
      })
    );
  }

  private loadInvoicesDirect() {
    console.log('Loading invoices directly via HTTP');
    
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
    
    return this.http.get('http://localhost:8085/customer/invoice/list?page=0&size=100', { headers }).pipe(
      tap((response: any) => {
        console.log('Direct invoice API response:', JSON.stringify(response));
        
        const data = response?.data as any;
        
        if (data?.page?.content && Array.isArray(data.page.content)) {
          this.invoices = data.page.content;
          console.log('Invoices loaded from direct API call (page.content):', this.invoices);
        } else if (data?.content && Array.isArray(data.content)) {
          this.invoices = data.content;
          console.log('Invoices loaded from direct API call (content):', this.invoices);
        } else if (Array.isArray(data)) {
          this.invoices = data;
          console.log('Invoices loaded from direct API call (data array):', this.invoices);
        } else {
          console.warn('Could not extract invoices from response, using test data');
          console.log('Response structure:', data);
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
    
    console.log('Applying pending expense data to form - RAW DATA:', JSON.stringify(this.pendingExpenseData, null, 2));
    
    // Log what dropdown options we have available
    console.log('Available vendors:', this.vendors.map(v => `${v.id}: ${v.name}`));
    console.log('Available customers:', this.customers.map(c => `${c.id}: ${c.name}`));
    console.log('Available categories:', this.categories.map(c => `${c.id}: ${c.name}`));
    console.log('Available invoices:', this.invoices.map(i => `${i.id}: ${i.invoiceNumber || i.id}`));
    console.log('Available legal cases:', this.legalCases.map(l => `${l.id}: ${l.caseNumber || l.id}`));
    
    // Print all properties of the expense for debugging
    console.log('EXPENSE DATA PROPERTIES:');
    Object.keys(this.pendingExpenseData).forEach(key => {
      console.log(`- ${key}:`, this.pendingExpenseData[key]);
    });
    
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
    let customerId = '';
    let categoryId = '';
    let invoiceId = '';
    let legalCaseId = '';
    
    // In the backend, relationships are likely stored as embedded objects
    // Extract them from the expense data
    
    // Try to extract vendor information - it could be a nested object
    if (this.pendingExpenseData.vendor) {
      console.log('Found vendor object:', this.pendingExpenseData.vendor);
      if (this.pendingExpenseData.vendor.id) {
        vendorId = this.pendingExpenseData.vendor.id.toString();
        console.log('Extracted vendorId from vendor object:', vendorId);
      }
    }
    
    // Try to extract customer information
    if (this.pendingExpenseData.customer) {
      console.log('Found customer object:', this.pendingExpenseData.customer);
      if (this.pendingExpenseData.customer.id) {
        customerId = this.pendingExpenseData.customer.id.toString();
        console.log('Extracted customerId from customer object:', customerId);
      }
    }
    
    // Try to extract category information
    if (this.pendingExpenseData.category) {
      console.log('Found category object:', this.pendingExpenseData.category);
      if (this.pendingExpenseData.category.id) {
        categoryId = this.pendingExpenseData.category.id.toString();
        console.log('Extracted categoryId from category object:', categoryId);
      }
    }
    
    // Try to extract invoice information
    if (this.pendingExpenseData.invoice) {
      console.log('Found invoice object:', this.pendingExpenseData.invoice);
      if (this.pendingExpenseData.invoice.id) {
        invoiceId = this.pendingExpenseData.invoice.id.toString();
        console.log('Extracted invoiceId from invoice object:', invoiceId);
      }
    }
    
    // Try to get legalCaseId
    if (this.pendingExpenseData.legalCaseId) {
      legalCaseId = this.pendingExpenseData.legalCaseId.toString();
      console.log('Extracted legalCaseId:', legalCaseId);
    } else if (this.pendingExpenseData.legalCase && this.pendingExpenseData.legalCase.id) {
      legalCaseId = this.pendingExpenseData.legalCase.id.toString();
      console.log('Extracted legalCaseId from legalCase object:', legalCaseId);
    }
    
    // Check if we have valid IDs that match our available options
    const validVendor = vendorId && this.vendors.some(v => v.id.toString() === vendorId);
    const validCustomer = customerId && this.customers.some(c => c.id.toString() === customerId);
    const validCategory = categoryId && this.categories.some(c => c.id.toString() === categoryId);
    
    console.log('Validation checks:', {
      validVendor,
      validCustomer, 
      validCategory,
      vendorId,
      customerId,
      categoryId
    });
    
    if (!validVendor) {
      console.warn(`Vendor ID ${vendorId} is not in the available vendors list.`);
    }
    if (!validCustomer) {
      console.warn(`Customer ID ${customerId} is not in the available customers list.`);
    }
    if (!validCategory) {
      console.warn(`Category ID ${categoryId} is not in the available categories list.`);
    }
    
    // Set form values with what we were able to extract
    const formValues = {
      amount: this.pendingExpenseData.amount,
      currency: this.pendingExpenseData.currency || 'USD',
      date: expenseDate,
      description: this.pendingExpenseData.description || '',
      tax: this.pendingExpenseData.tax || 0,
      vendorId: vendorId,
      customerId: customerId,
      categoryId: categoryId,
      invoiceId: invoiceId,
      legalCaseId: legalCaseId
    };
    
    console.log('Form values to apply:', formValues);
    
    // Patching the form values
    this.expenseForm.patchValue(formValues);
    console.log('Form values after patch:', this.expenseForm.value);
    
    // Clear the pending data
    this.pendingExpenseData = null;
    this.loading = false;
    this.changeDetectorRef.detectChanges();
  }
  
  // Modified to call applyPendingExpenseData at the end
  private loadInitialData(): void {
    this.loading = true;
    this.error = null;
    console.log('loadInitialData started, loading = true');
    this.changeDetectorRef.detectChanges();

    // First load the main data without invoices
    forkJoin({
      vendors: this.expensesService.getVendors(),
      customers: this.expensesService.getCustomers(),
      categories: this.expensesService.getCategories(),
      legalCases: this.caseService.getCases(0, 100)
    })
    .subscribe({
      next: (results) => {
        console.log('Main data loaded:', results);
        
        // Process vendors
        if (results.vendors?.data) {
          this.vendors = results.vendors.data;
          console.log('Loaded vendors:', this.vendors);
        }
        
        // Process customers
        if (results.customers?.data) {
          this.customers = results.customers.data;
          console.log('Loaded customers:', this.customers);
        }
        
        // Process categories
        if (results.categories) {
          this.categories = results.categories;
          console.log('Loaded categories:', this.categories);
        }
        
        // Process legal cases
        if (results.legalCases?.data?.page?.content) {
          this.legalCases = results.legalCases.data.page.content;
          console.log('Loaded legal cases:', this.legalCases);
        }
        
        // Try to load all invoices using the new method that supports size parameter
        this.customerService.allInvoices$(0, 100).subscribe({
          next: (response) => {
            console.log('All invoices response:', response);
            
            // Cast to any to avoid TypeScript errors with accessing potential properties
            const data = response?.data as any;
            
            // Try different paths to find invoices
            if (data?.page?.content && Array.isArray(data.page.content)) {
              this.invoices = data.page.content;
              console.log(`Loaded ${this.invoices.length} invoices from page.content`, this.invoices);
            } else if (data?.content && Array.isArray(data.content)) {
              this.invoices = data.content;
              console.log(`Loaded ${this.invoices.length} invoices from content`, this.invoices);
            } else if (Array.isArray(data)) {
              this.invoices = data;
              console.log(`Loaded ${this.invoices.length} invoices from data array`, this.invoices);
            } else {
              console.warn("Could not find invoices in the expected response structure");
              console.log("Response data structure:", data);
              
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
                // Now that all dropdowns are loaded, apply pending expense data if in edit mode
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
                    // Now that all dropdowns are loaded, apply pending expense data if in edit mode
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
        console.log('Error in loadInitialData, setting loading = false');
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
      if (this.selectedFile.type.startsWith('image/')) {
        // For image files, create a direct URL
        this.receiptPreviewUrl = URL.createObjectURL(this.selectedFile);
      } else if (this.selectedFile.type === 'application/pdf') {
        // For PDFs, we'll show a PDF icon or first page preview in the template
        this.receiptPreviewUrl = 'assets/images/pdf-icon.png'; // Update this path as needed
      } else {
        // For other file types, show a generic file icon
        this.receiptPreviewUrl = 'assets/images/file-icon.png'; // Update this path as needed
      }
    }
  }

  cancel(): void {
    this.router.navigate(['/expenses']);
  }

  onSubmit(): void {
    if (this.expenseForm.valid) {
      this.submitting = true;
      this.error = null;
      const expenseData = { ...this.expenseForm.value };
      
      if (expenseData.date) {
        const date = new Date(expenseData.date);
        date.setHours(12, 0, 0, 0);
        expenseData.date = date.toISOString().slice(0, 19);
      }

      // Validate and convert required IDs
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

      if (!expenseData.customerId) {
        this.error = 'Customer is required';
        this.submitting = false;
        return;
      }
      expenseData.customerId = Number(expenseData.customerId);

      // Convert optional IDs if present
      if (expenseData.invoiceId) {
        expenseData.invoiceId = Number(expenseData.invoiceId);
      }
      
      if (expenseData.legalCaseId) {
        expenseData.legalCaseId = Number(expenseData.legalCaseId);
      }

      expenseData.amount = Number(expenseData.amount);
      expenseData.tax = Number(expenseData.tax);
      
      // If there's a file, upload it first, otherwise save directly
      if (this.selectedFile) {
        this.handleFileUpload(expenseData);
      } else {
        this.saveExpense(expenseData);
      }
    } else {
      // Mark all fields as touched to show validation errors
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
          console.log('Raw expense data from API:', expense);
          
          // Convert relevant IDs to strings for form comparison
          const vendorId = expense.vendor?.id?.toString() || '';
          const customerId = expense.customer?.id?.toString() || '';
          const categoryId = expense.category?.id?.toString() || '';
          const invoiceId = expense.invoice?.id?.toString() || '';
          const legalCaseId = expense.legalCaseId?.toString() || '';
          
          console.log('Extracted IDs:', {
            vendorId,
            customerId,
            categoryId,
            invoiceId,
            legalCaseId
          });
          
          const formValues = {
            date: expense.date ? new Date(expense.date) : null,
            amount: expense.amount || '',
            description: expense.description || '',
            tax: expense.tax || 0,
            vendorId,
            customerId, 
            categoryId,
            invoiceId,
            legalCaseId
          };
          
          console.log('Setting form values:', formValues);
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
      customerId: ['', [Validators.required]],
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
        console.log('Loaded vendors:', this.vendors.map(v => ({id: v.id, name: v.name})));
      },
      error: (error: HttpErrorResponse) => {
        console.error('Error loading vendors:', error);
        this.notificationService.onError('Failed to load vendors');
      }
    });
  }

  // Upload the file first, then submit the expense with the receipt ID
  private handleFileUpload(expenseData: any): void {
    if (!this.selectedFile) {
      this.error = 'No file selected for upload';
      this.submitting = false;
      return;
    }
    
    // Check file size (10MB limit)
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (this.selectedFile.size > MAX_SIZE) {
      this.error = `File size exceeds 10MB limit (${Math.round(this.selectedFile.size / (1024 * 1024))}MB)`;
      this.submitting = false;
      return;
    }
    
    this.notificationService.onInfo('Uploading receipt...');
    
    this.expensesService.uploadReceipt(this.selectedFile).subscribe({
      next: (response) => {
        if (!response || !response.data) {
          this.error = 'Receipt upload failed: Invalid server response';
          this.submitting = false;
          return;
        }
        
        // Add receipt information to expense data
        expenseData.receiptId = Number(response.data.id);
        expenseData.receiptFileName = response.data.fileName;
        
        // In edit mode, use the attachReceiptToExpense endpoint
        if (this.isEditMode && this.expenseId) {
          this.expensesService.attachReceiptToExpense(this.expenseId, expenseData.receiptId).subscribe({
            next: () => {
              this.notificationService.onSuccess('Receipt attached to expense successfully');
              this.router.navigate(['/expenses']);
            },
            error: () => {
              // Try fallback to regular update if attachment endpoint fails
              this.saveExpense(expenseData);
            }
          });
        } else {
          // In create mode, proceed with normal expense creation
          this.saveExpense(expenseData);
        }
      },
      error: (error) => {
        this.submitting = false;
        this.error = error.message || 'Failed to upload receipt. Please try again.';
        this.notificationService.onError(this.error);
      }
    });
  }
  
  // Submit the expense data to the server
  private saveExpense(expenseData: any): void {
    // Make sure IDs are properly converted to numbers
    if (expenseData.receiptId) {
      expenseData.receiptId = Number(expenseData.receiptId);
    }
    
    const request$ = this.isEditMode && this.expenseId
      ? this.expensesService.updateExpense(this.expenseId, expenseData)
      : this.expensesService.createExpense(expenseData);

    request$.subscribe({
      next: () => {
        this.notificationService.onSuccess('Expense saved successfully');
        this.router.navigate(['/expenses']);
      },
      error: (error) => {
        this.submitting = false;
        this.error = error.error?.message || 'Failed to save expense. Please try again.';
        this.notificationService.onError(this.error);
      }
    });
  }
} 
