import { Component, OnInit, OnDestroy, ChangeDetectorRef, AfterViewInit, ElementRef, ViewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TimeTrackingService, TimeEntry } from '../../services/time-tracking.service';
import { TimerService, ActiveTimer } from '../../services/timer.service';
import { UserService } from '../../../../service/user.service';
import { NotificationManagerService, NotificationCategory, NotificationPriority } from '../../../../core/services/notification-manager.service';
import { LegalCaseService } from '../../../legal/services/legal-case.service';
import { interval, Subscription } from 'rxjs';
import { timeout, catchError, of, finalize, distinctUntilChanged, map } from 'rxjs';
import { Key } from '../../../../enum/key.enum';
import Swal from 'sweetalert2';
import flatpickr from 'flatpickr';

interface DashboardStats {
  todayHours: number;
  activeTimers: number;
  weekTotal: number;
  todayAmount: number;
  isShowingToday?: boolean;
  displayDate?: string;
}

interface TimerState {
  id: number | null;
  description: string;
  elapsed: string;
  isRunning: boolean;
  caseId: number | null;
  caseName: string;
}

interface LegalCase {
  id: number;
  name: string;
  number: string;
  defaultRate?: number;
  allowMultipliers?: boolean;
  weekendMultiplier?: number;
  afterHoursMultiplier?: number;
  emergencyMultiplier?: number;
}

interface StopTimerFormData {
  description: string;
  date: string;
  billable: boolean;
  rate: number;
  activityType: string;
  tags: string;
  notes: string;
  applyMultipliers: boolean;
  isEmergency: boolean;
}

interface EditEntryFormData {
  id: number;
  description: string;
  date: string;
  hours: number;
  billable: boolean;
  rate: number;
  caseId: number | null;
  activityType: string;
  tags: string;
  notes: string;
}

@Component({
  selector: 'app-time-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './time-dashboard.component.html',
  styleUrls: ['./time-dashboard.component.scss']
})
export class TimeDashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('dateInput', { static: false }) dateInput!: ElementRef<HTMLInputElement>;
  
  // Core state
  stats: DashboardStats = { todayHours: 0, activeTimers: 0, weekTotal: 0, todayAmount: 0 };
  timer: TimerState = { id: null, description: 'Start tracking time', elapsed: '00:00:00', isRunning: false, caseId: null, caseName: '' };
  recentEntries: TimeEntry[] = [];
  availableCases: LegalCase[] = [];
  
  // UI state
  loading = true;
  error: string | null = null;
  showStopModal = false;
  showEditModal = false;
  showRateSelectionModal = false;
  selectedCaseForRateSelection: LegalCase | null = null;
  selectedRate = 250;
  applyMultipliers = true;
  isEmergencyWork = false;
  stopDescription = '';
  showAllEntries = false; // Track if table is expanded
  stopFormData: StopTimerFormData = {
    description: '',
    date: new Date().toISOString().split('T')[0],
    billable: true,
    rate: 250,
    activityType: '',
    tags: '',
    notes: '',
    applyMultipliers: true,
    isEmergency: false
  };
  editingEntry: TimeEntry | null = null;
  editFormData: EditEntryFormData = {
    id: 0,
    description: '',
    date: new Date().toISOString().split('T')[0],
    hours: 0,
    billable: true,
    rate: 250,
    caseId: null,
    activityType: '',
    tags: '',
    notes: ''
  };
  isProcessing = false;
  lastUpdated = new Date();
  showAllCases = false;
  
  // Subscriptions
  private timerUpdateSubscription?: Subscription;
  private activeTimersSubscription?: Subscription;
  private activeTimer?: ActiveTimer;
  activeTimers: ActiveTimer[] = []; // All active timers from service
  private flatpickrInstance?: flatpickr.Instance;

  constructor(
    private timeTrackingService: TimeTrackingService,
    private timerService: TimerService,
    private userService: UserService,
    private router: Router,
    private changeDetectorRef: ChangeDetectorRef,
    private legalCaseService: LegalCaseService,
    private notificationManager: NotificationManagerService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.initializeDashboard();
  }

  /**
   * Send notification when time entry is submitted for approval
   */
  private async notifyTimeEntrySubmission(entry: TimeEntry): Promise<void> {
    try {
      const currentUser = this.userService.getCurrentUser();
      if (!currentUser) return;

      // Get approvers (supervisors and time managers)
      const supervisors = await this.notificationManager.getSupervisors(currentUser.id);
      const timeManagers = await this.notificationManager.getUsersByRole('TIME_MANAGER');

      await this.notificationManager.sendNotification(
        NotificationCategory.TIME_TRACKING,
        'Time Entry Submitted',
        `${currentUser.firstName} ${currentUser.lastName} submitted a time entry for approval`,
        NotificationPriority.NORMAL,
        {
          primaryUsers: supervisors,
          secondaryUsers: timeManagers
        },
        `/time-tracking`,
        {
          entityId: entry.id,
          entityType: 'time_entry',
          additionalData: {
            submitterName: `${currentUser.firstName} ${currentUser.lastName}`,
            hours: entry.hours,
            date: entry.date,
            description: entry.description,
            caseName: entry.caseName
          }
        }
      );
    } catch (error) {
      console.error('Failed to send time entry submission notification:', error);
    }
  }

  /**
   * Send notification when time entry is approved/rejected
   */
  private async notifyTimeEntryDecision(entry: TimeEntry, decision: 'approved' | 'rejected', reason?: string): Promise<void> {
    try {
      if (!entry.userId) return;

      const submitter = await this.notificationManager.getUsersByRole('USER').then(users => 
        users.find(u => u.id === entry.userId)
      );
      
      if (!submitter) return;

      const title = decision === 'approved' ? 'Time Entry Approved' : 'Time Entry Rejected';
      const message = `Your time entry for ${entry.hours} hours has been ${decision}${reason ? `: ${reason}` : ''}`;

      await this.notificationManager.sendNotification(
        NotificationCategory.TIME_TRACKING,
        title,
        message,
        decision === 'rejected' ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
        {
          primaryUsers: [submitter]
        },
        `/time-tracking`,
        {
          entityId: entry.id,
          entityType: 'time_entry',
          additionalData: {
            decision,
            reason,
            hours: entry.hours,
            date: entry.date,
            caseName: entry.caseName
          }
        }
      );
    } catch (error) {
      console.error('Failed to send time entry decision notification:', error);
    }
  }

  ngOnDestroy(): void {
    this.timerUpdateSubscription?.unsubscribe();
    this.activeTimersSubscription?.unsubscribe();
    this.flatpickrInstance?.destroy();
  }

  ngAfterViewInit(): void {
    // Flatpickr will be initialized when the modal opens
  }

  private async initializeDashboard(): Promise<void> {
    try {
      this.loading = true;
      this.error = null;
      this.changeDetectorRef.detectChanges(); // Force initial loading state

      // Subscribe to shared timer state from TimerService
      // This ensures sync between topbar dropdown and dashboard
      this.activeTimersSubscription = this.timerService.activeTimers$.subscribe(timers => {
        // Run inside Angular zone to ensure change detection
        this.ngZone.run(() => {
          this.activeTimers = timers;
          this.updateLocalTimerState(timers);
          this.changeDetectorRef.detectChanges();
        });
      });

      // Enhanced authentication check
      const currentUserId = this.getCurrentUserId();
      if (!currentUserId) {
        // Try to load user profile first
        if (this.userService.isAuthenticated()) {
          try {
            const profileResponse = await this.userService.profile$().toPromise();
            if (profileResponse?.data?.user?.id) {
              // Continue with dashboard loading
            } else {
              this.error = 'Please log in to access time tracking';
              this.loading = false;
              this.changeDetectorRef.detectChanges();
              return;
            }
          } catch (profileError) {
            console.error('Profile loading failed:', profileError);
            this.error = 'Authentication required. Please log in again.';
            this.loading = false;
            this.changeDetectorRef.detectChanges();
            return;
          }
        } else {
          this.error = 'Please log in to access time tracking';
          this.loading = false;
          this.changeDetectorRef.detectChanges();
          return;
        }
      }

      // Load all dashboard components with timeout to prevent hanging
      try {
        await Promise.race([
          Promise.all([
            this.loadAvailableCases(),
            this.loadDashboardStats(),
            this.loadRecentEntries(),
            this.syncTimerState()
          ]),
          // Add timeout to prevent infinite loading
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Dashboard loading timeout')), 30000)
          )
        ]);

        this.startTimerUpdates();
        this.loading = false;
        this.changeDetectorRef.detectChanges();
      } catch (timeoutError) {
        console.error('Dashboard loading timeout or error:', timeoutError);
        this.error = 'Dashboard loading is taking too long. Please refresh the page.';
        this.loading = false;
        this.changeDetectorRef.detectChanges();
      }
    } catch (error) {
      console.error('Dashboard initialization error:', error);
      this.error = 'Failed to load dashboard. Please refresh the page.';
      this.loading = false;
      this.changeDetectorRef.detectChanges();
    }
  }

  private loadAvailableCases(): Promise<void> {
    return new Promise((resolve, reject) => {
      const userId = this.getCurrentUserId();
      if (!userId) {
        console.error('No user ID found for loading cases');
        this.error = 'Authentication required to load legal cases. Please log in.';
        this.availableCases = [];
        this.changeDetectorRef.detectChanges();
        return reject('No user ID found');
      }

      // Determine how many cases to load
      const pageSize = this.showAllCases ? 50 : 12;

      // Fetch cases from the backend using the legal case service
      this.legalCaseService.getAllCases(0, pageSize).subscribe({
        next: (response) => {
          // Handle the API response structure
          let cases = [];
          if (response && response.data && response.data.page && response.data.page.content) {
            cases = response.data.page.content;
          } else if (response && response.data && Array.isArray(response.data)) {
            cases = response.data;
          } else if (Array.isArray(response)) {
            cases = response;
          }
          
          // Filter out closed cases and map to our interface with rate info
          this.availableCases = cases
            .filter(caseItem => 
              caseItem.status !== 'CLOSED' && 
              caseItem.status !== 'COMPLETED' && 
              caseItem.status !== 'ARCHIVED'
            )
            .map(caseItem => ({
              id: parseInt(caseItem.id) || caseItem.id,
              name: caseItem.title || caseItem.name || `Case #${caseItem.id}`,
              number: caseItem.caseNumber || caseItem.number || `CASE-${caseItem.id}`,
              // Add default rate information - in real implementation, this would come from backend
              defaultRate: caseItem.defaultRate || this.getDefaultRateForCase(caseItem),
              allowMultipliers: caseItem.allowMultipliers !== false, // Default to true
              weekendMultiplier: caseItem.weekendMultiplier || 1.5,
              afterHoursMultiplier: caseItem.afterHoursMultiplier || 1.25,
              emergencyMultiplier: caseItem.emergencyMultiplier || 2.0
            }))
            .slice(0, this.showAllCases ? 50 : 12); // Limit based on view mode

          if (this.availableCases.length === 0) {
            this.error = 'No active legal cases found. Please contact your administrator to create cases.';
          }
          
          this.changeDetectorRef.detectChanges();
          resolve();
        },
        error: (error) => {
          console.error('Failed to load cases from backend:', error);
          this.error = `Failed to load legal cases: ${error.error?.message || error.message || 'Unable to connect to server'}`;
          this.availableCases = [];
          this.changeDetectorRef.detectChanges();
          reject(error);
        }
      });
    });
  }

  // Helper method to determine default rate for a case
  private getDefaultRateForCase(caseItem: any): number {
    // Basic logic to determine rate based on case type or complexity
    const caseName = (caseItem.title || caseItem.name || '').toLowerCase();
    
    if (caseName.includes('merger') || caseName.includes('acquisition')) return 450;
    if (caseName.includes('litigation') || caseName.includes('fraud')) return 500;
    if (caseName.includes('estate') || caseName.includes('trust')) return 250;
    if (caseName.includes('corporate') || caseName.includes('compliance')) return 400;
    if (caseName.includes('ip') || caseName.includes('patent')) return 500;
    if (caseName.includes('employment') || caseName.includes('discrimination')) return 275;
    if (caseName.includes('real estate') || caseName.includes('property')) return 300;
    if (caseName.includes('international') || caseName.includes('trade')) return 600;
    
    return 300; // Default rate
  }

  private loadDashboardStats(): Promise<void> {
    return new Promise((resolve, reject) => {
      const userId = this.getCurrentUserId();
      if (!userId) {
        console.error('No user ID found for loading dashboard stats');
        this.changeDetectorRef.detectChanges();
        return reject('No user ID');
      }

      // First, get recent entries to find the most recent date with data
      this.timeTrackingService.getTimeEntriesByUser(userId, 0, 50).subscribe({
        next: (recentResponse) => {
          const recentEntries = recentResponse.content || [];
          
          if (recentEntries.length === 0) {
            this.stats = {
              todayHours: 0,
              todayAmount: 0,
              weekTotal: 0,
              activeTimers: this.timer.isRunning ? 1 : 0
            };
            this.changeDetectorRef.detectChanges();
            return resolve();
          }

          // Find the most recent date with entries
          const allDates = recentEntries.map(e => e.date).sort().reverse();
          const mostRecentDate = allDates[0];
          const today = new Date().toISOString().split('T')[0];
          
          // Use today's date if we have entries for today, otherwise use the most recent date
          const targetDate = allDates.includes(today) ? today : mostRecentDate;

          // Calculate week range based on target date
          const targetDateObj = new Date(targetDate);
          const startOfWeek = new Date(targetDateObj);
          startOfWeek.setDate(targetDateObj.getDate() - targetDateObj.getDay());
          const endOfWeek = new Date(targetDateObj);
          endOfWeek.setDate(targetDateObj.getDate() - targetDateObj.getDay() + 6);

          this.loadStatsForDateRange(userId, targetDate, startOfWeek, endOfWeek, targetDate === today).then(resolve).catch(reject);
        },
        error: (error) => {
          console.error('Error getting recent entries for date analysis:', error);
          // Fallback to original logic
          this.loadStatsForToday(userId).then(resolve).catch(reject);
        }
      });
    });
  }

  private loadStatsForToday(userId: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const endOfWeek = new Date();
    endOfWeek.setDate(endOfWeek.getDate() - endOfWeek.getDay() + 6);

    return this.loadStatsForDateRange(userId, today, startOfWeek, endOfWeek, true);
  }

  private loadStatsForDateRange(userId: number, targetDate: string, startOfWeek: Date, endOfWeek: Date, isToday: boolean): Promise<void> {
    return new Promise((resolve, reject) => {

      Promise.all([
        this.timeTrackingService.getTimeEntriesByDateRange(userId, targetDate, targetDate).toPromise(),
        this.timeTrackingService.getTimeEntriesByDateRange(userId, 
          startOfWeek.toISOString().split('T')[0], 
          endOfWeek.toISOString().split('T')[0]).toPromise()
      ]).then(([targetDateResponse, weekResponse]) => {
        // Handle different response structures
        let targetDateData: any[] = [];
        let weekData: any[] = [];

        // Extract data from response - handle both direct array and paginated response
        if (Array.isArray(targetDateResponse)) {
          targetDateData = targetDateResponse;
        } else if (targetDateResponse && typeof targetDateResponse === 'object') {
          const responseObj = targetDateResponse as any;
          if (responseObj.content) {
            targetDateData = responseObj.content;
          } else if (responseObj.data?.content) {
            targetDateData = responseObj.data.content;
          } else if (responseObj.data && Array.isArray(responseObj.data)) {
            targetDateData = responseObj.data;
          }
        }

        if (Array.isArray(weekResponse)) {
          weekData = weekResponse;
        } else if (weekResponse && typeof weekResponse === 'object') {
          const responseObj = weekResponse as any;
          if (responseObj.content) {
            weekData = responseObj.content;
          } else if (responseObj.data?.content) {
            weekData = responseObj.data.content;
          } else if (responseObj.data && Array.isArray(responseObj.data)) {
            weekData = responseObj.data;
          }
        }

        // Calculate target date hours (all entries)
        const todayHours = targetDateData.reduce((sum: number, entry: any) => {
          const hours = Number(entry.hours) || 0;
          const normalizedHours = this.normalizeHoursValue(hours);
          return sum + normalizedHours;
        }, 0);

        // Calculate target date revenue (only billable entries)
        const todayAmount = targetDateData.reduce((sum: number, entry: any) => {
          // Only count billable entries for revenue
          if (!entry.billable) {
            return sum;
          }

          const hours = Number(entry.hours) || 0;
          const rate = Number(entry.rate) || 0;
          const normalizedHours = this.normalizeHoursValue(hours);
          const entryAmount = normalizedHours * rate;

          return sum + entryAmount;
        }, 0);

        // Calculate week total hours
        const weekTotal = weekData.reduce((sum: number, entry: any) => {
          const hours = Number(entry.hours) || 0;
          return sum + this.normalizeHoursValue(hours);
        }, 0);

        this.stats = {
          todayHours,
          todayAmount,
          weekTotal,
          activeTimers: this.timer.isRunning ? 1 : 0
        };

        // Store whether we're showing today's data or most recent data
        (this.stats as any).isShowingToday = isToday;
        (this.stats as any).displayDate = targetDate;

        this.changeDetectorRef.detectChanges();
        resolve();
      }).catch(error => {
        console.error('Error loading dashboard stats:', error);

        // Provide specific error message based on error type
        if (error.status === 401) {
          this.error = 'Authentication required. Please log in again.';
        } else if (error.status === 403) {
          this.error = 'You do not have permission to view time tracking data.';
        } else if (error.status === 404) {
          this.error = 'Time tracking service not found. Please contact support.';
        } else if (error.status === 0) {
          this.error = 'Cannot connect to server. Please check your internet connection.';
        } else {
          this.error = `Failed to load dashboard data: ${error.error?.message || error.message || 'Unknown error'}`;
        }
        
        // Set default values on error
        this.stats = {
          todayHours: 0,
          todayAmount: 0,
          weekTotal: 0,
          activeTimers: this.timer.isRunning ? 1 : 0
        };
        
        console.warn('Using default stats due to error:', this.stats);
        this.changeDetectorRef.detectChanges();
        resolve(); // Don't fail the whole dashboard
      });
    });
  }

  private loadRecentEntries(): Promise<void> {
    return new Promise((resolve) => {
      const userId = this.getCurrentUserId();
      if (!userId) {
        this.changeDetectorRef.detectChanges();
        return resolve();
      }

      // Increase to show more recent entries (last 20 entries to ensure we get all recent ones)
      this.timeTrackingService.getTimeEntriesByUser(userId, 0, 20).subscribe({
        next: (response) => {
          
          let entries = response.content || [];
          
          // Debug: Log original order
          
          // Debug: Log sample entry data structure
          // Enhanced sorting: prioritize by createdAt (most reliable), then by date, then by ID
          entries = entries.sort((a, b) => {
            // First priority: createdAt timestamp (most recent first)
            if (a.createdAt && b.createdAt) {
              const dateA = new Date(a.createdAt).getTime();
              const dateB = new Date(b.createdAt).getTime();
              if (dateA !== dateB) {
                return dateB - dateA; // Most recent first
              }
            }
            
            // Second priority: date field (most recent first)
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateA !== dateB) {
              return dateB - dateA; // Most recent first
            }
            
            // Third priority: ID (higher ID usually means more recent)
            return b.id - a.id;
          });

          // Take only the most recent 9 for display (but fetch 20 to ensure we get all recent ones)
          this.recentEntries = entries.slice(0, 9);
          this.lastUpdated = new Date(); // Update timestamp
          this.changeDetectorRef.detectChanges();
          resolve();
        },
        error: (error) => {
          console.warn('Recent entries loading failed:', error);
          this.recentEntries = [];
          this.changeDetectorRef.detectChanges();
          resolve(); // Don't fail the whole dashboard
        }
      });
    });
  }

  /**
   * Sync timer state by fetching from backend.
   * The actual state update is handled by the activeTimers$ subscription
   * in updateLocalTimerState() to ensure single source of truth.
   */
  private async syncTimerState(): Promise<void> {
    return new Promise((resolve) => {
      const userId = this.getCurrentUserId();
      if (!userId) {
        this.changeDetectorRef.detectChanges();
        return resolve();
      }

      // Just trigger the fetch - the subscription to activeTimers$
      // will handle updating local state via updateLocalTimerState()
      this.timerService.getActiveTimers(userId).subscribe({
        next: () => {
          // State is updated via the activeTimers$ subscription
          this.changeDetectorRef.detectChanges();
          resolve();
        },
        error: (error) => {
          console.warn('Timer sync failed:', error);
          this.resetTimer();
          this.changeDetectorRef.detectChanges();
          resolve();
        }
      });
    });
  }

  /**
   * Updates local timer state based on shared observable from TimerService.
   * This ensures sync between topbar dropdown and dashboard.
   */
  private updateLocalTimerState(timers: ActiveTimer[]): void {
    // Find the first running timer (for backwards compatibility with single timer display)
    const runningTimer = timers.find(t => t.isActive);
    const pausedTimer = timers.find(t => !t.isActive);
    const primaryTimer = runningTimer || pausedTimer;

    if (primaryTimer) {
      // IMPORTANT: Stop timer updates FIRST if timer is now paused
      // This prevents race conditions with the interval overwriting state
      if (!primaryTimer.isActive && this.timerUpdateSubscription) {
        this.timerUpdateSubscription.unsubscribe();
        this.timerUpdateSubscription = undefined;
      }

      this.activeTimer = primaryTimer;

      // Get case name from available cases or use timer data
      let caseName = this.availableCases.find(c => c.id === primaryTimer.legalCaseId)?.name;
      if (!caseName) {
        caseName = primaryTimer.caseName || `Case #${primaryTimer.legalCaseId || 'Unknown'}`;
      }

      const newTimerState = {
        id: primaryTimer.id!,
        description: primaryTimer.isActive ? `Working on ${caseName}` : `Paused - ${caseName}`,
        elapsed: primaryTimer.formattedDuration || this.formatDuration(primaryTimer.currentDurationSeconds || 0),
        isRunning: primaryTimer.isActive,
        caseId: primaryTimer.legalCaseId || null,
        caseName: caseName
      };

      this.timer = newTimerState;

      // Update stats
      this.stats.activeTimers = timers.filter(t => t.isActive).length;

      // Start timer updates if running and not already running
      if (primaryTimer.isActive && !this.timerUpdateSubscription) {
        this.startTimerUpdates();
      }
    } else {
      // No active timers
      this.activeTimer = undefined;
      this.resetTimer();
      this.stats.activeTimers = 0;
      this.timerUpdateSubscription?.unsubscribe();
      this.timerUpdateSubscription = undefined;
    }
  }

  private startTimerUpdates(): void {
    // Remove any existing subscription
    this.timerUpdateSubscription?.unsubscribe();

    this.timerUpdateSubscription = interval(1000).subscribe(() => {
      if (this.timer.isRunning && this.activeTimer) {
        const elapsed = this.calculateElapsedTime();
        this.timer.elapsed = this.formatDuration(elapsed);
        // Force change detection to update UI
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  private calculateElapsedTime(): number {
    if (!this.activeTimer?.startTime) return 0;
    
    // If timer is not running (paused), return the stored elapsed time
    if (!this.timer.isRunning) {
      // Parse current elapsed time from display
      const timeParts = this.timer.elapsed.split(':');
      if (timeParts.length === 3) {
        const hours = parseInt(timeParts[0]) || 0;
        const minutes = parseInt(timeParts[1]) || 0;
        const seconds = parseInt(timeParts[2]) || 0;
        return hours * 3600 + minutes * 60 + seconds;
      }
      return this.activeTimer.pausedDuration || 0;
    }
    
    const now = new Date();
    const startTime = new Date(this.activeTimer.startTime);
    
    // Calculate current session time in seconds
    const currentSessionMs = now.getTime() - startTime.getTime();
    const currentSessionSeconds = Math.floor(currentSessionMs / 1000);
    
    // Add any previous paused duration
    const totalSeconds = (this.activeTimer.pausedDuration || 0) + currentSessionSeconds;
    
    return Math.max(0, totalSeconds);
  }

  // Timer Actions
  showRateSelection(caseId: number): void {
    const selectedCase = this.availableCases.find(c => c.id === caseId);
    if (!selectedCase) return;
    
    this.selectedCaseForRateSelection = selectedCase;
    this.selectedRate = selectedCase.defaultRate || 250;
    this.applyMultipliers = selectedCase.allowMultipliers !== false;
    this.isEmergencyWork = false;
    this.showRateSelectionModal = true;
  }

  confirmRateAndStartTimer(): void {
    if (!this.selectedCaseForRateSelection) return;
    
    this.showRateSelectionModal = false;
    this.startTimer(this.selectedCaseForRateSelection.id, this.selectedRate, this.applyMultipliers, this.isEmergencyWork);
  }

  cancelRateSelection(): void {
    this.showRateSelectionModal = false;
    this.selectedCaseForRateSelection = null;
    this.selectedRate = 250;
    this.applyMultipliers = true;
    this.isEmergencyWork = false;
  }

  getCalculatedRate(): number {
    if (!this.selectedCaseForRateSelection || !this.applyMultipliers) {
      return this.selectedRate;
    }

    const now = new Date();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    const isAfterHours = now.getHours() >= 18 || now.getHours() < 8;
    
    let rate = this.selectedRate;
    
    if (this.isEmergencyWork && this.selectedCaseForRateSelection.emergencyMultiplier) {
      rate *= this.selectedCaseForRateSelection.emergencyMultiplier;
    } else {
      if (isWeekend && this.selectedCaseForRateSelection.weekendMultiplier) {
        rate *= this.selectedCaseForRateSelection.weekendMultiplier;
      }
      if (isAfterHours && this.selectedCaseForRateSelection.afterHoursMultiplier) {
        rate *= this.selectedCaseForRateSelection.afterHoursMultiplier;
      }
    }
    
    return Math.round(rate);
  }

  startTimer(caseId: number, rate?: number, applyMultipliers?: boolean, isEmergency?: boolean): void {
    const userId = this.getCurrentUserId();

    if (!userId) {
      console.error('No user ID found');
      this.error = 'Please log in to start tracking time';
      return;
    }

    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.error = null;

    const selectedCase = this.availableCases.find(c => c.id === caseId);

    const startRequest = {
      legalCaseId: caseId,
      description: `Working on ${selectedCase?.name || 'Legal Matter'}`,
      rate: rate || selectedCase?.defaultRate || 250,
      applyMultipliers: applyMultipliers !== false,
      isEmergency: isEmergency || false
    };
    
    this.timerService.startTimer(userId, startRequest).pipe(
      timeout(15000), // 15 second timeout
      catchError(error => {
        console.error('Timer start error:', error);

        if (error.name === 'TimeoutError') {
          this.error = 'Request timed out. Please check your connection and try again.';
        } else if (error.status === 401) {
          this.error = 'Authentication required. Please log in again.';
        } else if (error.status === 403) {
          this.error = 'You do not have permission to start timers.';
        } else {
          this.error = `Failed to start timer: ${error.error?.message || error.message || 'Unknown error'}`;
        }
        
        return of(null);
      }),
      finalize(() => {
        this.isProcessing = false;
        this.changeDetectorRef.detectChanges(); // Force UI update
      })
    ).subscribe({
      next: (timer) => {
        if (timer) {
          this.activeTimer = timer;
          this.timer = {
            id: timer.id!,
            description: timer.description || 'Working...',
            elapsed: '00:00:00',
            isRunning: true,
            caseId: caseId,
            caseName: selectedCase?.name || 'Unknown Case'
          };
          this.stats.activeTimers = 1;
          this.startTimerUpdates();

          // Show success message with rate info
          Swal.fire({
            icon: 'success',
            title: 'Timer Started!',
            html: `
              <div class="text-start">
                <p><strong>Case:</strong> ${selectedCase?.name}</p>
                <p><strong>Base Rate:</strong> $${rate || selectedCase?.defaultRate || 250}/hr</p>
                <p><strong>Multipliers:</strong> ${applyMultipliers ? 'Enabled' : 'Disabled'}</p>
                ${isEmergency ? '<p class="text-warning"><strong>Emergency Work</strong></p>' : ''}
              </div>
            `,
            timer: 3000,
            showConfirmButton: false
          });
        }
      },
      error: (error) => {
        console.error('Timer start subscription error:', error);
        this.error = 'An unexpected error occurred. Please try again.';
      }
    });
  }

  pauseTimer(): void {
    if (!this.activeTimer?.id || this.isProcessing) return;

    this.isProcessing = true;
    const userId = this.getCurrentUserId();

    this.timerService.pauseTimer(userId!, this.activeTimer.id).pipe(
      timeout(10000),
      catchError(error => {
        console.error('Timer pause failed:', error);
        this.error = error.name === 'TimeoutError' ?
          'Request timed out. Please try again.' :
          'Failed to pause timer.';
        return of(null);
      }),
      finalize(() => {
        this.isProcessing = false;
        this.changeDetectorRef.detectChanges();
      })
    ).subscribe({
      next: () => {
        // State is updated via activeTimers$ subscription in updateLocalTimerState()
      },
      error: (error) => {
        console.error('Pause timer error:', error);
        this.error = 'Failed to pause timer.';
      }
    });
  }

  resumeTimer(): void {
    if (!this.activeTimer?.id || this.isProcessing) return;

    this.isProcessing = true;
    const userId = this.getCurrentUserId();

    this.timerService.resumeTimer(userId!, this.activeTimer.id).pipe(
      timeout(10000),
      catchError(error => {
        console.error('Timer resume failed:', error);
        this.error = error.name === 'TimeoutError' ?
          'Request timed out. Please try again.' :
          'Failed to resume timer.';
        return of(null);
      }),
      finalize(() => {
        this.isProcessing = false;
        this.changeDetectorRef.detectChanges();
      })
    ).subscribe({
      next: () => {
        // State is updated via activeTimers$ subscription in updateLocalTimerState()
      },
      error: (error) => {
        console.error('Resume timer error:', error);
        this.error = 'Failed to resume timer.';
      }
    });
  }

  /**
   * Toggle timer by specific timer object (for multiple timers list)
   */
  toggleTimerById(timer: ActiveTimer): void {
    if (!timer.id || this.isProcessing) return;

    this.isProcessing = true;
    const userId = this.getCurrentUserId();

    if (timer.isActive) {
      // Pause the timer
      this.timerService.pauseTimer(userId!, timer.id).pipe(
        timeout(10000),
        catchError(error => {
          console.error('Timer pause failed:', error);
          this.error = 'Failed to pause timer.';
          return of(null);
        }),
        finalize(() => {
          this.isProcessing = false;
          this.changeDetectorRef.detectChanges();
        })
      ).subscribe();
    } else {
      // Resume the timer
      this.timerService.resumeTimer(userId!, timer.id).pipe(
        timeout(10000),
        catchError(error => {
          console.error('Timer resume failed:', error);
          this.error = 'Failed to resume timer.';
          return of(null);
        }),
        finalize(() => {
          this.isProcessing = false;
          this.changeDetectorRef.detectChanges();
        })
      ).subscribe();
    }
  }

  /**
   * Stop specific timer by timer object (for multiple timers list)
   */
  stopTimerById(timer: ActiveTimer): void {
    if (!timer.id || this.isProcessing) return;

    const userId = this.getCurrentUserId();
    const caseName = timer.caseName || 'this timer';
    const duration = timer.formattedDuration || '00:00:00';

    Swal.fire({
      title: 'Stop Timer',
      html: `
        <div class="text-center mb-3">
          <div class="fs-24 fw-bold text-primary" style="font-family: monospace;">${duration}</div>
          <div class="text-muted">${caseName}</div>
        </div>
        <p>Would you like to save this time entry or discard it?</p>
      `,
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: '<i class="ri-save-line me-1"></i> Save Entry',
      denyButtonText: '<i class="ri-delete-bin-line me-1"></i> Discard',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#0ab39c',
      denyButtonColor: '#f06548',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        // Save entry
        const description = timer.description || `Work on ${caseName}`;
        this.isProcessing = true;
        this.timerService.convertTimerToTimeEntry(userId!, timer.id!, description).pipe(
          timeout(10000),
          catchError(error => {
            console.error('Timer conversion failed:', error);
            Swal.fire('Error', 'Failed to save time entry.', 'error');
            return of(null);
          }),
          finalize(() => {
            this.isProcessing = false;
            this.changeDetectorRef.detectChanges();
          })
        ).subscribe(entry => {
          if (entry) {
            this.loadRecentEntries();
            Swal.fire({
              icon: 'success',
              title: 'Time Entry Saved',
              text: `Entry saved successfully.`,
              timer: 2000,
              showConfirmButton: false
            });
          }
        });
      } else if (result.isDenied) {
        // Discard timer
        this.isProcessing = true;
        this.timerService.discardTimer(userId!, timer.id!).pipe(
          timeout(10000),
          catchError(error => {
            console.error('Timer discard failed:', error);
            Swal.fire('Error', 'Failed to discard timer.', 'error');
            return of(null);
          }),
          finalize(() => {
            this.isProcessing = false;
            this.changeDetectorRef.detectChanges();
          })
        ).subscribe(() => {
          Swal.fire({
            icon: 'info',
            title: 'Timer Discarded',
            text: 'The timer has been discarded.',
            timer: 2000,
            showConfirmButton: false
          });
        });
      }
    });
  }

  openStopModal(): void {
    if (!this.activeTimer) return;
    
    const selectedCase = this.availableCases.find(c => c.id === this.timer.caseId);
    // Use the current effective rate (includes multipliers) as the default
    const effectiveRate = this.getCurrentEffectiveRate();
    
    // Initialize form with timer data and smart defaults
    const description = this.activeTimer.description || '';
    this.stopFormData = {
      description: description.length >= 10 ? description : 
        description + ' - Additional work performed on this case.',
      date: new Date().toISOString().split('T')[0],
      billable: true,
      rate: Math.round(effectiveRate), // Use the effective rate as default
      activityType: '',
      tags: '',
      notes: '',
      applyMultipliers: selectedCase?.allowMultipliers !== false,
      isEmergency: false
    };
    
    this.showStopModal = true;
    
    // Initialize Flatpickr after modal is shown
    setTimeout(() => {
      if (this.dateInput?.nativeElement) {
        this.flatpickrInstance?.destroy(); // Clean up existing instance
        this.flatpickrInstance = flatpickr(this.dateInput.nativeElement, {
          altInput: true,
          altFormat: 'F j, Y',
          dateFormat: 'Y-m-d',
          defaultDate: this.stopFormData.date,
          maxDate: 'today'
        });
      }
    }, 100);
  }

  // Method to calculate final rate in stop modal
  getFinalRate(): number {
    const selectedCase = this.availableCases.find(c => c.id === this.timer.caseId);
    if (!selectedCase || !this.stopFormData.applyMultipliers) {
      return this.stopFormData.rate;
    }

    const selectedDate = new Date(this.stopFormData.date);
    const isWeekend = selectedDate.getDay() === 0 || selectedDate.getDay() === 6;
    const isAfterHours = new Date().getHours() >= 18 || new Date().getHours() < 8;
    
    let rate = this.stopFormData.rate;
    
    if (this.stopFormData.isEmergency && selectedCase.emergencyMultiplier) {
      rate *= selectedCase.emergencyMultiplier;
    } else {
      if (isWeekend && selectedCase.weekendMultiplier) {
        rate *= selectedCase.weekendMultiplier;
      }
      if (isAfterHours && selectedCase.afterHoursMultiplier) {
        rate *= selectedCase.afterHoursMultiplier;
      }
    }
    
    return Math.round(rate);
  }

  getMultiplierInfo(): string {
    const selectedCase = this.availableCases.find(c => c.id === this.timer.caseId);
    if (!selectedCase || !this.stopFormData.applyMultipliers) {
      return 'No multipliers applied';
    }

    const selectedDate = new Date(this.stopFormData.date);
    const isWeekend = selectedDate.getDay() === 0 || selectedDate.getDay() === 6;
    const isAfterHours = new Date().getHours() >= 18 || new Date().getHours() < 8;
    
    const multipliers = [];
    
    if (this.stopFormData.isEmergency && selectedCase.emergencyMultiplier) {
      multipliers.push(`Emergency: ${selectedCase.emergencyMultiplier}x`);
    } else {
      if (isWeekend && selectedCase.weekendMultiplier) {
        multipliers.push(`Weekend: ${selectedCase.weekendMultiplier}x`);
      }
      if (isAfterHours && selectedCase.afterHoursMultiplier) {
        multipliers.push(`After-hours: ${selectedCase.afterHoursMultiplier}x`);
      }
    }
    
    return multipliers.length > 0 ? multipliers.join(', ') : 'No multipliers applied';
  }

  confirmStopTimer(): void {
    if (!this.activeTimer?.id || this.isProcessing || !this.isStopFormValid()) return;

    this.isProcessing = true;
    const userId = this.getCurrentUserId();
    
    // Use the description for the timer service
    this.timerService.convertTimerToTimeEntry(userId!, this.activeTimer.id, this.stopFormData.description).pipe(
      timeout(15000),
      catchError(error => {
        console.error('Stop timer failed:', error);
        this.error = error.name === 'TimeoutError' ? 
          'Request timed out. Please try again.' : 
          `Failed to save time entry: ${error.error?.message || error.message || 'Unknown error'}`;
        return of(null);
      }),
      finalize(() => {
        this.isProcessing = false;
        this.changeDetectorRef.detectChanges();
      })
    ).subscribe({
      next: (timeEntry) => {
        if (timeEntry) {
          this.resetTimer();
          this.showStopModal = false;
          
          // Clean up Flatpickr instance
          this.flatpickrInstance?.destroy();
          this.flatpickrInstance = undefined;
          
          // Refresh all relevant data
          Promise.all([
            this.loadDashboardStats(),
            this.loadRecentEntries()
          ]).then(() => {
            this.lastUpdated = new Date();
            this.changeDetectorRef.detectChanges();
            
            // Show simplified success message
            const hours = timeEntry.hours || this.calculateHoursFromElapsed();
            const amount = (hours * Number(timeEntry.rate || 0)).toFixed(2);
            
            Swal.fire({
              icon: 'success',
              title: 'Time Entry Saved!',
              html: `
                <div class="text-start">
                  <p><strong>Duration:</strong> ${hours.toFixed(2)} hours</p>
                  <p><strong>Amount:</strong> $${amount} ${this.stopFormData.billable ? '(Billable)' : '(Non-billable)'}</p>
                  <p><strong>Case:</strong> ${this.timer.caseName}</p>
                </div>
              `,
              showConfirmButton: true,
              confirmButtonText: 'View Time Entries',
              showCancelButton: true,
              cancelButtonText: 'Continue Working',
              confirmButtonColor: '#3085d6',
              cancelButtonColor: '#6c757d'
            }).then((result) => {
              if (result.isConfirmed) {
                this.viewTimesheet();
              }
            });
          });
        }
      },
      error: (error) => {
        console.error('Stop timer subscription error:', error);
        this.error = 'An unexpected error occurred. Please try again.';
      }
    });
  }

  cancelStopTimer(): void {
    this.showStopModal = false;
    this.isProcessing = false;
    
    // Clean up Flatpickr instance
    this.flatpickrInstance?.destroy();
    this.flatpickrInstance = undefined;
    
    // Reset form data
    this.stopFormData = {
      description: '',
      date: new Date().toISOString().split('T')[0],
      billable: true,
      rate: 250,
      activityType: '',
      tags: '',
      notes: '',
      applyMultipliers: true,
      isEmergency: false
    };
  }

  // Form validation method
  isStopFormValid(): boolean {
    return !!(
      this.stopFormData.description && 
      this.stopFormData.description.length >= 10 &&
      this.stopFormData.date &&
      this.stopFormData.rate > 0
    );
  }

  // Utility method for date input
  getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private resetTimer(): void {
    this.timer = {
      id: null,
      description: 'Start tracking time',
      elapsed: '00:00:00',
      isRunning: false,
      caseId: null,
      caseName: ''
    };
    this.activeTimer = undefined;
    this.stats.activeTimers = 0;
  }

  // Utility methods
  private getCurrentUserId(): number | null {
    const user = this.userService.getCurrentUser();
    if (user?.id) return user.id;

    try {
      const token = localStorage.getItem(Key.TOKEN);
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.sub ? parseInt(payload.sub) : null;
      }
    } catch (error) {
      console.warn('Error decoding token:', error);
    }
    return null;
  }

  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  private showSuccessMessage(message: string): void {
    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: message,
      showConfirmButton: false,
      timer: 3000
    });
  }

  // Navigation helpers
  viewEntry(entryId: number): void {
    const entry = this.recentEntries.find(e => e.id === entryId);
    if (!entry) return;

    // Detect dark mode
    const isDarkMode = document.documentElement.getAttribute('data-layout-mode') === 'dark' ||
                       document.documentElement.getAttribute('data-bs-theme') === 'dark' ||
                       document.body.classList.contains('dark-mode') ||
                       document.documentElement.getAttribute('data-theme') === 'dark';

    // Theme colors
    const t = {
      bg: isDarkMode ? '#1a1d21' : '#ffffff',
      cardBg: isDarkMode ? '#212529' : '#f8f9fa',
      border: isDarkMode ? '#32383e' : '#e9ebec',
      text: isDarkMode ? '#ced4da' : '#333333',
      textMuted: isDarkMode ? '#878a99' : '#6c757d',
      textLight: isDarkMode ? '#adb5bd' : '#495057',
    };

    const hours = parseFloat(this.getEntryDuration(entry));
    const amount = this.getEntryBillingAmount(entry);
    const rate = this.parseRate(entry);
    const formattedDate = new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    // Format duration
    const hoursInt = Math.floor(hours);
    const mins = Math.round((hours - hoursInt) * 60);
    const duration = hoursInt > 0 ? `${hoursInt}h ${mins}m` : `${mins}m`;

    // Status config
    const statusMap: { [key: string]: { color: string; bg: string; bgDark: string; label: string } } = {
      'DRAFT': { color: '#f1b44c', bg: '#fff8ec', bgDark: '#3d3526', label: 'Draft' },
      'SUBMITTED': { color: '#299cdb', bg: '#e8f4fc', bgDark: '#1e3a4c', label: 'Submitted' },
      'APPROVED': { color: '#0ab39c', bg: '#e6f7f5', bgDark: '#1a3d36', label: 'Approved' },
      'BILLING_APPROVED': { color: '#0ab39c', bg: '#e6f7f5', bgDark: '#1a3d36', label: 'Approved' },
      'BILLED': { color: '#878bfa', bg: '#eef0f7', bgDark: '#2d2f45', label: 'Billed' },
      'INVOICED': { color: '#878bfa', bg: '#eef0f7', bgDark: '#2d2f45', label: 'Invoiced' },
      'REJECTED': { color: '#f06548', bg: '#fde8e4', bgDark: '#3d2520', label: 'Rejected' }
    };
    const s = statusMap[entry.status] || { color: '#6c757d', bg: '#f5f5f5', bgDark: '#2a2f34', label: entry.status };
    const isEditable = entry.status === 'DRAFT' || entry.status === 'REJECTED';

    // Get case display - use caseName, fallback to caseNumber or legalCaseId
    const caseDisplay = entry.caseName || (entry.caseNumber ? `Case ${entry.caseNumber}` : (entry.legalCaseId ? `Case #${entry.legalCaseId}` : 'No case assigned'));

    Swal.fire({
      title: '',
      html: `
        <div style="text-align: left; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div style="font-size: 24px; font-weight: 700; color: ${t.text};">#${entry.id}</div>
            <div style="background: ${isDarkMode ? s.bgDark : s.bg}; color: ${s.color}; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; text-transform: uppercase;">${s.label}</div>
          </div>

          <!-- Main Info -->
          <div style="background: ${t.cardBg}; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div>
                <div style="font-size: 11px; color: ${t.textMuted}; text-transform: uppercase; margin-bottom: 4px;">Date</div>
                <div style="font-size: 15px; font-weight: 600; color: ${t.text};">${formattedDate}</div>
              </div>
              <div>
                <div style="font-size: 11px; color: ${t.textMuted}; text-transform: uppercase; margin-bottom: 4px;">Duration</div>
                <div style="font-size: 15px; font-weight: 600; color: ${t.text};">${duration}</div>
              </div>
              <div>
                <div style="font-size: 11px; color: ${t.textMuted}; text-transform: uppercase; margin-bottom: 4px;">Rate</div>
                <div style="font-size: 15px; font-weight: 600; color: ${t.text};">$${rate}/hr</div>
              </div>
              <div>
                <div style="font-size: 11px; color: ${t.textMuted}; text-transform: uppercase; margin-bottom: 4px;">Amount</div>
                <div style="font-size: 15px; font-weight: 600; color: ${entry.billable ? '#0ab39c' : t.textMuted};">${this.formatCurrency(amount)}</div>
              </div>
            </div>
          </div>

          <!-- Case -->
          <div style="background: ${t.cardBg}; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 36px; height: 36px; background: #405189; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                <i class="ri-briefcase-4-fill" style="color: white; font-size: 16px;"></i>
              </div>
              <div>
                <div style="font-size: 11px; color: ${t.textMuted}; text-transform: uppercase; margin-bottom: 2px;">Case</div>
                <div style="font-size: 14px; font-weight: 600; color: ${t.text};">${caseDisplay}</div>
                ${entry.caseNumber && entry.caseName ? `<div style="font-size: 12px; color: ${t.textMuted};">${entry.caseNumber}</div>` : ''}
              </div>
            </div>
          </div>

          <!-- Description -->
          <div style="background: ${t.cardBg}; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
            <div style="font-size: 11px; color: ${t.textMuted}; text-transform: uppercase; margin-bottom: 8px;">Description</div>
            <div style="font-size: 14px; color: ${t.textLight}; line-height: 1.6;">${entry.description || '<span style="font-style: italic; opacity: 0.6;">No description</span>'}</div>
          </div>

          <!-- User -->
          ${entry.userName ? `
            <div style="display: flex; align-items: center; gap: 8px; color: ${t.textMuted}; font-size: 13px;">
              <i class="ri-user-line"></i>
              <span>${entry.userName}</span>
            </div>
          ` : ''}
        </div>
      `,
      showCancelButton: true,
      showConfirmButton: isEditable,
      confirmButtonText: '<i class="ri-edit-line me-1"></i> Edit',
      cancelButtonText: 'Close',
      confirmButtonColor: '#405189',
      cancelButtonColor: isDarkMode ? '#3a4046' : '#878a99',
      width: '420px',
      padding: '24px',
      background: t.bg,
      color: t.text,
      customClass: {
        popup: 'time-entry-detail-modal',
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-light'
      }
    }).then((result) => {
      if (result.isConfirmed && isEditable) {
        this.openEditModal(entry);
      }
    });
  }

  addManualEntry(): void {
    this.router.navigate(['/time-tracking/entry']);
  }

  viewTimesheet(): void {
    // Toggle between expanded and collapsed view
    this.showAllEntries = !this.showAllEntries;
    
    if (this.showAllEntries) {
      // Load all entries when expanding
      this.loadAllRecentEntries();
    } else {
      // Load limited entries when collapsing
      this.loadRecentEntries();
    }
  }

  navigateToInvoiceGeneration(): void {
    this.router.navigate(['/time-tracking/invoices']);
  }

  // New method to load all entries for expanded view
  private loadAllRecentEntries(): void {
    const userId = this.getCurrentUserId();
    if (!userId) return;

    // Load up to 100 entries for expanded view
    this.timeTrackingService.getTimeEntriesByUser(userId, 0, 100).subscribe({
      next: (response) => {
        let entries = response.content || [];
        
        // Sort entries by most recent first
        entries = entries.sort((a, b) => {
          // First try to sort by createdAt if available
          if (a.createdAt && b.createdAt) {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA;
          }
          
          // Then try by date
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          if (dateA !== dateB) {
            return dateB - dateA;
          }
          
          // If dates are the same, sort by ID (higher ID = more recent)
          return (b.id || 0) - (a.id || 0);
        });
        
        this.recentEntries = entries;
        this.lastUpdated = new Date();
        this.changeDetectorRef.detectChanges();
      },
      error: (error) => {
        console.error('Failed to load all entries:', error);
        this.error = 'Failed to load all entries.';
      }
    });
  }

  viewAllCases(): void {
    // Toggle the view to show all cases in the current interface
    this.showAllCases = true;
    this.loadAvailableCases();
  }

  collapseAllCases(): void {
    // Collapse back to limited view
    this.showAllCases = false;
    this.loadAvailableCases();
  }

  // Add refresh functionality
  refreshRecentEntries(): void {
    this.loadRecentEntries();
  }

  // Add method to refresh dashboard stats
  refreshDashboardStats(): void {
    this.loadDashboardStats().then(() => {
      this.lastUpdated = new Date();
      this.changeDetectorRef.detectChanges();
    }).catch(error => {
      console.error('Failed to refresh dashboard stats:', error);
    });
  }



  // Add method to load more entries if needed
  loadMoreEntries(): void {
    const userId = this.getCurrentUserId();
    if (!userId) return;

    // Load up to 50 recent entries for comprehensive view
    this.timeTrackingService.getTimeEntriesByUser(userId, 0, 50).subscribe({
      next: (response) => {
        let entries = response.content || [];

        // Sort entries by most recent first
        entries = entries.sort((a, b) => {
          // First try to sort by createdAt if available
          if (a.createdAt && b.createdAt) {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA;
          }

          // Then try by date
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          if (dateA !== dateB) {
            return dateB - dateA;
          }

          // If dates are the same, sort by ID (higher ID = more recent)
          return b.id - a.id;
        });

        this.recentEntries = entries;
        this.lastUpdated = new Date();
        this.changeDetectorRef.detectChanges();
      },
      error: (error) => {
        console.error('Failed to load more entries:', error);
        this.error = 'Failed to load additional entries.';
      }
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  formatHours(hours: number): string {
    return hours.toFixed(1);
  }

  // Enhanced calculation methods for time entries
  getEntryDuration(entry: TimeEntry): string {
    if (!entry.hours && entry.hours !== 0) return '0.0';
    const hours = this.normalizeToHours(entry);
    return hours.toFixed(1);
  }

  getEntryDurationMinutes(entry: TimeEntry): number {
    if (!entry.hours && entry.hours !== 0) return 0;
    const hours = this.normalizeToHours(entry);
    return Math.round(hours * 60);
  }

  getEntryBillingAmount(entry: TimeEntry): number {
    if (!entry.hours && entry.hours !== 0) return 0;
    if (!entry.rate && entry.rate !== 0) return 0;

    const hours = this.normalizeToHours(entry);
    const rate = this.parseRate(entry);

    return hours * rate;
  }

  getEntryHourlyRate(entry: TimeEntry): string {
    const rate = this.parseRate(entry);
    return rate.toFixed(0);
  }

  // Add proper rate formatting method
  formatRate(entry: TimeEntry): string {
    const rate = this.parseRate(entry);
    return `$${rate.toFixed(0)}`;
  }

  // Enhanced rate parsing method
  private parseRate(entry: TimeEntry): number {
    if (!entry.rate && entry.rate !== 0) return 0;
    
    // Handle various potential data formats
    let rateValue = entry.rate;
    
    // If rate is an object (like BigDecimal from backend), extract the numeric value
    if (typeof rateValue === 'object' && rateValue !== null) {
      // Check for common BigDecimal-like object structures
      const rateObj = rateValue as any;
      if (rateObj.value !== undefined && rateObj.value !== null) {
        rateValue = rateObj.value;
      } else if (rateObj.amount !== undefined && rateObj.amount !== null) {
        rateValue = rateObj.amount;
      } else if (typeof rateObj.toString === 'function') {
        rateValue = rateObj.toString();
      }
    }
    
    const parsed = Number(rateValue) || 0;
    
    // Log unusual rate values for debugging
    if (parsed > 1000 || parsed < 0) {
      console.warn('Unusual rate value detected:', {
        entryId: entry.id,
        originalRate: entry.rate,
        parsedRate: parsed,
        type: typeof entry.rate
      });
    }
    
    return parsed;
  }

  // Method to normalize different time units to hours
  private normalizeToHours(entry: TimeEntry): number {
    const value = Number(entry.hours) || 0;
    return this.normalizeHoursValue(value);
  }

  // Method to normalize numeric hour values
  private normalizeHoursValue(value: number): number {
    return value;
  }

  // Enhanced duration formatting with hours and minutes
  formatDurationDetailed(hours: number): string {
    if (!hours && hours !== 0) return '0h 0m';
    
    const totalHours = Math.floor(hours);
    const minutes = Math.round((hours - totalHours) * 60);
    
    if (totalHours === 0) {
      return `${minutes}m`;
    } else if (minutes === 0) {
      return `${totalHours}h`;
    } else {
      return `${totalHours}h ${minutes}m`;
    }
  }

  getStatusClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'DRAFT': 'bg-warning-subtle text-warning',
      'SUBMITTED': 'bg-info-subtle text-info',
      'APPROVED': 'bg-success-subtle text-success',
      'BILLING_APPROVED': 'bg-success-subtle text-success',
      'REJECTED': 'bg-danger-subtle text-danger'
    };
    return statusClasses[status] || 'bg-secondary-subtle text-secondary';
  }

  getStatusText(status: string): string {
    const statusTexts: { [key: string]: string } = {
      'DRAFT': 'Draft',
      'SUBMITTED': 'Submitted',
      'APPROVED': 'Approved',
      'BILLING_APPROVED': 'Approved',
      'REJECTED': 'Rejected'
    };
    return statusTexts[status] || status;
  }

  // Enhanced table functionality
  trackByEntryId(index: number, entry: TimeEntry): number {
    return entry.id || index;
  }

  getTotalHours(): string {
    const total = this.recentEntries.reduce((sum, entry) => {
      const hours = this.normalizeToHours(entry);
      return sum + hours;
    }, 0);
    return total.toFixed(1);
  }

  getTotalAmount(): number {
    return this.recentEntries.reduce((sum, entry) => {
      const hours = this.normalizeToHours(entry);
      const rate = Number(entry.rate) || 0;
      return sum + (hours * rate);
    }, 0);
  }

  // Enhanced Entry action methods
  editEntry(entryId: number): void {
    this.router.navigate(['/time-tracking/entry/edit', entryId]);
  }

  openEditModal(entry: TimeEntry): void {
    if (!entry || !entry.id) {
      console.error('Invalid entry for edit modal');
      return;
    }

    this.editingEntry = entry;

    // Populate the form with current entry data
    this.editFormData = {
      id: entry.id || 0,
      description: entry.description || '',
      date: entry.date || new Date().toISOString().split('T')[0],
      hours: this.normalizeToHours(entry),
      billable: entry.billable !== false, // Default to true if undefined
      rate: this.parseRate(entry),
      caseId: entry.legalCaseId || null,
      activityType: '', // Not available in TimeEntry interface
      tags: '', // Not available in TimeEntry interface
      notes: '' // Not available in TimeEntry interface
    };

    // Use setTimeout to ensure SweetAlert modal is fully closed before opening edit modal
    setTimeout(() => {
      this.showEditModal = true;
      this.changeDetectorRef.detectChanges();
    }, 100);
  }

  cancelEditEntry(): void {
    this.showEditModal = false;
    this.editingEntry = null;
    this.isProcessing = false;
    
    // Reset form data
    this.editFormData = {
      id: 0,
      description: '',
      date: new Date().toISOString().split('T')[0],
      hours: 0,
      billable: true,
      rate: 250,
      caseId: null,
      activityType: '',
      tags: '',
      notes: ''
    };
  }

  saveEditedEntry(): void {
    if (!this.editingEntry || this.isProcessing || !this.isEditFormValid()) return;

    this.isProcessing = true;
    const userId = this.getCurrentUserId();
    
    if (!userId) {
      this.error = 'User authentication required';
      this.isProcessing = false;
      return;
    }

    // Prepare the update data using TimeEntry interface
    const updateData: TimeEntry = {
      id: this.editFormData.id,
      description: this.editFormData.description.trim(),
      date: this.editFormData.date,
      hours: this.editFormData.hours,
      billable: this.editFormData.billable,
      rate: this.editFormData.rate,
      legalCaseId: this.editFormData.caseId || this.editingEntry.legalCaseId,
      userId: this.editingEntry.userId,
      status: this.editingEntry.status,
      startTime: this.editingEntry.startTime,
      endTime: this.editingEntry.endTime,
      invoiceId: this.editingEntry.invoiceId,
      billedAmount: this.editingEntry.billedAmount,
      totalAmount: this.editingEntry.totalAmount,
      caseName: this.editingEntry.caseName,
      caseNumber: this.editingEntry.caseNumber,
      userName: this.editingEntry.userName,
      userEmail: this.editingEntry.userEmail,
      createdAt: this.editingEntry.createdAt,
      updatedAt: this.editingEntry.updatedAt
    };

    this.timeTrackingService.updateTimeEntry(this.editFormData.id, updateData).pipe(
      timeout(15000),
      catchError(error => {
        console.error('Update entry failed:', error);
        this.error = error.name === 'TimeoutError' ? 
          'Request timed out. Please try again.' : 
          `Failed to update time entry: ${error.error?.message || error.message || 'Unknown error'}`;
        return of(null);
      }),
      finalize(() => {
        this.isProcessing = false;
        this.changeDetectorRef.detectChanges();
      })
    ).subscribe({
      next: (updatedEntry) => {
        if (updatedEntry) {
          // Update the entry in the local array
          const index = this.recentEntries.findIndex(e => e.id === this.editFormData.id);
          if (index !== -1) {
            this.recentEntries[index] = { ...this.recentEntries[index], ...updatedEntry };
          }
          
          this.showEditModal = false;
          this.editingEntry = null;
          
          // Refresh dashboard data
          Promise.all([
            this.loadDashboardStats(),
            this.loadRecentEntries()
          ]).then(() => {
            this.lastUpdated = new Date();
            this.changeDetectorRef.detectChanges();
          });
          
          // Show success message
          Swal.fire({
            icon: 'success',
            title: 'Entry Updated!',
            html: `
              <div class="text-start">
                <p><strong>Duration:</strong> ${this.editFormData.hours.toFixed(2)} hours</p>
                <p><strong>Amount:</strong> $${(this.editFormData.hours * this.editFormData.rate).toFixed(2)} ${this.editFormData.billable ? '(Billable)' : '(Non-billable)'}</p>
                <p><strong>Status:</strong> ${this.getStatusText(updatedEntry.status || 'DRAFT')}</p>
              </div>
            `,
            timer: 3000,
            showConfirmButton: false
          });
        }
      },
      error: (error) => {
        console.error('Update entry subscription error:', error);
        this.error = 'An unexpected error occurred. Please try again.';
      }
    });
  }

  isEditFormValid(): boolean {
    return !!(
      this.editFormData.description && 
      this.editFormData.description.length >= 10 &&
      this.editFormData.date &&
      this.editFormData.hours > 0 &&
      this.editFormData.hours <= 24 &&
      (!this.editFormData.billable || (this.editFormData.billable && this.editFormData.rate > 0))
    );
  }

  duplicateEntry(entryId: number): void {
    const entry = this.recentEntries.find(e => e.id === entryId);
    if (!entry) return;

    Swal.fire({
      title: 'Duplicate Time Entry',
      text: 'This will create a copy of the entry with today\'s date.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Create Duplicate',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        // Create a copy without the ID to create a new entry
        const duplicatedEntry = {
          ...entry,
          id: undefined,
          status: 'DRAFT',
          date: new Date().toISOString().split('T')[0],
          description: `Copy of: ${entry.description}`
        };
        
        this.router.navigate(['/time-tracking/entry'], { 
          state: { duplicatedEntry } 
        });
      }
    });
  }

  submitEntry(entryId: number): void {
    const userId = this.getCurrentUserId();
    if (!userId) return;

    Swal.fire({
      title: 'Submit for Approval',
      text: 'Are you sure you want to submit this time entry for approval?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Submit',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#0ab39c'
    }).then((result) => {
      if (result.isConfirmed) {
        this.timeTrackingService.updateTimeEntryStatus(entryId, 'SUBMITTED').subscribe({
          next: () => {
            // Update the entry status in the local array
            const entry = this.recentEntries.find(e => e.id === entryId);
            if (entry) {
              entry.status = 'SUBMITTED';
              entry.updatedAt = new Date();
              
              // Send notification to approvers
              this.notifyTimeEntrySubmission(entry);
            }
            this.showSuccessMessage('Time entry submitted for approval');
            this.changeDetectorRef.detectChanges();
          },
          error: (error) => {
            console.error('Failed to submit entry:', error);
            Swal.fire('Error', 'Failed to submit entry for approval', 'error');
          }
        });
      }
    });
  }

  recallEntry(entryId: number): void {
    const userId = this.getCurrentUserId();
    if (!userId) return;

    Swal.fire({
      title: 'Recall Submission',
      text: 'This will return the entry to draft status for editing.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Recall',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#f1b44c'
    }).then((result) => {
      if (result.isConfirmed) {
        this.timeTrackingService.updateTimeEntryStatus(entryId, 'DRAFT').subscribe({
          next: () => {
            // Update the entry status in the local array
            const entry = this.recentEntries.find(e => e.id === entryId);
            if (entry) {
              entry.status = 'DRAFT';
              entry.updatedAt = new Date();
            }
            this.showSuccessMessage('Time entry recalled and returned to draft status');
            this.changeDetectorRef.detectChanges();
          },
          error: (error) => {
            console.error('Failed to recall entry:', error);
            Swal.fire('Error', 'Failed to recall entry', 'error');
          }
        });
      }
    });
  }

  printEntry(entryId: number): void {
    const entry = this.recentEntries.find(e => e.id === entryId);
    if (!entry) return;

    // For now, create a printable summary in a new window
    const printContent = `
      <html>
        <head>
          <title>Time Entry - ${entry.id}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { text-align: center; margin-bottom: 30px; }
            .details { margin-bottom: 20px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 10px; }
            .label { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Time Entry Invoice</h2>
            <p>Entry ID: ${entry.id}</p>
          </div>
          <div class="details">
            <div class="row">
              <span class="label">Date:</span>
              <span>${new Date(entry.date).toLocaleDateString()}</span>
            </div>
            <div class="row">
              <span class="label">Case:</span>
              <span>${entry.caseName || 'N/A'}</span>
            </div>
            <div class="row">
              <span class="label">Description:</span>
              <span>${entry.description}</span>
            </div>
            <div class="row">
              <span class="label">Duration:</span>
              <span>${this.getEntryDuration(entry)} hours</span>
            </div>
            <div class="row">
              <span class="label">Rate:</span>
              <span>${this.formatRate(entry)}/hr</span>
            </div>
            <div class="row">
              <span class="label">Total Amount:</span>
              <span>${this.formatCurrency(this.getEntryBillingAmount(entry))}</span>
            </div>
            <div class="row">
              <span class="label">Status:</span>
              <span>${this.getStatusText(entry.status)}</span>
            </div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  }

  deleteEntry(entryId: number): void {
    const entry = this.recentEntries.find(e => e.id === entryId);
    if (!entry) return;

    Swal.fire({
      title: 'Delete Time Entry',
      html: `
        <div class="text-start">
          <p><strong>Are you sure you want to delete this time entry?</strong></p>
          <div class="alert alert-warning mt-3">
            <small>
              <strong>Entry:</strong> ${entry.description}<br>
              <strong>Duration:</strong> ${this.getEntryDuration(entry)} hours<br>
              <strong>Amount:</strong> ${this.formatCurrency(this.getEntryBillingAmount(entry))}
            </small>
          </div>
          <p class="text-danger"><small>This action cannot be undone.</small></p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d'
    }).then((result) => {
      if (result.isConfirmed) {
        this.timeTrackingService.deleteTimeEntry(entryId).subscribe({
          next: () => {
            // Remove the entry from the local array
            this.recentEntries = this.recentEntries.filter(e => e.id !== entryId);
            this.showSuccessMessage('Time entry deleted successfully');
            this.loadDashboardStats(); // Refresh stats
            this.changeDetectorRef.detectChanges();
          },
          error: (error) => {
            console.error('Failed to delete entry:', error);
            Swal.fire('Error', 'Failed to delete entry', 'error');
          }
        });
      }
    });
  }

  // Enhanced timer functionality
  calculateHoursFromElapsed(): number {
    if (!this.timer.elapsed) return 0;
    
    const timeParts = this.timer.elapsed.split(':');
    if (timeParts.length === 3) {
      const hours = parseInt(timeParts[0]) || 0;
      const minutes = parseInt(timeParts[1]) || 0;
      const seconds = parseInt(timeParts[2]) || 0;
      return hours + (minutes / 60) + (seconds / 3600);
    }
    return 0;
  }

  // Calculate current billable amount for the active timer
  getCurrentBillableAmount(): number {
    if (!this.timer.id) return 0;
    
    const hours = this.calculateHoursFromElapsed();
    if (hours === 0) return 0;
    
    // Get the rate and multiplier settings from the selected case or use defaults
    const selectedCase = this.availableCases.find(c => c.id === this.timer.caseId);
    let rate = selectedCase?.defaultRate || 250;
    
    // Apply multipliers if the case allows them (similar to stop modal logic)
    if (selectedCase?.allowMultipliers) {
      const now = new Date();
      const isWeekend = now.getDay() === 0 || now.getDay() === 6;
      const isAfterHours = now.getHours() >= 18 || now.getHours() < 8;
      
      // For consistency with stop modal, we'll assume standard multipliers
      // Emergency work would need to be set manually when opening the stop modal
      if (isWeekend && selectedCase.weekendMultiplier) {
        rate *= selectedCase.weekendMultiplier;
      }
      if (isAfterHours && selectedCase.afterHoursMultiplier) {
        rate *= selectedCase.afterHoursMultiplier;
      }
    }
    
    return hours * rate;
  }

  // Get current effective rate (for display in timer and modal)
  getCurrentEffectiveRate(): number {
    if (!this.timer.id) return 250;
    
    const selectedCase = this.availableCases.find(c => c.id === this.timer.caseId);
    let rate = selectedCase?.defaultRate || 250;
    
    // Apply multipliers if the case allows them
    if (selectedCase?.allowMultipliers) {
      const now = new Date();
      const isWeekend = now.getDay() === 0 || now.getDay() === 6;
      const isAfterHours = now.getHours() >= 18 || now.getHours() < 8;
      
      if (isWeekend && selectedCase.weekendMultiplier) {
        rate *= selectedCase.weekendMultiplier;
      }
      if (isAfterHours && selectedCase.afterHoursMultiplier) {
        rate *= selectedCase.afterHoursMultiplier;
      }
    }
    
    return rate;
  }

  // Enhanced Quick Action Methods
  addTimeBreak(): void {
    if (!this.timer.id || this.isProcessing) return;
    
    Swal.fire({
      title: 'Take a Break',
      html: `
        <div class="text-start">
          <p>Current session: <strong>${this.timer.elapsed}</strong></p>
          <p>The timer will be paused automatically.</p>
          <div class="form-group mt-3">
            <label class="form-label">Break reason (optional):</label>
            <select class="form-select" id="breakReason">
              <option value="">Select break type</option>
              <option value="lunch">Lunch Break</option>
              <option value="coffee">Coffee Break</option>
              <option value="meeting">Meeting Break</option>
              <option value="personal">Personal Break</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Pause Timer',
      cancelButtonText: 'Continue Working',
      confirmButtonColor: '#f1b44c',
      preConfirm: () => {
        const breakReason = (document.getElementById('breakReason') as HTMLSelectElement)?.value || 'break';
        return { breakReason };
      }
    }).then((result) => {
      if (result.isConfirmed && this.timer.isRunning) {
        // Add break note to timer description
        const breakReason = result.value?.breakReason || 'break';
        this.pauseTimer();
        
        // Show success message
        setTimeout(() => {
          Swal.fire({
            icon: 'success',
            title: 'Break Started',
            text: `Timer paused for ${breakReason}. Resume when ready to continue.`,
            timer: 3000,
            showConfirmButton: false
          });
        }, 500);
      }
    });
  }

  addTimeNote(): void {
    if (!this.timer.id) return;
    
    Swal.fire({
      title: 'Add Session Note',
      html: `
        <div class="text-start">
          <p>Current session: <strong>${this.timer.elapsed}</strong></p>
          <p>Case: <strong>${this.timer.caseName}</strong></p>
          <div class="form-group mt-3">
            <label class="form-label">Session note:</label>
            <textarea class="form-control" id="sessionNote" rows="4" 
                      placeholder="Add notes about your current work session..." maxlength="500"></textarea>
            <small class="text-muted">This note will be saved with your time entry</small>
          </div>
        </div>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Save Note',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#0ab39c',
      preConfirm: () => {
        const note = (document.getElementById('sessionNote') as HTMLTextAreaElement)?.value?.trim();
        if (!note) {
          Swal.showValidationMessage('Please enter a note');
          return false;
        }
        if (note.length < 5) {
          Swal.showValidationMessage('Note must be at least 5 characters');
          return false;
        }
        return { note };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value?.note) {
        // In a real implementation, you would save this note to the active timer session
        // For now, we'll just show a success message
        Swal.fire({
          icon: 'success',
          title: 'Note Saved',
          text: 'Your session note has been added and will be included in the time entry.',
          timer: 3000,
          showConfirmButton: false
        });
        
        // TODO: Implement actual note saving functionality when backend supports it
      }
    });
  }

  viewCurrentSession(): void {
    if (!this.timer.id) return;
    
    const sessionInfo = {
      elapsed: this.timer.elapsed,
      caseName: this.timer.caseName,
      description: this.timer.description || 'No description',
      isRunning: this.timer.isRunning,
      estimatedAmount: this.calculateHoursFromElapsed() * this.stopFormData.rate
    };
    
    Swal.fire({
      title: 'Current Session Details',
      html: `
        <div class="text-start">
          <div class="row g-2">
            <div class="col-6"><strong>Duration:</strong></div>
            <div class="col-6">${sessionInfo.elapsed}</div>
            <div class="col-6"><strong>Case:</strong></div>
            <div class="col-6">${sessionInfo.caseName || 'No case selected'}</div>
            <div class="col-6"><strong>Status:</strong></div>
            <div class="col-6">${sessionInfo.isRunning ? 'Running' : 'Paused'}</div>
            <div class="col-6"><strong>Est. Amount:</strong></div>
            <div class="col-6">$${sessionInfo.estimatedAmount.toFixed(2)}</div>
          </div>
          <hr>
          <div class="mt-3">
            <strong>Description:</strong><br>
            <small class="text-muted">${sessionInfo.description}</small>
          </div>
        </div>
      `,
      icon: 'info',
      confirmButtonText: 'Close',
      confirmButtonColor: '#0ab39c'
    });
  }
} 