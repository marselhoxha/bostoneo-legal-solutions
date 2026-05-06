-- V76: Wave 1 Phase 1 — additive fields for Tasks Inbox + Calendar Classic
-- Spec: docs/superpowers/specs/2026-05-06-wave1-tasks-calendar-design.md

-- 1. Add blocker_reason + auto_unblock_date to case_tasks
ALTER TABLE case_tasks
    ADD COLUMN IF NOT EXISTS blocker_reason TEXT NULL,
    ADD COLUMN IF NOT EXISTS auto_unblock_date DATE NULL;

COMMENT ON COLUMN case_tasks.blocker_reason IS 'Free-text reason a task is in BLOCKED status. Surfaces in the unified task drawer whenever status=BLOCKED, regardless of view.';
COMMENT ON COLUMN case_tasks.auto_unblock_date IS 'Optional date when the task automatically unblocks (e.g., opposing-counsel response deadline).';

-- 2. user_preference: per-user UI state (last-used view + layout)
CREATE TABLE IF NOT EXISTS user_preference (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id BIGINT       NOT NULL,
    user_id         BIGINT       NOT NULL,
    preferred_view_tasks    VARCHAR(20)  NULL,
    preferred_layout_calendar VARCHAR(20) NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_preference_user_unique UNIQUE (user_id),
    CONSTRAINT user_preference_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_preference_org ON user_preference(organization_id);

COMMENT ON TABLE user_preference IS 'Per-user UI state — last-used view per page, sticky between sessions.';
COMMENT ON COLUMN user_preference.preferred_view_tasks IS 'Last selected /tasks view: inbox|pipeline|workload. NULL = use role default.';
COMMENT ON COLUMN user_preference.preferred_layout_calendar IS 'Last selected /legal/calendar layout: classic|deadlines|time-block. NULL = classic default.';
