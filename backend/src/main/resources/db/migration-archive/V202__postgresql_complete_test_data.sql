-- PostgreSQL Complete Test Data Migration
-- Populates all test data for the application

-- =====================================================
-- 1. ADDITIONAL TEST USERS
-- =====================================================
INSERT INTO users (id, first_name, last_name, email, phone, enabled, non_locked, using_mfa, organization_id, created_at, image_url)
VALUES
(101, 'Sarah', 'Johnson', 'sarah.johnson@bostoneo.com', '617-555-0101', true, true, false, 1, NOW(), 'https://randomuser.me/api/portraits/women/1.jpg'),
(102, 'Michael', 'Chen', 'michael.chen@bostoneo.com', '617-555-0102', true, true, false, 1, NOW(), 'https://randomuser.me/api/portraits/men/1.jpg'),
(103, 'Emily', 'Rodriguez', 'emily.rodriguez@bostoneo.com', '617-555-0103', true, true, false, 1, NOW(), 'https://randomuser.me/api/portraits/women/2.jpg'),
(104, 'James', 'Wilson', 'james.wilson@bostoneo.com', '617-555-0104', true, true, false, 1, NOW(), 'https://randomuser.me/api/portraits/men/2.jpg'),
(105, 'Lisa', 'Anderson', 'lisa.anderson@bostoneo.com', '617-555-0105', true, true, false, 1, NOW(), 'https://randomuser.me/api/portraits/women/3.jpg')
ON CONFLICT (id) DO NOTHING;

-- Assign roles to test users
INSERT INTO user_roles (user_id, role_id)
SELECT 101, id FROM roles WHERE name = 'ATTORNEY' ON CONFLICT DO NOTHING;
INSERT INTO user_roles (user_id, role_id)
SELECT 102, id FROM roles WHERE name = 'ATTORNEY' ON CONFLICT DO NOTHING;
INSERT INTO user_roles (user_id, role_id)
SELECT 103, id FROM roles WHERE name = 'PARALEGAL' ON CONFLICT DO NOTHING;
INSERT INTO user_roles (user_id, role_id)
SELECT 104, id FROM roles WHERE name = 'ATTORNEY' ON CONFLICT DO NOTHING;
INSERT INTO user_roles (user_id, role_id)
SELECT 105, id FROM roles WHERE name = 'FINANCE' ON CONFLICT DO NOTHING;

-- =====================================================
-- 2. ATTORNEYS FOR TEST USERS
-- =====================================================
INSERT INTO attorneys (user_id, bar_number, license_state, practice_areas, experience_years, is_active, current_case_load, max_case_load, hourly_rate, organization_id, created_at, updated_at)
VALUES
(101, 'BBO-234567', 'Massachusetts', '["Corporate Law", "Civil Litigation"]', 12, true, 3, 20, 425.00, 1, NOW(), NOW()),
(102, 'BBO-345678', 'Massachusetts', '["Real Estate", "Corporate Law"]', 8, true, 4, 25, 350.00, 1, NOW(), NOW()),
(104, 'BBO-456789', 'Massachusetts', '["Personal Injury", "Employment Law"]', 10, true, 3, 20, 375.00, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- =====================================================
-- 3. CASE ASSIGNMENTS
-- =====================================================
INSERT INTO case_assignments (case_id, user_id, role_type, assignment_type, assigned_by, assigned_at, effective_from, is_active, workload_weight, expertise_match_score, notes, organization_id)
VALUES
(2, 101, 'LEAD_ATTORNEY', 'MANUAL', 1, NOW() - INTERVAL '30 days', NOW()::date - 30, true, 1.5, 0.95, 'Senior attorney with medical malpractice experience', 1),
(2, 103, 'PARALEGAL', 'MANUAL', 101, NOW() - INTERVAL '28 days', NOW()::date - 28, true, 0.5, 0.90, 'Medical records management', 1),
(3, 102, 'LEAD_ATTORNEY', 'MANUAL', 1, NOW() - INTERVAL '25 days', NOW()::date - 25, true, 1.5, 0.92, 'M&A specialist', 1),
(4, 104, 'LEAD_ATTORNEY', 'MANUAL', 1, NOW() - INTERVAL '20 days', NOW()::date - 20, true, 1.5, 0.88, 'Family law expertise', 1),
(5, 101, 'LEAD_ATTORNEY', 'MANUAL', 1, NOW() - INTERVAL '18 days', NOW()::date - 18, true, 2.0, 0.98, 'Criminal defense specialist', 1),
(6, 102, 'SUPPORTING_ATTORNEY', 'MANUAL', 101, NOW() - INTERVAL '15 days', NOW()::date - 15, true, 1.0, 0.85, 'Real estate transaction support', 1),
(7, 104, 'LEAD_ATTORNEY', 'MANUAL', 1, NOW() - INTERVAL '12 days', NOW()::date - 12, true, 1.2, 0.89, 'Securities litigation experience', 1),
(8, 103, 'PARALEGAL', 'MANUAL', 104, NOW() - INTERVAL '10 days', NOW()::date - 10, true, 0.5, 0.87, 'Immigration documentation support', 1)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 4. MORE CASE TASKS
-- =====================================================
INSERT INTO case_tasks (case_id, title, description, task_type, priority, status, assigned_to, assigned_by, due_date, estimated_hours, actual_hours, organization_id, created_at, updated_at)
VALUES
-- Martinez Medical Malpractice (case 2)
(2, 'Review Medical Expert Report', 'Analyze expert opinion on surgical error', 'REVIEW', 'HIGH', 'IN_PROGRESS', 101, 1, NOW() + INTERVAL '3 days', 8.0, 3.5, 1, NOW() - INTERVAL '5 days', NOW()),
(2, 'Prepare Demand Letter', 'Draft comprehensive demand to hospital', 'CORRESPONDENCE', 'HIGH', 'TODO', 101, 1, NOW() + INTERVAL '7 days', 6.0, 0, 1, NOW() - INTERVAL '3 days', NOW()),
(2, 'Collect Medical Records', 'Obtain all records from treating physicians', 'DOCUMENT_PREP', 'HIGH', 'COMPLETED', 103, 101, NOW() - INTERVAL '5 days', 10.0, 12.0, 1, NOW() - INTERVAL '20 days', NOW()),
(2, 'Client Meeting - Case Strategy', 'Discuss litigation strategy with client', 'CLIENT_MEETING', 'MEDIUM', 'COMPLETED', 101, 1, NOW() - INTERVAL '10 days', 2.0, 2.5, 1, NOW() - INTERVAL '15 days', NOW()),

-- TechVision M&A (case 3)
(3, 'Due Diligence Review', 'Review all corporate documents', 'REVIEW', 'HIGH', 'IN_PROGRESS', 102, 1, NOW() + INTERVAL '5 days', 20.0, 8.0, 1, NOW() - INTERVAL '10 days', NOW()),
(3, 'Draft Merger Agreement', 'Prepare merger agreement draft', 'DOCUMENT_PREP', 'HIGH', 'TODO', 102, 1, NOW() + INTERVAL '14 days', 15.0, 0, 1, NOW() - INTERVAL '5 days', NOW()),
(3, 'IP Portfolio Analysis', 'Review target company IP assets', 'RESEARCH', 'MEDIUM', 'IN_PROGRESS', 102, 1, NOW() + INTERVAL '10 days', 12.0, 4.0, 1, NOW() - INTERVAL '7 days', NOW()),

-- Johnson Divorce (case 4)
(4, 'Asset Valuation Review', 'Review property and asset valuations', 'REVIEW', 'HIGH', 'IN_PROGRESS', 104, 1, NOW() + INTERVAL '5 days', 8.0, 3.0, 1, NOW() - INTERVAL '8 days', NOW()),
(4, 'Draft Settlement Proposal', 'Prepare initial settlement terms', 'DOCUMENT_PREP', 'MEDIUM', 'TODO', 104, 1, NOW() + INTERVAL '12 days', 6.0, 0, 1, NOW() - INTERVAL '3 days', NOW()),
(4, 'Child Custody Analysis', 'Research custody arrangement options', 'RESEARCH', 'HIGH', 'COMPLETED', 104, 1, NOW() - INTERVAL '5 days', 5.0, 6.0, 1, NOW() - INTERVAL '15 days', NOW()),

-- Williams Criminal Defense (case 5)
(5, 'Discovery Review', 'Review prosecution discovery materials', 'REVIEW', 'HIGH', 'IN_PROGRESS', 101, 1, NOW() + INTERVAL '4 days', 15.0, 6.0, 1, NOW() - INTERVAL '10 days', NOW()),
(5, 'Witness Interview Prep', 'Prepare for witness interviews', 'OTHER', 'HIGH', 'TODO', 101, 1, NOW() + INTERVAL '8 days', 8.0, 0, 1, NOW() - INTERVAL '5 days', NOW()),
(5, 'Motion to Suppress', 'Draft motion to suppress evidence', 'FILING', 'URGENT', 'IN_PROGRESS', 101, 1, NOW() + INTERVAL '2 days', 10.0, 4.0, 1, NOW() - INTERVAL '7 days', NOW()),

-- Patterson Securities (case 7)
(7, 'Research Securities Law', 'Research applicable securities regulations', 'RESEARCH', 'HIGH', 'COMPLETED', 104, 1, NOW() - INTERVAL '3 days', 12.0, 14.0, 1, NOW() - INTERVAL '15 days', NOW()),
(7, 'Draft Opposition Brief', 'Prepare opposition to summary judgment', 'DOCUMENT_PREP', 'HIGH', 'IN_PROGRESS', 104, 1, NOW() + INTERVAL '2 days', 20.0, 12.0, 1, NOW() - INTERVAL '10 days', NOW()),

-- Rodriguez Immigration (case 8)
(8, 'Gather Employment Docs', 'Collect employment verification documents', 'DOCUMENT_PREP', 'HIGH', 'IN_PROGRESS', 103, 104, NOW() + INTERVAL '5 days', 6.0, 2.0, 1, NOW() - INTERVAL '7 days', NOW()),
(8, 'Prepare Interview Materials', 'Create interview preparation guide', 'DOCUMENT_PREP', 'MEDIUM', 'TODO', 103, 104, NOW() + INTERVAL '10 days', 4.0, 0, 1, NOW() - INTERVAL '3 days', NOW())
ON CONFLICT DO NOTHING;

-- =====================================================
-- 5. TASK COMMENTS
-- =====================================================
INSERT INTO task_comments (task_id, user_id, comment, organization_id, created_at)
SELECT t.id, 101, 'Started working on this task. Initial review looks promising.', 1, NOW() - INTERVAL '2 days'
FROM case_tasks t WHERE t.status = 'IN_PROGRESS' LIMIT 5;

INSERT INTO task_comments (task_id, user_id, comment, organization_id, created_at)
SELECT t.id, 103, 'Task completed successfully. All documents reviewed and organized.', 1, NOW() - INTERVAL '1 day'
FROM case_tasks t WHERE t.status = 'COMPLETED' LIMIT 3;

-- =====================================================
-- 6. MORE TIME ENTRIES
-- =====================================================
INSERT INTO time_entries (legal_case_id, user_id, hours, rate, description, date, billable, status, organization_id, created_at, updated_at)
VALUES
-- Sarah Johnson entries
(2, 101, 3.5, 425.00, 'Medical records review and analysis', NOW()::date - 2, true, 'APPROVED', 1, NOW(), NOW()),
(2, 101, 2.0, 425.00, 'Client strategy meeting', NOW()::date - 3, true, 'APPROVED', 1, NOW(), NOW()),
(5, 101, 4.0, 425.00, 'Discovery document review', NOW()::date - 4, true, 'APPROVED', 1, NOW(), NOW()),
(5, 101, 2.5, 425.00, 'Motion drafting', NOW()::date - 5, true, 'APPROVED', 1, NOW(), NOW()),
-- Michael Chen entries
(3, 102, 5.0, 350.00, 'Due diligence document review', NOW()::date - 1, true, 'APPROVED', 1, NOW(), NOW()),
(3, 102, 3.0, 350.00, 'IP asset analysis', NOW()::date - 3, true, 'APPROVED', 1, NOW(), NOW()),
(6, 102, 2.0, 350.00, 'Title review and analysis', NOW()::date - 5, true, 'APPROVED', 1, NOW(), NOW()),
-- Emily Rodriguez entries
(2, 103, 4.0, 150.00, 'Medical records organization', NOW()::date - 2, true, 'APPROVED', 1, NOW(), NOW()),
(8, 103, 3.0, 150.00, 'Immigration document preparation', NOW()::date - 4, true, 'APPROVED', 1, NOW(), NOW()),
-- James Wilson entries
(4, 104, 3.0, 375.00, 'Asset valuation review', NOW()::date - 1, true, 'APPROVED', 1, NOW(), NOW()),
(7, 104, 6.0, 375.00, 'Securities research and brief drafting', NOW()::date - 3, true, 'APPROVED', 1, NOW(), NOW()),
(7, 104, 4.0, 375.00, 'Opposition brief preparation', NOW()::date - 5, true, 'APPROVED', 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- =====================================================
-- 7. MORE LEADS
-- =====================================================
INSERT INTO leads (first_name, last_name, email, phone, company, practice_area, source, status, lead_score, estimated_case_value, notes, organization_id, created_at, updated_at)
VALUES
('Thomas', 'Mitchell', 'tmitchell@email.com', '(617) 555-2001', 'Mitchell Industries', 'Corporate Law', 'REFERRAL', 'QUALIFIED', 88, 100000.00, 'Large corporate restructuring. Referred by Johnson.', 1, NOW() - INTERVAL '3 days', NOW()),
('Amanda', 'White', 'awhite@email.com', '(617) 555-2002', NULL, 'Personal Injury', 'WEBSITE', 'CONSULTATION_SCHEDULED', 75, 200000.00, 'Serious car accident. Multiple surgeries required.', 1, NOW() - INTERVAL '4 days', NOW()),
('Kevin', 'Lee', 'klee@email.com', '(617) 555-2003', 'Lee Restaurant Group', 'Real Estate', 'REFERRAL', 'NEW', 70, 50000.00, 'Commercial lease negotiation for new location.', 1, NOW() - INTERVAL '1 day', NOW()),
('Patricia', 'Moore', 'pmoore@email.com', '(617) 555-2004', NULL, 'Family Law', 'ADVERTISING', 'CONTACTED', 65, 25000.00, 'Contested custody modification.', 1, NOW() - INTERVAL '6 days', NOW()),
('Richard', 'Taylor', 'rtaylor@email.com', '(617) 555-2005', 'Taylor Consulting', 'Employment Law', 'WEBSITE', 'QUALIFIED', 82, 75000.00, 'Executive wrongful termination.', 1, NOW() - INTERVAL '5 days', NOW()),
('Nancy', 'Anderson', 'nanderson@email.com', '(617) 555-2006', NULL, 'Estate Planning', 'REFERRAL', 'NEW', 60, 15000.00, 'Trust and will preparation.', 1, NOW() - INTERVAL '2 days', NOW()),
('Steven', 'Thomas', 'sthomas@email.com', '(617) 555-2007', 'Thomas Tech', 'Intellectual Property', 'WEBSITE', 'CONTACTED', 78, 60000.00, 'Software patent application.', 1, NOW() - INTERVAL '8 days', NOW()),
('Michelle', 'Jackson', 'mjackson@email.com', '(617) 555-2008', NULL, 'Criminal Defense', 'REFERRAL', 'CONSULTATION_SCHEDULED', 72, 40000.00, 'White collar crime defense.', 1, NOW() - INTERVAL '3 days', NOW()),
('Daniel', 'Harris', 'dharris@email.com', '(617) 555-2009', 'Harris Holdings', 'Bankruptcy', 'WEBSITE', 'QUALIFIED', 85, 150000.00, 'Chapter 11 reorganization.', 1, NOW() - INTERVAL '7 days', NOW()),
('Laura', 'Martin', 'lmartin@email.com', '(617) 555-2010', NULL, 'Immigration', 'ADVERTISING', 'NEW', 55, 12000.00, 'H1B visa assistance.', 1, NOW() - INTERVAL '1 day', NOW())
ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- 8. MORE INVOICES
-- =====================================================
INSERT INTO invoices (invoice_number, client_id, legal_case_id, issue_date, due_date, status, subtotal, tax_rate, tax_amount, total_amount, notes, organization_id, created_at, updated_at)
VALUES
('INV-2025-040', 1, 2, '2025-11-01', '2025-12-01', 'PAID', 8500.00, 6.25, 531.25, 9031.25, 'Medical malpractice services - November', 1, NOW() - INTERVAL '60 days', NOW()),
('INV-2025-041', 2, 3, '2025-11-15', '2025-12-15', 'PAID', 15000.00, 6.25, 937.50, 15937.50, 'M&A services - November', 1, NOW() - INTERVAL '45 days', NOW()),
('INV-2025-042', 3, 4, '2025-12-01', '2025-12-31', 'PENDING', 6500.00, 6.25, 406.25, 6906.25, 'Family law services - December', 1, NOW() - INTERVAL '30 days', NOW()),
('INV-2026-004', 4, 5, '2026-01-15', '2026-02-15', 'DRAFT', 12000.00, 6.25, 750.00, 12750.00, 'Criminal defense services - January', 1, NOW() - INTERVAL '10 days', NOW()),
('INV-2026-005', 5, 7, '2026-01-20', '2026-02-20', 'PENDING', 9750.00, 6.25, 609.38, 10359.38, 'Securities litigation - January', 1, NOW() - INTERVAL '5 days', NOW())
ON CONFLICT DO NOTHING;

-- =====================================================
-- 9. USER WORKLOAD
-- =====================================================
INSERT INTO user_workload (user_id, calculation_date, active_cases_count, total_workload_points, capacity_percentage, billable_hours_week, non_billable_hours_week, overdue_tasks_count, upcoming_deadlines_count, organization_id, created_at)
VALUES
(1, NOW()::date, 11, 35.0, 87.5, 38.5, 4.0, 0, 5, 1, NOW()),
(101, NOW()::date, 3, 28.5, 71.25, 32.5, 3.0, 0, 3, 1, NOW()),
(102, NOW()::date, 3, 24.0, 60.00, 25.0, 3.0, 1, 2, 1, NOW()),
(103, NOW()::date, 3, 16.0, 40.00, 18.0, 2.0, 0, 2, 1, NOW()),
(104, NOW()::date, 3, 22.5, 56.25, 22.0, 2.5, 0, 3, 1, NOW()),
(105, NOW()::date, 0, 0.0, 0.00, 0.0, 8.0, 0, 0, 1, NOW())
ON CONFLICT DO NOTHING;

-- =====================================================
-- 10. MORE CALENDAR EVENTS
-- =====================================================
INSERT INTO calendar_events (title, description, start_time, end_time, location, event_type, status, case_id, user_id, reminder_minutes, high_priority, organization_id, created_at, updated_at)
VALUES
-- Team events
('Weekly Case Review Meeting', 'Review all active cases with team', NOW() + INTERVAL '3 days' + INTERVAL '9 hours', NOW() + INTERVAL '3 days' + INTERVAL '10 hours', 'Conference Room A', 'MEETING', 'SCHEDULED', NULL, 1, 60, false, 1, NOW(), NOW()),
('Staff Training - Ethics', 'Annual ethics training session', NOW() + INTERVAL '14 days' + INTERVAL '13 hours', NOW() + INTERVAL '14 days' + INTERVAL '16 hours', 'Training Room', 'MEETING', 'SCHEDULED', NULL, 1, 120, false, 1, NOW(), NOW()),
-- Client consultations
('New Client Consultation - Mitchell', 'Initial consultation for corporate restructuring', NOW() + INTERVAL '2 days' + INTERVAL '10 hours', NOW() + INTERVAL '2 days' + INTERVAL '11 hours', 'Office', 'CONSULTATION', 'SCHEDULED', NULL, 101, 30, false, 1, NOW(), NOW()),
('Follow-up - White PI Case', 'Discuss case strategy with potential client', NOW() + INTERVAL '4 days' + INTERVAL '14 hours', NOW() + INTERVAL '4 days' + INTERVAL '15 hours', 'Video Conference', 'CONSULTATION', 'SCHEDULED', NULL, 104, 30, false, 1, NOW(), NOW()),
-- Court dates
('Hearing - Williams Criminal', 'Preliminary hearing', NOW() + INTERVAL '6 days' + INTERVAL '9 hours', NOW() + INTERVAL '6 days' + INTERVAL '12 hours', 'Suffolk Superior Court', 'COURT', 'SCHEDULED', 5, 101, 1440, true, 1, NOW(), NOW()),
('Status Conference - Patterson', 'Case status conference', NOW() + INTERVAL '9 days' + INTERVAL '10 hours', NOW() + INTERVAL '9 days' + INTERVAL '11 hours', 'Federal Court', 'HEARING', 'SCHEDULED', 7, 104, 60, false, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- =====================================================
-- 11. CASE ACTIVITIES FOR NEW DATA
-- =====================================================
INSERT INTO case_activities (case_id, user_id, activity_type, reference_type, description, metadata, organization_id, created_at)
VALUES
(2, 101, 'CASE_CREATED', 'case', 'Case opened for Martinez', '{"caseNumber": "CASE-2025-001"}', 1, NOW() - INTERVAL '30 days'),
(3, 102, 'CASE_CREATED', 'case', 'Case opened for TechVision M&A', '{"caseNumber": "CASE-2025-002"}', 1, NOW() - INTERVAL '25 days'),
(4, 104, 'CASE_CREATED', 'case', 'Case opened for Johnson divorce', '{"caseNumber": "CASE-2025-003"}', 1, NOW() - INTERVAL '20 days'),
(5, 101, 'CASE_CREATED', 'case', 'Case opened for Williams defense', '{"caseNumber": "CASE-2025-004"}', 1, NOW() - INTERVAL '18 days'),
(2, 103, 'DOCUMENT_UPLOADED', 'document', 'Uploaded complete medical records', '{"fileName": "Complete_Medical_Records.pdf"}', 1, NOW() - INTERVAL '15 days'),
(3, 102, 'DOCUMENT_UPLOADED', 'document', 'Uploaded financial statements', '{"fileName": "Target_Financials_2024.pdf"}', 1, NOW() - INTERVAL '12 days'),
(5, 101, 'HEARING_SCHEDULED', 'calendar_event', 'Scheduled preliminary hearing', '{"eventType": "COURT"}', 1, NOW() - INTERVAL '10 days'),
(2, 101, 'TIME_ENTRY_ADDED', 'time_entry', 'Logged 5.5 hours case work', '{"hours": 5.5}', 1, NOW() - INTERVAL '5 days'),
(7, 104, 'ASSIGNMENT_ADDED', 'user', 'James Wilson assigned as lead attorney', '{"role": "LEAD_ATTORNEY"}', 1, NOW() - INTERVAL '12 days'),
(8, 103, 'ASSIGNMENT_ADDED', 'user', 'Emily Rodriguez assigned as paralegal', '{"role": "PARALEGAL"}', 1, NOW() - INTERVAL '10 days')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 12. Update sequences
-- =====================================================
SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users), true);
SELECT setval('legal_cases_id_seq', (SELECT COALESCE(MAX(id), 1) FROM legal_cases), true);
SELECT setval('leads_id_seq', (SELECT COALESCE(MAX(id), 1) FROM leads), true);
SELECT setval('invoices_id_seq', (SELECT COALESCE(MAX(id), 1) FROM invoices), true);
SELECT setval('calendar_events_id_seq', (SELECT COALESCE(MAX(id), 1) FROM calendar_events), true);
SELECT setval('case_tasks_id_seq', (SELECT COALESCE(MAX(id), 1) FROM case_tasks), true);
SELECT setval('time_entries_id_seq', (SELECT COALESCE(MAX(id), 1) FROM time_entries), true);
SELECT setval('case_activities_id_seq', (SELECT COALESCE(MAX(id), 1) FROM case_activities), true);
SELECT setval('attorneys_id_seq', (SELECT COALESCE(MAX(id), 1) FROM attorneys), true);
SELECT setval('case_assignments_id_seq', (SELECT COALESCE(MAX(id), 1) FROM case_assignments), true);
