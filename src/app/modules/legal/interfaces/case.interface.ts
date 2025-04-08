import { CaseStatus } from '../enums/case-status.enum';
import { CasePriority } from '../enums/case-priority.enum';

export interface Case {
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  status: CaseStatus;
  priority: CasePriority;
  clientId: string;
  clientName: string;
  assignedTo: string[];
  createdAt: Date;
  updatedAt: Date;
  nextHearingDate?: Date;
} 