-- Create user_notifications table for storing persistent notifications
CREATE TABLE user_notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    read BOOLEAN NOT NULL DEFAULT FALSE,
    triggered_by_user_id BIGINT,
    triggered_by_name VARCHAR(255),
    entity_id BIGINT,
    entity_type VARCHAR(50),
    url VARCHAR(500),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME,
    
    INDEX idx_user_id (user_id),
    INDEX idx_user_read (user_id, read),
    INDEX idx_created_at (created_at),
    INDEX idx_type (type),
    INDEX idx_priority (priority)
);