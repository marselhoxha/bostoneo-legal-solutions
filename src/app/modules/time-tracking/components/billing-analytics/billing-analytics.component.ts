import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BillingRateService, BillingRate } from '../../services/billing-rate.service';
import { TimeTrackingService } from '../../services/time-tracking.service';
import { UserService } from '../../../../service/user.service';
import { Subscription } from 'rxjs';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);

interface BillingMetrics {
  totalRevenue: number;
  totalHours: number;
  averageRate: number;
  billableHours: number;
  nonBillableHours: number;
  utilizationRate: number;
  revenueGrowth: number;
  hoursGrowth: number;
}

interface RevenueByPeriod {
  period: string;
  revenue: number;
  hours: number;
  averageRate: number;
}

interface RevenueByAttorney {
  userId: number;
  userName: string;
  revenue: number;
  hours: number;
  averageRate: number;
  utilizationRate: number;
}

interface RevenueByRateType {
  rateType: string;
  revenue: number;
  hours: number;
  percentage: number;
}

interface RevenueByCase {
  caseId: number;
  caseName: string;
  caseNumber: string;
  revenue: number;
  hours: number;
  status: string;
}

@Component({
  selector: 'app-billing-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './billing-analytics.component.html',
  styleUrls: ['./billing-analytics.component.scss']
})
export class BillingAnalyticsComponent implements OnInit, OnDestroy {
  // Core data
  billingMetrics: BillingMetrics = {
    totalRevenue: 0,
    totalHours: 0,
    averageRate: 0,
    billableHours: 0,
    nonBillableHours: 0,
    utilizationRate: 0,
    revenueGrowth: 0,
    hoursGrowth: 0
  };

  revenueByPeriod: RevenueByPeriod[] = [];
  revenueByAttorney: RevenueByAttorney[] = [];
  revenueByRateType: RevenueByRateType[] = [];
  revenueByCase: RevenueByCase[] = [];

  // UI state
  loading = true;
  error: string | null = null;
  selectedPeriod = 'month';
  selectedYear = new Date().getFullYear();
  selectedQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

  // Charts
  revenueChart: Chart<any> | null = null;
  utilizationChart: Chart<any> | null = null;
  rateTypeChart: Chart<any> | null = null;
  attorneyChart: Chart<any> | null = null;

  // Filters
  dateRange = {
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  };

  private subscriptions: Subscription[] = [];

  constructor(
    private billingRateService: BillingRateService,
    private timeTrackingService: TimeTrackingService,
    private userService: UserService,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAnalytics();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.destroyCharts();
  }

  private loadAnalytics(): Promise<void> {
    return new Promise((resolve) => {
      this.loading = true;
      this.error = null;

      Promise.all([
        this.loadBillingMetrics(),
        this.loadRevenueByPeriod(),
        this.loadRevenueByAttorney(),
        this.loadRevenueByRateType(),
        this.loadRevenueByCase()
      ]).then(() => {
        this.loading = false;
        this.changeDetectorRef.detectChanges();
        
        // Initialize charts after data is loaded
        setTimeout(() => {
          this.initializeCharts();
        }, 100);
        
        resolve();
      }).catch(error => {
        console.error('Error loading billing analytics:', error);
        this.error = 'Failed to load billing analytics. Please try again.';
        this.loading = false;
        this.changeDetectorRef.detectChanges();
        resolve();
      });
    });
  }

  private loadBillingMetrics(): Promise<void> {
    return new Promise((resolve) => {
      // Mock data for demonstration - replace with actual API calls
      this.billingMetrics = {
        totalRevenue: 125750.00,
        totalHours: 485.5,
        averageRate: 259.00,
        billableHours: 425.5,
        nonBillableHours: 60.0,
        utilizationRate: 87.6,
        revenueGrowth: 12.5,
        hoursGrowth: 8.3
      };
      resolve();
    });
  }

  private loadRevenueByPeriod(): Promise<void> {
    return new Promise((resolve) => {
      // Mock data for demonstration
      this.revenueByPeriod = [
        { period: 'Jan 2024', revenue: 45250, hours: 175, averageRate: 258.57 },
        { period: 'Feb 2024', revenue: 38900, hours: 150, averageRate: 259.33 },
        { period: 'Mar 2024', revenue: 41600, hours: 160.5, averageRate: 259.16 },
        { period: 'Apr 2024', revenue: 52300, hours: 202, averageRate: 258.91 },
        { period: 'May 2024', revenue: 48750, hours: 188, averageRate: 259.31 },
        { period: 'Jun 2024', revenue: 55200, hours: 213, averageRate: 259.15 }
      ];
      resolve();
    });
  }

  private loadRevenueByAttorney(): Promise<void> {
    return new Promise((resolve) => {
      // Mock data for demonstration
      this.revenueByAttorney = [
        {
          userId: 1,
          userName: 'John Smith',
          revenue: 45250,
          hours: 125.5,
          averageRate: 360.50,
          utilizationRate: 92.3
        },
        {
          userId: 2,
          userName: 'Sarah Johnson',
          revenue: 38900,
          hours: 142.0,
          averageRate: 274.00,
          utilizationRate: 88.7
        },
        {
          userId: 3,
          userName: 'Mike Davis',
          revenue: 32100,
          hours: 118.0,
          averageRate: 272.03,
          utilizationRate: 85.2
        },
        {
          userId: 4,
          userName: 'Emily Chen',
          revenue: 28500,
          hours: 100.0,
          averageRate: 285.00,
          utilizationRate: 83.1
        }
      ];
      resolve();
    });
  }

  private loadRevenueByRateType(): Promise<void> {
    return new Promise((resolve) => {
      // Mock data for demonstration
      this.revenueByRateType = [
        { rateType: 'Standard', revenue: 75250, hours: 285.5, percentage: 59.8 },
        { rateType: 'Litigation', revenue: 32100, hours: 95.0, percentage: 25.5 },
        { rateType: 'Emergency', revenue: 12400, hours: 25.0, percentage: 9.9 },
        { rateType: 'Court', revenue: 6000, hours: 15.0, percentage: 4.8 }
      ];
      resolve();
    });
  }

  private loadRevenueByCase(): Promise<void> {
    return new Promise((resolve) => {
      // Mock data for demonstration
      this.revenueByCase = [
        {
          caseId: 1,
          caseName: 'ABC Corp vs XYZ Inc',
          caseNumber: 'CASE-2024-001',
          revenue: 25750,
          hours: 85.5,
          status: 'Active'
        },
        {
          caseId: 2,
          caseName: 'Personal Injury - Smith',
          caseNumber: 'CASE-2024-002',
          revenue: 18900,
          hours: 65.0,
          status: 'Active'
        },
        {
          caseId: 3,
          caseName: 'Estate Planning - Johnson',
          caseNumber: 'CASE-2024-003',
          revenue: 12400,
          hours: 42.0,
          status: 'Completed'
        }
      ];
      resolve();
    });
  }

  private initializeCharts(): void {
    this.createRevenueChart();
    this.createUtilizationChart();
    this.createRateTypeChart();
    this.createAttorneyChart();
  }

  private createRevenueChart(): void {
    const canvas = document.getElementById('revenueChart') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.revenueChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.revenueByPeriod.map(item => item.period),
        datasets: [
          {
            label: 'Revenue ($)',
            data: this.revenueByPeriod.map(item => item.revenue),
            borderColor: '#0d6efd',
            backgroundColor: 'rgba(13, 110, 253, 0.1)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Hours',
            data: this.revenueByPeriod.map(item => item.hours),
            borderColor: '#198754',
            backgroundColor: 'rgba(25, 135, 84, 0.1)',
            tension: 0.4,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top'
          },
          title: {
            display: true,
            text: 'Revenue and Hours Trend'
          }
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Revenue ($)'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Hours'
            },
            grid: {
              drawOnChartArea: false
            }
          }
        }
      }
    });
  }

  private createUtilizationChart(): void {
    const canvas = document.getElementById('utilizationChart') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.utilizationChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Billable Hours', 'Non-Billable Hours'],
        datasets: [{
          data: [this.billingMetrics.billableHours, this.billingMetrics.nonBillableHours],
          backgroundColor: ['#198754', '#dc3545'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          },
          title: {
            display: true,
            text: 'Hours Utilization'
          }
        }
      }
    });
  }

  private createRateTypeChart(): void {
    const canvas = document.getElementById('rateTypeChart') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.rateTypeChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.revenueByRateType.map(item => item.rateType),
        datasets: [{
          label: 'Revenue ($)',
          data: this.revenueByRateType.map(item => item.revenue),
          backgroundColor: ['#0d6efd', '#198754', '#ffc107', '#dc3545'],
          borderColor: ['#0d6efd', '#198754', '#ffc107', '#dc3545'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Revenue by Rate Type'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Revenue ($)'
            }
          }
        }
      }
    });
  }

  private createAttorneyChart(): void {
    const canvas = document.getElementById('attorneyChart') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.attorneyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.revenueByAttorney.map(item => item.userName),
        datasets: [
          {
            label: 'Revenue ($)',
            data: this.revenueByAttorney.map(item => item.revenue),
            backgroundColor: '#0d6efd',
            yAxisID: 'y'
          },
          {
            label: 'Utilization Rate (%)',
            data: this.revenueByAttorney.map(item => item.utilizationRate),
            backgroundColor: '#198754',
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top'
          },
          title: {
            display: true,
            text: 'Attorney Performance'
          }
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Revenue ($)'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Utilization Rate (%)'
            },
            grid: {
              drawOnChartArea: false
            }
          }
        }
      }
    });
  }

  private destroyCharts(): void {
    if (this.revenueChart) {
      this.revenueChart.destroy();
      this.revenueChart = null;
    }
    if (this.utilizationChart) {
      this.utilizationChart.destroy();
      this.utilizationChart = null;
    }
    if (this.rateTypeChart) {
      this.rateTypeChart.destroy();
      this.rateTypeChart = null;
    }
    if (this.attorneyChart) {
      this.attorneyChart.destroy();
      this.attorneyChart = null;
    }
  }

  // Event handlers
  onPeriodChange(): void {
    this.loadAnalytics();
  }

  onDateRangeChange(): void {
    this.loadAnalytics();
  }

  refreshAnalytics(): void {
    this.loadAnalytics();
  }

  exportAnalytics(): void {
    const data = {
      metrics: this.billingMetrics,
      revenueByPeriod: this.revenueByPeriod,
      revenueByAttorney: this.revenueByAttorney,
      revenueByRateType: this.revenueByRateType,
      revenueByCase: this.revenueByCase,
      generatedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `billing-analytics-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  // Utility methods
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  formatHours(hours: number): string {
    return `${hours.toFixed(1)}h`;
  }

  getGrowthClass(growth: number): string {
    if (growth > 0) return 'text-success';
    if (growth < 0) return 'text-danger';
    return 'text-muted';
  }

  getGrowthIcon(growth: number): string {
    if (growth > 0) return 'ri-arrow-up-line';
    if (growth < 0) return 'ri-arrow-down-line';
    return 'ri-subtract-line';
  }

  getUtilizationClass(rate: number): string {
    if (rate >= 90) return 'text-success';
    if (rate >= 80) return 'text-warning';
    return 'text-danger';
  }
} 