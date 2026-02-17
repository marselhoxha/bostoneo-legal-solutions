-- Add analysis_context column to ai_document_analysis table
-- Stores the user's goal/context for document analysis (respond, negotiate, client_review, due_diligence, general)

ALTER TABLE ai_document_analysis
ADD COLUMN analysis_context VARCHAR(50) DEFAULT 'general';

-- Add index for filtering by context
CREATE INDEX idx_ai_document_analysis_context ON ai_document_analysis(analysis_context);
