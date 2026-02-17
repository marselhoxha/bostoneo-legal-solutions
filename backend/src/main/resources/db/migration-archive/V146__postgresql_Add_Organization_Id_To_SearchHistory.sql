-- Add organization_id to search_history table for multi-tenant support
ALTER TABLE search_history ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Add foreign key constraint
ALTER TABLE search_history
    ADD CONSTRAINT fk_search_history_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- Create index for faster tenant-filtered queries
CREATE INDEX IF NOT EXISTS idx_search_history_organization_id ON search_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_search_history_org_user ON search_history(organization_id, user_id);

-- Update existing records to use organization from user
UPDATE search_history sh
SET organization_id = u.organization_id
FROM users u
WHERE sh.user_id = u.id AND sh.organization_id IS NULL;
