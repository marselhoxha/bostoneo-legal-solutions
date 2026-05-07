# Tasks Modal — Skip Global Preloader on Open/Close

**Date:** 2026-05-06
**Scope:** Frontend only — `/tasks` page modal-open and modal-close URL handling.
**Type:** Surgical bug fix.
**Predecessor:** Wave 1 Phase D follow-up (the modal/cache/filters/workflows commit, currently uncommitted).

---

## Problem

Clicking a row on `/tasks` opens the task drawer/modal. Even though the modal renders synchronously from the in-memory cache (`state.select()` fires sync, my JS-driven measurement was 38ms), the **user perceives a full-page refresh + skeleton flash** every time:

1. Rows shift / page width jumps when modal mounts.
2. A page-wide skeleton appears for ~200ms before the modal arrives.

### Root cause

`src/app/app.component.ts` lines 82–105 subscribes to `Router.events`:

```ts
this.router.events.subscribe((event) => {
  if (event instanceof NavigationStart) {
    if (!this.isExcludedRoute(event.url)) {
      this.preloaderService.show();    // ← full-page skeleton mounts
    }
  } else if (event instanceof NavigationEnd /* … */) {
    setTimeout(() => this.preloaderService.hide(), 200);
  }
});
```

`<app-preloader>` is a fixed-position overlay that renders a full-page skeleton (topbar + logo + content blocks) — it covers everything during navigation, removes the scrollbar, and stays visible for 200ms after navigation ends.

The `selectTask()` row-click handler (and `close()` and the `"+ New task"` modal open/close) all call `this.router.navigate([], { queryParams: { task: id }, queryParamsHandling: 'merge' })`. Even though that's a *same-route, query-param-only* update, Angular Router fires NavigationStart → the preloader shows → the perceived "refresh" happens.

The "rows shift / page width changes" symptom is the same root cause: when the preloader mounts as a fixed overlay, the page beneath gets its scrollbar gutter pulled out by whatever scroll-lock the preloader applies, which reflows the visible row width by ~16px.

**Modal-open is not a navigation. It should not invoke Angular Router.** Updating the URL bar (for deep-linking + browser back/forward) is fine, but it should happen via the browser History API directly, not via Router.

---

## Goal

Open/close the task modal and the "+ New task" modal **without firing Angular Router navigation events**, so the global preloader stays inactive. URL bar still updates for deep-link persistence and browser back/forward navigation.

Success criteria (test plan at the bottom):
1. Clicking a row → modal appears immediately, no skeleton flash, no page-width jump.
2. URL bar updates to `/tasks?task=:id`.
3. Pasting `/tasks?task=:id` directly opens the modal on that task (initial deep-link still works).
4. Browser back button → `?task=` removed from URL → modal closes.
5. Browser forward button → `?task=` re-added → modal reopens.
6. Refreshing the page (F5) on `/tasks?task=:id` → page loads with the modal open (initial deep-link).

---

## Design

Replace `Router.navigate(...)` with `Location.replaceState(...)` (from `@angular/common`) in **four places** that touch the modal-open URL contract. Everything else stays identical.

### Why `Location.replaceState`

- Same internal Location object Angular Router uses, so URL state stays consistent for `ActivatedRoute.snapshot.queryParams` reads.
- Updates the URL via `history.replaceState()` natively — no NavigationStart/End/Cancel events fire.
- `Location.replaceState` (vs `Location.go`): `replaceState` does NOT push a new entry onto the browser history stack — clicking a row, then closing, then clicking another row should not pollute the back stack with intermediate states. We use `replaceState` to overwrite the current entry each time.
- Browser back/forward: PopStateEvent still fires, the Location service still emits its own change events, and Angular Router's already-subscribed PopStateEvent handler re-syncs ActivatedRoute correctly. The `tasks-page.component.ts` queryParamMap subscription continues to fire on browser-driven URL changes — which is what we want for back/forward.

### Files to change (4 places)

| File | Change |
|---|---|
| `src/app/modules/case-management/components/tasks-page/views/task-view/task-view.component.ts` | Inject `Location`. In `selectTask(task)`, replace the `router.navigate(...)` call with a `location.replaceState(serializedUrl)` call. The synchronous `state.select(task.id)` stays as-is (still drives the modal sync). |
| `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.ts` | Inject `Location`. In `close()`, replace `router.navigate(...)` with `location.replaceState(...)`. The synchronous `state.select(null)` stays. |
| `src/app/modules/case-management/components/tasks-page/tasks-page.component.ts` | Inject `Location`. In `openNewTaskModal()`, replace `router.navigate(...)` with `location.replaceState(...)`. |
| `src/app/modules/case-management/components/tasks-page/new-task-modal/new-task-modal.component.ts` | Inject `Location`. In `close()`, replace `router.navigate(...)` with `location.replaceState(...)`. |

No other files change. No services are added or modified. No template or SCSS changes.

### Exact code shape

The pattern is the same in all four places. Build the URL via `router.createUrlTree()` (so query-params-handling and relative-route logic are still honored), serialize it, and pass to `location.replaceState()`.

```ts
import { Location } from '@angular/common';

constructor(
  private route: ActivatedRoute,
  private router: Router,
  private location: Location,
  // … existing
) {}

selectTask(task: CaseTask): void {
  if (task?.id != null) this.state.select(task.id);

  // Update URL via History API — no Angular Router navigation, no NavigationStart event.
  const tree = this.router.createUrlTree([], {
    relativeTo: this.route,
    queryParams: { task: task.id },
    queryParamsHandling: 'merge',
  });
  this.location.replaceState(this.router.serializeUrl(tree));
}
```

`close()` mirrors:

```ts
close(): void {
  this.state.select(null);
  const queryParams = { ...this.route.snapshot.queryParams };
  delete queryParams['task'];
  delete queryParams['focus'];
  const tree = this.router.createUrlTree([], { relativeTo: this.route, queryParams });
  this.location.replaceState(this.router.serializeUrl(tree));
}
```

`openNewTaskModal()` and `new-task-modal.close()` follow the same shape with their respective query params (`new=task` add/remove).

### What stays unchanged

- `TasksStateService.selectedId$` is still the single source of truth that drives the drawer rendering.
- `tasks-page.component.ts.ngOnInit` still subscribes to `route.queryParamMap` — this fires on **initial deep-link** (page load with `?task=` in URL) and on **browser back/forward** PopStateEvents. Both still call `state.select(id)` for sync.
- The view-switcher chip group (`?view=inbox|pipeline|workload`) keeps using `router.navigate` because switching views is a *legitimate* navigation that should show the preloader if data is being re-fetched. Out of scope for this change.
- The drawer's content fetch (background `getTask(id)` after cache hit) is unchanged.

### Initial deep-link path (unchanged, called out explicitly)

When the user lands on `/tasks?task=147` cold:
1. Angular Router activates the `tasks` route normally — preloader fires once, but that's expected/correct on initial load.
2. `tasks-page.component.ts.ngOnInit` reads `route.queryParamMap.snapshot` and synchronously calls `state.select(147)`.
3. Drawer's subscription to `state.selectedId$` fires → cache miss (first load) → background `getTask(147)` → modal renders when fetch resolves.

This path is unchanged. Only same-page modal opens/closes after the page is loaded use `Location.replaceState`.

### Browser back/forward path

1. User has `/tasks?task=147` open with modal showing.
2. User clicks browser back.
3. Browser fires PopStateEvent. URL becomes `/tasks` (the previous entry, written before any modal opens).
4. Angular's Location service emits a "popstate" change event; ActivatedRoute observes the URL change; queryParamMap fires.
5. `tasks-page.ngOnInit`'s queryParamMap subscription sees `task=null` → calls `state.select(null)` → drawer subscription emits null → drawer closes.

Same flow in reverse for forward button. `Location.replaceState` (vs `pushState`) means we don't accumulate intermediate URL entries from rapid row clicks — the back button always takes the user back to the URL state from before they entered the modal flow. Cleaner UX than push-on-every-click.

---

## Out of scope

- View-switcher (`?view=`) navigation. That stays as `router.navigate` because switching to Pipeline or Workload is a real "this view might fetch new data" semantic.
- The list-view UX redesign (in-row progression, subtasks, time logged) — separate brainstorm/spec.
- Pipeline + Workload view implementations — separate plans.
- Any change to `app.component.ts` preloader logic — the preloader itself is fine for legitimate navigations; we just stop calling it for modal opens.
- Mobile / responsive treatment.
- Any drift fixes already covered by the prior Phase D follow-up commit.

---

## Files NOT modified

- `src/app/app.component.ts` (preloader logic intact)
- `src/app/component/preloader/*` (no change to skeleton component)
- `TasksStateService` (no API change — still uses `select(id)` / `selectedId$`)
- Tasks routing module (no route config change)
- Any backend file (zero backend impact)
- Any of the three pipes added in Phase D follow-up (`priorityToTone`, `dueLabel`, `userInitials`, `statusToTone`)

---

## Test plan (manual — run before any commit)

The user runs each step in their browser. I verify with screenshots only after they confirm.

1. **Open modal — no skeleton flash.** Navigate to `/tasks`. Wait for full load. Click any task row. **Expected:** modal appears immediately, no skeleton overlay, page rows behind the modal do not shift left/right when modal mounts. **Failure mode:** if the skeleton shows for any duration > 0, the fix didn't apply.

2. **Close modal — no skeleton flash.** With modal open from step 1, click the ✕ button or backdrop. **Expected:** modal closes immediately, URL bar drops `?task=`, no skeleton overlay during close.

3. **URL deep-link still works.** Navigate to `/tasks?task=:id` directly (paste in URL bar + Enter, OR open in a new tab). **Expected:** page loads with the modal already open and the task data visible. The preloader DOES appear once during the initial route activation — that's correct, it's a real navigation.

4. **Browser back closes modal.** Open modal (step 1). Click browser back button. **Expected:** URL drops `?task=`, modal closes (because tasks-page.queryParamMap subscription sees the change and calls `state.select(null)`).

5. **Browser forward reopens modal.** After step 4, click browser forward. **Expected:** URL gets `?task=:id` back, modal reopens with the same task data.

6. **Rapid row clicks don't pollute back stack.** Open modal on row A. Without closing, click row B (URL updates to `?task=B-id`). Click row C. Click browser back twice. **Expected:** first back closes the modal (returns to clean `/tasks`); second back navigates *away from `/tasks`* to whatever was before. **NOT expected:** A → B → C → back-to-B-modal → back-to-A-modal — that would mean we're using `pushState` instead of `replaceState`.

7. **"+ New task" modal flow.** Click the "+ New task" button. **Expected:** modal appears immediately, no skeleton. Click Cancel. **Expected:** modal closes immediately, URL drops `?new=task`.

If any of (1)–(7) fails, the fix is not complete and the bug is somewhere else than the preloader.

---

## Implementation cost

Tiny. ~5–10 lines per file × 4 files = ~30 line diff. ~30 minutes of work + 10 minutes for the manual test pass. Single bundled commit at the end of all 4 file edits.
