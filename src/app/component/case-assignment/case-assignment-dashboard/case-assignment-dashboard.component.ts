import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, NgZone, ApplicationRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { catchError, finalize, filter, take } from 'rxjs/operators';
import { JwtHelperService } from '@auth0/angular-jwt';
import { Key } from '../../../enum/key.enum';
import { CaseAssignmentService } from '../../../service/case-assignment.service';
import { UserService } from '../../../service/user.service';
import { CaseClientService } from '../../../service/case-client.service';
import { NotificationService } from '../../../service/notification.service';
import { LegalCaseService } from '../../../modules/legal/services/legal-case.service';
import { CaseContextService } from '../../../core/services/case-context.service';
import { NavigationContextService } from '../../../core/services/navigation-context.service';
import { CasePermissionsService } from '../../../core/services/case-permissions.service';
import { AssignmentRulesService } from '../../../core/services/assignment-rules.service';
import { TaskAnalyticsService } from '../../../core/services/task-analytics.service';
import { PerformanceDashboardService, ExecutiveSummary } from '../../../core/services/performance-dashboard.service';
import { AssignmentSyncService } from '../../../core/services/assignment-sync.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { 
  CaseAssignment, 
  CaseAssignmentRequest,
  UserWorkload, 
  WorkloadAnalytics,
  CaseTransferRequestDTO,
  TransferStatus,
  TransferUrgency,
  CaseRoleType,
  AssignmentType,
  WorkloadStatus,
  AssignmentRule,
  AssignmentRecommendation,
  AssignmentHistory
} from '../../../interface/case-assignment';
import { User } from '../../../interface/user';

interface AssignedAttorneyInfo {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  roleType?: CaseRoleType;
  workloadWeight?: number;
  assignmentId?: number;
}

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
  assignedAttorneys?: AssignedAttorneyInfo[];
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
  selector: 'app-case-assignment-dashboard',
  templateUrl: './case-assignment-dashboard.component.html',
  styleUrls: ['./case-assignment-dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CaseAssignmentDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Core Data
  cases: LegalCase[] = [];
  filteredCases: LegalCase[] = [];
  attorneys: User[] = [];
  assignments: CaseAssignment[] = [];
  myAssignments: CaseAssignment[] = [];
  workloadData: UserWorkload[] = [];
  analytics: WorkloadAnalytics | null = null;
  pendingTransfers: CaseTransferRequestDTO[] = [];
  assignmentHistory: AssignmentHistory[] = [];
  assignmentRules: AssignmentRule[] = [];
  currentUserId: number = 0;
  
  // Context integration properties
  caseMode: boolean = false;
  currentCase: any | null = null;
  currentCaseId: number | null = null;
  contextLoaded: boolean = false;
  availableTeamMembers: any[] = [];
  userCaseRole: string | null = null;
  canManageAssignments$ = this.casePermissionsService.canManageAssignments();
  permissionLevel$ = this.casePermissionsService.getPermissionLevel();
  executiveSummary: ExecutiveSummary | null = null;
  caseHealthScore: any = null;
  
  // Breadcrumb items
  breadCrumbItems: Array<{}> = [];
  
  // Selected Items
  selectedCase: LegalCase | null = null;
  selectedAttorney: User | null = null;
  
  // UI State
  searchTerm = '';
  attorneySearchTerm = '';
  selectedTab = 'my-assignments';
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
  
  // Pagination
  pagination = {
    cases: { page: 0, size: 10, total: 0 },
    assignments: { page: 0, size: 10, total: 0 },
    history: { page: 0, size: 10, total: 0 }
  };

  private jwtHelper = new JwtHelperService();

  constructor(
    private caseAssignmentService: CaseAssignmentService,
    private userService: UserService,
    private caseClientService: CaseClientService,
    private notificationService: NotificationService,
    private formBuilder: FormBuilder,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private caseContextService: CaseContextService,
    private navigationContextService: NavigationContextService,
    private casePermissionsService: CasePermissionsService,
    private assignmentRulesService: AssignmentRulesService,
    private taskAnalyticsService: TaskAnalyticsService,
    private performanceDashboard: PerformanceDashboardService,
    private assignmentSyncService: AssignmentSyncService,
    private webSocketService: WebSocketService,
    private legalCaseService: LegalCaseService,
    private ngZone: NgZone,
    private appRef: ApplicationRef
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    // Initialize breadcrumbs
    this.breadCrumbItems = [
      { label: 'Case Management' },
      { label: 'Assignments', active: true }
    ];

    // Get current user ID - try multiple methods
    this.currentUserId = this.resolveCurrentUserId();

    // Determine context mode from route
    const caseId = this.route.snapshot.params['caseId'] || this.route.snapshot.queryParams['caseId'];

    if (caseId) {
      // Case-specific mode
      this.caseMode = true;
      this.currentCaseId = +caseId;
      this.initializeCaseMode(this.currentCaseId);
    } else {
      // All assignments mode
      this.caseMode = false;

      // If we have user ID, load data immediately
      if (this.currentUserId) {
        this.initializeAllAssignmentsMode();
      } else {
        // Wait for user data before loading
        this.userService.userData$.pipe(
          takeUntil(this.destroy$),
          filter(user => user !== null),
          take(1)
        ).subscribe(user => {
          if (user) {
            this.currentUserId = user.id;
            this.initializeAllAssignmentsMode();
          }
        });
      }
    }

    // Subscribe to user data changes for future updates
    this.userService.userData$.pipe(
      takeUntil(this.destroy$),
      filter(user => user !== null)
    ).subscribe(user => {
      if (user && user.id && user.id !== this.currentUserId) {
        const previousUserId = this.currentUserId;
        this.currentUserId = user.id;
        // Reload my assignments if user changes (and we had a previous ID)
        if (previousUserId) {
          this.loadMyAssignments();
        }
      }
    });

    // Subscribe to context updates
    this.subscribeToContextUpdates();

    // Subscribe to WebSocket updates for real-time assignment changes
    this.subscribeToWebSocketUpdates();
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

  /**
   * Initialize case-specific mode with context
   */
  private initializeCaseMode(caseId: number): void {
    // Check if case context already exists
    const currentCase = this.caseContextService.getCurrentCaseSnapshot();

    if (currentCase && currentCase.id === caseId) {
      this.loadFromContext();
      return;
    }

    // Load case context if not available
    this.caseContextService.syncWithBackend(caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadFromContext();
        },
        error: (error) => {
          console.error('Failed to load context:', error);
          this.handleContextLoadError(error);
        }
      });
  }
  
  /**
   * Initialize all assignments mode
   */
  private initializeAllAssignmentsMode(): void {
    // Clear any existing case context
    this.currentCase = null;
    this.availableTeamMembers = [];
    this.userCaseRole = null;

    // Load all data
    this.loadInitialData();
  }
  
  /**
   * Load data from existing context
   */
  private loadFromContext(): void {
    // Set case data
    this.currentCase = this.caseContextService.getCurrentCaseSnapshot();
    this.availableTeamMembers = this.caseContextService.getCaseTeamSnapshot();
    
    // Update forms with case ID
    if (this.currentCase) {
      this.assignmentForm.patchValue({ caseId: this.currentCase.id });
      this.transferForm.patchValue({ caseId: this.currentCase.id });
    }
    
    // Load assignments from context or refresh
    this.loadCaseSpecificData();
    this.contextLoaded = true;
    this.updateBreadcrumbs();
    this.cdr.detectChanges();
  }
  
  /**
   * Subscribe to context updates for real-time sync
   */
  private subscribeToContextUpdates(): void {
    if (!this.caseMode) return;
    
    // Subscribe to case updates
    this.caseContextService.getCurrentCase()
      .pipe(
        filter(caseData => caseData !== null && caseData.id === this.currentCaseId),
        takeUntil(this.destroy$)
      )
      .subscribe(caseData => {
        this.currentCase = caseData;
        this.updateBreadcrumbs();
        this.cdr.detectChanges();
      });
    
    // Subscribe to team updates
    this.caseContextService.getCaseTeam()
      .pipe(takeUntil(this.destroy$))
      .subscribe(team => {
        this.availableTeamMembers = team;
        this.attorneys = team.map(member => ({
          id: member.userId,
          firstName: member.userName.split(' ')[0] || '',
          lastName: member.userName.split(' ').slice(1).join(' ') || '',
          email: member.userEmail,
          roleName: member.roleType
        } as User));
        this.cdr.detectChanges();
      });
    
    // Subscribe to user role in case
    this.caseContextService.getUserCaseRole()
      .pipe(takeUntil(this.destroy$))
      .subscribe(role => {
        this.userCaseRole = role;
        this.cdr.detectChanges();
      });
    
    // Subscribe to component notifications
    this.caseContextService.getComponentNotifications()
      .pipe(takeUntil(this.destroy$))
      .subscribe(notification => {
        if (notification) {
          this.handleContextNotification(notification);
        }
      });
  }
  
  /**
   * Handle context notifications
   */
  private handleContextNotification(notification: any): void {
    switch (notification.type) {
      case 'ASSIGNMENT_ADDED':
      case 'ASSIGNMENT_UPDATED':
        this.notificationService.onSuccess('Assignment updated');
        this.loadCaseSpecificData();
        break;
      case 'MEMBER_ADDED':
        this.notificationService.onInfo('Team member added to case');
        break;
      case 'MEMBER_REMOVED':
        this.notificationService.onInfo('Team member removed from case');
        break;
    }
  }
  
  /**
   * Update breadcrumbs based on context
   */
  private updateBreadcrumbs(): void {
    if (this.caseMode && this.currentCase) {
      this.breadCrumbItems = [
        { label: 'Cases' },
        { label: `Case #${this.currentCase.caseNumber}` },
        { label: 'Assignments', active: true }
      ];
    } else {
      this.breadCrumbItems = [
        { label: 'Case Management' },
        { label: 'All Assignments', active: true }
      ];
    }
  }
  
  /**
   * Handle context load errors
   */
  private handleContextLoadError(error: any): void {
    if (error.status === 404) {
      this.notificationService.onError('Case not found');
    } else if (error.status === 403) {
      this.notificationService.onError('Access denied to this case');
    } else {
      this.notificationService.onError('Failed to load case data');
    }
    
    // Fallback to all assignments mode
    this.initializeAllAssignmentsMode();
  }
  
  /**
   * Load case-specific assignment data
   */
  private loadCaseSpecificData(): void {
    if (!this.currentCaseId) return;
    
    this.loading.assignments = true;
    
    this.caseAssignmentService.getCaseAssignments(this.currentCaseId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading.assignments = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          this.assignments = response.data || [];
          this.loadAssignmentHistory();
        },
        error: (error) => {
          console.error('Error loading case assignments:', error);
          this.assignments = [];
        }
      });
  }

  private loadInitialData(): void {
    this.loading.cases = true;
    this.loading.attorneys = true;
    this.loading.assignments = true;

    forkJoin({
      cases: this.legalCaseService.getAllCases(0, 1000).pipe(
        catchError(error => {
          console.error('Error loading cases:', error);
          return of({ data: { cases: { content: [] } } });
        })
      ),
      attorneys: this.userService.getUsers().pipe(
        catchError(error => {
          console.error('Error loading attorneys:', error);
          return of({ data: [] });
        })
      ),
      // Get ALL assignments for the "All Assignments" tab (managers)
      allAssignments: this.caseAssignmentService.getAllAssignments(0, 1000).pipe(
        catchError(error => {
          console.error('Error loading all assignments:', error);
          return of({ data: [] });
        })
      ),
      // Get current user's assignments for "My Assignments" tab
      myAssignments: this.currentUserId ?
        this.caseAssignmentService.getUserAssignments(this.currentUserId, 0, 100).pipe(
          catchError(error => {
            console.error('Error loading my assignments:', error);
            return of({ data: [] });
          })
        ) : of({ data: [] }),
      workload: this.caseAssignmentService.getWorkloadAnalytics().pipe(
        catchError(error => {
          console.error('Error loading workload:', error);
          return of({ data: null });
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
        this.processAllAssignmentsData(response.allAssignments);
        this.processMyAssignmentsData(response.myAssignments);

        // Fallback: If myAssignments is empty but we have a userId, filter from allAssignments
        if (this.myAssignments.length === 0 && this.currentUserId && this.assignments.length > 0) {
          this.myAssignments = this.assignments.filter(a => a.userId === this.currentUserId);
        }

        this.processWorkloadData(response.workload);
        this.calculateStatistics();
        this.loadAdditionalData();
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error in loadInitialData:', error);
        this.notificationService.onError('Failed to load initial data');
      }
    });
  }

  private processCasesData(response: any): void {
    // Handle multiple possible response formats from legalCaseService.getAllCases()
    let casesArray: any[] = [];

    if (response?.data?.cases?.content) {
      // Format: { data: { cases: { content: [...] } } }
      casesArray = response.data.cases.content;
    } else if (response?.data?.content) {
      // Format: { data: { content: [...] } }
      casesArray = response.data.content;
    } else if (response?.data?.cases && Array.isArray(response.data.cases)) {
      // Format: { data: { cases: [...] } }
      casesArray = response.data.cases;
    } else if (Array.isArray(response?.data)) {
      // Format: { data: [...] }
      casesArray = response.data;
    } else if (Array.isArray(response)) {
      // Format: [...] (direct array)
      casesArray = response;
    }

    this.cases = casesArray.map((caseItem: any) => ({
      ...caseItem,
      caseType: caseItem.caseType || this.inferCaseType(caseItem.title),
      priority: caseItem.priority || 'MEDIUM',
      estimatedWorkload: caseItem.estimatedWorkload || this.calculateEstimatedWorkload(caseItem)
    }));

    this.filteredCases = [...this.cases];
    this.pagination.cases.total = this.cases.length;
  }

  private processAttorneysData(response: any): void {
    // Backend returns { data: { users: [...] } } from /user/list endpoint
    let usersArray: any[] = [];

    if (response?.data?.users && Array.isArray(response.data.users)) {
      usersArray = response.data.users;
    } else if (Array.isArray(response?.data)) {
      usersArray = response.data;
    } else if (response?.data?.content && Array.isArray(response.data.content)) {
      usersArray = response.data.content;
    }

    // Filter for attorneys/lawyers
    this.attorneys = usersArray.filter(user => {
      const roleName = user.roleName?.toLowerCase() || '';
      const roles = user.roles?.map((role: string) => role.toLowerCase()) || [];
      return roleName.includes('attorney') ||
             roleName.includes('lawyer') ||
             roleName.includes('legal') ||
             roleName.includes('admin') ||
             roles.some((role: string) =>
               role.includes('attorney') ||
               role.includes('lawyer') ||
               role.includes('legal') ||
               role.includes('admin')
             );
    });

    // If no attorneys found after filtering, include all users
    if (this.attorneys.length === 0 && usersArray.length > 0) {
      this.attorneys = usersArray;
    }
  }

  private processAllAssignmentsData(response: any): void {
    // Handle multiple possible response formats from getAllAssignments
    let assignmentsArray: any[] = [];

    if (response?.data?.content) {
      // Paginated format: { data: { content: [...] } }
      assignmentsArray = response.data.content;
    } else if (response?.data?.assignments?.content) {
      // Nested paginated: { data: { assignments: { content: [...] } } }
      assignmentsArray = response.data.assignments.content;
    } else if (response?.data?.assignments && Array.isArray(response.data.assignments)) {
      // Nested array: { data: { assignments: [...] } }
      assignmentsArray = response.data.assignments;
    } else if (Array.isArray(response?.data)) {
      // Direct array format: { data: [...] }
      assignmentsArray = response.data;
    }

    this.assignments = assignmentsArray;
    this.pagination.assignments.total = this.assignments.length;
  }

  private processMyAssignmentsData(response: any): void {
    // Handle multiple possible response formats from getUserAssignments
    let assignmentsArray: any[] = [];

    if (response?.data?.content) {
      // Paginated format: { data: { content: [...] } }
      assignmentsArray = response.data.content;
    } else if (response?.data?.assignments?.content) {
      // Nested paginated: { data: { assignments: { content: [...] } } }
      assignmentsArray = response.data.assignments.content;
    } else if (response?.data?.assignments && Array.isArray(response.data.assignments)) {
      // Nested array: { data: { assignments: [...] } }
      assignmentsArray = response.data.assignments;
    } else if (Array.isArray(response?.data)) {
      // Direct array format: { data: [...] }
      assignmentsArray = response.data;
    }

    this.myAssignments = assignmentsArray;
  }

  private processWorkloadData(response: any): void {
    this.analytics = response?.data || null;
    this.loadWorkloadData();
  }

  private loadAdditionalData(): void {
    // Note: My assignments are already loaded in loadInitialData
    this.loadPendingTransfers();
    this.loadAssignmentHistory();
    this.loadAssignmentRules();
    // Load workload data for Team and Workload tabs
    this.loadWorkloadData();
  }

  private loadWorkloadData(): void {
    if (this.attorneys.length === 0) {
      this.workloadData = [];
      this.loading.workload = false;
      this.cdr.markForCheck();
      return;
    }

    this.loading.workload = true;

    const workloadRequests = this.attorneys.map(attorney =>
      this.caseAssignmentService.calculateUserWorkload(attorney.id).pipe(
        catchError(() => of({ data: this.generateSampleWorkload(attorney) }))
      )
    );

    forkJoin(workloadRequests).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.loading.workload = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (responses) => {
        this.workloadData = responses.map(response => response.data);
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error loading workload data:', error);
        this.workloadData = this.attorneys.map(attorney => this.generateSampleWorkload(attorney));
        this.cdr.markForCheck();
      }
    });
  }

  private loadPendingTransfers(): void {
    this.caseAssignmentService.getPendingTransferRequests().pipe(
      takeUntil(this.destroy$),
      catchError(() => of({ data: [] }))
    ).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          const data = response.data;
          this.pendingTransfers = Array.isArray(data) ? data : [];
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.pendingTransfers = [];
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      }
    });
  }

  private loadAssignmentHistory(): void {
    if (this.selectedCase) {
      this.caseAssignmentService.getAssignmentHistory(this.selectedCase.id, 0, 50).pipe(
        takeUntil(this.destroy$),
        catchError(() => of({ data: [] }))
      ).subscribe({
        next: (response) => {
          this.assignmentHistory = response.data || [];
          this.pagination.history.total = this.assignmentHistory.length;
        },
        error: (error) => {
          console.error('Error loading assignment history:', error);
          this.assignmentHistory = [];
        }
      });
    } else {
      this.assignmentHistory = [];
    }
  }

  private loadAssignmentRules(): void {
    this.caseAssignmentService.getActiveRules().pipe(
      takeUntil(this.destroy$),
      catchError(() => of({ data: [] }))
    ).subscribe({
      next: (response) => {
        this.assignmentRules = response.data || [];
      },
      error: (error) => {
        console.error('Error loading assignment rules:', error);
        this.assignmentRules = [];
      }
    });
  }

  // Case Selection and Filtering
  selectCase(caseItem: LegalCase): void {
    this.selectedCase = caseItem;
    this.assignmentForm.patchValue({ caseId: caseItem.id });
    this.loadCaseAssignments(caseItem.id);
    this.getAssignmentRecommendations(caseItem.id);
    // Force change detection for OnPush
    this.cdr.detectChanges();
  }

  selectAttorney(attorney: User): void {
    this.selectedAttorney = attorney;
    this.assignmentForm.patchValue({ userId: attorney.id });
    // Force change detection for OnPush
    this.cdr.detectChanges();
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
    this.pagination.cases.total = filtered.length;
    this.cdr.markForCheck();
  }

  filterAttorneys(): User[] {
    let filtered = [...this.attorneys];
    
    if (this.attorneySearchTerm.trim()) {
      const term = this.attorneySearchTerm.toLowerCase();
      filtered = filtered.filter(attorney => 
        attorney.firstName?.toLowerCase().includes(term) ||
        attorney.lastName?.toLowerCase().includes(term) ||
        attorney.email?.toLowerCase().includes(term)
      );
    }
    
    if (this.selectedWorkloadFilter) {
      const workloadFilter = this.selectedWorkloadFilter;
      filtered = filtered.filter(attorney => {
        const workload = this.getAttorneyWorkload(attorney.id);
        return workload?.workloadStatus === workloadFilter;
      });
    }
    
    return filtered;
  }

  // Assignment Management
  assignCase(): void {
    if (this.assignmentForm.invalid) {
      this.notificationService.onError('Please fill in all required fields');
      return;
    }

    this.loading.assigning = true;
    const formData = this.assignmentForm.value;

    const request: CaseAssignmentRequest = {
      caseId: formData.caseId,
      userId: formData.userId,
      roleType: formData.roleType,
      effectiveFrom: formData.effectiveFrom,
      effectiveTo: formData.effectiveTo,
      workloadWeight: formData.workloadWeight,
      notes: formData.notes
    };

    // Call CaseAssignmentService directly
    this.caseAssignmentService.assignCase(request).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.loading.assigning = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (response) => {
        const assignment = response.data;

        // Show SweetAlert success (same as remove assignment)
        import('sweetalert2').then(Swal => {
          Swal.default.fire({
            icon: 'success',
            title: 'Assigned',
            text: 'Attorney assigned to case successfully',
            timer: 2000,
            showConfirmButton: false
          });
        });

        // Add to assignments list (create new array for OnPush)
        this.assignments = [...this.assignments, assignment];

        // Update the selected case's assigned attorneys immediately
        if (this.selectedCase && this.selectedCase.id === request.caseId) {
          const assignedAttorney = this.attorneys.find(a => a.id === request.userId);
          if (assignedAttorney) {
            const currentAttorneys = this.selectedCase.assignedAttorneys || [];
            // Check if not already in the list
            const alreadyAssigned = currentAttorneys.some(a => a.id === assignedAttorney.id);
            if (!alreadyAssigned) {
              const newAttorney: AssignedAttorneyInfo = {
                id: assignedAttorney.id,
                firstName: assignedAttorney.firstName,
                lastName: assignedAttorney.lastName,
                email: assignedAttorney.email,
                roleType: request.roleType,
                workloadWeight: request.workloadWeight,
                assignmentId: assignment?.id
              };
              // Create new object reference for OnPush change detection
              this.selectedCase = {
                ...this.selectedCase,
                assignedAttorneys: [...currentAttorneys, newAttorney]
              };
            }
          }
        }

        // Reset form and clear selected attorney (but keep case selected)
        this.assignmentForm.patchValue({
          userId: null,
          roleType: 'LEAD_ATTORNEY',
          workloadWeight: 50
        });
        this.selectedAttorney = null;

        // Force UI update
        this.cdr.markForCheck();

        // Note: Notifications are handled by the backend to avoid duplicates

        // Update context if in case mode
        if (this.caseMode && this.currentCaseId) {
          this.caseContextService.syncWithBackend(this.currentCaseId).subscribe();
        }

        this.loadWorkloadData();
      },
      error: (error) => {
        console.error('Error assigning case:', error);
        this.notificationService.onError(error?.error?.message || 'Failed to assign case');
      }
    });
  }

  approveTransfer(transfer: CaseTransferRequestDTO): void {
    import('sweetalert2').then(Swal => {
      Swal.default.fire({
        title: 'Approve Transfer',
        text: `Approve transfer of case "${transfer.caseTitle}" from ${transfer.fromUserName} to ${transfer.toUserName}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Approve',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#28a745',
        input: 'textarea',
        inputPlaceholder: 'Add notes (optional)',
        inputAttributes: {
          'aria-label': 'Notes'
        }
      }).then((result) => {
        if (result.isConfirmed) {
          this.caseAssignmentService.approveTransfer(transfer.id, result.value || '').pipe(
            takeUntil(this.destroy$)
          ).subscribe({
            next: () => {
              this.notificationService.onSuccess('Transfer approved successfully');
              this.pendingTransfers = this.pendingTransfers.filter(t => t.id !== transfer.id);
              this.loadInitialData(); // Refresh assignments
              this.cdr.markForCheck();
            },
            error: (error) => {
              console.error('Error approving transfer:', error);
              this.notificationService.onError('Failed to approve transfer');
            }
          });
        }
      });
    });
  }

  rejectTransfer(transfer: CaseTransferRequestDTO): void {
    import('sweetalert2').then(Swal => {
      Swal.default.fire({
        title: 'Reject Transfer',
        text: `Reject transfer request for case "${transfer.caseTitle}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Reject',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc3545',
        input: 'textarea',
        inputPlaceholder: 'Reason for rejection',
        inputAttributes: {
          'aria-label': 'Reason'
        },
        inputValidator: (value) => {
          if (!value) {
            return 'Please provide a reason for rejection';
          }
          return null;
        }
      }).then((result) => {
        if (result.isConfirmed) {
          this.caseAssignmentService.rejectTransfer(transfer.id, result.value).pipe(
            takeUntil(this.destroy$)
          ).subscribe({
            next: () => {
              this.notificationService.onSuccess('Transfer rejected');
              this.pendingTransfers = this.pendingTransfers.filter(t => t.id !== transfer.id);
              this.cdr.markForCheck();
            },
            error: (error) => {
              console.error('Error rejecting transfer:', error);
              this.notificationService.onError('Failed to reject transfer');
            }
          });
        }
      });
    });
  }

  transferCase(): void {
    if (this.transferForm.invalid) {
      this.notificationService.onError('Please fill in all required fields');
      return;
    }

    this.loading.transferring = true;
    const formData = this.transferForm.value;

    const transferRequest = {
      caseId: formData.caseId,
      fromUserId: formData.fromUserId,
      toUserId: formData.toUserId,
      reason: formData.reason,
      urgency: formData.urgency as TransferUrgency,
      notes: formData.notes
    };

    // Use AssignmentSyncService for case reassignment
    this.assignmentSyncService.reassignCase(
      transferRequest.caseId,
      transferRequest.fromUserId,
      transferRequest.toUserId,
      transferRequest.reason
    ).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.loading.transferring = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (syncResult) => {
        if (syncResult.success) {
          this.notificationService.onSuccess('Transfer initiated successfully');
          this.transferForm.reset();

          // Reload all data to show updated state
          this.ngZone.run(() => {
            // Load pending transfers first, then other data
            this.caseAssignmentService.getPendingTransferRequests().subscribe({
              next: (response) => {
                const data = response.data;
                this.pendingTransfers = Array.isArray(data) ? data : [];
                this.cdr.detectChanges();
              }
            });

            // Update assignments
            if (this.caseMode && this.currentCaseId) {
              this.caseContextService.syncWithBackend(this.currentCaseId).subscribe(() => {
                this.cdr.detectChanges();
              });
            }

            // Reload assignments list
            this.caseAssignmentService.getAllAssignments(0, 1000).subscribe({
              next: (response) => {
                this.assignments = response.data || [];
                this.cdr.detectChanges();
              }
            });
          });
        } else {
          this.notificationService.onError(syncResult.error || 'Failed to transfer case');
        }
      },
      error: (error) => {
        console.error('Error transferring case:', error);
        this.notificationService.onError('Failed to transfer case');
      }
    });
  }

  removeAssignment(assignment: CaseAssignment): void {
    import('sweetalert2').then(Swal => {
      Swal.default.fire({
        title: 'Remove Assignment',
        text: `Are you sure you want to remove ${assignment.userName} from "${assignment.caseTitle || 'this case'}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, Remove',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d'
      }).then((result) => {
        if (result.isConfirmed) {
          this.performRemoveAssignment(assignment);
        }
      });
    });
  }

  private performRemoveAssignment(assignment: CaseAssignment): void {
    // Use AssignmentSyncService for unassignment
    this.assignmentSyncService.unassignUserFromCase(
      assignment.caseId,
      assignment.userId,
      'Manual removal via assignment dashboard',
      assignment.caseTitle,
      assignment.caseNumber
    ).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (syncResult) => {
        if (syncResult.success) {
          // Show SweetAlert success
          import('sweetalert2').then(Swal => {
            Swal.default.fire({
              icon: 'success',
              title: 'Removed',
              text: 'Assignment removed successfully',
              timer: 2000,
              showConfirmButton: false
            });
          });

          this.assignments = this.assignments.filter(a => a.id !== assignment.id);
          this.myAssignments = this.myAssignments.filter(a => a.id !== assignment.id);
          this.cdr.markForCheck();

          // Note: Audit logging is handled by the backend

          // Update context if in case mode
          if (this.caseMode && this.currentCaseId) {
            this.caseContextService.syncWithBackend(this.currentCaseId).subscribe();
          }

          this.loadWorkloadData();
        } else {
          this.notificationService.onError(syncResult.error || 'Failed to remove assignment');
        }
      },
      error: (error) => {
        console.error('Error removing assignment:', error);
        this.notificationService.onError('Failed to remove assignment');
      }
    });
  }

  /**
   * Unassign attorney from selected case (from Selected Case card)
   */
  unassignFromSelectedCase(attorney: AssignedAttorneyInfo): void {
    if (!this.selectedCase) {
      this.notificationService.onError('No case selected');
      return;
    }

    import('sweetalert2').then(Swal => {
      Swal.default.fire({
        title: 'Remove Assignment',
        text: `Are you sure you want to remove ${attorney.firstName} ${attorney.lastName} from this case?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, Remove',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d'
      }).then((result) => {
        if (result.isConfirmed) {
          this.performUnassignFromSelectedCase(attorney);
        }
      });
    });
  }

  private performUnassignFromSelectedCase(attorney: AssignedAttorneyInfo): void {
    if (!this.selectedCase) return;

    this.assignmentSyncService.unassignUserFromCase(
      this.selectedCase.id,
      attorney.id,
      'Manual removal via assignment dashboard',
      this.selectedCase.title,
      this.selectedCase.caseNumber
    ).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (syncResult) => {
        if (syncResult.success) {
          this.notificationService.onSuccess(`${attorney.firstName} ${attorney.lastName} removed from case`);

          // Update selected case's assigned attorneys
          if (this.selectedCase) {
            this.selectedCase.assignedAttorneys = this.selectedCase.assignedAttorneys?.filter(
              a => a.id !== attorney.id
            ) || [];
          }

          // Update assignments list
          this.assignments = this.assignments.filter(
            a => !(a.caseId === this.selectedCase?.id && a.userId === attorney.id)
          );

          this.cdr.detectChanges();
          this.loadWorkloadData();
        } else {
          this.notificationService.onError(syncResult.error || 'Failed to remove assignment');
        }
      },
      error: (error) => {
        console.error('Error removing assignment:', error);
        this.notificationService.onError('Failed to remove assignment');
      }
    });
  }

  /**
   * Transfer assignment from selected case (from Selected Case card)
   */
  transferFromSelectedCase(attorney: AssignedAttorneyInfo): void {
    if (!this.selectedCase) {
      this.notificationService.onError('No case selected');
      return;
    }

    // Get available attorneys for transfer (exclude the current attorney)
    const availableAttorneys = this.attorneys.filter(a => a.id !== attorney.id);

    if (availableAttorneys.length === 0) {
      this.notificationService.onWarning('No other attorneys available for transfer');
      return;
    }

    // Create options object for the select dropdown
    const attorneyOptions: { [key: string]: string } = {};
    availableAttorneys.forEach(a => {
      const workload = this.getAttorneyWorkload(a.id);
      const workloadStr = workload ? ` (${workload.capacityPercentage}% workload)` : '';
      attorneyOptions[a.id.toString()] = `${a.firstName} ${a.lastName}${workloadStr}`;
    });

    import('sweetalert2').then(Swal => {
      Swal.default.fire({
        title: 'Transfer Assignment',
        html: `<p>Transfer <strong>${attorney.firstName} ${attorney.lastName}</strong>'s assignment to:</p>`,
        input: 'select',
        inputOptions: attorneyOptions,
        inputPlaceholder: 'Select an attorney',
        showCancelButton: true,
        confirmButtonText: 'Transfer',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#405189',
        inputValidator: (value) => {
          if (!value) {
            return 'Please select an attorney';
          }
          return null;
        }
      }).then((result) => {
        if (result.isConfirmed && result.value) {
          const newAttorneyId = parseInt(result.value);
          const newAttorney = availableAttorneys.find(a => a.id === newAttorneyId);
          if (newAttorney) {
            this.performTransferFromSelectedCase(attorney, newAttorney);
          }
        }
      });
    });
  }

  private performTransferFromSelectedCase(fromAttorney: AssignedAttorneyInfo, toAttorney: User): void {
    if (!this.selectedCase) return;

    this.assignmentSyncService.reassignCase(
      this.selectedCase.id,
      fromAttorney.id,
      toAttorney.id,
      'Assignment transferred via dashboard',
      this.selectedCase.title,
      this.selectedCase.caseNumber
    ).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (syncResult) => {
        if (syncResult.success) {
          this.notificationService.onSuccess(
            `Assignment transferred from ${fromAttorney.firstName} ${fromAttorney.lastName} to ${toAttorney.firstName} ${toAttorney.lastName}`
          );

          // Update selected case's assigned attorneys
          if (this.selectedCase && this.selectedCase.assignedAttorneys) {
            const index = this.selectedCase.assignedAttorneys.findIndex(a => a.id === fromAttorney.id);
            if (index > -1) {
              this.selectedCase.assignedAttorneys[index] = {
                id: toAttorney.id,
                firstName: toAttorney.firstName,
                lastName: toAttorney.lastName,
                email: toAttorney.email,
                roleType: fromAttorney.roleType,
                workloadWeight: fromAttorney.workloadWeight,
                assignmentId: fromAttorney.assignmentId
              };
            }
          }

          // Update assignments list
          const assignmentIndex = this.assignments.findIndex(
            a => a.caseId === this.selectedCase?.id && a.userId === fromAttorney.id
          );
          if (assignmentIndex > -1) {
            this.assignments[assignmentIndex].userId = toAttorney.id;
            this.assignments[assignmentIndex].userName = `${toAttorney.firstName} ${toAttorney.lastName}`;
            this.assignments[assignmentIndex].userEmail = toAttorney.email;
          }

          this.cdr.detectChanges();
          this.loadWorkloadData();
        } else {
          this.notificationService.onError(syncResult.error || 'Failed to transfer assignment');
        }
      },
      error: (error) => {
        console.error('Error transferring assignment:', error);
        this.notificationService.onError('Failed to transfer assignment');
      }
    });
  }

  // Utility Methods
  private loadCaseAssignments(caseId: number): void {
    this.caseAssignmentService.getCaseAssignments(caseId).pipe(
      takeUntil(this.destroy$),
      catchError(() => of({ data: [] }))
    ).subscribe({
      next: (response) => {
        if (this.selectedCase) {
          this.selectedCase.assignedAttorneys = response.data.map((assignment: CaseAssignment) => {
            const attorney = this.attorneys.find(a => a.id === assignment.userId);
            if (attorney) {
              return {
                id: attorney.id,
                firstName: attorney.firstName,
                lastName: attorney.lastName,
                email: attorney.email,
                roleType: assignment.roleType,
                workloadWeight: assignment.workloadWeight,
                assignmentId: assignment.id
              } as AssignedAttorneyInfo;
            }
            return null;
          }).filter(Boolean) as AssignedAttorneyInfo[];
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        console.error('Error loading case assignments:', error);
      }
    });
  }

  private getAssignmentRecommendations(caseId: number): void {
    // Get assignment recommendations for case
  }

  private calculateStatistics(): void {
    const caseTypeMap = new Map<string, { count: number, totalWorkload: number, attorneys: Set<string> }>();
    
    this.cases.forEach(caseItem => {
      const type = caseItem.caseType;
      if (!caseTypeMap.has(type)) {
        caseTypeMap.set(type, { count: 0, totalWorkload: 0, attorneys: new Set() });
      }
      const stats = caseTypeMap.get(type)!;
      stats.count++;
      stats.totalWorkload += caseItem.estimatedWorkload || 50;
      
      caseItem.assignedAttorneys?.forEach(attorney => {
        stats.attorneys.add(`${attorney.firstName} ${attorney.lastName}`);
      });
    });

    this.caseTypeStats = Array.from(caseTypeMap.entries()).map(([caseType, stats]) => ({
      caseType,
      totalCases: stats.count,
      avgWorkload: Math.round(stats.totalWorkload / stats.count),
      preferredAttorneys: Array.from(stats.attorneys)
    }));

    this.calculateAttorneyExpertise();
  }

  private calculateAttorneyExpertise(): void {
    if (this.attorneys.length === 0) {
      this.attorneyExpertise = [];
      return;
    }

    this.attorneyExpertise = this.attorneys.map(attorney => {
      const attorneyAssignments = this.assignments.filter(a => a.userId === attorney.id);
      const caseTypeExp: { [key: string]: number } = {};

      attorneyAssignments.forEach(assignment => {
        const caseItem = this.cases.find(c => c.id === assignment.caseId);
        if (caseItem) {
          caseTypeExp[caseItem.caseType] = (caseTypeExp[caseItem.caseType] || 0) + 1;
        }
      });

      return {
        userId: attorney.id,
        userName: `${attorney.firstName || ''} ${attorney.lastName || ''}`.trim() || attorney.email || 'Unknown',
        specializations: Object.keys(caseTypeExp).filter(type => caseTypeExp[type] >= 1),
        caseTypeExperience: caseTypeExp,
        successRate: Math.round(Math.random() * 20 + 80),
        avgCaseCompletionTime: Math.round(Math.random() * 30 + 30)
      };
    });

    this.cdr.markForCheck();
  }

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
      'LITIGATION': 1.4,
      'CORPORATE_LAW': 1.2,
      'CRIMINAL_LAW': 1.3,
      'FAMILY_LAW': 1.1,
      'REAL_ESTATE': 1.0,
      'INTELLECTUAL_PROPERTY': 1.3,
      'EMPLOYMENT_LAW': 1.1,
      'ESTATE_PLANNING': 0.9,
      'BANKRUPTCY': 1.2,
      'IMMIGRATION': 1.1,
      'TAX_LAW': 1.2
    };
    
    const priority = caseItem.priority || 'MEDIUM';
    const caseType = caseItem.caseType || 'CORPORATE_LAW';
    
    return Math.round(baseWorkload * (priorityMultiplier[priority] || 1.0) * (typeMultiplier[caseType] || 1.0));
  }

  private generateSampleWorkload(attorney: User): UserWorkload {
    // Get actual case count for this attorney from assignments
    const attorneyAssignments = this.assignments.filter(a => a.userId === attorney.id && a.active);
    const activeCases = attorneyAssignments.length;

    // Calculate workload: 10 points per case, max capacity 100 points (10 cases = 100%)
    const workloadPoints = activeCases * 10;
    const capacity = Math.min(workloadPoints, 150); // Cap at 150% for display

    let status: WorkloadStatus;
    if (capacity < 50) status = WorkloadStatus.UNDER_CAPACITY;
    else if (capacity < 70) status = WorkloadStatus.OPTIMAL;
    else if (capacity < 90) status = WorkloadStatus.NEAR_CAPACITY;
    else if (capacity < 100) status = WorkloadStatus.AT_CAPACITY;
    else status = WorkloadStatus.OVER_CAPACITY;

    return {
      userId: attorney.id,
      userName: `${attorney.firstName || ''} ${attorney.lastName || ''}`.trim() || attorney.email,
      userEmail: attorney.email,
      calculationDate: new Date(),
      activeCasesCount: activeCases,
      totalWorkloadPoints: workloadPoints,
      capacityPercentage: capacity,
      maxCapacityPoints: 100,
      workloadStatus: status,
      overdueTasksCount: 0,
      upcomingDeadlinesCount: 0,
      billableHoursWeek: 0,
      nonBillableHoursWeek: 0,
      averageResponseTimeHours: Math.floor(Math.random() * 12) + 2,
      lastCalculatedAt: new Date()
    };
  }

  private generateSampleData(): void {
    this.cases = [
      {
        id: 1,
        title: 'Corporate Merger Agreement',
        caseNumber: 'CASE-2025-001',
        clientName: 'TechCorp Inc.',
        status: 'ACTIVE',
        caseType: 'CORPORATE_LAW',
        priority: 'HIGH',
        estimatedWorkload: 75,
        createdAt: new Date(),
        assignedAttorneys: []
      },
      {
        id: 2,
        title: 'Employment Discrimination Lawsuit',
        caseNumber: 'CASE-2025-002',
        clientName: 'John Smith',
        status: 'ACTIVE',
        caseType: 'EMPLOYMENT_LAW',
        priority: 'MEDIUM',
        estimatedWorkload: 60,
        createdAt: new Date(),
        assignedAttorneys: []
      }
    ];
    this.filteredCases = [...this.cases];
  }

  getAttorneyWorkload(attorneyId: number): UserWorkload | undefined {
    return this.workloadData.find(w => w.userId === attorneyId);
  }

  getCaseAssignments(caseId: number): CaseAssignment[] {
    return this.assignments.filter(a => a.caseId === caseId);
  }

  getAttorneyAssignments(attorneyId: number): CaseAssignment[] {
    return this.assignments.filter(a => a.userId === attorneyId);
  }

  getAttorneyEmail(attorneyId: number): string {
    const attorney = this.attorneys.find(a => a.id === attorneyId);
    return attorney?.email || '';
  }

  getWorkloadStatusClass(status: WorkloadStatus): string {
    const classes = {
      [WorkloadStatus.UNDER_CAPACITY]: 'text-info',
      [WorkloadStatus.OPTIMAL]: 'text-success',
      [WorkloadStatus.NEAR_CAPACITY]: 'text-warning',
      [WorkloadStatus.AT_CAPACITY]: 'text-warning',
      [WorkloadStatus.OVER_CAPACITY]: 'text-danger'
    };
    return classes[status] || 'text-muted';
  }

  getWorkloadStatusBadge(status: WorkloadStatus): string {
    const classes = {
      [WorkloadStatus.UNDER_CAPACITY]: 'bg-soft-info text-info',
      [WorkloadStatus.OPTIMAL]: 'bg-soft-success text-success',
      [WorkloadStatus.NEAR_CAPACITY]: 'bg-soft-warning text-warning',
      [WorkloadStatus.AT_CAPACITY]: 'bg-soft-warning text-warning',
      [WorkloadStatus.OVER_CAPACITY]: 'bg-soft-danger text-danger'
    };
    return classes[status] || 'bg-soft-secondary text-secondary';
  }

  getPriorityClass(priority: string): string {
    const classes = {
      'LOW': 'text-info',
      'MEDIUM': 'text-primary',
      'HIGH': 'text-warning',
      'URGENT': 'text-danger'
    };
    return classes[priority] || 'text-muted';
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

  formatCaseType(caseType: string): string {
    return caseType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  formatRoleType(roleType: CaseRoleType | undefined): string {
    if (!roleType) return 'Unknown';
    return roleType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  onTabChange(tab: string): void {
    this.ngZone.run(() => {
      this.selectedTab = tab;
      if (tab === 'analytics' && !this.analytics) {
        this.loadWorkloadData();
      }
      if (tab === 'transfers') {
        this.loadPendingTransfers();
      }
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    });
  }

  onCaseTypeChange(): void {
    this.filterCases();
  }

  onPriorityChange(): void {
    this.filterCases();
  }

  onWorkloadFilterChange(): void {
    this.cdr.markForCheck();
  }

  refreshData(): void {
    this.loadInitialData();
    this.cdr.markForCheck();
  }

  // Permission and Role Methods
  isManager(): boolean {
    // For now, all users can access manager features
    return true;
  }

  /**
   * Check if current user can manage assignments (unassign/transfer)
   * For now, all users can manage assignments
   */
  canManageAssignment(caseId: number): boolean {
    return true;
  }

  /**
   * Check if current user is admin
   */
  isAdmin(): boolean {
    return this.userService.isAdmin();
  }

  getUserDisplayName(user: User): string {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User';
  }

  /**
   * Load executive summary for current case
   */
  loadExecutiveSummary(): void {
    if (!this.caseMode || !this.currentCaseId) return;

    this.performanceDashboard.getExecutiveSummary(this.currentCaseId)
      .subscribe(summary => {
        this.executiveSummary = summary;
        this.cdr.detectChanges();
      });

    this.performanceDashboard.getCaseHealthScore(this.currentCaseId)
      .subscribe(health => {
        this.caseHealthScore = health;
        this.cdr.detectChanges();
      });
  }

  /**
   * Get risk level color class
   */
  getRiskClass(riskLevel: string): string {
    const classes = {
      'low': 'text-success',
      'medium': 'text-warning', 
      'high': 'text-danger'
    };
    return classes[riskLevel as keyof typeof classes] || 'text-muted';
  }

  /**
   * Get health status color
   */
  getHealthClass(status: string): string {
    const classes = {
      'excellent': 'text-success',
      'good': 'text-info',
      'fair': 'text-warning',
      'poor': 'text-danger'
    };
    return classes[status as keyof typeof classes] || 'text-muted';
  }

  /**
   * Subscribe to WebSocket updates for real-time assignment changes
   */
  private subscribeToWebSocketUpdates(): void {
    // Subscribe to ALL messages and reload pending transfers for broadcasts
    this.webSocketService.getMessages().pipe(
      takeUntil(this.destroy$)
    ).subscribe(message => {
      if (message.type === 'broadcast') {
        this.loadPendingTransfers();
      }
    });

    // Subscribe to assignment changes
    this.webSocketService.getAssignmentMessages(this.currentCaseId || undefined).pipe(
      takeUntil(this.destroy$)
    ).subscribe(message => {
      if (message.type === 'CASE_ASSIGNED' || message.type === 'CASE_UNASSIGNED' || message.type === 'CASE_TRANSFERRED') {
        this.handleRealTimeAssignmentUpdate(message);
      }
      if (message.type === 'TRANSFER_REQUEST_CREATED' ||
          message.type === 'TRANSFER_REQUEST_APPROVED' ||
          message.type === 'TRANSFER_REQUEST_REJECTED') {
        this.handleRealTimeTransferRequest(message);
      }
    });

    // Subscribe to transfer request updates
    this.webSocketService.getTransferMessages().pipe(
      takeUntil(this.destroy$)
    ).subscribe(message => {
      this.handleRealTimeTransferRequest(message);
    });
  }

  /**
   * Handle real-time transfer request updates from WebSocket
   */
  private handleRealTimeTransferRequest(message: any): void {
    this.loadPendingTransfers();
  }

  /**
   * Handle real-time assignment updates from WebSocket
   */
  private handleRealTimeAssignmentUpdate(message: any): void {
    // In case mode, only handle updates for current case
    if (this.caseMode && message.caseId !== this.currentCaseId) {
      return;
    }

    switch (message.type) {
      case 'CASE_ASSIGNED':
        this.handleRealTimeAssignment(message.data);
        break;
      case 'CASE_UNASSIGNED':
        this.handleRealTimeUnassignment(message.data);
        break;
      case 'CASE_TRANSFERRED':
        this.handleRealTimeTransfer(message.data);
        break;
    }

    // Refresh workload data after assignment changes
    this.loadWorkloadData();
    this.cdr.detectChanges();
  }

  /**
   * Handle real-time assignment notification
   */
  private handleRealTimeAssignment(assignmentData: any): void {
    const newAssignment = assignmentData as CaseAssignment;
    
    // Add to assignments list if not already present
    const existingIndex = this.assignments.findIndex(a => 
      a.caseId === newAssignment.caseId && a.userId === newAssignment.userId
    );
    
    if (existingIndex === -1) {
      this.assignments.unshift(newAssignment);
    } else {
      this.assignments[existingIndex] = newAssignment;
    }

    // Show notification if this is not the current user's action
    if (newAssignment.userId !== this.getCurrentUserId()) {
      this.notificationService.onInfo(
        `Case "${newAssignment.caseTitle}" was assigned to ${newAssignment.userName}`
      );
    }
  }

  /**
   * Handle real-time unassignment notification
   */
  private handleRealTimeUnassignment(unassignmentData: any): void {
    const { caseId, userId } = unassignmentData;
    
    // Remove from assignments list
    const assignmentIndex = this.assignments.findIndex(a => 
      a.caseId === caseId && a.userId === userId
    );
    
    if (assignmentIndex > -1) {
      const removedAssignment = this.assignments[assignmentIndex];
      this.assignments.splice(assignmentIndex, 1);

      // Show notification if this affects someone else
      if (userId !== this.getCurrentUserId()) {
        this.notificationService.onInfo(
          `${removedAssignment.userName} was unassigned from case "${removedAssignment.caseTitle}"`
        );
      }
    }
  }

  /**
   * Handle real-time transfer notification
   */
  private handleRealTimeTransfer(transferData: any): void {
    const { caseId, fromUserId, toUserId, fromUserName, toUserName, caseTitle } = transferData;
    
    // Update assignments list
    const fromAssignmentIndex = this.assignments.findIndex(a => 
      a.caseId === caseId && a.userId === fromUserId
    );
    
    if (fromAssignmentIndex > -1) {
      // Update the assignment to reflect new user
      this.assignments[fromAssignmentIndex].userId = toUserId;
      this.assignments[fromAssignmentIndex].userName = toUserName;
      this.assignments[fromAssignmentIndex].updatedAt = new Date();
    }

    // Show notification
    const currentUserId = this.getCurrentUserId();
    if (fromUserId !== currentUserId && toUserId !== currentUserId) {
      this.notificationService.onInfo(
        `Case "${caseTitle}" was transferred from ${fromUserName} to ${toUserName}`
      );
    }
  }

  /**
   * Get current user ID for notifications filtering
   */
  private getCurrentUserId(): number {
    return this.currentUserId;
  }

  /**
   * Resolve current user ID from multiple sources
   */
  private resolveCurrentUserId(): number {
    // 1. Try from user service (cached user data)
    const currentUser = this.userService.getCurrentUser();
    if (currentUser?.id) {
      return currentUser.id;
    }

    // 2. Try from user service's getCurrentUserId
    const storedUserId = this.userService.getCurrentUserId();
    if (storedUserId) {
      return storedUserId;
    }

    // 3. Try to decode JWT token
    try {
      const token = localStorage.getItem(Key.TOKEN);
      if (token) {
        const decodedToken = this.jwtHelper.decodeToken(token);
        // The user ID might be stored in different claims
        const userId = decodedToken?.userId || decodedToken?.id || decodedToken?.sub;
        if (userId && typeof userId === 'number') {
          return userId;
        }
      }
    } catch (error) {
      console.error('Error decoding JWT token:', error);
    }

    return 0;
  }

  // ========================================
  // My Assignments Helper Methods
  // ========================================

  /**
   * Get assignments where user is Lead Attorney
   */
  getMyLeadAssignments(): CaseAssignment[] {
    return this.myAssignments.filter(a => a.roleType === CaseRoleType.LEAD_ATTORNEY);
  }

  /**
   * Get assignments where user is supporting (not lead)
   */
  getMySupportingAssignments(): CaseAssignment[] {
    return this.myAssignments.filter(a => a.roleType !== CaseRoleType.LEAD_ATTORNEY);
  }

  /**
   * Calculate total workload percentage for current user
   */
  getMyTotalWorkload(): number {
    return this.myAssignments.reduce((total, a) => total + (a.workloadWeight || 0), 0);
  }

  /**
   * Get client name for a case
   */
  getClientNameForCase(caseId: number): string {
    const caseItem = this.cases.find(c => c.id === caseId);
    return caseItem?.clientName || '';
  }

  /**
   * Get priority for a case
   */
  getCasePriority(caseId: number): string {
    const caseItem = this.cases.find(c => c.id === caseId);
    return caseItem?.priority || 'MEDIUM';
  }

  /**
   * Load current user's assignments
   */
  private loadMyAssignments(): void {
    if (!this.currentUserId) {
      // Try filtering from all assignments as fallback
      this.myAssignments = this.assignments.filter(a => a.userId === this.currentUserId);
      this.cdr.markForCheck();
      return;
    }

    this.caseAssignmentService.getUserAssignments(this.currentUserId, 0, 100).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error loading my assignments from API:', error);
        // Fallback: filter from all assignments
        this.myAssignments = this.assignments.filter(a => a.userId === this.currentUserId);
        this.cdr.markForCheck();
        return of(null);
      })
    ).subscribe({
      next: (response: any) => {
        if (!response) return; // Error was handled

        // Handle multiple possible response formats
        let assignmentsArray: any[] = [];

        if (response?.data?.content) {
          assignmentsArray = response.data.content;
        } else if (response?.data?.assignments?.content) {
          assignmentsArray = response.data.assignments.content;
        } else if (response?.data?.assignments && Array.isArray(response.data.assignments)) {
          assignmentsArray = response.data.assignments;
        } else if (Array.isArray(response?.data)) {
          assignmentsArray = response.data;
        }

        this.myAssignments = assignmentsArray;

        // If API returned empty but we have all assignments, try filtering
        if (this.myAssignments.length === 0 && this.assignments.length > 0) {
          this.myAssignments = this.assignments.filter(a => a.userId === this.currentUserId);
        }

        this.cdr.markForCheck();
      }
    });
  }
}