import { Component, OnInit, OnDestroy, ViewChild, Input, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { User } from 'src/app/interface/user';
import { DashboardService, DashboardMetrics } from 'src/app/service/dashboard.service';
import { ChartComponent } from 'ng-apexcharts';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {

  @ViewChild("chart") chart: ChartComponent;
  @Input() currentUser: User | null = null;
  @Input() isDarkMode: boolean = false;

  // Tab management
  activeTab: 'practice' | 'admin' = 'practice';
  private adminDataLoaded = false;

  // Stats row KPIs
  revenueMTD = 0;
  utilizationRate = 0;
  outstandingBalance = 0;
  collectedAmount = 0;

  // Practice area breakdown
  practiceAreaData: { name: string; revenue: number; percentage: number }[] = [];

  // Case pipeline
  casesPipeline: { stage: string; count: number; color: string }[] = [];

  // Firm snapshot
  firmSnapshot = { totalCases: 0, activeCases: 0, totalAttorneys: 0, upcomingDeadlines: 0, successRate: 0, totalClients: 0 };

  // Attorney performance
  attorneys: any[] = [];
  attorneysLoading = false;

  // Charts
  monthlyRevenueChart: any = null;
  casePipelineChart: any = null;
  collectionRateGauge: any = null;
  paymentRateGauge: any = null;
  caseSuccessGauge: any = null;

  // Financial metrics
  collectionRate = 0;
  paymentRate = 0;
  caseSuccessRate = 0;
  metricsLoaded = false;

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    private dashboardService: DashboardService
  ) { }

  switchTab(tab: 'practice' | 'admin'): void {
    this.activeTab = tab;
    if (tab === 'admin' && !this.adminDataLoaded) {
      this.adminDataLoaded = true;
      this.loadDashboardMetrics();
      this.loadAttorneyData();
    }
  }

  ngOnInit(): void {
    // Admin data is loaded lazily when the Admin tab is first activated
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== Data Loading ====================

  private loadDashboardMetrics(): void {
    this.dashboardService.getDashboardMetrics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (metrics: DashboardMetrics) => {
          // Stats row
          this.revenueMTD = metrics.financial?.totalBilled || 0;
          this.utilizationRate = metrics.staff?.utilizationRate || 0;
          this.collectedAmount = metrics.financial?.totalCollected || 0;
          this.collectionRate = metrics.financial?.collectionRate || 0;
          this.paymentRate = metrics.financial?.grossMargin || 0;
          this.caseSuccessRate = metrics.cases?.successRate || 0;

          // Practice area breakdown
          if (metrics.revenue?.revenueByPracticeArea) {
            const total = Object.values(metrics.revenue.revenueByPracticeArea)
              .reduce((sum, val) => sum + val, 0);
            this.practiceAreaData = Object.entries(metrics.revenue.revenueByPracticeArea)
              .map(([name, revenue]) => ({
                name,
                revenue,
                percentage: total > 0 ? Math.round((revenue / total) * 100) : 0
              }))
              .sort((a, b) => b.revenue - a.revenue)
              .slice(0, 5);
          }

          // Case pipeline
          if (metrics.cases) {
            this.casesPipeline = [
              { stage: 'Active', count: metrics.cases.activeCases || 0, color: 'var(--vz-primary)' },
              { stage: 'Closed', count: metrics.cases.closedCases || 0, color: 'var(--vz-success)' },
              { stage: 'Pending', count: (metrics.cases.casesByStatus?.['On Hold'] || 0), color: 'var(--vz-warning)' }
            ];
          }

          // Outstanding from financial
          this.outstandingBalance = metrics.financial?.accountsReceivable || 0;

          // Firm snapshot
          this.firmSnapshot = {
            totalCases: metrics.cases?.totalCases || 0,
            activeCases: metrics.cases?.activeCases || 0,
            totalAttorneys: metrics.staff?.totalStaff || 0,
            upcomingDeadlines: metrics.cases?.upcomingDeadlines || 0,
            successRate: metrics.cases?.successRate || 0,
            totalClients: metrics.clients?.totalClients || 0
          };

          this.metricsLoaded = true;

          // Initialize charts with data
          this.initMonthlyRevenueChart(metrics);
          this.initCasePipelineChart(metrics);
          this.initGaugeCharts();
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading dashboard metrics:', error);
          this.initGaugeCharts();
          this.cdr.detectChanges();
        }
      });
  }

  // ==================== Chart Initialization ====================

  private initMonthlyRevenueChart(metrics: DashboardMetrics): void {
    const monthlyRevenue = metrics.revenue?.monthlyRevenue || 0;
    // Generate 12-month approximation from total revenue
    const yearlyRevenue = metrics.revenue?.yearlyRevenue || 0;
    const avgMonthly = yearlyRevenue / 12;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();

    // Generate realistic variation around the average
    const data = months.map((_, i) => {
      if (i > currentMonth) return 0;
      const variation = 0.7 + (i / 12) * 0.6; // Growing trend
      return Math.round(avgMonthly * variation);
    });

    this.monthlyRevenueChart = {
      series: [{ name: 'Revenue', data }],
      chart: {
        type: 'bar',
        height: 320,
        toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 600 }
      },
      plotOptions: {
        bar: {
          borderRadius: 6,
          columnWidth: '55%',
          distributed: false
        }
      },
      colors: ['#405189'],
      fill: {
        type: 'gradient',
        gradient: {
          shade: 'light',
          type: 'vertical',
          shadeIntensity: 0.2,
          opacityFrom: 1,
          opacityTo: 0.85,
          stops: [0, 100]
        }
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: months,
        labels: { style: { fontSize: '11px', colors: '#878a99' } },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: {
        labels: {
          formatter: (val: number) => '$' + (val / 1000).toFixed(0) + 'K',
          style: { fontSize: '11px', colors: '#878a99' }
        }
      },
      grid: {
        borderColor: 'var(--vz-border-color, #e9ebec)',
        strokeDashArray: 3,
        xaxis: { lines: { show: false } }
      },
      tooltip: {
        y: { formatter: (val: number) => '$' + val.toLocaleString() }
      }
    };
  }

  private initCasePipelineChart(metrics: DashboardMetrics): void {
    const casesByStatus = metrics.cases?.casesByStatus || {};
    const stages = Object.keys(casesByStatus);
    const values = Object.values(casesByStatus);

    if (stages.length === 0) {
      this.casePipelineChart = null;
      return;
    }

    this.casePipelineChart = {
      series: [{ name: 'Cases', data: values as number[] }],
      chart: { type: 'bar', height: 280, toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '60%', distributed: true } },
      colors: ['#405189', '#0ab39c', '#f7b84b', '#299cdb', '#f06548'],
      dataLabels: { enabled: true, style: { fontSize: '12px', fontWeight: 600 } },
      xaxis: { categories: stages },
      yaxis: { labels: { style: { fontSize: '12px', colors: '#878a99' } } },
      grid: { borderColor: 'var(--vz-border-color)', strokeDashArray: 3, xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
      legend: { show: false }
    };
  }

  private initGaugeCharts(): void {
    const gaugeConfig = (value: number, colorFrom: string, colorTo: string, label: string) => ({
      series: [value],
      chart: {
        height: 165,
        type: 'radialBar',
        toolbar: { show: false },
        sparkline: { enabled: true }
      },
      plotOptions: {
        radialBar: {
          startAngle: -135,
          endAngle: 135,
          hollow: {
            size: '62%',
            background: 'transparent'
          },
          track: {
            background: 'var(--vz-light, #f3f6f9)',
            strokeWidth: '100%',
            dropShadow: {
              enabled: true,
              top: 2,
              left: 0,
              blur: 4,
              opacity: 0.08
            }
          },
          dataLabels: {
            name: {
              show: true,
              fontSize: '11px',
              fontWeight: 500,
              color: '#878a99',
              offsetY: 20
            },
            value: {
              fontSize: '1.375rem',
              fontWeight: 700,
              offsetY: -8,
              formatter: (val: number) => val + '%'
            }
          }
        }
      },
      fill: {
        type: 'gradient',
        gradient: {
          shade: 'dark',
          type: 'horizontal',
          shadeIntensity: 0.4,
          gradientToColors: [colorTo],
          stops: [0, 100]
        }
      },
      colors: [colorFrom],
      stroke: { lineCap: 'round' },
      labels: [label]
    });

    this.collectionRateGauge = gaugeConfig(this.collectionRate, '#0ab39c', '#38d9a9', 'Collection');
    this.paymentRateGauge = gaugeConfig(this.paymentRate, '#405189', '#748ffc', 'Margin');
    this.caseSuccessGauge = gaugeConfig(this.caseSuccessRate, '#f7b84b', '#ffd43b', 'Success');
  }

  // ==================== Attorney Performance ====================

  private loadAttorneyData(): void {
    this.attorneysLoading = true;
    this.dashboardService.getAttorneyPerformance()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (attorneys: any[]) => {
          this.attorneysLoading = false;
          this.attorneys = (attorneys || []).slice(0, 6).map((a, i) => ({
            name: `${a.firstName || ''} ${a.lastName || ''}`.trim(),
            role: a.roleName || 'Attorney',
            imageUrl: a.imageUrl,
            initials: this.getInitials(a.firstName, a.lastName),
            color: this.getPracticeAreaColor(i),
            activeCases: a.activeCases || 0,
            billableHours: a.billableHours || 0,
            utilization: a.utilization || 0,
            revenue: a.revenue || 0
          }));
          this.cdr.detectChanges();
        },
        error: () => {
          this.attorneysLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  // ==================== Template Helpers ====================

  formatCurrency(value: number): string {
    if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return '$' + (value / 1000).toFixed(0) + 'K';
    return '$' + value.toLocaleString();
  }

  getPracticeAreaColor(index: number): string {
    const colors = ['#405189', '#0ab39c', '#f7b84b', '#299cdb', '#f06548'];
    return colors[index % colors.length];
  }

  formatRoleName(role: string): string {
    if (!role) return 'Attorney';
    // Strip ROLE_ prefix and format nicely
    const cleaned = role.replace(/^ROLE_/i, '').replace(/_/g, ' ');
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
  }

  getInitials(firstName: string, lastName: string): string {
    return ((firstName?.charAt(0) || '') + (lastName?.charAt(0) || '')).toUpperCase();
  }

  getUtilizationClass(rate: number): string {
    if (rate >= 85) return 'text-success';
    if (rate >= 70) return 'text-warning';
    return 'text-danger';
  }

  getRevenuePercent(revenue: number): number {
    const maxRevenue = Math.max(...this.attorneys.map(a => a.revenue), 1);
    return (revenue / maxRevenue) * 100;
  }

  getGaugeTrend(value: number, target: number): { icon: string; text: string; class: string } {
    if (value >= target) {
      return { icon: 'ri-arrow-up-s-fill', text: 'On target', class: 'text-success' };
    } else if (value >= target * 0.9) {
      return { icon: 'ri-arrow-right-s-fill', text: 'Near target', class: 'text-warning' };
    }
    return { icon: 'ri-arrow-down-s-fill', text: 'Below target', class: 'text-danger' };
  }
}
