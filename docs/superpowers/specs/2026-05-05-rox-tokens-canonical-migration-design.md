# Rox Tokens Canonical Migration — Design Spec

**Status:** Draft (awaiting user review)
**Created:** 2026-05-05
**Owner:** Marsel Hoxha
**Estimated effort:** 6.5–10 dev-days, phased

---

## 1. Goal

Make `--legience-*` the **canonical source of truth** for every design token in the Legience UI. Stop app code from referencing `--vz-*` directly. Keep Bootstrap/Velzon's compiled vendor CSS working unchanged via a thin compat shim. Bring the codebase fully onto the official Rox token spec ([rox-official.html](../../../.superpowers/brainstorm/20220-1777837309/content/rox-official.html)) without redesigning anything.

Success means:
- App code (`src/app/**`) references only `--legience-*` tokens.
- `--vz-*` exists only in five "shim" files; everywhere else is forbidden by stylelint.
- Visual regression delta from baseline is <2% per route in light + dark.
- Bootstrap components (`.btn`, `.card`, `.modal`, `.dropdown`, etc.) render identically.

## 2. Architecture — the dependency flip

### Current state (causes the bug we just hit)

```
Rox values (foundation.scss) → --vz-* / --bs-*  →  --legience-* (derived from --vz-*)  →  app code
                                                                                       ↘  Bootstrap vendor CSS reads --vz-*
```

`--legience-*` derives FROM `--vz-*`. When a `--vz-*` token is empty (e.g., `--vz-card-bg` is unset in the current app), the derived `--legience-*` token resolves to empty, causing component fallbacks to kick in inconsistently across light/dark mode.

### Target state

```
Rox values  →  --legience-* (canonical, defined directly)  →  --vz-* / --bs-* (compat shim, derives from legience)  →  Bootstrap vendor CSS
                                                          ↘  app code (uses --legience-* exclusively)
```

`--legience-*` is the canonical source. `--vz-*` becomes a derived shim — its only purpose is feeding Bootstrap's compiled vendor CSS. App code never reads `--vz-*` again.

### Where definitions live after migration

| File | Role |
|---|---|
| `src/assets/scss/themes/_legience-tokens.scss` | **Canonical Tier 1** — defines every legience token with explicit values (light + dark) |
| `src/assets/scss/themes/rox/_foundation.scss` | **Compat shim** — every `--vz-*` and `--bs-*` declaration becomes `var(--legience-*)`. No hex values here |
| `src/assets/scss/themes/rox/_dark-mode.scss` | Same pattern — dark `--vz-*` declarations derive from dark `--legience-*` |
| `src/assets/scss/themes/_design-column.scss` | Same pattern (legacy, may be removed) |
| `src/assets/scss/plugins/_datatables.scss` | Same pattern for datatables vendor |

Every other file in `src/` may only reference `var(--legience-*)`. Enforced by stylelint in Phase 4.

## 3. Canonical Tier 1 tokens

All definitions live in `_legience-tokens.scss`. Light mode in `:root`; dark mode in `[data-bs-theme="dark"]`.

### 3.1 Rox 14 official colors (verbatim from rox-official.html)

```scss
:root {
  // Surfaces & brand (Rox spec)
  --legience-color-page-canvas:     #f5f5f4;
  --legience-color-surface-white:   #ffffff;
  --legience-color-blueprint-blue:  #0b64e9;
  --legience-color-subtle-gray:     #ececea;

  // Text (Rox spec)
  --legience-color-text-primary:    #0c0a09;
  --legience-color-text-secondary:  #1c1917;
  --legience-color-text-subtle:     #57534d;
  --legience-color-text-muted:      #a6a09b;

  // Borders & disabled (Rox spec)
  --legience-color-border-light:    #f0efef;
  --legience-color-disabled-gray:   #d4d2d1;

  // Status (Rox spec)
  --legience-color-status-red:      #f24149;
  --legience-color-status-orange:   #f97006;
  --legience-color-status-yellow:   #f9b703;
  --legience-color-status-violet:   #6b4aff;
}
```

These 14 tokens are the **immutable foundation**. They are never aliased or derived from anything else; they hold the canonical Rox hex values.

### 3.2 Legience semantic aliases (extend Rox)

Semantic tokens that consumer components reference. Defined in terms of the 14 base colors:

```scss
:root {
  // Surfaces (semantic)
  --legience-bg-page:           var(--legience-color-page-canvas);    // #f5f5f4
  --legience-bg-card:           var(--legience-color-surface-white);  // #ffffff
  --legience-bg-card-hover:     var(--legience-color-page-canvas);    // #f5f5f4
  --legience-bg-card-active:    var(--legience-color-subtle-gray);    // #ececea
  --legience-bg-row-hover:      rgba(12, 10, 9, 0.03);                // 3% black tint
  --legience-bg-input:          var(--legience-color-surface-white);
  --legience-bg-subtle:         var(--legience-color-subtle-gray);    // #ececea
  --legience-bg-elevated:       var(--legience-color-surface-white);  // modals/dropdowns

  // Overlay
  --legience-overlay-backdrop:  rgba(12, 10, 9, 0.45);                // scrim for modals
  --legience-overlay-blur:      2px;                                   // backdrop-filter

  // Accent
  --legience-accent:            var(--legience-color-blueprint-blue); // #0b64e9
  --legience-accent-rgb:        11, 100, 233;
  --legience-accent-soft:       rgba(11, 100, 233, 0.10);             // 10% alpha
  --legience-accent-bg-subtle:  rgba(11, 100, 233, 0.04);             // 4% alpha
  --legience-accent-hover:      #0a55c5;                               // ~7% darker
  --legience-accent-focus-ring: rgba(11, 100, 233, 0.25);             // 25% alpha for ring

  // Text (semantic)
  --legience-text-primary:      var(--legience-color-text-primary);   // #0c0a09
  --legience-text-secondary:    var(--legience-color-text-secondary); // #1c1917  ← INTENTIONAL SHIFT: currently resolves to #0c0a09 in this codebase due to derivation chain bug; canonicalizing to Rox spec value
  --legience-text-subtle:       var(--legience-color-text-subtle);    // #57534d
  --legience-text-muted:        var(--legience-color-text-muted);     // #a6a09b
  --legience-text-on-accent:    var(--legience-color-surface-white);  // white on blue
  --legience-text-disabled:     var(--legience-color-disabled-gray);  // #d4d2d1
  --legience-text-link:         var(--legience-color-blueprint-blue); // #0b64e9

  // Borders
  --legience-border-hairline:   #e7e5e4;                               // matches --vz-border-color (slightly darker than border-light)
  --legience-border-subtle:     var(--legience-color-border-light);   // #f0efef
  --legience-border-emphasis:   var(--legience-color-disabled-gray);  // #d4d2d1
  --legience-border-hairline-rgb: 231, 229, 228;

  // Status — semantic
  --legience-success:           #16a34a;                              // Legience addition (Rox has yellow but no success green)
  --legience-success-rgb:       22, 163, 74;
  --legience-success-bg-subtle: rgba(22, 163, 74, 0.10);
  --legience-danger:            var(--legience-color-status-red);
  --legience-danger-rgb:        242, 65, 73;
  --legience-danger-bg-subtle:  rgba(242, 65, 73, 0.10);
  --legience-warning:           var(--legience-color-status-yellow);
  --legience-warning-rgb:       249, 183, 3;
  --legience-warning-bg-subtle: rgba(249, 183, 3, 0.10);
  --legience-info:              var(--legience-color-status-violet);
  --legience-info-rgb:          107, 74, 255;
  --legience-info-bg-subtle:    rgba(107, 74, 255, 0.10);
  --legience-orange:            var(--legience-color-status-orange);
  --legience-orange-rgb:        249, 112, 6;

  // Z-index scale
  --legience-z-sticky:    1020;
  --legience-z-dropdown:  1050;
  --legience-z-popover:   1060;
  --legience-z-modal:     1070;
  --legience-z-overlay:   1080;
  --legience-z-toast:     1090;

  // Motion
  --legience-motion-fast:    80ms;
  --legience-motion-base:    120ms;
  --legience-motion-medium:  160ms;
  --legience-motion-slow:    240ms;
  --legience-ease-out:        cubic-bezier(0.16, 1, 0.3, 1);
  --legience-ease-emphasized: cubic-bezier(0.32, 0.72, 0, 1);

  // Spacing (Rox scale: 4,8,12,16,20,24,32,36,40,44,80,120,140)
  --legience-space-1:  4px;
  --legience-space-2:  8px;
  --legience-space-3:  12px;
  --legience-space-4:  16px;
  --legience-space-5:  20px;
  --legience-space-6:  24px;
  --legience-space-7:  32px;
  --legience-space-8:  36px;
  --legience-space-9:  40px;
  --legience-space-10: 44px;
  --legience-space-11: 80px;
  --legience-space-12: 120px;
  --legience-space-13: 140px;

  // Radius (Rox spec)
  --legience-radius-sm:      4px;
  --legience-radius:         6px;   // Rox default
  --legience-radius-buttons: 8px;
  --legience-radius-lg:      12px;
  --legience-radius-pill:    100px;

  // Shadows (Rox spec)
  --legience-shadow-sm:     0 2px 4px rgba(0, 0, 0, 0.06);
  --legience-shadow:        0 1px 2px rgba(0, 0, 0, 0.04);                                         // subtle-2
  --legience-shadow-button: 0 1px 2px rgba(0, 0, 0, 0.04), 0 2px 3px rgba(0, 0, 0, 0.08);          // button
  --legience-shadow-md:     0 2px 3px rgba(0, 0, 0, 0.08);                                         // subtle-3
  --legience-shadow-lg:     0 8px 24px -8px rgba(0, 0, 0, 0.14);
  --legience-shadow-xl:     0 14px 32px rgba(0, 0, 0, 0.25);

  // Typography
  --legience-font-sans:      'Geist', system-ui, -apple-system, sans-serif;
  --legience-font-system:    system-ui, sans-serif;                  // captions, status tags
  --legience-font-monospace: ui-monospace, 'SF Mono', Menlo, monospace;

  --legience-font-weight-regular:  400;
  --legience-font-weight-medium:   500;
  --legience-font-weight-semibold: 600;

  --legience-font-size-xs:   12px;
  --legience-font-size-sm:   14px;
  --legience-font-size-base: 16px;

  // Code/keyboard chip (used by command palette + keyboard hints)
  --legience-bg-kbd:        var(--legience-bg-card);
  --legience-border-kbd:    var(--legience-border-hairline);
  --legience-text-kbd:      var(--legience-text-secondary);
}
```

### 3.3 Dark mode overrides

```scss
[data-bs-theme="dark"] {
  // Surfaces — flip
  --legience-bg-page:           #0c0a09;
  --legience-bg-card:           #141414  !important;   // explicit per direction; raised surface
  --legience-bg-card-hover:     #1c1917  !important;
  --legience-bg-card-active:    #292524;
  --legience-bg-row-hover:      rgba(255, 255, 255, 0.04);
  --legience-bg-input:          #1c1917;
  --legience-bg-subtle:         #292524;
  --legience-bg-elevated:       #141414;

  // Overlay — denser scrim in dark mode
  --legience-overlay-backdrop:  rgba(0, 0, 0, 0.60);

  // Accent — brighter blue for dark contrast
  --legience-accent:            #5b9dff;
  --legience-accent-rgb:        91, 157, 255;
  --legience-accent-soft:       rgba(91, 157, 255, 0.14);
  --legience-accent-bg-subtle:  rgba(91, 157, 255, 0.08);
  --legience-accent-hover:      #74acff;
  --legience-accent-focus-ring: rgba(91, 157, 255, 0.30);

  // Text — flip to light values
  --legience-text-primary:      #f5f5f4;
  --legience-text-secondary:    #d4d2d1;
  --legience-text-subtle:       #b8b3ae;
  --legience-text-muted:        #78716c;
  --legience-text-on-accent:    #ffffff;          // unchanged
  --legience-text-disabled:     #57534d;
  --legience-text-link:         #5b9dff;

  // Borders — translucent white
  --legience-border-hairline:     rgba(255, 255, 255, 0.08);
  --legience-border-subtle:       rgba(255, 255, 255, 0.05);
  --legience-border-emphasis:     rgba(255, 255, 255, 0.14);
  --legience-border-hairline-rgb: 41, 37, 36;

  // Status bg-subtle — reduce saturation slightly for dark
  --legience-success-bg-subtle: rgba(22, 163, 74, 0.18);
  --legience-danger-bg-subtle:  rgba(242, 65, 73, 0.18);
  --legience-warning-bg-subtle: rgba(249, 183, 3, 0.18);
  --legience-info-bg-subtle:    rgba(107, 74, 255, 0.20);

  // Shadows — denser for dark
  --legience-shadow-sm:     0 2px 4px rgba(0, 0, 0, 0.20);
  --legience-shadow:        0 1px 3px rgba(0, 0, 0, 0.25);
  --legience-shadow-button: 0 1px 2px rgba(0, 0, 0, 0.20), 0 2px 3px rgba(0, 0, 0, 0.30);
  --legience-shadow-md:     0 4px 12px -4px rgba(0, 0, 0, 0.30);
  --legience-shadow-lg:     0 8px 24px -8px rgba(0, 0, 0, 0.40);
  --legience-shadow-xl:     0 14px 32px rgba(0, 0, 0, 0.55);

  // Code/kbd — chip on dark
  --legience-bg-kbd:        #292524;
  --legience-border-kbd:    rgba(255, 255, 255, 0.08);
  --legience-text-kbd:      #d4d2d1;
}
```

## 4. Token migration map (full)

138 distinct `--vz-*` tokens are used in app code (`src/`). Each maps to a `--legience-*` equivalent. Categories:

- **Pure rename** — value is identical; `sed` replacement is safe
- **Intentional shift** — value drifts toward Rox spec; documented per case
- **Add-then-rename** — new legience token must be added first
- **Keep as shim only** — Bootstrap-internal (`--vz-table-*`, `--vz-modal-bg`, etc.); allowed only in shim files

Full mapping table (138 entries) is generated mechanically in Phase 0.5 from this spec; the table below shows representative entries. The complete table will live at `docs/superpowers/audits/2026-05-05-rox-tokens-vz-to-legience-map.md`.

### 4.1 Sample mapping (representative; full audit in Phase 0.5)

| `--vz-*` (uses) | → `--legience-*` | Resolved value | Class |
|---|---|---|---|
| `--vz-primary` (425) | `--legience-accent` | `#0b64e9` | Pure rename |
| `--vz-border-color` (421) | `--legience-border-hairline` | `#e7e5e4` | Pure rename |
| `--vz-secondary-color` (345) | `--legience-text-subtle` | `#57534d` | Pure rename |
| `--vz-primary-rgb` (240) | `--legience-accent-rgb` | `11, 100, 233` | Pure rename |
| `--vz-heading-color` (209) | `--legience-text-primary` | `#0c0a09` | Pure rename |
| `--vz-success` (176) | `--legience-success` | `#16a34a` | Add-then-rename |
| `--vz-body-color` (152) | `--legience-text-primary` | `#0c0a09` | Pure rename |
| `--vz-success-rgb` (125) | `--legience-success-rgb` | `22, 163, 74` | Add-then-rename |
| `--vz-info` (117) | `--legience-info` | `#6b4aff` | Pure rename |
| `--vz-danger` (104) | `--legience-danger` | `#f24149` | Pure rename |
| `--vz-info-rgb` (92) | `--legience-info-rgb` | `107, 74, 255` | Pure rename |
| `--vz-light-rgb` (84) | `--legience-bg-card-hover-rgb` | `245, 245, 244` | Pure rename |
| `--vz-warning` (80) | `--legience-warning` | `#f9b703` | Pure rename |
| `--vz-light` (77) | `--legience-bg-card-hover` | `#f5f5f4` | Pure rename |
| `--vz-card-bg` (77) | `--legience-bg-card` | `#ffffff` light / `#141414` dark | Pure rename (with new dark-mode definition) |
| `--vz-secondary-rgb` (73) | `--legience-text-subtle-rgb` | `87, 83, 77` | Add-then-rename |
| `--vz-danger-rgb` (61) | `--legience-danger-rgb` | `242, 65, 73` | Pure rename |
| `--vz-warning-rgb` (59) | `--legience-warning-rgb` | `249, 183, 3` | Pure rename |
| `--vz-secondary` (37) | `--legience-text-subtle` | `#57534d` | Pure rename |
| `--vz-gray-600` (37) | `--legience-text-subtle` | `#57534d` | Pure rename |
| `--vz-gray-800` (25) | `--legience-text-secondary` | `#1c1917` | Pure rename |
| `--vz-link-color` (24) | `--legience-text-link` | `#0b64e9` | Add-then-rename |
| `--vz-tertiary-bg` (23) | `--legience-bg-subtle` | `#ececea` | Pure rename |
| `--vz-border-radius` (23) | `--legience-radius` | `0.375rem` | Pure rename |
| `--vz-gray-500` (22) | `--legience-text-muted` | drift `#78716c → #a6a09b` | **Intentional shift** (Rox spec value) |
| `--vz-gray-400` (21) | `--legience-text-muted` | drift `#a6a09b ↔ same` | Pure rename |
| `--vz-secondary-bg` (19) | `--legience-bg-card` | `#ffffff` | Pure rename |
| `--vz-gray-700` (19) | `--legience-text-secondary` | drift `#44403c → #1c1917` | **Intentional shift** (Rox spec value) |
| `--vz-dark-rgb` (16) | `--legience-text-primary-rgb` | `12, 10, 9` | Add-then-rename |
| `--vz-font-weight-semibold` (15) | `--legience-font-weight-semibold` | `600` | Add-then-rename |
| `--vz-primary-bg-subtle` (14) | `--legience-accent-bg-subtle` | `rgba(11,100,233,0.04)` | Pure rename |
| `--vz-gray-100` (13) | `--legience-bg-page` | drift — slight | **Intentional shift** |
| `--vz-border-color-rgb` (13) | `--legience-border-hairline-rgb` | `231, 229, 228` | Pure rename |
| `--vz-border-color-light` (13) | `--legience-border-subtle` | `#f0efef` | Pure rename |
| `--vz-success-bg-subtle` (11) | `--legience-success-bg-subtle` | `rgba(22,163,74,0.10)` | Add-then-rename |
| `--vz-card-cap-bg` (11) | `--legience-bg-card-hover` | `#f5f5f4` | Pure rename (heading area of cards) |
| `--vz-input-bg` (9) | `--legience-bg-input` | `#ffffff` | Pure rename |
| `--vz-info-bg-subtle` (9) | `--legience-info-bg-subtle` | `rgba(107,74,255,0.10)` | Pure rename |
| `--vz-font-weight-medium` (9) | `--legience-font-weight-medium` | `500` | Add-then-rename |
| `--vz-font-size-sm` (8) | `--legience-font-size-sm` | `14px` | Add-then-rename |
| `--vz-warning-bg-subtle` (9) | `--legience-warning-bg-subtle` | `rgba(249,183,3,0.10)` | Pure rename |
| `--vz-danger-bg-subtle` (8) | `--legience-danger-bg-subtle` | `rgba(242,65,73,0.10)` | Pure rename |
| `--vz-body-bg` (8) | `--legience-bg-page` | `#f5f5f4` | Pure rename |
| `--vz-light-subtle` (7) | `--legience-bg-card-hover` | `#f5f5f4` | Pure rename |
| `--vz-dark` (7) | `--legience-text-primary` | `#0c0a09` | Pure rename |
| `--vz-input-border` (6) | `--legience-border-hairline` | `#e7e5e4` | Pure rename |
| `--vz-gray-300` (6) | `--legience-border-emphasis` | `#d4d2d1` | Pure rename |
| `--vz-gray-200` (6) | `--legience-bg-subtle` | `#ececea` | Pure rename |
| `--vz-font-monospace` (6) | `--legience-font-monospace` | (font stack) | Add-then-rename |
| `--vz-font-size-xs` (6) | `--legience-font-size-xs` | `12px` | Add-then-rename |
| `--vz-border-radius-lg` (6) | `--legience-radius-lg` | `0.5rem` | Pure rename |
| `--vz-white` (5) | `--legience-color-surface-white` | `#ffffff` | Pure rename |
| `--vz-warning-border-subtle` (5) | `--legience-warning-bg-subtle` | (similar) | Pure rename |
| `--vz-light-bg-subtle` (5) | `--legience-bg-page` | `#f5f5f4` | Pure rename |
| `--vz-card-border-radius` (5) | `--legience-radius-lg` | `0.5rem` | Pure rename |
| `--vz-input-bg-custom` (5) | `--legience-bg-input` | `#ffffff` | Pure rename |
| `--vz-dark-bg-tertiary` (5) | `--legience-bg-subtle` | dark mode only | Pure rename |
| `--vz-box-shadow` (5) | `--legience-shadow` | (shadow) | Pure rename |
| `--vz-text-muted` (4) | `--legience-text-subtle` | `#57534d` | Pure rename — Velzon's `--vz-text-muted` was overridden to `#57534d` (Rox text-subtle, not Rox text-muted) in `_foundation.scss`; mapping reflects actual resolved value |
| `--vz-warning-text-emphasis` (4) | `--legience-warning` | `#f9b703` | Pure rename |
| `--vz-success-text-emphasis` (4) | `--legience-success` | `#16a34a` | Add-then-rename |
| `--vz-info-text-emphasis` (4) | `--legience-info` | `#6b4aff` | Pure rename |
| `--vz-info-subtle` (4) | `--legience-info-bg-subtle` | `rgba(107,74,255,0.10)` | Pure rename |
| `--vz-info-border-subtle` (4) | `--legience-info-bg-subtle` | (similar) | Pure rename |
| `--vz-input-color` (4) | `--legience-text-primary` | `#0c0a09` | Pure rename |
| `--vz-input-border-color` (4) | `--legience-border-hairline` | `#e7e5e4` | Pure rename |
| `--vz-font-primary` (4) | `--legience-font-sans` | (font stack) | Pure rename |
| `--vz-dark-text-color` (4) | `--legience-text-primary` | dark mode only | Pure rename |
| `--vz-dark-border-color` (4) | `--legience-border-hairline` | dark mode only | Pure rename |
| `--vz-border-color-translucent` (4) | `--legience-border-subtle` | `rgba(...)` | Pure rename |
| `--vz-tertiary-color` (3) | `--legience-text-muted` | `#a6a09b` | Pure rename |
| `--vz-primary-darker` (3) | `--legience-accent-hover` | `#0a55c5` | Add-then-rename |
| `--vz-primary-border-subtle` (3) | `--legience-accent-bg-subtle` | `rgba(...)` | Pure rename |
| `--vz-input-focus-bg` (3) | `--legience-bg-input` | `#ffffff` | Pure rename |
| `--vz-gray-900` (3) | `--legience-text-primary` | `#0c0a09` | Pure rename |
| `--vz-danger-subtle` (3) | `--legience-danger-bg-subtle` | (similar) | Pure rename |
| `--vz-danger-border-subtle` (3) | `--legience-danger-bg-subtle` | (similar) | Pure rename |
| `--vz-card-box-shadow` (3) | `--legience-shadow-sm` | (shadow) | Pure rename |
| `--vz-card-border-color` (3) | `--legience-border-hairline` | `#e7e5e4` | Pure rename |
| `--vz-box-shadow-sm` (3) | `--legience-shadow-sm` | (shadow) | Pure rename |
| `--vz-border-radius-pill` (3) | `--legience-radius-pill` | `100px` | Pure rename |
| `--vz-purple` (1) | `--legience-info` | `#6b4aff` (Rox status-violet) | Pure rename |
| `--vz-orange` (1) | `--legience-orange` | `#f97006` | Add-then-rename |
| `--vz-table-*` (4 distinct) | shim-only — keep `--vz-*` since Bootstrap reads them directly | — | Keep as shim only |
| `--vz-modal-bg` (1) | shim-only | — | Keep as shim only |
| `--vz-dropdown-*` (2) | shim-only | — | Keep as shim only |
| `--vz-input-padding-x` etc. (5) | shim-only — Bootstrap form controls | — | Keep as shim only |

The complete list of 138 vz tokens lives in the audit document (Phase 0.5).

### 4.2 Tokens NOT migrated (kept as shim-only)

Bootstrap-internal vendor variables that only Bootstrap reads:

- `--vz-table-bg`, `--vz-table-color`, `--vz-table-color-state`, `--vz-table-color-type`, `--vz-table-hover-bg`, `--vz-table-striped-bg`, `--vz-table-striped-color`
- `--vz-modal-bg`
- `--vz-dropdown-bg`, `--vz-dropdown-link-color`
- `--vz-input-padding-x`, `--vz-input-padding-y`, `--vz-input-border-radius`, `--vz-input-focus-border-color`, `--vz-input-focus-box-shadow`, `--vz-input-focus-color`, `--vz-input-disabled-bg`, `--vz-input-box-shadow`, `--vz-input-placeholder-color`, `--vz-input-border-custom`
- `--vz-nav-link-color`, `--vz-link-hover-color`
- `--vz-vertical-menu-bg` (Velzon sidebar)
- `--vz-text-white-dark` (Velzon-specific)
- `--vz-code-color`
- `--vz-card-bg-rgb`, `--vz-card-bg-custom`

These remain in `_foundation.scss` and `_dark-mode.scss` as `var(--legience-*)` derivations (so the underlying value still flows from the canonical source), but they are never referenced by app code — only by Bootstrap's compiled vendor CSS.

App code may NOT reference these. Stylelint will block.

## 5. Phasing

Each phase produces an independently shippable commit. Each passes visual regression before merging.

### Phase 0 — Token canonicalization (½ day)

**Files:**
- Modify: `src/assets/scss/themes/_legience-tokens.scss`
- Modify: `src/assets/scss/themes/rox/_foundation.scss`
- Modify: `src/assets/scss/themes/rox/_dark-mode.scss`

**Steps:**
1. Define all canonical `--legience-*` tokens in `_legience-tokens.scss` per Section 3 (light + dark).
2. Reverse `_foundation.scss`: every `--vz-*: <hex>` becomes `--vz-*: var(--legience-*)`. No raw hex values remain in foundation.
3. Same for `_dark-mode.scss`.
4. Add `--legience-bg-card: #141414 !important` to dark mode (per user direction).
5. Verify dev server starts; verify Bootstrap components (`.btn`, `.card`, `.modal`, `.alert`, `.badge`, `.form-control`) render unchanged in light + dark.

**Test:**
- Open `/home`, `/legal/cases/10`, `/clients`, `/billing` in light + dark.
- Capture Playwright screenshots; compare to baseline (none yet — these become baselines).
- Resolve `getComputedStyle()` of `.btn-primary`, `.card`, `.modal`, `.text-muted` for sanity.

**Commit message:** `Reverse token dependency: legience-* canonical, vz-* compat shim`

### Phase 0.5 — Value-equivalence audit (½ day)

**Files:**
- Create: `docs/superpowers/audits/2026-05-05-rox-tokens-vz-to-legience-map.md`
- Create: `docs/superpowers/audits/2026-05-05-rox-tokens-intentional-shifts.md`

**Steps:**
1. Resolve every `--vz-*` token's computed value (via headless browser or `getComputedStyle()` automation).
2. Resolve every proposed `--legience-*` mapping's computed value.
3. Generate full table: `vz token → legience token → vz value → legience value → match? → notes`.
4. List every "intentional shift" case (about 5-10 entries expected — gray-500, gray-700, etc.).
5. Save as the audit document. Reference from this spec.
6. Update `rox-official.html` per Section 7.

**Output gate:** User reviews the intentional-shifts list before any sweep starts. Any intentional shift the user rejects = we add a new legience token to preserve the original value.

**Commit message:** `Add vz-to-legience value-equivalence audit + Rox reference update`

### Phase 1 — Sweep small files (1 day)

**Files (~30 files, ≤10 vz refs each, ~250 refs total):**
- Top examples: layouts/topbar, layouts/sidebar, layouts/footer, common/preloader, shared/components/*, shared/widgets/*, faqs, tos-acceptance-modal, dev-tools, command-palette (already mostly clean), buttons, badges, ng-select customizations, sweetalert customizations, flatpickr customizations.

**Steps per file:**
1. `grep -n "var(--vz-" <file>` — list every reference.
2. For each reference, look up the migration map.
3. Replace `var(--vz-X)` with `var(--legience-Y)` per the map.
4. Run dev server; verify component renders unchanged in light + dark.
5. Take Playwright screenshot of the affected route.
6. `git add <file>` only.

**Commit cadence:** One commit per logical group of files (e.g., "Sweep topbar + sidebar layouts"). Don't bundle unrelated files.

**Visual regression:** Light + dark capture for each affected route. Compare to Phase 0 baseline. <2% diff = pass.

### Phase 2 — Sweep medium files (2 days)

**Files (~30 files, 10-50 vz refs, ~700 refs total):**
- Modules: `legal/components/calendar/*`, `legal/components/case-details/*`, `expenses/components/*`, `time-tracking/components/*`, `settings/tabs/*`, `admin/components/*`, `organization-management/*`, `compliance/*`, `messages/*`.

**Steps:** same as Phase 1. Bigger files get committed individually (one file = one commit).

**Visual regression:** Per-route screenshots. Affected routes per file is ~1-3.

### Phase 3 — Sweep heavy files (3 days)

**Files (top 10 files, 60+ vz refs each, ~915 refs total):**

| File | vz refs |
|---|---|
| `component/home/home/home.component.css` | 201 |
| `component/dashboards/client/client-dashboard.component.css` | 159 |
| `component/case-task/task-management/task-management.component.css` | 108 |
| `component/case-assignment/case-assignment-dashboard/case-assignment-management.component.css` | 101 |
| `component/activities/activities.component.css` | 97 |
| `component/dashboards/secretary/secretary-dashboard.component.css` | 74 |
| `styles.scss` (global) | 63 |
| `component/dashboards/admin/admin-dashboard.component.css` | 56 |
| `modules/expenses/components/expense-details/expense-details.component.css` | 42 |
| `modules/expenses/components/expense-category/expense-category.component.css` | 42 |

**Steps per file:**
1. Read entire file.
2. Build per-file mapping list.
3. Replace mechanically (sed or Edit tool, file-by-file).
4. Visual regression on the heavy dashboards: full-page screenshot, light + dark, compared to Phase 0 baseline.
5. **For dashboards specifically**, capture additional states: chart hover, dropdown open, modal open, mobile breakpoint.
6. Each file = one commit.

**Risk concentration:** This phase has the highest visual-drift risk (gray-scale ambiguity, etc.). Each file gets explicit user review before merging.

### Phase 4 — Stylelint guard + final regression (½ day)

**Files:**
- Create: `.stylelintrc.json` rule entry
- Create: `tools/stylelint-rules/no-vz-vars-outside-shim.js` (custom plugin)
- Modify: `package.json` (add stylelint script)
- Modify: CI workflow (.github/workflows or similar) to run lint

**Steps:**
1. Write the custom stylelint rule. Allowlist files:
   - `src/assets/scss/themes/_legience-tokens.scss`
   - `src/assets/scss/themes/rox/_foundation.scss`
   - `src/assets/scss/themes/rox/_dark-mode.scss`
   - `src/assets/scss/themes/_design-column.scss`
   - `src/assets/scss/plugins/_datatables.scss`
2. Run lint. Should produce 0 errors (Phases 1-3 cleaned everything).
3. If errors exist, sweep them.
4. Add CI step that runs stylelint on PRs.
5. Final full-app visual regression: capture all routes, light + dark, compare to pre-migration baseline. Document any unexplained drift.

**Commit message:** `Enforce legience-only tokens via stylelint`

## 6. Visual regression strategy

### Routes captured per phase

```
/home                                      (dashboard for current role)
/dashboard/admin
/dashboard/attorney
/dashboard/client
/dashboard/secretary
/legal/cases                                (cases list)
/legal/cases/10                             (case detail — Coastal Restaurants)
/clients                                    (clients list)
/clients/22                                 (client detail)
/billing/dashboard
/billing/invoices
/legal/calendar
/legal/calendar/2026-05                     (calendar month view)
/tasks
/file-manager
/messages
/settings/general
/settings/integrations
/legispace                                  (legacy dashboard)
/intake/new                                 (intake form)
```

Each route captured in **light + dark** = 40 captures per phase.

Plus **modal/overlay states**:
- Command palette open + with search query
- Confirmation modal open
- Dropdown menu open (topbar user menu)
- Date picker open

= 8 additional state captures (light + dark).

**Total per phase:** ~48 captures.

### Threshold

- **<2% pixel diff** from previous phase: pass.
- **2-5% pixel diff**: investigate. Likely an "intentional shift" already documented; verify.
- **>5% pixel diff**: halt. Investigate before merging the phase.

### Tooling

- **Capture:** Playwright (already in repo, `.playwright-mcp/` directory present).
- **Diff:** `pixelmatch` (npm package; ~30 lines of Node script).
- **Storage:** `.playwright-mcp/regression/phase-N/` — light/, dark/, modals/.
- **Baseline:** Phase 0 captures become the baseline. Subsequent phases diff against Phase 0 baseline (not previous phase) so cumulative drift is bounded.

## 7. Rox reference update (`rox-official.html`)

File: `.superpowers/brainstorm/20220-1777837309/content/rox-official.html`.

Add three new sections after the existing "Avatar" section:

### Section: "Surfaces — extended (Legience additions)"

Light/dark swatch grid for:
- bg-card / bg-card-hover / bg-card-active / bg-row-hover / bg-elevated
- bg-input
- overlay-backdrop / overlay-blur

Each swatch shows light + dark value side by side.

### Section: "Status — bg-subtle variants & semantic green (Legience additions)"

- success: #16a34a (Legience addition; Rox has no green — used for confirmations, badges, completed states)
- success-bg-subtle / danger-bg-subtle / warning-bg-subtle / info-bg-subtle (10% alpha pills)

### Section: "Motion / Z-index / Spacing (Legience additions)"

Token cards listing:
- Motion: 4 durations + 2 easings
- Z-index: 6 layer values with usage notes
- Spacing: full Rox scale (1-13)

Each section header explicitly labeled "**(Legience extension — not in tokens.json)**". Preserves the 14 base tokens as canonical Rox.

## 8. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Non-Rox themes (galaxy, saas) break | Med | Med | Phase 0 verifies all `data-design` values render. If any break and aren't used, drop them. If used, foundation flip happens per-theme |
| HTML inline styles using `var(--vz-*)` | High | Low | Sweep includes `*.html` files in Phases 1-3 (counts: 23 files affected) |
| TypeScript files using `var(--vz-*)` | Med | Low | Mostly chart configs; Phases 1-3 sweep includes `*.ts` |
| `--vz-gray-500` / `--vz-gray-700` have no Rox equivalent | High | Low (intentional shift) | Documented in audit table; user reviews before Phase 2/3 sweeps that file |
| Bootstrap rebuild needs reverse compat | Low | High | Compat shim (`_foundation.scss` deriving vz from legience) preserves Bootstrap behavior — verified Phase 0 |
| Dark mode parity gaps in `--legience-*` | Med | Med | Phase 0 explicitly defines every token in both modes; Phase 0.5 audit verifies parity |
| Stylelint rule false positives | Low | Low | Allowlist is precise; only 5 files. Edge cases (e.g., generated files) added to allowlist as discovered |
| Visual regression noise (browser rendering) | Med | Low | 2% threshold accommodates anti-aliasing; cumulative bounding via baseline-not-previous diffs |
| Mid-phase rebase conflicts on heavy files | High during Phase 3 | Med | Each heavy file commits independently; conflicts resolved file-by-file |
| Unintentional removal of Bootstrap vendor reference | Low | High | `--vz-table-*`, `--vz-modal-bg`, etc. explicitly listed as shim-only; sweep regex skips known-internal patterns |

## 9. Success criteria

- [ ] `grep -rln "var(--vz-" src/` returns ONLY the 5 allowlisted shim files.
- [ ] `npm run lint:styles` passes (assuming new stylelint rule is wired up).
- [ ] Visual regression cumulative drift across all routes < 2% from Phase 0 baseline (excluding documented intentional shifts).
- [ ] All Bootstrap components render unchanged: `.btn`, `.card`, `.modal`, `.dropdown`, `.form-control`, `.alert`, `.badge`, `.nav`, `.tab`, `.pagination`, `.tooltip`, `.popover`.
- [ ] Light mode and dark mode both verified at every checkpoint.
- [ ] `rox-official.html` updated with Legience extension sections; clearly labeled.
- [ ] `docs/superpowers/audits/2026-05-05-rox-tokens-vz-to-legience-map.md` exists and is complete.

## 10. Out of scope

- Redesigning any component visually beyond what falls naturally out of "intentional shifts" toward Rox spec.
- Removing Bootstrap or migrating off Velzon.
- Migrating non-Rox themes (galaxy, saas, default) unless Phase 0 reveals they're broken.
- Building a token preview UI / Storybook page.
- Refactoring SCSS architecture beyond the foundation flip.
- Performance optimization of CSS bundle size (separate concern).
- Accessibility audit (separate concern, though may benefit from clearer text-muted contrast in dark mode).

---

## Appendix A — Decision log

| Decision | Rationale |
|---|---|
| Flip dependency direction rather than rebuild Bootstrap | Rebuilding Bootstrap with `$prefix: legience` is 1-2 dev-weeks more work; this approach achieves the same architectural outcome (legience as canonical) with the shim cost being one file |
| Define `--legience-bg-card: #141414 !important` in dark mode | User direction. `!important` on Tier 1 token enforces "legience is canonical" — no downstream selector can override without explicit `!important` |
| Keep `--legience-color-*` (Rox 14) as immutable foundation | Separates "data" (the 14 hex values) from "semantic intent" (everything else). Future Rox spec revisions update color-* only; semantic mappings unchanged |
| Add `--legience-success: #16a34a` despite Rox having no green | Legal SaaS UX requires success/confirmation state. Documented as "Legience extension to Rox" in `rox-official.html` |
| 2% visual regression threshold | Accommodates anti-aliasing differences across browser renders without admitting actual color drift. Stricter (1%) creates noise; looser (5%) allows real drift |
| Phase commits at file granularity for heavy files | Top-10 dashboard files are visually independent; bundling would make rollback hard. One file = one commit = trivial revert |
| `--vz-text-muted` review note in mapping | Velzon's spec says `#a6a09b` (Rox text-muted) but this app's foundation overrode to `#57534d` (Rox text-subtle) — these are NOT the same. Audit will flag every consumer; we choose per-case which Rox value to canonicalize on |

---

## Appendix B — Reference

- Rox official tokens: `.superpowers/brainstorm/20220-1777837309/content/rox-official.html`
- Current Legience tokens: `src/assets/scss/themes/_legience-tokens.scss`
- Current Rox foundation: `src/assets/scss/themes/rox/_foundation.scss`
- Prior Rox theme integration spec: `docs/superpowers/specs/2026-05-04-rox-theme-global-integration-design.md`
- Prior Rox token guide: `docs/superpowers/specs/2026-05-04-rox-theme-token-guide.md`
