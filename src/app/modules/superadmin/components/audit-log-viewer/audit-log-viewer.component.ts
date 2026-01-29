import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SuperAdminService } from '../../services/superadmin.service';
import { AuditLogEntry, OrganizationWithStats } from '../../models/superadmin.models';

@Component({
  selector: 'app-audit-log-viewer',
  templateUrl: './audit-log-viewer.component.html',
  styleUrls: ['./audit-log-viewer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuditLogViewerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  logs: AuditLogEntry[] = [];
  organizations: OrganizationWithStats[] = [];
  isLoading = true;
  error: string | null = null;

  // Pagination
  currentPage = 0;
  pageSize = 20;
  totalElements = 0;
  totalPages = 0;

  // Filters
  filters = {
    organizationId: null as number | null,
    userId: null as number | null,
    action: '',
    entityType: '',
    startDate: '',
    endDate: ''
  };

  actionTypes = ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'SEARCH', 'LOGIN', 'LOGOUT'];
  entityTypes = ['USER', 'ORGANIZATION', 'CASE', 'CLIENT', 'DOCUMENT', 'INVOICE', 'SYSTEM'];

  constructor(
    private superAdminService: SuperAdminService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadOrganizations();
    this.loadLogs();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOrganizations(): void {
    this.superAdminService.getOrganizations(0, 100)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.organizations = response.content;
          this.cdr.markForCheck();
        }
      });
  }

  loadLogs(): void {
    this.isLoading = true;
    this.error = null;
    this.cdr.markForCheck();

    const cleanFilters: any = {};
    if (this.filters.organizationId) cleanFilters.organizationId = this.filters.organizationId;
    if (this.filters.userId) cleanFilters.userId = this.filters.userId;
    if (this.filters.action) cleanFilters.action = this.filters.action;
    if (this.filters.entityType) cleanFilters.entityType = this.filters.entityType;
    if (this.filters.startDate) cleanFilters.startDate = this.filters.startDate;
    if (this.filters.endDate) cleanFilters.endDate = this.filters.endDate;

    this.superAdminService.getAuditLogs(cleanFilters, this.currentPage, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.logs = response.content;
          this.totalElements = response.page.totalElements;
          this.totalPages = response.page.totalPages;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = 'Failed to load audit logs';
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  applyFilters(): void {
    this.currentPage = 0;
    this.loadLogs();
  }

  clearFilters(): void {
    this.filters = {
      organizationId: null,
      userId: null,
      action: '',
      entityType: '',
      startDate: '',
      endDate: ''
    };
    this.currentPage = 0;
    this.loadLogs();
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadLogs();
    }
  }

  getActionBadgeClass(action: string): string {
    switch (action?.toUpperCase()) {
      case 'CREATE': return 'bg-success-subtle text-success';
      case 'UPDATE': return 'bg-info-subtle text-info';
      case 'DELETE': return 'bg-danger-subtle text-danger';
      case 'VIEW': return 'bg-primary-subtle text-primary';
      case 'LOGIN': return 'bg-success-subtle text-success';
      case 'LOGOUT': return 'bg-secondary-subtle text-secondary';
      default: return 'bg-secondary-subtle text-secondary';
    }
  }

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(0, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible);
    if (end - start < maxVisible) start = Math.max(0, end - maxVisible);
    for (let i = start; i < end; i++) pages.push(i);
    return pages;
  }
}
