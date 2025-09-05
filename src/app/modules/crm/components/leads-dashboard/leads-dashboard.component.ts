import { Component, OnInit, ChangeDetectorRef, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
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
  priority: string;
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
  caseType: string;
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
  selectedPriority = '';
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
    { value: 'CLIENT_ONLY', label: 'Client Only', description: 'Create client record with contact information only' },
    { value: 'MATTER_ONLY', label: 'Matter/Case Only', description: 'Create legal case without full client profile' },
    { value: 'CLIENT_AND_MATTER', label: 'Client & Matter', description: 'Complete conversion with both client and case records' }
  ];
  selectedConversionType = '';
  
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
    private fb: FormBuilder
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
      priority: [''],
      estimatedValue: ['', [Validators.min(0), Validators.max(10000000)]],
      notes: ['', [Validators.maxLength(1000)]],
      contactPreference: [''],
      urgencyLevel: [''],
      initialInquiry: ['', [Validators.maxLength(2000)]],
      // Additional fields that were missing
      source: [''],
      caseType: [''],
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
      clientFirstName: [''],
      clientLastName: [''],
      clientEmail: [''],
      clientPhone: [''],
      caseTitle: [''],
      caseDescription: [''],
      retainerAmount: [''],
      notes: ['']
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
      const matchesPriority = !this.selectedPriority || lead.priority === this.selectedPriority;
      const matchesPracticeArea = !this.selectedPracticeArea || lead.practiceArea === this.selectedPracticeArea;
      const matchesAssignedTo = !this.selectedAssignedTo || 
        (lead.assignedToName && lead.assignedToName.toLowerCase().includes(this.selectedAssignedTo.toLowerCase()));
      
      return matchesStatus && matchesPriority && matchesPracticeArea && matchesAssignedTo;
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
    this.selectedPriority = '';
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

  getPriorityBadgeClass(priority: string): string {
    const priorityClasses: { [key: string]: string } = {
      'URGENT': 'urgent-red text-white priority-urgent-pulse',
      'HIGH': 'high-red text-white',
      'MEDIUM': 'bg-info text-white', 
      'LOW': 'bg-success text-white'
    };
    return priorityClasses[priority] || 'bg-secondary text-white';
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

  getPriorityDisplayName(priority: string): string {
    if (!priority) return 'No Priority';
    return priority.charAt(0) + priority.slice(1).toLowerCase();
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
      priority: lead.priority || '',
      estimatedValue: lead.estimatedValue || '',
      notes: lead.notes || '',
      contactPreference: lead.contactPreference || '',
      urgencyLevel: lead.urgencyLevel || '',
      initialInquiry: lead.initialInquiry || '',
      // Additional fields
      source: lead.source || '',
      caseType: lead.caseType || '',
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

    this.selectedLead = lead;
    this.selectedConversionType = '';
    this.convertForm.reset();
    
    // Perform pre-conversion checks
    this.performPreConversionChecks(lead);
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
    this.selectedConversionType = '';
    this.convertForm.reset();
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
    
    if (!type) return;
    
    // Load required fields for this conversion type
    this.loadRequiredConversionFields(type);
    
    // Update form validators based on conversion type
    const clientFields = ['clientFirstName', 'clientLastName', 'clientEmail'];
    const caseFields = ['caseTitle', 'caseDescription'];
    
    // Clear all validators first
    clientFields.forEach(field => {
      this.convertForm.get(field)?.clearValidators();
      this.convertForm.get(field)?.updateValueAndValidity();
    });
    
    caseFields.forEach(field => {
      this.convertForm.get(field)?.clearValidators();
      this.convertForm.get(field)?.updateValueAndValidity();
    });
    
    // Add validators based on conversion type
    if (type === 'CLIENT_ONLY' || type === 'CLIENT_AND_MATTER') {
      clientFields.forEach(field => {
        this.convertForm.get(field)?.setValidators([Validators.required]);
        this.convertForm.get(field)?.updateValueAndValidity();
      });
      
      // Pre-populate with lead data
      this.convertForm.patchValue({
        clientFirstName: this.selectedLead?.firstName || '',
        clientLastName: this.selectedLead?.lastName || '',
        clientEmail: this.selectedLead?.email || '',
        clientPhone: this.selectedLead?.phone || ''
      });
    }
    
    if (type === 'MATTER_ONLY' || type === 'CLIENT_AND_MATTER') {
      caseFields.forEach(field => {
        this.convertForm.get(field)?.setValidators([Validators.required]);
        this.convertForm.get(field)?.updateValueAndValidity();
      });
      
      // Pre-populate with lead data
      const practiceArea = this.selectedLead?.practiceArea?.replace('_', ' ') || '';
      this.convertForm.patchValue({
        caseTitle: `${practiceArea} Matter - ${this.selectedLead?.fullName || 'New Case'}`,
        caseDescription: this.selectedLead?.initialInquiry || ''
      });
    }
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
    if (this.convertForm.valid && this.selectedLead && this.selectedConversionType) {
      const formData = this.convertForm.value;
      
      // Enhanced confirmation with detailed information
      const conversionTypeLabel = this.conversionTypes.find(t => t.value === this.selectedConversionType)?.label || this.selectedConversionType;
      
      let confirmationHTML = `
        <div class="text-left">
          <p><strong>Lead:</strong> ${this.selectedLead.fullName}</p>
          <p><strong>Conversion Type:</strong> ${conversionTypeLabel}</p>
      `;
      
      if (this.selectedConversionType === 'CLIENT_ONLY' || this.selectedConversionType === 'CLIENT_AND_MATTER') {
        confirmationHTML += `<p><strong>Client Name:</strong> ${formData.clientFirstName} ${formData.clientLastName}</p>`;
      }
      
      if (this.selectedConversionType === 'MATTER_ONLY' || this.selectedConversionType === 'CLIENT_AND_MATTER') {
        confirmationHTML += `<p><strong>Case:</strong> ${formData.caseTitle}</p>`;
      }
      
      confirmationHTML += `</div>`;
      
      Swal.fire({
        title: 'Confirm Lead Conversion',
        html: confirmationHTML,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#dc3545',
        confirmButtonText: 'Yes, Convert Lead',
        cancelButtonText: 'Cancel',
        customClass: {
          popup: 'conversion-confirmation-popup'
        }
      }).then((result) => {
        if (result.isConfirmed && this.selectedLead) {
          this.performConversionWithConflictCheck(formData);
        }
      });
    } else {
      // Enhanced validation error handling
      Object.keys(this.convertForm.controls).forEach(key => {
        this.convertForm.get(key)?.markAsTouched();
      });
      
      let errorMessage = 'Please complete all required fields:';
      const errors: string[] = [];
      
      if (!this.selectedConversionType) {
        errors.push('- Select a conversion type');
      }
      
      if (this.selectedConversionType === 'CLIENT_ONLY' || this.selectedConversionType === 'CLIENT_AND_MATTER') {
        if (!this.convertForm.get('clientFirstName')?.value) errors.push('- Client first name');
        if (!this.convertForm.get('clientLastName')?.value) errors.push('- Client last name');
        if (!this.convertForm.get('clientEmail')?.value) errors.push('- Client email');
      }
      
      if (this.selectedConversionType === 'MATTER_ONLY' || this.selectedConversionType === 'CLIENT_AND_MATTER') {
        if (!this.convertForm.get('caseTitle')?.value) errors.push('- Case title');
        if (!this.convertForm.get('caseDescription')?.value) errors.push('- Case description');
      }
      
      if (errors.length > 0) {
        errorMessage += '\n' + errors.join('\n');
      }
      
      Swal.fire({
        title: 'Form Validation Error',
        text: errorMessage,
        icon: 'warning',
        confirmButtonText: 'OK'
      });
    }
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
        conversionCall = this.crmService.convertToMatterOnly(this.selectedLead.id, formData);
        break;
      case 'CLIENT_AND_MATTER':
        conversionCall = this.crmService.convertToClientAndMatter(this.selectedLead.id, formData);
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