-- =====================================================
-- V102: Add Organization ID to User Events
-- SECURITY: Add organization_id column for multi-tenant isolation
-- =====================================================

-- Add organization_id column to user_events table
ALTER TABLE user_events ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Create index for tenant-filtered queries
CREATE INDEX IF NOT EXISTS idx_user_events_org_id ON user_events(organization_id);

-- Create composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_user_events_org_created ON user_events(organization_id, created_at DESC);

-- Note: Existing records will have NULL organization_id
-- Consider running a data migration to populate based on user's organization
-- UPDATE user_events ue SET organization_id = (SELECT organization_id FROM users u WHERE u.id = ue.user_id);
