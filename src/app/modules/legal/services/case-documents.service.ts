import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpEventType } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { CustomHttpResponse } from '../../../core/models/custom-http-response.model';

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
    const url = `${this.apiUrl}/${caseId}/documents`;
    
    return this.http.get<any>(url, { headers: this.getAuthHeaders(false) }).pipe(
      tap(response => console.log('Documents API response:', response)),
      map(response => {
        // Enhanced response handling for different API formats
        if (response && Array.isArray(response)) {
          console.log('Found direct array response');
          return response;
        } 
        
        if (response && response.data) {
          if (Array.isArray(response.data)) {
            console.log('Found data array response');
            return response.data;
          }
          
          if (response.data.documents && Array.isArray(response.data.documents)) {
            console.log('Found nested documents array response');
            return response.data.documents;
          }
          
          // Additional handling: data contains a single document property with array
          if (response.data.document && Array.isArray(response.data.document)) {
            console.log('Found nested document array response');
            return response.data.document;
          }
          
          // Additional handling: check for user and documents under data
          if (response.data.user && response.data.documents && Array.isArray(response.data.documents)) {
            console.log('Found documents with user context');
            return response.data.documents;
          }
        } 
        
        if (response && response.documents && Array.isArray(response.documents)) {
          console.log('Found documents property with array');
          return response.documents;
        }
        
        if (response && response.document && Array.isArray(response.document)) {
          console.log('Found document property with array');
          return response.document;
        }
        
        // If we get here and response is an object, search for any array property
        if (response && typeof response === 'object') {
          for (const key in response) {
            if (Array.isArray(response[key])) {
              console.log(`Found array in property: ${key}`);
              return response[key];
            }
          }
        }
        
        // If we can't determine the structure or no documents found
        console.warn('Unexpected response format or no documents found:', response);
        return [];
      }),
      catchError(error => {
        console.error('Error fetching documents:', error);
        return throwError(() => new Error(`Failed to fetch documents: ${error.message || 'Unknown error'}`));
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

  downloadDocument(caseId: string, documentId: string): Observable<Blob> {
    if (!caseId || !documentId) {
      console.error('Case ID and Document ID are required to download a document');
      return throwError(() => new Error('Case ID and Document ID are required'));
    }

    const url = `${this.apiUrl}/${caseId}/documents/${documentId}/download`;
    
    return this.http.get(url, {
      headers: this.getAuthHeaders(false),
      responseType: 'blob'
    }).pipe(
      tap(() => console.log('Document downloaded successfully')),
      catchError(error => {
        console.error('Error downloading document:', error);
        return throwError(() => error);
      })
    );
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
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      });
    }
    
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    });
  }
} 