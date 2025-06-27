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
  selector: 'app-senior-partner-dashboard',
  templateUrl: './senior-partner-dashboard.component.html',
  styleUrls: ['./senior-partner-dashboard.component.css']
})
export class SeniorPartnerDashboardComponent implements OnInit, OnDestroy {

  @Input() currentUser: User | null = null;
  @Input() isDarkMode: boolean = false;

  // Practice Area Metrics
  practiceAreaRevenue = 0;
  practiceAreaGrowth = 15;
  activePracticeClients = 0;
  practiceAreaUtilization = 88;
  
  // Client Development
  newClientsThisMonth = 0;
  clientRetentionRate = 96;
  averageClientValue = 0;
  clientSatisfactionScore = 4.8;
  
  // Team Management
  teamSize = 8;
  juniorAttorneys = 4;
  associates = 3;
  teamUtilization = 92;
  
  // Financial Performance
  monthlyRevenue = 0;
  billableHours = 0;
  revenueTarget = 500000;
  collectionRate = 94;
  
  // Case Management
  activeCases = 0;
  casesWon = 0;
  successRate = 95;
  upcomingDeadlines = 0;
  
  // Practice Area Focus
  practiceArea = 'Corporate Law';
  specializations = [
    { name: 'M&A Transactions', cases: 12, revenue: 0 },
    { name: 'Corporate Governance', cases: 8, revenue: 0 },
    { name: 'Securities Law', cases: 6, revenue: 0 },
    { name: 'Contract Law', cases: 15, revenue: 0 }
  ];
  
  // Recent Activities
  recentActivities: any[] = [];
  
  // Team Performance
  teamMembers = [
    { name: 'Associate A', utilization: 89, billableHours: 165 },
    { name: 'Associate B', utilization: 94, billableHours: 178 },
    { name: 'Junior Attorney', utilization: 87, billableHours: 160 }
  ];
  
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
    this.initializePracticeData();
    this.loadClientMetrics();
    this.loadFinancialData();
    this.loadRecentActivities();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializePracticeData(): void {
    // Initialize with realistic practice area data
    this.teamSize = 8;
    this.juniorAttorneys = 4;
    this.associates = 3;
    this.teamUtilization = 92;
    this.practiceAreaUtilization = 88;
    this.clientSatisfactionScore = 4.8;
    this.successRate = 95;
    this.clientRetentionRate = 96;
    this.collectionRate = 94;
    this.practiceAreaGrowth = 15;
  }

  private loadClientMetrics(): void {
    this.clientService.clients$(0)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.data?.content) {
            this.activePracticeClients = Math.round(response.data.content.length * 0.4); // 40% of clients in this practice area
            this.newClientsThisMonth = Math.round(this.activePracticeClients * 0.1);
            this.activeCases = Math.round(this.activePracticeClients * 1.2);
            this.casesWon = Math.round(this.activeCases * 0.95);
            this.upcomingDeadlines = Math.round(this.activeCases * 0.15);
            this.calculateSpecializationMetrics();
          }
          
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading client metrics:', error);
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
    // Calculate practice area specific revenue (40% of total)
    const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    this.practiceAreaRevenue = Math.round(totalRevenue * 0.4);
    
    // Calculate monthly revenue for current month
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    this.monthlyRevenue = invoices
      .filter(inv => {
        const invDate = new Date(inv.createdAt);
        return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
      })
      .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0) * 0.4; // Practice area portion
    
    this.averageClientValue = this.activePracticeClients > 0 ? 
      Math.round(this.practiceAreaRevenue / this.activePracticeClients) : 0;
    
    // Calculate billable hours estimate
    this.billableHours = Math.round(this.practiceAreaRevenue / 450); // Assuming $450/hour average
  }

  private calculateSpecializationMetrics(): void {
    const baseRevenue = this.practiceAreaRevenue;
    
    this.specializations = [
      {
        name: 'M&A Transactions',
        cases: Math.round(this.activeCases * 0.3),
        revenue: Math.round(baseRevenue * 0.45)
      },
      {
        name: 'Corporate Governance',
        cases: Math.round(this.activeCases * 0.2),
        revenue: Math.round(baseRevenue * 0.25)
      },
      {
        name: 'Securities Law',
        cases: Math.round(this.activeCases * 0.15),
        revenue: Math.round(baseRevenue * 0.20)
      },
      {
        name: 'Contract Law',
        cases: Math.round(this.activeCases * 0.35),
        revenue: Math.round(baseRevenue * 0.10)
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
              response.data.slice(0, 8) : 
              [response.data].slice(0, 8);
          }
        },
        error: (error) => console.error('Error loading activities:', error)
      });
  }

  // Navigation methods
  navigateToClients(): void {
    this.router.navigate(['/client']);
  }

  navigateToCases(): void {
    this.router.navigate(['/legal/cases']);
  }

  navigateToTeam(): void {
    this.router.navigate(['/admin/users']);
  }

  navigateToReports(): void {
    this.router.navigate(['/reports']);
  }

  navigateToTimeTracking(): void {
    this.router.navigate(['/time-tracking']);
  }

  navigateToCalendar(): void {
    this.router.navigate(['/legal/calendar']);
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
    return this.currentUser?.firstName || this.currentUser?.email || 'Senior Partner';
  }

  getTargetProgress(): number {
    return this.revenueTarget > 0 ? Math.round((this.monthlyRevenue / this.revenueTarget) * 100) : 0;
  }

  getUtilizationColor(utilization: number): string {
    if (utilization >= 85) return 'success';
    if (utilization >= 75) return 'warning';
    return 'danger';
  }
} 