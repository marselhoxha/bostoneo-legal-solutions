import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../../../../environments/environment';

export interface PISettlementEvent {
  id?: number;
  caseId?: number;
  organizationId?: number;
  eventDate?: string;
  demandAmount: number;
  offerAmount?: number;
  offerDate?: string;
  counterAmount?: number;
  notes?: string;
  createdAt?: string;
  createdBy?: number;
  createdByName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PISettlementService {
  private baseUrl = `${environment.apiUrl}/api/pi/settlement`;

  constructor(private http: HttpClient) {}

  /**
   * Get all settlement events for a case
   */
  getEvents(caseId: number): Observable<PISettlementEvent[]> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}`).pipe(
      map(response => response.data?.events || [])
    );
  }

  /**
   * Create a new settlement event
   */
  createEvent(caseId: number, event: PISettlementEvent): Observable<PISettlementEvent> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}`, event).pipe(
      map(response => response.data?.event)
    );
  }

  /**
   * Delete a settlement event
   */
  deleteEvent(eventId: number): Observable<void> {
    return this.http.delete<any>(`${this.baseUrl}/${eventId}`).pipe(
      map(() => undefined)
    );
  }

  /**
   * Delete all settlement events for a case
   */
  clearAllEvents(caseId: number): Observable<void> {
    return this.http.delete<any>(`${this.baseUrl}/case/${caseId}`).pipe(
      map(() => undefined)
    );
  }
}
