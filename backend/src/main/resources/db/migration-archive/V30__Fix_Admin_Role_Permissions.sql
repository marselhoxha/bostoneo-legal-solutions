-- Fix admin role name by removing duplicate ROLE_ prefix
UPDATE roles SET name = 'ROLE_ADMIN' WHERE name = 'ROLE_ROLE_ADMIN';

-- Make sure ROLE_ADMIN exists
INSERT IGNORE INTO roles (name, description, hierarchy_level, is_system_role)
VALUES ('ROLE_ADMIN', 'System administrator with full access', 0, TRUE);

-- Get the admin role ID
SET @admin_role_id = (SELECT id FROM roles WHERE name = 'ROLE_ADMIN');

-- Add all possible permissions to the admin role
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT @admin_role_id, id FROM permissions
ON DUPLICATE KEY UPDATE role_id = role_id;

-- Make sure permissions have consistent naming format
UPDATE permissions 
SET name = CONCAT(resource_type, ':', action_type)
WHERE name NOT LIKE '%:%';

-- Add missing admin permissions
INSERT IGNORE INTO permissions (name, description, resource_type, action_type)
VALUES 
('ADMINISTRATIVE:VIEW', 'View administrative settings', 'ADMINISTRATIVE', 'VIEW'),
('ADMINISTRATIVE:MANAGE', 'Manage administrative settings', 'ADMINISTRATIVE', 'MANAGE'),
('USER:VIEW', 'View user information', 'USER', 'VIEW'),
('USER:CREATE', 'Create users', 'USER', 'CREATE'),
('USER:EDIT', 'Edit user information', 'USER', 'EDIT'),
('USER:DELETE', 'Delete users', 'USER', 'DELETE'),
('ROLE:VIEW', 'View roles', 'ROLE', 'VIEW'),
('ROLE:CREATE', 'Create roles', 'ROLE', 'CREATE'),
('ROLE:EDIT', 'Edit roles', 'ROLE', 'EDIT'),
('ROLE:DELETE', 'Delete roles', 'ROLE', 'DELETE'),
('CASE:VIEW', 'View cases', 'CASE', 'VIEW'),
('CASE:CREATE', 'Create cases', 'CASE', 'CREATE'),
('CASE:EDIT', 'Edit cases', 'CASE', 'EDIT'),
('CASE:DELETE', 'Delete cases', 'CASE', 'DELETE'),
('CALENDAR:VIEW', 'View calendar events', 'CALENDAR', 'VIEW'),
('CALENDAR:CREATE', 'Create calendar events', 'CALENDAR', 'CREATE'),
('CALENDAR:EDIT', 'Edit calendar events', 'CALENDAR', 'EDIT'),
('CALENDAR:DELETE', 'Delete calendar events', 'CALENDAR', 'DELETE'),
('DOCUMENT:VIEW', 'View documents', 'DOCUMENT', 'VIEW'),
('DOCUMENT:CREATE', 'Create documents', 'DOCUMENT', 'CREATE'),
('DOCUMENT:EDIT', 'Edit documents', 'DOCUMENT', 'EDIT'),
('DOCUMENT:DELETE', 'Delete documents', 'DOCUMENT', 'DELETE'),
('EXPENSE:VIEW', 'View expenses', 'EXPENSE', 'VIEW'),
('EXPENSE:CREATE', 'Create expenses', 'EXPENSE', 'CREATE'),
('EXPENSE:EDIT', 'Edit expenses', 'EXPENSE', 'EDIT'),
('EXPENSE:DELETE', 'Delete expenses', 'EXPENSE', 'DELETE'),
('INVOICE:VIEW', 'View invoices', 'INVOICE', 'VIEW'),
('INVOICE:CREATE', 'Create invoices', 'INVOICE', 'CREATE'),
('INVOICE:EDIT', 'Edit invoices', 'INVOICE', 'EDIT'),
('INVOICE:DELETE', 'Delete invoices', 'INVOICE', 'DELETE');

-- Insert newly added permissions to admin role
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT @admin_role_id, id FROM permissions 
WHERE id NOT IN (SELECT permission_id FROM role_permissions WHERE role_id = @admin_role_id); 