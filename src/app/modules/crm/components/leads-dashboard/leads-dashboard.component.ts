import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CrmService } from '../../services/crm.service';

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
export class LeadsDashboardComponent implements OnInit {
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
  
  // Make Math available in template
  Math = Math;
  
  constructor(private crmService: CrmService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadPipelineStages();
    this.loadPipelineSummary();
    this.loadLeads();
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
      'CONSULTATION_SCHEDULED': 'bg-secondary text-white',
      'PROPOSAL_SENT': 'proposal-sent-color text-white',
      'PROPOSAL SENT': 'proposal-sent-color text-white',
      'NEGOTIATION': 'bg-warning text-white',
      'CONVERTED': 'bg-success text-white',
      'LOST': 'bg-danger text-white',
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
    return this.pipelineSummary?.statusCounts[stageName] || 0;
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
    this.showLeadModal = true;
  }

  assignLead(lead: LeadDTO) {
    console.log('Assigning lead:', lead);
  }

  scheduleCall(lead: LeadDTO) {
    console.log('Scheduling call for lead:', lead);
  }

  convertLead(lead: LeadDTO) {
    console.log('Converting lead:', lead);
  }
}