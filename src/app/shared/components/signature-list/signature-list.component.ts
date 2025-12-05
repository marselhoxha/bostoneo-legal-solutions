import { Component, EventEmitter, Input, OnInit, Output, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { SignatureService, SignatureRequest, SignatureStatus } from '../../../core/services/signature.service';
import { SignatureStatusBadgeComponent } from '../signature-status-badge/signature-status-badge.component';

@Component({
  selector: 'app-signature-list',
  standalone: true,
  imports: [CommonModule, FormsModule, SignatureStatusBadgeComponent],
  templateUrl: './signature-list.component.html',
  styleUrls: ['./signature-list.component.scss']
})
export class SignatureListComponent implements OnInit {
  @Input() organizationId!: number;
  @Input() caseId?: number;
  @Input() clientId?: number;
  @Input() showActions: boolean = true;
  @Input() compact: boolean = false;
  @Input() maxItems?: number;

  @Output() requestSelected = new EventEmitter<SignatureRequest>();
  @Output() createRequest = new EventEmitter<void>();
  @Output() viewAuditLog = new EventEmitter<SignatureRequest>();

  requests: SignatureRequest[] = [];
  filteredRequests: SignatureRequest[] = [];
  loading = false;
  error: string | null = null;

  // Pagination
  currentPage = 0;
  pageSize = 20;
  totalElements = 0;
  totalPages = 0;

  // Filters
  searchQuery = '';
  statusFilter: SignatureStatus | 'ALL' = 'ALL';

  constructor(
    private signatureService: SignatureService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadRequests();
  }

  loadRequests(): void {
    this.loading = true;
    this.error = null;

    let observable;

    if (this.caseId) {
      observable = this.signatureService.getSignatureRequestsByCase(
        this.caseId, this.organizationId, this.currentPage, this.pageSize
      );
    } else if (this.clientId) {
      observable = this.signatureService.getSignatureRequestsByClient(
        this.clientId, this.organizationId, this.currentPage, this.pageSize
      );
    } else {
      observable = this.signatureService.getSignatureRequestsByOrganization(
        this.organizationId, this.currentPage, this.pageSize
      );
    }

    observable.subscribe({
      next: (response) => {
        this.requests = response.data?.signatureRequests || [];
        this.totalElements = response.data?.totalElements || 0;
        this.totalPages = response.data?.totalPages || 0;
        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading signature requests:', err);
        this.error = 'Failed to load signature requests';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.requests];

    // Apply status filter
    if (this.statusFilter !== 'ALL') {
      filtered = filtered.filter(r => r.status === this.statusFilter);
    }

    // Apply search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.title.toLowerCase().includes(query) ||
        r.signerName.toLowerCase().includes(query) ||
        r.signerEmail.toLowerCase().includes(query)
      );
    }

    // Apply max items limit
    if (this.maxItems) {
      filtered = filtered.slice(0, this.maxItems);
    }

    this.filteredRequests = filtered;
  }

  onSearch(): void {
    this.applyFilters();
  }

  onStatusFilterChange(): void {
    this.applyFilters();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadRequests();
  }

  selectRequest(request: SignatureRequest): void {
    this.requestSelected.emit(request);
  }

  sendReminder(request: SignatureRequest, event: Event): void {
    event.stopPropagation();
    if (!this.signatureService.canRemind(request)) return;

    this.signatureService.sendReminder(request.id).subscribe({
      next: () => {
        // Update local state
        request.reminderCount = (request.reminderCount || 0) + 1;
        request.lastReminderSentAt = new Date().toISOString();
        this.showSuccessToast('Reminder sent successfully');
      },
      error: (err) => {
        console.error('Error sending reminder:', err);
      }
    });
  }

  voidRequest(request: SignatureRequest, event: Event): void {
    event.stopPropagation();

    Swal.fire({
      title: 'Void Signature Request',
      text: 'Please provide a reason for voiding this request:',
      input: 'textarea',
      inputPlaceholder: 'Enter reason...',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Void Request',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#f06548',
      reverseButtons: true,
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'Please provide a reason';
        }
        return null;
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.signatureService.voidSignatureRequest(request.id, result.value).subscribe({
          next: () => {
            request.status = 'VOIDED';
            this.applyFilters();
            this.showSuccessToast('Signature request voided');
          },
          error: (err) => {
            console.error('Error voiding request:', err);
            Swal.fire({
              title: 'Error',
              text: 'Failed to void the request: ' + (err.error?.message || 'Unknown error'),
              icon: 'error',
              confirmButtonColor: '#405189'
            });
          }
        });
      }
    });
  }

  downloadDocument(request: SignatureRequest, event: Event): void {
    event.stopPropagation();
    if (!this.signatureService.isFinalState(request.status) || request.status !== 'COMPLETED') return;

    this.signatureService.downloadAsFile(request.id, request.fileName || 'signed-document.pdf');
  }

  refreshStatus(request: SignatureRequest, event: Event): void {
    event.stopPropagation();

    this.signatureService.refreshStatus(request.id).subscribe({
      next: (response) => {
        const updated = response.data?.signatureRequest;
        if (updated) {
          Object.assign(request, updated);
        }
      },
      error: (err) => {
        console.error('Error refreshing status:', err);
      }
    });
  }

  openAuditLog(request: SignatureRequest, event: Event): void {
    event.stopPropagation();
    this.viewAuditLog.emit(request);
  }

  getStatusIcon(status: SignatureStatus): string {
    return this.signatureService.getStatusIcon(status);
  }

  formatDate(date: string | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  formatDateTime(date: string | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  canRemind(request: SignatureRequest): boolean {
    return this.signatureService.canRemind(request);
  }

  canVoid(request: SignatureRequest): boolean {
    return !this.signatureService.isFinalState(request.status);
  }

  canDownload(request: SignatureRequest): boolean {
    return request.status === 'COMPLETED' || request.status === 'SIGNED';
  }

  get statusOptions(): { value: SignatureStatus | 'ALL'; label: string }[] {
    return [
      { value: 'ALL', label: 'All Statuses' },
      { value: 'DRAFT', label: 'Draft' },
      { value: 'SENT', label: 'Sent' },
      { value: 'VIEWED', label: 'Viewed' },
      { value: 'PARTIALLY_SIGNED', label: 'Partially Signed' },
      { value: 'COMPLETED', label: 'Completed' },
      { value: 'DECLINED', label: 'Declined' },
      { value: 'EXPIRED', label: 'Expired' },
      { value: 'VOIDED', label: 'Voided' }
    ];
  }

  private showSuccessToast(message: string): void {
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      didOpen: (toast) => {
        toast.onmouseenter = Swal.stopTimer;
        toast.onmouseleave = Swal.resumeTimer;
      }
    });
    Toast.fire({
      icon: 'success',
      title: message
    });
  }
}
