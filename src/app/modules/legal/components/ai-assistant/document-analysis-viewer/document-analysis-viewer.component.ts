import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ViewChild, ElementRef, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { NgbDropdown, NgbDropdownToggle, NgbDropdownMenu, NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { MarkdownToHtmlPipe } from '../../../pipes/markdown-to-html.pipe';
import { ActionItemsListComponent } from '../action-items-list/action-items-list.component';
import { TimelineViewComponent } from '../timeline-view/timeline-view.component';
import { DocumentAnalyzerService, DocumentAnalysisResult, AnalysisMessage } from '../../../services/document-analyzer.service';
import { NotificationService } from '../../../services/notification.service';
import { ActionItemService } from '../../../services/action-item.service';
import { AiWorkspaceStateService } from '../../../services/ai-workspace-state.service';
import { DocumentCollectionService, DocumentRelationship, RelationshipType } from '../../../services/document-collection.service';

export interface AnalyzedDocumentData {
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
}

@Component({
  selector: 'app-document-analysis-viewer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgbDropdown,
    NgbDropdownToggle,
    NgbDropdownMenu,
    NgbNavModule,
    MarkdownToHtmlPipe,
    ActionItemsListComponent,
    TimelineViewComponent
  ],
  templateUrl: './document-analysis-viewer.component.html',
  styleUrls: ['./document-analysis-viewer.component.scss']
})
export class DocumentAnalysisViewerComponent implements OnInit, OnDestroy, OnChanges {
  private destroy$ = new Subject<void>();

  @ViewChild('viewerContainer') viewerContainer!: ElementRef<HTMLDivElement>;

  @Input() document!: AnalyzedDocumentData;
  @Output() close = new EventEmitter<void>();
  @Output() exportPdf = new EventEmitter<AnalyzedDocumentData>();
  @Output() exportWord = new EventEmitter<AnalyzedDocumentData>();
  @Output() saveToFileManager = new EventEmitter<AnalyzedDocumentData>();

  // Active tab
  activeTab = 'overview';

  // Ask AI state
  askAiMessages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }> = [];
  askAiQuestion = '';
  isAskingAi = false;

  // Parsed sections from analysis
  parsedSections: {
    overview?: string;
    weaknesses?: string;
    evidence?: string;
    strategy?: string;
    recommendations?: string;
  } = {};

  // Stats for insight cards
  actionItemsCount = 0;
  timelineEventsCount = 0;
  partiesInfo = '';

  // Sidebar collapsed state
  viewerSidebarCollapsed$ = this.stateService.viewerSidebarCollapsed$;

  // Scroll to top button visibility
  showScrollToTop = false;

  // Document category for tab configuration
  documentCategory: 'litigation' | 'contract' | 'court' | 'discovery' | 'correspondence' | 'general' = 'general';

  // Tab visibility based on document type
  visibleTabs: {
    overview: boolean;
    actions: boolean;
    timeline: boolean;
    keyFindings: boolean;
    keyTerms: boolean;
    riskAssessment: boolean;
    obligations: boolean;
    askAi: boolean;
    related: boolean;
  } = {
    overview: true,
    actions: true,
    timeline: true,
    keyFindings: true,
    keyTerms: false,
    riskAssessment: false,
    obligations: false,
    askAi: true,
    related: true
  };

  // Document relationships state
  documentRelationships: DocumentRelationship[] = [];
  relationshipTypes: RelationshipType[] = [];
  loadingRelationships = false;
  showLinkDocumentModal = false;

  // Link document modal state
  linkDocumentForm = {
    relationshipType: '',
    targetAnalysisId: 0,
    description: ''
  };
  linkDocumentSearchQuery = '';
  linkDocumentSearchResults: any[] = [];
  isSearchingDocuments = false;
  isCreatingLink = false;
  allAnalysisHistory: any[] = [];

  // Add to Collection modal state
  showAddToCollectionModal = false;
  isLoadingCollections = false;
  isAddingToCollection = false;
  availableCollections: any[] = [];
  documentCollections: any[] = [];
  selectedCollectionId: number | null = null;
  createNewCollectionMode = false;
  newCollectionName = '';
  newCollectionDescription = '';

  // Contract-specific parsed sections
  contractSections: {
    keyTerms?: string;
    riskAssessment?: string;
    obligations?: string;
  } = {};

  // Dynamic suggested questions based on document type
  suggestedQuestions: Array<{ icon: string; text: string; question: string }> = [];

  // Follow-up action chips shown after AI response
  followUpActions: Array<{ icon: string; text: string; question: string }> = [];

  constructor(
    private documentAnalyzerService: DocumentAnalyzerService,
    private notificationService: NotificationService,
    private actionItemService: ActionItemService,
    private stateService: AiWorkspaceStateService,
    private documentCollectionService: DocumentCollectionService,
    private cdr: ChangeDetectorRef
  ) {}

  // Toggle sidebar collapsed state
  toggleSidebarCollapsed(): void {
    this.stateService.toggleViewerSidebarCollapsed();
  }

  ngOnInit(): void {
    this.initializeDocument();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Re-initialize when document changes
    if (changes['document'] && !changes['document'].firstChange) {
      this.initializeDocument();
      // Reset to overview tab when switching documents
      this.activeTab = 'overview';
      // Clear Ask AI messages for new document
      this.askAiMessages = [];
    }
  }

  private initializeDocument(): void {
    // Determine document category and visible tabs
    this.determineDocumentCategory();
    this.configureTabsForCategory();
    this.generateSuggestedQuestions();

    if (this.document?.analysis?.fullAnalysis) {
      // Strip JSON block from analysis before parsing/displaying
      const cleanedAnalysis = this.stripJsonBlock(this.document.analysis.fullAnalysis);
      this.parseAnalysisSections(cleanedAnalysis);

      // Parse contract-specific sections if applicable
      if (this.documentCategory === 'contract') {
        this.parseContractSections(cleanedAnalysis);
      }
    }

    // Load action items and timeline events counts (only for non-contract types)
    if (this.document?.databaseId && this.documentCategory !== 'contract') {
      this.loadInsightCounts();
    }

    // Load Ask AI message history
    if (this.document?.databaseId) {
      this.loadAskAiMessages();
    }

    // Load document relationships
    if (this.document?.databaseId) {
      this.loadRelationships();
      this.loadRelationshipTypes();
    }

    // Extract parties info from metadata
    this.extractPartiesInfo();
  }

  /**
   * Load document relationships
   */
  private loadRelationships(): void {
    this.loadingRelationships = true;
    this.documentCollectionService.getDocumentRelationships(this.document.databaseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.documentRelationships = response.relationships;
          this.loadingRelationships = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load relationships:', err);
          this.loadingRelationships = false;
        }
      });
  }

  /**
   * Load available relationship types
   */
  private loadRelationshipTypes(): void {
    this.documentCollectionService.getRelationshipTypes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (types) => {
          this.relationshipTypes = types;
        },
        error: (err) => {
          console.error('Failed to load relationship types:', err);
        }
      });
  }

  /**
   * Get relationship type label
   */
  getRelationshipLabel(type: string): string {
    const found = this.relationshipTypes.find(t => t.id === type);
    return found?.label || type;
  }

  /**
   * Delete a relationship
   */
  deleteRelationship(relationshipId: number): void {
    this.documentCollectionService.deleteRelationship(this.document.databaseId, relationshipId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.documentRelationships = this.documentRelationships.filter(r => r.id !== relationshipId);
          this.notificationService.success('Deleted', 'Relationship removed');
        },
        error: (err) => {
          console.error('Failed to delete relationship:', err);
          this.notificationService.error('Error', 'Failed to delete relationship');
        }
      });
  }

  /**
   * Open the link document modal
   */
  openLinkDocumentModal(): void {
    this.showLinkDocumentModal = true;
    this.resetLinkDocumentForm();
    // Load analysis history for search
    this.loadAnalysisHistoryForSearch();
  }

  /**
   * Close the link document modal
   */
  closeLinkDocumentModal(): void {
    this.showLinkDocumentModal = false;
    this.resetLinkDocumentForm();
  }

  /**
   * Reset the link document form
   */
  private resetLinkDocumentForm(): void {
    this.linkDocumentForm = {
      relationshipType: '',
      targetAnalysisId: 0,
      description: ''
    };
    this.linkDocumentSearchQuery = '';
    this.linkDocumentSearchResults = [];
  }

  /**
   * Load analysis history for document search
   */
  private loadAnalysisHistoryForSearch(): void {
    this.documentAnalyzerService.getAnalysisHistory()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (analyses) => {
          // Exclude current document from search results
          this.allAnalysisHistory = analyses.filter(a => a.id !== this.document.databaseId);
        },
        error: (err) => {
          console.error('Failed to load analysis history:', err);
        }
      });
  }

  /**
   * Search documents for linking
   */
  searchDocumentsForLink(): void {
    const query = this.linkDocumentSearchQuery.toLowerCase().trim();
    if (!query) {
      this.linkDocumentSearchResults = [];
      return;
    }

    this.linkDocumentSearchResults = this.allAnalysisHistory.filter(doc =>
      doc.fileName?.toLowerCase().includes(query) ||
      doc.detectedType?.toLowerCase().includes(query)
    ).slice(0, 10); // Limit to 10 results
  }

  /**
   * Select a document to link
   */
  selectDocumentToLink(doc: any): void {
    this.linkDocumentForm.targetAnalysisId = doc.id;
  }

  /**
   * Create the document link
   */
  createDocumentLink(): void {
    if (!this.linkDocumentForm.relationshipType || !this.linkDocumentForm.targetAnalysisId) {
      return;
    }

    this.isCreatingLink = true;
    this.documentCollectionService.createRelationship(
      this.document.databaseId,
      this.linkDocumentForm.targetAnalysisId,
      this.linkDocumentForm.relationshipType,
      this.linkDocumentForm.description || undefined
    ).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notificationService.success('Linked', 'Document relationship created');
          this.closeLinkDocumentModal();
          this.loadRelationships(); // Refresh relationships list
        },
        error: (err) => {
          console.error('Failed to create relationship:', err);
          this.notificationService.error('Error', 'Failed to create relationship');
          this.isCreatingLink = false;
        }
      });
  }

  // ============================================
  // Add to Collection Methods
  // ============================================

  /**
   * Open the Add to Collection modal
   */
  openAddToCollectionModal(): void {
    this.showAddToCollectionModal = true;
    this.resetAddToCollectionForm();
    this.loadCollectionsForModal();
  }

  /**
   * Close the Add to Collection modal
   */
  closeAddToCollectionModal(): void {
    this.showAddToCollectionModal = false;
    this.resetAddToCollectionForm();
  }

  /**
   * Reset the Add to Collection form
   */
  private resetAddToCollectionForm(): void {
    this.selectedCollectionId = null;
    this.createNewCollectionMode = false;
    this.newCollectionName = '';
    this.newCollectionDescription = '';
  }

  /**
   * Load collections for the modal
   */
  private loadCollectionsForModal(): void {
    this.isLoadingCollections = true;

    // Load all collections and collections containing this document
    this.documentCollectionService.getCollections()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (collections) => {
          // Also load which collections this document is in
          this.documentCollectionService.getCollectionsForDocument(this.document.databaseId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (docCollections) => {
                this.documentCollections = docCollections;
                // Filter out collections the document is already in
                const docCollectionIds = docCollections.map(c => c.id);
                this.availableCollections = collections.filter(c => !docCollectionIds.includes(c.id));
                this.isLoadingCollections = false;
                this.cdr.detectChanges();
              },
              error: () => {
                this.availableCollections = collections;
                this.documentCollections = [];
                this.isLoadingCollections = false;
                this.cdr.detectChanges();
              }
            });
        },
        error: (err) => {
          console.error('Failed to load collections:', err);
          this.isLoadingCollections = false;
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Select a collection
   */
  selectCollection(collectionId: number): void {
    this.selectedCollectionId = collectionId;
    this.createNewCollectionMode = false;
  }

  /**
   * Add document to collection
   */
  addToCollection(): void {
    this.isAddingToCollection = true;

    if (this.createNewCollectionMode && this.newCollectionName) {
      // Create new collection first, then add document
      this.documentCollectionService.createCollection(
        this.newCollectionName,
        this.newCollectionDescription || undefined
      ).pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (newCollection) => {
            this.addDocumentToCollectionById(newCollection.id);
          },
          error: (err) => {
            console.error('Failed to create collection:', err);
            this.notificationService.error('Error', 'Failed to create collection');
            this.isAddingToCollection = false;
          }
        });
    } else if (this.selectedCollectionId) {
      this.addDocumentToCollectionById(this.selectedCollectionId);
    }
  }

  /**
   * Add document to collection by ID
   */
  private addDocumentToCollectionById(collectionId: number): void {
    this.documentCollectionService.addDocumentToCollection(collectionId, this.document.databaseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notificationService.success('Added', 'Document added to collection');
          this.closeAddToCollectionModal();
          this.isAddingToCollection = false;
        },
        error: (err) => {
          console.error('Failed to add to collection:', err);
          this.notificationService.error('Error', 'Failed to add document to collection');
          this.isAddingToCollection = false;
        }
      });
  }

  /**
   * Determine document category based on detected type
   */
  private determineDocumentCategory(): void {
    const docType = (this.document?.detectedType || '').toLowerCase();

    // Litigation documents: Complaint, Petition, Answer, Motion, Brief, Memorandum
    if (docType.includes('complaint') || docType.includes('petition') ||
        docType.includes('answer') || docType.includes('motion') ||
        docType.includes('brief') || docType.includes('memorandum')) {
      this.documentCategory = 'litigation';
      return;
    }

    // Court Orders/Judgments
    if (docType.includes('order') || docType.includes('judgment') ||
        docType.includes('decree') || docType.includes('ruling')) {
      this.documentCategory = 'court';
      return;
    }

    // Contract documents: Agreement, Contract, NDA, Lease, Employment, Settlement
    if (docType.includes('contract') || docType.includes('agreement') ||
        docType.includes('nda') || docType.includes('lease') ||
        docType.includes('employment') || docType.includes('settlement') ||
        docType.includes('non-disclosure') || docType.includes('confidentiality')) {
      this.documentCategory = 'contract';
      return;
    }

    // Discovery documents
    if (docType.includes('interrogator') || docType.includes('discovery') ||
        docType.includes('request for production') || docType.includes('admission')) {
      this.documentCategory = 'discovery';
      return;
    }

    // Correspondence documents (demand letters, notices, cease and desist)
    if (docType.includes('demand') || docType.includes('cease') ||
        docType.includes('notice') || docType.includes('regulatory')) {
      this.documentCategory = 'correspondence';
      return;
    }

    this.documentCategory = 'general';
  }

  /**
   * Configure visible tabs based on document category
   */
  private configureTabsForCategory(): void {
    // Reset all tabs
    this.visibleTabs = {
      overview: true,
      actions: false,
      timeline: false,
      keyFindings: false,
      keyTerms: false,
      riskAssessment: false,
      obligations: false,
      askAi: true,
      related: true
    };

    switch (this.documentCategory) {
      case 'litigation':
        // Litigation: Overview, Action Items, Timeline, Key Findings, Ask AI
        this.visibleTabs.actions = true;
        this.visibleTabs.timeline = true;
        this.visibleTabs.keyFindings = true;
        break;

      case 'contract':
        // Contracts: Overview, Key Terms, Risk Assessment, Obligations, Ask AI
        this.visibleTabs.keyTerms = true;
        this.visibleTabs.riskAssessment = true;
        this.visibleTabs.obligations = true;
        break;

      case 'court':
        // Court documents: Overview, Timeline (compliance deadlines), Key Findings, Ask AI
        this.visibleTabs.timeline = true;
        this.visibleTabs.keyFindings = true;
        break;

      case 'discovery':
        // Discovery: Overview, Action Items (response deadlines), Ask AI
        this.visibleTabs.actions = true;
        break;

      case 'correspondence':
        // Demand Letters, Notices, Cease & Desist: Overview, Key Findings (response strategy), Ask AI
        this.visibleTabs.keyFindings = true;
        this.visibleTabs.timeline = true; // For deadlines
        break;

      default:
        // General: Overview, Key Findings, Ask AI
        this.visibleTabs.keyFindings = true;
        break;
    }
  }

  /**
   * Generate suggested questions based on document category
   */
  private generateSuggestedQuestions(): void {
    switch (this.documentCategory) {
      case 'litigation':
        this.suggestedQuestions = [
          { icon: 'ri-focus-3-line', text: 'What are the weaknesses?', question: 'What are the critical weaknesses in this complaint/pleading that could be exploited?' },
          { icon: 'ri-shield-line', text: 'Defense strategies', question: 'What are the strongest defense strategies against the claims made?' },
          { icon: 'ri-file-search-line', text: 'Missing evidence', question: 'What evidence or documents should be requested to support our position?' },
          { icon: 'ri-calendar-check-line', text: 'Key deadlines', question: 'What are all the important deadlines and response requirements?' }
        ];
        break;

      case 'contract':
        this.suggestedQuestions = [
          { icon: 'ri-money-dollar-circle-line', text: 'Key financial terms', question: 'Summarize all the key financial terms and payment obligations in this contract.' },
          { icon: 'ri-alert-line', text: 'Unfavorable clauses', question: 'What are the most unfavorable or risky clauses for our side?' },
          { icon: 'ri-door-open-line', text: 'Termination options', question: 'What are the termination conditions and exit options available?' },
          { icon: 'ri-edit-line', text: 'Negotiation points', question: 'What are the top priority items that should be negotiated or modified?' }
        ];
        break;

      case 'court':
        this.suggestedQuestions = [
          { icon: 'ri-gavel-line', text: 'Order requirements', question: 'What specific actions or compliance requirements does this order mandate?' },
          { icon: 'ri-calendar-event-line', text: 'Compliance deadlines', question: 'What are the deadlines and timing requirements specified in this order?' },
          { icon: 'ri-error-warning-line', text: 'Penalties for non-compliance', question: 'What are the consequences or penalties for failing to comply with this order?' },
          { icon: 'ri-arrow-go-forward-line', text: 'Appeal options', question: 'What are the options for appealing or modifying this order?' }
        ];
        break;

      case 'discovery':
        this.suggestedQuestions = [
          { icon: 'ri-calendar-check-line', text: 'Response deadline', question: 'When is the response due and what is the required format?' },
          { icon: 'ri-file-list-3-line', text: 'Items requested', question: 'Summarize all the specific items or information being requested.' },
          { icon: 'ri-shield-check-line', text: 'Objection grounds', question: 'What are valid grounds for objecting to any of these requests?' },
          { icon: 'ri-error-warning-line', text: 'Privileged matters', question: 'Are there any requests that may involve privileged or protected information?' }
        ];
        break;

      case 'correspondence':
        this.suggestedQuestions = [
          { icon: 'ri-focus-3-line', text: 'Key demands', question: 'What are the specific demands or requests being made in this letter?' },
          { icon: 'ri-calendar-event-line', text: 'Response deadline', question: 'Is there a deadline for responding and what happens if we don\'t respond?' },
          { icon: 'ri-scales-3-line', text: 'Legal merit', question: 'What is the legal merit of the claims or threats made in this correspondence?' },
          { icon: 'ri-chat-3-line', text: 'Response strategy', question: 'What would be the best strategy for responding to this letter?' }
        ];
        break;

      default:
        this.suggestedQuestions = [
          { icon: 'ri-lightbulb-line', text: 'Key takeaways', question: 'What are the most important takeaways from this document?' },
          { icon: 'ri-shield-line', text: 'Main risks', question: 'What are the main risks or concerns identified in this document?' },
          { icon: 'ri-file-list-line', text: 'Key obligations', question: 'Summarize the key obligations and responsibilities outlined here.' },
          { icon: 'ri-calendar-check-line', text: 'Important dates', question: 'What are the important dates or deadlines mentioned?' }
        ];
        break;
    }
  }

  /**
   * Parse contract-specific sections from analysis
   */
  private parseContractSections(fullAnalysis: string): void {
    this.contractSections = {};

    // Key Terms - Financial Terms, Payment terms
    const keyTermsMatch = fullAnalysis.match(/##\s*[💰💼]*\s*(FINANCIAL\s*TERMS|KEY\s*TERMS|COMPENSATION|TOTAL\s*COMPENSATION)[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
    this.contractSections.keyTerms = keyTermsMatch ? keyTermsMatch[0] : '';

    // Risk Assessment - Unfavorable clauses, problematic provisions
    const riskMatch = fullAnalysis.match(/##\s*[🚨⚠️]*\s*(UNFAVORABLE|PROBLEMATIC|RISK\s*ASSESSMENT|RESTRICTIVE)[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
    this.contractSections.riskAssessment = riskMatch ? riskMatch[0] : '';

    // Obligations - Termination, Exit strategy, Missing protections
    const obligationsMatch = fullAnalysis.match(/##\s*[🚪🛡️📋]*\s*(TERMINATION|EXIT\s*STRATEGY|MISSING\s*STANDARD|OBLIGATIONS|NEGOTIATION\s*PRIORITIES)[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
    this.contractSections.obligations = obligationsMatch ? obligationsMatch[0] : '';
  }

  private loadInsightCounts(): void {
    // Load action items count
    this.actionItemService.getActionItems(this.document.databaseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          this.actionItemsCount = items.length;
        },
        error: (err) => console.error('Error loading action items:', err)
      });

    // Load timeline events count
    this.actionItemService.getTimelineEvents(this.document.databaseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (events) => {
          this.timelineEventsCount = events.length;
        },
        error: (err) => console.error('Error loading timeline events:', err)
      });
  }

  private extractPartiesInfo(): void {
    // Try to extract parties from metadata
    if (this.document.extractedMetadata) {
      try {
        const metadata = JSON.parse(this.document.extractedMetadata);

        // Check for direct plaintiff/defendant fields (AI-extracted)
        if (metadata.plaintiff || metadata.defendant) {
          const plaintiff = metadata.plaintiff?.trim();
          const defendant = metadata.defendant?.trim();

          if (plaintiff && defendant) {
            this.partiesInfo = `${plaintiff} vs ${defendant}`;
          } else if (plaintiff) {
            this.partiesInfo = plaintiff;
          } else if (defendant) {
            this.partiesInfo = defendant;
          }
        }
        // Legacy: Check for parties object/array
        else if (metadata.parties) {
          if (Array.isArray(metadata.parties)) {
            const names = metadata.parties.map((p: any) =>
              typeof p === 'string' ? p : (p.name || p.party || Object.values(p)[0])
            ).filter(Boolean);
            this.partiesInfo = names.length > 0 ? `${names.length} parties` : '';
          } else if (typeof metadata.parties === 'object') {
            const values = Object.values(metadata.parties).filter(v => v && typeof v === 'string') as string[];
            this.partiesInfo = values.length > 0 ? values.join(' vs ') : 'Parties identified';
          } else if (typeof metadata.parties === 'string') {
            this.partiesInfo = metadata.parties;
          }
        }
      } catch {
        // Not JSON, try regex
        const partiesMatch = this.document.extractedMetadata.match(/parties?[:\s]+(\d+)/i);
        if (partiesMatch) {
          this.partiesInfo = `${partiesMatch[1]} parties`;
        }
      }
    }

    // Fallback: scan analysis for party names (only if no parties found above)
    if (!this.partiesInfo && this.document.analysis?.fullAnalysis) {
      const analysis = this.document.analysis.fullAnalysis;
      // Look for "Plaintiff" and "Defendant" mentions
      const hasPlaintiff = /plaintiff/i.test(analysis);
      const hasDefendant = /defendant/i.test(analysis);
      if (hasPlaintiff && hasDefendant) {
        this.partiesInfo = 'Parties identified';
      } else if (hasPlaintiff || hasDefendant) {
        this.partiesInfo = 'Party identified';
      }
    }
  }

  /**
   * Strip JSON block from analysis text (it's displayed as raw text otherwise)
   */
  private stripJsonBlock(text: string): string {
    // Remove ```json ... ``` code blocks
    let cleaned = text.replace(/```json\s*[\s\S]*?```/gi, '');

    // Remove standalone JSON objects at end (actionItems/timelineEvents)
    const jsonStartMatch = cleaned.match(/\n\s*\{\s*"(?:actionItems|timelineEvents)"/);
    if (jsonStartMatch && jsonStartMatch.index) {
      cleaned = cleaned.substring(0, jsonStartMatch.index);
    }

    return cleaned.trim();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Parse the full analysis into sections
  private parseAnalysisSections(fullAnalysis: string): void {
    // Overview shows the FULL analysis - no truncation
    this.parsedSections.overview = fullAnalysis;

    // Extract specific sections for the Risk Analysis tab
    // Use multiline regex to capture entire sections (up to next ## header)

    // Weaknesses - capture until next ## or end
    const weaknessMatch = fullAnalysis.match(/##\s*[🎯⚠️]*\s*(CRITICAL\s*WEAKNESSES|WEAKNESSES|PROBLEMATIC|UNFAVORABLE)[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
    this.parsedSections.weaknesses = weaknessMatch ? weaknessMatch[0] : '';

    // Evidence / Unsupported Claims
    const evidenceMatch = fullAnalysis.match(/##\s*[📑📝]*\s*(EVIDENCE|UNSUPPORTED\s*FACTUAL|FACTUAL)[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
    this.parsedSections.evidence = evidenceMatch ? evidenceMatch[0] : '';

    // Strategy / Recommendations
    const strategyMatch = fullAnalysis.match(/##\s*[💡🎯🏆]*\s*(STRATEGIC\s*RECOMMENDATIONS|STRATEGY|RECOMMENDATIONS|NEGOTIATION)[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
    this.parsedSections.strategy = strategyMatch ? strategyMatch[0] : '';
  }

  // Tab navigation
  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  // Close viewer
  onClose(): void {
    this.close.emit();
  }

  // Export actions
  onExportPdf(): void {
    this.exportPdf.emit(this.document);
    this.notificationService.success('Export Started', 'Generating PDF...');
  }

  onExportWord(): void {
    this.exportWord.emit(this.document);
    this.notificationService.success('Export Started', 'Generating Word document...');
  }

  onSaveToFileManager(): void {
    this.saveToFileManager.emit(this.document);
    this.notificationService.success('Saving', 'Saving to File Manager...');
  }

  // Load Ask AI message history from backend
  loadAskAiMessages(): void {
    if (!this.document?.databaseId) return;

    this.documentAnalyzerService.getAnalysisMessages(this.document.databaseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (messages) => {
          this.askAiMessages = messages.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: new Date(m.createdAt)
          }));
        },
        error: (err) => {
          console.error('Failed to load Ask AI messages:', err);
        }
      });
  }

  // Ask AI functionality - calls real backend AI
  askQuestion(): void {
    if (!this.askAiQuestion.trim() || this.isAskingAi) return;
    if (!this.document?.databaseId) {
      this.notificationService.error('Error', 'Document not properly loaded');
      return;
    }

    const question = this.askAiQuestion.trim();
    this.askAiQuestion = '';

    // Add user message locally (optimistic UI update)
    this.askAiMessages.push({
      role: 'user',
      content: question,
      timestamp: new Date()
    });

    this.isAskingAi = true;

    // Call the real AI backend endpoint
    this.documentAnalyzerService.askAboutDocument(this.document.databaseId, question)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Add AI response to messages
          this.askAiMessages.push({
            role: 'assistant',
            content: response.answer,
            timestamp: new Date()
          });
          this.isAskingAi = false;

          // Generate contextual follow-up actions
          this.generateFollowUpActions(question);

          // Force change detection to update view immediately
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Ask AI error:', error);
          this.notificationService.error('Error', 'Failed to get AI response. Please try again.');
          // Remove the optimistic user message on error
          this.askAiMessages.pop();
          this.askAiQuestion = question; // Restore the question
          this.isAskingAi = false;
          this.cdr.detectChanges();
        }
      });
  }

  onEnterPress(event: KeyboardEvent): void {
    if (!event.shiftKey) {
      event.preventDefault();
      this.askQuestion();
    }
  }

  // Ask a suggested question
  askSuggestedQuestion(question: string): void {
    this.askAiQuestion = question;
    this.askQuestion();
  }

  /**
   * Generate follow-up action chips based on last AI response
   */
  private generateFollowUpActions(lastQuestion: string): void {
    // Base follow-ups that work for any document type
    const baseFollowUps = [
      { icon: 'ri-more-line', text: 'Tell me more', question: 'Can you elaborate on that with more specific details?' },
      { icon: 'ri-file-list-line', text: 'Action items', question: 'What specific action items should I take based on this information?' }
    ];

    // Category-specific follow-ups
    let categoryFollowUps: Array<{ icon: string; text: string; question: string }> = [];

    switch (this.documentCategory) {
      case 'litigation':
        categoryFollowUps = [
          { icon: 'ri-scales-3-line', text: 'Counter-arguments', question: 'What counter-arguments can be made against this?' },
          { icon: 'ri-file-search-line', text: 'Required evidence', question: 'What evidence would I need to gather to support this position?' }
        ];
        break;

      case 'contract':
        categoryFollowUps = [
          { icon: 'ri-edit-line', text: 'Suggested edits', question: 'What specific language changes would you recommend for these terms?' },
          { icon: 'ri-shield-check-line', text: 'Protection clauses', question: 'What additional protective clauses should be negotiated?' }
        ];
        break;

      case 'court':
        categoryFollowUps = [
          { icon: 'ri-calendar-todo-line', text: 'Compliance steps', question: 'What are the step-by-step compliance requirements?' },
          { icon: 'ri-time-line', text: 'Timing details', question: 'Can you break down the specific timing requirements?' }
        ];
        break;

      case 'discovery':
        categoryFollowUps = [
          { icon: 'ri-draft-line', text: 'Draft response', question: 'Can you help outline a response to these requests?' },
          { icon: 'ri-lock-line', text: 'Privilege concerns', question: 'Are there privilege or work-product concerns I should be aware of?' }
        ];
        break;

      default:
        categoryFollowUps = [
          { icon: 'ri-question-line', text: 'Key concerns', question: 'What should I be most concerned about in this document?' },
          { icon: 'ri-lightbulb-line', text: 'Recommendations', question: 'What are your top recommendations for proceeding?' }
        ];
        break;
    }

    // Combine: 2 base + 2 category-specific = 4 chips
    this.followUpActions = [...baseFollowUps, ...categoryFollowUps];
  }

  // Helper methods
  getRiskLevelClass(riskLevel: string | undefined): string {
    if (!riskLevel) return 'bg-secondary';
    switch (riskLevel.toLowerCase()) {
      case 'high': return 'bg-danger';
      case 'medium': return 'bg-warning';
      case 'low': return 'bg-success';
      default: return 'bg-secondary';
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Strip timestamp prefix from filename (e.g., "1764550939268_Executive..." -> "Executive...")
   */
  getCleanFileName(fileName: string | undefined): string {
    if (!fileName) return 'Unknown Document';
    return fileName.replace(/^\d+_/, '');
  }

  formatDate(timestamp: number | Date): string {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  // Scroll handling - listen to window scroll since we use main page scrolling
  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.showScrollToTop = window.scrollY > 300;
  }

  scrollToTop(): void {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
}
