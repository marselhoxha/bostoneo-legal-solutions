import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FileManagerService } from '../../services/file-manager.service';
import { FileVersion } from '../../models/file-manager.model';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

@Component({
  selector: 'app-file-version-history', 
  templateUrl: './file-version-history.component.html',
  styleUrls: ['./file-version-history.component.scss']
})
export class FileVersionHistoryComponent implements OnInit, OnDestroy {
  @Input() fileId!: number;
  @Input() fileName!: string;

  versions: FileVersion[] = [];
  isLoading = false;
  isUploading = false;
  uploadProgress = 0;
  error: string | null = null;
  selectedFile: File | null = null;
  versionComment = '';

  private destroy$ = new Subject<void>();

  constructor(
    public activeModal: NgbActiveModal,
    private fileManagerService: FileManagerService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    console.log('FileVersionHistoryComponent initialized with:', { fileId: this.fileId, fileName: this.fileName });
    
    if (this.fileId && this.fileId !== undefined && this.fileId !== null) {
      this.loadVersionHistory();
    } else {
      this.error = 'File ID is required to load version history.';
      console.error('FileVersionHistoryComponent: Missing or invalid fileId:', this.fileId);
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load version history for the file
   */
  loadVersionHistory(): void {
    this.isLoading = true;
    this.error = null;
    this.cdr.detectChanges();

    this.fileManagerService.getFileVersions(this.fileId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (versions) => {
          this.versions = versions || [];
          console.log('Loaded versions:', this.versions);
        },
        error: (error) => {
          console.error('Failed to load version history:', error);
          if (error.status === 404) {
            // No versions exist yet - this is normal for new files
            this.versions = [];
            this.error = null;
          } else {
            this.error = 'Failed to load version history. Please try again.';
            this.versions = [];
          }
        }
      });
  }

  /**
   * Handle file selection for upload
   */
  onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      this.selectedFile = file;
      this.error = null;
      this.cdr.detectChanges();
    }
  }

  /**
   * Upload a new version of the file
   */
  uploadNewVersion(): void {
    console.log('uploadNewVersion called with:', { 
      fileId: this.fileId, 
      selectedFile: this.selectedFile?.name, 
      comment: this.versionComment 
    });

    if (!this.selectedFile) {
      this.error = 'Please select a file to upload.';
      this.cdr.detectChanges();
      return;
    }

    if (!this.versionComment.trim()) {
      this.error = 'Please provide a comment for this version.';
      this.cdr.detectChanges();
      return;
    }

    if (!this.fileId || this.fileId === undefined || this.fileId === null) {
      this.error = 'Invalid file ID. Cannot upload version.';
      console.error('Upload failed: Invalid fileId:', this.fileId);
      this.cdr.detectChanges();
      return;
    }

    this.isUploading = true;
    this.uploadProgress = 0;
    this.error = null;
    this.cdr.detectChanges();

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      if (this.uploadProgress < 90) {
        this.uploadProgress += Math.random() * 20;
        this.cdr.detectChanges();
      }
    }, 200);

    console.log('Calling uploadNewVersion service with fileId:', this.fileId);

    this.fileManagerService.uploadNewVersion(this.fileId, this.selectedFile, this.versionComment)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          clearInterval(progressInterval);
          this.isUploading = false;
          this.uploadProgress = 100;
          setTimeout(() => {
            this.uploadProgress = 0;
            this.cdr.detectChanges();
          }, 1000);
        })
      )
      .subscribe({
        next: (newVersion) => {
          console.log('New version uploaded successfully:', newVersion);
          this.selectedFile = null;
          this.versionComment = '';
          
          // Clear the file input
          const fileInput = document.getElementById('versionFile') as HTMLInputElement;
          if (fileInput) {
            fileInput.value = '';
          }
          
          // Reload version history
          this.loadVersionHistory();
        },
        error: (error) => {
          console.error('Upload failed with error:', error);
          console.error('Error details:', error.error);
          
          let errorMessage = 'Failed to upload new version. Please try again.';
          if (error.status === 404) {
            errorMessage = 'File not found. The file may have been deleted.';
          } else if (error.status === 413) {
            errorMessage = 'File is too large to upload.';
          } else if (error.status === 415) {
            errorMessage = 'File type is not supported.';
          } else if (error.error?.message) {
            errorMessage = error.error.message;
          }
          
          this.error = errorMessage;
          this.uploadProgress = 0;
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Download a specific version
   */
  downloadVersion(version: FileVersion): void {
    if (!version.id) {
      this.error = 'Invalid version ID.';
      this.cdr.detectChanges();
      return;
    }

         this.fileManagerService.downloadFileVersion(version.id)
       .pipe(takeUntil(this.destroy$))
       .subscribe({
         next: (blob) => {
           const url = window.URL.createObjectURL(blob);
           const link = document.createElement('a');
           link.href = url;
           link.download = version.fileName || `version_${version.versionNumber}`;
           document.body.appendChild(link);
           link.click();
           document.body.removeChild(link);
           window.URL.revokeObjectURL(url);
         },
         error: (error) => {
           console.error('Failed to download version:', error);
           this.error = 'Failed to download version. Please try again.';
           this.cdr.detectChanges();
         }
       });
   }

   /**
    * Restore a specific version as current
    */
   restoreVersion(version: FileVersion): void {
    if (!version.id) {
      this.error = 'Invalid version ID.';
      this.cdr.detectChanges();
      return;
    }

    if (confirm(`Are you sure you want to restore version ${version.versionNumber} as the current version?`)) {
      this.fileManagerService.restoreFileVersion(this.fileId, version.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            console.log('Version restored successfully');
            this.loadVersionHistory(); // Reload to show updated current version
          },
          error: (error) => {
            console.error('Failed to restore version:', error);
            this.error = 'Failed to restore version. Please try again.';
            this.cdr.detectChanges();
          }
        });
    }
  }

  /**
   * Delete a specific version
   */
  deleteVersion(version: FileVersion): void {
    if (!version.id) {
      this.error = 'Invalid version ID.';
      this.cdr.detectChanges();
      return;
    }

    if (version.current) {
      this.error = 'Cannot delete the current version.';
      this.cdr.detectChanges();
      return;
    }

    if (confirm(`Are you sure you want to delete version ${version.versionNumber}? This action cannot be undone.`)) {
             this.fileManagerService.deleteFileVersion(version.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            console.log('Version deleted successfully');
            this.loadVersionHistory(); // Reload to show updated list
          },
          error: (error) => {
            console.error('Failed to delete version:', error);
            this.error = 'Failed to delete version. Please try again.';
            this.cdr.detectChanges();
          }
        });
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number | null | undefined): string {
    if (!bytes || bytes === 0) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string | null | undefined): string {
    if (!dateString) return 'Unknown';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Invalid date';
    }
  }

  /**
   * Get version badge class based on version properties
   */
  getVersionBadgeClass(version: FileVersion): string {
    if (version.current) {
      return 'bg-success-subtle text-success';
    }
    return 'bg-primary-subtle text-primary';
  }

  /**
   * Get version badge text
   */
  getVersionBadgeText(version: FileVersion): string {
    if (version.current) {
      return 'Current';
    }
    return `v${version.versionNumber}`;
  }

  /**
   * Check if version can be deleted
   */
  canDeleteVersion(version: FileVersion): boolean {
    return !version.current && !!version.id;
  }

  /**
   * Check if version can be restored
   */
  canRestoreVersion(version: FileVersion): boolean {
    return !version.current && !!version.id;
  }

  /**
   * Clear error message
   */
  clearError(): void {
    this.error = null;
    this.cdr.detectChanges();
  }

  /**
   * Reset upload form
   */
  resetUploadForm(): void {
    this.selectedFile = null;
    this.versionComment = '';
    this.error = null;
    
    const fileInput = document.getElementById('versionFile') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
    
    this.cdr.detectChanges();
  }

  /**
   * Close modal
   */
  close(): void {
    this.activeModal.dismiss();
  }

  /**
   * Track by function for ngFor optimization
   */
  trackByVersionId(index: number, version: FileVersion): any {
    return version.id || index;
  }
}