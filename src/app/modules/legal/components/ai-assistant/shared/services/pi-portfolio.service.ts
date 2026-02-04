import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../../../../environments/environment';
import { LegalCase } from '../../../../interfaces/case.interface';

/**
 * Portfolio statistics for PI cases
 */
export interface PIPortfolioStats {
  totalCases: number;
  activeCases: number;
  pendingCases: number;
  settledCases: number;
  closedCases: number;
  totalPortfolioValue: number;
  avgCaseValue: number;
  totalMedicalExpenses: number;
  totalSettlementOffers: number;
  casesInSettlement: number;
  casesWithDemandPending: number;
  avgSettlementGap: number;
  casesByStatus: { [key: string]: number };
  valueByStatus: { [key: string]: number };
}

/**
 * Paginated response for PI cases
 */
export interface PIPortfolioCasesResponse {
  content: LegalCase[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

@Injectable({
  providedIn: 'root'
})
export class PIPortfolioService {
  private baseUrl = `${environment.apiUrl}/api/pi/portfolio`;

  constructor(private http: HttpClient) {}

  /**
   * Get aggregate portfolio statistics for all PI cases
   */
  getPortfolioStats(): Observable<PIPortfolioStats> {
    return this.http.get<any>(`${this.baseUrl}/stats`).pipe(
      map(response => response.data?.stats || this.getEmptyStats())
    );
  }

  /**
   * Get paginated list of PI cases
   */
  getPICases(page: number = 0, size: number = 20, sortBy: string = 'createdAt', sortDir: string = 'desc'): Observable<PIPortfolioCasesResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('sortDir', sortDir);

    return this.http.get<any>(`${this.baseUrl}/cases`, { params }).pipe(
      map(response => {
        const cases = response.data?.cases;
        return {
          content: cases?.content || [],
          totalElements: cases?.totalElements || 0,
          totalPages: cases?.totalPages || 0,
          number: cases?.number || 0,
          size: cases?.size || size
        };
      })
    );
  }

  /**
   * Search PI cases by term
   */
  searchPICases(term: string, page: number = 0, size: number = 20): Observable<PIPortfolioCasesResponse> {
    const params = new HttpParams()
      .set('term', term)
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<any>(`${this.baseUrl}/cases/search`, { params }).pipe(
      map(response => {
        const cases = response.data?.cases;
        return {
          content: cases?.content || [],
          totalElements: cases?.totalElements || 0,
          totalPages: cases?.totalPages || 0,
          number: cases?.number || 0,
          size: cases?.size || size
        };
      })
    );
  }

  /**
   * Get PI cases filtered by status
   */
  getPICasesByStatus(status: string, page: number = 0, size: number = 20): Observable<PIPortfolioCasesResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<any>(`${this.baseUrl}/cases/status/${status}`, { params }).pipe(
      map(response => {
        const cases = response.data?.cases;
        return {
          content: cases?.content || [],
          totalElements: cases?.totalElements || 0,
          totalPages: cases?.totalPages || 0,
          number: cases?.number || 0,
          size: cases?.size || size
        };
      })
    );
  }

  /**
   * Get empty stats object for initial state
   */
  private getEmptyStats(): PIPortfolioStats {
    return {
      totalCases: 0,
      activeCases: 0,
      pendingCases: 0,
      settledCases: 0,
      closedCases: 0,
      totalPortfolioValue: 0,
      avgCaseValue: 0,
      totalMedicalExpenses: 0,
      totalSettlementOffers: 0,
      casesInSettlement: 0,
      casesWithDemandPending: 0,
      avgSettlementGap: 0,
      casesByStatus: {},
      valueByStatus: {}
    };
  }
}
