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
  filtersCollapsed = false;

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

  actionTypes = ['CREATE', 'UPDATE', 'DELETE', 'VIEW', 'SEARCH', 'LOGIN', 'LOGOUT', 'UPLOAD', 'DOWNLOAD', 'APPROVE', 'REJECT', 'SUBMIT', 'ASSIGN', 'UNASSIGN', 'ARCHIVE', 'RESTORE'];
  entityTypes = [
    'USER', 'ORGANIZATION', 'LEGAL_CASE', 'CLIENT', 'CUSTOMER',
    'DOCUMENT', 'INVOICE', 'PAYMENT', 'EXPENSE',
    'APPOINTMENT', 'TASK', 'NOTE', 'ANNOUNCEMENT'
  ];

  // Summary stats
  writeActions = 0;
  uniqueUsers = 0;
  todayCount = 0;

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
          this.computeStats();
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

  private computeStats(): void {
    const writeSet = new Set(['CREATE', 'UPDATE', 'DELETE', 'UPLOAD', 'APPROVE', 'REJECT', 'SUBMIT', 'ASSIGN', 'UNASSIGN', 'ARCHIVE', 'RESTORE']);
    this.writeActions = this.logs.filter(l => writeSet.has(l.action)).length;
    const users = new Set(this.logs.filter(l => l.userId).map(l => l.userId));
    this.uniqueUsers = users.size;
    const today = new Date().toDateString();
    this.todayCount = this.logs.filter(l => l.createdAt && new Date(l.createdAt).toDateString() === today).length;
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

  getActionClass(action: string): string {
    switch (action?.toUpperCase()) {
      case 'CREATE': return 'success';
      case 'UPDATE': return 'info';
      case 'DELETE': return 'danger';
      case 'VIEW': return 'primary';
      case 'SEARCH': return 'primary';
      case 'LOGIN': return 'success';
      case 'LOGOUT': return 'secondary';
      case 'UPLOAD': return 'primary';
      case 'DOWNLOAD': return 'primary';
      case 'APPROVE': return 'success';
      case 'REJECT': return 'warning';
      case 'SUBMIT': return 'info';
      case 'ASSIGN': return 'primary';
      case 'UNASSIGN': return 'warning';
      case 'ARCHIVE': return 'secondary';
      case 'RESTORE': return 'info';
      default: return 'secondary';
    }
  }

  getActionIcon(action: string): string {
    switch (action?.toUpperCase()) {
      case 'CREATE': return 'ri-add-circle-line';
      case 'UPDATE': return 'ri-edit-line';
      case 'DELETE': return 'ri-delete-bin-line';
      case 'VIEW': return 'ri-eye-line';
      case 'SEARCH': return 'ri-search-line';
      case 'LOGIN': return 'ri-login-circle-line';
      case 'LOGOUT': return 'ri-logout-circle-line';
      case 'UPLOAD': return 'ri-upload-2-line';
      case 'DOWNLOAD': return 'ri-download-2-line';
      case 'APPROVE': return 'ri-check-double-line';
      case 'REJECT': return 'ri-close-circle-line';
      case 'SUBMIT': return 'ri-send-plane-line';
      case 'ASSIGN': return 'ri-user-add-line';
      case 'UNASSIGN': return 'ri-user-unfollow-line';
      case 'ARCHIVE': return 'ri-archive-line';
      case 'RESTORE': return 'ri-inbox-unarchive-line';
      default: return 'ri-file-list-3-line';
    }
  }

  getEntityTypeLabel(entityType: string): string {
    if (!entityType) return '-';
    return entityType.replace(/_/g, ' ');
  }

  getEntityIcon(entityType: string): string {
    switch (entityType?.toUpperCase()) {
      case 'USER': return 'ri-user-line';
      case 'ORGANIZATION': return 'ri-building-2-line';
      case 'LEGAL_CASE': case 'CASE': return 'ri-scales-3-line';
      case 'CLIENT': case 'CUSTOMER': return 'ri-contacts-line';
      case 'DOCUMENT': return 'ri-file-text-line';
      case 'INVOICE': return 'ri-bill-line';
      case 'PAYMENT': case 'EXPENSE': return 'ri-money-dollar-circle-line';
      case 'APPOINTMENT': case 'CALENDAR_EVENT': return 'ri-calendar-line';
      case 'TASK': return 'ri-task-line';
      case 'NOTE': return 'ri-sticky-note-line';
      case 'ANNOUNCEMENT': return 'ri-megaphone-line';
      default: return 'ri-file-list-3-line';
    }
  }

  getEntityTypeClass(entityType: string): string {
    switch (entityType?.toUpperCase()) {
      case 'USER':
      case 'ROLE':
      case 'PERMISSION':
        return 'primary';
      case 'ORGANIZATION':
      case 'PLATFORM':
        return 'purple';
      case 'LEGAL_CASE':
      case 'CASE':
        return 'warning';
      case 'CLIENT':
      case 'CUSTOMER':
        return 'info';
      case 'DOCUMENT':
      case 'NOTE':
        return 'secondary';
      case 'INVOICE':
      case 'PAYMENT':
      case 'EXPENSE':
        return 'success';
      case 'SECURITY':
      case 'AUDIT_LOG':
        return 'danger';
      case 'EMAIL':
      case 'INVITATION':
        return 'teal';
      case 'CALENDAR_EVENT':
      case 'APPOINTMENT':
      case 'TASK':
        return 'indigo';
      case 'ANNOUNCEMENT':
      case 'INTEGRATION':
        return 'pink';
      default:
        return 'secondary';
    }
  }

  getOrgClass(orgName: string): string {
    if (!orgName) return 'secondary';
    const colors = ['primary', 'success', 'info', 'warning', 'purple', 'teal', 'indigo', 'pink'];
    let hash = 0;
    for (let i = 0; i < orgName.length; i++) {
      hash = orgName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  getUserInitials(log: AuditLogEntry): string {
    if (log.userName) {
      const parts = log.userName.split(' ').filter(p => p);
      return parts.map(p => p.charAt(0)).slice(0, 2).join('').toUpperCase();
    }
    if (log.userEmail) {
      return log.userEmail.charAt(0).toUpperCase();
    }
    return 'S';
  }

  formatTimeAgo(dateStr: string): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  formatFullDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  hasActiveFilters(): boolean {
    return !!(this.filters.organizationId || this.filters.userId || this.filters.action
      || this.filters.entityType || this.filters.startDate || this.filters.endDate);
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
