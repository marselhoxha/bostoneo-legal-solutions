import { Component, OnInit } from '@angular/core';
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
  pipelineStages: PipelineStage[] = [];
  pipelineSummary: PipelineSummary | null = null;
  loading = false;
  
  currentPage = 1;
  itemsPerPage = 20;
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
  
  constructor(private crmService: CrmService) {}

  ngOnInit() {
    this.loadPipelineStages();
    this.loadPipelineSummary();
    this.loadLeads();
  }

  loadLeads() {
    this.loading = true;
    
    const params = {
      page: this.currentPage - 1,
      size: this.itemsPerPage,
      sortBy: this.sortBy,
      sortDir: this.sortDirection,
      ...(this.selectedStatus && { status: this.selectedStatus }),
      ...(this.selectedPriority && { priority: this.selectedPriority }),
      ...(this.selectedPracticeArea && { practiceArea: this.selectedPracticeArea }),
      ...(this.selectedAssignedTo && { assignedTo: this.selectedAssignedTo })
    };
    
    this.crmService.getLeads(params).subscribe({
      next: (response: any) => {
        this.leads = response.content || [];
        this.totalItems = response.totalElements || 0;
        this.totalPages = response.totalPages || 0;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading leads:', error);
        this.loading = false;
      }
    });
  }

  loadPipelineStages() {
    this.crmService.getPipelineStages().subscribe({
      next: (stages: PipelineStage[]) => {
        this.pipelineStages = stages.sort((a, b) => a.stageOrder - b.stageOrder);
      },
      error: (error) => {
        console.error('Error loading pipeline stages:', error);
      }
    });
  }

  loadPipelineSummary() {
    this.crmService.getPipelineSummary().subscribe({
      next: (summary: PipelineSummary) => {
        this.pipelineSummary = summary;
      },
      error: (error) => {
        console.error('Error loading pipeline summary:', error);
      }
    });
  }

  onPageChange(page: number) {
    this.currentPage = page;
    this.loadLeads();
  }

  onFilterChange() {
    this.currentPage = 1;
    this.loadLeads();
  }

  onSort(field: string) {
    if (this.sortBy === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = field;
      this.sortDirection = 'asc';
    }
    this.loadLeads();
  }

  clearFilters() {
    this.selectedStatus = '';
    this.selectedPriority = '';
    this.selectedPracticeArea = '';
    this.selectedAssignedTo = '';
    this.currentPage = 1;
    this.loadLeads();
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
      'NEW': 'badge-soft-primary',
      'CONTACTED': 'badge-soft-info', 
      'QUALIFIED': 'badge-soft-warning',
      'CONSULTATION_SCHEDULED': 'badge-soft-secondary',
      'PROPOSAL_SENT': 'badge-soft-dark',
      'NEGOTIATING': 'badge-soft-light',
      'CONVERTED': 'badge-soft-success',
      'LOST': 'badge-soft-danger',
      'UNRESPONSIVE': 'badge-soft-danger'
    };
    return statusClasses[status] || 'badge-soft-light';
  }

  getPriorityBadgeClass(priority: string): string {
    const priorityClasses: { [key: string]: string } = {
      'HIGH': 'badge-soft-danger',
      'MEDIUM': 'badge-soft-warning', 
      'LOW': 'badge-soft-success'
    };
    return priorityClasses[priority] || 'badge-soft-secondary';
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
      },
      error: (error) => {
        console.error('Error moving lead to stage:', error);
      }
    });
  }

  onAssignLead(leadId: number, assignToUserId: number, notes: string = '') {
    this.crmService.assignLead(leadId, assignToUserId, notes).subscribe({
      next: () => {
        this.loadLeads();
      },
      error: (error) => {
        console.error('Error assigning lead:', error);
      }
    });
  }
}