-- Fix the activity_type column in case_activities table
-- First check if the table exists
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'case_activities');

-- Only proceed if the table exists
SET @sql = IF(@table_exists > 0, 
    'ALTER TABLE case_activities MODIFY COLUMN activity_type VARCHAR(50) NOT NULL',
    'SELECT "Table case_activities does not exist."');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing activity types to single character codes
UPDATE case_activities SET activity_type = 'N' WHERE activity_type = 'NOTE_ADDED';
UPDATE case_activities SET activity_type = 'F' WHERE activity_type = 'DOCUMENT_ADDED';
UPDATE case_activities SET activity_type = 'S' WHERE activity_type = 'STATUS_CHANGED';
UPDATE case_activities SET activity_type = 'H' WHERE activity_type = 'HEARING_SCHEDULED';

-- Finally, shrink the column to CHAR(1)
ALTER TABLE case_activities MODIFY COLUMN activity_type CHAR(1) NOT NULL COMMENT "Type of activity (single character code)"; 