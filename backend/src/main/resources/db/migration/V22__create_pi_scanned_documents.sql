-- Tracks the processing outcome of every file attempted during a medical document scan.
-- Prevents re-processing of merged, non-medical, and failed files on subsequent scans.
CREATE TABLE IF NOT EXISTS pi_scanned_documents (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id         BIGINT       NOT NULL,
    organization_id BIGINT       NOT NULL,
    document_id     BIGINT       NOT NULL,
    status          VARCHAR(20)  NOT NULL,   -- 'created','merged','non_medical','insurance','no_text','failed'
    medical_record_id BIGINT,                -- FK to pi_medical_records.id (nullable for non-medical/failed)
    error_message   TEXT,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_pi_scanned_doc UNIQUE (document_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_pi_scanned_docs_case_org
    ON pi_scanned_documents(case_id, organization_id);
