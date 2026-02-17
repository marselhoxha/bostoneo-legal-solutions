-- Migration: Add organization_id to user_notifications table
-- This fixes a CRITICAL multi-tenant security vulnerability
-- User notifications were shared across all tenants without isolation

-- ============================================
-- 1. Add organization_id column
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'user_notifications'
                   AND column_name = 'organization_id') THEN
        ALTER TABLE user_notifications ADD COLUMN organization_id BIGINT;
    END IF;
END $$;

-- ============================================
-- 2. Populate from user's organization
-- ============================================
UPDATE user_notifications un
SET organization_id = u.organization_id
FROM users u
WHERE un.user_id = u.id
AND un.organization_id IS NULL;

-- For any remaining NULL (orphan notifications), delete them
-- as they cannot be associated with an organization
DELETE FROM user_notifications WHERE organization_id IS NULL;

-- ============================================
-- 3. Make NOT NULL after populating
-- ============================================
ALTER TABLE user_notifications ALTER COLUMN organization_id SET NOT NULL;

-- ============================================
-- 4. Add foreign key constraint
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'fk_user_notifications_organization'
                   AND table_name = 'user_notifications') THEN
        ALTER TABLE user_notifications
        ADD CONSTRAINT fk_user_notifications_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id);
    END IF;
END $$;

-- ============================================
-- 5. Add indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_notifications_org_id
    ON user_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_org_user
    ON user_notifications(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_org_user_unread
    ON user_notifications(organization_id, user_id, read);

-- ============================================
-- 6. Comment
-- ============================================
COMMENT ON COLUMN user_notifications.organization_id IS 'SECURITY: Organization ID for multi-tenant isolation';
