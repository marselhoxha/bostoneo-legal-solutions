import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

// ==================== Interfaces ====================

export interface SignatureRequest {
  id: number;
  organizationId: number;
  boldsignDocumentId?: string;
  caseId?: number;
  caseName?: string;
  clientId?: number;
  clientName?: string;
  documentId?: number;
  title: string;
  message?: string;
  fileName?: string;
  fileUrl?: string;
  status: SignatureStatus;
  statusDisplay?: string;
  signerName: string;
  signerEmail: string;
  signerPhone?: string;
  additionalSigners?: Signer[];
  reminderEmail?: boolean;
  reminderSms?: boolean;
  reminderWhatsapp?: boolean;
  lastReminderSentAt?: string;
  reminderCount?: number;
  expiresAt?: string;
  sentAt?: string;
  viewedAt?: string;
  signedAt?: string;
  completedAt?: string;
  declinedAt?: string;
  declineReason?: string;
  createdBy?: number;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
  signedDocumentUrl?: string;
  embeddedSigningUrl?: string;
  daysUntilExpiry?: number;
  canSendReminder?: boolean;
  isPending?: boolean;
  isCompleted?: boolean;
}

export interface Signer {
  name: string;
  email: string;
  phone?: string;
  order?: number;
  status?: string;
  signedAt?: string;
}

export interface CreateSignatureRequest {
  organizationId: number;
  caseId?: number;
  clientId?: number;
  documentId?: number;
  templateId?: number;
  title: string;
  message?: string;
  fileName?: string;
  fileUrl?: string;
  fileBase64?: string;
  signerName: string;
  signerEmail: string;
  signerPhone?: string;
  additionalSigners?: SignerInput[];
  reminderEmail?: boolean;
  reminderSms?: boolean;
  reminderWhatsapp?: boolean;
  expiryDays?: number;
  sendImmediately?: boolean;
}

export interface SignerInput {
  name: string;
  email: string;
  phone?: string;
  order?: number;
}

export interface SignatureTemplate {
  id: number;
  organizationId: number;
  boldsignTemplateId?: string;
  name: string;
  description?: string;
  category?: string;
  fileName?: string;
  fileUrl?: string;
  fieldConfig?: string;
  defaultExpiryDays?: number;
  defaultReminderEmail?: boolean;
  defaultReminderSms?: boolean;
  isActive?: boolean;
  isGlobal?: boolean;
  createdBy?: number;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SignatureAuditLog {
  id: number;
  organizationId: number;
  signatureRequestId: number;
  signatureRequestTitle?: string;
  eventType: string;
  eventTypeDisplay?: string;
  eventData?: string;
  actorType: 'SYSTEM' | 'USER' | 'SIGNER' | 'WEBHOOK';
  actorId?: number;
  actorName?: string;
  actorEmail?: string;
  channel?: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'WEB' | 'API';
  ipAddress?: string;
  userAgent?: string;
  createdAt?: string;
}

export interface SignatureStats {
  totalRequests: number;
  pendingRequests: number;
  completedRequests: number;
  declinedRequests: number;
  expiredRequests: number;
  completedThisMonth: number;
  sentThisMonth: number;
  completionRate: number;
}

export type SignatureStatus =
  | 'DRAFT'
  | 'SENT'
  | 'VIEWED'
  | 'PARTIALLY_SIGNED'
  | 'SIGNED'
  | 'COMPLETED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'VOIDED';

export interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
}

@Injectable({
  providedIn: 'root'
})
export class SignatureService {

  private readonly apiUrl = `${environment.apiUrl}/api/signatures`;

  constructor(private http: HttpClient) {}

  // ==================== Signature Requests ====================

  /**
   * Create and send a new signature request
   */
  createSignatureRequest(request: CreateSignatureRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/requests`, request);
  }

  /**
   * Send a draft signature request
   */
  sendSignatureRequest(requestId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/requests/${requestId}/send`, {});
  }

  /**
   * Get signature request by ID
   */
  getSignatureRequest(requestId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/requests/${requestId}`);
  }

  /**
   * Get signature requests for an organization
   */
  getSignatureRequestsByOrganization(
    organizationId: number,
    page: number = 0,
    size: number = 20,
    sortBy: string = 'createdAt',
    sortDir: string = 'desc'
  ): Observable<any> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('sortDir', sortDir);
    return this.http.get(`${this.apiUrl}/requests/organization/${organizationId}`, { params });
  }

  /**
   * Get signature requests for a case
   */
  getSignatureRequestsByCase(caseId: number, organizationId: number, page: number = 0, size: number = 20): Observable<any> {
    const params = new HttpParams()
      .set('organizationId', organizationId.toString())
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get(`${this.apiUrl}/requests/case/${caseId}`, { params });
  }

  /**
   * Get signature requests for a client
   */
  getSignatureRequestsByClient(clientId: number, organizationId: number, page: number = 0, size: number = 20): Observable<any> {
    const params = new HttpParams()
      .set('organizationId', organizationId.toString())
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get(`${this.apiUrl}/requests/client/${clientId}`, { params });
  }

  /**
   * Search signature requests
   */
  searchSignatureRequests(organizationId: number, query: string, page: number = 0, size: number = 20): Observable<any> {
    const params = new HttpParams()
      .set('organizationId', organizationId.toString())
      .set('query', query)
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get(`${this.apiUrl}/requests/search`, { params });
  }

  /**
   * Void/cancel a signature request
   */
  voidSignatureRequest(requestId: number, reason: string): Observable<any> {
    const params = new HttpParams().set('reason', reason);
    return this.http.post(`${this.apiUrl}/requests/${requestId}/void`, {}, { params });
  }

  /**
   * Send a reminder for a signature request
   */
  sendReminder(requestId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/requests/${requestId}/remind`, {});
  }

  /**
   * Get embedded signing URL for a signer
   */
  getEmbeddedSigningUrl(requestId: number, signerEmail: string): Observable<any> {
    const params = new HttpParams().set('signerEmail', signerEmail);
    return this.http.get(`${this.apiUrl}/requests/${requestId}/signing-url`, { params });
  }

  /**
   * Download signed document
   */
  downloadSignedDocument(requestId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/requests/${requestId}/download`, {
      responseType: 'blob'
    });
  }

  /**
   * Refresh status from BoldSign
   */
  refreshStatus(requestId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/requests/${requestId}/refresh`, {});
  }

  // ==================== Templates ====================

  /**
   * Get all templates for an organization
   */
  getTemplates(organizationId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/templates/organization/${organizationId}`);
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(organizationId: number, category: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/templates/organization/${organizationId}/category/${category}`);
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/templates/${templateId}`);
  }

  /**
   * Create a new template
   */
  createTemplate(template: Partial<SignatureTemplate>): Observable<any> {
    return this.http.post(`${this.apiUrl}/templates`, template);
  }

  /**
   * Update a template
   */
  updateTemplate(templateId: number, template: Partial<SignatureTemplate>): Observable<any> {
    return this.http.put(`${this.apiUrl}/templates/${templateId}`, template);
  }

  /**
   * Delete a template
   */
  deleteTemplate(templateId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/templates/${templateId}`);
  }

  /**
   * Get template categories
   */
  getTemplateCategories(organizationId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/templates/categories/${organizationId}`);
  }

  // ==================== Audit Logs ====================

  /**
   * Get audit logs for a signature request
   */
  getAuditLogs(signatureRequestId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/requests/${signatureRequestId}/audit`);
  }

  /**
   * Get audit logs for an organization
   */
  getAuditLogsByOrganization(organizationId: number, page: number = 0, size: number = 50): Observable<any> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get(`${this.apiUrl}/audit/organization/${organizationId}`, { params });
  }

  // ==================== Statistics ====================

  /**
   * Get signature statistics for an organization
   */
  getStatistics(organizationId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/stats/organization/${organizationId}`);
  }

  // ==================== Embedded URLs ====================

  /**
   * Get embedded URL for full document preparation UI
   * This returns a URL that can be loaded in an iframe for the complete BoldSign document creation experience
   */
  getEmbeddedSendDocumentUrl(
    organizationId: number,
    options?: {
      title?: string;
      signerName?: string;
      signerEmail?: string;
      message?: string;
      fileName?: string;
      fileBase64?: string;
      redirectUrl?: string;
      showToolbar?: boolean;
      sendViewOption?: 'PreparePage' | 'FillingPage';
      locale?: string;
      clientId?: number;
      caseId?: string;
    }
  ): Observable<any> {
    const body: any = {
      organizationId,
      title: options?.title,
      signerName: options?.signerName,
      signerEmail: options?.signerEmail,
      message: options?.message,
      fileName: options?.fileName,
      fileBase64: options?.fileBase64,
      redirectUrl: options?.redirectUrl,
      showToolbar: options?.showToolbar ?? true,
      sendViewOption: options?.sendViewOption || 'PreparePage',
      locale: options?.locale || 'EN',
      clientId: options?.clientId,
      caseId: options?.caseId
    };

    return this.http.post(`${this.apiUrl}/embedded/send-document`, body);
  }

  /**
   * Get embedded URL for template creation UI
   * Now accepts file data for proper template creation
   */
  getEmbeddedCreateTemplateUrl(
    organizationId: number,
    options?: {
      title?: string;
      description?: string;
      category?: string;
      fileName?: string;
      fileBase64?: string;
      redirectUrl?: string;
      showToolbar?: boolean;
      viewOption?: 'PreparePage' | 'FillingPage';
      locale?: string;
    }
  ): Observable<any> {
    // If file is provided, use POST with body
    if (options?.fileBase64) {
      const body: any = {
        organizationId,
        title: options.title || 'New Template',
        description: options.description || '',
        category: options.category || 'General',
        fileName: options.fileName,
        fileBase64: options.fileBase64,
        redirectUrl: options.redirectUrl,
        showToolbar: options.showToolbar ?? true,
        viewOption: options.viewOption || 'PreparePage',
        locale: options.locale || 'EN'
      };
      return this.http.post(`${this.apiUrl}/embedded/create-template`, body);
    }

    // Fallback to GET (will use placeholder PDF on backend)
    let params = new HttpParams().set('organizationId', organizationId.toString());
    if (options?.title) params = params.set('title', options.title);
    if (options?.description) params = params.set('description', options.description);
    if (options?.redirectUrl) params = params.set('redirectUrl', options.redirectUrl);
    if (options?.showToolbar !== undefined) params = params.set('showToolbar', options.showToolbar.toString());
    if (options?.viewOption) params = params.set('viewOption', options.viewOption);
    if (options?.locale) params = params.set('locale', options.locale);

    return this.http.get(`${this.apiUrl}/embedded/create-template`, { params });
  }

  /**
   * Get embedded URL for editing a template
   */
  getEmbeddedEditTemplateUrl(boldsignTemplateId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/embedded/edit-template/${boldsignTemplateId}`);
  }

  /**
   * Get embedded URL for sending document from a template
   */
  getEmbeddedSendFromTemplateUrl(
    boldsignTemplateId: string,
    organizationId: number,
    options?: {
      signerName?: string;
      signerEmail?: string;
      redirectUrl?: string;
      showToolbar?: boolean;
      locale?: string;
    }
  ): Observable<any> {
    let params = new HttpParams().set('organizationId', organizationId.toString());
    if (options?.signerName) params = params.set('signerName', options.signerName);
    if (options?.signerEmail) params = params.set('signerEmail', options.signerEmail);
    if (options?.redirectUrl) params = params.set('redirectUrl', options.redirectUrl);
    if (options?.showToolbar !== undefined) params = params.set('showToolbar', options.showToolbar.toString());
    if (options?.locale) params = params.set('locale', options.locale);

    return this.http.post(`${this.apiUrl}/embedded/send-from-template/${boldsignTemplateId}`, {}, { params });
  }

  // ==================== Helper Methods ====================

  /**
   * Get status badge class based on status
   */
  getStatusBadgeClass(status: SignatureStatus): string {
    switch (status) {
      case 'COMPLETED':
      case 'SIGNED':
        return 'badge bg-success-subtle text-success';
      case 'SENT':
        return 'badge bg-info-subtle text-info';
      case 'VIEWED':
      case 'PARTIALLY_SIGNED':
        return 'badge bg-warning-subtle text-warning';
      case 'DRAFT':
        return 'badge bg-secondary-subtle text-secondary';
      case 'DECLINED':
      case 'EXPIRED':
      case 'VOIDED':
        return 'badge bg-danger-subtle text-danger';
      default:
        return 'badge bg-secondary-subtle text-secondary';
    }
  }

  /**
   * Get status icon
   */
  getStatusIcon(status: SignatureStatus): string {
    switch (status) {
      case 'COMPLETED':
      case 'SIGNED':
        return 'ri-check-double-line';
      case 'SENT':
        return 'ri-send-plane-line';
      case 'VIEWED':
        return 'ri-eye-line';
      case 'PARTIALLY_SIGNED':
        return 'ri-edit-line';
      case 'DRAFT':
        return 'ri-draft-line';
      case 'DECLINED':
        return 'ri-close-circle-line';
      case 'EXPIRED':
        return 'ri-time-line';
      case 'VOIDED':
        return 'ri-forbid-line';
      default:
        return 'ri-file-line';
    }
  }

  /**
   * Get category icon
   */
  getCategoryIcon(category: string): string {
    switch (category?.toUpperCase()) {
      case 'RETAINER':
        return 'ri-briefcase-line';
      case 'NDA':
        return 'ri-shield-keyhole-line';
      case 'SETTLEMENT':
        return 'ri-scales-3-line';
      case 'CONSENT':
        return 'ri-checkbox-circle-line';
      case 'POA':
        return 'ri-user-star-line';
      case 'FEE':
        return 'ri-money-dollar-circle-line';
      case 'RELEASE':
        return 'ri-file-unlock-line';
      case 'REPRESENTATION':
        return 'ri-team-line';
      default:
        return 'ri-file-text-line';
    }
  }

  /**
   * Format status for display
   */
  formatStatus(status: SignatureStatus): string {
    switch (status) {
      case 'DRAFT': return 'Draft';
      case 'SENT': return 'Sent';
      case 'VIEWED': return 'Viewed';
      case 'PARTIALLY_SIGNED': return 'Partially Signed';
      case 'SIGNED': return 'Signed';
      case 'COMPLETED': return 'Completed';
      case 'DECLINED': return 'Declined';
      case 'EXPIRED': return 'Expired';
      case 'VOIDED': return 'Voided';
      default: return status;
    }
  }

  /**
   * Check if request can be reminded
   */
  canRemind(request: SignatureRequest): boolean {
    return request.canSendReminder === true ||
           ['SENT', 'VIEWED', 'PARTIALLY_SIGNED'].includes(request.status);
  }

  /**
   * Check if request is in a final state
   */
  isFinalState(status: SignatureStatus): boolean {
    return ['COMPLETED', 'SIGNED', 'DECLINED', 'EXPIRED', 'VOIDED'].includes(status);
  }

  /**
   * Download document as file
   */
  downloadAsFile(requestId: number, fileName: string): void {
    this.downloadSignedDocument(requestId).subscribe(blob => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || 'signed-document.pdf';
      link.click();
      window.URL.revokeObjectURL(url);
    });
  }

  // ==================== Sync ====================

  /**
   * Sync documents from BoldSign to local database
   */
  syncDocuments(organizationId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/sync/documents/${organizationId}`, {});
  }

  /**
   * Sync templates from BoldSign to local database
   */
  syncTemplates(organizationId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/sync/templates/${organizationId}`, {});
  }
}
