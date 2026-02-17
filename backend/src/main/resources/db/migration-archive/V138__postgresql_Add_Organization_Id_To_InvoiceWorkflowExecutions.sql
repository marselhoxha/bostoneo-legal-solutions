-- PostgreSQL Migration: Add organization_id to invoice_workflow_executions table
-- This enables multi-tenant data isolation for workflow execution history

-- Add organization_id column to invoice_workflow_executions
ALTER TABLE invoice_workflow_executions ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Create index for tenant filtering
CREATE INDEX IF NOT EXISTS idx_invoice_workflow_executions_organization_id ON invoice_workflow_executions(organization_id);

-- Populate organization_id from parent invoice
UPDATE invoice_workflow_executions iwe
SET organization_id = i.organization_id
FROM invoices i
WHERE iwe.invoice_id = i.id
AND iwe.organization_id IS NULL;
