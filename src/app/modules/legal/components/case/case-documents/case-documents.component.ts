import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CaseDocument, DocumentType, DocumentCategory } from '../../../interfaces/case.interface';
import { CaseDocumentsService } from '../../../services/case-documents.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { User } from 'src/app/interface/user';

@Component({
  selector: 'app-case-documents',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
                    <option value="">Select document type</option>
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
                    <option value="">Select category</option>
                    @for(category of categories; track category) {
                      <option [value]="category">{{category}}</option>
                    }
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
                class="btn btn-soft-light btn-sm" 
                (click)="toggleUploadForm()"
              >
                Cancel
              </button>
              <button 
                class="btn btn-soft-primary btn-sm" 
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
                  <td>{{document.uploadedBy.firstName}} {{document.uploadedBy.lastName}}</td>
                  <td>{{document.uploadedAt | date:'mediumDate'}}</td>
                  <td class="text-end">
                    <div class="dropdown">
                      <button class="btn btn-soft-secondary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown">
                        Actions
                      </button>
                      <ul class="dropdown-menu dropdown-menu-end">
                        <li>
                          <a class="dropdown-item" (click)="previewDocument(document)">
                            <i class="ri-eye-line align-bottom me-2"></i> Preview
                          </a>
                        </li>
                        <li>
                          <a class="dropdown-item" (click)="downloadDocument(document.id)">
                            <i class="ri-download-line align-bottom me-2"></i> Download
                          </a>
                        </li>
                        <li>
                          <a class="dropdown-item" (click)="showVersionHistory(document)">
                            <i class="ri-history-line align-bottom me-2"></i> Version History
                          </a>
                        </li>
                        <li>
                          <a class="dropdown-item" (click)="uploadNewVersion(document.id)">
                            <i class="ri-upload-2-line align-bottom me-2"></i> Upload New Version
                          </a>
                        </li>
                        <li>
                          <a class="dropdown-item text-danger" (click)="deleteDocument(document)">
                            <i class="ri-delete-bin-line align-bottom me-2"></i> Delete
                          </a>
                        </li>
                      </ul>
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
    @if(selectedDocument) {
      <div class="modal fade show" style="display: block;" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">{{selectedDocument.title}}</h5>
              <button type="button" class="btn-close" (click)="closePreview()"></button>
            </div>
            <div class="modal-body">
              <iframe [src]="selectedDocument.fileUrl | safe:'resourceUrl'" width="100%" height="500px"></iframe>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop fade show"></div>
    }

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
                        <td>{{version.uploadedBy.firstName}} {{version.uploadedBy.lastName}}</td>
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
  `]
})
export class CaseDocumentsComponent implements OnInit {
  @Input() caseId!: string;

  documents: CaseDocument[] = [];
  filteredDocuments: CaseDocument[] = [];
  isUploading: boolean = false;
  selectedFile: File | null = null;
  selectedDocument: CaseDocument | null = null;
  documentForVersionHistory: CaseDocument | null = null;
  documentForNewVersion: string | null = null;
  selectedCategory: string = '';
  selectedType: string = '';
  searchTerm: string = '';
  tagsInput: string = '';
  versionNotes: string = '';

  documentTypes = ['PLEADING', 'MOTION', 'ORDER', 'EVIDENCE', 'CONTRACT', 'OTHER'] as const;
  categories = ['LEGAL', 'FINANCIAL', 'CORRESPONDENCE', 'REPORT', 'OTHER'] as const;

  newDocument: Partial<CaseDocument> = {
    title: '',
    type: this.documentTypes[0],
    category: this.categories[0],
    description: '',
    tags: [],
    currentVersion: 1,
    versions: []
  };

  uploadForm: FormGroup;
  previewUrl: string | null = null;

  constructor(
    private documentsService: CaseDocumentsService,
    private fb: FormBuilder,
    private modalService: NgbModal,
    private toastr: ToastrService
  ) {
    this.uploadForm = this.fb.group({
      title: ['', Validators.required],
      type: [this.documentTypes[0], Validators.required],
      category: [this.categories[0], Validators.required],
      description: [''],
      tags: ['']
    });
  }

  ngOnInit(): void {
    this.loadDocuments();
  }

  loadDocuments(): void {
    this.documentsService.getDocuments(this.caseId).subscribe({
      next: (documents) => {
        this.documents = documents.length > 0 ? documents : this.getDummyDocuments();
        this.filteredDocuments = [...this.documents];
        this.filterDocuments();
      },
      error: (error) => {
        console.error('Error loading documents:', error);
        this.documents = this.getDummyDocuments();
        this.filteredDocuments = [...this.documents];
        this.filterDocuments();
      }
    });
  }

  private getDummyDocuments(): CaseDocument[] {
    const dummyUser: User = {
      id: 1,
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith@example.com',
      enabled: true,
      notLocked: true,
      usingMFA: false,
      roleName: 'ROLE_ADMIN',
      permissions: 'READ,WRITE'
    };

    return [
      {
        id: '1',
        title: 'Initial Complaint',
        type: 'PLEADING',
        category: 'LEGAL',
        fileName: 'initial_complaint.pdf',
        fileUrl: 'https://example.com/documents/initial_complaint.pdf',
        description: 'Initial complaint filed with the court',
        tags: ['complaint', 'filing'],
        uploadedAt: new Date('2024-03-01'),
        uploadedBy: dummyUser,
        currentVersion: 2,
        versions: [
          {
            id: '1-1',
            versionNumber: 1,
            fileName: 'initial_complaint_v1.pdf',
            fileUrl: 'https://example.com/documents/initial_complaint_v1.pdf',
            uploadedAt: new Date('2024-03-01'),
            uploadedBy: dummyUser,
            changes: 'Initial version'
          },
          {
            id: '1-2',
            versionNumber: 2,
            fileName: 'initial_complaint_v2.pdf',
            fileUrl: 'https://example.com/documents/initial_complaint_v2.pdf',
            uploadedAt: new Date('2024-03-05'),
            uploadedBy: dummyUser,
            changes: 'Updated with client feedback'
          }
        ]
      },
      {
        id: '2',
        title: 'Evidence Package A',
        type: 'EVIDENCE',
        category: 'LEGAL',
        fileName: 'evidence_package_a.pdf',
        fileUrl: 'https://example.com/documents/evidence_package_a.pdf',
        description: 'Collection of evidence supporting the case',
        tags: ['evidence', 'exhibits'],
        uploadedAt: new Date('2024-03-10'),
        uploadedBy: dummyUser,
        currentVersion: 1,
        versions: [
          {
            id: '2-1',
            versionNumber: 1,
            fileName: 'evidence_package_a_v1.pdf',
            fileUrl: 'https://example.com/documents/evidence_package_a_v1.pdf',
            uploadedAt: new Date('2024-03-10'),
            uploadedBy: dummyUser,
            changes: 'Initial compilation of evidence'
          }
        ]
      },
      {
        id: '3',
        title: 'Motion for Summary Judgment',
        type: 'MOTION',
        category: 'LEGAL',
        fileName: 'summary_judgment_motion.pdf',
        fileUrl: 'https://example.com/documents/summary_judgment_motion.pdf',
        description: 'Motion requesting summary judgment based on evidence',
        tags: ['motion', 'summary judgment'],
        uploadedAt: new Date('2024-03-15'),
        uploadedBy: dummyUser,
        currentVersion: 3,
        versions: [
          {
            id: '3-1',
            versionNumber: 1,
            fileName: 'summary_judgment_motion_v1.pdf',
            fileUrl: 'https://example.com/documents/summary_judgment_motion_v1.pdf',
            uploadedAt: new Date('2024-03-15'),
            uploadedBy: dummyUser,
            changes: 'Initial draft'
          },
          {
            id: '3-2',
            versionNumber: 2,
            fileName: 'summary_judgment_motion_v2.pdf',
            fileUrl: 'https://example.com/documents/summary_judgment_motion_v2.pdf',
            uploadedAt: new Date('2024-03-17'),
            uploadedBy: dummyUser,
            changes: 'Updated legal arguments'
          },
          {
            id: '3-3',
            versionNumber: 3,
            fileName: 'summary_judgment_motion_v3.pdf',
            fileUrl: 'https://example.com/documents/summary_judgment_motion_v3.pdf',
            uploadedAt: new Date('2024-03-20'),
            uploadedBy: dummyUser,
            changes: 'Final version with citations'
          }
        ]
      },
      {
        id: '4',
        title: 'Client Contract',
        type: 'CONTRACT',
        category: 'FINANCIAL',
        fileName: 'client_contract.pdf',
        fileUrl: 'https://example.com/documents/client_contract.pdf',
        description: 'Engagement agreement with client',
        tags: ['contract', 'agreement'],
        uploadedAt: new Date('2024-02-28'),
        uploadedBy: dummyUser,
        currentVersion: 1,
        versions: [
          {
            id: '4-1',
            versionNumber: 1,
            fileName: 'client_contract_v1.pdf',
            fileUrl: 'https://example.com/documents/client_contract_v1.pdf',
            uploadedAt: new Date('2024-02-28'),
            uploadedBy: dummyUser,
            changes: 'Executed contract'
          }
        ]
      },
      {
        id: '5',
        title: 'Case Status Report',
        type: 'OTHER',
        category: 'REPORT',
        fileName: 'status_report_march.pdf',
        fileUrl: 'https://example.com/documents/status_report_march.pdf',
        description: 'Monthly status report for March 2024',
        tags: ['report', 'status'],
        uploadedAt: new Date('2024-03-31'),
        uploadedBy: dummyUser,
        currentVersion: 1,
        versions: [
          {
            id: '5-1',
            versionNumber: 1,
            fileName: 'status_report_march_v1.pdf',
            fileUrl: 'https://example.com/documents/status_report_march_v1.pdf',
            uploadedAt: new Date('2024-03-31'),
            uploadedBy: dummyUser,
            changes: 'March 2024 report'
          }
        ]
      }
    ];
  }

  filterDocuments(): void {
    this.filteredDocuments = this.documents.filter(doc => {
      const matchesCategory = !this.selectedCategory || doc.category === this.selectedCategory;
      const matchesType = !this.selectedType || doc.type === this.selectedType;
      const matchesSearch = !this.searchTerm || 
        doc.title.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        doc.description?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        doc.tags.some(tag => tag.toLowerCase().includes(this.searchTerm.toLowerCase()));
      
      return matchesCategory && matchesType && matchesSearch;
    });
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
      type: this.documentTypes[0],
      category: this.categories[0],
      description: '',
      tags: [],
      currentVersion: 1,
      versions: []
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
    if (this.uploadForm.valid && this.selectedFile) {
      const formData = new FormData();
      formData.append('file', this.selectedFile);
      formData.append('title', this.uploadForm.get('title')?.value);
      formData.append('type', this.uploadForm.get('type')?.value);
      formData.append('category', this.uploadForm.get('category')?.value);
      formData.append('description', this.uploadForm.get('description')?.value);
      formData.append('tags', this.uploadForm.get('tags')?.value);

      this.documentsService.uploadDocument(this.caseId, formData).subscribe(
        () => {
          this.loadDocuments();
          this.uploadForm.reset({
            type: this.documentTypes[0],
            category: this.categories[0]
          });
          this.selectedFile = null;
        },
        error => console.error('Error uploading document:', error)
      );
    }
  }

  previewDocument(document: CaseDocument): void {
    this.selectedDocument = document;
    this.previewUrl = document.fileUrl;
  }

  closePreview(): void {
    this.selectedDocument = null;
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

  onNewVersionFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length && this.documentForNewVersion) {
      this.selectedFile = input.files[0];
      const formData = new FormData();
      formData.append('file', this.selectedFile);
      formData.append('version', (this.documents.find(d => d.id === this.documentForNewVersion)?.currentVersion || 1).toString());
      formData.append('notes', this.versionNotes);

      this.documentsService.uploadNewVersion(this.documentForNewVersion, formData).subscribe({
        next: () => {
          this.loadDocuments();
          this.selectedFile = null;
          this.versionNotes = '';
          this.documentForNewVersion = null;
          this.toastr.success('New version uploaded successfully');
        },
        error: (error) => {
          console.error('Error uploading new version:', error);
          this.toastr.error('Failed to upload new version');
        }
      });
    }
  }

  closeNewVersionUpload(): void {
    this.documentForNewVersion = null;
    this.selectedFile = null;
    this.versionNotes = '';
  }

  downloadDocument(documentId: string): void {
    this.documentsService.downloadDocument(documentId).subscribe(
      response => {
        const blob = new Blob([response], { type: 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = this.documents.find(d => d.id === documentId)?.fileName || 'document';
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error => console.error('Error downloading document:', error)
    );
  }

  downloadVersion(documentId: string, versionId: string): void {
    this.documentsService.downloadVersion(versionId).subscribe(
      response => {
        const blob = new Blob([response], { type: 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = this.documents.find(d => d.id === documentId)?.fileName || 'document';
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error => console.error('Error downloading version:', error)
    );
  }

  deleteDocument(document: CaseDocument): void {
    if (confirm('Are you sure you want to delete this document?')) {
      this.documentsService.deleteDocument(document.id).subscribe(
        () => this.loadDocuments()
      );
    }
  }
} 