import { Component, EventEmitter, Input, OnInit, Output, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { SignatureService, SignatureRequest, SignatureStatus, BoldSignDocument } from '../../../core/services/signature.service';
import { SignatureStatusBadgeComponent } from '../signature-status-badge/signature-status-badge.component';

@Component({
  selector: 'app-signature-list',
  standalone: true,
  imports: [CommonModule, FormsModule, SignatureStatusBadgeComponent],
  templateUrl: './signature-list.component.html',
  styleUrls: ['./signature-list.component.scss']
})
export class SignatureListComponent implements OnInit {
  // Expose Math for template
  Math = Math;

  @Input() organizationId!: number;
  @Input() caseId?: number;
  @Input() clientId?: number;
  @Input() showActions: boolean = true;
  @Input() compact: boolean = false;
  @Input() maxItems?: number;
  @Input() dataSource: 'local' | 'boldsign' = 'boldsign';

  @Output() requestSelected = new EventEmitter<SignatureRequest>();
  @Output() documentSelected = new EventEmitter<BoldSignDocument>();
  @Output() createRequest = new EventEmitter<void>();
  @Output() viewAuditLog = new EventEmitter<SignatureRequest>();
  @Output() totalCountChanged = new EventEmitter<number>();

  // Local database requests
  requests: SignatureRequest[] = [];
  filteredRequests: SignatureRequest[] = [];

  // BoldSign documents (live from API)
  boldsignDocuments: BoldSignDocument[] = [];

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

  // BoldSign filter tabs
  boldsignStatusFilter = 'All';
  boldsignStatusTabs = [
    { value: 'All', label: 'All' },
    { value: 'WaitingForMe', label: 'Waiting for me' },
    { value: 'WaitingForOthers', label: 'Waiting for others' },
    { value: 'NeedAttention', label: 'Needs attention' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Declined', label: 'Declined' },
    { value: 'Expired', label: 'Expired' },
    { value: 'Revoked', label: 'Revoked' }
  ];

  constructor(
    private signatureService: SignatureService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadRequests();
  }

  loadRequests(): void {
    if (this.dataSource === 'boldsign') {
      this.loadBoldSignDocuments();
    } else {
      this.loadLocalRequests();
    }
  }

  /**
   * Load documents directly from BoldSign API
   */
  loadBoldSignDocuments(): void {
    this.loading = true;
    this.error = null;

    // BoldSign uses 1-based page numbers
    const page = this.currentPage + 1;

    this.signatureService.listBoldSignDocuments(
      this.boldsignStatusFilter,
      page,
      this.pageSize
    ).subscribe({
      next: (response) => {
        this.boldsignDocuments = response.data?.documents || [];
        this.totalElements = response.data?.totalCount || 0;
        this.totalPages = Math.ceil(this.totalElements / this.pageSize);
        this.totalCountChanged.emit(this.totalElements);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading BoldSign documents:', err);
        this.error = 'Failed to load documents from BoldSign';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Load documents from local database
   */
  loadLocalRequests(): void {
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
        this.totalCountChanged.emit(this.totalElements);
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

  /**
   * Handle BoldSign status tab change
   */
  onBoldsignStatusChange(status: string): void {
    this.boldsignStatusFilter = status;
    this.currentPage = 0;
    this.loadBoldSignDocuments();
  }

  /**
   * Select a BoldSign document
   */
  selectDocument(doc: BoldSignDocument): void {
    this.documentSelected.emit(doc);
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

  // ==================== BoldSign Document Helpers ====================

  /**
   * Get status message for BoldSign document (e.g., "Needs to be signed by Jane Smith")
   */
  getBoldsignStatusMessage(doc: BoldSignDocument): string {
    const status = doc.status?.toLowerCase() || '';
    const signerName = doc.signerName || 'recipient';

    if (status.includes('waitingforothers') || status === 'inprogress' || status === 'sent') {
      return `Needs to be signed by ${signerName}`;
    } else if (status === 'completed') {
      return 'Signed by all parties';
    } else if (status === 'declined') {
      return `Declined by ${signerName}`;
    } else if (status === 'expired') {
      return 'Document has expired';
    } else if (status === 'revoked' || status === 'voided') {
      return 'By You';
    }
    return '';
  }

  /**
   * Get display status text for BoldSign document
   */
  getBoldsignStatusDisplay(doc: BoldSignDocument): string {
    const status = doc.status?.toLowerCase() || '';

    if (status.includes('waitingforme')) return 'Waiting for me';
    if (status.includes('waitingforothers') || status === 'inprogress' || status === 'sent') return 'Waiting for others';
    if (status === 'completed') return 'Completed';
    if (status === 'declined') return 'Declined';
    if (status === 'expired') return 'Expired';
    if (status === 'revoked' || status === 'voided') return 'Revoked';
    if (status === 'needsattention') return 'Needs attention';
    return doc.status || 'Unknown';
  }

  /**
   * Get status badge class for BoldSign document
   */
  getBoldsignStatusClass(doc: BoldSignDocument): string {
    const status = doc.status?.toLowerCase() || '';

    if (status === 'completed') return 'badge bg-success-subtle text-success';
    if (status.includes('waitingforme')) return 'badge bg-primary-subtle text-primary';
    if (status.includes('waitingforothers') || status === 'inprogress' || status === 'sent') return 'badge bg-info-subtle text-info';
    if (status === 'needsattention') return 'badge bg-warning-subtle text-warning';
    if (status === 'declined' || status === 'expired' || status === 'revoked' || status === 'voided') return 'badge bg-danger-subtle text-danger';
    return 'badge bg-secondary-subtle text-secondary';
  }

  /**
   * Get status icon for BoldSign document
   */
  getBoldsignStatusIcon(doc: BoldSignDocument): string {
    const status = doc.status?.toLowerCase() || '';

    if (status === 'completed') return 'ri-check-double-line';
    if (status.includes('waitingforme')) return 'ri-time-line';
    if (status.includes('waitingforothers') || status === 'inprogress' || status === 'sent') return 'ri-send-plane-line';
    if (status === 'needsattention') return 'ri-error-warning-line';
    if (status === 'declined') return 'ri-close-circle-line';
    if (status === 'expired') return 'ri-calendar-close-line';
    if (status === 'revoked' || status === 'voided') return 'ri-forbid-line';
    return 'ri-file-line';
  }

  /**
   * Format last activity for BoldSign document
   */
  formatBoldsignLastActivity(doc: BoldSignDocument): string {
    if (!doc.lastActivityBy && !doc.lastActivityAction) {
      return '';
    }
    const actor = doc.lastActivityBy || 'Someone';
    const action = doc.lastActivityAction?.toLowerCase() || 'updated';

    // Format the action nicely
    if (action.includes('sent')) return `${actor} has sent the document`;
    if (action.includes('viewed')) return `${actor} has viewed the document`;
    if (action.includes('signed')) return `${actor} has signed the document`;
    if (action.includes('completed')) return `${actor} has completed the document`;
    if (action.includes('declined')) return `${actor} has declined the document`;
    if (action.includes('revoked')) return `${actor} has revoked the document`;
    if (action.includes('created')) return `${actor} has created the document`;

    return `${actor} ${action}`;
  }

  /**
   * Format date for BoldSign document display
   */
  formatBoldsignDate(dateString: string | undefined): string {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      }) + ' ' + date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateString;
    }
  }

  // ==================== Card-based Design Helpers ====================

  /**
   * Get CSS class for document item (left border indicator)
   */
  getDocumentStatusClass(doc: BoldSignDocument): string {
    const status = doc.status?.toLowerCase() || '';

    if (status.includes('waitingforme')) return 'status-waiting-me';
    if (status.includes('waitingforothers') || status === 'inprogress' || status === 'sent') return 'status-waiting-others';
    if (status === 'completed') return 'status-completed';
    if (status === 'needsattention') return 'status-attention';
    if (status === 'declined') return 'status-declined';
    if (status === 'expired') return 'status-expired';
    if (status === 'revoked' || status === 'voided') return 'status-voided';
    return '';
  }

  /**
   * Get background class for document icon
   */
  getDocumentIconBgClass(doc: BoldSignDocument): string {
    const status = doc.status?.toLowerCase() || '';

    if (status.includes('waitingforme')) return 'bg-primary-subtle';
    if (status.includes('waitingforothers') || status === 'inprogress' || status === 'sent') return 'bg-info-subtle';
    if (status === 'completed') return 'bg-success-subtle';
    if (status === 'needsattention') return 'bg-warning-subtle';
    if (status === 'declined' || status === 'expired' || status === 'revoked' || status === 'voided') return 'bg-danger-subtle';
    return 'bg-secondary-subtle';
  }

  /**
   * Get icon class for document
   */
  getDocumentIcon(doc: BoldSignDocument): string {
    const status = doc.status?.toLowerCase() || '';

    if (status === 'completed') return 'ri-checkbox-circle-line text-success';
    if (status.includes('waitingforme')) return 'ri-time-line text-primary';
    if (status.includes('waitingforothers') || status === 'inprogress' || status === 'sent') return 'ri-send-plane-line text-info';
    if (status === 'needsattention') return 'ri-error-warning-line text-warning';
    if (status === 'declined') return 'ri-close-circle-line text-danger';
    if (status === 'expired') return 'ri-calendar-close-line text-danger';
    if (status === 'revoked' || status === 'voided') return 'ri-forbid-line text-danger';
    return 'ri-file-text-line text-secondary';
  }

  /**
   * Get status badge CSS class
   */
  getStatusBadgeClass(doc: BoldSignDocument): string {
    const status = doc.status?.toLowerCase() || '';

    if (status.includes('waitingforme')) return 'status-waiting-me';
    if (status.includes('waitingforothers') || status === 'inprogress' || status === 'sent') return 'status-waiting-others';
    if (status === 'completed') return 'status-completed';
    if (status === 'needsattention') return 'status-attention';
    if (status === 'declined') return 'status-declined';
    if (status === 'expired') return 'status-expired';
    if (status === 'revoked' || status === 'voided') return 'status-voided';
    return 'status-draft';
  }

  /**
   * Get CSS class for local request items (left border indicator)
   */
  getLocalStatusClass(request: SignatureRequest): string {
    switch (request.status) {
      case 'SENT':
      case 'VIEWED':
        return 'status-waiting-others';
      case 'PARTIALLY_SIGNED':
        return 'status-attention';
      case 'COMPLETED':
      case 'SIGNED':
        return 'status-completed';
      case 'DECLINED':
        return 'status-declined';
      case 'EXPIRED':
        return 'status-expired';
      case 'VOIDED':
        return 'status-voided';
      case 'DRAFT':
      default:
        return '';
    }
  }
}
