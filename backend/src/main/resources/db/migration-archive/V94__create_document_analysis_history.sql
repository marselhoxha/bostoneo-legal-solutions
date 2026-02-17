-- Create document_analysis_history table
CREATE TABLE IF NOT EXISTS document_analysis_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT,
    analysis_type VARCHAR(50) NOT NULL,
    file_names TEXT,
    file_count INT,
    total_file_size BIGINT,
    analysis_request TEXT,
    analysis_result TEXT,
    execution_time_ms BIGINT,
    is_saved BOOLEAN DEFAULT FALSE,
    session_id VARCHAR(255),
    summary_type VARCHAR(20),
    include_deadlines BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_analysis_type (analysis_type),
    INDEX idx_created_at (created_at),
    INDEX idx_session_id (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
