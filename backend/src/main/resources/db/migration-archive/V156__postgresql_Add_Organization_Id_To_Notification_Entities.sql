-- Migration V156: Add organization_id to notification-related entities for multi-tenant isolation
-- Tables: notification_tokens, user_notification_preferences, research_action_items

-- ============================================================
-- 1. NOTIFICATION_TOKENS - Get org_id from users parent
-- ============================================================
ALTER TABLE notification_tokens ADD COLUMN IF NOT EXISTS organization_id BIGINT;

UPDATE notification_tokens nt
SET organization_id = u.organization_id
FROM users u
WHERE nt.user_id = u.id
  AND nt.organization_id IS NULL;

-- For any orphaned records, use default org (1)
UPDATE notification_tokens SET organization_id = 1 WHERE organization_id IS NULL;

ALTER TABLE notification_tokens ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_tokens_org_id ON notification_tokens(organization_id);
CREATE INDEX IF NOT EXISTS idx_notification_tokens_org_user ON notification_tokens(organization_id, user_id);

-- ============================================================
-- 2. USER_NOTIFICATION_PREFERENCES - Get org_id from users parent
-- ============================================================
ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS organization_id BIGINT;

UPDATE user_notification_preferences unp
SET organization_id = u.organization_id
FROM users u
WHERE unp.user_id = u.id
  AND unp.organization_id IS NULL;

-- For any orphaned records, use default org (1)
UPDATE user_notification_preferences SET organization_id = 1 WHERE organization_id IS NULL;

ALTER TABLE user_notification_preferences ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_notification_prefs_org_id ON user_notification_preferences(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_notification_prefs_org_user ON user_notification_preferences(organization_id, user_id);

-- ============================================================
-- 3. RESEARCH_ACTION_ITEMS - Get org_id from research_sessions parent
-- ============================================================
ALTER TABLE research_action_items ADD COLUMN IF NOT EXISTS organization_id BIGINT;

UPDATE research_action_items rai
SET organization_id = rs.organization_id
FROM research_sessions rs
WHERE rai.research_session_id = rs.id
  AND rai.organization_id IS NULL;

-- For any orphaned records, use default org (1)
UPDATE research_action_items SET organization_id = 1 WHERE organization_id IS NULL;

ALTER TABLE research_action_items ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_research_action_items_org_id ON research_action_items(organization_id);

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'V156 Migration completed: Added organization_id to 3 notification-related tables';
END $$;
