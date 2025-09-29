import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, CUSTOM_ELEMENTS_SCHEMA, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import flatpickr from 'flatpickr';
import { jsPDF } from 'jspdf';
import {
  LegalResearchService,
  LegalSearchRequest,
  LegalSearchResponse,
  SearchResult,
  SearchHistory
} from '../../../services/legal-research.service';
import { MarkdownToHtmlPipe } from '../../../pipes/markdown-to-html.pipe';

@Component({
  selector: 'app-legal-research',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MarkdownToHtmlPipe],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './legal-research.component.html',
  styleUrls: ['./legal-research.component.scss']
})
export class LegalResearchComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('startDatePicker') startDatePicker!: ElementRef;
  @ViewChild('endDatePicker') endDatePicker!: ElementRef;

  private destroy$ = new Subject<void>();
  private startDateInstance: any;
  private endDateInstance: any;

  // Search form
  searchForm!: FormGroup;

  searchQuery = '';
  searchType: 'all' | 'statutes' | 'rules' | 'regulations' | 'guidelines' = 'all';
  jurisdiction = 'massachusetts';
  dateRange = 'all';
  isSearching = false;
  searchError = '';

  // Advanced filters
  enableBooleanSearch = false;
  selectedCourtLevels: string[] = [];
  selectedPracticeAreas: string[] = [];
  selectedDocumentTypes: string[] = [];
  startDate: Date | null = null;
  endDate: Date | null = null;

  // Available filter options
  courtLevels = [
    { value: 'SUPERIOR_COURT', label: 'Superior Court' },
    { value: 'DISTRICT_COURT', label: 'District Court' },
    { value: 'PROBATE_FAMILY', label: 'Probate & Family Court' },
    { value: 'LAND_COURT', label: 'Land Court' },
    { value: 'HOUSING_COURT', label: 'Housing Court' },
    { value: 'JUVENILE_COURT', label: 'Juvenile Court' },
    { value: 'APPEALS_COURT', label: 'Appeals Court' },
    { value: 'SJC', label: 'Supreme Judicial Court' }
  ];

  practiceAreas = [
    { value: 'criminal', label: 'Criminal Law' },
    { value: 'family', label: 'Family Law' },
    { value: 'real_estate', label: 'Real Estate' },
    { value: 'civil_litigation', label: 'Civil Litigation' },
    { value: 'immigration', label: 'Immigration' },
    { value: 'intellectual_property', label: 'Intellectual Property' },
    { value: 'employment', label: 'Employment Law' },
    { value: 'corporate', label: 'Corporate Law' }
  ];

  documentTypes = [
    { value: 'statute', label: 'Statutes' },
    { value: 'court_rule', label: 'Court Rules' },
    { value: 'guideline', label: 'Guidelines' },
    { value: 'case', label: 'Cases' },
    { value: 'opinion', label: 'Opinions' },
    { value: 'regulation', label: 'Regulations' }
  ];

  searchResults: SearchResult[] = [];
  savedSearches: SearchHistory[] = [];
  searchHistory: SearchHistory[] = [];
  savedAnalyses: any[] = [];
  currentSearchResponse?: LegalSearchResponse;
  searchSuggestions: string[] = [];
  recentCases: any[] = [];

  // UI state
  showAdvancedFilters = false;
  selectedResult?: SearchResult;
  activeTab: 'search' | 'history' | 'saved' = 'search';
  showDefaultState: boolean = true;

  // Accordion states
  courtSystemExpanded = true;
  quickCitationsExpanded = false;

  constructor(
    private legalResearchService: LegalResearchService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeSearchForm();
  }

  ngOnInit(): void {
    this.loadSavedSearches();
    this.loadSearchHistory();
    this.loadSavedAnalyses();

    // Setup search suggestions
    this.setupSearchSuggestions();
  }

  ngAfterViewInit(): void {
    // Initialize date pickers after view is initialized
    setTimeout(() => {
      this.initializeDatePickers();
    }, 100);
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    // Destroy flatpickr instances
    if (this.startDateInstance) {
      this.startDateInstance.destroy();
    }
    if (this.endDateInstance) {
      this.endDateInstance.destroy();
    }

    // Clean up any remaining modal backdrops
    this.cleanupModalBackdrops();
  }

  private initializeSearchForm(): void {
    this.searchForm = this.fb.group({
      query: [''],
      searchType: ['all'],
      jurisdiction: ['massachusetts'],
      enableBooleanSearch: [false],
      courtLevels: [[]],
      practiceAreas: [[]],
      documentTypes: [[]],
      startDate: [null],
      endDate: [null]
    });

    // Subscribe to form changes
    this.searchForm.get('query')?.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(query => {
        this.searchQuery = query;
        if (query && query.length >= 2) {
          this.getSearchSuggestions(query);
        }
      });
  }

  private initializeDatePickers(): void {
    // Initialize start date picker
    if (this.startDatePicker) {
      this.startDateInstance = flatpickr(this.startDatePicker.nativeElement, {
        dateFormat: 'Y-m-d',
        maxDate: 'today',
        onChange: (selectedDates) => {
          this.startDate = selectedDates[0] || null;
          this.searchForm.patchValue({ startDate: this.startDate });
        }
      });
    }

    // Initialize end date picker
    if (this.endDatePicker) {
      this.endDateInstance = flatpickr(this.endDatePicker.nativeElement, {
        dateFormat: 'Y-m-d',
        maxDate: 'today',
        onChange: (selectedDates) => {
          this.endDate = selectedDates[0] || null;
          this.searchForm.patchValue({ endDate: this.endDate });
        }
      });
    }
  }

  performSearch(): void {
    const formValue = this.searchForm.value;
    const query = formValue.query || this.searchQuery;

    const validation = this.legalResearchService.validateSearchQuery(query);
    if (!validation.isValid) {
      this.searchError = validation.message || 'Invalid search query';
      return;
    }

    this.isSearching = true;
    this.searchError = '';
    this.searchResults = [];
    this.showDefaultState = false;

    // Build advanced search request
    const searchRequest: any = {
      query: query.trim(),
      searchType: this.mapSearchTypeToBackend(formValue.searchType || this.searchType),
      jurisdiction: formValue.jurisdiction || this.jurisdiction,
      enableBooleanSearch: formValue.enableBooleanSearch,
      courtLevels: formValue.courtLevels,
      practiceAreas: formValue.practiceAreas,
      documentTypes: formValue.documentTypes,
      startDate: formValue.startDate,
      endDate: formValue.endDate
    };

    this.legalResearchService.performSearch(searchRequest)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: LegalSearchResponse) => {
          this.isSearching = false;
          if (response.success) {
            this.currentSearchResponse = response;
            this.searchResults = response.results;
            this.showAllFederalRegisterSources = false; // Reset view state for new search

            // Save search to localStorage for history fallback
            this.saveSearchToLocalStorage(searchRequest, response);

            this.loadSearchHistory(); // Refresh search history

            // Trigger change detection for modal updates
            this.cdr.detectChanges();

            // If AI analysis is available, auto-show modal after a short delay
            if (response.aiAnalysis) {
              setTimeout(() => {
                const modal = document.getElementById('aiAnalysisModal');
                if (modal && (window as any).bootstrap) {
                  const modalInstance = new (window as any).bootstrap.Modal(modal);
                  modalInstance.show();
                }
              }, 500);
            }
          } else {
            this.searchError = response.error || 'Search failed';
          }
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.isSearching = false;
          this.searchError = 'An error occurred while searching. Please try again.';
          console.error('Search error:', error);
          this.cdr.detectChanges();
        }
      });
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchResults = [];
    this.currentSearchResponse = undefined;
    this.searchError = '';
    this.legalResearchService.resetSearchState();
  }

  saveSearch(): void {
    if (!this.currentSearchResponse || !this.searchResults.length) return;

    // Find the most recent search in history that matches current query
    const recentSearch = this.searchHistory.find(h =>
      h.searchQuery.toLowerCase() === this.searchQuery.toLowerCase()
    );

    if (recentSearch) {
      this.legalResearchService.saveSearch(recentSearch.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadSavedSearches(); // Refresh saved searches
            // Could add a success message here
          },
          error: (error) => {
            console.error('Error saving search:', error);
            // Could add an error message here
          }
        });
    }
  }

  loadSavedSearch(search: SearchHistory): void {
    this.searchQuery = search.searchQuery;
    this.searchType = 'all'; // Default to 'all' for safety
    this.performSearch();
  }

  deleteSavedSearch(searchId: number): void {
    this.legalResearchService.deleteSearchHistory(searchId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadSavedSearches(); // Refresh saved searches
          this.loadSearchHistory(); // Refresh search history
        },
        error: (error) => {
          console.error('Error deleting search:', error);
        }
      });
  }

  // New methods for real backend integration
  private loadSavedSearches(): void {
    this.legalResearchService.getSavedSearches()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (searches) => {
          this.savedSearches = searches;
        },
        error: (error) => {
          console.error('Error loading saved searches:', error);
          this.savedSearches = [];
        }
      });
  }

  private loadSearchHistory(): void {
    this.legalResearchService.getSearchHistory(undefined, 20)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (history) => {
          this.searchHistory = history;
        },
        error: (error) => {
          console.error('Error loading search history:', error);
          // Fallback to localStorage if backend is not available
          try {
            const localHistory = JSON.parse(localStorage.getItem('legalSearchHistory') || '[]');
            this.searchHistory = localHistory;
          } catch (e) {
            this.searchHistory = [];
          }
        }
      });
  }

  private loadSavedAnalyses(): void {
    try {
      const savedAnalyses = JSON.parse(localStorage.getItem('savedLegalAnalyses') || '[]');
      this.savedAnalyses = savedAnalyses.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      console.error('Error loading saved analyses:', error);
      this.savedAnalyses = [];
    }
  }

  private setupSearchSuggestions(): void {
    // Set up search suggestions with debouncing
    const searchInput$ = new Subject<string>();

    searchInput$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      if (query.length >= 2) {
        this.legalResearchService.getSearchSuggestions(query)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (suggestions) => {
              this.searchSuggestions = suggestions;
            },
            error: (error) => {
              console.error('Error getting suggestions:', error);
              this.searchSuggestions = [];
            }
          });
      } else {
        this.searchSuggestions = [];
      }
    });
  }

  private getSearchSuggestions(query: string): void {
    if (query.length >= 2) {
      this.legalResearchService.getSearchSuggestions(query)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (suggestions) => {
            this.searchSuggestions = suggestions;
          },
          error: (error) => {
            console.error('Error getting suggestions:', error);
            this.searchSuggestions = [];
          }
        });
    } else {
      this.searchSuggestions = [];
    }
  }

  // UI helper methods
  selectResult(result: SearchResult): void {
    this.selectedResult = result;
  }

  toggleAdvancedFilters(): void {
    this.showAdvancedFilters = !this.showAdvancedFilters;
  }

  toggleCourtSystemAccordion(): void {
    this.courtSystemExpanded = !this.courtSystemExpanded;
  }

  toggleQuickCitationsAccordion(): void {
    this.quickCitationsExpanded = !this.quickCitationsExpanded;
  }

  getResultTypeIcon(type: string): string {
    return this.legalResearchService.getResultTypeIcon(type);
  }

  getResultTypeBadgeClass(type: string): string {
    return this.legalResearchService.getResultTypeBadgeClass(type);
  }

  formatResultType(type: string): string {
    return this.legalResearchService.formatResultType(type);
  }

  formatSearchDate(dateString: string): string {
    return this.legalResearchService.formatSearchDate(dateString);
  }

  showAllFederalRegisterSources = false;

  getFederalRegisterSources(): any[] {
    if (!this.searchResults) return [];
    return this.searchResults.filter(result => result.source === 'Federal Register');
  }

  getFederalRegisterSourcesDisplay(): any[] {
    const sources = this.getFederalRegisterSources();
    return this.showAllFederalRegisterSources ? sources : sources.slice(0, 4);
  }

  toggleFederalRegisterSources(): void {
    this.showAllFederalRegisterSources = !this.showAllFederalRegisterSources;
  }

  // Helper method for user notifications
  private showNotification(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
    // Create a temporary notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = `
      top: 20px;
      right: 20px;
      z-index: 1060;
      min-width: 300px;
      max-width: 500px;
    `;

    const icon = type === 'success' ? 'ri-check-line' :
                 type === 'error' ? 'ri-error-warning-line' :
                 type === 'warning' ? 'ri-alert-line' : 'ri-information-line';

    notification.innerHTML = `
      <i class="${icon} me-2"></i>${message}
      <button type="button" class="btn-close" aria-label="Close"></button>
    `;

    // Add to document
    document.body.appendChild(notification);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 4000);

    // Handle close button click
    const closeBtn = notification.querySelector('.btn-close');
    closeBtn?.addEventListener('click', () => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    });
  }

  // Generate comprehensive PDF document
  private generatePDFDocument(): void {
    if (!this.currentSearchResponse) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const lineHeight = 7;
    let yPosition = margin;

    // Helper function to convert markdown to plain text
    const markdownToText = (markdown: string): string => {
      if (!markdown) return '';

      let text = markdown
        // Remove markdown headers
        .replace(/#{1,6}\s+(.+)/g, '$1')
        // Convert bold text
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/__(.+?)__/g, '$1')
        // Convert italic text
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/_(.+?)_/g, '$1')
        // Convert code blocks
        .replace(/```[\s\S]*?```/g, '[Code Block]')
        .replace(/`(.+?)`/g, '$1')
        // Convert lists
        .replace(/^\s*[-*+]\s+(.+)/gm, '• $1')
        .replace(/^\s*\d+\.\s+(.+)/gm, '$1')
        // Convert links
        .replace(/\[(.+?)\]\(.+?\)/g, '$1')
        // Remove extra whitespace and normalize line breaks
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      return text;
    };

    // Helper function to add text with automatic wrapping and page breaks
    const addText = (text: string, fontSize: number = 10, style: 'normal' | 'bold' = 'normal'): void => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', style);

      const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);

      for (const line of lines) {
        if (yPosition > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }
        doc.text(line, margin, yPosition);
        yPosition += lineHeight;
      }
    };

    const addSection = (title: string, content: string): void => {
      // Add some spacing before sections (except first)
      if (yPosition > margin + 10) {
        yPosition += 5;
      }

      // Add section title
      addText(title, 14, 'bold');
      yPosition += 3;

      // Add section content (convert markdown to plain text)
      const plainTextContent = markdownToText(content);
      addText(plainTextContent, 10, 'normal');
      yPosition += 5;
    };

    const timestamp = new Date().toLocaleString();

    // Header
    doc.setFillColor(41, 128, 185);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('LEGAL RESEARCH ANALYSIS REPORT', pageWidth / 2, 20, { align: 'center' });

    yPosition = 45;
    doc.setTextColor(0, 0, 0);

    // Generated info
    addText(`Generated: ${timestamp}`, 10);
    addText('Generated by: Claude AI Legal Research Assistant', 10);
    yPosition += 10;

    // Search Details Section
    const searchDetails = [
      `Query: ${this.currentSearchResponse.searchQuery}`,
      `Search Type: ${this.currentSearchResponse.searchType}`,
      `Jurisdiction: ${this.currentSearchResponse.jurisdiction}`,
      `Total Results: ${this.currentSearchResponse.totalResults}`
    ].join('\n');

    addSection('SEARCH DETAILS', searchDetails);

    // AI Analysis Section (moved before Federal Register Sources)
    addSection('AI LEGAL ANALYSIS', this.currentSearchResponse.aiAnalysis);

    // Federal Register Sources (moved to end, before disclaimer)
    const federalRegisterSources = this.getFederalRegisterSources();
    if (federalRegisterSources.length > 0) {
      let sourcesContent = '';
      federalRegisterSources.forEach((doc, index) => {
        sourcesContent += `${index + 1}. ${doc.title}\n`;
        sourcesContent += `   Document Number: ${doc.documentNumber}\n`;
        sourcesContent += `   Type: ${doc.documentType}\n`;
        sourcesContent += `   Publication Date: ${doc.publicationDate}\n`;
        if (doc.agencies && doc.agencies.length > 0) {
          sourcesContent += `   Agencies: ${doc.agencies.join(', ')}\n`;
        }
        sourcesContent += `   HTML URL: ${doc.htmlUrl}\n`;
        if (doc.pdfUrl) {
          sourcesContent += `   PDF URL: ${doc.pdfUrl}\n`;
        }
        sourcesContent += '\n';
      });

      addSection('FEDERAL REGISTER SOURCES', sourcesContent);
    }

    // Disclaimer Section
    const disclaimer = [
      'This analysis is generated by AI and should be reviewed by a licensed attorney.',
      'This is not legal advice and should not be relied upon as such.',
      'Always verify information with primary sources and current law.'
    ].join('\n');

    // Add disclaimer in a highlighted box
    yPosition += 5;
    const disclaimerHeight = 25;
    if (yPosition + disclaimerHeight > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setDrawColor(255, 165, 0);
    doc.setFillColor(255, 248, 220);
    doc.rect(margin, yPosition, pageWidth - 2 * margin, disclaimerHeight, 'FD');

    yPosition += 5;
    doc.setTextColor(150, 75, 0);
    addText('DISCLAIMER', 12, 'bold');
    doc.setTextColor(0, 0, 0);
    addText(disclaimer, 9);

    // Save the PDF
    const fileName = `legal-analysis-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }

  // New methods for advanced filters
  toggleFilter(filterType: string, value: string): void {
    const formControl = this.searchForm.get(filterType);
    if (!formControl) return;

    const currentValues = formControl.value as string[];
    const index = currentValues.indexOf(value);

    if (index > -1) {
      currentValues.splice(index, 1);
    } else {
      currentValues.push(value);
    }

    formControl.setValue(currentValues);
  }

  isFilterSelected(filterType: string, value: string): boolean {
    const formControl = this.searchForm.get(filterType);
    if (!formControl) return false;
    const values = formControl.value as string[];
    return values.includes(value);
  }

  clearFilters(): void {
    this.searchForm.patchValue({
      courtLevels: [],
      practiceAreas: [],
      documentTypes: [],
      startDate: null,
      endDate: null,
      enableBooleanSearch: false
    });

    // Clear date pickers
    if (this.startDateInstance) {
      this.startDateInstance.clear();
    }
    if (this.endDateInstance) {
      this.endDateInstance.clear();
    }

    this.startDate = null;
    this.endDate = null;
  }

  applySuggestion(suggestion: string): void {
    this.searchForm.patchValue({ query: suggestion });
    this.searchQuery = suggestion;
    this.searchSuggestions = [];
  }

  getBooleanSearchHelp(): string {
    return `Boolean Search Operators:
    • AND - Both terms must be present
    • OR - Either term must be present
    • NOT - Exclude term from results
    • "phrase" - Search for exact phrase
    Example: "contract law" AND enforcement NOT liability`;
  }

  getActiveFiltersCount(): number {
    const formValue = this.searchForm.value;
    let count = 0;

    if (formValue.courtLevels?.length > 0) count += formValue.courtLevels.length;
    if (formValue.practiceAreas?.length > 0) count += formValue.practiceAreas.length;
    if (formValue.documentTypes?.length > 0) count += formValue.documentTypes.length;
    if (formValue.startDate) count++;
    if (formValue.endDate) count++;
    if (formValue.enableBooleanSearch) count++;

    return count;
  }

  setTab(tab: 'search' | 'history' | 'saved'): void {
    this.activeTab = tab;
  }

  performQuickSearch(query: string): void {
    this.searchForm.patchValue({ query: query });
    this.searchQuery = query;
    this.performSearch();
  }

  fillSearchInput(query: string): void {
    // Only fill the search input without executing the search
    this.searchForm.patchValue({ query: query });
    this.searchQuery = query;

    // Focus on the search input for user convenience
    setTimeout(() => {
      const searchInput = document.querySelector('.form-control[formControlName="query"]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
        // Position cursor at the end of the text
        searchInput.setSelectionRange(query.length, query.length);
      }
    }, 100);
  }

  // New methods for enhanced features
  analysisTime: number = 0;

  showSearchHelp(): void {
    // Open the search guide modal
    const modal = document.getElementById('searchGuideModal');
    if (modal && (window as any).bootstrap) {
      const modalInstance = new (window as any).bootstrap.Modal(modal);
      modalInstance.show();
    }
  }

  resetSearch(): void {
    this.searchForm.reset({
      query: '',
      searchType: 'all',
      jurisdiction: 'massachusetts',
      enableBooleanSearch: false,
      courtLevels: [],
      practiceAreas: [],
      documentTypes: [],
      startDate: null,
      endDate: null
    });
    this.clearSearch();
  }

  saveFilterPreset(): void {
    const filters = this.searchForm.value;
    localStorage.setItem('legalSearchFilters', JSON.stringify(filters));
    console.log('Filters saved');
  }

  applyFilters(): void {
    this.showAdvancedFilters = false;
    this.performSearch();
  }

  saveCurrentFilters(): void {
    this.saveFilterPreset();
  }

  saveSearchToLibrary(history: SearchHistory): void {
    this.legalResearchService.saveSearch(history.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadSavedSearches();
        },
        error: (error) => {
          console.error('Error saving search:', error);
        }
      });
  }

  removeFromSaved(searchId: number): void {
    this.deleteSavedSearch(searchId);
  }

  useTemplate(templateType: string): void {
    const templates: { [key: string]: string } = {
      'contract': 'breach of contract AND damages Massachusetts',
      'criminal': 'criminal procedure Massachusetts sentencing guidelines',
      'family': 'family law divorce custody Massachusetts'
    };

    if (templates[templateType]) {
      this.searchForm.patchValue({ query: templates[templateType] });
      this.searchQuery = templates[templateType];
      this.performSearch();
    }
  }

  copyAIAnalysis(): void {
    if (this.currentSearchResponse?.aiAnalysis) {
      // Copy the raw markdown text (clean version)
      const analysisText = this.currentSearchResponse.aiAnalysis;

      navigator.clipboard.writeText(analysisText).then(() => {
        // Show success message
        this.showNotification('Analysis copied to clipboard!', 'success');
      }).catch((err) => {
        console.error('Failed to copy text: ', err);
        this.showNotification('Failed to copy analysis', 'error');
      });
    } else {
      this.showNotification('No analysis available to copy', 'warning');
    }
  }

  exportAIAnalysis(): void {
    if (!this.currentSearchResponse?.aiAnalysis) {
      this.showNotification('No analysis available to export', 'warning');
      return;
    }

    try {
      this.generatePDFDocument();
      this.showNotification('Analysis exported successfully!', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      this.showNotification('Failed to export analysis', 'error');
    }
  }

  saveAnalysis(): void {
    if (!this.currentSearchResponse?.aiAnalysis) {
      this.showNotification('No analysis available to save', 'warning');
      return;
    }

    try {
      // Create analysis data object
      const analysisData = {
        id: Date.now().toString(),
        query: this.currentSearchResponse.searchQuery,
        analysis: this.currentSearchResponse.aiAnalysis,
        results: this.searchResults.length,
        timestamp: new Date().toISOString(),
        searchType: this.currentSearchResponse.searchType,
        jurisdiction: this.currentSearchResponse.jurisdiction
      };

      // Save to localStorage
      const savedAnalyses = JSON.parse(localStorage.getItem('savedLegalAnalyses') || '[]');
      savedAnalyses.push(analysisData);

      // Keep only the last 50 analyses
      const recentAnalyses = savedAnalyses.slice(-50);
      localStorage.setItem('savedLegalAnalyses', JSON.stringify(recentAnalyses));

      // Refresh the saved analyses list
      this.loadSavedAnalyses();

      this.showNotification('Analysis saved successfully!', 'success');
    } catch (error) {
      console.error('Save failed:', error);
      this.showNotification('Failed to save analysis', 'error');
    }
  }

  regenerateAnalysis(): void {
    if (!this.searchQuery || this.searchQuery.trim() === '') {
      this.showNotification('No search query available to regenerate', 'warning');
      return;
    }

    try {
      // Show loading state
      this.showNotification('Regenerating analysis...', 'info');

      // Perform the search again
      this.performSearch();
    } catch (error) {
      console.error('Regeneration failed:', error);
      this.showNotification('Failed to regenerate analysis', 'error');
    }
  }

  addToNotebook(result: SearchResult): void {
    console.log('Adding to research notebook:', result.title);
    // Implementation for adding to notebook
  }

  citationHelper(result: SearchResult): void {
    console.log('Generating citation for:', result.title);
    // Implementation for citation generation
  }

  findSimilar(result: SearchResult): void {
    this.searchQuery = `similar to "${result.title}"`;
    this.performSearch();
  }

  focusSearchInput(): void {
    const searchInput = document.querySelector('.form-control[formControlName="query"]') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
    }
  }

  showTour(): void {
    console.log('Starting tour');
    // Implementation for tour
  }

  showVideoGuide(): void {
    console.log('Showing video guide');
    // Implementation for video guide
  }

  showSearchGuide(): void {
    // Open the search guide modal
    const modal = document.getElementById('searchGuideModal');
    if (modal && (window as any).bootstrap) {
      const modalInstance = new (window as any).bootstrap.Modal(modal);
      modalInstance.show();
    }
  }

  showExampleQueries(): void {
    // Open the examples modal
    const modal = document.getElementById('examplesModal');
    if (modal && (window as any).bootstrap) {
      const modalInstance = new (window as any).bootstrap.Modal(modal);
      modalInstance.show();
    }
  }

  loadExampleSearches(): void {
    // Load example searches
    this.searchSuggestions = [
      'Massachusetts consumer protection 93A',
      'landlord tenant eviction process',
      'criminal sentencing guidelines',
      'employment discrimination claims',
      'family law custody factors'
    ];
  }

  // Modal cleanup methods
  closeAIAnalysisModal(): void {
    // Close the modal programmatically
    const modalElement = document.getElementById('aiAnalysisModal');
    if (modalElement) {
      // Remove modal classes and attributes
      modalElement.classList.remove('show');
      modalElement.style.display = 'none';
      modalElement.setAttribute('aria-hidden', 'true');
      modalElement.removeAttribute('aria-modal');
      modalElement.removeAttribute('role');

      // Remove modal-open class from body
      document.body.classList.remove('modal-open');

      // Clean up modal backdrop
      this.cleanupModalBackdrops();
    }
  }

  cleanupModalBackdrops(): void {
    // Remove any remaining modal backdrops
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(backdrop => {
      backdrop.remove();
    });

    // Reset body styles
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';

    // Remove modal-open class if still present
    document.body.classList.remove('modal-open');
  }

  // Event handler for modal hidden event
  onModalHidden(): void {
    this.cleanupModalBackdrops();
  }

  // Methods for saved analyses
  loadSavedAnalysis(savedAnalysis: any): void {
    // Create a mock response to display the saved analysis
    const mockResponse: LegalSearchResponse = {
      success: true,
      results: [],
      totalResults: savedAnalysis.results,
      searchQuery: savedAnalysis.query,
      searchType: savedAnalysis.searchType,
      jurisdiction: savedAnalysis.jurisdiction,
      aiAnalysis: savedAnalysis.analysis,
      hasAIAnalysis: true
    };

    this.currentSearchResponse = mockResponse;
    this.searchQuery = savedAnalysis.query;

    // Show the analysis modal
    setTimeout(() => {
      const modal = document.getElementById('aiAnalysisModal');
      if (modal && (window as any).bootstrap) {
        const modalInstance = new (window as any).bootstrap.Modal(modal);
        modalInstance.show();
      }
    }, 100);

    this.showNotification('Saved analysis loaded successfully!', 'success');
  }

  rerunSavedAnalysis(savedAnalysis: any): void {
    this.searchQuery = savedAnalysis.query;
    this.searchForm.patchValue({
      query: savedAnalysis.query,
      searchType: savedAnalysis.searchType || 'all',
      jurisdiction: savedAnalysis.jurisdiction || 'massachusetts'
    });
    this.performSearch();
    this.showNotification('Re-running analysis...', 'info');
  }

  deleteSavedAnalysis(analysisId: string): void {
    try {
      const savedAnalyses = JSON.parse(localStorage.getItem('savedLegalAnalyses') || '[]');
      const filteredAnalyses = savedAnalyses.filter((analysis: any) => analysis.id !== analysisId);
      localStorage.setItem('savedLegalAnalyses', JSON.stringify(filteredAnalyses));

      // Refresh the saved analyses list
      this.loadSavedAnalyses();

      this.showNotification('Analysis deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting saved analysis:', error);
      this.showNotification('Failed to delete analysis', 'error');
    }
  }

  // Save search history to localStorage as fallback
  private saveSearchToLocalStorage(searchRequest: any, response: LegalSearchResponse): void {
    try {
      const historyItem = {
        id: Date.now(),
        searchQuery: searchRequest.query,
        queryType: searchRequest.searchType || 'all',
        searchFilters: JSON.stringify({
          jurisdiction: searchRequest.jurisdiction,
          courtLevels: searchRequest.courtLevels,
          practiceAreas: searchRequest.practiceAreas,
          documentTypes: searchRequest.documentTypes,
          startDate: searchRequest.startDate,
          endDate: searchRequest.endDate
        }),
        resultsCount: response.totalResults,
        executionTimeMs: response.executionTimeMs || 0,
        searchedAt: new Date().toISOString(),
        isSaved: false,
        jurisdiction: searchRequest.jurisdiction || 'massachusetts'
      };

      // Get existing history from localStorage
      const existingHistory = JSON.parse(localStorage.getItem('legalSearchHistory') || '[]');

      // Add new item to the beginning
      existingHistory.unshift(historyItem);

      // Keep only the last 50 searches
      const recentHistory = existingHistory.slice(0, 50);

      // Save back to localStorage
      localStorage.setItem('legalSearchHistory', JSON.stringify(recentHistory));
    } catch (error) {
      console.error('Error saving search history to localStorage:', error);
    }
  }

  // Map frontend search type values to backend enum values
  private mapSearchTypeToBackend(frontendType: string): string {
    const mapping: { [key: string]: string } = {
      'all': 'ALL',
      'statutes': 'STATUTES',
      'case_law': 'CASE_LAW',
      'rules': 'RULES',
      'regulations': 'REGULATIONS',
      'guidelines': 'GUIDELINES'
    };

    return mapping[frontendType] || 'ALL';
  }
}