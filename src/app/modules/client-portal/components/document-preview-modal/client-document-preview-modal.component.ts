import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { ClientDocument } from '../../services/client-portal.service';

@Component({
  selector: 'app-client-document-preview-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './client-document-preview-modal.component.html',
  styleUrls: ['./client-document-preview-modal.component.scss']
})
export class ClientDocumentPreviewModalComponent implements OnInit, OnDestroy {
  @Input() document!: ClientDocument;

  previewUrl: SafeResourceUrl | null = null;
  imageUrl: string | null = null;
  blobUrl: string | null = null;
  isLoading = true;
  error: string | null = null;
  previewType: 'pdf' | 'image' | 'office' | 'unsupported' = 'unsupported';

  // Zoom controls for images
  zoomLevel = 100;
  minZoom = 25;
  maxZoom = 400;

  private readonly apiUrl = environment.apiUrl;

  constructor(
    public activeModal: NgbActiveModal,
    private sanitizer: DomSanitizer,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.determinePreviewType();
    this.loadPreview();
  }

  ngOnDestroy(): void {
    // Clean up blob URLs
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
    }
  }

  private determinePreviewType(): void {
    const mimeType = (this.document.fileType || '').toLowerCase();
    const fileName = (this.document.fileName || '').toLowerCase();

    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
      this.previewType = 'pdf';
    } else if (mimeType.startsWith('image/') ||
               fileName.endsWith('.jpg') ||
               fileName.endsWith('.jpeg') ||
               fileName.endsWith('.png') ||
               fileName.endsWith('.gif') ||
               fileName.endsWith('.webp')) {
      this.previewType = 'image';
    } else if (
      mimeType.includes('word') ||
      mimeType.includes('excel') ||
      mimeType.includes('powerpoint') ||
      fileName.endsWith('.doc') ||
      fileName.endsWith('.docx') ||
      fileName.endsWith('.xls') ||
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.ppt') ||
      fileName.endsWith('.pptx')
    ) {
      this.previewType = 'office';
    } else {
      this.previewType = 'unsupported';
    }
  }

  private loadPreview(): void {
    if (this.previewType === 'unsupported' || this.previewType === 'office') {
      this.isLoading = false;
      return;
    }

    // Use the download endpoint with authentication via HttpClient
    const downloadUrl = `${this.apiUrl}/api/file-manager/files/${this.document.id}/download`;

    this.http.get(downloadUrl, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        // Create blob URL for preview
        this.blobUrl = URL.createObjectURL(blob);

        if (this.previewType === 'pdf') {
          this.previewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.blobUrl);
        } else if (this.previewType === 'image') {
          this.imageUrl = this.blobUrl;
        }

        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading document preview:', err);
        this.error = 'Unable to load document preview. Please try downloading the file.';
        this.isLoading = false;
      }
    });
  }

  downloadFile(): void {
    const downloadUrl = `${this.apiUrl}/api/file-manager/files/${this.document.id}/download`;

    this.http.get(downloadUrl, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = this.document.fileName || this.document.title || 'document';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error downloading document:', err);
        this.error = 'Unable to download document.';
      }
    });
  }

  openInNewTab(): void {
    if (this.blobUrl) {
      window.open(this.blobUrl, '_blank');
    } else {
      // Fallback: download and open
      const downloadUrl = `${this.apiUrl}/api/file-manager/files/${this.document.id}/download`;
      this.http.get(downloadUrl, { responseType: 'blob' }).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
        },
        error: (err) => {
          console.error('Error opening document:', err);
        }
      });
    }
  }

  // Zoom controls
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

  close(): void {
    this.activeModal.dismiss();
  }

  // Format helpers
  formatFileSize(bytes: number | undefined): string {
    if (!bytes) return '-';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  getFileExtension(): string {
    const fileName = this.document.fileName || '';
    const parts = fileName.split('.');
    return parts.length > 1 ? parts.pop()?.toUpperCase() || '' : '';
  }

  getFileIcon(): string {
    const type = (this.document.fileType || '').toLowerCase();
    if (type.includes('pdf')) return 'ri-file-pdf-line text-danger';
    if (type.includes('word') || type.includes('doc')) return 'ri-file-word-line text-primary';
    if (type.includes('excel') || type.includes('xls')) return 'ri-file-excel-line text-success';
    if (type.includes('image') || type.includes('png') || type.includes('jpg')) return 'ri-image-line text-info';
    if (type.includes('powerpoint') || type.includes('ppt')) return 'ri-file-ppt-line text-warning';
    return 'ri-file-line text-secondary';
  }
}
