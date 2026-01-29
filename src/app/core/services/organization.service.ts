import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { TeamMember, TeamMemberPage } from '../../modules/organization-management/models/organization.model';

export interface Organization {
  id: number;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  logoUrl?: string;
  planType?: string;
  planExpiresAt?: string;
  twilioEnabled?: boolean;
  twilioPhoneNumber?: string;
  twilioWhatsappNumber?: string;
  twilioConfigured?: boolean;
  boldsignEnabled?: boolean;
  boldsignConfigured?: boolean;
  smsEnabled?: boolean;
  whatsappEnabled?: boolean;
  emailEnabled?: boolean;
  signatureReminderEmail?: boolean;
  signatureReminderSms?: boolean;
  signatureReminderWhatsapp?: boolean;
  signatureReminderDays?: string;
  createdAt?: string;
  updatedAt?: string;
  isActive?: boolean;
}

export interface OrganizationStats {
  organizationId: number;
  organizationName: string;
  userCount: number;
  activeUserCount: number;
  caseCount: number;
  activeCaseCount: number;
  documentCount: number;
  storageUsedBytes: number;
  clientCount: number;
  planQuota: PlanQuota;
  userUsagePercent: number;
  caseUsagePercent: number;
  storageUsagePercent: number;
}

export interface PlanQuota {
  planType: string;
  maxUsers: number;
  maxCases: number;
  maxStorageBytes: number;
  maxClients: number;
  hasApiAccess: boolean;
  hasAdvancedReporting: boolean;
  hasCustomBranding: boolean;
  hasPrioritySupport: boolean;
}

export interface OrganizationPage {
  organizations: Organization[];
  page: {
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
}

/**
 * Service for managing the current organization context.
 * Enhanced for multi-tenant support and organization management.
 */
@Injectable({
  providedIn: 'root'
})
export class OrganizationService {
  private readonly apiUrl = `${environment.apiUrl}/api/organizations`;

  private readonly SWITCHED_ORG_KEY = 'switched_organization_id';

  private currentOrganizationSubject = new BehaviorSubject<Organization | null>(null);
  public currentOrganization$ = this.currentOrganizationSubject.asObservable();

  constructor(private http: HttpClient) {
    // Don't auto-load on startup - let the app component trigger this after auth is ready
  }

  /**
   * Decode base64url (JWT uses this, not standard base64)
   */
  private base64UrlDecode(str: string): string {
    // Replace base64url characters with base64 characters
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    // Pad with '=' to make length a multiple of 4
    while (base64.length % 4) {
      base64 += '=';
    }
    return atob(base64);
  }

  /**
   * Get the user's organization ID from JWT token or stored profile
   */
  private getUserOrganizationId(): number | null {
    try {
      // First check for switched organization (sysadmin feature)
      const switchedOrgId = localStorage.getItem(this.SWITCHED_ORG_KEY);
      if (switchedOrgId) {
        return parseInt(switchedOrgId, 10);
      }

      // Get organization from JWT token (most reliable source)
      const token = localStorage.getItem('[KEY] TOKEN');
      if (token) {
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(this.base64UrlDecode(tokenParts[1]));
          // JWT claims can be organizationId or organization_id
          if (payload.organizationId) {
            return payload.organizationId;
          }
          if (payload.organization_id) {
            return payload.organization_id;
          }
        }
      }

      // Fallback: Get from user's stored data
      const currentUserStr = localStorage.getItem('currentUser');
      if (currentUserStr) {
        const currentUser = JSON.parse(currentUserStr);
        if (currentUser.organizationId) {
          return currentUser.organizationId;
        }
        if (currentUser.organization?.id) {
          return currentUser.organization.id;
        }
      }
    } catch (error) {
      // Silently handle parse errors
    }
    return null;
  }

  /**
   * Get the current organization ID synchronously
   */
  getCurrentOrganizationId(): number {
    // Check if there's a switched organization in localStorage (for sysadmin)
    const switchedOrgId = localStorage.getItem(this.SWITCHED_ORG_KEY);
    if (switchedOrgId) {
      return parseInt(switchedOrgId, 10);
    }

    // First try from loaded organization
    const org = this.currentOrganizationSubject.value;
    if (org?.id) {
      return org.id;
    }

    // Then try from user's stored data
    const userOrgId = this.getUserOrganizationId();
    if (userOrgId) {
      return userOrgId;
    }

    // No organization found - user might not be authenticated
    return 0;
  }

  /**
   * Get the current organization
   */
  getCurrentOrganization(): Organization | null {
    return this.currentOrganizationSubject.value;
  }

  /**
   * Load the current organization context from JWT
   * Note: We only set the org ID from JWT, we don't need to fetch full details from API
   */
  loadCurrentOrganization(): void {
    const orgId = this.getUserOrganizationId();

    // Don't load if no organization ID available (user not authenticated)
    if (!orgId) {
      return;
    }

    // Set organization from JWT - no API call needed for basic tenant isolation
    this.currentOrganizationSubject.next({
      id: orgId,
      name: 'My Organization',
      slug: 'org-' + orgId,
      isActive: true
    });
  }

  /**
   * Set the current organization (for multi-tenant support)
   */
  setCurrentOrganization(org: Organization): void {
    this.currentOrganizationSubject.next(org);
  }

  /**
   * Switch to a different organization (Sysadmin only)
   */
  switchOrganization(organizationId: number): void {
    localStorage.setItem(this.SWITCHED_ORG_KEY, organizationId.toString());
    this.loadCurrentOrganization();
  }

  /**
   * Clear switched organization (return to default)
   */
  clearSwitchedOrganization(): void {
    localStorage.removeItem(this.SWITCHED_ORG_KEY);
    this.loadCurrentOrganization();
  }

  /**
   * Check if currently in a switched organization context
   */
  isInSwitchedContext(): boolean {
    return !!localStorage.getItem(this.SWITCHED_ORG_KEY);
  }

  /**
   * Get organization by ID
   */
  getOrganizationById(id: number): Observable<Organization | null> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(response => response.data?.organization || null),
      catchError(() => of(null))
    );
  }

  /**
   * Get all organizations (non-paginated)
   */
  getAllOrganizations(): Observable<Organization[]> {
    return this.http.get<any>(this.apiUrl).pipe(
      map(response => response.data?.organizations || []),
      catchError(() => of([]))
    );
  }

  /**
   * Get paginated list of organizations
   */
  getOrganizationsPaginated(
    page: number = 0,
    size: number = 10,
    sortBy: string = 'id',
    sortDir: string = 'asc'
  ): Observable<OrganizationPage> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('sortDir', sortDir);

    return this.http.get<any>(`${this.apiUrl}/paginated`, { params }).pipe(
      map(response => ({
        organizations: response.data?.organizations || [],
        page: response.data?.page || { number: 0, size: 10, totalElements: 0, totalPages: 0 }
      })),
      catchError(() => of({
        organizations: [],
        page: { number: 0, size: 10, totalElements: 0, totalPages: 0 }
      }))
    );
  }

  /**
   * Search organizations
   */
  searchOrganizations(query: string): Observable<Organization[]> {
    const params = new HttpParams().set('query', query);
    return this.http.get<any>(`${this.apiUrl}/search`, { params }).pipe(
      map(response => response.data?.organizations || []),
      catchError(() => of([]))
    );
  }

  /**
   * Create new organization
   */
  createOrganization(organization: Partial<Organization>): Observable<Organization> {
    return this.http.post<any>(this.apiUrl, organization).pipe(
      map(response => response.data?.organization)
    );
  }

  /**
   * Update organization
   */
  updateOrganization(id: number, organization: Partial<Organization>): Observable<Organization> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, organization).pipe(
      map(response => response.data?.organization)
    );
  }

  /**
   * Delete organization
   */
  deleteOrganization(id: number): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`).pipe(
      map(() => undefined)
    );
  }

  /**
   * Get organization statistics
   */
  getOrganizationStats(id: number): Observable<OrganizationStats | null> {
    return this.http.get<any>(`${this.apiUrl}/${id}/stats`).pipe(
      map(response => response.data?.stats || null),
      catchError(() => of(null))
    );
  }

  /**
   * Check if slug is available
   */
  checkSlugAvailability(slug: string): Observable<boolean> {
    return this.http.get<any>(`${this.apiUrl}/check-slug/${slug}`).pipe(
      map(response => {
        // Backend returns { data: { available: true/false, slug: "..." } }
        const available = response?.data?.available;
        return available === true;
      }),
      catchError(() => {
        // On error, assume slug is available to not block the user
        return of(true);
      })
    );
  }

  /**
   * Update notification preferences
   */
  updateNotificationPreferences(id: number, preferences: any): Observable<Organization> {
    const params = new HttpParams()
      .set('smsEnabled', preferences.smsEnabled?.toString() || '')
      .set('whatsappEnabled', preferences.whatsappEnabled?.toString() || '')
      .set('emailEnabled', preferences.emailEnabled?.toString() || '')
      .set('signatureReminderEmail', preferences.signatureReminderEmail?.toString() || '')
      .set('signatureReminderSms', preferences.signatureReminderSms?.toString() || '')
      .set('signatureReminderWhatsapp', preferences.signatureReminderWhatsapp?.toString() || '')
      .set('signatureReminderDays', preferences.signatureReminderDays || '');

    return this.http.put<any>(`${this.apiUrl}/${id}/notifications`, null, { params }).pipe(
      map(response => response.data?.organization)
    );
  }

  /**
   * Get users in an organization (paginated)
   */
  getUsersByOrganization(
    organizationId: number,
    page: number = 0,
    size: number = 10,
    sortBy: string = 'id',
    sortDir: string = 'asc'
  ): Observable<TeamMemberPage> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('sortDir', sortDir);

    return this.http.get<any>(`${this.apiUrl}/${organizationId}/users`, { params }).pipe(
      map(response => ({
        users: response.data?.users || [],
        page: response.data?.page || { number: 0, size: 10, totalElements: 0, totalPages: 0 }
      })),
      catchError(() => of({
        users: [],
        page: { number: 0, size: 10, totalElements: 0, totalPages: 0 }
      }))
    );
  }

  /**
   * Remove user from organization
   */
  removeUserFromOrganization(organizationId: number, userId: number): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/${organizationId}/users/${userId}`).pipe(
      map(() => undefined)
    );
  }

  /**
   * Update user role in organization
   */
  updateUserRole(organizationId: number, userId: number, role: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${organizationId}/users/${userId}/role`, { role }).pipe(
      map(response => response.data?.user)
    );
  }
}
