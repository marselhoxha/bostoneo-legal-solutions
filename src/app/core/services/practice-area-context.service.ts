import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * PracticeAreaContextService
 *
 * Singleton (root-provided) state container for the attorney's active
 * practice-area selection. Shared by the topbar practice-area switcher
 * pill and the attorney-dashboard outlet so both stay in sync regardless
 * of which one fires the change.
 *
 * State model:
 *   - practiceAreas$: the attorney's visible practice areas. This is the
 *     intersection of the user's own attorneyPracticeAreas CSV and the
 *     organization's enabledPracticeAreas CSV. If the org has no enabled
 *     set, fall back to the attorney's own list. If neither is present,
 *     the result is an empty array (the topbar switcher will hide itself
 *     and the dashboard outlet row hides too).
 *   - activeTab$: the currently selected practice area, or null when the
 *     attorney has none.
 *
 * Persistence:
 *   - Last-active selection is mirrored to localStorage under
 *     `attorneyDashboard.lastActiveTab` so it survives page reloads.
 *     If the persisted value is no longer in the visible set (e.g. an
 *     org disabled that practice area), the service falls back to the
 *     first entry by alphabetical order.
 */
@Injectable({ providedIn: 'root' })
export class PracticeAreaContextService {

  private static readonly LAST_TAB_STORAGE_KEY = 'attorneyDashboard.lastActiveTab';

  private readonly practiceAreasSubject = new BehaviorSubject<string[]>([]);
  private readonly activeTabSubject = new BehaviorSubject<string | null>(null);

  /** The attorney's visible practice areas (intersection of attorney + org). */
  readonly practiceAreas$: Observable<string[]> = this.practiceAreasSubject.asObservable();

  /** The currently selected practice area, or null when the attorney has none. */
  readonly activeTab$: Observable<string | null> = this.activeTabSubject.asObservable();

  /**
   * Recompute the attorney's visible practice areas from raw CSV inputs and
   * pick an initial active tab. Restores the last-active selection from
   * localStorage when still valid; otherwise falls back to alphabetically
   * first.
   *
   * Idempotent: callers can invoke this every time the user profile updates
   * — only emits when the new set differs from the current.
   */
  setPracticeAreas(
    attorneyCsv: string | null | undefined,
    orgEnabledCsv: string | null | undefined
  ): void {
    const attorneyAreas = this.parseCsv(attorneyCsv);
    const orgEnabled = this.parseCsv(orgEnabledCsv);
    const next = orgEnabled.length === 0
      ? attorneyAreas
      : attorneyAreas.filter(area => orgEnabled.includes(area));

    const prev = this.practiceAreasSubject.value;
    if (this.arraysEqual(prev, next)) {
      // Still re-validate the active tab in case it lives outside the set.
      const stillValid = this.activeTabSubject.value !== null
        && next.includes(this.activeTabSubject.value);
      if (!stillValid) {
        this.activeTabSubject.next(this.computeInitialTab(next));
      }
      return;
    }

    this.practiceAreasSubject.next(next);
    this.activeTabSubject.next(this.computeInitialTab(next));
  }

  /**
   * Update the active practice area. Persists to localStorage so the choice
   * survives page reloads. No-op when `tab` is not in the current visible
   * set — protects against stale callers passing a removed practice area.
   */
  setActiveTab(tab: string): void {
    const visible = this.practiceAreasSubject.value;
    if (!visible.includes(tab)) return;
    this.activeTabSubject.next(tab);
    try {
      localStorage.setItem(PracticeAreaContextService.LAST_TAB_STORAGE_KEY, tab);
    } catch {
      // localStorage may be unavailable (e.g. private mode quotas) — fail silently.
    }
  }

  private parseCsv(csv: string | null | undefined): string[] {
    return (csv ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  private computeInitialTab(areas: string[]): string | null {
    if (areas.length === 0) return null;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(PracticeAreaContextService.LAST_TAB_STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored && areas.includes(stored)) return stored;
    return [...areas].sort()[0];
  }

  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
}
