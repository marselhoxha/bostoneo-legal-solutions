-- Add missing columns to research_session table for workflow integration
-- Columns: description, last_accessed, total_documents_viewed

-- Add description column if not exists
SET @col_desc = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'research_session' AND COLUMN_NAME = 'description');
SET @sql_desc = IF(@col_desc = 0, 'ALTER TABLE research_session ADD COLUMN description TEXT', 'SELECT 1');
PREPARE stmt_desc FROM @sql_desc;
EXECUTE stmt_desc;
DEALLOCATE PREPARE stmt_desc;

-- Add last_accessed column if not exists
SET @col_last = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'research_session' AND COLUMN_NAME = 'last_accessed');
SET @sql_last = IF(@col_last = 0, 'ALTER TABLE research_session ADD COLUMN last_accessed TIMESTAMP NULL', 'SELECT 1');
PREPARE stmt_last FROM @sql_last;
EXECUTE stmt_last;
DEALLOCATE PREPARE stmt_last;

-- Add total_documents_viewed column if not exists
SET @col_docs = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'research_session' AND COLUMN_NAME = 'total_documents_viewed');
SET @sql_docs = IF(@col_docs = 0, 'ALTER TABLE research_session ADD COLUMN total_documents_viewed INT DEFAULT 0', 'SELECT 1');
PREPARE stmt_docs FROM @sql_docs;
EXECUTE stmt_docs;
DEALLOCATE PREPARE stmt_docs;
