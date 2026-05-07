import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { Subject, of, switchMap, takeUntil } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { CaseTaskService } from '@app/service/case-task.service';
import {
  CaseTask,
  TaskPriority,
  TaskStatus,
  TaskType,
  TaskUpdateRequest,
} from '@app/interface/case-task';
import { BillingType } from '@app/modules/legal/interfaces/case.interface';
import { UserService } from '@app/service/user.service';
import { User } from '@app/interface/user';
import Swal from 'sweetalert2';
import { TasksStateService } from '../tasks-state.service';
import { ToastService } from '@app/services/toast.service';

type TasksView = 'inbox' | 'pipeline' | 'workload';

/**
 * Unified task drawer mounted as a sibling overlay on the tasks page.
 *
 * Route-driven: opens when `?task=:id` is present in the query string,
 * closes when that param is removed. The `?focus=` param controls which
 * field auto-focuses on mount (currently `assignee` from row 3-dot menu's
 * "Reassign…" item).
 *
 * Wave 1 Phase 1 follow-up adds:
 *  - Clickable status pill with dropdown (any -> any transition).
 *  - Required-prompt modal when transitioning to BLOCKED (reason +
 *    optional auto-unblock date).
 *  - Subtasks CRUD: inline add input, toggle complete, delete.
 *  - Assignee picker that lists org attorneys + reassigns.
 *  - Lucide icons replacing every text-glyph affordance.
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

  // ── Status menu state ───────────────────────────────────────
  // Legacy dropdown flag; V1 Segmented Pills (Phase F) renders inline
  // pills instead — see `stepperStatuses`. BLOCKED/CANCELLED are now
  // off-track link buttons under the stepper, not a dropdown.
  statusMenuOpen = false;
  readonly statusOptions: TaskStatus[] = [
    TaskStatus.TODO,
    TaskStatus.IN_PROGRESS,
    TaskStatus.REVIEW,
    TaskStatus.BLOCKED,
    TaskStatus.COMPLETED,
    TaskStatus.CANCELLED,
  ];

  // V1 Segmented Pills — the on-track flow only. Spec:
  //   TODO → IN_PROGRESS → REVIEW → COMPLETED
  // BLOCKED and CANCELLED are off-track transitions, surfaced as a thin
  // links row UNDER the stepper (see template). This keeps the forward
  // flow visually clean.
  readonly stepperStatuses: TaskStatus[] = [
    TaskStatus.TODO,
    TaskStatus.IN_PROGRESS,
    TaskStatus.REVIEW,
    TaskStatus.COMPLETED,
  ];

  // ── Blocker required-prompt state ───────────────────────────
  blockerPromptOpen = false;
  blockerReason = '';
  blockerAutoUnblockDate: string = ''; // YYYY-MM-DD from <input type="date">
  blockerSubmitting = false;

  // ── Subtasks CRUD state ─────────────────────────────────────
  subtaskAddOpen = false;
  newSubtaskTitle = '';
  @ViewChild('subtaskInput') subtaskInput?: ElementRef<HTMLInputElement>;

  // ── Assignee picker state ───────────────────────────────────
  assigneeMenuOpen = false;
  assigneeSearchQuery = '';
  users: User[] = [];
  private usersLoaded = false;

  // ── Due-date picker state (Phase E) ─────────────────────────
  // `dueDateInput` is the YYYY-MM-DD string bound to <input type="date">.
  // On submit we send it as ISO; backend stores LocalDateTime so we send
  // an end-of-day local time to match the existing dueDate semantics.
  dueDateMenuOpen = false;
  dueDateInput = '';
  dueDateSubmitting = false;

  // ── Comments add-only state ─────────────────────────────────
  // Comments render flat (no Show all / Show less). Just composer state here.
  newComment = '';
  commentSubmitting = false;

  // ── Activity log accordion ──────────────────────────────────
  activityLogOpen = false;

  private destroy$ = new Subject<void>();

  // Same palette + hash strategy as TaskViewComponent so the same
  // person gets the same color in both the row and the drawer.
  private static readonly AVATAR_PALETTE = [
    '#0b64e9', // blue
    '#16a34a', // green
    '#6b4aff', // violet
    '#ec4899', // pink
    '#f97006', // orange
    '#0c0a09', // dark
  ];

  private static readonly CASE_DOT_PALETTE = [
    '#0b64e9', '#16a34a', '#6b4aff', '#ec4899', '#f97006', '#f24149',
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private taskService: CaseTaskService,
    private userService: UserService,
    private state: TasksStateService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    // Pre-load attorneys at mount so the assignee dropdown opens with the
    // list ready — no half-second wait while the request fires on first
    // click. ensureUsersLoaded() is idempotent (guarded by `usersLoaded`).
    this.ensureUsersLoaded();

    // Track activeView from the URL (cheap subscription, no fetch).
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((p) => {
      const view = p.get('view') as TasksView | null;
      this.activeView = view === 'pipeline' || view === 'workload' ? view : 'inbox';

      const focus = p.get('focus');
      if (focus === 'assignee') {
        setTimeout(() => this.openAssigneeMenuFromRoute(), 0);
      } else if (focus === 'due') {
        setTimeout(() => this.openDueDatePickerFromRoute(), 0);
      }
    });

    // Selection-driven: state.select(id) fires synchronously on row click,
    // so the modal renders without waiting for router.navigate (~1s).
    // Cache-first: render the modal instantly from the inbox-list cache,
    // then upgrade to the full record (with comments + subtasks) once the
    // background fetch resolves. switchMap cancels in-flight fetches if
    // selection changes before the previous one returns.
    this.state.selectedId$
      .pipe(
        takeUntil(this.destroy$),
        switchMap((id) => {
          if (id == null) {
            this.task = null;
            this.loading = false;
            return of(null);
          }

          // Synchronous cache hit — render immediately, no spinner flash.
          const cached = this.state.get(id);
          if (cached) {
            this.task = cached;
            this.loading = false;
          } else {
            // Cache miss (deep-link or page refresh) — show loading until
            // the background fetch lands.
            this.task = null;
            this.loading = true;
          }

          // Background-fetch the full task so comments + subtasks populate
          // (the list endpoint only ships commentsCount). Backend returns
          // { data: { task: CaseTaskDTO } }; service's type signature is
          // loose, so unwrap defensively.
          return this.taskService.getTask(id).pipe(
            map((r: any) => (r?.data?.task ?? r?.data ?? null) as CaseTask | null),
            catchError(() => of(null)),
          );
        }),
      )
      .subscribe((t) => {
        if (t && t.id != null) {
          // Smart-merge: if a local mutation (e.g., toggleSubtask, comment add)
          // landed while this background fetch was in flight, the fetched
          // snapshot is stale for those fields. Prefer the local copy when it
          // diverges from the fetched copy on subtasks or comments. Without
          // this, a fast subtask toggle followed by a slow getTask response
          // produces a flicker where completedAt appears, then disappears.
          this.task = this.mergeFetchedTask(this.task, t);
          this.state.upsert(this.task);
        }
        this.loading = false;
      });
  }

  /**
   * Merge a freshly-fetched task with the local in-memory task. The fetched
   * version is generally authoritative, EXCEPT for sub-records that the user
   * may have just mutated locally (subtasks, comments). For those, prefer
   * the local copy when it diverges, so a slower fetch can't clobber a faster
   * mutation response.
   */
  private mergeFetchedTask(local: CaseTask | null, fetched: CaseTask): CaseTask {
    if (!local || local.id !== fetched.id) return fetched;

    return {
      ...fetched,
      subtasks: this.mergeSubtasksLocalPriority(local.subtasks ?? [], fetched.subtasks ?? []),
      // Comments: prefer whichever list is longer (the FE just-added a comment
      // that's not yet in the fetched response, so we take local; otherwise
      // fetched wins because the BE ordering is canonical).
      comments:
        (local.comments?.length ?? 0) > (fetched.comments?.length ?? 0)
          ? local.comments
          : fetched.comments,
    };
  }

  /**
   * Merge subtask arrays preferring local state when the local copy diverges
   * (different status OR completedAt set locally but not in fetched). This
   * fixes the race where the detail-fetch response was kicked off BEFORE a
   * subtask toggle landed, so the fetched response carries stale state.
   * Also preserves any subtasks added locally that aren't in the fetched
   * response yet (just-created subtasks via inline add).
   */
  private mergeSubtasksLocalPriority(local: CaseTask[], fetched: CaseTask[]): CaseTask[] {
    const localById = new Map<number, CaseTask>();
    for (const s of local) {
      if (s?.id != null) localById.set(s.id, s);
    }

    const merged: CaseTask[] = [];
    const seenIds = new Set<number>();

    for (const f of fetched) {
      if (f?.id == null) {
        merged.push(f);
        continue;
      }
      seenIds.add(f.id);
      const l = localById.get(f.id);
      if (!l) {
        merged.push(f);
        continue;
      }
      const localDiverges =
        l.status !== f.status ||
        (l.completedAt != null && f.completedAt == null);
      merged.push(localDiverges ? { ...f, ...l } : f);
    }

    // Append local-only subtasks (just-created via inline add, not yet in the
    // fetched response).
    for (const l of local) {
      if (l?.id != null && !seenIds.has(l.id)) {
        merged.push(l);
      }
    }

    return merged;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ───────────────────────────────────────────────────────────────────────
  // Close + lifecycle
  // ───────────────────────────────────────────────────────────────────────

  close(): void {
    // Clear selection synchronously so the modal vanishes immediately.
    this.state.select(null);

    // Update URL via History API to drop ?task= and ?focus= without
    // firing Angular Router NavigationStart (which would trigger the
    // global preloader).
    const queryParams = { ...this.route.snapshot.queryParams };
    delete queryParams['task'];
    delete queryParams['focus'];
    const tree = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams,
    });
    this.location.replaceState(this.router.serializeUrl(tree));
  }

  isBlocked(): boolean {
    return this.task?.status === TaskStatus.BLOCKED;
  }

  /** Done count for "Subtasks · X of Y". */
  get doneSubtaskCount(): number {
    return this.task?.subtasks?.filter((s) => s.status === TaskStatus.COMPLETED).length ?? 0;
  }

  /** "IN_PROGRESS" → "In progress" (titlecase + replace underscores). */
  humanizeStatus(s: string | null | undefined): string {
    if (!s) return '';
    const lower = s.replace(/_/g, ' ').toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }

  /**
   * V1 stepper per-step rendering state.
   *  - 'past'   → success-bg + ✓
   *  - 'active' → accent-bg + accent border ring
   *  - 'future' → muted with empty circle
   *
   * BLOCKED and CANCELLED are off-track. When current is one of those, ALL
   * stepper pills render as 'future' (no active pill on the bar); the
   * off-track link row below carries the active state instead.
   */
  stepStateOf(currentStatus: TaskStatus | string | null | undefined, stepStatus: TaskStatus): 'past' | 'active' | 'future' {
    const ORDER: string[] = [
      TaskStatus.TODO,
      TaskStatus.IN_PROGRESS,
      TaskStatus.REVIEW,
      TaskStatus.COMPLETED,
    ];
    const cur = String(currentStatus ?? '');
    if (cur === TaskStatus.BLOCKED || cur === TaskStatus.CANCELLED) {
      return 'future';
    }
    if (cur === stepStatus) return 'active';
    const ci = ORDER.indexOf(cur);
    const si = ORDER.indexOf(stepStatus);
    if (ci > si && ci !== -1) return 'past';
    return 'future';
  }

  // ───────────────────────────────────────────────────────────────────────
  // Status menu
  // ───────────────────────────────────────────────────────────────────────

  toggleStatusMenu(ev: Event): void {
    ev.stopPropagation();
    this.statusMenuOpen = !this.statusMenuOpen;
    if (this.statusMenuOpen) this.assigneeMenuOpen = false;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Phase G + H helpers — billing-type-aware UI gating.
  // ───────────────────────────────────────────────────────────────────────

  /**
   * True when the modal should show the estimated/logged hours metadata
   * cell. False for CONTINGENCY/PRO_BONO cases. Defaults to TRUE when
   * caseBillingType is undefined (e.g. tasks not linked to a case yet, or
   * legacy data) to avoid hiding legitimate time entries by accident.
   */
  showHoursCell(): boolean {
    const t = this.task?.caseBillingType;
    if (t === BillingType.CONTINGENCY || t === BillingType.PRO_BONO) {
      return false;
    }
    return true;
  }

  /** Derived "remaining" hours; null when estimate/actual missing. */
  hoursRemaining(): number | null {
    const est = this.task?.estimatedHours;
    const actual = this.task?.actualHours;
    if (est == null || actual == null) return null;
    const remaining = Number(est) - Number(actual);
    if (!Number.isFinite(remaining)) return null;
    // Round to 1 decimal so "1.6h remaining" reads cleanly.
    return Math.round(remaining * 10) / 10;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Comments — add-only. Comments render flat in the template; no Show all.
  // ───────────────────────────────────────────────────────────────────────

  submitComment(ev?: Event): void {
    ev?.stopPropagation();
    const text = this.newComment.trim();
    if (!text || !this.task?.id) return;

    const id = this.task.id;
    this.commentSubmitting = true;

    this.taskService
      .addComment(id, text)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Endpoint returns { data: { comment: TaskCommentDTO } }; unwrap
          // defensively since the service signature is loose.
          const created: any =
            (response as any)?.data?.comment ?? (response as any)?.data ?? null;

          if (this.task) {
            const next: any = {
              ...this.task,
              comments: [...(this.task.comments ?? []), created].filter(Boolean),
            };
            this.task = next;
            this.state.upsert(next);
          }
          this.newComment = '';
          this.commentSubmitting = false;
          this.toast.success('Comment added');
        },
        error: (err) => {
          console.error('Failed to add comment', err);
          this.commentSubmitting = false;
          this.toast.error('Failed to add comment');
        },
      });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Activity log accordion (Phase H)
  // ───────────────────────────────────────────────────────────────────────

  toggleActivityLog(ev?: Event): void {
    ev?.stopPropagation();
    this.activityLogOpen = !this.activityLogOpen;
  }

  /**
   * "⏸ Mark blocked" link below the V1 stepper. Routes through the same
   * existing blocker prompt path so the user must supply a reason.
   */
  markBlockedLink(ev: Event): void {
    ev.stopPropagation();
    if (!this.task) return;
    if (this.task.status === TaskStatus.BLOCKED) return;
    this.openBlockerPrompt();
  }

  /**
   * "Cancel" link below the V1 stepper. Confirms before cancelling because
   * CANCELLED is a terminal state.
   */
  cancelTaskLink(ev: Event): void {
    ev.stopPropagation();
    if (!this.task) return;
    if (this.task.status === TaskStatus.CANCELLED) return;
    Swal.fire({
      icon: 'warning',
      title: 'Cancel this task?',
      text: 'Status will be set to CANCELLED.',
      showCancelButton: true,
      confirmButtonText: 'Yes, cancel',
      cancelButtonText: 'Keep open',
      confirmButtonColor: '#f24149',
      reverseButtons: true,
      // Stack the confirm dialog ABOVE the drawer/modal (which sits at
      // --legience-z-modal: 1070). Without this the confirm renders behind.
      // `heightAuto: false` + `scrollbarPadding: false` stop Swal from
      // injecting body padding (which causes the page to "shrink").
      heightAuto: false,
      scrollbarPadding: false,
      customClass: { container: 'swal-above-modal' },
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.changeStatus(TaskStatus.CANCELLED, ev);
    });
  }

  changeStatus(newStatus: TaskStatus, ev: Event): void {
    ev.stopPropagation();
    this.statusMenuOpen = false;
    if (!this.task) return;
    if (this.task.status === newStatus) return;

    if (newStatus === TaskStatus.BLOCKED) {
      // Required-prompt: open the small confirm modal before persisting.
      this.openBlockerPrompt();
      return;
    }

    this.persistStatus(newStatus);
  }

  private persistStatus(newStatus: TaskStatus): void {
    const id = this.task?.id;
    if (id == null || !this.task) return;

    // OPTIMISTIC UPDATE: flip the local state immediately so the stepper +
    // row position update without waiting for the network roundtrip. The
    // server-returned task overwrites this on success (so completedAt et al.
    // come from the source of truth); on error we revert to the previous
    // status.
    const previous: CaseTask = this.task;

    // Auto-cascade: when marking COMPLETED, also close any open subtasks.
    // This matches the UX pattern in Things 3 / Apple Reminders — completing
    // the parent implies the work is done. The cascade is OPTIMISTIC: flip
    // local subtask state immediately, then fire individual updateTaskStatus
    // calls per subtask in parallel (no batch endpoint exists yet — flagged
    // for backend cleanup). The toast names the count so the user sees what
    // happened (no silent magic). If a subtask wasn't actually done, the
    // user can manually reopen it from the drawer.
    const openSubtasksToCascade =
      newStatus === TaskStatus.COMPLETED && this.task.subtasks
        ? this.task.subtasks.filter(
            (s) => s?.id != null && s.status !== TaskStatus.COMPLETED,
          )
        : [];

    let optimistic: CaseTask;
    if (openSubtasksToCascade.length > 0 && this.task.subtasks) {
      const nowDate = new Date() as any;
      optimistic = {
        ...this.task,
        status: newStatus,
        subtasks: this.task.subtasks.map((s) =>
          s.status !== TaskStatus.COMPLETED
            ? { ...s, status: TaskStatus.COMPLETED, completedAt: nowDate }
            : s,
        ),
      };
    } else {
      optimistic = { ...this.task, status: newStatus };
    }
    this.task = optimistic;
    this.state.upsert(optimistic);

    this.taskService
      .updateTaskStatus(id, newStatus)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Backend wraps as { data: { task: CaseTaskDTO } } — unwrap defensively.
          const fromServer = (response?.data as any)?.task ?? response?.data;
          const updated: CaseTask = fromServer ? (fromServer as CaseTask) : optimistic;
          this.task = updated;
          this.state.upsert(updated);

          // Persist the subtask cascade in parallel after the parent succeeds.
          // We don't merge their responses back into local state — the
          // optimistic cascade already set them locally, and the next time
          // the drawer opens we'll fetch fresh data anyway. Subtask failures
          // log but don't toast individually (would spam the user).
          if (openSubtasksToCascade.length > 0) {
            for (const st of openSubtasksToCascade) {
              this.taskService
                .updateTaskStatus(st.id as number, TaskStatus.COMPLETED)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                  error: (err) =>
                    console.error('Failed to auto-complete subtask', st.id, err),
                });
            }
          }

          const cascadeMsg =
            openSubtasksToCascade.length > 0
              ? ` · ${openSubtasksToCascade.length} subtask${
                  openSubtasksToCascade.length > 1 ? 's' : ''
                } also closed`
              : '';
          this.toast.success(
            `Status updated to ${this.humanizeStatus(newStatus)}${cascadeMsg}`,
          );
        },
        error: (err) => {
          console.error('Failed to update task status', err);
          // Revert to the pre-click state — including any optimistic subtask
          // closures, since the parent persist didn't actually succeed.
          this.task = previous;
          this.state.upsert(previous);
          this.toast.error('Failed to update status');
        },
      });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Blocker required-prompt
  // ───────────────────────────────────────────────────────────────────────

  openBlockerPrompt(): void {
    this.blockerReason = this.task?.blockerReason ?? '';
    this.blockerAutoUnblockDate = this.task?.autoUnblockDate
      ? this.toDateInputValue(this.task.autoUnblockDate)
      : '';
    this.blockerPromptOpen = true;
  }

  cancelBlockerPrompt(): void {
    this.blockerPromptOpen = false;
    this.blockerReason = '';
    this.blockerAutoUnblockDate = '';
  }

  submitBlockerPrompt(): void {
    const reason = this.blockerReason.trim();
    if (!reason || !this.task?.id) return;

    this.blockerSubmitting = true;
    const id = this.task.id;
    const payload: TaskUpdateRequest = {
      status: TaskStatus.BLOCKED,
      blockerReason: reason,
    };
    if (this.blockerAutoUnblockDate) {
      payload.autoUnblockDate = this.blockerAutoUnblockDate;
    }

    this.taskService
      .updateTask(id, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Backend wraps as { data: { task: CaseTaskDTO } } — unwrap defensively.
          const fromServer = (response?.data as any)?.task ?? response?.data;
          const updated: CaseTask = fromServer
            ? (fromServer as CaseTask)
            : ({
                ...(this.task as CaseTask),
                status: TaskStatus.BLOCKED,
                blockerReason: reason,
                autoUnblockDate: this.blockerAutoUnblockDate || undefined,
              } as CaseTask);
          this.task = updated;
          this.state.upsert(updated);
          this.blockerSubmitting = false;
          this.blockerPromptOpen = false;
          this.toast.success('Task marked as blocked');
        },
        error: (err) => {
          console.error('Failed to mark task as blocked', err);
          this.blockerSubmitting = false;
          this.toast.error('Failed to mark task as blocked');
        },
      });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Subtasks CRUD
  // ───────────────────────────────────────────────────────────────────────

  openSubtaskAdd(ev?: Event): void {
    ev?.stopPropagation();
    this.subtaskAddOpen = true;
    setTimeout(() => this.subtaskInput?.nativeElement?.focus(), 0);
  }

  cancelSubtaskAdd(): void {
    this.subtaskAddOpen = false;
    this.newSubtaskTitle = '';
  }

  createSubtask(): void {
    const title = this.newSubtaskTitle.trim();
    if (!title || !this.task) return;

    const caseId = this.task.caseId;
    if (caseId == null) {
      console.error('Cannot create subtask: parent task has no caseId');
      return;
    }

    this.taskService
      .createTask({
        caseId,
        parentTaskId: this.task.id,
        title,
        taskType: TaskType.OTHER,
        priority: TaskPriority.MEDIUM,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const newSubtask =
            (response?.data as any)?.task ?? (response?.data as any) ?? null;
          if (newSubtask && this.task) {
            this.task = {
              ...this.task,
              subtasks: [...(this.task.subtasks ?? []), newSubtask],
            };
            this.state.upsert(this.task);
            this.cancelSubtaskAdd();
            this.toast.success('Subtask added');
          }
        },
        error: (err) => {
          console.error('Failed to create subtask', err);
          this.toast.error('Failed to add subtask');
        },
      });
  }

  toggleSubtask(st: CaseTask, ev: Event): void {
    ev.stopPropagation();
    if (!st?.id || !this.task) return;
    const newStatus =
      st.status === TaskStatus.COMPLETED ? TaskStatus.TODO : TaskStatus.COMPLETED;

    // OPTIMISTIC UPDATE: flip the subtask's status (and a placeholder
    // completedAt) immediately. Backend response overrides with the real
    // `completedAt` timestamp; on error we revert.
    const previous: CaseTask = this.task;
    const optimisticSubtask: Partial<CaseTask> = {
      status: newStatus,
      completedAt: newStatus === TaskStatus.COMPLETED ? (new Date() as any) : undefined,
    };
    const optimistic: CaseTask = {
      ...this.task,
      subtasks: (this.task.subtasks ?? []).map((s) =>
        s.id === st.id ? { ...s, ...optimisticSubtask } : s,
      ),
    };
    this.task = optimistic;
    this.state.upsert(optimistic);

    this.taskService
      .updateTaskStatus(st.id, newStatus)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Backend wraps as { data: { task: CaseTaskDTO } } — unwrap defensively.
          // Reading the response back is what gives us the authoritative
          // `completedAt` set by TaskManagementServiceImpl.updateTaskStatus
          // (set on COMPLETED, cleared on any other status).
          const fromServer = (response?.data as any)?.task ?? response?.data;
          const updatedFields: Partial<CaseTask> = fromServer
            ? (fromServer as Partial<CaseTask>)
            : optimisticSubtask;

          if (!this.task) return;
          this.task = {
            ...this.task,
            subtasks: (this.task.subtasks ?? []).map((s) =>
              s.id === st.id ? { ...s, ...updatedFields } : s,
            ),
          };
          this.state.upsert(this.task);
          this.toast.success(
            newStatus === TaskStatus.COMPLETED
              ? 'Subtask completed'
              : 'Subtask reopened',
          );
        },
        error: (err) => {
          console.error('Failed to toggle subtask', err);
          // Revert to the pre-click state.
          this.task = previous;
          this.state.upsert(previous);
          this.toast.error('Failed to update subtask');
        },
      });
  }

  deleteSubtask(st: CaseTask, ev: Event): void {
    ev.stopPropagation();
    if (!st?.id) return;

    Swal.fire({
      icon: 'warning',
      title: 'Delete subtask?',
      text: `"${st.title}" will be permanently deleted.`,
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Keep',
      confirmButtonColor: '#f24149',
      reverseButtons: true,
      // Stack above the drawer; suppress body padding shift.
      heightAuto: false,
      scrollbarPadding: false,
      customClass: { container: 'swal-above-modal' },
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.taskService
        .deleteTask(st.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            if (!this.task) return;
            this.task = {
              ...this.task,
              subtasks: (this.task.subtasks ?? []).filter((s) => s.id !== st.id),
            };
            this.state.upsert(this.task);
            this.toast.success('Subtask deleted');
          },
          error: (err) => {
            console.error('Failed to delete subtask', err);
            this.toast.error('Failed to delete subtask');
          },
        });
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Assignee picker
  // ───────────────────────────────────────────────────────────────────────

  toggleAssigneeMenu(ev: Event): void {
    ev.stopPropagation();
    this.assigneeMenuOpen = !this.assigneeMenuOpen;
    if (this.assigneeMenuOpen) {
      this.statusMenuOpen = false;
      this.ensureUsersLoaded();
    }
  }

  /** Used by the `?focus=assignee` route param entrypoint. */
  private openAssigneeMenuFromRoute(): void {
    this.assigneeMenuOpen = true;
    this.statusMenuOpen = false;
    this.dueDateMenuOpen = false;
    this.ensureUsersLoaded();
  }

  // ───────────────────────────────────────────────────────────────────────
  // Due-date picker (Phase E — "Set due date" from row menu)
  // ───────────────────────────────────────────────────────────────────────

  toggleDueDateMenu(ev?: Event): void {
    ev?.stopPropagation();
    if (this.dueDateMenuOpen) {
      this.dueDateMenuOpen = false;
      return;
    }
    // Seed the input from the current dueDate (YYYY-MM-DD only).
    this.dueDateInput = this.task?.dueDate
      ? new Date(this.task.dueDate as any).toISOString().slice(0, 10)
      : '';
    this.dueDateMenuOpen = true;
    this.assigneeMenuOpen = false;
    this.statusMenuOpen = false;
  }

  /** Used by the `?focus=due` route param entrypoint. */
  private openDueDatePickerFromRoute(): void {
    this.dueDateInput = this.task?.dueDate
      ? new Date(this.task.dueDate as any).toISOString().slice(0, 10)
      : '';
    this.dueDateMenuOpen = true;
    this.assigneeMenuOpen = false;
    this.statusMenuOpen = false;
  }

  cancelDueDateMenu(ev?: Event): void {
    ev?.stopPropagation();
    this.dueDateMenuOpen = false;
  }

  /** Persist the chosen YYYY-MM-DD as an end-of-day local timestamp. */
  submitDueDate(ev?: Event): void {
    ev?.stopPropagation();
    if (!this.task?.id) return;

    const ymd = (this.dueDateInput || '').trim();
    if (!ymd) {
      // Empty submit = clear the due date.
      this.clearDueDate();
      return;
    }

    // Send a LocalDateTime-shaped string with NO timezone suffix.
    // `new Date(...).toISOString()` returns UTC ('...Z'), which Spring's
    // LocalDateTime parser would treat as local — for users east of UTC
    // this rolls the date forward by a day. Constructing the ISO string
    // by hand avoids the conversion entirely.
    const [y, m, d] = ymd.split('-').map((p) => parseInt(p, 10));
    if (!y || !m || !d) {
      console.warn('Invalid due-date input:', ymd);
      return;
    }
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const localIso = `${y}-${pad2(m)}-${pad2(d)}T23:59:00`;
    const local = new Date(y, m - 1, d, 23, 59, 0, 0);

    const id = this.task.id;
    const payload: TaskUpdateRequest = { dueDate: localIso as any };

    this.dueDateSubmitting = true;
    this.taskService
      .updateTask(id, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Backend wraps as { data: { task: CaseTaskDTO } } — unwrap defensively.
          const fromServer = (response?.data as any)?.task ?? response?.data;
          const updated: CaseTask = fromServer
            ? (fromServer as CaseTask)
            : ({ ...(this.task as CaseTask), dueDate: local } as CaseTask);
          this.task = updated;
          this.state.upsert(updated);
          this.dueDateSubmitting = false;
          this.dueDateMenuOpen = false;
          this.toast.success('Due date updated');
        },
        error: (err) => {
          console.error('Failed to set due date', err);
          this.dueDateSubmitting = false;
          this.toast.error('Failed to update due date');
        },
      });
  }

  /**
   * Clear the dueDate. Sends the explicit `clearDueDate: true` flag because
   * the backend's `updateTask` ignores plain `dueDate: null` (treats it as
   * "field omitted"). Forces `task.dueDate = undefined` locally regardless
   * of response shape so the trigger flips to "Set due date" immediately.
   */
  clearDueDate(ev?: Event): void {
    ev?.stopPropagation();
    if (!this.task?.id) return;
    const id = this.task.id;
    const payload: TaskUpdateRequest = { clearDueDate: true };

    this.dueDateSubmitting = true;
    this.taskService
      .updateTask(id, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Backend wraps as { data: { task: CaseTaskDTO } } — unwrap defensively.
          // Force dueDate = undefined locally regardless of server shape so
          // the UI updates even if the response somehow round-trips an old
          // value (defensive belt-and-suspenders).
          const fromServer = (response?.data as any)?.task ?? response?.data;
          const base: CaseTask = fromServer
            ? (fromServer as CaseTask)
            : ({ ...(this.task as CaseTask) } as CaseTask);
          const updated: CaseTask = { ...base, dueDate: undefined };
          this.task = updated;
          this.state.upsert(updated);
          this.dueDateInput = '';
          this.dueDateSubmitting = false;
          this.dueDateMenuOpen = false;
          this.toast.success('Due date cleared');
        },
        error: (err) => {
          console.error('Failed to clear due date', err);
          this.dueDateSubmitting = false;
          this.toast.error('Failed to clear due date');
        },
      });
  }

  private ensureUsersLoaded(): void {
    if (this.usersLoaded) return;
    this.userService
      .getAttorneys()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          this.users = users ?? [];
          this.usersLoaded = true;
        },
        error: (err) => {
          console.error('Failed to load attorneys', err);
          this.users = [];
        },
      });
  }

  get filteredUsers(): User[] {
    const q = this.assigneeSearchQuery.trim().toLowerCase();
    if (!q) return this.users;
    return this.users.filter((u) => {
      const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.toLowerCase();
      return name.includes(q) || (u.email ?? '').toLowerCase().includes(q);
    });
  }

  /** True when user u is currently in this task's assignee set. */
  isAssigned(u: User): boolean {
    const list = this.task?.assignees ?? [];
    return list.some((a) => a.id === u.id);
  }

  /**
   * Toggle a user in/out of the multi-assignee set and persist via the
   * V78 PUT /tasks/{id}/assignees endpoint. The dropdown stays open so
   * the user can pick multiple in one session.
   */
  toggleAssignee(u: User, ev: Event): void {
    ev.stopPropagation();
    if (!this.task?.id || u?.id == null) return;

    const current = this.task.assignees ?? [];
    const exists = current.some((a) => a.id === u.id);
    const nextList = exists
      ? current.filter((a) => a.id !== u.id)
      : [...current, { id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email }];

    const userIds = nextList.map((a) => a.id);
    const id = this.task.id;
    this.taskService
      .replaceAssignees(id, userIds)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const fromServer = (response?.data as any)?.task ?? response?.data as any;
          const updated: CaseTask = fromServer
            ? fromServer
            : ({
                ...(this.task as CaseTask),
                assignees: nextList,
                assignedToId: nextList[0]?.id,
                assignedToName: nextList[0]
                  ? `${nextList[0].firstName ?? ''} ${nextList[0].lastName ?? ''}`.trim()
                  : undefined,
              } as CaseTask);
          this.task = updated;
          this.state.upsert(updated);
          // Personalize the toast: "added X" / "removed X" so the user
          // sees exactly what their click did.
          const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'attorney';
          this.toast.success(exists ? `Removed ${name}` : `Added ${name}`);
        },
        error: (err) => {
          console.error('Failed to update assignees', err);
          this.toast.error('Failed to update assignees');
        },
      });
  }

  /**
   * Legacy single-assign entry point (kept for the row 3-dot "Reassign…"
   * action which routes through `?focus=assignee`). Sets the new full set
   * to JUST this user — replacing any previous assignees.
   */
  reassignTo(u: User, ev: Event): void {
    ev.stopPropagation();
    this.assigneeMenuOpen = false;
    if (!this.task?.id || u?.id == null) return;

    const id = this.task.id;
    this.taskService
      .replaceAssignees(id, [u.id])
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const fromServer = (response?.data as any)?.task ?? response?.data as any;
          const fullName = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
          const updated: CaseTask = fromServer
            ? fromServer
            : ({
                ...(this.task as CaseTask),
                assignedToId: u.id,
                assignedToName: fullName,
                assignees: [{ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email }],
              } as CaseTask);
          this.task = updated;
          this.state.upsert(updated);
          this.toast.success(`Reassigned to ${fullName || 'attorney'}`);
        },
        error: (err) => {
          console.error('Failed to reassign task', err);
          this.toast.error('Failed to reassign task');
        },
      });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Document-click — close menus when clicking outside
  // ───────────────────────────────────────────────────────────────────────

  @HostListener('document:click')
  closeAllMenus(): void {
    this.statusMenuOpen = false;
    this.assigneeMenuOpen = false;
    this.dueDateMenuOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.assigneeMenuOpen) { this.assigneeMenuOpen = false; return; }
    if (this.statusMenuOpen) { this.statusMenuOpen = false; return; }
    if (this.dueDateMenuOpen) { this.dueDateMenuOpen = false; return; }
    if (this.blockerPromptOpen) { this.cancelBlockerPrompt(); return; }
    if (this.task) this.close();
  }

  // Stop propagation inside menu panels so the document listener doesn't
  // close them as soon as a user clicks the search input or an option.
  swallow(ev: Event): void {
    ev.stopPropagation();
  }

  // ───────────────────────────────────────────────────────────────────────
  // Small helpers
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Stable color per assignee. Matches TaskViewComponent.avatarColor exactly
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

  /** Per-case dot color (matches task-view). */
  caseDotColor(): string {
    if (!this.task) return TaskDrawerComponent.CASE_DOT_PALETTE[0];
    const palette = TaskDrawerComponent.CASE_DOT_PALETTE;
    const seed =
      this.task.caseId != null
        ? String(this.task.caseId)
        : (this.task.caseTitle || this.task.caseNumber || '');
    if (!seed) return palette[0];
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
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

  /** Convert a Date or ISO string to "YYYY-MM-DD" for <input type="date">. */
  private toDateInputValue(d: string | Date): string {
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
