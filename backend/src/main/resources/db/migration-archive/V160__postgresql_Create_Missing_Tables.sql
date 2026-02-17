-- V160: Create missing tables in PostgreSQL syntax
-- These tables were originally created in MySQL syntax and need PostgreSQL versions

-- ==================== AUDIT LOG ====================
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    session_id VARCHAR(255),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT,
    description TEXT,
    metadata TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    organization_id BIGINT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_organization ON audit_log(organization_id);

-- ==================== REMINDER QUEUE ====================
CREATE TABLE IF NOT EXISTS reminder_queue (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT,
    user_id BIGINT NOT NULL,
    scheduled_time TIMESTAMP NOT NULL,
    minutes_before INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    retry_count INT DEFAULT 0,
    last_attempt TIMESTAMP,
    error_message VARCHAR(255),
    reminder_type VARCHAR(20) NOT NULL DEFAULT 'PRIMARY',
    organization_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reminder_status ON reminder_queue(status);
CREATE INDEX IF NOT EXISTS idx_reminder_event ON reminder_queue(event_id);
CREATE INDEX IF NOT EXISTS idx_reminder_scheduled ON reminder_queue(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_reminder_organization ON reminder_queue(organization_id);

-- ==================== INVOICE WORKFLOW RULES ====================
CREATE TABLE IF NOT EXISTS invoice_workflow_rules (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    trigger_event VARCHAR(50) NOT NULL,
    trigger_status VARCHAR(20),
    days_before_due INT,
    days_after_due INT,
    action_type VARCHAR(50) NOT NULL,
    action_config TEXT,
    execution_time TIME,
    max_executions INT DEFAULT 1,
    organization_id BIGINT,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflow_active ON invoice_workflow_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_trigger ON invoice_workflow_rules(trigger_event, is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_organization ON invoice_workflow_rules(organization_id);

-- ==================== INVOICE WORKFLOW EXECUTIONS ====================
CREATE TABLE IF NOT EXISTS invoice_workflow_executions (
    id BIGSERIAL PRIMARY KEY,
    workflow_rule_id BIGINT,
    invoice_id BIGINT,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL,
    result_message TEXT,
    organization_id BIGINT,
    CONSTRAINT fk_execution_workflow FOREIGN KEY (workflow_rule_id) REFERENCES invoice_workflow_rules(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_execution_invoice ON invoice_workflow_executions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_execution_workflow ON invoice_workflow_executions(workflow_rule_id);
CREATE INDEX IF NOT EXISTS idx_execution_status ON invoice_workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_execution_organization ON invoice_workflow_executions(organization_id);

-- ==================== COLLECTION SEARCH CACHE ====================
CREATE TABLE IF NOT EXISTS collection_search_cache (
    id BIGSERIAL PRIMARY KEY,
    collection_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    query VARCHAR(500) NOT NULL,
    query_hash VARCHAR(64) NOT NULL,
    expanded_query VARCHAR(1000),
    results_json TEXT,
    result_count INT DEFAULT 0,
    organization_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_collection_query_user ON collection_search_cache(collection_id, query_hash, user_id);
CREATE INDEX IF NOT EXISTS idx_cache_collection_id ON collection_search_cache(collection_id);
CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON collection_search_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_organization ON collection_search_cache(organization_id);

-- ==================== COLLECTION SEARCH HISTORY ====================
CREATE TABLE IF NOT EXISTS collection_search_history (
    id BIGSERIAL PRIMARY KEY,
    collection_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    query VARCHAR(500) NOT NULL,
    result_count INT DEFAULT 0,
    organization_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_history_collection_user ON collection_search_history(collection_id, user_id);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON collection_search_history(created_at);
CREATE INDEX IF NOT EXISTS idx_history_organization ON collection_search_history(organization_id);
