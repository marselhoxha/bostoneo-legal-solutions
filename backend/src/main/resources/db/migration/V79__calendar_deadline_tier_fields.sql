-- V79: Wave 1 — Cal-D2 deadline tier fields on calendar_events
-- Spec: docs/superpowers/specs/2026-05-06-wave1-tasks-calendar-design.md
-- Plan: docs/superpowers/plans/2026-05-07-wave1-cal-d2-deadlines-layout.md
--
-- Adds three nullable columns that drive the cal-d2 (Deadlines) calendar UI.
-- No backfill: tier is inferred at render time when deadline_tier IS NULL
-- (eventType=COURT_DATE → COURT, DEADLINE+highPriority → STATUTE, DEADLINE → SOFT).
--
-- Numbering note: V77 / V78 are claimed by uncommitted parent-repo migrations
-- (V77 add_billing_type_to_legal_cases, V78 add_task_multi_assignees). V79 is next free.

ALTER TABLE calendar_events
    ADD COLUMN IF NOT EXISTS deadline_tier    VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS source_authority TEXT        NULL,
    ADD COLUMN IF NOT EXISTS required_action  TEXT        NULL;

COMMENT ON COLUMN calendar_events.deadline_tier IS
    'STATUTE | COURT | SOFT — explicit tier for deadline-type events. NULL means inferred from event_type + high_priority at render time.';
COMMENT ON COLUMN calendar_events.source_authority IS
    'Free-text statutory or rule citation backing the deadline (e.g., "MA Gen. Laws Ch. 260 §4"). Surfaces in the Cal-D2 deadline modal.';
COMMENT ON COLUMN calendar_events.required_action IS
    'Free-text required action to satisfy the deadline (e.g., "File complaint in Suffolk Superior Court before 5pm"). Surfaces in the Cal-D2 deadline modal.';

-- Tenant-scoped lookup index: most deadline queries filter by org + tier and the tier column is NULL for the majority of rows.
CREATE INDEX IF NOT EXISTS idx_calendar_events_org_deadline_tier
    ON calendar_events (organization_id, deadline_tier)
    WHERE deadline_tier IS NOT NULL;
