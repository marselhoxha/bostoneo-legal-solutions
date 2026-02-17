-- ========================================================================
-- V217: Create Tenant Security Audit System
-- Purpose: Database-level audit logging for tenant isolation monitoring
-- ========================================================================

-- Create security audit log table
CREATE TABLE IF NOT EXISTS tenant_security_audit_log (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id BIGINT,
    attempted_org_id BIGINT,
    actual_org_id BIGINT,
    user_id BIGINT,
    session_id VARCHAR(255),
    ip_address VARCHAR(45),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX idx_tenant_security_audit_event_type ON tenant_security_audit_log(event_type);
CREATE INDEX idx_tenant_security_audit_created_at ON tenant_security_audit_log(created_at);
CREATE INDEX idx_tenant_security_audit_attempted_org ON tenant_security_audit_log(attempted_org_id);

-- Comment for documentation
COMMENT ON TABLE tenant_security_audit_log IS 'Logs potential cross-tenant access attempts and security events';

-- ========================================================================
-- Function to log security events
-- ========================================================================
CREATE OR REPLACE FUNCTION log_tenant_security_event(
    p_event_type VARCHAR(50),
    p_table_name VARCHAR(100),
    p_record_id BIGINT,
    p_attempted_org_id BIGINT,
    p_actual_org_id BIGINT,
    p_user_id BIGINT DEFAULT NULL,
    p_details TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO tenant_security_audit_log (
        event_type,
        table_name,
        record_id,
        attempted_org_id,
        actual_org_id,
        user_id,
        details
    ) VALUES (
        p_event_type,
        p_table_name,
        p_record_id,
        p_attempted_org_id,
        p_actual_org_id,
        p_user_id,
        p_details
    );
END;
$$ LANGUAGE plpgsql;

-- ========================================================================
-- Add CHECK constraints to critical tables (prevents NULL organization_id)
-- These are defensive measures - the application should already prevent this
-- ========================================================================

-- clients table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_clients_org_id_not_null' AND conrelid = 'clients'::regclass
    ) THEN
        ALTER TABLE clients ADD CONSTRAINT chk_clients_org_id_not_null
        CHECK (organization_id IS NOT NULL);
    END IF;
EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table clients does not exist, skipping constraint';
END $$;

-- legal_cases table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_legal_cases_org_id_not_null' AND conrelid = 'legal_cases'::regclass
    ) THEN
        ALTER TABLE legal_cases ADD CONSTRAINT chk_legal_cases_org_id_not_null
        CHECK (organization_id IS NOT NULL);
    END IF;
EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table legal_cases does not exist, skipping constraint';
END $$;

-- invoices table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_invoices_org_id_not_null' AND conrelid = 'invoices'::regclass
    ) THEN
        ALTER TABLE invoices ADD CONSTRAINT chk_invoices_org_id_not_null
        CHECK (organization_id IS NOT NULL);
    END IF;
EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table invoices does not exist, skipping constraint';
END $$;

-- expenses table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_expenses_org_id_not_null' AND conrelid = 'expenses'::regclass
    ) THEN
        ALTER TABLE expenses ADD CONSTRAINT chk_expenses_org_id_not_null
        CHECK (organization_id IS NOT NULL);
    END IF;
EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table expenses does not exist, skipping constraint';
END $$;

-- files table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_files_org_id_not_null' AND conrelid = 'files'::regclass
    ) THEN
        ALTER TABLE files ADD CONSTRAINT chk_files_org_id_not_null
        CHECK (organization_id IS NOT NULL);
    END IF;
EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table files does not exist, skipping constraint';
END $$;

-- legal_documents table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_legal_documents_org_id_not_null' AND conrelid = 'legal_documents'::regclass
    ) THEN
        ALTER TABLE legal_documents ADD CONSTRAINT chk_legal_documents_org_id_not_null
        CHECK (organization_id IS NOT NULL);
    END IF;
EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table legal_documents does not exist, skipping constraint';
END $$;

-- time_entries table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_time_entries_org_id_not_null' AND conrelid = 'time_entries'::regclass
    ) THEN
        ALTER TABLE time_entries ADD CONSTRAINT chk_time_entries_org_id_not_null
        CHECK (organization_id IS NOT NULL);
    END IF;
EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table time_entries does not exist, skipping constraint';
END $$;

-- leads table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_leads_org_id_not_null' AND conrelid = 'leads'::regclass
    ) THEN
        ALTER TABLE leads ADD CONSTRAINT chk_leads_org_id_not_null
        CHECK (organization_id IS NOT NULL);
    END IF;
EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table leads does not exist, skipping constraint';
END $$;

-- trust_accounts table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_trust_accounts_org_id_not_null' AND conrelid = 'trust_accounts'::regclass
    ) THEN
        ALTER TABLE trust_accounts ADD CONSTRAINT chk_trust_accounts_org_id_not_null
        CHECK (organization_id IS NOT NULL);
    END IF;
EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table trust_accounts does not exist, skipping constraint';
END $$;

-- ========================================================================
-- Create view for security monitoring dashboard
-- ========================================================================
CREATE OR REPLACE VIEW v_tenant_security_summary AS
SELECT
    event_type,
    table_name,
    COUNT(*) as event_count,
    COUNT(DISTINCT attempted_org_id) as unique_orgs_attempted,
    MIN(created_at) as first_occurrence,
    MAX(created_at) as last_occurrence
FROM tenant_security_audit_log
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY event_type, table_name
ORDER BY event_count DESC;

COMMENT ON VIEW v_tenant_security_summary IS 'Summary of tenant security events for monitoring dashboard';

-- ========================================================================
-- Grant permissions
-- ========================================================================
-- Note: Adjust role names as needed for your environment

-- Insert log entry for migration completion
INSERT INTO tenant_security_audit_log (
    event_type,
    table_name,
    details
) VALUES (
    'SYSTEM',
    'tenant_security_audit_log',
    'Tenant security audit system initialized via V217 migration'
);

SELECT 'V217: Tenant Security Audit System created successfully' AS migration_status;
