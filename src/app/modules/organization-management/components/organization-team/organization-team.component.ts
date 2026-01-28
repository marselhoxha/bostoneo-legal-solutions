import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { OrganizationService } from '../../../../core/services/organization.service';
import { TeamMember } from '../../models/organization.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-organization-team',
  templateUrl: './organization-team.component.html',
  styleUrls: ['./organization-team.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrganizationTeamComponent implements OnInit, OnDestroy {
  @Input() organizationId!: number;

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  teamMembers: TeamMember[] = [];
  isLoading = false;
  searchQuery = '';

  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;

  // Sorting
  sortBy = 'id';
  sortDir = 'asc';

  constructor(
    private organizationService: OrganizationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setupSearch();
    this.loadTeamMembers();
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
    ).subscribe(() => {
      this.currentPage = 0;
      this.loadTeamMembers();
    });
  }

  loadTeamMembers(): void {
    if (!this.organizationId) return;

    this.isLoading = true;
    this.cdr.markForCheck();

    this.organizationService.getUsersByOrganization(
      this.organizationId,
      this.currentPage,
      this.pageSize,
      this.sortBy,
      this.sortDir
    ).pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (response) => {
        this.teamMembers = response.users;
        this.totalElements = response.page.totalElements;
        this.totalPages = response.page.totalPages;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onSearch(query: string): void {
    this.searchQuery = query;
    this.searchSubject.next(query);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadTeamMembers();
  }

  onSort(column: string): void {
    if (this.sortBy === column) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortDir = 'asc';
    }
    this.loadTeamMembers();
  }

  getSortIcon(column: string): string {
    if (this.sortBy !== column) return 'ri-expand-up-down-line';
    return this.sortDir === 'asc' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line';
  }

  getMemberFullName(member: TeamMember): string {
    const firstName = member.firstName || '';
    const lastName = member.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || 'Unnamed User';
  }

  getMemberInitials(member: TeamMember): string {
    const first = member.firstName?.charAt(0) || '';
    const last = member.lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || member.email.charAt(0).toUpperCase();
  }

  getAvatarColor(member: TeamMember): string {
    const colors = ['primary', 'success', 'info', 'warning', 'danger'];
    const hash = member.email.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  }

  getRoleBadgeClass(role: string | undefined): string {
    switch (role?.toUpperCase()) {
      case 'ADMIN': return 'bg-danger-subtle text-danger';
      case 'MANAGER': return 'bg-warning-subtle text-warning';
      case 'USER': return 'bg-info-subtle text-info';
      default: return 'bg-secondary-subtle text-secondary';
    }
  }

  changeRole(member: TeamMember): void {
    Swal.fire({
      title: 'Change Role',
      text: `Select new role for ${this.getMemberFullName(member)}`,
      input: 'select',
      inputOptions: {
        'USER': 'User',
        'MANAGER': 'Manager',
        'ADMIN': 'Admin'
      },
      inputValue: member.roleName || 'USER',
      showCancelButton: true,
      confirmButtonText: 'Update',
      confirmButtonColor: '#405189'
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.organizationService.updateUserRole(this.organizationId, member.id, result.value)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              Swal.fire({
                icon: 'success',
                title: 'Role Updated',
                text: `${this.getMemberFullName(member)}'s role has been updated.`,
                timer: 2000,
                showConfirmButton: false
              });
              this.loadTeamMembers();
            },
            error: (err) => {
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: err?.error?.message || 'Failed to update role'
              });
            }
          });
      }
    });
  }

  removeMember(member: TeamMember): void {
    Swal.fire({
      title: 'Remove Team Member',
      html: `Are you sure you want to remove <strong>${this.getMemberFullName(member)}</strong> from this organization?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Remove',
      confirmButtonColor: '#f06548',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.organizationService.removeUserFromOrganization(this.organizationId, member.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              Swal.fire({
                icon: 'success',
                title: 'Member Removed',
                text: `${this.getMemberFullName(member)} has been removed from the organization.`,
                timer: 2000,
                showConfirmButton: false
              });
              this.loadTeamMembers();
            },
            error: (err) => {
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: err?.error?.message || 'Failed to remove team member'
              });
            }
          });
      }
    });
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(0, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages);

    if (endPage - startPage < maxVisiblePages) {
      startPage = Math.max(0, endPage - maxVisiblePages);
    }

    for (let i = startPage; i < endPage; i++) {
      pages.push(i);
    }
    return pages;
  }

  get filteredMembers(): TeamMember[] {
    if (!this.searchQuery) return this.teamMembers;
    const query = this.searchQuery.toLowerCase();
    return this.teamMembers.filter(m =>
      this.getMemberFullName(m).toLowerCase().includes(query) ||
      m.email.toLowerCase().includes(query)
    );
  }
}
