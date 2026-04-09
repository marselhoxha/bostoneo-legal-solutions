import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Exhibit {
  id: string;
  label: string;       // e.g. "Exhibit A", "Exhibit B"
  fileName: string;    // e.g. "police_report.pdf"
  fileUrl: string;     // API URL or blob URL for images
  pdfData?: Uint8Array; // Raw PDF bytes for the viewer (avoids blob URL worker issues)
  pageCount?: number;
  mimeType?: string;   // e.g. "application/pdf", "image/jpeg"
}

export interface ExhibitListResponse {
  exhibits: any[];
  autoAttachComplete: boolean;
}

export interface TocEntry {
  id: string;
  level: number;       // 1-6 (h1-h6)
  text: string;
  numbering: string;   // e.g. "1.", "2.1", "3.1.1"
}

@Injectable({ providedIn: 'root' })
export class ExhibitPanelService {
  private apiUrl = `${environment.apiUrl}/api/legal/ai-workspace`;

  constructor(private http: HttpClient) {}

  // ===== HTTP METHODS =====

  getExhibits(documentId: number): Observable<ExhibitListResponse> {
    return this.http.get<ExhibitListResponse>(`${this.apiUrl}/documents/${documentId}/exhibits`);
  }

  addFromCaseDocument(documentId: number, caseDocumentId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/documents/${documentId}/exhibits/from-case`, { caseDocumentId });
  }

  uploadExhibit(documentId: number, file: File, caseId?: number | null): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (caseId) formData.append('caseId', caseId.toString());
    return this.http.post(`${this.apiUrl}/documents/${documentId}/exhibits/upload`, formData);
  }

  deleteExhibit(documentId: number, exhibitId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/documents/${documentId}/exhibits/${exhibitId}`);
  }

  getExhibitFileUrl(documentId: number, exhibitId: number): string {
    return `${this.apiUrl}/documents/${documentId}/exhibits/${exhibitId}/file`;
  }

  /** Fetch exhibit file as blob (uses HttpClient with auth interceptor) */
  getExhibitFileBlob(documentId: number, exhibitId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/documents/${documentId}/exhibits/${exhibitId}/file`, {
      responseType: 'blob'
    });
  }

  // Drafting sidebar tab
  private activeSidebarTab$ = new BehaviorSubject<'contents' | 'exhibits'>('contents');
  readonly sidebarTab$ = this.activeSidebarTab$.asObservable();

  // Table of Contents entries (auto-generated from CKEditor headings)
  private tocEntries$ = new BehaviorSubject<TocEntry[]>([]);
  readonly toc$ = this.tocEntries$.asObservable();

  // Exhibits list
  private exhibits$ = new BehaviorSubject<Exhibit[]>([]);
  readonly exhibitList$ = this.exhibits$.asObservable();

  // Exhibits loading state — true while async attach is still in progress
  private _exhibitsLoading$ = new BehaviorSubject<boolean>(false);
  readonly exhibitsLoading$ = this._exhibitsLoading$.asObservable();

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

  // --- Exhibit List Snapshot ---
  get exhibitListSnapshot(): Exhibit[] {
    return this.exhibits$.value;
  }

  // --- Active Exhibit Snapshot ---
  get activeExhibitSnapshot(): Exhibit | null {
    return this.activeExhibit$.value;
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

      let text = heading.textContent?.trim() || '';
      // Strip leading numbering from AI-generated headings to avoid duplication
      // Handles: "I.", "II.", "III.", "IV.", "1.", "2.", "3.1", "A.", "B." etc.
      text = text.replace(/^[IVXLCDM]+\.\s*/, '').replace(/^\d+[\.\)]\s*/, '').replace(/^[A-Z]\.\s*/, '');
      // Use deterministic index-based IDs (CKEditor heading IDs are unstable across rebuilds)
      const id = `heading-${entries.length}`;

      entries.push({ id, level, text, numbering });
    });

    this.tocEntries$.next(entries);
  }

  // --- Exhibits ---
  setExhibitsLoading(loading: boolean): void {
    this._exhibitsLoading$.next(loading);
  }

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
    // Revoke any blob URLs to prevent memory leaks
    for (const exhibit of this.exhibits$.value) {
      if (exhibit.fileUrl && exhibit.fileUrl.startsWith('blob:')) {
        // Strip hash fragment (#toolbar=1) before revoking
        const cleanUrl = exhibit.fileUrl.split('#')[0];
        URL.revokeObjectURL(cleanUrl);
      }
    }
    this.tocEntries$.next([]);
    this.exhibits$.next([]);
    this._exhibitsLoading$.next(false);
    this.activeExhibit$.next(null);
    this.exhibitPanelOpen$.next(false);
    this.currentPage$.next(1);
    this.activeSidebarTab$.next('contents');
  }
}
