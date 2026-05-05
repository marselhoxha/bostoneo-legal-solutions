import { Injectable } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd, ActivatedRouteSnapshot } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { filter, switchMap, catchError, distinctUntilChanged } from 'rxjs/operators';
import { LegalCaseService } from '../../modules/legal/services/legal-case.service';
import { LegalCase } from '../../modules/legal/interfaces/case.interface';

export interface ActiveCaseContext {
  id: number;
  displayName: string;
  caseNumber: string;
}

/**
 * Watches the router for navigation events and exposes the currently-active
 * case (if any) via `activeCase$`. Used by the topbar to render the active
 * case pill on case-related routes. Caches lookups in-memory so repeated
 * navigation between sub-pages of the same case (medical chronology,
 * demands, settlements, etc.) doesn't re-fetch.
 */
@Injectable({ providedIn: 'root' })
export class ActiveCaseContextService {
  private readonly subject = new BehaviorSubject<ActiveCaseContext | null>(null);
  readonly activeCase$: Observable<ActiveCaseContext | null> = this.subject.asObservable();
  private readonly cache = new Map<number, ActiveCaseContext>();

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly caseService: LegalCaseService,
  ) {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      switchMap(() => {
        const caseId = this.findCaseIdInRoute(this.route.snapshot);
        if (caseId == null) return of(null);
        if (this.cache.has(caseId)) return of(this.cache.get(caseId)!);
        return this.caseService.getCaseById(String(caseId)).pipe(
          switchMap((c: LegalCase) => {
            const ctx: ActiveCaseContext = {
              id: caseId,
              displayName: c.title || c.clientName || `Case #${caseId}`,
              caseNumber: c.caseNumber || String(caseId),
            };
            this.cache.set(caseId, ctx);
            return of(ctx);
          }),
          catchError(() => of(null))
        );
      }),
      distinctUntilChanged((a, b) => a?.id === b?.id),
    ).subscribe(ctx => this.subject.next(ctx));
  }

  /**
   * Walk the route tree starting from the snapshot, returning the first
   * `caseId` param found at any depth. Falls back to `id` only when the
   * URL path includes "cases" or "case" — otherwise the `id` of an
   * unrelated entity (user, document) would falsely activate the pill.
   */
  private findCaseIdInRoute(snapshot: ActivatedRouteSnapshot): number | null {
    let current: ActivatedRouteSnapshot | null = snapshot;
    while (current) {
      if (current.params['caseId']) {
        const id = Number(current.params['caseId']);
        return Number.isFinite(id) ? id : null;
      }
      const segments = current.url.map(u => u.path.toLowerCase());
      if (current.params['id'] && (segments.includes('cases') || segments.includes('case'))) {
        const id = Number(current.params['id']);
        return Number.isFinite(id) ? id : null;
      }
      current = current.firstChild;
    }
    return null;
  }
}
