import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FileManagerService } from '../../services/file-manager.service';
import { FileItemModel } from '../../models/file-manager.model';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject, takeUntil } from 'rxjs';
import { FileVersionHistoryComponent } from '../file-version-history/file-version-history.component';

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
  officeViewerUrl: SafeResourceUrl | null = null;
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
    private sanitizer: DomSanitizer,
    private modalService: NgbModal
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

    // For Office documents, use Office Online Viewer
    if (this.previewType === 'office') {
      this.loadOfficePreview();
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
      error: async (error) => {
        let msg = error.headers?.get('X-Error-Message') || '';
        if (!msg && error.error instanceof Blob) {
          try {
            const text = await error.error.text();
            const parsed = JSON.parse(text);
            msg = parsed.message || parsed.error || '';
          } catch (e) { /* not JSON */ }
        }
        if (!msg) {
          msg = error.message || 'Unknown error';
        }
        this.error = 'Failed to load file preview: ' + msg;
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
        // Office files are handled separately in loadOfficePreview()
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
   * Load Office document preview
   */
  private loadOfficePreview(): void {
    this.isLoading = true;
    this.error = null;

    // For Office documents, we'll provide a simpler preview with file info
    // and download option since Office Online Viewer requires public URLs
    this.fileManagerService.getFile(this.file.id).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (fileDetails) => {
        // Update file info if needed
        this.isLoading = false;
        
        // Show a preview with file information
        this.generateOfficePreviewUrl();
      },
      error: (error) => {
        this.error = 'Unable to load document preview. Please download to view.';
        this.isLoading = false;
      }
    });
  }
  
  /**
   * Generate Office preview URL or fallback
   */
  private generateOfficePreviewUrl(): void {
    // For demonstration, we'll show the Office document info
    // In production, you might want to:
    // 1. Use Google Docs Viewer for public files
    // 2. Convert to PDF server-side for preview
    // 3. Use a commercial solution like Box View API
    
    const extension = this.file.extension?.toLowerCase() || '';
    
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension)) {
      // For now, we'll show a styled preview with document info
      this.error = null;
    } else {
      this.error = 'Preview not available for this Office document type.';
    }
  }

  /**
   * Get the download URL for the file
   */
  private getFileDownloadUrl(): string {
    // This needs to be a publicly accessible URL
    // For now, we'll use the API endpoint, but this may need adjustment based on authentication
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/file-manager/files/${this.file.id}/download`;
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
   * Open version history modal
   */
  openVersionHistory(): void {
    const modalRef = this.modalService.open(FileVersionHistoryComponent, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false,
      centered: true
    });

    modalRef.componentInstance.fileId = this.file.id;
    modalRef.componentInstance.fileName = this.file.name;

    modalRef.result.then(
      (result) => {
        // If a version was changed, we might want to update the preview
        if (result && result.changed) {
          // Optionally reload the preview or show a message
        }
      },
      (dismissed) => {
        // Modal dismissed - no action needed
      }
    );
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