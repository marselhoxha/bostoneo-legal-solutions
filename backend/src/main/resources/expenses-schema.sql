-- Create ExpenseCategory table
CREATE TABLE IF NOT EXISTS ExpenseCategory (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) NOT NULL,
    parent_id BIGINT UNSIGNED,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES ExpenseCategory(id) ON DELETE SET NULL
);

-- Create Vendor table
CREATE TABLE IF NOT EXISTS Vendor (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    contact VARCHAR(255),
    tax_id VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create Receipt table
CREATE TABLE IF NOT EXISTS Receipt (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    thumbnail LONGBLOB,
    content LONGBLOB NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create Expense table
CREATE TABLE IF NOT EXISTS Expense (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    amount DECIMAL(19,4) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    date DATETIME NOT NULL,
    description TEXT,
    tax DECIMAL(19,4) DEFAULT 0,
    customer_id BIGINT UNSIGNED NOT NULL,
    invoice_id BIGINT UNSIGNED,
    legal_case_id BIGINT UNSIGNED,
    category_id BIGINT UNSIGNED NOT NULL,
    vendor_id BIGINT UNSIGNED NOT NULL,
    receipt_id BIGINT UNSIGNED,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES Customer(id) ON DELETE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES Invoice(id) ON DELETE SET NULL,
    FOREIGN KEY (legal_case_id) REFERENCES legal_cases(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES ExpenseCategory(id) ON DELETE RESTRICT,
    FOREIGN KEY (vendor_id) REFERENCES Vendor(id) ON DELETE RESTRICT,
    FOREIGN KEY (receipt_id) REFERENCES Receipt(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX idx_expense_customer_date ON Expense(customer_id, date);
CREATE INDEX idx_expense_category ON Expense(category_id);
CREATE INDEX idx_expense_vendor ON Expense(vendor_id);
CREATE INDEX idx_expense_invoice ON Expense(invoice_id);
CREATE INDEX idx_expense_legal_case ON Expense(legal_case_id);

-- Insert default expense categories
INSERT INTO ExpenseCategory (name, color) VALUES
('Travel', '#FF6B6B'),
('Meals', '#4ECDC4'),
('Office Supplies', '#45B7D1'),
('Professional Services', '#96CEB4'),
('Equipment', '#FFEEAD'),
('Software', '#D4A5A5'),
('Marketing', '#9B59B6'),
('Training', '#3498DB'),
('Other', '#95A5A6'); 