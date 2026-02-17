-- Add editing tracking fields to document_generations table

ALTER TABLE document_generations
ADD COLUMN is_edited BOOLEAN DEFAULT FALSE AFTER generated_at,
ADD COLUMN last_edited_at DATETIME NULL AFTER is_edited,
ADD COLUMN last_edited_by BIGINT NULL AFTER last_edited_at,
ADD COLUMN edit_count INT DEFAULT 0 AFTER last_edited_by;

-- Add index for querying edited documents
CREATE INDEX idx_document_generations_edited ON document_generations(is_edited, last_edited_at);

-- Add index for user's edited documents
CREATE INDEX idx_document_generations_editor ON document_generations(last_edited_by, last_edited_at);
