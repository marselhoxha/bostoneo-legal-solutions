-- V12: Add stationery template/attorney association to workspace documents
-- When a user applies stationery to a document, we store the IDs so it auto-loads on reopen

ALTER TABLE ai_workspace_documents
    ADD COLUMN IF NOT EXISTS stationery_template_id BIGINT,
    ADD COLUMN IF NOT EXISTS stationery_attorney_id BIGINT;
