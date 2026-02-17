-- Fix time_entries foreign key constraint that references incorrect table
-- The constraint is currently referencing 'invoices_new' which doesn't exist
-- It should reference 'invoices' table

-- First, drop the existing constraint
ALTER TABLE time_entries DROP FOREIGN KEY time_entries_ibfk_3;

-- Add the correct foreign key constraint
ALTER TABLE time_entries 
ADD CONSTRAINT time_entries_invoice_fk 
FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

-- Add index if not exists
CREATE INDEX IF NOT EXISTS idx_time_entries_invoice ON time_entries(invoice_id);