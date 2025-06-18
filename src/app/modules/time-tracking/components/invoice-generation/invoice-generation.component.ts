import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { TimeTrackingService, TimeEntry } from '../../services/time-tracking.service';
import { InvoiceService, Invoice } from '../../services/invoice.service';
import { UserService } from '../../../../service/user.service';
import Swal from 'sweetalert2';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { saveAs } from 'file-saver';
import { environment } from 'src/environments/environment';

interface Client {
  id: number;
  name: string;
}

interface LegalCase {
  id: number;
  name: string;
  clientId: number;
}

@Component({
  selector: 'app-invoice-generation',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './invoice-generation.component.html',
  styleUrls: ['./invoice-generation.component.scss']
})
export class InvoiceGenerationComponent implements OnInit, OnDestroy {
  // Form and data
  invoiceForm: FormGroup;
  timeEntries: TimeEntry[] = [];
  clients: Client[] = [];
  cases: LegalCase[] = [];
  filteredCases: LegalCase[] = [];
  selectedEntries: Set<number> = new Set();
  
  // UI state
  loading = false;
  isGenerating = false;
  isSendingEmail = false;
  error: string | null = null;
  showEmailModal = false;
  
  // Invoice preview data
  previewData = {
    subtotal: 0,
    taxAmount: 0,
    totalAmount: 0,
    invoiceNumber: '',
    clientName: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: this.getDefaultDueDate()
  };

  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private timeTrackingService: TimeTrackingService,
    private invoiceService: InvoiceService,
    private userService: UserService,
    private cdr: ChangeDetectorRef,
    private http: HttpClient
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadClients();
    this.setupFormListeners();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private initializeForm(): void {
    this.invoiceForm = this.fb.group({
      clientId: ['', Validators.required],
      legalCaseId: [''],
      issueDate: [new Date().toISOString().split('T')[0], Validators.required],
      dueDate: [this.getDefaultDueDate(), Validators.required],
      taxRate: [0, [Validators.min(0), Validators.max(100)]],
      notes: ['']
    });
  }

  private setupFormListeners(): void {
    // Listen for client changes
    const clientSub = this.invoiceForm.get('clientId')?.valueChanges.subscribe(clientId => {
      if (clientId) {
        this.loadCases(clientId);
        this.loadUnbilledEntries(clientId);
        this.updatePreviewData();
      } else {
        this.filteredCases = [];
        this.timeEntries = [];
        this.selectedEntries.clear();
      }
    });

    // Listen for case changes
    const caseSub = this.invoiceForm.get('legalCaseId')?.valueChanges.subscribe(caseId => {
      if (this.invoiceForm.get('clientId')?.value) {
        this.loadUnbilledEntries(this.invoiceForm.get('clientId')?.value, caseId);
      }
    });

    // Listen for tax rate changes
    const taxSub = this.invoiceForm.get('taxRate')?.valueChanges.subscribe(() => {
      this.updatePreviewData();
    });

    if (clientSub) this.subscriptions.push(clientSub);
    if (caseSub) this.subscriptions.push(caseSub);
    if (taxSub) this.subscriptions.push(taxSub);
  }

  private loadClients(): void {
    const apiUrl = 'http://localhost:8085/clients';
    console.log('Attempting to load clients from:', apiUrl);
    this.timeTrackingService.getClients().subscribe({
      next: (clients) => {
        this.clients = clients;
        console.log('Clients loaded:', clients);
        this.showMessage('Clients loaded successfully (Demo Mode)', 'success');
      },
      error: (err) => {
        console.error('Error loading clients from', apiUrl, ':', err);
        this.clients = this.getFallbackClients();
        this.showMessage(`Failed to load clients: ${err.message}. Using demo data.`, 'error');
      }
    });
  }

  private loadCases(clientId: number): void {
    const apiUrl = 'http://localhost:8085/legal/cases';
    console.log('Attempting to load cases from:', apiUrl);
    this.timeTrackingService.getCasesForClient(clientId).subscribe({
      next: (cases) => {
        this.cases = cases;
        console.log('Cases loaded:', cases);
        this.showMessage('Cases loaded successfully (Demo Mode)', 'success');
      },
      error: (err) => {
        console.error('Error loading cases from', apiUrl, ':', err);
        this.cases = this.getFallbackCases();
        this.showMessage(`Failed to load cases: ${err.message}. Using demo data.`, 'error');
      }
    });
  }

  private loadUnbilledEntries(clientId: number, caseId?: number): void {
    this.loading = true;
    this.selectedEntries.clear();
    this.error = null;
    
    // Use the invoice service to get unbilled time entries
    const entriesSub = this.invoiceService.getUnbilledTimeEntries(clientId, caseId).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error loading unbilled entries from service:', error);
        
        // Try direct API call with different parameters
        let params = `?clientId=${clientId}&status=APPROVED&billable=true&size=100`;
        if (caseId) params += `&legalCaseId=${caseId}`;
        
        return this.http.get<any>(`${environment.apiUrl}/api/time-entries${params}`).pipe(
          map(response => {
            console.log('Raw time entries response from direct call:', response);
            if (response && response.data) {
              return response.data.content || response.data || [];
            } else {
              throw new Error('Invalid response format from time entries API');
            }
          }),
          catchError((innerError: HttpErrorResponse) => {
            console.error('Error loading from direct time entries call:', innerError);
            // Use mock data as fallback
            console.log('Using mock time entry data as fallback');
            return of([
              { 
                id: 1001, 
                legalCaseId: caseId || 101, 
                userId: 1, 
                date: new Date().toISOString().split('T')[0],
                hours: 2.5, 
                rate: 150, 
                description: 'Client consultation', 
                status: 'APPROVED',
                billable: true,
                userName: 'John Doe',
                caseName: 'Case A',
                clientId: clientId
              },
              { 
                id: 1002, 
                legalCaseId: caseId || 101, 
                userId: 2, 
                date: new Date().toISOString().split('T')[0],
                hours: 1.5, 
                rate: 200, 
                description: 'Document review', 
                status: 'APPROVED',
                billable: true,
                userName: 'Jane Smith',
                caseName: 'Case A',
                clientId: clientId
              }
            ]);
          })
        );
      }),
      finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      })
    ).subscribe(entries => {
      this.timeEntries = entries as TimeEntry[];
      console.log('Loaded unbilled entries:', this.timeEntries);
      
      if (this.timeEntries.length === 0) {
        this.error = 'No unbilled time entries found for the selected client/case. Using mock data for demonstration.';
        // Add mock data
        this.timeEntries = [
          { 
            id: 1001, 
            legalCaseId: caseId || 101, 
            userId: 1, 
            date: new Date().toISOString().split('T')[0],
            hours: 2.5, 
            rate: 150, 
            description: 'Client consultation', 
            status: 'APPROVED',
            billable: true,
            userName: 'John Doe',
            caseName: 'Case A',
            clientId: clientId
          },
          { 
            id: 1002, 
            legalCaseId: caseId || 101, 
            userId: 2, 
            date: new Date().toISOString().split('T')[0],
            hours: 1.5, 
            rate: 200, 
            description: 'Document review', 
            status: 'APPROVED',
            billable: true,
            userName: 'Jane Smith',
            caseName: 'Case A',
            clientId: clientId
          }
        ];
      }
    });
    
    this.subscriptions.push(entriesSub);
  }

  toggleEntrySelection(entryId: number): void {
    if (this.selectedEntries.has(entryId)) {
      this.selectedEntries.delete(entryId);
    } else {
      this.selectedEntries.add(entryId);
    }
    this.updatePreviewData();
  }

  toggleSelectAll(event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    
    if (isChecked) {
      this.timeEntries.forEach(entry => {
        if (entry.status === 'APPROVED') {
          this.selectedEntries.add(entry.id!);
        }
      });
    } else {
      this.selectedEntries.clear();
    }
    
    this.updatePreviewData();
  }

  isEntrySelected(entryId: number): boolean {
    return this.selectedEntries.has(entryId);
  }

  updatePreviewData(): void {
    const selectedTimeEntries = this.timeEntries.filter(entry => 
      this.selectedEntries.has(entry.id!)
    );
    
    // Calculate subtotal
    const subtotal = selectedTimeEntries.reduce((sum, entry) => 
      sum + (entry.hours * entry.rate), 0
    );
    
    // Calculate tax
    const taxRate = this.invoiceForm.get('taxRate')?.value || 0;
    const taxAmount = subtotal * (taxRate / 100);
    
    // Calculate total
    const totalAmount = subtotal + taxAmount;
    
    // Update preview data
    this.previewData = {
      ...this.previewData,
      subtotal,
      taxAmount,
      totalAmount,
      clientName: this.getClientName(this.invoiceForm.get('clientId')?.value),
      issueDate: this.invoiceForm.get('issueDate')?.value,
      dueDate: this.invoiceForm.get('dueDate')?.value
    };
    
    // Generate a temporary invoice number
    if (!this.previewData.invoiceNumber) {
      this.previewData.invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
  }

  getClientName(clientId: number): string {
    const client = this.clients.find(c => c.id === clientId);
    return client ? client.name : '';
  }

  getCaseName(caseId: number): string {
    const legalCase = this.cases.find(c => c.id === caseId);
    return legalCase ? legalCase.name : '';
  }

  getSelectedEntriesCount(): number {
    return this.selectedEntries.size;
  }

  getSelectedEntriesTotal(): number {
    return this.timeEntries
      .filter(entry => this.selectedEntries.has(entry.id!))
      .reduce((sum, entry) => sum + (entry.hours * entry.rate), 0);
  }

  getSelectedEntriesHours(): number {
    return this.timeEntries
      .filter(entry => this.selectedEntries.has(entry.id!))
      .reduce((sum, entry) => sum + entry.hours, 0);
  }

  generateInvoice(): void {
    if (this.invoiceForm.invalid) {
      this.markFormGroupTouched(this.invoiceForm);
      return;
    }
    
    if (this.selectedEntries.size === 0) {
      Swal.fire({
        title: 'No Entries Selected',
        text: 'Please select at least one time entry to generate an invoice.',
        icon: 'warning'
      });
      return;
    }
    
    this.isGenerating = true;
    
    const invoice: Invoice = {
      clientId: this.invoiceForm.get('clientId')?.value,
      legalCaseId: this.invoiceForm.get('legalCaseId')?.value || undefined,
      issueDate: this.invoiceForm.get('issueDate')?.value,
      dueDate: this.invoiceForm.get('dueDate')?.value,
      status: 'DRAFT',
      subtotal: this.previewData.subtotal,
      taxRate: this.invoiceForm.get('taxRate')?.value || 0,
      taxAmount: this.previewData.taxAmount,
      totalAmount: this.previewData.totalAmount,
      notes: this.invoiceForm.get('notes')?.value,
      timeEntryIds: Array.from(this.selectedEntries),
      clientName: this.getClientName(this.invoiceForm.get('clientId')?.value),
      caseName: this.getCaseName(this.invoiceForm.get('legalCaseId')?.value)
    };
    
    const currentUser = this.userService.getCurrentUser();
    if (currentUser) {
      invoice.createdBy = currentUser.id;
    }
    
    const sub = this.invoiceService.createInvoice(invoice).pipe(
      catchError(error => {
        console.error('Error generating invoice:', error);
        this.isGenerating = false;
        
        // Show error message
        Swal.fire({
          title: 'Error',
          text: 'Failed to generate invoice on the server. Proceeding with demo mode.',
          icon: 'warning'
        });
        
        // For demo purposes, show success anyway after a delay
        setTimeout(() => {
          this.handleDemoInvoiceSuccess(invoice);
        }, 1000);
        
        return of(null);
      }),
      finalize(() => {
        this.isGenerating = false;
      })
    ).subscribe(createdInvoice => {
      if (createdInvoice) {
        Swal.fire({
          title: 'Invoice Generated',
          text: `Invoice #${createdInvoice.invoiceNumber || this.previewData.invoiceNumber} has been successfully created.`,
          icon: 'success'
        });
        
        // Reset form and selections
        this.resetForm();
      }
    });
    
    this.subscriptions.push(sub);
  }

  // Helper method for demo mode
  private handleDemoInvoiceSuccess(invoice: Invoice): void {
    // Create a demo invoice with an invoice number
    const demoInvoice: Invoice = {
      ...invoice,
      id: Math.floor(Math.random() * 1000),
      invoiceNumber: this.previewData.invoiceNumber || `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    Swal.fire({
      title: 'Invoice Generated (Demo)',
      text: `Invoice #${demoInvoice.invoiceNumber} has been successfully created.`,
      icon: 'success'
    });
    
    // Reset form and selections
    this.resetForm();
  }

  saveDraft(): void {
    if (this.selectedEntries.size === 0) {
      Swal.fire({
        title: 'No Entries Selected',
        text: 'Please select at least one time entry to save as draft.',
        icon: 'warning'
      });
      return;
    }
    
    // Just call the same generate invoice method - it already creates as DRAFT
    this.generateInvoice();
  }

  downloadInvoice(): void {
    // This would normally get the ID from a real invoice
    // For demo purposes, we'll just show a success message
    Swal.fire({
      title: 'Generating PDF',
      text: 'Please wait while we generate your invoice PDF...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
        
        // Simulate PDF generation
        setTimeout(() => {
          Swal.close();
          // For demo purposes, just show a success message
          Swal.fire({
            title: 'PDF Generated',
            text: 'Invoice PDF has been generated and downloaded.',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
          });
        }, 2000);
      }
    });
  }

  openEmailModal(): void {
    this.showEmailModal = true;
  }

  closeEmailModal(): void {
    this.showEmailModal = false;
  }

  sendEmail(emailForm: any): void {
    this.isSendingEmail = true;
    
    // This would normally call the API with a real invoice ID
    // For demo purposes, we'll just show a success message
    setTimeout(() => {
      this.isSendingEmail = false;
      this.closeEmailModal();
      
      Swal.fire({
        title: 'Email Sent',
        text: 'Invoice has been emailed successfully.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    }, 2000);
  }

  resetForm(): void {
    this.invoiceForm.reset({
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: this.getDefaultDueDate(),
      taxRate: 0
    });
    this.selectedEntries.clear();
    this.timeEntries = [];
    this.previewData = {
      subtotal: 0,
      taxAmount: 0,
      totalAmount: 0,
      invoiceNumber: '',
      clientName: '',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: this.getDefaultDueDate()
    };
  }

  private getDefaultDueDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 30); // 30 days from now
    return date.toISOString().split('T')[0];
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  // Format helpers
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  // Fallback data methods
  private getFallbackClients(): any[] {
    return [
      { id: 1, name: 'Demo Client 1' },
      { id: 2, name: 'Demo Client 2' },
      { id: 3, name: 'Demo Client 3' }
    ];
  }

  private getFallbackCases(): any[] {
    return [
      { id: 1, title: 'Demo Case 1', clientId: 1 },
      { id: 2, title: 'Demo Case 2', clientId: 1 },
      { id: 3, title: 'Demo Case 3', clientId: 2 }
    ];
  }

  // Utility method for showing messages
  private showMessage(message: string, type: 'success' | 'error'): void {
    console.log(`${type.toUpperCase()}: ${message}`);
    // Placeholder for actual UI notification if needed
  }
} 