import { ConversationType, TaskType, ResearchMode } from './enums/conversation-type.enum';

export interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  documentGenerated?: boolean;
  documentId?: string;
  transformationComparison?: TransformationComparison;
  hasStrategicAnalysis?: boolean;
  parsedSections?: any;
  analysisId?: number; // For document analysis
}

/**
 * Represents a single diff change for token-efficient transformations
 */
export interface DocumentChange {
  find: string;
  replace: string;
  startIndex?: number;
  reason?: string;
}

export interface TransformationComparison {
  oldContent: string;
  newContent: string;
  transformationType: string;
  scope: 'FULL_DOCUMENT' | 'SELECTION';
  response: any;
  fullDocumentContent?: string;
  selectionRange?: SelectionRange;
  /**
   * For diff-based transformations (CONDENSE, SIMPLIFY):
   * Contains find/replace pairs instead of full document content.
   */
  changes?: DocumentChange[];
  /**
   * Indicates whether diff-based transformation was used.
   */
  useDiffMode?: boolean;
}

export interface SelectionRange {
  index: number;
  length: number;
}

export interface ConversationMetadata {
  jurisdiction?: string;
  documentType?: string;
  sessionId?: number;
  backendConversationId?: number;
  researchMode?: ResearchMode;
  taskType?: TaskType;
  documentId?: number;
  relatedDraftId?: string;
}

export interface Conversation {
  id: string;
  title: string;
  date: Date;
  type: ConversationType;
  messages: Message[];
  messageCount?: number;
  jurisdiction?: string;
  documentType?: string;
  sessionId?: number;
  backendConversationId?: number;
  researchMode?: ResearchMode;
  taskType?: TaskType;
  documentId?: number;
  relatedDraftId?: string;
  caseId?: number; // Associated legal case ID
  workflowExecutionId?: number; // Linked workflow execution
  workflowName?: string; // Name of the linked workflow
}

export interface GroupedConversations {
  past90Days: Conversation[];
  older: Conversation[];
}
