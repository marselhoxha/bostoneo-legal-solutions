-- Add organization_id and is_system to pipeline_stages table for multi-tenant support
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;

-- Add foreign key constraint
ALTER TABLE pipeline_stages
    ADD CONSTRAINT fk_pipeline_stages_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- Create index for faster tenant-filtered queries
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_organization_id ON pipeline_stages(organization_id);

-- Mark existing stages as system stages (shared across all organizations)
UPDATE pipeline_stages SET is_system = TRUE WHERE organization_id IS NULL;
