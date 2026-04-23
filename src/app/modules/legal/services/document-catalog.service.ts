import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { PracticeAreaCatalogResponse } from '../interfaces/document-catalog.interface';

/**
 * Sprint 5 — registry-driven doc-type catalog.
 *
 * Backend computes coverage via the 4-way cascade ({type}_{pa}_{state} → {type}_{state}
 * → {type}_{pa} → {type}) and returns a tiered list for the selected practice area.
 * The result is cached per (practiceArea, jurisdiction) for the lifetime of the wizard
 * session so bouncing back through Step 2 does not re-hit the server.
 */
@Injectable({ providedIn: 'root' })
export class DocumentCatalogService {
  private readonly endpoint = `${environment.apiUrl}/api/ai/document-types`;
  private readonly cache = new Map<string, Observable<PracticeAreaCatalogResponse>>();

  constructor(private http: HttpClient) {}

  getCatalog(practiceArea: string, jurisdiction?: string | null): Observable<PracticeAreaCatalogResponse> {
    const key = `${practiceArea}|${jurisdiction ?? ''}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    let params = new HttpParams().set('practiceArea', practiceArea);
    if (jurisdiction) params = params.set('jurisdiction', jurisdiction);

    const stream$ = this.http
      .get<PracticeAreaCatalogResponse>(this.endpoint, { params })
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));

    this.cache.set(key, stream$);
    return stream$;
  }

  /** Clear the in-memory cache — useful when the attorney creates a new template mid-session. */
  invalidate(): void {
    this.cache.clear();
  }
}
