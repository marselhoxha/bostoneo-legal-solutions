import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FileManagerService } from '../../services/file-manager.service';
import { FileItemModel } from '../../models/file-manager.model';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-file-preview-modal',
  templateUrl: './file-preview-modal.component.html',
  styleUrls: ['./file-preview-modal.component.scss']
})
export class FilePreviewModalComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  @Input() file!: FileItemModel;
  
  previewUrl: SafeResourceUrl | null = null;
  imageUrl: string | null = null;
  textContent: string | null = null;
  isLoading = false;
  error: string | null = null;
  previewType: 'pdf' | 'image' | 'text' | 'office' | 'unsupported' = 'unsupported';
  
  // Zoom controls
  zoomLevel = 100;
  minZoom = 25;
  maxZoom = 500;

  constructor(
    public activeModal: NgbActiveModal,
    private fileManagerService: FileManagerService,
    private sanitizer: DomSanitizer
  ) { }

  ngOnInit(): void {
    this.determinePreviewType();
    this.loadPreview();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Clean up blob URLs
    if (this.imageUrl) {
      URL.revokeObjectURL(this.imageUrl);
    }
  }

  /**
   * Determine how to preview this file type
   */
  private determinePreviewType(): void {
    const mimeType = this.file.mimeType?.toLowerCase() || '';
    const extension = this.file.extension?.toLowerCase() || '';

    if (mimeType === 'application/pdf') {
      this.previewType = 'pdf';
    } else if (mimeType.startsWith('image/')) {
      this.previewType = 'image';
    } else if (
      mimeType.startsWith('text/') ||
      mimeType === 'application/json' ||
      extension === 'txt' ||
      extension === 'log' ||
      extension === 'json' ||
      extension === 'xml' ||
      extension === 'csv'
    ) {
      this.previewType = 'text';
    } else if (
      mimeType.includes('word') ||
      mimeType.includes('excel') ||
      mimeType.includes('powerpoint') ||
      extension === 'doc' ||
      extension === 'docx' ||
      extension === 'xls' ||
      extension === 'xlsx' ||
      extension === 'ppt' ||
      extension === 'pptx'
    ) {
      this.previewType = 'office';
    } else {
      this.previewType = 'unsupported';
    }
  }

  /**
   * Load file preview
   */
  private loadPreview(): void {
    if (this.previewType === 'unsupported') {
      return;
    }

    this.isLoading = true;
    this.error = null;

    this.fileManagerService.downloadFile(this.file.id).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (blob) => {
        this.processFileBlob(blob);
        this.isLoading = false;
      },
      error: (error) => {
        this.error = 'Failed to load file preview: ' + error.message;
        this.isLoading = false;
      }
    });
  }

  /**
   * Process the downloaded file blob for preview
   */
  private processFileBlob(blob: Blob): void {
    switch (this.previewType) {
      case 'pdf':
        this.previewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(blob));
        break;
        
      case 'image':
        this.imageUrl = URL.createObjectURL(blob);
        break;
        
      case 'text':
        this.loadTextContent(blob);
        break;
        
      case 'office':
        // For Office files, we'll show a message with download option
        this.error = 'Office document preview not yet implemented. Please download to view.';
        break;
    }
  }

  /**
   * Load text content from blob
   */
  private loadTextContent(blob: Blob): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.textContent = e.target?.result as string;
    };
    reader.onerror = () => {
      this.error = 'Failed to read text file content';
    };
    reader.readAsText(blob);
  }

  /**
   * Download the file
   */
  downloadFile(): void {
    this.fileManagerService.downloadFile(this.file.id).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = this.file.originalName;
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Download error:', error);
      }
    });
  }

  /**
   * Zoom controls
   */
  zoomIn(): void {
    if (this.zoomLevel < this.maxZoom) {
      this.zoomLevel = Math.min(this.maxZoom, this.zoomLevel + 25);
    }
  }

  zoomOut(): void {
    if (this.zoomLevel > this.minZoom) {
      this.zoomLevel = Math.max(this.minZoom, this.zoomLevel - 25);
    }
  }

  resetZoom(): void {
    this.zoomLevel = 100;
  }

  /**
   * Close modal
   */
  close(): void {
    this.activeModal.close();
  }

  /**
   * Get file type display name
   */
  getFileTypeDisplay(): string {
    const category = this.fileManagerService.getFileTypeCategory(this.file.mimeType);
    return `${category} (${this.file.extension?.toUpperCase() || 'Unknown'})`;
  }

  /**
   * Format file size
   */
  formatFileSize(): string {
    return this.fileManagerService.formatFileSize(this.file.size);
  }
}