import { Component, Input, OnInit, OnDestroy, ViewChild, AfterViewInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { HttpClient } from '@angular/common/http';
import { NgxExtendedPdfViewerModule, NgxExtendedPdfViewerComponent, NgxExtendedPdfViewerService, pdfDefaultOptions } from 'ngx-extended-pdf-viewer';
import { environment } from '../../../../../../environments/environment';
import { FieldCitation } from '../shared/models/pi-medical-record.model';

/**
 * Citation Viewer Modal Component
 * Displays a PDF document and highlights/navigates to the specific citation location
 */
@Component({
  selector: 'app-citation-viewer-modal',
  standalone: true,
  imports: [CommonModule, NgxExtendedPdfViewerModule],
  templateUrl: './citation-viewer-modal.component.html',
  styleUrls: ['./citation-viewer-modal.component.scss']
})
export class CitationViewerModalComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('pdfViewer') pdfViewer!: NgxExtendedPdfViewerComponent;

  // Input data
  @Input() documentId!: number;
  @Input() documentName: string = 'Document';
  @Input() fieldName: string = '';
  @Input() fieldValue: string = '';
  @Input() citation!: FieldCitation;

  // State
  isLoading: boolean = true;
  hasError: boolean = false;
  errorMessage: string = '';
  pdfSrc: ArrayBuffer | null = null;
  pdfLoaded: boolean = false;

  // PDF viewer settings
  page: number = 1;
  zoom: string = 'page-width';
  searchText: string = '';

  constructor(
    public activeModal: NgbActiveModal,
    private http: HttpClient,
    private pdfViewerService: NgxExtendedPdfViewerService,
    private ngZone: NgZone
  ) {
    // Configure PDF.js default options
    pdfDefaultOptions.assetsFolder = 'assets';
  }

  ngOnInit(): void {
    // Set initial page from citation
    if (this.citation?.page) {
      this.page = this.citation.page;
    }
    this.loadDocument();
  }

  ngAfterViewInit(): void {
    // Search will be triggered after PDF loads
  }

  ngOnDestroy(): void {
    // Cleanup
  }

  loadDocument(): void {
    if (!this.documentId) {
      this.hasError = true;
      this.errorMessage = 'No document ID provided';
      this.isLoading = false;
      return;
    }

    // Fetch the PDF as arraybuffer
    this.http.get(`${environment.apiUrl}/api/file-manager/files/${this.documentId}/download`, {
      responseType: 'arraybuffer'
    }).subscribe({
      next: (arrayBuffer) => {
        this.pdfSrc = arrayBuffer;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading document:', err);
        this.hasError = true;
        this.errorMessage = err.status === 401
          ? 'Authentication required. Please refresh the page and try again.'
          : 'Failed to load document. Please try again.';
        this.isLoading = false;
      }
    });
  }

  /**
   * Called when PDF is fully loaded and rendered
   */
  onPdfLoaded(): void {
    this.pdfLoaded = true;
    // Trigger search after PDF text layer is ready
    if (this.citation?.excerpt) {
      // Wait for text layer to be rendered before searching
      setTimeout(() => this.highlightCitation(), 800);
    }
  }

  /**
   * Search and highlight the citation text directly on the PDF
   */
  private highlightCitation(): void {
    if (!this.citation?.excerpt) {
      return;
    }

    // Get the search text - use a more specific approach
    let searchText = this.getSearchableText(this.citation.excerpt);

    // Use ngx-extended-pdf-viewer service to find text
    this.ngZone.runOutsideAngular(() => {
      this.pdfViewerService.find(searchText, {
        highlightAll: false,  // Only highlight current match, not all
        matchCase: false,
        wholeWords: false,
        matchDiacritics: false
      });
    });
  }

  /**
   * Extract the most specific searchable text from the excerpt
   * This ensures we highlight only the relevant portion, not generic text
   */
  private getSearchableText(excerpt: string): string {
    let text = excerpt.trim();
    // Remove quotes if present
    text = text.replace(/^["']|["']$/g, '');

    // Priority 1: Dates (very specific)
    const dateMatch = text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
    if (dateMatch) {
      return dateMatch[0];
    }

    // Priority 2: Money amounts (very specific)
    const moneyMatch = text.match(/\$[\d,]+\.?\d*/);
    if (moneyMatch) {
      return moneyMatch[0];
    }

    // Priority 3: ICD/CPT codes (very specific)
    const codeMatch = text.match(/[A-Z]\d{2,3}\.?\d*/);
    if (codeMatch) {
      return codeMatch[0];
    }

    // Priority 4: Numbers with context (e.g., "97110", "ROM < 50%")
    const numberMatch = text.match(/\d{4,}/);
    if (numberMatch) {
      return numberMatch[0];
    }

    // Priority 5: Use a distinctive phrase - find the longest capitalized word or phrase
    const words = text.split(/\s+/);
    const capitalizedWords = words.filter(w => /^[A-Z]/.test(w) && w.length > 3);
    if (capitalizedWords.length > 0) {
      // Use the first 2-3 capitalized words as a phrase
      return capitalizedWords.slice(0, 2).join(' ');
    }

    // Fallback: Use a short, specific portion (first 20 chars max)
    // Avoid very short generic text
    if (text.length > 20) {
      return text.substring(0, 20).trim();
    }

    return text;
  }

  /**
   * Handle page change
   */
  onPageChange(page: number): void {
    this.page = page;
  }
}
