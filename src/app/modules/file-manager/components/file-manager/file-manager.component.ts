import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FileManagerService } from '../../services/file-manager.service';
import { 
  FileItemModel, 
  FolderModel, 
  FileManagerStats,
  CreateFolderRequest 
} from '../../models/file-manager.model';
import { UploadModalComponent } from '../upload-modal/upload-modal.component';
import { FilePreviewModalComponent } from '../file-preview-modal/file-preview-modal.component';
import { Subject, takeUntil, BehaviorSubject, combineLatest } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-file-manager',
  templateUrl: './file-manager.component.html',
  styleUrls: ['./file-manager.component.scss']
})
export class FileManagerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Data properties
  files: FileItemModel[] = [];
  folders: FolderModel[] = [];
  currentFolder: FolderModel | null = null;
  activeCases: any[] = [];
  stats: FileManagerStats | null = null;
  recentFiles: FileItemModel[] = [];
  
  // UI state properties
  isLoading = false;
  searchTerm = '';
  selectedFiles: number[] = [];
  selectedFolders: number[] = [];
  selectedFile: FileItemModel | null = null;
  viewMode: 'grid' | 'list' = 'grid';
  sortBy = 'createdAt';
  sortDirection = 'DESC';
  isCollapsed = false;
  
  // Form properties
  folderForm: any;
  submitted = false;
  deleteId: number | null = null;
  
  // Upload properties
  uploadProgress: any[] = [];
  selectedUploadFiles: File[] = [];
  isDragOver = false;
  
  // Context menu properties
  contextMenu = {
    visible: false,
    x: 0,
    y: 0,
    target: null as any,
    type: '' as 'file' | 'folder'
  };
  
  // Clipboard for copy/paste
  clipboard: {
    items: any[],
    operation: 'copy' | 'cut' | null
  } = {
    items: [],
    operation: null
  };
  
  // Inline editing
  editingItem: { id: number, type: 'file' | 'folder', newName: string } | null = null;
  
  // Pagination
  currentPage = 0;
  pageSize = 50;
  totalFiles = 0;
  totalPages = 0;

  // Search functionality
  private searchSubject = new BehaviorSubject<string>('');
  
  // Sidebar section expansion states
  activeCasesExpanded = true;
  categoriesExpanded = true;
  activityExpanded = true;
  
  // Navigation breadcrumb
  breadcrumb: any[] = [];

  constructor(
    private fileManagerService: FileManagerService,
    private modalService: NgbModal,
    private cdr: ChangeDetectorRef,
    private formBuilder: FormBuilder
  ) {
    this.folderForm = this.formBuilder.group({
      name: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.initializeData();
    this.setupSearchSubscription();
    this.subscribeToDataStreams();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialize component data
   */
  private initializeData(): void {
    this.isLoading = true;
    
    // Load initial data
    combineLatest([
      this.fileManagerService.getFiles(this.currentPage, this.pageSize, this.sortBy, this.sortDirection),
      this.fileManagerService.getRootFolders(),
      this.fileManagerService.getStorageStats(),
      this.fileManagerService.getActiveCases(),
      this.fileManagerService.getRecentFiles(5)
    ]).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: ([filesResponse, folders, stats, cases, recentFiles]) => {
        this.files = filesResponse.content || [];
        this.totalFiles = filesResponse.totalElements || 0;
        this.totalPages = filesResponse.totalPages || 0;
        
        this.folders = folders;
        this.stats = stats;
        this.activeCases = cases.content || [];
        this.recentFiles = recentFiles;
        
        this.updateBreadcrumb();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading file manager data:', error);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Subscribe to real-time data streams
   */
  private subscribeToDataStreams(): void {
    // Subscribe to files stream
    this.fileManagerService.files$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(files => {
      this.files = files;
      this.cdr.detectChanges();
    });

    // Subscribe to folders stream
    this.fileManagerService.folders$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(folders => {
      this.folders = folders;
      this.cdr.detectChanges();
    });

    // Subscribe to current folder stream
    this.fileManagerService.currentFolder$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(folder => {
      this.currentFolder = folder;
      this.updateBreadcrumb();
      this.cdr.detectChanges();
    });
  }

  /**
   * Setup search functionality
   */
  private setupSearchSubscription(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchTerm => {
      if (searchTerm.trim()) {
        this.performSearch(searchTerm);
      } else {
        this.loadCurrentFolderContents();
      }
    });
  }

  /**
   * Handle search input
   */
  onSearchChange(term: string): void {
    this.searchTerm = term;
    this.searchSubject.next(term);
  }

  /**
   * Perform search
   */
  private performSearch(query: string): void {
    this.isLoading = true;
    
    this.fileManagerService.searchFiles(query, this.currentPage, this.pageSize).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        this.files = response.content || [];
        this.totalFiles = response.totalElements || 0;
        this.totalPages = response.totalPages || 0;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Search error:', error);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Navigate to folder
   */
  navigateToFolder(folder: FolderModel): void {
    this.isLoading = true;
    this.currentFolder = folder;
    
    this.fileManagerService.getFolderContents(folder.id).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        this.files = response.files || [];
        this.folders = response.folders || [];
        this.updateBreadcrumb();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error navigating to folder:', error);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Navigate to root
   */
  navigateToRoot(): void {
    this.currentFolder = null;
    this.loadRootContents();
  }

  /**
   * Navigate to parent folder
   */
  navigateToParent(): void {
    if (this.currentFolder?.parentId) {
      this.fileManagerService.getFolderById(this.currentFolder.parentId).pipe(
        takeUntil(this.destroy$)
      ).subscribe(folder => {
        this.navigateToFolder(folder);
      });
    } else {
      this.navigateToRoot();
    }
  }

  /**
   * Load root folder contents
   */
  private loadRootContents(): void {
    this.isLoading = true;
    
    combineLatest([
      this.fileManagerService.getFiles(this.currentPage, this.pageSize, this.sortBy, this.sortDirection),
      this.fileManagerService.getRootFolders()
    ]).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: ([filesResponse, folders]) => {
        this.files = filesResponse.content || [];
        this.folders = folders;
        this.updateBreadcrumb();
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Load current folder contents
   */
  private loadCurrentFolderContents(): void {
    if (this.currentFolder) {
      this.navigateToFolder(this.currentFolder);
    } else {
      this.loadRootContents();
    }
  }

  /**
   * Create new folder
   */
  createNewFolder(): void {
    const folderName = prompt('Enter folder name:');
    if (folderName?.trim()) {
      const request: CreateFolderRequest = {
        name: folderName.trim(),
        parentId: this.currentFolder?.id
      };
      
      this.fileManagerService.createFolder(request).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: () => {
          this.loadCurrentFolderContents();
        },
        error: (error) => {
          console.error('Error creating folder:', error);
          alert('Failed to create folder: ' + error.message);
        }
      });
    }
  }

  /**
   * Delete selected items
   */
  deleteSelectedItems(): void {
    if (this.selectedFiles.length === 0 && this.selectedFolders.length === 0) {
      return;
    }

    const confirmed = confirm(`Are you sure you want to delete ${this.selectedFiles.length + this.selectedFolders.length} item(s)?`);
    if (confirmed) {
      this.fileManagerService.bulkDelete(this.selectedFiles, this.selectedFolders).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: () => {
          this.selectedFiles = [];
          this.selectedFolders = [];
          this.loadCurrentFolderContents();
        },
        error: (error) => {
          console.error('Delete error:', error);
          alert('Failed to delete items: ' + error.message);
        }
      });
    }
  }

  /**
   * Download selected files
   */
  downloadSelectedFiles(): void {
    if (this.selectedFiles.length === 0) {
      return;
    }

    if (this.selectedFiles.length === 1) {
      // Single file download
      this.downloadFile(this.selectedFiles[0]);
    } else {
      // Bulk download as ZIP
      this.fileManagerService.bulkDownload(this.selectedFiles).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (blob) => {
          this.downloadBlob(blob, 'files.zip');
        },
        error: (error) => {
          console.error('Download error:', error);
          alert('Failed to download files: ' + error.message);
        }
      });
    }
  }

  /**
   * Download single file
   */
  downloadFile(fileId: number): void {
    const file = this.files.find(f => f.id === fileId);
    if (!file) return;

    this.fileManagerService.downloadFile(fileId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (blob) => {
        this.downloadBlob(blob, file.originalName);
      },
      error: (error) => {
        console.error('Download error:', error);
        alert('Failed to download file: ' + error.message);
      }
    });
  }

  /**
   * Helper method to download blob
   */
  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Toggle file selection
   */
  toggleFileSelection(fileId: number): void {
    const index = this.selectedFiles.indexOf(fileId);
    if (index > -1) {
      this.selectedFiles.splice(index, 1);
    } else {
      this.selectedFiles.push(fileId);
    }
  }

  /**
   * Toggle folder selection
   */
  toggleFolderSelection(folderId: number): void {
    const index = this.selectedFolders.indexOf(folderId);
    if (index > -1) {
      this.selectedFolders.splice(index, 1);
    } else {
      this.selectedFolders.push(folderId);
    }
  }

  /**
   * Select all files
   */
  selectAllFiles(): void {
    this.selectedFiles = this.files.map(f => f.id);
  }

  /**
   * Clear all selections
   */
  clearSelections(): void {
    this.selectedFiles = [];
    this.selectedFolders = [];
  }

  /**
   * Toggle view mode
   */
  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
  }

  /**
   * Change sorting
   */
  changeSorting(sortBy: string): void {
    if (this.sortBy === sortBy) {
      this.sortDirection = this.sortDirection === 'ASC' ? 'DESC' : 'ASC';
    } else {
      this.sortBy = sortBy;
      this.sortDirection = 'DESC';
    }
    this.loadCurrentFolderContents();
  }

  /**
   * Load next page
   */
  loadNextPage(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.loadCurrentFolderContents();
    }
  }

  /**
   * Load previous page
   */
  loadPreviousPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.loadCurrentFolderContents();
    }
  }

  /**
   * Update breadcrumb navigation
   */
  private updateBreadcrumb(): void {
    this.breadcrumb = [];
    
    if (!this.currentFolder) {
      this.breadcrumb.push({ name: 'Root', folder: null });
      return;
    }

    // Build breadcrumb path
    let folder = this.currentFolder;
    const path = [folder];
    
    while (folder.parentName) {
      // Note: This is a simplified approach
      // In a real implementation, you'd need to fetch parent folders
      path.unshift({ id: folder.parentId, name: folder.parentName } as FolderModel);
      break; // Simplified for now
    }

    this.breadcrumb.push({ name: 'Root', folder: null });
    path.forEach(f => {
      this.breadcrumb.push({ name: f.name, folder: f });
    });
  }

  /**
   * Navigate via breadcrumb
   */
  navigateViaBreadcrumb(item: any): void {
    if (item.folder) {
      this.navigateToFolder(item.folder);
    } else {
      this.navigateToRoot();
    }
  }

  /**
   * Toggle sidebar section expansion
   */
  toggleSection(section: string): void {
    switch (section) {
      case 'activeCases':
        this.activeCasesExpanded = !this.activeCasesExpanded;
        break;
      case 'categories':
        this.categoriesExpanded = !this.categoriesExpanded;
        break;
      case 'activity':
        this.activityExpanded = !this.activityExpanded;
        break;
    }
  }

  /**
   * Get file type icon
   */
  getFileIcon(file: FileItemModel): string {
    return file.icon || 'ri-file-fill';
  }
  
  /**
   * Get file type category
   */
  getFileTypeCategory(mimeType: string): string {
    return this.fileManagerService.getFileTypeCategory(mimeType);
  }
  
  /**
   * Track by function for files
   */
  trackByFileId(index: number, file: FileItemModel): number {
    return file.id;
  }
  
  /**
   * Track by function for folders
   */
  trackByFolderId(index: number, folder: FolderModel): number {
    return folder.id;
  }
  
  /**
   * Change filter
   */
  changeFilter(filter: string): void {
    // Implement filter logic based on filter type
    console.log('Filter changed to:', filter);
  }
  
  /**
   * Open modal
   */
  openModal(content: any): void {
    this.modalService.open(content);
  }
  
  /**
   * Edit folder modal
   */
  editFolderModal(content: any, folder: FolderModel): void {
    // Set up form for editing
    this.modalService.open(content);
  }
  
  /**
   * Edit file modal
   */
  editFileModal(content: any, file: FileItemModel): void {
    // Set up form for editing
    this.modalService.open(content);
  }
  
  /**
   * Confirm delete folder
   */
  confirmDeleteFolder(modal: any, folderId: number): void {
    this.deleteId = folderId;
    this.modalService.open(modal);
  }
  
  /**
   * Confirm delete file
   */
  confirmDeleteFile(modal: any, fileId: number): void {
    this.deleteId = fileId;
    this.modalService.open(modal);
  }
  
  /**
   * Delete folder
   */
  deleteFolder(folderId: number): void {
    if (folderId) {
      this.fileManagerService.deleteFolder(folderId).subscribe({
        next: () => {
          this.loadCurrentFolderContents();
        },
        error: (error) => {
          console.error('Error deleting folder:', error);
        }
      });
    }
  }
  
  /**
   * Delete file
   */
  deleteFile(fileId: number): void {
    if (fileId) {
      this.fileManagerService.deleteFile(fileId).subscribe({
        next: () => {
          this.loadCurrentFolderContents();
        },
        error: (error) => {
          console.error('Error deleting file:', error);
        }
      });
    }
  }
  
  /**
   * Save folder
   */
  saveFolder(): void {
    // Implement save folder logic
    console.log('Save folder');
  }
  
  /**
   * Close detail panel
   */
  closeDetailPanel(): void {
    this.selectedFile = null;
  }
  
  /**
   * Handle drag over
   */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }
  
  /**
   * Handle drag leave
   */
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }
  
  /**
   * Handle file dropped
   */
  onFileDropped(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    const files = event.dataTransfer?.files;
    if (files) {
      this.handleFileSelection(Array.from(files));
    }
  }
  
  /**
   * Handle file selected
   */
  onFileSelected(event: any): void {
    const files = event.target.files;
    if (files) {
      this.handleFileSelection(Array.from(files));
    }
  }
  
  /**
   * Handle file selection
   */
  private handleFileSelection(files: File[]): void {
    this.selectedUploadFiles = Array.from(files);
    this.uploadProgress = files.map(file => ({
      fileName: file.name,
      progress: 0,
      size: file.size,
      status: 'pending'
    }));
  }
  
  /**
   * Start upload
   */
  startUpload(): void {
    if (this.selectedUploadFiles.length === 0) return;
    
    this.selectedUploadFiles.forEach((file, index) => {
      this.uploadProgress[index].status = 'uploading';
      
      this.fileManagerService.uploadFile(
        file, 
        this.currentFolder?.id, 
        undefined, // caseId - can be set later
        'OTHER',   // documentCategory
        'DRAFT'    // documentStatus
      ).subscribe({
        next: (response: any) => {
          if (response.type === 'UploadProgress') {
            this.uploadProgress[index].progress = response.progress;
          } else {
            this.uploadProgress[index].progress = 100;
            this.uploadProgress[index].status = 'completed';
          }
        },
        error: (error) => {
          this.uploadProgress[index].status = 'error';
          console.error('Upload error:', error);
        },
        complete: () => {
          if (this.uploadProgress[index].status !== 'error') {
            this.uploadProgress[index].status = 'completed';
            this.loadCurrentFolderContents();
          }
        }
      });
    });
  }
  
  /**
   * Remove selected file from upload list
   */
  removeSelectedFile(index: number): void {
    this.selectedUploadFiles.splice(index, 1);
    this.uploadProgress.splice(index, 1);
  }
  
  /**
   * Clear upload
   */
  clearUpload(): void {
    this.selectedUploadFiles = [];
    this.uploadProgress = [];
  }
  
  /**
   * Check if upload is in progress
   */
  get isUploading(): boolean {
    return this.uploadProgress.some(p => p.status === 'uploading');
  }
  
  /**
   * Get upload button text
   */
  get uploadButtonText(): string {
    return this.isUploading ? 'Uploading...' : 'Upload Files';
  }
  
  /**
   * Check if upload button should be disabled
   */
  get isUploadDisabled(): boolean {
    return this.selectedUploadFiles.length === 0 || this.isUploading;
  }
  
  /**
   * Hide context menu
   */
  hideContextMenu(): void {
    this.contextMenu.visible = false;
  }
  
  /**
   * Handle context menu action
   */
  handleContextAction(action: string): void {
    const target = this.contextMenu.target;
    
    switch (action) {
      case 'open':
        if (this.contextMenu.type === 'file') {
          this.previewFile(target);
        } else {
          this.navigateToFolder(target);
        }
        break;
      case 'download':
        if (this.contextMenu.type === 'file') {
          this.downloadFile(target.id);
        }
        break;
      case 'rename':
        this.startRename(target);
        break;
      case 'delete':
        if (this.contextMenu.type === 'file') {
          this.confirmDeleteFile(this.deleteFile, target.id);
        } else {
          this.confirmDeleteFolder(this.deleteFolder, target.id);
        }
        break;
      case 'star':
        if (this.contextMenu.type === 'file') {
          this.toggleStar(target);
        }
        break;
      case 'copy':
        this.copyToClipboard(target);
        break;
      case 'cut':
        this.cutToClipboard(target);
        break;
      case 'paste':
        this.pasteFromClipboard();
        break;
    }
    
    this.hideContextMenu();
  }
  
  /**
   * Start rename operation (inline editing)
   */
  startRename(item: any): void {
    this.editingItem = {
      id: item.id,
      type: this.contextMenu.type,
      newName: item.name
    };
  }
  
  /**
   * Save rename
   */
  saveRename(): void {
    if (!this.editingItem) return;
    
    if (this.editingItem.type === 'file') {
      this.fileManagerService.updateFile(this.editingItem.id, this.editingItem.newName).subscribe({
        next: () => {
          this.loadCurrentFolderContents();
          this.editingItem = null;
        },
        error: (error) => {
          console.error('Rename error:', error);
          this.editingItem = null;
        }
      });
    } else {
      this.fileManagerService.updateFolder(this.editingItem.id, this.editingItem.newName).subscribe({
        next: () => {
          this.loadCurrentFolderContents();
          this.editingItem = null;
        },
        error: (error) => {
          console.error('Rename error:', error);
          this.editingItem = null;
        }
      });
    }
  }
  
  /**
   * Cancel rename
   */
  cancelRename(): void {
    this.editingItem = null;
  }
  
  /**
   * Copy to clipboard
   */
  copyToClipboard(item: any): void {
    this.clipboard = {
      items: [item],
      operation: 'copy'
    };
  }
  
  /**
   * Cut to clipboard
   */
  cutToClipboard(item: any): void {
    this.clipboard = {
      items: [item],
      operation: 'cut'
    };
  }
  
  /**
   * Paste from clipboard
   */
  pasteFromClipboard(): void {
    if (this.clipboard.items.length === 0) return;
    
    this.clipboard.items.forEach(item => {
      if (this.clipboard.operation === 'copy') {
        // Copy file/folder to current location
        console.log('Copy operation:', item);
        // TODO: Implement actual copy API call
      } else if (this.clipboard.operation === 'cut') {
        // Move file/folder to current location
        console.log('Move operation:', item);
        // TODO: Implement actual move API call
      }
    });
    
    if (this.clipboard.operation === 'cut') {
      this.clipboard = { items: [], operation: null };
    }
  }
  
  /**
   * Start move operation
   */
  startMove(item: any): void {
    this.cutToClipboard(item);
  }
  
  /**
   * Handle keyboard shortcuts
   */
  @HostListener('document:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'c':
          if (this.selectedFiles.length > 0) {
            event.preventDefault();
            const items = this.files.filter(f => this.selectedFiles.includes(f.id));
            this.clipboard = { items, operation: 'copy' };
          }
          break;
        case 'x':
          if (this.selectedFiles.length > 0) {
            event.preventDefault();
            const items = this.files.filter(f => this.selectedFiles.includes(f.id));
            this.clipboard = { items, operation: 'cut' };
          }
          break;
        case 'v':
          if (this.clipboard.items.length > 0) {
            event.preventDefault();
            this.pasteFromClipboard();
          }
          break;
        case 'a':
          event.preventDefault();
          this.selectAllFiles();
          break;
      }
    }
    
    // Other shortcuts
    switch (event.key) {
      case 'Delete':
        if (this.selectedFiles.length > 0) {
          event.preventDefault();
          this.deleteSelectedItems();
        }
        break;
      case 'F2':
        if (this.selectedFiles.length === 1) {
          event.preventDefault();
          const file = this.files.find(f => f.id === this.selectedFiles[0]);
          if (file) this.startRename(file);
        }
        break;
      case 'Escape':
        this.clearSelections();
        this.hideContextMenu();
        this.cancelRename();
        break;
    }
  }
  
  /**
   * Check if item is being edited
   */
  isEditing(item: any, type: 'file' | 'folder'): boolean {
    return this.editingItem?.id === item.id && this.editingItem?.type === type;
  }

  /**
   * Get file type color
   */
  getFileIconColor(file: FileItemModel): string {
    return file.iconColor || 'secondary';
  }

  /**
   * Format file size
   */
  formatFileSize(size: number): string {
    return this.fileManagerService.formatFileSize(size);
  }

  /**
   * Check if file is selected
   */
  isFileSelected(fileId: number): boolean {
    return this.selectedFiles.includes(fileId);
  }

  /**
   * Check if folder is selected
   */
  isFolderSelected(folderId: number): boolean {
    return this.selectedFolders.includes(folderId);
  }

  /**
   * Check if any items are selected
   */
  hasSelections(): boolean {
    return this.selectedFiles.length > 0 || this.selectedFolders.length > 0;
  }

  /**
   * Get selection count
   */
  getSelectionCount(): number {
    return this.selectedFiles.length + this.selectedFolders.length;
  }

  /**
   * Open upload modal
   */
  openUploadModal(): void {
    const modalRef = this.modalService.open(UploadModalComponent, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false
    });

    // Pass current context to modal
    modalRef.componentInstance.folderId = this.currentFolder?.id;
    modalRef.componentInstance.folderName = this.currentFolder?.name;
    
    modalRef.result.then(
      (result) => {
        if (result) {
          // Refresh current folder contents after upload
          this.loadCurrentFolderContents();
        }
      },
      (dismissed) => {
        // Modal was dismissed
      }
    );
  }

  /**
   * Preview file
   */
  previewFile(file: FileItemModel): void {
    this.selectedFile = file;
  }

  /**
   * Toggle star status
   */
  toggleStar(file: FileItemModel): void {
    this.fileManagerService.toggleFileStar(file.id).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (updatedFile) => {
        const index = this.files.findIndex(f => f.id === file.id);
        if (index !== -1) {
          this.files[index] = updatedFile;
        }
      },
      error: (error) => {
        console.error('Error toggling star:', error);
      }
    });
  }

  /**
   * Show file context menu
   */
  showFileContextMenu(event: MouseEvent, file: FileItemModel): void {
    event.preventDefault();
    this.contextMenu = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      target: file,
      type: 'file'
    };
    
    // Hide menu when clicking elsewhere
    setTimeout(() => {
      document.addEventListener('click', this.hideContextMenu.bind(this), { once: true });
    });
  }

  /**
   * Show folder context menu
   */
  showFolderContextMenu(event: MouseEvent, folder: FolderModel): void {
    event.preventDefault();
    this.contextMenu = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      target: folder,
      type: 'folder'
    };
    
    // Hide menu when clicking elsewhere
    setTimeout(() => {
      document.addEventListener('click', this.hideContextMenu.bind(this), { once: true });
    });
  }

  /**
   * Show file menu (placeholder)
   */
  showFileMenu(file: FileItemModel): void {
    // TODO: Implement file menu
  }

  /**
   * Show folder menu (placeholder)
   */
  showFolderMenu(folder: FolderModel): void {
    // TODO: Implement folder menu
  }

  /**
   * Filter by case
   */
  filterByCase(caseId: number): void {
    this.isLoading = true;
    
    this.fileManagerService.getFilesByCase(caseId, 0, this.pageSize).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        this.files = response.content || [];
        this.folders = []; // Clear folders when filtering by case
        this.totalFiles = response.totalElements || 0;
        this.totalPages = response.totalPages || 0;
        this.currentPage = 0;
        
        // Update breadcrumb to show case filter
        const selectedCase = this.activeCases.find(c => c.id === caseId);
        this.breadcrumb = [
          { name: 'Root', folder: null },
          { name: `Case: ${selectedCase?.title || 'Unknown'}`, folder: null }
        ];
        
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error filtering by case:', error);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Go to specific page
   */
  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.loadCurrentFolderContents();
    }
  }
  
  /**
   * Current page for pagination (1-based)
   */
  get currentPageDisplay(): number {
    return this.currentPage + 1;
  }
  
  set currentPageDisplay(page: number) {
    this.goToPage(page - 1);
  }

  /**
   * Math utility for template
   */
  Math = Math;
}