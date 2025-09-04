import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CrmService } from '../../services/crm.service';

export interface ConflictCheckListDTO {
  id: number;
  entityType: string;
  entityId: number;
  entityName?: string;
  checkType: string;
  status: string;
  confidenceScore: number;
  autoChecked: boolean;
  checkedBy?: number;
  checkedByName?: string;
  checkedAt?: string;
  resolution?: string;
  resolutionNotes?: string;
  resolvedBy?: number;
  resolvedByName?: string;
  resolvedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  searchTerms?: string[];
  totalMatches: number;
  highRiskMatches: number;
}

@Component({
  selector: 'app-conflict-checks-list',
  templateUrl: './conflict-checks-list.component.html',
  styleUrls: ['./conflict-checks-list.component.scss']
})
export class ConflictChecksListComponent implements OnInit {
  conflictChecks: ConflictCheckListDTO[] = [];
  filteredChecks: ConflictCheckListDTO[] = [];
  isLoading = true;
  error: string = '';
  
  // Filter properties
  selectedStatus = '';
  selectedEntityType = '';
  selectedCheckType = '';
  searchTerm = '';
  dateRange = '';
  
  // Status options
  statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'CLEAR', label: 'Clear' },
    { value: 'CONFLICT_FOUND', label: 'Conflict Found' },
    { value: 'POTENTIAL_CONFLICT', label: 'Potential Conflict' },
    { value: 'LOW_RISK', label: 'Low Risk' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'WAIVER_REQUIRED', label: 'Waiver Required' },
    { value: 'RESOLVED', label: 'Resolved' }
  ];
  
  // Entity type options
  entityTypeOptions = [
    { value: '', label: 'All Types' },
    { value: 'LEAD', label: 'Lead' },
    { value: 'CLIENT', label: 'Client' },
    { value: 'MATTER', label: 'Matter' },
    { value: 'CONTACT', label: 'Contact' }
  ];
  
  // Check type options
  checkTypeOptions = [
    { value: '', label: 'All Check Types' },
    { value: 'CLIENT_ONLY', label: 'Client Only' },
    { value: 'MATTER_ONLY', label: 'Matter Only' },
    { value: 'CLIENT_AND_MATTER', label: 'Client & Matter' },
    { value: 'AUTOMATED', label: 'Automated' },
    { value: 'MANUAL', label: 'Manual' }
  ];
  
  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;
  
  // Selected checks for bulk actions
  selectedChecks = new Set<number>();
  selectAll = false;

  constructor(
    private crmService: CrmService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadConflictChecks();
  }

  loadConflictChecks(): void {
    this.isLoading = true;
    this.error = '';
    
    const params = {
      page: this.currentPage,
      size: this.pageSize,
      status: this.selectedStatus,
      entityType: this.selectedEntityType,
      checkType: this.selectedCheckType,
      search: this.searchTerm
    };
    
    // Mock data for development - replace with actual service call
    setTimeout(() => {
      this.conflictChecks = this.generateMockConflictChecks();
      this.filteredChecks = [...this.conflictChecks];
      this.applyFilters();
      this.totalElements = this.filteredChecks.length;
      this.totalPages = Math.ceil(this.totalElements / this.pageSize);
      this.isLoading = false;
    }, 1000);
    
    /*
    // Actual service call - uncomment when backend is ready
    this.crmService.getConflictChecks(params).subscribe({
      next: (response) => {
        this.conflictChecks = response.content;
        this.filteredChecks = [...this.conflictChecks];
        this.totalElements = response.totalElements;
        this.totalPages = response.totalPages;
        this.currentPage = response.number;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading conflict checks:', error);
        this.error = 'Failed to load conflict checks. Please try again.';
        this.isLoading = false;
      }
    });
    */
  }
  
  private generateMockConflictChecks(): ConflictCheckListDTO[] {
    return [
      {
        id: 1,
        entityType: 'LEAD',
        entityId: 123,
        entityName: 'John Doe Lead',
        checkType: 'CLIENT_ONLY',
        status: 'CONFLICT_FOUND',
        confidenceScore: 85,
        autoChecked: true,
        checkedAt: '2025-01-10T10:30:00Z',
        createdAt: '2025-01-10T10:30:00Z',
        updatedAt: '2025-01-10T11:00:00Z',
        searchTerms: ['John Doe', 'john.doe@email.com'],
        totalMatches: 3,
        highRiskMatches: 1
      },
      {
        id: 2,
        entityType: 'CLIENT',
        entityId: 456,
        entityName: 'Smith Corp Client',
        checkType: 'CLIENT_AND_MATTER',
        status: 'CLEAR',
        confidenceScore: 95,
        autoChecked: false,
        checkedBy: 1,
        checkedByName: 'Sarah Johnson',
        checkedAt: '2025-01-09T14:15:00Z',
        createdAt: '2025-01-09T14:00:00Z',
        updatedAt: '2025-01-09T14:20:00Z',
        searchTerms: ['Smith Corporation', 'Contract Dispute'],
        totalMatches: 0,
        highRiskMatches: 0
      },
      {
        id: 3,
        entityType: 'MATTER',
        entityId: 789,
        entityName: 'Personal Injury Case #789',
        checkType: 'MATTER_ONLY',
        status: 'POTENTIAL_CONFLICT',
        confidenceScore: 65,
        autoChecked: true,
        resolution: 'WAIVER_APPROVED',
        resolutionNotes: 'Client provided written waiver after full disclosure',
        resolvedBy: 2,
        resolvedByName: 'David Wilson',
        resolvedAt: '2025-01-08T16:30:00Z',
        createdAt: '2025-01-08T15:45:00Z',
        updatedAt: '2025-01-08T16:35:00Z',
        searchTerms: ['Auto Accident', 'Insurance Company ABC'],
        totalMatches: 2,
        highRiskMatches: 0
      },
      {
        id: 4,
        entityType: 'LEAD',
        entityId: 234,
        entityName: 'Jane Smith Lead',
        checkType: 'AUTOMATED',
        status: 'PENDING',
        confidenceScore: 0,
        autoChecked: true,
        createdAt: '2025-01-11T09:15:00Z',
        updatedAt: '2025-01-11T09:15:00Z',
        searchTerms: ['Jane Smith', 'family law'],
        totalMatches: 0,
        highRiskMatches: 0
      }
    ];
  }

  applyFilters(): void {
    let filtered = [...this.conflictChecks];
    
    if (this.selectedStatus) {
      filtered = filtered.filter(c => c.status === this.selectedStatus);
    }
    
    if (this.selectedEntityType) {
      filtered = filtered.filter(c => c.entityType === this.selectedEntityType);
    }
    
    if (this.selectedCheckType) {
      filtered = filtered.filter(c => c.checkType === this.selectedCheckType);
    }
    
    if (this.searchTerm) {
      const search = this.searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.entityName?.toLowerCase().includes(search) ||
        c.checkedByName?.toLowerCase().includes(search) ||
        c.resolvedByName?.toLowerCase().includes(search) ||
        c.searchTerms?.some(term => term.toLowerCase().includes(search))
      );
    }
    
    this.filteredChecks = filtered;
    this.totalElements = filtered.length;
    this.totalPages = Math.ceil(this.totalElements / this.pageSize);
    this.currentPage = 0;
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  onSearch(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.selectedStatus = '';
    this.selectedEntityType = '';
    this.selectedCheckType = '';
    this.searchTerm = '';
    this.dateRange = '';
    this.applyFilters();
  }

  getStatusBadgeClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'PENDING': 'badge bg-warning-subtle text-warning',
      'CLEAR': 'badge bg-success-subtle text-success',
      'CONFLICT_FOUND': 'badge bg-danger-subtle text-danger',
      'POTENTIAL_CONFLICT': 'badge bg-warning-subtle text-warning',
      'LOW_RISK': 'badge bg-info-subtle text-info',
      'APPROVED': 'badge bg-success-subtle text-success',
      'REJECTED': 'badge bg-danger-subtle text-danger',
      'WAIVER_REQUIRED': 'badge bg-warning-subtle text-warning',
      'RESOLVED': 'badge bg-success-subtle text-success'
    };
    return statusClasses[status] || 'badge bg-light text-dark';
  }

  getConfidenceScoreClass(score: number): string {
    if (score >= 80) return 'text-success fw-bold';
    if (score >= 60) return 'text-warning fw-bold';
    if (score >= 40) return 'text-danger fw-bold';
    return 'text-muted';
  }

  getRiskIndicatorClass(totalMatches: number, highRiskMatches: number): string {
    if (highRiskMatches > 0) return 'text-danger';
    if (totalMatches > 2) return 'text-warning';
    if (totalMatches > 0) return 'text-info';
    return 'text-success';
  }

  onCheckAction(checkId: number, action: string): void {
    console.log(`Action ${action} on conflict check ${checkId}`);
    // Implement action logic here
  }

  onBulkAction(action: string): void {
    console.log(`Bulk action ${action} on checks:`, Array.from(this.selectedChecks));
    // Implement bulk action logic here
  }

  toggleSelection(checkId: number): void {
    if (this.selectedChecks.has(checkId)) {
      this.selectedChecks.delete(checkId);
    } else {
      this.selectedChecks.add(checkId);
    }
    this.updateSelectAllState();
  }

  toggleSelectAll(): void {
    if (this.selectAll) {
      this.selectedChecks.clear();
    } else {
      this.filteredChecks.forEach(c => this.selectedChecks.add(c.id));
    }
    this.selectAll = !this.selectAll;
  }

  private updateSelectAllState(): void {
    const visibleIds = this.filteredChecks.map(c => c.id);
    this.selectAll = visibleIds.every(id => this.selectedChecks.has(id));
  }

  formatDateTime(dateString: string): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  }

  getPendingChecksCount(): number {
    return this.conflictChecks.filter(c => c.status === 'PENDING').length;
  }

  getConflictFoundCount(): number {
    return this.conflictChecks.filter(c => c.status === 'CONFLICT_FOUND').length;
  }

  getClearedResolvedCount(): number {
    return this.conflictChecks.filter(c => c.status === 'CLEAR' || c.status === 'RESOLVED').length;
  }

  viewCheckDetails(checkId: number): void {
    // Navigate to check details or open modal
    console.log('View details for conflict check:', checkId);
  }

  runNewConflictCheck(): void {
    console.log('Run new conflict check');
    // Navigate to new conflict check form or open modal
  }

  exportChecks(): void {
    console.log('Export conflict checks');
    // Implement export functionality
  }

  // Pagination methods
  previousPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.loadConflictChecks();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.loadConflictChecks();
    }
  }

  goToPage(page: number): void {
    this.currentPage = page;
    this.loadConflictChecks();
  }
}