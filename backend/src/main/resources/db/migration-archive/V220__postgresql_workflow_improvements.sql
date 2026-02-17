-- V220__postgresql_workflow_improvements.sql
-- Add support for intelligent case workflows

-- Add workflow reference to case_tasks to track tasks created by workflows
ALTER TABLE case_tasks
ADD COLUMN IF NOT EXISTS workflow_execution_id BIGINT;

-- Add foreign key constraint (PostgreSQL syntax)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_case_tasks_workflow_execution'
        AND table_name = 'case_tasks'
    ) THEN
        ALTER TABLE case_tasks
        ADD CONSTRAINT fk_case_tasks_workflow_execution
        FOREIGN KEY (workflow_execution_id)
        REFERENCES case_workflow_executions(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- Create index for querying tasks by workflow
CREATE INDEX IF NOT EXISTS idx_case_tasks_workflow_execution
    ON case_tasks(workflow_execution_id)
    WHERE workflow_execution_id IS NOT NULL;

-- Track workflow recommendations for suggesting workflows to attorneys
CREATE TABLE IF NOT EXISTS workflow_recommendations (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    case_id BIGINT NOT NULL,
    template_type VARCHAR(50) NOT NULL,
    reason TEXT,
    urgency VARCHAR(20) NOT NULL,
    deadline_date DATE,
    days_until_deadline INT,
    is_dismissed BOOLEAN DEFAULT FALSE,
    dismissed_at TIMESTAMP,
    dismissed_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_workflow_rec_case
        FOREIGN KEY (case_id)
        REFERENCES legal_cases(id)
        ON DELETE CASCADE
);

-- Indexes for workflow recommendations
CREATE INDEX IF NOT EXISTS idx_workflow_rec_org_case
    ON workflow_recommendations(organization_id, case_id);

CREATE INDEX IF NOT EXISTS idx_workflow_rec_urgency
    ON workflow_recommendations(urgency, deadline_date)
    WHERE is_dismissed = FALSE;

-- Track completed workflows per case (prevents duplicate suggestions)
CREATE TABLE IF NOT EXISTS case_workflow_history (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    case_id BIGINT NOT NULL,
    execution_id BIGINT NOT NULL,
    template_type VARCHAR(50) NOT NULL,
    completed_at TIMESTAMP NOT NULL,
    created_by BIGINT NOT NULL,
    CONSTRAINT fk_workflow_history_case
        FOREIGN KEY (case_id)
        REFERENCES legal_cases(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_workflow_history_execution
        FOREIGN KEY (execution_id)
        REFERENCES case_workflow_executions(id)
        ON DELETE CASCADE
);

-- Index for workflow history lookups
CREATE INDEX IF NOT EXISTS idx_workflow_history_org_case
    ON case_workflow_history(organization_id, case_id);

CREATE INDEX IF NOT EXISTS idx_workflow_history_template
    ON case_workflow_history(organization_id, case_id, template_type);
