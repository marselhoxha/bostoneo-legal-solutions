-- Migration: Add organization_id to research_session table
-- This is a critical security fix for multi-tenant data isolation (legal research)

-- Add organization_id to research_session
ALTER TABLE research_session ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Backfill organization_id based on the user's organization
UPDATE research_session rs
SET organization_id = (
    SELECT u.organization_id
    FROM users u
    WHERE u.id = rs.user_id
)
WHERE rs.organization_id IS NULL AND rs.user_id IS NOT NULL;

-- Set default organization for any remaining records (fallback to org 1)
UPDATE research_session SET organization_id = 1 WHERE organization_id IS NULL;

-- Make the column NOT NULL after backfill
ALTER TABLE research_session ALTER COLUMN organization_id SET NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_research_session_org ON research_session(organization_id);
CREATE INDEX IF NOT EXISTS idx_research_session_org_user ON research_session(organization_id, user_id);

-- Add foreign key constraint
ALTER TABLE research_session
    ADD CONSTRAINT fk_research_session_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);
