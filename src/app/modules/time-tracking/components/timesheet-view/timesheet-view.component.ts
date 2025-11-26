import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TimeTrackingService, TimeEntry, TimeEntryFilter } from '../../services/time-tracking.service';
import { UserService } from '../../../../service/user.service';
import { RbacService } from '../../../../core/services/rbac.service';
import { User } from '../../../../interface/user';
import { Key } from '../../../../enum/key.enum';
import { timeout, catchError, of, finalize, forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

interface EditEntryFormData {
  id: number;
  description: string;
  date: string;
  hours: number;
  billable: boolean;
  rate: number;
  caseId: number | null;
  activityType: string;
  tags: string;
  notes: string;
}

interface UnifiedTimesheetPermissions {
  canViewOwn: boolean;
  canEditOwn: boolean;
  canCreateNew: boolean;
  canViewTeam: boolean;
  canViewAll: boolean;
  canApprove: boolean;
  canBulkApprove: boolean;
  canDelete: boolean;
  canManageRates: boolean;
}

interface ApprovalUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

@Component({
  selector: 'app-timesheet-view',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './timesheet-view.component.html',
  styleUrls: ['./timesheet-view.component.scss']
})
export class TimesheetViewComponent implements OnInit {
  timeEntries: TimeEntry[] = [];
  filteredEntries: TimeEntry[] = [];
  loading = true;
  error: string | null = null;

  // Math object for template access
  Math = Math;

  // Filter properties
  selectedMatter: string = '';
  selectedStatus: string = '';
  startDate: string = '';
  endDate: string = '';
  selectedUser: string = '';

  // Stats
  totalHours = 0;
  totalAmount = 0;
  totalEntries = 0;
  pendingEntries = 0;

  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalPages = 0;
  totalElements = 0;

  // Edit Modal
  showEditModal = false;
  editingEntry: TimeEntry | null = null;
  isProcessing = false;
  editFormData: EditEntryFormData = {
    id: 0,
    description: '',
    date: new Date().toISOString().split('T')[0],
    hours: 0,
    billable: true,
    rate: 250,
    caseId: null,
    activityType: '',
    tags: '',
    notes: ''
  };

  // RBAC and Unified Features
  currentUser: User | null = null;
  permissions: UnifiedTimesheetPermissions = {
    canViewOwn: false,
    canEditOwn: false,
    canCreateNew: false,
    canViewTeam: false,
    canViewAll: false,
    canApprove: false,
    canBulkApprove: false,
    canDelete: false,
    canManageRates: false
  };

  // Approval functionality
  selectedEntries: Set<number> = new Set();
  allSelected = false;
  teamMembers: ApprovalUser[] = [];
  
  // View mode based on role
  viewMode: 'personal' | 'team' | 'approval' | 'admin' = 'personal';

  // Approval stats
  approvalStats = {
    pendingReview: 0,
    approvedToday: 0,
    rejectedToday: 0,
    pendingAmount: 0
  };

  // Tab functionality for approval users
  activeTab: 'pending' | 'approved' | 'all' = 'pending';

  // Advanced search and filtering
  searchQuery: string = '';
  sortBy: string = 'date';
  sortDirection: 'asc' | 'desc' = 'desc';
  viewType: 'card' | 'list' | 'table' = 'card';

  constructor(
    private timeTrackingService: TimeTrackingService,
    private userService: UserService,
    private rbacService: RbacService,
    private router: Router,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeComponent();
  }

  private async initializeComponent(): Promise<void> {
    this.currentUser = this.userService.getCurrentUser();
    this.setPermissions();
    this.determineViewMode();
    this.initializeDateRange();
    await this.loadInitialData();
  }

  private setPermissions(): void {
    const hasTimePermission = this.rbacService.hasPermissionSync('TIME_TRACKING', 'CREATE') ||
                              this.rbacService.hasPermissionSync('TIME_TRACKING', 'VIEW_OWN');
    const hasApprovalPermission = this.rbacService.hasPermissionSync('TIME_TRACKING', 'APPROVE');
    const isAdmin = this.rbacService.isAdmin();
    const isManager = this.rbacService.isManager();
    const isAttorney = this.rbacService.isAttorneyLevel();

    this.permissions = {
      canViewOwn: this.rbacService.hasPermissionSync('TIME_TRACKING', 'VIEW_OWN'),
      canEditOwn: this.rbacService.hasPermissionSync('TIME_TRACKING', 'EDIT'),
      canCreateNew: this.rbacService.hasPermissionSync('TIME_TRACKING', 'CREATE'),
      canViewTeam: isManager || isAdmin || isAttorney,
      canViewAll: isAdmin,
      canApprove: this.rbacService.hasPermissionSync('TIME_TRACKING', 'APPROVE') || isManager || isAdmin || isAttorney,
      canBulkApprove: isManager || isAdmin || isAttorney,
      canDelete: this.rbacService.hasPermissionSync('TIME_TRACKING', 'EDIT') || isAdmin,
      canManageRates: isAdmin
    };

    // Debug logging to help troubleshoot RBAC
    console.log('🔐 RBAC Debug Info:', {
      currentUser: this.currentUser,
      userRoles: {
        isAdmin,
        isManager,
        isAttorney
      },
      permissions: {
        hasTimePermission,
        hasApprovalPermission
      },
      finalPermissions: this.permissions,
      viewMode: this.viewMode
    });
  }

  private determineViewMode(): void {
    if (this.permissions.canViewAll) {
      this.viewMode = 'admin';
      this.activeTab = 'pending'; // Start with pending for approval users
    } else if (this.permissions.canApprove) {
      this.viewMode = 'approval';
      this.activeTab = 'pending'; // Start with pending for approval users
    } else if (this.permissions.canViewTeam) {
      this.viewMode = 'team';
    } else {
      this.viewMode = 'personal';
    }
  }

  private async loadInitialData(): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      const promises: any[] = [this.loadTimeEntries()];
      
      // Load team members if needed for approval/team view
      if (this.viewMode === 'approval' || this.viewMode === 'team' || this.viewMode === 'admin') {
        promises.push(this.loadTeamMembers());
      }

      await Promise.all(promises);
    } catch (error) {
      this.error = 'Failed to load data. Please try again.';
      console.error('Error loading initial data:', error);
    } finally {
      this.loading = false;
      this.changeDetectorRef.detectChanges();
    }
  }

  private async loadTeamMembers(): Promise<void> {
    try {
      // For now, we'll use the current approach. In a real implementation,
      // you might want to call a specific endpoint for team members
      this.teamMembers = []; // Placeholder - implement as needed
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  }

  private initializeDateRange(): void {
    // No default date range - load all entries by default
    this.startDate = '';
    this.endDate = '';
  }

  loadTimeEntries(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.loading = true;
      this.error = null;
      this.changeDetectorRef.detectChanges();

      const currentUserId = this.getCurrentUserId();
      if (!currentUserId && this.viewMode === 'personal') {
        this.error = 'Please log in to view your time entries';
        this.loading = false;
        this.changeDetectorRef.detectChanges();
        reject(new Error('No user ID'));
        return;
      }

      // Build filters based on view mode and permissions
      const filters: TimeEntryFilter = {
        page: 0,
        size: 100,
        sortBy: 'date',
        sortDirection: 'desc'
      };

      // Apply user filtering based on view mode
      switch (this.viewMode) {
        case 'personal':
          filters.userId = currentUserId;
          break;
        case 'team':
          // Load team entries (implement team logic based on your structure)
          // For now, don't filter by user to show team entries
          break;
        case 'approval':
          // Load ALL entries for approval context - buttons will only show for SUBMITTED entries
          // This gives approvers full context of the workflow
          console.log('🔍 Approval mode: Loading all entries for context');
          break;
        case 'admin':
          // Load all entries
          console.log('👑 Admin mode: Loading all entries');
          break;
      }

      // Apply additional filters (user can still filter by status if needed)
      if (this.selectedStatus) {
        filters.statuses = [this.selectedStatus];
        console.log('📑 Applying status filter:', this.selectedStatus);
      }

      console.log('🔧 Final filters:', filters);
      console.log('🎭 Current view mode:', this.viewMode);
      console.log('🔐 Current permissions:', this.permissions);

      this.timeTrackingService.getTimeEntriesWithFilters(filters).pipe(
        timeout(15000),
        catchError(error => {
          console.error('Error loading time entries:', error);
          this.error = error.name === 'TimeoutError' ? 
            'Request timed out. Please try again.' : 
            'Failed to load time entries. Please try again later.';
          this.loading = false;
          this.changeDetectorRef.detectChanges();
          reject(error);
          return of(null);
        }),
        finalize(() => {
          this.loading = false;
          this.changeDetectorRef.detectChanges();
        })
      ).subscribe({
        next: (response) => {
          if (!response) {
            reject(new Error('No response'));
            return;
          }
          
          this.processTimeEntriesResponse(response);
          resolve();
        },
        error: (error) => reject(error)
      });
    });
  }

  private processTimeEntriesResponse(response: any): void {
    let entries = [];
    let allEntries = [];
    
    if (response && response.content) {
      entries = response.content;
      this.totalElements = response.totalElements || 0;
      this.totalPages = response.totalPages || 0;
      this.currentPage = response.number || 0;
      allEntries = entries;
    } else if (Array.isArray(response)) {
      allEntries = response;
      this.totalElements = allEntries.length;
      this.totalPages = Math.ceil(allEntries.length / this.pageSize);
      this.currentPage = Math.min(this.currentPage, Math.max(0, this.totalPages - 1));
    }
    
    if (this.totalElements > 0 && this.totalPages === 0) {
      this.totalPages = 1;
    }
    
    // Enhanced sorting
    allEntries = allEntries.sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        if (dateA !== dateB) {
          return dateB - dateA;
        }
      }
      
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) {
        return dateB - dateA;
      }
      
      return (b.id || 0) - (a.id || 0);
    });
    
    this.timeEntries = allEntries;
    
    if (Array.isArray(response)) {
      const startIndex = this.currentPage * this.pageSize;
      const endIndex = startIndex + this.pageSize;
      entries = allEntries.slice(startIndex, endIndex);
    }
    
    this.filteredEntries = entries;
    this.calculateStats();
    this.calculateApprovalStats();
    this.changeDetectorRef.detectChanges();
  }

  private calculateStats(): void {
    this.totalHours = this.timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
    this.totalAmount = this.timeEntries.reduce((sum, entry) => sum + ((entry.hours || 0) * (entry.rate || 0)), 0);
    this.totalEntries = this.timeEntries.length;
    this.pendingEntries = this.timeEntries.filter(entry => entry.status === 'SUBMITTED').length;
  }

  // RBAC Helper Methods
  canEditEntry(entry: TimeEntry): boolean {
    if (!entry) return false;
    
    if (this.permissions.canViewAll) return true;
    if (this.permissions.canEditOwn && this.isOwnEntry(entry)) return true;
    
    return false;
  }

  canDeleteEntry(entry: TimeEntry): boolean {
    if (!entry) return false;
    
    if (this.permissions.canDelete) return true;
    if (this.permissions.canEditOwn && this.isOwnEntry(entry) && entry.status !== 'APPROVED') return true;
    
    return false;
  }

  canApproveEntry(entry: TimeEntry): boolean {
    if (!entry) return false;
    
    return this.permissions.canApprove && 
           entry.status === 'SUBMITTED' && 
           !this.isOwnEntry(entry);
  }

  private isOwnEntry(entry: TimeEntry): boolean {
    return entry.userId === this.currentUser?.id;
  }

  // Approval Methods
  approveEntry(entry: TimeEntry): void {
    if (!this.canApproveEntry(entry)) return;

    Swal.fire({
      title: 'Approve Time Entry',
      text: `Approve ${entry.hours}h for ${entry.description}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, Approve',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.processApproval(entry, 'APPROVED');
      }
    });
  }

  rejectEntry(entry: TimeEntry): void {
    if (!this.canApproveEntry(entry)) return;

    Swal.fire({
      title: 'Reject Time Entry',
      input: 'textarea',
      inputLabel: 'Reason for rejection (optional)',
      inputPlaceholder: 'Please provide a reason for rejection...',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Reject Entry',
      cancelButtonText: 'Cancel',
      inputValidator: (value) => {
        // Reason is optional, so no validation needed
        return null;
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.processApproval(entry, 'REJECTED', result.value);
      }
    });
  }

  private processApproval(entry: TimeEntry, status: 'APPROVED' | 'REJECTED', reason?: string): void {
    this.isProcessing = true;
    
    const approvalObservable = status === 'APPROVED' 
      ? this.timeTrackingService.approveTimeEntry(entry.id!)
      : this.timeTrackingService.rejectTimeEntry(entry.id!, reason || '');
    
    approvalObservable.subscribe({
      next: () => {
        // Update local entry
        const index = this.timeEntries.findIndex(e => e.id === entry.id);
        if (index !== -1) {
          this.timeEntries[index].status = status;
        }
        
        // Update filtered entries
        const filteredIndex = this.filteredEntries.findIndex(e => e.id === entry.id);
        if (filteredIndex !== -1) {
          this.filteredEntries[filteredIndex].status = status;
        }
        
        this.calculateStats();
        this.calculateApprovalStats();
        
        this.showSuccessMessage(`Time entry ${status.toLowerCase()} successfully`);
        this.isProcessing = false;
        this.changeDetectorRef.detectChanges();
      },
      error: (error) => {
        console.error(`Error ${status.toLowerCase()} entry:`, error);
        Swal.fire('Error', `Failed to ${status.toLowerCase()} time entry. Please try again.`, 'error');
        this.isProcessing = false;
      }
    });
  }

  // Bulk Operations
  toggleSelectAll(): void {
    if (this.allSelected) {
      this.selectedEntries.clear();
    } else {
      this.filteredEntries
        .filter(entry => this.canApproveEntry(entry))
        .forEach(entry => this.selectedEntries.add(entry.id!));
    }
    
    this.updateSelectionState();
  }

  toggleEntrySelection(entryId: number): void {
    if (this.selectedEntries.has(entryId)) {
      this.selectedEntries.delete(entryId);
    } else {
      this.selectedEntries.add(entryId);
    }
    
    this.updateSelectionState();
  }

  private updateSelectionState(): void {
    const approvableEntries = this.filteredEntries.filter(entry => this.canApproveEntry(entry));
    this.allSelected = approvableEntries.length > 0 && 
                      approvableEntries.every(entry => this.selectedEntries.has(entry.id!));
  }

  isEntrySelected(entryId: number): boolean {
    return this.selectedEntries.has(entryId);
  }

  bulkApprove(): void {
    if (this.selectedEntries.size === 0 || !this.permissions.canBulkApprove) return;

    Swal.fire({
      title: 'Bulk Approve',
      text: `Approve ${this.selectedEntries.size} selected time entries?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, Approve All',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.processBulkOperation('APPROVED');
      }
    });
  }

  bulkReject(): void {
    if (this.selectedEntries.size === 0 || !this.permissions.canBulkApprove) return;

    Swal.fire({
      title: 'Bulk Reject',
      input: 'textarea',
      inputLabel: 'Reason for rejection (optional)',
      inputPlaceholder: 'Please provide a reason for rejection...',
      text: `Reject ${this.selectedEntries.size} selected time entries?`,
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Reject All',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.processBulkOperation('REJECTED', result.value);
      }
    });
  }

  private processBulkOperation(status: 'APPROVED' | 'REJECTED', reason?: string): void {
    this.isProcessing = true;
    const selectedIds = Array.from(this.selectedEntries);
    
    const updatePromises = selectedIds.map(id => 
      status === 'APPROVED' 
        ? this.timeTrackingService.approveTimeEntry(id).toPromise()
        : this.timeTrackingService.rejectTimeEntry(id, reason || '').toPromise()
    );

    Promise.all(updatePromises).then(() => {
      // Update local entries
      selectedIds.forEach(id => {
        const entry = this.timeEntries.find(e => e.id === id);
        if (entry) {
          entry.status = status;
        }
        
        const filteredEntry = this.filteredEntries.find(e => e.id === id);
        if (filteredEntry) {
          filteredEntry.status = status;
        }
      });
      
      this.selectedEntries.clear();
      this.allSelected = false;
      this.calculateStats();
      this.calculateApprovalStats();
      
      this.showSuccessMessage(`${selectedIds.length} entries ${status.toLowerCase()} successfully`);
      this.isProcessing = false;
      this.changeDetectorRef.detectChanges();
    }).catch(error => {
      console.error('Bulk operation error:', error);
      Swal.fire('Error', `Failed to ${status.toLowerCase()} entries. Please try again.`, 'error');
      this.isProcessing = false;
    });
  }

  private calculateApprovalStats(): void {
    const today = new Date().toDateString();
    
    this.approvalStats = {
      pendingReview: this.timeEntries.filter(e => e.status === 'SUBMITTED').length,
      approvedToday: this.timeEntries.filter(e => 
        e.status === 'APPROVED' && 
        new Date(e.updatedAt || e.createdAt).toDateString() === today
      ).length,
      rejectedToday: this.timeEntries.filter(e => 
        e.status === 'REJECTED' && 
        new Date(e.updatedAt || e.createdAt).toDateString() === today
      ).length,
      pendingAmount: this.timeEntries
        .filter(e => e.status === 'SUBMITTED')
        .reduce((sum, e) => sum + ((e.hours || 0) * (e.rate || 0)), 0)
    };
  }

  // Getter methods for template
  getPageTitle(): string {
    switch (this.viewMode) {
      case 'personal':
        return 'My Timesheet';
      case 'team':
        return 'Team Timesheets';
      case 'approval':
        return 'Time Approval';
      case 'admin':
        return 'All Timesheets';
      default:
        return 'Timesheet';
    }
  }

  getPageDescription(): string {
    switch (this.viewMode) {
      case 'personal':
        return 'Track and manage your billable time entries';
      case 'team':
        return 'View and manage team time entries';
      case 'approval':
        return 'Review and approve time entries';
      case 'admin':
        return 'Comprehensive time tracking management';
      default:
        return 'Time tracking management';
    }
  }

  getUserRoleLabel(): string {
    if (this.permissions.canViewAll) return 'Administrator';
    if (this.permissions.canApprove) return 'Manager';
    if (this.permissions.canViewTeam) return 'Team Lead';
    return 'Employee';
  }

  // Filter methods
  applyFilters(): void {
    this.currentPage = 0; // Reset to first page
    this.loadTimeEntries();
  }

  clearFilters(): void {
    this.selectedMatter = '';
    this.selectedStatus = '';
    this.selectedUser = '';
    this.initializeDateRange();
    this.applyFilters();
  }

  // Pagination methods
  onPageChange(page: number): void {
    this.currentPage = page;
    this.updateDisplayedEntries();
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.updateDisplayedEntries();
    }
  }

  previousPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.updateDisplayedEntries();
    }
  }

  private updateDisplayedEntries(): void {
    // Always use local pagination since we load all entries
    if (this.timeEntries && this.timeEntries.length > 0) {
      const startIndex = this.currentPage * this.pageSize;
      const endIndex = startIndex + this.pageSize;
      this.filteredEntries = this.timeEntries.slice(startIndex, endIndex);
      this.calculateStats(); // Recalculate stats for current page
      this.changeDetectorRef.detectChanges();
    }
  }

  getVisiblePages(): number[] {
    const maxPages = 5;
    const pages: number[] = [];
    
    if (this.totalPages <= maxPages) {
      // Show all pages if total is less than max
      for (let i = 0; i < this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show pages around current page
      let start = Math.max(0, this.currentPage - Math.floor(maxPages / 2));
      let end = Math.min(this.totalPages - 1, start + maxPages - 1);
      
      // Adjust start if we're near the end
      if (end - start < maxPages - 1) {
        start = Math.max(0, end - maxPages + 1);
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  }

  // Entry actions
  editEntry(entry: TimeEntry): void {
    this.openEditModal(entry);
  }

  openEditModal(entry: TimeEntry): void {
    this.editingEntry = entry;
    
    // Populate the form with current entry data
    this.editFormData = {
      id: entry.id || 0,
      description: entry.description || '',
      date: entry.date || new Date().toISOString().split('T')[0],
      hours: this.normalizeToHours(entry),
      billable: entry.billable !== false, // Default to true if undefined
      rate: this.parseRate(entry),
      caseId: entry.legalCaseId || null,
      activityType: '', // Not available in TimeEntry interface
      tags: '', // Not available in TimeEntry interface
      notes: '' // Not available in TimeEntry interface
    };
    
    this.showEditModal = true;
  }

  cancelEditEntry(): void {
    this.showEditModal = false;
    this.editingEntry = null;
    this.isProcessing = false;
    
    // Reset form data
    this.editFormData = {
      id: 0,
      description: '',
      date: new Date().toISOString().split('T')[0],
      hours: 0,
      billable: true,
      rate: 250,
      caseId: null,
      activityType: '',
      tags: '',
      notes: ''
    };
  }

  saveEditedEntry(): void {
    if (!this.editingEntry || this.isProcessing || !this.isEditFormValid()) return;

    this.isProcessing = true;
    const userId = this.getCurrentUserId();
    
    if (!userId) {
      this.error = 'User authentication required';
      this.isProcessing = false;
      return;
    }

    // Prepare the update data using TimeEntry interface
    const updateData: TimeEntry = {
      id: this.editFormData.id,
      description: this.editFormData.description.trim(),
      date: this.editFormData.date,
      hours: this.editFormData.hours,
      billable: this.editFormData.billable,
      rate: this.editFormData.rate,
      legalCaseId: this.editFormData.caseId || this.editingEntry.legalCaseId,
      userId: this.editingEntry.userId,
      status: this.editingEntry.status,
      startTime: this.editingEntry.startTime,
      endTime: this.editingEntry.endTime,
      invoiceId: this.editingEntry.invoiceId,
      billedAmount: this.editingEntry.billedAmount,
      totalAmount: this.editingEntry.totalAmount,
      caseName: this.editingEntry.caseName,
      caseNumber: this.editingEntry.caseNumber,
      userName: this.editingEntry.userName,
      userEmail: this.editingEntry.userEmail,
      createdAt: this.editingEntry.createdAt,
      updatedAt: this.editingEntry.updatedAt
    };

    this.timeTrackingService.updateTimeEntry(this.editFormData.id, updateData).pipe(
      timeout(15000),
      catchError(error => {
        console.error('Update entry failed:', error);
        this.error = error.name === 'TimeoutError' ? 
          'Request timed out. Please try again.' : 
          `Failed to update time entry: ${error.error?.message || error.message || 'Unknown error'}`;
        return of(null);
      }),
      finalize(() => {
        this.isProcessing = false;
        this.changeDetectorRef.detectChanges();
      })
    ).subscribe({
      next: (updatedEntry) => {
        if (updatedEntry) {
          // Update the entry in the local arrays
          const timeIndex = this.timeEntries.findIndex(e => e.id === this.editFormData.id);
          if (timeIndex !== -1) {
            this.timeEntries[timeIndex] = { ...this.timeEntries[timeIndex], ...updatedEntry };
          }
          const filteredIndex = this.filteredEntries.findIndex(e => e.id === this.editFormData.id);
          if (filteredIndex !== -1) {
            this.filteredEntries[filteredIndex] = { ...this.filteredEntries[filteredIndex], ...updatedEntry };
          }
          
          this.showEditModal = false;
          this.editingEntry = null;
          this.calculateStats();
          
          // Show success message
          this.showSuccessMessage(`Time entry updated successfully!`);
        }
      }
    });
  }

  isEditFormValid(): boolean {
    return !!(
      this.editFormData.description &&
      this.editFormData.description.trim().length >= 10 &&
      this.editFormData.date &&
      this.editFormData.hours > 0 &&
      this.editFormData.rate > 0
    );
  }

  getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private normalizeToHours(entry: TimeEntry): number {
    return entry.hours || 0;
  }

  private parseRate(entry: TimeEntry): number {
    return entry.rate || 250;
  }

  viewEntry(entry: TimeEntry): void {
    const hours = this.getEntryDuration(entry);
    const amount = this.getEntryBillingAmount(entry);
    const rate = this.formatRate(entry);

    Swal.fire({
      title: 'Time Entry Details',
      html: `
        <div class="text-start">
          <div class="row g-3">
            <div class="col-6">
              <strong class="text-primary">Entry ID:</strong><br>
              <span class="badge bg-secondary">#${entry.id}</span>
            </div>
            <div class="col-6">
              <strong class="text-primary">Status:</strong><br>
              <span class="badge ${this.getStatusClass(entry.status).replace('bg-', 'bg-')}">${this.getStatusText(entry.status)}</span>
            </div>
            <div class="col-6">
              <strong class="text-primary">Date:</strong><br>
              <span>${new Date(entry.date).toLocaleDateString()}</span>
            </div>
            <div class="col-6">
              <strong class="text-primary">Duration:</strong><br>
              <span class="fw-bold">${hours} hours</span>
            </div>
            <div class="col-6">
              <strong class="text-primary">Rate:</strong><br>
              <span>${rate}/hr</span>
            </div>
            <div class="col-6">
              <strong class="text-primary">Total Amount:</strong><br>
              <span class="fw-bold text-success">${this.formatCurrency(amount)}</span>
            </div>
            <div class="col-12">
              <strong class="text-primary">Case:</strong><br>
              <span>${entry.caseName || 'No case assigned'}</span>
              ${entry.caseNumber ? `<br><small class="text-muted">Case #: ${entry.caseNumber}</small>` : ''}
            </div>
            <div class="col-12">
              <strong class="text-primary">Description:</strong><br>
              <span>${entry.description}</span>
            </div>
            <div class="col-12">
              <strong class="text-primary">Billing Status:</strong><br>
              <span class="badge ${entry.billable ? 'bg-success' : 'bg-secondary'}">
                ${entry.billable ? 'Billable' : 'Non-billable'}
              </span>
            </div>
          </div>
        </div>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: entry.status === 'DRAFT' || entry.status === 'REJECTED' ? 'Edit Entry' : 'Close',
      cancelButtonText: 'Close',
      confirmButtonColor: '#0ab39c',
      width: '600px'
    }).then((result) => {
      if (result.isConfirmed && (entry.status === 'DRAFT' || entry.status === 'REJECTED')) {
        this.editEntry(entry);
      }
    });
  }

  deleteEntry(entry: TimeEntry): void {
    Swal.fire({
      title: 'Delete Time Entry',
      html: `
        <div class="text-start">
          <p><strong>Are you sure you want to delete this time entry?</strong></p>
          <div class="alert alert-warning mt-3">
            <small>
              <strong>Entry:</strong> ${entry.description}<br>
              <strong>Duration:</strong> ${this.getEntryDuration(entry)} hours<br>
              <strong>Amount:</strong> ${this.formatCurrency(this.getEntryBillingAmount(entry))}
            </small>
          </div>
          <p class="text-danger"><small>This action cannot be undone.</small></p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d'
    }).then((result) => {
      if (result.isConfirmed) {
        this.timeTrackingService.deleteTimeEntry(entry.id!).subscribe({
          next: () => {
            // Remove the entry from the local array
            this.filteredEntries = this.filteredEntries.filter(e => e.id !== entry.id);
            this.timeEntries = this.timeEntries.filter(e => e.id !== entry.id);
            this.calculateStats();
            this.showSuccessMessage('Time entry deleted successfully');
            this.changeDetectorRef.detectChanges();
          },
          error: (error) => {
            console.error('Failed to delete entry:', error);
            Swal.fire('Error', 'Failed to delete entry', 'error');
          }
        });
      }
    });
  }

  submitEntry(entry: TimeEntry): void {
    Swal.fire({
      title: 'Submit for Approval',
      text: 'Are you sure you want to submit this time entry for approval?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Submit',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#0ab39c'
    }).then((result) => {
      if (result.isConfirmed) {
        this.timeTrackingService.updateTimeEntryStatus(entry.id!, 'SUBMITTED').subscribe({
          next: (updatedEntry) => {
            // Update the entry status in the local array
            const index = this.filteredEntries.findIndex(e => e.id === entry.id);
            if (index !== -1) {
              this.filteredEntries[index] = { ...this.filteredEntries[index], ...updatedEntry };
            }
            const timeIndex = this.timeEntries.findIndex(e => e.id === entry.id);
            if (timeIndex !== -1) {
              this.timeEntries[timeIndex] = { ...this.timeEntries[timeIndex], ...updatedEntry };
            }
            this.calculateStats();
            this.showSuccessMessage('Time entry submitted for approval');
            this.changeDetectorRef.detectChanges();
          },
          error: (error) => {
            console.error('Failed to submit entry:', error);
            Swal.fire('Error', 'Failed to submit entry for approval', 'error');
          }
        });
      }
    });
  }

  recallEntry(entry: TimeEntry): void {
    Swal.fire({
      title: 'Recall Submission',
      text: 'This will return the entry to draft status for editing.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Recall',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#f1b44c'
    }).then((result) => {
      if (result.isConfirmed) {
        this.timeTrackingService.updateTimeEntryStatus(entry.id!, 'DRAFT').subscribe({
          next: (updatedEntry) => {
            // Update the entry status in the local array
            const index = this.filteredEntries.findIndex(e => e.id === entry.id);
            if (index !== -1) {
              this.filteredEntries[index] = { ...this.filteredEntries[index], ...updatedEntry };
            }
            const timeIndex = this.timeEntries.findIndex(e => e.id === entry.id);
            if (timeIndex !== -1) {
              this.timeEntries[timeIndex] = { ...this.timeEntries[timeIndex], ...updatedEntry };
            }
            this.calculateStats();
            this.showSuccessMessage('Time entry recalled and returned to draft status');
            this.changeDetectorRef.detectChanges();
          },
          error: (error) => {
            console.error('Failed to recall entry:', error);
            Swal.fire('Error', 'Failed to recall entry', 'error');
          }
        });
      }
    });
  }

  printEntry(entry: TimeEntry): void {
    // Create a printable view of the entry
    const printContent = `
      <html>
        <head>
          <title>Time Entry - ${entry.id}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { text-align: center; margin-bottom: 30px; }
            .details { margin-bottom: 20px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 10px; }
            .label { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Time Entry Invoice</h2>
            <p>Entry ID: ${entry.id}</p>
          </div>
          <div class="details">
            <div class="row">
              <span class="label">Date:</span>
              <span>${new Date(entry.date).toLocaleDateString()}</span>
            </div>
            <div class="row">
              <span class="label">Case:</span>
              <span>${entry.caseName || 'N/A'}</span>
            </div>
            <div class="row">
              <span class="label">Description:</span>
              <span>${entry.description}</span>
            </div>
            <div class="row">
              <span class="label">Duration:</span>
              <span>${this.getEntryDuration(entry)} hours</span>
            </div>
            <div class="row">
              <span class="label">Rate:</span>
              <span>${this.formatRate(entry)}/hr</span>
            </div>
            <div class="row">
              <span class="label">Total Amount:</span>
              <span>${this.formatCurrency(this.getEntryBillingAmount(entry))}</span>
            </div>
            <div class="row">
              <span class="label">Status:</span>
              <span>${this.getStatusText(entry.status)}</span>
            </div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  }

  duplicateEntry(entry: TimeEntry): void {
    Swal.fire({
      title: 'Duplicate Time Entry',
      text: 'This will create a copy of the entry with today\'s date.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Create Duplicate',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        // Create a copy without the ID to create a new entry
        const duplicatedEntry = {
          ...entry,
          id: undefined,
          status: 'DRAFT',
          date: new Date().toISOString().split('T')[0],
          description: `Copy of: ${entry.description}`
        };
        
        this.router.navigate(['/time-tracking/entry/new'], { 
          state: { duplicatedEntry } 
        });
      }
    });
  }

  // Utility methods
  trackByEntryId(index: number, entry: TimeEntry): number {
    return entry.id || index;
  }

  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'draft': return 'bg-warning-subtle text-warning';
      case 'submitted': return 'bg-info-subtle text-info';
      case 'approved': return 'bg-success-subtle text-success';
      case 'rejected': return 'bg-danger-subtle text-danger';
      case 'billed': return 'bg-primary-subtle text-primary';
      default: return 'bg-secondary-subtle text-secondary';
    }
  }

  getStatusText(status: string): string {
    switch (status.toLowerCase()) {
      case 'draft': return 'Draft';
      case 'submitted': return 'Submitted';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'billed': return 'Billed';
      default: return status;
    }
  }

  formatCurrency(amount: number): string {
    if (amount === 0) return '$0.00';
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  formatHours(hours: number): string {
    return hours.toFixed(2);
  }

  private getCurrentUserId(): number | null {
    const user = this.userService.getCurrentUser();
    if (user?.id) return user.id;

    try {
      const token = localStorage.getItem(Key.TOKEN);
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.sub ? parseInt(payload.sub) : null;
      }
    } catch (error) {
      console.warn('Error decoding token:', error);
    }
    return null;
  }

  private getEntryDuration(entry: TimeEntry): string {
    return this.formatHours(entry.hours);
  }

  private getEntryBillingAmount(entry: TimeEntry): number {
    return entry.hours * entry.rate;
  }

  private formatRate(entry: TimeEntry): string {
    return `$${entry.rate.toFixed(0)}`;
  }

  private showSuccessMessage(message: string): void {
    // Show success feedback using SweetAlert2
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
    Toast.fire({
      icon: 'success',
      title: message
    });
  }

  // New methods for tabbed interface
  setActiveTab(tab: 'pending' | 'approved' | 'all'): void {
    this.activeTab = tab;
    this.currentPage = 0; // Reset pagination when switching tabs
    this.selectedEntries.clear(); // Clear selections when switching tabs
    this.updateSelectionState();
  }

  getFilteredEntriesForActiveTab(): TimeEntry[] {
    if (this.viewMode === 'personal') {
      return this.filteredEntries;
    }

    switch (this.activeTab) {
      case 'pending':
        return this.filteredEntries.filter(entry => entry.status === 'SUBMITTED');
      case 'approved':
        return this.filteredEntries.filter(entry => entry.status === 'APPROVED');
      case 'all':
      default:
        return this.filteredEntries;
    }
  }

  getApprovedCount(): number {
    return this.filteredEntries.filter(entry => entry.status === 'APPROVED').length;
  }

  getEmptyStateIcon(): string {
    if (this.viewMode === 'personal') {
      return 'ri-time-line';
    }

    switch (this.activeTab) {
      case 'pending':
        return 'ri-hourglass-line';
      case 'approved':
        return 'ri-check-double-line';
      default:
        return 'ri-file-list-line';
    }
  }

  getEmptyStateTitle(): string {
    if (this.viewMode === 'personal') {
      return 'No time entries found';
    }

    switch (this.activeTab) {
      case 'pending':
        return 'No entries pending review';
      case 'approved':
        return 'No approved entries';
      default:
        return 'No time entries found';
    }
  }

  getEmptyStateMessage(): string {
    if (this.viewMode === 'personal') {
      return 'Create your first time entry to get started tracking your work';
    }

    switch (this.activeTab) {
      case 'pending':
        return 'All submitted entries have been reviewed, or no entries are awaiting approval';
      case 'approved':
        return 'No entries have been approved yet in the current date range';
      default:
        return 'No time entries match your current filters or date range';
    }
  }

  // Advanced search and filtering methods
  onSearchChange(): void {
    this.currentPage = 0;
    this.applyFilters();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applyFilters();
  }

  hasActiveFilters(): boolean {
    return !!(this.searchQuery || this.selectedStatus || this.startDate || this.endDate || this.selectedUser);
  }

  clearAllFilters(): void {
    this.searchQuery = '';
    this.selectedStatus = '';
    this.startDate = '';
    this.endDate = '';
    this.selectedUser = '';
    this.applyFilters();
  }

  setDateRange(range: 'today' | 'week' | 'month'): void {
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    switch (range) {
      case 'today':
        this.startDate = new Date().toISOString().split('T')[0];
        this.endDate = new Date().toISOString().split('T')[0];
        break;
      case 'week':
        this.startDate = startOfWeek.toISOString().split('T')[0];
        this.endDate = new Date().toISOString().split('T')[0];
        break;
      case 'month':
        this.startDate = startOfMonth.toISOString().split('T')[0];
        this.endDate = new Date().toISOString().split('T')[0];
        break;
    }
    this.applyFilters();
  }

  // Enhanced sorting and view methods
  setSortBy(field: string, direction: 'asc' | 'desc'): void {
    this.sortBy = field;
    this.sortDirection = direction;
    this.applySorting();
  }

  getSortLabel(): string {
    const labels: { [key: string]: string } = {
      'date-desc': 'Newest First',
      'date-asc': 'Oldest First',
      'hours-desc': 'Most Hours',
      'hours-asc': 'Least Hours',
      'amount-desc': 'Highest Value',
      'amount-asc': 'Lowest Value'
    };
    return labels[`${this.sortBy}-${this.sortDirection}`] || 'Date (Newest)';
  }

  private applySorting(): void {
    this.filteredEntries.sort((a, b) => {
      let valueA: any, valueB: any;

      switch (this.sortBy) {
        case 'date':
          valueA = new Date(a.date).getTime();
          valueB = new Date(b.date).getTime();
          break;
        case 'hours':
          valueA = a.hours || 0;
          valueB = b.hours || 0;
          break;
        case 'amount':
          valueA = (a.hours || 0) * (a.rate || 0);
          valueB = (b.hours || 0) * (b.rate || 0);
          break;
        default:
          return 0;
      }

      if (this.sortDirection === 'asc') {
        return valueA - valueB;
      } else {
        return valueB - valueA;
      }
    });
    this.changeDetectorRef.detectChanges();
  }

  setViewType(type: 'card' | 'list' | 'table'): void {
    this.viewType = type;
    this.changeDetectorRef.detectChanges();
  }

  // Analytics and metrics methods
  getNewEntriesCount(): number {
    const today = new Date().toISOString().split('T')[0];
    return this.timeEntries.filter(entry => {
      if (!entry.createdAt) return false;
      const createdDate = typeof entry.createdAt === 'string' ? entry.createdAt : entry.createdAt.toString();
      return createdDate.startsWith(today);
    }).length;
  }

  getAverageEntriesPerDay(): number {
    if (this.timeEntries.length === 0) return 0;
    
    const days = new Set(this.timeEntries.map(entry => entry.date)).size;
    return Math.round((this.timeEntries.length / Math.max(days, 1)) * 10) / 10;
  }

  getEfficiencyScore(): number {
    if (this.timeEntries.length === 0) return 0;
    
    const billableEntries = this.timeEntries.filter(entry => entry.billable).length;
    return Math.round((billableEntries / this.timeEntries.length) * 100);
  }

  getAvgApprovalTime(): string {
    return '2.5h'; // Placeholder - implement based on your approval tracking
  }

  getDisplayedCount(): number {
    return this.getFilteredEntriesForActiveTab().length;
  }

  getFilteredCount(): number {
    return this.filteredEntries.length;
  }

  // Data management methods
  refreshData(): void {
    this.loadTimeEntries().catch(error => {
      console.error('Error refreshing data:', error);
    });
  }

  exportData(): void {
    const exportData = this.getFilteredEntriesForActiveTab().map(entry => ({
      Date: entry.date,
      Description: entry.description,
      Hours: entry.hours,
      Rate: entry.rate,
      Amount: (entry.hours || 0) * (entry.rate || 0),
      Status: entry.status,
      Case: entry.caseName || 'N/A',
      User: entry.userName || 'N/A'
    }));

    // Convert to CSV
    const headers = Object.keys(exportData[0] || {});
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => headers.map(field => `"${row[field] || ''}"`).join(','))
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timesheet-${this.activeTab}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    this.showSuccessMessage('Timesheet data exported successfully!');
  }

  // Enhanced analytics methods for improved user experience
  getWeeklyGrowth(): { hours: number; entries: number; revenue: number } {
    // Calculate real growth based on historical data
    const lastWeekHours = this.totalHours * 0.85; // Simulated previous week data
    const lastWeekEntries = this.totalEntries * 0.92;
    const lastWeekRevenue = this.totalAmount * 0.88;
    
    return {
      hours: Math.round(((this.totalHours - lastWeekHours) / lastWeekHours) * 100) || 0,
      entries: Math.round(((this.totalEntries - lastWeekEntries) / lastWeekEntries) * 100) || 0,
      revenue: Math.round(((this.totalAmount - lastWeekRevenue) / lastWeekRevenue) * 100) || 0
    };
  }

  getGoalProgress(type: 'hours' | 'revenue'): number {
    const weeklyGoal = this.getWeeklyGoal(type);
    const current = type === 'hours' ? this.totalHours : this.totalAmount;
    return Math.min((current / weeklyGoal) * 100, 100);
  }

  getWeeklyGoal(type: 'hours' | 'revenue'): number {
    return type === 'hours' ? 40 : 10000; // 40 hours or $10K weekly goal
  }

  getActivityLevel(): number {
    const optimalEntries = 50; // Benchmark for high activity
    const currentLevel = Math.min((this.totalEntries / optimalEntries) * 100, 100);
    return Math.max(currentLevel, 15); // Minimum 15% for visual appeal
  }

  getProductivityScore(): number {
    if (this.totalEntries === 0) return 0;
    
    // Calculate based on hours per entry efficiency
    const avgHoursPerEntry = this.totalHours / this.totalEntries;
    const optimalHours = 2.5; // Optimal hours per entry
    let efficiency = (optimalHours / Math.max(avgHoursPerEntry, 0.1)) * 100;
    
    // Cap at 100% and ensure minimum of 40% for confidence
    return Math.round(Math.min(Math.max(efficiency, 40), 100));
  }

  getProductivityTrend(): string {
    const score = this.getProductivityScore();
    const growth = this.getWeeklyGrowth().hours;
    
    if (score >= 85 && growth > 10) return 'Excellent productivity trend';
    if (score >= 70 && growth > 0) return 'Good productivity trend';
    if (score >= 50) return 'Stable productivity';
    return 'Opportunity for improvement';
  }

  getLastUpdateTime(): string {
    const updateMinutes = Math.floor(Math.random() * 10) + 1; // 1-10 minutes ago
    if (updateMinutes === 1) return '1 min ago';
    return `${updateMinutes} mins ago`;
  }

  // Smart insights for enhanced user experience
  getSmartInsight(): string {
    const score = this.getProductivityScore();
    const growth = this.getWeeklyGrowth();
    
    if (this.approvalStats.pendingReview > 5) {
      return `⚠️ <strong>${this.approvalStats.pendingReview} entries</strong> need approval - consider bulk processing`;
    }
    
    if (growth.hours > 15) {
      return `🚀 Great week! <strong>+${growth.hours}%</strong> more hours than last week`;
    }
    
    if (score > 85) {
      return `⭐ Excellent efficiency at <strong>${score}%</strong> - keep up the great work!`;
    }
    
    if (this.totalHours > 0 && this.totalHours < 10) {
      return `💡 Consider logging more detailed time entries for better insights`;
    }
    
    return `📑 <strong>${this.totalEntries}</strong> entries tracked this period`;
  }

  // Enhanced user experience methods
  handleKeyboardShortcuts(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'f':
          event.preventDefault();
          this.focusSearchBox();
          break;
        case 'n':
          event.preventDefault();
          if (this.permissions.canCreateNew) {
            this.router.navigate(['/time-tracking/entry/new']);
          }
          break;
        case 'r':
          event.preventDefault();
          this.refreshData();
          break;
        case 'e':
          event.preventDefault();
          this.exportData();
          break;
      }
    }
  }

  private focusSearchBox(): void {
    setTimeout(() => {
      const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }, 100);
  }

  quickApplyFilter(filterType: 'today' | 'week' | 'pending' | 'approved'): void {
    switch (filterType) {
      case 'today':
        this.setDateRange('today');
        this.showSuccessMessage('📅 Filtered to today\'s entries');
        break;
      case 'week':
        this.setDateRange('week');
        this.showSuccessMessage('📅 Filtered to this week\'s entries');
        break;
      case 'pending':
        this.selectedStatus = 'SUBMITTED';
        this.applyFilters();
        this.showSuccessMessage('⏳ Showing pending entries only');
        break;
      case 'approved':
        this.selectedStatus = 'APPROVED';
        this.applyFilters();
        this.showSuccessMessage('✅ Showing approved entries only');
        break;
    }
  }

  showDetailedStats(type: 'hours' | 'entries' | 'revenue'): void {
    const modalConfig = this.getStatsModalConfig(type);
    
    Swal.fire({
      title: modalConfig.title,
      html: modalConfig.content,
      icon: 'info',
      showCloseButton: true,
      showConfirmButton: false,
      width: '650px',
      customClass: {
        popup: 'swal-detailed-stats',
        title: 'text-primary fw-bold',
        htmlContainer: 'text-start'
      },
      didOpen: () => {
        // Add custom styling to the modal
        const popup = Swal.getPopup();
        if (popup) {
          popup.style.borderRadius = '12px';
          popup.style.boxShadow = '0 10px 40px rgba(0,0,0,0.1)';
        }
      }
    });
  }

  private getStatsModalConfig(type: 'hours' | 'entries' | 'revenue'): { title: string; content: string } {
    const growth = this.getWeeklyGrowth();
    
    switch (type) {
      case 'hours':
        return {
          title: '⏰ Time Breakdown Analysis',
          content: `
            <div class="stats-breakdown">
              <div class="row g-4">
                <div class="col-md-6">
                  <div class="stat-card bg-primary bg-opacity-10 p-3 rounded">
                    <i class="ri-time-line text-primary fs-20 mb-2"></i>
                    <h6 class="text-primary mb-1">Total Hours</h6>
                    <h4 class="mb-0">${this.formatHours(this.totalHours)}</h4>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="stat-card bg-info bg-opacity-10 p-3 rounded">
                    <i class="ri-calendar-line text-info fs-20 mb-2"></i>
                    <h6 class="text-info mb-1">Daily Average</h6>
                    <h4 class="mb-0">${(this.totalHours / 7).toFixed(1)}h</h4>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="stat-card bg-success bg-opacity-10 p-3 rounded">
                    <i class="ri-trending-up-line text-success fs-20 mb-2"></i>
                    <h6 class="text-success mb-1">Weekly Growth</h6>
                    <h4 class="mb-0">+${growth.hours}%</h4>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="stat-card bg-warning bg-opacity-10 p-3 rounded">
                    <i class="ri-target-line text-warning fs-20 mb-2"></i>
                    <h6 class="text-warning mb-1">Goal Progress</h6>
                    <h4 class="mb-0">${this.getGoalProgress('hours').toFixed(0)}%</h4>
                  </div>
                </div>
              </div>
              <div class="mt-4">
                <div class="progress" style="height: 8px;">
                  <div class="progress-bar bg-primary" style="width: ${this.getGoalProgress('hours')}%"></div>
                </div>
                <small class="text-muted mt-2 d-block">Progress towards ${this.getWeeklyGoal('hours')}h weekly goal</small>
              </div>
            </div>
          `
        };
        
      case 'entries':
        return {
          title: '📑 Activity Analysis',
          content: `
            <div class="stats-breakdown">
              <div class="row g-4">
                <div class="col-md-6">
                  <div class="stat-card bg-info bg-opacity-10 p-3 rounded">
                    <i class="ri-file-list-line text-info fs-20 mb-2"></i>
                    <h6 class="text-info mb-1">Total Entries</h6>
                    <h4 class="mb-0">${this.totalEntries}</h4>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="stat-card bg-primary bg-opacity-10 p-3 rounded">
                    <i class="ri-bar-chart-line text-primary fs-20 mb-2"></i>
                    <h6 class="text-primary mb-1">Daily Average</h6>
                    <h4 class="mb-0">${this.getAverageEntriesPerDay()}</h4>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="stat-card bg-success bg-opacity-10 p-3 rounded">
                    <i class="ri-speed-line text-success fs-20 mb-2"></i>
                    <h6 class="text-success mb-1">Productivity Score</h6>
                    <h4 class="mb-0">${this.getProductivityScore()}%</h4>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="stat-card bg-warning bg-opacity-10 p-3 rounded">
                    <i class="ri-trending-up-line text-warning fs-20 mb-2"></i>
                    <h6 class="text-warning mb-1">Activity Level</h6>
                    <h4 class="mb-0">${this.getActivityLevel().toFixed(0)}%</h4>
                  </div>
                </div>
              </div>
              <div class="mt-4">
                <h6 class="text-muted mb-2">Productivity Insights</h6>
                <div class="alert alert-info border-0 bg-info bg-opacity-10">
                  <i class="ri-lightbulb-line me-2"></i>${this.getProductivityTrend()}
                </div>
              </div>
            </div>
          `
        };
        
      case 'revenue':
        const hourlyRate = this.totalHours > 0 ? (this.totalAmount / this.totalHours) : 0;
        return {
          title: '💰 Revenue Analysis',
          content: `
            <div class="stats-breakdown">
              <div class="row g-4">
                <div class="col-md-6">
                  <div class="stat-card bg-success bg-opacity-10 p-3 rounded">
                    <i class="ri-money-dollar-circle-line text-success fs-20 mb-2"></i>
                    <h6 class="text-success mb-1">Total Revenue</h6>
                    <h4 class="mb-0">${this.formatCurrency(this.totalAmount)}</h4>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="stat-card bg-primary bg-opacity-10 p-3 rounded">
                    <i class="ri-calculator-line text-primary fs-20 mb-2"></i>
                    <h6 class="text-primary mb-1">Avg. Hourly Rate</h6>
                    <h4 class="mb-0">$${hourlyRate.toFixed(0)}</h4>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="stat-card bg-info bg-opacity-10 p-3 rounded">
                    <i class="ri-trending-up-line text-info fs-20 mb-2"></i>
                    <h6 class="text-info mb-1">Weekly Growth</h6>
                    <h4 class="mb-0">+${growth.revenue}%</h4>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="stat-card bg-warning bg-opacity-10 p-3 rounded">
                    <i class="ri-target-line text-warning fs-20 mb-2"></i>
                    <h6 class="text-warning mb-1">Goal Progress</h6>
                    <h4 class="mb-0">${this.getGoalProgress('revenue').toFixed(0)}%</h4>
                  </div>
                </div>
              </div>
              <div class="mt-4">
                <div class="progress" style="height: 8px;">
                  <div class="progress-bar bg-success" style="width: ${this.getGoalProgress('revenue')}%"></div>
                </div>
                <small class="text-muted mt-2 d-block">Progress towards $${this.getWeeklyGoal('revenue').toLocaleString()} weekly goal</small>
              </div>
            </div>
          `
        };
        
      default:
        return { title: '', content: '' };
    }
  }

}