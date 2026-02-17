-- V219: Add research_mode column to ai_conversation_messages table
-- This allows storing the research mode (FAST/THOROUGH) per message
-- so the correct badge is shown for each response after page refresh

ALTER TABLE ai_conversation_messages
ADD COLUMN IF NOT EXISTS research_mode VARCHAR(20);

-- Add comment for documentation
COMMENT ON COLUMN ai_conversation_messages.research_mode IS 'Research mode used for this message: FAST or THOROUGH';

-- Create index for potential filtering by research mode
CREATE INDEX IF NOT EXISTS idx_ai_messages_research_mode ON ai_conversation_messages(research_mode);
