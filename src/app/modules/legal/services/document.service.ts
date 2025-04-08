import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Document } from '../interfaces/document.interface';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private apiUrl = `${environment.apiUrl}/legal/documents`;

  constructor(private http: HttpClient) { }

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

  downloadDocument(id: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/download`, { responseType: 'blob' });
  }
} 