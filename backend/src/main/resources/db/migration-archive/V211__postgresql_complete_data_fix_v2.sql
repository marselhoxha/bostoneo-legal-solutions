-- PostgreSQL Complete Data Fix V2
-- Version: V211
-- Description: Adds remaining data with CORRECT column names

-- ===============================================
-- AI WORKSPACE DOCUMENT VERSIONS - No created_by column
-- ===============================================
INSERT INTO ai_workspace_document_versions (
    document_id, version_number, content, created_by_user, organization_id, created_at
)
SELECT
    awd.id,
    1,
    'LEGAL MEMORANDUM

TO: File
FROM: Attorney
RE: ' || awd.title || '
DATE: ' || TO_CHAR(NOW(), 'Month DD, YYYY') || '

ISSUE:
Whether the applicable statute of limitations bars the plaintiff''s claim.

BRIEF ANSWER:
No, the claim is timely filed within the applicable limitations period.

FACTS:
[Detailed facts of the case...]

ANALYSIS:
Under Massachusetts law, the statute of limitations for this type of claim applies...

CONCLUSION:
Based on the foregoing analysis, the claim is timely and should proceed.',
    TRUE,
    1,
    NOW()
FROM ai_workspace_documents awd
WHERE awd.organization_id = 1 AND awd.document_type = 'MEMO'
ON CONFLICT DO NOTHING;

INSERT INTO ai_workspace_document_versions (
    document_id, version_number, content, created_by_user, organization_id, created_at
)
SELECT
    awd.id,
    1,
    '[FIRM LETTERHEAD]

' || TO_CHAR(NOW(), 'Month DD, YYYY') || '

VIA CERTIFIED MAIL, RETURN RECEIPT REQUESTED

[RECIPIENT NAME]
[RECIPIENT ADDRESS]

Re: Demand for Settlement

Dear Sir/Madam:

This firm represents the above-referenced client in connection with this matter.

STATEMENT OF FACTS:
[Detailed factual narrative...]

DAMAGES:
1. Medical Expenses: $XX,XXX.XX
2. Lost Wages: $XX,XXX.XX
3. Pain and Suffering: $XX,XXX.XX

TOTAL DAMAGES: $XXX,XXX.XX

DEMAND:
We hereby demand payment in the amount of $XXX,XXX.XX.

Govern yourself accordingly.

Very truly yours,
[Attorney Name]',
    TRUE,
    1,
    NOW()
FROM ai_workspace_documents awd
WHERE awd.organization_id = 1 AND awd.document_type = 'LETTER'
ON CONFLICT DO NOTHING;

INSERT INTO ai_workspace_document_versions (
    document_id, version_number, content, created_by_user, organization_id, created_at
)
SELECT
    awd.id,
    1,
    'COMMONWEALTH OF MASSACHUSETTS

[COURT NAME]

CIVIL ACTION NO. [CASE NUMBER]

[PLAINTIFF],
    Plaintiff

v.

[DEFENDANT],
    Defendant

MOTION TO DISMISS

Now comes the Defendant, by and through undersigned counsel, and hereby moves this Honorable Court to dismiss the Complaint filed herein pursuant to Mass. R. Civ. P. 12(b)(6)...',
    TRUE,
    1,
    NOW()
FROM ai_workspace_documents awd
WHERE awd.organization_id = 1 AND awd.document_type = 'MOTION'
ON CONFLICT DO NOTHING;

-- ===============================================
-- LEADS - Without case_type column
-- ===============================================
INSERT INTO leads (
    first_name, last_name, email, phone, source, status,
    priority, assigned_to, lead_score, notes, initial_inquiry,
    practice_area, urgency_level, lead_quality,
    geographic_location, communication_preference,
    organization_id, created_at
) VALUES
('Robert', 'Chen', 'robert.chen@email.com', '(617) 555-4001', 'WEBSITE', 'NEW', 'HIGH', 1, 85, 'Corporate merger inquiry', 'Interested in M&A advisory services', 'Business Law', 'HIGH', 'HOT', 'Boston, MA', 'EMAIL', 1, NOW() - INTERVAL '2 days'),
('Amanda', 'Foster', 'amanda.foster@email.com', '(617) 555-4002', 'REFERRAL', 'CONTACTED', 'MEDIUM', 1, 72, 'Estate planning inquiry', 'Need comprehensive estate planning', 'Estate Planning', 'MEDIUM', 'WARM', 'Cambridge, MA', 'PHONE', 1, NOW() - INTERVAL '5 days'),
('Michael', 'Santos', 'michael.santos@email.com', '(617) 555-4003', 'WEBSITE', 'QUALIFIED', 'HIGH', 1, 90, 'Personal injury case', 'Injured in car accident', 'Personal Injury', 'HIGH', 'HOT', 'Brookline, MA', 'PHONE', 1, NOW() - INTERVAL '3 days'),
('Jennifer', 'Park', 'jennifer.park@email.com', '(617) 555-4004', 'REFERRAL', 'NEW', 'MEDIUM', 1, 65, 'Immigration case', 'H-1B to Green Card needed', 'Immigration', 'MEDIUM', 'WARM', 'Newton, MA', 'EMAIL', 1, NOW() - INTERVAL '1 day'),
('David', 'Murphy', 'david.murphy@email.com', '(617) 555-4005', 'WEBSITE', 'CONTACTED', 'HIGH', 1, 80, 'Commercial real estate', 'Buying commercial property', 'Real Estate', 'HIGH', 'HOT', 'Boston, MA', 'PHONE', 1, NOW() - INTERVAL '4 days'),
('Sarah', 'Kim', 'sarah.kim@email.com', '(617) 555-4006', 'WEBSITE', 'NEW', 'MEDIUM', 1, 60, 'Divorce inquiry', 'Considering divorce with children', 'Family Law', 'MEDIUM', 'WARM', 'Somerville, MA', 'EMAIL', 1, NOW() - INTERVAL '6 days'),
('James', 'Brown3', 'james.brown3@email.com', '(617) 555-4007', 'REFERRAL', 'QUALIFIED', 'HIGH', 1, 88, 'IP protection needed', 'Startup needs patent protection', 'Intellectual Property', 'HIGH', 'HOT', 'Cambridge, MA', 'PHONE', 1, NOW() - INTERVAL '2 days'),
('Emily', 'Wilson3', 'emily.wilson3@email.com', '(617) 555-4008', 'WEBSITE', 'CONTACTED', 'MEDIUM', 1, 70, 'Employment case', 'Workplace discrimination claim', 'Employment Law', 'MEDIUM', 'WARM', 'Boston, MA', 'EMAIL', 1, NOW() - INTERVAL '8 days')
ON CONFLICT DO NOTHING;

-- ===============================================
-- CALENDAR EVENTS - Without visibility column
-- ===============================================
INSERT INTO calendar_events (
    title, description, start_time, end_time, location, event_type,
    status, all_day, user_id, reminder_minutes,
    organization_id, created_at, updated_at, high_priority
) VALUES
('Partner Meeting', 'Weekly partner strategy meeting', NOW() + INTERVAL '1 day' + INTERVAL '9 hours', NOW() + INTERVAL '1 day' + INTERVAL '10 hours', 'Main Conference Room', 'MEETING', 'SCHEDULED', FALSE, 1, 30, 1, NOW(), NOW(), TRUE),
('Client Deposition', 'Deposition for Smith v. ABC Corp', NOW() + INTERVAL '2 days' + INTERVAL '10 hours', NOW() + INTERVAL '2 days' + INTERVAL '12 hours', 'Court Building - Room 302', 'HEARING', 'SCHEDULED', FALSE, 1, 60, 1, NOW(), NOW(), TRUE),
('New Client Consultation', 'Initial consultation with potential PI client', NOW() + INTERVAL '3 days' + INTERVAL '14 hours', NOW() + INTERVAL '3 days' + INTERVAL '15 hours', 'Conference Room A', 'CONSULTATION', 'SCHEDULED', FALSE, 1, 30, 1, NOW(), NOW(), FALSE),
('Court Filing Deadline', 'Submit motion to dismiss', NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days' + INTERVAL '1 hour', 'Online Filing', 'DEADLINE', 'SCHEDULED', TRUE, 1, 120, 1, NOW(), NOW(), TRUE),
('Expert Witness Call', 'Call with medical expert', NOW() + INTERVAL '4 days' + INTERVAL '11 hours', NOW() + INTERVAL '4 days' + INTERVAL '12 hours', 'Phone/Zoom', 'MEETING', 'SCHEDULED', FALSE, 1, 15, 1, NOW(), NOW(), FALSE),
('Bar Association Lunch', 'Monthly networking event', NOW() + INTERVAL '7 days' + INTERVAL '12 hours', NOW() + INTERVAL '7 days' + INTERVAL '14 hours', 'Boston Harbor Hotel', 'OTHER', 'SCHEDULED', FALSE, 1, 60, 1, NOW(), NOW(), FALSE),
('Settlement Conference', 'Settlement conference for Williams case', NOW() + INTERVAL '10 days' + INTERVAL '9 hours', NOW() + INTERVAL '10 days' + INTERVAL '12 hours', 'Mediation Center', 'HEARING', 'SCHEDULED', FALSE, 1, 120, 1, NOW(), NOW(), TRUE),
('Staff Training', 'Quarterly compliance training', NOW() + INTERVAL '14 days' + INTERVAL '13 hours', NOW() + INTERVAL '14 days' + INTERVAL '16 hours', 'Large Conference Room', 'MEETING', 'SCHEDULED', FALSE, 1, 30, 1, NOW(), NOW(), FALSE),
('Immigration Interview Prep', 'Prepare client for USCIS interview', NOW() + INTERVAL '6 days' + INTERVAL '10 hours', NOW() + INTERVAL '6 days' + INTERVAL '12 hours', 'Office', 'MEETING', 'SCHEDULED', FALSE, 1, 60, 1, NOW(), NOW(), TRUE),
('Case Strategy Meeting', 'Internal case review for Anderson case', NOW() + INTERVAL '8 days' + INTERVAL '15 hours', NOW() + INTERVAL '8 days' + INTERVAL '16 hours', 'Conference Room B', 'MEETING', 'SCHEDULED', FALSE, 1, 30, 1, NOW(), NOW(), FALSE)
ON CONFLICT DO NOTHING;

-- ===============================================
-- CASE NOTES - Using is_private instead of note_type
-- ===============================================
INSERT INTO case_notes (
    case_id, user_id, title, content, is_private,
    organization_id, created_at, updated_at
)
SELECT
    lc.id,
    1,
    'Initial Case Assessment',
    'Reviewed all initial documentation. Strong case with clear liability indicators. Client has good documentation. Recommend proceeding with formal demand. Key facts reviewed include timeline, witness statements, and supporting evidence.',
    TRUE,
    1,
    NOW() - INTERVAL '8 days',
    NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 10
ON CONFLICT DO NOTHING;

INSERT INTO case_notes (
    case_id, user_id, title, content, is_private,
    organization_id, created_at, updated_at
)
SELECT
    lc.id,
    1,
    'Client Communication Log',
    'Spoke with client regarding case progress. Client understands timeline and is satisfied with progress. Follow-up scheduled for next week. Discussed strategy options and potential outcomes.',
    FALSE,
    1,
    NOW() - INTERVAL '3 days',
    NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 10
ON CONFLICT DO NOTHING;

INSERT INTO case_notes (
    case_id, user_id, title, content, is_private,
    organization_id, created_at, updated_at
)
SELECT
    lc.id,
    1,
    'Research Notes',
    'Completed legal research on applicable statutes and case law. Found several favorable precedents that support our position. Key cases include Smith v. Jones (2023) and Williams v. ABC Corp (2022).',
    TRUE,
    1,
    NOW() - INTERVAL '5 days',
    NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 8
ON CONFLICT DO NOTHING;

-- ===============================================
-- VENDORS (required for expenses)
-- ===============================================
INSERT INTO vendor (name, email, phone, address, organization_id, created_at, updated_at) VALUES
('Suffolk County Courthouse', 'clerk@suffolkcourthouse.gov', '(617) 788-8000', '1 Pemberton Square, Boston, MA 02108', 1, NOW(), NOW()),
('Court Reporter Services', 'info@courtreporterservices.com', '(617) 555-2001', '100 Federal Street, Boston, MA 02110', 1, NOW(), NOW()),
('FedEx', 'support@fedex.com', '1-800-463-3339', 'Various Locations', 1, NOW(), NOW()),
('Westlaw', 'support@westlaw.com', '1-800-937-8529', 'Online Service', 1, NOW(), NOW()),
('LexisNexis', 'support@lexisnexis.com', '1-800-543-6862', 'Online Service', 1, NOW(), NOW()),
('Expert Medical Witnesses Inc', 'contact@expertmedical.com', '(617) 555-3001', '200 Longwood Ave, Boston, MA 02115', 1, NOW(), NOW()),
('ABC Process Servers', 'info@abcprocess.com', '(617) 555-4001', '150 Tremont Street, Boston, MA 02111', 1, NOW(), NOW()),
('Boston Copy Center', 'orders@bostoncopy.com', '(617) 555-5001', '75 State Street, Boston, MA 02109', 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- EXPENSE CATEGORIES - Using color instead of description
-- ===============================================
INSERT INTO expense_categories (name, color, organization_id, created_at, updated_at)
VALUES
('Court Filing Fees', '#3B82F6', 1, NOW(), NOW()),
('Expert Witness Fees', '#10B981', 1, NOW(), NOW()),
('Travel Expenses', '#F59E0B', 1, NOW(), NOW()),
('Deposition Costs', '#8B5CF6', 1, NOW(), NOW()),
('Research Services', '#EC4899', 1, NOW(), NOW()),
('Postage and Delivery', '#6366F1', 1, NOW(), NOW()),
('Photocopying', '#14B8A6', 1, NOW(), NOW()),
('Process Server', '#EF4444', 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- EXPENSES - Using legal_case_id, date, vendor_id, client_id, currency
-- ===============================================
INSERT INTO expenses (
    legal_case_id, category_id, client_id, vendor_id, description, amount, date,
    currency, organization_id, created_at, updated_at
)
SELECT
    lc.id,
    ec.id,
    c.id,
    v.id,
    'Court filing fee for initial complaint',
    350.00,
    NOW() - INTERVAL '10 days',
    'USD',
    1,
    NOW(),
    NOW()
FROM legal_cases lc
CROSS JOIN expense_categories ec
CROSS JOIN clients c
CROSS JOIN vendor v
WHERE lc.organization_id = 1
  AND ec.name = 'Court Filing Fees' AND ec.organization_id = 1
  AND c.organization_id = 1
  AND v.name = 'Suffolk County Courthouse' AND v.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

INSERT INTO expenses (
    legal_case_id, category_id, client_id, vendor_id, description, amount, date,
    currency, organization_id, created_at, updated_at
)
SELECT
    lc.id,
    ec.id,
    c.id,
    v.id,
    'Expert witness consultation fee',
    1500.00,
    NOW() - INTERVAL '7 days',
    'USD',
    1,
    NOW(),
    NOW()
FROM legal_cases lc
CROSS JOIN expense_categories ec
CROSS JOIN clients c
CROSS JOIN vendor v
WHERE lc.organization_id = 1
  AND ec.name = 'Expert Witness Fees' AND ec.organization_id = 1
  AND c.organization_id = 1
  AND v.name = 'Expert Medical Witnesses Inc' AND v.organization_id = 1
LIMIT 3
ON CONFLICT DO NOTHING;

INSERT INTO expenses (
    legal_case_id, category_id, client_id, vendor_id, description, amount, date,
    currency, organization_id, created_at, updated_at
)
SELECT
    lc.id,
    ec.id,
    c.id,
    v.id,
    'Westlaw research subscription',
    250.00,
    NOW() - INTERVAL '5 days',
    'USD',
    1,
    NOW(),
    NOW()
FROM legal_cases lc
CROSS JOIN expense_categories ec
CROSS JOIN clients c
CROSS JOIN vendor v
WHERE lc.organization_id = 1
  AND ec.name = 'Research Services' AND ec.organization_id = 1
  AND c.organization_id = 1
  AND v.name = 'Westlaw' AND v.organization_id = 1
LIMIT 4
ON CONFLICT DO NOTHING;

-- ===============================================
-- MORE CASE ACTIVITIES
-- ===============================================
INSERT INTO case_activities (
    case_id, user_id, activity_type, description, metadata, created_at, organization_id
)
SELECT
    lc.id,
    1,
    'FILING',
    'Filed motion to compel discovery responses',
    '{"filingType": "MOTION", "court": "Suffolk Superior Court", "docketNumber": "2025-CV-' || lc.id || '"}',
    NOW() - INTERVAL '2 days',
    1
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

INSERT INTO case_activities (
    case_id, user_id, activity_type, description, metadata, created_at, organization_id
)
SELECT
    lc.id,
    1,
    'TIME_ENTRY',
    'Time entry logged: 2.5 hours - Case research and document review',
    '{"hours": 2.5, "billableAmount": 875.00, "description": "Research and analysis"}',
    NOW() - INTERVAL '1 day',
    1
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- FINAL SUMMARY
-- ===============================================
DO $$
DECLARE
    user_count INT;
    client_count INT;
    case_count INT;
    time_entry_count INT;
    invoice_count INT;
    session_count INT;
    message_count INT;
    doc_count INT;
    doc_version_count INT;
    lead_count INT;
    event_count INT;
    note_count INT;
    expense_count INT;
    activity_count INT;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users WHERE organization_id = 1;
    SELECT COUNT(*) INTO client_count FROM clients WHERE organization_id = 1;
    SELECT COUNT(*) INTO case_count FROM legal_cases WHERE organization_id = 1;
    SELECT COUNT(*) INTO time_entry_count FROM time_entries WHERE organization_id = 1;
    SELECT COUNT(*) INTO invoice_count FROM invoices WHERE organization_id = 1;
    SELECT COUNT(*) INTO session_count FROM ai_conversation_sessions WHERE organization_id = 1;
    SELECT COUNT(*) INTO message_count FROM ai_conversation_messages WHERE organization_id = 1;
    SELECT COUNT(*) INTO doc_count FROM ai_workspace_documents WHERE organization_id = 1;
    SELECT COUNT(*) INTO doc_version_count FROM ai_workspace_document_versions WHERE organization_id = 1;
    SELECT COUNT(*) INTO lead_count FROM leads WHERE organization_id = 1;
    SELECT COUNT(*) INTO event_count FROM calendar_events WHERE organization_id = 1;
    SELECT COUNT(*) INTO note_count FROM case_notes WHERE organization_id = 1;
    SELECT COUNT(*) INTO expense_count FROM expenses WHERE organization_id = 1;
    SELECT COUNT(*) INTO activity_count FROM case_activities WHERE organization_id = 1;

    RAISE NOTICE '=== V211 Complete Data Population ===';
    RAISE NOTICE '  Users: %', user_count;
    RAISE NOTICE '  Clients: %', client_count;
    RAISE NOTICE '  Legal Cases: %', case_count;
    RAISE NOTICE '  Time Entries: %', time_entry_count;
    RAISE NOTICE '  Invoices: %', invoice_count;
    RAISE NOTICE '  AI Sessions: %', session_count;
    RAISE NOTICE '  AI Messages: %', message_count;
    RAISE NOTICE '  AI Workspace Docs: %', doc_count;
    RAISE NOTICE '  AI Doc Versions: %', doc_version_count;
    RAISE NOTICE '  Leads: %', lead_count;
    RAISE NOTICE '  Calendar Events: %', event_count;
    RAISE NOTICE '  Case Notes: %', note_count;
    RAISE NOTICE '  Expenses: %', expense_count;
    RAISE NOTICE '  Case Activities: %', activity_count;
END $$;
