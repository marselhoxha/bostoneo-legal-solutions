-- =============================================================================
-- V67 - PI Medical Summary risk_register column
-- =============================================================================
-- P11.d (PI Case Workflow): adds AI-generated risk register to the medical
-- summary entity. Three-tier scoring: pre-suit settlement likelihood,
-- litigation (post-filing) risk, trial verdict risk. Each tier surfaces
-- its score (0-100), a verdict label (FAVORABLE/MIXED/CHALLENGING),
-- and contributing factors.
--
-- Why JSONB rather than dedicated columns:
--   - Output shape may evolve as the prompt is refined
--   - Mirrors existing JSONB pattern (phasedChronology, adjusterDefenseAnalysis,
--     demandScenario)
--   - 3 tiers × 5+ factors each = ~30+ columns if normalized — overkill
--
-- Shape (illustrative):
-- {
--   "preSuit": {
--     "likelihood": 78,
--     "label": "FAVORABLE",
--     "summary": "Clear liability + documented damages. Demand range reasonable.",
--     "factors": [
--       { "factor": "Police report cites at-fault driver", "impact": "+", "weight": "HIGH" },
--       { "factor": "Treatment gap of 32 days", "impact": "-", "weight": "MEDIUM" }
--     ]
--   },
--   "suit": {
--     "risk": 45,
--     "label": "MIXED",
--     "summary": "Filing pressure if pre-suit stalls; comparative-negligence exposure.",
--     "factors": [...]
--   },
--   "trial": {
--     "risk": 62,
--     "label": "CHALLENGING",
--     "summary": "Jury venue tilts defense; expert costs erode net.",
--     "factors": [...]
--   },
--   "generatedAt": "2026-04-29T15:00:00",
--   "generatedByModel": "claude-sonnet-4"
-- }
--
-- PostgreSQL only.
-- =============================================================================

ALTER TABLE pi_medical_summaries
    ADD COLUMN IF NOT EXISTS risk_register jsonb;

ALTER TABLE pi_medical_summaries
    ADD COLUMN IF NOT EXISTS risk_register_generated_at TIMESTAMP;

COMMENT ON COLUMN pi_medical_summaries.risk_register IS
    'P11.d — AI-generated risk register with pre-suit / suit / trial scoring + contributing factors. Generated on demand from the Strategy tab.';
COMMENT ON COLUMN pi_medical_summaries.risk_register_generated_at IS
    'P11.d — Timestamp of last risk_register generation. Used to detect staleness when records change.';
