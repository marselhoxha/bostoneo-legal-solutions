import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { SuperAdminService } from '../../services/superadmin.service';
import { OrganizationWithStats } from '../../models/superadmin.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-organization-list',
  templateUrl: './organization-list.component.html',
  styleUrls: ['./organization-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrganizationListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  organizations: OrganizationWithStats[] = [];
  isLoading = true;
  error: string | null = null;

  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;

  // Search & Sort
  searchTerm = '';
  sortBy = 'id';
  sortDir = 'asc';

  // Stats
  activeCount = 0;
  suspendedCount = 0;

  constructor(
    private superAdminService: SuperAdminService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setupSearch();
    this.loadOrganizations();
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
      this.currentPage = 0;
      if (query) {
        this.searchOrganizations(query);
      } else {
        this.loadOrganizations();
      }
    });
  }

  loadOrganizations(): void {
    this.isLoading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.superAdminService.getOrganizations(
      this.currentPage,
      this.pageSize,
      this.sortBy,
      this.sortDir
    ).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.organizations = response.content;
          this.totalElements = response.page.totalElements;
          this.totalPages = response.page.totalPages;
          this.calculateStats();
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = 'Failed to load organizations';
          this.isLoading = false;
          this.cdr.markForCheck();
          console.error('Load organizations error:', err);
        }
      });
  }

  searchOrganizations(query: string): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.superAdminService.searchOrganizations(query, this.currentPage, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.organizations = response.content;
          this.totalElements = response.page.totalElements;
          this.totalPages = response.page.totalPages;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = 'Search failed';
          this.isLoading = false;
          this.cdr.markForCheck();
          console.error('Search error:', err);
        }
      });
  }

  onSearch(): void {
    this.searchSubject.next(this.searchTerm);
  }

  private calculateStats(): void {
    this.activeCount = this.organizations.filter(o => o.status === 'ACTIVE').length;
    this.suspendedCount = this.organizations.filter(o => o.status === 'SUSPENDED').length;
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

  getSortIcon(column: string): string {
    if (this.sortBy !== column) return 'ri-arrow-up-down-line text-muted';
    return this.sortDir === 'asc' ? 'ri-arrow-up-line text-primary' : 'ri-arrow-down-line text-primary';
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      if (this.searchTerm) {
        this.searchOrganizations(this.searchTerm);
      } else {
        this.loadOrganizations();
      }
    }
  }

  viewOrganization(id: number): void {
    this.router.navigate(['/superadmin/organizations', id]);
  }

  async suspendOrganization(org: OrganizationWithStats, event: Event): Promise<void> {
    event.stopPropagation();

    const result = await Swal.fire({
      title: 'Suspend Organization?',
      text: `Are you sure you want to suspend "${org.name}"? Users will not be able to access the platform.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f06548',
      cancelButtonColor: '#878a99',
      confirmButtonText: 'Yes, suspend it'
    });

    if (result.isConfirmed) {
      this.superAdminService.suspendOrganization(org.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            Swal.fire('Suspended!', `${org.name} has been suspended.`, 'success');
            this.loadOrganizations();
          },
          error: (err) => {
            Swal.fire('Error', 'Failed to suspend organization', 'error');
            console.error('Suspend error:', err);
          }
        });
    }
  }

  async activateOrganization(org: OrganizationWithStats, event: Event): Promise<void> {
    event.stopPropagation();

    const result = await Swal.fire({
      title: 'Activate Organization?',
      text: `Are you sure you want to activate "${org.name}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0ab39c',
      cancelButtonColor: '#878a99',
      confirmButtonText: 'Yes, activate it'
    });

    if (result.isConfirmed) {
      this.superAdminService.activateOrganization(org.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            Swal.fire('Activated!', `${org.name} has been activated.`, 'success');
            this.loadOrganizations();
          },
          error: (err) => {
            Swal.fire('Error', 'Failed to activate organization', 'error');
            console.error('Activate error:', err);
          }
        });
    }
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
      case 'ENTERPRISE': return 'bg-primary-subtle text-primary';
      case 'PROFESSIONAL': return 'bg-info-subtle text-info';
      case 'STARTER': return 'bg-secondary-subtle text-secondary';
      default: return 'bg-light text-dark';
    }
  }

  getQuotaClass(percent: number | undefined): string {
    if (!percent) return 'bg-secondary';
    if (percent >= 90) return 'bg-danger';
    if (percent >= 70) return 'bg-warning';
    return 'bg-success';
  }

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(0, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible);

    if (end - start < maxVisible) {
      start = Math.max(0, end - maxVisible);
    }

    for (let i = start; i < end; i++) {
      pages.push(i);
    }
    return pages;
  }
}
