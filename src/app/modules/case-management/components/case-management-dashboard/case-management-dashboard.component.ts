import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, forkJoin, map, of, catchError, finalize } from 'rxjs';

// Services
import { CaseAssignmentService } from '../../../../service/case-assignment.service';
import { CaseTaskService } from '../../../../service/case-task.service';
import { UserService } from '../../../../service/user.service';
import { NotificationService } from '../../../../service/notification.service';
import { LegalCaseService } from '../../../legal/services/legal-case.service';
import { RbacService } from '../../../../core/services/rbac.service';

// Interfaces
import { User } from '../../../../interface/user';
import { CaseAssignment, CaseRoleType, AssignmentType } from '../../../../interface/case-assignment';
import { CaseTask } from '../../../../interface/case-task';
import { LegalCase, CaseStatus, CasePriority } from '../../../legal/interfaces/case.interface';

// Chart.js
import { Chart, registerables } from 'chart.js';

@Component({
  selector: 'app-case-management-dashboard',
  templateUrl: './case-management-dashboard.component.html',
  styleUrls: ['./case-management-dashboard.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
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
  casePipelineChart: Chart<'bar', number[], string> | null = null;
  taskCompletionChart: Chart<'doughnut', number[], string> | null = null;
  teamCapacityChart: Chart<'bar', number[], string> | null = null;

  // Task statistics for completion rate
  taskStats = {
    total: 0,
    completed: 0,
    inProgress: 0,
    overdue: 0,
    completionRate: 0
  };

  // Global loading state
  isLoading = true;

  constructor(
    private caseAssignmentService: CaseAssignmentService,
    private caseTaskService: CaseTaskService,
    private legalCaseService: LegalCaseService,
    private userService: UserService,
    private notificationService: NotificationService,
    private rbacService: RbacService,
    private cdr: ChangeDetectorRef
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
    if (this.casePipelineChart) {
      this.casePipelineChart.destroy();
    }
    if (this.taskCompletionChart) {
      this.taskCompletionChart.destroy();
    }
    if (this.teamCapacityChart) {
      this.teamCapacityChart.destroy();
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
            this.cdr.markForCheck();
            this.loadDashboardData();
          },
          error: (error) => {
            this.notificationService.onError('Failed to load user information');
            console.error('Error loading user:', error);
            this.isLoading = false;
            this.cdr.markForCheck();
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

    this.isLoading = true;
    this.cdr.markForCheck();

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
    }).pipe(
      finalize(() => {
        this.isLoading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (results) => {
        // Generate team workload from cases if not already populated
        if (this.teamMembers.length === 0 && this.activeCases.length > 0) {
          this.generateTeamWorkloadFromCases();
        }

        this.calculateStatistics();

        // Delay chart initialization to ensure DOM is ready
        setTimeout(() => {
          this.initializeCharts();
          this.cdr.markForCheck();
        }, 150);

        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error loading dashboard data:', error);
        this.notificationService.onError('Failed to load dashboard data');
        this.cdr.markForCheck();
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
        this.cdr.markForCheck();
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
        this.cdr.markForCheck();
        return this.myAssignments;
      })
    );
  }

  private loadTasks() {
    this.loading.tasks = true;
    return this.caseTaskService.getUserTasks(this.currentUser!.id, { page: 0, size: 20 }).pipe(
      takeUntil(this.destroy$),
      map((response: any) => {
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
        this.cdr.markForCheck();
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

        // If API returns empty, generate workload from case data
        if (this.teamMembers.length === 0) {
          this.generateTeamWorkloadFromCases();
        }

        this.loading.team = false;
        this.cdr.markForCheck();
        return this.teamMembers;
      }),
      catchError(error => {
        console.error('Error loading team workload:', error);
        // Fallback: generate from case data
        this.generateTeamWorkloadFromCases();
        this.loading.team = false;
        this.cdr.markForCheck();
        return of(this.teamMembers);
      })
    );
  }

  /**
   * Generate team workload from active cases when API doesn't return data
   */
  private generateTeamWorkloadFromCases(): void {
    // Group cases by assigned attorney/lead
    const workloadMap = new Map<string, { userId: number; userName: string; activeCases: number; caseTypes: string[] }>();

    this.activeCases.forEach(legalCase => {
      // Use clientName as a proxy for attorney assignment (or you could use a leadAttorney field)
      const assignee = (legalCase as any).leadAttorneyName || (legalCase as any).assignedTo || this.currentUser?.firstName + ' ' + this.currentUser?.lastName || 'Unassigned';
      const assigneeId = (legalCase as any).leadAttorneyId || (legalCase as any).assignedToId || this.currentUser?.id || 0;

      if (!workloadMap.has(assignee)) {
        workloadMap.set(assignee, {
          userId: assigneeId,
          userName: assignee,
          activeCases: 0,
          caseTypes: []
        });
      }

      const entry = workloadMap.get(assignee)!;
      entry.activeCases++;
      if (legalCase.type && !entry.caseTypes.includes(legalCase.type)) {
        entry.caseTypes.push(legalCase.type);
      }
    });

    // Convert to array and calculate workload percentage
    // Assuming 10 cases = 100% workload
    const maxCasesPerPerson = 10;
    this.teamMembers = Array.from(workloadMap.values()).map(member => ({
      ...member,
      workloadPercentage: Math.min(Math.round((member.activeCases / maxCasesPerPerson) * 100), 100)
    }));

    // If still empty, add current user as fallback
    if (this.teamMembers.length === 0 && this.currentUser) {
      this.teamMembers = [{
        userId: this.currentUser.id,
        userName: `${this.currentUser.firstName} ${this.currentUser.lastName}`,
        activeCases: this.activeCases.length,
        workloadPercentage: Math.min(Math.round((this.activeCases.length / maxCasesPerPerson) * 100), 100)
      }];
    }
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
    // Initialize all charts with slight delay to ensure DOM is ready
    setTimeout(() => {
      this.calculateTaskStats();
      this.createCasePipelineChart();
      this.createTaskCompletionChart();
      this.createTeamCapacityChart();
    }, 100);
  }

  /**
   * Calculate task statistics for the completion rate chart
   */
  private calculateTaskStats(): void {
    // Get all tasks (including completed for accurate stats)
    const allTasks = this.recentTasks;
    const completedTasks = allTasks.filter(t => t.status === 'COMPLETED');
    const inProgressTasks = allTasks.filter(t => t.status === 'IN_PROGRESS');
    const overdueTasks = allTasks.filter(t => {
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < new Date() && t.status !== 'COMPLETED';
    });

    // For a more meaningful completion rate, we'll use completed vs total assigned
    const totalAssigned = allTasks.length + completedTasks.length; // Include completed in total
    this.taskStats = {
      total: totalAssigned || allTasks.length,
      completed: completedTasks.length,
      inProgress: inProgressTasks.length,
      overdue: overdueTasks.length,
      completionRate: totalAssigned > 0
        ? Math.round((completedTasks.length / totalAssigned) * 100)
        : 0
    };
  }

  /**
   * Case Pipeline Chart - Horizontal funnel showing cases through stages
   */
  private createCasePipelineChart(): void {
    const canvas = document.getElementById('casePipelineChart') as HTMLCanvasElement;
    if (!canvas) {
      setTimeout(() => this.createCasePipelineChart(), 200);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (this.casePipelineChart) {
      this.casePipelineChart.destroy();
      this.casePipelineChart = null;
    }

    // Define pipeline stages in order
    const stages = ['OPEN', 'IN_PROGRESS', 'PENDING', 'CLOSED'];
    const stageLabels = ['Open', 'In Progress', 'Pending', 'Closed'];
    const stageColors = [
      'rgba(54, 162, 235, 0.85)',   // Blue - Open
      'rgba(255, 193, 7, 0.85)',    // Yellow - In Progress
      'rgba(108, 117, 125, 0.85)',  // Gray - Pending
      'rgba(40, 167, 69, 0.85)'     // Green - Closed
    ];

    // Count cases in each stage
    const stageCounts = stages.map(stage =>
      this.activeCases.filter(c => c.status === stage).length
    );

    // If no cases, don't create chart
    if (stageCounts.every(count => count === 0)) {
      return;
    }

    this.casePipelineChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: stageLabels,
        datasets: [{
          label: 'Cases',
          data: stageCounts,
          backgroundColor: stageColors,
          borderRadius: 6,
          borderWidth: 0,
          barThickness: 35
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const total = stageCounts.reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? Math.round((context.parsed.x / total) * 100) : 0;
                return `${context.parsed.x} cases (${percentage}%)`;
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: {
              display: true,
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              stepSize: 1,
              precision: 0
            }
          },
          y: {
            grid: {
              display: false
            }
          }
        }
      }
    });
  }

  /**
   * Task Completion Rate Chart - Radial gauge showing progress
   */
  private createTaskCompletionChart(): void {
    const canvas = document.getElementById('taskCompletionChart') as HTMLCanvasElement;
    if (!canvas) {
      setTimeout(() => this.createTaskCompletionChart(), 200);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (this.taskCompletionChart) {
      this.taskCompletionChart.destroy();
      this.taskCompletionChart = null;
    }

    const completionRate = this.taskStats.completionRate;
    const remaining = 100 - completionRate;

    // Color based on completion rate
    let completionColor = 'rgba(40, 167, 69, 0.85)'; // Green for good
    if (completionRate < 50) {
      completionColor = 'rgba(220, 53, 69, 0.85)'; // Red for low
    } else if (completionRate < 75) {
      completionColor = 'rgba(255, 193, 7, 0.85)'; // Yellow for medium
    }

    this.taskCompletionChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Completed', 'Remaining'],
        datasets: [{
          data: [completionRate, remaining],
          backgroundColor: [completionColor, 'rgba(233, 236, 239, 0.5)'],
          borderWidth: 0,
          circumference: 270,
          rotation: 225
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: false
          }
        }
      }
    });
  }

  /**
   * Team Capacity Chart - Horizontal bars showing available capacity
   */
  private createTeamCapacityChart(): void {
    const canvas = document.getElementById('teamCapacityChart') as HTMLCanvasElement;
    if (!canvas) {
      setTimeout(() => this.createTeamCapacityChart(), 200);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (this.teamCapacityChart) {
      this.teamCapacityChart.destroy();
      this.teamCapacityChart = null;
    }

    const teamData = this.teamMembers.slice(0, 6); // Top 6 team members

    // If no team data, don't create chart
    if (teamData.length === 0) {
      return;
    }

    // Calculate available capacity (100 - workload)
    const capacityData = teamData.map(m => 100 - (m.workloadPercentage || 0));

    this.teamCapacityChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: teamData.map(m => this.truncateName(m.userName || m.name || 'Unknown')),
        datasets: [
          {
            label: 'Used',
            data: teamData.map(m => m.workloadPercentage || 0),
            backgroundColor: teamData.map(m => {
              const percentage = m.workloadPercentage || 0;
              if (percentage >= 90) return 'rgba(220, 53, 69, 0.85)';
              if (percentage >= 70) return 'rgba(255, 193, 7, 0.85)';
              return 'rgba(40, 167, 69, 0.85)';
            }),
            borderRadius: { topLeft: 4, bottomLeft: 4 },
            borderWidth: 0
          },
          {
            label: 'Available',
            data: capacityData,
            backgroundColor: 'rgba(233, 236, 239, 0.6)',
            borderRadius: { topRight: 4, bottomRight: 4 },
            borderWidth: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 15,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const member = teamData[context.dataIndex];
                if (context.datasetIndex === 0) {
                  return `Used: ${context.parsed.x}% (${member.activeCases || 0} cases)`;
                }
                return `Available: ${context.parsed.x}%`;
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: (value) => value + '%'
            },
            grid: {
              display: true,
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          y: {
            stacked: true,
            grid: {
              display: false
            }
          }
        }
      }
    });
  }

  /**
   * Helper to truncate long names for chart labels
   */
  private truncateName(name: string, maxLength: number = 12): string {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 2) + '...';
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
  

  // Helper methods
  getPriorityBadgeClass(priority: string): string {
    const classes: Record<string, string> = {
      'LOW': 'bg-info-subtle text-info',
      'MEDIUM': 'bg-warning-subtle text-warning',
      'HIGH': 'bg-danger-subtle text-danger',
      'URGENT': 'bg-danger text-white'
    };
    return classes[priority] || 'bg-secondary-subtle text-secondary';
  }

  getTaskStatusBadgeClass(status: string): string {
    const classes: Record<string, string> = {
      'TODO': 'bg-secondary-subtle text-secondary',
      'IN_PROGRESS': 'bg-primary-subtle text-primary',
      'REVIEW': 'bg-info-subtle text-info',
      'COMPLETED': 'bg-success-subtle text-success',
      'CANCELLED': 'bg-dark-subtle text-dark'
    };
    return classes[status] || 'bg-secondary-subtle text-secondary';
  }

  formatCaseStatus(status: string): string {
    if (!status) return '-';
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}