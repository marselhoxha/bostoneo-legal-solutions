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
  explanation: string;
  tokensUsed: number;
  costEstimate: number;
  wordCount: number;
  transformationType: string;
  transformationScope: string;
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
  getDocument(documentId: string | number): Observable<GeneratedDocument> {
    return this.http.get<GeneratedDocument>(`${this.apiUrl}/${documentId}`);
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
  transformDocument(request: DocumentTransformRequest): Observable<DocumentTransformResponse> {
    return this.http.post<DocumentTransformResponse>(
      `${environment.apiUrl}/api/legal/ai-workspace/transform`,
      request
    );
  }

  /**
   * Get document versions
   */
  getDocumentVersions(documentId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.apiUrl}/api/legal/ai-workspace/documents/${documentId}/versions`
    );
  }

  /**
   * Get specific version
   */
  getDocumentVersion(documentId: number, versionNumber: number): Observable<any> {
    return this.http.get<any>(
      `${environment.apiUrl}/api/legal/ai-workspace/documents/${documentId}/versions/${versionNumber}`
    );
  }

  /**
   * Restore previous version
   */
  restoreVersion(documentId: number, versionNumber: number): Observable<any> {
    return this.http.post<any>(
      `${environment.apiUrl}/api/legal/ai-workspace/documents/${documentId}/versions/${versionNumber}/restore`,
      {}
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
}
