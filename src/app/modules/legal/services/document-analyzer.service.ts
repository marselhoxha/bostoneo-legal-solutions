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
  analysisType: string;
  status: string;
  riskLevel?: string;
  summary?: string;
  createdAt: string;
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
}