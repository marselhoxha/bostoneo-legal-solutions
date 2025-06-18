import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpEvent, HttpEventType } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Document, DocumentVersion } from '../interfaces/document.interface';
import { environment } from '../../../../environments/environment';
import { Key } from 'src/app/enum/key.enum';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private apiUrl = `${environment.apiUrl}/legal/documents`;

  constructor(private http: HttpClient) { }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem(Key.TOKEN);
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  getDocuments(): Observable<Document[]> {
    return this.http.get<Document[]>(this.apiUrl);
  }

  getDocumentById(id: string): Observable<Document> {
    return this.http.get<Document>(`${this.apiUrl}/${id}`);
  }

  getDocumentsByCaseId(caseId: string): Observable<Document[]> {
    return this.http.get<Document[]>(`${this.apiUrl}/case/${caseId}`);
  }

  createDocument(documentData: Partial<Document>): Observable<Document> {
    return this.http.post<Document>(this.apiUrl, documentData);
  }

  updateDocument(id: string, documentData: Partial<Document>): Observable<Document> {
    return this.http.put<Document>(`${this.apiUrl}/${id}`, documentData);
  }

  deleteDocument(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  uploadDocument(file: File, documentData: Partial<Document>): Observable<Document> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('data', JSON.stringify(documentData));
    return this.http.post<Document>(`${this.apiUrl}/upload`, formData);
  }

  downloadDocument(documentId: string, preview: boolean = false): Observable<Blob> {
    const params = preview ? '?preview=true' : '';
    return this.http.get(`${this.apiUrl}/${documentId}/download${params}`, {
      responseType: 'blob'
    });
  }

  /**
   * Get all versions of a document
   */
  getDocumentVersions(documentId: string): Observable<DocumentVersion[]> {
    return this.http.get<DocumentVersion[]>(`${this.apiUrl}/${documentId}/versions`);
  }

  /**
   * Download a specific version of a document
   */
  downloadVersion(documentId: string, versionId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${documentId}/versions/${versionId}`, {
      responseType: 'blob',
      headers: this.getAuthHeaders()
    });
  }

  /**
   * Get document by ID with simplified response format
   */
  getDocument(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  /**
   * Upload a new version of a document with progress tracking
   */
  uploadVersion(id: string, file: File, comment?: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (comment) {
      formData.append('comment', comment);
    }
    
    return this.http.post<any>(
      `${this.apiUrl}/${id}/versions`, 
      formData,
      { 
        reportProgress: true,
        observe: 'events'
      }
    ).pipe(
      map(event => {
        switch (event.type) {
          case HttpEventType.UploadProgress:
            const progress = Math.round(100 * event.loaded / (event.total || event.loaded));
            return { type: 'UploadProgress', loaded: event.loaded, total: event.total, progress };
          case HttpEventType.Response:
            return event.body;
          default:
            return event;
        }
      })
    );
  }
} 