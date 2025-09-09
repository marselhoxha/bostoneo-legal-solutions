import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface IntakeForm {
  id: number;
  name: string;
  description: string;
  formType: string;
  status: string;
  isPublic: boolean;
  publicUrl: string;
  formConfig: any;
  successMessage: string;
  redirectUrl: string;
  practiceArea: string;
  submissionCount: number;
  conversionRate: number;
  createdAt: Date;
  publishedAt: Date;
}

export interface SubmissionResponse {
  success: boolean;
  message: string;
  submissionId: number;
  redirectUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class IntakeFormService {
  private apiUrl = `${environment.apiUrl}/api/public/intake-forms`;

  constructor(private http: HttpClient) {}

  // Get all public forms
  getPublicForms(): Observable<IntakeForm[]> {
    return this.http.get<IntakeForm[]>(this.apiUrl);
  }

  // Get forms by practice area
  getFormsByPracticeArea(practiceArea: string): Observable<IntakeForm[]> {
    return this.http.get<IntakeForm[]>(`${this.apiUrl}/practice-area/${practiceArea}`);
  }

  // Get form by ID
  getFormById(id: number): Observable<IntakeForm> {
    return this.http.get<IntakeForm>(`${this.apiUrl}/${id}`);
  }

  // Get form by public URL
  getFormByUrl(publicUrl: string): Observable<IntakeForm> {
    return this.http.get<IntakeForm>(`${this.apiUrl}/url/${publicUrl}`);
  }

  // Submit form by ID
  submitForm(formId: number, submissionData: any): Observable<SubmissionResponse> {
    return this.http.post<SubmissionResponse>(`${this.apiUrl}/${formId}/submit`, submissionData);
  }

  // Submit form by URL
  submitFormByUrl(publicUrl: string, submissionData: any): Observable<SubmissionResponse> {
    return this.http.post<SubmissionResponse>(`${this.apiUrl}/url/${publicUrl}/submit`, submissionData);
  }

  // Get available practice areas
  getPracticeAreas(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/practice-areas`);
  }

  // Submit general intake form
  submitIntakeForm(submissionData: any): Observable<SubmissionResponse> {
    return this.http.post<SubmissionResponse>(`${this.apiUrl}/submit-general`, submissionData);
  }
}