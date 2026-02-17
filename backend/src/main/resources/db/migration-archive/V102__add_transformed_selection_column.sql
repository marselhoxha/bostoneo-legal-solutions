-- Add transformed_selection column to ai_workspace_document_versions table
-- This column stores only the AI-transformed snippet for selection-based transformations

ALTER TABLE ai_workspace_document_versions
ADD COLUMN transformed_selection TEXT NULL COMMENT 'For selection scope: only the AI-transformed snippet';
