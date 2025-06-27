import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil, forkJoin, map, of, catchError } from 'rxjs';

// Services
import { CaseAssignmentService } from '../../../../service/case-assignment.service';
import { CaseTaskService } from '../../../../service/case-task.service';
import { UserService } from '../../../../service/user.service';
import { NotificationService } from '../../../../service/notification.service';
import { LegalCaseService } from '../../../legal/services/legal-case.service';
import { RbacService } from '../../../../core/services/rbac.service';

// Interfaces
import { User } from '../../../../interface/user';
import { CaseAssignment, UserWorkload, CaseRoleType, AssignmentType } from '../../../../interface/case-assignment';
import { CaseTask } from '../../../../interface/case-task';
import { LegalCase, CaseStatus, CasePriority } from '../../../legal/interfaces/case.interface';

// Chart.js
import { Chart, registerables } from 'chart.js';

@Component({
  selector: 'app-case-management-dashboard',
  templateUrl: './case-management-dashboard.component.html',
  styleUrls: ['./case-management-dashboard.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule]
})
export class CaseManagementDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // User data
  currentUser: User | null = null;
  isManager = false;
  isAttorney = false;
  
  // Dashboard data
  activeCases: LegalCase[] = [];
  myAssignments: CaseAssignment[] = [];
  teamMembers: any[] = [];
  recentTasks: CaseTask[] = [];
  
  // Statistics
  stats = {
    totalCases: 0,
    myCases: 0,
    activeTasks: 0,
    overdueTasks: 0,
    teamUtilization: 0,
    averageWorkload: 0
  };
  
  // Filters
  selectedFilter = 'all';
  searchQuery = '';
  selectedTeamMember: string | null = null;
  
  // Loading states
  loading = {
    cases: false,
    assignments: false,
    tasks: false,
    team: false
  };
  
  // Charts
  workloadChart: Chart<'bar', number[], string> | null = null;
  caseDistributionChart: Chart<'doughnut', number[], string> | null = null;

  constructor(
    private caseAssignmentService: CaseAssignmentService,
    private caseTaskService: CaseTaskService,
    private legalCaseService: LegalCaseService,
    private userService: UserService,
    private notificationService: NotificationService,
    private rbacService: RbacService
  ) {
    Chart.register(...registerables);
  }

  ngOnInit(): void {
    this.loadCurrentUser();
    this.checkPermissions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Destroy charts
    if (this.workloadChart) {
      this.workloadChart.destroy();
    }
    if (this.caseDistributionChart) {
      this.caseDistributionChart.destroy();
    }
  }

  private loadCurrentUser(): void {
    this.currentUser = this.userService.getCurrentUser();
    if (this.currentUser) {
      this.loadDashboardData();
    } else {
      this.userService.profile$()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            this.currentUser = response.data.user;
            this.loadDashboardData();
          },
          error: (error) => {
            this.notificationService.onError('Failed to load user information');
            console.error('Error loading user:', error);
          }
        });
    }
  }

  private checkPermissions(): void {
    this.isManager = this.rbacService.isManager();
    this.isAttorney = this.rbacService.isAttorneyLevel();
  }

  private loadDashboardData(): void {
    if (!this.currentUser) return;
    
    // Load all data in parallel
    forkJoin({
      cases: this.loadCases().pipe(
        catchError(error => {
          console.error('Error loading cases:', error);
          return of([]);
        })
      ),
      assignments: this.loadAssignments().pipe(
        catchError(error => {
          console.error('Error loading assignments:', error);
          return of([]);
        })
      ),
      tasks: this.loadTasks().pipe(
        catchError(error => {
          console.error('Error loading tasks:', error);
          return of([]);
        })
      ),
      team: this.isManager ? this.loadTeamData().pipe(
        catchError(error => {
          console.error('Error loading team:', error);
          return of([]);
        })
      ) : of([])
    }).subscribe({
      next: (results) => {
        this.calculateStatistics();
        this.initializeCharts();
        
        // Add sample data for development if no real data
        if (this.activeCases.length === 0) {
          this.addSampleData();
        }
      },
      error: (error) => {
        console.error('Error loading dashboard data:', error);
        this.notificationService.onError('Failed to load dashboard data');
      }
    });
  }

  private loadCases() {
    this.loading.cases = true;
    return this.legalCaseService.getAllCases(0, 20).pipe(
      takeUntil(this.destroy$),
      map((response: any) => {
        // Handle different response formats
        if (response.data) {
          if (response.data.cases) {
            this.activeCases = response.data.cases;
          } else if (response.data.content) {
            this.activeCases = response.data.content;
          } else if (Array.isArray(response.data)) {
            this.activeCases = response.data;
          } else {
            this.activeCases = [];
          }
        } else {
          this.activeCases = [];
        }
        this.loading.cases = false;
        return this.activeCases;
      })
    );
  }

  private loadAssignments() {
    this.loading.assignments = true;
    return this.caseAssignmentService.getUserAssignments(this.currentUser!.id, 0, 100).pipe(
      takeUntil(this.destroy$),
      map((response: any) => {
        this.myAssignments = response.data?.content || response.data || [];
        this.loading.assignments = false;
        return this.myAssignments;
      })
    );
  }

  private loadTasks() {
    this.loading.tasks = true;
    return this.caseTaskService.getUserTasks(this.currentUser!.id, { page: 0, size: 20 }).pipe(
      takeUntil(this.destroy$),
      map((response: any) => {
        console.log('Task response:', response);
        let tasks = [];
        if (response.data) {
          if (response.data.tasks && response.data.tasks.content) {
            tasks = response.data.tasks.content;
          } else if (response.data.content && Array.isArray(response.data.content)) {
            tasks = response.data.content;
          } else if (Array.isArray(response.data)) {
            tasks = response.data;
          }
        }
        
        if (Array.isArray(tasks)) {
          this.recentTasks = tasks.filter((task: CaseTask) => 
            task.status !== 'COMPLETED' && task.status !== 'CANCELLED'
          );
        } else {
          this.recentTasks = [];
        }
        this.loading.tasks = false;
        return this.recentTasks;
      })
    );
  }

  private loadTeamData() {
    this.loading.team = true;
    return this.caseAssignmentService.getTeamWorkload(this.currentUser!.id).pipe(
      takeUntil(this.destroy$),
      map((response: any) => {
        this.teamMembers = response.data || [];
        this.loading.team = false;
        return this.teamMembers;
      })
    );
  }

  private calculateStatistics(): void {
    // Calculate case statistics
    this.stats.totalCases = this.activeCases.filter(c => c.status !== 'CLOSED' && c.status !== 'ARCHIVED').length;
    this.stats.myCases = this.myAssignments.length;
    
    // Calculate task statistics
    this.stats.activeTasks = this.recentTasks.length;
    this.stats.overdueTasks = this.recentTasks.filter(task => {
      if (!task.dueDate) return false;
      return new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED';
    }).length;
    
    // Calculate team statistics
    if (this.teamMembers.length > 0) {
      const totalWorkload = this.teamMembers.reduce((sum, member) => 
        sum + (member.workloadPercentage || 0), 0
      );
      this.stats.averageWorkload = Math.round(totalWorkload / this.teamMembers.length);
      this.stats.teamUtilization = Math.round(
        (this.teamMembers.filter(m => m.workloadPercentage > 0).length / this.teamMembers.length) * 100
      );
    }
  }

  private initializeCharts(): void {
    // Initialize workload chart
    setTimeout(() => {
      this.createWorkloadChart();
      this.createCaseDistributionChart();
    }, 100);
  }

  private createWorkloadChart(): void {
    const canvas = document.getElementById('workloadChart') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (this.workloadChart) {
      this.workloadChart.destroy();
    }

    const teamData = this.teamMembers.slice(0, 10); // Top 10 team members
    
    this.workloadChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: teamData.map(m => m.userName || m.name),
        datasets: [{
          label: 'Workload %',
          data: teamData.map(m => m.workloadPercentage || 0),
          backgroundColor: teamData.map(m => {
            const percentage = m.workloadPercentage || 0;
            if (percentage >= 90) return 'rgba(220, 53, 69, 0.8)';
            if (percentage >= 70) return 'rgba(255, 193, 7, 0.8)';
            return 'rgba(40, 167, 69, 0.8)';
          }),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => `Workload: ${context.parsed.y}%`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: (value) => value + '%'
            }
          }
        }
      }
    });
  }

  private createCaseDistributionChart(): void {
    const canvas = document.getElementById('caseDistributionChart') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (this.caseDistributionChart) {
      this.caseDistributionChart.destroy();
    }

    // Group cases by status
    const statusCounts = this.activeCases.reduce((acc, legalCase) => {
      acc[legalCase.status] = (acc[legalCase.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    this.caseDistributionChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(statusCounts),
        datasets: [{
          data: Object.values(statusCounts),
          backgroundColor: [
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 193, 7, 0.8)',
            'rgba(40, 167, 69, 0.8)',
            'rgba(220, 53, 69, 0.8)',
            'rgba(108, 117, 125, 0.8)'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }

  // Filter methods
  filterCases(): LegalCase[] {
    let filtered = this.activeCases;
    
    // Apply status filter
    if (this.selectedFilter !== 'all') {
      filtered = filtered.filter(c => c.status.toLowerCase() === this.selectedFilter);
    }
    
    // Apply search filter
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.title.toLowerCase().includes(query) ||
        c.caseNumber.toLowerCase().includes(query) ||
        c.clientName.toLowerCase().includes(query)
      );
    }
    
    // Apply team member filter
    if (this.selectedTeamMember) {
      // Filter based on assignments
      const assignedCaseIds = this.myAssignments
        .filter(a => a.userId === Number(this.selectedTeamMember))
        .map(a => a.caseId);
      filtered = filtered.filter(c => assignedCaseIds.includes(Number(c.id)));
    }
    
    return filtered;
  }

  // UI Methods
  getCaseStatusClass(status: string): string {
    const statusClasses: Record<string, string> = {
      'OPEN': 'badge-info',
      'IN_PROGRESS': 'badge-warning',
      'PENDING': 'badge-secondary',
      'CLOSED': 'badge-success',
      'ARCHIVED': 'badge-dark'
    };
    return statusClasses[status] || 'badge-secondary';
  }

  getTaskPriorityClass(priority: string): string {
    const priorityClasses: Record<string, string> = {
      'LOW': 'text-success',
      'MEDIUM': 'text-warning',
      'HIGH': 'text-danger',
      'URGENT': 'text-danger fw-bold'
    };
    return priorityClasses[priority] || 'text-secondary';
  }

  getWorkloadStatusClass(percentage: number): string {
    if (percentage >= 90) return 'text-danger';
    if (percentage >= 70) return 'text-warning';
    return 'text-success';
  }

  isOverdue(dueDate: Date | string): boolean {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  }

  refreshDashboard(): void {
    this.loadDashboardData();
  }

  getAssignedMembers(caseId: string | number): any[] {
    return this.myAssignments.filter(a => a.caseId === caseId);
  }

  assignCase(legalCase: LegalCase): void {
    // TODO: Implement case assignment modal
    this.notificationService.onInfo('Case assignment feature coming soon');
  }

  getWorkloadBadgeClass(percentage: number): string {
    if (percentage >= 90) return 'badge-soft-danger';
    if (percentage >= 70) return 'badge-soft-warning';
    return 'badge-soft-success';
  }

  openAssignmentModal(): void {
    // TODO: Implement assignment modal
    this.notificationService.onInfo('Assignment modal coming soon');
  }
  
  private addSampleData(): void {
    // Add sample data for development
    this.activeCases = [
      {
        id: '1',
        caseNumber: 'CASE-2025-001',
        title: 'Smith vs. Johnson Contract Dispute',
        description: 'Contract breach litigation',
        status: CaseStatus.OPEN,
        priority: CasePriority.HIGH,
        type: 'Contract Litigation',
        clientName: 'John Smith',
        clientEmail: 'john.smith@example.com',
        clientPhone: '555-0123',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        caseNumber: 'CASE-2025-002',
        title: 'Estate Planning - Williams Family',
        description: 'Comprehensive estate planning',
        status: CaseStatus.IN_PROGRESS,
        priority: CasePriority.MEDIUM,
        type: 'Estate Planning',
        clientName: 'Sarah Williams',
        clientEmail: 'sarah.williams@example.com',
        clientPhone: '555-0124',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    this.myAssignments = [
      {
        id: 1,
        caseId: 1,
        caseNumber: 'CASE-2025-001',
        caseTitle: 'Smith vs. Johnson Contract Dispute',
        userId: this.currentUser?.id || 1,
        userName: this.currentUser?.firstName + ' ' + this.currentUser?.lastName || 'Current User',
        userEmail: this.currentUser?.email || 'user@example.com',
        roleType: CaseRoleType.LEAD_ATTORNEY,
        assignmentType: AssignmentType.MANUAL,
        assignedAt: new Date(),
        effectiveFrom: new Date(),
        active: true,
        workloadWeight: 60,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    this.teamMembers = [
      {
        userId: 1,
        userName: 'John Attorney',
        workloadPercentage: 75,
        activeCases: 5
      },
      {
        userId: 2,
        userName: 'Jane Paralegal',
        workloadPercentage: 60,
        activeCases: 8
      }
    ];
    
    this.calculateStatistics();
    this.initializeCharts();
  }
}