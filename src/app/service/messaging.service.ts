import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { UserService } from './user.service';

export interface MessageThread {
  id: number;
  caseId: number;
  caseNumber: string;
  subject: string;
  channel?: 'SMS' | 'PORTAL' | 'EMAIL';
  lastMessage: string;
  lastSenderName: string;
  lastSenderType?: 'CLIENT' | 'ATTORNEY';
  lastSenderId?: number;
  lastMessageAt: string;
  unreadCount: number;
  totalMessages: number;
  status: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  clientImageUrl?: string; // Profile image URL
  attorneyName?: string; // Single attorney name or "Your Legal Team" if multiple
  attorneyCount?: number; // Number of attorneys assigned to case
  attorneyImageUrl?: string; // Profile image URL
  createdAt?: string;
  // Client-side UI enhancements (not persisted to backend)
  starred?: boolean;
  pinned?: boolean;
  priority?: 'URGENT' | 'HIGH' | 'NORMAL';
}

export interface Message {
  id: number;
  threadId: number;
  senderId?: number; // User ID who sent the message
  senderName: string;
  senderImageUrl?: string; // Profile image URL of the sender
  senderType: 'CLIENT' | 'ATTORNEY';
  channel?: 'SMS' | 'PORTAL' | 'EMAIL';
  content: string;
  sentAt: string;
  isRead: boolean;
  readAt?: string;
  hasAttachment: boolean;
}

export interface ClientInfo {
  id: number;
  name: string;
  email: string;
}

export interface ClientCase {
  id: number;
  caseNumber: string;
  title: string;
  status?: string; // OPEN, CLOSED, PENDING, etc.
}

@Injectable({
  providedIn: 'root'
})
export class MessagingService {

  private readonly apiUrl = `${environment.apiUrl}/api/messaging`;
  private readonly clientApiUrl = `${environment.apiUrl}/api/client-portal`;

  constructor(
    private http: HttpClient,
    private userService: UserService
  ) {}

  /**
   * Check if current user is a client
   * Checks both roleName and roles array for ROLE_CLIENT
   * Also uses URL path as fallback hint when user data is loading
   */
  isClientRole(): boolean {
    const user = this.userService.getCurrentUser();

    // If user is loaded, check user data
    if (user) {
      // Check roleName
      if (user.roleName === 'ROLE_CLIENT') return true;

      // Check roles array (may be present on user object)
      const roles = (user as any)?.roles;
      if (roles && Array.isArray(roles)) {
        return roles.some((role: string) => role === 'ROLE_CLIENT');
      }

      return false;
    }

    // Fallback: check URL path if user data not loaded yet
    // Client portal routes start with /client/
    if (typeof window !== 'undefined') {
      return window.location.pathname.startsWith('/client/');
    }

    return false;
  }

  /**
   * Get all message threads - works for both attorneys and clients
   */
  getThreads(): Observable<MessageThread[]> {
    if (this.isClientRole()) {
      return this.http.get<any>(`${this.clientApiUrl}/messages`).pipe(
        map(response => (response.data.threads || []).map((t: MessageThread) => this.normalizeThreadImages(t)))
      );
    }
    return this.http.get<any>(`${this.apiUrl}/threads`).pipe(
      map(response => (response.data.threads || []).map((t: MessageThread) => this.normalizeThreadImages(t)))
    );
  }

  /**
   * Get threads by case - attorney only
   */
  getThreadsByCase(caseId: number): Observable<MessageThread[]> {
    return this.http.get<any>(`${this.apiUrl}/threads/case/${caseId}`).pipe(
      map(response => response.data.threads || [])
    );
  }

  /**
   * Get messages in a thread - works for both attorneys and clients
   */
  getMessages(threadId: number): Observable<Message[]> {
    if (this.isClientRole()) {
      return this.http.get<any>(`${this.clientApiUrl}/messages/${threadId}`).pipe(
        map(response => (response.data.messages || []).map((m: Message) => this.normalizeMessageImages(m)))
      );
    }
    return this.http.get<any>(`${this.apiUrl}/threads/${threadId}/messages`).pipe(
      map(response => (response.data.messages || []).map((m: Message) => this.normalizeMessageImages(m)))
    );
  }

  /**
   * Send a reply - works for both attorneys and clients
   */
  sendReply(threadId: number, content: string): Observable<Message> {
    if (this.isClientRole()) {
      return this.http.post<any>(`${this.clientApiUrl}/messages/${threadId}`, { content }).pipe(
        map(response => response.data.message)
      );
    }
    return this.http.post<any>(`${this.apiUrl}/threads/${threadId}/reply`, { content }).pipe(
      map(response => response.data.message)
    );
  }

  getUnreadCount(): Observable<number> {
    return this.http.get<any>(`${this.apiUrl}/unread-count`).pipe(
      map(response => response.data.unreadCount || 0)
    );
  }

  closeThread(threadId: number): Observable<void> {
    return this.http.put<any>(`${this.apiUrl}/threads/${threadId}/close`, {}).pipe(
      map(() => undefined)
    );
  }

  /**
   * Delete a thread - works for both attorneys and clients
   */
  deleteThread(threadId: number): Observable<void> {
    if (this.isClientRole()) {
      return this.http.delete<any>(`${this.clientApiUrl}/messages/${threadId}`).pipe(
        map(() => undefined)
      );
    }
    return this.http.delete<any>(`${this.apiUrl}/threads/${threadId}`).pipe(
      map(() => undefined)
    );
  }

  getClients(): Observable<ClientInfo[]> {
    return this.http.get<any>(`${this.apiUrl}/clients`).pipe(
      map(response => response.data.clients || [])
    );
  }

  /**
   * Start a new thread - works for both attorneys and clients
   * For attorneys: requires clientId, caseId (optional), subject, message
   * For clients: requires caseId, subject, message
   */
  startThread(clientId: number, caseId: number | null, subject: string, message: string): Observable<MessageThread> {
    if (this.isClientRole()) {
      // Client endpoint
      const params = new HttpParams()
        .set('caseId', (caseId || 0).toString())
        .set('subject', subject);
      return this.http.post<any>(`${this.clientApiUrl}/messages/new`, message, { params }).pipe(
        map(response => response.data.thread)
      );
    }
    // Attorney endpoint
    return this.http.post<any>(`${this.apiUrl}/threads/new`, {
      clientId,
      caseId,
      subject,
      message
    }).pipe(
      map(response => response.data.thread)
    );
  }

  /**
   * Send a reply via SMS to an SMS thread.
   * This will send an actual SMS to the client's phone.
   * Attorney only feature.
   */
  sendSmsReply(threadId: number, content: string, clientPhone: string): Observable<Message> {
    return this.http.post<any>(`${this.apiUrl}/threads/${threadId}/reply-sms`, {
      content,
      toPhone: clientPhone
    }).pipe(
      map(response => response.data.message)
    );
  }

  // =====================================================
  // CLIENT-SPECIFIC METHODS
  // =====================================================

  /**
   * Get cases for the current client user
   */
  getClientCases(): Observable<ClientCase[]> {
    return this.http.get<any>(`${this.clientApiUrl}/cases`, {
      params: new HttpParams().set('page', '0').set('size', '100')
    }).pipe(
      map(response => response.data.cases || [])
    );
  }

  /** Normalize image URLs on thread data */
  private normalizeThreadImages(thread: MessageThread): MessageThread {
    if (thread.clientImageUrl) {
      thread.clientImageUrl = this.userService.normalizeImageUrl(thread.clientImageUrl);
    }
    if (thread.attorneyImageUrl) {
      thread.attorneyImageUrl = this.userService.normalizeImageUrl(thread.attorneyImageUrl);
    }
    return thread;
  }

  /** Normalize image URLs on message data */
  private normalizeMessageImages(message: Message): Message {
    if (message.senderImageUrl) {
      message.senderImageUrl = this.userService.normalizeImageUrl(message.senderImageUrl);
    }
    return message;
  }
}
