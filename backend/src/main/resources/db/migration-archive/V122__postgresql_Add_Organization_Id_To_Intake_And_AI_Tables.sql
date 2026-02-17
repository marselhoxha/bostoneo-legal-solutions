-- Add organization_id to intake and AI tables for multi-tenant support

-- Add organization_id to intake_forms
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS organization_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_intake_forms_org ON intake_forms(organization_id);

-- Add organization_id to intake_submissions
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS organization_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_intake_submissions_org ON intake_submissions(organization_id);

-- Add organization_id to ai_legal_templates
ALTER TABLE ai_legal_templates ADD COLUMN IF NOT EXISTS organization_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_ai_legal_templates_org ON ai_legal_templates(organization_id);

-- Add organization_id to ai_research_cache
ALTER TABLE ai_research_cache ADD COLUMN IF NOT EXISTS organization_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_ai_research_cache_org ON ai_research_cache(organization_id);

-- Update existing data to set organization_id based on created_by user's organization
-- For intake_forms
UPDATE intake_forms f
SET organization_id = u.organization_id
FROM users u
WHERE f.created_by = u.id AND f.organization_id IS NULL;

-- For intake_submissions (inherit from form or set from reviewer)
UPDATE intake_submissions s
SET organization_id = f.organization_id
FROM intake_forms f
WHERE s.form_id = f.id AND s.organization_id IS NULL;

-- For ai_legal_templates (use firm_id if set, otherwise from created_by)
UPDATE ai_legal_templates t
SET organization_id = COALESCE(t.firm_id, u.organization_id)
FROM users u
WHERE t.created_by = u.id AND t.organization_id IS NULL;

-- For ai_research_cache - leave NULL for now (shared cache, will be set on new entries)
