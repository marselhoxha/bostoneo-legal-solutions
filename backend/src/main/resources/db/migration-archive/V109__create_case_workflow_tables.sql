-- Case Workflow Tables Migration
-- Phase 2: Database Schema for Workflow Execution Tracking

-- Workflow templates (pre-built + custom)
CREATE TABLE IF NOT EXISTS case_workflow_templates (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_type VARCHAR(50) NOT NULL,
    steps_config JSON NOT NULL,
    is_system BOOLEAN DEFAULT FALSE,
    created_by BIGINT UNSIGNED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_workflow_templates_type (template_type),
    INDEX idx_workflow_templates_created_by (created_by),
    CONSTRAINT fk_workflow_template_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Workflow execution tracking
CREATE TABLE IF NOT EXISTS case_workflow_executions (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    collection_id BIGINT UNSIGNED,
    case_id BIGINT UNSIGNED,
    template_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(30) DEFAULT 'pending',
    current_step INT DEFAULT 0,
    total_steps INT NOT NULL,
    progress_percentage INT DEFAULT 0,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_workflow_exec_collection (collection_id),
    INDEX idx_workflow_exec_case (case_id),
    INDEX idx_workflow_exec_template (template_id),
    INDEX idx_workflow_exec_status (status),
    INDEX idx_workflow_exec_created_by (created_by),
    CONSTRAINT fk_workflow_exec_template FOREIGN KEY (template_id) REFERENCES case_workflow_templates(id) ON DELETE RESTRICT,
    CONSTRAINT fk_workflow_exec_case FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE SET NULL,
    CONSTRAINT fk_workflow_exec_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

-- Individual step execution tracking
CREATE TABLE IF NOT EXISTS case_workflow_step_executions (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    workflow_execution_id BIGINT UNSIGNED NOT NULL,
    step_number INT NOT NULL,
    step_name VARCHAR(255) NOT NULL,
    step_type VARCHAR(30) NOT NULL,
    status VARCHAR(30) DEFAULT 'pending',
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    input_data JSON,
    output_data JSON,
    related_resource_type VARCHAR(50),
    related_resource_id BIGINT UNSIGNED,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_workflow_step_exec_workflow (workflow_execution_id),
    INDEX idx_workflow_step_exec_status (status),
    INDEX idx_workflow_step_exec_step_number (workflow_execution_id, step_number),
    CONSTRAINT fk_workflow_step_exec_workflow FOREIGN KEY (workflow_execution_id)
        REFERENCES case_workflow_executions(id) ON DELETE CASCADE
);

-- Seed the 5 pre-built workflow templates
INSERT INTO case_workflow_templates (name, description, template_type, steps_config, is_system, created_by) VALUES
(
    'Complaint Response',
    'Respond to a legal complaint with analysis, draft answer, and evidence checklist',
    'complaint_response',
    JSON_OBJECT(
        'steps', JSON_ARRAY(
            JSON_OBJECT('number', 1, 'name', 'Document Analysis', 'type', 'display', 'description', 'Display stored document analysis'),
            JSON_OBJECT('number', 2, 'name', 'Timeline & Deadlines', 'type', 'display', 'description', 'Show timeline events and key deadlines'),
            JSON_OBJECT('number', 3, 'name', 'Draft Answer', 'type', 'integration', 'description', 'Create draft answer via Drafting taskcard'),
            JSON_OBJECT('number', 4, 'name', 'Evidence Checklist', 'type', 'synthesis', 'description', 'Generate evidence gathering checklist'),
            JSON_OBJECT('number', 5, 'name', 'Team Notification', 'type', 'action', 'description', 'Notify team members for review')
        )
    ),
    TRUE,
    NULL
),
(
    'Contract Review',
    'Review contracts with risk assessment, redlines, and negotiation priorities',
    'contract_review',
    JSON_OBJECT(
        'steps', JSON_ARRAY(
            JSON_OBJECT('number', 1, 'name', 'Document Analysis', 'type', 'display', 'description', 'Display stored contract analysis'),
            JSON_OBJECT('number', 2, 'name', 'Risk Assessment', 'type', 'display', 'description', 'Show aggregated risk assessment'),
            JSON_OBJECT('number', 3, 'name', 'Generate Redlines', 'type', 'generation', 'description', 'Create suggested contract redlines'),
            JSON_OBJECT('number', 4, 'name', 'Negotiation Priorities', 'type', 'synthesis', 'description', 'Generate negotiation priority list'),
            JSON_OBJECT('number', 5, 'name', 'Approval Routing', 'type', 'action', 'description', 'Route for client/partner approval')
        )
    ),
    TRUE,
    NULL
),
(
    'Motion Opposition',
    'Prepare opposition to a motion with research and supporting brief',
    'motion_opposition',
    JSON_OBJECT(
        'steps', JSON_ARRAY(
            JSON_OBJECT('number', 1, 'name', 'Motion Analysis', 'type', 'display', 'description', 'Display motion document analysis'),
            JSON_OBJECT('number', 2, 'name', 'Legal Research', 'type', 'integration', 'description', 'Find counter-authorities via Research taskcard'),
            JSON_OBJECT('number', 3, 'name', 'Draft Opposition Brief', 'type', 'integration', 'description', 'Draft opposition via Drafting taskcard'),
            JSON_OBJECT('number', 4, 'name', 'Supporting Evidence', 'type', 'synthesis', 'description', 'Generate supporting evidence checklist'),
            JSON_OBJECT('number', 5, 'name', 'Filing Checklist', 'type', 'display', 'description', 'Show court filing requirements checklist')
        )
    ),
    TRUE,
    NULL
),
(
    'Discovery Response',
    'Respond to discovery requests with objection analysis and draft responses',
    'discovery_response',
    JSON_OBJECT(
        'steps', JSON_ARRAY(
            JSON_OBJECT('number', 1, 'name', 'Request Analysis', 'type', 'display', 'description', 'Display discovery request analysis'),
            JSON_OBJECT('number', 2, 'name', 'Objection Identification', 'type', 'synthesis', 'description', 'Identify potential objections'),
            JSON_OBJECT('number', 3, 'name', 'Document Collection', 'type', 'action', 'description', 'User collects responsive documents'),
            JSON_OBJECT('number', 4, 'name', 'Draft Responses', 'type', 'integration', 'description', 'Draft discovery responses via Drafting'),
            JSON_OBJECT('number', 5, 'name', 'Review Checklist', 'type', 'display', 'description', 'Show review checklist before sending')
        )
    ),
    TRUE,
    NULL
),
(
    'Due Diligence',
    'Comprehensive due diligence review with risk matrix and report generation',
    'due_diligence',
    JSON_OBJECT(
        'steps', JSON_ARRAY(
            JSON_OBJECT('number', 1, 'name', 'Document Organization', 'type', 'display', 'description', 'Organize documents by type'),
            JSON_OBJECT('number', 2, 'name', 'Issue Aggregation', 'type', 'display', 'description', 'Show aggregated issues across documents'),
            JSON_OBJECT('number', 3, 'name', 'Risk Matrix', 'type', 'synthesis', 'description', 'Generate comprehensive risk matrix'),
            JSON_OBJECT('number', 4, 'name', 'DD Report', 'type', 'generation', 'description', 'Generate due diligence report'),
            JSON_OBJECT('number', 5, 'name', 'Export Options', 'type', 'action', 'description', 'Export report in various formats')
        )
    ),
    TRUE,
    NULL
);
