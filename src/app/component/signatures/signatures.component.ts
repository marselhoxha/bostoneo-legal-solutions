import { Component, OnInit, ViewChild, TemplateRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal, NgbModalModule, NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import Swal from 'sweetalert2';
import { SignatureService, SignatureRequest, SignatureStats, SignatureTemplate } from '../../core/services/signature.service';
import { OrganizationService } from '../../core/services/organization.service';
import { ClientService } from '../../service/client.service';
import { CaseService } from '../../modules/legal/services/case.service';
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
    NgbModalModule,
    NgbNavModule,
    SignatureListComponent,
    SignatureStatusBadgeComponent,
    BoldSignEmbedComponent
  ],
  templateUrl: './signatures.component.html',
  styleUrls: ['./signatures.component.scss']
})
export class SignaturesComponent implements OnInit {
  @ViewChild('detailModal') detailModal!: TemplateRef<any>;
  @ViewChild('auditModal') auditModal!: TemplateRef<any>;
  @ViewChild('templateModal') templateModal!: TemplateRef<any>;
  @ViewChild('useTemplateModal') useTemplateModal!: TemplateRef<any>;

  // Organization ID from service
  get organizationId(): number {
    return this.organizationService.getCurrentOrganizationId();
  }

  // Tab state
  activeTab: string = 'documents';

  // Stats
  stats: SignatureStats | null = null;
  loadingStats = false;

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

  // Use template form (signer info for sending from template)
  useTemplateForm = {
    signerName: '',
    signerEmail: ''
  };
  showUseTemplateForm: boolean = true; // Show form first, then BoldSign embed

  constructor(
    public signatureService: SignatureService,
    private organizationService: OrganizationService,
    private clientService: ClientService,
    private caseService: CaseService,
    private modalService: NgbModal,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadStats();
    this.loadTemplates();
    this.loadClients();
  }

  // ==================== Tab Navigation ====================

  switchToSendTab(): void {
    this.activeTab = 'send';
    this.loadSendDocumentEmbed();
  }

  switchToDocumentsTab(): void {
    this.activeTab = 'documents';
    this.sendDocumentUrl = '';
    this.embedError = null;
  }

  onTabChange(): void {
    if (this.activeTab === 'send' && !this.sendDocumentUrl) {
      this.loadSendDocumentEmbed();
    }
  }

  // ==================== Stats ====================

  loadStats(): void {
    this.loadingStats = true;
    this.signatureService.getStatistics(this.organizationId).subscribe({
      next: (response) => {
        this.stats = response.data?.statistics;
        this.loadingStats = false;
      },
      error: (err) => {
        console.error('Error loading stats:', err);
        this.loadingStats = false;
      }
    });
  }

  // ==================== Templates ====================

  loadTemplates(): void {
    this.loadingTemplates = true;
    this.signatureService.getTemplates(this.organizationId).subscribe({
      next: (response) => {
        this.templates = response.data?.templates || [];
        this.loadingTemplates = false;
      },
      error: (err) => {
        console.error('Error loading templates:', err);
        this.loadingTemplates = false;
      }
    });
  }

  // ==================== Clients & Cases ====================

  loadClients(): void {
    this.loadingClients = true;
    this.clientService.allClients$().subscribe({
      next: (response: any) => {
        this.clients = response.data?.page?.content || [];
        this.loadingClients = false;
      },
      error: (err) => {
        console.error('Error loading clients:', err);
        this.loadingClients = false;
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
      }
      // Load cases for selected client
      this.loadCasesForClient(this.sendDocForm.clientId);
    }
  }

  loadCasesForClient(clientId: number): void {
    this.loadingCases = true;
    // Load all cases and filter by client - can be optimized with backend filter
    this.caseService.getCases(0, 100).subscribe({
      next: (response) => {
        const allCases = response.data?.cases || [];
        // Filter cases that have this client
        this.cases = allCases.filter((c: LegalCase) =>
          c.client?.id === String(clientId) || c.clientEmail === this.clients.find(cl => cl.id === clientId)?.email
        );
        this.loadingCases = false;
      },
      error: (err) => {
        console.error('Error loading cases:', err);
        this.loadingCases = false;
      }
    });
  }

  createNewTemplate(): void {
    this.editingTemplate = false;
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
          this.embedError = err.error?.message || 'Failed to load template editor';
          this.cdr.detectChanges();
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

    this.signatureService.getEmbeddedEditTemplateUrl(template.boldsignTemplateId).subscribe({
      next: (response) => {
        this.templateEmbedUrl = response.data?.embedded?.url;
        this.loadingEmbedUrl = false;

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
        Swal.fire({
          title: 'Error',
          text: 'Failed to load template editor: ' + (err.error?.message || 'Unknown error'),
          icon: 'error',
          confirmButtonColor: '#405189'
        });
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
        this.embedError = err.error?.message || 'Failed to load document editor.';
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Set up a template in BoldSign (for templates that only exist in our DB)
   */
  setupTemplateInBoldSign(template: SignatureTemplate): void {
    this.editingTemplate = false;
    this.selectedTemplate = template;
    this.loadingEmbedUrl = true;
    this.templateEmbedUrl = '';

    this.signatureService.getEmbeddedCreateTemplateUrl(this.organizationId).subscribe({
      next: (response) => {
        this.templateEmbedUrl = response.data?.embedded?.url;
        this.loadingEmbedUrl = false;

        this.modalService.open(this.templateModal, {
          size: 'xl',
          centered: true,
          backdrop: 'static',
          scrollable: true
        });
      },
      error: (err) => {
        console.error('Error getting template create URL:', err);
        this.loadingEmbedUrl = false;
        this.embedError = err.error?.message || 'Failed to load template editor';
      }
    });
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
      this.embedError = 'Please fill in all required fields and upload a document.';
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
          this.embedError = err.error?.message || 'Failed to load document editor. Please check your BoldSign API configuration.';
          this.cdr.detectChanges();
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

    // Show success toast immediately
    this.showSuccessToast('Document sent for signature!');

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

    // Show success toast immediately
    this.showSuccessToast('Document sent from template!');

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

    // Show success toast immediately
    this.showSuccessToast('Template created successfully!');

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

  // Toast notification helper
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
}
