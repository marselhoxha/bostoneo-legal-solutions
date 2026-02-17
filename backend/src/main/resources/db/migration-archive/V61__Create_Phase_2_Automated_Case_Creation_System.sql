-- =====================================================
-- Phase 2: Automated Case Creation & Client Onboarding System
-- Database Migration Script - Version 61
-- =====================================================

USE bostoneosolutions;

-- =====================================================
-- AUTOMATED CASE CREATION WORKFLOW TABLES
-- =====================================================

-- Case creation workflow templates
CREATE TABLE IF NOT EXISTS case_creation_workflows (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    practice_area VARCHAR(100) NOT NULL,
    workflow_type VARCHAR(30) NOT NULL COMMENT 'LEAD_TO_CASE, SUBMISSION_TO_CASE, CONSULTATION_TO_CASE',
    workflow_steps JSON NOT NULL COMMENT 'Ordered workflow steps with configurations',
    automation_rules JSON COMMENT 'Rules for automatic execution',
    prerequisite_checks JSON COMMENT 'Checks that must pass before execution',
    success_criteria JSON COMMENT 'Criteria that define successful completion',
    rollback_steps JSON COMMENT 'Steps to rollback in case of failure',
    estimated_duration_minutes INT DEFAULT 15,
    priority_level VARCHAR(20) DEFAULT 'MEDIUM' COMMENT 'LOW, MEDIUM, HIGH, URGENT',
    is_active BOOLEAN DEFAULT TRUE,
    auto_execute BOOLEAN DEFAULT FALSE COMMENT 'Whether to execute automatically when conditions are met',
    requires_approval BOOLEAN DEFAULT FALSE,
    max_retries INT DEFAULT 3,
    version INT DEFAULT 1,
    usage_count INT DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_workflows_practice_area (practice_area),
    INDEX idx_workflows_type (workflow_type),
    INDEX idx_workflows_active (is_active),
    INDEX idx_workflows_auto_execute (auto_execute),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Case creation workflow templates';

-- Workflow execution instances
CREATE TABLE IF NOT EXISTS case_creation_executions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    workflow_id BIGINT UNSIGNED NOT NULL,
    source_type VARCHAR(20) NOT NULL COMMENT 'LEAD, SUBMISSION, CONSULTATION',
    source_id BIGINT UNSIGNED NOT NULL,
    execution_status VARCHAR(20) DEFAULT 'PENDING' COMMENT 'PENDING, RUNNING, COMPLETED, FAILED, CANCELLED',
    current_step_index INT DEFAULT 0,
    total_steps INT NOT NULL,
    progress_percentage DECIMAL(5,2) DEFAULT 0.00,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    execution_time_seconds INT COMMENT 'Total execution time',
    triggered_by VARCHAR(20) DEFAULT 'MANUAL' COMMENT 'MANUAL, AUTOMATIC, SCHEDULED',
    triggered_by_user_id BIGINT UNSIGNED,
    execution_context JSON COMMENT 'Context data for the execution',
    error_message TEXT,
    retry_count INT DEFAULT 0,
    case_id BIGINT UNSIGNED COMMENT 'Created case ID if successful',
    client_id BIGINT UNSIGNED COMMENT 'Created/updated client ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_executions_workflow (workflow_id),
    INDEX idx_executions_source (source_type, source_id),
    INDEX idx_executions_status (execution_status),
    INDEX idx_executions_started_at (started_at),
    INDEX idx_executions_case_id (case_id),
    FOREIGN KEY (workflow_id) REFERENCES case_creation_workflows(id) ON DELETE RESTRICT,
    FOREIGN KEY (triggered_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Workflow execution tracking';

-- Individual workflow step executions
CREATE TABLE IF NOT EXISTS workflow_step_executions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    execution_id BIGINT UNSIGNED NOT NULL,
    step_name VARCHAR(100) NOT NULL,
    step_type VARCHAR(30) NOT NULL COMMENT 'CREATE_CLIENT, CREATE_CASE, ASSIGN_ATTORNEY, GENERATE_DOCS, etc',
    step_index INT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' COMMENT 'PENDING, RUNNING, COMPLETED, FAILED, SKIPPED',
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    execution_time_ms INT,
    step_config JSON COMMENT 'Step-specific configuration',
    input_data JSON COMMENT 'Input data for this step',
    output_data JSON COMMENT 'Output data from this step',
    error_message TEXT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_step_executions_execution (execution_id),
    INDEX idx_step_executions_status (status),
    INDEX idx_step_executions_step_type (step_type),
    INDEX idx_step_executions_started_at (started_at),
    FOREIGN KEY (execution_id) REFERENCES case_creation_executions(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Individual workflow step execution tracking';

-- =====================================================
-- CLIENT ONBOARDING SYSTEM TABLES
-- =====================================================

-- Client onboarding templates
CREATE TABLE IF NOT EXISTS client_onboarding_templates (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    practice_area VARCHAR(100) NOT NULL,
    onboarding_stages JSON NOT NULL COMMENT 'Ordered stages in onboarding process',
    required_documents JSON COMMENT 'Documents required from client',
    welcome_materials JSON COMMENT 'Materials to send to new clients',
    automated_tasks JSON COMMENT 'Tasks to create automatically',
    notification_schedule JSON COMMENT 'Schedule for automated notifications',
    completion_criteria JSON COMMENT 'Criteria for completed onboarding',
    estimated_duration_days INT DEFAULT 7,
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INT DEFAULT 0,
    completion_rate DECIMAL(5,2) DEFAULT 0.00,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_onboarding_templates_practice_area (practice_area),
    INDEX idx_onboarding_templates_active (is_active),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Client onboarding process templates';

-- Client onboarding instances
CREATE TABLE IF NOT EXISTS client_onboarding_instances (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    template_id BIGINT UNSIGNED NOT NULL,
    client_id BIGINT UNSIGNED NOT NULL,
    case_id BIGINT UNSIGNED,
    status VARCHAR(20) DEFAULT 'STARTED' COMMENT 'STARTED, IN_PROGRESS, COMPLETED, STALLED, CANCELLED',
    current_stage VARCHAR(50),
    progress_percentage DECIMAL(5,2) DEFAULT 0.00,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expected_completion_date DATE,
    completed_at TIMESTAMP NULL,
    assigned_coordinator_id BIGINT UNSIGNED,
    onboarding_data JSON COMMENT 'Client-specific onboarding data',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_client_onboarding (client_id, template_id, started_at),
    INDEX idx_onboarding_instances_client (client_id),
    INDEX idx_onboarding_instances_status (status),
    INDEX idx_onboarding_instances_coordinator (assigned_coordinator_id),
    INDEX idx_onboarding_instances_started_at (started_at),
    FOREIGN KEY (template_id) REFERENCES client_onboarding_templates(id) ON DELETE RESTRICT,
    FOREIGN KEY (assigned_coordinator_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Client onboarding process instances';

-- Onboarding task tracking
CREATE TABLE IF NOT EXISTS onboarding_tasks (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    onboarding_instance_id BIGINT UNSIGNED NOT NULL,
    task_name VARCHAR(100) NOT NULL,
    task_type VARCHAR(30) NOT NULL COMMENT 'DOCUMENT_COLLECTION, WELCOME_CALL, SEND_MATERIALS, CLIENT_PORTAL_SETUP, etc',
    description TEXT,
    assigned_to_id BIGINT UNSIGNED,
    due_date DATE,
    priority VARCHAR(20) DEFAULT 'MEDIUM' COMMENT 'LOW, MEDIUM, HIGH, URGENT',
    status VARCHAR(20) DEFAULT 'PENDING' COMMENT 'PENDING, IN_PROGRESS, COMPLETED, OVERDUE, CANCELLED',
    completion_percentage DECIMAL(5,2) DEFAULT 0.00,
    estimated_hours DECIMAL(4,2) DEFAULT 0.0,
    actual_hours DECIMAL(4,2) DEFAULT 0.0,
    task_data JSON COMMENT 'Task-specific data',
    completion_notes TEXT,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_onboarding_tasks_instance (onboarding_instance_id),
    INDEX idx_onboarding_tasks_assigned_to (assigned_to_id),
    INDEX idx_onboarding_tasks_status (status),
    INDEX idx_onboarding_tasks_due_date (due_date),
    FOREIGN KEY (onboarding_instance_id) REFERENCES client_onboarding_instances(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Individual onboarding tasks';

-- =====================================================
-- DOCUMENT GENERATION AND MANAGEMENT
-- =====================================================

-- Document templates for automation
CREATE TABLE IF NOT EXISTS automated_document_templates (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    document_type VARCHAR(50) NOT NULL COMMENT 'RETAINER_AGREEMENT, WELCOME_LETTER, INTAKE_FORM, etc',
    practice_area VARCHAR(100),
    template_format VARCHAR(20) DEFAULT 'DOCX' COMMENT 'DOCX, PDF, HTML, TXT',
    template_content LONGTEXT COMMENT 'Template content with placeholders',
    template_file_path VARCHAR(500) COMMENT 'Path to template file if stored separately',
    merge_fields JSON COMMENT 'Available merge fields and their sources',
    generation_rules JSON COMMENT 'Rules for when to generate this document',
    auto_generate BOOLEAN DEFAULT FALSE,
    requires_review BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INT DEFAULT 0,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_doc_templates_type (document_type),
    INDEX idx_doc_templates_practice_area (practice_area),
    INDEX idx_doc_templates_active (is_active),
    INDEX idx_doc_templates_auto_generate (auto_generate),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Automated document generation templates';

-- Generated document tracking
CREATE TABLE IF NOT EXISTS generated_documents (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    template_id BIGINT UNSIGNED NOT NULL,
    source_type VARCHAR(20) NOT NULL COMMENT 'CASE, CLIENT, LEAD, CONSULTATION',
    source_id BIGINT UNSIGNED NOT NULL,
    document_name VARCHAR(200) NOT NULL,
    file_path VARCHAR(500),
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    generation_status VARCHAR(20) DEFAULT 'PENDING' COMMENT 'PENDING, GENERATING, COMPLETED, FAILED',
    merge_data JSON COMMENT 'Data used for merging',
    generated_by BIGINT UNSIGNED NOT NULL,
    reviewed_by BIGINT UNSIGNED,
    reviewed_at TIMESTAMP NULL,
    approval_status VARCHAR(20) DEFAULT 'PENDING' COMMENT 'PENDING, APPROVED, REJECTED, NEEDS_REVISION',
    approval_notes TEXT,
    sent_to_client BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP NULL,
    delivery_method VARCHAR(20) COMMENT 'EMAIL, PORTAL, MAIL',
    generation_time_ms INT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_generated_docs_template (template_id),
    INDEX idx_generated_docs_source (source_type, source_id),
    INDEX idx_generated_docs_status (generation_status),
    INDEX idx_generated_docs_generated_by (generated_by),
    INDEX idx_generated_docs_created_at (created_at),
    FOREIGN KEY (template_id) REFERENCES automated_document_templates(id) ON DELETE RESTRICT,
    FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Tracking of generated documents';

-- =====================================================
-- BILLING AND FEE AGREEMENT AUTOMATION
-- =====================================================

-- Fee agreement templates
CREATE TABLE IF NOT EXISTS fee_agreement_templates (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    practice_area VARCHAR(100) NOT NULL,
    fee_structure VARCHAR(30) NOT NULL COMMENT 'HOURLY, FLAT_FEE, CONTINGENCY, RETAINER, HYBRID',
    default_terms JSON NOT NULL COMMENT 'Default fee terms and conditions',
    variable_fields JSON COMMENT 'Fields that can be customized per case',
    approval_workflow JSON COMMENT 'Who needs to approve different fee ranges',
    template_content LONGTEXT COMMENT 'Agreement template content',
    is_active BOOLEAN DEFAULT TRUE,
    requires_attorney_approval BOOLEAN DEFAULT TRUE,
    auto_calculate_fees BOOLEAN DEFAULT FALSE,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_fee_templates_practice_area (practice_area),
    INDEX idx_fee_templates_structure (fee_structure),
    INDEX idx_fee_templates_active (is_active),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Fee agreement templates';

-- Generated fee agreements
CREATE TABLE IF NOT EXISTS case_fee_agreements (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT UNSIGNED NOT NULL,
    template_id BIGINT UNSIGNED NOT NULL,
    client_id BIGINT UNSIGNED NOT NULL,
    attorney_id BIGINT UNSIGNED NOT NULL,
    agreement_number VARCHAR(50) UNIQUE,
    fee_structure VARCHAR(30) NOT NULL,
    fee_terms JSON NOT NULL COMMENT 'Specific fee terms for this case',
    hourly_rates JSON COMMENT 'Hourly rates by attorney/role if applicable',
    estimated_total DECIMAL(10,2),
    retainer_amount DECIMAL(10,2),
    contingency_percentage DECIMAL(5,2),
    agreement_content LONGTEXT COMMENT 'Final agreement text',
    status VARCHAR(20) DEFAULT 'DRAFT' COMMENT 'DRAFT, PENDING_APPROVAL, APPROVED, SENT, SIGNED, ACTIVE, TERMINATED',
    created_by BIGINT UNSIGNED NOT NULL,
    approved_by BIGINT UNSIGNED,
    approved_at TIMESTAMP NULL,
    sent_to_client_at TIMESTAMP NULL,
    client_signed_at TIMESTAMP NULL,
    client_signature_ip VARCHAR(45),
    attorney_signed_at TIMESTAMP NULL,
    effective_date DATE,
    expiration_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_fee_agreements_case (case_id),
    INDEX idx_fee_agreements_client (client_id),
    INDEX idx_fee_agreements_attorney (attorney_id),
    INDEX idx_fee_agreements_status (status),
    INDEX idx_fee_agreements_agreement_number (agreement_number),
    FOREIGN KEY (template_id) REFERENCES fee_agreement_templates(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Case-specific fee agreements';

-- =====================================================
-- WORKFLOW MONITORING AND OPTIMIZATION
-- =====================================================

-- Workflow performance metrics
CREATE TABLE IF NOT EXISTS workflow_performance_metrics (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    workflow_type VARCHAR(30) NOT NULL COMMENT 'CASE_CREATION, CLIENT_ONBOARDING, DOCUMENT_GENERATION',
    workflow_id BIGINT UNSIGNED,
    metric_period VARCHAR(20) NOT NULL COMMENT 'DAILY, WEEKLY, MONTHLY',
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_executions INT DEFAULT 0,
    successful_executions INT DEFAULT 0,
    failed_executions INT DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    average_execution_time_seconds INT DEFAULT 0,
    median_execution_time_seconds INT DEFAULT 0,
    total_processing_time_seconds BIGINT DEFAULT 0,
    bottleneck_steps JSON COMMENT 'Steps that commonly cause delays',
    common_errors JSON COMMENT 'Most frequent error types',
    improvement_suggestions JSON COMMENT 'AI-generated improvement suggestions',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_workflow_period (workflow_type, workflow_id, metric_period, period_start),
    INDEX idx_performance_metrics_workflow_type (workflow_type),
    INDEX idx_performance_metrics_period (metric_period, period_start),
    INDEX idx_performance_metrics_success_rate (success_rate)
) ENGINE=InnoDB COMMENT='Workflow performance analytics';

-- Workflow optimization recommendations
CREATE TABLE IF NOT EXISTS workflow_optimization_recommendations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    workflow_type VARCHAR(30) NOT NULL,
    workflow_id BIGINT UNSIGNED,
    recommendation_type VARCHAR(30) NOT NULL COMMENT 'AUTOMATION, STEP_OPTIMIZATION, RESOURCE_ALLOCATION, etc',
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    impact_assessment JSON COMMENT 'Expected impact on performance metrics',
    implementation_difficulty VARCHAR(20) DEFAULT 'MEDIUM' COMMENT 'LOW, MEDIUM, HIGH',
    estimated_time_savings_percentage DECIMAL(5,2),
    priority_score DECIMAL(5,2) DEFAULT 50.00 COMMENT '0-100 priority score',
    status VARCHAR(20) DEFAULT 'NEW' COMMENT 'NEW, REVIEWED, APPROVED, IMPLEMENTING, COMPLETED, REJECTED',
    reviewed_by BIGINT UNSIGNED,
    reviewed_at TIMESTAMP NULL,
    implementation_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_optimization_recommendations_workflow_type (workflow_type),
    INDEX idx_optimization_recommendations_status (status),
    INDEX idx_optimization_recommendations_priority (priority_score),
    INDEX idx_optimization_recommendations_reviewed_by (reviewed_by),
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='AI-generated workflow optimization recommendations';

-- =====================================================
-- INSERT DEFAULT DATA FOR PHASE 2
-- =====================================================

-- Default case creation workflow templates
INSERT IGNORE INTO case_creation_workflows (name, description, practice_area, workflow_type, workflow_steps, created_by) VALUES
('Personal Injury Lead to Case', 'Standard workflow for converting PI leads to active cases', 'Personal Injury', 'LEAD_TO_CASE', JSON_ARRAY(
    JSON_OBJECT('name', 'Validate Lead Data', 'type', 'DATA_VALIDATION', 'order', 1, 'required', true),
    JSON_OBJECT('name', 'Conflict Check', 'type', 'CONFLICT_CHECK', 'order', 2, 'required', true),
    JSON_OBJECT('name', 'Create/Update Client', 'type', 'CREATE_CLIENT', 'order', 3, 'required', true),
    JSON_OBJECT('name', 'Create Case', 'type', 'CREATE_CASE', 'order', 4, 'required', true),
    JSON_OBJECT('name', 'Assign Attorney', 'type', 'ASSIGN_ATTORNEY', 'order', 5, 'required', true),
    JSON_OBJECT('name', 'Generate Initial Documents', 'type', 'GENERATE_DOCS', 'order', 6, 'required', false),
    JSON_OBJECT('name', 'Setup Client Portal', 'type', 'SETUP_PORTAL', 'order', 7, 'required', false),
    JSON_OBJECT('name', 'Send Welcome Email', 'type', 'SEND_EMAIL', 'order', 8, 'required', true),
    JSON_OBJECT('name', 'Start Onboarding', 'type', 'START_ONBOARDING', 'order', 9, 'required', true)
), 1),
('Family Law Consultation to Case', 'Workflow for converting family law consultations to cases', 'Family Law', 'CONSULTATION_TO_CASE', JSON_ARRAY(
    JSON_OBJECT('name', 'Consultation Follow-up', 'type', 'CONSULTATION_FOLLOWUP', 'order', 1, 'required', true),
    JSON_OBJECT('name', 'Fee Agreement Generation', 'type', 'GENERATE_FEE_AGREEMENT', 'order', 2, 'required', true),
    JSON_OBJECT('name', 'Conflict Check', 'type', 'CONFLICT_CHECK', 'order', 3, 'required', true),
    JSON_OBJECT('name', 'Create Case', 'type', 'CREATE_CASE', 'order', 4, 'required', true),
    JSON_OBJECT('name', 'Document Package Creation', 'type', 'GENERATE_DOCS', 'order', 5, 'required', true),
    JSON_OBJECT('name', 'Initial Case Tasks', 'type', 'CREATE_TASKS', 'order', 6, 'required', true)
), 1);

-- Default client onboarding templates
INSERT IGNORE INTO client_onboarding_templates (name, description, practice_area, onboarding_stages, required_documents, created_by) VALUES
('Personal Injury Standard Onboarding', 'Standard onboarding process for PI clients', 'Personal Injury', JSON_ARRAY(
    JSON_OBJECT('name', 'Welcome & Orientation', 'order', 1, 'duration_days', 1),
    JSON_OBJECT('name', 'Document Collection', 'order', 2, 'duration_days', 3),
    JSON_OBJECT('name', 'Medical Records Request', 'order', 3, 'duration_days', 2),
    JSON_OBJECT('name', 'Insurance Coordination', 'order', 4, 'duration_days', 2),
    JSON_OBJECT('name', 'Case Strategy Discussion', 'order', 5, 'duration_days', 1)
), JSON_ARRAY(
    'Signed Retainer Agreement',
    'Medical Records Release Forms',
    'Insurance Information',
    'Accident Report',
    'Photos of Incident/Injuries',
    'Employment Information'
), 1),
('Family Law Divorce Onboarding', 'Onboarding process for divorce clients', 'Family Law', JSON_ARRAY(
    JSON_OBJECT('name', 'Initial Client Meeting', 'order', 1, 'duration_days', 1),
    JSON_OBJECT('name', 'Financial Document Collection', 'order', 2, 'duration_days', 5),
    JSON_OBJECT('name', 'Child Custody Assessment', 'order', 3, 'duration_days', 3),
    JSON_OBJECT('name', 'Asset Inventory', 'order', 4, 'duration_days', 3),
    JSON_OBJECT('name', 'Strategy Planning', 'order', 5, 'duration_days', 2)
), JSON_ARRAY(
    'Signed Retainer Agreement',
    'Marriage Certificate',
    'Tax Returns (3 years)',
    'Bank Statements (6 months)',
    'Property Deeds',
    'Retirement Account Statements',
    'Child Information Forms'
), 1);

-- Default document templates
INSERT IGNORE INTO automated_document_templates (name, description, document_type, practice_area, template_format, merge_fields, auto_generate, created_by) VALUES
('Personal Injury Welcome Letter', 'Welcome letter for new PI clients', 'WELCOME_LETTER', 'Personal Injury', 'DOCX', JSON_OBJECT(
    'client_name', 'Client full name',
    'attorney_name', 'Assigned attorney name',
    'case_number', 'Generated case number',
    'incident_date', 'Date of incident',
    'firm_contact', 'Firm contact information'
), true, 1),
('Standard Retainer Agreement - PI', 'Standard retainer agreement for personal injury cases', 'RETAINER_AGREEMENT', 'Personal Injury', 'PDF', JSON_OBJECT(
    'client_name', 'Client full name',
    'attorney_name', 'Assigned attorney name',
    'case_description', 'Brief case description',
    'fee_percentage', 'Contingency fee percentage',
    'case_expenses', 'Expected case expenses'
), false, 1);

-- Default fee agreement templates
INSERT IGNORE INTO fee_agreement_templates (name, description, practice_area, fee_structure, default_terms, created_by) VALUES
('Personal Injury Contingency', 'Standard contingency fee agreement for PI cases', 'Personal Injury', 'CONTINGENCY', JSON_OBJECT(
    'contingency_percentage', 33.33,
    'settlement_percentage', 33.33,
    'trial_percentage', 40.00,
    'expense_responsibility', 'CLIENT',
    'minimum_fee', 0,
    'payment_terms', '30_DAYS'
), 1),
('Family Law Hourly', 'Standard hourly fee agreement for family law', 'Family Law', 'HOURLY', JSON_OBJECT(
    'attorney_hourly_rate', 350.00,
    'associate_hourly_rate', 250.00,
    'paralegal_hourly_rate', 125.00,
    'retainer_amount', 5000.00,
    'billing_increment', 0.1,
    'payment_terms', '15_DAYS'
), 1);

-- =====================================================
-- CREATE VIEWS FOR PHASE 2 REPORTING
-- =====================================================

-- Workflow performance overview
CREATE OR REPLACE VIEW v_workflow_performance_summary AS
SELECT 
    wpm.workflow_type,
    COUNT(DISTINCT wpm.workflow_id) as total_workflows,
    SUM(wpm.total_executions) as total_executions,
    SUM(wpm.successful_executions) as successful_executions,
    SUM(wpm.failed_executions) as failed_executions,
    ROUND(AVG(wpm.success_rate), 2) as average_success_rate,
    ROUND(AVG(wpm.average_execution_time_seconds), 2) as avg_execution_time_seconds,
    MAX(wpm.period_end) as latest_period
FROM workflow_performance_metrics wpm
WHERE wpm.period_start >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
GROUP BY wpm.workflow_type;

-- Active onboarding instances with progress
CREATE OR REPLACE VIEW v_active_onboarding_progress AS
SELECT 
    coi.id as onboarding_id,
    coi.client_id,
    CONCAT(u.first_name, ' ', u.last_name) as client_name,
    cot.name as template_name,
    cot.practice_area,
    coi.status,
    coi.current_stage,
    coi.progress_percentage,
    coi.started_at,
    coi.expected_completion_date,
    DATEDIFF(coi.expected_completion_date, CURRENT_DATE) as days_until_due,
    coordinator.first_name as coordinator_first_name,
    coordinator.last_name as coordinator_last_name,
    COUNT(ot.id) as total_tasks,
    COUNT(CASE WHEN ot.status = 'COMPLETED' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN ot.status = 'OVERDUE' THEN 1 END) as overdue_tasks
FROM client_onboarding_instances coi
JOIN client_onboarding_templates cot ON coi.template_id = cot.id
LEFT JOIN users u ON coi.client_id = u.id
LEFT JOIN users coordinator ON coi.assigned_coordinator_id = coordinator.id
LEFT JOIN onboarding_tasks ot ON coi.id = ot.onboarding_instance_id
WHERE coi.status IN ('STARTED', 'IN_PROGRESS')
GROUP BY coi.id, coi.client_id, u.first_name, u.last_name, cot.name, cot.practice_area,
         coi.status, coi.current_stage, coi.progress_percentage, coi.started_at,
         coi.expected_completion_date, coordinator.first_name, coordinator.last_name;

-- =====================================================
-- COMPLETION VERIFICATION
-- =====================================================

SELECT 
    'Phase 2 Database Migration Completed Successfully!' as Status,
    NOW() as Completed_At;

SELECT 
    'Case Creation Workflows' as Table_Name,
    COUNT(*) as Record_Count
FROM case_creation_workflows
UNION ALL
SELECT 
    'Onboarding Templates' as Table_Name,
    COUNT(*) as Record_Count
FROM client_onboarding_templates
UNION ALL
SELECT 
    'Document Templates' as Table_Name,
    COUNT(*) as Record_Count
FROM automated_document_templates
UNION ALL
SELECT 
    'Fee Agreement Templates' as Table_Name,
    COUNT(*) as Record_Count
FROM fee_agreement_templates;