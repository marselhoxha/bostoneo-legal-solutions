import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subject, lastValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LegalResearchService } from '../../../services/legal-research.service';
import { MarkdownToHtmlPipe } from '../../../pipes/markdown-to-html.pipe';
import { ApexChartDirective } from '../../../directives/apex-chart.directive';
import { UserService } from '../../../../../service/user.service';
import { environment } from '@environments/environment';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-ai-workspace',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule, MarkdownToHtmlPipe, ApexChartDirective],
  templateUrl: './ai-workspace.component.html',
  styleUrls: ['./ai-workspace.component.scss']
})
export class AiWorkspaceComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Timeout/Interval tracking for cleanup
  private activeTimeouts: number[] = [];
  private activeIntervals: number[] = [];

  // Timing constants
  private readonly STEP_DELAY = 2000;
  private readonly TYPING_DELAY = 1500;
  private readonly RESPONSE_DELAY = 3000;

  // Conversation state
  showChat = false;
  showBottomSearchBar = false;
  isGenerating = false;
  currentStep = 1;
  selectedDocumentType: 'interrogatories' | 'motion' | 'brief' | '' = '';
  draftingMode = false; // Split-view mode when document is being edited

  // Workflow steps with dynamic status tracking
  workflowSteps: Array<{
    id: number;
    icon: string;
    description: string;
    status: 'pending' | 'active' | 'completed' | 'error';
  }> = [];

  // Workflow step templates for different task types
  private workflowStepTemplates = {
    question: [
      { id: 1, icon: 'ri-search-2-line', description: 'Analyzing legal question...', status: 'pending' as const },
      { id: 2, icon: 'ri-scales-3-line', description: 'Searching case law...', status: 'pending' as const },
      { id: 3, icon: 'ri-book-open-line', description: 'Reviewing statutes...', status: 'pending' as const },
      { id: 4, icon: 'ri-file-text-line', description: 'Generating response...', status: 'pending' as const }
    ],
    draft: [
      { id: 1, icon: 'ri-file-search-line', description: 'Analyzing requirements...', status: 'pending' as const },
      { id: 2, icon: 'ri-search-line', description: 'Retrieving precedents...', status: 'pending' as const },
      { id: 3, icon: 'ri-book-line', description: 'Applying legal standards...', status: 'pending' as const },
      { id: 4, icon: 'ri-file-edit-line', description: 'Drafting document...', status: 'pending' as const }
    ],
    summarize: [
      { id: 1, icon: 'ri-file-search-line', description: 'Reading case materials...', status: 'pending' as const },
      { id: 2, icon: 'ri-organization-chart', description: 'Identifying key facts...', status: 'pending' as const },
      { id: 3, icon: 'ri-scales-3-line', description: 'Extracting legal issues...', status: 'pending' as const },
      { id: 4, icon: 'ri-file-list-3-line', description: 'Creating summary...', status: 'pending' as const }
    ],
    upload: [
      { id: 1, icon: 'ri-file-upload-line', description: 'Processing document...', status: 'pending' as const },
      { id: 2, icon: 'ri-search-eye-line', description: 'Analyzing content...', status: 'pending' as const },
      { id: 3, icon: 'ri-shield-check-line', description: 'Identifying risks...', status: 'pending' as const },
      { id: 4, icon: 'ri-file-list-3-line', description: 'Generating analysis...', status: 'pending' as const }
    ]
  };

  // Conversation management - Load from backend
  conversations: Array<{
    id: string;
    title: string;
    date: Date;
    type: 'question' | 'draft' | 'summarize' | 'upload';
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp?: Date;
      documentGenerated?: boolean;
      documentId?: string; // Changed to string to match DocumentGeneration UUID
    }>;
    messageCount?: number; // Message count from backend for badge display
    jurisdiction?: string;
    documentType?: string;
    sessionId?: number; // Link to DraftingSession
    backendConversationId?: number; // Link to ResearchConversation (for Q&A)
    researchMode?: string; // FAST, AUTO, THOROUGH
    taskType?: string; // LEGAL_QUESTION, GENERATE_DRAFT, SUMMARIZE_CASE, ANALYZE_DOCUMENT
    documentId?: number; // Document ID for ANALYZE_DOCUMENT tasks
    relatedDraftId?: string; // Draft ID for related drafting tasks
  }> = [];

  activeConversationId: string | null = null;
  conversationSearchQuery = '';

  // Grouped conversations for UI display
  groupedConversations: {
    past90Days: any[];
    older: any[];
  } = {
    past90Days: [],
    older: []
  };

  // Filtered conversations based on search query
  get filteredConversations() {
    if (!this.conversationSearchQuery.trim()) {
      return this.conversations;
    }

    const query = this.conversationSearchQuery.toLowerCase();
    return this.conversations.filter(conv =>
      conv.title.toLowerCase().includes(query)
    );
  }

  // Conversation messages (current active conversation)
  conversationMessages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: Date;
    documentGenerated?: boolean;
    documentId?: string; // Changed to string to match DocumentGeneration UUID
  }> = [];

  // User input
  customPrompt = '';
  followUpMessage = '';

  // Follow-up questions
  followUpQuestions: string[] = [];

  // Jurisdiction
  selectedJurisdiction = 'Federal';
  jurisdictions = ['Federal', 'Ontario', 'California', 'New York', 'Texas', 'Florida'];

  // Document editor modal
  editorModalOpen = false;
  editorDocumentId = '';
  editorDocumentTitle = '';
  editorDocumentContent = '';

  // Split-view drafting mode state
  activeDocumentTitle = 'Generated Document';
  activeDocumentContent = '';
  currentDocumentWordCount = 0;
  currentDate = new Date();

  // Recent drafts
  recentDrafts: any[] = [];
  loadingDrafts = false;

  // Current user from authentication service
  currentUser: any = null;

  // Mobile sidebar state
  sidebarOpen = false;

  // Practice areas for filtering
  practiceAreas = [
    { id: 'all', name: 'All Practice Areas', icon: 'ri-layout-grid-line' },
    { id: 'civil', name: 'Civil Litigation', icon: 'ri-scales-3-line' },
    { id: 'criminal', name: 'Criminal Defense', icon: 'ri-shield-star-line' },
    { id: 'family', name: 'Family Law', icon: 'ri-team-line' },
    { id: 'corporate', name: 'Corporate', icon: 'ri-building-line' },
    { id: 'real-estate', name: 'Real Estate', icon: 'ri-home-4-line' },
    { id: 'employment', name: 'Employment', icon: 'ri-briefcase-line' }
  ];

  selectedPracticeArea = 'all';
  showTemplateFilters = false;

  // Document types
  documentTypes = [
    // Discovery Documents
    {
      id: 'interrogatories',
      name: 'Interrogatories',
      description: 'Generate discovery interrogatories with AI assistance',
      icon: 'ri-question-line',
      color: 'primary',
      category: 'Discovery',
      practiceAreas: ['civil', 'criminal', 'employment'],
      popular: true
    },
    {
      id: 'requests-production',
      name: 'Requests for Production',
      description: 'Draft document production requests',
      icon: 'ri-file-list-3-line',
      color: 'primary',
      category: 'Discovery',
      practiceAreas: ['civil', 'employment'],
      popular: false
    },
    {
      id: 'requests-admission',
      name: 'Requests for Admission',
      description: 'Create requests for admission of facts',
      icon: 'ri-checkbox-multiple-line',
      color: 'primary',
      category: 'Discovery',
      practiceAreas: ['civil'],
      popular: false
    },
    // Motions
    {
      id: 'motion-dismiss',
      name: 'Motion to Dismiss',
      description: 'Draft motions with legal research and precedents',
      icon: 'ri-file-text-line',
      color: 'success',
      category: 'Motions',
      practiceAreas: ['civil', 'criminal'],
      popular: true
    },
    {
      id: 'motion-summary-judgment',
      name: 'Motion for Summary Judgment',
      description: 'Prepare summary judgment motions',
      icon: 'ri-gavel-line',
      color: 'success',
      category: 'Motions',
      practiceAreas: ['civil'],
      popular: true
    },
    {
      id: 'motion-suppress',
      name: 'Motion to Suppress',
      description: 'Draft motions to suppress evidence',
      icon: 'ri-file-shield-line',
      color: 'success',
      category: 'Motions',
      practiceAreas: ['criminal'],
      popular: false
    },
    // Pleadings
    {
      id: 'complaint',
      name: 'Complaint',
      description: 'Draft civil complaints with causes of action',
      icon: 'ri-file-edit-line',
      color: 'warning',
      category: 'Pleadings',
      practiceAreas: ['civil', 'employment'],
      popular: true
    },
    {
      id: 'answer',
      name: 'Answer',
      description: 'Prepare answers to complaints',
      icon: 'ri-file-copy-2-line',
      color: 'warning',
      category: 'Pleadings',
      practiceAreas: ['civil'],
      popular: false
    },
    // Briefs
    {
      id: 'legal-brief',
      name: 'Legal Brief',
      description: 'Create comprehensive briefs with citations',
      icon: 'ri-book-open-line',
      color: 'info',
      category: 'Briefs',
      practiceAreas: ['civil', 'criminal'],
      popular: true
    },
    {
      id: 'appellate-brief',
      name: 'Appellate Brief',
      description: 'Draft appellate briefs for appeals',
      icon: 'ri-booklet-line',
      color: 'info',
      category: 'Briefs',
      practiceAreas: ['civil', 'criminal'],
      popular: false
    },
    // Contracts
    {
      id: 'employment-agreement',
      name: 'Employment Agreement',
      description: 'Create employment contracts',
      icon: 'ri-file-user-line',
      color: 'purple',
      category: 'Contracts',
      practiceAreas: ['employment', 'corporate'],
      popular: true
    },
    {
      id: 'nda',
      name: 'Non-Disclosure Agreement',
      description: 'Draft confidentiality agreements',
      icon: 'ri-file-lock-line',
      color: 'purple',
      category: 'Contracts',
      practiceAreas: ['corporate'],
      popular: true
    },
    {
      id: 'purchase-agreement',
      name: 'Purchase Agreement',
      description: 'Create sale and purchase agreements',
      icon: 'ri-shopping-bag-line',
      color: 'purple',
      category: 'Contracts',
      practiceAreas: ['corporate', 'real-estate'],
      popular: false
    },
    // Family Law
    {
      id: 'divorce-petition',
      name: 'Divorce Petition',
      description: 'Draft divorce/dissolution petitions',
      icon: 'ri-parent-line',
      color: 'danger',
      category: 'Family Law',
      practiceAreas: ['family'],
      popular: true
    },
    {
      id: 'custody-agreement',
      name: 'Custody Agreement',
      description: 'Create child custody agreements',
      icon: 'ri-user-heart-line',
      color: 'danger',
      category: 'Family Law',
      practiceAreas: ['family'],
      popular: false
    }
  ];

  constructor(
    private legalResearchService: LegalResearchService,
    private userService: UserService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Subscribe to UserService userData$ observable for reactive updates
    this.userService.userData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        console.log('Current user from UserService observable:', user);
      });

    // Load current user immediately from UserService
    this.currentUser = this.userService.getCurrentUser();
    console.log('Current user on init from UserService:', this.currentUser);

    // If user is null but we have a token, fetch user profile from backend
    if (!this.currentUser && this.userService.isAuthenticated()) {
      console.log('User is null but authenticated - fetching profile from backend');
      this.userService.profile$()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response && response.data && response.data.user) {
              this.currentUser = response.data.user;
              console.log('User profile loaded from backend:', this.currentUser);
            }
          },
          error: (error) => {
            console.error('Error loading user profile:', error);
          }
        });
    }

    // Load conversations for the default task type
    this.loadConversations();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    // Clear all active timeouts
    this.activeTimeouts.forEach(id => clearTimeout(id));
    this.activeTimeouts = [];

    // Clear all active intervals
    this.activeIntervals.forEach(id => clearInterval(id));
    this.activeIntervals = [];
  }

  // Helper method to track setTimeout
  private setTrackedTimeout(callback: () => void, delay: number): number {
    const id = window.setTimeout(() => {
      callback();
      // Remove from tracking once executed
      this.activeTimeouts = this.activeTimeouts.filter(timeoutId => timeoutId !== id);
    }, delay);
    this.activeTimeouts.push(id);
    return id;
  }

  // Helper method to track setInterval
  private setTrackedInterval(callback: () => void, delay: number): number {
    const id = window.setInterval(callback, delay);
    this.activeIntervals.push(id);
    return id;
  }

  // Helper method to clear tracked interval
  private clearTrackedInterval(id: number): void {
    clearInterval(id);
    this.activeIntervals = this.activeIntervals.filter(intervalId => intervalId !== id);
  }

  // Helper method to update workflow step status
  private updateWorkflowStep(stepId: number, status: 'pending' | 'active' | 'completed' | 'error', description?: string): void {
    const step = this.workflowSteps.find(s => s.id === stepId);
    if (step) {
      step.status = status;
      if (description) {
        step.description = description;
      }
    }
  }

  // Helper method to reset workflow steps
  private resetWorkflowSteps(): void {
    this.workflowSteps.forEach(step => {
      step.status = 'pending';
    });
  }

  // Initialize workflow steps based on task type
  private initializeWorkflowSteps(taskType: 'question' | 'draft' | 'summarize' | 'upload'): void {
    const template = this.workflowStepTemplates[taskType];
    this.workflowSteps = template.map(step => ({
      ...step,
      status: 'pending' as 'pending' | 'active' | 'completed' | 'error'
    }));
  }

  // Animate workflow steps progressively
  private animateWorkflowSteps(): void {
    // Clear any existing timeouts
    this.activeTimeouts.forEach(id => clearTimeout(id));
    this.activeTimeouts = [];

    // Progressive animation of steps
    const stepDuration = 3000; // 3 seconds per step

    this.workflowSteps.forEach((step, index) => {
      // Mark step as active
      const activeTimeout = this.setTrackedTimeout(() => {
        if (this.isGenerating) {
          this.updateWorkflowStep(step.id, 'active');
          this.cdr.detectChanges();
        }
      }, index * stepDuration);

      // Mark step as completed (unless it's the last step)
      if (index < this.workflowSteps.length - 1) {
        const completedTimeout = this.setTrackedTimeout(() => {
          if (this.isGenerating) {
            this.updateWorkflowStep(step.id, 'completed');
            this.cdr.detectChanges();
          }
        }, (index + 0.8) * stepDuration);
      }
    });
  }

  // Complete all workflow steps (called when AI response is received)
  private completeAllWorkflowSteps(): void {
    this.workflowSteps.forEach(step => {
      step.status = 'completed';
    });
    this.cdr.detectChanges();
  }

  // Stop generation
  stopGeneration(): void {
    // Clear all active timeouts and intervals
    this.activeTimeouts.forEach(id => clearTimeout(id));
    this.activeTimeouts = [];
    this.activeIntervals.forEach(id => clearInterval(id));
    this.activeIntervals = [];

    // Reset state
    this.isGenerating = false;
    this.resetWorkflowSteps();

    // Add a cancelled message
    this.conversationMessages.push({
      role: 'assistant',
      content: '_Generation stopped by user._'
    });

    this.showBottomSearchBar = true;
  }

  // ========================================
  // MOBILE SIDEBAR TOGGLE
  // ========================================

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }




  // ========================================
  // CONVERSATION MANAGEMENT (Protégé-style)
  // ========================================

  // Load conversations from backend (ONLY general conversations, no case-specific)
  loadConversations(): void {
    const taskTypeMap: { [key: string]: string } = {
      'question': 'LEGAL_QUESTION',
      'draft': 'GENERATE_DRAFT',
      'summarize': 'SUMMARIZE_CASE',
      'upload': 'ANALYZE_DOCUMENT'
    };

    const backendTaskType = taskTypeMap[this.selectedTask];

    // Use getGeneralConversationsByTaskType to exclude case-specific conversations
    this.legalResearchService.getGeneralConversationsByTaskType(backendTaskType, 0, 50)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Loaded general conversations from backend:', response);

          // Map backend conversations to frontend format
          this.conversations = response.conversations.map(conv => ({
            id: `conv_${conv.id}`,
            title: conv.sessionName || 'Untitled Conversation',
            date: new Date(conv.createdAt || new Date()),
            type: this.mapBackendTaskTypeToFrontend(conv.taskType || 'LEGAL_QUESTION'),
            messages: [], // Messages will be loaded when conversation is opened
            messageCount: conv.messageCount || 0, // Use for badge display after page refresh
            jurisdiction: conv.jurisdiction,
            backendConversationId: conv.id,
            researchMode: conv.researchMode || 'AUTO',
            taskType: conv.taskType,
            documentId: conv.documentId,
            relatedDraftId: conv.relatedDraftId
          }));

          // Group conversations by date
          this.groupConversationsByDate();

          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading general conversations:', error);
        }
      });
  }

  // Group conversations by date (past 90 days vs older)
  private groupConversationsByDate(): void {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));

    this.groupedConversations.past90Days = this.conversations.filter(conv =>
      conv.date >= ninetyDaysAgo
    );

    this.groupedConversations.older = this.conversations.filter(conv =>
      conv.date < ninetyDaysAgo
    );
  }

  // Map backend task type to frontend type
  private mapBackendTaskTypeToFrontend(taskType: string): 'question' | 'draft' | 'summarize' | 'upload' {
    const typeMap: { [key: string]: 'question' | 'draft' | 'summarize' | 'upload' } = {
      'LEGAL_QUESTION': 'question',
      'GENERATE_DRAFT': 'draft',
      'SUMMARIZE_CASE': 'summarize',
      'ANALYZE_DOCUMENT': 'upload'
    };
    return typeMap[taskType] || 'question';
  }

  // Load specific conversation by ID
  loadConversation(conversationId: string): void {
    const conv = this.conversations.find(c => c.id === conversationId);
    if (!conv || !conv.backendConversationId) {
      console.error('Conversation not found or missing backend ID');
      return;
    }

    this.legalResearchService.getConversationById(conv.backendConversationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Loaded conversation details:', response);

          // Update conversation with messages
          this.activeConversationId = conversationId;
          this.followUpQuestions = []; // Clear old follow-up questions from previous conversation
          this.conversationMessages = response.messages.map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: new Date(msg.createdAt || new Date())
          }));

          // Extract follow-up questions from last assistant message (if any)
          const lastAssistantMsg = this.conversationMessages
            .slice()
            .reverse()
            .find(msg => msg.role === 'assistant');

          if (lastAssistantMsg) {
            const cleanedContent = this.extractAndRemoveFollowUpQuestions(lastAssistantMsg.content);
            lastAssistantMsg.content = cleanedContent;
          }

          this.showChat = true;
          this.showBottomSearchBar = true;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading conversation:', error);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to load conversation. Please try again.'
          });
        }
      });
  }

  // Delete conversation
  deleteConversation(conversationId: string): void {
    const conv = this.conversations.find(c => c.id === conversationId);
    if (!conv || !conv.backendConversationId) {
      console.error('Conversation not found or missing backend ID');
      return;
    }

    Swal.fire({
      title: 'Delete Conversation?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it'
    }).then((result) => {
      if (result.isConfirmed && conv.backendConversationId) {
        this.legalResearchService.deleteConversationById(conv.backendConversationId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (success) => {
              if (success) {
                // Remove from local array
                this.conversations = this.conversations.filter(c => c.id !== conversationId);

                // Re-group conversations
                this.groupConversationsByDate();

                // Clear active conversation if it was deleted
                if (this.activeConversationId === conversationId) {
                  this.activeConversationId = null;
                  this.conversationMessages = [];
                  this.showChat = false;
                }

                Swal.fire('Deleted!', 'Conversation has been deleted.', 'success');
                this.cdr.detectChanges();
              }
            },
            error: (error) => {
              console.error('Error deleting conversation:', error);
              Swal.fire('Error', 'Failed to delete conversation.', 'error');
            }
          });
      }
    });
  }

  // Switch to a conversation (alias for loadConversation)
  switchConversation(conversationId: string): void {
    this.loadConversation(conversationId);
  }

  // Start a new conversation - resets the view
  startNewConversation(): void {
    // Clear active conversation
    this.activeConversationId = null;
    this.conversationMessages = [];

    // Reset UI state
    this.showChat = false;
    this.showBottomSearchBar = false;
    this.isGenerating = false;
    this.draftingMode = false;

    // Clear inputs
    this.customPrompt = '';
    this.followUpMessage = '';
    this.followUpQuestions = [];

    // Reset workflow steps
    this.resetWorkflowSteps();

    // Close mobile sidebar if open
    this.closeSidebar();

    console.log('Started new conversation - view reset');
  }

  // Delete all conversations (if needed in the UI)
  deleteAllConversations(): void {
    Swal.fire({
      title: 'Delete All Conversations?',
      text: 'This will delete all conversations for the current task. This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete all'
    }).then((result) => {
      if (result.isConfirmed) {
        // Delete all conversations one by one
        const deletePromises = this.conversations
          .filter(c => c.backendConversationId)
          .map(c =>
            lastValueFrom(
              this.legalResearchService.deleteConversationById(c.backendConversationId!)
                .pipe(takeUntil(this.destroy$))
            )
          );

        Promise.all(deletePromises)
          .then(() => {
            this.conversations = [];
            this.groupConversationsByDate();
            this.activeConversationId = null;
            this.conversationMessages = [];
            this.showChat = false;
            Swal.fire('Deleted!', 'All conversations have been deleted.', 'success');
            this.cdr.detectChanges();
          })
          .catch((error) => {
            console.error('Error deleting conversations:', error);
            Swal.fire('Error', 'Failed to delete some conversations.', 'error');
            this.loadConversations(); // Reload to get current state
          });
      }
    });
  }



  // ========================================
  // TEMPLATE/DOCUMENT TYPE FILTERING
  // ========================================

  // Get filtered document types
  get filteredDocumentTypes() {
    if (this.selectedPracticeArea === 'all') {
      return this.documentTypes;
    }
    return this.documentTypes.filter(doc =>
      doc.practiceAreas.includes(this.selectedPracticeArea)
    );
  }

  // Get document types by category
  getDocumentsByCategory(category: string) {
    return this.filteredDocumentTypes.filter(doc => doc.category === category);
  }

  // Get unique categories from filtered documents
  get availableCategories() {
    const categories = new Set(this.filteredDocumentTypes.map(doc => doc.category));
    return Array.from(categories);
  }

  // Toggle template filters
  toggleFilters(): void {
    this.showTemplateFilters = !this.showTemplateFilters;
  }

  // Select practice area
  selectPracticeArea(areaId: string): void {
    this.selectedPracticeArea = areaId;
  }

  // Select task (Protégé-style)
  selectedTask: 'question' | 'draft' | 'summarize' | 'upload' = 'draft';
  activeTask: 'question' | 'draft' | 'summarize' | 'upload' = 'draft';

  selectTask(task: 'question' | 'draft' | 'summarize' | 'upload'): void {
    this.selectedTask = task;
    this.activeTask = task;
    this.activeConversationId = null;
    this.conversationMessages = [];
    this.showChat = false;

    // Load conversations for this task type
    this.loadConversations();
  }

 
  // Protégé-style document type pills
  documentTypePills = [
    {
      id: 'transactional',
      name: 'Transactional Document',
      placeholderExample: 'Draft a purchase agreement for a commercial property sale between ABC Corp and XYZ LLC...'
    },
    {
      id: 'motion',
      name: 'Motion',
      placeholderExample: 'Draft a Motion to Dismiss the complaint for failure to state a claim...'
    },
    {
      id: 'legal-argument',
      name: 'Legal Argument',
      placeholderExample: 'Draft a legal argument addressing the admissibility of hearsay evidence in this case...'
    },
    {
      id: 'legal-memo',
      name: 'Legal Memo',
      placeholderExample: 'Draft a legal memorandum analyzing the liability issues in a slip and fall case...'
    },
    {
      id: 'letter',
      name: 'Letter',
      placeholderExample: 'Draft a demand letter to the opposing party requesting payment of $50,000...'
    },
    {
      id: 'email',
      name: 'Email',
      placeholderExample: 'Draft an email to the client explaining the next steps in their litigation matter...'
    },
    {
      id: 'clause',
      name: 'Clause',
      placeholderExample: 'Draft an arbitration clause for a commercial services agreement...'
    }
  ];

  selectedDocTypePill: string | null = null;

  selectDocTypePill(pillId: string): void {
    this.selectedDocTypePill = pillId;

    // Update placeholder in the prompt textarea
    const selectedPill = this.documentTypePills.find(p => p.id === pillId);
    if (selectedPill) {
      // You could optionally pre-fill or update a hint
      console.log(`Selected document type: ${selectedPill.name}`);
    }
  }

  // Get placeholder text based on selected task and document type
  get promptPlaceholder(): string {
    if (this.selectedTask === 'question') {
      return 'Ask a legal question...';
    }

    if (this.selectedTask === 'summarize') {
      return 'Enter case details to summarize...';
    }

    if (this.selectedTask === 'upload') {
      return 'Describe what you want to do with your uploaded document...';
    }

    // For 'draft' task
    if (this.selectedTask === 'draft') {
      if (this.selectedDocTypePill) {
        const selectedPill = this.documentTypePills.find(p => p.id === this.selectedDocTypePill);
        return selectedPill?.placeholderExample || 'Describe the document you want to draft...';
      }
      return 'Describe the document you want to draft...';
    }

    return 'Ask a legal question...';
  }

  // Get follow-up placeholder for bottom input bar based on active task
  get followUpPlaceholder(): string {
    if (this.activeTask === 'question') {
      return 'Ask a follow-up question...';
    }

    if (this.activeTask === 'summarize') {
      return 'Request case summary changes...';
    }

    if (this.activeTask === 'upload') {
      return 'Request document analysis changes...';
    }

    // For 'draft' task
    return 'Enter drafting request here';
  }

  // Get user display name with proper fallbacks
  getUserDisplayName(): string {
    if (this.currentUser && this.currentUser.firstName && this.currentUser.firstName.trim()) {
      return this.currentUser.firstName.trim();
    }
    return 'User';
  }

  // Start drafting with selected document type
  startDrafting(documentTypeId: string): void {
    this.selectedDocumentType = documentTypeId as any;
    const type = this.documentTypes.find(t => t.id === documentTypeId);

    if (type) {
      // Add user message
      this.conversationMessages.push({
        role: 'user',
        content: `I want to draft a ${type.name}`,
        timestamp: new Date()
      });

      // Show chat and start generating
      this.showChat = true;
      this.showBottomSearchBar = false;
    }
  }

  // Start custom draft with user's own prompt - REAL BACKEND CALL
  startCustomDraft(): void {
    if (!this.customPrompt.trim()) return;

    const userPrompt = this.customPrompt;
    this.customPrompt = '';

    // Add user message
    this.conversationMessages.push({
      role: 'user',
      content: userPrompt,
      timestamp: new Date()
    });

    // Show chat and start generating
    this.showChat = true;
    this.showBottomSearchBar = false;
    this.isGenerating = true;

    // Initialize workflow steps for the selected task
    this.initializeWorkflowSteps(this.selectedTask);
    this.animateWorkflowSteps();

    // Map frontend task to backend taskType
    const taskTypeMap: { [key: string]: string } = {
      'question': 'LEGAL_QUESTION',
      'draft': 'GENERATE_DRAFT',
      'summarize': 'SUMMARIZE_CASE',
      'upload': 'ANALYZE_DOCUMENT'
    };

    const taskType = taskTypeMap[this.selectedTask];
    const title = userPrompt.substring(0, 50) + (userPrompt.length > 50 ? '...' : '');
    const researchMode = 'AUTO'; // Default to AUTO mode

    // Create conversation
    this.legalResearchService.createGeneralConversation(title, researchMode, taskType)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          console.log('Created conversation:', session);

          // Add to conversations list
          const newConv = {
            id: `conv_${session.id}`,
            title: session.sessionName || title,
            date: new Date(session.createdAt || new Date()),
            type: this.selectedTask,
            messages: [...this.conversationMessages],
            messageCount: this.conversationMessages.length, // Initialize with current message count
            jurisdiction: session.jurisdiction,
            backendConversationId: session.id,
            researchMode: session.researchMode || 'AUTO',
            taskType: session.taskType,
            documentId: session.documentId,
            relatedDraftId: session.relatedDraftId
          };

          this.conversations.unshift(newConv);
          this.activeConversationId = newConv.id;

          // Re-group conversations
          this.groupConversationsByDate();

          // Send message to get AI response
          if (session.id) {
            // Capture conversation ID at request time to prevent race condition
            const requestConversationId = newConv.id;
            const requestBackendId = session.id;

            this.legalResearchService.sendMessageToConversation(requestBackendId, userPrompt, researchMode)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (message) => {
                  console.log('Received AI response for conversation:', requestConversationId);

                  // Only update UI if THIS conversation is still active (prevents race condition)
                  if (this.activeConversationId === requestConversationId) {
                    // Complete all workflow steps
                    this.completeAllWorkflowSteps();

                    // Extract follow-up questions and remove section from content
                    const cleanedContent = this.extractAndRemoveFollowUpQuestions(message.content);

                    // Add assistant message to chat view (with cleaned content)
                    const assistantMessage = {
                      role: 'assistant' as 'assistant',
                      content: cleanedContent,
                      timestamp: new Date(message.createdAt || new Date())
                    };
                    this.conversationMessages.push(assistantMessage);

                    // ALSO update the conversation object in sidebar for message count badge
                    const conv = this.conversations.find(c => c.id === requestConversationId);
                    if (conv) {
                      conv.messages.push(assistantMessage);
                      conv.messageCount = (conv.messageCount || 0) + 1; // Increment message count
                      console.log(`Updated conversation ${requestConversationId} messages count: ${conv.messages.length}, messageCount: ${conv.messageCount}`);
                      // Force change detection to update badge
                      this.cdr.detectChanges();
                    }

                    this.isGenerating = false;
                    this.showBottomSearchBar = true;
                    this.cdr.detectChanges();
                  } else {
                    console.log('Response arrived for inactive conversation, ignoring UI update');
                    this.isGenerating = false;
                  }
                },
                error: (error) => {
                  console.error('Error getting AI response:', error);

                  // Mark workflow as error
                  if (this.workflowSteps.length > 0) {
                    this.workflowSteps[this.workflowSteps.length - 1].status = 'error';
                  }

                  this.conversationMessages.push({
                    role: 'assistant',
                    content: 'Sorry, I encountered an error processing your request. Please try again.'
                  });
                  this.isGenerating = false;
                  this.showBottomSearchBar = true;
                  this.cdr.detectChanges();
                }
              });
          }
        },
        error: (error) => {
          console.error('Error creating conversation:', error);
          this.conversationMessages.push({
            role: 'assistant',
            content: 'Sorry, I encountered an error creating the conversation. Please try again.'
          });
          this.isGenerating = false;
          this.showBottomSearchBar = true;
          this.cdr.detectChanges();
        }
      });
  }


  

 

  


  // Count words in document
  countWords(text: string): number {
    // Remove markdown syntax and HTML tags for accurate count
    const plainText = text
      .replace(/#+\s/g, '') // Remove markdown headers
      .replace(/\*\*/g, '') // Remove bold
      .replace(/\*/g, '') // Remove italic
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove markdown links
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .trim();

    if (!plainText) return 0;

    return plainText.split(/\s+/).filter(word => word.length > 0).length;
  }

  // Apply drafting tool
  applyDraftingTool(tool: 'simplify' | 'condense' | 'expand' | 'redraft'): void {
    console.log(`Applying drafting tool: ${tool}`);

    // Add user message requesting the tool
    let toolPrompt = '';
    switch (tool) {
      case 'simplify':
        toolPrompt = 'Please simplify the language in this document to make it more accessible.';
        break;
      case 'condense':
        toolPrompt = 'Please condense this document to make it more concise.';
        break;
      case 'expand':
        toolPrompt = 'Please expand this document with more detail and explanation.';
        break;
      case 'redraft':
        toolPrompt = 'Please redraft this document entirely with a fresh approach.';
        break;
    }

    this.conversationMessages.push({
      role: 'user',
      content: toolPrompt,
      timestamp: new Date()
    });

    // Simulate AI processing
    this.isGenerating = true;
    setTimeout(() => {
      this.conversationMessages.push({
        role: 'assistant',
        content: `I've applied the "${tool}" transformation to your document. The updated version is now displayed in the preview panel.`
      });
      this.isGenerating = false;

      // Update document content (in real implementation, this would come from backend)
      // For now, just add a note to the document
      this.activeDocumentContent += `\n\n*[Document updated with ${tool} transformation]*`;
      this.currentDocumentWordCount = this.countWords(this.activeDocumentContent);
    }, 2000);
  }

  // Save and exit drafting mode
  saveAndExit(): void {
    console.log('Saving document and exiting drafting mode');
    // TODO: Implement actual save to backend
    this.draftingMode = false;
    this.showBottomSearchBar = true;
    alert('Document saved successfully!');
  }

  // Download document from split-view (drafting mode)
  downloadDocument(format: 'docx' | 'pdf'): void {
    // Get the current document ID from the last message
    const lastMessage = this.conversationMessages[this.conversationMessages.length - 1];
    if (!lastMessage || !lastMessage.documentId) {
      console.error('No document ID available for download');
      alert('Unable to download document. Please generate a document first.');
      return;
    }

    this.downloadDocumentById(lastMessage.documentId.toString(), format);
  }

  // Download document by ID (shared method)
  private downloadDocumentById(documentId: string, format: 'docx' | 'pdf'): void {
    const url = `${environment.apiUrl}/api/document-generations/${documentId}/export?format=${format}`;

    // Create a hidden link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `document.${format}`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log(`Download initiated: ${format.toUpperCase()}`);
  }

  // Mock document generation (will be replaced with actual API call)
  generateMockDocument(prompt: string): string {
    const docType = this.selectedDocumentType;

    if (docType === 'interrogatories' || prompt.toLowerCase().includes('interrogator')) {
      return `# INTERROGATORIES TO DEFENDANT

I've drafted comprehensive interrogatories based on your request. Here's the document:

## DEFINITIONS

1. "You" or "your" refers to the defendant and any agents, representatives, or employees acting on behalf of the defendant.
2. "Document" includes writings, recordings, photographs, and any other data compilations.

## INSTRUCTIONS

These interrogatories are served pursuant to the applicable rules of civil procedure. Please answer fully and completely, under oath.

## INTERROGATORIES

1. State your full legal name, current address, and all addresses where you have resided during the past five years.

2. Identify all persons who have knowledge of the facts underlying this litigation, including their names, addresses, and the nature of their knowledge.

3. Describe in detail your version of the events that are the subject of this lawsuit, including dates, times, locations, and persons involved.

4. List all documents in your possession, custody, or control that relate to this matter, including the date, author, and subject matter of each document.

5. Identify all expert witnesses you intend to call at trial, including their qualifications and the substance of their expected testimony.

---
*Generated by AI Legal Assistant on ${new Date().toLocaleDateString()}*`;
    }

    if (docType === 'motion' || prompt.toLowerCase().includes('motion')) {
      return `# MOTION TO DISMISS

I've prepared a Motion to Dismiss based on your requirements:

## MEMORANDUM IN SUPPORT OF MOTION TO DISMISS

### INTRODUCTION

The defendant respectfully moves this Court to dismiss the plaintiff's complaint pursuant to applicable rules of civil procedure for failure to state a claim upon which relief can be granted.

### STATEMENT OF FACTS

[This section will be customized based on the specific facts of your case]

### ARGUMENT

#### I. PLAINTIFF FAILS TO STATE A CLAIM

The complaint fails to allege facts sufficient to support the elements of any recognized cause of action. Even accepting all allegations as true and drawing all reasonable inferences in the plaintiff's favor, the plaintiff has not demonstrated entitlement to relief.

#### II. LEGAL STANDARD

Under the applicable standard, a complaint must contain sufficient factual matter to state a claim for relief that is plausible on its face. The complaint here fails to meet this threshold.

### CONCLUSION

For the foregoing reasons, this Court should grant the defendant's motion to dismiss.

---
*Generated by AI Legal Assistant on ${new Date().toLocaleDateString()}*`;
    }

    // Brief or generic document
    return `# LEGAL DOCUMENT

I've created a legal document based on your request: "${prompt}"

## OVERVIEW

This document has been structured to address your legal needs with proper formatting and professional language.

## CONTENT

The document includes:
- Clear headings and organization
- Professional legal language
- Proper citations (to be customized)
- Standard legal formatting

## NEXT STEPS

You can:
1. Review the document below
2. Request specific revisions
3. Export to PDF or DOCX format
4. Add case-specific details

---
*Generated by AI Legal Assistant on ${new Date().toLocaleDateString()}*`;
  }

  // Send follow-up message
  sendFollowUpMessage(): void {
    if (!this.followUpMessage.trim()) return;

    // Clear follow-up questions when sending new message
    this.followUpQuestions = [];

    // Add user message to chat view
    const userMsg = {
      role: 'user' as 'user',
      content: this.followUpMessage,
      timestamp: new Date()
    };
    this.conversationMessages.push(userMsg);

    const userMessage = this.followUpMessage;
    this.followUpMessage = '';
    this.showBottomSearchBar = false;

    // Get active conversation and also update its messages array
    const activeConv = this.conversations.find(c => c.id === this.activeConversationId);
    if (activeConv) {
      activeConv.messages.push(userMsg);
      activeConv.messageCount = (activeConv.messageCount || 0) + 1; // Increment message count
      console.log(`Added user message to conversation ${this.activeConversationId}, count: ${activeConv.messages.length}, messageCount: ${activeConv.messageCount}`);
    }

    if (!activeConv || !activeConv.backendConversationId) {
      // No active conversation - this is likely a document drafting follow-up
      // Keep original mock behavior for now
      this.isGenerating = true;
      setTimeout(() => {
        this.conversationMessages.push({
          role: 'assistant',
          content: `I understand you'd like to: "${userMessage}". I'll help you with those revisions. This functionality will be connected to the backend API to provide real-time document editing and improvements.`,
          timestamp: new Date()
        });
        this.isGenerating = false;
        this.showBottomSearchBar = true;
      }, 2000);
      return;
    }

    // Send message to backend conversation
    this.isGenerating = true;
    const researchMode = activeConv.researchMode || 'AUTO';

    // Initialize and animate workflow steps for the active task
    this.initializeWorkflowSteps(this.activeTask);
    this.animateWorkflowSteps();

    // Capture conversation ID at request time to prevent race condition
    const requestConversationId = this.activeConversationId;
    const requestBackendId = activeConv.backendConversationId;

    this.legalResearchService.sendMessageToConversation(
      requestBackendId,
      userMessage,
      researchMode
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (message) => {
          console.log('Received AI response for conversation:', requestConversationId);

          // Only update UI if THIS conversation is still active (prevents race condition)
          if (this.activeConversationId === requestConversationId) {
            // Complete all workflow steps
            this.completeAllWorkflowSteps();

            // Extract follow-up questions and remove section from content
            const cleanedContent = this.extractAndRemoveFollowUpQuestions(message.content);

            // Add assistant message to chat view (with cleaned content)
            const assistantMessage = {
              role: 'assistant' as 'assistant',
              content: cleanedContent,
              timestamp: new Date(message.createdAt || new Date())
            };
            this.conversationMessages.push(assistantMessage);

            // ALSO update the conversation object in sidebar for message count badge
            const conv = this.conversations.find(c => c.id === requestConversationId);
            if (conv) {
              conv.messages.push(assistantMessage);
              conv.messageCount = (conv.messageCount || 0) + 1; // Increment message count
              console.log(`Updated conversation ${requestConversationId} messages count: ${conv.messages.length}, messageCount: ${conv.messageCount}`);
              // Force change detection to update badge
              this.cdr.detectChanges();
            }

            this.isGenerating = false;
            this.showBottomSearchBar = true;
            this.cdr.detectChanges();
          } else {
            console.log('Response arrived for inactive conversation, ignoring UI update');
            this.isGenerating = false;
          }
        },
        error: (error) => {
          console.error('Error sending message:', error);

          // Mark workflow as error
          if (this.workflowSteps.length > 0) {
            this.workflowSteps[this.workflowSteps.length - 1].status = 'error';
          }

          this.conversationMessages.push({
            role: 'assistant',
            content: 'Sorry, I encountered an error processing your message. Please try again.'
          });
          this.isGenerating = false;
          this.showBottomSearchBar = true;
          this.cdr.detectChanges();
        }
      });
  }

  // Handle Enter key press in textarea
  onEnterPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendFollowUpMessage();
    }
  }

  // View generated document
  viewGeneratedDocument(documentId: string): void {
    // Find the message with this document
    const message = this.conversationMessages.find(
      m => m.documentGenerated && m.documentId === documentId
    );

    if (message) {
      // Open in view-only mode (can be extended later)
      this.openEditorModal(documentId, 'Generated Document', message.content);
    }
  }

  // Edit document
  editDocument(documentId: string): void {
    // Find the message with this document
    const message = this.conversationMessages.find(
      m => m.documentGenerated && m.documentId === documentId
    );

    if (message) {
      this.openEditorModal(documentId, 'Edit Document', message.content);
    }
  }

  // Open editor modal
  openEditorModal(documentId: string, title: string, content: string): void {
    this.editorDocumentId = documentId;
    this.editorDocumentTitle = title;
    this.editorDocumentContent = content;
    this.editorModalOpen = true;
  }

  // Save document from editor
  onEditorSave(updatedContent: string): void {
    console.log('Saving document:', this.editorDocumentId);

    // Update the message content
    const message = this.conversationMessages.find(
      m => m.documentId === this.editorDocumentId
    );

    if (message) {
      message.content = updatedContent;
    }

    // TODO: Save to backend
    this.editorModalOpen = false;
    alert('Document saved successfully!');
  }

  // Cancel editor
  onEditorCancel(): void {
    this.editorModalOpen = false;
  }

  // Export document - Use real backend
  exportDocument(documentId: number | string, format: 'pdf' | 'docx'): void {
    this.downloadDocumentById(documentId.toString(), format);
  }

  // View draft
  viewDraft(draft: any): void {
    // TODO: Implement draft viewing
    console.log('Viewing draft:', draft);
  }

  // Delete draft
  deleteDraft(draft: any): void {
    // TODO: Implement draft deletion
    console.log('Deleting draft:', draft);
  }

  // Execute suggested action
  executeSuggestedAction(action: string, documentId?: string | number): void {
    console.log(`Executing suggested action: ${action} for document ${documentId}`);

    switch (action) {
      case 'view-document':
        if (documentId) {
          this.viewGeneratedDocument(documentId.toString());
        }
        break;

      case 'export-pdf':
        if (documentId) {
          this.exportDocument(documentId.toString(), 'pdf');
        }
        break;

      case 'summarize-authority':
        // Add user message requesting case authority summary
        this.conversationMessages.push({
          role: 'user',
          content: 'Please summarize the case authority used in this document.',
          timestamp: new Date()
        });

        // Simulate AI response
        this.isGenerating = true;
        setTimeout(() => {
          this.conversationMessages.push({
            role: 'assistant',
            content: `I've analyzed the case authority in your document. Here's a summary:\n\n**Primary Cases Referenced:**\n\n1. *Smith v. Jones* (2020) - Established the legal standard for...\n2. *Doe v. Corporation* (2019) - Precedent for contract interpretation...\n\nThese cases support your main arguments regarding liability and damages.`
          });
          this.isGenerating = false;
          this.showBottomSearchBar = true;
        }, 2000);
        break;

      default:
        console.warn(`Unknown action: ${action}`);
    }
  }

  // Get examples title based on selected task
  getExamplesTitle(): string {
    switch (this.selectedTask) {
      case 'question':
        return 'Example questions you can ask:';
      case 'draft':
        return 'Example drafts you can generate:';
      case 'summarize':
        return 'Example cases you can summarize:';
      case 'upload':
        return 'Example document analysis tasks:';
      default:
        return 'Examples:';
    }
  }

  // Get examples based on selected task
  getExamples(): string[] {
    switch (this.selectedTask) {
      case 'question':
        return [
          'What are the elements required to prove negligence in a personal injury case?',
          'How does the statute of limitations work for breach of contract claims?',
          'What defenses are available in a wrongful termination lawsuit?'
        ];
      case 'draft':
        return [
          'Draft a Motion to Dismiss for lack of personal jurisdiction',
          'Generate a comprehensive employment agreement with non-compete clause',
          'Create interrogatories for a commercial breach of contract case'
        ];
      case 'summarize':
        return [
          'Summarize recent Supreme Court decisions on intellectual property',
          'Provide an overview of landmark employment discrimination cases',
          'Analyze trends in contract interpretation over the past 5 years'
        ];
      case 'upload':
        return [
          'Analyze the enforceability of non-compete clauses in this contract',
          'Review this complaint and identify potential defenses',
          'Extract key dates and obligations from this agreement'
        ];
      default:
        return [];
    }
  }

  // Get includes based on selected task
  getIncludes(): string[] {
    switch (this.selectedTask) {
      case 'question':
        return ['Cases', 'Legislation', 'Legal principles'];
      case 'draft':
        return ['Legal research', 'Case citations', 'Formatting'];
      case 'summarize':
        return ['Key holdings', 'Citations', 'Analysis'];
      case 'upload':
        return ['Document review', 'Risk assessment', 'Recommendations'];
      default:
        return [];
    }
  }

  // Extract follow-up questions from AI response and remove section from markdown (matching case-research component)
  extractAndRemoveFollowUpQuestions(response: string): string {
    this.followUpQuestions = [];
    console.log('=== EXTRACTING FOLLOW-UP QUESTIONS ===');
    console.log('Response length:', response.length);

    // Look for "## Follow-up Questions" markdown heading (like case-research component)
    const followUpPattern = /##\s*Follow-up Questions\s*\n([\s\S]*?)(?=\n##|$)/i;
    const match = response.match(followUpPattern);

    if (match) {
      console.log('Found Follow-up Questions section');
      const questionsSection = match[1];
      console.log('Questions section:', questionsSection);

      // Extract questions from list items (- or • or * or numbered)
      const questionMatches = questionsSection.match(/[-•*]\s*(.+?)(?=\n[-•*]|\n\d+\.|\n|$)/g) ||
                             questionsSection.match(/\d+\.\s*(.+?)(?=\n\d+\.|\n|$)/g);

      if (questionMatches) {
        this.followUpQuestions = questionMatches
          .map(q => q.replace(/^[-•*\d+\.]\s*/, '').trim())
          .map(q => q.replace(/\*\*/g, '')) // Remove bold markdown
          .filter(q => q.length > 0)
          .filter(q => this.isValidFollowUpQuestion(q)) // Validate question quality
          .slice(0, 3); // Limit to 3 questions

        console.log('Extracted follow-up questions:', this.followUpQuestions);
      } else {
        console.log('No question matches found in section');
      }

      // Remove the entire "Follow-up Questions" section from the response
      return response.replace(followUpPattern, '').trim();
    }

    return response;
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

  // Ask a follow-up question
  askFollowUpQuestion(question: string): void {
    if (!question || this.isGenerating) return;

    // Set the follow-up message and send it
    this.followUpMessage = question;
    this.sendFollowUpMessage();
  }
}
