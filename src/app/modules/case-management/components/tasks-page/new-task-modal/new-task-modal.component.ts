import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import { CaseTaskService } from '@app/service/case-task.service';
import { UserService } from '@app/service/user.service';
import { LegalCaseService } from '@app/modules/legal/services/legal-case.service';
import { ToastService } from '@app/services/toast.service';
import {
  CaseTask,
  TaskCreateRequest,
  TaskPriority,
  TaskType,
} from '@app/interface/case-task';
import { User } from '@app/interface/user';
import { BillingType } from '@app/modules/legal/interfaces/case.interface';
import { TasksStateService } from '../tasks-state.service';

/**
 * "+ New task" modal — opens when `?new=task` is in the URL, closes when
 * that param is removed. Submits to `CaseTaskService.createTask` and emits
 * the new task through `TasksStateService.insert()` so the inbox view can
 * prepend it without a full refetch.
 */
@Component({
  selector: 'app-new-task-modal',
  templateUrl: './new-task-modal.component.html',
  styleUrls: ['./new-task-modal.component.scss'],
})
export class NewTaskModalComponent implements OnInit, OnDestroy {
  open = false;
  submitting = false;

  // ── Form state ───────────────────────────────────────────────
  title = '';
  caseId: number | null = null;
  priority: TaskPriority = TaskPriority.MEDIUM;
  taskType: TaskType = TaskType.OTHER; // backend requires @NotNull TaskType
  dueDate: string = '';                // YYYY-MM-DD from <input type="date">
  assignedToId: number | null = null;
  // V78 — multi-assignee. The "+New task" form lets the attorney pick N
  // collaborators up front. The first id in this set becomes the primary
  // (mirrored into assignedToId for legacy callers).
  assigneeIds: number[] = [];
  description = '';
  // Phase J — Estimated hours visible only when picked case isn't on a
  // contingency billing arrangement. Stored as string so the input can
  // accept partial entries; converted to number on submit.
  estimatedHours: string = '';

  // Searchable dropdown state (replaces native <select>s for Case + Assignee).
  caseMenuOpen = false;
  caseSearchQuery = '';
  assigneeMenuOpen = false;
  assigneeSearchQuery = '';

  // Inline error banner — shown after a recoverable submit failure.
  submitError: string | null = null;

  // ── Option lists ─────────────────────────────────────────────
  // Carry billingType on the case option so the form can decide whether
  // to show the Estimated Hours field without a second fetch.
  cases: Array<{
    id: number;
    title?: string;
    caseNumber?: string;
    billingType?: BillingType | string;
  }> = [];
  users: User[] = [];

  readonly priorityOptions: TaskPriority[] = [
    TaskPriority.LOW,
    TaskPriority.MEDIUM,
    TaskPriority.HIGH,
    TaskPriority.URGENT,
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private taskService: CaseTaskService,
    private userService: UserService,
    private legalCaseService: LegalCaseService,
    private state: TasksStateService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    // Subscribe to state.newTaskOpen$ instead of route.queryParamMap so the
    // modal renders sync on open (no router roundtrip = no preloader).
    // tasks-page bridges URL → state on cold deep-link + back/forward nav.
    this.state.newTaskOpen$
      .pipe(takeUntil(this.destroy$))
      .subscribe((open) => {
        const wasOpen = this.open;
        this.open = open;
        if (this.open && !wasOpen) {
          this.resetForm();
          this.loadOptions();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---------------------------------------------------------------------------
  // Option loading — cases + users
  // ---------------------------------------------------------------------------

  private loadOptions(): void {
    // Cases — pull a generous page so the dropdown isn't capped at 10.
    this.legalCaseService
      .getAllCases(0, 200)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          const data: any = response?.data;
          if (data?.cases?.content && Array.isArray(data.cases.content)) {
            this.cases = data.cases.content;
          } else if (data?.content && Array.isArray(data.content)) {
            this.cases = data.content;
          } else if (Array.isArray(data?.cases)) {
            this.cases = data.cases;
          } else if (Array.isArray(data)) {
            this.cases = data;
          } else {
            this.cases = [];
          }
        },
        error: () => {
          this.cases = [];
        },
      });

    // Users — same source the drawer's assignee picker uses.
    this.userService
      .getAttorneys()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          this.users = users ?? [];
        },
        error: () => {
          this.users = [];
        },
      });
  }

  // ---------------------------------------------------------------------------
  // Form helpers
  // ---------------------------------------------------------------------------

  resetForm(): void {
    this.title = '';
    this.caseId = null;
    this.priority = TaskPriority.MEDIUM;
    this.taskType = TaskType.OTHER;
    this.dueDate = '';
    // Pre-fill the current user as the default assignee. Most attorneys
    // create tasks for themselves; this saves the open-dropdown / search /
    // click ceremony for the common case. If they want to delegate, they
    // can swap the assignee in the dropdown like normal.
    // UserService is the authoritative source — AuthService isn't actually
    // populated on this app's login flow.
    const me = this.userService.getCurrentUserId();
    this.assignedToId = me ?? null;
    this.assigneeIds = me != null ? [me] : [];
    this.description = '';
    this.estimatedHours = '';
    this.submitError = null;
    this.caseMenuOpen = false;
    this.assigneeMenuOpen = false;
    this.caseSearchQuery = '';
    this.assigneeSearchQuery = '';
  }

  /**
   * True when the Estimated Hours input should be rendered.
   * Mirrors the drawer's `showHoursCell()` logic: hide for CONTINGENCY
   * and PRO_BONO; show for HOURLY/FLAT_FEE/unknown. When no case is
   * picked yet, hide — the user hasn't given us enough info.
   */
  showEstimatedHoursField(): boolean {
    if (this.caseId == null) return false;
    const picked = this.cases.find((c) => c.id === this.caseId);
    const t = picked?.billingType;
    if (t === BillingType.CONTINGENCY || t === 'CONTINGENCY') return false;
    if (t === BillingType.PRO_BONO || t === 'PRO_BONO') return false;
    return true;
  }

  /**
   * Clear estimatedHours when the picked case switches to one where the
   * field would be hidden, so we don't silently submit a stale value.
   */
  onCaseChanged(): void {
    if (!this.showEstimatedHoursField()) {
      this.estimatedHours = '';
    }
  }

  isValid(): boolean {
    return this.title.trim().length > 0 && this.caseId != null;
  }

  // ── Searchable dropdown helpers ────────────────────────────────

  toggleCaseMenu(ev?: Event): void {
    ev?.stopPropagation();
    this.caseMenuOpen = !this.caseMenuOpen;
    if (this.caseMenuOpen) {
      this.assigneeMenuOpen = false;
      this.caseSearchQuery = '';
    }
  }

  toggleAssigneeMenu(ev?: Event): void {
    ev?.stopPropagation();
    this.assigneeMenuOpen = !this.assigneeMenuOpen;
    if (this.assigneeMenuOpen) {
      this.caseMenuOpen = false;
      this.assigneeSearchQuery = '';
    }
  }

  filteredCases(): Array<{ id: number; title?: string; caseNumber?: string; billingType?: BillingType | string }> {
    const q = this.caseSearchQuery.trim().toLowerCase();
    if (!q) return this.cases;
    return this.cases.filter((c) => {
      const label = `${c.title ?? ''} ${c.caseNumber ?? ''}`.toLowerCase();
      return label.includes(q);
    });
  }

  filteredAssignees(): User[] {
    const q = this.assigneeSearchQuery.trim().toLowerCase();
    if (!q) return this.users;
    return this.users.filter((u) => {
      const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.toLowerCase();
      return name.includes(q) || (u.email ?? '').toLowerCase().includes(q);
    });
  }

  selectCase(c: { id: number; title?: string; caseNumber?: string }, ev: Event): void {
    ev.stopPropagation();
    this.caseId = c.id;
    this.caseMenuOpen = false;
    this.onCaseChanged();
  }

  /**
   * V78 — multi-select toggle. Click an attorney → add/remove them from the
   * pending assignee set. The dropdown stays open so the user can pick N
   * collaborators in one session. The first id is treated as primary.
   */
  toggleAssigneeId(u: User | null, ev: Event): void {
    ev.stopPropagation();
    if (!u || u.id == null) {
      // "Unassigned" row — clear everything
      this.assigneeIds = [];
      this.assignedToId = null;
      return;
    }
    const idx = this.assigneeIds.indexOf(u.id);
    if (idx >= 0) {
      this.assigneeIds = this.assigneeIds.filter((id) => id !== u.id);
    } else {
      this.assigneeIds = [...this.assigneeIds, u.id];
    }
    // Keep legacy primary pointer in sync — first picked = primary.
    this.assignedToId = this.assigneeIds[0] ?? null;
  }

  isAssigneePicked(u: User): boolean {
    return u?.id != null && this.assigneeIds.includes(u.id);
  }

  pickedCaseLabel(): string {
    const c = this.cases.find((x) => x.id === this.caseId);
    return c ? (c.title || c.caseNumber || `#${c.id}`) : '';
  }

  pickedAssigneeLabel(): string {
    if (this.assigneeIds.length === 0) return 'Unassigned';
    if (this.assigneeIds.length === 1) {
      const u = this.users.find((x) => x.id === this.assigneeIds[0]);
      return u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : 'Unassigned';
    }
    return `${this.assigneeIds.length} attorneys`;
  }

  pickedAssignees(): User[] {
    // Preserve the picking order (first = primary).
    return this.assigneeIds
      .map((id) => this.users.find((u) => u.id === id))
      .filter((u): u is User => !!u);
  }

  // ── Outside-click + ESC handlers ───────────────────────────────

  @HostListener('document:click')
  closeAllMenus(): void {
    this.caseMenuOpen = false;
    this.assigneeMenuOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.caseMenuOpen) { this.caseMenuOpen = false; return; }
    if (this.assigneeMenuOpen) { this.assigneeMenuOpen = false; return; }
    if (this.open) this.close();
  }

  close(): void {
    // Clear state sync so the modal vanishes immediately.
    this.state.setNewTaskOpen(false);

    // Update URL via History API to drop ?new=task without firing
    // Angular Router NavigationStart (which would trigger the global
    // preloader).
    const queryParams = { ...this.route.snapshot.queryParams };
    delete queryParams['new'];
    const tree = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams,
    });
    this.location.replaceState(this.router.serializeUrl(tree));
  }

  save(): void {
    if (!this.isValid() || this.submitting) return;
    this.submitting = true;
    this.submitError = null;

    // Parse estimatedHours only when the field is visible — otherwise the
    // user can't have set it for this submission, so we drop it entirely.
    let estimatedHoursPayload: number | undefined;
    if (this.showEstimatedHoursField() && this.estimatedHours.trim() !== '') {
      const parsed = Number(this.estimatedHours);
      if (Number.isFinite(parsed) && parsed >= 0) {
        estimatedHoursPayload = parsed;
      }
    }

    const payload: TaskCreateRequest = {
      caseId: this.caseId as number,
      title: this.title.trim(),
      taskType: this.taskType,
      priority: this.priority,
      ...(this.dueDate ? { dueDate: new Date(this.dueDate) } : {}),
      ...(this.assignedToId != null ? { assignedToId: this.assignedToId } : {}),
      ...(this.description.trim() ? { description: this.description.trim() } : {}),
      ...(estimatedHoursPayload != null ? { estimatedHours: estimatedHoursPayload } : {}),
    };

    this.taskService
      .createTask(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          const newTask: CaseTask | null =
            response?.data?.task ?? response?.task ?? response?.data ?? null;
          // V78 — if the user picked >1 assignees, send a follow-up PUT
          // to replace the assignee set. The legacy createTask contract
          // only carries a single assignedToId; this expands it.
          const wantsMulti =
            newTask?.id != null &&
            this.assigneeIds.length > 1;

          const finishCleanup = (finalTask: CaseTask | null) => {
            if (finalTask?.id != null) this.state.insert(finalTask);
            this.submitting = false;
            this.close();
            this.toast.success(
              finalTask?.title ? `Created "${finalTask.title}"` : 'Task created',
            );
          };

          if (wantsMulti && newTask) {
            this.taskService
              .replaceAssignees(newTask.id, this.assigneeIds)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (r2: any) => {
                  const updated = r2?.data?.task ?? r2?.task ?? r2?.data ?? newTask;
                  finishCleanup(updated);
                },
                error: (err: any) => {
                  // Task was created but assignee expansion failed — still
                  // close the modal so the row appears; user can fix from
                  // the drawer's assignee picker.
                  console.error('Task created but multi-assignee update failed', err);
                  finishCleanup(newTask);
                },
              });
          } else {
            finishCleanup(newTask);
          }
        },
        error: (err: any) => {
          this.submitting = false;
          this.submitError = err?.error?.message || err?.message || 'Failed to create task. Please try again.';
          console.error('Failed to create task', err);
          this.toast.error(this.submitError);
        },
      });
  }
}
