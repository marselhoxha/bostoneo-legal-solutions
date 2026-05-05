import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../../../../environments/environment';

/**
 * P10.d — Damage element shape mirrored from PIDamageElementDTO. Uses the
 * existing PIDamageCalculationController endpoints — no new backend code.
 */
export type PIDamageElementType =
  | 'PAST_MEDICAL'
  | 'FUTURE_MEDICAL'
  | 'LOST_WAGES'
  | 'EARNING_CAPACITY'
  | 'HOUSEHOLD_SERVICES'
  | 'PAIN_SUFFERING'
  | 'MILEAGE'
  | 'OTHER';

export type PIConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface PIDamageElement {
  id?: number;
  caseId?: number;
  organizationId?: number;
  elementType: PIDamageElementType;
  elementName: string;
  calculationMethod?: string;
  baseAmount?: number;
  multiplier?: number;
  durationValue?: number;
  durationUnit?: string;
  calculatedAmount: number;
  confidenceLevel?: PIConfidenceLevel;
  confidenceNotes?: string;
  sourceProvider?: string;
  sourceEmployer?: string;
  sourceDate?: string;       // YYYY-MM-DD
  notes?: string;
  legalAuthority?: string;
  displayOrder?: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: number;
  createdByName?: string;
}

@Injectable({ providedIn: 'root' })
export class PIDamageElementService {

  private base(caseId: number): string {
    return `${environment.apiUrl}/api/pi/cases/${caseId}/damages`;
  }

  constructor(private http: HttpClient) {}

  list(caseId: number): Observable<PIDamageElement[]> {
    return this.http.get<any>(`${this.base(caseId)}/elements`).pipe(
      map(response => response.data?.elements || [])
    );
  }

  create(caseId: number, element: PIDamageElement): Observable<PIDamageElement> {
    return this.http.post<any>(`${this.base(caseId)}/elements`, element).pipe(
      map(response => response.data?.element)
    );
  }

  update(caseId: number, id: number, patch: Partial<PIDamageElement>): Observable<PIDamageElement> {
    return this.http.put<any>(`${this.base(caseId)}/elements/${id}`, patch).pipe(
      map(response => response.data?.element)
    );
  }

  delete(caseId: number, id: number): Observable<void> {
    return this.http.delete<any>(`${this.base(caseId)}/elements/${id}`).pipe(
      map(() => undefined)
    );
  }

  /** Convenience: sync medical expenses from medical records into a single PAST_MEDICAL element. */
  syncMedical(caseId: number): Observable<PIDamageElement | null> {
    return this.http.post<any>(`${this.base(caseId)}/sync-medical`, {}).pipe(
      map(response => response.data?.element || null)
    );
  }
}
