import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface SmsRequest {
  to: string;
  message: string;
  userId?: number;
  clientId?: number;
  caseId?: number;
  appointmentId?: number;
  templateCode?: string;
  channel?: string;
}

export interface SmsResponse {
  success: boolean;
  messageSid?: string;
  status?: string;
  errorMessage?: string;
  errorCode?: string;
  sentAt?: string;
  communicationLogId?: number;
}

export interface CommunicationLog {
  id: number;
  userId?: number;
  clientId?: number;
  caseId?: number;
  appointmentId?: number;
  channel: string;
  direction: string;
  toAddress: string;
  fromAddress: string;
  content?: string;
  subject?: string;
  status: string;
  twilioSid?: string;
  errorMessage?: string;
  errorCode?: string;
  templateCode?: string;
  sentByUserId?: number;
  sentByUserName?: string;
  durationSeconds?: number;
  cost?: number;
  costCurrency?: string;
  createdAt: string;
  deliveredAt?: string;
  updatedAt?: string;
  clientName?: string;
  caseNumber?: string;
  statusDisplay?: string;
  channelIcon?: string;
}

export interface CommunicationStats {
  byChannel: { [key: string]: number };
  totalSms: number;
  totalWhatsApp: number;
  totalEmail: number;
  totalFailed: number;
}

export interface PagedResponse<T> {
  logs: T[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
}

@Injectable({
  providedIn: 'root'
})
export class CommunicationService {

  private readonly apiUrl = `${environment.apiUrl}/api/communications`;

  constructor(private http: HttpClient) {}

  /**
   * Send an SMS message
   */
  sendSms(request: SmsRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/sms/send`, request);
  }

  /**
   * Send SMS using a template
   */
  sendTemplatedSms(to: string, templateCode: string, params: { [key: string]: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/sms/send-template`, {
      to,
      templateCode,
      params
    });
  }

  /**
   * Send a WhatsApp message
   */
  sendWhatsApp(request: SmsRequest): Observable<any> {
    request.channel = 'WHATSAPP';
    return this.http.post(`${this.apiUrl}/whatsapp/send`, request);
  }

  /**
   * Get communication logs by client
   */
  getLogsByClient(clientId: number, page: number = 0, size: number = 20): Observable<any> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get(`${this.apiUrl}/logs/client/${clientId}`, { params });
  }

  /**
   * Get communication logs by case
   */
  getLogsByCase(caseId: number, page: number = 0, size: number = 20): Observable<any> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get(`${this.apiUrl}/logs/case/${caseId}`, { params });
  }

  /**
   * Get recent communications for a client (last 30 days)
   */
  getRecentLogsByClient(clientId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/logs/client/${clientId}/recent`);
  }

  /**
   * Search communication logs
   */
  searchLogs(query: string, page: number = 0, size: number = 20): Observable<any> {
    const params = new HttpParams()
      .set('query', query)
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get(`${this.apiUrl}/logs/search`, { params });
  }

  /**
   * Get communication statistics
   */
  getStatistics(days: number = 30): Observable<any> {
    const params = new HttpParams().set('days', days.toString());
    return this.http.get(`${this.apiUrl}/stats`, { params });
  }

  /**
   * Get service status
   */
  getServiceStatus(): Observable<any> {
    return this.http.get(`${this.apiUrl}/status`);
  }

  /**
   * Format phone number for display
   */
  formatPhoneForDisplay(phone: string): string {
    if (!phone) return '';
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    // Format as (XXX) XXX-XXXX for US numbers
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
  }

  /**
   * Get status badge class based on status
   */
  getStatusBadgeClass(status: string): string {
    switch (status?.toUpperCase()) {
      case 'DELIVERED':
        return 'badge bg-success-subtle text-success';
      case 'SENT':
        return 'badge bg-info-subtle text-info';
      case 'QUEUED':
        return 'badge bg-warning-subtle text-warning';
      case 'FAILED':
      case 'UNDELIVERED':
        return 'badge bg-danger-subtle text-danger';
      default:
        return 'badge bg-secondary-subtle text-secondary';
    }
  }

  /**
   * Get channel icon class
   */
  getChannelIcon(channel: string): string {
    switch (channel?.toUpperCase()) {
      case 'SMS':
        return 'ri-smartphone-line';
      case 'WHATSAPP':
        return 'ri-whatsapp-line';
      case 'EMAIL':
        return 'ri-mail-line';
      case 'VOICE':
        return 'ri-phone-line';
      default:
        return 'ri-message-line';
    }
  }
}
