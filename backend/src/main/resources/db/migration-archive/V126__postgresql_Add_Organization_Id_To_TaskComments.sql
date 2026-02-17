-- Migration: Add organization_id to task_comments table
-- This is a critical security fix for multi-tenant data isolation

-- Add organization_id to task_comments
ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Backfill organization_id based on the task's case's organization
UPDATE task_comments tc
SET organization_id = (
    SELECT lc.organization_id
    FROM case_tasks ct
    JOIN legal_cases lc ON lc.id = ct.case_id
    WHERE ct.id = tc.task_id
)
WHERE tc.organization_id IS NULL;

-- For any remaining, try from user
UPDATE task_comments tc
SET organization_id = (
    SELECT u.organization_id
    FROM users u
    WHERE u.id = tc.user_id
)
WHERE tc.organization_id IS NULL;

-- Set default organization for any remaining records (fallback to org 1)
UPDATE task_comments SET organization_id = 1 WHERE organization_id IS NULL;

-- Make the column NOT NULL after backfill
ALTER TABLE task_comments ALTER COLUMN organization_id SET NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_comments_org ON task_comments(organization_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_org_task ON task_comments(organization_id, task_id);

-- Add foreign key constraint
ALTER TABLE task_comments
    ADD CONSTRAINT fk_task_comments_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);
