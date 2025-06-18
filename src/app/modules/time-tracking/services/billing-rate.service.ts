import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface BillingRate {
  id?: number;
  userId: number;
  matterTypeId?: number;
  clientId?: number;
  legalCaseId?: number;
  rateType: 'STANDARD' | 'PREMIUM' | 'DISCOUNTED' | 'EMERGENCY' | 'PRO_BONO';
  rateAmount: number;
  effectiveDate: string;
  endDate?: string;
  isActive: boolean;
  userName?: string;
  userEmail?: string;
  matterTypeName?: string;
  clientName?: string;
  caseName?: string;
  caseNumber?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class BillingRateService {
  private readonly baseUrl = `${environment.apiUrl}/api/billing-rates`;
  private billingRatesSubject = new BehaviorSubject<BillingRate[]>([]);
  public billingRates$ = this.billingRatesSubject.asObservable();

  constructor(private http: HttpClient) {}

  // Create and Update
  createBillingRate(billingRate: BillingRate): Observable<BillingRate> {
    return this.http.post<any>(this.baseUrl, billingRate).pipe(
      map(response => {
        const rate = response.data;
        this.addBillingRate(rate);
        return rate;
      }),
      catchError(this.handleError)
    );
  }

  updateBillingRate(id: number, billingRate: BillingRate): Observable<BillingRate> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, billingRate).pipe(
      map(response => {
        const rate = response.data;
        this.updateBillingRateLocal(rate);
        return rate;
      }),
      catchError(this.handleError)
    );
  }

  // Retrieve
  getBillingRate(id: number): Observable<BillingRate> {
    return this.http.get<any>(`${this.baseUrl}/${id}`).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getBillingRates(page: number = 0, size: number = 10): Observable<PagedResponse<BillingRate>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<any>(this.baseUrl, { params }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getBillingRatesByUser(userId: number, page: number = 0, size: number = 10): Observable<PagedResponse<BillingRate>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<any>(`${this.baseUrl}/user/${userId}`, { params }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getActiveBillingRatesForUser(userId: number): Observable<BillingRate[]> {
    return this.http.get<any>(`${this.baseUrl}/user/${userId}/active`).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getBillingRatesByMatterType(matterTypeId: number): Observable<BillingRate[]> {
    return this.http.get<any>(`${this.baseUrl}/matter-type/${matterTypeId}`).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getBillingRatesByCustomer(clientId: number): Observable<BillingRate[]> {
    return this.http.get<any>(`${this.baseUrl}/client/${clientId}`).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getBillingRatesByCase(legalCaseId: number): Observable<BillingRate[]> {
    return this.http.get<any>(`${this.baseUrl}/case/${legalCaseId}`).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // Delete and Deactivate
  deleteBillingRate(id: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/${id}`).pipe(
      map(response => {
        this.removeBillingRate(id);
        return response.data;
      }),
      catchError(this.handleError)
    );
  }

  deactivateBillingRate(id: number, endDate?: string): Observable<any> {
    const params = endDate ? new HttpParams().set('endDate', endDate) : new HttpParams();
    return this.http.put<any>(`${this.baseUrl}/${id}/deactivate`, {}, { params }).pipe(
      map(response => {
        // Update local data
        const currentRates = this.billingRatesSubject.value;
        const updatedRates = currentRates.map(rate => 
          rate.id === id ? { ...rate, isActive: false, endDate } : rate
        );
        this.billingRatesSubject.next(updatedRates);
        return response.data;
      }),
      catchError(this.handleError)
    );
  }

  // Rate Setting Methods - High Level API
  setUserRate(userId: number, rate: number, rateType: string, effectiveDate: string): Observable<BillingRate> {
    const billingRate: BillingRate = {
      userId,
      rateAmount: rate,
      rateType: rateType as any,
      effectiveDate,
      isActive: true
    };
    return this.createBillingRate(billingRate);
  }

  setMatterRate(userId: number, matterTypeId: number, rate: number, rateType: string, effectiveDate: string): Observable<BillingRate> {
    const billingRate: BillingRate = {
      userId,
      matterTypeId,
      rateAmount: rate,
      rateType: rateType as any,
      effectiveDate,
      isActive: true
    };
    return this.createBillingRate(billingRate);
  }

  setClientRate(userId: number, clientId: number, rate: number, rateType: string, effectiveDate: string): Observable<BillingRate> {
    const billingRate: BillingRate = {
      userId,
      clientId,
      rateAmount: rate,
      rateType: rateType as any,
      effectiveDate,
      isActive: true
    };
    return this.createBillingRate(billingRate);
  }

  setCaseRate(userId: number, legalCaseId: number, rate: number, rateType: string, effectiveDate: string): Observable<BillingRate> {
    const billingRate: BillingRate = {
      userId,
      legalCaseId,
      rateAmount: rate,
      rateType: rateType as any,
      effectiveDate,
      isActive: true
    };
    return this.createBillingRate(billingRate);
  }

  // Rate Retrieval Methods - Hierarchy Resolution
  getEffectiveRate(userId: number, legalCaseId?: number, clientId?: number, matterTypeId?: number, date?: string): Observable<number> {
    let params = new HttpParams().set('userId', userId.toString());
    if (legalCaseId) params = params.set('legalCaseId', legalCaseId.toString());
    if (clientId) params = params.set('clientId', clientId.toString());
    if (matterTypeId) params = params.set('matterTypeId', matterTypeId.toString());
    if (date) params = params.set('date', date);

    return this.http.get<any>(`${this.baseUrl}/effective-rate`, { params }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getEffectiveRateForCase(userId: number, legalCaseId: number, date?: string): Observable<number> {
    let params = new HttpParams()
      .set('userId', userId.toString())
      .set('legalCaseId', legalCaseId.toString());
    if (date) params = params.set('date', date);

    return this.http.get<any>(`${this.baseUrl}/effective-rate/case`, { params }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getEffectiveRateForUser(userId: number, date?: string): Observable<number> {
    let params = new HttpParams().set('userId', userId.toString());
    if (date) params = params.set('date', date);

    return this.http.get<any>(`${this.baseUrl}/effective-rate/user`, { params }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getMostSpecificRate(userId: number, legalCaseId?: number, clientId?: number, matterTypeId?: number, date?: string): Observable<BillingRate> {
    let params = new HttpParams().set('userId', userId.toString());
    if (legalCaseId) params = params.set('legalCaseId', legalCaseId.toString());
    if (clientId) params = params.set('clientId', clientId.toString());
    if (matterTypeId) params = params.set('matterTypeId', matterTypeId.toString());
    if (date) params = params.set('date', date);

    return this.http.get<any>(`${this.baseUrl}/most-specific`, { params }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // Rate History
  getRateHistoryForUser(userId: number): Observable<BillingRate[]> {
    return this.http.get<any>(`${this.baseUrl}/user/${userId}/history`).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getEffectiveRatesForUser(userId: number, date: string): Observable<BillingRate[]> {
    const params = new HttpParams().set('date', date);
    return this.http.get<any>(`${this.baseUrl}/user/${userId}/effective-rates`, { params }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getCurrentActiveRates(): Observable<BillingRate[]> {
    return this.http.get<any>(`${this.baseUrl}/current-active`).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // Validation
  hasOverlappingRate(billingRate: BillingRate): Observable<boolean> {
    return this.http.post<any>(`${this.baseUrl}/validate/overlap`, billingRate).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  isValidRateStructure(billingRate: BillingRate): Observable<boolean> {
    return this.http.post<any>(`${this.baseUrl}/validate/structure`, billingRate).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // Rate Analytics
  getAverageRateByUser(userId: number): Observable<number> {
    return this.http.get<any>(`${this.baseUrl}/analytics/average-by-user/${userId}`).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getAverageRateByMatterType(matterTypeId: number): Observable<number> {
    return this.http.get<any>(`${this.baseUrl}/analytics/average-by-matter-type/${matterTypeId}`).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // Time Tracking Integration Analytics
  getBillingRateUsageAnalytics(userId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/analytics/usage-by-user/${userId}`).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getRatePerformanceAnalytics(rateId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/analytics/rate-performance/${rateId}`).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getTimeEntriesByBillingRate(userId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/analytics/time-entries-by-rate/${userId}`).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getRatesByType(rateType: string): Observable<BillingRate[]> {
    return this.http.get<any>(`${this.baseUrl}/type/${rateType}`).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // Rate Recommendations
  getRecommendedRateForUser(userId: number, legalCaseId?: number): Observable<number> {
    let params = new HttpParams().set('userId', userId.toString());
    if (legalCaseId) params = params.set('legalCaseId', legalCaseId.toString());

    return this.http.get<any>(`${this.baseUrl}/recommendations/user-rate`, { params }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getRateComparison(userId: number, compareToUsers?: number[]): Observable<any> {
    let params = new HttpParams().set('userId', userId.toString());
    if (compareToUsers && compareToUsers.length > 0) {
      compareToUsers.forEach(id => params = params.append('compareToUsers', id.toString()));
    }

    return this.http.get<any>(`${this.baseUrl}/analytics/rate-comparison`, { params }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // Bulk Operations
  bulkUpdateRates(updates: Array<{id: number, rateAmount: number}>): Observable<BillingRate[]> {
    return this.http.patch<any>(`${this.baseUrl}/bulk-update`, { updates }).pipe(
      map(response => {
        const rates = response.data;
        rates.forEach((rate: BillingRate) => this.updateBillingRateLocal(rate));
        return rates;
      }),
      catchError(this.handleError)
    );
  }

  // Local State Management
  refreshBillingRates(): void {
    this.getBillingRates().subscribe(
      response => this.billingRatesSubject.next(response.content)
    );
  }

  private addBillingRate(billingRate: BillingRate): void {
    const current = this.billingRatesSubject.value;
    this.billingRatesSubject.next([billingRate, ...current]);
  }

  private updateBillingRateLocal(updatedRate: BillingRate): void {
    const current = this.billingRatesSubject.value;
    const index = current.findIndex(rate => rate.id === updatedRate.id);
    if (index !== -1) {
      current[index] = updatedRate;
      this.billingRatesSubject.next([...current]);
    }
  }

  private removeBillingRate(id: number): void {
    const current = this.billingRatesSubject.value;
    this.billingRatesSubject.next(current.filter(rate => rate.id !== id));
  }

  private handleError(error: any): Observable<never> {
    console.error('BillingRateService error:', error);
    throw error;
  }
} 
 
 
 
 
 
 