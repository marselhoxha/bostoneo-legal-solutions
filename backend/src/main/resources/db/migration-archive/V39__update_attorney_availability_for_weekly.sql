-- Update attorney_availability table for weekly recurring availability
-- Add day_of_week column and rename columns to match new design

-- First, add the new column
ALTER TABLE attorney_availability
ADD COLUMN day_of_week TINYINT NULL COMMENT '0=Sunday, 1=Monday, ..., 6=Saturday' AFTER attorney_id;

-- Rename existing columns to match new entity structure
ALTER TABLE attorney_availability
CHANGE COLUMN working_hours_start start_time TIME NOT NULL DEFAULT '09:00:00',
CHANGE COLUMN working_hours_end end_time TIME NOT NULL DEFAULT '17:00:00',
CHANGE COLUMN consultation_duration_minutes slot_duration_minutes INT NOT NULL DEFAULT 30,
CHANGE COLUMN buffer_time_minutes buffer_minutes INT NOT NULL DEFAULT 15,
CHANGE COLUMN is_available is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Drop columns no longer needed
ALTER TABLE attorney_availability
DROP COLUMN next_available_date,
DROP COLUMN time_zone,
DROP COLUMN max_daily_consultations;

-- Drop unique constraint on attorney_id (since we now have multiple rows per attorney)
DROP INDEX attorney_id ON attorney_availability;

-- Add index for day of week
CREATE INDEX idx_attorney_availability_day ON attorney_availability(day_of_week);

-- Update existing records to have day_of_week = 1 (Monday) as default
UPDATE attorney_availability SET day_of_week = 1 WHERE day_of_week IS NULL;

-- Now make day_of_week NOT NULL
ALTER TABLE attorney_availability MODIFY day_of_week TINYINT NOT NULL;
