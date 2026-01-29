import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import Swal from 'sweetalert2';

/**
 * Task types supported by the background task service
 */
export type BackgroundTaskType = 'question' | 'draft' | 'analysis' | 'workflow';

/**
 * Task status
 */
export type BackgroundTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Interface for a background task
 */
export interface BackgroundTask {
  id: string;
  type: BackgroundTaskType;
  title: string;
  description?: string;
  status: BackgroundTaskStatus;
  progress?: number; // 0-100 for tasks with progress
  startedAt: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
  // Context for navigation
  conversationId?: string;
  backendConversationId?: number;
  documentId?: number;
  workflowId?: number;
  analysisIds?: number[];
  researchMode?: 'FAST' | 'THOROUGH'; // Research mode used for question tasks
}

/**
 * BackgroundTaskService - Manages AI tasks that continue running when user navigates away
 *
 * This service:
 * - Tracks running tasks independently of component lifecycle
 * - Sends push notifications when tasks complete
 * - Stores results for retrieval when user returns
 * - Provides navigation to completed task results
 */
@Injectable({
  providedIn: 'root'
})
export class BackgroundTaskService {

  // Store all tasks
  private tasksSubject = new BehaviorSubject<BackgroundTask[]>([]);
  public tasks$ = this.tasksSubject.asObservable();

  // Active subscriptions (keyed by task ID)
  private activeSubscriptions = new Map<string, Subscription>();

  // Subject for completed task notifications (consumed by AI Workspace)
  private completedTaskSubject = new Subject<BackgroundTask>();
  public completedTask$ = this.completedTaskSubject.asObservable();

  // Track if user is currently on AI workspace
  private isOnAiWorkspace = false;

  // Store pending navigation for when user clicks View Result
  private pendingNavigation: { conversationId?: string; backendConversationId?: number; workflowId?: number; taskType?: string; analysisIds?: Array<{id: string; databaseId: number; fileName: string}> } | null = null;

  constructor(private router: Router) {
  }

  /**
   * Set whether user is currently on AI workspace
   * Used to determine if we should show notifications
   */
  setIsOnAiWorkspace(isOn: boolean): void {
    this.isOnAiWorkspace = isOn;
  }

  /**
   * Register a new background task
   */
  registerTask(
    type: BackgroundTaskType,
    title: string,
    description?: string,
    context?: {
      conversationId?: string;
      backendConversationId?: number;
      documentId?: number;
      workflowId?: number;
      researchMode?: 'FAST' | 'THOROUGH';
    }
  ): string {
    const id = this.generateTaskId();

    const task: BackgroundTask = {
      id,
      type,
      title,
      description,
      status: 'pending',
      startedAt: new Date(),
      ...context
    };

    const tasks = [...this.tasksSubject.value, task];
    this.tasksSubject.next(tasks);

    return id;
  }

  /**
   * Start a task (change status from pending to running)
   */
  startTask(taskId: string): void {
    this.updateTask(taskId, { status: 'running' });
  }

  /**
   * Update task progress
   */
  updateTaskProgress(taskId: string, progress: number, description?: string): void {
    const updates: Partial<BackgroundTask> = { progress };
    if (description) {
      updates.description = description;
    }
    this.updateTask(taskId, updates);
  }

  /**
   * Complete a task successfully
   */
  completeTask(taskId: string, result?: any): void {
    const task = this.getTask(taskId);
    if (!task) {
      return;
    }

    this.updateTask(taskId, {
      status: 'completed',
      completedAt: new Date(),
      result,
      progress: 100
    });

    const completedTask = this.getTask(taskId);
    if (completedTask) {
      // Emit to completedTask$ for AI Workspace to consume
      this.completedTaskSubject.next(completedTask);

      // Show toast notification if user is NOT on AI workspace
      // This notifies users when AI responses complete while they're on another page
      if (!this.isOnAiWorkspace) {
        this.showCompletionNotification(completedTask);
      }
    }
  }

  /**
   * Mark a task as failed
   */
  failTask(taskId: string, error: string): void {
    const task = this.getTask(taskId);
    if (!task) {
      return;
    }

    this.updateTask(taskId, {
      status: 'failed',
      completedAt: new Date(),
      error
    });

    // Show error notification if user is NOT on AI workspace
    if (!this.isOnAiWorkspace) {
      this.showFailureNotification(this.getTask(taskId)!);
    }
  }

  /**
   * Store a subscription for a task (for cleanup)
   */
  storeSubscription(taskId: string, subscription: Subscription): void {
    // Clean up any existing subscription
    const existing = this.activeSubscriptions.get(taskId);
    if (existing) {
      existing.unsubscribe();
    }
    this.activeSubscriptions.set(taskId, subscription);
  }

  /**
   * Get a task by ID
   */
  getTask(taskId: string): BackgroundTask | undefined {
    return this.tasksSubject.value.find(t => t.id === taskId);
  }

  /**
   * Get all tasks of a specific type
   */
  getTasksByType(type: BackgroundTaskType): BackgroundTask[] {
    return this.tasksSubject.value.filter(t => t.type === type);
  }

  /**
   * Get all running tasks
   */
  getRunningTasks(): BackgroundTask[] {
    return this.tasksSubject.value.filter(t => t.status === 'running' || t.status === 'pending');
  }

  /**
   * Get completed tasks that haven't been acknowledged
   */
  getCompletedTasks(): BackgroundTask[] {
    return this.tasksSubject.value.filter(t => t.status === 'completed');
  }

  /**
   * Get completed tasks for a specific conversation
   */
  getCompletedTaskForConversation(conversationId: string): BackgroundTask | undefined {
    return this.tasksSubject.value.find(
      t => t.status === 'completed' && t.conversationId === conversationId
    );
  }

  /**
   * Remove a task (typically after user has seen the result)
   */
  removeTask(taskId: string): void {
    // Clean up subscription if exists
    const subscription = this.activeSubscriptions.get(taskId);
    if (subscription) {
      subscription.unsubscribe();
      this.activeSubscriptions.delete(taskId);
    }

    const tasks = this.tasksSubject.value.filter(t => t.id !== taskId);
    this.tasksSubject.next(tasks);
  }

  /**
   * Clear all completed tasks
   */
  clearCompletedTasks(): void {
    const completedIds = this.tasksSubject.value
      .filter(t => t.status === 'completed' || t.status === 'failed')
      .map(t => t.id);

    completedIds.forEach(id => this.removeTask(id));
  }

  /**
   * Check if there are any running tasks
   */
  hasRunningTasks(): boolean {
    return this.getRunningTasks().length > 0;
  }

  /**
   * Check if there are completed tasks waiting to be viewed
   */
  hasCompletedTasks(): boolean {
    return this.getCompletedTasks().length > 0;
  }

  /**
   * Store pending navigation (called when user clicks View Result)
   */
  setPendingNavigation(conversationId?: string, backendConversationId?: number, workflowId?: number, taskType?: string, analysisIds?: Array<{id: string; databaseId: number; fileName: string}>): void {
    this.pendingNavigation = { conversationId, backendConversationId, workflowId, taskType, analysisIds };
  }

  /**
   * Get and clear pending navigation (called by AI Workspace on init)
   */
  getPendingNavigation(): { conversationId?: string; backendConversationId?: number; workflowId?: number; taskType?: string; analysisIds?: Array<{id: string; databaseId: number; fileName: string}> } | null {
    const nav = this.pendingNavigation;
    this.pendingNavigation = null;
    return nav;
  }

  /**
   * Check if there's a pending navigation
   */
  hasPendingNavigation(): boolean {
    return this.pendingNavigation !== null;
  }

  /**
   * Navigate to AI workspace with task context
   */
  navigateToTask(task: BackgroundTask): void {
    const queryParams: any = {};

    if (task.conversationId) {
      queryParams.conversationId = task.conversationId;
    }
    if (task.type === 'workflow' && task.workflowId) {
      queryParams.workflowId = task.workflowId;
    }

    this.router.navigate(['/legal/ai-assistant/ai-workspace'], { queryParams });
  }

  // ===== PRIVATE METHODS =====

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateTask(taskId: string, updates: Partial<BackgroundTask>): void {
    const tasks = this.tasksSubject.value.map(task =>
      task.id === taskId ? { ...task, ...updates } : task
    );
    this.tasksSubject.next(tasks);
  }

  private showCompletionNotification(task: BackgroundTask): void {
    const title = this.getNotificationTitle(task);
    const body = this.getNotificationBody(task);
    const icon = this.getTaskIcon(task);
    const iconBg = this.getTaskIconBg(task);

    // Store task reference for navigation
    const taskToNavigate = { ...task };

    // Show Velzon-styled toast notification
    Swal.fire({
      toast: true,
      position: 'top-end',
      showConfirmButton: true,
      showCancelButton: false,
      confirmButtonText: `<i class="ri-arrow-right-line me-1"></i> View Result`,
      timer: 20000,
      timerProgressBar: true,
      customClass: {
        popup: 'ai-task-toast',
        htmlContainer: 'ai-task-toast-body',
        confirmButton: 'btn btn-sm btn-primary'
      },
      html: `
        <div class="d-flex align-items-start gap-3">
          <div class="flex-shrink-0">
            <div class="toast-icon" style="background: ${iconBg};">
              <i class="${icon} text-white"></i>
            </div>
          </div>
          <div class="flex-grow-1 toast-body">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${body}</div>
            <div class="toast-time"><i class="ri-time-line me-1"></i>Just now</div>
          </div>
        </div>
      `,
      showClass: {
        popup: 'animate__animated animate__fadeInRight animate__faster'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutRight animate__faster'
      },
      didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
      }
    }).then((result) => {
      if (result.isConfirmed) {
        // Navigate to AI workspace with the specific conversation/task
        this.navigateToTaskResult(taskToNavigate);
      }
    }).catch(() => {
      // Toast dismissed or error - silently ignore
    });
  }

  private showFailureNotification(task: BackgroundTask): void {
    // Show Velzon-styled error toast
    Swal.fire({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 10000,
      timerProgressBar: true,
      customClass: {
        popup: 'ai-task-toast ai-task-toast-error'
      },
      html: `
        <div class="d-flex align-items-start gap-3">
          <div class="flex-shrink-0">
            <div class="toast-icon" style="background: linear-gradient(135deg, #f06548 0%, #fd7e5c 100%);">
              <i class="ri-error-warning-line text-white"></i>
            </div>
          </div>
          <div class="flex-grow-1 toast-body">
            <div class="toast-title text-danger">AI Task Failed</div>
            <div class="toast-message">${task.error || `${task.title} could not be completed`}</div>
            <div class="toast-time"><i class="ri-time-line me-1"></i>Just now</div>
          </div>
        </div>
      `,
      showClass: {
        popup: 'animate__animated animate__fadeInRight animate__faster'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutRight animate__faster'
      }
    });
  }

  /**
   * Navigate to the task result - opens AI workspace with the correct conversation/workflow
   */
  private navigateToTaskResult(task: BackgroundTask): void {
    // Extract analysis IDs if this is an analysis task
    const analysisIds = task.type === 'analysis' && task.result?.results
      ? task.result.results
      : undefined;

    // Store pending navigation BEFORE navigating (backup mechanism)
    this.setPendingNavigation(
      task.conversationId,
      task.backendConversationId,
      task.workflowId,
      task.type,
      analysisIds
    );

    // Remove the task to prevent duplicate notifications when checkForCompletedBackgroundTasks runs
    this.removeTask(task.id);

    // Navigate to AI workspace
    this.router.navigate(['/legal/ai-assistant/ai-workspace']);
  }

  private getTaskIcon(task: BackgroundTask): string {
    switch (task.type) {
      case 'question':
        return 'ri-question-answer-line';
      case 'draft':
        return 'ri-file-text-line';
      case 'analysis':
        return 'ri-file-search-line';
      case 'workflow':
        return 'ri-flow-chart';
      default:
        return 'ri-robot-line';
    }
  }

  private getTaskIconBg(task: BackgroundTask): string {
    switch (task.type) {
      case 'question':
        return 'linear-gradient(135deg, #405189 0%, #5c6bc0 100%)';
      case 'draft':
        return 'linear-gradient(135deg, #0ab39c 0%, #26c6da 100%)';
      case 'analysis':
        return 'linear-gradient(135deg, #f7b84b 0%, #ffca28 100%)';
      case 'workflow':
        return 'linear-gradient(135deg, #299cdb 0%, #42a5f5 100%)';
      default:
        return 'linear-gradient(135deg, #405189 0%, #5c6bc0 100%)';
    }
  }

  private getNotificationTitle(task: BackgroundTask): string {
    switch (task.type) {
      case 'question':
        return 'AI Response Ready';
      case 'draft':
        return 'Document Draft Ready';
      case 'analysis':
        return 'Document Analysis Complete';
      case 'workflow':
        return 'Workflow Completed';
      default:
        return 'AI Task Completed';
    }
  }

  private getNotificationBody(task: BackgroundTask): string {
    switch (task.type) {
      case 'question':
        return `Your legal research question has been answered. Click to view the response.`;
      case 'draft':
        return `"${task.title}" has been drafted. Click to review and edit.`;
      case 'analysis':
        return `Document analysis is complete. Click to view results.`;
      case 'workflow':
        return `"${task.title}" workflow has finished. Click to view results.`;
      default:
        return `${task.title} is ready. Click to view.`;
    }
  }
}
