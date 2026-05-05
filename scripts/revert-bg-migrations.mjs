#!/usr/bin/env node
/**
 * Revert all background-color migrations applied by migrate-hex-to-tokens.mjs.
 *
 * Strips `var(--legience-X, #hex)` wrappers from `background:` and
 * `background-color:` properties, restoring the original bare hex values.
 * Leaves `color:`, `border:`, `border-color:`, `fill:`, `stroke:` migrations
 * intact — those have proven safe across themes.
 *
 * Why revert: the unified --legience-bg-* tokens resolve through Velzon's
 * --vz-light / --vz-tertiary-bg defaults, which differ slightly from the
 * per-component shades the original designs picked. The visual drift is small
 * but real, and the user prefers per-component bg fidelity over global theming
 * for surfaces.
 *
 * Idempotent: only matches `var(--legience-bg-*, #hex)` and `var(--legience-{accent,success,danger,info,warning}, #hex)`
 * patterns inside background-color contexts. Re-running is a no-op.
 *
 * Usage:
 *   node scripts/revert-bg-migrations.mjs            # apply
 *   node scripts/revert-bg-migrations.mjs --dry-run  # preview
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

// Match: `background: var(--legience-X, #hex)` or `background-color: var(...)`
// Capture: ($1 = property prefix incl colon and whitespace, $2 = hex value)
// Replacement strips the var() wrapper.
const REVERT_RULES = [
  // Surface tokens (the main culprits)
  [/(\b(?:background|background-color):\s*)var\(--legience-bg-card-hover,\s*(#[0-9a-fA-F]+)\)/g, '$1$2'],
  [/(\b(?:background|background-color):\s*)var\(--legience-bg-card,\s*(#[0-9a-fA-F]+)\)/g, '$1$2'],
  [/(\b(?:background|background-color):\s*)var\(--legience-bg-subtle,\s*(#[0-9a-fA-F]+)\)/g, '$1$2'],
  [/(\b(?:background|background-color):\s*)var\(--legience-bg-page,\s*(#[0-9a-fA-F]+)\)/g, '$1$2'],
  // Brand-color backgrounds (Phase 4 additions)
  [/(\b(?:background|background-color):\s*)var\(--legience-accent,\s*(#[0-9a-fA-F]+)\)/g, '$1$2'],
  [/(\b(?:background|background-color):\s*)var\(--legience-success,\s*(#[0-9a-fA-F]+)\)/g, '$1$2'],
  [/(\b(?:background|background-color):\s*)var\(--legience-danger,\s*(#[0-9a-fA-F]+)\)/g, '$1$2'],
  [/(\b(?:background|background-color):\s*)var\(--legience-info,\s*(#[0-9a-fA-F]+)\)/g, '$1$2'],
  [/(\b(?:background|background-color):\s*)var\(--legience-warning,\s*(#[0-9a-fA-F]+)\)/g, '$1$2'],
];

async function main() {
  const all = await glob('src/app/**/*.component.scss', { cwd: ROOT });
  const FILES = all.filter(f => !EXCLUDED_PATTERNS.some(p => f.startsWith(p))).sort();

  let totalReversions = 0;
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
    let updated = content;
    for (const [from, to] of REVERT_RULES) {
      updated = updated.replace(from, (...args) => {
        count++;
        return to.replace(/\$(\d+)/g, (_, n) => args[parseInt(n, 10)]);
      });
    }

    if (!DRY_RUN && count > 0) writeFileSync(full, updated);
    fileResults.push({ file, count });
    totalReversions += count;
  }

  console.log(`\n${DRY_RUN ? 'DRY RUN — no files written' : 'Reversions applied'} (${FILES.length} files scanned)`);
  console.log(`Total background-color reversions: ${totalReversions}\n`);

  const changed = fileResults.filter(r => r.count > 0 || r.error);
  const maxLen = Math.max(...changed.map(r => r.file.length), 0);
  changed.forEach(r => {
    const padded = r.file.padEnd(maxLen, ' ');
    if (r.error)    console.log(`  ✗ ${padded}  (${r.error})`);
    else            console.log(`  ✓ ${padded}  ${r.count} reversions`);
  });
  if (changed.length === 0) console.log('  (no matches found — already reverted or never migrated)');
  else console.log(`\n${changed.length} files modified.`);
}

main().catch(e => { console.error(e); process.exit(1); });
