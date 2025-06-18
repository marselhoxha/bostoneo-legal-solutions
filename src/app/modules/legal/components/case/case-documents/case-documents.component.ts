import { Component, Input, OnInit, ChangeDetectorRef, Inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CaseDocument } from '../../../interfaces/case.interface';
import { DocumentType, DocumentCategory } from '../../../interfaces/document.interface';
import { CaseDocumentsService } from '../../../services/case-documents.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { User } from 'src/app/interface/user';
import Swal from 'sweetalert2';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SharedModule } from 'src/app/shared/shared.module';
import { DOCUMENT } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { Pipe, PipeTransform } from '@angular/core';
import { RbacService } from '../../../../../core/services/rbac.service';

@Pipe({
  name: 'safe',
  standalone: true
})
export class SafePipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}
  
  transform(url: string | null, type: string = 'resourceUrl'): SafeResourceUrl | null {
    if (!url) return null;
    
    switch (type) {
      case 'resourceUrl':
        return this.sanitizer.bypassSecurityTrustResourceUrl(url);
      default:
        return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }
  }
}

@Component({
  selector: 'app-case-documents',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule, SafePipe],
  template: `
    <div class="card">
      <div class="card-header border-bottom-dashed">
        <div class="d-flex align-items-center">
          <h5 class="card-title mb-0 flex-grow-1">Case Documents</h5>
          <div class="flex-shrink-0">
            <button 
              class="btn btn-soft-primary btn-sm" 
              (click)="toggleUploadForm()"
            >
              <i class="ri-upload-2-line align-bottom me-1"></i>
              Upload Document
            </button>
          </div>
        </div>
      </div>
      <div class="card-body p-4">
        <!-- Document Filters -->
        <div class="row mb-4">
          <div class="col-md-3">
            <select class="form-select" [(ngModel)]="selectedCategory" (change)="filterDocuments()">
              <option value="">All Categories</option>
              @for(category of categories; track category) {
                <option [value]="category">{{category}}</option>
              }
            </select>
          </div>
          <div class="col-md-3">
            <select class="form-select" [(ngModel)]="selectedType" (change)="filterDocuments()">
              <option value="">All Types</option>
              @for(type of documentTypes; track type) {
                <option [value]="type">{{type}}</option>
              }
            </select>
          </div>
          <div class="col-md-6">
            <input 
              type="text" 
              class="form-control" 
              placeholder="Search documents..."
              [(ngModel)]="searchTerm"
              (input)="filterDocuments()"
            >
          </div>
        </div>

        <!-- Upload Document Form -->
        @if(isUploading) {
          <div class="mb-4">
            <div class="mb-3">
              <label class="form-label">Document Title</label>
              <input 
                type="text" 
                class="form-control" 
                placeholder="Enter document title"
                [(ngModel)]="newDocument.title"
              >
            </div>
            <div class="row">
              <div class="col-md-6">
                <div class="mb-3">
                  <label class="form-label">Document Type</label>
                  <select class="form-select" [(ngModel)]="newDocument.type">
                    <option [ngValue]="null" disabled hidden>Select document type</option>
                    @for(type of documentTypes; track type) {
                      <option [value]="type">{{type}}</option>
                    }
                  </select>
                </div>
              </div>
              <div class="col-md-6">
            <div class="mb-3">
              <label class="form-label">Category</label>
              <select class="form-select" [(ngModel)]="newDocument.category">
                <option [ngValue]="null" disabled hidden>Select category</option>
                <option *ngFor="let category of categories; trackBy: trackByCategory"
                        [value]="category">
                  {{ category }}
                </option>
              </select>
            </div>
          </div>

            </div>
            <div class="mb-3">
              <label class="form-label">Description</label>
              <textarea 
                class="form-control" 
                rows="3" 
                placeholder="Enter document description"
                [(ngModel)]="newDocument.description"
              ></textarea>
            </div>
            <div class="mb-3">
              <label class="form-label">Tags</label>
              <input 
                type="text" 
                class="form-control" 
                placeholder="Enter tags (comma separated)"
                [(ngModel)]="tagsInput"
              >
            </div>
            <div class="mb-3">
              <label class="form-label">File</label>
              <input 
                type="file" 
                class="form-control" 
                (change)="onFileSelected($event)"
              >
            </div>
            <div class="d-flex justify-content-end gap-2">
              <button 
                class="btn btn-outline-secondary btn-sm" 
                (click)="toggleUploadForm()"
              >
                Cancel
              </button>
              <button 
                class="btn btn-outline-primary btn-sm" 
                (click)="uploadDocument()"
                [disabled]="!isFormValid()"
              >
                Upload
              </button>
            </div>
          </div>
        }

        <!-- Documents List -->
        <div class="table-responsive">
          <table class="table table-nowrap table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th scope="col">Document</th>
                <th scope="col">Type</th>
                <th scope="col">Category</th>
                <th scope="col">Version</th>
                <th scope="col">Uploaded By</th>
                <th scope="col">Date</th>
                <th scope="col" class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for(document of filteredDocuments; track document.id) {
                <tr>
                  <td>
                    <div class="d-flex align-items-center">
                      <div class="avatar-sm flex-shrink-0">
                        <span class="avatar-title bg-soft-primary text-primary rounded fs-3">
                          <i class="ri-file-text-line"></i>
                        </span>
                      </div>
                      <div class="flex-grow-1 ms-3">
                        <h6 class="mb-0">{{document.title}}</h6>
                        @if(document.description) {
                          <small class="text-muted">{{document.description}}</small>
                        }
                      </div>
                    </div>
                  </td>
                  <td>{{document.type}}</td>
                  <td>{{document.category}}</td>
                  <td>v{{document.currentVersion}}</td>
                  <td>
                    @if(document.uploadedBy) {
                      {{document.uploadedBy.firstName}} {{document.uploadedBy.lastName}}
                    } @else {
                      <span class="text-muted">Unknown</span>
                    }
                  </td>
                  <td>{{document.uploadedAt | date:'mediumDate'}}</td>
                  <td class="text-end">
                    <div class="d-flex justify-content-end gap-2">
                      <button class="btn btn-icon btn-sm btn-soft-primary" 
                              type="button" 
                              (click)="openPreviewModal(document)" 
                              title="Preview">
                        <i class="ri-eye-line"></i>
                      </button>
                      <button class="btn btn-icon btn-sm btn-soft-danger" 
                              type="button" 
                              (click)="deleteDocument(document)" 
                              title="Delete">
                        <i class="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Document Preview Modal -->
    <div class="modal fade" id="documentPreviewModal" tabindex="-1" aria-labelledby="documentPreviewModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-xl modal-dialog-centered">
        <div class="modal-content border-0">
          <div class="modal-header bg-light">
            <h5 class="modal-title" id="documentPreviewModalLabel">{{ selectedDocument?.title }}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" (click)="closePreview()"></button>
          </div>
          <div class="modal-body p-0 position-relative">
            <!-- Loading spinner -->
            <div *ngIf="isPreviewLoading" class="position-absolute w-100 h-100 d-flex align-items-center justify-content-center bg-white" style="z-index: 2;">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading preview...</span>
              </div>
            </div>
            
            <!-- Document preview container -->
            <div *ngIf="previewUrl && !previewError" class="document-preview-container border rounded" style="height: 70vh; overflow: auto;">
              <iframe [src]="previewUrl" style="width: 100%; height: 100%; border: none;"></iframe>
            </div>
            
            <!-- Error state -->
            <div *ngIf="previewError && !isPreviewLoading" class="text-center py-5">
              <div class="avatar-lg mx-auto mb-4">
                <div class="avatar-title bg-soft-warning text-warning rounded-circle fs-1">
                  <i class="ri-error-warning-line"></i>
                </div>
              </div>
              <h5>Preview Unavailable</h5>
              <p class="text-muted">{{ previewError }}</p>
              <button type="button" class="btn btn-primary btn-sm mt-2" (click)="downloadDocument(selectedDocument?.id)">
                <i class="ri-download-line align-bottom me-1"></i> Download Document
              </button>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-light" data-bs-dismiss="modal" (click)="closePreview()">Close</button>
            <button type="button" class="btn btn-primary" (click)="downloadDocument(selectedDocument?.id)" [disabled]="!selectedDocument">
              <i class="ri-download-line align-bottom me-1"></i> Download
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Version History Modal -->
    @if(documentForVersionHistory) {
      <div class="modal fade show" style="display: block;" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Version History - {{documentForVersionHistory.title}}</h5>
              <button type="button" class="btn-close" (click)="closeVersionHistory()"></button>
            </div>
            <div class="modal-body">
              <div class="table-responsive">
                <table class="table table-nowrap mb-0">
                  <thead class="table-light">
                    <tr>
                      <th>Version</th>
                      <th>Changes</th>
                      <th>Uploaded By</th>
                      <th>Date</th>
                      <th class="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for(version of documentForVersionHistory.versions; track version.id) {
                      <tr>
                        <td>v{{version.versionNumber}}</td>
                        <td>{{version.changes}}</td>
                        <td>
                          @if(version.uploadedBy) {
                            {{version.uploadedBy.firstName}} {{version.uploadedBy.lastName}}
                          } @else {
                            <span class="text-muted">Unknown</span>
                          }
                        </td>
                        <td>{{version.uploadedAt | date:'mediumDate'}}</td>
                        <td class="text-end">
                          <button class="btn btn-soft-primary btn-sm" (click)="downloadVersion(documentForVersionHistory.id, version.id)">
                            <i class="ri-download-line align-bottom"></i>
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop fade show"></div>
    }

    <!-- New Version Upload Modal -->
    @if(documentForNewVersion) {
      <div class="modal fade show" style="display: block;" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Upload New Version</h5>
              <button type="button" class="btn-close" (click)="closeNewVersionUpload()"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Version Notes</label>
                <textarea 
                  class="form-control" 
                  rows="3" 
                  placeholder="Enter version notes"
                  [(ngModel)]="versionNotes"
                ></textarea>
              </div>
              <div class="mb-3">
                <label class="form-label">File</label>
                <input 
                  type="file" 
                  class="form-control" 
                  (change)="onNewVersionFileSelected($event)"
                >
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop fade show"></div>
    }
  `,
  styles: [`
    .avatar-sm {
      width: 2.5rem;
      height: 2.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bg-soft-primary {
      background-color: rgba(64, 81, 137, 0.18) !important;
    }
    .avatar-lg {
      height: 5rem;
      width: 5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
    }
    
    .avatar-title {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    /* Fix for dropdown menu z-index */
    .dropdown-menu {
      z-index: 9999 !important; /* Much higher z-index to ensure it appears over everything */
    }
    
    /* Modal animation */
    .modal.fade .modal-dialog {
      transition: transform .3s ease-out;
      transform: translate(0, -25%);
    }
    
    .modal.show .modal-dialog {
      transform: translate(0, 0);
    }
    
    .modal-backdrop.fade {
      opacity: 0;
      transition: opacity .15s linear;
    }
    
    .modal-backdrop.show {
      opacity: 0.5;
    }

    /* Action button styling */
    .btn-icon {
      width: 32px;
      height: 32px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s ease;
    }

    .btn-icon:hover {
      transform: translateY(-2px);
    }

    .btn-soft-primary {
      background-color: rgba(64, 81, 137, 0.1);
      color: #405189;
      border: none;
    }

    .btn-soft-danger {
      background-color: rgba(239, 71, 111, 0.1);
      color: #ef476f;
      border: none;
    }

    .btn-soft-primary:hover {
      background-color: #405189;
      color: #fff;
    }

    .btn-soft-danger:hover {
      background-color: #ef476f;
      color: #fff;
    }
  `]
})
export class CaseDocumentsComponent implements OnInit, OnDestroy {
  @Input() caseId!: string | number;

  documents: CaseDocument[] = [];
  filteredDocuments: CaseDocument[] = [];
  isUploading: boolean = false;
  isLoading: boolean = false;
  selectedFile: File | null = null;
  selectedDocument: CaseDocument | null = null;
  documentForVersionHistory: CaseDocument | null = null;
  documentForNewVersion: string | null = null;
  selectedCategory: string = '';
  selectedType: string = '';
  searchTerm: string = '';
  tagsInput: string = '';
  versionNotes: string = '';
  selectedVersionFile: File | null = null;
  versionFileName: string = '';
  isUploadingVersion: boolean = false;
  activeVersionDocument: any = null;
  currentObjectUrl: string | null = null;
  previewUrl: SafeResourceUrl | null = null;
  previewError: string | null = null;
  isPreviewLoading: boolean = false;

  documentTypes = Object.values(DocumentType);
  allCategories = Object.values(DocumentCategory);
  
  // Dynamic categories based on user role
  categories: DocumentCategory[] = [];
  
  // Category descriptions for user guidance
  categoryDescriptions: {[key: string]: string} = {
    PUBLIC: 'Documents accessible to all parties including clients (contracts, court orders)',
    INTERNAL: 'Internal documents visible to staff only (research, briefs)',
    CONFIDENTIAL: 'Sensitive documents for attorneys and admins only (financial, strategy)',
    ATTORNEY_CLIENT_PRIVILEGE: 'Privileged communications protected by attorney-client privilege'
  };

  newDocument: Partial<CaseDocument> = {
    title: '',
    type: null as unknown as DocumentType,
    category: null as unknown as DocumentCategory,
    description: '',
    tags: []
  };

  uploadForm: FormGroup;

  constructor(
    private documentsService: CaseDocumentsService,
    private fb: FormBuilder,
    private modalService: NgbModal,
    private toastr: ToastrService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    @Inject(DOCUMENT) private document: Document,
    private rbacService: RbacService
  ) {
    this.uploadForm = this.fb.group({
      title: ['', Validators.required],
      type: [null, Validators.required],
      category: [null, Validators.required],
      description: [''],
      tags: ['']
    });
  }

  ngOnInit(): void {
    // Set available categories based on user role
    this.setAvailableCategories();
    
    if (this.caseId) {
      const caseIdStr = String(this.caseId);
      console.log('Loading documents for case ID:', caseIdStr);
      this.loadDocuments();
    } else {
      console.error('No case ID provided. Documents cannot be loaded.');
      this.toastr.error('Unable to load documents - missing case ID');
      this.documents = [];
      this.filteredDocuments = [];
    }
    
    // Initialize Bootstrap dropdowns
    this.initDropdowns();
  }
  
  ngOnDestroy(): void {
    // Clean up any resources
    this.revokeCurrentObjectUrl();
    this.document.body.classList.remove('modal-open');
  }
  
  // Initialize Bootstrap dropdowns
  private initDropdowns(): void {
    try {
      // Check if we're in a browser environment with the proper Bootstrap JS
      if (typeof window !== 'undefined' && (window as any).bootstrap) {
        setTimeout(() => {
          const dropdownElements = this.document.querySelectorAll('.dropdown-toggle');
          dropdownElements.forEach(dropdownToggle => {
            new (window as any).bootstrap.Dropdown(dropdownToggle);
          });
        }, 500);
      }
      
      // Add global event listener for dropdown show events to fix z-index issues
      document.addEventListener('shown.bs.dropdown', (event) => {
        // Force higher z-index when dropdown is shown
        const dropdown = (event.target as HTMLElement).querySelector('.dropdown-menu');
        if (dropdown) {
          (dropdown as HTMLElement).style.zIndex = '9999';
        }
      });
      
      // Add style directly to head to ensure it's applied globally
      const style = document.createElement('style');
      style.innerHTML = `
        .dropdown-menu.show {
          z-index: 9999 !important;
        }
      `;
      document.head.appendChild(style);
    } catch (error) {
      console.error('Error initializing Bootstrap dropdowns:', error);
    }
  }

  loadDocuments(): void {
    this.isLoading = true;
    const caseIdStr = String(this.caseId);
    
    console.log('Loading documents for case ID:', caseIdStr);
    console.log('Raw caseId value:', this.caseId, 'Type:', typeof this.caseId);
    
    this.documentsService.getDocuments(caseIdStr).subscribe({
      next: (response) => {
        console.log('Raw documents response:', response);
        console.log('Response type:', typeof response, 'Is array:', Array.isArray(response));
        
        try {
          // Enhanced response processing
          let docsArray: any[] = [];
          
          if (Array.isArray(response)) {
            console.log('Response is an array with', response.length, 'documents');
            docsArray = response;
          } else if (response && response.data && Array.isArray(response.data)) {
            console.log('Response has data array with', response.data.length, 'documents');
            docsArray = response.data;
          } else if (response && response.data && response.data.documents && Array.isArray(response.data.documents)) {
            console.log('Response has nested documents array with', response.data.documents.length, 'documents');
            docsArray = response.data.documents;
          } else {
            console.error('Unexpected response format:', response);
            console.log('Response keys:', response ? Object.keys(response) : 'null');
            this.toastr.warning('Unexpected document format received. Contact support if documents are missing.');
            docsArray = [];
          }
          
          console.log('Extracted documents array:', docsArray);
          console.log('Documents array length:', docsArray.length);
          
          // Log results without showing intrusive toast messages
          if (docsArray.length === 0) {
            console.log('No documents found for case ID:', caseIdStr);
          } else {
            console.log(`Found ${docsArray.length} documents for case ID:`, caseIdStr);
          }
          
          // Process and normalize each document
          this.documents = docsArray.map(doc => {
            if (!doc || typeof doc !== 'object') {
              console.warn('Invalid document object:', doc);
              return null;
            }
            
            console.log('Processing document:', doc);
            
            // Normalize category from string to enum if needed
            let normalizedCategory = doc.category || 'OTHER';
            
            // Create a normalized document object with default values
            const normalizedDoc: any = {
              id: doc.id,
              title: doc.title || 'Untitled Document',
              type: doc.type || DocumentType.OTHER,
              category: normalizedCategory,
              status: doc.status || 'FINAL',
              description: doc.description || '',
              fileName: doc.fileName || '',
              fileUrl: doc.fileUrl || doc.url || '',
              uploadedAt: doc.uploadedAt ? new Date(doc.uploadedAt) : new Date(),
              uploadedBy: doc.uploadedBy || null,
              tags: Array.isArray(doc.tags) ? doc.tags : [],
              currentVersion: doc.currentVersion || 1,
              versions: Array.isArray(doc.versions) ? doc.versions : []
            };
            
            return normalizedDoc;
          }).filter(doc => doc !== null);
          
          console.log('Normalized documents:', this.documents);
          this.filterDocuments();
        } catch (err) {
          console.error('Error processing documents response:', err);
          this.toastr.error('Error processing documents data. Please try again or contact support.');
          this.documents = [];
        }
        
        this.isLoading = false;
        this.cdr.detectChanges();
        
        // Re-initialize dropdowns after data is loaded
        this.initDropdowns();
      },
      error: (error) => {
        console.error('Error loading documents:', error);
        let errorMessage = 'Failed to load documents';
        
        if (error.status === 401) {
          errorMessage = 'Authentication error. Please log in again.';
        } else if (error.status === 403) {
          errorMessage = 'You do not have permission to access these documents.';
        } else if (error.status === 404) {
          errorMessage = 'Case or documents not found.';
        } else if (error.status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        }
        
        this.toastr.error(errorMessage);
        this.documents = [];
        this.filteredDocuments = [];
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  filterDocuments(): void {
    try {
      if (!Array.isArray(this.documents)) {
        console.error('documents is not an array:', this.documents);
        this.filteredDocuments = [];
        return;
      }
      
      this.filteredDocuments = this.documents.filter(doc => {
        if (!doc) {
          console.warn('Skipping null or undefined document during filtering');
          return false;
        }
        
        try {
          // Convert values to string for comparison when needed
          const docCategory = typeof doc.category === 'string' ? doc.category : String(doc.category || '');
          const docType = typeof doc.type === 'string' ? doc.type : String(doc.type || '');
          const selectedCategoryStr = this.selectedCategory;
          const selectedTypeStr = this.selectedType;
          
          // Check if matches category filter
          const matchesCategory = !selectedCategoryStr || docCategory === selectedCategoryStr;
          
          // Check if matches type filter
          const matchesType = !selectedTypeStr || docType === selectedTypeStr;
          
          // Check if matches search term
          const matchesSearch = !this.searchTerm || 
            (doc.title || '').toLowerCase().includes(this.searchTerm.toLowerCase()) ||
            (doc.description || '').toLowerCase().includes(this.searchTerm.toLowerCase()) ||
            (Array.isArray(doc.tags) && doc.tags.some(tag => 
              tag && tag.toLowerCase().includes(this.searchTerm.toLowerCase())
            ));
          
          return matchesCategory && matchesType && matchesSearch;
        } catch (err) {
          console.error('Error filtering document:', doc, err);
          return false;
        }
      });
      
      console.log(`Filtered to ${this.filteredDocuments.length} documents`);
      
      // If no documents match the filters, show a message
      if (this.filteredDocuments.length === 0 && this.documents.length > 0) {
        this.toastr.info('No documents match the current filters.');
      }
    } catch (err) {
      console.error('Error in filterDocuments:', err);
      this.toastr.error('Error filtering documents');
      this.filteredDocuments = [...this.documents];
    }
  }

  openPreviewModal(document: CaseDocument): void {
    console.log('Opening preview for document:', document);
    
    // Reset state
    this.previewUrl = null;
    this.previewError = null;
    this.isPreviewLoading = true;
    this.selectedDocument = document;
    this.cdr.detectChanges();
    
    // Revoke any existing object URL
    this.revokeCurrentObjectUrl();
    
    // Manually handle modal with DOM
    const modalElement = this.document.getElementById('documentPreviewModal');
    if (modalElement) {
      try {
        // Initialize modal if bootstrap is available
        if (typeof window !== 'undefined' && (window as any).bootstrap) {
          if (!(window as any).bs_modal) {
            (window as any).bs_modal = new (window as any).bootstrap.Modal(modalElement);
          }
          (window as any).bs_modal.show();
        } else {
          // Fallback if bootstrap JS is not available
          modalElement.classList.add('show');
          modalElement.style.display = 'block';
          this.document.body.classList.add('modal-open');
          
          // Create backdrop if needed
          let backdrop = this.document.querySelector('.modal-backdrop');
          if (!backdrop) {
            backdrop = this.document.createElement('div');
            backdrop.className = 'modal-backdrop fade show';
            this.document.body.appendChild(backdrop);
          }
        }
      } catch (error) {
        console.error('Error showing modal:', error);
      }
    }
    
    // Download and preview the document
    if (!document || !document.id) {
      this.previewError = 'Invalid document';
      this.isPreviewLoading = false;
      this.cdr.detectChanges();
      return;
    }
    
    console.log(`Downloading document ${document.id} for preview`);
    
    this.documentsService.downloadDocument(String(this.caseId), document.id)
      .pipe(
        finalize(() => {
          this.isPreviewLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (blob: Blob) => {
          console.log('Blob received for preview:', blob);
          console.log('Blob type:', blob.type);
          
          if (blob && blob.size > 0) {
            // Force PDF type if filename ends with .pdf but type is incorrect
            let blobToUse = blob;
            const filename = document.fileName || '';
            
            // If file is PDF but content type is not set correctly, fix it
            if (filename.toLowerCase().endsWith('.pdf') && blob.type !== 'application/pdf') {
              console.log('File appears to be PDF but has wrong content type. Creating new blob with correct type');
              blobToUse = new Blob([blob], { type: 'application/pdf' });
            }
            
            // Check blob type for preview compatibility
            if (blobToUse.type === 'application/pdf' || blobToUse.type.startsWith('image/')) {
              console.log('Creating object URL for blob type:', blobToUse.type);
              this.currentObjectUrl = URL.createObjectURL(blobToUse);
              this.previewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.currentObjectUrl);
              console.log('Preview URL generated:', this.currentObjectUrl);
              this.previewError = null;
            } else {
              console.warn(`Preview not supported for type: ${blobToUse.type}`);
              this.previewError = `Preview is not available for this file type (${blobToUse.type || 'unknown'}). Please download the file instead.`;
            }
          } else {
            console.error('Received empty blob for preview.');
            this.previewError = 'Could not load document for preview (empty file).';
          }
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error downloading document for preview:', error);
          this.previewError = 'Failed to load document for preview. Please try downloading it.';
          this.previewUrl = null;
          this.cdr.detectChanges();
        }
      });
  }
  
  private revokeCurrentObjectUrl(): void {
    if (this.currentObjectUrl) {
      try {
        console.log('Revoking previous object URL:', this.currentObjectUrl);
        URL.revokeObjectURL(this.currentObjectUrl);
      } catch (error) {
        console.error('Error revoking URL:', error);
      }
      this.currentObjectUrl = null;
    }
  }

  toggleUploadForm(): void {
    this.isUploading = !this.isUploading;
    if (!this.isUploading) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.newDocument = {
      title: '',
      type: null as unknown as DocumentType,
      category: null as unknown as DocumentCategory,
      description: '',
      tags: []
    };
    this.selectedFile = null;
    this.tagsInput = '';
  }

  isFormValid(): boolean {
    return !!(
      this.newDocument.title &&
      this.newDocument.type &&
      this.newDocument.category &&
      this.selectedFile
    );
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile = input.files[0];
    }
  }

  uploadDocument(): void {
    if (!this.isFormValid()) {
      Swal.fire({
        title: 'Error!',
        text: 'Please fill in all required fields',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }

    if (!this.selectedFile) {
      Swal.fire({
        title: 'Error!',
        text: 'Please select a file to upload',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }

    this.isUploading = true;

    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('title', this.newDocument.title || 'Untitled Document');
    
    // Convert type to string, handle both enum and string values
    const typeValue = typeof this.newDocument.type === 'string' ? 
      this.newDocument.type : String(this.newDocument.type);
    formData.append('type', typeValue);
    
    // Convert category to string, handle both enum and string values
    const categoryValue = typeof this.newDocument.category === 'string' ? 
      this.newDocument.category : String(this.newDocument.category);
    formData.append('category', categoryValue || '');
    
    if (this.newDocument.description) {
      formData.append('description', this.newDocument.description);
    }
    
    if (this.tagsInput && this.tagsInput.length > 0) {
      formData.append('tags', this.tagsInput);
    }

    console.log('Uploading document with data:', {
      title: this.newDocument.title,
      type: typeValue,
      category: categoryValue,
      description: this.newDocument.description,
      tags: this.tagsInput
    });

    this.documentsService.uploadDocument(String(this.caseId), formData)
      .subscribe({
        next: (response) => {
          console.log('Upload response:', response);
          this.loadDocuments();
          
          // Show sweet alert success message
          Swal.fire({
            title: 'Success!',
            text: 'Document uploaded successfully',
            icon: 'success',
            confirmButtonText: 'OK'
          }).then(() => {
            // Reset the form and explicitly hide it after the alert is closed
            this.resetForm();
            this.isUploading = false;
          });
        },
        error: (error) => {
          this.isUploading = false;
          console.error('Error uploading document:', error);
          
          // Show sweet alert error message
          Swal.fire({
            title: 'Error!',
            text: error.message || 'Failed to upload document',
            icon: 'error',
            confirmButtonText: 'OK'
          });
        }
      });
  }

  closePreview(): void {
    // Clean up resources first
    this.revokeCurrentObjectUrl();
    
    // Close modal using DOM
    const modalElement = this.document.getElementById('documentPreviewModal');
    if (modalElement) {
      try {
        // Use bootstrap if available
        if (typeof window !== 'undefined' && (window as any).bootstrap && (window as any).bs_modal) {
          (window as any).bs_modal.hide();
          // Explicitly remove modal-open and backdrop
          this.document.body.classList.remove('modal-open');
          const backdrop = this.document.querySelector('.modal-backdrop');
          if (backdrop && backdrop.parentNode) {
            backdrop.parentNode.removeChild(backdrop);
          }
        } else {
          // Fallback
          modalElement.classList.remove('show');
          modalElement.style.display = 'none';
          this.document.body.classList.remove('modal-open');
          
          // Remove backdrop
          const backdrop = this.document.querySelector('.modal-backdrop');
          if (backdrop && backdrop.parentNode) {
            backdrop.parentNode.removeChild(backdrop);
          }
        }
      } catch (error) {
        console.error('Error closing modal:', error);
        // Force cleanup if there's an error
        this.document.body.classList.remove('modal-open');
        const backdrop = this.document.querySelector('.modal-backdrop');
        if (backdrop && backdrop.parentNode) {
          backdrop.parentNode.removeChild(backdrop);
        }
      }
    }
    
    // Reset component state
    this.selectedDocument = null;
    this.previewUrl = null;
    this.previewError = null;
    this.cdr.detectChanges();
  }

  showVersionHistory(document: CaseDocument): void {
    this.documentForVersionHistory = document;
  }

  closeVersionHistory(): void {
    this.documentForVersionHistory = null;
  }

  uploadNewVersion(documentId: string): void {
    this.documentForNewVersion = documentId;
  }

  closeNewVersionUpload(): void {
    this.documentForNewVersion = null;
    this.selectedFile = null;
    this.versionNotes = '';
  }

  onNewVersionFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length && this.documentForNewVersion) {
      this.selectedFile = input.files[0];
      const formData = new FormData();
      formData.append('file', this.selectedFile);
      
      if (this.versionNotes) {
        formData.append('notes', this.versionNotes);
      }

      this.documentsService.uploadNewVersion(String(this.caseId), this.documentForNewVersion, formData).subscribe({
        next: () => {
          this.loadDocuments();
          this.closeNewVersionUpload();
          
          // Show sweet alert success message
          Swal.fire({
            title: 'Success!',
            text: 'New version uploaded successfully',
            icon: 'success',
            confirmButtonText: 'OK'
          });
        },
        error: (error) => {
          console.error('Error uploading new version:', error);
          
          // Show sweet alert error message
          Swal.fire({
            title: 'Error!',
            text: error.message || 'Failed to upload new version',
            icon: 'error',
            confirmButtonText: 'OK'
          });
        }
      });
    }
  }

  downloadDocument(documentId: string): void {
    if (!documentId) {
      this.toastr.error('Invalid document ID');
      return;
    }
    
    this.documentsService.downloadDocument(String(this.caseId), documentId).subscribe({
      next: (response) => {
        const blob = new Blob([response], { type: 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = this.documents.find(d => d.id === documentId)?.fileName || 'document';
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Error downloading document:', error);
        this.toastr.error('Failed to download document');
      }
    });
  }

  downloadVersion(documentId: string, versionId: string): void {
    this.documentsService.downloadVersion(String(this.caseId), documentId, versionId).subscribe({
      next: (response) => {
        const blob = new Blob([response], { type: 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = this.documents.find(d => d.id === documentId)?.fileName || 'document';
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Error downloading version:', error);
        this.toastr.error('Failed to download version');
      }
    });
  }

  deleteDocument(document: CaseDocument): void {
    if (!document || !document.id) {
      console.error('Cannot delete document: Invalid document or missing ID', document);
      Swal.fire({
        title: 'Error!',
        text: 'Cannot delete document: Invalid document identifier',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }
    
    Swal.fire({
      title: 'Are you sure?',
      text: 'You will not be able to recover this document!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'No, keep it'
    }).then((result) => {
      if (result.isConfirmed) {
        try {
          this.documentsService.deleteDocument(String(this.caseId), document.id)
            .subscribe({
              next: () => {
                console.log('Document deleted successfully');
                
                // Update UI
                this.documents = this.documents.filter(d => d.id !== document.id);
                this.filterDocuments();
                
                Swal.fire({
                  title: 'Deleted!',
                  text: 'Document has been deleted.',
                  icon: 'success',
                  timer: 2000,
                  showConfirmButton: false
                });
              },
              error: (error) => {
                console.error('Error deleting document:', error);
                
                Swal.fire({
                  title: 'Error!',
                  text: 'Failed to delete document: ' + (error.error?.message || error.message || 'Unknown error'),
                  icon: 'error',
                  confirmButtonText: 'OK'
                });
              }
            });
        } catch (e) {
          console.error('Exception during document deletion:', e);
          
          Swal.fire({
            title: 'Error!',
            text: 'An unexpected error occurred: ' + (e instanceof Error ? e.message : 'Unknown error'),
            icon: 'error',
            confirmButtonText: 'OK'
          });
        }
      }
    });
  }

  setAvailableCategories(): void {
    const isClient = this.rbacService.hasRole('ROLE_CLIENT');
    const isAttorney = this.rbacService.isAttorneyLevel();
    const isAdmin = this.rbacService.isAdmin();
    const isParalegal = this.rbacService.hasRole('ROLE_PARALEGAL');
    const isSecretary = this.rbacService.hasRole('ROLE_SECRETARY');
    
    if (isClient) {
      // Clients can only upload PUBLIC documents
      this.categories = [DocumentCategory.PUBLIC];
    } else if (isAttorney || isAdmin) {
      // Attorneys and admins can use all categories
      this.categories = this.allCategories;
    } else if (isParalegal) {
      // Paralegals can't create attorney-client privileged documents
      this.categories = this.allCategories.filter(cat => cat !== DocumentCategory.ATTORNEY_CLIENT_PRIVILEGE);
    } else if (isSecretary) {
      // Secretaries can only create public and internal documents
      this.categories = [
        DocumentCategory.PUBLIC,
        DocumentCategory.INTERNAL
      ];
    } else {
      // Default: basic categories
      this.categories = [DocumentCategory.PUBLIC];
    }
  }
  
  // Helper method to get category description
  getCategoryDescription(category: string): string {
    return this.categoryDescriptions[category] || '';
  }

  // Helper method to get category badge class
  getCategoryBadgeClass(category: string): string {
    switch(category) {
      case 'PUBLIC':
        return 'badge bg-success-subtle text-success';
      case 'INTERNAL':
        return 'badge bg-info-subtle text-info';
      case 'CONFIDENTIAL':
        return 'badge bg-warning-subtle text-warning';
      case 'ATTORNEY_CLIENT_PRIVILEGE':
        return 'badge bg-danger-subtle text-danger';
      default:
        return 'badge bg-secondary-subtle text-secondary';
    }
  }
  
  // Helper method to get category icon
  getCategoryIcon(category: string): string {
    switch(category) {
      case 'PUBLIC':
        return 'ri-global-line'; // Globe icon for public
      case 'INTERNAL':
        return 'ri-building-line'; // Building for internal
      case 'CONFIDENTIAL':
        return 'ri-lock-line'; // Lock for confidential
      case 'ATTORNEY_CLIENT_PRIVILEGE':
        return 'ri-shield-keyhole-line'; // Shield for privileged
      default:
        return 'ri-file-text-line';
    }
  }

  // Track by function for category dropdown
  trackByCategory(index: number, category: DocumentCategory): string {
    return category;
  }
} 
