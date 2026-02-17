-- =====================================================
-- V101: Fix Lead Email Unique Constraint
-- SECURITY: Change email unique constraint from global
-- to per-organization for proper tenant isolation
-- =====================================================

-- Drop the global unique constraint on email
ALTER TABLE leads DROP INDEX IF EXISTS email;
ALTER TABLE leads DROP INDEX IF EXISTS leads_email_key;
ALTER TABLE leads DROP INDEX IF EXISTS UK_leads_email;

-- For PostgreSQL, use this instead:
-- ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_email_key;

-- Create composite unique index on (organization_id, email)
-- This allows the same email in different organizations
CREATE UNIQUE INDEX idx_leads_org_email ON leads(organization_id, email);

-- Note: The application entity has been updated to remove unique=true from email column
