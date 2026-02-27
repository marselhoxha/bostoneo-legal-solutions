import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SuperAdminService } from '../../services/superadmin.service';
import {
  SecurityOverview,
  FailedLogin,
  LoginEvent,
  ActiveSession,
  OrgSecurity
} from '../../models/superadmin.models';

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
  loginEvents: LoginEvent[] = [];
  activeSessions: ActiveSession[] = [];
  securityByOrg: OrgSecurity[] = [];

  isLoading = true;
  isLoadingLogins = false;
  isLoadingEvents = false;
  isLoadingSessions = false;
  isRefreshing = false;
  error: string | null = null;

  // Track whether tab data has been loaded
  private loginsLoaded = false;
  private eventsLoaded = false;
  private sessionsLoaded = false;

  // Pagination for failed logins
  loginsPage = 0;
  loginsPageSize = 10;
  loginsTotalElements = 0;
  loginsTotalPages = 0;

  // Pagination for login events
  eventsPage = 0;
  eventsPageSize = 10;
  eventsTotalElements = 0;
  eventsTotalPages = 0;

  // Session time window
  sessionWindow: '1h' | '24h' | '7d' = '1h';

  // Active tab
  activeTab: 'overview' | 'logins' | 'events' | 'sessions' = 'overview';

  constructor(
    private superAdminService: SuperAdminService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadSecurityOverview();
    this.loadSecurityByOrg();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Data Loading ──────────────────────────────

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
          this.loginsLoaded = true;
          this.isLoadingLogins = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingLogins = false;
          this.cdr.markForCheck();
        }
      });
  }

  loadLoginEvents(): void {
    this.isLoadingEvents = true;
    this.cdr.markForCheck();

    this.superAdminService.getLoginEvents(this.eventsPage, this.eventsPageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.loginEvents = response.content;
          this.eventsTotalElements = response.page.totalElements;
          this.eventsTotalPages = response.page.totalPages;
          this.eventsLoaded = true;
          this.isLoadingEvents = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingEvents = false;
          this.cdr.markForCheck();
        }
      });
  }

  loadActiveSessions(): void {
    this.isLoadingSessions = true;
    this.cdr.markForCheck();

    this.superAdminService.getActiveSessions(this.sessionWindow)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sessions) => {
          this.activeSessions = sessions || [];
          this.sessionsLoaded = true;
          this.isLoadingSessions = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.activeSessions = [];
          this.isLoadingSessions = false;
          this.cdr.markForCheck();
        }
      });
  }

  loadSecurityByOrg(): void {
    this.superAdminService.getSecurityByOrg()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.securityByOrg = data || [];
          this.cdr.markForCheck();
        },
        error: () => {
          this.securityByOrg = [];
          this.cdr.markForCheck();
        }
      });
  }

  refreshData(): void {
    this.isRefreshing = true;
    this.cdr.markForCheck();

    this.superAdminService.getSecurityOverview()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (overview) => {
          this.securityOverview = overview;
          this.isRefreshing = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isRefreshing = false;
          this.cdr.markForCheck();
        }
      });

    this.loadSecurityByOrg();

    // Reload current tab data
    if (this.activeTab === 'logins') {
      this.loadFailedLogins();
    } else if (this.activeTab === 'events') {
      this.loadLoginEvents();
    } else if (this.activeTab === 'sessions') {
      this.loadActiveSessions();
    }
  }

  // ── Tab Management ────────────────────────────

  setActiveTab(tab: 'overview' | 'logins' | 'events' | 'sessions'): void {
    this.activeTab = tab;
    if (tab === 'logins' && !this.loginsLoaded) {
      this.loadFailedLogins();
    } else if (tab === 'events' && !this.eventsLoaded) {
      this.loadLoginEvents();
    } else if (tab === 'sessions' && !this.sessionsLoaded) {
      this.loadActiveSessions();
    }
    this.cdr.markForCheck();
  }

  // ── Pagination ────────────────────────────────

  goToLoginsPage(page: number): void {
    if (page >= 0 && page < this.loginsTotalPages) {
      this.loginsPage = page;
      this.loadFailedLogins();
    }
  }

  goToEventsPage(page: number): void {
    if (page >= 0 && page < this.eventsTotalPages) {
      this.eventsPage = page;
      this.loadLoginEvents();
    }
  }

  // ── Session Window ────────────────────────────

  setSessionWindow(window: '1h' | '24h' | '7d'): void {
    this.sessionWindow = window;
    this.loadActiveSessions();
  }

  // ── Threat Level ──────────────────────────────

  getThreatLevel(): string {
    if (!this.securityOverview) return 'Unknown';
    const { failedLoginsLast24h, accountLockouts, suspiciousActivityCount } = this.securityOverview;
    if (suspiciousActivityCount > 5 || accountLockouts > 3) return 'Critical';
    if (suspiciousActivityCount > 0 || accountLockouts > 0 || failedLoginsLast24h > 20) return 'High';
    if (failedLoginsLast24h > 5) return 'Moderate';
    return 'Low';
  }

  getThreatLevelClass(): string {
    const level = this.getThreatLevel();
    switch (level) {
      case 'Critical': return 'danger';
      case 'High': return 'warning';
      case 'Moderate': return 'info';
      case 'Low': return 'success';
      default: return 'secondary';
    }
  }

  // ── Event Helpers ─────────────────────────────

  getEventTypeIcon(type: string): string {
    switch (type) {
      case 'LOGIN_ATTEMPT_FAILURE':
      case 'FAILED_LOGIN': return 'ri-lock-line';
      case 'LOGIN_ATTEMPT_SUCCESS': return 'ri-login-circle-line';
      case 'ACCOUNT_LOCKOUT': return 'ri-user-forbid-line';
      case 'PASSWORD_UPDATE':
      case 'PASSWORD_RESET': return 'ri-key-2-line';
      case 'MFA_UPDATE': return 'ri-shield-keyhole-line';
      case 'SUSPICIOUS_ACTIVITY': return 'ri-spy-line';
      default: return 'ri-information-line';
    }
  }

  getEventTypeColorClass(type: string): string {
    switch (type) {
      case 'LOGIN_ATTEMPT_FAILURE':
      case 'FAILED_LOGIN': return 'danger';
      case 'LOGIN_ATTEMPT_SUCCESS': return 'success';
      case 'ACCOUNT_LOCKOUT': return 'danger';
      case 'SUSPICIOUS_ACTIVITY': return 'warning';
      case 'PASSWORD_UPDATE':
      case 'PASSWORD_RESET': return 'info';
      case 'MFA_UPDATE': return 'success';
      default: return 'secondary';
    }
  }

  getEventTypeBadge(type: string): string {
    const color = this.getEventTypeColorClass(type);
    return `bg-${color}-subtle text-${color}`;
  }

  formatEventType(type: string): string {
    if (!type) return '';
    return type.replace(/_/g, ' ');
  }

  // ── Date Helpers ──────────────────────────────

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

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  // ── Pagination Helpers ────────────────────────

  get loginsPageNumbers(): number[] {
    return this.getPageNumbers(this.loginsPage, this.loginsTotalPages);
  }

  get eventsPageNumbers(): number[] {
    return this.getPageNumbers(this.eventsPage, this.eventsTotalPages);
  }

  private getPageNumbers(currentPage: number, totalPages: number): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(0, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible);
    if (end - start < maxVisible) start = Math.max(0, end - maxVisible);
    for (let i = start; i < end; i++) pages.push(i);
    return pages;
  }
}
