-- Final Enhanced RBAC System Implementation (Corrected)
-- Complete the migration and replace old tables

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

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

-- Backup and replace old tables
DROP TABLE IF EXISTS user_roles_backup_final;
RENAME TABLE UserRoles TO user_roles_backup_final;

-- Rename enhanced tables to final names
RENAME TABLE user_roles_enhanced TO user_roles;
RENAME TABLE roles_enhanced TO roles;
RENAME TABLE permissions_enhanced TO permissions;
RENAME TABLE role_permissions_enhanced TO role_permissions;

-- Create comprehensive view for user permissions with correct column names
CREATE OR REPLACE VIEW user_effective_permissions AS
SELECT 
    u.id as user_id,
    u.email,
    u.first_name,
    u.last_name,
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
GROUP BY u.id, u.email, u.first_name, u.last_name;

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

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Create helpful views for RBAC management
CREATE OR REPLACE VIEW role_summary AS
SELECT 
    r.id,
    r.name,
    r.display_name,
    r.hierarchy_level,
    r.role_category,
    r.max_billing_rate,
    COUNT(ur.user_id) as user_count,
    COUNT(rp.permission_id) as permission_count
FROM roles r
LEFT JOIN user_roles ur ON r.id = ur.role_id AND ur.is_active = TRUE
LEFT JOIN role_permissions rp ON r.id = rp.role_id
WHERE r.is_active = TRUE
GROUP BY r.id, r.name, r.display_name, r.hierarchy_level, r.role_category, r.max_billing_rate;

CREATE OR REPLACE VIEW permission_summary AS
SELECT 
    p.id,
    p.name,
    p.resource_type,
    p.action_type,
    p.permission_category,
    p.is_contextual,
    COUNT(rp.role_id) as role_count
FROM permissions p
LEFT JOIN role_permissions rp ON p.id = rp.permission_id
GROUP BY p.id, p.name, p.resource_type, p.action_type, p.permission_category, p.is_contextual;

COMMIT; 
 
 