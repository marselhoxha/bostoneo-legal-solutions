import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../../../environments/environment';

export interface AITemplateVariable {
  id: number;
  templateId: number;
  variableName: string;
  displayName: string;
  dataType: 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'LIST' | 'CASE_DATA';
  dataSource?: string;
  validationRules?: string;
  defaultValue?: string;
  isRequired: boolean;
  displayOrder: number;
  helpText?: string;
}

export interface AIStyleGuide {
  id: number;
  firmId: number;
  name: string;
  description: string;
  rules: {
    fontSize: number;
    fontFamily: string;
    margins: { top: number; bottom: number; left: number; right: number };
    lineSpacing: number;
    citationStyle: 'BLUEBOOK' | 'APA' | 'MLA' | 'CHICAGO';
    headerFooter: boolean;
    pageNumbers: boolean;
    terminology: { [key: string]: string };
  };
  isDefault: boolean;
  isActive: boolean;
  createdBy: number;
  createdAt: Date;
}

export interface TemplateCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  practiceAreas: string[];
  templateCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class AITemplateService {
  private apiUrl = `${environment.apiUrl}/api/ai/templates`;
  private styleGuideUrl = `${environment.apiUrl}/api/ai/style-guides`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // Template Categories
  getTemplateCategories(): Observable<TemplateCategory[]> {
    return this.http.get<TemplateCategory[]>(`${this.apiUrl}/categories`, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  getTemplatesByCategory(category: string, page: number = 0, size: number = 20): Observable<any> {
    return this.http.get(`${this.apiUrl}/category/${category}?page=${page}&size=${size}`, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Template Variables
  getTemplateVariables(templateId: number): Observable<AITemplateVariable[]> {
    return this.http.get<AITemplateVariable[]>(`${this.apiUrl}/${templateId}/variables`, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  validateTemplateVariables(templateId: number, variables: { [key: string]: any }): Observable<{ isValid: boolean; errors: string[] }> {
    return this.http.post<{ isValid: boolean; errors: string[] }>(
      `${this.apiUrl}/${templateId}/validate`, 
      variables, 
      { headers: this.getHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Style Guides
  getStyleGuides(firmId?: number): Observable<AIStyleGuide[]> {
    let url = this.styleGuideUrl;
    if (firmId) url += `?firmId=${firmId}`;
    
    return this.http.get<AIStyleGuide[]>(url, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  getStyleGuide(id: number): Observable<AIStyleGuide> {
    return this.http.get<AIStyleGuide>(`${this.styleGuideUrl}/${id}`, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  createStyleGuide(styleGuide: Partial<AIStyleGuide>): Observable<AIStyleGuide> {
    return this.http.post<AIStyleGuide>(this.styleGuideUrl, styleGuide, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  updateStyleGuide(id: number, styleGuide: Partial<AIStyleGuide>): Observable<AIStyleGuide> {
    return this.http.put<AIStyleGuide>(`${this.styleGuideUrl}/${id}`, styleGuide, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Template Search & Filtering
  searchTemplates(query: string, filters?: {
    category?: string;
    practiceArea?: string;
    maSpecific?: boolean;
    approved?: boolean;
  }): Observable<any> {
    let params = `?q=${encodeURIComponent(query)}`;
    
    if (filters) {
      if (filters.category) params += `&category=${filters.category}`;
      if (filters.practiceArea) params += `&practiceArea=${filters.practiceArea}`;
      if (filters.maSpecific !== undefined) params += `&maSpecific=${filters.maSpecific}`;
      if (filters.approved !== undefined) params += `&approved=${filters.approved}`;
    }
    
    return this.http.get(`${this.apiUrl}/search${params}`, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Massachusetts Specific Templates
  getMassachusettsTemplates(practiceArea?: string): Observable<any> {
    let url = `${this.apiUrl}/massachusetts`;
    if (practiceArea) url += `?practiceArea=${practiceArea}`;
    
    return this.http.get(url, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    console.error('AI Template Service Error:', error);
    return throwError(() => error);
  }
}