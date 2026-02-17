-- Standardize naming to use "clients" instead of "customers" across all tables

-- 1. Rename customer table to clients
RENAME TABLE customer TO clients;

-- 2. Add foreign key constraint from invoices to clients table
ALTER TABLE invoices
    ADD CONSTRAINT fk_invoice_client 
    FOREIGN KEY (client_id) REFERENCES clients(id);

-- 3. Update expense table to use client_id instead of customer_id
ALTER TABLE expense
    CHANGE COLUMN customer_id client_id BIGINT UNSIGNED NOT NULL;

-- 4. Legal_cases already has client columns, no changes needed

-- 4. Add indexes for better performance
CREATE INDEX idx_invoice_client ON invoices(client_id);
CREATE INDEX idx_legal_case_client_email ON legal_cases(client_email);

-- 5. Update any other tables that might have customer references
-- Check if case_budget_summary exists and has customer_name column
DROP PROCEDURE IF EXISTS update_case_budget_summary;
DELIMITER $$
CREATE PROCEDURE update_case_budget_summary()
BEGIN
    IF EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'case_budget_summary' 
        AND COLUMN_NAME = 'customer_name'
    ) THEN
        ALTER TABLE case_budget_summary
            CHANGE COLUMN customer_name client_name VARCHAR(255) DEFAULT NULL;
    END IF;
END$$
DELIMITER ;

CALL update_case_budget_summary();
DROP PROCEDURE update_case_budget_summary;