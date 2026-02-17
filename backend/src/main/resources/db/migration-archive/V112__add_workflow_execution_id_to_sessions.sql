-- Add workflow_execution_id to ai_conversation_sessions (drafts)
ALTER TABLE ai_conversation_sessions
ADD COLUMN workflow_execution_id BIGINT UNSIGNED NULL,
ADD CONSTRAINT fk_conversation_workflow_execution
    FOREIGN KEY (workflow_execution_id) REFERENCES case_workflow_executions(id)
    ON DELETE SET NULL;

-- Add workflow_execution_id to research_session
ALTER TABLE research_session
ADD COLUMN workflow_execution_id BIGINT UNSIGNED NULL,
ADD CONSTRAINT fk_research_workflow_execution
    FOREIGN KEY (workflow_execution_id) REFERENCES case_workflow_executions(id)
    ON DELETE SET NULL;

-- Add indexes for efficient lookups
CREATE INDEX idx_conversation_workflow ON ai_conversation_sessions(workflow_execution_id);
CREATE INDEX idx_research_workflow ON research_session(workflow_execution_id);
