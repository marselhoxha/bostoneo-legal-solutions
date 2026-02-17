-- Fix I-130 field names to match actual PDF form fields

-- Get the I-130 template ID
SET @i130_template_id = (SELECT id FROM ai_legal_templates WHERE name LIKE '%I-130%' AND template_type = 'PDF_FORM' LIMIT 1);

-- Delete existing incorrect field mappings
DELETE FROM ai_pdf_form_fields WHERE template_id = @i130_template_id;

-- Insert correct field mappings for I-130 based on actual PDF field names
INSERT INTO ai_pdf_form_fields (
    template_id, pdf_field_name, case_data_path, field_type,
    is_required, display_order, created_at
) VALUES
-- Petitioner Information (Part 2)
(@i130_template_id, 'form1[0].#subform[0].Pt2Line4a_FamilyName[0]', 'clientName', 'TEXT', TRUE, 1, NOW()),
(@i130_template_id, 'form1[0].#subform[0].Pt2Line4b_GivenName[0]', 'clientFirstName', 'TEXT', TRUE, 2, NOW()),
(@i130_template_id, 'form1[0].#subform[0].Pt2Line4c_MiddleName[0]', 'clientMiddleName', 'TEXT', FALSE, 3, NOW()),

-- Beneficiary Information (Part 4)
(@i130_template_id, 'form1[0].#subform[4].Pt4Line4a_FamilyName[0]', 'beneficiaryLastName', 'TEXT', TRUE, 4, NOW()),
(@i130_template_id, 'form1[0].#subform[4].Pt4Line4b_GivenName[0]', 'beneficiaryFirstName', 'TEXT', TRUE, 5, NOW()),
(@i130_template_id, 'form1[0].#subform[4].Pt4Line4c_MiddleName[0]', 'beneficiaryMiddleName', 'TEXT', FALSE, 6, NOW()),

-- Beneficiary Date of Birth and Gender
(@i130_template_id, 'form1[0].#subform[4].Pt4Line9_DateOfBirth[0]', 'beneficiaryDateOfBirth', 'DATE', TRUE, 7, NOW()),
(@i130_template_id, 'form1[0].#subform[4].Pt4Line9_Male[0]', 'beneficiaryGenderMale', 'CHECKBOX', FALSE, 8, NOW()),
(@i130_template_id, 'form1[0].#subform[4].Pt4Line9_Female[0]', 'beneficiaryGenderFemale', 'CHECKBOX', FALSE, 9, NOW()),

-- Beneficiary Birth Information
(@i130_template_id, 'form1[0].#subform[4].Pt4Line7_CityTownOfBirth[0]', 'beneficiaryCityOfBirth', 'TEXT', TRUE, 10, NOW()),
(@i130_template_id, 'form1[0].#subform[4].Pt4Line8_CountryOfBirth[0]', 'beneficiaryCountryOfBirth', 'TEXT', TRUE, 11, NOW()),

-- Relationship Selection (Part 1)
(@i130_template_id, 'form1[0].#subform[0].Pt1Line1_Spouse[0]', 'relationshipSpouse', 'CHECKBOX', FALSE, 12, NOW()),
(@i130_template_id, 'form1[0].#subform[0].Pt1Line1_Child[0]', 'relationshipChild', 'CHECKBOX', FALSE, 13, NOW()),
(@i130_template_id, 'form1[0].#subform[0].Pt1Line1_Parent[0]', 'relationshipParent', 'CHECKBOX', FALSE, 14, NOW()),
(@i130_template_id, 'form1[0].#subform[0].Pt1Line1_Siblings[0]', 'relationshipSibling', 'CHECKBOX', FALSE, 15, NOW()),

-- Beneficiary Address Information
(@i130_template_id, 'form1[0].#subform[4].Pt4Line11_StreetNumberName[0]', 'beneficiaryAddress', 'TEXT', TRUE, 16, NOW()),
(@i130_template_id, 'form1[0].#subform[4].Pt4Line11_CityOrTown[0]', 'beneficiaryCity', 'TEXT', TRUE, 17, NOW()),
(@i130_template_id, 'form1[0].#subform[4].Pt4Line11_State[0]', 'beneficiaryState', 'TEXT', FALSE, 18, NOW()),
(@i130_template_id, 'form1[0].#subform[4].Pt4Line11_ZipCode[0]', 'beneficiaryZipCode', 'TEXT', FALSE, 19, NOW()),
(@i130_template_id, 'form1[0].#subform[4].Pt4Line11_Country[0]', 'beneficiaryCountry', 'TEXT', TRUE, 20, NOW());