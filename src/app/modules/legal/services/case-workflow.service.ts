import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';

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

@Injectable({
  providedIn: 'root'
})
export class CaseWorkflowService {
  private apiUrl = `${environment.apiUrl}/api/ai/case-workflow`;

  constructor(private http: HttpClient) {}

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
    return this.http.get<any>(`${this.apiUrl}/executions`).pipe(
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

  startWorkflow(
    templateId: number,
    documentIds: number[],
    collectionId?: number,
    caseId?: number,
    name?: string
  ): Observable<WorkflowExecution> {
    return this.http.post<any>(`${this.apiUrl}/start`, {
      templateId,
      documentIds,
      collectionId,
      caseId,
      name
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
}
