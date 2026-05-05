# Rox theme global integration — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Rox theme to every page in the application via a token-first migration, with safety guardrails (per-commit granularity, visual baselines, opt-in scope, explicit exclusion list for already-styled pages) so the work is fully reversible.

**Architecture:** Three layers — (1) harden the Tier 2 token system in `_legience-tokens.scss` so every token resolves to a defined value on every route, (2) per-component migrate hardcoded hex colours to token references, (3) gap-fill `rox/_foundation.scss` for any UI patterns the foundation doesn't cover. Each component migration is one commit; each phase is one branch; PI case detail / attorney dashboard / topbar are explicitly excluded.

**Tech Stack:** Angular 18 + Velzon (template), Rox theme (custom), Geist font, SCSS with two-tier tokens (`--vz-*` Velzon tier, `--legience-*` semantic tier), Lucide icons (topbar only), Playwright for screenshot baselines.

**Spec reference:** [docs/superpowers/specs/2026-05-04-rox-theme-global-integration-design.md](../specs/2026-05-04-rox-theme-global-integration-design.md)

**Commit policy:** Per CLAUDE.md, NO commits without explicit user permission. Each "Stage + commit" step in this plan means: run `git add <files>`, surface the diff to the user, request commit approval, then run `git commit` ONLY after they say yes.

---

## File structure

| Path | Responsibility | Phase |
|---|---|---|
| `src/assets/scss/themes/_legience-tokens.scss` | Modify — add hardcoded fallbacks for tokens lacking them | Phase 0 |
| `scripts/audit-hex-in-scss.mjs` | NEW — Node script that walks SCSS, lists hex with line numbers, suggests token mapping | Phase 1 |
| `scripts/capture-baselines.mjs` | NEW — Playwright script that screenshots routes in light + dark mode | Phase 1 |
| `docs/superpowers/audits/2026-05-04-hex-audit.csv` | NEW — output of audit script, becomes the work queue | Phase 1 |
| `docs/superpowers/baselines/<route>-<theme>.png` | NEW — pre-migration screenshots (gitignored) | Phase 1 |
| `.gitignore` | Modify — add `docs/superpowers/baselines/` to ignore list | Phase 1 |
| Component SCSS files (~118) | Modify — per-component migration of hex to tokens | Phase 2/3 |
| `src/assets/scss/themes/rox/_foundation.scss` | Modify — add Rox overrides for any UI patterns flagged during phase 2/3 QA | Phase 4 |
| `src/assets/scss/themes/rox/_dark-mode.scss` | Modify — add dark-mode fixes for patterns missing dark treatment | Phase 4 |

**Excluded files (never touched by this plan):**
- `src/app/modules/legal/components/case/pi-case-detail/**`
- `src/app/component/dashboards/attorney/**`
- `src/app/component/layouts/topbar/**`
- `src/app/component/layouts/horizontal-topbar/**`
- `src/app/component/layouts/ai-quick-drawer/**`
- `src/styles.scss`

---

# PHASE 0 — Token hardening

**Goal:** every `--legience-*` token resolves to a meaningful value on every route, in both light and dark mode, regardless of which Velzon partials are loaded for that route. This phase is invisible — zero visual change to any page.

**Branch:** create `phase-0-token-hardening` off the current branch.

## Task 0.1: Audit which tokens lack fallbacks

**Files:**
- Read: `src/assets/scss/themes/_legience-tokens.scss`

- [ ] **Step 1: Open and read the token file**

```bash
cat /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1/src/assets/scss/themes/_legience-tokens.scss
```

- [ ] **Step 2: List every token where the value is `var(--vz-X)` without a fallback**

Look for lines matching the pattern `--legience-X: var(--vz-Y);` (no second argument inside the var()). Note them. Specifically check:

```
--legience-bg-page
--legience-bg-card                 (already has #ffffff fallback — verify)
--legience-bg-card-hover
--legience-bg-subtle
--legience-text-primary
--legience-text-secondary
--legience-text-muted              (hardcoded #57534d — already correct)
--legience-text-subtle
--legience-border-hairline
--legience-border-subtle
--legience-accent
--legience-accent-rgb
--legience-accent-hover
--legience-accent-soft
--legience-success / -rgb / -soft
--legience-warning / -rgb / -soft
--legience-danger / -rgb / -soft
--legience-info / -rgb / -soft
```

- [ ] **Step 3: Verify the dark-mode block also has the necessary overrides**

In the same file, locate the `[data-bs-theme="dark"] { ... }` block. List which tokens are redefined there. Compare against the list of tokens that need different dark values.

Expected outcome: a written list of (token name, light fallback needed, dark fallback needed) tuples.

## Task 0.2: Add light-mode fallbacks

**Files:**
- Modify: `src/assets/scss/themes/_legience-tokens.scss` (the `:root { ... }` block)

- [ ] **Step 1: Edit the surfaces block**

Replace the surfaces block:

```scss
  // ── SURFACES ───────────────────────────────────────────────
  --legience-bg-page:        var(--vz-body-bg);            // page background
  --legience-bg-card:        var(--vz-card-bg);            // card surface (raised)
  --legience-bg-card-hover:  var(--vz-light, #f5f5f4);     // soft hover surface
  --legience-bg-subtle:      var(--vz-tertiary-bg, #ececea); // disabled / inactive surface
```

with:

```scss
  // ── SURFACES ───────────────────────────────────────────────
  // Each token has a hardcoded fallback because Velzon's CSS-vars-from-SCSS
  // pipeline doesn't emit `--vz-*` on every layout/route. When the upstream
  // is empty, the consumer would silently get `unset` — visually broken with
  // no error. The fallback here ensures the token always resolves.
  --legience-bg-page:        var(--vz-body-bg, #f5f5f4);            // page background
  --legience-bg-card:        var(--vz-card-bg, #ffffff);            // card surface (raised)
  --legience-bg-card-hover:  var(--vz-light, #f5f5f4);               // soft hover surface
  --legience-bg-subtle:      var(--vz-tertiary-bg, #ececea);         // disabled / inactive surface
```

(`--legience-bg-card` regains the `#ffffff` light-mode fallback we previously removed; the dark-mode override in the `[data-bs-theme="dark"]` block at the bottom of the file gives it `#1c1917` for dark.)

- [ ] **Step 2: Edit the text block**

Replace:

```scss
  // ── TEXT ───────────────────────────────────────────────────
  --legience-text-primary:   var(--vz-heading-color);      // headings, prominent labels
  --legience-text-secondary: var(--vz-body-color);         // body copy
```

with:

```scss
  // ── TEXT ───────────────────────────────────────────────────
  --legience-text-primary:   var(--vz-heading-color, #0c0a09);      // headings, prominent labels
  --legience-text-secondary: var(--vz-body-color, #44403c);         // body copy
```

- [ ] **Step 3: Edit the borders block**

Replace:

```scss
  --legience-border-hairline: var(--vz-border-color);
  --legience-border-subtle:   var(--vz-border-color-translucent, rgba(0, 0, 0, 0.08));
```

with:

```scss
  --legience-border-hairline: var(--vz-border-color, #e7e5e4);
  --legience-border-subtle:   var(--vz-border-color-translucent, rgba(0, 0, 0, 0.08));
```

- [ ] **Step 4: Edit the accent / semantic block**

Replace the accent block:

```scss
  --legience-accent:          var(--vz-primary);
  --legience-accent-rgb:      var(--vz-primary-rgb);
  --legience-accent-hover:    var(--vz-primary, #0b64e9);  // darken via :hover wrapper
  --legience-accent-soft:     rgba(var(--vz-primary-rgb), 0.10);
  --legience-success:         var(--vz-success);
  --legience-success-rgb:     var(--vz-success-rgb);
  --legience-success-soft:    rgba(var(--vz-success-rgb), 0.10);
  --legience-warning:         var(--vz-warning);
  --legience-warning-rgb:     var(--vz-warning-rgb);
  --legience-warning-soft:    rgba(var(--vz-warning-rgb), 0.10);
  --legience-danger:          var(--vz-danger);
  --legience-danger-rgb:      var(--vz-danger-rgb);
  --legience-danger-soft:     rgba(var(--vz-danger-rgb), 0.10);
  --legience-info:            var(--vz-info);
  --legience-info-rgb:        var(--vz-info-rgb);
  --legience-info-soft:       rgba(var(--vz-info-rgb), 0.10);
```

with:

```scss
  --legience-accent:          var(--vz-primary, #0b64e9);
  --legience-accent-rgb:      var(--vz-primary-rgb, 11, 100, 233);
  --legience-accent-hover:    var(--vz-primary, #0b64e9);
  --legience-accent-soft:     rgba(var(--vz-primary-rgb, 11, 100, 233), 0.10);
  --legience-success:         var(--vz-success, #16a34a);
  --legience-success-rgb:     var(--vz-success-rgb, 22, 163, 74);
  --legience-success-soft:    rgba(var(--vz-success-rgb, 22, 163, 74), 0.10);
  --legience-warning:         var(--vz-warning, #f9b703);
  --legience-warning-rgb:     var(--vz-warning-rgb, 249, 183, 3);
  --legience-warning-soft:    rgba(var(--vz-warning-rgb, 249, 183, 3), 0.10);
  --legience-danger:          var(--vz-danger, #f24149);
  --legience-danger-rgb:      var(--vz-danger-rgb, 242, 65, 73);
  --legience-danger-soft:     rgba(var(--vz-danger-rgb, 242, 65, 73), 0.10);
  --legience-info:            var(--vz-info, #6b4aff);
  --legience-info-rgb:        var(--vz-info-rgb, 107, 74, 255);
  --legience-info-soft:       rgba(var(--vz-info-rgb, 107, 74, 255), 0.10);
```

(Hardcoded values match `rox/_foundation.scss` lines 23-37 — the same values Rox already defines at root level, so the resolved colour is identical whether `--vz-*` is set or not.)

## Task 0.3: Add dark-mode fallbacks

**Files:**
- Modify: `src/assets/scss/themes/_legience-tokens.scss` (the `[data-bs-theme="dark"] { ... }` block)

- [ ] **Step 1: Edit the dark-mode override block**

Replace:

```scss
[data-bs-theme="dark"] {
  --legience-bg-card-hover:   rgba(255, 255, 255, 0.04);
  --legience-border-hairline: rgba(255, 255, 255, 0.08);
  // Light-mode hardcoded `#57534d` is dark-stone. On a dark surface that
  // disappears — flip to a light-stone so subtext stays readable.
  --legience-text-muted:      #b8b3ae;
  --legience-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.20);
  --legience-shadow:    0 1px 3px rgba(0, 0, 0, 0.25), 0 1px 2px -1px rgba(0, 0, 0, 0.20);
  --legience-shadow-md: 0 4px 12px -4px rgba(0, 0, 0, 0.30);
  --legience-shadow-lg: 0 8px 24px -8px rgba(0, 0, 0, 0.40);
}
```

with:

```scss
[data-bs-theme="dark"] {
  // Surface — Stone-900 fallback for dark mode (matches dashboard hero card)
  --legience-bg-card:         var(--vz-card-bg, #1c1917);
  --legience-bg-card-hover:   rgba(255, 255, 255, 0.04);
  --legience-bg-subtle:       var(--vz-tertiary-bg, #292524);

  // Text — flip to light values for dark surfaces
  --legience-text-primary:    var(--vz-heading-color, #ffffff);
  --legience-text-secondary:  var(--vz-body-color, #d4d2d1);
  --legience-text-muted:      #b8b3ae;
  --legience-text-subtle:     var(--vz-text-muted, #78716c);

  // Borders — translucent white instead of dark stone
  --legience-border-hairline: rgba(255, 255, 255, 0.08);
  --legience-border-subtle:   rgba(255, 255, 255, 0.05);

  // Accents — brighter blue for dark contrast (accessibility)
  --legience-accent:          var(--vz-primary, #5b9dff);
  --legience-accent-rgb:      var(--vz-primary-rgb, 91, 157, 255);
  --legience-accent-soft:     rgba(var(--vz-primary-rgb, 91, 157, 255), 0.14);

  --legience-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.20);
  --legience-shadow:    0 1px 3px rgba(0, 0, 0, 0.25), 0 1px 2px -1px rgba(0, 0, 0, 0.20);
  --legience-shadow-md: 0 4px 12px -4px rgba(0, 0, 0, 0.30);
  --legience-shadow-lg: 0 8px 24px -8px rgba(0, 0, 0, 0.40);
}
```

## Task 0.4: Verify tokens resolve on every route

**Files:** none — verification only

- [ ] **Step 1: Open the app in a browser at /home (light mode)**

```bash
# Browser already running at http://localhost:4200
# Login if needed
```

- [ ] **Step 2: In DevTools console, query every Tier 2 token**

```javascript
const root = getComputedStyle(document.documentElement);
const tokens = [
  'bg-page','bg-card','bg-card-hover','bg-subtle',
  'text-primary','text-secondary','text-muted','text-subtle',
  'border-hairline','border-subtle',
  'accent','accent-rgb','accent-hover','accent-soft',
  'success','warning','danger','info',
  'shadow-sm','shadow','shadow-md','shadow-lg',
];
tokens.forEach(t => console.log(`--legience-${t}:`, root.getPropertyValue(`--legience-${t}`).trim()));
```

Expected: every token returns a non-empty string.

- [ ] **Step 3: Switch to dark mode in the app, repeat**

Click the moon icon in the topbar to switch to dark mode. Re-run the script. Expected: every token returns a non-empty string (some values will differ from light mode).

- [ ] **Step 4: Repeat on at least 5 different routes**

Navigate to:
- `/home`
- `/legal/cases`
- `/legal/calendar`
- `/time-tracking/dashboard`
- `/settings/profile`

Run the token query on each. Expected: every token resolves on every route, in both modes.

If any token returns empty: investigate which Velzon partial defines its upstream; either add a deeper fallback to the token or report the gap.

## Task 0.5: Visual baseline check (no migration yet)

**Files:** none — verification only

- [ ] **Step 1: Visit /home and confirm it looks identical to before Phase 0**

The dashboard, topbar, all cards should be visually unchanged. The token additions are additive — they only kick in when the upstream is empty, which shouldn't have changed for any route that worked before.

- [ ] **Step 2: Visit /legal/cases/<some-existing-case-id> (PI case detail)**

PI case detail should be visually unchanged. This is critical — it's the protected baseline.

- [ ] **Step 3: Visit each route from Task 0.4 and quickly scan**

Look for any obvious visual change. Phase 0 should be invisible.

If you spot a regression, the most likely cause is that `--legience-bg-card`'s previous "empty → fallback to nothing" behaviour was masking some other broken style. Identify which component uses it, decide whether the new behaviour (proper white card) is correct or whether the consumer needs adjustment.

## Task 0.6: Stage and commit Phase 0

**Files:**
- Stage: `src/assets/scss/themes/_legience-tokens.scss`

- [ ] **Step 1: Stage the file**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1
git add src/assets/scss/themes/_legience-tokens.scss
```

- [ ] **Step 2: Show the diff and request commit approval**

Run `git diff --cached` and surface the output to the user. Request approval with the proposed commit message:

```
refactor(theme): add fallbacks to Tier 2 tokens for empty Velzon vars

Every --legience-* token now has a hardcoded fallback so consumers don't
silently get unset values when Velzon's --vz-* upstream is empty on a
given route. Includes dark-mode definitions for surface, text, border,
and accent tokens.

Zero visual change — additive fallbacks that only kick in when upstream
is empty, which was always producing broken styles before.
```

- [ ] **Step 3: After approval, commit**

```bash
git commit -m "refactor(theme): add fallbacks to Tier 2 tokens for empty Velzon vars" \
           -m "Every --legience-* token now has a hardcoded fallback..." # full message via $(cat <<EOF...EOF) form
```

(End of Phase 0. The branch `phase-0-token-hardening` should be reviewed and merged to develop, or kept as a feature branch — user's call.)

---

# PHASE 1 — Audit script + visual baselines

**Goal:** produce the work queue (which files to migrate, which hex maps to which token) and the visual reference (pre-migration screenshots of every route we might touch).

**Branch:** create `phase-1-baselines-and-audit` off the merged Phase 0 branch.

## Task 1.1: Create the gitignore entry for baselines

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Append baselines to .gitignore**

```bash
echo "" >> /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1/.gitignore
echo "# Rox theme integration baselines (large PNGs, regenerated as needed)" >> /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1/.gitignore
echo "docs/superpowers/baselines/" >> /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1/.gitignore
```

(The audit CSV stays committed — it's small, useful for reference.)

## Task 1.2: Build the hex audit script

**Files:**
- Create: `scripts/audit-hex-in-scss.mjs`

- [ ] **Step 1: Write the audit script**

```javascript
#!/usr/bin/env node
/**
 * Audit hex colours in component SCSS files. For each file, list every
 * #hexvalue with line number and a suggested Tier 2 token mapping.
 * Outputs a CSV to docs/superpowers/audits/.
 *
 * Usage: node scripts/audit-hex-in-scss.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, relative } from 'path';
import { glob } from 'glob';

const ROOT = process.cwd();
const SCSS_GLOB = 'src/app/**/*.component.scss';

// Files explicitly preserved — never migrated, audit skips them
const EXCLUDED_PATTERNS = [
  'src/app/modules/legal/components/case/pi-case-detail/',
  'src/app/component/dashboards/attorney/',
  'src/app/component/layouts/topbar/',
  'src/app/component/layouts/horizontal-topbar/',
  'src/app/component/layouts/ai-quick-drawer/',
];

// Hex → Tier 2 token mapping. Ordered by specificity: surface colours
// first (since they're most common), then accents, then neutrals.
const HEX_TOKEN_MAP = {
  // Pure white / off-whites — usually card surfaces
  '#fff': '--legience-bg-card',
  '#ffffff': '--legience-bg-card',
  '#fefefe': '--legience-bg-card',

  // Pure black / very dark — usually text-primary
  '#000': '--legience-text-primary',
  '#000000': '--legience-text-primary',
  '#0c0a09': '--legience-text-primary',
  '#1c1917': '--legience-text-primary',  // also dark-mode card bg, ambiguous

  // Greys — text-secondary / muted
  '#44403c': '--legience-text-secondary',
  '#666': '--legience-text-secondary',
  '#666666': '--legience-text-secondary',
  '#717171': '--legience-text-secondary',
  '#57534d': '--legience-text-muted',
  '#999': '--legience-text-muted',
  '#999999': '--legience-text-muted',
  '#a6a09b': '--legience-text-muted',

  // Hairlines / borders
  '#e7e5e4': '--legience-border-hairline',
  '#e5e7eb': '--legience-border-hairline',
  '#ddd': '--legience-border-hairline',
  '#dddddd': '--legience-border-hairline',
  '#dcdcdc': '--legience-border-hairline',

  // Accents — primary blue
  '#0b64e9': '--legience-accent',
  '#0950bd': '--legience-accent',
  '#2563eb': '--legience-accent',
  '#1e3a8a': '--legience-accent',  // gradient pair
  '#3b82f6': '--legience-accent',

  // Success / warning / danger
  '#16a34a': '--legience-success',
  '#22c55e': '--legience-success',
  '#15803d': '--legience-success',
  '#f97006': '--legience-warning',
  '#f59e0b': '--legience-warning',
  '#f9b703': '--legience-warning',
  '#dc2626': '--legience-danger',
  '#ef4444': '--legience-danger',
  '#f24149': '--legience-danger',
};

const HEX_RE = /#[0-9a-fA-F]{3,6}\b/g;

async function main() {
  const files = await glob(SCSS_GLOB, { cwd: ROOT });
  const filtered = files.filter(f => !EXCLUDED_PATTERNS.some(p => f.startsWith(p)));

  const rows = [['file', 'line', 'hex', 'suggested_token', 'context']];
  let totalHits = 0;

  for (const file of filtered) {
    const full = join(ROOT, file);
    const content = readFileSync(full, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      const matches = line.match(HEX_RE);
      if (!matches) return;
      for (const hex of matches) {
        const norm = hex.toLowerCase();
        const token = HEX_TOKEN_MAP[norm] || '(unmapped)';
        rows.push([
          file,
          String(i + 1),
          hex,
          token,
          line.trim().slice(0, 100).replace(/"/g, '""'),
        ]);
        totalHits++;
      }
    });
  }

  const outDir = join(ROOT, 'docs/superpowers/audits');
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, '2026-05-04-hex-audit.csv');
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  writeFileSync(outFile, csv);

  console.log(`Audit complete:`);
  console.log(`  Files scanned: ${filtered.length}`);
  console.log(`  Hex occurrences: ${totalHits}`);
  console.log(`  Output: ${relative(ROOT, outFile)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Verify the script runs**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1
# Install glob if not already a dep — it's likely installed transitively, but check
node -e "require('glob')" 2>/dev/null && echo "glob ok" || npm install --save-dev glob

node scripts/audit-hex-in-scss.mjs
```

Expected output:
```
Audit complete:
  Files scanned: ~163  (168 total minus 5 excluded directories)
  Hex occurrences: ~XXXX
  Output: docs/superpowers/audits/2026-05-04-hex-audit.csv
```

- [ ] **Step 3: Inspect the CSV briefly**

```bash
head -20 docs/superpowers/audits/2026-05-04-hex-audit.csv
wc -l docs/superpowers/audits/2026-05-04-hex-audit.csv
```

Expected: a CSV with file/line/hex/token/context columns. Some rows will have `(unmapped)` in the token column — those are page-specific or brand-specific values. Total row count is your migration scope.

- [ ] **Step 4: Identify the top 10 hex-heaviest files**

```bash
awk -F',' 'NR>1 {gsub(/"/,""); print $1}' docs/superpowers/audits/2026-05-04-hex-audit.csv | sort | uniq -c | sort -rn | head -10
```

This is the migration priority list — files with the most hex have the highest theming impact.

## Task 1.3: Stage and commit the audit script + CSV

**Files:**
- Stage: `scripts/audit-hex-in-scss.mjs`
- Stage: `docs/superpowers/audits/2026-05-04-hex-audit.csv`
- Stage: `.gitignore`

- [ ] **Step 1: Stage the files**

```bash
git add scripts/audit-hex-in-scss.mjs \
        docs/superpowers/audits/2026-05-04-hex-audit.csv \
        .gitignore
```

Note: per the project's `.gitignore`, `*.md` is ignored. The CSV should commit fine. Verify with `git status` that the audit CSV is staged.

- [ ] **Step 2: Show the diff and request commit approval**

Surface the diff. Proposed commit message:

```
chore(theme): add hex audit script + initial work queue
```

- [ ] **Step 3: After approval, commit**

```bash
git commit -m "chore(theme): add hex audit script + initial work queue"
```

## Task 1.4: Build the baseline screenshot script

**Files:**
- Create: `scripts/capture-baselines.mjs`

- [ ] **Step 1: Write the screenshot script**

```javascript
#!/usr/bin/env node
/**
 * Capture pre-migration baseline screenshots of every route in light + dark
 * mode. Output to docs/superpowers/baselines/. Requires Playwright.
 *
 * Usage:
 *   node scripts/capture-baselines.mjs
 *
 * Prerequisites:
 *   - dev server running at http://localhost:4200
 *   - Playwright installed: npx playwright install chromium
 *   - Test user credentials below match a real account
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const APP_URL = 'http://localhost:4200';
const TEST_EMAIL = 'a.wilson@bostoneosolutions.com';   // dev test user
const TEST_PASSWORD = '1234';

// Routes to baseline. List drives Phase 2/3 prioritization.
const ROUTES = [
  '/home',                           // attorney dashboard (excluded from migration but baseline kept)
  '/legal/cases',                    // case list
  '/legal/calendar',                 // calendar
  '/case-management/tasks',          // tasks
  '/clients',                        // client list
  '/billing-dashboard',              // billing dashboard
  '/time-tracking/dashboard',        // time tracking dashboard
  '/time-tracking/entry',            // log time
  '/time-tracking/approval',         // time approval
  '/time-tracking/rates',            // billing rates
  '/invoices',                       // invoices
  '/expenses',                       // expenses
  '/crm/dashboard',                  // CRM dashboard
  '/crm/intake-submissions',         // intake submissions
  '/crm/leads',                      // leads
  '/signatures',                     // e-signatures
  '/legal/ai-assistant/legispace',   // AI workspace
  '/legal/ai-assistant/legipi',      // AI PI
  '/legal/ai-assistant/templates',   // AI templates
  '/settings/profile',               // user settings
  '/settings/organization',          // org settings
];

const OUT_DIR = 'docs/superpowers/baselines';

async function login(page) {
  await page.goto(`${APP_URL}/login`);
  await page.waitForSelector('input[type="email"], input[placeholder*="email" i]');
  // The login form may have credentials pre-filled; clear and re-enter.
  const emailInput = await page.locator('input').first();
  await emailInput.fill(TEST_EMAIL);
  const passwordInput = await page.locator('input[type="password"]').first();
  await passwordInput.fill(TEST_PASSWORD);
  await page.locator('button:has-text("Sign In")').click();
  await page.waitForURL(/\/home|\/dashboard/, { timeout: 10000 });
}

async function setTheme(page, theme) {
  await page.evaluate(t => document.documentElement.setAttribute('data-bs-theme', t), theme);
  // Give CSS a tick to apply
  await page.waitForTimeout(300);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Logging in...');
  await login(page);

  for (const theme of ['light', 'dark']) {
    console.log(`\n=== ${theme.toUpperCase()} MODE ===`);
    await setTheme(page, theme);

    for (const route of ROUTES) {
      const safeName = route.replace(/^\//, '').replace(/\//g, '-') || 'home';
      const filename = `${safeName}-${theme}.png`;
      const outPath = join(OUT_DIR, filename);

      try {
        await page.goto(`${APP_URL}${route}`, { waitUntil: 'networkidle', timeout: 15000 });
        // Wait briefly for any animations to settle
        await page.waitForTimeout(800);
        // Re-set theme in case route reset it
        await setTheme(page, theme);
        await page.screenshot({ path: outPath, fullPage: true });
        console.log(`  ${route} → ${filename}`);
      } catch (e) {
        console.log(`  ${route} → SKIP (${e.message.slice(0, 60)})`);
      }
    }
  }

  await browser.close();
  console.log(`\nDone. Baselines in ${OUT_DIR}/`);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Verify Playwright is available**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1
npx playwright --version
# If not installed:
# npm install --save-dev playwright
# npx playwright install chromium
```

- [ ] **Step 3: Confirm the dev server is running**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4200/
# Expected: 200 (or 302 redirect)
```

If not running: ask the user to start `ng serve`. Don't auto-start it (per CLAUDE.md "do not run npm run build unless requested").

## Task 1.5: Capture baselines

**Files:** none (output goes to gitignored `docs/superpowers/baselines/`)

- [ ] **Step 1: Run the baseline script**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1
node scripts/capture-baselines.mjs
```

Expected: ~42 screenshots (21 routes × 2 themes), saved to `docs/superpowers/baselines/`.

- [ ] **Step 2: Spot-check a few baselines**

Open these in an image viewer:
- `docs/superpowers/baselines/home-light.png`
- `docs/superpowers/baselines/home-dark.png`
- `docs/superpowers/baselines/legal-cases-light.png`
- `docs/superpowers/baselines/billing-dashboard-light.png`

Confirm they're full-page screenshots and the content rendered properly (not blank, not stuck on a loader).

If routes are blank: investigate (login session may have expired, route may need permissions, or the dev server may not have warmed up). Re-run after fixing.

## Task 1.6: Stage and commit the baseline script

**Files:**
- Stage: `scripts/capture-baselines.mjs`

- [ ] **Step 1: Stage the script**

The actual `.png` baselines are gitignored per Task 1.1. We commit only the script.

```bash
git add scripts/capture-baselines.mjs
```

- [ ] **Step 2: Show diff, request approval**

Proposed commit message:

```
chore(theme): add baseline screenshot capture script
```

- [ ] **Step 3: After approval, commit**

```bash
git commit -m "chore(theme): add baseline screenshot capture script"
```

## Task 1.7: Draft the Phase 2 priority list

**Files:**
- Create: `docs/superpowers/audits/2026-05-04-phase2-priority.md`

- [ ] **Step 1: Cross-reference the audit CSV with the baseline screenshots**

For each baseline screenshot, classify:
- **Mandatory migration**: page is visually broken today (mismatched colours, half-themed, illegible contrast)
- **Optional migration**: page looks acceptable, low ROI but cleanup benefits
- **Forbidden migration**: explicitly preserved (PI case detail isn't even in baselines for this purpose)

- [ ] **Step 2: Write the priority list**

Create `docs/superpowers/audits/2026-05-04-phase2-priority.md`:

```markdown
# Phase 2 page priority list

Based on hex audit CSV + visual baseline review.

## Mandatory (Phase 2)

| Route | Component file(s) | Hex count | Notes |
|---|---|---|---|
| /clients | (path) | (count) | (notes — what's visually broken) |
| /billing-dashboard | (path) | (count) | (notes) |
| ... | ... | ... | ... |

## Optional (Phase 3)

| Route | Component file(s) | Hex count |
|---|---|---|
| ... | ... | ... |

## Forbidden / preserved

- /home (attorney dashboard) — already styled, in exclusion list
- /legal/cases/:id (PI case detail) — already styled, in exclusion list
- (any other page user has flagged)
```

Fill the tables based on what you see in the baselines. Aim for ~10-15 mandatory entries.

- [ ] **Step 3: Stage and commit**

```bash
git add docs/superpowers/audits/2026-05-04-phase2-priority.md
```

Note: this is a `.md` file. Check `.gitignore` — if `*.md` is ignored, use `git add -f` to force-add the audit doc, OR move audits to a non-md format. Surface this to the user for a decision before committing. Proposed commit message:

```
chore(theme): draft Phase 2 priority list from audit + baselines
```

## Task 1.8: Phase 1 complete — request user review

**Files:** none — handoff step

- [ ] **Step 1: Tell the user Phase 1 is complete and ask for review**

Surface:
- The audit CSV path
- The baseline screenshots directory (gitignored, file count)
- The Phase 2 priority list

Ask the user to:
1. Spot-check a couple of baselines (home-light, home-dark) to confirm the capture worked
2. Review the Phase 2 priority list — adjust which pages are mandatory vs optional
3. Approve before Phase 2 starts

(End of Phase 1.)

---

# PHASE 2 — High-priority page migration

**Goal:** migrate the pages flagged as "mandatory" in the Phase 1 priority list. Each component is its own commit.

**Branch:** `phase-2-high-priority` off the merged Phase 1 branch.

**Detailed task list:** drafted dynamically once Phase 1 priority is approved. Each component follows the per-component workflow below.

## Per-component migration workflow (template — repeat per file)

For each file in the mandatory list:

- [ ] **Step 1: Read the audit CSV row for this file**

Find all hex entries for the file. Note which have suggested tokens vs `(unmapped)`.

- [ ] **Step 2: Open the file and review every hex in context**

For each `(unmapped)` hex, decide: is this brand-specific (preserve), or does it map to a token I should add? If the latter: stop, escalate, add the token to `_legience-tokens.scss` first.

- [ ] **Step 3: Apply migrations**

For each mappable hex:

```scss
// Before
.some-thing { color: #0c0a09; }

// After
.some-thing { color: var(--legience-text-primary); }
```

For each `(unmapped)` hex that's brand-specific: leave as-is. Add an SCSS comment if it'd help future readers:

```scss
// Brand-specific: this exact orange matches the firm logo, do not migrate
.firm-banner { background: #ee7700; }
```

- [ ] **Step 4: Visual verify**

Reload the route in browser (light + dark mode). Compare with baseline screenshot. Confirm pixel-identical OR an acceptable improvement.

If unexpected change: investigate. Either fix the migration (wrong token mapped) or revert that one property and continue.

- [ ] **Step 5: Stage + commit (one commit per file)**

```bash
git add <file>
```

Proposed message:

```
refactor(rox): migrate <component-name> to legience tokens

- N hex values mapped to --legience-* tokens
- M page-specific values preserved
- Visual verified: light + dark mode match baseline
```

Request user commit approval. After approval, commit.

- [ ] **Step 6: Move to next file**

---

# PHASE 3 — Remaining modules

**Goal:** migrate the "optional" pages from the Phase 1 priority list (or skip them indefinitely if user prefers to stop).

**Branch:** `phase-3-remaining` off Phase 2.

**Workflow:** identical to Phase 2 per-component workflow. Lower visual urgency, but same cleanliness benefit.

---

# PHASE 4 — Foundation gap-fill

**Goal:** add Rox `_foundation.scss` rules for any UI patterns that surfaced during Phases 2+3 as not-covered. Examples likely needed: calendar, datepicker, file uploader, rich text editor.

**Branch:** `phase-4-foundation-gap-fill` off Phase 3.

## Per-pattern workflow (template — repeat per pattern)

For each pattern flagged during phases 2+3:

- [ ] **Step 1: Document the pattern**

What component is this? What's the current Velzon styling? What needs to change for Rox alignment?

- [ ] **Step 2: Add the rule to the right Rox file**

- General components → `rox/_foundation.scss`
- Domain-specific → `rox/_domain.scss`
- Dark-mode adjustment → `rox/_dark-mode.scss`
- Charts / third-party plugin → `rox/_polish.scss`

- [ ] **Step 3: Visual verify across affected routes**

Reload routes that use this pattern. Confirm the new rule fixes the issue without breaking anything else.

- [ ] **Step 4: Stage + commit**

Proposed message format:

```
feat(rox): add foundation rule for <pattern>

Covers <route X>, <route Y>. Pattern was previously falling through to
Velzon defaults which didn't match the Rox design language.
```

---

# Final QA pass

After all phases:

## Task QA.1: Run the audit script again

```bash
node scripts/audit-hex-in-scss.mjs
```

Expected: significantly fewer unmapped hex occurrences. Any remaining unmapped should be intentional (brand-specific, preserved). Document those in `docs/superpowers/audits/tokens-exception-list.md`.

## Task QA.2: Re-run baseline capture, compare against initial baselines

```bash
node scripts/capture-baselines.mjs
```

For each route, compare `docs/superpowers/baselines/<route>-light.png` (saved before migrations) against the freshly captured one. They'll be in different directories now since you'd want to keep the originals. Workflow: rename `baselines/` → `baselines-pre/`, run capture again to populate `baselines/`, diff.

For each route:
- **Should be unchanged** (preserved pages): visual diff should be near-zero. Investigate any difference.
- **Should be improved** (migrated pages): differences are acceptable if they fix theming. Bad differences → investigate.

## Task QA.3: Dark mode verification

Walk every migrated route in dark mode:

- [ ] All surfaces are dark
- [ ] Text contrast passes WCAG AA
- [ ] Hairline borders visible but not dominant
- [ ] No flash of light content during navigation
- [ ] Hover/active states still legible

Document any dark-mode regressions and add to `phase-4-foundation-gap-fill` for follow-up.

## Task QA.4: Final commit and merge plan

After all QA passes, the work is ready to ship. Branches merge in order: 0 → 1 → 2 → 3 → 4 → develop. Each merge is a separate user-approved step.

---

# Done

Once merged, every Tier 2 token is hardened, every migrated component flows through the design system, and future colour/spacing adjustments propagate automatically. PI case detail and other excluded pages remain pixel-for-pixel preserved.

**Total task count:**
- Phase 0: 6 detailed tasks
- Phase 1: 8 detailed tasks
- Phase 2: ~10–15 per-component tasks (drawn from priority list)
- Phase 3: ~30–50 per-component tasks (drawn from remaining audit)
- Phase 4: ~5–10 pattern-level tasks
- QA: 4 tasks

**Estimated effort:** 3–5 focused days of work, parallelizable per component within phases.
