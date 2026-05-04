import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, OnDestroy, Output, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { NgbModal, NgbModalRef, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TemplateService, Template, TemplateSearchResult } from '../../../services/template.service';
import { AutoFillWizardComponent } from './auto-fill-wizard/auto-fill-wizard.component';
import { TemplateImportWizardComponent } from './template-import-wizard/template-import-wizard.component';
import { ImportCommitResponse, TemplateImportService } from '../../../services/template-import.service';
import { BackgroundTask, BackgroundTaskService } from '../../../services/background-task.service';
import { PRACTICE_AREAS, getPracticeArea, getPracticeAreaName, getJurisdictionByName, getJurisdictionName } from '../../../shared/legal-constants';
import Swal from 'sweetalert2';

interface Category {
  id: string;
  name: string;
  count: number;
}

@Component({
  selector: 'app-template-library',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgbDropdownModule, AutoFillWizardComponent, TemplateImportWizardComponent],
  templateUrl: './template-library.component.html',
  styleUrls: ['./template-library.component.scss']
})
export class TemplateLibraryComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchSubject$ = new Subject<string>();

  @ViewChild('previewModal') previewModal!: TemplateRef<any>;
  @ViewChild('autoFillModal') autoFillModal!: TemplateRef<any>;
  @ViewChild('importModal') importModal!: TemplateRef<any>;
  private previewModalRef?: NgbModalRef;
  private autoFillModalRef?: NgbModalRef;
  private importModalRef?: NgbModalRef;

  // Auto-fill wizard state
  showAutoFillWizard = false;
  selectedTemplateForGeneration: Template | null = null;

  // Import wizard state (Sprint 1.5)
  showImportWizard = false;
  /** When set, the import wizard rehydrates from this existing session instead of starting fresh. */
  importWizardResumeSessionId?: string;

  /** In-flight template-import tasks for the current user. Drives the page-level status banner. */
  activeImportTasks: BackgroundTask[] = [];

  // Sprint 2 — emits generated doc when library is embedded in another component (e.g., LegiSpace modal).
  @Output() templateGenerated = new EventEmitter<any>();

  // Sprint 2.5 — when library is opened from a case context (e.g., LegiSpace modal), pre-filter
  // to that case's practice area + jurisdiction. Accepts slug ('pi') or name ('Personal Injury')
  // for practice area; code ('ma') or name ('Massachusetts') for jurisdiction.
  @Input() presetPracticeArea?: string;
  @Input() presetJurisdiction?: string;

  // Template data
  templates: Template[] = [];
  searchResults: TemplateSearchResult[] = [];
  filteredTemplates: (Template | TemplateSearchResult)[] = [];
  paginatedTemplates: (Template | TemplateSearchResult)[] = [];

  // Statistics
  totalTemplatesCount = 0;
  recentlyUsedCount = 0;
  customTemplatesCount = 0;
  approvedTemplatesCount = 0;
  // Distinct practice areas + jurisdictions actually present in the firm's
  // template library (vs. the static catalog used for filter dropdowns).
  // Used by the "Practice areas" stat card so the count reflects what the
  // firm has, not the global list of supported areas.
  representedPracticeAreasCount = 0;
  representedJurisdictionsCount = 0;

  // Categories from backend
  availableCategories: string[] = [];
  categories: Category[] = [];

  // Practice areas and jurisdictions from service
  practiceAreas: string[] = [];
  jurisdictions: string[] = [];

  // Filter and sort options
  searchQuery = '';
  selectedCategory = '';
  selectedPracticeArea = '';
  selectedJurisdiction = '';
  selectedSource: '' | 'MANUAL' | 'IMPORTED' | 'PRIVATE' = '';
  sortBy = 'name';
  viewMode: 'list' | 'grid' = 'list';

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;

  // Selection
  selectAll = false;

  // Loading and error states
  isLoading = false;
  errorMessage = '';

  // Template being previewed
  selectedPreviewTemplate: Template | null = null;
  previewContent = '';

  // Redesign §3 — first-load "NEW" ring on the jurisdiction select. Dismissed on first
  // interaction and persisted in localStorage so it doesn't reappear next session.
  private static readonly JURISDICTION_RING_KEY = 'tmpl_library_jurisdiction_new_ring_dismissed';
  showJurisdictionNewRing = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private modalService: NgbModal,
    private templateService: TemplateService,
    private templateImportService: TemplateImportService,
    private backgroundTaskService: BackgroundTaskService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeFilters();
    this.loadTemplates();
    this.setupSearch();
    this.loadCategories();
    this.loadStatistics();
    this.cdr.detectChanges();

    // Honor a deep-link from the BackgroundTasksIndicator chip: ?resumeImport=<sessionId> opens
    // the import wizard preloaded with that session so the user can see live progress / the
    // review step without losing context.
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const resumeId = params['resumeImport'];
      if (resumeId && !this.importModalRef) {
        this.importTemplate(resumeId);
        // Strip the query param so a future navigation back to /templates doesn't re-open the wizard.
        this.router.navigate([], { queryParams: { resumeImport: null }, queryParamsHandling: 'merge', replaceUrl: true });
      }
    });

    // Seed any persisted in-flight import jobs so the page banner shows imports started in another
    // tab / session / before a backend redeploy. Best-effort.
    this.templateImportService.seedActiveJobsOnBoot();

    // Drive the in-page banner from BackgroundTaskService — the same source the global
    // indicator uses, so the two never diverge.
    this.backgroundTaskService.tasks$
      .pipe(takeUntil(this.destroy$))
      .subscribe(all => {
        this.activeImportTasks = all.filter(t =>
          t.type === 'template_import' &&
          (t.status === 'running' || t.status === 'pending')
        );
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.previewModalRef?.dismiss();
    this.autoFillModalRef?.dismiss();
    this.importModalRef?.dismiss();
  }

  initializeFilters(): void {
    this.practiceAreas = this.templateService.getPracticeAreas();
    this.jurisdictions = this.templateService.getJurisdictions();
    this.applyPresets();
    try {
      this.showJurisdictionNewRing =
        localStorage.getItem(TemplateLibraryComponent.JURISDICTION_RING_KEY) !== '1';
    } catch {
      this.showJurisdictionNewRing = true;
    }
  }

  dismissJurisdictionNewRing(): void {
    if (!this.showJurisdictionNewRing) return;
    this.showJurisdictionNewRing = false;
    try {
      localStorage.setItem(TemplateLibraryComponent.JURISDICTION_RING_KEY, '1');
    } catch {
      // ignore quota / private-mode errors
    }
  }

  /**
   * Sprint 2.5 — resolve preset inputs (slug/code or display name) to the canonical display
   * names used by the filter dropdowns. The filters compare against `template.practiceArea`
   * and `template.jurisdiction`, which in the DB are stored as display names.
   */
  private applyPresets(): void {
    if (this.presetPracticeArea) {
      const bySlug = getPracticeArea(this.presetPracticeArea);
      const byName = PRACTICE_AREAS.find(p => p.name.toLowerCase() === this.presetPracticeArea!.toLowerCase());
      const match = bySlug ?? byName;
      if (match) this.selectedPracticeArea = match.name;
    }
    if (this.presetJurisdiction) {
      const match = getJurisdictionByName(this.presetJurisdiction);
      if (match) this.selectedJurisdiction = match.name;
    }
  }

  setupSearch(): void {
    this.searchSubject$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(query => {
        this.performSearch(query);
      });
  }

  loadCategories(): void {
    this.templateService.getCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => {
          this.availableCategories = categories;
          this.categories = categories.map(cat => ({
            id: cat.toLowerCase().replace(/_/g, '-'),
            name: this.formatCategoryName(cat),
            count: 0 // Will be updated when templates load
          }));
        },
        error: (error) => {
          console.error('Error loading categories:', error);
        }
      });
  }

  loadTemplates(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.templateService.getTemplates(0, 100) // Load more templates initially
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (templates) => {
          this.templates = templates;
          this.totalTemplatesCount = templates.length;
          this.customTemplatesCount = templates.filter(t => !t.isPublic).length;
          this.approvedTemplatesCount = templates.filter(t => t.isApproved).length;
          // Distinct practice areas / jurisdictions across the firm's templates.
          // Lowercased to dedupe values that differ only in casing ("MA" vs "ma").
          const paSet = new Set<string>();
          const jurSet = new Set<string>();
          templates.forEach(t => {
            if (t.practiceArea && t.practiceArea.trim()) paSet.add(t.practiceArea.trim().toLowerCase());
            if (t.jurisdiction && t.jurisdiction.trim()) jurSet.add(t.jurisdiction.trim().toLowerCase());
          });
          this.representedPracticeAreasCount = paSet.size;
          this.representedJurisdictionsCount = jurSet.size;
          this.updateCategoryCounts();
          this.filterTemplates();
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.errorMessage = 'Failed to load templates. Please try again.';
          this.isLoading = false;
          console.error('Error loading templates:', error);
          this.cdr.detectChanges();
        }
      });
  }

  loadStatistics(): void {
    // Calculate recently used based on usage count
    this.templateService.getTemplates(0, 20)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (templates) => {
          const recentlyUsed = templates.filter(t => t.usageCount && t.usageCount > 0);
          this.recentlyUsedCount = recentlyUsed.length;
        }
      });
  }

  updateCategoryCounts(): void {
    this.categories.forEach(category => {
      const enumValue = category.id.toUpperCase().replace(/-/g, '_');
      category.count = this.templates.filter(t => t.category === enumValue).length;
    });
  }

  formatCategoryName(category: string): string {
    return category.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  onSearchChange(): void {
    this.searchSubject$.next(this.searchQuery);
  }

  performSearch(query: string): void {
    if (!query || query.trim().length === 0) {
      this.searchResults = [];
      this.filterTemplates();
      return;
    }

    this.isLoading = true;
    this.templateService.searchTemplates({ q: query })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results) => {
          this.searchResults = results;
          this.filteredTemplates = results;
          this.updatePagination();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Search error:', error);
          this.isLoading = false;
        }
      });
  }

  filterTemplates(): void {
    let filtered: (Template | TemplateSearchResult)[] = this.searchQuery
      ? [...this.searchResults]
      : [...this.templates];

    // Apply category filter
    if (this.selectedCategory) {
      const categoryEnum = this.selectedCategory.toUpperCase().replace(/-/g, '_');
      filtered = filtered.filter(template => {
        const cat = 'category' in template ? template.category : '';
        return cat === categoryEnum;
      });
    }

    // Apply practice area filter
    if (this.selectedPracticeArea) {
      filtered = filtered.filter(template => {
        const practiceArea = 'practiceArea' in template ? template.practiceArea : '';
        return practiceArea === this.selectedPracticeArea;
      });
    }

    // Apply jurisdiction filter
    if (this.selectedJurisdiction) {
      filtered = filtered.filter(template => {
        const jurisdiction = 'jurisdiction' in template ? template.jurisdiction : '';
        return jurisdiction === this.selectedJurisdiction;
      });
    }

    // Apply source filter (Sprint 1.5)
    if (this.selectedSource) {
      filtered = filtered.filter(template => {
        const src = template.sourceType || 'MANUAL';
        if (this.selectedSource === 'MANUAL')   return src === 'MANUAL';
        if (this.selectedSource === 'IMPORTED') return src !== 'MANUAL';
        if (this.selectedSource === 'PRIVATE')  return !!template.isPrivate;
        return true;
      });
    }

    this.filteredTemplates = filtered;
    this.sortTemplates();
  }

  sortTemplates(): void {
    this.filteredTemplates.sort((a, b) => {
      switch (this.sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'date':
          const dateA = 'updatedAt' in a ? new Date(a.updatedAt || 0).getTime() : 0;
          const dateB = 'updatedAt' in b ? new Date(b.updatedAt || 0).getTime() : 0;
          return dateB - dateA;
        case 'usage':
          const usageA = 'usageCount' in a ? (a.usageCount || 0) : 0;
          const usageB = 'usageCount' in b ? (b.usageCount || 0) : 0;
          return usageB - usageA;
        case 'rating':
          const ratingA = 'averageRating' in a ? (a.averageRating || 0) : 0;
          const ratingB = 'averageRating' in b ? (b.averageRating || 0) : 0;
          return ratingB - ratingA;
        default:
          return 0;
      }
    });

    this.updatePagination();
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredTemplates.length / this.itemsPerPage);
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }

    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.paginatedTemplates = this.filteredTemplates.slice(start, end);
  }

  // Pagination methods
  getPaginationStart(): number {
    if (this.filteredTemplates.length === 0) return 0;
    return (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  getPaginationEnd(): number {
    const end = this.currentPage * this.itemsPerPage;
    return Math.min(end, this.filteredTemplates.length);
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPages = 5;
    let start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, start + maxPages - 1);

    if (end - start < maxPages - 1) {
      start = Math.max(1, end - maxPages + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  // Selection methods
  toggleSelectAll(): void {
    this.paginatedTemplates.forEach((template: any) => {
      template.selected = this.selectAll;
    });
  }

  get selectedCount(): number {
    return this.paginatedTemplates.filter((t: any) => t.selected).length;
  }

  clearSelection(): void {
    this.selectAll = false;
    this.paginatedTemplates.forEach((t: any) => { t.selected = false; });
  }

  bulkDeleteSelected(): void {
    const selected = this.paginatedTemplates.filter((t: any) => t.selected) as any[];
    if (selected.length === 0) return;

    const nameList = selected.slice(0, 3).map(t => `&nbsp;&bull; ${t.name}`).join('<br>');
    const extra = selected.length > 3 ? `<br><em class="text-muted">…and ${selected.length - 3} more</em>` : '';

    Swal.fire({
      title: `Delete ${selected.length} template${selected.length === 1 ? '' : 's'}?`,
      html: `<div class="text-start">${nameList}${extra}<br><br>This action cannot be undone.</div>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f06548',
      cancelButtonColor: '#74788d',
      confirmButtonText: `Delete ${selected.length}`,
      reverseButtons: true
    }).then((result) => {
      if (!result.isConfirmed) return;

      const ids = selected.map(t => t.id).filter((id): id is number => typeof id === 'number');
      if (ids.length === 0) return;

      forkJoin(ids.map(id => this.templateService.deleteTemplate(id)))
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            Swal.fire({
              title: 'Deleted',
              text: `${ids.length} template${ids.length === 1 ? '' : 's'} removed from your library.`,
              icon: 'success',
              timer: 2200,
              showConfirmButton: false,
              toast: true,
              position: 'top-end'
            });
            this.clearSelection();
            this.loadTemplates();
            this.cdr.detectChanges();
          },
          error: (error) => {
            Swal.fire({
              title: 'Error',
              text: 'One or more templates failed to delete. Please try again.',
              icon: 'error',
              confirmButtonColor: '#405189'
            });
            console.error('Bulk delete error:', error);
            this.loadTemplates();
            this.cdr.detectChanges();
          }
        });
    });
  }

  // Template actions
  createNewTemplate(): void {
    this.router.navigate(['/legal/ai-assistant/templates/new']);
  }

  editTemplate(template: Template | TemplateSearchResult): void {
    if ('id' in template && template.id) {
      this.router.navigate(['/legal/ai-assistant/templates/edit', template.id]);
    }
  }

  displayPracticeArea(template: Template | TemplateSearchResult): string {
    const raw = (template as any).practiceArea;
    if (!raw) return '';
    return getPracticeAreaName(raw) || raw;
  }

  displayJurisdiction(template: Template | TemplateSearchResult): string {
    const raw = (template as any).jurisdiction;
    if (!raw) return '';
    return getJurisdictionName(raw) || raw;
  }

  duplicateTemplate(template: Template | TemplateSearchResult): void {
    Swal.fire({
      title: 'Duplicate Template',
      text: 'Enter a name for the duplicated template:',
      input: 'text',
      inputValue: `Copy of ${template.name}`,
      showCancelButton: true,
      confirmButtonColor: '#405189',
      cancelButtonColor: '#74788d',
      confirmButtonText: 'Duplicate',
      inputValidator: (value) => {
        if (!value) {
          return 'Please enter a name';
        }
        return null;
      }
    }).then((result) => {
      if (result.isConfirmed && 'id' in template && template.id) {
        this.templateService.duplicateTemplate(template.id, result.value)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              Swal.fire({
                title: 'Success!',
                text: 'Template duplicated successfully.',
                icon: 'success',
                confirmButtonColor: '#405189'
              });
              this.loadTemplates();
              this.cdr.detectChanges();
            },
            error: (error) => {
              Swal.fire({
                title: 'Error!',
                text: 'Failed to duplicate template.',
                icon: 'error',
                confirmButtonColor: '#405189'
              });
              console.error('Duplication error:', error);
              this.cdr.detectChanges();
            }
          });
      }
    });
  }

  async previewTemplate(template: Template | TemplateSearchResult): Promise<void> {
    if (!('id' in template) || !template.id) return;

    this.isLoading = true;
    this.templateService.getTemplate(template.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (fullTemplate) => {
          this.selectedPreviewTemplate = fullTemplate;
          this.previewContent = fullTemplate.templateContent || 'No content available';
          this.previewModalRef = this.modalService.open(this.previewModal, {
            size: 'lg',
            centered: true
          });
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading template:', error);
          this.isLoading = false;
          Swal.fire({
            title: 'Error!',
            text: 'Failed to load template preview.',
            icon: 'error',
            confirmButtonColor: '#405189'
          });
        }
      });
  }

  closePreview(): void {
    this.previewModalRef?.dismiss();
    this.previewModalRef = undefined;
    this.selectedPreviewTemplate = null;
    this.previewContent = '';
  }

  shareTemplate(template: Template | TemplateSearchResult): void {
    Swal.fire({
      title: 'Share Template',
      text: 'Enter email addresses to share this template (comma separated):',
      input: 'text',
      inputPlaceholder: 'email1@example.com, email2@example.com',
      showCancelButton: true,
      confirmButtonColor: '#405189',
      cancelButtonColor: '#74788d',
      confirmButtonText: 'Share',
      inputValidator: (value) => {
        if (!value) {
          return 'Please enter at least one email address';
        }
        const emails = value.split(',').map(e => e.trim());
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        for (const email of emails) {
          if (!emailRegex.test(email)) {
            return `Invalid email: ${email}`;
          }
        }
        return null;
      }
    }).then((result) => {
      if (result.isConfirmed) {
        // TODO: Implement sharing functionality
        Swal.fire({
          title: 'Shared!',
          text: 'Template has been shared successfully.',
          icon: 'success',
          confirmButtonColor: '#405189'
        });
      }
    });
  }

  deleteTemplate(template: Template | TemplateSearchResult): void {
    if (!('id' in template) || !template.id) return;

    Swal.fire({
      title: 'Are you sure?',
      text: `You want to delete "${template.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f06548',
      cancelButtonColor: '#74788d',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed && template.id) {
        this.templateService.deleteTemplate(template.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              Swal.fire({
                title: 'Deleted!',
                text: 'Template has been deleted.',
                icon: 'success',
                confirmButtonColor: '#405189'
              });
              this.loadTemplates();
              this.cdr.detectChanges();
            },
            error: (error) => {
              Swal.fire({
                title: 'Error!',
                text: 'Failed to delete template.',
                icon: 'error',
                confirmButtonColor: '#405189'
              });
              console.error('Delete error:', error);
              this.cdr.detectChanges();
            }
          });
      }
    });
  }

  /**
   * Single navigation entry point for "use this template." Routes to the
   * dedicated TemplateFillerComponent at /legal/ai-assistant/templates/fill/:id
   * so the attorney gets the full document-preview-with-side-panel experience.
   *
   * Replaces the previous modal-based auto-fill wizard. Called by:
   *   - the Use→ button on each row in the library
   *   - "Use Template" button inside the preview modal (via useTemplateFromPreview)
   *   - quickGenerate(), generateFromSelected()
   */
  useTemplate(template: Template | TemplateSearchResult): void {
    if (!('id' in template) || !template.id) return;
    this.router.navigate(['/legal/ai-assistant/templates/fill', template.id]);
  }

  // Preview → Use Template handoff. Capture the template locally BEFORE dismissing
  // the preview modal (which nulls selectedPreviewTemplate), then open the wizard.
  useTemplateFromPreview(): void {
    const template = this.selectedPreviewTemplate;
    if (!template) return;
    this.closePreview();
    this.useTemplate(template);
  }

  onDocumentGenerated(event: any): void {
    // Handle the generated document
    if (event.content) {
      // Don't close the modal - let the user see the generated document in step 4
      // The wizard will show the generated content and provide download/copy options

      // Show a toast notification to indicate success
      Swal.fire({
        title: 'Document Generated!',
        text: 'Your document has been generated successfully. You can now review, download, or copy it.',
        icon: 'success',
        timer: 3000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });

      // Sprint 2 — pass through to parent (e.g., LegiSpace) so it can load content into its editor.
      this.templateGenerated.emit(event);
      this.cdr.detectChanges();
    }
  }

  onAutoFillWizardClosed(): void {
    this.showAutoFillWizard = false;
    this.selectedTemplateForGeneration = null;
    this.autoFillModalRef?.close();
    this.autoFillModalRef = undefined;
  }

  // Quick generate using modal (existing functionality)
  quickGenerate(template: Template | TemplateSearchResult): void {
    this.useTemplate(template);
  }

  // Generate from selected template in the list
  generateFromSelected(): void {
    const selectedTemplate = this.paginatedTemplates.find((t: any) => t.selected);
    if (selectedTemplate) {
      this.quickGenerate(selectedTemplate);
    }
  }

  // Check if any templates are selected
  hasSelectedTemplates(): boolean {
    return this.paginatedTemplates.some((t: any) => t.selected);
  }

  importTemplate(resumeSessionId?: string): void {
    // Guard against rapid double-clicks opening multiple modal instances.
    if (this.importModalRef) return;
    this.importWizardResumeSessionId = resumeSessionId;
    this.showImportWizard = true;
    if (this.importModal) {
      this.importModalRef = this.modalService.open(this.importModal, {
        size: 'xl',
        centered: true,
        backdrop: 'static',
        keyboard: false
      });
      // Clear the ref on any modal-close path (ESC, backdrop click, programmatic close).
      this.importModalRef.result.finally(() => {
        this.importModalRef = undefined;
        this.showImportWizard = false;
        this.importWizardResumeSessionId = undefined;
      });
    }
  }

  onImportCompleted(_result: ImportCommitResponse): void {
    // Refresh library so new imports show up
    this.loadTemplates();
    // Close the wizard modal automatically — the wizard fires this event AFTER the
    // success-confirmation dialog has been dismissed, so the user only clicks "OK" once
    // and the modal goes away in the same gesture.
    if (this.importModalRef) {
      this.importModalRef.close();
      this.importModalRef = undefined;
      this.showImportWizard = false;
      this.importWizardResumeSessionId = undefined;
    }
    this.cdr.detectChanges();
  }

  onImportWizardClosed(): void {
    this.showImportWizard = false;
    if (this.importModalRef) {
      this.importModalRef.close();
      this.importModalRef = undefined;
    }
  }

  formatSourceChip(sourceType?: string): string {
    if (!sourceType || sourceType === 'MANUAL') return 'Manual';
    return sourceType
      .replace(/^IMPORTED_/, 'Imported · ')
      .replace(/_/g, ' ');
  }

  /** Clear every filter + search input and refresh the list. Used by the filtered-empty state CTA. */
  clearAllFilters(): void {
    this.searchQuery = '';
    this.selectedCategory = '';
    this.selectedPracticeArea = '';
    this.selectedJurisdiction = '';
    this.selectedSource = '';
    this.currentPage = 1;
    this.filterTemplates();
  }

  exportTemplates(): void {
    const selectedTemplates = this.paginatedTemplates.filter((t: any) => t.selected);

    if (selectedTemplates.length === 0) {
      Swal.fire({
        title: 'No Templates Selected',
        text: 'Please select at least one template to export.',
        icon: 'warning',
        confirmButtonColor: '#405189'
      });
      return;
    }

    // TODO: Implement export functionality
    Swal.fire({
      title: 'Export Successful',
      text: `${selectedTemplates.length} template(s) will be exported.`,
      icon: 'success',
      confirmButtonColor: '#405189'
    });
  }

  // Helper methods
  getCategoryBadgeClass(category: string): string {
    const categoryMap: { [key: string]: string } = {
      'MOTION': 'badge-soft-primary',
      'BRIEF': 'badge-soft-info',
      'CONTRACT': 'badge-soft-success',
      'IMMIGRATION_FORM': 'badge-soft-warning',
      'FAMILY_LAW_FORM': 'badge-soft-danger',
      'CRIMINAL_MOTION': 'badge-soft-secondary',
      'REAL_ESTATE_DOC': 'badge-soft-primary',
      'PATENT_APPLICATION': 'badge-soft-info',
      'CORRESPONDENCE': 'badge-soft-warning'
    };
    return categoryMap[category] || 'badge-soft-secondary';
  }

  /**
   * Map a template's practice area / category to a CSS modifier slug used to
   * tint the accent band, icon tile and primary pill on the grid card.
   * Slugs align with the mockup's --pa-* CSS variables.
   */
  getCategoryColorSlug(template: Template | TemplateSearchResult): string {
    const pa = (template.practiceArea || '').toLowerCase().trim();
    if (pa.includes('personal injury') || pa === 'pi')       return 'pi';
    if (pa.includes('family'))                               return 'family';
    if (pa.includes('criminal'))                             return 'criminal';
    if (pa.includes('immigration'))                          return 'immigration';
    if (pa.includes('estate') || pa.includes('probate'))     return 'estate';
    if (pa.includes('real estate') || pa.includes('realty')) return 'realestate';
    if (pa.includes('civil') || pa.includes('litigation'))   return 'civil';

    // Fall back to category-based mapping for legacy rows missing practiceArea.
    const cat = (template.category || '').toUpperCase();
    if (cat.includes('FAMILY'))     return 'family';
    if (cat.includes('CRIMINAL'))   return 'criminal';
    if (cat.includes('IMMIGRATION'))return 'immigration';
    if (cat.includes('REAL_ESTATE'))return 'realestate';
    if (cat.includes('PATENT'))     return 'immigration';
    return 'civil';
  }

  /** Remix Icon class for the category/doc-type icon tile. */
  getCategoryIcon(template: Template | TemplateSearchResult): string {
    const cat = (template.category || '').toUpperCase();
    if (cat === 'MOTION' || cat === 'CRIMINAL_MOTION') return 'ri-scales-3-line';
    if (cat === 'BRIEF')                                return 'ri-article-line';
    if (cat === 'CONTRACT')                             return 'ri-file-paper-2-line';
    if (cat === 'IMMIGRATION_FORM')                     return 'ri-passport-line';
    if (cat === 'FAMILY_LAW_FORM')                      return 'ri-heart-pulse-line';
    if (cat === 'REAL_ESTATE_DOC')                      return 'ri-home-5-line';
    if (cat === 'PATENT_APPLICATION')                   return 'ri-lightbulb-flash-line';
    if (cat === 'CORRESPONDENCE')                       return 'ri-mail-send-line';
    return 'ri-file-text-line';
  }

  /** Returns ownership chip tuple: { tag: 'yours|imported|private|org', label }. */
  getOwnershipTag(template: Template | TemplateSearchResult): { tag: string; label: string } | null {
    if (template.isPrivate) return { tag: 'private', label: 'PRIVATE' };
    const src = (template.sourceType || 'MANUAL').toUpperCase();
    if (src.startsWith('IMPORTED')) return { tag: 'imported', label: 'IMPORTED' };
    // No per-user field on the template today; everything manual is "ORG" in this view.
    return { tag: 'org', label: 'ORG' };
  }

  /**
   * Sprint 1.6 — returns the "VISUAL" chip tuple when the row has cached binary bytes
   * (DOCX/PDF) that render with full formatting fidelity. Null otherwise.
   *
   * `hasBinaryTemplate` is omitted from the JSON payload when false (backend `@JsonInclude(NON_DEFAULT)`),
   * so we truthy-check rather than compare `=== true`. Format is echoed as the chip tooltip so attorneys
   * know whether the preview will be DOCX or PDF.
   */
  getBinaryBadge(template: Template | TemplateSearchResult): { label: string; tooltip: string } | null {
    if (!template.hasBinaryTemplate) return null;
    const fmt = (template.templateBinaryFormat || '').toUpperCase();
    const formatLabel = fmt === 'DOCX' || fmt === 'PDF' ? fmt : 'Binary';
    return {
      label: 'VISUAL',
      tooltip: `Preserves original formatting · ${formatLabel}`
    };
  }

  /** Count {{placeholders}} in templateContent. Search-result rows (no content) return 0. */
  getVariableCount(template: Template | TemplateSearchResult): number {
    const content = (template as Template).templateContent;
    if (!content) return 0;
    const matches = content.match(/\{\{[a-z_][a-z0-9_]*\}\}/gi);
    return matches ? matches.length : 0;
  }

  /** Relative time string for card footer. Falls back to usage count when no date. */
  getCardFooterTime(template: Template | TemplateSearchResult): string {
    const iso = 'updatedAt' in template ? template.updatedAt : undefined;
    if (!iso) {
      const uses = (template as any).usageCount || 0;
      return uses > 0 ? `Used ${uses}×` : '—';
    }
    const then = new Date(iso).getTime();
    const diffMs = Date.now() - then;
    if (diffMs < 0) return 'just now';
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1)   return 'just now';
    if (mins < 60)  return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7)   return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5)  return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  }

  getRatingStars(rating: number | undefined): number[] {
    if (!rating) return [0, 0, 0, 0, 0];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const stars = [];

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(1);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(0.5);
      } else {
        stars.push(0);
      }
    }

    return stars;
  }

  // Track by function for ngFor performance
  trackByTemplateId(index: number, template: Template | TemplateSearchResult): number {
    return 'id' in template && template.id ? template.id : index;
  }
}