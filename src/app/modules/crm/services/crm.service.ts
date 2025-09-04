import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface IntakeSubmission {
  id: number;
  formId: number;
  leadId?: number;
  submissionData: any;
  ipAddress: string;
  userAgent: string;
  referrer: string;
  status: string;
  priorityScore: number;
  reviewedBy?: number;
  reviewedAt?: Date;
  notes?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  intakeForm?: {
    id: number;
    name: string;
    practiceArea: string;
  };
  lead?: any;
  reviewer?: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

export interface CrmDashboardData {
  submissionCounts: { [key: string]: number };
  practiceAreaCounts: { [key: string]: number };
  priorityRanges: { [key: string]: number };
  recentSubmissions: IntakeSubmission[];
  conversionStats: {
    totalSubmissions: number;
    convertedToLeads: number;
    conversionRate: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class CrmService {
  private apiUrl = `${environment.apiUrl}/api/crm`;

  constructor(private http: HttpClient) {}

  // Dashboard
  getDashboardData(): Observable<CrmDashboardData> {
    return this.http.get<CrmDashboardData>(`${this.apiUrl}/dashboard`);
  }

  // Intake Submissions - using the same pattern as ClientService
  getIntakeSubmissions$ = (params?: any): Observable<any> => 
    this.http.get<any>(`${this.apiUrl}/intake-submissions`, { params })
      .pipe(
        tap(response => console.log('✅ CRM Submissions Response:', response)),
        catchError(error => {
          console.error('❌ CRM Submissions Error:', error);
          return throwError(() => error);
        })
      );

  getIntakeSubmissionById(id: number): Observable<IntakeSubmission> {
    return this.http.get<IntakeSubmission>(`${this.apiUrl}/intake-submissions/${id}`);
  }

  updateIntakeSubmission(id: number, data: any): Observable<IntakeSubmission> {
    return this.http.put<IntakeSubmission>(`${this.apiUrl}/intake-submissions/${id}`, data);
  }

  reviewSubmission(id: number, notes: string): Observable<IntakeSubmission> {
    return this.http.put<IntakeSubmission>(`${this.apiUrl}/intake-submissions/${id}/review`, { reviewNotes: notes });
  }

  convertToLead(id: number, assignedTo: number, notes: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/intake-submissions/${id}/convert-to-lead`, { 
      assignedTo, 
      notes 
    });
  }

  rejectSubmission(id: number, reason: string): Observable<IntakeSubmission> {
    return this.http.put<IntakeSubmission>(`${this.apiUrl}/intake-submissions/${id}/reject`, { rejectionReason: reason });
  }

  markAsSpam(id: number, reason: string): Observable<IntakeSubmission> {
    return this.http.put<IntakeSubmission>(`${this.apiUrl}/intake-submissions/${id}/mark-spam`, { spamReason: reason });
  }

  // Bulk operations
  bulkReview(submissionIds: number[], notes: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/intake-submissions/bulk/review`, {
      submissionIds,
      reviewNotes: notes
    });
  }

  bulkConvertToLead(submissionIds: number[], assignedTo: number, notes: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/intake-submissions/bulk/convert-to-leads`, {
      submissionIds,
      assignToAttorney: assignedTo,
      notes
    });
  }

  bulkReject(submissionIds: number[], reason: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/intake-submissions/bulk/reject`, {
      submissionIds,
      rejectionReason: reason
    });
  }

  bulkMarkAsSpam(submissionIds: number[], reason: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/intake-submissions/bulk/mark-spam`, {
      submissionIds,
      spamReason: reason
    });
  }

  // Statistics
  getSubmissionCountsByStatus(): Observable<{ [key: string]: number }> {
    return this.http.get<{ [key: string]: number }>(`${this.apiUrl}/submissions/stats/by-status`);
  }

  getSubmissionCountsByPracticeArea(): Observable<{ [key: string]: number }> {
    return this.http.get<{ [key: string]: number }>(`${this.apiUrl}/submissions/stats/by-practice-area`);
  }

  getSubmissionsByPriorityRange(): Observable<{ [key: string]: number }> {
    return this.http.get<{ [key: string]: number }>(`${this.apiUrl}/submissions/stats/by-priority-range`);
  }

  getRecentSubmissions(limit: number = 10): Observable<IntakeSubmission[]> {
    return this.http.get<IntakeSubmission[]>(`${this.apiUrl}/submissions/recent`, { 
      params: { limit: limit.toString() } 
    });
  }

  // Lead Management
  getLeads(params?: any): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/leads`, { params });
  }

  getLeadById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/leads/${id}`);
  }

  updateLead(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/leads/${id}`, data);
  }

  // Pipeline Management
  getPipelineStages(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/leads/pipeline/stages`);
  }

  getPipelineSummary(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/leads/pipeline/summary`);
  }

  advanceLeadInPipeline(leadId: number, newStatus: string, notes: string = ''): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/leads/${leadId}/pipeline/advance`, {
      newStatus,
      notes
    });
  }

  moveLeadToStage(leadId: number, stageId: number, notes: string = ''): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/leads/${leadId}/pipeline/move-to-stage`, {
      stageId,
      notes
    });
  }

  // Lead Assignment and Management
  assignLead(leadId: number, assignToUserId: number, notes: string = ''): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/leads/${leadId}/assign`, {
      assignToUserId,
      notes
    });
  }

  scheduleConsultation(leadId: number, consultationDate: string, notes: string = ''): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/leads/${leadId}/schedule-consultation`, {
      consultationDate,
      notes
    });
  }

  addLeadActivity(leadId: number, activityType: string, title: string, description: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/leads/${leadId}/add-activity`, {
      activityType,
      title,
      description
    });
  }

  // Lead Conversion
  canConvertLead(leadId: number, conversionType: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/leads/${leadId}/conversion/can-convert`, {
      params: { conversionType }
    });
  }

  getRequiredConversionFields(leadId: number, conversionType: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/leads/${leadId}/conversion/required-fields`, {
      params: { conversionType }
    });
  }

  convertToClientOnly(leadId: number, clientData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/leads/${leadId}/convert/client-only`, clientData);
  }

  convertToMatterOnly(leadId: number, caseData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/leads/${leadId}/convert/matter-only`, caseData);
  }

  convertToClientAndMatter(leadId: number, conversionData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/leads/${leadId}/convert/client-and-matter`, conversionData);
  }

  // Lead Analytics
  getLeadsAnalyticsSummary(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/leads/analytics/summary`);
  }

  getConversionRates(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/leads/analytics/conversion-rates`);
  }

  // Conflict Checking
  performClientConflictCheck(leadId: number, clientData: any): Observable<any> {
    return this.http.post<any>(`/api/conflict-checks/check-client?leadId=${leadId}`, clientData);
  }

  performMatterConflictCheck(leadId: number, matterData: any): Observable<any> {
    return this.http.post<any>(`/api/conflict-checks/check-matter?leadId=${leadId}`, matterData);
  }

  performFullConflictCheck(leadId: number, conversionData: any): Observable<any> {
    return this.http.post<any>(`/api/conflict-checks/check-full?leadId=${leadId}`, conversionData);
  }

  reviewConflictCheck(conflictCheckId: number, reviewData: any): Observable<any> {
    return this.http.post<any>(`/api/conflict-checks/${conflictCheckId}/review`, reviewData);
  }

  resolveConflict(conflictCheckId: number, resolutionData: any): Observable<any> {
    return this.http.post<any>(`/api/conflict-checks/${conflictCheckId}/resolve`, resolutionData);
  }

  canProceedWithConversion(entityType: string, entityId: number): Observable<any> {
    return this.http.get<any>(`/api/conflict-checks/entity/${entityType}/${entityId}/can-proceed`);
  }

  getConflictChecks(params?: any): Observable<any> {
    return this.http.get<any>('/api/conflict-checks', { params });
  }

  getConflictCheckById(id: number): Observable<any> {
    return this.http.get<any>(`/api/conflict-checks/${id}`);
  }
}