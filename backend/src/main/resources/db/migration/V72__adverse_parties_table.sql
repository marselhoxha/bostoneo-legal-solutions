-- V70 — Idempotent guard for the adverse_parties table.
--
-- The AdverseParty entity has been in the codebase but the table was created
-- locally via Hibernate ddl-auto:update without a Flyway migration. Production
-- runs Flyway with ddl-auto:none, so this migration ensures the table (and its
-- indexes) exist there. IF NOT EXISTS makes it a no-op on environments that
-- already have the table.
CREATE TABLE IF NOT EXISTS adverse_parties (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    case_id         BIGINT,
    client_id       BIGINT,
    name            VARCHAR(255) NOT NULL,
    email           TEXT,            -- encrypted (see EncryptedStringConverter)
    phone           TEXT,            -- encrypted
    address         TEXT,            -- encrypted
    party_type      VARCHAR(64) NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMP,
    updated_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_adverse_parties_org_case
    ON adverse_parties (organization_id, case_id);

CREATE INDEX IF NOT EXISTS idx_adverse_parties_org
    ON adverse_parties (organization_id);
