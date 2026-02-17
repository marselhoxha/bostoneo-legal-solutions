-- Migration: Add organization_id to documentversion table
-- This is a critical security fix for multi-tenant data isolation

-- Add organization_id to documentversion
ALTER TABLE documentversion ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Backfill organization_id based on the document's organization
UPDATE documentversion dv
SET organization_id = (
    SELECT d.organization_id
    FROM documents d
    WHERE d.id = dv.document_id
)
WHERE dv.organization_id IS NULL AND dv.document_id IS NOT NULL;

-- For any remaining, try from the uploader user
UPDATE documentversion dv
SET organization_id = (
    SELECT u.organization_id
    FROM users u
    WHERE u.id = dv.uploaded_by
)
WHERE dv.organization_id IS NULL AND dv.uploaded_by IS NOT NULL;

-- Set default organization for any remaining records (fallback to org 1)
UPDATE documentversion SET organization_id = 1 WHERE organization_id IS NULL;

-- Make the column NOT NULL after backfill
ALTER TABLE documentversion ALTER COLUMN organization_id SET NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_documentversion_org ON documentversion(organization_id);
CREATE INDEX IF NOT EXISTS idx_documentversion_org_doc ON documentversion(organization_id, document_id);

-- Add foreign key constraint
ALTER TABLE documentversion
    ADD CONSTRAINT fk_documentversion_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);
