import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LegalCase } from '../interfaces/case.interface';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CaseService {
  private apiUrl = `${environment.apiUrl}/legal/cases`;

  constructor(private http: HttpClient) { }

  getCases(): Observable<LegalCase[]> {
    return this.http.get<LegalCase[]>(this.apiUrl);
  }

  getCaseById(id: string): Observable<LegalCase> {
    return this.http.get<LegalCase>(`${this.apiUrl}/${id}`);
  }

  createCase(caseData: Partial<LegalCase>): Observable<LegalCase> {
    return this.http.post<LegalCase>(this.apiUrl, caseData);
  }

  updateCase(id: string, caseData: Partial<LegalCase>): Observable<LegalCase> {
    return this.http.put<LegalCase>(`${this.apiUrl}/${id}`, caseData);
  }

  deleteCase(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
} 