/**
 * PI Medical Record Model
 * Represents detailed medical record data with ICD codes, procedures, and billing
 */

export interface Diagnosis {
  icd_code: string;
  description: string;
  primary?: boolean;
}

export interface Procedure {
  cpt_code: string;
  description: string;
  units?: number;
}

export interface PIMedicalRecord {
  id?: number;
  caseId: number;
  organizationId?: number;

  // Provider Information
  providerName: string;
  providerNpi?: string;
  providerType?: string;
  providerAddress?: string;
  providerPhone?: string;
  providerFax?: string;

  // Record Type & Dates
  recordType: string;
  treatmentDate: string;
  treatmentEndDate?: string;

  // Clinical Information
  diagnoses?: Diagnosis[];
  procedures?: Procedure[];

  // Billing Information
  billedAmount?: number;
  adjustedAmount?: number;
  paidAmount?: number;
  lienHolder?: string;
  lienAmount?: number;

  // Clinical Notes
  keyFindings?: string;
  treatmentProvided?: string;
  prognosisNotes?: string;
  workRestrictions?: string;
  followUpRecommendations?: string;

  // Completeness Tracking
  isComplete?: boolean;
  missingElements?: string[];

  // Document Reference
  documentId?: number;
  documentName?: string;

  // Related info
  caseNumber?: string;
  clientName?: string;

  // Metadata
  createdAt?: string;
  updatedAt?: string;
  createdBy?: number;
  createdByName?: string;
}

export const RECORD_TYPES = [
  { value: 'ER', label: 'Emergency Room' },
  { value: 'FOLLOW_UP', label: 'Follow-up Visit' },
  { value: 'SURGERY', label: 'Surgery' },
  { value: 'PT', label: 'Physical Therapy' },
  { value: 'IMAGING', label: 'Imaging/Radiology' },
  { value: 'LAB', label: 'Laboratory' },
  { value: 'CONSULTATION', label: 'Consultation' },
  { value: 'CHIROPRACTIC', label: 'Chiropractic' },
  { value: 'PAIN_MGMT', label: 'Pain Management' },
  { value: 'PRIMARY_CARE', label: 'Primary Care' },
  { value: 'OTHER', label: 'Other' }
];

export const PROVIDER_TYPES = [
  { value: 'HOSPITAL', label: 'Hospital' },
  { value: 'EMERGENCY', label: 'Emergency Medicine' },
  { value: 'ORTHOPEDICS', label: 'Orthopedics' },
  { value: 'NEUROLOGY', label: 'Neurology' },
  { value: 'PHYSICAL_THERAPY', label: 'Physical Therapy' },
  { value: 'CHIROPRACTIC', label: 'Chiropractic' },
  { value: 'PAIN_MANAGEMENT', label: 'Pain Management' },
  { value: 'SURGERY', label: 'Surgery' },
  { value: 'RADIOLOGY', label: 'Radiology' },
  { value: 'PRIMARY_CARE', label: 'Primary Care' },
  { value: 'PSYCHOLOGY', label: 'Psychology/Psychiatry' },
  { value: 'OTHER', label: 'Other Specialist' }
];
