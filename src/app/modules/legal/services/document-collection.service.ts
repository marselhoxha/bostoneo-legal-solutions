import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { UserService } from '../../../service/user.service';

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

export interface AggregatedTimelineEvent {
  id: number;
  analysisId: number;
  eventDate: string;
  eventType: string;
  title: string;
  description: string;
  priority: string;
  relatedSection?: string;
  sourceDocument: string;
  sourceDocumentType: string;
}

export interface AggregatedActionItem {
  id: number;
  analysisId: number;
  description: string;
  priority: string;
  status: string;
  deadline?: string;
  relatedSection?: string;
  sourceDocument: string;
  sourceDocumentType: string;
}

export interface SearchResult {
  chunkId: number;
  analysisId: number;
  content: string;
  sectionTitle?: string;
  chunkIndex: number;
  score: number;
  highlightedContent: string;
  sourceDocument: string;
  sourceDocumentType: string;
}

export interface QASource {
  documentId: number;
  documentName: string;
  documentType?: string;
  sectionTitle?: string;
  excerpt: string;
  chunkId: number;
  relevanceScore: number;
}

export interface QAResponse {
  answer: string;
  sources: QASource[];
  processingTimeMs: number;
  query: string;
  collectionId: number;
}

export interface CompareResponse {
  comparison: string;
  sources: QASource[];
  processingTimeMs: number;
}

export interface SearchResponse {
  results: SearchResult[];
  count: number;
  query: string;
  expandedQuery: string;
  fromCache: boolean;
  processingTimeMs: number;
  collectionId: number;
}

export interface SearchSuggestion {
  text: string;
  fromHistory: boolean;
  type: string;
}

export interface DocumentContent {
  analysisId: number;
  fileName: string;
  fileType: string;
  detectedType: string;
  content: string;
  fileUrl?: string;
  chunks: DocumentChunk[];
  totalChunks: number;
}

export interface DocumentChunk {
  id: number;
  chunkIndex: number;
  content: string;
  sectionTitle?: string;
}

// Document Relationship interfaces
export interface DocumentRelationship {
  id: number;
  relationshipType: string;
  description?: string;
  direction: 'incoming' | 'outgoing';
  createdAt: string;
  relatedDocument: {
    id: number;
    analysisId: string;
    fileName: string;
    detectedType: string;
    createdAt: string;
  };
}

export interface RelationshipType {
  id: string;
  label: string;
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export class DocumentCollectionService {
  private apiUrl = `${environment.apiUrl}/api/ai/collections`;

  // Observable for collections list
  private collectionsSubject = new BehaviorSubject<DocumentCollection[]>([]);
  public collections$ = this.collectionsSubject.asObservable();

  constructor(
    private http: HttpClient,
    private userService: UserService
  ) {}

  private getUserId(): number | null {
    return this.userService.getCurrentUserId();
  }

  /**
   * Get all collections for the current user
   */
  getCollections(userId?: number): Observable<DocumentCollection[]> {
    const effectiveUserId = userId || this.getUserId();
    const params = effectiveUserId ? `?userId=${effectiveUserId}` : '';
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
    const userId = this.getUserId();
    return this.http.post<DocumentCollection>(
      this.apiUrl,
      { name, description, caseId, color, icon, userId },
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

  /**
   * Get aggregated timeline events for all documents in a collection
   */
  getAggregatedTimeline(collectionId: number): Observable<AggregatedTimelineEvent[]> {
    return this.http.get<{ events: AggregatedTimelineEvent[], count: number }>(
      `${this.apiUrl}/${collectionId}/timeline`,
      { withCredentials: true }
    ).pipe(
      map(response => response.events || []),
      catchError(error => {
        console.error('Failed to fetch aggregated timeline:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get aggregated action items for all documents in a collection
   */
  getAggregatedActionItems(collectionId: number): Observable<AggregatedActionItem[]> {
    return this.http.get<{ actionItems: AggregatedActionItem[], count: number }>(
      `${this.apiUrl}/${collectionId}/action-items`,
      { withCredentials: true }
    ).pipe(
      map(response => response.actionItems || []),
      catchError(error => {
        console.error('Failed to fetch aggregated action items:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Search across all documents in a collection (semantic search)
   */
  searchCollection(collectionId: number, query: string, maxResults: number = 10): Observable<SearchResult[]> {
    return this.http.get<{ results: SearchResult[], count: number }>(
      `${this.apiUrl}/${collectionId}/search`,
      {
        params: { query, maxResults: maxResults.toString() },
        withCredentials: true
      }
    ).pipe(
      map(response => response.results || []),
      catchError(error => {
        console.error('Failed to search collection:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Index a collection for search (chunk and generate embeddings)
   */
  indexCollection(collectionId: number): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/${collectionId}/index`,
      {},
      { withCredentials: true }
    ).pipe(
      catchError(error => {
        console.error('Failed to index collection:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Ask a question about all documents in a collection (Collection Q&A)
   */
  askCollection(collectionId: number, query: string, maxSources: number = 10): Observable<QAResponse> {
    return this.http.post<QAResponse>(
      `${this.apiUrl}/${collectionId}/ask`,
      { query, maxSources },
      { withCredentials: true }
    ).pipe(
      catchError(error => {
        console.error('Failed to ask collection:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Compare two documents in a collection
   */
  compareDocuments(
    collectionId: number,
    document1Id: number,
    document2Id: number,
    aspect?: string
  ): Observable<CompareResponse> {
    return this.http.post<CompareResponse>(
      `${this.apiUrl}/${collectionId}/compare`,
      { document1Id, document2Id, aspect },
      { withCredentials: true }
    ).pipe(
      catchError(error => {
        console.error('Failed to compare documents:', error);
        return throwError(() => error);
      })
    );
  }

  // ============ ENHANCED SEARCH FEATURES ============

  /**
   * Enhanced search with caching and synonym expansion
   */
  searchCollectionEnhanced(collectionId: number, query: string, maxResults: number = 10): Observable<SearchResponse> {
    return this.http.get<SearchResponse>(
      `${this.apiUrl}/${collectionId}/search`,
      {
        params: { query, maxResults: maxResults.toString() },
        withCredentials: true
      }
    ).pipe(
      catchError(error => {
        console.error('Failed to search collection:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get search suggestions for autocomplete
   */
  getSearchSuggestions(collectionId: number, query: string): Observable<SearchSuggestion[]> {
    return this.http.get<SearchSuggestion[]>(
      `${this.apiUrl}/${collectionId}/search/suggestions`,
      {
        params: { query },
        withCredentials: true
      }
    ).pipe(
      catchError(error => {
        console.error('Failed to get search suggestions:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get document content for preview modal
   */
  getDocumentContent(analysisId: number): Observable<DocumentContent> {
    return this.http.get<DocumentContent>(
      `${this.apiUrl}/documents/${analysisId}/content`,
      { withCredentials: true }
    ).pipe(
      catchError(error => {
        console.error('Failed to get document content:', error);
        return throwError(() => error);
      })
    );
  }

  // ==========================================
  // Document Relationship Methods
  // ==========================================

  /**
   * Get all relationships for a document
   */
  getDocumentRelationships(analysisId: number): Observable<{ relationships: DocumentRelationship[], count: number }> {
    return this.http.get<{ analysisId: number, relationships: DocumentRelationship[], count: number }>(
      `${this.apiUrl}/documents/${analysisId}/relationships`,
      { withCredentials: true }
    ).pipe(
      catchError(error => {
        console.error('Failed to get document relationships:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Create a relationship between two documents
   */
  createRelationship(
    sourceAnalysisId: number,
    targetAnalysisId: number,
    relationshipType: string,
    description?: string
  ): Observable<DocumentRelationship> {
    return this.http.post<DocumentRelationship>(
      `${this.apiUrl}/documents/${sourceAnalysisId}/relationships`,
      { targetAnalysisId, relationshipType, description },
      { withCredentials: true }
    ).pipe(
      catchError(error => {
        console.error('Failed to create relationship:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Delete a relationship
   */
  deleteRelationship(analysisId: number, relationshipId: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.apiUrl}/documents/${analysisId}/relationships/${relationshipId}`,
      { withCredentials: true }
    ).pipe(
      catchError(error => {
        console.error('Failed to delete relationship:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get available relationship types
   */
  getRelationshipTypes(): Observable<RelationshipType[]> {
    return this.http.get<RelationshipType[]>(
      `${this.apiUrl}/relationship-types`,
      { withCredentials: true }
    ).pipe(
      catchError(error => {
        console.error('Failed to get relationship types:', error);
        return throwError(() => error);
      })
    );
  }
}
