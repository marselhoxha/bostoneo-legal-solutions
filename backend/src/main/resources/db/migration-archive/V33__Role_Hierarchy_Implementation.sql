-- Role Hierarchy Implementation for MySQL

-- Update role table to add hierarchy_level if it doesn't exist
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = DATABASE() AND table_name = 'roles' AND column_name = 'hierarchy_level') = 0,
    'ALTER TABLE roles ADD COLUMN hierarchy_level INTEGER DEFAULT 0',
    'SELECT "hierarchy_level column already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Temporarily disable foreign key checks
SET FOREIGN_KEY_CHECKS = 0;

-- Clear existing role-permission assignments first
DELETE FROM role_permissions;

-- Clear existing user-role assignments
DELETE FROM user_roles;

-- Clear existing case role assignments if table exists
DELETE FROM case_role_assignments WHERE 1=1;

-- Now clear existing system roles
DELETE FROM roles WHERE is_system_role = true;

-- Clear existing permissions
DELETE FROM permissions;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Create predefined roles with hierarchy levels
-- Higher number = higher authority
INSERT INTO roles (name, description, is_system_role, hierarchy_level) VALUES
('ROLE_ADMIN', 'Full system access with all administrative privileges. Can manage users, roles, and system settings.', true, 100),
('ROLE_ATTORNEY', 'Legal professional access with case management, document handling, and client interaction capabilities.', true, 80),
('ROLE_PARALEGAL', 'Legal support access with document preparation, research, and case assistance capabilities.', true, 70),
('ROLE_MANAGER', 'Management level access with team oversight and reporting capabilities.', true, 70),
('ROLE_SECRETARY', 'Administrative support access with scheduling, communication, and basic document management.', true, 60),
('ROLE_CLIENT', 'Client portal access with limited view of assigned cases and documents.', true, 50),
('ROLE_USER', 'Basic user access with limited system functionality and read-only permissions.', true, 10);

-- Resource categories and permission levels
-- Cases
INSERT INTO permissions (name, description, resource_type, action_type) VALUES
('CASE:VIEW', 'View case information', 'CASE', 'VIEW'),
('CASE:CREATE', 'Create new cases', 'CASE', 'CREATE'),
('CASE:EDIT', 'Edit existing cases', 'CASE', 'EDIT'),
('CASE:DELETE', 'Delete cases', 'CASE', 'DELETE'),
('CASE:ADMIN', 'Full case management including permissions', 'CASE', 'ADMIN'),
('CASE:ASSIGN', 'Assign cases to other users', 'CASE', 'EDIT');

-- Documents
INSERT INTO permissions (name, description, resource_type, action_type) VALUES
('DOCUMENT:VIEW', 'View standard documents', 'DOCUMENT', 'VIEW'),
('DOCUMENT:CREATE', 'Create new documents', 'DOCUMENT', 'CREATE'),
('DOCUMENT:EDIT', 'Edit existing documents', 'DOCUMENT', 'EDIT'),
('DOCUMENT:DELETE', 'Delete documents', 'DOCUMENT', 'DELETE'),
('DOCUMENT:ADMIN', 'Full document management including permissions', 'DOCUMENT', 'ADMIN'),
('DOCUMENT:CONFIDENTIAL', 'Access to confidential documents', 'DOCUMENT', 'VIEW');

-- User Management
INSERT INTO permissions (name, description, resource_type, action_type) VALUES
('USER:VIEW', 'View user information', 'USER', 'VIEW'),
('USER:CREATE', 'Create new users', 'USER', 'CREATE'),
('USER:EDIT', 'Edit user information', 'USER', 'EDIT'),
('USER:DELETE', 'Delete users', 'USER', 'DELETE'),
('USER:ADMIN', 'Full user management including permissions', 'USER', 'ADMIN');

-- Calendar & Events
INSERT INTO permissions (name, description, resource_type, action_type) VALUES
('CALENDAR:VIEW', 'View calendars and events', 'CALENDAR', 'VIEW'),
('CALENDAR:CREATE', 'Create calendar events', 'CALENDAR', 'CREATE'),
('CALENDAR:EDIT', 'Edit calendar events', 'CALENDAR', 'EDIT'),
('CALENDAR:DELETE', 'Delete calendar events', 'CALENDAR', 'DELETE'),
('CALENDAR:ADMIN', 'Full calendar management including permissions', 'CALENDAR', 'ADMIN');

-- Administrative functions
INSERT INTO permissions (name, description, resource_type, action_type) VALUES
('ADMINISTRATIVE:VIEW', 'View administrative functions', 'ADMINISTRATIVE', 'VIEW'),
('ADMINISTRATIVE:EDIT', 'Edit administrative settings', 'ADMINISTRATIVE', 'EDIT'),
('ADMINISTRATIVE:ADMIN', 'Full administrative control', 'ADMINISTRATIVE', 'ADMIN');

-- System functions
INSERT INTO permissions (name, description, resource_type, action_type) VALUES
('SYSTEM:VIEW', 'View system information', 'SYSTEM', 'VIEW'),
('SYSTEM:EDIT', 'Edit system settings', 'SYSTEM', 'EDIT'),
('SYSTEM:ADMIN', 'Full system control', 'SYSTEM', 'ADMIN');

-- Assign permissions to roles

-- Administrator permissions (all permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'ROLE_ADMIN';



-- Attorney permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'ROLE_ATTORNEY'
AND p.name IN (
    'CASE:VIEW', 'CASE:CREATE', 'CASE:EDIT', 
    'DOCUMENT:VIEW', 'DOCUMENT:CREATE', 'DOCUMENT:EDIT', 'DOCUMENT:CONFIDENTIAL',
    'USER:VIEW',
    'CALENDAR:VIEW', 'CALENDAR:CREATE', 'CALENDAR:EDIT', 'CALENDAR:DELETE'
);

-- Paralegal permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'ROLE_PARALEGAL'
AND p.name IN (
    'CASE:VIEW', 'CASE:EDIT',
    'DOCUMENT:VIEW', 'DOCUMENT:CREATE', 'DOCUMENT:EDIT',
    'USER:VIEW',
    'CALENDAR:VIEW', 'CALENDAR:CREATE', 'CALENDAR:EDIT'
);

-- Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'ROLE_MANAGER'
AND p.name IN (
    'CASE:VIEW', 'CASE:CREATE', 'CASE:EDIT', 'CASE:ASSIGN',
    'DOCUMENT:VIEW', 'DOCUMENT:CREATE', 'DOCUMENT:EDIT',
    'USER:VIEW', 'USER:EDIT',
    'CALENDAR:VIEW', 'CALENDAR:CREATE', 'CALENDAR:EDIT', 'CALENDAR:DELETE',
    'ADMINISTRATIVE:VIEW'
);

-- Secretary permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'ROLE_SECRETARY'
AND p.name IN (
    'CASE:VIEW',
    'DOCUMENT:VIEW', 'DOCUMENT:CREATE',
    'USER:VIEW',
    'CALENDAR:VIEW', 'CALENDAR:CREATE', 'CALENDAR:EDIT'
);

-- Client permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'ROLE_CLIENT'
AND p.name IN (
    'CASE:VIEW',
    'DOCUMENT:VIEW',
    'CALENDAR:VIEW'
);

-- Basic user permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'ROLE_USER'
AND p.name IN (
    'CALENDAR:VIEW'
);

-- Add audit log table for permission changes if it doesn't exist
CREATE TABLE IF NOT EXISTS permission_audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT,
    action_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id BIGINT,
    description TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_timestamp (timestamp)
);

-- Add case role assignments table if it doesn't exist
CREATE TABLE IF NOT EXISTS case_role_assignments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    assigned_by BIGINT,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT true,
    UNIQUE KEY unique_case_user_role (case_id, user_id, role_id),
    INDEX idx_case_id (case_id),
    INDEX idx_user_id (user_id),
    INDEX idx_role_id (role_id),
    INDEX idx_expires_at (expires_at)
);

-- Ensure user_roles table has primary role and expiration support
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = DATABASE() AND table_name = 'user_roles' AND column_name = 'is_primary') = 0,
    'ALTER TABLE user_roles ADD COLUMN is_primary BOOLEAN DEFAULT false',
    'SELECT "is_primary column already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = DATABASE() AND table_name = 'user_roles' AND column_name = 'expires_at') = 0,
    'ALTER TABLE user_roles ADD COLUMN expires_at TIMESTAMP NULL',
    'SELECT "expires_at column already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

 