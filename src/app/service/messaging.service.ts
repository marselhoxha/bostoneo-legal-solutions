import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface MessageThread {
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
  clientName: string;
}

export interface Message {
  id: number;
  threadId: number;
  senderName: string;
  senderType: 'CLIENT' | 'ATTORNEY';
  content: string;
  sentAt: string;
  isRead: boolean;
  hasAttachment: boolean;
}

export interface ClientInfo {
  id: number;
  name: string;
  email: string;
}

@Injectable({
  providedIn: 'root'
})
export class MessagingService {

  private readonly apiUrl = `${environment.apiUrl}/api/messaging`;

  constructor(private http: HttpClient) {}

  getThreads(): Observable<MessageThread[]> {
    return this.http.get<any>(`${this.apiUrl}/threads`).pipe(
      map(response => response.data.threads || [])
    );
  }

  getThreadsByCase(caseId: number): Observable<MessageThread[]> {
    return this.http.get<any>(`${this.apiUrl}/threads/case/${caseId}`).pipe(
      map(response => response.data.threads || [])
    );
  }

  getMessages(threadId: number): Observable<Message[]> {
    return this.http.get<any>(`${this.apiUrl}/threads/${threadId}/messages`).pipe(
      map(response => response.data.messages || [])
    );
  }

  sendReply(threadId: number, content: string): Observable<Message> {
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

  getClients(): Observable<ClientInfo[]> {
    return this.http.get<any>(`${this.apiUrl}/clients`).pipe(
      map(response => response.data.clients || [])
    );
  }

  startThread(clientId: number, caseId: number | null, subject: string, message: string): Observable<MessageThread> {
    return this.http.post<any>(`${this.apiUrl}/threads/new`, {
      clientId,
      caseId,
      subject,
      message
    }).pipe(
      map(response => response.data.thread)
    );
  }
}
