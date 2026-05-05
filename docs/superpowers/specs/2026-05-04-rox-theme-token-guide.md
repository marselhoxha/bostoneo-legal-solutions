# Rox theme token guide

> **Audience:** anyone touching SCSS in this codebase. **Updated:** 2026-05-04 (post Phase 0–7 migration).

## TL;DR

- Always reach for `var(--legience-*)` first when picking a colour, surface, border, or shadow.
- Reach for `var(--rox-*)` only when there's no Tier 2 equivalent and you're inside Rox-specific structure (sidebar, topbar overrides).
- **Never** reach for `var(--vz-*)` directly. The Velzon namespace is preserved as Tier 1 *primitive* but isn't a stable contract.
- **Never** wrap a `var()` inside a SCSS colour function (`lighten`, `darken`, `mix`, etc.) — it won't compile. Use `color-mix(in srgb, …)` instead.

## The three tiers

```
┌─────────────────────────────────────────────────────────────┐
│ TIER 1 — Theme primitives (--vz-*, --bs-*, --rox-*)         │
│   Defined in: src/assets/scss/themes/rox/_foundation.scss   │
│   Defined in: src/assets/scss/themes/rox/_dark-mode.scss    │
│   Mutable per theme. Components must NOT reference these.   │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ TIER 2 — Semantic tokens (--legience-*)                     │
│   Defined in: src/assets/scss/themes/_legience-tokens.scss  │
│   Stable contract. Components reference ONLY these.         │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ TIER 3 — Component SCSS                                     │
│   src/app/**/*.component.scss                               │
│   Uses var(--legience-X[, #fallback]) exclusively.          │
└─────────────────────────────────────────────────────────────┘
```

When the active theme changes (Velzon → Rox → Column → future themes), **only Tier 1 needs editing**. Tier 2 picks up new values via `var()` cascade. Tier 3 picks up new values for free.

## Available Tier 2 tokens

### Surfaces

| Token | Light value | Dark value | Use for |
|---|---|---|---|
| `--legience-bg-page` | `var(--vz-body-bg, #f5f5f4)` | dark cascade | App background |
| `--legience-bg-card` | `var(--vz-card-bg)` (often empty → fallback `#fff`) | dark cascade | Card / modal surface |
| `--legience-bg-card-hover` | `var(--vz-light, #f5f5f4)` | `rgba(255,255,255,0.04)` | Hover surfaces, secondary panels |
| `--legience-bg-card-hover-rgb` | `245, 245, 244` | `28, 25, 23` | For `rgba(var(--…), 0.x)` overlays |
| `--legience-bg-subtle` | `var(--vz-tertiary-bg, #ececea)` | `var(--vz-tertiary-bg, #292524)` | Disabled / inactive surfaces |
| `--legience-bg-input` | `var(--vz-input-bg, #fff)` | dark cascade | Form input fields |

### Text

| Token | Light value | Dark value | Use for |
|---|---|---|---|
| `--legience-text-primary` | `var(--vz-heading-color, #0c0a09)` | `var(--vz-heading-color, #fff)` | Headings, prominent labels |
| `--legience-text-secondary` | `var(--vz-body-color, #44403c)` | `var(--vz-body-color, #d4d2d1)` | Body copy |
| `--legience-text-muted` | `#57534d` | `#b8b3ae` | Captions, metadata, helper text |
| `--legience-text-subtle` | `var(--vz-text-muted, #78716c)` | `var(--vz-text-muted, #78716c)` | De-emphasised hints |

> **Why `--legience-text-muted` is hardcoded `#57534d`:** Velzon's default `--vz-secondary-color` (≈ `#a6a09b`) was barely visible on white. Pinning to `#57534d` ensures legibility across themes.

### Borders

| Token | Light value | Dark value | Use for |
|---|---|---|---|
| `--legience-border-hairline` | `var(--vz-border-color, #e7e5e4)` | `rgba(255,255,255,0.08)` | Card / row dividers |
| `--legience-border-hairline-rgb` | `231, 229, 228` | `41, 37, 36` | For `rgba(…)` border overlays |
| `--legience-border-subtle` | `var(--vz-border-color-translucent, …)` | `rgba(255,255,255,0.05)` | Even-softer separations |

### Brand / semantic accents

Each comes in 3 variants: solid (`--legience-X`), rgb triplet (`--legience-X-rgb`), and 10% soft tint (`--legience-X-soft`).

| Family | Light value | Dark value |
|---|---|---|
| `accent` (Rox blue) | `var(--vz-primary, #0b64e9)` | `var(--vz-primary, #5b9dff)` |
| `success` | `var(--vz-success, #16a34a)` | dark cascade |
| `warning` | `var(--vz-warning, #f9b703)` | dark cascade |
| `danger` | `var(--vz-danger, #f24149)` | dark cascade |
| `info` | `var(--vz-info, #6b4aff)` | dark cascade |
| `secondary` | `var(--vz-secondary, #74788d)` | dark cascade |

Plus `--legience-accent-bg-subtle` for Bootstrap 5.3-style soft accent bg.

### Geometry

| Token | Value | Use for |
|---|---|---|
| `--legience-radius-sm` | `4px` | Chips, badges, tiny pills |
| `--legience-radius` | `8px` | Cards, buttons, inputs (Rox default) |
| `--legience-radius-lg` | `12px` | Hero cards, large surfaces |
| `--legience-radius-pill` | `999px` | Pill buttons / badges |
| `--legience-shadow-sm` | `0 1px 2px rgba(0,0,0,0.04)` | Resting cards |
| `--legience-shadow` | `0 1px 3px / 0 1px 2px -1px` | Elevated cards |
| `--legience-shadow-md` | `0 4px 12px -4px rgba(0,0,0,0.10)` | Dropdowns, popovers |
| `--legience-shadow-lg` | `0 8px 24px -8px rgba(0,0,0,0.14)` | Modals, large overlays |
| `--legience-font-sans` | `var(--vz-font-sans-serif, 'Geist', …)` | Body font |

### Category seed colours

Six curated colours used by avatar-color-hash and KPI category icons. **Do NOT change with theme** — they're a curated palette for visual variety, not theme tokens.

`--legience-cat-{blue,orange,green,violet,pink,teal}` plus `-rgb` and `-soft` variants.

## When to use each tier

- **Tier 2 (`--legience-*`)** — 99% of the time. This is the contract.
- **Tier 1 (`--rox-*`)** — only inside `src/assets/scss/themes/rox/_foundation.scss` when defining global structure rules (sidebar, topbar) that need raw theme primitives.
- **Tier 1 (`--vz-*`, `--bs-*`)** — only when porting Velzon-vendored code or when working in `themes/rox/_foundation.scss` to *override* Velzon's primitives. Components must never reference these directly. (Phase 5 + 6 of the migration cleaned out ~6,400 such references.)

## Anti-patterns

### Don't put `var()` inside SCSS color functions

```scss
// ❌ FAILS — SCSS lighten() needs a literal color at compile time
$primary: var(--legience-accent, #0b64e9);
.foo { background: lighten($primary, 10%); }
```

```scss
// ✅ Use bare hex for SCSS variables, or color-mix() for runtime theming
$primary: #0b64e9;
.foo { background: color-mix(in srgb, var(--legience-accent) 90%, white); }
```

### Don't define SCSS variables from CSS variables

```scss
// ❌ Same problem — once you do `$x: var(...)`, $x can never go through
// any SCSS color function downstream.
$brand: var(--legience-accent);
```

### Don't reference `--vz-*` from components

```scss
// ❌ Couples component to Velzon's namespace
.my-card { background: var(--vz-card-bg); }
```

```scss
// ✅ Use the Tier 2 semantic token
.my-card { background: var(--legience-bg-card); }
```

### Always include a hex fallback for Tier 2 tokens

```scss
// ❌ If --legience-bg-card resolves to empty (Velzon's --vz-card-bg unset),
// the property has no value and the element renders transparent.
.my-card { background: var(--legience-bg-card); }
```

```scss
// ✅ Fallback survives the cascade gap.
.my-card { background: var(--legience-bg-card, #fff); }
```

## Adding a new Tier 2 token

1. **Decide it's actually Tier 2** — it should be *semantically* meaningful (not just "this specific shade"). If it's only used in one component, keep it bare hex there.
2. Add the definition to `src/assets/scss/themes/_legience-tokens.scss`:
   ```scss
   --legience-X: var(--vz-Y, #fallback-hex);
   ```
3. If the value should differ in dark mode, add an override under `[data-bs-theme="dark"]` in the same file.
4. If it has an `-rgb` variant (used in `rgba()` calculations), add that too:
   ```scss
   --legience-X-rgb: var(--vz-Y-rgb, R, G, B);
   ```
5. Document it in this guide (the table above).

## Migration tooling

Three idempotent Node scripts in `scripts/`:

| Script | What it does | When to use |
|---|---|---|
| `audit-hex-in-scss.mjs` | Dumps every hex literal in component SCSS to a CSV | Discovery phase: see what needs migrating |
| `migrate-hex-to-tokens.mjs` | Wraps bare `#hex` in `var(--legience-*, #hex)` for known mappings | Bulk first pass on component SCSS |
| `migrate-vz-to-legience.mjs` | Replaces `var(--vz-X)` with `var(--legience-Y)` per the token map | Decoupling components from Velzon namespace |
| `revert-bg-migrations.mjs` | Strips `var(--legience-bg-*, #hex)` wrappers from `background:` properties | Emergency rollback if surface theming causes issues |

All scripts:
- Run with `--dry-run` first to preview
- Are idempotent (safe to re-run)
- Skip lines starting with `$` (SCSS variable defs)
- Skip lines containing SCSS color functions

## Visual regression workflow

The 42 baseline screenshots at `docs/superpowers/baselines/` (gitignored) capture the design at the point of Phase 1 completion. To compare current state against baselines:

1. Re-capture: `node scripts/capture-baselines.mjs` (requires `npm install --save-dev playwright` and a running `ng serve`)
2. Compare: visually inspect baselines vs current screenshots in any image viewer that supports side-by-side
3. Future automation: wire `pixelmatch` or `playwright-visual` into CI

## Migration history (for context)

| Phase | What it did | Files touched |
|---|---|---|
| 0 | Token foundation: defined Tier 2 tokens, hardened with hex fallbacks | 4 theme files |
| 1 | Audit + baselines + priority list | 0 (recon only) |
| 2–4 | Component SCSS migration: bare hex → Legience tokens | 162 |
| 5 | `--vz-*` → `--legience-*` (decouple from Velzon namespace) | 90 |
| 6 | Add missing Tier 2 tokens (secondary, dark, bg-input, *-rgb, …) | ~120 |
| 7 | Migrate hardcoded Velzon-brand-hex in vendored SCSS (toasts, wizard) | 2 vendored |
| Global muted-text fix | Pin `--rox-text-muted`, `--vz-secondary-color`, `--bs-secondary-color` to `#57534d` | foundation only |

Total: ~6,400 token decouplings, ~1,500 hex-to-token wraps, ~50 bare hex remaining (intentional `#fff` on accent buttons, gradients, dark-mode-specific selectors, brand color literals in `linear-gradient(…)`).
