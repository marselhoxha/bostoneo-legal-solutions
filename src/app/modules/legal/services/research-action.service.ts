import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface ResearchActionItem {
  id: number;
  researchSessionId: number;
  userId: number;
  caseId?: number;
  actionType: 'DRAFT_MOTION' | 'CREATE_DEADLINE' | 'ATTACH_DOCUMENT' | 'CREATE_TASK' | 'ADD_NOTE' | 'SCHEDULE_EVENT';
  sourceFinding: string;
  sourceCitation: string;
  actionStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DISMISSED';
  taskDescription?: string;
  taskPriority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  aiConfidenceScore?: number;
  createdAt: string;
  completedAt?: string;
  dismissedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ResearchActionService {
  private apiUrl = `${environment.apiUrl}/api/ai/research/actions`;

  constructor(private http: HttpClient) {}

  /**
   * Suggest actions based on research findings
   * @param sessionId Research session ID
   * @param userId User ID
   * @param finding The research finding text
   * @param citation Citation/source
   * @param caseId Optional case ID to link actions to a specific case
   */
  suggestActions(sessionId: number, userId: number, finding: string, citation: string, caseId?: number): Observable<ResearchActionItem[]> {
    let params = new HttpParams()
      .set('sessionId', sessionId.toString())
      .set('userId', userId.toString());

    if (caseId) {
      params = params.set('caseId', caseId.toString());
    }

    return this.http.post<ResearchActionItem[]>(`${this.apiUrl}/suggest`, {
      finding,
      citation
    }, { params });
  }

  getPendingActions(userId: number): Observable<ResearchActionItem[]> {
    return this.http.get<ResearchActionItem[]>(`${this.apiUrl}/user/${userId}/pending`);
  }

  getSessionActions(sessionId: number): Observable<ResearchActionItem[]> {
    return this.http.get<ResearchActionItem[]>(`${this.apiUrl}/session/${sessionId}`);
  }

  dismissAction(actionId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${actionId}/dismiss`, {});
  }

  completeAction(actionId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${actionId}/complete`, {});
  }

  /**
   * Execute action (create task/deadline) and mark as completed in single atomic operation
   */
  executeAction(actionId: number, actionData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${actionId}/execute`, actionData);
  }

  /**
   * Generate smart AI-powered title from description
   */
  generateTitle(description: string): Observable<{ title: string }> {
    return this.http.post<{ title: string }>(`${this.apiUrl}/generate-title`, { description });
  }
}
