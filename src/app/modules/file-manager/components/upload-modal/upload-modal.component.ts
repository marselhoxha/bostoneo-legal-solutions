import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FileManagerService } from '../../services/file-manager.service';

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
    this.activeModal.close(response);
  }

  onUploadError(error: string): void {
    console.error('Upload error:', error);
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