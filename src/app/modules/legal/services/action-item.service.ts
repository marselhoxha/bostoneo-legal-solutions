import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ActionItem, TimelineEvent } from '../models/action-item.model';

@Injectable({
  providedIn: 'root'
})
export class ActionItemService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/ai/document-analyzer`;

  getActionItems(analysisId: number): Observable<ActionItem[]> {
    return this.http.get<ActionItem[]>(`${this.apiUrl}/analysis/${analysisId}/action-items`);
  }

  getTimelineEvents(analysisId: number): Observable<TimelineEvent[]> {
    return this.http.get<TimelineEvent[]>(`${this.apiUrl}/analysis/${analysisId}/timeline-events`);
  }

  updateActionItem(id: number, item: Partial<ActionItem>): Observable<ActionItem> {
    return this.http.put<ActionItem>(`${this.apiUrl}/action-items/${id}`, item);
  }

  linkTimelineEventToCalendar(timelineEventId: number, calendarEventId: number): Observable<TimelineEvent> {
    return this.http.patch<TimelineEvent>(
      `${environment.apiUrl}/api/ai/document-analysis/timeline-events/${timelineEventId}/calendar`,
      { calendarEventId }
    );
  }
}
