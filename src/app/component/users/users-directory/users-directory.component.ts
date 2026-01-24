import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject, Observable, BehaviorSubject, of } from 'rxjs';
import { takeUntil, catchError, debounceTime, distinctUntilChanged, switchMap, startWith, map } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { User } from '../../../interface/user';
import { UserService } from '../../../service/user.service';
import { NotificationService } from '../../../service/notification.service';
import { RbacService } from '../../../core/services/rbac.service';
import { UserProfileModalComponent } from '../user-profile-modal/user-profile-modal.component';

interface UsersState {
  users: User[];
  filteredUsers: User[];
  loading: boolean;
  error: string | null;
  searchTerm: string;
  selectedRole: string;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  currentPage: number;
  usersPerPage: number;
  totalUsers: number;
}

@Component({
  selector: 'app-users-directory',
  templateUrl: './users-directory.component.html',
  styleUrls: ['./users-directory.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ]
})
export class UsersDirectoryComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchSubject = new BehaviorSubject<string>('');

  state: UsersState = {
    users: [],
    filteredUsers: [],
    loading: true,
    error: null,
    searchTerm: '',
    selectedRole: '',
    sortBy: 'firstName',
    sortDirection: 'asc',
    currentPage: 1,
    usersPerPage: 12,
    totalUsers: 0
  };

  availableRoles: string[] = [];
  sortOptions = [
    { value: 'firstName', label: 'First Name' },
    { value: 'lastName', label: 'Last Name' },
    { value: 'email', label: 'Email' },
    { value: 'roleName', label: 'Role' },
    { value: 'createdAt', label: 'Join Date' }
  ];
  
  // Velzon-style properties
  masterSelected: boolean = false;
  allUsers: User[] = [];
  checkedValGet: any[] = [];

  constructor(
    private userService: UserService,
    private notificationService: NotificationService,
    public rbacService: RbacService,
    private modalService: NgbModal,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadUsers();
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
    ).subscribe(searchTerm => {
      this.state.searchTerm = searchTerm;
      this.state.currentPage = 1;
      this.filterAndSortUsers();
    });
  }

  loadUsers(): void {
    this.state.loading = true;
    this.state.error = null;

    this.userService.getUsers().pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error loading users:', error);
        this.state.error = 'Failed to load users. Please try again.';
        this.state.loading = false;
        this.notificationService.onError('Failed to load users');
        return of({ data: { users: [] } });
      })
    ).subscribe({
      next: (response) => {
        this.state.users = response?.data?.users || [];
        this.allUsers = [...this.state.users]; // Store original data
        this.state.totalUsers = this.state.users.length;
        this.extractAvailableRoles();
        this.filterAndSortUsers();
        this.state.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error in users subscription:', error);
        this.state.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private extractAvailableRoles(): void {
    const roleSet = new Set<string>();
    this.state.users.forEach(user => {
      if (user.roleName) {
        roleSet.add(user.roleName);
      }
    });
    this.availableRoles = Array.from(roleSet).sort();
  }

  private filterAndSortUsers(): void {
    let filtered = [...this.state.users];

    // Apply search filter
    if (this.state.searchTerm) {
      const searchLower = this.state.searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        (user.title && user.title.toLowerCase().includes(searchLower)) ||
        (user.roleName && user.roleName.toLowerCase().includes(searchLower))
      );
    }

    // Apply role filter
    if (this.state.selectedRole) {
      filtered = filtered.filter(user => user.roleName === this.state.selectedRole);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let valueA = this.getSortValue(a, this.state.sortBy);
      let valueB = this.getSortValue(b, this.state.sortBy);

      if (typeof valueA === 'string') {
        valueA = valueA.toLowerCase();
      }
      if (typeof valueB === 'string') {
        valueB = valueB.toLowerCase();
      }

      let result = 0;
      if (valueA < valueB) result = -1;
      if (valueA > valueB) result = 1;

      return this.state.sortDirection === 'desc' ? -result : result;
    });

    this.state.filteredUsers = filtered;
    this.state.totalUsers = filtered.length;
    this.cdr.detectChanges();
  }

  private getSortValue(user: User, sortBy: string): any {
    switch (sortBy) {
      case 'firstName': return user.firstName || '';
      case 'lastName': return user.lastName || '';
      case 'email': return user.email || '';
      case 'roleName': return user.roleName || '';
      case 'title': return user.title || '';
      case 'phone': return user.phone || '';
      case 'createdAt': return user.createdAt ? new Date(user.createdAt) : new Date(0);
      default: return '';
    }
  }

  onSearch(searchTerm: string): void {
    this.searchSubject.next(searchTerm);
  }

  onRoleFilter(role: string): void {
    this.state.selectedRole = role;
    this.state.currentPage = 1;
    this.filterAndSortUsers();
  }

  onSort(sortBy: string): void {
    if (this.state.sortBy === sortBy) {
      this.state.sortDirection = this.state.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.state.sortBy = sortBy;
      this.state.sortDirection = 'asc';
    }
    this.filterAndSortUsers();
  }

  clearFilters(): void {
    this.state.searchTerm = '';
    this.state.selectedRole = '';
    this.state.sortBy = 'firstName';
    this.state.sortDirection = 'asc';
    this.state.currentPage = 1;
    this.searchSubject.next('');
    this.filterAndSortUsers();
  }

  getPaginatedUsers(): User[] {
    const startIndex = (this.state.currentPage - 1) * this.state.usersPerPage;
    const endIndex = startIndex + this.state.usersPerPage;
    return this.state.filteredUsers.slice(startIndex, endIndex);
  }

  getTotalPages(): number {
    return Math.ceil(this.state.totalUsers / this.state.usersPerPage);
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.getTotalPages()) {
      this.state.currentPage = page;
      this.cdr.detectChanges();
    }
  }

  getPageNumbers(): number[] {
    const totalPages = this.getTotalPages();
    const pages: number[] = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, this.state.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  openUserProfile(user: User): void {
    if (this.canViewUserProfile(user)) {
      const modalRef = this.modalService.open(UserProfileModalComponent, {
        size: 'lg',
        centered: true,
        backdrop: 'static'
      });

      modalRef.componentInstance.userId = user.id;
      modalRef.componentInstance.user = user;
    }
  }

  canViewUserProfile(user: User): boolean {
    // Add your permission logic here
    return this.rbacService.hasPermissionSync('USER', 'VIEW') || 
           this.userService.getCurrentUser()?.id === user.id;
  }

  getUserInitials(user: User): string {
    const firstName = user.firstName?.charAt(0)?.toUpperCase() || '';
    const lastName = user.lastName?.charAt(0)?.toUpperCase() || '';
    return firstName + lastName;
  }

  getUserStatusClass(user: User): string {
    if (!user.enabled) return 'text-danger';
    if (!user.notLocked) return 'text-warning';
    return 'text-success';
  }

  getUserStatusText(user: User): string {
    if (!user.enabled) return 'Disabled';
    if (!user.notLocked) return 'Locked';
    return 'Active';
  }
  
  getJoinedDate(user: User): string {
    if (!user.createdAt) return 'N/A';
    return new Date(user.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Add User functionality
  openAddUserModal(): void {
    // TODO: Implement add user modal
    this.notificationService.onInfo('Add User functionality - Coming Soon');
  }


  // Delete User functionality
  deleteUser(user: User): void {
    Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to delete ${user.firstName} ${user.lastName}? This action cannot be undone!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete user!',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.performUserDeletion(user);
      }
    });
  }

  private performUserDeletion(user: User): void {
    // Show loading
    Swal.fire({
      title: 'Deleting User...',
      text: 'Please wait while we delete the user.',
      allowOutsideClick: false,
      showConfirmButton: false,
      willOpen: () => {
        Swal.showLoading();
      }
    });

    this.userService.deleteUser(user.id).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error deleting user:', error);
        Swal.fire({
          title: 'Error!',
          text: 'Failed to delete user. Please try again.',
          icon: 'error',
          confirmButtonText: 'OK'
        });
        return of(null);
      })
    ).subscribe({
      next: (response) => {
        if (response) {
          // Remove user from local state
          this.state.users = this.state.users.filter(u => u.id !== user.id);
          this.allUsers = this.allUsers.filter(u => u.id !== user.id);
          this.filterAndSortUsers();
          
          Swal.fire({
            title: 'Deleted!',
            text: `${user.firstName} ${user.lastName} has been deleted successfully.`,
            icon: 'success',
            confirmButtonText: 'OK'
          });
          
          this.notificationService.onSuccess('User deleted successfully');
        }
      }
    });
  }

  refreshUsers(): void {
    this.loadUsers();
  }
  
  private updateSidebarActions(user: User): void {
    // Update email button
    const emailBtn = document.querySelector('.sidebar-email-btn') as HTMLAnchorElement;
    if (emailBtn) {
      emailBtn.href = `mailto:${user.email}`;
      emailBtn.onclick = (e) => {
        e.preventDefault();
        window.location.href = `mailto:${user.email}`;
      };
    }
    
    // Update phone button
    const phoneBtn = document.querySelector('.sidebar-phone-btn') as HTMLAnchorElement;
    if (phoneBtn) {
      if (user.phone) {
        phoneBtn.href = `tel:${user.phone}`;
        phoneBtn.onclick = (e) => {
          e.preventDefault();
          window.location.href = `tel:${user.phone}`;
        };
      } else {
        phoneBtn.onclick = (e) => {
          e.preventDefault();
          this.notificationService.onInfo('No phone number available for this user');
        };
      }
    }
  }

  trackByUserId(index: number, user: User): number {
    return user.id;
  }

  getEndIndex(): number {
    return Math.min(this.state.currentPage * this.state.usersPerPage, this.state.totalUsers);
  }

  // Velzon-style methods
  viewDataGet(index: number): void {
    const user = this.getPaginatedUsers()[index];
    if (user) {
      // Update the sidebar with user details
      const userDetailsImg = document.querySelector('.user-details img') as HTMLImageElement;
      if (userDetailsImg) {
        userDetailsImg.src = user.imageUrl || 'assets/images/users/avatar-1.jpg';
      }
      
      const userName = document.querySelector('.user-details h5') as HTMLElement;
      if (userName) {
        userName.innerHTML = `${user.firstName} ${user.lastName}`;
      }
      
      const userTitle = document.querySelector('.user-details p') as HTMLElement;
      if (userTitle) {
        userTitle.innerHTML = user.title || 'Team Member';
      }
      
      // Update user bio in the information section
      const userBio = document.querySelector('.user-bio') as HTMLElement;
      if (userBio) {
        userBio.innerHTML = user.bio || 'Professional team member committed to excellence.';
      }
      
      // Update sidebar action buttons with current user data
      this.updateSidebarActions(user);
      
      // Update information table
      const roleEl = document.querySelector('.role') as HTMLElement;
      if (roleEl) roleEl.innerHTML = user.roleName || 'N/A';
      
      const locationEl = document.querySelector('.location') as HTMLElement;
      if (locationEl) locationEl.innerHTML = user.address || 'N/A';
      
      const statusEl = document.querySelector('.status') as HTMLElement;
      if (statusEl) statusEl.innerHTML = this.getUserStatusText(user);
      
      const emailEl = document.querySelector('.email') as HTMLElement;
      if (emailEl) emailEl.innerHTML = user.email;
      
      const phoneEl = document.querySelector('.phone') as HTMLElement;
      if (phoneEl) phoneEl.innerHTML = user.phone || 'N/A';
      
      const joinedEl = document.querySelector('.joined') as HTMLElement;
      if (joinedEl) {
        const joinDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';
        joinedEl.innerHTML = joinDate;
      }
    }
  }

  checkUncheckAll(event: any): void {
    this.masterSelected = event.target.checked;
    this.state.filteredUsers.forEach((user: any) => {
      user.state = this.masterSelected;
    });
    this.updateCheckedList();
  }

  onCheckboxChange(event: any): void {
    this.updateCheckedList();
    const checkedCount = this.state.filteredUsers.filter((user: any) => user.state).length;
    this.masterSelected = checkedCount === this.state.filteredUsers.length;
  }

  private updateCheckedList(): void {
    this.checkedValGet = this.state.filteredUsers.filter((user: any) => user.state);
    const removeActionsBtn = document.getElementById('remove-actions');
    if (removeActionsBtn) {
      removeActionsBtn.style.display = this.checkedValGet.length > 0 ? 'block' : 'none';
    }
  }

  csvFileExport(): void {
    // Simple CSV export functionality
    const csvData = this.state.users.map(user => ({
      'Name': `${user.firstName} ${user.lastName}`,
      'Email': user.email,
      'Role': user.roleName || 'N/A',
      'Location': user.address || 'N/A',
      'Status': this.getUserStatusText(user),
      'Phone': user.phone || 'N/A'
    }));
    
    const csvContent = this.convertToCSV(csvData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'team-directory.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = data.map(row => {
      return headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(',');
    });
    
    return [csvHeaders, ...csvRows].join('\n');
  }
}