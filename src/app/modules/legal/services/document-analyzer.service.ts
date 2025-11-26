import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpEventType, HttpContext } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError, tap, timeout } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface DocumentAnalysisResult {
  id: string;
  databaseId: number;  // Numeric database ID for action items/timeline
  fileName: string;
  fileSize: number;
  analysisType: string;
  status: 'processing' | 'completed' | 'failed';
  detectedType?: string;  // Auto-detected document type (Complaint, Contract, etc.)
  extractedMetadata?: string;  // JSON string containing extracted metadata
  requiresOcr?: boolean;  // Flag indicating if OCR is needed
  analysis?: {
    fullAnalysis: string;
    summary?: string;
    riskScore?: number;
    riskLevel?: string;
    keyFindings?: string[];
    recommendations?: string[];
    complianceIssues?: string[];
  };
  timestamp: number;
  processingTimeMs?: number;
  error?: string;
}

export interface AnalysisHistory {
  id: number;
  analysisId: string;
  fileName: string;
  fileType: string;
  detectedType?: string;  // AI-detected legal document type (Complaint, Motion, etc.)
  analysisType: string;
  status: string;
  riskLevel?: string;
  summary?: string;
  createdAt: string;
}

export interface AnalysisMessage {
  id: number;
  analysisId: number;
  role: 'user' | 'assistant';
  content: string;
  userId?: number;
  createdAt: string;
  metadata?: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

@Injectable({
  providedIn: 'root'
})
export class DocumentAnalyzerService {
  private apiUrl = `${environment.apiUrl}/api/ai/document-analyzer`;

  private uploadProgressSubject = new BehaviorSubject<UploadProgress>({ loaded: 0, total: 0, percentage: 0 });
  public uploadProgress$ = this.uploadProgressSubject.asObservable();

  private analysisStatusSubject = new BehaviorSubject<string>('idle');
  public analysisStatus$ = this.analysisStatusSubject.asObservable();

  constructor(private http: HttpClient) {}

  analyzeDocument(file: File, analysisType: string, sessionId?: number): Observable<DocumentAnalysisResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('analysisType', analysisType);
    if (sessionId) {
      formData.append('sessionId', sessionId.toString());
    }

    this.analysisStatusSubject.next('uploading');
    this.uploadProgressSubject.next({ loaded: 0, total: 0, percentage: 0 });

    return this.http.post<DocumentAnalysisResult>(
      `${this.apiUrl}/analyze`,
      formData,
      {
        reportProgress: true,
        observe: 'events',
        withCredentials: true
      }
    ).pipe(
      timeout(620000), // 620 second timeout (backend has 600s = 10 min, this gives 20s buffer)
      map(event => {
        switch (event.type) {
          case HttpEventType.UploadProgress:
            if (event.total) {
              const progress = Math.round(100 * event.loaded / event.total);
              this.uploadProgressSubject.next({
                loaded: event.loaded,
                total: event.total,
                percentage: progress
              });
              if (progress === 100) {
                this.analysisStatusSubject.next('analyzing');
              }
            }
            break;
          case HttpEventType.Response:
            this.analysisStatusSubject.next('completed');
            return event.body as DocumentAnalysisResult;
        }
        return null as any;
      }),
      catchError(error => {
        this.analysisStatusSubject.next('failed');
        console.error('Document analysis error:', error);

        // Better error message for timeout
        if (error.name === 'TimeoutError') {
          console.error('Analysis timed out after 120 seconds');
        }

        return throwError(() => error);
      })
    );
  }

  /**
   * Fetches a document from a URL using the backend proxy.
   * Supports cloud storage URLs (Google Drive, Dropbox, OneDrive, Box) and direct URLs.
   * This avoids CORS issues by proxying the request through the backend.
   */
  fetchDocumentFromUrl(url: string): Observable<{ blob: Blob; filename: string }> {
    this.analysisStatusSubject.next('downloading');

    return this.http.post(
      `${this.apiUrl}/fetch-url`,
      { url },
      {
        responseType: 'blob',
        observe: 'response',
        withCredentials: true
      }
    ).pipe(
      map(response => {
        // Extract filename from Content-Disposition header
        let filename = 'document.pdf';
        const contentDisposition = response.headers.get('content-disposition');
        if (contentDisposition) {
          const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
          if (matches != null && matches[1]) {
            filename = matches[1].replace(/['"]/g, '');
          }
        }

        return {
          blob: response.body as Blob,
          filename
        };
      }),
      tap(() => {
        this.analysisStatusSubject.next('completed');
      }),
      catchError(error => {
        this.analysisStatusSubject.next('failed');
        console.error('Failed to fetch document from URL:', error);
        return throwError(() => error);
      })
    );
  }

  quickAnalysis(content: string, analysisType: string): Observable<DocumentAnalysisResult> {
    this.analysisStatusSubject.next('analyzing');

    return this.http.post<DocumentAnalysisResult>(
      `${this.apiUrl}/quick-analysis`,
      { content, analysisType },
      { withCredentials: true }
    ).pipe(
      tap(result => {
        this.analysisStatusSubject.next(result.status === 'completed' ? 'completed' : 'failed');
      }),
      catchError(error => {
        this.analysisStatusSubject.next('failed');
        console.error('Quick analysis error:', error);
        return throwError(() => error);
      })
    );
  }

  getAnalysisHistory(): Observable<AnalysisHistory[]> {
    return this.http.get<{ analyses: AnalysisHistory[] }>(
      `${this.apiUrl}/analysis-history`,
      { withCredentials: true }
    ).pipe(
      map(response => response.analyses || []),
      catchError(error => {
        console.error('Failed to fetch analysis history:', error);
        return throwError(() => error);
      })
    );
  }

  getAnalysisById(analysisId: string): Observable<DocumentAnalysisResult> {
    return this.http.get<DocumentAnalysisResult>(
      `${this.apiUrl}/analysis/${analysisId}`,
      { withCredentials: true }
    ).pipe(
      catchError(error => {
        console.error('Failed to fetch analysis:', error);
        return throwError(() => error);
      })
    );
  }

  getAnalysisByDatabaseId(databaseId: number): Observable<DocumentAnalysisResult> {
    return this.http.get<DocumentAnalysisResult>(
      `${this.apiUrl}/analysis/db/${databaseId}`,
      { withCredentials: true }
    ).pipe(
      catchError(error => {
        console.error('Failed to fetch analysis by database ID:', error);
        return throwError(() => error);
      })
    );
  }

  downloadAnalysisReport(analysisId: string): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/download/${analysisId}`,
      {
        responseType: 'blob',
        withCredentials: true
      }
    ).pipe(
      catchError(error => {
        console.error('Failed to download report:', error);
        return throwError(() => error);
      })
    );
  }

  // Helper methods for analysis types
  getAnalysisTypes(): { value: string; label: string; description: string }[] {
    return [
      {
        value: 'contract',
        label: 'Contract Analysis',
        description: 'Comprehensive review of contracts, agreements, and legal documents'
      },
      {
        value: 'legal-brief',
        label: 'Legal Brief Review',
        description: 'Analysis of legal briefs, memoranda, and court filings'
      },
      {
        value: 'compliance',
        label: 'Compliance Check',
        description: 'Review documents for regulatory and legal compliance'
      },
      {
        value: 'due-diligence',
        label: 'Due Diligence',
        description: 'Thorough examination for mergers, acquisitions, or investments'
      },
      {
        value: 'risk-assessment',
        label: 'Risk Assessment',
        description: 'Identify and evaluate legal and business risks'
      },
      {
        value: 'general',
        label: 'General Analysis',
        description: 'Comprehensive document review and analysis'
      }
    ];
  }

  // Risk level styling helper
  getRiskLevelClass(riskLevel: string | undefined): string {
    if (!riskLevel) return 'badge-secondary';

    switch (riskLevel.toLowerCase()) {
      case 'high':
        return 'badge-danger';
      case 'medium':
        return 'badge-warning';
      case 'low':
        return 'badge-success';
      default:
        return 'badge-secondary';
    }
  }

  // Status styling helper
  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'badge-success';
      case 'processing':
      case 'analyzing':
        return 'badge-info';
      case 'failed':
        return 'badge-danger';
      default:
        return 'badge-secondary';
    }
  }

  // Format file size for display
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  resetAnalysisState(): void {
    this.analysisStatusSubject.next('idle');
    this.uploadProgressSubject.next({ loaded: 0, total: 0, percentage: 0 });
  }

  // ==========================================
  // Ask AI Message Methods
  // ==========================================

  /**
   * Get all messages for a specific document analysis
   */
  getAnalysisMessages(analysisId: number): Observable<AnalysisMessage[]> {
    return this.http.get<{ messages: AnalysisMessage[], count: number }>(
      `${this.apiUrl}/analysis/${analysisId}/messages`,
      { withCredentials: true }
    ).pipe(
      map(response => response.messages || []),
      catchError(error => {
        console.error('Failed to fetch analysis messages:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Add a message to a document analysis (Ask AI tab)
   */
  addAnalysisMessage(analysisId: number, role: 'user' | 'assistant', content: string, userId?: number): Observable<AnalysisMessage> {
    return this.http.post<AnalysisMessage>(
      `${this.apiUrl}/analysis/${analysisId}/messages`,
      { role, content, userId: userId || 1 },
      { withCredentials: true }
    ).pipe(
      catchError(error => {
        console.error('Failed to add analysis message:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get message count for a specific analysis (for sidebar indicator)
   */
  getMessageCount(analysisId: number): Observable<number> {
    return this.http.get<{ count: number }>(
      `${this.apiUrl}/analysis/${analysisId}/messages/count`,
      { withCredentials: true }
    ).pipe(
      map(response => response.count || 0),
      catchError(error => {
        console.error('Failed to get message count:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Delete all messages for a specific analysis
   */
  deleteAnalysisMessages(analysisId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/analysis/${analysisId}/messages`,
      { withCredentials: true }
    ).pipe(
      catchError(error => {
        console.error('Failed to delete analysis messages:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Delete a document analysis and all related data
   */
  deleteAnalysis(analysisId: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.apiUrl}/analysis/${analysisId}`,
      { withCredentials: true }
    ).pipe(
      catchError(error => {
        console.error('Failed to delete analysis:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Ask AI a question about a specific document analysis
   * Uses the full document context and analysis for accurate responses
   */
  askAboutDocument(analysisId: number, question: string, userId?: number): Observable<{ answer: string; userMessage: AnalysisMessage; assistantMessage: AnalysisMessage }> {
    return this.http.post<{ success: boolean; answer: string; userMessage: AnalysisMessage; assistantMessage: AnalysisMessage }>(
      `${this.apiUrl}/analysis/${analysisId}/ask`,
      { question, userId: userId || 1 },
      { withCredentials: true }
    ).pipe(
      map(response => ({
        answer: response.answer,
        userMessage: response.userMessage,
        assistantMessage: response.assistantMessage
      })),
      catchError(error => {
        console.error('Failed to ask about document:', error);
        return throwError(() => error);
      })
    );
  }
}