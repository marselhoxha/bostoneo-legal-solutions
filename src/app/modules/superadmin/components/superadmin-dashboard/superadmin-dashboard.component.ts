import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { SuperAdminService } from '../../services/superadmin.service';
import { PlatformStats, SystemHealth, SecurityOverview } from '../../models/superadmin.models';

@Component({
  selector: 'app-superadmin-dashboard',
  templateUrl: './superadmin-dashboard.component.html',
  styleUrls: ['./superadmin-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SuperadminDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  stats: PlatformStats | null = null;
  systemHealth: SystemHealth | null = null;
  securityOverview: SecurityOverview | null = null;

  isLoading = true;
  error: string | null = null;
  lastRefreshed: Date | null = null;

  constructor(
    private superAdminService: SuperAdminService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDashboardData(): void {
    this.isLoading = true;
    this.error = null;
    this.cdr.markForCheck();

    forkJoin({
      stats: this.superAdminService.getDashboardStats(),
      health: this.superAdminService.getSystemHealth().pipe(
        catchError(err => { console.warn('System health unavailable:', err.status || err.message); return of(null); })
      ),
      security: this.superAdminService.getSecurityOverview().pipe(
        catchError(err => { console.warn('Security overview unavailable:', err.status || err.message); return of(null); })
      )
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ stats, health, security }) => {
          this.stats = stats;
          this.systemHealth = health;
          this.securityOverview = security;
          this.lastRefreshed = new Date();
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = 'Failed to load dashboard statistics';
          this.isLoading = false;
          this.cdr.markForCheck();
          console.error('Dashboard stats error:', err);
        }
      });
  }

  // ==================== NAVIGATION ====================

  navigateToOrganizations(): void { this.router.navigate(['/superadmin/organizations']); }
  navigateToUsers(): void { this.router.navigate(['/superadmin/users']); }
  navigateToSecurity(): void { this.router.navigate(['/superadmin/security']); }
  navigateToHealth(): void { this.router.navigate(['/superadmin/system-health']); }
  navigateToAnalytics(): void { this.router.navigate(['/superadmin/analytics']); }
  navigateToAuditLogs(): void { this.router.navigate(['/superadmin/audit-logs']); }

  // ==================== FORMATTERS ====================

  formatCurrency(value: number | undefined): string {
    if (value === undefined || value === null) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(value);
  }

  formatNumber(value: number | undefined): string {
    if (value === undefined || value === null) return '0';
    return new Intl.NumberFormat('en-US').format(value);
  }

  formatTimeAgo(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  formatBytes(bytes: number | undefined): string {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
  }

  // ==================== STATUS HELPERS ====================

  getHealthStatusClass(status: string): string {
    switch (status) {
      case 'HEALTHY': return 'success';
      case 'DEGRADED': return 'warning';
      case 'DOWN': case 'UNHEALTHY': return 'danger';
      default: return 'secondary';
    }
  }

  getHealthStatusIcon(status: string): string {
    switch (status) {
      case 'HEALTHY': return 'ri-checkbox-circle-fill';
      case 'DEGRADED': return 'ri-alert-fill';
      case 'DOWN': case 'UNHEALTHY': return 'ri-close-circle-fill';
      default: return 'ri-question-fill';
    }
  }

  getAlertClass(type: string): string {
    switch (type) {
      case 'ERROR': return 'danger';
      case 'WARNING': return 'warning';
      case 'INFO': return 'info';
      default: return 'secondary';
    }
  }

  getAlertIcon(type: string): string {
    switch (type) {
      case 'ERROR': return 'ri-error-warning-fill';
      case 'WARNING': return 'ri-alarm-warning-fill';
      case 'INFO': return 'ri-information-fill';
      default: return 'ri-question-fill';
    }
  }

  getActionIcon(action: string): string {
    switch (action?.toUpperCase()) {
      case 'CREATE': return 'ri-add-circle-line';
      case 'UPDATE': return 'ri-edit-line';
      case 'DELETE': return 'ri-delete-bin-line';
      case 'READ': case 'GET': case 'VIEW': return 'ri-eye-line';
      case 'LOGIN': return 'ri-login-circle-line';
      case 'EXPORT': return 'ri-download-line';
      default: return 'ri-flashlight-line';
    }
  }

  getActionColor(action: string): string {
    switch (action?.toUpperCase()) {
      case 'CREATE': return 'success';
      case 'UPDATE': return 'info';
      case 'DELETE': return 'danger';
      case 'READ': case 'GET': case 'VIEW': return 'primary';
      case 'LOGIN': return 'warning';
      default: return 'secondary';
    }
  }

  formatEntityType(entityType: string): string {
    if (!entityType) return '';
    return entityType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  // ==================== COMPUTED VALUES ====================

  getActiveUsersPercent(): number {
    if (!this.stats || !this.stats.totalUsers || this.stats.totalUsers === 0) return 0;
    return Math.round((this.stats.activeUsersLast7Days / this.stats.totalUsers) * 100);
  }

  getStoragePercent(): number {
    if (!this.stats?.totalStorageLimitBytes || this.stats.totalStorageLimitBytes === 0) return 0;
    return Math.round(((this.stats.totalStorageUsedBytes || 0) / this.stats.totalStorageLimitBytes) * 100);
  }

  getMemoryPercent(): number {
    return this.systemHealth?.memory?.usagePercent ?? 0;
  }

  getMemoryStatusClass(): string {
    const pct = this.getMemoryPercent();
    if (pct < 60) return 'success';
    if (pct < 85) return 'warning';
    return 'danger';
  }

  getErrorSeverityClass(): string {
    const count = this.systemHealth?.errorCountLast24Hours ?? 0;
    if (count === 0) return 'success';
    if (count < 10) return 'warning';
    return 'danger';
  }

  getThreatLevel(): string {
    if (!this.securityOverview) return 'Unknown';
    const { failedLoginsLast24h, accountLockouts, suspiciousActivityCount } = this.securityOverview;
    if (suspiciousActivityCount > 0 || accountLockouts > 2) return 'Elevated';
    if (failedLoginsLast24h > 10 || accountLockouts > 0) return 'Moderate';
    if (failedLoginsLast24h > 0) return 'Low';
    return 'Clear';
  }

  getThreatLevelClass(): string {
    switch (this.getThreatLevel()) {
      case 'Elevated': return 'danger';
      case 'Moderate': return 'warning';
      case 'Low': return 'info';
      case 'Clear': return 'success';
      default: return 'secondary';
    }
  }
}
