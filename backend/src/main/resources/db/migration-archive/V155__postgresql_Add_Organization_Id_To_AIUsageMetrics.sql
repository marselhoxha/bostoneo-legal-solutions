-- Migration V155: Add organization_id to ai_usage_metrics for multi-tenant isolation

-- Add organization_id column
ALTER TABLE ai_usage_metrics ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Populate from users table
UPDATE ai_usage_metrics aum
SET organization_id = u.organization_id
FROM users u
WHERE aum.user_id = u.id
  AND aum.organization_id IS NULL;

-- For any orphaned records, use default org (1)
UPDATE ai_usage_metrics SET organization_id = 1 WHERE organization_id IS NULL;

-- Add NOT NULL constraint
ALTER TABLE ai_usage_metrics ALTER COLUMN organization_id SET NOT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_ai_usage_metrics_org_id ON ai_usage_metrics(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_metrics_org_user ON ai_usage_metrics(organization_id, user_id);

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'V155 Migration completed: Added organization_id to ai_usage_metrics';
END $$;
