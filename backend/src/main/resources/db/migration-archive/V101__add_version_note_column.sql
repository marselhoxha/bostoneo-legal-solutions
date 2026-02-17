-- Add version_note column to ai_workspace_document_versions
-- This allows users to add optional notes when manually saving versions

ALTER TABLE ai_workspace_document_versions
ADD COLUMN version_note VARCHAR(500) NULL AFTER created_by_user;
