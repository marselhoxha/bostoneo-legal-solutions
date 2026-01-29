export enum DocumentType {
  COURT_FILING = 'COURT_FILING',
  DISCOVERY = 'DISCOVERY',
  EVIDENCE = 'EVIDENCE',
  CONTRACT = 'CONTRACT',
  CORRESPONDENCE = 'CORRESPONDENCE',
  CLIENT_DOCUMENT = 'CLIENT_DOCUMENT',
  FINANCIAL = 'FINANCIAL',
  MEDICAL = 'MEDICAL',
  REPORT = 'REPORT',
  INTERNAL = 'INTERNAL',
  OTHER = 'OTHER'
}

export enum DocumentCategory {
  // RBAC-compliant categories
  PUBLIC = 'PUBLIC',                                  // Accessible to all authorized users including clients
  INTERNAL = 'INTERNAL',                              // Staff only (not clients)
  CONFIDENTIAL = 'CONFIDENTIAL',                      // Attorney/Admin only
  ATTORNEY_CLIENT_PRIVILEGE = 'ATTORNEY_CLIENT_PRIVILEGE' // Attorney + specific client only
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
