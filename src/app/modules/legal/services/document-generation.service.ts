import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
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
  researchMode: string;  // Research mode: FAST or THOROUGH
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
   * Routes to appropriate export method based on format
   * Returns full HTTP response to access Content-Disposition header with filename
   */
  exportDocument(documentId: string | number, format: 'pdf' | 'docx'): Observable<HttpResponse<Blob>> {
    const docId = typeof documentId === 'string' ? parseInt(documentId, 10) : documentId;
    const userId = 1; // Default user ID, should be injected from auth service in production

    if (format === 'docx') {
      return this.exportToWord(docId, userId);
    } else {
      return this.exportToPDF(docId, userId);
    }
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
   * Initialize draft conversation (returns conversation ID immediately)
   */
  initDraftConversation(request: DraftGenerationRequest): Observable<{conversationId: number, message: string}> {
    return this.http.post<{conversationId: number, message: string}>(
      `${environment.apiUrl}/api/legal/ai-workspace/drafts/init-conversation`,
      request,
      { withCredentials: true }
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
   * Convert HTML to Markdown for backend export
   * Preserves all formatting (headers, bold, italic, lists, links)
   */
  convertHtmlToMarkdown(html: string): string {
    if (!html) return '';

    let markdown = html;

    // Headers (H1-H6) - process from H6 to H1 to avoid conflicts
    markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '\n###### $1\n\n');
    markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n##### $1\n\n');
    markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n\n');
    markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n\n');
    markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n\n');
    markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n\n');

    // Bold and Strong
    markdown = markdown.replace(/<(strong|b)[^>]*>(.*?)<\/\1>/gi, '**$2**');

    // Italic and Emphasis
    markdown = markdown.replace(/<(em|i)[^>]*>(.*?)<\/\1>/gi, '*$2*');

    // Links - Keep as HTML <a> tags with clean attributes (backend handles HTML links better than Markdown)
    markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '<a href="$1">$2</a>');

    // Unordered Lists
    markdown = markdown.replace(/<ul[^>]*>/gi, '\n');
    markdown = markdown.replace(/<\/ul>/gi, '\n');

    // Ordered Lists - need to track numbering
    let olCounter = 0;
    markdown = markdown.replace(/<ol[^>]*>/gi, () => {
      olCounter = 0;
      return '\n';
    });
    markdown = markdown.replace(/<\/ol>/gi, '\n');

    // List items - handle both ordered and unordered
    // Check if inside <ol> context by looking for numbers before
    markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, (match, content) => {
      // Simple heuristic: if we see numbered items recently, this is ordered
      // Otherwise unordered
      olCounter++;
      // For now, default to unordered (-)
      // Backend will need to handle this
      return `- ${content}\n`;
    });

    // Paragraphs
    markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n\n');

    // Line breaks
    markdown = markdown.replace(/<br\s*\/?>/gi, '\n');

    // Horizontal rules
    markdown = markdown.replace(/<hr\s*\/?>/gi, '\n---\n\n');

    // Blockquotes
    markdown = markdown.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '\n> $1\n\n');

    // Code blocks
    markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');

    // Remove remaining HTML tags (cleanup)
    markdown = markdown.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    const temp = document.createElement('div');
    temp.innerHTML = markdown;
    markdown = temp.textContent || markdown;

    // Clean up excessive newlines (more than 2 consecutive)
    markdown = markdown.replace(/\n{3,}/g, '\n\n');

    // Trim leading/trailing whitespace
    markdown = markdown.trim();

    return markdown;
  }

  /**
   * Export document to Word (DOCX) - use backend API for proper format
   */
  exportToWord(documentId: number, userId: number): Observable<HttpResponse<Blob>> {
    // Always use backend API for proper DOCX generation
    // The backend has proper libraries to generate valid Office Open XML format
    // Returns full HTTP response to access Content-Disposition header with filename
    return this.http.get(
      `${environment.apiUrl}/api/legal/ai-workspace/documents/${documentId}/export/word`,
      {
        params: { userId: userId.toString() },
        responseType: 'blob',
        observe: 'response'
      }
    );
  }

  /**
   * Export document to PDF - use backend API for proper format
   */
  exportToPDF(documentId: number, userId: number): Observable<HttpResponse<Blob>> {
    // Always use backend API for proper PDF generation
    // The backend has proper libraries to generate valid PDFs with correct formatting
    // Returns full HTTP response to access Content-Disposition header with filename
    return this.http.get(
      `${environment.apiUrl}/api/legal/ai-workspace/documents/${documentId}/export/pdf`,
      {
        params: { userId: userId.toString() },
        responseType: 'blob',
        observe: 'response'
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
