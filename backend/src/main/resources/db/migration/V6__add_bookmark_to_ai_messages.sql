-- V6__add_bookmark_to_ai_messages.sql
-- Add bookmark support for AI conversation messages
ALTER TABLE ai_conversation_messages ADD COLUMN IF NOT EXISTS bookmarked BOOLEAN DEFAULT FALSE;

-- Index for efficient bookmark filtering (find sessions with bookmarked messages)
CREATE INDEX IF NOT EXISTS idx_ai_messages_bookmarked ON ai_conversation_messages(bookmarked) WHERE bookmarked = TRUE;
