-- Fix admin role permissions issue
-- Get role ID for ROLE_ADMIN
SET @admin_role_id = (SELECT id FROM roles WHERE name = 'ROLE_ADMIN');

-- Add permissions explicitly to ensure they're correctly assigned
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT @admin_role_id, id FROM permissions WHERE name IN (
    'ADMINISTRATIVE:VIEW',
    'ADMINISTRATIVE:CREATE', 
    'ADMINISTRATIVE:EDIT',
    'ADMINISTRATIVE:DELETE',
    'ADMINISTRATIVE:ADMIN',
    'ADMINISTRATIVE:MANAGE',
    'USER:VIEW',
    'USER:CREATE',
    'USER:EDIT',
    'USER:DELETE',
    'ROLE:VIEW',
    'ROLE:CREATE',
    'ROLE:EDIT',
    'ROLE:DELETE'
);

-- Also create another migration to fix the permission filtering in SpringSecurity
-- This is to ensure all permissions are included in the JWT
UPDATE roles SET permission = CONCAT(permission, ',access:admin') WHERE name = 'ROLE_ADMIN' AND permission NOT LIKE '%access:admin%'; 