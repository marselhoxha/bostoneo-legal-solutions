-- Add name column to case_workflow_executions for user-provided workflow names
ALTER TABLE case_workflow_executions
ADD COLUMN name VARCHAR(100) NULL AFTER id;
