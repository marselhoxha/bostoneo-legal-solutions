-- PostgreSQL Massive Data Population
-- Version: V205
-- Description: Populates ALL remaining empty tables with seed data

-- ===============================================
-- ATTORNEY AVAILABILITY
-- ===============================================
INSERT INTO attorney_availability (
    attorney_id, day_of_week, start_time, end_time, is_available,
    organization_id, created_at, updated_at
)
SELECT
    a.id,
    dow,
    '09:00:00'::TIME,
    '17:00:00'::TIME,
    TRUE,
    1, NOW(), NOW()
FROM attorneys a
CROSS JOIN generate_series(1, 5) AS dow -- Monday to Friday
WHERE a.organization_id = 1
ON CONFLICT DO NOTHING;

-- ===============================================
-- ATTORNEY EXPERTISE
-- ===============================================
INSERT INTO attorney_expertise (
    attorney_id, practice_area, expertise_level, years_experience,
    organization_id, created_at
)
SELECT
    a.id,
    pa.name,
    CASE (a.id % 3)
        WHEN 0 THEN 'EXPERT'
        WHEN 1 THEN 'ADVANCED'
        ELSE 'INTERMEDIATE'
    END,
    5 + (a.id % 10),
    1, NOW()
FROM attorneys a
CROSS JOIN (SELECT DISTINCT name FROM practice_areas LIMIT 3) pa
WHERE a.organization_id = 1
ON CONFLICT DO NOTHING;

-- ===============================================
-- BILLING CYCLES
-- ===============================================
INSERT INTO billing_cycles (
    client_id, case_id, start_date, end_date, status,
    organization_id, created_at, updated_at
)
SELECT
    lc.client_id,
    lc.id,
    DATE_TRUNC('month', CURRENT_DATE),
    DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day',
    'ACTIVE',
    1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.client_id IS NOT NULL
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- CALENDAR EVENT PARTICIPANTS
-- ===============================================
INSERT INTO calendar_event_participants (
    event_id, user_id, response_status, organization_id, created_at
)
SELECT
    ce.id,
    1,
    'ACCEPTED',
    1, NOW()
FROM calendar_events ce
WHERE ce.organization_id = 1
LIMIT 10
ON CONFLICT DO NOTHING;

-- ===============================================
-- CASE ASSIGNMENT HISTORY
-- ===============================================
INSERT INTO case_assignment_history (
    case_id, attorney_id, assigned_by, assignment_type, assignment_date,
    notes, organization_id, created_at
)
SELECT
    ca.case_id,
    ca.attorney_id,
    1,
    'INITIAL',
    NOW() - INTERVAL '30 days',
    'Initial case assignment',
    1, NOW()
FROM case_assignments ca
WHERE ca.organization_id = 1
ON CONFLICT DO NOTHING;

-- ===============================================
-- CASE RATE CONFIGURATIONS
-- ===============================================
INSERT INTO case_rate_configurations (
    case_id, rate_type, hourly_rate, flat_fee, retainer_amount,
    effective_date, organization_id, created_by, created_at
)
SELECT
    lc.id,
    'HOURLY',
    350.00,
    NULL,
    5000.00,
    CURRENT_DATE - INTERVAL '60 days',
    1, 1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- CASE REMINDERS
-- ===============================================
INSERT INTO case_reminders (
    case_id, title, description, reminder_date, reminder_type,
    is_completed, organization_id, created_by, created_at
)
SELECT
    lc.id,
    'Follow up with client',
    'Schedule follow-up call to discuss case progress',
    CURRENT_DATE + INTERVAL '7 days',
    'FOLLOW_UP',
    FALSE,
    1, 1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 5
ON CONFLICT DO NOTHING;

INSERT INTO case_reminders (
    case_id, title, description, reminder_date, reminder_type,
    is_completed, organization_id, created_by, created_at
)
SELECT
    lc.id,
    'Filing Deadline',
    'Motion response deadline approaching',
    CURRENT_DATE + INTERVAL '14 days',
    'DEADLINE',
    FALSE,
    1, 1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 3
ON CONFLICT DO NOTHING;

-- ===============================================
-- CASE TIMELINE
-- ===============================================
INSERT INTO case_timeline (
    case_id, event_type, event_date, title, description,
    organization_id, created_by, created_at
)
SELECT
    lc.id,
    'CASE_OPENED',
    lc.created_at,
    'Case Opened',
    'Initial case file created',
    1, 1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
ON CONFLICT DO NOTHING;

INSERT INTO case_timeline (
    case_id, event_type, event_date, title, description,
    organization_id, created_by, created_at
)
SELECT
    lc.id,
    'DOCUMENT_FILED',
    lc.created_at + INTERVAL '5 days',
    'Initial Documents Filed',
    'Filed initial pleadings and documents',
    1, 1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
ON CONFLICT DO NOTHING;

-- ===============================================
-- DOCUMENT TEMPLATES
-- ===============================================
INSERT INTO document_templates (
    name, description, category, content, practice_area,
    is_active, organization_id, created_by, created_at, updated_at
) VALUES
('Engagement Letter', 'Standard client engagement letter template', 'CONTRACT', 'Dear [CLIENT_NAME],\n\nWe are pleased to confirm our engagement...', 'General', TRUE, 1, 1, NOW(), NOW()),
('Demand Letter', 'Standard demand letter for civil matters', 'CORRESPONDENCE', 'To Whom It May Concern,\n\nPlease be advised that...', 'Civil Litigation', TRUE, 1, 1, NOW(), NOW()),
('Motion Template', 'Basic motion template for court filings', 'COURT_FILING', 'COMMONWEALTH OF MASSACHUSETTS\n\n[COURT]\n\nMOTION FOR [RELIEF]', 'Civil Litigation', TRUE, 1, 1, NOW(), NOW()),
('Discovery Request', 'Standard discovery request template', 'DISCOVERY', 'INTERROGATORIES\n\n1. Please state your full name...', 'Civil Litigation', TRUE, 1, 1, NOW(), NOW()),
('Settlement Agreement', 'Settlement agreement template', 'CONTRACT', 'SETTLEMENT AGREEMENT AND RELEASE\n\nThis Agreement...', 'Civil Litigation', TRUE, 1, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- DOCUMENT COLLECTIONS
-- ===============================================
INSERT INTO document_collections (
    name, description, case_id, collection_type,
    organization_id, created_by, created_at, updated_at
)
SELECT
    'Discovery Documents - ' || lc.title,
    'Collection of discovery documents for case',
    lc.id,
    'DISCOVERY',
    1, 1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 3
ON CONFLICT DO NOTHING;

-- ===============================================
-- FILE ITEMS
-- ===============================================
INSERT INTO file_items (
    name, file_type, file_size, file_path, mime_type,
    folder_id, case_id, is_folder, organization_id,
    uploaded_by, created_at, updated_at
)
SELECT
    'Engagement Letter - ' || lc.title || '.pdf',
    'pdf',
    125000,
    '/files/cases/' || lc.id || '/engagement_letter.pdf',
    'application/pdf',
    (SELECT id FROM folders WHERE name = 'Client Documents' LIMIT 1),
    lc.id,
    FALSE,
    1, 1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

INSERT INTO file_items (
    name, file_type, file_size, file_path, mime_type,
    folder_id, case_id, is_folder, organization_id,
    uploaded_by, created_at, updated_at
)
SELECT
    'Court Filing - ' || lc.title || '.pdf',
    'pdf',
    250000,
    '/files/cases/' || lc.id || '/court_filing.pdf',
    'application/pdf',
    (SELECT id FROM folders WHERE name = 'Case Files' LIMIT 1),
    lc.id,
    FALSE,
    1, 1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 3
ON CONFLICT DO NOTHING;

-- ===============================================
-- FILE VERSIONS
-- ===============================================
INSERT INTO file_versions (
    file_id, version_number, file_path, file_size, change_description,
    organization_id, created_by, created_at
)
SELECT
    fi.id,
    1,
    fi.file_path,
    fi.file_size,
    'Initial version',
    1, 1, NOW()
FROM file_items fi
WHERE fi.organization_id = 1
ON CONFLICT DO NOTHING;

-- ===============================================
-- INTAKE FORMS
-- ===============================================
INSERT INTO intake_forms (
    name, description, form_type, fields_json, is_active,
    organization_id, created_by, created_at, updated_at
) VALUES
('General Intake Form', 'Standard client intake form for new matters', 'GENERAL',
 '{"fields": [{"name": "full_name", "type": "text", "required": true}, {"name": "email", "type": "email", "required": true}, {"name": "phone", "type": "phone", "required": true}, {"name": "matter_description", "type": "textarea", "required": true}]}',
 TRUE, 1, 1, NOW(), NOW()),
('Personal Injury Intake', 'Intake form for personal injury cases', 'PERSONAL_INJURY',
 '{"fields": [{"name": "accident_date", "type": "date", "required": true}, {"name": "injury_description", "type": "textarea", "required": true}, {"name": "medical_treatment", "type": "textarea", "required": false}]}',
 TRUE, 1, 1, NOW(), NOW()),
('Immigration Intake', 'Intake form for immigration matters', 'IMMIGRATION',
 '{"fields": [{"name": "country_of_origin", "type": "text", "required": true}, {"name": "visa_type", "type": "select", "required": true}, {"name": "current_status", "type": "text", "required": true}]}',
 TRUE, 1, 1, NOW(), NOW()),
('Family Law Intake', 'Intake form for family law matters', 'FAMILY_LAW',
 '{"fields": [{"name": "marriage_date", "type": "date", "required": false}, {"name": "children", "type": "number", "required": true}, {"name": "matter_type", "type": "select", "required": true}]}',
 TRUE, 1, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- INTAKE SUBMISSIONS
-- ===============================================
INSERT INTO intake_submissions (
    form_id, submission_data, status, submitted_by_email, submitted_by_name,
    organization_id, created_at, updated_at
)
SELECT
    if.id,
    '{"full_name": "John Doe", "email": "john.doe@email.com", "phone": "617-555-1234", "matter_description": "Need legal assistance"}',
    'PENDING',
    'john.doe@email.com',
    'John Doe',
    1, NOW(), NOW()
FROM intake_forms if
WHERE if.organization_id = 1 AND if.name = 'General Intake Form'
ON CONFLICT DO NOTHING;

-- ===============================================
-- INVOICE REMINDERS
-- ===============================================
INSERT INTO invoice_reminders (
    invoice_id, reminder_type, scheduled_date, status, subject, message,
    organization_id, created_at, updated_at
)
SELECT
    i.id,
    'DUE_SOON',
    i.due_date - INTERVAL '7 days',
    'PENDING',
    'Payment Reminder: Invoice ' || i.invoice_number,
    'This is a friendly reminder that your invoice is due in 7 days.',
    1, NOW(), NOW()
FROM invoices i
WHERE i.organization_id = 1 AND i.status = 'PENDING'
LIMIT 3
ON CONFLICT DO NOTHING;

-- ===============================================
-- INVOICE TIME ENTRIES
-- ===============================================
INSERT INTO invoice_time_entries (
    invoice_id, time_entry_id, organization_id, created_at
)
SELECT
    i.id,
    te.id,
    1, NOW()
FROM invoices i
JOIN time_entries te ON te.case_id = i.case_id AND te.organization_id = 1
WHERE i.organization_id = 1
LIMIT 10
ON CONFLICT DO NOTHING;

-- ===============================================
-- LEAD PIPELINE HISTORY
-- ===============================================
INSERT INTO lead_pipeline_history (
    lead_id, from_stage_id, to_stage_id, changed_by,
    organization_id, created_at
)
SELECT
    l.id,
    NULL,
    l.pipeline_stage_id,
    1,
    1, l.created_at
FROM leads l
WHERE l.organization_id = 1 AND l.pipeline_stage_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ===============================================
-- ORGANIZATION INVITATIONS
-- ===============================================
INSERT INTO organization_invitations (
    email, role, status, token, expires_at,
    organization_id, invited_by, created_at
) VALUES
('newattorney@example.com', 'ATTORNEY', 'PENDING', 'inv_token_001', NOW() + INTERVAL '7 days', 1, 1, NOW()),
('paralegal@example.com', 'PARALEGAL', 'PENDING', 'inv_token_002', NOW() + INTERVAL '7 days', 1, 1, NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- PAYMENT TRANSACTIONS
-- ===============================================
INSERT INTO payment_transactions (
    invoice_id, amount, payment_method, transaction_id, status,
    processed_at, organization_id, created_at
)
SELECT
    ip.invoice_id,
    ip.amount,
    ip.payment_method,
    'TXN-' || ip.id || '-' || EXTRACT(EPOCH FROM NOW())::INT,
    'COMPLETED',
    ip.payment_date,
    1, NOW()
FROM invoice_payments ip
WHERE ip.organization_id = 1
ON CONFLICT DO NOTHING;

-- ===============================================
-- RECEIPTS
-- ===============================================
INSERT INTO receipts (
    expense_id, receipt_number, file_path, file_name, uploaded_at,
    organization_id, uploaded_by, created_at
)
SELECT
    e.id,
    'RCP-' || e.id || '-2024',
    '/receipts/expense_' || e.id || '.pdf',
    'expense_receipt_' || e.id || '.pdf',
    NOW(),
    1, 1, NOW()
FROM expenses e
WHERE e.organization_id = 1
ON CONFLICT DO NOTHING;

-- ===============================================
-- RESEARCH SESSIONS (research_session table)
-- ===============================================
INSERT INTO research_session (
    case_id, title, description, status,
    organization_id, user_id, created_at, updated_at
)
SELECT
    lc.id,
    'Legal Research - ' || lc.title,
    'Research session for case legal analysis and precedent review',
    'ACTIVE',
    1, 1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- SEARCH HISTORY
-- ===============================================
INSERT INTO search_history (
    query, search_type, results_count, user_id,
    organization_id, created_at
)
SELECT
    'contract dispute Massachusetts',
    'CASE_LAW',
    25,
    1,
    1, NOW() - INTERVAL '5 days'
UNION ALL
SELECT 'immigration visa renewal', 'STATUTE', 15, 1, 1, NOW() - INTERVAL '3 days'
UNION ALL
SELECT 'divorce child custody', 'CASE_LAW', 42, 1, 1, NOW() - INTERVAL '1 day'
ON CONFLICT DO NOTHING;

-- ===============================================
-- SIGNATURE TEMPLATES
-- ===============================================
INSERT INTO signature_templates (
    name, description, document_type, signature_positions,
    organization_id, created_by, created_at, updated_at
) VALUES
('Standard Engagement Letter', 'Template for client engagement letter signatures', 'ENGAGEMENT',
 '{"signatures": [{"role": "client", "page": 1, "x": 100, "y": 600}, {"role": "attorney", "page": 1, "x": 400, "y": 600}]}',
 1, 1, NOW(), NOW()),
('Settlement Agreement', 'Template for settlement agreement signatures', 'SETTLEMENT',
 '{"signatures": [{"role": "plaintiff", "page": 1, "x": 100, "y": 600}, {"role": "defendant", "page": 1, "x": 400, "y": 600}]}',
 1, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- SIGNATURE REQUESTS
-- ===============================================
INSERT INTO signature_requests (
    document_id, template_id, status, requested_by,
    signer_email, signer_name, expires_at,
    organization_id, created_at, updated_at
)
SELECT
    fi.id::TEXT,
    st.id,
    'PENDING',
    1,
    'client@example.com',
    'Client Name',
    NOW() + INTERVAL '14 days',
    1, NOW(), NOW()
FROM file_items fi
CROSS JOIN signature_templates st
WHERE fi.organization_id = 1 AND st.organization_id = 1
LIMIT 2
ON CONFLICT DO NOTHING;

-- ===============================================
-- TASK COMMENTS
-- ===============================================
INSERT INTO task_comments (
    task_id, comment, user_id,
    organization_id, created_at, updated_at
)
SELECT
    ct.id,
    'Task progress update: Initial review completed.',
    1,
    1, NOW(), NOW()
FROM case_tasks ct
WHERE ct.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- TIMELINE EVENTS
-- ===============================================
INSERT INTO timeline_events (
    case_id, event_type, title, description, event_date,
    organization_id, created_by, created_at
)
SELECT
    lc.id,
    'CASE_OPENED',
    'Case Initiated',
    'New case file opened and initial consultation completed',
    lc.created_at,
    1, 1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
ON CONFLICT DO NOTHING;

INSERT INTO timeline_events (
    case_id, event_type, title, description, event_date,
    organization_id, created_by, created_at
)
SELECT
    lc.id,
    'DOCUMENT_FILED',
    'Documents Filed',
    'Initial pleadings and required documents filed with court',
    lc.created_at + INTERVAL '7 days',
    1, 1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
ON CONFLICT DO NOTHING;

-- ===============================================
-- TIMER SESSIONS
-- ===============================================
INSERT INTO timer_sessions (
    case_id, user_id, description, start_time, end_time,
    duration_minutes, is_billable, status,
    organization_id, created_at
)
SELECT
    te.case_id,
    te.user_id,
    te.description,
    te.date,
    te.date + (te.duration * INTERVAL '1 minute'),
    te.duration,
    te.is_billable,
    'COMPLETED',
    1, NOW()
FROM time_entries te
WHERE te.organization_id = 1
LIMIT 10
ON CONFLICT DO NOTHING;

-- ===============================================
-- TRUST ACCOUNT TRANSACTIONS
-- ===============================================
INSERT INTO trust_account_transactions (
    trust_account_id, transaction_type, amount, description,
    reference_number, client_id, case_id, balance_after,
    organization_id, created_by, created_at
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
    1, 1, NOW()
FROM trust_accounts ta
CROSS JOIN legal_cases lc
WHERE ta.organization_id = 1 AND lc.organization_id = 1 AND lc.client_id IS NOT NULL
LIMIT 3
ON CONFLICT DO NOTHING;

-- ===============================================
-- USER NOTIFICATION PREFERENCES
-- ===============================================
INSERT INTO user_notification_preferences (
    user_id, notification_type, email_enabled, push_enabled, sms_enabled,
    organization_id, created_at, updated_at
)
SELECT
    u.id,
    nt,
    TRUE,
    TRUE,
    FALSE,
    1, NOW(), NOW()
FROM users u
CROSS JOIN (VALUES ('CASE_UPDATE'), ('TASK_DUE'), ('INVOICE_PAID'), ('MESSAGE_RECEIVED'), ('CALENDAR_REMINDER')) AS t(nt)
WHERE u.organization_id = 1
ON CONFLICT DO NOTHING;

-- ===============================================
-- WORKLOAD CALCULATIONS
-- ===============================================
INSERT INTO workload_calculations (
    user_id, calculation_date, active_cases, pending_tasks,
    billable_hours, workload_score,
    organization_id, created_at
)
SELECT
    u.id,
    CURRENT_DATE,
    (SELECT COUNT(*) FROM case_assignments ca WHERE ca.attorney_id = u.id),
    (SELECT COUNT(*) FROM case_tasks ct WHERE ct.assigned_to = u.id AND ct.status != 'COMPLETED'),
    (SELECT COALESCE(SUM(te.duration) / 60.0, 0) FROM time_entries te WHERE te.user_id = u.id AND te.date >= CURRENT_DATE - INTERVAL '30 days'),
    50 + (u.id * 5),
    1, NOW()
FROM users u
WHERE u.organization_id = 1
ON CONFLICT DO NOTHING;

-- ===============================================
-- ACTION ITEMS
-- ===============================================
INSERT INTO action_items (
    title, description, case_id, assigned_to, due_date,
    priority, status, organization_id, created_by, created_at
)
SELECT
    'Review case documents',
    'Complete review of all case documents and prepare summary',
    lc.id,
    1,
    CURRENT_DATE + INTERVAL '5 days',
    'HIGH',
    'PENDING',
    1, 1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 3
ON CONFLICT DO NOTHING;

INSERT INTO action_items (
    title, description, case_id, assigned_to, due_date,
    priority, status, organization_id, created_by, created_at
)
SELECT
    'Prepare court filing',
    'Draft and prepare required court filings',
    lc.id,
    1,
    CURRENT_DATE + INTERVAL '10 days',
    'MEDIUM',
    'IN_PROGRESS',
    1, 1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 2
ON CONFLICT DO NOTHING;

-- ===============================================
-- AI ANALYSIS MESSAGES
-- ===============================================
INSERT INTO ai_analysis_messages (
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

INSERT INTO ai_analysis_messages (
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
-- AI DOCUMENT ANALYSIS
-- ===============================================
INSERT INTO ai_document_analysis (
    document_id, analysis_type, status, result_summary,
    confidence_score, organization_id, requested_by, created_at
)
SELECT
    fi.id,
    'CONTRACT_REVIEW',
    'COMPLETED',
    '{"clauses_reviewed": 15, "issues_found": 2, "recommendations": ["Review liability clause", "Update indemnification language"]}',
    0.92,
    1, 1, NOW()
FROM file_items fi
WHERE fi.organization_id = 1 AND fi.file_type = 'pdf'
LIMIT 3
ON CONFLICT DO NOTHING;

-- ===============================================
-- APPOINTMENT REQUESTS
-- ===============================================
INSERT INTO appointment_requests (
    client_name, client_email, client_phone, preferred_date, preferred_time,
    matter_type, description, status,
    organization_id, created_at, updated_at
) VALUES
('Jane Smith', 'jane.smith@email.com', '617-555-2345', CURRENT_DATE + INTERVAL '3 days', '10:00:00', 'CONSULTATION', 'Initial consultation for divorce matter', 'PENDING', 1, NOW(), NOW()),
('Robert Brown', 'robert.brown@email.com', '617-555-3456', CURRENT_DATE + INTERVAL '5 days', '14:00:00', 'CONSULTATION', 'Business incorporation consultation', 'CONFIRMED', 1, NOW(), NOW()),
('Maria Garcia', 'maria.garcia@email.com', '617-555-4567', CURRENT_DATE + INTERVAL '7 days', '11:00:00', 'FOLLOW_UP', 'Follow-up on immigration case', 'PENDING', 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- AI USAGE METRICS
-- ===============================================
INSERT INTO ai_usage_metrics (
    user_id, metric_type, metric_value, metric_date,
    organization_id, created_at
)
SELECT
    u.id,
    'TOKENS_USED',
    1000 + (u.id * 500),
    CURRENT_DATE,
    1, NOW()
FROM users u
WHERE u.organization_id = 1
ON CONFLICT DO NOTHING;

-- ===============================================
-- DOCUMENT VERSIONS (documentversion table)
-- ===============================================
INSERT INTO documentversion (
    document_id, version_number, file_path, file_size, change_notes,
    created_by, created_at
)
SELECT
    fi.id,
    1,
    fi.file_path,
    fi.file_size,
    'Initial document version',
    1, NOW()
FROM file_items fi
WHERE fi.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- REMINDER QUEUE
-- ===============================================
INSERT INTO reminder_queue (
    reminder_type, entity_id, entity_type, scheduled_for,
    status, recipient_email, subject, message,
    organization_id, created_at
)
SELECT
    'TASK_DUE',
    ct.id,
    'CASE_TASK',
    ct.due_date - INTERVAL '1 day',
    'PENDING',
    'attorney@bostoneo.com',
    'Task Due Tomorrow: ' || ct.title,
    'This is a reminder that your task is due tomorrow.',
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
    lc.id,
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
    RAISE NOTICE 'Data population completed. Summary of key tables:';

    FOR rec IN
        SELECT relname as table_name, n_live_tup as row_count
        FROM pg_stat_user_tables
        WHERE schemaname = 'public' AND n_live_tup > 0
        ORDER BY n_live_tup DESC
        LIMIT 50
    LOOP
        RAISE NOTICE '  %: % rows', rec.table_name, rec.row_count;
        total_populated := total_populated + 1;
    END LOOP;

    RAISE NOTICE 'Total tables with data: %', total_populated;
END $$;
