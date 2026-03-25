-- V21: Seed SUPERADMIN user for production
-- Only inserts if the user doesn't already exist (idempotent)
-- Password: Use a secure password and change after first login
-- BCrypt hash below is for a temporary password that MUST be changed

-- Insert SUPERADMIN user (organization_id is NULL for platform-level admin)
INSERT INTO users (first_name, last_name, email, password, enabled, non_locked, using_mfa, created_at, organization_id, image_url, address, phone)
SELECT 'Marsel', 'Hoxha', 'marsel.hox@gmail.com',
       '$2a$12$LJ5sFIAFDsXf9CyvTjR9ReyIalDPB0Dv6h28fEV2OSP7JL5bFH9V.',
       true, true, false, NOW(), NULL, NULL, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'marsel.hox@gmail.com');

-- Assign SUPERADMIN role (find role by name, not hardcoded ID)
INSERT INTO user_roles (user_id, role_id, is_primary, is_active, assigned_at)
SELECT u.id, r.id, true, true, NOW()
FROM users u, roles r
WHERE u.email = 'marsel.hox@gmail.com'
  AND r.name = 'ROLE_SUPERADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = u.id AND ur.role_id = r.id
  );
