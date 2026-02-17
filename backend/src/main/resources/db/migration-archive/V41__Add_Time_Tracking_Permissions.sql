-- Add TIME_TRACKING permissions

-- First, ensure the permissions exist
INSERT IGNORE INTO permissions (name, resource_type, action_type, description, is_contextual) VALUES
('TIME_TRACKING:VIEW_OWN', 'TIME_TRACKING', 'VIEW_OWN', 'View own time entries', FALSE),
('TIME_TRACKING:VIEW_ALL', 'TIME_TRACKING', 'VIEW_ALL', 'View all time entries', FALSE),
('TIME_TRACKING:VIEW_TEAM', 'TIME_TRACKING', 'VIEW_TEAM', 'View team time entries', FALSE),
('TIME_TRACKING:CREATE', 'TIME_TRACKING', 'CREATE', 'Create time entries', FALSE),
('TIME_TRACKING:EDIT', 'TIME_TRACKING', 'EDIT', 'Edit time entries', FALSE),
('TIME_TRACKING:DELETE', 'TIME_TRACKING', 'DELETE', 'Delete time entries', FALSE),
('TIME_TRACKING:APPROVE', 'TIME_TRACKING', 'APPROVE', 'Approve time entries', FALSE),
('TIME_TRACKING:EXPORT', 'TIME_TRACKING', 'EXPORT', 'Export time entries', FALSE);

-- Grant all TIME_TRACKING permissions to ROLE_ADMIN
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'ROLE_ADMIN'),
    id
FROM permissions
WHERE resource_type = 'TIME_TRACKING';

-- Grant appropriate TIME_TRACKING permissions to ROLE_ATTORNEY
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'ROLE_ATTORNEY'),
    id
FROM permissions
WHERE resource_type = 'TIME_TRACKING' 
  AND action_type IN ('VIEW_OWN', 'VIEW_TEAM', 'CREATE', 'EDIT');

-- Grant appropriate TIME_TRACKING permissions to ROLE_PARALEGAL
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'ROLE_PARALEGAL'),
    id
FROM permissions
WHERE resource_type = 'TIME_TRACKING' 
  AND action_type IN ('VIEW_OWN', 'CREATE', 'EDIT');

-- Grant basic TIME_TRACKING permissions to ROLE_USER
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'ROLE_USER'),
    id
FROM permissions
WHERE resource_type = 'TIME_TRACKING' 
  AND action_type IN ('VIEW_OWN', 'CREATE');

-- Grant view own permission to ROLE_CLIENT
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'ROLE_CLIENT'),
    id
FROM permissions
WHERE resource_type = 'TIME_TRACKING' 
  AND action_type = 'VIEW_OWN';

-- Also grant to ADMINISTRATOR role if it exists
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'ADMINISTRATOR'),
    id
FROM permissions
WHERE resource_type = 'TIME_TRACKING';