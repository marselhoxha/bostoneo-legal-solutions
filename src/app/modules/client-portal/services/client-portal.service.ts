import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface ClientDashboard {
  clientName: string;
  clientEmail: string;
  clientImageUrl: string;
  totalCases: number;
  activeCases: number;
  closedCases: number;
  totalDocuments: number;
  recentDocuments: number;
  upcomingAppointments: number;
  nextAppointment: ClientAppointment | null;
  unreadMessages: number;
  totalOutstanding: number;
  pendingInvoices: number;
  recentActivity: ClientActivity[];
  recentCases: ClientCase[];
}

export interface ClientProfile {
  id: number;
  userId: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  type: string;
  status: string;
  imageUrl: string;
}

export interface ClientCase {
  id: number;
  caseNumber: string;
  title: string;
  type: string;
  caseType?: string; // alias for type
  status: string;
  description: string;
  attorneyName: string;
  leadAttorney?: string; // alias for attorneyName
  openDate: string;
  filingDate?: string; // alias for openDate
  lastUpdated: string;
  documentCount: number;
  upcomingAppointments: number;
  nextHearingDate?: string;
  priority?: string;
}

export interface ClientDocument {
  id: number;
  caseId: number;
  caseNumber: string;
  caseName: string;
  title: string;
  fileName: string;
  fileType: string;
  category: string;
  description: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  canDownload: boolean;
}

export interface ClientAppointment {
  id: number;
  caseId: number;
  caseNumber: string;
  title: string;
  description: string;
  type: string;
  status: string;
  startTime: string;
  endTime: string;
  location: string;
  attorneyName: string;
  isVirtual: boolean;
  meetingLink: string;
}

export interface ClientAppointmentRequest {
  caseId: number;
  title: string;
  description: string;
  type: string;
  preferredDateTime: string;
  alternativeDateTime: string;
  preferVirtual: boolean;
  notes: string;
}

export interface ClientMessageThread {
  id: number;
  caseId: number;
  caseNumber: string;
  subject: string;
  lastMessage: string;
  lastSenderName: string;
  lastMessageAt: string;
  unreadCount: number;
  totalMessages: number;
  status: string;
}

export interface ClientMessage {
  id: number;
  threadId: number;
  senderName: string;
  senderType: string;
  content: string;
  sentAt: string;
  isRead: boolean;
  hasAttachment: boolean;
  attachmentName: string;
}

export interface ClientInvoice {
  id: number;
  invoiceNumber: string;
  caseId: number;
  caseNumber: string;
  caseName: string;
  amount: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
  invoiceDate: string;
  dueDate: string;
  description: string;
  canPayOnline: boolean;
  paymentUrl: string;
}

export interface ClientActivity {
  id: number;
  caseId: number;
  caseNumber: string;
  activityType: string;
  title: string;
  description: string;
  timestamp: string;
  performedBy: string;
}

export interface PagedResponse<T> {
  content: T[];
  page: number;
  totalPages: number;
  totalElements: number;
}

@Injectable({
  providedIn: 'root'
})
export class ClientPortalService {

  private readonly apiUrl = `${environment.apiUrl}/api/client-portal`;

  constructor(private http: HttpClient) {}

  // =====================================================
  // DASHBOARD
  // =====================================================

  getDashboard(): Observable<ClientDashboard> {
    return this.http.get<any>(`${this.apiUrl}/dashboard`).pipe(
      map(response => response.data.dashboard)
    );
  }

  // =====================================================
  // PROFILE
  // =====================================================

  getProfile(): Observable<ClientProfile> {
    return this.http.get<any>(`${this.apiUrl}/profile`).pipe(
      map(response => response.data.profile)
    );
  }

  updateProfile(profile: Partial<ClientProfile>): Observable<ClientProfile> {
    return this.http.put<any>(`${this.apiUrl}/profile`, profile).pipe(
      map(response => response.data.profile)
    );
  }

  // =====================================================
  // CASES
  // =====================================================

  getCases(page: number = 0, size: number = 10): Observable<PagedResponse<ClientCase>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<any>(`${this.apiUrl}/cases`, { params }).pipe(
      map(response => ({
        content: response.data.cases,
        page: response.data.page,
        totalPages: response.data.totalPages,
        totalElements: response.data.totalElements
      }))
    );
  }

  getCase(caseId: number): Observable<ClientCase> {
    return this.http.get<any>(`${this.apiUrl}/cases/${caseId}`).pipe(
      map(response => response.data.case)
    );
  }

  // =====================================================
  // DOCUMENTS
  // =====================================================

  getDocuments(page: number = 0, size: number = 10): Observable<PagedResponse<ClientDocument>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<any>(`${this.apiUrl}/documents`, { params }).pipe(
      map(response => ({
        content: response.data.documents,
        page: response.data.page,
        totalPages: response.data.totalPages,
        totalElements: response.data.totalElements
      }))
    );
  }

  getCaseDocuments(caseId: number): Observable<ClientDocument[]> {
    return this.http.get<any>(`${this.apiUrl}/cases/${caseId}/documents`).pipe(
      map(response => response.data.documents)
    );
  }

  uploadDocument(caseId: number, file: File, title: string, description?: string): Observable<ClientDocument> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    if (description) {
      formData.append('description', description);
    }

    return this.http.post<any>(`${this.apiUrl}/cases/${caseId}/documents`, formData).pipe(
      map(response => response.data.document)
    );
  }

  // =====================================================
  // APPOINTMENTS
  // =====================================================

  getAppointments(): Observable<ClientAppointment[]> {
    return this.http.get<any>(`${this.apiUrl}/appointments`).pipe(
      map(response => response.data.appointments)
    );
  }

  requestAppointment(request: ClientAppointmentRequest): Observable<ClientAppointment> {
    return this.http.post<any>(`${this.apiUrl}/appointments/request`, request).pipe(
      map(response => response.data.appointment)
    );
  }

  cancelAppointment(appointmentId: number): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/appointments/${appointmentId}`).pipe(
      map(() => undefined)
    );
  }

  // =====================================================
  // MESSAGES
  // =====================================================

  getMessageThreads(): Observable<ClientMessageThread[]> {
    return this.http.get<any>(`${this.apiUrl}/messages`).pipe(
      map(response => response.data.threads)
    );
  }

  getThreadMessages(threadId: number): Observable<ClientMessage[]> {
    return this.http.get<any>(`${this.apiUrl}/messages/${threadId}`).pipe(
      map(response => response.data.messages)
    );
  }

  sendMessage(threadId: number, content: string): Observable<ClientMessage> {
    return this.http.post<any>(`${this.apiUrl}/messages/${threadId}`, content).pipe(
      map(response => response.data.message)
    );
  }

  startNewThread(caseId: number, subject: string, initialMessage: string): Observable<ClientMessageThread> {
    const params = new HttpParams()
      .set('caseId', caseId.toString())
      .set('subject', subject);

    return this.http.post<any>(`${this.apiUrl}/messages/new`, initialMessage, { params }).pipe(
      map(response => response.data.thread)
    );
  }

  // =====================================================
  // INVOICES
  // =====================================================

  getInvoices(page: number = 0, size: number = 10): Observable<PagedResponse<ClientInvoice>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<any>(`${this.apiUrl}/invoices`, { params }).pipe(
      map(response => ({
        content: response.data.invoices,
        page: response.data.page,
        totalPages: response.data.totalPages,
        totalElements: response.data.totalElements
      }))
    );
  }

  getInvoice(invoiceId: number): Observable<ClientInvoice> {
    return this.http.get<any>(`${this.apiUrl}/invoices/${invoiceId}`).pipe(
      map(response => response.data.invoice)
    );
  }
}
