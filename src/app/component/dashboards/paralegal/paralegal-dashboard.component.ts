import { Component, OnInit, OnDestroy, Input, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { User } from 'src/app/interface/user';
import { ClientService } from 'src/app/service/client.service';
import { UserService } from 'src/app/service/user.service';
import { RbacService } from 'src/app/core/services/rbac.service';
import { AuthService } from 'src/app/services/auth.service';
import { CaseClientService } from 'src/app/service/case-client.service';

@Component({
  selector: 'app-paralegal-dashboard',
  templateUrl: './paralegal-dashboard.component.html',
  styleUrls: ['./paralegal-dashboard.component.css']
})
export class ParalegalDashboardComponent implements OnInit, OnDestroy {

  @Input() currentUser: User | null = null;
  @Input() isDarkMode: boolean = false;

  // Paralegal specific stats
  activeCases = 0;
  documentsToReview = 0;
  tasksToComplete = 0;
  upcomingDeadlines = 0;
  
  // Data collections
  assignedCases: any[] = [];
  recentDocuments: any[] = [];
  upcomingTasks: any[] = [];
  caseDeadlines: any[] = [];
  
  // Loading states
  isLoading = true;
  casesLoading = false;
  documentsLoading = false;
  
  // User ID for loading cases
  userId: number | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private clientService: ClientService,
    private userService: UserService,
    private rbacService: RbacService,
    private authService: AuthService,
    private caseClientService: CaseClientService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.userId = this.currentUser?.id || null;
    console.log('Paralegal Dashboard - User:', this.currentUser);
    console.log('Paralegal Dashboard - User ID:', this.userId);
    this.loadParalegalData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadParalegalData(): void {
    this.isLoading = true;
    
    // Load paralegal's assigned cases
    this.loadAssignedCases();
    this.loadRecentDocuments();
    this.loadUpcomingTasks();
    this.loadCaseDeadlines();
    
    // Set loading to false after initial load
    setTimeout(() => {
      this.isLoading = false;
      this.cdr.detectChanges();
    }, 1000);
  }
  
  private loadAssignedCases(): void {
    if (!this.userId) {
      console.error('No user ID available for loading cases');
      return;
    }
    
    this.casesLoading = true;
    
    // Load cases assigned to this paralegal
    this.caseClientService.getUserCases(this.userId, 0, 10)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Paralegal cases response:', response);
          if (response?.data?.content) {
            this.assignedCases = response.data.content;
            this.activeCases = response.data.totalElements || 0;
          } else if (response?.data) {
            // Handle different response structure
            this.assignedCases = Array.isArray(response.data) ? response.data : [];
            this.activeCases = this.assignedCases.length;
          }
          this.casesLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading paralegal cases:', error);
          this.casesLoading = false;
          // Use fallback data
          this.assignedCases = [
            {
              id: 1,
              caseNumber: 'CASE-2024-001',
              title: 'Smith vs. Jones',
              status: 'Active',
              attorney: 'John Smith',
              role: 'Paralegal',
              lastActivity: new Date()
            },
            {
              id: 2,
              caseNumber: 'CASE-2024-003',
              title: 'ABC Corp Contract Review',
              status: 'In Progress',
              attorney: 'Jane Doe',
              role: 'Paralegal',
              lastActivity: new Date()
            }
          ];
          this.activeCases = this.assignedCases.length;
          this.cdr.detectChanges();
        }
      });
  }
  
  private loadRecentDocuments(): void {
    this.documentsLoading = true;
    
    // Simulated documents for now
    this.recentDocuments = [
      {
        id: 1,
        name: 'Motion Draft v3.docx',
        caseNumber: 'CASE-2024-001',
        type: 'Legal Brief',
        lastModified: new Date('2024-01-20'),
        status: 'Review Pending'
      },
      {
        id: 2,
        name: 'Discovery Documents.pdf',
        caseNumber: 'CASE-2024-003',
        type: 'Discovery',
        lastModified: new Date('2024-01-19'),
        status: 'In Progress'
      }
    ];
    this.documentsToReview = this.recentDocuments.filter(d => d.status === 'Review Pending').length;
    this.documentsLoading = false;
    this.cdr.detectChanges();
  }
  
  private loadUpcomingTasks(): void {
    // Simulated tasks
    this.upcomingTasks = [
      {
        id: 1,
        title: 'File motion with court',
        caseNumber: 'CASE-2024-001',
        dueDate: new Date('2024-01-25'),
        priority: 'High',
        status: 'Pending'
      },
      {
        id: 2,
        title: 'Prepare witness statements',
        caseNumber: 'CASE-2024-003',
        dueDate: new Date('2024-01-26'),
        priority: 'Medium',
        status: 'In Progress'
      }
    ];
    this.tasksToComplete = this.upcomingTasks.filter(t => t.status === 'Pending').length;
    this.cdr.detectChanges();
  }
  
  private loadCaseDeadlines(): void {
    // Simulated deadlines
    this.caseDeadlines = [
      {
        id: 1,
        caseNumber: 'CASE-2024-001',
        description: 'Motion filing deadline',
        date: new Date('2024-01-25'),
        type: 'Court Filing'
      },
      {
        id: 2,
        caseNumber: 'CASE-2024-003',
        description: 'Discovery response due',
        date: new Date('2024-01-30'),
        type: 'Discovery'
      }
    ];
    this.upcomingDeadlines = this.caseDeadlines.length;
    this.cdr.detectChanges();
  }

  // Helper methods for template
  getCurrentTime(): string {
    return new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'America/New_York'
    });
  }

  getWeatherInfo(): string {
    return '72°F Sunny';
  }
  
  // Navigation methods
  navigateToCases(): void {
    this.router.navigate(['/cases']);
  }
  
  navigateToDocuments(): void {
    this.router.navigate(['/documents']);
  }
  
  navigateToTasks(): void {
    this.router.navigate(['/tasks']);
  }
  
  viewCase(caseId: number): void {
    this.router.navigate(['/cases', caseId]);
  }
  
  viewDocument(documentId: number): void {
    this.router.navigate(['/documents', documentId]);
  }
  
  completeTask(taskId: number): void {
    console.log('Completing task:', taskId);
    // Implement task completion logic
  }
  
  // Helper methods
  getCaseStatusClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'Active': 'badge bg-success',
      'In Progress': 'badge bg-primary',
      'Pending': 'badge bg-warning',
      'On Hold': 'badge bg-secondary',
      'Closed': 'badge bg-dark'
    };
    return statusClasses[status] || 'badge bg-secondary';
  }
  
  getTaskPriorityClass(priority: string): string {
    const priorityClasses: { [key: string]: string } = {
      'High': 'text-danger',
      'Medium': 'text-warning',
      'Low': 'text-info'
    };
    return priorityClasses[priority] || 'text-secondary';
  }
  
  getDocumentTypeIcon(type: string): string {
    const typeIcons: { [key: string]: string } = {
      'Legal Brief': 'ri-file-text-line',
      'Discovery': 'ri-search-line',
      'Contract': 'ri-file-contract-line',
      'Evidence': 'ri-folder-shield-line'
    };
    return typeIcons[type] || 'ri-file-line';
  }
  
  refreshDashboard(): void {
    this.loadParalegalData();
  }
} 
 
 
 
 
 
 