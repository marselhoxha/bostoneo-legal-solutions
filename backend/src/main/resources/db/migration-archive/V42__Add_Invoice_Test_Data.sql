-- Insert test invoices with realistic data
-- Note: This assumes you have clients with IDs 1-5 and legal cases with IDs 1-5
-- Adjust the client_id and legal_case_id values based on your existing data

-- Invoice 1: Paid invoice for corporate litigation
INSERT INTO invoice (invoice_number, client_id, legal_case_id, issue_date, due_date, status, subtotal, tax_rate, tax_amount, total_amount, notes, created_at, updated_at)
VALUES ('INV-2024-001', 1, 1, '2024-01-15', '2024-02-15', 'PAID', 12500.00, 8.875, 1109.38, 13609.38, 
        'Legal services for January 2024 - Corporate litigation matter', NOW(), NOW());

-- Invoice 2: Pending invoice for estate planning
INSERT INTO invoice (invoice_number, client_id, legal_case_id, issue_date, due_date, status, subtotal, tax_rate, tax_amount, total_amount, notes, created_at, updated_at)
VALUES ('INV-2024-002', 2, 2, '2024-02-01', '2024-03-01', 'PENDING', 3500.00, 8.875, 310.63, 3810.63,
        'Estate planning services - Will and trust preparation', NOW(), NOW());

-- Invoice 3: Overdue invoice for real estate transaction
INSERT INTO invoice (invoice_number, client_id, legal_case_id, issue_date, due_date, status, subtotal, tax_rate, tax_amount, total_amount, notes, created_at, updated_at)
VALUES ('INV-2024-003', 3, 3, '2023-12-15', '2024-01-15', 'OVERDUE', 8750.00, 8.875, 776.56, 9526.56,
        'Real estate closing and title review services', NOW(), NOW());

-- Invoice 4: Draft invoice for intellectual property case
INSERT INTO invoice (invoice_number, client_id, legal_case_id, issue_date, due_date, status, subtotal, tax_rate, tax_amount, total_amount, notes, created_at, updated_at)
VALUES ('INV-2024-004', 1, 4, '2024-02-10', '2024-03-10', 'DRAFT', 15000.00, 8.875, 1331.25, 16331.25,
        'Patent application and IP consultation services', NOW(), NOW());

-- Invoice 5: Paid invoice for family law matter
INSERT INTO invoice (invoice_number, client_id, legal_case_id, issue_date, due_date, status, subtotal, tax_rate, tax_amount, total_amount, notes, created_at, updated_at)
VALUES ('INV-2024-005', 4, 5, '2024-01-01', '2024-01-31', 'PAID', 5600.00, 8.875, 497.00, 6097.00,
        'Divorce proceedings and custody arrangement', NOW(), NOW());

-- Invoice 6: Pending invoice for criminal defense
INSERT INTO invoice (invoice_number, client_id, legal_case_id, issue_date, due_date, status, subtotal, tax_rate, tax_amount, total_amount, notes, created_at, updated_at)
VALUES ('INV-2024-006', 5, 1, '2024-02-05', '2024-03-05', 'PENDING', 18500.00, 8.875, 1641.88, 20141.88,
        'Criminal defense representation - February services', NOW(), NOW());

-- Invoice 7: Paid invoice for contract review
INSERT INTO invoice (invoice_number, client_id, legal_case_id, issue_date, due_date, status, subtotal, tax_rate, tax_amount, total_amount, notes, created_at, updated_at)
VALUES ('INV-2023-107', 2, 3, '2023-11-15', '2023-12-15', 'PAID', 2800.00, 8.875, 248.50, 3048.50,
        'Contract review and negotiation services', NOW(), NOW());

-- Invoice 8: Cancelled invoice
INSERT INTO invoice (invoice_number, client_id, legal_case_id, issue_date, due_date, status, subtotal, tax_rate, tax_amount, total_amount, notes, created_at, updated_at)
VALUES ('INV-2023-108', 3, 2, '2023-10-01', '2023-10-31', 'CANCELLED', 4200.00, 8.875, 372.75, 4572.75,
        'Initial consultation - Client decided not to proceed', NOW(), NOW());

-- Invoice 9: Recent pending invoice
INSERT INTO invoice (invoice_number, client_id, legal_case_id, issue_date, due_date, status, subtotal, tax_rate, tax_amount, total_amount, notes, created_at, updated_at)
VALUES ('INV-2024-007', 1, 2, CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '25 days', 'PENDING', 9800.00, 8.875, 869.75, 10669.75,
        'Ongoing litigation support and document review', NOW(), NOW());

-- Invoice 10: Large paid invoice
INSERT INTO invoice (invoice_number, client_id, legal_case_id, issue_date, due_date, status, subtotal, tax_rate, tax_amount, total_amount, notes, created_at, updated_at)
VALUES ('INV-2023-095', 4, 4, '2023-09-01', '2023-10-01', 'PAID', 45000.00, 8.875, 3993.75, 48993.75,
        'Complex merger and acquisition legal services', NOW(), NOW());

-- Add some invoice items for better detail (for first 3 invoices)
-- Invoice 1 items
INSERT INTO invoice_item (invoice_id, description, quantity, unit_price, amount, created_at)
SELECT id, 'Senior Partner Consultation (hours)', 25, 350.00, 8750.00, NOW()
FROM invoice WHERE invoice_number = 'INV-2024-001';

INSERT INTO invoice_item (invoice_id, description, quantity, unit_price, amount, created_at)
SELECT id, 'Associate Attorney Services (hours)', 15, 250.00, 3750.00, NOW()
FROM invoice WHERE invoice_number = 'INV-2024-001';

-- Invoice 2 items
INSERT INTO invoice_item (invoice_id, description, quantity, unit_price, amount, created_at)
SELECT id, 'Will Preparation', 1, 1500.00, 1500.00, NOW()
FROM invoice WHERE invoice_number = 'INV-2024-002';

INSERT INTO invoice_item (invoice_id, description, quantity, unit_price, amount, created_at)
SELECT id, 'Trust Documentation', 1, 2000.00, 2000.00, NOW()
FROM invoice WHERE invoice_number = 'INV-2024-002';

-- Invoice 3 items
INSERT INTO invoice_item (invoice_id, description, quantity, unit_price, amount, created_at)
SELECT id, 'Title Review and Analysis', 1, 3500.00, 3500.00, NOW()
FROM invoice WHERE invoice_number = 'INV-2024-003';

INSERT INTO invoice_item (invoice_id, description, quantity, unit_price, amount, created_at)
SELECT id, 'Closing Preparation and Attendance', 1, 5250.00, 5250.00, NOW()
FROM invoice WHERE invoice_number = 'INV-2024-003';