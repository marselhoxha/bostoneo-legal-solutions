-- Seed all permissions (production had empty permissions table)
-- Then assign permissions to all roles

 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (1, 'CASE:VIEW', 'CASE', 'VIEW', 'View case details', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (2, 'CASE:CREATE', 'CASE', 'CREATE', 'Create new cases', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (3, 'CASE:EDIT', 'CASE', 'EDIT', 'Edit case details', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (4, 'CASE:DELETE', 'CASE', 'DELETE', 'Delete cases', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (5, 'CASE:ASSIGN', 'CASE', 'ASSIGN', 'Assign cases to team members', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (6, 'CASE:ADMIN', 'CASE', 'ADMIN', 'Full case administration', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (7, 'DOCUMENT:VIEW', 'DOCUMENT', 'VIEW', 'View documents', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (8, 'DOCUMENT:CREATE', 'DOCUMENT', 'CREATE', 'Upload new documents', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (9, 'DOCUMENT:EDIT', 'DOCUMENT', 'EDIT', 'Edit document metadata', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (10, 'DOCUMENT:DELETE', 'DOCUMENT', 'DELETE', 'Delete documents', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (11, 'DOCUMENT:ADMIN', 'DOCUMENT', 'ADMIN', 'Full document administration', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (12, 'TIME_TRACKING:VIEW_OWN', 'TIME_TRACKING', 'VIEW_OWN', 'View own time entries', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (13, 'TIME_TRACKING:EDIT_OWN', 'TIME_TRACKING', 'EDIT_OWN', 'Edit own time entries', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (14, 'TIME_TRACKING:VIEW_TEAM', 'TIME_TRACKING', 'VIEW_TEAM', 'View team time entries', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (15, 'TIME_TRACKING:VIEW_ALL', 'TIME_TRACKING', 'VIEW_ALL', 'View all time entries', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (16, 'TIME_TRACKING:APPROVE', 'TIME_TRACKING', 'APPROVE', 'Approve time entries', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (17, 'TIME_TRACKING:MANAGE', 'TIME_TRACKING', 'MANAGE', 'Manage time tracking settings', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (18, 'TIME_TRACKING:CREATE', 'TIME_TRACKING', 'CREATE', 'Create time entries', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (19, 'TIME_TRACKING:EDIT', 'TIME_TRACKING', 'EDIT', 'Edit time entries', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (20, 'BILLING:VIEW', 'BILLING', 'VIEW', 'View billing information', 'FINANCIAL') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (21, 'BILLING:CREATE', 'BILLING', 'CREATE', 'Create invoices and bills', 'FINANCIAL') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (22, 'BILLING:EDIT', 'BILLING', 'EDIT', 'Edit billing rates and records', 'FINANCIAL') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (23, 'BILLING:ADMIN', 'BILLING', 'ADMIN', 'Full billing administration', 'FINANCIAL') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (24, 'TASK:VIEW_OWN', 'TASK', 'VIEW_OWN', 'View own tasks', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (25, 'TASK:CREATE', 'TASK', 'CREATE', 'Create new tasks', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (26, 'TASK:ASSIGN', 'TASK', 'ASSIGN', 'Assign tasks to others', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (27, 'TASK:VIEW_TEAM', 'TASK', 'VIEW_TEAM', 'View team tasks', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (28, 'TASK:VIEW_ALL', 'TASK', 'VIEW_ALL', 'View all tasks', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (29, 'TASK:ADMIN', 'TASK', 'ADMIN', 'Full task administration', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (30, 'CLIENT:VIEW', 'CLIENT', 'VIEW', 'View client details', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (31, 'CLIENT:CREATE', 'CLIENT', 'CREATE', 'Create new clients', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (32, 'CLIENT:EDIT', 'CLIENT', 'EDIT', 'Edit client information', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (33, 'CLIENT:DELETE', 'CLIENT', 'DELETE', 'Delete client records', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (34, 'CLIENT:ADMIN', 'CLIENT', 'ADMIN', 'Full client administration', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (35, 'CALENDAR:VIEW', 'CALENDAR', 'VIEW', 'View calendar events', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (36, 'CALENDAR:CREATE', 'CALENDAR', 'CREATE', 'Create calendar events', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (37, 'CALENDAR:EDIT', 'CALENDAR', 'EDIT', 'Edit calendar events', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (38, 'CALENDAR:DELETE', 'CALENDAR', 'DELETE', 'Delete calendar events', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (39, 'CALENDAR:ADMIN', 'CALENDAR', 'ADMIN', 'Full calendar administration', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (40, 'EXPENSE:VIEW', 'EXPENSE', 'VIEW', 'View expense records', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (41, 'EXPENSE:CREATE', 'EXPENSE', 'CREATE', 'Create expense records', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (42, 'EXPENSE:EDIT', 'EXPENSE', 'EDIT', 'Edit expense records', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (43, 'EXPENSE:ADMIN', 'EXPENSE', 'ADMIN', 'Full expense administration', 'FINANCIAL') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (44, 'REPORT:VIEW_OWN', 'REPORT', 'VIEW_OWN', 'View own reports', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (45, 'REPORT:VIEW_TEAM', 'REPORT', 'VIEW_TEAM', 'View team reports', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (46, 'REPORT:VIEW_ALL', 'REPORT', 'VIEW_ALL', 'View all reports', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (47, 'REPORT:CREATE', 'REPORT', 'CREATE', 'Create custom reports', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (48, 'REPORT:ADMIN', 'REPORT', 'ADMIN', 'Full reporting administration', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (49, 'USER:VIEW', 'USER', 'VIEW', 'View user information', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (50, 'USER:CREATE', 'USER', 'CREATE', 'Create new users', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (51, 'USER:EDIT', 'USER', 'EDIT', 'Edit user information', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (52, 'USER:ADMIN', 'USER', 'ADMIN', 'Full user administration', 'SYSTEM') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (53, 'ROLE:VIEW', 'ROLE', 'VIEW', 'View role information', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (54, 'ROLE:CREATE', 'ROLE', 'CREATE', 'Create new roles', 'SYSTEM') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (55, 'ROLE:EDIT', 'ROLE', 'EDIT', 'Edit role permissions', 'SYSTEM') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (56, 'ROLE:ASSIGN', 'ROLE', 'ASSIGN', 'Assign roles to users', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (57, 'ROLE:ADMIN', 'ROLE', 'ADMIN', 'Full role administration', 'SYSTEM') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (58, 'SYSTEM:VIEW', 'SYSTEM', 'VIEW', 'View system information', 'SYSTEM') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (59, 'SYSTEM:ADMIN', 'SYSTEM', 'ADMIN', 'Full system administration', 'SYSTEM') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (60, 'ADMINISTRATIVE:VIEW', 'ADMINISTRATIVE', 'VIEW', 'View administrative dashboard and audit logs', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (61, 'TIME_TRACKING:DELETE', 'TIME_TRACKING', 'DELETE', 'Delete time tracking entries and timers', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (63, 'CUSTOMER:VIEW', 'CLIENT', 'VIEW', 'View customers', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (64, 'CUSTOMER:CREATE', 'CLIENT', 'CREATE', 'Create customers', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (65, 'CUSTOMER:EDIT', 'CLIENT', 'EDIT', 'Edit customers', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (66, 'CUSTOMER:DELETE', 'CLIENT', 'DELETE', 'Delete customers', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (67, 'CUSTOMER:ADMIN', 'CLIENT', 'ADMIN', 'Full customer management', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (68, 'TIME_TRACKING:EXPORT', 'TIME_TRACKING', 'EXPORT', 'Export time entries', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (76, 'BILLING:DELETE', 'BILLING', 'DELETE', 'Delete billing information', 'FINANCIAL') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (77, 'CREATE:INVOICE', 'INVOICE', 'CREATE', 'Can create invoices', 'FINANCIAL') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (78, 'READ:INVOICE', 'INVOICE', 'READ', 'Can view invoices', 'FINANCIAL') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (79, 'UPDATE:INVOICE', 'INVOICE', 'UPDATE', 'Can update invoices', 'FINANCIAL') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (80, 'DELETE:INVOICE', 'INVOICE', 'DELETE', 'Can delete invoices', 'FINANCIAL') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (81, 'APPROVE:INVOICE', 'INVOICE', 'APPROVE', 'Can approve invoices', 'FINANCIAL') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (82, 'SEND:INVOICE', 'INVOICE', 'SEND', 'Can send invoices', 'FINANCIAL') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (83, 'INVOICE:ADMIN', 'INVOICE', 'ADMIN', 'Full invoice administration', 'FINANCIAL') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (84, 'READ:PAYMENT_TRANSACTION', 'PAYMENT_TRANSACTION', 'READ', 'Can view payment transactions', 'FINANCIAL') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (85, 'CREATE:PAYMENT_TRANSACTION', 'PAYMENT_TRANSACTION', 'CREATE', 'Can create payment transactions', 'FINANCIAL') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (86, 'UPDATE:PAYMENT_TRANSACTION', 'PAYMENT_TRANSACTION', 'UPDATE', 'Can update payment transactions', 'FINANCIAL') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (87, 'DELETE:PAYMENT_TRANSACTION', 'PAYMENT_TRANSACTION', 'DELETE', 'Can delete payment transactions', 'FINANCIAL') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (88, 'INVOICE:VIEW', 'INVOICE', 'VIEW', 'Can view invoices', 'FINANCIAL') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (89, 'INVOICE:READ', 'INVOICE', 'READ', 'Can read invoices', 'FINANCIAL') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (90, 'INVOICE:CREATE', 'INVOICE', 'CREATE', 'Can create invoices', 'FINANCIAL') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (91, 'INVOICE:UPDATE', 'INVOICE', 'UPDATE', 'Can update invoices', 'FINANCIAL') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (92, 'INVOICE:DELETE', 'INVOICE', 'DELETE', 'Can delete invoices', 'FINANCIAL') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (93, 'INVOICE:APPROVE', 'INVOICE', 'APPROVE', 'Can approve invoices', 'FINANCIAL') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (94, 'INVOICE:SEND', 'INVOICE', 'SEND', 'Can send invoices', 'FINANCIAL') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (102, 'TASK:EDIT', 'TASK', 'EDIT', 'Edit and update tasks', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (103, 'TASK:DELETE', 'TASK', 'DELETE', 'Delete tasks', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (104, 'DOCUMENT:MANAGE_CASE_FILES', 'DOCUMENT', 'MANAGE_CASE_FILES', 'Manage files associated with legal cases', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (105, 'DOCUMENT:MANAGE_PERMISSIONS', 'DOCUMENT', 'MANAGE_PERMISSIONS', 'Manage file access permissions', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (106, 'DOCUMENT:SHARE_WITH_CLIENTS', 'DOCUMENT', 'SHARE_WITH_CLIENTS', 'Share files with clients', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (107, 'DOCUMENT:VIEW_DEPARTMENT_FILES', 'DOCUMENT', 'VIEW_DEPARTMENT_FILES', 'View files from same department', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (108, 'DOCUMENT:ACCESS_ALL_FILES', 'DOCUMENT', 'ACCESS_ALL_FILES', 'Access all files in system', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (109, 'DOCUMENT:SHARE', 'DOCUMENT', 'SHARE', 'Share documents with others', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (115, 'USER:DELETE', 'USER', 'DELETE', 'Permission to delete users', 'SYSTEM') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (116, 'LEGAL_DRAFTING_CREATE', 'LEGAL_DRAFTING', 'CREATE', 'Create legal documents using AI drafting system', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (117, 'LEGAL_DRAFTING_VIEW', 'LEGAL_DRAFTING', 'READ', 'View legal drafting sessions and documents', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (118, 'LEGAL_DRAFTING_MANAGE', 'LEGAL_DRAFTING', 'MANAGE', 'Manage legal drafting templates and workflows', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (119, 'TEMPLATE_CREATE', 'TEMPLATES', 'CREATE', 'Create custom document templates', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (120, 'TEMPLATE_MANAGE', 'TEMPLATES', 'MANAGE', 'Manage and modify document templates', 'ADMINISTRATIVE') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (121, 'DOCUMENT_UPLOAD', 'DOCUMENTS', 'CREATE', 'Upload documents for analysis and drafting context', 'BASIC') ON CONFLICT (id) DO NOTHING;
 INSERT INTO permissions (id, name, resource_type, action_type, description, permission_category) VALUES (122, 'AI_ANALYSIS_VIEW', 'AI_ANALYSIS', 'READ', 'View AI document analysis results', 'BASIC') ON CONFLICT (id) DO NOTHING;


-- Now assign permissions to roles

-- ROLE_ADMIN (id=20) gets ALL permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 20, p.id FROM permissions p
WHERE NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = 20 AND rp.permission_id = p.id
);

-- ROLE_ATTORNEY (id=22)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 22, p.id FROM permissions p
WHERE (
    p.resource_type IN ('TIME_TRACKING', 'CASE', 'DOCUMENT', 'DOCUMENTS', 'CLIENT', 'CALENDAR', 'TASK', 'AI_ANALYSIS', 'LEGAL_DRAFTING', 'TEMPLATES')
    OR p.name IN ('READ:INVOICE', 'CREATE:INVOICE', 'UPDATE:INVOICE', 'INVOICE:READ', 'INVOICE:CREATE', 'INVOICE:UPDATE', 'INVOICE:VIEW',
                  'BILLING:VIEW', 'BILLING:CREATE', 'BILLING:EDIT',
                  'EXPENSE:VIEW', 'EXPENSE:CREATE', 'EXPENSE:EDIT',
                  'REPORT:VIEW_OWN', 'REPORT:VIEW_TEAM')
)
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = 22 AND rp.permission_id = p.id
);

-- ROLE_FINANCE (id=107)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 107, p.id FROM permissions p
WHERE (
    p.resource_type IN ('BILLING', 'INVOICE', 'EXPENSE', 'PAYMENT_TRANSACTION', 'REPORT')
    OR p.name IN ('CASE:VIEW', 'CLIENT:VIEW', 'DOCUMENT:VIEW', 'USER:VIEW')
)
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = 107 AND rp.permission_id = p.id
);

-- PARALEGAL (id=11)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 11, p.id FROM permissions p
WHERE p.name IN ('CASE:VIEW', 'CASE:CREATE', 'CASE:EDIT',
               'DOCUMENT:VIEW', 'DOCUMENT:CREATE', 'DOCUMENT:EDIT',
               'CLIENT:VIEW', 'CLIENT:CREATE',
               'TIME_TRACKING:VIEW_OWN', 'TIME_TRACKING:CREATE', 'TIME_TRACKING:EDIT_OWN',
               'TASK:VIEW_OWN', 'TASK:CREATE', 'TASK:EDIT',
               'CALENDAR:VIEW', 'CALENDAR:CREATE',
               'DOCUMENT_UPLOAD', 'DOCUMENT:SHARE')
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = 11 AND rp.permission_id = p.id
);

-- ROLE_SECRETARY (id=13)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 13, p.id FROM permissions p
WHERE p.name IN ('CASE:VIEW', 'DOCUMENT:VIEW', 'DOCUMENT:CREATE', 'CLIENT:VIEW', 'CLIENT:CREATE',
                 'CALENDAR:VIEW', 'CALENDAR:CREATE', 'CALENDAR:EDIT',
                 'TIME_TRACKING:VIEW_OWN', 'TIME_TRACKING:CREATE',
                 'TASK:VIEW_OWN', 'TASK:CREATE',
                 'DOCUMENT_UPLOAD')
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = 13 AND rp.permission_id = p.id
);

-- ROLE_USER (id=21)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 21, p.id FROM permissions p
WHERE p.name IN ('CASE:VIEW', 'DOCUMENT:VIEW', 'DOCUMENT:CREATE')
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = 21 AND rp.permission_id = p.id
);

-- ROLE_CLIENT (id=108)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 108, p.id FROM permissions p
WHERE p.name IN ('CASE:VIEW', 'DOCUMENT:VIEW', 'DOCUMENT:CREATE')
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = 108 AND rp.permission_id = p.id
);
