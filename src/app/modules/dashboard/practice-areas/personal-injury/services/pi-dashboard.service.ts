import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

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
 * Mirrors backend `PiRiskAlertDto`. Severity comes back as a lowercase string
 * matching the existing template's `severity-{value}` class binding.
 */
export interface PiRiskAlert {
  severity: 'critical' | 'warning' | 'info' | string;
  type: string;
  title: string;
  description: string;
  /** Optional countdown for SOL-style alerts; nullable when not applicable. */
  daysRemaining: number | null;
}

/**
 * Mirrors backend `PiCrossMatterPatternDto`. Endpoint returns HTTP 200 with
 * a null body when no pattern emerges — the service preserves that shape.
 */
export interface PiCrossMatterPattern {
  title: string;
  summary: string;
  matters: PiCrossMatterPatternMatter[];
  primaryLabel: string;
  secondaryLabel: string;
}

/** Mirrors backend `PiCrossMatterPatternDto.MatterRef`. */
export interface PiCrossMatterPatternMatter {
  initials: string;
  bg: string;
  label: string;
}

/**
 * Personal Injury attorney dashboard HTTP client. Each method maps 1:1 to a
 * Phase 3 endpoint under `/api/v2/dashboard/personal-injury/*`. The endpoints
 * return raw payloads (no `.data` wrapper) — Spring serializes the records
 * directly.
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

  getRiskAlerts(): Observable<PiRiskAlert[]> {
    return this.http.get<PiRiskAlert[]>(`${this.apiUrl}/risk-alerts`);
  }

  /**
   * Returns the cross-matter pattern, or `null` when not enough cases exist
   * to form a pattern. Callers should render conditionally on truthiness.
   */
  getCrossMatterPattern(): Observable<PiCrossMatterPattern | null> {
    return this.http.get<PiCrossMatterPattern | null>(`${this.apiUrl}/cross-matter`);
  }
}
