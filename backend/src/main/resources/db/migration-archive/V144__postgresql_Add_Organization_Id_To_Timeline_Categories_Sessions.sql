-- PostgreSQL Migration: Add organization_id to case_timeline_progress, expense_categories, ai_conversation_sessions
-- This enables multi-tenant data isolation for these tables

-- 1. Add organization_id to case_timeline_progress
ALTER TABLE case_timeline_progress ADD COLUMN IF NOT EXISTS organization_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_case_timeline_progress_organization_id ON case_timeline_progress(organization_id);

-- Populate from legal_cases
UPDATE case_timeline_progress ctp
SET organization_id = lc.organization_id
FROM legal_cases lc
WHERE ctp.case_id = lc.id
AND ctp.organization_id IS NULL
AND lc.organization_id IS NOT NULL;

-- 2. Add organization_id to expense_categories
ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS organization_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_expense_categories_organization_id ON expense_categories(organization_id);

-- Assign existing categories to first organization (they were shared before multi-tenancy)
UPDATE expense_categories
SET organization_id = (SELECT MIN(id) FROM organizations)
WHERE organization_id IS NULL;

-- 3. Add organization_id to ai_conversation_sessions
ALTER TABLE ai_conversation_sessions ADD COLUMN IF NOT EXISTS organization_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_ai_conversation_sessions_organization_id ON ai_conversation_sessions(organization_id);

-- Populate from users
UPDATE ai_conversation_sessions acs
SET organization_id = u.organization_id
FROM users u
WHERE acs.user_id = u.id
AND acs.organization_id IS NULL
AND u.organization_id IS NOT NULL;

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_case_timeline_progress_org_case ON case_timeline_progress(organization_id, case_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversation_sessions_org_user ON ai_conversation_sessions(organization_id, user_id);
