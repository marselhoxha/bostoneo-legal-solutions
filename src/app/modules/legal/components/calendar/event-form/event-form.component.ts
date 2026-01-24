import { Component, OnInit, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CalendarEvent, CreateEventRequest } from '../../../interfaces/calendar-event.interface';
import { CaseService } from '../../../services/case.service';
import { Observable, Subject, Subscription } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { ApiResponse } from '../../../interfaces/api-response.interface';
import flatpickr from 'flatpickr';
import { Instance as FlatpickrInstance } from 'flatpickr/dist/types/instance';

@Component({
  selector: 'app-event-form',
  templateUrl: './event-form.component.html',
  styleUrls: ['./event-form.component.scss']
})
export class EventFormComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() event: CalendarEvent | Partial<CalendarEvent> | null = null;
  @Input() caseId: number | null = null;
  @Output() save = new EventEmitter<CreateEventRequest>();
  @Output() cancel = new EventEmitter<void>();

  @ViewChild('startTimeFlatpickr') startTimeEl: ElementRef;
  @ViewChild('endTimeFlatpickr') endTimeEl: ElementRef;
  @ViewChild('recurrenceEndDateFlatpickr') recurrenceEndDateEl: ElementRef;

  eventForm: FormGroup;
  eventTypes = [
    'COURT_DATE', 'DEADLINE', 'CLIENT_MEETING', 'TEAM_MEETING', 
    'DEPOSITION', 'MEDIATION', 'CONSULTATION', 'REMINDER', 'OTHER'
  ];
  statuses = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'PENDING'];
  cases$: Observable<any[]>;
  isLoading = false;
  
  // Custom reminder properties
  customReminderMinutes: number = 60;
  showCustomAdditionalReminder: boolean = false;
  customAdditionalMinutes: number = 60;
  selectedAdditionalReminders: number[] = [];
  additionalReminderOption: string = '';
  
  // Flag to show/hide deadline-specific fields
  showDeadlineFields: boolean = false;
  
  // Flatpickr instances
  private startTimePicker: FlatpickrInstance;
  private endTimePicker: FlatpickrInstance;
  private recurrenceEndDatePicker: FlatpickrInstance;
  
  // Subscription management
  private destroy$ = new Subject<void>();
  private formSubscriptions: Subscription[] = [];
  
  constructor(
    private fb: FormBuilder,
    private caseService: CaseService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadCases();
    
    // Initialize selected additional reminders if event has them
    if (this.event?.additionalReminders && Array.isArray(this.event.additionalReminders)) {
      this.selectedAdditionalReminders = [...this.event.additionalReminders];
    }
    
    this.setupFormListeners();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initFlatpickr();
      this.setupColorPicker();
    });
  }

  ngOnDestroy(): void {
    // Clean up all subscriptions
    this.destroy$.next();
    this.destroy$.complete();
    
    // Clean up form subscriptions
    this.formSubscriptions.forEach(sub => sub.unsubscribe());
    
    // Destroy flatpickr instances to prevent memory leaks
    if (this.startTimePicker) {
      this.startTimePicker.destroy();
    }
    if (this.endTimePicker) {
      this.endTimePicker.destroy();
    }
    if (this.recurrenceEndDatePicker) {
      this.recurrenceEndDatePicker.destroy();
    }
  }

  private loadCases(): void {
    this.cases$ = this.caseService.getCases(0, 100).pipe(
      takeUntil(this.destroy$),
      map((response: ApiResponse<{ page: { content: any[] } }>) => {
        return response.data?.page?.content?.map(c => ({ id: c.id, title: c.title })) || [];
      })
    );
  }

  private setupFormListeners(): void {
    // Watch for reminder minutes changes to handle custom option
    const reminderSub = this.eventForm.get('reminderMinutes').valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        if (value === 'custom') {
          // Initialize with a reasonable default
          this.customReminderMinutes = 60;
        } else if (value > 0) {
          // Automatically check email notification if no notification method is selected
          const emailChecked = this.eventForm.get('emailNotification').value;
          const pushChecked = this.eventForm.get('pushNotification').value;
          
          if (!emailChecked && !pushChecked) {
            this.eventForm.get('emailNotification').setValue(true);
          }
        }
      });
    
    // Listen for event type changes to adjust form
    const eventTypeSub = this.eventForm.get('eventType').valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(type => {
        this.onEventTypeChange(type);
      });
      
    this.formSubscriptions.push(reminderSub, eventTypeSub);
  }

  private initFlatpickr(): void {
    if (!this.startTimeEl || !this.endTimeEl) return;
    
    // Initialize flatpickr for start time
    this.startTimePicker = flatpickr(this.startTimeEl.nativeElement, {
      enableTime: true,
      dateFormat: 'Y-m-d H:i',
      time_24hr: false,
      minuteIncrement: 15,
      defaultDate: this.event?.start || new Date(),
      onChange: (selectedDates) => {
        // Update the form value
        if (selectedDates.length > 0) {
          // Create JS Date object directly to avoid string formatting issues
          const date = new Date(selectedDates[0]);
          this.eventForm.get('startTime').setValue(date);
          
          // Update end time to be at least 1 hour after start time if not already set
          const currentEndTime = this.eventForm.get('endTime').value;
          if (!currentEndTime || new Date(currentEndTime) <= date) {
            const newEndTime = new Date(date.getTime());
            newEndTime.setHours(newEndTime.getHours() + 1);
            this.eventForm.get('endTime').setValue(newEndTime);
            
            // Update the end time picker
            if (this.endTimePicker) {
              this.endTimePicker.setDate(newEndTime);
            }
          }
        }
      }
    });
    
    // Initialize flatpickr for end time
    this.endTimePicker = flatpickr(this.endTimeEl.nativeElement, {
      enableTime: true,
      dateFormat: 'Y-m-d H:i',
      time_24hr: false,
      minuteIncrement: 15,
      defaultDate: this.event?.end || (this.event?.start ? new Date(new Date(this.event.start).getTime() + 3600000) : new Date(new Date().getTime() + 3600000)),
      onChange: (selectedDates) => {
        // Update the form value
        if (selectedDates.length > 0) {
          // Create JS Date object directly to avoid string formatting issues
          const date = new Date(selectedDates[0]);
          this.eventForm.get('endTime').setValue(date);
        }
      }
    });
    
    // Initialize recurrence end date picker if form has recurrence enabled
    if (this.eventForm.get('enableRecurrence').value) {
      this.initRecurrenceEndDatePicker();
    }
  }
  
  private initRecurrenceEndDatePicker(): void {
    if (!this.recurrenceEndDateEl?.nativeElement) return;
    
    try {
      // Get default date from event or 3 months from now
      const defaultEndDate = this.event?.recurrenceEndDate || 
        new Date(new Date().setMonth(new Date().getMonth() + 3));
      
      this.recurrenceEndDatePicker = flatpickr(this.recurrenceEndDateEl.nativeElement, {
        dateFormat: 'Y-m-d',
        defaultDate: defaultEndDate,
        minDate: 'today',
        onChange: (selectedDates) => {
          if (selectedDates.length > 0) {
            const date = new Date(selectedDates[0]);
            this.eventForm.get('recurrenceEndDate').setValue(date);
          }
        }
      });
    } catch (error) {
      console.error('Error initializing recurrence end date picker:', error);
    }
  }

  private initForm(): void {
    const startDate = this.event?.start ? new Date(this.event.start) : new Date();
    const endDate = this.event?.end 
      ? new Date(this.event.end) 
      : new Date(startDate.getTime() + 3600000); // Default to 1 hour after start
    
    // Parse recurrence rule if it exists
    const recurrenceInfo = this.parseRecurrenceRule(this.event?.recurrenceRule);

    // Make sure reminderMinutes is properly initialized as a number
    let initialReminderMinutes = 0;
    if (this.event?.reminderMinutes !== undefined && this.event?.reminderMinutes !== null) {
      initialReminderMinutes = Number(this.event.reminderMinutes);
    }
    
    this.eventForm = this.fb.group({
      title: [this.event?.title || '', [Validators.required]],
      description: [this.event?.description || ''],
      startTime: [startDate, [Validators.required]],
      endTime: [endDate],
      location: [this.event?.location || ''],
      eventType: [this.event?.eventType || null, [Validators.required]],
      status: [this.event?.status || null, [Validators.required]],
      allDay: [this.event?.allDay || false],
      caseId: [this.event?.caseId || this.caseId],
      reminderMinutes: [initialReminderMinutes],
      customReminderMinutes: [60, [Validators.min(5), Validators.max(43200)]],
      
      // Notification methods - default to email notification if there's a reminder
      emailNotification: [this.event?.emailNotification !== false && initialReminderMinutes > 0], 
      pushNotification: [this.event?.pushNotification === true], 
      
      // Recurrence fields
      enableRecurrence: [!!recurrenceInfo.frequency],
      recurrenceFrequency: [recurrenceInfo.frequency || 'WEEKLY'],
      recurrenceInterval: [recurrenceInfo.interval || 1],
      recurrenceEnd: [recurrenceInfo.endType || 'NEVER'],
      recurrenceEndDate: [recurrenceInfo.endDate || null],
      recurrenceCount: [recurrenceInfo.count || 10],
      
      // Deadline specific fields
      highPriority: [this.event?.highPriority || false],
      additionalReminders: [this.event?.additionalReminders || []]
    });
    
    // Initialize additional reminders from event
    if (this.event?.additionalReminders && Array.isArray(this.event.additionalReminders)) {
      this.selectedAdditionalReminders = [...this.event.additionalReminders];
      // Update form with these values
      this.updateAdditionalRemindersInForm();
    }
  }
  
  // Custom reminder methods
  setCustomReminder(): void {
    const minutes = this.eventForm.get('customReminderMinutes').value;

    if (minutes >= 5 && minutes <= 43200) {
      // Set the actual reminder minutes to the custom value
      this.eventForm.get('reminderMinutes').setValue(Number(minutes));
      
      // Auto-enable email notification if no notification method is selected
      const emailChecked = this.eventForm.get('emailNotification').value;
      const pushChecked = this.eventForm.get('pushNotification').value;
      
      if (!emailChecked && !pushChecked) {
        this.eventForm.get('emailNotification').setValue(true);
      }
    } else {
      // Reset to no reminder if invalid
      this.eventForm.get('reminderMinutes').setValue(0);
    }
  }
  
  onAdditionalReminderChange(value: string): void {
    this.additionalReminderOption = value;
    this.showCustomAdditionalReminder = value === 'custom';
  }
  
  addAdditionalReminder(): void {
    const minutes = Number(this.additionalReminderOption);
    
    if (this.additionalReminderOption && this.additionalReminderOption !== 'custom' && !isNaN(minutes)) {
      // Check if this reminder is already in the list
      if (!this.selectedAdditionalReminders.includes(minutes)) {
        this.selectedAdditionalReminders.push(minutes);
        this.updateAdditionalRemindersInForm();
      }
      
      // Reset the dropdown
      this.additionalReminderOption = '';
    }
  }
  
  addCustomAdditionalReminder(): void {
    const minutes = this.customAdditionalMinutes;
    
    if (minutes >= 5 && minutes <= 43200) {
      // Check if this reminder is already in the list
      if (!this.selectedAdditionalReminders.includes(minutes)) {
        this.selectedAdditionalReminders.push(minutes);
        this.updateAdditionalRemindersInForm();
      }
      
      // Reset custom fields
      this.showCustomAdditionalReminder = false;
      this.customAdditionalMinutes = 60;
      this.additionalReminderOption = '';
    }
  }
  
  removeAdditionalReminder(minutes: number): void {
    this.selectedAdditionalReminders = this.selectedAdditionalReminders.filter(m => m !== minutes);
    this.updateAdditionalRemindersInForm();
  }
  
  updateAdditionalRemindersInForm(): void {
    // Sort reminders by time (farthest to closest)
    this.selectedAdditionalReminders.sort((a, b) => b - a);
    
    // Update the form control
    this.eventForm.get('additionalReminders').setValue([...this.selectedAdditionalReminders]);
  }
  
  private parseRecurrenceRule(rule: string): any {
    if (!rule) {
      return {
        frequency: null,
        interval: 1,
        endType: 'NEVER',
        endDate: null,
        count: 10
      };
    }
    
    try {
      // Parse RRULE format (e.g., "FREQ=WEEKLY;INTERVAL=2;UNTIL=20220131T000000Z")
      const parts = rule.split(';');
      const result: any = {
        frequency: null,
        interval: 1,
        endType: 'NEVER',
        endDate: null,
        count: 10
      };
      
      parts.forEach(part => {
        const [key, value] = part.split('=');
        
        switch (key) {
          case 'FREQ':
            result.frequency = value;
            break;
          case 'INTERVAL':
            result.interval = parseInt(value) || 1;
            break;
          case 'UNTIL':
            result.endType = 'ON_DATE';
            // Parse date format YYYYMMDDTHHMMSSZ
            const year = value.substring(0, 4);
            const month = value.substring(4, 6);
            const day = value.substring(6, 8);
            result.endDate = new Date(`${year}-${month}-${day}`);
            break;
          case 'COUNT':
            result.endType = 'AFTER_OCCURRENCES';
            result.count = parseInt(value) || 10;
            break;
        }
      });
      
      return result;
    } catch (e) {
      console.error('Error parsing recurrence rule:', e);
      return {
        frequency: null,
        interval: 1,
        endType: 'NEVER',
        endDate: null,
        count: 10
      };
    }
  }
  
  private buildRecurrenceRule(): string | null {
    if (!this.eventForm.get('enableRecurrence').value) {
      return null;
    }
    
    const frequency = this.eventForm.get('recurrenceFrequency').value;
    const interval = this.eventForm.get('recurrenceInterval').value || 1;
    const endType = this.eventForm.get('recurrenceEnd').value;
    
    let rule = `FREQ=${frequency};INTERVAL=${interval}`;
    
    if (endType === 'ON_DATE') {
      const endDate = this.eventForm.get('recurrenceEndDate').value;
      if (endDate) {
        // Format date as YYYYMMDDTHHMMSSZ
        const formattedDate = this.formatDateForRRule(endDate);
        rule += `;UNTIL=${formattedDate}`;
      }
    } else if (endType === 'AFTER_OCCURRENCES') {
      const count = this.eventForm.get('recurrenceCount').value || 10;
      rule += `;COUNT=${count}`;
    }
    
    return rule;
  }
  
  private formatDateForRRule(date: Date): string {
    try {
      // Format as YYYYMMDDTHHMMSSZ
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}T000000Z`;
    } catch (error) {
      console.error('Error formatting date for RRule:', error);
      // Return today's date as fallback
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return `${year}${month}${day}T000000Z`;
    }
  }
  
  // Handle event type change - update color and show/hide specific sections
  private onEventTypeChange(type: string): void {
    // Since color is now determined by the backend, we don't need to set it here
    
    // Show/hide specific sections based on event type
    this.showDeadlineFields = type === 'DEADLINE';
    
    // If switching to DEADLINE, set some defaults
    if (type === 'DEADLINE') {
      this.eventForm.get('highPriority').setValue(true);
    }
  }
  
  // Get default color based on event type
  private getDefaultColor(eventType: string): string {
    switch(eventType) {
      case 'COURT_DATE': return '#d63939'; // red/danger
      case 'DEADLINE': return '#f59f00'; // orange/warning
      case 'CLIENT_MEETING': return '#3577f1'; // blue/primary
      case 'TEAM_MEETING': return '#299cdb'; // light blue/info
      case 'DEPOSITION': return '#405189'; // indigo/secondary
      case 'MEDIATION': return '#0ab39c'; // teal/success
      case 'CONSULTATION': return '#6559cc'; // purple
      case 'REMINDER': return '#f06548'; // orange-red
      case 'OTHER': return '#74788d'; // gray
      default: return '#74788d'; // gray instead of black
    }
  }
  
  // Toggle recurrence on/off
  toggleRecurrence(): void {
    const isEnabled = this.eventForm.get('enableRecurrence').value;
    
    if (!isEnabled) {
      // Reset recurrence fields when disabled
      this.eventForm.patchValue({
        recurrenceFrequency: 'WEEKLY',
        recurrenceInterval: 1,
        recurrenceEnd: 'NEVER',
        recurrenceEndDate: null,
        recurrenceCount: 10
      });
    } else {
      // Initialize recurrence end date picker if needed
      setTimeout(() => {
        this.initRecurrenceEndDatePicker();
      }, 100);
    }
  }
  
  // Handle recurrence end type change
  onRecurrenceEndChange(): void {
    const endType = this.eventForm.get('recurrenceEnd').value;
    
    if (endType === 'ON_DATE') {
      // Initialize end date picker if not already done
      setTimeout(() => {
        this.initRecurrenceEndDatePicker();
      }, 100);
    }
  }
  
  // Get interval label based on frequency
  getIntervalLabel(): string {
    const frequency = this.eventForm.get('recurrenceFrequency').value;
    switch(frequency) {
      case 'DAILY': return 'day(s)';
      case 'WEEKLY': return 'week(s)';
      case 'MONTHLY': return 'month(s)';
      case 'YEARLY': return 'year(s)';
      default: return 'occurrence(s)';
    }
  }
  
  /**
   * Format reminder time for human-readable display
   */
  formatReminderTime(minutes: number): string {
    if (!minutes) return 'none';
    
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (minutes < 1440) {
      const hours = minutes / 60;
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      const days = minutes / 1440;
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
  }
  
  /**
   * Create a human-readable summary of the recurrence pattern
   */
  formatRecurrenceSummary(): string {
    if (!this.eventForm.get('enableRecurrence').value) {
      return 'not at all (one-time event)';
    }
    
    const frequency = this.eventForm.get('recurrenceFrequency').value;
    const interval = this.eventForm.get('recurrenceInterval').value || 1;
    const endType = this.eventForm.get('recurrenceEnd').value;
    
    let summary = '';
    
    // Frequency & interval
    switch(frequency) {
      case 'DAILY':
        summary = interval === 1 ? 'daily' : `every ${interval} days`;
        break;
      case 'WEEKLY':
        summary = interval === 1 ? 'weekly' : `every ${interval} weeks`;
        break;
      case 'MONTHLY':
        summary = interval === 1 ? 'monthly' : `every ${interval} months`;
        break;
      case 'YEARLY':
        summary = interval === 1 ? 'yearly' : `every ${interval} years`;
        break;
      default:
        summary = 'on a custom schedule';
    }
    
    // End condition
    switch(endType) {
      case 'NEVER':
        summary += ' with no end date';
        break;
      case 'ON_DATE':
        const endDate = this.eventForm.get('recurrenceEndDate').value;
        if (endDate) {
          const formattedDate = new Date(endDate).toLocaleDateString();
          summary += ` until ${formattedDate}`;
        }
        break;
      case 'AFTER_OCCURRENCES':
        const count = this.eventForm.get('recurrenceCount').value || 0;
        summary += ` for ${count} occurrence${count !== 1 ? 's' : ''}`;
        break;
    }
    
    return summary;
  }

  onSubmit(): void {
    // Mark all fields as touched to trigger validation
    this.markFormGroupTouched(this.eventForm);
    
    if (this.eventForm.invalid) {
      return;
    }
    
    this.isLoading = true;
    const formValues = this.eventForm.value;

    try {
      // Handle reminderMinutes if 'custom' is selected
      let reminderMinutes = formValues.reminderMinutes;

      if (reminderMinutes === 'custom') {
        reminderMinutes = Number(formValues.customReminderMinutes);
      } else {
        // Ensure we have a number - force conversion
        reminderMinutes = Number(reminderMinutes);
        
        // If NaN or invalid, default to 0 (no reminder)
        if (isNaN(reminderMinutes)) {
          reminderMinutes = 0;
        }
      }

      // Make sure additionalReminders is an array of numbers
      const additionalReminders = this.selectedAdditionalReminders.map(min => Number(min));
      
      // Build the event request object
      const eventRequest: CreateEventRequest = {
        id: this.event?.id,
        title: formValues.title,
        description: formValues.description,
        startTime: formValues.startTime,
        endTime: formValues.endTime,
        location: formValues.location,
        eventType: formValues.eventType,
        status: formValues.status,
        allDay: formValues.allDay,
        caseId: formValues.caseId,
        reminderMinutes: reminderMinutes, // Use the processed value
        // color is removed as it's determined by event type on the backend
        highPriority: formValues.highPriority,
        
        // Include notification preferences
        emailNotification: reminderMinutes > 0 ? formValues.emailNotification : false,
        pushNotification: reminderMinutes > 0 ? formValues.pushNotification : false,
        
        // Add additional reminders
        additionalReminders: additionalReminders
      };
      
      // Add the reminderSent property using type assertion
      if (this.event && 'reminderSent' in this.event) {
        (eventRequest as any).reminderSent = false;
      }

      // Add recurrence rule if enabled
      if (formValues.enableRecurrence) {
        eventRequest.recurrenceRule = this.buildRecurrenceRule();
      }
      
      // Emit the save event
      this.save.emit(eventRequest);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      this.isLoading = false;
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if ((control as FormGroup).controls) {
        this.markFormGroupTouched(control as FormGroup);
      }
    });
  }

  private setupColorPicker() {
    const colorInput = document.getElementById('color') as HTMLInputElement;
    if (colorInput) {
      // Set initial color
      const initialColor = this.eventForm.get('color')?.value || '#3788d8';
      document.querySelector('.color-swatch-container')?.setAttribute('style', `--selected-color: ${initialColor}`);
      
      // Listen for changes
      colorInput.addEventListener('input', (e) => {
        const color = (e.target as HTMLInputElement).value;
        document.querySelector('.color-swatch-container')?.setAttribute('style', `--selected-color: ${color}`);
      });
    }
  }

  // Toggle methods for notification buttons
  toggleEmailNotification() {
    const currentValue = this.eventForm.get('emailNotification').value;
    this.eventForm.get('emailNotification').setValue(!currentValue);
  }
  
  togglePushNotification() {
    const currentValue = this.eventForm.get('pushNotification').value;
    this.eventForm.get('pushNotification').setValue(!currentValue);
  }
} 