import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ClientPortalService, ClientDocument, ClientCase, PagedResponse } from '../../services/client-portal.service';
import { ClientDocumentPreviewModalComponent } from '../document-preview-modal/client-document-preview-modal.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-client-documents',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './client-documents.component.html',
  styleUrls: ['./client-documents.component.scss']
})
export class ClientDocumentsComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  documents: ClientDocument[] = [];
  filteredDocuments: ClientDocument[] = [];
  cases: ClientCase[] = [];
  loading = true;
  uploading = false;
  error: string | null = null;
  successMessage: string | null = null;

  // Pagination
  currentPage = 0;
  pageSize = 12;
  totalPages = 0;
  totalElements = 0;

  // Filters
  searchTerm = '';
  categoryFilter = '';
  caseFilter = '';

  // Upload modal
  showUploadModal = false;
  uploadCaseId: number | null = null;
  uploadTitle = '';
  uploadDescription = '';
  selectedFile: File | null = null;

  categories: string[] = [];

  // Stats
  totalDocCount = 0;
  pdfCount = 0;
  imageCount = 0;
  otherCount = 0;

  private destroy$ = new Subject<void>();
  private apiUrl = environment.apiUrl;

  constructor(
    private clientPortalService: ClientPortalService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private modalService: NgbModal,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // Check for query params
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['caseId']) {
        this.caseFilter = params['caseId'];
      }
    });

    this.loadDocuments();
    this.loadCases();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDocuments(): void {
    this.loading = true;
    this.error = null;

    this.clientPortalService.getDocuments(this.currentPage, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: PagedResponse<ClientDocument>) => {
          this.documents = response.content || [];
          this.totalPages = response.totalPages;
          this.totalElements = response.totalElements;
          this.extractCategories();
          this.calculateStats();
          this.applyFilters();
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading documents:', err);
          this.error = 'Failed to load documents. Please try again.';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  loadCases(): void {
    this.clientPortalService.getCases(0, 100)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.cases = response.content || [];
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading cases:', err);
          this.cdr.detectChanges();
        }
      });
  }

  extractCategories(): void {
    this.categories = [...new Set(this.documents.map(d => d.category).filter(c => c))];
  }

  calculateStats(): void {
    this.totalDocCount = this.documents.length;
    this.pdfCount = this.documents.filter(d => this.isPdf(d)).length;
    this.imageCount = this.documents.filter(d => this.isImage(d)).length;
    this.otherCount = this.totalDocCount - this.pdfCount - this.imageCount;
  }

  applyFilters(): void {
    this.filteredDocuments = this.documents.filter(doc => {
      const matchesSearch = !this.searchTerm ||
        doc.title?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        doc.fileName?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        doc.caseName?.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesCategory = !this.categoryFilter || doc.category === this.categoryFilter;
      const matchesCase = !this.caseFilter || doc.caseId?.toString() === this.caseFilter;

      return matchesSearch && matchesCategory && matchesCase;
    });
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.categoryFilter = '';
    this.caseFilter = '';
    this.applyFilters();
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadDocuments();
    }
  }

  // Preview Document
  previewDocument(doc: ClientDocument): void {
    const modalRef = this.modalService.open(ClientDocumentPreviewModalComponent, {
      size: 'xl',
      centered: true,
      backdrop: 'static',
      keyboard: true
    });
    modalRef.componentInstance.document = doc;
  }

  // Download Document
  downloadDocument(doc: ClientDocument): void {
    if (!doc.id) return;
    const downloadUrl = `${this.apiUrl}/api/file-manager/files/${doc.id}/download`;

    this.http.get(downloadUrl, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = doc.fileName || doc.title || 'document';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error downloading document:', err);
        this.error = 'Unable to download document.';
        this.cdr.detectChanges();
      }
    });
  }

  // Upload methods
  openUploadModal(): void {
    this.showUploadModal = true;
    this.uploadCaseId = this.caseFilter ? parseInt(this.caseFilter) : null;
    this.uploadTitle = '';
    this.uploadDescription = '';
    this.selectedFile = null;
  }

  closeUploadModal(): void {
    this.showUploadModal = false;
    this.uploadCaseId = null;
    this.uploadTitle = '';
    this.uploadDescription = '';
    this.selectedFile = null;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  clearSelectedFile(event: Event): void {
    event.stopPropagation();
    this.selectedFile = null;
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  uploadDocument(): void {
    if (!this.uploadCaseId || !this.selectedFile || !this.uploadTitle) {
      return;
    }

    this.uploading = true;
    this.error = null;

    this.clientPortalService.uploadDocument(
      this.uploadCaseId,
      this.selectedFile,
      this.uploadTitle,
      this.uploadDescription
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.successMessage = 'Document uploaded successfully!';
          this.uploading = false;
          this.closeUploadModal();
          this.loadDocuments();
          this.cdr.detectChanges();
          setTimeout(() => {
            this.successMessage = null;
            this.cdr.detectChanges();
          }, 3000);
        },
        error: (err) => {
          console.error('Error uploading document:', err);
          this.error = 'Failed to upload document. Please try again.';
          this.uploading = false;
          this.cdr.detectChanges();
        }
      });
  }

  // Helper methods
  isPdf(doc: ClientDocument): boolean {
    const type = (doc.fileType || '').toLowerCase();
    const name = (doc.fileName || '').toLowerCase();
    return type.includes('pdf') || name.endsWith('.pdf');
  }

  isImage(doc: ClientDocument): boolean {
    const type = (doc.fileType || '').toLowerCase();
    const name = (doc.fileName || '').toLowerCase();
    return type.startsWith('image/') ||
           name.endsWith('.jpg') ||
           name.endsWith('.jpeg') ||
           name.endsWith('.png') ||
           name.endsWith('.gif');
  }

  getFileIcon(fileType: string): string {
    const iconMap: { [key: string]: string } = {
      'application/pdf': 'ri-file-pdf-line text-danger',
      'application/msword': 'ri-file-word-line text-primary',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'ri-file-word-line text-primary',
      'application/vnd.ms-excel': 'ri-file-excel-line text-success',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'ri-file-excel-line text-success',
      'image/jpeg': 'ri-image-line text-info',
      'image/png': 'ri-image-line text-info',
      'image/gif': 'ri-image-line text-info',
      'text/plain': 'ri-file-text-line text-secondary'
    };
    return iconMap[fileType] || 'ri-file-line text-secondary';
  }

  getFileIconColor(fileType: string): string {
    if (fileType?.includes('pdf')) return 'danger';
    if (fileType?.includes('word') || fileType?.includes('doc')) return 'primary';
    if (fileType?.includes('excel') || fileType?.includes('xls')) return 'success';
    if (fileType?.includes('image')) return 'info';
    return 'secondary';
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  formatCategory(category: string): string {
    if (!category) return '-';
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  get pages(): number[] {
    const pages: number[] = [];
    const start = Math.max(0, this.currentPage - 2);
    const end = Math.min(this.totalPages, start + 5);
    for (let i = start; i < end; i++) {
      pages.push(i);
    }
    return pages;
  }
}
