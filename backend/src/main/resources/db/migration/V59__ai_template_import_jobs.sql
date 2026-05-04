-- ai_template_import_jobs
-- Persists template-import sessions so they survive pod restarts, the 5-minute in-memory TTL,
-- and the user closing/reopening the wizard. Source of truth for "what's still in flight" and
-- "what completed/failed" beyond the in-memory ImportSessionStore.

CREATE TABLE IF NOT EXISTS ai_template_import_jobs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id UUID NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL,            -- PENDING|IN_PROGRESS|PARTIAL|COMPLETED|FAILED|CANCELLED
    file_count INTEGER NOT NULL,
    ready_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    error_code VARCHAR(64),
    error_message TEXT,
    files_summary JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_aitij_user_started
    ON ai_template_import_jobs (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_aitij_org_status_started
    ON ai_template_import_jobs (organization_id, status, started_at DESC);
