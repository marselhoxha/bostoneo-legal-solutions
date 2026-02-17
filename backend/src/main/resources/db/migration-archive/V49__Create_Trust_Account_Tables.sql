-- Create trust accounts table
CREATE TABLE trust_accounts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    account_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(50) UNIQUE,
    bank_name VARCHAR(100),
    routing_number VARCHAR(20),
    account_type VARCHAR(50), -- IOLTA, NON_IOLTA, OPERATING
    current_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    minimum_balance DECIMAL(12,2),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_reconciliation_date TIMESTAMP NULL,
    notes TEXT,
    created_by BIGINT UNSIGNED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_account_active (is_active),
    INDEX idx_account_type (account_type)
);

-- Create trust account transactions table
CREATE TABLE trust_account_transactions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trust_account_id BIGINT UNSIGNED NOT NULL,
    client_id BIGINT UNSIGNED NOT NULL,
    legal_case_id BIGINT UNSIGNED,
    transaction_type VARCHAR(50) NOT NULL, -- DEPOSIT, WITHDRAWAL, TRANSFER, FEE, INTEREST
    amount DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(12,2) NOT NULL,
    transaction_date DATE NOT NULL,
    reference_number VARCHAR(100),
    description VARCHAR(500) NOT NULL,
    related_invoice_id BIGINT UNSIGNED,
    check_number VARCHAR(50),
    payee_name VARCHAR(200),
    is_cleared BOOLEAN NOT NULL DEFAULT FALSE,
    cleared_date DATE,
    reconciliation_id BIGINT UNSIGNED,
    notes TEXT,
    created_by BIGINT UNSIGNED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (trust_account_id) REFERENCES trust_accounts(id),
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (legal_case_id) REFERENCES legal_cases(id),
    FOREIGN KEY (related_invoice_id) REFERENCES invoices(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    
    INDEX idx_trust_trans_account (trust_account_id),
    INDEX idx_trust_trans_client (client_id),
    INDEX idx_trust_trans_case (legal_case_id),
    INDEX idx_trust_trans_date (transaction_date),
    INDEX idx_trust_trans_cleared (is_cleared),
    INDEX idx_reconciliation (reconciliation_id)
);

-- Create client trust balances view
CREATE VIEW client_trust_balances AS
SELECT 
    c.id as client_id,
    c.name as client_name,
    ta.id as trust_account_id,
    ta.account_name,
    COALESCE(SUM(CASE 
        WHEN tat.transaction_type IN ('DEPOSIT', 'INTEREST') THEN tat.amount 
        WHEN tat.transaction_type IN ('WITHDRAWAL', 'FEE', 'TRANSFER') THEN -tat.amount 
        ELSE 0 
    END), 0) as balance
FROM clients c
CROSS JOIN trust_accounts ta
LEFT JOIN trust_account_transactions tat ON c.id = tat.client_id AND ta.id = tat.trust_account_id
WHERE ta.is_active = TRUE
GROUP BY c.id, c.name, ta.id, ta.account_name;

-- Add trust account permissions
INSERT INTO authorities (name, description, created_at, updated_at) VALUES
('READ:TRUST_ACCOUNT', 'Can view trust accounts', NOW(), NOW()),
('CREATE:TRUST_ACCOUNT', 'Can create trust accounts', NOW(), NOW()),
('UPDATE:TRUST_ACCOUNT', 'Can update trust accounts', NOW(), NOW()),
('DELETE:TRUST_ACCOUNT', 'Can delete trust accounts', NOW(), NOW()),
('RECONCILE:TRUST_ACCOUNT', 'Can reconcile trust accounts', NOW(), NOW());

-- Grant permissions to Admin role
INSERT INTO role_authorities (role_id, authority_id)
SELECT r.id, a.id 
FROM roles r, authorities a 
WHERE r.code = 'ADMIN' 
AND a.name IN ('READ:TRUST_ACCOUNT', 'CREATE:TRUST_ACCOUNT', 'UPDATE:TRUST_ACCOUNT', 'DELETE:TRUST_ACCOUNT', 'RECONCILE:TRUST_ACCOUNT');