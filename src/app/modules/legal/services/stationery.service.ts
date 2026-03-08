import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '@environments/environment';

export interface StationeryRenderResponse {
  letterheadHtml: string;
  signatureBlockHtml: string;
  footerHtml: string;
}

export interface AttorneyInfo {
  id: number;
  firstName: string;
  lastName: string;
  barNumber: string;
  licenseState: string;
}

export interface StationeryTemplate {
  id?: number;
  name: string;
  description?: string;
  letterheadTemplate?: string;
  signatureBlocks?: string;
  footerTemplate?: string;
  formattingPreferences?: string;
  isDefault?: boolean;
}

@Injectable({ providedIn: 'root' })
export class StationeryService {

  private readonly apiUrl = `${environment.apiUrl}/api/legal/stationery`;

  constructor(private http: HttpClient) {}

  getTemplates(): Observable<StationeryTemplate[]> {
    return this.http.get<StationeryTemplate[]>(`${this.apiUrl}/templates`);
  }

  getTemplate(id: number): Observable<StationeryTemplate> {
    return this.http.get<StationeryTemplate>(`${this.apiUrl}/templates/${id}`);
  }

  createTemplate(template: StationeryTemplate): Observable<StationeryTemplate> {
    return this.http.post<StationeryTemplate>(`${this.apiUrl}/templates`, template);
  }

  updateTemplate(id: number, template: StationeryTemplate): Observable<StationeryTemplate> {
    return this.http.put<StationeryTemplate>(`${this.apiUrl}/templates/${id}`, template);
  }

  deleteTemplate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/templates/${id}`);
  }

  renderStationery(templateId: number, attorneyId: number): Observable<StationeryRenderResponse> {
    return this.http.post<StationeryRenderResponse>(`${this.apiUrl}/render`, { templateId, attorneyId });
  }

  getAttorneys(): Observable<AttorneyInfo[]> {
    return this.http.get<AttorneyInfo[]>(`${this.apiUrl}/attorneys`);
  }

  getMyAttorneyProfile(): Observable<AttorneyInfo | null> {
    return this.http.get<AttorneyInfo>(`${this.apiUrl}/my-attorney`).pipe(
      catchError((err) => {
        console.warn('Failed to load attorney profile:', err?.status || err);
        return of(null);
      })
    );
  }
}
