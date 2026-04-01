import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { OrganizationService } from '../../../../core/services/organization.service';
import { TeamMember } from '../../models/organization.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-organization-team',
  templateUrl: './organization-team.component.html',
  styleUrls: ['./organization-team.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgbDropdownModule
  ]
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
  pageSize = 50;
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

  // ── Single source of truth for role display names ──
  private static readonly ROLE_DISPLAY_NAMES: Record<string, string> = {
    'ROLE_ADMIN': 'Admin',
    'ROLE_ATTORNEY': 'Attorney',
    'ROLE_PARALEGAL': 'Paralegal',
    'ROLE_SECRETARY': 'Secretary',
    'ROLE_USER': 'User',
    'ROLE_CLIENT': 'Client',
    'ROLE_FINANCE': 'Finance',
    'ROLE_SUPERADMIN': 'Super Admin',
    'MANAGING_PARTNER': 'Managing Partner',
    'SENIOR_PARTNER': 'Senior Partner',
    'EQUITY_PARTNER': 'Equity Partner',
    'NON_EQUITY_PARTNER': 'Non-Equity Partner',
    'OF_COUNSEL': 'Of Counsel',
    'ASSOCIATE': 'Associate',
    'SENIOR_ASSOCIATE': 'Senior Associate',
    'JUNIOR_ASSOCIATE': 'Junior Associate',
    'PARALEGAL': 'Paralegal',
    'SENIOR_PARALEGAL': 'Senior Paralegal',
    'LEGAL_ASSISTANT': 'Legal Assistant',
    'LAW_CLERK': 'Law Clerk',
    'PRACTICE_MANAGER': 'Practice Manager',
    'CFO': 'CFO',
    'COO': 'COO',
    'IT_MANAGER': 'IT Manager',
    'HR_MANAGER': 'HR Manager',
    'FINANCE_MANAGER': 'Finance Manager',
  };

  getRoleDisplayName(role: string | undefined): string {
    if (!role) return 'User';
    return OrganizationTeamComponent.ROLE_DISPLAY_NAMES[role]
      || role.replace('ROLE_', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  getRoleBadgeClass(role: string | undefined): string {
    const r = role?.toUpperCase();
    if (r === 'ROLE_ADMIN') return 'bg-danger-subtle text-danger';
    if (r === 'ROLE_ATTORNEY') return 'bg-primary-subtle text-primary';
    if (r === 'ROLE_PARALEGAL' || r === 'PARALEGAL') return 'bg-warning-subtle text-warning';
    if (r === 'ROLE_SECRETARY') return 'bg-info-subtle text-info';
    if (r?.includes('PARTNER')) return 'bg-success-subtle text-success';
    if (r === 'OF_COUNSEL' || r?.includes('ASSOCIATE')) return 'bg-primary-subtle text-primary';
    if (r === 'ROLE_CLIENT') return 'bg-secondary-subtle text-secondary';
    return 'bg-secondary-subtle text-secondary';
  }

  changeRole(member: TeamMember): void {
    // Build options: start with the 5 standard roles
    const options: Record<string, string> = {
      'ROLE_ATTORNEY': 'Attorney',
      'ROLE_PARALEGAL': 'Paralegal',
      'ROLE_SECRETARY': 'Secretary',
      'ROLE_ADMIN': 'Admin',
      'ROLE_USER': 'User'
    };
    // If user has a role not in the list, add it so it can be pre-selected
    const currentRole = member.roleName || 'ROLE_USER';
    if (currentRole && !options[currentRole]) {
      options[currentRole] = this.getRoleDisplayName(currentRole);
    }

    Swal.fire({
      title: 'Change Role',
      text: `Select new role for ${this.getMemberFullName(member)}`,
      input: 'select',
      inputOptions: options,
      inputValue: currentRole,
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

  trackByMemberId(index: number, member: TeamMember): number {
    return member.id;
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
