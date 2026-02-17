-- Create PI Provider Directory table and add sample data
-- This table stores reusable medical provider contact information

-- Create table if not exists
CREATE TABLE IF NOT EXISTS bostoneosolutions.pi_provider_directory (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    provider_name VARCHAR(255) NOT NULL,
    provider_type VARCHAR(100),
    npi VARCHAR(20),
    main_phone VARCHAR(50),
    main_email VARCHAR(255),
    main_fax VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),
    records_contact_name VARCHAR(255),
    records_phone VARCHAR(50),
    records_email VARCHAR(255),
    records_fax VARCHAR(50),
    billing_contact_name VARCHAR(255),
    billing_phone VARCHAR(50),
    billing_email VARCHAR(255),
    billing_fax VARCHAR(50),
    base_fee DECIMAL(10, 2),
    per_page_fee DECIMAL(10, 2),
    rush_fee DECIMAL(10, 2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT
);

-- Create index on organization_id for tenant filtering
CREATE INDEX IF NOT EXISTS idx_pi_provider_directory_org ON bostoneosolutions.pi_provider_directory(organization_id);

-- Sample Provider Directory entries for PI practice
-- These are fictional providers for demonstration purposes

INSERT INTO bostoneosolutions.pi_provider_directory (
    organization_id, provider_name, provider_type, npi,
    main_phone, main_email, main_fax,
    address, city, state, zip,
    records_contact_name, records_phone, records_email, records_fax,
    billing_contact_name, billing_phone, billing_email, billing_fax,
    base_fee, per_page_fee, rush_fee, notes,
    created_at, updated_at
) VALUES
-- Team Rehab and Wellness Center
(1, 'Team Rehab and Wellness Center', 'PHYSICAL_THERAPY', '1234567890',
 '6175551234', 'info@teamrehabwellness.com', '6175551235',
 '125 Wellness Drive', 'Boston', 'MA', '02115',
 'Sarah Johnson', '6175551236', 'records@teamrehabwellness.com', '6175551235',
 'Michael Chen', '6175551237', 'billing@teamrehabwellness.com', '6175551235',
 25.00, 0.50, 50.00, 'Excellent turnaround time. Usually 5-7 business days. Contact Sarah directly for urgent requests.',
 NOW(), NOW()),

-- Massachusetts General Hospital
(1, 'Massachusetts General Hospital', 'HOSPITAL', '1467890123',
 '6177262000', 'info@partners.org', '6177263000',
 '55 Fruit Street', 'Boston', 'MA', '02114',
 'Medical Records Dept', '6177264800', 'medicalrecords@partners.org', '6177264801',
 'Patient Financial Services', '6177265500', 'billing@partners.org', '6177265501',
 35.00, 0.75, 75.00, 'Large hospital - expect 2-3 weeks for records. Authorization form required.',
 NOW(), NOW()),

-- Boston Spine & Sport
(1, 'Boston Spine & Sport', 'CHIROPRACTIC', '1987654321',
 '6175559876', 'frontdesk@bostonspinesport.com', '6175559877',
 '789 Commonwealth Ave', 'Boston', 'MA', '02215',
 'Lisa Martinez', '6175559878', 'records@bostonspinesport.com', '6175559877',
 'Lisa Martinez', '6175559879', 'billing@bostonspinesport.com', '6175559877',
 20.00, 0.25, 40.00, 'Small practice - very responsive. Same person handles records and billing.',
 NOW(), NOW()),

-- New England Baptist Hospital
(1, 'New England Baptist Hospital', 'HOSPITAL', '1122334455',
 '6177545000', 'info@nebh.org', '6177545001',
 '125 Parker Hill Ave', 'Boston', 'MA', '02120',
 'Health Information Mgmt', '6177546300', 'him@nebh.org', '6177546301',
 'Patient Accounts', '6177546400', 'patientaccounts@nebh.org', '6177546401',
 30.00, 0.65, 60.00, 'Orthopedic specialty hospital. Online portal available for record requests.',
 NOW(), NOW()),

-- Advanced Imaging Center
(1, 'Advanced Imaging Center', 'IMAGING', '1555666777',
 '6175554567', 'info@advancedimaging.com', '6175554568',
 '300 Longwood Ave', 'Boston', 'MA', '02115',
 'Imaging Records', '6175554569', 'records@advancedimaging.com', '6175554568',
 'Billing Department', '6175554570', 'billing@advancedimaging.com', '6175554568',
 15.00, 1.00, 35.00, 'MRI, CT, X-ray. CD of images included with record request at no extra charge.',
 NOW(), NOW()),

-- Cambridge Health Alliance - Primary Care
(1, 'Cambridge Health Alliance', 'CLINIC', '1666777888',
 '6176651000', 'info@challiance.org', '6176651001',
 '1493 Cambridge St', 'Cambridge', 'MA', '02139',
 'Release of Information', '6176652300', 'roi@challiance.org', '6176652301',
 'Patient Financial Services', '6176652400', 'billing@challiance.org', '6176652401',
 25.00, 0.50, 50.00, 'Community health system. Multiple locations - specify which clinic on request.',
 NOW(), NOW()),

-- Newton-Wellesley Hospital
(1, 'Newton-Wellesley Hospital', 'HOSPITAL', '1888999000',
 '6172435000', 'info@nwh.org', '6172435001',
 '2014 Washington St', 'Newton', 'MA', '02462',
 'Medical Records', '6172436100', 'medrecords@nwh.org', '6172436101',
 'Patient Accounts', '6172436200', 'billing@nwh.org', '6172436201',
 30.00, 0.60, 55.00, 'Part of Mass General Brigham network. Can request through Partners portal.',
 NOW(), NOW()),

-- Boston Physical Therapy & Wellness
(1, 'Boston Physical Therapy & Wellness', 'PHYSICAL_THERAPY', '1999888777',
 '6175558888', 'hello@bostonptwellness.com', '6175558889',
 '45 Province St', 'Boston', 'MA', '02108',
 'Office Manager', '6175558890', 'records@bostonptwellness.com', '6175558889',
 'Office Manager', '6175558890', 'billing@bostonptwellness.com', '6175558889',
 15.00, 0.25, 30.00, 'Downtown location. Quick turnaround - usually 3-5 business days.',
 NOW(), NOW()),

-- Brigham and Women's Hospital
(1, 'Brigham and Women''s Hospital', 'HOSPITAL', '1111222333',
 '6177325000', 'info@bwh.harvard.edu', '6177325001',
 '75 Francis St', 'Boston', 'MA', '02115',
 'Health Info Management', '6177325500', 'him@bwh.harvard.edu', '6177325501',
 'Patient Financial Services', '6177325600', 'pfs@bwh.harvard.edu', '6177325601',
 35.00, 0.75, 75.00, 'Major teaching hospital. Complex cases may require additional authorization.',
 NOW(), NOW()),

-- CVS Pharmacy - Back Bay
(1, 'CVS Pharmacy - Back Bay', 'PHARMACY', '1444555666',
 '6172665300', NULL, '6172665301',
 '231 Newbury St', 'Boston', 'MA', '02116',
 'Pharmacy Manager', '6172665302', 'pharmacy8571@cvs.com', '6172665301',
 NULL, NULL, NULL, NULL,
 10.00, 0.25, 20.00, 'Can provide medication history printout. Call ahead to request.',
 NOW(), NOW())

ON CONFLICT DO NOTHING;
