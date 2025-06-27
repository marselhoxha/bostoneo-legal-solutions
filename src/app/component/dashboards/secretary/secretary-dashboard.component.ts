import { Component, OnInit, OnDestroy, Input, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { User } from 'src/app/interface/user';
import { RbacService } from 'src/app/core/services/rbac.service';
import { LegalCaseService } from 'src/app/modules/legal/services/legal-case.service';
import { CalendarService } from 'src/app/modules/legal/services/calendar.service';
import { ClientService } from 'src/app/service/client.service';
import { DocumentService } from 'src/app/modules/legal/services/document.service';

// Simple Task interface for dashboard use
interface Task {
  id: number;
  title: string;
  dueDate: string;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Pending' | 'In Progress' | 'Completed';
}

@Component({
  selector: 'app-secretary-dashboard',
  templateUrl: './secretary-dashboard.component.html',
  styleUrls: ['./secretary-dashboard.component.css']
})
export class SecretaryDashboardComponent implements OnInit, OnDestroy {
  @Input() currentUser: User | null = null;
  @Input() isDarkMode: boolean = false;

  // Dashboard metrics
  departmentCases = 0;
  todayAppointments = 0;
  pendingDocuments = 0;
  upcomingDeadlines = 0;
  clientCommunications = 0;
  administrativeTasks = 0;

  // Data collections
  recentCases: any[] = [];
  todaysAppointments: any[] = [];
  pendingDocumentsList: any[] = [];
  upcomingTasks: Task[] = [];
  recentCommunications: any[] = [];
  attorneySchedules: any[] = [];

  // Loading states
  isLoading = true;
  casesLoading = false;
  appointmentsLoading = false;
  documentsLoading = false;
  tasksLoading = false;

  // Department info
  departmentName = '';
  assignedAttorneys: any[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private rbacService: RbacService,
    private caseService: LegalCaseService,
    private calendarService: CalendarService,
    private clientService: ClientService,
    private documentService: DocumentService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadDashboardData(): void {
    this.isLoading = true;
    
    // Load department-specific data
    this.loadDepartmentInfo();
    this.loadDepartmentCases();
    this.loadTodaysAppointments();
    this.loadPendingDocuments();
    this.loadUpcomingTasks();
    this.loadClientCommunications();
    this.loadAttorneySchedules();
    
    // Set loading to false after initial load
    setTimeout(() => {
      this.isLoading = false;
      this.cdr.detectChanges();
    }, 1000);
  }

  private loadDepartmentInfo(): void {
    // For now, use a default department
    this.departmentName = 'Corporate Law';
    this.assignedAttorneys = [
      { id: 1, name: 'John Smith', title: 'Senior Partner' },
      { id: 2, name: 'Jane Doe', title: 'Associate' }
    ];
  }

  private loadDepartmentCases(): void {
    this.casesLoading = true;
    
    this.caseService.getAllCases(0, 10)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.data?.page?.content) {
            this.recentCases = response.data.page.content.slice(0, 5);
            this.departmentCases = response.data.page.totalElements || 0;
          }
          this.casesLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading cases:', error);
          this.casesLoading = false;
          // Use fallback data
          this.departmentCases = 25;
          this.recentCases = [
            { id: 1, caseNumber: 'CASE-2024-001', title: 'Smith vs. Jones', status: 'Active' },
            { id: 2, caseNumber: 'CASE-2024-002', title: 'Corporate Merger ABC', status: 'In Progress' }
          ];
          this.cdr.detectChanges();
        }
      });
  }

  private loadTodaysAppointments(): void {
    this.appointmentsLoading = true;
    
    // Simulated data for appointments
    this.todaysAppointments = [
      { id: 1, time: '9:00 AM', client: 'John Doe', attorney: 'John Smith', type: 'Consultation' },
      { id: 2, time: '11:00 AM', client: 'ABC Corp', attorney: 'Jane Doe', type: 'Meeting' },
      { id: 3, time: '2:00 PM', client: 'Mary Johnson', attorney: 'John Smith', type: 'Deposition' }
    ];
    this.todayAppointments = this.todaysAppointments.length;
    this.appointmentsLoading = false;
    this.cdr.detectChanges();
  }

  private loadPendingDocuments(): void {
    this.documentsLoading = true;
    
    // Simulated pending documents
    this.pendingDocumentsList = [
      { id: 1, name: 'Contract Draft v2', case: 'CASE-2024-001', dueDate: '2024-01-25', status: 'Review' },
      { id: 2, name: 'Motion to Dismiss', case: 'CASE-2024-003', dueDate: '2024-01-26', status: 'Preparation' }
    ];
    this.pendingDocuments = this.pendingDocumentsList.length;
    this.documentsLoading = false;
    this.cdr.detectChanges();
  }

  private loadUpcomingTasks(): void {
    this.tasksLoading = true;
    
    // Simulated tasks using the inline interface
    this.upcomingTasks = [
      { id: 1, title: 'Prepare meeting agenda', dueDate: '2024-01-24', priority: 'High', status: 'Pending' },
      { id: 2, title: 'File court documents', dueDate: '2024-01-25', priority: 'Medium', status: 'In Progress' },
      { id: 3, title: 'Schedule depositions', dueDate: '2024-01-26', priority: 'High', status: 'Pending' }
    ];
    this.administrativeTasks = this.upcomingTasks.length;
    this.upcomingDeadlines = this.upcomingTasks.filter(t => t.priority === 'High').length;
    this.tasksLoading = false;
    this.cdr.detectChanges();
  }

  private loadClientCommunications(): void {
    // Simulated communications
    this.recentCommunications = [
      { id: 1, from: 'John Doe', subject: 'Document Request', time: '10 mins ago', unread: true },
      { id: 2, from: 'ABC Corp', subject: 'Meeting Confirmation', time: '1 hour ago', unread: false }
    ];
    this.clientCommunications = this.recentCommunications.filter(c => c.unread).length;
    this.cdr.detectChanges();
  }

  private loadAttorneySchedules(): void {
    // Simulated attorney schedules
    this.attorneySchedules = this.assignedAttorneys.map(attorney => ({
      ...attorney,
      todaySchedule: [
        { time: '9:00 AM - 10:00 AM', event: 'Client Meeting', status: 'Busy' },
        { time: '10:00 AM - 11:00 AM', event: 'Available', status: 'Free' },
        { time: '11:00 AM - 12:00 PM', event: 'Court Hearing', status: 'Busy' }
      ]
    }));
    this.cdr.detectChanges();
  }

  // Navigation methods
  navigateToCases(): void {
    this.router.navigate(['/cases']);
  }

  navigateToCalendar(): void {
    this.router.navigate(['/calendar']);
  }

  navigateToDocuments(): void {
    this.router.navigate(['/documents']);
  }

  navigateToTasks(): void {
    this.router.navigate(['/tasks']);
  }

  navigateToCommunications(): void {
    this.router.navigate(['/communications']);
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

  scheduleAppointment(): void {
    this.router.navigate(['/calendar/new-appointment']);
  }

  // Helper methods
  getCaseStatusClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'Active': 'badge bg-success',
      'In Progress': 'badge bg-primary',
      'Pending': 'badge bg-warning',
      'Closed': 'badge bg-secondary'
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

  getScheduleStatusClass(status: string): string {
    return status === 'Busy' ? 'text-danger' : 'text-success';
  }

  refreshDashboard(): void {
    this.loadDashboardData();
  }
}