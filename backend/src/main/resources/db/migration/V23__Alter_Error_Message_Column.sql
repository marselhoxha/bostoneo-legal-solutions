-- Change error_message column in reminder_queue from VARCHAR(255) to TEXT
ALTER TABLE reminder_queue MODIFY COLUMN error_message TEXT;

-- Add a comment explaining the change
-- This change allows storing full error stacktraces, which can be longer than 255 characters 