import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, TemplateRef, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subject, lastValueFrom, merge } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
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
import { UserService } from '../../../../../service/user.service';
import { environment } from '@environments/environment';
import { QuillModule } from 'ngx-quill';
import Quill from 'quill';
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

// NEW: Refactored services
import { NotificationService } from '../../../services/notification.service';
import { QuillEditorService } from '../../../services/quill-editor.service';
import { AiWorkspaceStateService, AnalyzedDocument } from '../../../services/ai-workspace-state.service';
import { ConversationOrchestrationService } from '../../../services/conversation-orchestration.service';
import { DocumentTransformationService } from '../../../services/document-transformation.service';

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
    QuillModule,
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
    DocumentAnalysisViewerComponent
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

  // Document Analysis Viewer state
  analyzedDocuments$ = this.stateService.analyzedDocuments$;
  activeDocumentId$ = this.stateService.activeDocumentId$;
  documentViewerMode$ = this.stateService.documentViewerMode$;
  viewerSidebarCollapsed$ = this.stateService.viewerSidebarCollapsed$;

  // Collections state
  collections$ = this.collectionService.collections$;
  loadingCollections = false;
  showNewCollectionModal = false;

  // Legacy properties for backwards compatibility (will be removed progressively)
  currentStep = 1;
  selectedDocumentType: 'interrogatories' | 'motion' | 'brief' | '' = '';

  // Workflow steps (migrated to observable from StateService)
  workflowSteps$ = this.stateService.workflowSteps$;

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
    ]
  };

  // Conversation management (migrated to observables from StateService)
  conversations$ = this.stateService.conversations$;
  activeConversationId$ = this.stateService.activeConversationId$;
  groupedConversations$ = this.stateService.groupedConversations$;
  conversationMessages$ = this.stateService.conversationMessages$;

  // Search query for filtering conversations
  conversationSearchQuery = '';

  // Search query for filtering document analyses
  documentSearchQuery = '';

  // Loading state for analyses
  loadingAnalyses = false;

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

  // Filtered conversations based on search query (computed from observable)
  // Also filters out document analysis conversations (Upload/Summarize) since they appear in Recent Documents
  get filteredConversations() {
    // First, filter out document analysis types (they appear in Recent Documents section)
    const nonAnalysisConversations = this.stateService.getConversations().filter(conv =>
      conv.type !== ConversationType.Upload && conv.type !== ConversationType.Summarize
    );

    if (!this.conversationSearchQuery.trim()) {
      return nonAnalysisConversations;
    }

    const query = this.conversationSearchQuery.toLowerCase();
    return nonAnalysisConversations.filter(conv =>
      conv.title.toLowerCase().includes(query)
    );
  }

  // User input
  customPrompt = '';
  followUpMessage = '';

  // Follow-up questions (migrated to observable from StateService)
  followUpQuestions$ = this.stateService.followUpQuestions$;

  // Jurisdiction
  selectedJurisdiction = 'Massachusetts';
  jurisdictions = ['Massachusetts', 'Federal'];

  // Research Mode (FAST or THOROUGH)
  selectedResearchMode: ResearchMode = ResearchMode.Fast;

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

  // Track setTimeout ID for content loading to prevent race conditions
  private contentLoadTimeoutId: number | null = null;

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

  // Recent drafts
  recentDrafts: any[] = [];
  loadingDrafts = false;

  // Current user from authentication service
  currentUser: any = null;

  // Case selection for draft generation
  selectedCaseId: number | null = null;
  userCases: any[] = [];

  // Upload document functionality
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
  documentUrl: string = '';
  isFetchingUrl: boolean = false;

  // Quill Editor instance and config
  @ViewChild('documentEditor') documentEditor?: any;
  quillEditorInstance: any; // Direct reference to Quill instance

  // Force editor recreation when switching documents by toggling this flag
  // Toggling OFF→ON forces Angular to destroy and recreate the component
  // MUST BE PUBLIC for template access
  showEditor = true;

  quillModules = {
    toolbar: [
      [{ 'font': ['sans-serif', 'serif', 'monospace'] }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['blockquote', 'code-block'],
      [{ 'align': [] }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      ['link'],
      [{ 'color': [] }, { 'background': [] }],
      ['clean']
    ]
  };

  quillFormats = [
    'font', 'size',
    'bold', 'italic', 'underline', 'strike',
    'header',
    'list',
    'align', 'indent',
    'link',
    'blockquote',
    'code-block',
    'color', 'background'
  ];

  // Text selection tracking
  selectedText: string = '';
  selectionRange: { index: number; length: number } | null = null;

  // Pending transformation - stored in message with unique ID
  private transformationMessageIdCounter = 0;

  // Version history (simplified for dropdown)
  documentVersions: any[] = [];
  loadingVersions = false;
  currentVersionNumber: number = 1;

  @ViewChild('transformationPreviewModal') transformationPreviewModal!: TemplateRef<any>;
  @ViewChild('howItWorksModal') howItWorksModal!: TemplateRef<any>;
  @ViewChild('promptTipsModal') promptTipsModal!: TemplateRef<any>;
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  // UI Controls
  editorTextSize: number = 14; // Default font size in px
  isFullscreen = false;

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
    private quillEditorService: QuillEditorService,
    private stateService: AiWorkspaceStateService,
    private conversationOrchestration: ConversationOrchestrationService,
    private transformationService: DocumentTransformationService
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
   * Keyboard shortcut: Ctrl+Shift+F - Toggle fullscreen
   */
  @HostListener('window:keydown.control.shift.f', ['$event'])
  @HostListener('window:keydown.meta.shift.f', ['$event']) // For Mac
  handleFullscreenShortcut(event: KeyboardEvent): void {
    if (this.stateService.getDraftingMode()) {
      event.preventDefault();
      this.toggleFullscreen();
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


  ngOnInit(): void {
    // Subscribe to UserService userData$ observable for reactive updates
    this.userService.userData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        console.log('Current user from UserService observable:', user);
        // Load cases when user is available
        if (user && user.id) {
          this.loadUserCases();
        }
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
              // Load cases after user is loaded
              this.loadUserCases();
            }
          },
          error: (error) => {
            console.error('Error loading user profile:', error);
          }
        });
    }

    // Load conversations for the default task type
    this.loadConversations();

    // Load analysis history for sidebar (Recent Documents section)
    this.loadAnalysisHistory();

    // Load collections for sidebar
    this.loadCollections();

    // Load user's cases for case selector if user already available
    if (this.currentUser && this.currentUser.id) {
      this.loadUserCases();
    }
  }

  // Load user's cases for case selector
  loadUserCases(): void {
    if (!this.currentUser || !this.currentUser.id) {
      console.log('No current user, skipping case load');
      return;
    }

    this.legalCaseService.getAllCases(0, 100)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.userCases = response.data?.cases || response.cases || response.content || [];
          console.log('Loaded user cases:', this.userCases.length);
        },
        error: (error) => {
          console.error('Error loading user cases:', error);
          this.userCases = [];
        }
      });
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
          console.log('📄 Loaded analysis history:', history.length, 'documents');

          // Map AnalysisHistory to AnalyzedDocument format
          const analyzedDocs = history.map(h => ({
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

          // Set to state service (this populates the sidebar)
          this.stateService.setAnalyzedDocuments(analyzedDocs);
          this.loadingAnalyses = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Failed to load analysis history:', error);
          this.loadingAnalyses = false;
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Delete an analysis from history
   */
  deleteAnalysis(doc: any): void {
    // TODO: Add backend endpoint for deletion
    // For now, just remove from local state
    this.stateService.removeAnalyzedDocument(doc.id);
    this.notificationService.success('Deleted', `Analysis for "${doc.fileName}" removed`);
  }

  /**
   * Open modal showing full analysis history
   */
  openAnalysisHistoryModal(): void {
    // TODO: Implement analysis history modal
    this.notificationService.info('Coming Soon', 'Full analysis history view will be available soon');
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
          console.log('📁 Loaded collections:', collections.length);
          this.loadingCollections = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Failed to load collections:', error);
          this.loadingCollections = false;
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
   * Open a collection (placeholder - will implement collection viewer)
   */
  openCollection(collection: DocumentCollection): void {
    // TODO: Implement collection viewer
    this.notificationService.info('Coming Soon', `Collection "${collection.name}" viewer will be available soon`);
  }

  /**
   * Handle research mode change (FAST or THOROUGH)
   */
  onResearchModeChange(mode: 'FAST' | 'THOROUGH'): void {
    this.selectedResearchMode = mode === 'FAST' ? ResearchMode.Fast : ResearchMode.Thorough;
    console.log(`Research mode changed to: ${mode}`);

    // Show notification to user
    const modeInfo = mode === 'FAST'
      ? { title: 'Fast Mode', msg: 'Quick answers without citations (~15s)' }
      : { title: 'Thorough Mode', msg: 'Verified citations via CourtListener (~90s)' };

    this.notificationService.success(modeInfo.title, modeInfo.msg);
  }

  /**
   * Set mode to THOROUGH when entering drafting mode
   * Legal documents need citations for credibility and court filings
   */
  private setModeForDrafting(): void {
    const previousMode = this.selectedResearchMode;
    this.selectedResearchMode = ResearchMode.Thorough;

    if (previousMode !== ResearchMode.Thorough) {
      console.log('⭐ Drafting mode: Auto-switched to THOROUGH for verified citations');
      this.notificationService.info(
        'THOROUGH Mode Active',
        'Drafting mode automatically uses THOROUGH mode for verified citations'
      );
    }
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
  private initializeWorkflowSteps(taskType: 'question' | 'draft' | 'summarize' | 'upload' | 'transform'): void {
    const template = this.workflowStepTemplates[taskType];
    const steps = template.map(step => ({
      ...step,
      status: 'pending' as any
    }));
    this.stateService.setWorkflowSteps(steps);
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

  // Complete all workflow steps (called when AI response is received) - now uses StateService
  private completeAllWorkflowSteps(): void {
    this.stateService.completeAllWorkflowSteps();
    this.cdr.detectChanges();
  }

  // Stop generation
  stopGeneration(): void {
    // Get active conversation to cancel backend request
    const activeConvId = this.stateService.getActiveConversationId();
    const conversations = this.stateService.getConversations();
    const activeConv = conversations.find(c => c.id === activeConvId);

    console.log('🛑 STOP button clicked');
    console.log('🔍 Active conversation ID:', activeConvId);
    console.log('🔍 Active conversation:', activeConv);
    console.log('🔍 Backend conversation ID:', activeConv?.backendConversationId);

    // Call backend to cancel the AI request
    if (activeConv?.backendConversationId) {
      console.log('🔵 Calling backend cancel API with ID:', activeConv.backendConversationId);
      this.legalResearchService.cancelConversation(activeConv.backendConversationId)
        .subscribe({
          next: () => {
            console.log('✅ Backend generation cancelled successfully for conversation', activeConv.backendConversationId);
          },
          error: (err) => {
            console.error('❌ Failed to cancel backend generation:', err);
          }
        });
    } else {
      console.warn('⚠️ No backend conversation ID found - cannot cancel');
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

          // Map backend conversations to frontend format and set in state service
          const conversations: Conversation[] = response.conversations.map(conv => ({
            id: `conv_${conv.id}`,
            title: conv.sessionName || 'Untitled Conversation',
            date: new Date(conv.createdAt || new Date()),
            type: this.mapBackendTaskTypeToFrontend(conv.taskType || 'LEGAL_QUESTION'),
            messages: [], // Messages will be loaded when conversation is opened
            messageCount: conv.messageCount || 0, // Use for badge display after page refresh
            jurisdiction: conv.jurisdiction,
            backendConversationId: conv.id,
            researchMode: conv.researchMode as ResearchMode || 'FAST' as ResearchMode,
            taskType: conv.taskType as TaskType,
            documentId: conv.documentId,
            relatedDraftId: conv.relatedDraftId
          }));

          // State service automatically groups conversations by date
          this.stateService.setConversations(conversations);

          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading general conversations:', error);
        }
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
    console.log('🔍 loadConversation called with ID:', conversationId);

    const conv = this.stateService.getConversations().find(c => c.id === conversationId);
    if (!conv || !conv.backendConversationId) {
      console.error('❌ Conversation not found or missing backend ID');
      return;
    }

    console.log('📦 Conversation found:', {
      id: conv.id,
      type: conv.type,
      title: conv.title,
      backendId: conv.backendConversationId,
      relatedDraftId: conv.relatedDraftId
    });

    // Check if this is a document analysis conversation (Summarize or Upload)
    if (conv.type === ConversationType.Summarize || conv.type === ConversationType.Upload) {
      console.log('📄 Document analysis conversation detected, loading analysis...');
      this.loadDocumentAnalysisFromConversation(conv);
      return;
    }

    this.legalResearchService.getConversationById(conv.backendConversationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('✅ Loaded conversation details:', response);

          // Update conversation with messages via state service
          this.stateService.setActiveConversationId(conversationId);
          this.stateService.clearFollowUpQuestions(); // Clear old follow-up questions from previous conversation

          const messages = response.messages.map(msg => {
            const baseMessage: any = {
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
              timestamp: new Date(msg.createdAt || new Date())
            };

            // Detect document analysis messages and restore properties
            // Use two-tier detection: metadata first, then content patterns
            let hasAnalysisId = false;
            if (msg.metadata && typeof msg.metadata === 'object') {
              const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
              hasAnalysisId = !!metadata.analysisId;
            }
            const hasStrategicContent = msg.content.includes('EXECUTIVE') ||
              msg.content.includes('CRITICAL') ||
              msg.content.includes('STRATEGIC');

            if (msg.role === 'assistant' && (hasAnalysisId || hasStrategicContent)) {
              console.log('🎯 Detected Strategic Document Analysis message (metadata:', hasAnalysisId, 'content:', hasStrategicContent, ')');
              baseMessage.hasStrategicAnalysis = true;
              baseMessage.parsedSections = this.parseStrategicSections(msg.content);

              // Extract analysisId from message metadata if available
              if (msg.metadata && typeof msg.metadata === 'object') {
                const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
                if (metadata.analysisId) {
                  baseMessage.analysisId = metadata.analysisId;
                  console.log('🎯 Found analysisId in metadata:', metadata.analysisId);
                }
              }

              console.log('🎯 Final message with strategic analysis:', baseMessage);
            }

            return baseMessage;
          });

          console.log('🎯 All mapped messages:', messages);
          console.log('✅ Messages loaded:', messages.length);

          // CRITICAL: Use setTimeout to ensure Angular processes the observable emission in next tick
          setTimeout(() => {
            // Extract follow-up questions from last assistant message (if any)
            const lastAssistantMsg = messages
              .slice()
              .reverse()
              .find(msg => msg.role === 'assistant');

            if (lastAssistantMsg) {
              const cleanedContent = this.extractAndRemoveFollowUpQuestions(lastAssistantMsg.content);
              lastAssistantMsg.content = cleanedContent;
              console.log('🔥 After cleaning follow-ups, hasStrategicAnalysis:', lastAssistantMsg.hasStrategicAnalysis);
            }

            this.stateService.setConversationMessages(messages);
            console.log('🔥 Messages being set to state:', messages);

            // Add another setTimeout to ensure Angular has time to process
            setTimeout(() => {
              this.cdr.markForCheck();
              this.cdr.detectChanges();

              // Debug: Check what the observable is emitting
              this.conversationMessages$.subscribe(msgs => {
                console.log('🔥 Observable value after setting:', msgs);
                msgs.forEach((msg, idx) => {
                  if (msg.hasStrategicAnalysis) {
                    console.log(`🔥 Message ${idx} has hasStrategicAnalysis:`, msg.hasStrategicAnalysis);
                  }
                });
              }).unsubscribe();

              console.log('🔥 FINAL: Change detection triggered after delay');
            }, 100);

            console.log('🔥 Messages set and first timeout complete');
          }, 0);

          // Check if this is a draft conversation - activate drafting mode
          if (conv.type === 'draft' && conv.relatedDraftId) {
            console.log('Loading draft document for conversation:', conv.relatedDraftId);

            // Load the draft document from backend
            this.documentGenerationService.getDocument(conv.relatedDraftId, this.currentUser?.id)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (document) => {
                  console.log('Loaded draft document:', document);

                  // Populate document state
                  this.currentDocumentId = document.id;
                  // Extract professional title from document content (first # heading)
                  this.activeDocumentTitle = this.extractTitleFromMarkdown(document.content) || conv.title;
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

                  console.log('📄 Document loaded, length:', document.content?.length || 0);

                  // CRITICAL: Cancel any pending content load from previous document
                  if (this.contentLoadTimeoutId !== null) {
                    console.log('🚫 Cancelling previous document load timeout');
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
                    this.quillEditorInstance = null;

                    // Recreate editor component
                    this.showEditor = true;

                    // Activate drafting mode
                    this.stateService.setDraftingMode(true);
                    this.stateService.setShowChat(true);
                    this.stateService.setShowBottomSearchBar(false);

                    // Auto-switch to THOROUGH mode for drafting
                    this.setModeForDrafting();

                    this.cdr.detectChanges();
                  }, 0);
                },
                error: (error) => {
                  console.error('Error loading draft document:', error);
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
            console.log('💬 Loading non-draft conversation in regular chat mode');
            console.log('📈 Setting state: showChat=true, showBottomSearchBar=true, draftingMode=false');

            this.stateService.setShowChat(true);
            this.stateService.setShowBottomSearchBar(true);
            this.stateService.setDraftingMode(false);

            console.log('📈 State after setting:', {
              showChat: this.stateService.getShowChat(),
              showBottomSearchBar: this.stateService.getShowBottomSearchBar(),
              draftingMode: this.stateService.getDraftingMode(),
              isGenerating: this.stateService.getIsGenerating()
            });

            // Use setTimeout to ensure change detection runs after observable emits
            setTimeout(() => {
              this.cdr.detectChanges();
              console.log('✅ Change detection triggered for loaded conversation');
            }, 0);
          }
        },
        error: (error) => {
          console.error('Error loading conversation:', error);
          this.notificationService.error('Error', 'Failed to load conversation. Please try again.');
        }
      });
  }

  // Delete conversation
  deleteConversation(conversationId: string): void {
    const conv = this.stateService.getConversations().find(c => c.id === conversationId);
    if (!conv || !conv.backendConversationId) {
      console.error('Conversation not found or missing backend ID');
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
              console.error('Error deleting conversation:', error);
              this.notificationService.error('Error', 'Failed to delete conversation.');
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

    // Close mobile sidebar if open
    this.closeSidebar();

    console.log('Started new conversation - view reset');
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
    this.documentMetadata = {};

    console.log('Exited drafting mode - returning to welcome screen');
  }

  // ========================================
  // EXPORT METHODS
  // ========================================

  /**
   * Export document to PDF
   * Calls backend API to generate PDF from latest saved version
   */
  exportToPDF(): void {
    if (!this.currentDocumentId || !this.currentUser) {
      this.notificationService.error('Error', 'Document not available');
      return;
    }

    this.notificationService.loading('Preparing PDF', 'Please wait...');

    // Export using backend API which will generate proper PDF format
    // Backend reads latest version from database - no need to save before exporting
    this.documentGenerationService.exportToPDF(
      this.currentDocumentId as number,
      this.currentUser.id
    )
      .subscribe({
        next: (response) => {
          // Extract blob and filename from HTTP response
          const blob = response.body;
          if (!blob) {
            console.error('No blob in response body');
            this.notificationService.error('Error', 'Failed to export PDF.');
            return;
          }

          const fallbackFilename = this.sanitizeFilename(this.activeDocumentTitle) + '.pdf';
          const filename = this.extractFilenameFromHeader(response.headers, fallbackFilename);

          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);

          this.notificationService.success('PDF Exported', `${filename} downloaded successfully`);
        },
        error: (error) => {
          console.error('Error exporting PDF:', error);
          this.notificationService.error('Error', 'Failed to export PDF. Please ensure the backend service is running.');
        }
      });
  }

  /**
   * Export document to Word (DOCX)
   * Calls backend API to generate Word document from latest saved version
   */
  exportToWord(): void {
    if (!this.currentDocumentId || !this.currentUser) {
      console.error('Document ID or user not available for Word export');
      return;
    }

    this.notificationService.loading('Preparing Word document', 'Please wait...');

    // Export using backend API which will generate proper DOCX format
    // Backend reads latest version from database - no need to save before exporting
    this.documentGenerationService.exportToWord(
      this.currentDocumentId as number,
      this.currentUser.id
    )
      .subscribe({
        next: (response) => {
          // Extract blob and filename from HTTP response
          const blob = response.body;
          if (!blob) {
            console.error('No blob in response body');
            this.notificationService.error('Error', 'Failed to export Word document.');
            return;
          }

          const fallbackFilename = this.sanitizeFilename(this.activeDocumentTitle) + '.docx';
          const filename = this.extractFilenameFromHeader(response.headers, fallbackFilename);

          // Download the blob
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);

          this.notificationService.success('Word Document Exported', `${filename} downloaded successfully`);
        },
        error: (err) => {
          console.error('Error exporting to Word:', err);
          this.notificationService.error('Error', 'Failed to export Word document. Please ensure the backend service is running.');
        }
      });
  }

  /**
   * Sanitize filename for safe file system use
   */
  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
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
            console.error('Error deleting conversations:', error);
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

  // Select task (Protégé-style)
  selectedTask: ConversationType = ConversationType.Draft;
  activeTask: ConversationType = ConversationType.Draft;

  selectTask(task: ConversationType): void {
    console.log('⭐ selectTask called:', task);

    this.selectedTask = task;
    this.activeTask = task;
    this.stateService.setActiveConversationId(null);
    this.stateService.clearConversationMessages();

    // Don't set showChat or showBottomSearchBar here - let them be set when:
    // 1. User sends first message (handled in startCustomDraft)
    // 2. User selects existing conversation (handled in loadConversation)

    // Load conversations for this task type
    this.loadConversations();
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

    // Don't auto-upload - wait for user to select analysis type and click "Analyze"
    // this.uploadFiles(); // Removed - now triggered by handleUploadAnalysis()
  }

  /**
   * Upload files to server
   */
  private uploadFiles(sessionId?: number): void {
    const filesToUpload = this.uploadedFiles.filter(f => f.status === 'ready');

    filesToUpload.forEach((fileItem, index) => {
      if (!fileItem.file) return;

      // Step 1: Uploading
      fileItem.status = 'uploading';
      if (index === 0) this.stateService.updateWorkflowStep(1, { status: WorkflowStepStatus.Active });

      // Call document analyzer service with sessionId for cancellation support
      this.documentAnalyzerService.analyzeDocument(
        fileItem.file,
        this.selectedAnalysisType,
        sessionId
      ).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (result) => {
          if (result) {
            // Update file status
            fileItem.status = 'completed';
            fileItem.analysisId = result.id;
            console.log('✅ File analyzed successfully:', result);

            // If this is the last file and analysis is complete
            if (index === filesToUpload.length - 1) {
              // Complete all workflow steps
              this.completeAllWorkflowSteps();
              this.stateService.setIsGenerating(false);

              // Save assistant message to backend with analysis metadata
              // This allows the conversation to be loaded later and open the viewer
              const activeConvId = this.stateService.getActiveConversationId();
              if (activeConvId && sessionId) {
                const assistantContent = `Document analysis completed for ${result.fileName}`;
                this.legalResearchService.addMessageToSession(
                  sessionId,
                  this.currentUser?.id || 1,
                  'assistant',
                  assistantContent,
                  { analysisId: result.id, databaseId: result.databaseId }
                ).pipe(takeUntil(this.destroy$))
                 .subscribe({
                   next: () => console.log('✅ Analysis metadata saved to conversation'),
                   error: (err) => console.error('❌ Failed to save analysis metadata:', err)
                 });
              }

              // Auto-display results in viewer
              this.displayAnalysisResults(result);
            }
          }
        },
        error: (error) => {
          console.error('❌ File analysis failed:', error);
          fileItem.status = 'failed';

          // Mark workflow as failed
          this.stateService.setIsGenerating(false);
          this.stateService.addConversationMessage({
            role: 'assistant',
            content: `❌ Analysis failed: ${error.message || 'Unknown error'}`,
            timestamp: new Date()
          });

          this.notificationService.error('Analysis Failed', `Failed to analyze ${fileItem.name}`);
        }
      });
    });
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
          console.error('URL fetch error:', error);
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
          console.log('Analysis results:', analysis);

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
            } catch (e) {
              console.warn('Failed to parse metadata:', e);
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

          console.log('📈 viewAnalysis - hasStrategicAnalysis:', hasStrategicAnalysis);
          console.log('📈 viewAnalysis - parsedSections keys:', Object.keys(parsedSections));
          console.log('📈 viewAnalysis - originalAnalysis preview:', originalAnalysis.substring(0, 500));

          // Add to conversation as assistant message with proper flags
          console.log('🔍 Setting analysisId from analysis.databaseId:', analysis.databaseId);
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
          console.error('Failed to load analysis:', error);
          this.notificationService.error('Error', 'Failed to load analysis');
        }
      });
  }

  /**
   * Remove file from list
   */
  removeFile(index: number): void {
    this.uploadedFiles.splice(index, 1);
  }

  /**
   * Display analysis results - opens Document Analysis Viewer
   */
  private displayAnalysisResults(result: any): void {
    // Create analyzed document object for state
    const analyzedDoc: AnalyzedDocument = {
      id: result.id,
      databaseId: result.databaseId,
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

    // Open document viewer
    this.stateService.openDocumentViewer(result.id);

    // Show success notification
    this.notificationService.success(
      'Analysis Complete',
      `${result.fileName} has been analyzed successfully`
    );

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
          console.log('📄 Loaded conversation for analysis ID extraction:', response);

          // Find the analysis ID from message metadata
          // Try analysisId (UUID string) first, then databaseId (number) as fallback
          let analysisId: string | null = null;
          let databaseId: number | null = null;

          for (const msg of response.messages) {
            if (msg.metadata) {
              const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
              console.log('📄 Message metadata:', metadata);

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
            console.warn('No analysis ID found in conversation messages, showing chat view instead');
            // Fall back to regular chat view
            this.loadConversationAsChat(conv, response);
            return;
          }

          console.log('📄 Found analysis ID (UUID):', analysisId, 'databaseId:', databaseId);

          // Load the analysis from the backend
          // Use UUID if available, otherwise use database ID
          const analysisObservable = analysisId
            ? this.documentAnalyzerService.getAnalysisById(analysisId)
            : this.documentAnalyzerService.getAnalysisByDatabaseId(databaseId!);

          analysisObservable
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (analysisResult) => {
                console.log('📄 Loaded analysis result:', analysisResult);

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
                console.error('Failed to load analysis:', error);
                this.notificationService.error('Error', 'Failed to load document analysis');
                // Fall back to chat view
                this.loadConversationAsChat(conv, response);
              }
            });
        },
        error: (error) => {
          console.error('Failed to load conversation:', error);
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

    const messages = response.messages.map((msg: any) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: new Date(msg.createdAt || new Date())
    }));

    this.stateService.setConversationMessages(messages);
    this.stateService.setShowChat(true);
    this.cdr.detectChanges();
  }

  /**
   * Open document in viewer (from sidebar)
   * If fullAnalysis is empty, fetch it from backend first
   */
  openDocumentInViewer(document: AnalyzedDocument): void {
    // Check if we need to fetch full analysis
    if (!document.analysis?.fullAnalysis && document.databaseId) {
      // Fetch full analysis from backend
      this.documentAnalyzerService.getAnalysisByDatabaseId(document.databaseId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (result) => {
            console.log('📄 Loaded full analysis for document:', result.fileName);

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
          error: (error) => {
            console.error('Failed to load full analysis:', error);
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
   * Export document analysis as PDF
   */
  onExportPdf(document: AnalyzedDocumentData): void {
    // TODO: Implement PDF export
    console.log('Exporting as PDF:', document.fileName);
    this.notificationService.info('Coming Soon', 'PDF export will be available soon');
  }

  /**
   * Export document analysis as Word
   */
  onExportWord(document: AnalyzedDocumentData): void {
    // TODO: Implement Word export
    console.log('Exporting as Word:', document.fileName);
    this.notificationService.info('Coming Soon', 'Word export will be available soon');
  }

  /**
   * Save analysis to File Manager
   */
  onSaveToFileManager(document: AnalyzedDocumentData): void {
    // TODO: Implement File Manager integration
    console.log('Saving to File Manager:', document.fileName);
    this.notificationService.info('Coming Soon', 'File Manager integration will be available soon');
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
      } catch (e) {
        console.warn('Failed to parse metadata:', e);
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

    console.log('📈 New analysis - hasStrategicAnalysis:', hasStrategicAnalysis);
    console.log('📈 New analysis - parsedSections keys:', Object.keys(parsedSections));
    console.log('📈 New analysis - originalAnalysis preview:', originalAnalysis.substring(0, 500));

    // Add to local state
    // Store BOTH IDs: result.id (UUID string for API) and result.databaseId (number for action items)
    console.log('🔍 Setting analysisId from result.id:', result.id, 'databaseId:', result.databaseId);
    const assistantMessage = {
      role: 'assistant' as 'assistant',
      content: formattedAnalysis,
      timestamp: new Date(),
      hasStrategicAnalysis,
      parsedSections,
      analysisId: result.databaseId
    };
    this.stateService.addConversationMessage(assistantMessage);
    console.log('🔍 Message added to state:', assistantMessage);
    console.log('🔍 All messages after add:', this.stateService.getConversationMessages());

    // Show chat panel to display the analysis tabs
    this.stateService.setShowChat(true);

    // Use setTimeout to ensure change detection runs after observable emits
    setTimeout(() => {
      this.cdr.detectChanges();
      console.log('🔍 Forced change detection after message add');
    }, 0);

    // Persist to database and update conversation object
    const activeConvId = this.stateService.getActiveConversationId();
    if (activeConvId) {
      const conv = this.stateService.getConversations().find(c => c.id === activeConvId);
      if (conv && conv.backendConversationId) {
        // Persist assistant message to database with metadata
        // IMPORTANT: Save ORIGINAL MARKDOWN (not HTML) so tabs can parse sections on reload
        // Store result.id (UUID) for API calls, result.databaseId (number) for action items
        console.log('💾 Saving to database:', {
          sessionId: conv.backendConversationId,
          contentLength: originalAnalysis.length,
          contentPreview: originalAnalysis.substring(0, 100),
          metadata: { analysisId: result.id, databaseId: result.databaseId }
        });

        this.legalResearchService.addMessageToSession(
          conv.backendConversationId,
          this.currentUser.id,
          'assistant',
          originalAnalysis,  // ← Save markdown, not formattedAnalysis
          { analysisId: result.id, databaseId: result.databaseId }
        ).pipe(takeUntil(this.destroy$))
         .subscribe({
           next: (response) => {
             console.log('✅ Assistant message persisted to database:', response);
             console.log('✅ Metadata in response:', response.metadata);

             // Update conversation object in sidebar for message count badge
             conv.messages.push(assistantMessage);
             conv.messageCount = (conv.messageCount || 0) + 1;
             console.log(`Updated conversation ${activeConvId} messages count: ${conv.messages.length}, messageCount: ${conv.messageCount}`);

             // Force change detection to update badge
             this.cdr.detectChanges();
           },
           error: (err) => {
             console.error('❌ Failed to persist assistant message:', err);
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
    console.log('🔧 enhanceAnalysisWithStyling called');
    console.log('📝 Input markdown length:', markdown.length);
    console.log('📄 First 500 chars of input:', markdown.substring(0, 500));

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

    console.log('✅ Output HTML length:', result.length);
    console.log('📄 First 1000 chars of output:', result.substring(0, 1000));
    console.log('🔍 Contains .ai-document-analysis wrapper:', result.includes('ai-document-analysis'));
    console.log('🔍 Contains tables:', result.includes('<table'));
    console.log('🔍 Contains timelines:', result.includes('timeline'));

    return result;
  }

  /**
   * Parse strategic analysis into sections for tabbed display
   */
  private parseStrategicSections(markdown: string): any {
    const sections: any = {};

    console.log('🔍 parseStrategicSections - Input markdown length:', markdown.length);
    console.log('🔍 parseStrategicSections - First 200 chars:', markdown.substring(0, 200));

    // Check if this is strategic analysis (contains markers)
    if (!markdown.includes('EXECUTIVE') && !markdown.includes('CRITICAL') && !markdown.includes('STRATEGIC')) {
      console.log('⚠️ Not strategic analysis - no markers found');
      return sections;
    }

    // Extract overview/executive section (includes the ## ⚡ EXECUTIVE section)
    // Using [\s\S] instead of . for browser compatibility (. doesn't match newlines without 's' flag)
    const overviewMatch = markdown.match(/##\s*⚡[\s\S]*?(?=\n##\s+[🎯⚡💰🚨📈⏱️🛡️📝💡]|$)/i);
    if (overviewMatch) {
      sections.overview = overviewMatch[0];
      console.log('✅ Overview matched, length:', sections.overview.length, 'preview:', sections.overview.substring(0, 100));
    } else {
      // Fallback: extract content up to first major section (or full content if no sections)
      const firstSectionMatch = markdown.match(/([\s\S]*?)(?=\n##\s+[🎯💰🚨📈⏱️🛡️📝💡]|$)/);
      sections.overview = firstSectionMatch ? firstSectionMatch[1] : markdown;
      console.log('⚠️ Overview fallback used, length:', sections.overview.length);
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
        console.log('✅ Weaknesses matched, length:', sections.weaknesses.length, 'preview:', sections.weaknesses.substring(0, 100));
        break;
      }
    }
    if (!sections.weaknesses) {
      console.log('❌ No weaknesses section matched');
    }

    // Extract timeline (flexible for all document types)
    const timelineMatch = markdown.match(/##\s*⏱️[\s\S]*?(ACTION\s+)?TIMELINE[\s\S]*?(?=\n##\s+[🎯⚡💰🚨📈⏱️🛡️📝💡]|$)/gi);
    if (timelineMatch) {
      sections.timeline = timelineMatch[0];
      console.log('✅ Timeline matched, length:', sections.timeline.length);
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
        console.log('✅ Evidence matched, length:', sections.evidence.length, 'preview:', sections.evidence.substring(0, 100));
        break;
      }
    }
    if (!sections.evidence) {
      console.log('❌ No evidence section matched');
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
        console.log('✅ Strategy matched, length:', sections.strategy.length, 'preview:', sections.strategy.substring(0, 100));
        break;
      }
    }
    if (!sections.strategy) {
      console.log('❌ No strategy section matched');
    }

    console.log('🔍 Final sections keys:', Object.keys(sections));
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
      this.notificationService.warning('Coming Soon', 'PDF export with strategic formatting will be available soon');
    }, 500);
  }

  /**
   * Create a draft document from strategic analysis
   */
  createDraftFromAnalysis(message: any): void {
    this.notificationService.info('Draft', 'Creating draft from analysis...');
    // TODO: Extract key points and create a draft response
    setTimeout(() => {
      this.notificationService.warning('Coming Soon', 'Automatic draft creation will be available soon');
    }, 500);
  }

  /**
   * Research citations mentioned in analysis
   */
  researchCitations(message: any): void {
    this.notificationService.info('Research', 'Analyzing citations...');
    // TODO: Extract case citations and launch research
    setTimeout(() => {
      this.notificationService.warning('Coming Soon', 'Citation research integration will be available soon');
    }, 500);
  }

  /**
   * Schedule reminders based on timeline
   */
  scheduleReminders(message: any): void {
    this.notificationService.info('Reminders', 'Setting up timeline reminders...');
    // TODO: Extract dates from timeline and create calendar events
    setTimeout(() => {
      this.notificationService.warning('Coming Soon', 'Automatic reminder scheduling will be available soon');
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
          id: 'demand-letter',
          name: 'Demand Letter',
          placeholderExample: 'Draft a demand letter seeking $50,000 in damages for personal injuries sustained in a car accident...'
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

    // Find the selected pill across all categories
    for (const category of this.documentTypeCategories) {
      const selectedPill = category.types.find(p => p.id === pillId);
      if (selectedPill) {
        console.log(`Selected document type: ${selectedPill.name} (${category.name})`);
        break;
      }
    }
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

    // Create conversation in backend first
    this.legalResearchService.createGeneralConversation(title, this.selectedResearchMode, 'ANALYZE_DOCUMENT')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          console.log('Created upload analysis conversation:', session);

          // Persist user message to database
          this.legalResearchService.addMessageToSession(
            session.id,
            this.currentUser.id,
            'user',
            userMessage
          ).pipe(takeUntil(this.destroy$))
           .subscribe({
             next: () => console.log('✅ User message persisted to database'),
             error: (err) => console.error('❌ Failed to persist user message:', err)
           });

          // Add to conversations list
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

          // Now proceed with document analysis - pass session.id for cancellation support
          this.uploadFiles(session.id);
        },
        error: (error) => {
          console.error('Error creating conversation:', error);
          this.stateService.setIsGenerating(false);
          this.notificationService.error('Error', 'Failed to create conversation for document analysis');
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
    this.initializeWorkflowSteps(this.selectedTask);
    this.animateWorkflowSteps();

    // FORK: Different logic for 'draft' task vs other tasks
    if (this.selectedTask === 'draft') {
      // DOCUMENT GENERATION FLOW - Use document generation service
      this.generateDocumentFlow(userPrompt);
    } else {
      // Q&A CONVERSATION FLOW - Use existing conversation service
      this.generateConversationFlow(userPrompt);
    }
  }

  // Document generation flow for 'draft' task
  private generateDocumentFlow(userPrompt: string): void {
    const title = userPrompt.substring(0, 50) + (userPrompt.length > 50 ? '...' : '');

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
      researchMode: this.selectedResearchMode
    };

    // Add temp conversation and set as active BEFORE making request
    this.stateService.addConversation(tempConv);
    this.stateService.setActiveConversationId(tempConvId);

    console.log('🔵 Created temporary conversation for cancellation:', tempConvId);

    // Determine document type: use selected pill OR auto-detect from prompt
    let documentType: string;
    if (this.selectedDocTypePill) {
      documentType = this.selectedDocTypePill;
      console.log('📋 Using selected document type:', documentType);
    } else {
      documentType = this.detectDocumentTypeFromPrompt(userPrompt);
      console.log('🔍 Auto-detected document type from prompt:', documentType);
      console.log('⚠️ No document type selected - using auto-detection fallback');
    }

    // Prepare draft generation request
    const draftRequest = {
      userId: this.currentUser.id,
      caseId: this.selectedCaseId,
      prompt: userPrompt,
      documentType: documentType,
      jurisdiction: this.selectedJurisdiction,
      sessionName: title,
      researchMode: this.selectedResearchMode  // Pass selected research mode (FAST or THOROUGH)
    };

    // First, initialize the conversation to get backend ID immediately
    this.documentGenerationService.initDraftConversation(draftRequest)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (initResponse) => {
          console.log('🔵 Initialized conversation:', initResponse.conversationId);

          // Update temp conversation with real backend ID
          const tempConvInList = this.stateService.getConversations().find(c => c.id === tempConvId);
          if (tempConvInList) {
            tempConvInList.backendConversationId = initResponse.conversationId;
            console.log('✅ Temp conversation updated with backend ID:', initResponse.conversationId);
          }

          // Now call the generate endpoint with the conversation ID so it reuses the same conversation
          const draftRequestWithConversation = {
            ...draftRequest,
            conversationId: initResponse.conversationId
          };

          this.documentGenerationService.generateDraftWithConversation(draftRequestWithConversation)
            .pipe(takeUntil(merge(this.destroy$, this.cancelGeneration$)))
            .subscribe({
              next: (response) => {
                console.log('Draft generated with conversation:', response);

          // Complete workflow steps
          this.completeAllWorkflowSteps();

          // Update the temporary conversation with real backend ID
          const conversations = this.stateService.getConversations();
          const tempConvIndex = conversations.findIndex(c => c.id === tempConvId);

          if (tempConvIndex !== -1) {
            // Update existing temp conversation with real data
            conversations[tempConvIndex] = {
              ...conversations[tempConvIndex],
              id: `conv_${response.conversationId}`,
              title: response.conversation.sessionName,
              backendConversationId: response.conversationId,
              relatedDraftId: response.documentId.toString(),
              taskType: response.conversation.taskType as TaskType
            };

            // Update active conversation ID to the real one
            this.stateService.setActiveConversationId(`conv_${response.conversationId}`);

            console.log('✅ Updated temp conversation with backend ID:', response.conversationId);
          }

          // Reload conversations from backend to ensure sidebar is up-to-date
          // This is more reliable than relying on state updates alone
          this.loadConversations();

          // Trigger change detection to update sidebar with new conversation
          this.cdr.detectChanges();

          // Store document metadata
          this.currentDocumentId = response.document.id;
          // Extract professional title from document content (first # heading) instead of using user prompt
          this.activeDocumentTitle = this.extractTitleFromMarkdown(response.document.content) || title;

          console.log('Document content received:', {
            contentLength: response.document.content?.length || 0,
            contentPreview: response.document.content?.substring(0, 200) || 'NO CONTENT',
            wordCount: response.document.wordCount,
            documentId: response.document.id
          });

          this.currentDocumentWordCount = response.document.wordCount;
          this.currentDocumentPageCount = this.documentGenerationService.estimatePageCount(response.document.wordCount);
          this.documentMetadata = {
            tokensUsed: response.document.tokensUsed,
            costEstimate: response.document.costEstimate,
            generatedAt: new Date(response.document.generatedAt),
            version: response.document.version
          };

          // Load version history for dropdown
          this.loadVersionHistory();

          console.log('📄 Document generated, length:', response.document.content?.length || 0);

          // CRITICAL: Cancel any pending content load from previous document
          if (this.contentLoadTimeoutId !== null) {
            console.log('🚫 Cancelling previous document load timeout');
            clearTimeout(this.contentLoadTimeoutId);
            this.contentLoadTimeoutId = null;
          }

          // Store content in pending property - will be loaded in onEditorCreated()
          this.pendingDocumentContent = response.document.content || '';

          // Add assistant message
          this.stateService.addConversationMessage({
            role: 'assistant',
            content: `I've generated your ${this.selectedDocTypePill || 'document'}${this.selectedCaseId ? ' for the selected case' : ''}. You can view it in the document preview panel.`,
            timestamp: new Date()
          });

          // FORCE editor destruction and recreation
          this.showEditor = false;
          this.cdr.detectChanges();

          // Recreate editor - content will load automatically in onEditorCreated()
          setTimeout(() => {
            // Clear editor instance BEFORE recreating component
            this.quillEditorInstance = null;

            // Recreate editor component
            this.showEditor = true;

            // ACTIVATE SPLIT-VIEW DRAFTING MODE
            this.stateService.setDraftingMode(true);
            this.stateService.setIsGenerating(false);

            // Auto-switch to THOROUGH mode for drafting
            this.setModeForDrafting();

            this.cdr.detectChanges();
          }, 0);
        },
        error: (error) => {
          console.error('Error generating document:', error);

          // Remove temp conversation if it still exists
          const conversations = this.stateService.getConversations();
          const tempIndex = conversations.findIndex(c => c.id === tempConvId);
          if (tempIndex !== -1) {
            conversations.splice(tempIndex, 1);
            console.log('🗑️ Removed temporary conversation after error');
          }

          // Mark workflow as error
          if (this.stateService.getWorkflowSteps().length > 0) {
            const steps = this.stateService.getWorkflowSteps(); if (steps.length > 0) this.stateService.updateWorkflowStep(steps[steps.length - 1].id, { status: 'error' as any });
          }

          this.stateService.addConversationMessage({
            role: 'assistant',
            content: 'Sorry, I encountered an error generating the document. Please try again.',
            timestamp: new Date()
          });

          this.stateService.setIsGenerating(false);
          this.stateService.setShowBottomSearchBar(true);
          this.stateService.setActiveConversationId(null);
          this.cdr.detectChanges();
        }
      });
        },
        error: (error) => {
          console.error('Error initializing draft conversation:', error);

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

    // Create conversation
    this.legalResearchService.createGeneralConversation(title, researchMode, taskType)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          console.log('Created conversation:', session);

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

          // Re-group conversations

          // Send message to get AI response
          if (session.id) {
            // Capture conversation ID at request time to prevent race condition
            const requestConversationId = newConv.id;
            const requestBackendId = session.id;

            this.legalResearchService.sendMessageToConversation(requestBackendId, userPrompt, researchMode)
              .pipe(takeUntil(merge(this.destroy$, this.cancelGeneration$)))
              .subscribe({
                next: (message) => {
                  console.log('Received AI response for conversation:', requestConversationId);

                  // Only update UI if THIS conversation is still active (prevents race condition)
                  if (this.stateService.getActiveConversationId() === requestConversationId) {
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
                    this.stateService.addConversationMessage(assistantMessage);

                    // ALSO update the conversation object in sidebar for message count badge
                    const conv = this.stateService.getConversations().find(c => c.id === requestConversationId);
                    if (conv) {
                      conv.messages.push(assistantMessage);
                      conv.messageCount = (conv.messageCount || 0) + 1; // Increment message count
                      console.log(`Updated conversation ${requestConversationId} messages count: ${conv.messages.length}, messageCount: ${conv.messageCount}`);
                      // Force change detection to update badge
                      this.cdr.detectChanges();
                    }

                    this.stateService.setIsGenerating(false);
                    this.stateService.setShowBottomSearchBar(true);
                    this.cdr.detectChanges();
                  } else {
                    console.log('Response arrived for inactive conversation, ignoring UI update');
                    this.stateService.setIsGenerating(false);
                  }
                },
                error: (error) => {
                  console.error('Error getting AI response:', error);

                  // Mark workflow as error
                  if (this.stateService.getWorkflowSteps().length > 0) {
                    const steps = this.stateService.getWorkflowSteps(); if (steps.length > 0) this.stateService.updateWorkflowStep(steps[steps.length - 1].id, { status: 'error' as any });
                  }

                  this.stateService.addConversationMessage({
                    role: 'assistant',
                    content: 'Sorry, I encountered an error processing your request. Please try again.'
                  });
                  this.stateService.setIsGenerating(false);
                  this.stateService.setShowBottomSearchBar(true);
                  this.cdr.detectChanges();
                }
              });
          }
        },
        error: (error) => {
          console.error('Error creating conversation:', error);
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

  // Apply drafting tool
  // Apply drafting tool (simplify, condense, expand, redraft) - REAL BACKEND CALL
  // Smart button: applies to selection if text is selected, otherwise to full document
  applyDraftingTool(tool: 'simplify' | 'condense' | 'expand' | 'redraft'): void {
    console.log(`🔧 applyDraftingTool('${tool}') called`);
    console.log(`  selectedText:`, this.selectedText?.substring(0, 50) || 'NONE');
    console.log(`  selectionRange:`, this.selectionRange);

    if (!this.currentDocumentId) {
      this.notificationService.warning('No Document', 'Please generate a document first before applying revisions.');
      return;
    }

    // Check if text is selected - if so, apply to selection only
    if (this.selectedText && this.selectionRange) {
      console.log(`  ✅ Applying ${tool} to SELECTED text (${this.selectedText.length} chars)`);
      this.applySelectionTransform(tool);
      return;
    }

    // Otherwise, apply to full document
    console.log(`  ⚠️ No selection, applying ${tool} to FULL document`);

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

    this.stateService.addConversationMessage({
      role: 'user',
      content: toolPrompt,
      timestamp: new Date()
    });

    // Call backend transformation service (AI Workspace API)
    this.stateService.setIsGenerating(true);

    // Initialize and animate workflow steps
    this.initializeWorkflowSteps('transform');
    this.animateWorkflowSteps();

    const transformRequest = {
      documentId: this.currentDocumentId as number,
      transformationType: tool.toUpperCase(),
      transformationScope: 'FULL_DOCUMENT' as const,
      fullDocumentContent: this.activeDocumentContent,
      jurisdiction: this.selectedJurisdiction,
      documentType: this.selectedDocTypePill
    };

    this.documentGenerationService.transformDocument(transformRequest, this.currentUser?.id)
      .pipe(takeUntil(merge(this.destroy$, this.cancelGeneration$)))
      .subscribe({
        next: (response) => {
          // Complete workflow steps
          this.completeAllWorkflowSteps();

          // Generate unique message ID
          const messageId = `transform_${Date.now()}_${this.transformationMessageIdCounter++}`;

          // Add assistant message with inline comparison
          this.stateService.addConversationMessage({
            id: messageId,
            role: 'assistant',
            content: response.explanation,
            timestamp: new Date(),
            transformationComparison: {
              oldContent: this.activeDocumentContent,
              newContent: response.transformedContent,
              transformationType: tool,
              scope: 'FULL_DOCUMENT',
              response: response
            }
          });

          this.stateService.setIsGenerating(false);
          this.cdr.detectChanges();
          this.scrollToBottom();
        },
        error: (error) => {
          console.error('Error applying drafting tool:', error);

          this.stateService.addConversationMessage({
            role: 'assistant',
            content: 'Sorry, I encountered an error applying the revision. Please try again.',
            timestamp: new Date()
          });

          this.stateService.setIsGenerating(false);
          this.cdr.detectChanges();

          this.notificationService.error('Revision Failed', 'Failed to apply document revision. Please try again.', 3000);
        }
      });
  }

  // ========================================
  // QUILL EDITOR EVENT HANDLERS
  // ========================================

  /**
   * Robust helper to set Quill editor content from markdown
   * Handles clipboard.convert() failures and has multiple fallbacks
   * Used by: loadDocumentContent, acceptTransformation, restoreVersion
   * NOTE: Caller should wrap this in setTimeout(100) for Quill clipboard initialization
   */
  private setQuillContentFromMarkdown(markdownContent: string): void {
    if (!this.quillEditorInstance) {
      console.warn('⚠️ Cannot set content - Quill editor instance not available');
      return;
    }

    // Convert Markdown to HTML
    const htmlContent = this.markdownConverter.convert(markdownContent);
    console.log('📋 HTML content generated, length:', htmlContent.length);
    console.log('📋 HTML preview (first 1000 chars):', htmlContent.substring(0, 1000));

    try {
      // CRITICAL: Use dangerouslyPasteHTML directly instead of clipboard.convert
      // This properly handles lists, tables, and all HTML elements
      console.log('📋 Using dangerouslyPasteHTML to insert content...');

      // Clear existing content first
      this.quillEditorInstance.setText('');

      // Insert HTML at position 0 using dangerouslyPasteHTML
      // This converts HTML to proper Quill Delta automatically
      this.quillEditorInstance.clipboard.dangerouslyPasteHTML(0, htmlContent, 'silent');

      // Verify content was set
      const editorText = this.quillEditorInstance.getText();
      const delta = this.quillEditorInstance.getContents();
      console.log('✅ Content inserted successfully');
      console.log('✅ Editor text length:', editorText.length);
      console.log('✅ Delta ops count:', delta.ops?.length || 0);

    } catch (error) {
      console.error('❌ Failed to set content via dangerouslyPasteHTML:', error);
      console.log('⚠️ Fallback: Setting innerHTML directly');
      // Fallback to direct innerHTML if dangerouslyPasteHTML fails
      this.quillEditorInstance.root.innerHTML = htmlContent;
      console.log('✅ Content set via innerHTML fallback');
    }
  }

  /**
   * Load document content into Quill editor
   * Handles clearing previous content and pasting new HTML
   * Can be called from onEditorCreated() or when switching documents
   */
  private loadDocumentContent(markdownContent: string): void {
    if (!this.quillEditorInstance) {
      console.warn('⚠️ Cannot load content - Quill editor instance not available');
      return;
    }

    if (!markdownContent) {
      console.warn('⚠️ Cannot load content - no markdown content provided');
      return;
    }

    // CRITICAL: Cancel any pending content load timeout to prevent race conditions
    if (this.contentLoadTimeoutId !== null) {
      console.log('🚫 Cancelling previous content load timeout:', this.contentLoadTimeoutId);
      clearTimeout(this.contentLoadTimeoutId);
      this.contentLoadTimeoutId = null;
    }

    console.log('📄 Loading document content');
    console.log('📄 Markdown length:', markdownContent.length);
    console.log('📄 Markdown preview:', markdownContent.substring(0, 300));

    // Convert Markdown to HTML
    const htmlContent = this.markdownConverter.convert(markdownContent);
    console.log('🔄 HTML length:', htmlContent.length);
    console.log('🔄 HTML preview:', htmlContent.substring(0, 500));
    console.log('🔄 HTML contains <h1>?', htmlContent.includes('<h1>'));
    console.log('🔄 HTML contains <strong>?', htmlContent.includes('<strong>'));
    console.log('🔄 HTML contains <p>?', htmlContent.includes('<p>'));

    // CRITICAL: Use Quill's proper Delta API with setTimeout
    // setTimeout allows Quill's clipboard module to fully initialize
    // MUST use 100ms delay (matches pattern used successfully elsewhere in codebase)
    this.contentLoadTimeoutId = window.setTimeout(() => {
      // Clear the timeout ID since it's now executing
      this.contentLoadTimeoutId = null;

      // Use robust helper that handles clipboard.convert() failures
      this.setQuillContentFromMarkdown(markdownContent);
    }, 100); // CRITICAL: Must be 100ms, not 0ms!

    // Force contenteditable and selection on the editor root and all children
    const editorRoot = this.quillEditorInstance.root;
    if (editorRoot) {
      editorRoot.setAttribute('contenteditable', 'true');
      editorRoot.style.userSelect = 'text';
      editorRoot.style.webkitUserSelect = 'text';
      editorRoot.style.cursor = 'text';

      // Force selection on all newly created child elements
      setTimeout(() => {
        const allChildren = editorRoot.querySelectorAll('*');
        allChildren.forEach((child: Element) => {
          const htmlChild = child as HTMLElement;
          htmlChild.style.userSelect = 'text';
          htmlChild.style.webkitUserSelect = 'text';
          htmlChild.style.cursor = 'text';
        });
        console.log('✅ Selection enabled on', allChildren.length, 'child elements');
      }, 100);
    }

    console.log('✅ Content loaded successfully');
  }

  /**
   * Handle Quill editor creation - capture direct reference
   */
  onEditorCreated(quill: any): void {
    this.quillEditorInstance = quill;
    console.log('✅ Quill editor created');

    // Enable text selection explicitly
    if (quill) {
      quill.enable(true);

      // CRITICAL: Load content here if pending - this is the ONLY reliable place
      // onEditorCreated fires when editor is actually ready, not based on setTimeout guessing
      if (this.pendingDocumentContent) {
        console.log('⭐ Loading pending content (length: ' + this.pendingDocumentContent.length + ')');
        this.loadDocumentContent(this.pendingDocumentContent);
        this.pendingDocumentContent = null;
      }

      // Force ensure the editor and all its children are selectable
      const editorElement = quill.root;
      if (editorElement) {
        editorElement.setAttribute('contenteditable', 'true');
        editorElement.style.userSelect = 'text';
        editorElement.style.webkitUserSelect = 'text';
        editorElement.style.mozUserSelect = 'text';
        editorElement.style.msUserSelect = 'text';
        editorElement.style.cursor = 'text';

        // Force selection on all child elements
        const allChildren = editorElement.querySelectorAll('*');
        allChildren.forEach((child: Element) => {
          const htmlChild = child as HTMLElement;
          htmlChild.style.userSelect = 'text';
          htmlChild.style.webkitUserSelect = 'text';
        });

        // Make all links open in new window
        editorElement.addEventListener('click', (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          if (target && target.tagName === 'A') {
            e.preventDefault();
            const href = target.getAttribute('href');
            if (href) {
              window.open(href, '_blank', 'noopener,noreferrer');
            }
          }
        });

        // Ensure all existing and future links have target="_blank"
        const updateLinks = () => {
          const links = editorElement.querySelectorAll('a');
          links.forEach((link: Element) => {
            const anchor = link as HTMLAnchorElement;
            anchor.target = '_blank';
            anchor.rel = 'noopener noreferrer';
          });
        };

        // Update existing links
        updateLinks();

        // Watch for new links
        quill.on('text-change', () => {
          updateLinks();
        });

        console.log('✅ Editor configured for text selection and link handling');
      }
    }
  }

  /**
   * Handle text selection changes in Quill editor
   */
  onTextSelectionChanged(event: any): void {
    console.log('📝 onTextSelectionChanged called:', event);

    if (!event || !event.range) {
      // No selection
      console.log('  ❌ No event or range, clearing selection');
      this.selectedText = '';
      this.selectionRange = null;
      return;
    }

    const { index, length } = event.range;
    console.log('  Range:', { index, length });

    if (length > 0 && this.quillEditorInstance) {
      // User has selected text
      this.selectedText = this.quillEditorInstance.getText(index, length);
      this.selectionRange = { index, length };
      console.log('  ✅ Selection captured:', this.selectedText.substring(0, 50));
      console.log('  📍 Now you can use drafting tools!');
    } else {
      // Selection cleared
      this.selectedText = '';
      this.selectionRange = null;
      console.log('  ⚠️ Selection cleared (length = 0)');
    }

    // DO NOT call cdr.detectChanges() here - it destroys the selection
    // Angular's natural change detection handles property updates
  }

  /**
   * Handle document content changes
   * Debounced to avoid disrupting text selection
   */
  onDocumentContentChanged(event: any): void {
    // Get content directly from Quill editor event
    const htmlContent = event.html || '';
    const plainText = event.text || '';

    // Let Quill maintain its own internal state
    // We'll sync activeDocumentContent after debounce for tracking purposes only

    // Clear previous debounce timer
    if (this.contentChangeDebounce) {
      clearTimeout(this.contentChangeDebounce);
    }

    // Debounce the state update to avoid disrupting selection
    this.contentChangeDebounce = setTimeout(() => {
      // Update local property only after debounce (for other components that read it)
      this.activeDocumentContent = htmlContent;

      // Calculate word count and page count
      this.currentDocumentWordCount = this.documentGenerationService.countWords(plainText);
      this.currentDocumentPageCount = this.documentGenerationService.estimatePageCount(this.currentDocumentWordCount);

      // Update state service with debounced changes
      this.stateService.updateDocumentContent(
        htmlContent,
        this.currentDocumentWordCount,
        this.currentDocumentPageCount
      );
    }, 300); // 300ms debounce
  }

  /**
   * Apply transformation to selected text only
   */
  applySelectionTransform(tool: string): void {
    if (!this.selectedText || !this.selectionRange || !this.quillEditorInstance) {
      console.log('No text selected for transformation');
      return;
    }

    console.log(`Applying "${tool}" to selected text:`, this.selectedText.substring(0, 50) + '...');

    // Get transformation prompt
    let toolPrompt = '';
    switch (tool) {
      case 'simplify':
        toolPrompt = `Please simplify the following text to make it more accessible:\n\n"${this.selectedText}"`;
        break;
      case 'condense':
        toolPrompt = `Please condense the following text to make it more concise:\n\n"${this.selectedText}"`;
        break;
      case 'expand':
        toolPrompt = `Please expand the following text with more detail:\n\n"${this.selectedText}"`;
        break;
      case 'redraft':
        toolPrompt = `Please redraft the following text entirely with a fresh approach:\n\n"${this.selectedText}"`;
        break;
      default:
        toolPrompt = `Please improve the following text:\n\n"${this.selectedText}"`;
    }

    // Add user message
    this.stateService.addConversationMessage({
      role: 'user',
      content: toolPrompt,
      timestamp: new Date()
    });

    // Call backend for selection-based transformation
    this.stateService.setIsGenerating(true);

    // Initialize and animate workflow steps
    this.initializeWorkflowSteps('transform');
    this.animateWorkflowSteps();

    // Get plain text from Quill for accurate index-based replacement
    const quill = this.quillEditorInstance;
    const fullPlainText = quill.getText();

    const transformRequest = {
      documentId: this.currentDocumentId as number,
      transformationType: tool.toUpperCase(),
      transformationScope: 'SELECTION' as const,
      fullDocumentContent: fullPlainText, // Send PLAIN TEXT, not HTML
      selectedText: this.selectedText,
      selectionStartIndex: this.selectionRange.index,
      selectionEndIndex: this.selectionRange.index + this.selectionRange.length,
      jurisdiction: this.selectedJurisdiction,
      documentType: this.selectedDocTypePill
    };

    this.documentGenerationService.transformDocument(transformRequest, this.currentUser?.id)
      .pipe(takeUntil(merge(this.destroy$, this.cancelGeneration$)))
      .subscribe({
        next: (response) => {
          // Complete workflow steps
          this.completeAllWorkflowSteps();

          // Generate unique message ID
          const messageId = `transform_${Date.now()}_${this.transformationMessageIdCounter++}`;

          // Add AI response to conversation with inline comparison
          this.stateService.addConversationMessage({
            id: messageId,
            role: 'assistant',
            content: response.explanation,
            timestamp: new Date(),
            transformationComparison: {
              oldContent: this.selectedText || '',
              newContent: response.transformedSelection || '', // ONLY use snippet, not full doc
              transformationType: tool,
              scope: 'SELECTION',
              response: response,
              fullDocumentContent: fullPlainText, // Store PLAIN TEXT for context view
              selectionRange: { index: this.selectionRange.index, length: this.selectionRange.length } // Store for precise replacement
            }
          });

          this.stateService.setIsGenerating(false);
          this.cdr.detectChanges();
          this.scrollToBottom();
        },
        error: (error) => {
          console.error('Error transforming selection:', error);
          this.stateService.addConversationMessage({
            role: 'assistant',
            content: `Sorry, I encountered an error while transforming the text. Please try again.`,
            timestamp: new Date()
          });
          this.stateService.setIsGenerating(false);
          this.cdr.detectChanges();

          this.notificationService.error('Transformation Failed', 'Failed to transform selected text. Please try again.', 3000);
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

    console.log('Saving document:', this.currentDocumentId);

    // Call backend to save document
    this.documentGenerationService.saveDocument(
      this.currentDocumentId,
      this.activeDocumentContent,
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
        console.error('Error saving document:', error);
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

    console.log(`Downloading document ${this.currentDocumentId} as ${format}`);

    // Call backend export service
    this.documentGenerationService.exportDocument(this.currentDocumentId, format)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Extract blob from HTTP response
          const blob = response.body;
          if (!blob) {
            console.error('No blob in response body');
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

          console.log(`Document downloaded as: ${filename}`);
          this.notificationService.success('Downloaded!', `${filename} downloaded successfully`);
        },
        error: (error) => {
          console.error('Error exporting document:', error);
          this.notificationService.error('Export Failed', 'Failed to export document. Please try again.', 3000);
        }
      });
  }

  // Download document by ID (shared method) - kept for backward compatibility
  private downloadDocumentById(documentId: string, format: 'docx' | 'pdf'): void {
    this.currentDocumentId = documentId;
    this.downloadDocument(format);

    console.log(`Download initiated: ${format.toUpperCase()}`);
  }

  /**
   * Extract filename from Content-Disposition header
   * Parses: Content-Disposition: attachment; filename="Motion_to_Dismiss.pdf"
   * Returns the filename or a fallback if not found
   */
  private extractFilenameFromHeader(headers: any, fallbackName: string): string {
    try {
      const contentDisposition = headers.get('Content-Disposition');

      // Debug: Log raw header value
      console.log('🔍 RAW Content-Disposition header:', contentDisposition);

      if (!contentDisposition) {
        console.warn('❌ No Content-Disposition header found, using fallback filename');
        return fallbackName;
      }

      // Method 1: Try filename*=UTF-8'' format (our backend's format)
      // Example: filename*=UTF-8''Demand_Letter_TO_Insurance_Carrier.pdf
      if (contentDisposition.includes("filename*=UTF-8''")) {
        console.log(`✅ Found filename*=UTF-8'' format`);
        const parts = contentDisposition.split("filename*=UTF-8''");
        if (parts.length > 1) {
          // Get everything after filename*=UTF-8'' until semicolon or end
          const encoded = parts[1].split(';')[0].trim();
          const filename = decodeURIComponent(encoded);
          console.log('✅ EXTRACTED filename:', filename);
          return filename;
        }
      }

      // Method 2: Try standard filename="..." format
      // Example: filename="document.pdf"
      if (contentDisposition.includes('filename=')) {
        console.log('⚠️ Trying standard filename= format');
        const match = contentDisposition.match(/filename="([^"]+)"/);
        if (match && match[1]) {
          let filename = match[1];

          // Decode RFC 2047 Q-encoding if present (=?UTF-8?Q?...?=)
          if (filename.startsWith('=?UTF-8?Q?') && filename.endsWith('?=')) {
            console.log('⚠️ Decoding Q-encoded filename');
            filename = filename.substring(10, filename.length - 2);
            filename = decodeURIComponent(filename.replace(/=/g, '%'));
          }

          console.log('⚠️ EXTRACTED filename (fallback):', filename);
          return filename;
        }
      }

      console.error('❌ Could not parse filename from Content-Disposition header, using fallback');
      return fallbackName;
    } catch (error) {
      console.error('❌ Error extracting filename from header:', error);
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
      activeConv.messageCount = (activeConv.messageCount || 0) + 1; // Increment message count
      console.log(`Added user message to conversation ${this.stateService.getActiveConversationId()}, count: ${activeConv.messages.length}, messageCount: ${activeConv.messageCount}`);
    }

    if (!activeConv || !activeConv.backendConversationId) {
      // No active conversation - this is likely a document drafting follow-up
      // Keep original mock behavior for now
      this.stateService.setIsGenerating(true);
      setTimeout(() => {
        this.stateService.addConversationMessage({
          role: 'assistant',
          content: `I understand you'd like to: "${userMessage}". I'll help you with those revisions. This functionality will be connected to the backend API to provide real-time document editing and improvements.`,
          timestamp: new Date()
        });
        this.stateService.setIsGenerating(false);
        this.stateService.setShowBottomSearchBar(true);
      }, 2000);
      return;
    }

    // Send message to backend conversation
    this.stateService.setIsGenerating(true);
    const researchMode = this.selectedResearchMode;

    // Initialize and animate workflow steps for the active task
    this.initializeWorkflowSteps(this.activeTask);
    this.animateWorkflowSteps();

    // Capture conversation ID at request time to prevent race condition
    const requestConversationId = this.stateService.getActiveConversationId();
    const requestBackendId = activeConv.backendConversationId;

    this.legalResearchService.sendMessageToConversation(
      requestBackendId,
      userMessage,
      researchMode
    )
      .pipe(takeUntil(merge(this.destroy$, this.cancelGeneration$)))
      .subscribe({
        next: (message) => {
          console.log('Received AI response for conversation:', requestConversationId);

          // Only update UI if THIS conversation is still active (prevents race condition)
          if (this.stateService.getActiveConversationId() === requestConversationId) {
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
            this.stateService.addConversationMessage(assistantMessage);

            // ALSO update the conversation object in sidebar for message count badge
            const conv = this.stateService.getConversations().find(c => c.id === requestConversationId);
            if (conv) {
              conv.messages.push(assistantMessage);
              conv.messageCount = (conv.messageCount || 0) + 1; // Increment message count
              console.log(`Updated conversation ${requestConversationId} messages count: ${conv.messages.length}, messageCount: ${conv.messageCount}`);
              // Force change detection to update badge
              this.cdr.detectChanges();
            }

            this.stateService.setIsGenerating(false);
            this.stateService.setShowBottomSearchBar(true);
            this.cdr.detectChanges();
          } else {
            console.log('Response arrived for inactive conversation, ignoring UI update');
            this.stateService.setIsGenerating(false);
          }
        },
        error: (error) => {
          console.error('Error sending message:', error);

          // Mark workflow as error
          if (this.stateService.getWorkflowSteps().length > 0) {
            const steps = this.stateService.getWorkflowSteps(); if (steps.length > 0) this.stateService.updateWorkflowStep(steps[steps.length - 1].id, { status: 'error' as any });
          }

          this.stateService.addConversationMessage({
            role: 'assistant',
            content: 'Sorry, I encountered an error processing your message. Please try again.'
          });
          this.stateService.setIsGenerating(false);
          this.stateService.setShowBottomSearchBar(true);
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
    console.log('Saving document:', this.editorDocumentId);

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
    this.stateService.clearFollowUpQuestions();
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
        const questions = questionMatches
          .map(q => q.replace(/^[-•*\d+\.]\s*/, '').trim())
          .map(q => q.replace(/\*\*/g, '')) // Remove bold markdown
          .filter(q => q.length > 0)
          .filter(q => this.isValidFollowUpQuestion(q)) // Validate question quality
          .slice(0, 3); // Limit to 3 questions

        this.stateService.setFollowUpQuestions(questions);
        console.log('Extracted follow-up questions:', questions);
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
    if (!question || this.stateService.getIsGenerating()) return;

    // Set the follow-up message and send it
    this.followUpMessage = question;
    this.sendFollowUpMessage();
  }

  // ========================================
  // VERSION HISTORY METHODS (PHASE 2)
  // ========================================

  /**
   * Load version history from backend (for dropdown)
   */
  loadVersionHistory(): void {
    if (!this.currentDocumentId) return;

    // Skip loading for mock documents
    if (typeof this.currentDocumentId === 'string' && this.currentDocumentId.startsWith('mock-doc-')) {
      console.log('[MOCK MODE] Skipping version history load for mock document');
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
          console.error('Error loading version history:', error);
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
              this.currentDocumentWordCount = restoredVersion.wordCount;
              this.currentDocumentPageCount = this.documentGenerationService.estimatePageCount(restoredVersion.wordCount);

              this.stateService.addConversationMessage({
                role: 'assistant',
                content: `Restored version ${versionNumber} as version ${restoredVersion.versionNumber}.`,
                timestamp: new Date()
              });

              // Reload version history to show updated list
              this.loadVersionHistory();

              // Update Quill editor with restored content using robust helper
              setTimeout(() => {
                this.setQuillContentFromMarkdown(restoredVersion.content);

                // Ensure editor is editable
                if (this.quillEditorInstance) {
                  this.quillEditorInstance.enable(true);
                }
              }, 100);

              this.notificationService.success('Version Restored', `Version ${versionNumber} restored as v${restoredVersion.versionNumber}`);

              this.cdr.detectChanges();
            },
            error: (error) => {
              console.error('Error restoring version:', error);
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

        // Get current content from Quill editor
        const content = this.quillEditorInstance.root.innerHTML;

        // Call service to save manual version
        this.documentGenerationService.saveManualVersion(
          this.currentDocumentId as number,
          this.currentUser.id,
          content,
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
          error: (error) => {
            console.error('Error saving version:', error);
            this.notificationService.error('Save Failed', 'Failed to save version');
          }
        });
      }
    });
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
      console.error('Message not found:', messageId);
      return;
    }

    const message = this.stateService.getConversationMessages()[messageIndex];
    const transformation = message.transformationComparison;

    if (!transformation) {
      console.error('No transformation data in message');
      return;
    }

    const response = transformation.response;

    if (transformation.scope === 'FULL_DOCUMENT') {
      // Full document transformation - replace entire content
      this.currentDocumentWordCount = response.wordCount;
      this.currentDocumentPageCount = this.documentGenerationService.estimatePageCount(response.wordCount);

      // Update metadata
      this.documentMetadata.version = response.newVersion;
      this.documentMetadata.tokensUsed = (this.documentMetadata.tokensUsed || 0) + response.tokensUsed;
      this.documentMetadata.costEstimate = (this.documentMetadata.costEstimate || 0) + response.costEstimate;

      // Update Quill editor with transformed content using robust helper
      setTimeout(() => {
        this.setQuillContentFromMarkdown(transformation.newContent);

        // CRITICAL: Sync activeDocumentContent with Quill's HTML after markdown conversion
        // Wait for Quill to finish converting markdown to HTML
        setTimeout(() => {
          if (this.quillEditorInstance) {
            this.activeDocumentContent = this.quillEditorInstance.root.innerHTML;
            console.log('✅ Synced activeDocumentContent with Quill HTML after transformation');
          }
        }, 50);
      }, 100);
    } else {
      // Selection-based transformation - use Quill operations for precise replacement
      if (!this.documentEditor || !this.quillEditorInstance) {
        console.error('Quill editor not available');
        return;
      }

      const quill = this.quillEditorInstance;
      const transformedSnippet = transformation.response.transformedSelection || transformation.newContent;
      const selectionRange = transformation.selectionRange;

      console.log('Accept transformation:', {
        transformedSnippet,
        selectionRange,
        responseTransformedSelection: transformation.response.transformedSelection,
        responseTransformedContent: transformation.response.transformedContent
      });

      if (!selectionRange || !transformedSnippet) {
        console.error('Missing selection range or transformed snippet');
        return;
      }

      // Use Quill operations for precise text replacement with formatting preserved
      setTimeout(() => {
        try {
          // Convert transformed markdown snippet to HTML
          const htmlContent = this.markdownConverter.convert(transformedSnippet);
          let transformedDelta;

          // Try to convert HTML to Delta using clipboard API
          try {
            transformedDelta = quill.clipboard.convert(htmlContent);

            // Check if Delta is empty (clipboard.convert failed)
            if (!transformedDelta.ops || transformedDelta.ops.length === 0) {
              console.warn('⚠️ clipboard.convert() returned empty Delta for selection, using plain text');
              // Fallback: Create simple Delta with plain text
              transformedDelta = { ops: [{ insert: transformedSnippet }] };
            }
          } catch (error) {
            console.error('❌ clipboard.convert() failed for selection:', error);
            // Fallback: Create simple Delta with plain text
            transformedDelta = { ops: [{ insert: transformedSnippet }] };
          }

          // 1. Delete old text at the exact selection position
          quill.deleteText(selectionRange.index, selectionRange.length);

          // 2. Insert the formatted Delta at the same position
          quill.updateContents({
            ops: [
              { retain: selectionRange.index },
              ...transformedDelta.ops
            ]
          });

          // 3. Calculate the length of inserted content for highlighting
          const insertedLength = transformedDelta.ops.reduce((len: number, op: any) => {
            return len + (op.insert ? op.insert.length : 0);
          }, 0);

          // 4. Apply green background highlight to the replaced text
          quill.formatText(selectionRange.index, insertedLength, {
            'background': '#d4edda' // Velzon success-subtle green
          });

          // 5. Update activeDocumentContent from Quill's current state
          this.activeDocumentContent = quill.root.innerHTML;

          // 6. Auto-remove highlight after 4 seconds
          setTimeout(() => {
            quill.formatText(selectionRange.index, insertedLength, {
              'background': false
            });
          }, 4000);

          // 7. Update word count
          const plainText = quill.getText();
          this.currentDocumentWordCount = this.documentGenerationService.countWords(plainText);
          this.currentDocumentPageCount = this.documentGenerationService.estimatePageCount(this.currentDocumentWordCount);

          // 8. Detect changes for save
          this.cdr.detectChanges();
        } catch (error) {
          console.error('❌ Error applying selection transformation:', error);
          this.notificationService.error('Transformation Error', 'Failed to apply transformation to selected text');
        }
      }, 100);

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
      if (!this.currentDocumentId || !this.currentUser || !this.quillEditorInstance) {
        console.warn('⚠️ Cannot save transformation - missing required data');
        return;
      }

      // Get current HTML content from Quill (already has the transformation applied)
      const htmlContent = this.quillEditorInstance.root.innerHTML;

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
            console.log('✅ Transformation saved to database:', saveResponse);
            // Update version number from save response
            if (saveResponse && saveResponse.version) {
              this.documentMetadata.version = saveResponse.version;
            }
          },
          error: (error) => {
            console.error('❌ Error saving transformation:', error);
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
      console.error('Message not found:', messageId);
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

    const content = this.quillEditorInstance.root.innerHTML;

    this.documentGenerationService.saveDocument(this.currentDocumentId, content, this.activeDocumentTitle)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.currentVersionNumber = response.versionNumber;
          this.notificationService.success('Success', `Version ${response.versionNumber} saved successfully`);
        },
        error: (error) => {
          console.error('Error saving version:', error);
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
   * Apply text size to Quill editor
   */
  private applyTextSize(): void {
    if (this.documentEditor?.quillEditor) {
      const editorElement = this.quillEditorInstance.root;
      editorElement.style.fontSize = `${this.editorTextSize}px`;
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
   * Toggle fullscreen mode
   */
  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;

    if (this.isFullscreen) {
      document.body.classList.add('ai-workspace-fullscreen');
    } else {
      document.body.classList.remove('ai-workspace-fullscreen');
    }
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
    this.stateService.setShowChat(true);
  }

  /**
   * Save document to File Manager
   */
  async saveToFileManager(): Promise<void> {
    if (!this.currentDocumentId || !this.currentUser) {
      this.notificationService.error('Error', 'Document not available');
      return;
    }

    try {
      // Show loading
      this.notificationService.loading('Saving to File Manager', 'Generating document...');

      // Get the Word document as blob with headers
      const response = await lastValueFrom(
        this.documentGenerationService.exportToWord(this.currentDocumentId as number, this.currentUser.id)
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
      console.error('Error saving to file manager:', error);
      this.notificationService.error('Error', 'Failed to save to File Manager');
    }
  }

}
