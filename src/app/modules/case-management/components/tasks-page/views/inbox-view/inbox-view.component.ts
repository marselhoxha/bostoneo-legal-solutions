import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { CaseTaskService } from '@app/service/case-task.service';
import { CaseTask } from '@app/interface/case-task';

interface TaskGroup {
  key: 'overdue' | 'today' | 'thisWeek' | 'later' | 'noDate';
  label: string;
  tasks: CaseTask[];
  emphasis?: 'danger';
}

@Component({
  selector: 'app-inbox-view',
  templateUrl: './inbox-view.component.html',
  styleUrls: ['./inbox-view.component.scss'],
})
export class InboxViewComponent implements OnInit, OnDestroy {
  groups: TaskGroup[] = [];
  loading = true;
  selectedTaskId: number | null = null;
  totalActiveCount = 0;
  overdueCount = 0;

  private static readonly AVATAR_PALETTE = [
    '#0b64e9', // blue
    '#16a34a', // green
    '#6b4aff', // violet
    '#ec4899', // pink
    '#f97006', // orange
    '#0c0a09', // dark
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private taskService: CaseTaskService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.taskService
      .getAllTasks(0, 200)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Backend returns { data: { tasks: Page } } where Page may have content[].
          // Fall back through the same defensive cascade as the legacy task-management view.
          let tasks: CaseTask[] = [];
          const data: any = response?.data;
          if (data?.tasks?.content && Array.isArray(data.tasks.content)) {
            tasks = data.tasks.content;
          } else if (data?.content && Array.isArray(data.content)) {
            tasks = data.content;
          } else if (Array.isArray(data?.tasks)) {
            tasks = data.tasks;
          } else if (Array.isArray(data)) {
            tasks = data;
          }

          this.groups = this.groupByDueBand(tasks);
          this.totalActiveCount = this.groups.reduce((s, g) => s + g.tasks.length, 0);
          this.overdueCount = this.groups.find((g) => g.key === 'overdue')?.tasks.length ?? 0;
          this.loading = false;
        },
        error: () => {
          this.groups = [];
          this.totalActiveCount = 0;
          this.overdueCount = 0;
          this.loading = false;
        },
      });

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
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { task: task.id },
      queryParamsHandling: 'merge',
    });
  }

  trackById(_: number, t: CaseTask): number {
    return t.id;
  }

  /**
   * Pick a stable color per assignee from a small palette by hashing the seed
   * (assignedToId or name). Ensures the same person always gets the same color
   * across rows without needing a per-user color field on the backend.
   */
  avatarColor(seed: string | number | null | undefined): string {
    const palette = InboxViewComponent.AVATAR_PALETTE;
    const s = (seed ?? '').toString();
    if (!s) return palette[0];
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return palette[Math.abs(h) % palette.length];
  }

  /** Time-band grouping. Excludes COMPLETED + CANCELLED. */
  private groupByDueBand(tasks: CaseTask[]): TaskGroup[] {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const dayOfWeek = startOfToday.getDay(); // 0=Sun..6=Sat
    const endOfWeek = new Date(startOfToday);
    endOfWeek.setDate(startOfToday.getDate() + (6 - dayOfWeek));
    endOfWeek.setHours(23, 59, 59, 999);

    const overdue: CaseTask[] = [];
    const today: CaseTask[] = [];
    const thisWeek: CaseTask[] = [];
    const later: CaseTask[] = [];
    const noDate: CaseTask[] = [];

    for (const t of tasks) {
      const status = (t.status as unknown as string)?.toUpperCase?.();
      if (status === 'COMPLETED' || status === 'CANCELLED') continue;
      if (!t.dueDate) {
        noDate.push(t);
        continue;
      }
      const d = new Date(t.dueDate as any);
      if (isNaN(d.getTime())) {
        noDate.push(t);
        continue;
      }

      if (d < startOfToday) overdue.push(t);
      else if (d <= endOfToday) today.push(t);
      else if (d <= endOfWeek) thisWeek.push(t);
      else later.push(t);
    }

    return [
      { key: 'overdue' as const, label: 'Overdue', tasks: overdue, emphasis: 'danger' as const },
      { key: 'today' as const, label: 'Today', tasks: today },
      { key: 'thisWeek' as const, label: 'This week', tasks: thisWeek },
      { key: 'later' as const, label: 'Later', tasks: later },
      { key: 'noDate' as const, label: 'No due date', tasks: noDate },
    ].filter((g) => g.tasks.length > 0);
  }
}
