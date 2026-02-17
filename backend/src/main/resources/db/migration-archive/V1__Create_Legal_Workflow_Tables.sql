-- Legal File Manager Database Schema
-- Migration V1: Create all tables for legal workflow features

-- Document Templates Table
CREATE TABLE document_templates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category ENUM('MOTION', 'BRIEF', 'PLEADING', 'CONTRACT', 'CORRESPONDENCE', 'DISCOVERY', 'SETTLEMENT', 'COURT_FILING', 'INTERNAL_MEMO', 'CLIENT_ADVICE', 'RESEARCH_MEMO', 'OPINION_LETTER') NOT NULL,
    practice_area VARCHAR(100),
    jurisdiction VARCHAR(100),
    template_content LONGTEXT,
    fields JSON,
    is_active BOOLEAN DEFAULT TRUE,
    is_public BOOLEAN DEFAULT FALSE,
    firm_id BIGINT,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_category (category),
    INDEX idx_practice_area (practice_area),
    INDEX idx_jurisdiction (jurisdiction),
    INDEX idx_firm_id (firm_id),
    INDEX idx_created_by (created_by)
);

-- Approval Workflows Table
CREATE TABLE approval_workflows (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    workflow_type ENUM('DOCUMENT_REVIEW', 'COURT_FILING', 'CLIENT_COMMUNICATION', 'SETTLEMENT_APPROVAL', 'BUDGET_APPROVAL') NOT NULL,
    practice_area VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    firm_id BIGINT,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_workflow_type (workflow_type),
    INDEX idx_practice_area (practice_area),
    INDEX idx_firm_id (firm_id)
);

-- Workflow Steps Table
CREATE TABLE workflow_steps (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workflow_id BIGINT NOT NULL,
    step_order INT NOT NULL,
    step_name VARCHAR(255) NOT NULL,
    step_type ENUM('REVIEW', 'APPROVAL', 'NOTIFICATION', 'ROUTING', 'FORMATTING') NOT NULL,
    role_required VARCHAR(100),
    user_id BIGINT,
    is_required BOOLEAN DEFAULT TRUE,
    auto_approve BOOLEAN DEFAULT FALSE,
    timeout_hours INT DEFAULT 24,
    
    FOREIGN KEY (workflow_id) REFERENCES approval_workflows(id) ON DELETE CASCADE,
    INDEX idx_workflow_id (workflow_id),
    INDEX idx_step_order (step_order),
    INDEX idx_role_required (role_required)
);

-- Document Workflow Instances Table
CREATE TABLE document_workflow_instances (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    document_id BIGINT NOT NULL,
    workflow_id BIGINT NOT NULL,
    current_step_id BIGINT,
    status ENUM('PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED') DEFAULT 'PENDING',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    
    FOREIGN KEY (workflow_id) REFERENCES approval_workflows(id),
    FOREIGN KEY (current_step_id) REFERENCES workflow_steps(id),
    INDEX idx_document_id (document_id),
    INDEX idx_workflow_id (workflow_id),
    INDEX idx_status (status)
);

-- Workflow Step Executions Table
CREATE TABLE workflow_step_executions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    instance_id BIGINT NOT NULL,
    step_id BIGINT NOT NULL,
    assignee_id BIGINT,
    status ENUM('PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'SKIPPED') DEFAULT 'PENDING',
    comments TEXT,
    executed_at TIMESTAMP NULL,
    due_date TIMESTAMP NULL,
    
    FOREIGN KEY (instance_id) REFERENCES document_workflow_instances(id) ON DELETE CASCADE,
    FOREIGN KEY (step_id) REFERENCES workflow_steps(id),
    INDEX idx_instance_id (instance_id),
    INDEX idx_assignee_id (assignee_id),
    INDEX idx_status (status)
);

-- Document Deadlines Table
CREATE TABLE document_deadlines (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    document_id BIGINT NOT NULL,
    case_id BIGINT,
    deadline_type ENUM('COURT_FILING', 'DISCOVERY', 'MOTION', 'BRIEF', 'RESPONSE', 'HEARING', 'TRIAL', 'APPEAL', 'INTERNAL_REVIEW', 'CLIENT_REVIEW') NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date TIMESTAMP NOT NULL,
    priority ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') DEFAULT 'MEDIUM',
    is_court_imposed BOOLEAN DEFAULT FALSE,
    court_rule_reference VARCHAR(255),
    status ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED') DEFAULT 'PENDING',
    assigned_to BIGINT,
    reminder_sent BOOLEAN DEFAULT FALSE,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_document_id (document_id),
    INDEX idx_case_id (case_id),
    INDEX idx_deadline_type (deadline_type),
    INDEX idx_due_date (due_date),
    INDEX idx_priority (priority),
    INDEX idx_status (status),
    INDEX idx_assigned_to (assigned_to)
);

-- Document Routing Table
CREATE TABLE document_routing (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    document_id BIGINT NOT NULL,
    routing_type ENUM('PARTNER_REVIEW', 'PARALEGAL_FORMATTING', 'CLIENT_REVIEW', 'OPPOSING_COUNSEL', 'COURT_FILING', 'ARCHIVE') NOT NULL,
    from_user_id BIGINT,
    to_user_id BIGINT,
    to_role VARCHAR(100),
    routing_reason TEXT,
    instructions TEXT,
    priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') DEFAULT 'MEDIUM',
    status ENUM('PENDING', 'RECEIVED', 'IN_PROGRESS', 'COMPLETED', 'RETURNED') DEFAULT 'PENDING',
    routed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    received_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    response TEXT,
    
    INDEX idx_document_id (document_id),
    INDEX idx_routing_type (routing_type),
    INDEX idx_to_user_id (to_user_id),
    INDEX idx_status (status)
);

-- Legal Folder Templates Table
CREATE TABLE legal_folder_templates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    practice_area VARCHAR(100) NOT NULL,
    case_type VARCHAR(100),
    folder_structure JSON NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    firm_id BIGINT,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_practice_area (practice_area),
    INDEX idx_case_type (case_type),
    INDEX idx_firm_id (firm_id)
);

-- Matter Phases Table
CREATE TABLE matter_phases (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT NOT NULL,
    phase_type ENUM('INTAKE', 'DISCOVERY', 'MOTION_PRACTICE', 'MEDIATION', 'TRIAL_PREP', 'TRIAL', 'APPEAL', 'SETTLEMENT', 'CLOSING') NOT NULL,
    phase_name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE,
    target_end_date DATE,
    actual_end_date DATE,
    status ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED') DEFAULT 'NOT_STARTED',
    progress_percentage DECIMAL(5,2) DEFAULT 0.00,
    budget_allocated DECIMAL(15,2),
    budget_spent DECIMAL(15,2) DEFAULT 0.00,
    key_tasks JSON,
    milestones JSON,
    team_members JSON,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_case_id (case_id),
    INDEX idx_phase_type (phase_type),
    INDEX idx_status (status),
    INDEX idx_start_date (start_date)
);

-- Chronological Index Table
CREATE TABLE chronological_index (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT NOT NULL,
    document_id BIGINT,
    event_type ENUM('PLEADING', 'MOTION', 'ORDER', 'HEARING', 'DEPOSITION', 'DISCOVERY', 'CORRESPONDENCE', 'SETTLEMENT', 'FILING', 'MEETING', 'CALL', 'EMAIL') NOT NULL,
    event_date DATE NOT NULL,
    event_time TIME,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    participants JSON,
    location VARCHAR(255),
    importance ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') DEFAULT 'MEDIUM',
    category VARCHAR(100),
    outcome TEXT,
    next_steps TEXT,
    is_milestone BOOLEAN DEFAULT FALSE,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_case_id (case_id),
    INDEX idx_document_id (document_id),
    INDEX idx_event_type (event_type),
    INDEX idx_event_date (event_date),
    INDEX idx_importance (importance)
);

-- Court Filing System Table
CREATE TABLE court_filing_systems (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    jurisdiction VARCHAR(100) NOT NULL,
    court_name VARCHAR(255) NOT NULL,
    system_type ENUM('FEDERAL', 'STATE', 'LOCAL') NOT NULL,
    api_endpoint VARCHAR(500),
    authentication_method ENUM('API_KEY', 'OAUTH', 'CERTIFICATE', 'USERNAME_PASSWORD') NOT NULL,
    configuration JSON,
    is_active BOOLEAN DEFAULT TRUE,
    supported_document_types JSON,
    filing_fees_structure JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_jurisdiction (jurisdiction),
    INDEX idx_court_name (court_name),
    INDEX idx_system_type (system_type)
);

-- Court Filings Table
CREATE TABLE court_filings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT NOT NULL,
    document_id BIGINT NOT NULL,
    court_system_id BIGINT NOT NULL,
    filing_type VARCHAR(100) NOT NULL,
    filing_title VARCHAR(255) NOT NULL,
    docket_number VARCHAR(100),
    filing_date DATE,
    filing_time TIME,
    status ENUM('DRAFT', 'PENDING_REVIEW', 'READY_TO_FILE', 'FILED', 'ACCEPTED', 'REJECTED', 'ERROR') DEFAULT 'DRAFT',
    confirmation_number VARCHAR(100),
    receipt_url VARCHAR(500),
    filing_fees DECIMAL(10,2),
    payment_status ENUM('PENDING', 'PAID', 'FAILED', 'WAIVED') DEFAULT 'PENDING',
    error_message TEXT,
    filed_by BIGINT,
    filed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (court_system_id) REFERENCES court_filing_systems(id),
    INDEX idx_case_id (case_id),
    INDEX idx_document_id (document_id),
    INDEX idx_status (status),
    INDEX idx_filing_date (filing_date)
);

-- Template Library Table
CREATE TABLE template_library (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category ENUM('MOTION', 'BRIEF', 'PLEADING', 'CONTRACT', 'CORRESPONDENCE', 'DISCOVERY', 'SETTLEMENT', 'COURT_FILING', 'INTERNAL_MEMO', 'CLIENT_ADVICE', 'RESEARCH_MEMO', 'OPINION_LETTER') NOT NULL,
    practice_area VARCHAR(100),
    jurisdiction VARCHAR(100),
    document_type VARCHAR(100),
    template_content LONGTEXT,
    dynamic_fields JSON,
    usage_count INT DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    is_public BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT FALSE,
    firm_id BIGINT,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_category (category),
    INDEX idx_practice_area (practice_area),
    INDEX idx_jurisdiction (jurisdiction),
    INDEX idx_usage_count (usage_count),
    INDEX idx_success_rate (success_rate)
);

-- Template Usage Analytics Table
CREATE TABLE template_usage_analytics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    template_id BIGINT NOT NULL,
    used_by BIGINT NOT NULL,
    case_id BIGINT,
    document_id BIGINT,
    outcome ENUM('SUCCESSFUL', 'UNSUCCESSFUL', 'PENDING', 'UNKNOWN') DEFAULT 'PENDING',
    outcome_details TEXT,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (template_id) REFERENCES template_library(id) ON DELETE CASCADE,
    INDEX idx_template_id (template_id),
    INDEX idx_used_by (used_by),
    INDEX idx_outcome (outcome),
    INDEX idx_rating (rating)
);

-- Precedent Documents Table
CREATE TABLE precedent_documents (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    document_id BIGINT NOT NULL,
    precedent_id VARCHAR(100) UNIQUE NOT NULL,
    case_outcome ENUM('WON', 'LOST', 'SETTLED', 'DISMISSED', 'PENDING') NOT NULL,
    outcome_details TEXT,
    financial_result DECIMAL(15,2),
    time_to_resolution INT, -- days
    client_satisfaction INT CHECK (client_satisfaction >= 1 AND client_satisfaction <= 5),
    legal_issues JSON NOT NULL,
    jurisdiction VARCHAR(100) NOT NULL,
    court VARCHAR(255) NOT NULL,
    judge VARCHAR(255),
    opposing_counsel VARCHAR(255),
    case_type VARCHAR(100) NOT NULL,
    practice_area VARCHAR(100) NOT NULL,
    document_type ENUM('MOTION', 'BRIEF', 'PLEADING', 'CONTRACT', 'CORRESPONDENCE', 'DISCOVERY', 'SETTLEMENT', 'COURT_FILING', 'INTERNAL_MEMO', 'CLIENT_ADVICE', 'RESEARCH_MEMO', 'OPINION_LETTER') NOT NULL,
    filing_date DATE,
    outcome_date DATE,
    key_arguments JSON,
    document_strategy TEXT,
    lessons_learned TEXT,
    usage_count INT DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    is_public BOOLEAN DEFAULT FALSE,
    firm_id BIGINT,
    added_by BIGINT NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP NULL,
    related_cases JSON,
    
    INDEX idx_document_id (document_id),
    INDEX idx_case_outcome (case_outcome),
    INDEX idx_jurisdiction (jurisdiction),
    INDEX idx_practice_area (practice_area),
    INDEX idx_document_type (document_type),
    INDEX idx_success_rate (success_rate),
    INDEX idx_usage_count (usage_count)
);

-- Success Metrics Table
CREATE TABLE success_metrics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    precedent_id BIGINT NOT NULL,
    effectiveness INT CHECK (effectiveness >= 1 AND effectiveness <= 10) NOT NULL,
    reusability INT CHECK (reusability >= 1 AND reusability <= 10) NOT NULL,
    complexity INT CHECK (complexity >= 1 AND complexity <= 10) NOT NULL,
    time_investment DECIMAL(8,2) NOT NULL, -- hours
    outcome_value DECIMAL(15,2) DEFAULT 0.00,
    precedent_value INT CHECK (precedent_value >= 1 AND precedent_value <= 10) NOT NULL,
    
    FOREIGN KEY (precedent_id) REFERENCES precedent_documents(id) ON DELETE CASCADE,
    INDEX idx_precedent_id (precedent_id),
    INDEX idx_effectiveness (effectiveness),
    INDEX idx_precedent_value (precedent_value)
);

-- Legal Citations Table
CREATE TABLE legal_citations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    precedent_id BIGINT NOT NULL,
    citation VARCHAR(500) NOT NULL,
    relevance ENUM('PRIMARY', 'SECONDARY', 'SUPPORTING') NOT NULL,
    description TEXT,
    
    FOREIGN KEY (precedent_id) REFERENCES precedent_documents(id) ON DELETE CASCADE,
    INDEX idx_precedent_id (precedent_id),
    INDEX idx_relevance (relevance)
);

-- Precedent Similarities Table
CREATE TABLE precedent_similarities (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    precedent_id BIGINT NOT NULL,
    similar_document_id BIGINT NOT NULL,
    similarity_score DECIMAL(5,2) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 100),
    similarity_factors JSON,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (precedent_id) REFERENCES precedent_documents(id) ON DELETE CASCADE,
    INDEX idx_precedent_id (precedent_id),
    INDEX idx_similarity_score (similarity_score)
);

-- Document Annotations Table
CREATE TABLE document_annotations (
    id VARCHAR(100) PRIMARY KEY,
    document_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    annotation_type ENUM('NOTE', 'QUESTION', 'WARNING', 'SUCCESS_TIP', 'LEGAL_INSIGHT', 'STRATEGY', 'CITATION', 'IMPROVEMENT') NOT NULL,
    content TEXT NOT NULL,
    category ENUM('LEGAL_ANALYSIS', 'STRATEGY_NOTES', 'PROCEDURAL_TIPS', 'CASE_LAW', 'BEST_PRACTICES', 'LESSONS_LEARNED', 'CLIENT_FEEDBACK', 'COURT_PREFERENCES') NOT NULL,
    tags JSON,
    is_public BOOLEAN DEFAULT FALSE,
    position_data JSON, -- page, offset, coordinates, selected text
    precedent_value INT CHECK (precedent_value >= 1 AND precedent_value <= 10) DEFAULT 5,
    strategic_importance INT CHECK (strategic_importance >= 1 AND strategic_importance <= 10) DEFAULT 5,
    likes INT DEFAULT 0,
    dislikes INT DEFAULT 0,
    related_cases JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_document_id (document_id),
    INDEX idx_user_id (user_id),
    INDEX idx_annotation_type (annotation_type),
    INDEX idx_category (category),
    INDEX idx_is_public (is_public),
    INDEX idx_precedent_value (precedent_value)
);

-- Annotation Replies Table
CREATE TABLE annotation_replies (
    id VARCHAR(100) PRIMARY KEY,
    annotation_id VARCHAR(100) NOT NULL,
    user_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    likes INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (annotation_id) REFERENCES document_annotations(id) ON DELETE CASCADE,
    INDEX idx_annotation_id (annotation_id),
    INDEX idx_user_id (user_id)
);

-- Annotation Reactions Table
CREATE TABLE annotation_reactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    annotation_id VARCHAR(100) NOT NULL,
    user_id BIGINT NOT NULL,
    reaction_type ENUM('LIKE', 'DISLIKE') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (annotation_id) REFERENCES document_annotations(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_annotation_reaction (annotation_id, user_id),
    INDEX idx_annotation_id (annotation_id),
    INDEX idx_user_id (user_id)
);

-- Knowledge Insights Table
CREATE TABLE knowledge_insights (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    related_documents JSON,
    supporting_annotations JSON,
    confidence INT CHECK (confidence >= 0 AND confidence <= 100) NOT NULL,
    impact ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL,
    is_actionable BOOLEAN DEFAULT FALSE,
    recommendations JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_category (category),
    INDEX idx_confidence (confidence),
    INDEX idx_impact (impact)
);

-- Document Versions Table
CREATE TABLE document_versions (
    id VARCHAR(100) PRIMARY KEY,
    document_id BIGINT NOT NULL,
    version_number VARCHAR(20) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    changes_summary TEXT,
    is_current_version BOOLEAN DEFAULT FALSE,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_document_id (document_id),
    INDEX idx_version_number (version_number),
    INDEX idx_is_current_version (is_current_version)
);

-- Document Comparisons Table
CREATE TABLE document_comparisons (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    document_a_id VARCHAR(100),
    document_b_id VARCHAR(100),
    document_id_a BIGINT, -- for document-to-document comparison
    document_id_b BIGINT, -- for document-to-document comparison
    analysis_type ENUM('CONTENT', 'STRUCTURAL', 'METADATA', 'COMPREHENSIVE') NOT NULL,
    similarity_percentage DECIMAL(5,2) NOT NULL,
    total_changes INT NOT NULL,
    additions_count INT NOT NULL,
    deletions_count INT NOT NULL,
    modifications_count INT NOT NULL,
    formatting_changes INT NOT NULL,
    metadata_changes INT NOT NULL,
    critical_changes INT NOT NULL,
    major_changes INT NOT NULL,
    minor_changes INT NOT NULL,
    cosmetic_changes INT NOT NULL,
    overall_impact ENUM('HIGH', 'MEDIUM', 'LOW') NOT NULL,
    risk_assessment TEXT,
    comparison_settings JSON,
    performed_by BIGINT NOT NULL,
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_document_a_id (document_a_id),
    INDEX idx_document_b_id (document_b_id),
    INDEX idx_document_id_a (document_id_a),
    INDEX idx_document_id_b (document_id_b),
    INDEX idx_performed_at (performed_at)
);

-- Document Differences Table
CREATE TABLE document_differences (
    id VARCHAR(100) PRIMARY KEY,
    comparison_id BIGINT NOT NULL,
    difference_type ENUM('ADDITION', 'DELETION', 'MODIFICATION', 'FORMATTING', 'METADATA') NOT NULL,
    section VARCHAR(255),
    line_number INT,
    page_number INT,
    original_text TEXT,
    new_text TEXT,
    significance ENUM('CRITICAL', 'MAJOR', 'MINOR', 'COSMETIC') NOT NULL,
    description TEXT NOT NULL,
    impact TEXT NOT NULL,
    legal_implications TEXT,
    
    FOREIGN KEY (comparison_id) REFERENCES document_comparisons(id) ON DELETE CASCADE,
    INDEX idx_comparison_id (comparison_id),
    INDEX idx_difference_type (difference_type),
    INDEX idx_significance (significance)
);

-- Practice Areas Table
CREATE TABLE practice_areas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jurisdictions Table
CREATE TABLE jurisdictions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    jurisdiction_type ENUM('FEDERAL', 'STATE', 'LOCAL') NOT NULL,
    parent_jurisdiction_id BIGINT,
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (parent_jurisdiction_id) REFERENCES jurisdictions(id),
    INDEX idx_jurisdiction_type (jurisdiction_type)
);

-- Courts Table
CREATE TABLE courts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    jurisdiction_id BIGINT NOT NULL,
    court_type ENUM('FEDERAL_DISTRICT', 'FEDERAL_APPEALS', 'FEDERAL_SUPREME', 'STATE_TRIAL', 'STATE_APPEALS', 'STATE_SUPREME', 'LOCAL') NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    website VARCHAR(255),
    e_filing_system_id BIGINT,
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (jurisdiction_id) REFERENCES jurisdictions(id),
    FOREIGN KEY (e_filing_system_id) REFERENCES court_filing_systems(id),
    INDEX idx_jurisdiction_id (jurisdiction_id),
    INDEX idx_court_type (court_type)
);

-- Insert default data
INSERT INTO practice_areas (name, description) VALUES
('Litigation', 'Civil and commercial litigation matters'),
('Corporate Law', 'Business formation, contracts, and corporate governance'),
('Real Estate', 'Property transactions, leasing, and real estate disputes'),
('Employment Law', 'Workplace issues, discrimination, and labor relations'),
('Family Law', 'Divorce, custody, and domestic relations'),
('Criminal Defense', 'Criminal proceedings and defense matters'),
('Immigration', 'Immigration and naturalization law'),
('Intellectual Property', 'Patents, trademarks, and copyright matters'),
('Tax Law', 'Tax planning, compliance, and disputes'),
('Estate Planning', 'Wills, trusts, and estate administration');

INSERT INTO jurisdictions (name, jurisdiction_type) VALUES
('Federal', 'FEDERAL'),
('California', 'STATE'),
('New York', 'STATE'),
('Texas', 'STATE'),
('Florida', 'STATE');

INSERT INTO courts (name, jurisdiction_id, court_type) VALUES
('U.S. District Court for the Northern District of California', 2, 'FEDERAL_DISTRICT'),
('U.S. Court of Appeals for the Ninth Circuit', 1, 'FEDERAL_APPEALS'),
('Supreme Court of California', 2, 'STATE_SUPREME'),
('Superior Court of California, County of San Francisco', 2, 'STATE_TRIAL'),
('U.S. District Court for the Southern District of New York', 3, 'FEDERAL_DISTRICT');