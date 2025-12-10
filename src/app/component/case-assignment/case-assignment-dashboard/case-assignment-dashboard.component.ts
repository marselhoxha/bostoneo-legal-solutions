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
import { AuditLogService } from '../../../core/services/audit-log.service';
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
    private auditLogService: AuditLogService,
    private webSocketService: WebSocketService,
    private legalCaseService: LegalCaseService,
    private ngZone: NgZone,
    private appRef: ApplicationRef
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    console.log('🎬 CaseAssignmentDashboardComponent - ngOnInit started');

    // Initialize breadcrumbs
    this.breadCrumbItems = [
      { label: 'Case Management' },
      { label: 'Assignments', active: true }
    ];

    // Get current user ID - try multiple methods
    this.currentUserId = this.resolveCurrentUserId();
    console.log('👤 Current User ID resolved:', this.currentUserId);

    // Determine context mode from route
    const caseId = this.route.snapshot.params['caseId'] || this.route.snapshot.queryParams['caseId'];

    if (caseId) {
      // Case-specific mode
      this.caseMode = true;
      this.currentCaseId = +caseId;
      console.log('📁 Case-specific assignment mode - caseId:', this.currentCaseId);
      this.initializeCaseMode(this.currentCaseId);
    } else {
      // All assignments mode
      this.caseMode = false;
      console.log('📂 All assignments mode');

      // If we have user ID, load data immediately
      if (this.currentUserId) {
        this.initializeAllAssignmentsMode();
      } else {
        // Wait for user data before loading
        console.log('⏳ Waiting for user data before loading...');
        this.userService.userData$.pipe(
          takeUntil(this.destroy$),
          filter(user => user !== null),
          take(1)
        ).subscribe(user => {
          if (user) {
            this.currentUserId = user.id;
            console.log('👤 User ID from subscription:', this.currentUserId);
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
        console.log('👤 User ID updated:', this.currentUserId);
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

    console.log('🎬 CaseAssignmentDashboardComponent - ngOnInit completed');
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
    console.log('🎯 CaseAssignmentDashboardComponent - Initializing case mode for:', caseId);
    
    // Check if case context already exists
    const currentCase = this.caseContextService.getCurrentCaseSnapshot();
    
    if (currentCase && currentCase.id === caseId) {
      console.log('✅ CaseAssignmentDashboardComponent - Using existing context');
      this.loadFromContext();
      return;
    }
    
    // Load case context if not available
    this.caseContextService.syncWithBackend(caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log('✅ CaseAssignmentDashboardComponent - Context loaded from backend');
          this.loadFromContext();
        },
        error: (error) => {
          console.error('❌ CaseAssignmentDashboardComponent - Failed to load context:', error);
          this.handleContextLoadError(error);
        }
      });
  }
  
  /**
   * Initialize all assignments mode
   */
  private initializeAllAssignmentsMode(): void {
    console.log('🌍 CaseAssignmentDashboardComponent - Initializing all assignments mode');
    
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
    console.log('📢 CaseAssignmentDashboardComponent - Received notification:', notification);
    
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

    console.log('📊 Loading initial data with currentUserId:', this.currentUserId);

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
          console.log('📋 Filtering myAssignments from allAssignments for userId:', this.currentUserId);
          this.myAssignments = this.assignments.filter(a => a.userId === this.currentUserId);
          console.log('📋 Filtered myAssignments:', this.myAssignments.length);
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
    console.log('📁 Loaded cases:', this.cases.length);
  }

  private processAttorneysData(response: any): void {
    // Backend returns { data: { users: [...] } } from /user/list endpoint
    let usersArray: any[] = [];

    console.log('👥 Processing attorneys data, response structure:', Object.keys(response || {}));

    if (response?.data?.users && Array.isArray(response.data.users)) {
      usersArray = response.data.users;
      console.log('👥 Found users in response.data.users');
    } else if (Array.isArray(response?.data)) {
      usersArray = response.data;
      console.log('👥 Found users in response.data (array)');
    } else if (response?.data?.content && Array.isArray(response.data.content)) {
      usersArray = response.data.content;
      console.log('👥 Found users in response.data.content');
    } else {
      console.warn('👥 Could not find users array in response:', response);
    }

    console.log('👥 Total users loaded:', usersArray.length);

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
      console.log('⚠️ No attorneys found by role filter, using all users');
      this.attorneys = usersArray;
    }

    console.log('👥 Attorneys loaded:', this.attorneys.length);
    if (this.attorneys.length > 0) {
      console.log('👥 First attorney:', this.attorneys[0]?.firstName, this.attorneys[0]?.lastName, '- Role:', this.attorneys[0]?.roleName);
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
    console.log('📋 Loaded all assignments:', this.assignments.length);
    // Debug: Log first few assignments to verify data structure
    if (this.assignments.length > 0) {
      console.log('📋 First assignment sample:', JSON.stringify(this.assignments[0], null, 2));
    }
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
    console.log('📋 Loaded my assignments:', this.myAssignments.length);
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
    console.log('📊 Loading workload data. Attorneys:', this.attorneys.length);

    if (this.attorneys.length === 0) {
      console.warn('⚠️ No attorneys available for workload calculation');
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
        console.log('📊 Workload data loaded:', this.workloadData.length);
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
        // Ensure pendingTransfers is always an array
        const data = response.data;
        this.pendingTransfers = Array.isArray(data) ? data : [];
        console.log('📋 Pending transfers loaded:', this.pendingTransfers.length);
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error loading pending transfers:', error);
        this.pendingTransfers = [];
        this.cdr.markForCheck();
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
    console.log('📁 selectCase called:', caseItem?.id, caseItem?.title);
    this.selectedCase = caseItem;
    this.assignmentForm.patchValue({ caseId: caseItem.id });
    this.loadCaseAssignments(caseItem.id);
    this.getAssignmentRecommendations(caseItem.id);
    // Force change detection for OnPush
    this.cdr.detectChanges();
    console.log('📁 selectedCase set:', this.selectedCase?.id, 'selectedAttorney:', this.selectedAttorney?.id);
  }

  selectAttorney(attorney: User): void {
    console.log('👤 selectAttorney called:', attorney?.id, attorney?.firstName);
    this.selectedAttorney = attorney;
    this.assignmentForm.patchValue({ userId: attorney.id });
    // Force change detection for OnPush
    this.cdr.detectChanges();
    console.log('👤 selectedAttorney set:', this.selectedAttorney?.id, 'selectedCase:', this.selectedCase?.id);
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

    // Use AssignmentSyncService for proper coordination
    this.assignmentSyncService.assignUserToCase(request).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.loading.assigning = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (syncResult) => {
        if (syncResult.success) {
          const assignment = syncResult.data;
          this.notificationService.onSuccess('Case assigned successfully');
          this.assignments.push(assignment);
          this.assignmentForm.reset();
          this.selectedCase = null;
          this.selectedAttorney = null;
          
          // Send notification to assigned user
          const caseName = this.cases.find(c => c.id === request.caseId)?.title || `Case ${request.caseId}`;
          this.notificationService.notifyCaseAssignment(
            request.userId,
            request.caseId,
            caseName,
            request.roleType
          ).subscribe();
          
          // Log assignment change
          const userName = this.attorneys.find(a => a.id === request.userId);
          this.auditLogService.logAssignmentChange(
            'case',
            request.caseId,
            caseName,
            'CASE_ASSIGNED',
            undefined,
            userName ? `${userName.firstName} ${userName.lastName}` : `User ${request.userId}`,
            'CaseAssignmentDashboard'
          ).subscribe();
          
          // Update context if in case mode
          if (this.caseMode && this.currentCaseId) {
            this.caseContextService.syncWithBackend(this.currentCaseId).subscribe();
          }
          
          this.loadWorkloadData();
        } else {
          this.notificationService.onError(syncResult.error || 'Failed to assign case');
        }
      },
      error: (error) => {
        console.error('Error assigning case:', error);
        this.notificationService.onError('Failed to assign case');
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
          this.notificationService.onSuccess('Transfer completed successfully');
          this.transferForm.reset();
          
          // Send notifications to affected users
          const caseName = this.cases.find(c => c.id === transferRequest.caseId)?.title || `Case ${transferRequest.caseId}`;
          const fromUser = this.attorneys.find(a => a.id === transferRequest.fromUserId);
          const toUser = this.attorneys.find(a => a.id === transferRequest.toUserId);
          
          // Notify the new assignee
          this.notificationService.notifyCaseAssignment(
            transferRequest.toUserId,
            transferRequest.caseId,
            caseName,
            'LEAD_ATTORNEY' // Default role for transfers
          ).subscribe();
          
          // Log transfer in audit
          this.auditLogService.logAssignmentChange(
            'case',
            transferRequest.caseId,
            caseName,
            'CASE_TRANSFERRED',
            fromUser ? `${fromUser.firstName} ${fromUser.lastName}` : `User ${transferRequest.fromUserId}`,
            toUser ? `${toUser.firstName} ${toUser.lastName}` : `User ${transferRequest.toUserId}`,
            'CaseAssignmentDashboard'
          ).subscribe();
          
          // Update context if in case mode
          if (this.caseMode && this.currentCaseId) {
            this.caseContextService.syncWithBackend(this.currentCaseId).subscribe();
          } else {
            this.loadInitialData();
          }
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
    console.log('🗑️ Removing assignment:', assignment);
    console.log('   - Assignment ID:', assignment.id);
    console.log('   - Case ID:', assignment.caseId);
    console.log('   - User ID:', assignment.userId);
    console.log('   - User Name:', assignment.userName);

    if (!confirm('Are you sure you want to remove this assignment?')) {
      return;
    }

    // Use AssignmentSyncService for unassignment
    this.assignmentSyncService.unassignUserFromCase(
      assignment.caseId,
      assignment.userId,
      'Manual removal via assignment dashboard'
    ).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (syncResult) => {
        if (syncResult.success) {
          this.notificationService.onSuccess('Assignment removed successfully');
          this.assignments = this.assignments.filter(a => a.id !== assignment.id);
          this.cdr.markForCheck();
          
          // Log removal in audit
          const caseName = assignment.caseTitle || `Case ${assignment.caseId}`;
          this.auditLogService.logAssignmentChange(
            'case',
            assignment.caseId,
            caseName,
            'CASE_UNASSIGNED',
            assignment.userName,
            undefined,
            'CaseAssignmentDashboard'
          ).subscribe();
          
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

  // Utility Methods
  private loadCaseAssignments(caseId: number): void {
    this.caseAssignmentService.getCaseAssignments(caseId).pipe(
      takeUntil(this.destroy$),
      catchError(() => of({ data: [] }))
    ).subscribe({
      next: (response) => {
        if (this.selectedCase) {
          this.selectedCase.assignedAttorneys = response.data.map((assignment: CaseAssignment) =>
            this.attorneys.find(attorney => attorney.id === assignment.userId)
          ).filter(Boolean);
          this.cdr.markForCheck();
        }
      },
      error: (error) => {
        console.error('Error loading case assignments:', error);
      }
    });
  }

  private getAssignmentRecommendations(caseId: number): void {
    console.log('Getting assignment recommendations for case:', caseId);
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
    console.log('📊 Calculating attorney expertise. Attorneys:', this.attorneys.length, 'Assignments:', this.assignments.length);

    if (this.attorneys.length === 0) {
      console.warn('⚠️ No attorneys available for expertise calculation');
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
        specializations: Object.keys(caseTypeExp).filter(type => caseTypeExp[type] >= 1), // Lowered threshold from 3 to 1
        caseTypeExperience: caseTypeExp,
        successRate: Math.round(Math.random() * 20 + 80), // 80-100%
        avgCaseCompletionTime: Math.round(Math.random() * 30 + 30) // 30-60 days
      };
    });

    console.log('📊 Attorney expertise calculated:', this.attorneyExpertise.length);
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

  formatRoleType(roleType: CaseRoleType): string {
    return roleType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  onTabChange(tab: string): void {
    this.ngZone.run(() => {
      this.selectedTab = tab;
      // Reset selections when switching to all-assignments tab for clean state
      if (tab === 'all-assignments') {
        // Keep selections but ensure UI updates
        console.log('📂 Switching to all-assignments tab');
      }
      if (tab === 'analytics' && !this.analytics) {
        this.loadWorkloadData();
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
    console.log('🔄 Refreshing data...');
    this.loadInitialData();
    this.cdr.markForCheck();
  }

  // Permission and Role Methods
  isManager(): boolean {
    // Check if current user has manager permissions
    // This could be based on user roles, permissions, etc.
    return true; // For now, return true to allow access
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
    this.webSocketService.getAssignmentMessages(this.currentCaseId || undefined).pipe(
      takeUntil(this.destroy$)
    ).subscribe(message => {
      if (message.type === 'CASE_ASSIGNED' || message.type === 'CASE_UNASSIGNED' || message.type === 'CASE_TRANSFERRED') {
        // Handle real-time assignment updates
        this.handleRealTimeAssignmentUpdate(message);
      }
    });
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
      console.log('👤 Got user ID from getCurrentUser():', currentUser.id);
      return currentUser.id;
    }

    // 2. Try from user service's getCurrentUserId
    const storedUserId = this.userService.getCurrentUserId();
    if (storedUserId) {
      console.log('👤 Got user ID from getCurrentUserId():', storedUserId);
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
          console.log('👤 Got user ID from JWT token:', userId);
          return userId;
        }
        // If sub is email, we can't get ID directly
        console.log('🔍 JWT token decoded but no numeric userId found:', decodedToken);
      }
    } catch (error) {
      console.error('Error decoding JWT token:', error);
    }

    console.warn('⚠️ Could not resolve user ID from any source');
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
      console.warn('⚠️ Cannot load my assignments - no user ID');
      // Try filtering from all assignments as fallback
      this.myAssignments = this.assignments.filter(a => a.userId === this.currentUserId);
      this.cdr.markForCheck();
      return;
    }

    console.log('👤 Loading assignments for user:', this.currentUserId);

    this.caseAssignmentService.getUserAssignments(this.currentUserId, 0, 100).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error loading my assignments from API:', error);
        // Fallback: filter from all assignments
        this.myAssignments = this.assignments.filter(a => a.userId === this.currentUserId);
        console.log('📋 My assignments (from filter fallback):', this.myAssignments.length);
        this.cdr.markForCheck();
        return of(null);
      })
    ).subscribe({
      next: (response: any) => {
        if (!response) return; // Error was handled

        // Handle multiple possible response formats
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
          // Direct array: { data: [...] }
          assignmentsArray = response.data;
        }

        this.myAssignments = assignmentsArray;
        console.log('📋 My assignments loaded from API:', this.myAssignments.length);

        // If API returned empty but we have all assignments, try filtering
        if (this.myAssignments.length === 0 && this.assignments.length > 0) {
          console.log('🔄 API returned empty, trying to filter from all assignments for user:', this.currentUserId);
          this.myAssignments = this.assignments.filter(a => a.userId === this.currentUserId);
          console.log('📋 My assignments (from filter):', this.myAssignments.length);
        }

        this.cdr.markForCheck();
      }
    });
  }
}