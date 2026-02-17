-- Sample Dashboard Data for December 2025 and January 2026
-- This migration adds realistic calendar events and case activities

-- Get the main user ID (Marsel Hoxha)
SET @user_id = (SELECT id FROM users WHERE email = 'marsel.hox@gmail.com' LIMIT 1);

-- =====================================================
-- CALENDAR EVENTS - December 2025
-- =====================================================

-- Today's Events (December 2, 2025)
INSERT INTO calendar_events (title, description, start_time, end_time, location, event_type, status, case_id, user_id, reminder_minutes, created_at, updated_at) VALUES
('Client Consultation - Martinez Case', 'Initial review of medical records with client', '2025-12-02 09:00:00', '2025-12-02 10:00:00', 'Video Conference', 'CONSULTATION', 'SCHEDULED', 1, @user_id, 30, NOW(), NOW()),
('Motion Hearing - Patterson v. Boston Financial', 'Motion for Summary Judgment', '2025-12-02 14:00:00', '2025-12-02 15:30:00', 'Suffolk Superior Court, Room 4B', 'HEARING', 'SCHEDULED', 6, @user_id, 60, NOW(), NOW()),
('Document Review - TechVision Merger', 'Review due diligence documents', '2025-12-02 16:00:00', '2025-12-02 18:00:00', 'Office', 'DOCUMENT_REVIEW', 'SCHEDULED', 2, @user_id, 15, NOW(), NOW());

-- Tomorrow's Events (December 3, 2025)
INSERT INTO calendar_events (title, description, start_time, end_time, location, event_type, status, case_id, user_id, reminder_minutes, created_at, updated_at) VALUES
('Deposition - Williams Criminal Case', 'Witness deposition for defense', '2025-12-03 10:00:00', '2025-12-03 12:00:00', 'Law Office Conference Room', 'DEPOSITION', 'SCHEDULED', 4, @user_id, 60, NOW(), NOW()),
('Client Meeting - Rodriguez Immigration', 'Green card application status update', '2025-12-03 14:00:00', '2025-12-03 15:00:00', 'Video Conference', 'CONSULTATION', 'SCHEDULED', 7, @user_id, 30, NOW(), NOW());

-- This Week's Deadlines (with high_priority)
INSERT INTO calendar_events (title, description, start_time, end_time, location, event_type, status, case_id, user_id, reminder_minutes, created_at, updated_at, `high_priority`) VALUES
('FILING DEADLINE: Response to Motion', 'Opposition brief due for Patterson case', '2025-12-04 17:00:00', '2025-12-04 17:00:00', NULL, 'DEADLINE', 'SCHEDULED', 6, @user_id, 1440, NOW(), NOW(), 1),
('Discovery Deadline - Williams Case', 'Interrogatories response due', '2025-12-05 17:00:00', '2025-12-05 17:00:00', NULL, 'DEADLINE', 'SCHEDULED', 4, @user_id, 1440, NOW(), NOW(), 1),
('Contract Review Deadline', 'Final review of merger agreement', '2025-12-06 12:00:00', '2025-12-06 12:00:00', NULL, 'DEADLINE', 'SCHEDULED', 2, @user_id, 720, NOW(), NOW(), 0);

-- Rest of December Events
INSERT INTO calendar_events (title, description, start_time, end_time, location, event_type, status, case_id, user_id, reminder_minutes, created_at, updated_at) VALUES
('Pre-Trial Conference - Martinez', 'Scheduling conference with judge', '2025-12-09 09:30:00', '2025-12-09 10:30:00', 'Suffolk Superior Court', 'HEARING', 'SCHEDULED', 1, @user_id, 60, NOW(), NOW()),
('Mediation - Johnson Divorce', 'Settlement mediation session', '2025-12-10 13:00:00', '2025-12-10 17:00:00', 'Mediation Center Boston', 'MEETING', 'SCHEDULED', 3, @user_id, 120, NOW(), NOW()),
('Client Presentation - Riverfront Project', 'Present zoning variance strategy', '2025-12-11 10:00:00', '2025-12-11 11:30:00', 'Cambridge Properties HQ', 'CONSULTATION', 'SCHEDULED', 5, @user_id, 60, NOW(), NOW()),
('Estate Planning Review', 'Annual review with Thompson family', '2025-12-13 14:00:00', '2025-12-13 15:30:00', 'Office', 'CONSULTATION', 'SCHEDULED', 9, @user_id, 30, NOW(), NOW()),
('Bankruptcy Court Hearing', 'Chapter 11 plan confirmation', '2025-12-16 09:00:00', '2025-12-16 12:00:00', 'US Bankruptcy Court', 'HEARING', 'SCHEDULED', 10, @user_id, 120, NOW(), NOW()),
('Class Action Status Conference', 'Data breach case status', '2025-12-17 11:00:00', '2025-12-17 12:00:00', 'Federal Court', 'HEARING', 'SCHEDULED', 11, @user_id, 60, NOW(), NOW()),
('Year-End Client Review - TechVision', 'Annual legal review meeting', '2025-12-18 15:00:00', '2025-12-18 16:30:00', 'TechVision Offices', 'MEETING', 'SCHEDULED', 2, @user_id, 60, NOW(), NOW()),
('Holiday Party', 'Firm holiday celebration', '2025-12-20 17:00:00', '2025-12-20 20:00:00', 'The Seaport Hotel', 'MEETING', 'SCHEDULED', NULL, @user_id, 60, NOW(), NOW());

-- December Deadlines (with high_priority)
INSERT INTO calendar_events (title, description, start_time, end_time, location, event_type, status, case_id, user_id, reminder_minutes, created_at, updated_at, `high_priority`) VALUES
('Patent Filing Deadline', 'Submit amended patent claims', '2025-12-12 17:00:00', '2025-12-12 17:00:00', NULL, 'DEADLINE', 'SCHEDULED', 8, @user_id, 1440, NOW(), NOW(), 1);

-- =====================================================
-- CALENDAR EVENTS - January 2026
-- =====================================================
INSERT INTO calendar_events (title, description, start_time, end_time, location, event_type, status, case_id, user_id, reminder_minutes, created_at, updated_at, `high_priority`) VALUES
('Trial Preparation - Martinez', 'Final trial prep session', '2026-01-06 09:00:00', '2026-01-06 17:00:00', 'Office', 'MEETING', 'SCHEDULED', 1, @user_id, 60, NOW(), NOW(), 1),
('TRIAL START: Martinez v. Boston General', 'Medical malpractice trial begins', '2026-01-13 09:00:00', '2026-01-13 17:00:00', 'Suffolk Superior Court', 'COURT', 'SCHEDULED', 1, @user_id, 1440, NOW(), NOW(), 1),
('TRIAL DAY 2: Martinez', 'Plaintiff testimony', '2026-01-14 09:00:00', '2026-01-14 17:00:00', 'Suffolk Superior Court', 'COURT', 'SCHEDULED', 1, @user_id, 60, NOW(), NOW(), 1),
('TRIAL DAY 3: Martinez', 'Expert witnesses', '2026-01-15 09:00:00', '2026-01-15 17:00:00', 'Suffolk Superior Court', 'COURT', 'SCHEDULED', 1, @user_id, 60, NOW(), NOW(), 1),
('Immigration Interview - Rodriguez', 'USCIS Green Card interview', '2026-01-16 10:00:00', '2026-01-16 11:00:00', 'USCIS Boston Field Office', 'HEARING', 'SCHEDULED', 7, @user_id, 1440, NOW(), NOW(), 1),
('Merger Closing - TechVision', 'Final closing meeting', '2026-01-20 14:00:00', '2026-01-20 17:00:00', 'TechVision HQ', 'MEETING', 'SCHEDULED', 2, @user_id, 120, NOW(), NOW(), 1),
('Sentencing Hearing - Williams', 'Criminal case sentencing', '2026-01-22 09:00:00', '2026-01-22 11:00:00', 'Suffolk Superior Court', 'HEARING', 'SCHEDULED', 4, @user_id, 1440, NOW(), NOW(), 1),
('Zoning Board Hearing - Riverfront', 'Variance application hearing', '2026-01-27 18:00:00', '2026-01-27 20:00:00', 'Cambridge City Hall', 'HEARING', 'SCHEDULED', 5, @user_id, 120, NOW(), NOW(), 0),
('Q1 Planning Meeting', 'Quarterly case review', '2026-01-30 10:00:00', '2026-01-30 12:00:00', 'Office', 'MEETING', 'SCHEDULED', NULL, @user_id, 60, NOW(), NOW(), 0),
('Filing Deadline - Patent Appeal', 'Appeal brief due', '2026-01-31 17:00:00', '2026-01-31 17:00:00', NULL, 'DEADLINE', 'SCHEDULED', 8, @user_id, 1440, NOW(), NOW(), 1);

-- =====================================================
-- CASE ACTIVITIES - Recent Activity Log
-- =====================================================

-- Activities from today and recent days
INSERT INTO case_activities (case_id, user_id, activity_type, reference_type, description, metadata, created_at) VALUES
-- Today's activities
(1, @user_id, 'DOCUMENT_UPLOADED', 'document', 'Uploaded medical records summary for Martinez case', '{"fileName": "Medical_Records_Summary.pdf", "fileSize": "2.4MB"}', DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
(6, @user_id, 'NOTE_ADDED', 'note', 'Added notes on motion strategy for Patterson case', '{"noteTitle": "Motion Strategy Notes"}', DATE_SUB(NOW(), INTERVAL 1 HOUR)),
(2, @user_id, 'STATUS_CHANGED', 'case', 'TechVision merger moved to Due Diligence phase', '{"oldStatus": "DISCOVERY", "newStatus": "DUE_DILIGENCE"}', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(4, @user_id, 'DOCUMENT_UPLOADED', 'document', 'Uploaded witness statement for Williams defense', '{"fileName": "Witness_Statement_Davis.pdf"}', DATE_SUB(NOW(), INTERVAL 3 HOUR)),

-- Yesterday's activities
(7, @user_id, 'NOTE_ADDED', 'note', 'Updated immigration timeline for Rodriguez application', '{"noteTitle": "Immigration Timeline Update"}', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(3, @user_id, 'STATUS_CHANGED', 'case', 'Johnson divorce moved to Settlement Negotiation', '{"oldStatus": "DISCOVERY", "newStatus": "SETTLEMENT"}', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(8, @user_id, 'DOCUMENT_UPLOADED', 'document', 'Filed amended patent claims for Quantum Computing case', '{"fileName": "Amended_Patent_Claims.pdf"}', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(1, @user_id, 'NOTE_ADDED', 'note', 'Expert witness coordination notes added', '{"noteTitle": "Expert Witness Coordination"}', DATE_SUB(NOW(), INTERVAL 1 DAY)),

-- 2 days ago
(5, @user_id, 'DOCUMENT_UPLOADED', 'document', 'Uploaded zoning variance application for Riverfront', '{"fileName": "Zoning_Variance_Application.pdf"}', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(10, @user_id, 'NOTE_ADDED', 'note', 'Bankruptcy plan amendments discussed with creditors', '{"noteTitle": "Creditor Meeting Notes"}', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(11, @user_id, 'STATUS_CHANGED', 'case', 'Data breach class action certified', '{"oldStatus": "PENDING", "newStatus": "ACTIVE"}', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(9, @user_id, 'DOCUMENT_UPLOADED', 'document', 'Updated estate planning documents for Thompson', '{"fileName": "Estate_Plan_2024_Update.pdf"}', DATE_SUB(NOW(), INTERVAL 2 DAY)),

-- 3 days ago
(2, @user_id, 'NOTE_ADDED', 'note', 'Due diligence findings summary prepared', '{"noteTitle": "Due Diligence Summary"}', DATE_SUB(NOW(), INTERVAL 3 DAY)),
(6, @user_id, 'DOCUMENT_UPLOADED', 'document', 'Filed motion for summary judgment', '{"fileName": "Motion_Summary_Judgment.pdf"}', DATE_SUB(NOW(), INTERVAL 3 DAY)),
(4, @user_id, 'NOTE_ADDED', 'note', 'Plea negotiation strategy outlined', '{"noteTitle": "Plea Strategy Notes"}', DATE_SUB(NOW(), INTERVAL 3 DAY)),

-- 4 days ago
(1, @user_id, 'DOCUMENT_UPLOADED', 'document', 'Deposition transcript uploaded', '{"fileName": "Deposition_Transcript_Dr_Smith.pdf"}', DATE_SUB(NOW(), INTERVAL 4 DAY)),
(7, @user_id, 'STATUS_CHANGED', 'case', 'Rodriguez green card application submitted to USCIS', '{"oldStatus": "PREPARATION", "newStatus": "FILED"}', DATE_SUB(NOW(), INTERVAL 4 DAY)),
(3, @user_id, 'DOCUMENT_UPLOADED', 'document', 'Asset division proposal drafted', '{"fileName": "Asset_Division_Proposal.pdf"}', DATE_SUB(NOW(), INTERVAL 4 DAY)),

-- 5 days ago
(8, @user_id, 'NOTE_ADDED', 'note', 'Patent infringement analysis completed', '{"noteTitle": "Infringement Analysis"}', DATE_SUB(NOW(), INTERVAL 5 DAY)),
(5, @user_id, 'NOTE_ADDED', 'note', 'Environmental impact review notes', '{"noteTitle": "Environmental Review Notes"}', DATE_SUB(NOW(), INTERVAL 5 DAY)),
(10, @user_id, 'DOCUMENT_UPLOADED', 'document', 'Chapter 11 reorganization plan filed', '{"fileName": "Chapter_11_Reorg_Plan.pdf"}', DATE_SUB(NOW(), INTERVAL 5 DAY)),

-- Last week activities
(11, @user_id, 'DOCUMENT_UPLOADED', 'document', 'Data breach impact assessment uploaded', '{"fileName": "Data_Breach_Assessment.pdf"}', DATE_SUB(NOW(), INTERVAL 6 DAY)),
(9, @user_id, 'NOTE_ADDED', 'note', 'Trust provisions reviewed and updated', '{"noteTitle": "Trust Review Notes"}', DATE_SUB(NOW(), INTERVAL 6 DAY)),
(2, @user_id, 'DOCUMENT_UPLOADED', 'document', 'Merger agreement draft v3 uploaded', '{"fileName": "Merger_Agreement_v3.pdf"}', DATE_SUB(NOW(), INTERVAL 7 DAY)),
(1, @user_id, 'STATUS_CHANGED', 'case', 'Martinez case moved to Trial Preparation', '{"oldStatus": "DISCOVERY", "newStatus": "TRIAL_PREP"}', DATE_SUB(NOW(), INTERVAL 7 DAY)),
(6, @user_id, 'NOTE_ADDED', 'note', 'Opposition research completed', '{"noteTitle": "Opposition Research"}', DATE_SUB(NOW(), INTERVAL 7 DAY));

-- =====================================================
-- ADDITIONAL DIVERSE ACTIVITIES (New Activity Types)
-- =====================================================

INSERT INTO case_activities (case_id, user_id, activity_type, reference_type, description, metadata, created_at) VALUES
-- Today - Communications & Hearings
(1, @user_id, 'CLIENT_CONTACTED', 'communication', 'Contacted client via phone: Case status update and trial preparation', '{"contactMethod": "phone", "subject": "Case status update and trial preparation"}', DATE_SUB(NOW(), INTERVAL 45 MINUTE)),
(6, @user_id, 'HEARING_SCHEDULED', 'calendar_event', 'Scheduled hearing: Motion for Summary Judgment', '{"eventTitle": "Motion for Summary Judgment", "eventType": "HEARING"}', DATE_SUB(NOW(), INTERVAL 90 MINUTE)),
(2, @user_id, 'EMAIL_SENT', 'email', 'Email sent to client@techvision.com: "Due Diligence Update"', '{"recipient": "client@techvision.com", "subject": "Due Diligence Update"}', DATE_SUB(NOW(), INTERVAL 2 HOUR)),

-- Today - Financial
(1, @user_id, 'TIME_ENTRY_ADDED', 'time_entry', 'Logged 2.5 hours: Trial preparation and witness coordination', '{"hours": 2.5, "description": "Trial preparation and witness coordination"}', DATE_SUB(NOW(), INTERVAL 3 HOUR)),
(6, @user_id, 'PAYMENT_RECEIVED', 'payment', 'Payment received: $5000.00', '{"amount": 5000.00}', DATE_SUB(NOW(), INTERVAL 4 HOUR)),

-- Yesterday - Team & Assignments
(1, @user_id, 'ASSIGNMENT_ADDED', 'user', 'Sarah Chen assigned as paralegal', '{"assigneeName": "Sarah Chen", "roleType": "PARALEGAL"}', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(2, @user_id, 'TASK_CREATED', 'case_reminders', 'Reminder "Review merger financials" created', '{"reminderTitle": "Review merger financials"}', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(4, @user_id, 'CLIENT_CONTACTED', 'communication', 'Contacted client via video call: Evidence review session', '{"contactMethod": "video call", "subject": "Evidence review session"}', DATE_SUB(NOW(), INTERVAL 1 DAY)),

-- Yesterday - More Financial
(3, @user_id, 'INVOICE_CREATED', 'invoice', 'Invoice created for $12500.00', '{"amount": 12500.00}', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(7, @user_id, 'TIME_ENTRY_ADDED', 'time_entry', 'Logged 1.5 hours: Immigration form preparation', '{"hours": 1.5, "description": "Immigration form preparation"}', DATE_SUB(NOW(), INTERVAL 1 DAY)),

-- 2 days ago - Hearings & Court
(4, @user_id, 'HEARING_SCHEDULED', 'calendar_event', 'Scheduled deposition: Witness Davis testimony', '{"eventTitle": "Witness Davis testimony", "eventType": "DEPOSITION"}', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(5, @user_id, 'HEARING_SCHEDULED', 'calendar_event', 'Scheduled hearing: Zoning Board Hearing', '{"eventTitle": "Zoning Board Hearing", "eventType": "HEARING"}', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(1, @user_id, 'PRIORITY_CHANGED', 'case', 'Case priority changed from MEDIUM to HIGH', '{"oldPriority": "MEDIUM", "newPriority": "HIGH"}', DATE_SUB(NOW(), INTERVAL 2 DAY)),

-- 3 days ago - Documents & Research
(8, @user_id, 'DOCUMENT_DOWNLOADED', 'document', 'Downloaded document "Prior Art Research.pdf"', '{"documentName": "Prior Art Research.pdf"}', DATE_SUB(NOW(), INTERVAL 3 DAY)),
(2, @user_id, 'DOCUMENT_VERSION_ADDED', 'document', 'Added version 3 of document "Merger Agreement"', '{"documentName": "Merger Agreement", "versionNumber": 3}', DATE_SUB(NOW(), INTERVAL 3 DAY)),
(9, @user_id, 'CLIENT_CONTACTED', 'communication', 'Contacted client via in-person meeting: Estate planning review', '{"contactMethod": "in-person meeting", "subject": "Estate planning review"}', DATE_SUB(NOW(), INTERVAL 3 DAY)),

-- 4 days ago - Task Completion
(6, @user_id, 'TASK_COMPLETED', 'case_reminders', 'Reminder "File motion response" completed', '{"reminderTitle": "File motion response"}', DATE_SUB(NOW(), INTERVAL 4 DAY)),
(10, @user_id, 'PAYMENT_RECEIVED', 'payment', 'Payment received: $25000.00', '{"amount": 25000.00}', DATE_SUB(NOW(), INTERVAL 4 DAY)),
(11, @user_id, 'ASSIGNMENT_ADDED', 'user', 'Michael Torres assigned as lead attorney', '{"assigneeName": "Michael Torres", "roleType": "LEAD_ATTORNEY"}', DATE_SUB(NOW(), INTERVAL 4 DAY)),

-- 5 days ago - Time & Billing
(3, @user_id, 'TIME_ENTRY_ADDED', 'time_entry', 'Logged 4.0 hours: Settlement negotiation preparation', '{"hours": 4.0, "description": "Settlement negotiation preparation"}', DATE_SUB(NOW(), INTERVAL 5 DAY)),
(5, @user_id, 'TIME_ENTRY_ADDED', 'time_entry', 'Logged 3.0 hours: Environmental impact research', '{"hours": 3.0, "description": "Environmental impact research"}', DATE_SUB(NOW(), INTERVAL 5 DAY)),
(7, @user_id, 'EMAIL_SENT', 'email', 'Email sent to uscis@gov.gov: "Application status inquiry"', '{"recipient": "uscis@gov.gov", "subject": "Application status inquiry"}', DATE_SUB(NOW(), INTERVAL 5 DAY)),

-- 6 days ago
(1, @user_id, 'HEARING_UPDATED', 'calendar_event', 'Updated hearing/event: "Pre-Trial Conference rescheduled"', '{"eventTitle": "Pre-Trial Conference"}', DATE_SUB(NOW(), INTERVAL 6 DAY)),
(4, @user_id, 'PAYMENT_RECEIVED', 'payment', 'Payment received: $7500.00', '{"amount": 7500.00}', DATE_SUB(NOW(), INTERVAL 6 DAY)),
(8, @user_id, 'INVOICE_CREATED', 'invoice', 'Invoice created for $18750.00', '{"amount": 18750.00}', DATE_SUB(NOW(), INTERVAL 6 DAY)),

-- 7 days ago - Week start activities
(2, @user_id, 'CASE_CREATED', 'case', 'Case "TechVision Merger" created for client TechVision Inc.', '{"caseTitle": "TechVision Merger", "clientName": "TechVision Inc."}', DATE_SUB(NOW(), INTERVAL 7 DAY)),
(9, @user_id, 'ASSIGNMENT_ADDED', 'user', 'Jennifer Walsh assigned as associate attorney', '{"assigneeName": "Jennifer Walsh", "roleType": "ASSOCIATE_ATTORNEY"}', DATE_SUB(NOW(), INTERVAL 7 DAY)),
(11, @user_id, 'TASK_CREATED', 'case_reminders', 'Reminder "Prepare class notification" created', '{"reminderTitle": "Prepare class notification"}', DATE_SUB(NOW(), INTERVAL 7 DAY));
