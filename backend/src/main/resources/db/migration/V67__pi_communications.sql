-- =============================================================================
-- V65 - PI Communications Log
-- =============================================================================
-- P9e (PI Case Workflow): structured communications log for personal injury
-- cases. Tracks calls, emails, letters, in-person meetings between attorney
-- and counterparties (adjusters, opposing counsel, providers, clients) with
-- direction, subject, summary. Reused on the Negotiation tab via a vertical
-- timeline mirroring pi_settlement_events.
--
-- Why a separate table from pi_settlement_events:
--   - settlement_events are demand/offer/counter financial milestones
--   - communications are the surrounding correspondence record
--   - they index/aggregate independently and have different audit-trail needs
--
-- PostgreSQL only.
-- =============================================================================

CREATE TABLE IF NOT EXISTS pi_communications (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id         BIGINT       NOT NULL,
    organization_id BIGINT       NOT NULL,
    type            VARCHAR(20)  NOT NULL,            -- CALL | EMAIL | LETTER | IN_PERSON | MEETING | OTHER
    direction       VARCHAR(10)  NOT NULL,            -- IN | OUT | INTERNAL
    counterparty    VARCHAR(255),                     -- e.g. "Sarah Chen (Hanover Insurance)"
    subject         VARCHAR(500),
    summary         TEXT,
    event_date      TIMESTAMP    NOT NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by      BIGINT
);

-- Tenant + per-case lookup. Negotiation tab pulls all comms for a case in
-- a single org-scoped query, ordered by event_date DESC for newest-first.
CREATE INDEX IF NOT EXISTS idx_pi_comms_case_org
    ON pi_communications (case_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_pi_comms_event_date
    ON pi_communications (event_date DESC);

-- Type-faceted filtering on the timeline (e.g. "show only calls"). Cheap to
-- maintain since type is bounded enum.
CREATE INDEX IF NOT EXISTS idx_pi_comms_type
    ON pi_communications (case_id, type);

COMMENT ON TABLE pi_communications IS
    'P9e — PI case communications log. Calls, emails, letters, meetings between attorney and counterparties.';
COMMENT ON COLUMN pi_communications.type IS
    'Communication channel: CALL, EMAIL, LETTER, IN_PERSON, MEETING, OTHER';
COMMENT ON COLUMN pi_communications.direction IS
    'IN (received), OUT (sent), or INTERNAL (firm-internal note)';
