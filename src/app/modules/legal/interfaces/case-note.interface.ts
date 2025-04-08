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