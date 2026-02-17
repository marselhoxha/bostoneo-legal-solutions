-- Add calendar_event_id column to timeline_events table
-- This links timeline events to calendar events for persistence

-- MySQL compatible syntax (no IF NOT EXISTS for ADD COLUMN)
SET @exist := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'timeline_events' AND column_name = 'calendar_event_id');
SET @sqlstmt := IF(@exist = 0, 'ALTER TABLE timeline_events ADD COLUMN calendar_event_id BIGINT NULL', 'SELECT 1');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
