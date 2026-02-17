-- Create invoice payments table for tracking payments
CREATE TABLE IF NOT EXISTS invoice_payments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    invoice_id BIGINT NOT NULL,
    payment_date DATE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    reference_number VARCHAR(100),
    notes TEXT,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_invoice_payments_invoice (invoice_id),
    INDEX idx_invoice_payments_date (payment_date)
);

-- Add payment summary fields to invoices table
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS total_paid DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS balance_due DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS last_payment_date DATE,
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'UNPAID';

-- Create trigger to update invoice payment status
DELIMITER $$
CREATE TRIGGER update_invoice_payment_status
AFTER INSERT ON invoice_payments
FOR EACH ROW
BEGIN
    DECLARE total_payments DECIMAL(10, 2);
    DECLARE invoice_total DECIMAL(10, 2);
    
    -- Calculate total payments for this invoice
    SELECT COALESCE(SUM(amount), 0) INTO total_payments
    FROM invoice_payments
    WHERE invoice_id = NEW.invoice_id;
    
    -- Get invoice total
    SELECT total_amount INTO invoice_total
    FROM invoices
    WHERE id = NEW.invoice_id;
    
    -- Update invoice payment fields
    UPDATE invoices
    SET 
        total_paid = total_payments,
        balance_due = total_amount - total_payments,
        last_payment_date = NEW.payment_date,
        payment_status = CASE
            WHEN total_payments = 0 THEN 'UNPAID'
            WHEN total_payments < total_amount THEN 'PARTIAL'
            WHEN total_payments >= total_amount THEN 'PAID'
        END
    WHERE id = NEW.invoice_id;
END$$
DELIMITER ;