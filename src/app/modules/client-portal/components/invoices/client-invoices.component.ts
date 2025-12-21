import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { ClientPortalService, ClientInvoice, PagedResponse } from '../../services/client-portal.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-client-invoices',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './client-invoices.component.html',
  styleUrls: ['./client-invoices.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientInvoicesComponent implements OnInit, OnDestroy {
  Math = Math; // Expose Math for template
  invoices: ClientInvoice[] = [];
  filteredInvoices: ClientInvoice[] = [];
  loading = true;
  error: string | null = null;

  // Selected invoice for detail view
  selectedInvoice: ClientInvoice | null = null;
  showInvoiceDetail = false;

  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalPages = 0;
  totalElements = 0;

  // Filters
  searchTerm = '';
  statusFilter = '';

  // Stats
  totalOutstanding = 0;
  totalPaid = 0;
  pendingCount = 0;
  overdueCount = 0;

  invoiceStatuses = ['DRAFT', 'SENT', 'PENDING', 'PAID', 'OVERDUE', 'PARTIALLY_PAID', 'CANCELLED'];

  private destroy$ = new Subject<void>();

  constructor(
    private clientPortalService: ClientPortalService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadInvoices();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadInvoices(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.clientPortalService.getInvoices(this.currentPage, this.pageSize)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (response: PagedResponse<ClientInvoice>) => {
          this.invoices = response.content || [];
          this.totalPages = response.totalPages;
          this.totalElements = response.totalElements;
          this.calculateStats();
          this.applyFilters();
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error loading invoices:', err);
          this.error = 'Failed to load invoices. Please try again.';
          this.cdr.markForCheck();
        }
      });
  }

  calculateStats(): void {
    this.totalOutstanding = this.invoices
      .filter(inv => inv.status !== 'PAID' && inv.status !== 'CANCELLED')
      .reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);

    this.totalPaid = this.invoices
      .reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);

    this.pendingCount = this.invoices.filter(inv =>
      inv.status === 'PENDING' || inv.status === 'SENT' || inv.status === 'DRAFT'
    ).length;

    this.overdueCount = this.invoices.filter(inv => this.isOverdue(inv)).length;
  }

  applyFilters(): void {
    this.filteredInvoices = this.invoices.filter(invoice => {
      const matchesSearch = !this.searchTerm ||
        invoice.invoiceNumber?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        invoice.caseName?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        invoice.caseNumber?.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesStatus = !this.statusFilter || invoice.status === this.statusFilter;

      return matchesSearch && matchesStatus;
    });
    this.cdr.markForCheck();
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.statusFilter = '';
    this.applyFilters();
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadInvoices();
    }
  }

  // Invoice Actions
  viewInvoice(invoice: ClientInvoice): void {
    this.selectedInvoice = invoice;
    this.showInvoiceDetail = true;
    this.cdr.markForCheck();
  }

  closeInvoiceDetail(): void {
    this.selectedInvoice = null;
    this.showInvoiceDetail = false;
    this.cdr.markForCheck();
  }

  payInvoice(invoice: ClientInvoice): void {
    if (invoice.paymentUrl) {
      window.open(invoice.paymentUrl, '_blank');
    } else {
      Swal.fire({
        title: 'Payment',
        text: `Online payment for invoice ${invoice.invoiceNumber} will be available soon. Please contact your attorney for payment options.`,
        icon: 'info',
        confirmButtonText: 'OK',
        confirmButtonColor: '#405189'
      });
    }
  }

  downloadInvoice(invoice: ClientInvoice): void {
    Swal.fire({
      title: 'Downloading...',
      text: `Preparing PDF for invoice ${invoice.invoiceNumber}`,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
        // Simulate download - in real implementation, call backend API
        setTimeout(() => {
          Swal.fire({
            title: 'Download Ready',
            text: 'Your invoice PDF has been downloaded.',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
          });
        }, 1500);
      }
    });
  }

  // Formatting methods
  getStatusBadgeClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'DRAFT': 'badge-soft-secondary',
      'SENT': 'badge-soft-info',
      'PENDING': 'badge-soft-warning',
      'PAID': 'badge-soft-success',
      'OVERDUE': 'badge-soft-danger',
      'PARTIALLY_PAID': 'badge-soft-primary',
      'CANCELLED': 'badge-soft-dark'
    };
    return statusMap[status] || 'badge-soft-secondary';
  }

  getStatusIcon(status: string): string {
    const iconMap: { [key: string]: string } = {
      'DRAFT': 'ri-draft-line',
      'SENT': 'ri-send-plane-line',
      'PENDING': 'ri-time-line',
      'PAID': 'ri-checkbox-circle-line',
      'OVERDUE': 'ri-error-warning-line',
      'PARTIALLY_PAID': 'ri-pie-chart-line',
      'CANCELLED': 'ri-close-circle-line'
    };
    return iconMap[status] || 'ri-file-list-line';
  }

  formatStatus(status: string): string {
    if (!status) return '-';
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  }

  isOverdue(invoice: ClientInvoice): boolean {
    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') return false;
    if (!invoice.dueDate) return false;
    const dueDate = new Date(invoice.dueDate);
    return dueDate < new Date();
  }

  getDaysUntilDue(dateString: string): number {
    if (!dateString) return 0;
    const dueDate = new Date(dateString);
    const today = new Date();
    const diff = dueDate.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  getDueDateClass(invoice: ClientInvoice): string {
    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') return 'text-muted';
    const days = this.getDaysUntilDue(invoice.dueDate);
    if (days < 0) return 'text-danger fw-medium';
    if (days <= 7) return 'text-warning';
    return 'text-muted';
  }

  get pages(): number[] {
    const pages: number[] = [];
    const start = Math.max(0, this.currentPage - 2);
    const end = Math.min(this.totalPages, start + 5);
    for (let i = start; i < end; i++) {
      pages.push(i);
    }
    return pages;
  }
}
