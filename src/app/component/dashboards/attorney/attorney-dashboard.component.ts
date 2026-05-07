import { Component, OnInit, OnDestroy, Input, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, of, forkJoin, Observable } from 'rxjs';
import { takeUntil, catchError, map, shareReplay } from 'rxjs/operators';
import { User } from 'src/app/interface/user';
import { CaseService } from 'src/app/modules/legal/services/case.service';
import { TimeTrackingService, TimeEntry } from 'src/app/modules/time-tracking/services/time-tracking.service';
import { CalendarService } from 'src/app/modules/legal/services/calendar.service';
import { CaseActivitiesService } from 'src/app/modules/legal/services/case-activities.service';
import { RbacService } from 'src/app/core/services/rbac.service';
import { AiBriefingService, BriefingRequest } from 'src/app/core/services/ai-briefing.service';
import { AppointmentService, AppointmentRequest } from 'src/app/core/services/appointment.service';
import { PracticeAreaContextService } from 'src/app/core/services/practice-area-context.service';
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
  // Default true so the skeleton shows from first paint instead of the
  // fallback "You have N events..." string (line 15 of the template). The
  // briefing only fires after schedule+urgent finish loading (~T+1s), and
  // before that we'd render the fallback as if it were the real briefing.
  aiBriefingLoading = true;
  // Flags to track when data sources are loaded. Used both by the AI
  // briefing trigger (tryLoadAiBriefing) and by the focus card *ngIf so
  // dashboardFocus doesn't fall through to the "Good Evening" greeting
  // branch on first paint while scheduleEvents/urgentItems are still
  // empty arrays.
  scheduleEventsLoaded = false;
  urgentItemsLoaded = false;

  /**
   * The attorney's practice areas, intersected with the org's enabled set.
   * Drives whether the practice-area-outlet renders and which lazy module
   * loads. State now lives in PracticeAreaContextService so the topbar
   * switcher pill and this dashboard outlet stay in sync. The CSVs are
   * fed into the service from AppComponent's userData$ subscription.
   */
  readonly practiceAreas$: Observable<string[]>;
  readonly activeTab$: Observable<string | null>;

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
    private practiceAreaContext: PracticeAreaContextService,
    private cdr: ChangeDetectorRef
  ) {
    this.practiceAreas$ = this.practiceAreaContext.practiceAreas$;
    this.activeTab$ = this.practiceAreaContext.activeTab$;
  }

  ngOnInit(): void {
    this.initializeWeekDays();
    this.loadDashboardData();

    // Defer appointments and reschedule requests by 3 seconds — below the fold
    setTimeout(() => {
      this.loadPendingAppointments();
      this.loadPendingRescheduleRequests();
    }, 3000);
  }

  private loadUrgentItems(upcomingEvents$: Observable<any[]>): void {
    // Use shared upcoming events observable to avoid duplicate HTTP call
    upcomingEvents$.subscribe({
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

  private loadScheduleEvents(upcomingEvents$: Observable<any[]>): void {
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

    // Use shared upcoming events observable for week count (avoids duplicate HTTP call)
    upcomingEvents$.subscribe({
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

    // Note: Removed immediate invalidateCache() POST call —
    // the briefing already gets fresh data via tryLoadAiBriefing() after events/urgentItems load

    // Share the upcoming events observable to avoid duplicate HTTP calls
    const upcomingEvents$ = this.calendarService.getUpcomingEvents(7).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error loading upcoming events:', error);
        return of([]);
      }),
      shareReplay(1)
    );

    // Stagger calls to avoid overwhelming single ECS instance at login
    // T+0: Cases (most visible — the card grid)
    this.loadCases();

    // T+1s: Calendar events + urgent items (shared observable)
    setTimeout(() => {
      this.loadScheduleEvents(upcomingEvents$);
      this.loadUrgentItems(upcomingEvents$);
    }, 1000);

    // T+3.5s: Time entries (stats — can wait)
    setTimeout(() => this.loadTimeEntries(), 3500);
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
        this.cdr.detectChanges();

        // Defer activity loading by 3 seconds — it's below the fold
        setTimeout(() => {
          this.loadRecentActivity();
        }, 3000);
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

        // No date filter — the user wants every activity that exists
        // surfaced in the feed. Day-grouping at the template level
        // (`getGroupedActivities()`) labels older items as "Earlier" so
        // stale items still read as stale, but they're not hidden.
        // Cap at 30 (was 15) so when expanded, the feed shows a richer
        // history without dropping items.
        const sortedActivities = allActivities
          .filter(a => Number.isFinite(new Date(a.createdAt || a.timestamp).getTime()))
          .sort((a, b) => new Date(b.createdAt || b.timestamp).getTime() - new Date(a.createdAt || a.timestamp).getTime())
          .slice(0, 30);

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
    this.router.navigate(['/legal/ai-assistant/legispace']);
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

  // Group visible activities by day-bucket so the Recent Activity feed
  // renders as a real timeline (Today / Yesterday / This week / Earlier)
  // instead of an undifferentiated list. Used by the dashboard template.
  getGroupedActivities(): Array<{ label: string; items: ActivityItem[] }> {
    const visible = this.getVisibleActivities();
    if (visible.length === 0) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const groups = new Map<string, ActivityItem[]>();
    for (const activity of visible) {
      const ts = activity.timestamp.getTime();
      let label: string;
      if (ts >= today.getTime()) label = 'Today';
      else if (ts >= yesterday.getTime()) label = 'Yesterday';
      else if (ts >= sevenDaysAgo.getTime()) label = 'This week';
      else label = 'Earlier';

      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(activity);
    }

    // Preserve display order: Today → Yesterday → This week → Earlier
    const order = ['Today', 'Yesterday', 'This week', 'Earlier'];
    return order
      .filter(k => groups.has(k))
      .map(k => ({ label: k, items: groups.get(k)! }));
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

  // Event details modal — opened from the horizontal-timeline event blocks
  // and any other event surface that wants the read-only detail view.
  selectedScheduleEvent: ScheduleEvent | null = null;
  showEventDetailsModal = false;

  onEventClick(event: ScheduleEvent): void {
    this.selectedScheduleEvent = event;
    this.showEventDetailsModal = true;
  }

  closeEventDetailsModal(): void {
    this.showEventDetailsModal = false;
    this.selectedScheduleEvent = null;
  }

  /** Navigate to the linked case from the event-details modal. */
  openCaseFromEvent(): void {
    const caseId = this.selectedScheduleEvent?.caseId;
    this.closeEventDetailsModal();
    if (caseId) {
      this.router.navigate(['/legal/cases', caseId]);
    }
  }

  /** Open the calendar app from the event-details modal. */
  openCalendarFromEvent(): void {
    this.closeEventDetailsModal();
    this.openCalendar();
  }

  /** Display label for the event type. */
  getEventTypeLabel(type: string | undefined): string {
    const map: Record<string, string> = {
      consultation: 'Client meeting',
      hearing: 'Court hearing',
      review: 'Document review',
      meeting: 'Meeting',
      deposition: 'Deposition',
    };
    return map[type ?? ''] || 'Event';
  }

  /** Long-form date label for the modal header (e.g. "Wed, May 6"). */
  getEventDateLabel(event: ScheduleEvent | null): string {
    if (!event?.rawStart) return this.getCurrentDayFormatted();
    return event.rawStart.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // HORIZONTAL TIMELINE — positions events along a fixed 8 AM → 6 PM
  // window using % of range. `rawStart` / `rawEnd` are the precise
  // Date stamps populated in loadScheduleEvents().
  // ─────────────────────────────────────────────────────────────────
  private readonly TIMELINE_START_HOUR = 8;
  private readonly TIMELINE_END_HOUR = 18;

  private get timelineRangeMinutes(): number {
    return (this.TIMELINE_END_HOUR - this.TIMELINE_START_HOUR) * 60;
  }

  /** Hour tick marks across the top of the timeline. */
  getHourTicks(): { label: string; leftPct: number }[] {
    const ticks: { label: string; leftPct: number }[] = [];
    for (let h = this.TIMELINE_START_HOUR; h <= this.TIMELINE_END_HOUR; h++) {
      const minutesFromStart = (h - this.TIMELINE_START_HOUR) * 60;
      const leftPct = (minutesFromStart / this.timelineRangeMinutes) * 100;
      let label: string;
      if (h === this.TIMELINE_START_HOUR) label = `${h} AM`;
      else if (h === 12) label = '12 PM';
      else if (h > 12) label = `${h - 12}`;
      else label = `${h}`;
      ticks.push({ label, leftPct });
    }
    return ticks;
  }

  /** Position + width % for an event block. Null when event lacks rawStart/rawEnd. */
  getEventTimelinePosition(event: ScheduleEvent): { leftPct: number; widthPct: number } | null {
    if (!event.rawStart || !event.rawEnd) return null;
    const start = event.rawStart.getHours() * 60 + event.rawStart.getMinutes();
    const end = event.rawEnd.getHours() * 60 + event.rawEnd.getMinutes();
    const rangeStart = this.TIMELINE_START_HOUR * 60;
    const rangeEnd = this.TIMELINE_END_HOUR * 60;
    const clampedStart = Math.max(rangeStart, Math.min(rangeEnd, start));
    const clampedEnd = Math.max(rangeStart, Math.min(rangeEnd, end));
    const leftPct = ((clampedStart - rangeStart) / this.timelineRangeMinutes) * 100;
    const widthPct = Math.max(4, ((clampedEnd - clampedStart) / this.timelineRangeMinutes) * 100);
    return { leftPct, widthPct };
  }

  /** NOW indicator position. Returns null when current time is outside the visible window. */
  getNowTimelinePosition(): { leftPct: number; label: string } | null {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const rangeStart = this.TIMELINE_START_HOUR * 60;
    const rangeEnd = this.TIMELINE_END_HOUR * 60;
    if (minutes < rangeStart || minutes > rangeEnd) return null;
    const leftPct = ((minutes - rangeStart) / this.timelineRangeMinutes) * 100;
    const label = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return { leftPct, label };
  }

  /**
   * Events to render along the horizontal timeline. Past, in-progress and
   * upcoming events are all returned — the timeline reads as a complete
   * day view. Past events are de-emphasized via the `is-past` modifier
   * (faded + line-through) but still positioned at their actual time.
   */
  getActiveTimelineEvents(): ScheduleEvent[] {
    return this.scheduleEvents;
  }

  /**
   * Layout for the horizontal timeline. Each event gets a leftPct anchored
   * to its start time and a widthPct that EXPANDS to fill the gap up to the
   * next event when there's no overlap — so short events still show their
   * full title. The duration-based width is the floor, the next-event's
   * start (minus a small gap) is the ceiling.
   */
  getTimelineEventLayout(): Array<{ event: ScheduleEvent; leftPct: number; widthPct: number }> {
    const positioned = this.getActiveTimelineEvents()
      .map(event => ({ event, pos: this.getEventTimelinePosition(event) }))
      .filter((p): p is { event: ScheduleEvent; pos: { leftPct: number; widthPct: number } } => p.pos !== null)
      .sort((a, b) => a.pos.leftPct - b.pos.leftPct);

    // % of the timeline range needed to comfortably show a title + time.
    // 18% of a 10-hour window ≈ 108 minutes of visual space, enough for
    // most event titles before truncation kicks in.
    const MIN_LABEL_WIDTH_PCT = 18;
    const GAP_PCT = 0.6;

    return positioned.map((item, i) => {
      const next = positioned[i + 1];
      const nextStart = next ? next.pos.leftPct : 100;
      const maxAllowed = Math.max(4, nextStart - item.pos.leftPct - GAP_PCT);
      // Take the wider of (duration width, label-friendly width) but never
      // exceed the room available before the next event starts.
      const widthPct = Math.min(maxAllowed, Math.max(item.pos.widthPct, MIN_LABEL_WIDTH_PCT));
      return { event: item.event, leftPct: item.pos.leftPct, widthPct };
    });
  }

  /**
   * Tone class for an event block — derived ONLY from the event type so
   * every "client meeting" / "court hearing" / "deposition" reads the
   * same color across the timeline. NOW and PAST states are layered on
   * via separate `is-now` / `is-past` modifier classes in the template
   * (ring/glow for NOW, fade + strikethrough for PAST) so they don't
   * fight the type identity.
   */
  getEventToneClass(event: ScheduleEvent): string {
    const map: Record<string, string> = {
      consultation: 'tone-call',
      hearing: 'tone-court',
      review: 'tone-review',
      meeting: 'tone-meeting',
      deposition: 'tone-depo',
    };
    return map[event.type] || 'tone-meeting';
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

  // Schedule list (compact mockup-derived layout) — type → tag class
  // Used by the right-aligned colored pill on each .sched-item.
  getScheduleTagClass(event: ScheduleEvent): string {
    if (event.isInProgress) return 'tag-now';
    const map: { [key: string]: string } = {
      'consultation': 'tag-call',
      'hearing': 'tag-court',
      'review': 'tag-review',
      'meeting': 'tag-call',
      'deposition': 'tag-prep'
    };
    return map[event.type] || 'tag-default';
  }

  // Short label that fits in the corner pill.
  getScheduleTagLabel(event: ScheduleEvent): string {
    if (event.isPast) return 'Done';
    const map: { [key: string]: string } = {
      'consultation': 'Call',
      'hearing': 'Court',
      'review': 'Review',
      'meeting': 'Meeting',
      'deposition': 'Depo'
    };
    return map[event.type] || event.type;
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

  /**
   * Map UrgentItem.priority to a Direction-3 modifier class for the
   * numbered priority badge (`.d3-urgent-num`). Critical/high render the
   * red default (no modifier), medium renders yellow (`.med`), anything
   * else renders violet (`.low`).
   */
  getD3UrgentNumModifier(priority: string | undefined | null): string {
    if (priority === 'critical' || priority === 'high') return '';
    if (priority === 'medium') return 'med';
    return 'low';
  }

  /**
   * CTA label for the Direction-3 urgent item: deadlines/court → Open,
   * documents → Review, tasks/meetings → Prep, billing → Follow up.
   */
  getD3UrgentCtaLabel(item: UrgentItem): string {
    switch (item.type) {
      case 'document': return 'Review';
      case 'task':     return 'Prep';
      case 'billing':  return 'Follow up';
      case 'message':  return 'Reply';
      case 'deadline':
      default:         return 'Open';
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
              // Refresh calendar with a fresh upcoming events observable
              const refresh$ = this.calendarService.getUpcomingEvents(7).pipe(
                takeUntil(this.destroy$),
                catchError(() => of([])),
                shareReplay(1)
              );
              this.loadScheduleEvents(refresh$);
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

  // ============================================================
  // DASHBOARD FOCUS CARD
  // Inspired by the PI case detail focus pattern. Surfaces the
  // most urgent action across all matters in a single prominent
  // card. Tone color-coded by urgency state. Default tone is
  // 'info' (blueprint blue) — Action Cockpit philosophy.
  // ============================================================
  get dashboardFocus(): {
    tone: 'info';
    icon: string;
    eyebrow: string;
    titleStart: string;
    titleAccent: string;
    titleEnd: string;
    description: string;
    pills: Array<{ icon: string; label: string; value: string | number }>;
    primaryIcon: string;
    primaryLabel: string;
    secondaryLabel: string;
  } {
    const urgentCount = this.urgentItems?.length || 0;
    const criticalCount = this.urgentItems?.filter(i => i.priority === 'critical')?.length || 0;
    const todayEventCount = this.scheduleEvents?.length || 0;
    const pendingCount = this.pendingItems || 0;

    // URGENT STATE — multiple critical items or many urgent.
    // Tone stays 'info' (Rox blueprint-blue Action Cockpit) — only the
    // copy/icon reflect urgency. Color stays consistent across states.
    if (criticalCount >= 2 || urgentCount >= 4) {
      return {
        tone: 'info',
        icon: 'ri-flashlight-fill',
        eyebrow: 'Right now, you should focus on',
        titleStart: `${urgentCount} urgent matters need your attention `,
        titleAccent: 'before end of week',
        titleEnd: '',
        description: `<strong>${criticalCount} critical</strong> item${criticalCount === 1 ? '' : 's'} overdue or due within 48 hours. AI suggests prioritizing the earliest deadline first.`,
        pills: [
          { icon: 'ri-alarm-warning-line', label: 'urgent', value: urgentCount },
          { icon: 'ri-error-warning-line', label: 'critical', value: criticalCount },
          { icon: 'ri-calendar-event-line', label: 'today', value: todayEventCount },
          { icon: 'ri-task-line', label: 'pending', value: pendingCount },
        ],
        primaryIcon: 'ri-arrow-right-line',
        primaryLabel: 'Review urgent items',
        secondaryLabel: 'View all priorities',
      };
    }

    // SOON STATE — moderate workload. Same blueprint-blue tone.
    if (urgentCount >= 1 || todayEventCount >= 3) {
      return {
        tone: 'info',
        icon: 'ri-time-line',
        eyebrow: "Today's priorities",
        titleStart: `You have ${todayEventCount} event${todayEventCount === 1 ? '' : 's'} scheduled and `,
        titleAccent: `${urgentCount} item${urgentCount === 1 ? '' : 's'} needing attention`,
        titleEnd: '.',
        description: pendingCount > 0
          ? `Plan your day around the schedule. <strong>${pendingCount} pending task${pendingCount === 1 ? '' : 's'}</strong> can be tackled between meetings.`
          : 'Plan your day around the schedule. No outstanding tasks at the moment.',
        pills: [
          { icon: 'ri-calendar-event-line', label: 'today', value: todayEventCount },
          { icon: 'ri-alarm-line', label: 'urgent', value: urgentCount },
          { icon: 'ri-task-line', label: 'pending', value: pendingCount },
        ],
        primaryIcon: 'ri-calendar-todo-line',
        primaryLabel: "View today's schedule",
        secondaryLabel: 'See all tasks',
      };
    }

    // INFO TONE (default) — Action Cockpit's professional blue.
    // Matches the PI focus card pattern: date eyebrow, greeting headline,
    // descriptive body sensitive to day-of-week and caseload.
    const firstName = this.currentUser?.firstName?.trim() || 'there';
    const greeting = this.getGreeting();
    const day = this.currentDate.toLocaleDateString('en-US', { weekday: 'long' });
    const month = this.currentDate.toLocaleDateString('en-US', { month: 'long' });
    const dateNum = this.currentDate.getDate();
    const eyebrow = `${day}, ${month} ${dateNum}`.toUpperCase();
    const cases = this.activeCasesCount || 0;
    const casesPhrase = cases > 0
      ? `across your ${this.numberToWord(cases)} active case${cases === 1 ? '' : 's'}`
      : 'across your matters';
    const tomorrowPhrase = this.getTomorrowOutlook(this.currentDate.getDay());

    return {
      tone: 'info',
      icon: 'ri-compass-3-line',
      eyebrow,
      titleStart: `${greeting}, `,
      titleAccent: firstName,
      titleEnd: '',
      description: `No court appearances or urgent deadlines occurred today ${casesPhrase}. Your caseload remains <strong>manageable with all critical items current</strong>. ${tomorrowPhrase}`,
      pills: [
        { icon: 'ri-briefcase-line', label: 'active', value: cases },
        { icon: 'ri-calendar-event-line', label: 'this week', value: this.thisWeekEvents || 0 },
        { icon: 'ri-time-line', label: 'hours', value: this.weekHours || 0 },
      ],
      primaryIcon: 'ri-rocket-line',
      primaryLabel: 'Plan ahead',
      secondaryLabel: 'View all cases',
    };
  }

  // Spell out small integers ("ten" reads more naturally than "10" in
  // narrative copy). Falls back to digits for n > 20.
  private numberToWord(n: number): string {
    const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six',
      'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
      'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
      'nineteen', 'twenty'];
    return n >= 0 && n <= 20 ? words[n] : n.toString();
  }

  // Day-of-week sensitive outlook line for the focus card. Sunday gets
  // "tomorrow begins the work week"; Friday gets weekend framing; etc.
  private getTomorrowOutlook(dayOfWeek: number): string {
    switch (dayOfWeek) {
      case 0: // Sunday
        return 'Tomorrow begins the work week with standard case management activities scheduled.';
      case 5: // Friday
        return 'The weekend approaches — Monday brings the next round of scheduled work.';
      case 6: // Saturday
        return 'Tomorrow remains quiet, with the work week resuming Monday.';
      default:
        return 'Tomorrow continues active case management with standard activities scheduled.';
    }
  }

  // ============================================================
  // ACTION COCKPIT — cross-cutting components
  //
  // The AI Insights, Risk Alerts, and Cross-Matter Intelligence sections
  // (and their click handlers) were moved out of this dashboard in Phase 6.
  // They now live inside per-practice-area dashboard layers (e.g.
  // PersonalInjuryDashboardModule) which the practice-area-outlet renders.
  // ============================================================

  // Client Communication Health — surfaces clients needing follow-up
  get clientCommHealth(): {
    overdueCount: number;
    clients: Array<{
      name: string;
      initials: string;
      bg: string;
      lastContactLabel: string;
      daysSince: number;
      status: 'overdue' | 'soon' | 'on-track';
      preferredFreq?: string;
    }>;
  } {
    const cases = this.recentCases || [];
    if (!cases.length) return { overdueCount: 0, clients: [] };

    // Build client list from cases (each case has a clientName)
    const clientMap = new Map<string, any>();
    cases.forEach((c, idx) => {
      const name = c.clientName || 'Client';
      if (!clientMap.has(name)) {
        // Mock days since last contact based on index for variety
        const daysSince = (idx * 4) + 1;
        const status = daysSince >= 10 ? 'overdue' : daysSince >= 6 ? 'soon' : 'on-track';
        clientMap.set(name, {
          name,
          initials: this.getClientInitials(name),
          bg: this.getClientAvatarBg(name),
          lastContactLabel: daysSince === 1 ? 'Yesterday' : `${daysSince} days ago`,
          daysSince,
          status,
          preferredFreq: idx === 0 ? 'weekly' : idx === 1 ? 'as needed' : undefined,
        });
      }
    });

    const clients = Array.from(clientMap.values()).slice(0, 4);
    const overdueCount = clients.filter(c => c.status === 'overdue').length;
    return { overdueCount, clients };
  }

  // Helper: get bg color for client avatar.
  // Public so the template can use it directly for ad-hoc avatars (e.g.
  // appointment-request rows in the right rail).
  getClientAvatarBg(name: string): string {
    const colors = ['#0b64e9', '#f97006', '#16a34a', '#6b4aff', '#f24149', '#0891b2'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash << 5) - hash + name.charCodeAt(i);
    return colors[Math.abs(hash) % colors.length];
  }

  // Action handlers for the deleted Tier 3 components (onInsightAction,
  // onRiskAction, onCrossMatterPrimary/Secondary) were removed in Phase 6
  // along with their template markup. The matching navigation lives inside
  // each practice-area dashboard layer.
  onSendClientUpdate(client: any): void {
    this.navigateTo('/legal/cases');
  }

  // The focus card's CTAs route based on the underlying state, not the
  // visual tone — tone is locked to blueprint-blue so it can't be used as
  // the discriminator. Mirrors the same urgent/soon thresholds used by the
  // dashboardFocus getter.
  onFocusPrimary(): void {
    const urgentCount = this.urgentItems?.length || 0;
    const criticalCount = this.urgentItems?.filter(i => i.priority === 'critical')?.length || 0;
    const todayEventCount = this.scheduleEvents?.length || 0;
    if (criticalCount >= 2 || urgentCount >= 4) {
      this.navigateTo('/case-management/tasks');
    } else if (urgentCount >= 1 || todayEventCount >= 3) {
      this.navigateTo('/legal/calendar');
    } else {
      this.navigateTo('/legal/ai-assistant');
    }
  }

  onFocusSecondary(): void {
    const urgentCount = this.urgentItems?.length || 0;
    const criticalCount = this.urgentItems?.filter(i => i.priority === 'critical')?.length || 0;
    const todayEventCount = this.scheduleEvents?.length || 0;
    if (criticalCount >= 2 || urgentCount >= 1 || todayEventCount >= 3) {
      this.navigateTo('/case-management/tasks');
    } else {
      this.navigateTo('/legal/cases');
    }
  }
}
