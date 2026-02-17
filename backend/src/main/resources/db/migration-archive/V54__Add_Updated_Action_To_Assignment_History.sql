-- Add UPDATED action to case_assignment_history action enum
ALTER TABLE case_assignment_history 
MODIFY COLUMN action ENUM('CREATED', 'UPDATED', 'TRANSFERRED', 'MODIFIED', 'DEACTIVATED') NOT NULL;