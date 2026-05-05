import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../../../../environments/environment';

/**
 * P10.c — PI lien shape mirrored from PILienDTO.
 */
export type PILienType = 'MEDICAL' | 'HEALTH_INS' | 'MEDICARE' | 'MEDICAID' | 'ATTORNEY' | 'OTHER';
export type PILienStatus = 'OPEN' | 'NEGOTIATING' | 'RESOLVED';

export interface PILien {
  id?: number;
  caseId?: number;
  organizationId?: number;
  holder: string;
  type: PILienType;
  originalAmount?: number;
  negotiatedAmount?: number;
  status: PILienStatus;
  notes?: string;
  assertedDate?: string;     // YYYY-MM-DD
  resolvedDate?: string;     // YYYY-MM-DD
  createdAt?: string;
  updatedAt?: string;
  createdBy?: number;
}

export interface PILienListResponse {
  liens: PILien[];
  effectiveTotal: number;
}

@Injectable({ providedIn: 'root' })
export class PILienService {

  private baseUrl = `${environment.apiUrl}/api/pi/liens`;

  constructor(private http: HttpClient) {}

  /** Per-case fetch. Server also returns the effective total (sum of negotiated || original). */
  list(caseId: number): Observable<PILienListResponse> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}`).pipe(
      map(response => ({
        liens: response.data?.liens || [],
        effectiveTotal: Number(response.data?.effectiveTotal) || 0,
      }))
    );
  }

  create(caseId: number, lien: PILien): Observable<PILien> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}`, lien).pipe(
      map(response => response.data?.lien)
    );
  }

  update(id: number, patch: Partial<PILien>): Observable<PILien> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, patch).pipe(
      map(response => response.data?.lien)
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<any>(`${this.baseUrl}/${id}`).pipe(
      map(() => undefined)
    );
  }
}
