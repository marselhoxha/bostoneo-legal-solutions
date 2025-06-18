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

    console.log('Fetching documents for case ID:', caseId);
    // Use the direct document service endpoint that doesn't apply role filtering
    const url = `${environment.apiUrl}/legal/documents/case/${caseId}`;
    
    // Get fresh headers for each request
    const headers = this.getAuthHeaders(false);
    console.log('Request headers:', headers);
    console.log('Request URL:', url);
    console.log('Environment API URL:', environment.apiUrl);
    console.log('Full constructed URL:', url);
    
    return this.http.get<any>(url, { headers }).pipe(
      tap(response => {
        console.log('✅ SUCCESS: Raw documents API response:', response);
        console.log('✅ SUCCESS: Response type:', typeof response);
        console.log('✅ SUCCESS: Response keys:', Object.keys(response || {}));
        console.log('✅ SUCCESS: Response status:', response?.status);
        console.log('✅ SUCCESS: Response data:', response?.data);
      }),
      map(response => {
        // Handle the actual backend response structure
        // Backend may return different formats, so let's handle them all
        if (!response) {
          console.log('Empty response received');
          return [];
        }
        
        // If response is already an array
        if (Array.isArray(response)) {
          console.log('Response is already an array with', response.length, 'items');
          return response;
        }
        
        // If response has documents property directly
        if (response.documents && Array.isArray(response.documents)) {
          console.log('Found documents array with', response.documents.length, 'items');
          return response.documents;
        }
        
        // If response has data.documents structure
        if (response.data && response.data.documents && Array.isArray(response.data.documents)) {
          console.log('Found nested documents array with', response.data.documents.length, 'items');
          return response.data.documents;
        }
        
        // If response has data property that is an array
        if (response.data && Array.isArray(response.data)) {
          console.log('Found data array with', response.data.length, 'items');
          return response.data;
        }
        
        // If response has data property that contains the documents
        if (response.data) {
          console.log('Response has data property:', response.data);
          return response.data;
        }
        
        // Fallback
        console.warn('Unexpected response format, returning as-is:', response);
        return response;
      }),
      catchError(error => {
        console.error('❌ ERROR: Error fetching documents:', error);
        console.error('❌ ERROR: Error status:', error.status);
        console.error('❌ ERROR: Error message:', error.message);
        console.error('❌ ERROR: Error body:', error.error);
        console.error('❌ ERROR: Full error object:', JSON.stringify(error, null, 2));
        
        if (error.status === 401) {
          console.log('❌ ERROR: Authentication error - token may be expired');
          console.log('❌ ERROR: Current token:', localStorage.getItem('token'));
        } else if (error.status === 403) {
          console.log('❌ ERROR: Permission denied for documents');
        } else if (error.status === 404) {
          console.log('❌ ERROR: Case not found or no documents');
        } else if (error.status === 500) {
          console.log('❌ ERROR: Backend internal server error');
          console.log('❌ ERROR: This indicates a problem with the backend service');
          console.log('❌ ERROR: URL that failed:', `${this.apiUrl}/${arguments[0]}/documents`);
        }
        
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
      tap(response => console.log('Document uploaded successfully')),
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
      tap(response => console.log('New version uploaded successfully')),
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
      tap(() => console.log('Version downloaded successfully')),
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
      console.error('Provided values:', { caseId, documentId, numericCaseId, numericDocId });
      return throwError(() => new Error('Invalid ID format'));
    }
    
    // Detailed logging for debugging
    console.log(`%c[DELETE REQUEST] Deleting document: Case ID=${numericCaseId}, Document ID=${numericDocId}`, 'background: blue; color: white; font-weight: bold;');
    
    // Ensure correct API URL format
    const baseUrl = environment.apiUrl;
    const url = `${baseUrl}/legal-case/${numericCaseId}/documents/${numericDocId}`;
    
    console.log('%c[DELETE URL]', 'background: blue; color: white;', url);
    console.log('%c[DELETE HEADERS]', 'background: blue; color: white;', this.getAuthHeaders(false));
    
    return this.http.delete(url, { 
      headers: this.getAuthHeaders(false),
      observe: 'response'
    }).pipe(
      map(response => {
        console.log('%c[DELETE RESPONSE] Success!', 'background: green; color: white; font-weight: bold;');
        console.log('Full response:', response);
        
        return response.body || { success: true };
      }),
      catchError(error => {
        console.error('%c[DELETE ERROR] Failed!', 'background: red; color: white; font-weight: bold;');
        console.error('Error details:', {
          status: error.status,
          statusText: error.statusText,
          url,
          headers: this.getAuthHeaders(false),
          error: error.error
        });
        
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
      tap(response => console.log('Version history fetched successfully')),
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