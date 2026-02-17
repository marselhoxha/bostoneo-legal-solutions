-- Migration: Add organization_id to lead_activities table
-- This is a critical security fix for multi-tenant data isolation

-- Add organization_id to lead_activities
ALTER TABLE lead_activities ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Backfill organization_id based on the lead's organization
UPDATE lead_activities la
SET organization_id = (
    SELECT l.organization_id
    FROM leads l
    WHERE l.id = la.lead_id
)
WHERE la.organization_id IS NULL AND la.lead_id IS NOT NULL;

-- For any remaining, try from the creator user
UPDATE lead_activities la
SET organization_id = (
    SELECT u.organization_id
    FROM users u
    WHERE u.id = la.created_by
)
WHERE la.organization_id IS NULL AND la.created_by IS NOT NULL;

-- Set default organization for any remaining records (fallback to org 1)
UPDATE lead_activities SET organization_id = 1 WHERE organization_id IS NULL;

-- Make the column NOT NULL after backfill
ALTER TABLE lead_activities ALTER COLUMN organization_id SET NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_lead_activities_org ON lead_activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_org_lead ON lead_activities(organization_id, lead_id);

-- Add foreign key constraint
ALTER TABLE lead_activities
    ADD CONSTRAINT fk_lead_activities_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);
