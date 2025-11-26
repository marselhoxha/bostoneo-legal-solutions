import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
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
  } = {
    overview: true,
    actions: true,
    timeline: true,
    keyFindings: true,
    keyTerms: false,
    riskAssessment: false,
    obligations: false,
    askAi: true
  };

  // Contract-specific parsed sections
  contractSections: {
    keyTerms?: string;
    riskAssessment?: string;
    obligations?: string;
  } = {};

  constructor(
    private documentAnalyzerService: DocumentAnalyzerService,
    private notificationService: NotificationService,
    private actionItemService: ActionItemService,
    private stateService: AiWorkspaceStateService
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

    // Extract parties info from metadata
    this.extractPartiesInfo();
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
      askAi: true
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
    // Try to extract parties from metadata or analysis
    if (this.document.extractedMetadata) {
      try {
        const metadata = JSON.parse(this.document.extractedMetadata);
        if (metadata.parties) {
          if (Array.isArray(metadata.parties)) {
            // Array of party names or objects
            const names = metadata.parties.map((p: any) =>
              typeof p === 'string' ? p : (p.name || p.party || Object.values(p)[0])
            ).filter(Boolean);
            this.partiesInfo = names.length > 0 ? `${names.length} parties` : '';
          } else if (typeof metadata.parties === 'object') {
            // Object format like {plaintiff: "Name", defendant: "Name"}
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

    // Fallback: scan analysis for party names
    if (!this.partiesInfo && this.document.analysis?.fullAnalysis) {
      const analysis = this.document.analysis.fullAnalysis;
      // Look for "Plaintiff" and "Defendant" mentions
      const hasPlaintiff = /plaintiff/i.test(analysis);
      const hasDefendant = /defendant/i.test(analysis);
      if (hasPlaintiff && hasDefendant) {
        this.partiesInfo = 'Plaintiff vs Defendant';
      } else if (hasPlaintiff || hasDefendant) {
        this.partiesInfo = 'Parties identified';
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
    const evidenceMatch = fullAnalysis.match(/##\s*[📊📝]*\s*(EVIDENCE|UNSUPPORTED\s*FACTUAL|FACTUAL)[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
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
          console.log('📨 Loaded Ask AI messages:', messages.length);
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

  // Ask AI functionality
  async askQuestion(): Promise<void> {
    if (!this.askAiQuestion.trim() || this.isAskingAi) return;

    const question = this.askAiQuestion.trim();
    this.askAiQuestion = '';

    // Add user message locally
    this.askAiMessages.push({
      role: 'user',
      content: question,
      timestamp: new Date()
    });

    // Save user message to backend
    if (this.document?.databaseId) {
      this.documentAnalyzerService.addAnalysisMessage(
        this.document.databaseId,
        'user',
        question
      ).pipe(takeUntil(this.destroy$)).subscribe();
    }

    this.isAskingAi = true;

    try {
      // For now, create a contextual prompt using the analysis
      const context = `
Document: ${this.document.fileName}
Type: ${this.document.detectedType}
Analysis Summary: ${this.document.analysis?.summary || 'N/A'}

User Question: ${question}

Please answer based on the document analysis above.`;

      // TODO: Call backend AI API for document-specific Q&A
      // For now, show a placeholder response with document context
      setTimeout(() => {
        const assistantResponse = `I understand you're asking about "${question}" regarding **${this.document.fileName}**.\n\nBased on the ${this.document.detectedType} analysis, I would need to review the specific details. This feature will be enhanced with a dedicated document Q&A AI endpoint.\n\nIn the meantime, you can review the analysis tabs for detailed information.`;

        this.askAiMessages.push({
          role: 'assistant',
          content: assistantResponse,
          timestamp: new Date()
        });

        // Save assistant response to backend
        if (this.document?.databaseId) {
          this.documentAnalyzerService.addAnalysisMessage(
            this.document.databaseId,
            'assistant',
            assistantResponse
          ).pipe(takeUntil(this.destroy$)).subscribe();
        }

        this.isAskingAi = false;
      }, 1500);

    } catch (error) {
      this.notificationService.error('Error', 'Failed to process your question');
      this.isAskingAi = false;
    }
  }

  onEnterPress(event: KeyboardEvent): void {
    if (!event.shiftKey) {
      event.preventDefault();
      this.askQuestion();
    }
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

  // Scroll handling
  onScroll(event: Event): void {
    const target = event.target as HTMLElement;
    this.showScrollToTop = target.scrollTop > 300;
  }

  scrollToTop(): void {
    this.viewerContainer?.nativeElement?.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
}
