import { WorkflowStepStatus } from './enums/workflow-step-status.enum';

export interface WorkflowStep {
  id: number;
  icon: string;
  description: string;
  status: WorkflowStepStatus;
}

export type WorkflowType = 'question' | 'draft' | 'summarize' | 'upload' | 'transform';

export interface WorkflowStepTemplate {
  id: number;
  icon: string;
  description: string;
  status: WorkflowStepStatus;
}
