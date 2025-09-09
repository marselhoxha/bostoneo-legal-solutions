import { Component, OnInit, ChangeDetectorRef, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CrmService } from '../../services/crm.service';
import { UserService } from '../../../../service/user.service';
import { User } from '../../../../interface/user';
import Swal from 'sweetalert2';
import flatpickr from 'flatpickr';

export interface LeadDTO {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  company: string;
  status: string;
  practiceArea: string;
  leadScore: number;
  assignedTo: number;
  assignedToName: string;
  source: string;
  initialInquiry: string;
  notes: string;
  urgencyLevel: string;
  contactPreference: string;
  consultationDate: string;
  followUpDate: string;
  estimatedValue: number;
  qualified: boolean;
  contacted: boolean;
  lastContactDate: string;
  contactAttempts: number;
  conversionStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStage {
  id: number;
  name: string;
  description: string;
  stageOrder: number;
  isActive: boolean;
  color: string;
  icon: string;
  isInitial: boolean;
  isFinal: boolean;
  estimatedDays: number;
}

export interface PipelineSummary {
  statusCounts: { [key: string]: number };
  recentlyMoved: LeadDTO[];
  staleLeads: LeadDTO[];
  totalLeads: number;
}

@Component({
  selector: 'app-leads-dashboard',
  templateUrl: './leads-dashboard.component.html',
  styleUrls: ['./leads-dashboard.component.scss']
})
export class LeadsDashboardComponent implements OnInit, AfterViewInit {
  leads: LeadDTO[] = [];
  allLeads: LeadDTO[] = [];
  filteredLeads: LeadDTO[] = [];
  pipelineStages: PipelineStage[] = [];
  pipelineSummary: PipelineSummary | null = null;
  loading = false;
  
  currentPage = 0;
  pageSize = 10;
  totalItems = 0;
  totalPages = 0;
  
  selectedStatus = '';
  selectedUrgency = '';
  selectedPracticeArea = '';
  selectedAssignedTo = '';
  
  sortBy = 'createdAt';
  sortDirection = 'desc';
  
  selectedLead: LeadDTO | null = null;
  showLeadModal = false;
  showPipelineModal = false;
  
  // Modal states
  showEditModal = false;
  showAssignModal = false;
  showScheduleModal = false;
  showConvertModal = false;
  isEditMode = false;
  
  // Forms
  editLeadForm: FormGroup;
  assignForm: FormGroup;
  scheduleForm: FormGroup;
  convertForm: FormGroup;
  
  // Data arrays
  availableAttorneys: User[] = [];
  conversionTypes = [
    { 
      value: 'CLIENT_ONLY', 
      label: 'Client Only', 
      description: 'Create client record with contact information only',
      icon: 'ri-user-line',
      color: '#17a2b8'
    },
    { 
      value: 'MATTER_ONLY', 
      label: 'Matter/Case Only', 
      description: 'Create legal case without full client profile',
      icon: 'ri-briefcase-line',
      color: '#ffc107'
    },
    { 
      value: 'CLIENT_AND_MATTER', 
      label: 'Client & Matter', 
      description: 'Complete conversion with both client and case records',
      icon: 'ri-group-line',
      color: '#28a745'
    }
  ];
  
  // Conversion wizard state
  selectedConversionType = '';
  conversionStep = 1; // 1: Type Selection, 2: Data Entry, 3: Review & Confirm
  maxSteps = 3;
  conversionInProgress = false;
  validationErrors: string[] = [];
  conflictCheckResult: any = null;
  requiredFields: any = null;
  
  // Flatpickr instances
  @ViewChild('consultationDatePicker', { static: false }) consultationDatePicker!: ElementRef;
  private flatpickrInstance: any;
  
  // Make Math available in template
  Math = Math;

  // Lead Status Transition Rules (matching backend)
  private readonly VALID_TRANSITIONS: { [key: string]: string[] } = {
    'NEW': ['CONTACTED', 'UNQUALIFIED', 'LOST'],
    'CONTACTED': ['QUALIFIED', 'UNQUALIFIED', 'LOST'],
    'QUALIFIED': ['CONSULTATION_SCHEDULED', 'UNQUALIFIED', 'LOST'],
    'CONSULTATION_SCHEDULED': ['PROPOSAL_SENT', 'QUALIFIED', 'UNQUALIFIED', 'LOST'],
    'PROPOSAL_SENT': ['NEGOTIATION', 'CONVERTED', 'LOST'],
    'NEGOTIATION': ['CONVERTED', 'PROPOSAL_SENT', 'LOST'],
    'CONVERTED': [], // Final state
    'LOST': [], // Final state
    'UNQUALIFIED': [] // Final state
  };
  
  constructor(
    private crmService: CrmService, 
    private userService: UserService,
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.initializeForms();
  }

  ngOnInit() {
    this.loadPipelineStages();
    this.loadPipelineSummary();
    this.loadLeads();
    this.loadAvailableAttorneys();
  }

  ngAfterViewInit() {
    // Initialize flatpickr when needed (in modal show method)
  }

  private initializeFlatpickr() {
    const datePickerElement = document.getElementById('consultationDatePicker');
    if (datePickerElement && !this.flatpickrInstance) {
      this.flatpickrInstance = flatpickr(datePickerElement, {
        enableTime: true,
        dateFormat: "Y-m-d H:i",
        minDate: "today",
        time_24hr: false,
        minuteIncrement: 15,
        defaultHour: 9,
        defaultMinute: 0,
        disable: [
          // Disable weekends
          function(date) {
            return (date.getDay() === 0 || date.getDay() === 6);
          }
        ],
        minTime: "08:00",
        maxTime: "18:00",
        onChange: (selectedDates, dateStr, instance) => {
          this.scheduleForm.patchValue({
            consultationDateTime: dateStr
          });
        },
        onOpen: function(selectedDates, dateStr, instance) {
          // Add custom styling
          const calendar = instance.calendarContainer;
          calendar.classList.add('crm-datepicker');
        }
      });
    }
  }

  // Business Logic Helper Methods
  canAssignLead(lead: LeadDTO): boolean {
    // Lead can be assigned if it's not in final states
    const finalStates = ['CONVERTED', 'LOST', 'UNQUALIFIED'];
    return !finalStates.includes(lead.status || '');
  }

  canScheduleConsultation(lead: LeadDTO): boolean {
    // Can schedule consultation if transitioning to CONSULTATION_SCHEDULED is valid
    const currentStatus = lead.status || 'NEW';
    return this.VALID_TRANSITIONS[currentStatus]?.includes('CONSULTATION_SCHEDULED') || false;
  }

  canConvertLead(lead: LeadDTO): boolean {
    // Can convert if transitioning to CONVERTED is valid
    const currentStatus = lead.status || 'NEW';
    return this.VALID_TRANSITIONS[currentStatus]?.includes('CONVERTED') || false;
  }

  canEditLead(lead: LeadDTO): boolean {
    // Can edit lead unless it's converted (but can edit lost/unqualified for notes)
    return lead.status !== 'CONVERTED';
  }

  getValidNextStatuses(currentStatus: string): string[] {
    return this.VALID_TRANSITIONS[currentStatus] || [];
  }

  getStatusDisplayName(status: string): string {
    const statusMap: { [key: string]: string } = {
      'NEW': 'New Lead',
      'CONTACTED': 'Contacted', 
      'QUALIFIED': 'Qualified',
      'CONSULTATION_SCHEDULED': 'Consultation Scheduled',
      'PROPOSAL_SENT': 'Proposal Sent',
      'NEGOTIATION': 'In Negotiation',
      'CONVERTED': 'Converted ✓',
      'LOST': 'Lost',
      'UNQUALIFIED': 'Unqualified'
    };
    return statusMap[status] || status;
  }

  getFormattedNextStatuses(currentStatus: string): string {
    const nextStatuses = this.getValidNextStatuses(currentStatus);
    return nextStatuses.map(status => this.getStatusDisplayName(status)).join(' • ');
  }

  initializeForms() {
    this.editLeadForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
      phone: ['', [Validators.pattern(/^[\+]?[1-9][\d]{0,15}$/)]],
      company: ['', [Validators.maxLength(100)]],
      practiceArea: ['', Validators.required],
      status: [''],
      estimatedValue: ['', [Validators.min(0), Validators.max(10000000)]],
      notes: ['', [Validators.maxLength(1000)]],
      contactPreference: [''],
      urgencyLevel: [''],
      initialInquiry: ['', [Validators.maxLength(2000)]],
      // Additional fields that were missing
      source: [''],
      leadScore: ['', [Validators.min(0), Validators.max(100)]]
    });

    this.assignForm = this.fb.group({
      assignedTo: ['', Validators.required],
      notes: ['', [Validators.maxLength(500)]]
    });

    this.scheduleForm = this.fb.group({
      consultationDateTime: ['', Validators.required],
      consultationType: ['INITIAL_CONSULTATION', Validators.required],
      notes: ['', [Validators.maxLength(500)]]
    });

    this.convertForm = this.fb.group({
      conversionType: ['', Validators.required],
      
      // Client Information
      clientFirstName: [''],
      clientLastName: [''],
      clientEmail: [''],
      clientPhone: [''],
      clientAddress: [''],
      clientCity: [''],
      clientState: [''],
      clientZip: [''],
      clientDateOfBirth: [''],
      clientSSN: [''],
      clientOccupation: [''],
      clientEmployer: [''],
      emergencyContact: [''],
      emergencyContactPhone: [''],
      
      // Case/Matter Information
      caseTitle: [''],
      caseDescription: [''],
      practiceArea: [''],
      jurisdiction: [''],
      courtName: [''],
      opposingParty: [''],
      opposingCounsel: [''],
      retainerAmount: [''],
      hourlyRate: [''],
      estimatedDuration: [''],
      urgencyLevel: [''],
      caseNotes: [''],
      expectedOutcome: [''],
      riskAssessment: [''],
      
      // Additional Information
      referralSource: [''],
      marketingCampaign: [''],
      leadSource: [''],
      conversionNotes: ['']
    });
  }

  loadAvailableAttorneys() {
    console.log('🔍 Loading available attorneys...');
    
    this.userService.getAttorneys().subscribe({
      next: (attorneys: User[]) => {
        console.log('✅ Attorneys loaded successfully:', attorneys);
        this.availableAttorneys = attorneys;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Error loading attorneys:', error);
        this.availableAttorneys = [];
        this.cdr.detectChanges();
      }
    });
  }

  loadLeads() {
    this.loading = true;
    this.cdr.detectChanges();
    
    const params = {
      page: 0,
      size: 1000,
      sortBy: this.sortBy,
      sortDir: this.sortDirection
    };
    
    console.log('🚀 Loading all leads for client-side pagination');
    
    this.crmService.getLeads(params).subscribe({
      next: (response: any) => {
        console.log('✅ Leads loaded successfully:', response);
        this.allLeads = response.content || [];
        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Error loading leads:', error);
        this.allLeads = [];
        this.filteredLeads = [];
        this.totalItems = 0;
        this.totalPages = 0;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilters() {
    this.filteredLeads = this.allLeads.filter(lead => {
      const matchesStatus = !this.selectedStatus || lead.status === this.selectedStatus;
      const matchesUrgency = !this.selectedUrgency || lead.urgencyLevel === this.selectedUrgency;
      const matchesPracticeArea = !this.selectedPracticeArea || lead.practiceArea === this.selectedPracticeArea;
      const matchesAssignedTo = !this.selectedAssignedTo || 
        (lead.assignedToName && lead.assignedToName.toLowerCase().includes(this.selectedAssignedTo.toLowerCase()));
      
      return matchesStatus && matchesUrgency && matchesPracticeArea && matchesAssignedTo;
    });
    
    this.totalItems = this.filteredLeads.length;
    this.totalPages = Math.ceil(this.totalItems / this.pageSize);
    this.currentPage = 0;
  }

  get paginatedLeads(): LeadDTO[] {
    const startIndex = this.currentPage * this.pageSize;
    return this.filteredLeads.slice(startIndex, startIndex + this.pageSize);
  }

  get hasPreviousPage(): boolean {
    return this.currentPage > 0;
  }

  get hasNextPage(): boolean {
    return this.currentPage < this.totalPages - 1;
  }

  get pageInfo(): string {
    const startIndex = this.currentPage * this.pageSize + 1;
    const endIndex = Math.min((this.currentPage + 1) * this.pageSize, this.totalItems);
    return `Showing ${startIndex} to ${endIndex} of ${this.totalItems} entries`;
  }

  loadPipelineStages() {
    this.crmService.getPipelineStages().subscribe({
      next: (stages: PipelineStage[]) => {
        this.pipelineStages = stages.sort((a, b) => a.stageOrder - b.stageOrder);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading pipeline stages:', error);
        this.pipelineStages = [];
        this.cdr.detectChanges();
      }
    });
  }

  loadPipelineSummary() {
    this.crmService.getPipelineSummary().subscribe({
      next: (summary: PipelineSummary) => {
        this.pipelineSummary = summary;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading pipeline summary:', error);
        this.pipelineSummary = null;
        this.cdr.detectChanges();
      }
    });
  }

  onPageChange(page: number) {
    this.currentPage = page;
  }

  previousPage() {
    if (this.hasPreviousPage) {
      this.currentPage--;
    }
  }

  nextPage() {
    if (this.hasNextPage) {
      this.currentPage++;
    }
  }

  onFilterChange() {
    this.applyFilters();
  }

  onSort(field: string) {
    if (this.sortBy === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = field;
      this.sortDirection = 'asc';
    }
    this.applySortingAndFilters();
  }

  applySortingAndFilters() {
    this.applyFilters();
    this.filteredLeads.sort((a, b) => {
      const aVal = (a as any)[this.sortBy];
      const bVal = (b as any)[this.sortBy];
      
      if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  clearFilters() {
    this.selectedStatus = '';
    this.selectedUrgency = '';
    this.selectedPracticeArea = '';
    this.selectedAssignedTo = '';
    this.applyFilters();
  }

  viewLead(lead: LeadDTO) {
    this.selectedLead = lead;
    this.showLeadModal = true;
  }

  showPipelineView() {
    this.showPipelineModal = true;
  }

  closePipelineModal() {
    this.showPipelineModal = false;
  }

  closeLeadModal() {
    this.showLeadModal = false;
    this.selectedLead = null;
  }

  getStatusBadgeClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'NEW': 'bg-primary text-white',
      'CONTACTED': 'bg-info text-white', 
      'QUALIFIED': 'bg-warning text-dark',
      'CONSULTATION_SCHEDULED': 'bg-success text-white',
      'PROPOSAL_SENT': 'bg-dark text-white',
      'PROPOSAL SENT': 'bg-dark text-white',
      'NEGOTIATION': 'bg-warning text-dark',
      'CONVERTED': 'bg-success text-white fw-bold',
      'LOST': 'bg-danger text-white',
      'UNQUALIFIED': 'bg-secondary text-white',
      'UNRESPONSIVE': 'bg-muted text-white'
    };
    return statusClasses[status] || 'bg-light text-dark';
  }

  getUrgencyBadgeClass(urgency?: string): string {
    if (!urgency) return 'bg-light text-dark';
    
    switch (urgency) {
      case 'LOW': return 'bg-success-subtle text-success';
      case 'MEDIUM': return 'bg-warning-subtle text-warning';
      case 'HIGH': return 'bg-danger-subtle text-danger';
      case 'URGENT': return 'bg-danger text-white priority-urgent-pulse';
      default: return 'bg-light text-dark';
    }
  }

  getLeadCountForStage(stageName: string): number {
    // Map pipeline stage names to actual status values  
    const stageToStatusMap: { [key: string]: string } = {
      'New Lead': 'NEW',
      'Initial Contact': 'CONTACTED', 
      'Qualification': 'QUALIFIED',
      'Consultation': 'CONSULTATION_SCHEDULED',
      'Proposal': 'PROPOSAL_SENT',
      'Negotiation': 'NEGOTIATION', 
      'Won': 'CONVERTED',
      'Lost': 'LOST'
    };
    
    const statusKey = stageToStatusMap[stageName] || stageName;
    return this.pipelineSummary?.statusCounts[statusKey] || 0;
  }

  getLeadsForStage(stageName: string): LeadDTO[] {
    // Map pipeline stage names to actual status values
    const stageToStatusMap: { [key: string]: string } = {
      'New Lead': 'NEW',
      'Initial Contact': 'CONTACTED', 
      'Qualification': 'QUALIFIED',
      'Consultation': 'CONSULTATION_SCHEDULED',
      'Proposal': 'PROPOSAL_SENT',
      'Negotiation': 'NEGOTIATION', 
      'Won': 'CONVERTED',
      'Lost': 'LOST'
    };
    
    const statusKey = stageToStatusMap[stageName] || stageName;
    return this.filteredLeads.filter(lead => lead.status === statusKey);
  }

  getUrgencyDisplayName(urgency: string): string {
    if (!urgency) return 'No Urgency';
    return urgency.charAt(0) + urgency.slice(1).toLowerCase();
  }

  getSelectedConversionTypeLabel(): string {
    return this.conversionTypes.find(t => t.value === this.selectedConversionType)?.label || '';
  }

  formatCurrency(value: number): string {
    return value ? new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value) : '-';
  }

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  }

  formatDateTime(dateString: string): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    const startPage = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    const endPage = Math.min(this.totalPages, startPage + maxVisible - 1);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }

  onMoveToStage(leadId: number, stageId: number, notes: string = '') {
    this.crmService.moveLeadToStage(leadId, stageId, notes).subscribe({
      next: () => {
        this.loadLeads();
        this.loadPipelineSummary();
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error moving lead to stage:', error);
        this.cdr.detectChanges();
      }
    });
  }

  onAssignLead(leadId: number, assignToUserId: number, notes: string = '') {
    this.crmService.assignLead(leadId, assignToUserId, notes).subscribe({
      next: () => {
        this.loadLeads();
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error assigning lead:', error);
        this.cdr.detectChanges();
      }
    });
  }

  editLead(lead: LeadDTO) {
    this.selectedLead = lead;
    this.isEditMode = true;
    
    // Populate form with ALL lead data to prevent field clearing
    this.editLeadForm.patchValue({
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      email: lead.email || '',
      phone: lead.phone || '',
      company: lead.company || '',
      practiceArea: lead.practiceArea || '',
      status: lead.status || '',
      estimatedValue: lead.estimatedValue || '',
      notes: lead.notes || '',
      contactPreference: lead.contactPreference || '',
      urgencyLevel: lead.urgencyLevel || '',
      initialInquiry: lead.initialInquiry || '',
      // Additional fields
      source: lead.source || '',
      leadScore: lead.leadScore || 0
    });
    
    this.showEditModal = true;
  }

  assignLead(lead: LeadDTO) {
    // Validate that assignment is allowed
    if (!this.canAssignLead(lead)) {
      Swal.fire({
        title: 'Cannot Assign Lead',
        text: `Lead is in final status "${this.getStatusDisplayName(lead.status || 'NEW')}" and cannot be assigned.`,
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }

    this.selectedLead = lead;
    this.assignForm.reset();
    this.showAssignModal = true;
  }

  scheduleCall(lead: LeadDTO) {
    // Validate that scheduling consultation is allowed
    if (!this.canScheduleConsultation(lead)) {
      Swal.fire({
        title: 'Cannot Schedule Consultation',
        text: `Lead must be in "QUALIFIED" status to schedule a consultation. Current status: ${this.getStatusDisplayName(lead.status || 'NEW')}`,
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }

    this.selectedLead = lead;
    this.scheduleForm.reset();
    this.scheduleForm.patchValue({
      consultationType: 'INITIAL_CONSULTATION'
    });
    this.showScheduleModal = true;
    
    // Initialize flatpickr after modal is shown
    setTimeout(() => {
      this.initializeFlatpickr();
    }, 100);
  }

  convertLead(lead: LeadDTO) {
    // Validate that conversion is allowed
    if (!this.canConvertLead(lead)) {
      const validNextStatuses = this.getValidNextStatuses(lead.status || 'NEW');
      let message = `Lead cannot be converted from "${this.getStatusDisplayName(lead.status || 'NEW')}" status.`;
      
      if (validNextStatuses.length > 0) {
        message += ` Valid next steps: ${validNextStatuses.map(s => this.getStatusDisplayName(s)).join(', ')}`;
      }
      
      Swal.fire({
        title: 'Cannot Convert Lead',
        text: message,
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }

    // Initialize conversion wizard
    this.selectedLead = lead;
    this.resetConversionWizard();
    this.showConvertModal = true;
    
    // Skip initial eligibility check to avoid redundancy
    // Conflict check will be performed when user moves to step 3 with selected conversion type
    this.conversionStep = 1;
  }

  private resetConversionWizard() {
    this.selectedConversionType = '';
    this.conversionStep = 1;
    this.conversionInProgress = false;
    this.validationErrors = [];
    this.conflictCheckResult = null;
    this.requiredFields = null;
    this.convertForm.reset();
    this.convertForm.patchValue({ conversionType: '' });
  }


  private performPreConversionChecks(lead: LeadDTO) {
    // Show loading state
    Swal.fire({
      title: 'Checking Lead Eligibility...',
      text: 'Please wait while we validate the lead for conversion',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    // Check if lead can be converted
    this.crmService.canConvertLead(lead.id, 'CLIENT_AND_MATTER').subscribe({
      next: (canConvertResponse) => {
        if (canConvertResponse.canConvert) {
          Swal.close();
          this.showConvertModal = true;
        } else {
          let errorMessage = 'This lead cannot be converted at this time.';
          if (canConvertResponse.hasConflicts) {
            errorMessage += ' There are unresolved conflicts that must be addressed first.';
          }
          
          Swal.fire({
            title: 'Conversion Not Available',
            text: errorMessage,
            icon: 'warning',
            confirmButtonText: 'OK'
          });
        }
      },
      error: (error) => {
        console.error('Error checking conversion eligibility:', error);
        Swal.fire({
          title: 'Error',
          text: 'Unable to check conversion eligibility. Please try again.',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    });
  }

  // Modal close methods
  closeEditModal() {
    this.showEditModal = false;
    this.isEditMode = false;
    this.selectedLead = null;
    this.editLeadForm.reset();
  }

  closeAssignModal() {
    this.showAssignModal = false;
    this.selectedLead = null;
    this.assignForm.reset();
  }

  closeScheduleModal() {
    this.showScheduleModal = false;
    this.selectedLead = null;
    this.scheduleForm.reset();
    
    // Destroy flatpickr instance
    if (this.flatpickrInstance) {
      this.flatpickrInstance.destroy();
      this.flatpickrInstance = null;
    }
  }

  closeConvertModal() {
    this.showConvertModal = false;
    this.selectedLead = null;
    this.resetConversionWizard();
  }

  // Helper methods for formatting conflict messages
  public formatConflictTypeForDisplay(type: string): string {
    if (!type) return 'Conflict';
    
    // Convert technical types to user-friendly labels
    switch (type.toUpperCase()) {
      case 'CONVERSION_CLIENT_ONLY':
        return 'Client Conversion Issue';
      case 'CONVERSION_MATTER_ONLY':
        return 'Matter Conversion Issue';
      case 'CONVERSION_CLIENT_AND_MATTER':
        return 'Client & Matter Conversion Issue';
      case 'POTENTIAL_CONFLICT':
        return 'Potential Conflict';
      case 'CLIENT_NAME':
        return 'Client Name Issue';
      case 'EMAIL_CONFLICT':
        return 'Email Address Issue';
      default:
        return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  }

  public formatConflictDescription(description: string): string {
    if (!description) return 'A conflict has been detected.';

    // Check if description is raw JSON from backend
    if (description.includes('"conflicts"') && description.includes('"status"')) {
      try {
        const parsed = JSON.parse(description);
        if (parsed.conflicts && Array.isArray(parsed.conflicts)) {
          return this.formatConflictDetailsFromJson(parsed.conflicts);
        }
      } catch (e) {
        // Continue with string processing if JSON parsing fails
      }
    }

    // Format technical messages to be user-friendly
    let formatted = description;

    // Handle client name conflicts
    if (formatted.includes('Client with name') && formatted.includes('already exists')) {
      const nameMatch = formatted.match(/Client with name '([^']+)' already exists \(ID: (\d+)\)/);
      if (nameMatch) {
        const [, clientName, clientId] = nameMatch;
        formatted = `A client named "${clientName}" already exists in your system (Client ID: ${clientId}). This may be the same person or a different client with the same name.`;
      }
    }

    // Handle email conflicts
    if (formatted.includes('Client with email') && formatted.includes('already exists')) {
      const emailMatch = formatted.match(/Client with email ([^\s]+) already exists/);
      if (emailMatch) {
        const [, email] = emailMatch;
        formatted = `The email address "${email}" is already associated with an existing client in your system.`;
      }
    }

    return formatted;
  }

  private formatConflictDetailsFromJson(conflicts: string[]): string {
    if (!conflicts || conflicts.length === 0) {
      return 'A conflict has been detected.';
    }

    const formattedConflicts = conflicts.map(conflict => this.formatConflictDescription(conflict));
    
    if (formattedConflicts.length === 1) {
      return formattedConflicts[0];
    } else {
      return formattedConflicts.map((conflict, index) => `${index + 1}. ${conflict}`).join('<br>');
    }
  }

  private buildFullAddress(formData: any): string {
    const addressParts = [
      formData.clientAddress,
      formData.clientCity,
      formData.clientState,
      formData.clientZip
    ].filter(part => part && part.toString().trim() !== '');
    
    return addressParts.join(', ');
  }

  private generateConflictResolutionSuggestion(conflict: any): string {
    const type = conflict.type?.toUpperCase() || '';
    const description = conflict.description || '';

    if (type.includes('CLIENT') && description.includes('already exists')) {
      if (description.includes('name')) {
        return `<div class="alert alert-info py-2 px-3 mt-2 mb-0">
          <strong><i class="ri-lightbulb-line me-1"></i>Suggestion:</strong> 
          Verify if this is the same person. If so, you may want to update the existing client record instead of creating a new one. 
          If it's a different person with the same name, consider adding distinguishing information like middle initial or suffix.
        </div>`;
      } else if (description.includes('email')) {
        return `<div class="alert alert-info py-2 px-3 mt-2 mb-0">
          <strong><i class="ri-lightbulb-line me-1"></i>Suggestion:</strong> 
          Check with the existing client to confirm this is their correct email address, or use a different email address if this is a different person.
        </div>`;
      }
    }

    if (type.includes('MATTER')) {
      return `<div class="alert alert-info py-2 px-3 mt-2 mb-0">
        <strong><i class="ri-lightbulb-line me-1"></i>Suggestion:</strong> 
        Review the existing matter to determine if this lead relates to the same legal issue or if it's a new, separate matter.
      </div>`;
    }

    return `<div class="alert alert-info py-2 px-3 mt-2 mb-0">
      <strong><i class="ri-lightbulb-line me-1"></i>Suggestion:</strong> 
      Please review the existing records and resolve this conflict before proceeding with the conversion.
    </div>`;
  }


  private deduplicateConflicts(conflicts: any[]): any[] {
    if (!conflicts || conflicts.length === 0) {
      return conflicts;
    }

    // Parse JSON descriptions and extract individual conflict messages
    const individualConflicts: string[] = [];
    const conflictMeta = conflicts.length > 0 ? conflicts[0] : {};
    
    conflicts.forEach(conflict => {
      try {
        // Try to parse the description as JSON
        const parsed = JSON.parse(conflict.description);
        if (parsed.conflicts && Array.isArray(parsed.conflicts)) {
          // Extract individual conflict messages
          parsed.conflicts.forEach((msg: string) => {
            if (!individualConflicts.includes(msg)) {
              individualConflicts.push(msg);
            }
          });
        }
      } catch (e) {
        // If not JSON, treat as simple string and deduplicate
        if (!individualConflicts.includes(conflict.description)) {
          individualConflicts.push(conflict.description);
        }
      }
    });

    // Return a single combined conflict with unique messages
    if (individualConflicts.length > 0) {
      return [{
        type: conflictMeta.type || 'CLIENT_CONFLICT',
        description: individualConflicts.join(' AND '),
        severity: conflictMeta.severity || 'WARNING',
        checkedAt: conflictMeta.checkedAt,
        status: conflictMeta.status
      }];
    }

    return conflicts;
  }

  private filterConflictsByConversionType(conflicts: any[], conversionType: string): any[] {
    if (!conflicts || conflicts.length === 0) {
      return conflicts;
    }

    // Filter conflicts to only show those relevant to the selected conversion type
    const filtered = conflicts.filter(conflict => {
      const conflictType = conflict.type?.toUpperCase() || '';
      const selectedType = conversionType?.toUpperCase() || '';

      // Show all conflicts that involve the selected conversion type or are general
      // For CLIENT_ONLY: show conflicts that involve client creation
      if (selectedType === 'CLIENT_ONLY') {
        return conflictType.includes('CLIENT') || 
               conflictType === 'POTENTIAL_CONFLICT' ||
               conflictType.includes('CONVERSION_CLIENT_ONLY');
      }

      // For MATTER_ONLY: show conflicts that involve matter/case creation
      if (selectedType === 'MATTER_ONLY') {
        return conflictType.includes('MATTER') || 
               conflictType === 'POTENTIAL_CONFLICT' ||
               conflictType.includes('CONVERSION_MATTER_ONLY');
      }

      // For CLIENT_AND_MATTER: show conflicts that involve either client or matter creation
      if (selectedType === 'CLIENT_AND_MATTER') {
        return conflictType.includes('CLIENT') ||
               conflictType.includes('MATTER') || 
               conflictType === 'POTENTIAL_CONFLICT' ||
               conflictType.includes('CONVERSION_CLIENT_AND_MATTER');
      }

      // Default: show all conflicts if we can't determine the type
      return true;
    });
    
    // Deduplicate conflicts with identical descriptions
    const deduplicatedConflicts = this.deduplicateConflicts(filtered);
    
    return deduplicatedConflicts;
  }

  // Wizard Navigation Methods
  canGoToNextStep(): boolean {
    switch (this.conversionStep) {
      case 1:
        return !!this.selectedConversionType;
      case 2:
        return this.validateCurrentStepFields();
      case 3:
        return false; // Step 3 is final review, no "next" from here
      default:
        return false;
    }
  }

  canGoToPreviousStep(): boolean {
    return this.conversionStep > 1;
  }

  nextStep() {
    if (!this.canGoToNextStep()) return;
    
    if (this.conversionStep === 1) {
      // Moving from step 1 (type selection) to step 2 (data entry)
      this.loadRequiredFields();
      this.prepopulateFormData();
      this.conversionStep = 2;
    } else if (this.conversionStep === 2) {
      // Moving from step 2 (data entry) to step 3 (review)
      // Don't increment step here - let conflict check handle it
      this.performConflictCheck();
    }
  }

  previousStep() {
    if (this.canGoToPreviousStep() && this.conversionStep > 1) {
      this.conversionStep--;
      this.validationErrors = [];
    }
  }

  getStepTitle(): string {
    switch (this.conversionStep) {
      case 1:
        return 'Select Conversion Type';
      case 2:
        return 'Enter Information';
      case 3:
        return 'Review & Confirm';
      default:
        return 'Convert Lead';
    }
  }

  getStepDescription(): string {
    switch (this.conversionStep) {
      case 1:
        return 'Choose how you want to convert this lead';
      case 2:
        return 'Provide the necessary information for conversion';
      case 3:
        return 'Review all information before finalizing the conversion';
      default:
        return '';
    }
  }

  // Save methods
  saveEditLead() {
    if (this.editLeadForm.valid && this.selectedLead) {
      const formData = this.editLeadForm.value;
      
      // Preserve fields not in the form by merging with existing lead data
      const updateData = {
        ...this.selectedLead, // Start with existing lead data
        ...formData, // Override with form data
        // Ensure these critical fields are preserved
        id: this.selectedLead.id,
        fullName: `${formData.firstName} ${formData.lastName}`,
        createdAt: this.selectedLead.createdAt,
        assignedTo: this.selectedLead.assignedTo,
        assignedToName: this.selectedLead.assignedToName,
        consultationDate: this.selectedLead.consultationDate,
        followUpDate: this.selectedLead.followUpDate,
        qualified: this.selectedLead.qualified,
        contacted: this.selectedLead.contacted,
        lastContactDate: this.selectedLead.lastContactDate,
        contactAttempts: this.selectedLead.contactAttempts,
        conversionStatus: this.selectedLead.conversionStatus
      };
      
      // Show loading state
      Swal.fire({
        title: 'Updating Lead...',
        text: 'Please wait while we save your changes',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });
      
      this.crmService.updateLead(this.selectedLead.id, updateData).subscribe({
        next: (response) => {
          Swal.fire({
            title: 'Success!',
            text: 'Lead updated successfully',
            icon: 'success',
            timer: 3000,
            showConfirmButton: false
          });
          this.closeEditModal();
          this.loadLeads();
        },
        error: (error) => {
          console.error('Error updating lead:', error);
          let errorMessage = 'Failed to update lead';
          
          if (error.status === 400 && error.error?.message) {
            errorMessage = error.error.message;
          } else if (error.status === 404) {
            errorMessage = 'Lead not found';
          } else if (error.status === 422 && error.error?.errors) {
            const validationErrors = Object.values(error.error.errors).join(', ');
            errorMessage = `Validation errors: ${validationErrors}`;
          }
          
          Swal.fire({
            title: 'Error!',
            text: errorMessage,
            icon: 'error',
            confirmButtonText: 'Try Again'
          });
        }
      });
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.editLeadForm.controls).forEach(key => {
        this.editLeadForm.get(key)?.markAsTouched();
      });
      
      Swal.fire({
        title: 'Validation Error',
        text: 'Please fix the errors in the form before saving',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
    }
  }


  submitAssignment() {
    if (this.assignForm.valid && this.selectedLead) {
      const { assignedTo, notes } = this.assignForm.value;
      const selectedAttorney = this.availableAttorneys.find(a => a.id === Number(assignedTo));
      
      // Show confirmation dialog
      Swal.fire({
        title: 'Confirm Assignment',
        text: `Assign lead "${this.selectedLead.fullName}" to ${selectedAttorney?.firstName} ${selectedAttorney?.lastName}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, assign it!',
        cancelButtonText: 'Cancel'
      }).then((result) => {
        if (result.isConfirmed && this.selectedLead) {
          // Show loading state
          Swal.fire({
            title: 'Assigning Lead...',
            text: 'Please wait while we assign the lead',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => {
              Swal.showLoading();
            }
          });
          
          this.crmService.assignLead(this.selectedLead.id, assignedTo, notes).subscribe({
            next: (response) => {
              Swal.fire({
                title: 'Success!',
                text: `Lead assigned to ${selectedAttorney?.firstName} ${selectedAttorney?.lastName} successfully`,
                icon: 'success',
                timer: 3000,
                showConfirmButton: false
              });
              this.closeAssignModal();
              this.loadLeads();
            },
            error: (error) => {
              console.error('Error assigning lead:', error);
              let errorMessage = 'Failed to assign lead';
              
              if (error.status === 404) {
                errorMessage = 'Lead or attorney not found';
              } else if (error.status === 400 && error.error?.message) {
                errorMessage = error.error.message;
              }
              
              Swal.fire({
                title: 'Error!',
                text: errorMessage,
                icon: 'error',
                confirmButtonText: 'Try Again'
              });
            }
          });
        }
      });
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.assignForm.controls).forEach(key => {
        this.assignForm.get(key)?.markAsTouched();
      });
      
      Swal.fire({
        title: 'Validation Error',
        text: 'Please select an attorney to assign the lead to',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
    }
  }

  submitSchedule() {
    if (this.scheduleForm.valid && this.selectedLead) {
      const { consultationDateTime, consultationType, notes } = this.scheduleForm.value;
      
      // Show confirmation dialog
      const scheduledDate = new Date(consultationDateTime);
      const formattedDate = scheduledDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const formattedTime = scheduledDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      Swal.fire({
        title: 'Confirm Consultation',
        html: `
          <div class="text-left">
            <p><strong>Client:</strong> ${this.selectedLead.fullName}</p>
            <p><strong>Type:</strong> ${consultationType.replace('_', ' ')}</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Time:</strong> ${formattedTime}</p>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, schedule it!',
        cancelButtonText: 'Cancel'
      }).then((result) => {
        if (result.isConfirmed && this.selectedLead) {
          // Show loading state
          Swal.fire({
            title: 'Scheduling Consultation...',
            text: 'Please wait while we schedule your consultation',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => {
              Swal.showLoading();
            }
          });
          
          this.crmService.scheduleConsultation(this.selectedLead.id, consultationDateTime, notes).subscribe({
            next: (response) => {
              Swal.fire({
                title: 'Success!',
                text: `Consultation scheduled for ${formattedDate} at ${formattedTime}`,
                icon: 'success',
                timer: 3000,
                showConfirmButton: false
              });
              this.closeScheduleModal();
              this.loadLeads();
            },
            error: (error) => {
              console.error('Error scheduling consultation:', error);
              let errorMessage = 'Failed to schedule consultation';
              
              if (error.status === 400 && error.error?.message) {
                errorMessage = error.error.message;
              } else if (error.status === 409) {
                errorMessage = 'Time slot is already booked. Please choose a different time.';
              }
              
              Swal.fire({
                title: 'Error!',
                text: errorMessage,
                icon: 'error',
                confirmButtonText: 'Try Again'
              });
            }
          });
        }
      });
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.scheduleForm.controls).forEach(key => {
        this.scheduleForm.get(key)?.markAsTouched();
      });
      
      Swal.fire({
        title: 'Validation Error',
        text: 'Please select a date and time for the consultation',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
    }
  }

  onConversionTypeChange(type: string) {
    this.selectedConversionType = type;
    this.convertForm.patchValue({ conversionType: type });
    
    if (!type) return;
    
    // Reset validation errors
    this.validationErrors = [];
  }

  private loadRequiredFields() {
    if (!this.selectedLead || !this.selectedConversionType) return;
    
    this.crmService.getRequiredConversionFields(this.selectedLead.id, this.selectedConversionType).subscribe({
      next: (response) => {
        this.requiredFields = response;
        this.setFieldValidators();
      },
      error: (error) => {
        console.error('Error loading required fields:', error);
        // Set default required fields if API fails
        this.setDefaultFieldValidators();
      }
    });
  }

  private setFieldValidators() {
    // Clear all validators first
    Object.keys(this.convertForm.controls).forEach(key => {
      if (key !== 'conversionType') {
        this.convertForm.get(key)?.clearValidators();
        this.convertForm.get(key)?.updateValueAndValidity();
      }
    });
    
    // Set validators based on conversion type and required fields
    if (this.selectedConversionType === 'CLIENT_ONLY' || this.selectedConversionType === 'CLIENT_AND_MATTER') {
      // Client required fields
      const clientRequiredFields = [
        'clientFirstName', 'clientLastName', 'clientEmail', 'clientPhone', 'clientType'
      ];
      
      clientRequiredFields.forEach(field => {
        if (field === 'clientEmail') {
          this.convertForm.get(field)?.setValidators([Validators.required, Validators.email]);
        } else {
          this.convertForm.get(field)?.setValidators([Validators.required]);
        }
        this.convertForm.get(field)?.updateValueAndValidity();
      });
    }
    
    if (this.selectedConversionType === 'MATTER_ONLY' || this.selectedConversionType === 'CLIENT_AND_MATTER') {
      // Case required fields
      const caseRequiredFields = [
        'caseTitle', 'caseDescription', 'practiceArea'
      ];
      
      caseRequiredFields.forEach(field => {
        this.convertForm.get(field)?.setValidators([Validators.required]);
        this.convertForm.get(field)?.updateValueAndValidity();
      });
    }
  }

  private setDefaultFieldValidators() {
    // Fallback validation setup if API fails
    this.setFieldValidators();
  }

  private prepopulateFormData() {
    if (!this.selectedLead) return;
    
    // Pre-populate client data
    if (this.selectedConversionType === 'CLIENT_ONLY' || this.selectedConversionType === 'CLIENT_AND_MATTER') {
      this.convertForm.patchValue({
        clientFirstName: this.selectedLead.firstName || '',
        clientLastName: this.selectedLead.lastName || '',
        clientEmail: this.selectedLead.email || '',
        clientPhone: this.selectedLead.phone || '',
        clientAddress: '', // Not available in lead data
        emergencyContact: '',
        emergencyContactPhone: ''
      });
    }
    
    // Pre-populate case data
    if (this.selectedConversionType === 'MATTER_ONLY' || this.selectedConversionType === 'CLIENT_AND_MATTER') {
      const practiceAreaFormatted = this.selectedLead.practiceArea?.replace('_', ' ') || '';
      this.convertForm.patchValue({
        caseTitle: `${practiceAreaFormatted} Matter - ${this.selectedLead.fullName || 'New Case'}`,
        caseDescription: this.selectedLead.initialInquiry || '',
        practiceArea: this.selectedLead.practiceArea || '',
        retainerAmount: this.selectedLead.estimatedValue || '',
        urgencyLevel: this.selectedLead.urgencyLevel || 'MEDIUM',
        referralSource: this.selectedLead.source || '',
        leadSource: this.selectedLead.source || ''
      });
    }
    
    // Common fields
    this.convertForm.patchValue({
      conversionNotes: `Converted from lead #${this.selectedLead.id} - ${this.selectedLead.fullName}`
    });
  }

  private validateCurrentStepFields(): boolean {
    this.validationErrors = [];
    
    if (this.conversionStep !== 2) return true;
    
    const relevantFields = this.getRelevantFieldsForValidation();
    let isValid = true;
    
    relevantFields.forEach(field => {
      const control = this.convertForm.get(field);
      if (control && control.invalid) {
        isValid = false;
        if (control.errors?.['required']) {
          this.validationErrors.push(`${this.getFieldDisplayName(field)} is required`);
        }
        if (control.errors?.['email']) {
          this.validationErrors.push(`${this.getFieldDisplayName(field)} must be a valid email`);
        }
      }
    });
    
    return isValid;
  }

  private getRelevantFieldsForValidation(): string[] {
    const fields: string[] = [];
    
    if (this.selectedConversionType === 'CLIENT_ONLY' || this.selectedConversionType === 'CLIENT_AND_MATTER') {
      fields.push('clientFirstName', 'clientLastName', 'clientEmail', 'clientPhone', 'clientType');
    }
    
    if (this.selectedConversionType === 'MATTER_ONLY' || this.selectedConversionType === 'CLIENT_AND_MATTER') {
      fields.push('caseTitle', 'caseDescription', 'practiceArea');
    }
    
    return fields;
  }

  private getFieldDisplayName(fieldName: string): string {
    const displayNames: { [key: string]: string } = {
      clientFirstName: 'Client First Name',
      clientLastName: 'Client Last Name',
      clientEmail: 'Client Email',
      clientPhone: 'Client Phone',
      clientAddress: 'Client Address',
      caseTitle: 'Case Title',
      caseDescription: 'Case Description',
      practiceArea: 'Practice Area',
      retainerAmount: 'Retainer Amount',
      hourlyRate: 'Hourly Rate'
    };
    return displayNames[fieldName] || fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  }

  private performConflictCheck() {
    if (!this.selectedLead || !this.selectedConversionType) return;
    
    Swal.fire({
      title: 'Checking for Conflicts...',
      html: `
        <div class="conflict-check-progress">
          <div class="spinner-border text-primary mb-3" role="status">
            <span class="sr-only">Loading...</span>
          </div>
          <p>Scanning for potential conflicts...</p>
          <div class="progress mt-3">
            <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: 100%"></div>
          </div>
        </div>
      `,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        // Don't show default loading, we have custom progress
      }
    });
    
    // First check if lead can be converted (this calls the backend canConvert check)
    this.crmService.canConvertLead(this.selectedLead.id, this.selectedConversionType).subscribe({
      next: (canConvertResponse) => {
        if (canConvertResponse.hasConflicts || !canConvertResponse.canConvert) {
          // Backend found conflicts through the eligibility check
          // Filter conflicts to only show those relevant to the selected conversion type
          const allConflicts = canConvertResponse.conflicts || [
            {
              type: 'POTENTIAL_CONFLICT',
              description: canConvertResponse.reason || 'Potential conflict detected during conversion check',
              severity: 'WARNING'
            }
          ];
          
          const relevantConflicts = this.filterConflictsByConversionType(allConflicts, this.selectedConversionType);
          const deduplicatedConflicts = this.deduplicateConflicts(relevantConflicts);
          
          this.conflictCheckResult = {
            hasConflicts: deduplicatedConflicts.length > 0,
            conflicts: deduplicatedConflicts,
            reason: canConvertResponse.reason
          };
          Swal.close();
          this.showConflictResults(this.conflictCheckResult);
        } else {
          // No conflicts found, proceed to step 3
          this.conflictCheckResult = {
            hasConflicts: false,
            conflicts: [],
            message: 'No conflicts detected. Safe to proceed.'
          };
          Swal.close();
          this.showNoConflictsFound();
        }
      },
      error: (error) => {
        console.error('Conflict check failed:', error);
        console.error('Error details:', {
          status: error.status,
          statusText: error.statusText,
          error: error.error
        });
        
        // Show more specific error message based on status
        let errorMessage = 'Unable to complete conflict check. You may proceed with caution or cancel the conversion.';
        
        if (error.status === 404) {
          errorMessage = 'Conflict check service not available. You may proceed with caution.';
        } else if (error.status === 500) {
          errorMessage = 'Server error during conflict check. You may proceed with caution.';
        } else if (error.error?.message) {
          errorMessage = `Conflict check error: ${error.error.message}`;
        }
        
        Swal.fire({
          title: 'Conflict Check Failed',
          text: errorMessage,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Proceed Anyway',
          cancelButtonText: 'Cancel Conversion'
        }).then((result) => {
          if (result.isConfirmed) {
            this.conflictCheckResult = { 
              hasConflicts: false, 
              conflicts: [], 
              warning: 'Conflict check failed - proceeded with caution',
              checkFailed: true
            };
            this.conversionStep = 3;
          } else {
            this.closeConvertModal();
          }
        });
      }
    });
  }

  private showConflictResults(conflictResult: any) {
    const conflictsHtml = conflictResult.conflicts.map((conflict: any) => {
      const formattedType = this.formatConflictTypeForDisplay(conflict.type);
      const formattedDescription = this.formatConflictDescription(conflict.description);
      return `<li class="text-danger"><i class="ri-error-warning-line me-2"></i><strong>${formattedType}:</strong> ${formattedDescription}</li>`;
    }).join('');
    
    Swal.fire({
      title: '⚠️ Conflicts Detected',
      html: `
        <div class="text-left">
          <p class="mb-3">The following conflicts were found:</p>
          <ul class="list-unstyled">
            ${conflictsHtml}
          </ul>
          <p class="mt-3 text-muted small">
            <i class="ri-information-line me-1"></i>
            These conflicts must be resolved before proceeding with the conversion.
          </p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Review Conflicts',
      cancelButtonText: 'Cancel Conversion',
      confirmButtonColor: '#ffc107',
      cancelButtonColor: '#dc3545'
    }).then((result) => {
      if (result.isConfirmed) {
        // For now, just show conflict details - in a real app, navigate to conflict resolution
        this.showDetailedConflictView(conflictResult);
      } else {
        this.closeConvertModal();
      }
    });
  }

  private showDetailedConflictView(conflictResult: any) {
    // This would typically navigate to a conflict resolution page
    // For now, we'll just show details and allow override (dangerous in production)
    
    // Ensure conflicts are filtered by conversion type (in case they weren't filtered before)
    const relevantConflicts = this.filterConflictsByConversionType(conflictResult.conflicts, this.selectedConversionType);
    
    const detailsHtml = relevantConflicts.map((conflict: any, index: number) => {
      const formattedType = this.formatConflictTypeForDisplay(conflict.type);
      const formattedDescription = this.formatConflictDescription(conflict.description);
      const resolutionSuggestion = this.generateConflictResolutionSuggestion(conflict);
      return `
      <div class="card mb-3 border-warning">
        <div class="card-header bg-warning-subtle border-warning py-2">
          <i class="ri-alert-line me-2"></i><strong>Conflict ${index + 1}: ${formattedType}</strong>
        </div>
        <div class="card-body py-2">
          <p class="mb-2">${formattedDescription}</p>
          ${resolutionSuggestion}
        </div>
      </div>
      `;
    }).join('');
    
    Swal.fire({
      title: 'Conflict Details',
      html: `
        <div class="text-left" style="max-height: 400px; overflow-y: auto;">
          ${detailsHtml}
          <div class="alert alert-warning mt-3">
            <i class="ri-alert-line me-1"></i>
            <strong>Administrator Override:</strong> You can proceed anyway, but this is not recommended without resolving conflicts.
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '⚠️ Proceed Anyway',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      width: '600px'
    }).then((result) => {
      if (result.isConfirmed) {
        this.conflictCheckResult.proceedDespiteConflicts = true;
        this.conversionStep = 3;
      } else {
        this.closeConvertModal();
      }
    });
  }

  private showNoConflictsFound() {
    Swal.fire({
      title: '✅ No Conflicts Found',
      text: 'Great! No conflicts were detected. You can proceed with the conversion.',
      icon: 'success',
      confirmButtonText: 'Continue to Review',
      timer: 3000,
      showConfirmButton: true,
      timerProgressBar: true
    }).then(() => {
      this.conversionStep = 3;
    });
  }

  private loadRequiredConversionFields(conversionType: string) {
    if (!this.selectedLead) return;
    
    this.crmService.getRequiredConversionFields(this.selectedLead.id, conversionType).subscribe({
      next: (fieldsResponse) => {
        console.log('Required fields for conversion:', fieldsResponse);
        // This can be used to dynamically show/hide fields or add additional validation
      },
      error: (error) => {
        console.error('Error loading required conversion fields:', error);
      }
    });
  }

  submitConversion() {
    if (this.conversionStep !== 3) {
      console.error('Submit conversion called but not on review step');
      return;
    }

    if (!this.selectedLead || !this.selectedConversionType) {
      Swal.fire({
        title: 'Validation Error',
        text: 'Please complete all required fields before proceeding.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }

    // Remove redundant confirmation dialog and execute conversion directly
    const formData = this.convertForm.value;
    this.executeConversion(formData);
  }


  private executeConversion(formData: any) {
    if (!this.selectedLead || !this.selectedConversionType) return;
    
    // Show progress
    Swal.fire({
      title: 'Converting Lead...',
      html: `
        <div class="conversion-progress">
          <div class="spinner-border text-success mb-3" role="status"></div>
          <p>Creating ${this.conversionTypes.find(t => t.value === this.selectedConversionType)?.label?.toLowerCase() || 'records'}...</p>
          <div class="progress mt-3">
            <div class="progress-bar bg-success progress-bar-striped progress-bar-animated" style="width: 100%"></div>
          </div>
        </div>
      `,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false
    });

    let conversionCall;
    
    switch (this.selectedConversionType) {
      case 'CLIENT_ONLY':
        // Transform frontend form data to backend expected format
        const clientData = {
          name: `${formData.clientFirstName || ''} ${formData.clientLastName || ''}`.trim(),
          email: formData.clientEmail,
          phone: formData.clientPhone,
          address: this.buildFullAddress(formData),
          type: formData.clientType || 'INDIVIDUAL',
          status: 'ACTIVE',
          image_url: 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
        };
        conversionCall = this.crmService.convertToClientOnly(this.selectedLead.id, clientData);
        break;
      case 'MATTER_ONLY':
        // Structure case data properly for backend
        const matterData = {
          title: formData.caseTitle,
          description: formData.caseDescription,
          type: formData.practiceArea,
          urgencyLevel: formData.urgencyLevel || 'MEDIUM',
          courtName: formData.courtName,
          hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : null
        };
        conversionCall = this.crmService.convertToMatterOnly(this.selectedLead.id, matterData);
        break;
      case 'CLIENT_AND_MATTER':
        // Structure data properly for backend with both clientData and caseData
        const clientAndMatterData = {
          clientData: {
            name: `${formData.clientFirstName || ''} ${formData.clientLastName || ''}`.trim(),
            email: formData.clientEmail,
            phone: formData.clientPhone,
            address: this.buildFullAddress(formData),
            status: 'ACTIVE',
            type: formData.clientType || 'INDIVIDUAL',
            image_url: 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
          },
          caseData: {
            title: formData.caseTitle,
            description: formData.caseDescription,
            type: formData.practiceArea,
            urgencyLevel: formData.urgencyLevel || 'MEDIUM',
            courtName: formData.courtName,
            hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : null,
            status: 'ACTIVE'
          }
        };
        conversionCall = this.crmService.convertToClientAndMatter(this.selectedLead.id, clientAndMatterData);
        break;
      default:
        Swal.close();
        return;
    }
    
    conversionCall.subscribe({
      next: (response) => {
        this.handleConversionSuccess(response);
      },
      error: (error) => {
        this.handleConversionError(error);
      }
    });
  }

  private handleConversionSuccess(response: any) {
    const conversionTypeLabel = this.conversionTypes.find(t => t.value === this.selectedConversionType)?.label || 'records';
    
    let successMessage = `🎉 Lead successfully converted to ${conversionTypeLabel}!`;
    let detailsHTML = '<div class="text-left">';
    
    if (response.clientId && response.caseId) {
      detailsHTML += `
        <div class="alert alert-success">
          <h6>Created Records:</h6>
          <p class="mb-1"><strong>Client ID:</strong> ${response.clientId}</p>
          <p class="mb-0"><strong>Case ID:</strong> ${response.caseId}</p>
        </div>
      `;
    } else if (response.clientId) {
      detailsHTML += `
        <div class="alert alert-success">
          <h6>Created Record:</h6>
          <p class="mb-0"><strong>Client ID:</strong> ${response.clientId}</p>
        </div>
      `;
    } else if (response.caseId) {
      detailsHTML += `
        <div class="alert alert-success">
          <h6>Created Record:</h6>
          <p class="mb-0"><strong>Case ID:</strong> ${response.caseId}</p>
        </div>
      `;
    }
    
    detailsHTML += '</div>';
    
    Swal.fire({
      title: 'Conversion Successful! 🎉',
      html: detailsHTML,
      icon: 'success',
      confirmButtonText: 'View Records',
      cancelButtonText: 'Close',
      showCancelButton: true,
      timer: 8000,
      timerProgressBar: true
    }).then((result) => {
      if (result.isConfirmed) {
        // Navigate to view the created records
        if (response.clientId && response.caseId) {
          // For CLIENT_AND_MATTER, navigate to the client page which should show both client and case info
          this.router.navigate(['/client', response.clientId]);
        } else if (response.clientId) {
          // For CLIENT_ONLY, navigate to the client detail page
          this.router.navigate(['/client', response.clientId]);
        } else if (response.caseId) {
          // For MATTER_ONLY, navigate to the case detail page
          this.router.navigate(['/case', response.caseId]);
        }
      }
    });
    
    this.closeConvertModal();
    this.loadLeads(); // Refresh the leads list
  }

  private handleConversionError(error: any) {
    console.error('Conversion failed:', error);
    
    let errorMessage = 'Failed to convert lead. Please try again.';
    if (error.status === 409) {
      errorMessage = 'Conversion failed due to conflicts or duplicate records';
    } else if (error.status === 400 && error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.status === 422) {
      errorMessage = 'Validation error: Please check all required fields';
    }
    
    Swal.fire({
      title: 'Conversion Failed',
      text: errorMessage,
      icon: 'error',
      confirmButtonText: 'Try Again',
      cancelButtonText: 'Cancel',
      showCancelButton: true
    }).then((result) => {
      if (result.isConfirmed) {
        // Stay in the modal to retry
        this.conversionStep = 2; // Go back to data entry step
      } else {
        this.closeConvertModal();
      }
    });
  }

  private performConversionWithConflictCheck(formData: any) {
    if (!this.selectedLead || !this.selectedConversionType) return;
    
    // Step 1: Show progress
    Swal.fire({
      title: 'Converting Lead...',
      html: `
        <div class="conversion-progress">
          <div class="step active">1. Checking for conflicts...</div>
          <div class="step">2. Creating records...</div>
          <div class="step">3. Finalizing conversion...</div>
        </div>
      `,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
    
    // Step 2: Perform conflict check
    let conflictCheckObservable;
    
    switch (this.selectedConversionType) {
      case 'CLIENT_ONLY':
        conflictCheckObservable = this.crmService.performClientConflictCheck(this.selectedLead.id, formData);
        break;
      case 'MATTER_ONLY':
        conflictCheckObservable = this.crmService.performMatterConflictCheck(this.selectedLead.id, formData);
        break;
      case 'CLIENT_AND_MATTER':
        conflictCheckObservable = this.crmService.performFullConflictCheck(this.selectedLead.id, formData);
        break;
      default:
        this.performConversion(formData);
        return;
    }
    
    conflictCheckObservable.subscribe({
      next: (conflictResult) => {
        if (conflictResult.hasConflicts) {
          Swal.fire({
            title: 'Conflicts Detected',
            text: 'Potential conflicts have been found. Please review and resolve them before proceeding.',
            icon: 'warning',
            confirmButtonText: 'Review Conflicts',
            cancelButtonText: 'Cancel Conversion',
            showCancelButton: true
          }).then((result) => {
            if (result.isConfirmed) {
              // Here you would typically navigate to conflict resolution page
              console.log('Navigate to conflict resolution:', conflictResult);
            }
          });
        } else {
          // No conflicts, proceed with conversion
          this.performConversion(formData);
        }
      },
      error: (error) => {
        console.error('Conflict check failed:', error);
        Swal.fire({
          title: 'Unable to Check Conflicts',
          text: 'Proceeding with conversion without conflict check. Please verify manually.',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Proceed Anyway',
          cancelButtonText: 'Cancel'
        }).then((result) => {
          if (result.isConfirmed) {
            this.performConversion(formData);
          }
        });
      }
    });
  }

  private performConversion(formData: any) {
    if (!this.selectedLead || !this.selectedConversionType) return;
    
    // Update progress indicator
    Swal.update({
      html: `
        <div class="conversion-progress">
          <div class="step completed">✓ Conflicts checked</div>
          <div class="step active">2. Creating records...</div>
          <div class="step">3. Finalizing conversion...</div>
        </div>
      `
    });
    
    let conversionCall;
    
    switch (this.selectedConversionType) {
      case 'CLIENT_ONLY':
        conversionCall = this.crmService.convertToClientOnly(this.selectedLead.id, formData);
        break;
      case 'MATTER_ONLY':
        // Structure case data properly for backend
        const matterOnlyData = {
          title: formData.caseTitle,
          description: formData.caseDescription,
          type: formData.practiceArea,
          urgencyLevel: formData.urgencyLevel || 'MEDIUM',
          courtName: formData.courtName,
          hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : null
        };
        conversionCall = this.crmService.convertToMatterOnly(this.selectedLead.id, matterOnlyData);
        break;
      case 'CLIENT_AND_MATTER':
        // Structure data properly for backend with both clientData and caseData
        const clientAndMatterFormData = {
          clientData: {
            name: `${formData.clientFirstName || ''} ${formData.clientLastName || ''}`.trim(),
            email: formData.clientEmail,
            phone: formData.clientPhone,
            address: this.buildFullAddress(formData),
            status: 'ACTIVE',
            type: formData.clientType || 'INDIVIDUAL',
            image_url: 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
          },
          caseData: {
            title: formData.caseTitle,
            description: formData.caseDescription,
            type: formData.practiceArea,
            urgencyLevel: formData.urgencyLevel || 'MEDIUM',
            courtName: formData.courtName,
            hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : null,
            status: 'ACTIVE'
          }
        };
        conversionCall = this.crmService.convertToClientAndMatter(this.selectedLead.id, clientAndMatterFormData);
        break;
      default:
        return;
    }
    
    conversionCall.subscribe({
      next: (response) => {
        // Final progress step
        Swal.update({
          html: `
            <div class="conversion-progress">
              <div class="step completed">✓ Conflicts checked</div>
              <div class="step completed">✓ Records created</div>
              <div class="step completed">✓ Conversion finalized</div>
            </div>
          `
        });
        
        setTimeout(() => {
          const conversionTypeLabel = this.conversionTypes.find(t => t.value === this.selectedConversionType)?.label || 'records';
          let successMessage = `Lead successfully converted to ${conversionTypeLabel}!`;
          
          if (response.clientId && response.caseId) {
            successMessage += `\n\nClient ID: ${response.clientId}\nCase ID: ${response.caseId}`;
          } else if (response.clientId) {
            successMessage += `\n\nClient ID: ${response.clientId}`;
          } else if (response.caseId) {
            successMessage += `\n\nCase ID: ${response.caseId}`;
          }
          
          Swal.fire({
            title: 'Conversion Successful! 🎉',
            text: successMessage,
            icon: 'success',
            confirmButtonText: 'View Records',
            cancelButtonText: 'Close',
            showCancelButton: true,
            timer: 5000
          }).then((result) => {
            if (result.isConfirmed) {
              // Navigate to view the created records
              if (response.clientId) {
                console.log('Navigate to client:', response.clientId);
              }
              if (response.caseId) {
                console.log('Navigate to case:', response.caseId);
              }
            }
          });
          
          this.closeConvertModal();
          this.loadLeads();
        }, 1000);
      },
      error: (error) => {
        console.error('Error converting lead:', error);
        
        let errorMessage = 'Failed to convert lead';
        if (error.status === 409) {
          errorMessage = 'Conversion failed due to conflicts or duplicate records';
        } else if (error.status === 400 && error.error?.message) {
          errorMessage = error.error.message;
        } else if (error.status === 422) {
          errorMessage = 'Validation error: Please check all required fields';
        }
        
        Swal.fire({
          title: 'Conversion Failed',
          text: errorMessage,
          icon: 'error',
          confirmButtonText: 'Try Again',
          cancelButtonText: 'Cancel',
          showCancelButton: true
        }).then((result) => {
          if (!result.isConfirmed) {
            this.closeConvertModal();
          }
        });
      }
    });
  }
}