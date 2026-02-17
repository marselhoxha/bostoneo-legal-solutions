-- Migration: V216__postgresql_Add_Organization_Id_To_User_Events.sql
-- Purpose: Add organization_id column to user_events table for tenant isolation
-- Date: 2026-01-28
-- SECURITY: Critical tenant isolation fix - prevents cross-tenant event data access

-- =====================================================
-- Add organization_id to user_events (if table exists)
-- =====================================================
DO $$
BEGIN
    -- Check if user_events table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_events') THEN
        -- Check if organization_id column already exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'user_events' AND column_name = 'organization_id'
        ) THEN
            ALTER TABLE user_events ADD COLUMN organization_id BIGINT;

            -- Update existing records to use organization from user
            UPDATE user_events ue
            SET organization_id = (
                SELECT u.organization_id FROM users u WHERE u.id = ue.user_id
            )
            WHERE ue.organization_id IS NULL AND ue.user_id IS NOT NULL;

            -- Set default organization for records without user_id
            UPDATE user_events
            SET organization_id = 1
            WHERE organization_id IS NULL;

            -- Make column NOT NULL after populating
            ALTER TABLE user_events ALTER COLUMN organization_id SET NOT NULL;

            -- Add foreign key constraint
            ALTER TABLE user_events
            ADD CONSTRAINT fk_user_events_organization
            FOREIGN KEY (organization_id) REFERENCES organizations(id);

            -- Add index for tenant filtering
            CREATE INDEX idx_user_events_org_id ON user_events(organization_id);

            -- Add composite index for common query pattern
            CREATE INDEX idx_user_events_org_user ON user_events(organization_id, user_id);

            RAISE NOTICE 'Added organization_id to user_events';
        ELSE
            RAISE NOTICE 'organization_id already exists in user_events';
        END IF;
    ELSE
        RAISE NOTICE 'user_events table does not exist - skipping migration';
    END IF;
END $$;

-- =====================================================
-- Summary log
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE 'V216 Migration Complete: Added organization_id to user_events for tenant isolation';
END $$;
