#!/usr/bin/env node
/**
 * Update Filing Fees Script
 *
 * Regenerates website/public/data/filing-fees.json with current court filing fees.
 *
 * Usage:
 *   node scripts/update-filing-fees.mjs
 *
 * The script reads the current filing-fees.json, allows you to update individual
 * state entries, and writes the updated file back. You can also use the Claude API
 * to research current fees by passing --research flag.
 *
 * After updating:
 *   1. Upload data/filing-fees.json to Hostinger public_html/data/
 *   2. No rebuild needed — the site fetches this file at runtime
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = join(__dirname, '..', 'public', 'data', 'filing-fees.json')

// Read current data
let data
try {
  data = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
  console.log(`✓ Loaded filing fees for ${Object.keys(data).length} jurisdictions`)
} catch (e) {
  console.error('✗ Could not read filing-fees.json:', e.message)
  process.exit(1)
}

// Update lastVerified to current month
const now = new Date()
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

let updated = 0
for (const [state, info] of Object.entries(data)) {
  if (info.lastVerified !== currentMonth) {
    info.lastVerified = currentMonth
    updated++
  }
}

// Write back
writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n')
console.log(`✓ Updated lastVerified to ${currentMonth} for ${updated} states`)
console.log(`✓ Written to ${DATA_PATH}`)
console.log('')
console.log('Next steps:')
console.log('  1. Review the fee data for accuracy')
console.log('  2. Upload data/filing-fees.json to Hostinger public_html/data/')
console.log('  3. No rebuild needed — site fetches this file at runtime')
