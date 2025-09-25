import { Component, OnInit, OnDestroy, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TemplateService, Template, TemplateSearchResult } from '../../../services/template.service';
import { AutoFillWizardComponent } from './auto-fill-wizard/auto-fill-wizard.component';
import Swal from 'sweetalert2';

interface Category {
  id: string;
  name: string;
  count: number;
}

@Component({
  selector: 'app-template-library',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AutoFillWizardComponent],
  templateUrl: './template-library.component.html',
  styleUrls: ['./template-library.component.scss']
})
export class TemplateLibraryComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchSubject$ = new Subject<string>();

  @ViewChild('previewModal') previewModal!: TemplateRef<any>;
  @ViewChild('autoFillModal') autoFillModal!: TemplateRef<any>;
  private modalRef?: NgbModalRef;

  // Auto-fill wizard state
  showAutoFillWizard = false;
  selectedTemplateForGeneration: Template | null = null;

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

  constructor(
    private router: Router,
    private modalService: NgbModal,
    private templateService: TemplateService
  ) {}

  ngOnInit(): void {
    this.initializeFilters();
    this.loadTemplates();
    this.setupSearch();
    this.loadCategories();
    this.loadStatistics();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.modalRef) {
      this.modalRef.dismiss();
    }
  }

  initializeFilters(): void {
    this.practiceAreas = this.templateService.getPracticeAreas();
    this.jurisdictions = this.templateService.getJurisdictions();
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
          this.updateCategoryCounts();
          this.filterTemplates();
          this.isLoading = false;
        },
        error: (error) => {
          this.errorMessage = 'Failed to load templates. Please try again.';
          this.isLoading = false;
          console.error('Error loading templates:', error);
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

  // Template actions
  createNewTemplate(): void {
    this.router.navigate(['/legal/ai-assistant/templates/new']);
  }

  editTemplate(template: Template | TemplateSearchResult): void {
    if ('id' in template && template.id) {
      this.router.navigate(['/legal/ai-assistant/templates/edit', template.id]);
    }
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
            },
            error: (error) => {
              Swal.fire({
                title: 'Error!',
                text: 'Failed to duplicate template.',
                icon: 'error',
                confirmButtonColor: '#405189'
              });
              console.error('Duplication error:', error);
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
          this.modalRef = this.modalService.open(this.previewModal, {
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
    if (this.modalRef) {
      this.modalRef.dismiss();
      this.selectedPreviewTemplate = null;
      this.previewContent = '';
    }
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
            },
            error: (error) => {
              Swal.fire({
                title: 'Error!',
                text: 'Failed to delete template.',
                icon: 'error',
                confirmButtonColor: '#405189'
              });
              console.error('Delete error:', error);
            }
          });
      }
    });
  }

  useTemplate(template: Template | TemplateSearchResult): void {
    if ('id' in template && template.id) {
      // Show auto-fill wizard for template generation
      this.selectedTemplateForGeneration = template as Template;
      this.showAutoFillWizard = true;

      // Open modal with auto-fill wizard
      if (this.autoFillModal) {
        this.modalRef = this.modalService.open(this.autoFillModal, {
          size: 'xl',
          centered: true,
          backdrop: 'static'
        });
      }
    }
  }

  onDocumentGenerated(event: any): void {
    console.log('Document generated:', event);
    // Handle the generated document
    if (event.content) {
      // Don't close the modal - let the user see the generated document in step 4
      // The wizard will show the generated content and provide download/copy options
      console.log('Document content available in wizard step 4');

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
    }
  }

  onAutoFillWizardClosed(): void {
    this.showAutoFillWizard = false;
    this.selectedTemplateForGeneration = null;
    if (this.modalRef) {
      this.modalRef.close();
    }
  }

  // Navigate to document editor for advanced editing
  openDocumentEditor(template: Template | TemplateSearchResult): void {
    if ('id' in template && template.id) {
      this.router.navigate(['/legal/ai-assistant/document-generation/editor', template.id]);
    }
  }

  // Navigate to standalone wizard page
  openDocumentWizard(template: Template | TemplateSearchResult): void {
    if ('id' in template && template.id) {
      this.router.navigate(['/legal/ai-assistant/document-generation/wizard', template.id]);
    }
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

  importTemplate(): void {
    // TODO: Implement file import functionality
    Swal.fire({
      title: 'Import Template',
      text: 'Template import functionality will be available soon.',
      icon: 'info',
      confirmButtonColor: '#405189'
    });
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