import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  PlatformStats,
  OrganizationWithStats,
  OrganizationDetail,
  UserSummary,
  SystemHealth,
  PlatformAnalytics,
  UserDetail,
  AuditLogEntry,
  CreateOrganization,
  UpdateOrganization,
  Announcement
} from '../models/superadmin.models';

interface ApiResponse<T> {
  timeStamp: string;
  statusCode: number;
  status: string;
  message: string;
  data: T;
}

interface PageData<T> {
  content: T[];
  page: {
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class SuperAdminService {
  private readonly apiUrl = `${environment.apiUrl}/api/superadmin`;

  constructor(private http: HttpClient) {}

  /**
   * Get platform-wide statistics
   */
  getDashboardStats(): Observable<PlatformStats> {
    return this.http.get<ApiResponse<{ stats: PlatformStats }>>(`${this.apiUrl}/dashboard/stats`)
      .pipe(map(response => response.data.stats));
  }

  /**
   * Get all organizations with stats (paginated)
   */
  getOrganizations(
    page: number = 0,
    size: number = 10,
    sortBy: string = 'id',
    sortDir: string = 'asc'
  ): Observable<PageData<OrganizationWithStats>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('sortDir', sortDir);

    return this.http.get<ApiResponse<{ organizations: OrganizationWithStats[], page: any }>>(
      `${this.apiUrl}/organizations`, { params }
    ).pipe(
      map(response => ({
        content: response.data.organizations,
        page: response.data.page
      }))
    );
  }

  /**
   * Search organizations
   */
  searchOrganizations(
    query: string,
    page: number = 0,
    size: number = 10
  ): Observable<PageData<OrganizationWithStats>> {
    const params = new HttpParams()
      .set('query', query)
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<ApiResponse<{ organizations: OrganizationWithStats[], page: any }>>(
      `${this.apiUrl}/organizations/search`, { params }
    ).pipe(
      map(response => ({
        content: response.data.organizations,
        page: response.data.page
      }))
    );
  }

  /**
   * Get organization details
   */
  getOrganizationDetails(id: number): Observable<OrganizationDetail> {
    return this.http.get<ApiResponse<{ organization: OrganizationDetail }>>(
      `${this.apiUrl}/organizations/${id}`
    ).pipe(map(response => response.data.organization));
  }

  /**
   * Get organization users
   */
  getOrganizationUsers(
    organizationId: number,
    page: number = 0,
    size: number = 10
  ): Observable<PageData<UserSummary>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<ApiResponse<{ users: UserSummary[], page: any }>>(
      `${this.apiUrl}/organizations/${organizationId}/users`, { params }
    ).pipe(
      map(response => ({
        content: response.data.users,
        page: response.data.page
      }))
    );
  }

  /**
   * Suspend organization
   */
  suspendOrganization(id: number): Observable<void> {
    return this.http.put<ApiResponse<void>>(`${this.apiUrl}/organizations/${id}/suspend`, {})
      .pipe(map(() => void 0));
  }

  /**
   * Activate organization
   */
  activateOrganization(id: number): Observable<void> {
    return this.http.put<ApiResponse<void>>(`${this.apiUrl}/organizations/${id}/activate`, {})
      .pipe(map(() => void 0));
  }

  /**
   * Get all users across all organizations
   */
  getAllUsers(page: number = 0, size: number = 10): Observable<PageData<UserSummary>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<ApiResponse<{ users: UserSummary[], page: any }>>(
      `${this.apiUrl}/users`, { params }
    ).pipe(
      map(response => ({
        content: response.data.users,
        page: response.data.page
      }))
    );
  }

  /**
   * Search users across all organizations
   */
  searchUsers(
    query: string,
    page: number = 0,
    size: number = 10
  ): Observable<PageData<UserSummary>> {
    const params = new HttpParams()
      .set('query', query)
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<ApiResponse<{ users: UserSummary[], page: any }>>(
      `${this.apiUrl}/users/search`, { params }
    ).pipe(
      map(response => ({
        content: response.data.users,
        page: response.data.page
      }))
    );
  }

  // ==================== SYSTEM HEALTH ====================

  /**
   * Get system health status
   */
  getSystemHealth(): Observable<SystemHealth> {
    return this.http.get<ApiResponse<{ health: SystemHealth }>>(`${this.apiUrl}/system/health`)
      .pipe(map(response => response.data.health));
  }

  // ==================== ANALYTICS ====================

  /**
   * Get platform analytics
   */
  getAnalytics(period: string = 'week'): Observable<PlatformAnalytics> {
    const params = new HttpParams().set('period', period);
    return this.http.get<ApiResponse<{ analytics: PlatformAnalytics }>>(
      `${this.apiUrl}/analytics`, { params }
    ).pipe(map(response => response.data.analytics));
  }

  // ==================== ORGANIZATION CRUD ====================

  /**
   * Create a new organization
   */
  createOrganization(data: CreateOrganization): Observable<any> {
    return this.http.post<ApiResponse<{ organization: any }>>(
      `${this.apiUrl}/organizations`, data
    ).pipe(map(response => response.data.organization));
  }

  /**
   * Update an organization
   */
  updateOrganization(id: number, data: UpdateOrganization): Observable<any> {
    return this.http.put<ApiResponse<{ organization: any }>>(
      `${this.apiUrl}/organizations/${id}`, data
    ).pipe(map(response => response.data.organization));
  }

  // ==================== USER MANAGEMENT ====================

  /**
   * Get user details
   */
  getUserDetails(id: number): Observable<UserDetail> {
    return this.http.get<ApiResponse<{ user: UserDetail }>>(
      `${this.apiUrl}/users/${id}`
    ).pipe(map(response => response.data.user));
  }

  /**
   * Reset user password (sends reset email)
   */
  resetUserPassword(id: number): Observable<void> {
    return this.http.post<ApiResponse<void>>(
      `${this.apiUrl}/users/${id}/reset-password`, {}
    ).pipe(map(() => void 0));
  }

  /**
   * Toggle user enabled status
   */
  toggleUserStatus(id: number, enabled: boolean): Observable<void> {
    const params = new HttpParams().set('enabled', enabled.toString());
    return this.http.put<ApiResponse<void>>(
      `${this.apiUrl}/users/${id}/toggle-status`, {}, { params }
    ).pipe(map(() => void 0));
  }

  /**
   * Resend verification email
   */
  resendVerificationEmail(id: number): Observable<void> {
    return this.http.post<ApiResponse<void>>(
      `${this.apiUrl}/users/${id}/resend-verification`, {}
    ).pipe(map(() => void 0));
  }

  // ==================== AUDIT LOGS ====================

  /**
   * Get audit logs with filtering
   */
  getAuditLogs(
    filters: {
      organizationId?: number;
      userId?: number;
      action?: string;
      entityType?: string;
      startDate?: string;
      endDate?: string;
    },
    page: number = 0,
    size: number = 20
  ): Observable<PageData<AuditLogEntry>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (filters.organizationId) params = params.set('organizationId', filters.organizationId.toString());
    if (filters.userId) params = params.set('userId', filters.userId.toString());
    if (filters.action) params = params.set('action', filters.action);
    if (filters.entityType) params = params.set('entityType', filters.entityType);
    if (filters.startDate) params = params.set('startDate', filters.startDate);
    if (filters.endDate) params = params.set('endDate', filters.endDate);

    return this.http.get<ApiResponse<{ logs: AuditLogEntry[], page: any }>>(
      `${this.apiUrl}/audit-logs`, { params }
    ).pipe(
      map(response => ({
        content: response.data.logs,
        page: response.data.page
      }))
    );
  }

  // ==================== ANNOUNCEMENTS ====================

  /**
   * Send platform announcement
   */
  sendAnnouncement(announcement: Announcement): Observable<void> {
    return this.http.post<ApiResponse<void>>(
      `${this.apiUrl}/announcements`, announcement
    ).pipe(map(() => void 0));
  }
}
