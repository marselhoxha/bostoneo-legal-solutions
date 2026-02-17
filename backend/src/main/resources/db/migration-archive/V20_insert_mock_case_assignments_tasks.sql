-- V20_insert_mock_case_assignments_tasks.sql
-- Mock data for case assignments and tasks

-- First ensure we have some test users if they don't exist
INSERT INTO users (id, first_name, last_name, email, phone, enabled, non_locked, using_mfa, created_at, image_url)
SELECT * FROM (
    SELECT 101 as id, 'Sarah' as first_name, 'Johnson' as last_name, 'sarah.johnson@bostoneo.com' as email, '617-555-0101' as phone, 
           true as enabled, true as non_locked, false as using_mfa, CURRENT_TIMESTAMP as created_at, 
           'https://randomuser.me/api/portraits/women/1.jpg' as image_url
    UNION ALL
    SELECT 102, 'Michael', 'Chen', 'michael.chen@bostoneo.com', '617-555-0102', true, true, false, CURRENT_TIMESTAMP, 'https://randomuser.me/api/portraits/men/1.jpg'
    UNION ALL
    SELECT 103, 'Emily', 'Rodriguez', 'emily.rodriguez@bostoneo.com', '617-555-0103', true, true, false, CURRENT_TIMESTAMP, 'https://randomuser.me/api/portraits/women/2.jpg'
    UNION ALL
    SELECT 104, 'James', 'Wilson', 'james.wilson@bostoneo.com', '617-555-0104', true, true, false, CURRENT_TIMESTAMP, 'https://randomuser.me/api/portraits/men/2.jpg'
    UNION ALL
    SELECT 105, 'Lisa', 'Anderson', 'lisa.anderson@bostoneo.com', '617-555-0105', true, true, false, CURRENT_TIMESTAMP, 'https://randomuser.me/api/portraits/women/3.jpg'
) AS new_users
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = new_users.id);

-- Assign roles to users if not already assigned
INSERT INTO user_roles (user_id, role_id)
SELECT * FROM (
    SELECT 101 as user_id, (SELECT id FROM roles WHERE name = 'ROLE_SENIOR_ATTORNEY') as role_id
    UNION ALL
    SELECT 102, (SELECT id FROM roles WHERE name = 'ROLE_ATTORNEY')
    UNION ALL
    SELECT 103, (SELECT id FROM roles WHERE name = 'ROLE_PARALEGAL')
    UNION ALL
    SELECT 104, (SELECT id FROM roles WHERE name = 'ROLE_ATTORNEY')
    UNION ALL
    SELECT 105, (SELECT id FROM roles WHERE name = 'ROLE_MANAGER')
) AS new_roles
WHERE role_id IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = new_roles.user_id AND role_id = new_roles.role_id);

-- Insert Case Assignments
INSERT INTO case_assignments (case_id, user_id, role_type, assignment_type, assigned_by, assigned_at, effective_from, is_active, workload_weight, expertise_match_score, notes)
VALUES
-- Corporate Litigation Case (ID: 1)
(1, 101, 'LEAD_ATTORNEY', 'MANUAL', 105, '2024-01-15 09:00:00', '2024-01-15', 1, 1.5, 0.95, 'Senior attorney with extensive corporate litigation experience'),
(1, 102, 'SUPPORTING_ATTORNEY', 'MANUAL', 101, '2024-01-16 10:30:00', '2024-01-16', 1, 1.0, 0.85, 'Supporting attorney for discovery phase'),
(1, 103, 'PARALEGAL', 'MANUAL', 101, '2024-01-16 14:00:00', '2024-01-16', 1, 0.5, 0.90, 'Document preparation and research support'),

-- Personal Injury Case (ID: 2)
(2, 104, 'LEAD_ATTORNEY', 'MANUAL', 105, '2024-02-01 08:30:00', '2024-02-01', 1, 1.5, 0.92, 'Personal injury specialist'),
(2, 103, 'PARALEGAL', 'AUTO_ASSIGNED', 104, '2024-02-02 09:00:00', '2024-02-02', 1, 0.5, 0.88, 'Medical records management'),

-- Real Estate Transaction (ID: 3)
(3, 102, 'LEAD_ATTORNEY', 'MANUAL', 105, '2024-02-10 11:00:00', '2024-02-10', 1, 1.0, 0.87, 'Real estate transaction expertise'),
(3, 103, 'PARALEGAL', 'MANUAL', 102, '2024-02-11 09:30:00', '2024-02-11', 1, 0.3, 0.85, 'Title search and closing support'),

-- Intellectual Property Case (ID: 4)
(4, 101, 'LEAD_ATTORNEY', 'MANUAL', 105, '2024-02-20 13:00:00', '2024-02-20', 1, 2.0, 0.98, 'IP law specialist with patent experience'),
(4, 104, 'SUPPORTING_ATTORNEY', 'MANUAL', 101, '2024-02-21 10:00:00', '2024-02-21', 1, 1.0, 0.82, 'Patent research support'),

-- Employment Law Case (ID: 5)
(5, 102, 'LEAD_ATTORNEY', 'MANUAL', 105, '2024-03-01 09:00:00', '2024-03-01', 1, 1.2, 0.89, 'Employment law and EEOC experience');

-- Insert Case Tasks
INSERT INTO case_tasks (case_id, title, description, task_type, priority, status, assigned_to, assigned_by, 
                       due_date, estimated_hours, actual_hours, created_at)
VALUES
-- Tasks for Corporate Litigation Case (ID: 1)
(1, 'Review Contract Documentation', 'Analyze all contract documents related to the breach of contract claim', 
 'DOCUMENT_PREP', 'HIGH', 'IN_PROGRESS', 101, 105, '2024-01-20 17:00:00', 8.0, 3.5, '2024-01-15 10:00:00'),
 
(1, 'Prepare Discovery Requests', 'Draft interrogatories and document production requests', 
 'DOCUMENT_PREP', 'HIGH', 'TODO', 102, 101, '2024-01-25 17:00:00', 12.0, 0.0, '2024-01-16 11:00:00'),
 
(1, 'Client Meeting - Case Strategy', 'Meet with client to discuss litigation strategy and timeline', 
 'CLIENT_MEETING', 'MEDIUM', 'COMPLETED', 101, 105, '2024-01-18 14:00:00', 2.0, 2.5, '2024-01-15 15:00:00'),
 
(1, 'Research Case Precedents', 'Research similar breach of contract cases in Massachusetts', 
 'RESEARCH', 'MEDIUM', 'IN_PROGRESS', 103, 101, '2024-01-22 17:00:00', 10.0, 4.0, '2024-01-17 09:00:00'),

-- Tasks for Personal Injury Case (ID: 2)
(2, 'Medical Records Collection', 'Obtain all medical records from treating physicians', 
 'DOCUMENT_PREP', 'HIGH', 'IN_PROGRESS', 103, 104, '2024-02-10 17:00:00', 6.0, 2.0, '2024-02-02 10:00:00'),
 
(2, 'Witness Interviews', 'Interview witnesses to the accident', 
 'OTHER', 'HIGH', 'TODO', 104, 105, '2024-02-15 17:00:00', 8.0, 0.0, '2024-02-01 14:00:00'),
 
(2, 'Prepare Demand Letter', 'Draft comprehensive demand letter to insurance company', 
 'CORRESPONDENCE', 'MEDIUM', 'TODO', 104, 105, '2024-02-20 17:00:00', 5.0, 0.0, '2024-02-03 11:00:00'),

-- Tasks for Real Estate Transaction (ID: 3)
(3, 'Title Search Review', 'Review title search results and identify any issues', 
 'REVIEW', 'HIGH', 'COMPLETED', 102, 105, '2024-02-15 17:00:00', 4.0, 3.5, '2024-02-11 08:00:00'),
 
(3, 'Draft Purchase Agreement', 'Prepare purchase and sale agreement with client specifications', 
 'DOCUMENT_PREP', 'HIGH', 'IN_PROGRESS', 102, 105, '2024-02-18 17:00:00', 6.0, 4.0, '2024-02-12 10:00:00'),
 
(3, 'Coordinate Closing', 'Schedule and coordinate closing with all parties', 
 'OTHER', 'MEDIUM', 'TODO', 103, 102, '2024-02-25 17:00:00', 3.0, 0.0, '2024-02-13 14:00:00'),

-- Tasks for Intellectual Property Case (ID: 4)
(4, 'Patent Analysis', 'Analyze patent claims and potential infringement', 
 'RESEARCH', 'HIGH', 'IN_PROGRESS', 101, 105, '2024-02-28 17:00:00', 16.0, 8.0, '2024-02-20 15:00:00'),
 
(4, 'Prepare Cease and Desist', 'Draft cease and desist letter for patent infringement', 
 'CORRESPONDENCE', 'HIGH', 'TODO', 104, 101, '2024-03-05 17:00:00', 4.0, 0.0, '2024-02-22 09:00:00'),
 
(4, 'Client Consultation', 'Discuss IP strategy and protection options with client', 
 'CLIENT_MEETING', 'MEDIUM', 'COMPLETED', 101, 105, '2024-02-22 15:00:00', 2.0, 2.0, '2024-02-20 16:00:00'),

-- Tasks for Employment Law Case (ID: 5)
(5, 'Review Employment Contracts', 'Analyze employment agreements and company policies', 
 'REVIEW', 'HIGH', 'TODO', 102, 105, '2024-03-10 17:00:00', 6.0, 0.0, '2024-03-01 10:00:00'),
 
(5, 'Interview Terminated Employee', 'Conduct detailed interview with client regarding termination', 
 'CLIENT_MEETING', 'HIGH', 'COMPLETED', 102, 105, '2024-03-03 14:00:00', 3.0, 3.5, '2024-03-01 11:00:00'),
 
(5, 'EEOC Filing Preparation', 'Prepare documentation for EEOC complaint', 
 'FILING', 'MEDIUM', 'TODO', 102, 105, '2024-03-15 17:00:00', 8.0, 0.0, '2024-03-02 09:00:00');

-- Add some task tags (JSON format)
UPDATE case_tasks SET tags = '["contract", "review", "urgent"]' WHERE id IN (1, 2);
UPDATE case_tasks SET tags = '["medical", "records", "injury"]' WHERE id IN (5, 6);
UPDATE case_tasks SET tags = '["real-estate", "closing"]' WHERE id IN (8, 9, 10);
UPDATE case_tasks SET tags = '["patent", "IP", "infringement"]' WHERE id IN (11, 12);
UPDATE case_tasks SET tags = '["employment", "discrimination"]' WHERE id IN (14, 15);

-- Insert Assignment History
-- Note: case_assignment_history has different structure, commenting out for now
-- We would need case_assignment_id which is generated after inserting case_assignments

-- Insert Task Comments
INSERT INTO task_comments (task_id, user_id, comment, created_at)
VALUES
(1, 101, 'Started reviewing the contracts. Found several potential breach points that need further analysis.', '2024-01-16 14:30:00'),
(1, 105, 'Please prioritize sections 4.2 and 7.1 of the main agreement.', '2024-01-16 15:00:00'),
(3, 101, 'Client meeting went well. They are prepared for a lengthy litigation if necessary.', '2024-01-18 16:00:00'),
(5, 103, 'Having difficulty obtaining records from St. Mary Hospital. May need a subpoena.', '2024-02-05 11:00:00'),
(5, 104, 'I will prepare the subpoena request. Please compile a list of all providers.', '2024-02-05 14:00:00'),
(8, 102, 'Title search revealed a minor lien that needs to be cleared before closing.', '2024-02-15 16:00:00');

-- Insert some Task Dependencies
-- Note: task_dependencies table doesn't exist, commenting out
-- INSERT INTO task_dependencies (task_id, depends_on_task_id, created_at)
-- VALUES
-- (2, 1, '2024-01-16 11:00:00'), -- Discovery requests depend on contract review
-- (7, 5, '2024-02-03 11:00:00'), -- Demand letter depends on medical records
-- (10, 9, '2024-02-13 14:00:00'), -- Closing coordination depends on purchase agreement
-- (12, 11, '2024-02-22 09:00:00'); -- Cease and desist depends on patent analysis

-- Insert Assignment Rules
INSERT INTO assignment_rules (rule_name, rule_type, case_type, priority_order, is_active, max_workload_percentage, min_expertise_score, prefer_previous_attorney, rule_conditions, rule_actions)
VALUES
('Corporate Litigation Auto-Assignment', 'EXPERTISE_BASED', 'CORPORATE', 1, true, 85.00, 80.00, true,
 '{"minExperience": 5, "requiredSkills": ["corporate", "litigation"], "maxActiveCase": 10}',
 '{"assignToHighestScore": true, "notifyManager": true}'),
 
('Personal Injury Distribution', 'ROUND_ROBIN', 'PERSONAL_INJURY', 2, true, 90.00, 70.00, false,
 '{"requiredLicense": "MA Bar", "maxActiveCase": 15}',
 '{"distributeEvenly": true, "skipIfOverloaded": true}'),
 
('Real Estate Load Balance', 'WORKLOAD_BASED', 'REAL_ESTATE', 3, true, 95.00, 60.00, true,
 '{"preferredExperience": 3, "maxActiveCase": 20}',
 '{"assignToLowestWorkload": true, "considerTimeZone": false}');

-- Note: hours_worked column doesn't exist in case_assignments table
-- Workload is tracked through workload_weight and other mechanisms

-- Add some completed tasks with actual hours
UPDATE case_tasks SET actual_hours = estimated_hours * 1.1 WHERE status = 'COMPLETED';
UPDATE case_tasks SET completed_at = DATE_SUB(due_date, INTERVAL 1 DAY) WHERE status = 'COMPLETED';