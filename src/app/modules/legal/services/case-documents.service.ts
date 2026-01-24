import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpEventType } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { CustomHttpResponse } from '../../../core/models/custom-http-response.model';
import { Key } from '../../../enum/key.enum';

@Injectable({
  providedIn: 'root'
})
export class CaseDocumentsService {
  private apiUrl = `${environment.apiUrl}/legal-case`;

  constructor(private http: HttpClient) { }

  getDocuments(caseId: string): Observable<any> {
    if (!caseId) {
      console.error('Case ID is required to fetch documents');
      return throwError(() => new Error('Case ID is required'));
    }

    // Use the direct document service endpoint that doesn't apply role filtering
    const url = `${environment.apiUrl}/legal/documents/case/${caseId}`;
    const headers = this.getAuthHeaders(false);

    return this.http.get<any>(url, { headers }).pipe(
      map(response => {
        // Handle the actual backend response structure
        if (!response) {
          return [];
        }

        if (Array.isArray(response)) {
          return response;
        }

        if (response.documents && Array.isArray(response.documents)) {
          return response.documents;
        }

        if (response.data && response.data.documents && Array.isArray(response.data.documents)) {
          return response.data.documents;
        }

        if (response.data && Array.isArray(response.data)) {
          return response.data;
        }

        if (response.data) {
          return response.data;
        }

        return response;
      }),
      catchError(error => {
        console.error('Error fetching documents:', error);
        return throwError(() => error);
      })
    );
  }

  uploadDocument(caseId: string, formData: FormData): Observable<any> {
    if (!caseId) {
      console.error('Case ID is required to upload a document');
      return throwError(() => new Error('Case ID is required'));
    }

    const url = `${this.apiUrl}/${caseId}/documents`;
    
    return this.http.post<any>(url, formData, { headers: this.getAuthHeaders(true) }).pipe(
      catchError(error => {
        console.error('Error uploading document:', error);
        return throwError(() => error);
      })
    );
  }

  uploadNewVersion(caseId: string, documentId: string, formData: FormData): Observable<any> {
    if (!caseId || !documentId) {
      console.error('Case ID and Document ID are required to upload a new version');
      return throwError(() => new Error('Case ID and Document ID are required'));
    }

    const url = `${this.apiUrl}/${caseId}/documents/${documentId}/versions`;
    
    return this.http.post<any>(url, formData, { headers: this.getAuthHeaders(true) }).pipe(
      catchError(error => {
        console.error('Error uploading new version:', error);
        return throwError(() => error);
      })
    );
  }

  downloadDocument(caseId: string, documentId: string, preview: boolean = false): Observable<Blob> {
    const params = preview ? '?preview=true' : '';
    return this.http.get(`${this.apiUrl}/${caseId}/documents/${documentId}/download${params}`, { 
      responseType: 'blob' 
    });
  }

  downloadVersion(caseId: string, documentId: string, versionId: string): Observable<Blob> {
    if (!caseId || !documentId || !versionId) {
      console.error('Case ID, Document ID, and Version ID are required to download a version');
      return throwError(() => new Error('Case ID, Document ID, and Version ID are required'));
    }

    const url = `${this.apiUrl}/${caseId}/documents/${documentId}/versions/${versionId}/download`;
    
    return this.http.get(url, {
      headers: this.getAuthHeaders(false),
      responseType: 'blob'
    }).pipe(
      catchError(error => {
        console.error('Error downloading version:', error);
        return throwError(() => error);
      })
    );
  }

  deleteDocument(caseId: string | number, documentId: string | number): Observable<any> {
    if (!caseId || !documentId) {
      console.error('Case ID and Document ID are required to delete a document');
      return throwError(() => new Error('Case ID and Document ID are required'));
    }

    // Ensure we're passing numeric IDs (backend expects Long type)
    const numericCaseId = typeof caseId === 'string' ? parseInt(caseId, 10) : caseId;
    const numericDocId = typeof documentId === 'string' ? parseInt(documentId, 10) : documentId;
    
    if (isNaN(numericCaseId) || isNaN(numericDocId)) {
      console.error('Invalid ID format - Case ID and Document ID must be convertible to numbers');
      return throwError(() => new Error('Invalid ID format'));
    }

    const baseUrl = environment.apiUrl;
    const url = `${baseUrl}/legal-case/${numericCaseId}/documents/${numericDocId}`;

    return this.http.delete(url, {
      headers: this.getAuthHeaders(false),
      observe: 'response'
    }).pipe(
      map(response => {
        return response.body || { success: true };
      }),
      catchError(error => {
        console.error('Error deleting document:', error);
        return throwError(() => ({
          ...error,
          message: error.error?.message || error.message || `Error ${error.status}: ${error.statusText || 'Unknown error'}`
        }));
      })
    );
  }

  getVersionHistory(caseId: string, documentId: string): Observable<any> {
    if (!caseId || !documentId) {
      console.error('Case ID and Document ID are required to get version history');
      return throwError(() => new Error('Case ID and Document ID are required'));
    }

    const url = `${this.apiUrl}/${caseId}/documents/${documentId}/versions`;
    
    return this.http.get<any>(url, { headers: this.getAuthHeaders(false) }).pipe(
      catchError(error => {
        console.error('Error fetching version history:', error);
        return throwError(() => error);
      })
    );
  }

  getDocument(caseId: string, documentId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${caseId}/documents/${documentId}`);
  }

  uploadVersion(caseId: string, documentId: string, file: File, comment?: string): Observable<any> {
    if (!caseId || !documentId) {
      console.error('Case ID and Document ID are required to upload a new version');
      return throwError(() => new Error('Case ID and Document ID are required'));
    }

    const url = `${this.apiUrl}/${caseId}/documents/${documentId}/versions`;
    
    // Create FormData to send file and comment
    const formData = new FormData();
    formData.append('file', file);
    if (comment) {
      formData.append('comment', comment);
    }
    
    return this.http.post<any>(
      url, 
      formData, 
      {
        headers: this.getAuthHeaders(true),
        reportProgress: true,
        observe: 'events'
      }
    ).pipe(
      map(event => {
        if (event.type === HttpEventType.UploadProgress) {
          const progress = Math.round(100 * event.loaded / (event.total || event.loaded));
          return { type: 'UploadProgress', loaded: event.loaded, total: event.total, progress };
        } else if (event.type === HttpEventType.Response) {
          return event.body;
        }
        return event;
      }),
      catchError(error => {
        console.error('Error uploading new version:', error);
        return throwError(() => error);
      })
    );
  }

  private getAuthHeaders(isFormData: boolean): HttpHeaders {
    // For FormData, we don't set the Content-Type as the browser will set it automatically
    // with the correct boundary parameter
    if (isFormData) {
      return new HttpHeaders({
        'Authorization': `Bearer ${localStorage.getItem(Key.TOKEN)}`
      });
    }
    
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem(Key.TOKEN)}`
    });
  }
} 