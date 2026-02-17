-- P0-2: ABA Opinion 512 Attorney Verification Workflow
-- Add review tracking fields to AI conversation messages (PostgreSQL)
ALTER TABLE ai_conversation_messages
  ADD COLUMN IF NOT EXISTS reviewed_by BIGINT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
