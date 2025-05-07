import { User } from 'src/app/interface/user';

export interface CaseNote {
  id: number | string;
  caseId: number | string;
  userId?: number | string;
  user?: User;
  title: string;
  content: string;
  isPrivate?: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: {
    id: number | string;
    name: string;
  };
  updatedBy?: {
    id: number | string;
    name: string;
  };
}

export interface CreateCaseNoteRequest {
  caseId: number | string;
  title: string;
  content: string;
  isPrivate?: boolean;
}

export interface UpdateCaseNoteRequest {
  title?: string;
  content?: string;
  isPrivate?: boolean;
} 