-- PostgreSQL Migration: Add organization_id to file_versions table
-- This enables multi-tenant data isolation for file version data

-- Add organization_id column to file_versions
ALTER TABLE file_versions ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Create index for tenant filtering
CREATE INDEX IF NOT EXISTS idx_file_versions_organization_id ON file_versions(organization_id);

-- Populate organization_id from parent file_items
UPDATE file_versions fv
SET organization_id = fi.organization_id
FROM file_items fi
WHERE fv.file_id = fi.id
AND fv.organization_id IS NULL;
