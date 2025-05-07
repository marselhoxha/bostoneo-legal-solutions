import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DocumentService } from '../../../services/document.service';
import { CaseService } from '../../../services/case.service';
import { Document, DocumentType, DocumentStatus } from '../../../interfaces/document.interface';
import { LegalCase } from '../../../interfaces/case.interface';

@Component({
  selector: 'app-document-detail',
  templateUrl: './document-detail.component.html',
  styleUrls: ['./document-detail.component.scss']
})
export class DocumentDetailComponent implements OnInit {
  documentId: string | null = null;
  document: Document | null = null;
  documentForm: FormGroup;
  loading = true;
  isEditing = false;
  isNew = false;
  error: string | null = null;
  availableCases: LegalCase[] = [];
  showVersionModal = false;
  
  get isLoading(): boolean {
    return this.loading;
  }
  
  get isNewDocument(): boolean {
    return this.isNew;
  }
  
  documentTypes = Object.values(DocumentType);
  documentStatuses = Object.values(DocumentStatus);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private documentService: DocumentService,
    private caseService: CaseService,
    private fb: FormBuilder
  ) {
    this.documentForm = this.createForm();
  }

  ngOnInit(): void {
    this.documentId = this.route.snapshot.paramMap.get('id');
    
    if (this.documentId === 'create') {
      this.isNew = true;
      this.isEditing = true;
      this.loading = false;
      this.loadCases();
    } else if (this.documentId) {
      this.loadDocument(this.documentId);
      this.loadCases();
    } else {
      this.error = 'Invalid document ID';
      this.loading = false;
    }
  }

  createForm(): FormGroup {
    return this.fb.group({
      title: ['', [Validators.required]],
      type: [DocumentType.OTHER, [Validators.required]],
      status: [DocumentStatus.DRAFT, [Validators.required]],
      description: [''],
      caseId: [''],
      tags: [''],
      url: ['', [Validators.required]]
    });
  }

  loadDocument(id: string): void {
    this.loading = true;
    this.documentService.getDocumentById(id).subscribe({
      next: (data) => {
        this.document = data;
        this.populateForm(data);
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading document:', error);
        this.error = 'Error loading document. Please try again.';
        this.loading = false;
      }
    });
  }

  populateForm(document: Document): void {
    this.documentForm.patchValue({
      title: document.title,
      type: document.type,
      status: document.status,
      description: document.description || '',
      caseId: document.caseId || '',
      tags: document.tags ? document.tags.join(', ') : '',
      url: document.url
    });
  }

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    if (!this.isEditing && this.document) {
      this.populateForm(this.document);
    }
  }

  onSubmit(): void {
    if (this.documentForm.invalid) {
      return;
    }

    const formData = this.documentForm.value;
    const documentData: Partial<Document> = {
      title: formData.title,
      type: formData.type,
      status: formData.status,
      description: formData.description || undefined,
      caseId: formData.caseId || undefined,
      url: formData.url,
      tags: formData.tags ? formData.tags.split(',').map((tag: string) => tag.trim()) : undefined
    };

    if (this.isNew) {
      this.createDocument(documentData);
    } else if (this.documentId) {
      this.updateDocument(this.documentId, documentData);
    }
  }

  createDocument(documentData: Partial<Document>): void {
    this.loading = true;
    this.documentService.createDocument(documentData).subscribe({
      next: (newDocument) => {
        this.router.navigate(['/legal/documents', newDocument.id]);
      },
      error: (error) => {
        console.error('Error creating document:', error);
        this.error = 'Error creating document. Please try again.';
        this.loading = false;
      }
    });
  }

  updateDocument(id: string, documentData: Partial<Document>): void {
    this.loading = true;
    this.documentService.updateDocument(id, documentData).subscribe({
      next: (updatedDocument) => {
        this.document = updatedDocument;
        this.isEditing = false;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error updating document:', error);
        this.error = 'Error updating document. Please try again.';
        this.loading = false;
      }
    });
  }

  downloadDocument(): void {
    if (!this.documentId) return;
    
    this.loading = true;
    this.documentService.downloadDocument(this.documentId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.document?.title || 'document';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error downloading document:', error);
        this.error = 'Error downloading document. Please try again.';
        this.loading = false;
      }
    });
  }

  toggleVersionModal(): void {
    this.showVersionModal = !this.showVersionModal;
  }

  goBack(): void {
    this.router.navigate(['/legal/documents']);
  }

  loadCases(): void {
    this.caseService.getCases().subscribe({
      next: (cases) => {
        this.availableCases = cases;
      },
      error: (error) => {
        console.error('Error loading cases:', error);
      }
    });
  }
} 
 
 
 