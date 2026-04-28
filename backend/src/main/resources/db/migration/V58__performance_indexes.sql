-- Performance indexes for hot lookup paths.
-- The documents and legal_cases tables had no indexes on tenant/case columns,
-- forcing full-table scans on every "list documents for case X" or "list cases
-- for org Y" query. legaldocument_tags has the FK constraint but PostgreSQL
-- does not auto-index FKs, so each @ElementCollection lookup also scanned.
--
-- Uses CREATE INDEX CONCURRENTLY so prod can apply this without an exclusive
-- lock blocking writes. Each statement runs in its own implicit transaction;
-- the accompanying V58__performance_indexes.conf disables Flyway's default
-- transaction wrap (CONCURRENTLY cannot run inside an explicit transaction).
-- Safe to re-run thanks to IF NOT EXISTS.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_case_org
    ON documents (case_id, organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_org
    ON documents (organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_legaldocument_tags_doc_id
    ON legaldocument_tags (legal_document_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_legal_cases_org
    ON legal_cases (organization_id);
