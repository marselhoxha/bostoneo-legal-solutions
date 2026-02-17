-- Create the reminder_queue table if it doesn't exist
CREATE TABLE IF NOT EXISTS reminder_queue (
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
    
    CONSTRAINT fk_reminder_event_fix FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE
);

-- Create indexes for efficient queries
-- Note: These might fail silently if indexes already exist, which is fine
CREATE INDEX idx_reminder_status ON reminder_queue (status);
CREATE INDEX idx_reminder_event ON reminder_queue (event_id);
CREATE INDEX idx_reminder_scheduled ON reminder_queue (scheduled_time); 