-- Add document_type column to ai_conversation_sessions table
-- This stores the type of document being drafted (e.g., 'motion_to_compel', 'demand_letter')
ALTER TABLE ai_conversation_sessions ADD COLUMN IF NOT EXISTS document_type VARCHAR(100) NULL;

-- Create index for efficient filtering by document type
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_document_type ON ai_conversation_sessions(document_type);
