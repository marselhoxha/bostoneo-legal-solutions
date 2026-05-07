# Tasks List View + Modal Flow — Full Redesign

**Date:** 2026-05-06
**Scope:** Frontend redesign of `/tasks` list view (D2 Two-Line Stack row) + complete task-detail modal flow (V1 Segmented Pills stepper) + per-case `billingType` data model + practice-area-driven defaults + +New task form changes.
**Type:** Frontend redesign + targeted backend additions.
**Predecessors (must be in place first):**
1. Phase D follow-up — modal opens via `TasksStateService`, cache-first render, filter chips, row 3-dot menu, BLOCKED prompt, subtasks CRUD, assignee picker, "+ New task" creation modal, drift fixes, Lucide icons, inbox-view → task-view rename. Currently uncommitted on `develop` working tree.
2. Preloader fix — modal opens via `Location.replaceState` instead of `Router.navigate` so global preloader doesn't fire on row clicks. Currently uncommitted on `develop` working tree.

**Successors (out of scope, separate brainstorm cycles):**
- Pipeline view implementation (Phase 2 of original Wave 1 spec)
- Workload view implementation (Phase 3 of original Wave 1 spec)
- Backend integration audit (Start Timer end-to-end wiring, recurrence, etc.)

**Reference artifacts:**
- HTML preview of the 3 row directions (D2 chosen): `.superpowers/brainstorm/20220-1777837309/content/tasks-listview-row-redesign-options.html`
- HTML preview of the 3 modal flow visualizations (V1 chosen): `.superpowers/brainstorm/20220-1777837309/content/tasks-modal-flow-design-options.html`
- Locked design tokens: `.superpowers/brainstorm/20220-1777837309/content/rox-official.html`

---

## Goal

Make the `/tasks` page feel like a complete daily-driver tool, not a half-implemented surface. Three high-level changes compose:

1. **Two-line row** that surfaces in-row signal for subtasks completion + time logged + due, so attorneys can triage a 30-row queue without opening every modal.
2. **Visual status stepper** (segmented pills) at the top of the modal so changing task progression feels like advancing through a journey, not picking from a dropdown.
3. **Time-log conditional rendering** based on `case.billingType` so PI attorneys (contingency fee) don't see time-tracking UI noise that doesn't apply to their work; corporate / litigation attorneys (hourly billing) keep it.

The whole thing pivots around a new `LegalCase.billingType` enum and the practice-area-driven default that backfills it.

---

## Non-goals

- Pipeline view + Workload view implementation (each gets its own spec).
- Backend integration audit for Start Timer (logging time creates time-entries via `time_entry` table) — separate brainstorm cycle.
- End-to-end recurring task scheduling.
- @mention support in comments.
- Comment edit / delete (Phase 1 ships add-only).
- File attachments to comments / inline upload.
- Activity log content schema (we'll use whatever audit-log table exists; if no audit log exists, render the section empty with a "—").
- Per-row inline edit of subtasks beyond toggle/delete (no inline title rename in this round).
- Mobile-specific responsive treatment (desktop-first).

---

## User profile

- **PI / personal injury attorneys** — contingency fee dominant; time-log section hidden on their tasks because it's noise.
- **Corporate / M&A attorneys** — hourly billing dominant; time-log visible and useful.
- **Litigation / criminal / family attorneys** — usually hourly; time-log visible.
- **Mixed-practice partners** — see a mix; time-log shows or hides per-case correctly because the toggle is at case level.
- **Paralegals** — same logic as their assigned attorney's case.

---

## Data model changes

### New enum

```java
package com.bostoneo.bostoneosolutions.enumeration;

public enum BillingType {
    CONTINGENCY,    // % of recovery; common for PI cases. Time-tracking UI hidden.
    HOURLY,         // billed by the hour; time-tracking UI shown.
    FLAT_FEE,       // fixed total fee; time-tracking optional but shown for internal cost tracking.
    PRO_BONO        // no fee; time-tracking shown so the firm can track value-given.
}
```

### New column on `legal_cases`

| Column | Type | Default | Notes |
|---|---|---|---|
| `billing_type` | `VARCHAR(20)` | `'HOURLY'` | NOT NULL — every case has a billing type. Practice-area-driven default applies on case creation; legacy rows backfilled. |

### Flyway migration (next number — verify on origin/develop before writing)

Pseudo-content (exact version number is `V<next>__add_billing_type_to_legal_cases.sql`):

```sql
-- Add billing_type column with default
ALTER TABLE legal_cases
  ADD COLUMN IF NOT EXISTS billing_type VARCHAR(20) NOT NULL DEFAULT 'HOURLY';

-- Backfill: PI cases default to CONTINGENCY (per practice-area convention)
UPDATE legal_cases
   SET billing_type = 'CONTINGENCY'
 WHERE practice_area = 'PERSONAL_INJURY'
   AND billing_type = 'HOURLY';   -- only update rows still on the default

-- Pro bono flag (if a separate column exists for that, e.g. is_pro_bono)
-- adjust to actual schema:
UPDATE legal_cases
   SET billing_type = 'PRO_BONO'
 WHERE is_pro_bono = TRUE
   AND billing_type = 'HOURLY';

COMMENT ON COLUMN legal_cases.billing_type IS
  'BillingType enum: CONTINGENCY | HOURLY | FLAT_FEE | PRO_BONO. Drives time-log UI visibility on tasks linked to the case.';
```

> **Migration file naming**: per project convention `V<next>__add_billing_type_to_legal_cases.sql`. Confirm the latest migration number on `origin/develop` before writing the file (per the established preloader-fix-style pre-work step).

### Backend updates

| File | Change |
|---|---|
| `LegalCase.java` model | Add `private BillingType billingType;` with `@Enumerated(EnumType.STRING)` annotation. |
| `LegalCaseDTO.java` | Add `billingType` field. |
| `LegalCaseDTOMapper.java` (or equivalent) | Map the field on read + write. |
| `CreateLegalCaseRequest.java` | Add optional `billingType` field. If absent, server-side default uses practice-area logic (PI → CONTINGENCY, else HOURLY). |
| `LegalCaseServiceImpl.java` | Apply practice-area-driven default in the create method when `billingType` is null. |
| `CaseTaskDTO.java` | Add `caseBillingType` field — denormalized so the frontend doesn't need a second fetch when rendering task rows / modal. Server populates it from the joined case. |
| `TaskManagementServiceImpl.convertToDTO` | Set `caseBillingType` from `task.getLegalCase().getBillingType()`. |

### Frontend interface updates

`src/app/interface/case-task.ts`:

```ts
export interface CaseTask {
  // ... existing fields
  caseBillingType?: BillingType;
}

export enum BillingType {
  CONTINGENCY = 'CONTINGENCY',
  HOURLY = 'HOURLY',
  FLAT_FEE = 'FLAT_FEE',
  PRO_BONO = 'PRO_BONO',
}
```

`src/app/interface/legal-case.ts` (or wherever the LegalCase frontend interface lives):

```ts
export interface LegalCase {
  // ... existing fields
  billingType?: BillingType;
}
```

---

## UI design — row (D2 Two-Line Stack)

### Layout

Each row is **~64px tall** (was ~51px). Grid: `22px (checkbox) | 1fr (main) | auto (priority pill) | auto (avatar) | auto (⋯ button)` — 5 columns.

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ [☐]  Review Hoxha medical records (vol 3)                          [HIGH] [DA] [⋯] │
│      [● Hoxha v. MGH]  ⊞ 2/4 ━━━━░░░░ 50%  ⏱ 2.4h  Today, 5p                  │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Row main column (line 1 + line 2)

- **Line 1 — Title:** `font: 500 14px var(--legience-font-sans)`, color `--legience-text-primary`. Strikethrough + muted color when `status = COMPLETED` or `CANCELLED`.
- **Line 2 — Metadata strip:** horizontal flex with `gap: 14px`. Items in order:
  1. Case pill — `<span class="case-pill"><span class="case-dot" :style.background>{caseColor}</span>{caseTitle || caseNumber}</span>`. Color via existing 6-color hash palette.
  2. Subtasks count + mini progress bar — `⊞ {done}/{total} ━━━━░░░░ {pct}%`. Mini bar is 60px wide, 4px tall, accent fill (green when 100%, warning when over time estimate, danger when blocked). When `task.subtasks.length === 0`, render `<span class="muted">no subtasks</span>` instead. The 60px bar disappears in this case.
  3. Time logged — `⏱ {actualHours}h` or `⏱ {actualHours}h / {estimatedHours}h est`. **HIDDEN when `task.caseBillingType === 'CONTINGENCY'`.**
  4. Due date — same colors as today (overdue red, today accent, else subtle).

### Row right aside

- **Priority pill** — same as today. Tone via `priorityToTone` pipe (URGENT→danger, HIGH→orange, MEDIUM→warning, LOW→info).
- **Ringed avatar** — 28px ringed avatar via existing pattern.
- **⋯ button** — opens row 3-dot menu.

### Row click

`(click)="selectTask(task)"` — synchronously calls `state.select(task.id)` (modal opens instantly via cache) and updates URL via `Location.replaceState` (no preloader). Already implemented in predecessor's preloader-fix work.

### Group headers

Same as today (Overdue / Today / This week / Later / No due date), with red color on Overdue.

---

## UI design — row 3-dot menu

Click ⋯ opens a small dropdown menu anchored to the button. Items, top-to-bottom:

| Item | Icon (Lucide) | Behavior |
|---|---|---|
| Mark complete | `check` | PATCH `task.status = COMPLETED`. Row removes from active list. State + cache updated. |
| Set due date | `calendar` | Inline `<input type="date">` popover anchored under the menu item. On change → PATCH `task.dueDate`. Modal stays closed. |
| Reassign… | `user-plus` | Opens assignee picker dropdown anchored under the menu item. Same picker component as the modal's. On select → PATCH `task.assignedToId`. Modal stays closed. |
| (separator) | — | 1px hairline |
| Delete | `trash-2` (red on hover) | `confirm()` prompt. On approve → DELETE `task`. Row removes. Cache cleared via `state.remove(id)`. |

"Edit" item from the prior implementation is **dropped** — clicking the row already opens the modal which is functionally "edit".

---

## UI design — modal layout

Modal is a centered dialog that opens via `state.selectedId$` (synchronous cache hit). Width `min(640px, 92vw)`, max-height `88vh` with internal scroll.

Top-to-bottom sections:

### 1. Modal header
- Priority pill on left (tone via `priorityToTone`)
- Title (`font: 600 16px`)
- Close button (Lucide `x` icon)

### 2. Status stepper (V1 — Segmented Pills)
**This section is the new center of gravity for status changes.** Sits in a tinted background block (var(--legience-bg-card-hover)) immediately under the header.

- Container: a single rounded-rectangle pill control with `padding: 3px` and 4 segmented buttons inside.
- 4 segments left-to-right: TODO, IN_PROGRESS, REVIEW, COMPLETED (the forward lifecycle).
- Each segment is `flex: 1`, `padding: 7px 10px`, `font: 500 12px`, with a small leading icon:
  - **Past steps** (status before active): green text + green-tinted bg + ✓ icon in a small green-filled circle.
  - **Active step**: accent text + accent-tinted bg + 1px accent border + accent-filled circle (no icon, just filled).
  - **Future steps**: muted text + transparent bg + outlined empty circle.
- Click any segment → `state.persistStatus(newStatus)` (already implemented). Direct jump-forward AND jump-backward both allowed (no enforcement of "must go through REVIEW before COMPLETED" — too rigid for legal work).
- Below the stepper, a thin one-line link group: `⏸ Mark blocked` (red text, opens BLOCKED prompt) and `Cancel` (muted text, sets status to CANCELLED with a confirm prompt). These are the off-track transitions.

### 3. Metadata grid (2×2)

Same as the existing implementation (predecessor's Phase D follow-up):

```
┌──────────────────────┬──────────────────────┐
│ CASE                 │ DUE                  │
│ ● Hoxha v. MGH       │ Today, 5:00 PM       │
├──────────────────────┼──────────────────────┤
│ ASSIGNEE             │ ESTIMATED · 4.0h     │
│ [DA] David Anderson  │ 2.4h logged · 1.6h   │
│           [chevron▾] │ remaining            │
└──────────────────────┴──────────────────────┘
```

- **Case** — clickable case-pill that links to the case detail page (no inline edit; case can't be reassigned).
- **Due** — clickable; opens inline date picker. PATCH dueDate on change.
- **Assignee** — clickable; opens searchable user picker. Already implemented.
- **Status** — REPLACED by the stepper above. The 4th cell becomes either **Estimated/Logged hours** (when `caseBillingType ≠ CONTINGENCY`) or **Created date** (when `CONTINGENCY` — fallback to give the cell some content).

### 4. Blocker callout

Shown only when `status === BLOCKED`. Red-tinted box, 3px red left-border. Editable inline:
- "Why blocked?" — multi-line textarea bound to `task.blockerReason`.
- "Auto-unblock on" — date input bound to `task.autoUnblockDate` (optional).

Both fields PATCH the task on blur. (Already implemented in predecessor.)

### 5. Description

Always visible. Read-only multi-line text. Click to edit (toggle to a textarea, save on blur). Edit affordance is **out of scope** for THIS spec — keep read-only for now (predecessor implementation is read-only).

### 6. Subtasks

Always visible. Section header: `Subtasks · {done} of {total}` with `+ Add` button.
- "+ Add" toggles an inline input row at the top of the list. Enter or click "Add" creates a child task with `parentTaskId = task.id`, `caseId = task.caseId`, default `priority = MEDIUM`, default `status = TODO`. (Already implemented.)
- Each subtask row: checkbox (toggles status TODO ↔ COMPLETED via PATCH), title, due-label, hover-revealed delete icon. (Already implemented.)
- Empty state: `<div class="subtask-empty">No subtasks yet.</div>` (already implemented in predecessor).

### 7. Time logged

**Visible only when `task.caseBillingType !== 'CONTINGENCY'`.** Section header: `Time logged · {actualHours}h` with `▶ Start timer` button.

- Total at the top.
- Per-entry list (read-only for Phase 1) — each entry = `Date · Hours · time-range · billable badge`.
- "▶ Start timer" button — currently a stub (clicking does nothing). **Wiring it to create a `TimeEntry` row is OUT OF SCOPE for this spec** (deferred to backend integration audit).

### 8. Attachments

Visible only when `task.attachments?.length >= 1`. Chip-style file pills. (Already implemented as conditional in predecessor.)

### 9. Comments

**Always visible. Add-only — full CRUD is out of scope.**

- Existing comments listed (limited to 3, with "Show all (N)" link to expand when more than 3).
- Each comment: ringed avatar + author name + timestamp + body.
- At the bottom: an `<textarea>` placeholder "Add a comment…" + "Submit" primary button.
- On Submit: POST `/api/case-tasks/{taskId}/comments` with `{ comment: textareaValue }`. Backend assigns the current user as author. On success: append to the local task's comments array, clear textarea, state.upsert.

> **Backend verification needed during plan-writing**: the `POST /api/case-tasks/{id}/comments` endpoint may already exist (the model + DTO + service are present; verify endpoint + auth scoping). If missing, add a small backend task to create it: standard org-scoped controller method, validates the user belongs to the case's organization, sets `userId` from auth principal, sets `taskId` from path, persists `comment` from request body.

### 10. Activity log

**Always shown as a collapsible accordion. Collapsed by default.**

- Trigger: `Activity history · {N} events ▾` button at the bottom of the modal body.
- On click: expands to show events list. Click again to collapse.
- Each event: `<icon> <author> <action> · <time-ago>`. Examples:
  - `<chevron-right> David Anderson moved this to In progress · 2h ago`
  - `<user-plus> Sarah Chen reassigned to Anna Wilson · yesterday`
  - `<message-square> Anna Wilson commented · yesterday`
  - `<plus> Sarah Chen created task · 3 days ago`

> **Data source**: depends on whether the existing audit log captures task-level events. If the schema has a `task_audit_log` (or similar) table — query it. If not — render the section as collapsed with placeholder text "Activity log not yet enabled" until the audit infrastructure ships. (Confirm during plan-writing.)

---

## UI design — BLOCKED required prompt

Triggered by stepper's "⏸ Mark blocked" link. Opens a small confirm-modal stacked on top of the task modal (one z-layer higher).

- Header: AlertCircle icon + "Mark task as Blocked"
- Required field: "Why blocked? *" — multi-line textarea, placeholder "What's blocking this task?"
- Optional field: "Auto-unblock on… (optional)" — date input
- Buttons: Cancel + **Set blocked** (Set blocked disabled until reason has non-empty trimmed content)
- On submit: PATCH `task` with `{ status: 'BLOCKED', blockerReason: <reason>, autoUnblockDate: <date or null> }`. Closes the prompt. Modal's stepper updates to show the off-track state.

(Already implemented in predecessor; this spec does not change it.)

---

## UI design — "+ New task" form

Opens via `state.setNewTaskOpen(true)`. Form fields, top-to-bottom:

| Field | Required? | Behavior |
|---|---|---|
| Title | Yes | Text input. Submit disabled until non-empty. |
| Case | Yes | Searchable dropdown of org's cases. Submit disabled until selected. |
| Priority | Yes (default MEDIUM) | Segmented control: LOW / MEDIUM / HIGH / URGENT. |
| **Estimated hours** | **No (conditional)** | **Numeric input, decimal allowed.** **Visible only when picked case's `billingType !== CONTINGENCY`.** When the user changes the picked case (changing dropdown), this field shows or hides accordingly. |
| Due date | No | `<input type="date">`. |
| Assignee | No | Searchable dropdown of org attorneys. |
| Description | No | Multi-line textarea. |

On Submit:
- POST `createTask` with the form payload.
- On success: state.insert(newTask). Modal closes. Inbox row appears at the top (since prepended in cache).

The `case.billingType` for the picked case is read from the case object once the user selects it. Backend includes `billingType` on the case DTO (per data-model section above).

---

## State management & URL

No new state-management primitives needed. The `TasksStateService` already exposes `selectedId$`, `newTaskOpen$`, and the cache. URL handling already uses `Location.replaceState` (predecessor's preloader fix).

The new `task.caseBillingType` field is read from the cached task (already populated by `state.setAll(tasks)` after the inbox fetch). Modal sections show/hide based on it via `*ngIf="task.caseBillingType !== 'CONTINGENCY'"`.

---

## Files affected

### Backend (new + modified)

| Path | Change |
|---|---|
| `backend/src/main/resources/db/migration/V<next>__add_billing_type_to_legal_cases.sql` | NEW — migration described above. Idempotent. |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/enumeration/BillingType.java` | NEW — enum. |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/model/LegalCase.java` | MODIFY — add `billingType` field with `@Enumerated(EnumType.STRING)`. |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/dto/LegalCaseDTO.java` | MODIFY — add `billingType` field. |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/dto/CreateLegalCaseRequest.java` (or equivalent) | MODIFY — add optional `billingType` field. |
| LegalCase mapper (find via grep — likely in a `dtomapper/` package) | MODIFY — map field both ways. |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/service/implementation/LegalCaseServiceImpl.java` | MODIFY — `createCase()` applies practice-area-driven default when `billingType` is null. |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/dto/CaseTaskDTO.java` | MODIFY — add `caseBillingType` field. |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/service/implementation/TaskManagementServiceImpl.java` | MODIFY — `convertToDTO()` populates `caseBillingType` from joined case. |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/controller/CaseTaskCommentController.java` (or similar — verify exists) | NEW or MODIFY — ensure `POST /api/case-tasks/{id}/comments` exists with org-scoping. |

### Frontend (modified)

| Path | Change |
|---|---|
| `src/app/interface/case-task.ts` | Add `caseBillingType?: BillingType` field; add `BillingType` enum export. |
| `src/app/interface/legal-case.ts` (or whichever file holds the LegalCase interface) | Add `billingType?: BillingType`. |
| `src/app/modules/case-management/components/tasks-page/views/task-view/task-view.component.html` | Rewrite row template to D2 two-line stack. Conditional time-log column. |
| `src/app/modules/case-management/components/tasks-page/views/task-view/task-view.component.scss` | Replace row styles with D2 grid (5 columns) + metadata strip layout. |
| `src/app/modules/case-management/components/tasks-page/views/task-view/task-view.component.ts` | Add `setDueDate(task)` method for new 3-dot menu item; remove `editTask` method (item dropped). |
| `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.html` | Add V1 Segmented Pills stepper at top of body. Replace status field in metadata grid with estimated/logged-hours summary. Wire conditional time-log section. Wire add-only comments form. Wire activity log accordion. |
| `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.scss` | Add `.s1-stepper`, `.s1-step.{past,active,future}`, `.s1-offtrack` styles. Add `.activity-toggle` style. Add `.comment-input-wrap` style. |
| `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.ts` | Add `submitComment(text: string)`, `toggleActivityLog()`, `cancelTask()`. Update `changeStatus` to call new stepper-friendly persist (no behavior change). |
| `src/app/modules/case-management/components/tasks-page/new-task-modal/new-task-modal.component.html` | Add conditional Estimated Hours field (visible when picked case's `billingType !== CONTINGENCY`). |
| `src/app/modules/case-management/components/tasks-page/new-task-modal/new-task-modal.component.ts` | Add `estimatedHours: number | null` form state; add `showEstimatedHours` getter that reads picked case's `billingType`. Include in payload on save. |
| `src/app/service/case-task.service.ts` | Add `addComment(taskId, comment)` method that POSTs to `/api/case-tasks/{taskId}/comments`. |

### Files NOT modified

- `src/app/app.component.ts` (preloader logic stays).
- `src/app/component/preloader/*` (no change to skeleton component).
- The `TasksStateService` (no API change — modal state primitives unchanged).
- Tasks routing module.
- Any of the pipes (priorityToTone, dueLabel, userInitials, statusToTone) — they keep working.
- The legacy `TaskManagementComponent` at `src/app/component/case-task/task-management/` (untouched; redirect from `/case-management/tasks` already in place).

---

## Verification / test plan

The user runs each step in their browser. I verify with screenshots only after they confirm.

### Frontend behavior tests

1. **Row D2 layout**: navigate to `/tasks`. Each row shows two lines — title on top, metadata strip below with case-pill, subtasks count + mini bar, time-logged (or hidden), due date. Right side has priority + avatar + ⋯.
2. **Time-log conditional in row**: at least one task linked to a CONTINGENCY case. Verify its row's metadata strip OMITS the `⏱ Xh` column. Other tasks linked to HOURLY cases show it.
3. **Row 3-dot menu**: click ⋯ on any row. Menu opens with Mark complete, Set due date, Reassign…, Delete. No "Edit" item.
4. **Set due date inline picker**: click "Set due date". Inline date picker appears anchored to the menu. Pick a new date. Row's due column updates without modal opening.
5. **Modal stepper V1 — past/active/future segments**: click a row whose status is `IN_PROGRESS`. Modal opens. Stepper shows: TODO (past, green ✓), IN_PROGRESS (active, accent), REVIEW (future, muted), COMPLETED (future, muted). Off-track link "⏸ Mark blocked / Cancel" beneath.
6. **Stepper click forward**: click REVIEW. Status updates to REVIEW. Stepper re-renders: TODO + IN_PROGRESS green ✓ past, REVIEW active accent, COMPLETED future. Row in background also updates priority/status visually if visible.
7. **Stepper click backward**: click TODO. Status moves back. Stepper updates accordingly.
8. **BLOCKED prompt**: click "⏸ Mark blocked" link. Confirm modal opens with required reason textarea. Submit blocked until reason has content. Set blocked → modal closes, task's status becomes BLOCKED, blocker callout appears in task modal.
9. **Time-log conditional in modal**: open a task on a CONTINGENCY case. Time-logged section is hidden. Open a task on an HOURLY case. Time-logged section visible.
10. **Subtask add + toggle + delete**: open any task. Click "+ Add" — input appears. Type "Test subtask" + Enter. Subtask appears. Click checkbox — strikethrough + COMPLETED. Hover row → trash icon. Click trash → confirm → row gone.
11. **Comment add**: open a task. Comments section visible. Type into textarea + Submit. Comment appears at the bottom. Textarea clears.
12. **Activity log expand/collapse**: open a task. "Activity history · N events ▾" at the bottom is collapsed. Click → expands to show events. Click again → collapses.
13. **+New task — billingType conditional**: click "+ New task". Pick a CONTINGENCY case → Estimated Hours field NOT visible. Switch to an HOURLY case → field appears. Fill, save. Task appears in inbox.
14. **No preloader on modal open**: open any task row. No skeleton flash, no rows shifting. (Predecessor's preloader fix is in place.)
15. **Browser back closes modal**: with modal open, click browser back. URL drops `?task=`, modal closes. Forward → modal reopens.

### Backend behavior tests

16. **billingType migration applied**: in psql, `\d legal_cases` shows `billing_type` column. Existing PI cases have `billing_type = 'CONTINGENCY'`. Other practice areas have `billing_type = 'HOURLY'`.
17. **Case create with practice-area default**: POST `/api/legal-cases` with `practiceArea = 'PERSONAL_INJURY'` and no `billingType`. Response: case created with `billingType = 'CONTINGENCY'`. Same for `practiceArea = 'CORPORATE'` → `billingType = 'HOURLY'`.
18. **Case create with explicit billingType override**: POST with `practiceArea = 'PERSONAL_INJURY'` and `billingType = 'HOURLY'`. Response: case has `billingType = 'HOURLY'` (override wins).
19. **Task DTO includes caseBillingType**: GET any task. Response JSON includes `caseBillingType` matching the linked case's billingType.
20. **POST comment**: POST `/api/case-tasks/{id}/comments` with `{ comment: 'test' }`. Response: comment created. Author = current user. Subsequent GET task includes the new comment.
21. **Tenant isolation**: User from Org A cannot POST a comment to a task in Org B (403 or filtered out).

---

## Open questions to resolve during plan-writing

1. **Activity log data source** — is there an existing `task_audit_log` table or does the audit infrastructure need to be added? If missing, render section with "Activity log not yet enabled" placeholder text and defer to a follow-up audit-infra brainstorm.
2. **POST comment endpoint** — verify it exists. If not, add a small backend task in the plan.
3. **`Location.replaceState` precedent** — predecessor's preloader fix established this pattern for `?task=` and `?new=task`. Set due date inline picker probably doesn't need URL state at all (it's a transient inline UI). Confirm in plan.
4. **Migration version number** — verify latest on `origin/develop` before writing the file (per established pattern).
5. **PRO_BONO + FLAT_FEE billingType — should they show or hide time-log?** Current spec: show. Reasoning: pro bono firms often track time for value-given reporting; flat-fee firms track time for internal cost analysis. If user disagrees with this default, change the conditional from `!== 'CONTINGENCY'` to `=== 'HOURLY'`.

---

## Implementation cost estimate

- Backend: ~2 hours (1 migration, 1 enum, ~6 file modifications, all mechanical).
- Frontend D2 row template + SCSS: ~2 hours.
- Frontend V1 stepper: ~1.5 hours (component + SCSS + wiring `state.persistStatus`).
- Frontend modal layout updates (add comment, activity collapse): ~1.5 hours.
- Frontend +New task estimated-hours conditional: ~30 min.
- Manual test pass + iteration: ~2 hours.
- Total: ~9-10 hours of focused work; one bundled commit.
