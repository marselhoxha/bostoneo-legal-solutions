-- Create payment transactions table for ACH/Wire transfer tracking
CREATE TABLE payment_transactions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    invoice_id BIGINT UNSIGNED NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    transaction_status VARCHAR(50) DEFAULT 'PENDING',
    amount DECIMAL(10,2) NOT NULL,
    routing_number VARCHAR(20),
    account_number_last4 VARCHAR(4),
    wire_reference VARCHAR(100),
    bank_name VARCHAR(100),
    processing_date DATE,
    completion_date DATE,
    reference_number VARCHAR(100),
    notes TEXT,
    created_by BIGINT UNSIGNED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (invoice_id) REFERENCES invoices(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    
    INDEX idx_transaction_invoice (invoice_id),
    INDEX idx_transaction_status (transaction_status),
    INDEX idx_transaction_type (transaction_type),
    INDEX idx_processing_date (processing_date)
);

-- Add payment transaction permissions
INSERT INTO permissions (name, description, resource_type, action_type, permission_category, is_contextual, created_at, updated_at) VALUES
('READ:PAYMENT_TRANSACTION', 'Can view payment transactions', 'PAYMENT_TRANSACTION', 'READ', 'FINANCIAL', 0, NOW(), NOW()),
('CREATE:PAYMENT_TRANSACTION', 'Can create payment transactions', 'PAYMENT_TRANSACTION', 'CREATE', 'FINANCIAL', 0, NOW(), NOW()),
('UPDATE:PAYMENT_TRANSACTION', 'Can update payment transactions', 'PAYMENT_TRANSACTION', 'UPDATE', 'FINANCIAL', 0, NOW(), NOW()),
('DELETE:PAYMENT_TRANSACTION', 'Can delete payment transactions', 'PAYMENT_TRANSACTION', 'DELETE', 'FINANCIAL', 0, NOW(), NOW());

-- Grant permissions to Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'ADMIN' 
AND p.name IN ('READ:PAYMENT_TRANSACTION', 'CREATE:PAYMENT_TRANSACTION', 'UPDATE:PAYMENT_TRANSACTION', 'DELETE:PAYMENT_TRANSACTION');