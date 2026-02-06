import { Component, OnInit, OnDestroy, Input, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, of, forkJoin } from 'rxjs';
import { takeUntil, catchError, map } from 'rxjs/operators';
import { User } from 'src/app/interface/user';
import { CaseService } from 'src/app/modules/legal/services/case.service';
import { TimeTrackingService, TimeEntry } from 'src/app/modules/time-tracking/services/time-tracking.service';
import { CalendarService } from 'src/app/modules/legal/services/calendar.service';
import { CaseActivitiesService } from 'src/app/modules/legal/services/case-activities.service';
import { RbacService } from 'src/app/core/services/rbac.service';
import { AiBriefingService, BriefingRequest } from 'src/app/core/services/ai-briefing.service';
import { AppointmentService, AppointmentRequest } from 'src/app/core/services/appointment.service';
import Swal from 'sweetalert2';

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
  isPast?: boolean;
  isInProgress?: boolean;
  rawStart?: Date;
  rawEnd?: Date;
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
  showAllScheduleEvents = false;

  // FAB (Floating Action Button)
  fabExpanded = false;

  // Availability settings modal
  showAvailabilityModal = false;

  // Appointment requests
  pendingAppointments: AppointmentRequest[] = [];
  pendingAppointmentsCount = 0;
  loadingPendingAppointments = false;

  // Appointment action modals
  showApproveModal = false;
  showDeclineModal = false;
  selectedAppointment: AppointmentRequest | null = null;
  approveForm = {
    confirmedDatetime: '',
    location: '',
    meetingLink: '',
    isVirtual: false,
    notes: ''
  };
  declineReason = '';
  processingAction = false;

  // Pending reschedule requests
  pendingRescheduleRequests: AppointmentRequest[] = [];
  pendingRescheduleCount = 0;
  loadingRescheduleRequests = false;
  showRescheduleApproveModal = false;
  showRescheduleDeclineModal = false;
  selectedRescheduleRequest: AppointmentRequest | null = null;
  rescheduleDeclineReason = '';

  // AI Briefing
  aiBriefing: string | null = null;
  aiBriefingLoading = false;
  // Flags to track when data sources are loaded for AI briefing
  private scheduleEventsLoaded = false;
  private urgentItemsLoaded = false;

  currentDate = new Date();
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private caseService: CaseService,
    private timeTrackingService: TimeTrackingService,
    private calendarService: CalendarService,
    private caseActivitiesService: CaseActivitiesService,
    private rbacService: RbacService,
    private aiBriefingService: AiBriefingService,
    private appointmentService: AppointmentService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.initializeWeekDays();
    this.loadDashboardData();
    this.loadPendingAppointments();
    this.loadPendingRescheduleRequests();
  }

  private loadUrgentItems(): void {
    // Load upcoming events (next 7 days) for urgent items
    this.calendarService.getUpcomingEvents(7).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error loading upcoming events for urgent items:', error);
        return of([]);
      })
    ).subscribe({
      next: (events: any[]) => {
        const now = new Date();

        // Filter for deadlines and important events only
        const urgentEvents = events
          .filter(event => {
            // Exclude completed or cancelled events
            const isActiveEvent = event.status !== 'COMPLETED' && event.status !== 'CANCELLED';

            // For today's events, exclude those that have already ended
            const eventEnd = new Date(event.end || event.endTime);
            const isNotPast = eventEnd > now;

            // Include deadlines, court dates, or high priority events
            return isActiveEvent && isNotPast &&
              (event.eventType === 'DEADLINE' || event.eventType === 'HEARING' ||
               event.eventType === 'COURT' || event.eventType === 'COURT_DATE' ||
               event.eventType === 'FILING' || event.eventType === 'DEPOSITION' ||
               event.highPriority);
          })
          .sort((a, b) => new Date(a.start || a.startTime).getTime() - new Date(b.start || b.startTime).getTime())
          .slice(0, 10);

        // Map to UrgentItem format
        this.urgentItems = urgentEvents.map((event, index) => ({
          id: event.id || index,
          title: event.title || 'Urgent Item',
          description: event.description || event.caseTitle || '',
          type: this.mapEventToUrgentType(event.eventType),
          priority: this.determineUrgentPriority(event),
          dueLabel: this.formatDueLabel(event.start || event.startTime),
          caseNumber: event.caseNumber || null,
          caseId: event.caseId || null,
          client: event.clientName || null,
          route: event.caseId ? `/legal/cases/${event.caseId}` : '/legal/calendar'
        }));

        // Signal that urgent items are loaded, then try to load AI briefing
        this.urgentItemsLoaded = true;
        this.tryLoadAiBriefing();
        this.cdr.detectChanges();
      }
    });
  }

  private mapEventToUrgentType(eventType: string): 'deadline' | 'document' | 'message' | 'task' | 'billing' {
    const typeMap: { [key: string]: any } = {
      'DEADLINE': 'deadline',
      'FILING': 'deadline',
      'HEARING': 'deadline',
      'COURT': 'deadline',
      'COURT_DATE': 'deadline',
      'DEPOSITION': 'deadline',
      'DOCUMENT_REVIEW': 'document',
      'MEETING': 'task',
      'CONSULTATION': 'task',
      'CLIENT_MEETING': 'task',
      'TEAM_MEETING': 'task'
    };
    return typeMap[eventType?.toUpperCase()] || 'task';
  }

  private determineUrgentPriority(event: any): 'critical' | 'high' | 'medium' {
    const eventDate = new Date(event.start || event.startTime);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (event.highPriority || diffDays <= 0) return 'critical';
    if (diffDays <= 2 || event.eventType === 'HEARING' || event.eventType === 'COURT' || event.eventType === 'COURT_DATE') return 'high';
    return 'medium';
  }

  private formatDueLabel(dateStr: string): string {
    if (!dateStr) return 'No date';

    // Extract date part only (YYYY-MM-DD) to avoid timezone issues
    const eventDatePart = dateStr.substring(0, 10);

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDatePart)) {
      console.warn('[UrgentItems] Invalid date format:', dateStr);
      return 'Invalid date';
    }

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    // Compare date strings directly (avoids timezone conversion issues)
    if (eventDatePart < todayStr) return 'Overdue';
    if (eventDatePart === todayStr) return 'Today';
    if (eventDatePart === tomorrowStr) return 'Tomorrow';

    // For dates further out, calculate days difference
    const eventDate = new Date(eventDatePart + 'T00:00:00');
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((eventDate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) return `${diffDays} days`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private loadScheduleEvents(): void {
    this.eventsLoading = true;

    // Fetch today's events using the dedicated endpoint
    this.calendarService.getTodayEvents().pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error loading today events:', error);
        return of([]);
      })
    ).subscribe({
      next: (todayEvents: any[]) => {
        const now = new Date();

        // Map to ScheduleEvent format with time status
        const mappedEvents: ScheduleEvent[] = todayEvents.map(event => {
          const rawStart = new Date(event.start || event.startTime);
          const rawEnd = new Date(event.end || event.endTime);
          const isPast = rawEnd < now;
          const isInProgress = rawStart <= now && rawEnd > now;

          return {
            id: event.id,
            title: event.title || 'Untitled Event',
            description: event.description || event.caseTitle || '',
            startTime: this.formatEventTime(event.start || event.startTime),
            endTime: this.formatEventTime(event.end || event.endTime),
            duration: this.calculateDuration(event.start || event.startTime, event.end || event.endTime),
            type: this.mapEventType(event.eventType || event.type),
            client: event.clientName || null,
            location: event.location || null,
            meetingType: event.meetingType || null,
            caseInfo: event.caseTitle || event.caseName || null,
            caseId: event.caseId || null,
            isPast,
            isInProgress,
            rawStart,
            rawEnd
          };
        });

        // Sort: in progress first, then upcoming (by start time), then past (by end time desc)
        this.scheduleEvents = mappedEvents.sort((a, b) => {
          // In progress events first
          if (a.isInProgress && !b.isInProgress) return -1;
          if (!a.isInProgress && b.isInProgress) return 1;

          // Past events last
          if (a.isPast && !b.isPast) return 1;
          if (!a.isPast && b.isPast) return -1;

          // Within same category, sort by start time
          return (a.rawStart?.getTime() || 0) - (b.rawStart?.getTime() || 0);
        });

        this.eventsLoading = false;
        // Signal that schedule events are loaded, then try to load AI briefing
        this.scheduleEventsLoaded = true;
        this.tryLoadAiBriefing();
        this.cdr.detectChanges();
      }
    });

    // Also fetch upcoming events for week count
    this.calendarService.getUpcomingEvents(7).pipe(
      takeUntil(this.destroy$),
      catchError(() => of([]))
    ).subscribe({
      next: (upcomingEvents: any[]) => {
        this.thisWeekEvents = upcomingEvents.length;
        this.cdr.detectChanges();
      }
    });
  }

  private formatEventTime(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  private calculateDuration(startStr: string, endStr: string): string {
    if (!startStr || !endStr) return '';
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) {
      const mins = Math.round(diffMs / 60000);
      return `${mins} min`;
    }
    return diffHours === 1 ? '1 hr' : `${diffHours.toFixed(1)} hrs`;
  }

  private mapEventType(type: string): 'consultation' | 'hearing' | 'review' | 'meeting' | 'deposition' {
    const typeMap: { [key: string]: any } = {
      'CONSULTATION': 'consultation',
      'CLIENT_MEETING': 'consultation',
      'COURT_HEARING': 'hearing',
      'COURT_DATE': 'hearing',  // Added: maps to hearing for AI briefing court detection
      'HEARING': 'hearing',
      'COURT': 'hearing',
      'TRIAL': 'hearing',
      'DOCUMENT_REVIEW': 'review',
      'REVIEW': 'review',
      'DEADLINE': 'review',
      'REMINDER': 'review',
      'MEETING': 'meeting',
      'TEAM_MEETING': 'meeting',
      'INTERNAL_MEETING': 'meeting',
      'MEDIATION': 'meeting',
      'DEPOSITION': 'deposition',
      'OTHER': 'meeting'
    };
    return typeMap[type?.toUpperCase()] || 'meeting';
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

    // Reset AI briefing loading flags
    this.scheduleEventsLoaded = false;
    this.urgentItemsLoaded = false;

    // Clear cached briefing to get fresh data
    this.aiBriefingService.invalidateCache().subscribe();

    // Load all data in parallel
    this.loadCases();
    this.loadTimeEntries();
    this.loadScheduleEvents();
    this.loadUrgentItems();
    // Note: loadRecentActivity() is called inside loadCases() after cases are loaded,
    // so we don't call it here to avoid a duplicate call with empty recentCases.
  }

  /**
   * Try to load AI briefing only when both schedule events and urgent items are loaded
   */
  private tryLoadAiBriefing(): void {
    if (this.scheduleEventsLoaded && this.urgentItemsLoaded) {
      this.loadAiBriefing();
    }
  }

  private loadAiBriefing(): void {
    this.aiBriefingLoading = true;

    // Find if there's a court appearance today (that hasn't ended)
    const todayHearing = this.getTodayHearing();
    const nextEvent = this.getNextEvent();

    const request: BriefingRequest = {
      todayEventsCount: this.getActiveEventsCount(), // Only count active (non-past) events
      urgentItemsCount: this.urgentItems.length,
      activeCasesCount: this.activeCasesCount,
      nextEventTitle: nextEvent?.title || null,
      nextEventTime: nextEvent?.startTime || null,
      hasCourtAppearance: !!todayHearing,
      courtCaseName: todayHearing?.caseInfo || null,
      courtTime: todayHearing?.startTime || null,
      recentTeamActivity: [] // TODO: Add team activity when available
    };

    this.aiBriefingService.getBriefing(request).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (briefing) => {
        this.aiBriefing = briefing;
        this.aiBriefingLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading AI briefing:', error);
        this.aiBriefingLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private loadCases(): void {
    this.casesLoading = true;
    this.caseService.getCases(0, 10).pipe(
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

  private loadRecentActivity(): void {
    if (this.recentCases.length === 0) {
      return;
    }

    const caseIds = this.recentCases.map(c => c.id);
    const activityObservables = caseIds.map(caseId =>
      this.caseActivitiesService.getActivitiesByCaseId(caseId).pipe(
        catchError(() => of([]))
      )
    );

    // Create a map of caseId -> case info for quick lookup
    const caseMap = new Map<number, any>();
    this.recentCases.forEach(c => caseMap.set(c.id, c));

    forkJoin(activityObservables).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (activitiesArrays: any[][]) => {
        const allActivities = activitiesArrays.flat();
        const sortedActivities = allActivities
          .sort((a, b) => new Date(b.createdAt || b.timestamp).getTime() - new Date(a.createdAt || a.timestamp).getTime())
          .slice(0, 15);

        this.recentActivity = sortedActivities.map((activity, index) => {
          const activityInfo = this.mapActivityType(activity.activityType);
          // Get case info from caseMap
          const caseInfo = caseMap.get(activity.caseId);
          // Get user name from activity.user if available
          const userName = activity.user
            ? `${activity.user.firstName || ''} ${activity.user.lastName || ''}`.trim()
            : null;

          return {
            id: activity.id || index,
            type: activityInfo.type,
            title: activityInfo.title,
            description: activity.description || '',
            timestamp: new Date(activity.createdAt || activity.timestamp),
            caseNumber: caseInfo?.caseNumber || activity.caseNumber || null,
            caseName: caseInfo?.title || activity.caseTitle || null,
            clientName: caseInfo?.clientName || activity.clientName || null,
            userName: userName,
            icon: activityInfo.icon,
            color: activityInfo.color,
            displayType: activityInfo.displayType,
            route: activity.caseId ? `/legal/cases/${activity.caseId}` : null
          };
        });

        this.cdr.detectChanges();
      }
    });
  }

  private mapActivityType(activityType: string): { type: ActivityItem['type'], title: string, icon: string, color: string, displayType: string } {
    const typeMap: { [key: string]: any } = {
      // Notes
      'NOTE_ADDED': { type: 'task', title: 'Note Added', icon: 'ri-sticky-note-line', color: 'info', displayType: 'Note' },
      'NOTE_UPDATED': { type: 'task', title: 'Note Updated', icon: 'ri-edit-line', color: 'info', displayType: 'Update' },
      'NOTE_DELETED': { type: 'task', title: 'Note Deleted', icon: 'ri-delete-bin-line', color: 'warning', displayType: 'Delete' },

      // Documents
      'DOCUMENT_UPLOADED': { type: 'document', title: 'Document Uploaded', icon: 'ri-upload-2-line', color: 'primary', displayType: 'Upload' },
      'DOCUMENT_DOWNLOADED': { type: 'document', title: 'Document Downloaded', icon: 'ri-download-2-line', color: 'secondary', displayType: 'Download' },
      'DOCUMENT_VIEWED': { type: 'document', title: 'Document Viewed', icon: 'ri-eye-line', color: 'secondary', displayType: 'View' },
      'DOCUMENT_VERSION_ADDED': { type: 'document', title: 'New Version', icon: 'ri-file-add-line', color: 'primary', displayType: 'Version' },

      // Case Management
      'CASE_CREATED': { type: 'filing', title: 'Case Created', icon: 'ri-folder-add-line', color: 'success', displayType: 'New Case' },
      'CASE_UPDATED': { type: 'filing', title: 'Case Updated', icon: 'ri-refresh-line', color: 'warning', displayType: 'Update' },
      'STATUS_CHANGED': { type: 'filing', title: 'Status Changed', icon: 'ri-exchange-line', color: 'warning', displayType: 'Status' },
      'PRIORITY_CHANGED': { type: 'filing', title: 'Priority Changed', icon: 'ri-flag-line', color: 'danger', displayType: 'Priority' },

      // Hearings & Calendar
      'HEARING_SCHEDULED': { type: 'court', title: 'Hearing Scheduled', icon: 'ri-calendar-check-line', color: 'danger', displayType: 'Hearing' },
      'HEARING_UPDATED': { type: 'court', title: 'Hearing Updated', icon: 'ri-calendar-line', color: 'warning', displayType: 'Hearing' },
      'HEARING_CANCELLED': { type: 'court', title: 'Hearing Cancelled', icon: 'ri-calendar-close-line', color: 'secondary', displayType: 'Cancelled' },

      // Assignments
      'ASSIGNMENT_ADDED': { type: 'task', title: 'Team Member Assigned', icon: 'ri-user-add-line', color: 'success', displayType: 'Assignment' },
      'ASSIGNMENT_REMOVED': { type: 'task', title: 'Team Member Removed', icon: 'ri-user-unfollow-line', color: 'warning', displayType: 'Unassigned' },
      'ASSIGNMENT_TRANSFERRED': { type: 'task', title: 'Assignment Transferred', icon: 'ri-exchange-line', color: 'info', displayType: 'Transfer' },

      // Communications
      'CLIENT_CONTACTED': { type: 'communication', title: 'Client Contacted', icon: 'ri-phone-line', color: 'info', displayType: 'Contact' },
      'EMAIL_SENT': { type: 'communication', title: 'Email Sent', icon: 'ri-mail-send-line', color: 'info', displayType: 'Email' },

      // Financial
      'PAYMENT_RECEIVED': { type: 'billing', title: 'Payment Received', icon: 'ri-money-dollar-circle-line', color: 'success', displayType: 'Payment' },
      'TIME_ENTRY_ADDED': { type: 'billing', title: 'Time Logged', icon: 'ri-time-line', color: 'primary', displayType: 'Time' },
      'TIME_ENTRY': { type: 'billing', title: 'Time Entry', icon: 'ri-time-line', color: 'primary', displayType: 'Time' },
      'INVOICE_CREATED': { type: 'billing', title: 'Invoice Created', icon: 'ri-bill-line', color: 'warning', displayType: 'Invoice' },

      // Tasks/Reminders
      'TASK_CREATED': { type: 'task', title: 'Task Created', icon: 'ri-task-line', color: 'primary', displayType: 'Task' },
      'TASK_ASSIGNED': { type: 'task', title: 'Task Assigned', icon: 'ri-user-add-line', color: 'success', displayType: 'Assigned' },
      'TASK_REASSIGNED': { type: 'task', title: 'Task Reassigned', icon: 'ri-user-shared-line', color: 'info', displayType: 'Reassigned' },
      'TASK_UPDATED': { type: 'task', title: 'Task Updated', icon: 'ri-edit-line', color: 'info', displayType: 'Task' },
      'TASK_STATUS_CHANGED': { type: 'task', title: 'Task Status Changed', icon: 'ri-exchange-line', color: 'warning', displayType: 'Status' },
      'TASK_COMPLETED': { type: 'task', title: 'Task Completed', icon: 'ri-checkbox-circle-line', color: 'success', displayType: 'Completed' },
      'TASK_DELETED': { type: 'task', title: 'Task Deleted', icon: 'ri-delete-bin-line', color: 'secondary', displayType: 'Deleted' },

      // Deadlines
      'DEADLINE_ADDED': { type: 'deadline', title: 'Deadline Added', icon: 'ri-calendar-todo-line', color: 'danger', displayType: 'Deadline' }
    };

    return typeMap[activityType?.toUpperCase()] || {
      type: 'task',
      title: this.formatActivityTitle(activityType),
      icon: 'ri-information-line',
      color: 'secondary',
      displayType: 'Activity'
    };
  }

  private formatActivityTitle(activityType: string): string {
    if (!activityType) return 'Activity';
    // Convert SNAKE_CASE to Title Case
    return activityType
      .toLowerCase()
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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
    this.router.navigate(['/time-tracking/entry']);
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

  getNewItemsCount(): number {
    // Count items added in the last 24 hours (activities + urgent items)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentActivities = this.recentActivity.filter(a => a.timestamp > yesterday).length;
    return recentActivities + this.urgentItems.length;
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

  toggleShowAllScheduleEvents(): void {
    this.showAllScheduleEvents = !this.showAllScheduleEvents;
  }

  getVisibleScheduleEvents(): ScheduleEvent[] {
    return this.showAllScheduleEvents ? this.scheduleEvents.slice(0, 6) : this.scheduleEvents.slice(0, 3);
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

  // Briefing helper methods
  getTodayHearing(): ScheduleEvent | null {
    // Return first hearing that hasn't ended yet (in progress or upcoming)
    return this.scheduleEvents.find(e => e.type === 'hearing' && !e.isPast) || null;
  }

  getCriticalDeadline(): UrgentItem | null {
    return this.urgentItems.find(item =>
      item.priority === 'critical' ||
      (item.type === 'deadline' && (item.dueLabel === 'Today' || item.dueLabel === 'Tomorrow'))
    ) || null;
  }

  getNextEvent(): ScheduleEvent | null {
    if (this.scheduleEvents.length === 0) return null;
    // Return the first event that is in progress or upcoming (not past)
    return this.scheduleEvents.find(e => e.isInProgress || !e.isPast) || null;
  }

  // Get count of active (non-past) events for today
  getActiveEventsCount(): number {
    return this.scheduleEvents.filter(e => !e.isPast).length;
  }

  // Get count of completed (past) events for today
  getCompletedEventsCount(): number {
    return this.scheduleEvents.filter(e => e.isPast).length;
  }

  getOverdueCount(): number {
    return this.urgentItems.filter(item =>
      item.dueLabel === 'Overdue' || item.priority === 'critical'
    ).length;
  }

  getUpcomingDeadlinesCount(): number {
    return this.urgentItems.filter(item =>
      item.type === 'deadline' && item.dueLabel !== 'Overdue'
    ).length;
  }

  getPendingReviewCount(): number {
    return this.urgentItems.filter(item =>
      item.type === 'document'
    ).length;
  }

  // Availability settings modal methods
  openAvailabilitySettings(): void {
    this.showAvailabilityModal = true;
  }

  closeAvailabilitySettings(): void {
    this.showAvailabilityModal = false;
  }

  onAvailabilitySaved(): void {
    this.showAvailabilityModal = false;
    // Optionally refresh schedule data
  }

  // =====================================================
  // PENDING APPOINTMENT REQUESTS
  // =====================================================

  loadPendingAppointments(): void {
    this.loadingPendingAppointments = true;
    this.appointmentService.getAttorneyPendingRequests()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.pendingAppointments = response.appointments || [];
          this.pendingAppointmentsCount = response.count || this.pendingAppointments.length;
          this.loadingPendingAppointments = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading pending appointments:', err);
          this.loadingPendingAppointments = false;
        }
      });
  }

  openApproveModal(appointment: AppointmentRequest): void {
    this.selectedAppointment = appointment;
    // Pre-fill with preferred datetime
    if (appointment.preferredDatetime) {
      this.approveForm.confirmedDatetime = appointment.preferredDatetime.substring(0, 16);
    }
    this.approveForm.isVirtual = appointment.isVirtual || false;
    this.showApproveModal = true;
    this.cdr.detectChanges();
  }

  closeApproveModal(): void {
    this.showApproveModal = false;
    this.selectedAppointment = null;
    this.approveForm = {
      confirmedDatetime: '',
      location: '',
      meetingLink: '',
      isVirtual: false,
      notes: ''
    };
    this.cdr.detectChanges();
  }

  openDeclineModal(appointment: AppointmentRequest): void {
    this.selectedAppointment = appointment;
    this.declineReason = '';
    this.showDeclineModal = true;
    this.cdr.detectChanges();
  }

  closeDeclineModal(): void {
    this.showDeclineModal = false;
    this.selectedAppointment = null;
    this.declineReason = '';
    this.cdr.detectChanges();
  }

  confirmAppointment(): void {
    if (!this.selectedAppointment || !this.approveForm.confirmedDatetime) return;

    const clientName = this.selectedAppointment.clientName || 'the client';
    const appointmentDate = this.formatAppointmentDate(this.approveForm.confirmedDatetime);
    const appointmentTime = this.formatAppointmentTime(this.approveForm.confirmedDatetime);

    Swal.fire({
      title: 'Confirm Appointment?',
      html: `You are about to confirm the appointment with <strong>${clientName}</strong> for <strong>${appointmentDate}</strong> at <strong>${appointmentTime}</strong>.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0ab39c',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, Confirm',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.processingAction = true;
        this.cdr.detectChanges();

        this.appointmentService.confirmAppointment(this.selectedAppointment!.id!, {
          confirmedDatetime: this.approveForm.confirmedDatetime,
          location: this.approveForm.location || undefined,
          meetingLink: this.approveForm.meetingLink || undefined,
          isVirtual: this.approveForm.isVirtual,
          attorneyNotes: this.approveForm.notes || undefined
        }).pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.closeApproveModal();
              this.loadPendingAppointments();
              this.processingAction = false;
              Swal.fire({
                title: 'Appointment Confirmed!',
                text: `The appointment with ${clientName} has been confirmed. They will be notified.`,
                icon: 'success',
                timer: 3000,
                showConfirmButton: false
              });
              this.cdr.detectChanges();
            },
            error: (err) => {
              console.error('Error confirming appointment:', err);
              this.processingAction = false;
              Swal.fire({
                title: 'Error',
                text: 'Failed to confirm appointment. Please try again.',
                icon: 'error'
              });
              this.cdr.detectChanges();
            }
          });
      }
    });
  }

  declineAppointment(): void {
    if (!this.selectedAppointment) return;

    const clientName = this.selectedAppointment.clientName || 'the client';

    Swal.fire({
      title: 'Decline Appointment?',
      html: `Are you sure you want to decline the appointment request from <strong>${clientName}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f06548',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, Decline',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.processingAction = true;
        this.cdr.detectChanges();

        this.appointmentService.cancelAppointmentByAttorney(
          this.selectedAppointment!.id!,
          this.declineReason || 'Declined by attorney'
        ).pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.closeDeclineModal();
              this.loadPendingAppointments();
              this.processingAction = false;
              Swal.fire({
                title: 'Appointment Declined',
                text: `The appointment request from ${clientName} has been declined. They will be notified.`,
                icon: 'success',
                timer: 3000,
                showConfirmButton: false
              });
              this.cdr.detectChanges();
            },
            error: (err) => {
              console.error('Error declining appointment:', err);
              this.processingAction = false;
              Swal.fire({
                title: 'Error',
                text: 'Failed to decline appointment. Please try again.',
                icon: 'error'
              });
              this.cdr.detectChanges();
            }
          });
      }
    });
  }

  formatAppointmentDate(dateStr: string): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  formatAppointmentTime(dateStr: string): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  getAppointmentTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'CONSULTATION': 'Consultation',
      'CASE_REVIEW': 'Case Review',
      'DOCUMENT_SIGNING': 'Document Signing',
      'COURT_PREPARATION': 'Court Prep',
      'DEPOSITION': 'Deposition',
      'OTHER': 'Other'
    };
    return labels[type] || type;
  }

  // =====================================================
  // PENDING RESCHEDULE REQUESTS
  // =====================================================

  loadPendingRescheduleRequests(): void {
    this.loadingRescheduleRequests = true;
    this.appointmentService.getAttorneyPendingRescheduleRequests()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.pendingRescheduleRequests = response.appointments || [];
          this.pendingRescheduleCount = response.count || this.pendingRescheduleRequests.length;
          this.loadingRescheduleRequests = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading pending reschedule requests:', err);
          this.loadingRescheduleRequests = false;
        }
      });
  }

  openRescheduleApproveModal(appointment: AppointmentRequest): void {
    this.selectedRescheduleRequest = appointment;
    this.showRescheduleApproveModal = true;
    this.cdr.detectChanges();
  }

  closeRescheduleApproveModal(): void {
    this.showRescheduleApproveModal = false;
    this.selectedRescheduleRequest = null;
    this.cdr.detectChanges();
  }

  openRescheduleDeclineModal(appointment: AppointmentRequest): void {
    this.selectedRescheduleRequest = appointment;
    this.rescheduleDeclineReason = '';
    this.showRescheduleDeclineModal = true;
    this.cdr.detectChanges();
  }

  closeRescheduleDeclineModal(): void {
    this.showRescheduleDeclineModal = false;
    this.selectedRescheduleRequest = null;
    this.rescheduleDeclineReason = '';
    this.cdr.detectChanges();
  }

  approveReschedule(): void {
    if (!this.selectedRescheduleRequest?.id) return;

    const clientName = this.selectedRescheduleRequest.clientName || 'the client';
    const newTime = this.formatRescheduleTime(this.selectedRescheduleRequest.requestedRescheduleTime);

    Swal.fire({
      title: 'Approve Reschedule?',
      html: `You are about to approve the reschedule request from <strong>${clientName}</strong> to <strong>${newTime}</strong>.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0ab39c',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, Approve',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.processingAction = true;
        this.cdr.detectChanges();

        this.appointmentService.approveReschedule(this.selectedRescheduleRequest!.id!)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.closeRescheduleApproveModal();
              this.loadPendingRescheduleRequests();
              this.loadScheduleEvents(); // Refresh calendar
              this.processingAction = false;
              Swal.fire({
                title: 'Reschedule Approved!',
                text: `The appointment with ${clientName} has been rescheduled. They will be notified.`,
                icon: 'success',
                timer: 3000,
                showConfirmButton: false
              });
              this.cdr.detectChanges();
            },
            error: (err) => {
              console.error('Error approving reschedule:', err);
              this.processingAction = false;
              Swal.fire({
                title: 'Error',
                text: 'Failed to approve reschedule. Please try again.',
                icon: 'error'
              });
              this.cdr.detectChanges();
            }
          });
      }
    });
  }

  declineReschedule(): void {
    if (!this.selectedRescheduleRequest?.id) return;

    const clientName = this.selectedRescheduleRequest.clientName || 'the client';

    Swal.fire({
      title: 'Decline Reschedule?',
      html: `Are you sure you want to decline the reschedule request from <strong>${clientName}</strong>? The original appointment time will be kept.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f06548',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, Decline',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.processingAction = true;
        this.cdr.detectChanges();

        this.appointmentService.declineReschedule(
          this.selectedRescheduleRequest!.id!,
          this.rescheduleDeclineReason || undefined
        ).pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.closeRescheduleDeclineModal();
              this.loadPendingRescheduleRequests();
              this.processingAction = false;
              Swal.fire({
                title: 'Reschedule Declined',
                text: `The reschedule request from ${clientName} has been declined. The original appointment time remains. They will be notified.`,
                icon: 'success',
                timer: 3000,
                showConfirmButton: false
              });
              this.cdr.detectChanges();
            },
            error: (err) => {
              console.error('Error declining reschedule:', err);
              this.processingAction = false;
              Swal.fire({
                title: 'Error',
                text: 'Failed to decline reschedule. Please try again.',
                icon: 'error'
              });
              this.cdr.detectChanges();
            }
          });
      }
    });
  }

  formatRescheduleTime(dateStr: string | undefined): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
}
