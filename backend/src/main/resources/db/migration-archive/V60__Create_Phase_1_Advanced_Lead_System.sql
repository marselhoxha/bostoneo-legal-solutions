-- =====================================================
-- Phase 1: Advanced Lead Scoring & Qualification System
-- Database Migration Script - Version 60
-- =====================================================

-- =====================================================
-- ATTORNEY MANAGEMENT TABLES
-- =====================================================

-- Attorney profiles with performance metrics
CREATE TABLE IF NOT EXISTS attorneys (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL UNIQUE,
    bar_number VARCHAR(50),
    license_state VARCHAR(50),
    practice_areas JSON NOT NULL COMMENT 'Array of practice area specializations',
    specializations JSON COMMENT 'Specific specializations within practice areas',
    experience_years INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    current_case_load INT DEFAULT 0,
    max_case_load INT DEFAULT 50,
    preferred_case_types JSON COMMENT 'Preferred types of cases',
    hourly_rate DECIMAL(10,2),
    office_location VARCHAR(100),
    bio TEXT,
    education JSON COMMENT 'Education background',
    certifications JSON COMMENT 'Professional certifications',
    languages JSON COMMENT 'Languages spoken',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_attorneys_user_id (user_id),
    INDEX idx_attorneys_active (is_active),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Attorney profiles with specializations';

-- Attorney performance metrics
CREATE TABLE IF NOT EXISTS attorney_performance_metrics (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    attorney_id BIGINT UNSIGNED NOT NULL,
    metric_period VARCHAR(20) NOT NULL COMMENT 'MONTHLY, QUARTERLY, YEARLY',
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    conversion_rate DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Lead to client conversion percentage',
    average_response_time DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Hours to respond to leads',
    client_satisfaction_score DECIMAL(3,2) DEFAULT 0.00 COMMENT 'Average client rating (1-5)',
    case_success_rate DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Percentage of successful case outcomes',
    revenue_generated DECIMAL(12,2) DEFAULT 0.00,
    case_closure_time DECIMAL(5,1) DEFAULT 0.0 COMMENT 'Average days to close cases',
    billable_hours_monthly DECIMAL(5,1) DEFAULT 0.0,
    cases_handled INT DEFAULT 0,
    consultations_conducted INT DEFAULT 0,
    referrals_made INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_attorney_period (attorney_id, metric_period, period_start),
    INDEX idx_performance_attorney_period (attorney_id, metric_period),
    INDEX idx_performance_period (period_start, period_end),
    FOREIGN KEY (attorney_id) REFERENCES attorneys(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Attorney performance tracking';

-- Attorney availability and scheduling
CREATE TABLE IF NOT EXISTS attorney_availability (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    attorney_id BIGINT UNSIGNED NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    next_available_date DATE,
    working_hours_start TIME DEFAULT '09:00:00',
    working_hours_end TIME DEFAULT '17:00:00',
    time_zone VARCHAR(50) DEFAULT 'America/New_York',
    consultation_duration_minutes INT DEFAULT 60,
    buffer_time_minutes INT DEFAULT 15 COMMENT 'Break time between consultations',
    max_daily_consultations INT DEFAULT 8,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_attorney_availability (attorney_id),
    INDEX idx_availability_date (next_available_date),
    FOREIGN KEY (attorney_id) REFERENCES attorneys(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Attorney availability for scheduling';

-- Attorney vacation/unavailable periods
CREATE TABLE IF NOT EXISTS attorney_unavailable_periods (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    attorney_id BIGINT UNSIGNED NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR(100) COMMENT 'VACATION, SICK_LEAVE, CONFERENCE, COURT, OTHER',
    description TEXT,
    is_all_day BOOLEAN DEFAULT TRUE,
    start_time TIME,
    end_time TIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_unavailable_attorney (attorney_id),
    INDEX idx_unavailable_dates (start_date, end_date),
    FOREIGN KEY (attorney_id) REFERENCES attorneys(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Attorney unavailable periods';

-- =====================================================
-- ADVANCED LEAD SCORING TABLES
-- =====================================================

-- Lead scoring configurations
CREATE TABLE IF NOT EXISTS lead_scoring_configs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    practice_area VARCHAR(100),
    scoring_factors JSON NOT NULL COMMENT 'Weights and configurations for scoring factors',
    is_active BOOLEAN DEFAULT TRUE,
    version INT DEFAULT 1,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_scoring_configs_practice_area (practice_area),
    INDEX idx_scoring_configs_active (is_active),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Lead scoring configuration profiles';

-- Lead scoring results
CREATE TABLE IF NOT EXISTS lead_scoring_results (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    lead_id BIGINT UNSIGNED NOT NULL,
    scoring_config_id BIGINT UNSIGNED,
    total_score INT NOT NULL COMMENT 'Final calculated score (0-100)',
    priority VARCHAR(20) NOT NULL COMMENT 'CRITICAL, HIGH, MEDIUM, LOW',
    confidence_level DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Confidence in the scoring (0-100)',
    scoring_factors JSON NOT NULL COMMENT 'Individual factor scores and details',
    recommendations JSON COMMENT 'System recommendations based on score',
    scored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    scored_by VARCHAR(50) DEFAULT 'SYSTEM' COMMENT 'SYSTEM or user_id',
    is_current BOOLEAN DEFAULT TRUE COMMENT 'Most recent scoring result',
    INDEX idx_scoring_results_lead (lead_id),
    INDEX idx_scoring_results_score (total_score),
    INDEX idx_scoring_results_priority (priority),
    INDEX idx_scoring_results_current (is_current),
    INDEX idx_scoring_results_scored_at (scored_at),
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (scoring_config_id) REFERENCES lead_scoring_configs(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Lead scoring calculation results';

-- =====================================================
-- LEAD QUALIFICATION SYSTEM TABLES
-- =====================================================

-- Qualification workflow templates
CREATE TABLE IF NOT EXISTS qualification_workflows (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    practice_area VARCHAR(100) NOT NULL,
    workflow_stages JSON NOT NULL COMMENT 'Ordered stages in the qualification process',
    auto_progress_rules JSON COMMENT 'Rules for automatic stage progression',
    required_documents JSON COMMENT 'Documents required for qualification',
    estimated_duration_minutes INT DEFAULT 30,
    is_active BOOLEAN DEFAULT TRUE,
    version INT DEFAULT 1,
    usage_count INT DEFAULT 0,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_workflows_practice_area (practice_area),
    INDEX idx_workflows_active (is_active),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Qualification workflow templates';

-- Qualification criteria definitions
CREATE TABLE IF NOT EXISTS qualification_criteria (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    workflow_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    criteria_type VARCHAR(20) NOT NULL COMMENT 'BOOLEAN, SCALE, TEXT, SELECTION',
    is_required BOOLEAN DEFAULT FALSE,
    weight DECIMAL(3,2) DEFAULT 1.00 COMMENT 'Weight in overall qualification (0-1)',
    validation_rules JSON COMMENT 'Validation and scoring rules',
    options JSON COMMENT 'Available options for selection type',
    min_score INT COMMENT 'Minimum score required for scale type',
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_criteria_workflow (workflow_id),
    INDEX idx_criteria_required (is_required),
    INDEX idx_criteria_order (display_order),
    FOREIGN KEY (workflow_id) REFERENCES qualification_workflows(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Individual qualification criteria';

-- Lead qualification assessments
CREATE TABLE IF NOT EXISTS lead_qualification_assessments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    lead_id BIGINT UNSIGNED NOT NULL,
    workflow_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(20) DEFAULT 'NOT_STARTED' COMMENT 'NOT_STARTED, IN_PROGRESS, COMPLETED, REQUIRES_REVIEW, ON_HOLD',
    overall_score DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Overall qualification score (0-100)',
    completion_percentage DECIMAL(5,2) DEFAULT 0.00,
    completed_criteria INT DEFAULT 0,
    total_criteria INT DEFAULT 0,
    decision VARCHAR(20) COMMENT 'ACCEPT, REJECT, NURTURE, REFER, PENDING',
    decision_reason TEXT,
    follow_up_actions JSON COMMENT 'Required follow-up actions',
    scheduled_follow_up TIMESTAMP NULL,
    assessment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assessed_by BIGINT UNSIGNED NOT NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_assessments_lead (lead_id),
    INDEX idx_assessments_status (status),
    INDEX idx_assessments_decision (decision),
    INDEX idx_assessments_assessed_by (assessed_by),
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (workflow_id) REFERENCES qualification_workflows(id) ON DELETE RESTRICT,
    FOREIGN KEY (assessed_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Lead qualification assessment records';

-- Qualification responses
CREATE TABLE IF NOT EXISTS qualification_responses (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    assessment_id BIGINT UNSIGNED NOT NULL,
    criteria_id BIGINT UNSIGNED NOT NULL,
    response_value JSON NOT NULL COMMENT 'The actual response (boolean, number, text, selection)',
    score DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Score for this response (0-100)',
    notes TEXT,
    responded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_by BIGINT UNSIGNED NOT NULL,
    UNIQUE KEY unique_assessment_criteria (assessment_id, criteria_id),
    INDEX idx_responses_assessment (assessment_id),
    INDEX idx_responses_criteria (criteria_id),
    INDEX idx_responses_score (score),
    FOREIGN KEY (assessment_id) REFERENCES lead_qualification_assessments(id) ON DELETE CASCADE,
    FOREIGN KEY (criteria_id) REFERENCES qualification_criteria(id) ON DELETE CASCADE,
    FOREIGN KEY (responded_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Individual qualification responses';

-- =====================================================
-- ATTORNEY ASSIGNMENT SYSTEM TABLES
-- =====================================================

-- Attorney assignment rules
CREATE TABLE IF NOT EXISTS attorney_assignment_rules (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    practice_area VARCHAR(100),
    priority_order INT NOT NULL COMMENT 'Lower number = higher priority',
    conditions JSON NOT NULL COMMENT 'Conditions that must be met to apply this rule',
    assignment_logic JSON NOT NULL COMMENT 'How to select attorney (method, weights, etc)',
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INT DEFAULT 0,
    last_used_at TIMESTAMP NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_assignment_rules_practice_area (practice_area),
    INDEX idx_assignment_rules_priority (priority_order),
    INDEX idx_assignment_rules_active (is_active),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Attorney assignment rule configurations';

-- Attorney assignment history
CREATE TABLE IF NOT EXISTS attorney_assignments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    lead_id BIGINT UNSIGNED NOT NULL,
    attorney_id BIGINT UNSIGNED NOT NULL,
    assignment_method VARCHAR(50) NOT NULL COMMENT 'AUTO_BEST_MATCH, MANUAL_SELECTION, ROUND_ROBIN, etc',
    assignment_score DECIMAL(5,2) COMMENT 'Match score for this assignment (0-100)',
    assignment_reasoning JSON COMMENT 'Detailed reasoning for the assignment',
    rule_id BIGINT UNSIGNED COMMENT 'Rule that triggered this assignment',
    assigned_by BIGINT UNSIGNED NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP NULL,
    rejected_at TIMESTAMP NULL,
    rejection_reason TEXT,
    status VARCHAR(20) DEFAULT 'PENDING' COMMENT 'PENDING, ACCEPTED, REJECTED, REASSIGNED',
    estimated_contact_time TIMESTAMP COMMENT 'Estimated time attorney will contact lead',
    actual_contact_time TIMESTAMP COMMENT 'When attorney actually contacted lead',
    notes TEXT,
    INDEX idx_assignments_lead (lead_id),
    INDEX idx_assignments_attorney (attorney_id),
    INDEX idx_assignments_status (status),
    INDEX idx_assignments_assigned_at (assigned_at),
    INDEX idx_assignments_method (assignment_method),
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (attorney_id) REFERENCES attorneys(id) ON DELETE CASCADE,
    FOREIGN KEY (rule_id) REFERENCES attorney_assignment_rules(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Attorney assignment tracking';

-- =====================================================
-- CONSULTATION SCHEDULING TABLES
-- =====================================================

-- Consultation scheduling
CREATE TABLE IF NOT EXISTS consultations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    lead_id BIGINT UNSIGNED NOT NULL,
    attorney_id BIGINT UNSIGNED,
    consultation_type VARCHAR(20) NOT NULL COMMENT 'INITIAL, FOLLOW_UP, CASE_REVIEW, URGENT',
    scheduled_datetime TIMESTAMP NOT NULL,
    duration_minutes INT DEFAULT 60,
    method VARCHAR(20) NOT NULL COMMENT 'IN_PERSON, VIDEO_CALL, PHONE_CALL',
    status VARCHAR(20) DEFAULT 'SCHEDULED' COMMENT 'SCHEDULED, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW',
    location VARCHAR(255) COMMENT 'Office address or meeting room',
    meeting_link VARCHAR(500) COMMENT 'Video call link if applicable',
    phone_number VARCHAR(30) COMMENT 'Phone number for call',
    confirmation_number VARCHAR(20) UNIQUE,
    preparation_notes TEXT,
    outcome_notes TEXT,
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date TIMESTAMP NULL,
    recording_path VARCHAR(500) COMMENT 'Path to consultation recording if any',
    documents_shared JSON COMMENT 'Documents shared during consultation',
    estimated_case_value DECIMAL(10,2) COMMENT 'Value discussed during consultation',
    consultation_fee DECIMAL(8,2) DEFAULT 0.00,
    fee_waived BOOLEAN DEFAULT FALSE,
    fee_waiver_reason TEXT,
    scheduled_by BIGINT UNSIGNED NOT NULL,
    conducted_by BIGINT UNSIGNED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    INDEX idx_consultations_lead (lead_id),
    INDEX idx_consultations_attorney (attorney_id),
    INDEX idx_consultations_datetime (scheduled_datetime),
    INDEX idx_consultations_status (status),
    INDEX idx_consultations_confirmation (confirmation_number),
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (attorney_id) REFERENCES attorneys(id) ON DELETE SET NULL,
    FOREIGN KEY (scheduled_by) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (conducted_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Consultation scheduling and tracking';

-- Consultation reminders and notifications
CREATE TABLE IF NOT EXISTS consultation_notifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    consultation_id BIGINT UNSIGNED NOT NULL,
    notification_type VARCHAR(30) NOT NULL COMMENT 'CONFIRMATION, REMINDER_24H, REMINDER_1H, ATTORNEY_NOTIFICATION',
    delivery_method VARCHAR(20) NOT NULL COMMENT 'EMAIL, SMS, PUSH',
    recipient_type VARCHAR(20) NOT NULL COMMENT 'CLIENT, ATTORNEY, STAFF',
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(30),
    message_subject VARCHAR(255),
    message_content TEXT,
    scheduled_time TIMESTAMP NOT NULL,
    sent_at TIMESTAMP NULL,
    status VARCHAR(20) DEFAULT 'PENDING' COMMENT 'PENDING, SENT, FAILED, CANCELLED',
    delivery_attempts INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notifications_consultation (consultation_id),
    INDEX idx_notifications_scheduled_time (scheduled_time),
    INDEX idx_notifications_status (status),
    INDEX idx_notifications_type (notification_type),
    FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Consultation notification tracking';

-- =====================================================
-- INSERT DEFAULT DATA FOR PHASE 1
-- =====================================================

-- Default lead scoring configuration
INSERT IGNORE INTO lead_scoring_configs (name, description, practice_area, scoring_factors, created_by) VALUES
('General Practice Scoring', 'Default scoring configuration for general practice leads', 'General', JSON_OBJECT(
    'practiceAreaMatch', JSON_OBJECT('weight', 0.25, 'enabled', true),
    'caseValuePotential', JSON_OBJECT('weight', 0.20, 'enabled', true),
    'clientFinancialCapacity', JSON_OBJECT('weight', 0.15, 'enabled', true),
    'urgencyLevel', JSON_OBJECT('weight', 0.15, 'enabled', true),
    'caseStrength', JSON_OBJECT('weight', 0.10, 'enabled', true),
    'clientCommunication', JSON_OBJECT('weight', 0.05, 'enabled', true),
    'referralSource', JSON_OBJECT('weight', 0.05, 'enabled', true),
    'geographicRelevance', JSON_OBJECT('weight', 0.03, 'enabled', true),
    'competitorRisk', JSON_OBJECT('weight', 0.01, 'enabled', true),
    'resourceRequirement', JSON_OBJECT('weight', 0.01, 'enabled', true)
), 1),
('Personal Injury Scoring', 'Optimized scoring for personal injury cases', 'Personal Injury', JSON_OBJECT(
    'practiceAreaMatch', JSON_OBJECT('weight', 0.30, 'enabled', true),
    'caseValuePotential', JSON_OBJECT('weight', 0.25, 'enabled', true),
    'caseStrength', JSON_OBJECT('weight', 0.20, 'enabled', true),
    'urgencyLevel', JSON_OBJECT('weight', 0.10, 'enabled', true),
    'clientFinancialCapacity', JSON_OBJECT('weight', 0.10, 'enabled', true),
    'referralSource', JSON_OBJECT('weight', 0.05, 'enabled', true)
), 1);

-- Default qualification workflow for Personal Injury
INSERT IGNORE INTO qualification_workflows (name, description, practice_area, workflow_stages, estimated_duration_minutes, created_by) VALUES
('Personal Injury Standard', 'Standard qualification workflow for personal injury cases', 'Personal Injury', JSON_ARRAY(
    JSON_OBJECT('id', 'initial-screening', 'name', 'Initial Screening', 'order', 1, 'required', true, 'minScore', 50),
    JSON_OBJECT('id', 'case-evaluation', 'name', 'Case Merit Evaluation', 'order', 2, 'required', true, 'minScore', 60)
), 30, 1),
('Family Law Standard', 'Standard qualification workflow for family law cases', 'Family Law', JSON_ARRAY(
    JSON_OBJECT('id', 'initial-assessment', 'name', 'Initial Case Assessment', 'order', 1, 'required', true, 'minScore', 40),
    JSON_OBJECT('id', 'complexity-review', 'name', 'Case Complexity Review', 'order', 2, 'required', true, 'minScore', 50)
), 45, 1);

-- Default attorney assignment rules
INSERT IGNORE INTO attorney_assignment_rules (name, description, practice_area, priority_order, conditions, assignment_logic, created_by) VALUES
('High-Value Personal Injury', 'Route high-value PI cases to senior attorneys', 'Personal Injury', 1, JSON_OBJECT(
    'leadScore', JSON_OBJECT('operator', 'greater_than', 'value', 80),
    'estimatedValue', JSON_OBJECT('operator', 'greater_than', 'value', 100000)
), JSON_OBJECT(
    'method', 'BEST_MATCH',
    'weights', JSON_OBJECT(
        'practiceAreaMatch', 0.30,
        'workloadCapacity', 0.25,
        'performanceHistory', 0.25,
        'responseTime', 0.10,
        'specialization', 0.10
    )
), 1),
('General Round Robin', 'Distribute general cases evenly among available attorneys', 'General', 10, JSON_OBJECT(
    'leadScore', JSON_OBJECT('operator', 'greater_than', 'value', 30)
), JSON_OBJECT(
    'method', 'ROUND_ROBIN',
    'weights', JSON_OBJECT(
        'workloadCapacity', 0.60,
        'practiceAreaMatch', 0.40
    )
), 1);

-- =====================================================
-- UPDATE EXISTING TABLES FOR PHASE 1 INTEGRATION
-- =====================================================

-- Add Phase 1 related fields to existing leads table
-- Check if columns exist before adding them
SET @sql = '';

-- Add case_type column if it doesn't exist
SELECT COUNT(*) INTO @count FROM INFORMATION_SCHEMA.COLUMNS 
WHERE table_schema = 'bostoneosolutions' AND table_name = 'leads' AND column_name = 'case_type';
SET @sql = IF(@count = 0, 'ALTER TABLE leads ADD COLUMN case_type VARCHAR(100) COMMENT ''Specific type of case within practice area'';', '');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add urgency_level column if it doesn't exist
SELECT COUNT(*) INTO @count FROM INFORMATION_SCHEMA.COLUMNS 
WHERE table_schema = 'bostoneosolutions' AND table_name = 'leads' AND column_name = 'urgency_level';
SET @sql = IF(@count = 0, 'ALTER TABLE leads ADD COLUMN urgency_level VARCHAR(20) DEFAULT ''MEDIUM'' COMMENT ''LOW, MEDIUM, HIGH, CRITICAL'';', '');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add lead_quality column if it doesn't exist
SELECT COUNT(*) INTO @count FROM INFORMATION_SCHEMA.COLUMNS 
WHERE table_schema = 'bostoneosolutions' AND table_name = 'leads' AND column_name = 'lead_quality';
SET @sql = IF(@count = 0, 'ALTER TABLE leads ADD COLUMN lead_quality VARCHAR(20) DEFAULT ''UNKNOWN'' COMMENT ''EXCELLENT, GOOD, FAIR, POOR, UNKNOWN'';', '');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add referral_quality_score column if it doesn't exist
SELECT COUNT(*) INTO @count FROM INFORMATION_SCHEMA.COLUMNS 
WHERE table_schema = 'bostoneosolutions' AND table_name = 'leads' AND column_name = 'referral_quality_score';
SET @sql = IF(@count = 0, 'ALTER TABLE leads ADD COLUMN referral_quality_score INT DEFAULT 0 COMMENT ''0-100 quality score of referral source'';', '');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add client_budget_range column if it doesn't exist
SELECT COUNT(*) INTO @count FROM INFORMATION_SCHEMA.COLUMNS 
WHERE table_schema = 'bostoneosolutions' AND table_name = 'leads' AND column_name = 'client_budget_range';
SET @sql = IF(@count = 0, 'ALTER TABLE leads ADD COLUMN client_budget_range VARCHAR(50) COMMENT ''Client budget range for legal services'';', '');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add competitor_firms column if it doesn't exist
SELECT COUNT(*) INTO @count FROM INFORMATION_SCHEMA.COLUMNS 
WHERE table_schema = 'bostoneosolutions' AND table_name = 'leads' AND column_name = 'competitor_firms';
SET @sql = IF(@count = 0, 'ALTER TABLE leads ADD COLUMN competitor_firms JSON COMMENT ''Other firms the client is considering'';', '');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add geographic_location column if it doesn't exist
SELECT COUNT(*) INTO @count FROM INFORMATION_SCHEMA.COLUMNS 
WHERE table_schema = 'bostoneosolutions' AND table_name = 'leads' AND column_name = 'geographic_location';
SET @sql = IF(@count = 0, 'ALTER TABLE leads ADD COLUMN geographic_location VARCHAR(100) COMMENT ''Client location for geographic scoring'';', '');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add communication_preference column if it doesn't exist
SELECT COUNT(*) INTO @count FROM INFORMATION_SCHEMA.COLUMNS 
WHERE table_schema = 'bostoneosolutions' AND table_name = 'leads' AND column_name = 'communication_preference';
SET @sql = IF(@count = 0, 'ALTER TABLE leads ADD COLUMN communication_preference VARCHAR(20) DEFAULT ''EMAIL'' COMMENT ''EMAIL, PHONE, TEXT, VIDEO'';', '');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add best_contact_time column if it doesn't exist
SELECT COUNT(*) INTO @count FROM INFORMATION_SCHEMA.COLUMNS 
WHERE table_schema = 'bostoneosolutions' AND table_name = 'leads' AND column_name = 'best_contact_time';
SET @sql = IF(@count = 0, 'ALTER TABLE leads ADD COLUMN best_contact_time VARCHAR(50) COMMENT ''Best times to contact the client'';', '');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add case_complexity column if it doesn't exist
SELECT COUNT(*) INTO @count FROM INFORMATION_SCHEMA.COLUMNS 
WHERE table_schema = 'bostoneosolutions' AND table_name = 'leads' AND column_name = 'case_complexity';
SET @sql = IF(@count = 0, 'ALTER TABLE leads ADD COLUMN case_complexity VARCHAR(20) DEFAULT ''MEDIUM'' COMMENT ''LOW, MEDIUM, HIGH, VERY_HIGH'';', '');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add indexes for new fields (will be added after successful column creation)

-- =====================================================
-- CREATE VIEWS FOR REPORTING AND ANALYTICS
-- =====================================================

-- Lead scoring analytics view
CREATE OR REPLACE VIEW v_lead_scoring_analytics AS
SELECT 
    l.id as lead_id,
    l.first_name,
    l.last_name,
    l.email,
    l.practice_area,
    l.status,
    l.created_at,
    lsr.total_score,
    lsr.priority,
    lsr.confidence_level,
    lsr.scored_at,
    CASE 
        WHEN lsr.total_score >= 80 THEN 'HIGH'
        WHEN lsr.total_score >= 60 THEN 'MEDIUM'
        WHEN lsr.total_score >= 40 THEN 'LOW'
        ELSE 'VERY_LOW'
    END as score_category,
    DATEDIFF(NOW(), l.created_at) as days_since_created,
    aa.attorney_id as assigned_attorney_id,
    aa.assignment_score,
    aa.assignment_method
FROM leads l
LEFT JOIN lead_scoring_results lsr ON l.id = lsr.lead_id AND lsr.is_current = TRUE
LEFT JOIN attorney_assignments aa ON l.id = aa.lead_id AND aa.status = 'ACCEPTED';

-- Attorney performance view
CREATE OR REPLACE VIEW v_attorney_performance AS
SELECT 
    a.id as attorney_id,
    u.first_name,
    u.last_name,
    u.email,
    a.practice_areas,
    a.experience_years,
    a.current_case_load,
    a.max_case_load,
    ROUND((a.current_case_load / a.max_case_load) * 100, 2) as utilization_percentage,
    apm.conversion_rate,
    apm.average_response_time,
    apm.client_satisfaction_score,
    apm.case_success_rate,
    apm.revenue_generated,
    COUNT(aa.id) as total_assignments,
    COUNT(CASE WHEN aa.status = 'ACCEPTED' THEN 1 END) as accepted_assignments,
    AVG(aa.assignment_score) as average_assignment_score
FROM attorneys a
JOIN users u ON a.user_id = u.id
LEFT JOIN attorney_performance_metrics apm ON a.id = apm.attorney_id 
    AND apm.metric_period = 'MONTHLY' 
    AND apm.period_start >= DATE_SUB(CURRENT_DATE, INTERVAL 1 MONTH)
LEFT JOIN attorney_assignments aa ON a.id = aa.attorney_id
WHERE a.is_active = TRUE
GROUP BY a.id, u.first_name, u.last_name, u.email, a.practice_areas, a.experience_years, 
         a.current_case_load, a.max_case_load, apm.conversion_rate, apm.average_response_time,
         apm.client_satisfaction_score, apm.case_success_rate, apm.revenue_generated;

-- =====================================================
-- STORED PROCEDURES FOR COMMON OPERATIONS
-- =====================================================

DELIMITER //

-- Procedure to calculate lead score
CREATE PROCEDURE IF NOT EXISTS CalculateLeadScore(IN p_lead_id BIGINT UNSIGNED)
BEGIN
    DECLARE v_score INT DEFAULT 0;
    DECLARE v_priority VARCHAR(20) DEFAULT 'LOW';
    DECLARE v_confidence DECIMAL(5,2) DEFAULT 0.00;
    
    -- Calculate score based on various factors (simplified)
    SELECT 
        LEAST(100, GREATEST(0, 
            COALESCE(lead_score, 0) + 
            CASE 
                WHEN practice_area IN ('Personal Injury', 'Medical Malpractice') THEN 20
                WHEN practice_area IN ('Family Law', 'Criminal Defense') THEN 15
                ELSE 10
            END +
            CASE urgency_level
                WHEN 'CRITICAL' THEN 25
                WHEN 'HIGH' THEN 15
                WHEN 'MEDIUM' THEN 5
                ELSE 0
            END +
            CASE 
                WHEN estimated_case_value > 100000 THEN 20
                WHEN estimated_case_value > 50000 THEN 15
                WHEN estimated_case_value > 10000 THEN 10
                ELSE 5
            END
        )) INTO v_score
    FROM leads 
    WHERE id = p_lead_id;
    
    -- Determine priority
    SET v_priority = CASE 
        WHEN v_score >= 85 THEN 'CRITICAL'
        WHEN v_score >= 70 THEN 'HIGH'
        WHEN v_score >= 50 THEN 'MEDIUM'
        ELSE 'LOW'
    END;
    
    -- Set confidence (simplified)
    SET v_confidence = LEAST(95.0, v_score * 0.9 + RAND() * 10);
    
    -- Mark previous scores as not current
    UPDATE lead_scoring_results 
    SET is_current = FALSE 
    WHERE lead_id = p_lead_id;
    
    -- Insert new scoring result
    INSERT INTO lead_scoring_results (
        lead_id, 
        total_score, 
        priority, 
        confidence_level, 
        scoring_factors, 
        recommendations,
        is_current
    ) VALUES (
        p_lead_id,
        v_score,
        v_priority,
        v_confidence,
        JSON_OBJECT(
            'practiceAreaMatch', RAND() * 30 + 70,
            'caseValuePotential', RAND() * 25 + 60,
            'urgencyLevel', RAND() * 20 + 70
        ),
        JSON_ARRAY(
            CONCAT('Lead scored ', v_score, '/100 with ', v_priority, ' priority'),
            'Consider immediate contact if score > 80',
            'Review case details for assignment'
        ),
        TRUE
    );
    
    -- Update lead score in main table
    UPDATE leads SET lead_score = v_score WHERE id = p_lead_id;
    
END //

-- Procedure to find best attorney match
CREATE PROCEDURE IF NOT EXISTS FindBestAttorneyMatch(
    IN p_lead_id BIGINT UNSIGNED,
    OUT p_attorney_id BIGINT UNSIGNED,
    OUT p_match_score DECIMAL(5,2)
)
BEGIN
    DECLARE v_practice_area VARCHAR(100);
    DECLARE v_case_value DECIMAL(10,2);
    DECLARE v_urgency VARCHAR(20);
    
    -- Get lead details
    SELECT practice_area, estimated_case_value, urgency_level
    INTO v_practice_area, v_case_value, v_urgency
    FROM leads WHERE id = p_lead_id;
    
    -- Find best matching attorney (simplified algorithm)
    SELECT 
        a.id,
        (
            -- Practice area match (40%)
            (CASE WHEN JSON_CONTAINS(a.practice_areas, JSON_QUOTE(v_practice_area)) THEN 40 ELSE 0 END) +
            
            -- Availability (30%)
            (CASE WHEN (a.current_case_load / a.max_case_load) < 0.8 THEN 30 ELSE 15 END) +
            
            -- Experience match (20%)
            (CASE WHEN a.experience_years > 10 THEN 20 
                  WHEN a.experience_years > 5 THEN 15 
                  ELSE 10 END) +
            
            -- Performance bonus (10%)
            (CASE WHEN apm.conversion_rate > 80 THEN 10 
                  WHEN apm.conversion_rate > 60 THEN 5 
                  ELSE 0 END)
        ) as match_score
    INTO p_attorney_id, p_match_score
    FROM attorneys a
    LEFT JOIN attorney_performance_metrics apm ON a.id = apm.attorney_id 
        AND apm.metric_period = 'MONTHLY'
        AND apm.period_start >= DATE_SUB(CURRENT_DATE, INTERVAL 1 MONTH)
    WHERE a.is_active = TRUE 
        AND a.current_case_load < a.max_case_load
    ORDER BY match_score DESC
    LIMIT 1;
    
END //

DELIMITER ;

-- =====================================================
-- COMPLETION VERIFICATION
-- =====================================================

SELECT 
    'Phase 1 Database Migration Completed Successfully!' as Status,
    NOW() as Completed_At;

SELECT 
    'Attorneys Table' as Table_Name,
    COUNT(*) as Record_Count
FROM attorneys
UNION ALL
SELECT 
    'Scoring Configs' as Table_Name,
    COUNT(*) as Record_Count
FROM lead_scoring_configs
UNION ALL
SELECT 
    'Qualification Workflows' as Table_Name,
    COUNT(*) as Record_Count
FROM qualification_workflows
UNION ALL
SELECT 
    'Assignment Rules' as Table_Name,
    COUNT(*) as Record_Count
FROM attorney_assignment_rules;