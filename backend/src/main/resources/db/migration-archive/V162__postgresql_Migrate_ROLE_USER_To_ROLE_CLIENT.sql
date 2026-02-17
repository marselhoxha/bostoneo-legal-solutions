-- Migrate client users from ROLE_USER to ROLE_CLIENT
-- ROLE_USER was incorrectly used for client users; ROLE_CLIENT is the proper role
-- that the ClientPortalController and other backend checks expect.

-- Step 1: Copy ROLE_USER permissions to ROLE_CLIENT (if not already present)
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    (SELECT id FROM roles WHERE name = 'ROLE_CLIENT'),
    rp.permission_id
FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
WHERE r.name = 'ROLE_USER'
ON CONFLICT DO NOTHING;

-- Step 2: Update all users with ROLE_USER to ROLE_CLIENT
UPDATE user_roles
SET role_id = (SELECT id FROM roles WHERE name = 'ROLE_CLIENT')
WHERE role_id = (SELECT id FROM roles WHERE name = 'ROLE_USER');
