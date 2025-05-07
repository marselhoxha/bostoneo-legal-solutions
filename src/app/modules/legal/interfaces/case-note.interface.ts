// This file is deprecated and its content has been moved to case.interface.ts
// It's kept for backward compatibility but should be removed in future updates

import { User } from 'src/app/interface/user';

export interface CaseNote {
  id: string;
  caseId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: User;
  updatedBy?: User;
  isPrivate: boolean;
  tags?: string[];
} 