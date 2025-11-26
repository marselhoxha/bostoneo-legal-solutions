import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface DocumentCollection {
  id: number;
  name: string;
  description?: string;
  userId: number;
  caseId?: number;
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
  documentCount: number;
}

export interface CollectionDocument {
  id: number;
  analysisId: number;
  addedAt: string;
  notes?: string;
  fileName?: string;
  fileType?: string;
  detectedType?: string;
  status?: string;
  createdAt?: string;
}

export interface CollectionWithDocuments extends DocumentCollection {
  documents: CollectionDocument[];
}

@Injectable({
  providedIn: 'root'
})
export class DocumentCollectionService {
  private apiUrl = `${environment.apiUrl}/api/ai/collections`;

  // Observable for collections list
  private collectionsSubject = new BehaviorSubject<DocumentCollection[]>([]);
  public collections$ = this.collectionsSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Get all collections for the current user
   */
  getCollections(userId?: number): Observable<DocumentCollection[]> {
    const params = userId ? `?userId=${userId}` : '';
    return this.http.get<{ collections: DocumentCollection[], count: number }>(
      `${this.apiUrl}${params}`,
      { withCredentials: true }
    ).pipe(
      map(response => response.collections || []),
      tap(collections => this.collectionsSubject.next(collections)),
      catchError(error => {
        console.error('Failed to fetch collections:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Create a new collection
   */
  createCollection(
    name: string,
    description?: string,
    caseId?: number,
    color?: string,
    icon?: string
  ): Observable<DocumentCollection> {
    return this.http.post<DocumentCollection>(
      this.apiUrl,
      { name, description, caseId, color, icon },
      { withCredentials: true }
    ).pipe(
      tap(collection => {
        // Add to local state
        const current = this.collectionsSubject.value;
        this.collectionsSubject.next([collection, ...current]);
      }),
      catchError(error => {
        console.error('Failed to create collection:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get a specific collection with its documents
   */
  getCollection(collectionId: number): Observable<CollectionWithDocuments> {
    return this.http.get<CollectionWithDocuments>(
      `${this.apiUrl}/${collectionId}`,
      { withCredentials: true }
    ).pipe(
      catchError(error => {
        console.error('Failed to fetch collection:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update a collection
   */
  updateCollection(
    collectionId: number,
    updates: Partial<{ name: string; description: string; caseId: number; color: string; icon: string }>
  ): Observable<DocumentCollection> {
    return this.http.put<DocumentCollection>(
      `${this.apiUrl}/${collectionId}`,
      updates,
      { withCredentials: true }
    ).pipe(
      tap(updated => {
        // Update local state
        const current = this.collectionsSubject.value;
        const index = current.findIndex(c => c.id === collectionId);
        if (index >= 0) {
          current[index] = updated;
          this.collectionsSubject.next([...current]);
        }
      }),
      catchError(error => {
        console.error('Failed to update collection:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Delete (archive) a collection
   */
  deleteCollection(collectionId: number): Observable<void> {
    return this.http.delete<{ success: boolean }>(
      `${this.apiUrl}/${collectionId}`,
      { withCredentials: true }
    ).pipe(
      map(() => undefined),
      tap(() => {
        // Remove from local state
        const current = this.collectionsSubject.value;
        this.collectionsSubject.next(current.filter(c => c.id !== collectionId));
      }),
      catchError(error => {
        console.error('Failed to delete collection:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Add a document to a collection
   */
  addDocumentToCollection(
    collectionId: number,
    analysisId: number,
    notes?: string
  ): Observable<{ success: boolean; id: number }> {
    return this.http.post<{ success: boolean; id: number }>(
      `${this.apiUrl}/${collectionId}/documents`,
      { analysisId, notes },
      { withCredentials: true }
    ).pipe(
      tap(() => {
        // Update document count in local state
        const current = this.collectionsSubject.value;
        const index = current.findIndex(c => c.id === collectionId);
        if (index >= 0) {
          current[index].documentCount++;
          this.collectionsSubject.next([...current]);
        }
      }),
      catchError(error => {
        console.error('Failed to add document to collection:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Remove a document from a collection
   */
  removeDocumentFromCollection(collectionId: number, analysisId: number): Observable<void> {
    return this.http.delete<{ success: boolean }>(
      `${this.apiUrl}/${collectionId}/documents/${analysisId}`,
      { withCredentials: true }
    ).pipe(
      map(() => undefined),
      tap(() => {
        // Update document count in local state
        const current = this.collectionsSubject.value;
        const index = current.findIndex(c => c.id === collectionId);
        if (index >= 0 && current[index].documentCount > 0) {
          current[index].documentCount--;
          this.collectionsSubject.next([...current]);
        }
      }),
      catchError(error => {
        console.error('Failed to remove document from collection:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get all collections containing a specific document
   */
  getCollectionsForDocument(analysisId: number): Observable<DocumentCollection[]> {
    return this.http.get<{ collections: DocumentCollection[] }>(
      `${this.apiUrl}/by-document/${analysisId}`,
      { withCredentials: true }
    ).pipe(
      map(response => response.collections || []),
      catchError(error => {
        console.error('Failed to fetch collections for document:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get current collections from local state
   */
  getCurrentCollections(): DocumentCollection[] {
    return this.collectionsSubject.value;
  }

  /**
   * Refresh collections from server
   */
  refreshCollections(): void {
    this.getCollections().subscribe();
  }
}
