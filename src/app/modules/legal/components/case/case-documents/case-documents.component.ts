import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CaseDocument } from '../../../interfaces/case.interface';
import { CaseDocumentsService } from '../../../services/case-documents.service';

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
      <div class="card-body">
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
            <div class="mb-3">
              <label class="form-label">Document Type</label>
              <select class="form-select" [(ngModel)]="newDocument.type">
                <option value="">Select document type</option>
                <option value="PLEADING">Pleading</option>
                <option value="MOTION">Motion</option>
                <option value="ORDER">Order</option>
                <option value="EVIDENCE">Evidence</option>
                <option value="CONTRACT">Contract</option>
                <option value="OTHER">Other</option>
              </select>
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
                [disabled]="!newDocument.title || !newDocument.type || !selectedFile"
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
                <th scope="col">Uploaded By</th>
                <th scope="col">Date</th>
                <th scope="col" class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for(document of documents; track document.id) {
                <tr>
                  <td>
                    <div class="d-flex align-items-center">
                      <div class="avatar-sm flex-shrink-0">
                        <span class="avatar-title bg-soft-primary text-primary rounded fs-3">
                          <i class="ri-file-text-line"></i>
                        </span>
                      </div>
                      <div class="flex-grow-1 ms-3">
                        <h6 class="mb-0">{{ document.title }}</h6>
                        <small class="text-muted">{{ document.fileName }}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="badge" 
                      [ngClass]="{
                        'bg-primary-subtle text-primary': document.type === 'PLEADING',
                        'bg-success-subtle text-success': document.type === 'MOTION',
                        'bg-info-subtle text-info': document.type === 'ORDER',
                        'bg-warning-subtle text-warning': document.type === 'EVIDENCE',
                        'bg-secondary-subtle text-secondary': document.type === 'CONTRACT',
                        'bg-light text-dark': document.type === 'OTHER'
                      }">
                      {{ document.type }}
                    </span>
                  </td>
                  <td>{{ document.uploadedBy.name }}</td>
                  <td>{{ document.uploadedAt | date:'mediumDate' }}</td>
                  <td class="text-end">
                    <div class="dropdown d-inline-block">
                      <button class="btn btn-soft-secondary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                        <i class="ri-more-fill align-middle"></i>
                      </button>
                      <ul class="dropdown-menu dropdown-menu-end">
                        <li>
                          <a class="dropdown-item" href="javascript:void(0);" (click)="downloadDocument(document)">
                            <i class="ri-download-2-line align-bottom me-1"></i>
                            Download
                          </a>
                        </li>
                        <li>
                          <a class="dropdown-item" href="javascript:void(0);" (click)="deleteDocument(document)">
                            <i class="ri-delete-bin-line align-bottom me-1"></i>
                            Delete
                          </a>
                        </li>
                      </ul>
                    </div>
                  </td>
                </tr>
              }
              @if(documents.length === 0) {
                <tr>
                  <td colspan="5" class="text-center py-4">
                    <div class="text-muted">
                      <i class="ri-file-text-line fs-3"></i>
                      <p class="mb-0 mt-2">No documents found</p>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
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
  isUploading: boolean = false;
  selectedFile: File | null = null;
  newDocument: Partial<CaseDocument> = {
    title: '',
    type: '',
    fileName: '',
    fileUrl: ''
  };

  constructor(private documentsService: CaseDocumentsService) {}

  ngOnInit(): void {
    this.loadDocuments();
  }

  loadDocuments(): void {
    this.documentsService.getDocuments(this.caseId).subscribe(documents => {
      this.documents = documents;
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
      type: '',
      fileName: '',
      fileUrl: ''
    };
    this.selectedFile = null;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.newDocument.fileName = this.selectedFile.name;
    }
  }

  uploadDocument(): void {
    if (this.selectedFile && this.newDocument.title && this.newDocument.type) {
      this.documentsService.uploadDocument(
        this.caseId, 
        this.newDocument.title, 
        this.newDocument.type, 
        this.selectedFile
      ).subscribe(newDocument => {
        this.documents = [newDocument, ...this.documents];
        this.resetForm();
        this.isUploading = false;
      });
    }
  }

  downloadDocument(document: CaseDocument): void {
    this.documentsService.downloadDocument(this.caseId, document.id).subscribe();
  }

  deleteDocument(document: CaseDocument): void {
    if (confirm('Are you sure you want to delete this document?')) {
      this.documentsService.deleteDocument(this.caseId, document.id).subscribe(() => {
        this.documents = this.documents.filter(d => d.id !== document.id);
      });
    }
  }
} 