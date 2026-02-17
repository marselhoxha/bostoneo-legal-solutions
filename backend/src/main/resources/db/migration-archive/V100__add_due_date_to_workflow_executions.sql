-- Add due_date column to case_workflow_executions table
-- Note: Column already added manually, this is for documentation
-- ALTER TABLE case_workflow_executions ADD COLUMN due_date TIMESTAMP NULL;

-- Add index for querying by due date (MySQL syntax)
CREATE INDEX idx_workflow_executions_due_date ON case_workflow_executions(due_date);
