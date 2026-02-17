-- Case Assignment & Task Management System Schema
-- Migration V52: Create comprehensive case assignment and task management tables

-- 1. Case Assignments (Enhanced from case_role_assignments)
CREATE TABLE case_assignments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    role_type ENUM('LEAD_ATTORNEY', 'SUPPORTING_ATTORNEY', 'PARALEGAL', 'SECRETARY') NOT NULL,
    assignment_type ENUM('MANUAL', 'AUTO_ASSIGNED', 'TRANSFERRED') DEFAULT 'MANUAL',
    assigned_by BIGINT UNSIGNED,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN DEFAULT TRUE,
    workload_weight DECIMAL(5,2) DEFAULT 1.00,
    expertise_match_score DECIMAL(5,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (case_id) REFERENCES legal_cases(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (assigned_by) REFERENCES users(id),
    
    INDEX idx_case_user (case_id, user_id),
    INDEX idx_user_active (user_id, is_active),
    INDEX idx_effective_dates (effective_from, effective_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Case Assignment History
CREATE TABLE case_assignment_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_assignment_id BIGINT NOT NULL,
    case_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    action ENUM('CREATED', 'TRANSFERRED', 'MODIFIED', 'DEACTIVATED') NOT NULL,
    previous_user_id BIGINT UNSIGNED,
    new_user_id BIGINT UNSIGNED,
    reason TEXT,
    performed_by BIGINT UNSIGNED NOT NULL,
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON,
    
    FOREIGN KEY (case_assignment_id) REFERENCES case_assignments(id),
    FOREIGN KEY (case_id) REFERENCES legal_cases(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (performed_by) REFERENCES users(id),
    FOREIGN KEY (previous_user_id) REFERENCES users(id),
    FOREIGN KEY (new_user_id) REFERENCES users(id),
    
    INDEX idx_case_history (case_id, performed_at),
    INDEX idx_user_history (user_id, performed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Attorney Expertise
CREATE TABLE attorney_expertise (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    expertise_area ENUM('CORPORATE', 'CRIMINAL', 'FAMILY', 'INTELLECTUAL_PROPERTY', 
                       'REAL_ESTATE', 'TAX', 'IMMIGRATION', 'EMPLOYMENT', 'PERSONAL_INJURY', 'OTHER') NOT NULL,
    proficiency_level ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT') NOT NULL,
    years_experience INT DEFAULT 0,
    cases_handled INT DEFAULT 0,
    success_rate DECIMAL(5,2),
    last_case_date DATE,
    certifications TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE KEY unique_user_expertise (user_id, expertise_area),
    INDEX idx_expertise_area (expertise_area, proficiency_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. User Workload
CREATE TABLE user_workload (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    calculation_date DATE NOT NULL,
    active_cases_count INT DEFAULT 0,
    total_workload_points DECIMAL(10,2) DEFAULT 0.00,
    capacity_percentage DECIMAL(5,2) DEFAULT 0.00,
    max_capacity_points DECIMAL(10,2) DEFAULT 40.00,
    billable_hours_week DECIMAL(5,2) DEFAULT 0.00,
    non_billable_hours_week DECIMAL(5,2) DEFAULT 0.00,
    average_response_time_hours DECIMAL(5,2),
    overdue_tasks_count INT DEFAULT 0,
    upcoming_deadlines_count INT DEFAULT 0,
    last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE KEY unique_user_date (user_id, calculation_date),
    INDEX idx_capacity (capacity_percentage),
    INDEX idx_calculation_date (calculation_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Case Tasks
CREATE TABLE case_tasks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT UNSIGNED NOT NULL,
    parent_task_id BIGINT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    task_type ENUM('RESEARCH', 'DOCUMENT_PREP', 'CLIENT_MEETING', 'COURT_APPEARANCE', 
                   'FILING', 'REVIEW', 'CORRESPONDENCE', 'OTHER') NOT NULL,
    priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') DEFAULT 'MEDIUM',
    status ENUM('TODO', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'COMPLETED', 'CANCELLED') DEFAULT 'TODO',
    assigned_to BIGINT UNSIGNED,
    assigned_by BIGINT UNSIGNED NOT NULL,
    estimated_hours DECIMAL(5,2),
    actual_hours DECIMAL(5,2),
    due_date DATETIME,
    completed_at TIMESTAMP NULL,
    reminder_date DATETIME,
    dependencies JSON,
    tags JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (case_id) REFERENCES legal_cases(id),
    FOREIGN KEY (parent_task_id) REFERENCES case_tasks(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (assigned_by) REFERENCES users(id),
    
    INDEX idx_case_tasks (case_id, status),
    INDEX idx_assigned_to (assigned_to, status, due_date),
    INDEX idx_due_date (due_date, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Task Comments
CREATE TABLE task_comments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id BIGINT NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    comment TEXT NOT NULL,
    attachment_url VARCHAR(500),
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (task_id) REFERENCES case_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    
    INDEX idx_task_comments (task_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Assignment Rules
CREATE TABLE assignment_rules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    rule_type ENUM('EXPERTISE_BASED', 'WORKLOAD_BASED', 'ROUND_ROBIN', 'CUSTOM') NOT NULL,
    case_type VARCHAR(50),
    priority_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    max_workload_percentage DECIMAL(5,2) DEFAULT 80.00,
    min_expertise_score DECIMAL(5,2) DEFAULT 60.00,
    prefer_previous_attorney BOOLEAN DEFAULT TRUE,
    rule_conditions JSON,
    rule_actions JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_active_rules (is_active, priority_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Workload Calculations
CREATE TABLE workload_calculations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    calculation_date DATE NOT NULL,
    case_points JSON,
    total_points DECIMAL(10,2) NOT NULL,
    factors JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user_date (user_id, calculation_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Case Transfer Requests
CREATE TABLE case_transfer_requests (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT UNSIGNED NOT NULL,
    from_user_id BIGINT UNSIGNED NOT NULL,
    to_user_id BIGINT UNSIGNED NOT NULL,
    requested_by BIGINT UNSIGNED NOT NULL,
    reason TEXT NOT NULL,
    urgency ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') DEFAULT 'MEDIUM',
    status ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') DEFAULT 'PENDING',
    approved_by BIGINT UNSIGNED,
    approval_notes TEXT,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    
    FOREIGN KEY (case_id) REFERENCES legal_cases(id),
    FOREIGN KEY (from_user_id) REFERENCES users(id),
    FOREIGN KEY (to_user_id) REFERENCES users(id),
    FOREIGN KEY (requested_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    
    INDEX idx_status (status, requested_at),
    INDEX idx_case_transfer (case_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create Views for Reporting

-- View: Active Case Assignments
CREATE VIEW v_active_case_assignments AS
SELECT 
    ca.id,
    ca.case_id,
    lc.case_number,
    lc.title as case_title,
    ca.user_id,
    CONCAT(u.first_name, ' ', u.last_name) as attorney_name,
    ca.role_type,
    ca.workload_weight,
    ca.assigned_at,
    ca.expertise_match_score
FROM case_assignments ca
JOIN legal_cases lc ON ca.case_id = lc.id
JOIN users u ON ca.user_id = u.id
WHERE ca.is_active = TRUE
  AND (ca.effective_to IS NULL OR ca.effective_to >= CURDATE());

-- View: User Workload Summary
CREATE VIEW v_user_workload_summary AS
SELECT 
    u.id as user_id,
    CONCAT(u.first_name, ' ', u.last_name) as attorney_name,
    COALESCE(uw.active_cases_count, 0) as active_cases_count,
    COALESCE(uw.total_workload_points, 0) as total_workload_points,
    COALESCE(uw.capacity_percentage, 0) as capacity_percentage,
    COALESCE(uw.max_capacity_points, 40) as max_capacity_points,
    COALESCE(uw.overdue_tasks_count, 0) as overdue_tasks_count,
    COALESCE(uw.upcoming_deadlines_count, 0) as upcoming_deadlines_count,
    CASE 
        WHEN uw.capacity_percentage >= 90 THEN 'OVERLOADED'
        WHEN uw.capacity_percentage >= 70 THEN 'HIGH'
        WHEN uw.capacity_percentage >= 50 THEN 'MEDIUM'
        ELSE 'LOW'
    END as workload_status
FROM users u
LEFT JOIN user_workload uw ON u.id = uw.user_id 
    AND uw.calculation_date = CURDATE()
WHERE u.id IN (
    SELECT ur.user_id 
    FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE r.name IN ('ATTORNEY', 'SENIOR_ATTORNEY', 'PARTNER', 'ROLE_ATTORNEY')
);

-- Additional Performance Indexes
CREATE INDEX idx_case_active_assignments ON case_assignments(case_id, is_active, role_type);
CREATE INDEX idx_user_active_cases ON case_assignments(user_id, is_active, effective_from, effective_to);
CREATE INDEX idx_task_deadlines ON case_tasks(due_date, status, assigned_to);
CREATE INDEX idx_workload_lookup ON user_workload(user_id, calculation_date, capacity_percentage);

-- Insert initial assignment rules
INSERT INTO assignment_rules (rule_name, rule_type, priority_order) VALUES
('Expertise Match', 'EXPERTISE_BASED', 1),
('Workload Balance', 'WORKLOAD_BASED', 2),
('Round Robin Fallback', 'ROUND_ROBIN', 3);

-- Migrate existing case_role_assignments data if exists
INSERT INTO case_assignments (case_id, user_id, role_type, assigned_at, effective_from, is_active, created_at)
SELECT 
    cra.legal_case_id as case_id,
    cra.user_id,
    'LEAD_ATTORNEY' as role_type,
    COALESCE(cra.created_at, NOW()) as assigned_at,
    DATE(COALESCE(cra.created_at, NOW())) as effective_from,
    TRUE as is_active,
    COALESCE(cra.created_at, NOW()) as created_at
FROM case_role_assignments cra
WHERE EXISTS (SELECT 1 FROM legal_cases WHERE id = cra.legal_case_id)
  AND EXISTS (SELECT 1 FROM users WHERE id = cra.user_id)
ON DUPLICATE KEY UPDATE updated_at = NOW();