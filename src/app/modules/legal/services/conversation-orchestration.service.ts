import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { takeUntil, map } from 'rxjs/operators';
import { LegalResearchService } from './legal-research.service';
import { DocumentGenerationService } from './document-generation.service';
import { AiWorkspaceStateService } from './ai-workspace-state.service';
import { NotificationService } from './notification.service';
import { Conversation, Message } from '../models/conversation.model';
import { ConversationType, TaskType, ResearchMode } from '../models/enums/conversation-type.enum';
import { WorkflowStep } from '../models/workflow.model';
import { WorkflowStepStatus } from '../models/enums/workflow-step-status.enum';
import { environment } from '../../../../environments/environment';

export interface GenerateDocumentRequest {
  userId: number;
  caseId: number | null;
  prompt: string;
  documentType: string;
  jurisdiction: string;
  sessionName: string;
  researchMode: string;  // Research mode: FAST or THOROUGH
  documentId?: number;   // When provided, includes exhibits attached to this workspace document
}

export interface GenerateConversationRequest {
  prompt: string;
  taskType: ConversationType;
  title: string;
  researchMode: ResearchMode;
  jurisdiction?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ConversationOrchestrationService {

  private destroy$ = new Subject<void>();
  private workflowEventSource?: EventSource;

  // Workflow step templates
  private workflowStepTemplates: Record<string, { id: number; icon: string; description: string; status: WorkflowStepStatus }[]> = {
    // Question sub-types (matched to backend QuestionType)
    question_strategy: [
      { id: 1, icon: 'ri-search-2-line', description: 'Analyzing legal question...', status: WorkflowStepStatus.Pending },
      { id: 2, icon: 'ri-scales-3-line', description: 'Searching case law & precedents...', status: WorkflowStepStatus.Pending },
      { id: 3, icon: 'ri-book-open-line', description: 'Reviewing statutes & regulations...', status: WorkflowStepStatus.Pending },
      { id: 4, icon: 'ri-file-text-line', description: 'Generating response...', status: WorkflowStepStatus.Pending }
    ],
    question_followup: [
      { id: 1, icon: 'ri-chat-3-line', description: 'Reviewing conversation context...', status: WorkflowStepStatus.Pending },
      { id: 2, icon: 'ri-file-text-line', description: 'Generating response...', status: WorkflowStepStatus.Pending }
    ],
    question_technical: [
      { id: 1, icon: 'ri-search-2-line', description: 'Analyzing legal question...', status: WorkflowStepStatus.Pending },
      { id: 2, icon: 'ri-book-open-line', description: 'Looking up statutes & regulations...', status: WorkflowStepStatus.Pending },
      { id: 3, icon: 'ri-file-text-line', description: 'Generating response...', status: WorkflowStepStatus.Pending }
    ],
    question_procedural: [
      { id: 1, icon: 'ri-search-2-line', description: 'Analyzing procedural requirements...', status: WorkflowStepStatus.Pending },
      { id: 2, icon: 'ri-calendar-check-line', description: 'Checking rules & deadlines...', status: WorkflowStepStatus.Pending },
      { id: 3, icon: 'ri-file-text-line', description: 'Generating step-by-step guidance...', status: WorkflowStepStatus.Pending }
    ],
    // Fallback: question defaults to strategy (full research)
    question: [
      { id: 1, icon: 'ri-search-2-line', description: 'Analyzing legal question...', status: WorkflowStepStatus.Pending },
      { id: 2, icon: 'ri-scales-3-line', description: 'Searching case law & precedents...', status: WorkflowStepStatus.Pending },
      { id: 3, icon: 'ri-book-open-line', description: 'Reviewing statutes & regulations...', status: WorkflowStepStatus.Pending },
      { id: 4, icon: 'ri-file-text-line', description: 'Generating response...', status: WorkflowStepStatus.Pending }
    ],
    draft: [
      { id: 1, icon: 'ri-file-search-line', description: 'Analyzing requirements...', status: WorkflowStepStatus.Pending },
      { id: 2, icon: 'ri-search-line', description: 'Retrieving precedents...', status: WorkflowStepStatus.Pending },
      { id: 3, icon: 'ri-book-line', description: 'Applying legal standards...', status: WorkflowStepStatus.Pending },
      { id: 4, icon: 'ri-file-edit-line', description: 'Drafting document...', status: WorkflowStepStatus.Pending }
    ],
    summarize: [
      { id: 1, icon: 'ri-file-search-line', description: 'Reading case materials...', status: WorkflowStepStatus.Pending },
      { id: 2, icon: 'ri-organization-chart', description: 'Identifying key facts...', status: WorkflowStepStatus.Pending },
      { id: 3, icon: 'ri-scales-3-line', description: 'Extracting legal issues...', status: WorkflowStepStatus.Pending },
      { id: 4, icon: 'ri-file-list-3-line', description: 'Creating summary...', status: WorkflowStepStatus.Pending }
    ],
    upload: [
      { id: 1, icon: 'ri-file-upload-line', description: 'Processing document...', status: WorkflowStepStatus.Pending },
      { id: 2, icon: 'ri-search-eye-line', description: 'Analyzing content...', status: WorkflowStepStatus.Pending },
      { id: 3, icon: 'ri-shield-check-line', description: 'Identifying risks...', status: WorkflowStepStatus.Pending },
      { id: 4, icon: 'ri-file-list-3-line', description: 'Generating analysis...', status: WorkflowStepStatus.Pending }
    ],
    transform: [
      { id: 1, icon: 'ri-file-search-line', description: 'Analyzing document...', status: WorkflowStepStatus.Pending },
      { id: 2, icon: 'ri-magic-line', description: 'Applying transformation...', status: WorkflowStepStatus.Pending },
      { id: 3, icon: 'ri-file-edit-line', description: 'Generating preview...', status: WorkflowStepStatus.Pending }
    ],
    workflow: [
      { id: 1, icon: 'ri-flow-chart', description: 'Loading workflow...', status: WorkflowStepStatus.Pending },
      { id: 2, icon: 'ri-file-search-line', description: 'Processing documents...', status: WorkflowStepStatus.Pending },
      { id: 3, icon: 'ri-robot-line', description: 'Running AI analysis...', status: WorkflowStepStatus.Pending },
      { id: 4, icon: 'ri-file-list-3-line', description: 'Generating results...', status: WorkflowStepStatus.Pending }
    ]
  };

  constructor(
    private legalResearchService: LegalResearchService,
    private documentGenerationService: DocumentGenerationService,
    private stateService: AiWorkspaceStateService,
    private notificationService: NotificationService
  ) {}

  /**
   * Initialize workflow steps for a task type
   */
  initializeWorkflowSteps(taskType: string): WorkflowStep[] {
    const template = this.workflowStepTemplates[taskType] || this.workflowStepTemplates['question'];
    return template.map(step => ({ ...step }));
  }

  /**
   * Animate workflow steps progressively
   */
  animateWorkflowSteps(steps: WorkflowStep[], stepDuration: number = 3000): number[] {
    const timeouts: number[] = [];

    steps.forEach((step, index) => {
      // Mark step as active
      const activeTimeout = window.setTimeout(() => {
        this.stateService.updateWorkflowStep(step.id, { status: WorkflowStepStatus.Active });
      }, index * stepDuration);
      timeouts.push(activeTimeout);

      // Mark step as completed (unless it's the last step)
      if (index < steps.length - 1) {
        const completedTimeout = window.setTimeout(() => {
          this.stateService.updateWorkflowStep(step.id, { status: WorkflowStepStatus.Completed });
        }, (index + 0.8) * stepDuration);
        timeouts.push(completedTimeout);
      }
    });

    return timeouts;
  }

  /**
   * Generate document flow for 'draft' task
   */
  generateDocument(request: GenerateDocumentRequest): Observable<any> {
    return new Observable(observer => {
      // Initialize workflow
      const steps = this.initializeWorkflowSteps('draft');
      this.stateService.setWorkflowSteps(steps);
      this.animateWorkflowSteps(steps);

      this.documentGenerationService.generateDraftWithConversation(request)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            this.stateService.completeAllWorkflowSteps();
            observer.next(response);
            observer.complete();
          },
          error: (error) => {
            const steps = this.stateService.getWorkflowSteps();
            if (steps.length > 0) {
              this.stateService.updateWorkflowStep(
                steps[steps.length - 1].id,
                { status: WorkflowStepStatus.Error }
              );
            }
            observer.error(error);
          }
        });
    });
  }

  /**
   * Generate conversation flow for Q&A tasks
   */
  generateConversation(request: GenerateConversationRequest): Observable<any> {
    return new Observable(observer => {
      // Initialize workflow
      const taskType = this.mapConversationTypeToWorkflowType(request.taskType);
      const steps = this.initializeWorkflowSteps(taskType);
      this.stateService.setWorkflowSteps(steps);

      // Map to backend task type
      const backendTaskType = this.mapToBackendTaskType(request.taskType);

      // Create conversation with jurisdiction for state-specific research
      this.legalResearchService.createGeneralConversation(request.title, backendTaskType, undefined, request.jurisdiction)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (session) => {
            const conversationId = session.id;

            // Connect SSE for real-time workflow progress (uses session ID)
            this.connectWorkflowSSE(conversationId, steps);

            // Send initial message — backend auto-selects mode
            this.legalResearchService.sendMessageToConversation(conversationId, request.prompt, request.jurisdiction)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (message) => {
                  this.closeWorkflowSSE();
                  this.stateService.completeAllWorkflowSteps();
                  observer.next({ session, message });
                  observer.complete();
                },
                error: (error) => {
                  this.closeWorkflowSSE();
                  const steps = this.stateService.getWorkflowSteps();
                  if (steps.length > 0) {
                    this.stateService.updateWorkflowStep(
                      steps[steps.length - 1].id,
                      { status: WorkflowStepStatus.Error }
                    );
                  }
                  observer.error(error);
                }
              });
          },
          error: (error) => {
            observer.error(error);
          }
        });
    });
  }

  /**
   * Send follow-up message to existing conversation
   */
  sendFollowUpMessage(
    conversationId: number,
    message: string,
    researchMode: ResearchMode,
    taskType: ConversationType,
    jurisdiction?: string
  ): Observable<any> {
    return new Observable(observer => {
      // Initialize workflow
      const workflowType = this.mapConversationTypeToWorkflowType(taskType);
      const steps = this.initializeWorkflowSteps(workflowType);
      this.stateService.setWorkflowSteps(steps);
      this.connectWorkflowSSE(conversationId, steps);

      this.legalResearchService.sendMessageToConversation(conversationId, message, jurisdiction)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            this.closeWorkflowSSE();
            this.stateService.completeAllWorkflowSteps();
            observer.next(response);
            observer.complete();
          },
          error: (error) => {
            this.closeWorkflowSSE();
            const steps = this.stateService.getWorkflowSteps();
            if (steps.length > 0) {
              this.stateService.updateWorkflowStep(
                steps[steps.length - 1].id,
                { status: WorkflowStepStatus.Error }
              );
            }
            observer.error(error);
          }
        });
    });
  }

  /**
   * Load conversations by task type
   */
  loadConversations(taskType: ConversationType): Observable<Conversation[]> {
    const backendTaskType = this.mapToBackendTaskType(taskType);

    return this.legalResearchService.getGeneralConversationsByTaskType(backendTaskType, 0, 50)
      .pipe(
        map(response => {
          return response.conversations.map(conv => ({
            id: `conv_${conv.id}`,
            title: conv.sessionName || 'Untitled Conversation',
            date: new Date(conv.createdAt || new Date()),
            type: this.mapBackendTaskTypeToFrontend(conv.taskType || 'LEGAL_QUESTION'),
            messages: [],
            messageCount: conv.messageCount || 0,
            jurisdiction: conv.jurisdiction,
            backendConversationId: conv.id,
            researchMode: (conv.researchMode as ResearchMode) || ResearchMode.Fast,
            taskType: conv.taskType as TaskType,
            documentId: conv.documentId,
            relatedDraftId: conv.relatedDraftId
          } as Conversation));
        })
      );
  }

  /**
   * Load specific conversation by ID
   */
  loadConversationById(backendId: number): Observable<any> {
    return this.legalResearchService.getConversationById(backendId);
  }

  /**
   * Delete conversation
   */
  deleteConversation(backendId: number): Observable<boolean> {
    return this.legalResearchService.deleteConversationById(backendId);
  }

  /**
   * Map conversation type to workflow type
   */
  private mapConversationTypeToWorkflowType(type: ConversationType): 'question' | 'draft' | 'summarize' | 'upload' | 'transform' | 'workflow' {
    const map: Record<ConversationType, 'question' | 'draft' | 'summarize' | 'upload' | 'workflow'> = {
      [ConversationType.Question]: 'question',
      [ConversationType.Draft]: 'draft',
      [ConversationType.Summarize]: 'summarize',
      [ConversationType.Upload]: 'upload',
      [ConversationType.Workflow]: 'workflow'
    };
    return map[type] || 'question';
  }

  /**
   * Map frontend conversation type to backend task type
   */
  private mapToBackendTaskType(type: ConversationType): TaskType {
    const map: Partial<Record<ConversationType, TaskType>> = {
      [ConversationType.Question]: TaskType.LegalQuestion,
      [ConversationType.Draft]: TaskType.GenerateDraft,
      [ConversationType.Summarize]: TaskType.SummarizeCase,
      [ConversationType.Upload]: TaskType.AnalyzeDocument
    };
    return map[type] || TaskType.LegalQuestion;
  }

  /**
   * Map backend task type to frontend conversation type
   */
  private mapBackendTaskTypeToFrontend(taskType: string): ConversationType {
    const map: Record<string, ConversationType> = {
      'LEGAL_QUESTION': ConversationType.Question,
      'GENERATE_DRAFT': ConversationType.Draft,
      'SUMMARIZE_CASE': ConversationType.Summarize,
      'ANALYZE_DOCUMENT': ConversationType.Upload
    };
    return map[taskType] || ConversationType.Question;
  }

  /**
   * Connect to SSE progress stream to drive workflow steps in real-time.
   * Uses hybrid approach: starts timer animation as fallback, cancels it when SSE events arrive.
   */
  private connectWorkflowSSE(sessionId: number, steps: WorkflowStep[]): void {
    this.closeWorkflowSSE();

    const totalSteps = steps.length;
    if (totalSteps === 0) return;

    // Start timer animation immediately as fallback
    this.animateWorkflowSteps(steps);

    const sseUrl = `${environment.apiUrl}/api/ai/legal-research/progress-stream?sessionId=${sessionId}`;
    this.workflowEventSource = new EventSource(sseUrl);
    let sseActive = false;

    const cancelTimerFallback = () => {
      if (!sseActive) {
        sseActive = true;
        // Timer timeouts are managed by animateWorkflowSteps — they auto-clear on next call
      }
    };

    this.workflowEventSource.addEventListener('progress', (event: MessageEvent) => {
      try {
        const progressEvent = JSON.parse(event.data);
        const stepType = progressEvent.stepType;
        cancelTimerFallback();

        if (stepType === 'query_analysis') {
          if (totalSteps > 0) {
            this.stateService.updateWorkflowStep(steps[0].id, { status: WorkflowStepStatus.Active });
          }
        } else if (stepType === 'tool_execution') {
          if (totalSteps > 0) {
            this.stateService.updateWorkflowStep(steps[0].id, { status: WorkflowStepStatus.Completed });
          }
          for (let i = 1; i < totalSteps - 1; i++) {
            this.stateService.updateWorkflowStep(steps[i].id, { status: WorkflowStepStatus.Active });
          }
        }
      } catch (error) {
        // Ignore parse errors from SSE
      }
    });

    this.workflowEventSource.addEventListener('complete', () => {
      cancelTimerFallback();
      this.stateService.completeAllWorkflowSteps();
      this.closeWorkflowSSE();
    });

    this.workflowEventSource.addEventListener('error', (event: MessageEvent) => {
      if (event.data) {
        cancelTimerFallback();
        if (totalSteps > 0) {
          this.stateService.updateWorkflowStep(steps[totalSteps - 1].id, { status: WorkflowStepStatus.Error });
        }
        this.closeWorkflowSSE();
      }
    });

    this.workflowEventSource.onerror = () => {
      if (this.workflowEventSource?.readyState === EventSource.CLOSED) {
        this.closeWorkflowSSE();
      }
    };
  }

  /**
   * Close the SSE connection for workflow progress
   */
  private closeWorkflowSSE(): void {
    if (this.workflowEventSource) {
      this.workflowEventSource.close();
      this.workflowEventSource = undefined;
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.closeWorkflowSSE();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
