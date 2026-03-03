import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Exhibit {
  id: string;
  label: string;       // e.g. "Exhibit A", "Exhibit B"
  fileName: string;    // e.g. "police_report.pdf"
  fileUrl: string;     // URL or blob URL for the PDF viewer
  pageCount?: number;
}

export interface TocEntry {
  id: string;
  level: number;       // 1-6 (h1-h6)
  text: string;
  numbering: string;   // e.g. "1.", "2.1", "3.1.1"
}

@Injectable({ providedIn: 'root' })
export class ExhibitPanelService {
  // Drafting sidebar tab
  private activeSidebarTab$ = new BehaviorSubject<'contents' | 'exhibits'>('contents');
  readonly sidebarTab$ = this.activeSidebarTab$.asObservable();

  // Table of Contents entries (auto-generated from CKEditor headings)
  private tocEntries$ = new BehaviorSubject<TocEntry[]>([]);
  readonly toc$ = this.tocEntries$.asObservable();

  // Exhibits list
  private exhibits$ = new BehaviorSubject<Exhibit[]>([]);
  readonly exhibitList$ = this.exhibits$.asObservable();

  // Active exhibit (shown in the right panel)
  private activeExhibit$ = new BehaviorSubject<Exhibit | null>(null);
  readonly currentExhibit$ = this.activeExhibit$.asObservable();

  // Exhibit panel visibility
  private exhibitPanelOpen$ = new BehaviorSubject<boolean>(false);
  readonly panelOpen$ = this.exhibitPanelOpen$.asObservable();

  // Current page in exhibit viewer
  private currentPage$ = new BehaviorSubject<number>(1);
  readonly page$ = this.currentPage$.asObservable();

  // --- TOC Snapshot ---
  get tocSnapshot(): TocEntry[] {
    return this.tocEntries$.value;
  }

  // --- Sidebar Tab ---
  setSidebarTab(tab: 'contents' | 'exhibits'): void {
    this.activeSidebarTab$.next(tab);
  }

  // --- TOC ---
  updateToc(entries: TocEntry[]): void {
    this.tocEntries$.next(entries);
  }

  /**
   * Parse headings from CKEditor content and build TOC entries.
   * Call this whenever the editor content changes.
   */
  buildTocFromHtml(html: string): void {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');

    const entries: TocEntry[] = [];
    const counters = [0, 0, 0, 0, 0, 0]; // h1-h6

    headings.forEach((heading) => {
      const level = parseInt(heading.tagName[1], 10);
      counters[level - 1]++;
      // Reset deeper levels
      for (let i = level; i < 6; i++) {
        counters[i] = 0;
      }

      const parts = counters.slice(0, level).filter(c => c > 0);
      // Single-level numbers get trailing dot (e.g. "1.", "2."), multi-level don't (e.g. "2.1", "3.2")
      const numbering = parts.length === 1 ? `${parts[0]}.` : parts.join('.');

      const text = heading.textContent?.trim() || '';
      // Use deterministic index-based IDs (CKEditor heading IDs are unstable across rebuilds)
      const id = `heading-${entries.length}`;

      entries.push({ id, level, text, numbering });
    });

    this.tocEntries$.next(entries);
  }

  // --- Exhibits ---
  setExhibits(exhibits: Exhibit[]): void {
    this.exhibits$.next(exhibits);
  }

  addExhibit(exhibit: Exhibit): void {
    const current = this.exhibits$.value;
    this.exhibits$.next([...current, exhibit]);
  }

  removeExhibit(id: string): void {
    const current = this.exhibits$.value.filter(e => e.id !== id);
    this.exhibits$.next(current);
    if (this.activeExhibit$.value?.id === id) {
      this.closePanel();
    }
  }

  // --- Panel ---
  openExhibit(exhibit: Exhibit): void {
    this.activeExhibit$.next(exhibit);
    this.exhibitPanelOpen$.next(true);
    this.currentPage$.next(1);
  }

  closePanel(): void {
    this.exhibitPanelOpen$.next(false);
    this.activeExhibit$.next(null);
  }

  togglePanel(): void {
    if (this.exhibitPanelOpen$.value) {
      this.closePanel();
    } else {
      const exhibits = this.exhibits$.value;
      if (exhibits.length > 0) {
        this.openExhibit(exhibits[0]);
      }
    }
  }

  // --- Page Navigation ---
  setPage(page: number): void {
    this.currentPage$.next(page);
  }

  nextPage(): void {
    const exhibit = this.activeExhibit$.value;
    const current = this.currentPage$.value;
    if (exhibit?.pageCount && current < exhibit.pageCount) {
      this.currentPage$.next(current + 1);
    }
  }

  prevPage(): void {
    const current = this.currentPage$.value;
    if (current > 1) {
      this.currentPage$.next(current - 1);
    }
  }

  // --- Reset ---
  reset(): void {
    this.tocEntries$.next([]);
    this.exhibits$.next([]);
    this.activeExhibit$.next(null);
    this.exhibitPanelOpen$.next(false);
    this.currentPage$.next(1);
    this.activeSidebarTab$.next('contents');
  }
}
