-- V77: Add billing_type to legal_cases, backfill defaults by practice area.
-- Spec: docs/superpowers/specs/2026-05-06-tasks-list-view-flow-design.md
--
-- BillingType enum: CONTINGENCY | HOURLY | FLAT_FEE | PRO_BONO
-- Drives time-log UI visibility on tasks linked to the case.
--
-- Default by practice area:
--   - Personal Injury  -> CONTINGENCY
--   - All other areas  -> HOURLY (safe default; attorneys can override)
--
-- No is_pro_bono column exists in this schema, so PRO_BONO is set
-- manually post-migration on relevant cases.

-- 1. Add the column with HOURLY default (safe baseline).
ALTER TABLE legal_cases
  ADD COLUMN IF NOT EXISTS billing_type VARCHAR(20) NOT NULL DEFAULT 'HOURLY';

-- 2. Backfill PI cases to CONTINGENCY. Existing data uses Title Case
--    ('Personal Injury'); guard with LOWER() in case any rows have
--    different capitalization.
UPDATE legal_cases
   SET billing_type = 'CONTINGENCY'
 WHERE LOWER(practice_area) = 'personal injury'
   AND billing_type = 'HOURLY';

-- 3. Comment for future engineers.
COMMENT ON COLUMN legal_cases.billing_type IS
  'BillingType enum: CONTINGENCY | HOURLY | FLAT_FEE | PRO_BONO. Drives time-log UI visibility on tasks linked to the case. Default applied by practice area at case-create time; attorney can override.';
