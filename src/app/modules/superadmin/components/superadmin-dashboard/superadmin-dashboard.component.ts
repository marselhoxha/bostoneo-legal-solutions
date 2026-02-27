import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { SuperAdminService } from '../../services/superadmin.service';
import { PlatformStats, PlatformAnalytics, SystemHealth, SecurityOverview, RecentActivity } from '../../models/superadmin.models';

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
  analytics: PlatformAnalytics | null = null;

  // Chart configs
  topOrgsChart: any = {};
  revenueChart: any = {};
  growthChart: any = {};
  chartsReady = false;

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
      ),
      analytics: this.superAdminService.getAnalytics('month').pipe(
        catchError(err => { console.warn('Analytics unavailable:', err.status || err.message); return of(null); })
      )
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ stats, health, security, analytics }) => {
          this.stats = stats;
          this.systemHealth = health;
          this.securityOverview = security;
          this.analytics = analytics;
          this.buildCharts();
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
  navigateToHealthTab(tab: string): void { this.router.navigate(['/superadmin/system-health'], { queryParams: { tab } }); }
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

  // ==================== RECENT ACTIVITY HELPERS ====================

  getUserInitials(item: RecentActivity): string {
    if (item.userName) {
      const parts = item.userName.split(' ').filter(p => p);
      return parts.map(p => p.charAt(0)).slice(0, 2).join('').toUpperCase();
    }
    if (item.userEmail) {
      return item.userEmail.charAt(0).toUpperCase();
    }
    return 'S';
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
      case 'USER': case 'ROLE': case 'PERMISSION': return 'primary';
      case 'ORGANIZATION': case 'PLATFORM': return 'purple';
      case 'LEGAL_CASE': case 'CASE': return 'warning';
      case 'CLIENT': case 'CUSTOMER': return 'info';
      case 'DOCUMENT': case 'NOTE': return 'secondary';
      case 'INVOICE': case 'PAYMENT': case 'EXPENSE': return 'success';
      case 'SECURITY': case 'AUDIT_LOG': return 'danger';
      case 'EMAIL': case 'INVITATION': return 'teal';
      case 'CALENDAR_EVENT': case 'APPOINTMENT': case 'TASK': return 'indigo';
      case 'ANNOUNCEMENT': case 'INTEGRATION': return 'pink';
      default: return 'secondary';
    }
  }

  getPlanBadgeClass(planType: string): string {
    switch (planType?.toUpperCase()) {
      case 'ENTERPRISE': return 'primary';
      case 'PROFESSIONAL': return 'success';
      case 'STARTER': return 'info';
      case 'TRIAL': return 'warning';
      default: return 'secondary';
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return 'success';
      case 'SUSPENDED': return 'danger';
      case 'TRIAL': return 'warning';
      default: return 'secondary';
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

  formatFullDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // ==================== CHART BUILDERS ====================

  private buildCharts(): void {
    if (!this.analytics) return;
    this.chartsReady = false;
    this.buildTopOrgsChart();
    this.buildRevenueChart();
    this.buildGrowthChart();
    this.chartsReady = true;
  }

  private buildTopOrgsChart(): void {
    const data = this.analytics?.topOrgsByUsers || [];
    this.topOrgsChart = {
      series: [{ name: 'Users', data: data.map(d => d.value) }],
      chart: { type: 'bar', height: 280, toolbar: { show: false } },
      colors: ['#405189'],
      plotOptions: { bar: { horizontal: true, barHeight: '45%', borderRadius: 4 } },
      dataLabels: { enabled: true, style: { fontSize: '11px' } },
      xaxis: { categories: data.map(d => d.organizationName) },
      yaxis: { labels: { style: { fontSize: '12px' } } },
      grid: { borderColor: 'var(--vz-border-color)', strokeDashArray: 3 },
      tooltip: { y: { formatter: (val: number) => val + ' users' } }
    };
  }

  private buildRevenueChart(): void {
    const data = this.analytics?.topOrgsByRevenue || [];
    if (!data.length) { this.revenueChart = {}; return; }
    this.revenueChart = {
      series: data.map(d => d.value),
      chart: { type: 'donut', height: 280 },
      labels: data.map(d => d.organizationName),
      colors: ['#405189', '#0ab39c', '#f06548', '#299cdb', '#f7b84b'],
      legend: { position: 'bottom', fontSize: '12px' },
      dataLabels: { enabled: true, formatter: (val: number) => val.toFixed(1) + '%' },
      plotOptions: { pie: { donut: { size: '65%', labels: { show: true, total: { show: true, label: 'Total Revenue', formatter: (w: any) => '$' + w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0).toLocaleString() } } } } },
      tooltip: { y: { formatter: (val: number) => '$' + val.toLocaleString() } }
    };
  }

  private buildGrowthChart(): void {
    const orgGrowth = this.analytics?.organizationGrowth || [];
    const userGrowth = this.analytics?.userGrowth || [];

    // Build a sorted union of all dates to align both series
    const allDates = [...new Set([
      ...orgGrowth.map(d => d.date),
      ...userGrowth.map(d => d.date)
    ])].sort();

    const orgMap = new Map(orgGrowth.map(d => [d.date, d.value]));
    const userMap = new Map(userGrowth.map(d => [d.date, d.value]));

    this.growthChart = {
      series: [
        { name: 'Organizations', data: allDates.map(d => orgMap.get(d) ?? null) },
        { name: 'Users', data: allDates.map(d => userMap.get(d) ?? null) }
      ],
      chart: { type: 'area', height: 280, toolbar: { show: false } },
      colors: ['#405189', '#0ab39c'],
      stroke: { curve: 'smooth', width: 2 },
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 } },
      xaxis: {
        categories: allDates.map(d =>
          new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        ),
        labels: { style: { fontSize: '11px' } }
      },
      tooltip: { shared: true },
      dataLabels: { enabled: false },
      grid: { borderColor: 'var(--vz-border-color)', strokeDashArray: 3 }
    };
  }
}
