import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { CaseDocument } from '../interfaces/case.interface';

@Injectable({
  providedIn: 'root'
})
export class CaseDocumentsService {
  // Dummy data for demonstration
  private dummyDocuments: CaseDocument[] = [
    {
      id: '1',
      title: 'Initial Complaint',
      type: 'PLEADING',
      fileName: 'complaint.pdf',
      fileUrl: '/assets/documents/complaint.pdf',
      uploadedAt: new Date('2023-05-15T10:30:00'),
      uploadedBy: {
        id: '1',
        name: 'John Doe',
        email: 'john.doe@example.com'
      }
    },
    {
      id: '2',
      title: 'Motion to Dismiss',
      type: 'MOTION',
      fileName: 'motion-dismiss.pdf',
      fileUrl: '/assets/documents/motion-dismiss.pdf',
      uploadedAt: new Date('2023-06-20T14:45:00'),
      uploadedBy: {
        id: '2',
        name: 'Jane Smith',
        email: 'jane.smith@example.com'
      }
    },
    {
      id: '3',
      title: 'Court Order',
      type: 'ORDER',
      fileName: 'court-order.pdf',
      fileUrl: '/assets/documents/court-order.pdf',
      uploadedAt: new Date('2023-07-05T09:15:00'),
      uploadedBy: {
        id: '1',
        name: 'John Doe',
        email: 'john.doe@example.com'
      }
    }
  ];

  constructor(private http: HttpClient) {}

  getDocuments(caseId: string): Observable<CaseDocument[]> {
    // In a real application, this would make an HTTP request to the backend
    // return this.http.get<CaseDocument[]>(`/api/cases/${caseId}/documents`);
    
    // For now, return dummy data
    return of(this.dummyDocuments);
  }

  uploadDocument(caseId: string, title: string, type: string, file: File): Observable<CaseDocument> {
    // In a real application, this would upload the file to the server
    // const formData = new FormData();
    // formData.append('file', file);
    // formData.append('title', title);
    // formData.append('type', type);
    // return this.http.post<CaseDocument>(`/api/cases/${caseId}/documents`, formData);
    
    // For now, create a dummy document
    const newDocument: CaseDocument = {
      id: (this.dummyDocuments.length + 1).toString(),
      title,
      type,
      fileName: file.name,
      fileUrl: `/assets/documents/${file.name}`,
      uploadedAt: new Date(),
      uploadedBy: {
        id: '1',
        name: 'John Doe',
        email: 'john.doe@example.com'
      }
    };
    
    this.dummyDocuments.unshift(newDocument);
    return of(newDocument);
  }

  downloadDocument(caseId: string, documentId: string): Observable<any> {
    // In a real application, this would download the file from the server
    // return this.http.get(`/api/cases/${caseId}/documents/${documentId}/download`, { responseType: 'blob' });
    
    // For now, just log the action
    console.log(`Downloading document ${documentId} for case ${caseId}`);
    return of(null);
  }

  deleteDocument(caseId: string, documentId: string): Observable<void> {
    // In a real application, this would delete the document from the server
    // return this.http.delete<void>(`/api/cases/${caseId}/documents/${documentId}`);
    
    // For now, remove from dummy data
    this.dummyDocuments = this.dummyDocuments.filter(doc => doc.id !== documentId);
    return of(void 0);
  }
} 