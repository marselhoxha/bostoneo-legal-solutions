-- PostgreSQL Correct Data Population
-- Version: V206
-- Description: Populates ALL remaining empty tables with CORRECT column names

-- ===============================================
-- ATTORNEY AVAILABILITY (CORRECT COLUMNS)
-- ===============================================
INSERT INTO attorney_availability (
    attorney_id, day_of_week, start_time, end_time, is_active,
    buffer_minutes, slot_duration_minutes, organization_id, created_at, updated_at
)
SELECT
    a.id,
    dow,
    '09:00:00'::TIME,
    '17:00:00'::TIME,
    TRUE,
    15,
    30,
    1, NOW(), NOW()
FROM attorneys a
CROSS JOIN generate_series(1, 5) AS dow
WHERE a.organization_id = 1
ON CONFLICT DO NOTHING;

-- ===============================================
-- ATTORNEY EXPERTISE (CORRECT COLUMNS)
-- ===============================================
INSERT INTO attorney_expertise (
    user_id, expertise_area, proficiency_level, years_experience,
    cases_handled, success_rate, organization_id, created_at, updated_at
)
SELECT
    a.user_id,
    pa.name,
    CASE (a.id % 3)
        WHEN 0 THEN 'EXPERT'
        WHEN 1 THEN 'ADVANCED'
        ELSE 'INTERMEDIATE'
    END,
    5 + (a.id % 10),
    20 + (a.id * 5),
    85.5 + (a.id % 10),
    1, NOW(), NOW()
FROM attorneys a
CROSS JOIN (SELECT DISTINCT name FROM practice_areas LIMIT 3) pa
WHERE a.organization_id = 1 AND a.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ===============================================
-- BILLING CYCLES (CORRECT COLUMNS)
-- ===============================================
INSERT INTO billing_cycles (
    legal_case_id, cycle_name, start_date, end_date, status,
    total_hours, total_amount, organization_id, created_at, updated_at
)
SELECT
    lc.id,
    'January 2025 Billing',
    '2025-01-01',
    '2025-01-31',
    'PENDING',
    0.00,
    0.00,
    1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- CALENDAR EVENT PARTICIPANTS (CORRECT COLUMNS)
-- ===============================================
INSERT INTO calendar_event_participants (
    event_id, user_id, role, response_status, added_by, added_at
)
SELECT
    ce.id,
    1,
    'ORGANIZER',
    'ACCEPTED',
    1,
    NOW()
FROM calendar_events ce
WHERE ce.organization_id = 1
LIMIT 10
ON CONFLICT DO NOTHING;

-- ===============================================
-- CASE ASSIGNMENT HISTORY (CORRECT COLUMNS)
-- ===============================================
INSERT INTO case_assignment_history (
    case_assignment_id, case_id, user_id, action, performed_by,
    performed_at, reason, organization_id
)
SELECT
    ca.id,
    ca.case_id,
    ca.attorney_id,
    'ASSIGNED',
    1,
    NOW() - INTERVAL '30 days',
    'Initial case assignment',
    1
FROM case_assignments ca
WHERE ca.organization_id = 1
ON CONFLICT DO NOTHING;

-- ===============================================
-- CASE RATE CONFIGURATIONS (CORRECT COLUMNS)
-- ===============================================
INSERT INTO case_rate_configurations (
    legal_case_id, case_name, case_number, default_rate,
    after_hours_multiplier, weekend_multiplier, emergency_multiplier,
    allow_multipliers, is_active, organization_id, created_at, updated_at
)
SELECT
    lc.id,
    lc.title,
    lc.case_number,
    350.00,
    1.5,
    1.5,
    2.0,
    TRUE,
    TRUE,
    1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- CASE REMINDERS (CORRECT COLUMNS)
-- ===============================================
INSERT INTO case_reminders (
    case_id, user_id, title, description, reminder_date, due_date,
    priority, status, organization_id, created_at, updated_at
)
SELECT
    lc.id,
    1,
    'Follow up with client',
    'Schedule follow-up call to discuss case progress',
    NOW() + INTERVAL '7 days',
    NOW() + INTERVAL '14 days',
    'HIGH',
    'PENDING',
    1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- CASE TIMELINE (CORRECT COLUMNS)
-- ===============================================
INSERT INTO case_timeline (
    case_id, user_id, event_type, title, description, event_date,
    visibility, created_at
)
SELECT
    lc.id,
    1,
    'CASE_OPENED',
    'Case Opened',
    'Initial case file created',
    lc.created_at,
    'TEAM',
    NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
ON CONFLICT DO NOTHING;

INSERT INTO case_timeline (
    case_id, user_id, event_type, title, description, event_date,
    visibility, created_at
)
SELECT
    lc.id,
    1,
    'DOCUMENT_FILED',
    'Initial Documents Filed',
    'Filed initial pleadings and documents',
    lc.created_at + INTERVAL '5 days',
    'TEAM',
    NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
ON CONFLICT DO NOTHING;

-- ===============================================
-- DOCUMENT TEMPLATES (CORRECT COLUMNS)
-- ===============================================
INSERT INTO document_templates (
    name, description, category, template_content, practice_area,
    jurisdiction, is_active, is_public, organization_id, created_by, created_at, updated_at
) VALUES
('Engagement Letter', 'Standard client engagement letter template', 1, 'Dear [CLIENT_NAME], We are pleased to confirm our engagement...', 'General', 'Massachusetts', TRUE, FALSE, 1, 1, NOW(), NOW()),
('Demand Letter', 'Standard demand letter for civil matters', 2, 'To Whom It May Concern, Please be advised that...', 'Civil Litigation', 'Massachusetts', TRUE, FALSE, 1, 1, NOW(), NOW()),
('Motion Template', 'Basic motion template for court filings', 3, 'COMMONWEALTH OF MASSACHUSETTS [COURT] MOTION FOR [RELIEF]', 'Civil Litigation', 'Massachusetts', TRUE, FALSE, 1, 1, NOW(), NOW()),
('Discovery Request', 'Standard discovery request template', 4, 'INTERROGATORIES 1. Please state your full name...', 'Civil Litigation', 'Massachusetts', TRUE, FALSE, 1, 1, NOW(), NOW()),
('Settlement Agreement', 'Settlement agreement template', 1, 'SETTLEMENT AGREEMENT AND RELEASE This Agreement...', 'Civil Litigation', 'Massachusetts', TRUE, FALSE, 1, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- DOCUMENT COLLECTIONS (CORRECT COLUMNS)
-- ===============================================
INSERT INTO document_collections (
    name, description, case_id, user_id, is_archived,
    organization_id, created_at, updated_at
)
SELECT
    'Discovery Documents - ' || lc.title,
    'Collection of discovery documents for case',
    lc.id,
    1,
    FALSE,
    1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 3
ON CONFLICT DO NOTHING;

-- ===============================================
-- FILE ITEMS (CORRECT COLUMNS)
-- ===============================================
INSERT INTO file_items (
    name, original_name, extension, size, file_path, mime_type,
    folder_id, case_id, is_deleted, shared_with_client, is_starred, version,
    organization_id, created_by, created_at, updated_at
)
SELECT
    'engagement_letter_' || lc.id || '.pdf',
    'Engagement Letter - ' || lc.title || '.pdf',
    'pdf',
    125000,
    '/files/cases/' || lc.id || '/engagement_letter.pdf',
    'application/pdf',
    (SELECT id FROM folders WHERE name = 'Client Documents' LIMIT 1),
    lc.id,
    FALSE,
    FALSE,
    FALSE,
    1,
    1, 1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

INSERT INTO file_items (
    name, original_name, extension, size, file_path, mime_type,
    folder_id, case_id, is_deleted, shared_with_client, is_starred, version,
    organization_id, created_by, created_at, updated_at
)
SELECT
    'court_filing_' || lc.id || '.pdf',
    'Court Filing - ' || lc.title || '.pdf',
    'pdf',
    250000,
    '/files/cases/' || lc.id || '/court_filing.pdf',
    'application/pdf',
    (SELECT id FROM folders WHERE name = 'Case Files' LIMIT 1),
    lc.id,
    FALSE,
    FALSE,
    FALSE,
    1,
    1, 1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 3
ON CONFLICT DO NOTHING;

-- ===============================================
-- FILE VERSIONS (CORRECT COLUMNS)
-- ===============================================
INSERT INTO file_versions (
    file_id, version_number, file_name, file_path, size, mime_type,
    is_current, is_deleted, comment, organization_id,
    uploaded_by, uploaded_at, created_by
)
SELECT
    fi.id,
    1,
    fi.name,
    fi.file_path,
    fi.size,
    fi.mime_type,
    TRUE,
    FALSE,
    'Initial version',
    1,
    1, NOW(), 1
FROM file_items fi
WHERE fi.organization_id = 1
ON CONFLICT DO NOTHING;

-- ===============================================
-- INTAKE FORMS (CORRECT COLUMNS)
-- ===============================================
INSERT INTO intake_forms (
    name, description, form_type, form_config, status, is_public,
    practice_area, organization_id, created_by, created_at, updated_at
) VALUES
('General Intake Form', 'Standard client intake form for new matters', 'GENERAL',
 '{"fields": [{"name": "full_name", "type": "text", "required": true}, {"name": "email", "type": "email", "required": true}]}',
 'ACTIVE', TRUE, 'General', 1, 1, NOW(), NOW()),
('Personal Injury Intake', 'Intake form for personal injury cases', 'PERSONAL_INJURY',
 '{"fields": [{"name": "accident_date", "type": "date", "required": true}, {"name": "injury_description", "type": "textarea"}]}',
 'ACTIVE', TRUE, 'Personal Injury', 1, 1, NOW(), NOW()),
('Immigration Intake', 'Intake form for immigration matters', 'IMMIGRATION',
 '{"fields": [{"name": "country_of_origin", "type": "text", "required": true}, {"name": "visa_type", "type": "select"}]}',
 'ACTIVE', TRUE, 'Immigration', 1, 1, NOW(), NOW()),
('Family Law Intake', 'Intake form for family law matters', 'FAMILY_LAW',
 '{"fields": [{"name": "marriage_date", "type": "date"}, {"name": "children", "type": "number"}]}',
 'ACTIVE', TRUE, 'Family Law', 1, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- INTAKE SUBMISSIONS (CORRECT COLUMNS)
-- ===============================================
INSERT INTO intake_submissions (
    form_id, submission_data, status, ip_address,
    organization_id, created_at, updated_at
)
SELECT
    if.id,
    '{"full_name": "John Doe", "email": "john.doe@email.com", "phone": "617-555-1234"}',
    'PENDING',
    '192.168.1.100',
    1, NOW(), NOW()
FROM intake_forms if
WHERE if.organization_id = 1 AND if.name = 'General Intake Form'
ON CONFLICT DO NOTHING;

-- ===============================================
-- INVOICE TIME ENTRIES (CORRECT COLUMNS - no org_id)
-- ===============================================
INSERT INTO invoice_time_entries (invoice_id, time_entry_id)
SELECT
    i.id,
    te.id
FROM invoices i
JOIN time_entries te ON te.case_id = i.case_id AND te.organization_id = 1
WHERE i.organization_id = 1
LIMIT 10
ON CONFLICT DO NOTHING;

-- ===============================================
-- LEAD PIPELINE HISTORY (CORRECT COLUMNS)
-- ===============================================
INSERT INTO lead_pipeline_history (
    lead_id, from_stage_id, to_stage_id, moved_by, moved_at,
    notes, organization_id
)
SELECT
    l.id,
    NULL,
    l.pipeline_stage_id,
    1,
    l.created_at,
    'Initial lead stage',
    1
FROM leads l
WHERE l.organization_id = 1 AND l.pipeline_stage_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ===============================================
-- ORGANIZATION INVITATIONS (CORRECT COLUMNS - no status)
-- ===============================================
INSERT INTO organization_invitations (
    email, role, token, expires_at, organization_id, created_by, created_at
) VALUES
('newattorney@example.com', 'ATTORNEY', 'inv_token_001', NOW() + INTERVAL '7 days', 1, 1, NOW()),
('paralegal@example.com', 'PARALEGAL', 'inv_token_002', NOW() + INTERVAL '7 days', 1, 1, NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- PAYMENT TRANSACTIONS (CORRECT COLUMNS)
-- ===============================================
INSERT INTO payment_transactions (
    invoice_id, amount, transaction_type, transaction_status,
    reference_number, processing_date, organization_id, created_by, created_at, updated_at
)
SELECT
    ip.invoice_id,
    ip.amount,
    'CHECK',
    'COMPLETED',
    'TXN-' || ip.id || '-' || EXTRACT(EPOCH FROM NOW())::INT,
    ip.payment_date,
    1, 1, NOW(), NOW()
FROM invoice_payments ip
WHERE ip.organization_id = 1
ON CONFLICT DO NOTHING;

-- ===============================================
-- RECEIPTS (CORRECT COLUMNS - requires actual binary content)
-- ===============================================
INSERT INTO receipts (
    file_name, content_type, file_size, content, organization_id, created_at, updated_at
) VALUES
('receipt_001.pdf', 'application/pdf', 10000, E'\\x255044462D312E340A'::bytea, 1, NOW(), NOW()),
('receipt_002.pdf', 'application/pdf', 12000, E'\\x255044462D312E340A'::bytea, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- RESEARCH SESSION (CORRECT COLUMNS)
-- ===============================================
INSERT INTO research_session (
    session_id, session_name, description, is_active,
    total_searches, total_documents_viewed,
    organization_id, user_id, created_at, updated_at, last_accessed
)
SELECT
    'session_' || lc.id || '_' || EXTRACT(EPOCH FROM NOW())::INT,
    'Legal Research - ' || lc.title,
    'Research session for case legal analysis',
    TRUE,
    0,
    0,
    1, 1, NOW(), NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- SEARCH HISTORY (CORRECT COLUMNS)
-- ===============================================
INSERT INTO search_history (
    search_query, query_type, results_count, user_id, is_saved,
    organization_id, searched_at
) VALUES
('contract dispute Massachusetts', 'CASE_LAW', 25, 1, FALSE, 1, NOW() - INTERVAL '5 days'),
('immigration visa renewal', 'STATUTE', 15, 1, TRUE, 1, NOW() - INTERVAL '3 days'),
('divorce child custody', 'CASE_LAW', 42, 1, FALSE, 1, NOW() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;

-- ===============================================
-- SIGNATURE TEMPLATES (CORRECT COLUMNS)
-- ===============================================
INSERT INTO signature_templates (
    name, description, category, is_active, is_global,
    default_expiry_days, default_reminder_email, default_reminder_sms,
    organization_id, created_by, created_at, updated_at
) VALUES
('Standard Engagement Letter', 'Template for client engagement letter signatures', 'CONTRACT', TRUE, FALSE, 14, TRUE, FALSE, 1, 1, NOW(), NOW()),
('Settlement Agreement', 'Template for settlement agreement signatures', 'SETTLEMENT', TRUE, FALSE, 7, TRUE, FALSE, 1, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- SIGNATURE REQUESTS (CORRECT COLUMNS)
-- ===============================================
INSERT INTO signature_requests (
    title, signer_email, signer_name, status, expires_at,
    case_id, client_id, organization_id, created_by, created_at, updated_at
)
SELECT
    'Signature Request - ' || lc.title,
    'client@example.com',
    'Client Name',
    'PENDING',
    NOW() + INTERVAL '14 days',
    lc.id,
    lc.client_id,
    1, 1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.client_id IS NOT NULL
LIMIT 3
ON CONFLICT DO NOTHING;

-- ===============================================
-- TASK COMMENTS (CORRECT COLUMNS)
-- ===============================================
INSERT INTO task_comments (
    task_id, user_id, comment, is_internal,
    organization_id, created_at
)
SELECT
    ct.id,
    1,
    'Task progress update: Initial review completed.',
    FALSE,
    1, NOW()
FROM case_tasks ct
WHERE ct.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- TIMELINE EVENTS (CORRECT COLUMNS - requires analysis_id)
-- ===============================================
INSERT INTO timeline_events (
    analysis_id, event_type, title, description, event_date,
    priority, organization_id, created_date
)
SELECT
    (SELECT id FROM ai_document_analysis LIMIT 1),
    'DOCUMENT_REVIEW',
    'Document Analysis Complete',
    'Initial document analysis completed',
    CURRENT_DATE,
    'MEDIUM',
    1, NOW()
WHERE EXISTS (SELECT 1 FROM ai_document_analysis)
ON CONFLICT DO NOTHING;

-- ===============================================
-- TIMER SESSIONS (CORRECT COLUMNS)
-- ===============================================
INSERT INTO timer_sessions (
    legal_case_id, user_id, description, start_time, end_time,
    duration, paused_duration, converted_to_time_entry,
    organization_id, created_at, updated_at
)
SELECT
    te.case_id,
    te.user_id,
    te.description,
    te.date,
    te.date + (te.duration * INTERVAL '1 minute'),
    te.duration,
    0,
    TRUE,
    1, NOW(), NOW()
FROM time_entries te
WHERE te.organization_id = 1
LIMIT 10
ON CONFLICT DO NOTHING;

-- ===============================================
-- TRUST ACCOUNT TRANSACTIONS (CORRECT COLUMNS)
-- ===============================================
INSERT INTO trust_account_transactions (
    trust_account_id, transaction_type, amount, description,
    reference_number, client_id, legal_case_id, balance_after,
    transaction_date, is_cleared, organization_id, created_by, created_at, updated_at
)
SELECT
    ta.id,
    'DEPOSIT',
    5000.00,
    'Initial retainer deposit',
    'TRX-' || ta.id || '-001',
    lc.client_id,
    lc.id,
    5000.00,
    CURRENT_DATE,
    TRUE,
    1, 1, NOW(), NOW()
FROM trust_accounts ta
CROSS JOIN legal_cases lc
WHERE ta.organization_id = 1 AND lc.organization_id = 1 AND lc.client_id IS NOT NULL
LIMIT 3
ON CONFLICT DO NOTHING;

-- ===============================================
-- USER NOTIFICATION PREFERENCES (CORRECT COLUMNS)
-- ===============================================
INSERT INTO user_notification_preferences (
    user_id, event_type, email_enabled, push_enabled, sms_enabled,
    in_app_enabled, enabled, organization_id, created_at, updated_at
)
SELECT
    u.id,
    et,
    TRUE,
    TRUE,
    FALSE,
    TRUE,
    TRUE,
    1, NOW(), NOW()
FROM users u
CROSS JOIN (VALUES ('CASE_UPDATE'), ('TASK_DUE'), ('INVOICE_PAID'), ('MESSAGE_RECEIVED'), ('CALENDAR_REMINDER')) AS t(et)
WHERE u.organization_id = 1
ON CONFLICT DO NOTHING;

-- ===============================================
-- WORKLOAD CALCULATIONS (CORRECT COLUMNS)
-- ===============================================
INSERT INTO workload_calculations (
    user_id, calculation_date, total_points, case_points, factors,
    organization_id, created_at
)
SELECT
    u.id,
    CURRENT_DATE,
    50 + (u.id * 5),
    '{"active_cases": 5, "pending_tasks": 10}',
    '{"complexity": 1.2, "urgency": 1.0}',
    1, NOW()
FROM users u
WHERE u.organization_id = 1
ON CONFLICT DO NOTHING;

-- ===============================================
-- ACTION ITEMS (CORRECT COLUMNS - requires analysis_id)
-- ===============================================
-- First create an AI document analysis if needed
INSERT INTO ai_document_analysis (
    document_id, analysis_type, status, confidence_score,
    organization_id, requested_by, created_at
)
SELECT
    fi.id,
    'CONTRACT_REVIEW',
    'COMPLETED',
    0.92,
    1, 1, NOW()
FROM file_items fi
WHERE fi.organization_id = 1
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO action_items (
    analysis_id, description, deadline, priority, status,
    organization_id, created_date, updated_date
)
SELECT
    ada.id,
    'Review contract terms and identify issues',
    CURRENT_DATE + INTERVAL '5 days',
    'HIGH',
    'PENDING',
    1, NOW(), NOW()
FROM ai_document_analysis ada
WHERE ada.organization_id = 1
LIMIT 3
ON CONFLICT DO NOTHING;

-- ===============================================
-- AI CONVERSATION MESSAGES
-- ===============================================
INSERT INTO ai_conversation_messages (
    session_id, role, content, tokens_used,
    organization_id, created_at
)
SELECT
    acs.id,
    'user',
    'Analyze the legal implications of this contract clause',
    150,
    1, NOW()
FROM ai_conversation_sessions acs
WHERE acs.organization_id = 1
LIMIT 2
ON CONFLICT DO NOTHING;

INSERT INTO ai_conversation_messages (
    session_id, role, content, tokens_used,
    organization_id, created_at
)
SELECT
    acs.id,
    'assistant',
    'Based on Massachusetts contract law, this clause may be unenforceable because...',
    500,
    1, NOW()
FROM ai_conversation_sessions acs
WHERE acs.organization_id = 1
LIMIT 2
ON CONFLICT DO NOTHING;

-- ===============================================
-- APPOINTMENT REQUESTS (CORRECT COLUMNS)
-- ===============================================
INSERT INTO appointment_requests (
    client_name, client_email, client_phone, requested_date, requested_time,
    matter_type, notes, status, organization_id, created_at, updated_at
) VALUES
('Jane Smith', 'jane.smith@email.com', '617-555-2345', CURRENT_DATE + INTERVAL '3 days', '10:00:00', 'CONSULTATION', 'Initial consultation for divorce matter', 'PENDING', 1, NOW(), NOW()),
('Robert Brown', 'robert.brown@email.com', '617-555-3456', CURRENT_DATE + INTERVAL '5 days', '14:00:00', 'CONSULTATION', 'Business incorporation consultation', 'CONFIRMED', 1, NOW(), NOW()),
('Maria Garcia', 'maria.garcia@email.com', '617-555-4567', CURRENT_DATE + INTERVAL '7 days', '11:00:00', 'FOLLOW_UP', 'Follow-up on immigration case', 'PENDING', 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- REMINDER QUEUE
-- ===============================================
INSERT INTO reminder_queue (
    case_id, user_id, reminder_type, reminder_date, title, description,
    is_sent, organization_id, created_at
)
SELECT
    ct.case_id,
    1,
    'TASK_DUE',
    ct.due_date - INTERVAL '1 day',
    'Task Due Tomorrow: ' || ct.title,
    'This is a reminder that your task is due tomorrow.',
    FALSE,
    1, NOW()
FROM case_tasks ct
WHERE ct.organization_id = 1 AND ct.due_date IS NOT NULL AND ct.status != 'COMPLETED'
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- PERMISSION AUDIT LOG
-- ===============================================
INSERT INTO permission_audit_log (
    user_id, action, resource_type, resource_id, details,
    ip_address, organization_id, created_at
)
SELECT
    1,
    'VIEW',
    'CASE',
    lc.id::TEXT,
    '{"case_title": "' || lc.title || '"}',
    '192.168.1.100',
    1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

-- Print final summary
DO $$
DECLARE
    rec RECORD;
    total_populated INT := 0;
BEGIN
    RAISE NOTICE 'Data population V206 completed. Summary of key tables:';

    FOR rec IN
        SELECT relname as table_name, n_live_tup as row_count
        FROM pg_stat_user_tables
        WHERE schemaname = 'public' AND n_live_tup > 0
        ORDER BY n_live_tup DESC
        LIMIT 60
    LOOP
        RAISE NOTICE '  %: % rows', rec.table_name, rec.row_count;
        total_populated := total_populated + 1;
    END LOOP;

    RAISE NOTICE 'Total tables with data: %', total_populated;
END $$;
