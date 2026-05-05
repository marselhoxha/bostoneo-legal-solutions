-- =============================================================================
-- V69 - legal_cases.field_provenance JSONB column
-- =============================================================================
-- P1 (PI Case Detail Redesign): adds per-field provenance tracking so the
-- attorney-facing UI can render a small marker next to each fact telling
-- the user where it came from (intake form / client portal / AI / manual).
--
-- Storage shape (PostgreSQL JSONB), keyed by field path:
--   {
--     "parties.plaintiff_dob": "INTAKE_FORM",
--     "incident.dol":          "INTAKE_FORM",
--     "demand.multiplier":     "AI_EXTRACTED",
--     "insurance.adjuster":    "MANUAL"
--   }
--
-- Source values are the enum names from
-- com.bostoneo.bostoneosolutions.enumeration.ProvenanceSource:
--   INTAKE_FORM, CLIENT_PORTAL, AI_EXTRACTED, MANUAL
--
-- Why JSONB rather than a separate provenance_entries table:
--   - No JOIN; provenance is read alongside the case row in one query
--   - Per-field discipline matches spec §7.6 (each fact carries its source)
--   - PostgreSQL JSONB is queryable + indexable if needed later
--
-- No backfill: existing cases start with empty {} and populate as services
-- (intake submission, AI extraction, manual edits) record source on write.
-- Empty markers render as a neutral dot in the UI, not as a missing-data
-- error, so cold-starting from {} is correct behavior.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS so re-runs are no-ops.
-- =============================================================================

ALTER TABLE legal_cases
    ADD COLUMN IF NOT EXISTS field_provenance JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN legal_cases.field_provenance IS
    'Per-field source map: {fieldPath -> ProvenanceSource}. Populated by intake/AI/portal/manual write paths. Read by ProvenanceService and rendered by the <app-provenance-marker> component on the case-detail UI.';
