-- Add case_id column to ai_conversation_session table to link conversations with specific legal cases
-- This allows AI to maintain case context throughout the entire conversation

ALTER TABLE ai_conversation_session
ADD COLUMN case_id BIGINT NULL AFTER user_id;

-- Add foreign key constraint to legal_cases table
ALTER TABLE ai_conversation_session
ADD CONSTRAINT fk_conversation_case
FOREIGN KEY (case_id) REFERENCES legal_cases(id)
ON DELETE SET NULL;

-- Add index for faster case-based queries
CREATE INDEX idx_conversation_case_id ON ai_conversation_session(case_id);
