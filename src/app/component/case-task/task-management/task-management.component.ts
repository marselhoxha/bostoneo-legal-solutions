import { Component, OnInit, ChangeDetectorRef, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Observable, Subject, combineLatest, of } from 'rxjs';
import { DndDropEvent } from 'ngx-drag-drop';
import Swal from 'sweetalert2';
import { takeUntil, filter, switchMap, tap } from 'rxjs/operators';
import flatpickr from 'flatpickr';

// Services
import { CaseTaskService } from '../../../service/case-task.service';
import { UserService } from '../../../service/user.service';
import { NotificationService } from '../../../service/notification.service';
import { LegalCaseService } from '../../../modules/legal/services/legal-case.service';
import { CaseContextService } from '../../../core/services/case-context.service';
import { NavigationContextService } from '../../../core/services/navigation-context.service';
import { AssignmentRulesService, AssignmentRecommendation } from '../../../core/services/assignment-rules.service';
import { CasePermissionsService } from '../../../core/services/case-permissions.service';
import { WorkloadBalancerService, WorkloadMetrics } from '../../../core/services/workload-balancer.service';
import { AssignmentSyncService } from '../../../core/services/assignment-sync.service';
import { AuditLogService } from '../../../core/services/audit-log.service';
import { WebSocketService } from '../../../core/services/websocket.service';

// Interfaces
import { CaseTask, TaskStatus, TaskPriority, TaskType, TaskCreateRequest } from '../../../interface/case-task';
import { User } from '../../../interface/user';

@Component({
  selector: 'app-task-management',
  templateUrl: './task-management.component.html',
  styleUrls: ['./task-management.component.css']
})
export class TaskManagementComponent implements OnInit, OnDestroy, AfterViewInit {
  private destroy$ = new Subject<void>();
  @ViewChild('dueDateInput', { static: false }) dueDateInput!: ElementRef;
  private flatpickrInstance: any;

  // Bread crumb items
  breadCrumbItems: Array<{}> = [];
  
  // Task lists for Kanban board
  unassignedTasks: CaseTask[] = [];
  todoTasks: CaseTask[] = [];
  inprogressTasks: CaseTask[] = [];
  reviewsTasks: CaseTask[] = [];
  completedTasks: CaseTask[] = [];
  
  // All tasks and filtered tasks
  allTasks: CaseTask[] = [];
  
  // Form and modal properties
  taskForm: FormGroup;
  showTaskModal = false;
  isEditMode = false;
  selectedTask: CaseTask | null = null;
  
  // Search and filter
  searchTerm = '';
  
  // Loading states
  loading = {
    tasks: false,
    submit: false
  };
  
  // Users and options
  availableUsers: User[] = [];
  availableCases: any[] = [];
  taskTypes: string[] = ['RESEARCH', 'REVIEW', 'DOCUMENT_PREP', 'CLIENT_MEETING', 'COURT_APPEARANCE', 'FILING', 'CORRESPONDENCE', 'OTHER'];
  taskStatuses: string[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'CANCELLED'];
  
  // Current case ID
  currentCaseId: number | null = null;
  
  // Current user
  currentUser: User | null = null;
  
  // Context integration properties
  caseMode: boolean = false;
  currentCase: any | null = null;
  availableAssignees: any[] = [];
  userCaseRole: string | null = null;
  contextLoaded: boolean = false;
  assignmentRecommendations: AssignmentRecommendation[] = [];
  canCreateTasks$ = this.casePermissionsService.canCreateTasks();
  canAssignTasks$ = this.casePermissionsService.canAssignTasks();
  canManageTasks$ = this.casePermissionsService.canManageTasks();
  // Removed AI/Analytics features

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private caseTaskService: CaseTaskService,
    private userService: UserService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef,
    private caseContextService: CaseContextService,
    private navigationContextService: NavigationContextService,
    private assignmentRulesService: AssignmentRulesService,
    private casePermissionsService: CasePermissionsService,
    private workloadBalancer: WorkloadBalancerService,
    private assignmentSyncService: AssignmentSyncService,
    private auditLogService: AuditLogService,
    private webSocketService: WebSocketService,
    private legalCaseService: LegalCaseService
  ) {
    this.taskForm = this.createTaskForm();
  }

  ngOnInit(): void {
    console.log('🎬 TaskManagementComponent - ngOnInit started');
    
    // Initialize loading state
    this.loading.tasks = true;
    
    this.breadCrumbItems = [
      { label: 'Tasks' },
      { label: 'Kanban Board', active: true }
    ];

    // Get current user
    this.userService.userData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        console.log('👤 Current user received:', user);
        if (user) {
          this.currentUser = user;
        }
      });

    // Determine context mode from route
    const caseId = this.route.snapshot.params['caseId'];
    
    if (caseId) {
      // Case-specific mode
      this.caseMode = true;
      this.currentCaseId = +caseId;
      console.log('📁 Case-specific mode - caseId:', this.currentCaseId);
      this.initializeCaseMode(this.currentCaseId);
    } else {
      // All tasks mode
      this.caseMode = false;
      console.log('📂 All tasks mode');
      this.initializeAllTasksMode();
    }
    
    // Subscribe to context updates
    this.subscribeToContextUpdates();
    
    // Subscribe to WebSocket updates for real-time changes
    this.subscribeToWebSocketUpdates();
    
    console.log('🎬 TaskManagementComponent - ngOnInit completed');
  }

  ngAfterViewInit(): void {
    // Initialize flatpickr when modal is opened
    // This will be called when the modal becomes visible
  }
  
  ngOnDestroy(): void {
    this.destroyFlatpickr();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Create task form
   */
  private createTaskForm(): FormGroup {
    return this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      taskType: ['RESEARCH', Validators.required],
      priority: ['MEDIUM', Validators.required],
      status: ['TODO', Validators.required],
      dueDate: [''],
      estimatedHours: [0, [Validators.min(0)]],
      tags: [''],
      caseId: [null, Validators.required]
    });
  }

  /**
   * Load tasks for a specific case
   */
  private loadTasksForCase(caseId: number): void {
    console.log('🚀 TaskManagementComponent - loadTasksForCase called with caseId:', caseId);
    this.loading.tasks = true;
    this.cdr.detectChanges(); // Ensure loading state is visible
    
    console.log('📡 Making API call to get tasks for case:', caseId);
    this.caseTaskService.getTasksByCaseId(caseId).subscribe({
      next: (response) => {
        console.log('✅ TaskManagementComponent - API Response received:', response);
        console.log('📊 Response structure analysis:');
        console.log('  - response:', !!response);
        console.log('  - response.data:', !!response.data);
        console.log('  - response.data.tasks:', !!response.data?.tasks);
        console.log('  - response.data.tasks.content:', !!response.data?.tasks?.content);
        console.log('  - response.data.content:', !!response.data?.content);
        
        // Handle paginated response
        if (response?.data?.tasks?.content) {
          console.log('📝 Using response.data.tasks.content - found', response.data.tasks.content.length, 'tasks');
          this.allTasks = response.data.tasks.content || [];
        } else if (response?.data?.content) {
          console.log('📝 Using response.data.content - found', response.data.content.length, 'tasks');
          this.allTasks = response.data.content || [];
        } else if (response?.data && Array.isArray(response.data)) {
          console.log('📝 Using response.data array - found', response.data.length, 'tasks');
          this.allTasks = response.data || [];
        } else if (response?.data?.tasks && Array.isArray(response.data.tasks)) {
          console.log('📝 Using response.data.tasks array - found', response.data.tasks.length, 'tasks');
          this.allTasks = response.data.tasks || [];
        } else {
          console.warn('⚠️ No recognizable task data structure found in response');
          console.log('📋 Full response data:', JSON.stringify(response?.data, null, 2));
          this.allTasks = [];
        }
        
        console.log('📋 All tasks after processing:', this.allTasks);
        console.log('📊 Total tasks loaded:', this.allTasks.length);
        
        this.filterTasksByStatus();
        this.loading.tasks = false;
        
        console.log('🎯 Tasks after filtering by status:');
        console.log('  - unassignedTasks:', this.unassignedTasks.length);
        console.log('  - todoTasks:', this.todoTasks.length);
        console.log('  - inprogressTasks:', this.inprogressTasks.length);
        console.log('  - reviewsTasks:', this.reviewsTasks.length);
        console.log('  - completedTasks:', this.completedTasks.length);
        
        // Force change detection to update the UI
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ TaskManagementComponent - Error loading tasks:', error);
        console.error('📊 Error details:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error,
          url: error.url
        });
        
        // Check if it's a token/auth issue
        const token = localStorage.getItem('[KEY] TOKEN');
        console.log('🔐 Token check:', {
          hasToken: !!token,
          tokenLength: token?.length || 0,
          tokenPreview: token ? token.substring(0, 50) + '...' : 'No token'
        });
        
        // More specific error messages
        if (error.status === 401) {
          console.error('🚫 Authentication required - redirecting to login might be needed');
          this.notificationService.onError('Authentication required. Please log in.');
        } else if (error.status === 403) {
          console.error('🚫 Permission denied for viewing tasks');
          this.notificationService.onError('You do not have permission to view these tasks.');
        } else if (error.status === 404) {
          console.error('🚫 Case not found');
          this.notificationService.onError('Case not found.');
        } else if (error.status === 0) {
          console.error('🌐 Network error - backend might be down');
          this.notificationService.onError('Network error. Please check if the backend is running.');
        } else {
          console.error('🚫 General error loading tasks');
          this.notificationService.onError('Error loading tasks. Please try again.');
        }
        
        this.allTasks = [];
        this.filterTasksByStatus();
        this.loading.tasks = false;
        
        // Force change detection to update the UI
        this.cdr.detectChanges();
      }
    });

    this.loadUsers();
  }

  /**
   * Load all tasks across all cases
   */
  private loadAllTasks(): void {
    console.log('🚀 TaskManagementComponent - loadAllTasks called');
    this.loading.tasks = true;
    this.cdr.detectChanges(); // Ensure loading state is visible
    
    console.log('📡 Making API call to get all tasks');
    this.caseTaskService.getAllTasks().subscribe({
      next: (response) => {
        console.log('✅ TaskManagementComponent - API Response received for all tasks:', response);
        console.log('📊 Response structure analysis:');
        console.log('  - response:', !!response);
        console.log('  - response.data:', !!response.data);
        console.log('  - response.data.tasks:', !!response.data?.tasks);
        console.log('  - response.data.tasks.content:', !!response.data?.tasks?.content);
        console.log('  - response.data.content:', !!response.data?.content);
        
        // Handle paginated response
        if (response?.data?.tasks?.content) {
          console.log('📝 Using response.data.tasks.content - found', response.data.tasks.content.length, 'tasks');
          this.allTasks = response.data.tasks.content || [];
        } else if (response?.data?.content) {
          console.log('📝 Using response.data.content - found', response.data.content.length, 'tasks');
          this.allTasks = response.data.content || [];
        } else if (response?.data && Array.isArray(response.data)) {
          console.log('📝 Using response.data array - found', response.data.length, 'tasks');
          this.allTasks = response.data || [];
        } else if (response?.data?.tasks && Array.isArray(response.data.tasks)) {
          console.log('📝 Using response.data.tasks array - found', response.data.tasks.length, 'tasks');
          this.allTasks = response.data.tasks || [];
        } else {
          console.warn('⚠️ No recognizable task data structure found in response');
          console.log('📋 Full response data:', JSON.stringify(response?.data, null, 2));
          this.allTasks = [];
        }
        
        console.log('📋 All tasks after processing:', this.allTasks);
        console.log('📊 Total tasks loaded:', this.allTasks.length);
        
        this.filterTasksByStatus();
        this.loading.tasks = false;
        
        console.log('🎯 Tasks after filtering by status:');
        console.log('  - unassignedTasks:', this.unassignedTasks.length);
        console.log('  - todoTasks:', this.todoTasks.length);
        console.log('  - inprogressTasks:', this.inprogressTasks.length);
        console.log('  - reviewsTasks:', this.reviewsTasks.length);
        console.log('  - completedTasks:', this.completedTasks.length);
        
        // Force change detection to update the UI
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ TaskManagementComponent - Error loading all tasks:', error);
        console.error('📊 Error details:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error,
          url: error.url
        });
        
        // Check if it's a token/auth issue
        const token = localStorage.getItem('[KEY] TOKEN');
        console.log('🔐 Token check:', {
          hasToken: !!token,
          tokenLength: token?.length || 0,
          tokenPreview: token ? token.substring(0, 50) + '...' : 'No token'
        });
        
        // More specific error messages
        if (error.status === 401) {
          console.error('🚫 Authentication required');
          this.notificationService.onError('Authentication required. Please log in.');
        } else if (error.status === 403) {
          console.error('🚫 Permission denied for viewing tasks');
          this.notificationService.onError('You do not have permission to view tasks.');
        } else if (error.status === 0) {
          console.error('🌐 Network error - backend might be down');
          this.notificationService.onError('Network error. Please check if the backend is running.');
        } else {
          console.error('🚫 General error loading tasks');
          this.notificationService.onError('Error loading tasks. Please try again.');
        }
        
        this.allTasks = [];
        this.filterTasksByStatus();
        this.loading.tasks = false;
        
        // Force change detection to update the UI
        this.cdr.detectChanges();
      }
    });
    
    this.loadUsers();
  }
  
  /**
   * Initialize case-specific mode with context
   */
  private initializeCaseMode(caseId: number): void {
    console.log('🎯 TaskManagementComponent - Initializing case mode for:', caseId);
    
    // Check if case context already exists
    const currentCase = this.caseContextService.getCurrentCaseSnapshot();
    
    if (currentCase && currentCase.id === caseId) {
      console.log('✅ TaskManagementComponent - Using existing context');
      this.loadFromContext();
      return;
    }
    
    // Load case context if not available
    this.caseContextService.syncWithBackend(caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log('✅ TaskManagementComponent - Context loaded from backend');
          this.loadFromContext();
        },
        error: (error) => {
          console.error('❌ TaskManagementComponent - Failed to load context:', error);
          this.handleContextLoadError(error);
        }
      });
  }
  
  /**
   * Initialize all tasks mode
   */
  private initializeAllTasksMode(): void {
    console.log('🌍 TaskManagementComponent - Initializing all tasks mode');
    
    // Clear any existing case context
    this.currentCase = null;
    this.availableAssignees = [];
    this.userCaseRole = null;
    
    // Load all tasks and cases
    this.loadAllTasks();
    this.loadUsers();
    this.loadCases();
  }
  
  /**
   * Load data from existing context
   */
  private loadFromContext(): void {
    // Set case data
    this.currentCase = this.caseContextService.getCurrentCaseSnapshot();
    this.availableAssignees = this.caseContextService.getCaseTeamSnapshot();
    
    // Update form with case ID
    if (this.currentCase) {
      this.taskForm.patchValue({ caseId: this.currentCase.id });
    }
    
    // Load tasks from context or refresh
    const contextTasks = this.caseContextService.getCaseTasksSnapshot();
    if (contextTasks.length > 0) {
      this.allTasks = contextTasks;
      this.filterTasksByStatus();
      this.loading.tasks = false;
      this.contextLoaded = true;
      // Removed AI features loading
      this.cdr.detectChanges();
    } else {
      // Fallback to API call
      this.loadTasksForCase(this.currentCaseId!);
    }
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
        this.availableAssignees = team;
        this.availableUsers = team.map(member => ({
          id: member.userId,
          firstName: member.userName.split(' ')[0] || '',
          lastName: member.userName.split(' ').slice(1).join(' ') || '',
          email: member.userEmail,
          roleName: member.roleType
        } as User));
        this.cdr.detectChanges();
      });
    
    // Subscribe to task updates
    this.caseContextService.getCaseTasks()
      .pipe(takeUntil(this.destroy$))
      .subscribe(tasks => {
        this.allTasks = tasks;
        this.filterTasksByStatus();
        this.loading.tasks = false;
        this.contextLoaded = true;
        this.cdr.detectChanges();
      });
    
    // Subscribe to user role in case
    this.caseContextService.getUserCaseRole()
      .pipe(takeUntil(this.destroy$))
      .subscribe(role => {
        this.userCaseRole = role;
        this.updateTaskPermissions();
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
    console.log('📢 TaskManagementComponent - Received notification:', notification);
    
    switch (notification.type) {
      case 'TASK_ASSIGNED':
      case 'TASK_REASSIGNED':
        this.notificationService.onSuccess('Task assignment updated');
        break;
      case 'MEMBER_ADDED':
        this.notificationService.onInfo('Team member added to case');
        break;
      case 'MEMBER_REMOVED':
        this.notificationService.onInfo('Team member removed from case');
        break;
      case 'TASKS_UPDATED':
        // Tasks automatically update through subscription
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
        { label: 'Tasks', active: true }
      ];
    } else {
      this.breadCrumbItems = [
        { label: 'Tasks' },
        { label: 'All Tasks', active: true }
      ];
    }
  }
  
  /**
   * Update task permissions based on user role
   */
  private updateTaskPermissions(): void {
    // This will be expanded when we implement role-based permissions
    console.log('👮 TaskManagementComponent - User role in case:', this.userCaseRole);
  }
  
  /**
   * Handle context load errors
   */
  private handleContextLoadError(error: any): void {
    if (error.status === 404) {
      this.notificationService.onError('Case not found');
      // Redirect to cases list or dashboard
    } else if (error.status === 403) {
      this.notificationService.onError('Access denied to this case');
    } else {
      this.notificationService.onError('Failed to load case data');
    }
    
    this.loading.tasks = false;
    this.allTasks = [];
    this.filterTasksByStatus();
    this.cdr.detectChanges();
  }

  /**
   * Load users
   */
  private loadUsers(): void {
    this.userService.getUsers().subscribe({
      next: (response) => {
        // Handle both paginated and non-paginated responses
        if (response.data && response.data.content) {
          this.availableUsers = response.data.content;
        } else if (response.data && Array.isArray(response.data)) {
          this.availableUsers = response.data;
        } else {
          this.availableUsers = [];
        }
      },
      error: (error) => {
        console.error('Error loading users:', error);
        this.availableUsers = [];
      }
    });
  }

  /**
   * Load available cases for task creation (only in all tasks mode)
   */
  private loadCases(): void {
    if (this.caseMode) return; // Don't load cases if we're in case-specific mode
    
    this.legalCaseService.getAllCases(0, 100).subscribe({
      next: (response) => {
        // Handle both paginated and non-paginated responses
        if (response.data && response.data.content) {
          this.availableCases = response.data.content;
        } else if (response.data && Array.isArray(response.data)) {
          this.availableCases = response.data;
        } else {
          this.availableCases = [];
        }
      },
      error: (error) => {
        console.error('Error loading cases:', error);
        this.availableCases = [];
      }
    });
  }

  /**
   * Filter tasks by status for Kanban columns
   */
  private filterTasksByStatus(): void {
    console.log('🔍 FilterTasksByStatus called with allTasks:', this.allTasks);
    console.log('📊 Total tasks to filter:', this.allTasks.length);
    
    // Log sample task data
    if (this.allTasks.length > 0) {
      console.log('📝 Sample task data:', {
        firstTask: this.allTasks[0],
        taskStatuses: this.allTasks.map(t => t.status),
        taskAssignments: this.allTasks.map(t => ({ id: t.id, assignedToId: t.assignedToId }))
      });
    }
    
    this.unassignedTasks = this.allTasks.filter(t => !t.assignedToId);
    this.todoTasks = this.allTasks.filter(t => t.status === TaskStatus.TODO && t.assignedToId);
    this.inprogressTasks = this.allTasks.filter(t => t.status === TaskStatus.IN_PROGRESS);
    this.reviewsTasks = this.allTasks.filter(t => t.status === TaskStatus.REVIEW);
    this.completedTasks = this.allTasks.filter(t => t.status === TaskStatus.COMPLETED);
    
    console.log('🎯 Filtering results:');
    console.log('  - Unassigned tasks:', this.unassignedTasks.length, this.unassignedTasks);
    console.log('  - TODO tasks:', this.todoTasks.length, this.todoTasks);
    console.log('  - In Progress tasks:', this.inprogressTasks.length, this.inprogressTasks);
    console.log('  - Review tasks:', this.reviewsTasks.length, this.reviewsTasks);
    console.log('  - Completed tasks:', this.completedTasks.length, this.completedTasks);
    
    // Check TaskStatus enum values
    console.log('🏷️ TaskStatus enum check:', {
      TODO: TaskStatus.TODO,
      IN_PROGRESS: TaskStatus.IN_PROGRESS,
      REVIEW: TaskStatus.REVIEW,
      COMPLETED: TaskStatus.COMPLETED
    });
  }

  /**
   * Track by function for ngFor
   */
  trackByFn(index: number, item: CaseTask): any {
    return item.id || index;
  }

  /**
   * On task dragged from list
   */
  onDragged(item: CaseTask, list: CaseTask[]): void {
    const index = list.indexOf(item);
    if (index > -1) {
      list.splice(index, 1);
    }
  }

  /**
   * On task dropped to new list
   */
  onDrop(event: DndDropEvent, filteredList: CaseTask[], targetStatus: string): void {
    if (filteredList && event.dropEffect === 'move') {
      let index = event.index;

      if (typeof index === 'undefined') {
        index = filteredList.length;
      }

      const task = event.data as CaseTask;
      const oldStatus = task.status;
      
      // Update task status based on target column
      const updatedTask = { ...task };
      
      switch (targetStatus) {
        case 'TODO':
          updatedTask.status = 'TODO' as TaskStatus;
          break;
        case 'IN_PROGRESS':
          updatedTask.status = 'IN_PROGRESS' as TaskStatus;
          break;
        case 'REVIEW':
          updatedTask.status = 'REVIEW' as TaskStatus;
          break;
        case 'COMPLETED':
          updatedTask.status = 'COMPLETED' as TaskStatus;
          break;
      }

      // Add to new list
      filteredList.splice(index, 0, updatedTask);

      // Use AssignmentSyncService for status updates with proper tracking
      if (task.id && oldStatus !== updatedTask.status) {
        this.assignmentSyncService.updateTaskStatus(
          task.id, 
          oldStatus,
          updatedTask.status,
          task.caseId,
          'Drag and drop status change'
        ).subscribe({
          next: (syncResult) => {
            if (syncResult.success) {
              this.notificationService.onSuccess(`Task moved to ${targetStatus}`);
              
              // Log the status change
              this.auditLogService.logTaskStatusChange(
                task.id!,
                task.title,
                oldStatus,
                updatedTask.status,
                'TaskManagement'
              ).subscribe();
              
              // Update through context service for real-time sync
              if (this.caseMode) {
                this.caseContextService.updateTask(updatedTask);
              }
            } else {
              this.notificationService.onError(syncResult.error || 'Failed to update task status');
              // Revert the UI change
              this.revertTaskStatusChange(task, oldStatus);
            }
          },
          error: (error) => {
            console.error('Error updating task status via sync service:', error);
            this.notificationService.onError('Error updating task status');
            this.revertTaskStatusChange(task, oldStatus);
          }
        });
      }
    }
  }

  /**
   * Update task status in backend with context sync
   */
  private updateTaskStatus(task: CaseTask): void {
    if (!task.id) return;

    this.caseTaskService.updateTaskStatus(task.id, task.status).subscribe({
      next: (response) => {
        this.notificationService.onSuccess('Task status updated successfully');
        
        // Update through context service for real-time sync
        if (this.caseMode) {
          this.caseContextService.updateTask({ ...response.data });
        } else {
          // Update local array for all-tasks mode
          const index = this.allTasks.findIndex(t => t.id === task.id);
          if (index > -1) {
            this.allTasks[index] = { ...response.data };
            this.filterTasksByStatus();
            this.cdr.detectChanges();
          }
        }
      },
      error: (error) => {
        console.error('Error updating task status:', error);
        this.notificationService.onError('Error updating task status');
        
        // Revert changes
        if (this.caseMode) {
          this.loadFromContext();
        } else {
          this.loadAllTasks();
        }
      }
    });
  }

  /**
   * Open create task modal
   */
  openCreateTaskModal(): void {
    this.isEditMode = false;
    this.selectedTask = null;
    
    // Set appropriate case ID based on mode
    const caseId = this.caseMode && this.currentCaseId ? this.currentCaseId : null;
    
    this.taskForm.reset({
      taskType: 'RESEARCH',
      priority: 'MEDIUM',
      status: 'TODO',
      estimatedHours: 0,
      caseId: caseId
    });
    this.showTaskModal = true;
    
    // Initialize flatpickr after modal is shown
    setTimeout(() => {
      this.initializeFlatpickr();
    }, 300);
  }

  /**
   * Open edit task modal
   */
  openEditTaskModal(task: CaseTask): void {
    this.isEditMode = true;
    this.selectedTask = task;
    
    this.taskForm.patchValue({
      title: task.title,
      description: task.description,
      taskType: task.taskType,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      estimatedHours: task.estimatedHours,
      tags: task.tags?.join(', ') || '',
      caseId: task.caseId
    });
    
    this.showTaskModal = true;
    
    // Initialize flatpickr after modal is shown
    setTimeout(() => {
      this.initializeFlatpickr();
    }, 300);
  }

  /**
   * Close task modal
   */
  closeTaskModal(): void {
    this.destroyFlatpickr();
    this.showTaskModal = false;
    this.isEditMode = false;
    this.selectedTask = null;
    this.taskForm.reset();
    this.assignmentRecommendations = [];
  }

  /**
   * Get assignment recommendations for current case
   */
  getAssignmentRecommendations(taskId?: number): void {
    if (this.caseMode && this.currentCaseId) {
      this.assignmentRulesService.getTaskAssignmentRecommendations(taskId || 0, this.currentCaseId)
        .subscribe(recommendations => {
          this.assignmentRecommendations = recommendations;
          this.cdr.detectChanges();
        });
    }
  }

  /**
   * Auto-assign task using rules
   */
  autoAssignTask(task: CaseTask): void {
    if (!this.caseMode || !this.currentCaseId) return;

    this.assignmentRulesService.autoAssignTask(task.id, this.currentCaseId)
      .subscribe(assigneeId => {
        if (assigneeId) {
          // Update task with assignment
          const updatedTask = { ...task, assignedToId: assigneeId };
          this.caseContextService.updateTask(updatedTask);
          this.notificationService.onSuccess('Task auto-assigned successfully');
        } else {
          this.notificationService.onInfo('No suitable assignee found');
        }
      });
  }

  // Removed loadWorkloadAnalytics method

  // Removed getIntelligentAssignment method

  // Removed autoDistributeTasks method

  // Removed balanceWorkload method

  // Removed loadAnalytics method

  // Removed loadAdvancedFeatures method

  // Removed toggleAdvancedFeatures method

  // Removed applyPredictiveAssignment method

  // Removed implementOptimization method

  // Removed toggleAnalytics method

  // Removed exportReport method

  /**
   * Save task (create or update)
   */
  saveTask(): void {
    if (this.taskForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.loading.submit = true;
    const formValue = this.taskForm.value;
    
    if (this.isEditMode && this.selectedTask?.id) {
      // For updates, use TaskUpdateRequest
      const updateData = {
        title: formValue.title,
        description: formValue.description,
        taskType: formValue.taskType as TaskType,
        priority: formValue.priority as TaskPriority,
        status: formValue.status as TaskStatus,
        dueDate: formValue.dueDate ? new Date(formValue.dueDate) : undefined,
        estimatedHours: formValue.estimatedHours,
        tags: formValue.tags ? formValue.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag) : []
      };

      this.caseTaskService.updateTask(this.selectedTask.id, updateData).subscribe({
        next: (response) => {
          const updatedTask = response.data;
          
          // Check if status changed for audit logging
          if (this.selectedTask!.status !== updatedTask.status) {
            this.auditLogService.logTaskStatusChange(
              updatedTask.id,
              updatedTask.title,
              this.selectedTask!.status,
              updatedTask.status,
              'TaskManagement'
            ).subscribe();
          }
          
          // Check if assignment changed
          if (this.selectedTask!.assignedToId !== updatedTask.assignedToId) {
            this.handleTaskAssignmentChange(this.selectedTask!, updatedTask);
          }
          
          this.notificationService.onSuccess('Task updated successfully');
          this.closeTaskModal();
          this.loading.submit = false;
          
          // Update through context service for real-time sync
          if (this.caseMode) {
            this.caseContextService.updateTask({ ...updatedTask });
          } else {
            // Update local array for all-tasks mode
            const index = this.allTasks.findIndex(t => t.id === this.selectedTask?.id);
            if (index > -1) {
              this.allTasks[index] = { ...updatedTask };
              this.filterTasksByStatus();
            }
          }
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error updating task:', error);
          this.notificationService.onError('Error updating task');
          this.loading.submit = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      // For creation, use TaskCreateRequest (without status)
      const createData: TaskCreateRequest = {
        title: formValue.title,
        description: formValue.description,
        taskType: formValue.taskType as TaskType,
        priority: formValue.priority as TaskPriority,
        dueDate: formValue.dueDate ? new Date(formValue.dueDate) : undefined,
        estimatedHours: formValue.estimatedHours,
        tags: formValue.tags ? formValue.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag) : [],
        caseId: formValue.caseId
      };

      this.caseTaskService.createTask(createData).subscribe({
        next: (response) => {
          this.notificationService.onSuccess('Task created successfully');
          this.closeTaskModal();
          this.loading.submit = false;
          
          // Add through context service for real-time sync
          if (this.caseMode) {
            this.caseContextService.addTask({ ...response.data.task });
          } else {
            // Add to local array for all-tasks mode
            this.allTasks.unshift({ ...response.data.task });
            this.filterTasksByStatus();
          }
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error creating task:', error);
          this.notificationService.onError('Error creating task');
          this.loading.submit = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  /**
   * Mark all form fields as touched
   */
  private markFormGroupTouched(): void {
    Object.keys(this.taskForm.controls).forEach(key => {
      const control = this.taskForm.get(key);
      if (control) {
        control.markAsTouched();
      }
    });
  }

  /**
   * Check if form field is invalid
   */
  isFieldInvalid(fieldName: string): boolean {
    const field = this.taskForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  /**
   * Get field error message
   */
  getFieldError(fieldName: string): string {
    const field = this.taskForm.get(fieldName);
    if (field && field.errors) {
      if (field.errors['required']) {
        return `${fieldName} is required`;
      }
      if (field.errors['minlength']) {
        return `${fieldName} must be at least ${field.errors['minlength'].requiredLength} characters`;
      }
      if (field.errors['min']) {
        return `${fieldName} must be greater than or equal to ${field.errors['min'].min}`;
      }
    }
    return '';
  }

  /**
   * Get task progress percentage
   */
  getTaskProgress(task: CaseTask): number {
    if (task.status === TaskStatus.COMPLETED) return 100;
    if (task.status === TaskStatus.IN_PROGRESS) return 50;
    if (task.status === TaskStatus.REVIEW) return 75;
    return 0;
  }

  /**
   * Format date for display
   */
  formatDate(date: Date | string | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString();
  }

  /**
   * Confirmation dialog for task deletion
   */
  confirm(event: Event, task: CaseTask): void {
    event.preventDefault();
    
    Swal.fire({
      title: 'Are you sure?',
      text: 'Are you sure you want to remove this task?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f46a6a',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Close'
    }).then(result => {
      if (result.value && task.id) {
        this.deleteTask(task.id);
      }
    });
  }

  /**
   * Delete task
   */
  private deleteTask(taskId: number): void {
    this.caseTaskService.deleteTask(taskId).subscribe({
      next: (response) => {
        this.notificationService.onSuccess('Task deleted successfully');
        
        // Remove through context service for real-time sync
        if (this.caseMode) {
          this.caseContextService.removeTask(taskId);
        } else {
          // Remove from local array for all-tasks mode
          const index = this.allTasks.findIndex(t => t.id === taskId);
          if (index > -1) {
            this.allTasks.splice(index, 1);
            this.filterTasksByStatus();
            this.cdr.detectChanges();
          }
        }
      },
      error: (error) => {
        console.error('Error deleting task:', error);
        this.notificationService.onError('Error deleting task');
      }
    });
  }

  /**
   * Handle task assignment changes
   */
  private handleTaskAssignmentChange(oldTask: CaseTask, newTask: CaseTask): void {
    if (!oldTask.id || !newTask.caseId) return;

    const oldAssignee = oldTask.assignedToId ? this.getUserNameById(oldTask.assignedToId) : undefined;
    const newAssignee = newTask.assignedToId ? this.getUserNameById(newTask.assignedToId) : undefined;

    if (newTask.assignedToId && oldTask.assignedToId !== newTask.assignedToId) {
      // Use AssignmentSyncService for task assignments
      this.assignmentSyncService.assignTaskToUser(
        newTask.id!,
        newTask.assignedToId,
        newTask.caseId
      ).subscribe({
        next: (syncResult) => {
          if (syncResult.success) {
            // Send notification to assigned user
            this.notificationService.notifyTaskAssignment(
              newTask.assignedToId!,
              newTask.id!,
              newTask.title,
              newTask.caseId
            ).subscribe();
            
            // Log assignment change
            this.auditLogService.logAssignmentChange(
              'task',
              newTask.id!,
              newTask.title,
              'TASK_ASSIGNED',
              oldAssignee,
              newAssignee,
              'TaskManagement'
            ).subscribe();
          }
        },
        error: (error) => {
          console.error('Error syncing task assignment:', error);
        }
      });
    }
  }

  /**
   * Revert task status change on error
   */
  private revertTaskStatusChange(task: CaseTask, originalStatus: TaskStatus): void {
    // Update task back to original status
    task.status = originalStatus;
    
    // Re-filter tasks to update UI
    this.filterTasksByStatus();
    this.cdr.detectChanges();
  }

  /**
   * Get user name by ID from available users
   */
  private getUserNameById(userId: number): string {
    const user = this.availableUsers.find(u => u.id === userId);
    return user ? `${user.firstName} ${user.lastName}` : `User ${userId}`;
  }

  /**
   * Subscribe to WebSocket updates for real-time task changes
   */
  private subscribeToWebSocketUpdates(): void {
    this.webSocketService.getTaskMessages(this.currentCaseId || undefined).pipe(
      takeUntil(this.destroy$)
    ).subscribe(message => {
      if (message.type === 'TASK_UPDATED' && message.caseId === this.currentCaseId) {
        // Handle real-time task updates
        const updatedTask = message.data as CaseTask;
        this.handleRealTimeTaskUpdate(updatedTask);
      } else if (message.type === 'TASK_ASSIGNED' && message.caseId === this.currentCaseId) {
        // Handle real-time task assignments
        const assignmentData = message.data;
        this.handleRealTimeTaskAssignment(assignmentData);
      }
    });
  }

  /**
   * Handle real-time task updates from WebSocket
   */
  private handleRealTimeTaskUpdate(updatedTask: CaseTask): void {
    const index = this.allTasks.findIndex(t => t.id === updatedTask.id);
    if (index > -1) {
      this.allTasks[index] = { ...updatedTask };
      this.filterTasksByStatus();
      this.cdr.detectChanges();
    }
  }

  /**
   * Handle real-time task assignments from WebSocket
   */
  private handleRealTimeTaskAssignment(assignmentData: any): void {
    const taskId = assignmentData.taskId;
    const assigneeId = assignmentData.assigneeId;
    
    const task = this.allTasks.find(t => t.id === taskId);
    if (task) {
      task.assignedToId = assigneeId;
      this.filterTasksByStatus();
      this.cdr.detectChanges();
      
      // Show notification if not the current user
      if (this.currentUser && assigneeId !== this.currentUser.id) {
        const assigneeName = this.getUserNameById(assigneeId);
        this.notificationService.onInfo(`Task "${task.title}" was assigned to ${assigneeName}`);
      }
    }
  }

  /**
   * Initialize flatpickr for due date input
   */
  private initializeFlatpickr(): void {
    if (this.dueDateInput && this.dueDateInput.nativeElement) {
      this.flatpickrInstance = flatpickr(this.dueDateInput.nativeElement, {
        dateFormat: 'Y-m-d',
        minDate: 'today',
        allowInput: true,
        onChange: (selectedDates) => {
          if (selectedDates.length > 0) {
            this.taskForm.patchValue({
              dueDate: selectedDates[0].toISOString().split('T')[0]
            });
          }
        }
      });
    }
  }

  /**
   * Destroy flatpickr instance
   */
  private destroyFlatpickr(): void {
    if (this.flatpickrInstance) {
      this.flatpickrInstance.destroy();
      this.flatpickrInstance = null;
    }
  }

}