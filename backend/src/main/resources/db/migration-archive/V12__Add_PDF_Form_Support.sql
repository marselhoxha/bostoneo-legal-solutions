-- Add PDF form support to ai_legal_templates table
ALTER TABLE ai_legal_templates 
ADD COLUMN template_type VARCHAR(20) DEFAULT 'TEXT',
ADD COLUMN pdf_form_url VARCHAR(500),
ADD COLUMN pdf_field_mappings JSON,
ADD COLUMN pdf_form_hash VARCHAR(64);

-- Create ai_pdf_form_fields table
CREATE TABLE ai_pdf_form_fields (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    template_id BIGINT NOT NULL,
    pdf_field_name VARCHAR(200) NOT NULL,
    case_data_path VARCHAR(200),
    default_value VARCHAR(500),
    field_type VARCHAR(50) DEFAULT 'TEXT',
    is_required BOOLEAN DEFAULT FALSE,
    validation_rule VARCHAR(200),
    ai_generation_prompt TEXT,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_template_id (template_id),
    INDEX idx_display_order (template_id, display_order),
    FOREIGN KEY (template_id) REFERENCES ai_legal_templates(id) ON DELETE CASCADE
);

-- Update existing templates to set default template_type
UPDATE ai_legal_templates SET template_type = 'TEXT' WHERE template_type IS NULL;

-- Insert sample PDF form templates
INSERT INTO ai_legal_templates (
    name, description, category, practice_area, jurisdiction, 
    ma_jurisdiction_specific, template_type, pdf_form_url, 
    is_approved, is_public, created_by, created_at, updated_at
) VALUES 
(
    'USCIS Form I-130 Petition for Alien Relative',
    'Official USCIS form for petitioning for immigrant status for relatives',
    'IMMIGRATION_FORM',
    'Immigration Law',
    'Federal',
    FALSE,
    'PDF_FORM',
    'https://www.uscis.gov/sites/default/files/document/forms/i-130.pdf',
    TRUE,
    TRUE,
    1,
    NOW(),
    NOW()
),
(
    'Massachusetts Civil Complaint Form',
    'Standard Massachusetts Superior Court civil complaint form',
    'PLEADING',
    'Civil Litigation',
    'Massachusetts',
    TRUE,
    'PDF_FORM',
    'https://www.mass.gov/doc/civil-action-cover-sheet/download',
    TRUE,
    TRUE,
    1,
    NOW(),
    NOW()
);

-- Get the template IDs for field mapping
SET @i130_template_id = (SELECT id FROM ai_legal_templates WHERE name = 'USCIS Form I-130 Petition for Alien Relative' LIMIT 1);
SET @civil_template_id = (SELECT id FROM ai_legal_templates WHERE name = 'Massachusetts Civil Complaint Form' LIMIT 1);

-- Insert default form fields for I-130
INSERT INTO ai_pdf_form_fields (
    template_id, pdf_field_name, case_data_path, field_type, 
    is_required, display_order, created_at
) VALUES 
(@i130_template_id, 'petitioner_family_name', 'clientName', 'TEXT', TRUE, 1, NOW()),
(@i130_template_id, 'petitioner_given_name', 'clientFirstName', 'TEXT', TRUE, 2, NOW()),
(@i130_template_id, 'petitioner_address', 'clientAddress', 'TEXT', TRUE, 3, NOW()),
(@i130_template_id, 'petitioner_dob', 'clientDateOfBirth', 'DATE', TRUE, 4, NOW()),
(@i130_template_id, 'beneficiary_name', '', 'TEXT', TRUE, 5, NOW()),
(@i130_template_id, 'relationship', '', 'TEXT', TRUE, 6, NOW());

-- Insert default form fields for Civil Complaint
INSERT INTO ai_pdf_form_fields (
    template_id, pdf_field_name, case_data_path, field_type, 
    is_required, display_order, created_at
) VALUES 
(@civil_template_id, 'plaintiff_name', 'clientName', 'TEXT', TRUE, 1, NOW()),
(@civil_template_id, 'case_number', 'caseNumber', 'TEXT', TRUE, 2, NOW()),
(@civil_template_id, 'filing_date', 'filingDate', 'DATE', TRUE, 3, NOW()),
(@civil_template_id, 'court_name', 'courtName', 'TEXT', FALSE, 4, NOW());