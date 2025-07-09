import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { FileManagerService } from '../../services/file-manager.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-file-upload',
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.scss']
})
export class FileUploadComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @Input() folderId?: number;
  @Input() caseId?: number;
  @Input() documentCategory?: string;
  @Input() documentStatus: string = 'draft';
  @Input() multiple: boolean = true;
  @Input() maxFileSize: number = 100 * 1024 * 1024; // 100MB
  @Input() acceptedTypes: string = '*/*';
  @Input() hideUploadButton: boolean = false;

  @Output() uploadComplete = new EventEmitter<any>();
  @Output() uploadError = new EventEmitter<string>();
  @Output() uploadProgress = new EventEmitter<number>();

  selectedFiles: File[] = [];
  isDragOver = false;
  isUploading = false;
  uploadedFiles: any[] = [];
  errors: string[] = [];

  constructor(private fileManagerService: FileManagerService) { }

  ngOnInit(): void {
    // Component initialization
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Handle file selection from input
   */
  onFileSelected(event: any): void {
    const files = Array.from(event.target.files) as File[];
    this.addFiles(files);
  }

  /**
   * Handle drag over
   */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  /**
   * Handle drag leave
   */
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  /**
   * Handle file drop
   */
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const files = Array.from(event.dataTransfer?.files || []) as File[];
    this.addFiles(files);
  }

  /**
   * Add files to selection
   */
  addFiles(files: File[]): void {
    this.errors = [];
    
    const validFiles = files.filter(file => this.validateFile(file));
    
    if (this.multiple) {
      this.selectedFiles = [...this.selectedFiles, ...validFiles];
    } else {
      this.selectedFiles = validFiles.slice(0, 1);
    }
  }

  /**
   * Validate file
   */
  validateFile(file: File): boolean {
    // Check file size
    if (file.size > this.maxFileSize) {
      this.errors.push(`${file.name} is too large. Maximum size is ${this.formatFileSize(this.maxFileSize)}`);
      return false;
    }

    // Check file type if specific types are accepted
    if (this.acceptedTypes !== '*/*') {
      const acceptedTypesArray = this.acceptedTypes.split(',').map(type => type.trim());
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      const mimeType = file.type;

      const isAccepted = acceptedTypesArray.some(type => 
        type === fileExtension || 
        type === mimeType || 
        (type.endsWith('/*') && mimeType.startsWith(type.replace('/*', '')))
      );

      if (!isAccepted) {
        this.errors.push(`${file.name} is not an accepted file type`);
        return false;
      }
    }

    return true;
  }

  /**
   * Remove file from selection
   */
  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
  }

  /**
   * Clear all selected files
   */
  clearFiles(): void {
    this.selectedFiles = [];
    this.errors = [];
  }

  /**
   * Upload selected files
   */
  uploadFiles(): void {
    if (this.selectedFiles.length === 0) {
      return;
    }

    this.isUploading = true;
    this.uploadedFiles = [];
    this.errors = [];

    if (this.selectedFiles.length === 1) {
      this.uploadSingleFile(this.selectedFiles[0]);
    } else {
      this.uploadMultipleFiles();
    }
  }

  /**
   * Upload single file
   */
  private uploadSingleFile(file: File): void {
    this.fileManagerService.uploadFile(
      file, 
      this.folderId, 
      this.caseId, 
      this.documentCategory, 
      this.documentStatus
    ).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.uploadedFiles.push(response);
          this.uploadComplete.emit(response);
          this.isUploading = false;
          this.selectedFiles = [];
        }
      },
      error: (error) => {
        this.errors.push(`Failed to upload ${file.name}: ${error.message}`);
        this.uploadError.emit(error.message);
        this.isUploading = false;
      }
    });
  }

  /**
   * Upload multiple files
   */
  private uploadMultipleFiles(): void {
    this.fileManagerService.uploadMultipleFiles(
      this.selectedFiles, 
      this.folderId, 
      this.caseId, 
      this.documentCategory, 
      this.documentStatus
    ).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.uploadedFiles.push(response);
          this.uploadComplete.emit(response);
          this.isUploading = false;
          this.selectedFiles = [];
        }
      },
      error: (error) => {
        this.errors.push(`Failed to upload files: ${error.message}`);
        this.uploadError.emit(error.message);
        this.isUploading = false;
      }
    });
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get file icon based on type
   */
  getFileIcon(file: File): string {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const mimeType = file.type;

    if (mimeType.startsWith('image/')) return 'ri-image-2-fill';
    if (mimeType.startsWith('video/')) return 'ri-video-fill';
    if (mimeType.startsWith('audio/')) return 'ri-music-2-fill';
    if (mimeType.includes('pdf')) return 'ri-file-pdf-fill';
    if (mimeType.includes('word') || extension === 'doc' || extension === 'docx') return 'ri-file-word-fill';
    if (mimeType.includes('excel') || extension === 'xls' || extension === 'xlsx') return 'ri-file-excel-fill';
    if (mimeType.includes('powerpoint') || extension === 'ppt' || extension === 'pptx') return 'ri-file-ppt-fill';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'ri-file-zip-fill';
    if (mimeType.startsWith('text/') || extension === 'txt') return 'ri-file-text-fill';
    
    return 'ri-file-fill';
  }

  /**
   * Get file icon color based on type
   */
  getFileIconColor(file: File): string {
    const mimeType = file.type;

    if (mimeType.startsWith('image/')) return 'success';
    if (mimeType.startsWith('video/')) return 'danger';
    if (mimeType.startsWith('audio/')) return 'info';
    if (mimeType.includes('pdf')) return 'danger';
    if (mimeType.includes('word')) return 'primary';
    if (mimeType.includes('excel')) return 'success';
    if (mimeType.includes('powerpoint')) return 'warning';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'warning';
    
    return 'secondary';
  }

  /**
   * Get optimized accept types to improve file picker performance
   * Empty accept attribute can cause performance issues on Windows
   */
  getOptimizedAcceptTypes(): string {
    if (this.acceptedTypes === '*/*' || !this.acceptedTypes) {
      return '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.odt,.ods,.odp,.jpg,.jpeg,.png,.gif,.bmp,.svg,.mp4,.avi,.mov,.mp3,.wav,.zip,.rar,.7z';
    }
    return this.acceptedTypes;
  }
}