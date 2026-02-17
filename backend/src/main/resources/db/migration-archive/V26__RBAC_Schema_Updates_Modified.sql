-- Enhance existing roles table (if exists) or create new one
CREATE TABLE IF NOT EXISTS roles (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) UNIQUE NOT NULL,
    permission VARCHAR(500)
);

-- Add new columns to roles table
ALTER TABLE roles 
ADD COLUMN IF NOT EXISTS description VARCHAR(255) NULL;

ALTER TABLE roles
ADD COLUMN IF NOT EXISTS hierarchy_level INT NOT NULL DEFAULT 0;

ALTER TABLE roles
ADD COLUMN IF NOT EXISTS is_system_role BOOLEAN DEFAULT FALSE;

-- Check if permissions table exists, if not create it
CREATE TABLE IF NOT EXISTS permissions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    description VARCHAR(255) NULL,
    resource_type VARCHAR(50) NOT NULL,
    action_type VARCHAR(20) NOT NULL
);

-- Create role-permission mapping table
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id BIGINT UNSIGNED NOT NULL,
    permission_id BIGINT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- Drop existing user_roles if needed
DROP TABLE IF EXISTS user_roles;

-- Create user-role mapping table
CREATE TABLE user_roles (
    user_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- Create case-specific role assignments table
CREATE TABLE IF NOT EXISTS case_role_assignments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    case_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    expires_at TIMESTAMP NULL,
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- Create permission audit logs table
CREATE TABLE IF NOT EXISTS permission_audit_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(20) NOT NULL,
    target_id BIGINT NOT NULL,
    details TEXT NOT NULL,
    performed_by BIGINT UNSIGNED NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clear existing data (if any) to avoid conflicts
TRUNCATE TABLE permissions;

-- Insert default system roles (if they don't exist already)
INSERT IGNORE INTO roles (name, description, hierarchy_level, is_system_role) VALUES
('ADMINISTRATOR', 'System administrator with full access', 0, TRUE),
('MANAGING_PARTNER', 'Managing partner with firm-wide access', 1, TRUE),
('ATTORNEY', 'Attorney with access to assigned cases', 2, TRUE),
('PARALEGAL', 'Paralegal with limited case access', 3, TRUE),
('LEGAL_ASSISTANT', 'Legal assistant with administrative access', 4, TRUE),
('CLIENT', 'Client with access to own cases', 5, TRUE),
('FINANCE', 'Finance role with access to financial data', 3, TRUE);

-- Insert basic permissions
INSERT INTO permissions (name, description, resource_type, action_type) VALUES
-- Case permissions
('case_view', 'View case details', 'CASE', 'VIEW'),
('case_create', 'Create new cases', 'CASE', 'CREATE'),
('case_edit', 'Edit case details', 'CASE', 'EDIT'),
('case_delete', 'Delete cases', 'CASE', 'DELETE'),
('case_admin', 'Full case management', 'CASE', 'ADMIN'),

-- Document permissions
('document_view', 'View documents', 'DOCUMENT', 'VIEW'),
('document_create', 'Upload new documents', 'DOCUMENT', 'CREATE'),
('document_edit', 'Edit document properties', 'DOCUMENT', 'EDIT'),
('document_delete', 'Delete documents', 'DOCUMENT', 'DELETE'),
('document_admin', 'Full document management', 'DOCUMENT', 'ADMIN'),

-- Client data permissions
('client_view', 'View client details', 'CLIENT', 'VIEW'),
('client_create', 'Add new clients', 'CLIENT', 'CREATE'),
('client_edit', 'Edit client details', 'CLIENT', 'EDIT'),
('client_delete', 'Delete client records', 'CLIENT', 'DELETE'),
('client_admin', 'Full client management', 'CLIENT', 'ADMIN'),

-- Calendar permissions
('calendar_view', 'View calendar events', 'CALENDAR', 'VIEW'),
('calendar_create', 'Create calendar events', 'CALENDAR', 'CREATE'),
('calendar_edit', 'Edit calendar events', 'CALENDAR', 'EDIT'),
('calendar_delete', 'Delete calendar events', 'CALENDAR', 'DELETE'),
('calendar_admin', 'Full calendar management', 'CALENDAR', 'ADMIN'),

-- Financial permissions
('financial_view', 'View financial records', 'FINANCIAL', 'VIEW'),
('financial_create', 'Create financial records', 'FINANCIAL', 'CREATE'),
('financial_edit', 'Edit financial records', 'FINANCIAL', 'EDIT'),
('financial_delete', 'Delete financial records', 'FINANCIAL', 'DELETE'),
('financial_admin', 'Full financial management', 'FINANCIAL', 'ADMIN'),

-- Administrative permissions
('admin_view', 'View admin settings', 'ADMINISTRATIVE', 'VIEW'),
('admin_create', 'Create admin settings', 'ADMINISTRATIVE', 'CREATE'),
('admin_edit', 'Edit admin settings', 'ADMINISTRATIVE', 'EDIT'),
('admin_delete', 'Delete admin settings', 'ADMINISTRATIVE', 'DELETE'),
('admin_admin', 'Full system administration', 'ADMINISTRATIVE', 'ADMIN');

-- Clear existing role-permission mappings (if any)
DELETE FROM role_permissions;

-- Assign default permissions to roles
-- Administrator: all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'ADMINISTRATOR'), id FROM permissions;

-- Managing Partner: almost all permissions except full admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'MANAGING_PARTNER'), id FROM permissions
WHERE name != 'admin_admin';

-- Attorney: case, document, client, calendar, but limited admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'ATTORNEY'), id FROM permissions
WHERE resource_type IN ('CASE', 'DOCUMENT', 'CLIENT', 'CALENDAR') 
AND (action_type != 'ADMIN' OR action_type = 'VIEW');

-- Paralegal: limited access
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'PARALEGAL'), id FROM permissions
WHERE (resource_type IN ('CASE', 'DOCUMENT', 'CALENDAR') AND action_type IN ('VIEW', 'CREATE', 'EDIT'))
OR (resource_type = 'CLIENT' AND action_type = 'VIEW');

-- Legal Assistant: very limited access
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'LEGAL_ASSISTANT'), id FROM permissions
WHERE (resource_type = 'CALENDAR' AND action_type IN ('VIEW', 'CREATE', 'EDIT'))
OR (resource_type IN ('CASE', 'CLIENT', 'DOCUMENT') AND action_type = 'VIEW');

-- Client: minimal access
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'CLIENT'), id FROM permissions
WHERE (resource_type IN ('CASE', 'DOCUMENT', 'CALENDAR') AND action_type = 'VIEW');

-- Finance: financial access only
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'FINANCE'), id FROM permissions
WHERE resource_type = 'FINANCIAL'
OR (resource_type = 'CASE' AND action_type = 'VIEW'); 