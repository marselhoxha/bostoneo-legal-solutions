-- =============================================================================
-- AWS RDS Migration - February 2026
-- Run against staging/production PostgreSQL database
-- All statements are idempotent (safe to re-run)
-- =============================================================================

-- Create non-JPA tables that Hibernate ddl-auto won't create.
-- These tables are managed via raw JDBC (NamedParameterJdbcTemplate).
-- IF NOT EXISTS ensures this is safe on databases where they already exist.

CREATE TABLE IF NOT EXISTS ai_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    user_email VARCHAR(255),
    user_role VARCHAR(100),
    action VARCHAR(100),
    resource_type VARCHAR(50),
    resource_id BIGINT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_payload JSONB,
    response_summary TEXT,
    was_successful BOOLEAN,
    error_details TEXT,
    contains_pii BOOLEAN,
    data_classification VARCHAR(20),
    created_at TIMESTAMP,
    organization_id BIGINT
);

CREATE TABLE IF NOT EXISTS user_events (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    event_id BIGINT NOT NULL,
    device VARCHAR(100),
    ip_address VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    organization_id BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    is_primary BOOLEAN,
    assigned_by BIGINT,
    assigned_at TIMESTAMP,
    is_active BOOLEAN,
    PRIMARY KEY (user_id, role_id)
);

-- V115: Add organization_id to ai_audit_logs for multi-tenant filtering
ALTER TABLE public.ai_audit_logs ADD COLUMN IF NOT EXISTS organization_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_org_id ON public.ai_audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_created_at ON public.ai_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_org_user ON public.ai_audit_logs(organization_id, user_id);

-- V115: Add AI consent fields to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ai_consent_given BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ai_consent_date TIMESTAMP;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ai_consent_notes TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ai_consent_token VARCHAR(255);

-- V116: Add review tracking fields to AI conversation messages
ALTER TABLE ai_conversation_messages ADD COLUMN IF NOT EXISTS reviewed_by BIGINT;
ALTER TABLE ai_conversation_messages ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
