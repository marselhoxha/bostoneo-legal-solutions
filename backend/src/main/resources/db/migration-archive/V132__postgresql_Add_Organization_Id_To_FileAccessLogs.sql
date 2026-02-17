-- Migration: Add organization_id to file_access_logs table
-- This is a critical security fix for multi-tenant data isolation (audit logs)

-- Add organization_id to file_access_logs
ALTER TABLE file_access_logs ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Backfill organization_id based on the file's organization
UPDATE file_access_logs fal
SET organization_id = (
    SELECT fi.organization_id
    FROM file_items fi
    WHERE fi.id = fal.file_id
)
WHERE fal.organization_id IS NULL AND fal.file_id IS NOT NULL;

-- For any remaining, try from the user
UPDATE file_access_logs fal
SET organization_id = (
    SELECT u.organization_id
    FROM users u
    WHERE u.id = fal.user_id
)
WHERE fal.organization_id IS NULL AND fal.user_id IS NOT NULL;

-- Set default organization for any remaining records (fallback to org 1)
UPDATE file_access_logs SET organization_id = 1 WHERE organization_id IS NULL;

-- Make the column NOT NULL after backfill
ALTER TABLE file_access_logs ALTER COLUMN organization_id SET NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_file_access_logs_org ON file_access_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_file_access_logs_org_file ON file_access_logs(organization_id, file_id);
CREATE INDEX IF NOT EXISTS idx_file_access_logs_org_user ON file_access_logs(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_file_access_logs_org_accessed ON file_access_logs(organization_id, accessed_at);

-- Add foreign key constraint
ALTER TABLE file_access_logs
    ADD CONSTRAINT fk_file_access_logs_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);
