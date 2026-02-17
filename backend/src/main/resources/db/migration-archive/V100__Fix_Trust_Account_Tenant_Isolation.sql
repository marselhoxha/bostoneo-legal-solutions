-- =====================================================
-- V100: Fix Trust Account Tenant Isolation
-- SECURITY: Add organization_id to trust account tables
-- and fix the client_trust_balances view
-- =====================================================

-- Add organization_id to trust_accounts table
ALTER TABLE trust_accounts
ADD COLUMN organization_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id;

-- Add foreign key constraint
ALTER TABLE trust_accounts
ADD CONSTRAINT fk_trust_accounts_organization
FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- Add index for organization lookups
CREATE INDEX idx_trust_accounts_org ON trust_accounts(organization_id);

-- Add organization_id to trust_account_transactions table
ALTER TABLE trust_account_transactions
ADD COLUMN organization_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id;

-- Add foreign key constraint
ALTER TABLE trust_account_transactions
ADD CONSTRAINT fk_trust_account_transactions_organization
FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- Add index for organization lookups
CREATE INDEX idx_trust_account_transactions_org ON trust_account_transactions(organization_id);

-- Drop the insecure view
DROP VIEW IF EXISTS client_trust_balances;

-- Recreate view with organization filtering
-- SECURITY: Joins are now scoped by organization_id to prevent cross-tenant data leakage
CREATE VIEW client_trust_balances AS
SELECT
    c.id as client_id,
    c.name as client_name,
    c.organization_id,
    ta.id as trust_account_id,
    ta.account_name,
    COALESCE(SUM(CASE
        WHEN tat.transaction_type IN ('DEPOSIT', 'INTEREST') THEN tat.amount
        WHEN tat.transaction_type IN ('WITHDRAWAL', 'FEE', 'TRANSFER') THEN -tat.amount
        ELSE 0
    END), 0) as balance
FROM clients c
INNER JOIN trust_accounts ta ON c.organization_id = ta.organization_id
LEFT JOIN trust_account_transactions tat
    ON c.id = tat.client_id
    AND ta.id = tat.trust_account_id
    AND tat.organization_id = c.organization_id
WHERE ta.is_active = TRUE
GROUP BY c.id, c.name, c.organization_id, ta.id, ta.account_name;

-- Remove the default value constraint after setting initial values
-- (Leave commented - run manually after verifying data is correct)
-- ALTER TABLE trust_accounts ALTER COLUMN organization_id DROP DEFAULT;
-- ALTER TABLE trust_account_transactions ALTER COLUMN organization_id DROP DEFAULT;
