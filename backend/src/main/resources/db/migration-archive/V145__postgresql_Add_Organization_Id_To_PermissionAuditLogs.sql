-- PostgreSQL Migration: Add organization_id to permission_audit_logs
-- This enables multi-tenant data isolation for permission audit logs

-- Add organization_id to permission_audit_logs
ALTER TABLE permission_audit_logs ADD COLUMN IF NOT EXISTS organization_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_organization_id ON permission_audit_logs(organization_id);

-- Populate from users (if user_id exists)
UPDATE permission_audit_logs pal
SET organization_id = u.organization_id
FROM users u
WHERE pal.user_id = u.id
AND pal.organization_id IS NULL
AND u.organization_id IS NOT NULL;

-- For any remaining records without org (e.g., system actions), assign to first organization
UPDATE permission_audit_logs
SET organization_id = (SELECT MIN(id) FROM organizations)
WHERE organization_id IS NULL;

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_org_timestamp ON permission_audit_logs(organization_id, timestamp);
