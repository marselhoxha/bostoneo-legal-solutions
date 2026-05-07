import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import Swal from 'sweetalert2';

import { CaseTaskService } from '@app/service/case-task.service';
import { CaseTask, TaskPriority, TaskStatus } from '@app/interface/case-task';
import { UserService } from '@app/service/user.service';
import { ToastService } from '@app/services/toast.service';
import { TasksStateService } from '../../tasks-state.service';

interface TaskGroup {
  key: 'overdue' | 'today' | 'thisWeek' | 'later' | 'noDate' | 'done';
  label: string;
  tasks: CaseTask[];
  emphasis?: 'danger';
}

type AssignmentChip = 'all' | 'mine' | 'assigned';
type OpenMenu = 'case' | 'priority' | 'due' | 'status' | null;
type DueBucket = 'overdue' | 'today' | 'thisWeek' | 'later' | 'noDate' | 'done';

interface CaseOption {
  key: string;     // caseId-as-string, or `__num:<caseNumber>` if no id
  label: string;   // caseTitle || caseNumber
}

@Component({
  selector: 'app-task-view',
  templateUrl: './task-view.component.html',
  styleUrls: ['./task-view.component.scss'],
})
export class TaskViewComponent implements OnInit, OnDestroy {
  // Canonical task list (active only — COMPLETED + CANCELLED stripped at fetch).
  // `groups` is derived from this via applyFilters().
  private allTasks: CaseTask[] = [];

  groups: TaskGroup[] = [];
  /**
   * Skeleton flag. Default false — only set to true when we're firing a fetch
   * with no data to render yet. Warm mount (tab switch from Pipeline/Workload
   * back to Inbox) renders the cached list in one frame; the in-flight refresh
   * runs silently (silent=true on loadTasks) so pagination stays accurate.
   */
  loading = false;
  selectedTaskId: number | null = null;

  // Counts off the canonical (unfiltered) list.
  totalActiveCount = 0;
  overdueCount = 0;
  mineCount = 0;
  assignedCount = 0;

  // Filter state. `selectedStatuses` empty = active-only default (strips
  // COMPLETED + CANCELLED). Any selection = honor the user's pick exactly,
  // which is the only way to surface completed tasks.
  activeChip: AssignmentChip = 'all';
  selectedCases = new Set<string>();
  selectedPriorities = new Set<TaskPriority>();
  selectedDue = new Set<DueBucket>();
  selectedStatuses = new Set<TaskStatus>();

  // Dropdown menu state. Only one open at a time.
  openMenu: OpenMenu = null;
  openRowMenuId: number | null = null;

  // Collapsed group keys — empty by default (everything expanded). Click a
  // group header to toggle. State is component-local; not persisted across
  // page reloads. Adding persistence is a future polish if users find
  // themselves re-collapsing the same groups.
  collapsedGroups = new Set<string>();

  // Available filter options (Case list derived from data).
  caseOptions: CaseOption[] = [];
  readonly priorityOptions: TaskPriority[] = [
    TaskPriority.URGENT,
    TaskPriority.HIGH,
    TaskPriority.MEDIUM,
    TaskPriority.LOW,
  ];
  readonly dueOptions: { key: DueBucket; label: string }[] = [
    { key: 'overdue', label: 'Overdue' },
    { key: 'today', label: 'Today' },
    { key: 'thisWeek', label: 'This week' },
    { key: 'later', label: 'Later' },
    { key: 'noDate', label: 'No due date' },
  ];

  // All lifecycle statuses for the Status dropdown. Order mirrors the V1
  // stepper sequence (Todo → In progress → Review → Completed) with the
  // off-track states (Blocked, Cancelled) at the end.
  readonly statusOptions: TaskStatus[] = [
    TaskStatus.TODO,
    TaskStatus.IN_PROGRESS,
    TaskStatus.REVIEW,
    TaskStatus.COMPLETED,
    TaskStatus.BLOCKED,
    TaskStatus.CANCELLED,
  ];

  // Logged-in user (reactive — synced via auth.currentUser$ in ngOnInit).
  // Mine/Delegated filters no-op when null; subscription re-runs filters
  // once it arrives so Mine doesn't stay stuck at 0 on cold load.
  private currentUserId: number | null = null;

  // Pagination state. Mirrors the case-list pattern (Spring Data Page object
  // returned from the backend: number, size, totalElements, totalPages,
  // first, last). `pageMeta = null` until the first fetch resolves.
  currentPage = 0;
  pageSize = 25;
  pageMeta: {
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
    first: boolean;
    last: boolean;
  } | null = null;

  private static readonly AVATAR_PALETTE = [
    '#0b64e9', // blue
    '#16a34a', // green
    '#6b4aff', // violet
    '#ec4899', // pink
    '#f97006', // orange
    '#0c0a09', // dark
  ];

  // Per-case dot color palette — matches `.cdot-*` definitions in the
  // brainstorm preview (line 199-204). Hashing the case key into this
  // palette gives every case a stable, distinguishable dot color in
  // the row chip.
  private static readonly CASE_DOT_PALETTE = [
    '#0b64e9', // cdot-blue
    '#16a34a', // cdot-green
    '#6b4aff', // cdot-violet
    '#ec4899', // cdot-pink
    '#f97006', // cdot-orange
    '#f24149', // cdot-red
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private taskService: CaseTaskService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private state: TasksStateService,
    private userService: UserService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    // Seed currentUserId from whatever's already cached so Mine works on the
    // very first render (no async delay). UserService is the authoritative
    // source — it's what the actual login flow populates, not AuthService.
    this.currentUserId = this.userService.getCurrentUserId();

    // Reactive update — if the user data arrives later (cold reload, profile
    // refresh, role change), re-run filters so Mine count snaps to the right
    // value without a manual refresh.
    this.userService.userData$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      const next = user?.id ?? null;
      if (next === this.currentUserId) return;
      this.currentUserId = next;
      if (this.allTasks.length > 0) {
        this.recomputeBaseStats();
        this.applyFilters();
      }
    });

    // Cache-aware initial load. Warm mount (cache populated by an earlier
    // visit during this page session) renders the cached list immediately
    // and refreshes silently in the background to keep pageMeta accurate.
    // Cold mount shows the skeleton and fetches normally.
    const warm = this.state.hasCachedTasks;
    this.loadTasks(0, warm);

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((p) => {
      const tid = p.get('task');
      this.selectedTaskId = tid ? +tid : null;
    });

    // Live cache subscription — re-derives `allTasks` whenever the shared
    // task cache changes. This is what makes drawer mutations (status
    // change, assignee swap, due-date edit) update the list's progress bar
    // and group placement without a full refetch. Order is preserved for
    // tasks already in the list to avoid jumpy re-renders on every upsert.
    this.state.tasks$.pipe(takeUntil(this.destroy$)).subscribe((cacheTasks) => {
      // Skip the initial empty emission so we don't clobber the seeded list
      // with an empty array before the fetch lands.
      if (cacheTasks.length === 0 && this.allTasks.length === 0) return;

      const cacheById = new Map<number, CaseTask>();
      for (const t of cacheTasks) {
        if (t.id != null) cacheById.set(t.id, t);
      }

      // Preserve current order: keep existing tasks at their positions,
      // append any that are new to the cache at the end. Status filter
      // (drop COMPLETED + CANCELLED) runs after merging so a task that
      // just became COMPLETED in the drawer cleanly drops out.
      const seen = new Set<number>();
      const reordered: CaseTask[] = [];
      for (const old of this.allTasks) {
        if (old.id == null) continue;
        const updated = cacheById.get(old.id);
        if (updated) {
          reordered.push(updated);
          seen.add(old.id);
        }
      }
      for (const t of cacheTasks) {
        if (t.id != null && !seen.has(t.id)) {
          reordered.push(t);
        }
      }

      // Keep ALL tasks (active + completed). applyFilters() handles the
      // active-only default vs explicit Status selection.
      this.allTasks = reordered;
      this.recomputeBaseStats();
      this.rebuildCaseOptions();
      this.applyFilters();
    });

    // Newly-created task (from "+ New task" modal) — pull it to the top of
    // the list. The tasks$ subscription above will already have appended it
    // (in cache iteration order), so this just reorders to put it first.
    this.state.inserted$.pipe(takeUntil(this.destroy$)).subscribe((t) => {
      if (!t || t.id == null) return;
      const status = (t.status as unknown as string)?.toUpperCase?.();
      if (status === 'COMPLETED' || status === 'CANCELLED') return;
      this.allTasks = [t, ...this.allTasks.filter((x) => x.id !== t.id)];
      this.recomputeBaseStats();
      this.rebuildCaseOptions();
      this.applyFilters();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---------------------------------------------------------------------------
  // Pagination — same shape as the case-list page (Spring Data Page object).
  // Mine/All/Delegated and the Case/Priority/Due/Status filters apply to the
  // current page client-side; jumping pages refetches from the server.
  // ---------------------------------------------------------------------------

  /**
   * Load one page of tasks from the backend. `state.setAll(...)` seeds the
   * shared cache so the drawer reads the same set the inbox sees, and the
   * tasks$ subscription handler picks up the new array (replacing the prior
   * page rather than merging across pages — page navigation should reset
   * the visible set, not accumulate).
   *
   * `silent=true` skips the skeleton flag toggle. Used on warm-mount
   * background refresh: the cache already has data the user is looking at,
   * so we keep the skeleton off while pageMeta + the latest server state
   * silently update underneath.
   */
  loadTasks(page: number, silent = false): void {
    if (!silent) this.loading = true;
    this.currentPage = page;

    this.taskService
      .getAllTasks(page, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Backend returns { data: { tasks: Page } } where Page may have content[].
          // Defensive cascade through every shape we've seen.
          let tasks: CaseTask[] = [];
          let pageData: any = null;
          const data: any = response?.data;
          if (data?.tasks?.content && Array.isArray(data.tasks.content)) {
            tasks = data.tasks.content;
            pageData = data.tasks;
          } else if (data?.content && Array.isArray(data.content)) {
            tasks = data.content;
            pageData = data;
          } else if (Array.isArray(data?.tasks)) {
            tasks = data.tasks;
          } else if (Array.isArray(data)) {
            tasks = data;
          }

          // Cache page so the drawer renders instantly from it. Replacing
          // (setAll, not upsert) is intentional — the cache mirrors the
          // current page, not a running union of all loaded pages.
          this.state.setAll(tasks);

          // Keep ALL tasks (including COMPLETED + CANCELLED) in `allTasks`.
          // Active-vs-completed gating happens inside applyFilters() based
          // on the Status dropdown.
          this.allTasks = tasks;

          // Capture page metadata for the pagination footer. Falls back to a
          // single-page synthetic when the backend didn't ship Page fields.
          if (pageData) {
            this.pageMeta = {
              number: pageData.number ?? page,
              size: pageData.size ?? this.pageSize,
              totalElements: pageData.totalElements ?? tasks.length,
              totalPages: pageData.totalPages ?? 1,
              first: pageData.first ?? page === 0,
              last: pageData.last ?? true,
            };
          } else {
            this.pageMeta = {
              number: page,
              size: this.pageSize,
              totalElements: tasks.length,
              totalPages: 1,
              first: true,
              last: true,
            };
          }

          this.recomputeBaseStats();
          this.rebuildCaseOptions();
          this.applyFilters();
          this.loading = false;
        },
        error: () => {
          this.allTasks = [];
          this.groups = [];
          this.totalActiveCount = 0;
          this.overdueCount = 0;
          this.mineCount = 0;
          this.assignedCount = 0;
          this.pageMeta = null;
          this.loading = false;
        },
      });
  }

  /** Page navigator wrapper — mirrors the case-list `goToPage(p)` API. */
  goToPage(p: number): void {
    if (p < 0) return;
    if (this.pageMeta && p >= this.pageMeta.totalPages) return;
    this.loadTasks(p);
  }

  /** Step ±1 page from the current cursor. */
  goToNextOrPreviousPage(direction: 'forward' | 'back'): void {
    this.goToPage(direction === 'forward' ? this.currentPage + 1 : this.currentPage - 1);
  }

  /** Visible row count for the "Showing X of Y" label. */
  visibleCount(): number {
    return this.groups.reduce((sum, g) => sum + g.tasks.length, 0);
  }

  // ---------------------------------------------------------------------------
  // Row click + drawer
  // ---------------------------------------------------------------------------

  selectTask(task: CaseTask): void {
    // Synchronously select via state — drawer renders immediately
    // from the in-memory cache.
    if (task?.id != null) this.state.select(task.id);

    // Update URL via History API (NOT Angular Router) so the global
    // preloader (subscribed to NavigationStart) does NOT fire. URL bar
    // still reflects modal state for deep links + browser back/forward.
    const tree = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams: { task: task.id },
      queryParamsHandling: 'merge',
    });
    this.location.replaceState(this.router.serializeUrl(tree));
  }

  trackById(_: number, t: CaseTask): number {
    return t.id;
  }

  // ---------------------------------------------------------------------------
  // Filter UI handlers
  // ---------------------------------------------------------------------------

  setAssignmentChip(chip: AssignmentChip, ev?: Event): void {
    ev?.stopPropagation();
    this.activeChip = chip;
    this.applyFilters();
  }

  toggleMenu(menu: Exclude<OpenMenu, null>, ev: Event): void {
    ev.stopPropagation();
    this.openMenu = this.openMenu === menu ? null : menu;
    // Opening a chip dropdown also closes any open row menu.
    this.openRowMenuId = null;
  }

  toggleCase(key: string, ev: Event): void {
    ev.stopPropagation();
    if (this.selectedCases.has(key)) this.selectedCases.delete(key);
    else this.selectedCases.add(key);
    this.applyFilters();
  }

  togglePriority(p: TaskPriority, ev: Event): void {
    ev.stopPropagation();
    if (this.selectedPriorities.has(p)) this.selectedPriorities.delete(p);
    else this.selectedPriorities.add(p);
    this.applyFilters();
  }

  toggleDue(bucket: DueBucket, ev: Event): void {
    ev.stopPropagation();
    if (this.selectedDue.has(bucket)) this.selectedDue.delete(bucket);
    else this.selectedDue.add(bucket);
    this.applyFilters();
  }

  toggleStatus(status: TaskStatus, ev: Event): void {
    ev.stopPropagation();
    if (this.selectedStatuses.has(status)) this.selectedStatuses.delete(status);
    else this.selectedStatuses.add(status);
    this.applyFilters();
  }

  /** True when any filter is non-default — drives the "Clear all" button visibility. */
  hasActiveFilters(): boolean {
    return (
      this.activeChip !== 'all' ||
      this.selectedCases.size > 0 ||
      this.selectedPriorities.size > 0 ||
      this.selectedDue.size > 0 ||
      this.selectedStatuses.size > 0
    );
  }

  /** Toggle expand/collapse on a group header. */
  toggleGroup(key: string, ev?: Event): void {
    ev?.stopPropagation();
    if (this.collapsedGroups.has(key)) this.collapsedGroups.delete(key);
    else this.collapsedGroups.add(key);
  }

  /** True when the named group is currently collapsed (rows hidden). */
  isGroupCollapsed(key: string): boolean {
    return this.collapsedGroups.has(key);
  }

  /** Reset all filters to default and re-apply. Closes any open dropdown too. */
  clearAllFilters(ev?: Event): void {
    ev?.stopPropagation();
    this.activeChip = 'all';
    this.selectedCases.clear();
    this.selectedPriorities.clear();
    this.selectedDue.clear();
    this.selectedStatuses.clear();
    this.openMenu = null;
    this.applyFilters();
  }

  /**
   * Empty-state context. `filtered` means the inbox has tasks but the active
   * filters squeeze them out — distinct UX from a truly-empty inbox where the
   * user just hasn't created anything yet. The template branches on this so
   * the copy + CTAs match the actual situation.
   */
  emptyStateMode(): 'filtered' | 'inbox' {
    return this.allTasks.length > 0 && this.hasActiveFilters() ? 'filtered' : 'inbox';
  }

  /** Humanize a TaskStatus enum value for the dropdown label ("In progress" etc.). */
  statusOptionLabel(s: TaskStatus): string {
    return this.statusLabel(s as unknown as string);
  }

  // Stop dropdown panel clicks from bubbling to document listener (which
  // would close the menu).
  swallow(ev: Event): void {
    ev.stopPropagation();
  }

  // ---------------------------------------------------------------------------
  // Row action menu
  // ---------------------------------------------------------------------------

  toggleRowMenu(taskId: number, ev: Event): void {
    ev.stopPropagation();
    this.openRowMenuId = this.openRowMenuId === taskId ? null : taskId;
    // Opening a row menu closes any open filter dropdown.
    this.openMenu = null;
  }

  markComplete(task: CaseTask, ev: Event): void {
    ev.stopPropagation();
    this.openRowMenuId = null;
    if (!task?.id) return;

    this.taskService
      .updateTaskStatus(task.id, TaskStatus.COMPLETED)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Backend wraps as { data: { task: CaseTaskDTO } } — unwrap.
          const fromServer = (response?.data as any)?.task ?? response?.data;
          const updated = fromServer ?? { ...task, status: TaskStatus.COMPLETED };
          // Keep the shared cache in sync (drawer reads from it). The
          // tasks$ subscription will pick up the change and re-render the
          // groups via applyFilters; with the active-only default Status
          // filter this row drops out automatically.
          this.state.upsert(updated as CaseTask);
          this.toast.success('Task completed');
        },
        error: (err) => {
          console.error('Failed to mark task complete', err);
          this.toast.error('Failed to complete task');
        },
      });
  }

  editTask(task: CaseTask, ev: Event): void {
    ev.stopPropagation();
    this.openRowMenuId = null;
    if (!task?.id) return;
    // Open the drawer for now (no inline edit form yet).
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { task: task.id },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * "Reassign…" item in the row 3-dot menu. Opens the drawer with
   * `?focus=assignee`; the drawer reads that param and auto-opens the
   * assignee picker on mount.
   */
  reassignFromRow(task: CaseTask, ev: Event): void {
    ev.stopPropagation();
    this.openRowMenuId = null;
    if (!task?.id) return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { task: task.id, focus: 'assignee' },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * "Set due date…" item in the row 3-dot menu (Phase E).
   * Opens the modal with `?focus=due`; the modal reads that param and
   * auto-opens the due-date picker on mount.
   */
  setDueDateFromRow(task: CaseTask, ev: Event): void {
    ev.stopPropagation();
    this.openRowMenuId = null;
    if (!task?.id) return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { task: task.id, focus: 'due' },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * Open the "+ New task" modal from the empty-state CTA. Uses the same
   * direct-state + History-API path the parent's header button uses, so
   * no Angular Router NavigationStart fires (no global preloader flash).
   */
  openNewTaskModal(ev?: Event): void {
    ev?.stopPropagation();
    // Close the drawer first to keep the two overlays from stacking.
    this.state.select(null);
    this.state.setNewTaskOpen(true);

    const queryParams = { ...this.route.snapshot.queryParams, new: 'task' };
    delete queryParams['task'];
    const tree = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams,
    });
    this.location.replaceState(this.router.serializeUrl(tree));
  }

  deleteTask(task: CaseTask, ev: Event): void {
    ev.stopPropagation();
    this.openRowMenuId = null;
    if (!task?.id) return;

    Swal.fire({
      icon: 'warning',
      title: 'Delete task?',
      text: `"${task.title}" will be permanently deleted.`,
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Keep',
      confirmButtonColor: '#f24149',
      reverseButtons: true,
      // Suppress Swal's default body padding shift (it adds ~17px right
      // padding to compensate for the hidden scrollbar, which makes the
      // page visibly "shrink" on every confirm).
      heightAuto: false,
      scrollbarPadding: false,
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.taskService
        .deleteTask(task.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.state.remove(task.id);
            this.allTasks = this.allTasks.filter((t) => t.id !== task.id);
            this.recomputeBaseStats();
            this.rebuildCaseOptions();
            this.applyFilters();
            this.toast.success(`Deleted "${task.title}"`);
          },
          error: (err) => {
            console.error('Failed to delete task', err);
            this.toast.error('Failed to delete task');
          },
        });
    });
  }

  // ---------------------------------------------------------------------------
  // Document click — close any open menu
  // ---------------------------------------------------------------------------

  @HostListener('document:click')
  closeAllMenus(): void {
    this.openMenu = null;
    this.openRowMenuId = null;
  }

  // ---------------------------------------------------------------------------
  // Filter pipeline
  // ---------------------------------------------------------------------------

  /**
   * Recompute chip counts. With "show all statuses" as the default list
   * behavior, total/Mine/Delegated counts now include completed + cancelled
   * tasks too — so the chip badge matches the visible row count. Overdue
   * stays anchored to non-terminal tasks: a completed task isn't "overdue"
   * anymore (the work got done before or after the due date, but it's done).
   */
  private recomputeBaseStats(): void {
    this.totalActiveCount = this.allTasks.length;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let overdue = 0;
    let mine = 0;
    let assignedByMe = 0;

    for (const t of this.allTasks) {
      // Overdue counts only non-terminal tasks past their due date.
      if (!this.isTerminal(t) && t.dueDate) {
        const d = new Date(t.dueDate as any);
        if (!isNaN(d.getTime()) && d < startOfToday) overdue++;
      }
      if (this.currentUserId != null) {
        // V78 multi-assignee: a task is "mine" if I'm the primary
        // (`assignedToId`) OR I appear anywhere in the `assignees[]` list.
        // Without the assignees[] check, tasks assigned to multiple people
        // (where I'm secondary) silently disappear from the Mine view.
        const isMine = this.isMine(t);
        if (isMine) mine++;
        // "Delegated" = I created it AND it's assigned to someone else (not me).
        if (t.createdById === this.currentUserId && !isMine) {
          assignedByMe++;
        }
      }
    }

    this.overdueCount = overdue;
    this.mineCount = mine;
    this.assignedCount = assignedByMe;
  }

  /**
   * V78 multi-assignee aware "is this task mine" check. True when the
   * current user is the primary assignee (legacy `assignedToId`) OR appears
   * anywhere in the new `assignees[]` collection. Returns false when the
   * user isn't logged in (defensive for SSR / pre-auth states).
   */
  private isMine(t: CaseTask): boolean {
    if (this.currentUserId == null) return false;
    if (t.assignedToId === this.currentUserId) return true;
    return (t.assignees ?? []).some((a) => a?.id === this.currentUserId);
  }

  /** Build the Case ▾ option list from the current active set, alphabetical. */
  private rebuildCaseOptions(): void {
    const map = new Map<string, string>();
    for (const t of this.allTasks) {
      const label = t.caseTitle || t.caseNumber;
      if (!label) continue;
      const key = t.caseId != null ? String(t.caseId) : `__num:${t.caseNumber || label}`;
      if (!map.has(key)) map.set(key, label);
    }
    this.caseOptions = Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // Drop selections that no longer exist (after a delete/complete may have
    // emptied the last task for a case).
    for (const k of Array.from(this.selectedCases)) {
      if (!map.has(k)) this.selectedCases.delete(k);
    }
  }

  /** Apply all active filters and regroup. Idempotent. */
  private applyFilters(): void {
    const userId = this.currentUserId;

    let list = this.allTasks;

    // A) Status filter — empty selection means "show all statuses" (no
    // filter). Same convention as the Case/Priority/Due dropdowns: empty
    // = no filter, any selection = explicit filter. Completed and
    // Cancelled tasks render with the title struck through so the eye can
    // still tell them apart at a glance.
    if (this.selectedStatuses.size > 0) {
      list = list.filter((t) => this.selectedStatuses.has(t.status));
    }

    // B) Mine / Delegated chip — V78 multi-assignee aware. "Mine" matches
    // both the legacy `assignedToId` AND any user_id in the new `assignees[]`
    // list, so secondary assignees aren't silently dropped from their own
    // view. "Delegated" is "I created it AND I'm not on it" (a true delegation).
    if (this.activeChip === 'mine' && userId != null) {
      list = list.filter((t) => this.isMine(t));
    } else if (this.activeChip === 'assigned' && userId != null) {
      list = list.filter((t) => t.createdById === userId && !this.isMine(t));
    }

    // C) Case multi-select
    if (this.selectedCases.size > 0) {
      list = list.filter((t) => {
        const key = t.caseId != null ? String(t.caseId) : `__num:${t.caseNumber || t.caseTitle}`;
        return this.selectedCases.has(key);
      });
    }

    // D) Priority multi-select
    if (this.selectedPriorities.size > 0) {
      list = list.filter((t) => this.selectedPriorities.has(t.priority));
    }

    // E) Due multi-select
    if (this.selectedDue.size > 0) {
      list = list.filter((t) => this.selectedDue.has(this.dueBucket(t)));
    }

    this.groups = this.groupByDueBand(list);
  }

  /**
   * Terminal-state check (COMPLETED or CANCELLED). Used by the active-only
   * default filter and by recomputeBaseStats so chip counts anchor to the
   * "still on my plate" set regardless of what the Status dropdown shows.
   */
  private isTerminal(t: CaseTask): boolean {
    const s = (t.status as unknown as string)?.toUpperCase?.();
    return s === 'COMPLETED' || s === 'CANCELLED';
  }

  /**
   * Map a task to its due bucket (matches groupByDueBand's banding rules).
   * Terminal tasks short-circuit to 'done' regardless of due date, so the
   * Due dropdown's "Overdue" filter doesn't surface tasks that have already
   * been completed/cancelled — they're not overdue, the work is done.
   */
  private dueBucket(t: CaseTask): DueBucket {
    if (this.isTerminal(t)) return 'done';
    if (!t.dueDate) return 'noDate';
    const d = new Date(t.dueDate as any);
    if (isNaN(d.getTime())) return 'noDate';
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const dayOfWeek = startOfToday.getDay();
    const endOfWeek = new Date(startOfToday);
    endOfWeek.setDate(startOfToday.getDate() + (6 - dayOfWeek));
    endOfWeek.setHours(23, 59, 59, 999);

    if (d < startOfToday) return 'overdue';
    if (d <= endOfToday) return 'today';
    if (d <= endOfWeek) return 'thisWeek';
    return 'later';
  }

  // ---------------------------------------------------------------------------
  // Grouping + avatar helpers (unchanged from Phase 1)
  // ---------------------------------------------------------------------------

  /**
   * Pick a stable color per assignee from a small palette by hashing the seed
   * (assignedToId or name). Ensures the same person always gets the same color
   * across rows without needing a per-user color field on the backend.
   */
  avatarColor(seed: string | number | null | undefined): string {
    const palette = TaskViewComponent.AVATAR_PALETTE;
    const s = (seed ?? '').toString();
    if (!s) return palette[0];
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return palette[Math.abs(h) % palette.length];
  }

  /**
   * Per-case dot color. Hashes the task's caseId (or caseTitle as fallback)
   * into the same 6-color palette the brainstorm preview uses (`.cdot-*`).
   * Same case -> same color across all rows.
   */
  caseDotColor(task: CaseTask): string {
    const palette = TaskViewComponent.CASE_DOT_PALETTE;
    const seed = task?.caseId != null ? String(task.caseId) : (task?.caseTitle || task?.caseNumber || '');
    if (!seed) return palette[0];
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    }
    return palette[Math.abs(h) % palette.length];
  }

  /**
   * D3 row meta — subtasks counter chip.
   * Reads `subtaskTotal` + `subtaskDoneCount` from the backend (populated on
   * the list endpoint) so we don't need to lazy-load subtasks per row.
   * Falls back to `task.subtasks?.length` for older payloads. Returns null
   * when the task has no subtasks — the chip is omitted entirely (no
   * placeholder).
   */
  subtaskProgress(task: CaseTask): { done: number; total: number; pct: number } | null {
    let total = task.subtaskTotal;
    let done = task.subtaskDoneCount;
    if (total == null) {
      const subs = task.subtasks ?? [];
      total = subs.length;
      done = subs.filter((s) => (s.status as unknown as string) === 'COMPLETED').length;
    }
    if (!total || total === 0) return null;
    const pct = Math.round(((done ?? 0) / total) * 100);
    return { done: done ?? 0, total, pct };
  }

  /**
   * D3 row meta — status chip label. "IN_PROGRESS" → "In progress",
   * "TODO" → "Todo". Mirrors the V1 stepper labels inside the modal so
   * the list and modal speak the same language.
   */
  statusLabel(status: string | null | undefined): string {
    const s = (status ?? '').toString().toUpperCase();
    switch (s) {
      case 'TODO':        return 'Todo';
      case 'IN_PROGRESS': return 'In progress';
      case 'REVIEW':      return 'Review';
      case 'BLOCKED':     return 'Blocked';
      case 'COMPLETED':   return 'Completed';
      case 'CANCELLED':   return 'Cancelled';
      default:            return s ? s.charAt(0) + s.slice(1).toLowerCase() : '';
    }
  }

  /**
   * D3 row meta — status chip tone class. Matches the V1 stepper's active
   * pill colors (TODO=muted, IN_PROGRESS=accent blue, REVIEW=info violet,
   * BLOCKED=danger red) so the row signal is consistent with the modal.
   * COMPLETED + CANCELLED tasks are filtered out of the inbox set up-front
   * and won't render here in normal flow, but tones are defined for
   * completeness.
   */
  statusTone(status: string | null | undefined): string {
    const s = (status ?? '').toString().toUpperCase();
    switch (s) {
      case 'TODO':        return 'tone-muted';
      case 'IN_PROGRESS': return 'tone-accent';
      case 'REVIEW':      return 'tone-info';
      case 'BLOCKED':     return 'tone-danger';
      case 'COMPLETED':   return 'tone-success';
      case 'CANCELLED':   return 'tone-muted';
      default:            return 'tone-muted';
    }
  }

  /**
   * D3 row right-side date label. For active tasks shows the due-date via
   * `dueLabel` (e.g., "Today, 5p", "2 days late", "Wed, May 8"). For
   * COMPLETED / CANCELLED tasks shows the lifecycle outcome instead —
   * "Completed Apr 7" or "Cancelled" — so the row doesn't mislead with a
   * red "X days late" string when the work is already done.
   */
  dueOrOutcomeLabel(task: CaseTask): string {
    const status = (task.status as unknown as string)?.toUpperCase?.();
    if (status === 'COMPLETED') {
      const at = task.completedAt;
      if (at) {
        const d = new Date(at as any);
        if (!isNaN(d.getTime())) {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return `Completed ${months[d.getMonth()]} ${d.getDate()}`;
        }
      }
      return 'Completed';
    }
    if (status === 'CANCELLED') return 'Cancelled';
    return ''; // template uses dueLabel pipe for active tasks
  }

  /**
   * D3 row meta — show the time chip when the case is hourly/flat AND the
   * task has any time data (actual or estimated). Hides for contingency /
   * pro-bono cases AND for hourly tasks with no time data yet, so the row
   * stays clean for tasks the user hasn't started clocking.
   */
  showTimeChip(task: CaseTask): boolean {
    if (!this.showTimeLog(task)) return false;
    const actual = Number(task.actualHours ?? 0);
    const est = Number(task.estimatedHours ?? 0);
    return actual > 0 || est > 0;
  }

  /**
   * D3 time-chip warn tone — true when actualHours exceeds estimatedHours.
   * Only meaningful when both are set; if estimate is missing or zero, no
   * comparison is possible so we treat it as on-budget (no warn).
   */
  timeOverEstimate(task: CaseTask): boolean {
    const actual = Number(task.actualHours);
    const est = Number(task.estimatedHours);
    if (!Number.isFinite(actual) || !Number.isFinite(est) || est <= 0) return false;
    return actual > est;
  }

  /**
   * D2 row gating: hide the inline `⏱ Xh` chip for contingency / pro-bono cases.
   * Mirrors the drawer's Time-logged section gate so list and modal stay consistent.
   * Defaults to TRUE when caseBillingType is undefined (legacy data) so we don't
   * accidentally hide the chip on real billable tasks.
   */
  showTimeLog(task: CaseTask): boolean {
    const t: any = (task as any).caseBillingType;
    if (t === 'CONTINGENCY' || t === 'PRO_BONO') return false;
    return true;
  }

  /**
   * Bucket tasks into time-bands for the inbox grouping. Terminal tasks
   * (COMPLETED, CANCELLED) skip date bucketing entirely and go to a "Done"
   * group at the bottom — a completed task isn't "overdue" anymore even if
   * its due date was last month, so putting it in Overdue with red "X days
   * late" text was misleading. Active work appears first (Overdue → Today →
   * This week → Later → No due date) and finished work trails at the end.
   */
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
    const done: CaseTask[] = [];

    for (const t of tasks) {
      // Status-first check: terminal tasks always go to Done, regardless
      // of due date. Without this guard, completed-but-was-overdue tasks
      // landed in Overdue with misleading red "X days late" text.
      if (this.isTerminal(t)) {
        done.push(t);
        continue;
      }

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
      { key: 'done' as const, label: 'Done', tasks: done },
    ].filter((g) => g.tasks.length > 0);
  }
}
