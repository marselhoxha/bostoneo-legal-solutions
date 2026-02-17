-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    client_id BIGINT NOT NULL,
    client_name VARCHAR(255),
    legal_case_id BIGINT,
    case_name VARCHAR(255),
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    tax_rate DECIMAL(5, 2) DEFAULT 0.00,
    tax_amount DECIMAL(10, 2) DEFAULT 0.00,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_invoice_client (client_id),
    INDEX idx_invoice_case (legal_case_id),
    INDEX idx_invoice_status (status),
    INDEX idx_invoice_dates (issue_date, due_date)
);

-- Create invoice_time_entries join table
CREATE TABLE IF NOT EXISTS invoice_time_entries (
    invoice_id BIGINT NOT NULL,
    time_entry_id BIGINT NOT NULL,
    PRIMARY KEY (invoice_id, time_entry_id),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (time_entry_id) REFERENCES time_entries(id) ON DELETE CASCADE
);

-- Add index for invoice_id in time_entries table
ALTER TABLE time_entries ADD INDEX idx_time_entry_invoice (invoice_id);

-- Add sample data
INSERT INTO invoices (invoice_number, client_id, client_name, legal_case_id, case_name, issue_date, due_date, status, subtotal, tax_rate, tax_amount, total_amount, notes, created_by)
VALUES 
('INV-2023-1001', 1, 'ABC Corporation', 1, 'Contract Negotiation', '2023-12-01', '2023-12-31', 'PAID', 2500.00, 5.00, 125.00, 2625.00, 'Payment received on time', 1),
('INV-2023-1002', 2, 'XYZ Industries', 3, 'Corporate Restructuring', '2023-12-15', '2024-01-15', 'ISSUED', 3750.00, 5.00, 187.50, 3937.50, 'Sent via email', 1),
('INV-2024-1003', 1, 'ABC Corporation', 2, 'Litigation Support', '2024-01-05', '2024-02-05', 'DRAFT', 1800.00, 5.00, 90.00, 1890.00, 'Pending review', 1),
('INV-2024-1004', 3, 'Johnson & Associates', 4, 'Intellectual Property', '2024-01-10', '2024-02-10', 'OVERDUE', 4200.00, 5.00, 210.00, 4410.00, 'Payment reminder sent', 1);

-- Update some time entries to be associated with invoices
UPDATE time_entries SET invoice_id = 1, status = 'BILLED' WHERE id IN (1, 2, 3) AND invoice_id IS NULL;
UPDATE time_entries SET invoice_id = 2, status = 'BILLED' WHERE id IN (4, 5) AND invoice_id IS NULL;
UPDATE time_entries SET invoice_id = 3, status = 'BILLED' WHERE id IN (6, 7) AND invoice_id IS NULL;
UPDATE time_entries SET invoice_id = 4, status = 'BILLED' WHERE id IN (8, 9, 10) AND invoice_id IS NULL;

-- Insert records into invoice_time_entries
INSERT INTO invoice_time_entries (invoice_id, time_entry_id)
SELECT 1, id FROM time_entries WHERE invoice_id = 1;

INSERT INTO invoice_time_entries (invoice_id, time_entry_id)
SELECT 2, id FROM time_entries WHERE invoice_id = 2;

INSERT INTO invoice_time_entries (invoice_id, time_entry_id)
SELECT 3, id FROM time_entries WHERE invoice_id = 3;

INSERT INTO invoice_time_entries (invoice_id, time_entry_id)
SELECT 4, id FROM time_entries WHERE invoice_id = 4; 