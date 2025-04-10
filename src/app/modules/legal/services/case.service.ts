import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { LegalCase } from '../interfaces/case.interface';
import { environment } from '../../../../environments/environment';

// Define the API response type
interface ApiResponse<T> {
  timeStamp: string;
  statusCode: number;
  status: string;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class CaseService {
  private apiUrl = `${environment.apiUrl}/legal-case`;

  constructor(private http: HttpClient) { }

  // Helper method to get auth headers
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  getCases(): Observable<any> {
    return this.http.get<ApiResponse<{ page: { content: LegalCase[] } }>>(
      `${this.apiUrl}/list`,
      { headers: this.getAuthHeaders() }
    );
  }

  getCaseById(id: string): Observable<any> {
    return this.http.get<ApiResponse<{ case: LegalCase }>>(
      `${this.apiUrl}/get/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }

  createCase(caseData: Partial<LegalCase>): Observable<any> {
    return this.http.post<ApiResponse<{ case: LegalCase }>>(
      `${this.apiUrl}/create`,
      caseData,
      { headers: this.getAuthHeaders() }
    );
  }

  updateCase(id: string, caseData: Partial<LegalCase>): Observable<any> {
    return this.http.put<ApiResponse<{ case: LegalCase }>>(
      `${this.apiUrl}/update/${id}`,
      caseData,
      { headers: this.getAuthHeaders() }
    );
  }

  deleteCase(id: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/delete/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }
} 