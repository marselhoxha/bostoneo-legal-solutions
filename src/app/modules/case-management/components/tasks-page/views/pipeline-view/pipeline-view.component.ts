import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { CdkDragDrop, transferArrayItem } from '@angular/cdk/drag-drop';

import { CaseTaskService } from '@app/service/case-task.service';
import { CaseTask, TaskPriority, TaskStatus } from '@app/interface/case-task';
import { TasksStateService } from '../../tasks-state.service';
import { ToastService } from '@app/services/toast.service';

type PipelineColumnKey = 'open' | 'in_progress' | 'review' | 'blocked' | 'done';

interface PipelineColumn {
  key: PipelineColumnKey;
  label: string;
  tone: 'neutral' | 'accent' | 'info' | 'danger' | 'success';
  tasks: CaseTask[];
  estimatedHours: number;
}

/**
 * Pipeline (kanban) view of the tasks page. Four columns map to the V1
 * lifecycle: Open (TODO) · In progress (IN_PROGRESS + REVIEW) · Blocked
 * (BLOCKED) · Done (COMPLETED + CANCELLED). Click a card to open the
 * shared drawer; status changes flow through the drawer's stepper.
 */
@Component({
  selector: 'app-pipeline-view',
  templateUrl: './pipeline-view.component.html',
  styleUrls: ['./pipeline-view.component.scss'],
})
export class PipelineViewComponent implements OnInit, OnDestroy {
  columns: PipelineColumn[] = [];
  /**
   * Skeleton flag. Defaults to false — set to true ONLY on a cold mount where
   * the shared cache is empty and we're firing a real fetch. On warm mounts
   * (e.g. switched in from the inbox view), the cache already has data and
   * we render immediately without a skeleton flash.
   */
  loading = false;
  selectedTaskId: number | null = null;

  private destroy$ = new Subject<void>();

  private static readonly AVATAR_PALETTE = [
    '#0b64e9', '#16a34a', '#6b4aff', '#ec4899', '#f97006', '#0c0a09',
  ];
  private static readonly CASE_DOT_PALETTE = [
    '#0b64e9', '#16a34a', '#6b4aff', '#ec4899', '#f97006', '#f24149',
  ];

  constructor(
    private taskService: CaseTaskService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private state: TasksStateService,
    private toast: ToastService,
  ) {}

  /** Connected drop list ids for cross-column drag-drop. */
  get connectedColumnIds(): string[] {
    return this.columns.map((c) => 'pl-col-' + c.key);
  }

  ngOnInit(): void {
    // Subscribe to the cache first — on warm mount, this fires synchronously
    // with the cached tasks (BehaviorSubject replay) and bucketizes immediately,
    // so the board paints in one frame with no skeleton.
    this.state.tasks$.pipe(takeUntil(this.destroy$)).subscribe((tasks) => {
      this.columns = this.bucketize(tasks);
    });

    // Cache decides whether we need to fetch. Inbox view (the default) loads
    // tasks first and seeds the cache; switching to Pipeline finds it warm
    // and skips both the skeleton and the duplicate fetch. Cold mount (e.g.
    // direct nav to /tasks?view=pipeline) finds the cache empty and fetches
    // with the skeleton.
    if (!this.state.hasCachedTasks) {
      this.loading = true;
      this.taskService.getAllTasks(0, 200).pipe(takeUntil(this.destroy$)).subscribe({
        next: (response) => {
          const tasks = this.unwrapTasks(response);
          this.state.setAll(tasks);
          this.loading = false;
        },
        error: () => { this.loading = false; },
      });
    }

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((p) => {
      const tid = p.get('task');
      this.selectedTaskId = tid ? +tid : null;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectTask(task: CaseTask): void {
    if (task?.id != null) this.state.select(task.id);
    const tree = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams: { task: task.id },
      queryParamsHandling: 'merge',
    });
    this.location.replaceState(this.router.serializeUrl(tree));
  }

  /** "+ Add" button on a column header — opens the shared new-task modal. */
  openNewTask(ev?: Event): void {
    ev?.stopPropagation();
    this.state.select(null);
    this.state.setNewTaskOpen(true);
  }

  /**
   * Drag-drop handler. Moves the task to the destination column's status
   * optimistically, then persists via updateTaskStatus. Reorder-within-
   * column is intentionally a no-op (Pipeline is a status board, not a
   * sortable backlog).
   */
  onDrop(event: CdkDragDrop<CaseTask[]>): void {
    if (event.previousContainer === event.container) return; // same column

    const fromCol = this.findColumnByDropId(event.previousContainer.id);
    const toCol = this.findColumnByDropId(event.container.id);
    if (!fromCol || !toCol) return;

    const task = event.previousContainer.data[event.previousIndex];
    if (!task?.id) return;

    const newStatus = this.statusForColumn(toCol.key);
    if (!newStatus) return;

    // BLOCKED requires a reason — we don't collect one mid-drag, so route
    // the user through the drawer's blocker prompt instead. Open the task
    // and let them mark blocked there.
    if (newStatus === TaskStatus.BLOCKED) {
      this.toast.info('Open the task to set a blocker reason');
      this.selectTask(task);
      return;
    }

    // Optimistic move in local arrays.
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );

    // Optimistic local status flip + cache upsert so the row's chips/colors
    // update immediately.
    const optimistic: CaseTask = { ...task, status: newStatus };
    this.state.upsert(optimistic);

    // Persist.
    this.taskService.updateTaskStatus(task.id, newStatus).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        const fromServer = (response?.data as any)?.task ?? response?.data;
        if (fromServer) this.state.upsert(fromServer);
        this.toast.success(`Moved to ${toCol.label}`);
      },
      error: (err) => {
        console.error('Failed to update task status on drop', err);
        // Revert by upserting the original task; tasks$ subscriber will
        // rebucketize and put it back in the source column.
        this.state.upsert(task);
        this.toast.error('Failed to update status');
      },
    });
  }

  private findColumnByDropId(id: string): PipelineColumn | undefined {
    const key = id.replace(/^pl-col-/, '') as PipelineColumnKey;
    return this.columns.find((c) => c.key === key);
  }

  private statusForColumn(key: PipelineColumnKey): TaskStatus | null {
    switch (key) {
      case 'open':         return TaskStatus.TODO;
      case 'in_progress':  return TaskStatus.IN_PROGRESS;
      case 'review':       return TaskStatus.REVIEW;
      case 'blocked':      return TaskStatus.BLOCKED;
      case 'done':         return TaskStatus.COMPLETED;
      default:             return null;
    }
  }

  trackByCol(_: number, c: PipelineColumn): string { return c.key; }
  trackByTask(_: number, t: CaseTask): number { return t.id; }

  avatarColor(seed: string | number | null | undefined): string {
    const s = (seed ?? '').toString();
    if (!s) return PipelineViewComponent.AVATAR_PALETTE[0];
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return PipelineViewComponent.AVATAR_PALETTE[Math.abs(h) % PipelineViewComponent.AVATAR_PALETTE.length];
  }

  caseDotColor(task: CaseTask): string {
    const seed = task?.caseId != null ? String(task.caseId) : (task?.caseTitle || task?.caseNumber || '');
    if (!seed) return PipelineViewComponent.CASE_DOT_PALETTE[0];
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    return PipelineViewComponent.CASE_DOT_PALETTE[Math.abs(h) % PipelineViewComponent.CASE_DOT_PALETTE.length];
  }

  priorityTone(p: TaskPriority): string {
    const v = (p as unknown as string)?.toUpperCase?.();
    if (v === 'URGENT') return 'danger';
    if (v === 'HIGH') return 'orange';
    if (v === 'MEDIUM') return 'warning';
    if (v === 'LOW') return 'info';
    return 'subtle';
  }

  private unwrapTasks(response: any): CaseTask[] {
    const data: any = response?.data;
    if (data?.tasks?.content && Array.isArray(data.tasks.content)) return data.tasks.content;
    if (data?.content && Array.isArray(data.content)) return data.content;
    if (Array.isArray(data?.tasks)) return data.tasks;
    if (Array.isArray(data)) return data;
    return [];
  }

  /**
   * Bucket tasks into 4 columns. The third column flips identity based on
   * data: when any task is BLOCKED → "Blocked" (danger); otherwise "Review"
   * (info, lifecycle stage). Position stays constant (always slot 3) so the
   * grid doesn't reflow — only the column's content + tone changes.
   */
  private bucketize(tasks: CaseTask[]): PipelineColumn[] {
    const open: CaseTask[] = [];
    const inProgress: CaseTask[] = [];
    const review: CaseTask[] = [];
    const blocked: CaseTask[] = [];
    const done: CaseTask[] = [];

    for (const t of tasks) {
      const s = (t.status as unknown as string)?.toUpperCase?.();
      if (s === 'TODO') open.push(t);
      else if (s === 'IN_PROGRESS') inProgress.push(t);
      else if (s === 'REVIEW') review.push(t);
      else if (s === 'BLOCKED') blocked.push(t);
      else if (s === 'COMPLETED' || s === 'CANCELLED') done.push(t);
    }

    const sumHours = (arr: CaseTask[]) =>
      arr.reduce((s, t) => s + (Number(t.estimatedHours) || 0), 0);

    const thirdColumn: PipelineColumn = blocked.length > 0
      ? { key: 'blocked', label: 'Blocked', tone: 'danger', tasks: blocked, estimatedHours: sumHours(blocked) }
      : { key: 'review',  label: 'Review',  tone: 'info',   tasks: review,  estimatedHours: sumHours(review)  };

    return [
      { key: 'open', label: 'Open', tone: 'neutral', tasks: open, estimatedHours: sumHours(open) },
      { key: 'in_progress', label: 'In progress', tone: 'accent', tasks: inProgress, estimatedHours: sumHours(inProgress) },
      thirdColumn,
      { key: 'done', label: 'Done', tone: 'success', tasks: done, estimatedHours: sumHours(done) },
    ];
  }
}
