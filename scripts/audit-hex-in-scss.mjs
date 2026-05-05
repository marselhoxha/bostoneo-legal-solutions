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

// Files explicitly preserved — never migrated, audit skips them so they
// don't pollute the migration backlog. These are the components whose
// styling is intentionally pinned (PI case detail is the design reference;
// attorney dashboard + topbar were already themed in prior work).
const EXCLUDED_PATTERNS = [
  'src/app/modules/legal/components/case/pi-case-detail/',
  'src/app/component/dashboards/attorney/',
  'src/app/component/layouts/topbar/',
  'src/app/component/layouts/horizontal-topbar/',
  'src/app/component/layouts/ai-quick-drawer/',
];

// Hex → Tier 2 token mapping. Ordered by intent: surfaces first (most
// common), then text, then borders, then accents. Anything unmapped gets
// `(unmapped)` in the CSV — those rows need manual review since they're
// usually page-specific brand or gradient values.
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
