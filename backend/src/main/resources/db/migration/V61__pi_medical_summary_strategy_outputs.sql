-- Tier 5 — Case strategy outputs on PIMedicalSummary.
-- 5a: causation_summary — TEXT (encrypted at the application layer; stores
--     a collated block of causation_statement quotes from medical records,
--     formatted with attribution, used as a demand-letter-ready section).
-- 5c: open_items — JSONB array of follow-up items detected by AI
--     (e.g. "MRI ordered but no report uploaded").

ALTER TABLE pi_medical_summaries
    ADD COLUMN IF NOT EXISTS causation_summary TEXT,
    ADD COLUMN IF NOT EXISTS open_items JSONB;
