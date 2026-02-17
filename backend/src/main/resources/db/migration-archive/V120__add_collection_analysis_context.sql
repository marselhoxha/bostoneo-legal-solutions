-- Add analysis_context column to document_collections table
-- Allows setting a default analysis context for all operations on a collection
-- Values: 'respond', 'negotiate', 'client_review', 'due_diligence', 'general'

ALTER TABLE document_collections
ADD COLUMN analysis_context VARCHAR(50) DEFAULT 'general';

-- Add comment
COMMENT ON COLUMN document_collections.analysis_context IS 'Default analysis context for collection operations: respond, negotiate, client_review, due_diligence, general';
