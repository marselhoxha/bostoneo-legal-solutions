import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { FileManagerService } from '../../services/file-manager.service';
import { Subject, takeUntil } from 'rxjs';
import { NotificationManagerService, NotificationCategory, NotificationPriority } from '../../../../core/services/notification-manager.service';
import { UserService } from '../../../../service/user.service';
import { CaseService } from '../../../legal/services/case.service';
import { NotificationTemplatesService, NotificationContext } from '../../../../core/services/notification-templates.service';

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

  constructor(
    private fileManagerService: FileManagerService,
    private notificationManager: NotificationManagerService,
    private userService: UserService,
    private caseService: CaseService,
    private notificationTemplates: NotificationTemplatesService
  ) { }

  ngOnInit(): void {
    // Component initialization
  }

  /**
   * Send notification when file is uploaded using enhanced templates
   */
  private async notifyFileUploaded(fileName: string, uploadType: 'single' | 'multiple'): Promise<void> {
    try {
      // Get current user information
      const currentUser = this.userService.getCurrentUser();
      const userName = currentUser?.firstName && currentUser?.lastName 
        ? `${currentUser.firstName} ${currentUser.lastName}`
        : currentUser?.email || 'A user';

      // If case-related, notify case team members
      let recipients = { primaryUsers: [] as any[], secondaryUsers: [] as any[] };
      let caseDetails: any = null;
      
      if (this.caseId) {
        const caseTeamMembers = await this.notificationManager.getCaseTeamMembers(this.caseId);
        recipients.primaryUsers = caseTeamMembers;
        
        // Try to get case details for more descriptive notifications
        try {
          const caseResponse = await this.caseService.getCaseById(this.caseId.toString()).toPromise();
          caseDetails = caseResponse?.data?.case;
        } catch (error) {
          console.warn('Could not fetch case details for notification:', error);
        }
      } else {
        // FOR TESTING: Send to ALL users in the database
        // Get all users by getting all different role types and combining them
        const roleAdmins = await this.notificationManager.getUsersByRole('ROLE_ADMIN');
        const roleManagers = await this.notificationManager.getUsersByRole('ROLE_MANAGER');  
        const roleAttorneys = await this.notificationManager.getUsersByRole('ROLE_ATTORNEY');
        const roleUsers = await this.notificationManager.getUsersByRole('ROLE_USER');
        const roleParalegals = await this.notificationManager.getUsersByRole('ROLE_PARALEGAL');
        const roleSecretaries = await this.notificationManager.getUsersByRole('ROLE_SECRETARY');
        
        // Combine all users from different roles
        const allUsers = [
          ...roleAdmins,
          ...roleManagers, 
          ...roleAttorneys,
          ...roleUsers,
          ...roleParalegals,
          ...roleSecretaries
        ];
        
        // Deduplicate users by ID (in case someone has multiple roles)
        const uniqueUsers = allUsers.filter((user, index, arr) =>
          arr.findIndex(u => u.id === user.id) === index
        );
        
        recipients = {
          primaryUsers: uniqueUsers, // Send to everyone for testing
          secondaryUsers: [] // No secondary users needed
        };
      }

      // Create notification context for the template
      const notificationContext: NotificationContext = {
        userName,
        fileName: uploadType === 'single' ? fileName : undefined,
        fileCount: uploadType === 'multiple' ? parseInt(fileName.split(' ')[0]) : undefined,
        caseName: caseDetails?.title,
        caseNumber: caseDetails?.caseNumber,
        caseId: this.caseId,
        section: this.caseId ? 'Legal Cases' : 'Document Management',
        area: this.caseId ? 'Case Management' : 'File Manager',
        timestamp: new Date().toISOString(),
        additionalInfo: {
          documentCategory: this.documentCategory,
          folderId: this.folderId,
          uploadedBy: {
            id: currentUser?.id,
            name: userName,
            email: currentUser?.email
          }
        }
      };

      // Generate professional notification using template
      const notification = this.notificationTemplates.generateFileUploadNotification(notificationContext);
      
      // DISABLED: Frontend should NOT send notifications - backend handles this properly
      // The backend FileManagerServiceImpl determines the correct recipients based on case assignments
      // await this.notificationManager.sendNotification(
      //   NotificationCategory.FILES,
      //   notification.title,
      //   notification.message,
      //   NotificationPriority.NORMAL, // Use normal priority as per template
      //   recipients,
      //   this.caseId ? `/legal/cases/details/${this.caseId}` : `/file-manager`,
      //   {
      //     entityId: this.caseId || this.folderId || null,
      //     entityType: this.caseId ? 'case_document' : 'file',
      //     additionalData: {
      //       fileName: uploadType === 'single' ? fileName : `${notificationContext.fileCount} files`,
      //       uploadType,
      //       documentCategory: this.documentCategory,
      //       caseId: this.caseId,
      //       folderId: this.folderId,
      //       uploadedBy: notificationContext.additionalInfo?.uploadedBy,
      //       context: {
      //         area: notificationContext.area,
      //         section: notificationContext.section,
      //         caseName: notificationContext.caseName,
      //         caseNumber: notificationContext.caseNumber,
      //         caseId: this.caseId,
      //         folderId: this.folderId,
      //         documentCategory: this.documentCategory,
      //         timestamp: notificationContext.timestamp
      //       },
      //       template: {
      //         icon: notification.icon,
      //         priority: notification.priority,
      //         category: 'files'
      //       }
      //     }
      //   }
      // );
    } catch (error) {
      console.error('Failed to send file upload notification:', error);
    }
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
          
          // DISABLED: Backend handles notifications properly
          // this.notifyFileUploaded(file.name, 'single');
          
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
          
          // DISABLED: Backend handles notifications properly
          // this.notifyFileUploaded(`${this.selectedFiles.length} files`, 'multiple');
          
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