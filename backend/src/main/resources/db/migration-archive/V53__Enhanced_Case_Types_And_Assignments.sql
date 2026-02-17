-- Enhanced Case Types and Assignments Migration
-- Migration V53: Standardize case types, enhance assignment types, and update role types

-- 1. Create Case Type Enum Table for Reference
CREATE TABLE IF NOT EXISTS case_types (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    type_code VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_active_types (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Insert Standard Case Types
INSERT INTO case_types (type_code, display_name, description, sort_order) VALUES
('CORPORATE_LAW', 'Corporate Law', 'Business formation, mergers, acquisitions, corporate governance', 10),
('LITIGATION', 'Litigation', 'Civil litigation, disputes, court proceedings', 20),
('REAL_ESTATE', 'Real Estate Law', 'Property transactions, real estate disputes, zoning', 30),
('FAMILY_LAW', 'Family Law', 'Divorce, custody, adoption, family disputes', 40),
('CRIMINAL_LAW', 'Criminal Law', 'Criminal defense, DUI, white collar crime', 50),
('INTELLECTUAL_PROPERTY', 'Intellectual Property', 'Patents, trademarks, copyrights, IP litigation', 60),
('EMPLOYMENT_LAW', 'Employment Law', 'Labor disputes, wrongful termination, workplace issues', 70),
('ESTATE_PLANNING', 'Estate Planning', 'Wills, trusts, probate, estate administration', 80),
('BANKRUPTCY', 'Bankruptcy Law', 'Personal and business bankruptcy, debt restructuring', 90),
('IMMIGRATION', 'Immigration Law', 'Visa applications, citizenship, deportation defense', 100),
('TAX_LAW', 'Tax Law', 'Tax planning, tax disputes, IRS representation', 110),
('PERSONAL_INJURY', 'Personal Injury', 'Accident claims, medical malpractice, product liability', 120),
('ENVIRONMENTAL', 'Environmental Law', 'Environmental compliance, regulatory matters', 130),
('HEALTHCARE', 'Healthcare Law', 'Medical practice, healthcare compliance, HIPAA', 140),
('SECURITIES', 'Securities Law', 'SEC compliance, securities litigation, investment law', 150),
('CONTRACT_LAW', 'Contract Law', 'Contract drafting, contract disputes, commercial agreements', 160),
('CLASS_ACTION', 'Class Action', 'Class action lawsuits, mass tort litigation', 170),
('APPELLATE', 'Appellate Law', 'Appeals, appellate briefs, supreme court cases', 180),
('ADMINISTRATIVE', 'Administrative Law', 'Government regulations, administrative hearings', 190),
('OTHER', 'Other', 'Other legal matters not covered by standard categories', 999);

-- 3. Add case_type column to legal_cases if it doesn't exist
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'legal_cases' 
     AND COLUMN_NAME = 'case_type') = 0,
    'ALTER TABLE legal_cases ADD COLUMN case_type VARCHAR(50) DEFAULT ''OTHER''',
    'SELECT ''Column case_type already exists'' as message'
));

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index if it doesn't exist
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'legal_cases' 
     AND INDEX_NAME = 'idx_case_type') = 0,
    'CREATE INDEX idx_case_type ON legal_cases(case_type)',
    'SELECT ''Index idx_case_type already exists'' as message'
));

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Update existing legal_cases to have proper case types based on their current 'type' field
UPDATE legal_cases SET case_type = 
CASE 
    WHEN UPPER(type) LIKE '%CORPORATE%' OR UPPER(type) LIKE '%BUSINESS%' THEN 'CORPORATE_LAW'
    WHEN UPPER(type) LIKE '%LITIGATION%' OR UPPER(type) LIKE '%LAWSUIT%' OR UPPER(type) LIKE '%CIVIL%' THEN 'LITIGATION'
    WHEN UPPER(type) LIKE '%REAL%ESTATE%' OR UPPER(type) LIKE '%PROPERTY%' THEN 'REAL_ESTATE'
    WHEN UPPER(type) LIKE '%FAMILY%' OR UPPER(type) LIKE '%DIVORCE%' OR UPPER(type) LIKE '%CUSTODY%' THEN 'FAMILY_LAW'
    WHEN UPPER(type) LIKE '%CRIMINAL%' OR UPPER(type) LIKE '%DUI%' THEN 'CRIMINAL_LAW'
    WHEN UPPER(type) LIKE '%IP%' OR UPPER(type) LIKE '%PATENT%' OR UPPER(type) LIKE '%TRADEMARK%' OR UPPER(type) LIKE '%COPYRIGHT%' THEN 'INTELLECTUAL_PROPERTY'
    WHEN UPPER(type) LIKE '%EMPLOYMENT%' OR UPPER(type) LIKE '%LABOR%' THEN 'EMPLOYMENT_LAW'
    WHEN UPPER(type) LIKE '%ESTATE%' OR UPPER(type) LIKE '%WILL%' OR UPPER(type) LIKE '%PROBATE%' THEN 'ESTATE_PLANNING'
    WHEN UPPER(type) LIKE '%BANKRUPTCY%' THEN 'BANKRUPTCY'
    WHEN UPPER(type) LIKE '%IMMIGRATION%' OR UPPER(type) LIKE '%VISA%' THEN 'IMMIGRATION'
    WHEN UPPER(type) LIKE '%TAX%' THEN 'TAX_LAW'
    WHEN UPPER(type) LIKE '%PERSONAL%INJURY%' OR UPPER(type) LIKE '%ACCIDENT%' THEN 'PERSONAL_INJURY'
    WHEN UPPER(type) LIKE '%CONTRACT%' THEN 'CONTRACT_LAW'
    ELSE 'OTHER'
END
WHERE case_type = 'OTHER' OR case_type IS NULL;

-- 5. Update case_assignments table to support enhanced role types and assignment types
ALTER TABLE case_assignments 
MODIFY COLUMN role_type ENUM(
    'LEAD_ATTORNEY', 
    'SUPPORTING_ATTORNEY', 
    'CO_COUNSEL',
    'ASSOCIATE', 
    'PARALEGAL', 
    'LEGAL_ASSISTANT',
    'SECRETARY',
    'CONSULTANT',
    'INTERN'
) NOT NULL;

ALTER TABLE case_assignments 
MODIFY COLUMN assignment_type ENUM(
    'MANUAL', 
    'AUTO_ASSIGNED', 
    'TRANSFERRED',
    'TEMPORARY',
    'EMERGENCY',
    'DELEGATED'
) DEFAULT 'MANUAL';

-- 6. Update attorney_expertise table to use new case types
ALTER TABLE attorney_expertise 
MODIFY COLUMN expertise_area ENUM(
    'CORPORATE_LAW',
    'LITIGATION', 
    'REAL_ESTATE',
    'FAMILY_LAW',
    'CRIMINAL_LAW',
    'INTELLECTUAL_PROPERTY',
    'EMPLOYMENT_LAW',
    'ESTATE_PLANNING',
    'BANKRUPTCY',
    'IMMIGRATION',
    'TAX_LAW',
    'PERSONAL_INJURY',
    'ENVIRONMENTAL',
    'HEALTHCARE',
    'SECURITIES',
    'CONTRACT_LAW',
    'CLASS_ACTION',
    'APPELLATE',
    'ADMINISTRATIVE',
    'OTHER'
) NOT NULL;

-- 7. Update assignment_rules table to support new case types
ALTER TABLE assignment_rules 
MODIFY COLUMN case_type VARCHAR(50);

-- 8. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cases_type_status ON legal_cases(case_type, status);
CREATE INDEX IF NOT EXISTS idx_cases_type_priority ON legal_cases(case_type, priority);
CREATE INDEX IF NOT EXISTS idx_assignments_role_type ON case_assignments(role_type, is_active);
CREATE INDEX IF NOT EXISTS idx_assignments_type ON case_assignments(assignment_type, is_active);
CREATE INDEX IF NOT EXISTS idx_expertise_area_level ON attorney_expertise(expertise_area, proficiency_level);

-- 9. Update existing assignment rules to use new case types
UPDATE assignment_rules 
SET case_type = CASE 
    WHEN case_type = 'CORPORATE' THEN 'CORPORATE_LAW'
    WHEN case_type = 'CRIMINAL' THEN 'CRIMINAL_LAW'
    WHEN case_type = 'FAMILY' THEN 'FAMILY_LAW'
    WHEN case_type = 'REAL_ESTATE' THEN 'REAL_ESTATE'
    WHEN case_type = 'IP' OR case_type = 'INTELLECTUAL_PROPERTY' THEN 'INTELLECTUAL_PROPERTY'
    WHEN case_type = 'EMPLOYMENT' THEN 'EMPLOYMENT_LAW'
    WHEN case_type = 'ESTATE' THEN 'ESTATE_PLANNING'
    WHEN case_type = 'TAX' THEN 'TAX_LAW'
    WHEN case_type = 'PERSONAL_INJURY' THEN 'PERSONAL_INJURY'
    ELSE case_type
END;

-- 10. Update existing attorney expertise records
UPDATE attorney_expertise 
SET expertise_area = CASE 
    WHEN expertise_area = 'CORPORATE' THEN 'CORPORATE_LAW'
    WHEN expertise_area = 'CRIMINAL' THEN 'CRIMINAL_LAW'
    WHEN expertise_area = 'FAMILY' THEN 'FAMILY_LAW'
    WHEN expertise_area = 'REAL_ESTATE' THEN 'REAL_ESTATE'
    WHEN expertise_area = 'INTELLECTUAL_PROPERTY' THEN 'INTELLECTUAL_PROPERTY'
    WHEN expertise_area = 'EMPLOYMENT' THEN 'EMPLOYMENT_LAW'
    WHEN expertise_area = 'TAX' THEN 'TAX_LAW'
    WHEN expertise_area = 'IMMIGRATION' THEN 'IMMIGRATION'
    WHEN expertise_area = 'PERSONAL_INJURY' THEN 'PERSONAL_INJURY'
    ELSE expertise_area
END;

-- 11. Create a view for case type statistics
CREATE OR REPLACE VIEW v_case_type_statistics AS
SELECT 
    ct.type_code,
    ct.display_name,
    COUNT(lc.id) as total_cases,
    COUNT(CASE WHEN lc.status IN ('OPEN', 'IN_PROGRESS') THEN 1 END) as active_cases,
    COUNT(CASE WHEN lc.status = 'CLOSED' THEN 1 END) as closed_cases,
    COUNT(CASE WHEN lc.priority = 'HIGH' OR lc.priority = 'URGENT' THEN 1 END) as high_priority_cases,
    AVG(CASE WHEN lc.total_amount > 0 THEN lc.total_amount END) as avg_case_value,
    SUM(CASE WHEN lc.total_amount > 0 THEN lc.total_amount ELSE 0 END) as total_revenue
FROM case_types ct
LEFT JOIN legal_cases lc ON ct.type_code = lc.case_type
WHERE ct.is_active = TRUE
GROUP BY ct.id, ct.type_code, ct.display_name
ORDER BY ct.sort_order;

-- 12. Create a view for assignment role distribution
CREATE OR REPLACE VIEW v_assignment_role_distribution AS
SELECT 
    ca.role_type,
    COUNT(*) as total_assignments,
    COUNT(CASE WHEN ca.is_active = TRUE THEN 1 END) as active_assignments,
    COUNT(DISTINCT ca.user_id) as unique_attorneys,
    COUNT(DISTINCT ca.case_id) as unique_cases,
    AVG(ca.workload_weight) as avg_workload_weight
FROM case_assignments ca
GROUP BY ca.role_type
ORDER BY total_assignments DESC;

-- 13. Create a comprehensive case workload view
CREATE OR REPLACE VIEW v_case_workload_analysis AS
SELECT 
    lc.id as case_id,
    lc.case_number,
    lc.title,
    lc.case_type,
    ct.display_name as case_type_display,
    lc.priority,
    lc.status,
    COUNT(ca.id) as total_assignments,
    COUNT(CASE WHEN ca.is_active = TRUE THEN 1 END) as active_assignments,
    SUM(CASE WHEN ca.is_active = TRUE THEN ca.workload_weight ELSE 0 END) as total_workload_weight,
    GROUP_CONCAT(
        CASE WHEN ca.is_active = TRUE 
        THEN CONCAT(u.first_name, ' ', u.last_name, ' (', ca.role_type, ')') 
        END SEPARATOR '; '
    ) as active_team_members
FROM legal_cases lc
LEFT JOIN case_types ct ON lc.case_type = ct.type_code
LEFT JOIN case_assignments ca ON lc.id = ca.case_id
LEFT JOIN users u ON ca.user_id = u.id
GROUP BY lc.id, lc.case_number, lc.title, lc.case_type, ct.display_name, lc.priority, lc.status
ORDER BY lc.created_at DESC;

-- 14. Insert sample assignment rules for different case types
INSERT IGNORE INTO assignment_rules 
(rule_name, rule_type, case_type, priority_order, max_workload_percentage, min_expertise_score, prefer_previous_attorney) 
VALUES
('Corporate Law Auto-Assignment', 'EXPERTISE_BASED', 'CORPORATE_LAW', 10, 75.00, 80.00, TRUE),
('Litigation Workload Balance', 'WORKLOAD_BASED', 'LITIGATION', 20, 80.00, 70.00, TRUE),
('Family Law Round Robin', 'ROUND_ROBIN', 'FAMILY_LAW', 30, 70.00, 60.00, FALSE),
('Criminal Defense Priority', 'EXPERTISE_BASED', 'CRIMINAL_LAW', 5, 85.00, 85.00, TRUE),
('IP Specialist Assignment', 'EXPERTISE_BASED', 'INTELLECTUAL_PROPERTY', 15, 70.00, 90.00, TRUE),
('Real Estate Standard', 'WORKLOAD_BASED', 'REAL_ESTATE', 25, 75.00, 65.00, TRUE);

-- 15. Add foreign key constraint between legal_cases and case_types
ALTER TABLE legal_cases 
ADD CONSTRAINT fk_legal_cases_case_type 
FOREIGN KEY (case_type) REFERENCES case_types(type_code) 
ON UPDATE CASCADE ON DELETE RESTRICT;

-- 16. Create trigger to update case assignment history when assignments change
DELIMITER //
CREATE TRIGGER tr_case_assignment_history_update
AFTER UPDATE ON case_assignments
FOR EACH ROW
BEGIN
    IF OLD.role_type != NEW.role_type OR OLD.is_active != NEW.is_active THEN
        INSERT INTO case_assignment_history 
        (case_assignment_id, case_id, user_id, action, performed_by, performed_at, metadata)
        VALUES 
        (NEW.id, NEW.case_id, NEW.user_id, 'MODIFIED', NEW.user_id, NOW(), 
         JSON_OBJECT(
             'old_role_type', OLD.role_type,
             'new_role_type', NEW.role_type,
             'old_active', OLD.is_active,
             'new_active', NEW.is_active
         ));
    END IF;
END//
DELIMITER ;

-- 17. Update any existing case tasks to reference proper case types
UPDATE case_tasks ct
JOIN legal_cases lc ON ct.case_id = lc.id
SET ct.updated_at = ct.updated_at  -- Touch the record to trigger any related updates
WHERE lc.case_type IS NOT NULL;

-- 18. Create comprehensive indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_case_assignments_composite ON case_assignments(case_id, user_id, role_type, is_active);
CREATE INDEX IF NOT EXISTS idx_case_assignments_workload ON case_assignments(user_id, is_active, workload_weight);
CREATE INDEX IF NOT EXISTS idx_case_assignments_effective_dates ON case_assignments(effective_from, effective_to, is_active);
CREATE INDEX IF NOT EXISTS idx_attorney_expertise_composite ON attorney_expertise(user_id, expertise_area, proficiency_level);
CREATE INDEX IF NOT EXISTS idx_legal_cases_composite ON legal_cases(case_type, status, priority, created_at);

-- 19. Add comments for documentation
ALTER TABLE case_types COMMENT = 'Master table for standardized case types used throughout the system';
ALTER TABLE case_assignments COMMENT = 'Enhanced case assignment table with expanded role types and assignment types';
ALTER TABLE attorney_expertise COMMENT = 'Attorney expertise mapping updated to use standardized case types';

-- Migration completed successfully
-- This migration standardizes case types, enhances assignment types and role types,
-- creates comprehensive views for reporting, and improves performance with proper indexing. 