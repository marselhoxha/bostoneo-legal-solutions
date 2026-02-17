-- Add transformed_text column to store AI-generated transformed selection text
ALTER TABLE ai_workspace_document_versions
ADD COLUMN transformed_text TEXT COMMENT 'The AI-generated transformed text (for selection transforms)';
