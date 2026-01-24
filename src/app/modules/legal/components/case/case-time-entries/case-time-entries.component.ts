import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TimeTrackingService, TimeEntry, TimeEntryFilter } from '../../../../time-tracking/services/time-tracking.service';
import { UserService } from 'src/app/service/user.service';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime } from 'rxjs/operators';
import Swal from 'sweetalert2';

declare var flatpickr: any;

@Component({
  selector: 'app-case-time-entries',
  templateUrl: './case-time-entries.component.html',
  styleUrls: ['./case-time-entries.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatChipsModule,
    MatTooltipModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule
  ]
})
export class CaseTimeEntriesComponent implements OnInit, OnDestroy, AfterViewInit, OnChanges {
  @Input() caseId: string | null = null;
  @ViewChild('dateRangePicker') dateRangePicker!: ElementRef;

  private destroy$ = new Subject<void>();
  private filterChange$ = new Subject<void>();

  timeEntries: TimeEntry[] = [];
  isLoading = false;
  isSummaryLoading = false;
  error: string | null = null;

  // Pagination
  totalElements = 0;
  pageSize = 10;
  pageIndex = 0;

  // Summary metrics
  totalHours = 0;
  billableHours = 0;
  nonBillableHours = 0;
  totalAmount = 0;
  entryCount = 0;
  pendingCount = 0;

  // Filters
  dateRange: { start: Date | null; end: Date | null } = { start: null, end: null };
  selectedStatus: string = '';
  selectedDatePreset: string = 'all';
  dateRangeText: string = 'All Time';

  // Quick Add Form
  showAddForm = false;
  addForm!: FormGroup;
  isSubmitting = false;

  // Edit Entry
  editingEntryId: number | null = null;
  editForm!: FormGroup;

  displayedColumns: string[] = ['date', 'user', 'description', 'hours', 'billable', 'rate', 'amount', 'status', 'actions'];

  statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'SUBMITTED', label: 'Submitted' },
    { value: 'BILLING_APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'INVOICED', label: 'Invoiced' }
  ];

  private flatpickrInstance: any;
  private isInitialized = false;

  constructor(
    private timeTrackingService: TimeTrackingService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private userService: UserService
  ) {
    this.initForms();
  }

  ngOnInit() {
    // Setup debounced filter changes to prevent rapid API calls
    // Note: Do NOT use distinctUntilChanged() with Subject<void> - all void emissions are identical
    this.filterChange$
      .pipe(
        debounceTime(300),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.loadTimeEntries();
      });

    if (this.caseId) {
      this.loadInitialData();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['caseId'] && !changes['caseId'].firstChange && this.caseId) {
      this.loadInitialData();
    }
  }

  ngAfterViewInit() {
    // Delay flatpickr init to avoid change detection issues
    setTimeout(() => {
      this.initDatePicker();
      this.isInitialized = true;
      this.cdr.markForCheck();
    }, 100);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.filterChange$.complete();
    if (this.flatpickrInstance) {
      this.flatpickrInstance.destroy();
    }
  }

  private loadInitialData() {
    this.loadTimeEntries();
    this.loadSummary();
  }

  private initForms() {
    this.addForm = this.fb.group({
      date: [new Date().toISOString().split('T')[0], Validators.required],
      hours: [1, [Validators.required, Validators.min(0.1), Validators.max(24)]],
      description: ['', [Validators.required, Validators.minLength(3)]],
      billable: [true],
      rate: [250, [Validators.required, Validators.min(0)]]
    });

    this.editForm = this.fb.group({
      date: ['', Validators.required],
      hours: [0, [Validators.required, Validators.min(0.1), Validators.max(24)]],
      description: ['', [Validators.required, Validators.minLength(3)]],
      billable: [true],
      rate: [0, [Validators.required, Validators.min(0)]]
    });
  }

  private initDatePicker() {
    if (typeof flatpickr !== 'undefined' && this.dateRangePicker?.nativeElement) {
      this.flatpickrInstance = flatpickr(this.dateRangePicker.nativeElement, {
        mode: 'range',
        dateFormat: 'M j, Y',
        onChange: (selectedDates: Date[]) => {
          if (selectedDates.length === 2) {
            this.dateRange = { start: selectedDates[0], end: selectedDates[1] };
            this.selectedDatePreset = 'custom';
            this.pageIndex = 0;
            this.filterChange$.next();
            this.cdr.markForCheck();
          }
        }
      });
    }
  }

  loadTimeEntries() {
    if (!this.caseId) return;

    this.isLoading = true;
    this.error = null;
    this.cdr.markForCheck();

    const filters: TimeEntryFilter = {
      legalCaseId: Number(this.caseId),
      page: this.pageIndex,
      size: this.pageSize,
      sortBy: 'date',
      sortDirection: 'desc'
    };

    // Add date filters
    if (this.dateRange.start) {
      filters.startDate = this.formatDateForApi(this.dateRange.start);
    }
    if (this.dateRange.end) {
      filters.endDate = this.formatDateForApi(this.dateRange.end);
    }

    // Add status filter
    if (this.selectedStatus) {
      filters.statuses = [this.selectedStatus];
    }

    this.timeTrackingService.getTimeEntriesWithFilters(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.timeEntries = response.content || [];
          this.totalElements = response.totalElements || 0;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.error = 'Failed to load time entries';
          this.isLoading = false;
          this.timeEntries = [];
          this.totalElements = 0;
          console.error('Error loading time entries:', error);
          this.cdr.markForCheck();
        }
      });
  }

  loadSummary() {
    if (!this.caseId) return;

    this.isSummaryLoading = true;
    this.cdr.markForCheck();

    this.timeTrackingService.getCaseTimeComprehensiveSummary(Number(this.caseId))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (summary) => {
          this.totalHours = summary.totalHours || 0;
          this.billableHours = summary.billableHours || 0;
          this.nonBillableHours = summary.nonBillableHours || 0;
          this.totalAmount = summary.totalAmount || 0;
          this.entryCount = summary.entryCount || 0;
          this.pendingCount = summary.pendingCount || 0;
          this.isSummaryLoading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading case summary:', error);
          this.isSummaryLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  // Date Presets - Use explicit click handler
  onDatePresetClick(preset: string) {
    // Allow re-clicking same preset to refresh
    this.selectedDatePreset = preset;
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today for end date

    switch (preset) {
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay()); // Sunday as start of week
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(today);
        weekEnd.setHours(23, 59, 59, 999);
        this.dateRange = { start: weekStart, end: weekEnd };
        this.dateRangeText = 'This Week';
        break;
      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(today);
        monthEnd.setHours(23, 59, 59, 999);
        this.dateRange = { start: monthStart, end: monthEnd };
        this.dateRangeText = 'This Month';
        break;
      case 'lastMonth':
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        lastMonthStart.setHours(0, 0, 0, 0);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        lastMonthEnd.setHours(23, 59, 59, 999);
        this.dateRange = { start: lastMonthStart, end: lastMonthEnd };
        this.dateRangeText = 'Last Month';
        break;
      case 'all':
      default:
        this.dateRange = { start: null, end: null };
        this.dateRangeText = 'All Time';
        break;
    }

    if (this.flatpickrInstance && preset !== 'custom') {
      if (this.dateRange.start && this.dateRange.end) {
        this.flatpickrInstance.setDate([this.dateRange.start, this.dateRange.end], false);
      } else {
        this.flatpickrInstance.clear();
      }
    }

    this.pageIndex = 0;
    this.filterChange$.next();
    this.cdr.markForCheck();
  }

  // Status filter change - explicit handler
  onStatusChange(status: string) {
    if (this.selectedStatus === status) return; // Prevent duplicate calls

    this.selectedStatus = status;
    this.pageIndex = 0;
    this.filterChange$.next();
    this.cdr.markForCheck();
  }

  clearFilters() {
    this.selectedStatus = '';
    this.selectedDatePreset = 'all';
    this.dateRange = { start: null, end: null };
    this.dateRangeText = 'All Time';
    this.pageIndex = 0;

    if (this.flatpickrInstance) {
      this.flatpickrInstance.clear();
    }

    this.filterChange$.next();
    this.cdr.markForCheck();
  }

  onPageChange(event: PageEvent) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadTimeEntries();
  }

  // Quick Add
  toggleAddForm() {
    this.showAddForm = !this.showAddForm;
    if (this.showAddForm) {
      this.addForm.reset({
        date: new Date().toISOString().split('T')[0],
        hours: 1,
        description: '',
        billable: true,
        rate: 250
      });
    }
    this.cdr.markForCheck();
  }

  submitNewEntry() {
    if (this.addForm.invalid || !this.caseId) return;

    this.isSubmitting = true;
    this.cdr.markForCheck();

    const formValue = this.addForm.value;
    const currentUserId = this.userService.getCurrentUserId();

    if (!currentUserId) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Unable to identify current user. Please log in again.'
      });
      this.isSubmitting = false;
      this.cdr.markForCheck();
      return;
    }

    const newEntry: TimeEntry = {
      legalCaseId: Number(this.caseId),
      userId: currentUserId,
      date: formValue.date,
      hours: formValue.hours,
      rate: formValue.rate,
      description: formValue.description,
      billable: formValue.billable,
      status: 'DRAFT'
    };

    this.timeTrackingService.createTimeEntry(newEntry)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Success',
            text: 'Time entry created successfully',
            timer: 1500,
            showConfirmButton: false
          });
          this.showAddForm = false;
          this.isSubmitting = false;
          this.loadTimeEntries();
          this.loadSummary();
        },
        error: (error) => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to create time entry'
          });
          console.error('Error creating time entry:', error);
          this.isSubmitting = false;
          this.cdr.markForCheck();
        }
      });
  }

  // Edit Entry
  startEdit(entry: TimeEntry) {
    this.editingEntryId = entry.id!;
    this.editForm.patchValue({
      date: entry.date,
      hours: entry.hours,
      description: entry.description,
      billable: entry.billable,
      rate: entry.rate
    });
    this.cdr.markForCheck();
  }

  cancelEdit() {
    this.editingEntryId = null;
    this.cdr.markForCheck();
  }

  saveEdit(entry: TimeEntry) {
    if (this.editForm.invalid) return;

    const formValue = this.editForm.value;
    const updatedEntry: TimeEntry = {
      ...entry,
      date: formValue.date,
      hours: formValue.hours,
      description: formValue.description,
      billable: formValue.billable,
      rate: formValue.rate
    };

    this.timeTrackingService.updateTimeEntry(entry.id!, updatedEntry)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Updated',
            text: 'Time entry updated successfully',
            timer: 1500,
            showConfirmButton: false
          });
          this.editingEntryId = null;
          this.loadTimeEntries();
          this.loadSummary();
        },
        error: (error) => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to update time entry'
          });
          console.error('Error updating time entry:', error);
          this.cdr.markForCheck();
        }
      });
  }

  // Delete Entry
  deleteEntry(entry: TimeEntry) {
    Swal.fire({
      title: 'Delete Time Entry?',
      text: `Are you sure you want to delete this ${this.formatHours(entry.hours)} entry?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it'
    }).then((result) => {
      if (result.isConfirmed) {
        this.timeTrackingService.deleteTimeEntry(entry.id!)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              Swal.fire({
                icon: 'success',
                title: 'Deleted',
                text: 'Time entry deleted successfully',
                timer: 1500,
                showConfirmButton: false
              });
              this.loadTimeEntries();
              this.loadSummary();
            },
            error: (error) => {
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to delete time entry'
              });
              console.error('Error deleting time entry:', error);
            }
          });
      }
    });
  }

  // Quick Actions
  submitEntry(entry: TimeEntry) {
    this.timeTrackingService.changeTimeEntryStatus(entry.id!, 'SUBMITTED')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Submitted',
            text: 'Entry submitted for approval',
            timer: 1500,
            showConfirmButton: false
          });
          this.loadTimeEntries();
          this.loadSummary();
        },
        error: (error) => {
          Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to submit entry' });
          console.error('Error:', error);
        }
      });
  }

  approveEntry(entry: TimeEntry) {
    this.timeTrackingService.approveTimeEntry(entry.id!)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Approved',
            text: 'Entry approved successfully',
            timer: 1500,
            showConfirmButton: false
          });
          this.loadTimeEntries();
          this.loadSummary();
        },
        error: (error) => {
          Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to approve entry' });
          console.error('Error:', error);
        }
      });
  }

  // Helpers
  getStatusClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'DRAFT': 'draft',
      'SUBMITTED': 'submitted',
      'APPROVED': 'approved',
      'BILLING_APPROVED': 'approved',
      'REJECTED': 'rejected',
      'INVOICED': 'invoiced'
    };
    return statusClasses[status] || 'draft';
  }

  formatHours(hours: number): string {
    if (!hours) return '0h';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  private formatDateForApi(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  canEdit(entry: TimeEntry): boolean {
    return entry.status === 'DRAFT' || entry.status === 'REJECTED';
  }

  canDelete(entry: TimeEntry): boolean {
    return entry.status === 'DRAFT';
  }

  canSubmit(entry: TimeEntry): boolean {
    return entry.status === 'DRAFT';
  }

  canApprove(entry: TimeEntry): boolean {
    return entry.status === 'SUBMITTED';
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'DRAFT': 'Draft',
      'SUBMITTED': 'Pending',
      'APPROVED': 'Approved',
      'BILLING_APPROVED': 'Approved',
      'REJECTED': 'Rejected',
      'INVOICED': 'Invoiced'
    };
    return labels[status] || status;
  }

  // TrackBy function for table performance
  trackByEntryId(index: number, entry: TimeEntry): number {
    return entry.id || index;
  }

  // Check if filters are active
  hasActiveFilters(): boolean {
    return this.selectedStatus !== '' || this.selectedDatePreset !== 'all';
  }

  // View Entry Details
  viewEntry(entry: TimeEntry) {
    const amount = (entry.hours * entry.rate).toFixed(2);
    const formattedDate = new Date(entry.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    Swal.fire({
      title: 'Time Entry Details',
      html: `
        <div class="text-start">
          <div class="mb-3 pb-3 border-bottom">
            <div class="d-flex justify-content-between align-items-center">
              <span class="text-muted">Date</span>
              <strong>${formattedDate}</strong>
            </div>
          </div>
          <div class="mb-3 pb-3 border-bottom">
            <div class="d-flex justify-content-between align-items-center">
              <span class="text-muted">User</span>
              <strong>${entry.userName || 'Unknown'}</strong>
            </div>
          </div>
          <div class="mb-3 pb-3 border-bottom">
            <div class="d-flex justify-content-between align-items-center">
              <span class="text-muted">Hours</span>
              <strong>${this.formatHours(entry.hours)}</strong>
            </div>
          </div>
          <div class="mb-3 pb-3 border-bottom">
            <div class="d-flex justify-content-between align-items-center">
              <span class="text-muted">Rate</span>
              <strong>$${entry.rate.toFixed(2)}/hr</strong>
            </div>
          </div>
          <div class="mb-3 pb-3 border-bottom">
            <div class="d-flex justify-content-between align-items-center">
              <span class="text-muted">Amount</span>
              <strong class="text-success">$${amount}</strong>
            </div>
          </div>
          <div class="mb-3 pb-3 border-bottom">
            <div class="d-flex justify-content-between align-items-center">
              <span class="text-muted">Billable</span>
              <span class="badge ${entry.billable ? 'bg-success' : 'bg-secondary'}">${entry.billable ? 'Yes' : 'No'}</span>
            </div>
          </div>
          <div class="mb-3 pb-3 border-bottom">
            <div class="d-flex justify-content-between align-items-center">
              <span class="text-muted">Status</span>
              <span class="badge bg-${this.getStatusBadgeClass(entry.status)}">${this.getStatusLabel(entry.status)}</span>
            </div>
          </div>
          <div class="mb-2">
            <span class="text-muted d-block mb-1">Description</span>
            <p class="mb-0">${entry.description || 'No description'}</p>
          </div>
        </div>
      `,
      width: 450,
      showCloseButton: true,
      showConfirmButton: false,
      customClass: {
        popup: 'time-entry-detail-popup'
      }
    });
  }

  private getStatusBadgeClass(status: string): string {
    const classes: { [key: string]: string } = {
      'DRAFT': 'secondary',
      'SUBMITTED': 'warning',
      'APPROVED': 'success',
      'BILLING_APPROVED': 'success',
      'REJECTED': 'danger',
      'INVOICED': 'info'
    };
    return classes[status] || 'secondary';
  }
}
