import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SuperAdminService } from '../../services/superadmin.service';
import { SecurityOverview, SecurityEvent, FailedLogin } from '../../models/superadmin.models';

@Component({
  selector: 'app-security-dashboard',
  templateUrl: './security-dashboard.component.html',
  styleUrls: ['./security-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SecurityDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  securityOverview: SecurityOverview | null = null;
  failedLogins: FailedLogin[] = [];
  isLoading = true;
  isLoadingLogins = false;
  error: string | null = null;

  // Pagination for failed logins
  loginsPage = 0;
  loginsPageSize = 10;
  loginsTotalElements = 0;
  loginsTotalPages = 0;

  // Active tab
  activeTab: 'overview' | 'logins' = 'overview';

  constructor(
    private superAdminService: SuperAdminService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadSecurityOverview();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadSecurityOverview(): void {
    this.isLoading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.superAdminService.getSecurityOverview()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (overview) => {
          this.securityOverview = overview;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'Failed to load security overview';
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  loadFailedLogins(): void {
    this.isLoadingLogins = true;
    this.cdr.markForCheck();

    this.superAdminService.getFailedLogins(this.loginsPage, this.loginsPageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.failedLogins = response.content;
          this.loginsTotalElements = response.page.totalElements;
          this.loginsTotalPages = response.page.totalPages;
          this.isLoadingLogins = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingLogins = false;
          this.cdr.markForCheck();
        }
      });
  }

  setActiveTab(tab: 'overview' | 'logins'): void {
    this.activeTab = tab;
    if (tab === 'logins' && this.failedLogins.length === 0) {
      this.loadFailedLogins();
    }
    this.cdr.markForCheck();
  }

  goToLoginsPage(page: number): void {
    if (page >= 0 && page < this.loginsTotalPages) {
      this.loginsPage = page;
      this.loadFailedLogins();
    }
  }

  getEventTypeIcon(type: string): string {
    switch (type) {
      case 'LOGIN_ATTEMPT_FAILURE': return 'ri-lock-line text-danger';
      case 'PASSWORD_UPDATE': return 'ri-key-2-line text-info';
      case 'MFA_UPDATE': return 'ri-shield-keyhole-line text-success';
      default: return 'ri-information-line text-secondary';
    }
  }

  formatEventType(type: string): string {
    if (!type) return '';
    return type.replace(/_/g, ' ');
  }

  getEventTypeBadge(type: string): string {
    switch (type) {
      case 'LOGIN_ATTEMPT_FAILURE': return 'bg-danger-subtle text-danger';
      case 'PASSWORD_UPDATE': return 'bg-info-subtle text-info';
      case 'MFA_UPDATE': return 'bg-success-subtle text-success';
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

  formatRelativeTime(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  get loginsPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(0, this.loginsPage - Math.floor(maxVisible / 2));
    const end = Math.min(this.loginsTotalPages, start + maxVisible);
    if (end - start < maxVisible) start = Math.max(0, end - maxVisible);
    for (let i = start; i < end; i++) pages.push(i);
    return pages;
  }
}
