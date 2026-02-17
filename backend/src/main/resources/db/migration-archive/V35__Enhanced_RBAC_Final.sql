-- Final Enhanced RBAC System Implementation
-- Complete the migration and replace old tables

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

-- Check if we need to transfer data and rename tables
-- Only proceed if the enhanced tables exist and old tables still exist

-- Transfer remaining data if needed
INSERT IGNORE INTO user_roles_enhanced (user_id, role_id, is_primary, assigned_at)
SELECT ur.user_id, 
       COALESCE(re.id, (SELECT id FROM roles_enhanced WHERE name = 'ROLE_USER')),
       TRUE,
       NOW()
FROM UserRoles ur 
LEFT JOIN roles_enhanced re ON ur.role_id = re.id
WHERE NOT EXISTS (
    SELECT 1 FROM user_roles_enhanced ure 
    WHERE ure.user_id = ur.user_id AND ure.role_id = COALESCE(re.id, (SELECT id FROM roles_enhanced WHERE name = 'ROLE_USER'))
);

-- Backup and replace old tables only if they exist
-- Check and handle UserRoles table
DROP TABLE IF EXISTS user_roles_backup_final;
RENAME TABLE UserRoles TO user_roles_backup_final;

-- Create the final tables with correct names
RENAME TABLE user_roles_enhanced TO user_roles;

-- Add missing foreign key constraints if needed
ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_fk 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_fk 
FOREIGN KEY (role_id) REFERENCES roles_enhanced(id) ON DELETE CASCADE;

-- Rename enhanced tables to final names
RENAME TABLE roles_enhanced TO roles;
RENAME TABLE permissions_enhanced TO permissions;
RENAME TABLE role_permissions_enhanced TO role_permissions;

-- Create comprehensive view for user permissions
CREATE OR REPLACE VIEW user_effective_permissions AS
SELECT 
    u.id as user_id,
    u.email,
    u.firstName,
    u.lastName,
    GROUP_CONCAT(DISTINCT r.name) as roles,
    GROUP_CONCAT(DISTINCT r.display_name) as role_display_names,
    MAX(r.hierarchy_level) as max_hierarchy_level,
    GROUP_CONCAT(DISTINCT p.name) as permissions,
    CASE WHEN MAX(r.hierarchy_level) >= 70 THEN TRUE ELSE FALSE END as has_administrative_access,
    CASE WHEN MAX(CASE WHEN r.role_category = 'FINANCIAL' OR (r.role_category = 'LEGAL' AND r.hierarchy_level >= 80) THEN 1 ELSE 0 END) = 1 THEN TRUE ELSE FALSE END as has_financial_access
FROM users u
JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = TRUE
JOIN roles r ON ur.role_id = r.id AND r.is_active = TRUE
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE u.enabled = TRUE
GROUP BY u.id, u.email, u.firstName, u.lastName;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Update existing users to have proper role assignments
-- Ensure all active users have at least ROLE_USER
INSERT IGNORE INTO user_roles (user_id, role_id, is_primary, assigned_at)
SELECT u.id, r.id, FALSE, NOW()
FROM users u
CROSS JOIN roles r
WHERE r.name = 'ROLE_USER'
AND u.enabled = TRUE
AND NOT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id
);

COMMIT; 
 
 