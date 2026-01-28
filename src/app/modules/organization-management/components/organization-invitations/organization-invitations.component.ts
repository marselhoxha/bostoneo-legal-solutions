import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { InvitationService } from '../../../../core/services/invitation.service';
import { OrganizationInvitation, ROLE_OPTIONS } from '../../models/organization.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-organization-invitations',
  templateUrl: './organization-invitations.component.html',
  styleUrls: ['./organization-invitations.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrganizationInvitationsComponent implements OnInit, OnDestroy {
  @Input() organizationId!: number;

  private destroy$ = new Subject<void>();

  invitations: OrganizationInvitation[] = [];
  isLoading = false;
  showAll = false;
  roleOptions = ROLE_OPTIONS;

  // Invite form
  inviteEmail = '';
  inviteRole = 'USER';
  isSubmitting = false;

  constructor(
    private invitationService: InvitationService,
    private modalService: NgbModal,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadInvitations();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadInvitations(): void {
    if (!this.organizationId) return;

    this.isLoading = true;
    this.cdr.markForCheck();

    const loadFn = this.showAll
      ? this.invitationService.getAllInvitations(this.organizationId)
      : this.invitationService.getPendingInvitations(this.organizationId);

    loadFn.pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (invitations) => {
          this.invitations = invitations;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  toggleShowAll(): void {
    this.showAll = !this.showAll;
    this.loadInvitations();
    this.cdr.markForCheck();
  }

  openInviteModal(content: any): void {
    this.inviteEmail = '';
    this.inviteRole = 'USER';
    this.modalService.open(content, { centered: true, size: 'md' });
  }

  sendInvitation(modal: any): void {
    if (!this.inviteEmail || !this.inviteRole) return;

    this.isSubmitting = true;
    this.invitationService.sendInvitation(this.organizationId, this.inviteEmail, this.inviteRole)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          modal.close();
          Swal.fire({
            icon: 'success',
            title: 'Invitation Sent',
            text: `An invitation has been sent to ${this.inviteEmail}`,
            timer: 3000,
            showConfirmButton: false
          });
          this.loadInvitations();
        },
        error: (err) => {
          this.isSubmitting = false;
          Swal.fire({
            icon: 'error',
            title: 'Failed to Send Invitation',
            text: err?.error?.message || 'Please try again'
          });
        }
      });
  }

  resendInvitation(invitation: OrganizationInvitation): void {
    Swal.fire({
      title: 'Resend Invitation',
      text: `Resend invitation to ${invitation.email}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Resend',
      confirmButtonColor: '#405189'
    }).then((result) => {
      if (result.isConfirmed) {
        this.invitationService.resendInvitation(invitation.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              Swal.fire({
                icon: 'success',
                title: 'Invitation Resent',
                text: `A new invitation has been sent to ${invitation.email}`,
                timer: 2000,
                showConfirmButton: false
              });
              this.loadInvitations();
            },
            error: (err) => {
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: err?.error?.message || 'Failed to resend invitation'
              });
            }
          });
      }
    });
  }

  cancelInvitation(invitation: OrganizationInvitation): void {
    Swal.fire({
      title: 'Cancel Invitation',
      html: `Are you sure you want to cancel the invitation for <strong>${invitation.email}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Cancel Invitation',
      confirmButtonColor: '#f06548',
      cancelButtonText: 'Keep'
    }).then((result) => {
      if (result.isConfirmed) {
        this.invitationService.cancelInvitation(invitation.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              Swal.fire({
                icon: 'success',
                title: 'Invitation Cancelled',
                timer: 2000,
                showConfirmButton: false
              });
              this.loadInvitations();
            },
            error: (err) => {
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: err?.error?.message || 'Failed to cancel invitation'
              });
            }
          });
      }
    });
  }

  getInvitationStatus(invitation: OrganizationInvitation): string {
    return this.invitationService.getInvitationStatus(invitation);
  }

  getStatusBadgeClass(status: string): string {
    return this.invitationService.getStatusBadgeClass(status);
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'PENDING': return 'ri-time-line';
      case 'EXPIRED': return 'ri-error-warning-line';
      case 'ACCEPTED': return 'ri-checkbox-circle-line';
      default: return 'ri-question-line';
    }
  }

  getRoleBadgeClass(role: string): string {
    switch (role?.toUpperCase()) {
      case 'ADMIN': return 'bg-danger-subtle text-danger';
      case 'MANAGER': return 'bg-warning-subtle text-warning';
      case 'USER': return 'bg-info-subtle text-info';
      default: return 'bg-secondary-subtle text-secondary';
    }
  }

  getDaysUntilExpiry(invitation: OrganizationInvitation): number {
    const now = new Date();
    const expires = new Date(invitation.expiresAt);
    const diffTime = expires.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  get pendingCount(): number {
    return this.invitations.filter(i => this.getInvitationStatus(i) === 'PENDING').length;
  }
}
