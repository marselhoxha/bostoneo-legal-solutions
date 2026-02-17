-- =============================================================================
-- Legience PostgreSQL Migration V1 - Initial Schema Setup
-- =============================================================================
-- This creates the foundational structure for multitenancy:
-- 1. Public schema tables (shared across all tenants)
-- 2. Helper functions for tenant management
-- 3. Row Level Security configuration
-- =============================================================================

-- =============================================================================
-- PUBLIC SCHEMA - Shared Tables
-- =============================================================================

-- Tenants/Organizations Registry
CREATE TABLE IF NOT EXISTS public.tenants (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    schema_name VARCHAR(100) NOT NULL UNIQUE,
    logo_url VARCHAR(500),
    website VARCHAR(255),
    email VARCHAR(100),
    phone VARCHAR(30),
    address TEXT,
    plan_type VARCHAR(20) DEFAULT 'FREE' CHECK (plan_type IN ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE')),
    plan_expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Global roles (shared across tenants)
CREATE TABLE IF NOT EXISTS public.roles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_system_role BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Global permissions
CREATE TABLE IF NOT EXISTS public.permissions (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    module VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Role-Permission mapping
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id BIGINT REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id BIGINT REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Indexes for public schema
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_schema ON public.tenants(schema_name);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON public.tenants(is_active);

-- =============================================================================
-- TENANT CONTEXT FUNCTIONS
-- =============================================================================

-- Function to get current tenant ID from session
CREATE OR REPLACE FUNCTION public.current_tenant_id() RETURNS BIGINT AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::BIGINT;
EXCEPTION
    WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set current tenant by ID
CREATE OR REPLACE FUNCTION public.set_current_tenant(p_tenant_id BIGINT) RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', p_tenant_id::TEXT, false);
END;
$$ LANGUAGE plpgsql;

-- Function to set current tenant by slug
CREATE OR REPLACE FUNCTION public.set_current_tenant_by_slug(p_slug VARCHAR) RETURNS VOID AS $$
DECLARE
    v_tenant_id BIGINT;
    v_schema_name VARCHAR;
BEGIN
    SELECT id, schema_name INTO v_tenant_id, v_schema_name
    FROM public.tenants
    WHERE slug = p_slug AND is_active = true;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant not found or inactive: %', p_slug;
    END IF;

    -- Set tenant ID for RLS
    PERFORM set_config('app.current_tenant_id', v_tenant_id::TEXT, false);

    -- Set search path to tenant schema
    EXECUTE format('SET search_path TO %I, public', v_schema_name);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- DEFAULT DATA
-- =============================================================================

-- Insert default roles
INSERT INTO public.roles (name, description, is_system_role) VALUES
    ('ROLE_SUPER_ADMIN', 'System administrator with full access to all tenants', true),
    ('ROLE_ADMIN', 'Organization administrator', true),
    ('ROLE_ATTORNEY', 'Attorney with case management access', true),
    ('ROLE_PARALEGAL', 'Paralegal with limited access', true),
    ('ROLE_RECEPTIONIST', 'Front desk with intake access', true),
    ('ROLE_ACCOUNTANT', 'Billing and accounting access', true),
    ('ROLE_CLIENT', 'Client portal access', true)
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO public.permissions (name, description, module) VALUES
    -- Case Management
    ('cases:read', 'View cases', 'cases'),
    ('cases:write', 'Create and edit cases', 'cases'),
    ('cases:delete', 'Delete cases', 'cases'),
    ('cases:assign', 'Assign cases to attorneys', 'cases'),

    -- Client Management
    ('clients:read', 'View clients', 'clients'),
    ('clients:write', 'Create and edit clients', 'clients'),
    ('clients:delete', 'Delete clients', 'clients'),

    -- Time Tracking
    ('time:read', 'View time entries', 'time'),
    ('time:write', 'Create and edit time entries', 'time'),
    ('time:approve', 'Approve time entries', 'time'),

    -- Billing
    ('billing:read', 'View invoices', 'billing'),
    ('billing:write', 'Create and edit invoices', 'billing'),
    ('billing:void', 'Void invoices', 'billing'),
    ('trust:manage', 'Manage trust accounts', 'billing'),

    -- Documents
    ('documents:read', 'View documents', 'documents'),
    ('documents:write', 'Upload and edit documents', 'documents'),
    ('documents:delete', 'Delete documents', 'documents'),

    -- Admin
    ('admin:users', 'Manage users', 'admin'),
    ('admin:settings', 'Manage organization settings', 'admin'),
    ('admin:reports', 'Access reports', 'admin')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- Massachusetts Legal Reference Tables (Shared, Read-Only)
-- =============================================================================

-- MA Statutes
CREATE TABLE IF NOT EXISTS public.ai_ma_statutes (
    id BIGSERIAL PRIMARY KEY,
    statute_number VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    chapter VARCHAR(100),
    section VARCHAR(50),
    statute_text TEXT NOT NULL,
    effective_date DATE,
    last_amended DATE,
    annotations JSONB,
    related_statutes JSONB,
    keywords JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MA Court Rules
CREATE TABLE IF NOT EXISTS public.ai_ma_court_rules (
    id BIGSERIAL PRIMARY KEY,
    court VARCHAR(100) NOT NULL,
    rule_number VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    rule_text TEXT NOT NULL,
    effective_date DATE,
    last_amended DATE,
    annotations JSONB,
    related_rules JSONB,
    forms JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MA Sentencing Guidelines
CREATE TABLE IF NOT EXISTS public.ai_ma_sentencing_guidelines (
    id BIGSERIAL PRIMARY KEY,
    offense_category VARCHAR(100) NOT NULL,
    offense_level VARCHAR(50) NOT NULL,
    offense_description TEXT,
    minimum_sentence VARCHAR(100),
    maximum_sentence VARCHAR(100),
    mandatory_minimum BOOLEAN DEFAULT false,
    guideline_range JSONB,
    aggravating_factors JSONB,
    mitigating_factors JSONB,
    notes TEXT,
    effective_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for MA legal tables
CREATE INDEX IF NOT EXISTS idx_ma_statutes_number ON public.ai_ma_statutes(statute_number);
CREATE INDEX IF NOT EXISTS idx_ma_court_rules_court ON public.ai_ma_court_rules(court);
CREATE INDEX IF NOT EXISTS idx_ma_sentencing_category ON public.ai_ma_sentencing_guidelines(offense_category);

COMMENT ON TABLE public.tenants IS 'Registry of all tenant organizations';
COMMENT ON TABLE public.roles IS 'System-wide roles shared across all tenants';
COMMENT ON TABLE public.permissions IS 'System-wide permissions for authorization';
COMMENT ON TABLE public.ai_ma_statutes IS 'Massachusetts statutes reference data (read-only)';
COMMENT ON TABLE public.ai_ma_court_rules IS 'Massachusetts court rules reference data (read-only)';
COMMENT ON TABLE public.ai_ma_sentencing_guidelines IS 'Massachusetts sentencing guidelines reference data (read-only)';
