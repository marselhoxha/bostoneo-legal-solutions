import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of, switchMap, takeUntil } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { CaseTaskService } from '@app/service/case-task.service';
import { CaseTask, TaskStatus } from '@app/interface/case-task';

type TasksView = 'inbox' | 'pipeline' | 'workload';

/**
 * Unified task drawer mounted as a sibling overlay on the tasks page.
 *
 * Route-driven: opens when `?task=:id` is present in the query string,
 * closes when that param is removed. The `?view=` param controls which
 * view-specific affordances are visible (status-changer for pipeline,
 * reassign action for workload — both stubbed off in Phase 1).
 *
 * The status-driven blocker callout is always visible when
 * `task.status === BLOCKED`, regardless of which view is active.
 *
 * NOTE: avatar-color helper is duplicated from InboxViewComponent.
 * Acceptable for Phase 1; flag for extraction to a shared util in
 * a follow-up phase.
 */
@Component({
  selector: 'app-task-drawer',
  templateUrl: './task-drawer.component.html',
  styleUrls: ['./task-drawer.component.scss'],
})
export class TaskDrawerComponent implements OnInit, OnDestroy {
  task: CaseTask | null = null;
  loading = false;
  activeView: TasksView = 'inbox';

  private destroy$ = new Subject<void>();

  // Same palette + hash strategy as InboxViewComponent so the same
  // person gets the same color in both the row and the drawer.
  private static readonly AVATAR_PALETTE = [
    '#0b64e9', // blue
    '#16a34a', // green
    '#6b4aff', // violet
    '#ec4899', // pink
    '#f97006', // orange
    '#0c0a09', // dark
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private taskService: CaseTaskService,
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(
        takeUntil(this.destroy$),
        switchMap((p) => {
          const view = p.get('view') as TasksView | null;
          this.activeView = view === 'pipeline' || view === 'workload' ? view : 'inbox';

          const tid = p.get('task');
          if (!tid) {
            this.task = null;
            return of(null);
          }

          this.loading = true;
          // Backend returns { data: { task: CaseTaskDTO } }; the service's
          // type signature is loose, so unwrap defensively here.
          return this.taskService.getTask(+tid).pipe(
            map((r: any) => (r?.data?.task ?? r?.data ?? null) as CaseTask | null),
            catchError(() => of(null)),
          );
        }),
      )
      .subscribe((t) => {
        this.task = t;
        this.loading = false;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  close(): void {
    const queryParams = { ...this.route.snapshot.queryParams };
    delete queryParams['task'];
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true,
    });
  }

  isBlocked(): boolean {
    return this.task?.status === TaskStatus.BLOCKED;
  }

  /** Done count for "Subtasks · X of Y". */
  get doneSubtaskCount(): number {
    return this.task?.subtasks?.filter((s) => s.status === TaskStatus.COMPLETED).length ?? 0;
  }

  /**
   * Stable color per assignee. Matches InboxViewComponent.avatarColor exactly
   * so the same person gets the same color across the row and the drawer.
   */
  avatarColor(seed: string | number | null | undefined): string {
    const palette = TaskDrawerComponent.AVATAR_PALETTE;
    const s = (seed ?? '').toString();
    if (!s) return palette[0];
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return palette[Math.abs(h) % palette.length];
  }

  /** Convert a byte size to a compact label ("84MB", "1.2KB"). */
  formatFileSize(bytes: number | null | undefined): string {
    if (bytes == null || isNaN(bytes)) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  }
}
