import { Component, OnInit, OnDestroy, Input, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { User } from 'src/app/interface/user';
import { ClientService } from 'src/app/service/client.service';
import { UserService } from 'src/app/service/user.service';
import { RbacService } from 'src/app/core/services/rbac.service';
import { AuthService } from 'src/app/services/auth.service';
import { AuditService } from 'src/app/service/audit.service';
import { InvoiceService } from 'src/app/service/invoice.service';

@Component({
  selector: 'app-cfo-dashboard',
  templateUrl: './cfo-dashboard.component.html',
  styleUrls: ['./cfo-dashboard.component.css']
})
export class CfoDashboardComponent implements OnInit, OnDestroy {

  @Input() currentUser: User | null = null;
  @Input() isDarkMode: boolean = false;

  // Financial KPIs
  totalRevenue = 0;
  monthlyRevenue = 0;
  quarterlyRevenue = 0;
  revenueGrowth = 8;
  
  // Cash Flow Management
  accountsReceivable = 0;
  workInProgress = 0;
  cashFlow = 0;
  operatingExpenses = 0;
  
  // Billing Metrics
  totalInvoices = 0;
  paidInvoices = 0;
  pendingInvoices = 0;
  overdueInvoices = 0;
  collectionRate = 91;
  averageCollectionDays = 35;
  
  // Profitability Analysis
  grossMargin = 0;
  netMargin = 0;
  ebitda = 0;
  profitabilityTrend = 12;
  
  // Practice Area Revenue
  practiceAreaRevenue = [
    { name: 'Corporate Law', revenue: 0, percentage: 35, growth: 12 },
    { name: 'Litigation', revenue: 0, percentage: 25, growth: 8 },
    { name: 'Real Estate', revenue: 0, percentage: 20, growth: 15 },
    { name: 'Family Law', revenue: 0, percentage: 12, growth: 5 },
    { name: 'Criminal Defense', revenue: 0, percentage: 8, growth: -2 }
  ];
  
  // Financial Targets
  monthlyTarget = 750000;
  quarterlyTarget = 2250000;
  annualTarget = 9000000;
  
  // Expense Categories
  expenseCategories = [
    { name: 'Salaries & Benefits', amount: 0, percentage: 65 },
    { name: 'Office & Operations', amount: 0, percentage: 15 },
    { name: 'Technology', amount: 0, percentage: 8 },
    { name: 'Marketing', amount: 0, percentage: 7 },
    { name: 'Other', amount: 0, percentage: 5 }
  ];
  
  // Recent Financial Activities
  recentTransactions: any[] = [];
  
  // Budget vs Actual
  budgetVariance = 0;
  
  // Loading states
  isLoading = true;
  
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
    this.initializeFinancialData();
    this.loadRevenueMetrics();
    this.loadBillingData();
    this.loadRecentTransactions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeFinancialData(): void {
    // Initialize with realistic financial data
    this.collectionRate = 91;
    this.averageCollectionDays = 35;
    this.revenueGrowth = 8;
    this.profitabilityTrend = 12;
    this.grossMargin = 68;
    this.netMargin = 22;
  }

  private loadRevenueMetrics(): void {
    this.clientService.clients$(0)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.data?.content) {
            // Calculate financial metrics based on client data
            this.calculateFinancialProjections(response.data.content.length);
          }
          
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading revenue metrics:', error);
          this.isLoading = false;
        }
      });
  }

  private loadBillingData(): void {
    this.invoiceService.getInvoices(0, 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.data?.content) {
            this.calculateBillingMetrics(response.data.content);
            this.calculatePracticeAreaRevenue(response.data.content);
          }
        },
        error: (error) => console.error('Error loading billing data:', error)
      });
  }

  private calculateFinancialProjections(clientCount: number): void {
    // Base calculations on client count
    const baseRevenue = clientCount * 15000; // Average client value
    this.totalRevenue = baseRevenue;
    this.monthlyRevenue = Math.round(baseRevenue / 12);
    this.quarterlyRevenue = Math.round(baseRevenue / 4);
    
    // Calculate cash flow metrics
    this.accountsReceivable = Math.round(this.totalRevenue * 0.15);
    this.workInProgress = Math.round(this.totalRevenue * 0.12);
    this.cashFlow = Math.round(this.totalRevenue * 0.18);
    
    // Calculate expenses
    this.operatingExpenses = Math.round(this.totalRevenue * 0.75);
    
    // Calculate profitability
    this.ebitda = Math.round(this.totalRevenue * 0.28);
    this.budgetVariance = Math.round(((this.monthlyRevenue - this.monthlyTarget) / this.monthlyTarget) * 100);
    
    // Update expense categories
    this.updateExpenseCategories();
  }

  private calculateBillingMetrics(invoices: any[]): void {
    this.totalInvoices = invoices.length;
    
    // Simulate invoice statuses
    this.paidInvoices = Math.round(invoices.length * 0.75);
    this.pendingInvoices = Math.round(invoices.length * 0.18);
    this.overdueInvoices = Math.round(invoices.length * 0.07);
    
    // Calculate revenue from invoices
    const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    if (totalInvoiceAmount > 0) {
      this.totalRevenue = totalInvoiceAmount;
      this.monthlyRevenue = Math.round(totalInvoiceAmount / 12);
      this.quarterlyRevenue = Math.round(totalInvoiceAmount / 4);
    }
  }

  private calculatePracticeAreaRevenue(invoices: any[]): void {
    const totalRevenue = this.totalRevenue;
    
    this.practiceAreaRevenue = [
      {
        name: 'Corporate Law',
        revenue: Math.round(totalRevenue * 0.35),
        percentage: 35,
        growth: 12
      },
      {
        name: 'Litigation',
        revenue: Math.round(totalRevenue * 0.25),
        percentage: 25,
        growth: 8
      },
      {
        name: 'Real Estate',
        revenue: Math.round(totalRevenue * 0.20),
        percentage: 20,
        growth: 15
      },
      {
        name: 'Family Law',
        revenue: Math.round(totalRevenue * 0.12),
        percentage: 12,
        growth: 5
      },
      {
        name: 'Criminal Defense',
        revenue: Math.round(totalRevenue * 0.08),
        percentage: 8,
        growth: -2
      }
    ];
  }

  private updateExpenseCategories(): void {
    const totalExpenses = this.operatingExpenses;
    
    this.expenseCategories = [
      {
        name: 'Salaries & Benefits',
        amount: Math.round(totalExpenses * 0.65),
        percentage: 65
      },
      {
        name: 'Office & Operations',
        amount: Math.round(totalExpenses * 0.15),
        percentage: 15
      },
      {
        name: 'Technology',
        amount: Math.round(totalExpenses * 0.08),
        percentage: 8
      },
      {
        name: 'Marketing',
        amount: Math.round(totalExpenses * 0.07),
        percentage: 7
      },
      {
        name: 'Other',
        amount: Math.round(totalExpenses * 0.05),
        percentage: 5
      }
    ];
  }

  private loadRecentTransactions(): void {
    this.auditService.getRecentActivities$(10)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.data) {
            this.recentTransactions = Array.isArray(response.data) ? 
              response.data.slice(0, 8) : 
              [response.data].slice(0, 8);
          }
        },
        error: (error) => console.error('Error loading transactions:', error)
      });
  }

  // Navigation methods
  navigateToBilling(): void {
    this.router.navigate(['/billing/dashboard']);
  }

  navigateToInvoices(): void {
    this.router.navigate(['/invoice']);
  }

  navigateToReports(): void {
    this.router.navigate(['/reports']);
  }

  navigateToPayments(): void {
    this.router.navigate(['/invoice/payments']);
  }

  navigateToExpenses(): void {
    this.router.navigate(['/expenses']);
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

  getVarianceClass(variance: number): string {
    if (variance > 0) return 'text-success';
    if (variance < -10) return 'text-danger';
    return 'text-warning';
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
    return this.currentUser?.firstName || this.currentUser?.email || 'CFO';
  }

  getTargetProgress(actual: number, target: number): number {
    return target > 0 ? Math.round((actual / target) * 100) : 0;
  }

  getCollectionEfficiency(): string {
    if (this.collectionRate >= 90) return 'Excellent';
    if (this.collectionRate >= 80) return 'Good';
    if (this.collectionRate >= 70) return 'Fair';
    return 'Needs Improvement';
  }
} 