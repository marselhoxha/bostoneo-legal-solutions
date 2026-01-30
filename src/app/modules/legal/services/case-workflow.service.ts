import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { UserService } from '../../../service/user.service';

export interface WorkflowStep {
  number: number;
  name: string;
  type: 'display' | 'synthesis' | 'generation' | 'action' | 'integration';
  description: string;
}

export interface WorkflowTemplate {
  id: number;
  name: string;
  description: string;
  templateType: string;
  stepsConfig: {
    steps: WorkflowStep[];
  };
  isSystem: boolean;
  createdAt: string;
}

export interface WorkflowStepExecution {
  id: number;
  stepNumber: number;
  stepName: string;
  stepType: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'WAITING_USER' | 'SKIPPED';
  outputData?: any;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface WorkflowExecution {
  id: number;
  name?: string;
  collectionId: number;
  legalCase?: {
    id: number;
    caseName?: string;
    caseNumber?: string;
    clientName?: string;
  };
  template: WorkflowTemplate;
  status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'WAITING_USER' | 'COMPLETED' | 'FAILED';
  currentStep: number;
  totalSteps: number;
  progressPercentage: number;
  stepExecutions?: WorkflowStepExecution[];
  startedAt?: string;
  completedAt?: string;
  dueDate?: string;
  createdAt: string;
}

export type WorkflowUrgency = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface WorkflowRecommendation {
  templateType: string;
  templateName: string;
  templateId: number;
  caseId: number;
  caseNumber: string;
  caseTitle: string;
  reason: string;
  urgency: WorkflowUrgency;
  deadlineDate?: string;
  daysUntilDeadline?: number;
  isDismissed: boolean;
  dismissedAt?: string;
  createdAt: string;
  badgeColor?: string;
  urgencyLabel?: string;
  // Document availability (for smart document loading)
  documentsRequired?: boolean;
  availableDocuments?: number;
  hasDocuments?: boolean;
}

export interface CaseDocument {
  id: number;
  fileName: string;
  detectedType: string;
  analyzedAt: string;
  riskLevel?: string;
}

export interface CaseDocumentsResponse {
  caseId: number;
  caseNumber: string;
  caseTitle: string;
  documents: CaseDocument[];
  hasDocuments: boolean;
}

export interface RecommendationSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface RecommendationsResponse {
  recommendations: WorkflowRecommendation[];
  count: number;
  summary?: RecommendationSummary;
  caseId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class CaseWorkflowService {
  private apiUrl = `${environment.apiUrl}/api/ai/case-workflow`;

  constructor(
    private http: HttpClient,
    private userService: UserService
  ) {}

  private getUserId(): number | null {
    return this.userService.getCurrentUserId();
  }

  getWorkflowTemplates(): Observable<WorkflowTemplate[]> {
    return this.http.get<any>(`${this.apiUrl}/templates`).pipe(
      map(response => response.data?.templates || [])
    );
  }

  getWorkflowTemplate(id: number): Observable<WorkflowTemplate> {
    return this.http.get<any>(`${this.apiUrl}/templates/${id}`).pipe(
      map(response => response.data?.template)
    );
  }

  getUserExecutions(): Observable<WorkflowExecution[]> {
    const userId = this.getUserId();
    const params = userId ? `?userId=${userId}` : '';
    return this.http.get<any>(`${this.apiUrl}/executions${params}`).pipe(
      map(response => response.data?.executions || [])
    );
  }

  /**
   * Get user executions with cache-busting for polling
   */
  getUserExecutionsNoCache(): Observable<WorkflowExecution[]> {
    const userId = this.getUserId();
    const timestamp = Date.now();
    const params = userId ? `?userId=${userId}&_t=${timestamp}` : `?_t=${timestamp}`;
    return this.http.get<any>(`${this.apiUrl}/executions${params}`).pipe(
      map(response => response.data?.executions || [])
    );
  }

  getExecution(id: number): Observable<WorkflowExecution> {
    return this.http.get<any>(`${this.apiUrl}/executions/${id}`).pipe(
      map(response => response.data?.execution)
    );
  }

  getExecutionWithSteps(id: number): Observable<WorkflowExecution> {
    return this.http.get<any>(`${this.apiUrl}/executions/${id}/details`).pipe(
      map(response => response.data?.execution)
    );
  }

  /**
   * Get execution with steps and cache-busting for polling
   */
  getExecutionWithStepsNoCache(id: number): Observable<WorkflowExecution> {
    const timestamp = Date.now();
    return this.http.get<any>(`${this.apiUrl}/executions/${id}/details?_t=${timestamp}`).pipe(
      map(response => response.data?.execution)
    );
  }

  startWorkflow(
    templateId: number,
    documentIds: number[],
    collectionId?: number,
    caseId?: number,
    name?: string
  ): Observable<WorkflowExecution> {
    const userId = this.getUserId();
    return this.http.post<any>(`${this.apiUrl}/start`, {
      templateId,
      documentIds,
      collectionId,
      caseId,
      name,
      userId
    }).pipe(
      map(response => response.data?.execution)
    );
  }

  resumeWorkflow(executionId: number, stepId: number, userInput: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/executions/${executionId}/steps/${stepId}/resume`,
      userInput
    );
  }

  pauseWorkflow(executionId: number): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/executions/${executionId}/pause`,
      {}
    );
  }

  cancelWorkflow(executionId: number): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/executions/${executionId}/cancel`,
      {}
    );
  }

  // Helper to get template emoji based on type
  getTemplateIcon(templateType: string): string {
    const normalizedType = templateType?.toLowerCase();
    const emojis: Record<string, string> = {
      'complaint_response': '🩹',      // Personal Injury - bandage
      'contract_review': '📄',         // Contract Litigation - document
      'motion_opposition': '⚖️',       // Motion/Legal - scales
      'discovery_response': '🔍',      // Discovery - magnifying glass
      'due_diligence': '🏠',           // Estate Planning - house
      'immigration': '✈️',             // Immigration - airplane
      'personal_injury': '🩹',         // Personal Injury - bandage
      'contract_litigation': '📄',     // Contract - document
      'estate_planning': '🏠',         // Estate - house
      'custom': '📋',                  // Custom workflow
    };
    return emojis[normalizedType] || '📋';
  }

  // Helper to get template background color based on type
  getTemplateColor(templateType: string): string {
    const normalizedType = templateType?.toLowerCase();
    const colors: Record<string, string> = {
      'complaint_response': '#FECACA',   // Pink/salmon for personal injury
      'contract_review': '#BFDBFE',      // Light blue for contract
      'motion_opposition': '#E9D5FF',    // Light purple for legal
      'discovery_response': '#FED7AA',   // Light orange for discovery
      'due_diligence': '#A7F3D0',        // Mint/teal for estate
      'immigration': '#FEF3C7',          // Yellow/cream for immigration
      'personal_injury': '#FECACA',      // Pink/salmon
      'contract_litigation': '#BFDBFE',  // Light blue
      'estate_planning': '#A7F3D0',      // Mint/teal
      'custom': '#E5E7EB',               // Gray for custom
    };
    return colors[normalizedType] || '#E5E7EB';
  }

  // =====================================================
  // CASE DOCUMENTS FOR WORKFLOW
  // =====================================================

  /**
   * Get analyzed documents for a case to use in workflow
   */
  getCaseDocuments(caseId: number): Observable<CaseDocumentsResponse> {
    return this.http.get<any>(`${this.apiUrl}/case/${caseId}/documents`).pipe(
      map(response => ({
        caseId: response.data?.caseId,
        caseNumber: response.data?.caseNumber,
        caseTitle: response.data?.caseTitle,
        documents: response.data?.documents || [],
        hasDocuments: response.data?.hasDocuments || false
      }))
    );
  }

  // =====================================================
  // WORKFLOW RECOMMENDATIONS
  // =====================================================

  /**
   * Get workflow recommendations for a specific case
   */
  getRecommendationsForCase(caseId: number): Observable<RecommendationsResponse> {
    return this.http.get<any>(`${this.apiUrl}/recommendations/case/${caseId}`).pipe(
      map(response => ({
        recommendations: this.enrichRecommendations(response.data?.recommendations || []),
        count: response.data?.count || 0,
        caseId: response.data?.caseId
      }))
    );
  }

  /**
   * Get workflow recommendations for all active cases
   */
  getRecommendationsForAllCases(): Observable<RecommendationsResponse> {
    return this.http.get<any>(`${this.apiUrl}/recommendations/all`).pipe(
      map(response => ({
        recommendations: this.enrichRecommendations(response.data?.recommendations || []),
        count: response.data?.count || 0,
        summary: response.data?.summary
      }))
    );
  }

  /**
   * Enrich recommendations with UI-friendly properties
   */
  private enrichRecommendations(recommendations: WorkflowRecommendation[]): WorkflowRecommendation[] {
    return recommendations.map(rec => ({
      ...rec,
      badgeColor: this.getUrgencyBadgeColor(rec.urgency),
      urgencyLabel: this.getUrgencyLabel(rec.daysUntilDeadline)
    }));
  }

  /**
   * Get badge color class for urgency level
   */
  getUrgencyBadgeColor(urgency: WorkflowUrgency): string {
    const colors: Record<WorkflowUrgency, string> = {
      'CRITICAL': 'red',
      'HIGH': 'orange',
      'MEDIUM': 'yellow',
      'LOW': 'green'
    };
    return colors[urgency] || 'gray';
  }

  /**
   * Get human-readable urgency label
   */
  getUrgencyLabel(daysUntilDeadline?: number): string {
    if (daysUntilDeadline === undefined || daysUntilDeadline === null) {
      return 'Suggested';
    }

    if (daysUntilDeadline < 0) {
      return `Overdue by ${Math.abs(daysUntilDeadline)} day(s)`;
    } else if (daysUntilDeadline === 0) {
      return 'Due today';
    } else if (daysUntilDeadline === 1) {
      return 'Due tomorrow';
    } else {
      return `Due in ${daysUntilDeadline} days`;
    }
  }

  /**
   * Get urgency badge background color (hex)
   */
  getUrgencyBadgeBgColor(urgency: WorkflowUrgency): string {
    const colors: Record<WorkflowUrgency, string> = {
      'CRITICAL': '#FEE2E2',  // red-100
      'HIGH': '#FFEDD5',      // orange-100
      'MEDIUM': '#FEF3C7',    // yellow-100
      'LOW': '#D1FAE5'        // green-100
    };
    return colors[urgency] || '#F3F4F6';
  }

  /**
   * Get urgency badge text color (hex)
   */
  getUrgencyBadgeTextColor(urgency: WorkflowUrgency): string {
    const colors: Record<WorkflowUrgency, string> = {
      'CRITICAL': '#991B1B',  // red-800
      'HIGH': '#9A3412',      // orange-800
      'MEDIUM': '#92400E',    // yellow-800
      'LOW': '#065F46'        // green-800
    };
    return colors[urgency] || '#374151';
  }
}
