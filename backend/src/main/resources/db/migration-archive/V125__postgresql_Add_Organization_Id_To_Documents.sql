-- Migration: Add organization_id to documents table (LegalDocument)
-- This is a critical security fix for multi-tenant data isolation

-- Add organization_id to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Backfill organization_id based on the case's organization (if document is linked to a case)
UPDATE documents d
SET organization_id = (
    SELECT lc.organization_id
    FROM legal_cases lc
    WHERE lc.id = d.case_id
)
WHERE d.organization_id IS NULL AND d.case_id IS NOT NULL;

-- For documents without case_id, try to get org from the uploader (user)
UPDATE documents d
SET organization_id = (
    SELECT u.organization_id
    FROM users u
    WHERE u.id = d.uploaded_by
)
WHERE d.organization_id IS NULL AND d.uploaded_by IS NOT NULL;

-- Set default organization for any remaining records (fallback to org 1)
UPDATE documents SET organization_id = 1 WHERE organization_id IS NULL;

-- Make the column NOT NULL after backfill
ALTER TABLE documents ALTER COLUMN organization_id SET NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_org_case ON documents(organization_id, case_id);

-- Add foreign key constraint
ALTER TABLE documents
    ADD CONSTRAINT fk_documents_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);
