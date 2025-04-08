import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Document, DocumentType, DocumentStatus } from '../../../interfaces/document.interface';
import { DocumentService } from '../../../services/document.service';

@Component({
  selector: 'app-document-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="container-fluid">
      <div class="row">
        <div class="col-12">
          <div class="card">
            <div class="card-header">
              <h4 class="card-title">Document Details</h4>
              <button class="btn btn-primary" (click)="saveDocument()">Save</button>
            </div>
            <div class="card-body">
              <form [formGroup]="documentForm" (ngSubmit)="saveDocument()">
                <div class="row">
                  <div class="col-md-6">
                    <div class="form-group">
                      <label>Title</label>
                      <input type="text" class="form-control" formControlName="title">
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="form-group">
                      <label>Type</label>
                      <select class="form-control" formControlName="type">
                        <option *ngFor="let type of documentTypes" [value]="type">{{type}}</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div class="row mt-3">
                  <div class="col-md-6">
                    <div class="form-group">
                      <label>Status</label>
                      <select class="form-control" formControlName="status">
                        <option *ngFor="let status of documentStatuses" [value]="status">{{status}}</option>
                      </select>
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="form-group">
                      <label>Case ID</label>
                      <input type="text" class="form-control" formControlName="caseId">
                    </div>
                  </div>
                </div>
                <div class="row mt-3">
                  <div class="col-12">
                    <div class="form-group">
                      <label>Description</label>
                      <textarea class="form-control" rows="4" formControlName="description"></textarea>
                    </div>
                  </div>
                </div>
                <div class="row mt-3">
                  <div class="col-12">
                    <div class="form-group">
                      <label>File</label>
                      <input type="file" class="form-control" (change)="onFileSelected($event)">
                    </div>
                  </div>
                </div>
                <div class="row mt-3">
                  <div class="col-12">
                    <div class="form-group">
                      <label>Tags</label>
                      <input type="text" class="form-control" formControlName="tags" placeholder="Enter tags separated by commas">
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DocumentDetailComponent implements OnInit {
  documentForm: FormGroup;
  documentTypes = Object.values(DocumentType);
  documentStatuses = Object.values(DocumentStatus);
  documentId: string | null = null;
  selectedFile: File | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private documentService: DocumentService
  ) {
    this.documentForm = this.fb.group({
      title: ['', Validators.required],
      type: [DocumentType.OTHER, Validators.required],
      status: [DocumentStatus.DRAFT, Validators.required],
      caseId: [''],
      description: [''],
      tags: ['']
    });
  }

  ngOnInit(): void {
    this.documentId = this.route.snapshot.paramMap.get('id');
    if (this.documentId) {
      this.loadDocument();
    }
  }

  loadDocument(): void {
    if (this.documentId) {
      this.documentService.getDocumentById(this.documentId).subscribe({
        next: (document) => {
          this.documentForm.patchValue({
            title: document.title,
            type: document.type,
            status: document.status,
            caseId: document.caseId,
            description: document.description,
            tags: document.tags?.join(', ')
          });
        },
        error: (error) => {
          console.error('Error loading document:', error);
          // TODO: Show error notification
        }
      });
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile = input.files[0];
    }
  }

  saveDocument(): void {
    if (this.documentForm.valid) {
      const documentData = this.documentForm.value;
      documentData.tags = documentData.tags ? documentData.tags.split(',').map((tag: string) => tag.trim()) : [];

      if (this.selectedFile) {
        this.documentService.uploadDocument(this.selectedFile, documentData).subscribe({
          next: () => {
            // TODO: Show success notification
            this.router.navigate(['/legal/documents']);
          },
          error: (error) => {
            console.error('Error uploading document:', error);
            // TODO: Show error notification
          }
        });
      } else if (this.documentId) {
        this.documentService.updateDocument(this.documentId, documentData).subscribe({
          next: () => {
            // TODO: Show success notification
            this.router.navigate(['/legal/documents']);
          },
          error: (error) => {
            console.error('Error updating document:', error);
            // TODO: Show error notification
          }
        });
      } else {
        this.documentService.createDocument(documentData).subscribe({
          next: () => {
            // TODO: Show success notification
            this.router.navigate(['/legal/documents']);
          },
          error: (error) => {
            console.error('Error creating document:', error);
            // TODO: Show error notification
          }
        });
      }
    }
  }
} 