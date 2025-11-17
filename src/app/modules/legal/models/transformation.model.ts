import { TransformationType, TransformationScope } from './enums/transformation-type.enum';

export interface TransformationRequest {
  documentId: number;
  transformationType: string;
  transformationScope: TransformationScope;
  fullDocumentContent?: string;
  selectedText?: string;
  selectionStartIndex?: number;
  selectionEndIndex?: number;
  jurisdiction?: string;
  documentType?: string | null;
}

export interface TransformationResponse {
  transformedContent?: string;
  transformedSelection?: string;
  explanation: string;
  wordCount: number;
  newVersion: number;
  tokensUsed: number;
  costEstimate: number;
}
