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
  Announcement,
  AnnouncementSummary,
  IntegrationStatus,
  SecurityOverview,
  FailedLogin,
  OrganizationFeatures,
  RoleSummary,
  CreateUserForOrg,
  LoginSession,
  OrgActiveUsers,
  DrillDownUserActivity,
  UserSessionItem,
  OrgApiRequests,
  EndpointBreakdown,
  OrgStorage,
  OrgErrors,
  OrgSecurity,
  EngagementMetrics,
  DataGrowth,
  FeatureAdoption,
  ActiveSession,
  LoginEvent
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
   * Delete (soft-delete) an organization
   */
  deleteOrganization(organizationId: number): Observable<any> {
    return this.http.delete<ApiResponse<any>>(
      `${this.apiUrl}/organizations/${organizationId}`
    );
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

  /**
   * Get active sessions (users logged in within a time window)
   */
  getActiveSessions(window: string = '1h'): Observable<ActiveSession[]> {
    const params = new HttpParams().set('window', window);
    return this.http.get<ApiResponse<{ sessions: ActiveSession[] }>>(
      `${this.apiUrl}/system/active-sessions`, { params }
    ).pipe(map(response => response.data.sessions));
  }

  /**
   * Get recent login events (paginated)
   */
  getLoginEvents(page: number = 0, size: number = 20): Observable<PageData<LoginEvent>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<ApiResponse<{ loginEvents: LoginEvent[], page: any }>>(
      `${this.apiUrl}/system/login-events`, { params }
    ).pipe(
      map(response => ({
        content: response.data.loginEvents,
        page: response.data.page
      }))
    );
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
   * Toggle MFA for a user (SuperAdmin override)
   */
  toggleUserMfa(id: number, enabled: boolean): Observable<void> {
    return this.http.put<ApiResponse<void>>(
      `${this.apiUrl}/users/${id}/toggle-mfa`, { enabled }
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

  /**
   * Get all announcements (paginated)
   */
  getAnnouncements(page: number = 0, size: number = 10): Observable<PageData<AnnouncementSummary>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<ApiResponse<{ announcements: AnnouncementSummary[], page: any }>>(
      `${this.apiUrl}/announcements`, { params }
    ).pipe(
      map(response => ({
        content: response.data.announcements,
        page: response.data.page
      }))
    );
  }

  /**
   * Delete an announcement
   */
  deleteAnnouncement(id: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(
      `${this.apiUrl}/announcements/${id}`
    ).pipe(map(() => void 0));
  }

  // ==================== INTEGRATIONS ====================

  /**
   * Get integration status for all organizations
   */
  getIntegrationStatus(): Observable<IntegrationStatus[]> {
    return this.http.get<ApiResponse<{ integrations: IntegrationStatus[] }>>(
      `${this.apiUrl}/integrations/status`
    ).pipe(map(response => response.data.integrations));
  }

  // ==================== SECURITY ====================

  /**
   * Get security overview
   */
  getSecurityOverview(): Observable<SecurityOverview> {
    return this.http.get<ApiResponse<{ security: SecurityOverview }>>(
      `${this.apiUrl}/security/overview`
    ).pipe(map(response => response.data.security));
  }

  /**
   * Get failed logins (paginated)
   */
  getFailedLogins(page: number = 0, size: number = 20): Observable<PageData<FailedLogin>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<ApiResponse<{ logins: FailedLogin[], page: any }>>(
      `${this.apiUrl}/security/failed-logins`, { params }
    ).pipe(
      map(response => ({
        content: response.data.logins,
        page: response.data.page
      }))
    );
  }

  // ==================== ORGANIZATION FEATURES ====================

  /**
   * Get organization features
   */
  getOrganizationFeatures(organizationId: number): Observable<OrganizationFeatures> {
    return this.http.get<ApiResponse<{ features: OrganizationFeatures }>>(
      `${this.apiUrl}/organizations/${organizationId}/features`
    ).pipe(map(response => response.data.features));
  }

  /**
   * Update organization features
   */
  updateOrganizationFeatures(organizationId: number, features: Partial<OrganizationFeatures>): Observable<OrganizationFeatures> {
    return this.http.put<ApiResponse<{ features: OrganizationFeatures }>>(
      `${this.apiUrl}/organizations/${organizationId}/features`, features
    ).pipe(map(response => response.data.features));
  }

  // ==================== USER CREATION ====================

  /**
   * Add a user to an organization
   */
  addUserToOrganization(organizationId: number, data: CreateUserForOrg): Observable<{ user: UserSummary }> {
    return this.http.post<ApiResponse<{ user: UserSummary }>>(
      `${this.apiUrl}/organizations/${organizationId}/users`, data
    ).pipe(map(response => response.data));
  }

  /**
   * Resend invitation email to a user in a specific organization
   */
  resendInvitation(organizationId: number, userId: number): Observable<void> {
    return this.http.post<ApiResponse<void>>(
      `${this.apiUrl}/organizations/${organizationId}/users/${userId}/resend-invitation`, {}
    ).pipe(map(() => void 0));
  }

  /**
   * Get available roles for user assignment
   */
  getAvailableRoles(): Observable<RoleSummary[]> {
    return this.http.get<ApiResponse<{ roles: RoleSummary[] }>>(
      `${this.apiUrl}/roles`
    ).pipe(map(response => response.data.roles));
  }

  // ==================== ROLE CHANGE ====================

  changeUserRole(userId: number, roleName: string): Observable<void> {
    return this.http.put<ApiResponse<void>>(
      `${this.apiUrl}/users/${userId}/role`, { roleName }
    ).pipe(map(() => void 0));
  }

  // ==================== SESSION MANAGEMENT ====================

  getUserSessions(userId: number): Observable<LoginSession[]> {
    return this.http.get<ApiResponse<{ sessions: LoginSession[] }>>(
      `${this.apiUrl}/users/${userId}/sessions`
    ).pipe(map(response => response.data.sessions));
  }

  terminateUserSessions(userId: number): Observable<void> {
    return this.http.post<ApiResponse<void>>(
      `${this.apiUrl}/users/${userId}/terminate-sessions`, {}
    ).pipe(map(() => void 0));
  }

  // ==================== DASHBOARD DRILL-DOWNS ====================

  getActiveUsersByOrg(): Observable<OrgActiveUsers[]> {
    return this.http.get<ApiResponse<{ organizations: OrgActiveUsers[] }>>(
      `${this.apiUrl}/dashboard/active-users-by-org`
    ).pipe(map(r => r.data.organizations));
  }

  getActiveUsersForOrg(orgId: number): Observable<DrillDownUserActivity[]> {
    return this.http.get<ApiResponse<{ users: DrillDownUserActivity[] }>>(
      `${this.apiUrl}/dashboard/active-users-by-org/${orgId}/users`
    ).pipe(map(r => r.data.users));
  }

  getUserSessionsDrillDown(orgId: number, userId: number): Observable<UserSessionItem[]> {
    return this.http.get<ApiResponse<{ sessions: UserSessionItem[] }>>(
      `${this.apiUrl}/dashboard/active-users-by-org/${orgId}/users/${userId}/sessions`
    ).pipe(map(r => r.data.sessions));
  }

  getRequestsByOrg(timeWindow: string = '1h'): Observable<OrgApiRequests[]> {
    const params = new HttpParams().set('timeWindow', timeWindow);
    return this.http.get<ApiResponse<{ organizations: OrgApiRequests[] }>>(
      `${this.apiUrl}/dashboard/requests-by-org`, { params }
    ).pipe(map(r => r.data.organizations));
  }

  getRequestBreakdownForOrg(orgId: number, timeWindow: string = '1h'): Observable<EndpointBreakdown[]> {
    const params = new HttpParams().set('timeWindow', timeWindow);
    return this.http.get<ApiResponse<{ breakdown: EndpointBreakdown[] }>>(
      `${this.apiUrl}/dashboard/requests-by-org/${orgId}/breakdown`, { params }
    ).pipe(map(r => r.data.breakdown));
  }

  getStorageByOrg(): Observable<OrgStorage[]> {
    return this.http.get<ApiResponse<{ organizations: OrgStorage[] }>>(
      `${this.apiUrl}/dashboard/storage-by-org`
    ).pipe(map(r => r.data.organizations));
  }

  getErrorsByOrg(): Observable<OrgErrors[]> {
    return this.http.get<ApiResponse<{ organizations: OrgErrors[] }>>(
      `${this.apiUrl}/dashboard/errors-by-org`
    ).pipe(map(r => r.data.organizations));
  }

  getSecurityByOrg(): Observable<OrgSecurity[]> {
    return this.http.get<ApiResponse<{ organizations: OrgSecurity[] }>>(
      `${this.apiUrl}/dashboard/security-by-org`
    ).pipe(map(r => r.data.organizations));
  }

  getEngagementMetrics(): Observable<EngagementMetrics> {
    return this.http.get<ApiResponse<{ engagement: EngagementMetrics }>>(
      `${this.apiUrl}/dashboard/engagement`
    ).pipe(map(r => r.data.engagement));
  }

  getDataGrowth(): Observable<DataGrowth> {
    return this.http.get<ApiResponse<{ growth: DataGrowth }>>(
      `${this.apiUrl}/dashboard/data-growth`
    ).pipe(map(r => r.data.growth));
  }

  getFeatureAdoption(): Observable<FeatureAdoption> {
    return this.http.get<ApiResponse<{ adoption: FeatureAdoption }>>(
      `${this.apiUrl}/dashboard/feature-adoption`
    ).pipe(map(r => r.data.adoption));
  }
}
