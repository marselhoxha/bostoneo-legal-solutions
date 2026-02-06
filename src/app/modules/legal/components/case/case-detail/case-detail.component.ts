import { Component, OnInit, ChangeDetectorRef, AfterViewInit, ElementRef, ViewChildren, ViewChild, QueryList, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LegalCase, CaseStatus, CasePriority, PaymentStatus } from '../../../interfaces/case.interface';
import { CaseService } from '../../../services/case.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { FlatpickrModule } from 'angularx-flatpickr';
import flatpickr from 'flatpickr';
import { CaseNotesComponent } from '../case-notes/case-notes.component';
import { CaseDocumentsComponent } from '../case-documents/case-documents.component';
import { CaseTimelineComponent } from '../case-timeline/case-timeline.component';
import { CaseTimeEntriesComponent } from '../case-time-entries/case-time-entries.component';
import { CaseResearchComponent } from '../case-research/case-research.component';
import { CaseProgressManagerComponent } from '../case-progress-manager/case-progress-manager.component';
import { CalendarService } from '../../../services/calendar.service';
import { CalendarEvent } from '../../../interfaces/calendar-event.interface';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { EventModalComponent } from '../../../components/calendar/event-modal/event-modal.component';
import Swal from 'sweetalert2';
import { RbacService } from '../../../../../core/services/rbac.service';
import { CaseAssignmentService } from '../../../../../service/case-assignment.service';
import { CaseAssignment, AssignmentHistory } from '../../../../../interface/case-assignment';
import { CaseContextService } from '../../../../../core/services/case-context.service';
import { NavigationContextService } from '../../../../../core/services/navigation-context.service';
import { CaseTaskService } from '../../../../../service/case-task.service';
import { CaseTask } from '../../../../../interface/case-task';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, switchMap, tap, catchError } from 'rxjs/operators';
import { TaskAssignmentModalComponent, TaskAssignmentData } from '../../../../../component/case-task/task-management/components/task-assignment-modal/task-assignment-modal.component';
import { NotificationTriggerService } from '../../../../../core/services/notification-trigger.service';
import { QuickTaskModalComponent, QuickTaskData } from '../../../../../component/case-task/task-management/components/quick-task-modal/quick-task-modal.component';
import { TeamAssignmentModalComponent, TeamAssignmentData } from '../../../../../component/case-task/task-management/components/team-assignment-modal/team-assignment-modal.component';
import { WorkloadBalancingModalComponent, WorkloadBalancingData } from '../../../../../component/case-task/task-management/components/workload-balancing-modal/workload-balancing-modal.component';
import { UserService } from '../../../../../service/user.service';
import { AssignmentSyncService } from '../../../../../core/services/assignment-sync.service';
import { NotificationService } from '../../../../../service/notification.service';
import { AuditLogService } from '../../../../../core/services/audit-log.service';
import { PushNotificationService } from '../../../../../core/services/push-notification.service';
import { NotificationManagerService, NotificationCategory, NotificationPriority } from '../../../../../core/services/notification-manager.service';
import { PRACTICE_AREA_FIELDS, PracticeAreaSection, PracticeAreaField, TYPE_TO_PRACTICE_AREA } from '../../../shared/practice-area-fields.config';

@Component({
  selector: 'app-case-detail',
  templateUrl: './case-detail.component.html',
  styleUrls: ['./case-detail.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FlatpickrModule,
    CaseNotesComponent,
    CaseDocumentsComponent,
    CaseTimelineComponent,
    CaseTimeEntriesComponent,
    CaseResearchComponent,
    CaseProgressManagerComponent
  ]
})
export class CaseDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  private destroy$ = new Subject<void>();
  case: LegalCase | null = null;
  caseId: string | null = null;
  isLoading = false;
  error: string | null = null;
  isEditing = false;
  editForm: FormGroup;
  caseForm: FormGroup;
  
  // Events related properties
  caseEvents: CalendarEvent[] = [];
  isLoadingEvents = false;

  @ViewChildren('filingDate, nextHearing, trialDate') dateInputs: QueryList<ElementRef>;
  @ViewChild(CaseNotesComponent) caseNotesComponent?: CaseNotesComponent;

  // Status and priority values for dropdowns
  caseStatuses = Object.values(CaseStatus);
  casePriorities = Object.values(CasePriority);
  paymentStatuses = Object.values(PaymentStatus);

  private flatpickrInstances: any[] = [];

  // Add role checking properties
  isClient = false;
  canViewInternalNotes = false;
  canViewAllDocuments = false;
  canViewPrivateActivities = false;
  canManageAssignments = false;
  
  // Team & Assignment properties
  caseTeamMembers: any[] = [];
  assignmentHistory: any[] = [];
  
  // Context integration properties
  taskSummary: any = null;
  teamSummary: any = null;
  activeTasksCount: number = 0;
  contextLoaded: boolean = false;
  
  // Task management properties
  recentTasks: CaseTask[] = [];
  isLoadingTasks = false;
  availableUsers: any[] = [];

  // Description expand/collapse
  isDescriptionExpanded = false;
  private readonly DESCRIPTION_MAX_LENGTH = 500;

  // Practice area specific fields
  currentPracticeAreaSections: PracticeAreaSection[] = [];
  practiceAreaFieldsConfig = PRACTICE_AREA_FIELDS;
  private practiceAreaDatePickers: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private caseService: CaseService,
    private calendarService: CalendarService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private rbacService: RbacService,
    private caseAssignmentService: CaseAssignmentService,
    private caseContextService: CaseContextService,
    private navigationContextService: NavigationContextService,
    private caseTaskService: CaseTaskService,
    private userService: UserService,
    private assignmentSyncService: AssignmentSyncService,
    private notificationService: NotificationService,
    private auditLogService: AuditLogService,
    private pushNotificationService: PushNotificationService,
    private notificationManager: NotificationManagerService,
    private notificationTrigger: NotificationTriggerService
  ) {
    this.editForm = this.fb.group({
      caseNumber: ['', Validators.required],
      title: ['', Validators.required],
      clientName: ['', Validators.required],
      clientEmail: [''],
      clientPhone: [''],
      clientAddress: [''],
      status: [CaseStatus.OPEN, Validators.required],
      priority: [CasePriority.MEDIUM, Validators.required],
      type: [''],
      description: ['', Validators.required],
      countyName: [''],
      judgeName: [''],
      courtroom: [''],
      filingDate: [null],
      nextHearing: [null],
      trialDate: [null],
      hourlyRate: [0],
      totalHours: [0],
      totalAmount: [0],
      paymentStatus: [PaymentStatus.PENDING]
    });

    this.caseForm = this.fb.group({
      caseNumber: [''],
      status: [''],
      filingDate: [''],
      nextHearing: [''],
      trialDate: [''],
      judge: [''],
      court: [''],
      jurisdiction: [''],
      description: ['']
    });
  }

  ngOnInit(): void {
    // Set up role-based permissions
    this.setupRoleBasedPermissions();
    
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'Case ID not provided';
      return;
    }
    
    this.caseId = id;
    
    // Initialize with context service
    this.initializeWithContext(Number(id));
    
    // Subscribe to context updates
    this.subscribeToContextUpdates();
    
    // Log case access
    this.logCaseAccess(Number(id), 'VIEW');
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.destroyPracticeAreaDatePickers();
  }
  
  private setupRoleBasedPermissions(): void {
    // Check user permissions using comprehensive admin role checking
    const isAdmin = this.rbacService.isAdmin();
    const isAttorney = this.rbacService.isAttorneyLevel();
    const isManager = this.rbacService.isManager();
    
    // Set role-based permissions based on current user's role
    const isParalegal = this.rbacService.hasRole('ROLE_PARALEGAL');
    const isSecretary = this.rbacService.hasRole('ROLE_SECRETARY');

    // Internal notes access: All except CLIENT
    this.canViewInternalNotes = !this.isClient;
    
    // Document access: Different levels based on role
    this.canViewAllDocuments = !this.isClient;
    
    // Timeline/Activities access: All except CLIENT
    this.canViewPrivateActivities = !this.isClient;
    
    // Assignment management: ADMIN, ATTORNEY, MANAGER
    this.canManageAssignments = isAdmin || isAttorney || isManager;
  }
  
  private initializeWithContext(caseId: number): void {
    // Check if case context already exists
    const currentCase = this.caseContextService.getCurrentCaseSnapshot();

    if (currentCase && currentCase.id === caseId) {
      this.case = currentCase as any;
      this.contextLoaded = true;
      this.loadCaseEvents(currentCase.id);
      this.loadPracticeAreaFields();
      this.cdr.detectChanges();
      return;
    }

    // Load case and set context
    this.loadCase(caseId.toString());
    this.contextLoaded = true;
  }
  
  private subscribeToContextUpdates(): void {
    // Subscribe to case updates
    this.caseContextService.getCurrentCase()
      .pipe(takeUntil(this.destroy$))
      .subscribe(caseData => {
        if (caseData) {
          this.case = caseData as any;
          this.loadPracticeAreaFields();
          this.cdr.detectChanges();
        }
      });
    
    // Comment out the subscription that's overriding our loaded data
    // The team data is already being loaded in loadCaseTeam() method
    /*
    this.caseContextService.getCaseTeam()
      .pipe(takeUntil(this.destroy$))
      .subscribe(team => {
        // This was overriding the actual loaded data with empty array
        this.caseTeamMembers = team;
        this.cdr.detectChanges();
      });
    */
    
    // Subscribe to task summary
    this.caseContextService.getTaskSummary()
      .pipe(takeUntil(this.destroy$))
      .subscribe(summary => {
        this.taskSummary = summary;
        this.activeTasksCount = summary ? (summary.total - summary.byStatus['COMPLETED'] || 0) : 0;
        this.cdr.detectChanges();
      });
    
    // Subscribe to team summary
    this.caseContextService.getTeamSummary()
      .pipe(takeUntil(this.destroy$))
      .subscribe(summary => {
        this.teamSummary = summary;
        this.cdr.detectChanges();
      });
    
    // Subscribe to component notifications
    this.caseContextService.getComponentNotifications()
      .pipe(takeUntil(this.destroy$))
      .subscribe(notification => {
        if (notification) {
          this.handleComponentNotification(notification);
        }
      });
  }
  
  private handleComponentNotification(notification: any): void {
    switch (notification.type) {
      case 'TASK_ASSIGNED':
      case 'TASK_REASSIGNED':
        this.showNotification('Task assignment updated', 'success');
        break;
      case 'MEMBER_ADDED':
        this.showNotification('Team member added', 'success');
        break;
      case 'MEMBER_REMOVED':
        this.showNotification('Team member removed', 'info');
        break;
      case 'TASKS_UPDATED':
        // Task data automatically updates through context subscription
        break;
    }
  }
  
  // Enhanced navigation methods with context
  navigateToTasks(): void {
    this.navigationContextService.navigateWithContext(
      ['/case-management/tasks', this.case?.id],
      { preserveFilters: true }
    );
  }
  
  navigateToAssignments(): void {
    this.navigationContextService.navigateWithContext(
      ['/case-management/assignments'],
      { 
        additionalParams: { caseId: this.case?.id },
        preserveFilters: true 
      }
    );
  }
  
  // Quick action methods
  quickCreateTask(): void {
    if (!this.case) return;
    
    const team = this.caseContextService.getCaseTeamSnapshot();
    const defaultAssignee = this.suggestAssignee(team);
    
    // Open quick task creation dialog
    Swal.fire({
      title: 'Quick Task Creation',
      html: `
        <div class="text-start">
          <div class="mb-3">
            <label class="form-label">Task Title</label>
            <input type="text" id="taskTitle" class="form-control" placeholder="Enter task title">
          </div>
          <div class="mb-3">
            <label class="form-label">Description</label>
            <textarea id="taskDescription" class="form-control" rows="3" placeholder="Task description"></textarea>
          </div>
          <div class="mb-3">
            <label class="form-label">Assign To</label>
            <select id="taskAssignee" class="form-control">
              <option value="">Unassigned</option>
              ${team.map(member => `<option value="${member.userId}" ${member.userId === defaultAssignee?.userId ? 'selected' : ''}>${member.userName}</option>`).join('')}
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label">Priority</label>
            <select id="taskPriority" class="form-control">
              <option value="LOW">Low</option>
              <option value="MEDIUM" selected>Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Create Task',
      preConfirm: () => {
        const title = (document.getElementById('taskTitle') as HTMLInputElement).value;
        const description = (document.getElementById('taskDescription') as HTMLTextAreaElement).value;
        const assigneeId = (document.getElementById('taskAssignee') as HTMLSelectElement).value;
        const priority = (document.getElementById('taskPriority') as HTMLSelectElement).value;
        
        if (!title.trim()) {
          Swal.showValidationMessage('Task title is required');
          return false;
        }
        
        return {
          title: title.trim(),
          description: description.trim(),
          assignedToId: assigneeId ? Number(assigneeId) : null,
          priority,
          taskType: 'OTHER',
          caseId: this.case!.id
        };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.createQuickTask(result.value);
      }
    });
  }
  
  private createQuickTask(taskData: any): void {
    // This would normally call the task service to create the task
    // For now, we'll simulate it and add to context
    const newTask = {
      id: Date.now(), // Temporary ID
      ...taskData,
      status: 'TODO',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.caseContextService.addTask(newTask);
    this.showNotification('Task created successfully', 'success');
  }
  
  /**
   * Convert team members to user format for task assignment modals
   */
  private getTeamMembersAsUsers(): any[] {
    if (!this.caseTeamMembers || this.caseTeamMembers.length === 0) {
      return [];
    }
    
    return this.caseTeamMembers.map(member => ({
      id: member.userId || member.id,
      userId: member.userId || member.id,
      firstName: member.firstName || member.name?.split(' ')[0] || 'Unknown',
      lastName: member.lastName || member.name?.split(' ').slice(1).join(' ') || '',
      email: member.email || '',
      userName: member.userName || member.name || `${member.firstName} ${member.lastName}`,
      // Include other properties that might be needed
      isTeamMember: true // Flag to indicate this is a team member
    }));
  }

  private suggestAssignee(team: any[]): any | null {
    // Simple logic to suggest an assignee based on workload
    if (team.length === 0) return null;
    
    // Find team member with lowest workload
    return team.reduce((lowest, current) => {
      const currentWeight = current.workloadWeight || 0;
      const lowestWeight = lowest.workloadWeight || 0;
      return currentWeight < lowestWeight ? current : lowest;
    });
  }
  
  private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info', taskInfo?: any): void {
    // Determine notification type and icon
    let notificationType = 'default';
    let iconClass = 'bx bx-bell';
    let title = 'Notification';
    
    switch (type) {
      case 'success':
        notificationType = 'case';
        iconClass = 'bx bx-check-circle';
        // Determine title based on the action type
        if (taskInfo && taskInfo.action === 'TASK_CREATED') {
          title = 'Task Created';
        } else if (taskInfo && (taskInfo.taskCount > 0 || taskInfo.memberName)) {
          title = 'Task Assigned';
        } else if (message && message.includes('assigned')) {
          title = 'Task Assigned';
        } else if (message && message.includes('created')) {
          title = 'Task Created';
        } else {
          title = 'Success';
        }
        break;
      case 'error':
        notificationType = 'alert';
        iconClass = 'bx bx-error-circle';
        title = 'Error';
        break;
      case 'info':
        notificationType = 'case';
        iconClass = 'bx bx-info-circle';
        title = 'Information';
        break;
    }
    
    // Create notification payload for topbar
    const notificationPayload = {
      notification: {
        title: title,
        body: message
      },
      data: {
        type: notificationType,
        url: taskInfo?.caseId ? `/legal/cases/details/${taskInfo.caseId}` : window.location.pathname,
        caseId: taskInfo?.caseId || this.caseId,
        taskId: taskInfo?.taskId || null,
        priority: type === 'error' ? 'high' : 'normal',
        timestamp: new Date().toISOString(),
        // Enhanced task information for notification details
        taskDetails: taskInfo ? {
          assignedTo: taskInfo.memberName,
          assignedToId: taskInfo.userId,
          taskCount: taskInfo.taskCount || 1,
          taskTitle: taskInfo.taskTitle || null,
          taskId: taskInfo.taskId || null,
          caseTitle: this.case?.title || 'Case',
          caseNumber: this.case?.caseNumber || 'N/A',
          assignmentDate: new Date().toISOString(),
          action: 'TASK_ASSIGNED'
        } : null
      }
    };

    // Send to topbar notification system
    this.pushNotificationService.sendCustomNotification(notificationPayload);
  }

  /**
   * Safe audit logging helper - prevents HTTP requests to non-existent endpoints
   */
  private safeAuditLog(logAction: () => void): void {
    // Skip audit logging entirely to prevent 404 errors
    // TODO: Re-enable when backend audit endpoints are implemented
  }

  ngAfterViewInit(): void {
    // Initialize flatpickr when in edit mode
    if (this.dateInputs && this.dateInputs.length > 0) {
      this.dateInputs.forEach(input => {
        this.initDatePicker(null, input.nativeElement.id);
      });
    }
  }

  // Method to initialize a single date picker
  initDatePicker(event: Event, controlName: string): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      // Destroy any existing instance for this input
      const existingInstance = this.flatpickrInstances.find(instance => 
        instance.input === input
      );
      
      if (existingInstance) {
        existingInstance.destroy();
        this.flatpickrInstances = this.flatpickrInstances.filter(instance => 
          instance !== existingInstance
        );
      }
      
      // Create a new instance
      const instance = flatpickr(input, {
        dateFormat: 'Y-m-d',
        altInput: true,
        altFormat: 'F j, Y',
        allowInput: true,
        defaultDate: this.editForm.get(controlName)?.value || new Date(),
        onChange: (selectedDates) => {
          if (selectedDates.length > 0) {
            this.editForm.get(controlName)?.setValue(selectedDates[0]);
          }
        }
      });
      
      this.flatpickrInstances.push(instance);
      
      // Open the calendar immediately
      instance.open();
    }
  }

  private initializeFlatpickr(): void {
    // Destroy any existing instances first
    this.destroyFlatpickrInstances();
    
    // Wait for the DOM to be ready
    setTimeout(() => {
      // Initialize new instances
      this.dateInputs.forEach(input => {
        const controlName = input.nativeElement.id;
        const formControl = this.editForm.get(controlName);
        
        if (formControl) {
          // Get current value
          const currentValue = formControl.value;
          
          // Parse date if it's a string
          let defaultDate = null;
          if (currentValue) {
            defaultDate = typeof currentValue === 'string' ? new Date(currentValue) : currentValue;
          }
          
          // Create a new flatpickr instance
          const instance = flatpickr(input.nativeElement, {
            dateFormat: 'Y-m-d',
            altInput: true,
            altFormat: 'F j, Y',
            allowInput: true,
            defaultDate: defaultDate,
            onChange: (selectedDates) => {
              if (selectedDates.length > 0) {
                formControl.setValue(selectedDates[0]);
              }
            }
          });
          
          this.flatpickrInstances.push(instance);
        }
      });
    }, 100); // Short delay to ensure DOM is ready
  }

  private destroyFlatpickrInstances(): void {
    this.flatpickrInstances.forEach(instance => {
      if (instance && typeof instance.destroy === 'function') {
        instance.destroy();
      }
    });
    this.flatpickrInstances = [];
  }

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    if (this.isEditing) {
      this.updateFormWithCaseData();
      // Add practice area form controls
      this.addPracticeAreaFormControls();
      // Force change detection to update the view
      this.cdr.detectChanges();
      // Initialize Flatpickr after view updates with a longer timeout
      setTimeout(() => {
        this.initializeFlatpickr();
        this.initPracticeAreaDatePickers();
      }, 500);
    } else {
      // Clean up flatpickr instances when exiting edit mode
      this.destroyFlatpickrInstances();
      this.destroyPracticeAreaDatePickers();
    }
  }

  updateFormWithCaseData(): void {
    if (this.case) {
      // Extract values with proper null checks
      const filingDate = this.case.importantDates?.filingDate || (this.case as any).filingDate;
      const nextHearing = this.case.importantDates?.nextHearing || (this.case as any).nextHearing;
      const trialDate = this.case.importantDates?.trialDate || (this.case as any).trialDate;
      
      const countyName = this.case.courtInfo?.countyName || (this.case as any).countyName;
      const judgeName = this.case.courtInfo?.judgeName || (this.case as any).judgeName;
      const courtroom = this.case.courtInfo?.courtroom || (this.case as any).courtroom;
      
      const hourlyRate = this.case.billingInfo?.hourlyRate || (this.case as any).hourlyRate || 0;
      const totalHours = this.case.billingInfo?.totalHours || (this.case as any).totalHours || 0;
      const totalAmount = this.case.billingInfo?.totalAmount || (this.case as any).totalAmount || 0;
      const paymentStatus = this.case.billingInfo?.paymentStatus || (this.case as any).paymentStatus || 'PENDING';

      this.editForm.patchValue({
        caseNumber: this.case.caseNumber,
        title: this.case.title,
        clientName: this.case.clientName,
        clientEmail: this.case.clientEmail,
        clientPhone: this.case.clientPhone,
        clientAddress: this.case.clientAddress,
        status: this.case.status,
        priority: this.case.priority,
        type: this.case.type,
        description: this.case.description,
        countyName,
        judgeName,
        courtroom,
        filingDate: filingDate ? new Date(filingDate) : null,
        nextHearing: nextHearing ? new Date(nextHearing) : null,
        trialDate: trialDate ? new Date(trialDate) : null,
        hourlyRate,
        totalHours,
        totalAmount,
        paymentStatus
      });

      this.caseForm.patchValue({
        caseNumber: this.case.caseNumber,
        status: this.case.status,
        filingDate: filingDate ? new Date(filingDate) : null,
        nextHearing: nextHearing ? new Date(nextHearing) : null,
        trialDate: trialDate ? new Date(trialDate) : null,
        judge: judgeName,
        court: countyName,
        jurisdiction: courtroom,
        description: this.case.description
      });
    }
  }

  loadCase(id: string): void {
    this.isLoading = true;
    this.error = null;
    this.cdr.detectChanges();
    
    // Use the service to get real data from the API
    this.caseService.getCaseById(id).subscribe({
      next: (response) => {
        try {
          // The backend returns data in a wrapper object
          if (response && response.data && response.data.case) {
            // Create the importantDates object if it doesn't exist
            const caseData = response.data.case;
            
            // Ensure importantDates exists
            if (!caseData.importantDates) {
              caseData.importantDates = {
                filingDate: caseData.filingDate || null,
                nextHearing: caseData.nextHearing || null,
                trialDate: caseData.trialDate || null
              };
            }
            
            // Ensure courtInfo exists
            if (!caseData.courtInfo) {
              caseData.courtInfo = {
                countyName: caseData.countyName || '',
                judgeName: caseData.judgeName || '',
                courtroom: caseData.courtroom || ''
              };
            }

            // Ensure billingInfo exists
            if (!caseData.billingInfo) {
              caseData.billingInfo = {
                hourlyRate: parseFloat(caseData.hourlyRate) || 0,
                totalHours: parseFloat(caseData.totalHours) || 0,
                totalAmount: parseFloat(caseData.totalAmount) || 0,
                paymentStatus: caseData.paymentStatus || 'PENDING'
              };
            }

            this.case = caseData as any;
          } else if (response && typeof response === 'object' && 'id' in response) {
            // Handle direct case object response
            const caseData = response as any;

            // Ensure importantDates exists
            if (!caseData.importantDates) {
              caseData.importantDates = {
                filingDate: caseData.filingDate || null,
                nextHearing: caseData.nextHearing || null,
                trialDate: caseData.trialDate || null
              };
            }

            // Ensure courtInfo exists
            if (!caseData.courtInfo) {
              caseData.courtInfo = {
                countyName: caseData.countyName || '',
                judgeName: caseData.judgeName || '',
                courtroom: caseData.courtroom || ''
              };
            }
            
            // Ensure billingInfo exists
            if (!caseData.billingInfo) {
              caseData.billingInfo = {
                hourlyRate: parseFloat(caseData.hourlyRate) || 0,
                totalHours: parseFloat(caseData.totalHours) || 0,
                totalAmount: parseFloat(caseData.totalAmount) || 0,
                paymentStatus: caseData.paymentStatus || 'PENDING'
              };
            }
            
            this.case = caseData as any;
          } else {
            this.error = 'Case data not found or in unexpected format';
            console.warn('Unexpected response format:', response);
          }
        } catch (e) {
          this.error = 'Error processing case data';
          console.error('Error processing case data:', e);
        }
        this.isLoading = false;
        this.cdr.detectChanges();
        
        // Load associated events after case is loaded
        if (this.case && this.case.id) {
          this.loadCaseEvents(this.case.id);
          this.loadCaseTeam(this.case.id);
          this.loadAllCaseTasks(this.case.id);
          this.loadPracticeAreaFields();
        }
      },
      error: (err) => {
        console.error('Error loading case:', err);
        if (err.status === 401) {
          this.error = 'Authentication required. Please log in to view case details.';
        } else if (err.status === 404) {
          this.error = 'Case not found.';
        } else {
          this.error = 'Failed to load case. ' + (err.error?.reason || err.error?.message || 'Please try again later.');
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Load events associated with this case
  loadCaseEvents(caseId: string | number): void {
    this.isLoadingEvents = true;
    this.cdr.detectChanges();
    
    // Set a timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      if (this.isLoadingEvents) {
        this.isLoadingEvents = false;
        this.caseEvents = [];
        console.warn('Events loading timed out - endpoint may not be available');
        this.cdr.detectChanges();
      }
    }, 5000); // 5 second timeout
    
    this.calendarService.getEventsByCaseId(caseId).subscribe({
      next: (response: any) => {
        clearTimeout(loadingTimeout);
        
        // Handle both direct array and wrapped response
        let events = Array.isArray(response) ? response : 
                    (response && response.data && response.data.events) ? response.data.events : [];
        
        if (!Array.isArray(events)) {
          console.warn('Events data is not an array:', response);
          this.caseEvents = [];
          this.isLoadingEvents = false;
          this.cdr.detectChanges();
          return;
        }
        
        // Filter events based on user role
        if (this.isClient) {
          // Clients only see certain event types
          const clientVisibleEventTypes = ['HEARING', 'APPOINTMENT', 'COURT_DATE', 'CLIENT_MEETING'];
          events = events.filter((event: any) => 
            clientVisibleEventTypes.includes(event.eventType) &&
            event.caseId === Number(caseId)  // Ensure events are only for this case
          );
        }
        
        // Sort events by date (most recent first)
        this.caseEvents = events.sort((a: any, b: any) => {
          const dateA = new Date(a.start || a.startTime).getTime();
          const dateB = new Date(b.start || b.startTime).getTime();
          return dateA - dateB;
        });
        
        // Only show upcoming events (today and future)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        this.caseEvents = this.caseEvents.filter(event => {
          const eventDate = new Date(event.start || event.startTime);
          return eventDate >= today;
        });
        
        // Limit to next 5 events for display
        this.caseEvents = this.caseEvents.slice(0, 5);
        
        this.isLoadingEvents = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        clearTimeout(loadingTimeout);
        console.error('Error loading case events:', err);
        this.isLoadingEvents = false;
        this.caseEvents = []; // Set empty array on error
        this.cdr.detectChanges();
      }
    });
  }
  
  // Event actions
  openCreateEventModal(): void {
    try {
      // Close any open modals first
      this.modalService.dismissAll();
      
      const modalRef = this.modalService.open(EventModalComponent, {
        size: 'lg',
        backdrop: 'static',
        keyboard: false,
        centered: true
      });
      
      // Pre-fill case info if available
      if (this.case) {
        modalRef.componentInstance.title = 'Create New Event';
        
        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 3600000); // 1 hour later
        
        const newEvent: Partial<CalendarEvent> = {
          start: now,
          end: oneHourLater,
          startTime: now, // Add both formats for compatibility with the modal
          endTime: oneHourLater,
          caseId: this.case.id,
          caseTitle: this.case.title,
          caseNumber: this.case.caseNumber,
          status: null,
          eventType: null
        };
        
        modalRef.componentInstance.event = newEvent;
        // Explicitly set the caseId property on the modal component
        modalRef.componentInstance.caseId = this.case.id;
      }
      
      modalRef.result.then(
        (result) => {
          if (result && this.case?.id) {
            // Reload events after successful creation
            this.loadCaseEvents(this.case.id);
          }
        },
        (reason) => {
          // Modal was closed without saving
        }
      );
    } catch (error) {
      console.error('Error opening event modal:', error);
      
      // Fallback message if modal component isn't available
      this.snackBar.open(
        'Event creation is currently unavailable. The calendar module may not be fully configured.',
        'Close',
        { duration: 5000 }
      );
    }
  }

  // Quick action: Schedule Court Date
  scheduleCourtDate(): void {
    try {
      this.modalService.dismissAll();

      const modalRef = this.modalService.open(EventModalComponent, {
        size: 'lg',
        backdrop: 'static',
        keyboard: false,
        centered: true
      });

      modalRef.componentInstance.title = 'Schedule Court Date';

      const now = new Date();
      const twoHoursLater = new Date(now.getTime() + 7200000);

      const courtEvent: Partial<CalendarEvent> = {
        start: now,
        end: twoHoursLater,
        startTime: now,
        endTime: twoHoursLater,
        caseId: this.case?.id,
        caseTitle: this.case?.title,
        caseNumber: this.case?.caseNumber,
        eventType: 'COURT_DATE',
        highPriority: true,
        status: 'SCHEDULED',
        title: this.case ? `Court Hearing - ${this.case.title || this.case.caseNumber}` : 'Court Hearing'
      };

      modalRef.componentInstance.event = courtEvent;
      if (this.case?.id) {
        modalRef.componentInstance.caseId = this.case.id;
      }

      modalRef.result.then(
        (result) => {
          if (result && this.case?.id) {
            this.loadCaseEvents(this.case.id);
          }
        },
        () => {}
      );
    } catch (error) {
      console.error('Error opening court date modal:', error);
      this.snackBar.open('Unable to open court date scheduler.', 'Close', { duration: 3000 });
    }
  }

  // Quick action: Set Deadline
  setDeadline(): void {
    try {
      this.modalService.dismissAll();

      const modalRef = this.modalService.open(EventModalComponent, {
        size: 'lg',
        backdrop: 'static',
        keyboard: false,
        centered: true
      });

      modalRef.componentInstance.title = 'Set Deadline';

      // Default to end of business day tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(17, 0, 0, 0);

      const deadlineEvent: Partial<CalendarEvent> = {
        start: tomorrow,
        end: tomorrow,
        startTime: tomorrow,
        endTime: tomorrow,
        caseId: this.case?.id,
        caseTitle: this.case?.title,
        caseNumber: this.case?.caseNumber,
        eventType: 'DEADLINE',
        highPriority: true,
        status: 'SCHEDULED',
        allDay: true,
        title: this.case ? `Deadline - ${this.case.title || this.case.caseNumber}` : 'Deadline'
      };

      modalRef.componentInstance.event = deadlineEvent;
      if (this.case?.id) {
        modalRef.componentInstance.caseId = this.case.id;
      }

      modalRef.result.then(
        (result) => {
          if (result && this.case?.id) {
            this.loadCaseEvents(this.case.id);
          }
        },
        () => {}
      );
    } catch (error) {
      console.error('Error opening deadline modal:', error);
      this.snackBar.open('Unable to open deadline scheduler.', 'Close', { duration: 3000 });
    }
  }

  viewEvent(event: CalendarEvent): void {
    try {
      const modalRef = this.modalService.open(EventModalComponent, {
        size: 'lg',
        backdrop: 'static',
        keyboard: false,
        centered: true
      });

      modalRef.componentInstance.event = event;
      modalRef.componentInstance.title = 'View Event';
      modalRef.componentInstance.viewMode = true;
    } catch (error) {
      console.error('Error opening event view modal:', error);
      
      // Fallback message if modal component isn't available
      this.snackBar.open(
        'Event details view is currently unavailable. The calendar module may not be fully configured.',
        'Close',
        { duration: 5000 }
      );
    }
  }
  
  editEvent(event: CalendarEvent): void {
    try {
      const modalRef = this.modalService.open(EventModalComponent, {
        size: 'lg',
        backdrop: 'static',
        keyboard: false,
        centered: true
      });
      
      // Ensure both start/end and startTime/endTime fields exist
      // This helps with compatibility between backend and frontend models
      const eventCopy = { ...event };
      
      // Convert if only start/end exist but not startTime/endTime
      if (event.start && !event.startTime) {
        eventCopy.startTime = event.start;
      }
      if (event.end && !event.endTime) {
        eventCopy.endTime = event.end;
      }
      
      modalRef.componentInstance.event = eventCopy;
      modalRef.componentInstance.title = 'Edit Event';
      modalRef.componentInstance.viewMode = false;
      
      modalRef.result.then(
        (result) => {
          if (result && this.case?.id) {
            // Reload events after successful edit
            this.loadCaseEvents(this.case.id);
          }
        },
        (reason) => {
          // Modal was closed without saving
        }
      );
    } catch (error) {
      console.error('Error opening event edit modal:', error);
      
      // Fallback message if modal component isn't available
      this.snackBar.open(
        'Event editing is currently unavailable. The calendar module may not be fully configured.',
        'Close',
        { duration: 5000 }
      );
    }
  }
  
  deleteEvent(event: CalendarEvent): void {
    Swal.fire({
      title: 'Are you sure?',
      text: 'You won\'t be able to revert this!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'No, cancel!',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    }).then((result) => {
      if (result.isConfirmed && event.id) {
        this.calendarService.deleteEvent(String(event.id)).subscribe({
          next: () => {
            Swal.fire('Deleted!', 'Event has been deleted.', 'success');
            if (this.case?.id) {
              this.loadCaseEvents(this.case.id);
            }
          },
          error: (err) => {
            console.error('Error deleting event:', err);
            Swal.fire('Error!', 'Failed to delete event.', 'error');
          }
        });
      }
    });
  }
  
  // Helper methods for styling
  getEventTypeIcon(eventType?: string): string {
    if (!eventType) return 'bg-secondary-subtle';
    
    switch(eventType) {
      case 'COURT_DATE': 
        return 'bg-danger-subtle';
      case 'DEADLINE': 
        return 'bg-warning-subtle';
      case 'CLIENT_MEETING': 
      case 'TEAM_MEETING': 
        return 'bg-primary-subtle';
      case 'DEPOSITION': 
        return 'bg-info-subtle';
      case 'MEDIATION': 
        return 'bg-success-subtle';
      default: 
        return 'bg-secondary-subtle';
    }
  }
  
  getEventTypeIconClass(eventType?: string): string {
    if (!eventType) return 'ri-calendar-line text-secondary';
    
    switch(eventType) {
      case 'COURT_DATE': 
        return 'ri-scales-line text-danger';
      case 'DEADLINE': 
        return 'ri-time-line text-warning';
      case 'CLIENT_MEETING': 
        return 'ri-user-line text-primary';
      case 'TEAM_MEETING': 
        return 'ri-team-line text-primary';
      case 'DEPOSITION': 
        return 'ri-file-text-line text-info';
      case 'MEDIATION': 
        return 'ri-discuss-line text-success';
      default: 
        return 'ri-calendar-line text-secondary';
    }
  }
  
  getEventTypeBadgeClass(type: string): string {
    switch(type) {
      case 'COURT_DATE': return 'bg-danger-subtle text-danger';
      case 'DEADLINE': return 'bg-warning-subtle text-warning';
      case 'CLIENT_MEETING': return 'bg-primary-subtle text-primary';
      case 'TEAM_MEETING': return 'bg-info-subtle text-info';
      case 'DEPOSITION': return 'bg-secondary-subtle text-secondary';
      case 'MEDIATION': return 'bg-success-subtle text-success';
      case 'CONSULTATION': return 'bg-primary-subtle text-primary';
      case 'REMINDER': return 'bg-info-subtle text-info';
      default: return 'bg-dark-subtle text-dark';
    }
  }
  
  getEventTypeColor(type: string): string {
    switch(type) {
      case 'COURT_DATE': return '#d63939';
      case 'DEADLINE': return '#f59f00';
      case 'CLIENT_MEETING': return '#3577f1';
      case 'TEAM_MEETING': return '#0ab39c';
      case 'DEPOSITION': return '#405189';
      case 'MEDIATION': return '#0ab39c';
      case 'CONSULTATION': return '#3577f1';
      case 'REMINDER': return '#299cdb';
      default: return '#212529';
    }
  }
  
  getEventStatusBadgeClass(status?: string): string {
    if (!status) return 'bg-secondary-subtle text-secondary';
    
    switch(status) {
      case 'SCHEDULED': 
        return 'bg-info-subtle text-info';
      case 'COMPLETED': 
        return 'bg-success-subtle text-success';
      case 'CANCELLED': 
        return 'bg-danger-subtle text-danger';
      case 'RESCHEDULED': 
        return 'bg-warning-subtle text-warning';
      case 'PENDING': 
        return 'bg-secondary-subtle text-secondary';
      default: 
        return 'bg-light text-dark';
    }
  }

  saveCase(): void {
    // Check form validity first
    if (!this.editForm.valid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.editForm.controls).forEach(key => {
        const control = this.editForm.get(key);
        control?.markAsTouched();
      });
      
      // Create error message based on invalid fields
      const invalidFields = Object.keys(this.editForm.controls)
        .filter(key => this.editForm.get(key)?.invalid)
        .join(', ');
      
      this.error = `Please correct the following fields: ${invalidFields}`;
      this.showNotification('Please fill all required fields correctly', 'error');
      
      return;
    }
    
    if (this.case) {
      this.isLoading = true;
      this.error = null;
      this.cdr.detectChanges();
      
      // Extract form values
      const formValues = this.editForm.value;
      
      try {
        // Parse numeric values safely
        const hourlyRate = formValues.hourlyRate ? parseFloat(formValues.hourlyRate) : 0;
        const totalHours = formValues.totalHours ? parseFloat(formValues.totalHours) : 0;
        const totalAmount = formValues.totalAmount ? parseFloat(formValues.totalAmount) : 0;
        
        if (isNaN(hourlyRate) || isNaN(totalHours) || isNaN(totalAmount)) {
          throw new Error('Billing values must be valid numbers');
        }
        
        // Format dates properly
        const formatDate = (date: any) => {
          if (!date) return null;
          return date instanceof Date ? date : new Date(date);
        };
        
        // Create properly formatted update data
        const updateData = {
          id: this.case.id,
          caseNumber: formValues.caseNumber,
          title: formValues.title,
          clientName: formValues.clientName,
          clientEmail: formValues.clientEmail,
          clientPhone: formValues.clientPhone,
          clientAddress: formValues.clientAddress,
          status: formValues.status,
          priority: formValues.priority,
          type: formValues.type,
          description: formValues.description,
          
          // Include both nested and flat fields for maximum compatibility
          courtInfo: {
            countyName: formValues.countyName || '',
            judgeName: formValues.judgeName || '',
            courtroom: formValues.courtroom || ''
          },
          countyName: formValues.countyName || '',
          judgeName: formValues.judgeName || '',
          courtroom: formValues.courtroom || '',
          
          importantDates: {
            filingDate: formatDate(formValues.filingDate),
            nextHearing: formatDate(formValues.nextHearing),
            trialDate: formatDate(formValues.trialDate)
          },
          filingDate: formatDate(formValues.filingDate),
          nextHearing: formatDate(formValues.nextHearing),
          trialDate: formatDate(formValues.trialDate),
          
          billingInfo: {
            hourlyRate: hourlyRate,
            totalHours: totalHours,
            totalAmount: totalAmount,
            paymentStatus: formValues.paymentStatus
          },
          hourlyRate: hourlyRate,
          totalHours: totalHours,
          totalAmount: totalAmount,
          paymentStatus: formValues.paymentStatus
        };

        // Add practice area specific fields to update data
        this.currentPracticeAreaSections.forEach(section => {
          section.fields.forEach(field => {
            const value = formValues[field.name];
            if (value !== null && value !== undefined && value !== '') {
              if (field.type === 'date' && value) {
                (updateData as any)[field.name] = formatDate(value);
              } else if (field.type === 'currency' || field.type === 'number') {
                (updateData as any)[field.name] = value ? parseFloat(value) : null;
              } else {
                (updateData as any)[field.name] = value;
              }
            }
          });
        });

        // Store original values for change detection
        const originalStatus = this.case.status;
        const originalPriority = this.case.priority;
        const caseName = this.case.title;
        const caseNumber = this.case.caseNumber;

        // Call the API to update the case
        this.caseService.updateCase(this.case.id, updateData).subscribe({
          next: async (response) => {
            // Detect and trigger notifications for changes
            const newStatus = formValues.status;
            const newPriority = formValues.priority;

            // Trigger status change notification
            if (originalStatus !== newStatus) {
              await this.notificationTrigger.triggerCaseStatusChanged(
                Number(this.case.id), 
                originalStatus, 
                newStatus, 
                caseName, 
                caseNumber
              );
            }
            
            // Trigger priority change notification
            if (originalPriority !== newPriority) {
              await this.notificationTrigger.triggerCasePriorityChanged(
                Number(this.case.id), 
                originalPriority, 
                newPriority, 
                caseName, 
                caseNumber
              );
            }
            
            // Reload the case data after update
            this.loadCase(this.case!.id);
            this.isEditing = false;
            this.snackBar.open('Case updated successfully', 'Close', { duration: 3000 });
          },
          error: (error) => {
            console.error('Error updating case:', error);
            this.error = 'Failed to update case: ' + (error.error?.reason || error.error?.message || 'Please try again later.');
            this.isLoading = false;
            this.cdr.detectChanges();
            
            // Show more detailed error message
            this.showNotification(
              `Update failed: ${error.error?.message || error.message || 'Unknown error'}`,
              'error'
            );
          },
          complete: () => {
            this.isLoading = false;
            this.cdr.detectChanges();
          }
        });
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred';
        this.error = errorMessage;
        this.isLoading = false;
        this.showNotification(errorMessage, 'error');
        this.cdr.detectChanges();
      }
    }
  }

  onCancel(): void {
    this.isEditing = false;
    this.cdr.detectChanges();
  }

  deleteCase(): void {
    if (this.case) {
      Swal.fire({
        title: 'Are you sure?',
        text: `You are about to delete case "${this.case.title}". This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel'
      }).then((result) => {
        if (result.isConfirmed) {
          this.isLoading = true;
          this.cdr.detectChanges();
          
          this.caseService.deleteCase(this.case!.id).subscribe({
            next: () => {
              this.isLoading = false;
              Swal.fire({
                title: 'Deleted!',
                text: 'Case has been successfully deleted.',
                icon: 'success',
                confirmButtonColor: '#3085d6'
              }).then(() => {
                this.router.navigate(['/legal/cases']);
              });
            },
            error: (error) => {
              this.isLoading = false;
              console.error('Error deleting case:', error);
              
              // For status 400, always treat as dependency/foreign key error
              if (error.status === 400) {
                Swal.fire({
                  title: 'Cannot Delete Case',
                  html: `This case has related records (documents, notes, activities, etc.) that must be deleted first.<br><br>
                         Please remove all documents, notes, and other related items before deleting this case.`,
                  icon: 'warning',
                  confirmButtonColor: '#3085d6',
                  confirmButtonText: 'I Understand'
                });
              } else {
                // Generic error handling for other types of errors
                Swal.fire({
                  title: 'Error!',
                  text: 'Failed to delete case: ' + (error.error?.reason || error.error?.message || 'Please try again later.'),
                  icon: 'error',
                  confirmButtonColor: '#3085d6'
                });
              }
              
              this.cdr.detectChanges();
            }
          });
        }
      });
    }
  }
  
  /**
   * Checks if an error is related to a foreign key constraint violation
   * Note: This method is kept for backward compatibility but
   * we now handle all 400 errors as dependency errors directly
   */
  private isForeignKeyConstraintError(error: any): boolean {
    // All 400 status codes when deleting are treated as constraint errors
    if (error.status === 400) {
      return true;
    }
    
    // For additional safety, still check error messages
    const errorMsg = JSON.stringify(error || {}).toLowerCase();
    return errorMsg.includes('foreign key constraint') || 
           errorMsg.includes('constraint fails') || 
           errorMsg.includes('cannot delete') ||
           errorMsg.includes('referenced by') ||
           errorMsg.includes('bad request');
  }

  getStatusClass(status: CaseStatus): string {
    return `status-${status.toLowerCase().replace('_', '-')}`;
  }

  getPriorityClass(priority: CasePriority): string {
    return `priority-${priority.toLowerCase()}`;
  }

  // Description formatting and expand/collapse methods
  formatDescription(description: string | null | undefined): string {
    if (!description) return '<span class="text-muted">No description provided</span>';

    // Convert line breaks to <br> tags and preserve paragraph structure
    return description
      .split(/\n\n+/)  // Split by double line breaks (paragraphs)
      .map(paragraph => `<p class="description-paragraph">${paragraph.replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  isDescriptionLong(description: string | null | undefined): boolean {
    if (!description) return false;
    return description.length > this.DESCRIPTION_MAX_LENGTH;
  }

  toggleDescription(): void {
    this.isDescriptionExpanded = !this.isDescriptionExpanded;
  }

  // Get hearing date status (Overdue, Upcoming, etc.)
  getHearingStatus(hearingDate: string | Date | null | undefined): { label: string; class: string; icon: string } {
    if (!hearingDate) {
      return { label: '', class: '', icon: '' };
    }

    const date = new Date(hearingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: 'Overdue', class: 'bg-danger-subtle text-danger', icon: 'ri-error-warning-line' };
    } else if (diffDays === 0) {
      return { label: 'Today', class: 'bg-danger text-white', icon: 'ri-alarm-warning-line' };
    } else if (diffDays === 1) {
      return { label: 'Tomorrow', class: 'bg-warning text-dark', icon: 'ri-time-line' };
    } else if (diffDays <= 7) {
      return { label: 'Upcoming', class: 'bg-warning-subtle text-warning', icon: 'ri-time-line' };
    } else {
      return { label: 'Scheduled', class: 'bg-info-subtle text-info', icon: 'ri-calendar-check-line' };
    }
  }

  // Get trial date status (Critical if within 30 days, Overdue if past)
  getTrialStatus(trialDate: string | Date | null | undefined): { label: string; class: string; icon: string } {
    if (!trialDate) {
      return { label: '', class: '', icon: '' };
    }

    const date = new Date(trialDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: 'Overdue', class: 'bg-danger text-white', icon: 'ri-error-warning-line' };
    } else if (diffDays === 0) {
      return { label: 'Today', class: 'bg-danger text-white', icon: 'ri-alarm-warning-line' };
    } else if (diffDays <= 7) {
      return { label: 'Critical', class: 'bg-danger-subtle text-danger', icon: 'ri-alert-line' };
    } else if (diffDays <= 30) {
      return { label: 'Approaching', class: 'bg-warning-subtle text-warning', icon: 'ri-time-line' };
    } else {
      return { label: 'Scheduled', class: 'bg-info-subtle text-info', icon: 'ri-calendar-check-line' };
    }
  }

  startEdit(): void {
    this.isEditing = true;
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.updateFormWithCaseData();
  }

  // Get only the deadline events from caseEvents
  getDeadlines(): CalendarEvent[] {
    return this.caseEvents.filter(event => event.eventType === 'DEADLINE');
  }

  // Get deadline status based on due date
  getDeadlineStatus(deadline: CalendarEvent): string {
    const now = new Date();
    const dueDate = new Date(deadline.start);
    
    if (deadline.status === 'COMPLETED') {
      return 'Completed';
    }
    
    if (dueDate < now) {
      return 'Overdue';
    }
    
    // Calculate days until deadline
    const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil <= 3) {
      return 'Approaching';
    } else if (daysUntil <= 7) {
      return 'Upcoming';
    } else {
      return 'Future';
    }
  }
  
  // Get badge class based on deadline status
  getDeadlineStatusBadgeClass(deadline: CalendarEvent): string {
    const status = this.getDeadlineStatus(deadline);
    switch (status) {
      case 'OVERDUE':
        return 'bg-danger-subtle text-danger';
      case 'DUE_SOON':
        return 'bg-warning-subtle text-warning';
      case 'UPCOMING':
        return 'bg-info-subtle text-info';
      case 'COMPLETED':
        return 'bg-success-subtle text-success';
      default:
        return 'bg-secondary-subtle text-secondary';
    }
  }

  // Method to get initials from a name
  getInitials(name: string): string {
    if (!name) return '';
    return name
      .split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }

  // Method to duplicate an event
  duplicateEvent(event: CalendarEvent): void {
    const modalRef = this.modalService.open(EventModalComponent, {
      backdrop: 'static',
      keyboard: false,
      size: 'lg'
    });

    // Create a duplicate with modified title and new date
    const duplicatedEvent = {
      ...event,
      id: null, // Remove ID so it gets treated as new
      title: `${event.title} (Copy)`,
      start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default to one week later
      end: event.end ? new Date(new Date(event.end).getTime() + 7 * 24 * 60 * 60 * 1000) : null
    };

    modalRef.componentInstance.event = duplicatedEvent;
    modalRef.componentInstance.caseId = this.caseId;
    modalRef.componentInstance.isEditMode = false;

    modalRef.result.then((result) => {
      if (result && result.success) {
        this.loadCaseEvents(this.caseId!);
        this.snackBar.open('Event duplicated successfully', 'Close', { duration: 3000 });
      }
    }).catch(() => {
      // Modal dismissed
    });
  }
  
  // Team & Assignment Methods
  loadCaseTeam(caseId: string | number): void {
    // Set permissions with fallback
    this.rbacService.hasPermission('CASE', 'ASSIGN').subscribe({
      next: (hasPermission) => {
        this.canManageAssignments = hasPermission;
      },
      error: (error) => {
        console.warn('Permission check failed, using fallback:', error);
        this.canManageAssignments = true; // Fallback to allow functionality
      }
    });
    
    // Try multiple approaches to load team data
    this.loadTeamWithFallback(Number(caseId));
  }

  private loadTeamWithFallback(caseId: number): void {
    // First try the team members endpoint
    this.caseAssignmentService.getTeamMembers(caseId).subscribe({
      next: (response) => {
        if (response.data) {
          this.processTeamData(response.data);
        }
      },
      error: (error) => {
        console.warn('getTeamMembers failed, trying getCaseAssignments:', error);
        
        // Fallback to case assignments endpoint
        this.caseAssignmentService.getCaseAssignments(caseId).subscribe({
          next: (response) => {
            if (response.data) {
              const data = response.data as any;
              const assignments = Array.isArray(data) ? data : data.content || [];
              this.processTeamData(assignments);
            }
          },
          error: (secondError) => {
            console.error('All team loading attempts failed:', secondError);
            this.caseTeamMembers = [];
            this.snackBar.open('Failed to load team members', 'Close', { duration: 3000 });
          }
        });
      }
    });
  }

  private processTeamData(assignments: CaseAssignment[]): void {
    if (assignments && assignments.length > 0) {
      // First, map basic team data
      this.caseTeamMembers = assignments.map((assignment: CaseAssignment) => ({
        id: assignment.userId,
        userId: assignment.userId,
        name: assignment.userName || 'Unknown User',
        userName: assignment.userName || 'Unknown User',
        firstName: this.getFirstName(assignment.userName),
        lastName: this.getLastName(assignment.userName),
        title: assignment.roleType,
        roleType: assignment.roleType,
        imageUrl: assignment.userImageUrl || null,
        workloadStatus: 'OPTIMAL',
        workloadPercentage: 0, // Will be updated from API
        assignmentId: assignment.id,
        assignmentDate: assignment.assignedAt
      }));

      // Then, fetch actual workload data for each team member
      this.loadTeamWorkloads();
    } else {
      this.caseTeamMembers = [];
    }

    // Update the context service with the loaded team data
    this.caseContextService.updateCaseTeam(assignments);

    this.cdr.detectChanges();
  }

  /**
   * Load actual workload data for all team members from the API
   */
  private loadTeamWorkloads(): void {
    if (!this.caseTeamMembers || this.caseTeamMembers.length === 0) return;

    const workloadRequests = this.caseTeamMembers.map(member =>
      this.caseAssignmentService.calculateUserWorkload(member.userId).pipe(
        catchError(error => {
          console.warn(`Failed to load workload for user ${member.userId}:`, error);
          return of({ data: null });
        })
      )
    );

    forkJoin(workloadRequests).subscribe({
      next: (responses) => {
        responses.forEach((response, index) => {
          if (response.data && this.caseTeamMembers[index]) {
            const workload = response.data;
            this.caseTeamMembers[index].workloadPercentage = workload.capacityPercentage || 0;
            this.caseTeamMembers[index].workloadStatus = workload.workloadStatus || 'OPTIMAL';
            this.caseTeamMembers[index].activeCasesCount = workload.activeCasesCount || 0;
            this.caseTeamMembers[index].overdueTasksCount = workload.overdueTasksCount || 0;
          }
        });
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading team workloads:', error);
      }
    });
  }

  /**
   * Extract first name from full name
   */
  private getFirstName(fullName: string | undefined): string {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    return parts[0] || '';
  }

  /**
   * Extract last name from full name
   */
  private getLastName(fullName: string | undefined): string {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : '';
  }

  /**
   * Provide minimal fallback team data when API calls fail
   */
  private provideFallbackTeamData(): void {
    // Set empty team data and notify user
    this.caseTeamMembers = [];
    this.assignmentHistory = [];
    this.snackBar.open(
      'Unable to load team data. Please refresh the page or contact support.',
      'Close',
      { duration: 5000 }
    );
  }
  
  /**
   * Handle team tab click - ensure team data is loaded
   */
  onTeamTabClick(): void {
    if (this.caseId && (!this.caseTeamMembers || this.caseTeamMembers.length === 0)) {
      this.loadCaseTeam(this.caseId);
    }
    if (this.caseId && (!this.recentTasks || this.recentTasks.length === 0)) {
      this.loadAllCaseTasks(this.caseId);
    }
  }

  /**
   * Handle task created from research tab - refresh team tasks, notes, and events
   */
  onTaskCreated(): void {
    if (this.caseId) {
      this.loadAllCaseTasks(this.caseId);
      this.loadCaseEvents(this.caseId);

      // Reload notes component
      if (this.caseNotesComponent) {
        this.caseNotesComponent.loadNotes();
      }
    }
  }
  
  openAssignmentModal(): void {
    // TODO: Implement assignment modal
    this.snackBar.open('Assignment modal will be implemented', 'Close', { duration: 3000 });
  }
  
  viewMemberDetails(member: any): void {
    // Use member.userId if available, otherwise fall back to member.id
    const userId = member.userId || member.id;
    
    if (!userId) {
      this.snackBar.open('User ID not found', 'Close', { duration: 3000 });
      return;
    }

    // Show loading while fetching user details
    Swal.fire({
      title: 'Loading User Details...',
      allowEscapeKey: false,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.userService.getUserById(userId).subscribe({
      next: (response) => {
        if (response.data) {
          this.showUserDetailsModal(response.data);
        } else {
          Swal.fire('Error', 'User details not found', 'error');
        }
      },
      error: (error) => {
        console.error('❌ Error fetching user details:', error);
        Swal.fire('Error', 'Failed to load user details: ' + error, 'error');
      }
    });
  }

  private showUserDetailsModal(user: any): void {
    const userImageUrl = user.imageUrl || 'assets/images/users/avatar-1.jpg';
    
    Swal.fire({
      title: `${user.firstName} ${user.lastName}`,
      html: `
        <div class="user-profile-modal">
          <div class="text-center mb-3">
            <img src="${userImageUrl}" 
                 alt="User Profile" 
                 class="rounded-circle" 
                 style="width: 80px; height: 80px; object-fit: cover;"
                 onerror="this.src='assets/images/users/avatar-1.jpg'">
          </div>
          <div class="row">
            <div class="col-6"><strong>Email:</strong></div>
            <div class="col-6">${user.email}</div>
          </div>
          <div class="row mt-2">
            <div class="col-6"><strong>Role:</strong></div>
            <div class="col-6">${user.roleName || 'N/A'}</div>
          </div>
          <div class="row mt-2">
            <div class="col-6"><strong>Title:</strong></div>
            <div class="col-6">${user.title || 'N/A'}</div>
          </div>
          <div class="row mt-2">
            <div class="col-6"><strong>Phone:</strong></div>
            <div class="col-6">${user.phone || 'N/A'}</div>
          </div>
          <div class="row mt-2">
            <div class="col-6"><strong>Status:</strong></div>
            <div class="col-6">
              <span class="badge ${user.enabled && user.notLocked ? 'bg-success' : 'bg-warning'}">
                ${user.enabled && user.notLocked ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          ${user.bio ? `
          <div class="row mt-2">
            <div class="col-12"><strong>Bio:</strong></div>
            <div class="col-12 mt-1"><small>${user.bio}</small></div>
          </div>
          ` : ''}
        </div>
      `,
      width: '500px',
      confirmButtonText: 'Close',
      confirmButtonColor: '#6c757d',
      customClass: {
        popup: 'swal2-user-profile'
      }
    });
  }
  
  transferAssignment(member: any): void {
    // TODO: Implement transfer functionality
    this.snackBar.open('Transfer functionality will be implemented', 'Close', { duration: 3000 });
  }
  
  removeAssignment(member: any): void {
    const memberName = member.firstName && member.lastName 
      ? `${member.firstName} ${member.lastName}` 
      : (member.name || 'team member');
    
    Swal.fire({
      title: 'Remove Team Member?',
      text: `Are you sure you want to remove ${memberName} from this case?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, remove',
      cancelButtonText: 'Cancel'
    }).then(async (result) => {
      if (result.isConfirmed) {
        const reason = 'Removed from case team';
        const userId = member.userId || member.id;
        
        this.caseAssignmentService.unassignCase(Number(this.caseId), userId, reason).subscribe({
          next: async () => {
            // Send personalized notifications using the new system
            try {
              await this.notificationTrigger.triggerCaseUnassignmentWithPersonalizedMessages(
                Number(this.caseId),
                userId,
                memberName,
                this.case?.title,
                this.case?.caseNumber,
                reason
              );
              
            } catch (error) {
              console.error('Failed to send personalized unassignment notifications:', error);
            }
            
            this.snackBar.open('Team member removed successfully', 'Close', { duration: 3000 });
            this.loadCaseTeam(this.caseId!);
          },
          error: (error) => {
            console.error('Error removing assignment:', error);
            this.snackBar.open('Failed to remove team member', 'Close', { duration: 3000 });
          }
        });
      }
    });
  }
  
  getOverCapacityCount(): number {
    if (!Array.isArray(this.caseTeamMembers)) return 0;
    return this.caseTeamMembers.filter(member => member.workloadStatus === 'OVER_CAPACITY').length;
  }

  // ==================== Task Management Methods ====================

  /**
   * Load recent tasks for the case
   */
  loadRecentTasks(caseId: string | number): void {
    this.isLoadingTasks = true;
    this.recentTasks = []; // Ensure it's always an array
    this.cdr.detectChanges();

    this.caseTaskService.getTasksByCaseId(Number(caseId)).subscribe({
      next: (response) => {
        // Get the 5 most recent tasks
        const tasks = response?.data?.tasks;
        this.recentTasks = Array.isArray(tasks) ? tasks.slice(0, 5) : [];
        this.isLoadingTasks = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading recent tasks:', error);
        this.recentTasks = [];
        this.isLoadingTasks = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Open create task modal
   */
  openCreateTaskModal(): void {
    // Navigate to task management with create modal
    this.router.navigate(['/case-management/tasks', this.caseId], {
      queryParams: { action: 'create' }
    });
  }

  /**
   * View task details
   */
  viewTask(task: CaseTask): void {
    this.router.navigate(['/case-management/tasks', this.caseId], {
      queryParams: { taskId: task.id, action: 'view' }
    });
  }

  /**
   * Edit task
   */
  editTask(task: CaseTask): void {
    this.router.navigate(['/case-management/tasks', this.caseId], {
      queryParams: { taskId: task.id, action: 'edit' }
    });
  }

  /**
   * Assign task
   */
  assignTask(task: CaseTask): void {
    this.router.navigate(['/case-management/tasks', this.caseId], {
      queryParams: { taskId: task.id, action: 'assign' }
    });
  }

  /**
   * Delete task
   */
  deleteTask(task: CaseTask): void {
    Swal.fire({
      title: 'Delete Task',
      text: `Are you sure you want to delete "${task.title}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.caseTaskService.deleteTask(task.id).subscribe({
          next: () => {
            this.snackBar.open('Task deleted successfully', 'Close', { duration: 3000 });
            this.loadAllCaseTasks(this.caseId!);
          },
          error: (error) => {
            console.error('Error deleting task:', error);
            this.snackBar.open('Failed to delete task', 'Close', { duration: 3000 });
          }
        });
      }
    });
  }

  /**
   * Track tasks by ID for ngFor
   */
  trackTaskById(index: number, task: CaseTask): number {
    return task.id;
  }

  // ==================== New Integrated Team-Task Methods ====================

  /**
   * Get tasks assigned to a specific team member
   */
  getMemberTasks(userId: number): CaseTask[] {
    if (!Array.isArray(this.recentTasks)) {
      return [];
    }
    return this.recentTasks.filter(task => task.assignedToId === userId);
  }


  /**
   * Get overdue tasks
   */
  getOverdueTasks(): CaseTask[] {
    if (!Array.isArray(this.recentTasks)) {
      return [];
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.recentTasks.filter(task => {
      if (!task.dueDate || task.status === 'COMPLETED') return false;
      const dueDate = new Date(task.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    });
  }

  /**
   * Assign task to specific team member
   */
  assignTaskToMember(member: any): void {
    // Use member.userId if available, otherwise fall back to member.id
    const userId = member.userId || member.id;
    const memberName = member.userName || member.name || `${member.firstName} ${member.lastName}`;
    
    if (!userId) {
      this.snackBar.open('User ID not found', 'Close', { duration: 3000 });
      return;
    }

    // Get unassigned tasks for this case
    const unassignedTasks = this.getUnassignedTasks();
    
    if (!unassignedTasks || unassignedTasks.length === 0) {
      Swal.fire('No Tasks Available', 'There are no unassigned tasks available for this case.', 'info');
      return;
    }

    this.showTaskAssignmentModal(userId, memberName, unassignedTasks);
  }

  /**
   * Validate that a user is a team member before task assignment
   */
  private isUserTeamMember(userId: number): boolean {
    if (!this.caseTeamMembers || this.caseTeamMembers.length === 0) {
      return false;
    }
    
    return this.caseTeamMembers.some(member => 
      (member.userId === userId) || (member.id === userId)
    );
  }

  private showTaskAssignmentModal(userId: number, memberName: string, unassignedTasks: any[]): void {
    // Create HTML for task selection
    const tasksOptionsHtml = unassignedTasks.map(task => `
      <div class="form-check text-start mb-2">
        <input class="form-check-input task-checkbox" type="checkbox" value="${task.id}" id="task-${task.id}">
        <label class="form-check-label" for="task-${task.id}">
          <strong>${task.title}</strong>
          <br>
          <small class="text-muted">
            Priority: <span class="badge badge-${this.getPriorityBadgeClass(task.priority)}">${task.priority}</span>
            ${task.dueDate ? `| Due: ${new Date(task.dueDate).toLocaleDateString()}` : ''}
          </small>
          ${task.description ? `<br><small>${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}</small>` : ''}
        </label>
      </div>
    `).join('');

    Swal.fire({
      title: `Assign Tasks to ${memberName}`,
      html: `
        <div class="task-assignment-modal">
          <p class="text-muted mb-3">Select one or more tasks to assign to this team member:</p>
          <div class="tasks-list" style="max-height: 300px; overflow-y: auto; text-align: left;">
            ${tasksOptionsHtml}
          </div>
          <div class="mt-3">
            <button type="button" class="btn btn-sm btn-outline-primary" onclick="document.querySelectorAll('.task-checkbox').forEach(cb => cb.checked = true)">
              Select All
            </button>
            <button type="button" class="btn btn-sm btn-outline-secondary ms-2" onclick="document.querySelectorAll('.task-checkbox').forEach(cb => cb.checked = false)">
              Clear All
            </button>
          </div>
        </div>
      `,
      width: '600px',
      showCancelButton: true,
      confirmButtonText: 'Assign Selected Tasks',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#28a745',
      preConfirm: () => {
        const selectedTasks = Array.from(document.querySelectorAll('.task-checkbox:checked'))
          .map((checkbox: any) => parseInt(checkbox.value));
        
        if (selectedTasks.length === 0) {
          Swal.showValidationMessage('Please select at least one task to assign');
          return false;
        }
        
        return selectedTasks;
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.assignSelectedTasks(userId, memberName, result.value);
      }
    });
  }

  private assignSelectedTasks(userId: number, memberName: string, taskIds: number[]): void {
    // Show loading
    Swal.fire({
      title: 'Assigning Tasks...',
      text: `Assigning ${taskIds.length} task(s) to ${memberName}`,
      allowEscapeKey: false,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    // Validate taskIds to prevent undefined values
    const validTaskIds = taskIds.filter(taskId => taskId !== undefined && taskId !== null && !isNaN(taskId));

    if (validTaskIds.length === 0) {
      console.error('No valid task IDs found');
      Swal.fire({
        title: 'Assignment Failed',
        text: 'No valid tasks selected for assignment.',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }

    // Validate that the user is a team member
    if (!this.isUserTeamMember(userId)) {
      console.error('User is not a team member:', userId);
      Swal.fire({
        title: 'Assignment Failed',
        text: `User is not assigned to this case. Please add them to the team first before assigning tasks.`,
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }

    // Use the CaseTaskService to assign tasks
    const assignmentPromises = validTaskIds.map(taskId => 
      this.caseTaskService.assignTask(taskId, userId).toPromise()
    );

    Promise.all(assignmentPromises)
      .then(async (responses) => {
        // Send notification for each assigned task
        for (let i = 0; i < validTaskIds.length; i++) {
          const taskId = validTaskIds[i];
          const response = responses[i];
          
          // Get task details from response or find in recentTasks
          let taskTitle = `Task ${taskId}`;
          const existingTask = this.recentTasks.find(t => t.id === taskId);
          if (existingTask) {
            taskTitle = existingTask.title;
          } else if (response && response.data && response.data.title) {
            taskTitle = response.data.title;
          }
          
          try {
            await this.notificationTrigger.triggerTaskAssignmentWithPersonalizedMessages(
              taskId,
              taskTitle,
              userId,
              memberName,
              Number(this.caseId),
              this.case?.title,
              undefined, // dueDate
              undefined  // priority
            );
          } catch (error) {
            console.error(`Failed to send assignment notification for task ${taskId}:`, error);
          }
        }
        
        Swal.fire({
          title: 'Tasks Assigned!',
          text: `Successfully assigned ${validTaskIds.length} task(s) to ${memberName}`,
          icon: 'success',
          confirmButtonText: 'OK'
        }).then(() => {
          // Show success notification using our enhanced topbar notification method
          this.showNotification(
            `Successfully assigned ${validTaskIds.length} task(s) to ${memberName}`, 
            'success',
            { 
              caseId: this.caseId, 
              userId: userId,
              memberName: memberName,
              taskCount: validTaskIds.length 
            }
          );
          
          // Refresh task data to reflect the assignments
          if (this.caseId) {
            this.loadAllCaseTasks(this.caseId);
          }
        });
      })
      .catch((error) => {
        console.error('Error assigning tasks:', error);
        Swal.fire({
          title: 'Assignment Failed',
          text: 'Failed to assign some tasks. Please try again.',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      });
  }

  private getPriorityBadgeClass(priority: string): string {
    switch (priority?.toLowerCase()) {
      case 'high': return 'danger';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'secondary';
    }
  }

  /**
   * Quick assign task (opens assignment modal)
   */
  quickAssignTask(task: CaseTask): void {
    this.router.navigate(['/case-management/tasks', this.caseId], {
      queryParams: { 
        taskId: task.id, 
        action: 'assign' 
      }
    });
  }

  /**
   * View overdue tasks
   */
  viewOverdueTasks(): void {
    this.router.navigate(['/case-management/tasks', this.caseId], {
      queryParams: { 
        filter: 'overdue' 
      }
    });
  }

  /**
   * Balance workload (navigate to workload management)
   */
  balanceWorkload(): void {
    this.router.navigate(['/case-management/assignments'], {
      queryParams: { 
        caseId: this.caseId,
        action: 'balance' 
      }
    });
  }

  /**
   * Load all tasks for better filtering (extends the loadRecentTasks)
   */
  loadAllCaseTasks(caseId: string | number): void {
    this.isLoadingTasks = true;
    this.recentTasks = []; // Ensure it's always an array
    this.cdr.detectChanges();

    this.caseTaskService.getTasksByCaseId(Number(caseId)).subscribe({
      next: (response) => {
        // Handle different possible response structures
        let tasks = [];
        if (response?.data?.tasks?.content) {
          // Paginated response structure
          tasks = response.data.tasks.content;
        } else if (response?.data?.tasks) {
          // Direct tasks array
          tasks = response.data.tasks;
        } else if (response?.data && Array.isArray(response.data)) {
          // Direct data array
          tasks = response.data;
        }
        
        this.recentTasks = Array.isArray(tasks) ? tasks : [];
        
        // Update the context service with the loaded tasks
        this.caseContextService.updateTasks(this.recentTasks);
        
        this.isLoadingTasks = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading all case tasks:', error);
        this.recentTasks = [];
        this.isLoadingTasks = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ==================== Modal Integration Methods ====================

  /**
   * Open task assignment modal - ONLY for team members
   */
  openTaskAssignmentModal(task?: CaseTask, preSelectedUserId?: number): void {
    // For task assignment, only use team members (not all users)
    const teamMembersAsUsers = this.getTeamMembersAsUsers();
    
    if (!teamMembersAsUsers || teamMembersAsUsers.length === 0) {
      Swal.fire({
        title: 'No Team Members',
        text: 'No team members are assigned to this case. Please add team members first before assigning tasks.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }

    const modalRef = this.modalService.open(TaskAssignmentModalComponent, {
      backdrop: 'static',
      keyboard: false,
      size: 'lg'
    });

    const data: TaskAssignmentData = {
      task: task,
      caseId: Number(this.caseId),
      availableUsers: teamMembersAsUsers, // Only team members!
      preSelectedUserId: preSelectedUserId,
      mode: task?.assignedToId ? 'reassign' : 'assign'
    };

      modalRef.componentInstance.data = data;

      modalRef.componentInstance.taskAssigned.subscribe((result: any) => {
        this.handleTaskAssigned(result);
      });

      modalRef.result.then((result) => {
        if (result === 'assigned') {
          this.loadAllCaseTasks(this.caseId!);
          this.loadCaseTeam(this.caseId!);
        }
      }).catch(() => {
        // Modal dismissed
      });
  }

  /**
   * Open quick task creation modal - ONLY for team members
   */
  openQuickTaskModal(preSelectedUserId?: number, preSelectedPriority?: string): void {
    // For task creation with assignment, only use team members
    const teamMembersAsUsers = this.getTeamMembersAsUsers();
    
    const modalRef = this.modalService.open(QuickTaskModalComponent, {
      backdrop: 'static',
      keyboard: false,
      size: 'lg'
    });

    const data: QuickTaskData = {
      caseId: Number(this.caseId),
      availableUsers: teamMembersAsUsers, // Only team members!
      preSelectedUserId: preSelectedUserId,
      preSelectedPriority: preSelectedPriority
      };

      modalRef.componentInstance.data = data;

      modalRef.componentInstance.taskCreated.subscribe((result: any) => {
        this.handleTaskCreated(result);
      });

      modalRef.result.then((result) => {
        if (result === 'created') {
          this.loadAllCaseTasks(this.caseId!);
          this.loadCaseTeam(this.caseId!);
        }
      }).catch(() => {
        // Modal dismissed
      });
  }

  /**
   * Open team assignment modal
   */
  openTeamAssignmentModal(): void {
    this.loadAvailableUsers().then(() => {
      const modalRef = this.modalService.open(TeamAssignmentModalComponent, {
        backdrop: 'static',
        keyboard: false,
        size: 'xl'
      });

      const data: TeamAssignmentData = {
        caseId: Number(this.caseId),
        currentTeamMembers: this.caseTeamMembers,
        availableUsers: this.availableUsers
      };

      modalRef.componentInstance.data = data;

      modalRef.componentInstance.teamUpdated.subscribe((result: any) => {
        this.handleTeamUpdated(result);
      });

      modalRef.result.then((result) => {
        if (result === 'updated') {
          this.loadCaseTeam(this.caseId!);
          this.loadAllCaseTasks(this.caseId!);
        }
      }).catch(() => {
        // Modal dismissed
      });
    });
  }

  /**
   * Open workload balancing modal
   */
  openWorkloadBalancingModal(): void {
    const modalRef = this.modalService.open(WorkloadBalancingModalComponent, {
      backdrop: 'static',
      keyboard: false,
      size: 'xl'
    });

    const data: WorkloadBalancingData = {
      caseId: Number(this.caseId),
      teamMembers: this.caseTeamMembers,
      unassignedTasks: this.getUnassignedTasks()
    };

    modalRef.componentInstance.data = data;

    modalRef.componentInstance.workloadBalanced.subscribe((result: any) => {
      this.handleWorkloadBalanced(result);
    });

    modalRef.result.then((result) => {
      if (result === 'balanced') {
        this.loadAllCaseTasks(this.caseId!);
        this.loadCaseTeam(this.caseId!);
      }
    }).catch(() => {
      // Modal dismissed
    });
  }

  /**
   * Load available users for modals with their workload data
   */
  private async loadAvailableUsers(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.userService.getUsers().subscribe({
        next: (response) => {
          this.availableUsers = (response?.data?.users || []).map((user: any) => ({
            ...user,
            workloadPercentage: 0,
            workloadStatus: 'OPTIMAL'
          }));

          // Load workload data for each user
          this.loadUsersWorkloads(this.availableUsers).then(() => {
            resolve();
          });
        },
        error: (error) => {
          console.error('Error loading users:', error);
          this.availableUsers = [];
          reject(error);
        }
      });
    });
  }

  /**
   * Load workload data for a list of users
   */
  private async loadUsersWorkloads(users: any[]): Promise<void> {
    if (!users || users.length === 0) return;

    const workloadRequests = users.map(user =>
      this.caseAssignmentService.calculateUserWorkload(user.id).pipe(
        catchError(error => {
          console.warn(`Failed to load workload for user ${user.id}:`, error);
          return of({ data: null });
        })
      )
    );

    return new Promise((resolve) => {
      forkJoin(workloadRequests).subscribe({
        next: (responses) => {
          responses.forEach((response, index) => {
            if (response.data && users[index]) {
              const workload = response.data;
              users[index].workloadPercentage = workload.capacityPercentage || 0;
              users[index].workloadStatus = workload.workloadStatus || 'OPTIMAL';
              users[index].activeCasesCount = workload.activeCasesCount || 0;
            }
          });
          this.cdr.detectChanges();
          resolve();
        },
        error: (error) => {
          console.error('Error loading user workloads:', error);
          resolve();
        }
      });
    });
  }

  /**
   * Handle task assignment result - Enhanced with sync service
   */
  private handleTaskAssigned(result: any): void {
    if (result.action === 'assigned' && result.task && result.assignedUser) {
      const task = result.task;
      const user = result.assignedUser;
      
      // Validate task ID before assignment
      if (!task.id || task.id === undefined || task.id === null) {
        console.error('❌ Cannot assign task: task.id is undefined in handleTaskAssigned');
        this.showNotification('Task assignment failed - invalid task ID', 'error');
        return;
      }

      // Validate that the user is a team member
      if (!this.isUserTeamMember(user.id)) {
        console.error('❌ Cannot assign task: user is not a team member:', user.id);
        this.showNotification('Task assignment failed - user is not assigned to this case', 'error');
        return;
      }
      
      // Use AssignmentSyncService for coordinated assignment
      this.assignmentSyncService.assignTaskToUser(
        task.id,
        user.id,
        Number(this.caseId)
      ).subscribe({
        next: async (syncResult) => {
          if (syncResult.success) {
            // Success message through enhanced topbar notification
            this.showNotification(
              `Task "${task.title}" assigned to ${user.firstName} ${user.lastName}`,
              'success',
              {
                caseId: this.caseId,
                userId: user.id,
                memberName: `${user.firstName} ${user.lastName}`,
                taskCount: 1,
                taskId: task.id,
                taskTitle: task.title
              }
            );
            
            // Send personalized task assignment notification
            try {
              await this.notificationTrigger.triggerTaskAssignmentWithPersonalizedMessages(
                task.id,
                task.title,
                user.id,
                `${user.firstName} ${user.lastName}`,
                Number(this.caseId),
                this.case?.title,
                task.dueDate ? new Date(task.dueDate).toLocaleDateString() : undefined,
                task.priority
              );
            } catch (error) {
              console.error('Failed to send personalized task assignment notification:', error);
            }
            
            // Log the assignment change (safe method)
            this.safeAuditLog(() => {
              this.auditLogService.logAssignmentChange(
                'task',
                task.id,
                task.title,
                'TASK_ASSIGNED',
                undefined,
                `${user.firstName} ${user.lastName}`,
                'CaseDetail'
              );
            });
            
            // Context service will be updated automatically by sync service
          } else {
            this.showNotification('Failed to assign task', 'error');
          }
        },
        error: (error) => {
          console.error('Task assignment failed:', error);
          this.showNotification('Failed to assign task', 'error');
        }
      });
    }
  }

  /**
   * Handle task creation result - Enhanced with sync service
   */
  private async handleTaskCreated(result: any): Promise<void> {
    if (result.action === 'created' && result.task) {
      const task = result.task;

      // Handle undefined task title with fallback
      const taskTitle = task.title || task.name || 'New Task';
      let message = `Task "${taskTitle}" created successfully`;

      // ALWAYS trigger task creation notification to notify team members about new tasks
      if (task.id) {
        const assigneeName = task.assignedToId && task.assignedToName ? task.assignedToName : 'Unassigned';
        
        try {
          await this.notificationTrigger.triggerTaskCreated(
            task.id,
            taskTitle,
            assigneeName,
            Number(this.caseId),
            this.case?.title,
            task.dueDate ? new Date(task.dueDate).toLocaleDateString() : undefined
          );
        } catch (error) {
          console.error('Failed to send task creation notification:', error);
        }
      }
      
      // Check if task was assigned during creation - use task data instead of modal data
      if (task.assignedToId && task.assignedToName) {
        message += ` and assigned to ${task.assignedToName}`;

        // Additionally, send specific assignment notification
        try {
          await this.notificationTrigger.triggerTaskAssignmentWithPersonalizedMessages(
            task.id,
            taskTitle,
            task.assignedToId,
            task.assignedToName,
            Number(this.caseId),
            this.case?.title,
            task.dueDate ? new Date(task.dueDate).toLocaleDateString() : undefined,
            task.priority
          );
        } catch (error) {
          console.error('Failed to send task assignment notification:', error);
        }
        
        // Show notification for task with assignment
        this.showNotification(message, 'success', {
          caseId: this.caseId,
          taskId: task.id,
          taskTitle: taskTitle,
          assignedTo: task.assignedToName,
          action: 'TASK_CREATED_AND_ASSIGNED'
        });
        
        // Refresh the tasks and team data
        this.loadAllCaseTasks(this.caseId!);
        this.loadCaseTeam(this.caseId!);
      } else if (result.assignedUser && task.id) {
        // Fallback to modal selected user if task doesn't have assignment info
        const user = result.assignedUser;
        message += ` and assigned to ${user.firstName} ${user.lastName}`;
        
        // Validate task ID before assignment
        if (!task.id || task.id === undefined || task.id === null) {
          console.error('Cannot assign task: task.id is undefined');
          this.showNotification('Task created but assignment failed - invalid task ID', 'info');
          return;
        }

        // Use sync service for the assignment part
        this.assignmentSyncService.assignTaskToUser(
          task.id,
          user.id,
          Number(this.caseId)
        ).subscribe({
          next: async (syncResult) => {
            if (syncResult.success) {
              // Send task assignment notification
              try {
                await this.notificationTrigger.triggerTaskAssignmentWithPersonalizedMessages(
                  task.id,
                  taskTitle,
                  user.id,
                  `${user.firstName} ${user.lastName}`,
                  Number(this.caseId),
                  this.case?.title,
                  task.dueDate ? new Date(task.dueDate).toLocaleDateString() : undefined,
                  task.priority
                );
              } catch (error) {
                console.error('Failed to send task assignment notification:', error);
              }
              
              // Show enhanced notification for task creation + assignment
              this.showNotification(message, 'success', {
                caseId: this.caseId,
                userId: user.id,
                memberName: `${user.firstName} ${user.lastName}`,
                taskCount: 1,
                taskId: task.id,
                taskTitle: taskTitle
              });
              
              // Log both creation and assignment (safe method)
              this.safeAuditLog(() => {
                this.auditLogService.log({
                  action: 'TASK_CREATED_AND_ASSIGNED',
                  entityType: 'task',
                  entityId: task.id,
                  entityName: task.title,
                  component: 'CaseDetail',
                  severity: 'LOW',
                  category: 'USER_ACTION',
                  metadata: {
                    assigned: true,
                    assignee: `${user.firstName} ${user.lastName}`,
                    caseId: this.caseId
                  }
                });
              });
            }
          },
          error: (error) => {
            console.error('Task assignment failed:', error);
            this.showNotification('Task created but assignment failed', 'info');
          }
        });
      } else {
        // Just task creation (no assignment)
        this.showNotification(message, 'success', {
          caseId: this.caseId,
          taskId: task.id,
          taskTitle: taskTitle,
          action: 'TASK_CREATED'
        });
        
        // Log task creation (safe method)
        this.safeAuditLog(() => {
          this.auditLogService.log({
            action: 'TASK_CREATED',
            entityType: 'task',
            entityId: task.id,
            entityName: task.title,
            component: 'CaseDetail',
            severity: 'LOW',
            category: 'USER_ACTION',
            metadata: {
              assigned: false,
              caseId: this.caseId
            }
          });
        });
      }
    }
  }

  /**
   * Handle team update result - Enhanced with sync service
   */
  private handleTeamUpdated(result: any): void {
    if (result.action === 'team_updated') {
      let message = 'Team updated successfully';
      const promises: Promise<any>[] = [];
      
      // Handle added members using sync service
      if (result.addedMembers && result.addedMembers.length > 0) {
        message += ` - Added ${result.addedMembers.length} member(s)`;
        
        result.addedMembers.forEach((member: any) => {
          const assignmentPromise = this.assignmentSyncService.assignUserToCase({
            caseId: Number(this.caseId),
            userId: member.userId,
            roleType: member.roleType || 'ASSOCIATE',
            workloadWeight: 1.0,
            notes: 'Added via team assignment modal'
          }).toPromise();
          
          promises.push(assignmentPromise);
        });
      }
      
      // Handle removed members
      if (result.removedMembers && result.removedMembers.length > 0) {
        message += ` - Removed ${result.removedMembers.length} member(s)`;
        
        result.removedMembers.forEach((member: any) => {
          const unassignPromise = this.assignmentSyncService.unassignUserFromCase(
            Number(this.caseId),
            member.userId,
            'Team restructuring'
          ).toPromise();
          
          promises.push(unassignPromise);
        });
      }
      
      // Wait for all assignment operations to complete
      Promise.all(promises).then(() => {
        this.showNotification(message, 'success');
        
        // Log team update (safe method)
        this.safeAuditLog(() => {
          this.auditLogService.log({
            action: 'TEAM_UPDATED',
            entityType: 'case',
            entityId: Number(this.caseId!),
            entityName: this.case?.title || `Case ${this.caseId}`,
            component: 'CaseDetail',
            severity: 'MEDIUM',
            category: 'USER_ACTION',
            metadata: {
              addedCount: result.addedMembers?.length || 0,
              removedCount: result.removedMembers?.length || 0,
              addedMembers: result.addedMembers?.map((m: any) => m.userName) || [],
              removedMembers: result.removedMembers?.map((m: any) => m.userName) || []
            }
          });
        });
      }).catch((error) => {
        console.error('Team update failed:', error);
        this.showNotification('Some team changes failed', 'error');
      });
    }
  }

  /**
   * Log case access for audit purposes
   */
  private logCaseAccess(caseId: number, accessType: 'VIEW' | 'EDIT' | 'DELETE'): void {
    // Wait for case data to be loaded first
    this.caseContextService.getCurrentCase().pipe(
      takeUntil(this.destroy$)
    ).subscribe(caseData => {
      if (caseData) {
        // Log case access (safe method)
        this.safeAuditLog(() => {
          this.auditLogService.logCaseAccess(
            caseId,
            caseData.title || `Case ${caseData.caseNumber}`,
            accessType,
            'CaseDetail'
          );
        });
      }
    });
  }

  /**
   * Handle workload balancing result
   */
  private handleWorkloadBalanced(result: any): void {
    if (result.action === 'workload_balanced') {
      this.snackBar.open(
        `Workload balanced successfully - ${result.reassignments.length} task(s) reassigned`,
        'Close',
        { duration: 4000 }
      );
    }
  }


  /**
   * Get unassigned tasks for this case
   */
  getUnassignedTasks(): CaseTask[] {
    if (!this.recentTasks) {
      return [];
    }

    return this.recentTasks.filter(task => !task.assignedToId);
  }

  /**
   * Calculate and return average workload percentage for team members
   */
  getAverageWorkload(): number {
    if (!this.caseTeamMembers || this.caseTeamMembers.length === 0) return 0;
    
    const totalWorkload = this.caseTeamMembers.reduce((sum, member) => {
      return sum + (member.workloadPercentage || 0);
    }, 0);
    
    return Math.round(totalWorkload / this.caseTeamMembers.length);
  }

  /**
   * Get count of unassigned tasks
   */
  getUnassignedTasksCount(): number {
    const unassignedTasks = this.getUnassignedTasks();
    return unassignedTasks ? unassignedTasks.length : 0;
  }

  /**
   * Get all tasks for the case
   */
  getAllTasks(): CaseTask[] {
    return this.recentTasks || [];
  }

  /**
   * Get completed tasks
   */
  getCompletedTasks(): CaseTask[] {
    return this.recentTasks?.filter(task => task.status === 'COMPLETED') || [];
  }

  /**
   * Get in progress tasks
   */
  getInProgressTasks(): CaseTask[] {
    return this.recentTasks?.filter(task => task.status === 'IN_PROGRESS') || [];
  }

  /**
   * Get tasks in review
   */
  getTasksInReview(): CaseTask[] {
    return this.recentTasks?.filter(task => task.status === 'REVIEW') || [];
  }

  /**
   * Calculate case progress percentage based on completed tasks
   */
  getCaseProgressPercentage(): number {
    const totalTasks = this.getAllTasks().length;
    if (totalTasks === 0) return 0;
    
    const completedTasks = this.getCompletedTasks().length;
    return Math.round((completedTasks / totalTasks) * 100);
  }

  /**
   * Get tasks with upcoming deadlines (within 3 days)
   */
  getUpcomingDeadlines(): CaseTask[] {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    
    return this.recentTasks?.filter(task => {
      if (!task.dueDate) return false;
      const dueDate = new Date(task.dueDate);
      const today = new Date();
      return dueDate >= today && dueDate <= threeDaysFromNow && task.status !== 'COMPLETED';
    }) || [];
  }

  /**
   * View upcoming deadlines
   */
  viewUpcomingDeadlines(): void {
    const upcomingTasks = this.getUpcomingDeadlines();
    const taskList = upcomingTasks.map(task => 
      `• ${task.title} (Due: ${new Date(task.dueDate!).toLocaleDateString()})`
    ).join('\n');

    Swal.fire({
      title: 'Upcoming Deadlines',
      text: upcomingTasks.length > 0 ? taskList : 'No upcoming deadlines',
      icon: 'info',
      confirmButtonText: 'OK'
    });
  }

  /**
   * Get team efficiency tip based on current workload and task distribution
   */
  getTeamEfficiencyTip(): string | null {
    const totalTasks = this.getAllTasks().length;
    const unassignedTasks = this.getUnassignedTasks().length;
    const overdueTasks = this.getOverdueTasks().length;
    const teamMembers = this.caseTeamMembers?.length || 0;

    if (totalTasks === 0) return null;

    if (unassignedTasks > totalTasks * 0.3) {
      return 'Consider assigning unassigned tasks to balance workload across team members.';
    }

    if (overdueTasks > 0) {
      return 'Focus on completing overdue tasks first to keep the case on track.';
    }

    if (teamMembers > 0 && this.getOverCapacityCount() > 0) {
      return 'Some team members are overloaded. Consider redistributing tasks for better efficiency.';
    }

    if (this.getInProgressTasks().length > this.getCompletedTasks().length * 2) {
      return 'Too many tasks in progress. Focus on completing current tasks before starting new ones.';
    }

    if (this.getCaseProgressPercentage() > 75) {
      return 'Great progress! Consider reviewing completed work and preparing for case conclusion.';
    }

    return null;
  }

  // ========================
  // Practice Area Field Methods
  // ========================

  /**
   * Load practice area fields based on the case's practice area or type
   */
  loadPracticeAreaFields(): void {
    if (!this.case) return;

    // Get practice area from case
    let practiceArea = (this.case as any).practiceArea;

    // If no practiceArea set, try to map from type
    if (!practiceArea && this.case.type) {
      practiceArea = this.mapTypeToArea(this.case.type);
    }

    // If still no match, check if the type itself is a valid practice area key
    if (!practiceArea && this.case.type && this.practiceAreaFieldsConfig[this.case.type]) {
      practiceArea = this.case.type;
    }

    // Get the practice area configuration
    this.currentPracticeAreaSections = practiceArea ? (this.practiceAreaFieldsConfig[practiceArea] || []) : [];

    // Add form controls for practice area fields when in edit mode
    if (this.isEditing && this.currentPracticeAreaSections.length > 0) {
      this.addPracticeAreaFormControls();
    }
  }

  /**
   * Map case type to practice area for backwards compatibility
   */
  private mapTypeToArea(type: string): string {
    if (!type) return '';

    // First try exact match
    if (TYPE_TO_PRACTICE_AREA[type]) {
      return TYPE_TO_PRACTICE_AREA[type];
    }

    // Try case-insensitive match
    const typeUpper = type.toUpperCase();
    for (const [key, value] of Object.entries(TYPE_TO_PRACTICE_AREA)) {
      if (key.toUpperCase() === typeUpper) {
        return value;
      }
    }

    return '';
  }

  /**
   * Add form controls for practice area specific fields
   */
  private addPracticeAreaFormControls(): void {
    this.currentPracticeAreaSections.forEach(section => {
      section.fields.forEach(field => {
        if (!this.editForm.contains(field.name)) {
          const value = this.getFieldValue(field.name);
          this.editForm.addControl(field.name, this.fb.control(value));
        } else {
          this.editForm.get(field.name)?.setValue(this.getFieldValue(field.name));
        }
      });
    });
  }

  /**
   * Get the value of a practice area field from the case object
   */
  getFieldValue(fieldName: string): any {
    if (!this.case) return null;
    return (this.case as any)[fieldName] ?? null;
  }

  /**
   * Get the label for a select option value
   */
  getLabelForSelectValue(field: PracticeAreaField, value: string): string {
    if (!field.options || !value) return value || '';
    const option = field.options.find(o => o.value === value);
    return option ? option.label : value;
  }

  /**
   * Initialize date pickers for practice area date fields
   */
  private initPracticeAreaDatePickers(): void {
    // Destroy existing pickers
    this.destroyPracticeAreaDatePickers();

    // Wait for DOM to be ready
    setTimeout(() => {
      this.currentPracticeAreaSections.forEach(section => {
        section.fields.forEach(field => {
          if (field.type === 'date') {
            const element = document.getElementById(`pa_edit_${field.name}`);
            if (element) {
              const currentValue = this.editForm.get(field.name)?.value;
              const defaultDate = currentValue ? new Date(currentValue) : null;

              const picker = flatpickr(element, {
                dateFormat: 'Y-m-d',
                altInput: true,
                altFormat: 'F j, Y',
                allowInput: true,
                defaultDate: defaultDate,
                onChange: (selectedDates) => {
                  if (selectedDates.length > 0) {
                    this.editForm.get(field.name)?.setValue(selectedDates[0]);
                  }
                }
              });
              this.practiceAreaDatePickers.push(picker);
            }
          }
        });
      });
    }, 100);
  }

  /**
   * Destroy all practice area date pickers
   */
  private destroyPracticeAreaDatePickers(): void {
    this.practiceAreaDatePickers.forEach(picker => {
      if (picker && typeof picker.destroy === 'function') {
        picker.destroy();
      }
    });
    this.practiceAreaDatePickers = [];
  }

  /**
   * Get all practice area field names for cleanup
   */
  private getAllPracticeAreaFieldNames(): string[] {
    const fieldNames: string[] = [];
    Object.values(this.practiceAreaFieldsConfig).forEach(sections => {
      sections.forEach(section => {
        section.fields.forEach(field => {
          if (!fieldNames.includes(field.name)) {
            fieldNames.push(field.name);
          }
        });
      });
    });
    return fieldNames;
  }
}