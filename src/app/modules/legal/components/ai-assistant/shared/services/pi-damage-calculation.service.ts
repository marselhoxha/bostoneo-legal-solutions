import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../../../../environments/environment';
import { PIDamageElement, PIDamageCalculation } from '../models/pi-damage-calculation.model';

@Injectable({
  providedIn: 'root'
})
export class PIDamageCalculationService {
  private baseUrl = `${environment.apiUrl}/api/pi/cases`;

  constructor(private http: HttpClient) {}

  // ===== Damage Elements =====

  /**
   * Get all damage elements for a case
   */
  getDamageElements(caseId: number): Observable<PIDamageElement[]> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/damages/elements`).pipe(
      map(response => response.data?.elements || [])
    );
  }

  /**
   * Get a specific damage element
   */
  getDamageElementById(caseId: number, elementId: number): Observable<PIDamageElement> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/damages/elements/${elementId}`).pipe(
      map(response => response.data?.element)
    );
  }

  /**
   * Create a new damage element
   */
  createDamageElement(caseId: number, element: PIDamageElement): Observable<PIDamageElement> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}/damages/elements`, element).pipe(
      map(response => response.data?.element)
    );
  }

  /**
   * Update a damage element
   */
  updateDamageElement(caseId: number, elementId: number, element: PIDamageElement): Observable<PIDamageElement> {
    return this.http.put<any>(`${this.baseUrl}/${caseId}/damages/elements/${elementId}`, element).pipe(
      map(response => response.data?.element)
    );
  }

  /**
   * Delete a damage element
   */
  deleteDamageElement(caseId: number, elementId: number): Observable<void> {
    return this.http.delete<any>(`${this.baseUrl}/${caseId}/damages/elements/${elementId}`).pipe(
      map(() => undefined)
    );
  }

  /**
   * Get elements by type
   */
  getElementsByType(caseId: number, elementType: string): Observable<PIDamageElement[]> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/damages/elements/by-type/${elementType}`).pipe(
      map(response => response.data?.elements || [])
    );
  }

  /**
   * Reorder damage elements
   */
  reorderElements(caseId: number, elementIds: number[]): Observable<void> {
    return this.http.put<any>(`${this.baseUrl}/${caseId}/damages/elements/reorder`, elementIds).pipe(
      map(() => undefined)
    );
  }

  // ===== Damage Calculation Summary =====

  /**
   * Get damage calculation summary
   */
  getDamageCalculation(caseId: number): Observable<PIDamageCalculation | null> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/damages/calculation`).pipe(
      map(response => response.data?.calculation)
    );
  }

  /**
   * Calculate damages
   */
  calculateDamages(caseId: number): Observable<PIDamageCalculation> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}/damages/calculate`, {}).pipe(
      map(response => response.data?.calculation)
    );
  }

  /**
   * Calculate damages with AI comparable analysis
   */
  calculateDamagesWithAI(caseId: number, caseContext?: any): Observable<PIDamageCalculation> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}/damages/calculate-with-ai`, caseContext || {}).pipe(
      map(response => response.data?.calculation)
    );
  }

  /**
   * Get summary by damage type
   */
  getSummaryByType(caseId: number): Observable<{ [key: string]: number }> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/damages/summary-by-type`).pipe(
      map(response => response.data?.summary || {})
    );
  }

  /**
   * Get economic vs non-economic breakdown
   */
  getEconomicBreakdown(caseId: number): Observable<{ economic: number; nonEconomic: number; total: number }> {
    return this.http.get<any>(`${this.baseUrl}/${caseId}/damages/economic-breakdown`).pipe(
      map(response => response.data?.breakdown)
    );
  }

  /**
   * Sync medical expenses from medical records
   */
  syncMedicalExpenses(caseId: number): Observable<PIDamageElement> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}/damages/sync-medical`, {}).pipe(
      map(response => response.data?.element)
    );
  }

  /**
   * Get AI comparable analysis
   */
  getComparableAnalysis(caseId: number, injuryType: string, jurisdiction: string = 'Massachusetts'): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}/damages/comparable-analysis`, {
      injuryType,
      jurisdiction
    }).pipe(
      map(response => response.data?.analysis)
    );
  }

  /**
   * Save settlement analysis from case value calculation
   */
  saveSettlementAnalysis(caseId: number, settlementAnalysis: any): Observable<PIDamageCalculation> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}/damages/settlement-analysis`, settlementAnalysis).pipe(
      map(response => response.data?.calculation)
    );
  }

  // ===== Quick Damage Calculators =====

  /**
   * Calculate household services damages
   */
  calculateHouseholdServices(caseId: number, monthlyRate: number, months: number, notes?: string): Observable<PIDamageElement> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}/damages/calculate/household-services`, {
      monthlyRate,
      months,
      notes
    }).pipe(
      map(response => response.data?.element)
    );
  }

  /**
   * Calculate mileage damages
   */
  calculateMileage(caseId: number, miles: number, ratePerMile?: number, notes?: string): Observable<PIDamageElement> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}/damages/calculate/mileage`, {
      miles,
      ratePerMile,
      notes
    }).pipe(
      map(response => response.data?.element)
    );
  }

  /**
   * Calculate lost wages
   */
  calculateLostWages(caseId: number, hourlyRate: number, hoursLost: number, employerName?: string, notes?: string): Observable<PIDamageElement> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}/damages/calculate/lost-wages`, {
      hourlyRate,
      hoursLost,
      employerName,
      notes
    }).pipe(
      map(response => response.data?.element)
    );
  }

  /**
   * Calculate pain and suffering
   */
  calculatePainSuffering(
    caseId: number,
    method: 'MULTIPLIER' | 'PER_DIEM',
    economicBase: number,
    multiplierOrPerDiem: number,
    durationDays?: number,
    notes?: string
  ): Observable<PIDamageElement> {
    return this.http.post<any>(`${this.baseUrl}/${caseId}/damages/calculate/pain-suffering`, {
      method,
      economicBase,
      multiplierOrPerDiem,
      durationDays,
      notes
    }).pipe(
      map(response => response.data?.element)
    );
  }
}
