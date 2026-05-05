# Layout flex-column foundation fix

**Status:** approved design, pending implementation plan.
**Scope:** small, theme-foundation-only fix. Affects every Rox-themed page globally.

## Problem

Two layout issues affect every page in the Rox theme except the attorney dashboard (which masks them by accident, not by design):

1. **Top padding too tight.** `.page-content { padding-top: 16px }` in `src/assets/scss/themes/rox/_layout-overrides.scss` was sized assuming a single 70px sticky topbar. Rox actually stacks two: `#page-topbar` (70px sticky) + `app-horizontal-topbar` (47px static) for a 117px header zone. 16px feels jammed against the horizontal nav row.

2. **Footer overlaps content.** Velzon's `src/assets/scss/structure/_footer.scss` declares `.footer { position: absolute; bottom: 0; height: 60px }`. The footer sits absolutely at `bottom: 0` of `.main-content`, *out of normal flow*. To prevent overlap, `.page-content` would need `padding-bottom ≥ 60px` — currently 24px, leaving every page's last 36px of content rendered behind the footer. Most pages end with a list/card flush to its container edge → visible overlap.

The attorney dashboard masks issue 2 because its bottom cards have generous internal `margin-bottom`, putting the visible content above the overlap zone. Other pages don't have this cushion.

## Approved approach — flex-column layout

Replace Velzon's absolute-positioned footer with a flex-column layout where footer flows naturally:

```
.main-content (flex column, min-height: 100vh - header zone)
├── .page-content (flex: 1 — fills available height)
│   └── .container-fluid → <router-outlet>
└── .footer (margin-top: auto — pushed to bottom by flex)
```

**Why this is cleaner than padding-tweak alternatives:**
- Footer is *in normal flow*, so content can never overlap it.
- `flex: 1` on page-content makes it expand on short pages, keeping the footer at viewport bottom without absolute positioning.
- Padding values become free of layout-dependency: `padding-bottom` no longer has to match footer height.
- One source of truth for the topbar zone height (CSS variable, see below).

## Implementation

### Edit 1 — `src/assets/scss/themes/rox/_layout-overrides.scss`

Replace the existing `.page-content` rule with the flex-column structure:

```scss
:root[data-design="rox"] {
  // ── Layout zone heights (CSS variables, single source of truth) ────
  --legience-topbar-h: 70px;             // primary sticky topbar (search/notifications/user)
  --legience-topbar-secondary-h: 47px;   // horizontal nav row (Dashboard/Cases/etc.)
  --legience-topbar-zone-h: calc(var(--legience-topbar-h) + var(--legience-topbar-secondary-h));

  // ── Main content: flex column so footer joins normal flow ──────────
  // Footer sits at margin-top:auto so it stays at the visual bottom on
  // short pages without needing position:absolute. On long pages it
  // simply renders at the end of content.
  .main-content {
    display: flex;
    flex-direction: column;
    min-height: calc(100vh - var(--legience-topbar-zone-h));
  }

  .page-content {
    flex: 1;                  // fills space between header zone and footer
    padding-top: 24px;        // bumped from 16px for breathing room below horizontal nav
    padding-bottom: 24px;     // no longer needs to clear footer (footer is in flow)
  }

  // ── Cancel Velzon's absolute-position footer ────────────────────────
  // Velzon's _footer.scss sets position:absolute + bottom:0 to anchor
  // the footer to the bottom of main-content. With flex-column we don't
  // need that — `margin-top:auto` does the same job inside flow.
  .footer {
    position: static;
    left: auto;
    right: auto;
    bottom: auto;
    height: auto;
    padding: 16px 12px;
    margin-top: auto;
  }
}
```

### Edits not needed

- `src/assets/scss/structure/_footer.scss` — leave untouched (it's the Velzon vendored layer; our Rox override neutralizes the absolute positioning at the theme level so non-Rox designs keep working).
- `src/styles.scss` `.is-public-page` block (lines 1221+) — already hides footer for public-only pages; flex-column doesn't affect that.
- `app-footer` component HTML — no change.
- Layout component HTML — no change.

## Edge cases verified

| Case | Behavior |
|---|---|
| Long page (clients, billing) | Footer renders after content, no overlap. |
| Short page (/signatures with one row) | Page-content `flex:1` fills viewport height; footer sticks to viewport bottom. |
| Attorney dashboard | Behaves the same as before visually; the structural overlap (which had been masked by card spacing) is now correctly resolved. |
| Sidebar collapse (mobile, ≤991.98px) | Existing `.main-content { margin-left: var(--vz-vertical-menu-width) }` cascade preserved; flex layout works at any width. |
| Horizontal layout (`app-horizontal`) | Uses the same `.main-content > .page-content + app-footer` DOM, so the same Rox override applies. |
| Light + dark theme | No theme-related logic in the fix. Pure layout. |

## Out of scope

- Removing or changing Velzon's `_footer.scss`. Other designs (Velzon, Column) still depend on its rules; we override at the Rox-theme level only.
- Adjusting the horizontal-topbar component itself.
- Refactoring `app-footer` from absolute-positioned to flex-flow at the structure layer (would touch all themes — too broad for this fix).
- Any visual change to the footer's appearance beyond inheriting the page-content's container width.

## Verification checklist

After applying:

1. Visit `/clients`, `/billing-dashboard`, `/legal/cases` — last row of content sits ABOVE the footer with normal padding, no overlap.
2. Visit `/signatures` (short page) — footer sticks to bottom of viewport, content fills the rest.
3. Visit `/home` (attorney dashboard) — visually unchanged.
4. Toggle dark mode on `/billing-dashboard` — layout stays correct.
5. Resize to mobile (≤991.98px) — sidebar collapses, layout still flows correctly.
6. Compare against the captured baselines for these routes if available — only the bottom 36px of long-page screenshots and the top 8px on all pages should differ.
