export enum DocumentType {
  CONTRACT = 'CONTRACT',
  PLEADING = 'PLEADING',
  EVIDENCE = 'EVIDENCE',
  CORRESPONDENCE = 'CORRESPONDENCE',
  OTHER = 'OTHER'
}

export enum DocumentStatus {
  DRAFT = 'DRAFT',
  FINAL = 'FINAL',
  ARCHIVED = 'ARCHIVED'
}

export interface Document {
  id: string;
  title: string;
  type: DocumentType;
  status: DocumentStatus;
  caseId?: string;
  description?: string;
  url: string;
  tags?: string[];
  uploadedAt: Date;
  updatedAt: Date;
} 