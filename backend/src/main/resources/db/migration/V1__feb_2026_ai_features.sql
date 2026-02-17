-- =============================================================================
-- AWS RDS Migration - February 2026
-- Run against staging/production PostgreSQL database
-- All statements are idempotent (safe to re-run)
-- =============================================================================

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
