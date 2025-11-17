export interface DocumentMetadata {
  tokensUsed?: number;
  costEstimate?: number;
  generatedAt?: Date;
  lastSaved?: Date;
  version?: number;
}

export interface DocumentVersion {
  id: number;
  documentId: number;
  versionNumber: number;
  content: string;
  wordCount: number;
  transformationType: string;
  versionNote?: string;
  createdAt: Date;
  createdBy: number;
}

export interface DocumentState {
  id: string | number | null;
  title: string;
  content: string;
  wordCount: number;
  pageCount: number;
  metadata: DocumentMetadata;
  versions: DocumentVersion[];
}
