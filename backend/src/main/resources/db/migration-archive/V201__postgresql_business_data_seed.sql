-- PostgreSQL Business Data Seed
-- Populates test/sample data for the application

-- =====================================================
-- 1. MATTER TYPES (Legal Practice Areas)
-- =====================================================
INSERT INTO matter_types (name, description, default_rate, is_active, created_at, updated_at) VALUES
('Personal Injury', 'Personal injury litigation including auto accidents, slip and fall, medical malpractice', 350.00, true, NOW(), NOW()),
('Corporate Law', 'Business formation, contracts, mergers and acquisitions, corporate governance', 450.00, true, NOW(), NOW()),
('Family Law', 'Divorce, custody, adoption, prenuptial agreements', 300.00, true, NOW(), NOW()),
('Criminal Defense', 'Criminal defense representation for misdemeanors and felonies', 400.00, true, NOW(), NOW()),
('Real Estate', 'Property transactions, zoning, landlord-tenant disputes', 325.00, true, NOW(), NOW()),
('Immigration', 'Visa applications, green cards, citizenship, deportation defense', 350.00, true, NOW(), NOW()),
('Intellectual Property', 'Patents, trademarks, copyrights, trade secrets', 475.00, true, NOW(), NOW()),
('Estate Planning', 'Wills, trusts, probate, estate administration', 375.00, true, NOW(), NOW()),
('Bankruptcy', 'Chapter 7, Chapter 11, Chapter 13 bankruptcy', 350.00, true, NOW(), NOW()),
('Employment Law', 'Wrongful termination, discrimination, wage disputes', 375.00, true, NOW(), NOW()),
('Civil Litigation', 'General civil disputes, contract disputes, business torts', 350.00, true, NOW(), NOW()),
('Class Action', 'Class action litigation and mass torts', 500.00, true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 2. BILLING RATES
-- =====================================================
INSERT INTO billing_rates (user_id, rate_type, rate_amount, effective_date, is_active, organization_id, created_at, updated_at) VALUES
(1, 'STANDARD', 450.00, '2024-01-01', true, 1, NOW(), NOW()),
(1, 'PREMIUM', 550.00, '2024-01-01', true, 1, NOW(), NOW()),
(1, 'DISCOUNTED', 350.00, '2024-01-01', true, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- =====================================================
-- 3. ATTORNEYS (linked to user)
-- =====================================================
INSERT INTO attorneys (user_id, bar_number, license_state, practice_areas, experience_years, is_active, current_case_load, max_case_load, hourly_rate, organization_id, created_at, updated_at) VALUES
(1, 'BBO-123456', 'Massachusetts', '["Personal Injury", "Corporate Law", "Civil Litigation"]', 15, true, 5, 25, 450.00, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- =====================================================
-- 4. LEGAL CASES
-- =====================================================
INSERT INTO legal_cases (case_number, title, client_id, client_name, client_email, status, priority, type, description, county_name, judge_name, filing_date, next_hearing, hourly_rate, organization_id, created_at, updated_at) VALUES
('CASE-2025-001', 'Martinez v. Boston General Hospital', 1, 'Maria Martinez', 'maria.martinez@email.com', 'ACTIVE', 'HIGH', 'Personal Injury', 'Medical malpractice case involving surgical error.', 'Suffolk County', 'Hon. Patricia Williams', '2025-03-15', '2026-02-15', 350.00, 1, NOW(), NOW()),
('CASE-2025-002', 'TechVision Inc. Merger & Acquisition', 2, 'TechVision Inc.', 'legal@techvision.com', 'ACTIVE', 'HIGH', 'Corporate Law', 'Representation in $45M acquisition.', NULL, NULL, NULL, NULL, 450.00, 1, NOW(), NOW()),
('CASE-2025-003', 'Johnson v. Johnson - Divorce', 3, 'Sarah Johnson', 'sjohnson@email.com', 'ACTIVE', 'MEDIUM', 'Family Law', 'Contested divorce with custody dispute.', 'Middlesex County', 'Hon. Robert Chen', '2025-06-01', '2026-02-20', 300.00, 1, NOW(), NOW()),
('CASE-2025-004', 'Commonwealth v. Williams', 4, 'James Williams', 'jwilliams@email.com', 'ACTIVE', 'HIGH', 'Criminal Defense', 'Defense of white collar fraud charges.', 'Suffolk County', 'Hon. David Patterson', '2025-08-10', '2026-01-30', 400.00, 1, NOW(), NOW()),
('CASE-2025-005', 'Riverfront Development Zoning', 2, 'TechVision Inc.', 'legal@techvision.com', 'ACTIVE', 'MEDIUM', 'Real Estate', 'Zoning variance application.', 'Cambridge', NULL, '2025-09-20', '2026-02-27', 325.00, 1, NOW(), NOW()),
('CASE-2025-006', 'Patterson v. Boston Financial', 5, 'Robert Patterson', 'rpatterson@email.com', 'ACTIVE', 'HIGH', 'Civil Litigation', 'Securities fraud litigation.', 'Suffolk County', 'Hon. Sarah Martinez', '2025-04-12', '2026-02-10', 375.00, 1, NOW(), NOW()),
('CASE-2025-007', 'Rodriguez Immigration - Green Card', 3, 'Carlos Rodriguez', 'crodriguez@email.com', 'ACTIVE', 'MEDIUM', 'Immigration', 'Employment-based green card application.', NULL, NULL, '2025-07-01', '2026-01-16', 350.00, 1, NOW(), NOW()),
('CASE-2025-008', 'Quantum Computing Patent', 1, 'Maria Martinez', 'maria.martinez@email.com', 'ACTIVE', 'HIGH', 'Intellectual Property', 'Patent prosecution for quantum computing algorithm.', NULL, NULL, '2025-05-15', '2026-01-31', 475.00, 1, NOW(), NOW()),
('CASE-2025-009', 'Thompson Family Estate Plan', 4, 'James Williams', 'jwilliams@email.com', 'ACTIVE', 'LOW', 'Estate Planning', 'Comprehensive estate planning with trust.', NULL, NULL, NULL, NULL, 375.00, 1, NOW(), NOW()),
('CASE-2025-010', 'Global Retail Chapter 11', 5, 'Robert Patterson', 'rpatterson@email.com', 'ACTIVE', 'HIGH', 'Bankruptcy', 'Chapter 11 reorganization for retail chain.', 'Suffolk County', 'Hon. Michael Brown', '2025-10-01', '2026-02-16', 350.00, 1, NOW(), NOW()),
('CASE-2025-011', 'DataSecure Class Action', 1, 'Maria Martinez', 'maria.martinez@email.com', 'ACTIVE', 'HIGH', 'Class Action', 'Class action for data breach.', 'Suffolk County', 'Hon. Emily Johnson', '2025-08-25', '2026-02-17', 500.00, 1, NOW(), NOW())
ON CONFLICT (case_number) DO NOTHING;

-- =====================================================
-- 5. LEADS
-- =====================================================
INSERT INTO leads (first_name, last_name, email, phone, company, practice_area, source, status, lead_score, estimated_case_value, notes, organization_id, created_at, updated_at) VALUES
('Jennifer', 'Adams', 'jadams@email.com', '(617) 555-1001', 'Adams Tech LLC', 'Corporate Law', 'WEBSITE', 'NEW', 75, 25000.00, 'Interested in business formation services', 1, NOW() - INTERVAL '2 days', NOW()),
('Michael', 'Brown', 'mbrown@email.com', '(617) 555-1002', NULL, 'Personal Injury', 'REFERRAL', 'CONTACTED', 85, 150000.00, 'Auto accident case. Referred by existing client.', 1, NOW() - INTERVAL '5 days', NOW()),
('Sarah', 'Clark', 'sclark@email.com', '(617) 555-1003', 'Clark Properties', 'Real Estate', 'WEBSITE', 'QUALIFIED', 65, 15000.00, 'Commercial lease review needed', 1, NOW() - INTERVAL '7 days', NOW()),
('David', 'Evans', 'devans@email.com', '(617) 555-1004', NULL, 'Family Law', 'ADVERTISING', 'CONSULTATION_SCHEDULED', 70, 20000.00, 'Divorce consultation scheduled', 1, NOW() - INTERVAL '3 days', NOW()),
('Emily', 'Foster', 'efoster@email.com', '(617) 555-1005', 'Foster Innovations', 'Intellectual Property', 'REFERRAL', 'NEW', 90, 75000.00, 'Patent application for new technology.', 1, NOW() - INTERVAL '1 day', NOW()),
('Robert', 'Garcia', 'rgarcia@email.com', '(617) 555-1006', NULL, 'Criminal Defense', 'WEBSITE', 'CONTACTED', 60, 35000.00, 'DUI defense inquiry', 1, NOW() - INTERVAL '10 days', NOW()),
('Lisa', 'Harris', 'lharris@email.com', '(617) 555-1007', 'Harris & Co', 'Employment Law', 'REFERRAL', 'QUALIFIED', 80, 50000.00, 'Wrongful termination case.', 1, NOW() - INTERVAL '4 days', NOW()),
('James', 'Irving', 'jirving@email.com', '(617) 555-1008', NULL, 'Estate Planning', 'ADVERTISING', 'NEW', 55, 8000.00, 'Basic estate planning needs', 1, NOW() - INTERVAL '6 days', NOW())
ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- 6. INVOICES
-- =====================================================
INSERT INTO invoices (invoice_number, client_id, legal_case_id, issue_date, due_date, status, subtotal, tax_rate, tax_amount, total_amount, notes, organization_id, created_at, updated_at) VALUES
('INV-2026-001', 1, 1, '2026-01-01', '2026-01-31', 'PENDING', 12500.00, 6.25, 781.25, 13281.25, 'Legal services for January 2026', 1, NOW(), NOW()),
('INV-2026-002', 2, 2, '2026-01-05', '2026-02-05', 'PENDING', 22500.00, 6.25, 1406.25, 23906.25, 'M&A due diligence services', 1, NOW(), NOW()),
('INV-2025-045', 3, 3, '2025-12-15', '2026-01-15', 'OVERDUE', 8750.00, 6.25, 546.88, 9296.88, 'Family law services - December', 1, NOW(), NOW()),
('INV-2025-044', 4, 4, '2025-12-01', '2025-12-31', 'PAID', 15000.00, 6.25, 937.50, 15937.50, 'Criminal defense services', 1, NOW(), NOW()),
('INV-2025-043', 5, 6, '2025-11-15', '2025-12-15', 'PAID', 18500.00, 6.25, 1156.25, 19656.25, 'Securities litigation services', 1, NOW(), NOW()),
('INV-2026-003', 1, 8, '2026-01-10', '2026-02-10', 'DRAFT', 9500.00, 6.25, 593.75, 10093.75, 'Patent application services', 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- =====================================================
-- 7. CALENDAR EVENTS
-- =====================================================
INSERT INTO calendar_events (title, description, start_time, end_time, location, event_type, status, case_id, user_id, reminder_minutes, high_priority, organization_id, created_at, updated_at) VALUES
('Client Consultation - Martinez', 'Review medical records and trial preparation', NOW() + INTERVAL '2 hours', NOW() + INTERVAL '3 hours', 'Office - Conference Room A', 'CONSULTATION', 'SCHEDULED', 1, 1, 30, false, 1, NOW(), NOW()),
('Motion Hearing - Patterson', 'Motion for Summary Judgment hearing', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day' + INTERVAL '2 hours', 'U.S. District Court, Room 5', 'HEARING', 'SCHEDULED', 6, 1, 60, true, 1, NOW(), NOW()),
('Document Review - TechVision', 'Due diligence document review session', NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days' + INTERVAL '4 hours', 'Office', 'MEETING', 'SCHEDULED', 2, 1, 30, false, 1, NOW(), NOW()),
('Deposition - Williams Case', 'Witness deposition for defense', NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days' + INTERVAL '3 hours', 'Law Office Conference Room', 'DEPOSITION', 'SCHEDULED', 4, 1, 60, true, 1, NOW(), NOW()),
('Immigration Interview Prep', 'Prepare Rodriguez for USCIS interview', NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days' + INTERVAL '2 hours', 'Video Conference', 'CONSULTATION', 'SCHEDULED', 7, 1, 30, false, 1, NOW(), NOW()),
('DEADLINE: Discovery Response', 'Williams case discovery response due', NOW() + INTERVAL '4 days', NOW() + INTERVAL '4 days', NULL, 'DEADLINE', 'SCHEDULED', 4, 1, 1440, true, 1, NOW(), NOW()),
('DEADLINE: Patent Filing', 'Submit amended patent claims', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days', NULL, 'DEADLINE', 'SCHEDULED', 8, 1, 1440, true, 1, NOW(), NOW()),
('Pre-Trial Conference - Martinez', 'Scheduling conference with judge', NOW() + INTERVAL '8 days', NOW() + INTERVAL '8 days' + INTERVAL '1 hour', 'Suffolk Superior Court', 'HEARING', 'SCHEDULED', 1, 1, 60, false, 1, NOW(), NOW()),
('Mediation - Johnson Divorce', 'Settlement mediation session', NOW() + INTERVAL '10 days', NOW() + INTERVAL '10 days' + INTERVAL '4 hours', 'Mediation Center Boston', 'MEETING', 'SCHEDULED', 3, 1, 120, false, 1, NOW(), NOW()),
('Bankruptcy Court Hearing', 'Chapter 11 plan confirmation', NOW() + INTERVAL '12 days', NOW() + INTERVAL '12 days' + INTERVAL '3 hours', 'U.S. Bankruptcy Court', 'HEARING', 'SCHEDULED', 10, 1, 120, true, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- =====================================================
-- 8. CASE TASKS
-- =====================================================
INSERT INTO case_tasks (case_id, title, description, task_type, status, priority, due_date, assigned_to, assigned_by, organization_id, created_at, updated_at) VALUES
(1, 'Review medical expert report', 'Review and summarize the medical expert opinion for trial', 'REVIEW', 'IN_PROGRESS', 'HIGH', NOW() + INTERVAL '3 days', 1, 1, 1, NOW(), NOW()),
(1, 'Prepare trial exhibits', 'Organize and label all exhibits for trial presentation', 'DOCUMENT_PREP', 'TODO', 'HIGH', NOW() + INTERVAL '7 days', 1, 1, 1, NOW(), NOW()),
(2, 'Complete due diligence checklist', 'Verify all items on the M&A due diligence checklist', 'REVIEW', 'IN_PROGRESS', 'HIGH', NOW() + INTERVAL '5 days', 1, 1, 1, NOW(), NOW()),
(2, 'Draft merger agreement', 'Prepare initial draft of the merger agreement', 'DOCUMENT_PREP', 'TODO', 'MEDIUM', NOW() + INTERVAL '14 days', 1, 1, 1, NOW(), NOW()),
(3, 'Prepare asset division proposal', 'Draft proposal for division of marital assets', 'DOCUMENT_PREP', 'COMPLETED', 'MEDIUM', NOW() - INTERVAL '2 days', 1, 1, 1, NOW() - INTERVAL '5 days', NOW()),
(4, 'File discovery responses', 'Complete and file responses to prosecution discovery requests', 'FILING', 'IN_PROGRESS', 'HIGH', NOW() + INTERVAL '4 days', 1, 1, 1, NOW(), NOW()),
(6, 'Draft opposition brief', 'Prepare opposition to motion for summary judgment', 'DOCUMENT_PREP', 'IN_PROGRESS', 'HIGH', NOW() + INTERVAL '2 days', 1, 1, 1, NOW(), NOW()),
(7, 'Gather supporting documents', 'Collect employment verification and tax documents', 'DOCUMENT_PREP', 'TODO', 'MEDIUM', NOW() + INTERVAL '10 days', 1, 1, 1, NOW(), NOW()),
(8, 'Respond to USPTO office action', 'Prepare response to patent examiner objections', 'CORRESPONDENCE', 'TODO', 'HIGH', NOW() + INTERVAL '7 days', 1, 1, 1, NOW(), NOW()),
(10, 'Negotiate with creditor committee', 'Continue negotiations with unsecured creditors', 'CLIENT_MEETING', 'IN_PROGRESS', 'HIGH', NOW() + INTERVAL '6 days', 1, 1, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- =====================================================
-- 9. TIME ENTRIES
-- =====================================================
INSERT INTO time_entries (legal_case_id, user_id, hours, rate, description, date, billable, status, organization_id, created_at, updated_at) VALUES
(1, 1, 2.5, 450.00, 'Reviewed medical records and prepared case summary', NOW()::date - 1, true, 'APPROVED', 1, NOW(), NOW()),
(1, 1, 1.5, 450.00, 'Client phone conference regarding trial preparation', NOW()::date - 1, true, 'APPROVED', 1, NOW(), NOW()),
(2, 1, 4.0, 450.00, 'Due diligence document review - financial statements', NOW()::date - 2, true, 'APPROVED', 1, NOW(), NOW()),
(2, 1, 2.0, 450.00, 'Drafted initial merger agreement sections', NOW()::date - 2, true, 'APPROVED', 1, NOW(), NOW()),
(4, 1, 3.0, 400.00, 'Prepared discovery response documents', NOW()::date - 3, true, 'APPROVED', 1, NOW(), NOW()),
(6, 1, 4.5, 375.00, 'Research for opposition brief', NOW()::date - 3, true, 'APPROVED', 1, NOW(), NOW()),
(6, 1, 3.0, 375.00, 'Drafted opposition to summary judgment motion', NOW()::date - 4, true, 'APPROVED', 1, NOW(), NOW()),
(3, 1, 2.0, 300.00, 'Mediation preparation and strategy session', NOW()::date - 4, true, 'APPROVED', 1, NOW(), NOW()),
(8, 1, 5.0, 475.00, 'Patent claims analysis and prior art review', NOW()::date - 5, true, 'APPROVED', 1, NOW(), NOW()),
(10, 1, 3.5, 350.00, 'Creditor committee negotiation meeting', NOW()::date - 5, true, 'APPROVED', 1, NOW(), NOW()),
(1, 1, 6.0, 450.00, 'Deposition preparation and attendance', NOW()::date - 7, true, 'APPROVED', 1, NOW(), NOW()),
(2, 1, 8.0, 450.00, 'M&A transaction structuring meeting', NOW()::date - 10, true, 'APPROVED', 1, NOW(), NOW()),
(7, 1, 2.5, 350.00, 'Green card application document preparation', NOW()::date - 12, true, 'APPROVED', 1, NOW(), NOW()),
(9, 1, 3.0, 375.00, 'Estate planning consultation and document drafting', NOW()::date - 14, true, 'APPROVED', 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- =====================================================
-- 10. VENDORS (needed for expenses)
-- =====================================================
INSERT INTO vendor (name, contact_name, email, phone, website, address, notes, is_active, organization_id, created_at, updated_at) VALUES
('Suffolk County Court', 'Clerk Office', 'clerk@suffolkcourt.gov', '(617) 555-0001', 'suffolkcourt.gov', '3 Pemberton Square, Boston, MA', 'Court filing fees', true, 1, NOW(), NOW()),
('Westlaw', 'Account Services', 'support@westlaw.com', '(800) 555-0002', 'westlaw.com', NULL, 'Legal research database', true, 1, NOW(), NOW()),
('Boston Medical Experts LLC', 'Dr. James Smith', 'jsmith@bme.com', '(617) 555-0003', NULL, '100 Medical Way, Boston, MA', 'Medical expert witness', true, 1, NOW(), NOW()),
('US Patent Office', 'USPTO', 'contact@uspto.gov', '(800) 555-0004', 'uspto.gov', 'Alexandria, VA', 'Patent filing fees', true, 1, NOW(), NOW()),
('Court Reporters Inc', 'Susan Miller', 'smiller@courtrep.com', '(617) 555-0005', 'courtrep.com', '50 Federal St, Boston, MA', 'Deposition transcripts', true, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- =====================================================
-- 11. CASE ACTIVITIES (Audit Trail)
-- =====================================================
INSERT INTO case_activities (case_id, user_id, activity_type, reference_type, description, metadata, organization_id, created_at) VALUES
(1, 1, 'DOCUMENT_UPLOADED', 'document', 'Uploaded medical records summary', '{"fileName": "Medical_Records_Summary.pdf"}', 1, NOW() - INTERVAL '30 minutes'),
(6, 1, 'NOTE_ADDED', 'note', 'Added notes on motion strategy', '{"noteTitle": "Motion Strategy Notes"}', 1, NOW() - INTERVAL '1 hour'),
(2, 1, 'STATUS_CHANGED', 'case', 'Case moved to Due Diligence phase', '{"oldStatus": "DISCOVERY", "newStatus": "DUE_DILIGENCE"}', 1, NOW() - INTERVAL '2 hours'),
(4, 1, 'DOCUMENT_UPLOADED', 'document', 'Uploaded witness statement', '{"fileName": "Witness_Statement.pdf"}', 1, NOW() - INTERVAL '1 day'),
(7, 1, 'NOTE_ADDED', 'note', 'Updated immigration timeline', '{"noteTitle": "Immigration Timeline"}', 1, NOW() - INTERVAL '1 day'),
(3, 1, 'STATUS_CHANGED', 'case', 'Case moved to Settlement Negotiation', '{"oldStatus": "DISCOVERY", "newStatus": "SETTLEMENT"}', 1, NOW() - INTERVAL '1 day'),
(8, 1, 'DOCUMENT_UPLOADED', 'document', 'Filed amended patent claims', '{"fileName": "Amended_Claims.pdf"}', 1, NOW() - INTERVAL '2 days'),
(5, 1, 'DOCUMENT_UPLOADED', 'document', 'Uploaded zoning variance application', '{"fileName": "Zoning_Application.pdf"}', 1, NOW() - INTERVAL '2 days'),
(10, 1, 'NOTE_ADDED', 'note', 'Creditor meeting notes added', '{"noteTitle": "Creditor Meeting Notes"}', 1, NOW() - INTERVAL '3 days'),
(11, 1, 'STATUS_CHANGED', 'case', 'Class action certified', '{"oldStatus": "PENDING", "newStatus": "ACTIVE"}', 1, NOW() - INTERVAL '3 days'),
(1, 1, 'TIME_ENTRY_ADDED', 'time_entry', 'Logged 2.5 hours: Trial preparation', '{"hours": 2.5}', 1, NOW() - INTERVAL '4 days'),
(6, 1, 'PAYMENT_RECEIVED', 'payment', 'Payment received: $5000.00', '{"amount": 5000.00}', 1, NOW() - INTERVAL '4 days'),
(9, 1, 'DOCUMENT_UPLOADED', 'document', 'Updated estate planning documents', '{"fileName": "Estate_Plan_Update.pdf"}', 1, NOW() - INTERVAL '5 days')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 12. Update sequences
-- =====================================================
SELECT setval('legal_cases_id_seq', (SELECT COALESCE(MAX(id), 1) FROM legal_cases), true);
SELECT setval('leads_id_seq', (SELECT COALESCE(MAX(id), 1) FROM leads), true);
SELECT setval('invoices_id_seq', (SELECT COALESCE(MAX(id), 1) FROM invoices), true);
SELECT setval('calendar_events_id_seq', (SELECT COALESCE(MAX(id), 1) FROM calendar_events), true);
SELECT setval('case_tasks_id_seq', (SELECT COALESCE(MAX(id), 1) FROM case_tasks), true);
SELECT setval('time_entries_id_seq', (SELECT COALESCE(MAX(id), 1) FROM time_entries), true);
SELECT setval('matter_types_id_seq', (SELECT COALESCE(MAX(id), 1) FROM matter_types), true);
SELECT setval('billing_rates_id_seq', (SELECT COALESCE(MAX(id), 1) FROM billing_rates), true);
SELECT setval('attorneys_id_seq', (SELECT COALESCE(MAX(id), 1) FROM attorneys), true);
SELECT setval('case_activities_id_seq', (SELECT COALESCE(MAX(id), 1) FROM case_activities), true);
SELECT setval('vendor_id_seq', (SELECT COALESCE(MAX(id), 1) FROM vendor), true);
