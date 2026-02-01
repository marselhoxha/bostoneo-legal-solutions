import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../../../../environments/environment';

/**
 * Resolved recipient information for document requests
 */
export interface DocumentRecipient {
  recipientType: string;
  recipientName: string;
  recipientSource: string;
  email: string | null;
  phone: string | null;
  fax: string | null;
  availableChannels: string[];
  sourceId: number | null;
  sourceName: string | null;
  providerDirectoryId: number | null;
  suggestedTemplateCode: string | null;
  resolved: boolean;
  resolutionMessage: string;
  documentType: string;
  documentSubtype: string | null;
}

/**
 * Document request log entry
 */
export interface DocumentRequestLog {
  id: number;
  checklistItemId: number;
  caseId: number;
  recipientType: string;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  recipientFax: string;
  channel: string;
  channelStatus: string;
  externalMessageId: string;
  templateId: number;
  templateCode: string;
  templateName: string;
  requestSubject: string;
  requestBody: string;
  documentFee: number;
  feeStatus: string;
  sentAt: string;
  sentBy: number;
  sentByName: string;
  createdAt: string;
  documentTypeName: string;
  documentSubtype: string;
}

/**
 * Document request template
 */
export interface DocumentRequestTemplate {
  id: number;
  organizationId: number | null;
  templateCode: string;
  templateName: string;
  documentType: string;
  recipientType: string;
  emailSubject: string;
  emailBody: string;
  smsBody: string;
  isActive: boolean;
  isSystem: boolean;
  previewSubject?: string;
  previewBody?: string;
}

/**
 * Request to send a document request
 */
export interface SendDocumentRequest {
  recipientType: string;
  recipientName?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  recipientFax?: string;
  channel: string;
  templateId?: number;
  templateCode?: string;
  customSubject?: string;
  customBody?: string;
  clientName?: string;
  clientDob?: string;
  treatmentDates?: string;
  accidentDate?: string;
  claimNumber?: string;
  adjusterName?: string;
  accountNumber?: string;
  reportNumber?: string;
  accidentLocation?: string;
  defendantName?: string;
  witnessName?: string;
  requestedDocuments?: string;
  reportFee?: string;
  documentFee?: number;
  saveToDirectory?: boolean;
  providerDirectoryId?: number;
  scheduleFollowUp?: boolean;
  followUpDays?: number;
}

/**
 * Bulk document request
 */
export interface BulkDocumentRequest {
  checklistItemIds: number[];
  defaultChannel?: string;
}

/**
 * Bulk request result
 */
export interface BulkRequestResult {
  checklistItemId: number;
  documentType: string;
  documentSubtype: string;
  success: boolean;
  channel: string;
  recipientName: string;
  recipientEmail: string;
  errorMessage: string;
  requestLogId: number;
}

/**
 * Bulk request response
 */
export interface BulkDocumentRequestResponse {
  checklistItemIds: number[];
  defaultChannel: string;
  totalItems: number;
  successCount: number;
  failedCount: number;
  results: BulkRequestResult[];
}

/**
 * Bulk request preview - analysis before sending
 */
export interface BulkRequestPreview {
  totalItems: number;
  resolvedCount: number;
  unresolvedCount: number;
  recipientGroups: RecipientGroup[];
  unresolvedItems: UnresolvedItem[];
  warnings: string[];
}

/**
 * A group of checklist items sharing the same recipient
 */
export interface RecipientGroup {
  groupKey: string;
  recipientType: string;
  recipientName: string;
  email: string | null;
  phone: string | null;
  fax: string | null;
  availableChannels: string[];
  suggestedChannel: string;
  items: GroupedChecklistItem[];
  providerDirectoryId: number | null;
  recipientSource: string;
}

/**
 * A checklist item within a recipient group
 */
export interface GroupedChecklistItem {
  checklistItemId: number;
  documentType: string;
  documentSubtype: string | null;
  providerName: string | null;
  notes: string | null;
  alreadyRequested: boolean;
  lastRequestedDate: string | null;
  requestCount: number;
}

/**
 * An item that couldn't be automatically resolved
 */
export interface UnresolvedItem {
  checklistItemId: number;
  documentType: string;
  documentSubtype: string | null;
  providerName: string | null;
  recipientType: string;
  resolutionMessage: string;
  suggestedName: string | null;
  suggestedTemplateCode: string | null;
}

/**
 * Submit DTO for confirmed bulk requests
 */
export interface BulkRequestSubmit {
  checklistItemIds: number[];
  skipItemIds?: number[];
  recipientOverrides?: RecipientOverride[];
  channelOverrides?: { [groupKey: string]: string };
  defaultChannel?: string;
  saveNewContacts?: boolean;
}

/**
 * Manual recipient override for unresolved items
 */
export interface RecipientOverride {
  checklistItemId: number;
  recipientName: string;
  email?: string;
  phone?: string;
  fax?: string;
  recipientType?: string;
  saveToDirectory?: boolean;
  providerDirectoryName?: string;
}

/**
 * Result of confirmed bulk send
 */
export interface BulkSendResult {
  totalItems: number;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
  emailsSent: number;
  smsSent: number;
  groupResults: GroupSendResult[];
  errors: string[];
}

/**
 * Result for a single recipient group
 */
export interface GroupSendResult {
  groupKey: string;
  recipientName: string;
  channel: string;
  success: boolean;
  errorMessage?: string;
  checklistItemIds: number[];
  requestLogId?: number;
}

/**
 * Request statistics
 */
export interface RequestStats {
  totalRequests: number;
  sentCount: number;
  failedCount: number;
  totalPaidFees: number;
  totalPendingFees: number;
  byChannel: { [key: string]: number };
}

/**
 * Service for PI Document Request operations.
 * Handles recipient resolution, request sending, history, and templates.
 */
@Injectable({
  providedIn: 'root'
})
export class PIDocumentRequestService {

  private baseUrl = `${environment.apiUrl}/api/pi`;

  constructor(private http: HttpClient) {}

  // ========================
  // Recipient Resolution
  // ========================

  /**
   * Resolve recipient for a document request based on document type.
   */
  resolveRecipient(caseId: number, checklistItemId: number): Observable<DocumentRecipient> {
    return this.http.get<any>(
      `${this.baseUrl}/cases/${caseId}/document-requests/${checklistItemId}/resolve-recipient`
    ).pipe(
      map(response => response.recipient)
    );
  }

  // ========================
  // Send Requests
  // ========================

  /**
   * Send a document request through the specified channel.
   */
  sendRequest(caseId: number, checklistItemId: number, request: SendDocumentRequest): Observable<DocumentRequestLog> {
    return this.http.post<any>(
      `${this.baseUrl}/cases/${caseId}/document-requests/${checklistItemId}/send`,
      request
    ).pipe(
      map(response => response.requestLog)
    );
  }

  /**
   * Send bulk document requests for multiple checklist items.
   */
  sendBulkRequests(caseId: number, request: BulkDocumentRequest): Observable<BulkDocumentRequestResponse> {
    return this.http.post<any>(
      `${this.baseUrl}/cases/${caseId}/document-requests/bulk-send`,
      request
    ).pipe(
      map(response => response.bulkResult)
    );
  }

  /**
   * Preview bulk requests before sending.
   * Analyzes selected items, resolves recipients, and groups by recipient.
   */
  previewBulkRequests(caseId: number, checklistItemIds: number[]): Observable<BulkRequestPreview> {
    return this.http.post<any>(
      `${this.baseUrl}/cases/${caseId}/document-requests/bulk-preview`,
      { checklistItemIds }
    ).pipe(
      map(response => response.preview)
    );
  }

  /**
   * Send confirmed bulk requests with user overrides.
   * Groups items by recipient and sends consolidated communications.
   */
  sendConfirmedBulkRequests(caseId: number, request: BulkRequestSubmit): Observable<BulkSendResult> {
    return this.http.post<any>(
      `${this.baseUrl}/cases/${caseId}/document-requests/bulk-send-confirmed`,
      request
    ).pipe(
      map(response => response.result)
    );
  }

  // ========================
  // Request History
  // ========================

  /**
   * Get request history for a specific checklist item.
   */
  getRequestHistory(caseId: number, checklistItemId: number): Observable<DocumentRequestLog[]> {
    return this.http.get<any>(
      `${this.baseUrl}/cases/${caseId}/document-requests/${checklistItemId}/history`
    ).pipe(
      map(response => response.history)
    );
  }

  /**
   * Get all request history for a case.
   */
  getCaseRequestHistory(caseId: number): Observable<DocumentRequestLog[]> {
    return this.http.get<any>(
      `${this.baseUrl}/cases/${caseId}/document-requests/history`
    ).pipe(
      map(response => response.history)
    );
  }

  /**
   * Get request statistics for a case.
   */
  getCaseRequestStats(caseId: number): Observable<RequestStats> {
    return this.http.get<any>(
      `${this.baseUrl}/cases/${caseId}/document-requests/stats`
    ).pipe(
      map(response => response.stats)
    );
  }

  // ========================
  // Templates
  // ========================

  /**
   * Get all available templates.
   */
  getTemplates(documentType?: string): Observable<DocumentRequestTemplate[]> {
    let url = `${this.baseUrl}/document-request-templates`;
    if (documentType) {
      url += `?documentType=${documentType}`;
    }
    return this.http.get<any>(url).pipe(
      map(response => response.templates)
    );
  }

  /**
   * Get a specific template by ID.
   */
  getTemplateById(templateId: number): Observable<DocumentRequestTemplate> {
    return this.http.get<any>(
      `${this.baseUrl}/document-request-templates/${templateId}`
    ).pipe(
      map(response => response.template)
    );
  }

  /**
   * Preview a template with variables replaced.
   */
  previewTemplate(caseId: number, checklistItemId: number, templateId: number): Observable<DocumentRequestTemplate> {
    return this.http.get<any>(
      `${this.baseUrl}/cases/${caseId}/document-requests/${checklistItemId}/preview-template/${templateId}`
    ).pipe(
      map(response => response.template)
    );
  }

  // ========================
  // Fee Tracking
  // ========================

  /**
   * Update fee status for a request log entry.
   */
  updateFeeStatus(requestLogId: number, feeStatus: string): Observable<DocumentRequestLog> {
    return this.http.patch<any>(
      `${this.baseUrl}/document-request-logs/${requestLogId}/fee-status`,
      { feeStatus }
    ).pipe(
      map(response => response.requestLog)
    );
  }

  // ========================
  // Helper Methods
  // ========================

  /**
   * Get channel icon class
   */
  getChannelIcon(channel: string): string {
    const icons: { [key: string]: string } = {
      'EMAIL': 'ri-mail-line',
      'SMS': 'ri-smartphone-line',
      'FAX': 'ri-printer-line',
      'IN_APP': 'ri-notification-line'
    };
    return icons[channel] || 'ri-send-plane-line';
  }

  /**
   * Get channel display name
   */
  getChannelLabel(channel: string): string {
    const labels: { [key: string]: string } = {
      'EMAIL': 'Email',
      'SMS': 'SMS',
      'FAX': 'Fax',
      'IN_APP': 'In-App'
    };
    return labels[channel] || channel;
  }

  /**
   * Get channel status color
   */
  getChannelStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'SENT': 'success',
      'DELIVERED': 'success',
      'FAILED': 'danger',
      'BOUNCED': 'warning',
      'PENDING': 'info'
    };
    return colors[status] || 'secondary';
  }

  /**
   * Get fee status color
   */
  getFeeStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'PAID': 'success',
      'PENDING': 'warning',
      'WAIVED': 'info'
    };
    return colors[status] || 'secondary';
  }

  /**
   * Get recipient type display name
   */
  getRecipientTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'MEDICAL_PROVIDER': 'Medical Provider',
      'BILLING_DEPT': 'Billing Department',
      'INSURANCE_ADJUSTER': 'Insurance Adjuster',
      'EMPLOYER_HR': 'Employer HR',
      'POLICE_DEPT': 'Police Department',
      'CLIENT': 'Client',
      'WITNESS': 'Witness'
    };
    return labels[type] || type;
  }
}
