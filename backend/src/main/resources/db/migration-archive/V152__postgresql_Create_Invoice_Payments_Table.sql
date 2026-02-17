-- Create invoice_payments table for PostgreSQL with organization support
CREATE TABLE IF NOT EXISTS invoice_payments (
    id BIGSERIAL PRIMARY KEY,
    invoice_id BIGINT NOT NULL,
    organization_id BIGINT,
    payment_date DATE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    reference_number VARCHAR(100),
    notes TEXT,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_invoice_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    CONSTRAINT fk_invoice_payments_user FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT fk_invoice_payments_organization FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_date ON invoice_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_organization_id ON invoice_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_org_invoice ON invoice_payments(organization_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_org_date ON invoice_payments(organization_id, payment_date);

-- Add payment summary fields to invoices table if not exists
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_paid DECIMAL(10, 2) DEFAULT 0.00;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS balance_due DECIMAL(10, 2) DEFAULT 0.00;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_payment_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'UNPAID';

-- Create trigger function to update invoice payment status
CREATE OR REPLACE FUNCTION update_invoice_payment_status()
RETURNS TRIGGER AS $$
DECLARE
    total_payments DECIMAL(10, 2);
    invoice_total DECIMAL(10, 2);
BEGIN
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
            WHEN total_payments < invoice_total THEN 'PARTIAL'
            WHEN total_payments >= invoice_total THEN 'PAID'
        END
    WHERE id = NEW.invoice_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_update_invoice_payment_status ON invoice_payments;
CREATE TRIGGER trg_update_invoice_payment_status
AFTER INSERT OR UPDATE ON invoice_payments
FOR EACH ROW
EXECUTE FUNCTION update_invoice_payment_status();

-- Populate organization_id from invoice for any existing payments
UPDATE invoice_payments ip
SET organization_id = i.organization_id
FROM invoices i
WHERE ip.invoice_id = i.id
  AND ip.organization_id IS NULL;
