-- CRITICAL SECURITY FIX: Add organization_id to tables lacking tenant isolation
-- This migration adds organization_id to document_relationships, research_annotation, and file_permissions

-- Add organization_id to document_relationships
ALTER TABLE document_relationships ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Update existing document_relationships to inherit org from source analysis
UPDATE document_relationships dr
SET organization_id = (
    SELECT ada.organization_id
    FROM ai_document_analysis ada
    WHERE ada.id = dr.source_analysis_id
)
WHERE dr.organization_id IS NULL;

-- Add index for tenant filtering
CREATE INDEX IF NOT EXISTS idx_document_relationships_org_id ON document_relationships(organization_id);

-- Add organization_id to research_annotation
ALTER TABLE research_annotation ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Update existing research_annotation to inherit org from user
UPDATE research_annotation ra
SET organization_id = (
    SELECT u.organization_id
    FROM users u
    WHERE u.id = ra.user_id
)
WHERE ra.organization_id IS NULL;

-- Add index for tenant filtering
CREATE INDEX IF NOT EXISTS idx_research_annotation_org_id ON research_annotation(organization_id);

-- Add organization_id to file_permissions
ALTER TABLE file_permissions ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Update existing file_permissions to inherit org from file
UPDATE file_permissions fp
SET organization_id = (
    SELECT fi.organization_id
    FROM file_items fi
    WHERE fi.id = fp.file_id
)
WHERE fp.organization_id IS NULL;

-- Add index for tenant filtering
CREATE INDEX IF NOT EXISTS idx_file_permissions_org_id ON file_permissions(organization_id);
