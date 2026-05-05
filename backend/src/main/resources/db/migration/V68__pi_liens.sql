-- =============================================================================
-- V66 - PI Liens & Subrogation tracker
-- =============================================================================
-- P10.c (PI Case Workflow): tracks lien holders / subrogation claims against
-- the eventual settlement. Surfaced on the Damages tab for working
-- negotiation, and read by the closing statement (P9f) when computing
-- net-to-client.
--
-- Why a dedicated table over JSONB on pi_medical_summaries:
--   - Liens accrue independently of the medical summary lifecycle (resolution
--     happens post-summary, after demand)
--   - Filterable / sortable / aggregatable per-case
--   - Status transitions (OPEN → NEGOTIATING → RESOLVED) are first-class
--
-- PostgreSQL only.
-- =============================================================================

CREATE TABLE IF NOT EXISTS pi_liens (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id           BIGINT       NOT NULL,
    organization_id   BIGINT       NOT NULL,
    holder            VARCHAR(255) NOT NULL,                       -- e.g. "Boston Spine Center"
    type              VARCHAR(20)  NOT NULL,                       -- MEDICAL | HEALTH_INS | MEDICARE | MEDICAID | ATTORNEY | OTHER
    original_amount   NUMERIC(12,2),                               -- amount asserted by the lien-holder
    negotiated_amount NUMERIC(12,2),                               -- counter / settled amount once we work it down
    status            VARCHAR(20)  NOT NULL DEFAULT 'OPEN',        -- OPEN | NEGOTIATING | RESOLVED
    notes             TEXT,                                        -- attorney-facing notes (statutory citations, contact info, etc.)
    asserted_date     DATE,                                        -- date the lien was asserted / first notice
    resolved_date     DATE,                                        -- date final amount was agreed
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        BIGINT
);

-- Tenant + per-case lookup. Damages tab pulls all liens for a case in a
-- single org-scoped query.
CREATE INDEX IF NOT EXISTS idx_pi_liens_case_org
    ON pi_liens (case_id, organization_id);

-- Status filtering ("show open liens only") — bounded enum, cheap to index.
CREATE INDEX IF NOT EXISTS idx_pi_liens_case_status
    ON pi_liens (case_id, status);

COMMENT ON TABLE pi_liens IS
    'P10.c — PI case liens & subrogation claims. Reduces settlement net-to-client at closing.';
COMMENT ON COLUMN pi_liens.type IS
    'Lien type: MEDICAL (provider), HEALTH_INS (private insurer subrogation), MEDICARE / MEDICAID (statutory), ATTORNEY (prior counsel charging lien), OTHER';
COMMENT ON COLUMN pi_liens.status IS
    'Lifecycle: OPEN (asserted, no negotiation yet), NEGOTIATING (back-and-forth in progress), RESOLVED (final amount agreed)';
