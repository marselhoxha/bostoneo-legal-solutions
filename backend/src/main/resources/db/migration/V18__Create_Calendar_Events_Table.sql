CREATE TABLE IF NOT EXISTS calendar_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    location VARCHAR(255),
    event_type VARCHAR(50) NOT NULL,
    status VARCHAR(50),
    all_day BOOLEAN DEFAULT FALSE,
    recurrence_rule VARCHAR(255),
    color VARCHAR(30),
    case_id BIGINT UNSIGNED,
    user_id BIGINT UNSIGNED,
    reminder_minutes INT,
    reminder_sent BOOLEAN DEFAULT FALSE,
    external_id VARCHAR(255),
    external_calendar VARCHAR(50),
    created_at DATETIME NOT NULL,
    updated_at DATETIME,
    
    CONSTRAINT fk_calendar_event_case
        FOREIGN KEY (case_id)
        REFERENCES legal_cases (id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_calendar_event_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE SET NULL,
        
    INDEX idx_calendar_event_case_id (case_id),
    INDEX idx_calendar_event_user_id (user_id),
    INDEX idx_calendar_event_start_time (start_time),
    INDEX idx_calendar_event_end_time (end_time),
    INDEX idx_calendar_event_type (event_type),
    INDEX idx_calendar_event_status (status)
); 