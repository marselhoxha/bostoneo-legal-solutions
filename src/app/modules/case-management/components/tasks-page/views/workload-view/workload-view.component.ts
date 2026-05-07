import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import { CaseTaskService } from '@app/service/case-task.service';
import { CaseTask, TaskPriority } from '@app/interface/case-task';
import { TasksStateService } from '../../tasks-state.service';

type CapStatus = 'available' | 'healthy' | 'near' | 'over';

interface WorkloadGroup {
  userId: number;
  name: string;
  initials: string;
  tasks: CaseTask[];
  hoursAllocated: number;
  capacity: number;
  pct: number;
  status: CapStatus;
}

/**
 * Workload view — design match: wave1-tasks-calendar-redesign-options#tasks-d3.
 * Tasks grouped by primary assignee with a capacity bar + status pill per
 * person. Default weekly capacity = 20h; bar turns warning at 80%, danger
 * at 100%. Multi-assignee tasks count once for each assignee. COMPLETED +
 * CANCELLED skip the capacity math (not pending work).
 */
@Component({
  selector: 'app-workload-view',
  templateUrl: './workload-view.component.html',
  styleUrls: ['./workload-view.component.scss'],
})
export class WorkloadViewComponent implements OnInit, OnDestroy {
  groups: WorkloadGroup[] = [];
  /**
   * Skeleton flag. Defaults to false — set to true ONLY on a cold mount where
   * the shared cache is empty and we're firing a real fetch. Warm mount (tab
   * switch from inbox/pipeline) renders immediately from cache.
   */
  loading = false;
  selectedTaskId: number | null = null;

  /** Set of collapsed-group userIds (component-local, not persisted). */
  collapsed = new Set<number>();

  private readonly WEEKLY_CAPACITY = 20;

  private static readonly AVATAR_PALETTE = [
    '#0b64e9', '#16a34a', '#6b4aff', '#ec4899', '#f97006', '#0c0a09',
  ];
  private static readonly CASE_DOT_PALETTE = [
    '#0b64e9', '#16a34a', '#6b4aff', '#ec4899', '#f97006', '#f24149',
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private taskService: CaseTaskService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private state: TasksStateService,
  ) {}

  ngOnInit(): void {
    // Subscribe to the cache first so a warm mount paints in one frame
    // (BehaviorSubject replays the current value synchronously).
    this.state.tasks$.pipe(takeUntil(this.destroy$)).subscribe((tasks) => {
      this.groups = this.bucketize(tasks);
    });

    // Only show the skeleton + fetch when the cache is empty. Switching tabs
    // from a view that already populated the cache should be instant — no
    // duplicate fetch, no skeleton flash.
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

  toggleGroup(userId: number, ev?: Event): void {
    ev?.stopPropagation();
    if (this.collapsed.has(userId)) this.collapsed.delete(userId);
    else this.collapsed.add(userId);
  }

  isCollapsed(userId: number): boolean {
    return this.collapsed.has(userId);
  }

  trackByUser(_: number, g: WorkloadGroup): number { return g.userId; }
  trackByTask(_: number, t: CaseTask): number { return t.id; }

  statusLabel(s: CapStatus): string {
    return s === 'over' ? 'Over cap'
         : s === 'near' ? 'Near cap'
         : s === 'healthy' ? 'Healthy'
         : 'Available';
  }

  avatarColor(seed: string | number | null | undefined): string {
    const s = (seed ?? '').toString();
    if (!s) return WorkloadViewComponent.AVATAR_PALETTE[0];
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return WorkloadViewComponent.AVATAR_PALETTE[Math.abs(h) % WorkloadViewComponent.AVATAR_PALETTE.length];
  }

  caseDotColor(task: CaseTask): string {
    const seed = task?.caseId != null ? String(task.caseId) : (task?.caseTitle || task?.caseNumber || '');
    if (!seed) return WorkloadViewComponent.CASE_DOT_PALETTE[0];
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    return WorkloadViewComponent.CASE_DOT_PALETTE[Math.abs(h) % WorkloadViewComponent.CASE_DOT_PALETTE.length];
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

  private bucketize(tasks: CaseTask[]): WorkloadGroup[] {
    const buckets = new Map<number, { name: string; initials: string; tasks: CaseTask[] }>();

    for (const t of tasks) {
      const s = (t.status as unknown as string)?.toUpperCase?.();
      if (s === 'COMPLETED' || s === 'CANCELLED') continue;

      // V78 multi-assignee: count once per assignee. Fall back to legacy
      // `assignedToId` for tasks the V78 backfill hasn't populated yet.
      const assignees = t.assignees && t.assignees.length > 0
        ? t.assignees.map(a => ({
            id: a.id,
            name: `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim(),
          }))
        : (t.assignedToId != null
            ? [{ id: t.assignedToId, name: t.assignedToName ?? '' }]
            : []);

      for (const a of assignees) {
        if (a.id == null) continue;
        let bucket = buckets.get(a.id);
        if (!bucket) {
          const initials = this.toInitials(a.name) || '?';
          bucket = { name: a.name || `User ${a.id}`, initials, tasks: [] };
          buckets.set(a.id, bucket);
        }
        bucket.tasks.push(t);
      }
    }

    const groups: WorkloadGroup[] = [];
    for (const [userId, b] of buckets) {
      const hoursAllocated = b.tasks.reduce((s, t) => s + (Number(t.estimatedHours) || 0), 0);
      const pct = Math.round((hoursAllocated / this.WEEKLY_CAPACITY) * 100);
      groups.push({
        userId,
        name: b.name,
        initials: b.initials,
        tasks: b.tasks,
        hoursAllocated,
        capacity: this.WEEKLY_CAPACITY,
        pct,
        status:
          pct >= 100 ? 'over' :
          pct >= 80  ? 'near' :
          pct >= 51  ? 'healthy' :
                       'available',
      });
    }

    // Over-capacity surfaces first; then by load (heaviest first).
    groups.sort((a, b) => {
      if (a.status === 'over' && b.status !== 'over') return -1;
      if (b.status === 'over' && a.status !== 'over') return 1;
      return b.pct - a.pct;
    });

    return groups;
  }

  private toInitials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .map(s => s[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}
