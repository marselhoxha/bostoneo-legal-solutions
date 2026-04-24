import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { NgbDropdown, NgbDropdownToggle, NgbDropdownMenu } from '@ng-bootstrap/ng-bootstrap';
import { DocumentGenerationService, DocumentReviewState } from '../../../../services/document-generation.service';
import { RbacService } from '../../../../../../core/services/rbac.service';

/**
 * §6.1 Attorney Review Toolbar — ABA Opinion 512 compliance strip.
 *
 * Stands in the document-preview-panel header, renders a color-coded chip plus
 * one contextual primary action. Emits `stateChange` so the parent
 * AiWorkspaceComponent can update its `currentApprovalStatus` (which drives the
 * watermark) without the child owning any watermark logic.
 */
@Component({
  selector: 'app-document-review-toolbar',
  standalone: true,
  imports: [CommonModule, NgbDropdown, NgbDropdownToggle, NgbDropdownMenu],
  providers: [DatePipe],
  templateUrl: './document-review-toolbar.component.html',
  styleUrls: ['./document-review-toolbar.component.scss']
})
export class DocumentReviewToolbarComponent implements OnChanges {
  /** ID of the document currently displayed. Null when no doc is loaded. */
  @Input() documentId: number | null = null;
  /** Current approval_status. One of: draft, in_review, attorney_reviewed, changes_requested. */
  @Input() status: string | null | undefined = null;
  /** ISO timestamp of the last attorney action (approval or change request). */
  @Input() reviewedAt: string | null | undefined = null;
  /** Notes from the last attorney review cycle (required on request-changes). */
  @Input() reviewNotes: string | null | undefined = null;
  /** ISO timestamp of when review was last requested. */
  @Input() reviewRequestedAt: string | null | undefined = null;
  /** Human-readable reviewer name (hover tooltip). Parent resolves the user ID. */
  @Input() reviewerName: string | null = null;
  /** Whether the logged-in user is the doc owner. Drives revert/resubmit visibility. */
  @Input() isDocOwner: boolean = true;

  /** Fires after every successful state transition so the parent can update its local state. */
  @Output() stateChange = new EventEmitter<DocumentReviewState>();

  pending = false;
  showNotesExpanded = false;

  constructor(
    private documentService: DocumentGenerationService,
    private rbac: RbacService,
    private datePipe: DatePipe,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['status']) {
      this.showNotesExpanded = false;
    }
  }

  get normalizedStatus(): string {
    return this.status || 'draft';
  }

  get canApprove(): boolean {
    return this.rbac.isAttorneyLevel() || this.rbac.isAdmin();
  }

  get chipClass(): string {
    switch (this.normalizedStatus) {
      case 'in_review':         return 'bg-warning-subtle text-warning border-warning-subtle';
      case 'attorney_reviewed': return 'bg-success-subtle text-success border-success-subtle';
      case 'changes_requested': return 'bg-danger-subtle text-danger border-danger-subtle';
      default:                  return 'bg-secondary-subtle text-secondary border-secondary-subtle';
    }
  }

  get chipLabel(): string {
    switch (this.normalizedStatus) {
      case 'in_review':         return 'Awaiting Review';
      case 'attorney_reviewed': return 'Approved';
      case 'changes_requested': return 'Changes Requested';
      default:                  return 'Draft';
    }
  }

  get chipIcon(): string {
    switch (this.normalizedStatus) {
      case 'in_review':         return 'ri-time-line';
      case 'attorney_reviewed': return 'ri-checkbox-circle-line';
      case 'changes_requested': return 'ri-error-warning-line';
      default:                  return 'ri-file-edit-line';
    }
  }

  get chipTooltip(): string | null {
    const formatted = this.reviewedAt
      ? this.datePipe.transform(this.reviewedAt, 'MMM d, y \'at\' h:mm a')
      : null;
    switch (this.normalizedStatus) {
      case 'in_review':
        return this.reviewRequestedAt
          ? `Submitted ${this.datePipe.transform(this.reviewRequestedAt, 'MMM d, y')}`
          : null;
      case 'attorney_reviewed':
        if (this.reviewerName && formatted) return `${this.reviewerName} on ${formatted}`;
        if (formatted) return `Approved ${formatted}`;
        return null;
      case 'changes_requested':
        return formatted ? `Feedback provided ${formatted}` : null;
      default:
        return null;
    }
  }

  async requestReview(): Promise<void> {
    if (!this.documentId || this.pending) return;
    const Swal = (await import('sweetalert2')).default;
    const result = await Swal.fire({
      html: this.buildMasthead({
        icon: 'ri-send-plane-fill',
        title: 'Request attorney review?',
        subtitle: 'An attorney will be notified that this draft is ready for their review. You can keep editing until they respond.',
      }) + `
        <div class="lrm-body">
          <div class="lrm-callout">
            <i class="ri-information-line"></i>
            <div>The document status changes to <strong>Awaiting Review</strong>. The <strong>IN REVIEW</strong> watermark replaces DRAFT until the attorney approves or requests changes.</div>
          </div>
        </div>
      `,
      showCancelButton: true,
      showCloseButton: true,
      confirmButtonText: 'Send to attorney',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      customClass: { popup: 'legience-review-modal lrm-info' },
    });
    if (!result.isConfirmed) return;

    this.pending = true;
    this.documentService.requestAttorneyReview(this.documentId).subscribe({
      next: state => {
        this.stateChange.emit(state);
        this.pending = false;
        this.toast('info', 'Review requested', 'An attorney will review this document shortly.');
      },
      error: err => {
        this.pending = false;
        this.toast('danger', 'Could not request review', err?.error?.error || 'Please try again.');
      }
    });
  }

  /**
   * Self-approval path for attorneys drafting their own documents.
   * Skips the `in_review` state entirely — the attorney IS the reviewer of record
   * per ABA Opinion 512. Hits the same /approve endpoint as peer-approve.
   */
  async approveAsAuthor(): Promise<void> {
    if (!this.documentId || this.pending) return;
    const Swal = (await import('sweetalert2')).default;
    const result = await Swal.fire({
      html: this.buildMasthead({
        icon: 'ri-shield-check-fill',
        title: 'Approve as reviewing attorney?',
        subtitle: 'Sign off on this draft as the attorney of record. The DRAFT watermark clears immediately across the editor and exports.',
      }) + `
        <div class="lrm-body">
          <div class="lrm-callout">
            <i class="ri-scales-3-line"></i>
            <div>Per <strong>ABA Opinion 512</strong>, your approval records you as the reviewing attorney who has verified this output before client delivery.</div>
          </div>
          <label class="lrm-field-label">Optional — review notes for the audit trail</label>
        </div>
      `,
      input: 'textarea',
      inputPlaceholder: 'e.g., Verified statutes; reviewed damages figures; ready for client delivery.',
      inputAttributes: { 'aria-label': 'Review notes' },
      showCancelButton: true,
      showCloseButton: true,
      confirmButtonText: 'Approve & finalize',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      customClass: { popup: 'legience-review-modal lrm-success' },
    });
    if (!result.isConfirmed) return;

    this.pending = true;
    const notes = typeof result.value === 'string' ? result.value.trim() : '';
    this.documentService.approveDocument(this.documentId, notes || undefined).subscribe({
      next: state => {
        this.stateChange.emit(state);
        this.pending = false;
        this.toast('success', 'Document approved', 'Watermarks cleared. Ready for export.');
      },
      error: err => {
        this.pending = false;
        this.toast('danger', 'Could not approve', err?.error?.error || 'Please try again.');
      }
    });
  }

  async approve(): Promise<void> {
    if (!this.documentId || this.pending) return;
    const Swal = (await import('sweetalert2')).default;
    const result = await Swal.fire({
      html: this.buildMasthead({
        icon: 'ri-checkbox-circle-fill',
        title: 'Approve this document?',
        subtitle: 'Confirms the author\'s work meets your standard for client delivery. Watermarks clear; further edits will revert this back to draft.',
      }) + `
        <div class="lrm-body">
          <div class="lrm-callout">
            <i class="ri-quill-pen-line"></i>
            <div>Your name and timestamp are logged as the reviewing attorney. This is a record that satisfies <strong>ABA Opinion 512</strong> verification.</div>
          </div>
          <label class="lrm-field-label">Optional — attorney notes for the audit trail</label>
        </div>
      `,
      input: 'textarea',
      inputPlaceholder: 'e.g., Verified statutes; approved for client delivery.',
      inputAttributes: { 'aria-label': 'Approval notes' },
      showCancelButton: true,
      showCloseButton: true,
      confirmButtonText: 'Approve document',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      customClass: { popup: 'legience-review-modal lrm-success' },
    });
    if (!result.isConfirmed) return;

    this.pending = true;
    const notes = typeof result.value === 'string' ? result.value.trim() : '';
    this.documentService.approveDocument(this.documentId, notes || undefined).subscribe({
      next: state => {
        this.stateChange.emit(state);
        this.pending = false;
        this.toast('success', 'Document approved', 'The DRAFT watermark has been cleared.');
      },
      error: err => {
        this.pending = false;
        this.toast('danger', 'Could not approve', err?.error?.error || 'Please try again.');
      }
    });
  }

  async requestChanges(): Promise<void> {
    if (!this.documentId || this.pending) return;
    const Swal = (await import('sweetalert2')).default;
    const result = await Swal.fire({
      html: this.buildMasthead({
        icon: 'ri-error-warning-fill',
        title: 'Request changes',
        subtitle: 'Send feedback to the document owner. The document moves to CHANGES REQUESTED and your notes appear in the review toolbar.',
      }) + `
        <div class="lrm-body">
          <div class="lrm-callout">
            <i class="ri-chat-quote-line"></i>
            <div>Be specific. The author sees these notes inline until they resubmit. Good feedback saves a review cycle.</div>
          </div>
          <label class="lrm-field-label">Required — what needs to change?</label>
        </div>
      `,
      input: 'textarea',
      inputPlaceholder: 'e.g., Damages section needs updated medical figures; settlement range too aggressive on p.3.',
      inputAttributes: { 'aria-label': 'Change request notes' },
      inputValidator: (v) => (!v || !v.trim()) ? 'Notes are required so the author knows what to fix.' : undefined as any,
      showCancelButton: true,
      showCloseButton: true,
      confirmButtonText: 'Send feedback',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      customClass: { popup: 'legience-review-modal lrm-danger' },
    });
    if (!result.isConfirmed) return;
    const notes = typeof result.value === 'string' ? result.value.trim() : '';
    if (!notes) return;

    this.pending = true;
    this.documentService.requestChanges(this.documentId, notes).subscribe({
      next: state => {
        this.stateChange.emit(state);
        this.pending = false;
        this.toast('info', 'Feedback sent', 'The document owner has been notified.');
      },
      error: err => {
        this.pending = false;
        this.toast('danger', 'Could not send feedback', err?.error?.error || 'Please try again.');
      }
    });
  }

  async revertToDraft(): Promise<void> {
    if (!this.documentId || this.pending) return;
    const Swal = (await import('sweetalert2')).default;
    const result = await Swal.fire({
      html: this.buildMasthead({
        icon: 'ri-arrow-go-back-fill',
        title: 'Revert to draft?',
        subtitle: 'This removes the approved status. The DRAFT watermark returns and you\'ll need to request attorney review again before the document is client-ready.',
      }) + `
        <div class="lrm-body">
          <div class="lrm-callout">
            <i class="ri-alert-line"></i>
            <div>The previous reviewer\'s approval is preserved in the audit log, but the document is no longer marked as client-ready.</div>
          </div>
        </div>
      `,
      showCancelButton: true,
      showCloseButton: true,
      confirmButtonText: 'Yes, revert',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      customClass: { popup: 'legience-review-modal lrm-warning' },
    });
    if (!result.isConfirmed) return;

    this.pending = true;
    this.documentService.revertDocumentToDraft(this.documentId).subscribe({
      next: state => {
        this.stateChange.emit(state);
        this.pending = false;
        this.toast('warning', 'Reverted to draft', 'The DRAFT watermark is back — request review when ready.');
      },
      error: err => {
        this.pending = false;
        this.toast('danger', 'Could not revert', err?.error?.error || 'Please try again.');
      }
    });
  }

  /**
   * Builds the shared masthead markup (icon + title + subtitle) so every review
   * modal gets the same polished header.
   */
  private buildMasthead(opts: { icon: string; title: string; subtitle: string }): string {
    const safeTitle = this.escapeHtml(opts.title);
    const safeSubtitle = this.escapeHtml(opts.subtitle);
    return `
      <div class="lrm-masthead">
        <div class="lrm-icon-wrap"><i class="${opts.icon}"></i></div>
        <h3 class="lrm-title">${safeTitle}</h3>
        <p class="lrm-subtitle">${safeSubtitle}</p>
      </div>
    `;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  toggleNotes(): void {
    this.showNotesExpanded = !this.showNotesExpanded;
  }

  private async toast(variant: 'success' | 'warning' | 'danger' | 'info', title: string, text: string): Promise<void> {
    const Swal = (await import('sweetalert2')).default;
    const icon = this.toastIcon(variant);
    Swal.fire({
      html: `
        <div class="ltoast" role="status">
          <div class="ltoast-icon" aria-hidden="true"><i class="${icon}"></i></div>
          <div class="ltoast-title">${this.escapeHtml(title)}</div>
          <div class="ltoast-text">${this.escapeHtml(text)}</div>
        </div>
      `,
      toast: true,
      position: 'top-end',
      timer: 3500,
      showConfirmButton: false,
      timerProgressBar: true,
      customClass: { popup: `legience-toast lrm-${variant}` },
    });
  }

  private toastIcon(variant: 'success' | 'warning' | 'danger' | 'info'): string {
    switch (variant) {
      case 'success': return 'ri-checkbox-circle-fill';
      case 'warning': return 'ri-arrow-go-back-fill';
      case 'danger':  return 'ri-error-warning-fill';
      case 'info':    return 'ri-send-plane-fill';
    }
  }
}
