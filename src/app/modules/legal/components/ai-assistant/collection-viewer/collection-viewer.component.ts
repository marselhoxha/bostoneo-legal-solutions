import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

import { NgbDropdownModule, NgbNavModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { DocumentCollectionService, CollectionWithDocuments, CollectionDocument, AggregatedTimelineEvent, AggregatedActionItem, SearchResult, QAResponse, QASource, SearchResponse } from '../../../services/document-collection.service';
import { NotificationService } from '../../../services/notification.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DocumentPreviewModalComponent } from '../document-preview-modal/document-preview-modal.component';

// Q&A Chat message interface
interface QAMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: QASource[];
  processingTimeMs?: number;
  timestamp: Date;
}

@Component({
  selector: 'app-collection-viewer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgbDropdownModule,
    NgbNavModule,
    DocumentPreviewModalComponent
  ],
  templateUrl: './collection-viewer.component.html',
  styleUrls: ['./collection-viewer.component.scss']
})
export class CollectionViewerComponent implements OnInit, OnDestroy, OnChanges {
  @Input() collectionId!: number;
  @Output() close = new EventEmitter<void>();
  @Output() openDocument = new EventEmitter<{ analysisId: number; databaseId: number }>();
  @Output() uploadToCollection = new EventEmitter<number>();

  private destroy$ = new Subject<void>();

  collection: CollectionWithDocuments | null = null;
  isLoading = true;
  activeTab = 'documents';
  searchQuery = '';
  sortBy: 'date' | 'name' | 'type' = 'date';
  filterType = 'all';

  // Aggregated data
  aggregatedTimeline: AggregatedTimelineEvent[] = [];
  aggregatedActionItems: AggregatedActionItem[] = [];
  isLoadingTimeline = false;
  isLoadingActionItems = false;

  // Search
  collectionSearchQuery = '';
  searchResults: SearchResult[] = [];
  isSearching = false;
  hasSearched = false;

  // Enhanced search features
  suggestions: Array<{text: string, fromHistory: boolean, type: string}> = [];
  showSuggestions = false;
  resultsFromCache = false;
  expandedQuery = '';
  private searchInput$ = new Subject<string>();

  // Frontend cache for instant repeat searches
  private searchCache = new Map<string, {results: SearchResult[], timestamp: number, expandedQuery: string}>();
  private readonly SEARCH_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  // Quick search queries
  quickSearchQueries = [
    "What are the key deadlines?",
    "What are the termination clauses?",
    "What are the payment terms?",
    "Who are the parties involved?",
    "What are the liability limitations?"
  ];

  // Q&A Chat
  qaQuery = '';
  qaMessages: QAMessage[] = [];
  isAskingQuestion = false;
  suggestedQuestions = [
    'What are the key terms and conditions across all documents?',
    'Find all payment terms and deadlines',
    'Are there any contradictions between these documents?',
    'Summarize the main obligations of each party',
    'What are the termination clauses?'
  ];

  // Stats
  documentTypeStats: { type: string; count: number; color: string }[] = [];

  constructor(
    private collectionService: DocumentCollectionService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private modalService: NgbModal
  ) {}

  ngOnInit(): void {
    if (this.collectionId) {
      this.loadCollection();
      this.loadSavedQueriesFromStorage();
    }

    // Setup search input debounce for suggestions
    this.searchInput$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      if (query.length >= 2) {
        this.loadSuggestions(query);
      } else {
        this.suggestions = [];
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['collectionId'] && !changes['collectionId'].firstChange) {
      this.loadCollection();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCollection(): void {
    this.isLoading = true;
    this.collectionService.getCollection(this.collectionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (collection) => {
          this.collection = collection;
          this.calculateStats();
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Failed to load collection:', error);
          this.notificationService.error('Error', 'Failed to load collection');
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  calculateStats(): void {
    if (!this.collection?.documents) return;

    const typeMap = new Map<string, number>();
    this.collection.documents.forEach(doc => {
      const type = doc.detectedType || 'Unknown';
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });

    const colors = ['#405189', '#0ab39c', '#f7b84b', '#f06548', '#299cdb', '#6c757d'];
    this.documentTypeStats = Array.from(typeMap.entries()).map(([type, count], index) => ({
      type,
      count,
      color: colors[index % colors.length]
    }));
  }

  get filteredDocuments(): CollectionDocument[] {
    if (!this.collection?.documents) return [];

    let docs = [...this.collection.documents];

    // Filter by search
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      docs = docs.filter(d =>
        d.fileName?.toLowerCase().includes(query) ||
        d.detectedType?.toLowerCase().includes(query)
      );
    }

    // Filter by type
    if (this.filterType !== 'all') {
      docs = docs.filter(d => d.detectedType === this.filterType);
    }

    // Sort
    switch (this.sortBy) {
      case 'name':
        docs.sort((a, b) => (a.fileName || '').localeCompare(b.fileName || ''));
        break;
      case 'type':
        docs.sort((a, b) => (a.detectedType || '').localeCompare(b.detectedType || ''));
        break;
      case 'date':
      default:
        docs.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
        break;
    }

    return docs;
  }

  get uniqueDocumentTypes(): string[] {
    if (!this.collection?.documents) return [];
    const types = new Set(this.collection.documents.map(d => d.detectedType || 'Unknown'));
    return Array.from(types);
  }

  onDocumentClick(doc: CollectionDocument): void {
    this.openDocument.emit({ analysisId: doc.analysisId, databaseId: doc.analysisId });
  }

  /**
   * View document in preview modal
   */
  viewDocumentPreview(doc: CollectionDocument, event: Event): void {
    event.stopPropagation();

    const modalRef = this.modalService.open(DocumentPreviewModalComponent, {
      size: 'xl',
      centered: true,
      scrollable: true
    });

    modalRef.componentInstance.analysisId = doc.analysisId;

    modalRef.result.then((result) => {
      if (result?.action === 'openAnalysis') {
        this.openDocument.emit({
          analysisId: result.analysisId,
          databaseId: result.analysisId
        });
      }
    }).catch(() => {
      // Modal dismissed - do nothing
    });
  }

  removeDocument(doc: CollectionDocument, event: Event): void {
    event.stopPropagation();
    if (!this.collection) return;

    this.collectionService.removeDocumentFromCollection(this.collection.id, doc.analysisId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Remove from local list
          if (this.collection?.documents) {
            this.collection.documents = this.collection.documents.filter(d => d.id !== doc.id);
            this.calculateStats();
            this.cdr.detectChanges();
          }
          this.notificationService.success('Removed', `${doc.fileName} removed from collection`);
        },
        error: () => {
          this.notificationService.error('Error', 'Failed to remove document');
        }
      });
  }

  onClose(): void {
    this.close.emit();
  }

  uploadDocuments(): void {
    this.uploadToCollection.emit(this.collectionId);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getDocTypeIcon(type: string): string {
    const iconMap: { [key: string]: string } = {
      'Contract': 'ri-file-text-line',
      'Complaint': 'ri-file-damage-line',
      'Motion': 'ri-draft-line',
      'Brief': 'ri-book-open-line',
      'Discovery': 'ri-search-line',
      'Court Order': 'ri-gavel-line',
      'Letter': 'ri-mail-line',
      'Agreement': 'ri-handshake-line'
    };
    return iconMap[type] || 'ri-file-text-line';
  }

  getDocTypeColor(type: string): string {
    const colorMap: { [key: string]: string } = {
      'Contract': 'primary',
      'Complaint': 'danger',
      'Motion': 'warning',
      'Brief': 'info',
      'Discovery': 'secondary',
      'Court Order': 'dark',
      'Letter': 'success',
      'Agreement': 'primary'
    };
    return colorMap[type] || 'secondary';
  }

  onTabChange(tabId: string): void {
    if (tabId === 'timeline' && this.aggregatedTimeline.length === 0 && !this.isLoadingTimeline) {
      this.loadAggregatedTimeline();
    } else if (tabId === 'actions' && this.aggregatedActionItems.length === 0 && !this.isLoadingActionItems) {
      this.loadAggregatedActionItems();
    }
  }

  loadAggregatedTimeline(): void {
    this.isLoadingTimeline = true;
    this.collectionService.getAggregatedTimeline(this.collectionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (events) => {
          this.aggregatedTimeline = events;
          this.isLoadingTimeline = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.isLoadingTimeline = false;
          this.notificationService.error('Error', 'Failed to load timeline');
          this.cdr.detectChanges();
        }
      });
  }

  loadAggregatedActionItems(): void {
    this.isLoadingActionItems = true;
    this.collectionService.getAggregatedActionItems(this.collectionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          this.aggregatedActionItems = items;
          this.isLoadingActionItems = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.isLoadingActionItems = false;
          this.notificationService.error('Error', 'Failed to load action items');
          this.cdr.detectChanges();
        }
      });
  }

  getPriorityClass(priority: string): string {
    const priorityMap: { [key: string]: string } = {
      'CRITICAL': 'danger',
      'HIGH': 'warning',
      'MEDIUM': 'info',
      'LOW': 'secondary'
    };
    return priorityMap[priority] || 'secondary';
  }

  getStatusClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'PENDING': 'warning',
      'IN_PROGRESS': 'info',
      'COMPLETED': 'success'
    };
    return statusMap[status] || 'secondary';
  }

  getEventTypeIcon(type: string): string {
    const iconMap: { [key: string]: string } = {
      'DEADLINE': 'ri-alarm-warning-line',
      'FILING': 'ri-file-upload-line',
      'HEARING': 'ri-gavel-line',
      'MILESTONE': 'ri-flag-line'
    };
    return iconMap[type] || 'ri-calendar-event-line';
  }

  // ============ ENHANCED SEARCH FUNCTIONALITY ============

  /**
   * Handle search input changes for suggestions
   */
  onSearchInput(): void {
    this.searchInput$.next(this.collectionSearchQuery);
    this.showSuggestions = this.collectionSearchQuery.length >= 2;
  }

  /**
   * Load search suggestions from backend
   */
  loadSuggestions(query: string): void {
    this.collectionService.getSearchSuggestions(this.collectionId, query)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (suggestions) => {
          this.suggestions = suggestions;
          this.cdr.detectChanges();
        },
        error: () => {
          this.suggestions = [];
        }
      });
  }

  /**
   * Select a suggestion
   */
  selectSuggestion(suggestion: {text: string}): void {
    this.collectionSearchQuery = suggestion.text;
    this.showSuggestions = false;
    this.performSearch();
  }

  /**
   * Hide suggestions with delay (to allow click to register)
   */
  hideSuggestionsDelayed(): void {
    setTimeout(() => {
      this.showSuggestions = false;
      this.cdr.detectChanges();
    }, 200);
  }

  /**
   * Perform search with frontend caching
   */
  performSearch(): void {
    if (!this.collectionSearchQuery.trim()) {
      this.searchResults = [];
      this.hasSearched = false;
      return;
    }

    const query = this.collectionSearchQuery.trim();

    // Check frontend cache first
    const cacheKey = `${this.collectionId}_${query.toLowerCase()}`;
    const cached = this.searchCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < this.SEARCH_CACHE_TTL) {
      this.searchResults = cached.results;
      this.expandedQuery = cached.expandedQuery;
      this.resultsFromCache = true;
      this.hasSearched = true;
      this.cdr.detectChanges();
      return;
    }

    // Not in cache - call backend
    this.isSearching = true;
    this.hasSearched = true;
    this.resultsFromCache = false;

    this.collectionService.searchCollectionEnhanced(this.collectionId, query, 20)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: SearchResponse) => {
          this.searchResults = response.results;
          this.expandedQuery = response.expandedQuery;
          this.resultsFromCache = response.fromCache;
          this.isSearching = false;

          // Cache in frontend
          this.searchCache.set(cacheKey, {
            results: response.results,
            timestamp: Date.now(),
            expandedQuery: response.expandedQuery
          });

          this.cdr.detectChanges();
        },
        error: () => {
          this.isSearching = false;
          this.notificationService.error('Error', 'Search failed');
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Perform a quick search from chips
   */
  performQuickSearch(query: string): void {
    this.collectionSearchQuery = query;
    this.performSearch();
  }

  /**
   * Clear search
   */
  clearSearch(): void {
    this.collectionSearchQuery = '';
    this.searchResults = [];
    this.hasSearched = false;
    this.expandedQuery = '';
    this.resultsFromCache = false;
    this.cdr.detectChanges();
  }

  /**
   * View search result in document preview modal
   */
  viewInDocument(result: SearchResult): void {
    const modalRef = this.modalService.open(DocumentPreviewModalComponent, {
      size: 'xl',
      centered: true,
      scrollable: true
    });

    modalRef.componentInstance.analysisId = result.analysisId;
    modalRef.componentInstance.highlightQuery = this.collectionSearchQuery;
    modalRef.componentInstance.targetChunkIndex = result.chunkIndex;

    modalRef.result.then((modalResult) => {
      if (modalResult?.action === 'openAnalysis') {
        this.openDocument.emit({
          analysisId: modalResult.analysisId,
          databaseId: modalResult.analysisId
        });
      }
    }).catch(() => {
      // Modal dismissed - do nothing
    });
  }

  /**
   * Copy content to clipboard
   */
  copyContent(content: string): void {
    navigator.clipboard.writeText(content).then(() => {
      this.notificationService.success('Copied', 'Content copied to clipboard');
    }).catch(() => {
      this.notificationService.error('Error', 'Failed to copy');
    });
  }

  /**
   * Legacy method - keep for backward compatibility
   */
  openSearchResult(result: SearchResult): void {
    this.viewInDocument(result);
  }

  /**
   * Get badge class for document type
   */
  getDocTypeBadgeClass(type: string): string {
    return `bg-${this.getDocTypeColor(type || 'Unknown')}-subtle text-${this.getDocTypeColor(type || 'Unknown')}`;
  }

  getScorePercentage(score: number): number {
    return Math.round(score * 100);
  }

  getScoreClass(score: number): string {
    if (score >= 0.8) return 'success';
    if (score >= 0.6) return 'info';
    if (score >= 0.4) return 'warning';
    return 'secondary';
  }

  sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  // ============ Q&A FUNCTIONALITY ============

  /**
   * Ask a question about all documents in the collection
   */
  askQuestion(): void {
    const query = this.qaQuery.trim();
    if (!query || this.isAskingQuestion) return;

    // Add user message
    this.qaMessages.push({
      role: 'user',
      content: query,
      timestamp: new Date()
    });

    this.qaQuery = '';
    this.isAskingQuestion = true;
    this.cdr.detectChanges();

    // Call API
    this.collectionService.askCollection(this.collectionId, query, 10)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: QAResponse) => {
          this.qaMessages.push({
            role: 'assistant',
            content: response.answer,
            sources: response.sources,
            processingTimeMs: response.processingTimeMs,
            timestamp: new Date()
          });
          this.isAskingQuestion = false;
          this.cdr.detectChanges();

          // Scroll to bottom of chat
          setTimeout(() => this.scrollToBottom(), 100);
        },
        error: (error) => {
          console.error('Q&A failed:', error);
          this.qaMessages.push({
            role: 'assistant',
            content: 'Sorry, I encountered an error while analyzing the documents. Please try again.',
            timestamp: new Date()
          });
          this.isAskingQuestion = false;
          this.notificationService.error('Error', 'Failed to get answer');
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Ask a suggested question
   */
  askSuggestedQuestion(question: string): void {
    this.qaQuery = question;
    this.askQuestion();
  }

  /**
   * Clear Q&A chat history
   */
  clearQAChat(): void {
    this.qaMessages = [];
    this.qaQuery = '';
    this.cdr.detectChanges();
  }

  /**
   * Open document from Q&A source citation
   */
  openSourceDocument(source: QASource): void {
    this.openDocument.emit({
      analysisId: source.documentId,
      databaseId: source.documentId
    });
  }

  /**
   * Scroll Q&A chat to bottom
   */
  private scrollToBottom(): void {
    const chatContainer = document.querySelector('.qa-messages');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  /**
   * Format the answer with proper line breaks and styling
   * Handles markdown headers, lists, tables, and other formatting
   */
  formatAnswer(content: string): SafeHtml {
    if (!content) return '';

    // Convert markdown-style formatting to HTML
    let formatted = content
      // Headers (must be before other replacements)
      .replace(/^### (.*)$/gm, '<h5 class="qa-header">$1</h5>')
      .replace(/^## (.*)$/gm, '<h4 class="qa-header">$1</h4>')
      .replace(/^# (.*)$/gm, '<h3 class="qa-header">$1</h3>')
      // Horizontal rules
      .replace(/^---+$/gm, '<hr class="qa-divider">')
      // Bold text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic text
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Bullet points (various styles)
      .replace(/^[•\-\*]\s+(.*)$/gm, '<li>$1</li>')
      // Numbered lists
      .replace(/^\d+\.\s+(.*)$/gm, '<li class="numbered">$1</li>')
      // Source citations [Source X] - make them stand out
      .replace(/\[Source (\d+)\]/g, '<span class="source-citation">[Source $1]</span>')
      // Warning indicators
      .replace(/⚠️/g, '<span class="text-warning">⚠️</span>')
      .replace(/⚠/g, '<span class="text-warning">⚠️</span>');

    // Handle markdown tables
    formatted = this.convertMarkdownTables(formatted);

    // Wrap consecutive list items in ul/ol
    formatted = formatted.replace(/((<li class="numbered">.*?<\/li>\s*)+)/g, '<ol class="qa-list numbered-list">$1</ol>');
    formatted = formatted.replace(/((<li>.*?<\/li>\s*)+)/g, '<ul class="qa-list">$1</ul>');

    // Convert remaining line breaks (but not after block elements)
    formatted = formatted.replace(/(?<!<\/h[3-5]>|<\/li>|<\/ul>|<\/ol>|<hr[^>]*>)\n/g, '<br>');

    return this.sanitizer.bypassSecurityTrustHtml(formatted);
  }

  /**
   * Convert markdown tables to HTML tables
   */
  private convertMarkdownTables(content: string): string {
    // Match markdown table pattern
    const tableRegex = /(\|.+\|[\r\n]+\|[-:\s|]+\|[\r\n]+(?:\|.+\|[\r\n]*)+)/g;

    return content.replace(tableRegex, (match) => {
      const lines = match.trim().split('\n').filter(line => line.trim());
      if (lines.length < 2) return match;

      // Parse header row
      const headerCells = lines[0].split('|').filter(cell => cell.trim());
      // Skip separator row (lines[1])
      const bodyRows = lines.slice(2);

      let html = '<table class="qa-table table table-sm table-bordered"><thead><tr>';
      headerCells.forEach(cell => {
        html += `<th>${cell.trim()}</th>`;
      });
      html += '</tr></thead><tbody>';

      bodyRows.forEach(row => {
        const cells = row.split('|').filter(cell => cell.trim());
        html += '<tr>';
        cells.forEach(cell => {
          html += `<td>${cell.trim()}</td>`;
        });
        html += '</tr>';
      });

      html += '</tbody></table>';
      return html;
    });
  }

  // ============ EXPORT TO WORD ============

  /**
   * Export Q&A conversation to Word document
   */
  async exportToWord(): Promise<void> {
    if (this.qaMessages.length === 0) {
      this.notificationService.warning('No Content', 'No Q&A conversation to export');
      return;
    }

    try {
      const children: Paragraph[] = [];

      // Title
      children.push(
        new Paragraph({
          text: `Collection Q&A Report: ${this.collection?.name || 'Unknown Collection'}`,
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 400 }
        })
      );

      // Metadata
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Generated: ', bold: true }),
            new TextRun({ text: new Date().toLocaleString() })
          ],
          spacing: { after: 200 }
        })
      );

      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Documents in Collection: ', bold: true }),
            new TextRun({ text: String(this.collection?.documentCount || 0) })
          ],
          spacing: { after: 400 }
        })
      );

      // Separator
      children.push(new Paragraph({ text: '─'.repeat(50), spacing: { after: 400 } }));

      // Q&A Messages
      for (const message of this.qaMessages) {
        // Role header
        children.push(
          new Paragraph({
            text: message.role === 'user' ? 'Question:' : 'Answer:',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 200 }
          })
        );

        // Message content
        const contentParagraphs = message.content.split('\n').filter(line => line.trim());
        for (const line of contentParagraphs) {
          children.push(
            new Paragraph({
              text: line.replace(/\*\*/g, '').replace(/⚠️/g, '[!]'),
              spacing: { after: 100 }
            })
          );
        }

        // Sources (for assistant messages)
        if (message.role === 'assistant' && message.sources && message.sources.length > 0) {
          children.push(
            new Paragraph({
              text: 'Sources:',
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 200, after: 100 }
            })
          );

          for (let i = 0; i < message.sources.length; i++) {
            const source = message.sources[i];
            children.push(
              new Paragraph({
                children: [
                  new TextRun({ text: `[${i + 1}] `, bold: true }),
                  new TextRun({ text: source.documentName, bold: true }),
                  new TextRun({ text: source.sectionTitle ? ` - ${source.sectionTitle}` : '' })
                ],
                spacing: { after: 50 }
              })
            );
            children.push(
              new Paragraph({
                text: `"${source.excerpt}"`,
                spacing: { after: 100 },
                indent: { left: 400 }
              })
            );
          }
        }

        // Separator between Q&A pairs
        children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
      }

      // Create document
      const doc = new Document({
        sections: [{
          properties: {},
          children: children
        }]
      });

      // Generate and download
      const blob = await Packer.toBlob(doc);
      const fileName = `${this.collection?.name || 'Collection'}_QA_Report_${new Date().toISOString().split('T')[0]}.docx`;
      saveAs(blob, fileName);

      this.notificationService.success('Exported', 'Q&A report exported to Word');
    } catch (error) {
      console.error('Export failed:', error);
      this.notificationService.error('Export Failed', 'Could not generate Word document');
    }
  }

  // ============ SAVED QUERIES ============

  savedQueries: { id: string; name: string; query: string }[] = [];

  /**
   * Save current query as a template
   */
  saveCurrentQuery(): void {
    const query = this.qaQuery.trim();
    if (!query) {
      this.notificationService.warning('No Query', 'Enter a question first');
      return;
    }

    const name = prompt('Enter a name for this saved query:');
    if (!name) return;

    const savedQuery = {
      id: `sq_${Date.now()}`,
      name: name.trim(),
      query: query
    };

    this.savedQueries.push(savedQuery);
    this.saveSavedQueriesToStorage();
    this.notificationService.success('Saved', `Query saved as "${name}"`);
  }

  /**
   * Load a saved query
   */
  loadSavedQuery(saved: { query: string }): void {
    this.qaQuery = saved.query;
  }

  /**
   * Delete a saved query
   */
  deleteSavedQuery(id: string, event: Event): void {
    event.stopPropagation();
    this.savedQueries = this.savedQueries.filter(q => q.id !== id);
    this.saveSavedQueriesToStorage();
    this.notificationService.success('Deleted', 'Saved query removed');
  }

  /**
   * Save queries to localStorage
   */
  private saveSavedQueriesToStorage(): void {
    localStorage.setItem(`collection_saved_queries_${this.collectionId}`, JSON.stringify(this.savedQueries));
  }

  /**
   * Load saved queries from localStorage
   */
  private loadSavedQueriesFromStorage(): void {
    const stored = localStorage.getItem(`collection_saved_queries_${this.collectionId}`);
    if (stored) {
      try {
        this.savedQueries = JSON.parse(stored);
      } catch (e) {
        this.savedQueries = [];
      }
    }
  }

  // ============ COMPARE MODE ============

  compareMode = false;
  selectedDocsForCompare: CollectionDocument[] = [];
  compareAspect = '';
  isComparing = false;
  compareResult: { comparison: string; sources: QASource[] } | null = null;

  /**
   * Toggle compare mode
   */
  toggleCompareMode(): void {
    this.compareMode = !this.compareMode;
    if (!this.compareMode) {
      this.selectedDocsForCompare = [];
      this.compareResult = null;
    }
  }

  /**
   * Toggle document selection for comparison
   */
  toggleDocumentForCompare(doc: CollectionDocument, event: Event): void {
    event.stopPropagation();
    const index = this.selectedDocsForCompare.findIndex(d => d.analysisId === doc.analysisId);
    if (index >= 0) {
      this.selectedDocsForCompare.splice(index, 1);
    } else if (this.selectedDocsForCompare.length < 2) {
      this.selectedDocsForCompare.push(doc);
    } else {
      this.notificationService.warning('Limit Reached', 'You can only compare 2 documents at a time');
    }
    this.cdr.detectChanges();
  }

  /**
   * Check if document is selected for compare
   */
  isSelectedForCompare(doc: CollectionDocument): boolean {
    return this.selectedDocsForCompare.some(d => d.analysisId === doc.analysisId);
  }

  /**
   * Run document comparison
   */
  runComparison(): void {
    if (this.selectedDocsForCompare.length !== 2) {
      this.notificationService.warning('Select Documents', 'Please select exactly 2 documents to compare');
      return;
    }

    this.isComparing = true;
    this.compareResult = null;

    const doc1 = this.selectedDocsForCompare[0];
    const doc2 = this.selectedDocsForCompare[1];

    this.collectionService.compareDocuments(
      this.collectionId,
      doc1.analysisId,
      doc2.analysisId,
      this.compareAspect || undefined
    ).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.compareResult = {
            comparison: response.comparison,
            sources: response.sources
          };
          this.isComparing = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Comparison failed:', error);
          this.isComparing = false;
          this.notificationService.error('Error', 'Document comparison failed');
          this.cdr.detectChanges();
        }
      });
  }
}
