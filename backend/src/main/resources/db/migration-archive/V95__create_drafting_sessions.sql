-- Create drafting_sessions table
CREATE TABLE IF NOT EXISTS drafting_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT,
    document_type VARCHAR(50) NOT NULL,
    case_name VARCHAR(500),
    docket_number VARCHAR(100),
    court VARCHAR(255),
    party VARCHAR(255),
    case_summary TEXT,
    wizard_data TEXT,
    generated_document TEXT,
    generation_time_ms BIGINT,
    status VARCHAR(20),
    session_id VARCHAR(255),
    file_manager_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_document_type (document_type),
    INDEX idx_status (status),
    INDEX idx_session_id (session_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
