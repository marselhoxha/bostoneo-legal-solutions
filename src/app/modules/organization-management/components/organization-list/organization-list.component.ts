import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { OrganizationService, Organization, OrganizationPage } from '../../../../core/services/organization.service';
import { RbacService } from '../../../../core/services/rbac.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-organization-list',
  templateUrl: './organization-list.component.html',
  styleUrls: ['./organization-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrganizationListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  organizations: Organization[] = [];
  allOrganizations: Organization[] = [];
  isLoading = false;
  searchQuery = '';
  searchSubject = new Subject<string>();

  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;

  // Sorting
  sortBy = 'id';
  sortDir = 'asc';

  // Plan filter
  selectedPlanFilter = '';
  planTypes = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'];

  // Stats
  activeCount = 0;
  enterpriseCount = 0;
  freeCount = 0;

  // Math reference for template
  Math = Math;

  constructor(
    private organizationService: OrganizationService,
    private rbacService: RbacService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadOrganizations();
    this.loadAllOrganizationsForStats();
    this.setupSearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearch(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      this.searchQuery = query;
      this.currentPage = 0;
      this.loadOrganizations();
    });
  }

  private loadAllOrganizationsForStats(): void {
    this.organizationService.getAllOrganizations()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orgs) => {
          this.allOrganizations = orgs;
          this.calculateStats();
          this.cdr.markForCheck();
        }
      });
  }

  private calculateStats(): void {
    this.activeCount = this.allOrganizations.filter(org => org.isActive !== false).length;
    this.enterpriseCount = this.allOrganizations.filter(org => org.planType === 'ENTERPRISE').length;
    this.freeCount = this.allOrganizations.filter(org => !org.planType || org.planType === 'FREE').length;
  }

  loadOrganizations(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    if (this.searchQuery) {
      this.organizationService.searchOrganizations(this.searchQuery)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (orgs) => {
            this.organizations = this.filterOrganizations(orgs);
            this.totalElements = this.allOrganizations.length;
            this.totalPages = 1;
            this.isLoading = false;
            this.cdr.markForCheck();
          },
          error: () => {
            this.isLoading = false;
            this.cdr.markForCheck();
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Failed to search organizations',
              timer: 3000
            });
          }
        });
    } else {
      this.organizationService.getOrganizationsPaginated(
        this.currentPage,
        this.pageSize,
        this.sortBy,
        this.sortDir
      ).pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (result: OrganizationPage) => {
            this.organizations = this.filterOrganizations(result.organizations);
            this.totalElements = result.page.totalElements;
            this.totalPages = result.page.totalPages;
            this.isLoading = false;
            this.cdr.markForCheck();
          },
          error: () => {
            this.isLoading = false;
            this.cdr.markForCheck();
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Failed to load organizations',
              timer: 3000
            });
          }
        });
    }
  }

  private filterOrganizations(orgs: Organization[]): Organization[] {
    if (!this.selectedPlanFilter) {
      return orgs;
    }
    if (this.selectedPlanFilter === 'active') {
      return orgs.filter(org => org.isActive !== false);
    }
    return orgs.filter(org => org.planType === this.selectedPlanFilter);
  }

  onSearch(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.searchSubject.next(query);
  }

  filterByPlan(plan: string): void {
    this.selectedPlanFilter = plan;
    this.currentPage = 0;
    this.loadOrganizations();
  }

  filterByActive(): void {
    this.selectedPlanFilter = 'active';
    this.currentPage = 0;
    this.loadOrganizations();
  }

  clearFilter(): void {
    this.selectedPlanFilter = '';
    this.searchQuery = '';
    this.currentPage = 0;
    this.loadOrganizations();
  }

  onSort(column: string): void {
    if (this.sortBy === column) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortDir = 'asc';
    }
    this.loadOrganizations();
  }

  onPageChange(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadOrganizations();
    }
  }

  createOrganization(): void {
    this.router.navigate(['/organizations/create']);
  }

  editOrganization(org: Organization): void {
    this.router.navigate(['/organizations/edit', org.id]);
  }

  viewOrganization(org: Organization): void {
    this.router.navigate(['/organizations/details', org.id]);
  }

  deleteOrganization(org: Organization): void {
    if (org.id === 1) {
      Swal.fire({
        icon: 'warning',
        title: 'Cannot Delete',
        text: 'The default organization cannot be deleted.'
      });
      return;
    }

    Swal.fire({
      title: 'Delete Organization?',
      html: `Are you sure you want to delete <strong>${org.name}</strong>?<br><br>
             <span class="text-danger">This action cannot be undone and will affect all users and data within this organization.</span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f06548',
      cancelButtonColor: '#878a99',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.organizationService.deleteOrganization(org.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              Swal.fire({
                icon: 'success',
                title: 'Deleted!',
                text: 'Organization has been deleted.',
                timer: 2000
              });
              this.loadOrganizations();
              this.loadAllOrganizationsForStats();
            },
            error: (err) => {
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: err.error?.message || 'Failed to delete organization'
              });
            }
          });
      }
    });
  }

  switchToOrganization(org: Organization): void {
    Swal.fire({
      title: 'Switch Organization?',
      html: `You are about to switch to <strong>${org.name}</strong>.<br><br>
             You will be viewing data as if you were a member of this organization.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0ab39c',
      cancelButtonColor: '#878a99',
      confirmButtonText: 'Switch'
    }).then((result) => {
      if (result.isConfirmed) {
        this.organizationService.switchOrganization(org.id);
        Swal.fire({
          icon: 'success',
          title: 'Switched!',
          text: `Now viewing as ${org.name}`,
          timer: 2000
        });
        window.location.reload();
      }
    });
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

  get pages(): number[] {
    const pages: number[] = [];
    const maxPages = Math.min(5, this.totalPages);
    let start = Math.max(0, this.currentPage - 2);
    let end = Math.min(this.totalPages - 1, start + maxPages - 1);

    if (end - start < maxPages - 1) {
      start = Math.max(0, end - maxPages + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }
}
