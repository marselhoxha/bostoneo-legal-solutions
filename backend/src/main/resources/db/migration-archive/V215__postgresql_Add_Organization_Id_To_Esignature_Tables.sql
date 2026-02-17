-- Migration: V215__postgresql_Add_Organization_Id_To_Esignature_Tables.sql
-- Purpose: Add organization_id column to e-signature tables for tenant isolation
-- Date: 2026-01-28
-- SECURITY: Critical tenant isolation fix - prevents cross-tenant data access

-- =====================================================
-- 1. Add organization_id to esignature_requests
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'esignature_requests' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE esignature_requests ADD COLUMN organization_id BIGINT;

        -- Update existing records to use organization from created_by user
        UPDATE esignature_requests er
        SET organization_id = (
            SELECT u.organization_id FROM users u WHERE u.id = er.created_by
        )
        WHERE er.organization_id IS NULL AND er.created_by IS NOT NULL;

        -- Set default organization for records without created_by
        UPDATE esignature_requests
        SET organization_id = 1
        WHERE organization_id IS NULL;

        -- Make column NOT NULL after populating
        ALTER TABLE esignature_requests ALTER COLUMN organization_id SET NOT NULL;

        -- Add foreign key constraint
        ALTER TABLE esignature_requests
        ADD CONSTRAINT fk_esignature_requests_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id);

        -- Add index for tenant filtering
        CREATE INDEX idx_esignature_requests_org_id ON esignature_requests(organization_id);

        RAISE NOTICE 'Added organization_id to esignature_requests';
    ELSE
        RAISE NOTICE 'organization_id already exists in esignature_requests';
    END IF;
END $$;

-- =====================================================
-- 2. Add organization_id to esignature_recipients
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'esignature_recipients' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE esignature_recipients ADD COLUMN organization_id BIGINT;

        -- Update existing records to use organization from parent request
        UPDATE esignature_recipients er
        SET organization_id = (
            SELECT esreq.organization_id FROM esignature_requests esreq WHERE esreq.id = er.esignature_request_id
        )
        WHERE er.organization_id IS NULL AND er.esignature_request_id IS NOT NULL;

        -- Set default organization for orphan records
        UPDATE esignature_recipients
        SET organization_id = 1
        WHERE organization_id IS NULL;

        -- Make column NOT NULL after populating
        ALTER TABLE esignature_recipients ALTER COLUMN organization_id SET NOT NULL;

        -- Add foreign key constraint
        ALTER TABLE esignature_recipients
        ADD CONSTRAINT fk_esignature_recipients_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id);

        -- Add index for tenant filtering
        CREATE INDEX idx_esignature_recipients_org_id ON esignature_recipients(organization_id);

        RAISE NOTICE 'Added organization_id to esignature_recipients';
    ELSE
        RAISE NOTICE 'organization_id already exists in esignature_recipients';
    END IF;
END $$;

-- =====================================================
-- 3. Add organization_id to esignature_audit_trail
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'esignature_audit_trail' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE esignature_audit_trail ADD COLUMN organization_id BIGINT;

        -- Update existing records to use organization from parent request
        UPDATE esignature_audit_trail eat
        SET organization_id = (
            SELECT esreq.organization_id FROM esignature_requests esreq WHERE esreq.id = eat.esignature_request_id
        )
        WHERE eat.organization_id IS NULL AND eat.esignature_request_id IS NOT NULL;

        -- Set default organization for orphan records
        UPDATE esignature_audit_trail
        SET organization_id = 1
        WHERE organization_id IS NULL;

        -- Make column NOT NULL after populating
        ALTER TABLE esignature_audit_trail ALTER COLUMN organization_id SET NOT NULL;

        -- Add foreign key constraint
        ALTER TABLE esignature_audit_trail
        ADD CONSTRAINT fk_esignature_audit_trail_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id);

        -- Add index for tenant filtering
        CREATE INDEX idx_esignature_audit_trail_org_id ON esignature_audit_trail(organization_id);

        RAISE NOTICE 'Added organization_id to esignature_audit_trail';
    ELSE
        RAISE NOTICE 'organization_id already exists in esignature_audit_trail';
    END IF;
END $$;

-- =====================================================
-- Summary log
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE 'V215 Migration Complete: Added organization_id to esignature tables for tenant isolation';
END $$;
