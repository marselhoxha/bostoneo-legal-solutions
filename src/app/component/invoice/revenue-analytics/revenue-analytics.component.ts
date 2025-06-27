import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvoiceService } from '../../../service/invoice.service';
import { InvoicePaymentService } from '../../../service/invoice-payment.service';
import { PaymentAnalyticsService } from '../../../service/payment-analytics.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface RevenueMetrics {
  totalRevenue: number;
  totalOutstanding: number;
  totalOverdue: number;
  averageInvoiceValue: number;
  paymentVelocity: number;
  collectionRate: number;
  monthlyRevenue: { month: string; amount: number }[];
  revenueByClient: { clientName: string; amount: number }[];
  revenueByPracticeArea: { area: string; amount: number }[];
  paymentTrends: { date: string; amount: number }[];
}

@Component({
  selector: 'app-revenue-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './revenue-analytics.component.html',
  styleUrls: ['./revenue-analytics.component.css']
})
export class RevenueAnalyticsComponent implements OnInit {
  @ViewChild('revenueChart') revenueChart: ElementRef<HTMLCanvasElement>;
  @ViewChild('clientChart') clientChart: ElementRef<HTMLCanvasElement>;
  @ViewChild('practiceAreaChart') practiceAreaChart: ElementRef<HTMLCanvasElement>;
  @ViewChild('paymentTrendChart') paymentTrendChart: ElementRef<HTMLCanvasElement>;

  metrics: RevenueMetrics = {
    totalRevenue: 0,
    totalOutstanding: 0,
    totalOverdue: 0,
    averageInvoiceValue: 0,
    paymentVelocity: 0,
    collectionRate: 0,
    monthlyRevenue: [],
    revenueByClient: [],
    revenueByPracticeArea: [],
    paymentTrends: []
  };

  dateRange = '12'; // Default to 12 months
  loading = true;
  charts: Chart[] = [];

  constructor(
    private invoiceService: InvoiceService,
    private paymentService: InvoicePaymentService,
    private analyticsService: PaymentAnalyticsService
  ) {}

  ngOnInit(): void {
    this.loadAnalytics();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.initializeCharts(), 100);
  }

  ngOnDestroy(): void {
    this.charts.forEach(chart => chart.destroy());
  }

  loadAnalytics(): void {
    this.loading = true;
    const months = parseInt(this.dateRange);
    
    this.analyticsService.getRevenueMetrics(months).subscribe({
      next: (metrics) => {
        this.metrics = metrics;
        this.updateCharts();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading analytics:', error);
        this.loading = false;
      }
    });
  }

  initializeCharts(): void {
    // Revenue Trend Chart
    if (this.revenueChart) {
      const revenueCtx = this.revenueChart.nativeElement.getContext('2d');
      this.charts.push(new Chart(revenueCtx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Monthly Revenue',
            data: [],
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            tension: 0.1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Revenue Trend'
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function(value) {
                  return '$' + value.toLocaleString();
                }
              }
            }
          }
        }
      }));
    }

    // Client Revenue Chart
    if (this.clientChart) {
      const clientCtx = this.clientChart.nativeElement.getContext('2d');
      this.charts.push(new Chart(clientCtx, {
        type: 'bar',
        data: {
          labels: [],
          datasets: [{
            label: 'Revenue by Client',
            data: [],
            backgroundColor: 'rgba(54, 162, 235, 0.8)'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Top Clients by Revenue'
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function(value) {
                  return '$' + value.toLocaleString();
                }
              }
            }
          }
        }
      }));
    }

    // Practice Area Chart
    if (this.practiceAreaChart) {
      const practiceCtx = this.practiceAreaChart.nativeElement.getContext('2d');
      this.charts.push(new Chart(practiceCtx, {
        type: 'doughnut',
        data: {
          labels: [],
          datasets: [{
            data: [],
            backgroundColor: [
              'rgba(255, 99, 132, 0.8)',
              'rgba(54, 162, 235, 0.8)',
              'rgba(255, 205, 86, 0.8)',
              'rgba(75, 192, 192, 0.8)',
              'rgba(153, 102, 255, 0.8)'
            ]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Revenue by Practice Area'
            },
            legend: {
              position: 'bottom'
            }
          }
        }
      }));
    }

    // Payment Trend Chart
    if (this.paymentTrendChart) {
      const paymentCtx = this.paymentTrendChart.nativeElement.getContext('2d');
      this.charts.push(new Chart(paymentCtx, {
        type: 'bar',
        data: {
          labels: [],
          datasets: [{
            label: 'Payments Received',
            data: [],
            backgroundColor: 'rgba(75, 192, 192, 0.8)'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Payment Collection Trend'
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function(value) {
                  return '$' + value.toLocaleString();
                }
              }
            }
          }
        }
      }));
    }
  }

  updateCharts(): void {
    if (!this.charts.length) return;

    // Update Revenue Trend
    if (this.charts[0] && this.metrics.monthlyRevenue) {
      this.charts[0].data.labels = this.metrics.monthlyRevenue.map(m => m.month);
      this.charts[0].data.datasets[0].data = this.metrics.monthlyRevenue.map(m => m.amount);
      this.charts[0].update();
    }

    // Update Client Revenue (top 10)
    if (this.charts[1] && this.metrics.revenueByClient) {
      const topClients = this.metrics.revenueByClient.slice(0, 10);
      this.charts[1].data.labels = topClients.map(c => c.clientName);
      this.charts[1].data.datasets[0].data = topClients.map(c => c.amount);
      this.charts[1].update();
    }

    // Update Practice Area Revenue
    if (this.charts[2] && this.metrics.revenueByPracticeArea) {
      this.charts[2].data.labels = this.metrics.revenueByPracticeArea.map(p => p.area);
      this.charts[2].data.datasets[0].data = this.metrics.revenueByPracticeArea.map(p => p.amount);
      this.charts[2].update();
    }

    // Update Payment Trends
    if (this.charts[3] && this.metrics.paymentTrends) {
      this.charts[3].data.labels = this.metrics.paymentTrends.map(p => p.date);
      this.charts[3].data.datasets[0].data = this.metrics.paymentTrends.map(p => p.amount);
      this.charts[3].update();
    }
  }

  onDateRangeChange(): void {
    this.loadAnalytics();
  }

  exportReport(format: string): void {
    this.analyticsService.exportRevenueReport(format, parseInt(this.dateRange)).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `revenue-report-${new Date().toISOString().split('T')[0]}.${format}`;
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Error exporting report:', error);
      }
    });
  }

  getPercentageChange(current: number, previous: number): number {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  }
}