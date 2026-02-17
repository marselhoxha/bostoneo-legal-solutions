-- PostgreSQL Migration: Add organization_id to assignment_rules table
-- This enables multi-tenant data isolation for assignment rules

-- Add organization_id column to assignment_rules
ALTER TABLE assignment_rules ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Create index for tenant filtering
CREATE INDEX IF NOT EXISTS idx_assignment_rules_organization_id ON assignment_rules(organization_id);

-- Note: Existing rules will have NULL organization_id
-- They should be updated to associate with the appropriate organization
-- or deleted if they are no longer needed
