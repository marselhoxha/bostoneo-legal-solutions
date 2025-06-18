import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, AfterViewInit, Renderer2 } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CaseDocumentsService } from '../../../services/case-documents.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { DocumentType, DocumentStatus, DocumentCategory } from '../../../interfaces/document.interface';
import { DocumentService } from '../../../services/document.service';
import { CaseService } from '../../../services/case.service';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Observable } from 'rxjs';
import { Modal, Dropdown } from 'bootstrap'; // Import Bootstrap modules properly

@Component({
  selector: 'app-document-list',
  templateUrl: './document-list.component.html',
  styleUrls: ['./document-list.component.scss'],
  styles: [`
    .dropdown-menu.show {
      z-index: 1055 !important; /* Higher than modals (1050) */
      position: absolute !important;
      margin: 0 !important;
      padding: 0.5rem 0;
      transform: none !important;
      transition: none !important;
    }
  `]
})
export class DocumentListComponent implements OnInit, OnDestroy, AfterViewInit {
  caseId: string | null = null;
  documents: any[] = [];
  loading: boolean = false;
  uploadForm: FormGroup;
  versionForm: FormGroup;
  selectedFile: File | null = null;
  versionFile: File | null = null;
  fileUploading: boolean = false;
  versionUploading: boolean = false;
  searchQuery: string = '';
  filteredDocuments: any[] = [];
  private subscriptions: Subscription = new Subscription();

  // Add properties required by template
  searchTerm: string = '';
  selectedType: string = '';
  selectedStatus: string = '';
  selectedCategory: string = '';
  selectedCaseFilter: string = '';
  documentTypes = Object.values(DocumentType);
  documentStatuses = Object.values(DocumentStatus);
  documentCategories = Object.values(DocumentCategory);
  
  // View options
  viewMode: 'grid' | 'list' = 'grid';
  
  // Case list for filtering
  caseList: any[] = [];

  // New properties for the UI
  recentDocumentsCount = 0;
  pendingReviewCount = 0;
  storageUsed = '0 MB';
  selectedDocument: any = null;
  documentForVersionHistory: any = null;
  documentForNewVersion: any = null;
  previewUrl: SafeResourceUrl | null = null;
  previewError: string | null = null;
  versionComment: string = '';
  uploadVersionProgress: number = 0;
  private currentObjectUrl: string | null = null; // To store object URL for revoking
  
  // Modal references
  private previewModalInstance: Modal | null = null;
  private versionHistoryModalInstance: Modal | null = null;
  private uploadVersionModalInstance: Modal | null = null;
  
  // ViewChild references
  @ViewChild('documentPreviewModal') documentPreviewModal!: ElementRef;
  @ViewChild('versionHistoryModal') versionHistoryModal!: ElementRef;
  @ViewChild('uploadVersionModal') uploadVersionModal!: ElementRef;

  // Simplify dropdown tracking
  private dropdownList: Dropdown[] = [];

  // Add userCache property to store user information
  private userCache: Map<number, any> = new Map();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private caseDocumentsService: CaseDocumentsService,
    private documentService: DocumentService,
    private caseService: CaseService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private toastr: ToastrService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2
  ) {
    this.uploadForm = this.fb.group({
      title: [''],
      description: [''],
      type: [''],
      category: [''],
      file: [null]
    });
    
    this.versionForm = this.fb.group({
      file: [null, Validators.required],
      comment: ['', Validators.maxLength(255)]
    });
  }

  ngOnInit(): void {
    console.log('[DocumentList] Component initializing');
    
    // Fetch users for caching
    this.fetchUsersForCache();
    
    this.subscriptions.add(
      this.route.paramMap.subscribe(params => {
        this.caseId = params.get('caseId');
        // Load cases first, then documents to ensure case information is available
        this.loadCases().then(() => {
          this.loadDocuments();
        });
      })
    );
    this.calculateStats();
  }

  ngOnDestroy(): void {
    // Clean up resources
    this.destroyDropdowns();
    this.destroyModals();
    this.subscriptions.unsubscribe();
  }

  private destroyDropdowns(): void {
    try {
      // Dispose all Bootstrap dropdown instances
      this.dropdownList.forEach(dropdown => {
        if (dropdown) {
          dropdown.dispose();
        }
      });
      this.dropdownList = [];
      console.log('[destroyDropdowns] Bootstrap dropdowns disposed');
    } catch (error) {
      console.error('[destroyDropdowns] Error disposing dropdowns:', error);
    }
  }

  ngAfterViewInit(): void {
    console.log('[DocumentList] AfterViewInit - initializing UI components');
    
    // Initialize modals
    setTimeout(() => {
      this.initializeModals();
      
      // Initialize dropdowns with a delay to ensure DOM is ready
      setTimeout(() => {
        this.initializeDropdowns();
      }, 300);
    }, 100);
  }

  /**
   * Initialize all Bootstrap modals
   */
  private initializeModals(): void {
    try {
      console.log('[DocumentList] Initializing modals');
      // Document preview modal
      if (this.documentPreviewModal) {
        this.previewModalInstance = new Modal(this.documentPreviewModal.nativeElement);
        this.documentPreviewModal.nativeElement.addEventListener('hidden.bs.modal', () => {
          this.revokePreviewUrl();
        });
        console.log('[DocumentList] Preview modal initialized');
      }
      
      // Version history modal
      if (this.versionHistoryModal) {
        this.versionHistoryModalInstance = new Modal(this.versionHistoryModal.nativeElement);
        this.versionHistoryModal.nativeElement.addEventListener('hidden.bs.modal', () => {
          // Clean up any data when the modal is hidden
          if (this.documentForVersionHistory) {
            this.documentForVersionHistory.versions = null;
          }
        });
        console.log('[DocumentList] Version history modal initialized');
      }
      
      // Upload new version modal
      if (this.uploadVersionModal) {
        this.uploadVersionModalInstance = new Modal(this.uploadVersionModal.nativeElement);
        this.uploadVersionModal.nativeElement.addEventListener('hidden.bs.modal', () => {
          // Reset form when modal is closed
          this.versionForm.reset();
          this.versionFile = null;
        });
        console.log('[DocumentList] Upload version modal initialized');
      }
      
      console.log('All modals initialized successfully');
      } catch (error) {
      console.error('Error initializing modals:', error);
    }
  }
  
  /**
   * Destroy all modal instances on component destroy
   */
  private destroyModals(): void {
    try {
      if (this.previewModalInstance) {
        this.previewModalInstance.dispose();
      }
      if (this.versionHistoryModalInstance) {
        this.versionHistoryModalInstance.dispose();
      }
      if (this.uploadVersionModalInstance) {
        this.uploadVersionModalInstance.dispose();
      }
    } catch (error) {
      console.error('Error destroying modals:', error);
    }
  }

  /**
   * Initialize Bootstrap dropdowns properly
   * This uses the standard Bootstrap approach
   */
  private initializeDropdowns(): void {
    console.log('[DocumentList] Initializing dropdowns');
    try {
      // First, dispose any existing dropdowns
      this.destroyDropdowns();
      
      // Find all dropdown toggle elements
      const dropdownToggles = document.querySelectorAll('[data-bs-toggle="dropdown"]');
      console.log(`[DocumentList] Found ${dropdownToggles.length} dropdown toggles`);
      
      // Initialize each dropdown with Bootstrap's API
      dropdownToggles.forEach(element => {
        try {
          const dropdown = new Dropdown(element);
          this.dropdownList.push(dropdown);
        } catch (error) {
          console.error('[DocumentList] Error initializing dropdown:', error);
        }
      });
      
      console.log('[DocumentList] Successfully initialized dropdowns');
    } catch (error) {
      console.error('[DocumentList] Error initializing dropdowns:', error);
    }
  }

  revokePreviewUrl(): void {
    if (this.currentObjectUrl) {
      try {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
      } catch (error) {
        console.error('Error revoking URL:', error);
      }
    }
  }

  closePreview(): void {
    this.revokePreviewUrl();
    this.previewModalInstance?.hide();
    this.selectedDocument = null;
      this.previewUrl = null;
      this.previewError = null;
    this.cdr.detectChanges();
  }

  loadCases(): Promise<void> {
    // Convert to a Promise to ensure we can chain document loading
    return new Promise((resolve) => {
    // Don't set loading = true here, as it's mainly for documents
      this.caseService.getCases().subscribe({
        next: response => {
          // Check if response is an object with nested data structure
          if (response && response.data && response.data.page && Array.isArray(response.data.page.content)) {
            this.caseList = response.data.page.content;
          } else if (Array.isArray(response)) {
            // Handle direct array response
            this.caseList = response;
          } else {
            // Initialize as empty array in case of unexpected response
            console.error('Unexpected response format from getCases():', response);
            this.caseList = [];
          }
          
          // Add test case data if no cases were loaded
          this.loadTestCases();
          // Force change detection to update the UI with case names
          this.cdr.detectChanges();
          resolve();
        },
        error: error => {
          console.error('Error loading cases:', error);
          this.caseList = [];
          // Add test case data on error
          this.loadTestCases();
          // Force change detection to update the UI with case names
          this.cdr.detectChanges();
          resolve();
        }
      });
    });
  }

  // Method to get case name by ID
  getCaseName(caseId: string): string {
    if (!caseId) return 'No Case';
    
    const foundCase = this.caseList.find(c => c.id === caseId);
    if (foundCase) {
      return foundCase.name || foundCase.caseNumber || `Case #${caseId}`;
    } else {
      // If case not found in list but we have an ID, show a temporary label
      return `Case #${caseId}`;
    }
  }

  // Get document type icon
  getDocTypeIcon(docType: string): string {
    if (!docType) return 'ri-file-text-line';
    
    switch(docType) {
      case DocumentType.CONTRACT:
        return 'ri-draft-line';
      case DocumentType.PLEADING:
        return 'ri-file-list-3-line';
      case DocumentType.EVIDENCE:
        return 'ri-file-search-line';
      case DocumentType.CORRESPONDENCE:
        return 'ri-file-paper-line';
      case DocumentType.MOTION:
        return 'ri-file-paper-2-line';
      case DocumentType.ORDER:
        return 'ri-hammer-line';
      default:
        return 'ri-file-text-line';
    }
  }

  // Get document type class for styling
  getDocTypeClass(docType: string): string {
    if (!docType) return 'bg-secondary-subtle text-secondary';
    
    switch(docType) {
      case DocumentType.CONTRACT:
        return 'bg-info-subtle text-info';
      case DocumentType.PLEADING:
        return 'bg-primary-subtle text-primary';
      case DocumentType.EVIDENCE:
        return 'bg-warning-subtle text-warning';
      case DocumentType.CORRESPONDENCE:
        return 'bg-success-subtle text-success';
      case DocumentType.MOTION:
        return 'bg-danger-subtle text-danger';
      case DocumentType.ORDER:
        return 'bg-warning-subtle text-warning';
      default:
        return 'bg-secondary-subtle text-secondary';
    }
  }

  private calculateStats(): void {
    // Calculate recent documents (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    this.recentDocumentsCount = this.documents.filter(doc => 
      new Date(doc.uploadedAt) > sevenDaysAgo
    ).length;

    // Calculate pending review
    this.pendingReviewCount = this.documents.filter(doc => 
      doc.status === 'DRAFT'
    ).length;

    // Calculate storage used (simplified)
    const totalSize = this.documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
    this.storageUsed = this.formatFileSize(totalSize);
  }

  formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Method to load test document data for development/testing purposes
  private loadTestDocuments(): void {
    // Only add test data if no documents were returned from the API
    if (this.documents.length === 0) {
      const testDocs = [
        {
          id: '1234abcd',
          title: 'Contract Agreement',
          description: 'Legal service agreement with terms and conditions',
          type: DocumentType.CONTRACT,
          status: DocumentStatus.FINAL,
          uploadedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          fileSize: 1250000,
          uploadedBy: { firstName: 'John', lastName: 'Doe' },
          caseId: '123'
        },
        {
          id: '5678efgh',
          title: 'Court Filing Document',
          description: 'Court filing document for case #123456',
          type: DocumentType.PLEADING,
          status: DocumentStatus.DRAFT,
          uploadedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
          fileSize: 780000,
          uploadedBy: { firstName: 'Jane', lastName: 'Smith' }
        },
        {
          id: '9012ijkl',
          title: 'Evidence Document',
          description: 'Evidence document containing photographs and testimonials',
          type: DocumentType.EVIDENCE,
          status: DocumentStatus.FINAL,
          uploadedAt: new Date(),
          fileSize: 3500000,
          uploadedBy: { firstName: 'Robert', lastName: 'Johnson' },
          caseId: '456'
        },
        {
          id: '3456mnop',
          title: 'Client Communication',
          description: 'Email correspondence with client regarding settlement options',
          type: DocumentType.CORRESPONDENCE,
          status: DocumentStatus.DRAFT,
          uploadedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
          fileSize: 450000,
          uploadedBy: { firstName: 'Emily', lastName: 'Williams' },
          caseId: '123'
        }
      ];
      
      this.documents = testDocs;
      console.info('Added test document data for UI demonstration purposes');
    }
  }

  loadDocuments(): void {
    console.log('[loadDocuments] Starting...');
    this.loading = true;
    this.documents = []; // Reset documents array
    let documentObservable: Observable<any>;

    if (this.caseId) {
      console.log(`[loadDocuments] Loading documents for case ID: ${this.caseId}`);
      documentObservable = this.caseDocumentsService.getDocuments(this.caseId);
    } else {
      console.log('[loadDocuments] Loading all documents.');
      documentObservable = this.documentService.getDocuments();
    }

    this.subscriptions.add(
      documentObservable.pipe(
        catchError(error => {
          const errorSource = this.caseId ? 'case documents' : 'all documents';
          console.error(`[loadDocuments] Error loading ${errorSource}:`, error);
          this.snackBar.open('Error loading documents. Please try again later.', 'Close', {
            duration: 5000
          });
          this.documents = []; // Ensure documents are empty on error
          this.loadTestDocuments(); // Load test data on error for dev
          this.applyFilters();
          this.calculateStats();
          // Return an empty observable or rethrow, but ensure finalize still runs
          // For simplicity here, we handle state and let finalize manage loading flag
          return []; // Return an empty array to complete the stream gracefully
        }),
        finalize(() => {
          console.log('[loadDocuments] Finalizing... Setting loading = false.');
          this.loading = false; 
          this.cdr.detectChanges();
        })
      )
      .subscribe(response => {
        const source = this.caseId ? 'Case' : 'All';
        console.log(`[loadDocuments] ${source} documents response received:`, response);
        
        // Handle different response structures
        if (Array.isArray(response)) {
          this.documents = response;
        } else if (response && typeof response === 'object' && 'data' in response && Array.isArray((response as any).data)) {
          this.documents = (response as any).data;
        } else if (response && response.data && response.data.page && Array.isArray(response.data.page.content)) {
          this.documents = response.data.page.content;
        } else if (response && typeof response === 'object' && Object.keys(response).length > 0) { // Check if it's a non-empty object
          this.documents = [response];
        } else {
          this.documents = [];
          console.warn('[loadDocuments] Unexpected response format or empty response:', response);
        }
        
        console.log('[loadDocuments] Documents processed, count:', this.documents.length);
        
        // Debug: Log user information for documents
        if (this.documents.length > 0) {
          this.documents.forEach(doc => {
            this.debugUserInfo(doc);
          });
        }
        
        // Only add test data if API returned nothing
        if (this.documents.length === 0) {
          this.loadTestDocuments();
        }
        
        this.applyFilters();
        this.calculateStats();
        this.cdr.detectChanges();
        // Loading is set in finalize
      })
    );
  }

  /**
   * Helper to debug user information
   */
  private debugUserInfo(doc: any): void {
    // Log full document for debugging
    console.log(`[debugUserInfo] Document ID: ${doc.id}, Title: ${doc.title}`);
    console.log(`[debugUserInfo] FULL DOCUMENT DATA:`, JSON.stringify(doc, null, 2));
    
    // Check specifically for all user-related fields
    console.log(`[debugUserInfo] User fields available:`, {
      'uploadedBy': doc.uploadedBy,
      'uploadedById': doc.uploadedById,
      'createdBy': doc.createdBy,
      'createdById': doc.createdById,
      'created_by': doc.created_by,
      'created_by_id': doc.created_by_id,
      'uploaded_by': doc.uploaded_by,
      'user': doc.user
    });
    
    // Check nested structure (common in Spring backend)
    if (doc.uploadedBy) {
      console.log(`[debugUserInfo] uploadedBy structure:`, {
        'id': doc.uploadedBy.id,
        'firstName': doc.uploadedBy.firstName,
        'lastName': doc.uploadedBy.lastName,
        'email': doc.uploadedBy.email
      });
    }
    
    // Check if user ID is a property on the document
    const possibleIdFields = ['uploadedById', 'createdById', 'userId', 'user_id', 'createdUserId', 'created_by_id'];
    possibleIdFields.forEach(field => {
      if (doc[field]) {
        console.log(`[debugUserInfo] Found user ID in field ${field}:`, doc[field]);
      }
    });
  }

  /**
   * Fetch users for caching to display user names properly
   */
  private fetchUsersForCache(): void {
    // Add sample users for testing - replace with actual service call
    const sampleUsers = [
      { id: 1, firstName: 'Marsel', lastName: 'Hoxha' },
      { id: 2, firstName: 'John', lastName: 'Doe' },
      { id: 3, firstName: 'Jane', lastName: 'Smith' }
    ];
    
    // Store in cache
    sampleUsers.forEach(user => {
      this.userCache.set(user.id, user);
    });
    
    // In a real application, you would fetch from a service:
    /*
    this.userService.getAllUsers().subscribe({
      next: (users: any[]) => {
        users.forEach(user => {
          this.userCache.set(user.id, user);
        });
        console.log('[fetchUsersForCache] Cached', users.length, 'users');
      },
      error: (error) => {
        console.error('[fetchUsersForCache] Error fetching users:', error);
      }
    });
    */
  }

  /**
   * Get user display name from document
   */
  getUserDisplayName(document: any): string {
    // For debugging
    console.log('[getUserDisplayName] Document:', document.id, document.title);
    
    // Option 1: uploadedBy is a user object with firstName
    if (document.uploadedBy && typeof document.uploadedBy === 'object' && document.uploadedBy.firstName) {
      console.log('[getUserDisplayName] Using uploadedBy object');
      return `${document.uploadedBy.firstName} ${document.uploadedBy.lastName || ''}`;
    }
    
    // Option 2: uploadedBy is a numeric ID - look up name from cache
    if (document.uploadedBy && typeof document.uploadedBy === 'number') {
      const userId = document.uploadedBy;
      console.log('[getUserDisplayName] Looking up user from ID:', userId);
      
      // Check if user exists in cache
      if (this.userCache.has(userId)) {
        const user = this.userCache.get(userId);
        return `${user.firstName} ${user.lastName || ''}`;
      }
      
      // Fallback if user not in cache
      return `User #${userId}`;
    }
    
    // Option 3: created_by object with firstName
    if (document.created_by && typeof document.created_by === 'object' && document.created_by.firstName) {
      console.log('[getUserDisplayName] Using created_by object');
      return `${document.created_by.firstName} ${document.created_by.lastName || ''}`;
    }
    
    // Option 4: createdBy object with firstName
    if (document.createdBy && typeof document.createdBy === 'object' && document.createdBy.firstName) {
      console.log('[getUserDisplayName] Using createdBy object');
      return `${document.createdBy.firstName} ${document.createdBy.lastName || ''}`;
    }
    
    // Option 5: user object with firstName
    if (document.user && document.user.firstName) {
      console.log('[getUserDisplayName] Using user object');
      return `${document.user.firstName} ${document.user.lastName || ''}`;
    }
    
    // Option 6: Various ID fields that might contain user ID - try to look up in cache
    if (document.uploadedById) {
      const userId = document.uploadedById;
      if (this.userCache.has(userId)) {
        const user = this.userCache.get(userId);
        return `${user.firstName} ${user.lastName || ''}`;
      }
      return `User #${userId}`;
    }
    
    if (document.createdById) {
      const userId = document.createdById;
      if (this.userCache.has(userId)) {
        const user = this.userCache.get(userId);
        return `${user.firstName} ${user.lastName || ''}`;
      }
      return `User #${userId}`;
    }
    
    // No user information found at all
    console.log('[getUserDisplayName] No user info found, using System');
    return 'System';
  }

  onFileSelected(event: any): void {
    if (event.target.files && event.target.files.length) {
      this.selectedFile = event.target.files[0];
      this.uploadForm.patchValue({ file: this.selectedFile });
    }
  }

  uploadDocument(): void {
    if (!this.selectedFile) {
      this.snackBar.open('Please select a file to upload.', 'Close', {
        duration: 3000
      });
      return;
    }

    this.fileUploading = true;

    if (this.caseId) {
      // Upload to specific case
      const formData = new FormData();
      formData.append('file', this.selectedFile);
      
      if (this.uploadForm.get('title')?.value) {
        formData.append('title', this.uploadForm.get('title')?.value);
      }
      
      if (this.uploadForm.get('description')?.value) {
        formData.append('description', this.uploadForm.get('description')?.value);
      }
      
      if (this.uploadForm.get('type')?.value) {
        formData.append('type', this.uploadForm.get('type')?.value);
      }
      
      if (this.uploadForm.get('category')?.value) {
        formData.append('category', this.uploadForm.get('category')?.value);
      }

      this.caseDocumentsService.uploadDocument(this.caseId, formData)
        .pipe(
          finalize(() => {
            this.fileUploading = false;
          }),
          catchError(error => {
            this.snackBar.open('Error uploading document. Please try again.', 'Close', {
              duration: 5000
            });
            throw error;
          })
        )
        .subscribe(response => {
          this.snackBar.open('Document uploaded successfully!', 'Close', {
            duration: 3000
          });
          this.resetForm();
          this.loadDocuments();
        });
    } else {
      // Upload without case ID
      const documentData = {
        title: this.uploadForm.get('title')?.value || 'Untitled Document',
        type: this.uploadForm.get('type')?.value || DocumentType.OTHER,
        category: this.uploadForm.get('category')?.value || DocumentCategory.PUBLIC,
        description: this.uploadForm.get('description')?.value || '',
        status: DocumentStatus.DRAFT
      };

      this.documentService.uploadDocument(this.selectedFile, documentData)
        .pipe(
          finalize(() => {
            this.fileUploading = false;
          }),
          catchError(error => {
            console.error('Error uploading document:', error);
            this.snackBar.open('Error uploading document. Please try again.', 'Close', {
              duration: 5000
            });
            throw error;
          })
        )
        .subscribe(response => {
          this.snackBar.open('Document uploaded successfully!', 'Close', {
            duration: 3000
          });
          this.resetForm();
          this.loadDocuments();
        });
    }
  }

  resetForm(): void {
    this.uploadForm.reset();
    this.selectedFile = null;
  }

  viewDocument(documentId: string): void {
    if (this.caseId) {
      this.router.navigate(['/legal/cases', this.caseId, 'documents', documentId]);
    } else {
      this.router.navigate(['/legal/documents', documentId]);
    }
  }

  deleteDocument(document: any): void {
    Swal.fire({
      title: 'Are you sure?',
      text: 'You will not be able to recover this document!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'No, keep it'
    }).then((result) => {
      if (result.isConfirmed) {
        if (this.caseId) {
          // Delete from case
          this.caseDocumentsService.deleteDocument(this.caseId, document.id)
            .pipe(
              catchError(error => {
                this.snackBar.open('Error deleting document. Please try again.', 'Close', {
                  duration: 5000
                });
                throw error;
              })
            )
            .subscribe(() => {
              this.snackBar.open('Document deleted successfully!', 'Close', {
                duration: 3000
              });
              this.loadDocuments();
            });
        } else {
          // Delete without case ID
          this.documentService.deleteDocument(document.id)
            .pipe(
              catchError(error => {
                this.snackBar.open('Error deleting document. Please try again.', 'Close', {
                  duration: 5000
                });
                throw error;
              })
            )
            .subscribe(() => {
              this.snackBar.open('Document deleted successfully!', 'Close', {
                duration: 3000
              });
              this.loadDocuments();
            });
        }
      }
    });
  }

  downloadDocument(documentId: string, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Use explicit service calls instead of union type
    const downloadMethod = this.caseId 
      ? this.caseDocumentsService.downloadDocument(this.caseId, documentId)
      : this.documentService.downloadDocument(documentId);

    this.subscriptions.add(
      downloadMethod.subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          
          // Find document name
          const foundDocument = this.documents.find(doc => doc.id.toString() === documentId);
          const fileName = foundDocument?.originalFileName || foundDocument?.title || `document_${documentId}`;
          
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          
          this.toastr.success('Document downloaded successfully', 'Success');
        },
        error: (error) => {
          console.error('Download failed:', error);
          this.toastr.error('Failed to download document', 'Error');
        }
      })
    );
  }

  // Rename method to match template
  applyFilters(): void {
    this.filteredDocuments = this.documents.filter(doc => {
      // Text search
      const matchesSearch = !this.searchTerm.trim() || 
        doc.title?.toLowerCase().includes(this.searchTerm.toLowerCase()) || 
        doc.description?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (doc.tags && Array.isArray(doc.tags) && doc.tags.some((tag: string) => 
          tag.toLowerCase().includes(this.searchTerm.toLowerCase())));
      
      // Type filter
      const matchesType = !this.selectedType || doc.type === this.selectedType;
      
      // Status filter
      const matchesStatus = !this.selectedStatus || doc.status === this.selectedStatus;
      
      // Category filter
      const matchesCategory = !this.selectedCategory || doc.category === this.selectedCategory;
      
      // Case filter
      const matchesCase = !this.selectedCaseFilter || doc.caseId === this.selectedCaseFilter;
      
      return matchesSearch && matchesType && matchesStatus && matchesCategory && matchesCase;
    });
  }

  // Add methods required by template
  createDocument(): void {
    this.router.navigate(['/legal/documents/create']);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedType = '';
    this.selectedStatus = '';
    this.selectedCategory = '';
    this.selectedCaseFilter = '';
    this.applyFilters();
  }

  previewDocument(document: any): void {
    console.log('previewDocument called for:', document.id, document.title);
    this.revokePreviewUrl(); // Revoke previous URL if any
    this.selectedDocument = document;
    this.previewUrl = null; // Reset preview URL
    this.previewError = null; // Reset error

    // Show modal immediately
    try {
      console.log('Attempting to show modal:', this.previewModalInstance);
      this.previewModalInstance?.show();
    } catch (error) {
      console.error('Error showing modal:', error);
    }

    console.log('Attempting to preview document:', document.id, document.title);
    
    // Use preview parameter to distinguish from downloads
    let downloadMethod;
    
    if (this.caseId) {
      // For case documents, add preview parameter
      downloadMethod = this.caseDocumentsService.downloadDocument(this.caseId, document.id, true);
    } else {
      // For standalone documents, use regular endpoint with preview param
      downloadMethod = this.documentService.downloadDocument(document.id, true);
    }

    this.subscriptions.add(
      downloadMethod.subscribe({
        next: (blob: Blob) => {
          console.log('Blob received for preview:', blob);
          console.log('Blob type:', blob.type);
          
          if (blob && blob.size > 0) {
            // Force PDF type if filename ends with .pdf but type is incorrect
            let blobToUse = blob;
            const filename = document.fileName || '';
            
            // If file is PDF but content type is not set correctly, fix it
            if (filename.toLowerCase().endsWith('.pdf') && blob.type !== 'application/pdf') {
              console.log('File appears to be PDF but has wrong content type. Creating new blob with correct type');
              blobToUse = new Blob([blob], { type: 'application/pdf' });
            }
            
            // Check blob type for preview compatibility
            if (blobToUse.type === 'application/pdf' || blobToUse.type.startsWith('image/')) {
              console.log('Creating object URL for blob type:', blobToUse.type);
              this.currentObjectUrl = URL.createObjectURL(blobToUse);
              this.previewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.currentObjectUrl);
              console.log('Preview URL generated:', this.currentObjectUrl);
              this.previewError = null;
            } else {
              console.warn(`Preview not supported for type: ${blobToUse.type}`);
              this.previewError = `Preview is not available for this file type (${blobToUse.type}). Please download the file instead.`;
            }
          } else {
            console.error('Received empty blob for preview.');
            this.previewError = 'Could not load document for preview (empty file).';
          }
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error downloading document for preview:', error);
          this.previewError = 'Failed to load document for preview. Please try downloading it.';
          this.previewUrl = null;
          this.cdr.detectChanges();
        }
      })
    );
  }

  /**
   * Get document version history with proper modal handling
   */
  showVersionHistory(document: any): void {
    console.log('Fetching version history for document:', document.id);
    this.documentForVersionHistory = {...document, versions: null};
    
    // Initialize modal if needed
    if (!this.versionHistoryModalInstance && this.versionHistoryModal) {
      try {
        this.versionHistoryModalInstance = new Modal(this.versionHistoryModal.nativeElement);
      } catch (error) {
        console.error('Error initializing version history modal:', error);
      }
    }
    
    // Show modal first with loading state
    this.versionHistoryModalInstance?.show();
    
    // Fetch version history
    const service = this.caseId ? this.caseDocumentsService : this.documentService;
    
    const processVersions = (versions: any) => {
      console.log('Processing versions:', versions);
      if (!this.documentForVersionHistory) {
        this.documentForVersionHistory = {...document};
      }
      
      // Parse and normalize the versions array
      let versionsArray: any[] = [];
      
      // Extract the versions array from the response
      if (Array.isArray(versions)) {
        versionsArray = versions;
      } else if (versions && typeof versions === 'object') {
        if (versions.data && Array.isArray(versions.data)) {
          versionsArray = versions.data;
        } else if (versions.versions && Array.isArray(versions.versions)) {
          versionsArray = versions.versions;
        }
      }
      
      // Process each version to normalize data
      versionsArray = versionsArray.map(version => {
        // Ensure we have a date for sorting
        const versionDate = version.createdAt || version.uploadedAt || version.date || new Date();
        
        // Process user information
        let userInfo = null;
        
        // Check for different user info formats
        if (version.uploadedBy && typeof version.uploadedBy === 'object') {
          userInfo = version.uploadedBy;
        } else if (version.createdBy && typeof version.createdBy === 'object') {
          userInfo = version.createdBy;
        } else if (version.uploadedBy && typeof version.uploadedBy === 'number') {
          // Try to get from cache if it's just an ID
          const userId = version.uploadedBy;
          userInfo = this.userCache.has(userId) ? this.userCache.get(userId) : { id: userId };
        } else if (version.createdBy && typeof version.createdBy === 'number') {
          const userId = version.createdBy;
          userInfo = this.userCache.has(userId) ? this.userCache.get(userId) : { id: userId };
        } else if (version.uploadedBy && typeof version.uploadedBy === 'string') {
          // If it's a string, it might be a name or username
          userInfo = { displayName: version.uploadedBy };
        } else if (version.createdBy && typeof version.createdBy === 'string') {
          userInfo = { displayName: version.createdBy };
        }
        
        // Combine comment, changes and notes fields for display
        const changeInfo = version.comment || version.changes || version.notes || '';
        
        return {
          ...version,
          userInfo,
          date: new Date(versionDate),
          changeInfo
        };
      });
      
      // Sort versions by date (newest first)
      versionsArray.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      this.documentForVersionHistory.versions = versionsArray;
      this.cdr.detectChanges();
    };
    
    if (!this.caseId) {
      // Using document service
      this.subscriptions.add(
        this.documentService.getDocumentVersions(document.id).subscribe({
          next: processVersions,
          error: (error) => {
            console.error('Error fetching versions:', error);
            this.documentForVersionHistory.versions = [];
            this.snackBar.open('Failed to load version history', 'Close', { duration: 3000 });
            this.cdr.detectChanges();
          }
        })
      );
    } else {
      // Using case document service
      this.subscriptions.add(
        this.caseDocumentsService.getVersionHistory(this.caseId, document.id).subscribe({
          next: processVersions,
          error: (error) => {
            console.error('Error fetching versions for case document:', error);
            this.documentForVersionHistory.versions = [];
            this.snackBar.open('Failed to load version history', 'Close', { duration: 3000 });
            this.cdr.detectChanges();
          }
        })
      );
    }
  }

  uploadNewVersion(document: any): void {
    console.log('Preparing to upload new version for document:', document.id);
    this.documentForNewVersion = document;
    this.versionFile = null;
    this.versionForm.reset();
    this.uploadVersionProgress = 0;
    this.versionUploading = false;
    
    // Show the modal
    this.uploadVersionModalInstance?.show();
  }

  onVersionFileSelected(event: any): void {
    if (event.target.files && event.target.files.length) {
      this.versionFile = event.target.files[0];
    }
  }

  submitNewVersion(): void {
    if (!this.documentForNewVersion || !this.versionFile) {
      this.snackBar.open('Please select a file to upload', 'Close', { duration: 3000 });
      return;
    }

    const documentId = this.documentForNewVersion.id;
    this.versionUploading = true;
    this.uploadVersionProgress = 0;

    // Get the comment from the form
    const comment = this.versionForm.get('comment')?.value || '';

    // Use explicit type casting to avoid TypeScript errors
    if (this.caseId) {
      // Using CaseDocumentsService
      this.subscriptions.add(
        this.caseDocumentsService.uploadVersion(this.caseId, documentId, this.versionFile, comment)
          .pipe(
            finalize(() => {
              this.versionUploading = false;
              this.cdr.detectChanges();
            })
          ).subscribe({
            next: (event: any) => {
              if (event.type === 'UploadProgress') {
                this.uploadVersionProgress = Math.round(100 * event.loaded / event.total);
              } else {
                // Upload complete
                this.uploadVersionProgress = 100;
                this.snackBar.open('New version uploaded successfully', 'Close', { duration: 3000 });
                
                // Close modal and reload documents
                setTimeout(() => {
                  this.uploadVersionModalInstance?.hide();
                  this.loadDocuments();
                }, 1000);
              }
              this.cdr.detectChanges();
        },
        error: (error) => {
              console.error('Error uploading new version:', error);
              this.snackBar.open('Error uploading new version', 'Close', { duration: 5000 });
        }
          })
      );
    } else {
      // Using DocumentService
      this.subscriptions.add(
        this.documentService.uploadVersion(documentId, this.versionFile, comment)
          .pipe(
            finalize(() => {
              this.versionUploading = false;
              this.cdr.detectChanges();
            })
          ).subscribe({
            next: (event: any) => {
              if (event.type === 'UploadProgress') {
                this.uploadVersionProgress = Math.round(100 * event.loaded / event.total);
              } else {
                // Upload complete
                this.uploadVersionProgress = 100;
                this.snackBar.open('New version uploaded successfully', 'Close', { duration: 3000 });
                
                // Close modal and reload documents
                setTimeout(() => {
                  this.uploadVersionModalInstance?.hide();
                  this.loadDocuments();
                }, 1000);
              }
              this.cdr.detectChanges();
            },
            error: (error) => {
              console.error('Error uploading new version:', error);
              this.snackBar.open('Error uploading new version', 'Close', { duration: 5000 });
            }
          })
      );
    }
  }

  downloadVersion(documentId: string, versionId: string): void {
    const service = this.caseId ? this.caseDocumentsService : this.documentService;
    
    const downloadMethod = this.caseId 
      ? service.downloadVersion(this.caseId, documentId, versionId) 
      : (service as DocumentService).downloadVersion(documentId, versionId);

    this.subscriptions.add(
      downloadMethod.subscribe({
        next: (response) => {
          const blob = new Blob([response], { type: 'application/octet-stream' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `version_${versionId}`;
          link.click();
          window.URL.revokeObjectURL(url);
        },
        error: (error) => {
          this.snackBar.open('Error downloading version', 'Close', {
            duration: 5000
          });
        }
      })
    );
  }

  // Method to load test case data for development/testing purposes
  private loadTestCases(): void {
    // Only add test data if no cases were returned from the API
    if (this.caseList.length === 0) {
      const testCases = [
        {
          id: '123',
          name: 'Smith vs. Johnson',
          caseNumber: 'CASE-2023-001',
          status: 'ACTIVE'
        },
        {
          id: '456',
          name: 'ABC Corp Litigation',
          caseNumber: 'CASE-2023-002',
          status: 'PENDING'
        }
      ];
      
      this.caseList = testCases;
      console.info('Added test case data for UI demonstration purposes');
    }
  }

  /**
   * Get initials from user's name or return a default
   */
  getInitials(firstName?: string, lastName?: string): string {
    if (!firstName && !lastName) {
      return 'UN'; // Unknown
    }
    
    const first = firstName?.charAt(0)?.toUpperCase() || '';
    const last = lastName?.charAt(0)?.toUpperCase() || '';
    
    // Return at least one character, fall back to first available
    if (!first && !last) {
      return 'UN';
    } else if (!first) {
      return last + last; // Use last name initial twice if no first name
    } else if (!last) {
      return first + first; // Use first name initial twice if no last name
    } else {
      return first + last;
    }
  }

  /**
   * Preview a specific version of a document
   */
  previewVersionDocument(documentId: string, versionId: string): void {
    console.log(`Previewing version ${versionId} of document ${documentId}`);
    this.revokePreviewUrl(); // Revoke previous URL if any
    this.previewUrl = null; // Reset preview URL
    this.previewError = null; // Reset error

    // Reuse the current document as the basis for the preview
    if (this.documentForVersionHistory && this.documentForVersionHistory.id === documentId) {
      const versionDoc = {
        ...this.documentForVersionHistory,
        id: documentId,
        versionId: versionId
      };
      this.selectedDocument = versionDoc;
    } else {
      this.selectedDocument = { id: documentId, versionId: versionId };
    }

    // Show modal immediately
    try {
      console.log('Attempting to show modal:', this.previewModalInstance);
      this.previewModalInstance?.show();
    } catch (error) {
      console.error('Error showing modal:', error);
    }

    console.log(`Attempting to preview version ${versionId} of document:`, documentId);
    
    const service = this.caseId ? this.caseDocumentsService : this.documentService;
    const downloadMethod = this.caseId 
      ? service.downloadVersion(this.caseId, documentId, versionId) 
      : (service as DocumentService).downloadVersion(documentId, versionId);

    this.subscriptions.add(
      downloadMethod.subscribe({
        next: (blob: Blob) => {
          console.log('Blob received for version preview:', blob);
          console.log('Blob type:', blob.type);
          
          if (blob && blob.size > 0) {
            // Force PDF type if filename ends with .pdf but type is incorrect
            let blobToUse = blob;
            
            // If file is PDF but content type is not set correctly, fix it
            if (blobToUse.type !== 'application/pdf' && 
                (this.selectedDocument.fileName?.toLowerCase().endsWith('.pdf') || true)) {
              console.log('Creating new blob with PDF content type for preview');
              blobToUse = new Blob([blob], { type: 'application/pdf' });
            }
            
            // Check blob type for preview compatibility
            if (blobToUse.type === 'application/pdf' || blobToUse.type.startsWith('image/')) {
              console.log('Creating object URL for blob type:', blobToUse.type);
              this.currentObjectUrl = URL.createObjectURL(blobToUse);
              this.previewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.currentObjectUrl);
              console.log('Preview URL generated:', this.currentObjectUrl);
              this.previewError = null;
            } else {
              console.warn(`Preview not supported for type: ${blobToUse.type}`);
              this.previewError = `Preview is not available for this file type (${blobToUse.type}). Please download the file instead.`;
            }
          } else {
            console.error('Received empty blob for preview.');
            this.previewError = 'Could not load document for preview (empty file).';
          }
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error downloading version for preview:', error);
          this.previewError = 'Failed to load document version for preview. Please try downloading it.';
          this.previewUrl = null;
          this.cdr.detectChanges();
        }
      })
    );
  }

  /**
   * Version-related helper methods for template
   */
  getVersionFileName(version: any): string {
    if (!version) return 'Unknown';
    return version.fileName || version.filename || version.originalName || version.name || 'Unknown';
  }

  getVersionFileSize(version: any): number {
    if (!version) return 0;
    return version.fileSize || version.size || 0;
  }

  getVersionUserDisplayName(version: any): string {
    if (!version) return 'Unknown';
    
    // Try different possible structures for user info
    const uploadedBy = version.uploadedBy || version.createdBy || version.user;
    
    if (uploadedBy) {
      if (uploadedBy.firstName || uploadedBy.lastName) {
        return `${uploadedBy.firstName || ''} ${uploadedBy.lastName || ''}`.trim();
      }
      if (uploadedBy.name) {
        return uploadedBy.name;
      }
      if (uploadedBy.username) {
        return uploadedBy.username;
      }
    }
    
    // Try version-level properties
    if (version.uploaderName) {
      return version.uploaderName;
    }
    
    return 'Unknown';
  }

  getVersionDate(version: any): Date | null {
    if (!version) return null;
    
    const dateString = version.uploadedAt || version.createdAt || version.date || version.timestamp;
    
    if (dateString) {
      return new Date(dateString);
    }
    
    return null;
  }

  getVersionChanges(version: any): string {
    if (!version) return '';
    return version.changes || version.comment || version.description || version.notes || '';
  }

  hasVersionChanges(version: any): boolean {
    const changes = this.getVersionChanges(version);
    return changes && changes.trim().length > 0;
  }
} 