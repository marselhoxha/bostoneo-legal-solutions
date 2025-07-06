import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders, HttpEventType } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
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
    
    return this.http.get<any>(this.DOCUMENTS_API, { 
      params,
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        // Transform response to match file manager format
        const files = this.transformDocumentsToFiles(response);
        const transformedResponse = {
          content: files,
          totalElements: files.length,
          totalPages: 1,
          number: page,
          size: size,
          first: true,
          last: true
        };
        
        // Cache the result
        this.setCachedData(cacheKey, transformedResponse);
        this.filesSubject.next(files);
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
    return this.http.get<any>(`${this.DOCUMENTS_API}/${fileId}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => this.transformDocumentToFile(response)),
      catchError(this.handleError)
    );
  }

  /**
   * Upload single file
   */
  uploadFile(file: File, folderId?: number, caseId?: number, documentCategory?: string, documentStatus?: string): Observable<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    // Create document metadata
    const documentData = {
      caseId: caseId,
      documentCategory: documentCategory || 'OTHER',
      documentStatus: documentStatus || 'DRAFT'
    };
    formData.append('data', JSON.stringify(documentData));

    return this.http.post<any>(`${this.DOCUMENTS_API}/upload`, formData, {
      headers: this.getAuthHeadersForUpload()
    }).pipe(
      map(response => ({
        success: true,
        file: this.transformDocumentToFile(response),
        message: 'File uploaded successfully'
      })),
      tap(() => this.refreshCurrentFolderFiles()),
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
    return this.http.get(`${this.DOCUMENTS_API}/${fileId}/download`, { 
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
    return this.http.delete<void>(`${this.DOCUMENTS_API}/${fileId}`, {
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
    const updateData = { title: name };
    return this.http.put<any>(`${this.DOCUMENTS_API}/${fileId}`, updateData, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => this.transformDocumentToFile(response)),
      tap(() => this.refreshCurrentFolderFiles()),
      catchError(this.handleError)
    );
  }

  /**
   * Toggle file star status
   */
  toggleFileStar(fileId: number): Observable<FileItemModel> {
    // Since backend might not have star functionality, simulate it locally
    return new Observable(observer => {
      const file = this.filesSubject.value.find(f => f.id === fileId);
      if (file) {
        file.starred = !file.starred;
        observer.next(file);
        observer.complete();
      } else {
        observer.error(new Error('File not found'));
      }
    });
  }

  /**
   * Search files
   */
  searchFiles(query: string, page: number = 0, size: number = 50): Observable<any> {
    // Use regular documents endpoint and filter locally for now
    return this.http.get<any>(this.DOCUMENTS_API, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        const allFiles = this.transformDocumentsToFiles(response);
        const filteredFiles = allFiles.filter(file => 
          file.name.toLowerCase().includes(query.toLowerCase()) ||
          file.originalName.toLowerCase().includes(query.toLowerCase())
        );
        
        return {
          content: filteredFiles,
          totalElements: filteredFiles.length,
          totalPages: Math.ceil(filteredFiles.length / size),
          number: page,
          size: size
        };
      }),
      catchError(this.handleError)
    );
  }

  // Folder Operations
  
  /**
   * Get root folders (categorized by document types)
   */
  getRootFolders(): Observable<FolderModel[]> {
    // Create virtual folders based on document categories
    const virtualFolders: FolderModel[] = [
      {
        id: 1,
        name: 'Contracts',
        path: '/contracts',
        size: 0,
        fileCount: 0,
        folderCount: 0,
        createdById: 1,
        createdByName: 'System',
        createdAt: new Date(),
        updatedAt: new Date(),
        hasChildren: false,
        canEdit: true,
        canDelete: false,
        canShare: true
      },
      {
        id: 2,
        name: 'Evidence',
        path: '/evidence',
        size: 0,
        fileCount: 0,
        folderCount: 0,
        createdById: 1,
        createdByName: 'System',
        createdAt: new Date(),
        updatedAt: new Date(),
        hasChildren: false,
        canEdit: true,
        canDelete: false,
        canShare: true
      },
      {
        id: 3,
        name: 'Correspondence',
        path: '/correspondence',
        size: 0,
        fileCount: 0,
        folderCount: 0,
        createdById: 1,
        createdByName: 'System',
        createdAt: new Date(),
        updatedAt: new Date(),
        hasChildren: false,
        canEdit: true,
        canDelete: false,
        canShare: true
      }
    ];
    
    this.foldersSubject.next(virtualFolders);
    return new Observable(observer => {
      observer.next(virtualFolders);
      observer.complete();
    });
  }

  /**
   * Get folder contents (subfolders and files)
   */
  getFolderContents(folderId: number): Observable<any> {
    // Since we're using virtual folders, return files filtered by category
    return this.getFilesByFolder(folderId).pipe(
      map(files => ({
        files: files,
        folders: []
      }))
    );
  }

  /**
   * Get folder by ID
   */
  getFolderById(folderId: number): Observable<FolderModel> {
    // Return virtual folder from our predefined list
    const virtualFolders = [
      {
        id: 1,
        name: 'Contracts',
        path: '/contracts',
        size: 0,
        fileCount: 0,
        folderCount: 0,
        createdById: 1,
        createdByName: 'System',
        createdAt: new Date(),
        updatedAt: new Date(),
        hasChildren: false,
        canEdit: true,
        canDelete: false,
        canShare: true
      },
      {
        id: 2,
        name: 'Evidence',
        path: '/evidence',
        size: 0,
        fileCount: 0,
        folderCount: 0,
        createdById: 1,
        createdByName: 'System',
        createdAt: new Date(),
        updatedAt: new Date(),
        hasChildren: false,
        canEdit: true,
        canDelete: false,
        canShare: true
      },
      {
        id: 3,
        name: 'Correspondence',
        path: '/correspondence',
        size: 0,
        fileCount: 0,
        folderCount: 0,
        createdById: 1,
        createdByName: 'System',
        createdAt: new Date(),
        updatedAt: new Date(),
        hasChildren: false,
        canEdit: true,
        canDelete: false,
        canShare: true
      }
    ];
    
    const folder = virtualFolders.find(f => f.id === folderId);
    if (folder) {
      this.currentFolderSubject.next(folder);
      return new Observable(observer => {
        observer.next(folder);
        observer.complete();
      });
    } else {
      return throwError(() => new Error('Folder not found'));
    }
  }

  /**
   * Create new folder
   */
  createFolder(request: CreateFolderRequest): Observable<FolderModel> {
    // Virtual folders cannot be created for now
    return throwError(() => new Error('Virtual folders cannot be created'));
  }

  /**
   * Update folder name
   */
  updateFolder(folderId: number, name: string): Observable<FolderModel> {
    // Virtual folders cannot be renamed for now
    return throwError(() => new Error('Virtual folders cannot be renamed'));
  }

  /**
   * Delete folder
   */
  deleteFolder(folderId: number): Observable<void> {
    // Virtual folders cannot be deleted for now
    return throwError(() => new Error('Virtual folders cannot be deleted'));
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
    return this.http.get<any>(`${this.DOCUMENTS_API}/case/${caseId}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        const files = this.transformDocumentsToFiles(response);
        return {
          content: files,
          totalElements: files.length,
          totalPages: 1,
          number: page,
          size: size,
          first: true,
          last: true
        };
      }),
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
    
    return this.http.get<any>(`${this.CASES_API}/list`, { 
      params,
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        // Transform the legal case response to match the expected format
        if (response && response.data && response.data.cases) {
          return {
            content: response.data.cases.map((legalCase: any) => ({
              id: legalCase.id,
              title: legalCase.title,
              caseNumber: legalCase.caseNumber,
              status: legalCase.status,
              fileCount: 0 // This would need to be calculated separately
            })),
            totalElements: response.data.cases.length,
            totalPages: 1
          };
        }
        return { content: [], totalElements: 0, totalPages: 0 };
      }),
      catchError(this.handleError)
    );
  }

  // Bulk Operations

  /**
   * Bulk delete files and folders
   */
  bulkDelete(fileIds: number[], folderIds: number[]): Observable<void> {
    // Delete files one by one since bulk delete might not be supported
    const deletePromises = fileIds.map(id => 
      this.deleteFile(id).toPromise()
    );
    
    return new Observable(observer => {
      Promise.all(deletePromises).then(() => {
        this.refreshCurrentFolderFiles();
        observer.next();
        observer.complete();
      }).catch(error => {
        observer.error(error);
      });
    });
  }

  /**
   * Bulk download files
   */
  bulkDownload(fileIds: number[]): Observable<Blob> {
    // For now, just download the first file
    // TODO: Implement proper bulk download or zip creation
    if (fileIds.length > 0) {
      return this.downloadFile(fileIds[0]);
    }
    
    return throwError(() => new Error('No files to download'));
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