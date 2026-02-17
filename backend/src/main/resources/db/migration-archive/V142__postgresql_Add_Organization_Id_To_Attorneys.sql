-- PostgreSQL Migration: Add organization_id to attorneys table
-- This enables multi-tenant data isolation for attorney records

-- 1. Add organization_id column
ALTER TABLE attorneys ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- 2. Create index for tenant filtering
CREATE INDEX IF NOT EXISTS idx_attorneys_organization_id ON attorneys(organization_id);

-- 3. Drop the unique constraint on user_id (same user can be attorney in multiple orgs)
ALTER TABLE attorneys DROP CONSTRAINT IF EXISTS attorneys_user_id_key;
ALTER TABLE attorneys DROP CONSTRAINT IF EXISTS uk_attorneys_user_id;

-- 4. Create composite unique constraint (user_id + organization_id)
ALTER TABLE attorneys ADD CONSTRAINT uk_attorneys_user_org UNIQUE (user_id, organization_id);

-- 5. Populate organization_id from related user data
UPDATE attorneys a
SET organization_id = u.organization_id
FROM users u
WHERE a.user_id = u.id
AND a.organization_id IS NULL
AND u.organization_id IS NOT NULL;

-- 6. Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_attorneys_org_active ON attorneys(organization_id, is_active);
