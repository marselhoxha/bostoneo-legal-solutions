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
}
