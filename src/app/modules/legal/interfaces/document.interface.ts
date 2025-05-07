export enum DocumentType {
  CONTRACT = 'CONTRACT',
  PLEADING = 'PLEADING',
  EVIDENCE = 'EVIDENCE',
  CORRESPONDENCE = 'CORRESPONDENCE',
  MOTION = 'MOTION',
  ORDER = 'ORDER',
  OTHER = 'OTHER'
}

export enum DocumentCategory {
  LEGAL = 'LEGAL',
  FINANCIAL = 'FINANCIAL',
  CORRESPONDENCE = 'CORRESPONDENCE',
  REPORT = 'REPORT',
  OTHER = 'OTHER'
}

export enum DocumentStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',  
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  FINAL = 'FINAL',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED'
}

export interface Document {
  id: number | string;
  title: string;
  type: DocumentType;
  category?: DocumentCategory | string;
  status: DocumentStatus;
  caseId?: number | string;
  description?: string;
  url: string;
  tags?: string[];
  uploadedAt: Date;
  updatedAt: Date;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  uploadedBy?: any;
}

/**
 * Interface for document version information
 */
export interface DocumentVersion {
  id: number | string;
  documentId: number | string;
  versionNumber: number;
  fileName: string;
  fileUrl: string;
  changes?: string;
  uploadedAt: Date;
  uploadedBy?: any;
  fileType?: string;
  fileSize?: number;
}
