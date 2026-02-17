-- Alter case_activities table to fix the activity_type column
ALTER TABLE case_activities MODIFY COLUMN activity_type VARCHAR(20) NOT NULL; 