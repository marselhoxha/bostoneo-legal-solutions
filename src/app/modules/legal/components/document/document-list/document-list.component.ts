import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Document, DocumentType, DocumentStatus } from '../../../interfaces/document.interface';
import { DocumentService } from '../../../services/document.service';

@Component({
  selector: 'app-document-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="container-fluid">
      <div class="row">
        <div class="col-12">
          <div class="card">
            <div class="card-header">
              <h4 class="card-title">Legal Documents</h4>
              <button class="btn btn-primary" routerLink="new">Upload Document</button>
            </div>
            <div class="card-body">
              <div class="table-responsive">
                <table class="table table-centered table-nowrap mb-0">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Case</th>
                      <th>Created</th>
                      <th>Size</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let doc of documents">
                      <td>{{doc.title}}</td>
                      <td>
                        <span class="badge" [ngClass]="getTypeClass(doc.type)">
                          {{doc.type}}
                        </span>
                      </td>
                      <td>
                        <span class="badge" [ngClass]="getStatusClass(doc.status)">
                          {{doc.status}}
                        </span>
                      </td>
                      <td>{{doc.caseId || 'N/A'}}</td>
                      <td>{{doc.createdAt | date}}</td>
                      <td>{{formatFileSize(doc.size)}}</td>
                      <td>
                        <button class="btn btn-sm btn-info" [routerLink]="[doc.id]">View</button>
                        <button class="btn btn-sm btn-primary" [routerLink]="[doc.id, 'edit']">Edit</button>
                        <button class="btn btn-sm btn-success" (click)="downloadDocument(doc.id)">Download</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .badge {
      padding: 0.5em 1em;
    }
    .badge-contract { background-color: #28a745; }
    .badge-pleading { background-color: #17a2b8; }
    .badge-evidence { background-color: #ffc107; }
    .badge-correspondence { background-color: #6c757d; }
    .badge-other { background-color: #343a40; }
    .badge-draft { background-color: #6c757d; }
    .badge-final { background-color: #28a745; }
    .badge-filed { background-color: #17a2b8; }
    .badge-archived { background-color: #343a40; }
  `]
})
export class DocumentListComponent implements OnInit {
  documents: Document[] = [];

  constructor(private documentService: DocumentService) { }

  ngOnInit(): void {
    this.loadDocuments();
  }

  loadDocuments(): void {
    this.documentService.getDocuments().subscribe({
      next: (documents) => {
        this.documents = documents;
      },
      error: (error) => {
        console.error('Error loading documents:', error);
        // TODO: Show error notification
      }
    });
  }

  getTypeClass(type: DocumentType): string {
    return `badge-${type.toLowerCase()}`;
  }

  getStatusClass(status: DocumentStatus): string {
    return `badge-${status.toLowerCase()}`;
  }

  formatFileSize(size: number): string {
    if (size < 1024) {
      return size + ' B';
    } else if (size < 1024 * 1024) {
      return (size / 1024).toFixed(1) + ' KB';
    } else if (size < 1024 * 1024 * 1024) {
      return (size / (1024 * 1024)).toFixed(1) + ' MB';
    } else {
      return (size / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    }
  }

  downloadDocument(id: string): void {
    this.documentService.downloadDocument(id).subscribe({
      next: (blob) => {
        // TODO: Implement file download
        console.log('Downloading document:', id);
      },
      error: (error) => {
        console.error('Error downloading document:', error);
        // TODO: Show error notification
      }
    });
  }
} 