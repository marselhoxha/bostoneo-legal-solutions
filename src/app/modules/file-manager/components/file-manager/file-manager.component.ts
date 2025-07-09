import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import Swal from 'sweetalert2';
import { FileManagerService } from '../../services/file-manager.service';
import { FileUploadNotificationService } from '../../services/file-upload-notification.service';
import { TemplateService } from '../../services/template.service';
import { 
  FileItemModel, 
  FolderModel, 
  FileManagerStats,
  CreateFolderRequest 
} from '../../models/file-manager.model';
import { UploadModalComponent } from '../upload-modal/upload-modal.component';
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
  
  // Separate personal and case folders
  personalFolders: FolderModel[] = [];
  personalFiles: FileItemModel[] = [];
  
  // UI state properties
  isLoading = false;
  searchTerm = '';
  selectedFiles: number[] = [];
  selectedFolders: number[] = [];
  selectedFile: FileItemModel | null = null;
  viewMode: 'grid' | 'list' = 'grid';
  sortBy = 'createdAt';
  sortDirection = 'DESC';
  
  // Unified navigation state
  navigationState = {
    context: 'personal' as 'personal' | 'case' | 'all',
    caseId: null as number | null,
    caseName: null as string | null,
    folderId: null as number | null,
    folderName: null as string | null,
    filter: null as string | null
  };
  
  // Helper getters for backward compatibility during refactoring
  get navigationContext() { return this.navigationState.context; }
  get selectedCase() { 
    return this.navigationState.caseId ? {
      id: this.navigationState.caseId,
      title: this.navigationState.caseName
    } : null;
  }
  get activeFilter() { return this.navigationState.filter; }
  get breadcrumbContext() { return this.navigationState.context; }
  
  // Case-related state
  caseFolders: FolderModel[] = [];
  caseDocuments: FileItemModel[] = [];
  
  // Form properties
  folderForm: any;
  submitted = false;
  deleteId: number | null = null;
  activeModal: any = null;
  
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
  myDocumentsExpanded = true;
  caseDocumentsExpanded = false;
  quickFiltersExpanded = true;
  
  // Navigation breadcrumb
  breadcrumb: any[] = [];
  
  // Mobile sidebar state
  isMobileSidebarOpen = false;

  constructor(
    private fileManagerService: FileManagerService,
    private fileUploadNotificationService: FileUploadNotificationService,
    private templateService: TemplateService,
    private modalService: NgbModal,
    private cdr: ChangeDetectorRef,
    private formBuilder: FormBuilder
  ) {
    this.folderForm = this.formBuilder.group({
      name: [''],
      caseId: ['', [Validators.required]],
      folderType: ['single', [Validators.required]],
      template: [''],
      inheritPermissions: [true]
    });
    
    // Add dynamic validation based on folder type
    this.folderForm.get('folderType')?.valueChanges.subscribe((value: string) => {
      const nameControl = this.folderForm.get('name');
      const templateControl = this.folderForm.get('template');
      
      if (value === 'single') {
        nameControl?.setValidators([Validators.required]);
        templateControl?.clearValidators();
      } else if (value === 'template') {
        nameControl?.clearValidators();
        templateControl?.setValidators([Validators.required]);
      }
      
      nameControl?.updateValueAndValidity();
      templateControl?.updateValueAndValidity();
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
        // Store personal folders separately (folders without caseId)
        this.personalFolders = folders.filter(folder => !folder.caseId);
        this.stats = stats;
        
        // Initialize active cases with enhanced data
        this.activeCases = (cases.content || []).map((caseItem, index) => ({
          ...caseItem,
          // Add mock document count if not provided by backend
          documentCount: caseItem.documentCount || this.getDefaultDocumentCount(caseItem.id),
          // Add mock client name if not provided
          clientName: caseItem.clientName || this.getMockClientName(index)
        }));
        
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
    this.navigationState.folderId = folder.id;
    this.navigationState.folderName = folder.name;
    
    // Close mobile sidebar when navigating
    this.closeMobileSidebar();
    
    this.fileManagerService.getFolderContents(folder.id).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        // Apply context-based filtering to folder contents
        if (this.navigationState.context === 'personal') {
          // In personal context, only show non-case items
          this.files = (response.files || []).filter(file => !file.caseId);
          this.folders = (response.folders || []).filter(subfolder => !subfolder.caseId);
        } else if (this.navigationState.context === 'case' && this.navigationState.caseId) {
          // In case context, only show items from this specific case
          this.files = (response.files || []).filter(file => file.caseId === this.navigationState.caseId);
          this.folders = (response.folders || []).filter(subfolder => subfolder.caseId === this.navigationState.caseId);
        } else {
          // For other contexts, show all items
          this.files = response.files || [];
          this.folders = response.folders || [];
        }
        
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
   * Navigate to personal folder (always in personal context)
   */
  navigateToPersonalFolder(folder: FolderModel): void {
    // Ensure we're in personal context
    this.navigationState.context = 'personal';
    this.navigationState.caseId = null;
    this.navigationState.caseName = null;
    
    this.isLoading = true;
    this.currentFolder = folder;
    this.navigationState.folderId = folder.id;
    this.navigationState.folderName = folder.name;
    
    // Close mobile sidebar when navigating
    this.closeMobileSidebar();
    
    this.fileManagerService.getFolderContents(folder.id).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        // Always filter to show only non-case items in personal folders
        this.files = (response.files || []).filter(file => !file.caseId);
        this.folders = (response.folders || []).filter(subfolder => !subfolder.caseId);
        
        // Update personal folders for navigation
        this.personalFolders = this.folders.filter(f => !f.caseId);
        
        this.updateBreadcrumb();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error navigating to personal folder:', error);
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
    this.navigationState.folderId = null;
    this.navigationState.folderName = null;
    this.navigationState.filter = null;
    this.loadRootContents();
  }
  
  /**
   * Unified refresh method based on current navigation state
   */
  refreshCurrentView(): void {
    // If we're in a folder, refresh that folder
    if (this.navigationState.folderId && this.currentFolder) {
      this.navigateToFolder(this.currentFolder);
    }
    // If we're in case context
    else if (this.navigationState.context === 'case' && this.navigationState.caseId) {
      this.loadCaseDocuments(this.navigationState.caseId);
    }
    // If we're in personal context
    else if (this.navigationState.context === 'personal') {
      this.loadPersonalDocuments();
    }
    // If we have a filter active
    else if (this.navigationState.filter) {
      this.applyFilter(this.navigationState.filter);
    }
    // Otherwise load all documents
    else {
      this.loadAllDocuments();
    }
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
      // If we're in a case context, stay in case context when going back to root
      if (this.navigationState.context === 'case' && this.navigationState.caseId) {
        // Stay in case context but go to case root
        this.currentFolder = null;
        this.navigationState.folderId = null;
        this.navigationState.folderName = null;
        this.loadCaseDocuments(this.navigationState.caseId);
      } else {
        this.navigateToRoot();
      }
    }
  }

  /**
   * Go back to previous location
   */
  goBack(): void {
    this.navigateToParent();
  }

  /**
   * Load root folder contents - filtered by context
   */
  private loadRootContents(): void {
    this.isLoading = true;
    
    if (this.navigationState.context === 'personal') {
      this.loadPersonalDocuments();
    } else {
      // For other contexts, load all documents
      this.loadAllDocuments();
    }
  }

  /**
   * Load personal documents (no case association)
   */
  private loadPersonalDocuments(): void {
    combineLatest([
      this.fileManagerService.getFiles(this.currentPage, this.pageSize, this.sortBy, this.sortDirection),
      this.fileManagerService.getRootFolders()
    ]).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: ([filesResponse, folders]) => {
        // Only show files that are NOT associated with any case
        this.files = (filesResponse.content || []).filter(file => !file.caseId);
        
        // Only show folders that are NOT associated with any case
        this.folders = folders.filter(folder => !folder.caseId);
        
        // Also update personal folders for the sidebar navigation
        this.personalFolders = folders.filter(folder => !folder.caseId);
        this.personalFiles = (filesResponse.content || []).filter(file => !file.caseId);
        
        this.updateBreadcrumb();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading personal documents:', error);
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
   * Create new folder with SweetAlert
   */
  createNewFolderWithSwal(): void {
    Swal.fire({
      title: 'Create Folder',
      html: `
        <div class="text-start">
          <div class="mb-3">
            <label class="form-label">Folder Type</label>
            <select id="folderType" class="form-select">
              <option value="single">Single Folder</option>
              <option value="template">Template Structure</option>
            </select>
          </div>
          <div id="singleFolderOptions">
            <div class="mb-3">
              <label class="form-label">Folder Name</label>
              <input type="text" id="folderName" class="form-control" placeholder="Enter folder name...">
            </div>
          </div>
          <div id="templateOptions" style="display: none;">
            ${this.navigationState.context === 'case' && this.navigationState.caseId ? `
              <div class="mb-3">
                <label class="form-label">Current Case</label>
                <div class="alert alert-info mb-0">
                  <i class="ri-briefcase-line me-2"></i>
                  <strong>${this.navigationState.caseName || 'Active Case'}</strong>
                  <br><small class="text-muted">Template will be created for this case</small>
                </div>
              </div>
            ` : `
              <div class="mb-3">
                <label class="form-label">Case</label>
                <select id="caseSelect" class="form-select">
                  <option value="">Select a case...</option>
                  ${this.activeCases.map(c => `<option value="${c.id}">${c.caseNumber} - ${c.title}</option>`).join('')}
                </select>
              </div>
            `}
            <div class="mb-3">
              <label class="form-label">Template</label>
              <select id="templateSelect" class="form-select">
                <option value="litigation-standard">Standard Litigation</option>
                <option value="corporate-standard">Standard Corporate</option>
                <option value="family-standard">Standard Family Law</option>
                <option value="real-estate-standard">Standard Real Estate</option>
                <option value="criminal-standard">Standard Criminal Defense</option>
              </select>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Create',
      confirmButtonColor: '#0ab39c',
      cancelButtonColor: '#f06548',
      didOpen: () => {
        const folderTypeSelect = document.getElementById('folderType') as HTMLSelectElement;
        const singleOptions = document.getElementById('singleFolderOptions') as HTMLElement;
        const templateOptions = document.getElementById('templateOptions') as HTMLElement;
        
        folderTypeSelect.addEventListener('change', () => {
          if (folderTypeSelect.value === 'template') {
            singleOptions.style.display = 'none';
            templateOptions.style.display = 'block';
          } else {
            singleOptions.style.display = 'block';
            templateOptions.style.display = 'none';
          }
        });
      },
      preConfirm: () => {
        const folderType = (document.getElementById('folderType') as HTMLSelectElement).value;
        
        if (folderType === 'single') {
          const folderName = (document.getElementById('folderName') as HTMLInputElement).value;
          if (!folderName?.trim()) {
            Swal.showValidationMessage('Folder name is required');
            return false;
          }
          return { type: 'single', name: folderName.trim() };
        } else {
          const template = (document.getElementById('templateSelect') as HTMLSelectElement).value;
          
          // If we're in case context, use current case ID
          if (this.navigationState.context === 'case' && this.navigationState.caseId) {
            return { type: 'template', caseId: this.navigationState.caseId, template, useCurrentCase: true };
          } else {
            // Otherwise get from dropdown
            const caseSelect = document.getElementById('caseSelect') as HTMLSelectElement;
            const caseId = caseSelect?.value;
            if (!caseId) {
              Swal.showValidationMessage('Please select a case');
              return false;
            }
            return { type: 'template', caseId: parseInt(caseId), template };
          }
        }
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        if (result.value.type === 'single') {
          this.createSingleFolderInCurrentDirectory(result.value.name);
        } else {
          let selectedCase;
          if (result.value.useCurrentCase && this.navigationState.caseId) {
            // Use current case info
            const currentCaseFromList = this.activeCases.find(c => c.id === this.navigationState.caseId);
            selectedCase = {
              id: this.navigationState.caseId,
              caseNumber: currentCaseFromList?.caseNumber || `CASE-${this.navigationState.caseId}`,
              title: this.navigationState.caseName || 'Active Case'
            };
          } else {
            selectedCase = this.activeCases.find(c => c.id === result.value.caseId);
          }
          this.createFolderStructureInCurrentDirectory(result.value.template, selectedCase);
        }
      }
    });
  }
  
  /**
   * Create single folder in current directory
   */
  private createSingleFolderInCurrentDirectory(folderName: string): void {
    const request: CreateFolderRequest = {
      name: folderName,
      parentId: this.currentFolder?.id,
      // Only associate with case if in case context (NOT in personal context)
      ...(this.navigationState.context === 'case' && this.navigationState.caseId && {
        caseId: this.navigationState.caseId
      })
      // Personal context folders should NOT have caseId
    };
    
    this.fileManagerService.createFolder(request).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.refreshCurrentView();
        Swal.fire({
          title: 'Success!',
          text: 'Folder created successfully',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: (error) => {
        console.error('Error creating folder:', error);
        Swal.fire({
          title: 'Error!',
          text: 'Failed to create folder: ' + error.message,
          icon: 'error',
          confirmButtonColor: '#f06548'
        });
      }
    });
  }
  
  /**
   * Create folder structure in current directory
   */
  private createFolderStructureInCurrentDirectory(templateId: string, caseInfo: any): void {
    this.templateService.getTemplate(templateId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (template) => {
        if (!caseInfo || !caseInfo.id) {
          // If no specific case info but we're in case context, use current case
          const targetCaseId = this.navigationState.context === 'case' ? this.navigationState.caseId : undefined;
          
          // If we're in case context but not in a specific folder, we need to find or create the case root folder
          if (targetCaseId && !this.currentFolder) {
            // Find the case folder from loaded folders
            const caseFolder = this.folders.find(f => f.caseId === targetCaseId && !f.parentId);
            if (caseFolder) {
              this.createFoldersFromTemplate(template.folders, caseFolder.id, targetCaseId);
            } else {
              // Need to create case root folder first
              // Find the case info to get the proper name
              const targetCase = this.activeCases.find(c => c.id === targetCaseId);
              const caseFolderName = targetCase?.title || targetCase?.name || this.navigationState.caseName || `CASE-${targetCaseId}`;
              const caseFolderRequest: CreateFolderRequest = {
                name: caseFolderName,
                parentId: undefined,
                caseId: targetCaseId
              };
              
              this.fileManagerService.createFolder(caseFolderRequest).pipe(
                takeUntil(this.destroy$)
              ).subscribe({
                next: (createdCaseFolder) => {
                  this.createFoldersFromTemplate(template.folders, createdCaseFolder.id, targetCaseId);
                },
                error: (error) => {
                  console.error('Error creating case folder:', error);
                  Swal.fire({
                    title: 'Error!',
                    text: 'Failed to create case folder: ' + error.message,
                    icon: 'error',
                    confirmButtonColor: '#f06548'
                  });
                }
              });
            }
          } else {
            this.createFoldersFromTemplate(template.folders, this.currentFolder?.id, targetCaseId);
          }
          return;
        }
        
        // Use case title/name for the folder name instead of case number
        const caseFolderName = caseInfo.title || caseInfo.name || caseInfo.caseNumber || `CASE-${caseInfo.id}`;
        const caseFolderRequest: CreateFolderRequest = {
          name: caseFolderName,
          parentId: this.currentFolder?.id,
          caseId: caseInfo.id
        };
        
        this.fileManagerService.createFolder(caseFolderRequest).pipe(
          takeUntil(this.destroy$)
        ).subscribe({
          next: (caseFolder) => {
            // Pass both parentId and caseId to maintain case association
            this.createFoldersFromTemplate(template.folders, caseFolder.id, caseInfo.id);
            
            Swal.fire({
              title: 'Success!',
              text: `Case folder structure created successfully`,
              icon: 'success',
              timer: 2000,
              showConfirmButton: false
            });
          },
          error: (error) => {
            console.error('Error creating case folder:', error);
            Swal.fire({
              title: 'Error!',
              text: 'Failed to create folder structure: ' + error.message,
              icon: 'error',
              confirmButtonColor: '#f06548'
            });
          }
        });
      },
      error: (error) => {
        console.error('Error getting template:', error);
        Swal.fire({
          title: 'Error!',
          text: 'Failed to load template: ' + error.message,
          icon: 'error',
          confirmButtonColor: '#f06548'
        });
      }
    });
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
   * Bulk delete with SweetAlert
   */
  bulkDelete(): void {
    if (this.selectedFiles.length === 0 && this.selectedFolders.length === 0) {
      return;
    }

    const totalItems = this.selectedFiles.length + this.selectedFolders.length;
    const itemText = totalItems === 1 ? 'item' : 'items';
    
    Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to delete ${totalItems} selected ${itemText}? This action cannot be undone!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f06548',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete!',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.fileManagerService.bulkDelete(this.selectedFiles, this.selectedFolders).pipe(
          takeUntil(this.destroy$)
        ).subscribe({
          next: () => {
            this.selectedFiles = [];
            this.selectedFolders = [];
            this.loadCurrentFolderContents();
            Swal.fire({
              title: 'Deleted!',
              text: `${totalItems} ${itemText} have been deleted successfully.`,
              icon: 'success',
              timer: 2000,
              showConfirmButton: false
            });
          },
          error: (error) => {
            console.error('Delete error:', error);
            Swal.fire({
              title: 'Error!',
              text: 'Failed to delete items: ' + error.message,
              icon: 'error',
              confirmButtonColor: '#f06548'
            });
          }
        });
      }
    });
  }

  /**
   * Bulk download
   */
  bulkDownload(): void {
    if (this.selectedFiles.length === 0) {
      Swal.fire({
        title: 'No Files Selected',
        text: 'Please select at least one file to download.',
        icon: 'info',
        confirmButtonColor: '#405189'
      });
      return;
    }

    this.downloadSelectedFiles();
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
      return;
    }

    // Build breadcrumb path from current folder
    const path = [];
    let folder = this.currentFolder;
    
    // Add current folder
    path.unshift({ name: folder.name, folder: folder });
    
    // Add parent folders if available
    while (folder.parentId) {
      // For now, we'll just add a placeholder parent
      // In a real implementation, you'd fetch the parent folder details
      path.unshift({ name: folder.parentName || 'Parent', folder: { id: folder.parentId } as FolderModel });
      break; // Simplified - would need recursive parent fetching
    }

    this.breadcrumb = path;
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
   * Navigate to specific case root
   */
  navigateToCase(caseId: number | null): void {
    if (caseId) {
      const caseItem = this.activeCases.find(c => c.id === caseId);
      if (caseItem) {
        this.selectCase(caseId);
      }
    }
  }

  /**
   * Toggle mobile sidebar visibility
   */
  toggleMobileSidebar(): void {
    this.isMobileSidebarOpen = !this.isMobileSidebarOpen;
    
    // Add/remove body class to prevent scrolling
    if (this.isMobileSidebarOpen) {
      document.body.classList.add('mobile-sidebar-open');
      
      // Apply dark mode background if needed
      setTimeout(() => {
        const sidebar = document.getElementById('menusidebar-mobile');
        if (sidebar) {
          const isDarkMode = this.checkDarkMode();
          if (isDarkMode) {
            sidebar.style.backgroundColor = '#212529';
            sidebar.style.background = '#212529';
            sidebar.style.color = '#adb5bd';
          } else {
            sidebar.style.backgroundColor = '#ffffff';
            sidebar.style.background = '#ffffff';
            sidebar.style.color = '#495057';
          }
        }
      }, 10);
    } else {
      document.body.classList.remove('mobile-sidebar-open');
    }
  }
  
  /**
   * Check if dark mode is active
   */
  private checkDarkMode(): boolean {
    return document.documentElement.getAttribute('data-bs-theme') === 'dark' ||
           document.documentElement.getAttribute('data-layout-mode') === 'dark' ||
           document.documentElement.getAttribute('data-theme') === 'dark' ||
           document.body.classList.contains('dark-mode') ||
           document.body.getAttribute('data-bs-theme') === 'dark' ||
           window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  
  /**
   * Get mobile sidebar background color
   */
  getMobileSidebarBgColor(): string {
    return this.checkDarkMode() ? '#212529' : '#ffffff';
  }
  
  /**
   * Get mobile sidebar text color
   */
  getMobileSidebarTextColor(): string {
    return this.checkDarkMode() ? '#adb5bd' : '#495057';
  }

  /**
   * Close mobile sidebar
   */
  closeMobileSidebar(): void {
    this.isMobileSidebarOpen = false;
    document.body.classList.remove('mobile-sidebar-open');
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
      case 'myDocuments':
        this.myDocumentsExpanded = !this.myDocumentsExpanded;
        break;
      case 'caseDocuments':
        this.caseDocumentsExpanded = !this.caseDocumentsExpanded;
        break;
      case 'quickFilters':
        this.quickFiltersExpanded = !this.quickFiltersExpanded;
        break;
    }
  }

  /**
   * Toggle My Documents section
   */
  toggleMyDocuments(): void {
    this.myDocumentsExpanded = !this.myDocumentsExpanded;
    
    // If expanding and we're not in personal context, switch to it
    if (this.myDocumentsExpanded && this.navigationState.context !== 'personal') {
      this.switchToPersonalDocuments();
    }
  }

  /**
   * Get document count for case
   */
  getCaseDocumentCount(caseId: number): number {
    // If current case is selected and we have files loaded, use actual count
    if (this.navigationState.context === 'case' && this.navigationState.caseId === caseId) {
      return this.files.length;
    }
    
    // Check if we have the count in the case data
    const caseData = this.activeCases?.find(c => c.id === caseId);
    if (caseData?.documentCount !== undefined && caseData.documentCount !== null) {
      return caseData.documentCount;
    }
    
    // Use static realistic counts for demo - ensures consistency across all cases
    const documentCounts: { [key: number]: number } = {
      1: 12, 2: 8, 3: 15, 4: 6, 5: 22, 6: 9, 7: 18, 8: 4, 9: 11, 10: 7,
      11: 16, 12: 13, 13: 5, 14: 20, 15: 14, 16: 3, 17: 7, 18: 10, 19: 9, 20: 21
    };
    
    // Return consistent count based on case ID
    return documentCounts[caseId] || ((caseId % 20) + 1);
  }

  /**
   * Get case status for styling
   */
  getCaseStatus(caseData: any): string {
    if (caseData.status) {
      return caseData.status.toLowerCase();
    }
    // Generate realistic status based on ID for demo
    const statuses = ['active', 'in_progress', 'pending', 'review', 'open', 'completed'];
    return statuses[caseData.id % statuses.length];
  }

  /**
   * Get case status display text
   */
  getCaseStatusDisplay(caseData: any): string {
    const status = this.getCaseStatus(caseData);
    const statusDisplayMap: { [key: string]: string } = {
      'active': 'Active',
      'open': 'Open',
      'in_progress': 'In Progress',
      'pending': 'Pending',
      'review': 'In Review',
      'completed': 'Completed',
      'closed': 'Closed'
    };
    return statusDisplayMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
  }

  /**
   * Get case priority for styling
   */
  getCasePriority(caseData: any): string {
    if (caseData.priority) {
      return caseData.priority.toLowerCase();
    }
    // Generate realistic priority based on ID for demo
    const priorities = ['high', 'medium', 'low', 'urgent'];
    return priorities[caseData.id % 4];
  }

  /**
   * Get default document count for cases
   */
  private getDefaultDocumentCount(caseId: number): number {
    const documentCounts: { [key: number]: number } = {
      1: 12, 2: 8, 3: 15, 4: 6, 5: 22, 6: 9, 7: 18, 8: 4, 9: 11, 10: 7,
      11: 16, 12: 13, 13: 5, 14: 20, 15: 14, 16: 3, 17: 7, 18: 10, 19: 9, 20: 21
    };
    return documentCounts[caseId] || ((caseId % 20) + 1);
  }

  /**
   * Get mock client name for demo
   */
  private getMockClientName(index: number): string {
    const clientNames = [
      'Johnson & Associates', 'Smith Medical Center', 'Davis Corporation',
      'Williams Foundation', 'Brown Industries', 'Miller Law Group',
      'Wilson Enterprises', 'Taylor Insurance', 'Anderson Consulting',
      'Thomas Holdings', 'Jackson Partners', 'White & Associates',
      'Harris Technologies', 'Martin Financial', 'Thompson Legal',
      'Garcia Investments', 'Martinez Group', 'Robinson Services',
      'Clark Development', 'Rodriguez LLC'
    ];
    return clientNames[index % clientNames.length];
  }

  /**
   * Get case type for display
   */
  getCaseType(caseData: any): string {
    if (caseData.caseType) {
      return caseData.caseType;
    }
    // Generate case types for demo
    const caseTypes = ['Civil Litigation', 'Corporate Law', 'Criminal Defense', 'Family Law', 
                       'Personal Injury', 'Real Estate', 'Employment Law', 'Intellectual Property'];
    return caseTypes[caseData.id % caseTypes.length];
  }

  /**
   * Get assigned lawyer for display
   */
  getAssignedLawyer(caseData: any): string {
    if (caseData.assignedLawyer) {
      return caseData.assignedLawyer;
    }
    // Generate lawyer names for demo
    const lawyers = ['Sarah Johnson, Esq.', 'Michael Chen, JD', 'Emily Rodriguez, Esq.', 
                     'David Thompson, JD', 'Lisa Anderson, Esq.', 'Robert Williams, JD',
                     'Jennifer Martinez, Esq.', 'James Wilson, JD'];
    return lawyers[caseData.id % lawyers.length];
  }

  /**
   * Check if navigation item is active
   */
  isNavigationActive(type: 'personal' | 'case' | 'global' | string): boolean {
    if (type === 'personal') {
      return this.navigationState.context === 'personal' && !this.navigationState.filter;
    } else if (type === 'case') {
      return this.navigationState.context === 'case' && !this.navigationState.filter;
    } else if (type === 'global') {
      return this.navigationState.context === 'all' && !this.navigationState.filter;
    } else {
      return this.navigationState.filter === type;
    }
  }

  /**
   * Get current navigation title
   */
  getCurrentNavigationTitle(): string {
    if (this.navigationState.filter) {
      switch (this.navigationState.filter) {
        case 'Media': return 'Media Files';
        case 'Recents': return 'Recent Files';
        case 'Important': return 'Starred Files';
        case 'Deleted': return 'Deleted Files';
        default: return 'All Documents';
      }
    } else if (this.navigationState.context === 'case' && this.navigationState.caseId && this.navigationState.caseName) {
      return this.navigationState.caseName;
    } else if (this.currentFolder) {
      return this.currentFolder.name;
    } else {
      return 'My Documents';
    }
  }

  /**
   * Get navigation subtitle for enhanced UI
   */
  getNavigationSubtitle(): string {
    if (this.navigationState.context === 'case' && this.selectedCase) {
      return `${this.selectedCase.title} - ${this.files.length + this.folders.length} items`;
    } else if (this.navigationState.context === 'personal') {
      return `Personal documents - ${this.files.length + this.folders.length} items`;
    } else {
      return `All documents - ${this.files.length + this.folders.length} items`;
    }
  }

  /**
   * Apply file type filter
   */
  applyFileTypeFilter(type: string): void {
    // Implementation for file type filtering
    console.log('Applying file type filter:', type);
    // This would typically filter the files array based on the selected type
    // For now, just refresh the current view
    this.loadCurrentFolderContents();
  }

  /**
   * Clear search input
   */
  clearSearch(): void {
    this.searchTerm = '';
    this.onSearchChange('');
  }

  /**
   * Set view mode (grid or list)
   */
  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode = mode;
  }

  /**
   * Change filter for document types
   */
  changeFilter(filterType: string): void {
    this.applyFilter(filterType);
  }


  /**
   * Load filtered files by type
   */
  private loadFilteredFiles(mimeTypeFilter: string): void {
    this.fileManagerService.getFiles(0, 100).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        this.files = (response.content || []).filter(file => 
          file.mimeType?.includes(mimeTypeFilter)
        );
        this.folders = [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading filtered files:', error);
        this.isLoading = false;
      }
    });
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
   * Track by function for cases
   */
  trackByCaseId(index: number, caseItem: any): number {
    return caseItem.id;
  }
  
  /**
   * Handle My Documents navigation click
   */
  handleMyDocumentsClick(): void {
    // If already in personal context, just toggle the expansion
    if (this.navigationState.context === 'personal' && !this.currentFolder) {
      this.myDocumentsExpanded = !this.myDocumentsExpanded;
      this.cdr.detectChanges();
      return;
    }
    
    // Otherwise, switch to personal context and expand
    this.switchToPersonalDocuments();
  }

  /**
   * Switch to personal documents context
   */
  switchToPersonalDocuments(): void {
    this.navigationState.context = 'personal';
    this.navigationState.caseId = null;
    this.navigationState.caseName = null;
    this.navigationState.folderId = null;
    this.navigationState.folderName = null;
    this.navigationState.filter = null;
    this.currentFolder = null;
    this.myDocumentsExpanded = true;
    this.caseDocumentsExpanded = false;
    
    // Load personal documents only (no case association)
    this.loadPersonalDocuments();
    this.updateBreadcrumb();
  }

  /**
   * Handle Case Documents navigation click
   */
  handleCaseDocumentsClick(): void {
    // If already in case context, just toggle the expansion
    if (this.navigationState.context === 'case') {
      this.caseDocumentsExpanded = !this.caseDocumentsExpanded;
      this.cdr.detectChanges();
      return;
    }
    
    // Otherwise, switch to case context and expand
    this.switchToCaseDocuments();
  }

  /**
   * Switch to case documents context
   */
  switchToCaseDocuments(caseId?: number): void {
    this.navigationState.context = 'case';
    this.navigationState.folderId = null;
    this.navigationState.folderName = null;
    this.navigationState.filter = null;
    this.currentFolder = null;
    this.myDocumentsExpanded = false;
    this.caseDocumentsExpanded = true;
    
    if (caseId) {
      this.selectCase(caseId);
    } else {
      // Don't auto-select any case, show case selection panel
      this.navigationState.caseId = null;
      this.navigationState.caseName = null;
      this.files = [];
      this.folders = [];
    }
    
    this.updateBreadcrumb();
  }

  /**
   * Switch to global view context
   */
  switchToGlobalView(): void {
    this.navigationState.context = 'all';
    this.navigationState.caseId = null;
    this.navigationState.caseName = null;
    this.navigationState.folderId = null;
    this.navigationState.folderName = null;
    this.navigationState.filter = null;
    this.currentFolder = null;
    this.loadAllDocuments();
  }

  /**
   * Select specific case
   */
  selectCase(caseId: number): void {
    const selectedCase = this.activeCases.find(c => c.id === caseId);
    if (selectedCase) {
      this.navigationState.caseId = selectedCase.id;
      this.navigationState.caseName = selectedCase.title;
      this.navigationState.context = 'case'; // Set context to case
      this.loadCaseDocuments(caseId);
    }
  }

  /**
   * Apply filter in current context
   */
  applyFilter(filter: string): void {
    // Reset navigation state when applying filters
    this.navigationState.context = 'all';
    this.navigationState.caseId = null;
    this.navigationState.caseName = null;
    this.navigationState.filter = filter;
    this.currentFolder = null;
    this.navigationState.folderId = null;
    this.navigationState.folderName = null;
    this.isLoading = true;
    
    // Update section expansion states
    this.myDocumentsExpanded = false;
    this.caseDocumentsExpanded = false;
    
    switch (filter) {
      case 'Media':
        this.loadMediaFiles();
        break;
      case 'Recents':
        this.loadRecentFiles();
        break;
      case 'Important':
        this.loadStarredFiles();
        break;
      case 'Deleted':
        this.loadDeletedFiles();
        break;
      case 'Documents':
      default:
        this.loadAllDocuments();
    }
    
    this.updateBreadcrumb();
  }

  private loadAllDocuments(): void {
    this.currentFolder = null;
    combineLatest([
      this.fileManagerService.getFiles(),
      this.fileManagerService.getRootFolders()
    ]).subscribe({
      next: ([filesResponse, folders]) => {
        this.files = filesResponse.content || [];
        this.folders = folders;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading documents:', error);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Load case-specific documents and folders
   */
  private loadCaseDocuments(caseId: number): void {
    this.isLoading = true;
    
    // Use getFilesByCase with proper caseId parameter
    this.fileManagerService.getFilesByCase(caseId, 0, 100).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        // Double-check filtering to ensure only this case's files are shown
        this.files = (response.content || []).filter(file => file.caseId === caseId);
        // Load case-specific folders if available
        this.loadCaseFolders(caseId);
        this.updateBreadcrumb();
      },
      error: (error) => {
        console.error('Error loading case documents:', error);
        this.files = [];
        this.folders = [];
        this.isLoading = false;
        this.updateBreadcrumb();
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Load case-specific folder structure
   */
  private loadCaseFolders(caseId: number): void {
    // Get folders associated with this case
    this.fileManagerService.getFoldersByCase(caseId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (folders) => {
        this.folders = folders;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading case folders, falling back to filtered root folders:', error);
        // Fallback to filtering root folders if case-specific API doesn't exist
        this.fileManagerService.getRootFolders().pipe(
          takeUntil(this.destroy$)
        ).subscribe({
          next: (folders) => {
            this.folders = folders.filter(folder => folder.caseId === caseId);
            this.isLoading = false;
            this.cdr.detectChanges();
          },
          error: (fallbackError) => {
            console.error('Error loading root folders:', fallbackError);
            this.folders = [];
            this.isLoading = false;
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  private loadMediaFiles(): void {
    this.currentFolder = null;
    this.fileManagerService.getFiles().subscribe({
      next: (response) => {
        this.files = (response.content || []).filter((file: any) => 
          file.mimeType?.startsWith('image/') || 
          file.mimeType?.startsWith('video/') || 
          file.mimeType?.startsWith('audio/')
        );
        this.folders = [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading media files:', error);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private loadRecentFiles(): void {
    this.currentFolder = null;
    this.fileManagerService.getRecentFiles(50).subscribe({
      next: (files) => {
        this.files = files;
        this.folders = [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading recent files:', error);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private loadStarredFiles(): void {
    this.currentFolder = null;
    this.fileManagerService.getStarredFiles().subscribe({
      next: (files) => {
        this.files = files;
        this.folders = [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading starred files:', error);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private loadDeletedFiles(): void {
    this.currentFolder = null;
    this.fileManagerService.getFiles(0, 100).subscribe({
      next: (response) => {
        this.files = (response.content || []).filter((file: any) => file.deleted);
        this.folders = [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading deleted files:', error);
        this.files = [];
        this.folders = [];
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }
  
  /**
   * Open modal
   */
  openModal(content: any): void {
    try {
      this.activeModal = this.modalService.open(content, {
        size: 'lg',
        backdrop: 'static',
        keyboard: false
      });
    } catch (error) {
      console.error('Error opening modal:', error);
    }
  }
  
  /**
   * Edit folder modal
   */
  editFolderModal(content: any, _folder: FolderModel): void {
    // Set up form for editing
    this.modalService.open(content, {
      centered: true
    });
  }
  
  /**
   * Edit file modal
   */
  editFileModal(content: any, _file: FileItemModel): void {
    // Set up form for editing
    this.modalService.open(content, {
      centered: true
    });
  }
  
  /**
   * Confirm delete folder
   */
  confirmDeleteFolder(modal: any, folderId: number): void {
    this.deleteId = folderId;
    this.modalService.open(modal, {
      centered: true,
      size: 'sm'
    });
  }
  
  /**
   * Confirm delete file
   */
  confirmDeleteFile(modal: any, fileId: number): void {
    this.deleteId = fileId;
    this.modalService.open(modal, {
      centered: true,
      size: 'sm'
    });
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
    this.submitted = true;
    
    if (this.folderForm.invalid) {
      return;
    }
    
    const formValue = this.folderForm.value;
    const selectedCase = this.activeCases.find(c => c.id === formValue.caseId);
    
    if (formValue.folderType === 'template') {
      // Create multiple folders based on template
      this.createFolderStructureInCurrentDirectory(formValue.template, selectedCase);
    } else {
      // Create single folder
      this.createSingleFolder(formValue.name, selectedCase);
    }
  }
  
  private createSingleFolder(folderName: string, caseInfo: any): void {
    const request: CreateFolderRequest = {
      name: folderName,
      parentId: this.currentFolder?.id,
      // Associate with case if provided, or current case context (but NOT in personal context)
      ...(caseInfo?.id && { caseId: caseInfo.id }),
      ...(this.navigationState.context === 'case' && this.navigationState.caseId && !caseInfo?.id && {
        caseId: this.navigationState.caseId
      })
      // Personal context folders should NOT have caseId
    };
    
    this.fileManagerService.createFolder(request).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (folder) => {
        console.log('Single folder created:', folder);
        this.refreshCurrentView();
      },
      error: (error) => {
        console.error('Error creating folder:', error);
        alert('Failed to create folder: ' + error.message);
      }
    });
    
    // Reset form and close modal
    this.folderForm.reset({
      folderType: 'single',
      inheritPermissions: true
    });
    this.submitted = false;
    
    if (this.activeModal) {
      this.activeModal.close();
    }
  }

  /**
   * Move files to folder
   */
  moveFilesToFolder(targetFolderId: number): void {
    if (this.selectedFiles.length === 0) return;
    
    // Implementation would depend on backend API
    console.log(`Moving files ${this.selectedFiles} to folder ${targetFolderId}`);
    
    // For now, just clear selection and refresh
    this.selectedFiles = [];
    this.loadCurrentFolderContents();
  }

  /**
   * Copy files
   */
  copyFiles(): void {
    if (this.selectedFiles.length === 0) return;
    
    this.clipboard = {
      items: [...this.selectedFiles],
      operation: 'copy'
    };
    
    console.log('Files copied to clipboard:', this.clipboard.items);
  }

  /**
   * Cut files
   */
  cutFiles(): void {
    if (this.selectedFiles.length === 0) return;
    
    this.clipboard = {
      items: [...this.selectedFiles],
      operation: 'cut'
    };
    
    console.log('Files cut to clipboard:', this.clipboard.items);
  }

  /**
   * Copy selected items
   */
  copySelected(): void {
    this.clipboard = {
      items: [
        ...this.selectedFiles.map(id => ({ type: 'file' as const, id })),
        ...this.selectedFolders.map(id => ({ type: 'folder' as const, id }))
      ],
      operation: 'copy'
    };
  }

  /**
   * Cut selected items
   */
  cutSelected(): void {
    this.clipboard = {
      items: [
        ...this.selectedFiles.map(id => ({ type: 'file' as const, id })),
        ...this.selectedFolders.map(id => ({ type: 'folder' as const, id }))
      ],
      operation: 'cut'
    };
  }

  /**
   * Paste files
   */
  pasteFiles(): void {
    if (this.clipboard.items.length === 0) return;
    
    const targetFolderId = this.currentFolder?.id || 0;
    const fileIds = this.clipboard.items.filter(item => item.type === 'file').map(item => item.id);
    const folderIds = this.clipboard.items.filter(item => item.type === 'folder').map(item => item.id);
    
    if (this.clipboard.operation === 'copy') {
      // Handle copy operation
      const operations = [];
      if (fileIds.length > 0) {
        operations.push(this.fileManagerService.copyFiles(fileIds, targetFolderId));
      }
      if (folderIds.length > 0) {
        operations.push(this.fileManagerService.copyFolders(folderIds, targetFolderId));
      }
      
      if (operations.length > 0) {
        combineLatest(operations).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => {
            this.loadCurrentFolderContents();
            this.clipboard = { items: [], operation: null };
          },
          error: (error) => console.error('Copy error:', error)
        });
      }
    } else if (this.clipboard.operation === 'cut') {
      // Handle cut/move operation
      const operations = [];
      if (fileIds.length > 0) {
        operations.push(this.fileManagerService.moveFiles(fileIds, targetFolderId));
      }
      if (folderIds.length > 0) {
        operations.push(this.fileManagerService.moveFolders(folderIds, targetFolderId));
      }
      
      if (operations.length > 0) {
        combineLatest(operations).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => {
            this.loadCurrentFolderContents();
            this.clipboard = { items: [], operation: null };
            this.clearSelection();
          },
          error: (error) => {
            console.error('Move error:', error);
            // Still clear clipboard and refresh even if some operations failed
            this.loadCurrentFolderContents();
            this.clipboard = { items: [], operation: null };
            this.clearSelection();
          }
        });
      }
    }
  }

  /**
   * Get folder permissions display
   */
  getFolderPermissions(folder: FolderModel): string {
    const permissions = [];
    
    if (folder.canEdit) permissions.push('Edit');
    if (folder.canDelete) permissions.push('Delete');
    if (folder.canShare) permissions.push('Share');
    
    return permissions.length > 0 ? permissions.join(', ') : 'View Only';
  }

  /**
   * Check if user can paste
   */
  canPaste(): boolean {
    return this.clipboard.items.length > 0;
  }
  
  /**
   * Start inline editing for file or folder
   */
  startInlineEdit(id: number, type: 'file' | 'folder', currentName: string): void {
    this.editingItem = {
      id,
      type,
      newName: currentName
    };
    
    // Auto-focus the input field after view updates
    setTimeout(() => {
      const input = document.querySelector('input[type="text"]#renameInput, input[type="text"]') as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 100);
  }
  
  /**
   * Cancel inline editing
   */
  cancelInlineEdit(): void {
    this.editingItem = null;
  }
  
  /**
   * Finish inline editing and save changes
   */
  finishInlineEdit(): void {
    if (!this.editingItem) return;
    
    const { id, type, newName } = this.editingItem;
    
    if (!newName.trim()) {
      Swal.fire({
        title: 'Error!',
        text: 'Name cannot be empty',
        icon: 'error',
        confirmButtonColor: '#f06548'
      });
      return;
    }
    
    if (type === 'file') {
      this.renameFile(id, newName.trim());
    } else {
      this.renameFolder(id, newName.trim());
    }
  }
  
  /**
   * Rename file
   */
  private renameFile(fileId: number, newName: string): void {
    this.fileManagerService.updateFile(fileId, newName).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (updatedFile) => {
        // Update the file in the current files array
        const index = this.files.findIndex(f => f.id === fileId);
        if (index !== -1) {
          this.files[index] = updatedFile;
        }
        
        this.editingItem = null;
        
        Swal.fire({
          title: 'Success!',
          text: 'File renamed successfully',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: (error) => {
        console.error('Error renaming file:', error);
        Swal.fire({
          title: 'Error!',
          text: 'Failed to rename file: ' + error.message,
          icon: 'error',
          confirmButtonColor: '#f06548'
        });
      }
    });
  }
  
  /**
   * Rename folder
   */
  private renameFolder(folderId: number, newName: string): void {
    this.fileManagerService.updateFolder(folderId, newName).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (updatedFolder) => {
        // Update the folder in the current folders array
        const index = this.folders.findIndex(f => f.id === folderId);
        if (index !== -1) {
          this.folders[index] = updatedFolder;
        }
        
        this.editingItem = null;
        
        Swal.fire({
          title: 'Success!',
          text: 'Folder renamed successfully',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: (error) => {
        console.error('Error renaming folder:', error);
        Swal.fire({
          title: 'Error!',
          text: 'Failed to rename folder: ' + error.message,
          icon: 'error',
          confirmButtonColor: '#f06548'
        });
      }
    });
  }
  
  /**
   * Handle keydown events for inline editing
   */
  onInlineEditKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.finishInlineEdit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelInlineEdit();
    }
  }
  
  /**
   * Check if item is being edited
   */
  isEditing(id: number, type: 'file' | 'folder'): boolean {
    return this.editingItem?.id === id && this.editingItem?.type === type;
  }
  
  /**
   * Clear selected case
   */
  clearSelectedCase(): void {
    this.navigationState.caseId = null;
    this.navigationState.caseName = null;
    this.navigationState.context = 'personal';
    this.refreshCurrentView();
  }
  
  
  /**
   * Create folders from template structure
   */
  private createFoldersFromTemplate(folders: any[], parentId?: number, caseId?: number): void {
    this.createFoldersSequentially(folders, 0, parentId, caseId, () => {
      // Preserve/ensure navigation state if we have a case ID
      if (caseId) {
        this.navigationState.context = 'case';
        this.navigationState.caseId = caseId;
        
        // Find case name from active cases if not already set
        if (!this.navigationState.caseName) {
          const foundCase = this.activeCases.find(c => c.id === caseId);
          if (foundCase) {
            this.navigationState.caseName = foundCase.title;
          }
        }
        
        // Make sure we're not in a folder context after template creation
        this.navigationState.folderId = null;
        this.navigationState.folderName = null;
        this.currentFolder = null;
      }
      
      setTimeout(() => {
        this.refreshCurrentView();
        this.cdr.detectChanges();
      }, 200);
    });
  }
  
  private createFoldersSequentially(folders: any[], index: number, parentId?: number, caseId?: number, onComplete?: () => void): void {
    if (index >= folders.length) {
      if (onComplete) {
        onComplete();
      } else {
        this.refreshCurrentView();
      }
      return;
    }
    
    const folderTemplate = folders[index];
    const request: CreateFolderRequest = {
      name: folderTemplate.name,
      parentId: parentId, // Use explicit parentId without fallback
      ...(caseId && { caseId })
    };
    
    this.fileManagerService.createFolder(request).subscribe({
      next: (createdFolder) => {
        // If this folder has subfolders, create them recursively
        if (folderTemplate.subFolders && folderTemplate.subFolders.length > 0) {
          this.createSubFoldersSequentially(folderTemplate.subFolders, 0, createdFolder.id, caseId, () => {
            // After all subfolders are created, continue with next folder at same level
            this.createFoldersSequentially(folders, index + 1, parentId, caseId, onComplete);
          });
        } else {
          // No subfolders, continue with next folder at same level
          this.createFoldersSequentially(folders, index + 1, parentId, caseId, onComplete);
        }
      },
      error: (error) => {
        console.error('Error creating folder:', error);
        this.createFoldersSequentially(folders, index + 1, parentId, caseId, onComplete); // Continue with next folder
      }
    });
  }

  /**
   * Create subfolders sequentially with callback - now handles nested subfolders recursively
   */
  private createSubFoldersSequentially(subFolders: any[], index: number, parentId: number, caseId?: number, callback?: () => void): void {
    if (index >= subFolders.length) {
      if (callback) callback();
      return;
    }
    
    const subFolderTemplate = subFolders[index];
    const request: CreateFolderRequest = {
      name: subFolderTemplate.name,
      parentId: parentId,
      ...(caseId && { caseId })
    };
    
    this.fileManagerService.createFolder(request).subscribe({
      next: (createdSubFolder) => {
        // If this subfolder has its own subfolders, create them recursively
        if (subFolderTemplate.subFolders && subFolderTemplate.subFolders.length > 0) {
          this.createSubFoldersSequentially(
            subFolderTemplate.subFolders, 
            0, 
            createdSubFolder.id, 
            caseId,
            () => {
              // After creating nested subfolders, continue with next sibling subfolder
              this.createSubFoldersSequentially(subFolders, index + 1, parentId, caseId, callback);
            }
          );
        } else {
          // No nested subfolders, continue with next subfolder
          this.createSubFoldersSequentially(subFolders, index + 1, parentId, caseId, callback);
        }
      },
      error: (error) => {
        console.error('Error creating subfolder:', error);
        // Continue with next subfolder even if this one failed
        this.createSubFoldersSequentially(subFolders, index + 1, parentId, caseId, callback);
      }
    });
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
    
    // Debug logging
    console.log('Starting upload with case context:', {
      caseId: this.navigationState.caseId,
      caseName: this.navigationState.caseName,
      context: this.navigationState.context,
      folderId: this.currentFolder?.id
    });
    
    this.selectedUploadFiles.forEach((file, index) => {
      this.uploadProgress[index].status = 'uploading';
      
      this.fileManagerService.uploadFile(
        file, 
        this.currentFolder?.id, 
        this.navigationState.caseId || undefined, // Use selected case ID
        'OTHER',   // documentCategory
        'DRAFT'    // documentStatus
      ).subscribe({
        next: (response: any) => {
          console.log('Upload response:', response);
          if (response.type === 'UploadProgress') {
            this.uploadProgress[index].progress = response.progress;
          } else if (response.success) {
            this.uploadProgress[index].progress = 100;
            this.uploadProgress[index].status = 'completed';
            console.log('Upload completed, refreshing view immediately...');
            // Refresh immediately when we get successful response
            // Add small delay to ensure backend has processed
            setTimeout(() => {
              this.refreshCurrentView();
              this.cdr.detectChanges();
            }, 100);
          }
        },
        error: (error) => {
          this.uploadProgress[index].status = 'error';
          console.error('Upload error:', error);
        },
        complete: () => {
          if (this.uploadProgress[index].status !== 'error') {
            this.uploadProgress[index].status = 'completed';
            console.log('Upload complete handler called, refreshing view...');
            this.refreshCurrentView();
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
   * Math reference for template
   */
  Math = Math;


  
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
   * Check if we should show empty state
   */
  shouldShowEmptyState(): boolean {
    return !this.isLoading && this.files.length === 0 && this.folders.length === 0;
  }


  /**
   * Get empty state configuration based on current context
   */
  getEmptyStateConfig(): { icon: string; title: string; description: string; actionText: string; showAction: boolean } {
    if (this.navigationState.context === 'personal') {
      return {
        icon: 'ri-folder-user-line',
        title: 'No Personal Documents',
        description: 'You haven\'t created any personal documents or folders yet. Start by uploading files or creating folders.',
        actionText: 'Upload Files',
        showAction: true
      };
    } else if (this.navigationState.context === 'case' && this.navigationState.caseId) {
      return {
        icon: 'ri-briefcase-line',
        title: 'No Case Documents',
        description: `This case doesn't have any documents yet. Upload documents or create folders to organize case materials.`,
        actionText: 'Upload Documents',
        showAction: true
      };
    } else if (this.currentFolder) {
      return {
        icon: 'ri-folder-open-line',
        title: 'Empty Folder',
        description: `The folder "${this.currentFolder.name}" is empty. Upload files or create subfolders to organize your documents.`,
        actionText: 'Upload Files',
        showAction: true
      };
    } else if (this.navigationState.filter) {
      const filterNames: { [key: string]: string } = {
        'Media': 'media files',
        'Recents': 'recent files',
        'Important': 'starred files',
        'Deleted': 'deleted files'
      };
      return {
        icon: 'ri-search-line',
        title: `No ${filterNames[this.navigationState.filter] || 'files'} found`,
        description: `There are no ${filterNames[this.navigationState.filter] || 'files'} to display.`,
        actionText: '',
        showAction: false
      };
    } else {
      return {
        icon: 'ri-file-list-3-line',
        title: 'No Documents',
        description: 'No documents found. Start by uploading files or creating folders.',
        actionText: 'Upload Files',
        showAction: true
      };
    }
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
    
    // If in case context, pass case information
    if (this.navigationState.context === 'case' && this.navigationState.caseId) {
      modalRef.componentInstance.caseId = this.navigationState.caseId;
      modalRef.componentInstance.caseName = this.navigationState.caseName;
      modalRef.componentInstance.selectedCaseId = this.navigationState.caseId;
    }
    
    modalRef.result.then(
      (result) => {
        if (result && result.success) {
          // Use unified refresh method
          setTimeout(() => {
            this.refreshCurrentView();
          }, 500);
          
          // If the uploaded file has case association, notify other components
          if (result.caseId) {
            this.fileUploadNotificationService.notifyDocumentUploaded(result.caseId, result);
          }
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
   * Get template preview for the selected template
   */
  getTemplatePreview(template: string): string[] {
    return this.getFolderTemplate(template);
  }
  
  /**
   * Get folder structure for a given template
   */
  getFolderTemplate(template: string): string[] {
    const templates: { [key: string]: string[] } = {
      litigation: [
        '01 - Pleadings',
        '02 - Discovery',
        '03 - Motions',
        '04 - Evidence',
        '05 - Depositions',
        '06 - Expert Witnesses',
        '07 - Correspondence',
        '08 - Court Orders',
        '09 - Trial Materials',
        '10 - Settlement',
        '11 - Appeals'
      ],
      corporate: [
        '01 - Contracts & Agreements',
        '02 - Corporate Governance',
        '03 - Securities & Compliance',
        '04 - Mergers & Acquisitions',
        '05 - Intellectual Property',
        '06 - Employment Matters',
        '07 - Regulatory Filings',
        '08 - Tax Documents',
        '09 - Due Diligence',
        '10 - Board Resolutions',
        '11 - Correspondence'
      ],
      family: [
        '01 - Divorce Proceedings',
        '02 - Child Custody',
        '03 - Child Support',
        '04 - Spousal Support',
        '05 - Property Division',
        '06 - Financial Documents',
        '07 - Mediation',
        '08 - Court Orders',
        '09 - Correspondence',
        '10 - Expert Reports',
        '11 - Settlement'
      ],
      realestate: [
        '01 - Purchase Agreements',
        '02 - Title Documents',
        '03 - Financing',
        '04 - Inspections',
        '05 - Surveys & Appraisals',
        '06 - Zoning & Permits',
        '07 - Environmental',
        '08 - Closing Documents',
        '09 - Correspondence',
        '10 - Leases',
        '11 - Disputes'
      ],
      criminal: [
        '01 - Charges & Indictments',
        '02 - Evidence',
        '03 - Witness Statements',
        '04 - Discovery',
        '05 - Motions',
        '06 - Plea Negotiations',
        '07 - Trial Preparation',
        '08 - Sentencing',
        '09 - Appeals',
        '10 - Correspondence',
        '11 - Expert Reports'
      ],
      immigration: [
        '01 - Applications & Petitions',
        '02 - Supporting Documents',
        '03 - Government Correspondence',
        '04 - Medical Examinations',
        '05 - Financial Evidence',
        '06 - Family Documents',
        '07 - Employment Authorization',
        '08 - Interview Preparation',
        '09 - Appeals',
        '10 - Status Changes',
        '11 - Naturalization'
      ],
      employment: [
        '01 - Employment Contracts',
        '02 - Discrimination Claims',
        '03 - Wage & Hour Issues',
        '04 - Workplace Safety',
        '05 - Termination',
        '06 - Non-Compete Agreements',
        '07 - Union Relations',
        '08 - EEOC Filings',
        '09 - Arbitration',
        '10 - Settlement',
        '11 - Correspondence'
      ]
    };
    
    return templates[template] || [];
  }

  /**
   * Bulk operation methods
   */
  
  allFilesSelected(): boolean {
    return this.files.length > 0 && this.selectedFiles.length === this.files.length;
  }
  
  someFilesSelected(): boolean {
    return this.selectedFiles.length > 0 && this.selectedFiles.length < this.files.length;
  }
  
  toggleAllFiles(event: any): void {
    const isChecked = event.target.checked;
    
    if (isChecked) {
      this.selectedFiles = this.files.map(f => f.id);
    } else {
      this.selectedFiles = [];
    }
  }
  
  clearSelection(): void {
    this.selectedFiles = [];
  }
  
  // Bulk operations
  bulkAssignToCase(caseId: string): void {
    if (this.selectedFiles.length === 0) {
      return;
    }
    
    const selectedCase = this.activeCases.find(c => c.id === caseId);
    if (!selectedCase) {
      return;
    }
    
    // Update selected files with case information
    this.files.forEach(file => {
      if (this.selectedFiles.includes(file.id)) {
        file.caseId = selectedCase.id;
        file.caseName = selectedCase.title;
      }
    });
    
    console.log(`Assigned ${this.selectedFiles.length} files to case: ${selectedCase.title}`);
    
    // Show success message
    const message = `Successfully assigned ${this.selectedFiles.length} file${this.selectedFiles.length === 1 ? '' : 's'} to ${selectedCase.caseNumber}`;
    console.log(message);
    
    // Clear selection
    this.clearSelection();
  }
  
  bulkRemoveFromCase(): void {
    if (this.selectedFiles.length === 0) {
      return;
    }
    
    // Remove case association from selected files
    this.files.forEach(file => {
      if (this.selectedFiles.includes(file.id)) {
        file.caseId = null;
        file.caseName = null;
      }
    });
    
    console.log(`Removed ${this.selectedFiles.length} files from case association`);
    
    // Show success message
    const message = `Successfully removed ${this.selectedFiles.length} file${this.selectedFiles.length === 1 ? '' : 's'} from case`;
    console.log(message);
    
    // Clear selection
    this.clearSelection();
  }
  
}