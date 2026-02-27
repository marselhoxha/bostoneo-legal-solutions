-- V4__superadmin_role_cleanup.sql
-- Separate SUPERADMIN from organization context (platform-level role, not org-bound)

-- Remove organization binding from SUPERADMIN users
UPDATE users SET organization_id = NULL
WHERE id IN (
    SELECT ur.user_id FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE r.name = 'ROLE_SUPERADMIN'
);

-- Remove non-SUPERADMIN roles from SUPERADMIN users (clean separation)
DELETE FROM user_roles
WHERE user_id IN (
    SELECT ur2.user_id FROM user_roles ur2
    JOIN roles r2 ON ur2.role_id = r2.id
    WHERE r2.name = 'ROLE_SUPERADMIN'
)
AND role_id NOT IN (
    SELECT id FROM roles WHERE name = 'ROLE_SUPERADMIN'
);
