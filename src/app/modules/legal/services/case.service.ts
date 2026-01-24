import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { LegalCase } from '../interfaces/case.interface';
import { environment } from '../../../../environments/environment';
import { Key } from '../../../enum/key.enum';

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

  // Get token with fallback options
  private getToken(): string | null {
    // Try multiple possible token keys to handle inconsistencies
    let token = localStorage.getItem(Key.TOKEN);
    
    if (!token) {
      token = localStorage.getItem('auth_token'); // AuthService pattern
    }
    if (!token) {
      token = sessionStorage.getItem(Key.TOKEN); // Check session storage
    }
    
    return token;
  }

  // Helper method to get auth headers
  private getAuthHeaders(): HttpHeaders {
    const token = this.getToken();

    if (!token) {
      console.error('No authentication token found! User might not be logged in.');
    }

    // Create headers and force materialization to avoid lazy initialization issues
    let headers = new HttpHeaders();
    headers = headers.set('Content-Type', 'application/json');

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  getCases(page: number = 0, size: number = 10): Observable<any> {
    return this.http.get<ApiResponse<{ cases: LegalCase[] }>>(
      `${this.apiUrl}/list?page=${page}&size=${size}`,
      { headers: this.getAuthHeaders() }
    );
  }

  searchCases(query: string, page: number = 0, size: number = 20): Observable<any> {
    return this.http.get<ApiResponse<{ page: any }>>(
      `${this.apiUrl}/search?q=${encodeURIComponent(query)}&page=${page}&size=${size}`,
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