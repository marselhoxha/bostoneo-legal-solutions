-- Add Foreign Key Constraints and Optimize Invoice Tables (Safe Version)
-- This migration adds proper foreign key constraints and performance indexes
-- It checks for existing constraints to avoid errors

-- First, let's check and clean up any orphaned records
-- Delete invoices with non-existent client IDs
DELETE FROM invoices 
WHERE client_id NOT IN (SELECT id FROM clients)
  AND client_id IS NOT NULL;

-- Delete invoices with non-existent legal case IDs
DELETE FROM invoices 
WHERE legal_case_id NOT IN (SELECT id FROM legal_cases)
  AND legal_case_id IS NOT NULL;

-- Delete invoice_time_entries with non-existent invoice IDs
DELETE FROM invoice_time_entries 
WHERE invoice_id NOT IN (SELECT id FROM invoices);

-- Delete invoice_time_entries with non-existent time_entry IDs
DELETE FROM invoice_time_entries 
WHERE time_entry_id NOT IN (SELECT id FROM time_entries);

-- Now add foreign key constraints (only if they don't exist)

-- 1. Check and add foreign key for client_id
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'invoices' 
    AND CONSTRAINT_NAME = 'fk_invoice_client'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE invoices ADD CONSTRAINT fk_invoice_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT',
    'SELECT "FK fk_invoice_client already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Add foreign key for legal_case_id (optional field)
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'invoices' 
    AND CONSTRAINT_NAME = 'fk_invoice_legal_case'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE invoices ADD CONSTRAINT fk_invoice_legal_case FOREIGN KEY (legal_case_id) REFERENCES legal_cases(id) ON DELETE SET NULL',
    'SELECT "FK fk_invoice_legal_case already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Add foreign key for created_by (optional field)
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'invoices' 
    AND CONSTRAINT_NAME = 'fk_invoice_created_by'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE invoices ADD CONSTRAINT fk_invoice_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL',
    'SELECT "FK fk_invoice_created_by already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Fix invoice_time_entries constraints
-- First drop old constraints if they exist
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'invoice_time_entries' 
    AND CONSTRAINT_NAME = 'invoice_time_entries_ibfk_1'
);

SET @sql = IF(@fk_exists > 0,
    'ALTER TABLE invoice_time_entries DROP FOREIGN KEY invoice_time_entries_ibfk_1',
    'SELECT "FK invoice_time_entries_ibfk_1 does not exist" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'invoice_time_entries' 
    AND CONSTRAINT_NAME = 'invoice_time_entries_ibfk_2'
);

SET @sql = IF(@fk_exists > 0,
    'ALTER TABLE invoice_time_entries DROP FOREIGN KEY invoice_time_entries_ibfk_2',
    'SELECT "FK invoice_time_entries_ibfk_2 does not exist" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add constraints with proper names
ALTER TABLE invoice_time_entries 
ADD CONSTRAINT fk_invoice_time_entries_invoice 
FOREIGN KEY (invoice_id) 
REFERENCES invoices(id) 
ON DELETE CASCADE;

ALTER TABLE invoice_time_entries 
ADD CONSTRAINT fk_invoice_time_entries_time_entry 
FOREIGN KEY (time_entry_id) 
REFERENCES time_entries(id) 
ON DELETE CASCADE;

-- 5. Add performance indexes for common queries (check if exist first)

-- Index for finding invoices by client and status
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'invoices' 
    AND INDEX_NAME = 'idx_invoice_client_status'
);

SET @sql = IF(@index_exists = 0,
    'CREATE INDEX idx_invoice_client_status ON invoices(client_id, status)',
    'SELECT "Index idx_invoice_client_status already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index for finding invoices by date range
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'invoices' 
    AND INDEX_NAME = 'idx_invoice_date_range'
);

SET @sql = IF(@index_exists = 0,
    'CREATE INDEX idx_invoice_date_range ON invoices(issue_date, due_date)',
    'SELECT "Index idx_invoice_date_range already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index for invoice amount lookup
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'invoices' 
    AND INDEX_NAME = 'idx_invoice_amount'
);

SET @sql = IF(@index_exists = 0,
    'CREATE INDEX idx_invoice_amount ON invoices(total_amount)',
    'SELECT "Index idx_invoice_amount already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6. Add check constraints for data integrity (MySQL 8.0.16+)
-- Note: These will silently fail on older MySQL versions

-- Ensure dates are logical
ALTER TABLE invoices 
ADD CONSTRAINT chk_invoice_dates 
CHECK (due_date >= issue_date);

-- Ensure amounts are non-negative
ALTER TABLE invoices 
ADD CONSTRAINT chk_invoice_amounts 
CHECK (subtotal >= 0 AND tax_amount >= 0 AND total_amount >= 0);

-- Ensure tax rate is between 0 and 100
ALTER TABLE invoices 
ADD CONSTRAINT chk_invoice_tax_rate 
CHECK (tax_rate >= 0 AND tax_rate <= 100);

-- 7. Create a view for invoice statistics
DROP VIEW IF EXISTS invoice_statistics;

CREATE VIEW invoice_statistics AS
SELECT 
    COUNT(*) as total_invoices,
    COUNT(CASE WHEN status = 'PAID' THEN 1 END) as paid_invoices,
    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_invoices,
    COUNT(CASE WHEN status = 'OVERDUE' THEN 1 END) as overdue_invoices,
    COUNT(CASE WHEN status = 'DRAFT' THEN 1 END) as draft_invoices,
    COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_invoices,
    SUM(CASE WHEN status = 'PAID' THEN total_amount ELSE 0 END) as total_paid,
    SUM(CASE WHEN status IN ('PENDING', 'ISSUED', 'OVERDUE') THEN total_amount ELSE 0 END) as total_outstanding,
    AVG(CASE WHEN status = 'PAID' THEN DATEDIFF(updated_at, issue_date) END) as avg_payment_days
FROM invoices;

-- 8. Create a view for client invoice summary
DROP VIEW IF EXISTS client_invoice_summary;

CREATE VIEW client_invoice_summary AS
SELECT 
    c.id as client_id,
    c.name as client_name,
    COUNT(i.id) as total_invoices,
    COALESCE(SUM(i.total_amount), 0) as total_billed,
    COALESCE(SUM(CASE WHEN i.status = 'PAID' THEN i.total_amount ELSE 0 END), 0) as total_paid,
    COALESCE(SUM(CASE WHEN i.status IN ('PENDING', 'ISSUED', 'OVERDUE') THEN i.total_amount ELSE 0 END), 0) as total_outstanding,
    MAX(i.issue_date) as last_invoice_date
FROM clients c
LEFT JOIN invoices i ON c.id = i.client_id
GROUP BY c.id, c.name;

-- 9. Create stored procedure to update all overdue invoices
DROP PROCEDURE IF EXISTS update_all_overdue_invoices;

DELIMITER $$

CREATE PROCEDURE update_all_overdue_invoices()
BEGIN
    UPDATE invoices 
    SET status = 'OVERDUE' 
    WHERE status IN ('ISSUED', 'PENDING') 
      AND due_date < CURDATE();
      
    SELECT ROW_COUNT() as updated_count;
END$$

DELIMITER ;

-- Execute the procedure once to update existing overdue invoices
CALL update_all_overdue_invoices();

-- 10. Show summary of changes
SELECT 'Migration completed successfully!' as message;
SELECT 
    'Foreign Keys' as type,
    COUNT(*) as count
FROM information_schema.TABLE_CONSTRAINTS 
WHERE CONSTRAINT_SCHEMA = DATABASE() 
AND TABLE_NAME IN ('invoices', 'invoice_time_entries')
AND CONSTRAINT_TYPE = 'FOREIGN KEY'

UNION ALL

SELECT 
    'Indexes' as type,
    COUNT(DISTINCT INDEX_NAME) as count
FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'invoices'

UNION ALL

SELECT 
    'Views' as type,
    COUNT(*) as count
FROM information_schema.VIEWS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME IN ('invoice_statistics', 'client_invoice_summary');