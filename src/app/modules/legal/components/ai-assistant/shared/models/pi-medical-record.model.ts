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

/**
 * Citation reference for a single field
 * Contains information to locate the source text in the original document
 */
export interface FieldCitation {
  page: number;          // 1-indexed page number
  excerpt: string;       // Exact text snippet from the document (20-80 chars)
  charOffset?: number;   // Character offset from start of document
}

/**
 * Citation metadata for a medical record
 * Maps field names to their source locations in the document
 */
export interface CitationMetadata {
  treatmentDate?: FieldCitation;
  providerName?: FieldCitation;
  recordType?: FieldCitation;
  keyFindings?: FieldCitation;
  treatmentProvided?: FieldCitation;
  diagnoses?: Array<{ icd_code: string; page: number; excerpt: string; charOffset?: number }>;
  procedures?: Array<{ cpt_code: string; page: number; excerpt: string; charOffset?: number }>;
  billedAmount?: FieldCitation;
  [key: string]: FieldCitation | Array<any> | undefined;
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

  // Treating clinician (the actual person who signed the note) — distinct from providerName (facility)
  treatingClinician?: string;
  treatingRole?: string;

  // Record Type & Dates
  recordType: string;
  treatmentDate: string;
  treatmentEndDate?: string;

  // Clinical Information
  diagnoses?: Diagnosis[];
  procedures?: Procedure[];

  // Tier 2 clinical detail
  vitals?: {
    bp?: string; hr?: number; weight_lbs?: number; height?: string;
    bmi?: number; pain?: string; temp_f?: number; resp?: number; spo2?: number;
    [key: string]: any;
  };
  rangeOfMotion?: { [region: string]: { [motion: string]: number } };
  specialTests?: Array<{ name: string; side?: string; result?: string }>;
  medicationsAdministered?: Array<{ name: string; dose?: string; route?: string; frequency?: string }>;
  medicationsPrescribed?: Array<{ name: string; dose?: string; frequency?: string; duration?: string }>;

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

  // Causation (Tier 2): verbatim MVA causation quote with attribution
  causationStatement?: string;
  causationSource?: string;

  // Completeness Tracking
  isComplete?: boolean;
  missingElements?: string[];

  // Document Reference
  documentId?: number;
  documentName?: string;

  // Citation Metadata - source locations for extracted data
  citationMetadata?: CitationMetadata;

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
