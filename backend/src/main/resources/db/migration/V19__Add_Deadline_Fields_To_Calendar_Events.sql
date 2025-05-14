-- Add new columns for enhanced deadline features
ALTER TABLE calendar_events 
    ADD COLUMN high_priority BOOLEAN DEFAULT FALSE,
    ADD COLUMN additional_reminders VARCHAR(255),
    ADD COLUMN reminders_sent VARCHAR(255); 
 