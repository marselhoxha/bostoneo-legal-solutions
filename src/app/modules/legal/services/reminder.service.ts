import { Injectable, OnDestroy } from '@angular/core';
import { Observable, interval, Subscription } from 'rxjs';
import { startWith, tap } from 'rxjs/operators';
import { CalendarService } from './calendar.service';

@Injectable({
  providedIn: 'root'
})
export class ReminderService implements OnDestroy {
  private checkInterval = 5 * 60 * 1000; // 5 minutes
  private reminderSubscription: Subscription;

  constructor(private calendarService: CalendarService) {}

  /**
   * Start the reminder service to check for upcoming deadlines
   */
  startReminders(): void {
    console.log('Starting deadline reminder service...');
    
    // Check for reminders immediately and then at regular intervals
    this.reminderSubscription = interval(this.checkInterval)
      .pipe(
        startWith(0),
        tap(() => {
          console.log('Checking for deadline reminders...');
          this.checkForReminders();
        })
      )
      .subscribe();
  }

  /**
   * Stop checking for reminders
   */
  stopReminders(): void {
    if (this.reminderSubscription) {
      this.reminderSubscription.unsubscribe();
      console.log('Deadline reminder service stopped.');
    }
  }

  /**
   * Check for upcoming deadline reminders
   */
  private checkForReminders(): void {
    // Main reminders
    this.calendarService.generateDeadlineReminders().subscribe({
      next: (results) => {
        if (results.length > 0) {
          console.log(`Sent ${results.length} deadline reminders.`);
        }
      },
      error: (error) => {
        console.error('Error checking for deadline reminders:', error);
      }
    });

    // Additional reminders
    this.calendarService.checkAdditionalReminders().subscribe({
      next: (results) => {
        if (results.length > 0) {
          console.log(`Sent ${results.length} additional deadline reminders.`);
        }
      },
      error: (error) => {
        console.error('Error checking for additional deadline reminders:', error);
      }
    });
  }

  /**
   * Clean up subscriptions when service is destroyed
   */
  ngOnDestroy(): void {
    this.stopReminders();
  }
} 
 