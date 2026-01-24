import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FlatpickrModule } from 'angularx-flatpickr';
import { TimeTrackingService, TimeEntry } from '../../services/time-tracking.service';
import { TimerService, ActiveTimer, StartTimerRequest } from '../../services/timer.service';
import { UserService } from '../../../../service/user.service';
import { LegalCaseService } from '../../../legal/services/legal-case.service';
import { LegalCase } from '../../../legal/interfaces/case.interface';
import { interval, Subscription } from 'rxjs';
import Swal from 'sweetalert2';

interface LegalCaseOption {
  id: number;
  title: string;
  caseNumber: string;
  clientName: string;
  defaultRate?: number;
}

interface ActivityType {
  value: string;
  label: string;
}

interface TimerState {
  id: number | null;
  description: string;
  elapsed: string;
  isRunning: boolean;
  caseId: number | null;
  caseName: string;
}

@Component({
  selector: 'app-time-entry-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FlatpickrModule],
  templateUrl: './time-entry-form.component.html',
  styleUrls: ['./time-entry-form.component.scss']
})
export class TimeEntryFormComponent implements OnInit, OnDestroy {
  timeEntryForm!: FormGroup;
  isEditMode = false;
  entryId: number | null = null;
  loading = false;
  error: string | null = null;

  // Data for dropdowns
  legalCases: LegalCaseOption[] = [];
  recentCases: LegalCaseOption[] = [];
  activityTypes: ActivityType[] = [
    { value: 'Legal Research', label: 'Legal Research' },
    { value: 'Document Drafting', label: 'Document Drafting' },
    { value: 'Client Meeting', label: 'Client Meeting' },
    { value: 'Court Appearance', label: 'Court Appearance' },
    { value: 'Document Review', label: 'Document Review' },
    { value: 'Case Strategy', label: 'Case Strategy' },
    { value: 'Administrative', label: 'Administrative' },
    { value: 'Other', label: 'Other' }
  ];

  // Timer integration
  timer: TimerState = { 
    id: null, 
    description: 'Start tracking time', 
    elapsed: '00:00:00', 
    isRunning: false, 
    caseId: null, 
    caseName: '' 
  };
  hasActiveTimer = false;
  currentTimer: ActiveTimer | null = null;
  private activeTimer?: ActiveTimer;
  private timerUpdateSubscription?: Subscription;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private timeTrackingService: TimeTrackingService,
    private timerService: TimerService,
    private userService: UserService,
    private legalCaseService: LegalCaseService,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.checkForEditMode();
    this.loadLegalCases();
    this.checkActiveTimer();
    this.syncTimerState();
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.timerUpdateSubscription?.unsubscribe();
  }

  private initializeForm(): void {
    this.timeEntryForm = this.fb.group({
      legalCaseId: ['', Validators.required],
      date: [new Date().toISOString().split('T')[0], Validators.required],
      startTime: [''],
      endTime: [''],
      hours: ['', [Validators.required, Validators.min(0.1), Validators.max(24)]],
      rate: ['250.00', [Validators.required, Validators.min(0)]],
      description: ['', [Validators.required, Validators.minLength(5)]],
      billable: [true],
      status: ['DRAFT']
    });

    // Auto-calculate hours when start/end time changes
    this.timeEntryForm.get('startTime')?.valueChanges.subscribe(() => this.calculateHours());
    this.timeEntryForm.get('endTime')?.valueChanges.subscribe(() => this.calculateHours());
  }

  private checkForEditMode(): void {
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.entryId = +params['id'];
        this.loadTimeEntry();
      }
    });
  }

  private loadTimeEntry(): void {
    if (!this.entryId) return;

    this.loading = true;
    this.timeTrackingService.getTimeEntry(this.entryId).subscribe({
      next: (entry) => {
        this.timeEntryForm.patchValue({
          legalCaseId: entry.legalCaseId,
          date: entry.date,
          startTime: entry.startTime,
          endTime: entry.endTime,
          hours: entry.hours,
          rate: entry.rate,
          description: entry.description,
          billable: entry.billable,
          status: entry.status
        });

        this.loading = false;
        this.changeDetectorRef.detectChanges();
      },
      error: (error) => {
        console.error('Error loading time entry:', error);
        this.error = 'Failed to load time entry. Please try again.';
        this.loading = false;
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  private loadLegalCases(): void {
    this.loading = true;

    // Load all cases for the current user
    this.legalCaseService.getAllCases(0, 100).subscribe({
      next: (response) => {
        // Try different response structures
        let cases = [];

        if (response && response.data) {
          if (response.data.cases) {
            cases = response.data.cases;
          } else if (response.data.content) {
            cases = response.data.content;
          } else if (response.data.page && response.data.page.content) {
            cases = response.data.page.content;
          }
        } else if (Array.isArray(response)) {
          cases = response;
        }

        if (cases && cases.length > 0) {
          this.legalCases = cases.map((legalCase: any) => ({
            id: parseInt(legalCase.id),
            title: legalCase.title,
            caseNumber: legalCase.caseNumber,
            clientName: legalCase.clientName ||
                       (legalCase.client ? `${legalCase.client.firstName} ${legalCase.client.lastName}` : 'Unknown Client'),
            defaultRate: legalCase.billingInfo?.hourlyRate || legalCase.hourlyRate || 250
          }));

          // Set recent cases (last 5 cases)
          this.recentCases = this.legalCases.slice(0, 5);

          // If a case is selected from timer, set default rate
          const selectedCaseId = this.timeEntryForm.get('legalCaseId')?.value;
          if (selectedCaseId) {
            this.updateRateFromCase(selectedCaseId);
          }
        } else {
          this.legalCases = [];
          this.recentCases = [];
        }
        this.loading = false;
        this.changeDetectorRef.detectChanges();
      },
      error: (error) => {
        console.error('Error loading legal cases:', error);
        this.error = `Failed to load cases: ${error.message || 'Unknown error'}`;
        this.legalCases = [];
        this.recentCases = [];
        this.loading = false;
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  private async syncTimerState(): Promise<void> {
    const userId = this.getCurrentUserId();
    if (!userId) return;

    this.timerService.getActiveTimers(userId).subscribe({
      next: (timers) => {
        const activeTimer = timers.find(t => t.isActive);

        if (activeTimer) {
          this.hasActiveTimer = true;
          this.currentTimer = activeTimer;
          this.activeTimer = activeTimer;

          // Find case name
          const caseName = this.legalCases.find(c => c.id === activeTimer.legalCaseId)?.title ||
                          `Case #${activeTimer.legalCaseId}`;

          this.timer = {
            id: activeTimer.id!,
            description: activeTimer.description || 'Working...',
            elapsed: this.formatDuration(activeTimer.currentDurationSeconds || 0),
            isRunning: true,
            caseId: activeTimer.legalCaseId || null,
            caseName: caseName
          };

          this.startTimerUpdates();
        } else {
          this.resetTimer();
        }
        this.changeDetectorRef.detectChanges();
      },
      error: (error) => {
        console.warn('Timer sync failed:', error);
        this.resetTimer();
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  private checkActiveTimer(): void {
    // This will be handled by syncTimerState
    this.syncTimerState();
  }

  private calculateHours(): void {
    const startTime = this.timeEntryForm.get('startTime')?.value;
    const endTime = this.timeEntryForm.get('endTime')?.value;

    if (startTime && endTime) {
      const start = new Date(`2000-01-01 ${startTime}`);
      const end = new Date(`2000-01-01 ${endTime}`);
      
      if (end > start) {
        const diffMs = end.getTime() - start.getTime();
        const hours = diffMs / (1000 * 60 * 60);
        this.timeEntryForm.patchValue({ hours: hours.toFixed(2) }, { emitEvent: false });
      }
    }
  }

  private updateRateFromCase(caseId: number | string): void {
    const selectedCase = this.legalCases.find(c => c.id === parseInt(caseId.toString()));
    if (selectedCase && selectedCase.defaultRate) {
      this.timeEntryForm.patchValue({ rate: selectedCase.defaultRate });
    }
  }

  // Timer functionality
  private startTimerUpdates(): void {
    this.timerUpdateSubscription?.unsubscribe();
    
    this.timerUpdateSubscription = interval(1000).subscribe(() => {
      if (this.timer.isRunning && this.activeTimer) {
        const elapsed = this.calculateElapsedTime();
        this.timer.elapsed = this.formatDuration(elapsed);
      }
    });
  }

  private calculateElapsedTime(): number {
    if (!this.activeTimer?.startTime) return 0;
    
    if (!this.timer.isRunning) {
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
    const currentSessionMs = now.getTime() - startTime.getTime();
    const currentSessionSeconds = Math.floor(currentSessionMs / 1000);
    const totalSeconds = (this.activeTimer.pausedDuration || 0) + currentSessionSeconds;
    
    return Math.max(0, totalSeconds);
  }

  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
    this.hasActiveTimer = false;
    this.currentTimer = null;
    this.timerUpdateSubscription?.unsubscribe();
  }

  // Timer control methods (simplified for active timer detection only)
  stopTimerAndUse(): void {
    if (!this.currentTimer || !this.hasActiveTimer) return;

    const currentUserId = this.getCurrentUserId();
    if (!currentUserId) return;

    this.timerService.convertTimerToTimeEntry(currentUserId, this.currentTimer.id!, 'Converted from timer').subscribe({
      next: (timeEntry) => {
        // Populate form with timer data
        this.timeEntryForm.patchValue({
          legalCaseId: this.currentTimer!.legalCaseId,
          hours: (this.currentTimer!.currentDurationSeconds || 0) / 3600,
          description: this.currentTimer!.description || '',
          rate: 250 // Use default rate since ActiveTimer doesn't have rate property
        });
        
        this.resetTimer();
        
        Swal.fire({
          icon: 'success',
          title: 'Timer Stopped!',
          text: 'Timer data has been loaded into the form',
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: (error) => {
        console.error('Error stopping timer:', error);
        this.error = 'Failed to stop timer. Please try again.';
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  onSubmit(): void {
    if (this.timeEntryForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.loading = true;
    this.error = null;
    this.changeDetectorRef.detectChanges();

    const formData = this.timeEntryForm.value;
    const currentUserId = this.getCurrentUserId();

    if (!currentUserId) {
      this.error = 'Please log in to save time entries';
      this.loading = false;
      this.changeDetectorRef.detectChanges();
      return;
    }

    const timeEntry: TimeEntry = {
      ...formData,
      userId: currentUserId,
      hours: parseFloat(formData.hours),
      rate: parseFloat(formData.rate)
    };

    if (this.isEditMode && this.entryId) {
      // Update existing entry
      this.timeTrackingService.updateTimeEntry(this.entryId, timeEntry).subscribe({
        next: () => {
          this.router.navigate(['/time-tracking/timesheet']);
        },
        error: (error) => {
          console.error('Error updating time entry:', error);
          this.error = 'Failed to update time entry. Please try again.';
          this.loading = false;
          this.changeDetectorRef.detectChanges();
        }
      });
    } else {
      // Create new entry
      this.timeTrackingService.createTimeEntry(timeEntry).subscribe({
        next: () => {
          this.router.navigate(['/time-tracking/timesheet']);
        },
        error: (error) => {
          console.error('Error creating time entry:', error);
          this.error = 'Failed to create time entry. Please try again.';
          this.loading = false;
          this.changeDetectorRef.detectChanges();
        }
      });
    }
  }

  onSaveAsDraft(): void {
    if (this.timeEntryForm.invalid) {
      this.markFormGroupTouched();
      return;
    }
    
    // Set status to DRAFT and submit
    this.timeEntryForm.patchValue({ status: 'DRAFT' });
    this.onSubmit();
  }

  onSubmitForApproval(): void {
    if (this.timeEntryForm.invalid) {
      this.markFormGroupTouched();
      return;
    }
    
    // Set status to SUBMITTED and submit
    this.timeEntryForm.patchValue({ status: 'SUBMITTED' });
    this.onSubmit();
  }

  onCancel(): void {
    this.router.navigate(['/time-tracking/timesheet']);
  }

  // Utility methods
  isFieldInvalid(fieldName: string): boolean {
    const field = this.timeEntryForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.timeEntryForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) return `${fieldName} is required`;
      if (field.errors['min']) return `${fieldName} must be greater than ${field.errors['min'].min}`;
      if (field.errors['max']) return `${fieldName} must be less than ${field.errors['max'].max}`;
      if (field.errors['minlength']) return `${fieldName} must be at least ${field.errors['minlength'].requiredLength} characters`;
    }
    return '';
  }

  private markFormGroupTouched(): void {
    Object.keys(this.timeEntryForm.controls).forEach(key => {
      const control = this.timeEntryForm.get(key);
      control?.markAsTouched();
    });
  }

  private getCurrentUserId(): number | null {
    const user = this.userService.getCurrentUser();
    return user ? user.id : null;
  }

  getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  selectCase(caseId: number): void {
    this.timeEntryForm.patchValue({ legalCaseId: caseId });
    this.updateRateFromCase(caseId);
  }

  onCaseSelectionChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    if (target.value) {
      this.updateRateFromCase(target.value);
    }
  }
} 
 