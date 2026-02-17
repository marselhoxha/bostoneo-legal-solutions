-- Migration: Add organization_id to user_workload and invoice_payments tables for multi-tenant security
-- This enables proper tenant isolation for workload analytics and payment data

-- ==================== USER_WORKLOAD TABLE ====================

-- Add organization_id column to user_workload
ALTER TABLE user_workload ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Populate organization_id from the user's organization
UPDATE user_workload uw
SET organization_id = u.organization_id
FROM users u
WHERE uw.user_id = u.id
  AND uw.organization_id IS NULL;

-- Add foreign key constraint
ALTER TABLE user_workload
    DROP CONSTRAINT IF EXISTS fk_user_workload_organization;
ALTER TABLE user_workload
    ADD CONSTRAINT fk_user_workload_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- Add index for tenant-filtered queries
CREATE INDEX IF NOT EXISTS idx_user_workload_organization_id ON user_workload(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_workload_org_date ON user_workload(organization_id, calculation_date);
CREATE INDEX IF NOT EXISTS idx_user_workload_org_user_date ON user_workload(organization_id, user_id, calculation_date);

-- ==================== INVOICE_PAYMENTS TABLE ====================

-- Add organization_id column to invoice_payments
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Populate organization_id from the invoice's organization
UPDATE invoice_payments ip
SET organization_id = i.organization_id
FROM invoices i
WHERE ip.invoice_id = i.id
  AND ip.organization_id IS NULL;

-- Add foreign key constraint
ALTER TABLE invoice_payments
    DROP CONSTRAINT IF EXISTS fk_invoice_payments_organization;
ALTER TABLE invoice_payments
    ADD CONSTRAINT fk_invoice_payments_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- Add indexes for tenant-filtered queries
CREATE INDEX IF NOT EXISTS idx_invoice_payments_organization_id ON invoice_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_org_invoice ON invoice_payments(organization_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_org_date ON invoice_payments(organization_id, payment_date);
