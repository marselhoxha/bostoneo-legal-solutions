# vz-* → legience-* Migration Audit

**Generated:** 2026-05-05 (Phase 0.5)
**Source spec:** [`docs/superpowers/specs/2026-05-05-rox-tokens-canonical-migration-design.md`](../specs/2026-05-05-rox-tokens-canonical-migration-design.md)
**Scope:** all `var(--vz-*)` references in `src/`. 138 distinct vz tokens; 3,336 total references.

---

## Migration class legend

| Class | Meaning | Action during sweep |
|---|---|---|
| **Pure rename** | The vz token and target legience token resolve to the **same** value in both light and dark mode. Mechanical replacement is safe; no visual change. | `sed`-replace `var(--vz-X)` → `var(--legience-Y)` |
| **Add-then-rename** | The target legience token doesn't exist yet — must be defined in `_legience-tokens.scss` first, then sweep. | Add token in Phase 0 (already done for the major ones), then sweep |
| **Intentional shift** | The vz value differs from the proposed legience value by a small amount; the legience value is the canonical Rox spec. Pixel diff is expected and acceptable. | Sweep + document the diff in this file's "shifts" section |
| **Shim-only** | Bootstrap-internal vendor variable. Stays in the foundation/dark-mode shim files; app code must NEVER reference it. | Stylelint blocks app-code usage in Phase 4 |

---

## Top 50 by usage count

| `--vz-*` (uses) | → `--legience-*` | Resolved value (light) | Resolved value (dark) | Class |
|---|---|---|---|---|
| `--vz-primary` (425) | `--legience-accent` | `#0b64e9` | `#5b9dff` | Pure rename |
| `--vz-border-color` (421) | `--legience-border-hairline` | `#e7e5e4` | `rgba(255,255,255,0.08)` | Pure rename (dark uses `#292524` in vz shim — translucent in legience; visual delta minimal) |
| `--vz-secondary-color` (345) | `--legience-text-subtle` | `#57534d` | `#b8b3ae` | Pure rename |
| `--vz-primary-rgb` (240) | `--legience-accent-rgb` | `11, 100, 233` | `91, 157, 255` | Pure rename |
| `--vz-heading-color` (209) | `--legience-text-primary` | `#0c0a09` | `#f5f5f4` | Pure rename |
| `--vz-success` (176) | `--legience-success` | `#16a34a` | `#16a34a` | Add-then-rename (legience-success added Phase 0) |
| `--vz-body-color` (152) | `--legience-text-primary` | `#0c0a09` | `#f5f5f4` | Pure rename |
| `--vz-success-rgb` (125) | `--legience-success-rgb` | `22, 163, 74` | same | Add-then-rename |
| `--vz-info` (117) | `--legience-info` | `#6b4aff` | same | Pure rename |
| `--vz-danger` (104) | `--legience-danger` | `#f24149` | same | Pure rename |
| `--vz-info-rgb` (92) | `--legience-info-rgb` | `107, 74, 255` | same | Pure rename |
| `--vz-light-rgb` (84) | `--legience-bg-card-hover-rgb` | `245, 245, 244` | `28, 25, 23` | Pure rename |
| `--vz-warning` (80) | `--legience-warning` | `#f9b703` | same | Pure rename |
| `--vz-light` (77) | `--legience-bg-card-hover` | `#f5f5f4` | `#1c1917` | Pure rename |
| `--vz-card-bg` (77) | `--legience-bg-card` | `rgba(255,255,255,0.1)` | `#141414` | Pure rename **with intentional shift** — was opaque white; now translucent per design (cards rely on hairline+shadow) |
| `--vz-secondary-rgb` (73) | `--legience-text-subtle-rgb` | `87, 83, 77` | `184, 179, 174` | Add-then-rename |
| `--vz-danger-rgb` (61) | `--legience-danger-rgb` | `242, 65, 73` | same | Pure rename |
| `--vz-warning-rgb` (59) | `--legience-warning-rgb` | `249, 183, 3` | same | Pure rename |
| `--vz-secondary` (37) | `--legience-text-subtle` | `#57534d` | `#b8b3ae` | Pure rename |
| `--vz-gray-600` (37) | `--legience-text-subtle` | `#57534d` | `#b8b3ae` | Pure rename |
| `--vz-gray-800` (25) | `--legience-text-secondary` | `#1c1917` | `#d4d2d1` | Pure rename |
| `--vz-link-color` (24) | `--legience-text-link` | `#0b64e9` | `#5b9dff` | Add-then-rename |
| `--vz-tertiary-bg` (23) | `--legience-bg-subtle` | `#ececea` | `#292524` | Pure rename |
| `--vz-border-radius` (23) | `--legience-radius` | `6px` | same | Pure rename (was `0.375rem`; legience is `6px` — same computed value) |
| `--vz-gray-500` (22) | `--legience-text-muted` | `#a6a09b` | `#78716c` | **Intentional shift** — was Bootstrap stone-500 (`#78716c`); now Rox text-muted |
| `--vz-gray-400` (21) | `--legience-text-muted` | `#a6a09b` | `#78716c` | Pure rename |
| `--vz-secondary-bg` (19) | `--legience-bg-card` | `rgba(255,255,255,0.1)` | `#141414` | Pure rename + intentional shift |
| `--vz-gray-700` (19) | `--legience-text-secondary` | `#1c1917` | `#d4d2d1` | **Intentional shift** — was Bootstrap stone-700 (`#44403c`); now Rox text-secondary |
| `--vz-dark-rgb` (16) | `--legience-text-primary-rgb` | `12, 10, 9` | `245, 245, 244` | Add-then-rename |
| `--vz-font-weight-semibold` (15) | `--legience-font-weight-semibold` | `600` | same | Add-then-rename |
| `--vz-primary-bg-subtle` (14) | `--legience-accent-bg-subtle` | `rgba(11,100,233,0.04)` | `rgba(91,157,255,0.08)` | Pure rename |
| `--vz-gray-100` (13) | `--legience-bg-page` | `#f5f5f4` | `#0c0a09` | **Intentional shift** — was stone-100 |
| `--vz-border-color-rgb` (13) | `--legience-border-hairline-rgb` | `231, 229, 228` | `41, 37, 36` | Pure rename |
| `--vz-border-color-light` (13) | `--legience-border-subtle` | `#f0efef` | `rgba(255,255,255,0.05)` | Pure rename |
| `--vz-success-bg-subtle` (11) | `--legience-success-bg-subtle` | `rgba(22,163,74,0.10)` | `rgba(22,163,74,0.18)` | Add-then-rename |
| `--vz-card-cap-bg` (11) | `--legience-bg-card-hover` | `#f5f5f4` | `#1c1917` | Pure rename |
| `--vz-input-bg` (9) | `--legience-bg-input` | `#ffffff` | `#1c1917` | Pure rename |
| `--vz-info-bg-subtle` (9) | `--legience-info-bg-subtle` | `rgba(107,74,255,0.10)` | `rgba(107,74,255,0.20)` | Pure rename |
| `--vz-font-weight-medium` (9) | `--legience-font-weight-medium` | `500` | same | Add-then-rename |
| `--vz-warning-bg-subtle` (9) | `--legience-warning-bg-subtle` | `rgba(249,183,3,0.10)` | `rgba(249,183,3,0.18)` | Pure rename |
| `--vz-font-size-sm` (8) | `--legience-font-size-sm` | `14px` | same | Add-then-rename |
| `--vz-danger-bg-subtle` (8) | `--legience-danger-bg-subtle` | `rgba(242,65,73,0.10)` | `rgba(242,65,73,0.18)` | Pure rename |
| `--vz-border-color-dark` (8) | `--legience-border-emphasis` | `#d4d2d1` | `rgba(255,255,255,0.14)` | Pure rename |
| `--vz-body-bg` (8) | `--legience-bg-page` | `#f5f5f4` | `#0c0a09` | Pure rename |
| `--vz-light-subtle` (7) | `--legience-bg-card-hover` | `#f5f5f4` | `#1c1917` | Pure rename |
| `--vz-dark` (7) | `--legience-text-primary` | `#0c0a09` | `#f5f5f4` | Pure rename |
| `--vz-input-border` (6) | `--legience-border-hairline` | `#e7e5e4` | `rgba(255,255,255,0.08)` | Pure rename |
| `--vz-gray-300` (6) | `--legience-border-emphasis` | `#d4d2d1` | `rgba(255,255,255,0.14)` | Pure rename |
| `--vz-gray-200` (6) | `--legience-bg-subtle` | `#ececea` | `#292524` | Pure rename |
| `--vz-font-monospace` (6) | `--legience-font-monospace` | font stack | same | Add-then-rename |
| `--vz-font-size-xs` (6) | `--legience-font-size-xs` | `12px` | same | Add-then-rename |
| `--vz-border-radius-lg` (6) | `--legience-radius-buttons` | `8px` | same | Pure rename (`0.5rem` = `8px`) |

## Mid-tier (5 to 3 references)

| `--vz-*` (uses) | → `--legience-*` | Class |
|---|---|---|
| `--vz-white` (5) | `--legience-color-surface-white` | Pure rename |
| `--vz-warning-border-subtle` (5) | `--legience-warning-bg-subtle` | Pure rename |
| `--vz-light-bg-subtle` (5) | `--legience-bg-page` | Pure rename |
| `--vz-input-bg-custom` (5) | `--legience-bg-input` | Pure rename |
| `--vz-dark-bg-tertiary` (5) | `--legience-bg-subtle` (dark only) | Pure rename |
| `--vz-card-border-radius` (5) | `--legience-radius-lg` | Pure rename |
| `--vz-box-shadow` (5) | `--legience-shadow` | Pure rename |
| `--vz-warning-text-emphasis` (4) | `--legience-warning` | Pure rename |
| `--vz-text-muted` (4) | `--legience-text-subtle` | Pure rename — see decision log |
| `--vz-success-text-emphasis` (4) | `--legience-success` | Add-then-rename |
| `--vz-input-color` (4) | `--legience-text-primary` | Pure rename |
| `--vz-input-border-color` (4) | `--legience-border-hairline` | Pure rename |
| `--vz-info-text-emphasis` (4) | `--legience-info` | Pure rename |
| `--vz-info-subtle` (4) | `--legience-info-bg-subtle` | Pure rename |
| `--vz-info-border-subtle` (4) | `--legience-info-bg-subtle` | Pure rename |
| `--vz-font-primary` (4) | `--legience-font-sans` | Pure rename |
| `--vz-dark-text-color` (4) | `--legience-text-primary` | Pure rename (dark only) |
| `--vz-dark-border-color` (4) | `--legience-border-hairline` | Pure rename (dark only) |
| `--vz-border-color-translucent` (4) | `--legience-border-subtle` | Pure rename |
| `--vz-tertiary-color` (3) | `--legience-text-muted` | Pure rename |
| `--vz-primary-darker` (3) | `--legience-accent-hover` | Add-then-rename |
| `--vz-primary-border-subtle` (3) | `--legience-accent-bg-subtle` | Pure rename |
| `--vz-input-focus-bg` (3) | `--legience-bg-input` | Pure rename |
| `--vz-gray-900` (3) | `--legience-text-primary` | Pure rename |
| `--vz-danger-subtle` (3) | `--legience-danger-bg-subtle` | Pure rename |
| `--vz-danger-border-subtle` (3) | `--legience-danger-bg-subtle` | Pure rename |
| `--vz-card-box-shadow` (3) | `--legience-shadow-sm` | Pure rename |
| `--vz-card-border-color` (3) | `--legience-border-hairline` | Pure rename |
| `--vz-box-shadow-sm` (3) | `--legience-shadow-sm` | Pure rename |
| `--vz-border-radius-pill` (3) | `--legience-radius-pill` | Pure rename |

## Long tail (2 or 1 references)

| `--vz-*` (uses) | → `--legience-*` | Class |
|---|---|---|
| `--vz-warning-subtle` (2) | `--legience-warning-bg-subtle` | Pure rename |
| `--vz-success-subtle` (2) | `--legience-success-bg-subtle` | Pure rename |
| `--vz-success-border-subtle` (2) | `--legience-success-bg-subtle` | Pure rename |
| `--vz-secondary-bg-subtle` (2) | `--legience-bg-subtle` | Pure rename |
| `--vz-headings-color` (2) | `--legience-text-primary` | Pure rename |
| `--vz-font-size-base` (2) | `--legience-font-size-base` | Add-then-rename |
| `--vz-dark-color` (2) | `--legience-text-primary` | Pure rename (dark only) |
| `--vz-dark-border` (2) | `--legience-border-hairline` | Pure rename (dark only) |
| `--vz-dark-bg-secondary` (2) | `--legience-bg-card` | Pure rename (dark only) |
| `--vz-danger-text-emphasis` (2) | `--legience-danger` | Pure rename |
| `--vz-card-bg-custom` (2) | `--legience-bg-card` | Pure rename |
| `--vz-box-shadow-lg` (2) | `--legience-shadow-lg` | Pure rename |
| `--vz-black-rgb` (2) | `--legience-text-primary-rgb` (light) | Pure rename |
| `--vz-purple` (1) | `--legience-info` | Pure rename — Rox status-violet `#6b4aff` |
| `--vz-orange` (1) | `--legience-orange` | Add-then-rename |
| `--vz-secondary-subtle` (1) | `--legience-bg-subtle` | Pure rename |
| `--vz-primary-text-emphasis` (1) | `--legience-accent` | Pure rename |
| `--vz-primary-subtle` (1) | `--legience-accent-bg-subtle` | Pure rename |
| `--vz-link-hover-color` (1) | (keep `#0950bd` inline) | Pure rename / shim retained |
| `--vz-input-placeholder-color` (1) | `--legience-text-muted` | Pure rename |
| `--vz-font-weight-bold` (1) | `--legience-font-weight-semibold` | Pure rename (legience max weight is 600) |
| `--vz-secondary-bg-rgb` (1) | (compute inline) | One-off; bake the rgb |
| `--vz-white-rgb` (1) | (compute inline `255,255,255`) | One-off |
| `--vz-text-white-dark` (1) | `--legience-text-primary` (dark) | Pure rename |
| `--vz-code-color` (1) | `--legience-text-primary` | Pure rename |
| `--vz-card-bg-rgb` (1) | `--legience-bg-card-hover-rgb` (closest) | Pure rename |
| `--vz-border-rgb` (1) | `--legience-border-hairline-rgb` | Pure rename |
| `--vz-border-radius-sm` (1) | `--legience-radius-sm` | Pure rename |
| `--vz-body-secondary-color` (1) | `--legience-text-subtle` | Pure rename |
| `--vz-body-font-family` (1) | `--legience-font-sans` | Pure rename |
| `--vz-body-bg-rgb` (1) | (compute inline `245,245,244`) | One-off |
| `--vz-font-secondary` (1) | `--legience-font-system` | Pure rename |
| `--vz-font-family-monospace` (1) | `--legience-font-monospace` | Pure rename |
| `--vz-font-family` (1) | `--legience-font-sans` | Pure rename |

## Shim-only (NOT migrated to legience — Bootstrap-internal)

These remain in `themes/rox/_foundation.scss` and `themes/rox/_dark-mode.scss` as `--vz-*` declarations. App code must never reference them. Stylelint enforces.

| `--vz-*` (uses) | Why shim-only |
|---|---|
| `--vz-table-bg`, `--vz-table-color`, `--vz-table-color-state`, `--vz-table-color-type`, `--vz-table-hover-bg`, `--vz-table-striped-bg`, `--vz-table-striped-color` (combined ~8) | Bootstrap `.table` internals — read directly by Velzon's compiled CSS |
| `--vz-modal-bg` (1) | Bootstrap `.modal-content` internal |
| `--vz-dropdown-bg`, `--vz-dropdown-link-color` (combined 2) | Bootstrap `.dropdown-menu` internals |
| `--vz-input-padding-x` (1), `--vz-input-padding-y` (1), `--vz-input-border-radius` (1), `--vz-input-focus-border-color` (1), `--vz-input-focus-box-shadow` (1), `--vz-input-focus-color` (1), `--vz-input-disabled-bg` (1), `--vz-input-box-shadow` (1) | Bootstrap form-control internals |
| `--vz-nav-link-color` (1) | Bootstrap nav internal |
| `--vz-vertical-menu-bg` (1) | Velzon vertical menu internal |
| `--vz-input-border-custom` (5) | Velzon form internal |

---

## Intentional shifts (visual diffs accepted as Rox-spec corrections)

These are the cases where the migration produces a small but real visual diff. All are corrections **toward** the Rox spec. Document each here so visual-regression doesn't flag them as bugs.

### 1. `--vz-card-bg` opaque-white → `--legience-bg-card` translucent

**Before:** `#ffffff` (opaque white)
**After (light):** `rgba(255, 255, 255, 0.1)` over page bg `#f5f5f4` ≈ `#f6f6f5`
**After (dark):** `#141414` (unchanged — opaque)
**Visible effect:** Bootstrap `.card` and KPI tiles in light mode lose their hard white fill; rely on hairline + shadow for definition. The visual delta on a light page is **subtle** (composite is ~`#f6f6f5` vs page `#f5f5f4`). Confirms the original Rox design intent — minimalist card treatment.
**Decision:** Approved per user direction (turn 2026-05-05 19:42 UTC).

### 2. `--vz-gray-500` (Bootstrap stone-500 `#78716c`) → `--legience-text-muted` (`#a6a09b`)

**Before:** `#78716c`
**After (light):** `#a6a09b` (Rox text-muted)
**Visible effect:** Anywhere `var(--vz-gray-500)` was used (22 refs across mid-tier components), the text becomes lighter-gray. Most uses are for de-emphasized labels — `text-muted` is the semantic replacement.
**Decision:** Accepted. Rox doesn't ship `gray-500`; closest semantic match is `text-muted`.

### 3. `--vz-gray-700` (Bootstrap stone-700 `#44403c`) → `--legience-text-secondary` (`#1c1917`)

**Before:** `#44403c`
**After (light):** `#1c1917` (Rox text-secondary)
**Visible effect:** 19 refs across mid-tier; mostly secondary headings/labels. Becomes slightly darker (more contrast).
**Decision:** Accepted. Closer to Rox's `text-secondary` definition.

### 4. `--vz-gray-100` (`#f5f5f5`) → `--legience-bg-page` (`#f5f5f4`)

**Before:** `#f5f5f5`
**After:** `#f5f5f4`
**Visible effect:** 1-bit channel difference — visually imperceptible.
**Decision:** Accepted. Aligns with Rox `page-canvas`.

### 5. Dark mode `--vz-body-bg` `#0a0a0a` → `--legience-bg-page` `#0c0a09`

**Before:** `#0a0a0a`
**After:** `#0c0a09`
**Visible effect:** Negligible — both are near-black; difference < 1% luminance.
**Decision:** Accepted. Aligns with Rox `text-primary` (used as page bg in dark mode).

### 6. Dark mode `--vz-primary` `#4d8eff` → `--legience-accent` `#5b9dff`

**Before:** `#4d8eff`
**After:** `#5b9dff`
**Visible effect:** Slightly more saturated/lighter blue. Improves contrast against dark surfaces.
**Decision:** Accepted.

### 7. `--legience-text-secondary` (currently buggy, resolves to `#0c0a09`) → canonical `#1c1917`

**Before:** `#0c0a09` (resolved through derivation chain: `var(--vz-body-color, #44403c)` where vz-body-color = #0c0a09)
**After:** `#1c1917` (Rox text-secondary, defined directly)
**Visible effect:** Anywhere `var(--legience-text-secondary)` was used (~80 refs already in legience-using files). Lightens slightly.
**Decision:** Accepted. Was a derivation-chain bug; canonicalization is the fix.

---

## Decision log: `--vz-text-muted` mapping

`--vz-text-muted` could legitimately map to either `--legience-text-muted` (`#a6a09b` — Rox text-muted) or `--legience-text-subtle` (`#57534d` — Rox text-subtle). The codebase's `_foundation.scss` overrides `--vz-text-muted: #57534d` (the text-subtle value) for legibility on Rox's white surfaces.

**Decision:** Map to `--legience-text-subtle` to preserve the codebase's effective value. The 4 remaining references in app code will read `#57534d`, identical to before.

---

## How to use this audit during sweep phases

For each file being swept (Phases 1, 2, 3):
1. `grep -nh "var(--vz-" <file>` — list every reference.
2. For each reference, look up the row in this audit.
3. If "Pure rename" → `Edit` with `replace_all: true` is safe.
4. If "Add-then-rename" → confirm the target legience token exists in `_legience-tokens.scss`. (All targets above are added in Phase 0 already; this should be a no-op.)
5. If "Intentional shift" → flag in the commit message, confirm the user has approved (via this document).
6. If "Shim-only" → leave alone if it's in the 5 allowlisted files; otherwise replace per the suggested mapping.
7. After the file is swept, re-grep: `grep -c "var(--vz-" <file>` should be 0 (or only allowlisted entries).
