import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ClientPortalService, ClientCase, PagedResponse } from '../../services/client-portal.service';

@Component({
  selector: 'app-client-cases',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './client-cases.component.html',
  styleUrls: ['./client-cases.component.scss']
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

  private destroy$ = new Subject<void>();

  constructor(private clientPortalService: ClientPortalService) {}

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

    this.clientPortalService.getCases(this.currentPage, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: PagedResponse<ClientCase>) => {
          this.cases = response.content || [];
          this.totalPages = response.totalPages;
          this.totalElements = response.totalElements;
          this.extractFilterOptions();
          this.applyFilters();
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading cases:', err);
          this.error = 'Failed to load your cases. Please try again.';
          this.loading = false;
        }
      });
  }

  extractFilterOptions(): void {
    this.caseStatuses = [...new Set(this.cases.map(c => c.status).filter(s => s))];
    this.caseTypes = [...new Set(this.cases.map(c => c.type).filter(t => t))];
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
      'CRIMINAL': 'ri-criminal-line',
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
