import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, catchError } from 'rxjs/operators';
import { OrganizationService, Organization, OrganizationStats } from '../../../../core/services/organization.service';
import { RbacService } from '../../../../core/services/rbac.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-organization-switcher',
  templateUrl: './organization-switcher.component.html',
  styleUrls: ['./organization-switcher.component.scss']
})
export class OrganizationSwitcherComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  organizations: Organization[] = [];
  filteredOrganizations: Organization[] = [];
  currentOrganization: Organization | null = null;
  isLoading = false;
  searchQuery = '';
  searchSubject = new Subject<string>();
  isAdmin = false;

  // Role-aware state
  isSuperAdmin = false;
  orgStats: OrganizationStats | null = null;
  orgDetails: Organization | null = null;
  isLoadingStats = false;
  private searchSetup = false;

  constructor(
    private organizationService: OrganizationService,
    private rbacService: RbacService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Check if user is ADMIN - first do synchronous check
    this.checkAdminStatus();

    // Also subscribe to permission changes in case they load after component init
    this.rbacService.getCurrentUserPermissions()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.checkAdminStatus();
      });

    // Subscribe to current organization changes
    this.organizationService.currentOrganization$
      .pipe(takeUntil(this.destroy$))
      .subscribe(org => {
        this.currentOrganization = org;
      });
  }

  private checkAdminStatus(): void {
    const wasAdmin = this.isAdmin;
    this.isAdmin = this.rbacService.hasRole('ROLE_ADMIN') || this.rbacService.isAdmin();
    this.isSuperAdmin = this.rbacService.hasRole('ROLE_SUPERADMIN');

    // If just became admin and organizations not loaded yet, load them (SUPERADMIN only)
    if (this.isAdmin && !wasAdmin && this.isSuperAdmin) {
      if (this.organizations.length === 0) {
        this.loadOrganizations();
        this.setupSearch();
      }
    }

    if (this.isAdmin && !wasAdmin) {
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearch(): void {
    if (this.searchSetup) return;
    this.searchSetup = true;

    this.searchSubject.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      this.filterOrganizations(query);
    });
  }

  private loadOrganizations(): void {
    this.isLoading = true;
    this.organizationService.getAllOrganizations()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orgs) => {
          this.organizations = orgs;
          this.filteredOrganizations = orgs;
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
        }
      });
  }

  onDropdownToggle(isOpen: boolean): void {
    if (!isOpen) return;

    if (this.isSuperAdmin) {
      if (this.organizations.length === 0) {
        this.loadOrganizations();
      }
    } else {
      this.loadOrgInfo();
    }
  }

  onSearch(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.searchSubject.next(query);
  }

  private filterOrganizations(query: string): void {
    if (!query.trim()) {
      this.filteredOrganizations = this.organizations;
      return;
    }

    const lowerQuery = query.toLowerCase();
    this.filteredOrganizations = this.organizations.filter(org =>
      org.name.toLowerCase().includes(lowerQuery) ||
      org.slug.toLowerCase().includes(lowerQuery)
    );
  }

  switchToOrganization(org: Organization): void {
    if (org.id === this.currentOrganization?.id) {
      return;
    }

    this.organizationService.switchOrganization(org.id);

    Swal.fire({
      icon: 'success',
      title: 'Organization Switched',
      html: `Now viewing as <strong>${org.name}</strong>`,
      timer: 1500,
      showConfirmButton: false
    }).then(() => {
      // Reload to refresh all data with new org context
      window.location.reload();
    });
  }

  clearSwitchedOrg(): void {
    if (!this.organizationService.isInSwitchedContext()) {
      return;
    }

    this.organizationService.clearSwitchedOrganization();

    Swal.fire({
      icon: 'success',
      title: 'Context Cleared',
      text: 'Returned to default organization',
      timer: 1500,
      showConfirmButton: false
    }).then(() => {
      window.location.reload();
    });
  }

  isInSwitchedContext(): boolean {
    return this.organizationService.isInSwitchedContext();
  }

  // --- ROLE_ADMIN info card methods ---

  private loadOrgInfo(): void {
    const orgId = this.organizationService.getCurrentOrganizationId();
    if (!orgId || this.isLoadingStats || this.orgStats) return;

    this.isLoadingStats = true;
    this.cdr.detectChanges();

    forkJoin({
      details: this.organizationService.getOrganizationById(orgId).pipe(catchError(() => of(null))),
      stats: this.organizationService.getOrganizationStats(orgId).pipe(catchError(() => of(null)))
    }).pipe(takeUntil(this.destroy$)).subscribe(({ details, stats }) => {
      this.orgDetails = details;
      this.orgStats = stats;
      this.isLoadingStats = false;
      this.cdr.detectChanges();
    });
  }

  navigateToSettings(): void {
    this.router.navigate(['/settings/organization']);
  }

  navigateToTeam(): void {
    const orgId = this.organizationService.getCurrentOrganizationId();
    if (orgId) {
      this.router.navigate(['/organizations/details', orgId], { queryParams: { tab: 'team' } });
    }
  }

  navigateToInvitations(): void {
    const orgId = this.organizationService.getCurrentOrganizationId();
    if (orgId) {
      this.router.navigate(['/organizations/details', orgId], { queryParams: { tab: 'invitations' } });
    }
  }

  getPlanBadgeClass(planType: string | undefined): string {
    switch (planType) {
      case 'FREE': return 'bg-secondary-subtle text-secondary';
      case 'STARTER': return 'bg-info-subtle text-info';
      case 'PROFESSIONAL': return 'bg-primary-subtle text-primary';
      case 'ENTERPRISE': return 'bg-warning-subtle text-warning';
      default: return 'bg-secondary-subtle text-secondary';
    }
  }
}
