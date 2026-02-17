-- Add notification preference columns to calendar_events table
ALTER TABLE calendar_events 
ADD COLUMN email_notification BOOLEAN DEFAULT TRUE,
ADD COLUMN push_notification BOOLEAN DEFAULT FALSE;

-- Update existing events to have email notifications enabled by default when reminder is set
UPDATE calendar_events SET email_notification = TRUE WHERE reminder_minutes > 0; 
 