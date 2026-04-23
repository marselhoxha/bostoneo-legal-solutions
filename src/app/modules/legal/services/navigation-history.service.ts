import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

/**
 * Tracks the last URL the user visited that is inside the legal module but
 * outside the AI workspace. Used by the draft-dashboard's linked-case chip so
 * clicking it returns the attorney to the case-context page they came from
 * (case detail, cases list, calendar, etc.) instead of dumping them on the
 * app-wide dashboard.
 *
 * Only `/legal/...` URLs are recorded — the chip's purpose is to return the
 * user to the case workflow, and `/home` / settings / CRM pages are not
 * meaningful destinations for a linked case. When no legal URL has been
 * visited this session, callers fall back to the case-detail page.
 *
 * Eagerly instantiated by AppComponent so it subscribes to router events at
 * app bootstrap — this is the only way to capture navigations that happen
 * before the AI workspace component mounts.
 */
@Injectable({ providedIn: 'root' })
export class NavigationHistoryService {
  private _lastNonWorkspaceUrl: string | null = null;

  constructor(private router: Router) {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => {
        const url = e.urlAfterRedirects || e.url;
        if (url && url.startsWith('/legal/') && !url.includes('/ai-assistant')) {
          this._lastNonWorkspaceUrl = url;
        }
      });
  }

  get lastNonWorkspaceUrl(): string | null {
    return this._lastNonWorkspaceUrl;
  }
}
