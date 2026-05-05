import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Key } from 'src/app/enum/key.enum';

/**
 * The four provenance sources the backend tags fields with. String values
 * mirror the {@code ProvenanceSource} Java enum names so JSON round-trip is
 * trivial.
 */
export type ProvenanceSource = 'INTAKE_FORM' | 'CLIENT_PORTAL' | 'AI_EXTRACTED' | 'MANUAL';

/**
 * Per-field provenance map: { fieldPath -> source }. Object literal rather
 * than {@link Map} so it serializes naturally over JSON.
 */
export type ProvenanceMap = { [fieldPath: string]: ProvenanceSource };

/**
 * Reads field-provenance for a case from
 * {@code GET /legal-case/{id}/provenance}. Used once per case-detail page
 * load; the parent component (pi-case-detail) caches the resulting map and
 * passes it to every {@code <app-provenance-marker>} via input binding.
 *
 * <p>No write API here — provenance is stamped server-side by intake / AI /
 * manual write paths via {@code ProvenanceService.setProvenance()}.
 */
@Injectable({ providedIn: 'root' })
export class ProvenanceService {
  private readonly baseUrl = `${environment.apiUrl}/legal-case`;

  constructor(private http: HttpClient) {}

  /**
   * Fetches the per-field provenance map for a case. Empty object is the
   * normal cold-start state; callers should treat missing keys as "no source
   * known" and render a neutral dot, not an error.
   */
  getProvenance(caseId: number | string): Observable<ProvenanceMap> {
    return this.http
      .get<any>(`${this.baseUrl}/${caseId}/provenance`, { headers: this.authHeaders() })
      .pipe(map(res => (res?.data?.provenance ?? {}) as ProvenanceMap));
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem(Key.TOKEN);
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
  }
}
