-- Migration: Add organization_id to case_reminders table for tenant isolation
-- This fixes a critical multi-tenant security vulnerability where reminders were stored in-memory and shared across tenants

-- Add organization_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'case_reminders'
                   AND column_name = 'organization_id') THEN
        ALTER TABLE case_reminders ADD COLUMN organization_id BIGINT;
    END IF;
END $$;

-- Update existing reminders to get organization_id from their associated cases
UPDATE case_reminders cr
SET organization_id = lc.organization_id
FROM legal_cases lc
WHERE cr.case_id = lc.id
AND cr.organization_id IS NULL;

-- Make organization_id NOT NULL after populating
ALTER TABLE case_reminders ALTER COLUMN organization_id SET NOT NULL;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'fk_case_reminders_organization'
                   AND table_name = 'case_reminders') THEN
        ALTER TABLE case_reminders
        ADD CONSTRAINT fk_case_reminders_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id);
    END IF;
END $$;

-- Add indexes for tenant-filtered queries if they don't exist
CREATE INDEX IF NOT EXISTS idx_case_reminders_org_id ON case_reminders(organization_id);
CREATE INDEX IF NOT EXISTS idx_case_reminders_org_case ON case_reminders(organization_id, case_id);
CREATE INDEX IF NOT EXISTS idx_case_reminders_org_user ON case_reminders(organization_id, user_id);

-- Update user_id to allow null temporarily and make status/priority have defaults
ALTER TABLE case_reminders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE case_reminders ALTER COLUMN due_date DROP NOT NULL;

-- Comments
COMMENT ON TABLE case_reminders IS 'Stores case reminders with tenant isolation via organization_id';
COMMENT ON COLUMN case_reminders.organization_id IS 'SECURITY: Organization ID for multi-tenant isolation';
