-- =====================================================
-- Role Simplification Migration Script
-- Reduces 22 roles to 6 simplified roles
-- Date: 2025-12-01
-- =====================================================

-- Step 1: Add title and seniority_level columns to users table
-- Check if columns exist first
SET @dbname = DATABASE();
SET @tablename = 'users';

-- Add title column if not exists
SET @columnname = 'title';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN title VARCHAR(100) DEFAULT NULL'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add seniority_level column if not exists
SET @columnname = 'seniority_level';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN seniority_level INT DEFAULT 50'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add can_approve column if not exists
SET @columnname = 'can_approve';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN can_approve BOOLEAN DEFAULT FALSE'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Step 2: Create new simplified roles
-- First, let's insert the new simplified roles with high IDs to avoid conflicts

INSERT INTO roles (id, name, display_name, description, hierarchy_level, is_system_role, is_active, role_category, max_billing_rate)
VALUES
(101, 'ADMIN', 'Administrator', 'Full system administration access', 100, 1, 1, 'TECHNICAL', NULL),
(102, 'ATTORNEY', 'Attorney', 'Licensed legal professional', 70, 1, 1, 'LEGAL', 500.00),
(103, 'PARALEGAL', 'Paralegal', 'Legal support professional', 40, 1, 1, 'SUPPORT', 150.00),
(104, 'SECRETARY', 'Secretary', 'Administrative support staff', 20, 1, 1, 'SUPPORT', 80.00),
(105, 'FINANCE', 'Finance', 'Financial and operations management', 65, 1, 1, 'FINANCIAL', NULL),
(106, 'USER', 'User', 'Basic system access', 10, 1, 1, 'SUPPORT', NULL)
ON DUPLICATE KEY UPDATE
    display_name = VALUES(display_name),
    description = VALUES(description),
    hierarchy_level = VALUES(hierarchy_level),
    is_active = VALUES(is_active);

-- Step 3: Get all permission IDs for reference
-- ADMIN gets ALL permissions (102 total)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 101, id FROM permissions
ON DUPLICATE KEY UPDATE role_id = role_id;

-- ATTORNEY permissions (based on MANAGING_PARTNER - 81 permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 102, p.id FROM permissions p
WHERE p.name IN (
    -- Case Management
    'CASE:VIEW', 'CASE:CREATE', 'CASE:EDIT', 'CASE:DELETE', 'CASE:ASSIGN', 'CASE:ADMIN',
    -- Document Management
    'DOCUMENT:VIEW', 'DOCUMENT:CREATE', 'DOCUMENT:EDIT', 'DOCUMENT:DELETE', 'DOCUMENT:ADMIN', 'DOCUMENT:SHARE',
    'DOCUMENT:MANAGE_CASE_FILES', 'DOCUMENT:VIEW_DEPARTMENT_FILES', 'DOCUMENT_UPLOAD',
    -- Client Management
    'CLIENT:VIEW', 'CLIENT:CREATE', 'CLIENT:EDIT', 'CLIENT:DELETE', 'CLIENT:ADMIN',
    -- Customer Management
    'CUSTOMER:VIEW', 'CUSTOMER:CREATE', 'CUSTOMER:EDIT', 'CUSTOMER:DELETE', 'CUSTOMER:ADMIN',
    -- Time Tracking
    'TIME_TRACKING:VIEW_OWN', 'TIME_TRACKING:VIEW_TEAM', 'TIME_TRACKING:VIEW_ALL',
    'TIME_TRACKING:CREATE', 'TIME_TRACKING:EDIT', 'TIME_TRACKING:EDIT_OWN', 'TIME_TRACKING:APPROVE',
    -- Billing (view and create only for attorneys)
    'BILLING:VIEW', 'BILLING:CREATE', 'BILLING:EDIT',
    -- Calendar
    'CALENDAR:VIEW', 'CALENDAR:CREATE', 'CALENDAR:EDIT', 'CALENDAR:DELETE', 'CALENDAR:ADMIN',
    -- Tasks
    'TASK:VIEW_OWN', 'TASK:VIEW_TEAM', 'TASK:VIEW_ALL', 'TASK:CREATE', 'TASK:ASSIGN', 'TASK:ADMIN',
    -- Reports
    'REPORT:VIEW_OWN', 'REPORT:VIEW_TEAM', 'REPORT:VIEW_ALL', 'REPORT:CREATE',
    -- Expenses
    'EXPENSE:VIEW', 'EXPENSE:CREATE', 'EXPENSE:EDIT',
    -- Invoices
    'INVOICE:VIEW', 'INVOICE:CREATE', 'INVOICE:READ', 'CREATE:INVOICE', 'READ:INVOICE',
    -- Legal features
    'AI_ANALYSIS_VIEW', 'LEGAL_DRAFTING_VIEW', 'LEGAL_DRAFTING_CREATE'
)
ON DUPLICATE KEY UPDATE role_id = role_id;

-- PARALEGAL permissions (28 permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 103, p.id FROM permissions p
WHERE p.name IN (
    -- Case Management (no delete)
    'CASE:VIEW', 'CASE:CREATE', 'CASE:EDIT',
    -- Document Management
    'DOCUMENT:VIEW', 'DOCUMENT:CREATE', 'DOCUMENT:EDIT', 'DOCUMENT:MANAGE_CASE_FILES', 'DOCUMENT:VIEW_DEPARTMENT_FILES',
    -- Client Management (no delete)
    'CLIENT:VIEW', 'CLIENT:CREATE', 'CLIENT:EDIT',
    -- Time Tracking (own and team view)
    'TIME_TRACKING:VIEW_OWN', 'TIME_TRACKING:VIEW_TEAM', 'TIME_TRACKING:CREATE', 'TIME_TRACKING:EDIT_OWN',
    -- Calendar
    'CALENDAR:VIEW', 'CALENDAR:CREATE', 'CALENDAR:EDIT',
    -- Tasks
    'TASK:VIEW_OWN', 'TASK:VIEW_TEAM', 'TASK:CREATE',
    -- Expenses
    'EXPENSE:VIEW', 'EXPENSE:CREATE', 'EXPENSE:EDIT',
    -- Reports (own only)
    'REPORT:VIEW_OWN',
    -- Legal features
    'AI_ANALYSIS_VIEW', 'LEGAL_DRAFTING_VIEW'
)
ON DUPLICATE KEY UPDATE role_id = role_id;

-- SECRETARY permissions (9+ permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 104, p.id FROM permissions p
WHERE p.name IN (
    -- Case Management (view only)
    'CASE:VIEW',
    -- Document Management (view and create)
    'DOCUMENT:VIEW', 'DOCUMENT:CREATE',
    -- Client Management (view only)
    'CLIENT:VIEW',
    -- Time Tracking (own only)
    'TIME_TRACKING:VIEW_OWN', 'TIME_TRACKING:CREATE', 'TIME_TRACKING:EDIT_OWN',
    -- Calendar
    'CALENDAR:VIEW', 'CALENDAR:CREATE'
)
ON DUPLICATE KEY UPDATE role_id = role_id;

-- FINANCE permissions (financial operations)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 105, p.id FROM permissions p
WHERE p.name IN (
    -- Billing (full access)
    'BILLING:VIEW', 'BILLING:CREATE', 'BILLING:EDIT', 'BILLING:DELETE', 'BILLING:ADMIN',
    -- Invoices (full access)
    'INVOICE:VIEW', 'INVOICE:CREATE', 'INVOICE:READ', 'INVOICE:UPDATE', 'INVOICE:DELETE', 'INVOICE:APPROVE', 'INVOICE:SEND', 'INVOICE:ADMIN',
    'CREATE:INVOICE', 'READ:INVOICE', 'UPDATE:INVOICE', 'DELETE:INVOICE', 'SEND:INVOICE', 'APPROVE:INVOICE',
    -- Payment Transactions
    'CREATE:PAYMENT_TRANSACTION', 'READ:PAYMENT_TRANSACTION', 'UPDATE:PAYMENT_TRANSACTION', 'DELETE:PAYMENT_TRANSACTION',
    -- Reports (all access)
    'REPORT:VIEW_OWN', 'REPORT:VIEW_TEAM', 'REPORT:VIEW_ALL', 'REPORT:CREATE', 'REPORT:ADMIN',
    -- Expenses (admin)
    'EXPENSE:VIEW', 'EXPENSE:CREATE', 'EXPENSE:EDIT', 'EXPENSE:ADMIN',
    -- Time Tracking (for billing)
    'TIME_TRACKING:VIEW_ALL', 'TIME_TRACKING:APPROVE', 'TIME_TRACKING:EXPORT',
    -- Case/Client view for context
    'CASE:VIEW', 'CLIENT:VIEW', 'CUSTOMER:VIEW',
    -- Administrative view
    'ADMINISTRATIVE:VIEW'
)
ON DUPLICATE KEY UPDATE role_id = role_id;

-- USER permissions (minimal - 3 permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 106, p.id FROM permissions p
WHERE p.name IN (
    'CASE:VIEW',
    'DOCUMENT:VIEW',
    'DOCUMENT:CREATE'
)
ON DUPLICATE KEY UPDATE role_id = role_id;

-- Step 4: Create mapping table for user migration
CREATE TABLE IF NOT EXISTS role_migration_map (
    old_role_id BIGINT UNSIGNED,
    old_role_name VARCHAR(100),
    new_role_id BIGINT UNSIGNED,
    new_role_name VARCHAR(100),
    title VARCHAR(100),
    seniority_level INT,
    can_approve BOOLEAN DEFAULT FALSE
);

-- Clear existing mapping
TRUNCATE TABLE role_migration_map;

-- Insert migration mapping
INSERT INTO role_migration_map (old_role_id, old_role_name, new_role_id, new_role_name, title, seniority_level, can_approve) VALUES
-- Partners -> ATTORNEY
(1, 'MANAGING_PARTNER', 102, 'ATTORNEY', 'Managing Partner', 100, TRUE),
(2, 'SENIOR_PARTNER', 102, 'ATTORNEY', 'Senior Partner', 95, TRUE),
(3, 'EQUITY_PARTNER', 102, 'ATTORNEY', 'Equity Partner', 90, TRUE),
(4, 'OF_COUNSEL', 102, 'ATTORNEY', 'Of Counsel', 85, TRUE),
(5, 'NON_EQUITY_PARTNER', 102, 'ATTORNEY', 'Non-Equity Partner', 80, TRUE),
-- Associates -> ATTORNEY
(6, 'SENIOR_ASSOCIATE', 102, 'ATTORNEY', 'Senior Associate', 70, FALSE),
(7, 'ASSOCIATE', 102, 'ATTORNEY', 'Associate', 60, FALSE),
(8, 'JUNIOR_ASSOCIATE', 102, 'ATTORNEY', 'Junior Associate', 50, FALSE),
(9, 'LAW_CLERK', 102, 'ATTORNEY', 'Law Clerk', 40, FALSE),
-- Paralegals -> PARALEGAL
(10, 'SENIOR_PARALEGAL', 103, 'PARALEGAL', 'Senior Paralegal', 35, FALSE),
(11, 'PARALEGAL', 103, 'PARALEGAL', 'Paralegal', 30, FALSE),
-- Support -> SECRETARY
(12, 'LEGAL_ASSISTANT', 104, 'SECRETARY', 'Legal Assistant', 25, FALSE),
(13, 'LEGAL_SECRETARY', 104, 'SECRETARY', 'Legal Secretary', 20, FALSE),
-- Administrative -> FINANCE
(14, 'COO', 105, 'FINANCE', 'Chief Operating Officer', 85, TRUE),
(15, 'PRACTICE_MANAGER', 105, 'FINANCE', 'Practice Manager', 75, TRUE),
(16, 'CFO', 105, 'FINANCE', 'Chief Financial Officer', 80, TRUE),
(17, 'FINANCE_MANAGER', 105, 'FINANCE', 'Finance Manager', 65, FALSE),
(19, 'HR_MANAGER', 105, 'FINANCE', 'HR Manager', 60, FALSE),
-- Technical -> ADMIN
(18, 'IT_MANAGER', 101, 'ADMIN', 'IT Manager', 70, FALSE),
(20, 'ROLE_ADMIN', 101, 'ADMIN', 'System Administrator', 100, TRUE),
-- Basic -> USER
(21, 'ROLE_USER', 106, 'USER', 'User', 10, FALSE),
(22, 'ROLE_ATTORNEY', 102, 'ATTORNEY', 'Attorney', 60, FALSE);

-- Step 5: Migrate user roles and update user fields
-- Update users with title and seniority based on their current role
UPDATE users u
INNER JOIN user_roles ur ON u.id = ur.user_id
INNER JOIN roles r ON ur.role_id = r.id
INNER JOIN role_migration_map rmm ON r.name = rmm.old_role_name
SET
    u.title = rmm.title,
    u.seniority_level = rmm.seniority_level,
    u.can_approve = rmm.can_approve
WHERE u.title IS NULL;

-- Step 6: Create new user_roles entries for simplified roles
-- First, backup existing user_roles
CREATE TABLE IF NOT EXISTS user_roles_backup_20251201 AS SELECT * FROM user_roles;

-- Insert new role assignments based on mapping
INSERT INTO user_roles (user_id, role_id)
SELECT DISTINCT ur.user_id, rmm.new_role_id
FROM user_roles ur
INNER JOIN roles r ON ur.role_id = r.id
INNER JOIN role_migration_map rmm ON r.name = rmm.old_role_name
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);

-- Step 7: Deactivate old roles (keep them for reference but mark inactive)
UPDATE roles SET is_active = 0 WHERE id <= 22 AND id NOT IN (101, 102, 103, 104, 105, 106);

-- Step 8: Verify migration
SELECT
    'Migration Summary' as info,
    (SELECT COUNT(*) FROM roles WHERE is_active = 1 AND id >= 101) as new_active_roles,
    (SELECT COUNT(*) FROM roles WHERE is_active = 0) as deactivated_roles,
    (SELECT COUNT(DISTINCT user_id) FROM user_roles WHERE role_id >= 101) as users_with_new_roles,
    (SELECT COUNT(*) FROM users WHERE title IS NOT NULL) as users_with_titles;

-- Show new role distribution
SELECT
    r.name as role_name,
    r.display_name,
    COUNT(ur.user_id) as user_count
FROM roles r
LEFT JOIN user_roles ur ON r.id = ur.role_id
WHERE r.id >= 101 AND r.is_active = 1
GROUP BY r.id, r.name, r.display_name
ORDER BY r.hierarchy_level DESC;
