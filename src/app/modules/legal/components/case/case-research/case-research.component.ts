import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, throwError, TimeoutError } from 'rxjs';
import { takeUntil, timeout, catchError } from 'rxjs/operators';
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
import { UserService } from '../../../../../service/user.service';

// Conversation interface for multi-conversation support
interface Conversation {
  id: string; // Frontend UUID for local tracking
  title: string;
  sessionId: number; // Backend session ID
  createdAt: Date;
  lastUpdated: Date;
  messages: { role: 'user' | 'assistant'; content: string; timestamp: Date; isTyping?: boolean; collapsed?: boolean }[];
  followUpQuestions: string[];
}
import Swal from 'sweetalert2';
import { MarkdownToHtmlPipe } from '../../../pipes/markdown-to-html.pipe';
import { ApexChartDirective } from '../../../directives/apex-chart.directive';

@Component({
  selector: 'app-case-research',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownToHtmlPipe, ApexChartDirective],
  templateUrl: './case-research.component.html',
  styleUrls: ['./case-research.component.scss'],
  host: {
    '[style.display]': '"block"',
    '[style.visibility]': '"visible"',
    '[style.width]': '"100%"',
    '[style.min-height]': '"600px"'
  }
})
export class CaseResearchComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() caseId!: string;
  @Output() taskCreated = new EventEmitter<void>();

  // Current user from UserService
  currentUser: any = null;

  private destroy$ = new Subject<void>();

  searchQuery = '';
  searchType: 'all' | 'statutes' | 'rules' | 'regulations' | 'guidelines' = 'all';
  researchMode: 'fast' | 'thorough' = 'fast';  // Fast (15s) or Thorough (2-3min with case law search)
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
  actionLoadingAttempted: boolean = false; // Track if we attempted to load actions
  currentSessionId: number = 1; // TODO: Get from actual session

  // SSE for real-time progress
  private eventSource?: EventSource;
  private searchSessionId: string = '';
  private searchConversationId: string = ''; // Track which conversation initiated the search

  // Tool execution tracking (for THOROUGH mode visibility)
  toolsUsed: Array<{name: string, message: string, icon: string}> = [];

  // Scroll tracking for bottom search bar
  showBottomSearchBar: boolean = false;
  private scrollThreshold: number = 0.99; // Show after scrolling 10% (percentage-based, like IntersectionObserver)
  isConversationInView: boolean = false; // Track if conversation is visible in viewport
  private conversationObserver?: IntersectionObserver;
  private conversationScrollListener?: () => void;
  private observersSetup: boolean = false; // Prevent duplicate setup

  constructor(
    private legalResearchService: LegalResearchService,
    private researchActionService: ResearchActionService,
    private caseTaskService: CaseTaskService,
    private calendarService: CalendarService,
    private userService: UserService,
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef
  ) {}

  // Helper to get userId - returns current user ID or 0 if not authenticated
  get userId(): number {
    return this.currentUser?.id || 0;
  }

  ngOnInit(): void {
    // Get current user from UserService
    this.currentUser = this.userService.getCurrentUser();
    console.log('🔐 Current user on init:', this.currentUser);

    // Subscribe to user changes
    this.userService.userData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        if (user && user.id) {
          this.currentUser = user;
          console.log('🔐 User updated:', user.id);
          // Load conversations when user is available
          if (!this.conversations.length) {
            this.loadConversations();
          }
        }
      });

    // If we already have a user, load conversations immediately
    if (this.currentUser?.id) {
      this.loadConversations();
    }

    // Don't load pending actions on init to avoid duplicates
    // Actions will be generated fresh from each search

    // Force change detection to ensure component renders
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 1000);
  }

  ngAfterViewInit(): void {
    // Try to set up observers (may not exist yet if showChat is false)
    this.setupScrollObservers();
  }

  setupScrollObservers(): void {
    // Prevent duplicate setup
    if (this.observersSetup) {
      return;
    }

    // Find conversation element (only exists when showChat = true)
    const conversationElement = this.elementRef.nativeElement.querySelector('.chat-conversation');

    if (!conversationElement) {
      return;
    }

    this.observersSetup = true;

    // IntersectionObserver for viewport visibility
    this.conversationObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          this.isConversationInView = entry.isIntersecting;
          this.cdr.detectChanges();
        });
      },
      {
        root: null, // viewport
        threshold: 0.9 // Trigger when at least 90% of conversation is visible
      }
    );

    this.conversationObserver.observe(conversationElement);

    // Scroll listener for the conversation element's internal scroll
    this.conversationScrollListener = () => {
      const scrollTop = conversationElement.scrollTop;
      const scrollHeight = conversationElement.scrollHeight;
      const clientHeight = conversationElement.clientHeight;

      // Calculate scroll percentage (0.0 = top, 1.0 = bottom)
      const maxScroll = scrollHeight - clientHeight;
      const scrollPercentage = maxScroll > 0 ? scrollTop / maxScroll : 0;

      // Show bottom bar when scrolled past threshold (e.g., 10% down)
      this.showBottomSearchBar = scrollPercentage > this.scrollThreshold;
      this.cdr.detectChanges();
    };

    conversationElement.addEventListener('scroll', this.conversationScrollListener);
  }

  ngOnDestroy(): void {
    this.closeSSEConnection();
    this.destroy$.next();
    this.destroy$.complete();

    // Disconnect IntersectionObserver
    if (this.conversationObserver) {
      this.conversationObserver.disconnect();
    }

    // Remove conversation scroll listener
    const conversationElement = this.elementRef.nativeElement.querySelector('.chat-conversation');
    if (conversationElement && this.conversationScrollListener) {
      conversationElement.removeEventListener('scroll', this.conversationScrollListener);
    }
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

  // Chat History Management - now using backend persistence

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
    if (!this.userId) {
      console.warn('⚠️ Cannot load conversations - no user ID available');
      return;
    }

    console.log('💬 Loading conversations from backend for case:', this.caseId, 'userId:', this.userId);

    this.legalResearchService.getConversationsForCase(parseInt(this.caseId), this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sessions) => {
          console.log('✅ Loaded sessions from backend:', sessions);

          // Map backend sessions to frontend conversation format
          this.conversations = sessions.map(session => ({
            id: session.id!.toString(), // Use backend ID as string for frontend
            title: session.sessionName || 'Untitled Conversation',
            sessionId: session.id!,
            createdAt: session.createdAt ? new Date(session.createdAt) : new Date(),
            lastUpdated: session.lastInteractionAt ? new Date(session.lastInteractionAt) : new Date(),
            messages: [], // Messages will be loaded when conversation is activated
            followUpQuestions: []
          }));

          // If no conversations exist after loading, create the first one
          if (this.conversations.length === 0) {
            console.log('📝 No conversations found, creating first conversation');
            this.createNewConversation();
          } else {
            // Set active conversation to most recent if none set
            if (!this.activeConversationId) {
              this.activeConversationId = this.conversations[0].id;
              this.loadActiveConversation();
            } else if (this.activeConversationId) {
              this.loadActiveConversation();
            }
          }

          console.log('💬 Loaded conversations:', this.conversations.length);
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading conversations from backend:', error);
          this.conversations = [];
          this.activeConversationId = null;
          // Create first conversation on error as fallback
          this.createNewConversation();
        }
      });
  }

  loadActiveConversation(): void {
    const activeConv = this.conversations.find(c => c.id === this.activeConversationId);

    if (activeConv) {
      console.log('🔄 Loading active conversation from backend:', activeConv.sessionId);

      // Load messages from backend
      this.legalResearchService.getConversation(activeConv.sessionId, this.userId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (data) => {
            console.log('✅ Loaded conversation messages:', data.messages.length);

            // Map backend messages to frontend format
            this.chatMessages = data.messages.map(msg => ({
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
              timestamp: msg.createdAt ? new Date(msg.createdAt) : new Date(),
              isTyping: msg.isTyping,
              collapsed: msg.collapsed
            }));

            this.followUpQuestions = activeConv.followUpQuestions;
            this.currentSessionId = activeConv.sessionId;
            this.showChat = this.chatMessages.length > 0;

            console.log('✅ Loaded active conversation:', activeConv.title);

            // Load action suggestions from backend
            this.loadActionSuggestionsFromBackend();

            this.cdr.detectChanges();

            // Clean up old observers before setting up new ones (for conversation switching)
            if (this.conversationObserver) {
              this.conversationObserver.disconnect();
            }
            const oldConversationElement = this.elementRef.nativeElement.querySelector('.chat-conversation');
            if (oldConversationElement && this.conversationScrollListener) {
              oldConversationElement.removeEventListener('scroll', this.conversationScrollListener);
            }
            this.observersSetup = false; // Reset flag to allow new setup

            // Set up scroll observers if chat is showing
            if (this.showChat) {
              setTimeout(() => {
                this.setupScrollObservers();
              }, 100);
            }
          },
          error: (error) => {
            console.error('Error loading conversation messages:', error);
            // Fall back to empty state
            this.chatMessages = [];
            this.followUpQuestions = [];
            this.currentSessionId = activeConv.sessionId;
            this.showChat = false;
            this.cdr.detectChanges();
          }
        });
    }
  }

  loadActionSuggestionsFromBackend(): void {
    console.log('🔄 Loading action suggestions from backend for session:', this.currentSessionId);

    this.loadingActions = true;
    this.actionLoadingAttempted = true; // Mark that we attempted to load

    this.researchActionService.getSessionActions(this.currentSessionId).pipe(
      timeout(10000), // 10 second timeout for loading existing actions
      catchError(error => {
        if (error instanceof TimeoutError) {
          console.error('⏱️ Loading actions timed out after 10 seconds');
        }
        return throwError(() => error);
      })
    ).subscribe({
      next: (actions) => {
        console.log('✅ Loaded actions from backend:', actions);
        console.log('📑 Number of loaded actions:', actions?.length || 0);

        // Filter to only show PENDING actions (exclude COMPLETED and DISMISSED)
        const pendingActions = (actions || []).filter(a => a.actionStatus === 'PENDING');
        console.log('📑 Pending actions after filtering:', pendingActions.length);

        this.actionSuggestions = pendingActions;
        this.loadingActions = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Error loading actions from backend:', error);
        if (error instanceof TimeoutError) {
          console.error('⏱️ Request timed out loading existing actions');
        } else {
          console.error('Error details:', {
            message: error.message,
            status: error.status,
            statusText: error.statusText,
            url: error.url
          });
        }
        this.loadingActions = false;
        this.actionSuggestions = [];
        this.cdr.detectChanges(); // CRITICAL: Force UI update
      }
    });
  }

  saveConversations(): void {
    // Update title if needed - called after first user message is sent
    if (this.activeConversationId && this.caseId) {
      const activeConv = this.conversations.find(c => c.id === this.activeConversationId);
      const currentUserId = this.userId;

      console.log('🔍 saveConversations check:', {
        activeConvId: this.activeConversationId,
        activeConvTitle: activeConv?.title,
        chatMessagesCount: this.chatMessages.length,
        userId: currentUserId,
        sessionId: activeConv?.sessionId
      });

      // CRITICAL: Ensure we have a valid userId before attempting to update
      if (!currentUserId || currentUserId === 0) {
        console.error('❌ Cannot update title - no valid userId available');
        return;
      }

      // Check for both possible default titles: 'New Conversation' (when created) and 'Untitled Conversation' (when loaded from backend with null sessionName)
      if (activeConv && (!activeConv.title || activeConv.title === 'New Conversation' || activeConv.title === 'Untitled Conversation')) {
        const firstUserMsg = this.chatMessages.find(m => m.role === 'user');
        if (firstUserMsg) {
          const newTitle = this.generateConversationTitle(firstUserMsg.content);
          console.log('📝 Updating conversation title to:', newTitle, 'for sessionId:', activeConv.sessionId, 'userId:', currentUserId);

          // Retry mechanism for title update
          const retryTitleUpdate = (attempt: number) => {
            console.log(`📝 Title update attempt ${attempt} - sessionId: ${activeConv.sessionId}, userId: ${currentUserId}, newTitle: ${newTitle}`);

            this.legalResearchService.updateConversationTitle(activeConv.sessionId, currentUserId, newTitle)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (success) => {
                  if (success) {
                    console.log('✅ Title update succeeded on attempt', attempt);

                    // Update local conversation object
                    activeConv.title = newTitle;

                    // Also update the conversations array to ensure dropdown reflects the change
                    const convIndex = this.conversations.findIndex(c => c.id === this.activeConversationId);
                    if (convIndex !== -1) {
                      this.conversations[convIndex].title = newTitle;
                    }

                    console.log('✅ Updated conversation title:', newTitle);
                    this.cdr.detectChanges(); // Force UI refresh
                  } else {
                    console.warn('⚠️ Title update returned false on attempt', attempt);
                    if (attempt < 3) {
                      // Retry after a short delay
                      setTimeout(() => retryTitleUpdate(attempt + 1), 1000);
                    } else {
                      console.error('❌ Title update failed after 3 attempts');
                      // Still update local state
                      activeConv.title = newTitle;
                      this.cdr.detectChanges();
                    }
                  }
                },
                error: (error) => {
                  console.error(`❌ Error on attempt ${attempt}:`, error);
                  if (attempt < 3) {
                    // Retry after a short delay
                    setTimeout(() => retryTitleUpdate(attempt + 1), 1000);
                  } else {
                    console.error('❌ Title update failed after 3 attempts. Details - sessionId:', activeConv.sessionId, 'userId:', currentUserId);
                    // Update local state so user sees correct title
                    activeConv.title = newTitle;
                    this.cdr.detectChanges();
                  }
                }
              });
          };

          retryTitleUpdate(1);
        }
      }
    }
  }

  /**
   * Save a single message to the backend
   */
  saveMessageToBackend(role: 'user' | 'assistant', content: string): void {
    if (!this.activeConversationId) return;

    const activeConv = this.conversations.find(c => c.id === this.activeConversationId);
    if (!activeConv) return;

    this.legalResearchService.addMessageToSession(activeConv.sessionId, this.userId, role, content)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (message) => {
          console.log('✅ Saved message to backend:', message.id);
        },
        error: (error) => {
          console.error('❌ Error saving message to backend:', error);
        }
      });
  }

  createNewConversation(): void {
    if (!this.caseId) return;
    if (!this.userId) {
      console.warn('⚠️ Cannot create conversation - no user ID available');
      return;
    }

    console.log('🆕 Creating new conversation on backend for userId:', this.userId);

    // Create new session on backend
    this.legalResearchService.getOrCreateConversationSession(
      null, // No existing session ID
      this.userId,
      parseInt(this.caseId),
      'New Conversation'
    ).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          console.log('✅ Created new session on backend:', session.id);

          // Create frontend conversation object
          const newConv: Conversation = {
            id: session.id!.toString(),
            title: session.sessionName || 'New Conversation',
            sessionId: session.id!,
            createdAt: session.createdAt ? new Date(session.createdAt) : new Date(),
            lastUpdated: session.lastInteractionAt ? new Date(session.lastInteractionAt) : new Date(),
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

          this.cdr.detectChanges();

          console.log('🆕 Created new conversation:', newConv.id);
        },
        error: (error) => {
          console.error('❌ Error creating new conversation:', error);
          Swal.fire({
            title: 'Error',
            text: 'Failed to create new conversation',
            icon: 'error',
            timer: 3000
          });
        }
      });
  }

  switchConversation(conversationId: string): void {
    if (conversationId === this.activeConversationId) {
      this.showConversationList = false;
      return;
    }

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
        const conv = this.conversations.find(c => c.id === conversationId);
        if (!conv) return;

        // Delete from backend
        this.legalResearchService.deleteConversation(conv.sessionId, this.userId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (success) => {
              if (success) {
                // Remove conversation from local list
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

                Swal.fire({
                  title: 'Deleted!',
                  text: 'Conversation has been deleted.',
                  icon: 'success',
                  timer: 2000,
                  showConfirmButton: false
                });
              }
            },
            error: (error) => {
              console.error('Error deleting conversation:', error);
              Swal.fire({
                title: 'Error',
                text: 'Failed to delete conversation',
                icon: 'error',
                timer: 3000
              });
            }
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const dropdown = target.closest('.conversation-dropdown');

    // Close dropdown if clicking outside and it's currently open
    if (!dropdown && this.showConversationList) {
      this.showConversationList = false;
      this.cdr.detectChanges();
    }
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
    this.actionLoadingAttempted = false; // Reset for new search

    // Show chat immediately
    this.showChat = true;

    // Set up scroll observers after DOM updates
    setTimeout(() => {
      this.setupScrollObservers();
    }, 100);

    // Reset workflow steps and tool tracking
    this.currentWorkflowStep = 0;
    this.workflowSteps.forEach(step => step.status = 'pending');
    this.toolsUsed = []; // Clear tools list for new search

    // Generate unique session ID for SSE tracking
    this.searchSessionId = this.generateSessionId();
    // CRITICAL: Capture which conversation initiated this search
    this.searchConversationId = this.activeConversationId;
    console.log('🔍 Starting search with session ID:', this.searchSessionId, 'for conversation:', this.searchConversationId);

    // Connect to SSE for real-time progress updates
    this.connectToSSE(this.searchSessionId);

    // Add user message to chat
    const userMessage = {
      role: 'user' as const,
      content: this.searchQuery,
      timestamp: new Date()
    };
    this.chatMessages.push(userMessage);

    // Save user message to backend
    this.saveMessageToBackend('user', this.searchQuery);

    // Update conversation title if needed
    this.saveConversations();

    const searchRequest: LegalSearchRequest = {
      query: this.searchQuery,
      searchType: this.searchType,
      jurisdiction: 'MASSACHUSETTS',
      caseId: this.caseId,
      sessionId: this.searchSessionId,
      researchMode: this.researchMode.toUpperCase() as 'FAST' | 'THOROUGH',
      conversationHistory: this.getRecentConversationHistory()  // NEW: Include conversation context
    };

    // Clear search input after submitting
    this.searchQuery = '';

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
              } else if (response.aiAnalysis && response.aiAnalysis.trim().length > 0) {
                // Generate actions based on the query and AI analysis only if we have content
                this.generateActionSuggestionsFromAnalysis(this.searchQuery, response.aiAnalysis);
              } else {
                // No results and no AI analysis - mark as attempted but don't call API
                console.warn('⚠️ No search results and no AI analysis - skipping action generation');
                this.actionSuggestions = [];
                this.loadingActions = false;
                this.aiThinking = false;
                this.isSearching = false;
                this.actionLoadingAttempted = true;
                this.cdr.detectChanges();
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

    // Add message to UI immediately if we're viewing the conversation that initiated the search
    if (this.activeConversationId === this.searchConversationId) {
      this.chatMessages.push(message);
      console.log('✅ Added AI response to chatMessages for immediate display');
      this.cdr.detectChanges();
    } else {
      console.log('⚠️ User switched conversations - response will be loaded when they switch back');
    }

    // Also keep conversation object in sync
    const targetConversation = this.conversations.find(c => c.id === this.searchConversationId);
    if (targetConversation) {
      targetConversation.messages.push(message);
      targetConversation.lastUpdated = new Date();
    }

    this.aiThinking = false;
    this.isSearching = false;
    this.cdr.detectChanges();

    // Save AI message to backend
    this.saveMessageToBackend('assistant', cleanedMessage);
  }

  extractAndRemoveFollowUpQuestions(aiResponse: string): string {
    // Look for "Follow-up Questions" section in the markdown response
    // Support multiple header formats: ## Follow-up Questions, **Follow-up Questions**, ### Follow-up Questions
    const followUpPatterns = [
      /##\s*Follow-up Questions\s*\n([\s\S]*?)(?=\n##|$)/i,
      /###\s*Follow-up Questions\s*\n([\s\S]*?)(?=\n##|###|$)/i,
      /\*\*Follow-up Questions\*\*\s*:?\s*\n([\s\S]*?)(?=\n##|\n\*\*|$)/i,
      /Follow-up Questions:?\s*\n([\s\S]*?)(?=\n##|$)/i
    ];

    let match = null;
    let matchedPattern = null;

    for (const pattern of followUpPatterns) {
      match = aiResponse.match(pattern);
      if (match) {
        matchedPattern = pattern;
        console.log('📋 Found follow-up questions section with pattern:', pattern.source.substring(0, 30));
        break;
      }
    }

    if (match) {
      const questionsSection = match[1];
      console.log('📋 Questions section content:', questionsSection.substring(0, 200));

      // Extract questions from list items (- or 1., 2., etc. or • or *)
      const questionMatches = questionsSection.match(/[-•*]\s*(.+?)(?=\n[-•*]|\n\d+\.|\n\n|$)/g)
        || questionsSection.match(/\d+\.\s*(.+?)(?=\n\d+\.|\n\n|$)/g);

      if (questionMatches) {
        this.followUpQuestions = questionMatches
          .map(q => q.replace(/^[-•*\d.]\s*/, '').trim())
          .map(q => q.replace(/\*\*/g, '')) // Remove all ** (bold markdown)
          .map(q => q.replace(/^["']|["']$/g, '')) // Remove surrounding quotes
          .filter(q => q.length > 0)
          .filter(q => this.isValidFollowUpQuestion(q)) // Validate question quality
          .slice(0, 5); // Limit to 5 questions

        console.log('✅ Extracted follow-up questions:', this.followUpQuestions);
      } else {
        console.log('⚠️ No question list items found in section');
        this.followUpQuestions = [];
      }

      // Remove the entire "Follow-up Questions" section from the response
      return aiResponse.replace(matchedPattern!, '').trim();
    }

    console.log('⚠️ No follow-up questions section found in response');
    this.followUpQuestions = [];
    return aiResponse;
  }

  isValidFollowUpQuestion(question: string): boolean {
    // Reject questions under 40 characters (likely fragments)
    if (question.length < 40) {
      console.log(`❌ Rejected follow-up question (too short): "${question}"`);
      return false;
    }

    // Reject questions that are just punctuation or symbols
    const onlyPunctuation = /^[\s\-\.\?\!,;:]+$/;
    if (onlyPunctuation.test(question)) {
      console.log(`❌ Rejected follow-up question (only punctuation): "${question}"`);
      return false;
    }

    // Require questions to have action verbs or question words
    const hasQuestionIndicators = /\b(find|does|what|how|can|should|is|are|will|would|could|may|might|has|have|when|where|which|who|why)\b/i;
    if (!hasQuestionIndicators.test(question)) {
      console.log(`❌ Rejected follow-up question (no question indicators): "${question}"`);
      return false;
    }

    // Valid question
    return true;
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
    this.actionLoadingAttempted = true; // Mark that we attempted to load
    this.cdr.detectChanges();

    this.researchActionService.suggestActions(
      this.currentSessionId,
      this.userId,
      finding,
      citation,
      parseInt(this.caseId, 10)
    ).pipe(
      timeout(30000), // 30 second timeout
      catchError(error => {
        if (error instanceof TimeoutError) {
          console.error('⏱️ Action suggestions timed out after 30 seconds');
        }
        return throwError(() => error);
      })
    ).subscribe({
      next: (suggestions) => {
        console.log('✅ Action suggestions received:', suggestions);
        console.log('📑 Number of suggestions:', suggestions?.length || 0);
        console.log('🔍 Raw suggestions data:', JSON.stringify(suggestions, null, 2));

        // Replace with new suggestions (already cleared in performSearch)
        this.actionSuggestions = suggestions || [];
        this.loadingActions = false;
        this.aiThinking = false;
        this.isSearching = false;

        console.log('🔄 State after setting suggestions:', {
          actionSuggestions: this.actionSuggestions,
          length: this.actionSuggestions.length,
          loadingActions: this.loadingActions,
          aiThinking: this.aiThinking,
          isSearching: this.isSearching,
          actionLoadingAttempted: this.actionLoadingAttempted,
          chatMessages: this.chatMessages.length,
          lastMessage: this.chatMessages[this.chatMessages.length - 1],
          'lastMessage.role': this.chatMessages[this.chatMessages.length - 1]?.role,
          'lastMessage.isTyping': this.chatMessages[this.chatMessages.length - 1]?.isTyping
        });

        // Force UI update with a slight delay to ensure all state is updated
        this.cdr.detectChanges();
        setTimeout(() => {
          console.log('🔄 State 100ms after setting suggestions:', {
            actionSuggestions: this.actionSuggestions,
            length: this.actionSuggestions.length,
            loadingActions: this.loadingActions,
            lastMessageRole: this.chatMessages[this.chatMessages.length - 1]?.role,
            lastMessageIsTyping: this.chatMessages[this.chatMessages.length - 1]?.isTyping
          });
          this.cdr.detectChanges();
        }, 100);
      },
      error: (error) => {
        console.error('❌ Error generating action suggestions:', error);
        if (error instanceof TimeoutError) {
          console.error('⏱️ Request timed out - backend may be slow or unresponsive');
        } else {
          console.error('Error details:', {
            message: error.message,
            status: error.status,
            statusText: error.statusText,
            url: error.url
          });
        }
        this.actionSuggestions = []; // Ensure empty array on error
        this.loadingActions = false;
        this.aiThinking = false;
        this.isSearching = false;
        this.cdr.detectChanges(); // CRITICAL: Force UI update
      }
    });
  }

  generateActionSuggestionsFromAnalysis(query: string, aiAnalysis: string): void {
    // Extract a summary from the AI analysis to use as finding
    const finding = aiAnalysis.substring(0, 500).trim(); // First 500 chars
    const citation = `Research Query: ${query}`;

    console.log('🎯 generateActionSuggestionsFromAnalysis called with:', {
      sessionId: this.currentSessionId,
      userId: this.userId,
      caseId: this.caseId,
      query,
      finding: finding?.substring(0, 100),
      citation,
      findingLength: finding?.length,
      findingEmpty: !finding,
      citationEmpty: !citation
    });

    // Validate finding and citation
    if (!finding || finding.length === 0) {
      console.error('❌ Cannot generate actions: finding is empty');
      this.actionSuggestions = [];
      this.loadingActions = false;
      this.aiThinking = false;
      this.isSearching = false;
      this.actionLoadingAttempted = true;
      this.cdr.detectChanges();
      return;
    }

    this.loadingActions = true;
    this.actionLoadingAttempted = true; // Mark that we attempted to load
    this.cdr.detectChanges();

    this.researchActionService.suggestActions(
      this.currentSessionId,
      this.userId,
      finding,
      citation,
      parseInt(this.caseId, 10)
    ).pipe(
      timeout(30000), // 30 second timeout
      catchError(error => {
        if (error instanceof TimeoutError) {
          console.error('⏱️ Action suggestions from analysis timed out after 30 seconds');
        }
        return throwError(() => error);
      })
    ).subscribe({
      next: (suggestions) => {
        console.log('✅ Action suggestions from analysis received:', suggestions);
        console.log('📑 Number of suggestions:', suggestions?.length || 0);
        // Replace with new suggestions (already cleared in performSearch)
        this.actionSuggestions = suggestions || [];
        this.loadingActions = false;
        this.aiThinking = false;
        this.isSearching = false;
        this.cdr.detectChanges();
        console.log('🔄 actionSuggestions after set:', this.actionSuggestions);
      },
      error: (error) => {
        console.error('❌ Error generating action suggestions from analysis:', error);
        if (error instanceof TimeoutError) {
          console.error('⏱️ Request timed out - backend may be slow or unresponsive');
        } else {
          console.error('Error details:', {
            message: error.message,
            status: error.status,
            statusText: error.statusText,
            url: error.url,
            errorBody: error.error,
            fullError: JSON.stringify(error, null, 2)
          });

          // If it's a 400 error, the backend is rejecting our request
          if (error.status === 400) {
            console.error('🚨 400 Bad Request - Backend validation failed');
            console.error('Request was likely invalid. Check:');
            console.error('- finding/citation are not empty');
            console.error('- sessionId, userId, caseId are valid numbers');
            console.error('Backend error message:', error.error);
          }
        }
        this.actionSuggestions = []; // Ensure empty array on error
        this.loadingActions = false;
        this.aiThinking = false;
        this.isSearching = false;
        this.cdr.detectChanges(); // CRITICAL: Force UI update
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
    console.log('🎯 createTask() called for action:', action.id);
    console.log('📋 Action has caseId:', action.caseId);

    // Use simple fallback title immediately to show modal fast
    const fallbackTitle = this.generateShortTitle(action.taskDescription);

    Swal.fire({
      title: '<span class="text-primary"><i class="ri-task-line me-2"></i>Create Task</span>',
      html: `
        <div class="text-start">
          <div class="alert alert-info border-0 mb-3" role="alert">
            <div class="d-flex">
              <div class="flex-shrink-0 me-3">
                <i class="ri-information-line fs-16"></i>
              </div>
              <div class="flex-grow-1">
                <h5 class="alert-heading fs-14 mb-1">AI Suggestion</h5>
                <p class="mb-0">${action.taskDescription}</p>
              </div>
            </div>
          </div>

          <div class="mb-3">
            <label class="form-label">
              Task Title <span class="text-danger">*</span>
              <span id="titleLoadingIndicator" class="ms-2" style="display: inline;">
                <span class="spinner-border spinner-border-sm text-primary" role="status">
                  <span class="visually-hidden">Generating...</span>
                </span>
                <small class="text-muted ms-1">AI generating...</small>
              </span>
            </label>
            <input id="taskTitle" class="form-control" value="${fallbackTitle}" placeholder="Enter task title">
          </div>

          <div class="row">
            <div class="col-md-6">
              <div class="mb-3">
                <label class="form-label">Task Type <span class="text-danger">*</span></label>
                <select id="taskType" class="form-select">
                  <option value="RESEARCH">Research</option>
                  <option value="DOCUMENT_REVIEW">Document Review</option>
                  <option value="COURT_APPEARANCE">Court Appearance</option>
                  <option value="CLIENT_MEETING">Client Meeting</option>
                  <option value="FILING">Filing</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
            <div class="col-md-6">
              <div class="mb-3">
                <label class="form-label">Priority <span class="text-danger">*</span></label>
                <select id="taskPriority" class="form-select">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM" selected>Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>
          </div>

          <div class="mb-3">
            <label class="form-label">Due Date</label>
            <input id="taskDueDate" type="text" class="form-control" placeholder="Select date">
          </div>
        </div>
      `,
      width: '600px',
      showCancelButton: true,
      confirmButtonText: '<i class="ri-check-line me-1"></i> Create Task',
      cancelButtonText: '<i class="ri-close-line me-1"></i> Cancel',
      customClass: {
        confirmButton: 'btn btn-primary me-2',
        cancelButton: 'btn btn-soft-secondary'
      },
      buttonsStyling: false,
      didOpen: async () => {
        // Initialize flatpickr for due date
        const dateInput = document.getElementById('taskDueDate') as HTMLInputElement;
        if (dateInput) {
          (window as any).flatpickr(dateInput, {
            dateFormat: 'Y-m-d',
            altInput: true,
            altFormat: 'F j, Y',
            allowInput: true
          });
        }

        // Generate AI title in background after modal opens
        const titleInput = document.getElementById('taskTitle') as HTMLInputElement;
        const loadingIndicator = document.getElementById('titleLoadingIndicator');

        if (titleInput && loadingIndicator) {
          try {
            const aiTitle = await this.generateAITitle(action.taskDescription);
            titleInput.value = aiTitle;

            // Show success indicator
            loadingIndicator.innerHTML = '<i class="ri-check-line text-success"></i><small class="text-success ms-1">Generated</small>';

            // Hide after 2 seconds
            setTimeout(() => {
              loadingIndicator.style.display = 'none';
            }, 2000);
          } catch (error) {
            console.error('Failed to generate AI title:', error);
            loadingIndicator.innerHTML = '<i class="ri-error-warning-line text-warning"></i><small class="text-warning ms-1">Manual entry</small>';
          }
        }
      },
      preConfirm: () => {
        const title = (document.getElementById('taskTitle') as HTMLInputElement).value;
        const taskType = (document.getElementById('taskType') as HTMLSelectElement).value;
        const priority = (document.getElementById('taskPriority') as HTMLSelectElement).value;
        const dueDate = (document.getElementById('taskDueDate') as HTMLInputElement).value;

        if (!title.trim()) {
          Swal.showValidationMessage('Task title is required');
          return false;
        }

        return { title, taskType, priority, dueDate };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const taskData = {
          caseId: parseInt(this.caseId),
          title: result.value.title,
          description: action.sourceFinding,
          taskType: result.value.taskType as TaskType,
          priority: result.value.priority as TaskPriority,
          dueDate: result.value.dueDate ? new Date(result.value.dueDate) : undefined
        };

        const executeData = {
          actionType: 'CREATE_TASK',
          title: result.value.title,
          description: this.stripMarkdown(action.taskDescription),
          taskType: result.value.taskType,
          priority: result.value.priority,
          dueDate: result.value.dueDate || null,
          assignedToId: null
        };

        console.log('⚡ Executing action atomically');
        console.log('📋 Action details:', {
          id: action.id,
          caseId: action.caseId,
          type: action.actionType
        });
        console.log('📋 Execute data:', executeData);

        this.researchActionService.executeAction(action.id, executeData).subscribe({
          next: (response) => {
            console.log('✅ Action executed successfully:', response);

            const createdTask = response.data.result;
            console.log('✅ Task created with ID:', createdTask.id);
            console.log('✅ Action', response.data.actionId, 'marked as completed');

            // Show success message immediately
            Swal.fire({
              title: 'Success!',
              html: `Task "${createdTask.title}" created!<br><small class="text-muted">ID: ${createdTask.id} | Check Team tab</small>`,
              icon: 'success',
              timer: 2500,
              showConfirmButton: false
            });

            // Remove from UI immediately (already completed on backend)
            this.actionSuggestions = this.actionSuggestions.filter(a => a.id !== action.id);
            this.cdr.detectChanges();

            // Notify parent to refresh tasks (non-blocking)
            setTimeout(() => this.taskCreated.emit(), 0);
          },
          error: (error) => {
            console.error('❌ Action execution failed:', error);
            console.error('❌ Error details:', {
              status: error.status,
              message: error.error?.message || error.message,
              error: error.error
            });
            Swal.fire({
              title: 'Failed',
              html: `<div class="text-start">
                <p class="mb-2">${error.error?.message || 'Failed to create task. Please try again.'}</p>
                <small class="text-muted">Status: ${error.status || 'Unknown'}</small>
              </div>`,
              icon: 'error',
              confirmButtonText: 'OK'
            });
          }
        });
      }
    });
  }

  private stripMarkdown(text: string): string {
    if (!text) return '';

    return text
      // Remove headers (##, ###, etc.)
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic (**text**, *text*)
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      // Remove links [text](url)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove code blocks ```
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code `text`
      .replace(/`([^`]+)`/g, '$1')
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  private generateShortTitle(description: string): string {
    // Strip markdown first
    const cleaned = this.stripMarkdown(description);

    if (cleaned.length <= 60) {
      return cleaned;
    }

    // Try to extract first sentence
    const firstSentence = cleaned.split(/[.!?]/)[0];
    if (firstSentence.length <= 60 && firstSentence.length > 10) {
      return firstSentence;
    }

    // Truncate at word boundary
    const truncated = cleaned.substring(0, 60);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > 40) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  private async generateAITitle(description: string): Promise<string> {
    try {
      const response = await this.researchActionService.generateTitle(description).toPromise();
      return response.title || this.generateShortTitle(description);
    } catch (error) {
      console.error('Failed to generate AI title:', error);
      return this.generateShortTitle(description);
    }
  }

  private createDeadline(action: ResearchActionItem): void {
    console.log('🎯 createDeadline() called for action:', action.id);

    // Use simple fallback title immediately to show modal fast
    const fallbackTitle = this.generateShortTitle(action.taskDescription);

    Swal.fire({
      title: '<span class="text-danger"><i class="ri-calendar-event-line me-2"></i>Create Deadline</span>',
      html: `
        <div class="text-start">
          <div class="alert alert-danger border-0 mb-3" role="alert">
            <div class="d-flex">
              <div class="flex-shrink-0 me-3">
                <i class="ri-alarm-warning-line fs-16"></i>
              </div>
              <div class="flex-grow-1">
                <h5 class="alert-heading fs-14 mb-1">AI Suggestion</h5>
                <p class="mb-0">${action.taskDescription}</p>
              </div>
            </div>
          </div>

          <div class="mb-3">
            <label class="form-label">
              Deadline Title <span class="text-danger">*</span>
              <span id="deadlineTitleLoadingIndicator" class="ms-2" style="display: inline;">
                <span class="spinner-border spinner-border-sm text-danger" role="status">
                  <span class="visually-hidden">Generating...</span>
                </span>
                <small class="text-muted ms-1">AI generating...</small>
              </span>
            </label>
            <input id="deadlineTitle" class="form-control" value="${fallbackTitle}" placeholder="Enter deadline title">
          </div>

          <div class="mb-3">
            <label class="form-label">Date & Time <span class="text-danger">*</span></label>
            <input id="deadlineDate" type="text" class="form-control" placeholder="Select date and time">
          </div>
        </div>
      `,
      width: '600px',
      showCancelButton: true,
      confirmButtonText: '<i class="ri-check-line me-1"></i> Create Deadline',
      cancelButtonText: '<i class="ri-close-line me-1"></i> Cancel',
      customClass: {
        confirmButton: 'btn btn-danger me-2',
        cancelButton: 'btn btn-soft-secondary'
      },
      buttonsStyling: false,
      didOpen: async () => {
        // Initialize flatpickr for deadline date with time
        const dateInput = document.getElementById('deadlineDate') as HTMLInputElement;
        if (dateInput) {
          (window as any).flatpickr(dateInput, {
            enableTime: true,
            dateFormat: 'Y-m-d\\TH:i:S',
            altInput: true,
            altFormat: 'F j, Y at h:i K',
            time_24hr: false,
            allowInput: true
          });
        }

        // Generate AI title in background after modal opens
        const titleInput = document.getElementById('deadlineTitle') as HTMLInputElement;
        const loadingIndicator = document.getElementById('deadlineTitleLoadingIndicator');

        if (titleInput && loadingIndicator) {
          try {
            const aiTitle = await this.generateAITitle(action.taskDescription);
            titleInput.value = aiTitle;

            // Show success indicator
            loadingIndicator.innerHTML = '<i class="ri-check-line text-success"></i><small class="text-success ms-1">Generated</small>';

            // Hide after 2 seconds
            setTimeout(() => {
              loadingIndicator.style.display = 'none';
            }, 2000);
          } catch (error) {
            console.error('Failed to generate AI title:', error);
            loadingIndicator.innerHTML = '<i class="ri-error-warning-line text-warning"></i><small class="text-warning ms-1">Manual entry</small>';
          }
        }
      },
      preConfirm: () => {
        const title = (document.getElementById('deadlineTitle') as HTMLInputElement).value;
        const date = (document.getElementById('deadlineDate') as HTMLInputElement).value;

        if (!title.trim()) {
          Swal.showValidationMessage('Deadline title is required');
          return false;
        }

        if (!date) {
          Swal.showValidationMessage('Date and time are required');
          return false;
        }

        return { title, date };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const executeData = {
          actionType: 'CREATE_DEADLINE',
          title: result.value.title,
          description: this.stripMarkdown(action.taskDescription),
          eventDate: result.value.date,
          eventType: 'DEADLINE'
        };

        const deadlineTitle = executeData.title;

        // Show success message IMMEDIATELY (before API call)
        Swal.fire({
          title: 'Success!',
          html: `Deadline "${deadlineTitle}" created!<br><small class="text-muted">Check Events tab</small>`,
          icon: 'success',
          timer: 2500,
          showConfirmButton: false
        });

        console.log('⚡ Executing deadline creation atomically:', executeData);

        // Execute API call in background
        this.researchActionService.executeAction(action.id, executeData).subscribe({
          next: (response) => {
            console.log('✅ Deadline created successfully:', response);

            // Remove from UI
            this.actionSuggestions = this.actionSuggestions.filter(a => a.id !== action.id);
            this.cdr.detectChanges();

            // Notify parent to refresh events (non-blocking)
            setTimeout(() => this.taskCreated.emit(), 0);
          },
          error: (error) => {
            console.error('❌ Deadline creation failed:', error);
            Swal.fire({
              title: 'Failed',
              text: error.error?.message || 'Failed to create deadline. Please try again.',
              icon: 'error',
              confirmButtonText: 'OK'
            });
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
    const fallbackTitle = this.generateShortTitle(action.taskDescription);

    Swal.fire({
      title: '<span class="text-primary"><i class="ri-sticky-note-line me-2"></i>Add Case Note</span>',
      html: `
        <div class="text-start">
          <div class="alert alert-info border-0 mb-3" role="alert">
            <div class="d-flex">
              <div class="flex-shrink-0 me-3">
                <i class="ri-information-line fs-16"></i>
              </div>
              <div class="flex-grow-1">
                <h5 class="alert-heading fs-14 mb-1">AI Suggestion</h5>
                <p class="mb-0">${action.taskDescription}</p>
              </div>
            </div>
          </div>

          <div class="mb-3">
            <label class="form-label">
              Note Title <span class="text-danger">*</span>
              <span id="noteTitleLoadingIndicator" class="ms-2" style="display: inline;">
                <span class="spinner-border spinner-border-sm text-primary" role="status"></span>
                <small class="text-muted ms-1">AI generating...</small>
              </span>
            </label>
            <input id="noteTitle" class="form-control" value="${fallbackTitle}" placeholder="Enter note title">
          </div>

          <div class="mb-3">
            <label class="form-label">Note Content <span class="text-danger">*</span></label>
            <textarea id="noteContent" class="form-control" rows="4" placeholder="Enter note content">${this.stripMarkdown(action.taskDescription)}</textarea>
          </div>
        </div>
      `,
      width: '600px',
      showCancelButton: true,
      confirmButtonText: '<i class="ri-check-line me-1"></i> Create Note',
      cancelButtonText: '<i class="ri-close-line me-1"></i> Cancel',
      customClass: {
        confirmButton: 'btn btn-primary me-2',
        cancelButton: 'btn btn-soft-secondary'
      },
      buttonsStyling: false,
      didOpen: async () => {
        const titleInput = document.getElementById('noteTitle') as HTMLInputElement;
        const loadingIndicator = document.getElementById('noteTitleLoadingIndicator');

        if (titleInput && loadingIndicator) {
          try {
            const aiTitle = await this.generateAITitle(action.taskDescription);
            titleInput.value = aiTitle;
            loadingIndicator.innerHTML = '<i class="ri-check-line text-success"></i><small class="text-success ms-1">Generated</small>';
            setTimeout(() => loadingIndicator.style.display = 'none', 2000);
          } catch (error) {
            loadingIndicator.innerHTML = '<i class="ri-error-warning-line text-warning"></i><small class="text-warning ms-1">Manual entry</small>';
          }
        }
      },
      preConfirm: () => {
        const title = (document.getElementById('noteTitle') as HTMLInputElement).value;
        const content = (document.getElementById('noteContent') as HTMLTextAreaElement).value;

        if (!title.trim()) {
          Swal.showValidationMessage('Note title is required');
          return false;
        }

        if (!content.trim()) {
          Swal.showValidationMessage('Note content is required');
          return false;
        }

        return { title, content };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const executeData = {
          actionType: 'ADD_NOTE',
          title: result.value.title,
          description: result.value.content
        };

        // Show success immediately
        Swal.fire({
          title: 'Success!',
          html: `Note "${result.value.title}" created!<br><small class="text-muted">Check Notes tab</small>`,
          icon: 'success',
          timer: 2500,
          showConfirmButton: false
        });

        // Execute API call in background
        this.researchActionService.executeAction(action.id, executeData).subscribe({
          next: (response) => {
            console.log('✅ Note created successfully:', response);
            this.actionSuggestions = this.actionSuggestions.filter(a => a.id !== action.id);
            this.cdr.detectChanges();
            setTimeout(() => this.taskCreated.emit(), 0);
          },
          error: (error) => {
            console.error('❌ Note creation failed:', error);
            Swal.fire({
              title: 'Failed',
              text: error.error?.message || 'Failed to create note. Please try again.',
              icon: 'error',
              confirmButtonText: 'OK'
            });
          }
        });
      }
    });
  }

  private scheduleEvent(action: ResearchActionItem): void {
    this.createDeadline(action); // Reuse deadline logic for events
  }

  private markActionCompleted(action: ResearchActionItem): void {
    console.log('🎯 Marking action as completed:', action.id);

    this.researchActionService.completeAction(action.id).subscribe({
      next: () => {
        console.log('✅ Action marked as completed on backend, removing from UI');
        this.actionSuggestions = this.actionSuggestions.filter(a => a.id !== action.id);
        console.log('📑 Remaining actions:', this.actionSuggestions.length);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Error marking action as completed:', error);
        console.error('❌ Action will remain visible. Error details:', {
          actionId: action.id,
          status: error.status,
          message: error.error?.message || error.message
        });
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
    const confidenceIcon = confidencePercent >= 80 ? 'check-double-line' : confidencePercent >= 60 ? 'information-line' : 'alert-line';

    // Build priority badge with proper Velzon colors
    let prioritySection = '';
    if (action.taskPriority) {
      let priorityClass = '';
      let priorityIcon = '';

      switch (action.taskPriority) {
        case 'URGENT':
          priorityClass = 'danger';
          priorityIcon = 'alarm-warning-line';
          break;
        case 'HIGH':
          priorityClass = 'warning';
          priorityIcon = 'error-warning-line';
          break;
        case 'MEDIUM':
          priorityClass = 'info';
          priorityIcon = 'information-line';
          break;
        case 'LOW':
          priorityClass = 'success';
          priorityIcon = 'checkbox-circle-line';
          break;
        default:
          priorityClass = 'secondary';
          priorityIcon = 'information-line';
      }

      prioritySection = `
        <div class="text-center mb-3">
          <span class="badge bg-${priorityClass}-subtle text-${priorityClass} fs-13 px-3 py-2">
            <i class="ri-${priorityIcon} align-middle me-1"></i>
            ${action.taskPriority} PRIORITY
          </span>
        </div>
      `;
    }

    // Get action-specific colors
    const actionColors = this.getActionColors(action.actionType);

    // Build simple Velzon-themed HTML content
    const htmlContent = `
      <div class="text-start">
        ${prioritySection}

        ${action.taskDescription ? `
          <div class="mb-3">
            <label class="form-label fw-semibold text-muted">Task Description</label>
            <div class="border rounded p-3 bg-light">
              <p class="mb-0">${action.taskDescription}</p>
            </div>
          </div>
        ` : ''}

        ${action.aiConfidenceScore ? `
          <div class="mb-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <label class="form-label fw-semibold text-muted mb-0">AI Confidence</label>
              <span class="badge bg-${confidenceColor}">${confidencePercent.toFixed(0)}%</span>
            </div>
            <div class="progress">
              <div class="progress-bar bg-${confidenceColor}" role="progressbar" style="width: ${confidencePercent}%;"
                   aria-valuenow="${confidencePercent}" aria-valuemin="0" aria-valuemax="100"></div>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // Show SweetAlert modal following app's standard style
    Swal.fire({
      title: this.getActionLabel(action.actionType),
      html: htmlContent,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Accept & Create',
      cancelButtonText: 'Dismiss',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        // Just open the form modal - success will be shown after task is created
        this.acceptAction(action);
      }
    });
  }

  getActionColors(actionType: string): { main: string; light: string; lighter: string; dark: string; shadow: string } {
    switch (actionType) {
      case 'DRAFT_MOTION':
        return {
          main: '#405189',
          light: 'rgba(64, 81, 137, 0.1)',
          lighter: 'rgba(64, 81, 137, 0.05)',
          dark: '#2a3557',
          shadow: 'rgba(64, 81, 137, 0.15)'
        };
      case 'CREATE_DEADLINE':
        return {
          main: '#f06548',
          light: 'rgba(240, 101, 72, 0.1)',
          lighter: 'rgba(240, 101, 72, 0.05)',
          dark: '#c54e38',
          shadow: 'rgba(240, 101, 72, 0.15)'
        };
      case 'CREATE_TASK':
        return {
          main: '#0ab39c',
          light: 'rgba(10, 179, 156, 0.1)',
          lighter: 'rgba(10, 179, 156, 0.05)',
          dark: '#088f7c',
          shadow: 'rgba(10, 179, 156, 0.15)'
        };
      case 'ADD_NOTE':
        return {
          main: '#f7b84b',
          light: 'rgba(247, 184, 75, 0.1)',
          lighter: 'rgba(247, 184, 75, 0.05)',
          dark: '#c6933c',
          shadow: 'rgba(247, 184, 75, 0.15)'
        };
      default:
        return {
          main: '#878a99',
          light: 'rgba(135, 138, 153, 0.1)',
          lighter: 'rgba(135, 138, 153, 0.05)',
          dark: '#6c6e7a',
          shadow: 'rgba(135, 138, 153, 0.15)'
        };
    }
  }

  // Accept action and create task/deadline/etc
  acceptAction(action: ResearchActionItem): void {
    this.executeAction(action);
  }

  // Debug helper to log template conditions
  shouldShowActions(isLast: boolean, messageRole: string, messageIsTyping: boolean): boolean {
    const result = isLast &&
                   messageRole === 'assistant' &&
                   this.actionSuggestions.length > 0 &&
                   !messageIsTyping &&
                   !this.loadingActions;

    console.log('🔍 shouldShowActions check:', {
      isLast,
      messageRole,
      'messageRole === assistant': messageRole === 'assistant',
      messageIsTyping,
      'actionSuggestions.length': this.actionSuggestions.length,
      'actionSuggestions.length > 0': this.actionSuggestions.length > 0,
      loadingActions: this.loadingActions,
      result,
      actionSuggestions: this.actionSuggestions
    });

    return result;
  }

  // SSE Methods for real-time progress updates
  private generateSessionId(): string {
    return `search_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Get recent conversation history to send as context with search request.
   * Returns the last 10 messages (5 user+assistant pairs) to avoid token bloat.
   */
  private getRecentConversationHistory(): any[] {
    // CRITICAL FIX: Get messages from active conversation (source of truth)
    // instead of relying on this.chatMessages reference which can be stale
    const activeConv = this.conversations.find(c => c.id === this.activeConversationId);

    if (!activeConv || !activeConv.messages) {
      console.warn('⚠️ No active conversation found for history - sending empty history');
      return [];
    }

    // Get only the last 10 messages (excluding the current user message being sent)
    // The current user message is at the end, so we get messages from -11 to -1
    const recentMessages = activeConv.messages.slice(-11, -1);

    console.log('📤 Sending conversation history:', {
      activeConvId: this.activeConversationId,
      totalMessagesInConv: activeConv.messages.length,
      historyMessageCount: recentMessages.length,
      historyPreview: recentMessages.slice(0, 2).map(m => ({
        role: m.role,
        contentPreview: m.content.substring(0, 50) + '...'
      }))
    });

    // Convert to format expected by backend
    return recentMessages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp.toISOString()
    }));
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
        console.log('📑 Parsed SSE data:', data);
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    this.eventSource.addEventListener('progress', (event: MessageEvent) => {
      try {
        const progressEvent = JSON.parse(event.data);
        console.log('📑 Progress event:', progressEvent);
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
    } else if (event.stepType === 'tool_execution') {
      // Capture tool execution details for THOROUGH mode
      this.toolsUsed.push({
        name: event.message || 'Tool',
        message: event.detail || event.message || 'Executing tool',
        icon: event.icon || 'ri-tools-line'
      });
      console.log('🔧 Tool captured:', this.toolsUsed[this.toolsUsed.length - 1]);
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
