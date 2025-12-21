import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Conversation, Message, GroupedConversations } from '../models/conversation.model';
import { DocumentState, DocumentMetadata } from '../models/document.model';
import { WorkflowStep } from '../models/workflow.model';
import { ConversationType } from '../models/enums/conversation-type.enum';
import { WorkflowStepStatus } from '../models/enums/workflow-step-status.enum';

// Interface for analyzed documents
export interface AnalyzedDocument {
  id: string;
  databaseId: number;
  fileName: string;
  fileSize: number;
  detectedType: string;
  riskLevel?: string;
  riskScore?: number;
  analysis?: {
    fullAnalysis: string;
    summary?: string;
    riskScore?: number;
    riskLevel?: string;
    keyFindings?: string[];
    recommendations?: string[];
  };
  extractedMetadata?: string;
  timestamp: number;
  status: 'analyzing' | 'completed' | 'failed';
}

@Injectable({
  providedIn: 'root'
})
export class AiWorkspaceStateService {

  // ===== ANALYZED DOCUMENTS STATE =====
  private analyzedDocumentsSubject = new BehaviorSubject<AnalyzedDocument[]>([]);
  private activeDocumentIdSubject = new BehaviorSubject<string | null>(null);
  private documentViewerModeSubject = new BehaviorSubject<boolean>(false);

  public analyzedDocuments$ = this.analyzedDocumentsSubject.asObservable();
  public activeDocumentId$ = this.activeDocumentIdSubject.asObservable();
  public documentViewerMode$ = this.documentViewerModeSubject.asObservable();

  // ===== CONVERSATION STATE =====
  private conversationsSubject = new BehaviorSubject<Conversation[]>([]);
  private activeConversationIdSubject = new BehaviorSubject<string | null>(null);
  private conversationMessagesSubject = new BehaviorSubject<Message[]>([]);
  private groupedConversationsSubject = new BehaviorSubject<GroupedConversations>({
    past90Days: [],
    older: []
  });

  public conversations$ = this.conversationsSubject.asObservable();
  public activeConversationId$ = this.activeConversationIdSubject.asObservable();
  public conversationMessages$ = this.conversationMessagesSubject.asObservable();
  public groupedConversations$ = this.groupedConversationsSubject.asObservable();

  // ===== DOCUMENT STATE =====
  private currentDocumentSubject = new BehaviorSubject<DocumentState>({
    id: null,
    title: 'Generated Document',
    content: '',
    wordCount: 0,
    pageCount: 0,
    metadata: {},
    versions: []
  });

  public currentDocument$ = this.currentDocumentSubject.asObservable();

  // ===== UI STATE =====
  private showChatSubject = new BehaviorSubject<boolean>(false);
  private showBottomSearchBarSubject = new BehaviorSubject<boolean>(false);
  private isGeneratingSubject = new BehaviorSubject<boolean>(false);
  private draftingModeSubject = new BehaviorSubject<boolean>(false);
  private selectedTaskSubject = new BehaviorSubject<ConversationType>(ConversationType.Question);
  private showVersionHistorySubject = new BehaviorSubject<boolean>(false);
  private sidebarOpenSubject = new BehaviorSubject<boolean>(false);
  private viewerSidebarCollapsedSubject = new BehaviorSubject<boolean>(false);

  public showChat$ = this.showChatSubject.asObservable();
  public showBottomSearchBar$ = this.showBottomSearchBarSubject.asObservable();
  public isGenerating$ = this.isGeneratingSubject.asObservable();
  public draftingMode$ = this.draftingModeSubject.asObservable();
  public selectedTask$ = this.selectedTaskSubject.asObservable();
  public showVersionHistory$ = this.showVersionHistorySubject.asObservable();
  public sidebarOpen$ = this.sidebarOpenSubject.asObservable();
  public viewerSidebarCollapsed$ = this.viewerSidebarCollapsedSubject.asObservable();

  // ===== WORKFLOW STATE =====
  private workflowStepsSubject = new BehaviorSubject<WorkflowStep[]>([]);
  public workflowSteps$ = this.workflowStepsSubject.asObservable();

  // ===== FOLLOW-UP QUESTIONS =====
  private followUpQuestionsSubject = new BehaviorSubject<string[]>([]);
  public followUpQuestions$ = this.followUpQuestionsSubject.asObservable();

  // ===== BACKGROUND TASK RESULTS =====
  // Store results from background tasks that completed while user was away
  private pendingBackgroundResultsSubject = new BehaviorSubject<Map<string, any>>(new Map());
  public pendingBackgroundResults$ = this.pendingBackgroundResultsSubject.asObservable();

  // ===== CONVERSATION METHODS =====

  setConversations(conversations: Conversation[]): void {
    this.conversationsSubject.next(conversations);
    this.groupConversationsByDate(conversations);
  }

  getConversations(): Conversation[] {
    return this.conversationsSubject.value;
  }

  addConversation(conversation: Conversation): void {
    // Add new conversation at the beginning (index 0) so it appears at the top
    const conversations = [conversation, ...this.conversationsSubject.value];
    this.setConversations(conversations);
  }

  updateConversation(id: string, updates: Partial<Conversation>): void {
    const conversations = this.conversationsSubject.value.map(conv =>
      conv.id === id ? { ...conv, ...updates } : conv
    );
    this.setConversations(conversations);
  }

  removeConversation(id: string): void {
    const conversations = this.conversationsSubject.value.filter(conv => conv.id !== id);
    this.setConversations(conversations);
  }

  setActiveConversationId(id: string | null): void {
    this.activeConversationIdSubject.next(id);
  }

  getActiveConversationId(): string | null {
    return this.activeConversationIdSubject.value;
  }

  setConversationMessages(messages: Message[]): void {
    this.conversationMessagesSubject.next(messages);
  }

  getConversationMessages(): Message[] {
    return this.conversationMessagesSubject.value;
  }

  addConversationMessage(message: Message): void {
    const messages = [...this.conversationMessagesSubject.value, message];
    this.conversationMessagesSubject.next(messages);
  }

  updateConversationMessage(index: number, updates: Partial<Message>): void {
    const messages = [...this.conversationMessagesSubject.value];
    messages[index] = { ...messages[index], ...updates };
    this.conversationMessagesSubject.next(messages);
  }

  clearConversationMessages(): void {
    this.conversationMessagesSubject.next([]);
  }

  private groupConversationsByDate(conversations: Conversation[]): void {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));

    const grouped: GroupedConversations = {
      past90Days: conversations.filter(conv => conv.date >= ninetyDaysAgo),
      older: conversations.filter(conv => conv.date < ninetyDaysAgo)
    };

    this.groupedConversationsSubject.next(grouped);
  }

  // ===== DOCUMENT METHODS =====

  setCurrentDocument(document: Partial<DocumentState>): void {
    const current = this.currentDocumentSubject.value;
    this.currentDocumentSubject.next({ ...current, ...document });
  }

  getCurrentDocument(): DocumentState {
    return this.currentDocumentSubject.value;
  }

  updateDocumentContent(content: string, wordCount: number, pageCount: number): void {
    const current = this.currentDocumentSubject.value;
    this.currentDocumentSubject.next({
      ...current,
      content,
      wordCount,
      pageCount
    });
  }

  updateDocumentMetadata(metadata: Partial<DocumentMetadata>): void {
    const current = this.currentDocumentSubject.value;
    this.currentDocumentSubject.next({
      ...current,
      metadata: { ...current.metadata, ...metadata }
    });
  }

  resetDocument(): void {
    this.currentDocumentSubject.next({
      id: null,
      title: 'Generated Document',
      content: '',
      wordCount: 0,
      pageCount: 0,
      metadata: {},
      versions: []
    });
  }

  // ===== UI STATE METHODS =====

  setShowChat(show: boolean): void {
    this.showChatSubject.next(show);
  }

  setShowBottomSearchBar(show: boolean): void {
    this.showBottomSearchBarSubject.next(show);
  }

  setIsGenerating(generating: boolean): void {
    this.isGeneratingSubject.next(generating);
  }

  setDraftingMode(drafting: boolean): void {
    this.draftingModeSubject.next(drafting);
  }

  setSelectedTask(task: ConversationType): void {
    this.selectedTaskSubject.next(task);
  }

  setShowVersionHistory(show: boolean): void {
    this.showVersionHistorySubject.next(show);
  }

  setSidebarOpen(open: boolean): void {
    this.sidebarOpenSubject.next(open);
  }

  setViewerSidebarCollapsed(collapsed: boolean): void {
    this.viewerSidebarCollapsedSubject.next(collapsed);
  }

  toggleViewerSidebarCollapsed(): void {
    this.viewerSidebarCollapsedSubject.next(!this.viewerSidebarCollapsedSubject.value);
  }

  getViewerSidebarCollapsed(): boolean {
    return this.viewerSidebarCollapsedSubject.value;
  }

  getIsGenerating(): boolean {
    return this.isGeneratingSubject.value;
  }

  getDraftingMode(): boolean {
    return this.draftingModeSubject.value;
  }

  getSidebarOpen(): boolean {
    return this.sidebarOpenSubject.value;
  }

  getShowChat(): boolean {
    return this.showChatSubject.value;
  }

  getShowBottomSearchBar(): boolean {
    return this.showBottomSearchBarSubject.value;
  }

  getSelectedTask(): ConversationType {
    return this.selectedTaskSubject.value;
  }

  getShowVersionHistory(): boolean {
    return this.showVersionHistorySubject.value;
  }

  // ===== WORKFLOW METHODS =====

  setWorkflowSteps(steps: WorkflowStep[]): void {
    this.workflowStepsSubject.next(steps);
  }

  getWorkflowSteps(): WorkflowStep[] {
    return this.workflowStepsSubject.value;
  }

  updateWorkflowStep(stepId: number, updates: Partial<WorkflowStep>): void {
    const steps = this.workflowStepsSubject.value.map(step =>
      step.id === stepId ? { ...step, ...updates } : step
    );
    this.workflowStepsSubject.next(steps);
  }

  resetWorkflowSteps(): void {
    const steps = this.workflowStepsSubject.value.map(step => ({
      ...step,
      status: WorkflowStepStatus.Pending
    }));
    this.workflowStepsSubject.next(steps);
  }

  completeAllWorkflowSteps(): void {
    const steps = this.workflowStepsSubject.value.map(step => ({
      ...step,
      status: WorkflowStepStatus.Completed
    }));
    this.workflowStepsSubject.next(steps);
  }

  // ===== FOLLOW-UP QUESTIONS METHODS =====

  setFollowUpQuestions(questions: string[]): void {
    this.followUpQuestionsSubject.next(questions);
  }

  clearFollowUpQuestions(): void {
    this.followUpQuestionsSubject.next([]);
  }

  // ===== ANALYZED DOCUMENTS METHODS =====

  setAnalyzedDocuments(documents: AnalyzedDocument[]): void {
    this.analyzedDocumentsSubject.next(documents);
  }

  getAnalyzedDocuments(): AnalyzedDocument[] {
    return this.analyzedDocumentsSubject.value;
  }

  addAnalyzedDocument(document: AnalyzedDocument): void {
    // Add new document at the beginning (most recent first)
    const documents = [document, ...this.analyzedDocumentsSubject.value];
    // Keep only the last 20 documents
    this.analyzedDocumentsSubject.next(documents.slice(0, 20));
  }

  updateAnalyzedDocument(id: string, updates: Partial<AnalyzedDocument>): void {
    const documents = this.analyzedDocumentsSubject.value.map(doc =>
      doc.id === id ? { ...doc, ...updates } : doc
    );
    this.analyzedDocumentsSubject.next(documents);
  }

  removeAnalyzedDocument(id: string): void {
    const documents = this.analyzedDocumentsSubject.value.filter(doc => doc.id !== id);
    this.analyzedDocumentsSubject.next(documents);
  }

  getAnalyzedDocumentById(id: string): AnalyzedDocument | undefined {
    return this.analyzedDocumentsSubject.value.find(doc => doc.id === id);
  }

  getAnalyzedDocumentByDatabaseId(databaseId: number): AnalyzedDocument | undefined {
    return this.analyzedDocumentsSubject.value.find(doc => doc.databaseId === databaseId);
  }

  setActiveDocumentId(id: string | null): void {
    this.activeDocumentIdSubject.next(id);
  }

  getActiveDocumentId(): string | null {
    return this.activeDocumentIdSubject.value;
  }

  getActiveDocument(): AnalyzedDocument | undefined {
    const id = this.activeDocumentIdSubject.value;
    if (!id) return undefined;

    // First try to find by UUID
    let doc = this.getAnalyzedDocumentById(id);

    // If not found and id is numeric, try finding by databaseId
    if (!doc && !isNaN(Number(id))) {
      doc = this.getAnalyzedDocumentByDatabaseId(Number(id));
    }

    return doc;
  }

  setDocumentViewerMode(show: boolean): void {
    this.documentViewerModeSubject.next(show);
  }

  getDocumentViewerMode(): boolean {
    return this.documentViewerModeSubject.value;
  }

  // Open document in viewer
  openDocumentViewer(documentId: string): void {
    this.activeDocumentIdSubject.next(documentId);
    this.documentViewerModeSubject.next(true);
    // Automatically set task to Upload when opening document viewer
    // This ensures sidebar shows document analyses, not drafting conversations
    this.selectedTaskSubject.next(ConversationType.Upload);
  }

  // Close document viewer
  closeDocumentViewer(): void {
    this.activeDocumentIdSubject.next(null);
    this.documentViewerModeSubject.next(false);
  }

  // ===== RESET ALL STATE =====

  resetAllState(): void {
    this.conversationsSubject.next([]);
    this.activeConversationIdSubject.next(null);
    this.conversationMessagesSubject.next([]);
    this.resetDocument();
    this.showChatSubject.next(false);
    this.showBottomSearchBarSubject.next(false);
    this.isGeneratingSubject.next(false);
    this.draftingModeSubject.next(false);
    this.showVersionHistorySubject.next(false);
    this.sidebarOpenSubject.next(false);
    this.workflowStepsSubject.next([]);
    this.followUpQuestionsSubject.next([]);
    // Reset analyzed documents state
    this.analyzedDocumentsSubject.next([]);
    this.activeDocumentIdSubject.next(null);
    this.documentViewerModeSubject.next(false);
  }

  /**
   * Clear stale generation state
   * Called on component init to reset any stale UI state from previous navigation
   * This prevents showing "Generating response" when returning to the workspace
   * after navigating away during an active generation
   */
  clearStaleGenerationState(): void {
    // If isGenerating is true but we're just initializing, it's stale state
    if (this.isGeneratingSubject.value) {
      console.log('🧹 Clearing stale generation state');
      this.isGeneratingSubject.next(false);
    }

    // Clear any in-progress workflow steps (reset to empty, not pending)
    const steps = this.workflowStepsSubject.value;
    if (steps.length > 0 && steps.some(s => s.status === WorkflowStepStatus.Active || s.status === WorkflowStepStatus.Completed)) {
      console.log('🧹 Clearing stale workflow steps');
      this.workflowStepsSubject.next([]);
    }

    // Clear any "analyzing" status documents (they should be fetched fresh from DB)
    const docs = this.analyzedDocumentsSubject.value;
    const staleAnalyzingDocs = docs.filter(d => d.status === 'analyzing');
    if (staleAnalyzingDocs.length > 0) {
      console.log('🧹 Clearing', staleAnalyzingDocs.length, 'stale analyzing documents');
      // Remove stale analyzing docs - they'll be refetched from DB with correct status
      const cleanedDocs = docs.filter(d => d.status !== 'analyzing');
      this.analyzedDocumentsSubject.next(cleanedDocs);
    }
  }

  // ===== BACKGROUND TASK RESULTS METHODS =====

  /**
   * Store a background task result for later retrieval
   * @param conversationId The conversation ID the result belongs to
   * @param result The result data
   */
  storeBackgroundResult(conversationId: string, result: any): void {
    const currentResults = this.pendingBackgroundResultsSubject.value;
    const newResults = new Map(currentResults);
    newResults.set(conversationId, result);
    this.pendingBackgroundResultsSubject.next(newResults);
    console.log(`📦 Stored background result for conversation: ${conversationId}`);
  }

  /**
   * Get a pending background result for a conversation
   * @param conversationId The conversation ID
   * @returns The stored result or undefined
   */
  getBackgroundResult(conversationId: string): any | undefined {
    return this.pendingBackgroundResultsSubject.value.get(conversationId);
  }

  /**
   * Check if there are pending background results
   */
  hasPendingBackgroundResults(): boolean {
    return this.pendingBackgroundResultsSubject.value.size > 0;
  }

  /**
   * Get all pending background result conversation IDs
   */
  getPendingBackgroundResultIds(): string[] {
    return Array.from(this.pendingBackgroundResultsSubject.value.keys());
  }

  /**
   * Clear a specific background result after it's been consumed
   * @param conversationId The conversation ID
   */
  clearBackgroundResult(conversationId: string): void {
    const currentResults = this.pendingBackgroundResultsSubject.value;
    if (currentResults.has(conversationId)) {
      const newResults = new Map(currentResults);
      newResults.delete(conversationId);
      this.pendingBackgroundResultsSubject.next(newResults);
      console.log(`🗑️ Cleared background result for conversation: ${conversationId}`);
    }
  }

  /**
   * Clear all pending background results
   */
  clearAllBackgroundResults(): void {
    this.pendingBackgroundResultsSubject.next(new Map());
    console.log('🗑️ Cleared all pending background results');
  }
}
