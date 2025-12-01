import { Component, Input, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { DocumentCollectionService, DocumentContent, DocumentChunk } from '../../../services/document-collection.service';
import { environment } from '../../../../../../environments/environment';

@Component({
  selector: 'app-document-preview-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-preview-modal.component.html',
  styleUrls: ['./document-preview-modal.component.scss']
})
export class DocumentPreviewModalComponent implements OnInit, AfterViewInit {
  @Input() analysisId!: number;
  @Input() highlightQuery?: string;
  @Input() targetChunkIndex?: number;

  @ViewChild('contentContainer') contentContainer!: ElementRef;

  document: DocumentContent | null = null;
  documentChunks: DocumentChunk[] = [];
  isLoading = true;
  error: string | null = null;

  matchCount = 0;
  currentMatchIndex = 0;
  matchElements: HTMLElement[] = [];
  iframeError = false;
  cachedFileUrl: SafeResourceUrl | null = null;

  constructor(
    public activeModal: NgbActiveModal,
    private documentCollectionService: DocumentCollectionService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadDocumentContent();
  }

  ngAfterViewInit(): void {
    // Scroll to target chunk after view init
    setTimeout(() => {
      if (this.targetChunkIndex !== undefined && !this.isLoading) {
        this.scrollToChunk(this.targetChunkIndex);
      }
    }, 300);
  }

  loadDocumentContent(): void {
    this.isLoading = true;
    this.error = null;

    this.documentCollectionService.getDocumentContent(this.analysisId).subscribe({
      next: (response) => {
        this.document = response;
        this.documentChunks = response.chunks || [];
        this.isLoading = false;

        // Count matches after content loads
        setTimeout(() => {
          this.countMatches();
          if (this.targetChunkIndex !== undefined) {
            this.scrollToChunk(this.targetChunkIndex);
          }
        }, 100);
      },
      error: (err) => {
        console.error('Failed to load document content:', err);
        this.error = 'Failed to load document content';
        this.isLoading = false;
      }
    });
  }

  getHighlightedChunkContent(chunk: DocumentChunk): SafeHtml {
    if (!this.highlightQuery) {
      return this.sanitizer.bypassSecurityTrustHtml(this.escapeHtml(chunk.content));
    }
    return this.sanitizer.bypassSecurityTrustHtml(
      this.highlightSearchTerms(chunk.content, this.highlightQuery)
    );
  }

  highlightSearchTerms(content: string, query: string): string {
    // Escape HTML first
    let escaped = this.escapeHtml(content);

    // Split query into meaningful terms (3+ chars, exclude common words)
    const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can',
      'her', 'was', 'one', 'our', 'out', 'has', 'have', 'had', 'what', 'when', 'where', 'who',
      'which', 'this', 'that', 'with', 'from', 'they', 'been', 'would', 'there', 'their']);

    const terms = query.split(/\s+/)
      .filter(t => t.length >= 3 && !stopWords.has(t.toLowerCase()));

    // Highlight each term
    terms.forEach(term => {
      const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
      escaped = escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
    });

    return escaped;
  }

  escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  scrollToChunk(chunkIndex: number): void {
    setTimeout(() => {
      const element = document.getElementById(`chunk-${chunkIndex}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add temporary highlight effect
        element.classList.add('scroll-highlight');
        setTimeout(() => element.classList.remove('scroll-highlight'), 2000);
      }
    }, 100);
  }

  countMatches(): void {
    if (!this.highlightQuery || !this.contentContainer) return;

    const marks = this.contentContainer.nativeElement.querySelectorAll('mark.search-highlight');
    this.matchElements = Array.from(marks);
    this.matchCount = this.matchElements.length;
    this.currentMatchIndex = 0;

    if (this.matchCount > 0) {
      this.scrollToMatch(0);
    }
  }

  scrollToMatch(index: number): void {
    if (index >= 0 && index < this.matchElements.length) {
      this.currentMatchIndex = index;

      // Remove active class from all marks
      this.matchElements.forEach(el => el.classList.remove('active-match'));

      // Add active class to current match
      const currentMatch = this.matchElements[index];
      currentMatch.classList.add('active-match');
      currentMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  goToNextMatch(): void {
    if (this.currentMatchIndex < this.matchCount - 1) {
      this.scrollToMatch(this.currentMatchIndex + 1);
    }
  }

  goToPreviousMatch(): void {
    if (this.currentMatchIndex > 0) {
      this.scrollToMatch(this.currentMatchIndex - 1);
    }
  }

  chunkHasMatch(chunkIndex: number): boolean {
    if (!this.highlightQuery) return false;

    const chunk = this.documentChunks[chunkIndex];
    if (!chunk) return false;

    const terms = this.highlightQuery.split(/\s+/).filter(t => t.length >= 3);
    const contentLower = chunk.content.toLowerCase();

    return terms.some(term => contentLower.includes(term.toLowerCase()));
  }

  isActiveChunk(chunkIndex: number): boolean {
    return chunkIndex === this.targetChunkIndex;
  }

  openFullAnalysis(): void {
    this.activeModal.close({
      action: 'openAnalysis',
      analysisId: this.analysisId
    });
  }

  isPdfFile(): boolean {
    if (!this.document) return false;

    // Check file type
    if (this.document.fileType === 'application/pdf') {
      return true;
    }

    // Check file extension
    if (this.document.fileName) {
      return this.document.fileName.toLowerCase().endsWith('.pdf');
    }

    return false;
  }

  getSafeFileUrl(): SafeResourceUrl {
    // Return cached URL to prevent iframe reload on every change detection
    if (this.cachedFileUrl) {
      return this.cachedFileUrl;
    }

    if (!this.document?.fileUrl) {
      return '';
    }

    // Build the full URL with the API base path from environment and cache it
    const fullUrl = `${environment.apiUrl}${this.document.fileUrl}`;
    this.cachedFileUrl = this.sanitizer.bypassSecurityTrustResourceUrl(fullUrl);
    return this.cachedFileUrl;
  }

  getFileUrl(): string {
    if (!this.document?.fileUrl) {
      return '';
    }
    return `${environment.apiUrl}${this.document.fileUrl}`;
  }

  openInNewTab(): void {
    const url = this.getFileUrl();
    if (url) {
      window.open(url, '_blank');
    }
  }

  onIframeError(): void {
    this.iframeError = true;
  }

  close(): void {
    this.activeModal.dismiss();
  }
}
