-- Phase 2 of PI case workflow migration: stage manual-override stickiness.
--
-- The auto-derivation rule from V61 (CaseStageService) runs whenever a medical
-- record or settlement event changes. Without a "stickiness" flag, an attorney
-- who manually moves a case (e.g., DEMAND_SENT → NEGOTIATION because they took
-- a verbal offer over the phone) would be reverted on the next record edit.
--
-- The flag is set to true whenever an inline-edit PATCH explicitly sets the
-- `stage` field, and the auto-derivation service short-circuits when it's true.
-- A future "Reset to auto" action will clear the flag.

ALTER TABLE legal_cases
    ADD COLUMN IF NOT EXISTS stage_manually_set BOOLEAN DEFAULT false;

-- Backfill: existing PI cases haven't had a chance to manually set the stage,
-- so the flag stays false (DEFAULT). No UPDATE needed.
