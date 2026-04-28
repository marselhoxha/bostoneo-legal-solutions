-- ============================================================================
-- V55 — Cache raw AI extraction on pi_scanned_documents
-- ============================================================================
-- Stores the raw JSON response from analyzeDocumentWithAI alongside the scan
-- tracking record. Lets us re-run persistence/merge logic ("reprocess") against
-- existing scans without re-calling Bedrock — eliminates token cost when we
-- iterate on createRecordFromAnalysis or mergeAnalysisIntoRecord behavior.
--
-- Populated automatically by the scan flow in all environments.
-- The /reprocess endpoint that consumes it is dev/staging-only via @Profile;
-- the column itself ships everywhere so schemas stay consistent and the cache
-- is available for support/debugging in any environment.
-- ============================================================================

ALTER TABLE pi_scanned_documents
    ADD COLUMN IF NOT EXISTS raw_extraction JSONB;

COMMENT ON COLUMN pi_scanned_documents.raw_extraction IS 'Cached raw AI response from analyzeDocumentWithAI for the source document. Populated on every scan; consumed by /reprocess endpoint (dev/staging only) to re-run persistence/merge logic without re-billing AI tokens. NULL for scans predating this feature or for documents that did not produce AI output.';
