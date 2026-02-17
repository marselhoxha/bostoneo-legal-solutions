-- Add more official PDF forms for different practice areas

-- USCIS Immigration Forms
INSERT INTO ai_legal_templates (
    name, description, category, practice_area, jurisdiction,
    ma_jurisdiction_specific, template_type, pdf_form_url,
    is_approved, is_public, created_by, created_at, updated_at
) VALUES
(
    'USCIS Form I-485 - Application to Register Permanent Residence',
    'Official USCIS form for applying for permanent residence in the United States',
    'IMMIGRATION_FORM',
    'Immigration Law',
    'Federal',
    FALSE,
    'PDF_FORM',
    'https://www.uscis.gov/sites/default/files/document/forms/i-485.pdf',
    TRUE,
    TRUE,
    1,
    NOW(),
    NOW()
),
(
    'USCIS Form I-765 - Application for Employment Authorization',
    'Official USCIS form for applying for work authorization in the United States',
    'IMMIGRATION_FORM',
    'Immigration Law',
    'Federal',
    FALSE,
    'PDF_FORM',
    'https://www.uscis.gov/sites/default/files/document/forms/i-765.pdf',
    TRUE,
    TRUE,
    1,
    NOW(),
    NOW()
),
(
    'USCIS Form I-90 - Application to Replace Permanent Resident Card',
    'Official USCIS form for replacing or renewing a permanent resident card',
    'IMMIGRATION_FORM',
    'Immigration Law',
    'Federal',
    FALSE,
    'PDF_FORM',
    'https://www.uscis.gov/sites/default/files/document/forms/i-90.pdf',
    TRUE,
    TRUE,
    1,
    NOW(),
    NOW()
),

-- Massachusetts Family Law Forms
(
    'Massachusetts Divorce Complaint Form (CJ-D 101)',
    'Massachusetts Probate and Family Court divorce complaint form',
    'PLEADING',
    'Family Law',
    'Massachusetts',
    TRUE,
    'PDF_FORM',
    'https://www.mass.gov/doc/divorce-complaint-cj-d-101/download',
    TRUE,
    TRUE,
    1,
    NOW(),
    NOW()
),
(
    'Massachusetts Child Support Guidelines Worksheet',
    'Massachusetts child support calculation worksheet',
    'CALCULATION',
    'Family Law',
    'Massachusetts',
    TRUE,
    'PDF_FORM',
    'https://www.mass.gov/doc/child-support-guidelines-worksheet/download',
    TRUE,
    TRUE,
    1,
    NOW(),
    NOW()
),

-- Massachusetts Real Estate Forms
(
    'Massachusetts Purchase and Sale Agreement',
    'Standard Massachusetts real estate purchase and sale agreement',
    'CONTRACT',
    'Real Estate Law',
    'Massachusetts',
    TRUE,
    'PDF_FORM',
    'https://www.marealtor.com/forms/purchase-and-sale-agreement.pdf',
    TRUE,
    TRUE,
    1,
    NOW(),
    NOW()
),
(
    'Massachusetts Residential Lease Agreement',
    'Standard Massachusetts residential lease agreement form',
    'CONTRACT',
    'Real Estate Law',
    'Massachusetts',
    TRUE,
    'PDF_FORM',
    'https://www.mass.gov/doc/standard-form-lease/download',
    TRUE,
    TRUE,
    1,
    NOW(),
    NOW()
),

-- Massachusetts Criminal Defense Forms
(
    'Massachusetts Motion to Suppress Evidence',
    'Motion to suppress evidence in Massachusetts criminal cases',
    'MOTION',
    'Criminal Defense',
    'Massachusetts',
    TRUE,
    'PDF_FORM',
    'https://www.mass.gov/doc/motion-to-suppress-evidence/download',
    TRUE,
    TRUE,
    1,
    NOW(),
    NOW()
),
(
    'Massachusetts Motion for Discovery',
    'Motion for discovery in Massachusetts criminal cases',
    'MOTION',
    'Criminal Defense',
    'Massachusetts',
    TRUE,
    'PDF_FORM',
    'https://www.mass.gov/doc/motion-for-discovery/download',
    TRUE,
    TRUE,
    1,
    NOW(),
    NOW()
);

-- Get template IDs for field mapping
SET @i485_template_id = (SELECT id FROM ai_legal_templates WHERE name LIKE '%I-485%' LIMIT 1);
SET @i765_template_id = (SELECT id FROM ai_legal_templates WHERE name LIKE '%I-765%' LIMIT 1);
SET @i90_template_id = (SELECT id FROM ai_legal_templates WHERE name LIKE '%I-90%' LIMIT 1);
SET @divorce_template_id = (SELECT id FROM ai_legal_templates WHERE name LIKE '%Divorce Complaint%' LIMIT 1);
SET @child_support_template_id = (SELECT id FROM ai_legal_templates WHERE name LIKE '%Child Support%' LIMIT 1);
SET @purchase_sale_template_id = (SELECT id FROM ai_legal_templates WHERE name LIKE '%Purchase and Sale%' LIMIT 1);
SET @lease_template_id = (SELECT id FROM ai_legal_templates WHERE name LIKE '%Residential Lease%' LIMIT 1);
SET @motion_suppress_template_id = (SELECT id FROM ai_legal_templates WHERE name LIKE '%Motion to Suppress%' LIMIT 1);
SET @motion_discovery_template_id = (SELECT id FROM ai_legal_templates WHERE name LIKE '%Motion for Discovery%' LIMIT 1);

-- I-485 Form Fields
INSERT INTO ai_pdf_form_fields (
    template_id, pdf_field_name, case_data_path, field_type,
    is_required, display_order, created_at
) VALUES
(@i485_template_id, 'family_name', 'clientName', 'TEXT', TRUE, 1, NOW()),
(@i485_template_id, 'given_name', 'clientFirstName', 'TEXT', TRUE, 2, NOW()),
(@i485_template_id, 'middle_name', 'clientMiddleName', 'TEXT', FALSE, 3, NOW()),
(@i485_template_id, 'date_of_birth', 'clientDateOfBirth', 'DATE', TRUE, 4, NOW()),
(@i485_template_id, 'country_of_birth', 'clientCountryOfBirth', 'TEXT', TRUE, 5, NOW()),
(@i485_template_id, 'alien_number', 'alienNumber', 'TEXT', FALSE, 6, NOW());

-- I-765 Form Fields
INSERT INTO ai_pdf_form_fields (
    template_id, pdf_field_name, case_data_path, field_type,
    is_required, display_order, created_at
) VALUES
(@i765_template_id, 'family_name', 'clientName', 'TEXT', TRUE, 1, NOW()),
(@i765_template_id, 'given_name', 'clientFirstName', 'TEXT', TRUE, 2, NOW()),
(@i765_template_id, 'address', 'clientAddress', 'TEXT', TRUE, 3, NOW()),
(@i765_template_id, 'eligibility_category', 'eligibilityCategory', 'TEXT', TRUE, 4, NOW()),
(@i765_template_id, 'social_security_number', 'clientSSN', 'TEXT', FALSE, 5, NOW());

-- Massachusetts Divorce Form Fields
INSERT INTO ai_pdf_form_fields (
    template_id, pdf_field_name, case_data_path, field_type,
    is_required, display_order, created_at
) VALUES
(@divorce_template_id, 'plaintiff_name', 'clientName', 'TEXT', TRUE, 1, NOW()),
(@divorce_template_id, 'defendant_name', 'spouseName', 'TEXT', TRUE, 2, NOW()),
(@divorce_template_id, 'marriage_date', 'marriageDate', 'DATE', TRUE, 3, NOW()),
(@divorce_template_id, 'separation_date', 'separationDate', 'DATE', FALSE, 4, NOW()),
(@divorce_template_id, 'minor_children', 'hasMinorChildren', 'CHECKBOX', FALSE, 5, NOW()),
(@divorce_template_id, 'grounds_for_divorce', 'groundsForDivorce', 'TEXT', TRUE, 6, NOW());

-- Massachusetts Lease Agreement Fields
INSERT INTO ai_pdf_form_fields (
    template_id, pdf_field_name, case_data_path, field_type,
    is_required, display_order, created_at
) VALUES
(@lease_template_id, 'landlord_name', 'landlordName', 'TEXT', TRUE, 1, NOW()),
(@lease_template_id, 'tenant_name', 'tenantName', 'TEXT', TRUE, 2, NOW()),
(@lease_template_id, 'property_address', 'propertyAddress', 'TEXT', TRUE, 3, NOW()),
(@lease_template_id, 'lease_term', 'leaseTerm', 'TEXT', TRUE, 4, NOW()),
(@lease_template_id, 'monthly_rent', 'monthlyRent', 'TEXT', TRUE, 5, NOW()),
(@lease_template_id, 'security_deposit', 'securityDeposit', 'TEXT', TRUE, 6, NOW()),
(@lease_template_id, 'lease_start_date', 'leaseStartDate', 'DATE', TRUE, 7, NOW()),
(@lease_template_id, 'lease_end_date', 'leaseEndDate', 'DATE', TRUE, 8, NOW());

-- Purchase and Sale Agreement Fields
INSERT INTO ai_pdf_form_fields (
    template_id, pdf_field_name, case_data_path, field_type,
    is_required, display_order, created_at
) VALUES
(@purchase_sale_template_id, 'buyer_name', 'buyerName', 'TEXT', TRUE, 1, NOW()),
(@purchase_sale_template_id, 'seller_name', 'sellerName', 'TEXT', TRUE, 2, NOW()),
(@purchase_sale_template_id, 'property_address', 'propertyAddress', 'TEXT', TRUE, 3, NOW()),
(@purchase_sale_template_id, 'purchase_price', 'purchasePrice', 'TEXT', TRUE, 4, NOW()),
(@purchase_sale_template_id, 'deposit_amount', 'depositAmount', 'TEXT', TRUE, 5, NOW()),
(@purchase_sale_template_id, 'closing_date', 'closingDate', 'DATE', TRUE, 6, NOW());

-- Motion to Suppress Evidence Fields
INSERT INTO ai_pdf_form_fields (
    template_id, pdf_field_name, case_data_path, field_type,
    is_required, display_order, created_at
) VALUES
(@motion_suppress_template_id, 'defendant_name', 'clientName', 'TEXT', TRUE, 1, NOW()),
(@motion_suppress_template_id, 'case_number', 'caseNumber', 'TEXT', TRUE, 2, NOW()),
(@motion_suppress_template_id, 'court_name', 'courtName', 'TEXT', TRUE, 3, NOW()),
(@motion_suppress_template_id, 'evidence_description', 'evidenceDescription', 'TEXT', TRUE, 4, NOW()),
(@motion_suppress_template_id, 'legal_basis', 'legalBasis', 'TEXT', TRUE, 5, NOW()),
(@motion_suppress_template_id, 'attorney_name', 'attorneyName', 'TEXT', TRUE, 6, NOW());