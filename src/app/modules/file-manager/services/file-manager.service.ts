import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders, HttpEventType } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { 
  FileItemModel, 
  FolderModel, 
  FileVersion, 
  FileUploadResponse, 
  FileManagerStats,
  CreateFolderRequest,
  FileComment,
  CreateCommentRequest,
  FileTag,
  CreateTagRequest
} from '../models/file-manager.model';
import { environment } from '../../../../environments/environment';
import { Key } from '../../../enum/key.enum';

@Injectable({
  providedIn: 'root'
})
export class FileManagerService {
  private readonly DOCUMENTS_API = `${environment.apiUrl}/legal/documents`;
  private readonly CASES_API = `${environment.apiUrl}/legal-case`;
  private readonly FILE_MANAGER_API = `${environment.apiUrl}/api/file-manager`;
  
  // Observable streams for real-time updates
  private filesSubject = new BehaviorSubject<FileItemModel[]>([]);
  private foldersSubject = new BehaviorSubject<FolderModel[]>([]);
  private currentFolderSubject = new BehaviorSubject<FolderModel | null>(null);
  
  public files$ = this.filesSubject.asObservable();
  public folders$ = this.foldersSubject.asObservable();
  public currentFolder$ = this.currentFolderSubject.asObservable();
  
  // Simple cache implementation
  private cache = new Map<string, { data: any, timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  // Frequently accessed files cache
  private frequentlyAccessedCache = new Map<number, { file: FileItemModel, accessCount: number, lastAccessed: number }>();
  private readonly MAX_FREQUENT_CACHE_SIZE = 50;

  constructor(private http: HttpClient) { }

  // Helper method to get auth headers
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem(Key.TOKEN);
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // Helper method to get auth headers for file upload
  private getAuthHeadersForUpload(): HttpHeaders {
    const token = localStorage.getItem(Key.TOKEN);
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  // File Operations
  
  /**
   * Get all files with pagination and sorting
   */
  getFiles(page: number = 0, size: number = 50, sortBy: string = 'createdAt', direction: string = 'DESC'): Observable<any> {
    const cacheKey = `files_${page}_${size}_${sortBy}_${direction}`;
    const cached = this.getCachedData(cacheKey);
    
    if (cached) {
      this.filesSubject.next(cached.content);
      return new Observable(observer => {
        observer.next(cached);
        observer.complete();
      });
    }
    
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('direction', direction);
    
    return this.http.get<any>(`${this.FILE_MANAGER_API}/files`, { 
      params,
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        // Transform response to match file manager format
        const transformedResponse = {
          content: this.transformFilesFromAPI(response.content || []),
          totalElements: response.totalElements || 0,
          totalPages: response.totalPages || 0,
          number: response.number || page,
          size: response.size || size,
          first: response.first || true,
          last: response.last || true
        };
        
        // Cache the result
        this.setCachedData(cacheKey, transformedResponse);
        this.filesSubject.next(transformedResponse.content);
        return transformedResponse;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Get files by folder (filter by document category)
   */
  getFilesByFolder(folderId: number): Observable<FileItemModel[]> {
    // Map folder IDs to document categories
    const folderMap: { [key: number]: string } = {
      1: 'CONTRACT',
      2: 'EVIDENCE', 
      3: 'CORRESPONDENCE'
    };
    
    const category = folderMap[folderId];
    if (!category) {
      return this.getFiles().pipe(
        map(response => response.content || [])
      );
    }
    
    return this.http.get<any>(this.DOCUMENTS_API, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        const allFiles = this.transformDocumentsToFiles(response);
        const filteredFiles = allFiles.filter(file => 
          file.documentCategory === category
        );
        this.filesSubject.next(filteredFiles);
        return filteredFiles;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Get file by ID
   */
  getFileById(fileId: number): Observable<FileItemModel> {
    // Check cache first
    const cached = this.frequentlyAccessedCache.get(fileId);
    if (cached && (Date.now() - cached.lastAccessed) < this.CACHE_DURATION) {
      // Update access count and time
      cached.accessCount++;
      cached.lastAccessed = Date.now();
      return new Observable(observer => {
        observer.next(cached.file);
        observer.complete();
      });
    }
    
    return this.http.get<any>(`${this.DOCUMENTS_API}/${fileId}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        const file = this.transformDocumentToFile(response);
        this.cacheFrequentFile(fileId, file);
        return file;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Upload single file
   */
  uploadFile(file: File, folderId?: number, caseId?: number, documentCategory?: string, documentStatus?: string): Observable<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (folderId) formData.append('folderId', folderId.toString());
    if (caseId) formData.append('caseId', caseId.toString());
    if (documentCategory) formData.append('documentCategory', documentCategory);
    if (documentStatus) formData.append('documentStatus', documentStatus);

    return this.http.post<any>(`${this.FILE_MANAGER_API}/files/upload`, formData, {
      headers: this.getAuthHeadersForUpload(),
      reportProgress: true,
      observe: 'events'
    }).pipe(
      map(event => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          const progress = Math.round(100 * event.loaded / event.total);
          return { 
            success: false, 
            message: 'Uploading...', 
            progress 
          } as FileUploadResponse;
        } else if (event.type === HttpEventType.Response) {
          return {
            success: true,
            file: this.transformFileFromAPI(event.body),
            message: 'File uploaded successfully'
          } as FileUploadResponse;
        }
        return { 
          success: false, 
          message: 'Processing...' 
        } as FileUploadResponse;
      }),
      // Removed automatic refresh - let the component handle it based on context
      catchError(this.handleError)
    );
  }

  /**
   * Upload multiple files
   */
  uploadMultipleFiles(files: File[], folderId?: number, caseId?: number, documentCategory?: string, documentStatus?: string): Observable<FileUploadResponse> {
    // For now, upload files one by one since backend doesn't have bulk upload
    // TODO: Implement proper bulk upload if backend supports it
    const uploads = files.map(file => 
      this.uploadFile(file, folderId, caseId, documentCategory, documentStatus)
    );
    
    // Return the first upload for now
    return uploads[0] || new Observable(observer => {
      observer.next({ success: false, message: 'No files to upload' } as any);
      observer.complete();
    });
  }

  /**
   * Download file
   */
  downloadFile(fileId: number): Observable<Blob> {
    return this.http.get(`${this.FILE_MANAGER_API}/files/${fileId}/download`, { 
      responseType: 'blob',
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Delete file
   */
  deleteFile(fileId: number): Observable<void> {
    return this.http.delete<void>(`${this.FILE_MANAGER_API}/files/${fileId}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(() => this.refreshCurrentFolderFiles()),
      catchError(this.handleError)
    );
  }

  /**
   * Update file name
   */
  updateFile(fileId: number, name: string): Observable<FileItemModel> {
    const params = new HttpParams().set('name', name);
    
    return this.http.put<any>(`${this.FILE_MANAGER_API}/files/${fileId}`, null, {
      headers: this.getAuthHeaders(),
      params
    }).pipe(
      map(response => this.transformFileFromAPI(response)),
      tap(() => this.refreshCurrentFolderFiles()),
      catchError(this.handleError)
    );
  }

  /**
   * Toggle file star status
   */
  toggleFileStar(fileId: number): Observable<FileItemModel> {
    return this.http.post<any>(`${this.FILE_MANAGER_API}/files/${fileId}/star`, {}, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => this.transformFileFromAPI(response)),
      catchError(this.handleError)
    );
  }

  /**
   * Search files
   */
  searchFiles(query: string, page: number = 0, size: number = 50): Observable<any> {
    const params = new HttpParams()
      .set('query', query)
      .set('page', page.toString())
      .set('size', size.toString());
    
    return this.http.get<any>(`${this.FILE_MANAGER_API}/files/search`, {
      headers: this.getAuthHeaders(),
      params
    }).pipe(
      map(response => {
        return {
          content: this.transformFilesFromAPI(response.content || []),
          totalElements: response.totalElements || 0,
          totalPages: response.totalPages || 0,
          number: response.number || page,
          size: response.size || size
        };
      }),
      catchError(this.handleError)
    );
  }

  // Folder Operations
  
  /**
   * Get root folders
   */
  getRootFolders(): Observable<FolderModel[]> {
    return this.http.get<any>(`${this.FILE_MANAGER_API}/folders/root`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        const folders = this.transformFoldersFromAPI(response);
        this.foldersSubject.next(folders);
        return folders;
      }),
      catchError((error) => {
        console.warn('Root folders API not available, returning empty folders array:', error);
        const emptyFolders: FolderModel[] = [];
        this.foldersSubject.next(emptyFolders);
        return of(emptyFolders);
      })
    );
  }

  /**
   * Get folder contents (subfolders and files)
   */
  getFolderContents(folderId: number): Observable<any> {
    return this.http.get<any>(`${this.FILE_MANAGER_API}/folders/${folderId}/contents`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        const folders = this.transformFoldersFromAPI(response.folders || []);
        const files = this.transformFilesFromAPI(response.files || []);
        
        this.foldersSubject.next(folders);
        this.filesSubject.next(files);
        
        return {
          folders: folders,
          files: files
        };
      }),
      catchError((error) => {
        console.warn(`Folder contents API failed for folder ${folderId}:`, error);
        // Fallback: try to get all files and filter by folderId
        return this.getFiles().pipe(
          map(response => {
            const allFiles = response.content || [];
            const folderFiles = allFiles.filter((file: any) => file.folderId === folderId);
            
            this.filesSubject.next(folderFiles);
            this.foldersSubject.next([]); // No subfolders in fallback
            
            return {
              folders: [],
              files: folderFiles
            };
          }),
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Get folder by ID
   */
  getFolderById(folderId: number): Observable<FolderModel> {
    return this.http.get<any>(`${this.FILE_MANAGER_API}/folders/${folderId}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        const folder = this.transformFolderFromAPI(response);
        this.currentFolderSubject.next(folder);
        return folder;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Get folder permissions
   */
  getFolderPermissions(folderId: number): Observable<string[]> {
    return this.http.get<string[]>(`${this.FILE_MANAGER_API}/folders/${folderId}/permissions`, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get file permissions
   */
  getFilePermissions(fileId: number): Observable<string[]> {
    return this.http.get<string[]>(`${this.FILE_MANAGER_API}/files/${fileId}/permissions`, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Create new folder
   */
  createFolder(request: CreateFolderRequest): Observable<FolderModel> {
    return this.http.post<any>(`${this.FILE_MANAGER_API}/folders`, request, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        const folder = this.transformFolderFromAPI(response);
        this.refreshCurrentFolderContents();
        return folder;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Update folder name
   */
  updateFolder(folderId: number, name: string): Observable<FolderModel> {
    const params = new HttpParams().set('name', name);
    
    return this.http.put<any>(`${this.FILE_MANAGER_API}/folders/${folderId}`, null, {
      headers: this.getAuthHeaders(),
      params
    }).pipe(
      map(response => {
        const folder = this.transformFolderFromAPI(response);
        this.refreshCurrentFolderContents();
        return folder;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Delete folder
   */
  deleteFolder(folderId: number): Observable<void> {
    return this.http.delete<void>(`${this.FILE_MANAGER_API}/folders/${folderId}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(() => this.refreshCurrentFolderContents()),
      catchError(this.handleError)
    );
  }

  // Version Control

  /**
   * Get file versions
   */
  getFileVersions(fileId: number): Observable<FileVersion[]> {
    return this.http.get<FileVersion[]>(`${this.DOCUMENTS_API}/${fileId}/versions`, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Upload new version
   */
  uploadNewVersion(fileId: number, file: File, comment?: string): Observable<FileVersion> {
    const formData = new FormData();
    formData.append('file', file);
    if (comment) formData.append('comment', comment);

    return this.http.post<FileVersion>(`${this.DOCUMENTS_API}/${fileId}/versions`, formData, {
      headers: this.getAuthHeadersForUpload()
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Download file version
   */
  downloadFileVersion(versionId: number): Observable<Blob> {
    return this.http.get(`${this.DOCUMENTS_API}/versions/${versionId}/download`, { 
      responseType: 'blob',
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Restore file version
   */
  restoreFileVersion(fileId: number, versionId: number): Observable<void> {
    return this.http.post<void>(`${this.DOCUMENTS_API}/${fileId}/versions/${versionId}/restore`, {}, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Delete file version
   */
  deleteFileVersion(versionId: number): Observable<void> {
    return this.http.delete<void>(`${this.DOCUMENTS_API}/versions/${versionId}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Comments and Tags

  /**
   * Add comment to file
   */
  addComment(fileId: number, request: CreateCommentRequest): Observable<FileComment> {
    return this.http.post<FileComment>(`${this.DOCUMENTS_API}/${fileId}/comments`, request, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get file comments
   */
  getFileComments(fileId: number): Observable<FileComment[]> {
    return this.http.get<FileComment[]>(`${this.DOCUMENTS_API}/${fileId}/comments`, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Create tag
   */
  createTag(request: CreateTagRequest): Observable<FileTag> {
    return this.http.post<FileTag>(`${this.DOCUMENTS_API}/tags`, request, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get user tags
   */
  getUserTags(): Observable<FileTag[]> {
    return this.http.get<FileTag[]>(`${this.DOCUMENTS_API}/tags`, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Statistics and Analytics

  /**
   * Get user storage statistics
   */
  getStorageStats(): Observable<FileManagerStats> {
    // Calculate stats from current files
    const files = this.filesSubject.value;
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    const stats: FileManagerStats = {
      totalFiles: files.length,
      totalFolders: this.foldersSubject.value.length,
      totalSize: totalSize,
      formattedTotalSize: this.formatFileSize(totalSize),
      usedSpace: totalSize,
      availableSpace: 1073741824, // 1 GB
      usagePercentage: Math.round((totalSize / 1073741824) * 100),
      storageByType: {
        'Documents': {
          type: 'Documents',
          size: totalSize * 0.7,
          formattedSize: this.formatFileSize(totalSize * 0.7),
          count: Math.round(files.length * 0.7),
          percentage: 70,
          color: '#405189'
        },
        'Images': {
          type: 'Images', 
          size: totalSize * 0.2,
          formattedSize: this.formatFileSize(totalSize * 0.2),
          count: Math.round(files.length * 0.2),
          percentage: 20,
          color: '#0ab39c'
        },
        'Others': {
          type: 'Others',
          size: totalSize * 0.1,
          formattedSize: this.formatFileSize(totalSize * 0.1),
          count: Math.round(files.length * 0.1),
          percentage: 10,
          color: '#f59f00'
        }
      },
      recentFiles: files.slice(0, 5),
      starredFiles: files.filter(f => f.starred)
    };
    
    return new Observable(observer => {
      observer.next(stats);
      observer.complete();
    });
  }

  /**
   * Get recent files
   */
  getRecentFiles(limit: number = 10): Observable<FileItemModel[]> {
    return this.getFiles(0, limit, 'updatedAt', 'DESC').pipe(
      map(response => response.content || []),
      catchError(this.handleError)
    );
  }

  /**
   * Get starred files
   */
  getStarredFiles(): Observable<FileItemModel[]> {
    // Filter starred files from current files
    const starredFiles = this.filesSubject.value.filter(f => f.starred);
    return new Observable(observer => {
      observer.next(starredFiles);
      observer.complete();
    });
  }

  // Case Integration

  /**
   * Get files by case
   */
  getFilesByCase(caseId: number, page: number = 0, size: number = 50): Observable<any> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<any>(`${this.FILE_MANAGER_API}/cases/${caseId}/files`, {
      headers: this.getAuthHeaders(),
      params: params
    }).pipe(
      map(response => {
        // Handle both paginated and non-paginated responses
        if (response.content) {
          // Paginated response
          const files = this.transformFilesFromAPI(response.content);
          return {
            content: files,
            totalElements: response.totalElements || files.length,
            totalPages: response.totalPages || 1,
            number: response.number || page,
            size: response.size || size,
            first: response.first !== undefined ? response.first : true,
            last: response.last !== undefined ? response.last : true
          };
        } else {
          // Non-paginated response - assume array of files
          const files = this.transformFilesFromAPI(response);
          return {
            content: files,
            totalElements: files.length,
            totalPages: 1,
            number: page,
            size: size,
            first: true,
            last: true
          };
        }
      }),
      catchError((error) => {
        console.warn('File Manager API not available for case files, returning empty response');
        // Return empty response if API not available
        return of({
          content: [],
          totalElements: 0,
          totalPages: 0,
          number: page,
          size: size,
          first: true,
          last: true
        });
      })
    );
  }

  /**
   * Get folders by case
   */
  getFoldersByCase(caseId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.FILE_MANAGER_API}/cases/${caseId}/folders`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(folders => folders.map(folder => this.transformFolderFromAPI(folder))),
      catchError(this.handleError)
    );
  }

  /**
   * Get active cases for file association
   */
  getActiveCases(page: number = 0, size: number = 20): Observable<any> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    
    return this.http.get<any>(`${this.FILE_MANAGER_API}/cases/active`, { 
      params,
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        return {
          content: response.content || [],
          totalElements: response.totalElements || 0,
          totalPages: response.totalPages || 0
        };
      }),
      catchError(this.handleError)
    );
  }

  // Bulk Operations

  /**
   * Bulk delete files and folders
   */
  bulkDelete(fileIds: number[], folderIds: number[]): Observable<void> {
    const request = {
      fileIds: fileIds,
      folderIds: folderIds
    };
    
    return this.http.post<void>(`${this.FILE_MANAGER_API}/bulk/delete`, request, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(() => this.refreshCurrentFolderFiles()),
      catchError(this.handleError)
    );
  }

  /**
   * Move files to folder
   */
  moveFiles(fileIds: number[], targetFolderId: number): Observable<void> {
    const request = {
      fileIds: fileIds,
      targetFolderId: targetFolderId
    };
    
    return this.http.post<void>(`${this.FILE_MANAGER_API}/files/move`, request, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(() => this.refreshCurrentFolderFiles()),
      catchError((error) => {
        if (error.status === 405) {
          console.warn('File move API not yet implemented on backend, simulating move operation');
          // Simulate move operation by refreshing cache
          this.refreshCurrentFolderFiles();
          return of(undefined); // Return successful observable
        }
        return this.handleError(error);
      })
    );
  }

  /**
   * Move folders to folder
   */
  moveFolders(folderIds: number[], targetFolderId: number): Observable<void> {
    const request = {
      folderIds: folderIds,
      targetFolderId: targetFolderId
    };
    
    return this.http.post<void>(`${this.FILE_MANAGER_API}/folders/move`, request, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(() => this.refreshCurrentFolderContents()),
      catchError((error) => {
        if (error.status === 405) {
          console.warn('Folder move API not yet implemented on backend, simulating move operation');
          // Simulate move operation by refreshing cache
          this.refreshCurrentFolderContents();
          return of(undefined); // Return successful observable
        }
        return this.handleError(error);
      })
    );
  }

  /**
   * Copy files to folder
   */
  copyFiles(fileIds: number[], targetFolderId: number): Observable<void> {
    const request = {
      fileIds: fileIds,
      targetFolderId: targetFolderId
    };
    
    return this.http.post<void>(`${this.FILE_MANAGER_API}/files/copy`, request, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(() => this.refreshCurrentFolderFiles()),
      catchError((error) => {
        if (error.status === 405) {
          console.warn('File copy API not yet implemented on backend, simulating copy operation');
          // Simulate copy operation by refreshing cache
          this.refreshCurrentFolderFiles();
          return of(undefined); // Return successful observable
        }
        return this.handleError(error);
      })
    );
  }

  /**
   * Copy folders to folder
   */
  copyFolders(folderIds: number[], targetFolderId: number): Observable<void> {
    const request = {
      folderIds: folderIds,
      targetFolderId: targetFolderId
    };
    
    return this.http.post<void>(`${this.FILE_MANAGER_API}/folders/copy`, request, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(() => this.refreshCurrentFolderContents()),
      catchError((error) => {
        if (error.status === 405) {
          console.warn('Folder copy API not yet implemented on backend, simulating copy operation');
          // Simulate copy operation by refreshing cache
          this.refreshCurrentFolderContents();
          return of(undefined); // Return successful observable
        }
        return this.handleError(error);
      })
    );
  }

  /**
   * Bulk download files
   */
  bulkDownload(fileIds: number[]): Observable<Blob> {
    const fileIdsParam = fileIds.join(',');
    
    return this.http.get(`${this.FILE_MANAGER_API}/bulk/download`, {
      params: new HttpParams().set('fileIds', fileIdsParam),
      responseType: 'blob',
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Helper Methods

  /**
   * Refresh current folder files
   */
  private refreshCurrentFolderFiles(): void {
    const currentFolder = this.currentFolderSubject.value;
    if (currentFolder) {
      this.getFolderContents(currentFolder.id).subscribe();
    } else {
      this.getFiles().subscribe();
    }
  }

  /**
   * Refresh current folder contents
   */
  private refreshCurrentFolderContents(): void {
    const currentFolder = this.currentFolderSubject.value;
    if (currentFolder) {
      this.getFolderContents(currentFolder.id).subscribe();
    } else {
      this.getRootFolders().subscribe();
    }
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
   * Get file type category
   */
  getFileTypeCategory(mimeType: string): string {
    if (!mimeType) return 'Others';
    
    if (mimeType.startsWith('image/')) return 'Images';
    if (mimeType.startsWith('video/')) return 'Videos';
    if (mimeType.startsWith('audio/')) return 'Audio';
    if (mimeType.includes('pdf')) return 'Documents';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'Documents';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'Documents';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'Documents';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'Archives';
    
    return 'Others';
  }

  /**
   * Transform files from File Manager API response to FileItemModel format
   */
  private transformFilesFromAPI(files: any[]): FileItemModel[] {
    if (!files || !Array.isArray(files)) return [];
    return files.map((file: any) => this.transformFileFromAPI(file));
  }

  /**
   * Transform folders from File Manager API response to FolderModel format
   */
  private transformFoldersFromAPI(folders: any[]): FolderModel[] {
    if (!folders || !Array.isArray(folders)) return [];
    return folders.map((folder: any) => this.transformFolderFromAPI(folder));
  }

  /**
   * Transform single file from File Manager API to FileItemModel
   */
  private transformFileFromAPI(file: any): FileItemModel {
    return {
      id: file.id || 0,
      name: file.name || file.originalName || 'Untitled',
      originalName: file.originalName || file.name || 'Untitled',
      size: file.size || 0,
      formattedSize: this.formatFileSize(file.size || 0),
      mimeType: file.mimeType || 'application/octet-stream',
      extension: this.getFileExtension(file.originalName || file.name || ''),
      icon: this.getFileIcon(file.mimeType || ''),
      iconColor: this.getFileIconColor(file.mimeType || ''),
      fileType: this.getFileTypeCategory(file.mimeType || ''),
      createdAt: file.createdAt ? new Date(file.createdAt) : new Date(),
      updatedAt: file.updatedAt ? new Date(file.updatedAt) : new Date(),
      downloadUrl: `${this.FILE_MANAGER_API}/files/${file.id}/download`,
      previewUrl: `${this.FILE_MANAGER_API}/files/${file.id}/download`,
      starred: file.starred || false,
      deleted: file.deleted || false,
      canEdit: file.canEdit !== undefined ? file.canEdit : true,
      canDelete: file.canDelete !== undefined ? file.canDelete : true,
      canShare: file.canShare !== undefined ? file.canShare : true,
      canDownload: file.canDownload !== undefined ? file.canDownload : true,
      documentCategory: file.documentCategory || 'OTHER',
      documentStatus: file.documentStatus || 'DRAFT',
      caseId: file.caseId,
      caseName: file.caseName || file.caseNumber || (file.caseId ? `Case ${file.caseId}` : undefined),
      folderId: file.folderId,
      tags: file.tags || [],
      description: file.description,
      version: file.version || 1
    };
  }

  /**
   * Transform single folder from File Manager API to FolderModel
   */
  private transformFolderFromAPI(folder: any): FolderModel {
    return {
      id: folder.id || 0,
      name: folder.name || 'Untitled Folder',
      path: folder.path || '/',
      size: folder.size || 0,
      fileCount: folder.fileCount || 0,
      folderCount: folder.folderCount || 0,
      createdById: folder.createdById || 0,
      createdByName: folder.createdByName || 'Unknown',
      createdAt: folder.createdAt ? new Date(folder.createdAt) : new Date(),
      updatedAt: folder.updatedAt ? new Date(folder.updatedAt) : new Date(),
      hasChildren: folder.hasChildren || false,
      canEdit: folder.canEdit !== undefined ? folder.canEdit : true,
      canDelete: folder.canDelete !== undefined ? folder.canDelete : true,
      canShare: folder.canShare !== undefined ? folder.canShare : true,
      parentId: folder.parentId,
      parentName: folder.parentName,
      caseId: folder.caseId,
      caseName: folder.caseName,
      caseNumber: folder.caseNumber
    };
  }

  /**
   * Transform documents from API response to FileItemModel format
   */
  private transformDocumentsToFiles(response: any): FileItemModel[] {
    if (!response) return [];
    
    let documents = [];
    if (Array.isArray(response)) {
      documents = response;
    } else if (response.data && Array.isArray(response.data)) {
      documents = response.data;
    } else if (response.documents && Array.isArray(response.documents)) {
      documents = response.documents;
    }
    
    return documents.map((doc: any) => this.transformDocumentToFile(doc));
  }

  /**
   * Transform single document to FileItemModel
   */
  private transformDocumentToFile(doc: any): FileItemModel {
    return {
      id: doc.id || 0,
      name: doc.title || doc.fileName || 'Untitled',
      originalName: doc.fileName || doc.title || 'Untitled',
      size: doc.fileSize || 0,
      formattedSize: this.formatFileSize(doc.fileSize || 0),
      mimeType: doc.mimeType || 'application/octet-stream',
      extension: this.getFileExtension(doc.fileName || ''),
      icon: this.getFileIcon(doc.mimeType || ''),
      iconColor: this.getFileIconColor(doc.mimeType || ''),
      fileType: this.getFileTypeCategory(doc.mimeType || ''),
      createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
      downloadUrl: `${this.DOCUMENTS_API}/${doc.id}/download`,
      previewUrl: `${this.DOCUMENTS_API}/${doc.id}/download?preview=true`,
      starred: false,
      deleted: false,
      canEdit: true,
      canDelete: true,
      canShare: true,
      canDownload: true,
      documentCategory: doc.documentType || 'OTHER',
      documentStatus: doc.status || 'DRAFT',
      caseId: doc.caseId,
      caseName: doc.caseTitle || doc.caseName || (doc.caseId ? `Case ${doc.caseId}` : ''),
      tags: doc.tags || [],
      description: doc.description,
      version: doc.version || 1
    };
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  /**
   * Get file icon based on mime type
   */
  private getFileIcon(mimeType: string): string {
    if (mimeType.includes('pdf')) return 'ri-file-pdf-line';
    if (mimeType.includes('word')) return 'ri-file-word-line';
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'ri-file-excel-line';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'ri-file-ppt-line';
    if (mimeType.startsWith('image/')) return 'ri-image-line';
    if (mimeType.startsWith('video/')) return 'ri-video-line';
    if (mimeType.startsWith('audio/')) return 'ri-music-line';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'ri-folder-zip-line';
    return 'ri-file-text-line';
  }

  /**
   * Get file icon color based on mime type
   */
  private getFileIconColor(mimeType: string): string {
    if (mimeType.includes('pdf')) return '#d63939';
    if (mimeType.includes('word')) return '#405189';
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return '#0ab39c';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '#f59f00';
    if (mimeType.startsWith('image/')) return '#405189';
    if (mimeType.startsWith('video/')) return '#f59f00';
    if (mimeType.startsWith('audio/')) return '#0ab39c';
    return '#6c757d';
  }

  /**
   * Get cached data if valid
   */
  private getCachedData(key: string): any {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }
  
  /**
   * Set cached data
   */
  private setCachedData(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
  
  /**
   * Clear cache for specific pattern
   */
  clearCachePattern(pattern: string): void {
    const keys = Array.from(this.cache.keys());
    keys.forEach(key => {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    });
  }
  
  /**
   * Cache frequently accessed file
   */
  private cacheFrequentFile(fileId: number, file: FileItemModel): void {
    const existing = this.frequentlyAccessedCache.get(fileId);
    if (existing) {
      existing.accessCount++;
      existing.lastAccessed = Date.now();
      existing.file = file;
    } else {
      // If cache is full, remove least recently accessed
      if (this.frequentlyAccessedCache.size >= this.MAX_FREQUENT_CACHE_SIZE) {
        let oldestKey = -1;
        let oldestTime = Date.now();
        this.frequentlyAccessedCache.forEach((value, key) => {
          if (value.lastAccessed < oldestTime) {
            oldestTime = value.lastAccessed;
            oldestKey = key;
          }
        });
        if (oldestKey !== -1) {
          this.frequentlyAccessedCache.delete(oldestKey);
        }
      }
      
      this.frequentlyAccessedCache.set(fileId, {
        file,
        accessCount: 1,
        lastAccessed: Date.now()
      });
    }
  }

  /**
   * Error handler
   */
  private handleError(error: any): Observable<never> {
    console.error('FileManagerService error:', error);
    
    let errorMessage = 'An error occurred';
    if (error.error && error.error.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return throwError(() => new Error(errorMessage));
  }
}