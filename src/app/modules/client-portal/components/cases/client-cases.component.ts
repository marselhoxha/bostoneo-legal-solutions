import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { ClientPortalService, ClientCase, PagedResponse } from '../../services/client-portal.service';

@Component({
  selector: 'app-client-cases',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './client-cases.component.html',
  styleUrls: ['./client-cases.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientCasesComponent implements OnInit, OnDestroy {
  cases: ClientCase[] = [];
  filteredCases: ClientCase[] = [];
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
  typeFilter = '';

  // Unique values for filters
  caseStatuses: string[] = [];
  caseTypes: string[] = [];

  // Stats
  activeCases = 0;
  pendingCases = 0;
  closedCases = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private clientPortalService: ClientPortalService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCases();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCases(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.clientPortalService.getCases(this.currentPage, this.pageSize)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (response: PagedResponse<ClientCase>) => {
          this.cases = response.content || [];
          this.totalPages = response.totalPages;
          this.totalElements = response.totalElements;
          this.extractFilterOptions();
          this.calculateStats();
          this.applyFilters();
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error loading cases:', err);
          this.error = 'Failed to load your cases. Please try again.';
          this.cdr.markForCheck();
        }
      });
  }

  extractFilterOptions(): void {
    this.caseStatuses = [...new Set(this.cases.map(c => c.status).filter(s => s))];
    this.caseTypes = [...new Set(this.cases.map(c => c.type).filter(t => t))];
  }

  calculateStats(): void {
    this.activeCases = this.cases.filter(c =>
      ['OPEN', 'ACTIVE', 'IN_PROGRESS', 'DISCOVERY'].includes(c.status || '')
    ).length;
    this.pendingCases = this.cases.filter(c =>
      ['PENDING', 'REVIEW'].includes(c.status || '')
    ).length;
    this.closedCases = this.cases.filter(c =>
      ['CLOSED', 'SETTLED', 'WON', 'LOST'].includes(c.status || '')
    ).length;
  }

  applyFilters(): void {
    this.filteredCases = this.cases.filter(caseItem => {
      const matchesSearch = !this.searchTerm ||
        caseItem.title?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        caseItem.caseNumber?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        caseItem.description?.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesStatus = !this.statusFilter || caseItem.status === this.statusFilter;
      const matchesType = !this.typeFilter || caseItem.type === this.typeFilter;

      return matchesSearch && matchesStatus && matchesType;
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
    this.typeFilter = '';
    this.applyFilters();
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadCases();
    }
  }

  getStatusBadgeClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'OPEN': 'bg-primary-subtle text-primary',
      'ACTIVE': 'bg-primary-subtle text-primary',
      'IN_PROGRESS': 'bg-info-subtle text-info',
      'DISCOVERY': 'bg-info-subtle text-info',
      'PENDING': 'bg-warning-subtle text-warning',
      'REVIEW': 'bg-warning-subtle text-warning',
      'CLOSED': 'bg-secondary-subtle text-secondary',
      'SETTLED': 'bg-success-subtle text-success',
      'WON': 'bg-success-subtle text-success',
      'LOST': 'bg-danger-subtle text-danger'
    };
    return statusMap[status] || 'bg-secondary-subtle text-secondary';
  }

  getStatusDotClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'OPEN': 'bg-primary',
      'ACTIVE': 'bg-primary',
      'IN_PROGRESS': 'bg-info',
      'DISCOVERY': 'bg-info',
      'PENDING': 'bg-warning',
      'REVIEW': 'bg-warning',
      'CLOSED': 'bg-secondary',
      'SETTLED': 'bg-success',
      'WON': 'bg-success',
      'LOST': 'bg-danger'
    };
    return statusMap[status] || 'bg-secondary';
  }

  getTypeIcon(type: string): string {
    const iconMap: { [key: string]: string } = {
      'CIVIL': 'ri-scales-3-line',
      'CRIMINAL': 'ri-shield-line',
      'FAMILY': 'ri-parent-line',
      'IMMIGRATION': 'ri-passport-line',
      'CORPORATE': 'ri-building-line',
      'REAL_ESTATE': 'ri-home-3-line',
      'PERSONAL_INJURY': 'ri-first-aid-kit-line',
      'BANKRUPTCY': 'ri-money-dollar-box-line',
      'INTELLECTUAL_PROPERTY': 'ri-lightbulb-line',
      'EMPLOYMENT': 'ri-user-settings-line'
    };
    return iconMap[type] || 'ri-briefcase-4-line';
  }

  getTypeColor(type: string): string {
    const colorMap: { [key: string]: string } = {
      'CIVIL': 'primary',
      'CRIMINAL': 'danger',
      'FAMILY': 'info',
      'IMMIGRATION': 'warning',
      'CORPORATE': 'success',
      'REAL_ESTATE': 'info',
      'PERSONAL_INJURY': 'danger',
      'BANKRUPTCY': 'warning',
      'INTELLECTUAL_PROPERTY': 'primary',
      'EMPLOYMENT': 'secondary'
    };
    return colorMap[type] || 'primary';
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

  formatStatus(status: string): string {
    if (!status) return '-';
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  getDaysOpen(openDate: string): number {
    if (!openDate) return 0;

    const opened = new Date(openDate);
    if (isNaN(opened.getTime())) return 0;

    // Normalize to start of day to avoid timezone issues
    const openedDate = new Date(opened.getFullYear(), opened.getMonth(), opened.getDate());
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const diffTime = todayDate.getTime() - openedDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays : 0;
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
