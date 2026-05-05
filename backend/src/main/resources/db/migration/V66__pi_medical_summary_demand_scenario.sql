-- V64: add demand_scenario JSONB to pi_medical_summaries
--
-- Purpose: persist the attorney's last-saved demand calculator scenario so the
-- Damages tab restores their inputs (multiplier, wage loss, fee mode, costs,
-- liens) on next visit. PostgreSQL JSONB. Idempotent.

ALTER TABLE pi_medical_summaries
    ADD COLUMN IF NOT EXISTS demand_scenario JSONB;

COMMENT ON COLUMN pi_medical_summaries.demand_scenario IS
    'Attorney-saved demand calculator scenario: { multiplier, wageLoss, feeMode, costs, liens, savedAt }.';
