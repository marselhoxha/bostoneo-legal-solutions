import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { RbacService } from './rbac.service';
import { UserService } from '../../service/user.service';
import { environment } from '../../../environments/environment';

export interface AuditLogEntry {
  id?: number;
  userId: number;
  userEmail: string;
  userRole: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

export interface AuditLogFilter {
  userId?: number;
  action?: string;
  resource?: string;
  dateFrom?: Date;
  dateTo?: Date;
  success?: boolean;
  page?: number;
  size?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuditLogService {
  private readonly apiUrl = '/api/audit-logs';
  private recentActivities = new BehaviorSubject<AuditLogEntry[]>([]);
  
  // Define sensitive actions that should be audited
  private readonly SENSITIVE_ACTIONS = [
    'CASE_CREATE',
    'CASE_DELETE', 
    'CASE_UPDATE',
    'DOCUMENT_DELETE',
    'DOCUMENT_DOWNLOAD',
    'USER_LOGIN',
    'USER_LOGOUT',
    'ROLE_ASSIGN',
    'ROLE_REMOVE',
    'PERMISSION_GRANT',
    'PERMISSION_REVOKE',
    'DATA_EXPORT',
    'BILLING_VIEW',
    'CLIENT_INFO_ACCESS',
    'CONFIDENTIAL_DOCUMENT_ACCESS'
  ];

  constructor(
    private http: HttpClient,
    private rbacService: RbacService,
    private userService: UserService
  ) {}

  /**
   * Log a sensitive action
   */
  logAction(
    action: string,
    resource: string,
    resourceId?: string,
    details?: any,
    success: boolean = true,
    errorMessage?: string
  ): Observable<any> {
    const currentUser = this.userService.getCurrentUser();
    
    // Get current user roles
    const currentRoles: string[] = [];
    this.rbacService.roles$.subscribe(roles => {
      currentRoles.push(...roles.map(role => role.name));
    }).unsubscribe();
    
    const logEntry: AuditLogEntry = {
      userId: currentUser?.id || 0,
      userEmail: currentUser?.email || 'unknown',
      userRole: currentRoles.join(','),
      action,
      resource,
      resourceId,
      details,
      ipAddress: this.getClientIP(),
      userAgent: navigator.userAgent,
      timestamp: new Date(),
      success,
      errorMessage
    };

    // Log to console in development
    if (this.isDevelopment()) {
      console.log('🔒 Audit Log:', logEntry);
    }

    // Send to backend
    return this.http.post(`${this.apiUrl}`, logEntry);
  }

  /**
   * Log case-related actions
   */
  logCaseAction(action: string, caseId: string, details?: any): Observable<any> {
    return this.logAction(action, 'CASE', caseId, details);
  }

  /**
   * Log document-related actions  
   */
  logDocumentAction(action: string, documentId: string, details?: any): Observable<any> {
    return this.logAction(action, 'DOCUMENT', documentId, details);
  }

  /**
   * Log user/role related actions
   */
  logUserAction(action: string, userId?: string, details?: any): Observable<any> {
    return this.logAction(action, 'USER', userId, details);
  }

  /**
   * Log financial/billing actions
   */
  logBillingAction(action: string, resourceId?: string, details?: any): Observable<any> {
    return this.logAction(action, 'BILLING', resourceId, details);
  }

  /**
   * Get audit logs with filtering
   */
  getAuditLogs(filter?: AuditLogFilter): Observable<any> {
    let params: any = {};
    
    if (filter) {
      if (filter.userId) params.userId = filter.userId;
      if (filter.action) params.action = filter.action;
      if (filter.resource) params.resource = filter.resource;
      if (filter.dateFrom) params.dateFrom = filter.dateFrom.toISOString();
      if (filter.dateTo) params.dateTo = filter.dateTo.toISOString();
      if (filter.success !== undefined) params.success = filter.success;
      if (filter.page) params.page = filter.page;
      if (filter.size) params.size = filter.size;
    }

    return this.http.get(`${this.apiUrl}`, { params });
  }

  /**
   * Get recent activities for dashboard
   */
  getRecentActivities(limit: number = 10): Observable<AuditLogEntry[]> {
    return this.http.get<AuditLogEntry[]>(`${this.apiUrl}/recent?limit=${limit}`);
  }

  /**
   * Get user-specific audit trail
   */
  getUserAuditTrail(userId: number, days: number = 30): Observable<AuditLogEntry[]> {
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    return this.getAuditLogs({
      userId,
      dateFrom,
      dateTo,
      page: 0,
      size: 100
    });
  }

  /**
   * Check if action is sensitive and should be audited
   */
  isSensitiveAction(action: string): boolean {
    return this.SENSITIVE_ACTIONS.includes(action);
  }

  /**
   * Helper methods
   */
  private getClientIP(): string {
    // In a real app, this would be determined by the backend
    return 'client-ip';
  }

  private isDevelopment(): boolean {
    return !environment.production;
  }
} 