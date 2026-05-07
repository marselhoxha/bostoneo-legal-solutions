# Tasks Modal — Skip Global Preloader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `Router.navigate(...)` with `Location.replaceState(...)` in four places that update the URL for modal opens/closes on `/tasks`, so the global preloader stops firing on every modal interaction.

**Architecture:** Mechanical fix — 4 component files modified, same pattern in each: inject `Location` from `@angular/common`, build the URL via `Router.createUrlTree()` + `Router.serializeUrl()`, then call `location.replaceState(...)` instead of `router.navigate(...)`. No tests, no new files, no backend changes. Manual test plan at the end.

**Tech Stack:** Angular 18, `@angular/common` `Location` service, `@angular/router` `Router.createUrlTree` + `Router.serializeUrl`.

**Spec reference:** [docs/superpowers/specs/2026-05-06-tasks-modal-no-preloader-design.md](../specs/2026-05-06-tasks-modal-no-preloader-design.md)

---

## File Structure

### Modified files (4)

| Path | What changes |
|---|---|
| `src/app/modules/case-management/components/tasks-page/views/task-view/task-view.component.ts` | Inject `Location`. In `selectTask(task)`, replace `router.navigate(...)` with `location.replaceState(...)`. Keep `state.select(task.id)` call. |
| `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.ts` | Inject `Location`. In `close()`, replace `router.navigate(...)` with `location.replaceState(...)`. Keep `state.select(null)` call. |
| `src/app/modules/case-management/components/tasks-page/tasks-page.component.ts` | Inject `Location`. In `openNewTaskModal()`, replace `router.navigate(...)` with `location.replaceState(...)`. |
| `src/app/modules/case-management/components/tasks-page/new-task-modal/new-task-modal.component.ts` | Inject `Location`. In `close()`, replace `router.navigate(...)` with `location.replaceState(...)`. |

### Files NOT modified

- `src/app/app.component.ts` — preloader logic intact.
- `src/app/component/preloader/*` — no change to skeleton component.
- `src/app/modules/case-management/components/tasks-page/tasks-state.service.ts` — no API change.
- Any backend file.
- Any pipe.
- Any template (`.html`) or stylesheet (`.scss`).
- The view-switcher chip group in `tasks-page.component.ts.switchView()` — keeps `router.navigate` because switching to Pipeline/Workload is a real navigation.

---

## Task 1: task-view.component.ts — `selectTask()` uses `Location.replaceState`

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/views/task-view/task-view.component.ts`

- [ ] **Step 1: Add `Location` import**

In the imports block at the top of `task-view.component.ts`, ensure these imports are present (the first three already exist):

```ts
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { Location } from '@angular/common';   // ← NEW import
```

If `Location` is already imported (unlikely but possible), skip this step.

- [ ] **Step 2: Inject `Location` in the constructor**

Find the constructor (currently roughly):

```ts
constructor(
  private taskService: CaseTaskService,
  private route: ActivatedRoute,
  private router: Router,
  private state: TasksStateService,
  private auth: AuthService,
) {}
```

Add `private location: Location,` to the parameter list (any position is fine; convention is to keep it next to `route` and `router`):

```ts
constructor(
  private taskService: CaseTaskService,
  private route: ActivatedRoute,
  private router: Router,
  private location: Location,         // ← NEW
  private state: TasksStateService,
  private auth: AuthService,
) {}
```

- [ ] **Step 3: Rewrite `selectTask()` to use `Location.replaceState`**

Find the existing `selectTask(task: CaseTask): void` method. It currently looks like:

```ts
selectTask(task: CaseTask): void {
  // Synchronously select via state — drawer renders immediately,
  // bypassing the ~1s router.navigate roundtrip.
  if (task?.id != null) this.state.select(task.id);

  // URL sync in background (fire-and-forget) for deep-link persistence.
  this.router.navigate([], {
    relativeTo: this.route,
    queryParams: { task: task.id },
    queryParamsHandling: 'merge',
  });
}
```

Replace the entire method body with:

```ts
selectTask(task: CaseTask): void {
  // Synchronously select via state — drawer renders immediately
  // from the in-memory cache.
  if (task?.id != null) this.state.select(task.id);

  // Update the URL via the History API (NOT Angular Router) so the
  // global preloader (subscribed to NavigationStart) does NOT fire.
  // We still want the URL bar to reflect the modal state for deep
  // links and browser back/forward navigation.
  const tree = this.router.createUrlTree([], {
    relativeTo: this.route,
    queryParams: { task: task.id },
    queryParamsHandling: 'merge',
  });
  this.location.replaceState(this.router.serializeUrl(tree));
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run from the parent project root:

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tail -10
```

Expected: zero output (no errors). Pre-existing errors in unrelated files (if any) are not caused by this change.

- [ ] **Step 5: DO NOT COMMIT**

Skip git operations. The bundled commit happens at the end of Task 5 with explicit user approval.

---

## Task 2: task-drawer.component.ts — `close()` uses `Location.replaceState`

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.ts`

- [ ] **Step 1: Add `Location` import**

In the imports block at the top, ensure:

```ts
import { Location } from '@angular/common';
```

is present alongside the existing imports. If not present, add it.

- [ ] **Step 2: Inject `Location` in the constructor**

Find the existing constructor — currently roughly:

```ts
constructor(
  private route: ActivatedRoute,
  private router: Router,
  private taskService: CaseTaskService,
  private userService: UserService,
  private state: TasksStateService,
) {}
```

Add `private location: Location,`:

```ts
constructor(
  private route: ActivatedRoute,
  private router: Router,
  private location: Location,         // ← NEW
  private taskService: CaseTaskService,
  private userService: UserService,
  private state: TasksStateService,
) {}
```

- [ ] **Step 3: Rewrite `close()`**

Find `close(): void` — currently:

```ts
close(): void {
  // Clear selection synchronously so the modal vanishes immediately —
  // URL update is fire-and-forget for deep-link persistence.
  this.state.select(null);

  const queryParams = { ...this.route.snapshot.queryParams };
  delete queryParams['task'];
  delete queryParams['focus'];
  this.router.navigate([], {
    relativeTo: this.route,
    queryParams,
    replaceUrl: true,
  });
}
```

Replace the entire method body with:

```ts
close(): void {
  // Clear selection synchronously so the modal vanishes immediately.
  this.state.select(null);

  // Update URL via History API to drop ?task= and ?focus= params
  // without firing Angular Router NavigationStart (which would
  // trigger the global preloader).
  const queryParams = { ...this.route.snapshot.queryParams };
  delete queryParams['task'];
  delete queryParams['focus'];
  const tree = this.router.createUrlTree([], {
    relativeTo: this.route,
    queryParams,
  });
  this.location.replaceState(this.router.serializeUrl(tree));
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tail -10
```

Expected: zero output.

- [ ] **Step 5: DO NOT COMMIT**

Skip git operations. Bundled commit at end of Task 5.

---

## Task 3: tasks-page.component.ts — `openNewTaskModal()` uses `Location.replaceState`

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/tasks-page.component.ts`

- [ ] **Step 1: Add `Location` import**

```ts
import { Location } from '@angular/common';
```

- [ ] **Step 2: Inject `Location` in the constructor**

Find the existing constructor:

```ts
constructor(
  private route: ActivatedRoute,
  private router: Router,
  private state: TasksStateService,
) {}
```

Add `private location: Location,`:

```ts
constructor(
  private route: ActivatedRoute,
  private router: Router,
  private location: Location,         // ← NEW
  private state: TasksStateService,
) {}
```

- [ ] **Step 3: Rewrite `openNewTaskModal()`**

Find the method — currently:

```ts
openNewTaskModal(): void {
  const queryParams = { ...this.route.snapshot.queryParams, new: 'task' };
  delete queryParams['task'];
  this.router.navigate([], {
    relativeTo: this.route,
    queryParams,
    replaceUrl: true,
  });
}
```

Replace with:

```ts
openNewTaskModal(): void {
  // Add ?new=task and drop ?task= via History API (no Angular Router
  // navigation, no preloader). The new-task-modal subscribes to
  // queryParamMap which fires on this URL change because Location
  // emits its own change events.
  const queryParams = { ...this.route.snapshot.queryParams, new: 'task' };
  delete queryParams['task'];
  const tree = this.router.createUrlTree([], {
    relativeTo: this.route,
    queryParams,
  });
  this.location.replaceState(this.router.serializeUrl(tree));
}
```

> **Important note:** The new-task-modal currently watches `route.queryParamMap` to know when to open. With `Location.replaceState`, ActivatedRoute will NOT re-fire queryParamMap automatically. **Verification step in Task 4 below confirms whether this is an issue and provides the workaround if needed.**

- [ ] **Step 4: Confirm `switchView()` is NOT modified**

Find the `switchView(view: TasksView): void` method. Confirm it STILL uses `this.router.navigate(...)` (no change). View switching is a legitimate navigation; we want it to keep firing the preloader.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tail -10
```

Expected: zero output.

- [ ] **Step 6: DO NOT COMMIT**

Skip git operations. Bundled commit at end of Task 5.

---

## Task 4: new-task-modal.component.ts — `close()` uses `Location.replaceState` AND opens via state

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/new-task-modal/new-task-modal.component.ts`

This task has TWO sub-changes because the new-task-modal currently relies on `queryParamMap` to know when to open. With `Location.replaceState` instead of `router.navigate`, that subscription will NOT fire when the user clicks "+ New task". We need a parallel state-service signal.

### 4A: Update `TasksStateService` to expose a "new task modal open" flag

- [ ] **Step 1: Modify `tasks-state.service.ts` to add a `newTaskOpen$` signal**

File: `src/app/modules/case-management/components/tasks-page/tasks-state.service.ts`

Find the existing `selectedIdSubject` block (around line 18). Add a new subject below it for the new-task-modal:

```ts
private newTaskOpenSubject = new BehaviorSubject<boolean>(false);

/**
 * "+ New task" modal open state. Set sync by `openNewTaskModal()` /
 * `close()` so the modal renders without a router roundtrip (which
 * would trigger the global preloader).
 */
readonly newTaskOpen$: Observable<boolean> = this.newTaskOpenSubject.asObservable();

setNewTaskOpen(open: boolean): void {
  this.newTaskOpenSubject.next(open);
}

get newTaskOpen(): boolean {
  return this.newTaskOpenSubject.value;
}
```

Place these next to the existing `selectedId$` / `select()` block for consistency.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tail -10
```

Expected: zero output.

### 4B: Update `tasks-page.component.ts` to set the flag

- [ ] **Step 3: Update `openNewTaskModal()` in `tasks-page.component.ts`**

Edit the method written in Task 3 to also call `state.setNewTaskOpen(true)`:

```ts
openNewTaskModal(): void {
  this.state.setNewTaskOpen(true);                 // ← ADD this line at the top

  const queryParams = { ...this.route.snapshot.queryParams, new: 'task' };
  delete queryParams['task'];
  const tree = this.router.createUrlTree([], {
    relativeTo: this.route,
    queryParams,
  });
  this.location.replaceState(this.router.serializeUrl(tree));
}
```

- [ ] **Step 4: Update `tasks-page.component.ts.ngOnInit` to sync URL → state for new-task on cold deep-link**

Find the existing `ngOnInit` — currently subscribes to queryParamMap and reads `task=`. Extend the same subscription to also read `new=task` and call `state.setNewTaskOpen(...)`:

Replace the existing subscription block with:

```ts
this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(p => {
  const v = p.get('view') as TasksView | null;
  this.activeView = (v === 'pipeline' || v === 'workload') ? v : 'inbox';

  // Sync URL → state for the modal selection (one-way). Row clicks set
  // state directly for instant render; this catches deep-links + back/
  // forward navigation only.
  const tid = p.get('task');
  const id = tid ? +tid : null;
  if (id !== this.state.selectedId) {
    this.state.select(id);
  }

  // Same one-way sync for the "+ New task" modal: deep-link / back-forward
  // updates the state flag the modal subscribes to. Mid-session opens use
  // state.setNewTaskOpen(true) directly via openNewTaskModal().
  const newTaskParam = p.get('new');
  const wantNewTaskOpen = newTaskParam === 'task';
  if (wantNewTaskOpen !== this.state.newTaskOpen) {
    this.state.setNewTaskOpen(wantNewTaskOpen);
  }
});
```

### 4C: Update `new-task-modal.component.ts` to subscribe to state instead of URL

- [ ] **Step 5: Add `Location` import**

```ts
import { Location } from '@angular/common';
```

- [ ] **Step 6: Inject `Location` and `TasksStateService`**

Find the existing constructor:

```ts
constructor(
  private route: ActivatedRoute,
  private router: Router,
  private taskService: CaseTaskService,
  private userService: UserService,
  private legalCaseService: LegalCaseService,
  private state: TasksStateService,
) {}
```

If `TasksStateService` is not yet injected, add it. If `Location` is not yet injected, add it:

```ts
constructor(
  private route: ActivatedRoute,
  private router: Router,
  private location: Location,         // ← NEW (if missing)
  private taskService: CaseTaskService,
  private userService: UserService,
  private legalCaseService: LegalCaseService,
  private state: TasksStateService,
) {}
```

- [ ] **Step 7: Replace the queryParamMap subscription with `state.newTaskOpen$`**

Find the existing `ngOnInit` — currently subscribes to `route.queryParamMap` and reads `p.get('new')`. Replace that subscription block with:

```ts
ngOnInit(): void {
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
```

- [ ] **Step 8: Rewrite `close()`**

Find the existing `close()`:

```ts
close(): void {
  const queryParams = { ...this.route.snapshot.queryParams };
  delete queryParams['new'];
  this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
}
```

Replace with:

```ts
close(): void {
  // Clear state sync so the modal vanishes immediately.
  this.state.setNewTaskOpen(false);

  // Update URL via History API to drop ?new=task without firing
  // Angular Router NavigationStart (which would trigger the
  // global preloader).
  const queryParams = { ...this.route.snapshot.queryParams };
  delete queryParams['new'];
  const tree = this.router.createUrlTree([], {
    relativeTo: this.route,
    queryParams,
  });
  this.location.replaceState(this.router.serializeUrl(tree));
}
```

- [ ] **Step 9: Same flow on successful save** — make `save()` call `state.setNewTaskOpen(false)` too

Find the `save()` method's success handler. After `this.state.insert(newTask)`, ensure the close path runs. The existing code likely calls `this.close()` which now does the right thing (state + URL). Verify that's still the call after the edit. No additional change needed if `close()` is what gets called.

- [ ] **Step 10: Verify TypeScript compiles**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tail -10
```

Expected: zero output.

- [ ] **Step 11: DO NOT COMMIT**

Skip git operations.

---

## Task 5: Manual test pass + commit gate

This is the verification step. The user runs the test plan in their browser. Only when they confirm all 7 steps pass do we commit.

- [ ] **Step 1: Restart dev server (if needed)**

If the user's `ng serve` is running, the hot-reload should pick up the changes automatically. If they're seeing stale behavior, full refresh the browser tab (Cmd+Shift+R) to bypass caching.

- [ ] **Step 2: User runs Test 1 — modal open without skeleton**

Walkthrough for the user (the engineer running this plan asks the user to perform):
1. Navigate to `http://localhost:4200/tasks`
2. Wait for the task list to fully load
3. Click any task row
4. **Verify:** modal appears immediately. NO full-page skeleton overlay before the modal. NO page-width jump (rows behind the modal don't shift left/right).

If failure: investigate; ensure TypeScript compiled, dev-server hot-reloaded, no caching issue. If symptom still present, report back as DONE_WITH_CONCERNS.

- [ ] **Step 3: User runs Test 2 — modal close without skeleton**

1. With modal open from Test 1
2. Click ✕ button OR click the dimmed backdrop
3. **Verify:** modal closes immediately. URL bar drops `?task=`. No skeleton overlay during close.

- [ ] **Step 4: User runs Test 3 — initial deep-link**

1. Navigate to `http://localhost:4200/tasks?task=147` directly (paste in URL bar)
2. **Verify:** page loads with the modal already open and task data visible
3. **Note:** the preloader DOES briefly appear during initial page load. That's correct — initial route activation IS a real navigation.

- [ ] **Step 5: User runs Test 4 — browser back closes modal**

1. Open a row's modal (Test 1)
2. Click browser back button
3. **Verify:** URL drops `?task=`, modal closes (because `tasks-page` queryParamMap subscription syncs `state.select(null)` on the popstate event)

- [ ] **Step 6: User runs Test 5 — browser forward reopens modal**

1. After Test 4 completed
2. Click browser forward button
3. **Verify:** URL gets `?task=:id` back, modal reopens with the same task data

- [ ] **Step 7: User runs Test 6 — back stack does NOT pollute**

1. Open a row's modal for task A
2. Without closing, click row B (URL updates to `?task=B-id`)
3. Click row C
4. Click browser back button TWICE
5. **Verify:** first back closes the modal (returns to clean `/tasks`); second back navigates AWAY from `/tasks` to whatever was before. NOT through B-modal → A-modal. This confirms `Location.replaceState` (not `pushState`).

- [ ] **Step 8: User runs Test 7 — "+ New task" modal flow**

1. Click "+ New task" button
2. **Verify:** modal appears immediately, no skeleton, no page-width jump
3. Click Cancel
4. **Verify:** modal closes immediately, URL drops `?new=task`

- [ ] **Step 9: If all 7 tests pass — propose commit**

Stage only the 5 files modified:

```bash
git -C /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 add \
  src/app/modules/case-management/components/tasks-page/views/task-view/task-view.component.ts \
  src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.ts \
  src/app/modules/case-management/components/tasks-page/tasks-page.component.ts \
  src/app/modules/case-management/components/tasks-page/new-task-modal/new-task-modal.component.ts \
  src/app/modules/case-management/components/tasks-page/tasks-state.service.ts
```

Show the user the proposed commit message:

```
fix(frontend): /tasks modal opens via Location.replaceState — skip global preloader

Modal opens (and "+ New task" modal opens) on /tasks no longer fire
NavigationStart, which means the global preloader (subscribed to
Router.events) no longer overlays the page on every row click. Modal
state propagates via TasksStateService.selectedId$ + newTaskOpen$;
the URL bar updates via History API for deep-link + back/forward.

The view-switcher chips (?view=...) keep router.navigate — switching
to Pipeline/Workload IS a real navigation that should show the
preloader if data is being re-fetched.
```

Wait for explicit user "commit" approval per CLAUDE.md before running `git commit`.

- [ ] **Step 10: After user approval — commit**

Run:

```bash
git -C /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 commit -m "$(cat <<'EOF'
fix(frontend): /tasks modal opens via Location.replaceState — skip global preloader

Modal opens (and "+ New task" modal opens) on /tasks no longer fire
NavigationStart, which means the global preloader (subscribed to
Router.events) no longer overlays the page on every row click. Modal
state propagates via TasksStateService.selectedId$ + newTaskOpen$;
the URL bar updates via History API for deep-link + back/forward.

The view-switcher chips (?view=...) keep router.navigate — switching
to Pipeline/Workload IS a real navigation that should show the
preloader if data is being re-fetched.
EOF
)"
```

Verify with:

```bash
git -C /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 log -1 --stat | head -15
```

Expected: 5 files changed, modest line count (~50 lines insertions across 5 files).

---

## Self-Review

### Spec coverage

| Spec section | Plan task |
|---|---|
| Replace `router.navigate` with `Location.replaceState` in `selectTask` | Task 1 |
| Replace `router.navigate` with `Location.replaceState` in drawer `close()` | Task 2 |
| Replace `router.navigate` with `Location.replaceState` in `openNewTaskModal()` | Task 3 |
| Replace `router.navigate` with `Location.replaceState` in `new-task-modal.close()` | Task 4 (4C) |
| New-task-modal must still know when to open (no longer via queryParamMap) | Task 4A + 4B + 4C: state-based signal `newTaskOpen$` |
| Initial deep-link path stays as a real navigation | Verified by Test 3 — initial activation goes through Angular Router unchanged |
| Browser back/forward path | Verified by Tests 4, 5, 6 — Location service emits popstate; queryParamMap fires; state syncs |
| View-switcher (`?view=`) keeps `router.navigate` | Task 3 Step 4 explicitly verifies this is unchanged |
| 7-step manual test plan | Task 5 |

### Placeholder scan

Searched for "TBD", "TODO", "implement later", "appropriate error handling", "fill in details", "similar to". None found in this plan. The two `// ← NEW` and `// ← ADD` comments inside code blocks are step-direction annotations for the engineer, not placeholders for missing content.

### Type consistency

- `state.select(id: number | null)` and `state.selectedId` already exist in `TasksStateService` (added during Phase D follow-up).
- `state.setNewTaskOpen(open: boolean)`, `state.newTaskOpen$`, and `state.newTaskOpen` are added in Task 4A and used consistently in Tasks 4B and 4C.
- `location.replaceState(url: string)` from `@angular/common` — same API in all 4 places.
- `router.createUrlTree(commands, extras)` returns a `UrlTree` and `router.serializeUrl(tree)` returns a string — same usage pattern in all 4 places.
- All four uses build the URL with `relativeTo: this.route` so each component's URL is correctly relative to its own route.

### Scope check

Single focused fix. Modest line count. Test plan verifies behavior the spec requires. No decomposition needed — the entire fix fits one implementation pass + one commit.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-06-tasks-modal-no-preloader.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task (Tasks 1, 2, 3, 4 each), I verify between, then we run the user manual test pass (Task 5).

**2. Inline Execution** — I execute tasks in this session via `superpowers:executing-plans`, batched with checkpoints for review.

**Which approach?**

> Either way, the **commit gate is yours**: I will not run `git commit` until you confirm the manual test plan (Task 5 steps 2–8) all pass.
