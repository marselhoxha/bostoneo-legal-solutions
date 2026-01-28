import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { OrganizationInvitation } from '../../modules/organization-management/models/organization.model';

export interface InvitationValidation {
  valid: boolean;
  email?: string;
  organizationName?: string;
  role?: string;
  expiresAt?: string;
  errorMessage?: string;
}

@Injectable({
  providedIn: 'root'
})
export class InvitationService {
  private readonly apiUrl = `${environment.apiUrl}/api/organizations`;

  constructor(private http: HttpClient) {}

  /**
   * Get all invitations for an organization
   */
  getAllInvitations(orgId: number): Observable<OrganizationInvitation[]> {
    return this.http.get<any>(`${this.apiUrl}/invitations`).pipe(
      map(response => response.data?.invitations || []),
      catchError(() => of([]))
    );
  }

  /**
   * Get pending invitations for an organization
   */
  getPendingInvitations(orgId: number): Observable<OrganizationInvitation[]> {
    return this.http.get<any>(`${this.apiUrl}/invitations/pending`).pipe(
      map(response => response.data?.invitations || []),
      catchError(() => of([]))
    );
  }

  /**
   * Send a new invitation
   */
  sendInvitation(orgId: number, email: string, role: string): Observable<OrganizationInvitation> {
    return this.http.post<any>(`${this.apiUrl}/invitations`, { email, role }).pipe(
      map(response => response.data?.invitation)
    );
  }

  /**
   * Resend an existing invitation
   */
  resendInvitation(invitationId: number): Observable<OrganizationInvitation> {
    return this.http.post<any>(`${this.apiUrl}/invitations/${invitationId}/resend`, {}).pipe(
      map(response => response.data?.invitation)
    );
  }

  /**
   * Cancel/delete an invitation
   */
  cancelInvitation(invitationId: number): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/invitations/${invitationId}`).pipe(
      map(() => undefined)
    );
  }

  /**
   * Validate an invitation token (public endpoint)
   */
  validateToken(token: string): Observable<InvitationValidation> {
    return this.http.get<any>(`${this.apiUrl}/invitations/validate/${token}`).pipe(
      map(response => ({
        valid: response.data?.valid || false,
        email: response.data?.email,
        organizationName: response.data?.organizationName,
        role: response.data?.role,
        expiresAt: response.data?.expiresAt,
        errorMessage: response.data?.errorMessage
      })),
      catchError(() => of({ valid: false, errorMessage: 'Invalid or expired invitation' }))
    );
  }

  /**
   * Accept an invitation (requires authentication)
   */
  acceptInvitation(token: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/invitations/accept/${token}`, {}).pipe(
      map(response => response.data?.user)
    );
  }

  /**
   * Helper: Get invitation status based on expiry and acceptance
   */
  getInvitationStatus(invitation: OrganizationInvitation): 'PENDING' | 'EXPIRED' | 'ACCEPTED' {
    if (invitation.acceptedAt) {
      return 'ACCEPTED';
    }
    const now = new Date();
    const expires = new Date(invitation.expiresAt);
    if (now > expires) {
      return 'EXPIRED';
    }
    return 'PENDING';
  }

  /**
   * Helper: Get status badge class
   */
  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'PENDING': return 'bg-warning-subtle text-warning';
      case 'EXPIRED': return 'bg-danger-subtle text-danger';
      case 'ACCEPTED': return 'bg-success-subtle text-success';
      default: return 'bg-secondary-subtle text-secondary';
    }
  }
}
