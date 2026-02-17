-- SQL migration to fix RBAC permissions and ensure alignment between frontend and backend

-- 1. Update permission names to match expected format in JWT and frontend
UPDATE permissions 
SET name = CONCAT(resource_type, ':', action_type)
WHERE name NOT LIKE '%:%';

-- 2. Ensure ROLE_ADMIN exists (which might be different from ADMINISTRATOR role)
INSERT IGNORE INTO roles (name, description, hierarchy_level, is_system_role)
VALUES ('ROLE_ADMIN', 'Admin role with full access', 0, TRUE);

-- 3. Migrate ADMINISTRATOR permissions to ROLE_ADMIN if needed
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'ROLE_ADMIN'),
    permission_id
FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'ADMINISTRATOR');

-- 4. Ensure all key roles exist in expected format
INSERT IGNORE INTO roles (name, description, hierarchy_level, is_system_role) VALUES
('ROLE_USER', 'Basic user with limited access', 10, TRUE),
('ROLE_ATTORNEY', 'Attorney with case access', 2, TRUE),
('ROLE_PARALEGAL', 'Paralegal with limited case access', 3, TRUE),
('ROLE_CLIENT', 'Client with own case access', 5, TRUE);

-- 5. Add basic permissions to ROLE_USER
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'ROLE_USER'),
    id
FROM permissions
WHERE (resource_type = 'CALENDAR' AND action_type = 'VIEW')
   OR (resource_type = 'CASE' AND action_type = 'VIEW')
   OR (resource_type = 'DOCUMENT' AND action_type = 'VIEW');

-- 6. Add appropriate permissions to ROLE_ATTORNEY
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'ROLE_ATTORNEY'),
    id
FROM permissions
WHERE (resource_type IN ('CASE', 'DOCUMENT', 'CLIENT', 'CALENDAR') AND action_type IN ('VIEW', 'CREATE', 'EDIT'))
   OR (resource_type = 'ADMINISTRATIVE' AND action_type = 'VIEW');

-- 7. Add permissions to ROLE_PARALEGAL
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'ROLE_PARALEGAL'),
    id
FROM permissions
WHERE (resource_type IN ('CASE', 'DOCUMENT', 'CALENDAR') AND action_type IN ('VIEW', 'CREATE'))
   OR (resource_type IN ('CLIENT') AND action_type = 'VIEW');

-- 8. Add permissions to ROLE_CLIENT
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'ROLE_CLIENT'),
    id
FROM permissions
WHERE (resource_type IN ('CASE', 'DOCUMENT') AND action_type = 'VIEW')
   OR (resource_type = 'CALENDAR' AND action_type IN ('VIEW', 'CREATE'));

-- 9. Fix any users with no roles by assigning ROLE_USER
INSERT INTO user_roles (user_id, role_id)
SELECT 
    u.id,
    (SELECT id FROM roles WHERE name = 'ROLE_USER')
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = u.id);

-- 10. Fix the Permission format for those with snake_case names to match frontend expected format
UPDATE permissions
SET name = CONCAT(
    UPPER(resource_type), 
    ':', 
    CASE 
        WHEN action_type = 'ADMIN' THEN 'ADMIN'
        WHEN action_type = 'VIEW' THEN 'VIEW'
        WHEN action_type = 'CREATE' THEN 'CREATE'
        WHEN action_type = 'EDIT' THEN 'EDIT'
        WHEN action_type = 'DELETE' THEN 'DELETE'
        ELSE UPPER(action_type)
    END
)
WHERE name LIKE '%\_%'; 