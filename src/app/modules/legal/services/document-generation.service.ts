import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { UserService } from '../../../service/user.service';
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  Packer,
  TableLayoutType
} from 'docx';
import { saveAs } from 'file-saver';

export interface DocumentGenerationRequest {
  templateId?: number;
  documentType: string;
  jurisdiction: string;
  practiceArea?: string;  // Slug from PRACTICE_AREAS (e.g. 'pi', 'family') — drives 4-way template cascade
  variables: { [key: string]: any };
  prompt?: string;
  documentOptions?: { [key: string]: any };  // Doc-specific config (e.g. LOR recipientType + purposes)
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
  stationeryTemplateId?: number | null;
  stationeryAttorneyId?: number | null;
  // §6.1 gating metadata — drives the DRAFT watermark overlay in the UI.
  // When approvalStatus transitions from 'draft' to 'approved' the watermark disappears.
  approvalStatus?: string | null;
  isVerificationOverdue?: boolean | null;
  templateVersion?: string | null;
  lastVerified?: string | null;
  // §6.1 attorney review metadata — drives the review chip + banner.
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  reviewRequestedAt?: string | null;
  reviewedByUserId?: number | null;
  reviewRequestedByUserId?: number | null;
}

/**
 * §6.1 attorney review response — sparse snapshot after any review transition.
 * Same shape the backend returns from request-review/approve/request-changes/revert.
 */
export interface DocumentReviewState {
  documentId: number;
  approvalStatus: string;
  reviewedByUserId?: number | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  reviewRequestedByUserId?: number | null;
  reviewRequestedAt?: string | null;
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
  customPrompt?: string; // For CUSTOM transformation type - user's natural language revision request
  jurisdiction?: string;
  documentType?: string;
  caseId?: number;
}

/**
 * Represents a single diff change for token-efficient transformations
 */
export interface DocumentChange {
  find: string;     // The exact text to find in the original document
  replace: string;  // The replacement text
  startIndex?: number; // Optional: starting index for positional accuracy
  reason?: string;  // Optional: explanation of the change
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
  /**
   * For diff-based transformations (CONDENSE, SIMPLIFY):
   * Contains find/replace pairs instead of full document content.
   * Frontend can apply these diffs programmatically for 80-90% token savings.
   */
  changes?: DocumentChange[];
  /**
   * Indicates whether diff-based transformation was used.
   * If true, frontend should apply changes[] instead of transformedContent.
   */
  useDiffMode?: boolean;
}

export interface PromptEnhanceRequest {
  prompt: string;
  documentType?: string;
  jurisdiction?: string;
  caseId?: number | null;
}

export interface PromptEnhanceResponse {
  enhancedPrompt: string;
  originalPrompt: string;
}

export interface DraftGenerationRequest {
  userId: number;
  caseId?: number | null;
  prompt: string;
  documentType: string;
  jurisdiction: string;
  practiceArea?: string;  // Slug from PRACTICE_AREAS (e.g. 'pi', 'family') — drives 4-way template cascade
  sessionName: string;
  researchMode: string;  // Research mode: FAST or THOROUGH
  courtLevel?: string;   // Court level: DEFAULT, DISTRICT_COURT, etc.
  documentOptions?: { [key: string]: any };  // Doc-specific config (e.g. LOR recipientType + purposes)
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
    // §6.1 gating metadata — drives the DRAFT watermark overlay in the UI.
    // When approvalStatus transitions from 'draft' to 'approved' the watermark disappears.
    approvalStatus?: string | null;
    isVerificationOverdue?: boolean | null;
    templateVersion?: string | null;
    lastVerified?: string | null;
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

  constructor(
    private http: HttpClient,
    private userService: UserService
  ) {}

  private getUserId(): number {
    return this.userService.getCurrentUserId() || 1;
  }

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
    const userId = this.getUserId();

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
   * Generate draft with conversation (combined endpoint — non-streaming fallback)
   */
  generateDraftWithConversation(request: DraftGenerationRequest): Observable<DraftGenerationResponse> {
    return this.http.post<DraftGenerationResponse>(
      `${environment.apiUrl}/api/legal/ai-workspace/drafts/generate`,
      request
    );
  }

  /**
   * Open SSE connection for draft token streaming.
   * Must be called BEFORE triggerStreamingGeneration.
   * EventSource can't send Authorization headers, so JWT is passed as query param.
   */
  openDraftStream(conversationId: number): EventSource {
    const token = localStorage.getItem('[KEY] TOKEN') || '';
    const url = `${environment.apiUrl}/api/legal/ai-workspace/drafts/stream?conversationId=${conversationId}&token=${encodeURIComponent(token)}`;
    return new EventSource(url);
  }

  /**
   * Trigger streaming draft generation. Returns 202 immediately.
   * Tokens arrive via the SSE connection opened by openDraftStream().
   */
  triggerStreamingGeneration(request: DraftGenerationRequest): Observable<any> {
    return this.http.post(
      `${environment.apiUrl}/api/legal/ai-workspace/drafts/generate-streaming`,
      request
    );
  }

  /**
   * Get a completed draft by conversation ID — polling fallback when SSE drops.
   */
  getDraftByConversation(conversationId: number): Observable<any> {
    return this.http.get(
      `${environment.apiUrl}/api/legal/ai-workspace/drafts/by-conversation/${conversationId}`
    );
  }

  /**
   * Enhance a rough prompt into a detailed, structured legal document prompt
   */
  enhancePrompt(request: PromptEnhanceRequest): Observable<PromptEnhanceResponse> {
    return this.http.post<PromptEnhanceResponse>(
      `${environment.apiUrl}/api/legal/ai-workspace/drafts/enhance-prompt`,
      request
    );
  }

  /**
   * Apply revision tool to document (simplify, condense, expand, redraft)
   */
  reviseDocument(request: DocumentRevisionRequest): Observable<GeneratedDocument> {
    return this.http.post<GeneratedDocument>(`${this.apiUrl}/revise`, request);
  }

  // ========================================================================
  // §6.1 Attorney Review State Machine (ABA Opinion 512)
  // ========================================================================

  /**
   * Flip a draft into 'in_review' so an attorney can review it.
   */
  requestAttorneyReview(documentId: number, message?: string): Observable<DocumentReviewState> {
    return this.http.post<DocumentReviewState>(
      `${environment.apiUrl}/api/legal/ai-workspace/documents/${documentId}/request-review`,
      { message: message ?? null }
    );
  }

  /**
   * Attorney/admin approves a document. Clears the watermark.
   */
  approveDocument(documentId: number, notes?: string): Observable<DocumentReviewState> {
    return this.http.post<DocumentReviewState>(
      `${environment.apiUrl}/api/legal/ai-workspace/documents/${documentId}/approve`,
      { notes: notes ?? null }
    );
  }

  /**
   * Attorney/admin rejects with change notes. Notes are required — backend will 400 without them.
   */
  requestChanges(documentId: number, notes: string): Observable<DocumentReviewState> {
    return this.http.post<DocumentReviewState>(
      `${environment.apiUrl}/api/legal/ai-workspace/documents/${documentId}/request-changes`,
      { notes }
    );
  }

  /**
   * Doc owner reverts an approved/rejected doc back to 'draft' (e.g. to make further edits).
   */
  revertDocumentToDraft(documentId: number): Observable<DocumentReviewState> {
    return this.http.post<DocumentReviewState>(
      `${environment.apiUrl}/api/legal/ai-workspace/documents/${documentId}/revert-to-draft`,
      {}
    );
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
   * Strips all HTML tags and inline styles, preserves text content with basic formatting
   */
  convertHtmlToMarkdown(html: string): string {
    if (!html) return '';

    // Use DOM parser for reliable HTML parsing
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Process the document recursively to extract clean text
    const processNode = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const element = node as Element;
      const tagName = element.tagName.toLowerCase();
      const children = Array.from(node.childNodes).map(processNode).join('');

      switch (tagName) {
        case 'h1':
          return `\n# ${children.trim()}\n\n`;
        case 'h2':
          return `\n## ${children.trim()}\n\n`;
        case 'h3':
          return `\n### ${children.trim()}\n\n`;
        case 'h4':
          return `\n#### ${children.trim()}\n\n`;
        case 'h5':
          return `\n##### ${children.trim()}\n\n`;
        case 'h6':
          return `\n###### ${children.trim()}\n\n`;
        case 'strong':
        case 'b':
          return `**${children}**`;
        case 'em':
        case 'i':
          return `*${children}*`;
        case 'u':
          return `__${children}__`;
        case 'a':
          const href = element.getAttribute('href') || '';
          return `[${children}](${href})`;
        case 'p':
          const pContent = children.trim();
          return pContent ? `\n${pContent}\n\n` : '\n';
        case 'br':
          return '\n';
        case 'ul':
        case 'ol':
          return `\n${children}\n`;
        case 'li':
          return `- ${children.trim()}\n`;
        case 'blockquote':
          return `\n> ${children.trim()}\n\n`;
        case 'code':
          return `\`${children}\``;
        case 'pre':
          return `\n\`\`\`\n${children}\n\`\`\`\n\n`;
        case 'hr':
          return '\n---\n\n';
        case 'table':
          return this.convertTableElement(element);
        case 'div':
        case 'span':
        case 'section':
        case 'article':
        case 'main':
        case 'header':
        case 'footer':
          return children;
        default:
          return children;
      }
    };

    let markdown = processNode(doc.body);

    // Clean up the output
    markdown = markdown.replace(/\n{3,}/g, '\n\n');  // Max 2 consecutive newlines
    markdown = markdown.replace(/^\n+/, '');          // Remove leading newlines
    markdown = markdown.replace(/\n+$/, '');          // Remove trailing newlines
    markdown = markdown.replace(/[ \t]+$/gm, '');     // Remove trailing spaces on each line

    return markdown.trim();
  }

  /**
   * Convert a table element to markdown format
   */
  private convertTableElement(table: Element): string {
    const rows = table.querySelectorAll('tr');
    if (rows.length === 0) return '';

    let result = '\n';
    let headerProcessed = false;

    rows.forEach((row, index) => {
      const cells = row.querySelectorAll('th, td');
      const cellContents = Array.from(cells).map(cell => (cell.textContent || '').trim());

      result += '| ' + cellContents.join(' | ') + ' |\n';

      // Add separator after header row
      if (index === 0 && !headerProcessed) {
        result += '| ' + cellContents.map(() => '---').join(' | ') + ' |\n';
        headerProcessed = true;
      }
    });

    return result + '\n';
  }

  /**
   * Clean HTML content - remove inline styles but preserve semantic structure
   * This is what the backend needs to convert HTML to Word/PDF properly
   */
  cleanHtmlForExport(html: string): string {
    if (!html) return '';

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Recursively clean all elements
    const cleanElement = (element: Element) => {
      element.removeAttribute('style');
      element.removeAttribute('class');
      Array.from(element.attributes).forEach(attr => {
        if (attr.name.startsWith('data-')) {
          element.removeAttribute(attr.name);
        }
      });
      Array.from(element.children).forEach(child => cleanElement(child));
    };

    cleanElement(doc.body);

    // Post-clean: detect and style caption tables for PDF export.
    // This runs AFTER cleanElement so styles added here survive to the backend.
    // Detection is based on cell TEXT content (§ symbols) which CKEditor cannot strip.
    this.fixCaptionTablesForExport(doc.body, doc.body.ownerDocument);

    // Get clean HTML
    let cleanHtml = doc.body.innerHTML;

    // Remove empty paragraphs and spans
    cleanHtml = cleanHtml.replace(/<p>\s*<br\s*\/?>\s*<\/p>/gi, '<br>');
    cleanHtml = cleanHtml.replace(/<span>\s*<\/span>/gi, '');
    cleanHtml = cleanHtml.replace(/<p>\s*<\/p>/gi, '');

    return cleanHtml;
  }

  /**
   * Post-processing: detect caption tables by § cell content, then apply
   * proper inline styles + HTML attributes for iText PDF rendering.
   * Also extracts CAUSE NO. from cells, removes <figure> wrapper,
   * and cleans duplicate preamble headings.
   */
  private fixCaptionTablesForExport(body: HTMLElement, ownerDoc: globalThis.Document): void {
    const tables: HTMLTableElement[] = Array.from(body.querySelectorAll('table'));

    for (const table of tables) {
      // Detect caption table: 2+ cells whose sole text content is §
      const allCells: HTMLTableCellElement[] = Array.from(table.querySelectorAll('td'));
      const sectionCells = allCells.filter(td => td.textContent?.trim() === '§');
      if (sectionCells.length < 2) continue;

      // --- CAPTION TABLE FOUND ---

      // 1. Extract CAUSE NO. from any cell → will become centered header above
      let causeNoText = '';
      const rows: HTMLTableRowElement[] = Array.from(table.querySelectorAll('tr'));
      for (let ri = 0; ri < rows.length; ri++) {
        const cells: HTMLTableCellElement[] = Array.from(rows[ri].querySelectorAll('td'));
        for (const cell of cells) {
          const text = cell.textContent?.trim() || '';
          if (/cause\s+no/i.test(text) && text !== '§') {
            causeNoText = text;
            cell.textContent = '';
          }
        }
        // If row is now empty (only § and blanks), remove it
        if (causeNoText) {
          const hasContent = Array.from(rows[ri].querySelectorAll('td'))
            .some(td => td.textContent?.trim() && td.textContent?.trim() !== '§');
          if (!hasContent) rows[ri].remove();
          break;
        }
      }

      // 2. Remove <figure> wrapper (CKEditor wraps tables in <figure class="table">)
      const parent = table.parentElement;
      if (parent && parent.tagName === 'FIGURE') {
        parent.parentElement!.insertBefore(table, parent);
        parent.remove();
      }

      // 3. Style table — inline styles override backend CSS `table { width: 100% }`
      table.setAttribute('style',
        'width:85%; margin-left:auto; margin-right:auto; border:none; border-collapse:collapse;');
      table.setAttribute('border', '0');
      table.setAttribute('width', '85%');
      table.setAttribute('align', 'center');
      table.setAttribute('cellpadding', '4');
      table.setAttribute('cellspacing', '0');

      // 4. Style cells with column widths
      const updatedRows: HTMLTableRowElement[] = Array.from(table.querySelectorAll('tr'));
      for (const row of updatedRows) {
        const cells: Element[] = Array.from(row.querySelectorAll('td, th'));
        // Convert any <th> to <td> (caption tables have no headers)
        for (const cell of cells) {
          if (cell.tagName === 'TH') {
            const td = ownerDoc.createElement('td');
            td.innerHTML = cell.innerHTML;
            cell.parentElement!.replaceChild(td, cell);
          }
        }
        // Re-query after possible th→td conversion
        const tds: HTMLTableCellElement[] = Array.from(row.querySelectorAll('td'));
        for (let ci = 0; ci < tds.length; ci++) {
          const td = tds[ci];
          const text = td.textContent?.trim() || '';

          if (text === '§') {
            td.setAttribute('style',
              'width:6%; border:none; padding:2px 4px; text-align:center; vertical-align:top;');
            td.setAttribute('width', '6%');
            td.setAttribute('align', 'center');
            td.setAttribute('valign', 'top');
          } else if (ci === 0) {
            td.setAttribute('style',
              'width:42%; border:none; padding:2px 4px; vertical-align:top;');
            td.setAttribute('width', '42%');
            td.setAttribute('valign', 'top');
          } else {
            td.setAttribute('style',
              'width:52%; border:none; padding:2px 4px; vertical-align:top;');
            td.setAttribute('width', '52%');
            td.setAttribute('valign', 'top');
          }
        }
      }

      // 5. Insert CAUSE NO. centered above the table
      if (causeNoText) {
        const causeDiv = ownerDoc.createElement('div');
        causeDiv.setAttribute('style', 'text-align:center; margin-bottom:12px;');
        causeDiv.setAttribute('align', 'center');
        causeDiv.innerHTML = `<strong>${causeNoText}</strong>`;
        table.parentElement!.insertBefore(causeDiv, table);
      }

      // 6. Remove duplicate preamble headings above the caption
      const preamblePatterns = [
        /CAUSE\s+NO/i, /\bDISTRICT\s+COURT\b/i, /\bCOURT\s+AT\s+LAW\b/i,
        /\bCOUNTY\s+COURT\b/i, /\bCIRCUIT\s+COURT\b/i, /\bSUPERIOR\s+COURT\b/i,
        /COUNTY,?\s+\w+/i, /^STATE\s+OF\s+/i, /^COMMONWEALTH\s+OF\s+/i,
      ];
      // Start scanning from element before table (skip the causeDiv we may have inserted)
      let sibling: Element | null = table.previousElementSibling;
      if (sibling && causeNoText && /cause\s+no/i.test(sibling.textContent || '')) {
        sibling = sibling.previousElementSibling;
      }
      let checked = 0;
      while (sibling && checked < 10) {
        const text = sibling.textContent?.trim() || '';
        const prev: Element | null = sibling.previousElementSibling;
        if (!text || sibling.tagName === 'HR') {
          sibling.remove();
          sibling = prev;
          checked++;
          continue;
        }
        if (preamblePatterns.some(p => p.test(text))) {
          sibling.remove();
          sibling = prev;
          checked++;
          continue;
        }
        break;
      }

      return; // Only process the first caption table found
    }
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
   * Export content to Word (DOCX) - no document ID required
   * Used for workflow drafts that haven't been saved to database
   */
  exportContentToWord(content: string, title: string, approvalStatus?: string | null): Observable<HttpResponse<Blob>> {
    const body: any = { content, title };
    if (approvalStatus) body.approvalStatus = approvalStatus;
    return this.http.post(
      `${environment.apiUrl}/api/legal/ai-workspace/export/content/word`,
      body,
      {
        responseType: 'blob',
        observe: 'response'
      }
    );
  }

  /**
   * Export content to PDF - no document ID required
   * Used for workflow drafts that haven't been saved to database.
   * `approvalStatus` drives the watermark: "attorney_reviewed" → clean paper,
   * "in_review" → IN REVIEW stamp, anything else (draft/changes_requested/null) → DRAFT.
   */
  exportContentToPDF(
    content: string,
    title: string,
    documentType?: string,
    approvalStatus?: string | null,
  ): Observable<HttpResponse<Blob>> {
    const body: any = { content, title };
    if (documentType) body.documentType = documentType;
    if (approvalStatus) body.approvalStatus = approvalStatus;
    return this.http.post(
      `${environment.apiUrl}/api/legal/ai-workspace/export/content/pdf`,
      body,
      {
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

  /**
   * Update stationery association on a document (template + attorney IDs)
   */
  updateDocumentStationery(documentId: number, stationeryTemplateId: number | null, stationeryAttorneyId: number | null): Observable<any> {
    return this.http.patch(
      `${environment.apiUrl}/api/legal/ai-workspace/documents/${documentId}/stationery`,
      { stationeryTemplateId, stationeryAttorneyId }
    );
  }

  /**
   * Get the last jurisdiction used for documents linked to a specific case.
   * Used to auto-populate jurisdiction and detect mismatches.
   */
  getLastJurisdiction(caseId: number): Observable<{ jurisdiction: string }> {
    return this.http.get<{ jurisdiction: string }>(
      `${environment.apiUrl}/api/legal/ai-workspace/cases/${caseId}/last-jurisdiction`
    );
  }

  /**
   * Generate Word document from HTML content using docx.js
   * This provides proper formatting support (bold, italic, headings, tables, lists)
   * Returns a Promise that resolves when the download is complete
   */
  async generateWordFromHtml(html: string, title: string): Promise<void> {
    if (!html) {
      throw new Error('No content to export');
    }

    // Extract stationery footer from comment markers before parsing
    let footerText: string | null = null;
    let processedHtml = html;
    const fStartMarker = '<!--STATIONERY_FOOTER_START-->';
    const fEndMarker = '<!--STATIONERY_FOOTER_END-->';
    const fStart = html.indexOf(fStartMarker);
    const fEnd = html.indexOf(fEndMarker);
    if (fStart !== -1 && fEnd !== -1) {
      const footerBlock = html.substring(fStart, fEnd + fEndMarker.length);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = footerBlock;
      footerText = tempDiv.textContent?.trim() || null;
      processedHtml = html.replace(footerBlock, '');
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(processedHtml, 'text/html');
    const docElements: (Paragraph | Table)[] = [];

    // Add title as heading
    if (title) {
      docElements.push(
        new Paragraph({
          text: title,
          heading: HeadingLevel.TITLE,
          spacing: { after: 400 }
        })
      );
    }

    // Process all child nodes of body with table row collection
    this.processHtmlNodesWithTableDetection(doc.body.childNodes, docElements);

    // Append stationery footer at document end with separator
    if (footerText) {
      docElements.push(new Paragraph({ children: [], spacing: { before: 600 } }));
      docElements.push(new Paragraph({
        children: [],
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } }
      }));
      docElements.push(new Paragraph({
        children: [new TextRun({ text: footerText, size: 16, color: '555555', font: 'Times New Roman' })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 100 }
      }));
    }

    // Create the Word document
    const wordDoc = new Document({
      sections: [{
        properties: {},
        children: docElements
      }]
    });

    // Generate and download
    const blob = await Packer.toBlob(wordDoc);
    const filename = this.sanitizeFilenameForWord(title) + '.docx';
    saveAs(blob, filename);
  }

  /**
   * Process HTML nodes with smart table detection
   * Collects consecutive paragraphs that look like markdown table rows
   */
  private processHtmlNodesWithTableDetection(nodes: NodeListOf<ChildNode>, elements: (Paragraph | Table)[]): void {
    const nodeArray = Array.from(nodes);
    let i = 0;

    while (i < nodeArray.length) {
      const node = nodeArray[i];

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) {
          if (this.looksLikeTableRow(text)) {
            // Collect consecutive table rows
            const tableRows: string[] = [text];
            i++;
            while (i < nodeArray.length) {
              const nextNode = nodeArray[i];
              const nextText = nextNode.textContent?.trim() || '';
              if (this.looksLikeTableRow(nextText) || this.isTableSeparator(nextText)) {
                if (!this.isTableSeparator(nextText)) {
                  tableRows.push(nextText);
                }
                i++;
              } else {
                break;
              }
            }
            // Build table from collected rows
            const table = this.buildTableFromRows(tableRows);
            if (table) {
              elements.push(table);
            }
            continue;
          } else {
            elements.push(new Paragraph({ children: [new TextRun(text)] }));
          }
        }
        i++;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        const tagName = element.tagName.toLowerCase();
        const elementText = element.textContent?.trim() || '';

        // Check if this element and following elements form a table
        if (tagName === 'p' && this.looksLikeTableRow(elementText)) {
          // Collect consecutive table-row paragraphs
          const tableRows: string[] = [elementText];
          i++;
          while (i < nodeArray.length) {
            const nextNode = nodeArray[i];
            if (nextNode.nodeType === Node.ELEMENT_NODE) {
              const nextEl = nextNode as Element;
              const nextText = nextEl.textContent?.trim() || '';
              if (this.looksLikeTableRow(nextText) || this.isTableSeparator(nextText)) {
                if (!this.isTableSeparator(nextText)) {
                  tableRows.push(nextText);
                }
                i++;
              } else {
                break;
              }
            } else {
              break;
            }
          }
          // Build table from collected rows
          const table = this.buildTableFromRows(tableRows);
          if (table) {
            elements.push(table);
          }
          continue;
        }

        // Process regular elements
        this.processElement(element, elements);
        i++;
      } else {
        i++;
      }
    }
  }

  /**
   * Process a single HTML element (used by both methods)
   */
  private processElement(element: Element, elements: (Paragraph | Table)[]): void {
    const tagName = element.tagName.toLowerCase();

    switch (tagName) {
      case 'h1':
        elements.push(new Paragraph({
          children: this.extractTextRuns(element),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        }));
        break;
      case 'h2':
        elements.push(new Paragraph({
          children: this.extractTextRuns(element),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 }
        }));
        break;
      case 'h3':
        elements.push(new Paragraph({
          children: this.extractTextRuns(element),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 }
        }));
        break;
      case 'h4':
      case 'h5':
      case 'h6':
        elements.push(new Paragraph({
          children: this.extractTextRuns(element),
          heading: HeadingLevel.HEADING_4,
          spacing: { before: 200, after: 100 }
        }));
        break;
      case 'p':
        const runs = this.extractTextRuns(element);
        if (runs.length > 0) {
          elements.push(new Paragraph({
            children: runs,
            spacing: { after: 200 }
          }));
        }
        break;
      case 'ul':
      case 'ol':
        this.processListItems(element, elements, tagName === 'ol');
        break;
      case 'table':
        const table = this.processTable(element);
        if (table) {
          elements.push(table);
        }
        break;
      case 'blockquote':
        elements.push(new Paragraph({
          children: this.extractTextRuns(element),
          indent: { left: 720 },
          spacing: { before: 200, after: 200 }
        }));
        break;
      case 'br':
        elements.push(new Paragraph({ children: [] }));
        break;
      case 'hr':
        elements.push(new Paragraph({
          children: [],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } },
          spacing: { before: 200, after: 200 }
        }));
        break;
      case 'figure':
      case 'div':
      case 'section':
      case 'article':
        this.processHtmlNodesWithTableDetection(element.childNodes, elements);
        break;
      default:
        const defaultRuns = this.extractTextRuns(element);
        if (defaultRuns.length > 0) {
          elements.push(new Paragraph({ children: defaultRuns }));
        }
    }
  }

  /**
   * Check if a text line looks like a markdown table row
   */
  private looksLikeTableRow(text: string): boolean {
    if (!text) return false;
    const trimmed = text.trim();
    // Must start and end with pipe, or have multiple pipes
    return (trimmed.startsWith('|') && trimmed.endsWith('|')) ||
           (trimmed.split('|').length >= 3);
  }

  /**
   * Check if a text line is a table separator (like |---|---|)
   */
  private isTableSeparator(text: string): boolean {
    if (!text) return false;
    const trimmed = text.trim();
    return /^\|[\s\-:]+\|$/.test(trimmed) ||
           /^\|(\s*-+\s*\|)+$/.test(trimmed) ||
           /^[\|\s\-:]+$/.test(trimmed);
  }

  /**
   * Build a Word table from collected row strings
   */
  private buildTableFromRows(rows: string[]): Table | null {
    if (!rows || rows.length === 0) return null;

    const tableRows: TableRow[] = [];
    let isFirstRow = true;
    let columnCount = 0;

    // First pass - determine column count from first row
    if (rows.length > 0) {
      const firstRowCells = this.parseTableRowCells(rows[0]);
      columnCount = firstRowCells.length;
    }

    if (columnCount === 0) return null;

    // Calculate column widths - 9360 twips = 6.5 inches (typical page width minus margins)
    const tableWidthTwips = 9360;
    const cellWidthTwips = Math.floor(tableWidthTwips / columnCount);
    const columnWidths = Array(columnCount).fill(cellWidthTwips);

    for (const row of rows) {
      const cells = this.parseTableRowCells(row);
      if (cells.length === 0) continue;

      // Pad cells if row has fewer columns than expected
      while (cells.length < columnCount) {
        cells.push('');
      }

      const tableCells: TableCell[] = cells.slice(0, columnCount).map(cellText => {
        return new TableCell({
          children: [new Paragraph({
            children: [new TextRun({
              text: cellText,
              bold: isFirstRow
            })]
          })],
          shading: isFirstRow ? { fill: 'E8E8E8' } : undefined
        });
      });

      tableRows.push(new TableRow({ children: tableCells }));
      isFirstRow = false;
    }

    if (tableRows.length === 0) return null;

    return new Table({
      rows: tableRows,
      width: { size: tableWidthTwips, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: columnWidths
    });
  }

  /**
   * Parse cells from a markdown table row string
   */
  private parseTableRowCells(row: string): string[] {
    return row
      .split('|')
      .map(cell => cell.trim())
      .filter((cell, index, arr) => {
        // Filter out empty cells from leading/trailing pipes
        if (index === 0 && cell === '') return false;
        if (index === arr.length - 1 && cell === '') return false;
        return true;
      });
  }

  /**
   * Process HTML nodes recursively and convert to docx elements
   * @deprecated Use processHtmlNodesWithTableDetection instead
   */
  private processHtmlNodes(nodes: NodeListOf<ChildNode>, elements: (Paragraph | Table)[]): void {
    nodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) {
          // Check if this text contains a markdown table
          if (this.isMarkdownTable(text)) {
            const table = this.parseMarkdownTable(text);
            if (table) {
              elements.push(table);
            }
          } else {
            elements.push(new Paragraph({ children: [new TextRun(text)] }));
          }
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        const tagName = element.tagName.toLowerCase();

        switch (tagName) {
          case 'h1':
            elements.push(new Paragraph({
              children: this.extractTextRuns(element),
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 }
            }));
            break;
          case 'h2':
            elements.push(new Paragraph({
              children: this.extractTextRuns(element),
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 150 }
            }));
            break;
          case 'h3':
            elements.push(new Paragraph({
              children: this.extractTextRuns(element),
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 200, after: 100 }
            }));
            break;
          case 'h4':
          case 'h5':
          case 'h6':
            elements.push(new Paragraph({
              children: this.extractTextRuns(element),
              heading: HeadingLevel.HEADING_4,
              spacing: { before: 200, after: 100 }
            }));
            break;
          case 'p':
            // Check if paragraph contains a markdown table
            const pText = element.textContent || '';
            if (this.isMarkdownTable(pText)) {
              const mdTable = this.parseMarkdownTable(pText);
              if (mdTable) {
                elements.push(mdTable);
                break;
              }
            }
            const runs = this.extractTextRuns(element);
            if (runs.length > 0) {
              elements.push(new Paragraph({
                children: runs,
                spacing: { after: 200 }
              }));
            }
            break;
          case 'ul':
          case 'ol':
            this.processListItems(element, elements, tagName === 'ol');
            break;
          case 'table':
            const table = this.processTable(element);
            if (table) {
              elements.push(table);
            }
            break;
          case 'blockquote':
            elements.push(new Paragraph({
              children: this.extractTextRuns(element),
              indent: { left: 720 },
              spacing: { before: 200, after: 200 }
            }));
            break;
          case 'br':
            elements.push(new Paragraph({ children: [] }));
            break;
          case 'hr':
            elements.push(new Paragraph({
              children: [],
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } },
              spacing: { before: 200, after: 200 }
            }));
            break;
          case 'figure':
          case 'div':
          case 'section':
          case 'article':
            this.processHtmlNodes(element.childNodes, elements);
            break;
          default:
            // For other elements, try to extract text
            const defaultRuns = this.extractTextRuns(element);
            if (defaultRuns.length > 0) {
              elements.push(new Paragraph({ children: defaultRuns }));
            }
        }
      }
    });
  }

  /**
   * Extract TextRuns from an element, preserving formatting (bold, italic, underline)
   */
  private extractTextRuns(element: Element): TextRun[] {
    const runs: TextRun[] = [];

    const processNode = (node: Node, isBold = false, isItalic = false, isUnderline = false): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (text) {
          runs.push(new TextRun({
            text,
            bold: isBold,
            italics: isItalic,
            underline: isUnderline ? {} : undefined
          }));
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const tag = el.tagName.toLowerCase();

        // Determine formatting
        let newBold = isBold || tag === 'strong' || tag === 'b';
        let newItalic = isItalic || tag === 'em' || tag === 'i';
        let newUnderline = isUnderline || tag === 'u';

        // Handle line breaks
        if (tag === 'br') {
          runs.push(new TextRun({ text: '', break: 1 }));
          return;
        }

        // Process children
        el.childNodes.forEach(child => {
          processNode(child, newBold, newItalic, newUnderline);
        });
      }
    };

    element.childNodes.forEach(child => processNode(child));
    return runs;
  }

  /**
   * Extract multiple Paragraphs from a table cell, preserving line breaks between block elements.
   * Each <p>, <div>, or <br> inside the cell becomes its own Paragraph.
   */
  private extractCellParagraphs(cell: Element, isHeader: boolean): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    const blockTags = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li']);

    // Check if cell has block-level children
    const hasBlockChildren = Array.from(cell.children).some(
      child => blockTags.has(child.tagName.toLowerCase())
    );

    if (!hasBlockChildren) {
      // No block children — single paragraph with all text runs
      const runs = this.extractTextRuns(cell);
      if (isHeader) {
        return [new Paragraph({
          children: runs.length > 0 ? runs.map(r => new TextRun({
            text: (r as any).text || '',
            bold: true,
            italics: (r as any).italics,
            underline: (r as any).underline
          })) : [new TextRun({ text: cell.textContent || '', bold: true })]
        })];
      }
      return [new Paragraph({ children: runs.length > 0 ? runs : [new TextRun(cell.textContent || '')] })];
    }

    // Process each child node — block elements become separate paragraphs
    cell.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) {
          paragraphs.push(new Paragraph({
            children: [new TextRun({ text, bold: isHeader })]
          }));
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const tag = el.tagName.toLowerCase();

        if (tag === 'br') {
          paragraphs.push(new Paragraph({ children: [new TextRun('')] }));
        } else if (blockTags.has(tag)) {
          const runs = this.extractTextRuns(el);
          if (isHeader && runs.length > 0) {
            paragraphs.push(new Paragraph({
              children: runs.map(r => new TextRun({
                text: (r as any).text || '',
                bold: true,
                italics: (r as any).italics,
                underline: (r as any).underline
              }))
            }));
          } else {
            paragraphs.push(new Paragraph({
              children: runs.length > 0 ? runs : [new TextRun(el.textContent || '')]
            }));
          }
        } else {
          // Inline element — extract runs
          const runs = this.extractTextRuns(el);
          if (runs.length > 0) {
            paragraphs.push(new Paragraph({
              children: isHeader ? runs.map(r => new TextRun({
                text: (r as any).text || '',
                bold: true,
                italics: (r as any).italics,
                underline: (r as any).underline
              })) : runs
            }));
          }
        }
      }
    });

    return paragraphs;
  }

  /**
   * Process list items (ul/ol)
   */
  private processListItems(listElement: Element, elements: (Paragraph | Table)[], isOrdered: boolean): void {
    const items = listElement.querySelectorAll(':scope > li');
    items.forEach((item, index) => {
      const bullet = isOrdered ? `${index + 1}. ` : '• ';
      const textRuns = this.extractTextRuns(item);

      // Prepend bullet/number
      if (textRuns.length > 0) {
        textRuns.unshift(new TextRun({ text: bullet }));
      } else {
        textRuns.push(new TextRun({ text: bullet }));
      }

      elements.push(new Paragraph({
        children: textRuns,
        indent: { left: 720 },
        spacing: { after: 100 }
      }));
    });
  }

  /**
   * Process HTML table to docx Table
   */
  private processTable(tableElement: Element): Table | null {
    const rows = tableElement.querySelectorAll('tr');
    if (rows.length === 0) return null;

    // Determine column count from first row
    const firstRow = rows[0];
    const firstRowCells = firstRow.querySelectorAll('th, td');
    const columnCount = firstRowCells.length;
    if (columnCount === 0) return null;

    // Calculate column widths - 9360 twips = 6.5 inches
    const tableWidthTwips = 9360;
    const cellWidthTwips = Math.floor(tableWidthTwips / columnCount);
    const columnWidths = Array(columnCount).fill(cellWidthTwips);

    const tableRows: TableRow[] = [];

    rows.forEach((row, rowIndex) => {
      const cells = row.querySelectorAll('th, td');
      const tableCells: TableCell[] = [];

      cells.forEach(cell => {
        const isHeader = cell.tagName.toLowerCase() === 'th' || rowIndex === 0;
        const cellParagraphs = this.extractCellParagraphs(cell, isHeader);

        tableCells.push(
          new TableCell({
            children: cellParagraphs.length > 0 ? cellParagraphs : [new Paragraph({ children: [new TextRun('')] })],
            shading: isHeader ? { fill: 'E8E8E8' } : undefined
          })
        );
      });

      tableRows.push(new TableRow({ children: tableCells }));
    });

    return new Table({
      rows: tableRows,
      width: { size: tableWidthTwips, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: columnWidths
    });
  }

  /**
   * Check if text contains a markdown-style table (pipe-delimited)
   */
  private isMarkdownTable(text: string): boolean {
    if (!text) return false;
    const lines = text.split('\n').filter(line => line.trim());
    // Need at least 2 lines (header + separator or header + data)
    if (lines.length < 2) return false;
    // Check if lines contain pipe characters typical of markdown tables
    const pipeLines = lines.filter(line => line.includes('|') && line.trim().startsWith('|'));
    return pipeLines.length >= 2;
  }

  /**
   * Parse markdown-style table text into a Word Table
   */
  private parseMarkdownTable(text: string): Table | null {
    if (!text) return null;

    const lines = text.split('\n').filter(line => line.trim());
    const tableRows: TableRow[] = [];
    let isFirstDataRow = true;
    let columnCount = 0;

    // First pass - determine column count from first data row
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || !trimmedLine.includes('|')) continue;
      if (/^\|[\s\-:]+\|$/.test(trimmedLine) || /^\|(\s*-+\s*\|)+$/.test(trimmedLine)) continue;

      const cells = this.parseTableRowCells(trimmedLine);
      if (cells.length > 0) {
        columnCount = cells.length;
        break;
      }
    }

    if (columnCount === 0) return null;

    // Calculate column widths - 9360 twips = 6.5 inches
    const tableWidthTwips = 9360;
    const cellWidthTwips = Math.floor(tableWidthTwips / columnCount);
    const columnWidths = Array(columnCount).fill(cellWidthTwips);

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines
      if (!trimmedLine) continue;

      // Skip separator lines (like |---|---|---|)
      if (/^\|[\s\-:]+\|$/.test(trimmedLine) || /^\|(\s*-+\s*\|)+$/.test(trimmedLine)) {
        continue;
      }

      // Skip lines that don't look like table rows
      if (!trimmedLine.includes('|')) continue;

      // Parse cells from the line
      const cells = this.parseTableRowCells(trimmedLine);
      if (cells.length === 0) continue;

      // Pad cells if row has fewer columns than expected
      while (cells.length < columnCount) {
        cells.push('');
      }

      const tableCells: TableCell[] = cells.slice(0, columnCount).map(cellText => {
        return new TableCell({
          children: [new Paragraph({
            children: [new TextRun({
              text: cellText,
              bold: isFirstDataRow
            })]
          })],
          shading: isFirstDataRow ? { fill: 'E8E8E8' } : undefined
        });
      });

      tableRows.push(new TableRow({ children: tableCells }));
      isFirstDataRow = false;
    }

    if (tableRows.length === 0) return null;

    return new Table({
      rows: tableRows,
      width: { size: tableWidthTwips, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: columnWidths
    });
  }

  /**
   * Sanitize filename for Word export
   */
  private sanitizeFilenameForWord(name: string): string {
    if (!name) return 'document';
    return name
      .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
      .replace(/\s+/g, '_')          // Replace spaces with underscores
      .substring(0, 100);            // Limit length
  }
}
