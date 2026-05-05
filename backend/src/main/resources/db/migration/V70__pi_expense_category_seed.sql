-- =============================================================================
-- V68 - PI expense category seed
-- =============================================================================
-- P3 (PI Case Detail Redesign): seeds the one PI-specific expense category that
-- isn't yet present at the global (org_id IS NULL) level. The Case Costs section
-- on the Damages tab lets attorneys log filing fees, expert reports, depositions,
-- travel, postage, copy charges, and the like. After auditing the live database
-- (2026-05-02), 7 of 8 needed categories already exist globally; only "Medical
-- Records" was missing. The other PI categories are already covered by:
--
--   - "Filing Fees"          (id 2  global)
--   - "Travel"               (id 4  global)
--   - "Expert Witnesses"     (id 6  global)
--   - "Depositions"          (id 7  global)
--   - "Courier & Postage"    (id 8  global)
--   - "Printing & Copying"   (id 10 global)
--   - "Other"                (id 15 global)
--
-- expense_categories has no UNIQUE constraint on `name`, so the plan's original
-- ON CONFLICT (name) DO NOTHING wouldn't work. Instead we guard with NOT EXISTS,
-- which is fully idempotent without requiring a schema change. Safe to re-run.
-- =============================================================================

INSERT INTO expense_categories (name, color, organization_id, created_at, updated_at)
SELECT 'Medical Records', '#a855f7', NULL, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM expense_categories
    WHERE name = 'Medical Records'
      AND organization_id IS NULL
);
