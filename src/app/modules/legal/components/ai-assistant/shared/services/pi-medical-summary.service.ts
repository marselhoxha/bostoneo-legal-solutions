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
  CompletenessMetrics,
  DemandScenario
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
   * Generate AI adjuster defense analysis
   */
  generateAdjusterAnalysis(caseId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}/medical-summary/adjuster-analysis`, {}).pipe(
      map(response => response.data?.analysis)
    );
  }

  /**
   * Retrieve saved adjuster defense analysis (if previously generated)
   */
  getSavedAdjusterAnalysis(caseId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/medical-summary/adjuster-analysis`);
  }

  /**
   * Check for unscanned documents in the case
   */
  getScanStatus(caseId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/medical-records/scan-status`);
  }

  /**
   * P5.4 — Persist the attorney's demand calculator scenario.
   * Returns the updated summary so the caller can pick up `savedAt`.
   */
  updateDemandScenario(caseId: number, scenario: DemandScenario): Observable<PIMedicalSummary> {
    return this.http.put<any>(`${this.baseUrl}/${caseId}/medical-summary/demand-scenario`, scenario).pipe(
      map(response => response.data?.summary)
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

  /**
   * P11.a — Cross-document anomaly detection. Pure rules-based scan over
   * the case's records + scanned-doc tracking + intake fields.
   */
  getDocumentAnomalies(caseId: number): Observable<PIDocumentAnomaly[]> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/medical-summary/anomalies`).pipe(
      map(response => response.data?.anomalies || [])
    );
  }

  /** P11.d — Retrieve saved risk register (no AI call). */
  getSavedRiskRegister(caseId: number): Observable<PIRiskRegister | null> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/medical-summary/risk-register`).pipe(
      map(response => response.data?.exists ? response.data?.register : null)
    );
  }

  /** P11.d — Generate AI risk register. ~5–10s typical latency. */
  generateRiskRegister(caseId: number): Observable<PIRiskRegister> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}/medical-summary/risk-register`, {}).pipe(
      map(response => response.data?.register)
    );
  }
}

/** P11.a — A single cross-doc anomaly entry. Mirrors backend response shape. */
export interface PIDocumentAnomaly {
  id: string;
  type: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  message: string;
  source: string;
  recommendation: string;
}

/** P11.d — One risk factor within a tier. */
export interface PIRiskFactor {
  factor: string;
  impact: '+' | '-';
  weight: 'HIGH' | 'MEDIUM' | 'LOW';
}

/** P11.d — Per-tier risk shape. preSuit uses `likelihood`, suit/trial use `risk`. */
export interface PIRiskTier {
  likelihood?: number;
  risk?: number;
  label?: 'FAVORABLE' | 'MIXED' | 'CHALLENGING' | string;
  summary?: string;
  factors?: PIRiskFactor[];
}

/** P11.d — Full risk register payload. */
export interface PIRiskRegister {
  preSuit?: PIRiskTier;
  suit?: PIRiskTier;
  trial?: PIRiskTier;
  generatedAt?: string;
  generatedByModel?: string;
}
