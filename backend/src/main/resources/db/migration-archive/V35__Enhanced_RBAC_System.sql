-- Enhanced RBAC System Implementation
-- This migration creates a comprehensive, scalable RBAC system for legal management

-- 1. Enhanced Roles Table
DROP TABLE IF EXISTS roles_new;
CREATE TABLE roles_new (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(150) NOT NULL,
    description TEXT,
    hierarchy_level INT NOT NULL DEFAULT 0,
    is_system_role BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    role_category ENUM('LEGAL', 'ADMINISTRATIVE', 'FINANCIAL', 'TECHNICAL', 'SUPPORT') NOT NULL DEFAULT 'LEGAL',
    max_billing_rate DECIMAL(10,2) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_hierarchy (hierarchy_level),
    INDEX idx_category (role_category),
    INDEX idx_active (is_active)
);

-- 2. Enhanced Permissions Table
DROP TABLE IF EXISTS permissions_new;
CREATE TABLE permissions_new (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    resource_type VARCHAR(50) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    description TEXT,
    is_contextual BOOLEAN DEFAULT FALSE,
    permission_category ENUM('BASIC', 'ADMINISTRATIVE', 'FINANCIAL', 'CONFIDENTIAL', 'SYSTEM') DEFAULT 'BASIC',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_resource_action (resource_type, action_type),
    INDEX idx_category (permission_category),
    INDEX idx_contextual (is_contextual)
);

-- 3. Permission Dependencies
CREATE TABLE IF NOT EXISTS permission_dependencies (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    permission_id BIGINT NOT NULL,
    required_permission_id BIGINT NOT NULL,
    
    FOREIGN KEY (permission_id) REFERENCES permissions_new(id) ON DELETE CASCADE,
    FOREIGN KEY (required_permission_id) REFERENCES permissions_new(id) ON DELETE CASCADE,
    UNIQUE KEY unique_dependency (permission_id, required_permission_id)
);

-- 4. Enhanced Role-Permission Mapping
DROP TABLE IF EXISTS role_permissions_new;
CREATE TABLE role_permissions_new (
    role_id BIGINT UNSIGNED NOT NULL,
    permission_id BIGINT NOT NULL,
    is_granted BOOLEAN DEFAULT TRUE,
    granted_by BIGINT UNSIGNED NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles_new(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions_new(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 5. Context-Aware Role Assignments
CREATE TABLE IF NOT EXISTS case_team_assignments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    case_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    case_role ENUM('LEAD_ATTORNEY', 'CO_COUNSEL', 'ASSOCIATE', 'PARALEGAL', 'SUPPORT') NOT NULL,
    permissions JSON,
    assigned_by BIGINT UNSIGNED NOT NULL,
    assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id),
    UNIQUE KEY unique_case_user_role (case_id, user_id, case_role),
    INDEX idx_case_active (case_id, is_active),
    INDEX idx_user_active (user_id, is_active)
);

-- 6. Department/Practice Group Assignments
CREATE TABLE IF NOT EXISTS department_role_assignments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    department_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    department_role ENUM('HEAD', 'SENIOR_MEMBER', 'MEMBER', 'COLLABORATOR') NOT NULL,
    permissions JSON,
    assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_dept_user (department_id, user_id),
    INDEX idx_dept_active (department_id, is_active)
);

-- 7. Temporary Role Assignments
CREATE TABLE IF NOT EXISTS temporary_role_assignments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    context_type ENUM('CASE', 'PROJECT', 'DEPARTMENT', 'TEMPORARY') NOT NULL,
    context_id BIGINT UNSIGNED,
    assigned_by BIGINT UNSIGNED NOT NULL,
    starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles_new(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id),
    INDEX idx_user_context (user_id, context_type, context_id),
    INDEX idx_expiry (expires_at, is_active)
);

-- 8. Enhanced User-Role Mapping
DROP TABLE IF EXISTS user_roles_new;
CREATE TABLE user_roles_new (
    user_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    assigned_by BIGINT UNSIGNED NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles_new(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_primary (user_id, is_primary),
    INDEX idx_active (is_active)
);

-- 9. Insert Modern Law Firm Roles
INSERT INTO roles_new (name, display_name, description, hierarchy_level, role_category, is_system_role, max_billing_rate) VALUES

-- Executive Level
('MANAGING_PARTNER', 'Managing Partner', 'Firm leadership with full authority', 100, 'LEGAL', TRUE, 1000.00),
('SENIOR_PARTNER', 'Senior Partner', 'Practice area leadership and client development', 95, 'LEGAL', TRUE, 900.00),
('EQUITY_PARTNER', 'Equity Partner', 'Profit-sharing partner with voting rights', 90, 'LEGAL', TRUE, 800.00),

-- Senior Legal
('OF_COUNSEL', 'Of Counsel', 'Specialized legal expertise on contract basis', 85, 'LEGAL', TRUE, 750.00),
('NON_EQUITY_PARTNER', 'Non-Equity Partner', 'Leadership role without ownership', 80, 'LEGAL', TRUE, 700.00),
('SENIOR_ASSOCIATE', 'Senior Associate', 'Experienced attorney with case management duties', 70, 'LEGAL', TRUE, 500.00),

-- Professional Legal
('ASSOCIATE', 'Associate', 'Licensed attorney handling cases and clients', 60, 'LEGAL', TRUE, 400.00),
('JUNIOR_ASSOCIATE', 'Junior Associate', 'Early-career attorney with supervision', 50, 'LEGAL', TRUE, 300.00),
('LAW_CLERK', 'Law Clerk', 'Law student or recent graduate', 40, 'LEGAL', TRUE, 200.00),

-- Support Staff
('SENIOR_PARALEGAL', 'Senior Paralegal', 'Advanced legal support with specialized skills', 30, 'SUPPORT', TRUE, 150.00),
('PARALEGAL', 'Paralegal', 'Standard paralegal support', 25, 'SUPPORT', TRUE, 120.00),
('LEGAL_ASSISTANT', 'Legal Assistant', 'Administrative and basic legal support', 20, 'SUPPORT', TRUE, 80.00),
('LEGAL_SECRETARY', 'Legal Secretary', 'Documentation and scheduling support', 15, 'SUPPORT', TRUE, 60.00),

-- Administrative & Business
('COO', 'Chief Operating Officer', 'Operations leadership', 85, 'ADMINISTRATIVE', TRUE, NULL),
('PRACTICE_MANAGER', 'Practice Group Manager', 'Practice area operations management', 80, 'ADMINISTRATIVE', TRUE, NULL),
('CFO', 'Chief Financial Officer', 'Financial leadership', 65, 'FINANCIAL', TRUE, NULL),
('FINANCE_MANAGER', 'Finance Manager', 'Financial operations management', 60, 'FINANCIAL', TRUE, NULL),
('IT_MANAGER', 'IT Manager', 'Technology systems management', 50, 'TECHNICAL', TRUE, NULL),
('HR_MANAGER', 'HR Manager', 'Human resources management', 45, 'ADMINISTRATIVE', TRUE, NULL),

-- Legacy Compatibility
('ROLE_ADMIN', 'System Administrator', 'Full system access', 100, 'TECHNICAL', TRUE, NULL),
('ROLE_USER', 'Basic User', 'Basic system access', 10, 'SUPPORT', TRUE, NULL);

-- 10. Insert Comprehensive Permissions
INSERT INTO permissions_new (name, resource_type, action_type, description, is_contextual, permission_category) VALUES

-- Core Legal Resources
('CASE:VIEW', 'CASE', 'VIEW', 'View case details', FALSE, 'BASIC'),
('CASE:CREATE', 'CASE', 'CREATE', 'Create new cases', FALSE, 'BASIC'),
('CASE:EDIT', 'CASE', 'EDIT', 'Edit case details', TRUE, 'BASIC'),
('CASE:DELETE', 'CASE', 'DELETE', 'Delete cases', TRUE, 'ADMINISTRATIVE'),
('CASE:ASSIGN', 'CASE', 'ASSIGN', 'Assign cases to team members', FALSE, 'ADMINISTRATIVE'),
('CASE:ADMIN', 'CASE', 'ADMIN', 'Full case administration', FALSE, 'ADMINISTRATIVE'),

-- Document Management
('DOCUMENT:VIEW', 'DOCUMENT', 'VIEW', 'View documents', TRUE, 'BASIC'),
('DOCUMENT:CREATE', 'DOCUMENT', 'CREATE', 'Upload new documents', FALSE, 'BASIC'),
('DOCUMENT:EDIT', 'DOCUMENT', 'EDIT', 'Edit document metadata', TRUE, 'BASIC'),
('DOCUMENT:DELETE', 'DOCUMENT', 'DELETE', 'Delete documents', TRUE, 'ADMINISTRATIVE'),
('DOCUMENT:ADMIN', 'DOCUMENT', 'ADMIN', 'Full document administration', FALSE, 'ADMINISTRATIVE'),

-- Time Tracking & Billing
('TIME_TRACKING:VIEW_OWN', 'TIME_TRACKING', 'VIEW_OWN', 'View own time entries', FALSE, 'BASIC'),
('TIME_TRACKING:EDIT_OWN', 'TIME_TRACKING', 'EDIT_OWN', 'Edit own time entries', FALSE, 'BASIC'),
('TIME_TRACKING:VIEW_TEAM', 'TIME_TRACKING', 'VIEW_TEAM', 'View team time entries', FALSE, 'ADMINISTRATIVE'),
('TIME_TRACKING:VIEW_ALL', 'TIME_TRACKING', 'VIEW_ALL', 'View all time entries', FALSE, 'ADMINISTRATIVE'),
('TIME_TRACKING:APPROVE', 'TIME_TRACKING', 'APPROVE', 'Approve time entries', FALSE, 'ADMINISTRATIVE'),
('TIME_TRACKING:MANAGE', 'TIME_TRACKING', 'MANAGE', 'Manage time tracking settings', FALSE, 'ADMINISTRATIVE'),

('BILLING:VIEW', 'BILLING', 'VIEW', 'View billing information', FALSE, 'FINANCIAL'),
('BILLING:CREATE', 'BILLING', 'CREATE', 'Create invoices and bills', FALSE, 'FINANCIAL'),
('BILLING:EDIT', 'BILLING', 'EDIT', 'Edit billing rates and records', FALSE, 'FINANCIAL'),
('BILLING:ADMIN', 'BILLING', 'ADMIN', 'Full billing administration', FALSE, 'FINANCIAL'),

-- Task Management (NEW)
('TASK:VIEW_OWN', 'TASK', 'VIEW_OWN', 'View own tasks', FALSE, 'BASIC'),
('TASK:CREATE', 'TASK', 'CREATE', 'Create new tasks', FALSE, 'BASIC'),
('TASK:ASSIGN', 'TASK', 'ASSIGN', 'Assign tasks to others', FALSE, 'ADMINISTRATIVE'),
('TASK:VIEW_TEAM', 'TASK', 'VIEW_TEAM', 'View team tasks', FALSE, 'ADMINISTRATIVE'),
('TASK:VIEW_ALL', 'TASK', 'VIEW_ALL', 'View all tasks', FALSE, 'ADMINISTRATIVE'),
('TASK:ADMIN', 'TASK', 'ADMIN', 'Full task administration', FALSE, 'ADMINISTRATIVE'),

-- Client Management
('CLIENT:VIEW', 'CLIENT', 'VIEW', 'View client details', FALSE, 'BASIC'),
('CLIENT:CREATE', 'CLIENT', 'CREATE', 'Create new clients', FALSE, 'BASIC'),
('CLIENT:EDIT', 'CLIENT', 'EDIT', 'Edit client information', TRUE, 'BASIC'),
('CLIENT:DELETE', 'CLIENT', 'DELETE', 'Delete client records', TRUE, 'ADMINISTRATIVE'),
('CLIENT:ADMIN', 'CLIENT', 'ADMIN', 'Full client administration', FALSE, 'ADMINISTRATIVE'),

-- Calendar Management
('CALENDAR:VIEW', 'CALENDAR', 'VIEW', 'View calendar events', FALSE, 'BASIC'),
('CALENDAR:CREATE', 'CALENDAR', 'CREATE', 'Create calendar events', FALSE, 'BASIC'),
('CALENDAR:EDIT', 'CALENDAR', 'EDIT', 'Edit calendar events', TRUE, 'BASIC'),
('CALENDAR:DELETE', 'CALENDAR', 'DELETE', 'Delete calendar events', TRUE, 'BASIC'),
('CALENDAR:ADMIN', 'CALENDAR', 'ADMIN', 'Full calendar administration', FALSE, 'ADMINISTRATIVE'),

-- System Administration
('USER:VIEW', 'USER', 'VIEW', 'View user information', FALSE, 'ADMINISTRATIVE'),
('USER:CREATE', 'USER', 'CREATE', 'Create new users', FALSE, 'ADMINISTRATIVE'),
('USER:EDIT', 'USER', 'EDIT', 'Edit user information', FALSE, 'ADMINISTRATIVE'),
('USER:ADMIN', 'USER', 'ADMIN', 'Full user administration', FALSE, 'SYSTEM'),

('ROLE:VIEW', 'ROLE', 'VIEW', 'View role information', FALSE, 'ADMINISTRATIVE'),
('ROLE:CREATE', 'ROLE', 'CREATE', 'Create new roles', FALSE, 'SYSTEM'),
('ROLE:EDIT', 'ROLE', 'EDIT', 'Edit role permissions', FALSE, 'SYSTEM'),
('ROLE:ASSIGN', 'ROLE', 'ASSIGN', 'Assign roles to users', FALSE, 'ADMINISTRATIVE'),
('ROLE:ADMIN', 'ROLE', 'ADMIN', 'Full role administration', FALSE, 'SYSTEM'),

('SYSTEM:VIEW', 'SYSTEM', 'VIEW', 'View system information', FALSE, 'SYSTEM'),
('SYSTEM:ADMIN', 'SYSTEM', 'ADMIN', 'Full system administration', FALSE, 'SYSTEM');

-- 11. Assign Permissions Based on Hierarchy
-- Managing Partners get all permissions
INSERT INTO role_permissions_new (role_id, permission_id)
SELECT r.id, p.id FROM roles_new r CROSS JOIN permissions_new p
WHERE r.name = 'MANAGING_PARTNER';

-- Senior Partners get most permissions except system admin
INSERT INTO role_permissions_new (role_id, permission_id)
SELECT r.id, p.id FROM roles_new r CROSS JOIN permissions_new p
WHERE r.name = 'SENIOR_PARTNER' 
AND p.permission_category != 'SYSTEM';

-- Equity Partners get administrative permissions
INSERT INTO role_permissions_new (role_id, permission_id)
SELECT r.id, p.id FROM roles_new r CROSS JOIN permissions_new p
WHERE r.name = 'EQUITY_PARTNER' 
AND p.permission_category IN ('BASIC', 'ADMINISTRATIVE', 'FINANCIAL');

-- Associates get basic and some administrative permissions
INSERT INTO role_permissions_new (role_id, permission_id)
SELECT r.id, p.id FROM roles_new r CROSS JOIN permissions_new p
WHERE r.name IN ('ASSOCIATE', 'SENIOR_ASSOCIATE') 
AND (p.permission_category = 'BASIC' OR 
     (p.permission_category = 'ADMINISTRATIVE' AND p.resource_type IN ('CASE', 'DOCUMENT', 'CLIENT', 'TASK')));

-- Junior Associates get basic permissions
INSERT INTO role_permissions_new (role_id, permission_id)
SELECT r.id, p.id FROM roles_new r CROSS JOIN permissions_new p
WHERE r.name = 'JUNIOR_ASSOCIATE' 
AND p.permission_category = 'BASIC';

-- Paralegals get specific support permissions
INSERT INTO role_permissions_new (role_id, permission_id)
SELECT r.id, p.id FROM roles_new r CROSS JOIN permissions_new p
WHERE r.name IN ('PARALEGAL', 'SENIOR_PARALEGAL') 
AND (p.name LIKE '%:VIEW%' OR p.name LIKE '%:CREATE' OR p.name LIKE '%:EDIT%')
AND p.resource_type IN ('CASE', 'DOCUMENT', 'CLIENT', 'CALENDAR', 'TIME_TRACKING', 'TASK');

-- Administrative roles get their specific permissions
INSERT INTO role_permissions_new (role_id, permission_id)
SELECT r.id, p.id FROM roles_new r CROSS JOIN permissions_new p
WHERE r.name = 'CFO' 
AND p.resource_type IN ('FINANCIAL', 'BILLING');

-- ROLE_ADMIN gets all permissions for backward compatibility
INSERT INTO role_permissions_new (role_id, permission_id)
SELECT r.id, p.id FROM roles_new r CROSS JOIN permissions_new p
WHERE r.name = 'ROLE_ADMIN';

-- 12. Migrate existing data
INSERT IGNORE INTO user_roles_new (user_id, role_id, is_primary, assigned_at)
SELECT ur.user_id, 
       COALESCE(rn.id, (SELECT id FROM roles_new WHERE name = 'ROLE_USER')),
       TRUE,
       NOW()
FROM user_roles ur 
LEFT JOIN roles r ON ur.role_id = r.id
LEFT JOIN roles_new rn ON r.name = rn.name;

-- 13. Replace old tables with new ones
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS permissions;

RENAME TABLE roles_new TO roles;
RENAME TABLE permissions_new TO permissions;
RENAME TABLE role_permissions_new TO role_permissions;
RENAME TABLE user_roles_new TO user_roles;

-- 14. Create audit trail table
CREATE TABLE IF NOT EXISTS rbac_audit_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED,
    action_type ENUM('ROLE_ASSIGNED', 'ROLE_REMOVED', 'PERMISSION_GRANTED', 'PERMISSION_REVOKED', 'CONTEXT_ASSIGNED') NOT NULL,
    target_user_id BIGINT UNSIGNED,
    role_id BIGINT UNSIGNED,
    permission_id BIGINT,
    context_type VARCHAR(50),
    context_id BIGINT UNSIGNED,
    details JSON,
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE SET NULL,
    
    INDEX idx_user_action (user_id, action_type),
    INDEX idx_target_user (target_user_id),
    INDEX idx_performed_at (performed_at)
);

COMMIT; 
 
 