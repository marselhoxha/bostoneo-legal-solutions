import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  TrackByFunction,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, BehaviorSubject } from 'rxjs';
import { takeUntil, debounceTime } from 'rxjs/operators';
import { CaseTask, TaskStatus, TaskPriority } from '../../../../../interface/case-task';
import { VirtualScrollDirective } from '../../../../../core/directives/virtual-scroll.directive';
import { EnhancedPerformanceService } from '../../../../../core/services/enhanced-performance.service';

@Component({
  selector: 'app-optimized-task-list',
  standalone: true,
  imports: [CommonModule, FormsModule, VirtualScrollDirective],
  templateUrl: './optimized-task-list.component.html',
  styleUrls: ['./optimized-task-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OptimizedTaskListComponent implements OnInit, OnDestroy {
  @Input() tasks: CaseTask[] = [];
  @Input() title: string = 'Tasks';
  @Input() status?: TaskStatus;
  @Input() enableVirtualScroll: boolean = true;
  @Input() itemHeight: number = 80;
  @Input() containerHeight: number = 600;
  
  @Output() taskClick = new EventEmitter<CaseTask>();
  @Output() taskEdit = new EventEmitter<CaseTask>();
  @Output() taskDelete = new EventEmitter<CaseTask>();
  @Output() taskStatusChange = new EventEmitter<{ task: CaseTask; status: TaskStatus }>();
  
  @ViewChild('scrollContainer', { static: false }) scrollContainer?: ElementRef;
  
  visibleTasks$ = new BehaviorSubject<CaseTask[]>([]);
  searchTerm$ = new Subject<string>();
  filteredTasks: CaseTask[] = [];
  
  private destroy$ = new Subject<void>();
  
  // Performance tracking
  renderCount = 0;
  lastRenderTime = 0;
  
  // Virtual scroll config
  virtualScrollConfig = {
    itemHeight: 80,
    bufferSize: 5,
    trackBy: 'id',
    enableScrollbar: true
  };
  
  constructor(
    private cdr: ChangeDetectorRef,
    private performanceService: EnhancedPerformanceService
  ) {}
  
  ngOnInit(): void {
    this.setupSearch();
    this.filteredTasks = [...this.tasks];
    this.updateVisibleTasks();
    
    // Track performance
    this.trackRenderPerformance();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  ngOnChanges(): void {
    this.filteredTasks = [...this.tasks];
    this.updateVisibleTasks();
  }
  
  private setupSearch(): void {
    this.searchTerm$
      .pipe(
        debounceTime(300),
        takeUntil(this.destroy$)
      )
      .subscribe(term => {
        this.filterTasks(term);
      });
  }
  
  private filterTasks(searchTerm: string): void {
    if (!searchTerm) {
      this.filteredTasks = [...this.tasks];
    } else {
      const term = searchTerm.toLowerCase();
      this.filteredTasks = this.tasks.filter(task =>
        task.title.toLowerCase().includes(term) ||
        task.description?.toLowerCase().includes(term) ||
        task.tags?.some(tag => tag.toLowerCase().includes(term))
      );
    }
    
    this.updateVisibleTasks();
    this.cdr.markForCheck();
  }
  
  private updateVisibleTasks(): void {
    if (this.enableVirtualScroll) {
      // Virtual scrolling will handle visibility
      this.visibleTasks$.next(this.filteredTasks);
    } else {
      // Show all tasks when virtual scroll is disabled
      this.visibleTasks$.next(this.filteredTasks);
    }
  }
  
  onVisibleItemsChange(items: CaseTask[]): void {
    this.visibleTasks$.next(items);
    this.cdr.markForCheck();
  }
  
  onSearch(term: string): void {
    this.searchTerm$.next(term);
  }
  
  // Optimized trackBy function
  trackByTask: TrackByFunction<CaseTask> = (index: number, task: CaseTask): any => {
    return task.id || index;
  }
  
  // Task actions with minimal change detection
  onTaskClick(task: CaseTask, event: Event): void {
    event.stopPropagation();
    this.taskClick.emit(task);
  }
  
  onTaskEdit(task: CaseTask, event: Event): void {
    event.stopPropagation();
    this.taskEdit.emit(task);
  }
  
  onTaskDelete(task: CaseTask, event: Event): void {
    event.stopPropagation();
    this.taskDelete.emit(task);
  }
  
  onStatusChange(task: CaseTask, newStatus: TaskStatus): void {
    this.taskStatusChange.emit({ task, status: newStatus });
  }
  
  // Priority badge class
  getPriorityClass(priority: TaskPriority): string {
    const classes = {
      [TaskPriority.LOW]: 'badge-soft-info',
      [TaskPriority.MEDIUM]: 'badge-soft-warning',
      [TaskPriority.HIGH]: 'badge-soft-danger',
      [TaskPriority.URGENT]: 'badge-soft-danger pulse'
    };
    return classes[priority] || 'badge-soft-secondary';
  }
  
  // Status badge class
  getStatusClass(status: TaskStatus): string {
    const classes = {
      [TaskStatus.TODO]: 'badge-soft-secondary',
      [TaskStatus.IN_PROGRESS]: 'badge-soft-primary',
      [TaskStatus.REVIEW]: 'badge-soft-info',
      [TaskStatus.BLOCKED]: 'badge-soft-warning',
      [TaskStatus.COMPLETED]: 'badge-soft-success',
      [TaskStatus.CANCELLED]: 'badge-soft-dark'
    };
    return classes[status] || 'badge-soft-secondary';
  }
  
  // Format date
  formatDate(date: Date | string | undefined): string {
    if (!date) return 'No due date';
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
    
    return d.toLocaleDateString();
  }
  
  // Check if task is overdue
  isOverdue(task: CaseTask): boolean {
    if (!task.dueDate || task.status === TaskStatus.COMPLETED) return false;
    return new Date(task.dueDate) < new Date();
  }
  
  // Performance tracking
  private trackRenderPerformance(): void {
    this.renderCount++;
    const now = performance.now();
    
    if (this.lastRenderTime) {
      const renderTime = now - this.lastRenderTime;
      if (renderTime > 16.67) { // More than one frame (60fps)
        console.warn(`Slow render detected: ${renderTime.toFixed(2)}ms`);
      }
    }
    
    this.lastRenderTime = now;
  }
  
  // Manual change detection trigger (use sparingly)
  refresh(): void {
    this.cdr.markForCheck();
  }
}