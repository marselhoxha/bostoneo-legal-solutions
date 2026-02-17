-- =============================================================================
-- Legience PostgreSQL Migration V2 - Tenant Schema Template
-- =============================================================================
-- Function to create a complete tenant schema with all required tables
-- Called when a new organization is created
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_tenant_schema(
    p_tenant_slug VARCHAR,
    p_tenant_name VARCHAR,
    p_admin_email VARCHAR,
    p_admin_password_hash VARCHAR
) RETURNS BIGINT AS $$
DECLARE
    v_schema_name VARCHAR;
    v_tenant_id BIGINT;
BEGIN
    v_schema_name := 'org_' || p_tenant_slug;

    -- Insert tenant record
    INSERT INTO public.tenants (name, slug, schema_name, is_active)
    VALUES (p_tenant_name, p_tenant_slug, v_schema_name, true)
    RETURNING id INTO v_tenant_id;

    -- Create the schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', v_schema_name);

    -- ==========================================================================
    -- CORE TABLES
    -- ==========================================================================

    -- USERS
    EXECUTE format('
        CREATE TABLE %I.users (
            id BIGSERIAL PRIMARY KEY,
            tenant_id BIGINT NOT NULL DEFAULT %L,
            email VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255),
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            phone VARCHAR(30),
            title VARCHAR(100),
            image_url VARCHAR(500),
            is_enabled BOOLEAN DEFAULT false,
            is_not_locked BOOLEAN DEFAULT true,
            is_using_mfa BOOLEAN DEFAULT false,
            mfa_secret VARCHAR(255),
            bio TEXT,
            address TEXT,
            role_id BIGINT REFERENCES public.roles(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_tenant_id);

    -- CLIENTS
    EXECUTE format('
        CREATE TABLE %I.clients (
            id BIGSERIAL PRIMARY KEY,
            tenant_id BIGINT NOT NULL DEFAULT %L,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            phone VARCHAR(30),
            address TEXT,
            type VARCHAR(50) DEFAULT ''INDIVIDUAL'',
            status VARCHAR(30) DEFAULT ''ACTIVE'',
            company_name VARCHAR(255),
            tax_id VARCHAR(50),
            date_of_birth DATE,
            ssn_last_four VARCHAR(4),
            notes TEXT,
            created_by BIGINT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_tenant_id);

    -- LEGAL_CASES
    EXECUTE format('
        CREATE TABLE %I.legal_cases (
            id BIGSERIAL PRIMARY KEY,
            tenant_id BIGINT NOT NULL DEFAULT %L,
            case_number VARCHAR(100) NOT NULL,
            title VARCHAR(500) NOT NULL,
            description TEXT,
            case_type VARCHAR(100),
            practice_area VARCHAR(100),
            status VARCHAR(50) DEFAULT ''OPEN'',
            priority VARCHAR(20) DEFAULT ''MEDIUM'',
            client_id BIGINT REFERENCES %I.clients(id),
            assigned_attorney_id BIGINT REFERENCES %I.users(id),
            court VARCHAR(255),
            judge VARCHAR(255),
            opposing_counsel VARCHAR(255),
            opposing_party VARCHAR(255),
            filing_date DATE,
            statute_of_limitations DATE,
            close_date DATE,
            billing_type VARCHAR(50) DEFAULT ''HOURLY'',
            flat_fee_amount DECIMAL(12,2),
            retainer_amount DECIMAL(12,2),
            contingency_percentage DECIMAL(5,2),
            created_by BIGINT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_tenant_id, v_schema_name, v_schema_name);

    -- ==========================================================================
    -- TIME & BILLING TABLES
    -- ==========================================================================

    -- TIME_ENTRIES
    EXECUTE format('
        CREATE TABLE %I.time_entries (
            id BIGSERIAL PRIMARY KEY,
            tenant_id BIGINT NOT NULL DEFAULT %L,
            user_id BIGINT NOT NULL REFERENCES %I.users(id),
            case_id BIGINT REFERENCES %I.legal_cases(id),
            client_id BIGINT REFERENCES %I.clients(id),
            description TEXT NOT NULL,
            duration_minutes INT NOT NULL,
            hourly_rate DECIMAL(10,2),
            is_billable BOOLEAN DEFAULT true,
            is_billed BOOLEAN DEFAULT false,
            entry_date DATE NOT NULL,
            activity_type VARCHAR(100),
            invoice_id BIGINT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_tenant_id, v_schema_name, v_schema_name, v_schema_name);

    -- INVOICES
    EXECUTE format('
        CREATE TABLE %I.invoices (
            id BIGSERIAL PRIMARY KEY,
            tenant_id BIGINT NOT NULL DEFAULT %L,
            invoice_number VARCHAR(50) NOT NULL UNIQUE,
            client_id BIGINT NOT NULL REFERENCES %I.clients(id),
            case_id BIGINT REFERENCES %I.legal_cases(id),
            amount DECIMAL(12,2) NOT NULL,
            tax DECIMAL(12,2) DEFAULT 0,
            total DECIMAL(12,2) NOT NULL,
            status VARCHAR(30) DEFAULT ''DRAFT'',
            issue_date DATE,
            due_date DATE,
            paid_date DATE,
            paid_amount DECIMAL(12,2) DEFAULT 0,
            notes TEXT,
            terms TEXT,
            created_by BIGINT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_tenant_id, v_schema_name, v_schema_name);

    -- EXPENSES
    EXECUTE format('
        CREATE TABLE %I.expenses (
            id BIGSERIAL PRIMARY KEY,
            tenant_id BIGINT NOT NULL DEFAULT %L,
            case_id BIGINT REFERENCES %I.legal_cases(id),
            client_id BIGINT REFERENCES %I.clients(id),
            user_id BIGINT REFERENCES %I.users(id),
            description TEXT NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            expense_date DATE NOT NULL,
            category VARCHAR(100),
            is_billable BOOLEAN DEFAULT true,
            is_billed BOOLEAN DEFAULT false,
            invoice_id BIGINT,
            receipt_url VARCHAR(500),
            vendor VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_tenant_id, v_schema_name, v_schema_name, v_schema_name);

    -- PAYMENTS
    EXECUTE format('
        CREATE TABLE %I.payments (
            id BIGSERIAL PRIMARY KEY,
            tenant_id BIGINT NOT NULL DEFAULT %L,
            invoice_id BIGINT REFERENCES %I.invoices(id),
            client_id BIGINT REFERENCES %I.clients(id),
            amount DECIMAL(12,2) NOT NULL,
            payment_method VARCHAR(50),
            payment_date DATE NOT NULL,
            reference_number VARCHAR(100),
            notes TEXT,
            status VARCHAR(30) DEFAULT ''COMPLETED'',
            stripe_payment_id VARCHAR(255),
            created_by BIGINT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_tenant_id, v_schema_name, v_schema_name);

    -- TRUST_ACCOUNTS
    EXECUTE format('
        CREATE TABLE %I.trust_accounts (
            id BIGSERIAL PRIMARY KEY,
            tenant_id BIGINT NOT NULL DEFAULT %L,
            account_name VARCHAR(255) NOT NULL,
            account_number VARCHAR(50),
            bank_name VARCHAR(255),
            routing_number VARCHAR(20),
            current_balance DECIMAL(15,2) DEFAULT 0,
            is_iolta BOOLEAN DEFAULT true,
            is_active BOOLEAN DEFAULT true,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_tenant_id);

    -- TRUST_ACCOUNT_TRANSACTIONS
    EXECUTE format('
        CREATE TABLE %I.trust_account_transactions (
            id BIGSERIAL PRIMARY KEY,
            tenant_id BIGINT NOT NULL DEFAULT %L,
            trust_account_id BIGINT NOT NULL REFERENCES %I.trust_accounts(id),
            client_id BIGINT REFERENCES %I.clients(id),
            case_id BIGINT REFERENCES %I.legal_cases(id),
            transaction_type VARCHAR(50) NOT NULL,
            amount DECIMAL(12,2) NOT NULL,
            balance_after DECIMAL(15,2) NOT NULL,
            description TEXT,
            reference_number VARCHAR(100),
            transaction_date DATE NOT NULL,
            created_by BIGINT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_tenant_id, v_schema_name, v_schema_name, v_schema_name);

    -- ==========================================================================
    -- DOCUMENT TABLES
    -- ==========================================================================

    -- DOCUMENTS
    EXECUTE format('
        CREATE TABLE %I.documents (
            id BIGSERIAL PRIMARY KEY,
            tenant_id BIGINT NOT NULL DEFAULT %L,
            name VARCHAR(500) NOT NULL,
            file_path VARCHAR(1000) NOT NULL,
            file_type VARCHAR(100),
            file_size BIGINT,
            case_id BIGINT REFERENCES %I.legal_cases(id),
            client_id BIGINT REFERENCES %I.clients(id),
            uploaded_by BIGINT REFERENCES %I.users(id),
            description TEXT,
            category VARCHAR(100),
            is_confidential BOOLEAN DEFAULT false,
            version INT DEFAULT 1,
            parent_document_id BIGINT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_tenant_id, v_schema_name, v_schema_name, v_schema_name);

    -- ==========================================================================
    -- CASE MANAGEMENT TABLES
    -- ==========================================================================

    -- CASE_NOTES
    EXECUTE format('
        CREATE TABLE %I.case_notes (
            id BIGSERIAL PRIMARY KEY,
            tenant_id BIGINT NOT NULL DEFAULT %L,
            case_id BIGINT NOT NULL REFERENCES %I.legal_cases(id),
            user_id BIGINT REFERENCES %I.users(id),
            title VARCHAR(255),
            content TEXT NOT NULL,
            note_type VARCHAR(50) DEFAULT ''GENERAL'',
            is_confidential BOOLEAN DEFAULT false,
            is_privileged BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_tenant_id, v_schema_name, v_schema_name);

    -- CASE_TASKS
    EXECUTE format('
        CREATE TABLE %I.case_tasks (
            id BIGSERIAL PRIMARY KEY,
            tenant_id BIGINT NOT NULL DEFAULT %L,
            case_id BIGINT NOT NULL REFERENCES %I.legal_cases(id),
            title VARCHAR(255) NOT NULL,
            description TEXT,
            task_type VARCHAR(50),
            priority VARCHAR(20) DEFAULT ''MEDIUM'',
            status VARCHAR(30) DEFAULT ''TODO'',
            assigned_to BIGINT REFERENCES %I.users(id),
            assigned_by BIGINT REFERENCES %I.users(id),
            due_date TIMESTAMP,
            completed_at TIMESTAMP,
            estimated_hours DECIMAL(5,2),
            actual_hours DECIMAL(5,2),
            parent_task_id BIGINT,
            dependencies JSONB,
            tags JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_tenant_id, v_schema_name, v_schema_name, v_schema_name);

    -- CASE_ACTIVITIES
    EXECUTE format('
        CREATE TABLE %I.case_activities (
            id BIGSERIAL PRIMARY KEY,
            tenant_id BIGINT NOT NULL DEFAULT %L,
            case_id BIGINT NOT NULL REFERENCES %I.legal_cases(id),
            user_id BIGINT REFERENCES %I.users(id),
            activity_type VARCHAR(50) NOT NULL,
            description TEXT NOT NULL,
            reference_id BIGINT,
            reference_type VARCHAR(50),
            metadata JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_tenant_id, v_schema_name, v_schema_name);

    -- ==========================================================================
    -- CALENDAR & SCHEDULING
    -- ==========================================================================

    -- CALENDAR_EVENTS
    EXECUTE format('
        CREATE TABLE %I.calendar_events (
            id BIGSERIAL PRIMARY KEY,
            tenant_id BIGINT NOT NULL DEFAULT %L,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            event_type VARCHAR(50),
            start_time TIMESTAMP NOT NULL,
            end_time TIMESTAMP NOT NULL,
            all_day BOOLEAN DEFAULT false,
            location VARCHAR(500),
            case_id BIGINT REFERENCES %I.legal_cases(id),
            client_id BIGINT REFERENCES %I.clients(id),
            created_by BIGINT REFERENCES %I.users(id),
            attendees JSONB,
            recurrence_rule VARCHAR(255),
            reminder_minutes INT,
            status VARCHAR(30) DEFAULT ''SCHEDULED'',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_tenant_id, v_schema_name, v_schema_name, v_schema_name);

    -- ==========================================================================
    -- COMMUNICATION TABLES
    -- ==========================================================================

    -- MESSAGE_THREADS
    EXECUTE format('
        CREATE TABLE %I.message_threads (
            id BIGSERIAL PRIMARY KEY,
            tenant_id BIGINT NOT NULL DEFAULT %L,
            case_id BIGINT REFERENCES %I.legal_cases(id),
            client_id BIGINT REFERENCES %I.clients(id),
            subject VARCHAR(255),
            is_internal BOOLEAN DEFAULT false,
            last_message_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_tenant_id, v_schema_name, v_schema_name);

    -- MESSAGES
    EXECUTE format('
        CREATE TABLE %I.messages (
            id BIGSERIAL PRIMARY KEY,
            tenant_id BIGINT NOT NULL DEFAULT %L,
            thread_id BIGINT NOT NULL REFERENCES %I.message_threads(id),
            sender_id BIGINT REFERENCES %I.users(id),
            content TEXT NOT NULL,
            is_read BOOLEAN DEFAULT false,
            attachment_url VARCHAR(500),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_tenant_id, v_schema_name, v_schema_name);

    -- ==========================================================================
    -- LEADS & CRM
    -- ==========================================================================

    -- PIPELINE_STAGES
    EXECUTE format('
        CREATE TABLE %I.pipeline_stages (
            id BIGSERIAL PRIMARY KEY,
            tenant_id BIGINT NOT NULL DEFAULT %L,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            display_order INT DEFAULT 0,
            color VARCHAR(20),
            is_won BOOLEAN DEFAULT false,
            is_lost BOOLEAN DEFAULT false,
            automation_config JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_tenant_id);

    -- LEADS
    EXECUTE format('
        CREATE TABLE %I.leads (
            id BIGSERIAL PRIMARY KEY,
            tenant_id BIGINT NOT NULL DEFAULT %L,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            phone VARCHAR(30),
            company VARCHAR(255),
            source VARCHAR(100),
            case_type VARCHAR(100),
            description TEXT,
            stage_id BIGINT REFERENCES %I.pipeline_stages(id),
            assigned_to BIGINT REFERENCES %I.users(id),
            estimated_value DECIMAL(12,2),
            probability INT,
            expected_close_date DATE,
            status VARCHAR(30) DEFAULT ''NEW'',
            converted_client_id BIGINT,
            converted_case_id BIGINT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_tenant_id, v_schema_name, v_schema_name);

    -- ==========================================================================
    -- INTAKE TABLES
    -- ==========================================================================

    -- INTAKE_FORMS
    EXECUTE format('
        CREATE TABLE %I.intake_forms (
            id BIGSERIAL PRIMARY KEY,
            tenant_id BIGINT NOT NULL DEFAULT %L,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            form_config JSONB NOT NULL,
            case_type VARCHAR(100),
            is_active BOOLEAN DEFAULT true,
            is_public BOOLEAN DEFAULT false,
            created_by BIGINT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_tenant_id);

    -- INTAKE_SUBMISSIONS
    EXECUTE format('
        CREATE TABLE %I.intake_submissions (
            id BIGSERIAL PRIMARY KEY,
            tenant_id BIGINT NOT NULL DEFAULT %L,
            form_id BIGINT REFERENCES %I.intake_forms(id),
            submission_data JSONB NOT NULL,
            lead_id BIGINT REFERENCES %I.leads(id),
            client_id BIGINT REFERENCES %I.clients(id),
            status VARCHAR(30) DEFAULT ''PENDING'',
            reviewed_by BIGINT REFERENCES %I.users(id),
            reviewed_at TIMESTAMP,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_tenant_id, v_schema_name, v_schema_name, v_schema_name, v_schema_name);

    -- ==========================================================================
    -- NOTIFICATION TABLES
    -- ==========================================================================

    -- USER_NOTIFICATIONS
    EXECUTE format('
        CREATE TABLE %I.user_notifications (
            id BIGSERIAL PRIMARY KEY,
            tenant_id BIGINT NOT NULL DEFAULT %L,
            user_id BIGINT NOT NULL REFERENCES %I.users(id),
            title VARCHAR(255) NOT NULL,
            message TEXT,
            notification_type VARCHAR(50),
            reference_type VARCHAR(50),
            reference_id BIGINT,
            is_read BOOLEAN DEFAULT false,
            read_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_tenant_id, v_schema_name);

    -- ==========================================================================
    -- AUDIT LOG
    -- ==========================================================================

    -- AUDIT_LOG
    EXECUTE format('
        CREATE TABLE %I.audit_log (
            id BIGSERIAL PRIMARY KEY,
            tenant_id BIGINT NOT NULL DEFAULT %L,
            user_id BIGINT REFERENCES %I.users(id),
            action VARCHAR(50) NOT NULL,
            entity_type VARCHAR(100) NOT NULL,
            entity_id BIGINT,
            old_values JSONB,
            new_values JSONB,
            ip_address VARCHAR(45),
            user_agent TEXT,
            metadata JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_tenant_id, v_schema_name);

    -- ==========================================================================
    -- ROW LEVEL SECURITY
    -- ==========================================================================

    -- Enable RLS on all tables
    EXECUTE format('ALTER TABLE %I.users ENABLE ROW LEVEL SECURITY', v_schema_name);
    EXECUTE format('ALTER TABLE %I.clients ENABLE ROW LEVEL SECURITY', v_schema_name);
    EXECUTE format('ALTER TABLE %I.legal_cases ENABLE ROW LEVEL SECURITY', v_schema_name);
    EXECUTE format('ALTER TABLE %I.time_entries ENABLE ROW LEVEL SECURITY', v_schema_name);
    EXECUTE format('ALTER TABLE %I.invoices ENABLE ROW LEVEL SECURITY', v_schema_name);
    EXECUTE format('ALTER TABLE %I.expenses ENABLE ROW LEVEL SECURITY', v_schema_name);
    EXECUTE format('ALTER TABLE %I.payments ENABLE ROW LEVEL SECURITY', v_schema_name);
    EXECUTE format('ALTER TABLE %I.trust_accounts ENABLE ROW LEVEL SECURITY', v_schema_name);
    EXECUTE format('ALTER TABLE %I.trust_account_transactions ENABLE ROW LEVEL SECURITY', v_schema_name);
    EXECUTE format('ALTER TABLE %I.documents ENABLE ROW LEVEL SECURITY', v_schema_name);
    EXECUTE format('ALTER TABLE %I.case_notes ENABLE ROW LEVEL SECURITY', v_schema_name);
    EXECUTE format('ALTER TABLE %I.case_tasks ENABLE ROW LEVEL SECURITY', v_schema_name);
    EXECUTE format('ALTER TABLE %I.case_activities ENABLE ROW LEVEL SECURITY', v_schema_name);
    EXECUTE format('ALTER TABLE %I.calendar_events ENABLE ROW LEVEL SECURITY', v_schema_name);
    EXECUTE format('ALTER TABLE %I.message_threads ENABLE ROW LEVEL SECURITY', v_schema_name);
    EXECUTE format('ALTER TABLE %I.messages ENABLE ROW LEVEL SECURITY', v_schema_name);
    EXECUTE format('ALTER TABLE %I.pipeline_stages ENABLE ROW LEVEL SECURITY', v_schema_name);
    EXECUTE format('ALTER TABLE %I.leads ENABLE ROW LEVEL SECURITY', v_schema_name);
    EXECUTE format('ALTER TABLE %I.intake_forms ENABLE ROW LEVEL SECURITY', v_schema_name);
    EXECUTE format('ALTER TABLE %I.intake_submissions ENABLE ROW LEVEL SECURITY', v_schema_name);
    EXECUTE format('ALTER TABLE %I.user_notifications ENABLE ROW LEVEL SECURITY', v_schema_name);
    EXECUTE format('ALTER TABLE %I.audit_log ENABLE ROW LEVEL SECURITY', v_schema_name);

    -- Create RLS policies (tenant isolation)
    EXECUTE format('CREATE POLICY tenant_isolation ON %I.users USING (tenant_id = public.current_tenant_id())', v_schema_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I.clients USING (tenant_id = public.current_tenant_id())', v_schema_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I.legal_cases USING (tenant_id = public.current_tenant_id())', v_schema_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I.time_entries USING (tenant_id = public.current_tenant_id())', v_schema_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I.invoices USING (tenant_id = public.current_tenant_id())', v_schema_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I.expenses USING (tenant_id = public.current_tenant_id())', v_schema_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I.payments USING (tenant_id = public.current_tenant_id())', v_schema_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I.trust_accounts USING (tenant_id = public.current_tenant_id())', v_schema_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I.trust_account_transactions USING (tenant_id = public.current_tenant_id())', v_schema_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I.documents USING (tenant_id = public.current_tenant_id())', v_schema_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I.case_notes USING (tenant_id = public.current_tenant_id())', v_schema_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I.case_tasks USING (tenant_id = public.current_tenant_id())', v_schema_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I.case_activities USING (tenant_id = public.current_tenant_id())', v_schema_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I.calendar_events USING (tenant_id = public.current_tenant_id())', v_schema_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I.message_threads USING (tenant_id = public.current_tenant_id())', v_schema_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I.messages USING (tenant_id = public.current_tenant_id())', v_schema_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I.pipeline_stages USING (tenant_id = public.current_tenant_id())', v_schema_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I.leads USING (tenant_id = public.current_tenant_id())', v_schema_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I.intake_forms USING (tenant_id = public.current_tenant_id())', v_schema_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I.intake_submissions USING (tenant_id = public.current_tenant_id())', v_schema_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I.user_notifications USING (tenant_id = public.current_tenant_id())', v_schema_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I.audit_log USING (tenant_id = public.current_tenant_id())', v_schema_name);

    -- ==========================================================================
    -- INDEXES
    -- ==========================================================================

    EXECUTE format('CREATE INDEX idx_%s_users_email ON %I.users(email)', p_tenant_slug, v_schema_name);
    EXECUTE format('CREATE INDEX idx_%s_clients_email ON %I.clients(email)', p_tenant_slug, v_schema_name);
    EXECUTE format('CREATE INDEX idx_%s_cases_number ON %I.legal_cases(case_number)', p_tenant_slug, v_schema_name);
    EXECUTE format('CREATE INDEX idx_%s_cases_status ON %I.legal_cases(status)', p_tenant_slug, v_schema_name);
    EXECUTE format('CREATE INDEX idx_%s_cases_client ON %I.legal_cases(client_id)', p_tenant_slug, v_schema_name);
    EXECUTE format('CREATE INDEX idx_%s_time_user ON %I.time_entries(user_id)', p_tenant_slug, v_schema_name);
    EXECUTE format('CREATE INDEX idx_%s_time_case ON %I.time_entries(case_id)', p_tenant_slug, v_schema_name);
    EXECUTE format('CREATE INDEX idx_%s_time_date ON %I.time_entries(entry_date)', p_tenant_slug, v_schema_name);
    EXECUTE format('CREATE INDEX idx_%s_invoices_client ON %I.invoices(client_id)', p_tenant_slug, v_schema_name);
    EXECUTE format('CREATE INDEX idx_%s_invoices_status ON %I.invoices(status)', p_tenant_slug, v_schema_name);
    EXECUTE format('CREATE INDEX idx_%s_leads_status ON %I.leads(status)', p_tenant_slug, v_schema_name);
    EXECUTE format('CREATE INDEX idx_%s_leads_assigned ON %I.leads(assigned_to)', p_tenant_slug, v_schema_name);

    -- ==========================================================================
    -- DEFAULT DATA
    -- ==========================================================================

    -- Create default pipeline stages
    EXECUTE format('
        INSERT INTO %I.pipeline_stages (tenant_id, name, display_order, color, is_won, is_lost)
        VALUES
            (%L, ''New Lead'', 1, ''#3B82F6'', false, false),
            (%L, ''Contacted'', 2, ''#8B5CF6'', false, false),
            (%L, ''Consultation Scheduled'', 3, ''#EC4899'', false, false),
            (%L, ''Proposal Sent'', 4, ''#F59E0B'', false, false),
            (%L, ''Negotiating'', 5, ''#10B981'', false, false),
            (%L, ''Retained'', 6, ''#059669'', true, false),
            (%L, ''Lost'', 7, ''#EF4444'', false, true)
    ', v_schema_name, v_tenant_id, v_tenant_id, v_tenant_id, v_tenant_id, v_tenant_id, v_tenant_id, v_tenant_id);

    -- Create admin user
    IF p_admin_email IS NOT NULL AND p_admin_password_hash IS NOT NULL THEN
        EXECUTE format('
            INSERT INTO %I.users (tenant_id, email, password, first_name, last_name, is_enabled, is_not_locked, role_id)
            VALUES (%L, %L, %L, ''Admin'', ''User'', true, true,
                (SELECT id FROM public.roles WHERE name = ''ROLE_ADMIN''))
        ', v_schema_name, v_tenant_id, p_admin_email, p_admin_password_hash);
    END IF;

    RAISE NOTICE 'Created tenant schema: % with ID: %', v_schema_name, v_tenant_id;
    RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql;

-- Function to drop tenant schema (for cleanup/testing)
CREATE OR REPLACE FUNCTION public.drop_tenant_schema(p_tenant_slug VARCHAR) RETURNS VOID AS $$
DECLARE
    v_schema_name VARCHAR;
BEGIN
    v_schema_name := 'org_' || p_tenant_slug;

    -- Drop the schema and all its objects
    EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', v_schema_name);

    -- Remove tenant record
    DELETE FROM public.tenants WHERE slug = p_tenant_slug;

    RAISE NOTICE 'Dropped tenant schema: %', v_schema_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.create_tenant_schema IS 'Creates a complete tenant schema with all required tables, RLS policies, and default data';
COMMENT ON FUNCTION public.drop_tenant_schema IS 'Drops a tenant schema and removes the tenant record (use with caution)';
