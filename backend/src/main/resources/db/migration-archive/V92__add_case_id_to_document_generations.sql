-- Add case_id column to document_generations table for tracking which case the document belongs to

ALTER TABLE document_generations
ADD COLUMN IF NOT EXISTS case_id BIGINT NULL AFTER user_id;

-- Add index for querying documents by case
CREATE INDEX IF NOT EXISTS idx_document_generations_case ON document_generations(case_id);
