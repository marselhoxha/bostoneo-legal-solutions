# Tasks Page Rewrite — Design Spec

**Date:** 2026-05-06
**Author:** Claude (with Marsel)
**Status:** Approved (all 4 sections); plan + implementation to follow.

## Background

The previous Phase A–J implementation diverged materially from the brainstormed D2 row design (`/.superpowers/brainstorm/20220-1777837309/content/tasks-listview-row-redesign-options.html` lines 632–690) and the V1 stepper design (`tasks-modal-flow-design-options.html` lines 619–639). The list-view row crammed too much onto line 1, lost the meta strip's information density (subtasks count, progress bar, inline time-logged, due-label), and added a status pill the preview didn't have. The modal stepper was almost right but used non-canonical class names. The `+ New task` modal was functionally correct but used native `<select>`s where the brainstorm spec called for searchable dropdowns.

This spec is a **full rewrite of the tasks list-view + drawer + new-task modal** to match the approved previews exactly, plus a wiring/bug audit to make every interaction work end-to-end.

The work that's already correct and stays:
- Backend `BillingType` enum + `V77` migration + `LegalCase.billingType` + `CaseTaskDTO.caseBillingType` projection (Phases A–B).
- Frontend interface types: `BillingType` enum + `LegalCase.billingType?` + `CaseTask.caseBillingType?` (Phase C).
- The state-driven cache + `Location.replaceState` modal-open pattern (predecessor's preloader fix).
- Subtasks CRUD, blocker prompt, assignee picker — all keep current wiring.
- Due-date editor in drawer (Phase E) — including the timezone-safe local-string emission.

## Section 1 — Tasks list-view row (D2 exact match)

### Markup target

Each row is a 4-column grid: `22px 1fr auto auto` with `gap: 16px` and `padding: 14px 28px`. `align-items: start` so the meta line aligns with the title baseline.

```
.t-row.d2-row
├─ .checkbox                          (col 1: 22px)
├─ .d2-main                           (col 2: 1fr)
│   ├─ .d2-title       → just the task title, single line, ellipsis overflow
│   └─ .d2-meta        → flex-wrap row of:
│        • case-pill (existing color-hashed dot)
│        • subtasks counter   "⊞ {done}/{total} subtasks"  (icon: lucide list-checks)
│        • progress bar       60px wide, fill colored by %  (only when total > 0)
│        • time logged        "⏱ {actualHours}h"            (HIDDEN when caseBillingType === CONTINGENCY || PRO_BONO)
│        • due-label          (re-uses dueLabelPipe, .overdue/.today coloring)
├─ .d2-aside                          (col 3: auto, vertical stack)
│   ├─ priority pill   (existing pill-{tone})
│   └─ avatar          (av-ringed sm)
└─ .row-actions                       (col 4: auto)
    └─ ⋯ kebab button → existing row-menu
```

### What's removed

- Status pill on the row (status lives in the modal stepper only).
- The "updated 2h ago" sub-line and `RelativeTimePipe` — delete the pipe file if no other consumer.
- The `.t-row--stack`, `.t-row-main`, `.t-row-sub`, `.t-sub-*`, `.pill--status`, `.av-ringed--sm` SCSS blocks.

### What's preserved

- Click row → `state.select(task.id)` (drawer renders sync from cache).
- 3-dot kebab menu items: Mark complete · Set due date… · Reassign… · Delete (no "Edit").
- Group headers (Overdue / Today / This week / Later / No date) with counts.
- Filter bar above (All / Mine / Assigned chips, Case / Priority / Due dropdowns, Compact toggle).
- `task-view.component.ts` filter logic, group computation, sort order — untouched.

### Subtasks count behavior

- When `total === 0`: render nothing (keeps the row clean for non-decomposed tasks).
- When `total > 0`: render `⊞ {done}/{total} subtasks` + the progress bar.

### Progress bar fill color

```ts
progressFillTone(pct: number): 'danger' | 'warning' | 'accent' | 'success' {
  if (pct === 0) return 'danger';
  if (pct < 50) return 'warning';
  if (pct < 100) return 'accent';
  return 'success';
}
```

Width: 60px. Background: `var(--legience-bg-subtle)`. Fill: `var(--legience-{tone})`.

### Time-logged behavior

`showTimeLog(task)` → `task.caseBillingType !== 'CONTINGENCY' && task.caseBillingType !== 'PRO_BONO'`. When false, the `⏱ Xh` chip is omitted from the meta strip. This matches the locked behavior in Section 2's drawer (Time logged section is hidden under the same predicate).

### Files touched

- `task-view.component.html` — replace lines 145–252 (the `<div *ngFor="let task...">` block).
- `task-view.component.scss` — remove dead D2 block; add `.d2-row`, `.d2-main`, `.d2-title`, `.d2-meta`, `.d2-aside`, `.row-actions`, `.progress-bar`, `.subtask-count`, `.time-logged`, `.meta-item`.
- `task-view.component.ts` — add `subtaskProgress(task)` returning `{done, total, pct}`; `progressFillTone(pct)`; `showTimeLog(task)`.
- `tasks.module.ts` — add `ListChecks` icon.

## Section 2 — Task drawer modal

### Layout

Top to bottom inside `.t-drawer`:

1. **drawer-head** — priority pill + title + ✕ (existing, unchanged)
2. **s1-wrap** (V1 stepper block) — stepper + off-track links (BLOCKED / Cancel)
3. **modal-body** — 2×2 metadata grid → description → subtasks → time-logged (conditional) → comments (always) → activity log accordion

### V1 stepper details (preview lines 619–639)

```
┌─.s1-stepper─────────────────────────────────────────────────┐
│ ┌─.s1-step.past──┬─.s1-step.active──┬─.s1-step.future──┐    │
│ │ ✓  Todo        │ ●  In progress   │ ○  Review        │    │
│ └────────────────┴──────────────────┴──────────────────┘    │
└─────────────────────────────────────────────────────────────┘

  ⏸ Mark blocked    Cancel                  ← .s1-offtrack
```

Per-step state computed by `stepStateOf(currentStatus, stepStatus)`:

```ts
const ORDER: TaskStatus[] = [TODO, IN_PROGRESS, REVIEW, COMPLETED];
stepStateOf(current, step): 'past' | 'active' | 'future' {
  const ci = ORDER.indexOf(current);
  const si = ORDER.indexOf(step);
  if (current === step) return 'active';
  if (ci > si) return 'past';
  return 'future';
}
```

Edge cases:
- `current === BLOCKED`: all 4 stepper pills render as `future` (no "active" pill); the off-track "Mark blocked" link shows in active state instead.
- `current === CANCELLED`: same — all 4 stepper pills render as `future`; off-track Cancel link disabled with "Cancelled" label.

Visual:
- **past** → `color: success`, `background: success-bg-subtle`, tick is filled green with white ✓
- **active** → `color: accent`, `font-weight: 600`, `background: accent-bg-subtle`, `border: 1px solid rgba(accent, 0.30)`, tick is filled accent
- **future** → `color: text-muted`, no bg, tick is outlined empty circle

Click any pill → `persistStatus(newStatus)` (jump-forward AND backward both allowed). Click `⏸ Mark blocked` → `openBlockerPrompt()` (existing). Click `Cancel` → SweetAlert confirm; on accept → `persistStatus(CANCELLED)`.

### Metadata 2×2 grid

| Cell | Behavior |
|---|---|
| **Case** | Clickable case-pill; clicking navigates to `/legal/cases/:id` (no inline edit). |
| **Due** | Click → inline `<input type="date">` editor (existing Phase E impl with timezone-safe local-string emission). |
| **Assignee** | Click → searchable user picker (existing). |
| **4th cell — conditional** | If `caseBillingType !== CONTINGENCY && !== PRO_BONO`: label `Estimated`, value `{est}h`, sub-text `{actual}h logged · {remaining}h remaining`. Else: label `Created`, value `{createdAt | dueLabel}`. |

### Description
Read-only multi-line text. Click-to-edit deferred (out of scope).

### Subtasks
Existing implementation kept as-is. Section header `Subtasks · {done} of {total}` + `+ Add` button.

### Time logged
**Hidden entirely when `caseBillingType === CONTINGENCY || PRO_BONO`**. Otherwise:
- Header: `Time logged · {actualHours}h` + `▶ Start timer` button (stub, deferred).
- Per-entry list (read-only Phase 1) — but we don't have entry data wired yet, so the body is empty until backend audit ships TimeEntry projection. Keep section visible with header only for now.

### Comments — add-only

- **Always visible.** Header: `Comments · N` (or `Comments` when zero).
- **Render flat** — no "Show all (N)" expand. Drop `commentsExpanded`, `visibleComments()`, `hiddenCommentCount()`, `toggleCommentsExpanded()`.
- Empty state: `No comments yet.`
- Each comment: ringed avatar + author name + relative timestamp + body.
- Bottom: `<textarea rows="2" placeholder="Add a comment…">` + `[Submit]`.
- Submit → `POST /api/case-tasks/{taskId}/comments` with `{ comment }`. On success: append to `task.comments`, clear textarea, `state.upsert(task)`.

### Activity log

Collapsible accordion (collapsed by default). Trigger button: `▸ Activity history`. On expand: render `Activity log not yet enabled.` placeholder. Backend audit-table wiring is a separate workstream.

### Files touched

- `task-drawer.component.html` — restructure body section.
- `task-drawer.component.scss` — add `.s1-stepper`, `.s1-step.past/.active/.future`, `.step-tick`, `.s1-offtrack`; remove `.status-stepper-block`, `.stepper-pill`, `.pill-muted`, `.cancel-menu-wrap`, `.stepper-overflow`, `.av-ringed--sm`.
- `task-drawer.component.ts` — drop `commentsExpanded`, `visibleComments()`, `hiddenCommentCount()`, `toggleCommentsExpanded()`; add `stepStateOf(current, step)`; replace `window.confirm` in `cancelTaskLink` with SweetAlert.

## Section 3 — + New task modal

### Field list (top to bottom)

| Field | Required | Behavior |
|---|---|---|
| Title | Yes | Text input. Submit disabled until non-empty trim. |
| Case | Yes | **Searchable dropdown** (replace native `<select>`). Same pattern as drawer's assignee picker: trigger + search input + scrollable list. Selecting one fires `onCaseChanged()`. |
| Priority | Yes (default MEDIUM) | Segmented pills LOW/MEDIUM/HIGH/URGENT (existing). |
| **Estimated hours** | **No (conditional)** | Numeric input (`min=0, step=0.25`). **Hidden when picked case's `billingType === CONTINGENCY \|\| PRO_BONO`.** Cleared when case-switch hides it. |
| Due date | No | Native `<input type="date">`. |
| Assignee | No | **Searchable dropdown** (replace native `<select>`). Same pattern. |
| Description | No | `<textarea rows="3">`. |

### Submit + error handling

```
POST /api/case-tasks  { caseId, title, taskType: OTHER, priority, dueDate?, assignedToId?, description?, estimatedHours? }
↓
On success: state.insert(newTask) → list view prepends → close() (state + Location.replaceState)
On error: set submitError = err?.error?.message ?? 'Failed to create task' → render inline red banner
          above .modal-actions; form values stay intact; user can retry.
```

**Inline banner pattern** (NOT SweetAlert, since this is recoverable transient state):

```html
<div class="form-error" *ngIf="submitError">
  <i-lucide name="alert-circle" [size]="14"></i-lucide>
  {{ submitError }}
</div>
```

### Searchable dropdown structure (mirrors drawer's assignee-trigger)

```html
<div class="case-wrap">
  <div class="case-trigger" (click)="toggleCaseMenu($event)">
    <span *ngIf="caseId == null">Select a case…</span>
    <span *ngIf="caseId != null">{{ pickedCaseLabel() }}</span>
    <i-lucide name="chevron-down" [size]="12"></i-lucide>
  </div>
  <div class="dropdown-menu case-menu" *ngIf="caseMenuOpen" (click)="$event.stopPropagation()">
    <input type="text" class="case-search" [(ngModel)]="caseSearchQuery" placeholder="Search cases…" />
    <div class="dd-scroll">
      <div class="dd-empty" *ngIf="filteredCases().length === 0">No matches</div>
      <button class="dd-item" *ngFor="let c of filteredCases()" (click)="selectCase(c, $event)">
        {{ c.title || c.caseNumber }}
      </button>
    </div>
  </div>
</div>
```

Same pattern for assignee. Outside-click closes via `@HostListener('document:click') closeAllMenus()`.

### Files touched

- `new-task-modal.component.ts` — add searchable-dropdown state, `submitError`, `closeAllMenus`, ESC handler.
- `new-task-modal.component.html` — replace `<select>`s with searchable-dropdown markup; add inline error banner.
- `new-task-modal.component.scss` — add `.case-trigger`, `.case-menu`, `.assignee-trigger`, `.assignee-menu`, `.case-search`, `.assignee-search`, `.form-error`.

## Section 4 — Wiring audit

### 4.1 SweetAlert in 3 places (replaces window.confirm)

| Location | Current | After |
|---|---|---|
| `task-view.component.ts` `deleteTask()` | `window.confirm` | `Swal.fire({ icon: 'warning', title: 'Delete task?', text, showCancelButton: true, confirmButtonText: 'Delete', cancelButtonText: 'Keep', confirmButtonColor: '#f24149' }).then(r => r.isConfirmed && proceed)` |
| `task-drawer.component.ts` `cancelTaskLink()` | `window.confirm` | Same pattern, `title: 'Cancel this task?'` |
| `task-drawer.component.ts` `deleteSubtask()` | (verify if it confirms; if so, switch) | Same pattern if applicable |

### 4.2 Dead code cleanup

After Sections 1+2 land:
- Delete `src/app/shared/pipes/relative-time.pipe.ts` (no consumers after row redesign).
- Drop `RelativeTimePipe` from `tasks.module.ts` declarations + exports + imports.
- Drop the `Clock` and unused icons from the `LucideAngularModule.pick({...})` call.
- Drop `commentsExpanded`, `visibleComments()`, `hiddenCommentCount()`, `toggleCommentsExpanded()` from `task-drawer.component.ts`.
- Drop `cancelMenuOpen` field if any leftover refs.

### 4.3 ESC key support

Both drawer and new-task modal need `@HostListener('document:keydown.escape') onEscape()`:
- Drawer: if any nested menu (status/assignee/dueDate) is open, close that first; else close drawer.
- New-task: if any nested dropdown (case/assignee) is open, close that first; else close modal.

### 4.4 Verify backend response carries `billingType`

Smoke-test step 19/20: pick a contingency case in `+ New task`, confirm Estimated hours field is hidden. If it shows for ALL cases, the backend hasn't restarted to pick up Phase B's mapper changes. Expected fix: bounce backend, not code.

### 4.5 Smoke-test checklist (29 items, you run, I patch)

| # | Action | Expected |
|---|---|---|
| 1 | Load `/tasks` | Rows render in D2 layout: title alone on top, meta strip below, priority+avatar stacked on right, ⋯ on far right. |
| 2 | Click a CONTINGENCY task row | Meta strip omits `⏱ Xh`. |
| 3 | Click an HOURLY task row | Meta strip shows `⏱ Xh`. |
| 4 | Click any row | Drawer opens immediately, no preloader flash. |
| 5 | V1 stepper renders | 4 segments; past=green/✓, active=accent ring, future=muted/empty circle. |
| 6 | Click `In progress` segment on TODO task | Server PATCH; pill updates. |
| 7 | Click `⏸ Mark blocked` | Blocker prompt opens. |
| 8 | Click `Cancel` link | SweetAlert confirm; on accept → status=CANCELLED. |
| 9 | Click Due cell | Inline date picker opens; pick + Save → updates. |
| 10 | Click Assignee cell | Searchable dropdown opens; type to filter; click → reassigns. |
| 11 | Add subtask | Add input appears; type + Enter → subtask appears. |
| 12 | Toggle subtask | Server PATCH; checkbox + strikethrough flip. |
| 13 | Type comment + Submit | POST; comment appears; textarea clears. |
| 14 | Open Activity history | Shows "Activity log not yet enabled." |
| 15 | Click backdrop or ✕ | Drawer closes; URL drops `?task=` cleanly. |
| 16 | Press ESC with drawer open | Drawer closes. |
| 17 | Click `+ New task` | Modal opens centered. |
| 18 | Click Case dropdown | Searchable list; type to filter; click one. |
| 19 | Pick CONTINGENCY case | Estimated hours field is NOT rendered. |
| 20 | Pick HOURLY case | Estimated hours field IS rendered. |
| 21 | Switch HOURLY → CONTINGENCY mid-form | Field disappears AND value clears. |
| 22 | Submit valid task | Modal closes; row prepends in list view. |
| 23 | Submit with backend failure | Inline red error banner; form stays open with values intact. |
| 24 | Press ESC with new-task modal open | Modal closes. |
| 25 | Row ⋯ → Set due date… | Drawer opens with `?focus=due`; date picker auto-opens. |
| 26 | Row ⋯ → Delete | SweetAlert confirm; row disappears. |
| 27 | Row ⋯ → Reassign | Drawer opens with `?focus=assignee`; assignee picker auto-opens. |
| 28 | Filter bar `Mine` chip | Only your tasks visible; counts update. |
| 29 | Filter bar Case dropdown | Only that case's tasks visible. |

## Out of scope

- Time-log entries CRUD wiring (`▶ Start timer` stays a stub).
- Activity log audit table backend (placeholder text stays).
- Pipeline view (`?view=pipeline`).
- Workload view (`?view=workload`).
- Inline description editor in drawer.
- Task attachments upload UI.
- Per-task billingType override (always read-only from case).
- Click-Case-pill-to-navigate (the case-pill in modal becomes clickable, but the link target remains the existing `/legal/cases/:id` route).

## Dependencies

- Backend `BillingType` + V77 + DTO projection — already shipped (Phases A–B, on disk).
- Frontend `BillingType` enum + `caseBillingType` field on `CaseTask` — already shipped (Phase C).
- Existing `TasksStateService` + cache + `Location.replaceState` modal pattern — already shipped.
- Existing assignee picker SCSS — reused for the new searchable case + assignee dropdowns.
- SweetAlert2 — already imported elsewhere in the codebase (cases module).
- Lucide icons — all existing except `ListChecks` which gets added.
