-- Add organization_id column to invoice_workflow_rules table for multi-tenant support
ALTER TABLE invoice_workflow_rules ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Create index for tenant-filtered queries
CREATE INDEX IF NOT EXISTS idx_invoice_workflow_rules_org_id ON invoice_workflow_rules(organization_id);
