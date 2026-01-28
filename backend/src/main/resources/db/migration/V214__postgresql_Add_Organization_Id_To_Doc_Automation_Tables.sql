-- Migration: V214__postgresql_Add_Organization_Id_To_Doc_Automation_Tables.sql
-- Purpose: Add organization_id column to document automation tables for tenant isolation
-- Date: 2026-01-28
-- SECURITY: Critical tenant isolation fix - prevents cross-tenant data access

-- =====================================================
-- 1. Add organization_id to doc_automation_categories
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'doc_automation_categories' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE doc_automation_categories ADD COLUMN organization_id BIGINT;

        -- Set default organization (table doesn't have created_by column)
        UPDATE doc_automation_categories
        SET organization_id = 1
        WHERE organization_id IS NULL;

        -- Make column NOT NULL after populating
        ALTER TABLE doc_automation_categories ALTER COLUMN organization_id SET NOT NULL;

        -- Add foreign key constraint
        ALTER TABLE doc_automation_categories
        ADD CONSTRAINT fk_doc_automation_categories_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id);

        -- Add index for tenant filtering
        CREATE INDEX idx_doc_automation_categories_org_id ON doc_automation_categories(organization_id);

        RAISE NOTICE 'Added organization_id to doc_automation_categories';
    ELSE
        RAISE NOTICE 'organization_id already exists in doc_automation_categories';
    END IF;
END $$;

-- =====================================================
-- 2. Add organization_id to doc_automation_templates
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'doc_automation_templates' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE doc_automation_templates ADD COLUMN organization_id BIGINT;

        -- Update existing records to use organization from created_by user
        UPDATE doc_automation_templates dat
        SET organization_id = (
            SELECT u.organization_id FROM users u WHERE u.id = dat.created_by
        )
        WHERE dat.organization_id IS NULL AND dat.created_by IS NOT NULL;

        -- Set default organization for records without created_by
        UPDATE doc_automation_templates
        SET organization_id = 1
        WHERE organization_id IS NULL;

        -- Make column NOT NULL after populating
        ALTER TABLE doc_automation_templates ALTER COLUMN organization_id SET NOT NULL;

        -- Add foreign key constraint
        ALTER TABLE doc_automation_templates
        ADD CONSTRAINT fk_doc_automation_templates_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id);

        -- Add index for tenant filtering
        CREATE INDEX idx_doc_automation_templates_org_id ON doc_automation_templates(organization_id);

        RAISE NOTICE 'Added organization_id to doc_automation_templates';
    ELSE
        RAISE NOTICE 'organization_id already exists in doc_automation_templates';
    END IF;
END $$;

-- =====================================================
-- 3. Add organization_id to doc_automation_fields
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'doc_automation_fields' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE doc_automation_fields ADD COLUMN organization_id BIGINT;

        -- Update existing records to use organization from parent template
        UPDATE doc_automation_fields daf
        SET organization_id = (
            SELECT dat.organization_id FROM doc_automation_templates dat WHERE dat.id = daf.template_id
        )
        WHERE daf.organization_id IS NULL AND daf.template_id IS NOT NULL;

        -- Set default organization for orphan records
        UPDATE doc_automation_fields
        SET organization_id = 1
        WHERE organization_id IS NULL;

        -- Make column NOT NULL after populating
        ALTER TABLE doc_automation_fields ALTER COLUMN organization_id SET NOT NULL;

        -- Add foreign key constraint
        ALTER TABLE doc_automation_fields
        ADD CONSTRAINT fk_doc_automation_fields_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id);

        -- Add index for tenant filtering
        CREATE INDEX idx_doc_automation_fields_org_id ON doc_automation_fields(organization_id);

        RAISE NOTICE 'Added organization_id to doc_automation_fields';
    ELSE
        RAISE NOTICE 'organization_id already exists in doc_automation_fields';
    END IF;
END $$;

-- =====================================================
-- 4. Add organization_id to doc_automation_permissions
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'doc_automation_permissions' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE doc_automation_permissions ADD COLUMN organization_id BIGINT;

        -- Update existing records to use organization from user
        UPDATE doc_automation_permissions dap
        SET organization_id = (
            SELECT u.organization_id FROM users u WHERE u.id = dap.user_id
        )
        WHERE dap.organization_id IS NULL AND dap.user_id IS NOT NULL;

        -- Set default organization for records without user_id
        UPDATE doc_automation_permissions
        SET organization_id = 1
        WHERE organization_id IS NULL;

        -- Make column NOT NULL after populating
        ALTER TABLE doc_automation_permissions ALTER COLUMN organization_id SET NOT NULL;

        -- Add foreign key constraint
        ALTER TABLE doc_automation_permissions
        ADD CONSTRAINT fk_doc_automation_permissions_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id);

        -- Add index for tenant filtering
        CREATE INDEX idx_doc_automation_permissions_org_id ON doc_automation_permissions(organization_id);

        RAISE NOTICE 'Added organization_id to doc_automation_permissions';
    ELSE
        RAISE NOTICE 'organization_id already exists in doc_automation_permissions';
    END IF;
END $$;

-- =====================================================
-- 5. Add organization_id to doc_generation_log
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'doc_generation_log' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE doc_generation_log ADD COLUMN organization_id BIGINT;

        -- Update existing records to use organization from user
        UPDATE doc_generation_log dgl
        SET organization_id = (
            SELECT u.organization_id FROM users u WHERE u.id = dgl.generated_by
        )
        WHERE dgl.organization_id IS NULL AND dgl.generated_by IS NOT NULL;

        -- Set default organization for records without generated_by
        UPDATE doc_generation_log
        SET organization_id = 1
        WHERE organization_id IS NULL;

        -- Make column NOT NULL after populating
        ALTER TABLE doc_generation_log ALTER COLUMN organization_id SET NOT NULL;

        -- Add foreign key constraint
        ALTER TABLE doc_generation_log
        ADD CONSTRAINT fk_doc_generation_log_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id);

        -- Add index for tenant filtering
        CREATE INDEX idx_doc_generation_log_org_id ON doc_generation_log(organization_id);

        RAISE NOTICE 'Added organization_id to doc_generation_log';
    ELSE
        RAISE NOTICE 'organization_id already exists in doc_generation_log';
    END IF;
END $$;

-- =====================================================
-- Summary log
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE 'V214 Migration Complete: Added organization_id to doc_automation tables for tenant isolation';
END $$;
