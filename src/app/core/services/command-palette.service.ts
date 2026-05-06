import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
// `fuzzy-search` is a zero-dep client-side fuzzy matcher already pinned in package.json.
// Configured with caseSensitive:false + sort:true so consumers get stable scored ranking.
// @ts-ignore — no @types entry; the runtime export is a constructor with `.search(q)`.
import FuzzySearch from 'fuzzy-search';

import { LegalCaseService } from 'src/app/modules/legal/services/legal-case.service';
import { ClientService } from 'src/app/service/client.service';

/**
 * One row in the palette. The fields map directly to the result-row template:
 * `icon` is a Lucide name, `label` is the bolded primary text, `sublabel` the
 * dimmed secondary text under it.
 */
export interface CommandPaletteResult {
  type: 'case' | 'client' | 'page' | 'recent';
  label: string;
  sublabel?: string;
  route: string;
  queryParams?: Record<string, any>;
  icon: string; // Lucide icon name
}

/** Section header + its rows, used by the template's *ngFor on `groupedResults`. */
export interface CommandPaletteGroup {
  key: string;       // 'recent' | 'cases' | 'clients' | 'pages'
  label: string;     // displayed section header
  results: CommandPaletteResult[];
  startIndex: number; // running index into the flat result list — drives keyboard selection
}

@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  // Public state. The component subscribes to `isOpen$` for *ngIf, and reads
  // `groupedResults` synchronously every keystroke (search is local + cheap).
  private readonly isOpenSubject = new BehaviorSubject<boolean>(false);
  readonly isOpen$: Observable<boolean> = this.isOpenSubject.asObservable();

  // Cached datasets — loaded once on first `open()`, kept for the session.
  // The palette is supposed to feel instant; round-tripping the API on every
  // keystroke would defeat the point.
  private cases: any[] = [];
  private clients: any[] = [];
  private dataLoaded = false;
  private dataLoading = false;

  // Recently activated rows. Persisted across reloads so power users see their
  // last few destinations on an empty palette open.
  private readonly RECENTS_KEY = 'legience.commandPalette.recents';
  private readonly MAX_RECENTS = 10;

  // Hardcoded route map. These are the "jump anywhere" destinations the topbar
  // navigates to. Keeping them inline (rather than parsing routes config)
  // gives us human-friendly labels + curated icons.
  private readonly pages: CommandPaletteResult[] = [
    { type: 'page', label: 'Dashboard',                sublabel: 'Home',                  route: '/home',                            icon: 'home' },
    { type: 'page', label: 'Cases',                    sublabel: 'All cases',             route: '/legal/cases',                     icon: 'briefcase' },
    { type: 'page', label: 'Calendar',                 sublabel: 'Schedule + deadlines',  route: '/legal/calendar',                  icon: 'calendar' },
    { type: 'page', label: 'Tasks',                    sublabel: 'Case task board',       route: '/case-management/tasks',           icon: 'check-square' },
    { type: 'page', label: 'Clients',                  sublabel: 'All clients',           route: '/clients',                         icon: 'users' },
    { type: 'page', label: 'Billing Dashboard',        sublabel: 'Revenue + invoices',    route: '/billing-dashboard',               icon: 'dollar-sign' },
    { type: 'page', label: 'Invoices',                 sublabel: 'All invoices',          route: '/invoices',                        icon: 'file-text' },
    { type: 'page', label: 'Expenses',                 sublabel: 'All expenses',          route: '/expenses',                        icon: 'credit-card' },
    { type: 'page', label: 'Time Tracking',            sublabel: 'Hours + timesheets',    route: '/time-tracking/dashboard',         icon: 'clock' },
    { type: 'page', label: 'Time Entry',               sublabel: 'Log time',              route: '/time-tracking/entry',             icon: 'edit' },
    { type: 'page', label: 'Time Approval',            sublabel: 'Pending approvals',     route: '/time-tracking/approval',          icon: 'check-circle' },
    { type: 'page', label: 'Billing Rates',            sublabel: 'Rate management',       route: '/time-tracking/rates',             icon: 'tag' },
    { type: 'page', label: 'CRM Dashboard',            sublabel: 'Pipeline + leads',      route: '/crm/dashboard',                   icon: 'pie-chart' },
    { type: 'page', label: 'Leads',                    sublabel: 'Lead pipeline',         route: '/crm/leads',                       icon: 'user-plus' },
    { type: 'page', label: 'Intake Submissions',       sublabel: 'Pending intake review', route: '/crm/intake-submissions',          icon: 'inbox' },
    { type: 'page', label: 'E-Signatures',             sublabel: 'Send + track docs',     route: '/signatures',                      icon: 'edit-3' },
    { type: 'page', label: 'LegiSpace',                sublabel: 'AI workspace',          route: '/legal/ai-assistant/legispace',    icon: 'zap' },
    { type: 'page', label: 'LegiPI',                   sublabel: 'Personal injury AI',    route: '/legal/ai-assistant/legipi',       icon: 'shield' },
    { type: 'page', label: 'Templates',                sublabel: 'Document library',      route: '/legal/ai-assistant/templates',    icon: 'file' },
    { type: 'page', label: 'Messages',                 sublabel: 'Client messaging',      route: '/messages',                        icon: 'message-square' },
    { type: 'page', label: 'Profile Settings',         sublabel: 'Personal profile',      route: '/settings/profile',                icon: 'user' },
    { type: 'page', label: 'Organization Settings',    sublabel: 'Firm settings',         route: '/settings/organization',           icon: 'building' },
  ];

  constructor(
    private legalCaseService: LegalCaseService,
    private clientService: ClientService,
    private router: Router,
  ) {}

  // ── Open / close ────────────────────────────────────────────────────
  open(): void {
    if (!this.dataLoaded && !this.dataLoading) this.loadData();
    this.isOpenSubject.next(true);
  }

  close(): void {
    this.isOpenSubject.next(false);
  }

  toggle(): void {
    this.isOpenSubject.value ? this.close() : this.open();
  }

  isOpen(): boolean {
    return this.isOpenSubject.value;
  }

  // ── Data loading ────────────────────────────────────────────────────
  // Best-effort: failures are swallowed silently. The palette still works
  // (just with fewer rows) — better than blocking on slow API calls.
  private loadData(): void {
    this.dataLoading = true;

    this.legalCaseService.getAllCases(0, 500).subscribe({
      next: (res: any) => {
        // The API wraps differently across versions of the legal-case service.
        // Probe the common shapes; any of them is fine.
        this.cases = res?.data?.cases || res?.data?.content || res?.content || res?.cases || [];
      },
      error: () => { /* leave cases empty */ },
    });

    this.clientService.allClients$().subscribe({
      next: (res: any) => {
        this.clients = res?.data?.page?.content || res?.data?.clients || res?.clients || [];
      },
      error: () => { /* leave clients empty */ },
      complete: () => { this.dataLoaded = true; this.dataLoading = false; },
    });
  }

  // ── Search ──────────────────────────────────────────────────────────
  /**
   * Compute groups for the current query. Empty query → recents + all pages,
   * to give the user something to act on the moment they hit ⌘K.
   */
  search(query: string): CommandPaletteGroup[] {
    const q = (query || '').trim();
    const groups: CommandPaletteGroup[] = [];
    let runningIndex = 0;

    if (!q) {
      const recents = this.getRecents();
      if (recents.length) {
        groups.push({ key: 'recent', label: 'Recent', results: recents, startIndex: runningIndex });
        runningIndex += recents.length;
      }
      // Show first page-row group on empty palette so users can navigate without typing.
      groups.push({ key: 'pages', label: 'Pages', results: this.pages.slice(0, 12), startIndex: runningIndex });
      return groups;
    }

    // Cases. The service shape isn't strictly known so we fall back to a
    // permissive set of fields. Worst case: no match (=empty group, hidden).
    const caseHits = new FuzzySearch(this.cases, ['caseName', 'caseNumber', 'name', 'title'], { caseSensitive: false, sort: true })
      .search(q).slice(0, 5).map((c: any): CommandPaletteResult => ({
        type: 'case',
        label: c.caseName || c.name || c.title || c.caseNumber || 'Case',
        sublabel: [c.caseNumber, c.clientName].filter(Boolean).join(' · '),
        route: `/legal/cases/${c.id}`,
        icon: 'briefcase',
      }));

    if (caseHits.length) {
      groups.push({ key: 'cases', label: 'Cases', results: caseHits, startIndex: runningIndex });
      runningIndex += caseHits.length;
    }

    const clientHits = new FuzzySearch(this.clients, ['firstName', 'lastName', 'email', 'name'], { caseSensitive: false, sort: true })
      .search(q).slice(0, 5).map((c: any): CommandPaletteResult => ({
        type: 'client',
        label: [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || c.name || c.email || 'Client',
        sublabel: c.email || c.phone || '',
        route: `/clients`,
        queryParams: { id: c.id },
        icon: 'user',
      }));

    if (clientHits.length) {
      groups.push({ key: 'clients', label: 'Clients', results: clientHits, startIndex: runningIndex });
      runningIndex += clientHits.length;
    }

    const pageHits = new FuzzySearch(this.pages, ['label', 'sublabel'], { caseSensitive: false, sort: true })
      .search(q).slice(0, 8);

    if (pageHits.length) {
      groups.push({ key: 'pages', label: 'Pages', results: pageHits, startIndex: runningIndex });
      runningIndex += pageHits.length;
    }

    return groups;
  }

  // ── Activate (Enter / click) ────────────────────────────────────────
  activate(result: CommandPaletteResult): void {
    this.addToRecents(result);
    if (result.queryParams) {
      this.router.navigate([result.route], { queryParams: result.queryParams });
    } else {
      this.router.navigate([result.route]);
    }
    this.close();
  }

  // ── Recents (localStorage) ──────────────────────────────────────────
  private getRecents(): CommandPaletteResult[] {
    try {
      const raw = localStorage.getItem(this.RECENTS_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.map((r: any) => ({ ...r, type: 'recent' as const })) : [];
    } catch { return []; }
  }

  private addToRecents(result: CommandPaletteResult): void {
    try {
      let recents = this.getRecents();
      // Dedupe by destination (route + queryParams id)
      const key = (r: CommandPaletteResult) => `${r.route}::${r.queryParams ? JSON.stringify(r.queryParams) : ''}`;
      recents = recents.filter(r => key(r) !== key(result));
      recents.unshift({ ...result, type: 'recent' });
      recents = recents.slice(0, this.MAX_RECENTS);
      localStorage.setItem(this.RECENTS_KEY, JSON.stringify(recents));
    } catch { /* localStorage may be disabled — ignore */ }
  }
}
