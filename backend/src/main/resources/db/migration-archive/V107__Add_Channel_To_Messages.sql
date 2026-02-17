-- Add channel column to messages table for SMS/PORTAL differentiation
-- V107: Support for multi-channel messaging (SMS, PORTAL, EMAIL)

-- Add channel column to messages table
ALTER TABLE messages
ADD COLUMN channel VARCHAR(20) DEFAULT 'PORTAL' AFTER sender_type;

-- Add index for channel queries
CREATE INDEX idx_messages_channel ON messages(channel);

-- Update message_threads to indicate if it's an SMS thread
ALTER TABLE message_threads
ADD COLUMN channel VARCHAR(20) DEFAULT 'PORTAL' AFTER subject;

-- Add index for thread channel
CREATE INDEX idx_threads_channel ON message_threads(channel);
