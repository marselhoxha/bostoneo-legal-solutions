-- Fix role permissions: ensure ROLE_ADMIN has ALL permissions,
-- and ROLE_ATTORNEY and ROLE_FINANCE have appropriate permissions.
-- Uses ON CONFLICT DO NOTHING for idempotency.

-- ROLE_ADMIN (id=20) gets ALL permissions (admin should have full access)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 20, p.id FROM permissions p
WHERE NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = 20 AND rp.permission_id = p.id
);

-- ROLE_ATTORNEY (id=22) gets time tracking, invoices, cases, documents, calendar, tasks, AI, legal drafting
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

-- ROLE_FINANCE (id=107) gets billing, invoices, expenses, payments, reports
INSERT INTO role_permissions (role_id, permission_id)
SELECT 107, p.id FROM permissions p
WHERE (
    p.resource_type IN ('BILLING', 'INVOICE', 'EXPENSE', 'PAYMENT_TRANSACTION', 'REPORT')
    OR p.name IN ('CASE:VIEW', 'CLIENT:VIEW', 'DOCUMENT:VIEW', 'USER:VIEW')
)
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = 107 AND rp.permission_id = p.id
);

-- ROLE_PARALEGAL (id=11 if exists as system role, otherwise check)
-- Gets case support, documents, limited time tracking
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'PARALEGAL'
AND (
    p.name IN ('CASE:VIEW', 'CASE:CREATE', 'CASE:EDIT',
               'DOCUMENT:VIEW', 'DOCUMENT:CREATE', 'DOCUMENT:EDIT',
               'CLIENT:VIEW', 'CLIENT:CREATE',
               'TIME_TRACKING:VIEW_OWN', 'TIME_TRACKING:CREATE', 'TIME_TRACKING:EDIT_OWN',
               'TASK:VIEW_OWN', 'TASK:CREATE', 'TASK:EDIT',
               'CALENDAR:VIEW', 'CALENDAR:CREATE',
               'DOCUMENT_UPLOAD', 'DOCUMENT:SHARE')
)
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- ROLE_SECRETARY (id=13) gets basic access
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
