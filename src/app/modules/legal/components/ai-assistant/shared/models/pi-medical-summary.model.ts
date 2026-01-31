/**
 * PI Medical Summary Model
 * Represents AI-generated medical summary data
 */

export interface ProviderSummaryItem {
  providerName: string;
  providerType?: string;
  visitCount: number;
  totalBilled: number;
  firstVisit: string;
  lastVisit: string;
}

export interface DiagnosisItem {
  icd_code: string;
  description: string;
  primary?: boolean;
  firstDocumented?: string;
  provider?: string;
}

export interface RedFlagItem {
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface MissingRecordItem {
  type: string;
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface TreatmentGap {
  gapStart: string;
  gapEnd: string;
  gapDays: number;
  previousProvider: string;
  nextProvider: string;
  severity: 'HIGH' | 'MEDIUM';
}

export interface PIMedicalSummary {
  id?: number;
  caseId: number;
  organizationId?: number;

  // Summary Content
  treatmentChronology?: string;
  providerSummary?: ProviderSummaryItem[];
  diagnosisList?: DiagnosisItem[];
  redFlags?: RedFlagItem[];
  missingRecords?: MissingRecordItem[];
  keyHighlights?: string;
  prognosisAssessment?: string;

  // Metrics
  totalProviders?: number;
  totalVisits?: number;
  totalBilled?: number;
  treatmentDurationDays?: number;
  treatmentGapDays?: number;

  // Completeness Score
  completenessScore?: number;
  completenessNotes?: string;

  // Generation Info
  generatedAt?: string;
  generatedByModel?: string;
  lastRecordDate?: string;
  isStale?: boolean;

  // Related info
  caseNumber?: string;
  clientName?: string;
  injuryType?: string;

  // Metadata
  createdAt?: string;
  updatedAt?: string;
}

export interface CompletenessMetrics {
  completenessScore: number;
  completenessNotes: string;
  totalProviders: number;
  totalVisits: number;
  totalBilled: number;
  treatmentDurationDays: number;
  treatmentGapDays: number;
  isStale: boolean;
  lastGenerated: string;
}
