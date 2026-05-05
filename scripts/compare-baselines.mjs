#!/usr/bin/env node
/**
 * Generate an HTML report comparing baseline screenshots to a "current" set.
 *
 * Why HTML instead of a pixel-diff library: the codebase doesn't have
 * pngjs / pixelmatch as deps, and adding them just for occasional visual
 * regression checks isn't worth it. A side-by-side HTML report lets a human
 * scan all 42 routes in a few minutes — much higher signal than pixel-diff
 * counts for a theming migration where slight differences are expected.
 *
 * Usage:
 *   1. Capture baselines once (already done at docs/superpowers/baselines/)
 *   2. After making theme changes, recapture into a "current" dir:
 *      node scripts/capture-baselines.mjs --out docs/superpowers/baselines-current
 *      (requires Playwright + running ng serve — see capture-baselines.mjs)
 *   3. Generate the report:
 *      node scripts/compare-baselines.mjs
 *   4. Open docs/superpowers/baselines/comparison-report.html in a browser
 *
 * The report shows each route's baseline vs current screenshots side by side
 * with route name and theme labels. Visually scan for regressions. Faster
 * than diff-tool tuning for a one-shot theming migration.
 */

import { readdirSync, writeFileSync, existsSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const BASELINE_DIR = 'docs/superpowers/baselines';
const CURRENT_DIR = process.argv.find(a => a.startsWith('--current='))?.split('=')[1]
                   ?? 'docs/superpowers/baselines-current';
const OUT = join(BASELINE_DIR, 'comparison-report.html');

function main() {
  const baselineFull = join(ROOT, BASELINE_DIR);
  const currentFull = join(ROOT, CURRENT_DIR);

  if (!existsSync(baselineFull)) {
    console.error(`Baseline directory not found: ${BASELINE_DIR}`);
    console.error(`Capture first: node scripts/capture-baselines.mjs`);
    process.exit(1);
  }

  const baselines = readdirSync(baselineFull)
    .filter(f => f.endsWith('.png'))
    .sort();

  if (baselines.length === 0) {
    console.error(`No PNG files in ${BASELINE_DIR}`);
    process.exit(1);
  }

  const currentExists = existsSync(currentFull);
  const currentFiles = currentExists
    ? new Set(readdirSync(currentFull).filter(f => f.endsWith('.png')))
    : new Set();

  // Group by route, theme variant
  const rows = baselines.map(name => {
    const [route, theme] = parseName(name);
    return {
      name,
      route,
      theme,
      baselinePath: relative(BASELINE_DIR, join(baselineFull, name)),
      currentPath: currentFiles.has(name)
        ? relative(BASELINE_DIR, join(currentFull, name))
        : null,
    };
  });

  const html = renderHtml(rows, currentExists);
  writeFileSync(join(ROOT, OUT), html);

  const matched = rows.filter(r => r.currentPath).length;
  console.log(`\nReport written: ${OUT}`);
  console.log(`  Baselines: ${rows.length}`);
  console.log(`  Current matches: ${matched}`);
  console.log(`  Missing current: ${rows.length - matched}`);
  if (!currentExists) {
    console.log(`\n⚠️  Current directory not found: ${CURRENT_DIR}`);
    console.log(`   Report shows baselines only. Capture current state first:`);
    console.log(`     node scripts/capture-baselines.mjs --out ${CURRENT_DIR}`);
  }
}

// "legal-cases-light.png" → ["legal-cases", "light"]
// "home-dark.png" → ["home", "dark"]
function parseName(filename) {
  const base = filename.replace(/\.png$/, '');
  const m = base.match(/^(.+)-(light|dark)$/);
  return m ? [m[1], m[2]] : [base, 'unknown'];
}

function renderHtml(rows, hasCurrent) {
  const groupedByRoute = new Map();
  for (const r of rows) {
    if (!groupedByRoute.has(r.route)) groupedByRoute.set(r.route, {});
    groupedByRoute.get(r.route)[r.theme] = r;
  }

  const sections = [...groupedByRoute.entries()].map(([route, themes]) => {
    const lightRow = themes.light;
    const darkRow = themes.dark;
    return `
      <section>
        <h2>/${route.replace(/-/g, '/')}</h2>
        <div class="theme-grid">
          ${renderThemeBlock('Light', lightRow, hasCurrent)}
          ${renderThemeBlock('Dark', darkRow, hasCurrent)}
        </div>
      </section>
    `;
  }).join('\n');

  const status = hasCurrent
    ? `<p class="status ok">Comparing baseline ↔ current</p>`
    : `<p class="status warn">Showing baselines only — capture current to compare</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Theme migration — visual comparison</title>
<style>
  body { font: 14px/1.5 -apple-system, system-ui, sans-serif; margin: 0; padding: 24px; background: #f5f5f4; color: #0c0a09; }
  h1 { font-size: 24px; margin: 0 0 8px; }
  h2 { font-size: 18px; margin: 32px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #e7e5e4; }
  .status { padding: 8px 12px; border-radius: 6px; display: inline-block; font-weight: 500; }
  .status.ok { background: rgba(22, 163, 74, 0.10); color: #16a34a; }
  .status.warn { background: rgba(249, 183, 3, 0.18); color: #b07700; }
  .theme-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .theme-block { background: #fff; border: 1px solid #e7e5e4; border-radius: 8px; overflow: hidden; }
  .theme-block-header { padding: 8px 12px; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e7e5e4; background: #f5f5f4; }
  .compare-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #e7e5e4; }
  .compare-pair > div { background: #fff; padding: 8px; }
  .compare-pair img { width: 100%; height: auto; display: block; border-radius: 4px; }
  .compare-pair label { display: block; font-size: 11px; color: #57534d; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; font-weight: 600; }
  .missing { padding: 24px; text-align: center; color: #a6a09b; font-style: italic; }
  nav { position: sticky; top: 0; background: #f5f5f4; padding: 12px 0; margin: -24px -24px 24px; padding-left: 24px; border-bottom: 1px solid #e7e5e4; }
  nav a { display: inline-block; padding: 4px 10px; margin: 2px; background: #fff; border: 1px solid #e7e5e4; border-radius: 999px; font-size: 12px; color: #44403c; text-decoration: none; }
  nav a:hover { background: #0b64e9; color: #fff; border-color: #0b64e9; }
</style>
</head>
<body>
<h1>Theme migration — visual comparison</h1>
${status}

<nav>
  ${[...groupedByRoute.keys()].map(r => `<a href="#${r}">${r}</a>`).join('\n  ')}
</nav>

${sections}

</body>
</html>`;
}

function renderThemeBlock(label, row, hasCurrent) {
  if (!row) return `<div class="theme-block"><div class="theme-block-header">${label}</div><div class="missing">No baseline</div></div>`;
  const baselineImg = `<img src="${row.baselinePath}" alt="${label} baseline">`;
  const currentImg = row.currentPath
    ? `<img src="${row.currentPath}" alt="${label} current">`
    : `<div class="missing">Not captured</div>`;
  return `
    <div class="theme-block" id="${row.route}">
      <div class="theme-block-header">${label}</div>
      <div class="compare-pair">
        <div><label>Baseline</label>${baselineImg}</div>
        <div><label>Current</label>${currentImg}</div>
      </div>
    </div>
  `;
}

main();
