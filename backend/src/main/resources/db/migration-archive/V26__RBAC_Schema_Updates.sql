-- RBAC Schema Updates

-- Create Roles table if not exists
CREATE TABLE IF NOT EXISTS Roles (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE,
    permission VARCHAR(255),
    description VARCHAR(255),
    hierarchy_level INT DEFAULT 0,
    is_system_role BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create Permissions table if not exists
CREATE TABLE IF NOT EXISTS permissions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    resource_type VARCHAR(50) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_resource_action (resource_type, action_type)
);

-- Create Role-Permission mapping table if not exists
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id BIGINT UNSIGNED NOT NULL,
    permission_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES Roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- Create User-Role mapping table if not exists
CREATE TABLE IF NOT EXISTS UserRoles (
    user_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES Roles(id) ON DELETE CASCADE
);

-- Create Case-Role-Assignment table if not exists
CREATE TABLE IF NOT EXISTS case_role_assignments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    case_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES LegalCases(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES Roles(id) ON DELETE CASCADE,
    UNIQUE KEY unique_case_user_role (case_id, user_id, role_id)
);

-- Create Permission Audit Log table for tracking permission changes
CREATE TABLE IF NOT EXISTS permission_audit_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NULL,
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id BIGINT NOT NULL,
    details TEXT,
    performed_by BIGINT UNSIGNED NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

-- Delete existing role-permission mappings if any
DELETE FROM role_permissions;

-- Delete existing permissions to avoid conflicts
DELETE FROM permissions;

-- Insert default system roles if not exist
INSERT IGNORE INTO Roles (name, description, hierarchy_level, is_system_role)
VALUES 
('ROLE_ADMIN', 'System administrator with full access', 100, TRUE),
('ROLE_USER', 'Regular user with limited access', 10, TRUE),
('ROLE_ATTORNEY', 'Attorney with case management access', 50, TRUE),
('ROLE_PARALEGAL', 'Paralegal with document management access', 30, TRUE),
('ROLE_CLIENT', 'Client with view-only access to their cases', 1, TRUE);

-- Insert default permissions
INSERT IGNORE INTO permissions (name, description, resource_type, action_type)
VALUES
-- Case permissions
('view_cases', 'View case details', 'CASE', 'VIEW'),
('create_cases', 'Create new cases', 'CASE', 'CREATE'),
('edit_cases', 'Edit case details', 'CASE', 'EDIT'),
('delete_cases', 'Delete cases', 'CASE', 'DELETE'),
('admin_cases', 'Administer all cases', 'CASE', 'ADMIN'),

-- Document permissions
('view_documents', 'View documents', 'DOCUMENT', 'VIEW'),
('create_documents', 'Create new documents', 'DOCUMENT', 'CREATE'),
('edit_documents', 'Edit documents', 'DOCUMENT', 'EDIT'),
('delete_documents', 'Delete documents', 'DOCUMENT', 'DELETE'),
('admin_documents', 'Administer all documents', 'DOCUMENT', 'ADMIN'),

-- Client permissions
('view_clients', 'View client details', 'CLIENT', 'VIEW'),
('create_clients', 'Create new clients', 'CLIENT', 'CREATE'),
('edit_clients', 'Edit client details', 'CLIENT', 'EDIT'),
('delete_clients', 'Delete clients', 'CLIENT', 'DELETE'),
('admin_clients', 'Administer all clients', 'CLIENT', 'ADMIN'),

-- Calendar permissions
('view_calendar', 'View calendar events', 'CALENDAR', 'VIEW'),
('create_calendar', 'Create calendar events', 'CALENDAR', 'CREATE'),
('edit_calendar', 'Edit calendar events', 'CALENDAR', 'EDIT'),
('delete_calendar', 'Delete calendar events', 'CALENDAR', 'DELETE'),
('admin_calendar', 'Administer all calendar events', 'CALENDAR', 'ADMIN'),

-- Financial permissions
('view_financial', 'View financial information', 'FINANCIAL', 'VIEW'),
('create_financial', 'Create financial records', 'FINANCIAL', 'CREATE'),
('edit_financial', 'Edit financial records', 'FINANCIAL', 'EDIT'),
('delete_financial', 'Delete financial records', 'FINANCIAL', 'DELETE'),
('admin_financial', 'Administer all financial records', 'FINANCIAL', 'ADMIN'),

-- Administrative permissions
('view_admin', 'View administrative settings', 'ADMINISTRATIVE', 'VIEW'),
('create_admin', 'Create administrative settings', 'ADMINISTRATIVE', 'CREATE'),
('edit_admin', 'Edit administrative settings', 'ADMINISTRATIVE', 'EDIT'),
('delete_admin', 'Delete administrative settings', 'ADMINISTRATIVE', 'DELETE'),
('admin_admin', 'Full administrative control', 'ADMINISTRATIVE', 'ADMIN');

-- Assign default permissions to roles
-- Admin role gets all permissions
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM Roles r, permissions p
WHERE r.name = 'ROLE_ADMIN';

-- Attorney role permissions
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM Roles r, permissions p
WHERE r.name = 'ROLE_ATTORNEY' AND p.name IN (
    'view_cases', 'create_cases', 'edit_cases',
    'view_documents', 'create_documents', 'edit_documents',
    'view_clients', 'create_clients', 'edit_clients',
    'view_calendar', 'create_calendar', 'edit_calendar', 'delete_calendar',
    'view_financial', 'create_financial'
);

-- Paralegal role permissions
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM Roles r, permissions p
WHERE r.name = 'ROLE_PARALEGAL' AND p.name IN (
    'view_cases',
    'view_documents', 'create_documents', 'edit_documents',
    'view_clients',
    'view_calendar', 'create_calendar', 'edit_calendar',
    'view_financial'
);

-- Regular user permissions
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM Roles r, permissions p
WHERE r.name = 'ROLE_USER' AND p.name IN (
    'view_cases',
    'view_documents',
    'view_clients',
    'view_calendar'
);

-- Client role permissions
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM Roles r, permissions p
WHERE r.name = 'ROLE_CLIENT' AND p.name IN (
    'view_cases',
    'view_documents',
    'view_calendar'
); 