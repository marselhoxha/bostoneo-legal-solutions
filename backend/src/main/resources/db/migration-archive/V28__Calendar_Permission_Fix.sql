-- Add READ:CALENDAR permission to ROLE_USER
-- First, find the permission ID
SET @calendar_view_perm_id = (SELECT id FROM permissions WHERE resource_type = 'CALENDAR' AND action_type = 'VIEW');

-- Find the ROLE_USER ID
SET @role_user_id = (SELECT id FROM roles WHERE name = 'ROLE_USER');

-- Add the permission to ROLE_USER if it doesn't already exist
INSERT IGNORE INTO role_permissions (role_id, permission_id)
VALUES (@role_user_id, @calendar_view_perm_id);

-- Also fix the permission name to match the actual endpoint requirement
UPDATE permissions 
SET name = 'READ:CALENDAR' 
WHERE resource_type = 'CALENDAR' AND action_type = 'VIEW'; 