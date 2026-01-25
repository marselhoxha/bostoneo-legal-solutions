-- ============================================================
-- V4: MULTITENANCY SETUP
-- ============================================================

-- Phase 1: Delete backup tables
DROP TABLE IF EXISTS file_versions_backup CASCADE;
DROP TABLE IF EXISTS invoice_time_entries_backup_20250616_171903 CASCADE;
DROP TABLE IF EXISTS invoices_backup_20250616_171903 CASCADE;
DROP TABLE IF EXISTS legaldocument_legacy CASCADE;
DROP TABLE IF EXISTS permissions_backup CASCADE;
DROP TABLE IF EXISTS user_roles_backup_20251201 CASCADE;
DROP TABLE IF EXISTS users_backup_20250821 CASCADE;
DROP TABLE IF EXISTS users_backup_complete_final_20250821 CASCADE;
DROP TABLE IF EXISTS users_backup_comprehensive_20250821 CASCADE;
DROP TABLE IF EXISTS users_backup_final_20250821 CASCADE;
DROP TABLE IF EXISTS users_backup_final_corrected_20250821 CASCADE;

-- Phase 2: Standardize tenant column (firm_id → organization_id)
ALTER TABLE ai_drafting_templates RENAME COLUMN firm_id TO organization_id;
ALTER TABLE ai_legal_templates RENAME COLUMN firm_id TO organization_id;
ALTER TABLE ai_style_guides RENAME COLUMN firm_id TO organization_id;
ALTER TABLE approval_workflows RENAME COLUMN firm_id TO organization_id;
ALTER TABLE document_embeddings RENAME COLUMN firm_id TO organization_id;
ALTER TABLE document_templates RENAME COLUMN firm_id TO organization_id;
ALTER TABLE legal_folder_templates RENAME COLUMN firm_id TO organization_id;
ALTER TABLE precedent_documents RENAME COLUMN firm_id TO organization_id;
ALTER TABLE research_workspaces RENAME COLUMN firm_id TO organization_id;
ALTER TABLE template_library RENAME COLUMN firm_id TO organization_id;

-- Phase 3: Add organization_id to core tables
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE case_tasks ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE case_activities ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE case_notes ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE case_assignments ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE file_items ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE folders ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE message_threads ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE timer_sessions ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE active_timers ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Backfill organization_id from relationships
UPDATE time_entries te SET organization_id = (
    SELECT organization_id FROM legal_cases lc WHERE lc.id = te.legal_case_id
) WHERE organization_id IS NULL AND legal_case_id IS NOT NULL;

UPDATE case_tasks ct SET organization_id = (
    SELECT organization_id FROM legal_cases lc WHERE lc.id = ct.case_id
) WHERE organization_id IS NULL AND case_id IS NOT NULL;

UPDATE case_activities ca SET organization_id = (
    SELECT organization_id FROM legal_cases lc WHERE lc.id = ca.case_id
) WHERE organization_id IS NULL AND case_id IS NOT NULL;

UPDATE case_notes cn SET organization_id = (
    SELECT organization_id FROM legal_cases lc WHERE lc.id = cn.case_id
) WHERE organization_id IS NULL AND case_id IS NOT NULL;

UPDATE case_assignments ca SET organization_id = (
    SELECT organization_id FROM legal_cases lc WHERE lc.id = ca.case_id
) WHERE organization_id IS NULL AND case_id IS NOT NULL;

UPDATE invoices i SET organization_id = (
    SELECT organization_id FROM clients c WHERE c.id = i.client_id
) WHERE organization_id IS NULL AND client_id IS NOT NULL;

UPDATE folders f SET organization_id = (
    SELECT organization_id FROM users u WHERE u.id = f.created_by
) WHERE organization_id IS NULL AND created_by IS NOT NULL;

UPDATE calendar_events ce SET organization_id = (
    SELECT organization_id FROM users u WHERE u.id = ce.user_id
) WHERE organization_id IS NULL AND user_id IS NOT NULL;

UPDATE timer_sessions ts SET organization_id = (
    SELECT organization_id FROM users u WHERE u.id = ts.user_id
) WHERE organization_id IS NULL AND user_id IS NOT NULL;

UPDATE active_timers at SET organization_id = (
    SELECT organization_id FROM users u WHERE u.id = at.user_id
) WHERE organization_id IS NULL AND user_id IS NOT NULL;

-- Set remaining NULLs to default organization (id=1)
UPDATE time_entries SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE invoices SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE case_tasks SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE case_activities SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE case_notes SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE case_assignments SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE expenses SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE documents SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE file_items SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE folders SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE messages SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE message_threads SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE leads SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE calendar_events SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE timer_sessions SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE intake_submissions SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE active_timers SET organization_id = 1 WHERE organization_id IS NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_time_entries_org ON time_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_case_tasks_org ON case_tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_case_activities_org ON case_activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_case_notes_org ON case_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_case_assignments_org ON case_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_org ON expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_file_items_org ON file_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_folders_org ON folders(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_org ON messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_org ON message_threads(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_org ON leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_org ON calendar_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_timer_sessions_org ON timer_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_intake_submissions_org ON intake_submissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_active_timers_org ON active_timers(organization_id);
