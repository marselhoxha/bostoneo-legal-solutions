-- PostgreSQL Complete MySQL Data Conversion
-- Version: V208
-- Description: Converts ALL MySQL migration data to PostgreSQL format

-- ===============================================
-- CALENDAR EVENTS - Sample Dashboard Data
-- ===============================================
-- Today's Events
INSERT INTO calendar_events (title, description, start_time, end_time, location, event_type, status, case_id, user_id, reminder_minutes, organization_id, created_at)
SELECT
    'Client Consultation - Martinez Case',
    'Initial review of medical records with client',
    NOW() + INTERVAL '1 day',
    NOW() + INTERVAL '1 day' + INTERVAL '1 hour',
    'Video Conference',
    'CONSULTATION',
    'SCHEDULED',
    (SELECT id FROM legal_cases WHERE organization_id = 1 LIMIT 1),
    1,
    30,
    1,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM calendar_events WHERE title = 'Client Consultation - Martinez Case')
ON CONFLICT DO NOTHING;

INSERT INTO calendar_events (title, description, start_time, end_time, location, event_type, status, case_id, user_id, reminder_minutes, organization_id, created_at)
SELECT
    'Motion Hearing - Patterson v. Boston Financial',
    'Motion for Summary Judgment',
    NOW() + INTERVAL '2 days',
    NOW() + INTERVAL '2 days' + INTERVAL '90 minutes',
    'Suffolk Superior Court, Room 4B',
    'HEARING',
    'SCHEDULED',
    (SELECT id FROM legal_cases WHERE organization_id = 1 LIMIT 1 OFFSET 1),
    1,
    60,
    1,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM calendar_events WHERE title = 'Motion Hearing - Patterson v. Boston Financial')
ON CONFLICT DO NOTHING;

INSERT INTO calendar_events (title, description, start_time, end_time, location, event_type, status, case_id, user_id, reminder_minutes, organization_id, created_at)
SELECT
    'Deposition - Williams Criminal Case',
    'Witness deposition for defense',
    NOW() + INTERVAL '3 days',
    NOW() + INTERVAL '3 days' + INTERVAL '2 hours',
    'Law Office Conference Room',
    'DEPOSITION',
    'SCHEDULED',
    (SELECT id FROM legal_cases WHERE organization_id = 1 LIMIT 1 OFFSET 2),
    1,
    60,
    1,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM calendar_events WHERE title = 'Deposition - Williams Criminal Case')
ON CONFLICT DO NOTHING;

-- Filing Deadlines
INSERT INTO calendar_events (title, description, start_time, end_time, location, event_type, status, user_id, reminder_minutes, organization_id, created_at) VALUES
('FILING DEADLINE: Response to Motion', 'Opposition brief due', NOW() + INTERVAL '4 days', NOW() + INTERVAL '4 days', NULL, 'DEADLINE', 'SCHEDULED', 1, 1440, 1, NOW()),
('Discovery Deadline', 'Interrogatories response due', NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days', NULL, 'DEADLINE', 'SCHEDULED', 1, 1440, 1, NOW()),
('Contract Review Deadline', 'Final review of merger agreement', NOW() + INTERVAL '6 days', NOW() + INTERVAL '6 days', NULL, 'DEADLINE', 'SCHEDULED', 1, 720, 1, NOW())
ON CONFLICT DO NOTHING;

-- More Calendar Events
INSERT INTO calendar_events (title, description, start_time, end_time, location, event_type, status, user_id, reminder_minutes, organization_id, created_at) VALUES
('Pre-Trial Conference', 'Scheduling conference with judge', NOW() + INTERVAL '9 days', NOW() + INTERVAL '9 days' + INTERVAL '1 hour', 'Suffolk Superior Court', 'HEARING', 'SCHEDULED', 1, 60, 1, NOW()),
('Mediation Session', 'Settlement mediation session', NOW() + INTERVAL '10 days', NOW() + INTERVAL '10 days' + INTERVAL '4 hours', 'Mediation Center Boston', 'MEETING', 'SCHEDULED', 1, 120, 1, NOW()),
('Client Presentation', 'Present zoning variance strategy', NOW() + INTERVAL '11 days', NOW() + INTERVAL '11 days' + INTERVAL '90 minutes', 'Cambridge Properties HQ', 'CONSULTATION', 'SCHEDULED', 1, 60, 1, NOW()),
('Estate Planning Review', 'Annual review with Thompson family', NOW() + INTERVAL '13 days', NOW() + INTERVAL '13 days' + INTERVAL '90 minutes', 'Office', 'CONSULTATION', 'SCHEDULED', 1, 30, 1, NOW()),
('Bankruptcy Court Hearing', 'Chapter 11 plan confirmation', NOW() + INTERVAL '16 days', NOW() + INTERVAL '16 days' + INTERVAL '3 hours', 'US Bankruptcy Court', 'HEARING', 'SCHEDULED', 1, 120, 1, NOW()),
('Trial Preparation', 'Final trial prep session', NOW() + INTERVAL '20 days', NOW() + INTERVAL '20 days' + INTERVAL '8 hours', 'Office', 'MEETING', 'SCHEDULED', 1, 60, 1, NOW()),
('Trial Day 1', 'Medical malpractice trial begins', NOW() + INTERVAL '27 days', NOW() + INTERVAL '27 days' + INTERVAL '8 hours', 'Suffolk Superior Court', 'COURT', 'SCHEDULED', 1, 1440, 1, NOW()),
('Immigration Interview', 'USCIS Green Card interview', NOW() + INTERVAL '30 days', NOW() + INTERVAL '30 days' + INTERVAL '1 hour', 'USCIS Boston Field Office', 'HEARING', 'SCHEDULED', 1, 1440, 1, NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- CASE ACTIVITIES - Recent Activity Log
-- ===============================================
INSERT INTO case_activities (case_id, user_id, activity_type, reference_type, description, metadata, organization_id, created_at)
SELECT
    lc.id,
    1,
    'DOCUMENT_UPLOADED',
    'document',
    'Uploaded medical records summary',
    '{"fileName": "Medical_Records_Summary.pdf", "fileSize": "2.4MB"}',
    1,
    NOW() - INTERVAL '30 minutes'
FROM legal_cases lc WHERE lc.organization_id = 1 LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO case_activities (case_id, user_id, activity_type, reference_type, description, metadata, organization_id, created_at)
SELECT
    lc.id,
    1,
    'NOTE_ADDED',
    'note',
    'Added notes on motion strategy',
    '{"noteTitle": "Motion Strategy Notes"}',
    1,
    NOW() - INTERVAL '1 hour'
FROM legal_cases lc WHERE lc.organization_id = 1 LIMIT 1 OFFSET 1
ON CONFLICT DO NOTHING;

INSERT INTO case_activities (case_id, user_id, activity_type, reference_type, description, metadata, organization_id, created_at)
SELECT
    lc.id,
    1,
    'STATUS_CHANGED',
    'case',
    'Case moved to Due Diligence phase',
    '{"oldStatus": "DISCOVERY", "newStatus": "DUE_DILIGENCE"}',
    1,
    NOW() - INTERVAL '2 hours'
FROM legal_cases lc WHERE lc.organization_id = 1 LIMIT 1 OFFSET 2
ON CONFLICT DO NOTHING;

-- More case activities
INSERT INTO case_activities (case_id, user_id, activity_type, reference_type, description, metadata, organization_id, created_at)
SELECT lc.id, 1, 'CLIENT_CONTACTED', 'communication', 'Contacted client via phone: Case status update', '{"contactMethod": "phone"}', 1, NOW() - INTERVAL '45 minutes'
FROM legal_cases lc WHERE lc.organization_id = 1 LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO case_activities (case_id, user_id, activity_type, reference_type, description, metadata, organization_id, created_at)
SELECT lc.id, 1, 'HEARING_SCHEDULED', 'calendar_event', 'Scheduled hearing: Motion for Summary Judgment', '{"eventTitle": "Motion for Summary Judgment", "eventType": "HEARING"}', 1, NOW() - INTERVAL '90 minutes'
FROM legal_cases lc WHERE lc.organization_id = 1 LIMIT 1 OFFSET 1
ON CONFLICT DO NOTHING;

INSERT INTO case_activities (case_id, user_id, activity_type, reference_type, description, metadata, organization_id, created_at)
SELECT lc.id, 1, 'TIME_ENTRY_ADDED', 'time_entry', 'Logged 2.5 hours: Trial preparation', '{"hours": 2.5, "description": "Trial preparation and witness coordination"}', 1, NOW() - INTERVAL '3 hours'
FROM legal_cases lc WHERE lc.organization_id = 1 LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO case_activities (case_id, user_id, activity_type, reference_type, description, metadata, organization_id, created_at)
SELECT lc.id, 1, 'PAYMENT_RECEIVED', 'payment', 'Payment received: $5000.00', '{"amount": 5000.00}', 1, NOW() - INTERVAL '4 hours'
FROM legal_cases lc WHERE lc.organization_id = 1 LIMIT 1 OFFSET 1
ON CONFLICT DO NOTHING;

INSERT INTO case_activities (case_id, user_id, activity_type, reference_type, description, metadata, organization_id, created_at)
SELECT lc.id, 1, 'ASSIGNMENT_ADDED', 'user', 'Sarah Chen assigned as paralegal', '{"assigneeName": "Sarah Chen", "roleType": "PARALEGAL"}', 1, NOW() - INTERVAL '1 day'
FROM legal_cases lc WHERE lc.organization_id = 1 LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO case_activities (case_id, user_id, activity_type, reference_type, description, metadata, organization_id, created_at)
SELECT lc.id, 1, 'INVOICE_CREATED', 'invoice', 'Invoice created for $12500.00', '{"amount": 12500.00}', 1, NOW() - INTERVAL '1 day'
FROM legal_cases lc WHERE lc.organization_id = 1 LIMIT 1 OFFSET 2
ON CONFLICT DO NOTHING;

INSERT INTO case_activities (case_id, user_id, activity_type, reference_type, description, metadata, organization_id, created_at)
SELECT lc.id, 1, 'PRIORITY_CHANGED', 'case', 'Case priority changed from MEDIUM to HIGH', '{"oldPriority": "MEDIUM", "newPriority": "HIGH"}', 1, NOW() - INTERVAL '2 days'
FROM legal_cases lc WHERE lc.organization_id = 1 LIMIT 1
ON CONFLICT DO NOTHING;

-- ===============================================
-- TASK COMMENTS
-- ===============================================
INSERT INTO task_comments (task_id, user_id, comment, organization_id, created_at)
SELECT ct.id, 1, 'Started reviewing the contracts. Found several potential breach points that need further analysis.', 1, NOW() - INTERVAL '2 days'
FROM case_tasks ct WHERE ct.organization_id = 1 LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO task_comments (task_id, user_id, comment, organization_id, created_at)
SELECT ct.id, 1, 'Please prioritize sections 4.2 and 7.1 of the main agreement.', 1, NOW() - INTERVAL '2 days'
FROM case_tasks ct WHERE ct.organization_id = 1 LIMIT 1 OFFSET 1
ON CONFLICT DO NOTHING;

INSERT INTO task_comments (task_id, user_id, comment, organization_id, created_at)
SELECT ct.id, 1, 'Client meeting went well. They are prepared for a lengthy litigation if necessary.', 1, NOW() - INTERVAL '3 days'
FROM case_tasks ct WHERE ct.organization_id = 1 LIMIT 1 OFFSET 2
ON CONFLICT DO NOTHING;

INSERT INTO task_comments (task_id, user_id, comment, organization_id, created_at)
SELECT ct.id, 1, 'Having difficulty obtaining records from hospital. May need a subpoena.', 1, NOW() - INTERVAL '4 days'
FROM case_tasks ct WHERE ct.organization_id = 1 LIMIT 1 OFFSET 3
ON CONFLICT DO NOTHING;

INSERT INTO task_comments (task_id, user_id, comment, organization_id, created_at)
SELECT ct.id, 1, 'Working on this task. Making good progress.', 1, NOW() - INTERVAL '1 day'
FROM case_tasks ct WHERE ct.organization_id = 1 AND ct.status = 'IN_PROGRESS' LIMIT 3
ON CONFLICT DO NOTHING;

-- ===============================================
-- LEAD SCORING CONFIGS
-- ===============================================
INSERT INTO lead_scoring_configs (name, description, practice_area, scoring_factors, is_active, created_by, organization_id, created_at)
VALUES
('General Practice Scoring', 'Default scoring configuration for general practice leads', 'General',
'{"practiceAreaMatch": {"weight": 0.25, "enabled": true}, "caseValuePotential": {"weight": 0.20, "enabled": true}, "urgencyLevel": {"weight": 0.15, "enabled": true}, "caseStrength": {"weight": 0.10, "enabled": true}}',
TRUE, 1, 1, NOW()),
('Personal Injury Scoring', 'Optimized scoring for personal injury cases', 'Personal Injury',
'{"practiceAreaMatch": {"weight": 0.30, "enabled": true}, "caseValuePotential": {"weight": 0.25, "enabled": true}, "caseStrength": {"weight": 0.20, "enabled": true}, "urgencyLevel": {"weight": 0.10, "enabled": true}}',
TRUE, 1, 1, NOW()),
('Family Law Scoring', 'Scoring configuration for family law leads', 'Family Law',
'{"practiceAreaMatch": {"weight": 0.25, "enabled": true}, "urgencyLevel": {"weight": 0.25, "enabled": true}, "caseComplexity": {"weight": 0.20, "enabled": true}}',
TRUE, 1, 1, NOW()),
('Immigration Scoring', 'Scoring configuration for immigration leads', 'Immigration',
'{"practiceAreaMatch": {"weight": 0.30, "enabled": true}, "deadlineUrgency": {"weight": 0.25, "enabled": true}, "documentationComplete": {"weight": 0.20, "enabled": true}}',
TRUE, 1, 1, NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- QUALIFICATION WORKFLOWS
-- ===============================================
INSERT INTO qualification_workflows (name, description, practice_area, workflow_stages, estimated_duration_minutes, is_active, created_by, organization_id, created_at)
VALUES
('Personal Injury Standard', 'Standard qualification workflow for personal injury cases', 'Personal Injury',
'[{"id": "initial-screening", "name": "Initial Screening", "order": 1, "required": true, "minScore": 50}, {"id": "case-evaluation", "name": "Case Merit Evaluation", "order": 2, "required": true, "minScore": 60}]',
30, TRUE, 1, 1, NOW()),
('Family Law Standard', 'Standard qualification workflow for family law cases', 'Family Law',
'[{"id": "initial-assessment", "name": "Initial Case Assessment", "order": 1, "required": true, "minScore": 40}, {"id": "complexity-review", "name": "Case Complexity Review", "order": 2, "required": true, "minScore": 50}]',
45, TRUE, 1, 1, NOW()),
('Immigration Standard', 'Standard qualification workflow for immigration cases', 'Immigration',
'[{"id": "eligibility-check", "name": "Eligibility Assessment", "order": 1, "required": true, "minScore": 60}, {"id": "document-review", "name": "Document Review", "order": 2, "required": true, "minScore": 50}]',
60, TRUE, 1, 1, NOW()),
('Criminal Defense Standard', 'Standard qualification for criminal defense cases', 'Criminal Defense',
'[{"id": "urgency-assessment", "name": "Urgency Assessment", "order": 1, "required": true, "minScore": 70}, {"id": "case-review", "name": "Case Review", "order": 2, "required": true, "minScore": 50}]',
30, TRUE, 1, 1, NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- ATTORNEY ASSIGNMENT RULES
-- ===============================================
INSERT INTO attorney_assignment_rules (name, description, practice_area, priority_order, conditions, assignment_logic, is_active, created_by, organization_id, created_at)
VALUES
('High-Value Personal Injury', 'Route high-value PI cases to senior attorneys', 'Personal Injury', 1,
'{"leadScore": {"operator": "greater_than", "value": 80}, "estimatedValue": {"operator": "greater_than", "value": 100000}}',
'{"method": "BEST_MATCH", "weights": {"practiceAreaMatch": 0.30, "workloadCapacity": 0.25, "performanceHistory": 0.25}}',
TRUE, 1, 1, NOW()),
('General Round Robin', 'Distribute general cases evenly among available attorneys', 'General', 10,
'{"leadScore": {"operator": "greater_than", "value": 30}}',
'{"method": "ROUND_ROBIN", "weights": {"workloadCapacity": 0.60, "practiceAreaMatch": 0.40}}',
TRUE, 1, 1, NOW()),
('Urgent Criminal Defense', 'Prioritize urgent criminal cases', 'Criminal Defense', 2,
'{"urgencyLevel": {"operator": "equals", "value": "CRITICAL"}}',
'{"method": "BEST_AVAILABLE", "weights": {"availability": 0.50, "experience": 0.30, "caseload": 0.20}}',
TRUE, 1, 1, NOW()),
('Immigration Specialty', 'Route immigration cases to certified attorneys', 'Immigration', 3,
'{"practiceArea": {"operator": "equals", "value": "Immigration"}}',
'{"method": "SPECIALTY_MATCH", "weights": {"certification": 0.40, "experience": 0.35, "availability": 0.25}}',
TRUE, 1, 1, NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- CRM SETTINGS
-- ===============================================
INSERT INTO crm_settings (setting_key, setting_value, setting_type, description, organization_id, created_at)
VALUES
('lead_auto_assignment', 'true', 'BOOLEAN', 'Enable automatic lead assignment to attorneys', 1, NOW()),
('lead_score_threshold', '50', 'INTEGER', 'Minimum score for lead qualification', 1, NOW()),
('follow_up_reminder_days', '3', 'INTEGER', 'Days before follow-up reminder', 1, NOW()),
('auto_email_notifications', 'true', 'BOOLEAN', 'Send automatic email notifications', 1, NOW()),
('default_lead_priority', 'MEDIUM', 'STRING', 'Default priority for new leads', 1, NOW()),
('max_leads_per_attorney', '25', 'INTEGER', 'Maximum leads per attorney', 1, NOW()),
('qualification_required', 'true', 'BOOLEAN', 'Require qualification before assignment', 1, NOW()),
('sms_notifications_enabled', 'false', 'BOOLEAN', 'Enable SMS notifications', 1, NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- SMS TEMPLATES
-- ===============================================
INSERT INTO sms_templates (name, content, template_type, variables, is_active, organization_id, created_by, created_at)
VALUES
('Lead Welcome', 'Hi {{firstName}}, thank you for contacting our law firm. We will be in touch shortly.', 'LEAD_NOTIFICATION', '["firstName"]', TRUE, 1, 1, NOW()),
('Appointment Reminder', 'Reminder: You have an appointment with {{attorneyName}} on {{date}} at {{time}}.', 'APPOINTMENT_REMINDER', '["attorneyName", "date", "time"]', TRUE, 1, 1, NOW()),
('Case Update', 'Update on your case {{caseNumber}}: {{updateMessage}}', 'CASE_UPDATE', '["caseNumber", "updateMessage"]', TRUE, 1, 1, NOW()),
('Payment Reminder', 'Reminder: Invoice {{invoiceNumber}} for ${{amount}} is due on {{dueDate}}.', 'PAYMENT_REMINDER', '["invoiceNumber", "amount", "dueDate"]', TRUE, 1, 1, NOW()),
('Document Request', 'Hi {{firstName}}, we need the following documents for your case: {{documentList}}', 'DOCUMENT_REQUEST', '["firstName", "documentList"]', TRUE, 1, 1, NOW()),
('Consultation Confirmation', 'Your consultation with {{attorneyName}} is confirmed for {{date}} at {{time}}. Location: {{location}}', 'CONSULTATION_CONFIRMATION', '["attorneyName", "date", "time", "location"]', TRUE, 1, 1, NOW()),
('Follow-up Reminder', 'Hi {{firstName}}, this is a follow-up regarding your inquiry. Please call us at {{phoneNumber}}.', 'FOLLOW_UP', '["firstName", "phoneNumber"]', TRUE, 1, 1, NOW()),
('Thank You', 'Thank you for choosing our firm, {{firstName}}. We look forward to assisting you.', 'THANK_YOU', '["firstName"]', TRUE, 1, 1, NOW()),
('Court Date Reminder', 'Important: Your court date is {{date}} at {{time}} at {{courtName}}.', 'COURT_REMINDER', '["date", "time", "courtName"]', TRUE, 1, 1, NOW()),
('Deadline Alert', 'Alert: Deadline for {{taskName}} is approaching on {{deadline}}.', 'DEADLINE_ALERT', '["taskName", "deadline"]', TRUE, 1, 1, NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- WORKFLOW STEPS (for guided drafting)
-- ===============================================
INSERT INTO workflow_steps (document_type, jurisdiction, workflow_type, step_order, step_id, step_title, step_description, step_type, questions, is_required, is_active, organization_id, created_at)
VALUES
('INTERROGATORIES', 'FEDERAL', 'GUIDED_DRAFTING', 1, 'party_info', 'Party Information', 'Identify the parties and your role in the case', 'INFORMATION_GATHERING',
'[{"questionId": "party_role", "questionText": "Are you representing the plaintiff or defendant?", "questionType": "MULTIPLE_CHOICE", "required": true, "options": ["Plaintiff", "Defendant"]}]', TRUE, TRUE, 1, NOW()),
('INTERROGATORIES', 'FEDERAL', 'GUIDED_DRAFTING', 2, 'case_details', 'Case Details', 'Provide information about the legal dispute', 'INFORMATION_GATHERING',
'[{"questionId": "case_type", "questionText": "Type of case", "questionType": "MULTIPLE_CHOICE", "required": true, "options": ["Personal Injury", "Contract Dispute", "Employment", "Real Estate", "Other"]}]', TRUE, TRUE, 1, NOW()),
('INTERROGATORIES', 'FEDERAL', 'GUIDED_DRAFTING', 3, 'document_upload', 'Document Upload', 'Upload relevant documents (optional)', 'DOCUMENT_UPLOAD',
'[{"questionId": "uploaded_docs", "questionText": "Upload relevant documents", "questionType": "FILE_UPLOAD", "required": false}]', FALSE, TRUE, 1, NOW()),
('INTERROGATORIES', 'FEDERAL', 'GUIDED_DRAFTING', 4, 'review_generate', 'Review & Generate', 'Review information and generate interrogatories', 'CONTENT_GENERATION', '[]', TRUE, TRUE, 1, NOW()),
('MOTION_TO_DISMISS', 'MASSACHUSETTS', 'GUIDED_DRAFTING', 1, 'case_info', 'Case Information', 'Enter case details', 'INFORMATION_GATHERING',
'[{"questionId": "case_number", "questionText": "Case Number", "questionType": "TEXT", "required": true}]', TRUE, TRUE, 1, NOW()),
('MOTION_TO_DISMISS', 'MASSACHUSETTS', 'GUIDED_DRAFTING', 2, 'grounds', 'Grounds for Dismissal', 'Select grounds for motion', 'INFORMATION_GATHERING',
'[{"questionId": "dismissal_grounds", "questionText": "Grounds for Dismissal", "questionType": "MULTIPLE_CHOICE", "required": true, "options": ["Lack of Jurisdiction", "Failure to State a Claim", "Improper Venue", "Statute of Limitations"]}]', TRUE, TRUE, 1, NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- DOCUMENT GENERATIONS (sample AI generations)
-- ===============================================
INSERT INTO document_generations (user_id, document_type, jurisdiction, input_context, generated_content, content_length, generation_method, ai_model_used, processing_time_seconds, quality_score, organization_id, generated_at)
VALUES
(1, 'INTERROGATORIES', 'FEDERAL', '{"party_role": "Plaintiff", "case_type": "Personal Injury"}', 'INTERROGATORIES TO DEFENDANT\n\n1. State your full name and address...', 2500, 'AI_GENERATED', 'claude-3-sonnet', 3.5, 92.5, 1, NOW() - INTERVAL '7 days'),
(1, 'MOTION_TO_DISMISS', 'MASSACHUSETTS', '{"grounds": "Failure to State a Claim"}', 'MOTION TO DISMISS\n\nComes now the Defendant...', 3200, 'AI_GENERATED', 'claude-3-sonnet', 4.2, 88.0, 1, NOW() - INTERVAL '5 days'),
(1, 'DEMAND_LETTER', 'MASSACHUSETTS', '{"client_name": "John Smith", "incident_date": "2024-01-15"}', 'DEMAND LETTER\n\nDear Sir/Madam...', 1800, 'TEMPLATE_BASED', 'claude-3-haiku', 1.5, 95.0, 1, NOW() - INTERVAL '3 days')
ON CONFLICT DO NOTHING;

-- ===============================================
-- RESEARCH CONVERSATIONS
-- ===============================================
INSERT INTO research_conversations (user_id, title, context, status, organization_id, created_at, updated_at)
VALUES
(1, 'Contract Breach Analysis', 'Research on Massachusetts contract law and breach remedies', 'ACTIVE', 1, NOW() - INTERVAL '5 days', NOW()),
(1, 'Immigration Visa Options', 'Research on work visa options for tech workers', 'ACTIVE', 1, NOW() - INTERVAL '3 days', NOW()),
(1, 'Personal Injury Precedents', 'Research on medical malpractice cases in Massachusetts', 'COMPLETED', 1, NOW() - INTERVAL '10 days', NOW() - INTERVAL '8 days'),
(1, 'Family Law Custody', 'Research on child custody standards in MA', 'ACTIVE', 1, NOW() - INTERVAL '2 days', NOW()),
(1, 'Criminal Defense Strategy', 'Research on DUI defense strategies', 'COMPLETED', 1, NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days')
ON CONFLICT DO NOTHING;

-- ===============================================
-- RESEARCH CONVERSATION MESSAGES
-- ===============================================
INSERT INTO research_conversation_messages (conversation_id, role, content, tokens_used, organization_id, created_at)
SELECT rc.id, 'user', 'What are the key elements required to prove breach of contract in Massachusetts?', 50, 1, NOW() - INTERVAL '5 days'
FROM research_conversations rc WHERE rc.title = 'Contract Breach Analysis' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO research_conversation_messages (conversation_id, role, content, tokens_used, organization_id, created_at)
SELECT rc.id, 'assistant', 'Under Massachusetts law, to prove breach of contract, a plaintiff must establish: (1) existence of a valid contract, (2) breach by the defendant, (3) causation, and (4) damages...', 350, 1, NOW() - INTERVAL '5 days'
FROM research_conversations rc WHERE rc.title = 'Contract Breach Analysis' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO research_conversation_messages (conversation_id, role, content, tokens_used, organization_id, created_at)
SELECT rc.id, 'user', 'What visa options are available for software engineers?', 40, 1, NOW() - INTERVAL '3 days'
FROM research_conversations rc WHERE rc.title = 'Immigration Visa Options' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO research_conversation_messages (conversation_id, role, content, tokens_used, organization_id, created_at)
SELECT rc.id, 'assistant', 'For software engineers, several visa options are available: H-1B (specialty occupation), L-1 (intracompany transfer), O-1 (extraordinary ability), and EB-2/EB-3 green card categories...', 450, 1, NOW() - INTERVAL '3 days'
FROM research_conversations rc WHERE rc.title = 'Immigration Visa Options' LIMIT 1
ON CONFLICT DO NOTHING;

-- ===============================================
-- USER WORKLOAD
-- ===============================================
INSERT INTO user_workload (user_id, calculation_date, active_cases_count, total_workload_points, capacity_percentage, billable_hours_week, non_billable_hours_week, overdue_tasks_count, upcoming_deadlines_count, organization_id, created_at)
SELECT u.id, CURRENT_DATE,
    (SELECT COUNT(*) FROM case_assignments ca WHERE ca.attorney_id = u.id AND ca.is_active = TRUE),
    28.5,
    71.25,
    32.5,
    3.0,
    0,
    2,
    1, NOW()
FROM users u WHERE u.organization_id = 1
ON CONFLICT DO NOTHING;

-- ===============================================
-- CASE TRANSFER REQUESTS
-- ===============================================
INSERT INTO case_transfer_requests (case_id, from_user_id, to_user_id, reason, urgency, status, requested_by, organization_id, created_at)
SELECT
    lc.id,
    1,
    (SELECT id FROM users WHERE organization_id = 1 AND id != 1 LIMIT 1),
    'Scheduling conflict with another high-priority case',
    'MEDIUM',
    'PENDING',
    1,
    1,
    NOW() - INTERVAL '2 days'
FROM legal_cases lc WHERE lc.organization_id = 1 LIMIT 1
ON CONFLICT DO NOTHING;

-- Print summary
DO $$
DECLARE
    cal_count INT;
    activity_count INT;
    comment_count INT;
    scoring_count INT;
    workflow_count INT;
BEGIN
    SELECT COUNT(*) INTO cal_count FROM calendar_events WHERE organization_id = 1;
    SELECT COUNT(*) INTO activity_count FROM case_activities WHERE organization_id = 1;
    SELECT COUNT(*) INTO comment_count FROM task_comments WHERE organization_id = 1;
    SELECT COUNT(*) INTO scoring_count FROM lead_scoring_configs WHERE organization_id = 1;
    SELECT COUNT(*) INTO workflow_count FROM qualification_workflows WHERE organization_id = 1;

    RAISE NOTICE 'MySQL Data Conversion Summary:';
    RAISE NOTICE '  Calendar Events: %', cal_count;
    RAISE NOTICE '  Case Activities: %', activity_count;
    RAISE NOTICE '  Task Comments: %', comment_count;
    RAISE NOTICE '  Lead Scoring Configs: %', scoring_count;
    RAISE NOTICE '  Qualification Workflows: %', workflow_count;
END $$;
