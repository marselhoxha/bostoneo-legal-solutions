-- Add columns for client-initiated reschedule requests
-- These columns track the reschedule request until attorney approves/declines

ALTER TABLE appointment_requests
ADD COLUMN requested_reschedule_time DATETIME NULL COMMENT 'The new datetime client is requesting',
ADD COLUMN reschedule_reason TEXT NULL COMMENT 'Reason client wants to reschedule',
ADD COLUMN original_confirmed_time DATETIME NULL COMMENT 'Backup of original confirmed time in case of decline';
