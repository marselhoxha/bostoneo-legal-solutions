# Attorney topbar — clean replacement design spec

**Date:** 2026-05-04
**Author:** Marsel Hoxha (with Claude)
**Status:** Approved for implementation
**Visual reference:** `.superpowers/brainstorm/38050-1777872437/content/topbar-v3-dashboard-match.html` (Direction B — "Matched to dashboard")
**Predecessor spec:** [2026-05-04-attorney-topbar-redesign-design.md](2026-05-04-attorney-topbar-redesign-design.md) — superseded by this one because the patch-Velzon approach failed during implementation. This spec switches to a clean replacement strategy.

---

## 1. Goal

Replace the inner content of `<header id="page-topbar">` with brand-new HTML that uses ONLY `.lt-*` (Legience Topbar) class names. By eliminating overlap with Velzon's class taxonomy (`.navbar-*`, `.header-*`, `.logo-*`, `.topbar-*`, `.btn-topbar`, `.app-menu`, `.menu-link`, `.nav-link`), Velzon's existing CSS rules can no longer match anything in our markup — they fall silent without `!important` wars.

Also **remove the residual `.page-content { padding-top: 120px }` rule** from Velzon's `_vertical.scss` — with the redesigned topbar, page content should sit immediately below the bar with only the page's own internal padding for breathing room.

## 2. Why this approach (and why the previous spec failed)

The previous spec (2026-05-04-attorney-topbar-redesign-design.md) tried to coexist with Velzon's HTML — keep the original Velzon classes but layer new ones on top. After 8 implementation rounds, the live browser showed:

- Logo block measured 430px wide (parent: 331px) because BOTH `.logo-dark` AND `.logo-light` rendered simultaneously — Velzon's theme-based hide rules didn't apply once we mixed our `.topbar-logo-link` class onto the same element
- Search bar overlapped firm subtitle by 85px because of the logo overflow above
- Active nav still showed a soft accent pill background — Velzon's `_horizontal-topbar-laptop.scss:128-138` writes `.horizontal-layout .app-menu .navbar-nav .nav-item .nav-link.active { background-color: rgba(var(--bs-primary-rgb), 0.12) }` at the same specificity our `:host`-encapsulated override carries, and cascade order flipped on us
- User block carried Velzon's `.topbar-user` lavender background `rgb(243, 243, 249)` we never overrode
- Vertical alignment chaos — children at 34, 35, 38, and 70px tall in the same row because some children were buttons, some dropdown wrappers, some pills, and the `align-items` story was inconsistent

The pattern: every targeted patch invited a new Velzon rule to win the cascade. The cleanest way out is to stop having anything for Velzon's selectors to match.

## 3. Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐  ← Bar 1 — 70px outer
│ [logo-mark][firm]  [active-case-pill?]    ⌕Search  [Ask Legience✦]      │   gradient bg, hairline,
│                                                                           │   radial glow top-right
│                                            [⌚timer?]  🌙  💬  🔔7  [DA│name]│   matches dashboard hero
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐  ← Bar 2 — 55px
│ ▣Dashboard  📁Case Mgmt  📅Calendar  ☑Tasks  🔧LegiTools  …             │   accent underline on
│ ──────                                                                   │   active item only
└──────────────────────────────────────────────────────────────────────────┘
```

Both bars `position: sticky; top: 0` so they pin during scroll. Bar 1 outer height 70px (Velzon default — preserved so any rules elsewhere keying off this don't break). Combined: 125px. Page content starts at 125px with no extra padding gap.

## 4. Bar 1 — full HTML structure

Replaces the current ~700 lines of `<header id="page-topbar">` content. Existing dropdown PANEL HTML (notification list, message thread list, user menu items) stays — only the cluster trigger buttons + Bar chrome are rewritten, panels are relocated as inline children of new wrappers.

```html
<header id="page-topbar" class="lt-bar" data-scroll-header>
  <div class="lt-bar-row">

    <!-- ── LEFT ───────────────────────────────────────────────────── -->
    <div class="lt-left">

      <a class="lt-brand" [routerLink]="['/']">
        <img src="assets/images/legience-logo-blue.svg" class="lt-brand-mark" alt="Legience" height="28">
        <span class="lt-brand-firm" *ngIf="user$ | async as u">
          {{ u.organizationName || u.organization?.name }}
        </span>
      </a>

      <button type="button"
              id="topnav-hamburger-icon"
              class="lt-hamburger"
              (click)="toggleMobileMenu($event)"
              aria-label="Toggle menu">
        <span class="lt-hamburger-icon"><span></span><span></span><span></span></span>
      </button>

      <a class="lt-context"
         *ngIf="activeCase$ | async as c"
         [routerLink]="['/legal/cases', c.id]">
        <i-lucide name="folder-open" [size]="13"></i-lucide>
        <strong>{{ c.displayName }}</strong>
        <span class="lt-context-num">· #{{ c.caseNumber }}</span>
      </a>
    </div>

    <!-- ── RIGHT ──────────────────────────────────────────────────── -->
    <div class="lt-right">

      <!-- Search trigger (desktop only) -->
      <button type="button"
              class="lt-search d-none d-lg-inline-flex"
              (click)="openSearch()"
              aria-label="Search">
        <i-lucide name="search" [size]="14"></i-lucide>
        <span class="lt-search-text">Search&hellip;</span>
        <kbd class="lt-kbd">⌘ K</kbd>
      </button>

      <!-- Existing mobile-only search dropdown — kept exactly as-is.
           openSearch() above triggers it via document.getElementById click. -->
      <div class="dropdown d-md-none lt-mobile-search" ngbDropdown>
        <button type="button" class="lt-icon-btn" id="page-header-search-dropdown" ngbDropdownToggle aria-label="Search">
          <i-lucide name="search" [size]="18"></i-lucide>
        </button>
        <div ngbDropdownMenu class="lt-dropdown-menu">
          <form class="p-3">
            <div class="input-group">
              <input type="text" class="form-control" placeholder="Search ...">
              <button class="btn btn-primary" type="submit"><i-lucide name="search" [size]="16"></i-lucide></button>
            </div>
          </form>
        </div>
      </div>

      <!-- Ask Legience CTA -->
      <button type="button"
              class="lt-ai-btn"
              (click)="onAskLegience()"
              *ngIf="!isClientUser"
              aria-label="Ask Legience">
        <i-lucide name="sparkles" [size]="14"></i-lucide>
        <span class="lt-ai-label">Ask Legience</span>
      </button>

      <!-- Active billable timer pill -->
      <div class="lt-timer" *ngIf="firstActiveTimer$ | async as timer">
        <span class="lt-timer-pulse"></span>
        <i-lucide name="clock" [size]="13"></i-lucide>
        <span class="lt-timer-time">{{ formatTimer(timer) }}</span>
      </div>

      <!-- Cluster: theme toggle + messages + notifications -->
      <div class="lt-cluster">

        <button type="button"
                class="lt-icon-btn"
                (click)="toggleTheme()"
                [attr.aria-label]="isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'">
          <i-lucide [name]="isDarkMode ? 'sun' : 'moon'" [size]="18"></i-lucide>
        </button>

        <div class="lt-icon-wrap"
             ngbDropdown
             #messageDropdown="ngbDropdown"
             display="dynamic"
             placement="bottom-end"
             (openChange)="onMessageDropdownToggle($event)">
          <button type="button" class="lt-icon-btn" ngbDropdownToggle id="page-header-messages-dropdown" aria-label="Messages">
            <i-lucide name="message-square" [size]="18"></i-lucide>
            <span class="lt-icon-dot" *ngIf="hasUnreadMessages"></span>
          </button>
          <div ngbDropdownMenu class="lt-dropdown-menu lt-msg-menu">
            <!-- EXISTING messages panel HTML inline — relocated unchanged from old topbar.component.html (lines 389-475 in pre-clean-replacement state) -->
          </div>
        </div>

        <div class="lt-icon-wrap"
             ngbDropdown
             #notificationDropdown="ngbDropdown"
             display="dynamic"
             placement="bottom-end"
             (openChange)="onNotificationDropdownToggle($event)">
          <button type="button" class="lt-icon-btn"
                  ngbDropdownToggle
                  id="page-header-notifications-dropdown"
                  [ngClass]="{'has-new-notifications': hasNewNotifications}"
                  (click)="$event.stopPropagation()"
                  aria-label="Notifications">
            <i-lucide name="bell" [size]="18"></i-lucide>
            <span class="lt-icon-badge" *ngIf="totalNotificationCount > 0">{{ totalNotificationCount }}</span>
          </button>
          <div ngbDropdownMenu class="lt-dropdown-menu lt-notif-menu">
            <!-- EXISTING notifications panel HTML inline — relocated unchanged from old topbar.component.html (lines 489-565 in pre-clean-replacement state) -->
          </div>
        </div>
      </div>

      <!-- Sysadmin org switcher — self-gates internally via isAdmin/isSuperAdmin -->
      <app-organization-switcher class="lt-org-switcher"></app-organization-switcher>

      <!-- User block -->
      <div class="lt-user"
           *ngIf="user$ | async as user"
           ngbDropdown
           display="dynamic"
           placement="bottom-end"
           container="body">
        <button type="button" class="lt-user-btn" ngbDropdownToggle id="page-header-user-dropdown" aria-label="User menu">
          <span class="lt-user-avatar-wrap">
            <span class="lt-user-avatar" [style.background]="getAvatarBgFor(user)">{{ getInitialsFor(user) }}</span>
            <span class="lt-user-status"></span>
          </span>
          <span class="lt-user-meta d-none d-lg-flex">
            <span class="lt-user-name">{{ user.firstName }} {{ user.lastName }}</span>
            <span class="lt-user-role">{{ formatRole(user.title || user.roleName) }}</span>
          </span>
        </button>
        <div ngbDropdownMenu class="lt-dropdown-menu lt-user-menu">
          <!-- EXISTING user menu items inline — Settings / Taskboard / Help / Logout -->
        </div>
      </div>

    </div>
  </div>
</header>

<!-- AI quick drawer mounts at layout level (see layout.component.html) -->
<!-- Notification details modal stays at the bottom of topbar.component.html unchanged -->
```

**Structural fixes baked in vs. old markup:**
- ONE `<a class="lt-brand">` wrapping ONE `<img>` — eliminates the dual `.logo-dark + .logo-light` 430px overflow disaster
- `<kbd>` element for the `⌘ K` hint (semantic, browser-styled by default — overridden in our SCSS)
- `.lt-icon-wrap` shell is the dropdown owner; `.lt-icon-btn` is just the trigger button. Separates concerns cleanly. ngbDropdown directives never need `!important` to position their menu
- The `id="topnav-hamburger-icon"` is preserved on the new `.lt-hamburger` so Velzon's mobile-collapse JS still finds and toggles it
- The `id="page-header-search-dropdown"`, `id="page-header-messages-dropdown"`, `id="page-header-notifications-dropdown"`, `id="page-header-user-dropdown"` IDs are preserved — `openSearch()` and any external code that targets these still works

## 5. Bar 2 — horizontal nav HTML

The `<app-horizontal-topbar>` component renders Bar 2. Same class-rename strategy: replace `.nav-link.menu-link` references with `.lt-nav-link` and add a wrapper `.lt-nav` so Velzon's `.app-menu .navbar-nav .nav-item .nav-link` selector chain finds nothing.

```html
<div class="app-menu lt-nav-menu">
  <div id="scrollbar">
    <div class="container-fluid">
      <ul class="lt-nav-list" id="navbar-nav">
        <ng-container *ngFor="let item of menuItems; trackBy: trackById">

          <li class="lt-nav-item" *ngIf="!item.isTitle">

            <!-- Item with dropdown -->
            <ng-container *ngIf="hasItems(item); else flat">
              <a href="javascript:void(0);"
                 class="lt-nav-link"
                 [class.lt-nav-link--has-children]="!item.badge"
                 [routerLinkActive]="'active'"
                 [routerLinkActiveOptions]="{ exact: false }"
                 [attr.data-title]="item.label"
                 data-bs-toggle="collapse"
                 (click)="toggleItem($event)">
                <i-lucide [name]="item.lucideIcon || 'square'" [size]="15" class="lt-nav-icon"></i-lucide>
                <span class="lt-nav-label">{{ item.label }}</span>
                <i-lucide name="chevron-down" [size]="12" class="lt-nav-chev"></i-lucide>
              </a>

              <!-- Existing collapse/dropdown menu HTML stays unchanged for the submenu UX -->
              <div class="collapse menu-dropdown lt-nav-dropdown">
                <!-- ...subitems rendering same as before... -->
              </div>
            </ng-container>

            <!-- Flat item (no submenu) -->
            <ng-template #flat>
              <a [routerLink]="item.link"
                 class="lt-nav-link"
                 [routerLinkActive]="'active'"
                 [routerLinkActiveOptions]="{ exact: false }"
                 [attr.data-title]="item.label">
                <i-lucide [name]="item.lucideIcon || 'square'" [size]="15" class="lt-nav-icon"></i-lucide>
                <span class="lt-nav-label">{{ item.label }}</span>
              </a>
            </ng-template>

          </li>

          <!-- Section title -->
          <li class="lt-nav-title" *ngIf="item.isTitle">{{ item.label }}</li>

        </ng-container>
      </ul>
    </div>
  </div>
</div>
```

## 6. Visual treatment + dimensions (locked numbers)

| Element | Spec |
|---|---|
| `.lt-bar` | `position: sticky; top: 0; z-index: 1020` |
| `.lt-bar-row` | `display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 0 22px; height: 70px;` background = white→accent gradient at 135deg matching dashboard hero card; `border-bottom: 1px solid var(--legience-border-hairline);` `&::before` radial glow top-right (240px, 8% accent) |
| `.lt-left` | `display: flex; align-items: center; gap: 12px; flex: 0 1 auto; min-width: 0;` (does NOT grow — the spacer behaviour comes from `justify-content: space-between` on the parent + `.lt-right`) |
| `.lt-right` | `display: flex; align-items: center; gap: 6px; flex-shrink: 0;` |
| `.lt-brand` | `display: inline-flex; align-items: center; gap: 10px; text-decoration: none;` |
| `.lt-brand-mark` | `height: 28px; width: auto; display: block;` |
| `.lt-brand-firm` | `font-size: 11px; font-weight: 400; letter-spacing: 0.02em; color: var(--legience-text-muted); white-space: nowrap;` |
| `.lt-hamburger` | `padding: 0 10px; height: 34px; background: transparent; border: none; color: var(--legience-text-muted);` (display:none on desktop via media query) |
| `.lt-context` | `height: 32px; padding: 0 12px; background: rgba(255,255,255,0.65); border: 1px solid var(--legience-border-hairline); border-radius: 999px; display: inline-flex; align-items: center; gap: 8px; font: 500 12.5px 'Geist'; color: var(--legience-text-primary); text-decoration: none;` `strong { color: var(--legience-accent); font-weight: 600; }` `.lt-context-num { color: var(--legience-text-muted); font-weight: 400; font-size: 11.5px; }` |
| `.lt-search` | `width: 320px; height: 36px; padding: 0 14px; background: var(--legience-bg-card); border: 1px solid var(--legience-border-hairline); border-radius: 8px; display: inline-flex; align-items: center; gap: 10px; font-size: 12.5px; color: var(--legience-text-muted); cursor: pointer;` |
| `.lt-kbd` | `padding: 2px 6px; background: rgba(28,25,23,0.05); border: none; border-radius: 4px; font: 500 10.5px 'Geist'; color: var(--legience-text-muted);` (overrides browser default `<kbd>` styling) |
| `.lt-ai-btn` | `height: 36px; padding: 0 14px; background: linear-gradient(135deg, #0b64e9 0%, #1e3a8a 100%); color: #fff; font: 500 12.5px 'Geist'; border: none; border-radius: 8px; box-shadow: 0 2px 6px -2px rgba(11,100,233,0.45);` hover lifts 1px |
| `.lt-timer` | `height: 32px; padding: 0 14px; background: rgba(22,163,74,0.08); border: 1px solid rgba(22,163,74,0.20); border-radius: 999px; display: inline-flex; align-items: center; gap: 8px; font: 500 13px 'Geist'; color: var(--legience-success); font-variant-numeric: tabular-nums;` |
| `.lt-timer-pulse` | `width: 7px; height: 7px; border-radius: 50%; background: var(--legience-success); animation: ltTimerPulse 2s ease-in-out infinite;` |
| `.lt-cluster` | `display: inline-flex; align-items: center; gap: 2px; padding-left: 6px; margin-left: 4px; border-left: 1px solid var(--legience-border-hairline);` |
| `.lt-icon-btn` | `width: 34px; height: 34px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; background: transparent; border: none; color: var(--legience-text-muted); cursor: pointer; position: relative;` hover bg `rgba(28,25,23,0.05)`. `i-lucide, i-lucide svg { pointer-events: none; stroke-width: 2; }` (pointer-events fix for ngbDropdown click reaching button) |
| `.lt-icon-badge` | `position: absolute; top: 2px; right: 1px; min-width: 16px; height: 16px; padding: 0 4px; background: var(--legience-warning); color: #fff; font: 600 10px 'Geist'; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 0 0 1.5px var(--legience-bg-card); pointer-events: none;` |
| `.lt-icon-dot` | `position: absolute; top: 7px; right: 7px; width: 7px; height: 7px; border-radius: 50%; background: var(--legience-warning); box-shadow: 0 0 0 1.5px var(--legience-bg-card);` |
| `.lt-user-btn` | `height: 38px; padding: 4px 12px 4px 4px; background: transparent; border: none; border-radius: 999px; display: inline-flex; align-items: center; gap: 10px; cursor: pointer;` hover bg `rgba(28,25,23,0.04)` |
| `.lt-user-avatar` | `width: 30px; height: 30px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; font: 600 11.5px 'Geist'; letter-spacing: 0.02em;` (background set inline via `[style.background]` from `getAvatarBgFor()` hash) |
| `.lt-user-status` | `position: absolute; bottom: -1px; right: -1px; width: 9px; height: 9px; border-radius: 50%; background: var(--legience-success); border: 2px solid var(--legience-bg-card);` |
| `.lt-user-name` | `font: 600 12.5px 'Geist'; color: var(--legience-text-primary); letter-spacing: -0.008em;` |
| `.lt-user-role` | `font: 400 10.5px 'Geist'; color: var(--legience-text-muted); letter-spacing: 0.02em; margin-top: 2px;` |
| `.lt-nav-list` | (Bar 2) `display: inline-flex; gap: 1px; list-style: none; margin: 0; padding: 0;` |
| `.lt-nav-link` | `display: inline-flex; align-items: center; gap: 7px; padding: 12px 14px; font: 400 13px 'Geist'; color: var(--legience-text-secondary); letter-spacing: -0.005em; position: relative; text-decoration: none;` no background, no border-radius, no shadow at any state |
| `.lt-nav-link.active` | `color: var(--legience-accent); font-weight: 500;` `&::after { content:''; position: absolute; left: 14px; right: 14px; bottom: -1px; height: 2px; background: var(--legience-accent); border-radius: 2px 2px 0 0; }` |
| `.lt-nav-icon` | `width: 15px; height: 15px; stroke-width: 1.75; opacity: 0.85;` `.lt-nav-link.active &` → opacity 1 |

**Vertical alignment guarantee:** every immediate child of `.lt-bar-row` is `align-items: center` against the 70px row. No child controls its own height — they grow to natural content height inside the centred row. No more 70/38/35/34 chaos.

## 7. Page-content padding fix

`src/assets/scss/structure/_vertical.scss:24` currently sets `.page-content { padding: 120px ... 90px ... }`. The 120px top was sized for vertical layout's 70px topbar + breathing room.

For the redesigned horizontal layout, the topbar (Bar 1 + Bar 2 = 125px) is `position: sticky` so it occupies its own document flow space — page content naturally starts below it without needing artificial padding-top.

**Action:** in a new file `src/assets/scss/themes/rox/_layout-overrides.scss` (or appended to an existing Rox file), add a `data-design="rox"`-scoped override:

```scss
:root[data-design="rox"] .page-content {
  padding-top: 16px;          // small breathing room only
  padding-bottom: 24px;       // unchanged in spirit, slightly tighter
}
```

We intentionally don't go to 0 because some pages don't have their own top padding. 16px gives a clean visual gap below the bar without the dead 100px the user observed.

## 8. Files affected

| Path | Action |
|---|---|
| `src/app/component/layouts/topbar/topbar.component.html` | **Full inner rewrite** of `<header id="page-topbar">` (Section 4). Existing notification panel HTML, message panel HTML, user menu items get relocated as inline children of `.lt-dropdown-menu` slots — content unchanged, just new wrapper class |
| `src/app/component/layouts/topbar/topbar.component.scss` | **Full rewrite** with `.lt-*` selectors only. Delete every `.topbar-*` rule from the previous attempt. Keep the existing `:host ::ng-deep` blocks for dropdown PANEL content (`.notification-item`, `.message-item`, etc.) — those work and we don't restyle the panels |
| `src/app/component/layouts/topbar/topbar.component.ts` | **No logic change.** Helpers `getInitialsFor`, `getAvatarBgFor`, `formatRole`, `formatTimer`, `openSearch`, `onAskLegience`, `toggleTheme`, `isDarkMode`, `totalNotificationCount`, `hasUnreadMessages` all stay |
| `src/app/component/layouts/horizontal-topbar/horizontal-topbar.component.html` | Replace `.nav-link.menu-link` markup with `.lt-nav-link` + `.lt-nav-list` + `.lt-nav-item` (Section 5). Keep submenu rendering for items with `subItems` |
| `src/app/component/layouts/horizontal-topbar/horizontal-topbar.component.scss` | **Replace** the new `.nav-link.menu-link` rules with clean `.lt-nav-link` rules. Delete old hover bg / active fallback rules that fight Velzon |
| `src/assets/scss/themes/rox/_dashboard.scss` | **Delete** the `app-horizontal-topbar { .navbar-nav { ... background: transparent !important ... } }` defensive nuke from Section 26. Delete `.topbar-bar1`, `.topbar-firm`, `.topbar-context-pill`, `.topbar-search`, `.topbar-timer-pill`, `.topbar-icon-cluster`, `.topbar-ic-btn`, `.topbar-ic-badge`, `.topbar-user-*`, `.topbar-bg-tasks-wrap` rules from Section 27 dark mode. Replace those dark-mode rules with `.lt-*` equivalents (much shorter — the new clean classes don't need `!important`) |
| `src/assets/scss/themes/rox/_layout-overrides.scss` *(new file)* | Add `:root[data-design="rox"] .page-content { padding-top: 16px; padding-bottom: 24px; }` (Section 7) |
| `src/assets/scss/themes/_design-rox.scss` (barrel file) | Append `@import 'rox/layout-overrides';` after the existing rox imports |

**Untouched (kept working as-is):**
- `package.json` — Lucide already installed
- `src/app/app.module.ts` — Lucide picked globally
- `src/app/component/layouts/layouts.module.ts` — Lucide picked locally + AiQuickDrawer registered
- `src/app/component/layouts/horizontal-topbar/menu.ts` — `lucideIcon` field already added per role
- `src/app/component/layouts/ai-quick-drawer/*` — drawer is functional
- `src/app/core/services/active-case-context.service.ts` — works
- `src/app/core/services/ai-drawer.service.ts` — works
- `src/assets/scss/themes/rox/_foundation.scss` — `#page-topbar` rules at line ~200 stay, they don't conflict

## 9. Class naming convention (`.lt-*`)

All new selectors prefixed `.lt-` (Legience Topbar). Examples:

```
.lt-bar           — outer header
.lt-bar-row       — flex row inside header
.lt-left          — left section
.lt-right         — right section
.lt-brand         — logo + firm anchor
.lt-brand-mark    — logo image
.lt-brand-firm    — firm subtitle
.lt-hamburger     — mobile menu toggle
.lt-context       — active case pill
.lt-search        — search trigger button
.lt-kbd           — keyboard hint inside search
.lt-ai-btn        — Ask Legience CTA
.lt-timer         — billable timer pill
.lt-timer-pulse   — animated pulse dot
.lt-cluster       — icon cluster wrapper
.lt-icon-wrap     — dropdown trigger wrapper
.lt-icon-btn      — single icon button
.lt-icon-badge    — count badge on icon
.lt-icon-dot      — unread dot on icon
.lt-dropdown-menu — dropdown menu wrapper
.lt-user          — user dropdown wrapper
.lt-user-btn      — user trigger button
.lt-user-avatar*  — avatar pieces
.lt-user-status   — green status dot
.lt-user-name     — name text
.lt-user-role     — role text
.lt-org-switcher  — sysadmin switcher slot
.lt-nav-menu      — bar 2 outer
.lt-nav-list      — bar 2 ul
.lt-nav-item      — bar 2 li
.lt-nav-link      — bar 2 anchor
.lt-nav-icon      — bar 2 lucide
.lt-nav-label     — bar 2 text
.lt-nav-chev      — bar 2 chevron for items with submenu
.lt-nav-title     — bar 2 section header
.lt-nav-dropdown  — bar 2 collapsible submenu
```

## 10. Velzon rules silenced by class avoidance

Once we stop using these Velzon class names, the corresponding rules can no longer match anything:

- `.navbar-header` (was on Bar 1 row)
- `.navbar-brand-box`, `.horizontal-logo`, `.logo`, `.logo-dark`, `.logo-light`, `.logo-sm`, `.logo-lg` (logo block — Velzon's theme-toggle logic for these stops mattering because we use ONE image now)
- `.header-item` (was on every dropdown wrapper — Velzon styles this with min-width / padding that fought our flex)
- `.btn-topbar`, `.btn-icon`, `.btn-ghost-secondary` (icon button classes)
- `.topbar-user`, `.topbar-head-dropdown`, `.topbar-badge`, `.user-name-text`, `.user-name-sub-text` (user block + badges)
- `.app-menu .navbar-nav .nav-item .nav-link` (the chain that was setting the active pill — Bar 2 stops using `.nav-link` entirely)
- `.notification-bell` (was on bell button — Velzon animates it with a `bell-ring` keyframes; we lose that animation, which is fine — it was twitchy)
- `.topnav-hamburger`, `.vertical-menu-btn` (hamburger — we keep `id="topnav-hamburger-icon"` so the JS works, but rely on our own styles)

## 11. Acceptance criteria

A reviewer should be able to verify in the live browser:

- [ ] **Logo block stays inside its container** — measure `.lt-brand` width in DevTools, ensure no overflow into the right cluster. Single logo image, no duplicate
- [ ] **Firm subtitle visible** ("Legience-Dev" or whatever org) and does NOT overlap with search bar
- [ ] **Active nav state**: navigate to `/home` (Dashboard active). Open DevTools → Computed → `.lt-nav-link.active` should show `background-color: rgba(0,0,0,0)` (transparent). The `::after` underline visible at 2px accent
- [ ] **No soft-pill background** behind active nav item
- [ ] **All cluster icons render at 18×18 with stroke-width 2** — measure first svg in `.lt-icon-btn`
- [ ] **Bell badge** positions cleanly at top-right of bell, not cut off at the bar's top edge
- [ ] **Click bell** → notifications dropdown opens. **Click messages icon** → messages dropdown opens. Both panels render their existing content unchanged
- [ ] **Click theme toggle** → `data-bs-theme` attribute on `<html>` flips between `light` and `dark`. Icon flips between moon and sun
- [ ] **Click "Ask Legience"** → side-panel drawer slides in from the right
- [ ] **Active case pill** appears on `/legal/cases/<id>`, hidden on `/home`. Click on pill navigates back to case detail
- [ ] **Timer pill** appears only when `TimerService.activeTimers$[0]` is non-null. Format `mm:ss` ticks every second; `hh:mm:ss` after 1h
- [ ] **User block** shows initials gradient avatar (NOT default placeholder image), green status dot bottom-right, name in 12.5px 600, role in 10.5px 400 muted
- [ ] **Vertical baseline**: every element in Bar 1 sits centred on the 70px row — measure via DevTools that `.lt-brand`, `.lt-search`, `.lt-ai-btn`, `.lt-timer`, `.lt-icon-btn`, `.lt-user-btn` all have similar `top` distance from the bar top
- [ ] **`.page-content` padding-top is 16px** (was 120px) — measure on `/home` route. Page hero card sits ~16px below the bar instead of ~120px
- [ ] **Mobile (<992px)**: firm subtitle hidden, search bar hidden, AI button shows icon only, user name+role hidden, hamburger appears
- [ ] **Dark mode**: Bar 1 gradient flips to dark navy, hairline borders shift to translucent white, accent text uses brighter blue (#5b9dff). Active nav same brighter blue. All elements remain readable
- [ ] **No Velzon class names in the new markup** — `grep -E "navbar-(header|brand-box)|header-item|btn-topbar|topbar-user" src/app/component/layouts/topbar/topbar.component.html` returns 0 hits (except the preserved `id="topnav-hamburger-icon"` which is an ID, not a class)
- [ ] **Console: no Lucide errors**, no Angular template errors

## 12. Out of scope (separate specs)

- Real `⌘ K` command palette (search button still triggers existing dropdown)
- Real Ask Legience drawer interaction (placeholder content)
- App-wide Lucide migration (only topbar gets Lucide; rest of app keeps Remix)
- Sidebar redesign (vertical layout untouched)
- Notification panel content redesign (panel itself stays as-is)

## 13. Risks

| Risk | Mitigation |
|---|---|
| Existing dropdown panels (notifications, messages, user menu) break when relocated into new `.lt-dropdown-menu` wrappers | The relocation is mechanical — same children, new parent class. ngbDropdown directive still bound on the wrapper. Visual styling for panel internals (`:host ::ng-deep .notification-item`) doesn't depend on the new wrapper class. Test: open each dropdown after migration, verify scroll works, items render, click handlers fire |
| `.page-content` padding reduction breaks pages that rely on the 120px gap | Page components in this codebase typically have their own internal padding (cards, hero sections, etc). Audit: navigate to `/home`, `/legal/cases`, `/legal/calendar`, `/case-management/tasks` after change; visually verify no content is hidden behind the topbar and the bar isn't visually crashing into the first card |
| Velzon's mobile-collapse JS breaks because it expects `.navbar-header` or other classes we removed | Velzon's mobile-collapse logic actually targets `id="topnav-hamburger-icon"` (preserved) and `data-layout="horizontal"` (set on `<html>`, untouched). The class avoidance shouldn't break it. If it does, fallback: keep `.navbar-header` as a SECOND class on `.lt-bar-row` (`<div class="lt-bar-row navbar-header">`) — Velzon's JS keeps working, but Velzon's CSS rules for `.navbar-header` would also re-apply. Specificity stays in our favour because `.lt-bar-row` selectors come AFTER Velzon's in import order |
| Lucide icons still don't resolve in some component (Angular DI scoping) | `LucideAngularModule.pick({...})` already added to both `AppModule` and `LayoutsModule`. If a NEW component needs Lucide, it must import LucideAngularModule into its own module's pick — document this in the spec for future contributors |
| The `:has(:empty)` selector for hiding the empty background-tasks-indicator is no longer needed because we re-architect the right cluster — but if we forget to remove the wrapper, we recreate the empty-box bug | Solution baked into Section 4: the `<app-background-tasks-indicator>` is dropped from the new HTML entirely. Its functionality is out of scope for this redesign |

## 14. Open questions

None remaining.

---

End of spec.
