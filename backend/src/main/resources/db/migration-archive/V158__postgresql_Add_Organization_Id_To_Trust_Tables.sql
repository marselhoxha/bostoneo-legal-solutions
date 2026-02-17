-- V158__postgresql_Add_Organization_Id_To_Trust_Tables.sql
-- SECURITY: Add tenant isolation to Trust Account tables
-- This is critical for IOLTA compliance in a multi-tenant legal application

-- Add organization_id to trust_accounts
ALTER TABLE trust_accounts ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Add foreign key constraint
ALTER TABLE trust_accounts ADD CONSTRAINT fk_trust_accounts_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- Add index for efficient tenant filtering
CREATE INDEX IF NOT EXISTS idx_trust_accounts_organization_id ON trust_accounts(organization_id);

-- Add organization_id to trust_account_transactions
ALTER TABLE trust_account_transactions ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Add foreign key constraint
ALTER TABLE trust_account_transactions ADD CONSTRAINT fk_trust_account_transactions_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- Add index for efficient tenant filtering
CREATE INDEX IF NOT EXISTS idx_trust_account_transactions_organization_id ON trust_account_transactions(organization_id);

-- Backfill organization_id from client relationship where possible
-- Transactions have a client_id foreign key, so we can derive the organization
UPDATE trust_account_transactions tat
SET organization_id = c.organization_id
FROM clients c
WHERE tat.client_id = c.id AND tat.organization_id IS NULL;

-- For trust accounts, backfill from transactions if they have organization_id set
UPDATE trust_accounts ta
SET organization_id = (
    SELECT DISTINCT tat.organization_id
    FROM trust_account_transactions tat
    WHERE tat.trust_account_id = ta.id
    AND tat.organization_id IS NOT NULL
    LIMIT 1
)
WHERE ta.organization_id IS NULL;

-- Log warning for any orphaned records
DO $$
DECLARE
    orphaned_accounts INTEGER;
    orphaned_transactions INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphaned_accounts FROM trust_accounts WHERE organization_id IS NULL;
    SELECT COUNT(*) INTO orphaned_transactions FROM trust_account_transactions WHERE organization_id IS NULL;

    IF orphaned_accounts > 0 THEN
        RAISE NOTICE 'WARNING: % trust_accounts have NULL organization_id - manual review required', orphaned_accounts;
    END IF;

    IF orphaned_transactions > 0 THEN
        RAISE NOTICE 'WARNING: % trust_account_transactions have NULL organization_id - manual review required', orphaned_transactions;
    END IF;
END $$;
