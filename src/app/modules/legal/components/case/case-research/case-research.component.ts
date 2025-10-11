import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  LegalResearchService,
  LegalSearchRequest,
  LegalSearchResponse,
  SearchResult
} from '../../../services/legal-research.service';
import { ResearchActionService, ResearchActionItem } from '../../../services/research-action.service';
import { CaseTaskService } from '../../../../../service/case-task.service';
import { TaskType, TaskPriority } from '../../../../../interface/case-task';
import { CalendarService } from '../../../services/calendar.service';

// Conversation interface for multi-conversation support
interface Conversation {
  id: string;
  title: string;
  sessionId: number;
  createdAt: Date;
  lastUpdated: Date;
  messages: { role: 'user' | 'assistant'; content: string; timestamp: Date; isTyping?: boolean; collapsed?: boolean }[];
  followUpQuestions: string[];
}
import Swal from 'sweetalert2';
import { MarkdownToHtmlPipe } from '../../../pipes/markdown-to-html.pipe';

@Component({
  selector: 'app-case-research',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownToHtmlPipe],
  templateUrl: './case-research.component.html',
  styleUrls: ['./case-research.component.scss'],
  host: {
    '[style.display]': '"block"',
    '[style.visibility]': '"visible"',
    '[style.width]': '"100%"',
    '[style.min-height]': '"600px"'
  }
})
export class CaseResearchComponent implements OnInit, OnDestroy {
  @Input() caseId!: string;
  @Input() userId: number = 1; // TODO: Get from auth service

  private destroy$ = new Subject<void>();

  searchQuery = '';
  searchType: 'all' | 'statutes' | 'rules' | 'regulations' | 'guidelines' = 'all';
  isSearching = false;
  searchError = '';

  searchResults: SearchResult[] = [];
  currentSearchResponse?: LegalSearchResponse;

  // Multi-conversation support
  conversations: Conversation[] = [];
  activeConversationId: string | null = null;
  showConversationList: boolean = false;

  // Chat-based AI Display (linked to active conversation)
  chatMessages: { role: 'user' | 'assistant'; content: string; timestamp: Date; isTyping?: boolean; collapsed?: boolean }[] = [];
  showChat: boolean = false;
  aiThinking: boolean = false;
  currentTypingMessage: string = '';
  followUpQuestions: string[] = [];
  selectedAction?: ResearchActionItem;

  // Workflow wizard states
  workflowSteps = [
    { id: 'analyze', title: 'Query Analysis', description: 'Understanding your legal question', icon: 'ri-file-search-line', status: 'pending' },
    { id: 'search', title: 'Legal Database Search', description: 'Searching Massachusetts statutes and regulations', icon: 'ri-search-line', status: 'pending' },
    { id: 'ai', title: 'AI Analysis', description: 'Analyzing legal sources with Claude AI', icon: 'ri-brain-line', status: 'pending' },
    { id: 'generate', title: 'Generating Response', description: 'Preparing comprehensive answer', icon: 'ri-quill-pen-line', status: 'pending' }
  ];
  currentWorkflowStep = 0;

  // Research Actions
  actionSuggestions: ResearchActionItem[] = [];
  loadingActions: boolean = false;
  currentSessionId: number = 1; // TODO: Get from actual session

  // SSE for real-time progress
  private eventSource?: EventSource;
  private searchSessionId: string = '';

  constructor(
    private legalResearchService: LegalResearchService,
    private researchActionService: ResearchActionService,
    private caseTaskService: CaseTaskService,
    private calendarService: CalendarService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    console.log('===== RESEARCH COMPONENT INIT =====');
    console.log('🔍 CaseResearchComponent initialized with caseId:', this.caseId);
    console.log('📊 showChat:', this.showChat);
    console.log('📊 isSearching:', this.isSearching);
    console.log('📊 aiThinking:', this.aiThinking);
    console.log('📊 chatMessages.length:', this.chatMessages.length);
    console.log('📊 HERO SHOULD SHOW:', !this.showChat && !this.isSearching);
    console.log('===================================');

    // TEMPORARY: Clear chat history to test hero section
    // localStorage.removeItem(this.getChatHistoryKey());

    // Load conversations for this case
    this.loadConversations();

    // If no conversations exist, create first one
    if (this.conversations.length === 0) {
      this.createNewConversation();
    }

    // Don't load pending actions on init to avoid duplicates
    // Actions will be generated fresh from each search

    // Force change detection to ensure component renders
    setTimeout(() => {
      console.log('===== 1 SECOND AFTER INIT =====');
      console.log('📊 showChat:', this.showChat);
      console.log('📊 isSearching:', this.isSearching);
      console.log('📊 HERO SHOULD SHOW:', !this.showChat && !this.isSearching);
      console.log('================================');
      this.cdr.detectChanges();
    }, 1000);
  }

  ngOnDestroy(): void {
    this.closeSSEConnection();
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPendingActions(): void {
    if (!this.caseId) return;

    this.researchActionService.getSessionActions(this.currentSessionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (actions) => {
          const filteredActions = actions.filter(a =>
            a.caseId?.toString() === this.caseId
          );
          // Merge with existing suggestions and remove duplicates
          const allSuggestions = [...this.actionSuggestions, ...filteredActions];
          this.actionSuggestions = this.removeDuplicateActions(allSuggestions);
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading pending actions:', error);
        }
      });
  }

  // Chat History Management
  private getConversationsKey(): string {
    return `legal_research_conversations_${this.caseId}`;
  }

  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateConversationTitle(firstMessage: string): string {
    // Generate title from first 50 characters of first user message
    const maxLength = 50;
    if (firstMessage.length <= maxLength) {
      return firstMessage;
    }
    return firstMessage.substring(0, maxLength) + '...';
  }

  loadConversations(): void {
    if (!this.caseId) return;

    try {
      const conversationsKey = this.getConversationsKey();
      const savedData = localStorage.getItem(conversationsKey);

      if (savedData) {
        const parsed = JSON.parse(savedData);

        // Convert timestamps back to Date objects
        this.conversations = parsed.conversations.map((conv: any) => ({
          ...conv,
          createdAt: new Date(conv.createdAt),
          lastUpdated: new Date(conv.lastUpdated),
          messages: conv.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }));

        this.activeConversationId = parsed.activeConversationId;

        // Load active conversation
        if (this.activeConversationId) {
          this.loadActiveConversation();
        }

        console.log('💬 Loaded conversations:', this.conversations.length);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      this.conversations = [];
      this.activeConversationId = null;
    }
  }

  loadActiveConversation(): void {
    const activeConv = this.conversations.find(c => c.id === this.activeConversationId);

    if (activeConv) {
      this.chatMessages = activeConv.messages;
      this.followUpQuestions = activeConv.followUpQuestions;
      this.currentSessionId = activeConv.sessionId;
      this.showChat = activeConv.messages.length > 0;

      console.log('✅ Loaded active conversation:', activeConv.title);

      // Load action suggestions from backend
      this.loadActionSuggestionsFromBackend();

      this.cdr.detectChanges();
    }
  }

  loadActionSuggestionsFromBackend(): void {
    console.log('🔄 Loading action suggestions from backend for session:', this.currentSessionId);

    this.loadingActions = true;
    this.researchActionService.getSessionActions(this.currentSessionId).subscribe({
      next: (actions) => {
        console.log('✅ Loaded actions from backend:', actions);
        this.actionSuggestions = actions;
        this.loadingActions = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Error loading actions from backend:', error);
        this.loadingActions = false;
        this.actionSuggestions = [];
      }
    });
  }

  saveConversations(): void {
    if (!this.caseId) return;

    try {
      // Update active conversation with current state
      if (this.activeConversationId) {
        const activeConv = this.conversations.find(c => c.id === this.activeConversationId);
        if (activeConv) {
          activeConv.messages = this.chatMessages;
          activeConv.followUpQuestions = this.followUpQuestions;
          activeConv.lastUpdated = new Date();
          activeConv.sessionId = this.currentSessionId;

          // Update title from first user message if empty
          if (!activeConv.title || activeConv.title === 'New Conversation') {
            const firstUserMsg = this.chatMessages.find(m => m.role === 'user');
            if (firstUserMsg) {
              activeConv.title = this.generateConversationTitle(firstUserMsg.content);
            }
          }
        }
      }

      const conversationsKey = this.getConversationsKey();
      const data = {
        conversations: this.conversations,
        activeConversationId: this.activeConversationId
      };

      localStorage.setItem(conversationsKey, JSON.stringify(data));
      console.log('💾 Saved conversations');
    } catch (error) {
      console.error('Error saving conversations:', error);
    }
  }

  createNewConversation(): void {
    // Save current conversation before creating new one
    if (this.activeConversationId) {
      this.saveConversations();
    }

    // Create new conversation
    const newConv: Conversation = {
      id: this.generateConversationId(),
      title: 'New Conversation',
      sessionId: Date.now(), // Generate unique session ID
      createdAt: new Date(),
      lastUpdated: new Date(),
      messages: [],
      followUpQuestions: []
    };

    this.conversations.unshift(newConv); // Add to beginning
    this.activeConversationId = newConv.id;
    this.currentSessionId = newConv.sessionId;

    // Reset UI state
    this.chatMessages = [];
    this.followUpQuestions = [];
    this.actionSuggestions = [];
    this.showChat = false;
    this.searchQuery = '';

    this.saveConversations();
    this.cdr.detectChanges();

    console.log('🆕 Created new conversation:', newConv.id);
  }

  switchConversation(conversationId: string): void {
    if (conversationId === this.activeConversationId) {
      this.showConversationList = false;
      return;
    }

    // Save current conversation
    this.saveConversations();

    // Switch to new conversation
    this.activeConversationId = conversationId;
    this.loadActiveConversation();

    // Close dropdown after switching
    this.showConversationList = false;

    console.log('🔄 Switched to conversation:', conversationId);
  }

  deleteConversation(conversationId: string): void {
    Swal.fire({
      title: 'Delete Conversation?',
      html: '<p class="text-muted mb-0">This will permanently delete this conversation. This action cannot be undone.</p>',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '<i class="ri-delete-bin-line me-2"></i>Delete',
      cancelButtonText: 'Cancel',
      customClass: {
        confirmButton: 'btn btn-danger',
        cancelButton: 'btn btn-light'
      },
      buttonsStyling: false
    }).then((result) => {
      if (result.isConfirmed) {
        // Remove conversation from list
        this.conversations = this.conversations.filter(c => c.id !== conversationId);

        // If deleting active conversation, switch to another or create new
        if (conversationId === this.activeConversationId) {
          if (this.conversations.length > 0) {
            this.activeConversationId = this.conversations[0].id;
            this.loadActiveConversation();
          } else {
            this.createNewConversation();
          }
        }

        this.saveConversations();

        Swal.fire({
          title: 'Deleted!',
          text: 'Conversation has been deleted.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      }
    });
  }

  toggleConversationList(): void {
    this.showConversationList = !this.showConversationList;
  }

  getActiveConversationTitle(): string {
    const activeConv = this.conversations.find(c => c.id === this.activeConversationId);
    return activeConv?.title || 'Select Conversation';
  }

  performSearch(): void {
    if (!this.searchQuery.trim()) {
      return;
    }

    this.isSearching = true;
    this.searchError = '';
    this.searchResults = [];
    this.aiThinking = true;
    // Clear action suggestions for new search to prevent duplicates
    this.actionSuggestions = [];
    this.followUpQuestions = [];

    // Show chat immediately
    this.showChat = true;

    // Reset workflow steps
    this.currentWorkflowStep = 0;
    this.workflowSteps.forEach(step => step.status = 'pending');

    // Generate unique session ID for SSE tracking
    this.searchSessionId = this.generateSessionId();
    console.log('🔍 Starting search with session ID:', this.searchSessionId);

    // Connect to SSE for real-time progress updates
    this.connectToSSE(this.searchSessionId);

    // Add user message to chat
    this.chatMessages.push({
      role: 'user',
      content: this.searchQuery,
      timestamp: new Date()
    });

    // Save conversation after adding user message
    this.saveConversations();

    const searchRequest: LegalSearchRequest = {
      query: this.searchQuery,
      searchType: this.searchType,
      jurisdiction: 'MASSACHUSETTS',
      caseId: this.caseId,
      sessionId: this.searchSessionId
    };

    this.legalResearchService.performSearch(searchRequest)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: LegalSearchResponse) => {
          if (response.success) {
            this.currentSearchResponse = response;
            this.searchResults = response.results;

            // Add AI response with typing effect
            if (response.aiAnalysis) {
              this.simulateTyping(response.aiAnalysis);
            }

            // Generate action suggestions based on the query and AI response
            if (this.caseId) {
              // Use AI analysis as the finding if no results, otherwise use first result
              if (response.results && response.results.length > 0) {
                const firstResult = response.results[0];
                this.generateActionSuggestions(firstResult);
              } else {
                // Generate actions based on the query and AI analysis
                this.generateActionSuggestionsFromAnalysis(this.searchQuery, response.aiAnalysis || '');
              }
            } else {
              this.aiThinking = false;
              this.isSearching = false;
            }

            this.cdr.detectChanges();
          } else {
            this.searchError = response.error || 'Search failed';
            this.aiThinking = false;
            this.isSearching = false;
          }
        },
        error: (error) => {
          this.isSearching = false;
          this.aiThinking = false;
          this.searchError = 'An error occurred while searching. Please try again.';
          console.error('Search error:', error);
        }
      });
  }

  simulateTyping(fullMessage: string): void {
    // Extract and remove follow-up questions from the message first
    const cleanedMessage = this.extractAndRemoveFollowUpQuestions(fullMessage);

    // INSTANT DISPLAY: Show the complete response immediately
    // The loading animation already provides visual feedback during backend processing
    const message = {
      role: 'assistant' as const,
      content: cleanedMessage,
      timestamp: new Date(),
      isTyping: false,
      collapsed: false
    };
    this.chatMessages.push(message);
    this.aiThinking = false;
    this.isSearching = false;
    this.cdr.detectChanges();

    // Save conversation immediately
    this.saveConversations();
  }

  extractAndRemoveFollowUpQuestions(aiResponse: string): string {
    // Look for "Follow-up Questions" section in the markdown response
    const followUpPattern = /##\s*Follow-up Questions\s*\n([\s\S]*?)(?=\n##|$)/i;
    const match = aiResponse.match(followUpPattern);

    if (match) {
      const questionsSection = match[1];
      // Extract questions from list items (- or 1., 2., etc.)
      const questionMatches = questionsSection.match(/[-•*]\s*(.+?)(?=\n[-•*]|\n\d+\.|\n|$)/g);

      if (questionMatches) {
        this.followUpQuestions = questionMatches
          .map(q => q.replace(/^[-•*]\s*/, '').trim())
          .map(q => q.replace(/\*\*/g, '')) // Remove all ** (bold markdown)
          .filter(q => q.length > 0)
          .slice(0, 5); // Limit to 5 questions
      }

      // Remove the entire "Follow-up Questions" section from the response
      return aiResponse.replace(followUpPattern, '').trim();
    }

    return aiResponse;
  }

  askFollowUpQuestion(question: string): void {
    this.searchQuery = question;
    this.performSearch();
  }

  updateWorkflowStep(stepIndex: number): void {
    if (stepIndex < this.workflowSteps.length) {
      // Mark current step as active
      this.workflowSteps[stepIndex].status = 'active';

      // Mark previous steps as completed
      for (let i = 0; i < stepIndex; i++) {
        this.workflowSteps[i].status = 'completed';
      }

      this.currentWorkflowStep = stepIndex;
      this.cdr.detectChanges();

      // Simulate progression through steps
      if (stepIndex === 0) {
        // Query Analysis - quick
        setTimeout(() => this.updateWorkflowStep(1), 1000);
      } else if (stepIndex === 1) {
        // Database Search - takes time
        setTimeout(() => this.updateWorkflowStep(2), 2000);
      } else if (stepIndex === 2) {
        // AI Analysis - longer
        setTimeout(() => this.updateWorkflowStep(3), 2500);
      } else if (stepIndex === 3) {
        // Last step - wait a bit then show chat
        setTimeout(() => this.updateWorkflowStep(4), 1500);
      }
    } else {
      // All steps completed - now show chat
      this.workflowSteps.forEach(step => step.status = 'completed');
      this.showChat = true;
      this.cdr.detectChanges();
    }
  }

  generateActionSuggestions(result: SearchResult): void {
    const finding = result.summary || result.title;
    const citation = result.citation;

    console.log('🎯 generateActionSuggestions called with:', {
      sessionId: this.currentSessionId,
      userId: this.userId,
      caseId: this.caseId,
      finding: finding?.substring(0, 100),
      citation
    });

    this.loadingActions = true;
    this.cdr.detectChanges();

    this.researchActionService.suggestActions(
      this.currentSessionId,
      this.userId,
      finding,
      citation,
      parseInt(this.caseId, 10)
    ).subscribe({
      next: (suggestions) => {
        console.log('✅ Action suggestions received:', suggestions);
        console.log('📊 Number of suggestions:', suggestions?.length || 0);
        // Replace with new suggestions (already cleared in performSearch)
        this.actionSuggestions = suggestions;
        this.loadingActions = false;
        this.aiThinking = false;
        this.isSearching = false;
        this.cdr.detectChanges();
        console.log('🔄 actionSuggestions after set:', this.actionSuggestions);
      },
      error: (error) => {
        console.error('❌ Error generating action suggestions:', error);
        this.loadingActions = false;
        this.aiThinking = false;
        this.isSearching = false;
      }
    });
  }

  generateActionSuggestionsFromAnalysis(query: string, aiAnalysis: string): void {
    // Extract a summary from the AI analysis to use as finding
    const finding = aiAnalysis.substring(0, 500); // First 500 chars
    const citation = `Research Query: ${query}`;

    console.log('🎯 generateActionSuggestionsFromAnalysis called with:', {
      sessionId: this.currentSessionId,
      userId: this.userId,
      caseId: this.caseId,
      query,
      finding: finding?.substring(0, 100),
      citation
    });

    this.loadingActions = true;
    this.cdr.detectChanges();

    this.researchActionService.suggestActions(
      this.currentSessionId,
      this.userId,
      finding,
      citation,
      parseInt(this.caseId, 10)
    ).subscribe({
      next: (suggestions) => {
        console.log('✅ Action suggestions from analysis received:', suggestions);
        console.log('📊 Number of suggestions:', suggestions?.length || 0);
        // Replace with new suggestions (already cleared in performSearch)
        this.actionSuggestions = suggestions;
        this.loadingActions = false;
        this.aiThinking = false;
        this.isSearching = false;
        this.cdr.detectChanges();
        console.log('🔄 actionSuggestions after set:', this.actionSuggestions);
      },
      error: (error) => {
        console.error('❌ Error generating action suggestions from analysis:', error);
        this.loadingActions = false;
        this.aiThinking = false;
        this.isSearching = false;
      }
    });
  }

  // Helper method to remove duplicate actions by ID
  private removeDuplicateActions(actions: ResearchActionItem[]): ResearchActionItem[] {
    const seen = new Set<number>();
    return actions.filter(action => {
      if (seen.has(action.id)) {
        return false;
      }
      seen.add(action.id);
      return true;
    });
  }

  executeAction(action: ResearchActionItem): void {
    switch (action.actionType) {
      case 'CREATE_TASK':
        this.createTask(action);
        break;
      case 'CREATE_DEADLINE':
        this.createDeadline(action);
        break;
      case 'DRAFT_MOTION':
        this.draftMotion(action);
        break;
      case 'ADD_NOTE':
        this.addNote(action);
        break;
      case 'SCHEDULE_EVENT':
        this.scheduleEvent(action);
        break;
      default:
        this.markActionCompleted(action);
    }
  }

  private createTask(action: ResearchActionItem): void {
    Swal.fire({
      title: 'Create Task',
      html: `
        <p class="text-muted mb-3">${action.taskDescription}</p>
        <div class="text-start">
          <label class="form-label">Task Title</label>
          <input id="taskTitle" class="swal2-input" value="${action.taskDescription}" style="width: 90%;">
          <label class="form-label mt-2">Due Date</label>
          <input id="taskDueDate" type="date" class="swal2-input" style="width: 90%;">
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Create Task',
      preConfirm: () => {
        const title = (document.getElementById('taskTitle') as HTMLInputElement).value;
        const dueDate = (document.getElementById('taskDueDate') as HTMLInputElement).value;
        return { title, dueDate };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const taskData = {
          caseId: parseInt(this.caseId),
          title: result.value.title,
          description: action.sourceFinding,
          taskType: TaskType.RESEARCH,
          priority: (action.taskPriority as TaskPriority) || TaskPriority.MEDIUM,
          dueDate: result.value.dueDate ? new Date(result.value.dueDate) : undefined
        };

        this.caseTaskService.createTask(taskData).subscribe({
          next: () => {
            this.markActionCompleted(action);
            Swal.fire('Success!', 'Task created successfully', 'success');
          },
          error: (error) => {
            console.error('Error creating task:', error);
            Swal.fire('Error', 'Failed to create task', 'error');
          }
        });
      }
    });
  }

  private createDeadline(action: ResearchActionItem): void {
    Swal.fire({
      title: 'Create Deadline',
      html: `
        <p class="text-muted mb-3">${action.taskDescription}</p>
        <div class="text-start">
          <label class="form-label">Deadline Title</label>
          <input id="deadlineTitle" class="swal2-input" value="${action.taskDescription}" style="width: 90%;">
          <label class="form-label mt-2">Date</label>
          <input id="deadlineDate" type="datetime-local" class="swal2-input" style="width: 90%;">
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Create Deadline',
      preConfirm: () => {
        const title = (document.getElementById('deadlineTitle') as HTMLInputElement).value;
        const date = (document.getElementById('deadlineDate') as HTMLInputElement).value;
        return { title, date };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const eventData = {
          title: result.value.title,
          start: new Date(result.value.date),
          end: new Date(result.value.date),
          description: action.sourceFinding,
          caseId: parseInt(this.caseId, 10),
          eventType: 'DEADLINE' as const,
          allDay: false
        };

        this.calendarService.createEvent(eventData).subscribe({
          next: () => {
            this.markActionCompleted(action);
            Swal.fire('Success!', 'Deadline created successfully', 'success');
          },
          error: (error) => {
            console.error('Error creating deadline:', error);
            Swal.fire('Error', 'Failed to create deadline', 'error');
          }
        });
      }
    });
  }

  private draftMotion(action: ResearchActionItem): void {
    Swal.fire({
      title: 'Draft Motion',
      text: 'Document drafting feature coming soon. For now, this action will be marked as completed.',
      icon: 'info',
      confirmButtonText: 'OK'
    }).then(() => {
      this.markActionCompleted(action);
    });
  }

  private addNote(action: ResearchActionItem): void {
    Swal.fire({
      title: 'Add Case Note',
      text: 'Case notes feature coming soon. For now, this action will be marked as completed.',
      icon: 'info',
      confirmButtonText: 'OK'
    }).then(() => {
      this.markActionCompleted(action);
    });
  }

  private scheduleEvent(action: ResearchActionItem): void {
    this.createDeadline(action); // Reuse deadline logic for events
  }

  private markActionCompleted(action: ResearchActionItem): void {
    this.researchActionService.completeAction(action.id).subscribe({
      next: () => {
        this.actionSuggestions = this.actionSuggestions.filter(a => a.id !== action.id);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error completing action:', error);
      }
    });
  }

  dismissActionSuggestion(action: ResearchActionItem): void {
    this.researchActionService.dismissAction(action.id).subscribe({
      next: () => {
        this.actionSuggestions = this.actionSuggestions.filter(a => a.id !== action.id);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error dismissing action:', error);
      }
    });
  }

  getActionIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'DRAFT_MOTION': 'file-edit-line',
      'CREATE_DEADLINE': 'calendar-event-line',
      'CREATE_TASK': 'task-line',
      'ADD_NOTE': 'sticky-note-line',
      'ATTACH_DOCUMENT': 'attachment-line',
      'SCHEDULE_EVENT': 'calendar-check-line'
    };
    return icons[type] || 'lightbulb-line';
  }

  getActionLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'DRAFT_MOTION': 'Draft Motion',
      'CREATE_DEADLINE': 'Create Deadline',
      'CREATE_TASK': 'Create Task',
      'ADD_NOTE': 'Add Note',
      'ATTACH_DOCUMENT': 'Attach Document',
      'SCHEDULE_EVENT': 'Schedule Event'
    };
    return labels[type] || type;
  }

  getActionBadgeClass(type: string): string {
    const classes: { [key: string]: string } = {
      'DRAFT_MOTION': 'action-primary',
      'CREATE_DEADLINE': 'action-danger',
      'CREATE_TASK': 'action-warning',
      'ADD_NOTE': 'action-info',
      'ATTACH_DOCUMENT': 'action-success',
      'SCHEDULE_EVENT': 'action-secondary'
    };
    return classes[type] || 'action-primary';
  }

  // Count how many actions of the same type exist
  getActionCount(actionType: string): number {
    return this.actionSuggestions.filter(a => a.actionType === actionType).length;
  }

  // Get the index of this specific action among actions of the same type
  getActionIndex(action: ResearchActionItem, globalIndex: number): number {
    const sameTypeActions = this.actionSuggestions
      .map((a, idx) => ({ action: a, idx }))
      .filter(item => item.action.actionType === action.actionType);

    const position = sameTypeActions.findIndex(item => item.idx === globalIndex);
    return position >= 0 ? position : 0;
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchResults = [];
    this.currentSearchResponse = undefined;
    this.searchError = '';
  }

  // Check if AI response is long enough to need "Read more"
  isResponseLong(content: string): boolean {
    return content.length > 800; // ~800 characters threshold
  }

  // Toggle expanded/collapsed state of AI response
  toggleResponse(message: any): void {
    message.collapsed = !message.collapsed;
    this.cdr.detectChanges();
  }

  // Open modal for action details
  openActionModal(action: ResearchActionItem): void {
    this.selectedAction = action;

    // Build confidence bar HTML
    const confidenceScore = action.aiConfidenceScore || 0;
    const confidencePercent = confidenceScore > 1 ? confidenceScore : confidenceScore * 100;
    const confidenceColor = confidencePercent >= 80 ? 'success' : confidencePercent >= 60 ? 'info' : 'warning';
    const confidenceIcon = confidencePercent >= 80 ? 'checkbox-circle-fill' : confidencePercent >= 60 ? 'information-fill' : 'alert-fill';

    // Build priority badge
    let prioritySection = '';
    if (action.taskPriority) {
      const priorityClass = action.taskPriority === 'URGENT' ? 'danger' :
                            action.taskPriority === 'HIGH' ? 'warning' :
                            action.taskPriority === 'MEDIUM' ? 'info' : 'secondary';
      const priorityIcon = action.taskPriority === 'URGENT' ? 'alarm-warning-fill' :
                           action.taskPriority === 'HIGH' ? 'error-warning-fill' :
                           action.taskPriority === 'MEDIUM' ? 'information-fill' : 'checkbox-circle-fill';
      prioritySection = `
        <div class="alert alert-${priorityClass} border-0 mb-3 py-2 px-3 d-flex align-items-center" style="background: rgba(var(--vz-${priorityClass}-rgb), 0.1);">
          <i class="ri-${priorityIcon} fs-18 me-2"></i>
          <span class="fw-semibold">${action.taskPriority} Priority</span>
        </div>
      `;
    }

    // Build HTML content with improved design
    const htmlContent = `
      <div class="text-start" style="padding: 0 0.5rem;">
        ${prioritySection}

        ${action.taskDescription ? `
          <div class="mb-4 p-3 rounded" style="background: #f8f9fa; border-left: 3px solid var(--vz-primary);">
            <div class="d-flex align-items-center mb-2">
              <i class="ri-file-list-3-line text-primary me-2 fs-18"></i>
              <label class="fw-bold mb-0" style="color: #1a252f;">Task Description</label>
            </div>
            <p class="mb-0" style="color: #2c3e50; line-height: 1.6;">${action.taskDescription}</p>
          </div>
        ` : ''}

        ${action.sourceCitation ? `
          <div class="mb-4 p-3 rounded" style="background: #fff3e0; border-left: 3px solid #ff9800;">
            <div class="d-flex align-items-center mb-2">
              <i class="ri-book-open-line me-2 fs-18" style="color: #ff9800;"></i>
              <label class="fw-bold mb-0" style="color: #e65100;">Source Citation</label>
            </div>
            <p class="mb-0 fst-italic" style="color: #ef6c00; font-size: 0.9rem;">${action.sourceCitation}</p>
          </div>
        ` : ''}

        ${action.aiConfidenceScore ? `
          <div class="p-3 rounded" style="background: rgba(var(--vz-${confidenceColor}-rgb), 0.05); border: 1px solid rgba(var(--vz-${confidenceColor}-rgb), 0.2);">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <div class="d-flex align-items-center">
                <i class="ri-${confidenceIcon} text-${confidenceColor} me-2 fs-18"></i>
                <label class="fw-bold mb-0" style="color: var(--vz-${confidenceColor});">AI Confidence Score</label>
              </div>
              <span class="badge bg-${confidenceColor} fs-13">${confidencePercent.toFixed(0)}%</span>
            </div>
            <div class="progress" style="height: 12px; border-radius: 6px; background: rgba(0,0,0,0.05);">
              <div class="progress-bar bg-${confidenceColor}"
                   role="progressbar"
                   style="width: ${confidencePercent}%; border-radius: 6px;"
                   aria-valuenow="${confidencePercent}"
                   aria-valuemin="0"
                   aria-valuemax="100">
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // Show SweetAlert modal with improved styling
    Swal.fire({
      title: `
        <div class="d-flex align-items-center justify-content-center" style="gap: 0.75rem; margin: 0;">
          <div class="avatar-sm" style="background: rgba(var(--vz-primary-rgb), 0.1); border-radius: 50%; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center;">
            <i class="ri-${this.getActionIcon(action.actionType)} text-primary fs-18"></i>
          </div>
          <span style="color: #1a252f; font-weight: 600; font-size: 1.125rem;">${this.getActionLabel(action.actionType)}</span>
        </div>
      `,
      html: htmlContent,
      width: '650px',
      padding: '1.5rem',
      showCancelButton: true,
      confirmButtonText: '<i class="ri-check-line me-2"></i>Accept & Create',
      cancelButtonText: '<i class="ri-close-line me-2"></i>Dismiss',
      customClass: {
        confirmButton: 'btn btn-primary px-4',
        cancelButton: 'btn btn-outline-secondary px-4',
        actions: 'gap-3 mt-3',
        title: 'mb-3'
      },
      buttonsStyling: false,
      showClass: {
        popup: 'animate__animated animate__fadeInDown animate__faster'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutUp animate__faster'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.acceptAction(action);
      }
    });
  }

  // Accept action and create task/deadline/etc
  acceptAction(action: ResearchActionItem): void {
    this.executeAction(action);
  }

  // SSE Methods for real-time progress updates
  private generateSessionId(): string {
    return `search_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private connectToSSE(sessionId: string): void {
    this.closeSSEConnection(); // Close any existing connection

    const sseUrl = `http://localhost:8085/api/ai/legal-research/progress-stream?sessionId=${sessionId}`;
    console.log('🔌 Connecting to SSE:', sseUrl);

    this.eventSource = new EventSource(sseUrl);

    this.eventSource.onopen = () => {
      console.log('✅ SSE connection established');
    };

    this.eventSource.onmessage = (event: MessageEvent) => {
      console.log('📨 SSE message received:', event);
      try {
        const data = JSON.parse(event.data);
        console.log('📊 Parsed SSE data:', data);
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    this.eventSource.addEventListener('progress', (event: MessageEvent) => {
      try {
        const progressEvent = JSON.parse(event.data);
        console.log('📊 Progress event:', progressEvent);
        this.handleProgressEvent(progressEvent);
      } catch (error) {
        console.error('Error parsing progress event:', error, event);
      }
    });

    this.eventSource.addEventListener('complete', (event: MessageEvent) => {
      try {
        const completeEvent = JSON.parse(event.data);
        console.log('✅ Complete event:', completeEvent);
        this.handleCompleteEvent(completeEvent);
      } catch (error) {
        console.error('Error parsing complete event:', error, event);
      }
    });

    this.eventSource.addEventListener('error', (event: MessageEvent) => {
      try {
        if (event.data) {
          const errorEvent = JSON.parse(event.data);
          console.error('❌ Error event:', errorEvent);
          this.handleErrorEvent(errorEvent);
        }
      } catch (error) {
        console.error('Error parsing error event:', error, event);
      }
    });

    this.eventSource.onerror = (error) => {
      console.error('❌ SSE connection error:', error);
      console.error('EventSource readyState:', this.eventSource?.readyState);

      // Don't close connection on transient errors, only if backend is truly down
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.closeSSEConnection();
      }
    };
  }

  private closeSSEConnection(): void {
    if (this.eventSource) {
      console.log('🔌 Closing SSE connection');
      this.eventSource.close();
      this.eventSource = undefined;
    }
  }

  private handleProgressEvent(event: any): void {
    // Update workflow step based on stepType
    const stepMap: { [key: string]: number } = {
      'query_analysis': 0,
      'database_search': 1,
      'ai_analysis': 2,
      'response_generation': 3
    };

    const stepIndex = stepMap[event.stepType];
    if (stepIndex !== undefined) {
      // Mark previous steps as completed
      for (let i = 0; i < stepIndex; i++) {
        this.workflowSteps[i].status = 'completed';
      }
      // Mark current step as active
      this.workflowSteps[stepIndex].status = 'active';
      // Update description with detail if provided
      if (event.detail) {
        this.workflowSteps[stepIndex].description = event.message + ': ' + event.detail;
      } else {
        this.workflowSteps[stepIndex].description = event.message;
      }
      this.currentWorkflowStep = stepIndex;
      this.cdr.detectChanges();
    }
  }

  private handleCompleteEvent(event: any): void {
    // Mark all steps as completed
    this.workflowSteps.forEach(step => step.status = 'completed');
    this.closeSSEConnection();
    this.cdr.detectChanges();
  }

  private handleErrorEvent(event: any): void {
    // Mark current step as error
    if (this.currentWorkflowStep < this.workflowSteps.length) {
      this.workflowSteps[this.currentWorkflowStep].status = 'error';
    }
    this.aiThinking = false;
    this.isSearching = false;
    this.searchError = event.message || 'An error occurred during research';
    this.closeSSEConnection();
    this.cdr.detectChanges();
  }
}
