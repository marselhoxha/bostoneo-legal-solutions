import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { UserService } from '../../../service/user.service';
import { JwtHelperService } from '@auth0/angular-jwt';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Backend conversation interfaces
export interface AiConversationSession {
  id?: number;
  userId: number;
  sessionName?: string;
  sessionType?: string;
  caseId?: number;
  practiceArea?: string;
  taskType?: string; // LEGAL_QUESTION, GENERATE_DRAFT, SUMMARIZE_CASE, ANALYZE_DOCUMENT
  researchMode?: string; // FAST, THOROUGH
  documentId?: number;
  relatedDraftId?: string;
  jurisdiction?: string;
  documentType?: string; // Document type for drafts (e.g., demand_letter, motion_to_compel)
  contextSummary?: string;
  primaryTopic?: string;
  keyEntities?: any;
  isActive?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  messageCount?: number;
  totalTokensUsed?: number;
  totalCostUsd?: number;
  workflowExecutionId?: number; // Linked workflow execution (for workflow-created drafts)
  createdAt?: Date;
  lastInteractionAt?: Date;
  archivedAt?: Date;
  messages?: AiConversationMessage[];
}

export interface AiConversationMessage {
  id?: number;
  role: string;
  content: string;
  modelUsed?: string;
  tokensUsed?: number;
  costUsd?: number;
  metadata?: any;
  ragContextUsed?: boolean;
  temperature?: number;
  userRating?: number;
  userFeedback?: string;
  wasHelpful?: boolean;
  createdAt?: Date;
  isTyping?: boolean;
  collapsed?: boolean;
}

export interface LegalSearchRequest {
  query: string;
  searchType: 'all' | 'statutes' | 'rules' | 'regulations' | 'guidelines';
  jurisdiction?: string;
  userId?: number;
  sessionId?: string;
  caseId?: string;
  researchMode?: 'FAST' | 'THOROUGH';  // FAST = 15s quick answers, THOROUGH = 60-180s verified citations
  conversationHistory?: ConversationMessage[];  // NEW: For context-aware follow-up responses
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    practiceArea?: string;
    courtLevel?: string;
  };
  enableLawyerGradePrecision?: boolean;
  effectiveDate?: string;
  validateCitations?: boolean;
  requirePrimarySources?: boolean;
}

export interface SearchResult {
  id: number;
  type: 'statute' | 'court_rule' | 'guideline' | 'federal_register_rule' | 'federal_register_prorule' | 'federal_register_notice' | 'federal_register_presdocu';
  title: string;
  citation: string;
  summary: string;
  fullText: string;
  effectiveDate?: string;
  practiceArea?: string;
  courtLevel?: string;
  category?: string;
  relevanceScore?: number;
  // Federal Register specific properties
  source?: string;
  documentNumber?: string;
  publicationDate?: string;
  documentType?: string;
  htmlUrl?: string;
  pdfUrl?: string;
  federalRegisterUrl?: string;
  agencies?: string[];
}

export interface CitationValidation {
  originalCitation: string;
  isValid: boolean;
  citationType: string;
  correctedCitation?: string;
  errors?: string[];
  warnings?: string[];
}

export interface LegalQualityMetrics {
  citationAccuracy: number;
  primarySourceRatio: number;
  confidenceLevel: 'High' | 'Medium' | 'Low';
  verificationRequired: string[];
}

export interface LegalSearchResponse {
  success: boolean;
  results: SearchResult[];
  totalResults: number;
  searchQuery: string;
  searchType: string;
  jurisdiction: string;
  aiAnalysis?: string;
  hasAIAnalysis: boolean;
  executionTimeMs?: number;
  error?: string;
  // Enhanced lawyer-grade fields
  lawyerGradeAnalysis?: {
    executiveSummary?: any;
    primaryAuthorities?: any;
    proceduralRequirements?: any;
    legalAnalysis?: any;
    practiceNotes?: any;
    temporalWarnings?: any;
    jurisdictionalNotes?: any;
    qualityMetrics?: LegalQualityMetrics;
  };
  citationValidations?: CitationValidation[];
  structuredData?: any;
}

export interface SearchHistory {
  id: number;
  searchQuery: string;
  queryType: string;
  searchFilters?: string;
  resultsCount: number;
  executionTimeMs: number;
  searchedAt: string;
  isSaved: boolean;
}

export interface SearchSuggestion {
  query: string;
  type: string;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LegalResearchService {
  private apiUrl = `${environment.apiUrl}/api/ai/legal-research`;
  private conversationApiUrl = `${environment.apiUrl}/api/legal/research/conversations`;

  private searchStatusSubject = new BehaviorSubject<string>('idle');
  public searchStatus$ = this.searchStatusSubject.asObservable();

  private currentSessionId = this.generateSessionId();
  private jwtHelper = new JwtHelperService();

  constructor(private http: HttpClient, private userService: UserService) {}

  performSearch(searchRequest: LegalSearchRequest): Observable<LegalSearchResponse> {
    this.searchStatusSubject.next('searching');

    // Add session ID and enable lawyer-grade precision by default
    const requestWithEnhancements = {
      ...searchRequest,
      sessionId: searchRequest.sessionId || this.currentSessionId,
      enableLawyerGradePrecision: searchRequest.enableLawyerGradePrecision !== false, // Default to true
      effectiveDate: searchRequest.effectiveDate || new Date().toISOString().split('T')[0],
      validateCitations: searchRequest.validateCitations !== false, // Default to true
      requirePrimarySources: searchRequest.requirePrimarySources !== false // Default to true
    };

    return this.http.post<LegalSearchResponse>(
      `${this.apiUrl}/search`,
      requestWithEnhancements,
      { withCredentials: true }
    ).pipe(
      tap(response => {
        this.searchStatusSubject.next(response.success ? 'completed' : 'failed');
      }),
      catchError(error => {
        this.searchStatusSubject.next('failed');
        console.error('Legal search error:', error);
        return throwError(() => error);
      })
    );
  }

  getSearchHistory(userId?: number, limit: number = 50): Observable<SearchHistory[]> {
    const params: any = { limit };
    if (userId) {
      params.userId = userId;
    }

    return this.http.get<{ success: boolean; history: SearchHistory[] }>(
      `${this.apiUrl}/search-history`,
      {
        params,
        withCredentials: true
      }
    ).pipe(
      map(response => response.history || []),
      catchError(error => {
        console.error('Failed to fetch search history:', error);
        return throwError(() => error);
      })
    );
  }

  getSavedSearches(userId?: number): Observable<SearchHistory[]> {
    const params: any = {};
    if (userId) {
      params.userId = userId;
    }

    return this.http.get<{ success: boolean; savedSearches: SearchHistory[] }>(
      `${this.apiUrl}/saved-searches`,
      {
        params,
        withCredentials: true
      }
    ).pipe(
      map(response => response.savedSearches || []),
      catchError(error => {
        console.error('Failed to fetch saved searches:', error);
        return throwError(() => error);
      })
    );
  }

  saveSearch(searchId: number): Observable<any> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/save-search/${searchId}`,
      {},
      { withCredentials: true }
    ).pipe(
      catchError(error => {
        console.error('Failed to save search:', error);
        return throwError(() => error);
      })
    );
  }

  deleteSearchHistory(searchId: number, userId?: number): Observable<any> {
    const params: any = {};
    if (userId) {
      params.userId = userId;
    }

    return this.http.delete<{ success: boolean; message: string }>(
      `${this.apiUrl}/search-history/${searchId}`,
      {
        params,
        withCredentials: true
      }
    ).pipe(
      catchError(error => {
        console.error('Failed to delete search history:', error);
        return throwError(() => error);
      })
    );
  }

  getSearchSuggestions(query: string, userId?: number): Observable<string[]> {
    const params: any = { query };
    if (userId) {
      params.userId = userId;
    }

    return this.http.get<{ success: boolean; suggestions: string[] }>(
      `${this.apiUrl}/search-suggestions`,
      {
        params,
        withCredentials: true
      }
    ).pipe(
      map(response => response.suggestions || []),
      catchError(error => {
        console.error('Failed to get search suggestions:', error);
        return [];
      })
    );
  }

  getSearchTypes(): Observable<{ [key: string]: string }> {
    return this.http.get<{ success: boolean; searchTypes: { [key: string]: string } }>(
      `${this.apiUrl}/search-types`,
      { withCredentials: true }
    ).pipe(
      map(response => response.searchTypes || {}),
      catchError(error => {
        console.error('Failed to fetch search types:', error);
        // Return default search types as fallback
        return [
          {
            'all': 'All Legal Sources',
            'statutes': 'Massachusetts Statutes',
            'rules': 'Court Rules',
            'regulations': 'Regulations',
            'guidelines': 'Sentencing Guidelines'
          }
        ];
      })
    );
  }

  // Helper methods
  getSearchTypeOptions(): { value: string; label: string; description: string }[] {
    return [
      {
        value: 'all',
        label: 'All Sources',
        description: 'Search across all available legal sources'
      },
      {
        value: 'statutes',
        label: 'Massachusetts Statutes',
        description: 'Massachusetts General Laws and statutes'
      },
      {
        value: 'rules',
        label: 'Court Rules',
        description: 'Massachusetts court rules and procedures'
      },
      {
        value: 'regulations',
        label: 'Regulations',
        description: 'State and federal regulations'
      },
      {
        value: 'guidelines',
        label: 'Sentencing Guidelines',
        description: 'Massachusetts sentencing guidelines'
      }
    ];
  }

  getResultTypeIcon(type: string): string {
    switch (type) {
      case 'statute':
        return 'fas fa-gavel';
      case 'court_rule':
        return 'fas fa-balance-scale';
      case 'guideline':
        return 'fas fa-list-alt';
      // Federal Register document types
      case 'federal_register_rule':
        return 'ri-government-line';
      case 'federal_register_prorule':
        return 'ri-draft-line';
      case 'federal_register_notice':
        return 'ri-notification-3-line';
      case 'federal_register_presdocu':
        return 'ri-medal-line';
      default:
        return 'fas fa-file-alt';
    }
  }

  getResultTypeBadgeClass(type: string): string {
    switch (type) {
      case 'statute':
        return 'badge-primary';
      case 'court_rule':
        return 'badge-info';
      case 'guideline':
        return 'badge-warning';
      // Federal Register document types with distinct colors
      case 'federal_register_rule':
        return 'badge-statute'; // Primary blue
      case 'federal_register_prorule':
        return 'badge-rule'; // Info blue
      case 'federal_register_notice':
        return 'badge-regulation'; // Warning orange
      case 'federal_register_presdocu':
        return 'badge-opinion'; // Secondary gray
      default:
        return 'badge-secondary';
    }
  }

  formatResultType(type: string): string {
    switch (type) {
      case 'statute':
        return 'Statute';
      case 'court_rule':
        return 'Court Rule';
      case 'guideline':
        return 'Guideline';
      // Federal Register document types
      case 'federal_register_rule':
        return 'Federal Rule';
      case 'federal_register_prorule':
        return 'Proposed Rule';
      case 'federal_register_notice':
        return 'Federal Notice';
      case 'federal_register_presdocu':
        return 'Presidential Doc';
      default:
        return 'Document';
    }
  }

  // Session management
  generateSessionId(): string {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
  }

  getCurrentSessionId(): string {
    return this.currentSessionId;
  }

  startNewSession(): void {
    this.currentSessionId = this.generateSessionId();
  }

  // Search query validation
  validateSearchQuery(query: string): { isValid: boolean; message?: string } {
    if (!query || query.trim().length === 0) {
      return { isValid: false, message: 'Please enter a search query' };
    }

    if (query.trim().length < 3) {
      return { isValid: false, message: 'Search query must be at least 3 characters long' };
    }

    if (query.length > 500) {
      return { isValid: false, message: 'Search query is too long (maximum 500 characters)' };
    }

    return { isValid: true };
  }

  // Format search date for display
  formatSearchDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (error) {
      return dateString;
    }
  }

  // Reset search state
  resetSearchState(): void {
    this.searchStatusSubject.next('idle');
  }

  // Health check
  healthCheck(): Observable<any> {
    return this.http.get(`${this.apiUrl}/health`, { withCredentials: true });
  }

  // ============================================
  // Conversation Persistence Methods
  // ============================================

  /**
   * Get or create a conversation session
   */
  getOrCreateConversationSession(
    sessionId: number | null,
    userId: number,
    caseId: number,
    title: string
  ): Observable<AiConversationSession> {
    return this.http.post<any>(
      `${this.conversationApiUrl}/session`,
      { sessionId, userId, caseId, title },
      { withCredentials: true }
    ).pipe(
      map(response => response.data.session),
      catchError(error => {
        console.error('Failed to get/create conversation session:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Add a message to a conversation session
   */
  addMessageToSession(
    sessionId: number,
    userId: number,
    role: 'user' | 'assistant',
    content: string,
    metadata?: any
  ): Observable<AiConversationMessage> {
    const body: any = { userId, role, content };
    if (metadata) {
      body.metadata = JSON.stringify(metadata);
    }

    return this.http.post<any>(
      `${this.conversationApiUrl}/${sessionId}/messages`,
      body,
      { withCredentials: true }
    ).pipe(
      map(response => response.data.message),
      catchError(error => {
        console.error('Failed to add message to session:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get all conversations for a case
   */
  getConversationsForCase(caseId: number, userId: number): Observable<AiConversationSession[]> {
    return this.http.get<any>(
      `${this.conversationApiUrl}/case/${caseId}`,
      {
        params: { userId: userId.toString() },
        withCredentials: true
      }
    ).pipe(
      map(response => response.data.conversations || []),
      catchError(error => {
        console.error('Failed to get conversations for case:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get a specific conversation with all messages
   */
  getConversation(sessionId: number, userId: number): Observable<{
    conversation: AiConversationSession;
    messages: AiConversationMessage[];
  }> {
    return this.http.get<any>(
      `${this.conversationApiUrl}/${sessionId}`,
      {
        params: { userId: userId.toString() },
        withCredentials: true
      }
    ).pipe(
      map(response => ({
        conversation: response.data.conversation,
        messages: response.data.messages || []
      })),
      catchError(error => {
        console.error('Failed to get conversation:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Delete a conversation
   */
  deleteConversation(sessionId: number, userId: number): Observable<boolean> {
    return this.http.delete<any>(
      `${this.conversationApiUrl}/${sessionId}`,
      {
        params: { userId: userId.toString() },
        withCredentials: true
      }
    ).pipe(
      map(response => response.statusCode === 200),
      catchError(error => {
        console.error('Failed to delete conversation:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update conversation title
   */
  updateConversationTitle(sessionId: number, userId: number, title: string): Observable<boolean> {
    return this.http.put<any>(
      `${this.conversationApiUrl}/${sessionId}/title`,
      { userId, title },
      { withCredentials: true }
    ).pipe(
      map(response => response.statusCode === 200),
      catchError(error => {
        console.error('Failed to update conversation title:', error);
        return throwError(() => error);
      })
    );
  }

  // ============================================
  // AI Workspace Conversation Methods
  // ============================================

  /**
   * Get all conversations for a user with pagination
   */
  getAllUserConversations(page: number = 0, size: number = 50): Observable<{
    conversations: AiConversationSession[];
    totalPages: number;
    totalElements: number;
    currentPage: number;
  }> {
    const userId = this.getUserId(); // You'll need to implement this or pass it as parameter
    return this.http.get<any>(
      `${this.conversationApiUrl}`,
      {
        params: {
          userId: userId.toString(),
          page: page.toString(),
          size: size.toString()
        },
        withCredentials: true
      }
    ).pipe(
      map(response => ({
        conversations: response.data.conversations || [],
        totalPages: response.data.totalPages || 0,
        totalElements: response.data.totalElements || 0,
        currentPage: response.data.currentPage || 0
      })),
      catchError(error => {
        console.error('Failed to get all user conversations:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get conversations filtered by task type
   */
  getConversationsByTaskType(taskType: string, page: number = 0, size: number = 50): Observable<{
    conversations: AiConversationSession[];
    totalPages: number;
    totalElements: number;
    currentPage: number;
  }> {
    const userId = this.getUserId();
    return this.http.get<any>(
      `${this.conversationApiUrl}/task/${taskType}`,
      {
        params: {
          userId: userId.toString(),
          page: page.toString(),
          size: size.toString()
        },
        withCredentials: true
      }
    ).pipe(
      map(response => ({
        conversations: response.data.conversations || [],
        totalPages: response.data.totalPages || 0,
        totalElements: response.data.totalElements || 0,
        currentPage: response.data.currentPage || 0
      })),
      catchError(error => {
        console.error('Failed to get conversations by task type:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get ONLY general conversations (no caseId) filtered by task type
   * Used by AI Workspace to exclude case-specific research conversations
   */
  getGeneralConversationsByTaskType(taskType: string, page: number = 0, size: number = 50): Observable<{
    conversations: AiConversationSession[];
    totalPages: number;
    totalElements: number;
    currentPage: number;
  }> {
    const userId = this.getUserId();
    return this.http.get<any>(
      `${this.conversationApiUrl}/general/task/${taskType}`,
      {
        params: {
          userId: userId.toString(),
          page: page.toString(),
          size: size.toString()
        },
        withCredentials: true
      }
    ).pipe(
      map(response => ({
        conversations: response.data.conversations || [],
        totalPages: response.data.totalPages || 0,
        totalElements: response.data.totalElements || 0,
        currentPage: response.data.currentPage || 0
      })),
      catchError(error => {
        console.error('Failed to get general conversations by task type:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Create a new general conversation
   */
  createGeneralConversation(
    title: string,
    researchMode: string,
    taskType: string,
    documentType?: string,
    jurisdiction?: string
  ): Observable<AiConversationSession> {
    const userId = this.getUserId();
    return this.http.post<any>(
      `${this.conversationApiUrl}`,
      { userId, title, researchMode, taskType, documentType, jurisdiction },
      { withCredentials: true }
    ).pipe(
      map(response => response.data.session),
      catchError(error => {
        console.error('Failed to create general conversation:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Send message to conversation and get AI response
   */
  sendMessageToConversation(
    conversationId: number,
    query: string,
    researchMode: string
  ): Observable<AiConversationMessage> {
    const userId = this.getUserId();
    return this.http.post<any>(
      `${this.conversationApiUrl}/${conversationId}/query`,
      { userId, query, researchMode },
      { withCredentials: true }
    ).pipe(
      map(response => response.data.message),
      catchError(error => {
        console.error('Failed to send message to conversation:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Cancel ongoing AI generation for a conversation
   */
  cancelConversation(conversationId: number): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/api/legal/ai-workspace/conversations/${conversationId}/cancel`,
      {},
      { withCredentials: true }
    ).pipe(
      catchError(error => {
        console.error('Failed to cancel conversation:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get a conversation by ID
   */
  getConversationById(conversationId: number): Observable<{
    conversation: AiConversationSession;
    messages: AiConversationMessage[];
  }> {
    const userId = this.getUserId();
    return this.getConversation(conversationId, userId);
  }

  /**
   * Delete a conversation by ID
   */
  deleteConversationById(conversationId: number): Observable<boolean> {
    const userId = this.getUserId();
    return this.deleteConversation(conversationId, userId);
  }

  /**
   * Get user ID from UserService or JWT token
   * Uses multiple fallback sources to ensure we get the correct user ID
   */
  private getUserId(): number {
    // 1. First try UserService (most reliable)
    const userId = this.userService.getCurrentUserId();
    if (userId) {
      return userId;
    }

    // 2. Try to get from JWT token (key is '[KEY] TOKEN')
    try {
      const token = localStorage.getItem('[KEY] TOKEN');
      if (token && !this.jwtHelper.isTokenExpired(token)) {
        const decodedToken = this.jwtHelper.decodeToken(token);
        if (decodedToken && decodedToken.id) {
          return decodedToken.id;
        }
        if (decodedToken && decodedToken.sub) {
          // Some JWT implementations use 'sub' for user ID
          const subId = parseInt(decodedToken.sub, 10);
          if (!isNaN(subId)) {
            return subId;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to extract user ID from JWT token:', error);
    }

    // 3. Final fallback - log warning since this shouldn't happen in production
    console.warn('Could not determine user ID - user may see incorrect data');
    return 0; // Return 0 to indicate no valid user (backend should reject this)
  }
}