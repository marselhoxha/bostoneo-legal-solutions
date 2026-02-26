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
  error: string | null = null;
  selectedPeriod = 'week';

  // Chart configs
  growthChart: any = {};
  usersByRoleChart: any = {};
  orgPlanChart: any = {};
  topOrgsChart: any = {};
  topOrgsByRevenueChart: any = {};
  chartsReady = false;

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
          this.buildCharts();
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'Failed to load analytics';
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  onPeriodChange(): void {
    this.loadAnalytics();
  }

  private buildCharts(): void {
    if (!this.analytics) return;

    const colors = ['#405189', '#0ab39c', '#f06548', '#299cdb', '#f7b84b'];

    // Growth area chart (3 series: orgs, users, cases)
    const orgGrowth = this.analytics.organizationGrowth || [];
    const userGrowth = this.analytics.userGrowth || [];
    const caseGrowth = this.analytics.caseGrowth || [];
    const longestSeries = [orgGrowth, userGrowth, caseGrowth].reduce(
      (a, b) => a.length >= b.length ? a : b, []
    );

    this.growthChart = {
      series: [
        { name: 'Organizations', data: orgGrowth.map(d => d.value) },
        { name: 'Users', data: userGrowth.map(d => d.value) },
        { name: 'Cases', data: caseGrowth.map(d => d.value) }
      ],
      chart: { type: 'area', height: 350, toolbar: { show: false } },
      colors: [colors[0], colors[1], colors[3]],
      stroke: { curve: 'smooth', width: 2 },
      fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 }
      },
      xaxis: {
        categories: longestSeries.map(d =>
          new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        )
      },
      tooltip: { shared: true },
      dataLabels: { enabled: false }
    };

    // Users by role donut
    const usersByRole = this.analytics.usersByRole || {};
    const roleKeys = Object.keys(usersByRole);
    this.usersByRoleChart = {
      series: roleKeys.map(k => usersByRole[k]),
      chart: { type: 'donut', height: 300 },
      labels: roleKeys.map(k => this.formatLabel(k)),
      colors: [colors[0], colors[1], colors[4], colors[3], '#74788d'],
      legend: { position: 'bottom' },
      dataLabels: { enabled: true },
      plotOptions: { pie: { donut: { size: '65%' } } }
    };

    // Organizations by plan donut
    const orgPlans = this.analytics.organizationsByPlan || {};
    const orgPlanKeys = Object.keys(orgPlans);
    this.orgPlanChart = {
      series: orgPlanKeys.map(k => orgPlans[k]),
      chart: { type: 'donut', height: 300 },
      labels: orgPlanKeys.map(k => this.formatLabel(k)),
      colors: [colors[0], colors[3], '#74788d'],
      legend: { position: 'bottom' },
      dataLabels: { enabled: true },
      plotOptions: { pie: { donut: { size: '65%' } } }
    };

    // Top orgs horizontal bar
    const topOrgs = this.analytics.topOrgsByUsers || [];
    this.topOrgsChart = {
      series: [{ name: 'Users', data: topOrgs.map(o => o.value) }],
      chart: { type: 'bar', height: 300, toolbar: { show: false } },
      colors: [colors[0]],
      plotOptions: {
        bar: { horizontal: true, borderRadius: 4, barHeight: '60%' }
      },
      xaxis: { categories: topOrgs.map(o => o.organizationName) },
      dataLabels: { enabled: true },
      fill: {
        type: 'gradient',
        gradient: { shade: 'light', type: 'horizontal', opacityFrom: 0.85, opacityTo: 1 }
      }
    };

    // Top orgs by revenue horizontal bar
    const topOrgsByRevenue = this.analytics.topOrgsByRevenue || [];
    this.topOrgsByRevenueChart = {
      series: [{ name: 'Revenue', data: topOrgsByRevenue.map(o => o.value) }],
      chart: { type: 'bar', height: 300, toolbar: { show: false } },
      colors: [colors[1]],
      plotOptions: {
        bar: { horizontal: true, borderRadius: 4, barHeight: '60%' }
      },
      xaxis: { categories: topOrgsByRevenue.map(o => o.organizationName) },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => '$' + val.toLocaleString()
      },
      fill: {
        type: 'gradient',
        gradient: { shade: 'light', type: 'horizontal', opacityFrom: 0.85, opacityTo: 1 }
      },
      tooltip: {
        y: { formatter: (val: number) => '$' + val.toLocaleString() }
      }
    };

    this.chartsReady = true;
  }

  private formatLabel(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}
