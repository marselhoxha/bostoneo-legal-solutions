import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../../../environments/environment';

export interface AIEditingSession {
  id: number;
  fileId: number;
  sessionName: string;
  participants: SessionParticipant[];
  startTime: Date;
  endTime?: Date;
  activeStatus: 'ACTIVE' | 'PAUSED' | 'ENDED';
  documentUrl: string;
  currentVersion: number;
  createdBy: number;
}

export interface SessionParticipant {
  userId: number;
  userName: string;
  email: string;
  role: 'EDITOR' | 'REVIEWER' | 'VIEWER';
  joinedAt: Date;
  isActive: boolean;
  lastActivity: Date;
  cursorPosition?: number;
}

export interface AIEditSuggestion {
  id: number;
  sessionId: number;
  suggestionText: string;
  originalText: string;
  position: number;
  suggestionType: 'GRAMMAR' | 'STYLE' | 'LEGAL_ACCURACY' | 'CITATION' | 'COMPLIANCE';
  confidenceScore: number;
  explanation: string;
  accepted: boolean;
  acceptedBy?: number;
  acceptedAt?: Date;
  createdAt: Date;
}

export interface CollaborationEvent {
  type: 'USER_JOINED' | 'USER_LEFT' | 'EDIT_MADE' | 'SUGGESTION_ADDED' | 'SUGGESTION_ACCEPTED' | 'COMMENT_ADDED';
  userId: number;
  userName: string;
  timestamp: Date;
  data?: any;
}

@Injectable({
  providedIn: 'root'
})
export class AICollaborationService {
  private apiUrl = `${environment.apiUrl}/api/ai/collaborate`;
  
  private currentSession$ = new BehaviorSubject<AIEditingSession | null>(null);
  public currentSession = this.currentSession$.asObservable();
  
  private collaborationEvents$ = new BehaviorSubject<CollaborationEvent[]>([]);
  public collaborationEvents = this.collaborationEvents$.asObservable();

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // Session Management
  createSession(fileId: number, sessionName: string, participants: number[]): Observable<AIEditingSession> {
    const request = { fileId, sessionName, participants };
    
    return this.http.post<AIEditingSession>(`${this.apiUrl}/session`, request, { 
      headers: this.getHeaders() 
    }).pipe(
      tap(session => this.currentSession$.next(session)),
      catchError(this.handleError)
    );
  }

  joinSession(sessionId: number): Observable<AIEditingSession> {
    return this.http.post<AIEditingSession>(`${this.apiUrl}/session/${sessionId}/join`, {}, { 
      headers: this.getHeaders() 
    }).pipe(
      tap(session => this.currentSession$.next(session)),
      catchError(this.handleError)
    );
  }

  leaveSession(sessionId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/session/${sessionId}/leave`, {}, { 
      headers: this.getHeaders() 
    }).pipe(
      tap(() => this.currentSession$.next(null)),
      catchError(this.handleError)
    );
  }

  endSession(sessionId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/session/${sessionId}/end`, {}, { 
      headers: this.getHeaders() 
    }).pipe(
      tap(() => this.currentSession$.next(null)),
      catchError(this.handleError)
    );
  }

  getActiveSessionsForUser(): Observable<AIEditingSession[]> {
    return this.http.get<AIEditingSession[]>(`${this.apiUrl}/sessions/active`, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  getSessionHistory(fileId?: number): Observable<AIEditingSession[]> {
    let url = `${this.apiUrl}/sessions/history`;
    if (fileId) url += `?fileId=${fileId}`;
    
    return this.http.get<AIEditingSession[]>(url, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Real-time Collaboration
  updateCursorPosition(sessionId: number, position: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/session/${sessionId}/cursor`, 
      { position }, 
      { headers: this.getHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  broadcastEdit(sessionId: number, edit: { position: number; length: number; text: string }): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/session/${sessionId}/edit`, edit, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  // AI Suggestions
  getSuggestionsForSession(sessionId: number): Observable<AIEditSuggestion[]> {
    return this.http.get<AIEditSuggestion[]>(`${this.apiUrl}/session/${sessionId}/suggestions`, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  requestAISuggestions(sessionId: number, text: string, context?: string): Observable<AIEditSuggestion[]> {
    const request = { text, context };
    
    return this.http.post<AIEditSuggestion[]>(`${this.apiUrl}/session/${sessionId}/ai-suggestions`, request, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  acceptSuggestion(suggestionId: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/suggestions/${suggestionId}/accept`, {}, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  rejectSuggestion(suggestionId: number, reason?: string): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/suggestions/${suggestionId}/reject`, 
      { reason }, 
      { headers: this.getHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Comments and Annotations
  addComment(sessionId: number, position: number, comment: string): Observable<any> {
    const request = { position, comment };
    
    return this.http.post(`${this.apiUrl}/session/${sessionId}/comments`, request, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  getComments(sessionId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/session/${sessionId}/comments`, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Version Control
  saveVersion(sessionId: number, versionNote?: string): Observable<any> {
    const request = { versionNote };
    
    return this.http.post(`${this.apiUrl}/session/${sessionId}/save-version`, request, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  getVersionHistory(sessionId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/session/${sessionId}/versions`, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  revertToVersion(sessionId: number, versionId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/session/${sessionId}/revert/${versionId}`, {}, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Event Broadcasting (would typically use WebSocket in production)
  addCollaborationEvent(event: CollaborationEvent): void {
    const currentEvents = this.collaborationEvents$.value;
    this.collaborationEvents$.next([...currentEvents, event]);
  }

  clearEvents(): void {
    this.collaborationEvents$.next([]);
  }

  private handleError(error: any): Observable<never> {
    console.error('AI Collaboration Service Error:', error);
    return throwError(() => error);
  }
}