-- Create Invoice Templates table
CREATE TABLE IF NOT EXISTS invoice_templates (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Template settings
    tax_rate DECIMAL(5,2) DEFAULT 0.00,
    payment_terms INT DEFAULT 30,
    currency_code VARCHAR(3) DEFAULT 'USD',
    
    -- Template content
    header_text TEXT,
    footer_text TEXT,
    notes_template TEXT,
    terms_and_conditions TEXT,
    
    -- Styling options
    logo_position VARCHAR(20) DEFAULT 'top-left',
    primary_color VARCHAR(7) DEFAULT '#405189',
    secondary_color VARCHAR(7) DEFAULT '#878a99',
    font_family VARCHAR(50) DEFAULT 'Inter',
    
    -- Metadata
    created_by BIGINT UNSIGNED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id),
    UNIQUE KEY idx_template_name (name),
    INDEX idx_template_active (is_active),
    INDEX idx_template_default (is_default),
    CONSTRAINT fk_template_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create Invoice Template Line Items (predefined line items for templates)
CREATE TABLE IF NOT EXISTS invoice_template_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    template_id BIGINT UNSIGNED NOT NULL,
    description VARCHAR(500) NOT NULL,
    default_quantity DECIMAL(10,2) DEFAULT 1.00,
    default_unit_price DECIMAL(15,2),
    category VARCHAR(50),
    is_optional BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id),
    CONSTRAINT fk_template_item_template FOREIGN KEY (template_id) REFERENCES invoice_templates(id) ON DELETE CASCADE,
    INDEX idx_template_item_template (template_id),
    INDEX idx_template_item_order (template_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add template reference to invoices table
ALTER TABLE invoices 
ADD COLUMN template_id BIGINT UNSIGNED,
ADD CONSTRAINT fk_invoice_template FOREIGN KEY (template_id) REFERENCES invoice_templates(id) ON DELETE SET NULL;

-- Insert default templates
INSERT INTO invoice_templates (name, description, tax_rate, payment_terms, header_text, footer_text, notes_template, terms_and_conditions, is_default) VALUES
('Standard Legal Invoice', 'Default template for legal services', 6.25, 30, 
 'Thank you for choosing our legal services.',
 'Payment is due within {payment_terms} days of invoice date.',
 'Services rendered as per engagement letter dated {engagement_date}.',
 'Terms & Conditions:\n1. Payment is due within the specified terms.\n2. Late payments may incur interest charges.\n3. All services are subject to our standard engagement terms.',
 TRUE),

('Retainer Invoice', 'Template for monthly retainer clients', 6.25, 15,
 'Monthly Retainer Invoice',
 'This invoice is for services covered under your retainer agreement.',
 'Retainer Period: {retainer_period}',
 'Terms & Conditions:\n1. This invoice covers services under the retainer agreement.\n2. Additional services beyond retainer scope will be billed separately.\n3. Unused retainer hours do not carry forward.',
 FALSE),

('Litigation Services', 'Template for litigation and court representation', 6.25, 45,
 'Invoice for Litigation Services',
 'Thank you for entrusting us with your legal representation.',
 'Case Reference: {case_reference}\nCourt: {court_name}',
 'Terms & Conditions:\n1. Court costs and filing fees are billed as incurred.\n2. Expert witness fees are passed through at cost.\n3. Travel expenses are billed per firm policy.',
 FALSE);

-- Insert template line items for Standard Legal Invoice
INSERT INTO invoice_template_items (template_id, description, default_quantity, default_unit_price, category, is_optional, sort_order)
SELECT 
    id,
    'Legal consultation and advisory services',
    1.00,
    350.00,
    'CONSULTATION',
    FALSE,
    1
FROM invoice_templates WHERE name = 'Standard Legal Invoice';

INSERT INTO invoice_template_items (template_id, description, default_quantity, default_unit_price, category, is_optional, sort_order)
SELECT 
    id,
    'Document review and preparation',
    1.00,
    250.00,
    'DOCUMENTATION',
    TRUE,
    2
FROM invoice_templates WHERE name = 'Standard Legal Invoice';

INSERT INTO invoice_template_items (template_id, description, default_quantity, default_unit_price, category, is_optional, sort_order)
SELECT 
    id,
    'Administrative and filing fees',
    1.00,
    150.00,
    'FILING',
    TRUE,
    3
FROM invoice_templates WHERE name = 'Standard Legal Invoice';

-- Create trigger to ensure only one default template
DELIMITER $$

CREATE TRIGGER ensure_single_default_template
BEFORE INSERT ON invoice_templates
FOR EACH ROW
BEGIN
    IF NEW.is_default = TRUE THEN
        UPDATE invoice_templates SET is_default = FALSE WHERE is_default = TRUE;
    END IF;
END$$

CREATE TRIGGER ensure_single_default_template_update
BEFORE UPDATE ON invoice_templates
FOR EACH ROW
BEGIN
    IF NEW.is_default = TRUE AND OLD.is_default = FALSE THEN
        UPDATE invoice_templates SET is_default = FALSE WHERE id != NEW.id AND is_default = TRUE;
    END IF;
END$$

DELIMITER ;