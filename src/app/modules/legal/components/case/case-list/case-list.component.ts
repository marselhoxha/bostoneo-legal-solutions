import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { LegalCase, CaseStatus, CasePriority, PaymentStatus } from '../../../interfaces/case.interface';
import { CaseService } from '../../../services/case.service';
import Swal from 'sweetalert2';
import { BehaviorSubject, Observable, of, Subject } from 'rxjs';
import { catchError, map, startWith, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { DataState } from 'src/app/enum/datastate.enum';
import { State } from 'src/app/interface/state';
import { CustomHttpResponse, Page } from 'src/app/interface/appstates';
import { User } from 'src/app/interface/user';

@Component({
  selector: 'app-case-list',
  templateUrl: './case-list.component.html',
  styleUrls: ['./case-list.component.scss']
})
export class CaseListComponent implements OnInit, OnDestroy {
  cases: LegalCase[] = [];
  allCases: LegalCase[] = []; // Store all cases from current page for local filtering
  isLoading = false;
  error: string | null = null;
  isSearching = false;

  // Stats - Attorney Focused
  hearingsThisWeekCount = 0;
  deadlinesDueCount = 0;
  awaitingResponseCount = 0;
  needsAttentionCount = 0;

  // Search and Filter
  searchTerm = '';
  selectedFilter: string | null = null;
  sortBy: string = 'deadline';

  // Server-side search
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  // Pagination-related variables
  state: { dataState: DataState, appData?: any } = { dataState: DataState.LOADING };
  readonly DataState = DataState;
  private currentPageSubject = new BehaviorSubject<number>(0);
  currentPage$ = this.currentPageSubject.asObservable();

  constructor(
    private caseService: CaseService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadCases();
    this.setupSearchDebounce();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearchDebounce(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchTerm => {
      if (searchTerm && searchTerm.trim().length >= 2) {
        this.performServerSearch(searchTerm.trim());
      } else if (!searchTerm || searchTerm.trim().length === 0) {
        // Reset to show all cases
        this.cases = [...this.allCases];
        this.isSearching = false;
        this.cdr.detectChanges();
      }
    });
  }

  private performServerSearch(query: string): void {
    this.isSearching = true;
    this.cdr.detectChanges();

    this.caseService.searchCases(query, 0, 50).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        if (response?.data?.page?.content) {
          this.cases = response.data.page.content;
        } else if (response?.data?.page) {
          this.cases = response.data.page;
        } else {
          this.cases = [];
        }
        this.isSearching = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Search error:', err);
        this.isSearching = false;
        // Fallback to local search
        this.cases = this.allCases.filter(c =>
          c.caseNumber?.toLowerCase().includes(query.toLowerCase()) ||
          c.title?.toLowerCase().includes(query.toLowerCase()) ||
          c.clientName?.toLowerCase().includes(query.toLowerCase()) ||
          c.type?.toLowerCase().includes(query.toLowerCase())
        );
        this.cdr.detectChanges();
      }
    });
  }

  loadCases(): void {
    this.isLoading = true;
    this.error = null;
    this.cdr.detectChanges();

    // Use real data from the API with pagination
    this.caseService.getCases(this.currentPageSubject.value).subscribe({
      next: (response) => {
        // The backend returns data in a wrapper object
        if (response && response.data) {
          // Handle both formats: data.page and data.cases
          if (response.data.page && response.data.page.content) {
            this.cases = response.data.page.content || [];
            this.allCases = [...this.cases]; // Store for local filtering
            // Update state for pagination
            this.state = {
              dataState: DataState.LOADED,
              appData: response
            };
          } else if (response.data.cases) {
            this.cases = response.data.cases || [];
            this.allCases = [...this.cases];
            this.state = {
              dataState: DataState.LOADED,
              appData: response
            };
          } else if (Array.isArray(response.data)) {
            this.cases = response.data;
            this.allCases = [...this.cases];
            this.state = {
              dataState: DataState.LOADED,
              appData: response
            };
          } else {
            console.warn('Unexpected data format:', response.data);
            this.cases = [];
            this.allCases = [];
          }
        } else if (Array.isArray(response)) {
          this.cases = response;
          this.allCases = [...this.cases];
        } else {
          console.warn('Unexpected response format:', response);
          this.cases = [];
          this.allCases = [];
        }
        this.calculateStats();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading cases:', err);
        this.error = 'Failed to load cases. Please try again later.';
        this.isLoading = false;
        this.cases = [];
        this.allCases = [];
        // Set sample data for development
        this.setSampleData();
        this.cdr.detectChanges();
      }
    });
  }

  // Pagination methods
  goToPage(pageNumber: number): void {
    this.currentPageSubject.next(pageNumber);
    this.loadCases();
  }

  goToNextOrPreviousPage(direction?: string): void {
    const newPage = direction === 'forward' 
      ? this.currentPageSubject.value + 1 
      : this.currentPageSubject.value - 1;
    this.goToPage(newPage);
  }

  viewCase(id: string): void {
    this.router.navigate(['/legal/cases', id]);
  }

  editCase(id: string): void {
    this.router.navigate(['/legal/cases/edit', id]);
  }

  createCase(): void {
    this.router.navigate(['/legal/cases/new']);
  }
  
  deleteCase(caseItem: LegalCase): void {
    Swal.fire({
      title: 'Are you sure?',
      text: `You are about to delete case "${caseItem.title}". This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isLoading = true;
        this.cdr.detectChanges();
        
        this.caseService.deleteCase(caseItem.id).subscribe({
          next: () => {
            this.isLoading = false;
            Swal.fire({
              title: 'Deleted!',
              text: 'Case has been successfully deleted.',
              icon: 'success',
              confirmButtonColor: '#3085d6'
            }).then(() => {
              // Reload the cases list after deletion
              this.loadCases();
            });
          },
          error: (error) => {
            this.isLoading = false;
            console.error('Error deleting case:', error);
            
            // For status 400, always treat as dependency/foreign key error
            if (error.status === 400) {
              Swal.fire({
                title: 'Cannot Delete Case',
                html: `This case has related records (documents, notes, activities, etc.) that must be deleted first.<br><br>
                       Please remove all documents, notes, and other related items before deleting this case.`,
                icon: 'warning',
                confirmButtonColor: '#3085d6',
                confirmButtonText: 'I Understand'
              });
            } else {
              // Generic error handling for other types of errors
              Swal.fire({
                title: 'Error!',
                text: 'Failed to delete case: ' + (error.error?.reason || error.error?.message || 'Please try again later.'),
                icon: 'error',
                confirmButtonColor: '#3085d6'
              });
            }
            
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  private setSampleData(): void {
    // Add sample data for development
    this.cases = [
      {
        id: '1',
        caseNumber: 'CASE-2025-001',
        title: 'Smith vs. Johnson Contract Dispute',
        description: 'Contract breach litigation involving commercial property',
        status: CaseStatus.OPEN,
        priority: CasePriority.HIGH,
        type: 'Contract Litigation',
        clientName: 'John Smith',
        clientEmail: 'john.smith@example.com',
        clientPhone: '555-0123',
        clientAddress: '123 Main St, Boston, MA',
        createdAt: new Date(),
        updatedAt: new Date(),
        courtInfo: {
          countyName: 'Suffolk County',
          judgeName: 'Hon. Jane Doe',
          courtroom: 'Room 501'
        },
        importantDates: {
          filingDate: new Date(),
          nextHearing: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          trialDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        },
        billingInfo: {
          hourlyRate: 350,
          totalHours: 45,
          totalAmount: 15750,
          paymentStatus: PaymentStatus.PENDING
        }
      },
      {
        id: '2',
        caseNumber: 'CASE-2025-002',
        title: 'Estate Planning - Williams Family',
        description: 'Comprehensive estate planning and trust formation',
        status: CaseStatus.IN_PROGRESS,
        priority: CasePriority.MEDIUM,
        type: 'Estate Planning',
        clientName: 'Sarah Williams',
        clientEmail: 'sarah.williams@example.com',
        clientPhone: '555-0124',
        clientAddress: '456 Oak Ave, Cambridge, MA',
        createdAt: new Date(),
        updatedAt: new Date(),
        billingInfo: {
          hourlyRate: 400,
          totalHours: 20,
          totalAmount: 8000,
          paymentStatus: PaymentStatus.PAID
        }
      }
    ];
    this.state = { 
      dataState: DataState.LOADED, 
      appData: { data: { cases: this.cases } } 
    };
  }

  /**
   * Checks if an error is related to a foreign key constraint violation
   * Note: This method is kept for backward compatibility but
   * we now handle all 400 errors as dependency errors directly
   */
  private isForeignKeyConstraintError(error: any): boolean {
    // All 400 status codes when deleting are treated as constraint errors
    if (error.status === 400) {
      return true;
    }
    
    // For additional safety, still check error messages
    const errorMsg = JSON.stringify(error || {}).toLowerCase();
    return errorMsg.includes('foreign key constraint') || 
           errorMsg.includes('constraint fails') || 
           errorMsg.includes('cannot delete') ||
           errorMsg.includes('referenced by') ||
           errorMsg.includes('bad request');
  }

  getStatusClass(status: CaseStatus): string {
    switch (status) {
      case CaseStatus.OPEN:
        return 'badge bg-success';
      case CaseStatus.IN_PROGRESS:
        return 'badge bg-warning';
      case CaseStatus.PENDING:
        return 'badge bg-info';
      case CaseStatus.CLOSED:
        return 'badge bg-danger';
      case CaseStatus.ARCHIVED:
        return 'badge bg-secondary';
      default:
        return 'badge';
    }
  }

  getPriorityClass(priority: CasePriority): string {
    switch (priority) {
      case CasePriority.LOW:
        return 'badge bg-success';
      case CasePriority.MEDIUM:
        return 'badge bg-warning';
      case CasePriority.HIGH:
        return 'badge bg-danger';
      case CasePriority.URGENT:
        return 'badge bg-danger';
      default:
        return 'badge';
    }
  }

  private calculateStats(): void {
    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Hearings this week - cases with next hearing within 7 days
    this.hearingsThisWeekCount = this.cases.filter(c => {
      const hearing = c.importantDates?.nextHearing;
      if (!hearing) return false;
      const hearingDate = new Date(hearing);
      return hearingDate >= now && hearingDate <= oneWeekFromNow;
    }).length;

    // Deadlines due - cases with important dates within 7 days (filing, trial)
    this.deadlinesDueCount = this.cases.filter(c => {
      if (!c.importantDates) return false;
      const filing = c.importantDates.filingDate ? new Date(c.importantDates.filingDate) : null;
      const trial = c.importantDates.trialDate ? new Date(c.importantDates.trialDate) : null;
      const hasUpcomingFiling = filing && filing >= now && filing <= oneWeekFromNow;
      const hasUpcomingTrial = trial && trial >= now && trial <= oneWeekFromNow;
      return hasUpcomingFiling || hasUpcomingTrial;
    }).length;

    // Awaiting response - cases in PENDING status
    this.awaitingResponseCount = this.cases.filter(c =>
      c.status === CaseStatus.PENDING
    ).length;

    // Needs attention - High priority OR overdue billing OR past deadlines
    this.needsAttentionCount = this.cases.filter(c => {
      const isHighPriority = c.priority === CasePriority.HIGH || c.priority === CasePriority.URGENT;
      const isOverdue = c.billingInfo?.paymentStatus === PaymentStatus.OVERDUE;
      const hasPastHearing = c.importantDates?.nextHearing && new Date(c.importantDates.nextHearing) < now;
      return isHighPriority || isOverdue || hasPastHearing;
    }).length;
  }

  // Filter and Search methods
  filterByStatus(filter: string): void {
    if (this.selectedFilter === filter) {
      this.selectedFilter = null;
    } else {
      this.selectedFilter = filter;
    }
  }

  clearFilter(): void {
    this.selectedFilter = null;
    this.searchTerm = '';
    this.cases = [...this.allCases];
    this.isSearching = false;
    this.cdr.detectChanges();
  }

  onSearch(): void {
    // Trigger server-side search via debounced subject
    this.searchSubject.next(this.searchTerm);
  }

  getFilteredCases(): LegalCase[] {
    let filtered = [...this.cases];
    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Apply status filter
    if (this.selectedFilter) {
      switch (this.selectedFilter) {
        case 'hearings':
          filtered = filtered.filter(c => {
            const hearing = c.importantDates?.nextHearing;
            if (!hearing) return false;
            const hearingDate = new Date(hearing);
            return hearingDate >= now && hearingDate <= oneWeekFromNow;
          });
          break;
        case 'deadlines':
          filtered = filtered.filter(c => {
            if (!c.importantDates) return false;
            const filing = c.importantDates.filingDate ? new Date(c.importantDates.filingDate) : null;
            const trial = c.importantDates.trialDate ? new Date(c.importantDates.trialDate) : null;
            const hasUpcomingFiling = filing && filing >= now && filing <= oneWeekFromNow;
            const hasUpcomingTrial = trial && trial >= now && trial <= oneWeekFromNow;
            return hasUpcomingFiling || hasUpcomingTrial;
          });
          break;
        case 'awaiting':
          filtered = filtered.filter(c => c.status === CaseStatus.PENDING);
          break;
        case 'attention':
          filtered = filtered.filter(c => {
            const isHighPriority = c.priority === CasePriority.HIGH || c.priority === CasePriority.URGENT;
            const isOverdue = c.billingInfo?.paymentStatus === PaymentStatus.OVERDUE;
            const hasPastHearing = c.importantDates?.nextHearing && new Date(c.importantDates.nextHearing) < now;
            return isHighPriority || isOverdue || hasPastHearing;
          });
          break;
      }
    }

    // Apply search filter
    if (this.searchTerm && this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(c =>
        c.caseNumber?.toLowerCase().includes(term) ||
        c.title?.toLowerCase().includes(term) ||
        c.clientName?.toLowerCase().includes(term) ||
        c.type?.toLowerCase().includes(term) ||
        this.getLeadAttorneyName(c)?.toLowerCase().includes(term)
      );
    }

    // Apply sorting
    filtered = this.sortCases(filtered);

    return filtered;
  }

  sortCases(cases: LegalCase[]): LegalCase[] {
    return [...cases].sort((a, b) => {
      switch (this.sortBy) {
        case 'deadline':
          const dateA = this.getNextDeadline(a);
          const dateB = this.getNextDeadline(b);
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return dateA.getTime() - dateB.getTime();
        case 'priority':
          const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
          return (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
        case 'updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'client':
          return (a.clientName || '').localeCompare(b.clientName || '');
        default:
          return 0;
      }
    });
  }

  // Helper methods for template
  getNextDeadline(caseItem: LegalCase): Date | null {
    if (!caseItem.importantDates) return null;
    const dates = [
      caseItem.importantDates.nextHearing,
      caseItem.importantDates.filingDate,
      caseItem.importantDates.trialDate
    ].filter(d => d && new Date(d) >= new Date()).map(d => new Date(d!));

    if (dates.length === 0) return null;
    return dates.reduce((min, d) => d < min ? d : min);
  }

  getDaysUntilDeadline(caseItem: LegalCase): number | null {
    const deadline = this.getNextDeadline(caseItem);
    if (!deadline) return null;
    const now = new Date();
    const diffTime = deadline.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getDeadlineUrgency(caseItem: LegalCase): string {
    const days = this.getDaysUntilDeadline(caseItem);
    if (days === null) return '';
    if (days < 0) return 'overdue';
    if (days <= 3) return 'urgent';
    if (days <= 7) return 'warning';
    return 'normal';
  }

  getLeadAttorneyName(caseItem: LegalCase): string {
    if (caseItem.assignedAttorneys && caseItem.assignedAttorneys.length > 0) {
      const lead = caseItem.assignedAttorneys.find(a => a.roleType === 'LEAD') || caseItem.assignedAttorneys[0];
      return `${lead.firstName} ${lead.lastName}`;
    }
    if (caseItem.assignedTo) {
      return `${caseItem.assignedTo.firstName || ''} ${caseItem.assignedTo.lastName || ''}`.trim();
    }
    return '';
  }

  getLeadAttorneyInitials(caseItem: LegalCase): string {
    const name = this.getLeadAttorneyName(caseItem);
    if (!name) return '?';
    const parts = name.split(' ').filter(p => p);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  getPaymentStatusClass(caseItem: LegalCase): string {
    const status = caseItem.billingInfo?.paymentStatus;
    switch (status) {
      case PaymentStatus.PAID: return 'bg-success-subtle text-success';
      case PaymentStatus.PENDING: return 'bg-warning-subtle text-warning';
      case PaymentStatus.OVERDUE: return 'bg-danger-subtle text-danger';
      default: return 'bg-secondary-subtle text-secondary';
    }
  }

  getPaymentStatusText(caseItem: LegalCase): string {
    return caseItem.billingInfo?.paymentStatus || 'N/A';
  }

  getRelativeTime(date: Date | string): string {
    if (!date) return 'Never';
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  getNextHearing(caseItem: LegalCase): Date | null {
    return caseItem.importantDates?.nextHearing ? new Date(caseItem.importantDates.nextHearing) : null;
  }

  // Tooltip helper methods
  getStatusTooltip(status: string): string {
    switch (status) {
      case 'OPEN': return 'Case is open and active - ready for work';
      case 'IN_PROGRESS': return 'Case is currently being worked on';
      case 'PENDING': return 'Awaiting response from client, court, or opposing counsel';
      case 'CLOSED': return 'Case has been resolved and closed';
      case 'ARCHIVED': return 'Case is archived for record-keeping';
      default: return status;
    }
  }

  getDeadlineTooltip(caseItem: LegalCase): string {
    const deadline = this.getNextDeadline(caseItem);
    if (!deadline) return 'No upcoming deadlines';

    const days = this.getDaysUntilDeadline(caseItem);
    const dateStr = deadline.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    if (days === null) return dateStr;
    if (days < 0) return `OVERDUE: ${dateStr} (${Math.abs(days)} days ago)`;
    if (days === 0) return `TODAY: ${dateStr}`;
    if (days === 1) return `TOMORROW: ${dateStr}`;
    return `${dateStr} (in ${days} days)`;
  }

  getBillingTooltip(caseItem: LegalCase): string {
    if (!caseItem.billingInfo) return 'No billing information available';

    const { paymentStatus, totalAmount, totalHours, hourlyRate } = caseItem.billingInfo;
    let tooltip = `Status: ${paymentStatus}`;

    if (totalAmount) {
      tooltip += ` | Total: $${totalAmount.toLocaleString()}`;
    }
    if (totalHours && hourlyRate) {
      tooltip += ` | ${totalHours} hrs @ $${hourlyRate}/hr`;
    }

    return tooltip;
  }

  // Case type badge styling helpers
  getCaseTypeBadgeClass(type: string): string {
    if (!type) return 'bg-secondary-subtle text-secondary';

    const typeLower = type.toLowerCase();

    // Criminal cases - Red/Danger
    if (typeLower.includes('criminal') || typeLower.includes('defense') || typeLower.includes('dui') || typeLower.includes('felony')) {
      return 'bg-danger-subtle text-danger';
    }
    // Family law - Pink/Purple
    if (typeLower.includes('family') || typeLower.includes('divorce') || typeLower.includes('custody') || typeLower.includes('adoption')) {
      return 'bg-pink-subtle text-pink';
    }
    // Immigration - Teal/Cyan
    if (typeLower.includes('immigration') || typeLower.includes('visa') || typeLower.includes('asylum') || typeLower.includes('naturalization')) {
      return 'bg-info-subtle text-info';
    }
    // Corporate/Business - Blue
    if (typeLower.includes('corporate') || typeLower.includes('business') || typeLower.includes('merger') || typeLower.includes('contract')) {
      return 'bg-primary-subtle text-primary';
    }
    // Real Estate - Green
    if (typeLower.includes('real estate') || typeLower.includes('property') || typeLower.includes('landlord') || typeLower.includes('tenant')) {
      return 'bg-success-subtle text-success';
    }
    // Personal Injury - Orange/Warning
    if (typeLower.includes('injury') || typeLower.includes('accident') || typeLower.includes('medical') || typeLower.includes('malpractice')) {
      return 'bg-warning-subtle text-warning';
    }
    // Estate/Probate - Purple
    if (typeLower.includes('estate') || typeLower.includes('probate') || typeLower.includes('trust') || typeLower.includes('will')) {
      return 'bg-purple-subtle text-purple';
    }
    // Employment/Labor - Indigo
    if (typeLower.includes('employment') || typeLower.includes('labor') || typeLower.includes('discrimination') || typeLower.includes('wrongful')) {
      return 'bg-indigo-subtle text-indigo';
    }
    // Intellectual Property - Cyan
    if (typeLower.includes('intellectual') || typeLower.includes('patent') || typeLower.includes('trademark') || typeLower.includes('copyright')) {
      return 'bg-cyan-subtle text-cyan';
    }
    // Bankruptcy - Dark
    if (typeLower.includes('bankruptcy') || typeLower.includes('debt') || typeLower.includes('insolvency')) {
      return 'bg-dark-subtle text-dark';
    }
    // Litigation - Orange
    if (typeLower.includes('litigation') || typeLower.includes('civil') || typeLower.includes('dispute')) {
      return 'bg-orange-subtle text-orange';
    }

    // Default
    return 'bg-secondary-subtle text-secondary';
  }

  getCaseTypeIcon(type: string): string {
    if (!type) return 'ri-briefcase-line';

    const typeLower = type.toLowerCase();

    if (typeLower.includes('criminal') || typeLower.includes('defense') || typeLower.includes('dui')) {
      return 'ri-shield-user-line';
    }
    if (typeLower.includes('family') || typeLower.includes('divorce') || typeLower.includes('custody')) {
      return 'ri-parent-line';
    }
    if (typeLower.includes('immigration') || typeLower.includes('visa') || typeLower.includes('asylum')) {
      return 'ri-global-line';
    }
    if (typeLower.includes('corporate') || typeLower.includes('business') || typeLower.includes('contract')) {
      return 'ri-building-2-line';
    }
    if (typeLower.includes('real estate') || typeLower.includes('property')) {
      return 'ri-home-line';
    }
    if (typeLower.includes('injury') || typeLower.includes('accident') || typeLower.includes('medical')) {
      return 'ri-heart-pulse-line';
    }
    if (typeLower.includes('estate') || typeLower.includes('probate') || typeLower.includes('trust')) {
      return 'ri-file-list-3-line';
    }
    if (typeLower.includes('employment') || typeLower.includes('labor')) {
      return 'ri-user-settings-line';
    }
    if (typeLower.includes('intellectual') || typeLower.includes('patent') || typeLower.includes('trademark')) {
      return 'ri-lightbulb-line';
    }
    if (typeLower.includes('bankruptcy') || typeLower.includes('debt')) {
      return 'ri-money-dollar-circle-line';
    }
    if (typeLower.includes('litigation') || typeLower.includes('civil')) {
      return 'ri-scales-3-line';
    }

    return 'ri-briefcase-line';
  }

  getCaseTypeIconClass(type: string): string {
    if (!type) return 'bg-secondary-subtle text-secondary';

    const typeLower = type.toLowerCase();

    if (typeLower.includes('criminal') || typeLower.includes('defense') || typeLower.includes('dui')) {
      return 'bg-danger-subtle text-danger';
    }
    if (typeLower.includes('family') || typeLower.includes('divorce') || typeLower.includes('custody')) {
      return 'bg-pink-subtle text-pink';
    }
    if (typeLower.includes('immigration') || typeLower.includes('visa') || typeLower.includes('asylum')) {
      return 'bg-info-subtle text-info';
    }
    if (typeLower.includes('corporate') || typeLower.includes('business') || typeLower.includes('contract')) {
      return 'bg-primary-subtle text-primary';
    }
    if (typeLower.includes('real estate') || typeLower.includes('property')) {
      return 'bg-success-subtle text-success';
    }
    if (typeLower.includes('injury') || typeLower.includes('accident') || typeLower.includes('medical')) {
      return 'bg-warning-subtle text-warning';
    }
    if (typeLower.includes('estate') || typeLower.includes('probate') || typeLower.includes('trust')) {
      return 'bg-purple-subtle text-purple';
    }
    if (typeLower.includes('employment') || typeLower.includes('labor')) {
      return 'bg-indigo-subtle text-indigo';
    }
    if (typeLower.includes('intellectual') || typeLower.includes('patent') || typeLower.includes('trademark')) {
      return 'bg-cyan-subtle text-cyan';
    }
    if (typeLower.includes('bankruptcy') || typeLower.includes('debt')) {
      return 'bg-dark-subtle text-dark';
    }
    if (typeLower.includes('litigation') || typeLower.includes('civil')) {
      return 'bg-orange-subtle text-orange';
    }

    return 'bg-secondary-subtle text-secondary';
  }
} 