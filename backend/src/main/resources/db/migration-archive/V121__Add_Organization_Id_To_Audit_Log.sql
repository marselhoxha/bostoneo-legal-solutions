-- Add organization_id to audit_log table for multi-tenancy support
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Add index for organization-based queries
CREATE INDEX IF NOT EXISTS idx_audit_organization ON audit_log(organization_id);

-- Add composite index for organization + timestamp queries
CREATE INDEX IF NOT EXISTS idx_audit_org_timestamp ON audit_log(organization_id, timestamp DESC);
