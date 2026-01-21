import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../../../environments/environment';
import { Key } from '../../../../../enum/key.enum';

export interface AITemplate {
  id: number;
  name: string;
  category: string;
  description: string;
  practiceArea: string;
  maJurisdictionSpecific: boolean;
  variables: string[];
  styleGuideId?: number;
  isApproved: boolean;
  createdAt: Date;
  templateContent?: string;
  jurisdiction?: string;
  templateType?: 'TEXT' | 'PDF_FORM' | 'HYBRID';
  pdfFormUrl?: string;
  pdfFieldMappings?: string; // JSON string
  pdfFormHash?: string;
}

export interface DocumentGenerationRequest {
  templateId: number;
  caseId?: number;
  variables: { [key: string]: any };
  outputFormat: 'PDF' | 'DOCX' | 'HTML';
  styleGuideId?: number;
}

export interface DocumentGenerationResponse {
  id: number;
  documentUrl: string;
  status: 'GENERATING' | 'COMPLETED' | 'FAILED';
  generatedAt: Date;
  processingTimeMs: number;
  tokensUsed: number;
  costEstimate: number;
  content?: string;
}

export interface AIGenerationLog {
  id: number;
  templateId: number;
  userId: number;
  generationType: string;
  processingTimeMs: number;
  tokensUsed: number;
  costEstimate: number;
  success: boolean;
  errorMessage?: string;
  qualityScore?: number;
  userRating?: number;
  createdAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class AIDocumentService {
  private apiUrl = `${environment.apiUrl}/api/ai/documents`;
  private templateApiUrl = `${environment.apiUrl}/api/ai/templates`;
  
  private generationProgress$ = new BehaviorSubject<number>(0);
  public generationProgress = this.generationProgress$.asObservable();

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem(Key.TOKEN);
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // Template Management
  getTemplates(category?: string, practiceArea?: string): Observable<AITemplate[]> {
    let params = '';
    if (category) params += `?category=${category}`;
    if (practiceArea) params += `${params ? '&' : '?'}practiceArea=${practiceArea}`;
    
    return this.http.get<AITemplate[]>(`${this.templateApiUrl}${params}`, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  getTemplate(id: number): Observable<AITemplate> {
    return this.http.get<AITemplate>(`${this.templateApiUrl}/${id}`, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Document Generation
  generateDocument(request: DocumentGenerationRequest): Observable<DocumentGenerationResponse> {
    this.generationProgress$.next(0);
    
    return this.http.post<DocumentGenerationResponse>(`${this.apiUrl}/generate`, request, { 
      headers: this.getHeaders() 
    }).pipe(
      tap(() => this.generationProgress$.next(100)),
      catchError(this.handleError)
    );
  }

  autoFillTemplate(templateId: number, caseId: number): Observable<{ [key: string]: any }> {
    return this.http.post<{ [key: string]: any }>(`${this.templateApiUrl}/auto-fill`, 
      { templateId, caseId }, 
      { headers: this.getHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  previewDocument(request: DocumentGenerationRequest): Observable<{ previewHtml: string }> {
    return this.http.post<{ previewHtml: string }>(`${this.apiUrl}/preview`, request, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Generation History & Analytics
  getGenerationHistory(userId?: number): Observable<AIGenerationLog[]> {
    let url = `${this.apiUrl}/history`;
    if (userId) url += `?userId=${userId}`;
    
    return this.http.get<AIGenerationLog[]>(url, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  rateGeneration(logId: number, rating: number, feedback?: string): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/history/${logId}/rate`, 
      { rating, feedback }, 
      { headers: this.getHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Usage Analytics
  getUsageAnalytics(startDate?: Date, endDate?: Date): Observable<any> {
    let params = '';
    if (startDate) params += `?startDate=${startDate.toISOString()}`;
    if (endDate) params += `${params ? '&' : '?'}endDate=${endDate.toISOString()}`;
    
    return this.http.get(`${this.apiUrl}/analytics${params}`, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    console.error('AI Document Service Error:', error);
    return throwError(() => error);
  }
}