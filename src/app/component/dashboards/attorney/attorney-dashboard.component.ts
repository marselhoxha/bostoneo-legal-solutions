import { Component, OnInit, OnDestroy, Input, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { User } from 'src/app/interface/user';
import { CaseService } from 'src/app/modules/legal/services/case.service';
import { TimeTrackingService, TimeEntry } from 'src/app/modules/time-tracking/services/time-tracking.service';
import { CalendarService } from 'src/app/modules/legal/services/calendar.service';
import { RbacService } from 'src/app/core/services/rbac.service';

interface DashboardCase {
  id: number;
  caseNumber: string;
  title: string;
  clientName: string;
  caseType: string;
  status: string;
  nextAction: string;
  nextActionDate: string;
  priority: 'high' | 'medium' | 'low';
}

interface CalendarEvent {
  id: number;
  title: string;
  start: string;
  end: string;
  type: string;
  caseNumber?: string;
  location?: string;
  leftPosition?: number;
  widthPercent?: number;
}

interface WeekDay {
  label: string;
  hours: number;
  percentage: number;
  isToday: boolean;
}

interface ActivityItem {
  id: number;
  type: 'filing' | 'document' | 'communication' | 'court' | 'deadline' | 'billing' | 'task';
  title: string;
  description: string;
  timestamp: Date;
  caseNumber?: string;
  caseName?: string;
  clientName?: string;
  icon: string;
  color: string;
  displayType?: string;
  route?: string;
  metadata?: {
    amount?: number;
    hours?: number;
    dueDate?: string;
    documentName?: string;
  };
}

interface ScheduleEvent {
  id: number;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  duration: string;
  type: 'consultation' | 'hearing' | 'review' | 'meeting' | 'deposition';
  client?: string;
  location?: string;
  meetingType?: 'video' | 'in-person';
  caseInfo?: string;
  caseId?: number;
}

interface UrgentItem {
  id: number;
  title: string;
  description: string;
  type: 'deadline' | 'document' | 'message' | 'task' | 'billing';
  priority: 'critical' | 'high' | 'medium';
  dueLabel: string;
  caseNumber?: string;
  caseId?: number;
  client?: string;
  route?: string;
}

@Component({
  selector: 'app-attorney-dashboard',
  templateUrl: './attorney-dashboard.component.html',
  styleUrls: ['./attorney-dashboard.component.scss']
})
export class AttorneyDashboardComponent implements OnInit, OnDestroy {

  @Input() currentUser: User | null = null;
  @Input() isDarkMode: boolean = false;

  // Loading states
  isLoading = true;
  casesLoading = true;
  timeLoading = true;
  eventsLoading = true;

  // Stats
  activeCasesCount = 0;
  todayHours = 0;
  weekHours = 0;
  thisWeekEvents = 0;
  pendingItems = 0;
  unbilledAmount = 0;

  // Data arrays
  recentCases: DashboardCase[] = [];
  todayEvents: CalendarEvent[] = [];
  recentActivity: ActivityItem[] = [];
  todayTimeEntries: TimeEntry[] = [];

  // Urgent items
  urgentDeadlines: any[] = [];
  pendingReviews: any[] = [];

  // Chart data
  weekDays: WeekDay[] = [];
  timelineHours: string[] = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

  // Schedule events
  scheduleEvents: ScheduleEvent[] = [];

  // Urgent items
  urgentItems: UrgentItem[] = [];

  // Expand/collapse states
  showAllActivities = false;
  showAllUrgentItems = false;
  showAllCases = false;

  currentDate = new Date();
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private caseService: CaseService,
    private timeTrackingService: TimeTrackingService,
    private calendarService: CalendarService,
    private rbacService: RbacService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.initializeWeekDays();
    this.initializeScheduleEvents();
    this.initializeUrgentItems();
    this.loadDashboardData();
  }

  private initializeUrgentItems(): void {
    // Sample urgent items - in production, load from API
    this.urgentItems = [
      {
        id: 1,
        title: 'Court Filing Due',
        description: 'Motion Response - Smith vs. Johnson',
        type: 'deadline',
        priority: 'critical',
        dueLabel: '2 days',
        caseNumber: '#2025-CV-1234',
        caseId: 1,
        route: '/legal/cases/1'
      },
      {
        id: 2,
        title: 'Contract Review',
        description: '3 contracts pending your approval',
        type: 'document',
        priority: 'high',
        dueLabel: 'Today',
        client: 'ABC Corporation',
        route: '/legal/documents'
      },
      {
        id: 3,
        title: 'Client Response Needed',
        description: 'John Doe awaiting update on case status',
        type: 'message',
        priority: 'medium',
        dueLabel: 'New',
        client: 'John Doe',
        caseNumber: '#2025-CV-5678',
        route: '/legal/messages'
      },
      {
        id: 4,
        title: 'Discovery Deadline',
        description: 'Interrogatories due for Williams case',
        type: 'deadline',
        priority: 'high',
        dueLabel: '5 days',
        caseNumber: '#2025-CV-9012',
        caseId: 3,
        route: '/legal/cases/3'
      },
      {
        id: 5,
        title: 'Invoice Overdue',
        description: 'Payment pending from Tech Solutions',
        type: 'billing',
        priority: 'medium',
        dueLabel: '10 days',
        client: 'Tech Solutions Inc.',
        route: '/billing'
      },
      {
        id: 6,
        title: 'Hearing Preparation',
        description: 'Prepare exhibits for Davis hearing',
        type: 'task',
        priority: 'high',
        dueLabel: 'Tomorrow',
        caseNumber: '#2025-CV-3456',
        caseId: 4,
        route: '/legal/cases/4'
      }
    ];
  }

  private initializeScheduleEvents(): void {
    // Sample schedule events - in production, load from CalendarService
    this.scheduleEvents = [
      {
        id: 1,
        title: 'Client Consultation',
        description: 'Initial Case Review',
        startTime: '9:00 AM',
        endTime: '10:00 AM',
        duration: '1 hr',
        type: 'consultation',
        client: 'John Doe',
        meetingType: 'video'
      },
      {
        id: 2,
        title: 'Motion Hearing',
        description: 'Smith vs. Johnson',
        startTime: '2:00 PM',
        endTime: '3:30 PM',
        duration: 'Court',
        type: 'hearing',
        location: 'Courtroom 4B',
        caseInfo: 'Motion for Summary Judgment',
        caseId: 1
      },
      {
        id: 3,
        title: 'Document Review',
        description: 'Contract Analysis',
        startTime: '4:30 PM',
        endTime: '6:00 PM',
        duration: '1.5 hrs',
        type: 'review',
        client: 'ABC Corporation'
      }
    ];
  }

  private initializeWeekDays(): void {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date().getDay();

    this.weekDays = days.map((label, index) => ({
      label,
      hours: 0,
      percentage: 0,
      isToday: index === today
    }));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadDashboardData(): void {
    this.isLoading = true;

    // Load cases first, then time entries
    this.loadCases();
    this.loadTimeEntries();
    this.loadTodayEvents();
  }

  private loadCases(): void {
    this.casesLoading = true;
    this.caseService.getCases(0, 100).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error loading cases:', error);
        return of({ data: { cases: [], page: { totalElements: 0 } } });
      })
    ).subscribe({
      next: (response: any) => {
        const cases = response?.data?.cases || [];
        this.activeCasesCount = cases.filter((c: any) =>
          c.status === 'ACTIVE' || c.status === 'IN_PROGRESS' || c.status === 'OPEN'
        ).length || cases.length;

        // Map to dashboard format
        this.recentCases = cases.slice(0, 10).map((c: any) => ({
          id: c.id,
          caseNumber: c.caseNumber || `#${c.id}`,
          title: c.title || c.caseName || 'Untitled Case',
          clientName: c.clientName || c.client?.name || 'Unknown Client',
          caseType: c.caseType || c.type || 'General',
          status: c.status || 'Active',
          nextAction: c.nextAction || 'Review case',
          nextActionDate: c.nextActionDate || c.nextHearing || '',
          priority: this.determinePriority(c)
        }));

        // Calculate pending items
        this.pendingItems = cases.filter((c: any) =>
          c.status === 'PENDING_REVIEW' || c.requiresAction
        ).length;

        this.casesLoading = false;
        this.isLoading = false;
        this.loadRecentActivity();
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error processing cases:', error);
        this.casesLoading = false;
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private loadTimeEntries(): void {
    this.timeLoading = true;
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const todayStr = today.toISOString().split('T')[0];
    const weekStartStr = startOfWeek.toISOString().split('T')[0];

    this.timeTrackingService.getTimeEntries({
      startDate: weekStartStr,
      endDate: todayStr,
      size: 100
    }).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error loading time entries:', error);
        return of({ data: { content: [] } });
      })
    ).subscribe({
      next: (response: any) => {
        const entries = response?.data?.content || response?.data?.timeEntries || [];

        // Calculate today's hours
        this.todayTimeEntries = entries.filter((e: TimeEntry) =>
          e.date === todayStr
        );
        this.todayHours = this.todayTimeEntries.reduce((sum, e) => sum + (e.hours || 0), 0);

        // Calculate week hours
        this.weekHours = entries.reduce((sum: number, e: TimeEntry) => sum + (e.hours || 0), 0);

        // Calculate unbilled amount
        const unbilledEntries = entries.filter((e: TimeEntry) =>
          e.status !== 'BILLED' && e.status !== 'INVOICED' && e.billable
        );
        this.unbilledAmount = unbilledEntries.reduce((sum: number, e: TimeEntry) =>
          sum + ((e.hours || 0) * (e.rate || 0)), 0
        );

        // Update week days chart data
        this.updateWeekDaysChart(entries);

        this.timeLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error processing time entries:', error);
        this.timeLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private updateWeekDaysChart(entries: TimeEntry[]): void {
    const maxHours = 10; // Scale for chart

    entries.forEach((entry: TimeEntry) => {
      if (entry.date) {
        const entryDate = new Date(entry.date);
        const dayIndex = entryDate.getDay();
        if (this.weekDays[dayIndex]) {
          this.weekDays[dayIndex].hours += entry.hours || 0;
        }
      }
    });

    // Calculate percentages
    this.weekDays.forEach(day => {
      day.percentage = Math.min((day.hours / maxHours) * 100, 100);
    });
  }

  private loadTodayEvents(): void {
    this.eventsLoading = true;
    // Initialize with empty - calendar events can be loaded from CalendarService if available
    this.todayEvents = [];
    this.thisWeekEvents = 0;
    this.eventsLoading = false;
  }

  private loadRecentActivity(): void {
    // Activity log - what has happened in the app
    this.recentActivity = [
      {
        id: 1,
        type: 'document',
        title: 'Document Uploaded',
        description: 'Motion_Response_Final.pdf added to Smith vs. Johnson',
        timestamp: new Date(Date.now() - 1800000), // 30 min ago
        caseNumber: '#2025-CV-1234',
        icon: 'ri-upload-2-line',
        color: 'primary',
        displayType: 'Upload',
        route: '/legal/cases/1'
      },
      {
        id: 2,
        type: 'billing',
        title: 'Time Entry Logged',
        description: '2.5 hours - Legal research for Williams Estate case',
        timestamp: new Date(Date.now() - 3600000), // 1 hr ago
        caseNumber: '#2025-CV-9012',
        icon: 'ri-time-line',
        color: 'success',
        displayType: 'Time',
        route: '/time-tracking'
      },
      {
        id: 3,
        type: 'task',
        title: 'Note Added',
        description: 'Added case notes to Johnson corporate matter',
        timestamp: new Date(Date.now() - 5400000), // 1.5 hrs ago
        clientName: 'ABC Corporation',
        icon: 'ri-sticky-note-line',
        color: 'info',
        displayType: 'Note',
        route: '/legal/cases/2'
      },
      {
        id: 4,
        type: 'filing',
        title: 'Case Status Updated',
        description: 'Smith vs. Johnson moved to Discovery phase',
        timestamp: new Date(Date.now() - 7200000), // 2 hrs ago
        caseNumber: '#2025-CV-1234',
        icon: 'ri-refresh-line',
        color: 'warning',
        displayType: 'Update',
        route: '/legal/cases/1'
      },
      {
        id: 5,
        type: 'document',
        title: 'Document Viewed',
        description: 'Opened Contract_Draft_v2.docx',
        timestamp: new Date(Date.now() - 10800000), // 3 hrs ago
        clientName: 'Tech Solutions Inc.',
        icon: 'ri-eye-line',
        color: 'secondary',
        displayType: 'View',
        route: '/legal/documents'
      },
      {
        id: 6,
        type: 'filing',
        title: 'Case Created',
        description: 'New case opened for Martinez family',
        timestamp: new Date(Date.now() - 14400000), // 4 hrs ago
        caseNumber: '#2025-CV-7890',
        icon: 'ri-folder-add-line',
        color: 'success',
        displayType: 'New',
        route: '/legal/cases/5'
      },
      {
        id: 7,
        type: 'communication',
        title: 'Email Sent',
        description: 'Sent settlement proposal to opposing counsel',
        timestamp: new Date(Date.now() - 18000000), // 5 hrs ago
        caseNumber: '#2025-CV-1234',
        icon: 'ri-mail-send-line',
        color: 'info',
        displayType: 'Email',
        route: '/legal/cases/1'
      }
    ];
  }

  private determinePriority(caseData: any): 'high' | 'medium' | 'low' {
    if (caseData.priority === 'HIGH' || caseData.isUrgent) return 'high';
    if (caseData.priority === 'LOW') return 'low';
    return 'medium';
  }

  // Navigation methods
  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  viewCase(caseId: number): void {
    this.router.navigate(['/legal/cases', caseId]);
  }

  openNewTimeEntry(): void {
    this.router.navigate(['/time-tracking/entry/new']);
  }

  openAIWorkspace(): void {
    this.router.navigate(['/legal/ai-assistant/ai-workspace']);
  }

  openFileManager(): void {
    this.router.navigate(['/file-manager']);
  }

  openCalendar(): void {
    this.router.navigate(['/legal/calendar']);
  }

  // Formatting helpers
  getCurrentDateFormatted(): string {
    return this.currentDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  getCurrentDayFormatted(): string {
    return this.currentDate.toLocaleDateString('en-US', {
      weekday: 'long'
    });
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  formatHours(hours: number): string {
    return hours.toFixed(1);
  }

  getStatusBadgeClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'ACTIVE': 'bg-success-subtle text-success',
      'IN_PROGRESS': 'bg-info-subtle text-info',
      'OPEN': 'bg-primary-subtle text-primary',
      'PENDING': 'bg-warning-subtle text-warning',
      'PENDING_REVIEW': 'bg-warning-subtle text-warning',
      'CLOSED': 'bg-secondary-subtle text-secondary',
      'ON_HOLD': 'bg-dark-subtle text-dark'
    };
    return statusMap[status?.toUpperCase()] || 'bg-secondary-subtle text-secondary';
  }

  getCaseTypeColor(type: string): string {
    const typeMap: { [key: string]: string } = {
      'CRIMINAL': 'danger',
      'CIVIL': 'info',
      'FAMILY': 'warning',
      'CORPORATE': 'primary',
      'REAL_ESTATE': 'success',
      'IMMIGRATION': 'purple'
    };
    return typeMap[type?.toUpperCase()] || 'secondary';
  }

  getPriorityClass(priority: string): string {
    const priorityMap: { [key: string]: string } = {
      'high': 'border-danger',
      'medium': 'border-warning',
      'low': 'border-success'
    };
    return priorityMap[priority] || '';
  }

  getActivityIcon(type: string): string {
    const iconMap: { [key: string]: string } = {
      'case_update': 'ri-briefcase-4-line',
      'document': 'ri-file-text-line',
      'note': 'ri-sticky-note-line',
      'assignment': 'ri-user-add-line'
    };
    return iconMap[type] || 'ri-information-line';
  }

  getApprovalTypeIcon(type: string): string {
    const iconMap: { [key: string]: string } = {
      'case_update': 'ri-briefcase-4-line',
      'document': 'ri-file-text-line',
      'note': 'ri-time-line',
      'assignment': 'ri-user-add-line'
    };
    return iconMap[type] || 'ri-information-line';
  }

  getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  getStageClass(status: string): string {
    const stageMap: { [key: string]: string } = {
      'ACTIVE': 'stage-onboarding',
      'IN_PROGRESS': 'stage-research',
      'OPEN': 'stage-onboarding',
      'PENDING': 'stage-research',
      'PENDING_REVIEW': 'stage-research',
      'CLOSED': 'stage-closed',
      'ON_HOLD': 'stage-hold',
      'TRIAL': 'stage-trial'
    };
    return stageMap[status?.toUpperCase()] || 'stage-default';
  }

  refreshData(): void {
    this.initializeWeekDays();
    this.loadDashboardData();
  }

  toggleShowAllActivities(): void {
    this.showAllActivities = !this.showAllActivities;
  }

  toggleShowAllUrgentItems(): void {
    this.showAllUrgentItems = !this.showAllUrgentItems;
  }

  getVisibleActivities(): ActivityItem[] {
    return this.showAllActivities ? this.recentActivity : this.recentActivity.slice(0, 4);
  }

  getVisibleUrgentItems(): UrgentItem[] {
    return this.showAllUrgentItems ? this.urgentItems : this.urgentItems.slice(0, 4);
  }

  toggleShowAllCases(): void {
    this.showAllCases = !this.showAllCases;
  }

  getVisibleCases(): DashboardCase[] {
    return this.showAllCases ? this.recentCases.slice(0, 6) : this.recentCases.slice(0, 3);
  }

  // Schedule event helpers
  getTotalScheduledHours(): string {
    // Calculate total hours from events
    let totalMinutes = 0;
    this.scheduleEvents.forEach(event => {
      // Parse duration strings like "1 hr", "1.5 hrs", "Court"
      const duration = event.duration.toLowerCase();
      if (duration.includes('hr')) {
        const hours = parseFloat(duration);
        if (!isNaN(hours)) {
          totalMinutes += hours * 60;
        }
      }
    });
    const hours = totalMinutes / 60;
    return hours.toFixed(1);
  }

  onEventClick(event: ScheduleEvent): void {
    if (event.caseId) {
      this.router.navigate(['/legal/cases', event.caseId]);
    } else {
      this.openCalendar();
    }
  }

  getEventHeaderClass(type: string): string {
    const classMap: { [key: string]: string } = {
      'consultation': 'bg-success text-white',
      'hearing': 'bg-warning text-dark',
      'review': 'bg-info text-white',
      'meeting': 'bg-primary text-white',
      'deposition': 'bg-secondary text-white'
    };
    return classMap[type] || 'bg-secondary text-white';
  }

  getEventBadgeClass(type: string): string {
    const classMap: { [key: string]: string } = {
      'consultation': 'bg-white text-success',
      'hearing': 'bg-dark text-white',
      'review': 'bg-white text-info',
      'meeting': 'bg-white text-primary',
      'deposition': 'bg-white text-secondary'
    };
    return classMap[type] || 'bg-white text-secondary';
  }

  getEventIconBgClass(type: string): string {
    const classMap: { [key: string]: string } = {
      'consultation': 'bg-success-subtle text-success',
      'hearing': 'bg-warning text-white',
      'review': 'bg-info-subtle text-info',
      'meeting': 'bg-primary-subtle text-primary',
      'deposition': 'bg-secondary-subtle text-secondary'
    };
    return classMap[type] || 'bg-secondary-subtle text-secondary';
  }

  getEventIcon(type: string): string {
    const iconMap: { [key: string]: string } = {
      'consultation': 'ri-user-3-line',
      'hearing': 'ri-scales-3-line',
      'review': 'ri-file-text-line',
      'meeting': 'ri-team-line',
      'deposition': 'ri-quill-pen-line'
    };
    return iconMap[type] || 'ri-calendar-event-line';
  }

  getEventButtonClass(type: string): string {
    const classMap: { [key: string]: string } = {
      'consultation': 'btn-soft-success',
      'hearing': 'btn-soft-warning',
      'review': 'btn-soft-info',
      'meeting': 'btn-soft-primary',
      'deposition': 'btn-soft-secondary'
    };
    return classMap[type] || 'btn-soft-secondary';
  }

  // Urgent item helpers
  onUrgentItemClick(item: UrgentItem): void {
    if (item.route) {
      this.router.navigate([item.route]);
    } else if (item.caseId) {
      this.router.navigate(['/legal/cases', item.caseId]);
    }
  }

  getUrgentItemBgClass(priority: string): string {
    const classMap: { [key: string]: string } = {
      'critical': 'bg-danger-subtle',
      'high': 'bg-warning-subtle',
      'medium': 'bg-info-subtle'
    };
    return classMap[priority] || 'bg-light';
  }

  getUrgentItemIconClass(priority: string): string {
    const classMap: { [key: string]: string } = {
      'critical': 'bg-danger text-white',
      'high': 'bg-warning text-dark',
      'medium': 'bg-info text-white'
    };
    return classMap[priority] || 'bg-secondary text-white';
  }

  getUrgentItemIcon(type: string): string {
    const iconMap: { [key: string]: string } = {
      'deadline': 'ri-calendar-todo-line',
      'document': 'ri-file-text-line',
      'message': 'ri-mail-line',
      'task': 'ri-checkbox-circle-line',
      'billing': 'ri-money-dollar-circle-line'
    };
    return iconMap[type] || 'ri-alert-line';
  }

  getUrgentItemBadgeClass(priority: string): string {
    const classMap: { [key: string]: string } = {
      'critical': 'bg-danger',
      'high': 'bg-warning text-dark',
      'medium': 'bg-info'
    };
    return classMap[priority] || 'bg-secondary';
  }

  getUrgentItemButtonClass(priority: string): string {
    const classMap: { [key: string]: string } = {
      'critical': 'btn-soft-danger',
      'high': 'btn-soft-warning',
      'medium': 'btn-soft-info'
    };
    return classMap[priority] || 'btn-soft-secondary';
  }

  // Activity helpers
  onActivityClick(activity: ActivityItem): void {
    if (activity.route) {
      this.router.navigate([activity.route]);
    }
  }

  getActivityIconClass(color: string): string {
    const classMap: { [key: string]: string } = {
      'primary': 'bg-primary-subtle text-primary',
      'success': 'bg-success-subtle text-success',
      'warning': 'bg-warning-subtle text-warning',
      'info': 'bg-info-subtle text-info',
      'danger': 'bg-danger-subtle text-danger'
    };
    return classMap[color] || 'bg-secondary-subtle text-secondary';
  }

  getActivityAvatarClass(color: string): string {
    const classMap: { [key: string]: string } = {
      'primary': 'bg-primary-subtle text-primary',
      'success': 'bg-success-subtle text-success',
      'warning': 'bg-warning-subtle text-warning',
      'info': 'bg-info-subtle text-info',
      'danger': 'bg-danger-subtle text-danger'
    };
    return classMap[color] || 'bg-light text-muted';
  }

  getActivityBadgeClass(color: string): string {
    const classMap: { [key: string]: string } = {
      'primary': 'bg-primary-subtle text-primary',
      'success': 'bg-success-subtle text-success',
      'warning': 'bg-warning-subtle text-warning',
      'info': 'bg-info-subtle text-info',
      'danger': 'bg-danger-subtle text-danger'
    };
    return classMap[color] || 'bg-secondary-subtle text-secondary';
  }

  getActivityTimestamp(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    if (diffDays === 0) {
      return `${timeStr} Today`;
    } else if (diffDays === 1) {
      return `${timeStr} Yesterday`;
    } else {
      const dateStr = date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      return dateStr;
    }
  }

  getCaseLastActivity(caseItem: DashboardCase): string {
    // In production, this would come from the case data
    // For now, return a formatted relative time
    const randomHours = Math.floor(Math.random() * 24) + 1;
    if (randomHours < 1) return 'Just now';
    if (randomHours < 24) return `${randomHours}h ago`;
    return '1d ago';
  }

  // Case card helpers
  getCasePriorityBorderClass(priority: string): string {
    const classMap: { [key: string]: string } = {
      'high': 'border-danger',
      'medium': 'border-warning',
      'low': 'border-success'
    };
    return classMap[priority] || '';
  }

  getCaseTypeHeaderClass(caseType: string): string {
    const classMap: { [key: string]: string } = {
      'CRIMINAL': 'bg-danger-subtle text-danger',
      'CIVIL': 'bg-info-subtle text-info',
      'FAMILY': 'bg-warning-subtle text-warning',
      'CORPORATE': 'bg-primary-subtle text-primary',
      'REAL_ESTATE': 'bg-success-subtle text-success',
      'IMMIGRATION': 'bg-purple-subtle text-purple',
      'PERSONAL_INJURY': 'bg-danger-subtle text-danger',
      'BANKRUPTCY': 'bg-secondary-subtle text-secondary',
      'EMPLOYMENT': 'bg-info-subtle text-info',
      'INTELLECTUAL_PROPERTY': 'bg-primary-subtle text-primary'
    };
    return classMap[caseType?.toUpperCase()] || 'bg-light text-muted';
  }

  getCaseTypeIcon(caseType: string): string {
    const iconMap: { [key: string]: string } = {
      'CRIMINAL': 'ri-shield-user-line',
      'CIVIL': 'ri-scales-3-line',
      'FAMILY': 'ri-parent-line',
      'CORPORATE': 'ri-building-2-line',
      'REAL_ESTATE': 'ri-home-4-line',
      'IMMIGRATION': 'ri-global-line',
      'PERSONAL_INJURY': 'ri-heart-pulse-line',
      'BANKRUPTCY': 'ri-money-dollar-circle-line',
      'EMPLOYMENT': 'ri-user-settings-line',
      'INTELLECTUAL_PROPERTY': 'ri-lightbulb-line'
    };
    return iconMap[caseType?.toUpperCase()] || 'ri-briefcase-line';
  }

  getCaseTypeIconBgClass(caseType: string): string {
    const classMap: { [key: string]: string } = {
      'CRIMINAL': 'bg-danger-subtle text-danger',
      'CIVIL': 'bg-info-subtle text-info',
      'FAMILY': 'bg-warning-subtle text-warning',
      'CORPORATE': 'bg-primary-subtle text-primary',
      'REAL_ESTATE': 'bg-success-subtle text-success',
      'IMMIGRATION': 'bg-purple-subtle text-purple',
      'PERSONAL_INJURY': 'bg-danger-subtle text-danger',
      'BANKRUPTCY': 'bg-secondary-subtle text-secondary',
      'EMPLOYMENT': 'bg-info-subtle text-info',
      'INTELLECTUAL_PROPERTY': 'bg-primary-subtle text-primary'
    };
    return classMap[caseType?.toUpperCase()] || 'bg-light text-muted';
  }

  getCasePriorityBadgeClass(priority: string): string {
    const classMap: { [key: string]: string } = {
      'high': 'bg-danger-subtle text-danger',
      'medium': 'bg-warning-subtle text-warning',
      'low': 'bg-success-subtle text-success'
    };
    return classMap[priority] || 'bg-secondary-subtle text-secondary';
  }

  // Minimal case card helpers
  getClientInitials(name: string): string {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  getClientAvatarClass(name: string): string {
    // Generate consistent color based on name
    const colors = [
      'bg-primary text-white',
      'bg-secondary text-white',
      'bg-success text-white',
      'bg-info text-white',
      'bg-warning text-dark',
      'bg-danger text-white',
      'bg-dark text-white'
    ];
    const index = name ? name.charCodeAt(0) % colors.length : 0;
    return colors[index];
  }

  getCaseStatusBadgeStyle(status: string): string {
    const styleMap: { [key: string]: string } = {
      'ACTIVE': 'case-badge-success',
      'IN_PROGRESS': 'case-badge-primary',
      'OPEN': 'case-badge-success',
      'PENDING': 'case-badge-warning',
      'PENDING_REVIEW': 'case-badge-warning',
      'UNDER_REVIEW': 'case-badge-info',
      'CLOSED': 'case-badge-dark',
      'ON_HOLD': 'case-badge-muted'
    };
    return styleMap[status?.toUpperCase()] || 'case-badge-muted';
  }

  formatCaseStatus(status: string): string {
    const statusMap: { [key: string]: string } = {
      'ACTIVE': 'Open',
      'IN_PROGRESS': 'In Progress',
      'OPEN': 'Open',
      'PENDING': 'Pending',
      'PENDING_REVIEW': 'Under Review',
      'UNDER_REVIEW': 'Under Review',
      'CLOSED': 'Closed',
      'ON_HOLD': 'On Hold'
    };
    return statusMap[status?.toUpperCase()] || status;
  }

  getCaseDeadlineBadgeStyle(caseItem: DashboardCase): string {
    if (caseItem.priority === 'high') {
      return 'case-badge-urgent';
    }
    if (caseItem.nextActionDate) {
      const date = new Date(caseItem.nextActionDate);
      const today = new Date();
      const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) return 'case-badge-urgent'; // Due Today - red
      if (diffDays === 1) return 'case-badge-warning'; // Due Tomorrow - yellow
      if (diffDays <= 3) return 'case-badge-warning'; // Due soon - yellow
      if (diffDays <= 7) return 'case-badge-info'; // Due this week - blue
      return 'case-badge-muted'; // No urgent deadline
    }
    return 'case-badge-light'; // No Deadline - gray
  }

  getCaseDeadlineLabel(caseItem: DashboardCase): string {
    if (caseItem.priority === 'high') {
      return 'Urgent';
    }
    if (caseItem.nextActionDate) {
      const date = new Date(caseItem.nextActionDate);
      const today = new Date();
      const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) return 'Due Today';
      if (diffDays === 1) return 'Due Tomorrow';
      if (diffDays <= 7) return `Due in ${diffDays} days`;
      return 'No Deadline';
    }
    return 'No Deadline';
  }
}
