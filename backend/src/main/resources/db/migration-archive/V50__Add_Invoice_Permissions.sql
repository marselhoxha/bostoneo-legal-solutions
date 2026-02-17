-- Add Invoice permissions to permissions table
INSERT INTO permissions (name, description, resource_type, action_type, permission_category, is_contextual, created_at, updated_at) VALUES
('CREATE:INVOICE', 'Can create invoices', 'INVOICE', 'CREATE', 'FINANCIAL', 0, NOW(), NOW()),
('READ:INVOICE', 'Can view invoices', 'INVOICE', 'READ', 'FINANCIAL', 0, NOW(), NOW()),
('UPDATE:INVOICE', 'Can update invoices', 'INVOICE', 'UPDATE', 'FINANCIAL', 0, NOW(), NOW()),
('DELETE:INVOICE', 'Can delete invoices', 'INVOICE', 'DELETE', 'FINANCIAL', 0, NOW(), NOW()),
('APPROVE:INVOICE', 'Can approve invoices', 'INVOICE', 'APPROVE', 'FINANCIAL', 0, NOW(), NOW()),
('SEND:INVOICE', 'Can send invoices', 'INVOICE', 'SEND', 'FINANCIAL', 0, NOW(), NOW()),
('INVOICE:ADMIN', 'Full invoice administration', 'INVOICE', 'ADMIN', 'FINANCIAL', 0, NOW(), NOW());

-- Grant invoice permissions to Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'ADMIN' 
AND p.name IN ('CREATE:INVOICE', 'READ:INVOICE', 'UPDATE:INVOICE', 'DELETE:INVOICE', 'APPROVE:INVOICE', 'SEND:INVOICE', 'INVOICE:ADMIN');

-- Grant basic invoice permissions to Manager role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'MANAGER' 
AND p.name IN ('CREATE:INVOICE', 'READ:INVOICE', 'UPDATE:INVOICE', 'APPROVE:INVOICE', 'SEND:INVOICE');

-- Grant invoice permissions to Attorney role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'ATTORNEY' 
AND p.name IN ('READ:INVOICE', 'CREATE:INVOICE', 'UPDATE:INVOICE', 'SEND:INVOICE');

-- Grant invoice read permission to Client role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'CLIENT' 
AND p.name IN ('READ:INVOICE');