-- Migration V154: Add organization_id to remaining tables for multi-tenant isolation
-- Tables: file_shares, file_tags, collection_documents, collection_search_cache,
--         collection_search_history, thread_attorney_status, workload_calculations,
--         case_assignment_history, lead_pipeline_history

-- ============================================================
-- 1. FILE_SHARES - Get org_id from file_items parent
-- ============================================================
ALTER TABLE file_shares ADD COLUMN IF NOT EXISTS organization_id BIGINT;

UPDATE file_shares fs
SET organization_id = fi.organization_id
FROM file_items fi
WHERE fs.file_id = fi.id
  AND fs.organization_id IS NULL;

-- For any orphaned records, use default org (1)
UPDATE file_shares SET organization_id = 1 WHERE organization_id IS NULL;

ALTER TABLE file_shares ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_file_shares_org_id ON file_shares(organization_id);
CREATE INDEX IF NOT EXISTS idx_file_shares_org_file ON file_shares(organization_id, file_id);

-- ============================================================
-- 2. FILE_TAGS - Get org_id from file_items parent
-- ============================================================
ALTER TABLE file_tags ADD COLUMN IF NOT EXISTS organization_id BIGINT;

UPDATE file_tags ft
SET organization_id = fi.organization_id
FROM file_items fi
WHERE ft.file_id = fi.id
  AND ft.organization_id IS NULL;

-- For any orphaned records, use default org (1)
UPDATE file_tags SET organization_id = 1 WHERE organization_id IS NULL;

ALTER TABLE file_tags ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_file_tags_org_id ON file_tags(organization_id);
CREATE INDEX IF NOT EXISTS idx_file_tags_org_file ON file_tags(organization_id, file_id);

-- ============================================================
-- 3. COLLECTION_DOCUMENTS - Get org_id from document_collections parent
-- ============================================================
ALTER TABLE collection_documents ADD COLUMN IF NOT EXISTS organization_id BIGINT;

UPDATE collection_documents cd
SET organization_id = dc.organization_id
FROM document_collections dc
WHERE cd.collection_id = dc.id
  AND cd.organization_id IS NULL;

-- For any orphaned records, use default org (1)
UPDATE collection_documents SET organization_id = 1 WHERE organization_id IS NULL;

ALTER TABLE collection_documents ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_collection_documents_org_id ON collection_documents(organization_id);

-- ============================================================
-- 4. COLLECTION_SEARCH_CACHE - Get org_id from document_collections parent
-- ============================================================
ALTER TABLE collection_search_cache ADD COLUMN IF NOT EXISTS organization_id BIGINT;

UPDATE collection_search_cache csc
SET organization_id = dc.organization_id
FROM document_collections dc
WHERE csc.collection_id = dc.id
  AND csc.organization_id IS NULL;

-- For any orphaned records, use default org (1)
UPDATE collection_search_cache SET organization_id = 1 WHERE organization_id IS NULL;

ALTER TABLE collection_search_cache ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_collection_search_cache_org_id ON collection_search_cache(organization_id);

-- ============================================================
-- 5. COLLECTION_SEARCH_HISTORY - Get org_id from document_collections parent
-- ============================================================
ALTER TABLE collection_search_history ADD COLUMN IF NOT EXISTS organization_id BIGINT;

UPDATE collection_search_history csh
SET organization_id = dc.organization_id
FROM document_collections dc
WHERE csh.collection_id = dc.id
  AND csh.organization_id IS NULL;

-- For any orphaned records, use default org (1)
UPDATE collection_search_history SET organization_id = 1 WHERE organization_id IS NULL;

ALTER TABLE collection_search_history ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_collection_search_history_org_id ON collection_search_history(organization_id);

-- ============================================================
-- 6. THREAD_ATTORNEY_STATUS - Get org_id from message_threads parent
-- ============================================================
ALTER TABLE thread_attorney_status ADD COLUMN IF NOT EXISTS organization_id BIGINT;

UPDATE thread_attorney_status tas
SET organization_id = mt.organization_id
FROM message_threads mt
WHERE tas.thread_id = mt.id
  AND tas.organization_id IS NULL;

-- For any orphaned records, use default org (1)
UPDATE thread_attorney_status SET organization_id = 1 WHERE organization_id IS NULL;

ALTER TABLE thread_attorney_status ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_thread_attorney_status_org_id ON thread_attorney_status(organization_id);

-- ============================================================
-- 7. WORKLOAD_CALCULATIONS - Get org_id from users parent
-- ============================================================
ALTER TABLE workload_calculations ADD COLUMN IF NOT EXISTS organization_id BIGINT;

UPDATE workload_calculations wc
SET organization_id = u.organization_id
FROM users u
WHERE wc.user_id = u.id
  AND wc.organization_id IS NULL;

-- For any orphaned records, use default org (1)
UPDATE workload_calculations SET organization_id = 1 WHERE organization_id IS NULL;

ALTER TABLE workload_calculations ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workload_calculations_org_id ON workload_calculations(organization_id);

-- ============================================================
-- 8. CASE_ASSIGNMENT_HISTORY - Get org_id from case_assignments parent
-- ============================================================
ALTER TABLE case_assignment_history ADD COLUMN IF NOT EXISTS organization_id BIGINT;

UPDATE case_assignment_history cah
SET organization_id = ca.organization_id
FROM case_assignments ca
WHERE cah.case_assignment_id = ca.id
  AND cah.organization_id IS NULL;

-- For any orphaned records, use default org (1)
UPDATE case_assignment_history SET organization_id = 1 WHERE organization_id IS NULL;

ALTER TABLE case_assignment_history ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_case_assignment_history_org_id ON case_assignment_history(organization_id);

-- ============================================================
-- 9. LEAD_PIPELINE_HISTORY - Get org_id from leads parent
-- ============================================================
ALTER TABLE lead_pipeline_history ADD COLUMN IF NOT EXISTS organization_id BIGINT;

UPDATE lead_pipeline_history lph
SET organization_id = l.organization_id
FROM leads l
WHERE lph.lead_id = l.id
  AND lph.organization_id IS NULL;

-- For any orphaned records, use default org (1)
UPDATE lead_pipeline_history SET organization_id = 1 WHERE organization_id IS NULL;

ALTER TABLE lead_pipeline_history ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_pipeline_history_org_id ON lead_pipeline_history(organization_id);

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'V154 Migration completed: Added organization_id to 9 tables';
END $$;
