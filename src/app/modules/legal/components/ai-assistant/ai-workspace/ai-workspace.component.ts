import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, TemplateRef, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subject, lastValueFrom, merge, forkJoin, Observable } from 'rxjs';
import { takeUntil, switchMap, finalize } from 'rxjs/operators';
import { LegalResearchService } from '../../../services/legal-research.service';
import { DocumentGenerationService } from '../../../services/document-generation.service';
import { LegalCaseService } from '../../../services/legal-case.service';
import { MarkdownConverterService } from '../../../services/markdown-converter.service';
import { FileManagerService } from '../../../../file-manager/services/file-manager.service';
import { DocumentAnalyzerService } from '../../../services/document-analyzer.service';
import { DocumentCollectionService, DocumentCollection } from '../../../services/document-collection.service';
import { DocumentTypeConfig } from '../../../models/document-type-config';
import { MarkdownToHtmlPipe } from '../../../pipes/markdown-to-html.pipe';
import { ApexChartDirective } from '../../../directives/apex-chart.directive';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { UserService } from '../../../../../service/user.service';
import { OrganizationService } from '../../../../../core/services/organization.service';
import { environment } from '@environments/environment';
import { CKEditorModule } from '@ckeditor/ckeditor5-angular';
import {
  ClassicEditor,
  Essentials,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading,
  Paragraph,
  BlockQuote,
  HorizontalLine,
  Link,
  List,
  Table,
  TableToolbar,
  TableProperties,
  TableCellProperties,
  Alignment,
  Indent,
  IndentBlock,
  Font,
  FindAndReplace,
  Highlight,
  GeneralHtmlSupport,
  PasteFromOffice,
  RemoveFormat,
  Undo,
  Image,
  ImageInsert,
  ImageResize,
  ImageStyle,
  ImageToolbar,
  Base64UploadAdapter,
  type EditorConfig
} from 'ckeditor5';
import { NgbDropdown, NgbDropdownToggle, NgbDropdownMenu, NgbModal } from '@ng-bootstrap/ng-bootstrap';

// NEW: Refactored child components
import { WorkflowStepsComponent } from './workflow-steps/workflow-steps.component';
import { TransformationPreviewComponent } from './transformation-preview/transformation-preview.component';
import { DocumentEditorComponent } from './document-editor/document-editor.component';
import { ConversationListComponent } from './conversation-list/conversation-list.component';
import { VersionHistoryComponent } from './version-history/version-history.component';
import { ActionItemsListComponent } from '../action-items-list/action-items-list.component';
import { TimelineViewComponent } from '../timeline-view/timeline-view.component';
import { DocumentAnalysisViewerComponent, AnalyzedDocumentData } from '../document-analysis-viewer/document-analysis-viewer.component';
import { CollectionViewerComponent } from '../collection-viewer/collection-viewer.component';
import { BackgroundTasksIndicatorComponent } from './background-tasks-indicator/background-tasks-indicator.component';
import { AiDisclaimerComponent } from '../../../../../shared/components/ai-disclaimer/ai-disclaimer.component';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';

// NEW: Refactored services
import { NotificationService } from '../../../services/notification.service';
import { CKEditorService } from '../../../services/ckeditor.service';
import { QuillHtmlMigrator } from '../../../utils/quill-html-migrator';
import { AiWorkspaceStateService, AnalyzedDocument } from '../../../services/ai-workspace-state.service';
import { ConversationOrchestrationService } from '../../../services/conversation-orchestration.service';
import { DocumentTransformationService } from '../../../services/document-transformation.service';
import { CaseWorkflowService, WorkflowTemplate, WorkflowRecommendation, WorkflowUrgency } from '../../../services/case-workflow.service';
import { BackgroundTaskService, BackgroundTask } from '../../../services/background-task.service';
import { ExhibitPanelService, Exhibit } from '../../../services/exhibit-panel.service';
import { StationeryService, StationeryTemplate, AttorneyInfo, StationeryRenderResponse } from '../../../services/stationery.service';
import { CaseDocumentsService } from '../../../services/case-documents.service';

// NEW: Models and enums
import { Conversation, Message } from '../../../models/conversation.model';
import { ConversationType, ResearchMode, TaskType } from '../../../models/enums/conversation-type.enum';
import { WorkflowStep } from '../../../models/workflow.model';
import { WorkflowStepStatus } from '../../../models/enums/workflow-step-status.enum';
import { DocumentState } from '../../../models/document.model';

@Component({
  selector: 'app-ai-workspace',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MarkdownToHtmlPipe,
    ApexChartDirective,
    CKEditorModule,
    NgbDropdown,
    NgbDropdownToggle,
    NgbDropdownMenu,
    // NEW: Refactored child components
    WorkflowStepsComponent,
    TransformationPreviewComponent,
    DocumentEditorComponent,
    ConversationListComponent,
    VersionHistoryComponent,
    ActionItemsListComponent,
    TimelineViewComponent,
    DocumentAnalysisViewerComponent,
    CollectionViewerComponent,
    BackgroundTasksIndicatorComponent,
    AiDisclaimerComponent,
    NgxExtendedPdfViewerModule
  ],
  templateUrl: './ai-workspace.component.html',
  styleUrls: ['./ai-workspace.component.scss']
})
export class AiWorkspaceComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private cancelGeneration$ = new Subject<void>();

  // Timeout/Interval tracking for cleanup
  private activeTimeouts: number[] = [];
  private activeIntervals: number[] = [];
  // SSE connection for real-time workflow progress
  private workflowEventSource?: EventSource;
  private contentChangeDebounce: any;

  // Timing constants
  private readonly STEP_DELAY = 2000;
  private readonly TYPING_DELAY = 1500;
  private readonly RESPONSE_DELAY = 3000;

  // Conversation state (migrated to observables from StateService)
  showChat$ = this.stateService.showChat$;
  showBottomSearchBar$ = this.stateService.showBottomSearchBar$;
  isGenerating$ = this.stateService.isGenerating$;
  draftingMode$ = this.stateService.draftingMode$;
  showVersionHistory$ = this.stateService.showVersionHistory$;

  // Document Analysis Viewer state
  analyzedDocuments$ = this.stateService.analyzedDocuments$;
  activeDocumentId$ = this.stateService.activeDocumentId$;
  documentViewerMode$ = this.stateService.documentViewerMode$;
  viewerSidebarCollapsed$ = this.stateService.viewerSidebarCollapsed$;

  // Collections state
  collections$ = this.collectionService.collections$;
  loadingCollections = false;
  showNewCollectionModal = false;

  // Case Workflow state
  workflowTemplates: WorkflowTemplate[] = [];
  loadingWorkflowTemplates = false;
  selectedWorkflowTemplate: WorkflowTemplate | null = null;
  workflowSelectedDocuments: number[] = [];  // Document analysis IDs to include in workflow
  workflowName = '';  // User-provided name for the workflow
  startingWorkflow = false;
  showStartWorkflowModal = false;  // Controls the start workflow modal visibility
  showWorkflowHelpModal = false;   // Controls the workflow help modal visibility
  activeWorkflowExecution: any = null;

  // My Workflows state
  userWorkflows: any[] = [];
  loadingWorkflows = false;
  workflowPollingInterval: any = null;
  workflowPollingStartTime: number = 0; // Track when polling started
  previouslyRunningWorkflowIds: Set<number> = new Set(); // Track workflows for completion notifications
  workflowTaskIdMapping: Map<number, string> = new Map(); // Map workflow ID to background task ID
  selectedWorkflowForDetails: any = null;
  showWorkflowDetailsModal = false; // Legacy - keeping for backwards compatibility
  showWorkflowDetailsPage = false; // New full-page view
  expandedStepOutput: any = null;
  showStepOutputModal = false;
  expandedStepId: number | null = null;
  expandedStepIds: Set<number> = new Set(); // Track which steps are expanded
  allStepsExpanded = false;

  // Workflow Recommendations state
  workflowRecommendations: any[] = [];
  loadingRecommendations = false;
  recommendationsSummary: { critical: number; high: number; medium: number; low: number } | null = null;
  showRecommendationsPanel = true; // Show/hide the suggestions panel

  // Quick Preview Modal state (for starting workflow from recommendation)
  showQuickPreviewModal = false;
  quickPreviewRecommendation: any = null;
  caseDocumentsForPreview: any[] = [];
  loadingCaseDocuments = false;
  previewSelectedDocuments: number[] = [];

  // Legacy properties for backwards compatibility (will be removed progressively)
  currentStep = 1;
  selectedDocumentType: 'interrogatories' | 'motion' | 'brief' | '' = '';

  // Workflow steps (migrated to observable from StateService)
  workflowSteps$ = this.stateService.workflowSteps$;

  // Workflow step templates for different task types
  private workflowStepTemplates: Record<string, { id: number; icon: string; description: string; status: 'pending' }[]> = {
    // Question sub-types (matched to backend QuestionType)
    question_strategy: [
      { id: 1, icon: 'ri-search-2-line', description: 'Analyzing legal question...', status: 'pending' as const },
      { id: 2, icon: 'ri-scales-3-line', description: 'Searching case law & precedents...', status: 'pending' as const },
      { id: 3, icon: 'ri-book-open-line', description: 'Reviewing statutes & regulations...', status: 'pending' as const },
      { id: 4, icon: 'ri-file-text-line', description: 'Generating response...', status: 'pending' as const }
    ],
    question_followup: [
      { id: 1, icon: 'ri-chat-3-line', description: 'Reviewing conversation context...', status: 'pending' as const },
      { id: 2, icon: 'ri-file-text-line', description: 'Generating response...', status: 'pending' as const }
    ],
    question_technical: [
      { id: 1, icon: 'ri-search-2-line', description: 'Analyzing legal question...', status: 'pending' as const },
      { id: 2, icon: 'ri-book-open-line', description: 'Looking up statutes & regulations...', status: 'pending' as const },
      { id: 3, icon: 'ri-file-text-line', description: 'Generating response...', status: 'pending' as const }
    ],
    question_procedural: [
      { id: 1, icon: 'ri-search-2-line', description: 'Analyzing procedural requirements...', status: 'pending' as const },
      { id: 2, icon: 'ri-calendar-check-line', description: 'Checking rules & deadlines...', status: 'pending' as const },
      { id: 3, icon: 'ri-file-text-line', description: 'Generating step-by-step guidance...', status: 'pending' as const }
    ],
    // Fallback: question defaults to strategy (full research)
    question: [
      { id: 1, icon: 'ri-search-2-line', description: 'Analyzing legal question...', status: 'pending' as const },
      { id: 2, icon: 'ri-scales-3-line', description: 'Searching case law & precedents...', status: 'pending' as const },
      { id: 3, icon: 'ri-book-open-line', description: 'Reviewing statutes & regulations...', status: 'pending' as const },
      { id: 4, icon: 'ri-file-text-line', description: 'Generating response...', status: 'pending' as const }
    ],
    draft: [
      { id: 1, icon: 'ri-draft-line', description: 'Analyzing your request...', status: 'pending' as const },
      { id: 2, icon: 'ri-quill-pen-line', description: 'Writing document...', status: 'pending' as const },
      { id: 3, icon: 'ri-shield-check-line', description: 'Reviewing & finalizing...', status: 'pending' as const }
    ],
    summarize: [
      { id: 1, icon: 'ri-file-search-line', description: 'Reading case materials...', status: 'pending' as const },
      { id: 2, icon: 'ri-organization-chart', description: 'Identifying key facts...', status: 'pending' as const },
      { id: 3, icon: 'ri-scales-3-line', description: 'Extracting legal issues...', status: 'pending' as const },
      { id: 4, icon: 'ri-file-list-3-line', description: 'Creating summary...', status: 'pending' as const }
    ],
    upload: [
      { id: 1, icon: 'ri-upload-cloud-2-line', description: 'Uploading document...', status: 'pending' as const },
      { id: 2, icon: 'ri-file-text-line', description: 'Extracting text with Apache Tika...', status: 'pending' as const },
      { id: 3, icon: 'ri-user-search-line', description: 'Detecting metadata (parties, dates, court)...', status: 'pending' as const },
      { id: 4, icon: 'ri-brain-line', description: 'Analyzing with Claude AI...', status: 'pending' as const },
      { id: 5, icon: 'ri-check-double-line', description: 'Generating structured results...', status: 'pending' as const }
    ],
    transform: [
      { id: 1, icon: 'ri-file-search-line', description: 'Analyzing document...', status: 'pending' as const },
      { id: 2, icon: 'ri-magic-line', description: 'Applying transformation...', status: 'pending' as const },
      { id: 3, icon: 'ri-file-edit-line', description: 'Generating preview...', status: 'pending' as const }
    ],
    workflow: [
      { id: 1, icon: 'ri-flow-chart', description: 'Loading workflow...', status: 'pending' as const },
      { id: 2, icon: 'ri-file-search-line', description: 'Processing documents...', status: 'pending' as const },
      { id: 3, icon: 'ri-robot-line', description: 'Running AI analysis...', status: 'pending' as const },
      { id: 4, icon: 'ri-file-list-3-line', description: 'Generating results...', status: 'pending' as const }
    ]
  };

  // Conversation management (migrated to observables from StateService)
  conversations$ = this.stateService.conversations$;
  activeConversationId$ = this.stateService.activeConversationId$;
  groupedConversations$ = this.stateService.groupedConversations$;
  conversationMessages$ = this.stateService.conversationMessages$;

  // Reactive filtered conversations arrays (updated via subscription)
  questionConversations: Conversation[] = [];
  draftConversations: Conversation[] = [];

  // Search query for filtering conversations
  conversationSearchQuery = '';

  // Filter for conversation list (all, case, general)
  conversationFilter: 'all' | 'case' | 'general' = 'all';

  // Filter for draft types
  draftFilter: 'all' | 'motions' | 'letters' | 'contracts' = 'all';

  // Filter for workflow status
  workflowFilter: 'all' | 'active' | 'pending' | 'completed' = 'all';

  // Bookmark filter state
  showBookmarkedOnly = false;

  // Search query for workflows
  workflowSearchQuery = '';

  // Search query for filtering document analyses
  documentSearchQuery = '';

  // Loading state for analyses
  loadingAnalyses = false;

  // Guard flag to prevent multiple loadAnalysisHistory() calls during initialization
  private analysisHistoryLoaded = false;

  // Filtered analyzed documents based on search query
  get filteredAnalyzedDocuments() {
    const docs = this.stateService.getAnalyzedDocuments();
    if (!this.documentSearchQuery.trim()) {
      return docs;
    }
    const query = this.documentSearchQuery.toLowerCase();
    return docs.filter(doc =>
      doc.fileName.toLowerCase().includes(query) ||
      doc.detectedType?.toLowerCase().includes(query)
    );
  }

  // Filtered conversations based on search query and filter (computed from observable)
  // Also filters out document analysis conversations (Upload/Summarize) since they appear in Recent Documents
  get filteredConversations() {
    // First, filter out document analysis types (they appear in Recent Documents section)
    let conversations = this.stateService.getConversations().filter(conv =>
      conv.type !== ConversationType.Upload && conv.type !== ConversationType.Summarize
    );

    // Apply case/general filter
    if (this.conversationFilter === 'case') {
      conversations = conversations.filter(conv => conv.caseId);
    } else if (this.conversationFilter === 'general') {
      conversations = conversations.filter(conv => !conv.caseId);
    }

    // Apply search filter
    if (this.conversationSearchQuery.trim()) {
      const query = this.conversationSearchQuery.toLowerCase();
      conversations = conversations.filter(conv =>
        conv.title.toLowerCase().includes(query)
      );
    }

    return conversations;
  }

  // Filtered question conversations (uses reactive questionConversations array)
  get filteredQuestionConversations() {
    let conversations = this.questionConversations;

    if (this.conversationSearchQuery.trim()) {
      const query = this.conversationSearchQuery.toLowerCase();
      conversations = conversations.filter(conv =>
        (conv.title || '').toLowerCase().includes(query)
      );
    }

    return conversations;
  }

  // Filtered draft conversations (uses reactive draftConversations array)
  get filteredDraftConversations() {
    let conversations = this.draftConversations;

    // Apply draft type filter
    if (this.draftFilter !== 'all') {
      conversations = conversations.filter(conv => {
        const title = (conv.title || '').toLowerCase();
        switch (this.draftFilter) {
          case 'motions': return title.includes('motion');
          case 'letters': return title.includes('letter') || title.includes('demand');
          case 'contracts': return title.includes('contract') || title.includes('agreement');
          default: return true;
        }
      });
    }

    if (this.conversationSearchQuery.trim()) {
      const query = this.conversationSearchQuery.toLowerCase();
      conversations = conversations.filter(conv =>
        (conv.title || '').toLowerCase().includes(query)
      );
    }

    return conversations;
  }

  // Filtered workflows based on status
  get filteredWorkflows() {
    let workflows = this.userWorkflows;

    // Apply status filter (skip if 'all')
    if (this.workflowFilter !== 'all') {
      switch (this.workflowFilter) {
        case 'active':
          workflows = workflows.filter(w => w.status === 'RUNNING');
          break;
        case 'pending':
          workflows = workflows.filter(w => w.status === 'PENDING' || w.status === 'WAITING_USER');
          break;
        case 'completed':
          workflows = workflows.filter(w => w.status === 'COMPLETED');
          break;
      }
    }

    // Apply search filter
    if (this.workflowSearchQuery.trim()) {
      const query = this.workflowSearchQuery.toLowerCase();
      workflows = workflows.filter(w =>
        (w.template?.name || '').toLowerCase().includes(query)
      );
    }

    return workflows;
  }

  // User input
  customPrompt = '';
  followUpMessage = '';

  // Prompt enhancement state
  isEnhancingPrompt = false;
  promptWasEnhanced = false;

  // Follow-up questions (migrated to observable from StateService)
  followUpQuestions$ = this.stateService.followUpQuestions$;

  // Jurisdiction — only states with working direct citation links + Federal
  selectedJurisdiction = 'Massachusetts'; // will be overridden from org state on init
  jurisdictions = [
    'Federal', 'Florida', 'Massachusetts', 'New York', 'Texas'
  ];

  // Research Mode — unified mode, always THOROUGH
  selectedResearchMode: ResearchMode = ResearchMode.Thorough;

  // Document editor modal
  editorModalOpen = false;
  editorDocumentId = '';
  editorDocumentTitle = '';
  editorDocumentContent = '';

  // Split-view drafting mode state (migrated to observable from StateService)
  currentDocument$ = this.stateService.currentDocument$;

  // Legacy document properties for backwards compatibility (accessing from state service)
  get activeDocumentTitle(): string {
    return this.stateService.getCurrentDocument().title;
  }
  set activeDocumentTitle(value: string) {
    this.stateService.setCurrentDocument({ title: value });
  }

  // Document content and metadata (simple properties, not getters/setters)
  activeDocumentContent = '';
  currentDocumentWordCount = 0;
  currentDocumentPageCount = 0;

  // Pending document content - stores markdown content before editor is ready
  // This eliminates placeholder delay by loading content immediately in onEditorCreated()
  private pendingDocumentContent: string | null = null;

  // Original template HTML — stored when document is template-generated.
  // Used for PDF export to bypass CKEditor's formatting destruction.
  // Persists across version restores and transformations for the SAME document.
  private originalTemplateHtml: string | null = null;
  private originalTemplateDocId: number | string | null = null;

  // Track setTimeout ID for content loading to prevent race conditions
  private contentLoadTimeoutId: number | null = null;

  // Draft streaming SSE connection
  private draftEventSource: EventSource | null = null;
  // Word count tracker for streaming tokens
  private streamWordCount = 0;
  // Tracks whether the 'complete' SSE event was received before connection closed
  private draftStreamCompleted = false;
  // Polling interval ID for draft recovery (cleared on destroy)
  private draftPollInterval: ReturnType<typeof setInterval> | null = null;
  // Pending draft content to load into editor once created
  private pendingDraftContent: string | null = null;

  get currentDocumentId(): string | number | null {
    return this.stateService.getCurrentDocument().id;
  }
  set currentDocumentId(value: string | number | null) {
    this.stateService.setCurrentDocument({ id: value });
  }

  get documentMetadata(): any {
    return this.stateService.getCurrentDocument().metadata;
  }
  set documentMetadata(value: any) {
    this.stateService.updateDocumentMetadata(value);
  }

  currentDate = new Date();

  // Computed last saved time for compact header
  get lastSavedTime(): string {
    const lastSaved = this.documentMetadata?.lastSaved;
    if (!lastSaved) return '';
    const now = new Date();
    const diff = Math.floor((now.getTime() - new Date(lastSaved).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(lastSaved).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Active TOC item tracking (updated by scroll spy as user scrolls the document)
  activeTocId: string | null = null;

  // Scroll spy: tracks which heading is visible in the editor viewport
  private scrollSpyFrameId: number | null = null;
  private scrollSpyListener: (() => void) | null = null;
  private scrollSpyElement: HTMLElement | null = null;
  private scrollSpySuppressed = false;

  // Exhibit viewer panel width (null = use CSS default %, set on manual resize)
  exhibitPanelWidth: number | null = null;
  private isResizing = false;
  private resizeStartX = 0;
  private resizeStartWidth = 0;

  // Sidebar collapse state (auto-collapses when exhibit panel opens)
  sidebarOverlayOpen = false;
  sidebarOverlayTab: 'contents' | 'exhibits' = 'contents';

  // Cached sanitized URL to prevent iframe reload on every change detection
  private cachedExhibitUrl = '';
  cachedSafeUrl: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl('about:blank');

  // Recent drafts
  recentDrafts: any[] = [];
  loadingDrafts = false;

  // Current user from authentication service
  currentUser: any = null;

  // Case selection for draft generation
  selectedCaseId: number | null = null;
  userCases: any[] = [];

  // Add Exhibit Modal state
  showAddExhibitModal = false;
  addExhibitTab: 'case' | 'upload' = 'case';
  caseDocuments: any[] = [];
  selectedCaseDocs: any[] = [];
  caseDocSearchTerm = '';
  pendingUploadFiles: File[] = [];
  addingExhibits = false;
  isDraggingExhibit = false;
  exhibitModalCaseId: number | null = null;
  loadingCaseDocs = false;

  // Upload document functionality
  createCollectionOnUpload = false;
  newCollectionName = '';
  bulkUploadCollectionId: number | null = null;
  isBatchProcessing = false;
  private currentAnalysisTaskId: string | null = null; // Background task ID for document analysis

  // Collection selection for upload
  selectedUploadCollectionId: number | string | null = null;  // number for existing, 'new' for create new
  newUploadCollectionName = '';

  // Collection viewer state
  isViewingCollection = false;
  activeCollectionId: number | null = null;

  uploadedFiles: Array<{
    name: string;
    size: number;
    type: string;
    status: 'ready' | 'uploading' | 'analyzing' | 'completed' | 'failed';
    file?: File;
    analysisId?: string;
    progress?: number;
    detectedType?: string;
    isOCR?: boolean;
    metadata?: {
      parties?: string;
      date?: string;
      court?: string;
      caseNumber?: string;
    };
  }> = [];
  isDragover: boolean = false;
  selectedAnalysisType: string = 'summarize';

  // Analysis Context Selection (Phase 1 Enhancement)
  selectedAnalysisContext: 'respond' | 'negotiate' | 'client_review' | 'due_diligence' | 'general' = 'general';
  showContextSelection: boolean = false;

  analysisContextOptions = [
    {
      id: 'respond' as const,
      label: 'Respond to this',
      sublabel: 'Received from opposing party',
      icon: 'ri-reply-line',
      description: 'Analyze for response strategy, deadlines, weaknesses to exploit, and counter-arguments'
    },
    {
      id: 'negotiate' as const,
      label: 'Review & Negotiate',
      sublabel: 'Redline suggestions',
      icon: 'ri-edit-2-line',
      description: 'Identify unfavorable terms, suggest specific redlines, and negotiation priorities'
    },
    {
      id: 'client_review' as const,
      label: 'Explain to Client',
      sublabel: 'Plain language summary',
      icon: 'ri-user-voice-line',
      description: 'Clear explanation in plain language with key obligations, risks, and recommended actions'
    },
    {
      id: 'due_diligence' as const,
      label: 'Due Diligence',
      sublabel: 'Transaction review',
      icon: 'ri-shield-check-line',
      description: 'Risk matrix, red flags, issues by category, and deal-breaker analysis'
    },
    {
      id: 'general' as const,
      label: 'General Analysis',
      sublabel: 'Comprehensive review',
      icon: 'ri-file-list-3-line',
      description: 'Full strategic analysis without specific context (default)'
    }
  ];
  documentUrl: string = '';
  isFetchingUrl: boolean = false;

  // CKEditor 5 instance and config
  @ViewChild('documentEditor') documentEditor?: any;
  editorInstance: ClassicEditor | null = null; // Direct reference to CKEditor instance
  documentEditorClass = ClassicEditor;

  editorConfig: EditorConfig = {
    licenseKey: 'GPL',
    plugins: [
      Essentials, Bold, Italic, Underline, Strikethrough,
      Heading, Paragraph, BlockQuote, HorizontalLine, Link, List, Table,
      TableToolbar, TableProperties, TableCellProperties, Alignment, Indent,
      IndentBlock, Font, FindAndReplace, Highlight, GeneralHtmlSupport,
      PasteFromOffice, RemoveFormat, Undo,
      Image, ImageInsert, ImageResize, ImageStyle, ImageToolbar, Base64UploadAdapter
    ],
    toolbar: {
      items: [
        'undo', 'redo', '|',
        'heading', 'fontSize', '|',
        'bold', 'italic', 'underline', 'strikethrough', '|',
        'fontColor', 'fontBackgroundColor', 'highlight', '|',
        'link', 'blockQuote', 'horizontalLine', '|',
        'alignment', '|',
        'bulletedList', 'numberedList', 'outdent', 'indent', '|',
        'insertTable', '|',
        'findAndReplace', 'removeFormat'
      ],
      shouldNotGroupWhenFull: false
    },
    heading: {
      options: [
        { model: 'paragraph' as const, title: 'Paragraph', class: 'ck-heading_paragraph' },
        { model: 'heading1' as const, view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
        { model: 'heading2' as const, view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
        { model: 'heading3' as const, view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' },
        { model: 'heading4' as const, view: 'h4', title: 'Heading 4', class: 'ck-heading_heading4' }
      ]
    },
    fontSize: {
      options: [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36],
      supportAllValues: true
    },
    table: {
      contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells', 'tableProperties', 'tableCellProperties']
    },
    link: {
      defaultProtocol: 'https://',
      decorators: {
        openInNewTab: {
          mode: 'manual' as const,
          label: 'Open in new tab',
          defaultValue: true,
          attributes: {
            target: '_blank',
            rel: 'noopener noreferrer'
          }
        }
      }
    },
    highlight: {
      options: [
        { model: 'greenMarker' as const, class: 'marker-green', title: 'Green marker', color: '#d4edda', type: 'marker' as const },
        { model: 'yellowMarker' as const, class: 'marker-yellow', title: 'Yellow marker', color: '#fff3cd', type: 'marker' as const }
      ]
    },
    image: {
      toolbar: ['imageStyle:inline', 'imageStyle:block', 'imageStyle:side', '|', 'imageTextAlternative'],
      insert: { type: 'auto' }
    },
    htmlSupport: {
      allow: [
        { name: 'span', classes: true, styles: true, attributes: true },
        { name: 'a', classes: true, attributes: true, styles: true },
        { name: /^(div|section|article)$/, classes: true, styles: true, attributes: true },
        { name: /^(table|thead|tbody|tr|th|td)$/, classes: true, styles: true, attributes: true },
        { name: /^(h[1-6]|p|blockquote|pre|ul|ol|li)$/, classes: true, styles: true, attributes: true },
        { name: 'figure', classes: true, styles: true, attributes: true },
        { name: 'mark', classes: true, styles: true, attributes: true },
        { name: 'img', classes: true, styles: true, attributes: true },
        { name: 'strong', classes: true, styles: true, attributes: true }
      ]
    },
    placeholder: 'Your generated document will appear here...'
  };

  // Force editor recreation when switching documents by toggling this flag
  // Toggling OFF→ON forces Angular to destroy and recreate the component
  // MUST BE PUBLIC for template access
  showEditor = true;

  // Text selection tracking
  selectedText: string = '';
  selectionRange: { index: number; length: number } | null = null;

  // Multi-state floating inline toolbar
  floatingToolbarState: 'idle' | 'quick_actions' | 'prompt_editing' | 'loading' | 'preview' = 'idle';
  floatingToolbarPosition: { top: number; left: number } | null = null;
  floatingPromptText = '';
  showMoreTools = false;
  aiPreviewResponse = '';
  aiPreviewToolType = '';   // 'polish' | 'condense' | 'advocate' | 'elaborate' | 'custom'

  /** Formatted preview: converts markdown tables to HTML, keeps text as escaped paragraphs */
  get aiPreviewHtml(): string {
    if (!this.aiPreviewResponse) return '';
    const blocks = this.aiPreviewResponse.split(/\r?\n\r?\n+/).filter((t: string) => t.trim());
    const escHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return blocks.map(block => {
      if (this.isMarkdownTable(block)) {
        // Strip <figure> wrapper — Angular sanitizer may remove it; only need <table> for preview
        return this.markdownTableToHtml(block)
          .replace(/<figure[^>]*>/, '').replace(/<\/figure>/, '');
      }
      return `<p>${escHtml(block).replace(/\n/g, '<br>')}</p>`;
    }).join('');
  }
  lastPromptText = '';       // For "Refine Prompt" — remembers last prompt
  private documentMousedownHandler: ((e: MouseEvent) => void) | null = null;
  private _lastMousedownInsideEditor = false;
  private _ignoreSelectionChanges = 0; // Counter: skip N change:range events when we deliberately modify selection
  private _cachedSelectionRect: DOMRect | null = null; // Cached for repositioning in preview state
  private originalSelectionBlocks: Array<{ type: string }> = [];

  // Pending transformation - stored in message with unique ID
  private transformationMessageIdCounter = 0;

  // Version history (simplified for dropdown)
  documentVersions: any[] = [];
  loadingVersions = false;
  currentVersionNumber: number = 1;
  previewingVersion: any = null;

  // Stationery (DOM injection into .ck-editor__main)
  stationeryTemplates: StationeryTemplate[] = [];
  stationeryAttorneys: AttorneyInfo[] = [];
  private stationeryRenderTimeoutId: number | null = null;
  selectedStationeryTemplateId: number | null = null;
  loadingStationery = false;
  stationeryInserted = false;
  activeStationeryRendered: { letterhead: SafeHtml | null; signature: SafeHtml | null; footer: SafeHtml | null } | null = null;
  activeStationeryRawHtml: { letterhead: string; signature: string; footer: string } | null = null;
  activeStationeryTemplateId: number | null = null;
  activeStationeryAttorneyId: number | null = null;
  // One-click stationery UX
  myAttorneyProfile: AttorneyInfo | null = null;
  defaultStationeryTemplate: StationeryTemplate | null = null;
  autoStationeryReady = false;
  showAdvancedStationery = false;
  activeAttorneyName = '';

  @ViewChild('transformationPreviewModal') transformationPreviewModal!: TemplateRef<any>;
  @ViewChild('howItWorksModal') howItWorksModal!: TemplateRef<any>;
  @ViewChild('promptTipsModal') promptTipsModal!: TemplateRef<any>;
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  // UI Controls
  editorTextSize: number = 14; // Default font size in px
  isSaving = false;

  // Inline change review state
  pendingChanges: {
    originalContent: string;
    transformedContent: string;  // Store transformed HTML for redo
    changeCount: number;
    type: string; // 'simplify', 'condense', 'expand', 'redraft', 'custom'
    response: any;
    isUndone: boolean;           // Toggled by undo/redo
  } | null = null;
  private pendingChangesAutoTimer: any = null;
  private _applyingPendingChange = false; // Flag to prevent change:data listener from firing during undo/redo
  showDocumentPreviewModal = false; // PDF preview modal state
  previewPdfUrl: string | null = null; // Blob URL for PDF preview
  sanitizedPreviewUrl: SafeResourceUrl | null = null; // Sanitized URL for iframe binding
  isLoadingPreview = false; // Loading state for PDF generation
  previewPdfBlob: Blob | null = null; // Cached PDF blob for download

  // Mobile sidebar state (migrated to observable from StateService)
  sidebarOpen$ = this.stateService.sidebarOpen$;

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

  // Document types - Enhanced with field configurations
  documentTypes: DocumentTypeConfig[] = [
    // Discovery Documents
    {
      id: 'interrogatories',
      name: 'Interrogatories',
      description: 'Generate discovery interrogatories with AI assistance',
      icon: 'ri-question-line',
      color: 'primary',
      category: 'Discovery',
      practiceAreas: ['civil', 'criminal', 'employment'],
      popular: true,
      jurisdictionRequired: true,
      estimatedTime: '3-5 minutes',
      complexity: 'moderate',
      templateId: 1,
      requiredFields: [
        {
          id: 'case_name',
          label: 'Case Name',
          type: 'text',
          placeholder: 'e.g., Smith v. Johnson',
          validation: { required: true, minLength: 3 }
        },
        {
          id: 'case_number',
          label: 'Case Number',
          type: 'text',
          placeholder: 'e.g., CV-2024-12345',
          validation: { required: true }
        },
        {
          id: 'party_type',
          label: 'Propounding Party',
          type: 'select',
          options: ['Plaintiff', 'Defendant', 'Cross-Complainant', 'Third-Party Defendant'],
          validation: { required: true }
        },
        {
          id: 'case_facts',
          label: 'Brief Case Summary',
          type: 'textarea',
          placeholder: 'Summarize the key facts and issues in this case...',
          rows: 4,
          helperText: 'Provide context to generate relevant interrogatories',
          validation: { required: true, minLength: 100, maxLength: 2000 }
        },
        {
          id: 'discovery_focus',
          label: 'Discovery Focus Areas',
          type: 'multiselect',
          options: ['Liability', 'Damages', 'Causation', 'Affirmative Defenses', 'Expert Witnesses', 'Document Production'],
          validation: { required: true }
        }
      ],
      optionalFields: [
        {
          id: 'number_of_interrogatories',
          label: 'Number of Interrogatories',
          type: 'number',
          defaultValue: 25,
          helperText: 'Maximum allowed by jurisdiction',
          validation: { required: false, min: 1, max: 50 }
        },
        {
          id: 'specific_issues',
          label: 'Specific Issues to Address',
          type: 'textarea',
          placeholder: 'Any specific topics or questions you want included...',
          rows: 3
        }
      ]
    },
    {
      id: 'requests-production',
      name: 'Requests for Production',
      description: 'Draft document production requests',
      icon: 'ri-file-list-3-line',
      color: 'primary',
      category: 'Discovery',
      practiceAreas: ['civil', 'employment'],
      popular: false,
      jurisdictionRequired: true,
      estimatedTime: '2-4 minutes',
      complexity: 'simple',
      requiredFields: [],
      optionalFields: []
    },
    {
      id: 'requests-admission',
      name: 'Requests for Admission',
      description: 'Create requests for admission of facts',
      icon: 'ri-checkbox-multiple-line',
      color: 'primary',
      category: 'Discovery',
      practiceAreas: ['civil'],
      popular: false,
      jurisdictionRequired: true,
      estimatedTime: '2-4 minutes',
      complexity: 'simple',
      requiredFields: [],
      optionalFields: []
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
      popular: true,
      jurisdictionRequired: true,
      estimatedTime: '5-8 minutes',
      complexity: 'complex',
      templateId: 2,
      requiredFields: [
        {
          id: 'case_name',
          label: 'Case Name',
          type: 'text',
          placeholder: 'e.g., Smith v. Johnson',
          validation: { required: true }
        },
        {
          id: 'case_number',
          label: 'Case Number',
          type: 'text',
          placeholder: 'e.g., CV-2024-12345',
          validation: { required: true }
        },
        {
          id: 'court',
          label: 'Court',
          type: 'text',
          placeholder: 'e.g., United States District Court for the Southern District of New York',
          validation: { required: true }
        },
        {
          id: 'grounds',
          label: 'Grounds for Dismissal',
          type: 'multiselect',
          options: [
            'Lack of subject matter jurisdiction',
            'Lack of personal jurisdiction',
            'Improper venue',
            'Failure to state a claim',
            'Failure to join required party',
            'Insufficient service of process'
          ],
          validation: { required: true }
        },
        {
          id: 'facts',
          label: 'Relevant Facts',
          type: 'textarea',
          placeholder: 'Describe the factual basis for the motion...',
          rows: 5,
          validation: { required: true, minLength: 200 }
        },
        {
          id: 'legal_argument',
          label: 'Legal Argument Summary',
          type: 'textarea',
          placeholder: 'Outline the key legal arguments supporting dismissal...',
          rows: 5,
          helperText: 'The AI will expand this with case law and statutory references',
          validation: { required: true, minLength: 150 }
        }
      ],
      optionalFields: [
        {
          id: 'key_precedents',
          label: 'Key Precedent Cases (optional)',
          type: 'textarea',
          placeholder: 'List any specific cases you want cited...',
          rows: 3
        },
        {
          id: 'hearing_requested',
          label: 'Request Oral Argument?',
          type: 'select',
          options: ['Yes', 'No'],
          defaultValue: 'Yes'
        }
      ]
    },
    {
      id: 'motion-summary-judgment',
      name: 'Motion for Summary Judgment',
      description: 'Prepare summary judgment motions',
      icon: 'ri-gavel-line',
      color: 'success',
      category: 'Motions',
      practiceAreas: ['civil'],
      popular: true,
      jurisdictionRequired: true,
      estimatedTime: '6-10 minutes',
      complexity: 'complex',
      requiredFields: [],
      optionalFields: []
    },
    {
      id: 'motion-suppress',
      name: 'Motion to Suppress',
      description: 'Draft motions to suppress evidence',
      icon: 'ri-file-shield-line',
      color: 'success',
      category: 'Motions',
      practiceAreas: ['criminal'],
      popular: false,
      jurisdictionRequired: true,
      estimatedTime: '5-8 minutes',
      complexity: 'complex',
      requiredFields: [],
      optionalFields: []
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
      popular: true,
      jurisdictionRequired: true,
      estimatedTime: '7-12 minutes',
      complexity: 'complex',
      requiredFields: [],
      optionalFields: []
    },
    {
      id: 'answer',
      name: 'Answer',
      description: 'Prepare answers to complaints',
      icon: 'ri-file-copy-2-line',
      color: 'warning',
      category: 'Pleadings',
      practiceAreas: ['civil'],
      popular: false,
      jurisdictionRequired: true,
      estimatedTime: '5-8 minutes',
      complexity: 'moderate',
      requiredFields: [],
      optionalFields: []
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
      popular: true,
      jurisdictionRequired: true,
      estimatedTime: '8-15 minutes',
      complexity: 'complex',
      requiredFields: [],
      optionalFields: []
    },
    {
      id: 'appellate-brief',
      name: 'Appellate Brief',
      description: 'Draft appellate briefs for appeals',
      icon: 'ri-booklet-line',
      color: 'info',
      category: 'Briefs',
      practiceAreas: ['civil', 'criminal'],
      popular: false,
      jurisdictionRequired: true,
      estimatedTime: '10-20 minutes',
      complexity: 'complex',
      requiredFields: [],
      optionalFields: []
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
      popular: true,
      jurisdictionRequired: true,
      estimatedTime: '4-7 minutes',
      complexity: 'moderate',
      requiredFields: [],
      optionalFields: []
    },
    {
      id: 'nda',
      name: 'Non-Disclosure Agreement',
      description: 'Draft confidentiality agreements',
      icon: 'ri-file-lock-line',
      color: 'purple',
      category: 'Contracts',
      practiceAreas: ['corporate'],
      popular: true,
      jurisdictionRequired: true,
      estimatedTime: '3-5 minutes',
      complexity: 'simple',
      requiredFields: [],
      optionalFields: []
    },
    {
      id: 'purchase-agreement',
      name: 'Purchase Agreement',
      description: 'Create sale and purchase agreements',
      icon: 'ri-shopping-bag-line',
      color: 'purple',
      category: 'Contracts',
      practiceAreas: ['corporate', 'real-estate'],
      popular: false,
      jurisdictionRequired: true,
      estimatedTime: '5-8 minutes',
      complexity: 'moderate',
      requiredFields: [],
      optionalFields: []
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
      popular: true,
      jurisdictionRequired: true,
      estimatedTime: '6-10 minutes',
      complexity: 'complex',
      requiredFields: [],
      optionalFields: []
    },
    {
      id: 'custody-agreement',
      name: 'Custody Agreement',
      description: 'Create child custody agreements',
      icon: 'ri-user-heart-line',
      color: 'danger',
      category: 'Family Law',
      practiceAreas: ['family'],
      popular: false,
      jurisdictionRequired: true,
      estimatedTime: '5-8 minutes',
      complexity: 'moderate',
      requiredFields: [],
      optionalFields: []
    }
  ];

  constructor(
    private legalResearchService: LegalResearchService,
    private documentGenerationService: DocumentGenerationService,
    private userService: UserService,
    private legalCaseService: LegalCaseService,
    private markdownConverter: MarkdownConverterService,
    private cdr: ChangeDetectorRef,
    private modalService: NgbModal,
    private fileManagerService: FileManagerService,
    private documentAnalyzerService: DocumentAnalyzerService,
    private collectionService: DocumentCollectionService,
    // NEW: Refactored services
    private notificationService: NotificationService,
    private ckEditorService: CKEditorService,
    private stateService: AiWorkspaceStateService,
    private conversationOrchestration: ConversationOrchestrationService,
    private transformationService: DocumentTransformationService,
    private route: ActivatedRoute,
    private router: Router,
    public caseWorkflowService: CaseWorkflowService,
    private backgroundTaskService: BackgroundTaskService,
    private sanitizer: DomSanitizer,
    public exhibitPanelService: ExhibitPanelService,
    private caseDocumentsService: CaseDocumentsService,
    private stationeryService: StationeryService,
    private organizationService: OrganizationService
  ) {}

  /**
   * Keyboard shortcut: Ctrl+S - Save version
   */
  @HostListener('window:keydown.control.s', ['$event'])
  @HostListener('window:keydown.meta.s', ['$event']) // For Mac
  handleSaveShortcut(event: KeyboardEvent): void {
    if (this.stateService.getDraftingMode() && this.currentDocumentId) {
      event.preventDefault();
      this.openSaveVersionModal();
    }
  }

  /**
   * Close dropdown when clicking outside
   */
  @HostListener('document:click', ['$event'])
  handleClickOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const dropdown = document.querySelector('.custom-dropdown-wrapper');
    if (dropdown && !dropdown.contains(target)) {
      this.showDocTypeDropdown = false;
    }
  }


  // State code → full name mapping for org state resolution
  private stateCodeToName: Record<string, string> = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'DC': 'District of Columbia',
    'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois',
    'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana',
    'ME': 'Maine', 'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota',
    'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
    'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
    'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon',
    'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota',
    'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia',
    'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
  };

  ngOnInit(): void {
    // Set default jurisdiction from organization state
    const orgId = this.organizationService.getCurrentOrganizationId();
    if (orgId) {
      this.organizationService.getOrganizationById(orgId)
        .pipe(takeUntil(this.destroy$))
        .subscribe(org => {
          if (org?.state && this.stateCodeToName[org.state]) {
            this.selectedJurisdiction = this.stateCodeToName[org.state];
            this.cdr.markForCheck();
          }
        });
    }

    // ===== REACTIVE CONVERSATIONS SUBSCRIPTION =====
    // Subscribe to conversations changes to update filtered arrays reactively
    this.conversations$
      .pipe(takeUntil(this.destroy$))
      .subscribe(conversations => {
        this.questionConversations = conversations.filter(c => c.type === ConversationType.Question);
        this.draftConversations = conversations.filter(c => c.type === ConversationType.Draft);
        this.cdr.detectChanges();
      });

    // ===== FULL-PAGE DRAFTING MODE — BODY CLASS TOGGLE =====
    // When drafting mode activates, add class to body to hide the app shell (header, nav, footer)
    this.draftingMode$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isDrafting => {
        if (isDrafting) {
          document.body.classList.add('ai-drafting-fullpage');
        } else {
          document.body.classList.remove('ai-drafting-fullpage');
        }
      });

    // ===== RESET SIDEBAR OVERLAY WHEN EXHIBIT PANEL CLOSES =====
    this.exhibitPanelService.panelOpen$
      .pipe(takeUntil(this.destroy$))
      .subscribe(open => {
        if (!open) {
          this.sidebarOverlayOpen = false;
          this.exhibitPanelWidth = null; // Reset to CSS default on close
        }
      });

    // ===== BACKGROUND TASK SERVICE SETUP =====
    // Mark that user is on AI Workspace (suppresses notifications while on this page)
    this.backgroundTaskService.setIsOnAiWorkspace(true);
    this.backgroundTaskService.cleanupStaleTasks();

    // Subscribe to completed background tasks
    this.backgroundTaskService.completedTask$
      .pipe(takeUntil(this.destroy$))
      .subscribe(task => {
        this.handleCompletedBackgroundTask(task);
      });

    // Check for any tasks that completed while user was away
    this.checkForCompletedBackgroundTasks();

    // ===== ALWAYS CLEAR STALE STATE ON NAVIGATION =====
    // Background tasks run independently - the user should see a fresh workspace
    // They can check task status via the Background Tasks Indicator in the topbar
    // This prevents showing "Generating response" when returning after navigating away
    this.stateService.clearStaleGenerationState();

    // ===== STATE SYNCHRONIZATION =====
    // Restore selectedTask based on current state mode
    // This ensures sidebar shows correct content when navigating back to workspace
    this.syncSelectedTaskWithState();

    // Subscribe to UserService userData$ observable for reactive updates
    this.userService.userData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        // Scope background tasks to the current user
        if (user && user.id) {
          this.backgroundTaskService.setCurrentUserId(user.id);
          this.loadUserCases();
          this.loadAnalysisHistoryOnce();
        }
      });

    // Load current user immediately from UserService
    this.currentUser = this.userService.getCurrentUser();

    // If user is null but we have a token, fetch user profile from backend
    if (!this.currentUser && this.userService.isAuthenticated()) {
      this.userService.profile$()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response && response.data && response.data.user) {
              this.currentUser = response.data.user;
              // Load user-specific data after user is loaded
              this.loadUserCases();
              this.loadAnalysisHistoryOnce();
            }
          },
          error: () => { /* Error handled silently */ }
        });
    }

    // Load conversations for the default task type
    this.loadConversations();

    // Check for pending navigation from background task service (View Result button)
    this.checkPendingNavigation();

    // Load analysis history for sidebar (Recent Documents section)
    // Only load if user is already available; otherwise it's loaded in userData$ subscription
    if (this.currentUser && this.currentUser.id) {
      this.loadAnalysisHistoryOnce();
    }

    // Load collections for sidebar
    this.loadCollections();

    // Load workflow templates for Case Workflow
    this.loadWorkflowTemplates();

    // Load workflow recommendations for suggestions panel
    this.loadWorkflowRecommendations();

    // Load user's workflow executions
    this.loadUserWorkflows();

    // Load user's cases for case selector if user already available
    if (this.currentUser && this.currentUser.id) {
      this.loadUserCases();
    }

    // Handle query params (caseId, openConversation, openWorkflow from notifications)
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      // Handle caseId from Case Details page
      if (params['caseId']) {
        const caseId = parseInt(params['caseId'], 10);
        if (!isNaN(caseId)) {
          this.selectedCaseId = caseId;
        }
      }

      // Handle openConversation from background task notification
      if (params['openConversation']) {
        const conversationId = params['openConversation'];
        const taskType = params['taskType'];
        const backendId = params['backendId'] ? parseInt(params['backendId'], 10) : undefined;

        // Wait for conversations to load, then open the specified one with retry logic
        this.openConversationWithRetry(conversationId, taskType, 0, backendId);
      }

      // Handle openWorkflow from background task notification
      if (params['openWorkflow']) {
        const workflowId = parseInt(params['openWorkflow'], 10);
        if (!isNaN(workflowId)) {
          this.selectedTask = ConversationType.Workflow;

          // Wait for workflows to load, then open details
          setTimeout(() => {
            const workflow = this.userWorkflows.find(w => w.id === workflowId);
            if (workflow) {
              this.viewWorkflowDetails(workflow);
            } else {
              // Load the workflow directly
              this.caseWorkflowService.getExecutionWithSteps(workflowId)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                  next: (executionWithSteps) => {
                    this.selectedWorkflowForDetails = executionWithSteps;
                    this.showWorkflowDetailsPage = true;
                    this.cdr.detectChanges();
                  },
                  error: () => { /* Error handled silently */ }
                });
            }
          }, 500);
        }
      }
    });
  }

  /**
   * Open a conversation with retry logic (handles async conversation loading)
   * @param conversationId - Frontend conversation ID (may be temp ID like conv_xxx_abc)
   * @param taskType - Type of task (draft, question, etc.)
   * @param retryCount - Current retry attempt
   * @param backendConversationId - Backend ID to match against (more reliable after page reload)
   */
  private openConversationWithRetry(conversationId: string, taskType?: string, retryCount: number = 0, backendConversationId?: number): void {
    const MAX_RETRIES = 5;
    const RETRY_DELAY = 500;

    // Find the conversation in our list
    const conversations = this.stateService.getConversations();

    let conversation = conversations.find(c => c.id === conversationId);

    // CRITICAL: Also try to find by backendConversationId (most reliable after page reload)
    // Frontend IDs are regenerated on reload, but backend IDs persist
    if (!conversation && backendConversationId) {
      conversation = conversations.find(c => c.backendConversationId === backendConversationId);
    }

    // Also try other formats for compatibility
    if (!conversation) {
      conversation = conversations.find(c =>
        c.id === `conv_${conversationId}` ||
        c.backendConversationId?.toString() === conversationId ||
        conversationId.includes(c.backendConversationId?.toString() || 'NOMATCH')
      );
    }

    if (conversation) {
      // Set the correct task type
      if (taskType === 'draft' || conversation.taskType === 'GENERATE_DRAFT') {
        this.selectedTask = ConversationType.Draft;
        this.activeTask = ConversationType.Draft;
      } else {
        this.selectedTask = ConversationType.Question;
        this.activeTask = ConversationType.Question;
      }

      // Open the conversation
      this.switchConversation(conversation.id);
      this.cdr.detectChanges();
    } else if (retryCount < MAX_RETRIES) {
      // Retry after delay
      setTimeout(() => {
        this.openConversationWithRetry(conversationId, taskType, retryCount + 1, backendConversationId);
      }, RETRY_DELAY);
    } else {
      // Show the Question tab so user can see their conversations
      this.selectedTask = taskType === 'draft' ? ConversationType.Draft : ConversationType.Question;
      this.notificationService.warning('Conversation Not Found', 'The conversation may have been deleted or is still loading.');
    }
  }

  /**
   * Open a conversation by ID (called from notification navigation) - legacy method
   */
  private openConversationById(conversationId: string, taskType?: string): void {
    this.openConversationWithRetry(conversationId, taskType, 0);
  }

  /**
   * Check for pending navigation from BackgroundTaskService (View Result button)
   */
  private checkPendingNavigation(): void {
    const pendingNav = this.backgroundTaskService.getPendingNavigation();
    if (pendingNav) {
      // Handle conversation navigation
      if (pendingNav.conversationId || pendingNav.backendConversationId) {
        // Wait for conversations to load with retry - pass backendConversationId for reliable matching
        this.openConversationWithRetry(
          pendingNav.conversationId || '',
          pendingNav.taskType,
          0,
          pendingNav.backendConversationId
        );
      }
      // Handle workflow navigation
      else if (pendingNav.workflowId) {
        this.selectedTask = ConversationType.Workflow;

        // Wait for workflows to load, then open details
        setTimeout(() => {
          const workflow = this.userWorkflows.find(w => w.id === pendingNav.workflowId);
          if (workflow) {
            this.viewWorkflowDetails(workflow);
          } else {
            // Load the workflow directly from API
            this.caseWorkflowService.getExecutionWithSteps(pendingNav.workflowId!)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (executionWithSteps) => {
                  this.selectedWorkflowForDetails = executionWithSteps;
                  this.showWorkflowDetailsPage = true;
                  this.cdr.detectChanges();
                },
                error: () => { /* Error handled silently */ }
              });
          }
        }, 1000);
      }
      // Handle analysis navigation
      else if (pendingNav.taskType === 'analysis' && pendingNav.analysisIds && pendingNav.analysisIds.length > 0) {
        this.selectedTask = ConversationType.Upload;

        // Display the last analysis result - use databaseId for API call
        const lastResult = pendingNav.analysisIds[pendingNav.analysisIds.length - 1];
        const analysisId = lastResult.databaseId ? lastResult.databaseId.toString() : lastResult.id;

        this.documentAnalyzerService.getAnalysisById(analysisId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (fullResult) => {
              // Pass false to suppress notification - background task toast already notified user
              this.displayAnalysisResults(fullResult, false);
              this.cdr.detectChanges();
            },
            error: () => {
              // Fallback: just refresh the analysis history
              this.loadAnalysisHistory();
            }
          });
      }
    }
  }

  /**
   * Synchronize selectedTask with the current state mode
   * Called on init and when state changes to ensure sidebar shows correct content
   */
  private syncSelectedTaskWithState(): void {
    // If in document viewer mode OR there's an active document, validate and set upload mode
    if (this.stateService.getDocumentViewerMode() || this.stateService.getActiveDocumentId()) {
      const activeDocId = this.stateService.getActiveDocumentId();
      const activeDoc = activeDocId ? this.stateService.getActiveDocument() : null;

      // Validate that active document actually exists
      if (activeDocId && !activeDoc) {
        this.stateService.closeDocumentViewer();
        // Fall through to default task selection
      } else {
        this.selectedTask = ConversationType.Upload;
        this.activeTask = ConversationType.Upload;
        return;
      }
    }

    // If in drafting mode, validate there's an active conversation
    if (this.stateService.getDraftingMode()) {
      const activeConvId = this.stateService.getActiveConversationId();
      if (activeConvId) {
        this.selectedTask = ConversationType.Draft;
        this.activeTask = ConversationType.Draft;
        return;
      } else {
        // Drafting mode but no conversation - reset
        this.stateService.setDraftingMode(false);
        this.stateService.setShowChat(false);
        // Fall through to default task selection
      }
    }

    // Clear any stale chat state if not in a valid mode
    // This prevents showing old conversation when returning to workspace
    if (this.stateService.getShowChat() && !this.stateService.getActiveConversationId()) {
      this.stateService.setShowChat(false);
      this.stateService.clearConversationMessages();
    }

    // Otherwise keep current selectedTask or use default
    const storedTask = this.stateService.getSelectedTask();
    if (storedTask) {
      this.selectedTask = storedTask;
      this.activeTask = storedTask;
    }
  }

  /**
   * Validate and clean up stale UI state after data loads
   * This prevents showing old conversation data that doesn't match current task
   */
  private validateAndCleanupState(conversations: Conversation[]): void {
    const activeConvId = this.stateService.getActiveConversationId();
    const showChat = this.stateService.getShowChat();
    const selectedTask = this.selectedTask;

    // If chat is showing but no valid conversation, reset state
    if (showChat && activeConvId) {
      const activeConv = conversations.find(c => c.id === activeConvId);

      if (!activeConv) {
        // Active conversation no longer exists - reset UI state
        this.resetToWelcomeState();
        return;
      }

      // Check if active conversation type matches current selected task
      const convMatchesTask = this.conversationMatchesTask(activeConv.type, selectedTask);
      if (!convMatchesTask) {
        this.resetToWelcomeState();
        return;
      }
    }

    // If chat is showing but no active conversation ID, something is wrong
    if (showChat && !activeConvId && !this.stateService.getIsGenerating()) {
      this.resetToWelcomeState();
    }
  }

  /**
   * Check if conversation type matches the selected task type
   */
  private conversationMatchesTask(convType: ConversationType, taskType: ConversationType): boolean {
    // Question conversations match question task
    if (taskType === ConversationType.Question && convType === ConversationType.Question) {
      return true;
    }
    // Draft conversations match draft task
    if (taskType === ConversationType.Draft && convType === ConversationType.Draft) {
      return true;
    }
    // Upload/document analysis - handled separately through document viewer
    if (taskType === ConversationType.Upload && (convType === ConversationType.Upload || convType === ConversationType.Summarize)) {
      return true;
    }
    return false;
  }

  /**
   * Reset to welcome state (no active conversation, no chat)
   */
  private resetToWelcomeState(): void {
    this.stateService.setActiveConversationId(null);
    this.stateService.clearConversationMessages();
    this.stateService.setShowChat(false);
    this.stateService.setShowBottomSearchBar(false);
    this.stateService.setIsGenerating(false);
    this.stateService.setDraftingMode(false);
    this.stateService.clearFollowUpQuestions();
    this.exhibitPanelService.reset();
  }

  // Load user's cases for case selector
  loadUserCases(): void {
    if (!this.currentUser || !this.currentUser.id) {
      return;
    }

    this.legalCaseService.getAllCases(0, 100)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.userCases = response.data?.cases || response.cases || response.content || [];
        },
        error: () => {
          // Error handled silently
          this.userCases = [];
        }
      });
  }

  /**
   * Guard method to load analysis history only once during component initialization
   * Prevents duplicate calls from multiple subscriptions in ngOnInit
   */
  private loadAnalysisHistoryOnce(): void {
    if (this.analysisHistoryLoaded || !this.currentUser?.id) {
      return;
    }
    this.analysisHistoryLoaded = true;
    this.loadAnalysisHistory();
  }

  /**
   * Load analysis history from database and populate the sidebar
   */
  loadAnalysisHistory(): void {
    this.loadingAnalyses = true;
    this.documentAnalyzerService.getAnalysisHistory()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (history) => {
          // Map AnalysisHistory to AnalyzedDocument format
          const dbDocs = history.map(h => ({
            id: `analysis_${h.id}`,
            databaseId: h.id,
            fileName: h.fileName,
            fileSize: 0, // Not available in history, will be loaded on demand
            detectedType: h.detectedType || 'Document',
            riskLevel: h.riskLevel,
            analysis: h.summary ? {
              fullAnalysis: '',
              summary: h.summary
            } : undefined,
            timestamp: new Date(h.createdAt).getTime(),
            status: (h.status?.toLowerCase() === 'completed' ? 'completed' : 'failed') as 'completed' | 'failed'
          }));

          // Preserve documents that are currently being analyzed (status: 'analyzing')
          // These are local-only and won't be in the DB response yet
          const currentDocs = this.stateService.getAnalyzedDocuments();
          const analyzingDocs = currentDocs.filter(doc => doc.status === 'analyzing');

          // Merge: DB docs first, then any currently analyzing docs
          const mergedDocs = [...dbDocs, ...analyzingDocs];

          // Set to state service (this populates the sidebar)
          this.stateService.setAnalyzedDocuments(mergedDocs);
          this.loadingAnalyses = false;
          this.cdr.detectChanges();
        },
        error: () => {
          // Error handled silently
          this.loadingAnalyses = false;
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Delete an analysis from history
   */
  deleteAnalysis(doc: any): void {
    if (!doc.databaseId) {
      // No database ID, just remove from local state
      this.stateService.removeAnalyzedDocument(doc.id);
      this.notificationService.success('Deleted', `Analysis for "${doc.fileName}" removed`);
      return;
    }

    // Call backend to delete analysis and all related data
    this.documentAnalyzerService.deleteAnalysis(doc.databaseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Remove from local state after successful backend deletion
          this.stateService.removeAnalyzedDocument(doc.id);
          this.notificationService.success('Deleted', `Analysis for "${doc.fileName}" deleted successfully`);
        },
        error: (error) => {
          this.notificationService.error('Error', 'Failed to delete analysis. Please try again.');
        }
      });
  }

  /**
   * Open modal showing full analysis history
   */
  openAnalysisHistoryModal(): void {
    // TODO: Implement analysis history modal
    this.notificationService.info('Feature Being Finalized', 'Full analysis history view is being finalized');
  }

  /**
   * Load collections from database
   */
  loadCollections(): void {
    this.loadingCollections = true;
    this.collectionService.getCollections()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (collections) => {
          this.loadingCollections = false;
          this.cdr.detectChanges();
        },
        error: () => {
          // Error handled silently
          this.loadingCollections = false;
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Load workflow templates for Case Workflow feature
   */
  loadWorkflowTemplates(): void {
    this.loadingWorkflowTemplates = true;
    this.caseWorkflowService.getWorkflowTemplates()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (templates) => {
          this.workflowTemplates = templates;
          this.loadingWorkflowTemplates = false;
          this.cdr.detectChanges();
        },
        error: () => {
          // Error handled silently
          this.loadingWorkflowTemplates = false;
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Load workflow recommendations for suggestions panel
   */
  loadWorkflowRecommendations(): void {
    this.loadingRecommendations = true;
    this.caseWorkflowService.getRecommendationsForAllCases()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.workflowRecommendations = response.recommendations || [];
          this.recommendationsSummary = response.summary || null;
          this.loadingRecommendations = false;
          this.cdr.detectChanges();
        },
        error: () => {
          // Error handled silently
          this.workflowRecommendations = [];
          this.recommendationsSummary = null;
          this.loadingRecommendations = false;
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Get urgency badge color class
   */
  getUrgencyBadgeClass(urgency: string): string {
    const classes: Record<string, string> = {
      'CRITICAL': 'badge-danger',
      'HIGH': 'badge-warning',
      'MEDIUM': 'badge-soft-warning',
      'LOW': 'badge-soft-success'
    };
    return classes[urgency] || 'badge-soft-secondary';
  }

  /**
   * Get urgency badge background style
   */
  getUrgencyBadgeStyle(urgency: string): { [key: string]: string } {
    return {
      'background-color': this.caseWorkflowService.getUrgencyBadgeBgColor(urgency as WorkflowUrgency),
      'color': this.caseWorkflowService.getUrgencyBadgeTextColor(urgency as WorkflowUrgency)
    };
  }

  /**
   * Start workflow from recommendation - shows quick preview modal with auto-loaded documents
   */
  startWorkflowFromRecommendation(recommendation: WorkflowRecommendation): void {
    // Store recommendation and open quick preview modal
    this.quickPreviewRecommendation = recommendation;
    this.showQuickPreviewModal = true;
    this.loadingCaseDocuments = true;
    this.caseDocumentsForPreview = [];
    this.previewSelectedDocuments = [];

    // Find the template
    const template = this.workflowTemplates.find(t => t.id === recommendation.templateId);
    if (template) {
      this.selectedWorkflowTemplate = template;
    }

    // Load case documents
    this.caseWorkflowService.getCaseDocuments(recommendation.caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.caseDocumentsForPreview = response.documents || [];
          // Auto-select all documents
          this.previewSelectedDocuments = this.caseDocumentsForPreview.map(d => d.id);
          this.loadingCaseDocuments = false;
          this.cdr.detectChanges();
        },
        error: () => {
          // Error handled silently
          this.loadingCaseDocuments = false;
          this.cdr.detectChanges();
        }
      });

    // Load template if not found
    if (!template) {
      this.caseWorkflowService.getWorkflowTemplate(recommendation.templateId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (tmpl) => {
            this.selectedWorkflowTemplate = tmpl;
            this.cdr.detectChanges();
          },
          error: () => { /* Error handled silently */ }
        });
    }
  }

  /**
   * Toggle document selection in quick preview
   */
  togglePreviewDocument(docId: number): void {
    const index = this.previewSelectedDocuments.indexOf(docId);
    if (index > -1) {
      this.previewSelectedDocuments.splice(index, 1);
    } else {
      this.previewSelectedDocuments.push(docId);
    }
    this.cdr.detectChanges();
  }

  /**
   * Check if a document is selected in quick preview
   */
  isPreviewDocumentSelected(docId: number): boolean {
    return this.previewSelectedDocuments.includes(docId);
  }

  /**
   * Confirm and start workflow from quick preview
   */
  confirmQuickPreview(): void {
    if (!this.quickPreviewRecommendation || !this.selectedWorkflowTemplate) {
      return;
    }

    // Check if documents are required but none selected
    const requiresDocs = this.quickPreviewRecommendation.documentsRequired !== false;
    if (requiresDocs && this.previewSelectedDocuments.length === 0) {
      this.notificationService.error('Document Required', 'Please select at least one document for this workflow');
      return;
    }

    // Set up workflow and start
    this.selectedCaseId = this.quickPreviewRecommendation.caseId;
    this.workflowName = `${this.quickPreviewRecommendation.templateName} - ${this.quickPreviewRecommendation.caseNumber}`;
    this.workflowSelectedDocuments = this.previewSelectedDocuments;

    // Close quick preview and start workflow directly
    this.closeQuickPreviewModal();
    this.startWorkflow();
  }

  /**
   * Close quick preview modal and reset state
   */
  closeQuickPreviewModal(): void {
    this.showQuickPreviewModal = false;
    this.quickPreviewRecommendation = null;
    this.caseDocumentsForPreview = [];
    this.previewSelectedDocuments = [];
    this.loadingCaseDocuments = false;
    this.cdr.detectChanges();
  }

  /**
   * Navigate to upload documents for case (when no documents available)
   */
  navigateToUploadForCase(): void {
    if (this.quickPreviewRecommendation) {
      this.selectedCaseId = this.quickPreviewRecommendation.caseId;
      this.closeQuickPreviewModal();
      // Switch to upload task and trigger file upload
      this.selectedTask = ConversationType.Upload;
      // Small delay to let task switch complete
      setTimeout(() => {
        this.triggerFileUpload();
      }, 100);
    }
  }

  /**
   * Toggle recommendations panel visibility
   */
  toggleRecommendationsPanel(): void {
    this.showRecommendationsPanel = !this.showRecommendationsPanel;
    this.cdr.detectChanges();
  }

  /**
   * Get total urgent recommendations count (critical + high)
   */
  getUrgentRecommendationsCount(): number {
    if (!this.recommendationsSummary) return 0;
    return (this.recommendationsSummary.critical || 0) + (this.recommendationsSummary.high || 0);
  }

  /**
   * Load user's workflow executions
   */
  loadUserWorkflows(): void {
    this.loadingWorkflows = true;
    this.caseWorkflowService.getUserExecutions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (workflows) => {
          this.userWorkflows = workflows;
          this.loadingWorkflows = false;

          // Register any running workflows as background tasks (if not already tracked)
          const runningWorkflows = workflows.filter(w => w.status === 'RUNNING' || w.status === 'PENDING');
          runningWorkflows.forEach(workflow => {
            // Only register if not already tracked (check both local map and service)
            if (!this.workflowTaskIdMapping.has(workflow.id) && !this.backgroundTaskService.hasWorkflowTask(workflow.id)) {
              const workflowName = workflow.name || workflow.template?.name || 'Workflow';
              const taskId = this.backgroundTaskService.registerTask(
                'workflow',
                workflowName,
                `Step ${workflow.currentStep || 1} of ${workflow.totalSteps || 0}`,
                { workflowId: workflow.id }
              );
              this.backgroundTaskService.startTask(taskId);
              this.workflowTaskIdMapping.set(workflow.id, taskId);
              this.previouslyRunningWorkflowIds.add(workflow.id);
            } else if (!this.workflowTaskIdMapping.has(workflow.id)) {
              // Task exists in service but not in our map - sync the mapping
              const existingTask = this.backgroundTaskService.getTaskByWorkflowId(workflow.id);
              if (existingTask) {
                this.workflowTaskIdMapping.set(workflow.id, existingTask.id);
                this.previouslyRunningWorkflowIds.add(workflow.id);
              }
            }
          });

          // Start polling if there are running workflows
          if (runningWorkflows.length > 0) {
            this.startWorkflowPolling();
          }

          this.cdr.detectChanges();
        },
        error: () => {
          // Error handled silently
          this.loadingWorkflows = false;
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Start polling for workflow status updates
   */
  startWorkflowPolling(): void {
    if (this.workflowPollingInterval) {
      return;
    }

    // Track when polling started (minimum 10 seconds of polling)
    this.workflowPollingStartTime = Date.now();

    // Execute immediately on first call
    this.pollWorkflows();

    this.workflowPollingInterval = setInterval(() => {
      this.pollWorkflows();
    }, 2000); // Poll every 2 seconds for faster updates
  }

  /**
   * Poll workflows - separated for reuse
   */
  private pollWorkflows(): void {
    // Update the sidebar workflow list (use no-cache version for fresh data)
    this.caseWorkflowService.getUserExecutionsNoCache()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (workflows) => {
          // Active workflows include RUNNING, PENDING, and WAITING_USER
          const activeWorkflows = workflows.filter(w =>
            w.status === 'RUNNING' || w.status === 'PENDING' || w.status === 'WAITING_USER'
          );

          // Check for newly completed workflows (was tracked, now completed/failed)
          const completedWorkflows = workflows.filter(w =>
            this.previouslyRunningWorkflowIds.has(w.id) &&
            (w.status === 'COMPLETED' || w.status === 'FAILED')
          );

          // Send notifications for completed workflows
          completedWorkflows.forEach(workflow => {
            const workflowName = workflow.name || workflow.template?.name || 'Workflow';
            // Get existing task ID or create new one (for workflows started before this session)
            let taskId = this.workflowTaskIdMapping.get(workflow.id);
            if (!taskId) {
              // Workflow was started before this session - create task now
              taskId = this.backgroundTaskService.registerTask(
                'workflow',
                workflowName,
                workflow.status === 'COMPLETED' ? 'Case workflow completed' : 'Case workflow failed',
                { workflowId: workflow.id }
              );
            }

            if (workflow.status === 'COMPLETED') {
              this.backgroundTaskService.completeTask(taskId, workflow);
            } else if (workflow.status === 'FAILED') {
              this.backgroundTaskService.failTask(taskId, 'Workflow execution failed');
            }

            // Clean up tracking
            this.previouslyRunningWorkflowIds.delete(workflow.id);
            this.workflowTaskIdMapping.delete(workflow.id);
          });

          // Update tracking and progress for active workflows
          activeWorkflows.forEach(w => {
            this.previouslyRunningWorkflowIds.add(w.id);

            // Update progress/status on existing background task
            const taskId = this.workflowTaskIdMapping.get(w.id);
            if (taskId) {
              if (w.status === 'WAITING_USER') {
                // Set task to waiting status
                this.backgroundTaskService.setTaskWaiting(
                  taskId,
                  w.currentStep || 1,
                  `Step ${w.currentStep || 1} requires your review`
                );
              } else {
                // Update progress for running/pending workflows
                const progress = w.progressPercentage || Math.round((w.currentStep / w.totalSteps) * 100) || 0;
                this.backgroundTaskService.updateTaskProgress(
                  taskId,
                  progress,
                  `Step ${w.currentStep || 1} of ${w.totalSteps || 0}`
                );
              }
            }
          });

          // Update the workflows array (creates new reference for change detection)
          this.userWorkflows = [...workflows];

          // If details page is open, also refresh that
          if (this.showWorkflowDetailsPage && this.selectedWorkflowForDetails) {
            this.refreshWorkflowDetails();
          }

          // Only stop polling if:
          // 1. Minimum polling time has elapsed (10 seconds) AND
          // 2. No workflows are running AND
          // 3. Details page is not open (or the viewed workflow is completed/failed)
          const minPollingDuration = 10000; // 10 seconds minimum
          const pollingElapsed = Date.now() - this.workflowPollingStartTime;
          const hasActiveWorkflow = workflows.some(w =>
            w.status === 'RUNNING' || w.status === 'PENDING' || w.status === 'WAITING_USER'
          );
          const detailsWorkflowActive = this.showWorkflowDetailsPage &&
            this.selectedWorkflowForDetails &&
            (this.selectedWorkflowForDetails.status === 'RUNNING' ||
             this.selectedWorkflowForDetails.status === 'PENDING' ||
             this.selectedWorkflowForDetails.status === 'WAITING_USER');

          // Don't stop if minimum time hasn't elapsed
          if (pollingElapsed >= minPollingDuration && !hasActiveWorkflow && !detailsWorkflowActive) {
            this.stopWorkflowPolling();
          }

          this.cdr.detectChanges();
        },
        error: () => { /* Error handled silently */ }
      });
  }

  /**
   * Stop workflow polling
   */
  stopWorkflowPolling(): void {
    if (this.workflowPollingInterval) {
      clearInterval(this.workflowPollingInterval);
      this.workflowPollingInterval = null;
    }
  }

  /**
   * View workflow details - opens full-page view
   */
  viewWorkflowDetails(workflow: any): void {
    this.caseWorkflowService.getExecutionWithSteps(workflow.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (executionWithSteps) => {
          this.selectedWorkflowForDetails = executionWithSteps;
          this.showWorkflowDetailsPage = true;
          this.expandedStepIds.clear();
          this.allStepsExpanded = false;

          // Start polling if workflow is running or waiting
          if (executionWithSteps?.status === 'RUNNING' || executionWithSteps?.status === 'WAITING_USER' || executionWithSteps?.status === 'PENDING') {
            this.startWorkflowPolling();
          }

          this.cdr.detectChanges();
        },
        error: (error) => {
          this.notificationService.error('Error', 'Failed to load workflow details');
        }
      });
  }

  /**
   * Close workflow details page - go back to workflow list
   */
  closeWorkflowDetailsPage(): void {
    this.showWorkflowDetailsPage = false;
    this.selectedWorkflowForDetails = null;
    this.expandedStepIds.clear();
    this.allStepsExpanded = false;
    this.cdr.detectChanges();
  }

  /**
   * Close workflow details modal (legacy - alias for closeWorkflowDetailsPage)
   */
  closeWorkflowDetailsModal(): void {
    this.closeWorkflowDetailsPage();
  }

  /**
   * Toggle expand/collapse all workflow steps
   */
  toggleExpandAllSteps(): void {
    this.allStepsExpanded = !this.allStepsExpanded;
    if (this.allStepsExpanded && this.selectedWorkflowForDetails?.stepExecutions) {
      // Expand all completed steps
      this.selectedWorkflowForDetails.stepExecutions.forEach((step: any) => {
        if (step.status === 'COMPLETED') {
          this.expandedStepIds.add(step.id);
        }
      });
    } else {
      this.expandedStepIds.clear();
    }
    this.cdr.detectChanges();
  }

  /**
   * Toggle individual step expansion
   */
  toggleStepExpansion(stepId: number): void {
    if (this.expandedStepIds.has(stepId)) {
      this.expandedStepIds.delete(stepId);
    } else {
      this.expandedStepIds.add(stepId);
    }
    this.cdr.detectChanges();
  }

  /**
   * Check if a step is expanded
   */
  isStepExpanded(stepId: number): boolean {
    return this.expandedStepIds.has(stepId);
  }

  /**
   * Get step duration display string
   */
  getStepDuration(step: any): string {
    if (!step.completedAt || !step.startedAt) return '';

    const start = new Date(step.startedAt).getTime();
    const end = new Date(step.completedAt).getTime();
    const diffMs = end - start;

    if (diffMs < 1000) return '<1s';
    if (diffMs < 60000) return Math.round(diffMs / 1000) + 's';

    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.round((diffMs % 60000) / 1000);
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  /**
   * Get step description based on step type
   */
  getStepDescription(step: any): string {
    const descriptions: { [key: string]: string } = {
      'DISPLAY': 'Gathering and displaying case documents...',
      'SYNTHESIS': 'Analyzing and extracting information with AI...',
      'GENERATION': 'Generating content based on analysis...',
      'INTEGRATION': 'Creating document draft...',
      'ACTION': 'Waiting for user action...'
    };
    return descriptions[step.stepType] || 'Processing step...';
  }

  /**
   * Get workflow status banner configuration
   */
  getWorkflowStatusBanner(): { icon: string; title: string; subtitle: string; colorClass: string } {
    const workflow = this.selectedWorkflowForDetails;
    if (!workflow) {
      return { icon: 'ri-loader-4-line', title: 'Loading...', subtitle: '', colorClass: 'status-pending' };
    }

    switch (workflow.status) {
      case 'RUNNING':
        const currentStep = workflow.stepExecutions?.find((s: any) => s.status === 'IN_PROGRESS' || s.status === 'RUNNING');
        return {
          icon: 'ri-loader-4-line spin',
          title: 'Workflow Running',
          subtitle: currentStep
            ? `Processing step ${currentStep.stepNumber} of ${workflow.totalSteps} - ${currentStep.stepName}`
            : `Processing step ${workflow.currentStep || 1} of ${workflow.totalSteps}`,
          colorClass: 'status-running'
        };
      case 'WAITING_USER':
        const waitingStep = workflow.stepExecutions?.find((s: any) => s.status === 'WAITING_USER');
        return {
          icon: 'ri-pause-circle-line',
          title: 'Waiting for Input',
          subtitle: waitingStep
            ? `Step ${waitingStep.stepNumber} requires your review before continuing`
            : 'A step requires your review before continuing',
          colorClass: 'status-waiting'
        };
      case 'COMPLETED':
        return {
          icon: 'ri-checkbox-circle-line',
          title: 'Workflow Completed',
          subtitle: `All ${workflow.totalSteps} steps completed successfully`,
          colorClass: 'status-completed'
        };
      case 'FAILED':
        return {
          icon: 'ri-close-circle-line',
          title: 'Workflow Failed',
          subtitle: 'An error occurred during execution',
          colorClass: 'status-failed'
        };
      default:
        return {
          icon: 'ri-time-line',
          title: 'Pending',
          subtitle: 'Workflow is queued for execution',
          colorClass: 'status-pending'
        };
    }
  }

  /**
   * Get workflow header action buttons based on status
   */
  getWorkflowHeaderActions(): { primary?: { label: string; icon: string; action: string }; secondary?: { label: string; icon: string; action: string } } {
    const workflow = this.selectedWorkflowForDetails;
    if (!workflow) return {};

    switch (workflow.status) {
      case 'RUNNING':
        return {
          primary: { label: 'Cancel', icon: 'ri-stop-circle-line', action: 'cancel' }
        };
      case 'WAITING_USER':
        return {
          primary: { label: 'Continue Workflow', icon: 'ri-play-line', action: 'continue' }
        };
      case 'COMPLETED':
        return {
          primary: { label: 'Download Report', icon: 'ri-download-line', action: 'download' },
          secondary: { label: 'Run Again', icon: 'ri-refresh-line', action: 'rerun' }
        };
      default:
        return {};
    }
  }

  /**
   * Handle workflow header action button click
   */
  handleWorkflowHeaderAction(action: string): void {
    const workflow = this.selectedWorkflowForDetails;
    if (!workflow) return;

    switch (action) {
      case 'cancel':
        this.pauseWorkflow(workflow.id);
        break;
      case 'continue':
        const waitingStep = workflow.stepExecutions?.find((s: any) => s.status === 'WAITING_USER');
        if (waitingStep) {
          this.resumeWorkflowStep(workflow.id, waitingStep.id);
        }
        break;
      case 'download':
        // TODO: Implement download report
        this.notificationService.info('Feature Being Finalized', 'Report download is being finalized');
        break;
      case 'rerun':
        // TODO: Implement rerun workflow
        this.notificationService.info('Feature Being Finalized', 'Rerun workflow is being finalized');
        break;
    }
  }

  /**
   * Refresh workflow details (for polling)
   */
  refreshWorkflowDetails(): void {
    if (this.selectedWorkflowForDetails?.id) {
      // Use no-cache version to get fresh data
      this.caseWorkflowService.getExecutionWithStepsNoCache(this.selectedWorkflowForDetails.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (executionWithSteps) => {
            // Update the workflow details
            this.selectedWorkflowForDetails = executionWithSteps;

            // Also update the same workflow in userWorkflows for sidebar consistency
            const workflowIndex = this.userWorkflows.findIndex(w => w.id === executionWithSteps?.id);
            if (workflowIndex !== -1 && executionWithSteps) {
              // Calculate completed steps count from stepExecutions
              const completedSteps = executionWithSteps.stepExecutions?.filter(
                (s: any) => s.status === 'COMPLETED'
              ).length || 0;

              this.userWorkflows[workflowIndex] = {
                ...this.userWorkflows[workflowIndex],
                status: executionWithSteps.status,
                currentStep: completedSteps, // Use actual completed count
                progressPercentage: executionWithSteps.progressPercentage,
                stepExecutions: executionWithSteps.stepExecutions // Include for accurate count
              };
              this.userWorkflows = [...this.userWorkflows]; // Trigger change detection
            }

            // Stop polling if workflow completed or failed
            if (executionWithSteps?.status === 'COMPLETED' || executionWithSteps?.status === 'FAILED') {
              this.stopWorkflowPolling();
            }

            this.cdr.detectChanges();
          },
          error: () => { /* Error handled silently */ }
        });
    }
  }

  /**
   * Resume a workflow step that is waiting for user action
   */
  resumeWorkflowStep(executionId: number, stepId: number): void {
    this.caseWorkflowService.resumeWorkflow(executionId, stepId, {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notificationService.success('Success', 'Workflow resumed');
          this.closeWorkflowDetailsModal();
          this.loadUserWorkflows();
          this.startWorkflowPolling();
        },
        error: (error) => {
          this.notificationService.error('Error', 'Failed to resume workflow');
        }
      });
  }

  /**
   * Expand step output in a modal for full view
   */
  expandStepOutput(step: any): void {
    this.expandedStepOutput = step;
    this.showStepOutputModal = true;
    this.cdr.detectChanges();
  }

  /**
   * Close step output modal
   */
  closeStepOutputModal(): void {
    this.showStepOutputModal = false;
    this.expandedStepOutput = null;
    this.cdr.detectChanges();
  }

  /**
   * Copy content to clipboard
   */
  copyToClipboard(content: string): void {
    if (!content) {
      this.notificationService.warning('Warning', 'No content to copy');
      return;
    }
    navigator.clipboard.writeText(content).then(() => {
      this.notificationService.success('Copied', 'Content copied to clipboard');
    }).catch(() => {
      this.notificationService.error('Error', 'Failed to copy to clipboard');
    });
  }

  /**
   * Select a workflow template for Case Workflow - opens the modal
   */
  selectWorkflowTemplate(template: WorkflowTemplate): void {
    this.selectedWorkflowTemplate = template;
    this.workflowSelectedDocuments = [];
    this.workflowName = '';
    this.showStartWorkflowModal = true;

    // Ensure cases are loaded for the dropdown
    if (this.userCases.length === 0) {
      this.loadUserCases();
    }

    this.cdr.detectChanges();
  }

  /**
   * Close the start workflow modal
   */
  closeStartWorkflowModal(): void {
    this.showStartWorkflowModal = false;
    this.selectedWorkflowTemplate = null;
    this.workflowSelectedDocuments = [];
    this.workflowName = '';
    this.cdr.detectChanges();
  }

  /**
   * Clear selected workflow template and return to template selection
   */
  clearWorkflowTemplate(): void {
    this.selectedWorkflowTemplate = null;
    this.workflowSelectedDocuments = [];
    this.workflowName = '';
    this.cdr.detectChanges();
  }

  /**
   * Open workflow selection - clears current selection and scrolls to workflow section
   */
  openWorkflowSelection(): void {
    // Reset workflow selection state
    this.selectedWorkflowTemplate = null;
    this.workflowSelectedDocuments = [];
    this.workflowName = '';
    this.selectedWorkflowForDetails = null;
    this.showWorkflowDetailsPage = false;

    // Make sure workflow task is selected
    this.selectedTask = ConversationType.Workflow;

    this.cdr.detectChanges();
  }

  /**
   * Toggle document selection for workflow
   */
  toggleWorkflowDocument(documentId: number): void {
    if (!documentId && documentId !== 0) {
      return;
    }
    const index = this.workflowSelectedDocuments.indexOf(documentId);
    if (index === -1) {
      this.workflowSelectedDocuments.push(documentId);
    } else {
      this.workflowSelectedDocuments.splice(index, 1);
    }
    this.cdr.detectChanges();
  }

  /**
   * Check if a document is selected for the current workflow
   */
  isDocumentSelectedForWorkflow(documentId: number): boolean {
    return this.workflowSelectedDocuments.includes(documentId);
  }

  /**
   * Get workflow template icon by type
   */
  getWorkflowTemplateIcon(templateType: string): string {
    return this.caseWorkflowService.getTemplateIcon(templateType);
  }

  /**
   * Get workflow template color by type
   */
  getWorkflowTemplateColor(templateType: string): string {
    return this.caseWorkflowService.getTemplateColor(templateType);
  }

  /**
   * Start workflow execution with selected template and documents
   */
  startWorkflow(): void {
    if (!this.selectedWorkflowTemplate || this.workflowSelectedDocuments.length === 0) {
      this.notificationService.warning('Missing Selection', 'Please select a template and at least one document');
      return;
    }

    if (!this.workflowName.trim()) {
      this.notificationService.warning('Missing Name', 'Please enter a name for this workflow');
      return;
    }

    this.startingWorkflow = true;

    this.caseWorkflowService.startWorkflow(
      this.selectedWorkflowTemplate.id,
      this.workflowSelectedDocuments,
      undefined, // collectionId - can be added later
      this.selectedCaseId || undefined,
      this.workflowName.trim()
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (execution) => {
        // Reset loading state
        this.startingWorkflow = false;
        this.activeWorkflowExecution = execution;

        // Close the modal FIRST and trigger change detection
        this.showStartWorkflowModal = false;
        this.selectedWorkflowTemplate = null;
        this.workflowSelectedDocuments = [];
        const workflowName = this.workflowName; // Save for notification
        this.workflowName = '';
        this.cdr.detectChanges(); // Force close modal immediately

        // Register background task for tracking
        const taskId = this.backgroundTaskService.registerTask(
          'workflow',
          workflowName,
          `Step 1 of ${execution.totalSteps || 0}`,
          { workflowId: execution.id }
        );
        this.backgroundTaskService.startTask(taskId);
        this.workflowTaskIdMapping.set(execution.id, taskId);
        this.previouslyRunningWorkflowIds.add(execution.id);

        // Switch to workflow tab so user can see the new workflow
        this.selectedTask = ConversationType.Workflow;
        this.activeTask = ConversationType.Workflow;
        this.workflowFilter = 'all'; // Reset filter to show all workflows

        // Load workflows sidebar
        this.loadUserWorkflows();
        this.startWorkflowPolling();

        // Show success notification
        this.notificationService.success(
          'Workflow Started',
          `${workflowName} workflow is now running`
        );

        // Reload conversations to pick up any drafts created by the workflow
        // This ensures workflow-created drafts appear in Drafting taskcard
        this.loadConversations();

        this.cdr.detectChanges();
      },
      error: (error) => {
        this.startingWorkflow = false;
        this.notificationService.error(
          'Workflow Failed',
          error.error?.message || 'Failed to start workflow'
        );
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Create a new collection
   */
  createCollection(name: string, description?: string): void {
    if (!name.trim()) return;

    this.collectionService.createCollection(name, description)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (collection) => {
          this.notificationService.success('Collection Created', `"${name}" has been created`);
          this.showNewCollectionModal = false;
        },
        error: (error) => {
          this.notificationService.error('Error', 'Failed to create collection');
        }
      });
  }

  /**
   * Delete a collection
   */
  deleteCollection(collection: DocumentCollection): void {
    this.collectionService.deleteCollection(collection.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notificationService.success('Deleted', `Collection "${collection.name}" has been removed`);
        },
        error: (error) => {
          this.notificationService.error('Error', 'Failed to delete collection');
        }
      });
  }

  /**
   * Open a collection in the collection viewer
   */
  openCollection(collection: DocumentCollection): void {
    this.isViewingCollection = true;
    this.activeCollectionId = collection.id;
    // Close document viewer if open
    this.stateService.closeDocumentViewer();
    this.cdr.detectChanges();
  }

  /**
   * Close the collection viewer
   */
  closeCollectionViewer(): void {
    this.isViewingCollection = false;
    this.activeCollectionId = null;
    this.cdr.detectChanges();
  }

  /**
   * Start upload flow with pre-selected collection
   */
  startUploadToCollection(collectionId: number): void {
    // Close collection viewer
    this.isViewingCollection = false;
    this.activeCollectionId = null;

    // Switch to upload task
    this.selectedTask = ConversationType.Upload;
    this.activeTask = ConversationType.Upload;

    // Pre-select the collection
    this.selectedUploadCollectionId = collectionId;

    // Show context selection to reveal the upload UI
    this.showContextSelection = true;

    this.cdr.detectChanges();
  }

  /**
   * Handle opening a document from collection viewer
   */
  openDocumentFromCollection(event: { analysisId: number; databaseId: number }): void {
    const databaseId = event.analysisId;

    // First check if document exists in local state
    let existingDoc = this.stateService.getAnalyzedDocumentByDatabaseId(databaseId);

    if (existingDoc) {
      // Document exists in state - open it directly
      this.isViewingCollection = false;
      this.stateService.openDocumentViewer(existingDoc.id);
      this.cdr.detectChanges();
    } else {
      // Document not in state - fetch from backend first
      this.documentAnalyzerService.getAnalysisByDatabaseId(databaseId).subscribe({
        next: (result) => {
          // Add document to state
          // Normalize ID to match loadAnalysisHistory format
          const normalizedDatabaseId = result.databaseId || databaseId;
          const normalizedId = `analysis_${normalizedDatabaseId}`;

          const newDoc: AnalyzedDocument = {
            id: normalizedId,
            databaseId: normalizedDatabaseId,
            fileName: result.fileName || 'Unknown Document',
            fileSize: result.fileSize || 0,
            detectedType: result.detectedType || 'Document',
            riskLevel: result.analysis?.riskLevel,
            riskScore: result.analysis?.riskScore,
            analysis: result.analysis ? {
              fullAnalysis: result.analysis.fullAnalysis || '',
              summary: result.analysis.summary,
              riskScore: result.analysis.riskScore,
              riskLevel: result.analysis.riskLevel,
              keyFindings: result.analysis.keyFindings,
              recommendations: result.analysis.recommendations
            } : undefined,
            extractedMetadata: result.extractedMetadata,
            timestamp: result.timestamp || Date.now(),
            status: 'completed'
          };

          this.stateService.addAnalyzedDocument(newDoc);

          // Close collection viewer and open document
          this.isViewingCollection = false;
          this.stateService.openDocumentViewer(normalizedId);
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.notificationService.error('Error', 'Failed to load document');
        }
      });
    }
  }

  /**
   * Research mode change — unified mode, always THOROUGH
   */
  onResearchModeChange(mode: 'FAST' | 'THOROUGH'): void {
    // Unified mode — always thorough. Kept for backward compatibility.
    this.selectedResearchMode = ResearchMode.Thorough;
  }

  /**
   * Set mode to THOROUGH when entering drafting mode
   * Legal documents need citations for credibility and court filings
   */
  private setModeForDrafting(): void {
    this.selectedResearchMode = ResearchMode.Thorough;
  }

  /**
   * Opens the "How It Works" modal to explain AI Workspace features
   */
  openHowItWorksModal(): void {
    this.modalService.open(this.howItWorksModal, {
      centered: true,
      size: 'lg'
    });
  }

  ngOnDestroy(): void {
    // Remove full-page drafting class from body (safety net)
    document.body.classList.remove('ai-drafting-fullpage');

    // Mark that user left AI Workspace (re-enables notifications)
    this.backgroundTaskService.setIsOnAiWorkspace(false);

    // Reset guard flag so history is loaded fresh on next navigation to this component
    this.analysisHistoryLoaded = false;

    // Close draft streaming SSE if open
    this.closeDraftStream();

    // Close workflow progress SSE if open
    this.closeWorkflowSSE();

    // Clean up scroll spy listener
    this.destroyScrollSpy();

    // Reset exhibit panel state
    this.exhibitPanelService.reset();

    // Clean up stationery DOM injections
    this.clearStationeryFrames();

    // Revoke PDF preview blob URL if still open
    if (this.previewPdfUrl) {
      URL.revokeObjectURL(this.previewPdfUrl);
      this.previewPdfUrl = null;
    }

    // Clear auto-dismiss timer for pending changes
    if (this.pendingChangesAutoTimer) {
      clearTimeout(this.pendingChangesAutoTimer);
      this.pendingChangesAutoTimer = null;
    }

    // Remove floating toolbar document listener
    if (this.documentMousedownHandler) {
      document.removeEventListener('mousedown', this.documentMousedownHandler);
      this.documentMousedownHandler = null;
    }

    this.destroy$.next();
    this.destroy$.complete();
    this.cancelGeneration$.complete();

    // Clear all active timeouts
    this.activeTimeouts.forEach(id => clearTimeout(id));

    // Clear content load timeout if pending
    if (this.contentLoadTimeoutId !== null) {
      clearTimeout(this.contentLoadTimeoutId);
      this.contentLoadTimeoutId = null;
    }
    this.activeTimeouts = [];

    // Clear all active intervals
    this.activeIntervals.forEach(id => clearInterval(id));
    this.activeIntervals = [];

    // Clear content change debounce
    if (this.contentChangeDebounce) {
      clearTimeout(this.contentChangeDebounce);
    }
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

  // Helper method to update workflow step status (now uses StateService)
  private updateWorkflowStep(stepId: number, status: 'pending' | 'active' | 'completed' | 'error', description?: string): void {
    const updates: Partial<any> = { status: status as any };
    if (description !== undefined) {
      updates.description = description;
    }
    this.stateService.updateWorkflowStep(stepId, updates);
  }

  // Helper method to reset workflow steps (now uses StateService)
  private resetWorkflowSteps(): void {
    this.stateService.resetWorkflowSteps();
  }

  // Initialize workflow steps based on task type (now uses StateService)
  private initializeWorkflowSteps(taskType: string): void {
    const template = this.workflowStepTemplates[taskType] || this.workflowStepTemplates['question'];
    const steps = template.map(step => ({
      ...step,
      status: 'pending' as any
    }));
    this.stateService.setWorkflowSteps(steps);
  }

  // Classify a question to pick the right workflow step template
  private classifyQuestion(query: string, hasConversationHistory: boolean): string {
    const q = query.toLowerCase().trim();
    const wordCount = q.split(/\s+/).length;

    // Follow-up: short question with conversation context
    if (hasConversationHistory) {
      if (wordCount <= 10 && /elaborate|explain|clarify|mean by|tell me more|more about|more detail|specifically|example/.test(q)) {
        return 'question_followup';
      }
      if (/what (is|does|are) (this|that|it|those)|about (this|that|it)|regarding (this|that)/.test(q)) {
        return 'question_followup';
      }
    }

    // Narrow technical: specific statute/citation question
    if (/what (does|is)|define|definition of|meaning of|text of|cite|citation|section|statute|rule|regulation|irc|usc|cfr|§/.test(q)) {
      if (!/strateg|argument|approach|defend|attack|challenge|motion|brief|position/.test(q)) {
        return 'question_technical';
      }
    }

    // Procedural guidance: how-to
    if (/how (do|can|should) (i|we)|steps (for|to)|procedure|process|filing|deadline|timeline|schedule/.test(q)) {
      return 'question_procedural';
    }

    // Default: initial strategy (full research)
    return 'question_strategy';
  }

  // Animate workflow steps progressively (now works with StateService)
  private animateWorkflowSteps(): void {
    // Clear any existing timeouts
    this.activeTimeouts.forEach(id => clearTimeout(id));
    this.activeTimeouts = [];

    // Progressive animation of steps
    const stepDuration = 3000; // 3 seconds per step
    const steps = this.stateService.getWorkflowSteps();

    steps.forEach((step, index) => {
      // Mark step as active
      const activeTimeout = this.setTrackedTimeout(() => {
        if (this.stateService.getIsGenerating()) {
          this.updateWorkflowStep(step.id, 'active' as any);
          this.cdr.detectChanges();
        }
      }, index * stepDuration);

      // Mark step as completed (unless it's the last step)
      if (index < steps.length - 1) {
        const completedTimeout = this.setTrackedTimeout(() => {
          if (this.stateService.getIsGenerating()) {
            this.updateWorkflowStep(step.id, 'completed' as any);
            this.cdr.detectChanges();
          }
        }, (index + 0.8) * stepDuration);
      }
    });
  }

  // Connect to SSE progress stream for real-time workflow step updates.
  // Uses hybrid approach: starts timer animation immediately as fallback,
  // then cancels timers if SSE events arrive (so real progress takes over).
  private connectWorkflowSSE(sessionId: number): void {
    this.closeWorkflowSSE();
    const steps = this.stateService.getWorkflowSteps();
    const totalSteps = steps.length;
    if (totalSteps === 0) return;

    // Start timer animation immediately as fallback (in case SSE doesn't connect in time)
    this.animateWorkflowSteps();

    const sseUrl = `${environment.apiUrl}/api/ai/legal-research/progress-stream?sessionId=${sessionId}`;
    this.workflowEventSource = new EventSource(sseUrl);
    let sseActive = false;

    const cancelTimerFallback = () => {
      if (!sseActive) {
        sseActive = true;
        // Cancel timer animation — SSE will drive from here
        this.activeTimeouts.forEach(id => clearTimeout(id));
        this.activeTimeouts = [];
      }
    };

    this.workflowEventSource.addEventListener('progress', (event: MessageEvent) => {
      try {
        const progressEvent = JSON.parse(event.data);
        const stepType = progressEvent.stepType;
        cancelTimerFallback();

        if (stepType === 'query_analysis') {
          this.updateWorkflowStep(steps[0].id, 'active' as any);
          this.cdr.detectChanges();
        } else if (stepType === 'tool_execution') {
          // Mark first step completed, activate middle (search) steps
          this.updateWorkflowStep(steps[0].id, 'completed' as any);
          for (let i = 1; i < totalSteps - 1; i++) {
            this.updateWorkflowStep(steps[i].id, 'active' as any);
          }
          this.cdr.detectChanges();
        }
      } catch (error) {
        // Ignore parse errors
      }
    });

    this.workflowEventSource.addEventListener('complete', () => {
      cancelTimerFallback();
      this.completeAllWorkflowSteps();
      this.closeWorkflowSSE();
    });

    this.workflowEventSource.addEventListener('error', (event: MessageEvent) => {
      if (event.data) {
        cancelTimerFallback();
        // Mark last step as error before closing
        if (totalSteps > 0) {
          this.updateWorkflowStep(steps[totalSteps - 1].id, 'error' as any);
          this.cdr.detectChanges();
        }
        this.closeWorkflowSSE();
      }
    });

    this.workflowEventSource.onerror = () => {
      if (this.workflowEventSource?.readyState === EventSource.CLOSED) {
        this.closeWorkflowSSE();
      }
    };
  }

  // Close SSE connection for workflow progress
  private closeWorkflowSSE(): void {
    if (this.workflowEventSource) {
      this.workflowEventSource.close();
      this.workflowEventSource = undefined;
    }
  }

  // Complete all workflow steps (called when AI response is received) - now uses StateService
  private completeAllWorkflowSteps(): void {
    this.closeWorkflowSSE();
    this.stateService.completeAllWorkflowSteps();
    this.cdr.detectChanges();
  }

  // Stop generation
  stopGeneration(): void {
    // Close draft streaming SSE connection
    this.closeDraftStream();

    // Get active conversation to cancel backend request
    const activeConvId = this.stateService.getActiveConversationId();
    const conversations = this.stateService.getConversations();
    const activeConv = conversations.find(c => c.id === activeConvId);

    // Call backend to cancel the AI request
    if (activeConv?.backendConversationId) {
      this.legalResearchService.cancelConversation(activeConv.backendConversationId)
        .subscribe({
          next: () => {
            // Cancelled successfully
          },
          error: () => { /* Error handled silently */ }
        });
    }

    // Cancel any ongoing frontend HTTP requests
    this.cancelGeneration$.next();

    // Clear all active timeouts and intervals
    this.activeTimeouts.forEach(id => clearTimeout(id));
    this.activeTimeouts = [];
    this.activeIntervals.forEach(id => clearInterval(id));
    this.activeIntervals = [];

    // Reset state (but keep workflow steps visible to show progress when stopped)
    this.stateService.setIsGenerating(false);

    // Add a cancelled message
    this.stateService.addConversationMessage({
      role: 'assistant',
      content: 'Generation stopped by user.'
    });

    this.stateService.setShowBottomSearchBar(true);
  }

  // ========================================
  // MOBILE SIDEBAR TOGGLE
  // ========================================

  toggleSidebar(): void {
    const current = this.stateService.getSidebarOpen();
    this.stateService.setSidebarOpen(!current);
  }

  closeSidebar(): void {
    this.stateService.setSidebarOpen(false);
  }

  // ========================================
  // SIDEBAR OVERLAY (collapsed state when exhibit panel is open)
  // ========================================

  toggleSidebarOverlay(tab: 'contents' | 'exhibits'): void {
    if (this.sidebarOverlayOpen && this.sidebarOverlayTab === tab) {
      // Clicking the same tab closes the overlay
      this.sidebarOverlayOpen = false;
    } else {
      this.sidebarOverlayTab = tab;
      this.sidebarOverlayOpen = true;
      this.exhibitPanelService.setSidebarTab(tab);
    }
  }

  closeSidebarOverlay(): void {
    this.sidebarOverlayOpen = false;
  }

  // Go back to task selection from conversation view (mobile)
  goBackToTaskSelection(): void {
    // Clear active conversation
    this.stateService.setActiveConversationId(null);
    this.stateService.clearConversationMessages();

    // Reset UI state to show welcome screen
    this.stateService.setShowChat(false);
    this.stateService.setShowBottomSearchBar(false);
    this.stateService.setIsGenerating(false);
    this.stateService.setDraftingMode(false);

    // Clear inputs
    this.customPrompt = '';
    this.followUpMessage = '';
    this.stateService.clearFollowUpQuestions();

    // Reset workflow steps
    this.resetWorkflowSteps();

    // Reset exhibit panel
    this.exhibitPanelService.reset();
  }

  // Get title of active conversation for mobile header
  getActiveConversationTitle(): string {
    const activeId = this.stateService.getActiveConversationId();
    if (!activeId) {
      // Check if there's a selected task type
      if (this.selectedTask) {
        const taskLabels: { [key: string]: string } = {
          'question': 'Legal Question',
          'draft': 'Document Draft',
          'upload': 'Document Analysis',
          'workflow': 'Workflow'
        };
        return taskLabels[this.selectedTask] || 'AI Assistant';
      }
      return 'AI Assistant';
    }
    const conversation = this.stateService.getConversations().find(c => c.id === activeId);
    return conversation?.title || 'Conversation';
  }


  // ========================================
  // CONVERSATION MANAGEMENT (Protégé-style)
  // ========================================

  // Load ALL conversations from backend (both Question and Draft types)
  loadConversations(): void {
    // Load both Question and Draft conversations at once to avoid flickering when switching
    const taskTypes = ['LEGAL_QUESTION', 'GENERATE_DRAFT'];
    const allConversations: Conversation[] = [];
    let completedRequests = 0;

    taskTypes.forEach(backendTaskType => {
      const bookmarkedFilter = backendTaskType === 'LEGAL_QUESTION' ? this.showBookmarkedOnly : undefined;
      this.legalResearchService.getGeneralConversationsByTaskType(backendTaskType, 0, 50, bookmarkedFilter || undefined)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            // Map backend conversations to frontend format
            const conversations: Conversation[] = response.conversations.map(conv => ({
              id: `conv_${conv.id}`,
              title: conv.sessionName || 'Untitled Conversation',
              date: new Date(conv.createdAt || new Date()),
              type: this.mapBackendTaskTypeToFrontend(conv.taskType || 'LEGAL_QUESTION'),
              messages: [], // Messages will be loaded when conversation is opened
              messageCount: conv.messageCount || 0,
              jurisdiction: conv.jurisdiction,
              backendConversationId: conv.id,
              researchMode: conv.researchMode as ResearchMode || 'FAST' as ResearchMode,
              taskType: conv.taskType as TaskType,
              documentId: conv.documentId,
              relatedDraftId: conv.relatedDraftId,
              documentType: conv.documentType,
              workflowExecutionId: conv.workflowExecutionId // For workflow-created drafts
            }));

            allConversations.push(...conversations);
            completedRequests++;

            // Only update state when all requests are complete
            if (completedRequests === taskTypes.length) {
              this.stateService.setConversations(allConversations);
              // Validate and clean up stale UI state after conversations load
              this.validateAndCleanupState(allConversations);
              this.cdr.detectChanges();
            }
          },
          error: () => {
            // Error handled silently
            completedRequests++;
            // Still update state when all requests are complete (even on error) to avoid stale data
            if (completedRequests === taskTypes.length) {
              this.stateService.setConversations(allConversations);
              this.cdr.detectChanges();
            }
          }
        });
    });
  }

  // REMOVED: groupConversationsByDate() - now handled by StateService automatically

  // Map backend task type to frontend type
  private mapBackendTaskTypeToFrontend(taskType: string): ConversationType {
    const typeMap: { [key: string]: ConversationType } = {
      'LEGAL_QUESTION': ConversationType.Question,
      'GENERATE_DRAFT': ConversationType.Draft,
      'SUMMARIZE_CASE': ConversationType.Summarize,
      'ANALYZE_DOCUMENT': ConversationType.Upload
    };
    return typeMap[taskType] || ConversationType.Question;
  }

  // Load specific conversation by ID
  loadConversation(conversationId: string): void {
    const conv = this.stateService.getConversations().find(c => c.id === conversationId);
    if (!conv || !conv.backendConversationId) {
      // Error handled silently
      return;
    }

    // CRITICAL: Clear existing messages BEFORE loading new ones
    // This forces Angular to destroy and recreate DOM elements (including Bootstrap tabs)
    this.stateService.clearConversationMessages();
    this.stateService.clearFollowUpQuestions();
    this.cdr.detectChanges();

    // Check if this is a document analysis conversation (Summarize or Upload)
    if (conv.type === ConversationType.Summarize || conv.type === ConversationType.Upload) {
      this.loadDocumentAnalysisFromConversation(conv);
      return;
    }

    this.legalResearchService.getConversationById(conv.backendConversationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {

          // Update conversation with messages via state service
          this.stateService.setActiveConversationId(conversationId);
          this.stateService.clearFollowUpQuestions(); // Clear old follow-up questions from previous conversation

          const messages = response.messages.map(msg => {
            const baseMessage: any = {
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
              timestamp: new Date(msg.createdAt || new Date())
            };

            // Add bookmark, id, and metadata for assistant messages
            if (msg.role === 'assistant') {
              baseMessage.id = msg.id;
              baseMessage.bookmarked = msg.bookmarked || false;
            }

            // Pass metadata through for quality score display and other features
            if (msg.metadata && msg.role === 'assistant') {
              try {
                const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
                baseMessage.metadata = metadata;

                // Detect DOCUMENT ANALYSIS messages (upload/analyze) - NOT legal research
                // Only show strategic tabs when there's an analysisId from document analysis
                // Do NOT use content keywords - they falsely trigger on thorough legal research responses
                if (metadata.analysisId) {
                  baseMessage.hasStrategicAnalysis = true;
                  baseMessage.analysisId = metadata.analysisId;
                  baseMessage.parsedSections = this.parseStrategicSections(msg.content);
                }
              } catch {
                // Malformed metadata — skip gracefully
              }
            }

            return baseMessage;
          });

          // Check draft type BEFORE setTimeout (conv object is available now)
          const isWorkflowDraft = conv.type === 'draft' && conv.workflowExecutionId && !conv.relatedDraftId;
          const isRegularDraft = conv.type === 'draft' && conv.relatedDraftId;

          // CRITICAL: Use setTimeout to ensure Angular processes the observable emission in next tick
          setTimeout(() => {
            // Handle workflow-created drafts - ONLY show in editor, NOT in conversation sidebar
            if (isWorkflowDraft) {
              // Get content from first assistant message
              const firstAssistantMessage = messages.find(m => m.role === 'assistant');
              const draftContent = firstAssistantMessage?.content || '';

              // CLEAR conversation messages - workflow drafts should NOT appear in chat sidebar
              this.stateService.setConversationMessages([]);

              // Populate document state
              this.currentDocumentId = null; // No GeneratedDocument for workflow drafts
              this.activeDocumentTitle = conv.title || this.extractTitleFromMarkdown(draftContent) || 'Untitled Document';
              this.currentDocumentWordCount = this.countWords(draftContent);
              this.currentDocumentPageCount = this.documentGenerationService.estimatePageCount(this.currentDocumentWordCount);
              this.documentMetadata = {
                tokensUsed: 0,
                costEstimate: 0,
                generatedAt: conv.date || new Date(),
                version: 1
              };

              // Store content for editor
              this.pendingDocumentContent = draftContent;

              // FORCE editor destruction and recreation
              this.showEditor = false;
              this.cdr.detectChanges();

              setTimeout(() => {
                this.editorInstance = null;

                // CRITICAL: Set drafting mode FIRST so container becomes visible
                this.stateService.setDraftingMode(true);
                this.stateService.setShowChat(false); // Chat hidden by default in full-page drafting
                this.stateService.setShowBottomSearchBar(false);
                this.cdr.detectChanges(); // Render container first

                // NOW show editor - container exists
                this.showEditor = true;
                this.setModeForDrafting();
                this.cdr.detectChanges();
              }, 0);

              return; // Exit early - don't run the change detection below
            }

            // For non-workflow conversations, extract follow-up questions and set messages
            const lastAssistantMsg = messages
              .slice()
              .reverse()
              .find(msg => msg.role === 'assistant');

            if (lastAssistantMsg) {
              const cleanedContent = this.extractAndRemoveFollowUpQuestions(lastAssistantMsg.content);
              lastAssistantMsg.content = cleanedContent;
            }

            // Filter to bookmarked responses only when "Saved" tab is active
            const displayMessages = this.showBookmarkedOnly
              ? this.filterBookmarkedMessages(messages)
              : messages;

            this.stateService.setConversationMessages(displayMessages);

            // Add another setTimeout to ensure Angular has time to process
            setTimeout(() => {
              this.cdr.markForCheck();
              this.cdr.detectChanges();
            }, 100);
          }, 0);

          // Handle regular drafts (with relatedDraftId) - these load document from backend
          if (isRegularDraft) {
            // Load the draft document from backend
            this.documentGenerationService.getDocument(conv.relatedDraftId, this.currentUser?.id)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (document) => {

                  // Populate document state
                  this.currentDocumentId = document.id;
                  // Extract professional title from document content (first # heading)
                  this.activeDocumentTitle = conv.title || this.extractTitleFromMarkdown(document.content) || 'Untitled Document';
                  this.currentDocumentWordCount = document.wordCount || this.countWords(document.content);
                  this.currentDocumentPageCount = this.documentGenerationService.estimatePageCount(this.currentDocumentWordCount);
                  this.documentMetadata = {
                    tokensUsed: document.tokensUsed,
                    costEstimate: document.costEstimate,
                    generatedAt: new Date(document.generatedAt),
                    version: document.version || 1
                  };

                  // Load version history for dropdown
                  this.loadVersionHistory();

                  // Auto-load stationery frame if document has stationery association
                  this.loadDocumentStationery(document);

                  // CRITICAL: Cancel any pending content load from previous document
                  if (this.contentLoadTimeoutId !== null) {
                    clearTimeout(this.contentLoadTimeoutId);
                    this.contentLoadTimeoutId = null;
                  }

                  // Store content in pending property - will be loaded in onEditorCreated()
                  this.pendingDocumentContent = document.content || '';

                  // FORCE editor destruction and recreation
                  this.showEditor = false;
                  this.cdr.detectChanges();

                  // Recreate editor - content will load automatically in onEditorCreated()
                  setTimeout(() => {
                    // Clear editor instance BEFORE recreating component
                    this.editorInstance = null;

                    // CRITICAL: Set drafting mode FIRST so container becomes visible
                    this.stateService.setDraftingMode(true);
                    this.stateService.setShowChat(false); // Chat hidden by default in full-page drafting
                    this.stateService.setShowBottomSearchBar(false);
                    this.cdr.detectChanges(); // Render container first

                    // NOW show editor - container exists
                    this.showEditor = true;

                    // Auto-switch to THOROUGH mode for drafting
                    this.setModeForDrafting();

                    this.cdr.detectChanges();

                    // Load exhibits for this document
                    if (document.id) {
                      this.loadDocumentExhibits(Number(document.id));
                    }
                  }, 0);
                },
                error: () => {
                  // Fall back to regular chat mode if document load fails
                  this.stateService.setShowChat(true);
                  this.stateService.setShowBottomSearchBar(true);
                  this.stateService.setDraftingMode(false);
                  setTimeout(() => {
                    this.cdr.detectChanges();
                  }, 0);
                }
              });
          } else {
            // Non-draft conversations: use regular chat mode
            this.stateService.setShowChat(true);
            this.stateService.setShowBottomSearchBar(true);
            this.stateService.setDraftingMode(false);

            // CRITICAL: Restore research mode from conversation's saved mode
            // This ensures the mode badge shows correctly after page refresh
            if (conv.researchMode) {
              this.selectedResearchMode = conv.researchMode === 'THOROUGH' ? ResearchMode.Thorough : ResearchMode.Fast;
            }

            // Use setTimeout to ensure change detection runs after observable emits
            setTimeout(() => {
              this.cdr.detectChanges();
            }, 0);
          }
        },
        error: (error) => {
          this.notificationService.error('Error', 'Failed to load conversation. Please try again.');
        }
      });
  }

  // Delete conversation
  deleteConversation(conversationId: string): void {
    const conv = this.stateService.getConversations().find(c => c.id === conversationId);
    if (!conv || !conv.backendConversationId) {
      // Error handled silently
      return;
    }

    this.notificationService.confirmDelete(
      'Delete Conversation?',
      'This action cannot be undone.',
      'Yes, delete it'
    ).then((result) => {
      if (result.isConfirmed && conv.backendConversationId) {
        this.legalResearchService.deleteConversationById(conv.backendConversationId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (success) => {
              if (success) {
                // Remove from state service (automatically re-groups)
                this.stateService.removeConversation(conversationId);

                // Clear active conversation if it was deleted
                if (this.stateService.getActiveConversationId() === conversationId) {
                  this.stateService.setActiveConversationId(null);
                  this.stateService.clearConversationMessages();
                  this.stateService.setShowChat(false);
                }

                this.notificationService.success('Deleted!', 'Conversation has been deleted.');
                this.cdr.detectChanges();
              }
            },
            error: (error) => {
              this.notificationService.error('Error', 'Failed to delete conversation.');
            }
          });
      }
    });
  }

  // Switch to a conversation (alias for loadConversation)
  switchConversation(conversationId: string): void {
    this.loadConversation(conversationId);
    // Close sidebar on mobile after selecting conversation
    this.closeSidebar();
  }

  // Delete an analyzed document
  deleteDocument(doc: any): void {
    import('sweetalert2').then(Swal => {
      Swal.default.fire({
        title: 'Delete Document?',
        text: `Are you sure you want to delete "${doc.fileName || 'this document'}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f06548',
        cancelButtonColor: '#878a99',
        confirmButtonText: 'Yes, delete it'
      }).then((result) => {
        if (result.isConfirmed) {
          // If document has a databaseId, delete from backend first
          if (doc.databaseId) {
            this.documentAnalyzerService.deleteAnalysis(doc.databaseId)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: () => {
                  this.stateService.removeAnalyzedDocument(doc.id);
                  this.stateService.setActiveDocumentId(null);
                  this.notificationService.success('Deleted!', 'Document has been removed.');
                  this.cdr.detectChanges();
                },
                error: (err) => {
                  this.notificationService.error('Error', 'Failed to delete document');
                }
              });
          } else {
            // No database ID - just remove from state
            this.stateService.removeAnalyzedDocument(doc.id);
            this.stateService.setActiveDocumentId(null);
            this.notificationService.success('Deleted!', 'Document has been removed.');
            this.cdr.detectChanges();
          }
        }
      });
    });
  }

  // Start a new conversation - resets the view
  startNewConversation(): void {
    // Clear active conversation
    this.stateService.setActiveConversationId(null);
    this.stateService.clearConversationMessages();

    // Reset UI state
    this.stateService.setShowChat(false);
    this.stateService.setShowBottomSearchBar(false);
    this.stateService.setIsGenerating(false);
    this.stateService.setDraftingMode(false);

    // Clear inputs
    this.customPrompt = '';
    this.followUpMessage = '';
    this.stateService.clearFollowUpQuestions();

    // Reset workflow steps
    this.resetWorkflowSteps();

    // Reset exhibit panel
    this.exhibitPanelService.reset();

    // Close mobile sidebar if open
    this.closeSidebar();
  }

  // Exit drafting mode and return to task selection
  exitDraftingMode(): void {
    // Reset all state to show welcome screen
    this.stateService.setDraftingMode(false);
    this.stateService.setShowChat(false);
    this.stateService.setIsGenerating(false);
    this.stateService.setShowBottomSearchBar(true);

    // Clear active conversation
    this.stateService.setActiveConversationId(null);

    // Reset workflow steps
    this.stateService.setWorkflowSteps([]);

    // Clear document state
    this.activeDocumentContent = '';
    this.activeDocumentTitle = 'Generated Document';
    this.currentDocumentId = null;
    this.originalTemplateHtml = null;
    this.originalTemplateDocId = null;
    this.documentMetadata = {};

    // Clean up scroll spy and reset exhibit panel
    this.destroyScrollSpy();
    this.exhibitPanelService.reset();

    // Reset stationery state
    this.clearStationeryFrames();
    this.stationeryInserted = false;
    this.activeStationeryRendered = null;
    this.activeStationeryRawHtml = null;
    this.activeStationeryTemplateId = null;
    this.activeStationeryAttorneyId = null;
    this.activeAttorneyName = '';
    this.selectedStationeryTemplateId = null;
  }

  // ========================================
  // EXPORT METHODS
  // ========================================

  /**
   * Wrap editor body content with stationery HTML for export/preview.
   * Returns the body as-is if no stationery is active.
   *
   * Assembly order (legal convention):
   *   Letterhead → Body (without exhibit list) → Signature → Footer → Exhibit List
   */
  private wrapContentWithStationery(bodyHtml: string): string {
    if (!this.activeStationeryRawHtml) return bodyHtml;
    const { letterhead, signature, footer } = this.activeStationeryRawHtml;
    const parts: string[] = [];

    // Extract exhibit list from end of body so it can be placed after footer (legal convention)
    let mainBody = bodyHtml;
    let exhibitSection = '';
    if (signature || footer) {
      const extracted = this.extractExhibitSection(bodyHtml);
      mainBody = extracted.mainBody;
      exhibitSection = extracted.exhibitSection;
    }

    // Inline styles match the CKEditor .stationery-frame CSS exactly so PDF = editor view
    if (letterhead) {
      // Ensure all <td> and <p> tags have font-family inline (stored HTML may lack it)
      const fontFixedLetterhead = letterhead
        .replace(/<td\s+style="([^"]*?)"/g, (match: string, styles: string) => {
          if (styles.includes('font-family')) return match;
          return `<td style="${styles};font-family:'Times New Roman',Georgia,serif"`;
        })
        .replace(/<p\s+style="([^"]*?)"/g, (match: string, styles: string) => {
          if (styles.includes('font-family')) return match;
          return `<p style="${styles};font-family:'Times New Roman',Georgia,serif"`;
        });
      parts.push(`<div class="stationery-letterhead" style="font-family:'Times New Roman',Georgia,serif;font-size:12px;color:#222;line-height:1.4;padding:0 0 2px;margin-bottom:72pt;">${fontFixedLetterhead}</div>`);
    }

    // Strip trailing empty paragraphs from body — AI often generates these, creating a large gap before signature
    mainBody = mainBody.replace(/(\s*<p>(\s|&nbsp;|<br\/?>)*<\/p>)*\s*$/gi, '');

    parts.push(mainBody);

    if (signature) {
      // Normalize old saved templates: replace any font-size in px with 12pt so iText renders consistently
      const normalizedSignature = signature.replace(/font-size:\s*\d+px/gi, 'font-size:12pt');
      parts.push(`<div class="stationery-signature" style="font-family:'Times New Roman',Georgia,serif;font-size:12pt;color:#212529;line-height:1.6;padding-top:12px;margin-top:0;">${normalizedSignature}</div>`);
    }

    if (footer) {
      // Wrap footer in comment markers so backend can extract it and draw at absolute page bottom via PdfCanvas
      const footerDiv = `<div class="stationery-footer" style="font-family:'Times New Roman',Georgia,serif;font-size:9pt;color:#333333;text-align:center;padding-top:4px;margin-top:16px;">${footer}</div>`;
      parts.push(`<!--STATIONERY_FOOTER_START-->${footerDiv}<!--STATIONERY_FOOTER_END-->`);
    }

    // Exhibit list follows footer as a legal appendix — starts on a new page
    if (exhibitSection) {
      parts.push(`<div style="page-break-before:always;">${exhibitSection}</div>`);
    }

    return parts.join('\n');
  }

  /**
   * Extract the exhibit list section from the end of the body HTML.
   * Looks for the last heading (h1-h6) whose text contains "exhibit" and splits there.
   * Returns { mainBody, exhibitSection } — exhibitSection is empty string if none found.
   */
  private extractExhibitSection(bodyHtml: string): { mainBody: string; exhibitSection: string } {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div id="ck-root">${bodyHtml}</div>`, 'text/html');
    const root = doc.getElementById('ck-root');
    if (!root) return { mainBody: bodyHtml, exhibitSection: '' };

    const children = Array.from(root.children);
    let exhibitStartIndex = -1;

    // Find the LAST heading containing "exhibit" (case-insensitive)
    for (let i = 0; i < children.length; i++) {
      const el = children[i];
      const tagName = el.tagName.toLowerCase();
      const text = el.textContent?.trim().toLowerCase() || '';
      if (/^h[1-6]$/.test(tagName) && text.includes('exhibit')) {
        exhibitStartIndex = i;
      }
    }

    if (exhibitStartIndex === -1) return { mainBody: bodyHtml, exhibitSection: '' };

    const mainBody = children.slice(0, exhibitStartIndex).map(el => el.outerHTML).join('');
    const exhibitSection = children.slice(exhibitStartIndex).map(el => el.outerHTML).join('');
    return { mainBody, exhibitSection };
  }

  /**
   * Export document to PDF
   * Saves first then exports via document ID for proper conversion
   */
  exportToPDF(): void {
    this.notificationService.loading('Preparing PDF', 'Please wait...');

    let exportHtml: string;

    if (this.originalTemplateHtml) {
      // Template-generated document: use pristine template HTML for PDF.
      // CKEditor destroys inline styles/align attributes, so we bypass it entirely.
      exportHtml = this.wrapContentWithStationery(this.originalTemplateHtml);
    } else {
      // Regular document: use CKEditor content + cleanHtmlForExport
      const htmlContent = this.getEditorContent();
      if (!htmlContent) {
        this.notificationService.error('Error', 'No content to export');
        return;
      }
      const cleanBody = this.documentGenerationService.cleanHtmlForExport(htmlContent);
      exportHtml = this.wrapContentWithStationery(cleanBody);
    }

    // Use content export — backend converts HTML to PDF
    this.documentGenerationService.exportContentToPDF(exportHtml, this.activeDocumentTitle)
      .subscribe({
        next: (response) => this.handleExportResponse(response, 'pdf'),
        error: (error) => {
          this.notificationService.error('Error', 'Failed to export PDF.');
        }
      });
  }

  /**
   * Export document to Word (DOCX)
   * Uses backend API for proper conversion (same flow as PDF export)
   */
  exportToWord(): void {
    this.notificationService.loading('Preparing Word document', 'Please wait...');

    let exportHtml: string;

    if (this.originalTemplateHtml) {
      exportHtml = this.wrapContentWithStationery(this.originalTemplateHtml);
    } else {
      const htmlContent = this.getEditorContent();
      if (!htmlContent) {
        this.notificationService.error('Error', 'No content to export');
        return;
      }
      const cleanBody = this.documentGenerationService.cleanHtmlForExport(htmlContent);
      exportHtml = this.wrapContentWithStationery(cleanBody);
    }

    // Use content export — backend converts HTML to Word
    this.documentGenerationService.exportContentToWord(exportHtml, this.activeDocumentTitle)
      .subscribe({
        next: (response) => this.handleExportResponse(response, 'docx'),
        error: (error) => {
          this.notificationService.error('Error', 'Failed to export Word document.');
        }
      });
  }

  /**
   * Handle export response - download the blob
   */
  private handleExportResponse(response: any, format: 'pdf' | 'docx'): void {
    const blob = response.body;
    if (!blob) {
      this.notificationService.error('Error', `Failed to export ${format.toUpperCase()}.`);
      return;
    }

    const fallbackFilename = this.sanitizeFilename(this.activeDocumentTitle) + '.' + format;
    const filename = this.extractFilenameFromHeader(response.headers, fallbackFilename);

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    const formatName = format === 'pdf' ? 'PDF' : 'Word Document';
    this.notificationService.success(`${formatName} Exported`, `${filename} downloaded successfully`);
  }

  /**
   * Get raw HTML content from CKEditor
   * Returns raw HTML for proper conversion by documentGenerationService.convertHtmlToMarkdown()
   */
  private getEditorContent(): string | null {
    if (this.editorInstance) {
      return this.editorInstance.getData();
    }
    return this.pendingDocumentContent || null;
  }

  /**
   * Sanitize filename for safe file system use
   */
  private sanitizeFilename(name: string): string {
    return name
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
  }

  /**
   * Extract professional title from markdown content (first # heading)
   * Used to display document title instead of user prompt
   */
  private extractTitleFromMarkdown(content: string): string | null {
    if (!content) {
      return null;
    }

    // Look for first markdown heading (# Title)
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) {
        // Remove # symbols and trim
        const title = trimmed.replace(/^#+\s*/, '').trim();
        if (title) {
          return title;
        }
      }
    }

    return null;
  }

  // Delete all conversations (if needed in the UI)
  deleteAllConversations(): void {
    this.notificationService.confirmDelete(
      'Delete All Conversations?',
      'This will delete all conversations for the current task. This action cannot be undone.',
      'Yes, delete all'
    ).then((result) => {
      if (result.isConfirmed) {
        // Delete all conversations one by one
        const deletePromises = this.stateService.getConversations()
          .filter(c => c.backendConversationId)
          .map(c =>
            lastValueFrom(
              this.legalResearchService.deleteConversationById(c.backendConversationId!)
                .pipe(takeUntil(this.destroy$))
            )
          );

        Promise.all(deletePromises)
          .then(() => {
            this.stateService.setConversations([]);
            this.stateService.setActiveConversationId(null);
            this.stateService.clearConversationMessages();
            this.stateService.setShowChat(false);
            this.notificationService.success('Deleted!', 'All conversations have been deleted.');
            this.cdr.detectChanges();
          })
          .catch((error) => {
            this.notificationService.error('Error', 'Failed to delete some conversations.');
            this.loadConversations(); // Reload to get current state
          });
      }
    });
  }



  // ========================================
  // TEMPLATE/DOCUMENT TYPE FILTERING
  // ========================================


  // Toggle template filters
  toggleFilters(): void {
    this.showTemplateFilters = !this.showTemplateFilters;
  }

  // Select practice area
  selectPracticeArea(areaId: string): void {
    this.selectedPracticeArea = areaId;
  }

  // Select task (Protégé-style) - Default to Question (Legal Research)
  selectedTask: ConversationType = ConversationType.Question;
  activeTask: ConversationType = ConversationType.Question;

  selectTask(task: ConversationType): void {
    this.selectedTask = task;
    this.activeTask = task;

    // Persist task selection to state service for restoration on navigation
    this.stateService.setSelectedTask(task);

    this.stateService.setActiveConversationId(null);
    this.stateService.clearConversationMessages();

    // Close document viewer if switching away from upload mode
    if (task !== ConversationType.Upload && this.stateService.getDocumentViewerMode()) {
      this.stateService.closeDocumentViewer();
    }

    // Don't set showChat or showBottomSearchBar here - let them be set when:
    // 1. User sends first message (handled in startCustomDraft)
    // 2. User selects existing conversation (handled in loadConversation)

    // Note: Don't reload conversations here - they're already loaded at init
    // Reloading causes flickering as state gets temporarily inconsistent
  }

  // ========================================
  // FILE UPLOAD HANDLERS
  // ========================================

  /**
   * Trigger file upload dialog from sidebar button
   */
  triggerFileUpload(): void {
    if (this.fileInputRef?.nativeElement) {
      this.fileInputRef.nativeElement.click();
    } else {
      // Fallback: find file input in DOM
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) {
        fileInput.click();
      }
    }
  }

  /**
   * Open new analysis - returns to welcome screen with Upload taskcard selected
   * Used by "New Analysis" button in document analysis sidebar
   */
  openNewAnalysis(): void {
    // Close document viewer if open
    if (this.stateService.getDocumentViewerMode()) {
      this.stateService.closeDocumentViewer();
    }

    // Reset chat state
    this.stateService.setShowChat(false);
    this.stateService.clearConversationMessages();
    this.stateService.setActiveConversationId(null);

    // Reset workflow and generation state - allows starting fresh analysis
    this.stateService.setIsGenerating(false);
    this.stateService.setWorkflowSteps([]);
    this.stateService.clearFollowUpQuestions();

    // Select upload task (shows welcome screen with upload taskcard active)
    this.selectedTask = ConversationType.Upload;
    this.activeTask = ConversationType.Upload;

    // Expand sidebar if collapsed
    this.stateService.setViewerSidebarCollapsed(false);

    this.cdr.detectChanges();
  }

  /**
   * Handle file selection via input
   */
  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.handleFiles(Array.from(input.files));
    }
  }

  /**
   * Handle drag over event
   */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragover = true;
  }

  /**
   * Handle drag leave event
   */
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragover = false;
  }

  /**
   * Handle file drop event
   */
  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragover = false;

    if (event.dataTransfer?.files) {
      this.handleFiles(Array.from(event.dataTransfer.files));
    }
  }

  /**
   * Process selected files
   */
  private handleFiles(files: File[]): void {
    const maxFiles = 10;
    const maxSize = 25 * 1024 * 1024; // 25MB
    const allowedTypes = ['.pdf', '.docx', '.doc', '.txt'];

    // Filter valid files
    const validFiles = files.filter(file => {
      // Check file type
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!allowedTypes.includes(extension)) {
        this.notificationService.error('Invalid File Type', `${file.name} is not a supported format`);
        return false;
      }

      // Check file size
      if (file.size > maxSize) {
        this.notificationService.error('File Too Large', `${file.name} exceeds 25MB limit`);
        return false;
      }

      return true;
    });

    // Check total files limit
    if (this.uploadedFiles.length + validFiles.length > maxFiles) {
      this.notificationService.error('Too Many Files', `Maximum ${maxFiles} files allowed`);
      return;
    }

    // Add files to uploaded list with auto-detection
    validFiles.forEach(file => {
      const detectedType = this.detectDocumentType(file.name);
      const isOCR = this.needsOCR(file);

      this.uploadedFiles.push({
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'ready',
        file: file,
        detectedType: detectedType,
        isOCR: isOCR
      });

      if (isOCR) {
        this.notificationService.info('OCR Detected', `${file.name} may require OCR processing`);
      }
    });

    // Show context selection when files are uploaded
    if (validFiles.length > 0) {
      this.showContextSelection = true;

      // Smart context suggestion based on detected document type
      // Only suggest if user hasn't already selected a non-general context
      if (this.selectedAnalysisContext === 'general') {
        const firstFile = this.uploadedFiles[this.uploadedFiles.length - 1];
        if (firstFile?.detectedType) {
          const suggestion = this.suggestContextForDocumentType(firstFile.detectedType);
          if (suggestion && suggestion !== 'general') {
            this.suggestedContext = suggestion;
          }
        }
      }
    }

    // Don't auto-upload - wait for user to select analysis type and click "Analyze"
    // this.uploadFiles(); // Removed - now triggered by handleUploadAnalysis()
  }

  /**
   * Select analysis context
   */
  selectAnalysisContext(contextId: 'respond' | 'negotiate' | 'client_review' | 'due_diligence' | 'general'): void {
    this.selectedAnalysisContext = contextId;
    this.suggestedContext = null; // Clear suggestion when user manually selects
  }

  /**
   * Get the selected context option details
   */
  getSelectedContextOption() {
    return this.analysisContextOptions.find(opt => opt.id === this.selectedAnalysisContext);
  }

  /**
   * Suggest context based on detected document type
   */
  suggestedContext: 'respond' | 'negotiate' | 'client_review' | 'due_diligence' | 'general' | null = null;

  suggestContextForDocumentType(docType: string): 'respond' | 'negotiate' | 'client_review' | 'due_diligence' | 'general' | null {
    const lower = docType.toLowerCase();

    // Litigation documents → suggest "respond"
    if (lower.includes('complaint') || lower.includes('motion') || lower.includes('brief') ||
        lower.includes('subpoena') || lower.includes('discovery') || lower.includes('interrogator') ||
        lower.includes('demand') || lower.includes('cease') || lower.includes('desist')) {
      return 'respond';
    }

    // Contract documents → suggest "negotiate"
    if (lower.includes('contract') || lower.includes('agreement') || lower.includes('lease') ||
        lower.includes('nda') || lower.includes('employment') || lower.includes('settlement')) {
      return 'negotiate';
    }

    // Court orders, judgments → suggest "client_review" (explain to client what happened)
    if (lower.includes('order') || lower.includes('judgment') || lower.includes('decree') ||
        lower.includes('ruling') || lower.includes('decision')) {
      return 'client_review';
    }

    return null; // No suggestion for generic documents
  }

  /**
   * Apply suggested context
   */
  applySuggestedContext(): void {
    if (this.suggestedContext) {
      this.selectedAnalysisContext = this.suggestedContext;
      this.suggestedContext = null;
    }
  }

  /**
   * Get label for suggested context
   */
  getSuggestedContextLabel(): string {
    if (!this.suggestedContext) return '';
    const option = this.analysisContextOptions.find(opt => opt.id === this.suggestedContext);
    return option?.label || '';
  }

  /**
   * Upload files to server
   */
  private uploadFiles(sessionId?: number): void {
    const filesToUpload = this.uploadedFiles.filter(f => f.status === 'ready');
    const totalFiles = filesToUpload.length;

    if (totalFiles === 0) return;

    // Track completion across all parallel uploads
    let completedCount = 0;
    let failedCount = 0;
    const analysisResults: Array<{ id: string; databaseId: number; fileName: string }> = [];
    const pendingCollectionAdds: Promise<void>[] = [];

    // Capture collection ID at start (before any resets)
    const targetCollectionId = this.bulkUploadCollectionId;

    // Start batch processing
    this.isBatchProcessing = true;
    this.cdr.detectChanges();
    this.stateService.updateWorkflowStep(1, { status: WorkflowStepStatus.Active });

    // Register background task for document analysis
    const fileNames = filesToUpload.map(f => f.name).join(', ');
    const taskTitle = totalFiles === 1 ? filesToUpload[0].name : `${totalFiles} documents`;
    this.currentAnalysisTaskId = this.backgroundTaskService.registerTask(
      'analysis',
      taskTitle,
      `Analyzing: ${fileNames.substring(0, 50)}${fileNames.length > 50 ? '...' : ''}`
    );
    this.backgroundTaskService.startTask(this.currentAnalysisTaskId);

    filesToUpload.forEach((fileItem) => {
      if (!fileItem.file) {
        completedCount++;
        return;
      }

      // Update status to analyzing
      fileItem.status = 'analyzing';
      this.cdr.detectChanges();

      // Call document analyzer service - DON'T pass sessionId to avoid deadlocks
      // Session will be updated once at the end in finalizeUpload
      // NOTE: No takeUntil(destroy$) - analysis continues even if user navigates away
      this.documentAnalyzerService.analyzeDocument(
        fileItem.file,
        this.selectedAnalysisType,
        undefined,  // No sessionId for parallel uploads - prevents DB deadlocks
        this.selectedAnalysisContext,
        this.selectedCaseId
      ).subscribe({
        next: (result) => {
          // Service now filters to only emit Response events with valid results
          // Update file status
          fileItem.status = 'completed';
          fileItem.analysisId = result.id;
          analysisResults.push({ id: result.id, databaseId: result.databaseId, fileName: result.fileName });

          // Add to collection if target collection exists
          if (targetCollectionId && result.databaseId) {
            const addPromise = new Promise<void>((resolve, reject) => {
              let resolved = false;
              // NOTE: No takeUntil - collection add continues even if user navigates away
              this.collectionService.addDocumentToCollection(targetCollectionId, result.databaseId)
                .subscribe({
                  next: () => {
                    if (!resolved) { resolved = true; resolve(); }
                  },
                  error: (err) => {
                    if (!resolved) { resolved = true; reject(err); }
                  },
                  complete: () => {
                    // Ensure promise resolves even if subscription completes without next/error
                    if (!resolved) { resolved = true; resolve(); }
                  }
                });
            });
            pendingCollectionAdds.push(addPromise);
          }

          completedCount++;
          this.checkUploadCompletion(completedCount, failedCount, totalFiles, sessionId, analysisResults, targetCollectionId, pendingCollectionAdds);
        },
        error: () => {
          fileItem.status = 'failed';
          failedCount++;
          completedCount++;

          this.notificationService.error('Analysis Failed', `Failed to analyze ${fileItem.name}`);
          this.cdr.detectChanges();

          this.checkUploadCompletion(completedCount, failedCount, totalFiles, sessionId, analysisResults, targetCollectionId, pendingCollectionAdds);
        }
      });
    });
  }

  /**
   * Check if all uploads are complete and handle final actions
   */
  private checkUploadCompletion(
    completedCount: number,
    failedCount: number,
    totalFiles: number,
    sessionId: number | undefined,
    analysisResults: Array<{ id: string; databaseId: number; fileName: string }>,
    targetCollectionId: number | null,
    pendingCollectionAdds: Promise<void>[]
  ): void {
    // Not all files done yet
    if (completedCount < totalFiles) {
      return;
    }

    // Wait for all collection additions to complete before finalizing
    if (targetCollectionId && pendingCollectionAdds.length > 0) {
      Promise.allSettled(pendingCollectionAdds).then(() => {
        this.finalizeUpload(failedCount, totalFiles, sessionId, analysisResults, targetCollectionId);
      });
    } else {
      this.finalizeUpload(failedCount, totalFiles, sessionId, analysisResults, targetCollectionId);
    }
  }

  /**
   * Finalize the upload process after all files and collection adds are done
   */
  private async finalizeUpload(
    failedCount: number,
    totalFiles: number,
    sessionId: number | undefined,
    analysisResults: Array<{ id: string; databaseId: number; fileName: string }>,
    targetCollectionId: number | null
  ): Promise<void> {
    // CRITICAL: Refresh token before making follow-up API requests after long analysis
    // This prevents logout when token expired during the 10+ minute analysis
    try {
      if (this.userService.isTokenAboutToExpire(5)) {
        await lastValueFrom(this.userService.refreshToken$());
      }
    } catch (error) {
      // Continue anyway - interceptor will handle if truly expired
    }

    // CRITICAL: Complete background task FIRST (before any component operations)
    // This ensures toast notification is sent even if component is destroyed
    if (this.currentAnalysisTaskId) {
      if (failedCount === totalFiles) {
        this.backgroundTaskService.failTask(this.currentAnalysisTaskId, 'All documents failed to analyze');
      } else {
        this.backgroundTaskService.completeTask(this.currentAnalysisTaskId, {
          successCount: analysisResults.length,
          failedCount,
          results: analysisResults
        });
      }
      this.currentAnalysisTaskId = null;
    }

    // Component UI updates - wrapped in try-catch because component may be destroyed
    try {
      // Complete all workflow steps
      this.completeAllWorkflowSteps();
      this.stateService.setIsGenerating(false);

      // End batch processing
      this.isBatchProcessing = false;
      // Save assistant message to backend with analysis metadata
      if (sessionId && analysisResults.length > 0) {
        const lastResult = analysisResults[analysisResults.length - 1];
        const assistantContent = analysisResults.length === 1
          ? `Document analysis completed for ${lastResult.fileName}`
          : `Batch analysis completed for ${analysisResults.length} documents`;

        this.legalResearchService.addMessageToSession(
          sessionId,
          this.currentUser?.id || 1,
          'assistant',
          assistantContent,
          { analysisId: lastResult.id, databaseId: lastResult.databaseId }
        ).pipe(takeUntil(this.destroy$))
         .subscribe();
      }

      // Handle collection upload completion
      if (targetCollectionId) {
        // No notification here - background task toast already notified user

        // Reset collection state
        this.createCollectionOnUpload = false;
        this.newCollectionName = '';
        this.selectedUploadCollectionId = null;
        this.newUploadCollectionName = '';
        this.bulkUploadCollectionId = null;

        // Refresh collections list
        this.loadCollections();

        // Open collection viewer
        this.isViewingCollection = true;
        this.activeCollectionId = targetCollectionId;
        this.stateService.setShowChat(false);
        this.cdr.detectChanges();
      } else if (analysisResults.length > 0) {
        // No collection - load history from DB and then open the document
        // IMPORTANT: Don't call displayAnalysisResults() here - loadAnalysisHistory() already includes the doc
        // Calling both would add the document twice to the sidebar
        const lastResult = analysisResults[analysisResults.length - 1];
        const databaseId = lastResult.databaseId || lastResult.id;
        const normalizedId = `analysis_${databaseId}`;

        // Load history first (includes the new document from DB)
        this.loadAnalysisHistory();

        // After history loads, open the document in viewer
        setTimeout(() => {
          const doc = this.stateService.getAnalyzedDocumentById(normalizedId);
          if (doc) {
            this.openDocumentInViewer(doc);
          }
          this.cdr.detectChanges();
        }, 500);
      } else {
        // All failed
        this.stateService.addConversationMessage({
          role: 'assistant',
          content: `❌ All ${totalFiles} document analyses failed. Please try again.`,
          timestamp: new Date()
        });
        this.cdr.detectChanges();
      }
    } catch (e) {
      // Component was destroyed - UI updates not needed, but background task already completed
    }
  }

  /**
   * Fetch document from URL
   */
  fetchFromUrl(): void {
    if (!this.documentUrl.trim()) return;

    this.isFetchingUrl = true;
    this.notificationService.info('Fetching Document', 'Downloading from URL...');

    // Use backend proxy to fetch document (supports cloud storage URLs and avoids CORS)
    this.documentAnalyzerService.fetchDocumentFromUrl(this.documentUrl)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ blob, filename }) => {
          // Convert blob to File object
          const file = new File([blob], filename, { type: blob.type });
          this.handleFiles([file]);
          this.documentUrl = '';
          this.isFetchingUrl = false;
          this.notificationService.success('Download Complete', `Document "${filename}" fetched successfully`);
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.isFetchingUrl = false;
          this.cdr.detectChanges();

          // Show more specific error message if available
          let errorMsg = 'Could not download document from URL';
          if (error.error instanceof Blob) {
            // Try to extract error message from blob
            error.error.text().then((text: string) => {
              try {
                const errObj = JSON.parse(text);
                if (errObj.error) errorMsg = errObj.error;
              } catch (e) {
                // Ignore parsing error, use default message
              }
              this.notificationService.error('Fetch Failed', errorMsg);
            });
          } else {
            this.notificationService.error('Fetch Failed', errorMsg);
          }
        }
      });
  }

  /**
   * View analysis results for a file
   */
  viewAnalysis(file: any): void {
    if (!file.analysisId) return;

    this.documentAnalyzerService.getAnalysisById(file.analysisId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (analysis) => {
          // Format structured analysis with Velzon HTML components
          let formattedAnalysis = '';

          // BEAUTIFUL DOCUMENT HEADER CARD
          formattedAnalysis += `<div class="card border-0 shadow-sm mb-4 document-header-card">`;
          formattedAnalysis += `<div class="card-body">`;
          formattedAnalysis += `<div class="row align-items-center mb-3">`;
          formattedAnalysis += `<div class="col-auto">`;
          formattedAnalysis += `<div class="avatar-lg bg-primary-subtle rounded d-flex align-items-center justify-content-center" style="width: 4rem; height: 4rem;">`;
          formattedAnalysis += `<i class="ri-file-text-line fs-1 text-primary"></i>`;
          formattedAnalysis += `</div>`;
          formattedAnalysis += `</div>`;
          formattedAnalysis += `<div class="col">`;
          formattedAnalysis += `<h3 class="mb-2 fw-bold">📄 Strategic Document Analysis</h3>`;
          formattedAnalysis += `<p class="text-muted mb-0">${analysis.fileName}</p>`;
          formattedAnalysis += `</div>`;
          formattedAnalysis += `</div>`;

          // Metadata grid
          let metadata: any = {};
          if (analysis.extractedMetadata) {
            try {
              metadata = JSON.parse(analysis.extractedMetadata);
            } catch {
              // Error handled silently
            }
          }

          formattedAnalysis += `<div class="row g-3 mt-2">`;

          // Document Type
          if (analysis.detectedType) {
            formattedAnalysis += `<div class="col-md-4">`;
            formattedAnalysis += `<div class="p-3 border rounded bg-light">`;
            formattedAnalysis += `<p class="text-muted mb-2 text-uppercase fs-6 fw-semibold" style="font-size: 0.75rem; letter-spacing: 0.5px;">Document Type</p>`;
            formattedAnalysis += `<span class="badge bg-primary-subtle text-primary fs-6 px-3 py-2">${analysis.detectedType}</span>`;
            formattedAnalysis += `</div>`;
            formattedAnalysis += `</div>`;
          }

          // Case Number
          if (metadata.caseNumber) {
            formattedAnalysis += `<div class="col-md-4">`;
            formattedAnalysis += `<div class="p-3 border rounded bg-light">`;
            formattedAnalysis += `<p class="text-muted mb-2 text-uppercase fs-6 fw-semibold" style="font-size: 0.75rem; letter-spacing: 0.5px;">Case Number</p>`;
            formattedAnalysis += `<p class="mb-0 fw-semibold">${metadata.caseNumber}</p>`;
            formattedAnalysis += `</div>`;
            formattedAnalysis += `</div>`;
          }

          // Date
          if (metadata.primaryDate) {
            formattedAnalysis += `<div class="col-md-4">`;
            formattedAnalysis += `<div class="p-3 border rounded bg-light">`;
            formattedAnalysis += `<p class="text-muted mb-2 text-uppercase fs-6 fw-semibold" style="font-size: 0.75rem; letter-spacing: 0.5px;">Date</p>`;
            formattedAnalysis += `<p class="mb-0 fw-semibold">${metadata.primaryDate}</p>`;
            formattedAnalysis += `</div>`;
            formattedAnalysis += `</div>`;
          }

          // Court (if available)
          if (metadata.court) {
            formattedAnalysis += `<div class="col-md-6">`;
            formattedAnalysis += `<div class="p-3 border rounded bg-light">`;
            formattedAnalysis += `<p class="text-muted mb-2 text-uppercase fs-6 fw-semibold" style="font-size: 0.75rem; letter-spacing: 0.5px;">Court</p>`;
            formattedAnalysis += `<p class="mb-0 fw-semibold">${metadata.court}</p>`;
            formattedAnalysis += `</div>`;
            formattedAnalysis += `</div>`;
          }

          // Parties (if available)
          if (metadata.partiesDisplay) {
            formattedAnalysis += `<div class="col-md-6">`;
            formattedAnalysis += `<div class="p-3 border rounded bg-light">`;
            formattedAnalysis += `<p class="text-muted mb-2 text-uppercase fs-6 fw-semibold" style="font-size: 0.75rem; letter-spacing: 0.5px;">Parties</p>`;
            formattedAnalysis += `<p class="mb-0 fw-semibold">${metadata.partiesDisplay}</p>`;
            formattedAnalysis += `</div>`;
            formattedAnalysis += `</div>`;
          }

          formattedAnalysis += `</div>`; // Close row
          formattedAnalysis += `</div>`; // Close card-body
          formattedAnalysis += `</div>`; // Close card

          // Parse sections BEFORE HTML formatting (parse from original markdown)
          const originalAnalysis = analysis.analysis?.fullAnalysis || analysis.analysis?.summary || '';
          const parsedSections = this.parseStrategicSections(originalAnalysis);

          // Add main strategic analysis with enhanced styling (RE-PROCESS OLD CONTENT)
          if (analysis.analysis?.fullAnalysis) {
            // Process the analysis to add Velzon styling classes
            let processedAnalysis = this.enhanceAnalysisWithStyling(analysis.analysis.fullAnalysis);
            formattedAnalysis += processedAnalysis;
          } else if (analysis.analysis?.summary) {
            formattedAnalysis += `<div class="card border-0 shadow-sm">\n`;
            formattedAnalysis += `<div class="card-body">\n\n`;
            formattedAnalysis += `## 📝 Summary\n\n`;
            formattedAnalysis += analysis.analysis.summary;
            formattedAnalysis += `\n\n</div></div>\n\n`;
          }
          // Always set true for document analysis - content was enhanced with HTML
          const hasStrategicAnalysis = true;

          // Add to conversation as assistant message with proper flags
          this.stateService.addConversationMessage({
            role: 'assistant',
            content: formattedAnalysis,
            timestamp: new Date(),
            hasStrategicAnalysis,
            parsedSections,
            analysisId: analysis.databaseId
          });

          // Show chat
          this.stateService.setShowChat(true);

          this.notificationService.success('Analysis Loaded', 'Viewing analysis results');
        },
        error: (error) => {
          this.notificationService.error('Error', 'Failed to load analysis');
        }
      });
  }

  /**
   * Remove file from list
   */
  removeFile(index: number): void {
    this.uploadedFiles.splice(index, 1);
    // Reset collection option if only 1 file left
    if (this.uploadedFiles.length <= 1) {
      this.createCollectionOnUpload = false;
      this.newCollectionName = '';
    }
    // Hide context selection if no files
    if (this.uploadedFiles.length === 0) {
      this.showContextSelection = false;
      this.selectedAnalysisContext = 'general';
    }
  }

  /**
   * Generate default collection name from uploaded files
   */
  getDefaultCollectionName(): string {
    if (this.uploadedFiles.length === 0) return 'Document Collection';
    const firstFile = this.uploadedFiles[0].name;
    const baseName = firstFile.replace(/\.[^/.]+$/, ''); // Remove extension
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${baseName} + ${this.uploadedFiles.length - 1} docs (${date})`;
  }

  /**
   * Get count of completed files during batch processing
   */
  getCompletedFilesCount(): number {
    return this.uploadedFiles.filter(f => f.status === 'completed' || f.status === 'failed').length;
  }

  /**
   * Display analysis results - opens Document Analysis Viewer
   * @param result - The analysis result to display
   * @param showNotification - Whether to show a success notification (default: true)
   *                           Set to false when called from background task handlers to avoid duplicate toasts
   */
  private displayAnalysisResults(result: any, showNotification: boolean = true): void {
    // Normalize the ID - use the same format as loadAnalysisHistory: 'analysis_${databaseId}'
    // This ensures no duplicates when loadAnalysisHistory runs after displayAnalysisResults
    const databaseId = result.databaseId || result.id;
    const normalizedId = `analysis_${databaseId}`;

    // Create analyzed document object for state
    const analyzedDoc: AnalyzedDocument = {
      id: normalizedId,
      databaseId: databaseId,
      fileName: result.fileName,
      fileSize: result.fileSize,
      detectedType: result.detectedType || 'Document',
      riskLevel: result.analysis?.riskLevel,
      riskScore: result.analysis?.riskScore,
      analysis: result.analysis,
      extractedMetadata: result.extractedMetadata,
      timestamp: Date.now(),
      status: 'completed'
    };

    // Add to analyzed documents state
    this.stateService.addAnalyzedDocument(analyzedDoc);

    // Clear uploaded files from upload zone after successful analysis
    this.uploadedFiles = [];

    // Open document viewer in full-page mode (sidebar collapsed)
    this.stateService.setViewerSidebarCollapsed(true);
    this.stateService.openDocumentViewer(normalizedId);

    // Show success notification only if requested (skip for background task results)
    if (showNotification) {
      this.notificationService.success(
        'Analysis Complete',
        `${result.fileName} has been analyzed successfully`
      );
    }

    // Force change detection
    this.cdr.detectChanges();
  }

  /**
   * Load document analysis from a conversation (when clicking sidebar item)
   */
  loadDocumentAnalysisFromConversation(conv: Conversation): void {
    // First, load the conversation to get the analysis ID from messages
    this.legalResearchService.getConversationById(conv.backendConversationId!)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Find the analysis ID from message metadata
          // Try analysisId (UUID string) first, then databaseId (number) as fallback
          let analysisId: string | null = null;
          let databaseId: number | null = null;

          for (const msg of response.messages) {
            if (msg.metadata) {
              const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;

              // Prefer the UUID analysisId for API calls
              if (metadata.analysisId && typeof metadata.analysisId === 'string') {
                analysisId = metadata.analysisId;
                databaseId = metadata.databaseId || null;
                break;
              }
              // Fallback: if only databaseId exists (old format), we can't use getAnalysisById
              if (metadata.analysisId && typeof metadata.analysisId === 'number') {
                databaseId = metadata.analysisId;
              }
              if (metadata.databaseId) {
                databaseId = metadata.databaseId;
              }
            }
          }

          if (!analysisId && !databaseId) {
            // No analysis ID found in conversation messages, showing chat view instead
            // Fall back to regular chat view
            this.loadConversationAsChat(conv, response);
            return;
          }

          // Load the analysis from the backend
          // Use UUID if available, otherwise use database ID
          const analysisObservable = analysisId
            ? this.documentAnalyzerService.getAnalysisById(analysisId)
            : this.documentAnalyzerService.getAnalysisByDatabaseId(databaseId!);

          analysisObservable
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (analysisResult) => {
                // Create AnalyzedDocument and add to state
                const analyzedDoc: AnalyzedDocument = {
                  id: `analysis_${analysisResult.databaseId}`,
                  databaseId: analysisResult.databaseId,
                  fileName: analysisResult.fileName || conv.title,
                  fileSize: analysisResult.fileSize || 0,
                  detectedType: analysisResult.detectedType || 'Document',
                  extractedMetadata: analysisResult.extractedMetadata,
                  analysis: analysisResult.analysis,
                  timestamp: analysisResult.timestamp || Date.now(),
                  status: 'completed'
                };

                // Add to state if not already present
                const existingDoc = this.stateService.getAnalyzedDocumentById(analyzedDoc.id);
                if (!existingDoc) {
                  this.stateService.addAnalyzedDocument(analyzedDoc);
                }

                // Open in viewer
                this.stateService.openDocumentViewer(analyzedDoc.id);
                this.cdr.detectChanges();
              },
              error: (error) => {
                this.notificationService.error('Error', 'Failed to load document analysis');
                // Fall back to chat view
                this.loadConversationAsChat(conv, response);
              }
            });
        },
        error: (error) => {
          this.notificationService.error('Error', 'Failed to load conversation');
        }
      });
  }

  /**
   * Load conversation as regular chat (fallback for document analysis without analysis ID)
   */
  private loadConversationAsChat(conv: Conversation, response: any): void {
    this.stateService.setActiveConversationId(conv.id);
    this.stateService.clearFollowUpQuestions();

    const messages = response.messages.map((msg: any) => {
      const baseMessage: any = {
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.createdAt || new Date())
      };
      // Add bookmark and metadata for assistant messages
      if (msg.role === 'assistant') {
        baseMessage.bookmarked = msg.bookmarked || false;
        baseMessage.id = msg.id;
        // Pass metadata through for quality score display
        if (msg.metadata) {
          try {
            baseMessage.metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
          } catch {
            // Malformed metadata — skip gracefully
          }
        }
      }
      return baseMessage;
    });

    // Filter to bookmarked responses only when "Saved" tab is active
    const displayMessages = this.showBookmarkedOnly
      ? this.filterBookmarkedMessages(messages)
      : messages;

    this.stateService.setConversationMessages(displayMessages);
    this.stateService.setShowChat(true);
    this.cdr.detectChanges();
  }

  /**
   * Open document in viewer (from sidebar)
   * If fullAnalysis is empty, fetch it from backend first
   * Auto-collapses sidebar for full-page viewer by default
   */
  openDocumentInViewer(document: AnalyzedDocument): void {
    // Don't open if document is still analyzing
    if (document.status === 'analyzing') {
      this.notificationService.info('Analysis in Progress', 'Please wait for the analysis to complete.');
      return;
    }

    // Auto-collapse sidebar for full-page view when clicking from sidebar
    this.stateService.setViewerSidebarCollapsed(true);

    // Check if we need to fetch full analysis
    if (!document.analysis?.fullAnalysis && document.databaseId) {
      // Fetch full analysis from backend
      this.documentAnalyzerService.getAnalysisByDatabaseId(document.databaseId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (result) => {
            // Update the document with full analysis
            const updatedDoc: AnalyzedDocument = {
              ...document,
              analysis: result.analysis ? {
                fullAnalysis: result.analysis.fullAnalysis || '',
                summary: result.analysis.summary,
                riskScore: result.analysis.riskScore,
                riskLevel: result.analysis.riskLevel,
                keyFindings: result.analysis.keyFindings,
                recommendations: result.analysis.recommendations
              } : document.analysis,
              extractedMetadata: result.extractedMetadata || document.extractedMetadata,
              fileSize: result.fileSize || document.fileSize
            };

            // Update in state
            this.stateService.updateAnalyzedDocument(document.id, updatedDoc);

            // Open viewer
            this.stateService.openDocumentViewer(document.id);
            this.cdr.detectChanges();
          },
          error: () => {
            // Still open viewer with partial data
            this.stateService.openDocumentViewer(document.id);
            this.cdr.detectChanges();
          }
        });
    } else {
      // Full analysis already available, open directly
      this.stateService.openDocumentViewer(document.id);
      this.cdr.detectChanges();
    }
  }

  /**
   * Close document viewer and return to upload screen
   */
  closeDocumentViewer(): void {
    this.stateService.closeDocumentViewer();

    // Reset state to show welcome screen (not the chat with user prompt)
    this.stateService.setShowChat(false);
    this.stateService.clearConversationMessages();
    this.stateService.setActiveConversationId(null);

    this.cdr.detectChanges();
  }

  /**
   * Get active document for viewer
   */
  getActiveDocument(): AnalyzedDocument | undefined {
    return this.stateService.getActiveDocument();
  }

  /**
   * Set conversation filter (all, case, general)
   */
  setConversationFilter(filter: 'all' | 'case' | 'general'): void {
    this.conversationFilter = filter;
    this.cdr.detectChanges();
  }

  /**
   * Get icon for conversation type
   */
  getConversationIcon(type: ConversationType): string {
    const icons: Record<ConversationType, string> = {
      [ConversationType.Question]: 'ri-question-line',
      [ConversationType.Draft]: 'ri-file-edit-line',
      [ConversationType.Summarize]: 'ri-file-list-3-line',
      [ConversationType.Upload]: 'ri-file-upload-line',
      [ConversationType.Workflow]: 'ri-flow-chart'
    };
    return icons[type] || 'ri-chat-3-line';
  }

/**
   * Strip timestamp prefix from filename (e.g., "1764550939268_Executive..." -> "Executive...")
   * Backend saves files with timestamp prefix for uniqueness
   */
  getCleanFileName(fileName: string | undefined): string {
    if (!fileName) return 'Unknown Document';
    // Match pattern: digits followed by underscore at start
    return fileName.replace(/^\d+_/, '');
  }

  /**
   * Get badge class for document type - matches header badge colors
   */
  getDocTypeBadgeClass(docType: string | undefined): string {
    if (!docType) return 'status-default';
    const type = docType.toLowerCase();

    // Pleadings - Red (matches header)
    if (type.includes('complaint') || type.includes('answer') || type.includes('counterclaim') || type.includes('petition') || type.includes('pleading')) return 'status-pleading';

    // Motions - Purple (matches header)
    if (type.includes('motion') || type.includes('suppress') || type.includes('dismiss') || type.includes('compel') || type.includes('protective')) return 'status-motion';

    // Discovery - Teal (matches header)
    if (type.includes('discovery') || type.includes('interrogat') || type.includes('deposition') || type.includes('subpoena') || type.includes('request for') || type.includes('admission') || type.includes('production')) return 'status-discovery';

    // Court Orders - Yellow (matches header)
    if (type.includes('order') || type.includes('judgment') || type.includes('decree') || type.includes('injunction') || type.includes('ruling')) return 'status-order';

    // Contracts - Green (matches header)
    if (type.includes('contract') || type.includes('agreement') || type.includes('lease') || type.includes('nda') || type.includes('settlement')) return 'status-contract';

    // Briefs/Memos - Indigo (matches header)
    if (type.includes('brief') || type.includes('appellate') || type.includes('appeal') || type.includes('memo')) return 'status-brief';

    // Correspondence/Letters - Orange (matches header)
    if (type.includes('letter') || type.includes('correspondence') || type.includes('notice') || type.includes('demand') || type.includes('cease')) return 'status-letter';

    // Declarations & Affidavits
    if (type.includes('affidavit') || type.includes('declaration') || type.includes('exhibit')) return 'status-declaration';

    return 'status-default';
  }

  /**
   * Set draft filter
   */
  setDraftFilter(filter: 'all' | 'motions' | 'letters' | 'contracts'): void {
    this.draftFilter = filter;
    this.cdr.detectChanges();
  }

  /**
   * Set workflow filter
   */
  setWorkflowFilter(filter: 'all' | 'active' | 'pending' | 'completed'): void {
    this.workflowFilter = filter;
    this.cdr.detectChanges();
  }

  setBookmarkFilter(bookmarked: boolean): void {
    this.showBookmarkedOnly = bookmarked;
    this.loadConversations();
  }

  /**
   * Filter messages to show only bookmarked assistant responses + their preceding user questions.
   * Used when "Saved" tab is active to show only relevant responses instead of full conversation.
   */
  private filterBookmarkedMessages(messages: any[]): any[] {
    const filtered: any[] = [];
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === 'assistant' && messages[i].bookmarked) {
        // Include the preceding user question for context
        if (i > 0 && messages[i - 1].role === 'user') {
          filtered.push(messages[i - 1]);
        }
        filtered.push(messages[i]);
      }
    }
    return filtered;
  }

  /**
   * Show all messages in the current conversation (exit bookmarked-only view).
   */
  showAllMessages(): void {
    const activeId = this.stateService.getActiveConversationId();
    if (activeId) {
      this.showBookmarkedOnly = false;
      this.loadConversation(activeId);
      this.loadConversations(); // Refresh sidebar to reflect "All" tab
    }
  }

  /**
   * Get conversation preview text (last assistant message excerpt)
   */
  getConversationPreview(conv: Conversation): string {
    if (!conv.messages || conv.messages.length === 0) {
      return 'No messages yet...';
    }
    // Find last assistant message
    const assistantMessages = conv.messages.filter(m => m.role === 'assistant');
    if (assistantMessages.length === 0) {
      return 'Awaiting response...';
    }
    const lastMessage = assistantMessages[assistantMessages.length - 1];
    // Strip HTML and get plain text excerpt
    const plainText = lastMessage.content.replace(/<[^>]*>/g, '').trim();
    return plainText || 'No preview available';
  }

  /**
   * Get draft status based on conversation state
   */
  getDraftStatus(conv: Conversation): string {
    // First, try to use the stored documentType from the conversation
    if (conv.documentType) {
      return this.formatDocumentType(conv.documentType);
    }

    // Fallback: detect from title
    const title = (conv.title || '').toLowerCase();
    if (title.includes('motion to compel')) return 'MOTION TO COMPEL';
    if (title.includes('motion to dismiss')) return 'MOTION TO DISMISS';
    if (title.includes('motion for summary')) return 'SUMMARY JUDGMENT';
    if (title.includes('motion')) return 'MOTION';
    if (title.includes('demand letter')) return 'DEMAND LETTER';
    if (title.includes('letter')) return 'LETTER';
    if (title.includes('contract')) return 'CONTRACT';
    if (title.includes('agreement')) return 'AGREEMENT';
    if (title.includes('brief')) return 'BRIEF';
    if (title.includes('complaint')) return 'COMPLAINT';
    if (title.includes('answer')) return 'ANSWER';
    if (title.includes('interrogator')) return 'INTERROGATORIES';
    if (title.includes('discovery')) return 'DISCOVERY';
    if (title.includes('subpoena')) return 'SUBPOENA';
    if (title.includes('affidavit')) return 'AFFIDAVIT';
    if (title.includes('memo')) return 'MEMO';
    return 'DRAFT';
  }

  /**
   * Format document type ID to display label
   */
  formatDocumentType(docType: string): string {
    const typeMap: Record<string, string> = {
      'motion_to_compel': 'MOTION TO COMPEL',
      'motion_to_dismiss': 'MOTION TO DISMISS',
      'motion_summary_judgment': 'SUMMARY JUDGMENT',
      'motion_preliminary_injunction': 'INJUNCTION',
      'motion_protective_order': 'PROTECTIVE ORDER',
      'demand_letter': 'DEMAND LETTER',
      'cease_desist': 'CEASE & DESIST',
      'settlement_demand': 'SETTLEMENT',
      'contract_review': 'CONTRACT',
      'contract_draft': 'CONTRACT',
      'nda': 'NDA',
      'employment_agreement': 'EMPLOYMENT',
      'complaint': 'COMPLAINT',
      'answer': 'ANSWER',
      'counterclaim': 'COUNTERCLAIM',
      'interrogatories': 'INTERROGATORIES',
      'requests_production': 'PRODUCTION REQ',
      'requests_admission': 'ADMISSION REQ',
      'subpoena': 'SUBPOENA',
      'legal_brief': 'BRIEF',
      'legal_memo': 'MEMO',
      'case_summary': 'CASE SUMMARY',
      'affidavit': 'AFFIDAVIT',
      'declaration': 'DECLARATION'
    };
    return typeMap[docType] || docType.replace(/_/g, ' ').toUpperCase();
  }

  /**
   * Get draft status badge class
   */
  getDraftStatusClass(conv: Conversation): string {
    const status = this.getDraftStatus(conv).toUpperCase();
    return this.getDocTypeBadgeClass(status);
  }

  /**
   * Get workflow section title based on filter
   */
  getWorkflowSectionTitle(): string {
    switch (this.workflowFilter) {
      case 'all': return 'All Workflows';
      case 'active': return 'Active Workflows';
      case 'pending': return 'Pending Workflows';
      case 'completed': return 'Completed Workflows';
      default: return 'Workflows';
    }
  }

  /**
   * Get workflow status dot class
   */
  getWorkflowStatusDotClass(workflow: any): string {
    switch (workflow.status) {
      case 'RUNNING': return 'dot-active';
      case 'COMPLETED': return 'dot-completed';
      case 'PENDING': case 'WAITING_USER': return 'dot-pending';
      case 'FAILED': return 'dot-failed';
      default: return 'dot-pending';
    }
  }

  /**
   * Get workflow progress bar class
   */
  getWorkflowProgressClass(workflow: any): string {
    switch (workflow.status) {
      case 'RUNNING': return 'progress-active';
      case 'COMPLETED': return 'progress-completed';
      case 'PENDING': case 'WAITING_USER': return 'progress-pending';
      case 'FAILED': return 'progress-failed';
      default: return 'progress-pending';
    }
  }

  /**
   * Get human-readable status label
   */
  getWorkflowStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'RUNNING': 'Running',
      'COMPLETED': 'Done',
      'PENDING': 'Pending',
      'WAITING_USER': 'Waiting',
      'FAILED': 'Failed',
      'PAUSED': 'Paused'
    };
    return labels[status] || status;
  }

  /**
   * Download workflow report
   */
  downloadWorkflowReport(workflow: any): void {
    // TODO: Implement report download via service
    this.notificationService.info('Report', 'Report download is being finalized');
  }

  /**
   * Get workflow display name - format: "{Template} – {Case Name}"
   */
  getWorkflowDisplayName(workflow: any): string {
    // First priority: user-provided name
    if (workflow.name) {
      return workflow.name;
    }

    let templateName = '';
    let caseName = '';

    // Get template name
    if (workflow.template?.name) {
      templateName = workflow.template.name;
    } else if (workflow.templateId && this.workflowTemplates?.length > 0) {
      const template = this.workflowTemplates.find(t => t.id === workflow.templateId);
      if (template?.name) {
        templateName = template.name;
      }
    }

    // Get case name
    if (workflow.legalCase?.caseName) {
      caseName = workflow.legalCase.caseName;
    } else if (workflow.legalCase?.clientName) {
      caseName = workflow.legalCase.clientName;
    }

    // Format: "Template – Case" or just one if other is missing
    if (templateName && caseName) {
      return `${templateName} – ${caseName}`;
    } else if (templateName) {
      return templateName;
    } else if (caseName) {
      return caseName;
    }

    // Fallback with ID
    return `Workflow #${workflow.id}`;
  }

  /**
   * Get count of completed steps in workflow
   */
  getCompletedStepsCount(workflow: any): number {
    // If stepExecutions are loaded (from details endpoint), count completed steps
    if (workflow.stepExecutions?.length > 0) {
      return workflow.stepExecutions.filter((s: any) => s.status === 'COMPLETED').length;
    }
    // Fallback to currentStep (set by backend as each step completes)
    // currentStep represents the last completed step number
    return workflow.currentStep || 0;
  }

  /**
   * Get workflow progress percentage based on completed steps
   */
  getWorkflowProgressPercentage(workflow: any): number {
    // If stepExecutions are loaded, calculate from them
    if (workflow.stepExecutions?.length > 0) {
      const completed = workflow.stepExecutions.filter((s: any) => s.status === 'COMPLETED').length;
      const total = workflow.totalSteps || workflow.stepExecutions.length;
      return Math.round((completed / total) * 100);
    }
    // Check status first
    if (workflow.status === 'COMPLETED') return 100;
    if (workflow.status === 'PENDING') return 0;
    // Use stored progressPercentage or calculate from currentStep
    if (workflow.progressPercentage) {
      return workflow.progressPercentage;
    }
    // Calculate from currentStep if available
    if (workflow.currentStep && workflow.totalSteps) {
      return Math.round((workflow.currentStep / workflow.totalSteps) * 100);
    }
    return 0;
  }

  /**
   * Close workflow details (alias for closeWorkflowDetailsModal)
   */
  closeWorkflowDetails(): void {
    this.closeWorkflowDetailsModal();
  }

  /**
   * Get workflow status icon class
   */
  getWorkflowStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      'RUNNING': 'ri-loader-4-line spin',
      'COMPLETED': 'ri-checkbox-circle-fill',
      'PENDING': 'ri-time-line',
      'WAITING_USER': 'ri-pause-circle-line',
      'FAILED': 'ri-error-warning-fill',
      'PAUSED': 'ri-pause-line'
    };
    return icons[status] || 'ri-question-line';
  }

  /**
   * Toggle step output visibility
   */
  toggleStepOutput(step: any): void {
    if (this.expandedStepId === step.id) {
      this.expandedStepId = null;
    } else {
      this.expandedStepId = step.id;
    }
    this.cdr.detectChanges();
  }

  /**
   * Pause a running workflow
   */
  pauseWorkflow(executionId: number): void {
    this.caseWorkflowService.pauseWorkflow(executionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notificationService.success('Success', 'Workflow paused');
          this.loadUserWorkflows();
          if (this.selectedWorkflowForDetails?.id === executionId) {
            this.viewWorkflowDetails(this.selectedWorkflowForDetails);
          }
        },
        error: (error) => {
          this.notificationService.error('Error', 'Failed to pause workflow');
        }
      });
  }

  /**
   * Cancel a workflow
   */
  cancelWorkflow(executionId: number): void {
    this.caseWorkflowService.cancelWorkflow(executionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notificationService.success('Success', 'Workflow cancelled');
          this.closeWorkflowDetailsModal();
          this.loadUserWorkflows();
        },
        error: (error) => {
          this.notificationService.error('Error', 'Failed to cancel workflow');
        }
      });
  }

  /**
   * Export document analysis as PDF
   */
  onExportPdf(document: AnalyzedDocumentData): void {
    // TODO: Implement PDF export
    this.notificationService.info('Feature Being Finalized', 'PDF export is being finalized');
  }

  /**
   * Export document analysis as Word
   */
  onExportWord(document: AnalyzedDocumentData): void {
    // TODO: Implement Word export
    this.notificationService.info('Feature Being Finalized', 'Word export is being finalized');
  }

  /**
   * Save analysis to File Manager
   */
  onSaveToFileManager(document: AnalyzedDocumentData): void {
    // TODO: Implement File Manager integration
    this.notificationService.info('Feature Being Finalized', 'File Manager integration is being finalized');
  }

  /**
   * LEGACY: Display analysis results in chat (kept for backwards compatibility)
   * This method is no longer used but kept for reference
   */
  private displayAnalysisResultsLegacy(result: any): void {
    // Format structured analysis with PURE HTML (no markdown symbols)
    let formattedAnalysis = '';

    // BEAUTIFUL DOCUMENT HEADER CARD
    formattedAnalysis += `<div class="card border-0 shadow-sm mb-4 document-header-card">`;
    formattedAnalysis += `<div class="card-body">`;
    formattedAnalysis += `<div class="row align-items-center mb-3">`;
    formattedAnalysis += `<div class="col-auto">`;
    formattedAnalysis += `<div class="avatar-lg bg-primary-subtle rounded d-flex align-items-center justify-content-center" style="width: 4rem; height: 4rem;">`;
    formattedAnalysis += `<i class="ri-file-text-line fs-1 text-primary"></i>`;
    formattedAnalysis += `</div>`;
    formattedAnalysis += `</div>`;
    formattedAnalysis += `<div class="col">`;
    formattedAnalysis += `<h3 class="mb-2 fw-bold">📄 Strategic Document Analysis</h3>`;
    formattedAnalysis += `<p class="text-muted mb-0">${result.fileName}</p>`;
    formattedAnalysis += `</div>`;
    formattedAnalysis += `</div>`;

    // Metadata grid
    let metadata: any = {};
    if (result.extractedMetadata) {
      try {
        metadata = JSON.parse(result.extractedMetadata);
      } catch {
        // Error handled silently
      }
    }

    formattedAnalysis += `<div class="row g-3 mt-2">`;

    // Document Type
    if (result.detectedType) {
      formattedAnalysis += `<div class="col-md-4">`;
      formattedAnalysis += `<div class="p-3 border rounded bg-light">`;
      formattedAnalysis += `<p class="text-muted mb-2 text-uppercase fs-6 fw-semibold" style="font-size: 0.75rem; letter-spacing: 0.5px;">Document Type</p>`;
      formattedAnalysis += `<span class="badge bg-primary-subtle text-primary fs-6 px-3 py-2">${result.detectedType}</span>`;
      formattedAnalysis += `</div>`;
      formattedAnalysis += `</div>`;
    }

    // Case Number
    if (metadata.caseNumber) {
      formattedAnalysis += `<div class="col-md-4">`;
      formattedAnalysis += `<div class="p-3 border rounded bg-light">`;
      formattedAnalysis += `<p class="text-muted mb-2 text-uppercase fs-6 fw-semibold" style="font-size: 0.75rem; letter-spacing: 0.5px;">Case Number</p>`;
      formattedAnalysis += `<p class="mb-0 fw-semibold">${metadata.caseNumber}</p>`;
      formattedAnalysis += `</div>`;
      formattedAnalysis += `</div>`;
    }

    // Date
    if (metadata.primaryDate) {
      formattedAnalysis += `<div class="col-md-4">`;
      formattedAnalysis += `<div class="p-3 border rounded bg-light">`;
      formattedAnalysis += `<p class="text-muted mb-2 text-uppercase fs-6 fw-semibold" style="font-size: 0.75rem; letter-spacing: 0.5px;">Date</p>`;
      formattedAnalysis += `<p class="mb-0 fw-semibold">${metadata.primaryDate}</p>`;
      formattedAnalysis += `</div>`;
      formattedAnalysis += `</div>`;
    }

    // Court (if available)
    if (metadata.court) {
      formattedAnalysis += `<div class="col-md-6">`;
      formattedAnalysis += `<div class="p-3 border rounded bg-light">`;
      formattedAnalysis += `<p class="text-muted mb-2 text-uppercase fs-6 fw-semibold" style="font-size: 0.75rem; letter-spacing: 0.5px;">Court</p>`;
      formattedAnalysis += `<p class="mb-0 fw-semibold">${metadata.court}</p>`;
      formattedAnalysis += `</div>`;
      formattedAnalysis += `</div>`;
    }

    // Parties (if available)
    if (metadata.partiesDisplay) {
      formattedAnalysis += `<div class="col-md-6">`;
      formattedAnalysis += `<div class="p-3 border rounded bg-light">`;
      formattedAnalysis += `<p class="text-muted mb-2 text-uppercase fs-6 fw-semibold" style="font-size: 0.75rem; letter-spacing: 0.5px;">Parties</p>`;
      formattedAnalysis += `<p class="mb-0 fw-semibold">${metadata.partiesDisplay}</p>`;
      formattedAnalysis += `</div>`;
      formattedAnalysis += `</div>`;
    }

    formattedAnalysis += `</div>`; // Close row
    formattedAnalysis += `</div>`; // Close card-body
    formattedAnalysis += `</div>`; // Close card

    // Parse sections BEFORE HTML formatting (parse from original markdown)
    const originalAnalysis = result.analysis?.fullAnalysis || result.analysis?.summary || '';
    const parsedSections = this.parseStrategicSections(originalAnalysis);

    // Add main strategic analysis with enhanced styling (RE-PROCESS CONTENT)
    if (result.analysis?.fullAnalysis) {
      // Process the analysis to add Velzon styling classes
      let processedAnalysis = this.enhanceAnalysisWithStyling(result.analysis.fullAnalysis);
      formattedAnalysis += processedAnalysis;
    } else if (result.analysis?.summary) {
      let processedSummary = this.enhanceAnalysisWithStyling(result.analysis.summary);
      formattedAnalysis += processedSummary;
    }
    // Always set true for document analysis - content was enhanced with HTML
    const hasStrategicAnalysis = true;

    // Add to local state
    // Store BOTH IDs: result.id (UUID string for API) and result.databaseId (number for action items)
    const assistantMessage = {
      role: 'assistant' as 'assistant',
      content: formattedAnalysis,
      timestamp: new Date(),
      hasStrategicAnalysis,
      parsedSections,
      analysisId: result.databaseId
    };
    this.stateService.addConversationMessage(assistantMessage);

    // Show chat panel to display the analysis tabs
    this.stateService.setShowChat(true);

    // Use setTimeout to ensure change detection runs after observable emits
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 0);

    // Persist to database and update conversation object
    const activeConvId = this.stateService.getActiveConversationId();
    if (activeConvId) {
      const conv = this.stateService.getConversations().find(c => c.id === activeConvId);
      if (conv && conv.backendConversationId) {
        // Persist assistant message to database with metadata
        // IMPORTANT: Save ORIGINAL MARKDOWN (not HTML) so tabs can parse sections on reload
        // Store result.id (UUID) for API calls, result.databaseId (number) for action items
        this.legalResearchService.addMessageToSession(
          conv.backendConversationId,
          this.currentUser.id,
          'assistant',
          originalAnalysis,  // ← Save markdown, not formattedAnalysis
          { analysisId: result.id, databaseId: result.databaseId }
        ).pipe(takeUntil(this.destroy$))
         .subscribe({
           next: (response) => {
             // Update conversation object in sidebar for message count badge
             conv.messages.push(assistantMessage);
             conv.messageCount = (conv.messageCount || 0) + 1;

             // Force change detection to update badge
             this.cdr.detectChanges();
           },
           error: () => {
             // Still update local state even if DB save fails
             conv.messages.push(assistantMessage);
             conv.messageCount = (conv.messageCount || 0) + 1;
             this.cdr.detectChanges();
           }
         });
      }
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get Velzon badge class for quality score grade
   */
  getQualityBadgeClass(grade: string): string {
    switch (grade) {
      case 'A': return 'bg-success-subtle text-success';
      case 'B': return 'bg-success-subtle text-success';
      case 'C': return 'bg-warning-subtle text-warning';
      case 'D': return 'bg-danger-subtle text-danger';
      case 'F': return 'bg-danger-subtle text-danger';
      default: return 'bg-secondary-subtle text-secondary';
    }
  }

  /**
   * Build tooltip text showing quality score dimension breakdown
   */
  getQualityTooltip(qualityScore: any): string {
    if (!qualityScore?.dimensions) return `Quality: ${qualityScore?.grade || '?'}`;
    const d = qualityScore.dimensions;
    return `Research Quality: ${qualityScore.grade} (${qualityScore.scoreOutOf10}/10)\n`
      + `Completeness: ${Math.round((d.completeness || 0) * 100)}%\n`
      + `Authority: ${Math.round((d.authority || 0) * 100)}%\n`
      + `Structure: ${Math.round((d.structure || 0) * 100)}%\n`
      + `Depth: ${Math.round((d.depth || 0) * 100)}%\n`
      + `Actionability: ${Math.round((d.actionability || 0) * 100)}%`;
  }

  /**
   * Get badge color class based on document type
   */
  getDocTypeColorClass(docType: string): string {
    if (!docType) return 'bg-secondary text-white';

    const type = docType.toLowerCase();

    // Pleadings - Red
    if (type.includes('complaint') || type.includes('answer') || type.includes('counterclaim') ||
        type.includes('petition') || type.includes('pleading')) {
      return 'bg-danger-subtle text-danger';
    }

    // Motions - Purple
    if (type.includes('motion') || type.includes('suppress') || type.includes('dismiss') ||
        type.includes('compel') || type.includes('protective')) {
      return 'bg-purple-subtle text-purple';
    }

    // Discovery - Teal/Cyan
    if (type.includes('discovery') || type.includes('interrogator') || type.includes('deposition') ||
        type.includes('subpoena') || type.includes('request for')) {
      return 'bg-info-subtle text-info';
    }

    // Court Orders - Yellow/Warning
    if (type.includes('order') || type.includes('judgment') || type.includes('decree') ||
        type.includes('injunction') || type.includes('ruling')) {
      return 'bg-warning-subtle text-warning';
    }

    // Contracts - Green
    if (type.includes('contract') || type.includes('agreement') || type.includes('lease') ||
        type.includes('nda') || type.includes('settlement')) {
      return 'bg-success-subtle text-success';
    }

    // Briefs/Appellate - Indigo
    if (type.includes('brief') || type.includes('appellate') || type.includes('appeal') ||
        type.includes('memo')) {
      return 'bg-indigo-subtle text-indigo';
    }

    // Correspondence - Orange
    if (type.includes('letter') || type.includes('correspondence') || type.includes('notice')) {
      return 'bg-orange-subtle text-orange';
    }

    // Default - Secondary
    return 'bg-secondary-subtle text-secondary';
  }

  /**
   * Auto-detect document type from filename or content
   */
  private detectDocumentType(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.includes('complaint')) return 'Complaint';
    if (lower.includes('answer')) return 'Answer';
    if (lower.includes('motion')) return 'Motion';
    if (lower.includes('contract')) return 'Contract';
    if (lower.includes('agreement')) return 'Agreement';
    if (lower.includes('brief')) return 'Legal Brief';
    if (lower.includes('memo')) return 'Memorandum';
    return 'Document';
  }

  /**
   * Check if file needs OCR (scanned PDF detection)
   */
  private needsOCR(file: File): boolean {
    // Simple heuristic: PDFs larger than 5MB might be scanned
    return file.type === 'application/pdf' && file.size > 5 * 1024 * 1024;
  }

  /**
   * Enhance strategic analysis markdown with Velzon styling
   * Uses the robust markdown-to-html pipe for conversion
   */
  private enhanceAnalysisWithStyling(markdown: string): string {
    // STEP 1: Process inline elements BEFORE converting markdown structure
    let content = markdown;

    // Process severity badges (before markdown conversion to avoid conflicts)
    content = content.replace(/🔴\s*CRITICAL/gi, '<span class="badge bg-danger fs-6 px-3 py-2 me-2"><i class="ri-alert-fill me-1"></i>CRITICAL</span>');
    content = content.replace(/🟡\s*HIGH/gi, '<span class="badge bg-warning text-dark fs-6 px-3 py-2 me-2"><i class="ri-error-warning-fill me-1"></i>HIGH</span>');
    content = content.replace(/🔵\s*MEDIUM/gi, '<span class="badge bg-info fs-6 px-3 py-2 me-2"><i class="ri-information-fill me-1"></i>MEDIUM</span>');
    content = content.replace(/🟢\s*LOW/gi, '<span class="badge bg-success fs-6 px-3 py-2 me-2"><i class="ri-checkbox-circle-fill me-1"></i>LOW</span>');

    // Fallback warning badge format
    content = content.replace(/⚠️\s*\[?(MAJOR|CRITICAL)\]?:/gi, '<span class="badge bg-danger fs-6 px-3 py-2 me-2"><i class="ri-alert-fill me-1"></i>CRITICAL</span>:');
    content = content.replace(/⚠️\s*\[?HIGH\]?:/gi, '<span class="badge bg-warning text-dark fs-6 px-3 py-2 me-2"><i class="ri-error-warning-fill me-1"></i>HIGH</span>:');
    content = content.replace(/⚠️\s*\[?MEDIUM\]?:/gi, '<span class="badge bg-info fs-6 px-3 py-2 me-2"><i class="ri-information-fill me-1"></i>MEDIUM</span>:');

    // Process financial amounts
    content = content.replace(/\$(\d+(?:,\d{3})*(?:\.\d+)?(?:M|K|B)?)\+?/gi, (match, amount) => {
      const value = parseFloat(amount.replace(/,/g, '').replace(/[MKB]/g, ''));
      const unit = amount.match(/[MKB]/)?.[0] || '';
      const numValue = unit === 'M' ? value : unit === 'K' ? value / 1000 : unit === 'B' ? value * 1000 : value;

      if (numValue >= 10) {
        return `<span class="badge bg-danger-subtle text-danger fs-6 fw-bold px-2 py-1">$${amount}+</span>`;
      } else if (numValue >= 1) {
        return `<span class="badge bg-warning-subtle text-warning fs-6 fw-semibold px-2 py-1">$${amount}</span>`;
      } else {
        return `<span class="text-primary fw-semibold">$${amount}</span>`;
      }
    });

    // STEP 2: Use the existing MarkdownConverterService for conversion
    // This handles tables, lists, headers, bold, italic, links, legal highlighting
    const htmlString = this.markdownConverter.convert(content);

    // STEP 3: Wrap everything in analysis container for styling
    const result = `<div class="ai-document-analysis">${htmlString}</div>`;

    return result;
  }

  /**
   * Parse strategic analysis into sections for tabbed display
   */
  private parseStrategicSections(markdown: string): any {
    const sections: any = {};

    // Check if this is strategic analysis (contains markers)
    if (!markdown.includes('EXECUTIVE') && !markdown.includes('CRITICAL') && !markdown.includes('STRATEGIC')) {
      return sections;
    }

    // Extract overview/executive section (includes the ## ⚡ EXECUTIVE section)
    // Using [\s\S] instead of . for browser compatibility (. doesn't match newlines without 's' flag)
    const overviewMatch = markdown.match(/##\s*⚡[\s\S]*?(?=\n##\s+[🎯⚡💰🚨📈⏱️🛡️📝💡]|$)/i);
    if (overviewMatch) {
      sections.overview = overviewMatch[0];
    } else {
      // Fallback: extract content up to first major section (or full content if no sections)
      const firstSectionMatch = markdown.match(/([\s\S]*?)(?=\n##\s+[🎯💰🚨📈⏱️🛡️📝💡]|$)/);
      sections.overview = firstSectionMatch ? firstSectionMatch[1] : markdown;
    }

    // Extract weaknesses/critical issues (more flexible patterns with lookahead)
    // Using [\s\S] instead of . for cross-line matching
    const weaknessPatterns = [
      /##\s*🎯[\s\S]*?(WEAKNESSES|ISSUES|ARGUMENTS)[\s\S]*?(?=\n##\s+[🎯⚡💰🚨📈⏱️🛡️📝💡]|$)/gi,
      /##\s*⭐[\s\S]*?CRITICAL[\s\S]*(WEAKNESSES|ISSUES)[\s\S]*?(?=\n##\s+[🎯⚡💰🚨📈⏱️🛡️📝💡]|$)/gi,
      /##\s*🚨[\s\S]*(PROBLEMATIC|UNFAVORABLE|OBJECTIONABLE)[\s\S]*?(?=\n##\s+[🎯⚡💰🚨📈⏱️🛡️📝💡]|$)/gi
    ];
    for (const pattern of weaknessPatterns) {
      const match = markdown.match(pattern);
      if (match) {
        sections.weaknesses = match[0];
        break;
      }
    }

    // Extract timeline (flexible for all document types)
    const timelineMatch = markdown.match(/##\s*⏱️[\s\S]*?(ACTION\s+)?TIMELINE[\s\S]*?(?=\n##\s+[🎯⚡💰🚨📈⏱️🛡️📝💡]|$)/gi);
    if (timelineMatch) {
      sections.timeline = timelineMatch[0];
    }

    // Extract evidence checklist (more flexible, with lookahead)
    const evidencePatterns = [
      /##\s*📝[\s\S]*?EVIDENCE[\s\S]*?(?=\n##\s+[🎯⚡💰🚨📈⏱️🛡️📝💡]|$)/gi,
      /##\s*☑[\s\S]*?(CHECKLIST|COMPLIANCE|EVIDENCE)[\s\S]*?(?=\n##\s+[🎯⚡💰🚨📈⏱️🛡️📝💡]|$)/gi,
      /##\s*✓[\s\S]*?(CHECKLIST|COMPLIANCE|EVIDENCE)[\s\S]*?(?=\n##\s+[🎯⚡💰🚨📈⏱️🛡️📝💡]|$)/gi
    ];
    for (const pattern of evidencePatterns) {
      const match = markdown.match(pattern);
      if (match && !match[0].includes('STRATEGY')) {  // Exclude strategy sections
        sections.evidence = match[0];
        break;
      }
    }

    // Extract strategy/recommendations (flexible with lookahead to avoid capturing next section)
    const strategyPatterns = [
      /##\s*💡[\s\S]*?(RECOMMENDATIONS|STRATEGY)[\s\S]*?(?=\n##\s+[🎯⚡💰🚨📈⏱️🛡️📝💡]|$)/gi,
      /##\s*📝[\s\S]*?STRATEGY[\s\S]*?(?=\n##\s+[🎯⚡💰🚨📈⏱️🛡️📝💡]|$)/gi
    ];
    for (const pattern of strategyPatterns) {
      const match = markdown.match(pattern);
      if (match) {
        sections.strategy = match[0];
        break;
      }
    }

    return sections;
  }

  /**
   * Export strategic analysis to PDF
   */
  exportAnalysisToPDF(message: any): void {
    this.notificationService.info('Export', 'Preparing PDF export...');
    // TODO: Implement PDF export with strategic analysis formatting
    // For now, show placeholder
    setTimeout(() => {
      this.notificationService.warning('Feature Being Finalized', 'PDF export with strategic formatting is being finalized');
    }, 500);
  }

  /**
   * Create a draft document from strategic analysis
   */
  createDraftFromAnalysis(message: any): void {
    this.notificationService.info('Draft', 'Creating draft from analysis...');
    // TODO: Extract key points and create a draft response
    setTimeout(() => {
      this.notificationService.warning('Feature Being Finalized', 'Automatic draft creation is being finalized');
    }, 500);
  }

  /**
   * Research citations mentioned in analysis
   */
  researchCitations(message: any): void {
    this.notificationService.info('Research', 'Analyzing citations...');
    // TODO: Extract case citations and launch research
    setTimeout(() => {
      this.notificationService.warning('Feature Being Finalized', 'Citation research integration is being finalized');
    }, 500);
  }

  /**
   * Schedule reminders based on timeline
   */
  scheduleReminders(message: any): void {
    this.notificationService.info('Reminders', 'Setting up timeline reminders...');
    // TODO: Extract dates from timeline and create calendar events
    setTimeout(() => {
      this.notificationService.warning('Feature Being Finalized', 'Automatic reminder scheduling is being finalized');
    }, 500);
  }

  // Protégé-style document type pills
  // Categorized document types with icons
  documentTypeCategories = [
    {
      id: 'pleadings',
      name: 'Pleadings',
      icon: '📋',
      expanded: true,
      types: [
        {
          id: 'complaint',
          name: 'Complaint',
          placeholderExample: 'Draft a complaint for breach of contract against ABC Corp for failing to deliver goods...'
        },
        {
          id: 'answer',
          name: 'Answer',
          placeholderExample: 'Draft an answer to the plaintiff\'s complaint denying liability and asserting affirmative defenses...'
        },
        {
          id: 'counterclaim',
          name: 'Counterclaim',
          placeholderExample: 'Draft a counterclaim alleging fraudulent misrepresentation by the plaintiff...'
        }
      ]
    },
    {
      id: 'motions',
      name: 'Motions',
      icon: '⚖️',
      expanded: true,
      types: [
        {
          id: 'motion-dismiss',
          name: 'Motion to Dismiss',
          placeholderExample: 'Draft a Motion to Dismiss the complaint for failure to state a claim under Rule 12(b)(6)...'
        },
        {
          id: 'motion-summary-judgment',
          name: 'Summary Judgment',
          placeholderExample: 'Draft a Motion for Summary Judgment arguing there are no genuine disputes of material fact...'
        },
        {
          id: 'motion-compel',
          name: 'Motion to Compel',
          placeholderExample: 'Draft a Motion to Compel discovery responses that were not provided within the deadline...'
        },
        {
          id: 'motion-suppress',
          name: 'Motion to Suppress',
          placeholderExample: 'Draft a Motion to Suppress evidence obtained during an unlawful search...'
        },
        {
          id: 'motion-protective-order',
          name: 'Protective Order',
          placeholderExample: 'Draft a Motion for Protective Order to prevent disclosure of confidential business information...'
        }
      ]
    },
    {
      id: 'discovery',
      name: 'Discovery',
      icon: '🔍',
      expanded: false,
      types: [
        {
          id: 'interrogatories',
          name: 'Interrogatories',
          placeholderExample: 'Draft interrogatories seeking information about the defendant\'s employment history and income...'
        },
        {
          id: 'rfp',
          name: 'Request for Production',
          placeholderExample: 'Draft requests for production seeking all contracts and correspondence related to the transaction...'
        },
        {
          id: 'rfa',
          name: 'Request for Admission',
          placeholderExample: 'Draft requests for admission regarding the authenticity of documents and basic facts of the case...'
        },
        {
          id: 'deposition-notice',
          name: 'Deposition Notice',
          placeholderExample: 'Draft a notice of deposition for the plaintiff\'s key witness scheduled for next month...'
        },
        {
          id: 'subpoena',
          name: 'Subpoena',
          placeholderExample: 'Draft a subpoena duces tecum for medical records from ABC Hospital...'
        }
      ]
    },
    {
      id: 'correspondence',
      name: 'Correspondence',
      icon: '📝',
      expanded: false,
      types: [
        {
          id: 'letter-of-representation',
          name: 'Letter of Representation',
          placeholderExample: 'Draft a letter of representation to the insurance company notifying them of our representation of the client...'
        },
        {
          id: 'demand-letter',
          name: 'Demand Letter',
          placeholderExample: 'Draft a demand letter seeking $50,000 in damages for personal injuries sustained in a car accident...'
        },
        {
          id: 'settlement-letter',
          name: 'Settlement Letter',
          placeholderExample: 'Draft a settlement proposal offering resolution of all claims for $75,000 with a 30-day response deadline...'
        },
        {
          id: 'settlement-offer',
          name: 'Settlement Offer',
          placeholderExample: 'Draft a settlement offer proposing resolution of all claims for $75,000...'
        },
        {
          id: 'opinion-letter',
          name: 'Opinion Letter',
          placeholderExample: 'Draft an opinion letter advising the client on the legal risks of their proposed business transaction...'
        },
        {
          id: 'client-email',
          name: 'Client Email',
          placeholderExample: 'Draft an email to the client explaining the discovery process and next steps in litigation...'
        },
        {
          id: 'opposing-counsel-letter',
          name: 'Letter to Counsel',
          placeholderExample: 'Draft a letter to opposing counsel proposing a schedule for completing discovery...'
        }
      ]
    },
    {
      id: 'contracts',
      name: 'Contracts',
      icon: '📄',
      expanded: false,
      types: [
        {
          id: 'contract-employment',
          name: 'Employment Agreement',
          placeholderExample: 'Draft an employment agreement for a senior executive with salary, benefits, and non-compete terms...'
        },
        {
          id: 'contract-nda',
          name: 'NDA',
          placeholderExample: 'Draft a mutual non-disclosure agreement for discussions about a potential merger...'
        },
        {
          id: 'contract-sale',
          name: 'Purchase Agreement',
          placeholderExample: 'Draft a purchase agreement for the sale of commercial property including inspection contingencies...'
        },
        {
          id: 'contract-service',
          name: 'Service Agreement',
          placeholderExample: 'Draft a consulting services agreement with payment terms and deliverable milestones...'
        },
        {
          id: 'amendment',
          name: 'Contract Amendment',
          placeholderExample: 'Draft an amendment to extend the contract term and modify the payment schedule...'
        },
        {
          id: 'clause',
          name: 'Contract Clause',
          placeholderExample: 'Draft an arbitration clause for a commercial services agreement...'
        }
      ]
    },
    {
      id: 'appellate',
      name: 'Appellate',
      icon: '🏛️',
      expanded: false,
      types: [
        {
          id: 'appellate-brief',
          name: 'Appellate Brief',
          placeholderExample: 'Draft an appellate brief arguing the trial court erred in granting summary judgment...'
        },
        {
          id: 'reply-brief',
          name: 'Reply Brief',
          placeholderExample: 'Draft a reply brief responding to appellee\'s arguments on the standard of review...'
        }
      ]
    },
    {
      id: 'other',
      name: 'Other',
      icon: '📑',
      expanded: false,
      types: [
        {
          id: 'legal-memo',
          name: 'Legal Memo',
          placeholderExample: 'Draft a legal memorandum analyzing the liability issues in a slip and fall case...'
        },
        {
          id: 'legal-argument',
          name: 'Legal Argument',
          placeholderExample: 'Draft a legal argument addressing the admissibility of hearsay evidence in this case...'
        },
        {
          id: 'affidavit',
          name: 'Affidavit',
          placeholderExample: 'Draft an affidavit for a witness describing what they observed at the accident scene...'
        },
        {
          id: 'settlement-agreement',
          name: 'Settlement Agreement',
          placeholderExample: 'Draft a settlement agreement resolving all claims with mutual releases and confidentiality terms...'
        },
        {
          id: 'stipulation',
          name: 'Stipulation',
          placeholderExample: 'Draft a stipulation agreeing to extend discovery deadlines by 60 days...'
        },
        {
          id: 'notice',
          name: 'Notice',
          placeholderExample: 'Draft a notice to the court requesting a continuance of the hearing date...'
        }
      ]
    }
  ];

  documentTypeSearchText: string = '';
  selectedDocTypePill: string | null = null;
  showDocTypeWarning: boolean = false;
  showDocTypeDropdown: boolean = false;

  selectDocTypePill(pillId: string): void {
    this.selectedDocTypePill = pillId;
    this.showDocTypeWarning = false; // Hide warning once type is selected
    this.showDocTypeDropdown = false; // Close dropdown after selection

  }

  toggleDocTypeDropdown(): void {
    this.showDocTypeDropdown = !this.showDocTypeDropdown;
  }

  get selectedDocTypeName(): string {
    if (!this.selectedDocTypePill) {
      return 'Select document type...';
    }

    for (const category of this.documentTypeCategories) {
      const selectedType = category.types.find(t => t.id === this.selectedDocTypePill);
      if (selectedType) {
        return selectedType.name;
      }
    }

    return 'Select document type...';
  }

  toggleCategory(categoryId: string): void {
    const category = this.documentTypeCategories.find(c => c.id === categoryId);
    if (category) {
      category.expanded = !category.expanded;
    }
  }

  /**
   * Get flat list of filtered document types (for search quick pills)
   */
  get filteredDocumentTypes() {
    if (!this.documentTypeSearchText.trim()) {
      return [];
    }

    const search = this.documentTypeSearchText.toLowerCase();
    const allTypes: any[] = [];

    this.documentTypeCategories.forEach(cat => {
      cat.types.forEach(type => {
        if (type.name.toLowerCase().includes(search) || type.id.toLowerCase().includes(search)) {
          allTypes.push(type);
        }
      });
    });

    return allTypes;
  }

  /**
   * Show warning when user focuses on prompt without selecting type
   */
  onPromptFocus(): void {
    if (!this.selectedDocTypePill && this.selectedTask === 'draft') {
      this.showDocTypeWarning = true;
    }
  }

  /**
   * Prompt Tips by Category
   */
  promptTipsByCategory = [
    {
      icon: '📋',
      name: 'Pleadings',
      tips: [
        'Draft a complaint for breach of contract involving a construction dispute. Include facts about delayed completion, cost overruns, and defective work.',
        'Prepare an answer to a negligence complaint, denying liability and asserting comparative negligence as an affirmative defense.',
        'Create a counterclaim for tortious interference with business relations based on defendant\'s actions in soliciting my clients.'
      ]
    },
    {
      icon: '⚖️',
      name: 'Motions',
      tips: [
        'Draft a motion to dismiss for lack of personal jurisdiction, arguing that the defendant has insufficient contacts with this state.',
        'Prepare a motion for summary judgment based on plaintiff\'s failure to establish a genuine issue of material fact regarding causation.',
        'Create a motion to compel discovery responses that are 45 days overdue, including interrogatories and document requests.'
      ]
    },
    {
      icon: '🔍',
      name: 'Discovery',
      tips: [
        'Draft 25 interrogatories for a personal injury case involving a car accident, focusing on liability, damages, and insurance coverage.',
        'Prepare requests for production of documents in an employment discrimination case, including personnel files, emails, and performance reviews.',
        'Create requests for admissions regarding the authenticity of key documents and basic facts in a contract dispute.'
      ]
    },
    {
      icon: '📝',
      name: 'Correspondence',
      tips: [
        'Draft a demand letter for unpaid invoices totaling $50,000, threatening litigation if payment is not received within 30 days.',
        'Prepare an engagement letter for representation in a commercial real estate transaction, including fee structure and scope of services.',
        'Create a settlement offer letter proposing $100,000 to resolve all claims in a business dispute, with detailed reasoning.'
      ]
    }
  ];

  /**
   * Open Prompt Tips Modal
   */
  showPromptTips(): void {
    this.modalService.open(this.promptTipsModal, {
      size: 'lg',
      backdrop: 'static',
      centered: true,
      windowClass: 'prompt-tips-modal'
    });
  }

  /**
   * Insert example prompt into textarea
   */
  usePromptExample(example: string): void {
    this.customPrompt = example;
    // Focus on the prompt textarea after inserting
    setTimeout(() => {
      const textarea = document.querySelector('.prompt-textarea') as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
      }
    }, 100);
  }

  /**
   * Smart auto-detection: Detect document type from prompt text
   * Used as fallback when user doesn't select a document type
   */
  private detectDocumentTypeFromPrompt(prompt: string): string {
    if (!prompt) {
      return 'general-draft';
    }

    const lower = prompt.toLowerCase();

    // Check for specific keywords and patterns
    // PLEADINGS
    if (lower.includes('complaint') || lower.includes('petition')) return 'complaint';
    if (lower.includes('answer to') || lower.includes('answer the')) return 'answer';
    if (lower.includes('counterclaim')) return 'counterclaim';

    // MOTIONS
    if (lower.includes('motion to dismiss')) return 'motion-dismiss';
    if (lower.includes('summary judgment')) return 'motion-summary-judgment';
    if (lower.includes('motion to compel')) return 'motion-compel';
    if (lower.includes('motion to suppress')) return 'motion-suppress';
    if (lower.includes('protective order')) return 'motion-protective-order';
    if (lower.includes('motion')) return 'motion-dismiss'; // Generic motion

    // DISCOVERY
    if (lower.includes('interrogator')) return 'interrogatories';
    if (lower.includes('request for production') || lower.includes('rfp')) return 'rfp';
    if (lower.includes('request for admission') || lower.includes('rfa')) return 'rfa';
    if (lower.includes('deposition notice')) return 'deposition-notice';
    if (lower.includes('subpoena')) return 'subpoena';

    // CORRESPONDENCE
    if (lower.includes('demand letter')) return 'demand-letter';
    if (lower.includes('settlement offer')) return 'settlement-offer';
    if (lower.includes('opinion letter')) return 'opinion-letter';
    if (lower.includes('email to client') || lower.includes('client email')) return 'client-email';
    if (lower.includes('letter to opposing counsel') || lower.includes('counsel letter')) return 'opposing-counsel-letter';

    // CONTRACTS
    if (lower.includes('employment agreement') || lower.includes('employment contract')) return 'contract-employment';
    if (lower.includes('nda') || lower.includes('non-disclosure')) return 'contract-nda';
    if (lower.includes('purchase agreement') || lower.includes('sale agreement')) return 'contract-sale';
    if (lower.includes('service agreement') || lower.includes('consulting agreement')) return 'contract-service';
    if (lower.includes('amendment')) return 'amendment';
    if (lower.includes('contract') || lower.includes('agreement')) return 'contract-service'; // Generic contract

    // APPELLATE
    if (lower.includes('appellate brief') || lower.includes('appeal')) return 'appellate-brief';
    if (lower.includes('reply brief')) return 'reply-brief';

    // OTHER
    if (lower.includes('legal memo') || lower.includes('memorandum')) return 'legal-memo';
    if (lower.includes('legal argument')) return 'legal-argument';
    if (lower.includes('affidavit') || lower.includes('declaration')) return 'affidavit';
    if (lower.includes('settlement agreement')) return 'settlement-agreement';
    if (lower.includes('stipulation')) return 'stipulation';
    if (lower.includes('notice')) return 'notice';

    // Default fallback
    return 'general-draft';
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
        // Find selected pill across all categories
        for (const category of this.documentTypeCategories) {
          const selectedPill = category.types.find(p => p.id === this.selectedDocTypePill);
          if (selectedPill) {
            return selectedPill.placeholderExample || 'Describe the document you want to draft...';
          }
        }
      }
      return 'Describe the document you want to draft...';
    }

    return 'Ask a legal question...';
  }

  // Check if Send button should be enabled
  get canSend(): boolean {
    const hasPromptText = this.customPrompt?.trim().length > 0;

    // For draft task, require document type selection
    if (this.selectedTask === 'draft') {
      return this.selectedDocTypePill !== null && hasPromptText;
    }

    // For other tasks, only check prompt text
    return hasPromptText;
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

  // Get human-readable label for analysis type
  private getAnalysisTypeLabel(analysisType: string): string {
    const typeMap: { [key: string]: string } = {
      'summarize': 'Summarize',
      'risk-assessment': 'Risk Assessment',
      'contract': 'Contract Analysis',
      'legal-brief': 'Legal Brief Review',
      'compliance': 'Compliance Check',
      'due-diligence': 'Due Diligence',
      'general': 'General Analysis'
    };
    return typeMap[analysisType] || analysisType;
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
      this.stateService.addConversationMessage({
        role: 'user',
        content: `I want to draft a ${type.name}`,
        timestamp: new Date()
      });

      // Show chat and start generating
      this.stateService.setShowChat(true);
      this.stateService.setShowBottomSearchBar(false);
    }
  }

  // Start custom draft with user's own prompt - REAL BACKEND CALL
  /**
   * Handle upload document analysis workflow
   */
  handleUploadAnalysis(): void {
    // Check if there are files ready to analyze
    const filesToAnalyze = this.uploadedFiles.filter(f => f.status === 'ready');

    if (filesToAnalyze.length === 0) {
      this.notificationService.warning('No Files', 'Please upload documents first');
      return;
    }

    // Create conversation title from filename and analysis type
    const firstFileName = filesToAnalyze[0].name;
    const analysisTypeLabel = this.getAnalysisTypeLabel(this.selectedAnalysisType);
    const title = `${firstFileName} - ${analysisTypeLabel}`;
    const userMessage = `Analyzing ${filesToAnalyze.length} document(s) using ${analysisTypeLabel} mode`;

    // Show chat panel for workflow progress
    this.stateService.setShowChat(true);
    this.stateService.setShowBottomSearchBar(false);
    this.stateService.setIsGenerating(true);

    // Initialize workflow steps
    this.initializeWorkflowSteps('upload');
    this.animateWorkflowSteps();

    // Add user message to local state
    this.stateService.addConversationMessage({
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    });

    // Handle collection selection
    if (this.selectedUploadCollectionId === 'new') {
      // Create new collection first
      const collectionName = this.newUploadCollectionName.trim() || this.getDefaultCollectionName();
      this.collectionService.createCollection(collectionName, `Upload collection - ${filesToAnalyze.length} document(s)`)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (collection) => {
            this.bulkUploadCollectionId = collection.id;
            this.proceedWithUploadAnalysis(title, userMessage);
          },
          error: (error) => {
            this.notificationService.error('Collection Error', 'Failed to create collection, uploading without collection');
            this.bulkUploadCollectionId = null;
            this.proceedWithUploadAnalysis(title, userMessage);
          }
        });
    } else if (typeof this.selectedUploadCollectionId === 'number') {
      // Use existing collection
      this.bulkUploadCollectionId = this.selectedUploadCollectionId;
      this.proceedWithUploadAnalysis(title, userMessage);
    } else {
      // No collection selected
      this.bulkUploadCollectionId = null;
      this.proceedWithUploadAnalysis(title, userMessage);
    }
  }

  /**
   * Continue with upload analysis after optional collection creation
   */
  private proceedWithUploadAnalysis(title: string, userMessage: string): void {
    // Create conversation in backend first
    this.legalResearchService.createGeneralConversation(title, 'ANALYZE_DOCUMENT')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          // Add to conversations list immediately (UI update)
          const newConv: Conversation = {
            id: `conv_${session.id}`,
            title: session.sessionName || title,
            date: new Date(session.createdAt || new Date()),
            type: 'upload' as ConversationType,
            messages: [...this.stateService.getConversationMessages()],
            messageCount: this.stateService.getConversationMessages().length,
            jurisdiction: session.jurisdiction,
            backendConversationId: session.id,
            researchMode: session.researchMode as ResearchMode || 'FAST' as ResearchMode,
            taskType: session.taskType as TaskType,
            documentId: session.documentId,
            relatedDraftId: session.relatedDraftId
          };

          this.stateService.addConversation(newConv);
          this.stateService.setActiveConversationId(newConv.id);

          // Persist user message FIRST, then start uploads (prevents deadlocks)
          this.legalResearchService.addMessageToSession(
            session.id,
            this.currentUser.id,
            'user',
            userMessage
          ).pipe(takeUntil(this.destroy$))
           .subscribe({
             next: () => {
               // Now proceed with document analysis AFTER user message is saved
               this.uploadFiles(session.id);
             },
             error: () => {
               // Still proceed with uploads even if message save failed
               this.uploadFiles(session.id);
             }
           });
        },
        error: (error) => {
          this.stateService.setIsGenerating(false);
          this.notificationService.error('Error', 'Failed to create conversation for document analysis');
        }
      });
  }

  /**
   * Enhance the current prompt using AI to add legal structure and detail
   */
  enhanceCurrentPrompt(): void {
    if (!this.customPrompt?.trim() || this.isEnhancingPrompt) return;

    this.isEnhancingPrompt = true;
    this.promptWasEnhanced = false;
    this.cdr.detectChanges();

    // Determine document type from selected pill
    let documentType: string | undefined;
    if (this.selectedDocTypePill) {
      documentType = this.selectedDocTypePill;
    }

    this.documentGenerationService.enhancePrompt({
      prompt: this.customPrompt.trim(),
      documentType: documentType,
      jurisdiction: this.selectedJurisdiction,
      caseId: this.selectedCaseId
    }).subscribe({
      next: (response) => {
        this.customPrompt = response.enhancedPrompt;
        this.promptWasEnhanced = true;
        this.isEnhancingPrompt = false;
        this.cdr.detectChanges();
      },
      error: () => {
        // Silently fail — original prompt preserved
        this.isEnhancingPrompt = false;
        this.cdr.detectChanges();
      }
    });
  }

  startCustomDraft(): void {
    // UPLOAD MODE: Use automated document analysis workflow
    if (this.selectedTask === 'upload') {
      this.handleUploadAnalysis();
      return;
    }

    // For other modes, prompt is required
    if (!this.customPrompt.trim()) return;

    const userPrompt = this.customPrompt;
    this.customPrompt = '';

    // CRITICAL: Clear old conversation messages if starting new draft
    // Each draft generation should be a fresh conversation
    if (!this.stateService.getActiveConversationId()) {
      this.stateService.clearConversationMessages();
      this.stateService.setActiveConversationId(null);
    }

    // Add user message
    this.stateService.addConversationMessage({
      role: 'user',
      content: userPrompt,
      timestamp: new Date()
    });

    // Show chat and start generating
    this.stateService.setShowChat(true);
    this.stateService.setShowBottomSearchBar(false);
    this.stateService.setIsGenerating(true);

    // Initialize workflow steps for the selected task
    if (this.selectedTask === 'question') {
      // Classify question type for context-appropriate workflow steps
      const hasHistory = this.stateService.getConversationMessages().length > 1;
      const questionType = this.classifyQuestion(userPrompt, hasHistory);
      this.initializeWorkflowSteps(questionType);
    } else {
      this.initializeWorkflowSteps(this.selectedTask);
    }

    // FORK: Different logic for 'draft' task vs other tasks
    if (this.selectedTask === 'draft') {
      // Draft: drive steps from real SSE events, not timer animation
      this.stateService.updateWorkflowStep(1, { status: 'active' as any });
      this.generateDocumentFlow(userPrompt);
    } else {
      // Q&A: SSE progress will be connected once session ID is available in generateConversationFlow
      this.generateConversationFlow(userPrompt);
    }
  }

  // Document generation flow for 'draft' task
  private generateDocumentFlow(userPrompt: string): void {
    // Determine document type: use selected pill OR auto-detect from prompt
    let documentType: string;
    if (this.selectedDocTypePill) {
      documentType = this.selectedDocTypePill;
    } else {
      documentType = this.detectDocumentTypeFromPrompt(userPrompt);
    }

    // Build case-aware title: "Demand Letter - Marsel Hoxha vs Hanover Insurance"
    let title: string;
    if (this.selectedCaseId && documentType) {
      const selectedCase = this.userCases.find((c: any) => c.id === this.selectedCaseId);
      const caseName = selectedCase?.title || selectedCase?.caseNumber || '';
      const docTypeName = documentType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      title = caseName ? `${docTypeName} - ${caseName}` : docTypeName;
    } else {
      title = userPrompt.substring(0, 50) + (userPrompt.length > 50 ? '...' : '');
    }

    // Create temporary conversation immediately so stop button can find it
    const tempConvId = `conv_temp_${Date.now()}`;
    const tempConv: Conversation = {
      id: tempConvId,
      title: title,
      date: new Date(),
      type: 'draft' as ConversationType,
      messages: [...this.stateService.getConversationMessages()],
      backendConversationId: undefined, // Will be set when response arrives
      relatedDraftId: undefined,
      taskType: TaskType.GenerateDraft,
      jurisdiction: this.selectedJurisdiction,
      researchMode: this.selectedResearchMode,
      documentType: documentType
    };

    // Add temp conversation and set as active BEFORE making request
    this.stateService.addConversation(tempConv);
    this.stateService.setActiveConversationId(tempConvId);

    // Prepare draft generation request
    const draftRequest: any = {
      userId: this.currentUser.id,
      caseId: this.selectedCaseId,
      prompt: userPrompt,
      documentType: documentType,
      jurisdiction: this.selectedJurisdiction,
      sessionName: title,
      researchMode: this.selectedResearchMode  // Pass selected research mode (FAST or THOROUGH)
    };

    // Include documentId when available so backend can inject attached exhibits
    if (this.currentDocumentId && typeof this.currentDocumentId === 'number') {
      draftRequest.documentId = this.currentDocumentId;
    }

    // Include stationery IDs for first-generation awareness
    if (this.stationeryInserted && this.activeStationeryTemplateId) {
      draftRequest.stationeryTemplateId = this.activeStationeryTemplateId;
      draftRequest.stationeryAttorneyId = this.activeStationeryAttorneyId;
    }

    // First, initialize the conversation to get backend ID immediately
    this.documentGenerationService.initDraftConversation(draftRequest)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (initResponse) => {
          const backendConversationId = initResponse.conversationId;

          // Update temp conversation with real backend ID
          const tempConvInList = this.stateService.getConversations().find(c => c.id === tempConvId);
          if (tempConvInList) {
            tempConvInList.backendConversationId = backendConversationId;
          }

          // Register background task for draft generation
          const taskId = this.backgroundTaskService.registerTask(
            'draft',
            title,
            `Drafting: ${documentType}`,
            { conversationId: tempConvId, backendConversationId: backendConversationId }
          );
          this.backgroundTaskService.startTask(taskId);

          // === STREAMING FLOW ===
          // Stay in conversation view — user sees workflow steps during generation.
          // Editor will open only when the document is fully ready (on 'complete' event).
          this.streamWordCount = 0;
          this.draftStreamCompleted = false;

          // Open SSE connection BEFORE triggering generation
          this.closeDraftStream();
          const eventSource = this.documentGenerationService.openDraftStream(backendConversationId);
          this.draftEventSource = eventSource;

          // Handle token events — count words and update workflow step
          eventSource.addEventListener('token', (event: MessageEvent) => {
            try {
              const data = JSON.parse(event.data);
              if (data.text) {
                // First token: mark step 1 complete, step 2 active
                if (this.streamWordCount === 0) {
                  this.stateService.updateWorkflowStep(1, { status: 'completed' as any });
                  this.stateService.updateWorkflowStep(2, { status: 'active' as any });
                }
                // Count words from token
                const words = data.text.split(/\s+/).filter((w: string) => w.length > 0).length;
                this.streamWordCount += words;
                // Update step 2 description with live word count (throttle to every ~20 words)
                if (this.streamWordCount < 10 || this.streamWordCount % 20 < words) {
                  this.stateService.updateWorkflowStep(2, {
                    description: `Writing document... (~${this.streamWordCount} words)`
                  });
                  this.cdr.detectChanges();
                }
              }
            } catch (e) {
              // Ignore parse errors on malformed events
            }
          });

          // Handle post-processing status updates — transition to step 3
          eventSource.addEventListener('post_processing', (event: MessageEvent) => {
            try {
              const data = JSON.parse(event.data);
              this.stateService.updateWorkflowStep(2, { status: 'completed' as any });
              this.stateService.updateWorkflowStep(3, { status: 'active' as any, description: data.message });
              this.cdr.detectChanges();
            } catch (e) {
              // Ignore
            }
          });

          // Handle complete event — enter drafting mode with final content
          eventSource.addEventListener('complete', (event: MessageEvent) => {
            try {
              this.draftStreamCompleted = true;
              const data = JSON.parse(event.data);
              this.closeDraftStream();

              // Complete background task
              this.backgroundTaskService.completeTask(taskId, data);
              this.completeAllWorkflowSteps();

              // Update conversation
              const conversations = this.stateService.getConversations();
              const tempConvIndex = conversations.findIndex(c => c.id === tempConvId);
              if (tempConvIndex !== -1) {
                conversations[tempConvIndex] = {
                  ...conversations[tempConvIndex],
                  id: `conv_${backendConversationId}`,
                  title: title,
                  backendConversationId: backendConversationId,
                  relatedDraftId: data.documentId?.toString(),
                  taskType: TaskType.GenerateDraft
                };
                this.stateService.setActiveConversationId(`conv_${backendConversationId}`);
              }

              this.loadConversations();

              // Store document metadata
              this.currentDocumentId = data.documentId;
              this.currentVersionNumber = data.version || 1;
              this.activeDocumentTitle = title || this.extractTitleFromMarkdown(data.content) || 'Untitled Document';
              this.currentDocumentWordCount = data.wordCount || 0;
              this.currentDocumentPageCount = this.documentGenerationService.estimatePageCount(data.wordCount || 0);
              this.documentMetadata = {
                tokensUsed: data.tokensUsed,
                costEstimate: data.costEstimate,
                generatedAt: new Date(),
                version: data.version || 1
              };

              this.loadVersionHistory();

              // Poll for exhibits — async attach may still be in progress
              if (data.documentId) {
                this.exhibitPanelService.setExhibitsLoading(true);
                this.pollForExhibits(data.documentId);
              }

              // Add assistant message
              this.stateService.addConversationMessage({
                role: 'assistant',
                content: `I've generated your ${this.selectedDocTypePill || 'document'}${this.selectedCaseId ? ' for the selected case' : ''}. You can view it in the document preview panel.`,
                timestamp: new Date()
              });

              this.stateService.setIsGenerating(false);

              // Clear completed background tasks so the spinner stops
              this.backgroundTaskService.clearCompletedTasks();

              // Store pending content — will be loaded into CKEditor in onEditorCreated()
              this.pendingDraftContent = data.content;

              // NOW enter drafting mode — editor will render the final document
              this.editorInstance = null;
              this.stateService.setDraftingMode(true);
              this.stateService.setShowChat(false); // Chat hidden in drafting mode
              this.showEditor = true;
              this.setModeForDrafting();
              this.cdr.detectChanges();
            } catch {
              // Error handled silently
            }
          });

          // Handle error events — only process if event.data exists (backend error).
          // Connection drops fire this event with no data; let onerror handle those.
          eventSource.addEventListener('error', (event: MessageEvent) => {
            try {
              if (!event.data) {
                // Connection drop — not a backend error. Let onerror polling fallback handle it.
                return;
              }

              let errorMsg = 'Failed to generate document';
              const data = JSON.parse(event.data);
              errorMsg = data.message || errorMsg;

              this.closeDraftStream();
              this.backgroundTaskService.failTask(taskId, errorMsg);

              // Remove temp conversation
              const conversations = this.stateService.getConversations();
              const tempIndex = conversations.findIndex(c => c.id === tempConvId);
              if (tempIndex !== -1) {
                conversations.splice(tempIndex, 1);
              }

              // Mark workflow as error
              const steps = this.stateService.getWorkflowSteps();
              if (steps.length > 0) {
                this.stateService.updateWorkflowStep(steps[steps.length - 1].id, { status: 'error' as any });
              }

              // Medical data prerequisite — show modal, clean up conversation completely
              const isRecordsErr = errorMsg.includes('Medical records must be scanned');
              const isSummaryErr = errorMsg.includes('medical summary must be generated');
              if (isRecordsErr || isSummaryErr) {
                // Delete the backend conversation since nothing was generated
                this.legalResearchService.deleteConversationById(backendConversationId)
                  .pipe(takeUntil(this.destroy$))
                  .subscribe({ error: () => { /* Error handled silently */ } });

                // Clear chat state so the user prompt doesn't linger
                this.stateService.clearConversationMessages();
                this.stateService.resetWorkflowSteps();
                this.stateService.setShowChat(false);

                import('sweetalert2').then(Swal => {
                  Swal.default.fire({
                    icon: 'warning',
                    title: isRecordsErr ? 'Medical Records Required' : 'Medical Summary Required',
                    html: isRecordsErr
                      ? 'You need to scan your medical documents before generating a demand letter.<br><br>Go to the <strong>Medical Records</strong> tab and click <strong>"Scan Case Documents"</strong> to extract medical data from your uploaded files.'
                      : 'You need to generate a medical summary before creating a demand letter.<br><br>Go to the <strong>Medical Summary</strong> tab and click <strong>"Generate Summary"</strong> to create a consolidated medical narrative.',
                    confirmButtonText: isRecordsErr
                      ? '<i class="ri-hospital-line me-1"></i> Go to Medical Records'
                      : '<i class="ri-file-list-3-line me-1"></i> Go to Medical Summary',
                    showCancelButton: true,
                    cancelButtonText: 'Cancel',
                    customClass: { confirmButton: 'btn btn-primary', cancelButton: 'btn btn-light' }
                  }).then((result) => {
                    if (result.isConfirmed) {
                      this.router.navigate(['/legal/ai-assistant/legipi'], {
                        queryParams: { caseId: this.selectedCaseId, tab: 'medical', subtab: isRecordsErr ? 'records' : 'summary' }
                      });
                    }
                  });
                });
              } else {
                this.stateService.addConversationMessage({
                  role: 'assistant',
                  content: `Sorry, I encountered an error generating the document: ${errorMsg}`,
                  timestamp: new Date()
                });
              }

              this.stateService.setIsGenerating(false);
              this.stateService.setShowBottomSearchBar(true);
              this.stateService.setActiveConversationId(null);
              this.cdr.detectChanges();
            } catch {
              // Error handled silently
            }
          });

          // Handle SSE connection errors — close immediately to prevent auto-reconnect.
          // Draft streaming is one-shot; reconnection would create a duplicate emitter.
          eventSource.onerror = () => {
            if (this.draftEventSource === eventSource) {
              // Capture state before closeDraftStream() resets streamWordCount
              const hadTokens = this.streamWordCount > 0;
              const wasCompleted = this.draftStreamCompleted;
              this.closeDraftStream();

              // If complete was already received, this is just normal SSE close — ignore
              if (wasCompleted) return;

              // Poll for the finished document regardless of whether tokens arrived.
              // If the ALB dropped the SSE connection during "Analyzing" (before any tokens),
              // the backend async task may still complete — polling will catch it.
              this.pollForCompletedDraft(backendConversationId, taskId, tempConvId, title, documentType);
            }
          };

          // 3. Trigger streaming generation
          const streamingRequest = {
            ...draftRequest,
            conversationId: backendConversationId
          };

          this.documentGenerationService.triggerStreamingGeneration(streamingRequest)
            .pipe(takeUntil(this.cancelGeneration$))
            .subscribe({
              error: (error: any) => {
                this.closeDraftStream();
                this.backgroundTaskService.failTask(taskId, error.message || 'Failed to start generation');

                // Medical data prerequisite — show modal, clean up completely
                const errorCode = error.error?.error;
                if (errorCode === 'MEDICAL_RECORDS_REQUIRED' || errorCode === 'MEDICAL_SUMMARY_REQUIRED') {
                  const isRecords = errorCode === 'MEDICAL_RECORDS_REQUIRED';

                  // Delete the backend conversation since nothing was generated
                  this.legalResearchService.deleteConversationById(backendConversationId)
                    .pipe(takeUntil(this.destroy$))
                    .subscribe({ error: () => { /* Error handled silently */ } });

                  // Remove temp conversation from sidebar
                  const conversations = this.stateService.getConversations();
                  const idx = conversations.findIndex(c => c.id === tempConvId);
                  if (idx !== -1) conversations.splice(idx, 1);

                  // Clear chat state
                  this.stateService.clearConversationMessages();
                  this.stateService.resetWorkflowSteps();
                  this.stateService.setShowChat(false);
                  this.stateService.setActiveConversationId(null);

                  import('sweetalert2').then(Swal => {
                    Swal.default.fire({
                      icon: 'warning',
                      title: isRecords ? 'Medical Records Required' : 'Medical Summary Required',
                      html: isRecords
                        ? 'You need to scan your medical documents before generating a demand letter.<br><br>Go to the <strong>Medical Records</strong> tab and click <strong>"Scan Case Documents"</strong> to extract medical data from your uploaded files.'
                        : 'You need to generate a medical summary before creating a demand letter.<br><br>Go to the <strong>Medical Summary</strong> tab and click <strong>"Generate Summary"</strong> to create a consolidated medical narrative.',
                      confirmButtonText: isRecords
                        ? '<i class="ri-hospital-line me-1"></i> Go to Medical Records'
                        : '<i class="ri-file-list-3-line me-1"></i> Go to Medical Summary',
                      showCancelButton: true,
                      cancelButtonText: 'Cancel',
                      customClass: { confirmButton: 'btn btn-primary', cancelButton: 'btn btn-light' }
                    }).then((result) => {
                      if (result.isConfirmed) {
                        this.router.navigate(['/legal/ai-assistant/legipi'], {
                          queryParams: { caseId: this.selectedCaseId, tab: 'medical', subtab: isRecords ? 'records' : 'summary' }
                        });
                      }
                    });
                  });
                } else {
                  this.stateService.addConversationMessage({
                    role: 'assistant',
                    content: 'Sorry, I encountered an error starting the draft generation. Please try again.',
                    timestamp: new Date()
                  });
                }

                this.stateService.setIsGenerating(false);
                this.stateService.setShowBottomSearchBar(true);
                this.cdr.detectChanges();
              }
            });
        },
        error: (error) => {
          // Remove temp conversation
          const conversations = this.stateService.getConversations();
          const tempIndex = conversations.findIndex(c => c.id === tempConvId);
          if (tempIndex !== -1) {
            conversations.splice(tempIndex, 1);
          }

          this.stateService.addConversationMessage({
            role: 'assistant',
            content: 'Sorry, I encountered an error starting the draft generation. Please try again.',
            timestamp: new Date()
          });

          this.stateService.setIsGenerating(false);
          this.stateService.setShowBottomSearchBar(true);
          this.stateService.setActiveConversationId(null);
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Close the draft streaming SSE connection if open.
   */
  private closeDraftStream(): void {
    if (this.draftEventSource) {
      this.draftEventSource.close();
      this.draftEventSource = null;
    }
    if (this.draftPollInterval) {
      clearInterval(this.draftPollInterval);
      this.draftPollInterval = null;
    }
    this.streamWordCount = 0;
  }

  /**
   * Poll for a completed draft when SSE drops mid-stream but backend may still complete.
   * Polls every 2s for up to 30s.
   */
  private pollForCompletedDraft(
    conversationId: number, taskId: string, tempConvId: string, title: string, documentType: string
  ): void {
    this.stateService.updateWorkflowStep(2, {
      description: 'Connection interrupted — checking for completed document...'
    });
    this.cdr.detectChanges();

    let attempts = 0;
    const maxAttempts = 15; // 15 * 2s = 30s

    // Clear any previous poll
    if (this.draftPollInterval) {
      clearInterval(this.draftPollInterval);
    }

    this.draftPollInterval = setInterval(() => {
      attempts++;
      this.documentGenerationService.getDraftByConversation(conversationId).subscribe({
        next: (data: any) => {
          if (this.draftPollInterval) {
            clearInterval(this.draftPollInterval);
            this.draftPollInterval = null;
          }

          // Simulate the 'complete' event handling
          this.draftStreamCompleted = true;
          this.backgroundTaskService.completeTask(taskId, data);
          this.completeAllWorkflowSteps();

          const conversations = this.stateService.getConversations();
          const tempConvIndex = conversations.findIndex(c => c.id === tempConvId);
          if (tempConvIndex !== -1) {
            conversations[tempConvIndex] = {
              ...conversations[tempConvIndex],
              id: `conv_${conversationId}`,
              title: title,
              backendConversationId: conversationId,
              relatedDraftId: data.documentId?.toString(),
              taskType: TaskType.GenerateDraft
            };
            this.stateService.setActiveConversationId(`conv_${conversationId}`);
          }

          this.loadConversations();
          this.currentDocumentId = data.documentId;
          this.activeDocumentTitle = title || this.extractTitleFromMarkdown(data.content) || 'Untitled Document';
          this.currentDocumentWordCount = data.wordCount || 0;
          this.currentDocumentPageCount = this.documentGenerationService.estimatePageCount(data.wordCount || 0);
          this.documentMetadata = {
            tokensUsed: data.tokensUsed,
            costEstimate: data.costEstimate,
            generatedAt: new Date(),
            version: data.version || 1
          };

          this.loadVersionHistory();

          if (data.documentId) {
            this.exhibitPanelService.setExhibitsLoading(true);
            this.pollForExhibits(data.documentId);
          }

          this.stateService.addConversationMessage({
            role: 'assistant',
            content: `I've generated your ${this.selectedDocTypePill || 'document'}${this.selectedCaseId ? ' for the selected case' : ''}. You can view it in the document preview panel.`,
            timestamp: new Date()
          });

          this.stateService.setIsGenerating(false);
          this.pendingDraftContent = data.content;
          this.editorInstance = null;
          this.stateService.setDraftingMode(true);
          this.stateService.setShowChat(false);
          this.showEditor = true;
          this.setModeForDrafting();
          this.cdr.detectChanges();
        },
        error: () => {
          if (attempts >= maxAttempts) {
            if (this.draftPollInterval) {
              clearInterval(this.draftPollInterval);
              this.draftPollInterval = null;
            }
            // Polling exhausted — show a gentle error
            this.stateService.addConversationMessage({
              role: 'assistant',
              content: 'The document generation is still in progress. Please check your documents list in a moment.',
              timestamp: new Date()
            });
            this.stateService.setIsGenerating(false);
            this.stateService.setShowBottomSearchBar(true);
            this.cdr.detectChanges();
          }
        }
      });
    }, 2000);
  }

  // EXISTING METHOD: Conversation flow for Q&A tasks (extracted from startCustomDraft)
  private generateConversationFlow(userPrompt: string): void {
    // Map frontend task to backend taskType
    const taskTypeMap: { [key: string]: string } = {
      'question': 'LEGAL_QUESTION',
      'draft': 'GENERATE_DRAFT',
      'summarize': 'SUMMARIZE_CASE',
      'upload': 'ANALYZE_DOCUMENT'
    };

    const taskType = taskTypeMap[this.selectedTask];
    const title = userPrompt.substring(0, 50) + (userPrompt.length > 50 ? '...' : '');
    const researchMode = this.selectedResearchMode; // Use selected mode from UI

    // Create conversation with jurisdiction for state-specific research
    this.legalResearchService.createGeneralConversation(title, taskType, undefined, this.selectedJurisdiction)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          // Add to conversations list
          const newConv: Conversation = {
            id: `conv_${session.id}`,
            title: session.sessionName || title,
            date: new Date(session.createdAt || new Date()),
            type: this.selectedTask,
            messages: [...this.stateService.getConversationMessages()],
            messageCount: this.stateService.getConversationMessages().length,
            jurisdiction: session.jurisdiction,
            backendConversationId: session.id,
            researchMode: session.researchMode as ResearchMode || 'FAST' as ResearchMode,
            taskType: session.taskType as TaskType,
            documentId: session.documentId,
            relatedDraftId: session.relatedDraftId
          };

          this.stateService.addConversation(newConv);
          this.stateService.setActiveConversationId(newConv.id);

          // CRITICAL: Trigger change detection so sidebar updates with new conversation
          this.cdr.detectChanges();

          // Send message to get AI response
          if (session.id) {
            // Capture conversation ID at request time to prevent race condition
            const requestConversationId = newConv.id;
            const requestBackendId = session.id;

            // Register background task (continues even if user navigates away)
            const taskId = this.backgroundTaskService.registerTask(
              'question',
              title,
              `Legal research: ${userPrompt.substring(0, 50)}...`,
              { conversationId: requestConversationId, backendConversationId: requestBackendId, researchMode: researchMode as 'FAST' | 'THOROUGH' }
            );
            this.backgroundTaskService.startTask(taskId);

            // Connect SSE for real-time workflow progress using the session ID
            this.connectWorkflowSSE(requestBackendId);

            // Subscribe WITHOUT takeUntil(destroy$) so it continues in background
            // Only cancel on explicit user cancellation
            const subscription = this.legalResearchService.sendMessageToConversation(requestBackendId, userPrompt, this.selectedJurisdiction)
              .pipe(takeUntil(this.cancelGeneration$))
              .subscribe({
                next: (message) => {
                  // Complete the background task with result
                  this.backgroundTaskService.completeTask(taskId, message);

                  // Only update UI if THIS conversation is still active (prevents race condition)
                  if (this.stateService.getActiveConversationId() === requestConversationId) {
                    // Complete all workflow steps
                    this.completeAllWorkflowSteps();

                    // Detect error responses from backend (modelUsed === "error")
                    const isErrorResponse = message.modelUsed === 'error';

                    if (isErrorResponse) {
                      this.stateService.addConversationMessage({
                        role: 'assistant',
                        content: message.content,
                        isError: true,
                        retryMessage: userPrompt
                      } as any);
                      this.stateService.setIsGenerating(false);
                      this.stateService.setShowBottomSearchBar(true);
                      this.cdr.detectChanges();
                      return;
                    }

                    // Extract follow-up questions and remove section from content
                    const cleanedContent = this.extractAndRemoveFollowUpQuestions(message.content);

                    // Add assistant message to chat view
                    const assistantMessage: any = {
                      role: 'assistant' as 'assistant',
                      content: cleanedContent,
                      timestamp: new Date(message.createdAt || new Date()),
                      id: message.id,
                      bookmarked: message.bookmarked || false
                    };
                    this.stateService.addConversationMessage(assistantMessage);

                    // ALSO update the conversation object in sidebar for message count badge
                    const conv = this.stateService.getConversations().find(c => c.id === requestConversationId);
                    if (conv) {
                      conv.messages.push(assistantMessage);
                      conv.messageCount = (conv.messageCount || 0) + 1;
                      // Force change detection to update badge
                      this.cdr.detectChanges();
                    }

                    this.stateService.setIsGenerating(false);
                    this.stateService.setShowBottomSearchBar(true);
                    this.cdr.detectChanges();
                  } else {
                    this.stateService.setIsGenerating(false);
                  }
                },
                error: (error) => {
                  // Extract the actual error message from backend response
                  const backendMessage = error?.error?.message || error?.message || '';
                  const displayMessage = backendMessage
                    ? backendMessage
                    : 'Sorry, I encountered an error processing your request. Please try again.';

                  // Fail the background task
                  this.backgroundTaskService.failTask(taskId, backendMessage || 'Failed to get AI response');

                  // Mark workflow as error
                  if (this.stateService.getWorkflowSteps().length > 0) {
                    const steps = this.stateService.getWorkflowSteps(); if (steps.length > 0) this.stateService.updateWorkflowStep(steps[steps.length - 1].id, { status: 'error' as any });
                  }

                  this.stateService.addConversationMessage({
                    role: 'assistant',
                    content: displayMessage,
                    isError: true,
                    retryMessage: userPrompt
                  } as any);
                  this.stateService.setIsGenerating(false);
                  this.stateService.setShowBottomSearchBar(true);
                  this.cdr.detectChanges();
                }
              });

            // Store subscription for cleanup
            this.backgroundTaskService.storeSubscription(taskId, subscription);
          }
        },
        error: (error) => {
          this.stateService.addConversationMessage({
            role: 'assistant',
            content: 'Sorry, I encountered an error creating the conversation. Please try again.'
          });
          this.stateService.setIsGenerating(false);
          this.stateService.setShowBottomSearchBar(true);
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

  // Tool button labels map to backend transformation types
  private readonly toolPromptMap: Record<string, { type: string; prompt?: string }> = {
    polish:     { type: 'SIMPLIFY' },
    condense:   { type: 'CONDENSE' },
    advocate:   { type: 'CUSTOM', prompt: 'Rewrite this text to more strongly advocate for the client\'s legal position. Make the arguments more persuasive, assertive, and favorable while maintaining accuracy and professionalism.' },
    elaborate:  { type: 'EXPAND' },
    strengthen: { type: 'CUSTOM', prompt: 'Strengthen the legal arguments by adding more authoritative case citations from the relevant jurisdiction, tightening the legal reasoning, and making each argument more persuasive. Replace weak or general citations with controlling authority (state supreme court, courts of appeals). Do not change the document structure or remove existing content.' },
    counter:    { type: 'CUSTOM', prompt: 'Identify the 2-3 strongest arguments the opposing party would make against each major point in this document. Add a brief, targeted rebuttal or preemptive response to each anticipated counter-argument, integrated naturally into the existing text after the relevant argument. Do not restructure the document or remove existing content.' },
    redraft:    { type: 'REDRAFT' },
  };

  // ── Floating toolbar: state transition methods ──

  enterPromptEditing(): void {
    // Clear any stale prompt text from previous interactions
    this.floatingPromptText = '';
    // Apply yellowMarker to persist highlight when focus moves to input
    this.highlightSelection();
    this.floatingToolbarState = 'prompt_editing';
    this.cdr.detectChanges();
    setTimeout(() => {
      const input = document.querySelector('.floating-prompt-input') as HTMLInputElement;
      input?.focus();
    }, 0);
  }

  cancelPromptEditing(): void {
    this.floatingPromptText = '';
    this.floatingToolbarState = 'quick_actions';
    // Restore native selection — remove yellowMarker, refocus editor
    this.restoreNativeSelection();
    this.cdr.detectChanges();
  }

  cancelFloatingGeneration(): void {
    this.cancelGeneration$.next();
    this.floatingToolbarState = 'quick_actions';
    // Restore native selection
    this.restoreNativeSelection();
    this.cdr.detectChanges();
  }

  discardPreview(): void {
    this.aiPreviewResponse = '';
    this.aiPreviewToolType = '';
    this.floatingToolbarState = 'quick_actions';
    // Restore native selection
    this.restoreNativeSelection();
    this.cdr.detectChanges();
  }

  refinePrompt(): void {
    this.floatingPromptText = this.lastPromptText;
    this.floatingToolbarState = 'prompt_editing';
    this.cdr.detectChanges();
    setTimeout(() => {
      const input = document.querySelector('.floating-prompt-input') as HTMLInputElement;
      input?.focus();
    }, 0);
  }

  // ── Floating toolbar: submit methods ──

  submitFloatingPrompt(): void {
    if (this.floatingToolbarState === 'loading') return; // Prevent double-submit
    const prompt = this.floatingPromptText?.trim();
    if (!prompt || !this.selectedText || !this.selectionRange || !this.editorInstance) return;

    // Guard: reject prompts asking for fabricated/fake/sample data
    if (this.isFabricationRequest(prompt)) {
      // Keep toolbar in 'loading' state to prevent selection-change listeners from
      // clearing it before the SweetAlert async import resolves
      this.floatingToolbarState = 'loading';
      this.cdr.detectChanges();
      this.showAiNoteModal(
        'This document contains placeholder fields that need to be filled with **real case data**.\n\n' +
        'The AI cannot generate fake, sample, or made-up data for legal documents — this would compromise document integrity.\n\n' +
        'To fill in the placeholders:\n' +
        '- Edit the fields directly with actual case information\n' +
        '- Or link this document to a case with the relevant data and ask the AI to "use case data"'
      );
      return;
    }

    this.lastPromptText = prompt;
    this.floatingToolbarState = 'loading';
    this.cdr.detectChanges();

    this.bookmarkSelectionForTransform();

    const editor = this.editorInstance;
    const fullPlainText = this.ckEditorService.getPlainText(editor);

    const request: any = {
      documentId: this.currentDocumentId as number,
      transformationType: 'CUSTOM',
      transformationScope: 'SELECTION' as const,
      fullDocumentContent: fullPlainText,
      selectedText: this.selectedText,
      selectionStartIndex: this.selectionRange.index,
      selectionEndIndex: this.selectionRange.index + this.selectionRange.length,
      jurisdiction: this.selectedJurisdiction,
      documentType: this.selectedDocTypePill,
      customPrompt: prompt
    };

    this.documentGenerationService.transformDocument(request, this.currentUser?.id)
      .pipe(
        takeUntil(merge(this.destroy$, this.cancelGeneration$)),
        finalize(() => this.cdr.detectChanges())
      )
      .subscribe({
        next: (response) => {
          let rawResponse = response.transformedSelection || response.transformedContent || '';
          // Strip AI commentary — use only the document content
          const extracted = this.extractAiNoteFromResponse(rawResponse);

          // If AI returned only an explanation (no usable content), show SweetAlert and reset
          // Also catches: AI returned unchanged content + explanation note
          const hasNote = !!extracted.aiNote;
          const noContent = !extracted.documentContent;
          const contentUnchanged = extracted.documentContent && this.isContentEssentiallyUnchanged(extracted.documentContent, this.selectedText);

          if (hasNote && (noContent || contentUnchanged)) {
            const noteText = extracted.aiNote || rawResponse;
            // Keep toolbar in 'loading' to prevent selection-change listeners from clearing it
            // before the async SweetAlert import resolves. Cleanup happens in showAiNoteModal's .then()
            this.showAiNoteModal(noteText);
            return;
          }

          this.aiPreviewResponse = extracted.documentContent || rawResponse;
          this.aiPreviewToolType = 'custom';
          this.floatingToolbarState = this.aiPreviewResponse ? 'preview' : 'quick_actions';
          if (!this.aiPreviewResponse) {
            this.notificationService.info('No Changes', 'AI found no changes needed.', 2000);
          }
          this.cdr.detectChanges();
          if (this.floatingToolbarState === 'preview') {
            setTimeout(() => this.repositionForPreview(), 0);
          }
        },
        error: (err) => {
          this.notificationService.error('Error', 'Could not generate revision. Please try again.');
          this.floatingToolbarState = 'quick_actions';
          this.cleanupTransformMarker();
          // Restore native selection — remove yellowMarker, refocus editor
          this.restoreNativeSelection();
          this.cdr.detectChanges();
        }
      });
  }

  triggerToolTransform(tool: string): void {
    if (this.floatingToolbarState === 'loading') return; // Prevent double-click
    if (!this.selectedText || !this.selectionRange || !this.editorInstance) return;

    // Apply yellowMarker to persist highlight during AI processing
    this.highlightSelection();
    this.aiPreviewToolType = tool;
    this.lastPromptText = '';
    this.floatingToolbarState = 'loading';
    this.cdr.detectChanges();

    this.bookmarkSelectionForTransform();

    const editor = this.editorInstance;
    // For template docs, use original template HTML as context (preserves structure).
    // For regular docs, use CKEditor's plain text.
    const fullDocContent = this.originalTemplateHtml
      ? this.originalTemplateHtml
      : this.ckEditorService.getPlainText(editor);
    const toolConfig = this.toolPromptMap[tool] || { type: tool.toUpperCase() };

    const request: any = {
      documentId: this.currentDocumentId as number,
      transformationType: toolConfig.type,
      transformationScope: 'SELECTION' as const,
      fullDocumentContent: fullDocContent,
      selectedText: this.selectedText,
      selectionStartIndex: this.selectionRange.index,
      selectionEndIndex: this.selectionRange.index + this.selectionRange.length,
      jurisdiction: this.selectedJurisdiction,
      documentType: this.selectedDocTypePill,
    };
    if (toolConfig.prompt) request.customPrompt = toolConfig.prompt;

    this.documentGenerationService.transformDocument(request, this.currentUser?.id)
      .pipe(
        takeUntil(merge(this.destroy$, this.cancelGeneration$)),
        finalize(() => this.cdr.detectChanges())
      )
      .subscribe({
        next: (response) => {
          let rawResponse = response.transformedSelection || response.transformedContent || '';
          // Strip AI commentary — use only the document content
          const extracted = this.extractAiNoteFromResponse(rawResponse);

          // If AI returned only an explanation (no usable content), show SweetAlert and reset
          const hasNote = !!extracted.aiNote;
          const noContent = !extracted.documentContent;
          const contentUnchanged = extracted.documentContent && this.isContentEssentiallyUnchanged(extracted.documentContent, this.selectedText);

          if (hasNote && (noContent || contentUnchanged)) {
            const noteText = extracted.aiNote || rawResponse;
            // Keep toolbar in 'loading' to prevent selection-change listeners from clearing it
            // before the async SweetAlert import resolves. Cleanup happens in showAiNoteModal's .then()
            this.showAiNoteModal(noteText);
            return;
          }

          this.aiPreviewResponse = extracted.documentContent || rawResponse;
          this.floatingToolbarState = this.aiPreviewResponse ? 'preview' : 'quick_actions';
          if (!this.aiPreviewResponse) {
            this.notificationService.info('No Changes', 'AI found no changes needed.', 2000);
          }
          this.cdr.detectChanges();
          if (this.floatingToolbarState === 'preview') {
            setTimeout(() => this.repositionForPreview(), 0);
          }
        },
        error: (err) => {
          this.notificationService.error('Error', 'Transform failed. Please try again.');
          this.floatingToolbarState = 'quick_actions';
          this.cleanupTransformMarker();
          // Restore native selection — remove yellowMarker, refocus editor
          this.restoreNativeSelection();
          this.cdr.detectChanges();
        }
      });
  }

  // ── Floating toolbar: commit methods ──

  commitReplace(): void {
    if (!this.editorInstance || !this.aiPreviewResponse) return;
    const editor = this.editorInstance;
    const originalHtml = editor.getData();

    const marker = editor.model.markers.get('pending-selection-transform');
    if (!marker) {
      this.notificationService.error('Error', 'Could not locate the selected text.');
      this.resetFloatingToolbar();
      return;
    }

    try {
      // 2. Build HTML from AI response, mapping blocks to original block types (heading/paragraph)
      //    Also detect markdown tables and convert them to proper <table> HTML
      const responseBlocks = this.aiPreviewResponse.split(/\r?\n\r?\n+/).filter((t: string) => t.trim());
      const htmlParts = responseBlocks.map((text: string, i: number) => {
        if (this.isMarkdownTable(text)) {
          return this.markdownTableToHtml(text);
        }
        const blockType = this.originalSelectionBlocks[i]?.type || 'paragraph';
        const tag = this.blockTypeToHtmlTag(blockType);
        let processed = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        // Convert markdown bold+italic, bold, and italic to HTML
        processed = processed.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
        processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        processed = processed.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
        const withBreaks = processed.replace(/\n/g, '<br>');
        return `<${tag}>${withBreaks}</${tag}>`;
      });
      const html = this.convertExhibitReferences(htmlParts.join(''));

      // Check if we're replacing inside a table and the AI response contains a table
      const hasTableInResponse = responseBlocks.some((text: string) => this.isMarkdownTable(text));
      const isInsideTable = this.originalSelectionBlocks.some(b => b.type === 'table');

      if (isInsideTable && hasTableInResponse) {
        // Table-to-table replacement: remove the entire parent table, then insert the new content.
        // Without this, CKEditor would try to nest a new table inside the old table's cells.
        editor.model.change((writer: any) => {
          const markerRange = marker.getRange();
          let tableElement = markerRange.start.parent;
          while (tableElement && tableElement.name !== 'table' && !tableElement.is?.('rootElement')) {
            tableElement = tableElement.parent;
          }
          writer.removeMarker('pending-selection-transform');
          if (tableElement && tableElement.name === 'table') {
            writer.setSelection(writer.createPositionBefore(tableElement));
            writer.remove(tableElement);
          } else {
            // Fallback: select the marker range as usual
            writer.removeAttribute('highlight', markerRange);
            writer.setSelection(markerRange);
          }
        });
      } else {
        // 1. Non-table path: clear highlight, select the range (to be replaced), remove marker
        editor.model.change((writer: any) => {
          const range = marker.getRange();
          writer.removeAttribute('highlight', range);
          writer.setSelection(range);
          writer.removeMarker('pending-selection-transform');
        });
      }

      // 3. Convert HTML to CKEditor model fragment and insert (replaces current selection)
      const viewFragment = editor.data.processor.toView(html);
      const modelFragment = editor.data.toModel(viewFragment);
      editor.model.insertContent(modelFragment);

      // 4. Apply green highlight to the inserted blocks (skip tables — highlight doesn't work on table internals)
      try {
        editor.model.change((writer: any) => {
          const root = editor.model.document.getRoot();
          const endPos = editor.model.document.selection.getFirstPosition();
          if (!root || !endPos) return;

          let endBlock = endPos.parent;
          while (endBlock && endBlock.parent !== root) {
            endBlock = endBlock.parent;
          }
          if (!endBlock) return;

          const numBlocks = responseBlocks.length;
          let block = endBlock;
          for (let i = 0; i < numBlocks && block; i++) {
            // Skip table elements — greenMarker doesn't apply well to table internals
            if (block.name !== 'table') {
              try {
                const range = writer.createRangeIn(block);
                writer.setAttribute('highlight', 'greenMarker', range);
              } catch (_e) { /* skip */ }
            }
            if (i < numBlocks - 1) {
              block = block.previousSibling as any;
            }
          }
        });
      } catch (_e) { /* highlight is cosmetic — don't let it block the commit */ }

      // Clear any stale DOM selection that might overlap with greenMarker
      window.getSelection()?.removeAllRanges();
    } catch {
      // Error handled silently
    }

    this.activeDocumentContent = editor.getData();
    const plainText = this.ckEditorService.getPlainText(editor);
    this.currentDocumentWordCount = this.documentGenerationService.countWords(plainText);
    this.currentDocumentPageCount = this.documentGenerationService.estimatePageCount(this.currentDocumentWordCount);

    // Rebuild TOC — headings may have changed after replacement
    this.exhibitPanelService.buildTocFromHtml(this.activeDocumentContent);
    this.setDefaultActiveToc();

    this.pendingChanges = {
      originalContent: originalHtml,
      transformedContent: editor.getData(),
      changeCount: 1,
      type: this.aiPreviewToolType,
      response: { transformedSelection: this.aiPreviewResponse },
      isUndone: false
    };
    this.startPendingChangesAutoTimer();

    // Remove cached-selection marker BEFORE reset — otherwise removeSelectionHighlight()
    // would strip the greenMarker we just applied (it operates on the cached-selection range)
    if (editor.model.markers.has('cached-selection')) {
      editor.model.change((w: any) => w.removeMarker('cached-selection'));
    }
    this.resetFloatingToolbar();
  }

  private blockTypeToHtmlTag(blockType: string): string {
    switch (blockType) {
      case 'heading1': return 'h1';
      case 'heading2': return 'h2';
      case 'heading3': return 'h3';
      case 'heading4': return 'h4';
      case 'heading5': return 'h5';
      case 'heading6': return 'h6';
      default: return 'p';
    }
  }

  /**
   * Detect if a text block is a markdown table (has | separators and a --- separator row).
   */
  /**
   * Extract text from a CKEditor table model element as a markdown table string.
   * This gives the AI proper structure to understand and modify table content.
   */
  private extractTableAsMarkdown(tableElement: any): string {
    const rows: string[][] = [];
    for (const row of tableElement.getChildren()) {
      if (!row.is?.('element') || row.name !== 'tableRow') continue;
      const cells: string[] = [];
      for (const cell of row.getChildren()) {
        if (!cell.is?.('element') || cell.name !== 'tableCell') continue;
        // Extract text from all paragraphs within the cell
        let cellText = '';
        for (const child of cell.getChildren()) {
          if (child.is?.('element') && child.name === 'paragraph') {
            for (const textNode of child.getChildren()) {
              if (textNode.is?.('$text') || textNode.is?.('$textProxy')) {
                cellText += textNode.data;
              }
            }
          }
        }
        cells.push(cellText.trim());
      }
      // Skip rows that look like markdown separators (leftover from previous insertions)
      const isSeparatorRow = cells.length > 0 && cells.every(c => /^:?-{2,}:?$/.test(c.trim()));
      if (!isSeparatorRow) {
        rows.push(cells);
      }
    }
    if (rows.length === 0) return '';

    // Build markdown table: first row as header, then separator, then data
    const header = rows[0];
    const lines: string[] = [];
    lines.push('| ' + header.join(' | ') + ' |');
    lines.push('| ' + header.map(() => '---').join(' | ') + ' |');
    for (let i = 1; i < rows.length; i++) {
      lines.push('| ' + rows[i].join(' | ') + ' |');
    }
    return lines.join('\n');
  }

  private isMarkdownTable(text: string): boolean {
    const lines = text.trim().split('\n');
    if (lines.length < 3) return false;
    return lines.some(line =>
      /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line.trim())
    );
  }

  /**
   * Convert a markdown table to CKEditor-compatible HTML table.
   */
  private markdownTableToHtml(text: string): string {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l);
    const escHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Find separator row (the --- | --- line)
    const sepIdx = lines.findIndex(line =>
      /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line)
    );
    if (sepIdx < 1) return `<p>${escHtml(text)}</p>`;

    const parseCells = (line: string): string[] => {
      let trimmed = line.trim();
      if (trimmed.startsWith('|')) trimmed = trimmed.substring(1);
      if (trimmed.endsWith('|')) trimmed = trimmed.substring(0, trimmed.length - 1);
      return trimmed.split('|').map(c => c.trim());
    };

    const headers = parseCells(lines[sepIdx - 1]);
    const dataLines = lines.slice(sepIdx + 1);

    let html = '<figure class="table"><table><thead><tr>';
    for (const h of headers) {
      html += `<th>${escHtml(h)}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (const dataLine of dataLines) {
      if (!dataLine.trim()) continue;
      const cells = parseCells(dataLine);
      html += '<tr>';
      for (let i = 0; i < headers.length; i++) {
        html += `<td>${escHtml(cells[i] || '')}</td>`;
      }
      html += '</tr>';
    }

    html += '</tbody></table></figure>';
    return html;
  }

  commitInsertBelow(): void {
    if (!this.editorInstance || !this.aiPreviewResponse) return;
    const editor = this.editorInstance;
    const originalHtml = editor.getData();

    const marker = editor.model.markers.get('pending-selection-transform');
    if (!marker) {
      this.notificationService.error('Error', 'Could not locate the insertion point.');
      this.resetFloatingToolbar();
      return;
    }

    // 1. Remove yellowMarker, create new paragraph(s) after the selection end block,
    //    insert text, and apply greenMarker — all in one model.change() block
    const responseBlocks = this.aiPreviewResponse.split(/\r?\n\r?\n+/).filter((t: string) => t.trim());

    editor.model.change((writer: any) => {
      const markerRange = marker.getRange();
      // Only remove yellowMarker — preserve any greenMarker from previous operations
      const items = Array.from(markerRange.getItems());
      for (const item of items) {
        if ((item.is('$text') || item.is('$textProxy')) && item.getAttribute('highlight') === 'yellowMarker') {
          writer.removeAttribute('highlight', writer.createRangeOn(item));
        }
      }
      writer.removeMarker('pending-selection-transform');

      // Use the block containing the selection end as the anchor
      // For table selections, walk up to the table element so we insert after the table
      let insertAfterBlock = markerRange.end.parent;
      const root = editor.model.document.getRoot();
      while (insertAfterBlock && insertAfterBlock.parent && insertAfterBlock.parent !== root) {
        insertAfterBlock = insertAfterBlock.parent;
      }
      // Safety: if walk ended at root or null, use last child of document
      if (!insertAfterBlock || insertAfterBlock === root || !insertAfterBlock.parent) {
        insertAfterBlock = root.getChild(root.childCount - 1) as any;
      }

      for (const blockText of responseBlocks) {
        if (this.isMarkdownTable(blockText)) {
          // Tables need the HTML→model pipeline — can't use writer.insertText for tables
          const tableHtml = this.markdownTableToHtml(blockText);
          const viewFrag = editor.data.processor.toView(tableHtml);
          const modelFrag = editor.data.toModel(viewFrag);
          const children: any[] = Array.from(modelFrag.getChildren() as any);
          for (const child of children) {
            writer.insert(child, writer.createPositionAfter(insertAfterBlock));
            insertAfterBlock = child;
          }
        } else {
          // Convert markdown italic/bold to HTML, then use HTML→model pipeline
          let blockHtml = blockText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          blockHtml = blockHtml.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
          blockHtml = blockHtml.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          blockHtml = blockHtml.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
          blockHtml = `<p>${blockHtml}</p>`;
          const viewFrag = editor.data.processor.toView(blockHtml);
          const modelFrag = editor.data.toModel(viewFrag);
          const children: any[] = Array.from(modelFrag.getChildren() as any);
          for (const child of children) {
            writer.insert(child, writer.createPositionAfter(insertAfterBlock));
            writer.setAttribute('highlight', 'greenMarker', writer.createRangeIn(child));
            insertAfterBlock = child;
          }
        }
      }
    });

    // Clear any stale DOM selection that might overlap with greenMarker
    window.getSelection()?.removeAllRanges();

    this.activeDocumentContent = editor.getData();
    const plainText = this.ckEditorService.getPlainText(editor);
    this.currentDocumentWordCount = this.documentGenerationService.countWords(plainText);
    this.currentDocumentPageCount = this.documentGenerationService.estimatePageCount(this.currentDocumentWordCount);

    // Rebuild TOC — content structure may have changed after insertion
    this.exhibitPanelService.buildTocFromHtml(this.activeDocumentContent);
    this.setDefaultActiveToc();

    this.pendingChanges = {
      originalContent: originalHtml,
      transformedContent: editor.getData(),
      changeCount: 1,
      type: this.aiPreviewToolType + ' (insert below)',
      response: { transformedSelection: this.aiPreviewResponse },
      isUndone: false
    };
    this.startPendingChangesAutoTimer();

    // Remove cached-selection marker BEFORE reset — otherwise removeSelectionHighlight()
    // would strip the greenMarker we just applied
    if (editor.model.markers.has('cached-selection')) {
      editor.model.change((w: any) => w.removeMarker('cached-selection'));
    }
    this.resetFloatingToolbar();
  }

  // ── Floating toolbar: helpers ──

  private resetFloatingToolbar(): void {
    this.floatingToolbarState = 'idle';
    this.floatingToolbarPosition = null;
    this._cachedSelectionRect = null;
    this.aiPreviewResponse = '';
    this.aiPreviewToolType = '';
    this.floatingPromptText = '';
    this.lastPromptText = '';
    this.selectedText = '';
    this.selectionRange = null;
    this.removeSelectionHighlight();
    this.cleanupTransformMarker();
    if (this.editorInstance?.model?.markers?.has('cached-selection')) {
      this.editorInstance.model.change((w: any) => w.removeMarker('cached-selection'));
    }
    this.cdr.detectChanges();
  }

  private bookmarkSelectionForTransform(): void {
    if (!this.editorInstance) return;
    const editor = this.editorInstance;

    // Collect all non-collapsed ranges — handles table multi-cell selections
    const allRanges: any[] = [];
    for (const range of editor.model.document.selection.getRanges()) {
      if (!range.isCollapsed) allRanges.push(range);
    }

    let selRange: any;
    if (allRanges.length > 1) {
      // Multi-range (table selection) — create a spanning range from first start to last end
      selRange = editor.model.createRange(allRanges[0].start, allRanges[allRanges.length - 1].end);
    } else if (allRanges.length === 1) {
      selRange = allRanges[0];
    } else {
      // Fallback to cached-selection marker
      const cachedMarker = editor.model.markers.get('cached-selection');
      selRange = cachedMarker?.getRange();
    }
    if (!selRange || selRange.isCollapsed) return;

    editor.model.change((writer: any) => {
      if (editor.model.markers.has('pending-selection-transform')) {
        writer.removeMarker('pending-selection-transform');
      }
      writer.addMarker('pending-selection-transform', {
        range: selRange, usingOperation: false, affectsData: false
      });
    });

    this.captureSelectionBlockStructure(selRange);
  }

  /**
   * Walk the selection range and record each block element type (heading, paragraph, etc.).
   * Includes partially-selected start/end blocks (walker only yields fully-contained elements).
   * This metadata is used by commitReplace() to map AI response blocks back to proper elements.
   */
  private captureSelectionBlockStructure(range: any): void {
    this.originalSelectionBlocks = [];
    const visited = new Set<any>();

    const addBlock = (node: any) => {
      if (!node || visited.has(node)) return;
      visited.add(node);
      const name = node.name;
      if (name === 'paragraph' || name?.startsWith('heading')) {
        this.originalSelectionBlocks.push({ type: name });
      } else if (name === 'listItem') {
        this.originalSelectionBlocks.push({ type: 'paragraph' });
      } else if (name === 'table') {
        this.originalSelectionBlocks.push({ type: 'table' });
      }
    };

    // Walk up from range start to find the nearest block-level ancestor
    const findBlockAncestor = (node: any): any => {
      let current = node;
      while (current && !current.is?.('rootElement')) {
        const name = current.name;
        if (name === 'table' || name === 'paragraph' || name?.startsWith('heading') || name === 'listItem') {
          return current;
        }
        // If inside a tableCell, walk up to the containing table
        if (name === 'tableCell' || name === 'tableRow') {
          let parent = current.parent;
          while (parent && parent.name !== 'table') parent = parent.parent;
          return parent || current;
        }
        current = current.parent;
      }
      return node;
    };

    // Include the partially-selected start block
    addBlock(findBlockAncestor(range.start.parent));

    // Walk fully-contained intermediate blocks
    const walker = range.getWalker({ shallow: true });
    for (const value of walker) {
      const node = value.item;
      if (node.is?.('element') && !visited.has(node)) {
        addBlock(node);
      }
    }

    // Include the partially-selected end block
    addBlock(findBlockAncestor(range.end.parent));

    // Fallback: if nothing was found (e.g. selection within a single inline), default to paragraph
    if (this.originalSelectionBlocks.length === 0) {
      this.originalSelectionBlocks.push({ type: 'paragraph' });
    }
  }

  private cleanupTransformMarker(): void {
    if (this.editorInstance?.model?.markers?.has('pending-selection-transform')) {
      this.editorInstance.model.change((w: any) => w.removeMarker('pending-selection-transform'));
    }
  }

  /**
   * Apply yellowMarker highlight to the cached selection range.
   * Also collapses the CKEditor model selection so native ::selection disappears
   * (CKEditor fights back if we only collapse DOM selection via removeAllRanges).
   */
  private highlightSelection(): void {
    if (!this.editorInstance) return;
    const editor = this.editorInstance;
    const cachedMarker = editor.model.markers.get('cached-selection');
    if (!cachedMarker) return;
    const range = cachedMarker.getRange();
    // Increment counter: setAttribute + setSelection can each fire change:range
    this._ignoreSelectionChanges += 2;
    editor.model.change((writer: any) => {
      // Apply yellowMarker only to text that doesn't already have greenMarker
      const items = Array.from(range.getItems());
      let hasNonGreen = false;
      for (const item of items) {
        if ((item.is('$text') || item.is('$textProxy')) && item.getAttribute('highlight') !== 'greenMarker') {
          writer.setAttribute('highlight', 'yellowMarker', writer.createRangeOn(item));
          hasNonGreen = true;
        }
      }
      // If entire selection is green, still apply yellow so the user sees the selection feedback
      if (!hasNonGreen) {
        writer.setAttribute('highlight', 'yellowMarker', range);
      }
      // Collapse model selection to end — CKEditor syncs to DOM, removing native blue
      writer.setSelection(range.end);
    });
    // Belt-and-suspenders: explicitly clear DOM selection after CKEditor's render pass.
    // CKEditor may skip syncing the collapsed model selection to DOM when the editor
    // is simultaneously losing focus (e.g., user clicked a toolbar button).
    // The CSS class .suppress-native-selection is the primary fix; this is a safety net.
    setTimeout(() => {
      window.getSelection()?.removeAllRanges();
    }, 0);
  }

  /**
   * Remove yellowMarker from the cached selection range.
   */
  private removeSelectionHighlight(): void {
    if (!this.editorInstance) return;
    const editor = this.editorInstance;
    const cachedMarker = editor.model.markers.get('cached-selection');
    if (!cachedMarker) return;
    editor.model.change((writer: any) => {
      // Only remove yellowMarker — preserve greenMarker from previous AI replacements
      const items = Array.from(cachedMarker.getRange().getItems());
      for (const item of items) {
        if ((item.is('$text') || item.is('$textProxy')) && item.getAttribute('highlight') === 'yellowMarker') {
          writer.removeAttribute('highlight', writer.createRangeOn(item));
        }
      }
    });
  }

  /**
   * Remove yellowMarker, restore CKEditor model selection to the cached range,
   * and focus the editor so native ::selection reappears.
   * Used when canceling back to quick_actions from prompt_editing/loading/preview.
   */
  private restoreNativeSelection(): void {
    if (!this.editorInstance) return;
    const editor = this.editorInstance;
    const cachedMarker = editor.model.markers.get('cached-selection');
    if (!cachedMarker) return;
    const range = cachedMarker.getRange();
    // Counter: removeAttribute + setSelection can each fire change:range
    this._ignoreSelectionChanges += 2;
    // Remove only yellowMarker (preserve greenMarker) and restore model selection
    editor.model.change((writer: any) => {
      const items = Array.from(range.getItems());
      for (const item of items) {
        if ((item.is('$text') || item.is('$textProxy')) && item.getAttribute('highlight') === 'yellowMarker') {
          writer.removeAttribute('highlight', writer.createRangeOn(item));
        }
      }
      writer.setSelection(range);
    });
    // Focus editor so native ::selection is visible
    editor.editing.view.focus();
  }

  // Apply drafting tool — selection-only, delegates to triggerToolTransform
  applyDraftingTool(tool: 'simplify' | 'condense' | 'expand' | 'redraft'): void {
    if (!this.currentDocumentId) {
      this.notificationService.warning('No Document', 'Please generate a document first before applying revisions.');
      return;
    }

    // Map old tool names to new toolbar tool names
    const toolMap: Record<string, string> = {
      simplify: 'polish',
      condense: 'condense',
      expand: 'elaborate',
      redraft: 'polish'
    };

    if (this.selectedText && this.selectionRange) {
      this.triggerToolTransform(toolMap[tool] || tool);
      return;
    }

    // Dismiss any existing pending changes before starting a new transform
    if (this.pendingChanges) {
      this.dismissPendingChanges();
    }

    // Snapshot current editor content for undo
    const originalHtml = this.editorInstance?.getData() || '';

    // Call backend transformation service (AI Workspace API)
    this.stateService.setIsGenerating(true);
    if (this.editorInstance) {
      this.editorInstance.enableReadOnlyMode('ai-generation');
    }

    const transformRequest = {
      documentId: this.currentDocumentId as number,
      transformationType: tool.toUpperCase(),
      transformationScope: 'FULL_DOCUMENT' as const,
      fullDocumentContent: this.activeDocumentContent,
      jurisdiction: this.selectedJurisdiction,
      documentType: this.selectedDocTypePill
    };

    this.documentGenerationService.transformDocument(transformRequest, this.currentUser?.id)
      .pipe(
        takeUntil(merge(this.destroy$, this.cancelGeneration$)),
        finalize(() => {
          this.stateService.setIsGenerating(false);
          if (this.editorInstance) {
            this.editorInstance.disableReadOnlyMode('ai-generation');
          }
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          try {
            let changeCount = 0;
            let contentToApply = response.transformedContent || '';

            // Detect AI commentary/explanations in non-diff responses
            if (!response.useDiffMode && contentToApply) {
              const { aiNote, documentContent } = this.extractAiNoteFromResponse(contentToApply, originalHtml);
              if (aiNote) {
                this.showAiNoteModal(aiNote);
                if (documentContent && documentContent.trim()) {
                  contentToApply = documentContent;
                } else {
                  this.cdr.detectChanges();
                  return;
                }
              }
            }

            // Apply changes directly to editor
            if (response.useDiffMode && response.changes?.length) {
              // Diff mode: apply find/replace with green highlights
              changeCount = response.changes.length;
              this.applyDiffChangesToEditor(response.changes, false); // false = don't auto-remove highlights
            } else if (contentToApply) {
              // Full mode: replace entire content
              this.setCKEditorContentFromMarkdown(contentToApply);
              this.activeDocumentContent = contentToApply;
              changeCount = 1; // Treat as single "full document" change
            }

            // Update word count
            if (this.editorInstance) {
              const plainText = this.ckEditorService.getPlainText(this.editorInstance);
              this.currentDocumentWordCount = this.documentGenerationService.countWords(plainText);
              this.currentDocumentPageCount = this.documentGenerationService.estimatePageCount(this.currentDocumentWordCount);
            }

            // Show status bar (only if changes were actually applied)
            if (changeCount > 0) {
              this.pendingChanges = {
                originalContent: originalHtml,
                transformedContent: this.editorInstance ? this.editorInstance.getData() : contentToApply,
                changeCount,
                type: tool,
                response,
                isUndone: false
              };
              // No auto-dismiss for full-document tool changes — user must explicitly act
            } else {
              this.notificationService.info('No Changes', 'No changes were made to the document.', 2000);
            }

            this.cdr.detectChanges();
          } catch (innerError) {
            this.notificationService.error('Error', 'Transformation completed but failed to apply changes.');
          }
        },
        error: (error) => {
          this.notificationService.error('Revision Failed', 'Failed to apply document revision. Please try again.', 3000);
        }
      });
  }

  // ========================================
  // CKEDITOR 5 EVENT HANDLERS
  // ========================================

  /**
   * Set CKEditor content from markdown string.
   * Converts markdown to HTML, migrates any legacy Quill markup, then loads into editor.
   * CKEditor's setData() is synchronous — no clipboard delay hacks needed.
   */
  private setCKEditorContentFromMarkdown(markdownContent: string): void {
    if (!this.editorInstance) {
      // Cannot set content - CKEditor instance not available
      return;
    }

    let htmlContent: string;

    // Template-rendered HTML (initial generation): set originalTemplateHtml for PDF export
    if (markdownContent.trimStart().startsWith('<!-- HTML_TEMPLATE -->')) {
      htmlContent = markdownContent.replace('<!-- HTML_TEMPLATE -->', '').trim();
      this.originalTemplateHtml = htmlContent;
      this.originalTemplateDocId = this.currentDocumentId;
    }
    // Saved CKEditor HTML (after user edits): load directly, keep originalTemplateHtml for PDF
    else if (markdownContent.trimStart().startsWith('<!-- CKEDITOR_HTML -->')) {
      htmlContent = markdownContent.replace('<!-- CKEDITOR_HTML -->', '').trim();
      // Don't touch originalTemplateHtml — it stays set from initial generation for PDF export
    }
    // Regular markdown content
    else {
      if (this.currentDocumentId !== this.originalTemplateDocId) {
        this.originalTemplateHtml = null;
        this.originalTemplateDocId = null;
      }
      htmlContent = this.markdownConverter.convert(markdownContent);
    }

    // Migrate any legacy Quill-stored HTML (ql-syntax pre blocks → tables, ql-* classes)
    if (QuillHtmlMigrator.needsMigration(htmlContent)) {
      htmlContent = QuillHtmlMigrator.migrate(htmlContent);
    }

    // Convert AI exhibit references like [Exhibit A, p.3] to clickable links
    htmlContent = this.convertExhibitReferences(htmlContent);

    // Strip any legacy stationery HTML baked into the content (from old approach)
    if (htmlContent.includes('data-stationery=')) {
      htmlContent = this.stripStationeryFromHtml(htmlContent);
    }

    this.editorInstance.setData(htmlContent);
  }

  /**
   * Apply diff-based changes to CKEditor content.
   * Used for token-efficient transformations (SIMPLIFY, CONDENSE).
   * Applies find/replace pairs directly to the editor's text with highlighting.
   * @param autoRemoveHighlights If true, highlights auto-remove after 4s. If false, highlights persist (for inline review).
   */
  private applyDiffChangesToEditor(changes: Array<{find: string; replace: string}>, autoRemoveHighlights = true): void {
    if (!this.editorInstance) {
      // Cannot apply diff changes - CKEditor not available
      return;
    }

    const editor = this.editorInstance;

    // Apply each change using CKEditorService
    for (const change of changes) {
      if (!change.find || change.replace === undefined) continue;

      // Find and replace in the model with highlight
      editor.model.change((writer: any) => {
        const root = editor.model.document.getRoot();
        const fullRange = writer.createRangeIn(root);
        let fullText = '';
        const textNodes: Array<{ node: any; offset: number; text: string }> = [];

        for (const value of fullRange.getWalker({ ignoreElementEnd: true })) {
          if (value.type === 'text') {
            textNodes.push({ node: value.item, offset: fullText.length, text: value.item.data });
            fullText += value.item.data;
          }
        }

        const index = fullText.indexOf(change.find);
        if (index === -1) return;

        // Find model positions for the text to replace
        const startPos = this.textOffsetToModelPos(editor.model, textNodes, index);
        const endPos = this.textOffsetToModelPos(editor.model, textNodes, index + change.find.length);
        if (!startPos || !endPos) return;

        const range = writer.createRange(startPos, endPos);
        writer.remove(range);
        writer.insertText(change.replace, range.start);

        // Apply highlight marker to the new text
        const newEndPos = this.textOffsetToModelPos(editor.model, textNodes, index + change.replace.length);
        if (newEndPos) {
          const highlightRange = writer.createRange(range.start, newEndPos);
          writer.setAttribute('highlight', 'greenMarker', highlightRange);
        }
      });
    }

    // Remove highlights after 4 seconds (only if auto-remove is enabled)
    if (autoRemoveHighlights) {
      setTimeout(() => {
        this.ckEditorService.removeAllHighlights(editor);
      }, 4000);
    }

    // Update activeDocumentContent from CKEditor's current state
    this.activeDocumentContent = editor.getData();

    // Update word count
    const plainText = this.ckEditorService.getPlainText(editor);
    this.currentDocumentWordCount = this.documentGenerationService.countWords(plainText);
    this.currentDocumentPageCount = this.documentGenerationService.estimatePageCount(this.currentDocumentWordCount);

    this.cdr.detectChanges();
  }

  /** Helper: convert text offset to CKEditor model position */
  private textOffsetToModelPos(
    model: any,
    textNodes: Array<{ node: any; offset: number; text: string }>,
    targetOffset: number
  ): any {
    for (const entry of textNodes) {
      const entryEnd = entry.offset + entry.text.length;
      if (targetOffset >= entry.offset && targetOffset <= entryEnd) {
        const localOffset = targetOffset - entry.offset;
        const parent = entry.node.parent;
        const nodeOffset = entry.node.startOffset;
        return model.createPositionAt(parent, nodeOffset + localOffset);
      }
    }
    return null;
  }

  /**
   * Load document content into CKEditor.
   * Can be called from onEditorReady() or when switching documents.
   */
  private loadDocumentContent(markdownContent: string): void {
    if (!this.editorInstance) {
      // Cannot load content - CKEditor instance not available
      return;
    }

    if (!markdownContent) {
      // Cannot load content - no markdown content provided
      return;
    }

    // Set word count immediately from markdown (before any async CKEditor processing)
    // This ensures the toolbar never shows "0 words" while content is loading
    const immediateWordCount = this.documentGenerationService.countWords(markdownContent);
    if (immediateWordCount > 0) {
      this.currentDocumentWordCount = immediateWordCount;
      this.currentDocumentPageCount = this.documentGenerationService.estimatePageCount(immediateWordCount);
    }

    // CRITICAL: Cancel any pending content load timeout to prevent race conditions
    if (this.contentLoadTimeoutId !== null) {
      clearTimeout(this.contentLoadTimeoutId);
      this.contentLoadTimeoutId = null;
    }

    // CKEditor's setData is synchronous, but we use a short delay to let the
    // editor UI settle after creation/recreation
    this.contentLoadTimeoutId = window.setTimeout(() => {
      this.contentLoadTimeoutId = null;
      this.setCKEditorContentFromMarkdown(markdownContent);

      // Sync activeDocumentContent with CKEditor's actual HTML content after setData
      setTimeout(() => {
        if (this.editorInstance) {
          const html = this.editorInstance.getData();
          this.activeDocumentContent = html;
          if (html) {
            const plainText = html.replace(/<[^>]*>/g, ' ');
            this.currentDocumentWordCount = this.documentGenerationService.countWords(plainText);
            this.currentDocumentPageCount = this.documentGenerationService.estimatePageCount(this.currentDocumentWordCount);
            this.exhibitPanelService.buildTocFromHtml(html);
            this.setDefaultActiveToc();
            this.setupScrollSpy();
            this.cdr.detectChanges();
          }
        }
      }, 50);
    }, 50);
  }

  /**
   * Handle CKEditor ready event - capture editor instance reference
   */
  onEditorCreated(editor: any): void {
    this.editorInstance = editor;

    if (editor) {
      // CRITICAL: Load content here if pending - this is the ONLY reliable place
      if (this.pendingDraftContent) {
        this.setCKEditorContentFromMarkdown(this.pendingDraftContent);
        const html = editor.getData();
        this.activeDocumentContent = html;
        if (html) {
          const plainText = html.replace(/<[^>]*>/g, ' ');
          this.currentDocumentWordCount = this.documentGenerationService.countWords(plainText);
          this.currentDocumentPageCount = this.documentGenerationService.estimatePageCount(this.currentDocumentWordCount);
        }
        this.pendingDraftContent = null;
      } else if (this.pendingDocumentContent) {
        this.loadDocumentContent(this.pendingDocumentContent);
        this.pendingDocumentContent = null;
      }

      // If stationery is active (e.g. document reopened with stationery), inject frames into DOM
      if (this.activeStationeryRawHtml && this.stationeryInserted) {
        // Small delay to ensure CKEditor DOM is fully rendered
        this.stationeryRenderTimeoutId = window.setTimeout(() => this.renderStationeryFrames(), 50);
      }

      // Handle link clicks — open in new window or open exhibit references
      const editableElement = editor.editing.view.getDomRoot();
      if (editableElement) {
        editableElement.addEventListener('click', (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          if (!target) return;

          // Check for exhibit reference links first
          const exhibitRef = target.classList?.contains('exhibit-ref') ? target : target.closest('.exhibit-ref') as HTMLElement;
          if (exhibitRef) {
            e.preventDefault();
            e.stopPropagation();
            const exhibitLabel = exhibitRef.getAttribute('data-exhibit');
            const page = exhibitRef.getAttribute('data-page');
            if (exhibitLabel) {
              this.openExhibitByLabel(exhibitLabel, page ? parseInt(page, 10) : 1);
            }
            return;
          }

          // Regular links — open in new window
          if (target.tagName === 'A') {
            e.preventDefault();
            const href = target.getAttribute('href');
            if (href) {
              window.open(href, '_blank', 'noopener,noreferrer');
            }
          }
        });

        // Selection tracking: capture selection on mouseup inside editor
        editableElement.addEventListener('mouseup', () => {
          setTimeout(() => this.updateSelectionState(), 0);
        });
      }

      // Selection tracking: capture keyboard-based selections (Shift+Arrow, Ctrl+A, etc.)
      editor.model.document.selection.on('change:range', () => {
        setTimeout(() => {
          // Skip if we deliberately changed the selection (highlightSelection/restoreNativeSelection)
          if (this._ignoreSelectionChanges > 0) {
            this._ignoreSelectionChanges--;
            return;
          }
          // Don't reset toolbar during active states (loading, preview, prompt editing)
          if (this.floatingToolbarState === 'loading' || this.floatingToolbarState === 'preview' || this.floatingToolbarState === 'prompt_editing') {
            return;
          }
          // Check ALL ranges — table multi-cell selections have one range per cell
          let hasSelection = false;
          for (const range of editor.model.document.selection.getRanges()) {
            if (range && !range.isCollapsed) { hasSelection = true; break; }
          }
          if (hasSelection) {
            this.updateSelectionState();
          } else if (this.selectedText && this._lastMousedownInsideEditor) {
            this.clearSelection();
          }
        }, 0);
      });

      // Allow deleting empty table rows with Backspace/Delete
      // CKEditor by default only clears cell content, not the row structure.
      // This handler auto-deletes a row when ALL its cells are empty.
      editor.editing.view.document.on('keydown', (_evt: any, data: any) => {
        // Only handle Backspace (8) and Delete (46)
        if (data.keyCode !== 8 && data.keyCode !== 46) return;
        const sel = editor.model.document.selection;
        // Only for collapsed selection (no text selected — user already cleared cells)
        const firstRange = sel.getFirstRange();
        if (!firstRange || !firstRange.isCollapsed) return;
        const pos = firstRange.start;
        // Walk up to find tableCell
        let tableCell = pos.parent;
        while (tableCell && tableCell.name !== 'tableCell') {
          if (tableCell.is?.('rootElement')) return;
          tableCell = tableCell.parent;
        }
        if (!tableCell || tableCell.name !== 'tableCell') return;
        const tableRow = tableCell.parent;
        if (!tableRow || tableRow.name !== 'tableRow') return;
        const table = tableRow.parent;
        if (!table || table.name !== 'table') return;
        // Don't delete if only one row remains
        if (table.childCount <= 1) return;
        // Check if ALL cells in this row are empty (only contain empty paragraphs)
        let allEmpty = true;
        for (const cell of tableRow.getChildren()) {
          if (!cell.is?.('element') || cell.name !== 'tableCell') continue;
          for (const child of cell.getChildren()) {
            if (child.is?.('element') && child.name === 'paragraph' && child.childCount > 0) {
              allEmpty = false; break;
            } else if (child.is?.('$text')) {
              allEmpty = false; break;
            }
          }
          if (!allEmpty) break;
        }
        if (allEmpty) {
          editor.execute('removeTableRow');
          data.preventDefault();
          _evt.stop();
        }
      }, { priority: 'high' });

      // Hide floating toolbar when clicking outside the editor/toolbar
      this.documentMousedownHandler = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target) return;
        // Don't dismiss if clicking inside the floating toolbar
        if (target.closest('.floating-edit-toolbar')) return;
        // Don't dismiss if clicking inside a SweetAlert modal
        if (target.closest('.swal2-container')) return;
        const editable = this.editorInstance?.editing?.view?.getDomRoot();
        this._lastMousedownInsideEditor = !!(editable && editable.contains(target));
        if (this._lastMousedownInsideEditor) return;
        // Click outside editor AND toolbar → clear if in quick_actions state
        if (this.floatingToolbarState === 'quick_actions') {
          this.clearSelection();
        }
      };
      document.addEventListener('mousedown', this.documentMousedownHandler);

      // Detect CKEditor native undo/redo while pendingChanges is active
      editor.model.document.on('change:data', () => {
        if (!this.pendingChanges || this._applyingPendingChange) return;
        const currentData = editor.getData();

        if (!this.pendingChanges.isUndone) {
          if (this.normalizeHtml(currentData) === this.normalizeHtml(this.pendingChanges.originalContent)) {
            this.pendingChanges.isUndone = true;
            this.cdr.detectChanges();
          }
        } else {
          if (this.normalizeHtml(currentData) === this.normalizeHtml(this.pendingChanges.transformedContent)) {
            this.pendingChanges.isUndone = false;
            this.cdr.detectChanges();
          }
        }
      });

      // Build initial TOC from editor content (if already loaded synchronously)
      const initialHtml = editor.getData();
      if (initialHtml) {
        this.exhibitPanelService.buildTocFromHtml(initialHtml);
        this.setDefaultActiveToc();
        this.setupScrollSpy();
      }
    }
  }

  /**
   * Scroll the CKEditor to a specific heading by ID.
   * Used by the drafting sidebar TOC.
   */
  scrollToHeading(headingId: string): void {
    this.activeTocId = headingId;
    this.sidebarOverlayOpen = false; // Close overlay after navigating

    // Suppress scroll spy during smooth scroll animation to prevent flickering
    this.scrollSpySuppressed = true;
    setTimeout(() => { this.scrollSpySuppressed = false; }, 600);

    if (!this.editorInstance) return;
    const editableElement = this.editorInstance.editing.view.getDomRoot();
    if (!editableElement) return;

    const headings = Array.from(editableElement.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    let targetHeading: Element | null = null;

    // Try matching by index from heading-{N} pattern (deterministic IDs from TOC builder)
    const match = headingId.match(/heading-(\d+)/);
    if (match) {
      const index = parseInt(match[1], 10);
      if (headings[index]) {
        targetHeading = headings[index];
      }
    }

    // Fallback: try matching by ID or text content
    if (!targetHeading) {
      for (const heading of headings) {
        if (heading.id === headingId || heading.textContent?.trim() === headingId) {
          targetHeading = heading;
          break;
        }
      }
    }

    if (targetHeading) {
      // scroll-margin-top in CSS provides the breathing room above the heading
      targetHeading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /**
   * Set the first TOC entry as active.
   * Always resets to first entry — scroll spy will update to the visible section as user scrolls.
   * Previous logic preserved stale IDs from other documents (heading IDs are index-based,
   * so heading-5 in document A maps to a different section than heading-5 in document B).
   */
  private setDefaultActiveToc(): void {
    const entries = this.exhibitPanelService.tocSnapshot;
    if (!entries || entries.length === 0) {
      this.activeTocId = null;
      return;
    }
    this.activeTocId = entries[0].id;
  }

  /**
   * Set up scroll spy: listens for scroll events on CKEditor's editable element
   * and updates activeTocId to the heading nearest the top of the viewport.
   * Throttled via requestAnimationFrame to avoid performance issues.
   */
  private setupScrollSpy(): void {
    this.destroyScrollSpy();

    const editableElement = this.editorInstance?.editing?.view?.getDomRoot();
    if (!editableElement) return;

    // The scroll container is .ck.ck-editor (has overflow-y: auto), NOT the editable element.
    // The editable grows to full content height with no overflow — scroll events fire on its ancestor.
    const scrollContainer = editableElement.closest('.ck-editor') as HTMLElement;
    if (!scrollContainer) return;

    // Store direct reference for reliable teardown (editorInstance may be nulled before destroy)
    this.scrollSpyElement = scrollContainer;

    this.scrollSpyListener = () => {
      if (this.scrollSpyFrameId) return; // Throttle: one update per animation frame
      this.scrollSpyFrameId = requestAnimationFrame(() => {
        this.scrollSpyFrameId = null;
        // Query headings from editable, but measure positions relative to scroll container
        this.updateActiveTocOnScroll(editableElement, scrollContainer);
      });
    };

    scrollContainer.addEventListener('scroll', this.scrollSpyListener, { passive: true });
  }

  /**
   * Determine which heading is currently at or above the top of the scroll container
   * and update activeTocId accordingly. Suppressed during smooth-scroll animations.
   * @param editable  The CKEditor editable element (contains the headings)
   * @param scrollContainer  The .ck-editor wrapper (has overflow-y: auto)
   */
  private updateActiveTocOnScroll(editable: HTMLElement, scrollContainer: HTMLElement): void {
    if (this.scrollSpySuppressed) return;

    const headings = Array.from(editable.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    if (!headings.length) return;

    const containerRect = scrollContainer.getBoundingClientRect();
    // Threshold: heading is "active" when it scrolls past top + 100px of the scroll container
    const threshold = containerRect.top + 100;

    let activeIndex = 0;
    for (let i = 0; i < headings.length; i++) {
      const rect = headings[i].getBoundingClientRect();
      if (rect.top <= threshold) {
        activeIndex = i;
      }
    }

    const newId = `heading-${activeIndex}`;
    if (this.activeTocId !== newId) {
      this.activeTocId = newId;
      this.cdr.detectChanges();
    }
  }

  /**
   * Clean up scroll spy listener and pending animation frame.
   * Uses stored element reference rather than editorInstance (which may already be nulled).
   */
  private destroyScrollSpy(): void {
    if (this.scrollSpyFrameId) {
      cancelAnimationFrame(this.scrollSpyFrameId);
      this.scrollSpyFrameId = null;
    }
    if (this.scrollSpyListener && this.scrollSpyElement) {
      this.scrollSpyElement.removeEventListener('scroll', this.scrollSpyListener);
    }
    this.scrollSpyListener = null;
    this.scrollSpyElement = null;
    this.scrollSpySuppressed = false;
  }

  /**
   * Sanitize a URL for use in iframe src.
   * Only allows https: and blob: protocols to prevent XSS.
   * Caches the result to prevent iframe reload on every change detection cycle.
   */
  sanitizeUrl(url: string): SafeResourceUrl {
    if (url === this.cachedExhibitUrl) return this.cachedSafeUrl;
    this.cachedExhibitUrl = url || '';
    const allowed = /^(https?:|blob:)/i;
    if (!url || !allowed.test(url)) {
      this.cachedSafeUrl = this.sanitizer.bypassSecurityTrustResourceUrl('about:blank');
    } else {
      this.cachedSafeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }
    return this.cachedSafeUrl;
  }

  /**
   * Start resizing the exhibit/chat panel.
   */
  onResizeStart(event: MouseEvent): void {
    event.preventDefault();
    this.isResizing = true;
    this.resizeStartX = event.clientX;
    // Get actual rendered width (handles both CSS % default and pixel override)
    const panel = (event.target as HTMLElement).closest('.exhibit-viewer-panel') as HTMLElement;
    this.resizeStartWidth = panel ? panel.offsetWidth : (this.exhibitPanelWidth || 600);

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isResizing) return;
      // Panel is on the right, so moving left = increase width
      const delta = this.resizeStartX - e.clientX;
      const newWidth = Math.max(400, Math.min(900, this.resizeStartWidth + delta));
      this.exhibitPanelWidth = newWidth;
      this.cdr.detectChanges();
    };

    const cleanup = () => {
      this.isResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', cleanup);
      window.removeEventListener('blur', cleanup);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', cleanup);
    window.addEventListener('blur', cleanup);
  }

  /**
   * Proactively read CKEditor's model selection and update component state.
   * Called on mouseup and keyboard selection changes.
   */
  updateSelectionState(): void {
    if (!this.editorInstance) {
      this.clearSelection();
      return;
    }

    const editor = this.editorInstance;
    const selection = editor.model.document.selection;

    // Collect text from ALL ranges — handles table multi-cell selections
    // (CKEditor creates one range per selected cell)
    let text = '';
    const allRanges: any[] = [];
    for (const range of selection.getRanges()) {
      if (!range.isCollapsed) {
        allRanges.push(range);
        for (const item of range.getItems()) {
          if (item.is('$text') || item.is('$textProxy')) {
            text += item.data;
          }
        }
        // Separate text from different cells with a space
        if (text.length > 0 && !text.endsWith(' ')) {
          text += ' ';
        }
      }
    }
    text = text.trim();

    // If selection is inside a table, extract as a structured markdown table
    // so the AI can understand and modify the table content properly
    if (text.length > 0 && allRanges.length > 0) {
      let tableElement: any = null;
      let node = allRanges[0].start.parent;
      while (node && !node.is?.('rootElement')) {
        if (node.name === 'table') { tableElement = node; break; }
        node = node.parent;
      }
      if (tableElement) {
        const mdTable = this.extractTableAsMarkdown(tableElement);
        if (mdTable) text = mdTable;
      }
    }

    if (text.length > 0 && allRanges.length > 0) {
      // Try to get proper text offsets — may return null for complex table selections
      let offsets = this.ckEditorService.getSelection(editor);
      if (!offsets) {
        // Fallback for table selections: synthetic offsets (marker-based approach is what matters)
        offsets = { index: 0, length: text.length };
      }
      this.selectedText = text;
      this.selectionRange = offsets;

      // Remove old yellowMarker if re-selecting (e.g., user changed selection)
      this.removeSelectionHighlight();

      // Cache the model selection as a marker so it survives focus changes
      // For multi-range (table) selections, create a spanning range
      editor.model.change((writer: any) => {
        if (editor.model.markers.has('cached-selection')) {
          writer.removeMarker('cached-selection');
        }
        const firstRange = allRanges[0];
        const lastRange = allRanges[allRanges.length - 1];
        const spanningRange = allRanges.length === 1
          ? firstRange
          : writer.createRange(firstRange.start, lastRange.end);
        writer.addMarker('cached-selection', {
          range: spanningRange, usingOperation: false, affectsData: false
        });
      });

      const positioned = this.positionFloatingToolbar();
      if (!positioned) {
        // DOM selection temporarily unavailable — bail without showing toolbar
        return;
      }
      // NOTE: Don't apply yellowMarker here. During quick_actions,
      // the native ::selection provides the visual highlight.
      // yellowMarker is applied only when focus leaves the editor
      // (enterPromptEditing / triggerToolTransform).
      this.cdr.detectChanges();
      return;
    }

    this.clearSelection();
  }

  /**
   * Reset selection state and hide floating toolbar.
   * Only resets to idle if in quick_actions state.
   * In prompt_editing/loading/preview states, preserve selection data (needed for API calls).
   */
  clearSelection(): void {
    // Don't clear selection data while user is actively working with the toolbar
    if (this.floatingToolbarState !== 'idle' && this.floatingToolbarState !== 'quick_actions') {
      return;
    }

    this.selectedText = '';
    this.selectionRange = null;
    // Remove yellowMarker highlight
    this.removeSelectionHighlight();
    if (this.floatingToolbarState === 'quick_actions') {
      this.floatingToolbarState = 'idle';
      this.floatingToolbarPosition = null;
    }
    // Remove cached-selection marker
    if (this.editorInstance?.model?.markers?.has('cached-selection')) {
      this.editorInstance.model.change((writer: any) => {
        writer.removeMarker('cached-selection');
      });
    }
    this.cdr.detectChanges();
  }

  /**
   * Position the floating toolbar BELOW the browser's current text selection,
   * relative to the .document-preview-content container.
   * Flips above if near the bottom of the container.
   */
  /**
   * Returns true if positioning succeeded, false if DOM selection was unavailable.
   * Does NOT modify floatingToolbarState on failure — caller decides what to do.
   */
  positionFloatingToolbar(): boolean {
    const domSelection = window.getSelection();
    if (!domSelection || domSelection.rangeCount === 0 || domSelection.isCollapsed) {
      return false;
    }

    const selectionRect = domSelection.getRangeAt(0).getBoundingClientRect();
    this._cachedSelectionRect = selectionRect; // Cache for repositioning in preview state

    const container = this.editorInstance?.editing?.view?.getDomRoot()?.closest('.document-preview-content');
    if (!container) {
      return false;
    }

    const containerRect = (container as HTMLElement).getBoundingClientRect();

    // Wider toolbar (prompt trigger + 4 buttons)
    const toolbarWidth = 480;
    const toolbarHeight = 42;
    const gap = 8;

    // Center horizontally on selection, clamp within container
    let left = (selectionRect.left + selectionRect.right) / 2 - containerRect.left - toolbarWidth / 2;
    left = Math.max(8, Math.min(left, containerRect.width - toolbarWidth - 8));

    // Position BELOW selection; flip above if near bottom of container
    let top = selectionRect.bottom - containerRect.top + gap;
    if (top + toolbarHeight + 20 > containerRect.height) {
      top = selectionRect.top - containerRect.top - toolbarHeight - gap;
    }

    this.floatingToolbarPosition = { top, left };
    this.floatingToolbarState = 'quick_actions';
    return true;
  }

  /**
   * Reposition the floating toolbar when entering preview state.
   * The preview panel is much taller (~300px) than the quick-actions bar (42px),
   * so we need to re-check if it fits below the selection and flip above if not.
   */
  private repositionForPreview(): void {
    const toolbarEl = document.querySelector('.floating-edit-toolbar') as HTMLElement;
    const container = this.editorInstance?.editing?.view?.getDomRoot()?.closest('.document-preview-content') as HTMLElement;
    if (!toolbarEl || !container || !this._cachedSelectionRect) return;

    const containerRect = container.getBoundingClientRect();
    const toolbarHeight = toolbarEl.offsetHeight;
    const toolbarWidth = toolbarEl.offsetWidth;
    const selectionRect = this._cachedSelectionRect;
    const gap = 8;

    let left = (selectionRect.left + selectionRect.right) / 2 - containerRect.left - toolbarWidth / 2;
    left = Math.max(8, Math.min(left, containerRect.width - toolbarWidth - 8));

    // Try below selection first
    let top = selectionRect.bottom - containerRect.top + gap;

    // If it overflows the container bottom, flip above
    if (top + toolbarHeight + 8 > containerRect.height) {
      top = selectionRect.top - containerRect.top - toolbarHeight - gap;
    }

    // If still overflows top, clamp to top of container
    if (top < 8) {
      top = 8;
    }

    this.floatingToolbarPosition = { top, left };
    this.cdr.detectChanges();
  }

  /**
   * Handle document content changes
   * Debounced to avoid disrupting text selection
   */
  onDocumentContentChanged(event: any): void {
    // Get content from CKEditor change event
    const editor = event?.editor || this.editorInstance;
    const htmlContent = editor ? editor.getData() : '';
    const plainText = editor ? this.ckEditorService.getPlainText(editor) : '';

    // Update word/page count IMMEDIATELY (fast operation, no debounce needed)
    const wordCount = this.documentGenerationService.countWords(plainText);
    const pageCount = this.documentGenerationService.estimatePageCount(wordCount);
    this.currentDocumentWordCount = wordCount;
    this.currentDocumentPageCount = pageCount;

    // Clear previous debounce timer
    if (this.contentChangeDebounce) {
      clearTimeout(this.contentChangeDebounce);
    }

    // Debounce heavier operations (state service update, TOC rebuild)
    this.contentChangeDebounce = setTimeout(() => {
      this.activeDocumentContent = htmlContent;

      // Update state service with debounced changes
      this.stateService.updateDocumentContent(
        htmlContent,
        this.currentDocumentWordCount,
        this.currentDocumentPageCount
      );

      // Rebuild TOC for drafting sidebar
      this.exhibitPanelService.buildTocFromHtml(htmlContent);
    }, 300); // 300ms debounce
  }


  /**
   * Apply custom revision to full document based on user's natural language request
   * Used when user types revision requests in the chat while in drafting mode
   */
  applyCustomRevision(userPrompt: string): void {
    if (!this.currentDocumentId || !this.activeDocumentContent) {
      // No document to revise
      return;
    }

    // Start generating state + lock editor
    this.stateService.setIsGenerating(true);
    if (this.editorInstance) {
      this.editorInstance.enableReadOnlyMode('ai-generation');
    }

    // Initialize and animate workflow steps
    this.initializeWorkflowSteps('transform');
    this.animateWorkflowSteps();

    const transformRequest = {
      documentId: this.currentDocumentId as number,
      transformationType: 'CUSTOM',
      transformationScope: 'FULL_DOCUMENT' as const,
      fullDocumentContent: this.activeDocumentContent,
      customPrompt: userPrompt, // Pass the user's custom instruction
      jurisdiction: this.selectedJurisdiction,
      documentType: this.selectedDocTypePill
    };

    this.documentGenerationService.transformDocument(transformRequest, this.currentUser?.id)
      .pipe(
        takeUntil(merge(this.destroy$, this.cancelGeneration$)),
        finalize(() => {
          this.stateService.setIsGenerating(false);
          if (this.editorInstance) {
            this.editorInstance.disableReadOnlyMode('ai-generation');
          }
          this.completeAllWorkflowSteps();
          this.stateService.setShowBottomSearchBar(true);
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          try {
            // Generate unique message ID
            const messageId = `custom_revision_${Date.now()}_${this.transformationMessageIdCounter++}`;

            // Add assistant message with inline comparison (Accept/Reject buttons)
            this.stateService.addConversationMessage({
              id: messageId,
              role: 'assistant',
              content: response.explanation || 'I\'ve applied the requested changes to your document.',
              timestamp: new Date(),
              transformationComparison: {
                oldContent: this.activeDocumentContent,
                newContent: response.transformedContent || '',
                transformationType: 'CUSTOM',
                scope: 'FULL_DOCUMENT',
                response: response
              }
            });

            this.scrollToBottom();
          } catch (innerError) {
            this.stateService.addConversationMessage({
              role: 'assistant',
              content: 'Revision complete, but there was an issue displaying the result.',
              timestamp: new Date()
            });
          }
        },
        error: (error) => {
          this.stateService.addConversationMessage({
            role: 'assistant',
            content: 'Sorry, I encountered an error applying the revision. Please try again.',
            timestamp: new Date()
          });
          this.notificationService.error('Revision Failed', 'Failed to apply document revision. Please try again.', 3000);
        }
      });
  }

  // Save and exit drafting mode
  // Save document and exit drafting mode - REAL BACKEND CALL
  saveAndExit(): void {
    if (!this.currentDocumentId) {
      this.notificationService.warning('No Document', 'No document to save. Please generate a document first.');
      return;
    }

    // Convert HTML content to markdown before saving
    const markdownContent = this.documentGenerationService.convertHtmlToMarkdown(this.activeDocumentContent);

    // Call backend to save document
    this.documentGenerationService.saveDocument(
      this.currentDocumentId,
      markdownContent,
      this.activeDocumentTitle
    )
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (response) => {
        this.documentMetadata.lastSaved = new Date();

        this.notificationService.success('Saved!', 'Document saved successfully');

        // Exit drafting mode
        this.stateService.setDraftingMode(false);
        this.stateService.setShowBottomSearchBar(true);
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.notificationService.error('Save Failed', 'Failed to save document. Please try again.', 3000);
      }
    });
  }

  // Download document from split-view (drafting mode) - REAL BACKEND CALL
  downloadDocument(format: 'docx' | 'pdf'): void {
    if (!this.currentDocumentId) {
      this.notificationService.warning('No Document', 'No document to download. Please generate a document first.');
      return;
    }

    // Call backend export service
    this.documentGenerationService.exportDocument(this.currentDocumentId, format)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Extract blob from HTTP response
          const blob = response.body;
          if (!blob) {
            this.notificationService.error('Export Failed', 'Failed to export document. Please try again.', 3000);
            return;
          }

          // Extract filename from Content-Disposition header
          // Falls back to a sanitized version of the document title if header not found
          const fallbackFilename = `${this.activeDocumentTitle}.${format}`;
          const filename = this.extractFilenameFromHeader(response.headers, fallbackFilename);

          // Create download link
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();

          // Cleanup
          setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
          }, 100);

          this.notificationService.success('Downloaded!', `${filename} downloaded successfully`);
        },
        error: (error) => {
          this.notificationService.error('Export Failed', 'Failed to export document. Please try again.', 3000);
        }
      });
  }

  // Download document by ID (shared method) - kept for backward compatibility
  private downloadDocumentById(documentId: string, format: 'docx' | 'pdf'): void {
    this.currentDocumentId = documentId;
    this.downloadDocument(format);
  }

  /**
   * Extract filename from Content-Disposition header
   * Parses: Content-Disposition: attachment; filename="Motion_to_Dismiss.pdf"
   * Returns the filename or a fallback if not found
   */
  private extractFilenameFromHeader(headers: any, fallbackName: string): string {
    try {
      const contentDisposition = headers.get('Content-Disposition');

      if (!contentDisposition) {
        return fallbackName;
      }

      // Method 1: Try filename*=UTF-8'' format (our backend's format)
      // Example: filename*=UTF-8''Demand_Letter_TO_Insurance_Carrier.pdf
      if (contentDisposition.includes("filename*=UTF-8''")) {
        const parts = contentDisposition.split("filename*=UTF-8''");
        if (parts.length > 1) {
          // Get everything after filename*=UTF-8'' until semicolon or end
          const encoded = parts[1].split(';')[0].trim();
          const filename = decodeURIComponent(encoded);
          return filename;
        }
      }

      // Method 2: Try standard filename="..." format
      // Example: filename="document.pdf"
      if (contentDisposition.includes('filename=')) {
        const match = contentDisposition.match(/filename="([^"]+)"/);
        if (match && match[1]) {
          let filename = match[1];

          // Decode RFC 2047 Q-encoding if present (=?UTF-8?Q?...?=)
          if (filename.startsWith('=?UTF-8?Q?') && filename.endsWith('?=')) {
            filename = filename.substring(10, filename.length - 2);
            filename = decodeURIComponent(filename.replace(/=/g, '%'));
          }

          return filename;
        }
      }

      return fallbackName;
    } catch {
      // Error handled silently
      return fallbackName;
    }
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
    this.stateService.clearFollowUpQuestions();

    // Add user message to chat view
    const userMsg = {
      role: 'user' as 'user',
      content: this.followUpMessage,
      timestamp: new Date()
    };
    this.stateService.addConversationMessage(userMsg);

    const userMessage = this.followUpMessage;
    this.followUpMessage = '';
    this.stateService.setShowBottomSearchBar(false);

    // Get active conversation and also update its messages array
    const activeConv = this.stateService.getConversations().find(c => c.id === this.stateService.getActiveConversationId());
    if (activeConv) {
      activeConv.messages.push(userMsg);
      activeConv.messageCount = (activeConv.messageCount || 0) + 1;
    }

    // DRAFTING MODE: Apply changes directly to the document
    // Check multiple conditions to detect if we're in document editing mode
    const isEditorVisible = this.showEditor && this.editorInstance !== null;
    const hasDocumentId = this.currentDocumentId !== null && this.currentDocumentId !== undefined;

    // Check content from multiple sources - activeDocumentContent OR directly from CKEditor
    const editorContent = this.editorInstance ? this.ckEditorService.getPlainText(this.editorInstance).trim() : '';
    const hasContent = (this.activeDocumentContent && this.activeDocumentContent.trim().length > 0) ||
                       (editorContent.length > 0);

    const hasDocumentOpen = isEditorVisible && hasDocumentId && hasContent;

    // If we have a document open in the editor, treat follow-up messages as revisions
    if (hasDocumentOpen) {
      // Ensure activeDocumentContent is synced from CKEditor if it's empty
      if (!this.activeDocumentContent && this.editorInstance) {
        this.activeDocumentContent = this.editorInstance!.getData();
      }

      this.applyCustomRevision(userMessage);
      return;
    }

    if (!activeConv || !activeConv.backendConversationId) {
      // No active conversation and not in drafting mode
      this.stateService.setIsGenerating(true);
      setTimeout(() => {
        this.stateService.addConversationMessage({
          role: 'assistant',
          content: `I understand you'd like to: "${userMessage}". Please generate a document first to apply revisions.`,
          timestamp: new Date()
        });
        this.stateService.setIsGenerating(false);
        this.stateService.setShowBottomSearchBar(true);
      }, 1000);
      return;
    }

    // Send message to backend conversation
    this.stateService.setIsGenerating(true);
    const researchMode = this.selectedResearchMode;

    // Initialize and animate workflow steps for the active task
    if (this.activeTask === 'question') {
      // Follow-up messages always have conversation history
      const questionType = this.classifyQuestion(userMessage, true);
      this.initializeWorkflowSteps(questionType);
    } else {
      this.initializeWorkflowSteps(this.activeTask);
    }
    // Capture conversation ID at request time to prevent race condition
    const requestConversationId = this.stateService.getActiveConversationId();
    const requestBackendId = activeConv.backendConversationId;

    // Use SSE for real-time progress instead of timer animation
    this.connectWorkflowSSE(requestBackendId);

    // Register background task for follow-up message
    const taskId = this.backgroundTaskService.registerTask(
      'question',
      activeConv.title || 'Follow-up Question',
      `Follow-up: ${userMessage.substring(0, 50)}...`,
      { conversationId: requestConversationId!, backendConversationId: requestBackendId, researchMode: researchMode as 'FAST' | 'THOROUGH' }
    );
    this.backgroundTaskService.startTask(taskId);

    // Subscribe WITHOUT takeUntil(destroy$) so it continues in background
    const subscription = this.legalResearchService.sendMessageToConversation(
      requestBackendId,
      userMessage,
      this.selectedJurisdiction
    )
      .pipe(takeUntil(this.cancelGeneration$))
      .subscribe({
        next: (message) => {
          // Complete the background task with result
          this.backgroundTaskService.completeTask(taskId, message);

          // Only update UI if THIS conversation is still active (prevents race condition)
          if (this.stateService.getActiveConversationId() === requestConversationId) {
            // Complete all workflow steps
            this.completeAllWorkflowSteps();

            // Detect error responses from backend (modelUsed === "error")
            const isErrorResponse = message.modelUsed === 'error';

            if (isErrorResponse) {
              // Show error message with retry button
              this.stateService.addConversationMessage({
                role: 'assistant',
                content: message.content,
                isError: true,
                retryMessage: userMessage
              } as any);
              this.stateService.setIsGenerating(false);
              this.stateService.setShowBottomSearchBar(true);
              this.cdr.detectChanges();
              return;
            }

            // Extract follow-up questions and remove section from content
            const cleanedContent = this.extractAndRemoveFollowUpQuestions(message.content);

            // Add assistant message to chat view
            const assistantMessage: any = {
              role: 'assistant' as 'assistant',
              content: cleanedContent,
              timestamp: new Date(message.createdAt || new Date()),
              id: message.id,
              bookmarked: message.bookmarked || false
            };
            this.stateService.addConversationMessage(assistantMessage);

            // ALSO update the conversation object in sidebar for message count badge
            const conv = this.stateService.getConversations().find(c => c.id === requestConversationId);
            if (conv) {
              conv.messages.push(assistantMessage);
              conv.messageCount = (conv.messageCount || 0) + 1;
              // Force change detection to update badge
              this.cdr.detectChanges();
            }

            this.stateService.setIsGenerating(false);
            this.stateService.setShowBottomSearchBar(true);
            this.cdr.detectChanges();
          } else {
            this.stateService.setIsGenerating(false);
          }
        },
        error: (error) => {
          // Extract the actual error message from backend response
          const backendMessage = error?.error?.message || error?.message || '';
          const displayMessage = backendMessage && !backendMessage.includes('Failed to process query')
            ? backendMessage
            : 'Sorry, I encountered an error processing your message. Please try again.';

          // Fail the background task
          this.backgroundTaskService.failTask(taskId, backendMessage || 'Failed to send message');

          // Mark workflow as error
          if (this.stateService.getWorkflowSteps().length > 0) {
            const steps = this.stateService.getWorkflowSteps(); if (steps.length > 0) this.stateService.updateWorkflowStep(steps[steps.length - 1].id, { status: 'error' as any });
          }

          this.stateService.addConversationMessage({
            role: 'assistant',
            content: displayMessage,
            isError: true,
            retryMessage: userMessage
          } as any);
          this.stateService.setIsGenerating(false);
          this.stateService.setShowBottomSearchBar(true);
          this.cdr.detectChanges();
        }
      });

    // Store subscription for cleanup
    this.backgroundTaskService.storeSubscription(taskId, subscription);
  }

  // Retry a failed message by re-sending the original query
  retryErrorMessage(retryMessage: string): void {
    if (!retryMessage?.trim()) return;
    this.followUpMessage = retryMessage;
    this.sendFollowUpMessage();
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
    const message = this.stateService.getConversationMessages().find(
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
    const message = this.stateService.getConversationMessages().find(
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
    
    // Update the message content
    const message = this.stateService.getConversationMessages().find(
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
      }

  // Delete draft
  deleteDraft(draft: any): void {
    // TODO: Implement draft deletion
      }

  // Execute suggested action
  executeSuggestedAction(action: string, documentId?: string | number): void {
    
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
        this.stateService.addConversationMessage({
          role: 'user',
          content: 'Please summarize the case authority used in this document.',
          timestamp: new Date()
        });

        // Simulate AI response
        this.stateService.setIsGenerating(true);
        setTimeout(() => {
          this.stateService.addConversationMessage({
            role: 'assistant',
            content: `I've analyzed the case authority in your document. Here's a summary:\n\n**Primary Cases Referenced:**\n\n1. *Smith v. Jones* (2020) - Established the legal standard for...\n2. *Doe v. Corporation* (2019) - Precedent for contract interpretation...\n\nThese cases support your main arguments regarding liability and damages.`
          });
          this.stateService.setIsGenerating(false);
          this.stateService.setShowBottomSearchBar(true);
        }, 2000);
        break;

      default:
        // Unknown action - handled silently
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
      case 'workflow':
        return 'Example cases you can summarize:';
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
      case 'workflow':
        return [
          'Summarize recent Supreme Court decisions on intellectual property',
          'Provide an overview of landmark employment discrimination cases',
          'Analyze trends in contract interpretation over the past 5 years'
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
      case 'workflow':
        return ['Key holdings', 'Citations', 'Analysis'];
      default:
        return [];
    }
  }

  // Extract follow-up questions from AI response and remove section from markdown (matching case-research component)
  extractAndRemoveFollowUpQuestions(response: string): string {
    this.stateService.clearFollowUpQuestions();

    // Look for "## Follow-up Questions" markdown heading (like case-research component)
    const followUpPattern = /##\s*Follow-up Questions\s*\n([\s\S]*?)(?=\n##|$)/i;
    const match = response.match(followUpPattern);

    if (match) {
      const questionsSection = match[1];

      // Extract questions from list items (- or • or * or numbered)
      const questionMatches = questionsSection.match(/[-•*]\s*(.+?)(?=\n[-•*]|\n\d+\.|\n|$)/g) ||
                             questionsSection.match(/\d+\.\s*(.+?)(?=\n\d+\.|\n|$)/g);

      if (questionMatches) {
        const questions = questionMatches
          .map(q => q.replace(/^[-•*\d+\.]\s*/, '').trim())
          .map(q => q.replace(/\*\*/g, '')) // Remove bold markdown
          .map(q => q.replace(/<[^>]*>/g, '')) // Strip any residual HTML tags
          .filter(q => q.length > 0)
          .filter(q => this.isValidFollowUpQuestion(q)) // Validate question quality
          .slice(0, 3); // Limit to 3 questions

        this.stateService.setFollowUpQuestions(questions);
      }

      // Remove the entire "Follow-up Questions" section from the response
      return response.replace(followUpPattern, '').trim();
    }

    return response;
  }

  isValidFollowUpQuestion(question: string): boolean {
    // Reject questions under 40 characters (likely fragments)
    if (question.length < 40) {
      return false;
    }

    // Reject questions that are just punctuation or symbols
    const onlyPunctuation = /^[\s\-\.\?\!,;:]+$/;
    if (onlyPunctuation.test(question)) {
      return false;
    }

    // Require questions to have action verbs or question words
    const hasQuestionIndicators = /\b(find|does|what|how|can|should|is|are|will|would|could|may|might|has|have|when|where|which|who|why)\b/i;
    if (!hasQuestionIndicators.test(question)) {
      return false;
    }

    // Valid question
    return true;
  }

  // Ask a follow-up question
  askFollowUpQuestion(question: string): void {
    if (!question || this.stateService.getIsGenerating()) return;

    // Set the follow-up message and send it
    this.followUpMessage = question;
    this.sendFollowUpMessage();
  }

  // ========================================
  // VERSION HISTORY METHODS (PHASE 2)
  // ========================================

  /**
   * Toggle the version history slide-in panel.
   * Closes the exhibit panel when opening (mutually exclusive).
   */
  toggleVersionHistory(): void {
    const isCurrentlyOpen = this.stateService.getShowVersionHistory();
    if (!isCurrentlyOpen) {
      // Close exhibit panel & chat — mutually exclusive with version history
      this.exhibitPanelService.closePanel();
      this.loadVersionHistory();
    }
    this.stateService.setShowVersionHistory(!isCurrentlyOpen);
  }

  /**
   * Close the version history panel (called from template).
   */
  closeVersionHistory(): void {
    this.stateService.setShowVersionHistory(false);
    this.exitVersionPreview();
  }

  /**
   * Preview a specific version in the editor (read-only mode).
   */
  previewVersion(version: any): void {
    this.previewingVersion = version;
    if (this.editorInstance) {
      const content = version.contentHtml || version.content || '';
      this.setCKEditorContentFromMarkdown(content);
      this.editorInstance.enableReadOnlyMode('version-preview');
    }
    this.cdr.detectChanges();
  }

  /**
   * Exit version preview and restore current document content.
   */
  exitVersionPreview(): void {
    this.previewingVersion = null;
    if (this.editorInstance) {
      this.editorInstance.disableReadOnlyMode('version-preview');
      const doc = this.stateService.getCurrentDocument();
      if (doc?.content) {
        this.setCKEditorContentFromMarkdown(doc.content);
      }
    }
    this.cdr.detectChanges();
  }

  /**
   * Load version history from backend (for dropdown)
   */
  loadVersionHistory(): void {
    if (!this.currentDocumentId) return;

    // Skip loading for mock documents
    if (typeof this.currentDocumentId === 'string' && this.currentDocumentId.startsWith('mock-doc-')) {
            this.documentVersions = [];
      return;
    }

    this.loadingVersions = true;
    this.cdr.detectChanges();

    // Call API to get versions (limit to 10 most recent)
    this.documentGenerationService.getDocumentVersions(this.currentDocumentId as number, this.currentUser?.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (versions) => {
          // Show only last 10 versions for dropdown
          this.documentVersions = versions.slice(0, 10);
          this.loadingVersions = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.notificationService.error('Error', 'Failed to load version history');
          this.loadingVersions = false;
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Restore version with confirmation dialog (called from dropdown)
   */
  restoreVersionWithConfirmation(version: any): void {
    // Don't allow restoring current version
    if (version.versionNumber === this.documentMetadata.version) {
      return;
    }

    this.restoreVersion(version.versionNumber);
  }

  /**
   * Restore a previous version (creates new version with old content)
   */
  restoreVersion(versionNumber: number): void {
    this.notificationService.confirm(
      'Restore Version?',
      `This will restore version ${versionNumber} as the current version. Current changes will be saved as a new version.`,
      'Restore',
      'Cancel'
    ).then((result) => {
      if (result.isConfirmed && this.currentDocumentId && this.currentUser) {
        this.documentGenerationService.restoreVersion(this.currentDocumentId as number, versionNumber, this.currentUser.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (restoredVersion) => {
              // Update document state with restored version
              this.activeDocumentContent = restoredVersion.content;
              this.documentMetadata.version = restoredVersion.versionNumber;
              this.currentVersionNumber = restoredVersion.versionNumber;
              this.currentDocumentWordCount = restoredVersion.wordCount;
              this.currentDocumentPageCount = this.documentGenerationService.estimatePageCount(restoredVersion.wordCount);

              this.stateService.addConversationMessage({
                role: 'assistant',
                content: `Restored version ${versionNumber} as version ${restoredVersion.versionNumber}.`,
                timestamp: new Date()
              });

              // Reload version history to show updated list
              this.loadVersionHistory();

              // Update CKEditor with restored content
              setTimeout(() => {
                this.setCKEditorContentFromMarkdown(restoredVersion.content);

                // Ensure editor is editable
                if (this.editorInstance) {
                  this.ckEditorService.enable(this.editorInstance);
                }
              }, 100);

              this.notificationService.success('Version Restored', `Version ${versionNumber} restored as v${restoredVersion.versionNumber}`);

              this.cdr.detectChanges();
            },
            error: (error) => {
              this.notificationService.error('Restore Failed', 'Failed to restore version');
            }
          });
      }
    });
  }

  /**
   * Save manual version with custom note
   */
  saveManualVersion(): void {
    if (!this.currentDocumentId || !this.documentEditor || !this.currentUser) {
      this.notificationService.error('Error', 'Document not available for saving');
      return;
    }

    // Prompt user for version note
    this.notificationService.prompt(
      'Save Version',
      'Add a note to describe this version (optional)',
      'e.g., Added new section on liability'
    ).then((note) => {
      if (note !== null) {
        const versionNote = note || 'Manual edit';

        // Get current content from CKEditor and convert to markdown
        const htmlContent = this.editorInstance!.getData();
        const markdownContent = this.documentGenerationService.convertHtmlToMarkdown(htmlContent);

        // Call service to save manual version
        this.documentGenerationService.saveManualVersion(
          this.currentDocumentId as number,
          this.currentUser.id,
          markdownContent,
          versionNote
        )
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            // Update version number
            this.documentMetadata.version = response.versionNumber;

            // Show success message
            this.notificationService.success('Version Saved', `Saved as version ${response.versionNumber}`);

            // Reload version history if it's open
            if (this.stateService.getShowVersionHistory()) {
              this.loadVersionHistory();
            }

            this.cdr.detectChanges();
          },
          error: () => {
            this.notificationService.error('Save Failed', 'Failed to save version');
          }
        });
      }
    });
  }

  /**
   * Quick save document without prompting for a note.
   * Used by the toolbar Save button for frictionless saving.
   */
  saveDocumentManually(): void {
    if (!this.currentDocumentId || !this.editorInstance || !this.currentUser) {
      this.notificationService.warning('Cannot Save', 'No document available to save.');
      return;
    }

    this.isSaving = true;

    // For template docs, save CKEditor's HTML directly (preserves user edits).
    // Use <!-- CKEDITOR_HTML --> marker so it reloads as HTML, not markdown.
    // The originalTemplateHtml stays separate for PDF export (pristine formatting).
    let contentToSave: string;
    if (this.originalTemplateHtml) {
      const htmlContent = this.editorInstance.getData();
      contentToSave = '<!-- CKEDITOR_HTML -->\n' + htmlContent;
    } else {
      const htmlContent = this.editorInstance.getData();
      contentToSave = this.documentGenerationService.convertHtmlToMarkdown(htmlContent);
    }

    this.documentGenerationService.saveManualVersion(
      this.currentDocumentId as number,
      this.currentUser.id,
      contentToSave,
      'Manual save'
    )
    .pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isSaving = false;
        this.cdr.detectChanges();
      })
    )
    .subscribe({
      next: (response) => {
        this.documentMetadata.version = response.versionNumber;
        this.currentVersionNumber = response.versionNumber;
        this.documentMetadata.lastSaved = new Date();
        this.notificationService.success('Saved', `Version ${response.versionNumber} saved`, 1500);
        if (this.stateService.getShowVersionHistory()) {
          this.loadVersionHistory();
        }
      },
      error: (error) => {
        this.notificationService.error('Save Failed', 'Failed to save document');
      }
    });
  }

  /**
   * Accept pending AI changes (legacy — delegates to finalize).
   */
  acceptPendingChanges(): void {
    this.finalizePendingChanges(true);
  }

  /**
   * Undo pending AI changes: restore original content, dismiss status bar.
   */
  undoPendingChanges(): void {
    if (!this.pendingChanges || this.pendingChanges.isUndone) return;

    // Clear auto-dismiss timer
    if (this.pendingChangesAutoTimer) {
      clearTimeout(this.pendingChangesAutoTimer);
      this.pendingChangesAutoTimer = null;
    }

    const originalContent = this.pendingChanges.originalContent;

    // Restore original content to CKEditor (use !== undefined to handle empty strings)
    if (this.editorInstance && originalContent !== undefined) {
      this._applyingPendingChange = true;
      this.editorInstance.setData(originalContent);
      this._applyingPendingChange = false;
      this.activeDocumentContent = originalContent;

      // Recalculate word count
      const plainText = this.ckEditorService.getPlainText(this.editorInstance);
      this.currentDocumentWordCount = this.documentGenerationService.countWords(plainText);
      this.currentDocumentPageCount = this.documentGenerationService.estimatePageCount(this.currentDocumentWordCount);
    }

    // Toggle to undone state (preserve for redo)
    this.pendingChanges.isUndone = true;
    this.notificationService.info('Changes Reverted', 'Original content restored', 1500);
    this.cdr.detectChanges();
  }

  /**
   * Redo pending AI changes: re-apply the transformed content.
   */
  redoPendingChanges(): void {
    if (!this.pendingChanges || !this.pendingChanges.isUndone) return;

    if (this.pendingChangesAutoTimer) {
      clearTimeout(this.pendingChangesAutoTimer);
      this.pendingChangesAutoTimer = null;
    }

    if (this.editorInstance && this.pendingChanges.transformedContent) {
      this._applyingPendingChange = true;
      this.editorInstance.setData(this.pendingChanges.transformedContent);
      this._applyingPendingChange = false;
      this.activeDocumentContent = this.pendingChanges.transformedContent;
      const plainText = this.ckEditorService.getPlainText(this.editorInstance);
      this.currentDocumentWordCount = this.documentGenerationService.countWords(plainText);
      this.currentDocumentPageCount = this.documentGenerationService.estimatePageCount(this.currentDocumentWordCount);
    }

    this.pendingChanges.isUndone = false;

    // Re-apply exhibit highlights if this was an exhibit incorporation
    if (this.pendingChanges.type === 'exhibit references added') {
      this.highlightExhibitReferences();
    }

    this.notificationService.info('Changes Reapplied', 'AI changes restored', 1500);
    this.cdr.detectChanges();
  }

  /**
   * Dismiss the status bar — silently accept and save. Called by X button or auto-dismiss timer.
   */
  dismissPendingChanges(): void {
    this.finalizePendingChanges(false);
  }

  /**
   * Shared logic: remove highlights, save version to DB, clear pending state.
   * @param showToast Whether to show a success notification.
   */
  private finalizePendingChanges(showToast: boolean): void {
    if (!this.pendingChanges) return;

    // If changes were undone, just clear the status bar — don't save original content as a new version
    const wasUndone = this.pendingChanges.isUndone;

    // Clear auto-dismiss timer
    if (this.pendingChangesAutoTimer) {
      clearTimeout(this.pendingChangesAutoTimer);
      this.pendingChangesAutoTimer = null;
    }

    const changeType = this.pendingChanges.type;
    const response = this.pendingChanges.response;

    // Remove highlights
    if (this.editorInstance) {
      this.ckEditorService.removeAllHighlights(this.editorInstance);
    }

    // Update metadata from response
    if (response) {
      if (response.newVersion) this.documentMetadata.version = response.newVersion;
      if (response.tokensUsed) {
        this.documentMetadata.tokensUsed = (this.documentMetadata.tokensUsed || 0) + response.tokensUsed;
      }
    }

    // Sync activeDocumentContent with current CKEditor state
    if (this.editorInstance) {
      this.activeDocumentContent = this.editorInstance.getData();
      const plainText = this.ckEditorService.getPlainText(this.editorInstance);
      this.currentDocumentWordCount = this.documentGenerationService.countWords(plainText);
      this.currentDocumentPageCount = this.documentGenerationService.estimatePageCount(this.currentDocumentWordCount);
    }

    // Save version to DB (skip if changes were undone — nothing new to save)
    if (!wasUndone && this.currentDocumentId && this.currentUser && this.editorInstance) {
      const htmlContent = this.editorInstance.getData();
      const markdownContent = this.documentGenerationService.convertHtmlToMarkdown(htmlContent);
      const label = this.getTransformationLabel(changeType.toUpperCase());

      this.documentGenerationService.saveManualVersion(
        this.currentDocumentId as number,
        this.currentUser.id,
        markdownContent,
        `Applied ${label}`
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (saveResponse) => {
          if (saveResponse?.versionNumber) {
            this.documentMetadata.version = saveResponse.versionNumber;
          }
          this.documentMetadata.lastSaved = new Date();
        },
        error: () => {
          if (showToast) {
            this.notificationService.error('Save Failed', 'Changes applied but failed to save');
          }
        }
      });
    }

    // Clear pending state
    this.pendingChanges = null;
    if (showToast) {
      this.notificationService.success('Changes Accepted', 'Transformation saved', 1500);
    }
    this.cdr.detectChanges();
  }

  /**
   * Start auto-dismiss timer for the change status bar.
   * Auto-saves changes after 10 seconds if user doesn't undo.
   */
  private normalizeHtml(html: string): string {
    return html.replace(/\s+/g, ' ').trim();
  }

  private startPendingChangesAutoTimer(durationMs: number = 10000): void {
    if (this.pendingChangesAutoTimer) {
      clearTimeout(this.pendingChangesAutoTimer);
    }
    this.pendingChangesAutoTimer = setTimeout(() => {
      this.dismissPendingChanges();
    }, durationMs);
  }

  /**
   * Detect if a user prompt is asking for fabricated, fake, or sample data.
   * Used as a frontend guard to prevent unnecessary API calls and protect document integrity.
   */
  private isFabricationRequest(prompt: string): boolean {
    const lower = prompt.toLowerCase();
    // Allow legitimate requests for real/actual/case data
    if (/\b(real|actual|genuine|existing|case)\s+(data|values?|amounts?|info)\b/.test(lower) &&
        !/\b(real[\s-]?looking|realistic[\s-]?looking)\b/.test(lower)) {
      return false;
    }
    const fabricationPatterns = [
      /\b(fake|dummy|mock|sample|test)\s+(data|values?|amounts?|numbers?|names?|dates?|info)/,
      /\b(made[\s-]?up|fabricat|imaginar|fictitiou|invented)\b/,
      /\b(real[\s-]?looking|realistic[\s-]?looking)\s+(data|values?|amounts?|numbers?|names?)/,
      /\bfill\s+(in\s+)?(with\s+)?(fake|random|sample|dummy|made[\s-]?up)/,
      /\b(add|insert|put|use)\s+(some\s+)?(fake|random|sample|dummy|made[\s-]?up|test)\b/,
      /\b(add|insert|put|use)\s+(some\s+)?(more\s+)?(fake|random|sample|dummy|test)\b/,
      /\b(add|insert|generate|create)\s+(some\s+)?(real[\s-]?looking|realistic)\s+(fake\s+)?data\b/,
      /\brandom\s+(data|values?|amounts?|numbers?|names?)\b/,
    ];
    return fabricationPatterns.some(pattern => pattern.test(lower));
  }

  /**
   * Detect if an AI response is commentary/explanation rather than a real document revision.
   * Uses three layers of defense:
   *   1. Structured [AI_NOTE]/[DOCUMENT] markers (best case — AI followed instructions)
   *   2. Heuristic first-line pattern matching (catches common conversational openers)
   *   3. Structural comparison against original content (catches format-destroying responses)
   *
   * @param content      The AI's raw response
   * @param originalHtml The original editor HTML content (for structural comparison)
   */
  private extractAiNoteFromResponse(
    content: string,
    originalHtml?: string
  ): { aiNote: string | null; documentContent: string | null } {
    if (!content) return { aiNote: null, documentContent: null };

    const trimmed = content.trim();

    // 1. Structured approach: check for [AI_NOTE] ... [DOCUMENT] markers
    if (trimmed.startsWith('[AI_NOTE]')) {
      const docMarkerIdx = trimmed.indexOf('[DOCUMENT]');
      if (docMarkerIdx !== -1) {
        const note = trimmed.substring('[AI_NOTE]'.length, docMarkerIdx).trim();
        const doc = trimmed.substring(docMarkerIdx + '[DOCUMENT]'.length).trim();
        return { aiNote: note, documentContent: doc || null };
      }
      return { aiNote: trimmed.substring('[AI_NOTE]'.length).trim(), documentContent: null };
    }

    // 2. Heuristic fallback: detect conversational/explanatory first-line openers
    const conversationalPatterns = [
      /^I (need to|cannot|can't|don't|do not|am unable|should|must|want to|'m unable|have to|apologize)/i,
      /^(Unfortunately|Please note|Important note|Note:|Disclaimer)/i,
      /^(As an AI|As a language model|I'm an AI)/i,
      /^(I need to be transparent|I should be transparent|To be transparent)/i,
      /^(I'm sorry|I apologize|My apologies)/i,
      /^(Sure|Certainly|Of course|Absolutely)[,!.\s]/i,
      /^(I've|I have) (made|applied|completed|revised|updated|reviewed)/i,
      /^(Here's|Here is) (a revised|the revised|the updated|the modified|my revised)/i,
      /^(Please be aware|Please understand)/i,
      /^\[\s*(Based on|Note|Important|Regarding|In this|According|The document)/i,
      /^The (only|available|existing|current|following|document|provided)/i,
      /^(There is no|There are no|There isn't|There aren't|No (specific|actual|real|concrete))/i,
      /^(Based on|According to|From the|Looking at|After reviewing|Upon review)/i,
      /^(This (table|section|document|content) (does not|doesn't|cannot|can't))/i,
    ];

    const first200 = trimmed.substring(0, 200);
    const isConversational = conversationalPatterns.some(pattern => pattern.test(first200));

    if (isConversational) {
      // Check if the AI prefaced with a sentence then included the actual document
      const newlineSplit = trimmed.indexOf('\n\n');
      if (newlineSplit !== -1 && newlineSplit < 300) {
        const preamble = trimmed.substring(0, newlineSplit).trim();
        const remainder = trimmed.substring(newlineSplit + 2).trim();
        // Only split if remainder looks like actual document content
        // (contains structural markers like tables, headings, or HTML block elements)
        const hasDocumentStructure = /^\s*\|.*\|\s*$/m.test(remainder) ||  // markdown table row (pipes at line boundaries)
                                      /^#{1,6}\s/m.test(remainder) ||      // markdown headings
                                      /<(h[1-6]|table|figure|ul|ol|p)\b/i.test(remainder); // HTML
        if (remainder.length > preamble.length * 2 && hasDocumentStructure) {
          return { aiNote: preamble, documentContent: remainder };
        }
      }
      // Entire response is conversational/explanatory — no document content
      return { aiNote: trimmed, documentContent: null };
    }

    // 3. Structural comparison: if original had rich formatting but response is flat text, reject
    if (originalHtml && originalHtml.length > 500) {
      const originalHeadings = (originalHtml.match(/<h[1-6][^>]*>/gi) || []).length;
      const originalParagraphs = (originalHtml.match(/<p[^>]*>/gi) || []).length;
      const originalLists = (originalHtml.match(/<li[^>]*>/gi) || []).length;

      // If original was a structured document (has headings/paragraphs)
      if (originalHeadings >= 2 || originalParagraphs >= 5) {
        // Check if response preserves structure (contains markdown headings or HTML tags)
        const responseHeadings = (trimmed.match(/^#{1,6}\s/gm) || []).length + (trimmed.match(/<h[1-6][^>]*>/gi) || []).length;
        const responseParagraphs = (trimmed.match(/<p[^>]*>/gi) || []).length;
        const responseNewlines = (trimmed.match(/\n\n/g) || []).length;

        // Response has no structure markers at all — likely flattened/corrupted
        const hasNoStructure = responseHeadings === 0 && responseParagraphs === 0 && responseNewlines < 3;

        if (hasNoStructure) {
          // AI response appears to have lost document structure — treating as commentary
          return {
            aiNote: 'The AI returned a response that would destroy the document\'s formatting and structure. The original document has been preserved.',
            documentContent: null
          };
        }
      }
    }

    // Passed all checks — return content as-is
    return { aiNote: null, documentContent: content };
  }

  /**
   * Convert AI-generated exhibit references into clickable HTML links.
   * Matches patterns like:
   *   [Exhibit A, p.3]  [Exhibit B]  [Exhibit AA]
   *   (See Exhibit A, p.3)  (Exhibit C, p. 12)  (Exhibit B)
   *
   * Already-converted references (inside <a> tags) are skipped to avoid double-conversion.
   */
  private convertExhibitReferences(html: string): string {
    if (!html) return html;

    // Skip content inside existing <a> tags to avoid double-wrapping.
    // Split the HTML into: inside-a-tag segments vs outside segments.
    // Only process the outside segments.
    const parts = html.split(/(<a\b[^>]*>.*?<\/a>)/gi);

    return parts.map(part => {
      // If this part is already an <a> tag, leave it untouched
      if (/^<a\b/i.test(part)) return part;

      // Match [Exhibit X] or [Exhibit X, p.Y]
      let processed = part.replace(
        /\[(Exhibit\s+([A-Z]{1,3})(?:,?\s*p\.?\s*(\d+))?)\]/gi,
        (_match, fullRef, label, page) => {
          const pageAttr = page ? ` data-page="${page}"` : '';
          return `<a class="exhibit-ref" data-exhibit="${label.toUpperCase()}"${pageAttr} title="Open ${fullRef}">[${fullRef}]</a>`;
        }
      );

      // Match (See Exhibit X, p.Y) or (Exhibit X, p.Y) or (See Exhibit X) or (Exhibit X)
      processed = processed.replace(
        /\((See\s+)?(Exhibit\s+([A-Z]{1,3})(?:,?\s*p\.?\s*(\d+))?)\)/gi,
        (_match, seePrefix, fullRef, label, page) => {
          const pageAttr = page ? ` data-page="${page}"` : '';
          const displayPrefix = seePrefix || '';
          return `<a class="exhibit-ref" data-exhibit="${label.toUpperCase()}"${pageAttr} title="Open ${fullRef}">(${displayPrefix}${fullRef})</a>`;
        }
      );

      return processed;
    }).join('');
  }

  /**
   * Open an exhibit by its label (e.g. "A", "B", "AA") from a clickable reference.
   * Finds the matching exhibit in the panel service and opens it at the specified page.
   */
  private openExhibitByLabel(label: string, page: number = 1): void {
    const exhibits = this.exhibitPanelService.exhibitListSnapshot;
    const exhibit = exhibits.find(e =>
      e.label.toUpperCase() === label.toUpperCase() ||
      e.label.toUpperCase() === `EXHIBIT ${label.toUpperCase()}`
    );
    if (exhibit) {
      // Reuse openExhibitFromSidebar which handles blob URL fetching
      this.openExhibitFromSidebar(exhibit);
      if (page > 1) {
        this.exhibitPanelService.setPage(page);
      }
    } else {
      this.notificationService.info('Exhibit Not Found', `Exhibit ${label} is not attached to this document.`, 2500);
    }
  }

  /**
   * Show an AI explanation/note in a SweetAlert modal without modifying the document.
   */
  private showAiNoteModal(note: string): void {
    // Convert basic markdown to HTML for readable display
    // First HTML-escape, then apply safe markdown transforms
    let html = note
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    // Bold: **text** or __text__
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic: *text* or _text_ (but not inside words)
    html = html.replace(/(?<!\w)\*([^*]+?)\*(?!\w)/g, '<em>$1</em>');
    html = html.replace(/(?<!\w)_([^_]+?)_(?!\w)/g, '<em>$1</em>');

    // Bullet lists: lines starting with - or *
    html = html.replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul style="margin: 8px 0; padding-left: 20px;">$&</ul>');

    // Numbered lists: lines starting with 1. 2. etc.
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

    // Line breaks for remaining newlines
    html = html.replace(/\n/g, '<br>');

    // Clean up double <br> after list items
    html = html.replace(/<\/ul><br>/g, '</ul>');
    html = html.replace(/<\/li><br>/g, '</li>');

    import('sweetalert2').then(Swal => {
      // Delay opening to ensure any pending Enter key repeat events have been
      // fully processed — otherwise SweetAlert auto-focuses the confirm button
      // and an Enter repeat immediately closes the modal
      setTimeout(() => {
        Swal.default.fire({
          html: `
            <div class="ai-note-header">
              <img src="/assets/images/new-legal-ai.gif" alt="AI" class="ai-note-avatar">
              <div class="ai-note-title-group">
                <span class="ai-note-title">Legience Assistant</span>
                <span class="ai-note-badge">NOTE</span>
              </div>
            </div>
            <div class="ai-note-card">
              <div class="ai-note-body">${html}</div>
            </div>
          `,
          showCloseButton: false,
          allowOutsideClick: false,
          allowEnterKey: false,
          focusConfirm: false,
          confirmButtonText: 'Close',
          width: 440,
          padding: 0,
          customClass: {
            popup: 'ai-note-modal',
            confirmButton: 'ai-note-confirm-btn',
            htmlContainer: 'ai-note-html-container'
          }
        }).then(() => {
          // Clean up toolbar and selection after user acknowledges the note
          this.cleanupTransformMarker();
          this.restoreNativeSelection();
          this.floatingToolbarState = 'quick_actions';
          this.cdr.detectChanges();
          this.editorInstance?.focus();
        });
      }, 150);
    });
  }

  /**
   * Check if AI-returned content is essentially the same as the original selected text.
   * Normalizes both strings (strips whitespace, markdown formatting, punctuation differences)
   * and compares. Returns true if >90% similar or if the normalized forms match.
   */
  private isContentEssentiallyUnchanged(aiContent: string, originalText: string): boolean {
    if (!aiContent || !originalText) return false;

    const normalize = (s: string): string => {
      return s
        .replace(/\r\n/g, '\n')
        // Strip markdown table formatting
        .replace(/\|/g, '')
        .replace(/^[\s:]*-{2,}[\s:]*$/gm, '')
        // Strip markdown bold/italic
        .replace(/\*{1,3}/g, '')
        .replace(/_{1,3}/g, '')
        // Strip HTML tags
        .replace(/<[^>]+>/g, '')
        // Collapse whitespace
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    };

    const normAi = normalize(aiContent);
    const normOriginal = normalize(originalText);

    // Exact match after normalization
    if (normAi === normOriginal) return true;

    // Check similarity ratio — if >90% of characters match, treat as unchanged
    if (normAi.length === 0 || normOriginal.length === 0) return false;
    const shorter = normAi.length < normOriginal.length ? normAi : normOriginal;
    const longer = normAi.length >= normOriginal.length ? normAi : normOriginal;

    // Quick length check — if lengths differ by >20%, likely changed
    if (shorter.length / longer.length < 0.8) return false;

    // Simple character-level similarity check
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (shorter[i] === longer[i]) matches++;
    }
    return (matches / longer.length) > 0.9;
  }

  // ========================================
  // TRANSFORMATION PREVIEW METHODS
  // ========================================

  /**
   * Accept transformation from inline comparison
   */
  acceptTransformation(messageId: string): void {
    // Find the message with the transformation
    const messageIndex = this.stateService.getConversationMessages().findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) {
      // Error handled silently
      return;
    }

    const message = this.stateService.getConversationMessages()[messageIndex];
    const transformation = message.transformationComparison;

    if (!transformation) {
      // Error handled silently
      return;
    }

    const response = transformation.response;

    if (transformation.scope === 'FULL_DOCUMENT') {
      // Full document transformation - replace entire content OR apply diff changes
      this.currentDocumentWordCount = response.wordCount;
      this.currentDocumentPageCount = this.documentGenerationService.estimatePageCount(response.wordCount);

      // Update metadata
      this.documentMetadata.version = response.newVersion;
      this.documentMetadata.tokensUsed = (this.documentMetadata.tokensUsed || 0) + response.tokensUsed;
      this.documentMetadata.costEstimate = (this.documentMetadata.costEstimate || 0) + response.costEstimate;

      // Check if this is a diff-based transformation
      if (transformation.useDiffMode && transformation.changes && transformation.changes.length > 0) {
        // Apply diffs to current content in CKEditor
        this.applyDiffChangesToEditor(transformation.changes);
      } else {
        // Traditional full replacement mode
        // Update CKEditor with transformed content
        setTimeout(() => {
          this.setCKEditorContentFromMarkdown(transformation.newContent);

          // Sync activeDocumentContent with CKEditor's HTML after content set
          setTimeout(() => {
            if (this.editorInstance) {
              this.activeDocumentContent = this.editorInstance.getData();
            }
          }, 50);
        }, 50);
      }
    } else {
      // Selection-based transformation - use CKEditor model operations for precise replacement
      if (!this.documentEditor || !this.editorInstance) {
        // Error handled silently
        return;
      }

      const editor = this.editorInstance;
      const transformedSnippet = transformation.response.transformedSelection || transformation.newContent;
      const selectionRange = transformation.selectionRange;

      if (!selectionRange || !transformedSnippet) {
        // Error handled silently
        return;
      }

      // Use CKEditorService for precise text replacement with highlight
      setTimeout(() => {
        try {
          this.ckEditorService.replaceTextWithHighlight(
            editor,
            selectionRange.index,
            selectionRange.length,
            transformedSnippet,
            '#d4edda',
            4000,
            transformation.oldContent
          );

          // Update activeDocumentContent from CKEditor's current state
          this.activeDocumentContent = editor.getData();

          // Update word count
          const plainText = this.ckEditorService.getPlainText(editor);
          this.currentDocumentWordCount = this.documentGenerationService.countWords(plainText);
          this.currentDocumentPageCount = this.documentGenerationService.estimatePageCount(this.currentDocumentWordCount);

          this.cdr.detectChanges();
        } catch (error) {
          this.notificationService.error('Transformation Error', 'Failed to apply transformation to selected text');
        }
      }, 50);

      // Update metadata
      this.documentMetadata.version = response.newVersion;
      this.documentMetadata.tokensUsed = (this.documentMetadata.tokensUsed || 0) + response.tokensUsed;
      this.documentMetadata.costEstimate = (this.documentMetadata.costEstimate || 0) + response.costEstimate;
    }

    // Remove transformation comparison from message (hide buttons)
    delete this.stateService.getConversationMessages()[messageIndex].transformationComparison;
    this.cdr.detectChanges();

    // CRITICAL: Save transformed content to database
    // Wait for all async operations (setTimeout callbacks) to complete before saving
    setTimeout(() => {
      if (!this.currentDocumentId || !this.currentUser || !this.editorInstance) {
        // Cannot save transformation - missing required data
        return;
      }

      // Get current HTML content from CKEditor (already has the transformation applied)
      const htmlContent = this.editorInstance!.getData();

      // Convert HTML to Markdown for backend storage
      const markdownContent = this.documentGenerationService.convertHtmlToMarkdown(htmlContent);

      // Save to database with transformation note
      const transformationType = transformation.response.transformationType || 'TRANSFORMATION';
      const transformationLabel = this.getTransformationLabel(transformationType);

      this.documentGenerationService.saveManualVersion(
        this.currentDocumentId as number,
        this.currentUser.id,
        markdownContent,
        `Applied ${transformationLabel}`
      )
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (saveResponse) => {
                        // Update version number from save response
            if (saveResponse && saveResponse.version) {
              this.documentMetadata.version = saveResponse.version;
            }
          },
          error: (error) => {
            this.notificationService.error('Save Failed', 'Transformation applied but failed to save to database');
          }
        });
    }, 200); // Wait for all async operations to complete

    // Show success message
    this.notificationService.success('Changes Applied', 'The transformation has been applied to your document');
  }

  /**
   * Reject transformation from inline comparison
   */
  rejectTransformation(messageId: string): void {
    // Find the message with the transformation
    const messageIndex = this.stateService.getConversationMessages().findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) {
      // Error handled silently
      return;
    }

    // Remove transformation comparison from message (hide buttons)
    delete this.stateService.getConversationMessages()[messageIndex].transformationComparison;
    this.cdr.detectChanges();

    // Show brief message
    this.notificationService.info('Changes Discarded', 'The transformation has been discarded', 1500);
  }

  /**
   * Get human-readable transformation label
   */
  getTransformationLabel(transformationType: string): string {
    const labels: { [key: string]: string } = {
      'INITIAL_GENERATION': 'Initial Draft',
      'SIMPLIFY': 'Simplified',
      'CONDENSE': 'Condensed',
      'EXPAND': 'Expanded',
      'FORMAL': 'Made Formal',
      'PERSUASIVE': 'Made Persuasive',
      'REDRAFT': 'Redrafted',
      'CUSTOM': 'Custom Revision',
      'MANUAL_EDIT': 'Manual Edit',
      'RESTORE_VERSION': 'Version Restored'
    };
    return labels[transformationType] || transformationType;
  }

  /**
   * Open save version modal with note input
   */
  async openSaveVersionModal(): Promise<void> {
    const note = await this.notificationService.promptTextArea(
      'Save Version',
      'Version Note (optional)',
      'Enter a note to describe this version...'
    );

    if (note !== null) {
      this.saveVersion(note || null);
    }
  }

  /**
   * Save current document as new version
   */
  saveVersion(versionNote: string | null): void {
    if (!this.currentDocumentId || !this.currentUser) {
      this.notificationService.error('Error', 'Document not loaded');
      return;
    }

    // For template docs, save CKEditor's HTML directly (preserves user edits).
    // For regular docs, save as markdown.
    let contentToSave: string;
    if (this.originalTemplateHtml) {
      const htmlContent = this.editorInstance ? this.editorInstance.getData() : '';
      contentToSave = '<!-- CKEDITOR_HTML -->\n' + htmlContent;
    } else {
      const htmlContent = this.editorInstance ? this.editorInstance.getData() : '';
      contentToSave = this.documentGenerationService.convertHtmlToMarkdown(htmlContent);
    }

    this.documentGenerationService.saveDocument(this.currentDocumentId, contentToSave, this.activeDocumentTitle)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.currentVersionNumber = response.versionNumber;
          this.notificationService.success('Success', `Version ${response.versionNumber} saved successfully`);
        },
        error: (error) => {
          this.notificationService.error('Error', 'Failed to save version');
        }
      });
  }


  /**
   * Decrease editor text size
   */
  decreaseTextSize(): void {
    if (this.editorTextSize > 10) {
      this.editorTextSize -= 2;
      this.applyTextSize();
    }
  }

  /**
   * Increase editor text size
   */
  increaseTextSize(): void {
    if (this.editorTextSize < 24) {
      this.editorTextSize += 2;
      this.applyTextSize();
    }
  }

  /**
   * Apply text size to CKEditor
   */
  private applyTextSize(): void {
    if (this.editorInstance) {
      this.ckEditorService.applyTextSize(this.editorInstance, this.editorTextSize);
    }
  }

  /**
   * Scroll to bottom of chat messages
   */
  private scrollToBottom(): void {
    setTimeout(() => {
      const chatContainers = document.querySelectorAll('.chat-messages-area, .chat-messages-area-side');
      chatContainers.forEach(container => {
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
    }, 100);
  }

  /**
   * Highlight selected text in full document context
   */
  highlightSelectionInContext(fullDocument: string, selectedText: string): string {
    if (!fullDocument || !selectedText) {
      return fullDocument;
    }

    // Escape special regex characters in the selected text
    const escapedSelection = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Find and replace the selected text with highlighted version
    // Use a case-sensitive, first-occurrence match
    const regex = new RegExp(`(${escapedSelection})`, 'i');
    const highlighted = fullDocument.replace(regex, '<mark class="text-selection-highlight">$1</mark>');

    return highlighted;
  }

  /**
   * Open document preview modal - generates a real PDF via backend and displays in iframe
   */
  openDocumentPreviewModal(): void {
    this.showDocumentPreviewModal = true;
    this.isLoadingPreview = true;
    this.sanitizedPreviewUrl = null;
    this.previewPdfBlob = null;
    document.body.classList.add('modal-open');
    this.cdr.detectChanges();

    const htmlContent = this.getEditorContent();
    if (!htmlContent) {
      this.isLoadingPreview = false;
      this.showDocumentPreviewModal = false;
      document.body.classList.remove('modal-open');
      this.cdr.detectChanges();
      this.notificationService.error('Error', 'No content to preview');
      return;
    }

    // Clean body first, then wrap with stationery (preserves stationery inline styles)
    const cleanBody = this.documentGenerationService.cleanHtmlForExport(htmlContent);
    const exportHtml = this.wrapContentWithStationery(cleanBody);

    this.documentGenerationService.exportContentToPDF(exportHtml, this.activeDocumentTitle)
      .subscribe({
        next: (response) => {
          const blob = response.body;
          if (!blob) {
            this.isLoadingPreview = false;
            this.showDocumentPreviewModal = false;
            document.body.classList.remove('modal-open');
            this.cdr.detectChanges();
            this.notificationService.error('Error', 'Failed to generate PDF preview.');
            return;
          }

          // Revoke previous URL if exists
          if (this.previewPdfUrl) {
            URL.revokeObjectURL(this.previewPdfUrl);
          }

          this.previewPdfBlob = blob;
          this.previewPdfUrl = URL.createObjectURL(blob);
          this.sanitizedPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.previewPdfUrl);
          this.isLoadingPreview = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isLoadingPreview = false;
          this.showDocumentPreviewModal = false;
          document.body.classList.remove('modal-open');
          this.cdr.detectChanges();
          this.notificationService.error('Error', 'Failed to generate PDF preview.');
        }
      });
  }

  /**
   * Close document preview modal
   */
  closeDocumentPreviewModal(): void {
    this.showDocumentPreviewModal = false;
    this.isLoadingPreview = false;
    this.previewPdfBlob = null;

    // Clean up blob URL
    if (this.previewPdfUrl) {
      URL.revokeObjectURL(this.previewPdfUrl);
      this.previewPdfUrl = null;
      this.sanitizedPreviewUrl = null;
    }

    document.body.classList.remove('modal-open');
  }

  /**
   * Download the previewed PDF using the cached blob
   */
  downloadPreviewedPdf(): void {
    if (!this.previewPdfBlob) return;
    const filename = this.sanitizeFilename(this.activeDocumentTitle) + '.pdf';
    const url = URL.createObjectURL(this.previewPdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Toggle conversation panel visibility
   */
  toggleChatPanel(): void {
    this.stateService.setShowChat(!this.stateService.getShowChat());
  }

  /**
   * Close conversation panel (while staying in drafting mode)
   */
  closeChatPanel(): void {
    this.stateService.setShowChat(false);
  }

  /**
   * Reopen conversation panel
   */
  reopenChatPanel(): void {
    // Close exhibit panel (mutually exclusive with chat)
    this.exhibitPanelService.closePanel();
    this.stateService.setShowChat(true);
  }

  /**
   * Open an exhibit from the drafting sidebar.
   * Closes the chat panel since they're mutually exclusive.
   */
  openExhibitFromSidebar(exhibit: Exhibit): void {
    this.stateService.setShowVersionHistory(false);
    this.stateService.setShowChat(false);

    const docId = this.currentDocumentId;
    if (!docId) return;

    // If exhibit already has a blob URL, open directly
    if (exhibit.fileUrl && exhibit.fileUrl.startsWith('blob:')) {
      this.exhibitPanelService.openExhibit(exhibit);
      return;
    }

    // Fetch file via HttpClient (with auth headers) and create blob URL
    this.exhibitPanelService.getExhibitFileBlob(Number(docId), Number(exhibit.id))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const rawBlobUrl = URL.createObjectURL(blob);
          exhibit.fileUrl = rawBlobUrl;
          this.exhibitPanelService.openExhibit(exhibit);
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.notificationService.error('Error', 'Failed to load exhibit file');
        }
      });
  }

  /**
   * Download the currently open exhibit file.
   */
  downloadCurrentExhibit(): void {
    const exhibit = this.exhibitPanelService.activeExhibitSnapshot;
    if (!exhibit?.fileUrl) return;

    const a = document.createElement('a');
    a.href = exhibit.fileUrl;
    a.download = exhibit.fileName || `${exhibit.label}.pdf`;
    a.click();
  }

  /**
   * Print the currently open exhibit file.
   */
  printCurrentExhibit(): void {
    const exhibit = this.exhibitPanelService.activeExhibitSnapshot;
    if (exhibit?.fileUrl) {
      const printWindow = window.open(exhibit.fileUrl);
      if (printWindow) {
        printWindow.addEventListener('load', () => printWindow.print());
      }
    }
  }

  // ===== ADD EXHIBIT MODAL =====

  get linkedCaseId(): number | null {
    return this.selectedCaseId || null;
  }

  get filteredCaseDocuments(): any[] {
    if (!this.caseDocSearchTerm) return this.caseDocuments;
    const term = this.caseDocSearchTerm.toLowerCase();
    return this.caseDocuments.filter((d: any) =>
      (d.originalName || d.name || d.fileName || d.title || '').toLowerCase().includes(term)
    );
  }

  openAddExhibitModal(): void {
    this.showAddExhibitModal = true;
    this.addExhibitTab = 'case';
    this.selectedCaseDocs = [];
    this.pendingUploadFiles = [];
    this.caseDocSearchTerm = '';
    this.caseDocuments = [];

    // Pre-select the linked case if one exists
    this.exhibitModalCaseId = this.linkedCaseId;

    // Ensure cases are loaded for the dropdown
    if (this.userCases.length === 0) {
      this.loadUserCases();
    }

    // If a case is already linked, load its documents
    if (this.exhibitModalCaseId) {
      this.loadCaseDocsForExhibitModal(this.exhibitModalCaseId);
    }
  }

  onExhibitCaseSelected(caseId: number | null): void {
    this.selectedCaseDocs = [];
    this.caseDocuments = [];
    this.caseDocSearchTerm = '';
    if (caseId) {
      this.loadCaseDocsForExhibitModal(caseId);
    }
  }

  private loadCaseDocsForExhibitModal(caseId: number): void {
    this.loadingCaseDocs = true;
    this.caseDocuments = [];
    this.caseDocumentsService.getDocuments(caseId.toString())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (docs) => {
          // Defensive extraction — service should return an array, but handle edge cases
          if (Array.isArray(docs)) {
            this.caseDocuments = docs;
          } else if (docs?.content && Array.isArray(docs.content)) {
            // Spring Page wrapper: { content: [...], totalElements, ... }
            this.caseDocuments = docs.content;
          } else if (docs?.data && Array.isArray(docs.data)) {
            // CustomHttpResponse not yet unwrapped
            this.caseDocuments = docs.data;
          } else {
            this.caseDocuments = [];
          }
          this.loadingCaseDocs = false;
          this.cdr.detectChanges();
        },
        error: () => {
          // Error handled silently
          this.caseDocuments = [];
          this.loadingCaseDocs = false;
          this.cdr.detectChanges();
        }
      });
  }

  closeAddExhibitModal(): void {
    this.showAddExhibitModal = false;
  }

  toggleDocSelection(doc: any): void {
    const idx = this.selectedCaseDocs.findIndex((d: any) => d.id === doc.id);
    if (idx >= 0) this.selectedCaseDocs.splice(idx, 1);
    else this.selectedCaseDocs.push(doc);
  }

  isDocSelected(doc: any): boolean {
    return this.selectedCaseDocs.some((d: any) => d.id === doc.id);
  }

  onExhibitDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingExhibit = false;
    if (event.dataTransfer?.files) {
      this.pendingUploadFiles.push(...Array.from(event.dataTransfer.files));
    }
  }

  onExhibitFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.pendingUploadFiles.push(...Array.from(input.files));
      input.value = '';
    }
  }

  removePendingFile(index: number): void {
    this.pendingUploadFiles.splice(index, 1);
  }

  confirmAddExhibits(): void {
    this.addingExhibits = true;
    const docId = this.currentDocumentId as number;
    if (!docId) { this.addingExhibits = false; return; }

    // Check for duplicates against existing exhibits
    const existingFileNames = new Set(
      this.exhibitPanelService.exhibitListSnapshot.map(e => e.fileName.toLowerCase())
    );

    // Filter out case docs that are already exhibits
    const newCaseDocs = this.selectedCaseDocs.filter((doc: any) => {
      const name = (doc.originalName || doc.name || doc.fileName || '').toLowerCase();
      return !existingFileNames.has(name);
    });
    const skippedCaseDocs = this.selectedCaseDocs.length - newCaseDocs.length;

    // Filter out upload files that are already exhibits
    const newUploadFiles = this.pendingUploadFiles.filter((file: File) => {
      return !existingFileNames.has(file.name.toLowerCase());
    });
    const skippedUploads = this.pendingUploadFiles.length - newUploadFiles.length;

    const totalSkipped = skippedCaseDocs + skippedUploads;
    if (totalSkipped > 0) {
      this.notificationService.info('Duplicates Skipped',
        `${totalSkipped} file${totalSkipped > 1 ? 's' : ''} already added as exhibit${totalSkipped > 1 ? 's' : ''}`, 3000);
    }

    const requests: Observable<any>[] = [];

    // Case document exhibits
    for (const doc of newCaseDocs) {
      requests.push(this.exhibitPanelService.addFromCaseDocument(docId, doc.id));
    }

    // Upload exhibits
    for (const file of newUploadFiles) {
      requests.push(this.exhibitPanelService.uploadExhibit(docId, file, this.exhibitModalCaseId));
    }

    if (requests.length === 0) { this.addingExhibits = false; return; }

    forkJoin(requests).pipe(takeUntil(this.destroy$)).subscribe({
      next: (results) => {
        results.forEach((exhibit: any) => {
          if (exhibit) {
            this.exhibitPanelService.addExhibit({
              id: exhibit.id?.toString() || '',
              label: exhibit.label || '',
              fileName: exhibit.fileName || '',
              fileUrl: this.exhibitPanelService.getExhibitFileUrl(docId, exhibit.id),
              pageCount: exhibit.pageCount
            });
          }
        });
        this.closeAddExhibitModal();
        this.addingExhibits = false;
        this.notificationService.success('Exhibits Added', `${results.length} exhibit${results.length > 1 ? 's' : ''} added successfully`);
        this.cdr.detectChanges();

        // Prompt user to incorporate exhibits via AI
        this.promptIncorporateExhibits(results);
      },
      error: (err) => {
        this.addingExhibits = false;
        this.notificationService.error('Error', 'Failed to add one or more exhibits');
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Load exhibits for a document when entering drafting mode.
   */
  loadDocumentExhibits(documentId: number): void {
    this.exhibitPanelService.setExhibitsLoading(true);
    this.exhibitPanelService.getExhibits(documentId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (exhibits) => {
        this.exhibitPanelService.setExhibits(exhibits.map((e: any) => ({
          id: String(e.id),
          label: e.label,
          fileName: e.fileName,
          fileUrl: this.exhibitPanelService.getExhibitFileUrl(documentId, e.id),
          pageCount: e.pageCount
        })));
        this.exhibitPanelService.setExhibitsLoading(false);
        this.cdr.detectChanges();
      },
      error: () => {
        // Error handled silently
        this.exhibitPanelService.setExhibitsLoading(false);
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Poll for exhibits after document generation.
   * Backend auto-attach is async — retries every 3s until exhibits stabilize or 30s max.
   */
  private pollForExhibits(documentId: number): void {
    let attempts = 0;
    let lastCount = 0;
    let stableRounds = 0;
    const maxAttempts = 10; // 10 × 3s = 30s max
    const intervalMs = 3000;

    const poll = () => {
      if (attempts >= maxAttempts) {
        // Give up — show whatever we have
        this.loadDocumentExhibits(documentId);
        return;
      }
      attempts++;
      this.exhibitPanelService.getExhibits(documentId).pipe(takeUntil(this.destroy$)).subscribe({
        next: (exhibits) => {
          const count = exhibits.length;
          if (count > 0 && count === lastCount) {
            stableRounds++;
          } else {
            stableRounds = 0;
          }
          lastCount = count;

          // Stable for 2 consecutive polls (6s) → done
          if (count > 0 && stableRounds >= 2) {
            this.exhibitPanelService.setExhibits(exhibits.map((e: any) => ({
              id: String(e.id),
              label: e.label,
              fileName: e.fileName,
              fileUrl: this.exhibitPanelService.getExhibitFileUrl(documentId, e.id),
              pageCount: e.pageCount
            })));
            this.exhibitPanelService.setExhibitsLoading(false);
            return;
          }

          // Keep polling
          this.setTrackedTimeout(poll, intervalMs);
        },
        error: () => {
          // Retry on error
          this.setTrackedTimeout(poll, intervalMs);
        }
      });
    };

    // Start first poll after 3s (give backend time to start async inserts)
    this.setTrackedTimeout(poll, intervalMs);
  }

  /**
   * Remove an exhibit from the document.
   */
  removeExhibit(exhibit: any, event: Event): void {
    event.stopPropagation();
    const docId = this.currentDocumentId;
    if (!docId) return;

    import('sweetalert2').then(Swal => {
      Swal.default.fire({
        html: `
          <div class="ai-note-header">
            <div class="ai-note-icon"><i class="ri-delete-bin-line"></i></div>
            <h2 class="ai-note-title">Remove Exhibit ${exhibit.label}?</h2>
          </div>
          <div class="ai-note-content">
            <p>This will remove <strong>${exhibit.fileName}</strong> from this document. The file will remain in the case file manager.</p>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Remove',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#f17171',
        customClass: {
          popup: 'ai-note-popup',
          confirmButton: 'btn btn-sm btn-danger',
          cancelButton: 'btn btn-sm btn-light ms-2'
        },
        buttonsStyling: false
      }).then((result) => {
        if (result.isConfirmed) {
          this.exhibitPanelService.deleteExhibit(docId as number, Number(exhibit.id))
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => {
                this.exhibitPanelService.removeExhibit(exhibit.id);

                // Check if the document contains references to this exhibit
                const currentContent = this.editorInstance?.getData() || '';
                const escapedLabel = exhibit.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const refPattern = new RegExp(`\\[Exhibit\\s+${escapedLabel}(?:,\\s*p\\.?\\s*\\d+(?:\\s*-\\s*\\d+)?)?\\]`, 'gi');
                const hasReferences = refPattern.test(currentContent);

                if (hasReferences && currentContent.trim()) {
                  this.cleanupExhibitReferencesViaAI(exhibit.label);
                } else {
                  this.notificationService.success('Exhibit Removed', `Exhibit ${exhibit.label} has been removed`, 2500);
                }
              },
              error: () => { /* Error handled silently */ }
            });
        }
      });
    });
  }

  /**
   * Use AI to remove references to a deleted exhibit and adjust surrounding sentences.
   */
  private cleanupExhibitReferencesViaAI(label: string): void {
    if (!this.editorInstance) return;
    this.activeDocumentContent = this.editorInstance.getData();

    if (!this.currentDocumentId || !this.activeDocumentContent?.trim()) {
      this.notificationService.success('Exhibit Removed', `Exhibit ${label} has been removed`, 2500);
      return;
    }

    const originalContent = this.activeDocumentContent;
    const prompt = `Remove all citations and references to Exhibit ${label} from the document, in any format (e.g. [Exhibit ${label}], [Exhibit ${label}, p.3], [Exhibit ${label}, pp. 3-5], [Exhibit ${label} at 7], or any similar citation pattern). Adjust surrounding sentences to read naturally without the exhibit citation. Do NOT re-letter or renumber remaining exhibits. Only remove references to Exhibit ${label}.`;

    // Lock editor + show overlay
    this.stateService.setIsGenerating(true);
    this.editorInstance.enableReadOnlyMode('ai-generation');
    this.initializeWorkflowSteps('transform');
    this.animateWorkflowSteps();

    const transformRequest = {
      documentId: this.currentDocumentId as number,
      transformationType: 'CUSTOM',
      transformationScope: 'FULL_DOCUMENT' as const,
      fullDocumentContent: this.activeDocumentContent,
      customPrompt: prompt,
      jurisdiction: this.selectedJurisdiction,
      documentType: this.selectedDocTypePill
    };

    this.documentGenerationService.transformDocument(transformRequest, this.currentUser?.id)
      .pipe(
        takeUntil(merge(this.destroy$, this.cancelGeneration$)),
        finalize(() => {
          this.stateService.setIsGenerating(false);
          if (this.editorInstance) {
            this.editorInstance.disableReadOnlyMode('ai-generation');
          }
          this.completeAllWorkflowSteps();
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          if (response.transformedContent && this.editorInstance) {
            this.editorInstance.setData(response.transformedContent);
            this.activeDocumentContent = response.transformedContent;

            // Update word/page count
            const plainText = this.ckEditorService.getPlainText(this.editorInstance);
            this.currentDocumentWordCount = this.documentGenerationService.countWords(plainText);
            this.currentDocumentPageCount = this.documentGenerationService.estimatePageCount(this.currentDocumentWordCount);

            // Rebuild TOC
            this.exhibitPanelService.buildTocFromHtml(this.activeDocumentContent);
            this.setDefaultActiveToc();

            // Show pending changes bar with undo capability
            this.pendingChanges = {
              originalContent: originalContent,
              transformedContent: response.transformedContent,
              changeCount: 1,
              type: 'exhibit references removed',
              response: response,
              isUndone: false
            };
            this.startPendingChangesAutoTimer(30000);

            this.notificationService.success('References Cleaned', `Exhibit ${label} references removed from document`, 2500);
          } else {
            this.notificationService.success('Exhibit Removed', `Exhibit ${label} removed (no reference changes needed)`, 2500);
          }
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.notificationService.error('Exhibit Removed', `Exhibit ${label} removed, but failed to clean up references automatically. You may need to edit them manually.`);
        }
      });
  }

  /**
   * After adding exhibits, prompt the user to incorporate references via AI.
   */
  promptIncorporateExhibits(newExhibits: any[]): void {
    if (newExhibits.length === 0) return;

    const exhibitNames = newExhibits
      .map((e: any) => `Exhibit ${e.label} (${e.fileName})`)
      .join(', ');

    import('sweetalert2').then(Swal => {
      setTimeout(() => {
        Swal.default.fire({
          html: `
            <div class="ai-note-header">
              <img src="/assets/images/new-legal-ai.gif" alt="AI" class="ai-note-avatar">
              <div class="ai-note-title-group">
                <span class="ai-note-title">Legience Assistant</span>
              </div>
            </div>
            <div class="ai-note-card">
              <div class="ai-note-body">
                <p><strong>${exhibitNames}</strong> added successfully.</p>
                <p>Would you like me to analyze ${newExhibits.length > 1 ? 'these exhibits' : 'this exhibit'} and incorporate references into the document?</p>
              </div>
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: 'Yes, incorporate',
          cancelButtonText: 'No thanks',
          allowEnterKey: false,
          focusConfirm: false,
          width: 440,
          padding: 0,
          customClass: {
            popup: 'ai-note-modal',
            confirmButton: 'btn btn-sm btn-primary',
            cancelButton: 'btn btn-sm btn-light ms-2'
          }
        }).then(result => {
          if (result.isConfirmed) {
            this.incorporateExhibitsViaAI(newExhibits);
          }
        });
      }, 150);
    });
  }

  /**
   * Use the full-document AI transform to incorporate exhibit references.
   * Directly applies changes to the editor and shows the pending changes bar
   * (visible in drafting mode), rather than routing through the chat panel.
   */
  incorporateExhibitsViaAI(exhibits: any[]): void {
    // Make sure we have the latest editor content
    if (this.editorInstance) {
      this.activeDocumentContent = this.editorInstance.getData();
    }

    if (!this.currentDocumentId || !this.activeDocumentContent) {
      this.notificationService.error('Error', 'No document content available to revise');
      return;
    }

    const exhibitList = exhibits
      .map((e: any) => {
        const pages = e.pageCount ? ` — ${e.pageCount} page${e.pageCount === 1 ? '' : 's'}` : '';
        return `Exhibit ${e.label} (${e.fileName}${pages})`;
      })
      .join(', ');
    const prompt = `Analyze the newly added ${exhibitList} and incorporate appropriate references throughout the document where the exhibit evidence supports the arguments being made. Use plain text [Exhibit X] for single-page exhibits or [Exhibit X, p.Y] for multi-page exhibits when citing a specific page. Do NOT use markdown links. Cite sparingly — one reference per factual point, not after every clause.`;

    // Save original content for undo
    const originalContent = this.activeDocumentContent;

    // Start generating state + lock editor
    this.stateService.setIsGenerating(true);
    if (this.editorInstance) {
      this.editorInstance.enableReadOnlyMode('ai-generation');
    }
    this.initializeWorkflowSteps('transform');
    this.animateWorkflowSteps();

    const transformRequest = {
      documentId: this.currentDocumentId as number,
      transformationType: 'CUSTOM',
      transformationScope: 'FULL_DOCUMENT' as const,
      fullDocumentContent: this.activeDocumentContent,
      customPrompt: prompt,
      jurisdiction: this.selectedJurisdiction,
      documentType: this.selectedDocTypePill
    };

    this.documentGenerationService.transformDocument(transformRequest, this.currentUser?.id)
      .pipe(
        takeUntil(merge(this.destroy$, this.cancelGeneration$)),
        finalize(() => {
          this.stateService.setIsGenerating(false);
          if (this.editorInstance) {
            this.editorInstance.disableReadOnlyMode('ai-generation');
          }
          this.completeAllWorkflowSteps();
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          if (response.transformedContent && this.editorInstance) {
            // Apply the transformed content to the editor
            this.editorInstance.setData(response.transformedContent);
            this.activeDocumentContent = response.transformedContent;

            // Update word/page count
            const plainText = this.ckEditorService.getPlainText(this.editorInstance);
            this.currentDocumentWordCount = this.documentGenerationService.countWords(plainText);
            this.currentDocumentPageCount = this.documentGenerationService.estimatePageCount(this.currentDocumentWordCount);

            // Rebuild TOC
            this.exhibitPanelService.buildTocFromHtml(this.activeDocumentContent);
            this.setDefaultActiveToc();

            // Unlock editor before highlighting — model.change() is blocked in read-only mode
            this.editorInstance.disableReadOnlyMode('ai-generation');

            // Highlight newly-added exhibit references so user can see what changed
            const refCount = this.highlightExhibitReferences();

            // Show pending changes bar with undo capability
            this.pendingChanges = {
              originalContent: originalContent,
              transformedContent: response.transformedContent,
              changeCount: refCount || 1,
              type: 'exhibit references added',
              response: response,
              isUndone: false
            };
            // Give user more time to review highlighted references before auto-dismiss
            this.startPendingChangesAutoTimer(30000);

            this.notificationService.success('Exhibits Incorporated', 'References have been added to the document', 2500);
          } else {
            this.notificationService.info('No Changes', 'AI did not suggest any changes to the document');
          }
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.notificationService.error('Error', 'Failed to incorporate exhibit references. Please try again.');
        }
      });
  }

  /**
   * Highlight exhibit reference patterns in the editor (e.g., [Exhibit A], [Exhibit B, p.3]).
   * Uses CKEditor's yellow highlight marker so users can see where references were added.
   * Highlights are cleared when finalizePendingChanges() calls removeAllHighlights().
   */
  private highlightExhibitReferences(): number {
    if (!this.editorInstance) return 0;
    const pattern = /\[Exhibit\s+[A-Z](?:,\s*p\.?\s*\d+(?:\s*-\s*\d+)?)?\]/gi;
    return this.ckEditorService.highlightAllMatches(this.editorInstance, pattern, 'yellowMarker');
  }

  /**
   * Save document to File Manager
   * Always exports from current editor content to ensure proper formatting
   */
  async saveToFileManager(): Promise<void> {
    try {
      // Show loading
      this.notificationService.loading('Saving to File Manager', 'Generating document...');

      // Get raw HTML from editor
      const htmlContent = this.getEditorContent();
      if (!htmlContent) {
        this.notificationService.error('Error', 'No content to save');
        return;
      }

      // Clean HTML for proper Word generation
      const cleanHtml = this.documentGenerationService.cleanHtmlForExport(htmlContent);
      const response = await lastValueFrom(
        this.documentGenerationService.exportContentToWord(cleanHtml, this.activeDocumentTitle)
      );

      // Extract blob from response
      const blob = response.body;
      if (!blob) {
        this.notificationService.error('Error', 'Failed to generate document');
        return;
      }

      // Extract filename from header or use fallback
      const fallbackFilename = this.sanitizeFilename(this.activeDocumentTitle) + '.docx';
      const filename = this.extractFilenameFromHeader(response.headers, fallbackFilename);

      // Convert blob to File object
      const file = new File([blob], filename, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      // Get case ID if available (check if we're in a case context)
      const caseId = this.selectedCaseId || undefined;

      // Upload to file manager
      await lastValueFrom(
        this.fileManagerService.uploadFile(file, undefined, caseId, 'Legal Document', 'DRAFT')
      );

      this.notificationService.success('Saved!', `Document saved to File Manager${caseId ? ' and linked to case' : ''}`);
    } catch (error) {
      this.notificationService.error('Error', 'Failed to save to File Manager');
    }
  }

  // ===== BACKGROUND TASK METHODS =====

  /**
   * Handle a completed background task
   * Called when a task completes (either while on this page or from completedTask$ subscription)
   */
  private handleCompletedBackgroundTask(task: BackgroundTask): void {
    
    switch (task.type) {
      case 'question':
        this.handleCompletedQuestionTask(task);
        break;
      case 'draft':
        this.handleCompletedDraftTask(task);
        break;
      case 'analysis':
        this.handleCompletedAnalysisTask(task);
        break;
      case 'workflow':
        this.handleCompletedWorkflowTask(task);
        break;
    }

    // Remove the task after handling
    this.backgroundTaskService.removeTask(task.id);
  }

  /**
   * Check for completed background tasks when returning to workspace
   */
  private checkForCompletedBackgroundTasks(): void {
    const completedTasks = this.backgroundTaskService.getCompletedTasks();
    if (completedTasks.length > 0) {
      completedTasks.forEach(task => {
        this.handleCompletedBackgroundTask(task);
      });
    }
  }

  /**
   * Handle completed question/research task
   */
  private handleCompletedQuestionTask(task: BackgroundTask): void {
    if (task.result && task.conversationId) {
      // Check if the conversation is currently active
      // If active, the inline HTTP callback will handle the UI update
      // We only need to handle the case where user navigated away
      if (this.stateService.getActiveConversationId() !== task.conversationId) {
        // Conversation is not active - store result for later
        this.stateService.setIsGenerating(false);
        this.stateService.storeBackgroundResult(task.conversationId, task.result);
        this.notificationService.info('Response Available', `Click on the conversation "${task.title}" to view the response`);
      }
      // Note: If conversation IS active, the inline callback handles everything
      // to ensure proper synchronous UI updates with change detection
    }
  }

  /**
   * Handle completed draft task
   */
  private handleCompletedDraftTask(task: BackgroundTask): void {
    if (task.result && task.conversationId) {
      // Store the result for when user switches to this conversation
      this.stateService.storeBackgroundResult(task.conversationId, task.result);
      this.notificationService.info('Draft Ready', `"${task.title}" has been drafted. Click the conversation to view.`);
    }
  }

  /**
   * Handle completed analysis task - displays the analysis result
   * Note: No additional notification shown here since toast already notified the user
   *
   * IMPORTANT: Only calls loadAnalysisHistory() - does NOT call displayAnalysisResults()
   * This prevents duplicate documents in sidebar (loadAnalysisHistory already includes the doc from DB)
   */
  private async handleCompletedAnalysisTask(task: BackgroundTask): Promise<void> {
    // CRITICAL: Refresh token before making follow-up API requests
    // Token may have expired during long background analysis
    try {
      if (this.userService.isTokenAboutToExpire(5)) {
        await lastValueFrom(this.userService.refreshToken$());
      }
    } catch (error) {
      // Continue anyway - interceptor will handle if truly expired
    }

    // Refresh the analysis history to show new results from DB
    // This already includes the completed analysis - no need to add it separately
    this.loadAnalysisHistory();

    // After history loads, find and open the completed document
    // Use setTimeout to wait for loadAnalysisHistory to complete
    if (task.result && task.result.results && task.result.results.length > 0) {
      const lastResult = task.result.results[task.result.results.length - 1];
      const databaseId = lastResult.databaseId || lastResult.id;
      const normalizedId = `analysis_${databaseId}`;

      // Wait a bit for loadAnalysisHistory to complete, then open the document
      setTimeout(() => {
        const doc = this.stateService.getAnalyzedDocumentById(normalizedId);
        if (doc) {
          this.openDocumentInViewer(doc);
          this.cdr.detectChanges();
        }
      }, 500);
    }
  }

  /**
   * Handle completed workflow task
   */
  private handleCompletedWorkflowTask(task: BackgroundTask): void {
    // Refresh workflows list
    this.loadUserWorkflows();

    // If user is viewing this workflow, refresh it
    if (this.selectedWorkflowForDetails && this.selectedWorkflowForDetails.id === task.workflowId) {
      this.refreshWorkflowDetails();
    }

    this.notificationService.success('Workflow Completed', `"${task.title}" has finished processing`);
  }

  /**
   * Handle viewing a background task from the indicator panel
   * Called when user clicks "View" button on a completed task
   */
  onBackgroundTaskView(task: BackgroundTask): void {
    switch (task.type) {
      case 'question':
        // Switch to question mode and open the conversation
        this.selectedTask = ConversationType.Question;
        if (task.conversationId) {
          this.switchConversation(task.conversationId);
        }
        break;

      case 'draft':
        // Switch to draft mode and open the conversation
        this.selectedTask = ConversationType.Draft;
        if (task.conversationId) {
          this.switchConversation(task.conversationId);
        }
        break;

      case 'analysis':
        // Switch to upload/analysis mode and display the result
        this.selectedTask = ConversationType.Upload;
        if (task.result && task.result.results && task.result.results.length > 0) {
          const lastResult = task.result.results[task.result.results.length - 1];
          const analysisId = lastResult.databaseId ? lastResult.databaseId.toString() : lastResult.id;

          // Fetch and display the analysis
          this.documentAnalyzerService.getAnalysisById(analysisId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (fullResult) => {
                this.displayAnalysisResults(fullResult, false);
                this.cdr.detectChanges();
              },
              error: () => {
                this.notificationService.error('Error', 'Failed to load analysis results');
              }
            });
        }
        break;

      case 'workflow':
        // Switch to workflow mode and open the workflow details
        this.selectedTask = ConversationType.Workflow;
        if (task.workflowId) {
          const workflow = this.userWorkflows.find(w => w.id === task.workflowId);
          if (workflow) {
            this.viewWorkflowDetails(workflow);
          } else {
            // Load the workflow directly if not in list
            this.caseWorkflowService.getExecutionWithSteps(task.workflowId)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (executionWithSteps) => {
                  this.selectedWorkflowForDetails = executionWithSteps;
                  this.showWorkflowDetailsPage = true;
                  this.cdr.detectChanges();
                },
                error: () => { /* Error handled silently */ }
              });
          }
        }
        break;
    }
  }

  toggleBookmark(message: any): void {
    if (!message.id) return;
    const previousState = message.bookmarked;
    message.bookmarked = !previousState; // Optimistic update
    this.cdr.detectChanges();

    this.legalResearchService.toggleBookmark(message.id).subscribe({
      next: (updated) => {
        message.bookmarked = updated.bookmarked; // Confirm with server state
        this.cdr.detectChanges();
      },
      error: (err) => {
        message.bookmarked = previousState; // Revert on failure
        this.cdr.detectChanges();
        this.notificationService.error('Error', 'Failed to toggle bookmark');
      }
    });
  }

  // ==================== STATIONERY ====================

  /**
   * Auto-load stationery frame when opening a document that has stationery association.
   * Called after document data is loaded from backend.
   */
  private loadDocumentStationery(document: any): void {
    const templateId = document.stationeryTemplateId;
    const attorneyId = document.stationeryAttorneyId;

    if (!templateId || !attorneyId) {
      // No stationery on this document — clear any previous frame
      this.clearStationeryFrames();
      this.activeStationeryRendered = null;
      this.activeStationeryRawHtml = null;
      this.activeStationeryTemplateId = null;
      this.activeStationeryAttorneyId = null;
      this.stationeryInserted = false;
      return;
    }

    // Render the stationery frame
    this.stationeryService.renderStationery(templateId, attorneyId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (rendered: StationeryRenderResponse) => {
          this.activeStationeryRawHtml = {
            letterhead: rendered.letterheadHtml || '',
            signature: rendered.signatureBlockHtml || '',
            footer: rendered.footerHtml || ''
          };
          this.activeStationeryRendered = {
            letterhead: rendered.letterheadHtml ? this.sanitizer.bypassSecurityTrustHtml(rendered.letterheadHtml) : null,
            signature: rendered.signatureBlockHtml ? this.sanitizer.bypassSecurityTrustHtml(rendered.signatureBlockHtml) : null,
            footer: rendered.footerHtml ? this.sanitizer.bypassSecurityTrustHtml(rendered.footerHtml) : null
          };
          this.activeStationeryTemplateId = templateId;
          this.activeStationeryAttorneyId = attorneyId;
          this.selectedStationeryTemplateId = templateId;
          this.stationeryInserted = true;

          // Inject stationery frames into CKEditor DOM (small delay to ensure DOM is ready)
          this.stationeryRenderTimeoutId = window.setTimeout(() => this.renderStationeryFrames(), 50);

          this.cdr.detectChanges();
        },
        error: () => {
          // Non-fatal — document still opens without stationery frame
        }
      });
  }

  /**
   * Load templates, attorneys, and current user's attorney profile when the stationery dropdown opens.
   * Determines if one-click auto-apply is available (default template + user is an attorney).
   */
  onStationeryDropdownOpen(): void {
    this.loadingStationery = true;
    this.showAdvancedStationery = false;
    this.cdr.detectChanges();

    forkJoin({
      templates: this.stationeryService.getTemplates(),
      attorneys: this.stationeryService.getAttorneys(),
      myProfile: this.stationeryService.getMyAttorneyProfile()
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ templates, attorneys, myProfile }) => {
        this.stationeryTemplates = templates;
        this.stationeryAttorneys = attorneys;
        this.myAttorneyProfile = myProfile;
        this.defaultStationeryTemplate = templates.find(t => t.isDefault) || templates[0] || null;
        // Auto-select default template
        if (this.defaultStationeryTemplate) {
          this.selectedStationeryTemplateId = this.defaultStationeryTemplate.id!;
        }
        this.autoStationeryReady = !!myProfile && !!this.defaultStationeryTemplate;
        this.loadingStationery = false;
        this.cdr.detectChanges();
      },
      error: () => {
        // Error handled silently
        this.loadingStationery = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * One-click apply: uses the default template + current user's attorney profile.
   */
  applyAutoStationery(): void {
    if (!this.myAttorneyProfile || !this.defaultStationeryTemplate) return;
    this.selectedStationeryTemplateId = this.defaultStationeryTemplate.id!;
    this.activeAttorneyName = `${this.myAttorneyProfile.firstName} ${this.myAttorneyProfile.lastName}`;
    this.insertStationery(this.myAttorneyProfile.id);
  }

  /**
   * Render stationery as CSS page frame (outside CKEditor).
   * Stores rendered HTML in component properties and saves template/attorney IDs to document.
   */
  insertStationery(attorneyId: number): void {
    if (!this.selectedStationeryTemplateId) return;

    const templateId = this.selectedStationeryTemplateId;
    this.stationeryService.renderStationery(templateId, attorneyId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (rendered: StationeryRenderResponse) => {
          // Store raw HTML for export use
          this.activeStationeryRawHtml = {
            letterhead: rendered.letterheadHtml || '',
            signature: rendered.signatureBlockHtml || '',
            footer: rendered.footerHtml || ''
          };

          // Keep sanitized copy for legacy compatibility (e.g. export previews)
          this.activeStationeryRendered = {
            letterhead: rendered.letterheadHtml ? this.sanitizer.bypassSecurityTrustHtml(rendered.letterheadHtml) : null,
            signature: rendered.signatureBlockHtml ? this.sanitizer.bypassSecurityTrustHtml(rendered.signatureBlockHtml) : null,
            footer: rendered.footerHtml ? this.sanitizer.bypassSecurityTrustHtml(rendered.footerHtml) : null
          };

          this.activeStationeryTemplateId = templateId;
          this.activeStationeryAttorneyId = attorneyId;
          this.stationeryInserted = true;

          // Set active attorney name for display (find from attorneys list or myProfile)
          const matchedAtty = this.stationeryAttorneys.find(a => a.id === attorneyId);
          if (matchedAtty) {
            this.activeAttorneyName = `${matchedAtty.firstName} ${matchedAtty.lastName}`;
          } else if (this.myAttorneyProfile && this.myAttorneyProfile.id === attorneyId) {
            this.activeAttorneyName = `${this.myAttorneyProfile.firstName} ${this.myAttorneyProfile.lastName}`;
          }

          // Inject stationery frames into CKEditor DOM
          this.renderStationeryFrames();

          // Persist stationery association on the document
          if (this.currentDocumentId) {
            this.documentGenerationService.updateDocumentStationery(
              this.currentDocumentId as number, templateId, attorneyId
            ).pipe(takeUntil(this.destroy$)).subscribe({
              error: () => { /* Error handled silently */ }
            });
          }

          // Strip any old stationery HTML that may be baked into CKEditor content (migration from old approach)
          if (this.editorInstance) {
            const content = this.editorInstance.getData();
            if (content.includes('data-stationery=')) {
              const cleaned = this.stripStationeryFromHtml(content);
              this.editorInstance.setData(cleaned);
              this.activeDocumentContent = cleaned;
            }
          }

          this.notificationService.success('Stationery Applied', 'Letterhead and signature block applied', 2500);
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.notificationService.error('Error', 'Failed to apply stationery. Please try again.');
        }
      });
  }

  /**
   * Remove stationery frame from the document view.
   * Clears component properties and nulls out IDs on the document.
   */
  removeStationery(): void {
    // Remove injected DOM elements from CKEditor
    this.clearStationeryFrames();

    this.activeStationeryRendered = null;
    this.activeStationeryRawHtml = null;
    this.activeStationeryTemplateId = null;
    this.activeStationeryAttorneyId = null;
    this.stationeryInserted = false;

    // Clear stationery association on the document
    if (this.currentDocumentId) {
      this.documentGenerationService.updateDocumentStationery(
        this.currentDocumentId as number, null, null
      ).pipe(takeUntil(this.destroy$)).subscribe({
        error: () => { /* Error handled silently */ }
      });
    }

    // Also strip any legacy stationery HTML from CKEditor content
    if (this.editorInstance) {
      const content = this.editorInstance.getData();
      if (content.includes('data-stationery=')) {
        const cleaned = this.stripStationeryFromHtml(content);
        this.editorInstance.setData(cleaned);
        this.activeDocumentContent = cleaned;
      }
    }

    this.notificationService.success('Stationery Removed', 'Letterhead and signature block removed', 2500);
    this.cdr.detectChanges();
  }

  /**
   * Strip all data-stationery marked divs and adjacent <hr> from HTML string.
   * Uses DOMParser to correctly handle nested HTML within stationery blocks.
   */
  private stripStationeryFromHtml(html: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    doc.querySelectorAll('[data-stationery]').forEach(el => {
      // Remove adjacent <hr> separators
      const next = el.nextElementSibling;
      const prev = el.previousElementSibling;
      if (next?.tagName === 'HR') next.remove();
      if (prev?.tagName === 'HR') prev.remove();
      el.remove();
    });
    return doc.body.innerHTML.trim();
  }

  /**
   * Inject stationery HTML frames into CKEditor's .ck-editor__main container as DOM siblings
   * of .ck-content. This places them INSIDE the editor scroll area but OUTSIDE the editable
   * content, so getData() stays clean while the user sees letterhead/signature/footer.
   */
  private renderStationeryFrames(): void {
    if (!this.editorInstance || !this.activeStationeryRawHtml) return;

    const editableEl = this.editorInstance.editing.view.getDomRoot();
    const mainContainer = editableEl?.closest('.ck-editor__main');
    if (!mainContainer) return;

    // Clear existing frames first
    this.clearStationeryFrames();

    // Add unified-page class for seamless stationery appearance
    mainContainer.classList.add('stationery-active');

    // Letterhead — insert BEFORE .ck-content
    if (this.activeStationeryRawHtml.letterhead) {
      const letterhead = document.createElement('div');
      letterhead.className = 'stationery-frame stationery-letterhead-frame';
      letterhead.setAttribute('contenteditable', 'false');
      letterhead.innerHTML = this.activeStationeryRawHtml.letterhead;
      // Force serif font on all text elements — stored HTML may lack font-family
      const serifFont = "'Times New Roman', Georgia, serif";
      letterhead.querySelectorAll('p, td, span, div, th').forEach((el: Element) => {
        (el as HTMLElement).style.fontFamily = serifFont;
      });
      mainContainer.insertBefore(letterhead, editableEl);
    }

    // Signature — insert AFTER .ck-content
    if (this.activeStationeryRawHtml.signature) {
      const signature = document.createElement('div');
      signature.className = 'stationery-frame stationery-signature-frame';
      signature.setAttribute('contenteditable', 'false');
      signature.innerHTML = this.activeStationeryRawHtml.signature;
      mainContainer.appendChild(signature);
    }

    // Footer — insert AFTER signature
    if (this.activeStationeryRawHtml.footer) {
      const footer = document.createElement('div');
      footer.className = 'stationery-frame stationery-footer-frame';
      footer.setAttribute('contenteditable', 'false');
      footer.innerHTML = this.activeStationeryRawHtml.footer;
      mainContainer.appendChild(footer);
    }
  }

  /**
   * Remove all injected stationery frames from the CKEditor DOM.
   */
  private clearStationeryFrames(): void {
    // Cancel any pending render timeout
    if (this.stationeryRenderTimeoutId !== null) {
      clearTimeout(this.stationeryRenderTimeoutId);
      this.stationeryRenderTimeoutId = null;
    }

    // Try via editor instance first
    if (this.editorInstance) {
      const editableEl = this.editorInstance.editing.view.getDomRoot();
      const mainContainer = editableEl?.closest('.ck-editor__main');
      if (mainContainer) {
        mainContainer.classList.remove('stationery-active');
        mainContainer.querySelectorAll('.stationery-frame').forEach(el => el.remove());
        return;
      }
    }

    // Fallback: query from document directly (editor may already be destroyed)
    document.querySelectorAll('.ck-editor__main.stationery-active').forEach(el => el.classList.remove('stationery-active'));
    document.querySelectorAll('.ck-editor__main .stationery-frame').forEach(el => el.remove());
  }

}
