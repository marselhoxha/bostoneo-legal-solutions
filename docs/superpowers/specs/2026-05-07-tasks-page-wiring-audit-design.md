# Tasks Page — Wiring & Backend Integration Audit

**Date**: 2026-05-07
**Status**: Design — pending implementation plan
**Scope**: Bug-fix audit covering four user-reported issues on the redesigned tasks page (V1 modal + D2 row already shipped). Each item has a verified root cause; the fix shape is locked.

## Context

The Wave 1 tasks-page redesign (V1 segmented stepper + D2 two-line row + drawer-as-centered-modal) is visually complete but several wirings are broken or incomplete:

1. Subtask rows never display the **completion date** when a subtask is marked done — they keep showing the original due-date.
2. Clicking any segment of the V1 status stepper **breaks the modal** — it re-renders with literal `{{ task.title }}` template placeholders and blank fields.
3. The drawer's **assignee picker** silently fails — toggling attorneys does nothing (no avatar update, no error toast, no persistence).
4. The "+ New task" button does **not produce a task** — failure point not yet pinned (modal rendering, button click, or form submit).

The user requested an audit to verify everything in the tasks page is properly implemented in the backend and properly integrated with the frontend.

## Out of scope

- The parallel `/api/v1/tasks` (`TaskManagementResource`) and `/api/legal/tasks` (`TaskManagementController`) controllers backing the same service with diverging feature sets is a code smell. Flagged for a separate consolidation spec; **not addressed here**.
- The `/api/v1/notifications` controller and other unrelated routes — out of scope.
- Any new feature work (Pipeline view, Workload view, time-entry backend) — out of scope.
- Changes to the V1 stepper visual design or D2 row layout — already shipped.

---

## Issue 1 — Subtask completion date display

### Symptom

Completed subtask rows in the drawer continue to show the original due-date (e.g., "Today") on the right side, with no indication of when the subtask was actually completed. UX option **A** was chosen: when `status === COMPLETED`, the right-side label should show `completedAt` (formatted via `dueLabel`) instead of `dueDate`.

### Root cause

Two contributing bugs:

- **Display side** — `task-drawer.component.html:338` always renders `{{ st.dueDate | dueLabel }}`. The template has no awareness of completion state.
- **Data side** — `task-drawer.component.ts:552` (`toggleSubtask`) ignores the response (`next: () => {...}`) and only mutates the local `status` field. Even though the backend correctly populates `completedAt` (see `TaskManagementServiceImpl:607` — sets `completedAt = now()` on status → COMPLETED, clears it when status moves away), the frontend never reads it back. So even after fixing the template, the data wouldn't be there to render.

### Fix

**Frontend HTML** (`task-drawer.component.html`):

```html
<span class="due">
  {{ (st.status === 'COMPLETED' ? st.completedAt : st.dueDate) | dueLabel }}
</span>
```

**Frontend TS** (`task-drawer.component.ts:542 toggleSubtask`):

```typescript
toggleSubtask(st: CaseTask, ev: Event): void {
  ev.stopPropagation();
  if (!st?.id) return;
  const newStatus =
    st.status === TaskStatus.COMPLETED ? TaskStatus.TODO : TaskStatus.COMPLETED;

  this.taskService
    .updateTaskStatus(st.id, newStatus)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (response) => {
        // Backend wraps as { data: { task: CaseTaskDTO } } — unwrap defensively.
        const fromServer = (response?.data as any)?.task ?? response?.data;
        const updatedSubtask: Partial<CaseTask> = fromServer
          ? { ...st, ...fromServer }
          : { ...st, status: newStatus };

        if (!this.task) return;
        this.task = {
          ...this.task,
          subtasks: (this.task.subtasks ?? []).map((s) =>
            s.id === st.id ? { ...s, ...updatedSubtask } : s,
          ),
        };
        this.state.upsert(this.task);
      },
      error: (err) => console.error('Failed to toggle subtask', err),
    });
}
```

### Backend

No change required. `TaskManagementServiceImpl.updateTaskStatus` (line 607) already sets/clears `completedAt` correctly. The `CaseTaskDTO` already exposes `completedAt: LocalDateTime`.

### Verification

1. Open a task with subtasks in the drawer.
2. Click an unchecked subtask → label changes to "Today" (or current relative day).
3. Click again to uncheck → label returns to the original due-date.
4. Refresh the page → state persists.

---

## Issue 2 — Status change breaks the modal (response unwrap)

### Symptom

Clicking any segment of the V1 stepper (e.g., Todo → In progress) causes the modal to re-render with literal `{{ task.title }}`, `{{ task.priority | titlecase }}`, etc. as visible text. Other fields go blank or show "undefined".

### Root cause

In `task-drawer.component.ts`, four call sites unwrap the API response incorrectly:

```typescript
// Current (broken):
const fromServer = response?.data;
const updated: CaseTask = fromServer
  ? (fromServer as unknown as CaseTask)
  : { ...(this.task as CaseTask), status: newStatus };
this.task = updated;
```

The backend wraps every successful task response as:

```json
{
  "data": { "task": { "id": ..., "title": ..., "status": ..., ... } },
  "message": "...",
  "status": "OK",
  "statusCode": 200
}
```

So `response?.data` is `{ task: {...} }` — a wrapper, not the task itself. The cast `fromServer as unknown as CaseTask` produces an object with no `id`, `title`, `priority`, etc. The Angular template then renders every `task.X` interpolation as `undefined` or as raw text fragments depending on Angular's handling of the path.

### Affected sites (all in `task-drawer.component.ts`)

| Line | Method | Currently broken |
|------|--------|------------------|
| ~418 | `persistStatus` | yes — primary cause of the user-visible bug |
| ~467 | `submitBlockerPrompt` | yes — same shape |
| ~681 | `submitDueDate` | yes — same shape |
| ~712 | `clearDueDate` | yes — same shape |

Note: `toggleAssignee` (line ~782) and `reassignTo` (line ~818) **already do** the correct unwrap — `(response?.data as any)?.task ?? response?.data`. The new-task-modal `save()` handler also does the right thing. So the codebase is inconsistent: half of the call sites get this right, half get it wrong.

### Fix

At each of the four broken sites, replace the unwrap line:

```typescript
// Replace this:
const fromServer = response?.data;

// With this:
const fromServer = (response?.data as any)?.task ?? response?.data;
```

Add a one-line comment above each replacement:

```typescript
// Backend wraps as { data: { task: CaseTaskDTO } } — unwrap defensively.
const fromServer = (response?.data as any)?.task ?? response?.data;
```

### Approach choice

**A) Surgical (selected)** — fix at each call site (~12 LOC across 4 sites). Lowest blast radius. Matches the pattern other call sites already use.

**B) Service-layer** — add `.pipe(map(r => (r?.data as any)?.task ?? r?.data))` inside `CaseTaskService.updateTaskStatus`/`updateTask`. Single source of truth, but changes the method's return type contract for any consumer that's already doing its own unwrap.

Selected A; flagged B as a follow-up cleanup once we audit other consumers of `CaseTaskService`.

### Verification

1. Click Todo → In progress on a task in the modal: title, priority pill, metadata grid, and stepper position all update without visual breakage.
2. Click "Mark blocked" + supply reason: modal stays populated; blocker callout appears with the reason and auto-unblock date.
3. Open due-date editor, pick a date, save: due-date displays correctly; modal stays intact.
4. Clear due-date via the editor: due-date shows "Set due date" placeholder; modal stays intact.
5. Refresh page after each: state persists.

---

## Issue 3 — Assignee picker silently fails (missing controller endpoint)

### Symptom

Opening the drawer's assignee dropdown and toggling attorneys produces no visible change. Avatar stack doesn't update, no error toast, no persistence. Refreshing the page shows the original assignee unchanged.

### Root cause

The frontend (`CaseTaskService.replaceAssignees`, line 177) calls:

```
PUT /api/legal/tasks/{taskId}/assignees
Body: { "userIds": [1, 2, 3] }
```

But the active `TaskManagementController` (`/api/legal/tasks`) **has no such endpoint**. The endpoint exists in a parallel `TaskManagementResource` (`/api/v1/tasks`) but the frontend never hits that base path. The `taskManagementService.replaceAssignees(Long, List<Long>)` method **does exist** on the service interface and impl (line 554) — it's only the controller wiring that's missing.

The browser most likely receives a 405 Method Not Allowed (or 404), which is silently consumed by the Angular service's catch handler.

### Fix — backend only

Add the following endpoint to `TaskManagementController.java`:

```java
/**
 * V78 — multi-assignee. Body: { "userIds": [1, 2, 3] }.
 * Replaces the full set of assignees for the task. The first userId in
 * the list becomes the "primary" (mirrors `assignedTo` for legacy
 * notification + filter wiring).
 */
@PutMapping("/{taskId}/assignees")
@PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY', 'ROLE_MANAGING_PARTNER', 'ROLE_SENIOR_PARTNER', 'ROLE_EQUITY_PARTNER', 'ROLE_OF_COUNSEL', 'ROLE_PARALEGAL', 'ROLE_SECRETARY', 'ROLE_MANAGER')")
public ResponseEntity<HttpResponse> replaceAssignees(
        @AuthenticationPrincipal(expression = "id") Long currentUserId,
        @PathVariable Long taskId,
        @RequestBody Map<String, List<Long>> body) {
    List<Long> userIds = body == null
            ? Collections.emptyList()
            : body.getOrDefault("userIds", Collections.emptyList());
    log.info("User {} replacing assignees on task {} -> {}", currentUserId, taskId, userIds);

    CaseTaskDTO task = taskManagementService.replaceAssignees(taskId, userIds);

    return ResponseEntity.ok(
            HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(of("task", task))
                    .message("Task assignees updated successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build());
}
```

### Authorization rationale

Mirrors the existing `assignTask` endpoint's role list (`@PostMapping("/{taskId}/assign/{userId}")`) for consistency. Allows attorneys, partners, paralegals, secretaries, and managers to manage assignees. Self-assignment works automatically because:

- `userService.getAttorneys()` returns the full attorney list including the current user.
- `replaceAssignees` doesn't filter on identity — any user_id in the org can be added/removed.

### Frontend

No frontend change required — the FE call site (`task-drawer.component.ts:782`) already does the correct response unwrap. Once the backend endpoint exists, the picker will start persisting.

### Verification

1. Open a task in the drawer; click the assignee chevron.
2. Toggle self in (or another attorney): avatar stack updates immediately; metadata field updates.
3. Toggle additional attorneys: avatar stack accumulates with `+N` chip when > 3.
4. Toggle one out: removed from avatar stack and persisted.
5. Refresh page: assignee set persists.
6. Confirm dev test user `a.wilson@bostoneosolutions.com` (ROLE_ATTORNEY) can self-assign.

---

## Issue 4 — Cannot create a new task (failure mode unconfirmed)

### Symptom

User reports "+ New task" button doesn't produce a task. Specific failure point (button → modal → submit → response) not yet pinned.

### Investigation plan

The fix is "verify each link in the chain"; the implementation step starts with reproduction:

1. **Header button click**: verify `tasks-page.component.ts:openNewTaskModal()` fires when clicking the header `+ New task` button. Confirm via console log or breakpoint that `state.setNewTaskOpen(true)` is called.
2. **Modal render**: verify `state.newTaskOpen$` emits `true` and `new-task-modal.component.ts:open` flips. CSS inspection of `new-task-modal.component.scss` showed correct `position: fixed`, `z-index: var(--legience-z-modal)`, and `*ngIf="open"` — so this layer should be healthy.
3. **Form submit**: verify `taskService.createTask(payload)` POSTs successfully. The new-task-modal's `save()` already does the correct unwrap (`response?.data?.task ?? response?.task ?? response?.data ?? null` at line 359), so the Issue 2 bug doesn't apply here.

### Hypotheses (in likelihood order)

- **403 Forbidden** — test user (e.g., `a.wilson@bostoneosolutions.com`) lacks one of the required roles in `TaskManagementController.createTask` `@PreAuthorize`. Required roles: `ROLE_ADMIN, ROLE_ATTORNEY, ROLE_MANAGING_PARTNER, ROLE_SENIOR_PARTNER, ROLE_EQUITY_PARTNER, ROLE_OF_COUNSEL, ROLE_PARALEGAL, ROLE_SECRETARY, ROLE_MANAGER`. `ROLE_ATTORNEY` is on the list, so this is unlikely with the standard test user — but worth checking.
- **400 Bad Request** — payload field mismatch. Frontend sends `taskType: TaskType.OTHER` by default; backend `CreateTaskRequest.taskType` is `@NotNull TaskType`. Mismatch unlikely but possible if enum values diverged.
- **Modal not visible** — z-index or positioning regression from a recent unrelated CSS change. CSS audit showed the SCSS is healthy, so unlikely.
- **Subscription wiring** — `state.setNewTaskOpen(true)` fires but `state.newTaskOpen$` subscription in the modal isn't wired (e.g., destroyed early). Unlikely given the modal has worked in past sessions.

### Fix path

The implementation plan should:
1. Open browser dev tools (Network + Console tabs).
2. Click "+ New task" → record what fires.
3. If modal opens, fill all required fields and submit → record HTTP status + response body.
4. Apply minimal fix based on failure mode (likely 1–2 LOC or a permissions adjustment in `TaskManagementController.createTask`).
5. Re-verify end-to-end.

If the failure is more systemic than expected, surface and re-design.

### Verification

1. Header `+ New task` button opens the modal with form fields visible.
2. Filling Title, Case, Priority, Due date, Assignees, Description and clicking "Create task" produces a new task that appears at the top of the inbox without a refetch.
3. Same flow from inbox empty-state CTA (when no tasks exist).
4. Self-assignment works in the new-task assignee dropdown.

---

## Cross-cutting: response-unwrap pattern

After this spec lands, every `taskService.update*`/`createTask`/`addComment` call in the FE follows the same defensive unwrap:

```typescript
const fromServer = (response?.data as any)?.task ?? response?.data;
```

A one-line comment goes above each fix site so the next developer doesn't repeat the bug:

```typescript
// Backend wraps as { data: { task: CaseTaskDTO } } — unwrap defensively.
```

A follow-up cleanup spec should consolidate this into `CaseTaskService` so consumers can't get it wrong, but that's out of scope for this audit.

---

## Files touched

| Layer | File | Change |
|---|---|---|
| Backend | `controller/TaskManagementController.java` | Add `PUT /{taskId}/assignees` endpoint |
| Frontend | `task-drawer/task-drawer.component.html` | Conditional `dueDate` ↔ `completedAt` on subtask rows |
| Frontend | `task-drawer/task-drawer.component.ts` | Fix unwrap at 4 sites; `toggleSubtask` reads response back |
| Frontend (conditional) | `new-task-modal/new-task-modal.component.ts` | Pending Issue 4 reproduction; may need 1–2 LOC fix or no change |

---

## Test plan (manual smoke)

Run all five scenarios end-to-end against local dev (`localhost:4200` + backend on `localhost:8085`) using `a.wilson@bostoneosolutions.com / 1234`:

1. **Status change**: open a task; click each stepper segment in turn (Todo → In progress → Review → Completed → back). Modal stays populated each time. Status persists across refresh.
2. **Mark blocked**: from any non-blocked status, click "Mark blocked"; supply reason + auto-unblock date; submit. Modal stays populated; blocker callout appears with the reason. Persist across refresh.
3. **Subtask completion date**: open a task with subtasks; toggle a subtask checkbox. Right-side label shows current relative day (e.g., "Today"). Toggle back; due-date returns. Persist across refresh.
4. **Assignee picker**: open assignee dropdown; toggle self in. Avatar stack updates. Toggle a second attorney in. Both persist. Toggle one out; remaining persists.
5. **Create new task**: click "+ New task"; fill all fields including self as assignee; submit. New task appears at top of inbox with correct case/priority/assignee/due-date. Open it in drawer to verify all fields round-trip correctly.

### Backend tests

- `TaskManagementServiceTest` already covers `replaceAssignees`. Verify the new controller endpoint is wired by inspecting `TaskManagementControllerTest` (or adding a minimal integration test if one doesn't exist for the new method).

### Frontend tests

No new unit tests for the FE bug fixes — these are simple type-cast errors and missing-template-conditional fixes that don't warrant unit coverage. Manual smoke is sufficient.

---

## Database migrations

None. No schema changes.

---

## Open questions

None. Issue 4 has an investigation step embedded in implementation, not a design ambiguity.
