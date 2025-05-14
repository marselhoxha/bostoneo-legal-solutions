-- Mock Calendar Events SQL Script
-- Run this to populate your database with sample calendar events linked to existing cases

-- Clear existing calendar events (optional, uncomment if needed)
-- DELETE FROM calendar_events;

-- Insert calendar events for various cases
INSERT INTO calendar_events (
    title, 
    description, 
    start_time, 
    end_time, 
    location, 
    event_type, 
    status, 
    all_day, 
    color, 
    case_id, 
    user_id, 
    reminder_minutes, 
    reminder_sent,
    created_at
)
VALUES
-- Court Dates
(
    'Initial Hearing - Johnson v. MegaCorp', 
    'Initial hearing for case BEO-2025-001', 
    DATE_ADD(CURRENT_DATE(), INTERVAL 5 DAY) + INTERVAL '10:00:00' HOUR_SECOND, 
    DATE_ADD(CURRENT_DATE(), INTERVAL 5 DAY) + INTERVAL '11:30:00' HOUR_SECOND, 
    'Suffolk County Courthouse, Room 303', 
    'COURT_DATE', 
    'SCHEDULED', 
    false, 
    '#f06548', 
    1, 
    1, 
    60, 
    false,
    NOW()
),
(
    'Summary Judgment Hearing - Thompson Estate', 
    'Summary judgment motion hearing', 
    DATE_ADD(CURRENT_DATE(), INTERVAL 12 DAY) + INTERVAL '09:30:00' HOUR_SECOND, 
    DATE_ADD(CURRENT_DATE(), INTERVAL 12 DAY) + INTERVAL '11:00:00' HOUR_SECOND, 
    'Norfolk Probate Court, Room 2B', 
    'COURT_DATE', 
    'SCHEDULED', 
    false, 
    '#f06548', 
    9, 
    1, 
    120, 
    false,
    NOW()
),
(
    'Bankruptcy Hearing - Coastal Restaurants', 
    'Chapter 11 status hearing', 
    DATE_ADD(CURRENT_DATE(), INTERVAL 8 DAY) + INTERVAL '14:00:00' HOUR_SECOND, 
    DATE_ADD(CURRENT_DATE(), INTERVAL 8 DAY) + INTERVAL '15:30:00' HOUR_SECOND, 
    'US Bankruptcy Court, Courtroom 2', 
    'COURT_DATE', 
    'SCHEDULED', 
    false, 
    '#f06548', 
    10, 
    1, 
    90, 
    false,
    NOW()
),

-- Deadlines
(
    'Filing Deadline - Motion to Dismiss', 
    'Deadline to file motion to dismiss in Johnson case', 
    DATE_ADD(CURRENT_DATE(), INTERVAL 10 DAY), 
    DATE_ADD(CURRENT_DATE(), INTERVAL 10 DAY), 
    NULL, 
    'DEADLINE', 
    'SCHEDULED', 
    true, 
    '#ffbc2b', 
    1, 
    1, 
    1440, 
    false,
    NOW()
),
(
    'Discovery Response Due - Chen Class Action', 
    'Deadline for discovery responses', 
    DATE_ADD(CURRENT_DATE(), INTERVAL 15 DAY), 
    DATE_ADD(CURRENT_DATE(), INTERVAL 15 DAY), 
    NULL, 
    'DEADLINE', 
    'SCHEDULED', 
    true, 
    '#ffbc2b', 
    11, 
    1, 
    1440, 
    false,
    NOW()
),
(
    'Brief Filing Deadline - Coastal Reorganization', 
    'Deadline to file reorganization plan brief', 
    DATE_ADD(CURRENT_DATE(), INTERVAL 20 DAY), 
    DATE_ADD(CURRENT_DATE(), INTERVAL 20 DAY), 
    NULL, 
    'DEADLINE', 
    'SCHEDULED', 
    true, 
    '#ffbc2b', 
    10, 
    1, 
    2880, 
    false,
    NOW()
),

-- Client Meetings
(
    'Client Meeting - Sarah Chen', 
    'Discuss class action status and next steps', 
    DATE_ADD(CURRENT_DATE(), INTERVAL 3 DAY) + INTERVAL '13:30:00' HOUR_SECOND, 
    DATE_ADD(CURRENT_DATE(), INTERVAL 3 DAY) + INTERVAL '14:30:00' HOUR_SECOND, 
    'Conference Room A', 
    'CLIENT_MEETING', 
    'SCHEDULED', 
    false, 
    '#50a5f1', 
    11, 
    1, 
    30, 
    false,
    NOW()
),
(
    'Client Meeting - Johnson Family', 
    'Review case progress and settlement options', 
    DATE_ADD(CURRENT_DATE(), INTERVAL 6 DAY) + INTERVAL '10:00:00' HOUR_SECOND, 
    DATE_ADD(CURRENT_DATE(), INTERVAL 6 DAY) + INTERVAL '11:00:00' HOUR_SECOND, 
    'Conference Room B', 
    'CLIENT_MEETING', 
    'SCHEDULED', 
    false, 
    '#50a5f1', 
    1, 
    1, 
    30, 
    false,
    NOW()
),
(
    'Client Meeting - Coastal Restaurants CFO', 
    'Bankruptcy planning session', 
    DATE_ADD(CURRENT_DATE(), INTERVAL 4 DAY) + INTERVAL '15:00:00' HOUR_SECOND, 
    DATE_ADD(CURRENT_DATE(), INTERVAL 4 DAY) + INTERVAL '16:30:00' HOUR_SECOND, 
    'Conference Room C', 
    'CLIENT_MEETING', 
    'SCHEDULED', 
    false, 
    '#50a5f1', 
    10, 
    1, 
    60, 
    false,
    NOW()
),

-- Team Meetings
(
    'Case Strategy Meeting - Class Action Team', 
    'Strategic planning for Chen class action', 
    DATE_ADD(CURRENT_DATE(), INTERVAL 2 DAY) + INTERVAL '09:00:00' HOUR_SECOND, 
    DATE_ADD(CURRENT_DATE(), INTERVAL 2 DAY) + INTERVAL '10:30:00' HOUR_SECOND, 
    'Conference Room D', 
    'TEAM_MEETING', 
    'SCHEDULED', 
    false, 
    '#39c0ed', 
    11, 
    1, 
    15, 
    false,
    NOW()
),
(
    'Litigation Team Weekly Meeting', 
    'Weekly progress update on all active litigation cases', 
    DATE_ADD(CURRENT_DATE(), INTERVAL 1 DAY) + INTERVAL '14:00:00' HOUR_SECOND, 
    DATE_ADD(CURRENT_DATE(), INTERVAL 1 DAY) + INTERVAL '15:00:00' HOUR_SECOND, 
    'Main Conference Room', 
    'TEAM_MEETING', 
    'SCHEDULED', 
    false, 
    '#39c0ed', 
    NULL, 
    1, 
    15, 
    false,
    NOW()
),

-- Depositions
(
    'Deposition - MegaCorp CEO', 
    'Deposition of defendant CEO in Johnson case', 
    DATE_ADD(CURRENT_DATE(), INTERVAL 14 DAY) + INTERVAL '09:30:00' HOUR_SECOND, 
    DATE_ADD(CURRENT_DATE(), INTERVAL 14 DAY) + INTERVAL '16:30:00' HOUR_SECOND, 
    'Conference Center, Room 412', 
    'DEPOSITION', 
    'SCHEDULED', 
    false, 
    '#74788d', 
    1, 
    1, 
    120, 
    false,
    NOW()
),
(
    'Deposition - Data Security Expert', 
    'Expert witness deposition for Chen class action', 
    DATE_ADD(CURRENT_DATE(), INTERVAL 18 DAY) + INTERVAL '10:00:00' HOUR_SECOND, 
    DATE_ADD(CURRENT_DATE(), INTERVAL 18 DAY) + INTERVAL '15:00:00' HOUR_SECOND, 
    'Court Reporting Services', 
    'DEPOSITION', 
    'SCHEDULED', 
    false, 
    '#74788d', 
    11, 
    1, 
    120, 
    false,
    NOW()
),

-- Mediations
(
    'Mediation - Thompson Estate Dispute', 
    'Mediation session with all beneficiaries', 
    DATE_ADD(CURRENT_DATE(), INTERVAL 16 DAY) + INTERVAL '09:00:00' HOUR_SECOND, 
    DATE_ADD(CURRENT_DATE(), INTERVAL 16 DAY) + INTERVAL '17:00:00' HOUR_SECOND, 
    'Mediation Center, Suite 300', 
    'MEDIATION', 
    'SCHEDULED', 
    false, 
    '#0ab39c', 
    9, 
    1, 
    60, 
    false,
    NOW()
),

-- Consultations
(
    'Initial Consultation - New Corporate Client', 
    'First meeting with potential business client', 
    DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY) + INTERVAL '11:00:00' HOUR_SECOND, 
    DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY) + INTERVAL '12:00:00' HOUR_SECOND, 
    'Conference Room A', 
    'CONSULTATION', 
    'SCHEDULED', 
    false, 
    '#50a5f1', 
    NULL, 
    1, 
    30, 
    false,
    NOW()
),

-- Reminders
(
    'Case Review - Johnson', 
    'Review case file before client meeting', 
    DATE_ADD(CURRENT_DATE(), INTERVAL 5 DAY) + INTERVAL '08:30:00' HOUR_SECOND, 
    DATE_ADD(CURRENT_DATE(), INTERVAL 5 DAY) + INTERVAL '09:30:00' HOUR_SECOND, 
    NULL, 
    'REMINDER', 
    'SCHEDULED', 
    false, 
    '#39c0ed', 
    1, 
    1, 
    30, 
    false,
    NOW()
),
(
    'Prepare Court Documents', 
    'Finalize all documents for Coastal Restaurants hearing', 
    DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY) + INTERVAL '09:00:00' HOUR_SECOND, 
    DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY) + INTERVAL '12:00:00' HOUR_SECOND, 
    NULL, 
    'REMINDER', 
    'SCHEDULED', 
    false, 
    '#39c0ed', 
    10, 
    1, 
    60, 
    false,
    NOW()
);

-- Add some events in the past (completed)
INSERT INTO calendar_events (
    title, 
    description, 
    start_time, 
    end_time, 
    location, 
    event_type, 
    status, 
    all_day, 
    color, 
    case_id, 
    user_id, 
    reminder_minutes, 
    reminder_sent,
    created_at
)
VALUES
(
    'Initial Client Interview - Johnson', 
    'First meeting with client to discuss case details', 
    DATE_SUB(CURRENT_DATE(), INTERVAL 15 DAY) + INTERVAL '10:00:00' HOUR_SECOND, 
    DATE_SUB(CURRENT_DATE(), INTERVAL 15 DAY) + INTERVAL '11:30:00' HOUR_SECOND, 
    'Conference Room A', 
    'CLIENT_MEETING', 
    'COMPLETED', 
    false, 
    '#50a5f1', 
    1, 
    1, 
    30, 
    true,
    DATE_SUB(NOW(), INTERVAL 20 DAY)
),
(
    'File Review - Thompson Estate', 
    'Document review and case planning', 
    DATE_SUB(CURRENT_DATE(), INTERVAL 10 DAY) + INTERVAL '13:00:00' HOUR_SECOND, 
    DATE_SUB(CURRENT_DATE(), INTERVAL 10 DAY) + INTERVAL '16:00:00' HOUR_SECOND, 
    'Office', 
    'TEAM_MEETING', 
    'COMPLETED', 
    false, 
    '#39c0ed', 
    9, 
    1, 
    15, 
    true,
    DATE_SUB(NOW(), INTERVAL 15 DAY)
),
(
    'Preliminary Hearing - Chen Class Action', 
    'Initial hearing to establish class certification schedule', 
    DATE_SUB(CURRENT_DATE(), INTERVAL 5 DAY) + INTERVAL '09:30:00' HOUR_SECOND, 
    DATE_SUB(CURRENT_DATE(), INTERVAL 5 DAY) + INTERVAL '11:00:00' HOUR_SECOND, 
    'US District Court, Courtroom 9B', 
    'COURT_DATE', 
    'COMPLETED', 
    false, 
    '#f06548', 
    11, 
    1, 
    60, 
    true,
    DATE_SUB(NOW(), INTERVAL 10 DAY)
);

-- Add some canceled events
INSERT INTO calendar_events (
    title, 
    description, 
    start_time, 
    end_time, 
    location, 
    event_type, 
    status, 
    all_day, 
    color, 
    case_id, 
    user_id, 
    reminder_minutes, 
    reminder_sent,
    created_at
)
VALUES
(
    'Expert Witness Meeting - Cancelled', 
    'Meeting canceled due to scheduling conflict', 
    DATE_ADD(CURRENT_DATE(), INTERVAL 9 DAY) + INTERVAL '14:00:00' HOUR_SECOND, 
    DATE_ADD(CURRENT_DATE(), INTERVAL 9 DAY) + INTERVAL '15:30:00' HOUR_SECOND, 
    'Office', 
    'TEAM_MEETING', 
    'CANCELLED', 
    false, 
    '#39c0ed', 
    1, 
    1, 
    30, 
    false,
    DATE_SUB(NOW(), INTERVAL 2 DAY)
); 