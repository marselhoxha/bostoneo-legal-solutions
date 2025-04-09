-- Clear existing data
SET FOREIGN_KEY_CHECKS=0;
DELETE FROM Invoice;
DELETE FROM Customer;
SET FOREIGN_KEY_CHECKS=1;

-- Insert 100 customers with realistic data
INSERT INTO Customer (id, name, email, type, status, address, phone, image_url, created_at) VALUES
(1, 'Tech Solutions Inc', 'contact@techsolutions.com', 'BUSINESS', 'ACTIVE', '123 Main St, Boston, MA 02108', '(617) 555-0101', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&auto=format', NOW()),
(2, 'Green Earth Cafe', 'info@greenearthcafe.com', 'BUSINESS', 'ACTIVE', '456 Boylston St, Boston, MA 02116', '(617) 555-0102', 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=500&auto=format', NOW()),
(3, 'Boston Legal Group', 'contact@bostonlegal.com', 'BUSINESS', 'ACTIVE', '789 Beacon St, Boston, MA 02215', '(617) 555-0103', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&auto=format', NOW()),
(4, 'Fitness First', 'info@fitnessfirst.com', 'BUSINESS', 'ACTIVE', '321 Newbury St, Boston, MA 02115', '(617) 555-0104', 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=500&auto=format', NOW()),
(5, 'Creative Design Studio', 'hello@creativestudio.com', 'BUSINESS', 'ACTIVE', '654 Tremont St, Boston, MA 02118', '(617) 555-0105', 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=500&auto=format', NOW());

-- Generate 95 more customers dynamically
DELIMITER //
CREATE PROCEDURE GenerateCustomers()
BEGIN
    DECLARE i INT DEFAULT 6;
    WHILE i <= 100 DO
        INSERT INTO Customer (id, name, email, type, status, address, phone, image_url, created_at)
        SELECT 
            i,
            CASE 
                WHEN i % 2 = 0 THEN CONCAT('Business Corp ', i)
                ELSE CONCAT('Individual Client ', i)
            END,
            CONCAT('contact', i, '@email.com'),
            CASE 
                WHEN i % 2 = 0 THEN 'BUSINESS'
                ELSE 'INDIVIDUAL'
            END,
            'ACTIVE',
            CONCAT(i, ' Business Ave, Boston, MA ', LPAD(FLOOR(RAND() * 99999), 5, '0')),
            CONCAT('(617) 555-', LPAD(i, 4, '0')),
            CASE 
                WHEN i % 2 = 0 THEN -- Business avatars
                    CASE 
                        WHEN i % 5 = 0 THEN 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&auto=format'
                        WHEN i % 5 = 1 THEN 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&auto=format'
                        WHEN i % 5 = 2 THEN 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=500&auto=format'
                        WHEN i % 5 = 3 THEN 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=500&auto=format'
                        ELSE 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=500&auto=format'
                    END
                ELSE -- Individual avatars
                    CASE 
                        WHEN i % 5 = 0 THEN 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format'
                        WHEN i % 5 = 1 THEN 'https://images.unsplash.com/photo-1494790108377-be9c29d29330?w=500&auto=format'
                        WHEN i % 5 = 2 THEN 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format'
                        WHEN i % 5 = 3 THEN 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&auto=format'
                        ELSE 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format'
                    END
            END,
            NOW();
        SET i = i + 1;
    END WHILE;
END //
DELIMITER ;

CALL GenerateCustomers();
DROP PROCEDURE GenerateCustomers;

-- Insert invoices with realistic data (one per customer)
INSERT INTO Invoice (customer_id, invoice_number, total, status, services, date)
SELECT 
    id as customer_id,
    CONCAT('INV-2024-', LPAD(id, 3, '0')) as invoice_number,
    ROUND(1000 + RAND() * 9000, 2) as total,
    CASE 
        WHEN id % 2 = 0 THEN 'PAID'
        ELSE 'PENDING'
    END as status,
    CASE 
        WHEN id % 5 = 0 THEN 'Web Development'
        WHEN id % 5 = 1 THEN 'Consulting Services'
        WHEN id % 5 = 2 THEN 'Design Services'
        WHEN id % 5 = 3 THEN 'Marketing Services'
        ELSE 'Technical Support'
    END as services,
    CASE 
        WHEN id % 2 = 0 THEN DATE_SUB(NOW(), INTERVAL FLOOR(1 + RAND() * 60) DAY)
        ELSE DATE_ADD(NOW(), INTERVAL FLOOR(1 + RAND() * 30) DAY)
    END as date
FROM Customer; 