import { CaseStatus } from '../enums/case-status.enum';
import { CasePriority } from '../enums/case-priority.enum';

export interface Case {
  id?: string;
  caseNumber: string;
  title: string;
  clientName: string;
  status: CaseStatus;
  filingDate: string;
  description?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
  priority?: CasePriority;
  clientId?: string;
  assignedTo?: string[];
} 