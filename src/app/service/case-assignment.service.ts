import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CustomHttpResponse as ApiResponse } from '../interface/custom-http-response';
import { 
  CaseAssignment, 
  CaseAssignmentRequest, 
  CaseTransferRequest,
  UserWorkload,
  WorkloadAnalytics,
  AssignmentRule,
  AssignmentHistory,
  CaseTransferRequestDTO
} from '../interface/case-assignment';

@Injectable({
  providedIn: 'root'
})
export class CaseAssignmentService {
  private readonly apiUrl = 'http://localhost:8085/api/legal';

  constructor(private http: HttpClient) {}

  // Assignment Management
  assignCase(request: CaseAssignmentRequest): Observable<ApiResponse<CaseAssignment>> {
    return this.http.post<ApiResponse<CaseAssignment>>(
      `${this.apiUrl}/case-assignments/assign`, 
      request
    );
  }

  autoAssignCase(caseId: number): Observable<ApiResponse<CaseAssignment>> {
    return this.http.post<ApiResponse<CaseAssignment>>(
      `${this.apiUrl}/case-assignments/auto-assign/${caseId}`, 
      {}
    );
  }

  transferCase(request: CaseTransferRequest): Observable<ApiResponse<CaseAssignment>> {
    return this.http.post<ApiResponse<CaseAssignment>>(
      `${this.apiUrl}/case-assignments/transfer`, 
      request
    );
  }

  unassignCase(caseId: number, userId: number, reason: string): Observable<ApiResponse<void>> {
    // Use the correct backend controller endpoint: DELETE /case-assignments/{caseId}/user/{userId}
    return this.http.delete<ApiResponse<void>>(
      `${this.apiUrl}/case-assignments/${caseId}/user/${userId}`,
      { 
        params: new HttpParams().set('reason', reason || 'Unassigned by user')
      }
    );
  }

  getCaseAssignments(caseId: number): Observable<ApiResponse<CaseAssignment[]>> {
    return this.http.get<ApiResponse<any>>(
      `${this.apiUrl}/case-assignments/case/${caseId}`
    ).pipe(
      map(response => ({
        ...response,
        data: response.data?.assignments || response.data || []
      }))
    );
  }

  /**
   * Get all assignments with pagination
   */
  getAllAssignments(page: number = 0, size: number = 100): Observable<ApiResponse<CaseAssignment[]>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<ApiResponse<any>>(
      `${this.apiUrl}/case-assignments`,
      { params }
    ).pipe(
      map(response => ({
        ...response,
        // Backend returns { data: { assignments: Page } } where Page has content array
        data: response.data?.assignments?.content || response.data?.assignments || response.data?.content || []
      }))
    );
  }

  getUserAssignments(userId: number, page: number = 0, size: number = 10): Observable<ApiResponse<CaseAssignment[]>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    
    return this.http.get<ApiResponse<any>>(
      `${this.apiUrl}/case-assignments/user/${userId}`,
      { params }
    ).pipe(
      map(response => ({
        ...response,
        // Backend returns { data: { assignments: Page } } where Page has content array
        data: response.data?.assignments?.content || response.data?.assignments || []
      }))
    );
  }

  getPrimaryAssignment(caseId: number): Observable<ApiResponse<CaseAssignment>> {
    return this.http.get<ApiResponse<CaseAssignment>>(
      `${this.apiUrl}/case-assignments/case/${caseId}/primary`
    );
  }

  getTeamMembers(caseId: number): Observable<ApiResponse<CaseAssignment[]>> {
    return this.http.get<ApiResponse<any>>(
      `${this.apiUrl}/case-assignments/case/${caseId}/team`
    ).pipe(
      map(response => ({
        ...response,
        data: response.data?.teamMembers || response.data || []
      }))
    );
  }

  // Workload Management
  calculateUserWorkload(userId: number): Observable<ApiResponse<UserWorkload>> {
    return this.http.get<ApiResponse<any>>(
      `${this.apiUrl}/case-assignments/workload/user/${userId}`
    ).pipe(
      map(response => ({
        ...response,
        data: response.data?.workload || response.data || {}
      }))
    );
  }

  getTeamWorkload(managerId: number): Observable<ApiResponse<UserWorkload[]>> {
    return this.http.get<ApiResponse<UserWorkload[]>>(
      `${this.apiUrl}/case-assignments/workload/team/${managerId}`
    );
  }

  getWorkloadAnalytics(): Observable<ApiResponse<WorkloadAnalytics>> {
    return this.http.get<ApiResponse<WorkloadAnalytics>>(
      `${this.apiUrl}/case-assignments/workload/analytics`
    );
  }

  // Assignment Rules
  getActiveRules(): Observable<ApiResponse<AssignmentRule[]>> {
    return this.http.get<ApiResponse<AssignmentRule[]>>(
      `${this.apiUrl}/case-assignments/rules`
    );
  }

  createRule(rule: AssignmentRule): Observable<ApiResponse<AssignmentRule>> {
    return this.http.post<ApiResponse<AssignmentRule>>(
      `${this.apiUrl}/case-assignments/rules`, 
      rule
    );
  }

  updateRule(ruleId: number, rule: AssignmentRule): Observable<ApiResponse<void>> {
    return this.http.put<ApiResponse<void>>(
      `${this.apiUrl}/case-assignments/rules/${ruleId}`, 
      rule
    );
  }

  // History and Transfers
  getAssignmentHistory(caseId: number, page: number = 0, size: number = 10): Observable<ApiResponse<AssignmentHistory[]>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    
    return this.http.get<ApiResponse<AssignmentHistory[]>>(
      `${this.apiUrl}/case-assignments/history/${caseId}`,
      { params }
    );
  }

  getPendingTransferRequests(page: number = 0, size: number = 10): Observable<ApiResponse<CaseTransferRequestDTO[]>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<ApiResponse<any>>(
      `${this.apiUrl}/case-assignments/transfer-requests`,
      { params }
    ).pipe(
      map(response => {
        // Backend returns { data: { requests: Page<CaseTransferRequestDTO> } }
        let transfers: any[] = [];
        if (response.data?.requests?.content) {
          transfers = response.data.requests.content;
        } else if (Array.isArray(response.data?.requests)) {
          transfers = response.data.requests;
        } else if (response.data?.content) {
          transfers = response.data.content;
        } else if (Array.isArray(response.data)) {
          transfers = response.data;
        }
        return {
          ...response,
          data: transfers
        };
      })
    );
  }

  approveTransfer(requestId: number, notes: string): Observable<ApiResponse<CaseTransferRequestDTO>> {
    return this.http.post<ApiResponse<CaseTransferRequestDTO>>(
      `${this.apiUrl}/case-assignments/transfer-requests/${requestId}/approve`,
      { notes }
    );
  }

  rejectTransfer(requestId: number, notes: string): Observable<ApiResponse<CaseTransferRequestDTO>> {
    return this.http.post<ApiResponse<CaseTransferRequestDTO>>(
      `${this.apiUrl}/case-assignments/transfer-requests/${requestId}/reject`,
      { notes }
    );
  }
}