/**
 * PI Document Checklist Model
 * Represents document tracking items for PI case preparation
 */

export interface PIDocumentChecklist {
  id?: number;
  caseId: number;
  organizationId?: number;

  // Document Information
  documentType: string;
  documentSubtype?: string;
  providerName?: string;

  // Status Tracking
  required?: boolean;
  received?: boolean;
  receivedDate?: string;
  status: string;

  // Request Tracking
  requestedDate?: string;
  requestSentTo?: string;
  followUpDate?: string;
  followUpCount?: number;
  requestCount?: number;
  lastRequestAt?: string;
  totalFee?: number;

  // Document Reference
  documentId?: number;
  documentName?: string;

  // Notes
  notes?: string;

  // Related info
  caseNumber?: string;
  clientName?: string;

  // Computed fields
  daysSinceRequested?: number;
  isOverdue?: boolean;

  // Metadata
  createdAt?: string;
  updatedAt?: string;
  createdBy?: number;
  createdByName?: string;
}

export interface DocumentCompletenessScore {
  totalCount: number;
  receivedCount: number;
  missingCount: number;
  requestedCount: number;
  completenessPercent: number;
  requiredCount: number;
  requiredReceivedCount: number;
  missingDocuments: {
    type: string;
    subtype: string;
    daysSinceRequested: number;
  }[];
}

export const DOCUMENT_TYPES = [
  { value: 'POLICE_REPORT', label: 'Police/Accident Report' },
  { value: 'MEDICAL_RECORDS', label: 'Medical Records' },
  { value: 'MEDICAL_BILLS', label: 'Medical Bills' },
  { value: 'WAGE_DOCUMENTATION', label: 'Wage Documentation' },
  { value: 'INSURANCE', label: 'Insurance Documents' },
  { value: 'PHOTOGRAPHS', label: 'Photographs' },
  { value: 'WITNESS', label: 'Witness Statements' },
  { value: 'EXPERT', label: 'Expert Reports' },
  { value: 'OTHER', label: 'Other Documents' }
];

export const DOCUMENT_STATUSES = [
  { value: 'MISSING', label: 'Missing', color: 'danger' },
  { value: 'REQUESTED', label: 'Requested', color: 'warning' },
  { value: 'PENDING', label: 'Pending', color: 'info' },
  { value: 'RECEIVED', label: 'Received', color: 'success' },
  { value: 'NOT_APPLICABLE', label: 'N/A', color: 'secondary' }
];
