import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, BehaviorSubject, forkJoin, of } from 'rxjs';
import { map, tap, catchError, switchMap, takeUntil } from 'rxjs/operators';
import { CaseAssignmentService } from '../../service/case-assignment.service';
import { CaseTaskService } from '../../service/case-task.service';
import { NotificationService } from '../../service/notification.service';
import { CaseContextService } from './case-context.service';
import { WebSocketService } from './websocket.service';
import { UserService } from '../../service/user.service';
import { CaseAssignment, CaseAssignmentRequest, CaseTransferRequest, TransferUrgency } from '../../interface/case-assignment';
import { CaseTask, TaskUpdateRequest } from '../../interface/case-task';
import { User } from '../../interface/user';

export interface AssignmentChange {
  type: 'CASE_ASSIGNMENT' | 'TASK_ASSIGNMENT' | 'CASE_REASSIGNMENT' | 'TASK_REASSIGNMENT' | 'UNASSIGNMENT';
  entityId: number;
  entityType: 'case' | 'task';
  userId: number;
  previousUserId?: number;
  assignmentData?: any;
  metadata: {
    initiatedBy: number;
    timestamp: Date;
    reason?: string;
    component: string;
  };
}

export interface SyncResult {
  success: boolean;
  data?: any;
  error?: string;
  affectedUsers: number[];
}

@Injectable({
  providedIn: 'root'
})
export class AssignmentSyncService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private syncInProgress$ = new BehaviorSubject<boolean>(false);
  private assignmentQueue$ = new Subject<AssignmentChange>();

  // Current user for metadata
  private currentUser: User | null = null;

  constructor(
    private caseAssignmentService: CaseAssignmentService,
    private caseTaskService: CaseTaskService,
    private notificationService: NotificationService,
    private caseContextService: CaseContextService,
    private webSocketService: WebSocketService,
    private userService: UserService
  ) {
    this.initializeUserSubscription();
    this.initializeAssignmentQueue();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== Public API ====================

  /**
   * Assign user to case
   */
  assignUserToCase(request: CaseAssignmentRequest): Observable<SyncResult> {
    const change: AssignmentChange = {
      type: 'CASE_ASSIGNMENT',
      entityId: request.caseId,
      entityType: 'case',
      userId: request.userId,
      assignmentData: request,
      metadata: {
        initiatedBy: this.currentUser?.id || 0,
        timestamp: new Date(),
        component: 'AssignmentSyncService'
      }
    };

    return this.processCaseAssignment(change);
  }

  /**
   * Reassign case to different user
   */
  reassignCase(caseId: number, fromUserId: number, toUserId: number, reason?: string): Observable<SyncResult> {
    const change: AssignmentChange = {
      type: 'CASE_REASSIGNMENT',
      entityId: caseId,
      entityType: 'case',
      userId: toUserId,
      previousUserId: fromUserId,
      metadata: {
        initiatedBy: this.currentUser?.id || 0,
        timestamp: new Date(),
        reason,
        component: 'AssignmentSyncService'
      }
    };

    return this.processCaseReassignment(change);
  }

  /**
   * Assign task to user
   */
  assignTaskToUser(taskId: number, userId: number, caseId: number): Observable<SyncResult> {
    // Validate inputs to prevent undefined values
    if (!taskId || taskId === undefined || taskId === null || isNaN(taskId)) {
      console.error('❌ AssignmentSyncService: Invalid taskId:', taskId);
      return of({
        success: false,
        error: 'Invalid task ID provided',
        affectedUsers: []
      });
    }
    
    if (!userId || userId === undefined || userId === null || isNaN(userId)) {
      console.error('❌ AssignmentSyncService: Invalid userId:', userId);
      return of({
        success: false,
        error: 'Invalid user ID provided',
        affectedUsers: []
      });
    }
    
    // Note: Team membership validation should be done at the UI level
    // The backend will ultimately enforce this business rule
    console.log('🔧 AssignmentSyncService.assignTaskToUser:', { taskId, userId, caseId });
    
    const change: AssignmentChange = {
      type: 'TASK_ASSIGNMENT',
      entityId: taskId,
      entityType: 'task',
      userId: userId,
      assignmentData: { caseId },
      metadata: {
        initiatedBy: this.currentUser?.id || 0,
        timestamp: new Date(),
        component: 'AssignmentSyncService'
      }
    };

    return this.processTaskAssignment(change);
  }

  /**
   * Reassign task to different user
   */
  reassignTask(taskId: number, fromUserId: number, toUserId: number, caseId: number, reason?: string): Observable<SyncResult> {
    const change: AssignmentChange = {
      type: 'TASK_REASSIGNMENT',
      entityId: taskId,
      entityType: 'task',
      userId: toUserId,
      previousUserId: fromUserId,
      assignmentData: { caseId },
      metadata: {
        initiatedBy: this.currentUser?.id || 0,
        timestamp: new Date(),
        reason,
        component: 'AssignmentSyncService'
      }
    };

    return this.processTaskReassignment(change);
  }

  /**
   * Unassign user from case
   */
  unassignUserFromCase(caseId: number, userId: number, reason?: string): Observable<SyncResult> {
    const change: AssignmentChange = {
      type: 'UNASSIGNMENT',
      entityId: caseId,
      entityType: 'case',
      userId: userId,
      metadata: {
        initiatedBy: this.currentUser?.id || 0,
        timestamp: new Date(),
        reason,
        component: 'AssignmentSyncService'
      }
    };

    return this.processUnassignment(change);
  }

  /**
   * Update task status with sync tracking
   */
  updateTaskStatus(
    taskId: number, 
    oldStatus: string, 
    newStatus: string, 
    caseId: number, 
    reason?: string
  ): Observable<SyncResult> {
    this.syncInProgress$.next(true);

    const updateData: TaskUpdateRequest = {
      status: newStatus as any
    };

    return this.caseTaskService.updateTask(taskId, updateData).pipe(
      switchMap(response => {
        const updatedTask = response.data;
        
        // Update context service
        this.caseContextService.updateTask(updatedTask);
        
        // Broadcast change via WebSocket
        const change: AssignmentChange = {
          type: 'TASK_ASSIGNMENT',
          entityId: taskId,
          entityType: 'task',
          userId: updatedTask.assignedToId || 0,
          assignmentData: { 
            caseId,
            oldStatus,
            newStatus,
            taskTitle: updatedTask.title
          },
          metadata: {
            initiatedBy: this.currentUser?.id || 0,
            timestamp: new Date(),
            reason: reason || `Status changed from ${oldStatus} to ${newStatus}`,
            component: 'TaskManagement'
          }
        };

        this.broadcastChange(change, updatedTask);
        
        this.syncInProgress$.next(false);
        return of({
          success: true,
          data: updatedTask,
          affectedUsers: updatedTask.assignedToId ? [updatedTask.assignedToId] : []
        });
      }),
      catchError(error => {
        console.error('Failed to update task status:', error);
        this.syncInProgress$.next(false);
        return of({
          success: false,
          error: error.message || 'Failed to update task status',
          affectedUsers: []
        });
      })
    );
  }

  /**
   * Get sync status
   */
  getSyncStatus(): Observable<boolean> {
    return this.syncInProgress$.asObservable();
  }

  /**
   * Force sync all assignments for a case
   */
  forceSyncCase(caseId: number): Observable<SyncResult> {
    return forkJoin({
      assignments: this.caseAssignmentService.getCaseAssignments(caseId),
      tasks: this.caseTaskService.getTasksByCaseId(caseId)
    }).pipe(
      tap(({ assignments, tasks }) => {
        // Update context service with fresh data
        this.caseContextService.updateCaseTeam(assignments.data || []);
        this.caseContextService.updateTasks(tasks.data?.tasks?.content || tasks.data?.content || []);
      }),
      map(() => ({ success: true, affectedUsers: [] })),
      catchError(error => {
        console.error('Failed to force sync case:', error);
        return of({ success: false, error: error.message, affectedUsers: [] });
      })
    );
  }

  // ==================== Private Processing Methods ====================

  private processCaseAssignment(change: AssignmentChange): Observable<SyncResult> {
    this.syncInProgress$.next(true);

    return this.caseAssignmentService.assignCase(change.assignmentData).pipe(
      switchMap((response) => {
        const assignment = response.data;
        
        // Update context
        this.caseContextService.addTeamMember(assignment);
        
        // Broadcast to WebSocket
        this.broadcastChange(change, assignment);
        
        // Send notifications
        return this.sendAssignmentNotifications(change, assignment).pipe(
          map(() => ({
            success: true,
            data: assignment,
            affectedUsers: [change.userId]
          }))
        );
      }),
      tap(() => this.syncInProgress$.next(false)),
      catchError(error => {
        this.syncInProgress$.next(false);
        console.error('Failed to process case assignment:', error);
        this.notificationService.onError('Failed to assign user to case');
        return of({
          success: false,
          error: error.message,
          affectedUsers: []
        });
      })
    );
  }

  private processCaseReassignment(change: AssignmentChange): Observable<SyncResult> {
    this.syncInProgress$.next(true);

    // First get case info
    return this.caseContextService.getCurrentCase().pipe(
      switchMap(caseData => {
        if (!caseData) {
          throw new Error('Case not found');
        }

        // Create transfer request
        const transferRequest: CaseTransferRequest = {
          caseId: change.entityId,
          fromUserId: change.previousUserId!,
          toUserId: change.userId,
          reason: change.metadata.reason || 'Case reassignment',
          urgency: TransferUrgency.MEDIUM
        };

        return this.caseAssignmentService.transferCase(transferRequest);
      }),
      switchMap((response) => {
        const assignment = response.data;
        
        // Update context - add or update team member
        const currentTeam = this.caseContextService.getCaseTeamSnapshot();
        const existingIndex = currentTeam.findIndex(member => member.userId === assignment.userId);
        if (existingIndex >= 0) {
          // Update existing member
          currentTeam[existingIndex] = assignment;
          this.caseContextService.updateCaseTeam([...currentTeam]);
        } else {
          // Add new member
          this.caseContextService.addTeamMember(assignment);
        }
        
        // Broadcast change
        this.broadcastChange(change, assignment);
        
        // Send notifications to both users
        return this.sendReassignmentNotifications(change, assignment).pipe(
          map(() => ({
            success: true,
            data: assignment,
            affectedUsers: [change.userId, change.previousUserId!].filter(id => id)
          }))
        );
      }),
      tap(() => this.syncInProgress$.next(false)),
      catchError(error => {
        this.syncInProgress$.next(false);
        console.error('Failed to process case reassignment:', error);
        this.notificationService.onError('Failed to reassign case');
        return of({
          success: false,
          error: error.message,
          affectedUsers: []
        });
      })
    );
  }

  private processTaskAssignment(change: AssignmentChange): Observable<SyncResult> {
    this.syncInProgress$.next(true);

    // Additional validation in processTaskAssignment
    if (!change.entityId || change.entityId === undefined || change.entityId === null || isNaN(change.entityId)) {
      this.syncInProgress$.next(false);
      console.error('❌ processTaskAssignment: Invalid entityId (taskId):', change.entityId);
      return of({
        success: false,
        error: 'Invalid task ID in assignment change',
        affectedUsers: []
      });
    }

    console.log('🔧 processTaskAssignment with validated entityId:', change.entityId);

    const updateData: TaskUpdateRequest = {
      assignedToId: change.userId
    };

    return this.caseTaskService.updateTask(change.entityId, updateData).pipe(
      switchMap((response) => {
        const task = response.data;
        
        // Update context
        this.caseContextService.updateTask(task);
        
        // Broadcast change
        this.broadcastChange(change, task);
        
        // Send notification
        return this.sendTaskAssignmentNotifications(change, task).pipe(
          map(() => ({
            success: true,
            data: task,
            affectedUsers: [change.userId]
          }))
        );
      }),
      tap(() => this.syncInProgress$.next(false)),
      catchError(error => {
        this.syncInProgress$.next(false);
        console.error('Failed to process task assignment:', error);
        this.notificationService.onError('Failed to assign task');
        return of({
          success: false,
          error: error.message,
          affectedUsers: []
        });
      })
    );
  }

  private processTaskReassignment(change: AssignmentChange): Observable<SyncResult> {
    this.syncInProgress$.next(true);

    const updateData: TaskUpdateRequest = {
      assignedToId: change.userId
    };

    return this.caseTaskService.updateTask(change.entityId, updateData).pipe(
      switchMap((response) => {
        const task = response.data;
        
        // Update context
        this.caseContextService.updateTask(task);
        
        // Broadcast change
        this.broadcastChange(change, task);
        
        // Send notifications to both users
        return this.sendTaskReassignmentNotifications(change, task).pipe(
          map(() => ({
            success: true,
            data: task,
            affectedUsers: [change.userId, change.previousUserId!].filter(id => id)
          }))
        );
      }),
      tap(() => this.syncInProgress$.next(false)),
      catchError(error => {
        this.syncInProgress$.next(false);
        console.error('Failed to process task reassignment:', error);
        this.notificationService.onError('Failed to reassign task');
        return of({
          success: false,
          error: error.message,
          affectedUsers: []
        });
      })
    );
  }

  private processUnassignment(change: AssignmentChange): Observable<SyncResult> {
    this.syncInProgress$.next(true);

    return this.caseAssignmentService.unassignCase(
      change.entityId, 
      change.userId, 
      change.metadata.reason || 'User unassigned'
    ).pipe(
      tap(() => {
        // Update context
        this.caseContextService.removeTeamMember(change.userId);
        
        // Broadcast change
        this.broadcastChange(change, null);
        
        // Send notification
        this.sendUnassignmentNotification(change);
      }),
      map(() => ({
        success: true,
        affectedUsers: [change.userId]
      })),
      tap(() => this.syncInProgress$.next(false)),
      catchError(error => {
        this.syncInProgress$.next(false);
        console.error('Failed to process unassignment:', error);
        this.notificationService.onError('Failed to unassign user');
        return of({
          success: false,
          error: error.message,
          affectedUsers: []
        });
      })
    );
  }

  // ==================== Notification Methods ====================

  private sendAssignmentNotifications(change: AssignmentChange, assignment: CaseAssignment): Observable<void> {
    const caseData = this.caseContextService.getCurrentCaseSnapshot();
    if (!caseData) return of();

    return this.notificationService.notifyCaseAssignment(
      change.userId,
      change.entityId,
      caseData.title || `Case #${caseData.caseNumber}`,
      assignment.roleType
    ).pipe(
      map(() => void 0),
      catchError(() => of())
    );
  }

  private sendTaskAssignmentNotifications(change: AssignmentChange, task: CaseTask): Observable<void> {
    return this.notificationService.notifyTaskAssignment(
      change.userId,
      change.entityId,
      task.title,
      change.assignmentData?.caseId || task.caseId
    ).pipe(
      map(() => void 0),
      catchError(() => of())
    );
  }

  private sendReassignmentNotifications(change: AssignmentChange, assignment: CaseAssignment): Observable<void> {
    const caseData = this.caseContextService.getCurrentCaseSnapshot();
    if (!caseData) return of();

    // Notify new assignee
    const newAssigneeNotification = this.notificationService.notifyCaseAssignment(
      change.userId,
      change.entityId,
      caseData.title || `Case #${caseData.caseNumber}`,
      assignment.roleType
    );

    // Notify previous assignee if exists
    const previousAssigneeNotification = change.previousUserId ? 
      this.notificationService.sendToUser({
        userId: change.previousUserId,
        type: 'CASE_UPDATE',
        priority: 'MEDIUM',
        title: 'Case Reassigned',
        message: `Case "${caseData.title || caseData.caseNumber}" has been reassigned to another team member`,
        data: { caseId: change.entityId, reason: change.metadata.reason },
        relatedEntityId: change.entityId,
        relatedEntityType: 'case'
      }) : of(null);

    return forkJoin([newAssigneeNotification, previousAssigneeNotification]).pipe(
      map(() => void 0),
      catchError(() => of())
    );
  }

  private sendTaskReassignmentNotifications(change: AssignmentChange, task: CaseTask): Observable<void> {
    // Notify new assignee
    const newAssigneeNotification = this.notificationService.notifyTaskAssignment(
      change.userId,
      change.entityId,
      task.title,
      task.caseId
    );

    // Notify previous assignee if exists
    const previousAssigneeNotification = change.previousUserId ? 
      this.notificationService.sendToUser({
        userId: change.previousUserId,
        type: 'TASK',
        priority: 'MEDIUM',
        title: 'Task Reassigned',
        message: `Task "${task.title}" has been reassigned to another team member`,
        data: { taskId: change.entityId, caseId: task.caseId, reason: change.metadata.reason },
        relatedEntityId: change.entityId,
        relatedEntityType: 'task'
      }) : of(null);

    return forkJoin([newAssigneeNotification, previousAssigneeNotification]).pipe(
      map(() => void 0),
      catchError(() => of())
    );
  }

  private sendUnassignmentNotification(change: AssignmentChange): void {
    const caseData = this.caseContextService.getCurrentCaseSnapshot();
    if (!caseData) return;

    this.notificationService.sendToUser({
      userId: change.userId,
      type: 'CASE_UPDATE',
      priority: 'MEDIUM',
      title: 'Removed from Case',
      message: `You have been removed from case "${caseData.title || caseData.caseNumber}"`,
      data: { caseId: change.entityId, reason: change.metadata.reason },
      relatedEntityId: change.entityId,
      relatedEntityType: 'case'
    }).subscribe();
  }

  // ==================== WebSocket Broadcasting ====================

  private broadcastChange(change: AssignmentChange, data: any): void {
    const message = {
      type: `assignment.${change.type.toLowerCase()}`,
      data: {
        change,
        result: data
      },
      caseId: change.entityType === 'case' ? change.entityId : change.assignmentData?.caseId,
      userId: change.userId,
      timestamp: change.metadata.timestamp.getTime()
    };

    this.webSocketService.sendMessage(message);
  }

  // ==================== Private Helpers ====================

  private initializeUserSubscription(): void {
    this.userService.userData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
      });
  }

  private initializeAssignmentQueue(): void {
    // Future enhancement: Process assignment changes in queue
    this.assignmentQueue$
      .pipe(takeUntil(this.destroy$))
      .subscribe(change => {
        console.log('Assignment change queued:', change);
      });
  }
}