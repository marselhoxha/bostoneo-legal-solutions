import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SuperAdminService } from '../../services/superadmin.service';
import { PlatformStats, OrganizationWithStats } from '../../models/superadmin.models';

@Component({
  selector: 'app-superadmin-dashboard',
  templateUrl: './superadmin-dashboard.component.html',
  styleUrls: ['./superadmin-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SuperadminDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  stats: PlatformStats | null = null;
  recentOrganizations: OrganizationWithStats[] = [];
  topOrganizations: OrganizationWithStats[] = [];

  isLoading = true;
  error: string | null = null;
  lastRefreshed: Date | null = null;

  // Chart data
  planDistributionData: any = null;
  orgGrowthData: any = null;

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

    // Load stats
    this.superAdminService.getDashboardStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.stats = stats;
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

    // Load recent organizations
    this.superAdminService.getOrganizations(0, 5, 'createdAt', 'desc')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.recentOrganizations = response.content;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Recent organizations error:', err);
        }
      });

    // Load top organizations by user count
    this.superAdminService.getOrganizations(0, 5, 'userCount', 'desc')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.topOrganizations = response.content;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Top organizations error:', err);
        }
      });
  }

  getHealthStatusClass(status: string): string {
    switch (status) {
      case 'HEALTHY': return 'success';
      case 'DEGRADED': return 'warning';
      case 'DOWN': return 'danger';
      default: return 'secondary';
    }
  }

  getHealthStatusIcon(status: string): string {
    switch (status) {
      case 'HEALTHY': return 'ri-checkbox-circle-fill';
      case 'DEGRADED': return 'ri-alert-fill';
      case 'DOWN': return 'ri-close-circle-fill';
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

  getActivityIcon(action: string): string {
    switch (action?.toUpperCase()) {
      case 'CREATE': return 'ri-add-circle-line text-success';
      case 'UPDATE': return 'ri-edit-line text-info';
      case 'DELETE': return 'ri-delete-bin-line text-danger';
      case 'VIEW': return 'ri-eye-line text-primary';
      case 'LOGIN': return 'ri-login-circle-line text-success';
      case 'LOGOUT': return 'ri-logout-circle-line text-secondary';
      default: return 'ri-record-circle-line text-muted';
    }
  }

  getStatusClass(status: string): string {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return 'bg-success-subtle text-success';
      case 'SUSPENDED': return 'bg-danger-subtle text-danger';
      case 'PENDING': return 'bg-warning-subtle text-warning';
      default: return 'bg-secondary-subtle text-secondary';
    }
  }

  getPlanBadgeClass(plan: string): string {
    switch (plan?.toUpperCase()) {
      case 'ENTERPRISE': return 'bg-primary';
      case 'PROFESSIONAL': return 'bg-info';
      case 'STARTER': return 'bg-warning';
      case 'FREE': return 'bg-secondary';
      default: return 'bg-light text-dark';
    }
  }

  navigateToOrganizations(): void {
    this.router.navigate(['/superadmin/organizations']);
  }

  navigateToUsers(): void {
    this.router.navigate(['/superadmin/users']);
  }

  viewOrganization(id: number): void {
    this.router.navigate(['/superadmin/organizations', id]);
  }

  formatCurrency(value: number | undefined): string {
    if (value === undefined || value === null) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  formatNumber(value: number | undefined): string {
    if (value === undefined || value === null) return '0';
    return new Intl.NumberFormat('en-US').format(value);
  }

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
    return this.formatDate(dateString);
  }

  getActiveUsersPercent(): number {
    if (!this.stats || !this.stats.totalUsers || this.stats.totalUsers === 0) return 0;
    return Math.round((this.stats.activeUsersLast7Days / this.stats.totalUsers) * 100);
  }

  getActiveCasesPercent(): number {
    if (!this.stats || !this.stats.totalCases || this.stats.totalCases === 0) return 0;
    return Math.round((this.stats.activeCases / this.stats.totalCases) * 100);
  }

  getQuotaAlerts(): any[] {
    if (!this.stats?.alerts) return [];
    return this.stats.alerts.filter(a => a.type === 'WARNING');
  }

  getSystemAlerts(): any[] {
    if (!this.stats?.alerts) return [];
    return this.stats.alerts.filter(a => a.type === 'ERROR');
  }
}
