import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkflowStep } from '../../../../models/workflow.model';
import { WorkflowStepStatus } from '../../../../models/enums/workflow-step-status.enum';

@Component({
  selector: 'app-workflow-steps',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './workflow-steps.component.html',
  styleUrls: ['./workflow-steps.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkflowStepsComponent {
  @Input() steps: WorkflowStep[] = [];
  @Input() isGenerating: boolean = false;

  // Expose enum to template
  WorkflowStepStatus = WorkflowStepStatus;
}
