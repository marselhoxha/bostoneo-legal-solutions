import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { CustomHttpResponse } from '../../interface/custom-http-response';
import { AuditEntry, AuditQuery, AuditReport, ComplianceAlert, AuditChange } from '../../interface/audit-log';
import { UserService } from '../../service/user.service';
import { User } from '../../interface/user';

@Injectable({
  providedIn: 'root'
})
export class AuditLogService {
  private readonly apiUrl = 'http://localhost:8085/api/v1';
  
  // Current user info for audit entries
  private currentUser: User | null = null;
  private sessionId: string;
  
  // Recent audit entries cache
  private recentEntries$ = new BehaviorSubject<AuditEntry[]>([]);
  
  constructor(
    private http: HttpClient,
    private userService: UserService
  ) {
    this.sessionId = this.generateSessionId();
    this.initializeUserSubscription();
  }

  // ==================== Public API ====================

  /**
   * Log an audit entry
   */
  log(entry: Omit<AuditEntry, 'id' | 'timestamp' | 'userId' | 'userName' | 'ipAddress' | 'userAgent' | 'sessionId'>): Observable<AuditEntry> {
    if (!this.currentUser) {
      console.warn('AuditLogService: Cannot log entry, no current user');
      return of({} as AuditEntry);
    }

    const auditEntry: Omit<AuditEntry, 'id'> = {
      ...entry,
      timestamp: new Date(),
      userId: this.currentUser.id,
      userName: `${this.currentUser.firstName} ${this.currentUser.lastName}`,
      ipAddress: this.getClientIP(),
      userAgent: navigator.userAgent,
      sessionId: this.sessionId
    };

    return this.http.post<CustomHttpResponse<AuditEntry>>(
      `${this.apiUrl}/audit/log`,
      auditEntry
    ).pipe(
      map(response => response.data),
      tap(savedEntry => {
        // Add to recent entries cache
        const recent = [savedEntry, ...this.recentEntries$.value.slice(0, 99)];
        this.recentEntries$.next(recent);
      }),
      catchError(error => {
        console.error('Failed to log audit entry:', error);
        // Still return the entry for local logging
        return of({ ...auditEntry, id: this.generateTempId() } as AuditEntry);
      })
    );
  }

  /**
   * Log assignment change
   */
  logAssignmentChange(
    entityType: 'case' | 'task',
    entityId: number,
    entityName: string,
    action: string,
    oldAssignee?: string,
    newAssignee?: string,
    component: string = 'AssignmentSyncService'
  ): Observable<AuditEntry> {
    const changes: AuditChange[] = [];
    
    if (oldAssignee !== newAssignee) {
      changes.push({
        field: 'assignee',
        oldValue: oldAssignee || 'unassigned',
        newValue: newAssignee || 'unassigned',
        dataType: 'string'
      });
    }

    return this.log({
      action,
      entityType,
      entityId,
      entityName,
      changes,
      component,
      severity: 'MEDIUM',
      category: 'USER_ACTION',
      metadata: {
        changeType: 'assignment',
        previousAssignee: oldAssignee,
        newAssignee: newAssignee
      }
    });
  }

  /**
   * Log task status change
   */
  logTaskStatusChange(
    taskId: number,
    taskName: string,
    oldStatus: string,
    newStatus: string,
    component: string = 'TaskManagement'
  ): Observable<AuditEntry> {
    return this.log({
      action: 'TASK_STATUS_CHANGED',
      entityType: 'task',
      entityId: taskId,
      entityName: taskName,
      changes: [{
        field: 'status',
        oldValue: oldStatus,
        newValue: newStatus,
        dataType: 'string'
      }],
      component,
      severity: 'LOW',
      category: 'DATA_CHANGE',
      metadata: {
        statusTransition: `${oldStatus} -> ${newStatus}`
      }
    });
  }

  /**
   * Log case access
   */
  logCaseAccess(
    caseId: number,
    caseName: string,
    accessType: 'VIEW' | 'EDIT' | 'DELETE',
    component: string = 'CaseDetail'
  ): Observable<AuditEntry> {
    const severity = accessType === 'DELETE' ? 'HIGH' : accessType === 'EDIT' ? 'MEDIUM' : 'LOW';
    
    return this.log({
      action: `CASE_${accessType}`,
      entityType: 'case',
      entityId: caseId,
      entityName: caseName,
      component,
      severity,
      category: 'USER_ACTION',
      metadata: {
        accessType,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log security event
   */
  logSecurityEvent(
    action: string,
    description: string,
    entityType: string = 'system',
    entityId: number = 0,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'HIGH'
  ): Observable<AuditEntry> {
    return this.log({
      action,
      entityType,
      entityId,
      entityName: description,
      component: 'SecurityService',
      severity,
      category: 'SECURITY',
      metadata: {
        securityEvent: true,
        description,
        riskLevel: severity
      }
    });
  }

  /**
   * Query audit log
   */
  queryAuditLog(query: AuditQuery): Observable<AuditEntry[]> {
    let params = new HttpParams();
    
    if (query.userId) params = params.set('userId', query.userId.toString());
    if (query.entityType) params = params.set('entityType', query.entityType);
    if (query.entityId) params = params.set('entityId', query.entityId.toString());
    if (query.action) params = params.set('action', query.action);
    if (query.startDate) params = params.set('startDate', query.startDate.toISOString());
    if (query.endDate) params = params.set('endDate', query.endDate.toISOString());
    if (query.severity) params = params.set('severity', query.severity.join(','));
    if (query.category) params = params.set('category', query.category.join(','));
    if (query.page) params = params.set('page', query.page.toString());
    if (query.size) params = params.set('size', query.size.toString());
    if (query.sortBy) params = params.set('sortBy', query.sortBy);
    if (query.sortDirection) params = params.set('sortDirection', query.sortDirection);

    return this.http.get<CustomHttpResponse<AuditEntry[]>>(
      `${this.apiUrl}/audit/query`,
      { params }
    ).pipe(
      map(response => response.data || []),
      catchError(error => {
        console.error('Failed to query audit log:', error);
        return of([]);
      })
    );
  }

  /**
   * Get audit trail for specific entity
   */
  getEntityAuditTrail(entityType: string, entityId: number): Observable<AuditEntry[]> {
    return this.queryAuditLog({
      entityType,
      entityId,
      sortBy: 'timestamp',
      sortDirection: 'DESC'
    });
  }

  /**
   * Get recent audit entries
   */
  getRecentEntries(): Observable<AuditEntry[]> {
    return this.recentEntries$.asObservable();
  }

  /**
   * Generate compliance report
   */
  generateComplianceReport(
    startDate: Date,
    endDate: Date,
    includeCategories: string[] = ['SECURITY', 'DATA_CHANGE']
  ): Observable<AuditReport> {
    const query: AuditQuery = {
      startDate,
      endDate,
      category: includeCategories,
      sortBy: 'timestamp',
      sortDirection: 'DESC'
    };

    return this.http.post<CustomHttpResponse<AuditReport>>(
      `${this.apiUrl}/audit/report/compliance`,
      query
    ).pipe(
      map(response => response.data),
      catchError(error => {
        console.error('Failed to generate compliance report:', error);
        throw error;
      })
    );
  }

  /**
   * Get compliance alerts
   */
  getComplianceAlerts(): Observable<ComplianceAlert[]> {
    return this.http.get<CustomHttpResponse<ComplianceAlert[]>>(
      `${this.apiUrl}/audit/alerts`
    ).pipe(
      map(response => response.data || []),
      catchError(error => {
        console.error('Failed to get compliance alerts:', error);
        return of([]);
      })
    );
  }

  /**
   * Export audit log
   */
  exportAuditLog(
    query: AuditQuery,
    format: 'JSON' | 'CSV' | 'PDF' = 'CSV'
  ): Observable<Blob> {
    let params = new HttpParams().set('format', format);
    
    // Add query parameters
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          params = params.set(key, value.join(','));
        } else if (value instanceof Date) {
          params = params.set(key, value.toISOString());
        } else {
          params = params.set(key, value.toString());
        }
      }
    });

    return this.http.get(`${this.apiUrl}/audit/export`, {
      params,
      responseType: 'blob'
    }).pipe(
      catchError(error => {
        console.error('Failed to export audit log:', error);
        throw error;
      })
    );
  }

  // ==================== Convenience Methods ====================

  /**
   * Log user login
   */
  logUserLogin(success: boolean, reason?: string): Observable<AuditEntry> {
    return this.logSecurityEvent(
      success ? 'USER_LOGIN_SUCCESS' : 'USER_LOGIN_FAILED',
      success ? 'User logged in successfully' : `Login failed: ${reason}`,
      'user',
      this.currentUser?.id || 0,
      success ? 'LOW' : 'MEDIUM'
    );
  }

  /**
   * Log user logout
   */
  logUserLogout(): Observable<AuditEntry> {
    return this.logSecurityEvent(
      'USER_LOGOUT',
      'User logged out',
      'user',
      this.currentUser?.id || 0,
      'LOW'
    );
  }

  /**
   * Log permission denied
   */
  logPermissionDenied(
    resource: string,
    action: string,
    entityId?: number
  ): Observable<AuditEntry> {
    return this.logSecurityEvent(
      'PERMISSION_DENIED',
      `Access denied to ${resource} for action: ${action}`,
      resource,
      entityId || 0,
      'HIGH'
    );
  }

  /**
   * Log data export
   */
  logDataExport(
    dataType: string,
    recordCount: number,
    format: string,
    component: string = 'ExportService'
  ): Observable<AuditEntry> {
    return this.log({
      action: 'DATA_EXPORT',
      entityType: 'data',
      entityId: 0,
      entityName: `${dataType} export`,
      component,
      severity: 'MEDIUM',
      category: 'USER_ACTION',
      metadata: {
        dataType,
        recordCount,
        format,
        exportedAt: new Date().toISOString()
      }
    });
  }

  // ==================== Private Methods ====================

  private initializeUserSubscription(): void {
    this.userService.userData$.subscribe(user => {
      this.currentUser = user;
    });
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTempId(): string {
    return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getClientIP(): string {
    // This would typically be provided by the backend or a service
    // For now, return a placeholder
    return 'client_ip';
  }
}