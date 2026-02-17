-- Migration: Add organization_id to expenses table
-- This is a critical security fix for multi-tenant data isolation

-- Add organization_id to expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Backfill organization_id based on the client's organization
UPDATE expenses e
SET organization_id = (
    SELECT c.organization_id
    FROM clients c
    WHERE c.id = e.client_id
)
WHERE e.organization_id IS NULL AND e.client_id IS NOT NULL;

-- Fallback to legal_case's organization
UPDATE expenses e
SET organization_id = (
    SELECT lc.organization_id
    FROM legal_cases lc
    WHERE lc.id = e.legal_case_id
)
WHERE e.organization_id IS NULL AND e.legal_case_id IS NOT NULL;

-- Set default organization for any remaining records (fallback to org 1)
UPDATE expenses SET organization_id = 1 WHERE organization_id IS NULL;

-- Make the column NOT NULL after backfill
ALTER TABLE expenses ALTER COLUMN organization_id SET NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_expenses_org ON expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_org_client ON expenses(organization_id, client_id);

-- Add foreign key constraint
ALTER TABLE expenses
    ADD CONSTRAINT fk_expenses_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);
