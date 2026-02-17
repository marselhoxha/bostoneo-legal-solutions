-- Enhanced Case Types and Assignments Migration (Fixed)
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
INSERT IGNORE INTO case_types (type_code, display_name, description, sort_order) VALUES
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

-- 3. Check if case_type column exists, if not add it
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

-- 4. Add index if it doesn't exist
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

-- 5. Update existing legal_cases to have proper case types based on their current 'type' field
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

-- 6. Update case_assignments table to support enhanced role types and assignment types
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

-- 7. Update attorney_expertise table to use new case types (if it exists)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'attorney_expertise') > 0,
    'ALTER TABLE attorney_expertise MODIFY COLUMN expertise_area ENUM(
        ''CORPORATE_LAW'',
        ''LITIGATION'', 
        ''REAL_ESTATE'',
        ''FAMILY_LAW'',
        ''CRIMINAL_LAW'',
        ''INTELLECTUAL_PROPERTY'',
        ''EMPLOYMENT_LAW'',
        ''ESTATE_PLANNING'',
        ''BANKRUPTCY'',
        ''IMMIGRATION'',
        ''TAX_LAW'',
        ''PERSONAL_INJURY'',
        ''ENVIRONMENTAL'',
        ''HEALTHCARE'',
        ''SECURITIES'',
        ''CONTRACT_LAW'',
        ''CLASS_ACTION'',
        ''APPELLATE'',
        ''ADMINISTRATIVE'',
        ''OTHER''
    ) NOT NULL',
    'SELECT ''Table attorney_expertise does not exist'' as message'
));

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 8. Update assignment_rules table to support new case types (if it exists)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'assignment_rules') > 0,
    'ALTER TABLE assignment_rules MODIFY COLUMN case_type VARCHAR(50)',
    'SELECT ''Table assignment_rules does not exist'' as message'
));

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 9. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cases_type_status ON legal_cases(case_type, status);
CREATE INDEX IF NOT EXISTS idx_cases_type_priority ON legal_cases(case_type, priority);

-- 10. Create a view for case type statistics
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

-- Migration completed successfully
