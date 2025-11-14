import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';

export interface DocumentGenerationRequest {
  templateId?: number;
  documentType: string;
  jurisdiction: string;
  variables: { [key: string]: any };
  prompt?: string;
}

export interface GeneratedDocument {
  id: number | string;
  title: string;
  content: string;
  documentUrl?: string;
  status: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
  generatedAt: number;
  processingTimeMs: number;
  tokensUsed: number;
  costEstimate: number;
  wordCount?: number;
  pageCount?: number;
  version?: number;
}

export interface DocumentRevisionRequest {
  documentId: string | number;
  revisionType: 'simplify' | 'condense' | 'expand' | 'redraft';
  prompt?: string;
  currentContent: string;
}

export interface DocumentTransformRequest {
  documentId: number;
  transformationType: string;
  transformationScope: 'FULL_DOCUMENT' | 'SELECTION';
  fullDocumentContent: string;
  selectedText?: string;
  selectionStartIndex?: number;
  selectionEndIndex?: number;
  jurisdiction?: string;
  documentType?: string;
  caseId?: number;
}

export interface DocumentTransformResponse {
  documentId: number;
  newVersion: number;
  transformedContent: string;
  transformedSelection?: string; // For selection scope: only the transformed snippet
  explanation: string;
  tokensUsed: number;
  costEstimate: number;
  wordCount: number;
  transformationType: string;
  transformationScope: string;
}

export interface DraftGenerationRequest {
  userId: number;
  caseId?: number | null;
  prompt: string;
  documentType: string;
  jurisdiction: string;
  sessionName: string;
}

export interface DraftGenerationResponse {
  conversationId: number;
  documentId: number;
  document: {
    id: number;
    caseId?: number;
    title: string;
    content: string;
    wordCount: number;
    version: number;
    tokensUsed: number;
    costEstimate: number;
    generatedAt: string;
  };
  conversation: {
    id: number;
    caseId?: number;
    sessionName: string;
    taskType: string;
    relatedDraftId: string;
    createdAt: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class DocumentGenerationService {
  private apiUrl = `${environment.apiUrl}/api/ai/documents`;

  constructor(private http: HttpClient) {}

  /**
   * Generate a new legal document using AI
   */
  generateDocument(request: DocumentGenerationRequest): Observable<GeneratedDocument> {
    return this.http.post<GeneratedDocument>(`${this.apiUrl}/generate`, request);
  }

  /**
   * Export document to PDF or DOCX format
   */
  exportDocument(documentId: string | number, format: 'pdf' | 'docx'): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${documentId}/export`, {
      params: { format },
      responseType: 'blob'
    });
  }

  /**
   * Save document draft to backend
   */
  saveDocument(documentId: string | number, content: string, title?: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/${documentId}`, {
      content,
      title
    });
  }

  /**
   * Retrieve document by ID
   */
  getDocument(documentId: string | number, userId?: number): Observable<GeneratedDocument> {
    const params = userId ? { userId: userId.toString() } : {};
    return this.http.get<GeneratedDocument>(
      `${environment.apiUrl}/api/legal/ai-workspace/documents/${documentId}`,
      { params }
    );
  }

  /**
   * Generate draft with conversation (combined endpoint)
   */
  generateDraftWithConversation(request: DraftGenerationRequest): Observable<DraftGenerationResponse> {
    return this.http.post<DraftGenerationResponse>(
      `${environment.apiUrl}/api/legal/ai-workspace/drafts/generate`,
      request
    );
  }

  /**
   * Apply revision tool to document (simplify, condense, expand, redraft)
   */
  reviseDocument(request: DocumentRevisionRequest): Observable<GeneratedDocument> {
    return this.http.post<GeneratedDocument>(`${this.apiUrl}/revise`, request);
  }

  /**
   * Transform document (full document or selection)
   * NEW API for AI Workspace
   */
  transformDocument(request: DocumentTransformRequest, userId?: number): Observable<DocumentTransformResponse> {
    const params = userId ? { userId: userId.toString() } : {};
    return this.http.post<DocumentTransformResponse>(
      `${environment.apiUrl}/api/legal/ai-workspace/transform`,
      request,
      { params }
    );
  }

  /**
   * Get document versions
   */
  getDocumentVersions(documentId: number, userId?: number): Observable<any[]> {
    const params: any = {};
    if (userId) {
      params.userId = userId.toString();
    }
    return this.http.get<any[]>(
      `${environment.apiUrl}/api/legal/ai-workspace/documents/${documentId}/versions`,
      { params }
    );
  }

  /**
   * Get specific version
   */
  getDocumentVersion(documentId: number, versionNumber: number, userId?: number): Observable<any> {
    const params: any = {};
    if (userId) {
      params.userId = userId.toString();
    }
    return this.http.get<any>(
      `${environment.apiUrl}/api/legal/ai-workspace/documents/${documentId}/versions/${versionNumber}`,
      { params }
    );
  }

  /**
   * Restore previous version
   */
  restoreVersion(documentId: number, versionNumber: number, userId?: number): Observable<any> {
    const params = userId ? { userId: userId.toString() } : {};
    return this.http.post<any>(
      `${environment.apiUrl}/api/legal/ai-workspace/documents/${documentId}/versions/${versionNumber}/restore`,
      {},
      { params }
    );
  }

  /**
   * Get available document templates
   */
  getTemplates(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/templates`);
  }

  /**
   * Count words in document content
   */
  countWords(text: string): number {
    if (!text) return 0;

    // Remove markdown syntax and HTML tags for accurate count
    const plainText = text
      .replace(/#+\s/g, '') // Remove markdown headers
      .replace(/\*\*/g, '') // Remove bold
      .replace(/\*/g, '') // Remove italic
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove markdown links
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .trim();

    if (!plainText) return 0;
    return plainText.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Estimate page count based on word count (assuming ~250 words per page)
   */
  estimatePageCount(wordCount: number): number {
    return Math.ceil(wordCount / 250);
  }

  /**
   * Export document to Word (DOCX)
   */
  exportToWord(documentId: number, userId: number): Observable<Blob> {
    return this.http.get(
      `${environment.apiUrl}/api/legal/ai-workspace/documents/${documentId}/export/word`,
      {
        params: { userId: userId.toString() },
        responseType: 'blob'
      }
    );
  }

  /**
   * Export document to PDF
   */
  exportToPDF(documentId: number, userId: number): Observable<Blob> {
    return this.http.get(
      `${environment.apiUrl}/api/legal/ai-workspace/documents/${documentId}/export/pdf`,
      {
        params: { userId: userId.toString() },
        responseType: 'blob'
      }
    );
  }

  /**
   * Save manual edit as a new version
   */
  saveManualVersion(documentId: number, userId: number, content: string, versionNote?: string): Observable<any> {
    return this.http.post(
      `${environment.apiUrl}/api/legal/ai-workspace/documents/${documentId}/save`,
      {
        content,
        versionNote: versionNote || 'Manual edit'
      },
      {
        params: { userId: userId.toString() }
      }
    );
  }
}
