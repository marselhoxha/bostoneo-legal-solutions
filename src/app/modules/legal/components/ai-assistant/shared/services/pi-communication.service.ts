import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../../../../environments/environment';

/**
 * P9e — Communication log entry shape mirrored from PICommunicationDTO.
 */
export type PICommunicationType = 'CALL' | 'EMAIL' | 'LETTER' | 'IN_PERSON' | 'MEETING' | 'OTHER';
export type PICommunicationDirection = 'IN' | 'OUT' | 'INTERNAL';

export interface PICommunication {
  id?: number;
  caseId?: number;
  organizationId?: number;
  type: PICommunicationType;
  direction: PICommunicationDirection;
  counterparty?: string;
  subject?: string;
  summary?: string;
  eventDate?: string;       // ISO local datetime
  createdAt?: string;
  createdBy?: number;
  createdByName?: string;
}

/**
 * P5 — Awaiting-reply summary item from the Communication Health endpoint.
 */
export interface PIAwaitingItem {
  name: string;
  ageHours: number;
}

/**
 * P5 — Mirror of {@code PICommunicationHealthDTO}. All numeric fields can be
 * 0/null on cold-start (case with no comms); the frontend treats nulls as
 * "no data" and falls back to neutral display.
 */
export interface PICommunicationHealth {
  avgResponseHours?: number | null;
  lastInboundAt?: string | null;
  lastAdjusterContactAt?: string | null;
  awaitingReplyCount: number;
  oldestAwaitingAgeHours?: number | null;
  awaitingItems: PIAwaitingItem[];
  volume14d: number;
  typeBreakdown: { [type: string]: number };
  channelBreakdown: { [channel: string]: number };
}

@Injectable({ providedIn: 'root' })
export class PICommunicationService {

  private baseUrl = `${environment.apiUrl}/api/pi/communications`;

  constructor(private http: HttpClient) {}

  /** Fetch all entries for a case, newest first. */
  list(caseId: number): Observable<PICommunication[]> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}`).pipe(
      map(response => response.data?.communications || [])
    );
  }

  /** Log a new communication entry. */
  create(caseId: number, entry: PICommunication): Observable<PICommunication> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}`, entry).pipe(
      map(response => response.data?.communication)
    );
  }

  /** Update an existing entry — partial-update; only present fields are written. */
  update(id: number, entry: Partial<PICommunication>): Observable<PICommunication> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, entry).pipe(
      map(response => response.data?.communication)
    );
  }

  /** Delete a single entry by id. */
  delete(id: number): Observable<void> {
    return this.http.delete<any>(`${this.baseUrl}/${id}`).pipe(
      map(() => undefined)
    );
  }

  /**
   * P5 — Communication Health summary for the Activity-tab 3-card band.
   * Backend derives avg response time, awaiting-reply per counterparty,
   * 14-day volume and type breakdown from the case's tenant-filtered
   * communication timeline. Empty-case payload is structurally valid
   * (zeros + empty maps), so callers don't need defensive coding.
   */
  getHealth(caseId: number): Observable<PICommunicationHealth> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/health`).pipe(
      map(response => response.data?.health as PICommunicationHealth)
    );
  }
}
