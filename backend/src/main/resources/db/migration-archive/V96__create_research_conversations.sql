-- Create research_conversations table
CREATE TABLE IF NOT EXISTS research_conversations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT,
    case_id BIGINT,
    title VARCHAR(500),
    description TEXT,
    research_mode VARCHAR(20),
    total_messages INT DEFAULT 0,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    session_id VARCHAR(255),
    last_message_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_case_id (case_id),
    INDEX idx_session_id (session_id),
    INDEX idx_is_archived (is_archived),
    INDEX idx_is_pinned (is_pinned),
    INDEX idx_last_message_at (last_message_at),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create research_conversation_messages table
CREATE TABLE IF NOT EXISTS research_conversation_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    research_mode VARCHAR(20),
    sources TEXT,
    suggested_actions TEXT,
    execution_time_ms BIGINT,
    token_count INT,
    message_index INT,
    is_streaming BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES research_conversations(id) ON DELETE CASCADE,
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_role (role),
    INDEX idx_created_at (created_at),
    INDEX idx_message_index (message_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
