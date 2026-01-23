import { Component, OnInit, ChangeDetectorRef, OnDestroy, ViewChild, ElementRef, AfterViewInit, HostListener } from '@angular/core';
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
import { NotificationTriggerService } from '../../../core/services/notification-trigger.service';

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

  // View and filter properties
  activeView: 'kanban' | 'list' | 'my-tasks' = 'kanban';
  filterPriority: string = '';
  filterStatus: string = '';
  filterAssignee: string = '';

  // Task Details Modal properties
  showDetailsModal = false;
  viewingTask: CaseTask | null = null;

  // Assign Task Modal properties
  showAssignModal = false;
  assigningTask: CaseTask | null = null;
  selectedAssigneeId: number | null = null;
  assigneeSearchTerm = '';
  loadingUsers = false;

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
    private legalCaseService: LegalCaseService,
    private notificationTrigger: NotificationTriggerService
  ) {
    this.taskForm = this.createTaskForm();
  }

  ngOnInit(): void {
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
      this.initializeCaseMode(this.currentCaseId);
    } else {
      // All tasks mode
      this.caseMode = false;
      this.initializeAllTasksMode();
    }

    // Subscribe to context updates
    this.subscribeToContextUpdates();

    // Subscribe to WebSocket updates for real-time changes
    this.subscribeToWebSocketUpdates();
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
      caseId: [null, Validators.required],
      assignedToId: [null]
    });
  }

  /**
   * Load tasks for a specific case
   */
  private loadTasksForCase(caseId: number): void {
    this.loading.tasks = true;
    this.cdr.detectChanges(); // Ensure loading state is visible

    this.caseTaskService.getTasksByCaseId(caseId).subscribe({
      next: (response) => {
        // Handle paginated response
        if (response?.data?.tasks?.content) {
          this.allTasks = response.data.tasks.content || [];
        } else if (response?.data?.content) {
          this.allTasks = response.data.content || [];
        } else if (response?.data && Array.isArray(response.data)) {
          this.allTasks = response.data || [];
        } else if (response?.data?.tasks && Array.isArray(response.data.tasks)) {
          this.allTasks = response.data.tasks || [];
        } else {
          console.warn('No recognizable task data structure found in response');
          this.allTasks = [];
        }

        this.filterTasksByStatus();
        this.loading.tasks = false;

        // Force change detection to update the UI
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading tasks:', error);

        // More specific error messages
        if (error.status === 401) {
          this.notificationService.onError('Authentication required. Please log in.');
        } else if (error.status === 403) {
          this.notificationService.onError('You do not have permission to view these tasks.');
        } else if (error.status === 404) {
          this.notificationService.onError('Case not found.');
        } else if (error.status === 0) {
          this.notificationService.onError('Network error. Please check if the backend is running.');
        } else {
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
    this.loading.tasks = true;
    this.cdr.detectChanges(); // Ensure loading state is visible

    this.caseTaskService.getAllTasks().subscribe({
      next: (response) => {
        // Handle paginated response
        if (response?.data?.tasks?.content) {
          this.allTasks = response.data.tasks.content || [];
        } else if (response?.data?.content) {
          this.allTasks = response.data.content || [];
        } else if (response?.data && Array.isArray(response.data)) {
          this.allTasks = response.data || [];
        } else if (response?.data?.tasks && Array.isArray(response.data.tasks)) {
          this.allTasks = response.data.tasks || [];
        } else {
          console.warn('No recognizable task data structure found in response');
          this.allTasks = [];
        }

        this.filterTasksByStatus();
        this.loading.tasks = false;

        // Force change detection to update the UI
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading all tasks:', error);

        // More specific error messages
        if (error.status === 401) {
          this.notificationService.onError('Authentication required. Please log in.');
        } else if (error.status === 403) {
          this.notificationService.onError('You do not have permission to view tasks.');
        } else if (error.status === 0) {
          this.notificationService.onError('Network error. Please check if the backend is running.');
        } else {
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
   * Initialize all tasks mode
   */
  private initializeAllTasksMode(): void {
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
        // Handle multiple response structures from the backend
        let users: User[] = [];

        if (response?.data?.users && Array.isArray(response.data.users)) {
          users = response.data.users;
        } else if (response?.data?.content && Array.isArray(response.data.content)) {
          users = response.data.content;
        } else if (response?.data && Array.isArray(response.data)) {
          users = response.data;
        } else if (Array.isArray(response)) {
          users = response;
        }

        // Map to ensure consistent User interface
        this.availableUsers = users.map((user: any) => ({
          id: user.id,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          roleName: user.roleName || user.role || '',
          roles: user.roles || [],
          imageUrl: user.imageUrl || user.profileImageUrl || '',
          enabled: user.enabled ?? true,
          notLocked: user.notLocked ?? true,
          usingMFA: user.usingMFA ?? false,
          permissions: user.permissions || ''
        } as User));

        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading users:', error);
        this.availableUsers = [];
        this.cdr.detectChanges();
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
        let cases: any[] = [];

        // Handle multiple response structures
        if (response?.data?.cases && Array.isArray(response.data.cases)) {
          cases = response.data.cases;
        } else if (response?.data?.content && Array.isArray(response.data.content)) {
          cases = response.data.content;
        } else if (response?.data && Array.isArray(response.data)) {
          cases = response.data;
        } else if (response?.content && Array.isArray(response.content)) {
          cases = response.content;
        } else if (Array.isArray(response)) {
          cases = response;
        }

        this.availableCases = cases;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading cases:', error);
        this.availableCases = [];
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Filter tasks by status for Kanban columns
   */
  private filterTasksByStatus(): void {
    this.unassignedTasks = this.allTasks.filter(t => !t.assignedToId);
    this.todoTasks = this.allTasks.filter(t => t.status === TaskStatus.TODO && t.assignedToId);
    this.inprogressTasks = this.allTasks.filter(t => t.status === TaskStatus.IN_PROGRESS);
    this.reviewsTasks = this.allTasks.filter(t => t.status === TaskStatus.REVIEW);
    this.completedTasks = this.allTasks.filter(t => t.status === TaskStatus.COMPLETED);
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
          next: async (syncResult) => {
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
              
              // Trigger task status change notification
              const caseName = this.currentCase?.title || `Case ID ${task.caseId}`;
              await this.notificationTrigger.triggerTaskStatusChanged(
                task.id!,
                task.title,
                oldStatus,
                updatedTask.status,
                task.caseId,
                caseName
              );
              
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
      caseId: caseId,
      assignedToId: null
    });
    this.showTaskModal = true;

    // Load cases if not in case mode and cases not loaded
    if (!this.caseMode && this.availableCases.length === 0) {
      this.loadCases();
    }

    // Load users if not loaded
    if (this.availableUsers.length === 0) {
      this.forceLoadUsers();
    }

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
      caseId: task.caseId,
      assignedToId: task.assignedToId || null
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
        next: async (response) => {
          const updatedTask = response.data;
          const originalTask = this.selectedTask!;
          
          // Check if status changed for audit logging and notifications
          if (originalTask.status !== updatedTask.status) {
            this.auditLogService.logTaskStatusChange(
              updatedTask.id,
              updatedTask.title,
              originalTask.status,
              updatedTask.status,
              'TaskManagement'
            ).subscribe();
            
            // Trigger task status change notification
            const caseName = this.currentCase?.title || `Case ID ${updatedTask.caseId}`;
            await this.notificationTrigger.triggerTaskStatusChanged(
              updatedTask.id,
              updatedTask.title,
              originalTask.status,
              updatedTask.status,
              updatedTask.caseId,
              caseName
            );
          }
          
          // Check if assignment changed
          if (originalTask.assignedToId !== updatedTask.assignedToId) {
            this.handleTaskAssignmentChange(originalTask, updatedTask);
          }
          
          this.notificationService.onSuccess('Task updated successfully');
          this.closeTaskModal();
          this.loading.submit = false;
          
          // Update through context service for real-time sync
          if (this.caseMode) {
            this.caseContextService.updateTask({ ...updatedTask });
          } else {
            // Update local array for all-tasks mode
            const index = this.allTasks.findIndex(t => t.id === originalTask?.id);
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
        caseId: formValue.caseId,
        assignedToId: formValue.assignedToId || undefined
      };

      this.caseTaskService.createTask(createData).subscribe({
        next: async (response) => {
          const newTask = response.data.task;
          this.notificationService.onSuccess('Task created successfully');

          // ALWAYS trigger task creation notification to notify team members about new tasks
          if (newTask.id) {
            const caseName = this.currentCase?.title;
            const assigneeName = newTask.assignedToId ? this.getUserNameById(newTask.assignedToId) : 'Unassigned';

            try {
              await this.notificationTrigger.triggerTaskCreated(
                newTask.id,
                newTask.title,
                assigneeName,
                newTask.caseId,
                caseName,
                newTask.dueDate ? new Date(newTask.dueDate).toLocaleDateString() : undefined
              );
            } catch (error) {
              console.error('Failed to send task creation notification:', error);
            }
          }

          // Additionally, if task is assigned, send specific assignment notification
          if (newTask.id && newTask.assignedToId) {
            const caseName = this.currentCase?.title;
            const assigneeName = this.getUserNameById(newTask.assignedToId);

            try {
              await this.notificationTrigger.triggerTaskAssignmentWithPersonalizedMessages(
                newTask.id,
                newTask.title,
                newTask.assignedToId,
                assigneeName,
                newTask.caseId,
                caseName,
                newTask.dueDate ? new Date(newTask.dueDate).toLocaleDateString() : undefined,
                newTask.priority
              );
            } catch (error) {
              console.error('Failed to send task assignment notifications:', error);
            }
          }
          
          this.closeTaskModal();
          this.loading.submit = false;
          
          // Add through context service for real-time sync
          if (this.caseMode) {
            this.caseContextService.addTask({ ...newTask });
          } else {
            // Add to local array for all-tasks mode
            this.allTasks.unshift({ ...newTask });
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
        next: async (syncResult) => {
          if (syncResult.success) {
            // Send personalized task assignment notification
            const assigneeName = this.getUserNameById(newTask.assignedToId!);
            const caseName = this.currentCase?.title;

            try {
              await this.notificationTrigger.triggerTaskAssignmentWithPersonalizedMessages(
                newTask.id!,
                newTask.title,
                newTask.assignedToId!,
                assigneeName,
                newTask.caseId,
                caseName,
                newTask.dueDate ? new Date(newTask.dueDate).toLocaleDateString() : undefined,
                newTask.priority
              );
            } catch (error) {
              console.error('Failed to send personalized task assignment notification:', error);
            }
            
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

  // ==================== View & Filter Methods ====================

  /**
   * Set active view
   */
  setActiveView(view: 'kanban' | 'list' | 'my-tasks'): void {
    this.activeView = view;
    this.cdr.detectChanges();
  }

  /**
   * Filter tasks based on search and filters
   */
  filterTasks(): void {
    this.cdr.detectChanges();
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.searchTerm = '';
    this.filterPriority = '';
    this.filterStatus = '';
    this.filterAssignee = '';
    this.cdr.detectChanges();
  }

  /**
   * Check if any filters are active
   */
  hasActiveFilters(): boolean {
    return !!(this.searchTerm || this.filterPriority || this.filterStatus || this.filterAssignee);
  }

  /**
   * Get filtered tasks for a column
   */
  getFilteredTasks(tasks: CaseTask[]): CaseTask[] {
    return tasks.filter(task => this.matchesFilters(task));
  }

  /**
   * Get all filtered tasks
   */
  getFilteredAllTasks(): CaseTask[] {
    return this.allTasks.filter(task => this.matchesFilters(task));
  }

  /**
   * Check if task matches current filters
   */
  private matchesFilters(task: CaseTask): boolean {
    // Search filter
    if (this.searchTerm) {
      const search = this.searchTerm.toLowerCase();
      const matchesTitle = task.title?.toLowerCase().includes(search);
      const matchesDesc = task.description?.toLowerCase().includes(search);
      const matchesTags = task.tags?.some(tag => tag.toLowerCase().includes(search));
      if (!matchesTitle && !matchesDesc && !matchesTags) {
        return false;
      }
    }

    // Priority filter
    if (this.filterPriority && task.priority !== this.filterPriority) {
      return false;
    }

    // Status filter
    if (this.filterStatus && task.status !== this.filterStatus) {
      return false;
    }

    // Assignee filter
    if (this.filterAssignee) {
      if (this.filterAssignee === 'unassigned') {
        if (task.assignedToId) return false;
      } else {
        if (task.assignedToId !== parseInt(this.filterAssignee)) return false;
      }
    }

    return true;
  }

  // ==================== Stats Methods ====================

  /**
   * Get count of tasks assigned to current user
   */
  getMyTasksCount(): number {
    if (!this.currentUser?.id) return 0;
    return this.allTasks.filter(t => t.assignedToId === this.currentUser?.id).length;
  }

  /**
   * Get my tasks percentage
   */
  getMyTasksPercentage(): number {
    if (this.allTasks.length === 0) return 0;
    return (this.getMyTasksCount() / this.allTasks.length) * 100;
  }

  /**
   * Get count of overdue tasks
   */
  getOverdueTasksCount(): number {
    return this.allTasks.filter(t => this.isOverdue(t) && t.status !== 'COMPLETED').length;
  }

  /**
   * Get overdue percentage
   */
  getOverduePercentage(): number {
    if (this.allTasks.length === 0) return 0;
    return (this.getOverdueTasksCount() / this.allTasks.length) * 100;
  }

  /**
   * Get completed percentage
   */
  getCompletedPercentage(): number {
    if (this.allTasks.length === 0) return 0;
    return (this.completedTasks.length / this.allTasks.length) * 100;
  }

  /**
   * Get tasks assigned to current user
   */
  getMyTasks(): CaseTask[] {
    if (!this.currentUser?.id) return [];
    return this.allTasks.filter(t => t.assignedToId === this.currentUser?.id && this.matchesFilters(t));
  }

  /**
   * Check if task is overdue
   */
  isOverdue(task: CaseTask): boolean {
    if (!task.dueDate || task.status === 'COMPLETED') return false;
    const dueDate = new Date(task.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  }

  /**
   * Check if task is due soon (within 2 days)
   */
  isDueSoon(task: CaseTask): boolean {
    if (!task.dueDate || task.status === 'COMPLETED' || this.isOverdue(task)) return false;
    const dueDate = new Date(task.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoDaysFromNow = new Date(today);
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    return dueDate <= twoDaysFromNow;
  }

  // ==================== UI Helper Methods ====================

  /**
   * Get priority badge class
   */
  getPriorityBadgeClass(priority: string): string {
    switch (priority) {
      case 'URGENT': return 'bg-danger';
      case 'HIGH': return 'bg-warning';
      case 'MEDIUM': return 'bg-info';
      case 'LOW': return 'bg-secondary';
      default: return 'bg-secondary';
    }
  }

  /**
   * Get priority background class
   */
  getPriorityBgClass(priority: string): string {
    switch (priority) {
      case 'URGENT': return 'bg-danger-subtle text-danger';
      case 'HIGH': return 'bg-warning-subtle text-warning';
      case 'MEDIUM': return 'bg-info-subtle text-info';
      case 'LOW': return 'bg-secondary-subtle text-secondary';
      default: return 'bg-secondary-subtle text-secondary';
    }
  }

  /**
   * Get priority color name
   */
  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'URGENT': return 'danger';
      case 'HIGH': return 'warning';
      case 'MEDIUM': return 'info';
      case 'LOW': return 'secondary';
      default: return 'secondary';
    }
  }

  /**
   * Get status badge class
   */
  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'TODO': return 'bg-primary-subtle text-primary';
      case 'IN_PROGRESS': return 'bg-warning-subtle text-warning';
      case 'REVIEW': return 'bg-info-subtle text-info';
      case 'COMPLETED': return 'bg-success-subtle text-success';
      case 'CANCELLED': return 'bg-danger-subtle text-danger';
      default: return 'bg-secondary-subtle text-secondary';
    }
  }

  /**
   * Get progress bar type based on status
   */
  getProgressType(status: string): string {
    switch (status) {
      case 'IN_PROGRESS': return 'warning';
      case 'REVIEW': return 'info';
      case 'COMPLETED': return 'success';
      default: return 'primary';
    }
  }

  /**
   * Format status for display
   */
  formatStatus(status: string): string {
    switch (status) {
      case 'TODO': return 'To Do';
      case 'IN_PROGRESS': return 'In Progress';
      case 'REVIEW': return 'In Review';
      case 'COMPLETED': return 'Completed';
      case 'CANCELLED': return 'Cancelled';
      default: return status;
    }
  }

  /**
   * Quick complete task
   */
  quickCompleteTask(task: CaseTask): void {
    if (!task.id) return;

    Swal.fire({
      title: 'Complete Task?',
      text: `Mark "${task.title}" as completed?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      confirmButtonText: 'Yes, complete it!',
      cancelButtonText: 'Cancel'
    }).then(result => {
      if (result.isConfirmed && task.id) {
        const oldStatus = task.status;
        this.assignmentSyncService.updateTaskStatus(
          task.id,
          oldStatus,
          'COMPLETED' as TaskStatus,
          task.caseId,
          'Quick complete'
        ).subscribe({
          next: (syncResult) => {
            if (syncResult.success) {
              task.status = 'COMPLETED' as TaskStatus;
              this.filterTasksByStatus();
              this.notificationService.onSuccess('Task completed!');
              this.cdr.detectChanges();
            } else {
              this.notificationService.onError(syncResult.error || 'Failed to complete task');
            }
          },
          error: (error) => {
            console.error('Error completing task:', error);
            this.notificationService.onError('Error completing task');
          }
        });
      }
    });
  }

  // ==================== Keyboard Event Handler ====================

  /**
   * Handle keyboard events for modals
   */
  @HostListener('document:keydown.escape', ['$event'])
  onEscapePressed(event: KeyboardEvent): void {
    if (this.showDetailsModal) {
      this.closeDetailsModal();
    } else if (this.showAssignModal) {
      this.closeAssignModal();
    } else if (this.showTaskModal) {
      this.closeTaskModal();
    }
  }

  // ==================== Task Details Modal Methods ====================

  /**
   * View task details
   */
  viewTaskDetails(task: CaseTask): void {
    this.viewingTask = task;
    this.showDetailsModal = true;
    this.cdr.detectChanges();
  }

  /**
   * Close task details modal
   */
  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.viewingTask = null;
    this.cdr.detectChanges();
  }

  // ==================== Assign Task Modal Methods ====================

  /**
   * Open assign modal from details modal (closes details first, then opens assign)
   */
  openAssignModalFromDetails(task: CaseTask): void {
    if (!task) {
      console.error('❌ Cannot open assign modal: task is null');
      return;
    }
    // Store task reference before closing details modal
    const taskToAssign = { ...task };
    this.closeDetailsModal();
    // Use setTimeout to ensure the details modal is fully closed
    setTimeout(() => {
      this.openAssignModal(taskToAssign);
    }, 100);
  }

  /**
   * Open assign task modal
   */
  openAssignModal(task: CaseTask): void {
    if (!task) {
      console.error('Cannot open assign modal: task is null');
      return;
    }
    this.assigningTask = task;
    this.selectedAssigneeId = task.assignedToId || null;
    this.assigneeSearchTerm = '';
    this.showAssignModal = true;

    // Always reload users to ensure fresh data
    if (this.availableUsers.length === 0) {
      this.loadingUsers = true;
      this.forceLoadUsers();
    }

    this.cdr.detectChanges();
  }

  /**
   * Force load users for assignment (public for template access)
   */
  forceLoadUsers(): void {
    this.loadingUsers = true;

    this.userService.getUsers().subscribe({
      next: (response) => {
        let users: User[] = [];

        if (response?.data?.users && Array.isArray(response.data.users)) {
          users = response.data.users;
        } else if (response?.data?.content && Array.isArray(response.data.content)) {
          users = response.data.content;
        } else if (response?.data && Array.isArray(response.data)) {
          users = response.data;
        } else if (Array.isArray(response)) {
          users = response;
        }

        this.availableUsers = users.map((user: any) => ({
          id: user.id,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          roleName: user.roleName || user.role || '',
          roles: user.roles || [],
          imageUrl: user.imageUrl || user.profileImageUrl || '',
          enabled: user.enabled ?? true,
          notLocked: user.notLocked ?? true,
          usingMFA: user.usingMFA ?? false,
          permissions: user.permissions || ''
        } as User));

        this.loadingUsers = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Force load users error:', error);
        this.loadingUsers = false;
        this.notificationService.onError('Failed to load team members');
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Close assign task modal
   */
  closeAssignModal(): void {
    this.showAssignModal = false;
    this.assigningTask = null;
    this.selectedAssigneeId = null;
    this.assigneeSearchTerm = '';
    this.cdr.detectChanges();
  }

  /**
   * Select assignee in modal
   */
  selectAssignee(userId: number): void {
    this.selectedAssigneeId = userId;
    this.cdr.detectChanges();
  }

  /**
   * Get filtered users for assign modal
   */
  getFilteredUsers(): User[] {
    if (!this.assigneeSearchTerm) {
      return this.availableUsers;
    }
    const search = this.assigneeSearchTerm.toLowerCase();
    return this.availableUsers.filter(user => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      return fullName.includes(search) || user.email?.toLowerCase().includes(search);
    });
  }

  /**
   * Confirm task assignment
   */
  confirmAssignment(): void {
    if (!this.assigningTask?.id || !this.selectedAssigneeId) {
      this.notificationService.onError('Please select a team member');
      return;
    }

    // Prevent double-clicks
    if (this.loading.submit) return;
    this.loading.submit = true;
    this.cdr.detectChanges();

    const task = this.assigningTask;
    const oldAssigneeId = task.assignedToId;
    const selectedId = this.selectedAssigneeId;

    this.assignmentSyncService.assignTaskToUser(
      task.id,
      selectedId,
      task.caseId
    ).subscribe({
      next: async (syncResult) => {
        if (syncResult.success) {
          // Get assignee name for notification and task update
          const assigneeName = this.getUserNameById(selectedId);
          const caseName = this.currentCase?.title || task.caseTitle;

          // Update local task with both ID and name
          task.assignedToId = selectedId;
          task.assignedToName = assigneeName;

          // Send notification
          try {
            await this.notificationTrigger.triggerTaskAssignmentWithPersonalizedMessages(
              task.id!,
              task.title,
              selectedId,
              assigneeName,
              task.caseId,
              caseName,
              task.dueDate ? new Date(task.dueDate).toLocaleDateString() : undefined,
              task.priority
            );
          } catch (error) {
            console.error('Failed to send assignment notification:', error);
          }

          // Log assignment change
          const oldAssigneeName = oldAssigneeId ? this.getUserNameById(oldAssigneeId) : undefined;
          this.auditLogService.logAssignmentChange(
            'task',
            task.id!,
            task.title,
            oldAssigneeId ? 'TASK_REASSIGNED' : 'TASK_ASSIGNED',
            oldAssigneeName,
            assigneeName,
            'TaskManagement'
          ).subscribe();

          // Update context if in case mode
          if (this.caseMode) {
            this.caseContextService.updateTask(task);
          }

          this.filterTasksByStatus();
          this.notificationService.onSuccess(`Task assigned to ${assigneeName}`);

          // Close modal and reset loading
          this.loading.submit = false;
          this.showAssignModal = false;
          this.assigningTask = null;
          this.selectedAssigneeId = null;
          this.assigneeSearchTerm = '';
          this.cdr.detectChanges();
        } else {
          this.loading.submit = false;
          this.notificationService.onError(syncResult.error || 'Failed to assign task');
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        console.error('Error assigning task:', error);
        this.loading.submit = false;
        this.notificationService.onError('Error assigning task');
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Get user initials
   */
  getUserInitials(user: User): string {
    const first = user.firstName?.charAt(0) || '';
    const last = user.lastName?.charAt(0) || '';
    return (first + last).toUpperCase();
  }

  /**
   * Get assignee name for a task
   */
  getAssigneeName(task: CaseTask): string {
    if (!task.assignedToId) return 'Unassigned';
    return this.getUserNameById(task.assignedToId);
  }

  /**
   * Get user by ID from available users
   */
  getUserById(userId: number): User | undefined {
    return this.availableUsers.find(u => u.id === userId);
  }

  /**
   * Quick change task status from details modal
   */
  quickChangeStatus(task: CaseTask, newStatus: string): void {
    if (!task.id || task.status === newStatus) return;

    const oldStatus = task.status;

    this.assignmentSyncService.updateTaskStatus(
      task.id,
      oldStatus,
      newStatus as TaskStatus,
      task.caseId,
      'Quick status change from modal'
    ).subscribe({
      next: async (syncResult) => {
        if (syncResult.success) {
          // Update local task
          task.status = newStatus as TaskStatus;

          // Log the status change
          this.auditLogService.logTaskStatusChange(
            task.id!,
            task.title,
            oldStatus,
            newStatus as TaskStatus,
            'TaskManagement'
          ).subscribe();

          // Trigger notification
          const caseName = this.currentCase?.title || `Case ID ${task.caseId}`;
          await this.notificationTrigger.triggerTaskStatusChanged(
            task.id!,
            task.title,
            oldStatus,
            newStatus as TaskStatus,
            task.caseId,
            caseName
          );

          // Update through context service
          if (this.caseMode) {
            this.caseContextService.updateTask(task);
          }

          this.filterTasksByStatus();
          this.notificationService.onSuccess(`Task moved to ${this.formatStatus(newStatus)}`);
          this.cdr.detectChanges();
        } else {
          this.notificationService.onError(syncResult.error || 'Failed to update status');
        }
      },
      error: (error) => {
        console.error('Error updating task status:', error);
        this.notificationService.onError('Error updating task status');
      }
    });
  }

}