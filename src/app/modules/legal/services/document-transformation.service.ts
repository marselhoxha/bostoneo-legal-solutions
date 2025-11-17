import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DocumentGenerationService } from './document-generation.service';
import { AiWorkspaceStateService } from './ai-workspace-state.service';
import { QuillEditorService } from './quill-editor.service';
import { NotificationService } from './notification.service';
import { TransformationRequest, TransformationResponse } from '../models/transformation.model';
import { TransformationScope } from '../models/enums/transformation-type.enum';
import { WorkflowStepStatus } from '../models/enums/workflow-step-status.enum';
import Quill from 'quill';

@Injectable({
  providedIn: 'root'
})
export class DocumentTransformationService {

  private destroy$ = new Subject<void>();

  // Workflow steps for transformation
  private transformWorkflowSteps = [
    { id: 1, icon: 'ri-file-search-line', description: 'Analyzing document...', status: WorkflowStepStatus.Pending },
    { id: 2, icon: 'ri-magic-line', description: 'Applying transformation...', status: WorkflowStepStatus.Pending },
    { id: 3, icon: 'ri-file-edit-line', description: 'Generating preview...', status: WorkflowStepStatus.Pending }
  ];

  constructor(
    private documentGenerationService: DocumentGenerationService,
    private stateService: AiWorkspaceStateService,
    private quillEditorService: QuillEditorService,
    private notificationService: NotificationService
  ) {}

  /**
   * Transform document (full or selection)
   */
  transformDocument(request: TransformationRequest, userId?: number): Observable<TransformationResponse> {
    return new Observable(observer => {
      // Initialize workflow
      const steps = this.transformWorkflowSteps.map(s => ({ ...s }));
      this.stateService.setWorkflowSteps(steps);
      this.animateWorkflowSteps();

      this.documentGenerationService.transformDocument(request as any, userId)
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
   * Apply transformation to Quill editor
   */
  applyTransformationToEditor(
    quill: Quill,
    transformation: {
      scope: TransformationScope;
      newContent: string;
      selectionRange?: { index: number; length: number };
    }
  ): void {
    if (transformation.scope === TransformationScope.FullDocument) {
      // Replace entire document
      this.quillEditorService.setContentFromHtml(quill, transformation.newContent);
    } else {
      // Replace selection with highlight
      if (!transformation.selectionRange) {
        console.error('Selection range required for selection-based transformation');
        return;
      }

      const { index, length } = transformation.selectionRange;
      this.quillEditorService.replaceTextWithHighlight(
        quill,
        index,
        length,
        transformation.newContent,
        '#d4edda', // Velzon success-subtle green
        4000 // 4 seconds
      );
    }
  }

  /**
   * Get transformation prompt for tool
   */
  getTransformationPrompt(tool: string, selectedText?: string): string {
    const prompts: Record<string, string> = {
      'simplify': selectedText
        ? `Please simplify the following text to make it more accessible:\n\n"${selectedText}"`
        : 'Please simplify the language in this document to make it more accessible.',
      'condense': selectedText
        ? `Please condense the following text to make it more concise:\n\n"${selectedText}"`
        : 'Please condense this document to make it more concise.',
      'expand': selectedText
        ? `Please expand the following text with more detail:\n\n"${selectedText}"`
        : 'Please expand this document with more detail and explanation.',
      'redraft': selectedText
        ? `Please redraft the following text entirely with a fresh approach:\n\n"${selectedText}"`
        : 'Please redraft this document entirely with a fresh approach.'
    };

    return prompts[tool] || `Please improve the ${selectedText ? 'following text' : 'document'}${selectedText ? `:\n\n"${selectedText}"` : '.'}`;
  }

  /**
   * Get transformation label for display
   */
  getTransformationLabel(transformationType: string): string {
    const labels: Record<string, string> = {
      'INITIAL_GENERATION': 'Initial Draft',
      'SIMPLIFY': 'Simplified',
      'CONDENSE': 'Condensed',
      'EXPAND': 'Expanded',
      'FORMAL': 'Made Formal',
      'PERSUASIVE': 'Made Persuasive',
      'REDRAFT': 'Redrafted',
      'MANUAL_EDIT': 'Manual Edit',
      'RESTORE_VERSION': 'Version Restored'
    };
    return labels[transformationType] || transformationType;
  }

  /**
   * Animate workflow steps
   */
  private animateWorkflowSteps(): void {
    const stepDuration = 3000;

    this.transformWorkflowSteps.forEach((step, index) => {
      setTimeout(() => {
        this.stateService.updateWorkflowStep(step.id, { status: WorkflowStepStatus.Active });
      }, index * stepDuration);

      if (index < this.transformWorkflowSteps.length - 1) {
        setTimeout(() => {
          this.stateService.updateWorkflowStep(step.id, { status: WorkflowStepStatus.Completed });
        }, (index + 0.8) * stepDuration);
      }
    });
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
