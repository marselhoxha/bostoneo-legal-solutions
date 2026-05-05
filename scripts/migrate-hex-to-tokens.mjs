#!/usr/bin/env node
/**
 * Bulk migration of bare hex values to Legience Tier 2 tokens in component
 * SCSS. Applies the patterns validated by hand on messages.component.scss
 * and intake-form.component.scss to the remaining Phase 2 mandatory files.
 *
 * Each replacement preserves the original hex as a fallback inside var() so
 * behavior is identical when Legience tokens are unset (e.g. dev environments
 * where the upstream Velzon vars haven't been compiled).
 *
 * Idempotency: the regexes match `property: #hex` patterns. After substitution
 * the line becomes `property: var(--legience-X, #hex)` — re-running the script
 * is a no-op because the regex no longer matches.
 *
 * Safety: skips matches that are already inside a `var(--` fallback (catches
 * a few edge cases where someone wrote `var(--vz-X, #fff)` — those are left
 * for manual review, since changing the fallback is a different concern from
 * wrapping a bare hex).
 *
 * Usage:
 *   node scripts/migrate-hex-to-tokens.mjs            # apply changes
 *   node scripts/migrate-hex-to-tokens.mjs --dry-run  # preview only
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

const ROOT = process.cwd();
const DRY_RUN = process.argv.includes('--dry-run');
const ALL = process.argv.includes('--all');

// Files explicitly preserved — never migrated. PI case detail is the design
// reference, attorney dashboard + topbar were themed in prior work.
const EXCLUDED_PATTERNS = [
  'src/app/modules/legal/components/case/pi-case-detail/',
  'src/app/component/dashboards/attorney/',
  'src/app/component/layouts/topbar/',
  'src/app/component/layouts/horizontal-topbar/',
  'src/app/component/layouts/ai-quick-drawer/',
];

// Phase 2 mandatory files (from priority list items 3-15). Items 1-2
// (messages, intake-form) already done by hand. Default mode targets these
// files. Pass --all to extend to every component SCSS in the codebase
// (Phase 3 + long-tail cleanup); the regex is idempotent so re-running on
// already-migrated files is a no-op.
const PRIORITY_FILES = [
  'src/app/modules/public/components/ai-consent/ai-consent.component.scss',
  'src/app/modules/legal/components/document/document-list/document-list.component.scss',
  'src/app/modules/file-manager/components/file-manager/file-manager.component.scss',
  'src/app/modules/legal/components/case/case-detail/case-detail.component.scss',
  'src/app/modules/legal/components/case/case-time-entries/case-time-entries.component.scss',
  'src/app/modules/legal/components/case/case-research/case-research.component.scss',
  'src/app/modules/legal/components/document-analyzer/document-analyzer.component.scss',
  'src/app/modules/legal/components/ai-assistant/legal-research/legal-research.component.scss',
  'src/app/modules/legal/components/ai-assistant/templates/template-library.component.scss',
  'src/app/modules/legal/components/ai-assistant/ai-workspace/draft-dashboard/draft-dashboard.component.scss',
  'src/app/modules/legal/components/ai-assistant/ai-workspace/draft-wizard/draft-wizard.component.scss',
  'src/app/modules/legal/components/ai-assistant/practice-areas/personal-injury/personal-injury.component.scss',
  'src/app/modules/legal/components/ai-assistant/ai-workspace/ai-workspace.component.scss',
];

async function getFiles() {
  if (!ALL) return PRIORITY_FILES;
  const all = await glob('src/app/**/*.component.scss', { cwd: ROOT });
  return all.filter(f => !EXCLUDED_PATTERNS.some(p => f.startsWith(p))).sort();
}

// Mapping rules: regex match → replacement template (with $N backrefs).
// Order matters: more specific patterns first.
const MAPPINGS = [
  // ── Surfaces ─────────────────────────────────────────────────
  // Pure white card backgrounds
  [/(\b(?:background|background-color):\s*)#fff(?:fff)?\b(?!\w)/g,
    '$1var(--legience-bg-card, #fff)'],

  // Off-white tints — subtle hover/backdrop surfaces
  [/(\b(?:background|background-color):\s*)#f9fafb\b/g, '$1var(--legience-bg-card-hover, #f9fafb)'],
  [/(\b(?:background|background-color):\s*)#f3f6f9\b/g, '$1var(--legience-bg-card-hover, #f3f6f9)'],
  [/(\b(?:background|background-color):\s*)#fafbfc\b/g, '$1var(--legience-bg-card-hover, #fafbfc)'],
  [/(\b(?:background|background-color):\s*)#f8f9fa\b/g, '$1var(--legience-bg-card-hover, #f8f9fa)'],
  [/(\b(?:background|background-color):\s*)#f0f2f5\b/g, '$1var(--legience-bg-card-hover, #f0f2f5)'],
  [/(\b(?:background|background-color):\s*)#f5f5f4\b/g, '$1var(--legience-bg-card-hover, #f5f5f4)'],

  // Slightly darker grey — disabled / inactive surfaces
  [/(\b(?:background|background-color):\s*)#e9ecef\b/g, '$1var(--legience-bg-subtle, #e9ecef)'],
  [/(\b(?:background|background-color):\s*)#ececea\b/g, '$1var(--legience-bg-subtle, #ececea)'],

  // ── Text ─────────────────────────────────────────────────────
  // Primary (near-black)
  [/(\bcolor:\s*)#0c0a09\b/g, '$1var(--legience-text-primary, #0c0a09)'],
  [/(\bcolor:\s*)#1c1917\b/g, '$1var(--legience-text-primary, #1c1917)'],
  [/(\bcolor:\s*)#1f2937\b/g, '$1var(--legience-text-primary, #1f2937)'],
  [/(\bcolor:\s*)#333(?!\w)/g, '$1var(--legience-text-primary, #333)'],
  [/(\bcolor:\s*)#000(?:000)?\b(?!\w)/g, '$1var(--legience-text-primary, #000)'],

  // Secondary (dark grey)
  [/(\bcolor:\s*)#44403c\b/g, '$1var(--legience-text-secondary, #44403c)'],
  [/(\bcolor:\s*)#4b5563\b/g, '$1var(--legience-text-secondary, #4b5563)'],
  [/(\bcolor:\s*)#495057\b/g, '$1var(--legience-text-secondary, #495057)'],
  [/(\bcolor:\s*)#212529\b/g, '$1var(--legience-text-secondary, #212529)'],

  // Muted (medium grey)
  [/(\bcolor:\s*)#6b7280\b/g, '$1var(--legience-text-muted, #6b7280)'],
  [/(\bcolor:\s*)#6c757d\b/g, '$1var(--legience-text-muted, #6c757d)'],
  [/(\bcolor:\s*)#57534d\b/g, '$1var(--legience-text-muted, #57534d)'],
  [/(\bcolor:\s*)#878a99\b/g, '$1var(--legience-text-muted, #878a99)'],

  // Subtle (light grey)
  [/(\bcolor:\s*)#9ca3af\b/g, '$1var(--legience-text-subtle, #9ca3af)'],
  [/(\bcolor:\s*)#a6a09b\b/g, '$1var(--legience-text-subtle, #a6a09b)'],

  // ── Borders ──────────────────────────────────────────────────
  // Capture full `border[-side]: <width> <style> #hex` patterns.
  // Side optional; matches border, border-top/right/bottom/left.
  [/(\bborder(?:-(?:top|right|bottom|left))?\s*:\s*[\d.]+(?:px|rem)\s+(?:solid|dashed|dotted)\s+)#e5e7eb\b/g,
    '$1var(--legience-border-hairline, #e5e7eb)'],
  [/(\bborder(?:-(?:top|right|bottom|left))?\s*:\s*[\d.]+(?:px|rem)\s+(?:solid|dashed|dotted)\s+)#e9ebec\b/g,
    '$1var(--legience-border-hairline, #e9ebec)'],
  [/(\bborder(?:-(?:top|right|bottom|left))?\s*:\s*[\d.]+(?:px|rem)\s+(?:solid|dashed|dotted)\s+)#e9ecef\b/g,
    '$1var(--legience-border-hairline, #e9ecef)'],
  [/(\bborder(?:-(?:top|right|bottom|left))?\s*:\s*[\d.]+(?:px|rem)\s+(?:solid|dashed|dotted)\s+)#dee2e6\b/g,
    '$1var(--legience-border-hairline, #dee2e6)'],
  [/(\bborder(?:-(?:top|right|bottom|left))?\s*:\s*[\d.]+(?:px|rem)\s+(?:solid|dashed|dotted)\s+)#d1d5db\b/g,
    '$1var(--legience-border-hairline, #d1d5db)'],
  [/(\bborder(?:-(?:top|right|bottom|left))?\s*:\s*[\d.]+(?:px|rem)\s+(?:solid|dashed|dotted)\s+)#e0e4e8\b/g,
    '$1var(--legience-border-hairline, #e0e4e8)'],
  [/(\bborder(?:-(?:top|right|bottom|left))?\s*:\s*[\d.]+(?:px|rem)\s+(?:solid|dashed|dotted)\s+)#f3f3f9\b/g,
    '$1var(--legience-border-hairline, #f3f3f9)'],
  [/(\bborder(?:-(?:top|right|bottom|left))?\s*:\s*[\d.]+(?:px|rem)\s+(?:solid|dashed|dotted)\s+)#e7e5e4\b/g,
    '$1var(--legience-border-hairline, #e7e5e4)'],

  // border-color and border-{side}-color shorthand (no width/style)
  [/(\bborder(?:-(?:top|right|bottom|left))?-color:\s*)#e5e7eb\b/g, '$1var(--legience-border-hairline, #e5e7eb)'],
  [/(\bborder(?:-(?:top|right|bottom|left))?-color:\s*)#e9ebec\b/g, '$1var(--legience-border-hairline, #e9ebec)'],
  [/(\bborder(?:-(?:top|right|bottom|left))?-color:\s*)#e9ecef\b/g, '$1var(--legience-border-hairline, #e9ecef)'],
  [/(\bborder(?:-(?:top|right|bottom|left))?-color:\s*)#dee2e6\b/g, '$1var(--legience-border-hairline, #dee2e6)'],
  [/(\bborder(?:-(?:top|right|bottom|left))?-color:\s*)#d1d5db\b/g, '$1var(--legience-border-hairline, #d1d5db)'],

  // ── Velzon var → Legience var (color contexts only) ──────────
  // Property uses --vz-primary directly: swap to --legience-accent.
  // Only when the var() is the WHOLE value, not a fallback inside another var.
  [/(\b(?:color|background|background-color|fill|stroke):\s*)var\(--vz-primary\)(?!-)/g,
    '$1var(--legience-accent)'],

  // ── Velzon brand colors used as bare hex ─────────────────────
  // Only matches the hex when it's the WHOLE value of a color/background
  // property — never inside gradients (those are page-specific design choices
  // that shouldn't get blanket-substituted).
  [/(\b(?:color|background|background-color|fill|stroke):\s*)#405189\b/g,
    '$1var(--legience-accent, #405189)'],
  [/(\b(?:color|background|background-color|fill|stroke):\s*)#556ee6\b/g,
    '$1var(--legience-accent, #556ee6)'],
  [/(\b(?:color|background|background-color|fill|stroke):\s*)#0d6efd\b/g,
    '$1var(--legience-accent, #0d6efd)'],
  [/(\b(?:color|background|background-color|fill|stroke):\s*)#0ab39c\b/g,
    '$1var(--legience-success, #0ab39c)'],
  [/(\b(?:color|background|background-color|fill|stroke):\s*)#198754\b/g,
    '$1var(--legience-success, #198754)'],
  [/(\b(?:color|background|background-color|fill|stroke):\s*)#f06548\b/g,
    '$1var(--legience-danger, #f06548)'],
  [/(\b(?:color|background|background-color|fill|stroke):\s*)#dc3545\b/g,
    '$1var(--legience-danger, #dc3545)'],
  [/(\b(?:color|background|background-color|fill|stroke):\s*)#299cdb\b/g,
    '$1var(--legience-info, #299cdb)'],
  [/(\b(?:color|background|background-color|fill|stroke):\s*)#0ea5e9\b/g,
    '$1var(--legience-info, #0ea5e9)'],
  [/(\b(?:color|background|background-color|fill|stroke):\s*)#f7b84b\b/g,
    '$1var(--legience-warning, #f7b84b)'],
  [/(\b(?:color|background|background-color|fill|stroke):\s*)#ffc107\b/g,
    '$1var(--legience-warning, #ffc107)'],

  // ── Bootstrap greys / borders ─────────────────────────────────
  [/(\bcolor:\s*)#212529\b/g, '$1var(--legience-text-secondary, #212529)'],
  [/(\bcolor:\s*)#adb5bd\b/g, '$1var(--legience-text-muted, #adb5bd)'],
  [/(\bborder(?:-(?:top|right|bottom|left))?\s*:\s*[\d.]+(?:px|rem)\s+(?:solid|dashed|dotted)\s+)#ced4da\b/g,
    '$1var(--legience-border-hairline, #ced4da)'],
  [/(\bborder(?:-(?:top|right|bottom|left))?\s*:\s*[\d.]+(?:px|rem)\s+(?:solid|dashed|dotted)\s+)#c9d1d9\b/g,
    '$1var(--legience-border-hairline, #c9d1d9)'],
  [/(\bborder(?:-(?:top|right|bottom|left))?-color:\s*)#ced4da\b/g, '$1var(--legience-border-hairline, #ced4da)'],
  [/(\bborder(?:-(?:top|right|bottom|left))?-color:\s*)#c9d1d9\b/g, '$1var(--legience-border-hairline, #c9d1d9)'],
];

async function main() {
  const FILES = await getFiles();
  let totalSubstitutions = 0;
  const fileResults = [];

  for (const file of FILES) {
    const full = join(ROOT, file);
    let content;
    try {
      content = readFileSync(full, 'utf8');
    } catch (e) {
      fileResults.push({ file, error: e.code === 'ENOENT' ? 'file not found' : e.message, count: 0 });
      continue;
    }

    let count = 0;

    // Skip lines where wrapping in var() would break SCSS compilation:
    //   * `$variable: #hex;`  — color functions (lighten/darken) reject var()
    //   * lines containing `lighten(`, `darken(`, `mix(`, etc. — same reason
    const SKIP_LINE = /(^\s*\$[\w-]+\s*:)|(\b(?:lighten|darken|mix|saturate|desaturate|transparentize|opacify|fade-in|fade-out|adjust-hue|complement|invert|grayscale)\s*\()/;

    const updated = content
      .split('\n')
      .map(line => {
        if (SKIP_LINE.test(line)) return line;
        let next = line;
        for (const [from, to] of MAPPINGS) {
          next = next.replace(from, (...args) => {
            count++;
            return to.replace(/\$(\d+)/g, (_, n) => args[parseInt(n, 10)]);
          });
        }
        return next;
      })
      .join('\n');

    if (!DRY_RUN && count > 0) {
      writeFileSync(full, updated);
    }
    fileResults.push({ file, count });
    totalSubstitutions += count;
  }

  const banner = DRY_RUN ? 'DRY RUN — no files written' : 'Bulk migration applied';
  const scope = ALL ? `all ${FILES.length} component SCSS files` : `${FILES.length} priority files`;
  console.log(`\n${banner} (${scope})`);
  console.log(`Total substitutions: ${totalSubstitutions}\n`);

  if (ALL) {
    // In --all mode the file list is huge; only print files with changes.
    const changed = fileResults.filter(r => r.count > 0 || r.error);
    const maxLen = Math.max(...changed.map(r => r.file.length), 0);
    changed.forEach(r => {
      const padded = r.file.padEnd(maxLen, ' ');
      if (r.error)      console.log(`  ✗ ${padded}  (${r.error})`);
      else              console.log(`  ✓ ${padded}  ${r.count} substitutions`);
    });
    console.log(`\n${changed.length} files modified, ${FILES.length - changed.length} unchanged.`);
  } else {
    const maxLen = Math.max(...fileResults.map(r => r.file.length));
    fileResults.forEach(r => {
      const padded = r.file.padEnd(maxLen, ' ');
      if (r.error)        console.log(`  ✗ ${padded}  (${r.error})`);
      else if (r.count)   console.log(`  ✓ ${padded}  ${r.count} substitutions`);
      else                console.log(`  · ${padded}  no changes`);
    });
  }
}

main().catch(e => { console.error(e); process.exit(1); });
