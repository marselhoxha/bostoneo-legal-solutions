-- Create table for per-attorney thread read status
-- This fixes the critical bug where one attorney reading a message marked it as read for all attorneys

CREATE TABLE IF NOT EXISTS thread_attorney_status (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    thread_id BIGINT UNSIGNED NOT NULL,
    attorney_user_id BIGINT UNSIGNED NOT NULL,
    unread_count INT DEFAULT 0,
    last_read_at DATETIME(6),
    created_at DATETIME(6),
    updated_at DATETIME(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_thread_attorney (thread_id, attorney_user_id),
    KEY idx_thread_id (thread_id),
    KEY idx_attorney_user_id (attorney_user_id),
    CONSTRAINT fk_tas_thread FOREIGN KEY (thread_id) REFERENCES message_threads(id) ON DELETE CASCADE,
    CONSTRAINT fk_tas_attorney FOREIGN KEY (attorney_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrate existing data: Create status records for all existing thread-attorney relationships
-- For each thread, create a status record for:
-- 1. The thread owner (attorney_id)
-- 2. All attorneys assigned to the case

-- Insert for thread owners
INSERT INTO thread_attorney_status (thread_id, attorney_user_id, unread_count, created_at, updated_at)
SELECT
    mt.id,
    mt.attorney_id,
    mt.unread_by_attorney,
    NOW(),
    NOW()
FROM message_threads mt
WHERE mt.attorney_id IS NOT NULL
ON DUPLICATE KEY UPDATE unread_count = VALUES(unread_count);

-- Insert for case-assigned attorneys (excluding thread owners to avoid duplicates)
INSERT INTO thread_attorney_status (thread_id, attorney_user_id, unread_count, created_at, updated_at)
SELECT
    mt.id,
    ca.user_id,
    mt.unread_by_attorney,
    NOW(),
    NOW()
FROM message_threads mt
INNER JOIN case_assignments ca ON ca.case_id = mt.case_id AND ca.is_active = 1
WHERE ca.user_id IS NOT NULL
  AND ca.user_id != COALESCE(mt.attorney_id, 0)
ON DUPLICATE KEY UPDATE unread_count = VALUES(unread_count);
