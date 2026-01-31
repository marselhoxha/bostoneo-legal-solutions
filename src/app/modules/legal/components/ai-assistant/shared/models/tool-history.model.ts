/**
 * Models for Practice Area Tool History
 */

export interface ToolHistoryItem {
  id: number;
  organizationId: number;
  userId: number;
  practiceArea: string;
  toolType: string;
  title: string;
  inputData: Record<string, any>;
  outputData?: Record<string, any>;
  aiAnalysis?: string;
  caseId?: number;
  caseName?: string;
  userName?: string;
  createdAt: string;
}

export interface CreateToolHistoryRequest {
  toolType: string;
  title?: string;
  inputData: Record<string, any>;
  outputData?: Record<string, any>;
  aiAnalysis?: string;
  caseId?: number;
}

export interface ToolDefinition {
  id: string;
  name: string;
  icon: string;
  description?: string;
}

export interface HistoryGroup {
  date: string;
  label: string;
  items: ToolHistoryItem[];
  isExpanded: boolean;
}

/**
 * Practice area identifiers
 */
export type PracticeAreaType =
  | 'personal-injury'
  | 'family-law'
  | 'criminal-defense'
  | 'immigration'
  | 'real-estate'
  | 'intellectual-property';

/**
 * Tool type identifiers for Personal Injury
 */
export type PersonalInjuryToolType =
  | 'case-value'
  | 'demand-letter'
  | 'medical-tracker'
  | 'settlement';
