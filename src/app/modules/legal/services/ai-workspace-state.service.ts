import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Conversation, Message, GroupedConversations } from '../models/conversation.model';
import { DocumentState, DocumentMetadata } from '../models/document.model';
import { WorkflowStep } from '../models/workflow.model';
import { ConversationType } from '../models/enums/conversation-type.enum';
import { WorkflowStepStatus } from '../models/enums/workflow-step-status.enum';

@Injectable({
  providedIn: 'root'
})
export class AiWorkspaceStateService {

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
  private selectedTaskSubject = new BehaviorSubject<ConversationType>(ConversationType.Draft);
  private showVersionHistorySubject = new BehaviorSubject<boolean>(false);
  private sidebarOpenSubject = new BehaviorSubject<boolean>(false);

  public showChat$ = this.showChatSubject.asObservable();
  public showBottomSearchBar$ = this.showBottomSearchBarSubject.asObservable();
  public isGenerating$ = this.isGeneratingSubject.asObservable();
  public draftingMode$ = this.draftingModeSubject.asObservable();
  public selectedTask$ = this.selectedTaskSubject.asObservable();
  public showVersionHistory$ = this.showVersionHistorySubject.asObservable();
  public sidebarOpen$ = this.sidebarOpenSubject.asObservable();

  // ===== WORKFLOW STATE =====
  private workflowStepsSubject = new BehaviorSubject<WorkflowStep[]>([]);
  public workflowSteps$ = this.workflowStepsSubject.asObservable();

  // ===== FOLLOW-UP QUESTIONS =====
  private followUpQuestionsSubject = new BehaviorSubject<string[]>([]);
  public followUpQuestions$ = this.followUpQuestionsSubject.asObservable();

  // ===== CONVERSATION METHODS =====

  setConversations(conversations: Conversation[]): void {
    this.conversationsSubject.next(conversations);
    this.groupConversationsByDate(conversations);
  }

  getConversations(): Conversation[] {
    return this.conversationsSubject.value;
  }

  addConversation(conversation: Conversation): void {
    const conversations = [...this.conversationsSubject.value, conversation];
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
  }
}
