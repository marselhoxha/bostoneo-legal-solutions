import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TimeTrackingService, TimeEntry } from '../../services/time-tracking.service';
import { UserService } from '../../../../service/user.service';
import { LegalCaseService } from '../../../legal/services/legal-case.service';
import { RbacService } from '../../../../core/services/rbac.service';
import { User } from '../../../../interface/user';
import { LegalCase } from '../../../legal/interfaces/case.interface';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, catchError, finalize, map } from 'rxjs/operators';
import Swal from 'sweetalert2';

interface ApprovalStats {
  pendingReview: number;
  approvedToday: number;
  rejectedToday: number;
  pendingHours: number;
  pendingAmount: number;
  totalSelected: number;
}

interface ApprovalFilters {
  dateRange: 'today' | 'week' | 'month' | 'all';
  startDate?: string;
  endDate?: string;
  attorneyId?: number | null;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'DRAFT' | 'ALL';
  searchTerm?: string;
}

interface ApprovalUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  initials: string;
  avatarColor: string;
}

@Component({
  selector: 'app-time-approval',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './time-approval.component.html',
  styleUrls: ['./time-approval.component.scss']
})
export class TimeApprovalComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Core data
  allTimeEntries: TimeEntry[] = [];  // Store all entries
  filteredEntries: TimeEntry[] = []; // Filtered entries for display
  selectedEntries: Set<number> = new Set();
  
  // Filter and search - simplified
  filters: ApprovalFilters = {
    dateRange: 'all',  // Start with all entries
    status: 'ALL',
    searchTerm: '',
    attorneyId: null
  };
  
  // User and case data for dropdowns
  attorneys: ApprovalUser[] = [];
  legalCases: { id: number; title: string; caseNumber: string; clientName: string }[] = [];
  
  // Stats
  stats: ApprovalStats = {
    pendingReview: 0,
    approvedToday: 0,
    rejectedToday: 0,
    pendingHours: 0,
    pendingAmount: 0,
    totalSelected: 0
  };
  
  // UI state
  loading = false;
  error: string | null = null;
  currentUser: User | null = null;
  allSelected = false;
  lastUpdated = new Date();
  
  // Pagination
  currentPage = 0;
  pageSize = 50;
  totalElements = 0;
  totalPages = 0;
  
  // Permission checks
  canApprove = false;
  canBulkApprove = false;

  constructor(
    private timeTrackingService: TimeTrackingService,
    private userService: UserService,
    private legalCaseService: LegalCaseService,
    private rbacService: RbacService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.currentUser = this.userService.getCurrentUser();
    this.checkPermissions();
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private checkPermissions(): void {
    this.canApprove = 
      this.rbacService.isAdmin() ||
      this.rbacService.isManager();
    
    this.canBulkApprove = 
      this.rbacService.isAdmin() ||
      this.rbacService.isManager();
  }

  private loadInitialData(): void {
    this.loading = true;
    this.error = null;

    // Load all necessary data concurrently
    forkJoin({
      timeEntries: this.loadAllTimeEntries(),
      attorneys: this.loadAttorneys(),
      cases: this.loadLegalCases()
    }).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (data) => {
        this.allTimeEntries = Array.isArray(data.timeEntries) ? data.timeEntries : data.timeEntries.content || [];
        this.attorneys = data.attorneys;
        this.legalCases = data.cases;

        this.applyFilters();
        this.calculateStats();
        this.lastUpdated = new Date();
      },
      error: (error) => {
        console.error('Error loading approval data:', error);
        this.error = 'Failed to load approval data. Please refresh the page.';
      }
    });
  }

  private loadAllTimeEntries() {
    // Load ALL time entries without filters (simplified approach)
    return this.timeTrackingService.getTimeEntriesWithFilters({
      page: 0,
      size: 500,  // Load more entries
      // No filters here - we'll filter client-side
    }).pipe(
      catchError(error => {
        console.error('Error loading time entries:', error);
        return of({ content: [], totalElements: 0, totalPages: 0, size: 0, number: 0, first: true, last: true });
      })
    );
  }

  private loadAttorneys() {
    return this.userService.getUsers().pipe(
      map(response => {
        const users = response?.data?.users || response?.data || [];

        return users.map((user: any) => ({
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          initials: this.getUserInitials(user),
          avatarColor: this.getUserAvatarColor(user)
        }));
      }),
      catchError(error => {
        console.error('Error loading attorneys:', error);
        return of([]);
      })
    );
  }

  private loadLegalCases() {
    return this.legalCaseService.getAllCases(0, 100).pipe(
      map(response => {
        let cases = [];

        if (response?.data?.cases && Array.isArray(response.data.cases)) {
          cases = response.data.cases;
        } else if (response?.data?.content && Array.isArray(response.data.content)) {
          cases = response.data.content;
        } else if (response?.data && Array.isArray(response.data)) {
          cases = response.data;
        } else if (Array.isArray(response)) {
          cases = response;
        } else {
          return [];
        }

        if (!Array.isArray(cases)) {
          return [];
        }

        return cases.map((legalCase: any) => ({
          id: parseInt(legalCase.id) || legalCase.id,
          title: legalCase.title || legalCase.name || 'Untitled Case',
          caseNumber: legalCase.caseNumber || legalCase.number || 'Unknown',
          clientName: legalCase.clientName ||
                     (legalCase.client ? `${legalCase.client.firstName} ${legalCase.client.lastName}` : 'Unknown Client')
        }));
      }),
      catchError(error => {
        console.error('Error loading legal cases:', error);
        return of([]);
      })
    );
  }

  // Simplified client-side filtering
  private applyFilters(): void {
    let filtered = [...this.allTimeEntries];

    // Status filter - handle both APPROVED and BILLING_APPROVED
    if (this.filters.status && this.filters.status !== 'ALL') {
      if (this.filters.status === 'APPROVED') {
        // Include both APPROVED and BILLING_APPROVED when filtering for approved
        filtered = filtered.filter(entry => 
          entry.status === 'APPROVED' || (entry.status as any) === 'BILLING_APPROVED'
        );
      } else {
        filtered = filtered.filter(entry => entry.status === this.filters.status);
      }
    }

    // Employee filter - fix ID matching
    if (this.filters.attorneyId) {
      filtered = filtered.filter(entry => {
        // Handle both string and number IDs
        const entryUserId = entry.userId ? String(entry.userId) : null;
        const filterUserId = String(this.filters.attorneyId);
        return entryUserId === filterUserId;
      });
    }

    // Date range filter - simplified
    if (this.filters.dateRange !== 'all') {
      const now = new Date();
      let startDate: Date;
      
      switch (this.filters.dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(0); // Very old date
      }
      
      filtered = filtered.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= startDate;
      });
    }

    // Custom date range
    if (this.filters.startDate) {
      const startDate = new Date(this.filters.startDate);
      filtered = filtered.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= startDate;
      });
    }

    if (this.filters.endDate) {
      const endDate = new Date(this.filters.endDate);
      endDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate <= endDate;
      });
    }

    // Search filter
    if (this.filters.searchTerm && this.filters.searchTerm.trim()) {
      const term = this.filters.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(entry =>
        entry.description?.toLowerCase().includes(term) ||
        entry.caseName?.toLowerCase().includes(term) ||
        entry.caseNumber?.toLowerCase().includes(term) ||
        entry.userName?.toLowerCase().includes(term)
      );
    }

    this.filteredEntries = filtered;
    this.totalElements = filtered.length;
    this.totalPages = Math.ceil(this.totalElements / this.pageSize);
    
    // Clear selections when filters change
    this.selectedEntries.clear();
    this.allSelected = false;
  }

  private calculateStats(): void {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    this.stats = {
      pendingReview: this.allTimeEntries.filter(e => e.status === 'SUBMITTED').length,
      approvedToday: this.allTimeEntries.filter(e => {
        // Check if status is approved (including billing approved)
        const isApproved = e.status === 'APPROVED' || (e.status as any) === 'BILLING_APPROVED';
        if (!isApproved) return false;
        
        // Check if approved today - use updatedAt or createdAt
        const approvalDate = e.updatedAt || e.createdAt;
        if (!approvalDate) return false;
        
        const approvalDateStr = new Date(approvalDate).toISOString().split('T')[0];
        return approvalDateStr === todayStr;
      }).length,
      rejectedToday: this.allTimeEntries.filter(e => {
        const isRejected = e.status === 'REJECTED';
        if (!isRejected) return false;
        
        const rejectionDate = e.updatedAt || e.createdAt;
        if (!rejectionDate) return false;
        
        const rejectionDateStr = new Date(rejectionDate).toISOString().split('T')[0];
        return rejectionDateStr === todayStr;
      }).length,
      pendingHours: this.allTimeEntries
        .filter(e => e.status === 'SUBMITTED')
        .reduce((sum, e) => sum + (e.hours || 0), 0),
      pendingAmount: this.allTimeEntries
        .filter(e => e.status === 'SUBMITTED')
        .reduce((sum, e) => sum + ((e.hours || 0) * (e.rate || 0)), 0),
      totalSelected: this.selectedEntries.size
    };
  }

  // Simplified filter methods
  onFiltersChange(): void {
    this.applyFilters();
    this.cdr.detectChanges();
  }

  onSearchChange(): void {
    this.applyFilters();
    this.cdr.detectChanges();
  }

  onDateRangeChange(): void {
    // When date range preset changes, clear custom dates
    this.filters.startDate = undefined;
    this.filters.endDate = undefined;
    this.applyFilters();
    this.cdr.detectChanges();
  }

  onCustomDateChange(): void {
    // When custom dates are set, change to custom mode
    if (this.filters.startDate || this.filters.endDate) {
      this.filters.dateRange = 'all'; // Don't interfere with custom dates
    }
    this.applyFilters();
    this.cdr.detectChanges();
  }

  clearFilters(): void {
    this.filters = {
      dateRange: 'all',
      status: 'ALL',
      searchTerm: '',
      startDate: undefined,
      endDate: undefined,
      attorneyId: null
    };
    this.applyFilters();
    this.cdr.detectChanges();
  }

  refreshData(): void {
    this.selectedEntries.clear();
    this.allSelected = false;
    this.loadInitialData();
  }

  // Selection methods
  onSelectAll(): void {
    const selectableEntries = this.filteredEntries.filter(e => e.status === 'SUBMITTED');
    
    if (this.allSelected) {
      // Deselect all
      this.selectedEntries.clear();
    } else {
      // Select all SUBMITTED entries only
      selectableEntries.forEach(entry => {
        if (entry.id) {
          this.selectedEntries.add(entry.id);
        }
      });
    }
    
    this.allSelected = !this.allSelected;
    this.calculateStats();
  }

  onSelectEntry(entryId: number): void {
    // Find the entry to check its status
    const entry = this.filteredEntries.find(e => e.id === entryId);
    
    // Only allow selection of SUBMITTED entries
    if (!entry || entry.status !== 'SUBMITTED') {
      return;
    }
    
    if (this.selectedEntries.has(entryId)) {
      this.selectedEntries.delete(entryId);
    } else {
      this.selectedEntries.add(entryId);
    }
    
    const selectableEntries = this.filteredEntries.filter(e => e.status === 'SUBMITTED');
    this.allSelected = selectableEntries.length > 0 && 
      selectableEntries.every(e => e.id && this.selectedEntries.has(e.id));
    
    this.calculateStats();
  }

  isSelected(entryId: number): boolean {
    return this.selectedEntries.has(entryId);
  }

  getSelectableEntriesCount(): number {
    return this.filteredEntries.filter(e => e.status === 'SUBMITTED').length;
  }

  // Approval methods
  approveEntry(entry: TimeEntry): void {
    if (!this.canApprove || !entry.id) return;

    Swal.fire({
      title: 'Approve Time Entry',
      text: `Approve ${entry.hours}h for ${entry.userName}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Approve',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#0ab39c'
    }).then((result) => {
      if (result.isConfirmed && entry.id) {
        this.timeTrackingService.approveTimeEntry(entry.id).subscribe({
          next: (approved) => {
            // Update local data immediately
            const index = this.allTimeEntries.findIndex(e => e.id === entry.id);
            if (index !== -1) {
              this.allTimeEntries[index] = { ...this.allTimeEntries[index], ...approved };
            }
            this.applyFilters();
            this.calculateStats();
            this.lastUpdated = new Date();
            this.cdr.detectChanges();
            this.showSuccessMessage('Time entry approved successfully');
          },
          error: (error) => {
            console.error('Failed to approve entry:', error);
            Swal.fire('Error', 'Failed to approve time entry', 'error');
          }
        });
      }
    });
  }

  rejectEntry(entry: TimeEntry): void {
    if (!this.canApprove || !entry.id) return;

    Swal.fire({
      title: 'Reject Time Entry',
      text: 'Please provide a reason for rejection:',
      input: 'textarea',
      inputPlaceholder: 'Enter rejection reason...',
      showCancelButton: true,
      confirmButtonText: 'Reject',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#f17171',
      inputValidator: (value) => {
        if (!value || value.trim().length < 5) {
          return 'Please provide a detailed reason (minimum 5 characters)';
        }
        return null;
      }
    }).then((result) => {
      if (result.isConfirmed && entry.id) {
        const reason = result.value;
        this.timeTrackingService.rejectTimeEntry(entry.id, reason).subscribe({
          next: (rejected) => {
            const index = this.allTimeEntries.findIndex(e => e.id === entry.id);
            if (index !== -1) {
              this.allTimeEntries[index] = { ...this.allTimeEntries[index], ...rejected };
            }
            this.applyFilters();
            this.calculateStats();
            this.lastUpdated = new Date();
            this.cdr.detectChanges();
            this.showSuccessMessage('Time entry rejected');
          },
          error: (error) => {
            console.error('Failed to reject entry:', error);
            Swal.fire('Error', 'Failed to reject time entry', 'error');
          }
        });
      }
    });
  }

  // Bulk operations
  bulkApprove(): void {
    if (!this.canBulkApprove || this.selectedEntries.size === 0) return;

    const count = this.selectedEntries.size;
    Swal.fire({
      title: 'Bulk Approve',
      text: `Approve ${count} selected time entries?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: `Approve ${count} Entries`,
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#0ab39c'
    }).then((result) => {
      if (result.isConfirmed) {
        this.processBulkOperation('approve');
      }
    });
  }

  bulkReject(): void {
    if (!this.canBulkApprove || this.selectedEntries.size === 0) return;

    const count = this.selectedEntries.size;
    Swal.fire({
      title: 'Bulk Reject',
      text: 'Please provide a reason for rejecting the selected entries:',
      input: 'textarea',
      inputPlaceholder: 'Enter rejection reason...',
      showCancelButton: true,
      confirmButtonText: `Reject ${count} Entries`,
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#f17171',
      inputValidator: (value) => {
        if (!value || value.trim().length < 5) {
          return 'Please provide a detailed reason (minimum 5 characters)';
        }
        return null;
      }
    }).then((result) => {
      if (result.isConfirmed) {
        const reason = result.value;
        this.processBulkOperation('reject', reason);
      }
    });
  }

  private processBulkOperation(operation: 'approve' | 'reject', reason?: string): void {
    const entryIds = Array.from(this.selectedEntries);
    const totalCount = entryIds.length;
    let completedCount = 0;
    let errorCount = 0;

    // Show progress
    Swal.fire({
      title: `Processing ${operation}...`,
      text: `0 of ${totalCount} completed`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      willOpen: () => {
        Swal.showLoading();
      }
    });

    // Process each entry
    entryIds.forEach(entryId => {
      const request = operation === 'approve' 
        ? this.timeTrackingService.approveTimeEntry(entryId)
        : this.timeTrackingService.rejectTimeEntry(entryId, reason || '');

      request.subscribe({
        next: (updated) => {
          completedCount++;
          
          // Update local data
          const index = this.allTimeEntries.findIndex(e => e.id === entryId);
          if (index !== -1) {
            this.allTimeEntries[index] = { ...this.allTimeEntries[index], ...updated };
          }
          
          // Update progress
          Swal.update({
            text: `${completedCount} of ${totalCount} completed`
          });
          
          // Check if all done
          if (completedCount + errorCount === totalCount) {
            this.finalizeBulkOperation(completedCount, errorCount, operation);
          }
        },
        error: (error) => {
          errorCount++;
          console.error(`Failed to ${operation} entry ${entryId}:`, error);
          
          // Update progress
          Swal.update({
            text: `${completedCount} of ${totalCount} completed (${errorCount} errors)`
          });
          
          // Check if all done
          if (completedCount + errorCount === totalCount) {
            this.finalizeBulkOperation(completedCount, errorCount, operation);
          }
        }
      });
    });
  }

  private finalizeBulkOperation(completed: number, errors: number, operation: string): void {
    // Clear selections and refresh data
    this.selectedEntries.clear();
    this.allSelected = false;
    this.applyFilters();
    this.calculateStats();
    this.lastUpdated = new Date();
    this.cdr.detectChanges();

    // Show completion message
    if (errors === 0) {
      Swal.fire({
        icon: 'success',
        title: 'Operation Complete',
        text: `Successfully ${operation}d ${completed} time entries`,
        timer: 3000,
        showConfirmButton: false
      });
    } else {
      Swal.fire({
        icon: 'warning',
        title: 'Operation Complete with Errors',
        text: `${completed} entries ${operation}d successfully, ${errors} failed`,
        confirmButtonText: 'OK'
      });
    }
  }

  // Utility methods
  getEmployeeInfo(entry: TimeEntry): { name: string; email: string; initials: string } {
    // Try to find the employee in our attorneys list first
    const attorney = this.attorneys.find(a => a.id === entry.userId);
    
    if (attorney) {
      return {
        name: `${attorney.firstName} ${attorney.lastName}`,
        email: attorney.email,
        initials: attorney.initials
      };
    }
    
    // Fallback to entry data if available
    if (entry.userName) {
      const nameParts = entry.userName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts[nameParts.length - 1] || '';
      
      return {
        name: entry.userName,
        email: entry.userEmail || 'No email',
        initials: this.getUserInitials({ firstName, lastName })
      };
    }
    
    // Final fallback
    return {
      name: 'Unknown User',
      email: 'No email',
      initials: '??'
    };
  }

  getDisplayStatus(status: string): string {
    switch (status) {
      case 'SUBMITTED':
        return 'Pending';
      case 'APPROVED':
      case 'BILLING_APPROVED':
        return 'Approved';
      case 'REJECTED':
        return 'Rejected';
      case 'DRAFT':
        return 'Draft';
      case 'BILLED':
        return 'Billed';
      default:
        return status;
    }
  }

  getUserInitials(user: any): string {
    if (!user) return '??';
    const first = user.firstName || user.first_name || '';
    const last = user.lastName || user.last_name || '';
    
    if (!first && !last) return '??';
    
    return (first.charAt(0) + last.charAt(0)).toUpperCase();
  }

  getUserAvatarColor(user: any): string {
    const colors = ['bg-primary', 'bg-success', 'bg-info', 'bg-warning', 'bg-danger', 'bg-secondary'];
    const hash = (user?.id || 0) % colors.length;
    return colors[hash];
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  formatHours(hours: number): string {
    return hours.toFixed(1);
  }

  formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'SUBMITTED':
        return 'bg-warning';
      case 'APPROVED':
        return 'bg-success';
      case 'REJECTED':
        return 'bg-danger';
      case 'DRAFT':
        return 'bg-secondary';
      default:
        return 'bg-light text-dark';
    }
  }

  private showSuccessMessage(message: string): void {
    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: message,
      timer: 2000,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  }

  // View details
  viewEntryDetails(entry: TimeEntry): void {
    Swal.fire({
      title: 'Time Entry Details',
      html: `
        <div class="text-left">
          <p><strong>Attorney:</strong> ${entry.userName || 'Unknown'}</p>
          <p><strong>Date:</strong> ${this.formatDate(entry.date)}</p>
          <p><strong>Case:</strong> ${entry.caseName || entry.caseNumber || 'Unknown'}</p>
          <p><strong>Duration:</strong> ${this.formatHours(entry.hours || 0)} hours</p>
          <p><strong>Rate:</strong> ${this.formatCurrency(entry.rate || 0)}/hour</p>
          <p><strong>Total:</strong> ${this.formatCurrency((entry.hours || 0) * (entry.rate || 0))}</p>
          <p><strong>Status:</strong> <span class="badge ${this.getStatusBadgeClass(entry.status || '')}">${entry.status}</span></p>
          <p><strong>Description:</strong></p>
          <div class="bg-light p-2 rounded">${entry.description || 'No description provided'}</div>
        </div>
      `,
      confirmButtonText: 'Close',
      width: '500px'
    });
  }

  trackByEntryId(index: number, entry: TimeEntry): number {
    return entry.id || index;
  }
} 