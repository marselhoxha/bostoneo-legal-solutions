-- Migration: Add organization_id to file_items table
-- This is a critical security fix for multi-tenant data isolation

-- Add organization_id to file_items
ALTER TABLE file_items ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Backfill organization_id based on the case's organization (if file is linked to a case)
UPDATE file_items fi
SET organization_id = (
    SELECT lc.organization_id
    FROM legal_cases lc
    WHERE lc.id = fi.case_id
)
WHERE fi.organization_id IS NULL AND fi.case_id IS NOT NULL;

-- For files without case_id, try to get org from the creator (user)
UPDATE file_items fi
SET organization_id = (
    SELECT u.organization_id
    FROM users u
    WHERE u.id = fi.created_by
)
WHERE fi.organization_id IS NULL AND fi.created_by IS NOT NULL;

-- Set default organization for any remaining records (fallback to org 1)
UPDATE file_items SET organization_id = 1 WHERE organization_id IS NULL;

-- Make the column NOT NULL after backfill
ALTER TABLE file_items ALTER COLUMN organization_id SET NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_file_items_org ON file_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_file_items_org_deleted ON file_items(organization_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_file_items_org_folder ON file_items(organization_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_file_items_org_case ON file_items(organization_id, case_id);
CREATE INDEX IF NOT EXISTS idx_file_items_org_created_by ON file_items(organization_id, created_by);

-- Add foreign key constraint
ALTER TABLE file_items
    ADD CONSTRAINT fk_file_items_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);
