import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FileManagerService } from '../../services/file-manager.service';
import { FileUploadComponent } from '../file-upload/file-upload.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-upload-modal',
  templateUrl: './upload-modal.component.html',
  styleUrls: ['./upload-modal.component.scss']
})
export class UploadModalComponent implements OnInit {
  @Input() folderId?: number;
  @Input() caseId?: number;
  @Input() folderName?: string;
  @Input() caseName?: string;
  
  @ViewChild(FileUploadComponent) fileUploadComponent!: FileUploadComponent;

  activeCases: any[] = [];
  documentCategories = [
    'pleadings',
    'discovery', 
    'motions',
    'correspondence',
    'evidence',
    'contracts',
    'research',
    'settlement'
  ];
  
  documentStatuses = [
    'draft',
    'review',
    'final',
    'filed',
    'archived'
  ];

  selectedCaseId?: number;
  selectedDocumentCategory = 'general';
  selectedDocumentStatus = 'draft';

  constructor(
    public activeModal: NgbActiveModal,
    private fileManagerService: FileManagerService
  ) { }

  ngOnInit(): void {
    this.loadActiveCases();
    this.selectedCaseId = this.caseId;
  }

  loadActiveCases(): void {
    this.fileManagerService.getActiveCases().subscribe({
      next: (response) => {
        this.activeCases = response.content || [];
      },
      error: (error) => {
        console.error('Error loading active cases:', error);
      }
    });
  }

  onUploadComplete(response: any): void {
    // Add case information to the response if a case was selected
    if (this.selectedCaseId) {
      const selectedCase = this.activeCases.find(c => c.id === this.selectedCaseId);
      if (selectedCase) {
        response.caseId = this.selectedCaseId;
        response.caseNumber = selectedCase.caseNumber;
        response.caseTitle = selectedCase.title;
      }
    }
    
    // Add folder information if uploading to a folder
    if (this.folderId) {
      response.folderId = this.folderId;
      response.folderName = this.folderName;
    }

    Swal.fire({
      title: 'Upload Successful!',
      text: 'Your files have been uploaded successfully.',
      icon: 'success',
      timer: 2000,
      showConfirmButton: false
    }).then(() => {
      this.activeModal.close(response);
    });
  }

  onUploadError(error: string): void {
    console.error('Upload error:', error);
    Swal.fire({
      title: 'Upload Failed!',
      text: `Failed to upload files: ${error}`,
      icon: 'error',
      confirmButtonColor: '#f06548'
    });
  }

  uploadFiles(): void {
    if (this.fileUploadComponent && this.fileUploadComponent.selectedFiles.length > 0) {
      this.fileUploadComponent.uploadFiles();
    } else {
      Swal.fire({
        title: 'No Files Selected',
        text: 'Please select at least one file to upload.',
        icon: 'warning',
        confirmButtonColor: '#405189'
      });
    }
  }

  canUpload(): boolean {
    return this.fileUploadComponent?.selectedFiles?.length > 0 && !this.fileUploadComponent?.isUploading;
  }

  dismiss(): void {
    this.activeModal.dismiss();
  }

  getUploadLocation(): string {
    if (this.caseName) {
      return `Case: ${this.caseName}`;
    } else if (this.folderName) {
      return `Folder: ${this.folderName}`;
    } else {
      return 'Root Directory';
    }
  }
}