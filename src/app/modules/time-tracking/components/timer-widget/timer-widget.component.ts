import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription, interval, timer } from 'rxjs';
import { TimerService, ActiveTimer, StartTimerRequest } from '../../services/timer.service';

export interface LegalCase {
  id: number;
  name: string;
  caseNumber: string;
  isRecent?: boolean;
}

export interface TimeEntry {
  id: number;
  caseNumber: string;
  description: string;
  hours: number;
  date: Date;
  status: string;
}

export interface ValidationErrors {
  caseRequired: boolean;
  descriptionTooShort: boolean;
}

export interface RateModifier {
  type: 'weekend' | 'after-hours' | 'emergency';
  label: string;
  multiplier: number;
}

export interface QuickTimer {
  id: number;
  isRunning: boolean;
  elapsedSeconds: number;
  description?: string;
  caseId?: number;
}

@Component({
  selector: 'app-timer-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './timer-widget.component.html',
  styleUrls: ['./timer-widget.component.scss']
})
export class TimerWidgetComponent implements OnInit, OnDestroy {
  private timerService = inject(TimerService);
  private router = inject(Router);
  
  // Signals for reactive state management
  private activeTimersSignal = signal<ActiveTimer[]>([]);
  private isExpandedSignal = signal<boolean>(false);
  private legalCasesSignal = signal<LegalCase[]>([]);
  private recentEntriesSignal = signal<TimeEntry[]>([]);
  private quickTimerSignal = signal<QuickTimer>({ id: 0, isRunning: false, elapsedSeconds: 0 });
  private validationErrorsSignal = signal<ValidationErrors>({ caseRequired: false, descriptionTooShort: false });
  private calculatedRateSignal = signal<number | null>(null);
  private rateModifiersSignal = signal<RateModifier[]>([]);
  private dailyHoursSignal = signal<number>(0);
  
  // Computed values
  activeTimers = computed(() => this.activeTimersSignal());
  isExpanded = computed(() => this.isExpandedSignal());
  legalCases = computed(() => this.legalCasesSignal());
  allCases = computed(() => this.legalCasesSignal());
  recentCases = computed(() => this.legalCasesSignal().filter(c => c.isRecent));
  recentEntries = computed(() => this.recentEntriesSignal());
  quickTimer = computed(() => this.quickTimerSignal());
  validationErrors = computed(() => this.validationErrorsSignal());
  calculatedRate = computed(() => this.calculatedRateSignal());
  rateModifiers = computed(() => this.rateModifiersSignal());
  dailyHours = computed(() => this.dailyHoursSignal());
  
  activeTimersCount = computed(() => this.activeTimersSignal().filter(t => t.isActive).length);
  
  // Constants
  readonly minDescriptionLength = 10;
  readonly maxDailyHours = 16;
  
  // Form data
  selectedCaseId: number | null = null;
  timerDescription: string = '';
  
  // Current user (would typically come from auth service)
  private currentUserId = 1; // TODO: Get from auth service
  
  private subscription = new Subscription();
  private timerUpdateSubscription?: Subscription;

  ngOnInit(): void {
    this.loadActiveTimers();
    this.loadLegalCases();
    this.loadRecentEntries();
    this.loadDailyHours();
    this.setupTimerSubscription();
    this.startTimerUpdates();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.timerUpdateSubscription?.unsubscribe();
  }

  private setupTimerSubscription(): void {
    this.subscription.add(
      this.timerService.activeTimers$.subscribe(timers => {
        this.activeTimersSignal.set(timers);
        this.updateQuickTimerFromActive();
      })
    );
  }

  private startTimerUpdates(): void {
    // Update timer every second
    this.timerUpdateSubscription = interval(1000).subscribe(() => {
      this.updateQuickTimerElapsed();
    });
  }

  private updateQuickTimerElapsed(): void {
    const currentQuickTimer = this.quickTimerSignal();
    if (currentQuickTimer.id > 0 && currentQuickTimer.isRunning) {
      this.quickTimerSignal.update(timer => ({
        ...timer,
        elapsedSeconds: timer.elapsedSeconds + 1
      }));
    }
  }

  private updateQuickTimerFromActive(): void {
    const activeTimers = this.activeTimersSignal();
    const activeTimer = activeTimers.find(t => t.isActive);
    
    if (activeTimer && activeTimer.id) {
      const elapsedSeconds = activeTimer.currentDurationSeconds ? 
        Number(activeTimer.currentDurationSeconds) : 0;
      
      this.quickTimerSignal.set({
        id: activeTimer.id,
        isRunning: activeTimer.isActive || false,
        elapsedSeconds: elapsedSeconds,
        description: activeTimer.description,
        caseId: activeTimer.legalCaseId
      });
    } else if (activeTimers.length === 0) {
      this.quickTimerSignal.set({ id: 0, isRunning: false, elapsedSeconds: 0 });
    }
  }

  private loadActiveTimers(): void {
    this.timerService.getActiveTimers(this.currentUserId).subscribe({
      next: (timers) => {
        this.activeTimersSignal.set(timers);
      },
      error: (error) => {
        console.error('Error loading active timers:', error);
      }
    });
  }

  private loadLegalCases(): void {
    // TODO: Load from legal case service
    // For now, using enhanced mock data
    const mockCases: LegalCase[] = [
      { id: 1, name: 'Smith vs. Jones Personal Injury', caseNumber: 'PI-2024-001', isRecent: true },
      { id: 2, name: 'ABC Corp Contract Dispute', caseNumber: 'COMM-2024-002', isRecent: true },
      { id: 3, name: 'Estate Planning - Johnson Family', caseNumber: 'EST-2024-003', isRecent: true },
      { id: 4, name: 'Criminal Defense - State vs. Williams', caseNumber: 'CRIM-2024-004', isRecent: false },
      { id: 5, name: 'Trademark Registration - TechStart Inc', caseNumber: 'IP-2024-005', isRecent: false },
      { id: 6, name: 'Employment Dispute - Manager Termination', caseNumber: 'EMP-2024-006', isRecent: false }
    ];
    this.legalCasesSignal.set(mockCases);
  }

  private loadRecentEntries(): void {
    // TODO: Load from time tracking service
    const mockEntries: TimeEntry[] = [
      {
        id: 1,
        caseNumber: 'PI-2024-001',
        description: 'Client meeting and case review',
        hours: 2.5,
        date: new Date(),
        status: 'DRAFT'
      },
      {
        id: 2,
        caseNumber: 'COMM-2024-002',
        description: 'Contract analysis and research',
        hours: 1.5,
        date: new Date(Date.now() - 86400000),
        status: 'SUBMITTED'
      },
      {
        id: 3,
        caseNumber: 'EST-2024-003',
        description: 'Will preparation and document review',
        hours: 3.0,
        date: new Date(Date.now() - 172800000),
        status: 'BILLING_APPROVED'
      }
    ];
    this.recentEntriesSignal.set(mockEntries);
  }

  private loadDailyHours(): void {
    // TODO: Load from time tracking service
    // Calculate from recent entries for today
    const today = new Date().toDateString();
    const todayEntries = this.recentEntriesSignal().filter(
      entry => entry.date.toDateString() === today
    );
    const totalHours = todayEntries.reduce((sum, entry) => sum + entry.hours, 0);
    this.dailyHoursSignal.set(totalHours);
  }

  // UI State Methods
  toggleExpanded(): void {
    this.isExpandedSignal.set(!this.isExpandedSignal());
  }

  hasActiveTimer(): boolean {
    return this.quickTimerSignal().id > 0 && this.quickTimerSignal().isRunning;
  }

  hasPausedTimer(): boolean {
    return this.quickTimerSignal().id > 0 && !this.quickTimerSignal().isRunning;
  }

  getCurrentDuration(): string {
    const seconds = this.quickTimerSignal().elapsedSeconds;
    return this.formatElapsedTime(seconds);
  }

  getSelectedCaseName(): string {
    const caseId = this.quickTimerSignal().caseId || this.selectedCaseId;
    const selectedCase = this.legalCasesSignal().find(c => c.id === caseId);
    return selectedCase ? `${selectedCase.caseNumber} - ${selectedCase.name}` : 'Unknown Case';
  }

  formatElapsedTime(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  dailyHoursPercentage(): number {
    return Math.min((this.dailyHoursSignal() / this.maxDailyHours) * 100, 100);
  }

  // Validation Methods
  hasValidationErrors(): boolean {
    const errors = this.validationErrorsSignal();
    return errors.caseRequired || errors.descriptionTooShort;
  }

  getValidationErrors(): string[] {
    const errors: string[] = [];
    const validationErrors = this.validationErrorsSignal();
    
    if (validationErrors.caseRequired) {
      errors.push('Please select a legal matter to track time against');
    }
    if (validationErrors.descriptionTooShort) {
      errors.push(`Description must be at least ${this.minDescriptionLength} characters`);
    }
    
    return errors;
  }

  private validateForm(): boolean {
    const errors: ValidationErrors = {
      caseRequired: !this.selectedCaseId,
      descriptionTooShort: this.timerDescription.trim().length < this.minDescriptionLength
    };
    
    this.validationErrorsSignal.set(errors);
    return !errors.caseRequired && !errors.descriptionTooShort;
  }

  canStartTimer(): boolean {
    return this.selectedCaseId !== null && 
           this.timerDescription.trim().length >= this.minDescriptionLength;
  }

  // Rate Calculation Methods
  private calculateRate(): void {
    if (!this.selectedCaseId) {
      this.calculatedRateSignal.set(null);
      this.rateModifiersSignal.set([]);
      return;
    }

    // TODO: Call backend rate calculation service
    // For now, using mock calculation
    let baseRate = 300; // Default attorney rate
    const modifiers: RateModifier[] = [];
    
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();
    
    // Weekend multiplier
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      baseRate *= 1.5;
      modifiers.push({
        type: 'weekend',
        label: 'Weekend',
        multiplier: 1.5
      });
    }
    
    // After hours multiplier
    if (hour < 8 || hour >= 18) {
      baseRate *= 1.25;
      modifiers.push({
        type: 'after-hours',
        label: 'After Hours',
        multiplier: 1.25
      });
    }
    
    this.calculatedRateSignal.set(baseRate);
    this.rateModifiersSignal.set(modifiers);
  }

  // Timer Control Methods
  startQuickTimer(): void {
    if (!this.validateForm()) return;

    this.calculateRate();

    const request: StartTimerRequest = {
      legalCaseId: this.selectedCaseId!,
      description: this.timerDescription || undefined
    };

    this.timerService.startTimer(this.currentUserId, request).subscribe({
      next: (timer) => {
        // Update quick timer immediately for responsive UI
        this.quickTimerSignal.set({
          id: timer.id || 0,
          isRunning: true,
          elapsedSeconds: 0,
          description: timer.description,
          caseId: timer.legalCaseId
        });
        
        this.resetForm();
        // Timer will be updated via the subscription
      },
      error: (error) => {
        console.error('Error starting timer:', error);
        // TODO: Show error notification
      }
    });
  }

  pauseQuickTimer(): void {
    const timerId = this.quickTimerSignal().id;
    if (timerId <= 0) return;

    // Update UI immediately for responsiveness
    this.quickTimerSignal.update(timer => ({ ...timer, isRunning: false }));

    this.timerService.pauseTimer(this.currentUserId, timerId).subscribe({
      next: (timer) => {
        // Timer will be updated via the subscription
      },
      error: (error) => {
        console.error('Error pausing timer:', error);
        // Revert UI state on error
        this.quickTimerSignal.update(timer => ({ ...timer, isRunning: true }));
      }
    });
  }

  resumeQuickTimer(): void {
    const timerId = this.quickTimerSignal().id;
    if (timerId <= 0) return;

    // Update UI immediately for responsiveness
    this.quickTimerSignal.update(timer => ({ ...timer, isRunning: true }));

    this.timerService.resumeTimer(this.currentUserId, timerId).subscribe({
      next: (timer) => {
        // Timer will be updated via the subscription
      },
      error: (error) => {
        console.error('Error resuming timer:', error);
        // Revert UI state on error
        this.quickTimerSignal.update(timer => ({ ...timer, isRunning: false }));
      }
    });
  }

  stopQuickTimer(): void {
    const timerId = this.quickTimerSignal().id;
    if (timerId <= 0) return;

    // Update UI immediately
    this.quickTimerSignal.set({ id: 0, isRunning: false, elapsedSeconds: 0 });

    this.timerService.stopTimer(this.currentUserId, timerId).subscribe({
      next: () => {
        // Timer will be removed via the subscription
        this.loadRecentEntries(); // Refresh recent entries
        this.loadDailyHours(); // Update daily hours
      },
      error: (error) => {
        console.error('Error stopping timer:', error);
      }
    });
  }

  // Legacy timer control methods for compatibility
  pauseTimer(timerId: number): void {
    this.timerService.pauseTimer(this.currentUserId, timerId).subscribe({
      next: (timer) => {
        // Timer will be updated via the subscription
      },
      error: (error) => {
        console.error('Error pausing timer:', error);
      }
    });
  }

  resumeTimer(timerId: number): void {
    this.timerService.resumeTimer(this.currentUserId, timerId).subscribe({
      next: (timer) => {
        // Timer will be updated via the subscription
      },
      error: (error) => {
        console.error('Error resuming timer:', error);
      }
    });
  }

  stopTimer(timerId: number): void {
    this.timerService.stopTimer(this.currentUserId, timerId).subscribe({
      next: () => {
        // Timer will be removed via the subscription
      },
      error: (error) => {
        console.error('Error stopping timer:', error);
      }
    });
  }

  convertToTimeEntry(timerId: number): void {
    const timer = this.activeTimersSignal().find(t => t.id === timerId);
    if (!timer) return;

    const description = timer.description || 'Time tracked via timer';
    
    this.timerService.convertTimerToTimeEntry(this.currentUserId, timerId, description).subscribe({
      next: (timeEntry) => {
        // TODO: Show success notification
        this.loadRecentEntries(); // Refresh recent entries
        this.loadDailyHours(); // Update daily hours
      },
      error: (error) => {
        console.error('Error converting timer to time entry:', error);
      }
    });
  }

  // Navigation Methods
  viewAllEntries(): void {
    this.router.navigate(['/time-tracking/entries']);
  }

  // Form Management
  private resetForm(): void {
    this.selectedCaseId = null;
    this.timerDescription = '';
    this.validationErrorsSignal.set({ caseRequired: false, descriptionTooShort: false });
    this.calculatedRateSignal.set(null);
    this.rateModifiersSignal.set([]);
  }

  // Watch for form changes to trigger validation and rate calculation
  onCaseSelectionChange(): void {
    this.calculateRate();
    this.validateForm();
  }

  onDescriptionChange(): void {
    this.validateForm();
  }
} 
 
 