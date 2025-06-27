import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { CustomHttpResponse } from '../interface/custom-http-response';

export interface CaseClientPermissions {
  viewDocuments: boolean;
  uploadDocuments: boolean;
  viewBilling: boolean;
  viewCommunications: boolean;
  viewTimeline: boolean;
}

export interface CaseClientAssociation {
  id: number;
  caseId: number;
  clientId: number;
  accessLevel: 'FULL' | 'LIMITED' | 'READ_ONLY';
  permissions: CaseClientPermissions;
  createdAt: Date;
  expiresAt?: Date;
  createdBy?: number;
  // Related data
  caseDetails?: any;
  clientDetails?: any;
}

export interface CaseClientAssociationRequest {
  caseId: number;
  clientId: number;
  accessLevel: 'FULL' | 'LIMITED' | 'READ_ONLY';
  permissions: CaseClientPermissions;
  expiresAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class CaseClientService {
  private readonly baseUrl = `${environment.apiUrl}/api/case-client`;

  constructor(private http: HttpClient) {}

  /**
   * Assign a client to a case with specific permissions
   */
  assignClientToCase(request: CaseClientAssociationRequest): Observable<CustomHttpResponse<CaseClientAssociation>> {
    return this.http.post<CustomHttpResponse<CaseClientAssociation>>(
      `${this.baseUrl}/associations`,
      request
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get all cases for a specific client
   */
  getClientCases(clientId: number, page = 0, size = 10): Observable<CustomHttpResponse<any>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<CustomHttpResponse<any>>(
      `${this.baseUrl}/clients/${clientId}/cases`,
      { params }
    ).pipe(
      catchError(error => {
        // Fallback for when API is not available
        console.warn('Case-client API not available, using fallback data');
        return of({
          statusCode: 200,
          statusMessage: 'OK',
          message: 'Fallback data',
          data: {
            content: [
              {
                id: 1,
                caseNumber: 'CASE-2024-001',
                title: 'Contract Dispute - ABC Corp',
                status: 'Active',
                attorney: 'John Smith',
                lastUpdate: new Date(),
                nextHearing: '2024-02-15',
                permissions: {
                  viewDocuments: true,
                  uploadDocuments: false,
                  viewBilling: true,
                  viewCommunications: true,
                  viewTimeline: true
                }
              },
              {
                id: 2,
                caseNumber: 'CASE-2024-002',
                title: 'Employment Matter',
                status: 'In Progress',
                attorney: 'Jane Doe',
                lastUpdate: new Date(),
                nextHearing: '2024-02-20',
                permissions: {
                  viewDocuments: true,
                  uploadDocuments: true,
                  viewBilling: true,
                  viewCommunications: true,
                  viewTimeline: true
                }
              }
            ],
            totalElements: 2,
            totalPages: 1,
            number: 0
          }
        } as CustomHttpResponse<any>);
      })
    );
  }

  /**
   * Get all cases for a specific user (attorney, paralegal, etc.)
   */
  getUserCases(userId: number, page = 0, size = 10): Observable<CustomHttpResponse<any>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<CustomHttpResponse<any>>(
      `${this.baseUrl}/users/${userId}/cases`,
      { params }
    ).pipe(
      catchError(error => {
        // Try alternative endpoint
        console.warn('User-cases API not available, trying alternative endpoint');
        return this.http.get<CustomHttpResponse<any>>(
          `${environment.apiUrl}/api/cases/user/${userId}`,
          { params }
        ).pipe(
          catchError(error2 => {
            // Fallback for when API is not available
            console.warn('Alternative API also not available, using fallback data');
            return of({
              statusCode: 200,
              statusMessage: 'OK',
              message: 'Fallback data',
              data: {
                content: [
                  {
                    id: 1,
                    caseNumber: 'CASE-2024-001',
                    title: 'Contract Dispute - ABC Corp',
                    status: 'Active',
                    attorney: 'Current User',
                    lastUpdate: new Date(),
                    nextHearing: '2024-02-15',
                    role: 'Attorney',
                    permissions: {
                      viewDocuments: true,
                      uploadDocuments: true,
                      viewBilling: true,
                      viewCommunications: true,
                      viewTimeline: true
                    }
                  },
                  {
                    id: 3,
                    caseNumber: 'CASE-2024-003',
                    title: 'Intellectual Property Case',
                    status: 'Active',
                    attorney: 'Current User',
                    lastUpdate: new Date(),
                    nextHearing: '2024-02-25',
                    role: 'Paralegal',
                    permissions: {
                      viewDocuments: true,
                      uploadDocuments: false,
                      viewBilling: false,
                      viewCommunications: true,
                      viewTimeline: true
                    }
                  }
                ],
                totalElements: 2,
                totalPages: 1,
                number: 0
              }
            } as CustomHttpResponse<any>);
          })
        );
      })
    );
  }

  /**
   * Get all clients for a specific case
   */
  getCaseClients(caseId: number): Observable<CustomHttpResponse<CaseClientAssociation[]>> {
    return this.http.get<CustomHttpResponse<CaseClientAssociation[]>>(
      `${this.baseUrl}/cases/${caseId}/clients`
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Update client's access permissions for a case
   */
  updateClientCaseAccess(
    associationId: number, 
    permissions: Partial<CaseClientPermissions>
  ): Observable<CustomHttpResponse<CaseClientAssociation>> {
    return this.http.patch<CustomHttpResponse<CaseClientAssociation>>(
      `${this.baseUrl}/associations/${associationId}`,
      { permissions }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Revoke client's access to a case
   */
  revokeClientCaseAccess(associationId: number): Observable<CustomHttpResponse<void>> {
    return this.http.delete<CustomHttpResponse<void>>(
      `${this.baseUrl}/associations/${associationId}`
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Check if a client has access to a specific case
   */
  checkClientCaseAccess(clientId: number, caseId: number): Observable<boolean> {
    return this.http.get<CustomHttpResponse<{ hasAccess: boolean }>>(
      `${this.baseUrl}/check-access`,
      {
        params: new HttpParams()
          .set('clientId', clientId.toString())
          .set('caseId', caseId.toString())
      }
    ).pipe(
      map(response => response.data?.hasAccess || false),
      catchError(() => of(false))
    );
  }

  /**
   * Get specific case details for a client (with permission filtering)
   */
  getClientCaseDetails(clientId: number, caseId: number): Observable<CustomHttpResponse<any>> {
    return this.http.get<CustomHttpResponse<any>>(
      `${this.baseUrl}/clients/${clientId}/cases/${caseId}`
    ).pipe(
      catchError(error => {
        // Fallback for when API is not available
        console.warn('Case details API not available, using fallback data');
        return of({
          statusCode: 200,
          statusMessage: 'OK',
          message: 'Fallback data',
          data: {
            id: caseId,
            caseNumber: `CASE-2024-${String(caseId).padStart(3, '0')}`,
            title: 'Sample Case',
            status: 'Active',
            description: 'This is a sample case with limited information due to permissions.',
            attorney: 'John Smith',
            createdDate: new Date('2024-01-01'),
            lastUpdate: new Date(),
            nextHearing: '2024-02-15',
            documents: [], // Would be filtered based on permissions
            communications: [], // Would be filtered based on permissions
            timeline: [], // Would be filtered based on permissions
            permissions: {
              viewDocuments: true,
              uploadDocuments: false,
              viewBilling: true,
              viewCommunications: true,
              viewTimeline: true
            }
          }
        } as CustomHttpResponse<any>);
      })
    );
  }

  /**
   * Get documents for a case (filtered by client permissions)
   */
  getClientCaseDocuments(clientId: number, caseId: number, page = 0, size = 10): Observable<CustomHttpResponse<any>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<CustomHttpResponse<any>>(
      `${this.baseUrl}/clients/${clientId}/cases/${caseId}/documents`,
      { params }
    ).pipe(
      catchError(error => {
        // Return empty array if no access
        return of({
          statusCode: 200,
          statusMessage: 'OK',
          message: 'No documents available',
          data: {
            content: [],
            totalElements: 0,
            totalPages: 0,
            number: 0
          }
        } as CustomHttpResponse<any>);
      })
    );
  }

  /**
   * Get billing information for a case (if client has permission)
   */
  getClientCaseBilling(clientId: number, caseId: number): Observable<CustomHttpResponse<any>> {
    return this.http.get<CustomHttpResponse<any>>(
      `${this.baseUrl}/clients/${clientId}/cases/${caseId}/billing`
    ).pipe(
      catchError(error => {
        if (error.status === 403) {
          return throwError(() => new Error('No permission to view billing information'));
        }
        return this.handleError(error);
      })
    );
  }

  /**
   * Get case communications for a client
   */
  getClientCaseCommunications(clientId: number, caseId: number, page = 0, size = 10): Observable<CustomHttpResponse<any>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<CustomHttpResponse<any>>(
      `${this.baseUrl}/clients/${clientId}/cases/${caseId}/communications`,
      { params }
    ).pipe(
      catchError(error => {
        return of({
          statusCode: 200,
          statusMessage: 'OK',
          message: 'No communications available',
          data: {
            content: [],
            totalElements: 0,
            totalPages: 0,
            number: 0
          }
        } as CustomHttpResponse<any>);
      })
    );
  }

  /**
   * Get case timeline for a client
   */
  getClientCaseTimeline(clientId: number, caseId: number): Observable<CustomHttpResponse<any[]>> {
    return this.http.get<CustomHttpResponse<any[]>>(
      `${this.baseUrl}/clients/${clientId}/cases/${caseId}/timeline`
    ).pipe(
      catchError(error => {
        return of({
          statusCode: 200,
          statusMessage: 'OK',
          message: 'No timeline data available',
          data: []
        } as CustomHttpResponse<any[]>);
      })
    );
  }

  /**
   * Upload document to case (if client has permission)
   */
  uploadClientCaseDocument(clientId: number, caseId: number, file: File, description?: string): Observable<CustomHttpResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);
    if (description) {
      formData.append('description', description);
    }

    return this.http.post<CustomHttpResponse<any>>(
      `${this.baseUrl}/clients/${clientId}/cases/${caseId}/documents`,
      formData
    ).pipe(
      catchError(error => {
        if (error.status === 403) {
          return throwError(() => new Error('No permission to upload documents'));
        }
        return this.handleError(error);
      })
    );
  }

  /**
   * Get all associations for reporting/admin purposes
   */
  getAllAssociations(page = 0, size = 10, filters?: any): Observable<CustomHttpResponse<any>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key] !== null && filters[key] !== undefined) {
          params = params.set(key, filters[key].toString());
        }
      });
    }

    return this.http.get<CustomHttpResponse<any>>(
      `${this.baseUrl}/associations`,
      { params }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Batch assign clients to a case
   */
  batchAssignClients(caseId: number, clientIds: number[], accessLevel: 'FULL' | 'LIMITED' | 'READ_ONLY'): Observable<CustomHttpResponse<CaseClientAssociation[]>> {
    const defaultPermissions: CaseClientPermissions = {
      viewDocuments: true,
      uploadDocuments: accessLevel === 'FULL',
      viewBilling: accessLevel !== 'READ_ONLY',
      viewCommunications: true,
      viewTimeline: true
    };

    return this.http.post<CustomHttpResponse<CaseClientAssociation[]>>(
      `${this.baseUrl}/cases/${caseId}/batch-assign`,
      {
        clientIds,
        accessLevel,
        permissions: defaultPermissions
      }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Error handling
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Server-side error
      errorMessage = error.error?.message || `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    
    console.error('CaseClient API Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}