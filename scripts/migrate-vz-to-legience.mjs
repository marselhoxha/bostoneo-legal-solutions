#!/usr/bin/env node
/**
 * Phase 5: migrate `var(--vz-X)` → `var(--legience-Y)` in component SCSS.
 *
 * Decouples component styles from Velzon's CSS-variable namespace. After this
 * runs, components reference only Tier 2 (--legience-*) tokens, so removing
 * Velzon entirely (Phase 8) becomes a clean cut: only the foundation files
 * (rox/_foundation.scss, _legience-tokens.scss) need to know about --vz-*.
 *
 * Mappings cover only tokens with a clear semantic equivalent. Velzon-specific
 * tokens that don't map cleanly (--vz-secondary, --vz-secondary-bg) are left
 * untouched — Phase 6 (foundation gap-fill) can add new Tier 2 tokens for
 * those usages.
 *
 * Idempotency: regex matches `var(--vz-X[, fallback])`. After substitution
 * the line reads `var(--legience-X[, fallback])` — re-running is a no-op.
 *
 * Skips the same lines as migrate-hex-to-tokens.mjs (SCSS variable defs and
 * color-function calls) for consistency, even though no current code uses
 * those patterns with --vz-* (verified empty grep).
 *
 * Usage:
 *   node scripts/migrate-vz-to-legience.mjs            # apply
 *   node scripts/migrate-vz-to-legience.mjs --dry-run  # preview
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

const ROOT = process.cwd();
const DRY_RUN = process.argv.includes('--dry-run');

const EXCLUDED_PATTERNS = [
  'src/app/modules/legal/components/case/pi-case-detail/',
  'src/app/component/dashboards/attorney/',
  'src/app/component/layouts/topbar/',
  'src/app/component/layouts/horizontal-topbar/',
  'src/app/component/layouts/ai-quick-drawer/',
];

// Velzon → Legience token mapping. Each entry produces TWO regex rules:
//   var(--vz-X)             → var(--legience-Y)
//   var(--vz-X, anything)   → var(--legience-Y, anything)  (preserves fallback)
//
// Pairs ordered specific-before-general (e.g. -rgb variants before bare names)
// to avoid the bare regex eating part of the -rgb name.
const TOKEN_MAP = [
  // Brand / semantic accents (rgb variants first)
  ['vz-primary-rgb',          'legience-accent-rgb'],
  ['vz-primary',              'legience-accent'],
  ['vz-success-rgb',          'legience-success-rgb'],
  ['vz-success',              'legience-success'],
  ['vz-danger-rgb',           'legience-danger-rgb'],
  ['vz-danger',               'legience-danger'],
  ['vz-info-rgb',             'legience-info-rgb'],
  ['vz-info',                 'legience-info'],
  ['vz-warning-rgb',          'legience-warning-rgb'],
  ['vz-warning',              'legience-warning'],

  // Surfaces
  ['vz-card-bg',              'legience-bg-card'],
  ['vz-body-bg',              'legience-bg-page'],
  ['vz-tertiary-bg',          'legience-bg-subtle'],
  ['vz-light',                'legience-bg-card-hover'],

  // Text
  ['vz-heading-color',        'legience-text-primary'],
  ['vz-body-color',           'legience-text-secondary'],
  ['vz-secondary-color',      'legience-text-muted'],
  ['vz-text-muted',           'legience-text-muted'],

  // Borders
  ['vz-border-color-rgb',     'legience-border-hairline-rgb'],
  ['vz-border-color',         'legience-border-hairline'],

  // Phase 6 additions — secondary, dark, input, subtle-bg, rgb variants
  ['vz-secondary-rgb',        'legience-secondary-rgb'],
  ['vz-secondary-bg',         'legience-bg-card'],          // most usages are card-equivalent surfaces
  ['vz-secondary',            'legience-secondary'],
  ['vz-dark-rgb',             'legience-dark-rgb'],
  ['vz-dark',                 'legience-dark'],
  ['vz-light-rgb',            'legience-bg-card-hover-rgb'],
  ['vz-input-bg',             'legience-bg-input'],
  ['vz-primary-bg-subtle',    'legience-accent-bg-subtle'],
  ['vz-body-color-muted',     'legience-text-muted'],

  // Geometry — radius scale (Velzon's 0.375rem ~ Legience's 8px, close enough)
  ['vz-border-radius-lg',     'legience-radius-lg'],
  ['vz-border-radius-sm',     'legience-radius-sm'],
  ['vz-border-radius',        'legience-radius'],

  // Box shadows
  ['vz-box-shadow-sm',        'legience-shadow-sm'],
  ['vz-box-shadow-lg',        'legience-shadow-lg'],
  ['vz-box-shadow',           'legience-shadow'],

  // Typography
  ['vz-font-sans-serif',      'legience-font-sans'],
];

// Build regex rules from the TOKEN_MAP. Two patterns per pair:
//   1. var(--vz-X)         → var(--legience-Y)
//   2. var(--vz-X, ...)    → var(--legience-Y, ...)  (preserves fallback)
const RULES = TOKEN_MAP.flatMap(([from, to]) => [
  // No fallback: tight `\)` after the var name
  [new RegExp(`var\\(--${from}\\)`, 'g'), `var(--${to})`],
  // With fallback: capture everything up to the matching `)` (greedy stop)
  [new RegExp(`var\\(--${from}(,\\s*[^)]*)\\)`, 'g'), `var(--${to}$1)`],
]);

const SKIP_LINE = /(^\s*\$[\w-]+\s*:)|(\b(?:lighten|darken|mix|saturate|desaturate|transparentize|opacify|fade-in|fade-out|adjust-hue|complement|invert|grayscale)\s*\()/;

async function main() {
  const all = await glob('src/app/**/*.component.scss', { cwd: ROOT });
  const FILES = all.filter(f => !EXCLUDED_PATTERNS.some(p => f.startsWith(p))).sort();

  let total = 0;
  const fileResults = [];

  for (const file of FILES) {
    const full = join(ROOT, file);
    let content;
    try {
      content = readFileSync(full, 'utf8');
    } catch (e) {
      fileResults.push({ file, error: e.code === 'ENOENT' ? 'not found' : e.message, count: 0 });
      continue;
    }

    let count = 0;
    const updated = content
      .split('\n')
      .map(line => {
        if (SKIP_LINE.test(line)) return line;
        let next = line;
        for (const [from, to] of RULES) {
          next = next.replace(from, (...args) => {
            count++;
            return to.replace(/\$(\d+)/g, (_, n) => args[parseInt(n, 10)]);
          });
        }
        return next;
      })
      .join('\n');

    if (!DRY_RUN && count > 0) writeFileSync(full, updated);
    fileResults.push({ file, count });
    total += count;
  }

  console.log(`\n${DRY_RUN ? 'DRY RUN — no files written' : 'Phase 5 migration applied'} (${FILES.length} files scanned)`);
  console.log(`Total --vz-* → --legience-* substitutions: ${total}\n`);

  const changed = fileResults.filter(r => r.count > 0 || r.error);
  const maxLen = Math.max(...changed.map(r => r.file.length), 0);
  changed.slice(0, 20).forEach(r => {
    const padded = r.file.padEnd(maxLen, ' ');
    if (r.error)    console.log(`  ✗ ${padded}  (${r.error})`);
    else            console.log(`  ✓ ${padded}  ${r.count} substitutions`);
  });
  if (changed.length > 20) console.log(`  … ${changed.length - 20} more files (truncated)`);
  console.log(`\n${changed.length} files modified, ${FILES.length - changed.length} unchanged.`);
}

main().catch(e => { console.error(e); process.exit(1); });
