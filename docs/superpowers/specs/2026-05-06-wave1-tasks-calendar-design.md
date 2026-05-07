# Wave 1 Redesign — Tasks &amp; Calendar

**Date:** 2026-05-06
**Scope:** Frontend redesign of `/case-management/tasks` (canonicalized to `/tasks`) and `/legal/calendar`. Each page ships three view modes (cases-page pattern) backed by a shared drawer / modal.
**Type:** Multi-view redesign + IA cleanup + light backend extensions for new view-specific features.
**Predecessor:** Cases-page redesign (D1 Power Table) — established the multi-view + shared drawer pattern this spec builds on.
**Successor:** Wave 2 (Documents + Signatures), batched separately.
**Reference artifacts:**
- HTML preview: `.superpowers/brainstorm/20220-1777837309/content/wave1-tasks-calendar-redesign-options.html`
- Page inventory + roadmap: `.superpowers/brainstorm/20220-1777837309/content/page-inventory-roadmap.html`
- Design tokens (locked): `.superpowers/brainstorm/20220-1777837309/content/rox-official.html`
- Visual benchmark (live): `/legal/cases` and its component at `src/app/modules/legal/components/case/case-list/`

---

## Goal

Bring Tasks and Calendar — the two highest-touch surfaces after Cases — to parity with the cases-page redesign. Both pages adopt the **multi-view** pattern: a single page, three lenses on the same data, one drawer/modal underneath. Pick the lens that fits your role; the underlying data model is the same.

For Tasks, the three lenses are:
- **Inbox** — flat, time-sorted list (default for attorney / paralegal)
- **Pipeline** — kanban by status (default for manager)
- **Workload** — grouped by assignee with capacity bar (default for partner)

For Calendar, the three lenses are:
- **Classic** — month/week/day grid colored by case (default for all roles)
- **Deadlines** — grid + persistent deadline track surfacing statute clocks and court dates as tier-coded countdowns
- **Time-blocked** — week timeline that fuses calendar events with billable time-entries

Visual style is locked to the existing rox/legience design system. No new tokens, no new colors, no new typography. The cases page is the consistency benchmark.

---

## Non-goals

- No changes to `/case-management/dashboard` or its overlap with Tasks (separate concern, deferred).
- No redesign of the per-case task drawer at `/tasks/:caseId` — that surface is covered by the case-detail redesign track.
- No redesign of the task creation/edit form (the existing form works; it gets re-skinned at a later phase).
- No new design tokens or color additions. Status colors, surfaces, accent variants are already defined in `rox-official.html`.
- No mobile-specific redesign — desktop-first, with responsive collapse identical to the cases page (sidebar hides &lt;1100px, kanban becomes 2-up &lt;1100px, etc.).
- No changes to the existing event-reminder testing surface (`reminder-test`) or deadline-analytics dashboards inside the Calendar component — they are reachable from the Calendar but not part of the redesign for this batch.
- No third-party integrations changes (Outlook/Google sync, BoldSign, etc.) — they continue to work as today.

---

## User profile

The redesign serves three distinct personas. Each persona maps to a default view, but every persona can switch and persist their pick.

| Persona | Default Tasks view | Default Calendar layout | Why |
|---|---|---|---|
| Attorney (PI / litigation / family / criminal) | Inbox | Classic | "What should I be doing right now?" — answered fastest by a flat time-sorted list. Calendar is a calendar. |
| Paralegal / secretary | Inbox | Classic | Same as attorney — they clear assigned work and schedule appointments. |
| Manager / department head | Pipeline | Classic | "Who is stuck?" — bottlenecks are visible immediately on a kanban. |
| Managing partner / senior partner | Workload | Classic | "Who is overloaded? Who can take more?" — capacity bars surface this in one glance. |
| Litigation-heavy attorneys (anyone whose cases drive deadline risk) | Inbox | **Deadlines** | Statute clocks must be impossible to miss. Auto-elevated when they have ≥1 active deadline-type event. |
| Billable-target attorneys (firms with utilization targets) | Inbox | **Time-blocked** | Calendar and time-tracking collapse to one action. Opt-in via user preference. |

Defaults are applied on first visit. Subsequent visits restore the user's last selection (per page, per device, persisted to user preferences).

---

## Design system reference

All visual primitives are sourced from the existing rox/legience system:

- **Tokens:** `rox-official.html` defines the 14 base tokens + Legience extensions (success green, accent variants, surface aliases, motion, z-index, ringed avatar).
- **Component primitives reused:** `.btn`, `.btn-primary`, `.chip` (active/inactive), `.pill` + status variants, `.case-pill`, `.av-ringed`, `.app-shell` (sidebar + main), `.page-head`, `.filter-bar`, `.mockup-content` shells. All are already established in the cases-page redesign — this spec adds zero new primitives.
- **New SCSS classes (page-scoped, not global):** Tasks page introduces `.t-list`, `.t-board`, `.t-workload` and shared `.t-drawer`. Calendar page introduces `.cal-classic`, `.cal-deadlines`, `.cal-timeblock`, `.cal-modal`. All scoped to their respective component files; no leakage to global stylesheets.
- **Icons:** `lucide-angular` (matches the new dashboard module's icon system per project memory). Existing pages on `ri-*` (Remix) stay as-is.

---

## Tasks page

### Information architecture

- **Canonical route:** `/tasks` (new, top-level).
- **Existing route:** `/case-management/tasks` continues to function, redirects to `/tasks` with view + filter state preserved.
- **Per-case route:** `/tasks/:caseId` continues to function unchanged; it's a filtered embed of the same component.
- **Sidebar nav:** the "Tasks" nav item moves under the "Daily" group alongside Dashboard / Cases / Calendar / Messages. The "Case management" subgroup loses its Tasks entry but keeps Dashboard and Assignments.

### View modes (3)

A chip group in the page header (top-right of `.page-head`) switches between the three views. Active chip highlights with `--legience-accent-bg-subtle` background. Switching does **not** unmount the data; it changes the rendering layer only.

#### Inbox view (`?view=inbox`)

Flat, time-grouped list optimized for clearing your queue.

- **Groups (top → bottom):** Overdue · Today · This week · Later · No due date. Group headers show count.
- **Row columns** (8 visible at desktop): selection checkbox (16px), title, case-pill, priority-pill, due-date, assignee ringed avatar, row-action menu (`⋯`).
- **Row hover:** `--legience-bg-row-hover` background; cursor pointer.
- **Row click:** opens drawer (route-driven — see State below).
- **Filter bar:** "All / Mine / Assigned" segmented chip + Case ▾, Priority ▾, Due ▾ dropdowns + "Compact" density toggle on the right.
- **Selection model:** click a checkbox enters multi-select mode; bulk action bar slides up from the bottom (matches cases-page pattern).
- **Empty state:** "No tasks. Nice work." centered with subtle illustration; "+ New task" button below.

#### Pipeline view (`?view=pipeline`)

Kanban with four columns, drag-and-drop status changes.

- **Columns (left → right):** Open · In progress · Blocked · Done. Each column has a header (name, count badge, "+" to add) and a footer (count + total estimated hours).
- **Blocked column:** subtle red tint (`rgba(242,65,73,0.04)`); count badge picks up `--legience-danger` color.
- **Card content:** title, case-pill, priority-pill, optional blocker-reason chip (Blocked column only), footer row with due-date + assignee ringed avatar.
- **Active card highlight:** when a card is the currently-open drawer subject, it gets a 2px accent ring.
- **Drag-and-drop:** uses Angular CDK Drag-Drop. On drop, the task's `status` field updates via the existing PATCH endpoint. Optimistic UI; on failure, card snaps back and a toast surfaces the error.
- **Filter bar:** All cases ▾, Assignee ▾, Priority ▾. Status filter does **not** appear here — the columns *are* the status filter.
- **Done column:** shows the most recent 3 done tasks; "+5 more · show all" expands. Older done tasks are hidden by default to keep the column readable.

#### Workload view (`?view=workload`)

Grouped by assignee, capacity-aware, manager-oriented.

- **Group structure:** one collapsible group per assignee. Group header is a single row with: ringed avatar (lg), name + role, task count, capacity bar (200px wide, with allocated/target hours label), capacity status pill, expand/collapse caret.
- **Capacity bar tiers:** ≤80% green (`--legience-success`), 80–100% warning (`--legience-warning`), &gt;100% danger (`--legience-danger`). Label text follows the same color tier.
- **Capacity computation:** sum of `estimatedHours` on tasks with status ∈ {Open, InProgress, Blocked} and `dueDate` within the current week. Compared against `weeklyCapacityHours` on the user (default 40, configurable per user).
- **Task rows under each group:** indented 36px from the left; fewer columns than Inbox (no checkbox in workload — bulk operations stay in Inbox/Pipeline).
- **Filter bar:** All teams / by team chips + Capacity ▾ + "⚠ Over capacity only" toggle.
- **Sort order:** assignees sorted by capacity utilization descending — over-capacity people surface first.

### Drawer (unified, conditional sections)

A single right-side drawer covers all three views. The drawer is route-driven: `/tasks?view=...&task=:id` opens it; closing pops `&task=` off.

**Always visible:**
- Header: priority pill + title + close (`✕`).
- 2x2 grid: Case · Due · Assignee · Status.
- Description (full text, multiline).
- Subtasks section with checkboxes + "+ Add" button; shows "X of Y" count.
- Attachments section: chip-style file pills.
- Time logged section: total hours + per-entry log + "▶ Start timer" button.
- Comments section: avatar + author + timestamp + body, "Add comment" input at bottom.
- Activity history (collapsed by default).

**Status-driven conditional section (visible regardless of view):**
- When `status = Blocked`, a "Why blocked?" callout renders inline below the metadata grid: red-tinted box with the `blockerReason` text + optional `autoUnblockDate`. Editable from this callout. Visible in Inbox, Pipeline, and Workload drawers — because it's a property of the task, not the view.

**View-driven conditional sections:**
- **Pipeline view active:** prominent four-segment status changer (Open / In progress / Blocked / Done) at the **top** of the drawer (above the metadata grid). Click a segment to update status; if Blocked is selected and `blockerReason` is empty, the editor focuses the blocker-reason callout. The status-changer is the Pipeline-specific affordance; the same status field can still be edited via the standard Status field in other views, just without the prominent at-top widget.
- **Workload view active:** "⚖ Reassign to balance load" call-to-action box appears between the metadata grid and the description. It lists 3 attorneys with available capacity (sorted by lowest utilization first). One-click reassign moves the task and creates an activity log entry. Below the standard sections, an "Assignee history" section shows previous assignees with hours-on-task per person.

The view-driven conditional sections are driven by `?view=...` query state — switching views in the background updates the drawer's visible sections live. (This avoids the user having to close and reopen the drawer to see the right context.) The status-driven conditional section (the blocker callout) updates whenever the task's status changes, regardless of view.

### URL / state model

- **Active view:** `?view=inbox|pipeline|workload`. Defaults applied on first visit per persona; subsequent visits restore last-selected view from user preferences.
- **Filter state:** `?case=...&priority=...&due=...&team=...` (multi-value via comma-join). Filters persist across view switches when applicable.
- **Drawer state:** `&task=:id` opens the drawer for that task. Removing the param closes the drawer.
- **Compact density (Inbox only):** `&density=compact|comfortable`. Default comfortable.
- **Bulk select:** in-memory only (not URL-encoded) — selection clears on view switch or page reload.

### Data model implications

The redesign surfaces new fields. Most are additive.

| Field | Type | Existing? | Used by |
|---|---|---|---|
| `Task.status` | enum: `Open`, `InProgress`, `Blocked`, `Done` | partially — confirm enum values match | Pipeline columns, status pill |
| `Task.estimatedHours` | decimal | confirm exists | Pipeline column footer total, Workload capacity calc |
| `Task.blockerReason` | string (nullable) | NEW | Pipeline Blocked column inline chip, drawer "Why blocked?" field |
| `Task.autoUnblockDate` | date (nullable) | NEW | Drawer "Why blocked?" field |
| `User.weeklyCapacityHours` | int (default 40) | NEW (org admin–configurable) | Workload capacity bar |
| `Task.assigneeHistory` | array of `{userId, fromDate, toDate, hoursLogged}` | derived from existing audit log | Workload drawer "Assignee history" section |

The `weeklyCapacityHours` field needs a small admin surface for setting it per user — out of scope for batch 1; default to 40 for everyone in phase 1 of Workload, add admin UI in phase 2.

---

## Calendar page

### Layout modes (3)

A chip group in the page header (top-right) switches between layouts. The existing Day/Week/Month time-range toggle stays in the calendar toolbar one row below — it's orthogonal to layout choice.

> **Naming note:** to avoid collision with the existing Day/Week/Month "view" toggle, the three new modes are called **layouts** in the URL and UI. The chip group label says "Layout".

#### Classic layout (`?layout=classic`)

Standard month grid with case-color events.

- **Toolbar:** prev / Today / next + Day-Week-Month toggle + "+ New event".
- **Side rail:** "My calendars" — checkbox list of cases, toggle visibility per case. Case-color swatch + case name. Excluded cases dim their events (do not hide entirely; user feedback from cases-page brainstorm preferred dim-not-hide).
- **Grid:** 7-column month grid. Day cells show day number + up to 3 event chips (4th+ collapse to "+N more" link). Today cell highlights the day number with `--legience-accent` background.
- **Event chip styles:** filled (e.g. `c1-event-blue`) for confirmed events, tinted (e.g. `c1-event-tinted-blue`) for soft-due / all-day deadlines surfaced in this layout.
- **Click behavior:** click an event opens the unified modal. Click an empty day creates a new event with date pre-filled.

#### Deadlines layout (`?layout=deadlines`)

Same grid as Classic + persistent deadline track on top.

- **Deadline track:** sticky horizontal strip below the toolbar, above the grid. Shows the next 30/60/90-day deadlines as horizontal cards (220px wide each, scrollable).
- **Tier system (left border + badge):** `tier-statute` (red, 3px border) · `tier-court` (orange) · `tier-soft` / firm-internal (yellow).
- **Card content:** countdown (e.g. "14 days") + label + case + tier badge.
- **Sort order:** by tier first (statute → court → soft), then by ascending date. Most-urgent statute clocks always lead the strip.
- **Track grid integration:** deadline-type events render as **deadline pins** in their day cell (small filled bar with `STATUTE` / `COURT` / `SOFT` text). Pins replace the standard event chip rendering for events of `eventType=deadline`.
- **Side rail:** tier filter checkboxes (Statute / Court / Soft) — control track + grid pin visibility together.

#### Time-blocked layout (`?layout=time-block`)

Day or week timeline with billable-aware blocks.

- **Default time range:** Week (Mon–Fri). Day toggle available.
- **Side rail:** "Today" billable progress (large numeric "5.4 / 8.0 h" + bar) → "This week" cumulative (24.5 / 40 h) → quick stats (cases worked, avg block size, top case) → quick-add buttons (+ Billable / + Non-billable / + Court / Event).
- **Time grid:** 60px hour column on the left + day columns. Slots are 30-minute high (50px each at default). Drag from one slot to another creates a new block of `eventType=time-block`.
- **Block types (visual variants):**
  - `block-billable` — accent-colored, soft fill (`--legience-accent-bg-subtle`); ⚖ icon + activity-code in subtitle.
  - `block-non-billable` — info violet, soft fill; e.g. team standup, internal meetings.
  - `block-event` — warning yellow, soft fill; depositions, court appearances, client meetings (events that aren't time-blocks).
- **Drag-create flow:** drag selects a slot range; on release, the unified modal opens with `eventType=time-block` pre-set, billable toggle ON by default, time pre-filled. Save creates the calendar event AND a draft time-entry (see Modal section).

### Event modal (unified, event-type-aware)

A single modal serves all three layouts. The `eventType` field drives which conditional sections render.

**Always visible:**
- Header: type pill (`Meeting` / `Statute` / `Court` / `Soft` / `Billable`) + title + close.
- Title field.
- Date + time-range fields (side-by-side).
- Location field.
- Linked case field (case-picker).
- Attendees field (multi-user picker with ringed avatars).
- Notes field (multiline).
- Reminders field (default reminders for the event-type).
- Action bar at bottom: Cancel · Delete (edit mode) · Save.

**Conditional sections:**
- **`eventType=deadline`:** an orange/red callout at the top showing "⚠ Statute clock — N days remaining" (for statute) or equivalent for court/soft. Tier dropdown (Statute / Court / Soft). Hard-date field (separate from time — deadlines are date-only). Source/authority field (free text — e.g. "MA Gen. Laws Ch. 260 §4"). Reminder cascade builder (a structured editor for the multi-tier email/SMS schedule). Required action field (free text). Action bar shows "Mark filed" instead of "Save changes" when the deadline is approaching.
- **`eventType=time-block`:** an accent-colored callout at the top with the **billable toggle switch** + a live preview of the time-entry that will be created on save ("1.5 h × $450/h = $675"). Activity-code dropdown (linked to the firm's activity-code library). Rate dropdown (defaults to user's standard rate, override if needed). Multiplier dropdown (1.0× normal, 1.5× rush, 2.0× court appearance, etc.). "Description (will appear on invoice)" multiline field. Action bar shows three buttons: Cancel · Save as event only · **Save event + time-entry** (primary).
- **`eventType=meeting`** (default): no extra sections. The basics-only modal that Classic layout users see most often.

### URL / state model

- **Active layout:** `?layout=classic|deadlines|time-block`.
- **Time range (within layout):** `?view=day|week|month` — name reused from existing calendar component for backwards compatibility with prior URLs.
- **Active date:** `?date=YYYY-MM-DD` — defaults to today.
- **Tier filters (Deadlines only):** `?tiers=statute,court,soft`.
- **Modal open state:** `&event=:id` (existing event) or `&new=time-block&start=...&end=...` (new event with type/range pre-filled).

### Data model implications

| Field | Type | Existing? | Used by |
|---|---|---|---|
| `CalendarEvent.eventType` | enum: `meeting`, `deadline`, `time-block` | NEW (existing events default to `meeting`) | Modal section visibility, grid pin/chip rendering |
| `CalendarEvent.deadlineTier` | enum: `statute`, `court`, `soft` (nullable) | NEW | Deadline track sort + color, modal callout severity |
| `CalendarEvent.sourceAuthority` | string (nullable) | NEW | Deadline modal source field |
| `CalendarEvent.requiredAction` | string (nullable) | NEW | Deadline modal action field |
| `CalendarEvent.reminderCascade` | array of `{daysBefore, channel, recipientGroup}` | NEW (extends existing single-reminder model) | Deadline modal cascade builder + cron-like reminder engine |
| `CalendarEvent.billable` | bool (nullable) | NEW | Time-block modal toggle |
| `CalendarEvent.activityCodeId` | FK → activity_code (nullable) | NEW | Time-block modal activity-code dropdown |
| `CalendarEvent.rateOverride` | decimal (nullable) | NEW | Time-block modal rate field |
| `CalendarEvent.rateMultiplier` | decimal (default 1.0) | NEW | Time-block modal multiplier field |
| `CalendarEvent.linkedTimeEntryId` | FK → time_entry (nullable) | NEW | Two-way link when "Save event + time-entry" is used |
| `User.preferredCalendarLayout` | enum (default `classic`) | NEW user preference | Restoring last-used layout on visit |
| `User.weeklyBillableTargetHours` | decimal (default 8.0/day × 5 = 40.0) | NEW | Time-blocked side-rail target |

The `reminderCascade` engine is the heaviest backend addition — it needs a cron-like job (or the existing scheduled-task engine) that walks all events with `eventType=deadline` daily, computes which cascade entries fire today, and dispatches via the existing notification service.

The `linkedTimeEntryId` two-way link means: editing the time-block in the calendar updates the time-entry; deleting the time-entry orphans the calendar event (it remains as a non-billable block).

---

## Phasing

Each page ships its **default view first**. Other views are flag-gated and roll out in subsequent phases.

### Phase 1 — Default views ship (~3 weeks)

- **Tasks**: Inbox view + unified drawer (with all "always visible" sections + the status-driven blocker callout). View-driven conditional sections (Pipeline status-changer, Workload reassign) are coded but feature-flagged off.
- **Tasks schema:** `Task.blockerReason` and `Task.autoUnblockDate` fields ship in phase 1 because the status-driven blocker callout depends on them. Tasks can be set to Blocked via the standard Status field even before the Pipeline view ships.
- **Tasks**: `/tasks` route added; `/case-management/tasks` redirects.
- **Calendar**: Classic layout + unified event modal (with `eventType=meeting` only — deadline / time-block sections behind feature flag).
- **Calendar**: Side rail "My calendars" with case-toggle behavior.
- **Cross-cutting**: rox/legience styling applied; existing data flows through to the new chrome.

### Phase 2 — Pipeline view + Deadlines layout (~2-3 weeks)

- **Tasks**: Pipeline view enabled (with drag-drop status updates). Drawer's Pipeline-specific status-changer affordance becomes visible when `?view=pipeline`. (The blocker callout itself was already in phase 1.)
- **Calendar**: Deadlines layout, `eventType=deadline` events fully supported, deadline track + tier model + reminder cascade engine.
- **Cross-cutting**: feature flag enables view chip in headers.

### Phase 3 — Workload view + Time-blocked layout (~2-3 weeks)

- **Tasks**: Workload view, `User.weeklyCapacityHours` field + small admin UI for org admins to set per-user capacity, drawer's "Workload conditional section" (reassign action + assignee history) active.
- **Calendar**: Time-blocked layout, `eventType=time-block` events with billable toggle / activity-code / rate / multiplier, two-way link to time-entries, side-rail billable progress.
- **Cross-cutting**: persona-based default views activate (managers see Pipeline by default, partners see Workload).

Phases are independently shippable — phase 2 can ship without phase 3, etc.

---

## Files affected (new + modified)

### Tasks page

**New:**
- `src/app/modules/case-management/components/tasks/tasks-page.component.{ts,html,scss}` — single component hosting all 3 views and the unified drawer.
- `src/app/modules/case-management/components/tasks/views/inbox-view.component.{ts,html,scss}` — inbox-specific rendering.
- `src/app/modules/case-management/components/tasks/views/pipeline-view.component.{ts,html,scss}` — kanban + drag-drop.
- `src/app/modules/case-management/components/tasks/views/workload-view.component.{ts,html,scss}` — capacity-aware grouped view.
- `src/app/modules/case-management/components/tasks/task-drawer/task-drawer.component.{ts,html,scss}` — unified drawer with conditional sections.

**Modified:**
- `src/app/app-routing.module.ts` (or equivalent) — add `/tasks` canonical route alongside `/case-management/tasks` redirect.
- `src/app/modules/case-management/case-management-routing.module.ts` — redirect `/tasks` → canonical.
- Sidebar nav component — move Tasks under "Daily" group.
- Backend `Task` model + endpoints — add `blockerReason`, `autoUnblockDate` fields. `User` model — add `weeklyCapacityHours`. Audit-log query for `assigneeHistory` derivation.

### Calendar page

**New:**
- `src/app/modules/legal/components/calendar/layouts/classic-layout.component.{ts,html,scss}`
- `src/app/modules/legal/components/calendar/layouts/deadlines-layout.component.{ts,html,scss}`
- `src/app/modules/legal/components/calendar/layouts/time-block-layout.component.{ts,html,scss}`
- `src/app/modules/legal/components/calendar/event-modal/event-modal.component.{ts,html,scss}` — unified modal with conditional sections (replaces existing event-modal component or extends it; TBD by implementation).
- `src/app/modules/legal/components/calendar/event-modal/sections/deadline-section.component.{ts,html,scss}`
- `src/app/modules/legal/components/calendar/event-modal/sections/time-block-section.component.{ts,html,scss}`

**Modified:**
- `src/app/modules/legal/components/calendar/calendar-view/calendar-view.component.*` — refactored to host the layout switcher and delegate rendering to one of the three layout components.
- Backend `CalendarEvent` model + endpoints — add the new fields listed in the data-model table.
- `ReminderCascade` engine — new background-job logic (or extension to existing scheduled-task service) for tier-aware multi-channel reminders.
- `User` preferences — add `preferredCalendarLayout`, `weeklyBillableTargetHours`.

### Out of scope files (explicitly NOT touched)

- `src/app/modules/legal/components/calendar/reminder-test/**` — internal test surface, untouched.
- `src/app/modules/legal/components/calendar/deadline-analytics/**` — separate dashboard, untouched.
- `src/app/modules/case-management/components/case-management-dashboard/**` — overlaps Tasks but is its own concern; deferred.
- `src/app/component/dashboards/attorney/**` — Wave 1 dashboard work was already shipped (commit 257d907).

---

## Database migrations

All schema changes follow the project's PostgreSQL Flyway migration convention (see CLAUDE.md). Per the existing memory, latest migration is V72 on `origin/develop`; this batch will start at V73 (verify before writing).

Migration files needed (one or more — TBD by implementation plan):
- Add `blocker_reason TEXT NULL`, `auto_unblock_date DATE NULL` to `task` table.
- Add `weekly_capacity_hours INT DEFAULT 40` to `user` table.
- Add `event_type` enum + column to `calendar_event` (`meeting`, `deadline`, `time-block`); existing rows default to `meeting`.
- Add `deadline_tier` enum + nullable column.
- Add `source_authority TEXT NULL`, `required_action TEXT NULL`.
- New `event_reminder_cascade` table: `(id, calendar_event_id, days_before, channel, recipient_group)`.
- Add `billable BOOL NULL`, `activity_code_id BIGINT NULL FK`, `rate_override NUMERIC(10,2) NULL`, `rate_multiplier NUMERIC(4,2) DEFAULT 1.0`, `linked_time_entry_id BIGINT NULL FK` to `calendar_event`.
- Add `preferred_calendar_layout VARCHAR(20) DEFAULT 'classic'`, `weekly_billable_target_hours NUMERIC(4,1) DEFAULT 40.0` to `user_preference` (or `user`).

Per project memory, every migration must use PostgreSQL syntax (no MySQL-isms) and be idempotent (`IF NOT EXISTS` etc.). After creating migration files, also run the SQL manually on local dev per CLAUDE.md.

---

## Tenant-safety review

Per CLAUDE.md: every new backend query must include `organization_id` filter. The new fields above are stored on `task`, `calendar_event`, `user`, and `user_preference` — all of which already carry `organization_id`. The new `event_reminder_cascade` table will inherit org-scoping by joining through `calendar_event.organization_id` (no separate column needed). The reminder cascade engine must filter by organization when dispatching to avoid cross-tenant notifications.

---

## Verification checklist

The implementation phase will need to confirm:

1. **Visual parity:** new Tasks/Calendar surfaces match the cases page in token usage, primitive styles, and density. Specifically: padding scale, hairline border thickness, ringed-avatar pattern, pill variants, button shadows.
2. **View switching:** changing `?view=` (Tasks) or `?layout=` (Calendar) updates the rendering layer instantly without reloading data; user preference persists; URL is shareable.
3. **Drawer parity:** opening the drawer in Inbox view vs Pipeline view shows the right conditional sections (status-changer in Pipeline, reassign in Workload). Live-updates when the user switches view in the background.
4. **Modal parity:** event modal renders the right sections based on `eventType`. Deadline modal exposes the cascade builder. Time-block modal creates a draft time-entry on save.
5. **Capacity math (Workload):** a task estimated at 4h, due Tuesday, assigned to Alice with weeklyCapacityHours=20 → contributes 20% to her bar. Tasks with status=Done don't contribute. Tasks due next week don't contribute to this week's bar.
6. **Drag-drop (Pipeline):** dragging Card-A from "In progress" to "Blocked" calls PATCH `/api/tasks/:id` with `status=Blocked`. On 5xx, card snaps back, toast surfaces error. On success, optimistic UI persists.
7. **Tenant filter:** every new endpoint (capacity calc, deadline cascade, reassign action) filters by `organization_id`. Verified by integration test against a two-org fixture.
8. **Migrations idempotent:** running V73+ twice succeeds. Verified by `flyway:repair` + re-migrate locally.
9. **Existing routes:** `/case-management/tasks` redirects cleanly with state preserved. `/legal/calendar` continues to work for users on phase 1 (Classic only).
10. **Feature flag staging:** Pipeline + Workload + Deadlines + Time-block all sit behind flags before phase 2/3 rollout. Phase 1 users see only Inbox + Classic.

UI parts of (1)–(6) require a running dev server and manual browser walkthroughs per CLAUDE.md ("type checking and test suites verify code correctness, not feature correctness"). Backend parts of (7)–(10) can be unit + integration tested.

---

## Open questions (to resolve during implementation planning)

1. **Drawer or sidesheet?** The cases-page drawer uses a right-aligned overlay with backdrop. The Tasks drawer matches. Should the Calendar event modal also adopt a side-aligned sheet on wide screens (instead of a centered modal)? Right-aligned drawers are easier to use one-handed but harder for long forms (deadline cascade builder). **Recommendation: keep modal centered for now, revisit if user feedback suggests otherwise.**

2. **Default capacity (Workload):** is 40h/week the right org-wide default for `weeklyCapacityHours`? Some firms run 30h, some 50h. Phase 3 should expose this in admin settings; phase 1 hardcodes 40.

3. **Deadline source authority free-text vs jurisdiction-aware:** the spec uses a free-text field. A future enhancement could pull from a jurisdiction-aware library (e.g. MA statute lookups). **Out of scope for batch 1.**

4. **Time-block save semantics:** does "Save event + time-entry" create the time-entry as draft (user reviews before submitting for billing) or submitted? **Recommendation: draft by default.** User can confirm-on-save with a checkbox.

5. **Audit log surfacing:** the drawer's "Activity history" pulls from existing audit logs. Confirm the audit log captures field-level changes for tasks (status, assignee, blocker-reason) — if not, those need to be added.

6. **Mobile (deferred but flagging):** at &lt;1100px, the kanban collapses to 2-up; at &lt;720px, the multi-view chip group hides and the page falls back to Inbox view only (matches the cases-page mobile pattern).

7. **`/case-management/dashboard` overlap:** that page has Manager-oriented views that overlap Workload. Roadmap notes it overlaps `/legal/cases` too. Whether it gets folded into Tasks Workload or kept as a separate dashboard is **not in this spec's scope** but should be revisited after phase 3 ships.

---

## Reference artifacts (linked at top, repeated for completeness)

- HTML preview (3 directions per page, side-by-side): `.superpowers/brainstorm/20220-1777837309/content/wave1-tasks-calendar-redesign-options.html`
- Roadmap context: `.superpowers/brainstorm/20220-1777837309/content/page-inventory-roadmap.html`
- Locked design tokens: `.superpowers/brainstorm/20220-1777837309/content/rox-official.html`
- Visual benchmark (live): `/legal/cases` and `src/app/modules/legal/components/case/case-list/`
- Cases-page brainstorm precedent (multi-view + drawer pattern): `.superpowers/brainstorm/20220-1777837309/content/cases-page-redesign-options.html`
