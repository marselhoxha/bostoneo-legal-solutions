#!/usr/bin/env node
/**
 * Capture pre-migration baseline screenshots of every route in light + dark
 * mode, with the Rox design active. Output to docs/superpowers/baselines/.
 *
 * Usage:
 *   node scripts/capture-baselines.mjs                                 # default → docs/superpowers/baselines
 *   node scripts/capture-baselines.mjs --out=docs/superpowers/baselines-current
 *
 * Workflow:
 *   1. First-time:
 *        node scripts/capture-baselines.mjs    (writes to baselines/)
 *   2. After theme changes, recapture into a -current dir and compare:
 *        node scripts/capture-baselines.mjs --out=docs/superpowers/baselines-current
 *        node scripts/compare-baselines.mjs
 *        open docs/superpowers/baselines/comparison-report.html
 *
 * Prerequisites:
 *   - dev server running at http://localhost:4200
 *   - Playwright installed:
 *       npm install --save-dev playwright
 *       npx playwright install chromium
 *   - Test user credentials available via env (no hardcoded password):
 *       BASELINE_USER=a.wilson@bostoneosolutions.com \
 *       BASELINE_PASS=<dev-password> \
 *       node scripts/capture-baselines.mjs
 *
 * Why this exists:
 *   Phase 2 will swap raw hex values for Tier 2 tokens across ~163 SCSS
 *   files. Without a frozen visual reference, any unintended pixel change
 *   slips through silently. These baselines are the diff source for
 *   Phase 2 verification.
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const APP_URL = process.env.APP_URL || 'http://localhost:4200';
const TEST_EMAIL = process.env.BASELINE_USER;
const TEST_PASSWORD = process.env.BASELINE_PASS;

if (!TEST_EMAIL || !TEST_PASSWORD) {
  console.error('Missing BASELINE_USER or BASELINE_PASS env vars.');
  console.error('Usage: BASELINE_USER=<email> BASELINE_PASS=<pw> node scripts/capture-baselines.mjs');
  process.exit(1);
}

// Routes to baseline. List drives Phase 2/3 prioritization.
// Excluded routes (PI case detail, attorney dashboard, topbar) are still
// captured here as references — we want to detect regressions on them too,
// even though they're not migrated.
const ROUTES = [
  '/home',
  '/legal/cases',
  '/legal/calendar',
  '/case-management/tasks',
  '/clients',
  '/billing-dashboard',
  '/time-tracking/dashboard',
  '/time-tracking/entry',
  '/time-tracking/approval',
  '/time-tracking/rates',
  '/invoices',
  '/expenses',
  '/crm/dashboard',
  '/crm/intake-submissions',
  '/crm/leads',
  '/signatures',
  '/legal/ai-assistant/legispace',
  '/legal/ai-assistant/legipi',
  '/legal/ai-assistant/templates',
  '/settings/profile',
  '/settings/organization',
];

const OUT_DIR = process.argv.find(a => a.startsWith('--out='))?.split('=')[1]
              ?? 'docs/superpowers/baselines';

async function login(page) {
  await page.goto(`${APP_URL}/login`);
  await page.waitForSelector('input[type="email"], input[placeholder*="email" i]');
  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
  await emailInput.fill(TEST_EMAIL);
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill(TEST_PASSWORD);
  await page.locator('button:has-text("Sign In"), button:has-text("Log In"), button[type="submit"]').first().click();
  // Wait for redirect away from /login
  await page.waitForURL(url => !/\/login/.test(url.toString()), { timeout: 15000 });
}

async function setDesignAndTheme(page, theme) {
  // 1. Force Rox design via localStorage (design-switcher.component.ts reads this on init)
  // 2. Force the data-design attribute directly so it takes effect immediately
  // 3. Force light/dark mode via data-bs-theme on <html>
  await page.evaluate(t => {
    localStorage.setItem('legience_design_preview', 'rox');
    document.documentElement.setAttribute('data-design', 'rox');
    document.documentElement.setAttribute('data-bs-theme', t);
  }, theme);
  await page.waitForTimeout(300); // let CSS apply
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log(`Logging in as ${TEST_EMAIL}...`);
  await login(page);
  console.log('Logged in.\n');

  let captured = 0;
  let skipped = 0;

  for (const theme of ['light', 'dark']) {
    console.log(`=== ${theme.toUpperCase()} MODE ===`);

    for (const route of ROUTES) {
      const safeName = route.replace(/^\//, '').replace(/\//g, '-') || 'home';
      const filename = `${safeName}-${theme}.png`;
      const outPath = join(OUT_DIR, filename);

      try {
        await page.goto(`${APP_URL}${route}`, { waitUntil: 'networkidle', timeout: 20000 });
        await page.waitForTimeout(800); // settle animations
        // Re-apply design + theme — route navigation can reset attrs
        await setDesignAndTheme(page, theme);
        await page.screenshot({ path: outPath, fullPage: true });
        console.log(`  ${route} → ${filename}`);
        captured++;
      } catch (e) {
        console.log(`  ${route} → SKIP (${e.message.slice(0, 80)})`);
        skipped++;
      }
    }
    console.log();
  }

  await browser.close();
  console.log(`Captured: ${captured}, skipped: ${skipped}`);
  console.log(`Baselines in ${OUT_DIR}/`);
}

main().catch(e => { console.error(e); process.exit(1); });
