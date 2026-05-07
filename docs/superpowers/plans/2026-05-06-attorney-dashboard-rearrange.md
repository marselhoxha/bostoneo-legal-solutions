# Attorney Dashboard Rearrangement + Ghost-Button Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorder existing 11 cards on the attorney dashboard to action-first flow (Triage → Calendar → Decisions → Intel → Context), and fix the `.rox-btn-ghost` rule so the modal Close button and Today's Schedule Availability button render visibly at rest.

**Architecture:** Pure layout reflow inside `attorney-dashboard.component.html` — cards are kept as black boxes and moved between `<div class="row g-3">` blocks. One SCSS rule edit at line 4172. No controller (`.ts`) changes. No new components.

**Tech Stack:** Angular 17, Bootstrap 5 grid (`col-xxl-* col-xl-*`), SCSS with `--legience-*` design tokens.

**Spec:** [`docs/superpowers/specs/2026-05-06-attorney-dashboard-rearrange-design.md`](../specs/2026-05-06-attorney-dashboard-rearrange-design.md)

**Working directory:** `/Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1` (parent repo, branch `develop`). Per project rules: do NOT work in a Claude worktree for this. Edit develop directly.

**Commits:** Phase-level only. Two commits planned (one per task). Confirm with user before each `git commit`.

---

## File Structure

| File | Change | Lines | Responsibility |
|------|--------|-------|----------------|
| `src/app/component/dashboards/attorney/attorney-dashboard.component.scss` | Modify | 4172–4179 only | Make `.rox-btn-ghost` visible at rest via hairline border. |
| `src/app/component/dashboards/attorney/attorney-dashboard.component.html` | Modify | 67–114, 117–212 boundary, 214–228 boundary, 426–638 | Reflow rows: move Urgent Items, Appointment Requests, Reschedule Requests, Client Communication to new positions. |

**Files NOT touched:** `attorney-dashboard.component.ts`, all card components rendered by the dashboard, all modal components, `personal-injury-dashboard.component.*`, `practice-area-outlet.*`. Confirm via `git status --short` showing only the two files above modified.

---

## Task 1: CSS Fix — `.rox-btn-ghost` Visible at Rest

**Files:**
- Modify: `src/app/component/dashboards/attorney/attorney-dashboard.component.scss:4172-4179`
- Verify: live dashboard at `http://localhost:4200/dashboards/attorney`

**Pre-checks:**

- [ ] **Step 1.1: Confirm working tree**

Run:
```bash
git -C /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 branch --show-current
```
Expected: `develop`

- [ ] **Step 1.2: Read the current rule**

Use `Read` tool on `src/app/component/dashboards/attorney/attorney-dashboard.component.scss` lines 4170–4200. Confirm the `.rox-btn-ghost` block currently reads:

```scss
&.rox-btn-ghost {
  background: transparent;
  color: var(--legience-text-secondary);
  &:hover {
    background: var(--legience-bg-subtle);
    color: var(--legience-text-primary);
  }
}
```

If the markup differs (e.g. someone already added a border-color line), STOP and report. Do not blindly overwrite.

**Edit:**

- [ ] **Step 1.3: Apply the fix**

Use `Edit` tool with:

`old_string`:
```scss
  &.rox-btn-ghost {
    background: transparent;
    color: var(--legience-text-secondary);
    &:hover {
      background: var(--legience-bg-subtle);
      color: var(--legience-text-primary);
    }
  }
```

`new_string`:
```scss
  &.rox-btn-ghost {
    background: transparent;
    color: var(--legience-text-secondary);
    border-color: var(--legience-border-hairline);
    &:hover {
      background: var(--legience-bg-subtle);
      color: var(--legience-text-primary);
      border-color: var(--legience-border-emphasis);
    }
  }
```

(The base `.rox-btn` rule already declares `border: 1px solid transparent`, so we only override the color, not width or style.)

**Verify:**

- [ ] **Step 1.4: Wait for the dev server to recompile**

If the dev server is running, give it ~5 seconds to pick up the SCSS change. Otherwise tell the user to start it (per project rule we don't run `npm run build` ourselves).

- [ ] **Step 1.5: Visual verification — Availability button**

Open `http://localhost:4200/dashboards/attorney` in the user's Chrome (via the chrome MCP if available). Take a screenshot focused on the Today's Schedule header (top of the schedule band). Confirm:
- "Availability" button has a visible 1-px hairline border at rest (not just text)
- Hover the button — border becomes slightly stronger / fill appears

If "Availability" still looks like plain text, suspect SCSS hot-reload missed; ask user to hard-refresh.

- [ ] **Step 1.6: Visual verification — Close button**

Click any event in Today's Schedule (e.g. a Client meeting block). The event details modal opens. Confirm in the modal footer:
- "Close" renders as a button with a hairline border at rest
- "Open in calendar" still renders as the existing secondary button (unchanged)
- "Go to case" (if present) still renders as the existing primary button (unchanged)

Close the modal.

**Commit gate:**

- [ ] **Step 1.7: Confirm with user before committing**

Tell user: "CSS fix verified for both Availability and Close buttons. Ready to commit Task 1?" — wait for explicit OK.

- [ ] **Step 1.8: Stage and commit (after user OK)**

```bash
git -C /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 add src/app/component/dashboards/attorney/attorney-dashboard.component.scss
git -C /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 status --short
```
Expected: only the SCSS file marked `M ` (single-letter, in the staged column).

```bash
git -C /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 commit -m "$(cat <<'EOF'
fix(dashboard): rox-btn-ghost visible at rest

Add hairline border at rest and emphasis border on hover so the
Today's Schedule Availability button and the event-details modal
Close button render as buttons instead of plain text.

Single rule change in attorney-dashboard.component.scss; no other
consumers of rox-btn-ghost exist in the codebase.
EOF
)"
```

Verify: `git log --oneline -1` shows the new commit.

---

## Task 2: HTML Rearrangement — 5-Row Action-First Layout

**Files:**
- Modify: `src/app/component/dashboards/attorney/attorney-dashboard.component.html`

**Pre-checks:**

- [ ] **Step 2.1: Re-read the dashboard HTML to confirm structure**

Use `Read` tool on `src/app/component/dashboards/attorney/attorney-dashboard.component.html`:
- Lines 67–115 (current Row 1 right column = Client Communication card + empty state)
- Lines 426–638 (current bottom right rail = Urgent Items + Appointment Requests + Reschedule Requests + trailing comments)

Confirm line numbers haven't drifted from the spec. If they have, recompute offsets before applying edits — DO NOT apply blindly.

- [ ] **Step 2.2: Open the dashboard in the browser for live comparison**

Keep `http://localhost:4200/dashboards/attorney` open in a Chrome tab. After each edit, refresh and visually compare against the spec's "New Layout" table.

---

### Edit A — Row 1 Right: Replace Client Comm with Urgent Items

The strategy: leave the existing `<div class="col-xxl-4 col-xl-5">` outer wrapper at line 74 in place; replace its inner contents (the Client Comm card + empty state) with the Urgent Items card markup (which we'll cut from the bottom right rail in Edit C).

- [ ] **Step 2.3: Replace Row 1 right column contents**

Use `Edit` tool with:

`old_string` (the full inner block of `col-xxl-4 col-xl-5` from line 75 through 113):
```html
          <div class="client-comm-health client-comm-health-hero h-100"
               *ngIf="!casesLoading && clientCommHealth.clients.length > 0">
            <div class="cch-header">
              <span class="cch-icon"><i class="ri-message-3-line"></i></span>
              <span class="cch-title">Client communication</span>
              <span class="cch-overdue" *ngIf="clientCommHealth.overdueCount > 0">
                {{ clientCommHealth.overdueCount }} overdue
              </span>
            </div>
            <div class="cch-list">
              <div *ngFor="let client of clientCommHealth.clients"
                   class="cch-item">
                <span class="cch-avatar" [style.background]="client.bg">{{ client.initials }}</span>
                <div class="cch-meta">
                  <div class="cch-name">{{ client.name }}</div>
                  <div class="cch-last">Last update {{ client.lastContactLabel }}</div>
                </div>
                <span class="cch-status" [ngClass]="'status-' + client.status">
                  {{ client.status === 'on-track' ? 'on track' : client.status }}
                </span>
              </div>
            </div>
            <div class="cch-action">
              <a href="javascript:void(0);" (click)="navigateTo('/clients')">
                View all clients <i class="ri-arrow-right-line align-middle ms-1"></i>
              </a>
            </div>
          </div>

          <!-- Empty state for new orgs with no client comm data yet -->
          <div class="client-comm-health client-comm-health-hero h-100"
               *ngIf="!casesLoading && clientCommHealth.clients.length === 0"
               style="display:flex; align-items:center; justify-content:center; padding: 32px 20px;">
            <div style="text-align:center;">
              <span class="cch-icon" style="margin: 0 auto 10px;"><i class="ri-message-3-line"></i></span>
              <strong style="display:block; font-size:14px; color:var(--legience-text-primary); margin-bottom:4px;">No client touchpoints yet</strong>
              <span style="font-size:12px; color:var(--legience-text-muted);">Communication health appears once you have active clients.</span>
            </div>
          </div>
```

`new_string` (Urgent Items card markup, copied verbatim from current lines 431–488 except the wrapper `<div class="card mb-3">` is kept and we drop the `mb-3` since the row above provides spacing):
```html
          <!-- Urgent Items — promoted from the bottom right rail to sit
               next to the Focus card so the two "what's burning right
               now" surfaces share above-the-fold real estate. -->
          <div class="card h-100 mb-0">
            <div class="card-header align-items-center d-flex">
              <h4 class="card-title mb-0 flex-grow-1">Urgent Items</h4>
              <div class="flex-shrink-0 d-flex align-items-center gap-2">
                <span class="badge bg-danger" *ngIf="urgentItems.length > 0">{{urgentItems.length}}</span>
                <span class="badge bg-success" *ngIf="urgentItems.length === 0">0</span>
              </div>
            </div>
            <div class="card-body p-0 d-flex flex-column">
              <div class="flex-grow-1" *ngIf="urgentItems.length > 0">
                <div *ngFor="let item of getVisibleUrgentItems(); let i = index"
                     class="d3-urgent-item"
                     (click)="onUrgentItemClick(item)">
                  <span class="d3-urgent-num"
                        [ngClass]="getD3UrgentNumModifier(item.priority)">
                    {{ i + 1 }}
                  </span>
                  <div class="d3-urgent-meta">
                    <div class="d3-urgent-title">{{item.title}}</div>
                    <div class="d3-urgent-sub">
                      <ng-container *ngIf="item.dueLabel">{{item.dueLabel}}</ng-container>
                      <ng-container *ngIf="item.dueLabel && (item.caseNumber || item.client)"> · </ng-container>
                      <ng-container *ngIf="item.caseNumber || item.client">{{item.caseNumber || item.client}}</ng-container>
                    </div>
                  </div>
                  <button type="button"
                          class="d3-urgent-cta"
                          (click)="onUrgentItemClick(item); $event.stopPropagation()">
                    {{ getD3UrgentCtaLabel(item) }}
                    <i-lucide name="arrow-right" [size]="12"></i-lucide>
                  </button>
                </div>
              </div>

              <div *ngIf="urgentItems.length === 0">
                <div class="urgent-empty-inline">
                  <span class="urgent-empty-icon">
                    <i class="ri-checkbox-circle-line"></i>
                  </span>
                  <div class="urgent-empty-meta">
                    <strong>All clear</strong>
                    <span>No urgent items right now.</span>
                  </div>
                </div>
              </div>

              <div class="text-center pt-3 mt-auto border-top" *ngIf="urgentItems.length > 4">
                <a href="javascript:void(0);" class="text-primary fs-13 fw-medium" (click)="toggleShowAllUrgentItems()">
                  <span *ngIf="!showAllUrgentItems">Show {{urgentItems.length - 4}} more <i class="ri-arrow-down-s-line align-middle"></i></span>
                  <span *ngIf="showAllUrgentItems">Show less <i class="ri-arrow-up-s-line align-middle"></i></span>
                </a>
              </div>
            </div>
          </div>
```

Note: changed `mb-3` → `mb-0` and added `h-100` so the card stretches to match the Focus card's height inside the Bootstrap row. The inner markup is byte-for-byte identical to the original Urgent Items card.

- [ ] **Step 2.4: Visual check — Row 1**

Refresh `http://localhost:4200/dashboards/attorney`. Confirm:
- Top row still 8/4: Focus card on left, Urgent Items on right
- Urgent Items renders the urgent-item rows (or "All clear" empty state if you're testing on an empty account)
- Client Communication card no longer visible anywhere on the dashboard yet (intentional — it's about to be inserted at the bottom)

The dashboard is in a transient broken state at this point — Client Comm is gone, and Urgent / Appt / Reschedule are still in the bottom right rail (so Urgent Items appears in two places briefly until Edit C). That's expected. **Do NOT commit between edits.**

---

### Edit B — Insert New Row 3 (Decisions) Between Today's Schedule and PA Outlet

- [ ] **Step 2.5: Insert the new Row 3 wrapper after Today's Schedule's closing tag**

Use `Edit` tool with:

`old_string` (the boundary between Today's Schedule and the practice-area outlet — find this exact span in the current file; lines 211–220):
```html
        </div>
      </div>

      <!-- Row 1.7: Practice-area lazy-loaded layer.
           Tabs moved out of the dashboard — the practice-area switcher now
           lives in the topbar (next to the Legience logo). The outlet
           projects the active practice area's module. State is shared
           through PracticeAreaContextService so the topbar pill and this
           outlet stay in sync. -->
      <ng-container *ngIf="practiceAreas$ | async as practiceAreas">
```

`new_string`:
```html
        </div>
      </div>

      <!-- Row 3: DECISIONS — pending appointment + reschedule requests
           promoted from the bottom right rail. Each card already has its
           own *ngIf on data presence + loading state; this row's wrapper
           checks the union so the entire row collapses out when neither
           has anything to show. Inner cols dynamically span 6 (both
           populated) or 12 (only one populated). -->
      <div class="row g-3"
           *ngIf="pendingAppointments.length > 0 || loadingPendingAppointments
                || pendingRescheduleRequests.length > 0 || loadingRescheduleRequests">
        <div [ngClass]="(pendingRescheduleRequests.length > 0 || loadingRescheduleRequests)
                        ? 'col-xxl-6 col-xl-6' : 'col-xxl-12 col-xl-12'"
             *ngIf="pendingAppointments.length > 0 || loadingPendingAppointments">
          <div class="appt-action-card appt-action-card-warning mb-0">
            <div class="appt-action-head">
              <span class="appt-action-icon"><i class="ri-calendar-todo-line"></i></span>
              <div class="appt-action-meta">
                <h4>Appointment requests</h4>
                <span class="appt-action-sub">Clients waiting for your confirmation</span>
              </div>
              <span class="appt-action-count" *ngIf="pendingAppointmentsCount > 0">
                {{ pendingAppointmentsCount }}
              </span>
              <button type="button" class="appt-action-refresh" (click)="loadPendingAppointments()" title="Refresh">
                <i class="ri-refresh-line"></i>
              </button>
            </div>
            <div class="appt-action-body">
              <div *ngIf="loadingPendingAppointments" class="appt-loading">
                <div class="spinner-border spinner-border-sm text-warning" role="status"></div>
                <p>Loading requests…</p>
              </div>

              <div *ngIf="!loadingPendingAppointments && pendingAppointments.length > 0">
                <div *ngFor="let appt of pendingAppointments.slice(0, 3)" class="d3-req">
                  <span class="d3-req-avatar"
                        [style.background]="getClientAvatarBg(appt.clientName)">
                    {{ getClientInitials(appt.clientName || 'Client') }}
                  </span>
                  <div class="d3-req-meta">
                    <span class="d3-req-name">{{ appt.clientName || 'Client' }}</span>
                    <span class="d3-req-detail">
                      {{ formatAppointmentDate(appt.preferredDatetime) }}
                      ·
                      {{ formatAppointmentTime(appt.preferredDatetime) }}
                      <ng-container *ngIf="appt.appointmentType">
                        · {{ getAppointmentTypeLabel(appt.appointmentType) }}
                      </ng-container>
                    </span>
                  </div>
                  <div class="d3-req-cluster">
                    <button type="button"
                            class="d3-pill-btn danger"
                            (click)="openDeclineModal(appt)">
                      Decline
                    </button>
                    <button type="button"
                            class="d3-pill-btn primary"
                            (click)="openApproveModal(appt)">
                      Accept
                    </button>
                  </div>
                </div>
              </div>

              <div class="appt-view-all" *ngIf="pendingAppointments.length > 3">
                <a href="javascript:void(0)" (click)="navigateTo('/legal/calendar')">
                  View all {{ pendingAppointments.length }} requests <i class="ri-arrow-right-line align-middle ms-1"></i>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div [ngClass]="(pendingAppointments.length > 0 || loadingPendingAppointments)
                        ? 'col-xxl-6 col-xl-6' : 'col-xxl-12 col-xl-12'"
             *ngIf="pendingRescheduleRequests.length > 0 || loadingRescheduleRequests">
          <div class="appt-action-card appt-action-card-info mb-0">
            <div class="appt-action-head">
              <span class="appt-action-icon"><i class="ri-calendar-2-line"></i></span>
              <div class="appt-action-meta">
                <h4>Reschedule requests</h4>
                <span class="appt-action-sub">Time-change requests from clients</span>
              </div>
              <span class="appt-action-count" *ngIf="pendingRescheduleCount > 0">
                {{ pendingRescheduleCount }}
              </span>
              <button type="button" class="appt-action-refresh" (click)="loadPendingRescheduleRequests()" title="Refresh">
                <i class="ri-refresh-line"></i>
              </button>
            </div>
            <div class="appt-action-body">
              <div *ngIf="loadingRescheduleRequests" class="appt-loading">
                <div class="spinner-border spinner-border-sm text-info" role="status"></div>
                <p>Loading requests…</p>
              </div>

              <div *ngIf="!loadingRescheduleRequests && pendingRescheduleRequests.length > 0">
                <div *ngFor="let appt of pendingRescheduleRequests.slice(0, 3)" class="d3-req">
                  <span class="d3-req-avatar orange">
                    {{ getClientInitials(appt.clientName || 'Client') }}
                  </span>
                  <div class="d3-req-meta">
                    <span class="d3-req-name">{{ appt.clientName || 'Client' }}</span>
                    <span class="d3-req-detail">
                      Move
                      <s>{{ formatRescheduleTime(appt.originalConfirmedTime || appt.confirmedDatetime) }}</s>
                      → {{ formatRescheduleTime(appt.requestedRescheduleTime) }}
                    </span>
                  </div>
                  <div class="d3-req-cluster">
                    <button type="button"
                            class="d3-pill-btn danger"
                            (click)="openRescheduleDeclineModal(appt)">
                      Decline
                    </button>
                    <button type="button"
                            class="d3-pill-btn primary"
                            (click)="openRescheduleApproveModal(appt)">
                      Approve
                    </button>
                  </div>
                </div>
              </div>

              <div class="appt-view-all" *ngIf="pendingRescheduleRequests.length > 3">
                <a href="javascript:void(0)" (click)="navigateTo('/legal/calendar')">
                  View all {{ pendingRescheduleRequests.length }} reschedule requests <i class="ri-arrow-right-line align-middle ms-1"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Row 1.7: Practice-area lazy-loaded layer.
           Tabs moved out of the dashboard — the practice-area switcher now
           lives in the topbar (next to the Legience logo). The outlet
           projects the active practice area's module. State is shared
           through PracticeAreaContextService so the topbar pill and this
           outlet stay in sync. -->
      <ng-container *ngIf="practiceAreas$ | async as practiceAreas">
```

The `mb-0` on the inner `appt-action-card` replaces the previous `mb-3` because spacing now comes from the parent `<div class="row g-3">`.

- [ ] **Step 2.6: Visual check — Row 3**

Refresh dashboard. Confirm:
- A new "Decisions" row appears between Today's Schedule and the AI Insights cards.
- If your test user has pending appointments AND reschedule requests → both cards render side-by-side at 6/6.
- If your test user has only one of them → the populated card spans full width.
- If your test user has neither → the row is invisible (`*ngIf` collapses it; the AI Insights row appears directly under Today's Schedule).
- The cards still appear in the OLD bottom right rail too (duplicated). Edit C will remove them from the rail.

---

### Edit C — Replace Bottom Right Rail with Client Communication Only

- [ ] **Step 2.7: Replace the bottom right rail's contents with the Client Communication card**

Use `Edit` tool with the COMPLETE `old_string` and `new_string` below.

`old_string` (the full inner content of `<div class="col-xxl-4 col-xl-5">` — Urgent Items + Appointment Requests + Reschedule Requests + trailing comments, exactly as it appears at lines 427–636):
```html
          <!-- Urgent Items — first in the rail because it's the most
               action-oriented signal. Was previously paired with Schedule
               in its own row (Row 4); moved here so all action/attention
               cards live in one continuous column. -->
          <div class="card mb-3">
            <div class="card-header align-items-center d-flex">
              <h4 class="card-title mb-0 flex-grow-1">Urgent Items</h4>
              <div class="flex-shrink-0 d-flex align-items-center gap-2">
                <span class="badge bg-danger" *ngIf="urgentItems.length > 0">{{urgentItems.length}}</span>
                <span class="badge bg-success" *ngIf="urgentItems.length === 0">0</span>
              </div>
            </div>
            <div class="card-body p-0 d-flex flex-column">
              <!-- Direction 3: numbered priority badge (1/2/3) replaces
                   "High/Med/Low" pill — implicit ordering. Red = high/critical,
                   yellow = medium, violet = low. CTA on the right is type-driven
                   (Open/Prep/Review/Follow up). -->
              <div class="flex-grow-1" *ngIf="urgentItems.length > 0">
                <div *ngFor="let item of getVisibleUrgentItems(); let i = index"
                     class="d3-urgent-item"
                     (click)="onUrgentItemClick(item)">
                  <span class="d3-urgent-num"
                        [ngClass]="getD3UrgentNumModifier(item.priority)">
                    {{ i + 1 }}
                  </span>
                  <div class="d3-urgent-meta">
                    <div class="d3-urgent-title">{{item.title}}</div>
                    <div class="d3-urgent-sub">
                      <ng-container *ngIf="item.dueLabel">{{item.dueLabel}}</ng-container>
                      <ng-container *ngIf="item.dueLabel && (item.caseNumber || item.client)"> · </ng-container>
                      <ng-container *ngIf="item.caseNumber || item.client">{{item.caseNumber || item.client}}</ng-container>
                    </div>
                  </div>
                  <button type="button"
                          class="d3-urgent-cta"
                          (click)="onUrgentItemClick(item); $event.stopPropagation()">
                    {{ getD3UrgentCtaLabel(item) }}
                    <i-lucide name="arrow-right" [size]="12"></i-lucide>
                  </button>
                </div>
              </div>

              <div *ngIf="urgentItems.length === 0">
                <div class="urgent-empty-inline">
                  <span class="urgent-empty-icon">
                    <i class="ri-checkbox-circle-line"></i>
                  </span>
                  <div class="urgent-empty-meta">
                    <strong>All clear</strong>
                    <span>No urgent items right now.</span>
                  </div>
                </div>
              </div>

              <div class="text-center pt-3 mt-auto border-top" *ngIf="urgentItems.length > 4">
                <a href="javascript:void(0);" class="text-primary fs-13 fw-medium" (click)="toggleShowAllUrgentItems()">
                  <span *ngIf="!showAllUrgentItems">Show {{urgentItems.length - 4}} more <i class="ri-arrow-down-s-line align-middle"></i></span>
                  <span *ngIf="showAllUrgentItems">Show less <i class="ri-arrow-up-s-line align-middle"></i></span>
                </a>
              </div>
            </div>
          </div>

          <!-- Pending Appointment Requests — promoted to second-from-top
               in the rail because clients waiting on attorney confirmation
               is high-priority action. Was previously buried at the bottom
               of the rail where attorneys couldn't see it without
               scrolling. -->
          <div class="appt-action-card appt-action-card-warning mb-3"
               *ngIf="pendingAppointments.length > 0 || loadingPendingAppointments">
            <div class="appt-action-head">
              <span class="appt-action-icon"><i class="ri-calendar-todo-line"></i></span>
              <div class="appt-action-meta">
                <h4>Appointment requests</h4>
                <span class="appt-action-sub">Clients waiting for your confirmation</span>
              </div>
              <span class="appt-action-count" *ngIf="pendingAppointmentsCount > 0">
                {{ pendingAppointmentsCount }}
              </span>
              <button type="button" class="appt-action-refresh" (click)="loadPendingAppointments()" title="Refresh">
                <i class="ri-refresh-line"></i>
              </button>
            </div>
            <div class="appt-action-body">
              <div *ngIf="loadingPendingAppointments" class="appt-loading">
                <div class="spinner-border spinner-border-sm text-warning" role="status"></div>
                <p>Loading requests…</p>
              </div>

              <!-- Direction 3: pill-button decision strip. Avatar + name +
                   date/time on one row, Decline (danger) + Accept (primary)
                   pills clustered at the right. -->
              <div *ngIf="!loadingPendingAppointments && pendingAppointments.length > 0">
                <div *ngFor="let appt of pendingAppointments.slice(0, 3)" class="d3-req">
                  <span class="d3-req-avatar"
                        [style.background]="getClientAvatarBg(appt.clientName)">
                    {{ getClientInitials(appt.clientName || 'Client') }}
                  </span>
                  <div class="d3-req-meta">
                    <span class="d3-req-name">{{ appt.clientName || 'Client' }}</span>
                    <span class="d3-req-detail">
                      {{ formatAppointmentDate(appt.preferredDatetime) }}
                      ·
                      {{ formatAppointmentTime(appt.preferredDatetime) }}
                      <ng-container *ngIf="appt.appointmentType">
                        · {{ getAppointmentTypeLabel(appt.appointmentType) }}
                      </ng-container>
                    </span>
                  </div>
                  <div class="d3-req-cluster">
                    <button type="button"
                            class="d3-pill-btn danger"
                            (click)="openDeclineModal(appt)">
                      Decline
                    </button>
                    <button type="button"
                            class="d3-pill-btn primary"
                            (click)="openApproveModal(appt)">
                      Accept
                    </button>
                  </div>
                </div>
              </div>

              <div class="appt-view-all" *ngIf="pendingAppointments.length > 3">
                <a href="javascript:void(0)" (click)="navigateTo('/legal/calendar')">
                  View all {{ pendingAppointments.length }} requests <i class="ri-arrow-right-line align-middle ms-1"></i>
                </a>
              </div>
            </div>
          </div>

          <!-- Reschedule Requests — also high-priority client action,
               sits below Pending Appointments. -->
          <div class="appt-action-card appt-action-card-info mb-3"
               *ngIf="pendingRescheduleRequests.length > 0 || loadingRescheduleRequests">
            <div class="appt-action-head">
              <span class="appt-action-icon"><i class="ri-calendar-2-line"></i></span>
              <div class="appt-action-meta">
                <h4>Reschedule requests</h4>
                <span class="appt-action-sub">Time-change requests from clients</span>
              </div>
              <span class="appt-action-count" *ngIf="pendingRescheduleCount > 0">
                {{ pendingRescheduleCount }}
              </span>
              <button type="button" class="appt-action-refresh" (click)="loadPendingRescheduleRequests()" title="Refresh">
                <i class="ri-refresh-line"></i>
              </button>
            </div>
            <div class="appt-action-body">
              <div *ngIf="loadingRescheduleRequests" class="appt-loading">
                <div class="spinner-border spinner-border-sm text-info" role="status"></div>
                <p>Loading requests…</p>
              </div>

              <!-- Direction 3: same pill-button strip as appointment requests
                   but with the avatar tinted orange (the spec's accent for
                   reschedule). The detail line uses <s> on the old time
                   followed by the new time, mirroring the preview's
                   `Move <s>Thu 9am</s> → Thu 3pm` pattern. -->
              <div *ngIf="!loadingRescheduleRequests && pendingRescheduleRequests.length > 0">
                <div *ngFor="let appt of pendingRescheduleRequests.slice(0, 3)" class="d3-req">
                  <span class="d3-req-avatar orange">
                    {{ getClientInitials(appt.clientName || 'Client') }}
                  </span>
                  <div class="d3-req-meta">
                    <span class="d3-req-name">{{ appt.clientName || 'Client' }}</span>
                    <span class="d3-req-detail">
                      Move
                      <s>{{ formatRescheduleTime(appt.originalConfirmedTime || appt.confirmedDatetime) }}</s>
                      → {{ formatRescheduleTime(appt.requestedRescheduleTime) }}
                    </span>
                  </div>
                  <div class="d3-req-cluster">
                    <button type="button"
                            class="d3-pill-btn danger"
                            (click)="openRescheduleDeclineModal(appt)">
                      Decline
                    </button>
                    <button type="button"
                            class="d3-pill-btn primary"
                            (click)="openRescheduleApproveModal(appt)">
                      Approve
                    </button>
                  </div>
                </div>
              </div>

              <div class="appt-view-all" *ngIf="pendingRescheduleRequests.length > 3">
                <a href="javascript:void(0)" (click)="navigateTo('/legal/calendar')">
                  View all {{ pendingRescheduleRequests.length }} reschedule requests <i class="ri-arrow-right-line align-middle ms-1"></i>
                </a>
              </div>
            </div>
          </div>

          <!-- Risk Alerts and Cross-Matter Intelligence sections moved
               out of this rail in Phase 6. They now live inside the
               PersonalInjuryDashboard layer rendered by
               <app-practice-area-outlet> above the 8/4 body row, so they
               are scoped to the active practice area instead of the whole
               dashboard. -->

          <!-- Client Communication Health was moved out of this rail and
               into the hero right column (replacing the KPI tile stack)
               so it has full prominence. -->

          <!-- Pending Appointment Requests + Reschedule Requests moved up
               in the rail (now sit right after Urgent Items) so client-action
               cards are immediately visible without scrolling. -->
```

`new_string`:
```html
          <!-- Client Communication Health — demoted from the hero right
               column to the bottom right rail. Above-the-fold real estate
               there now goes to Urgent Items. Comm health is passive
               reference info; partners scanning relationship health
               typically scroll regardless. Urgent Items + Pending
               Appointments + Reschedule Requests are now in Rows 1 and 3. -->
          <div class="client-comm-health client-comm-health-hero h-100"
               *ngIf="!casesLoading && clientCommHealth.clients.length > 0">
            <div class="cch-header">
              <span class="cch-icon"><i class="ri-message-3-line"></i></span>
              <span class="cch-title">Client communication</span>
              <span class="cch-overdue" *ngIf="clientCommHealth.overdueCount > 0">
                {{ clientCommHealth.overdueCount }} overdue
              </span>
            </div>
            <div class="cch-list">
              <div *ngFor="let client of clientCommHealth.clients"
                   class="cch-item">
                <span class="cch-avatar" [style.background]="client.bg">{{ client.initials }}</span>
                <div class="cch-meta">
                  <div class="cch-name">{{ client.name }}</div>
                  <div class="cch-last">Last update {{ client.lastContactLabel }}</div>
                </div>
                <span class="cch-status" [ngClass]="'status-' + client.status">
                  {{ client.status === 'on-track' ? 'on track' : client.status }}
                </span>
              </div>
            </div>
            <div class="cch-action">
              <a href="javascript:void(0);" (click)="navigateTo('/clients')">
                View all clients <i class="ri-arrow-right-line align-middle ms-1"></i>
              </a>
            </div>
          </div>

          <!-- Empty state for new orgs with no client comm data yet -->
          <div class="client-comm-health client-comm-health-hero h-100"
               *ngIf="!casesLoading && clientCommHealth.clients.length === 0"
               style="display:flex; align-items:center; justify-content:center; padding: 32px 20px;">
            <div style="text-align:center;">
              <span class="cch-icon" style="margin: 0 auto 10px;"><i class="ri-message-3-line"></i></span>
              <strong style="display:block; font-size:14px; color:var(--legience-text-primary); margin-bottom:4px;">No client touchpoints yet</strong>
              <span style="font-size:12px; color:var(--legience-text-muted);">Communication health appears once you have active clients.</span>
            </div>
          </div>
```

**Note on robustness:** the `old_string` above is ~210 lines but should match uniquely on the parent develop tree. If `Edit` reports a no-match error, run `Read` on lines 427–636 first, copy the result verbatim into a fresh Edit call, and try again. If still failing (e.g. someone landed an unrelated commit on develop that touched this region), STOP and re-orient — do not start patching subsections piecemeal.

**Verify:**

- [ ] **Step 2.8: Full visual sweep**

Refresh `http://localhost:4200/dashboards/attorney` and scroll the entire page. Confirm the order matches the spec:

1. Row 1 (8/4): Focus card | Urgent Items
2. Row 2 (12): Today's Schedule (with Availability + Open calendar buttons — both styled as buttons after Task 1's CSS fix)
3. Row 3 (6/6 or 12): Appointment Requests | Reschedule Requests — only visible if data
4. Row 4 (12): PI AI Insights → Risk Alerts → Cross-Matter Intel (rendered by `<app-practice-area-outlet>`)
5. Row 5 (8/4): My Ongoing Cases (top) + Recent Activity (bottom) | Client Communication

No card should appear twice anywhere on the page.

- [ ] **Step 2.9: Empty-state spot-checks**

If the test user has data, also test:
- An attorney account with `urgentItems: []` → Row 1 right shows "All clear / No urgent items right now"
- An attorney account with no pending appointments and no reschedules → Row 3 disappears entirely; PA outlet sits directly under Today's Schedule
- (Skip if no such test data exists; note in the commit body that empty-state was visually-only checked.)

- [ ] **Step 2.10: Regression check — interactions**

Quick smoke test:
- Click an event in Today's Schedule → modal opens → "Close" button styled correctly → click Close → modal dismisses
- Click "Availability" → availability settings modal opens → close it
- If Appointment Requests visible: click Accept on one — verify the approval modal opens (does not need to be submitted; just confirm wiring)
- Click into a case from My Ongoing Cases → navigates to case detail
- Click Open in Calendar → navigates to /legal/calendar

- [ ] **Step 2.11: `git status` sanity**

```bash
git -C /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 status --short
```

Expected: only `attorney-dashboard.component.html` (and the already-committed SCSS from Task 1 should not appear). Other unrelated WIP files (e.g. backend Java files, `app.component.ts`, `topbar/`, etc.) remain unstaged.

If the diff somehow includes other files, STOP and audit before staging.

**Commit gate:**

- [ ] **Step 2.12: Confirm with user before committing**

Tell user: "Dashboard layout reflowed and verified across all 5 rows. Ready to commit Task 2?" — wait for explicit OK.

- [ ] **Step 2.13: Stage and commit (after user OK)**

```bash
git -C /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 add src/app/component/dashboards/attorney/attorney-dashboard.component.html
git -C /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 status --short
```
Expected: only the HTML file marked `M ` in the staged column.

```bash
git -C /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 commit -m "$(cat <<'EOF'
feat(dashboard): action-first attorney dashboard layout

Reorder existing 11 cards into Triage -> Calendar -> Decisions ->
Intel -> Context flow:

- Row 1 (8/4): Focus card | Urgent Items (promoted from bottom rail)
- Row 2 (12):  Today's Schedule (unchanged)
- Row 3 (6/6): Appointment + Reschedule Requests (new band, *ngIf
  collapses when both empty; populated card spans 12 when alone)
- Row 4 (12):  Practice-area outlet (unchanged)
- Row 5 (8/4): My Cases + Recent Activity | Client Communication
  (demoted from hero right)

Card content, click handlers, and empty-state markup unchanged. No
TS controller changes. Spec at docs/superpowers/specs/2026-05-06-
attorney-dashboard-rearrange-design.md.
EOF
)"
```

Verify: `git log --oneline -2` shows both Task 1 and Task 2 commits in order.

---

## Post-Completion

- [ ] **Step F.1: Tell user what shipped**

Summary: "Two commits on develop. Task 1 = `.rox-btn-ghost` CSS fix (`<commit-hash-1>`). Task 2 = HTML layout reflow (`<commit-hash-2>`). Push to `origin/develop` is NOT done — confirm before pushing."

- [ ] **Step F.2: Do NOT push without explicit user permission**

Per project rules: never push without explicit OK. If user wants to push:
```bash
git -C /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 push origin develop
```

---

## Risks & Mitigations (carried from spec)

- **Edit tool uniqueness on large blocks:** if a single Edit fails because the `old_string` matches multiple times or doesn't match exactly, split into smaller successive Edits and verify each via `Read` at the affected offset.
- **Line-number drift:** the spec was written 2026-05-06 against the current parent develop tree; if any other commit lands first, re-run Step 2.1 and adjust offsets before applying edits.
- **Dev server stale:** Angular HMR sometimes misses SCSS reloads on first save. If visual verification shows no change, hard-refresh (Cmd+Shift+R).
- **Cards look sparse at 6-col:** noted in spec; fallback is to stack at 12-col each. Out of scope for this plan; track as a follow-up if it lands ugly.

## Out of Scope

- Any controller (`.ts`) changes
- New cards, removed cards, redesigned cards
- Changes inside the practice-area outlet (PI module)
- AI-synthesized "single thing to focus on" feature (was option D in brainstorm — descoped)
- Per-persona dashboard variants (descoped — single layout for all three)
