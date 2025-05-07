import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, map, throwError, catchError, Subject } from 'rxjs';
import { environment } from 'src/environments/environment';
import { 
  CaseActivity,
  CreateActivityRequest,
  CaseReminder, 
  CreateReminderRequest,
  UpdateReminderRequest,
  ReminderStatus
} from '../models/case-activity.model';
import { ActivityType } from '../interfaces/case.interface';
import { AuthService } from 'src/app/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class CaseActivitiesService {
  private apiUrl = `${environment.apiUrl}/api/legal/cases`;

  // Subject for activity refresh notifications
  private refreshNeeded = new Subject<number>();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  /**
   * Notify subscribers that they should refresh activities for a specific case
   * @param caseId The ID of the case that needs refreshing
   */
  notifyRefresh(caseId: number): void {
    if (!caseId || isNaN(caseId)) {
      console.warn('Cannot refresh activities: Invalid case ID');
      return;
    }
    
    console.log(`Notifying subscribers to refresh activities for case ${caseId}`);
    // First emit the refresh notification
    this.refreshNeeded.next(caseId);
    
    // Also delay a second notification to ensure backend has completed processing
    setTimeout(() => {
      console.log(`Sending delayed refresh notification for case ${caseId}`);
      this.refreshNeeded.next(caseId);
    }, 1000);
  }

  /**
   * Get an observable that emits when activities should be refreshed
   * @returns An observable that emits case IDs when refreshing is needed
   */
  getRefreshObservable(): Observable<number> {
    return this.refreshNeeded.asObservable();
  }

  /**
   * Get all activities for a specific case
   * @param caseId The ID of the legal case
   * @returns An observable of CaseActivity array
   */
  getActivitiesByCaseId(caseId: string | number): Observable<CaseActivity[]> {
    console.log(`Fetching activities for case ID: ${caseId} from ${this.apiUrl}/${caseId}/activities`);
    // Server returns a nested structure, so we map to extract the activities array
    return this.http.get<any>(`${this.apiUrl}/${caseId}/activities`)
      .pipe(
        map(response => {
          console.log('Raw activities API response:', response);
          
          // Extract activities from the response
          if (response && response.data && response.data.activities) {
            console.log(`Found ${response.data.activities.length} activities in the response data`);
            return response.data.activities;
          }
          
          // If API returns a direct array
          if (Array.isArray(response)) {
            console.log(`Found ${response.length} activities in direct response array`);
            return response;
          }
          
          // If API returns a different structure with data and activities properties at top level
          if (response && response.activities && Array.isArray(response.activities)) {
            console.log(`Found ${response.activities.length} activities in response.activities`);
            return response.activities;
          }
          
          console.log('Unexpected response format, returning empty array');
          return [];
        }),
        catchError((error: HttpErrorResponse) => {
          console.error(`Error fetching activities for case ${caseId}:`, error);
          
          // Log the error details for debugging
          if (error.error) {
            console.error('Error details:', error.error);
          }
          
          return throwError(() => error);
        })
      );
  }

  /**
   * Alias for getActivitiesByCaseId to maintain compatibility with existing code
   */
  getActivities(caseId: string | number): Observable<CaseActivity[]> {
    return this.getActivitiesByCaseId(caseId);
  }
  

  /**
   * Create a new activity record
   * @param data The activity data to create
   * @returns An observable of the created CaseActivity
   */
  createActivity(data: CreateActivityRequest): Observable<CaseActivity> {
    console.log('Creating activity:', data);
    
    // Normalize the activity type to the full string format before sending to backend
    data.activityType = this.normalizeActivityType(data.activityType);
    
    // Make sure we have metadata object
    if (!data.metadata) {
      data.metadata = {};
    }
    
    // Convert any IDs to numbers if they're strings
    if (data.caseId && typeof data.caseId === 'string') {
      data.caseId = parseInt(data.caseId, 10);
    }
    
    if (data.referenceId && typeof data.referenceId === 'string') {
      data.referenceId = parseInt(data.referenceId, 10);
    }
    
    // Get current user ID to ensure user is associated with activities
    const currentUser = this.authService.getCurrentUser();
    const userId = currentUser?.id || this.authService.getCurrentUserId();
    
    // Create a structured request that matches backend expectations
    const requestBody = {
      caseId: data.caseId,
      activityType: data.activityType,
      referenceId: data.referenceId,
      referenceType: data.referenceType || 'note',
      description: data.description,
      metadata: data.metadata, // Use metadata directly, not metadataJson
      userId: userId // Include userId in the request for proper tracking
    };
    
    console.log('Sending activity request:', requestBody);
    
    return this.http.post<any>(`${this.apiUrl}/${data.caseId}/activities`, requestBody)
      .pipe(
        map(response => {
          console.log('Create activity response:', response);
          if (response && response.data && response.data.activity) {
            return response.data.activity;
          }
          return response;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error creating activity:', error);
          
          // Log the error details for debugging
          if (error.error) {
            console.error('Error details:', error.error);
          }
          
          return throwError(() => error);
        })
      );
  }

  /**
   * Normalize activity type to standard format
   * @param type The activity type to normalize
   * @returns Normalized activity type
   */
  private normalizeActivityType(type: string): string {
    if (!type) return 'OTHER';
    
    // Convert legacy codes to full names
    switch (type) {
      case 'N': return 'NOTE_ADDED';
      case 'U': return 'NOTE_UPDATED';
      case 'D': return 'NOTE_DELETED';
      case 'NA': return 'NOTE_ADDED';
      case 'NU': return 'NOTE_UPDATED';
      case 'ND': return 'NOTE_DELETED';
      default: return type;
    }
  }

  /**
   * Log various activity types related to notes
   */
  logNoteActivity(caseId: number, noteId: number, title: string, type: 'NOTE_ADDED' | 'NOTE_UPDATED' | 'NOTE_DELETED'): Observable<CaseActivity> {
    const actionText = type === 'NOTE_ADDED' ? 'added' : 
                      type === 'NOTE_UPDATED' ? 'updated' : 'deleted';
    
    // Use full activity type strings that the backend now expects with VARCHAR(50)
    const data: CreateActivityRequest = {
      caseId: caseId,
      activityType: type, // Use full string activity type
      referenceId: noteId,
      referenceType: 'case_notes',
      description: `Note "${title}" ${actionText}`,
      metadata: {
        noteId: noteId,
        noteTitle: title
      }
    };
    
    return this.createActivity(data);
  }

  /**
   * Get all reminders for a specific case
   * @param caseId The ID of the legal case
   * @param status Optional filter by status
   * @returns An observable of CaseReminder array
   */
  getRemindersByCaseId(caseId: string | number, status?: ReminderStatus): Observable<CaseReminder[]> {
    let url = `${this.apiUrl}/${caseId}/reminders`;
    if (status) {
      url += `?status=${status}`;
    }
    return this.http.get<any>(url)
      .pipe(
        map(response => {
          console.log('Get reminders response:', response);
          if (response && response.data && response.data.reminders) {
            return response.data.reminders;
          }
          if (Array.isArray(response)) {
            return response;
          }
          return [];
        }),
        catchError((error: HttpErrorResponse) => {
          console.error(`Error fetching reminders for case ${caseId}:`, error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get a specific reminder by ID
   * @param caseId The ID of the legal case
   * @param reminderId The ID of the reminder
   * @returns An observable of CaseReminder
   */
  getReminderById(caseId: string | number, reminderId: string | number): Observable<CaseReminder> {
    return this.http.get<any>(`${this.apiUrl}/${caseId}/reminders/${reminderId}`)
      .pipe(
        map(response => {
          if (response && response.data && response.data.reminder) {
            return response.data.reminder;
          }
          return response;
        })
      );
  }

  /**
   * Create a new reminder for a case
   * @param data The reminder data to create
   * @returns An observable of the created CaseReminder
   */
  createReminder(data: CreateReminderRequest): Observable<CaseReminder> {
    return this.http.post<any>(`${this.apiUrl}/${data.caseId}/reminders`, data)
      .pipe(
        map(response => {
          if (response && response.data && response.data.reminder) {
            return response.data.reminder;
          }
          return response;
        })
      );
  }

  /**
   * Update an existing reminder
   * @param caseId The ID of the legal case
   * @param reminderId The ID of the reminder to update
   * @param data The reminder data to update
   * @returns An observable of the updated CaseReminder
   */
  updateReminder(caseId: string | number, reminderId: string | number, data: UpdateReminderRequest): Observable<CaseReminder> {
    return this.http.put<any>(`${this.apiUrl}/${caseId}/reminders/${reminderId}`, data)
      .pipe(
        map(response => {
          if (response && response.data && response.data.reminder) {
            return response.data.reminder;
          }
          return response;
        })
      );
  }

  /**
   * Mark a reminder as completed
   * @param caseId The ID of the legal case
   * @param reminderId The ID of the reminder to complete
   * @returns An observable of the updated CaseReminder
   */
  completeReminder(caseId: string | number, reminderId: string | number): Observable<CaseReminder> {
    return this.http.put<any>(`${this.apiUrl}/${caseId}/reminders/${reminderId}/complete`, {})
      .pipe(
        map(response => {
          if (response && response.data && response.data.reminder) {
            return response.data.reminder;
          }
          return response;
        })
      );
  }

  /**
   * Delete a reminder
   * @param caseId The ID of the legal case
   * @param reminderId The ID of the reminder to delete
   * @returns An observable of the operation result
   */
  deleteReminder(caseId: string | number, reminderId: string | number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${caseId}/reminders/${reminderId}`);
  }
  
  /**
   * Get all upcoming reminders for the current user across all cases
   * @returns An observable of CaseReminder array
   */
  getUpcomingReminders(): Observable<CaseReminder[]> {
    return this.http.get<any>(`${this.apiUrl}/reminders/upcoming`)
      .pipe(
        map(response => {
          if (response && response.data && response.data.reminders) {
            return response.data.reminders;
          }
          if (Array.isArray(response)) {
            return response;
          }
          return [];
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error fetching upcoming reminders:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Generic method to log any activity type
   */
  logActivity(caseId: number, data: CreateActivityRequest): Observable<CaseActivity> {
    // Add the caseId to the data if not already present
    data.caseId = caseId;
    return this.createActivity(data);
  }
} 