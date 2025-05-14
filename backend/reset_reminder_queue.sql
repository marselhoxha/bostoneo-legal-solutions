-- Drop existing table and indexes
DROP TABLE IF EXISTS reminder_queue;

-- Create the reminder_queue table from scratch
CREATE TABLE reminder_queue (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    scheduled_time TIMESTAMP NOT NULL,
    minutes_before INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    retry_count INT DEFAULT 0,
    last_attempt TIMESTAMP NULL,
    error_message VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reminder_type VARCHAR(20) NOT NULL DEFAULT 'PRIMARY',
    
    CONSTRAINT fk_reminder_event FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE
);

-- Create indexes for efficient queries
CREATE INDEX idx_reminder_status ON reminder_queue (status);
CREATE INDEX idx_reminder_event ON reminder_queue (event_id);
CREATE INDEX idx_reminder_scheduled ON reminder_queue (scheduled_time);

-- Add some test data to verify it's working
INSERT INTO reminder_queue (event_id, user_id, scheduled_time, minutes_before, status, reminder_type)
SELECT 
    id AS event_id,
    user_id,
    DATE_ADD(NOW(), INTERVAL 5 MINUTE) AS scheduled_time,
    10 AS minutes_before,
    'PENDING' AS status,
    'PRIMARY' AS reminder_type
FROM calendar_events
WHERE event_type = 'DEADLINE' AND start_time > NOW()
LIMIT 3; 