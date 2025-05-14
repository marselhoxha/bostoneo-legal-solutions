import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { finalize, Subject, takeUntil } from 'rxjs';
import { CalendarEvent, CreateEventRequest } from '../interfaces/calendar-event.interface';
import { CalendarService } from '../../../services/calendar.service';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-event-modal',
  templateUrl: './event-modal.component.html',
  styleUrls: ['./event-modal.component.scss']
})
export class EventModalComponent implements OnInit, OnDestroy {
  @Input() event: CalendarEvent;
  @Input() viewMode = false;
  @Input() caseId: number = null;
  @Input() title = 'Calendar Event';
  
  loading = false;
  errorMessage: string = null;
  viewModeInternal = false;
  
  private destroy$ = new Subject<void>();
  
  constructor(
    public activeModal: NgbActiveModal,
    private calendarService: CalendarService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.viewModeInternal = this.viewMode;
    
    // Always force a reload of event details from server for events with IDs
    if (this.event?.id) {
      this.loadEventDetails(this.event.id);
    } else {
      // Ensure event object is properly initialized
      if (!this.event) {
        this.event = {} as CalendarEvent;
      }
    }
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  /**
   * Load full event details if we only have the ID
   */
  private loadEventDetails(eventId: number): void {
    this.loading = true;
    this.errorMessage = null;
    
    // Always get fresh event details from the server
    this.calendarService.getEventById(eventId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (event) => {
          if (event) {
            console.log('Loaded event details:', event);
            // Ensure we have the complete event data with proper types
            this.event = {
              ...event,
              // Make sure reminderMinutes is a number
              reminderMinutes: event.reminderMinutes !== null && event.reminderMinutes !== undefined ? 
                Number(event.reminderMinutes) : 0,
              // Make sure we have proper array values
              additionalReminders: Array.isArray(event.additionalReminders) ? 
                event.additionalReminders.map(m => Number(m)) : []
            };
            
            console.log('Processed event with reminderMinutes:', this.event.reminderMinutes, 
                      'type:', typeof this.event.reminderMinutes, 
                      'reminderSent:', this.event.reminderSent);
          } else {
            this.errorMessage = 'Unable to load event details. Please try again.';
          }
        },
        error: (error) => {
          console.error('Error loading event details:', error);
          this.errorMessage = 'Failed to load event details. Please try again later.';
        }
      });
  }

  /**
   * Confirm deletion with SweetAlert
   */
  confirmDelete(): void {
    if (!this.event?.id) {
      this.activeModal.dismiss('cancel');
      return;
    }
    
    Swal.fire({
      title: 'Are you sure?',
      text: 'You won\'t be able to revert this!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'No, cancel!',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        this.deleteEvent();
      }
    });
  }

  onSave(eventRequest: CreateEventRequest): void {
    this.loading = true;
    this.errorMessage = null;
    
    // Ensure reminder values are properly formatted as numbers
    const formattedRequest = {
      ...eventRequest,
      // Ensure caseId is a number
      caseId: eventRequest.caseId ? Number(eventRequest.caseId) : undefined,
      // Ensure reminderMinutes is a number
      reminderMinutes: eventRequest.reminderMinutes !== undefined ? Number(eventRequest.reminderMinutes) : 0,
      // Ensure additionalReminders is an array of numbers
      additionalReminders: Array.isArray(eventRequest.additionalReminders) 
        ? eventRequest.additionalReminders.map(min => Number(min)) 
        : []
    };
    
    console.log('Saving event with reminder data:', {
      reminderMinutes: formattedRequest.reminderMinutes,
      additionalReminders: formattedRequest.additionalReminders
    });
    
    const saveObservable = eventRequest.id
      ? this.calendarService.updateEvent(eventRequest.id.toString(), formattedRequest)
      : this.calendarService.createEvent(formattedRequest);
    
    saveObservable
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (response) => {
          if (response) {
            this.toastr.success(
              eventRequest.id ? 'Event updated successfully' : 'Event created successfully', 
              'Success'
            );
            this.activeModal.close(response);
          } else {
            this.errorMessage = 'Unable to save event. Please try again.';
          }
        },
        error: (error) => {
          console.error('Error saving event:', error);
          const errorMsg = error?.error?.message || 'Failed to save the event. Please try again.';
          this.errorMessage = errorMsg;
          this.toastr.error(errorMsg, 'Error');
        }
      });
  }
  
  onCancel(): void {
    this.activeModal.dismiss('cancel');
  }
  
  switchToEditMode(): void {
    this.viewModeInternal = false;
  }
  
  private deleteEvent(): void {
    this.loading = true;
    this.errorMessage = null;
    
    this.calendarService.deleteEvent(this.event.id.toString())
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: () => {
          this.toastr.success('Event deleted successfully', 'Success');
          this.activeModal.close({ deleted: true, eventId: this.event.id });
        },
        error: (error) => {
          console.error('Error deleting event:', error);
          const errorMsg = error?.error?.message || 'Failed to delete the event. Please try again.';
          this.errorMessage = errorMsg;
          this.toastr.error(errorMsg, 'Error');
          Swal.fire('Error', errorMsg, 'error');
        }
      });
  }
  
  /**
   * Format recurrence rule for display
   */
  formatRecurrenceRule(rule: string): string {
    if (!rule) return 'No recurrence';
    
    try {
      const parts = rule.split(';');
      let result = '';
      
      for (const part of parts) {
        const [key, value] = part.split('=');
        
        switch (key) {
          case 'FREQ':
            switch (value) {
              case 'DAILY': result += 'Daily'; break;
              case 'WEEKLY': result += 'Weekly'; break;
              case 'MONTHLY': result += 'Monthly'; break;
              case 'YEARLY': result += 'Yearly'; break;
              default: result += value.toLowerCase();
            }
            break;
          case 'INTERVAL':
            if (value !== '1') {
              result += ` (every ${value} `;
              switch (parts.find(p => p.startsWith('FREQ'))?.split('=')[1]) {
                case 'DAILY': result += 'days)'; break;
                case 'WEEKLY': result += 'weeks)'; break;
                case 'MONTHLY': result += 'months)'; break;
                case 'YEARLY': result += 'years)'; break;
                default: result += 'periods)';
              }
            }
            break;
          case 'COUNT':
            result += `, ${value} occurrences`;
            break;
          case 'UNTIL':
            try {
              const year = value.substring(0, 4);
              const month = value.substring(4, 6);
              const day = value.substring(6, 8);
              const date = new Date(`${year}-${month}-${day}`);
              result += `, until ${date.toLocaleDateString()}`;
            } catch (e) {
              result += `, until ${value}`;
            }
            break;
        }
      }
      
      return result;
    } catch (e) {
      console.error('Error parsing recurrence rule:', e);
      return 'Recurring event';
    }
  }
  
  /**
   * Format reminder time for display
   */
  formatReminderTime(minutes: number): string {
    if (!minutes) return 'No reminder';
    
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''} before`;
    } else if (minutes < 1440) {
      const hours = minutes / 60;
      return `${hours} hour${hours !== 1 ? 's' : ''} before`;
    } else {
      const days = minutes / 1440;
      return `${days} day${days !== 1 ? 's' : ''} before`;
    }
  }

  /**
   * Check if event has any reminders configured
   */
  hasReminders(): boolean {
    return (
      (this.event?.reminderMinutes && this.event?.reminderMinutes > 0) ||
      (this.event?.additionalReminders && this.event?.additionalReminders.length > 0)
    );
  }

  /**
   * Get total count of all reminders (primary + additional)
   */
  getTotalRemindersCount(): number {
    let count = 0;
    
    if (this.event?.reminderMinutes && this.event?.reminderMinutes > 0) {
      count += 1; // Primary reminder
    }
    
    if (this.event?.additionalReminders && Array.isArray(this.event.additionalReminders)) {
      count += this.event.additionalReminders.length; // Additional reminders
    }
    
    return count;
  }

  /**
   * Calculate the actual date/time when a reminder will be sent
   * based on the event start time and reminder minutes
   */
  calculateReminderDateTime(reminderMinutes: number): Date {
    if (!reminderMinutes || !this.event?.start) {
      return null;
    }
    
    const startDate = new Date(this.event.start);
    // Subtract reminder minutes from the start time
    const reminderDate = new Date(startDate.getTime() - (reminderMinutes * 60 * 1000));
    
    return reminderDate;
  }

  /**
   * Get additional reminders sorted by time (farthest to closest to event)
   */
  getSortedAdditionalReminders(): number[] {
    if (!this.event?.additionalReminders || !Array.isArray(this.event.additionalReminders)) {
      return [];
    }
    // Sort in descending order (farthest reminder first)
    return [...this.event.additionalReminders].sort((a, b) => b - a);
  }
  
  /**
   * Gets all reminders (primary and additional) sorted by time
   * Returns objects containing minutes and type for better display in timeline
   */
  getAllRemindersSorted(): {minutes: number, type: 'PRIMARY' | 'ADDITIONAL'}[] {
    const allReminders: {minutes: number, type: 'PRIMARY' | 'ADDITIONAL'}[] = [];
    
    // Add primary reminder if it exists
    if (this.event?.reminderMinutes && this.event.reminderMinutes > 0) {
      allReminders.push({
        minutes: this.event.reminderMinutes,
        type: 'PRIMARY'
      });
    }
    
    // Add additional reminders if they exist
    if (this.event?.additionalReminders && Array.isArray(this.event.additionalReminders)) {
      this.event.additionalReminders.forEach(minutes => {
        allReminders.push({
          minutes,
          type: 'ADDITIONAL'
        });
      });
    }
    
    // Sort in descending order (farthest reminder first)
    return allReminders.sort((a, b) => b.minutes - a.minutes);
  }

  /**
   * Get the color associated with an event type
   */
  getEventTypeColor(eventType: string): string {
    switch (eventType) {
      case 'COURT_DATE':
        return 'danger';
      case 'DEADLINE':
        return 'warning';
      case 'CLIENT_MEETING':
      case 'CONSULTATION':
        return 'primary';
      case 'TEAM_MEETING':
      case 'REMINDER':
        return 'info';
      case 'DEPOSITION':
        return 'secondary';
      case 'MEDIATION':
        return 'success';
      default:
        return 'dark';
    }
  }

  /**
   * Get the icon associated with an event type
   */
  getEventTypeIcon(eventType: string): string {
    switch (eventType) {
      case 'COURT_DATE':
        return 'ri-scales-3-line me-1 ';
      case 'DEADLINE':
        return 'ri-alarm-warning-line me-1 ';
      case 'CLIENT_MEETING':
      case 'CONSULTATION':
        return 'ri-team-line me-1 ';
      case 'TEAM_MEETING':
        return 'ri-group-line me-1 ';
      case 'DEPOSITION':
        return 'ri-file-text-line me-1 ';
      case 'MEDIATION':
        return 'ri-discuss-line me-1 ';
      case 'REMINDER':
        return 'ri-notification-3-line me-1 ';
      default:
        return 'ri-calendar-event-line me-1 ';
    }
  }

  /**
   * Get the display name for an event type
   */
  getEventTypeName(eventType: string): string {
    if (!eventType) return 'Event';
    
    // Convert from snake_case to Title Case with spaces
    return eventType.replace(/_/g, ' ').replace(/\w\S*/g, 
      txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  }

  /**
   * Get the color associated with an event status
   */
  getEventStatusColor(status: string): string {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'SCHEDULED':
        return 'primary';
      case 'PENDING':
        return 'warning';
      case 'CANCELLED':
        return 'danger';
      case 'RESCHEDULED':
        return 'info';
      default:
        return 'secondary';
    }
  }

  /**
   * Format the event date and time for display
   */
  formatEventDate(event: CalendarEvent): string {
    if (!event || !event.start) {
      return 'No date specified';
    }

    const startDate = new Date(event.start);
    
    if (event.allDay) {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }).format(startDate);
    }
    
    const endDate = event.end ? new Date(event.end) : null;
    const startStr = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(startDate);
    
    if (endDate) {
      // If same day, just show time for end
      if (startDate.toDateString() === endDate.toDateString()) {
        const endTimeStr = new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          minute: 'numeric',
          hour12: true
        }).format(endDate);
        return `${startStr} - ${endTimeStr}`;
      } else {
        // Different days, show full date and time for end
        const endStr = new Intl.DateTimeFormat('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          hour12: true
        }).format(endDate);
        return `${startStr} - ${endStr}`;
      }
    }
    
    return startStr;
  }

  /**
   * Format recurrence information for display
   */
  formatRecurrence(recurrence: any): string {
    if (!recurrence || !recurrence.frequency) {
      return 'No recurrence';
    }
    
    const frequency = recurrence.frequency.toLowerCase();
    const interval = recurrence.interval || 1;
    const frequencyText = interval === 1 
      ? frequency.charAt(0).toUpperCase() + frequency.slice(1)
      : `Every ${interval} ${frequency}s`;
    
    let endText = '';
    if (recurrence.endType === 'AFTER') {
      endText = `, ${recurrence.count || 0} times`;
    } else if (recurrence.endType === 'ON_DATE' && recurrence.endDate) {
      const endDate = new Date(recurrence.endDate);
      endText = `, until ${endDate.toLocaleDateString()}`;
    }
    
    return `${frequencyText}${endText}`;
  }
} 