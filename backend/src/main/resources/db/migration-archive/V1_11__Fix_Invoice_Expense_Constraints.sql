-- Fix Invoice-Expense Foreign Key Constraints
-- This migration ensures proper cascade behavior when deleting invoices that have expenses

-- Step 1: Check if the foreign key constraint exists and drop it
SET @constraint_name = (
    SELECT CONSTRAINT_NAME 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = 'bostoneosolutions' 
    AND TABLE_NAME = 'expense' 
    AND COLUMN_NAME = 'invoice_id' 
    AND REFERENCED_TABLE_NAME = 'invoice'
    LIMIT 1
);

SET @sql = IF(@constraint_name IS NOT NULL, 
    CONCAT('ALTER TABLE expense DROP FOREIGN KEY ', @constraint_name), 
    'SELECT "No constraint to drop" as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 2: Add the corrected foreign key constraint with proper cascade behavior
-- When an invoice is deleted, set the invoice_id in expenses to NULL
-- This prevents the constraint violation error while maintaining data integrity
ALTER TABLE expense 
ADD CONSTRAINT FK_expense_invoice_id 
FOREIGN KEY (invoice_id) 
REFERENCES invoice(id) 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- Step 3: Add index for better performance on the foreign key
CREATE INDEX IF NOT EXISTS idx_expense_invoice_id ON expense(invoice_id);

-- Step 4: Ensure proper audit logging for these operations
-- Create trigger to log when expense-invoice relationships are modified
DELIMITER //

CREATE TRIGGER IF NOT EXISTS expense_invoice_audit_trigger
AFTER UPDATE ON expense
FOR EACH ROW
BEGIN
    IF OLD.invoice_id IS NOT NULL AND NEW.invoice_id IS NULL THEN
        INSERT INTO audit_log (
            user_id, 
            action, 
            entity_type, 
            entity_id, 
            description, 
            timestamp
        ) VALUES (
            NULL, -- System operation
            'UPDATE',
            'EXPENSE',
            NEW.id,
            CONCAT('Expense unlinked from invoice ', OLD.invoice_id, ' due to invoice deletion'),
            NOW()
        );
    END IF;
END //

DELIMITER ;

-- Step 5: Add some defensive data integrity checks
-- Update any orphaned expenses that might exist
UPDATE expense 
SET invoice_id = NULL 
WHERE invoice_id IS NOT NULL 
AND invoice_id NOT IN (SELECT id FROM invoice);

-- Add comment for documentation
ALTER TABLE expense COMMENT = 'Expense table with proper cascade handling for invoice deletions'; 
 
 
 
 
 
 