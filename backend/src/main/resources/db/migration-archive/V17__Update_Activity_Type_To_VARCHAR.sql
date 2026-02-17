-- Update activity_type column from CHAR(1) to VARCHAR(50)
-- First check if the table exists
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'case_activities');

-- Only proceed if the table exists
SET @sql = IF(@table_exists > 0, 
    'ALTER TABLE case_activities MODIFY COLUMN activity_type VARCHAR(50) NOT NULL',
    'SELECT "Table case_activities does not exist."');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update the existing single character codes to full string values
UPDATE case_activities SET activity_type = 'NOTE_ADDED' WHERE activity_type = 'N';
UPDATE case_activities SET activity_type = 'DOCUMENT_ADDED' WHERE activity_type = 'F';
UPDATE case_activities SET activity_type = 'STATUS_CHANGED' WHERE activity_type = 'S';
UPDATE case_activities SET activity_type = 'HEARING_SCHEDULED' WHERE activity_type = 'H';
UPDATE case_activities SET activity_type = 'DOCUMENT_UPLOADED' WHERE activity_type = 'D';
UPDATE case_activities SET activity_type = 'TASK_CREATED' WHERE activity_type = 'T';
UPDATE case_activities SET activity_type = 'TASK_COMPLETED' WHERE activity_type = 'C';
UPDATE case_activities SET activity_type = 'CUSTOM' WHERE activity_type NOT IN ('N', 'F', 'S', 'H', 'D', 'T', 'C'); 