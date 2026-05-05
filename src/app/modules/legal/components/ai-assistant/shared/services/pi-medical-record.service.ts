import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../../../../environments/environment';
import { PIMedicalRecord } from '../models/pi-medical-record.model';

@Injectable({
  providedIn: 'root'
})
export class PIMedicalRecordService {
  private baseUrl = `${environment.apiUrl}/api/pi/cases`;

  constructor(private http: HttpClient) {}

  /**
   * Get all medical records for a case
   */
  getRecordsByCaseId(caseId: number): Observable<PIMedicalRecord[]> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/medical-records`).pipe(
      map(response => response.data?.records || [])
    );
  }

  /**
   * Get a specific medical record
   */
  getRecordById(caseId: number, recordId: number): Observable<PIMedicalRecord> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/medical-records/${recordId}`).pipe(
      map(response => response.data?.record)
    );
  }

  /**
   * Create a new medical record
   */
  createRecord(caseId: number, record: PIMedicalRecord): Observable<PIMedicalRecord> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}/medical-records`, record).pipe(
      map(response => response.data?.record)
    );
  }

  /**
   * Update an existing medical record
   */
  updateRecord(caseId: number, recordId: number, record: PIMedicalRecord): Observable<PIMedicalRecord> {
    return this.http.put<any>(`${this.baseUrl}/${caseId}/medical-records/${recordId}`, record).pipe(
      map(response => response.data?.record)
    );
  }

  /**
   * Delete a medical record
   */
  deleteRecord(caseId: number, recordId: number): Observable<void> {
    return this.http.delete<any>(`${this.baseUrl}/${caseId}/medical-records/${recordId}`).pipe(
      map(() => undefined)
    );
  }

  /**
   * Delete ALL medical records for a case — enables a fresh re-scan
   */
  deleteAllRecords(caseId: number): Observable<void> {
    return this.http.delete<any>(`${this.baseUrl}/${caseId}/medical-records`).pipe(
      map(() => undefined)
    );
  }

  /**
   * Get provider summary for a case
   */
  getProviderSummary(caseId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/medical-records/provider-summary`).pipe(
      map(response => response.data)
    );
  }

  /**
   * Get records by provider name
   */
  getRecordsByProvider(caseId: number, providerName: string): Observable<PIMedicalRecord[]> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/medical-records/by-provider`, {
      params: { providerName }
    }).pipe(
      map(response => response.data?.records || [])
    );
  }

  /**
   * Get records by date range
   */
  getRecordsByDateRange(caseId: number, startDate: string, endDate: string): Observable<PIMedicalRecord[]> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/medical-records/by-date-range`, {
      params: { startDate, endDate }
    }).pipe(
      map(response => response.data?.records || [])
    );
  }

  /**
   * Extract diagnoses from text using AI
   */
  extractDiagnosesFromText(caseId: number, text: string): Observable<any[]> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}/medical-records/extract-diagnoses`, { text }).pipe(
      map(response => response.data?.diagnoses || [])
    );
  }

  /**
   * Analyze a record with AI
   */
  analyzeRecordWithAI(caseId: number, recordId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}/medical-records/${recordId}/analyze`, {}).pipe(
      map(response => response.data?.analysis)
    );
  }

  /**
   * Scan all case documents and auto-populate medical records.
   * Analyzes PDFs attached to the case and creates medical records from them.
   * Returns: { success, documentsScanned, recordsCreated, records, files, errors }
   */
  scanCaseDocuments(caseId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}/medical-records/scan-documents`, {}).pipe(
      map(response => response.data)
    );
  }

  /**
   * Analyze a specific file and create a medical record from it
   */
  analyzeFileAndCreateRecord(caseId: number, fileId: number): Observable<PIMedicalRecord | null> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}/medical-records/analyze-file/${fileId}`, {}).pipe(
      map(response => response.data?.record || null)
    );
  }

  /**
   * Re-run persistence/merge logic against cached AI extractions stored on
   * pi_scanned_documents.raw_extraction. Does NOT call Bedrock — eliminates
   * token cost when iterating on createRecordFromAnalysis or merge logic.
   *
   * Backend endpoint is gated to dev+staging only via @Profile (see
   * PIReprocessController) — production returns 404. Callers should hide
   * the UI button on prod via {@code isReprocessAvailable()}.
   *
   * Returns: { success, replayedDocuments, recordsCreated, records, errors,
   *           usedCache, aiCallsAvoided }
   */
  reprocessCaseDocuments(caseId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}/medical-records/reprocess`, {}).pipe(
      map(response => response.data)
    );
  }

  /**
   * P15.a — Per-document scan tracking. Returns one row per scannable case
   * document, joining FileItem with its PIScannedDocument tracking row (if any).
   *
   * Status values:
   *   - 'created'     → AI extracted a medical record (green "Analyzed")
   *   - 'merged'      → AI extraction merged into an existing record (green "Analyzed")
   *   - 'non_medical' → AI determined this is not a medical record (grey "Skipped")
   *   - 'insurance'   → AI flagged as insurance ledger / PIP log (grey "Skipped")
   *   - 'no_text'     → text extraction failed (PDF was image-only, no OCR) (red "Failed")
   *   - 'failed'      → AI call failed (red "Failed" with retry button)
   *   - null          → file uploaded but never scanned (outline "Not scanned")
   */
  getScanTracking(caseId: number): Observable<PIScanTrackingRow[]> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/medical-records/scan-tracking`).pipe(
      map(response => response.data?.tracking || [])
    );
  }
}

/** P15.a — Per-document scan tracking row from `GET /scan-tracking`. */
export interface PIScanTrackingRow {
  documentId: number;
  documentName: string;
  mimeType?: string;
  status: 'created' | 'merged' | 'non_medical' | 'insurance' | 'no_text' | 'failed' | null;
  errorMessage: string | null;
  medicalRecordId: number | null;
  createdAt: string | null;
}
