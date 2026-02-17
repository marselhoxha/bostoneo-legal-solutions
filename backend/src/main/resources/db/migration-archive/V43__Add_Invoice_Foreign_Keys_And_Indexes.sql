-- Add Foreign Key Constraints and Optimize Invoice Tables
-- This migration adds proper foreign key constraints and performance indexes

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

-- Now add foreign key constraints

-- 1. Add foreign key for client_id (required field)
ALTER TABLE invoices 
ADD CONSTRAINT fk_invoice_client 
FOREIGN KEY (client_id) 
REFERENCES clients(id) 
ON DELETE RESTRICT;

-- 2. Add foreign key for legal_case_id (optional field)
ALTER TABLE invoices 
ADD CONSTRAINT fk_invoice_legal_case 
FOREIGN KEY (legal_case_id) 
REFERENCES legal_cases(id) 
ON DELETE SET NULL;

-- 3. Add foreign key for created_by (optional field)
ALTER TABLE invoices 
ADD CONSTRAINT fk_invoice_created_by 
FOREIGN KEY (created_by) 
REFERENCES users(id) 
ON DELETE SET NULL;

-- 4. Ensure invoice_time_entries constraints exist
-- Drop existing constraints if they exist (idempotent)
ALTER TABLE invoice_time_entries 
DROP FOREIGN KEY IF EXISTS invoice_time_entries_ibfk_1;

ALTER TABLE invoice_time_entries 
DROP FOREIGN KEY IF EXISTS invoice_time_entries_ibfk_2;

-- Re-add constraints with proper names
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

-- 5. Add performance indexes for common queries

-- Index for finding invoices by client and status
CREATE INDEX idx_invoice_client_status 
ON invoices(client_id, status);

-- Index for finding invoices by date range
CREATE INDEX idx_invoice_date_range 
ON invoices(issue_date, due_date);

-- Index for finding overdue invoices
CREATE INDEX idx_invoice_overdue 
ON invoices(due_date, status) 
WHERE status IN ('ISSUED', 'PENDING', 'OVERDUE');

-- Index for invoice number lookup (if not already unique)
CREATE INDEX IF NOT EXISTS idx_invoice_number 
ON invoices(invoice_number);

-- Index for finding invoices by total amount
CREATE INDEX idx_invoice_amount 
ON invoices(total_amount);

-- Composite index for complex filtering
CREATE INDEX idx_invoice_filter 
ON invoices(client_id, legal_case_id, status, issue_date);

-- 6. Add check constraints for data integrity

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
CREATE OR REPLACE VIEW invoice_statistics AS
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
CREATE OR REPLACE VIEW client_invoice_summary AS
SELECT 
    c.id as client_id,
    c.name as client_name,
    COUNT(i.id) as total_invoices,
    SUM(i.total_amount) as total_billed,
    SUM(CASE WHEN i.status = 'PAID' THEN i.total_amount ELSE 0 END) as total_paid,
    SUM(CASE WHEN i.status IN ('PENDING', 'ISSUED', 'OVERDUE') THEN i.total_amount ELSE 0 END) as total_outstanding,
    MAX(i.issue_date) as last_invoice_date
FROM clients c
LEFT JOIN invoices i ON c.id = i.client_id
GROUP BY c.id, c.name;

-- 9. Add trigger to update invoice status to OVERDUE automatically
DELIMITER $$

DROP TRIGGER IF EXISTS update_overdue_invoices$$

CREATE TRIGGER update_overdue_invoices 
BEFORE UPDATE ON invoices
FOR EACH ROW
BEGIN
    -- Check if invoice should be marked as overdue
    IF NEW.status IN ('ISSUED', 'PENDING') 
       AND NEW.due_date < CURDATE() 
       AND OLD.status != 'OVERDUE' THEN
        SET NEW.status = 'OVERDUE';
    END IF;
END$$

DELIMITER ;

-- 10. Create stored procedure to update all overdue invoices
DELIMITER $$

DROP PROCEDURE IF EXISTS update_all_overdue_invoices$$

CREATE PROCEDURE update_all_overdue_invoices()
BEGIN
    UPDATE invoices 
    SET status = 'OVERDUE' 
    WHERE status IN ('ISSUED', 'PENDING') 
      AND due_date < CURDATE();
END$$

DELIMITER ;

-- Execute the procedure once to update existing overdue invoices
CALL update_all_overdue_invoices();