import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../../../../environments/environment';
import { PIDocumentChecklist, DocumentCompletenessScore } from '../models/pi-document-checklist.model';

@Injectable({
  providedIn: 'root'
})
export class PIDocumentChecklistService {
  private baseUrl = `${environment.apiUrl}/api/pi/cases`;

  constructor(private http: HttpClient) {}

  /**
   * Get document checklist for a case
   */
  getChecklistByCaseId(caseId: number): Observable<PIDocumentChecklist[]> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/document-checklist`).pipe(
      map(response => response.data?.checklist || [])
    );
  }

  /**
   * Get a specific checklist item
   */
  getChecklistItemById(caseId: number, itemId: number): Observable<PIDocumentChecklist> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/document-checklist/${itemId}`).pipe(
      map(response => response.data?.item)
    );
  }

  /**
   * Create a new checklist item
   */
  createChecklistItem(caseId: number, item: PIDocumentChecklist): Observable<PIDocumentChecklist> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}/document-checklist`, item).pipe(
      map(response => response.data?.item)
    );
  }

  /**
   * Update a checklist item
   */
  updateChecklistItem(caseId: number, itemId: number, item: PIDocumentChecklist): Observable<PIDocumentChecklist> {
    return this.http.put<any>(`${this.baseUrl}/${caseId}/document-checklist/${itemId}`, item).pipe(
      map(response => response.data?.item)
    );
  }

  /**
   * Delete a checklist item
   */
  deleteChecklistItem(caseId: number, itemId: number): Observable<void> {
    return this.http.delete<any>(`${this.baseUrl}/${caseId}/document-checklist/${itemId}`).pipe(
      map(() => undefined)
    );
  }

  /**
   * Initialize default checklist for a case
   */
  initializeDefaultChecklist(caseId: number): Observable<PIDocumentChecklist[]> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}/document-checklist/initialize`, {}).pipe(
      map(response => response.data?.checklist || [])
    );
  }

  /**
   * Get missing documents
   */
  getMissingDocuments(caseId: number): Observable<PIDocumentChecklist[]> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/document-checklist/missing`).pipe(
      map(response => response.data?.missing || [])
    );
  }

  /**
   * Get overdue follow-ups
   */
  getOverdueFollowUps(caseId: number): Observable<PIDocumentChecklist[]> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/document-checklist/overdue`).pipe(
      map(response => response.data?.overdue || [])
    );
  }

  /**
   * Get completeness score
   */
  getCompletenessScore(caseId: number): Observable<DocumentCompletenessScore> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/document-checklist/completeness`).pipe(
      map(response => response.data?.completeness)
    );
  }

  /**
   * Mark document as received
   */
  markAsReceived(caseId: number, itemId: number, documentId?: number): Observable<PIDocumentChecklist> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}/document-checklist/${itemId}/receive`,
      documentId ? { documentId } : {}
    ).pipe(
      map(response => response.data?.item)
    );
  }

  /**
   * Request a document
   */
  requestDocument(caseId: number, itemId: number, requestSentTo: string): Observable<PIDocumentChecklist> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}/document-checklist/${itemId}/request`,
      { requestSentTo }
    ).pipe(
      map(response => response.data?.item)
    );
  }

  /**
   * Log a follow-up
   */
  logFollowUp(caseId: number, itemId: number): Observable<PIDocumentChecklist> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}/document-checklist/${itemId}/follow-up`, {}).pipe(
      map(response => response.data?.item)
    );
  }
}
