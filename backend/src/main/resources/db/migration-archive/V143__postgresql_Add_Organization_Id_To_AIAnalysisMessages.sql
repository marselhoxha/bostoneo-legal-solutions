-- PostgreSQL Migration: Add organization_id to ai_analysis_messages table
-- This enables multi-tenant data isolation for AI analysis messages

-- 1. Add organization_id column
ALTER TABLE ai_analysis_messages ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- 2. Create index for tenant filtering
CREATE INDEX IF NOT EXISTS idx_ai_analysis_messages_organization_id ON ai_analysis_messages(organization_id);

-- 3. Populate organization_id from related ai_document_analysis data
UPDATE ai_analysis_messages am
SET organization_id = ada.organization_id
FROM ai_document_analysis ada
WHERE am.analysis_id = ada.id
AND am.organization_id IS NULL
AND ada.organization_id IS NOT NULL;

-- 4. Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_ai_analysis_messages_org_analysis ON ai_analysis_messages(organization_id, analysis_id);
