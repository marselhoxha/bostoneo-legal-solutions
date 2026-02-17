-- Add organization_id column to ai_document_generation_log table for multi-tenant support
ALTER TABLE ai_document_generation_log ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Create index for tenant-filtered queries
CREATE INDEX IF NOT EXISTS idx_ai_doc_gen_log_org_id ON ai_document_generation_log(organization_id);

-- Create index for common tenant-filtered queries
CREATE INDEX IF NOT EXISTS idx_ai_doc_gen_log_org_user ON ai_document_generation_log(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ai_doc_gen_log_org_template ON ai_document_generation_log(organization_id, template_id);
