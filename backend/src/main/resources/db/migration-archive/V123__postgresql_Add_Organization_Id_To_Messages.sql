-- Migration: Add organization_id to messages and message_threads tables
-- This is a critical security fix for multi-tenant data isolation

-- Add organization_id to message_threads
ALTER TABLE message_threads ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Add organization_id to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Backfill organization_id for message_threads based on the case's organization
-- (MessageThread has case_id, and cases have organization_id)
UPDATE message_threads mt
SET organization_id = (
    SELECT lc.organization_id
    FROM legal_cases lc
    WHERE lc.id = mt.case_id
)
WHERE mt.organization_id IS NULL AND mt.case_id IS NOT NULL;

-- For threads without case_id, try to get org from attorney
UPDATE message_threads mt
SET organization_id = (
    SELECT u.organization_id
    FROM users u
    WHERE u.id = mt.attorney_id
)
WHERE mt.organization_id IS NULL AND mt.attorney_id IS NOT NULL;

-- Backfill organization_id for messages based on the thread's organization
UPDATE messages m
SET organization_id = (
    SELECT mt.organization_id
    FROM message_threads mt
    WHERE mt.id = m.thread_id
)
WHERE m.organization_id IS NULL AND m.thread_id IS NOT NULL;

-- Set default organization for any remaining records (fallback to org 1)
UPDATE message_threads SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE messages SET organization_id = 1 WHERE organization_id IS NULL;

-- Make the columns NOT NULL after backfill
ALTER TABLE message_threads ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE messages ALTER COLUMN organization_id SET NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_threads_org ON message_threads(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_org ON messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_org_attorney ON message_threads(organization_id, attorney_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_org_case ON message_threads(organization_id, case_id);
CREATE INDEX IF NOT EXISTS idx_messages_org_thread ON messages(organization_id, thread_id);

-- Add foreign key constraints
ALTER TABLE message_threads
    ADD CONSTRAINT fk_message_threads_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE messages
    ADD CONSTRAINT fk_messages_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);
