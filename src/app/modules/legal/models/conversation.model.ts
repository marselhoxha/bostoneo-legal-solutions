import { ConversationType, TaskType, ResearchMode } from './enums/conversation-type.enum';

export interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  documentGenerated?: boolean;
  documentId?: string;
  transformationComparison?: TransformationComparison;
}

export interface TransformationComparison {
  oldContent: string;
  newContent: string;
  transformationType: string;
  scope: 'FULL_DOCUMENT' | 'SELECTION';
  response: any;
  fullDocumentContent?: string;
  selectionRange?: SelectionRange;
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
}

export interface GroupedConversations {
  past90Days: Conversation[];
  older: Conversation[];
}
