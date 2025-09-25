import { Component, OnInit, OnDestroy, ViewChild, ElementRef, CUSTOM_ELEMENTS_SCHEMA, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import flatpickr from 'flatpickr';
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
export class LegalResearchComponent implements OnInit, OnDestroy {
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
  currentSearchResponse?: LegalSearchResponse;
  searchSuggestions: string[] = [];
  recentCases: any[] = [];

  // UI state
  showAdvancedFilters = false;
  selectedResult?: SearchResult;
  activeTab: 'search' | 'history' | 'saved' = 'search';
  showDefaultState: boolean = true;

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

    // Setup search suggestions
    this.setupSearchSuggestions();

    // Initialize date pickers after view init
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
      searchType: formValue.searchType || this.searchType,
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
          this.searchHistory = [];
        }
      });
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

  // New methods for enhanced features
  analysisTime: number = 0;

  showSearchHelp(): void {
    // Show search help modal or guide
    console.log('Showing search help');
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
      navigator.clipboard.writeText(this.currentSearchResponse.aiAnalysis);
      console.log('Analysis copied to clipboard');
    }
  }

  exportAIAnalysis(): void {
    console.log('Exporting AI analysis as PDF');
    // Implementation for PDF export
  }

  saveAnalysis(): void {
    console.log('Saving analysis');
    // Implementation for saving analysis
  }

  regenerateAnalysis(): void {
    if (this.searchQuery) {
      this.performSearch();
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
    console.log('Showing search guide');
    // Implementation for search guide
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
}