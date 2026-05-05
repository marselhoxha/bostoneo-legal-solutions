# Rox theme — global integration design spec

**Date:** 2026-05-04
**Author:** Marsel Hoxha (with Claude)
**Status:** Approved for implementation
**Predecessor work:** Attorney dashboard Rox theming, PI case detail polish, topbar clean replacement spec

---

## 1. Goal

Bring the Rox theme to **every page in the application** with consistent, intentional styling — eliminating the current state where some pages look themed (attorney dashboard, PI case detail, topbar) and others look raw or half-themed.

The work is **token-first**: instead of restyling each page individually, we fix the foundation (Tier 2 tokens with theme-aware fallbacks) and migrate hardcoded hex colours to tokens — so that future Rox tweaks propagate to every page automatically.

The work is **fully reversible**: each migration is its own commit, every phase ships on its own branch, and the PI case detail page is **explicitly excluded from migration** to preserve its current polished styling.

## 2. Why this spec — diagnosis of current state

Audit findings (verified by counting files in `src/app/`):

| Metric | Count | Implication |
|---|---|---|
| Component SCSS files | 168 | Scope of surface area |
| Files using `var(--vz-*)` | 131 (78%) | Velzon tokens widely adopted |
| Files using `var(--legience-*)` | 5 (3%) | Tier 2 tokens almost no adoption |
| Files with hardcoded hex colours | 118 (70%) | This is the actual gap |

### Key insight: most of the app IS themed, just inconsistently

The Rox theme works by **redefining `--vz-*` tokens at `:root[data-design="rox"]`**. Components that use `var(--vz-card-bg)`, `var(--vz-primary)`, etc. automatically pick up Rox values via cascade.

The visual gap users perceive comes from **two narrow problems**:

1. **Hardcoded hex colours bypass the token system.** A component using `#666` for text never gets re-coloured by Rox. 70% of files have at least one hardcoded hex.
2. **Some `--vz-*` tokens are empty on certain routes.** Velzon emits CSS variables only for the partials it loads. The `--vz-card-bg` empty-string bug recently hit on the topbar is one example. Tier 2 fallbacks were intended to insulate consumers but most fallbacks are missing or themselves rely on potentially-empty Velzon vars.

### Why "rebuild every page" is the wrong instinct

A page-by-page reskin would:
- Touch 200+ component files
- Take weeks
- Leave the underlying token system equally broken
- Require the same migration again the next time we change a brand colour

A token-first migration:
- Touches files that NEED touching (118 with hex)
- Each touch is mechanical (find hex, look up matching token, replace)
- Future colour changes propagate to every page automatically
- Migration cost is one-time

## 3. Strategy

**Token migration + foundation hardening.** Three layers:

### Layer 1 — Foundation hardening (zero visual changes)

Audit the Tier 2 token system in `_legience-tokens.scss`. Every token must:

- Have a hardcoded fallback value if its `--vz-*` upstream is potentially empty
- Be theme-aware (light + dark mode definitions)
- Resolve to a meaningful value on every layout/route the app uses

Specifically:
- `--legience-bg-card`: light → `#ffffff`, dark → `#1c1917`
- `--legience-bg-card-hover`: light → `#f5f5f4`, dark → `rgba(255,255,255,0.04)` (already correct)
- `--legience-text-primary`: light → `#1c1917`, dark → `#ffffff`
- `--legience-text-secondary`: light → `#44403c`, dark → `#d4d2d1`
- `--legience-text-muted`: light → `#57534d`, dark → `#b8b3ae` (already correct)
- `--legience-border-hairline`: light → `#e7e5e4`, dark → `rgba(255,255,255,0.08)` (already correct)
- `--legience-accent`, `--legience-accent-rgb`, `--legience-accent-soft`
- `--legience-success`, `--legience-warning`, `--legience-danger`, `--legience-info`
- Surface variants: `--legience-bg-page`, `--legience-bg-subtle`
- Shadow tokens (already correct)
- Radius tokens (already correct)

This phase **does not change any component styling** — it just hardens the tokens that components already reference. Visual diff: zero.

### Layer 2 — Hex audit + migration (per-component)

For each of the 118 files with hardcoded hex:

1. **Audit pass** — list all hex colours in the file, identify whether each maps to a Tier 2 token or is genuinely page-specific
2. **Migration pass** — replace mappable hex with token references. Leave page-specific custom values as-is
3. **Visual verify** — screenshot the page before and after, compare in light + dark mode

Mapping reference (the most common patterns):

| Hex value | Map to |
|---|---|
| `#fff`, `#ffffff` | `var(--legience-bg-card)` (if surface) or keep |
| `#000`, `#000000`, `#0c0a09`, `#1c1917` | `var(--legience-text-primary)` (if text) |
| `#44403c`, `#666`, `#717171` | `var(--legience-text-secondary)` |
| `#57534d`, `#999`, `#a6a09b` | `var(--legience-text-muted)` |
| `#e7e5e4`, `#e5e7eb`, `#ddd`, `#dcdcdc` | `var(--legience-border-hairline)` |
| `#0b64e9`, `#0950bd`, `#2563eb` | `var(--legience-accent)` |
| `#16a34a`, `#22c55e` | `var(--legience-success)` |
| `#f97006`, `#f59e0b`, `#f9b703` | `var(--legience-warning)` |
| `#dc2626`, `#ef4444`, `#f24149` | `var(--legience-danger)` |
| Custom shadows | `var(--legience-shadow-sm/md/lg)` |
| Page-specific gradients, brand-specific accents | **leave as-is** |

### Layer 3 — Foundation gap-fill (Rox `_foundation.scss` additions)

For UI patterns the existing `rox/_foundation.scss` doesn't cover yet — flagged during page-by-page QA — add overrides at the global Rox layer.

Examples likely needed:
- Calendar component (FullCalendar / NgxCalendar styling)
- Date pickers (Flatpickr) beyond what `_polish.scss` already covers
- Specific table variants (sortable headers, action columns)
- File upload widgets
- Rich text editor (CKEditor) chrome

These additions are pattern-level fixes that benefit every page using those patterns.

## 4. Safety guardrails — reversibility plan

### Guardrail 1 — Per-commit granularity

Every component migration is its own commit. Format:

```
feat(rox): migrate <component> to tokens
- 14 hex values mapped to --legience-* tokens
- 2 page-specific values preserved (line N, M)
- Visual verified: light + dark mode unchanged
```

If any single migration regresses something: `git revert <sha>` rolls back JUST that file. No collateral damage.

### Guardrail 2 — Visual baseline workflow

Before migrating any page:

1. Open the page in light mode → screenshot to `docs/superpowers/baselines/<page>-light.png`
2. Switch to dark mode → screenshot to `docs/superpowers/baselines/<page>-dark.png`
3. These become the **reference for "did the migration preserve the design?"**

After migration:
4. Re-screenshot
5. Compare with baseline pixel-by-pixel (or visually)
6. If unchanged → migration succeeded. If changed → either (a) acceptable improvement (theme is now correct where it wasn't before), or (b) regression to investigate

### Guardrail 3 — Phase-per-branch architecture

```
develop
  └── topbar-redesign (current branch)
       └── phase-0-token-hardening      ← invisible, low-risk
            └── phase-1-protect-baselines     ← captures baselines, no migrations
                 └── phase-2-high-priority-pages   ← migrate priority pages
                      └── phase-3-remaining-modules  ← migrate the rest
                           └── phase-4-foundation-gap-fill
```

Each phase merges to its parent only after review. If a phase produces unwanted results: discard the branch (or `git revert` the merge), keep earlier phases.

### Guardrail 4 — Opt-in migration for low-priority pages

We do NOT migrate every component blindly. Instead:

- **Mandatory migration** — pages that are visually broken today (mismatched colours, illegible contrast, half-themed appearance)
- **Optional migration** — pages that look acceptable today (low ROI, but token-cleanliness benefits future-proofing)
- **Forbidden migration** — pages explicitly preserved (PI case detail, attorney dashboard since it just shipped, anywhere the user flags as off-limits)

The audit phase classifies each page into these three buckets. Only mandatory pages get touched in this spec's scope.

### Guardrail 5 — PI case detail is explicitly excluded

Files in `src/app/modules/legal/components/case/pi-case-detail/` are **not migrated**. They stay with their current styling intact. Their hardcoded values (whatever shade of grey, whatever shadow weight) are documented as page-specific and protected by an exclusion list in the audit script.

If the migration script encounters these files: skip with a logged "intentionally preserved" note.

## 5. Phase structure

### Phase 0 — Token hardening (1–2 hours, zero visual change)

**Goal:** ensure every Tier 2 token resolves to a defined value in light + dark mode regardless of which Velzon partials are loaded.

**Files:**
- `src/assets/scss/themes/_legience-tokens.scss` — add hardcoded fallbacks for tokens lacking them
- (Optional) `src/assets/scss/themes/rox/_foundation.scss` — explicit re-emission of any `--vz-*` token that's empty on horizontal-layout routes

**Acceptance:** open every major route, query `getComputedStyle(document.documentElement).getPropertyValue('--legience-X')` for each token; all return non-empty strings.

**Commit:** one commit. Pure additive. Easy revert.

### Phase 1 — Visual baselines (1 hour, zero code change)

**Goal:** capture light+dark-mode screenshots of every page that will (or might) be migrated.

**Output:** `docs/superpowers/baselines/<route-path>-<theme>.png`

Key routes to baseline:
- `/home` (attorney dashboard) — already protected
- `/legal/cases` (case list)
- `/legal/cases/:id` (PI case detail) — **excluded from migration but baseline kept for documentation**
- `/legal/calendar`
- `/case-management/tasks`
- `/clients`
- `/billing-dashboard`, `/time-tracking/dashboard`, `/time-tracking/entry`, `/time-tracking/approval`, `/time-tracking/rates`
- `/invoices` (and sub-routes)
- `/expenses` (and sub-routes)
- `/crm/dashboard`, `/crm/intake-submissions`, `/crm/leads`
- `/signatures`
- `/legal/ai-assistant/legispace`
- `/legal/ai-assistant/legipi`
- `/legal/ai-assistant/templates`
- `/settings/profile`
- `/settings/organization`
- `/superadmin/dashboard` (admin/superadmin views)

**Commit:** baselines committed. The `.png` files live in the docs directory under `.superpowers/baselines/` (gitignored if user prefers, otherwise committed for reference).

### Phase 2 — High-priority page migrations

Pages that are mandatory based on the audit (visually broken today). Per the user's earlier feedback, the dashboards beyond attorney are likely candidates.

For each page:
1. Screenshot baseline (already done in phase 1)
2. Audit hex values, classify as mappable / page-specific / brand-specific
3. Migrate mappable hex to tokens
4. Re-screenshot
5. Compare with baseline
6. Commit single component as one commit

**Commit:** one commit per component. Format: `refactor(rox): migrate <component> to tokens`.

### Phase 3 — Remaining modules

Lower-priority modules — settings pages, less-trafficked routes, admin/superadmin views, public marketing pages.

Same workflow as Phase 2, just lower priority.

### Phase 4 — Foundation gap-fill

For UI patterns where Rox `_foundation.scss` doesn't cover what's needed (calendar, datepicker variants, file uploaders, rich text editor chrome), add new Rox overrides to address gaps surfaced during phase 2 + 3.

## 6. Audit methodology

### Audit script

Build a small Node script in `scripts/audit-hex-in-scss.mjs` that:

1. Walks `src/app/**/*.scss` excluding the exclusion list
2. For each file: counts hex colour usages, lists them with line numbers
3. Outputs a CSV: `file,line,hex,suggested_token`
4. Suggested token comes from a static map (defined inline in the script) of common hex → token mappings (per the table in §3 Layer 2)

Run output goes to `docs/superpowers/audits/2026-05-04-hex-audit.csv`. We use this as the work queue for phases 2 + 3.

### Exclusion list (audit-level)

```
src/app/modules/legal/components/case/pi-case-detail/**     # PI case detail — protected
src/app/component/dashboards/attorney/**                     # Attorney dashboard — already done
src/app/component/layouts/topbar/**                          # Topbar — already done
src/app/component/layouts/horizontal-topbar/**               # Bar 2 — already done
src/app/component/layouts/ai-quick-drawer/**                 # New, already token-clean
src/styles.scss                                              # Global imports, not migration-relevant
```

### Per-component audit workflow

For each file in the work queue:

1. Open file
2. List every `#hexvalue` in the SCSS
3. For each hex:
   - Does it match a token in the mapping table?
   - If yes: candidate for migration
   - If no: classify as (a) brand-specific (preserve), (b) needs new token (escalate), (c) one-off page styling (preserve)
4. Apply migrations
5. Visual verify
6. Commit

## 7. Dark mode verification

After all phases complete, walk every migrated route in dark mode:

- Open route in light mode → confirm visual is correct
- Toggle dark mode (theme switch in topbar)
- Confirm:
  - Surfaces are dark (cards, modals, dropdowns)
  - Text is readable (contrast WCAG AA)
  - Hairline borders visible but not dominant
  - Hover/active states still legible
  - No flash of light content during navigation

For any route where dark mode breaks: identify which token is at fault, fix the dark-mode override in `_legience-tokens.scss` or `rox/_dark-mode.scss`.

## 8. Files affected

| Category | Path | Action |
|---|---|---|
| **Foundation tokens** | `src/assets/scss/themes/_legience-tokens.scss` | Add fallbacks (Phase 0) |
| **Foundation Rox overrides** | `src/assets/scss/themes/rox/_foundation.scss` | Gap-fill new patterns (Phase 4) |
| **Foundation Rox overrides** | `src/assets/scss/themes/rox/_dark-mode.scss` | Add dark-mode fixes (Phase 4) |
| **Audit tooling** | `scripts/audit-hex-in-scss.mjs` | NEW — audit script (Phase 0) |
| **Audit output** | `docs/superpowers/audits/2026-05-04-hex-audit.csv` | NEW — work queue |
| **Visual baselines** | `docs/superpowers/baselines/*.png` | NEW — pre-migration screenshots |
| **Component SCSS** | ~118 files | Each migrated as its own commit (Phases 2 + 3) |
| **Excluded** | `pi-case-detail/`, `attorney-dashboard/`, `topbar/`, `horizontal-topbar/`, `ai-quick-drawer/` | Not touched |

## 9. Out of scope (separate specs)

- Building new component primitives (`<lt-card>`, `<lt-button>` etc.) — that was Option B in brainstorm, deferred
- Replacing Velzon entirely — long-term goal, requires Phase 0+ as a prerequisite
- Component library documentation (Storybook etc.)
- Visual regression test infrastructure (CI screenshots) — manual visual verification is sufficient for this spec
- App-wide Lucide migration (separate decision)

## 10. Acceptance criteria

A reviewer can verify:

- [ ] Phase 0: Every Tier 2 token resolves to a defined value on every route, in both light and dark mode (verified via DevTools query)
- [ ] Phase 1: Baselines exist for every route in `docs/superpowers/baselines/`
- [ ] Phase 2: Each migrated component has a corresponding commit on its own. `git log --oneline` shows `refactor(rox): migrate X to tokens` per component
- [ ] Phase 2: Visual diff between baseline and post-migration is acceptable (either pixel-identical for "preserve" pages or intentional improvement for "broken" pages)
- [ ] Phase 3: Same as Phase 2 for remaining modules
- [ ] Phase 4: New Rox foundation rules cover all patterns flagged during phases 2+3
- [ ] PI case detail visually unchanged before, during, and after the work
- [ ] Attorney dashboard visually unchanged
- [ ] Topbar (Bar 1 and Bar 2) visually unchanged
- [ ] No new hex colours introduced anywhere in `src/app/` (audit script run as final check returns 0 unmappable hex outside the exclusion list, OR all remaining hex are documented as intentional in a `tokens-exception-list.md`)

## 11. Risks

| Risk | Mitigation |
|---|---|
| Migration changes a value the user actually liked at its hardcoded number | Visual baseline workflow catches it; per-commit granularity allows surgical revert |
| New token fallbacks change the resolved value of a token (breaking pages that referenced the previous "empty" behaviour) | Phase 0 visual baselines confirm zero visual change before Phase 2+3 begins. Any Phase 0 change that breaks something gets reverted before migration |
| 118 files is a lot of audit/migration work and the process drags | Per-component commits mean partial completion is still valuable. Even doing 30 high-priority pages improves the app significantly. Lower-priority can be tackled over time without blocking the high-priority work |
| Dark mode regressions surface only at the end (Phase 7) | Test dark mode after EACH migration commit, not just at the end. Dark-mode toggle in topbar makes this trivial |
| Audit script's hex-to-token mapping misses edge cases | The mapping is suggested, not enforced. Each migration is human-reviewed. If the script suggests the wrong token, the human picks the right one or preserves the hex |
| User changes their mind mid-phase about which pages to migrate | Phase-per-branch architecture means individual branches can be discarded without affecting completed phases |

## 12. Open questions

- **Should baseline screenshots live in the repo or be gitignored?** Recommendation: gitignored (they're large PNGs, not source). Reference list of expected baselines is documented in this spec.
- **Should the audit script be committed to `scripts/` or stay local?** Recommendation: committed — it's a useful tool for ongoing token hygiene.
- **Acceptable scope for phase 2 "high priority"?** Recommendation: top 10-15 routes by user traffic. We sketch the list during audit; user approves before migration starts.

---

End of spec.
