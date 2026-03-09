import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SuperAdminService } from '../../services/superadmin.service';
import { UserDetail, RoleSummary, LoginSession } from '../../models/superadmin.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-user-detail',
  templateUrl: './user-detail.component.html',
  styleUrls: ['./user-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserDetailComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  userId!: number;
  user: UserDetail | null = null;
  isLoading = true;
  error: string | null = null;

  // Role change
  availableRoles: RoleSummary[] = [];
  selectedRole = '';
  changingRole = false;

  // Sessions
  sessions: LoginSession[] = [];
  isLoadingSessions = false;
  activeTab = 'activity';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private superAdminService: SuperAdminService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.userId = +params['id'];
      this.loadUser();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadUser(): void {
    this.isLoading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.superAdminService.getUserDetails(this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user) => {
          this.user = user;
          this.selectedRole = user.roleName;
          this.isLoading = false;
          this.loadAvailableRoles();
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'Failed to load user details';
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  loadAvailableRoles(): void {
    this.superAdminService.getAvailableRoles()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (roles) => {
          this.availableRoles = roles;
          this.cdr.markForCheck();
        }
      });
  }

  async changeRole(): Promise<void> {
    if (!this.user || !this.selectedRole || this.selectedRole === this.user.roleName) return;

    const oldRole = this.user.roleName?.replace('ROLE_', '') || '';
    const newRole = this.selectedRole?.replace('ROLE_', '') || '';

    const result = await Swal.fire({
      title: 'Change Role?',
      html: `Change role from <strong>${oldRole}</strong> to <strong>${newRole}</strong>?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#405189',
      confirmButtonText: 'Yes, change role'
    });

    if (result.isConfirmed) {
      this.changingRole = true;
      this.cdr.markForCheck();
      this.superAdminService.changeUserRole(this.userId, this.selectedRole)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.changingRole = false;
            Swal.fire('Updated!', `Role changed to ${newRole}`, 'success');
            this.loadUser();
          },
          error: (err) => {
            this.changingRole = false;
            this.cdr.markForCheck();
            Swal.fire('Error', err?.error?.reason || err?.error?.message || 'Failed to change role', 'error');
          }
        });
    }
  }

  onTabChange(tab: string): void {
    this.activeTab = tab;
    if (tab === 'sessions' && this.sessions.length === 0) {
      this.loadSessions();
    }
  }

  loadSessions(): void {
    this.isLoadingSessions = true;
    this.cdr.markForCheck();
    this.superAdminService.getUserSessions(this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sessions) => {
          this.sessions = sessions;
          this.isLoadingSessions = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingSessions = false;
          this.cdr.markForCheck();
        }
      });
  }

  async terminateSessions(): Promise<void> {
    const result = await Swal.fire({
      title: 'Terminate All Sessions?',
      text: 'This will log the user out of all devices immediately.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f06548',
      confirmButtonText: 'Yes, terminate all'
    });

    if (result.isConfirmed) {
      this.superAdminService.terminateUserSessions(this.userId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            Swal.fire('Done!', 'All sessions terminated.', 'success');
            this.loadSessions();
          },
          error: () => Swal.fire('Error', 'Failed to terminate sessions', 'error')
        });
    }
  }

  async toggleMfa(): Promise<void> {
    if (!this.user) return;
    const action = this.user.usingMfa ? 'disable' : 'enable';

    const result = await Swal.fire({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} MFA?`,
      text: `Are you sure you want to ${action} MFA for this user?`,
      icon: this.user.usingMfa ? 'warning' : 'question',
      showCancelButton: true,
      confirmButtonColor: this.user.usingMfa ? '#f06548' : '#0ab39c',
      confirmButtonText: `Yes, ${action} MFA`
    });

    if (result.isConfirmed) {
      this.superAdminService.toggleUserMfa(this.userId, !this.user.usingMfa)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            Swal.fire('Success', `MFA ${action}d successfully`, 'success');
            this.loadUser();
          },
          error: (err: any) => {
            const reason = err?.error?.reason || err?.error?.message || err?.message || `Failed to ${action} MFA`;
            Swal.fire('Error', reason, 'error');
          }
        });
    }
  }

  async toggleUserStatus(): Promise<void> {
    if (!this.user) return;
    const action = this.user.enabled ? 'disable' : 'enable';

    const result = await Swal.fire({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} User?`,
      text: `Are you sure you want to ${action} this user?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: this.user.enabled ? '#f06548' : '#0ab39c',
      confirmButtonText: `Yes, ${action}`
    });

    if (result.isConfirmed) {
      this.superAdminService.toggleUserStatus(this.userId, !this.user.enabled)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            Swal.fire('Success', `User ${action}d successfully`, 'success');
            this.loadUser();
          },
          error: () => Swal.fire('Error', `Failed to ${action} user`, 'error')
        });
    }
  }

  async resetPassword(): Promise<void> {
    if (!this.user) return;

    const result = await Swal.fire({
      title: 'Reset Password?',
      text: `Send password reset email to ${this.user.email}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, send reset email'
    });

    if (result.isConfirmed) {
      this.superAdminService.resetUserPassword(this.userId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => Swal.fire('Success', 'Password reset email sent', 'success'),
          error: () => Swal.fire('Error', 'Failed to send reset email', 'error')
        });
    }
  }

  async resendVerification(): Promise<void> {
    if (!this.user) return;

    const result = await Swal.fire({
      title: 'Resend Verification?',
      text: `Send verification email to ${this.user.email}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, send email'
    });

    if (result.isConfirmed) {
      this.superAdminService.resendVerificationEmail(this.userId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => Swal.fire('Success', 'Verification email sent', 'success'),
          error: () => Swal.fire('Error', 'Failed to send email', 'error')
        });
    }
  }

  goBack(): void {
    this.router.navigate(['/superadmin/users']);
  }

  getRoleBadgeClass(role: string): string {
    switch (role?.toUpperCase()) {
      case 'ROLE_SUPERADMIN': return 'bg-danger';
      case 'ROLE_ADMIN': return 'bg-primary';
      case 'ROLE_ATTORNEY': return 'bg-info';
      case 'ROLE_PARALEGAL': return 'bg-warning';
      default: return 'bg-secondary';
    }
  }

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
