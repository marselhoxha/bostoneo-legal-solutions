import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { CaseAssignmentService } from '../../../service/case-assignment.service';
import { UserService } from '../../../service/user.service';
import { CaseClientService } from '../../../service/case-client.service';
import { NotificationService } from '../../../service/notification.service';
import { 
  CaseAssignment, 
  CaseAssignmentRequest,
  UserWorkload, 
  WorkloadAnalytics,
  CaseTransferRequestDTO,
  TransferStatus,
  CaseRoleType,
  AssignmentType,
  WorkloadStatus,
  AssignmentRule,
  AssignmentRecommendation,
  AssignmentHistory
} from '../../../interface/case-assignment';
import { User } from '../../../interface/user';

interface LegalCase {
  id: number;
  title: string;
  caseNumber: string;
  clientName?: string;
  status: string;
  caseType: string;
  priority: string;
  estimatedWorkload?: number;
  createdAt: Date;
  assignedAttorneys?: User[];
}

interface CaseTypeStats {
  caseType: string;
  totalCases: number;
  avgWorkload: number;
  preferredAttorneys: string[];
}

interface AttorneyExpertise {
  userId: number;
  userName: string;
  specializations: string[];
  caseTypeExperience: { [key: string]: number };
  successRate: number;
  avgCaseCompletionTime: number;
}

@Component({
  selector: 'app-case-assignment-management',
  templateUrl: './case-assignment-management.component.html',
  styleUrls: ['./case-assignment-management.component.css']
})
export class CaseAssignmentManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Core Data
  cases: LegalCase[] = [];
  filteredCases: LegalCase[] = [];
  attorneys: User[] = [];
  filteredAttorneys: User[] = [];
  assignments: CaseAssignment[] = [];
  workloadData: UserWorkload[] = [];
  analytics: WorkloadAnalytics | null = null;
  pendingTransfers: CaseTransferRequestDTO[] = [];
  assignmentHistory: AssignmentHistory[] = [];
  assignmentRules: AssignmentRule[] = [];
  
  // Selected Items
  selectedCase: LegalCase | null = null;
  selectedAttorney: User | null = null;
  
  // UI State
  searchTerm = '';
  attorneySearchTerm = '';
  selectedTab = 'assignments';
  selectedCaseType = '';
  selectedPriority = '';
  selectedWorkloadFilter = '';
  
  // Loading States
  loading = {
    cases: false,
    attorneys: false,
    assignments: false,
    workload: false,
    analytics: false,
    assigning: false,
    transferring: false
  };
  
  // Forms
  assignmentForm: FormGroup;
  transferForm: FormGroup;
  ruleForm: FormGroup;
  
  // Constants
  caseTypes = [
    'CORPORATE_LAW', 'LITIGATION', 'REAL_ESTATE', 'FAMILY_LAW', 
    'CRIMINAL_LAW', 'INTELLECTUAL_PROPERTY', 'EMPLOYMENT_LAW', 
    'ESTATE_PLANNING', 'BANKRUPTCY', 'IMMIGRATION', 'TAX_LAW'
  ];
  
  priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  caseRoleTypes = Object.values(CaseRoleType);
  assignmentTypes = Object.values(AssignmentType);
  workloadStatuses = Object.values(WorkloadStatus);
  
  // Statistics
  caseTypeStats: CaseTypeStats[] = [];
  attorneyExpertise: AttorneyExpertise[] = [];

  constructor(
    private caseAssignmentService: CaseAssignmentService,
    private userService: UserService,
    private caseClientService: CaseClientService,
    private notificationService: NotificationService,
    private formBuilder: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForms(): void {
    this.assignmentForm = this.formBuilder.group({
      caseId: [null, Validators.required],
      userId: [null, Validators.required],
      roleType: [CaseRoleType.LEAD_ATTORNEY, Validators.required],
      assignmentType: [AssignmentType.MANUAL, Validators.required],
      workloadWeight: [50, [Validators.required, Validators.min(1), Validators.max(100)]],
      effectiveFrom: [new Date(), Validators.required],
      effectiveTo: [null],
      notes: ['']
    });

    this.transferForm = this.formBuilder.group({
      caseId: [null, Validators.required],
      fromUserId: [null, Validators.required],
      toUserId: [null, Validators.required],
      reason: ['', Validators.required],
      urgency: ['MEDIUM', Validators.required],
      notes: ['']
    });

    this.ruleForm = this.formBuilder.group({
      ruleName: ['', Validators.required],
      ruleType: ['CASE_TYPE_BASED', Validators.required],
      caseType: [''],
      priorityOrder: [1, [Validators.required, Validators.min(1)]],
      maxWorkloadPercentage: [80, [Validators.min(1), Validators.max(100)]],
      minExpertiseScore: [70, [Validators.min(0), Validators.max(100)]],
      preferPreviousAttorney: [true],
      active: [true]
    });
  }

  private loadInitialData(): void {
    this.loading.cases = true;
    this.loading.attorneys = true;
    this.loading.assignments = true;
    
    forkJoin({
      cases: this.caseClientService.getUserCases(1, 0, 1000).pipe(
        catchError(error => {
          console.error('Error loading cases:', error);
          return of({ data: { content: [] } });
        })
      ),
      attorneys: this.userService.getUsers().pipe(
        catchError(error => {
          console.error('Error loading attorneys:', error);
          return of({ data: [] });
        })
      )
    }).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.loading.cases = false;
        this.loading.attorneys = false;
        this.loading.assignments = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (response) => {
        this.processCasesData(response.cases);
        this.processAttorneysData(response.attorneys);
        this.generateSampleData();
      },
      error: (error) => {
        console.error('Error in loadInitialData:', error);
        this.notificationService.onError('Failed to load initial data');
        this.generateSampleData();
      }
    });
  }

  private processCasesData(response: any): void {
    if (response?.data?.content) {
      this.cases = response.data.content.map((caseItem: any) => ({
        id: caseItem.id,
        title: caseItem.title,
        caseNumber: caseItem.caseNumber,
        clientName: caseItem.clientName || 'N/A',
        status: caseItem.status || 'ACTIVE',
        caseType: caseItem.caseType || this.inferCaseType(caseItem.title),
        priority: caseItem.priority || 'MEDIUM',
        estimatedWorkload: caseItem.estimatedWorkload || this.calculateEstimatedWorkload(caseItem),
        createdAt: caseItem.createdAt ? new Date(caseItem.createdAt) : new Date(),
        assignedAttorneys: []
      }));
    } else {
      this.cases = [];
    }
    this.filteredCases = [...this.cases];
  }

  private processAttorneysData(response: any): void {
    this.attorneys = response?.data ? (Array.isArray(response.data) ? response.data : []) : [];
    this.filteredAttorneys = [...this.attorneys];
  }

  // Case Selection and Filtering
  selectCase(caseItem: LegalCase): void {
    this.selectedCase = caseItem;
    this.assignmentForm.patchValue({ caseId: caseItem.id });
  }

  selectAttorney(attorney: User): void {
    this.selectedAttorney = attorney;
    this.assignmentForm.patchValue({ userId: attorney.id });
  }

  filterCases(): void {
    let filtered = [...this.cases];
    
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(caseItem => 
        caseItem.title.toLowerCase().includes(term) ||
        caseItem.caseNumber.toLowerCase().includes(term) ||
        caseItem.clientName?.toLowerCase().includes(term)
      );
    }
    
    if (this.selectedCaseType) {
      filtered = filtered.filter(caseItem => caseItem.caseType === this.selectedCaseType);
    }
    
    if (this.selectedPriority) {
      filtered = filtered.filter(caseItem => caseItem.priority === this.selectedPriority);
    }
    
    this.filteredCases = filtered;
  }

  filterAttorneys(): void {
    let filtered = [...this.attorneys];
    
    if (this.attorneySearchTerm.trim()) {
      const term = this.attorneySearchTerm.toLowerCase();
      filtered = filtered.filter(attorney => 
        attorney.firstName?.toLowerCase().includes(term) ||
        attorney.lastName?.toLowerCase().includes(term) ||
        attorney.email?.toLowerCase().includes(term)
      );
    }
    
    this.filteredAttorneys = filtered;
  }

  // Assignment Management
  assignCase(): void {
    if (this.assignmentForm.invalid) {
      this.notificationService.onError('Please fill in all required fields');
      return;
    }

    this.loading.assigning = true;
    const formData = this.assignmentForm.value;
    
    // Simulate assignment
    setTimeout(() => {
      this.notificationService.onSuccess('Case assigned successfully');
      this.assignmentForm.reset();
      this.selectedCase = null;
      this.selectedAttorney = null;
      this.loading.assigning = false;
    }, 1000);
  }

  // Utility Methods
  private inferCaseType(title: string): string {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('contract') || titleLower.includes('corporate')) return 'CORPORATE_LAW';
    if (titleLower.includes('litigation') || titleLower.includes('lawsuit')) return 'LITIGATION';
    if (titleLower.includes('real estate') || titleLower.includes('property')) return 'REAL_ESTATE';
    if (titleLower.includes('family') || titleLower.includes('divorce')) return 'FAMILY_LAW';
    if (titleLower.includes('criminal')) return 'CRIMINAL_LAW';
    if (titleLower.includes('ip') || titleLower.includes('patent')) return 'INTELLECTUAL_PROPERTY';
    if (titleLower.includes('employment') || titleLower.includes('labor')) return 'EMPLOYMENT_LAW';
    if (titleLower.includes('estate') || titleLower.includes('will')) return 'ESTATE_PLANNING';
    return 'CORPORATE_LAW';
  }

  private calculateEstimatedWorkload(caseItem: any): number {
    const baseWorkload = 50;
    const priorityMultiplier = { 'LOW': 0.8, 'MEDIUM': 1.0, 'HIGH': 1.3, 'URGENT': 1.6 };
    const typeMultiplier: { [key: string]: number } = {
      'LITIGATION': 1.4, 'CORPORATE_LAW': 1.2, 'CRIMINAL_LAW': 1.3,
      'FAMILY_LAW': 1.1, 'REAL_ESTATE': 1.0, 'INTELLECTUAL_PROPERTY': 1.3,
      'EMPLOYMENT_LAW': 1.1, 'ESTATE_PLANNING': 0.9, 'BANKRUPTCY': 1.2,
      'IMMIGRATION': 1.1, 'TAX_LAW': 1.2
    };
    
    const priority = caseItem.priority || 'MEDIUM';
    const caseType = caseItem.caseType || 'CORPORATE_LAW';
    
    return Math.round(baseWorkload * (priorityMultiplier[priority] || 1.0) * (typeMultiplier[caseType] || 1.0));
  }

  private generateSampleData(): void {
    if (this.cases.length === 0) {
      this.cases = [
        {
          id: 1, title: 'Corporate Merger Agreement', caseNumber: 'CASE-2025-001',
          clientName: 'TechCorp Inc.', status: 'ACTIVE', caseType: 'CORPORATE_LAW',
          priority: 'HIGH', estimatedWorkload: 75, createdAt: new Date(), assignedAttorneys: []
        },
        {
          id: 2, title: 'Employment Discrimination Lawsuit', caseNumber: 'CASE-2025-002',
          clientName: 'John Smith', status: 'ACTIVE', caseType: 'EMPLOYMENT_LAW',
          priority: 'MEDIUM', estimatedWorkload: 60, createdAt: new Date(), assignedAttorneys: []
        },
        {
          id: 3, title: 'Real Estate Transaction', caseNumber: 'CASE-2025-003',
          clientName: 'Property Holdings LLC', status: 'ACTIVE', caseType: 'REAL_ESTATE',
          priority: 'LOW', estimatedWorkload: 40, createdAt: new Date(), assignedAttorneys: []
        }
      ];
      this.filteredCases = [...this.cases];
    }
    
    if (this.attorneys.length === 0) {
      this.attorneys = [
        { 
          id: 1, firstName: 'John', lastName: 'Attorney', email: 'john.attorney@firm.com', 
          enabled: true, notLocked: true, usingMFA: false, roleName: 'ROLE_ATTORNEY', 
          permissions: 'CASE:VIEW,CASE:EDIT', roles: ['ROLE_ATTORNEY'] 
        },
        { 
          id: 2, firstName: 'Jane', lastName: 'Lawyer', email: 'jane.lawyer@firm.com', 
          enabled: true, notLocked: true, usingMFA: false, roleName: 'ROLE_SENIOR_ATTORNEY', 
          permissions: 'CASE:VIEW,CASE:EDIT,CASE:DELETE', roles: ['ROLE_SENIOR_ATTORNEY'] 
        }
      ];
      this.filteredAttorneys = [...this.attorneys];
    }
  }

  // Utility getters
  formatCaseType(caseType: string): string {
    return caseType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  formatRoleType(roleType: CaseRoleType): string {
    return roleType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  getUserDisplayName(user: User): string {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User';
  }

  getPriorityBadge(priority: string): string {
    const classes = {
      'LOW': 'bg-soft-info text-info',
      'MEDIUM': 'bg-soft-primary text-primary',
      'HIGH': 'bg-soft-warning text-warning',
      'URGENT': 'bg-soft-danger text-danger'
    };
    return classes[priority] || 'bg-soft-secondary text-secondary';
  }

  // Event Handlers
  onTabChange(tab: string): void {
    this.selectedTab = tab;
  }

  onCaseTypeChange(): void {
    this.filterCases();
  }

  onPriorityChange(): void {
    this.filterCases();
  }

  refreshData(): void {
    this.loadInitialData();
  }

  // === NEW METHODS FOR ENHANCED UI === //

  // Statistics and Analytics Methods
  getAssignmentRate(): number {
    if (this.cases.length === 0) return 0;
    const assignedCases = this.cases.filter(c => c.assignedAttorneys && c.assignedAttorneys.length > 0).length;
    return Math.round((assignedCases / this.cases.length) * 100);
  }

  getAverageWorkload(): number {
    if (this.attorneys.length === 0) return 0;
    const totalWorkload = this.attorneys.reduce((sum, attorney) => {
      // Simulate workload calculation based on assigned cases
      const assignedCases = this.cases.filter(c => 
        c.assignedAttorneys?.some(a => a.id === attorney.id)
      ).length;
      return sum + (assignedCases * 20); // Assume 20% per case
    }, 0);
    return Math.min(Math.round(totalWorkload / this.attorneys.length), 100);
  }

  getEfficiencyScore(): number {
    // Simulate efficiency calculation
    const assignmentRate = this.getAssignmentRate();
    const avgWorkload = this.getAverageWorkload();
    const balanceFactor = avgWorkload <= 80 ? 1 : 0.8; // Penalize overload
    return Math.round(assignmentRate * balanceFactor * 0.85);
  }

  getAssignedCases(): number {
    return this.cases.filter(c => c.assignedAttorneys && c.assignedAttorneys.length > 0).length;
  }

  getActiveAttorneys(): number {
    return this.attorneys.filter(attorney => 
      this.cases.some(c => c.assignedAttorneys?.some(a => a.id === attorney.id))
    ).length;
  }

  getAssignmentProgress(): number {
    if (this.assignments.length === 0) return 0;
    return Math.min(Math.round((this.assignments.length / this.cases.length) * 100), 100);
  }

  getLastUpdateTime(): string {
    return 'just now';
  }

  // TrackBy Functions for Performance
  trackByCaseId(index: number, caseItem: LegalCase): number {
    return caseItem.id;
  }

  trackByAttorneyId(index: number, attorney: User): number {
    return attorney.id;
  }

  trackByAssignmentId(index: number, assignment: CaseAssignment): number {
    return assignment.id;
  }

  // UI State Management
  error: string | null = null;
  successMessage: string | null = null;

  clearError(): void {
    this.error = null;
  }

  clearSuccess(): void {
    this.successMessage = null;
  }

  showSuccess(message: string): void {
    this.successMessage = message;
    setTimeout(() => this.clearSuccess(), 5000);
  }

  showError(message: string): void {
    this.error = message;
    setTimeout(() => this.clearError(), 5000);
  }

  // Enhanced Case Management
  isManager(): boolean {
    // Implement manager check logic
    return true; // Simplified for now
  }

  // Enhanced Assignment Logic
  getRecommendedAttorneys(caseItem: LegalCase): User[] {
    return this.attorneys
      .filter(attorney => {
        // Filter based on workload and expertise
        const currentWorkload = this.calculateAttorneyWorkload(attorney);
        return currentWorkload < 80; // Less than 80% capacity
      })
      .sort((a, b) => {
        // Sort by expertise and availability
        const aWorkload = this.calculateAttorneyWorkload(a);
        const bWorkload = this.calculateAttorneyWorkload(b);
        return aWorkload - bWorkload;
      })
      .slice(0, 5); // Top 5 recommendations
  }

  private calculateAttorneyWorkload(attorney: User): number {
    const assignedCases = this.cases.filter(c => 
      c.assignedAttorneys?.some(a => a.id === attorney.id)
    ).length;
    return Math.min(assignedCases * 20, 100); // 20% per case, max 100%
  }

  // Case Type Intelligence
  getCaseTypeExpertise(attorney: User, caseType: string): number {
    // Simulate expertise calculation based on case history
    const relevantCases = this.cases.filter(c => 
      c.caseType === caseType && 
      c.assignedAttorneys?.some(a => a.id === attorney.id)
    ).length;
    return Math.min(relevantCases * 10, 100); // 10 points per case, max 100
  }

  // Enhanced Filtering
  getFilteredCasesByType(caseType: string): LegalCase[] {
    return this.cases.filter(c => c.caseType === caseType);
  }

  getFilteredCasesByPriority(priority: string): LegalCase[] {
    return this.cases.filter(c => c.priority === priority);
  }

  // Workload Analysis
  getAttorneyWorkloadSummary(attorney: User): any {
    const assignedCases = this.cases.filter(c => 
      c.assignedAttorneys?.some(a => a.id === attorney.id)
    );
    
    return {
      totalCases: assignedCases.length,
      workloadPercentage: this.calculateAttorneyWorkload(attorney),
      caseTypes: [...new Set(assignedCases.map(c => c.caseType))],
      priorityCases: assignedCases.filter(c => c.priority === 'HIGH' || c.priority === 'URGENT').length
    };
  }

  // Enhanced Case Assignment with Intelligence
  getSmartAssignmentSuggestion(caseItem: LegalCase): User | null {
    const recommendations = this.getRecommendedAttorneys(caseItem);
    if (recommendations.length === 0) return null;

    // Find best match based on expertise and workload
    return recommendations.reduce((best, current) => {
      const bestExpertise = this.getCaseTypeExpertise(best, caseItem.caseType);
      const currentExpertise = this.getCaseTypeExpertise(current, caseItem.caseType);
      
      if (currentExpertise > bestExpertise) return current;
      if (currentExpertise === bestExpertise) {
        // If expertise is equal, prefer lower workload
        const bestWorkload = this.calculateAttorneyWorkload(best);
        const currentWorkload = this.calculateAttorneyWorkload(current);
        return currentWorkload < bestWorkload ? current : best;
      }
      return best;
    });
  }
}
