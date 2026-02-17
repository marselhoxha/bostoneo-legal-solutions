-- PostgreSQL Migration: Add organization_id to AI Workspace related tables
-- This enables multi-tenant data isolation for document collections, workflows, and analysis

-- 1. Add organization_id to document_collections
ALTER TABLE document_collections ADD COLUMN IF NOT EXISTS organization_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_document_collections_organization_id ON document_collections(organization_id);

-- 2. Add organization_id to case_workflow_templates
ALTER TABLE case_workflow_templates ADD COLUMN IF NOT EXISTS organization_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_case_workflow_templates_organization_id ON case_workflow_templates(organization_id);

-- 3. Add organization_id to case_workflow_executions
ALTER TABLE case_workflow_executions ADD COLUMN IF NOT EXISTS organization_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_case_workflow_executions_organization_id ON case_workflow_executions(organization_id);

-- 4. Add organization_id to ai_document_analysis
ALTER TABLE ai_document_analysis ADD COLUMN IF NOT EXISTS organization_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_ai_document_analysis_organization_id ON ai_document_analysis(organization_id);

-- Populate organization_id from related user data where possible
-- For document_collections: use the user's organization
UPDATE document_collections dc
SET organization_id = u.organization_id
FROM users u
WHERE dc.user_id = u.id
AND dc.organization_id IS NULL
AND u.organization_id IS NOT NULL;

-- For case_workflow_executions: use the created_by user's organization
UPDATE case_workflow_executions cwe
SET organization_id = u.organization_id
FROM users u
WHERE cwe.created_by = u.id
AND cwe.organization_id IS NULL
AND u.organization_id IS NOT NULL;

-- For ai_document_analysis: use the user's organization
UPDATE ai_document_analysis ada
SET organization_id = u.organization_id
FROM users u
WHERE ada.user_id = u.id
AND ada.organization_id IS NULL
AND u.organization_id IS NOT NULL;

-- Note: case_workflow_templates with is_system=true should have organization_id=NULL (accessible by all)
