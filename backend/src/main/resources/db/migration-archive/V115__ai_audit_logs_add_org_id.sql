-- V115: Add organization_id to ai_audit_logs for multi-tenant filtering
-- PostgreSQL migration

ALTER TABLE public.ai_audit_logs ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Index for tenant-filtered queries
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_org_id ON public.ai_audit_logs(organization_id);

-- Index for time-based cleanup/queries
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_created_at ON public.ai_audit_logs(created_at);

-- Composite index for common query: org + user
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_org_user ON public.ai_audit_logs(organization_id, user_id);
