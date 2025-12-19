import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, timer, Subscription, of, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { TimeEntry } from './time-tracking.service';

export interface ActiveTimer {
  id?: number;
  userId: number;
  legalCaseId: number;
  startTime: Date;
  description?: string;
  isActive: boolean;
  pausedDuration: number; // total elapsed time across all sessions (in seconds)
  currentDurationSeconds?: number;
  caseName?: string;
  caseNumber?: string;
  userName?: string;
  userEmail?: string;
  formattedDuration?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StartTimerRequest {
  legalCaseId: number;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TimerService {
  private readonly baseUrl = `${environment.apiUrl}/api/timers`;
  private activeTimersSubject = new BehaviorSubject<ActiveTimer[]>([]);
  public activeTimers$ = this.activeTimersSubject.asObservable();
  
  private timerUpdateSubscription?: Subscription;
  private readonly UPDATE_INTERVAL = 1000; // Update every second

  constructor(private http: HttpClient) {
    this.startTimerUpdates();
  }

  ngOnDestroy(): void {
    this.stopTimerUpdates();
  }

  // Timer Operations
  startTimer(userId: number, request: StartTimerRequest): Observable<ActiveTimer> {
    return this.http.post<any>(`${this.baseUrl}/start`, { userId, ...request }).pipe(
      map(response => {
        const timer = response.data.timer;
        this.addActiveTimer(timer);
        return timer;
      }),
      catchError(error => {
        console.error('Timer start error:', error);
        return throwError(() => error);
      })
    );
  }

  pauseTimer(userId: number, timerId: number): Observable<ActiveTimer> {
    console.log('Pausing timer:', { userId, timerId });
    
    if (!userId || !timerId) {
      return throwError(() => new Error('Invalid userId or timerId'));
    }

    return this.http.post<any>(`${this.baseUrl}/${timerId}/pause`, { userId: userId }).pipe(
      map(response => {
        console.log('Pause timer response:', response);
        if (response?.data?.timer) {
          const timer = response.data.timer;
          this.updateActiveTimer(timer);
          return timer;
        }
        throw new Error('Invalid response format');
      }),
      catchError(error => {
        console.error('Error pausing timer:', error);
        console.error('Error details:', {
          status: error.status,
          message: error.message,
          error: error.error
        });
        
        // If timer doesn't exist or is already paused, sync with backend
        if (error.status === 400) {
          // Refresh timer state from backend
          return this.getActiveTimers(userId).pipe(
            map(timers => {
              const existingTimer = timers.find(t => t.id === timerId);
              if (existingTimer) {
                existingTimer.isActive = false;
                this.updateActiveTimer(existingTimer);
                return existingTimer;
              }
              throw error;
            }),
            catchError(() => throwError(() => error))
          );
        }
        return throwError(() => error);
      })
    );
  }

  resumeTimer(userId: number, timerId: number): Observable<ActiveTimer> {
    console.log('Resuming timer:', { userId, timerId });
    
    if (!userId || !timerId) {
      return throwError(() => new Error('Invalid userId or timerId'));
    }

    return this.http.post<any>(`${this.baseUrl}/${timerId}/resume`, { userId: userId }).pipe(
      map(response => {
        console.log('Resume timer response:', response);
        if (response?.data?.timer) {
          const timer = response.data.timer;
          this.updateActiveTimer(timer);
          return timer;
        }
        throw new Error('Invalid response format');
      }),
      catchError(error => {
        console.error('Error resuming timer:', error);
        console.error('Error details:', {
          status: error.status,
          message: error.message,
          error: error.error
        });
        
        // If timer doesn't exist or is already active, sync with backend
        if (error.status === 400) {
          // Refresh timer state from backend
          return this.getActiveTimers(userId).pipe(
            map(timers => {
              const existingTimer = timers.find(t => t.id === timerId);
              if (existingTimer) {
                existingTimer.isActive = true;
                this.updateActiveTimer(existingTimer);
                return existingTimer;
              }
              throw error;
            }),
            catchError(() => throwError(() => error))
          );
        }
        return throwError(() => error);
      })
    );
  }

  stopTimer(userId: number, timerId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${timerId}/stop`, { userId }).pipe(
      map(response => {
        this.removeActiveTimer(timerId);
        return response;
      }),
      catchError(error => {
        console.error('Error stopping timer:', error);
        // If timer doesn't exist, that's OK - it's already stopped
        if (error.status === 400 && error.error?.message?.includes('not found')) {
          this.removeActiveTimer(timerId);
          return of({ data: { timerId, stopped: true } });
        }
        return throwError(() => error);
      })
    );
  }

  stopAllTimers(userId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/stop-all`, { userId }).pipe(
      map(response => {
        this.clearActiveTimers();
        return response.data;
      }),
      catchError(this.handleError)
    );
  }

  // Timer Retrieval
  getActiveTimers(userId: number): Observable<ActiveTimer[]> {
    return this.http.get<any>(`${this.baseUrl}/user/${userId}/active`).pipe(
      map(response => {
        const timers = response.data.timers.map((timer: any) => this.processTimer(timer));
        this.activeTimersSubject.next(timers);
        return timers;
      }),
      catchError(this.handleError)
    );
  }

  getAllActiveTimers(): Observable<ActiveTimer[]> {
    return this.http.get<any>(`${this.baseUrl}/active`).pipe(
      map(response => response.data.timers.map((timer: any) => this.processTimer(timer))),
      catchError(this.handleError)
    );
  }

  getActiveTimer(timerId: number): Observable<ActiveTimer> {
    return this.http.get<any>(`${this.baseUrl}/${timerId}`).pipe(
      map(response => this.processTimer(response.data.timer)),
      catchError(this.handleError)
    );
  }

  getActiveTimerForCase(userId: number, legalCaseId: number): Observable<ActiveTimer | null> {
    return this.http.get<any>(`${this.baseUrl}/user/${userId}/case/${legalCaseId}`).pipe(
      map(response => response.data.timer ? this.processTimer(response.data.timer) : null),
      catchError(this.handleError)
    );
  }

  // Timer Status
  hasActiveTimer(userId: number): Observable<boolean> {
    return this.http.get<any>(`${this.baseUrl}/user/${userId}/has-active`).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  hasActiveTimerForCase(userId: number, legalCaseId: number): Observable<boolean> {
    return this.http.get<any>(`${this.baseUrl}/user/${userId}/case/${legalCaseId}/has-active`).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // Timer to Time Entry Conversion
  convertTimerToTimeEntry(userId: number, timerId: number, description: string): Observable<TimeEntry> {
    console.log('🔄 TimerService.convertTimerToTimeEntry called with:', { userId, timerId, description });
    
    const requestBody = { userId, description };
    console.log('🔄 Request URL:', `${this.baseUrl}/${timerId}/convert`);
    console.log('🔄 Request body:', requestBody);
    
    return this.http.post<any>(`${this.baseUrl}/${timerId}/convert`, requestBody).pipe(
      map(response => {
        console.log('🔄 Raw API response received:', response);
        console.log('🔄 Response structure:', JSON.stringify(response, null, 2));
        
        // Check if response has expected structure
        if (!response || !response.data) {
          console.error('❌ Invalid response structure - missing data field');
          throw new Error('Invalid response structure from server');
        }
        
        if (!response.data.timeEntry) {
          console.error('❌ Invalid response structure - missing timeEntry field');
          console.error('❌ Available fields in response.data:', Object.keys(response.data));
          throw new Error('Invalid response structure - missing timeEntry field');
        }
        
        console.log('🔄 Extracted timeEntry:', response.data.timeEntry);
        console.log('🔄 Removing active timer from local state...');
        this.removeActiveTimer(timerId);
        console.log('✅ Timer removed from local state, returning timeEntry');
        
        return response.data.timeEntry;
      }),
      catchError(error => {
        console.error('❌ TimerService error in convertTimerToTimeEntry:', error);
        console.error('❌ Error details:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error,
          url: error.url
        });
        return this.handleError(error);
      })
    );
  }

  convertMultipleTimersToTimeEntries(userId: number, timerIds: number[]): Observable<TimeEntry[]> {
    return this.http.post<any>(`${this.baseUrl}/convert-multiple`, { userId, timerIds }).pipe(
      map(response => {
        timerIds.forEach(id => this.removeActiveTimer(id));
        return response.data.timeEntries;
      }),
      catchError(this.handleError)
    );
  }

  // Timer Management
  updateTimerDescription(userId: number, timerId: number, description: string): Observable<ActiveTimer> {
    return this.http.patch<any>(`${this.baseUrl}/${timerId}/description`, { userId, description }).pipe(
      map(response => {
        const timer = response.data;
        this.updateActiveTimer(timer);
        return timer;
      }),
      catchError(this.handleError)
    );
  }

  discardTimer(userId: number, timerId: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/${timerId}?userId=${userId}`).pipe(
      map(response => {
        this.removeActiveTimer(timerId);
        return response.data;
      }),
      catchError(this.handleError)
    );
  }

  // Analytics
  getTotalActiveTimersCount(): Observable<number> {
    return this.http.get<any>(`${this.baseUrl}/analytics/count`).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getLongRunningTimers(hoursThreshold: number): Observable<ActiveTimer[]> {
    return this.http.get<any>(`${this.baseUrl}/analytics/long-running?hours=${hoursThreshold}`).pipe(
      map(response => response.data.map((timer: any) => this.processTimer(timer))),
      catchError(this.handleError)
    );
  }

  // Local Timer Management
  private startTimerUpdates(): void {
    this.timerUpdateSubscription = timer(0, this.UPDATE_INTERVAL).pipe(
      switchMap(() => this.updateLocalTimers())
    ).subscribe();
  }

  private stopTimerUpdates(): void {
    if (this.timerUpdateSubscription) {
      this.timerUpdateSubscription.unsubscribe();
    }
  }

  private updateLocalTimers(): Observable<any> {
    return new Observable(observer => {
      const timers = this.activeTimersSubject.value;
      const updatedTimers = timers.map(timer => {
        if (timer.isActive) {
          timer.currentDurationSeconds = this.calculateCurrentDuration(timer);
          timer.formattedDuration = this.formatDuration(timer.currentDurationSeconds);
        }
        return timer;
      });
      
      this.activeTimersSubject.next(updatedTimers);
      observer.next(updatedTimers);
      observer.complete();
    });
  }

  private calculateCurrentDuration(timer: ActiveTimer): number {
    if (!timer.startTime) return 0;
    
    if (timer.isActive) {
      // Timer is currently running: total elapsed + current session
      const now = new Date();
      const startTime = new Date(timer.startTime);
      const currentSessionSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      return (timer.pausedDuration || 0) + currentSessionSeconds;
    } else {
      // Timer is paused: return total elapsed time
      return timer.pausedDuration || 0;
    }
  }

  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  private processTimer(timer: any): ActiveTimer {
    const processedTimer = {
      ...timer,
      startTime: new Date(timer.startTime),
      currentDurationSeconds: this.calculateCurrentDuration(timer)
    };
    
    processedTimer.formattedDuration = this.formatDuration(processedTimer.currentDurationSeconds);
    
    return processedTimer;
  }

  // Local State Management
  private addActiveTimer(timer: ActiveTimer): void {
    const current = this.activeTimersSubject.value;
    const processedTimer = this.processTimer(timer);
    this.activeTimersSubject.next([processedTimer, ...current]);
  }

  private updateActiveTimer(updatedTimer: ActiveTimer): void {
    const current = this.activeTimersSubject.value;
    const index = current.findIndex(timer => timer.id === updatedTimer.id);
    
    if (index !== -1) {
      current[index] = this.processTimer(updatedTimer);
      this.activeTimersSubject.next([...current]);
    }
  }

  private removeActiveTimer(timerId: number): void {
    const current = this.activeTimersSubject.value;
    this.activeTimersSubject.next(current.filter(timer => timer.id !== timerId));
  }

  private clearActiveTimers(): void {
    this.activeTimersSubject.next([]);
  }

  // Public getter for current active timers
  getCurrentActiveTimers(): ActiveTimer[] {
    return this.activeTimersSubject.value;
  }

  // Check if user has active timer locally
  hasActiveTimerLocal(userId: number): boolean {
    return this.activeTimersSubject.value.some(timer => 
      timer.userId === userId && timer.isActive
    );
  }

  // Get active timer for case locally
  getActiveTimerForCaseLocal(userId: number, legalCaseId: number): ActiveTimer | null {
    return this.activeTimersSubject.value.find(timer =>
      timer.userId === userId && 
      timer.legalCaseId === legalCaseId && 
      timer.isActive
    ) || null;
  }

  private handleError(error: any): Observable<never> {
    console.error('TimerService error:', error);
    throw error;
  }
} 
 
 