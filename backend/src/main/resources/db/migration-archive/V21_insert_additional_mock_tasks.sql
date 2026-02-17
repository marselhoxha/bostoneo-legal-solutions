-- V21_insert_additional_mock_tasks.sql
-- Additional mock tasks for better kanban board testing

-- Insert unassigned tasks (no assigned_to)
INSERT INTO case_tasks (case_id, title, description, task_type, priority, status, assigned_to, assigned_by, 
                       due_date, estimated_hours, created_at)
VALUES
-- Unassigned tasks for various cases
(1, 'Review Deposition Transcripts', 'Analyze deposition transcripts from opposing counsel', 
 'DOCUMENT_PREP', 'HIGH', 'TODO', NULL, 105, '2024-01-30 17:00:00', 6.0, '2024-01-19 09:00:00'),
 
(1, 'Prepare Motion to Compel', 'Draft motion to compel discovery responses', 
 'FILING', 'URGENT', 'TODO', NULL, 105, '2024-01-28 17:00:00', 8.0, '2024-01-19 10:00:00'),
 
(2, 'Accident Scene Investigation', 'Visit and document accident scene with photographer', 
 'OTHER', 'MEDIUM', 'TODO', NULL, 104, '2024-02-18 17:00:00', 4.0, '2024-02-04 11:00:00'),
 
(3, 'Environmental Assessment Review', 'Review environmental assessment report for property', 
 'RESEARCH', 'LOW', 'TODO', NULL, 102, '2024-02-22 17:00:00', 3.0, '2024-02-14 09:00:00'),
 
(4, 'Prior Art Research', 'Conduct comprehensive prior art search for patent validity', 
 'RESEARCH', 'HIGH', 'TODO', NULL, 101, '2024-03-08 17:00:00', 20.0, '2024-02-23 14:00:00'),

-- More tasks with various statuses
(1, 'Expert Witness Coordination', 'Coordinate with financial expert witness for testimony', 
 'OTHER', 'MEDIUM', 'BLOCKED', 102, 101, '2024-02-05 17:00:00', 4.0, '2024-01-20 10:00:00'),
 
(1, 'Settlement Conference Preparation', 'Prepare materials for settlement conference', 
 'DOCUMENT_PREP', 'HIGH', 'IN_PROGRESS', 101, 105, '2024-02-10 17:00:00', 10.0, '2024-01-22 11:00:00'),
 
(2, 'Insurance Policy Analysis', 'Review all applicable insurance policies for coverage', 
 'REVIEW', 'HIGH', 'COMPLETED', 104, 105, '2024-02-08 17:00:00', 5.0, '2024-02-03 09:00:00'),
 
(2, 'Medical Expert Consultation', 'Consult with medical expert on injury assessment', 
 'OTHER', 'MEDIUM', 'IN_PROGRESS', 104, 105, '2024-02-25 17:00:00', 3.0, '2024-02-06 14:00:00'),
 
(3, 'Mortgage Documentation', 'Prepare and review mortgage documents', 
 'DOCUMENT_PREP', 'HIGH', 'IN_PROGRESS', 103, 102, '2024-02-20 17:00:00', 4.0, '2024-02-15 10:00:00'),
 
(4, 'Trademark Conflict Check', 'Check for potential trademark conflicts', 
 'RESEARCH', 'MEDIUM', 'COMPLETED', 103, 101, '2024-02-26 17:00:00', 6.0, '2024-02-21 09:00:00'),
 
(4, 'IP Portfolio Review', 'Comprehensive review of client IP portfolio', 
 'REVIEW', 'LOW', 'BLOCKED', 104, 101, '2024-03-15 17:00:00', 12.0, '2024-02-24 11:00:00'),
 
(5, 'Witness List Preparation', 'Compile and vet potential witness list', 
 'DOCUMENT_PREP', 'MEDIUM', 'TODO', NULL, 102, '2024-03-20 17:00:00', 5.0, '2024-03-03 10:00:00'),
 
(5, 'Company Policy Analysis', 'Analyze company HR policies for violations', 
 'RESEARCH', 'HIGH', 'IN_PROGRESS', 102, 105, '2024-03-12 17:00:00', 8.0, '2024-03-04 09:00:00'),

-- Cancelled tasks for testing
(1, 'Jury Consultant Meeting', 'Meet with jury consultant for case strategy', 
 'CLIENT_MEETING', 'LOW', 'CANCELLED', 101, 105, '2024-01-25 14:00:00', 2.0, '2024-01-18 11:00:00'),
 
(2, 'Second Medical Opinion', 'Obtain second medical opinion on injuries', 
 'OTHER', 'LOW', 'CANCELLED', NULL, 104, '2024-02-12 17:00:00', 3.0, '2024-02-05 10:00:00');

-- Update with more realistic tags (JSON format)
UPDATE case_tasks SET tags = '["deposition", "discovery", "urgent"]' WHERE title LIKE '%Deposition%';
UPDATE case_tasks SET tags = '["motion", "court", "filing"]' WHERE title LIKE '%Motion%';
UPDATE case_tasks SET tags = '["investigation", "evidence"]' WHERE title LIKE '%Investigation%';
UPDATE case_tasks SET tags = '["expert", "witness", "testimony"]' WHERE title LIKE '%Expert%';
UPDATE case_tasks SET tags = '["settlement", "negotiation"]' WHERE title LIKE '%Settlement%';
UPDATE case_tasks SET tags = '["insurance", "coverage", "policy"]' WHERE title LIKE '%Insurance%';
UPDATE case_tasks SET tags = '["research", "analysis"]' WHERE task_type = 'RESEARCH' AND tags IS NULL;
UPDATE case_tasks SET tags = '["meeting", "client"]' WHERE task_type = 'CLIENT_MEETING' AND tags IS NULL;
UPDATE case_tasks SET tags = '["filing", "court"]' WHERE task_type = 'FILING' AND tags IS NULL;

-- Add more task comments for recently added tasks
INSERT INTO task_comments (task_id, user_id, comment, created_at)
SELECT 
    t.id,
    CASE WHEN MOD(t.id, 3) = 0 THEN 101 WHEN MOD(t.id, 3) = 1 THEN 102 ELSE 103 END as user_id,
    CASE 
        WHEN t.status = 'IN_PROGRESS' THEN 'Working on this task. Making good progress.'
        WHEN t.status = 'ON_HOLD' THEN 'Waiting for additional information before proceeding.'
        WHEN t.status = 'COMPLETED' THEN 'Task completed successfully. All requirements met.'
        ELSE 'Initial review completed. Ready to begin work.'
    END as comment,
    DATE_ADD(t.created_at, INTERVAL 1 DAY) as created_at
FROM case_tasks t
WHERE t.id > 15 AND t.status != 'PENDING'
LIMIT 10;

-- Add some subtasks
INSERT INTO case_tasks (case_id, title, description, task_type, priority, status, assigned_to, assigned_by, 
                       due_date, estimated_hours, parent_task_id, created_at)
VALUES
(1, 'Review Section 4.2 of Contract', 'Detailed analysis of section 4.2 breach implications', 
 'DOCUMENT_PREP', 'HIGH', 'IN_PROGRESS', 101, 101, '2024-01-19 17:00:00', 2.0, 1, '2024-01-16 15:30:00'),
 
(1, 'Review Section 7.1 of Contract', 'Detailed analysis of section 7.1 termination clauses', 
 'DOCUMENT_PREP', 'HIGH', 'TODO', 101, 101, '2024-01-19 17:00:00', 2.0, 1, '2024-01-16 15:30:00'),
 
(2, 'Contact St. Mary Hospital', 'Follow up on medical records request', 
 'OTHER', 'HIGH', 'COMPLETED', 103, 104, '2024-02-08 17:00:00', 1.0, 5, '2024-02-05 15:00:00');

-- Update some tasks with actual hours for completed and in-progress tasks
UPDATE case_tasks 
SET actual_hours = 
    CASE 
        WHEN status = 'COMPLETED' THEN estimated_hours * (0.8 + RAND() * 0.4)
        WHEN status = 'IN_PROGRESS' THEN estimated_hours * (0.3 + RAND() * 0.4)
        ELSE 0
    END,
    completed_at = 
    CASE 
        WHEN status = 'COMPLETED' THEN DATE_SUB(due_date, INTERVAL 1 + FLOOR(RAND() * 3) DAY)
        ELSE NULL
    END
WHERE id > 15;

-- Create some transfer requests for testing
INSERT INTO case_transfer_requests (case_id, from_user_id, to_user_id, reason, urgency, status, requested_by, requested_at)
VALUES
(1, 102, 104, 'Scheduling conflict with another high-priority case', 'MEDIUM', 'PENDING', 102, DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 2 DAY)),
(2, 103, 101, 'Need a paralegal with medical records experience', 'HIGH', 'PENDING', 104, DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 DAY));

-- Add user workload entries for dashboard analytics
INSERT INTO user_workload (user_id, calculation_date, active_cases_count, total_workload_points, capacity_percentage, 
                          billable_hours_week, non_billable_hours_week, overdue_tasks_count, upcoming_deadlines_count)
VALUES
(101, CURDATE(), 2, 28.5, 71.25, 32.5, 3.0, 0, 2),
(102, CURDATE(), 3, 24.0, 60.00, 25.0, 3.0, 1, 3),
(103, CURDATE(), 4, 20.0, 50.00, 28.0, 4.0, 0, 4),
(104, CURDATE(), 2, 22.5, 56.25, 22.0, 2.5, 0, 2),
(105, CURDATE(), 0, 0.0, 0.00, 0.0, 0.0, 0, 0);