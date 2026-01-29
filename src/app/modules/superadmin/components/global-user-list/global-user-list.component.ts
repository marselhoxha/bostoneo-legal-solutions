import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { SuperAdminService } from '../../services/superadmin.service';
import { UserSummary } from '../../models/superadmin.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-global-user-list',
  templateUrl: './global-user-list.component.html',
  styleUrls: ['./global-user-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GlobalUserListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  users: UserSummary[] = [];
  isLoading = true;
  error: string | null = null;

  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;

  // Search
  searchTerm = '';

  constructor(
    private superAdminService: SuperAdminService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setupSearch();
    this.loadUsers();
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
        this.searchUsers(query);
      } else {
        this.loadUsers();
      }
    });
  }

  loadUsers(): void {
    this.isLoading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.superAdminService.getAllUsers(this.currentPage, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.users = response.content;
          this.totalElements = response.page.totalElements;
          this.totalPages = response.page.totalPages;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = 'Failed to load users';
          this.isLoading = false;
          this.cdr.markForCheck();
          console.error('Load users error:', err);
        }
      });
  }

  searchUsers(query: string): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.superAdminService.searchUsers(query, this.currentPage, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.users = response.content;
          this.totalElements = response.page.totalElements;
          this.totalPages = response.page.totalPages;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = 'Search failed';
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  onSearch(): void {
    this.searchSubject.next(this.searchTerm);
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      if (this.searchTerm) {
        this.searchUsers(this.searchTerm);
      } else {
        this.loadUsers();
      }
    }
  }

  viewUser(id: number): void {
    this.router.navigate(['/superadmin/users', id]);
  }

  async toggleUserStatus(user: UserSummary, event: Event): Promise<void> {
    event.stopPropagation();
    const action = user.enabled ? 'disable' : 'enable';

    const result = await Swal.fire({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} User?`,
      text: `Are you sure you want to ${action} ${user.firstName} ${user.lastName}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: user.enabled ? '#f06548' : '#0ab39c',
      cancelButtonColor: '#878a99',
      confirmButtonText: `Yes, ${action}`
    });

    if (result.isConfirmed) {
      this.superAdminService.toggleUserStatus(user.id, !user.enabled)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            Swal.fire('Success', `User ${action}d successfully`, 'success');
            this.loadUsers();
          },
          error: (err) => {
            Swal.fire('Error', `Failed to ${action} user`, 'error');
          }
        });
    }
  }

  async resetPassword(user: UserSummary, event: Event): Promise<void> {
    event.stopPropagation();

    const result = await Swal.fire({
      title: 'Reset Password?',
      text: `Send password reset email to ${user.email}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#405189',
      cancelButtonColor: '#878a99',
      confirmButtonText: 'Yes, send reset email'
    });

    if (result.isConfirmed) {
      this.superAdminService.resetUserPassword(user.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            Swal.fire('Success', 'Password reset email sent', 'success');
          },
          error: (err) => {
            Swal.fire('Error', 'Failed to send reset email', 'error');
          }
        });
    }
  }

  getRoleBadgeClass(role: string): string {
    switch (role?.toUpperCase()) {
      case 'ROLE_SUPERADMIN': return 'bg-danger';
      case 'ROLE_ADMIN': return 'bg-primary';
      case 'ROLE_ATTORNEY': return 'bg-info';
      case 'ROLE_PARALEGAL': return 'bg-warning';
      case 'ROLE_MANAGER': return 'bg-success';
      default: return 'bg-secondary';
    }
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

  get showingTo(): number {
    return Math.min((this.currentPage + 1) * this.pageSize, this.totalElements);
  }
}
