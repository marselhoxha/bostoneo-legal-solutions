import { Component, OnInit, OnDestroy, Input, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { User } from 'src/app/interface/user';
import { RbacService } from 'src/app/core/services/rbac.service';
import { LegalCaseService } from 'src/app/modules/legal/services/legal-case.service';
import { UserService } from 'src/app/service/user.service';
import { ClientService } from 'src/app/service/client.service';
import { InvoiceService } from 'src/app/service/invoice.service';

@Component({
  selector: 'app-manager-dashboard',
  templateUrl: './manager-dashboard.component.html',
  styleUrls: ['./manager-dashboard.component.css']
})
export class ManagerDashboardComponent implements OnInit, OnDestroy {
  @Input() currentUser: User | null = null;
  @Input() isDarkMode: boolean = false;

  // Manager type (Practice, IT, HR, Finance)
  managerType: string = 'Practice'; // Will be determined from user role

  // Dashboard metrics
  teamMembers = 0;
  activeCases = 0;
  pendingApprovals = 0;
  departmentEfficiency = 0;
  monthlyBudget = 0;
  budgetUtilization = 0;

  // Data collections
  teamPerformance: any[] = [];
  pendingApprovalsList: any[] = [];
  departmentCases: any[] = [];
  resourceAllocation: any[] = [];
  upcomingDeadlines: any[] = [];
  staffSchedule: any[] = [];

  // Charts
  performanceChart: any = null;
  budgetChart: any = null;
  caseloadChart: any = null;
  efficiencyChart: any = null;

  // Loading states
  isLoading = true;
  teamLoading = false;
  casesLoading = false;
  approvalsLoading = false;
  metricsLoading = false;

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private rbacService: RbacService,
    private caseService: LegalCaseService,
    private userService: UserService,
    private clientService: ClientService,
    private invoiceService: InvoiceService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.detectManagerType();
    this.loadDashboardData();
    this.initializeCharts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private detectManagerType(): void {
    // Detect manager type from user role
    const role = this.currentUser?.roleName || '';
    
    if (role.includes('PRACTICE') || role.includes('LEGAL')) {
      this.managerType = 'Practice';
    } else if (role.includes('IT') || role.includes('TECH')) {
      this.managerType = 'IT';
    } else if (role.includes('HR') || role.includes('HUMAN')) {
      this.managerType = 'HR';
    } else if (role.includes('FINANCE') || role.includes('CFO')) {
      this.managerType = 'Finance';
    }
  }

  private loadDashboardData(): void {
    this.isLoading = true;
    
    // Load data based on manager type
    switch (this.managerType) {
      case 'Practice':
        this.loadPracticeManagerData();
        break;
      case 'IT':
        this.loadITManagerData();
        break;
      case 'HR':
        this.loadHRManagerData();
        break;
      case 'Finance':
        this.loadFinanceManagerData();
        break;
    }
    
    // Common data for all managers
    this.loadTeamData();
    this.loadPendingApprovals();
    
    setTimeout(() => {
      this.isLoading = false;
      this.cdr.detectChanges();
    }, 1000);
  }

  private loadPracticeManagerData(): void {
    this.casesLoading = true;
    
    // Load department cases
    this.caseService.getAllCases(0, 10)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.data?.page?.content) {
            this.departmentCases = response.data.page.content.slice(0, 5);
            this.activeCases = response.data.page.totalElements || 0;
          }
          this.casesLoading = false;
          this.calculateDepartmentMetrics();
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading cases:', error);
          this.casesLoading = false;
          // Use fallback data
          this.activeCases = 45;
          this.departmentCases = [
            { id: 1, caseNumber: 'CASE-2024-001', title: 'Smith vs. Jones', status: 'Active', attorney: 'John Smith' },
            { id: 2, caseNumber: 'CASE-2024-002', title: 'Corporate Merger ABC', status: 'In Progress', attorney: 'Jane Doe' }
          ];
          this.calculateDepartmentMetrics();
          this.cdr.detectChanges();
        }
      });
  }

  private loadITManagerData(): void {
    // IT-specific metrics
    this.teamMembers = 8;
    this.pendingApprovals = 3;
    this.departmentEfficiency = 94;
    
    // System health data
    this.resourceAllocation = [
      { name: 'Server Uptime', value: 99.9, unit: '%' },
      { name: 'Network Latency', value: 12, unit: 'ms' },
      { name: 'Storage Used', value: 67, unit: '%' },
      { name: 'Active Tickets', value: 24, unit: '' }
    ];
  }

  private loadHRManagerData(): void {
    // HR-specific metrics
    this.teamMembers = 52;
    this.pendingApprovals = 7;
    
    // Staff metrics
    this.staffSchedule = [
      { name: 'Vacation Requests', count: 5, status: 'Pending' },
      { name: 'Training Sessions', count: 3, status: 'Scheduled' },
      { name: 'Performance Reviews', count: 12, status: 'Due' },
      { name: 'New Hires', count: 2, status: 'In Progress' }
    ];
  }

  private loadFinanceManagerData(): void {
    // Finance-specific metrics
    this.monthlyBudget = 250000;
    this.budgetUtilization = 78;
    this.departmentEfficiency = 92;
    
    // Financial data
    this.resourceAllocation = [
      { name: 'Payroll', value: 120000, percentage: 48 },
      { name: 'Operations', value: 50000, percentage: 20 },
      { name: 'Technology', value: 30000, percentage: 12 },
      { name: 'Marketing', value: 20000, percentage: 8 },
      { name: 'Other', value: 30000, percentage: 12 }
    ];
  }

  private loadTeamData(): void {
    this.teamLoading = true;
    
    // Simulated team performance data
    this.teamPerformance = [
      { name: 'John Smith', role: 'Senior Attorney', efficiency: 95, cases: 12, billableHours: 162 },
      { name: 'Jane Doe', role: 'Associate', efficiency: 88, cases: 8, billableHours: 145 },
      { name: 'Mike Johnson', role: 'Paralegal', efficiency: 92, cases: 15, billableHours: 168 },
      { name: 'Sarah Williams', role: 'Junior Associate', efficiency: 85, cases: 6, billableHours: 135 }
    ];
    
    this.teamMembers = this.teamPerformance.length;
    this.teamLoading = false;
    this.cdr.detectChanges();
  }

  private loadPendingApprovals(): void {
    this.approvalsLoading = true;
    
    // Simulated pending approvals
    this.pendingApprovalsList = [
      { id: 1, type: 'Time Entry', description: '40 hours - Smith vs. Jones', requestor: 'John Smith', date: '2024-01-20' },
      { id: 2, type: 'Expense', description: 'Travel expenses - $1,200', requestor: 'Jane Doe', date: '2024-01-21' },
      { id: 3, type: 'Leave Request', description: 'Vacation - 3 days', requestor: 'Mike Johnson', date: '2024-01-22' }
    ];
    
    this.pendingApprovals = this.pendingApprovalsList.length;
    this.approvalsLoading = false;
    this.cdr.detectChanges();
  }

  private calculateDepartmentMetrics(): void {
    // Calculate efficiency based on various factors
    const completedCases = Math.floor(this.activeCases * 0.3);
    const onTimeCases = Math.floor(completedCases * 0.85);
    
    this.departmentEfficiency = completedCases > 0 
      ? Math.round((onTimeCases / completedCases) * 100) 
      : 0;
      
    // Calculate budget (simplified)
    this.monthlyBudget = this.teamMembers * 15000; // Average cost per team member
    this.budgetUtilization = 78; // Mock value
  }

  private initializeCharts(): void {
    // Initialize performance chart
    this.performanceChart = {
      series: [{
        name: 'Efficiency',
        data: [92, 88, 95, 85, 90, 93, 87]
      }],
      chart: {
        type: 'area',
        height: 250,
        toolbar: { show: false }
      },
      xaxis: {
        categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      },
      stroke: { curve: 'smooth', width: 2 },
      fill: { opacity: 0.1 },
      colors: ['#6658dd']
    };

    // Initialize budget chart
    this.budgetChart = {
      series: [this.budgetUtilization],
      chart: {
        type: 'radialBar',
        height: 200,
        toolbar: { show: false }
      },
      plotOptions: {
        radialBar: {
          hollow: { size: '70%' },
          dataLabels: {
            show: true,
            name: { show: false },
            value: {
              formatter: (val: any) => val + '%',
              fontSize: '16px',
              fontWeight: 'bold'
            }
          }
        }
      },
      colors: ['#10b981'],
      labels: ['Budget Used']
    };

    // Initialize caseload chart
    this.caseloadChart = {
      series: [{
        name: 'Cases',
        data: [12, 8, 15, 6, 10, 14, 9]
      }],
      chart: {
        type: 'bar',
        height: 250,
        toolbar: { show: false }
      },
      xaxis: {
        categories: ['John S.', 'Jane D.', 'Mike J.', 'Sarah W.', 'Tom B.', 'Lisa M.', 'David K.']
      },
      colors: ['#06b6d4']
    };

    // Initialize efficiency gauge
    this.efficiencyChart = {
      series: [this.departmentEfficiency],
      chart: {
        type: 'radialBar',
        height: 200,
        toolbar: { show: false }
      },
      plotOptions: {
        radialBar: {
          hollow: { size: '70%' },
          dataLabels: {
            show: true,
            name: { show: false },
            value: {
              formatter: (val: any) => val + '%',
              fontSize: '16px',
              fontWeight: 'bold'
            }
          }
        }
      },
      colors: ['#f59e0b'],
      labels: ['Efficiency']
    };
  }

  // Navigation methods
  navigateToTeam(): void {
    this.router.navigate(['/team']);
  }

  navigateToCases(): void {
    this.router.navigate(['/cases']);
  }

  navigateToReports(): void {
    this.router.navigate(['/reports']);
  }

  navigateToBudget(): void {
    this.router.navigate(['/finance/budget']);
  }

  viewTeamMember(memberId: number): void {
    this.router.navigate(['/team/member', memberId]);
  }

  viewCase(caseId: number): void {
    this.router.navigate(['/cases', caseId]);
  }

  approveItem(itemId: number): void {
    // Implement approval logic
  }

  rejectItem(itemId: number): void {
    // Implement rejection logic
  }

  // Helper methods
  getEfficiencyClass(efficiency: number): string {
    if (efficiency >= 90) return 'text-success';
    if (efficiency >= 80) return 'text-warning';
    return 'text-danger';
  }

  getApprovalTypeIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'Time Entry': 'ri-time-line',
      'Expense': 'ri-money-dollar-circle-line',
      'Leave Request': 'ri-calendar-check-line',
      'Document': 'ri-file-text-line'
    };
    return icons[type] || 'ri-checkbox-circle-line';
  }

  getCaseStatusClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'Active': 'badge bg-success',
      'In Progress': 'badge bg-primary',
      'Pending': 'badge bg-warning',
      'Closed': 'badge bg-secondary'
    };
    return statusClasses[status] || 'badge bg-secondary';
  }

  refreshDashboard(): void {
    this.loadDashboardData();
  }
}