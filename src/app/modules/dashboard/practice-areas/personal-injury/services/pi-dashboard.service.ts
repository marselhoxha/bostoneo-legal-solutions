import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../../environments/environment';

/**
 * Mirrors backend `PiInsightDto`. Field names match the JSON 1:1 — Spring
 * serializes the Java record straight through.
 */
export interface PiInsight {
  category: string;
  categoryLabel: string;
  iconClass: string;
  accentColor: 'orange' | 'green' | 'violet' | 'blue';
  matter: string;
  description: string;
  actionLabel: string;
  /** Nullable on the wire — Long boxed in Java, so Jackson emits `null` rather than omitting. */
  caseId: number | null;
}

/**
 * Personal Injury attorney dashboard HTTP client. Maps to the
 * `/api/v2/dashboard/personal-injury/insights` endpoint. The endpoint
 * returns the raw payload (no `.data` wrapper) — Spring serializes the
 * record directly.
 */
@Injectable({
  providedIn: 'root',
})
export class PiDashboardService {
  private readonly apiUrl = `${environment.apiUrl}/api/v2/dashboard/personal-injury`;

  constructor(private http: HttpClient) {}

  getInsights(): Observable<PiInsight[]> {
    return this.http.get<PiInsight[]>(`${this.apiUrl}/insights`);
  }
}
