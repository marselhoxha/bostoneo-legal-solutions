-- V35: Add visibility and access control fields for comprehensive RBAC (Safe version)

-- 1. Add restricted_to_roles field to calendar_events if it doesn't exist
SET @dbname = DATABASE();
SET @tablename = 'calendar_events';
SET @columnname = 'restricted_to_roles';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE
    (table_name = @tablename) AND (table_schema = @dbname) AND (column_name = @columnname)
  ) > 0,
  "SELECT 1", -- Column exists, do nothing
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " TEXT COMMENT 'JSON array of role names that can view this event'")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Update existing events to have appropriate visibility
UPDATE calendar_events 
SET visibility = CASE 
    WHEN event_type IN ('HEARING', 'COURT_DATE', 'APPOINTMENT', 'CLIENT_MEETING') THEN 'PUBLIC'
    WHEN event_type IN ('DEADLINE', 'REMINDER') THEN 'INTERNAL'
    WHEN event_type IN ('TEAM_MEETING', 'MEDIATION', 'DEPOSITION') THEN 'STAFF_ONLY'
    ELSE 'INTERNAL'
END
WHERE visibility = 'INTERNAL';

-- 2. Add columns to case_notes if they don't exist
SET @columnname = 'visibility';
SET @tablename = 'case_notes';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE
    (table_name = @tablename) AND (table_schema = @dbname) AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " VARCHAR(50) DEFAULT 'INTERNAL' AFTER content, ADD INDEX idx_case_note_visibility (visibility)")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = 'is_attorney_work_product';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE
    (table_name = @tablename) AND (table_schema = @dbname) AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " BOOLEAN DEFAULT FALSE")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 3. Add document access tracking
CREATE TABLE IF NOT EXISTS document_access_log (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    document_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    access_type VARCHAR(50) NOT NULL, -- VIEW, DOWNLOAD, EDIT, DELETE
    access_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_document_access_user (user_id),
    INDEX idx_document_access_document (document_id),
    INDEX idx_document_access_time (access_time)
);

-- 4. Add financial access permissions table
CREATE TABLE IF NOT EXISTS financial_access_permissions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    case_id BIGINT UNSIGNED,
    invoice_id BIGINT UNSIGNED,
    permission_type VARCHAR(50) NOT NULL, -- VIEW_BILLING, EDIT_BILLING, VIEW_EXPENSES
    granted_by BIGINT UNSIGNED NOT NULL,
    granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    notes TEXT,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES invoice(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_financial_permission (user_id, case_id, invoice_id, permission_type),
    INDEX idx_financial_access_user (user_id),
    INDEX idx_financial_access_expires (expires_at)
);

-- 5. Add case-specific document visibility overrides
CREATE TABLE IF NOT EXISTS document_visibility_overrides (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    document_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED,
    role_id BIGINT UNSIGNED,
    access_type VARCHAR(50) NOT NULL, -- GRANT, DENY
    granted_by BIGINT UNSIGNED NOT NULL,
    granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    reason TEXT,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_doc_visibility_document (document_id),
    INDEX idx_doc_visibility_user (user_id),
    INDEX idx_doc_visibility_role (role_id)
);

-- 6. Update document categories to match our RBAC model
UPDATE legaldocument 
SET category = CASE 
    WHEN type IN ('CONTRACT', 'COURT_ORDER', 'FILING') THEN 'PUBLIC'
    WHEN type IN ('BRIEF', 'MOTION', 'RESEARCH') THEN 'INTERNAL'
    WHEN type IN ('FINANCIAL', 'INVOICE', 'EXPENSE_REPORT') THEN 'CONFIDENTIAL'
    WHEN type IN ('PRIVILEGED', 'ATTORNEY_NOTES') THEN 'ATTORNEY_CLIENT_PRIVILEGE'
    ELSE 'INTERNAL'
END
WHERE category = 'OTHER' OR category IS NULL;

-- 7. Add visibility to case_activities if it doesn't exist
SET @columnname = 'visibility';
SET @tablename = 'case_activities';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE
    (table_name = @tablename) AND (table_schema = @dbname) AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " VARCHAR(50) DEFAULT 'INTERNAL' AFTER metadata, ADD INDEX idx_case_activity_visibility (visibility)")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 8. Add meeting participant restrictions for calendar events
CREATE TABLE IF NOT EXISTS calendar_event_participants (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    role VARCHAR(50) DEFAULT 'PARTICIPANT', -- ORGANIZER, PARTICIPANT, OPTIONAL
    response_status VARCHAR(50) DEFAULT 'PENDING', -- ACCEPTED, DECLINED, PENDING
    added_by BIGINT UNSIGNED,
    added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL,
    
    UNIQUE KEY unique_event_participant (event_id, user_id),
    INDEX idx_event_participant_user (user_id),
    INDEX idx_event_participant_status (response_status)
);

-- 9. Add case access request tracking
CREATE TABLE IF NOT EXISTS case_access_requests (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT UNSIGNED NOT NULL,
    requested_by BIGINT UNSIGNED NOT NULL,
    requested_role VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, APPROVED, DENIED
    reviewed_by BIGINT UNSIGNED,
    reviewed_at DATETIME,
    review_notes TEXT,
    requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_access_request_case (case_id),
    INDEX idx_access_request_user (requested_by),
    INDEX idx_access_request_status (status)
);

-- 10. Add columns to legal_cases for secretary limited view
SET @columnname = 'is_confidential';
SET @tablename = 'legal_cases';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE
    (table_name = @tablename) AND (table_schema = @dbname) AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " BOOLEAN DEFAULT FALSE AFTER status, ADD INDEX idx_case_confidential (is_confidential)")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = 'restricted_access';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE
    (table_name = @tablename) AND (table_schema = @dbname) AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " BOOLEAN DEFAULT FALSE")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists; 