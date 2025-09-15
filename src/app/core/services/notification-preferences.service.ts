import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface NotificationPreference {
  id?: number;
  userId: number;
  eventType: string;
  enabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  createdAt?: string;
  updatedAt?: string;
}

export interface NotificationPreferencesResponse {
  userId: number;
  preferences: NotificationPreference[];
  statistics?: any;
  availableEventTypes?: string[];
  message?: string;
  success: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationPreferencesService {
  private apiUrl = `${environment.apiUrl}/api/notification-preferences`;
  private preferencesCache = new BehaviorSubject<{ [userId: number]: NotificationPreference[] }>({});

  constructor(private http: HttpClient) {}

  /**
   * Get all notification preferences for a user
   */
  getUserPreferences(userId: number): Observable<NotificationPreference[]> {
    return this.http.get<NotificationPreference[]>(`${this.apiUrl}/${userId}`)
      .pipe(
        map(preferences => {
          this.updateCache(userId, preferences);
          return preferences;
        }),
        catchError(error => {
          console.error('Error fetching notification preferences:', error);
          throw error;
        })
      );
  }

  /**
   * Get notification preferences as a map
   */
  getUserPreferencesMap(userId: number): Observable<{ [eventType: string]: NotificationPreference }> {
    return this.http.get<{ [eventType: string]: NotificationPreference }>(`${this.apiUrl}/${userId}/map`)
      .pipe(
        catchError(error => {
          console.error('Error fetching notification preferences map:', error);
          throw error;
        })
      );
  }

  /**
   * Get a specific notification preference
   */
  getUserPreference(userId: number, eventType: string): Observable<NotificationPreference> {
    return this.http.get<NotificationPreference>(`${this.apiUrl}/${userId}/${eventType}`)
      .pipe(
        catchError(error => {
          console.error('Error fetching specific notification preference:', error);
          throw error;
        })
      );
  }

  /**
   * Save a single notification preference
   */
  savePreference(userId: number, preference: NotificationPreference): Observable<NotificationPreference> {
    return this.http.post<NotificationPreference>(`${this.apiUrl}/${userId}`, preference)
      .pipe(
        map(savedPreference => {
          this.updateSinglePreferenceInCache(userId, savedPreference);
          return savedPreference;
        }),
        catchError(error => {
          console.error('Error saving notification preference:', error);
          throw error;
        })
      );
  }

  /**
   * Save multiple notification preferences
   */
  savePreferences(userId: number, preferences: NotificationPreference[]): Observable<NotificationPreference[]> {
    return this.http.post<NotificationPreference[]>(`${this.apiUrl}/${userId}/bulk`, preferences)
      .pipe(
        map(savedPreferences => {
          this.updateCache(userId, savedPreferences);
          return savedPreferences;
        }),
        catchError(error => {
          console.error('Error saving notification preferences:', error);
          throw error;
        })
      );
  }

  /**
   * Update user notification preferences
   */
  updateUserPreferences(userId: number, preferences: NotificationPreference[]): Observable<NotificationPreference[]> {
    console.log('=== ANGULAR: Updating preferences for user:', userId);
    console.log('=== ANGULAR: Preferences array:', preferences);
    
    const preferencesMap = preferences.reduce((map, pref) => {
      // Ensure all required fields are present
      const cleanPref = {
        userId: pref.userId || userId,
        eventType: pref.eventType,
        enabled: pref.enabled !== undefined ? pref.enabled : true,
        emailEnabled: pref.emailEnabled !== undefined ? pref.emailEnabled : true,
        pushEnabled: pref.pushEnabled !== undefined ? pref.pushEnabled : true,
        inAppEnabled: pref.inAppEnabled !== undefined ? pref.inAppEnabled : true,
        priority: pref.priority || 'NORMAL'
      };
      
      // Don't include id, createdAt, updatedAt in the request
      map[pref.eventType] = cleanPref;
      return map;
    }, {} as { [eventType: string]: NotificationPreference });
    
    console.log('=== ANGULAR: Sending preferences map:', JSON.stringify(preferencesMap, null, 2));

    return this.http.put<NotificationPreference[]>(`${this.apiUrl}/${userId}`, preferencesMap)
      .pipe(
        map(updatedPreferences => {
          console.log('=== ANGULAR: Received updated preferences:', updatedPreferences);
          this.updateCache(userId, updatedPreferences);
          return updatedPreferences;
        }),
        catchError(error => {
          console.error('=== ANGULAR: Error updating notification preferences:', error);
          console.error('=== ANGULAR: Error response:', error.error);
          console.error('=== ANGULAR: Error status:', error.status);
          console.error('=== ANGULAR: Error headers:', error.headers);
          throw error;
        })
      );
  }

  /**
   * Update a specific preference
   */
  updatePreference(
    userId: number, 
    eventType: string, 
    updates: Partial<NotificationPreference>
  ): Observable<NotificationPreference> {
    const params = new URLSearchParams();
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    return this.http.patch<NotificationPreference>(
      `${this.apiUrl}/${userId}/${eventType}?${params.toString()}`, 
      {}
    ).pipe(
      map(updatedPreference => {
        this.updateSinglePreferenceInCache(userId, updatedPreference);
        return updatedPreference;
      }),
      catchError(error => {
        console.error('Error updating specific notification preference:', error);
        throw error;
      })
    );
  }

  /**
   * Enable/disable all notifications for a user
   */
  setAllNotificationsEnabled(userId: number, enabled: boolean): Observable<NotificationPreference[]> {
    return this.http.patch<NotificationPreference[]>(`${this.apiUrl}/${userId}/all/enabled?enabled=${enabled}`, {})
      .pipe(
        map(updatedPreferences => {
          this.updateCache(userId, updatedPreferences);
          return updatedPreferences;
        }),
        catchError(error => {
          console.error('Error setting all notifications enabled status:', error);
          throw error;
        })
      );
  }

  /**
   * Enable/disable all email notifications for a user
   */
  setAllEmailNotificationsEnabled(userId: number, emailEnabled: boolean): Observable<NotificationPreference[]> {
    return this.http.patch<NotificationPreference[]>(`${this.apiUrl}/${userId}/all/email?emailEnabled=${emailEnabled}`, {})
      .pipe(
        map(updatedPreferences => {
          this.updateCache(userId, updatedPreferences);
          return updatedPreferences;
        }),
        catchError(error => {
          console.error('Error setting all email notifications enabled status:', error);
          throw error;
        })
      );
  }

  /**
   * Enable/disable all push notifications for a user
   */
  setAllPushNotificationsEnabled(userId: number, pushEnabled: boolean): Observable<NotificationPreference[]> {
    return this.http.patch<NotificationPreference[]>(`${this.apiUrl}/${userId}/all/push?pushEnabled=${pushEnabled}`, {})
      .pipe(
        map(updatedPreferences => {
          this.updateCache(userId, updatedPreferences);
          return updatedPreferences;
        }),
        catchError(error => {
          console.error('Error setting all push notifications enabled status:', error);
          throw error;
        })
      );
  }

  /**
   * Reset user preferences to role-based defaults
   */
  resetToRoleDefaults(userId: number, roleName: string): Observable<NotificationPreference[]> {
    return this.http.post<NotificationPreference[]>(`${this.apiUrl}/${userId}/reset?roleName=${roleName}`, {})
      .pipe(
        map(resetPreferences => {
          this.updateCache(userId, resetPreferences);
          return resetPreferences;
        }),
        catchError(error => {
          console.error('Error resetting notification preferences to defaults:', error);
          throw error;
        })
      );
  }

  /**
   * Initialize preferences for a new user
   */
  initializeUserPreferences(userId: number, roleName: string): Observable<NotificationPreference[]> {
    return this.http.post<NotificationPreference[]>(`${this.apiUrl}/${userId}/initialize?roleName=${roleName}`, {})
      .pipe(
        map(initializedPreferences => {
          this.updateCache(userId, initializedPreferences);
          return initializedPreferences;
        }),
        catchError(error => {
          console.error('Error initializing notification preferences:', error);
          throw error;
        })
      );
  }

  /**
   * Delete all preferences for a user
   */
  deleteUserPreferences(userId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${userId}`)
      .pipe(
        map(() => {
          this.removeFromCache(userId);
        }),
        catchError(error => {
          console.error('Error deleting notification preferences:', error);
          throw error;
        })
      );
  }

  /**
   * Delete a specific preference
   */
  deletePreference(userId: number, eventType: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${userId}/${eventType}`)
      .pipe(
        map(() => {
          this.removeSinglePreferenceFromCache(userId, eventType);
        }),
        catchError(error => {
          console.error('Error deleting specific notification preference:', error);
          throw error;
        })
      );
  }

  /**
   * Check notification settings for a user and event type
   */
  checkNotificationSettings(userId: number, eventType: string): Observable<{
    shouldReceiveNotification: boolean;
    shouldReceiveEmailNotification: boolean;
    shouldReceivePushNotification: boolean;
    shouldReceiveInAppNotification: boolean;
  }> {
    return this.http.get<any>(`${this.apiUrl}/${userId}/check/${eventType}`)
      .pipe(
        catchError(error => {
          console.error('Error checking notification settings:', error);
          throw error;
        })
      );
  }

  /**
   * Get users who should receive a specific notification
   */
  getUsersForNotification(eventType: string, deliveryChannel?: string): Observable<number[]> {
    const params = deliveryChannel ? `?deliveryChannel=${deliveryChannel}` : '';
    return this.http.get<number[]>(`${this.apiUrl}/targeting/${eventType}${params}`)
      .pipe(
        catchError(error => {
          console.error('Error getting users for notification:', error);
          throw error;
        })
      );
  }

  /**
   * Get notification statistics for a user
   */
  getUserNotificationStats(userId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${userId}/stats`)
      .pipe(
        catchError(error => {
          console.error('Error getting notification statistics:', error);
          throw error;
        })
      );
  }

  /**
   * Get all available event types
   */
  getAllEventTypes(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/event-types`)
      .pipe(
        catchError(error => {
          console.error('Error getting event types:', error);
          throw error;
        })
      );
  }

  /**
   * Check if user has preferences configured
   */
  hasUserPreferences(userId: number): Observable<boolean> {
    return this.http.get<{ hasPreferences: boolean }>(`${this.apiUrl}/${userId}/exists`)
      .pipe(
        map(response => response.hasPreferences),
        catchError(error => {
          console.error('Error checking if user has preferences:', error);
          throw error;
        })
      );
  }

  /**
   * Get cached preferences for a user
   */
  getCachedPreferences(userId: number): NotificationPreference[] | null {
    const cache = this.preferencesCache.value;
    return cache[userId] || null;
  }

  /**
   * Clear cache for a specific user
   */
  clearUserCache(userId: number): void {
    const cache = { ...this.preferencesCache.value };
    delete cache[userId];
    this.preferencesCache.next(cache);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.preferencesCache.next({});
  }

  // Private helper methods
  private updateCache(userId: number, preferences: NotificationPreference[]): void {
    const cache = { ...this.preferencesCache.value };
    cache[userId] = preferences;
    this.preferencesCache.next(cache);
  }

  private updateSinglePreferenceInCache(userId: number, preference: NotificationPreference): void {
    const cache = { ...this.preferencesCache.value };
    if (cache[userId]) {
      const index = cache[userId].findIndex(p => p.eventType === preference.eventType);
      if (index >= 0) {
        cache[userId][index] = preference;
      } else {
        cache[userId].push(preference);
      }
      this.preferencesCache.next(cache);
    }
  }

  private removeFromCache(userId: number): void {
    const cache = { ...this.preferencesCache.value };
    delete cache[userId];
    this.preferencesCache.next(cache);
  }

  private removeSinglePreferenceFromCache(userId: number, eventType: string): void {
    const cache = { ...this.preferencesCache.value };
    if (cache[userId]) {
      cache[userId] = cache[userId].filter(p => p.eventType !== eventType);
      this.preferencesCache.next(cache);
    }
  }
}