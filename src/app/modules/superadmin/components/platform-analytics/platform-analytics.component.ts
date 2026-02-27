import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SuperAdminService } from '../../services/superadmin.service';
import { PlatformAnalytics } from '../../models/superadmin.models';

@Component({
  selector: 'app-platform-analytics',
  templateUrl: './platform-analytics.component.html',
  styleUrls: ['./platform-analytics.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlatformAnalyticsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  analytics: PlatformAnalytics | null = null;
  isLoading = true;
  isRefreshing = false;
  error: string | null = null;
  selectedPeriod = 'month';

  // Chart configs
  growthChart: any = {};
  revenueGrowthChart: any = {};
  usersByRoleChart: any = {};
  orgPlanChart: any = {};
  topOrgsChart: any = {};
  topOrgsByRevenueChart: any = {};
  chartsReady = false;

  private readonly colors = ['#405189', '#0ab39c', '#f06548', '#299cdb', '#f7b84b', '#74788d', '#6c5ce7', '#e83e8c'];

  constructor(
    private superAdminService: SuperAdminService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAnalytics();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAnalytics(): void {
    this.isLoading = true;
    this.error = null;
    this.chartsReady = false;
    this.cdr.markForCheck();

    this.superAdminService.getAnalytics(this.selectedPeriod)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (analytics) => {
          this.analytics = analytics;
          this.isLoading = false;
          this.isRefreshing = false;
          this.buildCharts();
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'Failed to load analytics';
          this.isLoading = false;
          this.isRefreshing = false;
          this.cdr.markForCheck();
        }
      });
  }

  refreshData(): void {
    this.isRefreshing = true;
    this.cdr.markForCheck();
    this.loadAnalytics();
  }

  onPeriodChange(): void {
    this.loadAnalytics();
  }

  // ==================== COMPUTED VALUES ====================

  getDauWauRatio(): string {
    if (!this.analytics?.weeklyActiveUsers || this.analytics.weeklyActiveUsers === 0) return '0';
    const dau = this.analytics.dailyActiveUsers || 0;
    return ((dau / this.analytics.weeklyActiveUsers) * 100).toFixed(1);
  }

  getRoleCount(): number {
    const usersByRole = this.analytics?.usersByRole || {};
    return Math.min(Object.keys(usersByRole).length, 8);
  }

  getPeriodLabel(): string {
    switch (this.selectedPeriod) {
      case 'week': return 'Last 7 days';
      case 'month': return 'Last 30 days';
      case 'year': return 'Last year';
      default: return '';
    }
  }

  // ==================== CHART BUILDERS ====================

  private buildCharts(): void {
    if (!this.analytics) return;
    this.chartsReady = false;
    this.buildGrowthChart();
    this.buildRevenueGrowthChart();
    this.buildUsersByRoleChart();
    this.buildOrgPlanChart();
    this.buildTopOrgsChart();
    this.buildTopOrgsByRevenueChart();
    this.chartsReady = true;
  }

  private buildGrowthChart(): void {
    const orgGrowth = this.analytics!.organizationGrowth || [];
    const userGrowth = this.analytics!.userGrowth || [];
    const caseGrowth = this.analytics!.caseGrowth || [];

    // Generate full date range for the selected period so chart isn't sparse
    const allDates = this.generateDateRange();

    const orgMap = new Map(orgGrowth.map(d => [d.date, d.value]));
    const userMap = new Map(userGrowth.map(d => [d.date, d.value]));
    const caseMap = new Map(caseGrowth.map(d => [d.date, d.value]));

    // Cumulative running totals — always ascending, shows real growth
    const userCumulative = this.cumulativeSum(allDates, userMap);
    const caseCumulative = this.cumulativeSum(allDates, caseMap);
    const orgCumulative = this.cumulativeSum(allDates, orgMap);

    this.growthChart = {
      series: [
        { name: 'Users', data: userCumulative },
        { name: 'Cases', data: caseCumulative },
        { name: 'Organizations', data: orgCumulative }
      ],
      chart: { type: 'area', height: 350, stacked: true, toolbar: { show: false } },
      colors: [this.colors[1], this.colors[3], this.colors[0]],
      stroke: { curve: 'smooth', width: 1.5 },
      fill: {
        type: 'gradient',
        gradient: { opacityFrom: 0.65, opacityTo: 0.25, stops: [0, 90, 100] }
      },
      xaxis: {
        categories: allDates.map(d => this.formatDateLabel(d)),
        labels: { style: { fontSize: '11px' }, rotate: -45, rotateAlways: false },
        tickAmount: this.getTickAmount()
      },
      yaxis: {
        min: 0,
        forceNiceScale: true,
        title: { text: 'Total Added', style: { fontSize: '11px', fontWeight: 500, color: '#878a99' } },
        labels: { style: { fontSize: '11px' } }
      },
      legend: { position: 'top', horizontalAlign: 'left', fontSize: '12px', markers: { radius: 3 } },
      tooltip: {
        shared: true,
        intersect: false,
        y: { formatter: (val: number) => val.toLocaleString() }
      },
      dataLabels: { enabled: false },
      grid: { borderColor: 'var(--vz-border-color)', strokeDashArray: 3, padding: { bottom: 0 } }
    };
  }

  private buildRevenueGrowthChart(): void {
    const revenueGrowth = this.analytics!.revenueGrowth || [];

    // Fill missing dates with 0 so chart shows the full period
    const allDates = this.generateDateRange();
    const revenueMap = new Map(revenueGrowth.map(d => [d.date, d.value]));

    this.revenueGrowthChart = {
      series: [{ name: 'Revenue', data: allDates.map(d => revenueMap.get(d) ?? 0) }],
      chart: { type: 'area', height: 350, toolbar: { show: false } },
      colors: ['#0ab39c'],
      stroke: { curve: 'smooth', width: 2 },
      fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 }
      },
      xaxis: {
        categories: allDates.map(d => this.formatDateLabel(d)),
        labels: { style: { fontSize: '11px' }, rotate: -45, rotateAlways: false },
        tickAmount: this.getTickAmount()
      },
      yaxis: {
        min: 0,
        forceNiceScale: true,
        labels: {
          formatter: (val: number) => this.formatCurrencyShort(val),
          style: { fontSize: '11px' }
        }
      },
      tooltip: {
        y: { formatter: (val: number) => '$' + val.toLocaleString() }
      },
      dataLabels: { enabled: false },
      grid: { borderColor: 'var(--vz-border-color)', strokeDashArray: 3 }
    };
  }

  private buildUsersByRoleChart(): void {
    const usersByRole = this.analytics!.usersByRole || {};
    const entries = Object.entries(usersByRole).sort((a, b) => b[1] - a[1]);

    // Top 8 + group the rest as "Other"
    const top = entries.slice(0, 8);
    const restSum = entries.slice(8).reduce((sum, [, v]) => sum + v, 0);
    if (restSum > 0) {
      top.push(['Other', restSum]);
    }

    const labels = top.map(([k]) => this.formatLabel(k));
    const values = top.map(([, v]) => v);

    this.usersByRoleChart = {
      series: [{ name: 'Users', data: values }],
      chart: { type: 'bar', height: 320, toolbar: { show: false } },
      colors: [this.colors[0]],
      plotOptions: { bar: { horizontal: true, barHeight: '50%', borderRadius: 4 } },
      xaxis: { categories: labels },
      yaxis: { labels: { style: { fontSize: '11px' } } },
      dataLabels: { enabled: true, style: { fontSize: '11px' } },
      grid: { borderColor: 'var(--vz-border-color)', strokeDashArray: 3 },
      tooltip: { y: { formatter: (val: number) => val + ' users' } }
    };
  }

  private buildOrgPlanChart(): void {
    const orgPlans = this.analytics!.organizationsByPlan || {};
    const planKeys = Object.keys(orgPlans);

    this.orgPlanChart = {
      series: planKeys.map(k => orgPlans[k]),
      chart: { type: 'donut', height: 320 },
      labels: planKeys.map(k => this.formatLabel(k)),
      colors: [this.colors[0], this.colors[3], this.colors[4], '#74788d'],
      legend: { position: 'bottom', fontSize: '12px' },
      dataLabels: { enabled: true, formatter: (val: number) => val.toFixed(1) + '%' },
      plotOptions: {
        pie: {
          donut: {
            size: '65%',
            labels: {
              show: true,
              total: { show: true, label: 'Total', fontSize: '13px' }
            }
          }
        }
      },
      tooltip: {
        y: { formatter: (val: number) => val + ' orgs' }
      }
    };
  }

  private buildTopOrgsChart(): void {
    const topOrgs = this.analytics!.topOrgsByUsers || [];

    this.topOrgsChart = {
      series: [{ name: 'Users', data: topOrgs.map(o => o.value) }],
      chart: { type: 'bar', height: 320, toolbar: { show: false } },
      colors: [this.colors[0]],
      plotOptions: { bar: { horizontal: true, barHeight: '50%', borderRadius: 4 } },
      xaxis: { categories: topOrgs.map(o => o.organizationName) },
      yaxis: { labels: { style: { fontSize: '11px' } } },
      dataLabels: { enabled: true, style: { fontSize: '11px' } },
      grid: { borderColor: 'var(--vz-border-color)', strokeDashArray: 3 },
      fill: {
        type: 'gradient',
        gradient: { shade: 'light', type: 'horizontal', opacityFrom: 0.85, opacityTo: 1 }
      },
      tooltip: { y: { formatter: (val: number) => val + ' users' } }
    };
  }

  private buildTopOrgsByRevenueChart(): void {
    const topOrgsByRevenue = this.analytics!.topOrgsByRevenue || [];

    this.topOrgsByRevenueChart = {
      series: [{ name: 'Revenue', data: topOrgsByRevenue.map(o => o.value) }],
      chart: { type: 'bar', height: 320, toolbar: { show: false } },
      colors: [this.colors[1]],
      plotOptions: { bar: { horizontal: true, barHeight: '50%', borderRadius: 4 } },
      xaxis: {
        categories: topOrgsByRevenue.map(o => o.organizationName),
        labels: {
          formatter: (val: number) => this.formatCurrencyShort(val),
          style: { fontSize: '11px' }
        }
      },
      yaxis: { labels: { style: { fontSize: '11px' } } },
      dataLabels: {
        enabled: true,
        style: { fontSize: '11px' },
        formatter: (val: number) => this.formatCurrencyShort(val)
      },
      grid: { borderColor: 'var(--vz-border-color)', strokeDashArray: 3 },
      fill: {
        type: 'gradient',
        gradient: { shade: 'light', type: 'horizontal', opacityFrom: 0.85, opacityTo: 1 }
      },
      tooltip: {
        y: { formatter: (val: number) => '$' + val.toLocaleString() }
      }
    };
  }

  // ==================== FORMATTERS ====================

  /** Running total from daily values — turns sparse [0,0,3,0,5] into ascending [0,0,3,3,8] */
  private cumulativeSum(dates: string[], dataMap: Map<string, number>): number[] {
    let total = 0;
    return dates.map(d => {
      total += dataMap.get(d) ?? 0;
      return total;
    });
  }

  /** Generate all ISO date strings for the selected period (fills gaps with 0 on chart) */
  private generateDateRange(): string[] {
    const days = this.selectedPeriod === 'year' ? 365 : this.selectedPeriod === 'month' ? 30 : 7;
    const dates: string[] = [];
    const today = new Date();
    for (let i = days; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const iso = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
      dates.push(iso);
    }
    return dates;
  }

  /** Limit x-axis ticks so labels don't overlap on longer periods */
  private getTickAmount(): number {
    switch (this.selectedPeriod) {
      case 'year': return 12;
      case 'month': return 10;
      default: return 7;
    }
  }

  private formatLabel(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  /** Parse ISO date string without timezone shift (avoids UTC midnight issue) */
  private formatDateLabel(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private formatCurrencyShort(val: number): string {
    if (val === null || val === undefined || isNaN(val)) return '$0';
    if (val >= 1000000) return '$' + (val / 1000000).toFixed(1) + 'M';
    if (val >= 1000) return '$' + (val / 1000).toFixed(0) + 'K';
    return '$' + val.toFixed(0);
  }
}
