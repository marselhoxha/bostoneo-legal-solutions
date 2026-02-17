-- PostgreSQL Migration: Add organization_id to email_templates table
-- This enables multi-tenant data isolation for email templates

-- 1. Add organization_id column
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- 2. Create index for tenant filtering
CREATE INDEX IF NOT EXISTS idx_email_templates_organization_id ON email_templates(organization_id);

-- 3. Populate organization_id for existing templates
-- Assign all existing templates to the first organization (they were shared before multi-tenancy)
UPDATE email_templates
SET organization_id = (SELECT MIN(id) FROM organizations)
WHERE organization_id IS NULL;

-- 4. Add composite index for common queries
CREATE INDEX IF NOT EXISTS idx_email_templates_org_event_type ON email_templates(organization_id, event_type);
CREATE INDEX IF NOT EXISTS idx_email_templates_org_active ON email_templates(organization_id, is_active);
