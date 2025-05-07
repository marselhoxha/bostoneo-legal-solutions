import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DocumentService } from '../../../services/document.service';
import { CaseDocumentsService } from '../../../services/case-documents.service';
import { Observable, Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-document-version',
  templateUrl: './document-version.component.html',
  styleUrls: ['./document-version.component.scss']
})
export class DocumentVersionComponent implements OnInit, OnDestroy {
  documentId: string | null = null;
  caseId: string | null = null;
  document: any = null;
  uploadForm: FormGroup;
  selectedFile: File | null = null;
  uploadProgress: number = 0;
  uploading: boolean = false;
  private subscriptions: Subscription = new Subscription();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private documentService: DocumentService,
    private caseDocumentsService: CaseDocumentsService,
    private snackBar: MatSnackBar
  ) {
    this.uploadForm = this.fb.group({
      file: [null, Validators.required],
      comment: ['', Validators.maxLength(255)]
    });
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.route.paramMap.subscribe(params => {
        this.documentId = params.get('id');
        this.caseId = params.get('caseId');
        
        if (this.documentId) {
          this.loadDocumentDetails();
        } else {
          this.snackBar.open('No document ID provided', 'Close', { duration: 3000 });
          this.navigateBack();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadDocumentDetails(): void {
    if (!this.documentId) return;

    const service = this.caseId ? this.caseDocumentsService : this.documentService;
    const getMethod = this.caseId 
      ? service.getDocument(this.caseId, this.documentId) 
      : this.documentService.getDocument(this.documentId);

    this.subscriptions.add(
      getMethod.subscribe({
        next: (document) => {
          this.document = document;
        },
        error: (error) => {
          console.error('Error loading document details:', error);
          this.snackBar.open('Error loading document details', 'Close', { duration: 5000 });
          this.navigateBack();
        }
      })
    );
  }

  onFileSelected(event: any): void {
    if (event.target.files && event.target.files.length) {
      this.selectedFile = event.target.files[0];
    }
  }

  uploadNewVersion(): void {
    if (!this.documentId || !this.selectedFile) {
      this.snackBar.open('Please select a file to upload', 'Close', { duration: 3000 });
      return;
    }

    this.uploading = true;
    this.uploadProgress = 0;

    // Get the comment directly from the form
    const comment = this.uploadForm.get('comment')?.value || '';

    let uploadObservable: Observable<any>;
    
    if (this.caseId) {
      uploadObservable = this.caseDocumentsService.uploadVersion(this.caseId, this.documentId, this.selectedFile, comment);
    } else {
      uploadObservable = this.documentService.uploadVersion(this.documentId, this.selectedFile, comment);
    }

    this.subscriptions.add(
      uploadObservable.pipe(
        finalize(() => {
          this.uploading = false;
        })
      ).subscribe({
        next: (event: any) => {
          if (event.type === 'UploadProgress') {
            this.uploadProgress = Math.round(100 * event.loaded / event.total);
          } else if (event.type === 'Response' || !event.type) {
            this.snackBar.open('New version uploaded successfully', 'Close', { duration: 3000 });
            this.navigateBack();
          }
        },
        error: (error) => {
          console.error('Error uploading new version:', error);
          this.snackBar.open('Error uploading new version', 'Close', { duration: 5000 });
        }
      })
    );
  }

  navigateBack(): void {
    if (this.caseId) {
      this.router.navigate(['/legal/cases', this.caseId, 'documents']);
    } else {
      this.router.navigate(['/legal/documents']);
    }
  }

  cancelUpload(): void {
    this.navigateBack();
  }
} 