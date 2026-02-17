-- V159: Add organization_id to child entities for complete tenant isolation
-- This migration adds organization_id to entities that previously relied on parent relationships for tenant context
-- Uses DO blocks to safely skip tables that don't exist yet (they will get the column when created by Hibernate)

-- 1. ai_conversation_messages
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ai_conversation_messages') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ai_conversation_messages' AND column_name = 'organization_id') THEN
            ALTER TABLE ai_conversation_messages ADD COLUMN organization_id BIGINT;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_ai_conversation_messages_org_id') THEN
            CREATE INDEX idx_ai_conversation_messages_org_id ON ai_conversation_messages(organization_id);
        END IF;
        -- Update existing records from parent session
        UPDATE ai_conversation_messages acm
        SET organization_id = acs.organization_id
        FROM ai_conversation_sessions acs
        WHERE acm.session_id = acs.id AND acm.organization_id IS NULL;
    END IF;
END $$;

-- 2. ai_workspace_document_citations
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ai_workspace_document_citations') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ai_workspace_document_citations' AND column_name = 'organization_id') THEN
            ALTER TABLE ai_workspace_document_citations ADD COLUMN organization_id BIGINT;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_ai_workspace_doc_citations_org_id') THEN
            CREATE INDEX idx_ai_workspace_doc_citations_org_id ON ai_workspace_document_citations(organization_id);
        END IF;
        -- Update existing records from parent document
        UPDATE ai_workspace_document_citations awdc
        SET organization_id = awd.organization_id
        FROM ai_workspace_documents awd
        WHERE awdc.document_id = awd.id AND awdc.organization_id IS NULL;
    END IF;
END $$;

-- 3. ai_workspace_document_versions
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ai_workspace_document_versions') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ai_workspace_document_versions' AND column_name = 'organization_id') THEN
            ALTER TABLE ai_workspace_document_versions ADD COLUMN organization_id BIGINT;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_ai_workspace_doc_versions_org_id') THEN
            CREATE INDEX idx_ai_workspace_doc_versions_org_id ON ai_workspace_document_versions(organization_id);
        END IF;
        -- Update existing records from parent document
        UPDATE ai_workspace_document_versions awdv
        SET organization_id = awd.organization_id
        FROM ai_workspace_documents awd
        WHERE awdv.document_id = awd.id AND awdv.organization_id IS NULL;
    END IF;
END $$;

-- 4. attorney_expertise
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'attorney_expertise') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'attorney_expertise' AND column_name = 'organization_id') THEN
            ALTER TABLE attorney_expertise ADD COLUMN organization_id BIGINT;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_attorney_expertise_org_id') THEN
            CREATE INDEX idx_attorney_expertise_org_id ON attorney_expertise(organization_id);
        END IF;
        -- Update existing records from parent user
        UPDATE attorney_expertise ae
        SET organization_id = u.organization_id
        FROM users u
        WHERE ae.user_id = u.id AND ae.organization_id IS NULL;
    END IF;
END $$;

-- 5. billing_cycles
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'billing_cycles') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'billing_cycles' AND column_name = 'organization_id') THEN
            ALTER TABLE billing_cycles ADD COLUMN organization_id BIGINT;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_billing_cycles_org_id') THEN
            CREATE INDEX idx_billing_cycles_org_id ON billing_cycles(organization_id);
        END IF;
        -- Update existing records from related legal case
        UPDATE billing_cycles bc
        SET organization_id = lc.organization_id
        FROM legal_cases lc
        WHERE bc.legal_case_id = lc.id AND bc.organization_id IS NULL;
    END IF;
END $$;

-- 6. case_workflow_step_executions
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'case_workflow_step_executions') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'case_workflow_step_executions' AND column_name = 'organization_id') THEN
            ALTER TABLE case_workflow_step_executions ADD COLUMN organization_id BIGINT;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_case_workflow_step_exec_org_id') THEN
            CREATE INDEX idx_case_workflow_step_exec_org_id ON case_workflow_step_executions(organization_id);
        END IF;
        -- Update existing records from parent workflow execution
        UPDATE case_workflow_step_executions cwse
        SET organization_id = cwe.organization_id
        FROM case_workflow_executions cwe
        WHERE cwse.workflow_execution_id = cwe.id AND cwse.organization_id IS NULL;
    END IF;
END $$;

-- 7. invoice_items
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invoice_items') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'invoice_items' AND column_name = 'organization_id') THEN
            ALTER TABLE invoice_items ADD COLUMN organization_id BIGINT;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_invoice_items_org_id') THEN
            CREATE INDEX idx_invoice_items_org_id ON invoice_items(organization_id);
        END IF;
    END IF;
END $$;

-- 8. invoice_line_items
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invoice_line_items') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'invoice_line_items' AND column_name = 'organization_id') THEN
            ALTER TABLE invoice_line_items ADD COLUMN organization_id BIGINT;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_invoice_line_items_org_id') THEN
            CREATE INDEX idx_invoice_line_items_org_id ON invoice_line_items(organization_id);
        END IF;
        -- Update existing records from parent invoice
        UPDATE invoice_line_items ili
        SET organization_id = i.organization_id
        FROM invoices i
        WHERE ili.invoice_id = i.id AND ili.organization_id IS NULL;
    END IF;
END $$;

-- 9. invoice_reminders
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invoice_reminders') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'invoice_reminders' AND column_name = 'organization_id') THEN
            ALTER TABLE invoice_reminders ADD COLUMN organization_id BIGINT;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_invoice_reminders_org_id') THEN
            CREATE INDEX idx_invoice_reminders_org_id ON invoice_reminders(organization_id);
        END IF;
        -- Update existing records from parent invoice
        UPDATE invoice_reminders ir
        SET organization_id = i.organization_id
        FROM invoices i
        WHERE ir.invoice_id = i.id AND ir.organization_id IS NULL;
    END IF;
END $$;

-- 10. invoice_template_items
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invoice_template_items') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'invoice_template_items' AND column_name = 'organization_id') THEN
            ALTER TABLE invoice_template_items ADD COLUMN organization_id BIGINT;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_invoice_template_items_org_id') THEN
            CREATE INDEX idx_invoice_template_items_org_id ON invoice_template_items(organization_id);
        END IF;
        -- Update existing records from parent template
        UPDATE invoice_template_items iti
        SET organization_id = it.organization_id
        FROM invoice_templates it
        WHERE iti.template_id = it.id AND iti.organization_id IS NULL;
    END IF;
END $$;

-- 11. time_entry_audit_log
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'time_entry_audit_log') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'time_entry_audit_log' AND column_name = 'organization_id') THEN
            ALTER TABLE time_entry_audit_log ADD COLUMN organization_id BIGINT;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_time_entry_audit_log_org_id') THEN
            CREATE INDEX idx_time_entry_audit_log_org_id ON time_entry_audit_log(organization_id);
        END IF;
        -- Update existing records from related time entry
        UPDATE time_entry_audit_log teal
        SET organization_id = te.organization_id
        FROM time_entries te
        WHERE teal.time_entry_id = te.id AND teal.organization_id IS NULL;
    END IF;
END $$;

-- 12. case_timeline_templates
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'case_timeline_templates') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'case_timeline_templates' AND column_name = 'organization_id') THEN
            ALTER TABLE case_timeline_templates ADD COLUMN organization_id BIGINT;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_case_timeline_templates_org_id') THEN
            CREATE INDEX idx_case_timeline_templates_org_id ON case_timeline_templates(organization_id);
        END IF;
        -- Note: case_timeline_templates can be global (null org_id) or organization-specific
        -- Existing records remain global (shared templates)
    END IF;
END $$;
