import { Component, OnInit, OnDestroy, ChangeDetectorRef, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { BackgroundTaskService, BackgroundTask } from '../../../../services/background-task.service';
import { trigger, state, style, transition, animate } from '@angular/animations';

interface DisplayTask extends BackgroundTask {
  elapsedTime: string;
  fileName?: string;
}

@Component({
  selector: 'app-background-tasks-indicator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './background-tasks-indicator.component.html',
  styleUrls: ['./background-tasks-indicator.component.scss'],
  animations: [
    trigger('slideDown', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' }))
      ])
    ]),
    trigger('pulse', [
      state('active', style({ transform: 'scale(1)' })),
      state('pulse', style({ transform: 'scale(1.1)' })),
      transition('active <=> pulse', animate('500ms ease-in-out'))
    ])
  ]
})
export class BackgroundTasksIndicatorComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private elapsedTimeInterval: any;

  @Output() viewTask = new EventEmitter<BackgroundTask>();

  tasks: DisplayTask[] = [];
  isPanelOpen = false;
  pulseState = 'active';

  constructor(
    private backgroundTaskService: BackgroundTaskService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Subscribe to task changes
    this.backgroundTaskService.tasks$
      .pipe(takeUntil(this.destroy$))
      .subscribe(tasks => {
        this.tasks = tasks.map(task => ({
          ...task,
          elapsedTime: this.calculateElapsedTime(task.startedAt),
          fileName: this.extractFileName(task)
        }));
        this.cdr.detectChanges();
      });

    // Update elapsed time every second
    this.elapsedTimeInterval = setInterval(() => {
      this.tasks = this.tasks.map(task => ({
        ...task,
        elapsedTime: this.calculateElapsedTime(task.startedAt)
      }));
      this.cdr.detectChanges();
    }, 1000);

    // Pulse animation for active tasks
    setInterval(() => {
      if (this.hasActiveTasks) {
        this.pulseState = this.pulseState === 'active' ? 'pulse' : 'active';
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.elapsedTimeInterval) {
      clearInterval(this.elapsedTimeInterval);
    }
  }

  get hasActiveTasks(): boolean {
    return this.tasks.some(t => t.status === 'running' || t.status === 'pending');
  }

  get hasWaitingTasks(): boolean {
    return this.tasks.some(t => t.status === 'waiting');
  }

  get hasRecentlyCompleted(): boolean {
    return this.tasks.some(t => t.status === 'completed');
  }

  get hasTasks(): boolean {
    return this.tasks.length > 0;
  }

  get taskCount(): number {
    return this.tasks.length;
  }

  get activeTaskCount(): number {
    return this.tasks.filter(t => t.status === 'running' || t.status === 'pending').length;
  }

  get waitingTaskCount(): number {
    return this.tasks.filter(t => t.status === 'waiting').length;
  }

  get completedTaskCount(): number {
    return this.tasks.filter(t => t.status === 'completed').length;
  }

  togglePanel(): void {
    this.isPanelOpen = !this.isPanelOpen;
  }

  closePanel(): void {
    this.isPanelOpen = false;
  }

  clearCompleted(): void {
    this.backgroundTaskService.clearCompletedTasks();
  }

  viewTaskResult(task: BackgroundTask): void {
    this.viewTask.emit(task);
    this.closePanel();
    // Remove the task after viewing
    this.backgroundTaskService.removeTask(task.id);
  }

  /**
   * Navigate to a task - emits event for parent to handle navigation
   */
  navigateToTask(task: BackgroundTask): void {
    this.viewTask.emit(task);
    this.closePanel();
    // Don't remove running/waiting tasks - only completed ones get removed
    if (task.status === 'completed') {
      this.backgroundTaskService.removeTask(task.id);
    }
  }

  getTaskIcon(task: BackgroundTask): string {
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

  getTaskTypeLabel(task: BackgroundTask): string {
    switch (task.type) {
      case 'question':
        return 'Question';
      case 'draft':
        return 'Draft';
      case 'analysis':
        return 'Analysis';
      case 'workflow':
        return 'Workflow';
      default:
        return 'Task';
    }
  }

  getStatusIcon(task: BackgroundTask): string {
    switch (task.status) {
      case 'running':
      case 'pending':
        return 'spinner-border spinner-border-sm';
      case 'waiting':
        return 'ri-pause-circle-line';
      case 'completed':
        return 'ri-check-line';
      case 'failed':
        return 'ri-error-warning-line';
      default:
        return 'ri-time-line';
    }
  }

  private calculateElapsedTime(startedAt: Date): string {
    const now = new Date();
    const start = new Date(startedAt);
    const diffMs = now.getTime() - start.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) {
      return `${diffSec}s`;
    }
    const diffMin = Math.floor(diffSec / 60);
    const remainingSec = diffSec % 60;
    return `${diffMin}m ${remainingSec}s`;
  }

  private extractFileName(task: BackgroundTask): string {
    // Try to extract filename from task title or description
    if (task.title) {
      // Check if title contains a filename pattern
      const match = task.title.match(/Analyzing (.+)/);
      if (match) {
        return match[1];
      }
      return task.title;
    }
    return task.description || 'Document';
  }
}
