import { Component, OnInit, ViewChild, TemplateRef, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgbModal, NgbModalModule, NgbNavModule, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import Swal from 'sweetalert2';
import { SignatureService, SignatureRequest, SignatureStats, SignatureTemplate, BrandSettings, BoldSignDashboard, DocumentProperties, DocumentSummary } from '../../core/services/signature.service';
import { OrganizationService } from '../../core/services/organization.service';
import { ClientService } from '../../service/client.service';
import { CaseService } from '../../modules/legal/services/case.service';
import { RbacService } from '../../core/services/rbac.service';
import { Client } from '../../interface/client';
import { LegalCase } from '../../modules/legal/interfaces/case.interface';
import { SignatureListComponent } from '../../shared/components/signature-list/signature-list.component';
import { SignatureStatusBadgeComponent } from '../../shared/components/signature-status-badge/signature-status-badge.component';
import { BoldSignEmbedComponent, BoldSignEvent } from '../../shared/components/boldsign-embed/boldsign-embed.component';

@Component({
  selector: 'app-signatures',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    NgbModalModule,
    NgbNavModule,
    NgbDropdownModule,
    SignatureListComponent,
    SignatureStatusBadgeComponent,
    BoldSignEmbedComponent
  ],
  templateUrl: './signatures.component.html',
  styleUrls: ['./signatures.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignaturesComponent implements OnInit {
  @ViewChild('detailModal') detailModal!: TemplateRef<any>;
  @ViewChild('auditModal') auditModal!: TemplateRef<any>;
  @ViewChild('templateModal') templateModal!: TemplateRef<any>;
  @ViewChild('useTemplateModal') useTemplateModal!: TemplateRef<any>;
  @ViewChild('documentPropertiesModal') documentPropertiesModal!: TemplateRef<any>;

  // Organization ID from service
  get organizationId(): number {
    return this.organizationService.getCurrentOrganizationId();
  }

  // Tab state
  activeTab: string = 'documents';

  // Global search
  globalSearch: string = '';

  // Dashboard filter
  selectedDashboardFilter: string = '';

  // FAB state
  fabExpanded: boolean = false;

  // Stats
  stats: SignatureStats | null = null;
  loadingStats = false;

  // Dashboard
  dashboard: BoldSignDashboard | null = null;
  loadingDashboard = false;

  // Document Properties (from BoldSign)
  selectedDocumentProperties: DocumentProperties | null = null;
  loadingDocumentProperties = false;
  docPropsActiveTab = 'recipients';  // For modal tabs

  // Templates
  templates: SignatureTemplate[] = [];
  loadingTemplates = false;

  // Selected items
  selectedRequest: SignatureRequest | null = null;
  selectedTemplate: SignatureTemplate | null = null;
  editingTemplate: boolean = false;

  // Audit logs
  auditLogs: any[] = [];
  loadingAudit = false;

  // Embedded URLs
  sendDocumentUrl: string = '';
  templateEmbedUrl: string = '';
  useTemplateUrl: string = '';
  loadingEmbedUrl = false;
  embedError: string | null = null;

  // Client and Case lists
  clients: Client[] = [];
  cases: LegalCase[] = [];
  loadingClients = false;
  loadingCases = false;

  // Send document form
  sendDocForm = {
    title: '',
    signerName: '',
    signerEmail: '',
    message: '',
    clientId: null as number | null,
    caseId: null as string | null
  };
  selectedFile: File | null = null;

  // Create template form
  createTemplateForm = {
    name: '',
    description: '',
    category: 'General'
  };
  templateFile: File | null = null;
  showCreateTemplateForm: boolean = true; // Show form first, then BoldSign embed
  isSettingUpTemplate: boolean = false; // True when completing setup for existing template

  // Use template form (signer info for sending from template)
  useTemplateForm = {
    signerName: '',
    signerEmail: ''
  };
  showUseTemplateForm: boolean = true; // Show form first, then BoldSign embed

  // Branding settings
  brandSettings: BrandSettings = {};
  brandLoading = false;
  brandSaving = false;
  brandSaveResult: { success: boolean; message: string } | null = null;
  selectedLogoFile: File | null = null;
  logoPreviewUrl: string | null = null;
  brandPreviewMode: 'email' | 'signer' = 'email';
  brandPreviewDevice: 'desktop' | 'mobile' = 'desktop';

  // Check if user can access branding tab
  get canAccessBranding(): boolean {
    return this.rbacService.hasRole('ROLE_ADMIN') ||
           this.rbacService.hasRole('ROLE_SYSADMIN') ||
           this.rbacService.hasRole('ROLE_ATTORNEY');
  }

  constructor(
    public signatureService: SignatureService,
    private organizationService: OrganizationService,
    private clientService: ClientService,
    private caseService: CaseService,
    private rbacService: RbacService,
    private modalService: NgbModal,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
    this.loadStats();
    this.loadTemplates();
    this.loadClients();
  }

  // ==================== Tab Navigation ====================

  switchToSendTab(): void {
    this.activeTab = 'send';
    // Don't auto-call API - user needs to fill form and click Continue
    this.cdr.detectChanges();
  }

  switchToDocumentsTab(): void {
    this.activeTab = 'documents';
    this.sendDocumentUrl = '';
    this.embedError = null;
    this.cdr.detectChanges();
  }

  onTabChange(): void {
    // No auto API calls on tab change - wait for user action
    this.cdr.detectChanges();
  }

  // ==================== Error Handling ====================

  /**
   * Handle API errors with user-friendly messages
   */
  private handleApiError(err: any, defaultMessage: string): void {
    const errorMessage = err.error?.message || err.message || 'Unknown error';
    const is429 = err.status === 429 || errorMessage.includes('429') || errorMessage.includes('quota');

    if (is429) {
      Swal.fire({
        title: 'API Limit Reached',
        html: `
          <p>BoldSign API rate limit has been exceeded.</p>
          <p class="text-muted mt-2">
            <small>Sandbox mode: 50 requests/hour<br>
            Production mode: 2000 requests/hour</small>
          </p>
          <p class="mt-2">Please wait a few minutes and try again.</p>
        `,
        icon: 'warning',
        confirmButtonColor: '#405189'
      });
    } else {
      Swal.fire({
        title: 'Error',
        text: `${defaultMessage}: ${errorMessage}`,
        icon: 'error',
        confirmButtonColor: '#405189'
      });
    }
  }

  // ==================== Stats ====================

  loadStats(): void {
    this.loadingStats = true;
    this.cdr.markForCheck();

    this.signatureService.getStatistics(this.organizationId).subscribe({
      next: (response) => {
        this.stats = response.data?.statistics;
        this.loadingStats = false;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading stats:', err);
        this.loadingStats = false;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      }
    });
  }

  loadDashboard(): void {
    this.loadingDashboard = true;
    this.cdr.markForCheck();

    this.signatureService.getDashboard(this.organizationId).subscribe({
      next: (response) => {
        this.dashboard = response.data?.dashboard;
        this.loadingDashboard = false;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading dashboard:', err);
        this.loadingDashboard = false;
        this.cdr.markForCheck();
        this.cdr.detectChanges();

        // Check for rate limit error
        const errorMessage = err.error?.message || err.message || '';
        if (err.status === 429 || errorMessage.includes('429') || errorMessage.includes('quota')) {
          this.handleApiError(err, 'Failed to load dashboard');
        }
        // Silently fail for other errors - dashboard will just show empty/cached
      }
    });
  }

  openDocumentDetails(doc: DocumentSummary): void {
    this.loadingDocumentProperties = true;
    this.selectedDocumentProperties = null;

    this.signatureService.getDocumentProperties(doc.documentId).subscribe({
      next: (response) => {
        this.selectedDocumentProperties = response.data?.document;
        this.loadingDocumentProperties = false;
        this.modalService.open(this.documentPropertiesModal, {
          size: 'lg',
          centered: true
        });
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading document properties:', err);
        this.loadingDocumentProperties = false;
        this.cdr.detectChanges();

        // Check for rate limit error
        const errorMessage = err.error?.message || err.message || '';
        if (err.status === 429 || errorMessage.includes('429') || errorMessage.includes('quota')) {
          this.handleApiError(err, 'Failed to load document details');
        } else {
          this.showErrorToast('Failed to load document details');
        }
      }
    });
  }

  /**
   * Download audit trail PDF for a document
   */
  downloadAuditTrail(documentId: string): void {
    if (!documentId) return;
    this.signatureService.downloadAuditTrail(documentId);
  }

  /**
   * Download document by BoldSign document ID
   */
  downloadDocumentByBoldsignId(documentId: string): void {
    if (!documentId) return;
    this.signatureService.downloadDocumentByBoldsignId(documentId);
  }

  /**
   * Send reminder for a document
   */
  sendDocumentReminder(documentId: string): void {
    // TODO: Implement reminder via BoldSign API
    this.showSuccessToast('Reminder sent successfully');
  }

  /**
   * View document in BoldSign
   */
  viewDocumentInBoldSign(documentId: string): void {
    // Open BoldSign document view (would need embedded URL from API)
    window.open(`https://app.boldsign.com/document/${documentId}`, '_blank');
  }

  /**
   * Void a document
   */
  voidDocument(documentId: string): void {
    Swal.fire({
      title: 'Void Document',
      text: 'Are you sure you want to void this document? This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Yes, void it',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        // TODO: Implement void via BoldSign API
        this.showSuccessToast('Document voided successfully');
        this.modalService.dismissAll();
        this.loadDashboard();
      }
    });
  }

  getStatusBadgeClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'signed':
        return 'bg-success';
      case 'inprogress':
      case 'sent':
      case 'waitingforothers':
        return 'bg-info';
      case 'declined':
      case 'revoked':
        return 'bg-danger';
      case 'expired':
        return 'bg-warning';
      default:
        return 'bg-secondary';
    }
  }

  /**
   * Get display text for signer status
   */
  getSignerStatusDisplay(status: string): string {
    if (!status) return '-';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('notyet') || statusLower.includes('notcompleted')) {
      return 'Not yet viewed';
    } else if (statusLower === 'completed' || statusLower === 'signed') {
      return 'Signed';
    } else if (statusLower === 'viewed') {
      return 'Viewed';
    } else if (statusLower === 'declined') {
      return 'Declined';
    }
    return status;
  }

  // ==================== Templates ====================

  loadTemplates(): void {
    this.loadingTemplates = true;
    this.cdr.markForCheck();

    this.signatureService.getTemplates(this.organizationId).subscribe({
      next: (response) => {
        this.templates = response.data?.templates || [];
        this.loadingTemplates = false;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading templates:', err);
        this.loadingTemplates = false;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      }
    });
  }

  // Template stats helpers
  getReadyTemplatesCount(): number {
    return this.templates.filter(t => t.boldsignTemplateId).length;
  }

  getPendingSetupCount(): number {
    return this.templates.filter(t => !t.boldsignTemplateId).length;
  }

  getGlobalTemplatesCount(): number {
    return this.templates.filter(t => t.isGlobal).length;
  }

  // ==================== Clients & Cases ====================

  loadClients(): void {
    this.loadingClients = true;
    this.cdr.markForCheck();

    this.clientService.allClients$().subscribe({
      next: (response: any) => {
        this.clients = response.data?.page?.content || [];
        this.loadingClients = false;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading clients:', err);
        this.loadingClients = false;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      }
    });
  }

  onClientChange(): void {
    // Reset case selection when client changes
    this.sendDocForm.caseId = null;
    this.cases = [];

    if (this.sendDocForm.clientId) {
      // Auto-fill signer info from selected client
      const client = this.clients.find(c => c.id === this.sendDocForm.clientId);
      if (client) {
        this.sendDocForm.signerName = client.name;
        this.sendDocForm.signerEmail = client.email;
        this.cdr.detectChanges();
      }
      // Load cases for selected client
      this.loadCasesForClient(this.sendDocForm.clientId);
    }
  }

  loadCasesForClient(clientId: number): void {
    this.loadingCases = true;
    this.caseService.getCases(0, 100).subscribe({
      next: (response) => {
        const allCases = response.data?.cases || [];
        this.cases = allCases.filter((c: LegalCase) =>
          c.client?.id === String(clientId) || c.clientEmail === this.clients.find(cl => cl.id === clientId)?.email
        );
        this.loadingCases = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading cases:', err);
        this.loadingCases = false;
        this.cdr.detectChanges();
      }
    });
  }

  createNewTemplate(): void {
    this.editingTemplate = false;
    this.isSettingUpTemplate = false;
    this.selectedTemplate = null;
    this.showCreateTemplateForm = true;
    this.templateEmbedUrl = '';
    this.embedError = null;
    this.resetCreateTemplateForm();

    // Open modal with form first
    this.modalService.open(this.templateModal, {
      size: 'xl',
      centered: true,
      backdrop: 'static',
      scrollable: true
    });
  }

  onTemplateFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.templateFile = input.files[0];
    }
  }

  canProceedToTemplateEmbed(): boolean {
    return !!(
      this.createTemplateForm.name &&
      this.templateFile
    );
  }

  resetCreateTemplateForm(): void {
    this.createTemplateForm = {
      name: '',
      description: '',
      category: 'General'
    };
    this.templateFile = null;
    this.templateEmbedUrl = '';
    this.embedError = null;
    this.showCreateTemplateForm = true;
    this.isSettingUpTemplate = false;
  }

  proceedToTemplateEmbed(): void {
    if (!this.canProceedToTemplateEmbed()) {
      this.embedError = 'Please fill in the template name and upload a document.';
      return;
    }

    this.loadingEmbedUrl = true;
    this.embedError = null;

    // Convert file to base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];

      this.signatureService.getEmbeddedCreateTemplateUrl(
        this.organizationId,
        {
          title: this.createTemplateForm.name,
          description: this.createTemplateForm.description,
          category: this.createTemplateForm.category,
          fileName: this.templateFile!.name,
          fileBase64: base64
        }
      ).subscribe({
        next: (response) => {
          this.templateEmbedUrl = response.data?.embedded?.url;
          this.loadingEmbedUrl = false;
          this.showCreateTemplateForm = false; // Switch to embed view
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error getting template create URL:', err);
          this.loadingEmbedUrl = false;
          this.cdr.detectChanges();

          // Check for rate limit error
          const errorMessage = err.error?.message || err.message || '';
          if (err.status === 429 || errorMessage.includes('429') || errorMessage.includes('quota')) {
            this.handleApiError(err, 'Failed to load template editor');
          } else {
            this.embedError = errorMessage || 'Failed to load template editor';
          }
        }
      });
    };
    reader.onerror = () => {
      this.loadingEmbedUrl = false;
      this.embedError = 'Failed to read the file. Please try again.';
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(this.templateFile!);
  }

  editTemplate(template: SignatureTemplate): void {
    if (!template.boldsignTemplateId) {
      Swal.fire({
        title: 'Cannot Edit',
        text: 'This template has not been set up in BoldSign yet.',
        icon: 'info',
        confirmButtonColor: '#405189'
      });
      return;
    }

    this.editingTemplate = true;
    this.selectedTemplate = template;
    this.loadingEmbedUrl = true;
    this.templateEmbedUrl = '';
    this.cdr.detectChanges();

    this.signatureService.getEmbeddedEditTemplateUrl(template.boldsignTemplateId).subscribe({
      next: (response) => {
        this.templateEmbedUrl = response.data?.embedded?.url;
        this.loadingEmbedUrl = false;
        this.cdr.detectChanges();

        this.modalService.open(this.templateModal, {
          size: 'xl',
          centered: true,
          backdrop: 'static',
          scrollable: true
        });
      },
      error: (err) => {
        console.error('Error getting template edit URL:', err);
        this.loadingEmbedUrl = false;
        this.editingTemplate = false;
        this.cdr.detectChanges();

        const errorMsg = err.error?.message || err.message || '';
        // Handle 404 - template doesn't exist in BoldSign
        if (err.status === 404 || errorMsg.includes('Invalid template ID') || errorMsg.includes('404')) {
          Swal.fire({
            title: 'Template Not Found',
            html: `<p>This template no longer exists in BoldSign.</p>
                   <p class="text-muted mt-2">The template may have been deleted or was never fully created. Would you like to set it up again?</p>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Set Up Template',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#405189'
          }).then((result) => {
            if (result.isConfirmed && template) {
              // Clear the invalid boldsignTemplateId and set up fresh
              template.boldsignTemplateId = undefined;
              this.setupTemplateInBoldSign(template);
            }
          });
        } else {
          this.handleApiError(err, 'Failed to load template editor');
        }
      }
    });
  }

  useTemplate(template: SignatureTemplate): void {
    if (!template.boldsignTemplateId) {
      // Template not set up in BoldSign yet - offer to set it up
      Swal.fire({
        title: 'Setup Required',
        text: `This template "${template.name}" needs to be set up in BoldSign first. Would you like to create it now?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, set it up',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#405189'
      }).then((result) => {
        if (result.isConfirmed) {
          this.setupTemplateInBoldSign(template);
        }
      });
      return;
    }

    this.selectedTemplate = template;
    this.useTemplateUrl = '';
    this.useTemplateForm = { signerName: '', signerEmail: '' };
    this.showUseTemplateForm = true;
    this.embedError = null;
    this.cdr.detectChanges();

    // Open modal with form first
    this.modalService.open(this.useTemplateModal, {
      size: 'xl',
      centered: true,
      backdrop: 'static',
      scrollable: true
    });
  }

  canProceedToUseTemplateEmbed(): boolean {
    return !!(this.useTemplateForm.signerName && this.useTemplateForm.signerEmail);
  }

  proceedToUseTemplateEmbed(): void {
    if (!this.canProceedToUseTemplateEmbed()) {
      this.embedError = 'Please enter signer name and email.';
      return;
    }

    this.loadingEmbedUrl = true;
    this.embedError = null;

    this.signatureService.getEmbeddedSendFromTemplateUrl(
      this.selectedTemplate!.boldsignTemplateId!,
      this.organizationId,
      {
        signerName: this.useTemplateForm.signerName,
        signerEmail: this.useTemplateForm.signerEmail
      }
    ).subscribe({
      next: (response) => {
        this.useTemplateUrl = response.data?.embedded?.url;
        this.loadingEmbedUrl = false;
        this.showUseTemplateForm = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error getting template send URL:', err);
        this.loadingEmbedUrl = false;
        this.cdr.detectChanges();

        const errorMessage = err.error?.message || err.message || '';

        // Handle 400/404 - template doesn't exist in BoldSign
        if (err.status === 400 || err.status === 404 || errorMessage.includes('Invalid template ID') || errorMessage.includes('not found')) {
          this.modalService.dismissAll();
          Swal.fire({
            title: 'Template Not Found',
            html: `<p>This template no longer exists in BoldSign.</p>
                   <p class="text-muted mt-2">The template may have been deleted or was never fully created. Would you like to set it up again?</p>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Set Up Template',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#405189'
          }).then((result) => {
            if (result.isConfirmed && this.selectedTemplate) {
              // Clear the invalid boldsignTemplateId and set up fresh
              this.selectedTemplate.boldsignTemplateId = undefined;
              this.setupTemplateInBoldSign(this.selectedTemplate);
            }
          });
        } else if (err.status === 429 || errorMessage.includes('429') || errorMessage.includes('quota')) {
          // Check for rate limit error
          this.handleApiError(err, 'Failed to load document editor');
        } else {
          this.embedError = errorMessage || 'Failed to load document editor.';
        }
      }
    });
  }

  /**
   * Normalize category value to match dropdown options
   */
  private normalizeCategoryValue(category: string | undefined): string {
    if (!category) return 'General';

    const normalized = category.toLowerCase().trim();
    const categoryMap: { [key: string]: string } = {
      'general': 'General',
      'retainer': 'Retainer',
      'retainer agreements': 'Retainer',
      'retainer agreement': 'Retainer',
      'nda': 'NDA',
      'non-disclosure': 'NDA',
      'non-disclosure agreement': 'NDA',
      'settlement': 'Settlement',
      'settlement agreement': 'Settlement',
      'consent': 'Consent',
      'consent forms': 'Consent',
      'consent form': 'Consent',
      'poa': 'POA',
      'power of attorney': 'POA',
      'fee': 'Fee',
      'fee agreements': 'Fee',
      'fee agreement': 'Fee',
      'release': 'Release',
      'release forms': 'Release',
      'release form': 'Release'
    };

    return categoryMap[normalized] || category;
  }

  /**
   * Set up a template in BoldSign (for templates that only exist in our DB)
   */
  setupTemplateInBoldSign(template: SignatureTemplate): void {
    // Pre-populate form with existing template data
    this.editingTemplate = false;
    this.isSettingUpTemplate = true;
    this.selectedTemplate = template;
    this.showCreateTemplateForm = true;
    this.templateEmbedUrl = '';
    this.embedError = null;
    this.templateFile = null;

    // Pre-fill form with existing template details (normalize category for dropdown)
    this.createTemplateForm = {
      name: template.name || '',
      description: template.description || '',
      category: this.normalizeCategoryValue(template.category)
    };

    // Open modal with form first so user can upload PDF
    this.modalService.open(this.templateModal, {
      size: 'xl',
      centered: true,
      backdrop: 'static',
      scrollable: true
    });

    this.cdr.detectChanges();
  }

  deleteTemplate(template: SignatureTemplate): void {
    Swal.fire({
      title: 'Delete Template?',
      text: `Are you sure you want to delete the template "${template.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#f06548',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        this.signatureService.deleteTemplate(template.id).subscribe({
          next: () => {
            Swal.fire({
              title: 'Deleted!',
              text: 'The template has been deleted.',
              icon: 'success',
              timer: 2000,
              showConfirmButton: false
            });
            this.loadTemplates();
          },
          error: (err) => {
            Swal.fire({
              title: 'Error',
              text: 'Failed to delete template: ' + (err.error?.message || 'Unknown error'),
              icon: 'error',
              confirmButtonColor: '#405189'
            });
          }
        });
      }
    });
  }

  // ==================== Embedded Document Sending ====================

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  canProceedToEmbed(): boolean {
    return !!(
      this.sendDocForm.title &&
      this.sendDocForm.signerName &&
      this.sendDocForm.signerEmail &&
      this.selectedFile
    );
  }

  resetSendForm(): void {
    this.sendDocForm = {
      title: '',
      signerName: '',
      signerEmail: '',
      message: '',
      clientId: null,
      caseId: null
    };
    this.selectedFile = null;
    this.sendDocumentUrl = '';
    this.embedError = null;
    this.cases = [];
  }

  loadSendDocumentEmbed(): void {
    if (!this.canProceedToEmbed()) {
      return;
    }

    this.loadingEmbedUrl = true;
    this.embedError = null;
    this.sendDocumentUrl = '';

    // Convert file to base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]; // Remove data:application/pdf;base64, prefix

      this.signatureService.getEmbeddedSendDocumentUrl(
        this.organizationId,
        {
          title: this.sendDocForm.title,
          signerName: this.sendDocForm.signerName,
          signerEmail: this.sendDocForm.signerEmail,
          message: this.sendDocForm.message,
          fileName: this.selectedFile!.name,
          fileBase64: base64,
          clientId: this.sendDocForm.clientId ?? undefined,
          caseId: this.sendDocForm.caseId ?? undefined
        }
      ).subscribe({
        next: (response) => {
          this.sendDocumentUrl = response.data?.embedded?.url;
          this.loadingEmbedUrl = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error getting embedded send URL:', err);
          this.loadingEmbedUrl = false;
          this.cdr.detectChanges();

          // Check for rate limit error
          const errorMessage = err.error?.message || err.message || '';
          if (err.status === 429 || errorMessage.includes('429') || errorMessage.includes('quota')) {
            this.handleApiError(err, 'Failed to load document editor');
          } else {
            this.embedError = errorMessage || 'Failed to load document editor. Please check your BoldSign API configuration.';
          }
        }
      });
    };
    reader.onerror = () => {
      this.loadingEmbedUrl = false;
      this.embedError = 'Failed to read the file. Please try again.';
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(this.selectedFile!);
  }

  onDocumentSent(event: BoldSignEvent): void {
    console.log('Document sent:', event);
    this.loadStats();

    // Allow user to see BoldSign's success message, then redirect after 2.5 seconds
    setTimeout(() => {
      this.switchToDocumentsTab();
      this.resetSendForm();
      this.cdr.detectChanges();
    }, 2500);
  }

  onDocumentSentFromTemplate(event: BoldSignEvent): void {
    console.log('Document sent from template:', event);
    this.loadStats();

    // Allow user to see BoldSign's success message, then close modal and redirect
    setTimeout(() => {
      this.modalService.dismissAll();
      this.activeTab = 'documents';
      this.useTemplateUrl = '';
      this.cdr.detectChanges();
    }, 2500);
  }

  onEmbedCancelled(): void {
    console.log('Embed cancelled');
    this.switchToDocumentsTab();
  }

  onEmbedError(event: BoldSignEvent): void {
    console.error('Embed error:', event);
    this.embedError = event.message || 'An error occurred';
  }

  onEmbedLoaded(): void {
    console.log('Embed loaded successfully');
  }

  onTemplateCreated(event: BoldSignEvent): void {
    console.log('Template created:', event);
    this.loadTemplates();

    // Allow user to see BoldSign's success message, then close modal
    setTimeout(() => {
      this.modalService.dismissAll();
      this.resetCreateTemplateForm();
      this.cdr.detectChanges();
    }, 2500);
  }

  // ==================== Request Details ====================

  onRequestSelected(request: SignatureRequest): void {
    this.selectedRequest = request;
    this.modalService.open(this.detailModal, {
      size: 'lg',
      centered: true
    });
  }

  /**
   * Handle BoldSign document selection from signature-list
   */
  onBoldsignDocumentSelected(doc: any): void {
    // Use the existing openDocumentDetails method
    this.openDocumentDetails({ documentId: doc.documentId } as any);
  }

  onViewAuditLog(request: SignatureRequest): void {
    this.selectedRequest = request;
    this.loadAuditLogs(request.id);
    this.modalService.open(this.auditModal, {
      size: 'lg',
      centered: true,
      scrollable: true
    });
  }

  loadAuditLogs(requestId: number): void {
    this.loadingAudit = true;
    this.signatureService.getAuditLogs(requestId).subscribe({
      next: (response) => {
        this.auditLogs = response.data?.auditLogs || [];
        this.loadingAudit = false;
      },
      error: (err) => {
        console.error('Error loading audit logs:', err);
        this.loadingAudit = false;
      }
    });
  }

  sendReminder(request: SignatureRequest): void {
    this.signatureService.sendReminder(request.id).subscribe({
      next: () => {
        Swal.fire({
          title: 'Reminder Sent!',
          text: 'The reminder has been sent successfully.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: (err) => {
        Swal.fire({
          title: 'Error',
          text: 'Failed to send reminder: ' + (err.error?.message || 'Unknown error'),
          icon: 'error',
          confirmButtonColor: '#405189'
        });
      }
    });
  }

  downloadDocument(request: SignatureRequest): void {
    this.signatureService.downloadAsFile(request.id, request.fileName || 'signed-document.pdf');
  }

  refreshStatus(request: SignatureRequest): void {
    this.signatureService.refreshStatus(request.id).subscribe({
      next: (response) => {
        if (response.data?.signatureRequest) {
          Object.assign(request, response.data.signatureRequest);
        }
      },
      error: (err) => {
        console.error('Error refreshing status:', err);
      }
    });
  }

  // ==================== Utilities ====================

  formatDate(date: string | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  getEventIcon(eventType: string): string {
    switch (eventType?.toUpperCase()) {
      case 'CREATED': return 'ri-add-circle-line text-info';
      case 'SENT': return 'ri-send-plane-line text-primary';
      case 'VIEWED': return 'ri-eye-line text-warning';
      case 'SIGNED': return 'ri-edit-line text-success';
      case 'COMPLETED': return 'ri-check-double-line text-success';
      case 'DECLINED': return 'ri-close-circle-line text-danger';
      case 'EXPIRED': return 'ri-time-line text-dark';
      case 'VOIDED': return 'ri-forbid-line text-danger';
      case 'REMINDER_SENT': return 'ri-notification-3-line text-info';
      default: return 'ri-information-line text-secondary';
    }
  }

  // ==================== New Helper Methods ====================

  onGlobalSearch(): void {
    if (this.globalSearch.trim()) {
      // TODO: Implement search functionality
      console.log('Searching for:', this.globalSearch);
    }
  }

  filterByDashboard(filter: string): void {
    if (this.selectedDashboardFilter === filter) {
      this.selectedDashboardFilter = ''; // Toggle off
    } else {
      this.selectedDashboardFilter = filter;
    }
    // TODO: Apply filter to document list
  }

  isExpiringSoon(expiryDate: string | undefined): boolean {
    if (!expiryDate) return false;
    try {
      const expiry = new Date(expiryDate);
      const now = new Date();
      const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
    } catch {
      return false;
    }
  }

  getSignerStatusClass(status: string): string {
    if (!status) return 'bg-secondary';
    const statusLower = status.toLowerCase();
    if (statusLower === 'completed' || statusLower === 'signed') {
      return 'bg-success';
    } else if (statusLower === 'declined') {
      return 'bg-danger';
    } else if (statusLower === 'viewed') {
      return 'bg-info';
    }
    return 'bg-warning';
  }

  getActivityIcon(action: string): string {
    const actionLower = (action || '').toLowerCase();
    if (actionLower.includes('sent') || actionLower.includes('send')) {
      return 'ri-send-plane-line';
    } else if (actionLower.includes('view')) {
      return 'ri-eye-line';
    } else if (actionLower.includes('sign') || actionLower.includes('completed')) {
      return 'ri-check-line';
    } else if (actionLower.includes('remind')) {
      return 'ri-notification-3-line';
    } else if (actionLower.includes('decline') || actionLower.includes('revok')) {
      return 'ri-close-circle-line';
    }
    return 'ri-information-line';
  }

  getActivityIconClass(action: string): string {
    const actionLower = (action || '').toLowerCase();
    if (actionLower.includes('sent') || actionLower.includes('send')) {
      return 'bg-primary-subtle text-primary';
    } else if (actionLower.includes('view')) {
      return 'bg-info-subtle text-info';
    } else if (actionLower.includes('sign') || actionLower.includes('completed')) {
      return 'bg-success-subtle text-success';
    } else if (actionLower.includes('remind')) {
      return 'bg-warning-subtle text-warning';
    } else if (actionLower.includes('decline') || actionLower.includes('revok')) {
      return 'bg-danger-subtle text-danger';
    }
    return 'bg-secondary-subtle text-secondary';
  }

  // Toast notification helpers
  private showSuccessToast(message: string): void {
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      didOpen: (toast) => {
        toast.onmouseenter = Swal.stopTimer;
        toast.onmouseleave = Swal.resumeTimer;
      }
    });
    Toast.fire({
      icon: 'success',
      title: message
    });
  }

  private showErrorToast(message: string): void {
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      didOpen: (toast) => {
        toast.onmouseenter = Swal.stopTimer;
        toast.onmouseleave = Swal.resumeTimer;
      }
    });
    Toast.fire({
      icon: 'error',
      title: message
    });
  }

  // ==================== Branding ====================

  loadBrandSettings(): void {
    this.brandLoading = true;
    this.signatureService.getBrand(this.organizationId).subscribe({
      next: (response) => {
        this.brandLoading = false;
        if (response?.data?.brand && Object.keys(response.data.brand).length > 0) {
          this.brandSettings = response.data.brand;
          if (this.brandSettings.brandLogoUrl) {
            this.logoPreviewUrl = this.brandSettings.brandLogoUrl;
          }
        } else {
          // Initialize with defaults
          this.brandSettings = {
            brandName: '',
            primaryColor: '#405189',
            backgroundColor: '#ffffff',
            buttonColor: '#405189',
            buttonTextColor: '#ffffff',
            emailDisplayName: ''
          };
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.brandLoading = false;
        console.error('Failed to load brand settings:', error);
        // Initialize with defaults on error
        this.brandSettings = {
          brandName: '',
          primaryColor: '#405189',
          backgroundColor: '#ffffff',
          buttonColor: '#405189',
          buttonTextColor: '#ffffff',
          emailDisplayName: ''
        };
        this.cdr.detectChanges();
      }
    });
  }

  saveBrandSettings(): void {
    // Validate required fields
    if (!this.brandSettings.brandName || this.brandSettings.brandName.trim() === '') {
      this.brandSaveResult = {
        success: false,
        message: 'Brand name is required'
      };
      return;
    }

    // For new brands (no brandId), logo is required
    if (!this.brandSettings.brandId && !this.selectedLogoFile && !this.brandSettings.brandLogoUrl) {
      this.brandSaveResult = {
        success: false,
        message: 'Brand logo is required. Please upload a logo file (JPG, JPEG, PNG, or SVG).'
      };
      return;
    }

    this.brandSaving = true;
    this.brandSaveResult = null;

    // If a new logo file is selected, convert to base64 and send
    if (this.selectedLogoFile) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1]; // Remove data:image/...;base64, prefix
        const brandData: BrandSettings = {
          ...this.brandSettings,
          brandLogoBase64: base64,
          brandLogoFileName: this.selectedLogoFile!.name
        };
        this.submitBrandSettings(brandData);
      };
      reader.onerror = () => {
        this.brandSaving = false;
        this.brandSaveResult = {
          success: false,
          message: 'Failed to read the logo file. Please try again.'
        };
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(this.selectedLogoFile);
    } else {
      // No new file, submit without base64
      this.submitBrandSettings(this.brandSettings);
    }
  }

  private submitBrandSettings(brandData: BrandSettings): void {
    this.signatureService.saveBrand(this.organizationId, brandData).subscribe({
      next: (response) => {
        this.brandSaving = false;
        if (response?.data?.brand) {
          this.brandSettings = response.data.brand;
          // Update logo URL if returned
          if (response.data.brand.brandLogoUrl) {
            this.logoPreviewUrl = response.data.brand.brandLogoUrl;
          }
        }
        this.selectedLogoFile = null; // Clear file after successful save
        this.brandSaveResult = {
          success: true,
          message: 'Brand settings saved successfully!'
        };
        this.showSuccessToast('Brand settings saved!');
        this.cdr.detectChanges();
        // Clear success message after 3 seconds
        setTimeout(() => {
          this.brandSaveResult = null;
          this.cdr.detectChanges();
        }, 3000);
      },
      error: (error) => {
        this.brandSaving = false;
        this.brandSaveResult = {
          success: false,
          message: error.error?.message || 'Failed to save brand settings'
        };
        this.cdr.detectChanges();
      }
    });
  }

  deleteBrandSettings(): void {
    Swal.fire({
      title: 'Delete Brand Settings?',
      text: 'This will remove your custom branding from all e-signature documents.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#f06548',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        this.brandSaving = true;
        this.brandSaveResult = null;

        this.signatureService.deleteBrand(this.organizationId).subscribe({
          next: () => {
            this.brandSaving = false;
            this.brandSettings = {
              brandName: '',
              primaryColor: '#405189',
              backgroundColor: '#ffffff',
              buttonColor: '#405189',
              buttonTextColor: '#ffffff'
            };
            this.logoPreviewUrl = null;
            this.selectedLogoFile = null;
            this.brandSaveResult = {
              success: true,
              message: 'Brand settings deleted successfully!'
            };
            this.showSuccessToast('Brand settings deleted!');
            this.cdr.detectChanges();
            setTimeout(() => {
              this.brandSaveResult = null;
              this.cdr.detectChanges();
            }, 3000);
          },
          error: (error) => {
            this.brandSaving = false;
            this.brandSaveResult = {
              success: false,
              message: error.error?.message || 'Failed to delete brand settings'
            };
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  onLogoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedLogoFile = input.files[0];
      // Create preview URL
      const reader = new FileReader();
      reader.onload = () => {
        this.logoPreviewUrl = reader.result as string;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(this.selectedLogoFile);
    }
  }

  onLogoDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        this.selectedLogoFile = file;
        const reader = new FileReader();
        reader.onload = () => {
          this.logoPreviewUrl = reader.result as string;
          this.cdr.detectChanges();
        };
        reader.readAsDataURL(file);
      }
    }
  }

  onLogoDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  removeLogo(): void {
    this.selectedLogoFile = null;
    this.logoPreviewUrl = null;
    this.brandSettings.brandLogoUrl = undefined;
  }

  onBrandTabActivated(): void {
    if (!this.brandSettings.brandName && !this.brandLoading) {
      this.loadBrandSettings();
    }
  }
}
