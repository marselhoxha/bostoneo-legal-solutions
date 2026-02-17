-- Create platform_announcements table for storing sent announcements
-- This allows superadmins to view announcement history

CREATE TABLE IF NOT EXISTS platform_announcements (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'INFO',
    send_to_all BOOLEAN DEFAULT FALSE,
    target_organization_ids TEXT,
    target_user_ids TEXT,
    recipients_count INTEGER DEFAULT 0,
    scheduled_at TIMESTAMP,
    sent_at TIMESTAMP,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_announcement_created_by FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_platform_announcements_created_at ON platform_announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_announcements_type ON platform_announcements(type);
CREATE INDEX IF NOT EXISTS idx_platform_announcements_created_by ON platform_announcements(created_by);
