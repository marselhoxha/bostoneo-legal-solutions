import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, forkJoin, switchMap } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { CalendarEvent } from '../components/calendar/interfaces/calendar-event.interface';
import { environment } from '../../../../environments/environment';
import Swal from 'sweetalert2';
import { ModalService } from './modal.service';
import { EventModalComponent } from '../components/calendar/event-modal/event-modal.component';

@Injectable({
  providedIn: 'root'
})
export class CalendarService {
  private apiUrl = `${environment.apiUrl}/api/calendar`;

  constructor(private http: HttpClient, private modalService: ModalService) { }



  getEventById(id: number | string): Observable<CalendarEvent> {
    return this.http.get<any>(`${this.apiUrl}/events/${id}`)
      .pipe(
        map(response => {
          // Extract event from the response structure
          let event;
          if (response && response.data && response.data.event) {
            event = response.data.event;
          } else if (response && response.data) {
            event = response.data;
          } else {
            event = response;
          }
          
          // Convert API format (startTime/endTime) to CalendarEvent format (start/end)
          // And ensure data types are correct
          return {
            ...event,
            start: event.startTime || event.start,
            end: event.endTime || event.end,
            // Ensure reminderMinutes is a number
            reminderMinutes: event.reminderMinutes !== undefined && event.reminderMinutes !== null ? 
              Number(event.reminderMinutes) : 0,
            // Ensure additionalReminders is an array of numbers
            additionalReminders: Array.isArray(event.additionalReminders) ? 
              event.additionalReminders.map(min => Number(min)) : []
          };
        }),
        catchError(error => {
          console.error(`Error fetching event ${id}:`, error);
          return throwError(() => error);
        })
      );
  }

  getEventsByCaseId(caseId: string | number): Observable<CalendarEvent[]> {
    // Get events from the API
    return this.http.get<any>(`${this.apiUrl}/events/case/${caseId}`)
      .pipe(
        map(response => {
          // Extract events from the nested response structure
          if (response && response.data && Array.isArray(response.data.events)) {
            return response.data.events.map(event => {
              // Convert API format (startTime/endTime) to CalendarEvent format (start/end)
              return {
                ...event,
                start: event.startTime || event.start,
                end: event.endTime || event.end
              };
            });
          } else {
            console.warn('Unexpected API response format:', response);
            return [];
          }
        }),
        catchError(error => {
          console.error(`Error fetching events for case ${caseId}:`, error);
          return of([]); // Return empty array on error
        })
      );
  }

  createEvent(event: Partial<CalendarEvent>): Observable<CalendarEvent> {
    // Format dates to be compatible with Java LocalDateTime (no 'Z' timezone marker)
    const formattedEvent = this.formatEventDatesForBackend(event);

    return this.http.post<any>(`${this.apiUrl}/events`, formattedEvent)
      .pipe(
        map(response => {
          return response.data || response;
        }),
        catchError(error => {
          console.error('Error creating event:', error);
          return this.handleError<CalendarEvent>('createEvent')(error);
        })
      );
  }

  updateEvent(id: string, event: Partial<CalendarEvent>): Observable<CalendarEvent> {
    // Format dates to be compatible with Java LocalDateTime (no 'Z' timezone marker)
    const formattedEvent = this.formatEventDatesForBackend(event);

    // Force reminderSent to false when updating reminder settings
    if (formattedEvent.reminderMinutes !== undefined && formattedEvent.reminderMinutes > 0) {
      formattedEvent.reminderSent = false;
    }

    return this.http.put<any>(`${this.apiUrl}/events/${id}`, formattedEvent)
      .pipe(
        map(response => {
          // Extract event data from response
          let updatedEvent = null;
          if (response && response.data && response.data.event) {
            updatedEvent = response.data.event;
          } else if (response && response.data) {
            updatedEvent = response.data;
          } else {
            updatedEvent = response;
          }
          
          // Ensure proper data types for all fields
          return {
            ...updatedEvent,
            // Convert date strings to Date objects
            startTime: updatedEvent.startTime ? new Date(updatedEvent.startTime) : null,
            endTime: updatedEvent.endTime ? new Date(updatedEvent.endTime) : null,
            start: updatedEvent.startTime ? new Date(updatedEvent.startTime) : null,
            end: updatedEvent.endTime ? new Date(updatedEvent.endTime) : null,
            // Ensure reminderMinutes is a number
            reminderMinutes: updatedEvent.reminderMinutes !== undefined ? Number(updatedEvent.reminderMinutes) : 0,
            // Ensure additionalReminders is an array of numbers
            additionalReminders: Array.isArray(updatedEvent.additionalReminders) ? 
              updatedEvent.additionalReminders.map(min => Number(min)) : []
          };
        }),
        catchError(error => {
          console.error('Error updating event:', error);
          return this.handleError<CalendarEvent>('updateEvent')(error);
        })
      );
  }

  deleteEvent(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/events/${id}`)
      .pipe(
        catchError(this.handleError<void>('deleteEvent'))
      );
  }

  private formatEventDatesForBackend(event: any): any {
    const formattedEvent = { ...event };

    // Convert 'start' to 'startTime' if startTime doesn't exist
    if (formattedEvent.start && !formattedEvent.startTime) {
      formattedEvent.startTime = formattedEvent.start;
    }
    if (formattedEvent.end && !formattedEvent.endTime) {
      formattedEvent.endTime = formattedEvent.end;
    }

    // Always remove frontend-only 'start' and 'end' properties
    delete formattedEvent.start;
    delete formattedEvent.end;

    // Remove read-only or computed fields that shouldn't be sent to backend
    delete formattedEvent.userName;
    delete formattedEvent.caseTitle;
    delete formattedEvent.caseNumber;
    delete formattedEvent.createdAt;
    delete formattedEvent.updatedAt;

    // Ensure reminderMinutes is sent as a number
    if (formattedEvent.reminderMinutes !== undefined) {
      if (formattedEvent.reminderMinutes === 'custom' || formattedEvent.reminderMinutes === '') {
        // Handle the custom case - this should have been transformed by the component
        // but just in case, provide a fallback
        formattedEvent.reminderMinutes = 0;
      } else {
        // Force to number type
        formattedEvent.reminderMinutes = Number(formattedEvent.reminderMinutes);
      }
    }

    // If reminderMinutes is 0, make sure notification flags are off
    if (formattedEvent.reminderMinutes === 0) {
      formattedEvent.emailNotification = false;
      formattedEvent.pushNotification = false;
    }

    // Convert additional reminders to an array of numbers if it's not already
    if (formattedEvent.additionalReminders && Array.isArray(formattedEvent.additionalReminders)) {
      formattedEvent.additionalReminders = formattedEvent.additionalReminders.map(min => Number(min));
    }

    // Convert startTime to format Java LocalDateTime can parse
    if (formattedEvent.startTime) {
      // Handle both Date objects and string dates
      formattedEvent.startTime = formattedEvent.startTime instanceof Date
        ? this.formatDateForJava(formattedEvent.startTime)
        : this.formatStringDateForJava(formattedEvent.startTime);
    }

    // Convert endTime to format Java LocalDateTime can parse (if it exists)
    if (formattedEvent.endTime) {
      // Handle both Date objects and string dates
      formattedEvent.endTime = formattedEvent.endTime instanceof Date
        ? this.formatDateForJava(formattedEvent.endTime)
        : this.formatStringDateForJava(formattedEvent.endTime);
    }

    return formattedEvent;
  }
  
  private formatDateForJava(date: Date): string {
    // Format: YYYY-MM-DDTHH:MM:SS (no timezone, local time preserved)
    if (!date) {
      return null;
    }

    // Use local date methods to preserve user's selected time
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }
  
  private formatStringDateForJava(dateString: string): string {
    // Format: YYYY-MM-DDTHH:MM:SS (no timezone)
    if (!dateString) {
      return null;
    }

    try {
      // Parse the string date into a Date object and then format it
      const date = new Date(dateString);

      // Create formatted date string in the exact format Java expects: YYYY-MM-DDTHH:MM:SS
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');

      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    } catch (error) {
      console.error('Error formatting date string:', error);
      return null;
    }
  }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: HttpErrorResponse): Observable<T> => {
      console.error(`${operation} failed: ${error.message}`);
      
      if (error.status === 401) {
        console.error('Authorization error - please check that you are logged in');
      } else if (error.status === 403) {
        console.error('Permission denied - you do not have access to this resource');
      }
      
      // Let the component handle the error or return a safe result
      return throwError(() => error);
    };
  }

  // Track reminders shown in this session to prevent duplicates
  private shownReminders = new Set<string>();

  /**
   * Generate reminders for deadlines
   * Iterates through deadlines and dispatches appropriate reminders
   */
  generateDeadlineReminders(): Observable<any> {
    return this.getEvents().pipe(
      map(events => events.filter(event =>
        // Only get deadlines that haven't sent reminders
        event.eventType === 'DEADLINE' &&
        !event.reminderSent &&
        event.reminderMinutes > 0
      )),
      map(deadlines => {
        const now = new Date();
        // Find deadlines that need reminders
        return deadlines.filter(deadline => {
          const deadlineDate = new Date(deadline.start);

          // Skip if the deadline has already passed
          if (deadlineDate < now) {
            return false;
          }

          // Skip if we already showed this reminder in this session
          const reminderKey = `primary-${deadline.id}`;
          if (this.shownReminders.has(reminderKey)) {
            return false;
          }

          const reminderTime = new Date(deadlineDate.getTime() - (deadline.reminderMinutes * 60 * 1000));

          // If reminder time is now or in the past (but deadline is still future)
          return reminderTime <= now;
        });
      }),
      switchMap(deadlinesToRemind => {
        if (deadlinesToRemind.length === 0) {
          return of([]);
        }

        // Process each deadline that needs a reminder
        const reminderUpdates = deadlinesToRemind.map(deadline => {
          // Mark as shown in this session BEFORE showing (prevents duplicates)
          const reminderKey = `primary-${deadline.id}`;
          this.shownReminders.add(reminderKey);

          // Show notification or perform reminder action
          this.showDeadlineReminder(deadline);

          // Only send the fields that need to be updated (minimal payload)
          const updatePayload = {
            id: deadline.id,
            title: deadline.title,
            startTime: deadline.startTime || deadline.start,
            eventType: deadline.eventType,
            reminderSent: true
          };

          return this.updateEvent(deadline.id.toString(), updatePayload).pipe(
            catchError(error => {
              console.error(`Failed to mark reminder sent for event ${deadline.id}:`, error);
              // Return success anyway - we already showed the reminder
              return of(null);
            })
          );
        });

        return forkJoin(reminderUpdates);
      })
    );
  }
  
  /**
   * Check for additional reminders that need to be sent for deadline
   */
  checkAdditionalReminders(): Observable<any> {
    return this.getEvents().pipe(
      map(events => events.filter(event =>
        // Only get deadlines with additional reminders
        event.eventType === 'DEADLINE' &&
        event.additionalReminders &&
        event.additionalReminders.length > 0
      )),
      map(deadlines => {
        const now = new Date();
        // Find deadlines with additional reminders to send
        const deadlinesWithReminders = [];

        deadlines.forEach(deadline => {
          const deadlineDate = new Date(deadline.start);

          // Skip if the deadline has already passed
          if (deadlineDate < now) {
            return;
          }

          const additionalRemindersToSend = [];

          deadline.additionalReminders.forEach(reminderMinutes => {
            // Skip if already shown in this session
            const reminderKey = `additional-${deadline.id}-${reminderMinutes}`;
            if (this.shownReminders.has(reminderKey)) {
              return;
            }

            const reminderTime = new Date(deadlineDate.getTime() - (reminderMinutes * 60 * 1000));

            // If reminder time is now or in the past, and hasn't been sent
            if (reminderTime <= now && !deadline.remindersSent?.includes(reminderMinutes)) {
              additionalRemindersToSend.push(reminderMinutes);
            }
          });

          if (additionalRemindersToSend.length > 0) {
            deadlinesWithReminders.push({
              deadline,
              additionalRemindersToSend
            });
          }
        });

        return deadlinesWithReminders;
      }),
      switchMap(deadlinesWithReminders => {
        if (deadlinesWithReminders.length === 0) {
          return of([]);
        }

        // Process each deadline with additional reminders
        const reminderUpdates = deadlinesWithReminders.map(({ deadline, additionalRemindersToSend }) => {
          // Mark as shown in this session BEFORE showing
          additionalRemindersToSend.forEach(minutes => {
            const reminderKey = `additional-${deadline.id}-${minutes}`;
            this.shownReminders.add(reminderKey);
          });

          // Show notifications for additional reminders
          additionalRemindersToSend.forEach(minutes => {
            this.showDeadlineReminder(deadline, minutes);
          });

          // Update the deadline to mark additional reminders as sent (minimal payload)
          const remindersSent = deadline.remindersSent || [];
          const updatePayload = {
            id: deadline.id,
            title: deadline.title,
            startTime: deadline.startTime || deadline.start,
            eventType: deadline.eventType,
            remindersSent: [...remindersSent, ...additionalRemindersToSend]
          };

          // Add error handling to prevent infinite retries
          return this.updateEvent(deadline.id.toString(), updatePayload).pipe(
            catchError(error => {
              console.error(`Failed to update reminder status for event ${deadline.id}:`, error);
              // Return empty observable or a default value to continue processing
              return of(null);
            })
          );
        });
        
        return forkJoin(reminderUpdates);
      }),
      catchError(error => {
        console.error('Error in checkAdditionalReminders:', error);
        // Return empty array to prevent infinite retries
        return of([]);
      })
    );
  }
  
  /**
   * Display a notification for a deadline reminder
   */
  private showDeadlineReminder(deadline: CalendarEvent, minutes?: number): void {
    const minutesText = minutes 
      ? `${this.formatReminderTime(minutes)} reminder` 
      : `${this.formatReminderTime(deadline.reminderMinutes)} reminder`;
    
    const priorityText = deadline.highPriority ? 'HIGH PRIORITY: ' : '';
    
    // Construct HTML content for SweetAlert, including description if available
    let contentHtml = `
      <div class="text-start">
        <p><strong>${minutesText}:</strong> "${deadline.title}" on ${new Date(deadline.start).toLocaleDateString()} at ${new Date(deadline.start).toLocaleTimeString()}</p>
    `;
    
    // Add description section if available
    if (deadline.description) {
      contentHtml += `
        <div class="mt-3 p-3 bg-light rounded">
          <h6 class="mb-2 text-dark"><i class="ri-file-text-line me-1"></i> Description:</h6>
          <p class="mb-0 text-dark">${deadline.description}</p>
        </div>
      `;
    }
    
    contentHtml += '</div>';
    
    // Use SweetAlert2 for notification with HTML content
    Swal.fire({
      title: `${priorityText}Deadline Reminder`,
      html: contentHtml,
      icon: deadline.highPriority ? 'warning' : 'info',
      showCancelButton: true,
      confirmButtonText: 'View Details',
      cancelButtonText: 'Dismiss',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#6c757d'
    }).then((result) => {
      if (result.isConfirmed) {
        // Open event details modal
        const modalRef = this.modalService.open(EventModalComponent, {
          size: 'lg',
          backdrop: 'static',
          centered: true
        });
        
        modalRef.componentInstance.event = deadline;
        modalRef.componentInstance.title = 'Deadline Details';
        modalRef.componentInstance.viewMode = true;
      }
    });
  }
  
  /**
   * Format reminder time into human-readable text
   */
  private formatReminderTime(minutes: number): string {
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
   * Test sending a reminder email for a specific event
   * This calls our API endpoint for manually testing reminders
   */
  testReminderEmail(eventId: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/api/v1/test/reset-and-process-reminder`)
      .pipe(
        catchError(this.handleError<any>('testReminderEmail'))
      );
  }

  /**
   * Get all calendar events
   */
  getEvents(size: number = 100): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/api/calendar/events?size=${size}`)
      .pipe(
        map(response => {
          // Extract events from the nested response structure
          if (response && response.data && Array.isArray(response.data.events)) {
            return response.data.events.map(event => ({
              ...event,
              start: event.startTime || event.start,
              end: event.endTime || event.end
            }));
          } else if (Array.isArray(response)) {
            return response.map(event => ({
              ...event,
              start: event.startTime || event.start,
              end: event.endTime || event.end
            }));
          }

          return [];
        }),
        catchError(error => {
          console.error('getEvents failed:', error);
          return of([]);
        })
      );
  }

  /**
   * Get today's calendar events
   */
  getTodayEvents(): Observable<any[]> {
    return this.http.get<any>(`${environment.apiUrl}/api/calendar/events/today`)
      .pipe(
        map(response => {
          if (response && response.data && Array.isArray(response.data.events)) {
            return response.data.events.map(event => ({
              ...event,
              start: event.startTime || event.start,
              end: event.endTime || event.end
            }));
          }

          return [];
        }),
        catchError(error => {
          console.error('getTodayEvents failed:', error);
          return of([]);
        })
      );
  }

  /**
   * Get upcoming calendar events (next N days)
   */
  getUpcomingEvents(days: number = 30): Observable<any[]> {
    return this.http.get<any>(`${environment.apiUrl}/api/calendar/events/upcoming?days=${days}`)
      .pipe(
        map(response => {
          if (response && response.data && Array.isArray(response.data.events)) {
            return response.data.events.map(event => ({
              ...event,
              start: event.startTime || event.start,
              end: event.endTime || event.end
            }));
          }

          return [];
        }),
        catchError(error => {
          console.error('getUpcomingEvents failed:', error);
          return of([]);
        })
      );
  }
} 