-- Create billing_rates table for managing hourly billing rates
CREATE TABLE IF NOT EXISTS billing_rates (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    matter_type_id BIGINT UNSIGNED NULL,
    customer_id BIGINT UNSIGNED NULL,
    legal_case_id BIGINT UNSIGNED NULL,
    rate_type ENUM('STANDARD', 'PREMIUM', 'DISCOUNTED', 'EMERGENCY', 'PRO_BONO') NOT NULL DEFAULT 'STANDARD',
    rate_amount DECIMAL(10,2) NOT NULL,
    effective_date DATE NOT NULL,
    end_date DATE NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_billing_rates_user (user_id),
    INDEX idx_billing_rates_effective_date (effective_date),
    INDEX idx_billing_rates_active (is_active),
    INDEX idx_billing_rates_matter_type (matter_type_id),
    INDEX idx_billing_rates_customer (customer_id),
    INDEX idx_billing_rates_case (legal_case_id),
    INDEX idx_billing_rates_composite (user_id, effective_date, is_active),
    
    -- Foreign key constraints (if the referenced tables exist)
    CONSTRAINT fk_billing_rates_user 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_billing_rates_matter_type 
        FOREIGN KEY (matter_type_id) REFERENCES matter_types(id) ON DELETE SET NULL,
    CONSTRAINT fk_billing_rates_customer 
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    CONSTRAINT fk_billing_rates_case 
        FOREIGN KEY (legal_case_id) REFERENCES legal_cases(id) ON DELETE SET NULL
);

-- Create view for current active billing rates
CREATE OR REPLACE VIEW current_billing_rates AS
SELECT 
    br.*,
    u.first_name,
    u.last_name,
    u.email,
    mt.name as matter_type_name,
    c.name as customer_name,
    lc.case_name,
    lc.case_number
FROM billing_rates br
LEFT JOIN users u ON br.user_id = u.id
LEFT JOIN matter_types mt ON br.matter_type_id = mt.id
LEFT JOIN customers c ON br.customer_id = c.id
LEFT JOIN legal_cases lc ON br.legal_case_id = lc.id
WHERE br.is_active = TRUE 
  AND (br.effective_date IS NULL OR br.effective_date <= CURDATE())
  AND (br.end_date IS NULL OR br.end_date >= CURDATE());

-- Insert some default billing rates for existing users (if any)
INSERT IGNORE INTO billing_rates (user_id, rate_type, rate_amount, effective_date, is_active)
SELECT 
    id as user_id,
    'STANDARD' as rate_type,
    CASE 
        WHEN role = 'PARTNER' THEN 500.00
        WHEN role = 'SENIOR_ATTORNEY' THEN 400.00
        WHEN role = 'ATTORNEY' THEN 300.00
        WHEN role = 'ASSOCIATE' THEN 250.00
        WHEN role = 'PARALEGAL' THEN 150.00
        WHEN role = 'LEGAL_ASSISTANT' THEN 100.00
        ELSE 250.00
    END as rate_amount,
    CURDATE() as effective_date,
    TRUE as is_active
FROM users 
WHERE id NOT IN (SELECT DISTINCT user_id FROM billing_rates WHERE billing_rates.user_id IS NOT NULL); 