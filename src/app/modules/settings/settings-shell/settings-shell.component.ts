import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { UserService } from '../../../service/user.service';
import { OrganizationService } from '../../../core/services/organization.service';
import { RbacService } from '../../../core/services/rbac.service';
import { NotificationService } from '../../../service/notification.service';

export interface SettingsTab {
  key: string;
  label: string;
  icon: string;
  section?: string;
}

@Component({
  selector: 'app-settings-shell',
  templateUrl: './settings-shell.component.html',
  styleUrls: ['./settings-shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class SettingsShellComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeTab = 'profile';
  user: any = null;
  events: any[] = [];
  roles: any[] = [];
  organizationId: number = 0;
  organization: any = null;
  isLoading = true;
  isSaving = false;

  // Role-based tab visibility
  canSeeOrganization = false;
  canSeeIntegrations = false;
  canSeeStationery = false;

  tabs: SettingsTab[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private organizationService: OrganizationService,
    private rbacService: RbacService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Read active tab from route
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'];
        this.cdr.markForCheck();
      }
    });

    // Load user data
    this.loadUserData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadUserData(): void {
    this.userService.refreshUserData();
    this.userService.profile$().pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response?.data?.user) {
          this.user = response.data.user;
          this.events = response.data.events || [];
          this.roles = response.data.roles || [];
          this.organizationId = this.user.organizationId || this.organizationService.getCurrentOrganizationId() || 0;

          // Determine tab visibility based on roles
          this.determineTabVisibility();
          this.buildTabs();

          // Load org data if user is admin
          if (this.canSeeOrganization && this.organizationId) {
            this.loadOrganizationData();
          }

          this.isLoading = false;
          this.cdr.markForCheck();
        }
      },
      error: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private loadOrganizationData(): void {
    this.organizationService.getOrganizationById(this.organizationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(org => {
        this.organization = org;
        this.cdr.markForCheck();
      });
  }

  private determineTabVisibility(): void {
    // All firm members (attorneys, partners, admins) can see org settings
    // Only ROLE_CLIENT and ROLE_USER are excluded
    const excludedRoles = ['ROLE_CLIENT', 'ROLE_USER'];
    const userRole = this.user?.roleName || '';

    const isExcluded = excludedRoles.some(r => userRole === r);
    this.canSeeOrganization = !isExcluded && !!this.organizationId;
    this.canSeeIntegrations = this.canSeeOrganization;
    this.canSeeStationery = !isExcluded;
  }

  private buildTabs(): void {
    this.tabs = [
      { key: 'profile', label: 'Profile', icon: 'ri-user-3-line', section: 'Personal' },
      { key: 'security', label: 'Security', icon: 'ri-shield-keyhole-line', section: 'Personal' },
      { key: 'notifications', label: 'Notifications', icon: 'ri-notification-3-line', section: 'Personal' },
    ];

    if (this.canSeeOrganization) {
      this.tabs.push({ key: 'organization', label: 'Organization', icon: 'ri-building-line', section: 'Firm' });
    }
    if (this.canSeeIntegrations) {
      this.tabs.push({ key: 'integrations', label: 'Integrations', icon: 'ri-plug-line', section: 'Firm' });
    }
    if (this.canSeeStationery) {
      this.tabs.push({ key: 'stationery', label: 'Stationery', icon: 'ri-file-text-line', section: 'Workspace' });
    }
  }

  navigateToTab(tab: string): void {
    this.router.navigate(['/settings', tab]);
  }

  onUserUpdated(updatedUser: any): void {
    this.user = updatedUser;
    this.cdr.markForCheck();
  }

  onOrganizationUpdated(updatedOrg: any): void {
    this.organization = updatedOrg;
    this.cdr.markForCheck();
  }

  getInitials(): string {
    if (!this.user) return '?';
    return (this.user.firstName?.charAt(0) || '') + (this.user.lastName?.charAt(0) || '');
  }
}
