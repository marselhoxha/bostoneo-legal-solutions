import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SuperAdminService } from '../../services/superadmin.service';
import { OrganizationDetail, UserSummary } from '../../models/superadmin.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-organization-detail',
  templateUrl: './organization-detail.component.html',
  styleUrls: ['./organization-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrganizationDetailComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  organizationId!: number;
  organization: OrganizationDetail | null = null;
  users: UserSummary[] = [];

  isLoading = true;
  isLoadingUsers = false;
  error: string | null = null;

  // Users pagination
  usersPage = 0;
  usersPageSize = 10;
  usersTotalElements = 0;
  usersTotalPages = 0;

  activeTab = 'overview';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private superAdminService: SuperAdminService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.organizationId = +params['id'];
      this.loadOrganization();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOrganization(): void {
    this.isLoading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.superAdminService.getOrganizationDetails(this.organizationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (org) => {
          this.organization = org;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = 'Failed to load organization details';
          this.isLoading = false;
          this.cdr.markForCheck();
          console.error('Load organization error:', err);
        }
      });
  }

  loadUsers(): void {
    this.isLoadingUsers = true;
    this.cdr.markForCheck();

    this.superAdminService.getOrganizationUsers(this.organizationId, this.usersPage, this.usersPageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.users = response.content;
          this.usersTotalElements = response.page.totalElements;
          this.usersTotalPages = response.page.totalPages;
          this.isLoadingUsers = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Load users error:', err);
          this.isLoadingUsers = false;
          this.cdr.markForCheck();
        }
      });
  }

  onTabChange(tab: string): void {
    this.activeTab = tab;
    if (tab === 'users' && this.users.length === 0) {
      this.loadUsers();
    }
  }

  goToUsersPage(page: number): void {
    if (page >= 0 && page < this.usersTotalPages) {
      this.usersPage = page;
      this.loadUsers();
    }
  }

  async suspendOrganization(): Promise<void> {
    if (!this.organization) return;

    const result = await Swal.fire({
      title: 'Suspend Organization?',
      text: `Are you sure you want to suspend "${this.organization.name}"? Users will not be able to access the platform.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f06548',
      cancelButtonColor: '#878a99',
      confirmButtonText: 'Yes, suspend it'
    });

    if (result.isConfirmed) {
      this.superAdminService.suspendOrganization(this.organizationId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            Swal.fire('Suspended!', `${this.organization!.name} has been suspended.`, 'success');
            this.loadOrganization();
          },
          error: (err) => {
            Swal.fire('Error', 'Failed to suspend organization', 'error');
            console.error('Suspend error:', err);
          }
        });
    }
  }

  async activateOrganization(): Promise<void> {
    if (!this.organization) return;

    const result = await Swal.fire({
      title: 'Activate Organization?',
      text: `Are you sure you want to activate "${this.organization.name}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0ab39c',
      cancelButtonColor: '#878a99',
      confirmButtonText: 'Yes, activate it'
    });

    if (result.isConfirmed) {
      this.superAdminService.activateOrganization(this.organizationId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            Swal.fire('Activated!', `${this.organization!.name} has been activated.`, 'success');
            this.loadOrganization();
          },
          error: (err) => {
            Swal.fire('Error', 'Failed to activate organization', 'error');
            console.error('Activate error:', err);
          }
        });
    }
  }

  goBack(): void {
    this.router.navigate(['/superadmin/organizations']);
  }

  getStatusClass(status: string): string {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return 'bg-success-subtle text-success';
      case 'SUSPENDED': return 'bg-danger-subtle text-danger';
      case 'PENDING': return 'bg-warning-subtle text-warning';
      default: return 'bg-secondary-subtle text-secondary';
    }
  }

  getPlanBadgeClass(plan: string): string {
    switch (plan?.toUpperCase()) {
      case 'ENTERPRISE': return 'bg-primary';
      case 'PROFESSIONAL': return 'bg-info';
      case 'STARTER': return 'bg-secondary';
      default: return 'bg-light text-dark';
    }
  }

  getRoleBadgeClass(role: string): string {
    switch (role?.toUpperCase()) {
      case 'ROLE_ADMIN': return 'bg-danger-subtle text-danger';
      case 'ROLE_MANAGER':
      case 'ROLE_ATTORNEY': return 'bg-info-subtle text-info';
      case 'ROLE_PARALEGAL': return 'bg-warning-subtle text-warning';
      default: return 'bg-secondary-subtle text-secondary';
    }
  }

  getQuotaClass(percent: number | undefined): string {
    if (!percent) return 'bg-secondary';
    if (percent >= 90) return 'bg-danger';
    if (percent >= 70) return 'bg-warning';
    return 'bg-success';
  }

  getActivityIcon(action: string): string {
    switch (action?.toUpperCase()) {
      case 'CREATE': return 'ri-add-circle-line text-success';
      case 'UPDATE': return 'ri-edit-line text-info';
      case 'DELETE': return 'ri-delete-bin-line text-danger';
      case 'VIEW': return 'ri-eye-line text-primary';
      case 'LOGIN': return 'ri-login-circle-line text-success';
      case 'LOGOUT': return 'ri-logout-circle-line text-secondary';
      default: return 'ri-record-circle-line text-muted';
    }
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatCurrency(value: number | undefined): string {
    if (value === undefined || value === null) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  formatBytes(bytes: number | undefined): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    return `${bytes.toFixed(1)} ${units[i]}`;
  }

  get userPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(0, this.usersPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.usersTotalPages, start + maxVisible);

    if (end - start < maxVisible) {
      start = Math.max(0, end - maxVisible);
    }

    for (let i = start; i < end; i++) {
      pages.push(i);
    }
    return pages;
  }
}
