-- PostgreSQL Migration: Add organization_id to action_items, timeline_events, and reminder_queue tables
-- This enables multi-tenant data isolation for document analysis items and reminders

-- 1. Add organization_id to action_items
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS organization_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_action_items_organization_id ON action_items(organization_id);

-- 2. Add organization_id to timeline_events
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS organization_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_timeline_events_organization_id ON timeline_events(organization_id);

-- 3. Add organization_id to reminder_queue
ALTER TABLE reminder_queue ADD COLUMN IF NOT EXISTS organization_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_reminder_queue_organization_id ON reminder_queue(organization_id);

-- Populate organization_id from related document analysis data
-- For action_items: get org from the linked ai_document_analysis
UPDATE action_items ai
SET organization_id = ada.organization_id
FROM ai_document_analysis ada
WHERE ai.analysis_id = ada.id
AND ai.organization_id IS NULL
AND ada.organization_id IS NOT NULL;

-- For timeline_events: get org from the linked ai_document_analysis
UPDATE timeline_events te
SET organization_id = ada.organization_id
FROM ai_document_analysis ada
WHERE te.analysis_id = ada.id
AND te.organization_id IS NULL
AND ada.organization_id IS NOT NULL;

-- For reminder_queue: get org from the linked calendar_events
UPDATE reminder_queue rq
SET organization_id = ce.organization_id
FROM calendar_events ce
WHERE rq.event_id = ce.id
AND rq.organization_id IS NULL
AND ce.organization_id IS NOT NULL;
