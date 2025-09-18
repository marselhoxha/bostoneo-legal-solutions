import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AiAssistantService {

  private apiUrl = `${environment.apiUrl}/api/ai`;

  constructor(private http: HttpClient) { }

  analyzeDocument(content: string, documentType: string = 'legal document', analysisType: string = 'summary'): Observable<any> {
    return this.http.post(`${this.apiUrl}/analyze-document`, {
      content,
      documentType,
      analysisType
    });
  }

  quickSummary(content: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/quick-summary`, { content });
  }

  extractKeyTerms(content: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/extract-terms`, { content });
  }

  riskAssessment(content: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/risk-assessment`, { content });
  }

  predictCaseOutcome(caseDetails: string, jurisdiction: string = 'General'): Observable<any> {
    return this.http.post(`${this.apiUrl}/predict-case-outcome`, {
      caseDetails,
      jurisdiction
    });
  }

  analyzeContract(contractText: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/analyze-contract`, { contractText });
  }

  quickRiskScan(contractText: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/quick-risk-scan`, { contractText });
  }

  extractContractTerms(contractText: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/extract-contract-terms`, { contractText });
  }

  searchCaseLaw(query: string, jurisdiction: string = 'Federal'): Observable<any> {
    return this.http.post(`${this.apiUrl}/search-case-law`, { query, jurisdiction });
  }

  interpretStatute(statuteText: string, jurisdiction: string = 'Federal'): Observable<any> {
    return this.http.post(`${this.apiUrl}/interpret-statute`, { statuteText, jurisdiction });
  }

  findPrecedents(caseDescription: string, practiceArea: string = 'General'): Observable<any> {
    return this.http.post(`${this.apiUrl}/find-precedents`, { caseDescription, practiceArea });
  }

  draftLegalMemo(topic: string, jurisdiction: string = 'Federal', keyFacts: string = ''): Observable<any> {
    return this.http.post(`${this.apiUrl}/legal-memo`, { topic, jurisdiction, keyFacts });
  }

  checkHealth(): Observable<any> {
    return this.http.get(`${this.apiUrl}/health`);
  }
}