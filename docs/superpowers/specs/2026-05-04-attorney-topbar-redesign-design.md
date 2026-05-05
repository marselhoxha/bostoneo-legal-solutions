# Attorney topbar redesign — design spec

**Date:** 2026-05-04
**Author:** Marsel Hoxha (with Claude)
**Status:** Approved for implementation
**Visual reference:** `.superpowers/brainstorm/38050-1777872437/content/topbar-v3-dashboard-match.html` (Direction B — "Matched to dashboard")

---

## 1. Goal

Replace the current Velzon-default topbar (logo bar + horizontal nav row) with a unified two-row surface that:

1. Shares the visual language of the attorney dashboard's hero focus card (Geist font, hairline borders, white→accent gradient, pill radius, soft shadow).
2. Surfaces three new affordances attorneys care about: **global search**, the **active case context**, an **active billable timer**.
3. Promotes **AI access** to a primary call-to-action ("Ask Legience") instead of hiding it in the menu.
4. Replaces Remix Icons with **Lucide** in the topbar only (consistent stroke, more refined for the chrome).
5. Reduces icon-cluster noise: 7 icons → 3 (bell, chat, theme), with the case-mgmt dropdown dropped entirely.

Out of scope (future specs): full ⌘K command palette, app-wide Lucide migration, the full Ask Legience drawer interaction model beyond "opens with current context preloaded".

---

## 2. Architecture overview

Two stacked bars, both with `position: sticky; top: 0` so they stay pinned during scroll.

**Bar 1 outer height: 70px** (matches Velzon default — see risk #4 in Section 11). All visible elements (pills, buttons, avatar) render at sizes shown in the mockup; vertical padding inside Bar 1 fills the difference between visual content height and the 70px outer footprint. This keeps `.page-content` padding-top calculations intact across the entire app.

**Bar 2 outer height: 55px** (matches Velzon's `[data-layout="horizontal"]` nav row default).

**Combined: 125px** (same as today — zero layout regression elsewhere).

```
┌──────────────────────────────────────────────────────────────────────────┐  ← Bar 1 (70px)
│ [Logo] [Firm name]   [Active case pill]    ⌕Search   [Ask Legience✦]    │   white→blue gradient
│                                                                           │   matches hero card
│                                            [⌚02:14]  🔔 💬 🌙   [Avatar│DA] │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐  ← Bar 2 (55px)
│ ▣Dashboard  📁Case Mgmt  📅Calendar  ☑Tasks  🔧LegiTools  …             │   solid white
│ ──────                                                                   │   accent underline on active
└──────────────────────────────────────────────────────────────────────────┘
```

Both bars sit inside the existing `<app-topbar>` and `<app-horizontal-topbar>` components. We do not introduce a new wrapper — Velzon's layout machinery (`#page-topbar`, `data-layout="horizontal"`) is preserved so page-content padding-top calculations don't break.

### State sources

| Element | Source |
|---|---|
| Firm name subtitle | `currentUser.organization.name` (already on auth state) |
| Active case pill | Route param `caseId` anywhere in the active route tree (use `ActivatedRoute.firstChild` recursion). Fetch case display name via `CaseService.getById(caseId)` cached in a small in-component map |
| Search bar | Phase 1 — opens existing search dropdown on focus. Phase 2 (separate spec) — replaces with ⌘K command palette |
| Ask Legience button | Click → emits `(openAiDrawer)` event handled at layout level → opens new `<app-ai-quick-drawer>` slide-from-right panel |
| Timer pill | Subscribe to `TimerService.activeTimer$` Observable. Renders only when value is non-null. mm:ss updates via `setInterval(1000)` inside the component (cleared on destroy) |
| Bell badge | Existing notifications service count (consolidated — case-mgmt counts roll into this) |
| User block | `currentUser.firstName + lastName`, role from `currentUser.primaryRole` |

---

## 3. Bar 1 — top bar (70px outer)

### Layout

`display: flex; align-items: center; gap: 14px; padding: 0 22px; height: 70px;`

(Outer height stays at Velzon's 70px default to preserve `.page-content` padding-top across the app. The visible content cluster — logo, pills, button, icons, avatar — sits centred within that 70px row, surrounded by ~7px of vertical breathing space top + bottom.)

| Order | Element | Width behaviour |
|---|---|---|
| 1 | Logo block (logo + firm subtitle) | Fixed-width content |
| 2 | Active case pill (conditional) | Fixed-width content, `*ngIf="activeCaseId"` |
| 3 | Spacer | `flex: 1` |
| 4 | Search input | Fixed 320px, hidden under 992px |
| 5 | Ask Legience button | Fixed-width content |
| 6 | Timer pill (conditional) | Fixed-width content, `*ngIf="activeTimer"` |
| 7 | Icon cluster (3 icons) | Border-left divider, fixed-width |
| 8 | User block | Fixed-width content |

### Visual treatment

```scss
background:
  linear-gradient(135deg,
    #ffffff 0%,
    rgba(11, 100, 233, 0.025) 50%,
    rgba(11, 100, 233, 0.06) 100%);
border-bottom: 1px solid var(--legience-border-hairline);

// Decorative radial glow — top-right corner
&::before {
  content: '';
  position: absolute;
  top: -60px; right: -60px;
  width: 240px; height: 240px;
  background: radial-gradient(circle, rgba(11, 100, 233, 0.08) 0%, transparent 60%);
  border-radius: 50%;
  pointer-events: none;
}
```

This **mirrors the dashboard's `.dashboard-focus-card` background pattern exactly**. The user perceives bar 1 + hero card as one continuous surface.

### Element specs

#### 3.1 Logo block

```html
<div class="topbar-logo">
  <a [routerLink]="['/']" class="topbar-logo-link">
    <img src="assets/images/legience-logo-blue.svg" height="28" alt="legience">
  </a>
  <span class="topbar-firm" *ngIf="currentUser?.organization?.name">
    {{ currentUser.organization.name }}
  </span>
</div>
```

- Logo image: keep existing 28px-tall SVG (no change to brand asset)
- Firm subtitle: 11px Geist 400, `letter-spacing: 0.02em`, `color: var(--legience-text-muted)`, vertical stack with logo
- Padding-right: 14px so logo block has visual breathing room from next element

#### 3.2 Active case pill (conditional)

```html
<a class="topbar-context-pill"
   *ngIf="activeCase"
   [routerLink]="['/legal/cases', activeCase.id]">
  <i-lucide name="folder-open"></i-lucide>
  <strong>{{ activeCase.displayName }}</strong>
  <span class="case-num">· #{{ activeCase.caseNumber }}</span>
</a>
```

- Pill style: `border-radius: 999px`, hairline border, semi-transparent white background — **mirrors `.focus-pulse-pill` from the dashboard exactly**
- Geist 500 weight, 12.5px font-size, `-0.005em` letter-spacing
- Folder-open icon in `var(--legience-accent)` color, 13px stroke 2
- Click navigates back to the case detail page (useful when user has wandered into a sub-page like medical chronology and wants to return)
- Trigger: any route with a `caseId` param at any depth — implementation reads `ActivatedRoute.firstChild` recursively until it finds a `caseId` snapshot param

#### 3.3 Search input

```html
<div class="topbar-search" (click)="openSearch()">
  <i-lucide name="search"></i-lucide>
  <span>Search…</span>
  <span class="kbd">⌘ K</span>
</div>
```

- Width: 320px fixed
- Background: `var(--legience-bg-card)`, hairline border, 8px radius
- Looks-clickable but actually triggers existing search dropdown on click for Phase 1
- Hidden below 992px viewport (Bootstrap `lg` breakpoint) — replaced by the existing mobile-only search dropdown that lives nearby

#### 3.4 Ask Legience button

```html
<button class="topbar-ai-btn" (click)="onAskLegienceClick()">
  <i-lucide name="sparkles"></i-lucide>
  <span>Ask Legience</span>
</button>
```

- Background: `linear-gradient(135deg, #0b64e9 0%, #1e3a8a 100%)` — same gradient as logo mark
- White text, 12.5px Geist 500
- 8px radius, soft accent-tinted shadow `0 2px 6px -2px rgba(11, 100, 233, 0.45)`
- Hover: lifts 1px, deeper shadow
- Click → calls `aiDrawerService.open({ context: activeCase })` — service emits to a `<app-ai-quick-drawer>` mounted at layout level (slide-from-right panel)
- Drawer specifics out of scope — this spec only commits to: button exists, click opens a side panel, current case context is passed

#### 3.5 Active timer pill (conditional)

```html
<div class="topbar-timer-pill" *ngIf="activeTimer">
  <span class="pulse"></span>
  <i-lucide name="clock"></i-lucide>
  <span class="time">{{ activeTimer.elapsed | timerFormat }}</span>
</div>
```

- Background `rgba(22, 163, 74, 0.08)`, border `rgba(22, 163, 74, 0.20)`, success-green text
- Pulse dot: 6px green circle, `@keyframes` animation (1s ease-in-out, opacity + scale)
- Time format: `mm:ss` for under an hour, `hh:mm:ss` after — pipe `timerFormat` lives in the timer-widget module already, just import it
- Re-render: `setInterval(1000)` inside component, marks dirty via `ChangeDetectorRef.markForCheck()` (since component should use OnPush). Interval cleared in `ngOnDestroy`
- Click → opens timer-widget modal (existing behaviour)

#### 3.6 Icon cluster

```html
<div class="topbar-icon-cluster">
  <button class="ic-btn" (click)="openNotifications()">
    <i-lucide name="bell"></i-lucide>
    <span class="ic-badge" *ngIf="notificationCount > 0">{{ notificationCount }}</span>
  </button>
  <button class="ic-btn" (click)="openMessages()">
    <i-lucide name="message-square"></i-lucide>
    <span class="ic-dot" *ngIf="hasUnreadMessages"></span>
  </button>
  <button class="ic-btn" (click)="toggleTheme()">
    <i-lucide [name]="isDarkMode ? 'sun' : 'moon'"></i-lucide>
  </button>
</div>
```

- 3 icons total. Removed: case-mgmt briefcase, expand-fullscreen, separate clock (timer is its own pill now)
- Each button: 34×34px, 7px radius, hover bg `rgba(28, 25, 23, 0.05)`
- Lucide stroke 1.75, 18px size
- Badge: orange (`var(--legience-warning)`) circle, 16×16, 10px font 600 weight, white text, 1.5px white ring (so it stands off the button hover state)
- Border-left divider before user block

#### 3.7 User block

```html
<div class="topbar-user" ngbDropdown>
  <button ngbDropdownToggle class="topbar-user-btn">
    <div class="avatar-wrap">
      <div class="avatar" [style.background]="userAvatarBg">
        {{ userInitials }}
      </div>
      <span class="avatar-status"></span>
    </div>
    <div class="user-meta">
      <span class="user-name">{{ currentUser.firstName }} {{ currentUser.lastName }}</span>
      <span class="user-role">{{ currentUser.primaryRole | titlecase }}</span>
    </div>
  </button>
  <div ngbDropdownMenu>
    <!-- existing user menu items unchanged -->
  </div>
</div>
```

- Avatar: 30×30 circle, gradient `linear-gradient(135deg, #93c5fd 0%, #2563eb 100%)` (or hash-based color from existing `getClientAvatarBg` helper)
- Status dot: 9×9 green circle, bottom-right of avatar, 2px white ring
- Name: 12.5px Geist 600
- Role: 10.5px Geist 400 muted
- Hover: pill background `rgba(28, 25, 23, 0.04)`, 999px radius
- Existing dropdown menu items preserved (sign out, profile, etc.)

---

## 4. Bar 2 — horizontal nav (55px outer)

`background: var(--legience-bg-card); padding: 0 18px; height: 55px;`

(Velzon adds 55px to `.page-content` padding-top when `[data-layout="horizontal"]` — keep that. Nav items sit at their natural ~44px height centred in the 55px row.)

### Active state behaviour

Driven by Angular Router. Use `routerLinkActive` with options: `{exact: false}` for parent routes (e.g. `/legal/cases` should match `/legal/cases/123` too).

```html
<a *ngFor="let item of menuItems"
   class="nav-item"
   [routerLink]="item.link"
   routerLinkActive="active"
   [routerLinkActiveOptions]="{ exact: item.exact ?? false }">
  <i-lucide [name]="item.lucideIcon"></i-lucide>
  <span>{{ item.label }}</span>
</a>
```

```scss
.nav-item {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 12px 14px; font-size: 13px; font-weight: 400;
  color: var(--legience-text-secondary);
  letter-spacing: -0.005em;
  position: relative;

  &:hover { color: var(--legience-text-primary); }

  &.active {
    color: var(--legience-accent);
    font-weight: 500;

    &::after {
      content: '';
      position: absolute;
      left: 14px; right: 14px;
      bottom: -1px;
      height: 2px;
      background: var(--legience-accent);
      border-radius: 2px 2px 0 0;
    }

    i-lucide { opacity: 1; }
  }

  i-lucide {
    width: 15px; height: 15px;
    stroke-width: 1.75;
    opacity: 0.85;
  }
}
```

### Icon mapping (Remix → Lucide)

| Nav item | Old Remix | New Lucide |
|---|---|---|
| Dashboard | `ri-dashboard-3-line` | `layout-dashboard` |
| Case Management | `ri-briefcase-line` | `folder` |
| Calendar | `ri-calendar-line` | `calendar` |
| Tasks | `ri-task-line` | `check-square` |
| LegiTools | `ri-tools-line` | `wrench` |
| Clients | `ri-user-line` | `users` |
| Billing | `ri-money-dollar-circle-line` | `dollar-sign` |
| CRM | `ri-headphone-line` | `headphones` |
| E-Signatures | `ri-quill-pen-line` | `pen-tool` |

Update `horizontal-topbar/menu.ts` `MENU` array `icon` field to Lucide names.

---

## 5. Dark mode

Bar 1 in dark mode keeps its gradient pattern, anchored on the dark card surface instead of white — same approach as `.dashboard-focus-card` dark-mode treatment in `rox/_dashboard.scss` Section 27:

```scss
[data-bs-theme="dark"] .topbar-bar-1 {
  background: linear-gradient(135deg, #141414 0%, rgba(37, 99, 235, 0.10) 100%);
  border-bottom-color: rgba(245, 245, 244, 0.08);
}
```

- Active case pill flips to translucent-white-on-dark with darker border
- Search bar background: dark stone `#1c1917` with light stone border
- Ask Legience button keeps the same gradient (it's already dark-mode compatible)
- Icon buttons: hover background `rgba(255, 255, 255, 0.05)`, color shifts to `#d4d2d1`
- Bell badge keeps orange (works on both modes)
- User name shifts to white, role shifts to `#a8a29e`
- Avatar status dot keeps green ring on dark surface

Place all dark-mode rules in `rox/_dashboard.scss` Section 27 (next to existing dark-mode rules) — that section already wins the cascade against component styles, lesson learned from the dashboard work.

---

## 6. Mobile / responsive (< 992px)

Below the Bootstrap `lg` breakpoint:

| Element | Behaviour |
|---|---|
| Logo block | Firm subtitle hidden, only logo shown |
| Active case pill | Hidden — case context only matters with side-by-side workspace |
| Search input | Hidden — replaced by existing mobile dropdown search icon |
| Ask Legience button | Icon-only (no label) |
| Timer pill | Compact: only `mm:ss` time, no clock icon |
| Icon cluster | Unchanged |
| User block | Avatar only (name + role hidden) |
| Bar 2 (nav) | Collapses into existing hamburger menu (Velzon's `topnav-hamburger` already does this) |

This preserves Velzon's existing horizontal → mobile-collapsed transition, just trimming the Bar 1 elements for narrow viewports.

---

## 7. Files affected

```
src/app/component/layouts/topbar/
  topbar.component.html      — significant rewrite of Bar 1 markup
  topbar.component.scss      — new Bar 1 styles
  topbar.component.ts        — add: activeCase$, activeTimer$, search/ai handlers, icon cluster handlers
  topbar.module.ts           — import LucideAngularModule + register icons used

src/app/component/layouts/horizontal-topbar/
  horizontal-topbar.component.html — add Lucide icons, routerLinkActive
  horizontal-topbar.component.scss — new active state styles, icon sizing
  menu.ts                          — update icon field from Remix → Lucide names

src/app/core/services/
  active-case-context.service.ts   — NEW. Reads route tree recursively for caseId, fetches case display data, exposes activeCase$ Observable
  ai-drawer.service.ts             — NEW. Open/close trigger for the side-panel. Emits open events with optional context payload

src/app/component/layouts/ai-quick-drawer/
  ai-quick-drawer.component.{ts,html,scss}  — NEW. Slide-from-right panel. Embeds existing AI workspace component as content for now (real interaction model = separate spec)

src/app/component/layouts/layout.component.html
  — mount <app-ai-quick-drawer> at layout level (sibling of router-outlet)

src/assets/scss/themes/rox/_foundation.scss
  — replace existing topbar Rox block (lines ~199-261) with new structure

src/assets/scss/themes/rox/_dashboard.scss  (Section 27)
  — add dark-mode topbar overrides at the end of Section 27

package.json
  — add "lucide-angular": "^0.453.0" (or latest compatible)

src/app/app.module.ts
  — import LucideAngularModule.pick({ ... icons used ... }) at root for global availability
```

---

## 8. New service contracts

### ActiveCaseContextService

```typescript
@Injectable({ providedIn: 'root' })
export class ActiveCaseContextService {
  activeCase$: Observable<ActiveCase | null>;

  // Subscribes to Router events on construction. On NavigationEnd,
  // recursively walks ActivatedRoute.firstChild for a caseId param.
  // If found, fetches via CaseService.getById (cached in a Map<id, ActiveCase>).
  // Emits null when no caseId is in the route.
}

interface ActiveCase {
  id: number;
  displayName: string;   // e.g. "Smith v. Acme Insurance"
  caseNumber: string;    // e.g. "2025-PI-0847"
}
```

### AiDrawerService

```typescript
@Injectable({ providedIn: 'root' })
export class AiDrawerService {
  private isOpenSubject = new BehaviorSubject<AiDrawerState | null>(null);
  isOpen$ = this.isOpenSubject.asObservable();

  open(context?: { activeCase?: ActiveCase }): void { ... }
  close(): void { ... }
}

interface AiDrawerState {
  context?: { activeCase?: ActiveCase };
  openedAt: number;
}
```

The `<app-ai-quick-drawer>` component subscribes to `isOpen$`, slides in when state is non-null, slides out when null.

---

## 9. Acceptance criteria

A reviewer (you) should be able to verify:

- [ ] Bar 1 background gradient matches the dashboard hero focus card visually (same colors, same direction, same radial glow position)
- [ ] All topbar icons are Lucide (no `ri-*` classes remain inside `topbar/` or `horizontal-topbar/`)
- [ ] Geist font on every text element in both bars
- [ ] Active case pill appears on `/legal/cases/123` and any sub-route (e.g. `/legal/cases/123/medical-chronology`), disappears when navigating to `/dashboard`
- [ ] Active case pill click navigates to the case detail page
- [ ] Timer pill renders only when `TimerService.activeTimer$` emits a non-null value, ticks once per second, formatted `mm:ss` (or `hh:mm:ss` after 1h)
- [ ] Ask Legience button has the gradient + soft shadow + hover lift
- [ ] Clicking Ask Legience opens the side-panel drawer
- [ ] Bell badge count = sum of (current notifications + the case-mgmt pendingAssignments that used to be a separate dropdown)
- [ ] Old case-mgmt dropdown removed (no `caseDropdown` references remain in `topbar.component.html`)
- [ ] Bar 2 active nav item shows accent color text + 2px accent underline
- [ ] Sysadmin organization-switcher still renders in its existing slot for sysadmin users only
- [ ] Mobile (<992px): firm subtitle hidden, search hidden (mobile dropdown still works), AI button becomes icon-only, user name+role hidden
- [ ] Dark mode: Bar 1 gradient flips to dark anchor, all elements remain readable, contrast passes WCAG AA for body text
- [ ] No layout shift when active case pill / timer pill appear (they should slide in cleanly without jumping other elements)

---

## 10. Out of scope (separate specs)

- Full ⌘K command palette (search bar is currently a launcher for the existing dropdown)
- AI quick-drawer interaction model (this spec only defines that the button opens a panel; what's inside the panel is a separate design)
- App-wide Lucide migration (only topbar gets Lucide; rest of app stays Remix until a deliberate migration spec)
- Multi-firm workspace switcher for non-sysadmin users (not a current product requirement)
- Notification panel redesign (we're consolidating counts into the bell, but the panel's visual design is unchanged)

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Lucide adds bundle weight | Use tree-shakeable per-icon imports (`LucideAngularModule.pick({ Search, Bell, ... })`), not the full set. Expected delta: <15KB gzipped |
| Timer pill `setInterval` causes battery drain on idle tabs | Pause interval when document is hidden via `document.visibilitychange` listener; resume when visible |
| Active-case fetch delays pill render (causing late pop-in, the same bug we just fixed on the dashboard pulse pills) | Render pill skeleton state immediately when `caseId` is detected in route, swap to real content when fetch resolves. Better: subscribe to a route-resolver that pre-fetches the case before the route activates |
| Bar 1 height change (52→56px) breaks Velzon's `.page-content` padding-top calc | Update `_foundation.scss` to use the new height OR keep at exactly 70px (Velzon's default) by adjusting Bar 1 padding instead of height. The latter is safer. **Decision: keep Bar 1 at 70px to avoid regression in every page** |
| Existing topbar has many embedded dropdowns (case-mgmt, notifications, etc.) — partial removal could leave dead handler code | Audit `topbar.component.ts` for any methods only used by removed dropdown HTML; delete unused methods in the same PR |

The Bar 1 height risk is significant — let me pin it: **Bar 1 = 70px** (Velzon default) to avoid every page in the app shifting. The visual mockup shows ~56px; in implementation we'll add internal vertical padding to maintain the 70px outer footprint. The visual rhythm is preserved because the elements (pills, buttons, avatars) all stay sized as drawn.

---

## 12. Open questions

None remaining — all answered in Section 3 of the brainstorm. AI button → side-panel drawer. Active case pill → any route with caseId. Timer pill → mm:ss live tick. Case-mgmt dropdown → drop entirely.
