-- Migration: Add organization_id to critical tables missing tenant isolation
-- This fixes CRITICAL multi-tenant security vulnerabilities

-- ============================================
-- 1. CaseAssignment - Add organization_id
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'case_assignments'
                   AND column_name = 'organization_id') THEN
        ALTER TABLE case_assignments ADD COLUMN organization_id BIGINT;
    END IF;
END $$;

-- Populate from related legal_case
UPDATE case_assignments ca
SET organization_id = lc.organization_id
FROM legal_cases lc
WHERE ca.case_id = lc.id
AND ca.organization_id IS NULL;

-- Make NOT NULL after populating
ALTER TABLE case_assignments ALTER COLUMN organization_id SET NOT NULL;

-- Add foreign key
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'fk_case_assignments_organization'
                   AND table_name = 'case_assignments') THEN
        ALTER TABLE case_assignments
        ADD CONSTRAINT fk_case_assignments_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id);
    END IF;
END $$;

-- Add index
CREATE INDEX IF NOT EXISTS idx_case_assignments_org_id ON case_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_case_assignments_org_case ON case_assignments(organization_id, case_id);

-- ============================================
-- 2. AiWorkspaceDocument - Add organization_id
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ai_workspace_documents'
                   AND column_name = 'organization_id') THEN
        ALTER TABLE ai_workspace_documents ADD COLUMN organization_id BIGINT;
    END IF;
END $$;

-- Populate from user's organization (via users table)
UPDATE ai_workspace_documents awd
SET organization_id = u.organization_id
FROM users u
WHERE awd.user_id = u.id
AND awd.organization_id IS NULL;

-- For any remaining NULL, try to get from case
UPDATE ai_workspace_documents awd
SET organization_id = lc.organization_id
FROM legal_cases lc
WHERE awd.case_id = lc.id
AND awd.organization_id IS NULL;

-- Make NOT NULL after populating
ALTER TABLE ai_workspace_documents ALTER COLUMN organization_id SET NOT NULL;

-- Add foreign key
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'fk_ai_workspace_documents_organization'
                   AND table_name = 'ai_workspace_documents') THEN
        ALTER TABLE ai_workspace_documents
        ADD CONSTRAINT fk_ai_workspace_documents_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id);
    END IF;
END $$;

-- Add index
CREATE INDEX IF NOT EXISTS idx_ai_workspace_documents_org_id ON ai_workspace_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_workspace_documents_org_user ON ai_workspace_documents(organization_id, user_id);

-- Comments
COMMENT ON COLUMN case_assignments.organization_id IS 'SECURITY: Organization ID for multi-tenant isolation';
COMMENT ON COLUMN ai_workspace_documents.organization_id IS 'SECURITY: Organization ID for multi-tenant isolation';
