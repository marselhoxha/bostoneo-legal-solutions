# Tasks Page Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the `/tasks` list-view row, drawer modal, and `+ New task` modal to match the approved D2 + V1 previews exactly, plus wiring audit so every interaction works end-to-end.

**Architecture:** Frontend-only rewrite. Backend is unchanged (Phases A–B already shipped `BillingType` + V77 + DTO projections). All changes live in `src/app/modules/case-management/components/tasks-page/` and one shared SCSS partial in the drawer. The task drawer + new-task modal stay state-driven via `TasksStateService` (preloader fix preserved).

**Tech Stack:** Angular 18 templates + SCSS, Lucide icons (`lucide-angular`), SweetAlert2 (`sweetalert2`), existing CSS custom properties from `--legience-*` design tokens.

**Spec:** `docs/superpowers/specs/2026-05-06-tasks-page-rewrite-design.md`

**Commit policy:** No commit per task. The user reviews the rewrite end-to-end and runs the smoke test, then approves a single bundled commit at the end.

---

## File Structure

| File | Responsibility |
|---|---|
| `task-view.component.html` | D2 row markup (col grid: 22px 1fr auto auto). |
| `task-view.component.scss` | D2 row styles + meta strip + progress bar + dead-block cleanup. |
| `task-view.component.ts` | `subtaskProgress()`, `progressFillTone()`, `showTimeLog()`, SweetAlert delete. |
| `task-drawer.component.html` | V1 stepper + 2×2 metadata + flat comments + activity accordion. |
| `task-drawer.component.scss` | `.s1-stepper` + `.s1-step.{past,active,future}` + `.s1-offtrack` + dead-block cleanup. |
| `task-drawer.component.ts` | `stepStateOf()`, drop comments-expand methods, SweetAlert cancel, ESC handler. |
| `new-task-modal.component.html` | Searchable case + assignee dropdowns + inline error banner. |
| `new-task-modal.component.scss` | Dropdown menu styles + `.form-error`. |
| `new-task-modal.component.ts` | Dropdown state, error state, outside-click + ESC handlers. |
| `tasks.module.ts` | Add `ListChecks`; drop `Clock`, `Briefcase`, `LcUser`, `MessageCircle`, `Hourglass`, `CheckSquare`, `Square`, `Eye` if confirmed unused; drop `RelativeTimePipe`. |
| `relative-time.pipe.ts` | Delete file (no consumers). |

---

## Phase R — Row Rewrite (Section 1)

### Task R1: Add helpers to task-view.component.ts

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/views/task-view/task-view.component.ts`

- [ ] **Step 1: Add helper imports + methods**

Insert after the existing `caseDotColor()` method (find by grep: `caseDotColor`):

```ts
  /**
   * D2 row meta — subtasks counter + progress bar.
   * Returns null when the task has no subtasks (row omits the meta entry).
   */
  subtaskProgress(task: CaseTask): { done: number; total: number; pct: number } | null {
    const subs = task.subtasks ?? [];
    const total = subs.length;
    if (total === 0) return null;
    const done = subs.filter((s) => (s.status as unknown as string) === 'COMPLETED').length;
    const pct = Math.round((done / total) * 100);
    return { done, total, pct };
  }

  /**
   * Maps progress percentage to a tone class for the .progress-bar fill:
   *   0% → danger (red)   1–49% → warning (amber)
   *   50–99% → accent (blue)   100% → success (green)
   */
  progressFillTone(pct: number): 'danger' | 'warning' | 'accent' | 'success' {
    if (pct === 0) return 'danger';
    if (pct < 50) return 'warning';
    if (pct < 100) return 'accent';
    return 'success';
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
```

- [ ] **Step 2: Replace SweetAlert in deleteTask**

Find the existing `deleteTask(task: CaseTask, ev: Event)` method and replace `window.confirm` with SweetAlert. The full updated method:

```ts
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
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.taskService
        .deleteTask(task.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            // Strip from local state; recompute groups + counts.
            this.allTasks = this.allTasks.filter((t) => t.id !== task.id);
            this.state.remove(task.id);
            this.recomputeBaseStats();
            this.applyFilters();
          },
          error: (err) => {
            console.error('Failed to delete task', err);
            Swal.fire('Error', 'Failed to delete task. Please try again.', 'error');
          },
        });
    });
  }
```

- [ ] **Step 3: Add SweetAlert import to task-view.component.ts**

Find the imports block at the top of the file. Add:

```ts
import Swal from 'sweetalert2';
```

- [ ] **Step 4: Verify TasksStateService has remove()**

Run: `grep -n "remove\|removeFromCache" src/app/modules/case-management/components/tasks-page/tasks-state.service.ts`

Expected: a `remove(id: number)` method exists. If not, add to that file:

```ts
  remove(id: number): void {
    this.cache.delete(id);
    if (this.selectedIdSubject.value === id) {
      this.selectedIdSubject.next(null);
    }
  }
```

### Task R2: Rewrite the D2 row template

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/views/task-view/task-view.component.html` (lines 145–252)

- [ ] **Step 1: Replace the existing row block**

Find the comment `<!-- D2 — Two-Line Stack row.` and the entire `<div class="t-row t-row--stack" *ngFor="let task of group.tasks; trackBy: trackById">` block down to its closing `</div>`. Replace with:

```html
    <!--
      D2 row — preview match (tasks-listview-row-redesign-options.html lines 632–690).
      Grid: [checkbox] [main: title + meta] [aside: priority + avatar] [⋯]
    -->
    <div
      class="t-row d2-row"
      *ngFor="let task of group.tasks; trackBy: trackById"
      [class.selected]="task.id === selectedTaskId"
      (click)="selectTask(task)"
    >
      <div class="t-checkbox" [class.checked]="task.status === 'COMPLETED'"></div>

      <div class="d2-main">
        <div class="d2-title" [class.done]="task.status === 'COMPLETED'">
          {{ task.title }}
        </div>

        <div class="d2-meta">
          <span class="case-pill" *ngIf="task.caseTitle || task.caseNumber">
            <span class="case-dot" [style.background]="caseDotColor(task)"></span>
            {{ task.caseTitle || task.caseNumber }}
          </span>

          <ng-container *ngIf="subtaskProgress(task) as sp">
            <span class="meta-item subtask-count">
              <i-lucide name="list-checks" [size]="12"></i-lucide>
              {{ sp.done }}/{{ sp.total }} subtasks
            </span>
            <span class="progress">
              <span class="bar">
                <span class="fill" [ngClass]="progressFillTone(sp.pct)" [style.width.%]="sp.pct"></span>
              </span>
              {{ sp.pct }}%
            </span>
          </ng-container>

          <span class="meta-item time-logged" *ngIf="showTimeLog(task)">
            <i-lucide name="clock" [size]="12"></i-lucide>
            {{ task.actualHours || 0 }}h
          </span>

          <span
            class="meta-item d2-due"
            [class.overdue]="group.key === 'overdue'"
            [class.today]="group.key === 'today'"
          >
            {{ task.dueDate | dueLabel }}
          </span>
        </div>
      </div>

      <div class="d2-aside">
        <span class="pill" [ngClass]="'pill-' + (task.priority | priorityToTone)">
          <span class="dot"></span>{{ task.priority | titlecase }}
        </span>
        <div
          class="av-ringed sm"
          *ngIf="task.assignedToName as name"
          [style.--ring]="avatarColor(task.assignedToId ?? name)"
          [style.--bg]="avatarColor(task.assignedToId ?? name)"
        >
          <div class="inner"><div class="content">{{ name | userInitials }}</div></div>
        </div>
      </div>

      <div class="row-actions" (click)="swallow($event)">
        <button
          type="button"
          class="btn btn-ghost btn-icon"
          (click)="toggleRowMenu(task.id, $event)"
          aria-label="Task actions"
        >
          <i-lucide name="more-horizontal" [size]="14"></i-lucide>
        </button>
        <div class="dropdown-menu row-menu" *ngIf="openRowMenuId === task.id">
          <div class="dd-item" (click)="markComplete(task, $event)">
            <i-lucide name="check" [size]="14"></i-lucide>
            <span class="dd-label">Mark complete</span>
          </div>
          <div class="dd-item" (click)="setDueDateFromRow(task, $event)">
            <i-lucide name="calendar-plus" [size]="14"></i-lucide>
            <span class="dd-label">Set due date&hellip;</span>
          </div>
          <div class="dd-item" (click)="reassignFromRow(task, $event)">
            <i-lucide name="user-plus" [size]="14"></i-lucide>
            <span class="dd-label">Reassign&hellip;</span>
          </div>
          <div class="dd-sep"></div>
          <div class="dd-item danger" (click)="deleteTask(task, $event)">
            <i-lucide name="trash-2" [size]="14"></i-lucide>
            <span class="dd-label">Delete</span>
          </div>
        </div>
      </div>
    </div>
```

### Task R3: Replace the D2 row SCSS

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/views/task-view/task-view.component.scss`

- [ ] **Step 1: Find and remove dead D2 SCSS**

Delete these blocks entirely (find by class name, remove block + braces):
- `.t-row--stack`
- `.t-row-main`
- `.t-row-sub`
- `.t-row-sub-indent` (if any leftover)
- `.t-sub-spacer`
- `.t-sub-assignee`
- `.t-sub-name`
- `.t-sub-unassigned`
- `.t-sub-meta`
- `.av-ringed--sm`
- `.pill--status`
- The `.pill-accent` and `.pill-success` overrides added at the bottom (preserved-tone variants stay only in drawer scss).

- [ ] **Step 2: Replace the `.t-row` block with D2 grid**

Find `.t-row { display: grid; grid-template-columns: 22px 1fr auto auto auto auto auto; ...` and replace with:

```scss
.t-row {
  display: grid;
  grid-template-columns: 22px 1fr auto auto;
  align-items: start;
  gap: 16px;
  padding: 14px 28px;
  border-top: 1px solid var(--legience-border-hairline);
  cursor: pointer;
  transition: background 100ms ease;

  &:hover { background: var(--legience-bg-row-hover); }
  &.selected { background: var(--legience-accent-bg-subtle); }
}

// Re-align the checkbox to the title baseline (top of d2-main).
.t-row .t-checkbox { margin-top: 3px; }
```

- [ ] **Step 3: Add the new D2 inner blocks**

Insert after `.t-row` (before `.t-checkbox`):

```scss
.d2-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.d2-title {
  font: 500 14px/1.3 var(--legience-font-sans);
  color: var(--legience-text-primary);
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.done {
    text-decoration: line-through;
    color: var(--legience-text-muted);
  }
}

.d2-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  font: 500 11.5px/1 var(--legience-font-sans);
  color: var(--legience-text-muted);
}

.d2-meta .meta-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.d2-meta i-lucide { opacity: 0.7; }

.d2-meta .d2-due {
  font-variant-numeric: tabular-nums;

  &.overdue { color: var(--legience-danger); font-weight: 600; }
  &.today { color: var(--legience-accent); font-weight: 600; }
}

// Subtasks progress bar (60px wide; fill colored by tone).
.progress {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-variant-numeric: tabular-nums;
}

.progress .bar {
  width: 60px;
  height: 4px;
  background: var(--legience-bg-subtle);
  border-radius: 99px;
  overflow: hidden;
}

.progress .bar .fill {
  height: 100%;
  border-radius: 99px;
  transition: width 200ms ease;
  background: var(--legience-accent);

  &.danger  { background: var(--legience-danger); }
  &.warning { background: var(--legience-warning); }
  &.accent  { background: var(--legience-accent); }
  &.success { background: var(--legience-success); }
}

// Right-side aside: priority pill stacked above avatar.
.d2-aside {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.row-actions {
  position: relative;
  display: inline-flex;
  align-self: center;
}
```

- [ ] **Step 4: Verify `.av-ringed.sm` exists for the smaller avatar**

Run: `grep -n "av-ringed.sm\|av-ringed sm" src/app/modules/case-management/components/tasks-page/views/task-view/task-view.component.scss`

If `&.sm` block is missing under `.av-ringed`, add inside the existing `.av-ringed { ... }`:

```scss
  &.sm {
    width: 22px;
    height: 22px;
    padding: 1px;
    .inner { padding: 1px; }
    .inner .content { font-size: 8.5px; }
  }
```

### Task R4: Register `list-checks` icon

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/tasks.module.ts`

- [ ] **Step 1: Update the lucide-angular import + pick**

Find the `lucide-angular` import and add `ListChecks`. Find the `LucideAngularModule.pick({ ... })` and add `ListChecks` to the registered icons:

```ts
import {
  LucideAngularModule,
  Search, Filter, Plus, MoreHorizontal, Check, Pencil, Trash2,
  UserPlus, X, ChevronDown, ChevronUp, Play, LayoutList, AlertCircle, Calendar,
  CalendarPlus, Clock, MessageCircle, Activity, ListChecks,
  User as LcUser,
} from 'lucide-angular';
```

```ts
    LucideAngularModule.pick({
      Search, Filter, Plus, MoreHorizontal, Check, Pencil, Trash2,
      UserPlus, X, ChevronDown, ChevronUp, Play, LayoutList, AlertCircle, Calendar,
      CalendarPlus, Clock, MessageCircle, Activity, ListChecks,
      User: LcUser,
    }),
```

(Drop `Briefcase`, `Hourglass`, `CheckSquare`, `Square`, `Eye` from both lists — they were registered by the previous incorrect impl and are unused.)

### Task R5: Delete RelativeTimePipe (cleanup)

**Files:**
- Delete: `src/app/shared/pipes/relative-time.pipe.ts`
- Modify: `src/app/modules/case-management/components/tasks-page/tasks.module.ts`

- [ ] **Step 1: Verify no consumers**

Run: `grep -rn "RelativeTimePipe\|relativeTime" src/app --include="*.ts" --include="*.html" | grep -v "relative-time.pipe.ts"`

Expected: only references are in `tasks.module.ts` (declarations + exports) and the deleted row template (which we already replaced). If any other file references it, STOP and report — don't delete.

- [ ] **Step 2: Delete the pipe file**

```bash
rm /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1/src/app/shared/pipes/relative-time.pipe.ts
```

- [ ] **Step 3: Drop pipe registration in tasks.module.ts**

Remove the line `import { RelativeTimePipe } from '@app/shared/pipes/relative-time.pipe';` and the `RelativeTimePipe` entry in both `declarations` and `exports`.

---

## Phase M — Modal (Drawer) Rewrite (Section 2)

### Task M1: Add stepStateOf helper + drop comments-expand methods + SweetAlert cancel

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.ts`

- [ ] **Step 1: Add SweetAlert import**

At the top of the file, add:

```ts
import Swal from 'sweetalert2';
```

- [ ] **Step 2: Add stepStateOf helper**

Insert after the `humanizeStatus()` method:

```ts
  /**
   * V1 stepper per-step rendering state.
   *  - 'past'   → rendered with success-bg + ✓
   *  - 'active' → rendered with accent-bg + accent border ring
   *  - 'future' → rendered muted with empty circle
   *
   * BLOCKED and CANCELLED are off-track. When the current status is one of
   * those, ALL stepper pills render as 'future' (no active pill on the bar);
   * the off-track link row below carries the active state instead.
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
```

- [ ] **Step 3: Drop comments-expand state + methods**

Delete the following from the class:
- `newComment = '';` — KEEP (still needed for composer)
- `commentSubmitting = false;` — KEEP
- `commentsExpanded = false;` — REMOVE
- `static readonly COMMENT_PREVIEW_COUNT = 3;` — REMOVE
- The `visibleComments()` method — REMOVE
- The `hiddenCommentCount()` method — REMOVE
- The `toggleCommentsExpanded(ev)` method — REMOVE
- The auto-expand block inside `submitComment` (`if (this.hiddenCommentCount() > 0) this.commentsExpanded = true;`) — REMOVE that line only.

- [ ] **Step 4: Replace SweetAlert in cancelTaskLink**

Find the existing `cancelTaskLink(ev: Event)` method and replace `window.confirm` with SweetAlert:

```ts
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
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.changeStatus(TaskStatus.CANCELLED, ev);
    });
  }
```

- [ ] **Step 5: Add ESC key handler**

Add a new method on the class (next to existing `@HostListener('document:click')`):

```ts
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.assigneeMenuOpen) { this.assigneeMenuOpen = false; return; }
    if (this.statusMenuOpen) { this.statusMenuOpen = false; return; }
    if (this.dueDateMenuOpen) { this.dueDateMenuOpen = false; return; }
    if (this.blockerPromptOpen) { this.cancelBlockerPrompt(); return; }
    this.close();
  }
```

### Task M2: Replace stepper template + drop comments-expand markup

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.html`

- [ ] **Step 1: Replace the V1 stepper block**

Find the comment `<!-- Phase F — V1 Segmented Pills stepper` and the entire `<div class="status-stepper-block">` block down to its closing `</div>`. Replace with:

```html
    <!--
      V1 Segmented Pills stepper — preview match (s1-stepper).
      stepStateOf() returns 'past'/'active'/'future' per pill; off-track
      transitions (BLOCKED, CANCELLED) live in the link row below.
    -->
    <div class="s1-wrap">
      <div class="s1-stepper" role="tablist" aria-label="Task status">
        <button
          type="button"
          class="s1-step"
          *ngFor="let s of stepperStatuses"
          [ngClass]="stepStateOf(task.status, s)"
          [attr.aria-pressed]="stepStateOf(task.status, s) === 'active'"
          (click)="changeStatus(s, $event)"
        >
          <span class="step-tick">
            <ng-container *ngIf="stepStateOf(task.status, s) === 'past'">&#10003;</ng-container>
          </span>
          {{ humanizeStatus(s) }}
        </button>
      </div>

      <div class="s1-offtrack">
        <button
          type="button"
          class="link-btn link-blocked"
          (click)="markBlockedLink($event)"
          [class.is-active]="task.status === 'BLOCKED'"
        >
          <i-lucide name="alert-circle" [size]="13"></i-lucide>
          <ng-container *ngIf="task.status === 'BLOCKED'; else markBlockedLabel">Blocked</ng-container>
          <ng-template #markBlockedLabel>Mark blocked</ng-template>
        </button>
        <button
          type="button"
          class="link-btn link-cancel"
          (click)="cancelTaskLink($event)"
          [disabled]="task.status === 'CANCELLED'"
        >
          <ng-container *ngIf="task.status === 'CANCELLED'; else cancelLabel">Cancelled</ng-container>
          <ng-template #cancelLabel>Cancel</ng-template>
        </button>
      </div>
    </div>
```

- [ ] **Step 2: Refactor comments to flat render (drop the show-all/show-less buttons)**

Find the comments `drawer-section` block (`<!-- Comments — Phase H2.`). Replace the existing `*ngFor="let c of visibleComments()"` and the two `comments-expand` buttons with a single flat render:

```html
  <div class="drawer-section">
    <div class="sec-head">
      <span class="title">
        <i-lucide name="message-circle" [size]="13"></i-lucide>
        Comments
        <ng-container *ngIf="task.comments?.length">
          &middot; {{ task.comments?.length }}
        </ng-container>
      </span>
    </div>

    <div class="comment-empty" *ngIf="!task.comments?.length">No comments yet.</div>

    <div class="comment" *ngFor="let c of task.comments">
      <div
        class="av-ringed"
        [style.--ring]="avatarColor(c.userId ?? c.userName)"
        [style.--bg]="avatarColor(c.userId ?? c.userName)"
      >
        <div class="inner"><div class="content">{{ c.userName | userInitials }}</div></div>
      </div>
      <div>
        <div class="meta">
          <strong>{{ c.userName }}</strong> &middot; {{ c.createdAt | date:'short' }}
        </div>
        <div class="body">{{ c.comment }}</div>
      </div>
    </div>

    <div class="comment-add">
      <textarea
        class="comment-input"
        [(ngModel)]="newComment"
        placeholder="Add a comment&hellip;"
        rows="2"
        [disabled]="commentSubmitting"
      ></textarea>
      <div class="comment-add-actions">
        <button
          type="button"
          class="btn btn-primary btn-sm"
          (click)="submitComment($event)"
          [disabled]="!newComment.trim() || commentSubmitting"
        >
          {{ commentSubmitting ? 'Posting…' : 'Submit' }}
        </button>
      </div>
    </div>
  </div>
```

(Note `c.createdAt | date:'short'` instead of `relativeTime` — the pipe is being deleted.)

### Task M3: Replace stepper SCSS + cleanup

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.scss`

- [ ] **Step 1: Find and remove dead stepper SCSS**

Delete these blocks entirely:
- `.status-stepper-block`
- `.status-stepper`
- `.stepper-pill`
- `.pill-muted`
- `.cancel-menu-wrap`
- `.stepper-overflow`
- `.dropdown-menu.cancel-menu`
- `.av-ringed--sm`
- `.comments-expand`

- [ ] **Step 2: Add the new s1-stepper SCSS**

Insert in place of the deleted blocks:

```scss
// ── V1 Segmented Pills stepper (preview match: s1-wrap, s1-stepper) ─────
.s1-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.s1-stepper {
  display: flex;
  gap: 4px;
  background: var(--legience-bg-elevated);
  border: 1px solid var(--legience-border-hairline);
  border-radius: var(--legience-radius-buttons);
  padding: 3px;
  width: fit-content;
}

.s1-step {
  flex: 1;
  padding: 7px 10px;
  border-radius: var(--legience-radius);
  font: 500 12px/1 var(--legience-font-sans);
  text-align: center;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  white-space: nowrap;
  color: inherit;
  transition: all 100ms ease;
}

.s1-step .step-tick {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  line-height: 1;
}

.s1-step.past {
  color: var(--legience-success);
  background: rgba(var(--legience-success-rgb), 0.10);
}
.s1-step.past .step-tick {
  background: var(--legience-success);
  color: #fff;
}

.s1-step.active {
  color: var(--legience-accent);
  font-weight: 600;
  background: var(--legience-accent-bg-subtle);
  border: 1px solid rgba(var(--legience-accent-rgb), 0.30);
  padding: 6px 9px; // compensate for the border so heights match
}
.s1-step.active .step-tick {
  background: var(--legience-accent);
  color: #fff;
}

.s1-step.future {
  color: var(--legience-text-muted);
}
.s1-step.future .step-tick {
  border: 1.5px solid var(--legience-border-emphasis);
  background: transparent;
}

.s1-step:hover:not(.active) {
  background: var(--legience-bg-row-hover);
}

// Off-track transitions row (BLOCKED + Cancel).
.s1-offtrack {
  display: flex;
  align-items: center;
  gap: 14px;
  font: 500 11.5px/1 var(--legience-font-sans);
}

.link-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  background: transparent;
  border: none;
  font: inherit;
  cursor: pointer;
  color: var(--legience-text-muted);
  transition: color 100ms ease;

  &:hover:not(:disabled) { color: var(--legience-text-primary); text-decoration: underline; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }

  &.link-blocked {
    color: var(--legience-danger);
    &:hover:not(:disabled) { color: var(--legience-danger); }
    &.is-active { font-weight: 600; }
  }
}
```

---

## Phase N — New Task Modal (Section 3)

### Task N1: Add searchable dropdown state + methods

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/new-task-modal/new-task-modal.component.ts`

- [ ] **Step 1: Add state fields**

Find the existing `// ── Form state ───────────────────────────────────────────────` block and add after `description = '';` and `estimatedHours: string = '';`:

```ts
  // Searchable dropdown state (replaces native <select>s for Case + Assignee).
  caseMenuOpen = false;
  caseSearchQuery = '';
  assigneeMenuOpen = false;
  assigneeSearchQuery = '';

  // Inline error banner (recoverable transient error after submit failure).
  submitError: string | null = null;
```

- [ ] **Step 2: Add HostListener import**

Find the `@angular/core` import line and add `HostListener`:

```ts
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
```

- [ ] **Step 3: Add dropdown helper methods**

Insert after the existing `onCaseChanged()` method:

```ts
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

  filteredCases(): Array<{ id: number; title?: string; caseNumber?: string; billingType?: any }> {
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

  selectAssignee(u: User | null, ev: Event): void {
    ev.stopPropagation();
    this.assignedToId = u?.id ?? null;
    this.assigneeMenuOpen = false;
  }

  pickedCaseLabel(): string {
    const c = this.cases.find((x) => x.id === this.caseId);
    return c ? (c.title || c.caseNumber || `#${c.id}`) : '';
  }

  pickedAssigneeLabel(): string {
    const u = this.users.find((x) => x.id === this.assignedToId);
    return u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : 'Unassigned';
  }

  pickedAssignee(): User | undefined {
    return this.users.find((x) => x.id === this.assignedToId);
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
```

- [ ] **Step 4: Wire submitError into save()**

Find the existing `save()` method. Update the start to clear the error and the error branch to set it:

Replace the body of `save()` with:

```ts
  save(): void {
    if (!this.isValid() || this.submitting) return;
    this.submitting = true;
    this.submitError = null;

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
          if (newTask?.id != null) {
            this.state.insert(newTask);
          }
          this.submitting = false;
          this.close();
        },
        error: (err: any) => {
          this.submitting = false;
          const msg = err?.error?.message || err?.message || 'Failed to create task. Please try again.';
          this.submitError = msg;
          console.error('Failed to create task', err);
        },
      });
  }
```

- [ ] **Step 5: Reset submitError when modal opens**

Find `resetForm()` and add at the end:

```ts
    this.submitError = null;
    this.caseMenuOpen = false;
    this.assigneeMenuOpen = false;
    this.caseSearchQuery = '';
    this.assigneeSearchQuery = '';
```

### Task N2: Replace native selects in template

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/new-task-modal/new-task-modal.component.html`

- [ ] **Step 1: Replace Case `<select>` with searchable trigger**

Find the existing `<label class="field">` block containing the Case `<select>` and replace with:

```html
    <div class="field">
      <span class="field-label">Case <span class="required">*</span></span>
      <div class="case-wrap">
        <button
          type="button"
          class="form-input case-trigger"
          (click)="toggleCaseMenu($event)"
          [class.placeholder]="caseId == null"
        >
          <span *ngIf="caseId == null">Select a case&hellip;</span>
          <span *ngIf="caseId != null">{{ pickedCaseLabel() }}</span>
          <i-lucide name="chevron-down" [size]="12"></i-lucide>
        </button>
        <div class="dropdown-menu case-menu" *ngIf="caseMenuOpen" (click)="$event.stopPropagation()">
          <input
            type="text"
            class="dd-search"
            [(ngModel)]="caseSearchQuery"
            name="caseSearchQuery"
            [ngModelOptions]="{ standalone: true }"
            placeholder="Search cases&hellip;"
            autocomplete="off"
          />
          <div class="dd-scroll">
            <div class="dd-empty" *ngIf="filteredCases().length === 0">No matches</div>
            <button
              type="button"
              class="dd-item"
              *ngFor="let c of filteredCases()"
              [class.selected]="c.id === caseId"
              (click)="selectCase(c, $event)"
            >
              <span class="dd-label">{{ c.title || c.caseNumber }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
```

- [ ] **Step 2: Replace Assignee `<select>` with searchable trigger**

Find the existing `<label class="field">` block containing the Assignee `<select>` and replace with:

```html
      <div class="field">
        <span class="field-label">Assignee</span>
        <div class="assignee-wrap">
          <button
            type="button"
            class="form-input assignee-trigger"
            (click)="toggleAssigneeMenu($event)"
            [class.placeholder]="assignedToId == null"
          >
            <span *ngIf="assignedToId == null">Unassigned</span>
            <span *ngIf="assignedToId != null">{{ pickedAssigneeLabel() }}</span>
            <i-lucide name="chevron-down" [size]="12"></i-lucide>
          </button>
          <div class="dropdown-menu assignee-menu" *ngIf="assigneeMenuOpen" (click)="$event.stopPropagation()">
            <input
              type="text"
              class="dd-search"
              [(ngModel)]="assigneeSearchQuery"
              name="assigneeSearchQuery"
              [ngModelOptions]="{ standalone: true }"
              placeholder="Search&hellip;"
              autocomplete="off"
            />
            <div class="dd-scroll">
              <button
                type="button"
                class="dd-item"
                [class.selected]="assignedToId == null"
                (click)="selectAssignee(null, $event)"
              >
                <span class="dd-label">Unassigned</span>
              </button>
              <div class="dd-empty" *ngIf="filteredAssignees().length === 0 && assigneeSearchQuery">No matches</div>
              <button
                type="button"
                class="dd-item"
                *ngFor="let u of filteredAssignees()"
                [class.selected]="u.id === assignedToId"
                (click)="selectAssignee(u, $event)"
              >
                <span class="dd-label">{{ u.firstName }} {{ u.lastName }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
```

- [ ] **Step 3: Add inline error banner above modal-actions**

Find `<div class="modal-actions">` and insert immediately above it:

```html
    <div class="form-error" *ngIf="submitError">
      <i-lucide name="alert-circle" [size]="14"></i-lucide>
      <span>{{ submitError }}</span>
    </div>
```

### Task N3: Add SCSS for new dropdowns + error banner

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/new-task-modal/new-task-modal.component.scss`

- [ ] **Step 1: Append searchable-dropdown + error-banner styles**

Append to the bottom of the SCSS file:

```scss
// ── Searchable dropdown (Case + Assignee) ──────────────────────
.case-wrap,
.assignee-wrap {
  position: relative;
}

.case-trigger,
.assignee-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  width: 100%;
  cursor: pointer;
  text-align: left;

  &.placeholder { color: var(--legience-text-muted); }

  i-lucide { color: var(--legience-text-muted); flex-shrink: 0; }
}

.dropdown-menu.case-menu,
.dropdown-menu.assignee-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 70;
  max-height: 280px;
  padding: 6px;
  background: var(--legience-bg-elevated);
  border: 1px solid var(--legience-border-hairline);
  border-radius: 8px;
  box-shadow: 0 12px 32px -8px rgba(0, 0, 0, 0.18), 0 4px 12px -4px rgba(0, 0, 0, 0.10);
  display: flex;
  flex-direction: column;
}

.dd-search {
  width: 100%;
  padding: 6px 8px;
  margin-bottom: 4px;
  border-radius: 6px;
  border: 1px solid var(--legience-border-hairline);
  background: var(--legience-bg-elevated);
  color: var(--legience-text-primary);
  font: 500 13px/1.4 var(--legience-font-sans);

  &:focus {
    outline: 2px solid rgba(var(--legience-accent-rgb), 0.30);
    outline-offset: 1px;
    border-color: var(--legience-accent);
  }
}

.dd-scroll {
  flex: 1;
  overflow-y: auto;
  max-height: 220px;
}

.dd-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  color: var(--legience-text-primary);
  background: transparent;
  border: none;
  width: 100%;
  text-align: left;
  font: 500 13px/1.4 var(--legience-font-sans);

  &:hover { background: var(--legience-bg-row-hover); }

  &.selected {
    color: var(--legience-accent);
    font-weight: 600;
    background: var(--legience-accent-bg-subtle);
  }

  .dd-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.dd-empty {
  padding: 6px 10px;
  color: var(--legience-text-muted);
  font-style: italic;
  font: 500 13px/1.4 var(--legience-font-sans);
}

// ── Inline form error banner ───────────────────────────────────
.form-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  margin-top: 10px;
  background: var(--legience-danger-bg-subtle);
  color: var(--legience-danger);
  border: 1px solid rgba(var(--legience-danger-rgb), 0.25);
  border-radius: 8px;
  font: 500 13px/1.4 var(--legience-font-sans);

  i-lucide { flex-shrink: 0; }
}
```

---

## Phase W — Wiring + Smoke Test (Section 4)

### Task W1: Verify outside-click on drawer + new-task close menus correctly

**Files:**
- Verify: `task-drawer.component.ts`, `new-task-modal.component.ts`

- [ ] **Step 1: Verify drawer's closeAllMenus already covers all menus**

Run: `grep -n "closeAllMenus" src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.ts`

Expected: contains `statusMenuOpen = false; assigneeMenuOpen = false; dueDateMenuOpen = false;` at minimum. If not, add the missing ones to the existing handler.

- [ ] **Step 2: Verify new-task closeAllMenus exists**

Run: `grep -n "closeAllMenus\|HostListener" src/app/modules/case-management/components/tasks-page/new-task-modal/new-task-modal.component.ts`

Expected: a `closeAllMenus()` decorated with `@HostListener('document:click')` exists (added in Task N1 Step 3).

### Task W2: Smoke test — user runs the 29-step checklist from the spec

**Owner:** Marsel

- [ ] **Step 1: Start dev server and load `/tasks`** — verify D2 row layout matches preview
- [ ] **Step 2–29: Run each row in the spec's smoke-test table** — report any failures
- [ ] **Step 30: Pass / fail report** — Claude patches any failures before commit

### Task W3: User reviews + bundled commit

- [ ] **Step 1: Diff inspection**

Run: `git status -s | head -40` and `git diff --stat | head -40`

- [ ] **Step 2: User says "commit"**

Claude stages exactly the files listed in the File Structure table at top of plan and writes a single commit with message:

```
fix(tasks): rewrite list-view row + drawer + new-task modal to match D2/V1 previews

- D2 row: title-on-top, meta strip (case/subtasks/progress/time/due), priority+avatar aside
- V1 stepper: 4 segmented pills with past/active/future states + off-track BLOCKED/Cancel links
- New-task modal: searchable case + assignee dropdowns + inline error banner
- Cleanup: drop RelativeTimePipe, dead SCSS blocks, comments-expand state
- SweetAlert replaces window.confirm in deleteTask + cancelTaskLink
- ESC handler closes drawer + new-task modal
```

---

## Self-Review Notes

**Spec coverage:** All 4 spec sections map to phases R, M, N, W. ✓

**Placeholder scan:** No "TBD" / "implement later" / "similar to" — every step has full code. ✓

**Type consistency:** `TaskStatus` enum used throughout; `subtaskProgress()` returns `{done, total, pct}` consistently; `BillingType` references use string equality (`'CONTINGENCY'`) since DTO type may arrive as string at runtime. ✓

**Naming:** `s1-stepper`, `s1-step`, `s1-offtrack` match the brainstorm preview class names exactly. `d2-row`, `d2-main`, `d2-meta`, `d2-aside` match preview. ✓
