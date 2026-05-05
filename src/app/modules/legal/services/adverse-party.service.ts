import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Key } from 'src/app/enum/key.enum';

/**
 * Adverse parties — plaintiffs, defendants, witnesses, experts, opposing
 * counsel, etc. — attached to a legal case. Mirrors the backend
 * {@code AdversePartyDTO}; multi-tenant filtering happens server-side.
 */
export interface AdverseParty {
  id?: number;
  organizationId?: number;
  caseId?: number;
  clientId?: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  /** PLAINTIFF | DEFENDANT | WITNESS | EXPERT | OPPOSING_COUNSEL | INSURANCE_ADJUSTER | OTHER */
  partyType: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class AdversePartyService {
  private readonly baseUrl = `${environment.apiUrl}/api/cases`;

  constructor(private http: HttpClient) {}

  /** Tenant-filtered list for a case. */
  getPartiesForCase(caseId: number | string): Observable<AdverseParty[]> {
    return this.http
      .get<any>(`${this.baseUrl}/${caseId}/parties`, { headers: this.headers() })
      .pipe(map(res => (res?.data ?? []) as AdverseParty[]));
  }

  /** Create a party against the given case. Server stamps organization + case ids. */
  createParty(caseId: number | string, party: AdverseParty): Observable<AdverseParty> {
    return this.http
      .post<any>(`${this.baseUrl}/${caseId}/parties`, party, { headers: this.headers() })
      .pipe(map(res => res?.data as AdverseParty));
  }

  /** Update a party. Server verifies tenant before saving. */
  updateParty(caseId: number | string, partyId: number, party: AdverseParty): Observable<AdverseParty> {
    return this.http
      .put<any>(`${this.baseUrl}/${caseId}/parties/${partyId}`, party, { headers: this.headers() })
      .pipe(map(res => res?.data as AdverseParty));
  }

  /** Delete a party. Server verifies tenant before removing. */
  deleteParty(caseId: number | string, partyId: number): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/${caseId}/parties/${partyId}`, { headers: this.headers() });
  }

  private headers(): HttpHeaders {
    const token = localStorage.getItem(Key.TOKEN);
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
  }
}
