import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { catchError, tap } from 'rxjs/operators';
import { CustomHttpResponse } from '../interface/appstates';
import { environment } from '../../environments/environment';

export interface AuditActivity {
  id: string;
  userId: number;
  action: string;
  entityType: string;
  entityId: number;
  description: string;
  metadata?: any;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  userName?: string;
  userEmail?: string;
  formattedTimestamp?: string;
  actionDisplayName?: string;
  entityDisplayName?: string;
}

export interface AuditLog {
  activities: AuditActivity[];
  totalCount: number;
  todayCount: number;
  weekCount: number;
  statistics?: {
    totalUsers: number;
    activeUsersToday: number;
    mostActiveUser: string;
    mostCommonAction: string;
    mostAccessedEntity: string;
  };
}

export interface CreateAuditRequest {
  action: string;
  entityType: string;
  entityId?: number;
  description: string;
  metadata?: string;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly apiUrl = `${environment.apiUrl}/api/audit`;
  private auditSubject = new BehaviorSubject<AuditLog>({ 
    activities: [], 
    totalCount: 0, 
    todayCount: 0, 
    weekCount: 0 
  });
  
  public audit$ = this.auditSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Get recent activities for dashboard
   */
  getRecentActivities$(limit: number = 10): Observable<CustomHttpResponse<AuditLog>> {
    const params = new HttpParams().set('limit', limit.toString());
    
    console.log('🔍 Making request to audit endpoint:', `${this.apiUrl}/activities/recent`);
    console.log('📋 Request params:', params.toString());
    
    return this.http.get<CustomHttpResponse<any>>(`${this.apiUrl}/activities/recent`, { params })
      .pipe(
        tap(response => {
          console.log('✅ Audit API Response received:', response);
          if (response?.data) {
            const auditData: AuditLog = {
              activities: response.data.activities || [],
              totalCount: response.data.totalCount || 0,
              todayCount: response.data.todayCount || 0,
              weekCount: response.data.weekCount || 0,
              statistics: response.data.statistics
            };
            console.log('📑 Processed audit data:', auditData);
            this.auditSubject.next(auditData);
          } else {
            console.warn('⚠️ No data in audit response');
          }
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('❌ Audit API Error Details:');
          console.error('Status:', error.status);
          console.error('Message:', error.message);
          console.error('Error body:', error.error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get fresh activities without cache for manual refresh
   */
  getFreshActivities$(limit: number = 10): Observable<CustomHttpResponse<AuditLog>> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    
    const params = new HttpParams()
      .set('limit', limit.toString())
      .set('_t', timestamp.toString())
      .set('_r', random)
      .set('nocache', 'true');
    
    // Add cache-busting headers
    const headers = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    
    console.log('🔄 Making FRESH request to audit endpoint (bypassing cache)');
    console.log('🚫 Cache busting params:', params.toString());
    
    return this.http.get<CustomHttpResponse<any>>(`${this.apiUrl}/activities/recent`, { 
      params, 
      headers 
    })
      .pipe(
        tap(response => {
          console.log('✅ Fresh Audit API Response received:', response);
          console.log('🕐 Server timestamp:', response.timestamp);
          
          if (response?.data?.activities && response.data.activities.length > 0) {
            console.log('🕐 First activity timestamp:', response.data.activities[0].timestamp);
            console.log('🕐 Current time:', new Date().toISOString());
          }
          
          if (response?.data) {
            const auditData: AuditLog = {
              activities: response.data.activities || [],
              totalCount: response.data.totalCount || 0,
              todayCount: response.data.todayCount || 0,
              weekCount: response.data.weekCount || 0,
              statistics: response.data.statistics
            };
            console.log('📑 Fresh audit data processed:', auditData);
            this.auditSubject.next(auditData);
          } else {
            console.warn('⚠️ No data in fresh audit response');
          }
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('❌ Fresh Audit API Error:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get activities for a specific user
   */
  getUserActivities$(userId: number, page: number = 0, size: number = 10): Observable<CustomHttpResponse<any>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    
    return this.http.get<CustomHttpResponse<any>>(`${this.apiUrl}/activities/user/${userId}`, { params })
      .pipe(
        catchError(this.handleError<CustomHttpResponse<any>>('getUserActivities'))
      );
  }

  /**
   * Get activities by date range
   */
  getActivitiesByDateRange$(startDate: Date, endDate: Date, page: number = 0, size: number = 10): Observable<CustomHttpResponse<any>> {
    const params = new HttpParams()
      .set('startDate', startDate.toISOString())
      .set('endDate', endDate.toISOString())
      .set('page', page.toString())
      .set('size', size.toString());
    
    return this.http.get<CustomHttpResponse<any>>(`${this.apiUrl}/activities/range`, { params })
      .pipe(
        catchError(this.handleError<CustomHttpResponse<any>>('getActivitiesByDateRange'))
      );
  }

  /**
   * Get activities for a specific entity
   */
  getEntityActivities$(entityType: string, entityId: number): Observable<CustomHttpResponse<any>> {
    return this.http.get<CustomHttpResponse<any>>(`${this.apiUrl}/activities/entity/${entityType}/${entityId}`)
      .pipe(
        catchError(this.handleError<CustomHttpResponse<any>>('getEntityActivities'))
      );
  }

  /**
   * Create new audit log entry
   */
  createAuditLog$(request: CreateAuditRequest): Observable<CustomHttpResponse<AuditActivity>> {
    return this.http.post<CustomHttpResponse<AuditActivity>>(`${this.apiUrl}/activities`, request)
      .pipe(
        catchError(this.handleError<CustomHttpResponse<AuditActivity>>('createAuditLog'))
      );
  }

  /**
   * Get activity statistics
   */
  getActivityStatistics$(): Observable<CustomHttpResponse<any>> {
    return this.http.get<CustomHttpResponse<any>>(`${this.apiUrl}/statistics`)
      .pipe(
        catchError(this.handleError<CustomHttpResponse<any>>('getActivityStatistics'))
      );
  }

  /**
   * Get activity counts for dashboard
   */
  getActivityCounts$(): Observable<CustomHttpResponse<any>> {
    return this.http.get<CustomHttpResponse<any>>(`${this.apiUrl}/counts`)
      .pipe(
        catchError(this.handleError<CustomHttpResponse<any>>('getActivityCounts'))
      );
  }

  /**
   * Test audit functionality
   */
  testAuditLog$(): Observable<CustomHttpResponse<any>> {
    return this.http.post<CustomHttpResponse<any>>(`${this.apiUrl}/test`, {})
      .pipe(
        catchError(this.handleError<CustomHttpResponse<any>>('testAuditLog'))
      );
  }

  /**
   * Handle HTTP errors
   */
  private handleError<T>(operation = 'operation') {
    return (error: HttpErrorResponse): Observable<T> => {
      console.error(`${operation} failed:`, error.message);
      
      // Return fallback data based on operation type
      if (operation === 'getRecentActivities') {
        const fallbackData: AuditLog = {
          activities: [],
          totalCount: 0,
          todayCount: 0,
          weekCount: 0
        };
        return of({ 
          appData: null,
          timestamp: new Date(),
          statusCode: 200,
          status: 'OK',
          message: 'Fallback data - audit service unavailable',
          data: fallbackData 
        } as CustomHttpResponse<AuditLog>) as Observable<T>;
      }
      
      return of({ 
        appData: null,
        timestamp: new Date(),
        statusCode: error.status || 500,
        status: error.statusText || 'Error',
        message: error.message || 'An error occurred',
        data: null 
      } as CustomHttpResponse<any>) as Observable<T>;
    };
  }

  /**
   * Format timestamp for display
   */
  formatTimestamp(timestamp: string | Date): string {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleString();
  }

  /**
   * Get display name for action
   */
  getActionDisplayName(action: string): string {
    const actionMap: { [key: string]: string } = {
      'CREATE': 'Created',
      'UPDATE': 'Updated',
      'DELETE': 'Deleted',
      'LOGIN': 'Logged In',
      'LOGOUT': 'Logged Out',
      'UPLOAD': 'Uploaded',
      'DOWNLOAD': 'Downloaded',
      'APPROVE': 'Approved',
      'REJECT': 'Rejected',
      'ASSIGN': 'Assigned',
      'UNASSIGN': 'Unassigned',
      'ARCHIVE': 'Archived',
      'RESTORE': 'Restored'
    };
    return actionMap[action] || action;
  }

  /**
   * Get display name for entity type
   */
  getEntityDisplayName(entityType: string): string {
    const entityMap: { [key: string]: string } = {
      'CLIENT': 'Client',
      'CASE': 'Case',
      'LEGAL_CASE': 'Legal Case',
      'DOCUMENT': 'Document',
      'INVOICE': 'Invoice',
      'USER': 'User',
      'APPOINTMENT': 'Appointment',
      'PAYMENT': 'Payment',
      'EXPENSE': 'Expense',
      'ROLE': 'Role',
      'PERMISSION': 'Permission',
      'EMAIL': 'Email',
      'CALENDAR_EVENT': 'Calendar Event'
    };
    return entityMap[entityType] || entityType;
  }

  /**
   * Get activities specifically for activities page (no shared state)
   */
  getActivitiesForPage$(limit: number = 50): Observable<CustomHttpResponse<any>> {
    const params = new HttpParams().set('limit', limit.toString());
    
    console.log('📑 Making request for activities page:', `${this.apiUrl}/activities/recent`);
    
    return this.http.get<CustomHttpResponse<any>>(`${this.apiUrl}/activities/recent`, { params })
      .pipe(
        tap(response => {
          console.log('📑 Activities page API response:', response);
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('❌ Activities Page API Error:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get fresh activities for activities page (no shared state, cache bypass)
   */
  getFreshActivitiesForPage$(limit: number = 50): Observable<CustomHttpResponse<any>> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    
    const params = new HttpParams()
      .set('limit', limit.toString())
      .set('_t', timestamp.toString())
      .set('_r', random)
      .set('nocache', 'true')
      .set('refresh', 'true');
    
    // Add cache-busting headers + skip cache interceptor
    const headers = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Skip-Cache': 'true', // Signal to cache interceptor to skip
      'X-Force-Fresh': 'true'  // Additional bypass signal
    };
    
    console.log('🔄 Making FRESH request for activities page (bypassing cache)');
    console.log('🚫 Cache busting params:', params.toString());
    console.log('🚫 Cache busting headers:', headers);
    
    return this.http.get<CustomHttpResponse<any>>(`${this.apiUrl}/activities/recent`, { 
      params, 
      headers 
    })
      .pipe(
        tap(response => {
          console.log('✅ Fresh activities page response:', response);
          console.log('🕐 Server timestamp:', response.timestamp);
          
          if (response?.data?.activities && response.data.activities.length > 0) {
            console.log('🕐 Raw backend timestamp:', response.data.activities[0].timestamp);
            console.log('🕐 Current time:', new Date().toISOString());
            
            // Check if backend has timestamp issues
            const backendTimestamp = new Date(response.data.activities[0].timestamp);
            if (backendTimestamp.getFullYear() !== new Date().getFullYear()) {
              console.warn('🚨 Backend timestamp year mismatch detected!', {
                backendYear: backendTimestamp.getFullYear(),
                currentYear: new Date().getFullYear(),
                backendTimestamp: response.data.activities[0].timestamp
              });
            }
          }
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('❌ Fresh Activities Page API Error:', error);
          return throwError(() => error);
        })
      );
  }
} 
 
 
 
 
 