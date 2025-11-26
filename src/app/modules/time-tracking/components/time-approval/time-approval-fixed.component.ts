import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, forkJoin, of, finalize, map, catchError } from 'rxjs';
import { TimeTrackingService } from '../../services/time-tracking.service';
import { UserService } from '@app/core/services/user.service';
import { LegalCaseService } from '@app/modules/legal/services/legal-case.service';
import { RbacService } from '@app/core/services/rbac.service';
import { TimeEntry } from '../../models/time-entry.model';
import { User } from '@app/core/models/user.model';
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
  dateRange: 'today' | 'week' | 'month' | 'custom';
  startDate?: string;
  endDate?: string;
  attorneyId?: number | null;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'DRAFT' | 'BILLING_APPROVED' | 'ALL';
  caseId?: number | null;
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
  timeEntries: TimeEntry[] = [];
  filteredEntries: TimeEntry[] = [];
  selectedEntries: Set<number> = new Set();

  // Filters - Changed default to ALL to see what's available
  filters: ApprovalFilters = {
    dateRange: 'week',
    status: 'ALL', // Show all entries first to debug what's available
    searchTerm: '',
    startDate: undefined,
    endDate: undefined,
    attorneyId: null,
    caseId: null
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
  pageSize = 20;
  totalElements = 0;
  totalPages = 0;
  
  // Permission checks
  canApprove = false;
  canBulkApprove = false;

  // Date range picker
  dateRangeValue = '';

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
    this.initializeDateRange();
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
      timeEntries: this.loadTimeEntries(),
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
        console.log('📑 Time Approval Data loaded:', data);
        this.timeEntries = Array.isArray(data.timeEntries) ? data.timeEntries : data.timeEntries.content || [];
        this.attorneys = data.attorneys;
        this.legalCases = data.cases;
        console.log(`✅ Loaded ${this.timeEntries.length} time entries, ${this.attorneys.length} attorneys, ${this.legalCases.length} cases`);
        
        // Log time entry statuses for debugging
        const statusCounts = this.timeEntries.reduce((acc: any, entry) => {
          acc[entry.status] = (acc[entry.status] || 0) + 1;
          return acc;
        }, {});
        console.log('📑 Time entry status breakdown:', statusCounts);
        
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

  private loadTimeEntries() {
    // Get ALL time entries first to see what's available
    return this.timeTrackingService.getTimeEntriesWithFilters({
      page: this.currentPage,
      size: 100, // Load more for debugging
      statuses: undefined, // Load all statuses temporarily
      startDate: undefined,
      endDate: undefined,
      userId: undefined,
      legalCaseId: undefined
    }).pipe(
      catchError(error => {
        console.error('Error loading time entries:', error);
        return of({ content: [], totalElements: 0, totalPages: 0, size: 0, number: 0, first: true, last: true });
      })
    );
  }

  private loadAttorneys() {
    // Load users who can create time entries (attorneys, paralegals, etc.)
    return this.userService.getUsers().pipe(
      map(response => {
        console.log('👥 Users API response:', response);
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
        console.log('📁 Legal Cases API response:', response);
        
        // Better data extraction with debugging
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
          console.warn('⚠️ Unexpected legal cases response structure:', response);
          return [];
        }
        
        console.log(`📁 Processing ${cases.length} legal cases`);
        
        // Ensure cases is an array before mapping
        if (!Array.isArray(cases)) {
          console.error('❌ Cases is not an array:', typeof cases, cases);
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

  private getStartDate(): string | undefined {
    const today = new Date();
    switch (this.filters.dateRange) {
      case 'today':
        return today.toISOString().split('T')[0];
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 7);
        return weekStart.toISOString().split('T')[0];
      case 'month':
        const monthStart = new Date(today);
        monthStart.setDate(1);
        return monthStart.toISOString().split('T')[0];
      case 'custom':
        return this.filters.startDate;
      default:
        return undefined;
    }
  }

  private getEndDate(): string | undefined {
    const today = new Date();
    switch (this.filters.dateRange) {
      case 'today':
        return today.toISOString().split('T')[0];
      case 'week':
      case 'month':
        return today.toISOString().split('T')[0];
      case 'custom':
        return this.filters.endDate;
      default:
        return undefined;
    }
  }

  private applyFilters(): void {
    let filtered = [...this.timeEntries];
    console.log(`🔍 Applying filters to ${filtered.length} time entries`);

    // Apply employee filter
    if (this.filters.attorneyId) {
      filtered = filtered.filter(entry => entry.userId === this.filters.attorneyId);
      console.log(`👤 After employee filter: ${filtered.length} entries`);
    }

    // Apply status filter
    if (this.filters.status && this.filters.status !== 'ALL') {
      filtered = filtered.filter(entry => entry.status === this.filters.status);
      console.log(`📋 After status filter (${this.filters.status}): ${filtered.length} entries`);
    }

    // Apply case filter - THIS WAS MISSING!
    if (this.filters.caseId) {
      filtered = filtered.filter(entry => entry.caseId === this.filters.caseId);
      console.log(`📁 After case filter: ${filtered.length} entries`);
    }

    // Apply date range filter
    if (this.filters.startDate) {
      filtered = filtered.filter(entry => {
        const entryDate = new Date(entry.date).toISOString().split('T')[0];
        return entryDate >= this.filters.startDate!;
      });
      console.log(`📅 After start date filter: ${filtered.length} entries`);
    }

    if (this.filters.endDate) {
      filtered = filtered.filter(entry => {
        const entryDate = new Date(entry.date).toISOString().split('T')[0];
        return entryDate <= this.filters.endDate!;
      });
      console.log(`📅 After end date filter: ${filtered.length} entries`);
    }

    // Apply search filter
    if (this.filters.searchTerm) {
      const term = this.filters.searchTerm.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.description?.toLowerCase().includes(term) ||
        entry.caseName?.toLowerCase().includes(term) ||
        entry.caseNumber?.toLowerCase().includes(term) ||
        entry.userName?.toLowerCase().includes(term)
      );
      console.log(`🔍 After search filter: ${filtered.length} entries`);
    }

    this.filteredEntries = filtered;
    this.totalElements = filtered.length;
    this.totalPages = Math.ceil(this.totalElements / this.pageSize);
    
    console.log(`✅ Final filtered entries: ${this.filteredEntries.length}`);
  }

  private calculateStats(): void {
    const today = new Date().toISOString().split('T')[0];
    
    this.stats = {
      pendingReview: this.timeEntries.filter(e => e.status === 'SUBMITTED').length,
      approvedToday: this.timeEntries.filter(e => 
        e.status === 'APPROVED' && e.updatedAt && 
        new Date(e.updatedAt).toISOString().split('T')[0] === today
      ).length,
      rejectedToday: this.timeEntries.filter(e => 
        e.status === 'REJECTED' && e.updatedAt && 
        new Date(e.updatedAt).toISOString().split('T')[0] === today
      ).length,
      pendingHours: this.timeEntries
        .filter(e => e.status === 'SUBMITTED')
        .reduce((sum, e) => sum + (e.hours || 0), 0),
      pendingAmount: this.timeEntries
        .filter(e => e.status === 'SUBMITTED')
        .reduce((sum, e) => sum + ((e.hours || 0) * (e.rate || 0)), 0),
      totalSelected: this.selectedEntries.size
    };
  }

  // Filter methods - FIXED to reload data from server
  onFiltersChange(): void {
    this.currentPage = 0;
    this.selectedEntries.clear();
    this.allSelected = false;
    this.refreshData(); // Reload data from server with new filters
  }

  onSearchChange(): void {
    this.applyFilters();
    this.cdr.detectChanges();
  }

  // Selection methods
  onSelectAll(): void {
    if (this.allSelected) {
      this.selectedEntries.clear();
    } else {
      this.filteredEntries.forEach(entry => {
        if (entry.id && entry.status === 'SUBMITTED') {
          this.selectedEntries.add(entry.id);
        }
      });
    }
    this.allSelected = !this.allSelected;
    this.calculateStats();
  }

  onSelectEntry(entryId: number): void {
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

  // Approval methods - Rest of the methods remain the same...
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
            const index = this.timeEntries.findIndex(e => e.id === entry.id);
            if (index !== -1) {
              this.timeEntries[index] = { ...this.timeEntries[index], ...approved };
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

  // Utility methods
  getUserInitials(user: any): string {
    if (!user) return '??';
    const first = user.firstName || user.first_name || '';
    const last = user.lastName || user.last_name || '';
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
      case 'BILLING_APPROVED':
        return 'bg-info';
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

  refreshData(): void {
    this.selectedEntries.clear();
    this.allSelected = false;
    this.loadInitialData();
  }

  trackByEntryId(index: number, entry: TimeEntry): number {
    return entry.id || index;
  }

  private initializeDateRange(): void {
    // Set default date range to current week
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
    
    this.filters.startDate = startOfWeek.toISOString().split('T')[0];
    this.filters.endDate = endOfWeek.toISOString().split('T')[0];
    this.dateRangeValue = `${this.filters.startDate} to ${this.filters.endDate}`;
  }

  onDateRangeChange(event: any): void {
    const value = event.target.value;
    if (value && value.includes(' to ')) {
      const [startDate, endDate] = value.split(' to ');
      this.filters.startDate = startDate.trim();
      this.filters.endDate = endDate.trim();
      this.filters.dateRange = 'custom';
      this.onFiltersChange();
    }
  }

  clearFilters(): void {
    this.filters = {
      dateRange: 'week',
      status: 'ALL', // Keep it as ALL for now to see all data
      searchTerm: '',
      startDate: undefined,
      endDate: undefined,
      attorneyId: null,
      caseId: null
    };
    this.onFiltersChange();
  }
} 