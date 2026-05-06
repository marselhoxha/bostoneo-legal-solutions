# Attorney Dashboard Rearrangement + Ghost-Button Fix

**Date:** 2026-05-06
**Scope:** `src/app/component/dashboards/attorney/attorney-dashboard.component.{html,scss}`
**Type:** Layout rearrangement (no new cards, no controller changes) + targeted CSS fix.

## Goal

Reorder the attorney dashboard so the cards an attorney needs **first** appear above the fold. Today the right of the hero (prime real estate) is occupied by `Client Communication` (passive reference info), while `Urgent Items` and `Appointment Requests` (action items requiring a decision) are buried in the bottom-row right rail. Rearrange the existing 11 cards to follow an attorney's mental flow: **Triage → Calendar → Decisions → Intel → Context.**

Bundle a CSS fix for `.rox-btn-ghost` — both the modal "Close" button (event details modal) and the Today's Schedule "Availability" button currently render as plain text because the rule sets `background: transparent` and inherits a transparent border, so nothing is visible at rest.

## Non-goals

- No new cards, no removed cards.
- No card content / behavior changes (titles, fields, click handlers, internal layout all preserved).
- No controller (`.ts`) changes.
- No changes inside the practice-area outlet — the PI module's internal card order (AI Insights → Risk Alerts → Cross-Matter Intel) is the PI module's concern, not the dashboard's.
- No new modals, no changes to existing modals (Availability, Approve, Decline, Reschedule, Event details).

## User profile this serves

A general-purpose layout that works for solo practitioner, associate, and managing/senior partner — confirmed by user. The action-first ordering (Triage → Calendar → Decisions → Intel → Context) maps to the questions every attorney asks when they sit down: "what's burning?" → "what's my day?" → "what needs my decision?" → "what's the AI flagged?" → "where am I overall?"

## Design

### New layout

| Row | Split | Left | Right | Notes |
|-----|-------|------|-------|-------|
| 1 — Triage | 8 / 4 | Focus card (`.dashboard-focus-card`) | Urgent Items (existing component, moved up) | Both sections answer "what's burning right now." |
| 2 — Calendar | 12 | Today's Schedule | — | Full-width band; unchanged from today's position. |
| 3 — Decisions | 6 / 6 | Appointment Requests | Reschedule Requests | **Conditional:** entire row hidden when both arrays empty. If only one populated, the populated card spans 12 cols. |
| 4 — Intel | 12 | `<app-practice-area-outlet>` | — | Renders PI AI Insights → PI Risk Alerts → PI Cross-Matter Intel. Outlet's existing `*ngIf` already hides it when no PA is active. |
| 5 — Context | 8 / 4 | My Ongoing Cases (top) + Recent Activity (below, same column) | Client Communication | Client Comm demoted from top-right to bottom-right. My Cases + Recent Activity stay stacked in the left col as today. |

### Card → row mapping (current vs proposed)

| Card | Today's location | Proposed location |
|------|------------------|-------------------|
| Focus card | Row 1 left (8) | Row 1 left (8) — unchanged |
| Client Communication | Row 1 right (4) | Row 5 right (4) — demoted |
| Today's Schedule | Row 1.5 (12) | Row 2 (12) — unchanged content, new index |
| PI AI Insights / Risk Alerts / Cross-Matter | Row 1.7 (outlet) | Row 4 (outlet) — unchanged content, new index |
| My Ongoing Cases | Row 2 left top (8) | Row 5 left top (8) — unchanged content, new index |
| Recent Activity | Row 2 left bottom (8) | Row 5 left bottom (8) — unchanged content, new index |
| Urgent Items | Row 2 right top (4) | **Row 1 right (4) — promoted** |
| Appointment Requests | Row 2 right middle (4) | **Row 3 left (6) — promoted to dedicated band** |
| Reschedule Requests | Row 2 right bottom (4) | **Row 3 right (6) — promoted to dedicated band** |

### Empty / partial-state behavior

- **Row 1 right column (Urgent Items):** the card has its own internal "All clear / No urgent items right now" empty state (`*ngIf="urgentItems.length === 0"` block already in place at line 469 of the current HTML). Stays at 4-col regardless. **No dynamic-col logic needed for Row 1.**
- **Row 3 (Decisions):** wrapped in a single `*ngIf` on the union of both cards' existing render conditions:
  ```
  *ngIf="pendingAppointments.length > 0 || loadingPendingAppointments
       || pendingRescheduleRequests.length > 0 || loadingRescheduleRequests"
  ```
  When both arrays are empty (and neither is loading), the entire row collapses out — no empty-state placeholder.
- **Row 3, only one populated:** each inner column binds its width dynamically based on the sibling's render condition:
  ```html
  <div [ngClass]="(pendingRescheduleRequests.length > 0 || loadingRescheduleRequests)
                  ? 'col-xxl-6 col-xl-6' : 'col-xxl-12 col-xl-12'"
       *ngIf="pendingAppointments.length > 0 || loadingPendingAppointments">
    <!-- existing Appointment Requests card markup, unchanged -->
  </div>
  <div [ngClass]="(pendingAppointments.length > 0 || loadingPendingAppointments)
                  ? 'col-xxl-6 col-xl-6' : 'col-xxl-12 col-xl-12'"
       *ngIf="pendingRescheduleRequests.length > 0 || loadingRescheduleRequests">
    <!-- existing Reschedule Requests card markup, unchanged -->
  </div>
  ```
  Variable names match the controller: `pendingAppointments`, `loadingPendingAppointments`, `pendingRescheduleRequests`, `loadingRescheduleRequests`.
- **Row 4 (outlet):** outlet already handles its own `*ngIf` for "no practice-area selected" — Row 5 shifts up naturally.
- **Client Comm empty:** existing empty-state ("No client touchpoints yet") already in place — renders in the new bottom-right slot identically.

### Responsive behavior

The HTML keeps the existing `col-xxl-* col-xl-*` doubled-width pattern. Below the `xl` breakpoint, all 8/4 and 6/6 splits collapse to stacked single-column — same as today. No new media queries needed.

### Ghost-button CSS fix

`src/app/component/dashboards/attorney/attorney-dashboard.component.scss:4172` — change `.rox-btn-ghost` so the button is visible at rest:

```scss
&.rox-btn-ghost {
  background: transparent;
  color: var(--legience-text-secondary);
  border-color: var(--legience-border-hairline);   /* NEW — visible at rest */
  &:hover {
    background: var(--legience-bg-subtle);
    color: var(--legience-text-primary);
    border-color: var(--legience-border-emphasis); /* NEW — slightly stronger on hover */
  }
}
```

The base `.rox-btn` rule (line 4156) already declares `border: 1px solid transparent`, so the ghost variant just overrides the color — no width/style changes needed.

**Blast radius:** confirmed via grep — `rox-btn-ghost` is used in exactly two places, both in this file:
- Line 147 — Today's Schedule "Availability" button.
- Line 970 — Event details modal "Close" button.

No other consumers in the codebase. No other variants of `.rox-btn` are touched.

## Files modified

- `src/app/component/dashboards/attorney/attorney-dashboard.component.html` — reorder `<div class="row g-3">` blocks; relocate Urgent Items, Appointment Requests, Reschedule Requests, Client Communication; conditionally render Row 3 via combined `*ngIf`.
- `src/app/component/dashboards/attorney/attorney-dashboard.component.scss` — single rule edit at line 4172 (`.rox-btn-ghost`).

## Files NOT modified

- `attorney-dashboard.component.ts` — no controller changes.
- `attorney-dashboard.component.scss` outside line 4172 — no other rule changes.
- `src/app/modules/dashboard/practice-areas/personal-injury/**` — PI module untouched.
- All modal components (Availability, Approve, Decline, Reschedule, Event details) — untouched.
- All card components rendered by the dashboard (case cards, activity feed items, urgent-item rows, etc.) — untouched.

## Verification

1. **Visual:** load `/dashboards/attorney` as `a.wilson@bostoneosolutions.com / 1234`. Confirm new row order matches the table above.
2. **Ghost button:** click any event in Today's Schedule → modal opens → "Close" renders as a button with hairline border (not plain text) at rest, fills on hover.
3. **Availability button:** Today's Schedule header "Availability" button likewise renders as a button at rest.
4. **Empty states:**
   - Test user with `urgentItems: []` → Row 1 stays 8/4; the Urgent Items card renders its existing "All clear / No urgent items right now" inline empty state.
   - Test user with no pending appointments and no reschedules → Row 3 disappears entirely (no empty placeholder).
   - Test user with only one of the two populated → the populated card spans 12 cols inside Row 3.
   - Practice-area unloaded → Row 4 disappears, Row 5 shifts up.
   - Test user with no client touchpoints → bottom-right slot renders existing "No client touchpoints yet" empty state.
5. **Responsive:** resize below `xl` breakpoint → all splits stack as today.
6. **Regression:** existing dashboard handlers (Accept/Decline appointment, Approve/Decline reschedule, openCalendar, openAvailabilitySettings, openCaseFromEvent, etc.) still work — they bind to the same components, just in different parent grids.

## Risks / mitigations

- **Risk:** moving Appointment + Reschedule into a 6/6 row may make these cards look sparse if they were designed for a 4-col rail.
  **Mitigation:** the cards' internal layout is unchanged; they'll just render with more horizontal whitespace, which is acceptable. If it looks bad in practice, the fallback is to stack them at 12-col each (Row 3a, Row 3b) — also a position change, not a card redesign.
- **Risk:** Urgent Items as a 4-col card next to the Focus hero may visually compete with the hero's own urgency framing (the focus card is already an "urgent matters" hero).
  **Mitigation:** they're complementary — Focus card is a single AI-synthesized headline; Urgent Items is the structured deadline list. Visual contrast (Focus = blue gradient hero; Urgent = red-accented compact list) keeps them readable. If they conflict in practice, swap position or merge in a follow-up — out of scope here.
- **Risk:** Client Comm being demoted may feel like a downgrade for partners who use it as a relationship-health glance.
  **Mitigation:** still on the dashboard, still 4-col, just below the fold. Partners scanning relationship health typically scroll regardless. The promotion of Urgent / Appt / Reschedule to above-the-fold serves more daily-use patterns.

## Out of scope (follow-ups noted)

- New cards or card redesigns of any kind.
- AI-synthesized "single thing to focus on" feature inside the Focus card (originally option D in the brainstorm — descoped per user direction).
- Per-persona dashboard variants — user opted for a single layout for all three personas.
- Changes to PI dashboard module internals.
- Calendar / Today's Schedule horizontal-grid redesign.
