import { Component, OnInit, OnDestroy, Input, ViewChild, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { User } from 'src/app/interface/user';
import { ClientService } from 'src/app/service/client.service';
import { UserService } from 'src/app/service/user.service';
import { RbacService } from 'src/app/core/services/rbac.service';
import { AuthService } from 'src/app/services/auth.service';
import { AuditService } from 'src/app/service/audit.service';
import { InvoiceService } from 'src/app/service/invoice.service';
import { ApexLegend, ApexYAxis, ChartComponent } from 'ng-apexcharts';
import { ApexAxisChartSeries, ApexChart, ApexXAxis, ApexGrid, ApexStroke, ApexFill, ApexMarkers, ApexTooltip, ApexDataLabels } from 'ng-apexcharts';

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis?: ApexYAxis | ApexYAxis[];
  stroke: ApexStroke;
  fill: ApexFill;
  markers: ApexMarkers;
  tooltip: ApexTooltip;
  grid: ApexGrid;
  legend: ApexLegend;
  dataLabels: ApexDataLabels;
};

@Component({
  selector: 'app-managing-partner-dashboard',
  templateUrl: './managing-partner-dashboard.component.html',
  styleUrls: ['./managing-partner-dashboard.component.css']
})
export class ManagingPartnerDashboardComponent implements OnInit, OnDestroy {

  @ViewChild("revenueChart") revenueChart: ChartComponent;
  @ViewChild("practiceAreaChart") practiceAreaChart: ChartComponent;
  @ViewChild("performanceChart") performanceChart: ChartComponent;
  @Input() currentUser: User | null = null;
  @Input() isDarkMode: boolean = false;

  // Executive KPIs
  totalRevenue = 0;
  monthlyRevenue = 0;
  revenueGrowth = 12;
  totalClients = 0;
  activeClients = 0;
  clientRetentionRate = 94;
  
  // Firm Operations
  totalStaff = 27;
  attorneyCount = 15;
  paralegalCount = 8;
  utilizationRate = 85;
  
  // Financial Metrics
  collectionsRate = 88;
  averageRealization = 91;
  workInProgress = 0;
  accountsReceivable = 0;
  
  // Performance Indicators
  caseSuccessRate = 92;
  clientSatisfactionScore = 4.7;
  averageCaseValue = 0;
  
  // Practice Area Performance
  practiceAreas = [
    { name: 'Corporate Law', revenue: 0, cases: 0, growth: 12, percentage: 35 },
    { name: 'Litigation', revenue: 0, cases: 0, growth: 8, percentage: 25 },
    { name: 'Real Estate', revenue: 0, cases: 0, growth: 15, percentage: 20 },
    { name: 'Family Law', revenue: 0, cases: 0, growth: 5, percentage: 12 },
    { name: 'Criminal Defense', revenue: 0, cases: 0, growth: -2, percentage: 8 }
  ];
  
  // Recent Activities
  recentActivities: any[] = [];
  
  // Chart configurations
  revenueChartOptions: Partial<ChartOptions> = {};
  practiceAreaChartOptions: Partial<ChartOptions> = {};
  performanceChartOptions: Partial<ChartOptions> = {};
  
  // Loading states
  isLoading = true;
  chartsLoaded = false;
  
  // Current date
  currentDate = new Date();
  
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private clientService: ClientService,
    private userService: UserService,
    private rbacService: RbacService,
    private authService: AuthService,
    private auditService: AuditService,
    private invoiceService: InvoiceService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeExecutiveData();
    this.loadFirmMetrics();
    this.loadFinancialData();
    this.loadRecentActivities();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeExecutiveData(): void {
    // Initialize with realistic firm data
    this.totalStaff = 27;
    this.attorneyCount = 15;
    this.paralegalCount = 8;
    this.utilizationRate = 85;
    this.clientSatisfactionScore = 4.7;
    this.caseSuccessRate = 92;
    this.clientRetentionRate = 94;
    this.collectionsRate = 88;
    this.averageRealization = 91;
  }

  private loadFirmMetrics(): void {
    this.clientService.clients$(0)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.data?.content) {
            this.totalClients = response.data.content.length;
            this.activeClients = Math.round(this.totalClients * 0.85);
            this.calculatePracticeAreaMetrics(response.data.content);
          }
          
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading firm metrics:', error);
          this.isLoading = false;
        }
      });
  }

  private loadFinancialData(): void {
    this.invoiceService.getInvoices(0, 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.data?.content) {
            this.calculateFinancialMetrics(response.data.content);
          }
        },
        error: (error) => console.error('Error loading financial data:', error)
      });
  }

  private calculateFinancialMetrics(invoices: any[]): void {
    this.totalRevenue = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    
    // Calculate monthly revenue (current month)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    this.monthlyRevenue = invoices
      .filter(inv => {
        const invDate = new Date(inv.createdAt);
        return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
      })
      .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    
    // Calculate growth (simplified)
    this.revenueGrowth = this.monthlyRevenue > 0 ? 
      Math.round(((this.monthlyRevenue / (this.totalRevenue / 12)) - 1) * 100) : 12;
    
    this.averageCaseValue = this.totalClients > 0 ? 
      Math.round(this.totalRevenue / this.totalClients) : 0;
    
    // Calculate AR and WIP (simplified estimates)
    this.accountsReceivable = Math.round(this.totalRevenue * 0.15);
    this.workInProgress = Math.round(this.totalRevenue * 0.12);
  }

  private calculatePracticeAreaMetrics(clients: any[]): void {
    // Simulate practice area distribution
    const totalClients = clients.length;
    
    this.practiceAreas = [
      {
        name: 'Corporate Law',
        revenue: Math.round(this.totalRevenue * 0.35),
        cases: Math.round(totalClients * 0.30),
        growth: 12,
        percentage: 35
      },
      {
        name: 'Litigation',
        revenue: Math.round(this.totalRevenue * 0.25),
        cases: Math.round(totalClients * 0.25),
        growth: 8,
        percentage: 25
      },
      {
        name: 'Real Estate',
        revenue: Math.round(this.totalRevenue * 0.20),
        cases: Math.round(totalClients * 0.20),
        growth: 15,
        percentage: 20
      },
      {
        name: 'Family Law',
        revenue: Math.round(this.totalRevenue * 0.12),
        cases: Math.round(totalClients * 0.15),
        growth: 5,
        percentage: 12
      },
      {
        name: 'Criminal Defense',
        revenue: Math.round(this.totalRevenue * 0.08),
        cases: Math.round(totalClients * 0.10),
        growth: -2,
        percentage: 8
      }
    ];
  }

  private loadRecentActivities(): void {
    this.auditService.getRecentActivities$(10)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.data) {
            this.recentActivities = Array.isArray(response.data) ? 
              response.data.slice(0, 10) : 
              [response.data].slice(0, 10);
          }
        },
        error: (error) => console.error('Error loading activities:', error)
      });
  }

  // Navigation methods
  navigateToFinancials(): void {
    this.router.navigate(['/billing/dashboard']);
  }

  navigateToReports(): void {
    this.router.navigate(['/reports']);
  }

  navigateToStaffManagement(): void {
    this.router.navigate(['/admin/users']);
  }

  navigateToClientManagement(): void {
    this.router.navigate(['/client']);
  }

  navigateToCaseManagement(): void {
    this.router.navigate(['/legal/cases']);
  }

  // Utility methods
  getCurrentTime(): string {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/New_York'
    });
  }

  getFormattedCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
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

  getPerformanceColor(value: number, threshold: number): string {
    if (value >= threshold) return 'success';
    if (value >= threshold * 0.8) return 'warning';
    return 'danger';
  }

  getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  getUserDisplayName(): string {
    if (this.currentUser?.firstName && this.currentUser?.lastName) {
      return `${this.currentUser.firstName} ${this.currentUser.lastName}`;
    }
    return this.currentUser?.firstName || this.currentUser?.email || 'Managing Partner';
  }
} 