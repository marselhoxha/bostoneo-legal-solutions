-- ============================================================================
-- V57 — Phase-organized chronology on pi_medical_summaries (Tier 4)
-- ============================================================================
-- Stores AI-derived clinical phases (Acute / Initial follow-up / Conservative
-- treatment / Specialist referral / etc.) as a structured JSON array. Each
-- phase has a name, rationale paragraph, date range, and the recordIds it
-- groups. The existing treatment_chronology TEXT column (flat markdown table)
-- is preserved as a fallback / alternate view.
--
-- Shape: [{phase, phaseRationale, startDate, endDate, recordIds: [...]}, ...]
-- ============================================================================

ALTER TABLE pi_medical_summaries
    ADD COLUMN IF NOT EXISTS phased_chronology JSONB;

COMMENT ON COLUMN pi_medical_summaries.phased_chronology IS 'AI-derived clinical phases grouping treatment chronology by case strategy. Array of {phase, phaseRationale, startDate, endDate, recordIds}. Generated alongside the flat treatment_chronology during summary regeneration.';
