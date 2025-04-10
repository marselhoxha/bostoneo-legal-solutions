-- Clear existing data
SET FOREIGN_KEY_CHECKS=0;
DELETE FROM Invoice;
DELETE FROM Customer;
SET FOREIGN_KEY_CHECKS=1;

-- Insert 100 customers with realistic data
DROP PROCEDURE IF EXISTS generate_customers;
DELIMITER //
CREATE PROCEDURE generate_customers()
BEGIN
    DECLARE i INT DEFAULT 1;
    WHILE i <= 100 DO
        INSERT INTO Customer (name, email, type, status, address, phone, imageUrl, createdAt)
        VALUES (
            CASE 
                WHEN i % 2 = 0 THEN CONCAT('Business Corp ', i)
                ELSE CONCAT('Individual Client ', i)
            END,
            CONCAT('contact', i, '@', 
                CASE 
                    WHEN i % 3 = 0 THEN 'techsolutions.com'
                    WHEN i % 3 = 1 THEN 'legalgroup.com'
                    ELSE 'businesscorp.com'
                END
            ),
            CASE 
                WHEN i % 2 = 0 THEN 'BUSINESS'
                ELSE 'INDIVIDUAL'
            END,
            'ACTIVE',
            CONCAT(i, ' ', 
                CASE 
                    WHEN i % 4 = 0 THEN 'Main St'
                    WHEN i % 4 = 1 THEN 'Broadway Ave'
                    WHEN i % 4 = 2 THEN 'Park Rd'
                    ELSE 'Market St'
                END,
                ', Boston, MA ', 
                LPAD(FLOOR(RAND() * 99999), 5, '0')
            ),
            CONCAT('(617) 555-', LPAD(i, 4, '0')),
            CASE 
                WHEN i % 2 = 0 THEN 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&auto=format'
                ELSE 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format'
            END,
            NOW()
        );
        SET i = i + 1;
    END WHILE;
END //
DELIMITER ;

CALL generate_customers();
DROP PROCEDURE generate_customers;

-- Insert invoices with realistic data (three per customer)
INSERT INTO Invoice (customer_id, invoiceNumber, total, status, services, date)
SELECT 
    id as customer_id,
    CONCAT('INV-2024-', LPAD(id, 3, '0'), '-01') as invoiceNumber,
    ROUND(1000 + RAND() * 9000, 2) as total,
    CASE 
        WHEN id % 3 = 0 THEN 'PAID'
        WHEN id % 3 = 1 THEN 'PENDING'
        ELSE 'OVERDUE'
    END as status,
    CASE 
        WHEN id % 5 = 0 THEN 'Legal Services'
        WHEN id % 5 = 1 THEN 'Consulting Services'
        WHEN id % 5 = 2 THEN 'Design Services'
        WHEN id % 5 = 3 THEN 'Marketing Services'
        ELSE 'Technical Support'
    END as services,
    DATE_SUB(NOW(), INTERVAL FLOOR(1 + RAND() * 60) DAY) as date
FROM Customer;

-- Insert second invoice for each customer
INSERT INTO Invoice (customer_id, invoiceNumber, total, status, services, date)
SELECT 
    id as customer_id,
    CONCAT('INV-2024-', LPAD(id, 3, '0'), '-02') as invoiceNumber,
    ROUND(500 + RAND() * 5000, 2) as total,
    CASE 
        WHEN id % 3 = 0 THEN 'PENDING'
        WHEN id % 3 = 1 THEN 'PAID'
        ELSE 'OVERDUE'
    END as status,
    CASE 
        WHEN id % 5 = 0 THEN 'Web Development'
        WHEN id % 5 = 1 THEN 'Financial Advisory'
        WHEN id % 5 = 2 THEN 'Content Creation'
        WHEN id % 5 = 3 THEN 'SEO Services'
        ELSE 'IT Support'
    END as services,
    DATE_SUB(NOW(), INTERVAL FLOOR(1 + RAND() * 30) DAY) as date
FROM Customer;

-- Insert third invoice for each customer
INSERT INTO Invoice (customer_id, invoiceNumber, total, status, services, date)
SELECT 
    id as customer_id,
    CONCAT('INV-2024-', LPAD(id, 3, '0'), '-03') as invoiceNumber,
    ROUND(2000 + RAND() * 8000, 2) as total,
    CASE 
        WHEN id % 3 = 0 THEN 'OVERDUE'
        WHEN id % 3 = 1 THEN 'PENDING'
        ELSE 'PAID'
    END as status,
    CASE 
        WHEN id % 5 = 0 THEN 'Project Management'
        WHEN id % 5 = 1 THEN 'HR Consulting'
        WHEN id % 5 = 2 THEN 'Brand Strategy'
        WHEN id % 5 = 3 THEN 'Social Media Management'
        ELSE 'Cloud Services'
    END as services,
    DATE_SUB(NOW(), INTERVAL FLOOR(1 + RAND() * 90) DAY) as date
FROM Customer; 