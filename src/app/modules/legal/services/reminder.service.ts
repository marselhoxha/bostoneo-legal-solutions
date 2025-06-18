import { Injectable, OnDestroy } from '@angular/core';
import { Observable, interval, Subscription, EMPTY } from 'rxjs';
import { startWith, tap, catchError, retry, retryWhen, delay, take } from 'rxjs/operators';
import { CalendarService } from './calendar.service';

@Injectable({
  providedIn: 'root'
})
export class ReminderService implements OnDestroy {
  private checkInterval = 5 * 60 * 1000; // 5 minutes
  private reminderSubscription: Subscription;
  private isCheckingReminders = false; // Prevent overlapping checks

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
          // Only start checking if not already in progress
          if (!this.isCheckingReminders) {
            console.log('Checking for deadline reminders...');
            this.checkForReminders();
          } else {
            console.log('Reminder check already in progress, skipping...');
          }
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
    this.isCheckingReminders = false;
  }

  /**
   * Check for upcoming deadline reminders
   */
  private checkForReminders(): void {
    this.isCheckingReminders = true;

    // Main reminders with error handling
    this.calendarService.generateDeadlineReminders().pipe(
      catchError(error => {
        console.error('Error checking for deadline reminders:', error);
        // Return empty observable to prevent retries
        return EMPTY;
      }),
      retryWhen(errors => 
        errors.pipe(
          delay(30000), // Wait 30 seconds before retry
          take(3) // Only retry 3 times
        )
      )
    ).subscribe({
      next: (results) => {
        if (results && results.length > 0) {
          console.log(`Sent ${results.length} deadline reminders.`);
        }
        this.checkAdditionalRemindersWithErrorHandling();
      },
      error: (error) => {
        console.error('Failed to check deadline reminders after retries:', error);
        this.isCheckingReminders = false;
      }
    });
  }

  /**
   * Check additional reminders with proper error handling
   */
  private checkAdditionalRemindersWithErrorHandling(): void {
    this.calendarService.checkAdditionalReminders().pipe(
      catchError(error => {
        console.error('Error checking for additional deadline reminders:', error);
        // Return empty observable to prevent retries
        return EMPTY;
      }),
      retryWhen(errors => 
        errors.pipe(
          delay(30000), // Wait 30 seconds before retry
          take(3) // Only retry 3 times
        )
      )
    ).subscribe({
      next: (results) => {
        if (results && results.length > 0) {
          console.log(`Sent ${results.length} additional deadline reminders.`);
        }
        this.isCheckingReminders = false;
      },
      error: (error) => {
        console.error('Failed to check additional reminders after retries:', error);
        this.isCheckingReminders = false;
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
 