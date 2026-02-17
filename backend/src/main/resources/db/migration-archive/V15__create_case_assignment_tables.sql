-- Create case_assignments table if not exists
CREATE TABLE IF NOT EXISTS case_assignments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    case_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role_type VARCHAR(50) NOT NULL,
    assignment_type VARCHAR(50) NOT NULL,
    assigned_by BIGINT,
    assigned_at TIMESTAMP NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    active BOOLEAN DEFAULT TRUE,
    workload_weight DECIMAL(5,2) DEFAULT 1.00,
    expertise_match_score DECIMAL(5,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES legal_cases(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (assigned_by) REFERENCES users(id),
    INDEX idx_case_user (case_id, user_id),
    INDEX idx_user_active (user_id, active),
    INDEX idx_effective_dates (effective_from, effective_to)
);

-- Create user_workload table if not exists
CREATE TABLE IF NOT EXISTS user_workload (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL UNIQUE,
    calculation_date DATE NOT NULL,
    active_cases INT DEFAULT 0,
    total_workload_points DECIMAL(10,2) DEFAULT 0.00,
    capacity_percentage DECIMAL(5,2) DEFAULT 0.00,
    high_priority_cases INT DEFAULT 0,
    urgent_cases INT DEFAULT 0,
    overdue_tasks INT DEFAULT 0,
    upcoming_hearings INT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_capacity (capacity_percentage),
    INDEX idx_calculation_date (calculation_date)
);

-- Create attorney_expertise table if not exists
CREATE TABLE IF NOT EXISTS attorney_expertise (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    expertise_area VARCHAR(100) NOT NULL,
    proficiency_level VARCHAR(50) NOT NULL,
    years_experience INT DEFAULT 0,
    cases_handled INT DEFAULT 0,
    success_rate DECIMAL(5,2),
    certifications TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE KEY unique_user_expertise (user_id, expertise_area),
    INDEX idx_expertise_area (expertise_area),
    INDEX idx_proficiency (proficiency_level)
);

-- Create case_assignment_history table if not exists
CREATE TABLE IF NOT EXISTS case_assignment_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    case_assignment_id BIGINT NOT NULL,
    action VARCHAR(50) NOT NULL,
    action_details TEXT,
    performed_by BIGINT NOT NULL,
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    old_values JSON,
    new_values JSON,
    FOREIGN KEY (case_assignment_id) REFERENCES case_assignments(id),
    FOREIGN KEY (performed_by) REFERENCES users(id),
    INDEX idx_assignment_history (case_assignment_id),
    INDEX idx_performed_at (performed_at)
);

-- Create assignment_rules table if not exists
CREATE TABLE IF NOT EXISTS assignment_rules (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    rule_name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(50) NOT NULL,
    case_type VARCHAR(100),
    expertise_required VARCHAR(100),
    priority_order INT DEFAULT 1,
    max_workload_percentage DECIMAL(5,2) DEFAULT 80.00,
    min_expertise_score DECIMAL(5,2) DEFAULT 70.00,
    prefer_previous_attorney BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_rule_type (rule_type),
    INDEX idx_active_priority (is_active, priority_order)
);

-- Create case_transfer_requests table if not exists
CREATE TABLE IF NOT EXISTS case_transfer_requests (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    case_id BIGINT NOT NULL,
    from_user_id BIGINT NOT NULL,
    to_user_id BIGINT,
    requested_by BIGINT NOT NULL,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason TEXT NOT NULL,
    urgency VARCHAR(50) DEFAULT 'MEDIUM',
    status VARCHAR(50) DEFAULT 'PENDING',
    reviewed_by BIGINT,
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    FOREIGN KEY (case_id) REFERENCES legal_cases(id),
    FOREIGN KEY (from_user_id) REFERENCES users(id),
    FOREIGN KEY (to_user_id) REFERENCES users(id),
    FOREIGN KEY (requested_by) REFERENCES users(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id),
    INDEX idx_status_urgency (status, urgency),
    INDEX idx_requested_at (requested_at)
);

-- Create view for user workload summary
CREATE OR REPLACE VIEW v_user_workload_summary AS
SELECT 
    u.id as user_id,
    u.first_name,
    u.last_name,
    u.email,
    COALESCE(uw.active_cases, 0) as active_cases,
    COALESCE(uw.total_workload_points, 0) as total_workload_points,
    COALESCE(uw.capacity_percentage, 0) as capacity_percentage,
    COALESCE(uw.high_priority_cases, 0) as high_priority_cases,
    COALESCE(uw.urgent_cases, 0) as urgent_cases,
    COALESCE(uw.overdue_tasks, 0) as overdue_tasks,
    COALESCE(uw.upcoming_hearings, 0) as upcoming_hearings,
    uw.last_updated
FROM users u
LEFT JOIN user_workload uw ON u.id = uw.user_id
WHERE u.enabled = true AND u.non_locked = true;