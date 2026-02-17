-- Migration: Add organization_id to file_comments table
-- This is a critical security fix for multi-tenant data isolation

-- Add organization_id to file_comments
ALTER TABLE file_comments ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Backfill organization_id based on the file's organization
UPDATE file_comments fc
SET organization_id = (
    SELECT fi.organization_id
    FROM file_items fi
    WHERE fi.id = fc.file_id
)
WHERE fc.organization_id IS NULL AND fc.file_id IS NOT NULL;

-- For any remaining, try from the creator user
UPDATE file_comments fc
SET organization_id = (
    SELECT u.organization_id
    FROM users u
    WHERE u.id = fc.created_by
)
WHERE fc.organization_id IS NULL AND fc.created_by IS NOT NULL;

-- Set default organization for any remaining records (fallback to org 1)
UPDATE file_comments SET organization_id = 1 WHERE organization_id IS NULL;

-- Make the column NOT NULL after backfill
ALTER TABLE file_comments ALTER COLUMN organization_id SET NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_file_comments_org ON file_comments(organization_id);
CREATE INDEX IF NOT EXISTS idx_file_comments_org_file ON file_comments(organization_id, file_id);

-- Add foreign key constraint
ALTER TABLE file_comments
    ADD CONSTRAINT fk_file_comments_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);
