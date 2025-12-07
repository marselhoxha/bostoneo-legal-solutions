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

export interface DocumentSummary {
  documentId: string;
  title: string;
  signerName: string;
  signerEmail: string;
  status: string;
  statusMessage: string;
  createdDate: string;
}

export interface BoldSignDocument {
  documentId: string;
  messageTitle: string;
  status: string;
  createdDate: string;
  expiryDate?: string;
  senderName: string;
  senderEmail: string;
  signerName: string;
  signerEmail: string;
  signerStatus: string;
  lastActivityDate: string;
  lastActivityBy: string;
  lastActivityAction: string;
}

export interface BoldSignDocumentList {
  documents: BoldSignDocument[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface BoldSignDashboard {
  waitingForMe: number;
  waitingForOthers: number;
  needsAttention: number;
  completed: number;
  revoked: number;
  totalDocuments: number;
  sentThisMonth?: number;
  receivedThisMonth?: number;
  waitingForOthersList: DocumentSummary[];
  needsAttentionList: DocumentSummary[];
  recentActivityList: DocumentSummary[];
}

export interface DocumentProperties {
  documentId: string;
  messageTitle: string;
  documentDescription: string;
  status: string;
  statusDescription: string;        // e.g., "Needs to be signed by Jane Smith"
  createdDate: string;
  sentOn: string;                   // Formatted sent date
  lastActivityDate: string;
  lastActivityDescription: string;  // e.g., "Marsel Hoxha has viewed the document"
  expiryDate?: string;
  expiryDays: number;
  enableSigningOrder: boolean;
  files: string[];                  // List of file names
  brandName: string;
  senderDetail: {
    name: string;
    emailAddress: string;
  };
  signerDetails: {
    signerName: string;
    signerEmail: string;
    signerType: string;
    status: string;
    signedDate?: string;
    signerOrder: number;
    deliveryMode: string;           // Email, SMS, etc.
    lastActivity: string;           // Last activity date for this signer
    authenticationType: string;     // None, OTP, etc.
  }[];
  documentHistory: {
    activityBy: string;
    activityDate: string;
    activityAction: string;
    ipAddress: string;
    action: string;     // Short action type: "Sent", "Viewed", "Reminder", etc.
  }[];
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

  // ==================== Frontend Cache ====================
  // Cache to reduce API calls (BoldSign has 50/hr sandbox, 2000/hr production limit)
  private cache = new Map<string, { data: any; expiry: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private http: HttpClient) {}

  /**
   * Get cached data if valid, otherwise return null
   */
  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiry) {
      return cached.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  /**
   * Store data in cache with TTL
   */
  private setCache(key: string, data: any, ttlMs: number = this.CACHE_TTL_MS): void {
    this.cache.set(key, { data, expiry: Date.now() + ttlMs });
  }

  /**
   * Clear specific cache entry or all entries
   */
  clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

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

  /**
   * Get dashboard data from BoldSign API (cached for 5 minutes)
   */
  getDashboard(organizationId: number, forceRefresh: boolean = false): Observable<any> {
    const cacheKey = `dashboard-${organizationId}`;

    // Return cached data if available and not forcing refresh
    if (!forceRefresh) {
      const cached = this.getCached<any>(cacheKey);
      if (cached) {
        return new Observable(observer => {
          observer.next(cached);
          observer.complete();
        });
      }
    }

    // Fetch fresh data and cache it
    return new Observable(observer => {
      this.http.get(`${this.apiUrl}/dashboard/${organizationId}`).subscribe({
        next: (response) => {
          this.setCache(cacheKey, response);
          observer.next(response);
          observer.complete();
        },
        error: (err) => observer.error(err)
      });
    });
  }

  /**
   * Get document properties from BoldSign API
   */
  getDocumentProperties(boldsignDocumentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/document/${boldsignDocumentId}/properties`);
  }

  /**
   * Download audit trail PDF for a document
   */
  downloadAuditTrail(boldsignDocumentId: string): void {
    this.http.get(`${this.apiUrl}/document/${boldsignDocumentId}/audit-trail`, {
      responseType: 'blob'
    }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-trail-${boldsignDocumentId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Failed to download audit trail:', err);
      }
    });
  }

  /**
   * Download document by BoldSign document ID
   */
  downloadDocumentByBoldsignId(boldsignDocumentId: string): void {
    this.http.get(`${this.apiUrl}/document/${boldsignDocumentId}/download`, {
      responseType: 'blob'
    }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `document-${boldsignDocumentId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Failed to download document:', err);
      }
    });
  }

  /**
   * List documents directly from BoldSign API
   * Provides real-time data with optional status filtering
   */
  listBoldSignDocuments(
    status?: string,
    page: number = 1,
    pageSize: number = 20
  ): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (status && status !== 'All') {
      params = params.set('status', status);
    }

    return this.http.get(`${this.apiUrl}/documents/boldsign`, { params });
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
   * Get embedded URL for editing a template (cached for 5 minutes)
   */
  getEmbeddedEditTemplateUrl(boldsignTemplateId: string): Observable<any> {
    const cacheKey = `edit-template-${boldsignTemplateId}`;

    // Return cached URL if available
    const cached = this.getCached<any>(cacheKey);
    if (cached) {
      return new Observable(observer => {
        observer.next(cached);
        observer.complete();
      });
    }

    // Fetch fresh URL and cache it
    return new Observable(observer => {
      this.http.get(`${this.apiUrl}/embedded/edit-template/${boldsignTemplateId}`).subscribe({
        next: (response) => {
          this.setCache(cacheKey, response);
          observer.next(response);
          observer.complete();
        },
        error: (err) => observer.error(err)
      });
    });
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

  // ==================== Branding (Multi-Tenant) ====================

  /**
   * Get brand settings for an organization
   */
  getBrand(organizationId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/brand/${organizationId}`);
  }

  /**
   * Create or update brand for an organization
   */
  saveBrand(organizationId: number, brand: BrandSettings): Observable<any> {
    return this.http.post(`${this.apiUrl}/brand/${organizationId}`, brand);
  }

  /**
   * Delete brand for an organization
   */
  deleteBrand(organizationId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/brand/${organizationId}`);
  }
}

// Brand settings interface
export interface BrandSettings {
  brandId?: string;
  brandName?: string;
  brandLogoUrl?: string;
  brandLogoBase64?: string;     // Base64 encoded logo file for upload
  brandLogoFileName?: string;   // Logo file name (e.g., "logo.png")
  primaryColor?: string;
  backgroundColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  emailDisplayName?: string;
  disclaimerTitle?: string;
  disclaimerDescription?: string;
}
