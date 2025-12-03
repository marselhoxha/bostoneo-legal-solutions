import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ClientPortalService, ClientInvoice, PagedResponse } from '../../services/client-portal.service';

@Component({
  selector: 'app-client-invoices',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './client-invoices.component.html',
  styleUrls: ['./client-invoices.component.scss']
})
export class ClientInvoicesComponent implements OnInit, OnDestroy {
  invoices: ClientInvoice[] = [];
  filteredInvoices: ClientInvoice[] = [];
  loading = true;
  error: string | null = null;

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

  invoiceStatuses = ['PENDING', 'PAID', 'OVERDUE', 'PARTIALLY_PAID', 'CANCELLED'];

  private destroy$ = new Subject<void>();

  constructor(private clientPortalService: ClientPortalService) {}

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

    this.clientPortalService.getInvoices(this.currentPage, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: PagedResponse<ClientInvoice>) => {
          this.invoices = response.content || [];
          this.totalPages = response.totalPages;
          this.totalElements = response.totalElements;
          this.calculateStats();
          this.applyFilters();
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading invoices:', err);
          this.error = 'Failed to load invoices. Please try again.';
          this.loading = false;
        }
      });
  }

  calculateStats(): void {
    this.totalOutstanding = this.invoices
      .filter(inv => inv.status !== 'PAID' && inv.status !== 'CANCELLED')
      .reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);

    this.totalPaid = this.invoices
      .reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
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

  // Formatting methods
  getStatusBadgeClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'PENDING': 'bg-warning',
      'PAID': 'bg-success',
      'OVERDUE': 'bg-danger',
      'PARTIALLY_PAID': 'bg-info',
      'CANCELLED': 'bg-secondary'
    };
    return statusMap[status] || 'bg-secondary';
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
    const dueDate = new Date(invoice.dueDate);
    return dueDate < new Date();
  }

  getDaysUntilDue(dateString: string): number {
    const dueDate = new Date(dateString);
    const today = new Date();
    const diff = dueDate.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
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
