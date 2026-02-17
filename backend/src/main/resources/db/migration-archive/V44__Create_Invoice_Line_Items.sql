-- Create Invoice Line Items table for detailed billing
CREATE TABLE IF NOT EXISTS invoice_line_items (
    id BIGINT NOT NULL AUTO_INCREMENT,
    invoice_id BIGINT NOT NULL,
    description VARCHAR(500) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    unit_price DECIMAL(15,2) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    line_order INT NOT NULL DEFAULT 0,
    category VARCHAR(50),
    service_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_line_item_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    INDEX idx_line_item_invoice (invoice_id),
    INDEX idx_line_item_order (invoice_id, line_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note: Check constraints will be handled at the application level
-- MySQL 8.0.16+ supports check constraints but there are compatibility issues

-- Create trigger to recalculate invoice totals when line items change
DELIMITER $$

CREATE TRIGGER update_invoice_totals_after_line_item_insert
AFTER INSERT ON invoice_line_items
FOR EACH ROW
BEGIN
    UPDATE invoices 
    SET subtotal = (
        SELECT COALESCE(SUM(amount), 0) 
        FROM invoice_line_items 
        WHERE invoice_id = NEW.invoice_id
    ),
    tax_amount = (
        SELECT COALESCE(SUM(amount), 0) * (tax_rate / 100)
        FROM invoice_line_items 
        WHERE invoice_id = NEW.invoice_id
    ),
    total_amount = (
        SELECT COALESCE(SUM(amount), 0) * (1 + (tax_rate / 100))
        FROM invoice_line_items 
        WHERE invoice_id = NEW.invoice_id
    )
    WHERE id = NEW.invoice_id;
END$$

CREATE TRIGGER update_invoice_totals_after_line_item_update
AFTER UPDATE ON invoice_line_items
FOR EACH ROW
BEGIN
    UPDATE invoices 
    SET subtotal = (
        SELECT COALESCE(SUM(amount), 0) 
        FROM invoice_line_items 
        WHERE invoice_id = NEW.invoice_id
    ),
    tax_amount = (
        SELECT COALESCE(SUM(amount), 0) * (tax_rate / 100)
        FROM invoice_line_items 
        WHERE invoice_id = NEW.invoice_id
    ),
    total_amount = (
        SELECT COALESCE(SUM(amount), 0) * (1 + (tax_rate / 100))
        FROM invoice_line_items 
        WHERE invoice_id = NEW.invoice_id
    )
    WHERE id = NEW.invoice_id;
END$$

CREATE TRIGGER update_invoice_totals_after_line_item_delete
AFTER DELETE ON invoice_line_items
FOR EACH ROW
BEGIN
    UPDATE invoices 
    SET subtotal = (
        SELECT COALESCE(SUM(amount), 0) 
        FROM invoice_line_items 
        WHERE invoice_id = OLD.invoice_id
    ),
    tax_amount = (
        SELECT COALESCE(SUM(amount), 0) * (tax_rate / 100)
        FROM invoice_line_items 
        WHERE invoice_id = OLD.invoice_id
    ),
    total_amount = (
        SELECT COALESCE(SUM(amount), 0) * (1 + (tax_rate / 100))
        FROM invoice_line_items 
        WHERE invoice_id = OLD.invoice_id
    )
    WHERE id = OLD.invoice_id;
END$$

DELIMITER ;