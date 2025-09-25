import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface Template {
  id?: number;
  name: string;
  description?: string;
  category: string;
  practiceArea?: string;
  jurisdiction?: string;
  maJurisdictionSpecific?: boolean;
  documentType?: string;
  templateContent?: string;
  templateType?: string;
  pdfFormUrl?: string;
  pdfFieldMappings?: string;
  pdfFormHash?: string;
  aiPromptStructure?: string;
  variableMappings?: string;
  formattingRules?: string;
  styleGuideId?: number;
  usageCount?: number;
  successRate?: number;
  averageRating?: number;
  isPublic?: boolean;
  isApproved?: boolean;
  isMaCertified?: boolean;
  firmId?: number;
  createdBy?: number;
  createdAt?: string;
  updatedAt?: string;
  selected?: boolean;
}

export interface TemplateVariable {
  id?: number;
  templateId: number;
  variableName: string;
  variableType: string;
  dataSource: string;
  defaultValue?: string;
  isRequired: boolean;
  displayOrder?: number;
  description?: string;
}

export interface TemplateSearchResult {
  id: number;
  name: string;
  category: string;
  practiceArea?: string;
  jurisdiction?: string;
  description?: string;
  usageCount: number;
  isApproved: boolean;
  relevanceScore?: number;
}

export interface TemplateGenerationRequest {
  [key: string]: string;
}

export interface TemplateGenerationResponse {
  templateId: number;
  content: string;
  generatedAt: string;
}

export interface TemplateAnalysis {
  templateId: number;
  name: string;
  category: string;
  jurisdiction: string;
  variableCount: number;
  variables: string[];
  wordCount: number;
  hasAIEnhancement: boolean;
  hasStyleGuide: boolean;
  isValid: boolean;
  validationErrors: string[];
}

@Injectable({
  providedIn: 'root'
})
export class TemplateService {
  private apiUrl = `${environment.apiUrl}/api/ai/templates`;

  private templatesSubject = new BehaviorSubject<Template[]>([]);
  public templates$ = this.templatesSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {}

  // Get all template categories
  getCategories(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/categories`, { withCredentials: true })
      .pipe(
        catchError(this.handleError)
      );
  }

  // Search templates with filters
  searchTemplates(params: {
    q?: string;
    category?: string;
    practiceArea?: string;
    jurisdiction?: string;
    page?: number;
    size?: number;
  }): Observable<TemplateSearchResult[]> {
    this.loadingSubject.next(true);

    let httpParams = new HttpParams();
    if (params.q) httpParams = httpParams.set('q', params.q);
    if (params.category) httpParams = httpParams.set('category', params.category);
    if (params.practiceArea) httpParams = httpParams.set('practiceArea', params.practiceArea);
    if (params.jurisdiction) httpParams = httpParams.set('jurisdiction', params.jurisdiction);
    if (params.page !== undefined) httpParams = httpParams.set('page', params.page.toString());
    if (params.size !== undefined) httpParams = httpParams.set('size', params.size.toString());

    return this.http.get<TemplateSearchResult[]>(`${this.apiUrl}/search`, {
      params: httpParams,
      withCredentials: true
    }).pipe(
      tap(() => this.loadingSubject.next(false)),
      catchError(error => {
        this.loadingSubject.next(false);
        return this.handleError(error);
      })
    );
  }

  // Get all templates with pagination
  getTemplates(page: number = 0, size: number = 20): Observable<Template[]> {
    this.loadingSubject.next(true);

    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<Template[]>(this.apiUrl, {
      params,
      withCredentials: true
    }).pipe(
      tap(templates => {
        this.templatesSubject.next(templates);
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        return this.handleError(error);
      })
    );
  }

  // Get templates by category
  getTemplatesByCategory(category: string): Observable<Template[]> {
    this.loadingSubject.next(true);

    return this.http.get<Template[]>(`${this.apiUrl}/category/${category}`, { withCredentials: true })
      .pipe(
        tap(() => this.loadingSubject.next(false)),
        catchError(error => {
          this.loadingSubject.next(false);
          return this.handleError(error);
        })
      );
  }

  // Get single template by ID
  getTemplate(id: number): Observable<Template> {
    return this.http.get<Template>(`${this.apiUrl}/${id}`, { withCredentials: true })
      .pipe(
        catchError(this.handleError)
      );
  }

  // Get template variables
  getTemplateVariables(templateId: number): Observable<TemplateVariable[]> {
    return this.http.get<TemplateVariable[]>(`${this.apiUrl}/${templateId}/variables`, { withCredentials: true })
      .pipe(
        catchError(this.handleError)
      );
  }

  // Create new template
  createTemplate(template: Template): Observable<Template> {
    return this.http.post<Template>(this.apiUrl, template, { withCredentials: true })
      .pipe(
        tap(newTemplate => {
          const templates = this.templatesSubject.value;
          this.templatesSubject.next([...templates, newTemplate]);
        }),
        catchError(this.handleError)
      );
  }

  // Update existing template
  updateTemplate(id: number, template: Template): Observable<Template> {
    return this.http.put<Template>(`${this.apiUrl}/${id}`, template, { withCredentials: true })
      .pipe(
        tap(updatedTemplate => {
          const templates = this.templatesSubject.value;
          const index = templates.findIndex(t => t.id === id);
          if (index !== -1) {
            templates[index] = updatedTemplate;
            this.templatesSubject.next([...templates]);
          }
        }),
        catchError(this.handleError)
      );
  }

  // Delete template
  deleteTemplate(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, { withCredentials: true })
      .pipe(
        tap(() => {
          const templates = this.templatesSubject.value;
          const filtered = templates.filter(t => t.id !== id);
          this.templatesSubject.next(filtered);
        }),
        catchError(this.handleError)
      );
  }

  // Duplicate template
  duplicateTemplate(id: number, newName: string): Observable<Template> {
    return this.http.post<Template>(`${this.apiUrl}/${id}/duplicate`,
      { name: newName },
      { withCredentials: true }
    ).pipe(
      tap(newTemplate => {
        const templates = this.templatesSubject.value;
        this.templatesSubject.next([...templates, newTemplate]);
      }),
      catchError(this.handleError)
    );
  }

  // Generate document from template
  generateFromTemplate(templateId: number, userInputs: TemplateGenerationRequest): Observable<TemplateGenerationResponse> {
    return this.http.post<TemplateGenerationResponse>(
      `${this.apiUrl}/${templateId}/generate`,
      userInputs,
      { withCredentials: true }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Analyze template
  analyzeTemplate(templateId: number): Observable<TemplateAnalysis> {
    return this.http.get<TemplateAnalysis>(`${this.apiUrl}/${templateId}/analyze`, { withCredentials: true })
      .pipe(
        catchError(this.handleError)
      );
  }

  // Validate template
  validateTemplate(templateId: number): Observable<{ isValid: boolean; errors: string[] }> {
    return this.http.get<{ isValid: boolean; errors: string[] }>(
      `${this.apiUrl}/${templateId}/validate`,
      { withCredentials: true }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Export templates (returns blob for download)
  exportTemplates(templateIds: number[]): Observable<Blob> {
    return this.http.post(
      `${this.apiUrl}/export`,
      { templateIds },
      {
        responseType: 'blob',
        withCredentials: true
      }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Import templates from file
  importTemplates(file: File): Observable<{ imported: number; errors: string[] }> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<{ imported: number; errors: string[] }>(
      `${this.apiUrl}/import`,
      formData,
      { withCredentials: true }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Helper method to get practice areas
  getPracticeAreas(): string[] {
    return [
      'Immigration Law',
      'Family Law',
      'Criminal Defense',
      'Real Estate',
      'Intellectual Property',
      'Corporate Law',
      'Personal Injury',
      'Employment Law',
      'Estate Planning',
      'Tax Law'
    ];
  }

  // Helper method to get jurisdictions
  getJurisdictions(): string[] {
    return [
      'Massachusetts',
      'Federal',
      'New York',
      'Connecticut',
      'Rhode Island',
      'New Hampshire',
      'Vermont',
      'Maine'
    ];
  }

  // Error handler
  private handleError(error: any): Observable<never> {
    console.error('Template Service Error:', error);
    let errorMessage = 'An error occurred';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else if (error.status) {
      errorMessage = `Error ${error.status}: ${error.message}`;
    }

    return throwError(() => new Error(errorMessage));
  }

  // Clear cached templates
  clearCache(): void {
    this.templatesSubject.next([]);
  }
}