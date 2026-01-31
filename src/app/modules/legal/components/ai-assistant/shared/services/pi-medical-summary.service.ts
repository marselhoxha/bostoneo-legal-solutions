import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../../../../environments/environment';
import {
  PIMedicalSummary,
  ProviderSummaryItem,
  DiagnosisItem,
  RedFlagItem,
  MissingRecordItem,
  TreatmentGap,
  CompletenessMetrics
} from '../models/pi-medical-summary.model';

@Injectable({
  providedIn: 'root'
})
export class PIMedicalSummaryService {
  private baseUrl = `${environment.apiUrl}/api/pi/cases`;

  constructor(private http: HttpClient) {}

  /**
   * Get the medical summary for a case
   */
  getMedicalSummary(caseId: number): Observable<{ summary: PIMedicalSummary | null; exists: boolean }> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/medical-summary`).pipe(
      map(response => ({
        summary: response.data?.summary,
        exists: response.data?.exists
      }))
    );
  }

  /**
   * Generate a new medical summary using AI
   */
  generateMedicalSummary(caseId: number): Observable<PIMedicalSummary> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}/medical-summary/generate`, {}).pipe(
      map(response => response.data?.summary)
    );
  }

  /**
   * Check if summary is current
   */
  getSummaryStatus(caseId: number): Observable<{ isCurrent: boolean; needsRefresh: boolean }> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/medical-summary/status`).pipe(
      map(response => response.data)
    );
  }

  /**
   * Get treatment chronology
   */
  getTreatmentChronology(caseId: number): Observable<string> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/medical-summary/chronology`).pipe(
      map(response => response.data?.chronology || '')
    );
  }

  /**
   * Get provider summary
   */
  getProviderSummary(caseId: number): Observable<ProviderSummaryItem[]> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/medical-summary/providers`).pipe(
      map(response => response.data?.providers || [])
    );
  }

  /**
   * Get diagnosis list
   */
  getDiagnosisList(caseId: number): Observable<DiagnosisItem[]> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/medical-summary/diagnoses`).pipe(
      map(response => response.data?.diagnoses || [])
    );
  }

  /**
   * Get red flags
   */
  getRedFlags(caseId: number): Observable<RedFlagItem[]> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/medical-summary/red-flags`).pipe(
      map(response => response.data?.redFlags || [])
    );
  }

  /**
   * Get missing records
   */
  getMissingRecords(caseId: number): Observable<MissingRecordItem[]> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/medical-summary/missing-records`).pipe(
      map(response => response.data?.missingRecords || [])
    );
  }

  /**
   * Get prognosis assessment
   */
  getPrognosisAssessment(caseId: number): Observable<string> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/medical-summary/prognosis`).pipe(
      map(response => response.data?.prognosis || '')
    );
  }

  /**
   * Get completeness metrics
   */
  getCompletenessMetrics(caseId: number): Observable<CompletenessMetrics> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/medical-summary/completeness`).pipe(
      map(response => response.data?.metrics)
    );
  }

  /**
   * Analyze treatment gaps
   */
  analyzeTreatmentGaps(caseId: number): Observable<TreatmentGap[]> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/medical-summary/treatment-gaps`).pipe(
      map(response => response.data?.gaps || [])
    );
  }

  /**
   * Delete medical summary
   */
  deleteMedicalSummary(caseId: number): Observable<void> {
    return this.http.delete<any>(`${this.baseUrl}/${caseId}/medical-summary`).pipe(
      map(() => undefined)
    );
  }
}
