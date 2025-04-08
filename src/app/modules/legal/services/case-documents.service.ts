import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CaseDocument, DocumentVersion } from '../interfaces/case.interface';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CaseDocumentsService {
  private apiUrl = `${environment.apiUrl}/cases`;

  constructor(private http: HttpClient) {}

  getDocuments(caseId: string): Observable<CaseDocument[]> {
    return this.http.get<CaseDocument[]>(`${this.apiUrl}/${caseId}/documents`);
  }

  uploadDocument(caseId: string, formData: FormData): Observable<CaseDocument> {
    return this.http.post<CaseDocument>(`${this.apiUrl}/${caseId}/documents`, formData);
  }

  uploadNewVersion(documentId: string, formData: FormData): Observable<DocumentVersion> {
    return this.http.post<DocumentVersion>(`${this.apiUrl}/documents/${documentId}/versions`, formData);
  }

  downloadDocument(documentId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/documents/${documentId}/download`, {
      responseType: 'blob'
    });
  }

  downloadVersion(versionId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/documents/versions/${versionId}/download`, {
      responseType: 'blob'
    });
  }

  deleteDocument(documentId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/documents/${documentId}`);
  }

  getVersionHistory(documentId: string): Observable<DocumentVersion[]> {
    return this.http.get<DocumentVersion[]>(`${this.apiUrl}/documents/${documentId}/versions`);
  }
} 