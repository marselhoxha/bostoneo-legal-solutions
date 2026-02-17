-- Add status and quota fields to organizations table
-- Database: legience (PostgreSQL)

-- Add status column
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';

-- Add quota columns
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 5;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_cases INTEGER DEFAULT 100;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_storage_bytes BIGINT DEFAULT 5368709120;

-- Update existing organizations to have default values
UPDATE organizations SET status = 'ACTIVE' WHERE status IS NULL;
UPDATE organizations SET max_users = 5 WHERE max_users IS NULL;
UPDATE organizations SET max_cases = 100 WHERE max_cases IS NULL;
UPDATE organizations SET max_storage_bytes = 5368709120 WHERE max_storage_bytes IS NULL;

-- Add index on status for filtering
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);
