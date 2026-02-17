-- PostgreSQL Additional Seed Data Migration
-- Version: V204
-- Description: Populates remaining tables with corrected column names

-- ===============================================
-- TRUST ACCOUNTS (corrected column names)
-- ===============================================
INSERT INTO trust_accounts (
    account_name, account_number, bank_name, account_type, current_balance,
    is_active, organization_id, created_by, created_at, updated_at
) VALUES
('Main IOLTA Account', 'IOLTA-001-2024', 'Bank of America', 'IOLTA', 0.00, TRUE, 1, 1, NOW(), NOW()),
('Client Trust Account', 'TRUST-002-2024', 'Citizens Bank', 'CLIENT_TRUST', 0.00, TRUE, 1, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- FOLDERS (corrected structure)
-- ===============================================
INSERT INTO folders (
    name, parent_folder_id, folder_type, is_template, deleted,
    organization_id, created_by, created_at, updated_at
) VALUES
('Client Documents', NULL, 'GENERAL', FALSE, FALSE, 1, 1, NOW(), NOW()),
('Case Files', NULL, 'CASE', FALSE, FALSE, 1, 1, NOW(), NOW()),
('Templates', NULL, 'TEMPLATE', TRUE, FALSE, 1, 1, NOW(), NOW()),
('Legal Documents', NULL, 'LEGAL', FALSE, FALSE, 1, 1, NOW(), NOW()),
('Immigration Forms', NULL, 'IMMIGRATION', FALSE, FALSE, 1, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- CASE NOTES (corrected structure)
-- ===============================================
INSERT INTO case_notes (
    case_id, title, content, is_private,
    organization_id, user_id, created_at, updated_at
)
SELECT
    lc.id,
    'Initial Consultation',
    'Initial consultation completed. Client provided overview of the matter and discussed goals.',
    FALSE,
    1, 1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

INSERT INTO case_notes (
    case_id, title, content, is_private,
    organization_id, user_id, created_at, updated_at
)
SELECT
    lc.id,
    'Court Filing Note',
    'Filed initial pleadings with the court. Awaiting response from opposing counsel.',
    FALSE,
    1, 1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 3
ON CONFLICT DO NOTHING;

-- ===============================================
-- COMMUNICATION LOGS (corrected structure)
-- ===============================================
INSERT INTO communication_logs (
    case_id, client_id, channel, direction, subject,
    content, from_address, to_address, status,
    organization_id, sent_by_user_id, created_at
)
SELECT
    lc.id,
    lc.client_id,
    'EMAIL',
    'OUTBOUND',
    'Case Update - ' || lc.title,
    'Dear Client, This is to update you on the status of your case. Please contact us with any questions.',
    'attorney@bostoneo.com',
    'client@example.com',
    'SENT',
    1, 1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

INSERT INTO communication_logs (
    case_id, client_id, channel, direction, subject,
    content, from_address, to_address, status, duration_seconds,
    organization_id, sent_by_user_id, created_at
)
SELECT
    lc.id,
    lc.client_id,
    'PHONE',
    'INBOUND',
    'Client Phone Call',
    'Client called to discuss case progress. Provided updates and answered questions.',
    '617-555-0001',
    '617-555-1000',
    'COMPLETED',
    900,
    1, 1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 3
ON CONFLICT DO NOTHING;

-- ===============================================
-- USER NOTIFICATIONS (corrected structure)
-- ===============================================
INSERT INTO user_notifications (
    user_id, title, message, type, priority, read,
    organization_id, created_at
) VALUES
(1, 'Welcome to Bostoneo Legal Solutions', 'Your account has been successfully created.', 'SYSTEM', 'NORMAL', FALSE, 1, NOW()),
(1, 'New Case Assigned', 'You have been assigned to a new case. Please review the details.', 'CASE', 'HIGH', FALSE, 1, NOW()),
(1, 'Task Due Soon', 'A task is due in the next 24 hours.', 'TASK', 'HIGH', FALSE, 1, NOW()),
(1, 'Invoice Payment Received', 'A payment has been received for Invoice #INV-2024-001.', 'BILLING', 'NORMAL', FALSE, 1, NOW()),
(1, 'Calendar Reminder', 'You have a court hearing scheduled tomorrow.', 'CALENDAR', 'HIGH', FALSE, 1, NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- CONFLICT CHECKS (corrected structure)
-- ===============================================
INSERT INTO conflict_checks (
    entity_id, entity_type, check_type, status, search_terms,
    results, organization_id, checked_by, checked_at, created_at
)
SELECT
    lc.id,
    'CASE',
    'NEW_MATTER',
    'CLEARED',
    lc.title,
    '{"conflicts_found": 0, "parties_checked": ["client", "opposing_party"]}',
    1, 1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- VENDORS (corrected structure - simpler)
-- ===============================================
INSERT INTO vendors (name, contact_email, contact_phone, address, created_at, updated_at)
VALUES
('Court Filing Services', 'filing@courts.gov', '617-555-0100', '123 Court St, Boston, MA 02108', NOW(), NOW()),
('Process Server Inc', 'service@processserver.com', '617-555-0101', '456 Main St, Boston, MA 02110', NOW(), NOW()),
('Legal Research Services', 'research@legalresearch.com', '617-555-0102', '789 Law Ave, Boston, MA 02111', NOW(), NOW()),
('Court Reporter Services', 'reports@courtreporter.com', '617-555-0103', '321 Transcript Ln, Boston, MA 02112', NOW(), NOW()),
('Expert Witness LLC', 'expert@expertwitness.com', '617-555-0104', '555 Expert Way, Cambridge, MA 02139', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- EXPENSES (corrected structure)
-- ===============================================
INSERT INTO expenses (
    legal_case_id, client_id, description, amount, currency, date, category_id,
    vendor_id, organization_id, created_at, updated_at
)
SELECT
    lc.id,
    lc.client_id,
    'Court Filing Fee',
    175.0000,
    'USD',
    CURRENT_DATE - INTERVAL '10 days',
    (SELECT id FROM expense_categories WHERE name = 'Court Costs' LIMIT 1),
    (SELECT id FROM vendors WHERE name = 'Court Filing Services' LIMIT 1),
    1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.client_id IS NOT NULL
LIMIT 3
ON CONFLICT DO NOTHING;

INSERT INTO expenses (
    legal_case_id, client_id, description, amount, currency, date, category_id,
    vendor_id, organization_id, created_at, updated_at
)
SELECT
    lc.id,
    lc.client_id,
    'Process Server Fee',
    85.0000,
    'USD',
    CURRENT_DATE - INTERVAL '5 days',
    (SELECT id FROM expense_categories WHERE name = 'Process Server Fees' LIMIT 1),
    (SELECT id FROM vendors WHERE name = 'Process Server Inc' LIMIT 1),
    1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE' AND lc.client_id IS NOT NULL
LIMIT 2
ON CONFLICT DO NOTHING;

-- ===============================================
-- CALENDAR EVENTS (corrected structure)
-- ===============================================
INSERT INTO calendar_events (
    title, description, start_time, end_time, event_type,
    case_id, location, all_day, reminder_minutes, status,
    organization_id, user_id, created_at
)
SELECT
    'Client Meeting - ' || lc.title,
    'Meeting with client to discuss case progress',
    NOW() + INTERVAL '7 days',
    NOW() + INTERVAL '7 days' + INTERVAL '1 hour',
    'MEETING',
    lc.id,
    'Office Conference Room A',
    FALSE,
    60,
    'SCHEDULED',
    1, 1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 3
ON CONFLICT DO NOTHING;

INSERT INTO calendar_events (
    title, description, start_time, end_time, event_type,
    case_id, location, all_day, reminder_minutes, status,
    organization_id, user_id, created_at
)
SELECT
    'Deposition - ' || lc.title,
    'Witness deposition for case',
    NOW() + INTERVAL '14 days',
    NOW() + INTERVAL '14 days' + INTERVAL '4 hours',
    'DEPOSITION',
    lc.id,
    'Conference Room B',
    FALSE,
    1440,
    'SCHEDULED',
    1, 1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 2
ON CONFLICT DO NOTHING;

INSERT INTO calendar_events (
    title, description, start_time, end_time, event_type,
    location, all_day, reminder_minutes, status,
    organization_id, user_id, created_at
) VALUES
('Team Meeting', 'Weekly team sync meeting', NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days' + INTERVAL '1 hour',
 'MEETING', 'Main Conference Room', FALSE, 30, 'SCHEDULED', 1, 1, NOW()),
('Court Holiday', 'Courts closed - Martin Luther King Jr. Day', '2025-01-20', '2025-01-20',
 'HOLIDAY', NULL, TRUE, 1440, 'SCHEDULED', 1, 1, NOW()),
('Filing Deadline', 'Motion response due', NOW() + INTERVAL '10 days', NOW() + INTERVAL '10 days',
 'DEADLINE', NULL, TRUE, 2880, 'SCHEDULED', 1, 1, NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- ADDITIONAL ATTORNEYS
-- ===============================================
INSERT INTO attorneys (
    user_id, bar_number, bar_state, hourly_rate, practice_areas,
    status, organization_id, created_at, updated_at
)
SELECT
    u.id,
    'BBO-' || LPAD(u.id::TEXT, 6, '0'),
    'MA',
    350.00,
    'Civil Litigation, Family Law',
    'ACTIVE',
    1, NOW(), NOW()
FROM users u
WHERE u.organization_id = 1 AND u.id > 1
ON CONFLICT DO NOTHING;

-- ===============================================
-- MESSAGE THREADS AND MESSAGES
-- ===============================================
INSERT INTO message_threads (
    subject, created_by, organization_id, created_at, updated_at
) VALUES
('Case Update: Smith vs Johnson', 1, 1, NOW(), NOW()),
('Document Review Request', 1, 1, NOW(), NOW()),
('Scheduling Conflict', 1, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

INSERT INTO messages (
    thread_id, sender_id, content, is_read, organization_id, created_at
)
SELECT
    mt.id,
    1,
    'Please review the attached documents and provide feedback.',
    FALSE,
    1, NOW()
FROM message_threads mt
WHERE mt.organization_id = 1
LIMIT 3
ON CONFLICT DO NOTHING;

-- ===============================================
-- BILLING CYCLES (if table exists)
-- ===============================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'billing_cycles') THEN
        INSERT INTO billing_cycles (
            name, description, day_of_month, is_active,
            organization_id, created_at, updated_at
        ) VALUES
        ('Monthly - 1st', 'Monthly billing cycle starting on the 1st', 1, TRUE, 1, NOW(), NOW()),
        ('Monthly - 15th', 'Monthly billing cycle starting on the 15th', 15, TRUE, 1, NOW(), NOW()),
        ('End of Month', 'Monthly billing cycle at end of month', 31, TRUE, 1, NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ===============================================
-- SIGNATURE TEMPLATES (if table exists)
-- ===============================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'signature_templates') THEN
        INSERT INTO signature_templates (
            name, description, template_content, document_type,
            organization_id, created_by, created_at, updated_at
        ) VALUES
        ('Engagement Letter Signature', 'Standard engagement letter signature block',
         '{"signatureFields": [{"name": "Client Signature", "required": true}]}',
         'ENGAGEMENT_LETTER', 1, 1, NOW(), NOW()),
        ('Settlement Agreement Signature', 'Settlement agreement dual signature',
         '{"signatureFields": [{"name": "Client Signature", "required": true}, {"name": "Attorney Signature", "required": true}]}',
         'SETTLEMENT', 1, 1, NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- Print summary
DO $$
DECLARE
    trust_count INT;
    folder_count INT;
    note_count INT;
    comm_count INT;
    notif_count INT;
    conflict_count INT;
    vendor_count INT;
    expense_count INT;
    event_count INT;
BEGIN
    SELECT COUNT(*) INTO trust_count FROM trust_accounts;
    SELECT COUNT(*) INTO folder_count FROM folders;
    SELECT COUNT(*) INTO note_count FROM case_notes;
    SELECT COUNT(*) INTO comm_count FROM communication_logs;
    SELECT COUNT(*) INTO notif_count FROM user_notifications;
    SELECT COUNT(*) INTO conflict_count FROM conflict_checks;
    SELECT COUNT(*) INTO vendor_count FROM vendors;
    SELECT COUNT(*) INTO expense_count FROM expenses;
    SELECT COUNT(*) INTO event_count FROM calendar_events;

    RAISE NOTICE 'Additional data population summary:';
    RAISE NOTICE '  Trust Accounts: %', trust_count;
    RAISE NOTICE '  Folders: %', folder_count;
    RAISE NOTICE '  Case Notes: %', note_count;
    RAISE NOTICE '  Communication Logs: %', comm_count;
    RAISE NOTICE '  User Notifications: %', notif_count;
    RAISE NOTICE '  Conflict Checks: %', conflict_count;
    RAISE NOTICE '  Vendors: %', vendor_count;
    RAISE NOTICE '  Expenses: %', expense_count;
    RAISE NOTICE '  Calendar Events: %', event_count;
END $$;
