-- Add template variables for existing AI legal templates
-- Version: V63
-- Description: Seeds template-specific variables for document generation

-- Get template IDs (assuming they were inserted in order in V62)
SET @civil_complaint_id = (SELECT id FROM ai_legal_templates WHERE name = 'Massachusetts Civil Complaint' LIMIT 1);
SET @summary_judgment_id = (SELECT id FROM ai_legal_templates WHERE name = 'Motion for Summary Judgment - MA' LIMIT 1);
SET @purchase_sale_id = (SELECT id FROM ai_legal_templates WHERE name = 'Purchase and Sale Agreement - MA' LIMIT 1);
SET @divorce_complaint_id = (SELECT id FROM ai_legal_templates WHERE name = 'Massachusetts Divorce Complaint' LIMIT 1);
SET @i130_petition_id = (SELECT id FROM ai_legal_templates WHERE name = 'Immigration I-130 Petition' LIMIT 1);

-- Variables for Massachusetts Civil Complaint
INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text) VALUES
(@civil_complaint_id, 'court_name', 'Court Name', 'TEXT', 'USER_INPUT', 'Suffolk Superior Court', TRUE, 1, 'Name of the Massachusetts court'),
(@civil_complaint_id, 'case_number', 'Case Number', 'TEXT', 'CASE_DATA', '', FALSE, 2, 'Case docket number if already assigned'),
(@civil_complaint_id, 'plaintiff_name', 'Plaintiff Name', 'TEXT', 'CLIENT_DATA', '', TRUE, 3, 'Full legal name of the plaintiff'),
(@civil_complaint_id, 'plaintiff_address', 'Plaintiff Address', 'ADDRESS', 'CLIENT_DATA', '', TRUE, 4, 'Complete address of the plaintiff'),
(@civil_complaint_id, 'defendant_name', 'Defendant Name', 'TEXT', 'USER_INPUT', '', TRUE, 5, 'Full legal name of the defendant'),
(@civil_complaint_id, 'defendant_address', 'Defendant Address', 'ADDRESS', 'USER_INPUT', '', TRUE, 6, 'Complete address of the defendant'),
(@civil_complaint_id, 'jurisdiction_facts', 'Jurisdictional Facts', 'TEXT', 'USER_INPUT', '', TRUE, 7, 'Facts establishing court jurisdiction'),
(@civil_complaint_id, 'cause_of_action', 'Cause of Action', 'TEXT', 'USER_INPUT', '', TRUE, 8, 'Legal basis for the complaint'),
(@civil_complaint_id, 'factual_allegations', 'Factual Allegations', 'TEXT', 'USER_INPUT', '', TRUE, 9, 'Detailed facts supporting the claims'),
(@civil_complaint_id, 'damages_sought', 'Damages Sought', 'TEXT', 'USER_INPUT', '', TRUE, 10, 'Specific relief and damages requested'),
(@civil_complaint_id, 'jury_demand', 'Jury Trial Demand', 'BOOLEAN', 'USER_INPUT', 'true', FALSE, 11, 'Request for jury trial'),
(@civil_complaint_id, 'attorney_name', 'Attorney Name', 'TEXT', 'USER_INPUT', '', TRUE, 12, 'Name of plaintiff''s attorney'),
(@civil_complaint_id, 'attorney_bar_number', 'BBO Number', 'TEXT', 'USER_INPUT', '', TRUE, 13, 'Massachusetts Board of Bar Overseers number'),
(@civil_complaint_id, 'filing_date', 'Filing Date', 'DATE', 'USER_INPUT', '', FALSE, 14, 'Date of filing');

-- Variables for Motion for Summary Judgment
INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text) VALUES
(@summary_judgment_id, 'court_name', 'Court Name', 'TEXT', 'CASE_DATA', '', TRUE, 1, 'Name of the Massachusetts court'),
(@summary_judgment_id, 'case_number', 'Case Number', 'TEXT', 'CASE_DATA', '', TRUE, 2, 'Existing case docket number'),
(@summary_judgment_id, 'moving_party', 'Moving Party', 'TEXT', 'USER_INPUT', '', TRUE, 3, 'Party filing the motion'),
(@summary_judgment_id, 'opposing_party', 'Opposing Party', 'TEXT', 'USER_INPUT', '', TRUE, 4, 'Party opposing the motion'),
(@summary_judgment_id, 'undisputed_facts', 'Undisputed Facts', 'TEXT', 'USER_INPUT', '', TRUE, 5, 'Material facts not in dispute'),
(@summary_judgment_id, 'legal_standard', 'Legal Standard', 'TEXT', 'USER_INPUT', 'Mass. R. Civ. P. 56', TRUE, 6, 'Applicable legal standard'),
(@summary_judgment_id, 'legal_arguments', 'Legal Arguments', 'TEXT', 'USER_INPUT', '', TRUE, 7, 'Legal basis for summary judgment'),
(@summary_judgment_id, 'supporting_evidence', 'Supporting Evidence', 'TEXT', 'USER_INPUT', '', TRUE, 8, 'List of exhibits and affidavits'),
(@summary_judgment_id, 'conclusion', 'Conclusion', 'TEXT', 'USER_INPUT', '', TRUE, 9, 'Requested relief'),
(@summary_judgment_id, 'hearing_requested', 'Request Hearing', 'BOOLEAN', 'USER_INPUT', 'true', FALSE, 10, 'Request for oral argument');

-- Variables for Purchase and Sale Agreement
INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text) VALUES
(@purchase_sale_id, 'property_address', 'Property Address', 'ADDRESS', 'USER_INPUT', '', TRUE, 1, 'Complete address of the property'),
(@purchase_sale_id, 'purchase_price', 'Purchase Price', 'NUMBER', 'USER_INPUT', '', TRUE, 2, 'Total purchase price in dollars'),
(@purchase_sale_id, 'buyer_name', 'Buyer Name(s)', 'TEXT', 'CLIENT_DATA', '', TRUE, 3, 'Full legal name(s) of buyer(s)'),
(@purchase_sale_id, 'buyer_address', 'Buyer Address', 'ADDRESS', 'CLIENT_DATA', '', TRUE, 4, 'Current address of buyer'),
(@purchase_sale_id, 'seller_name', 'Seller Name(s)', 'TEXT', 'USER_INPUT', '', TRUE, 5, 'Full legal name(s) of seller(s)'),
(@purchase_sale_id, 'seller_address', 'Seller Address', 'ADDRESS', 'USER_INPUT', '', TRUE, 6, 'Current address of seller'),
(@purchase_sale_id, 'deposit_amount', 'Deposit Amount', 'NUMBER', 'USER_INPUT', '', TRUE, 7, 'Initial deposit amount'),
(@purchase_sale_id, 'closing_date', 'Closing Date', 'DATE', 'USER_INPUT', '', TRUE, 8, 'Scheduled closing date'),
(@purchase_sale_id, 'deed_type', 'Type of Deed', 'TEXT', 'USER_INPUT', 'Warranty Deed', TRUE, 9, 'Type of deed to be delivered'),
(@purchase_sale_id, 'contingencies', 'Contingencies', 'TEXT', 'USER_INPUT', '', FALSE, 10, 'Mortgage, inspection, and other contingencies'),
(@purchase_sale_id, 'property_description', 'Legal Description', 'TEXT', 'USER_INPUT', '', TRUE, 11, 'Legal description of the property'),
(@purchase_sale_id, 'included_items', 'Included Items', 'TEXT', 'USER_INPUT', '', FALSE, 12, 'Items included in the sale'),
(@purchase_sale_id, 'excluded_items', 'Excluded Items', 'TEXT', 'USER_INPUT', '', FALSE, 13, 'Items excluded from the sale');

-- Variables for Massachusetts Divorce Complaint
INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text) VALUES
(@divorce_complaint_id, 'county', 'County', 'TEXT', 'USER_INPUT', '', TRUE, 1, 'Massachusetts county for filing'),
(@divorce_complaint_id, 'docket_number', 'Docket Number', 'TEXT', 'CASE_DATA', '', FALSE, 2, 'Court docket number if assigned'),
(@divorce_complaint_id, 'plaintiff_name', 'Plaintiff Name', 'TEXT', 'CLIENT_DATA', '', TRUE, 3, 'Full legal name of plaintiff spouse'),
(@divorce_complaint_id, 'plaintiff_address', 'Plaintiff Address', 'ADDRESS', 'CLIENT_DATA', '', TRUE, 4, 'Current address of plaintiff'),
(@divorce_complaint_id, 'defendant_name', 'Defendant Name', 'TEXT', 'USER_INPUT', '', TRUE, 5, 'Full legal name of defendant spouse'),
(@divorce_complaint_id, 'defendant_address', 'Defendant Address', 'ADDRESS', 'USER_INPUT', '', TRUE, 6, 'Current address of defendant'),
(@divorce_complaint_id, 'marriage_date', 'Date of Marriage', 'DATE', 'USER_INPUT', '', TRUE, 7, 'Date of the marriage'),
(@divorce_complaint_id, 'marriage_place', 'Place of Marriage', 'TEXT', 'USER_INPUT', '', TRUE, 8, 'City and state/country of marriage'),
(@divorce_complaint_id, 'separation_date', 'Date of Separation', 'DATE', 'USER_INPUT', '', FALSE, 9, 'Date parties separated'),
(@divorce_complaint_id, 'grounds', 'Grounds for Divorce', 'TEXT', 'USER_INPUT', 'Irretrievable breakdown of the marriage', TRUE, 10, 'Legal grounds under M.G.L. c. 208'),
(@divorce_complaint_id, 'minor_children', 'Minor Children', 'BOOLEAN', 'USER_INPUT', 'false', TRUE, 11, 'Are there minor children?'),
(@divorce_complaint_id, 'children_names_ages', 'Children Information', 'TEXT', 'USER_INPUT', '', FALSE, 12, 'Names and dates of birth of children'),
(@divorce_complaint_id, 'custody_request', 'Custody Request', 'TEXT', 'USER_INPUT', '', FALSE, 13, 'Requested custody arrangement'),
(@divorce_complaint_id, 'alimony_request', 'Alimony Request', 'TEXT', 'USER_INPUT', '', FALSE, 14, 'Request for alimony/support'),
(@divorce_complaint_id, 'property_division', 'Property Division', 'TEXT', 'USER_INPUT', '', FALSE, 15, 'Requested property division');

-- Variables for Immigration I-130 Petition
INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text) VALUES
(@i130_petition_id, 'petitioner_name', 'Petitioner Full Name', 'TEXT', 'CLIENT_DATA', '', TRUE, 1, 'U.S. citizen or permanent resident petitioner'),
(@i130_petition_id, 'petitioner_alien_number', 'Petitioner A-Number', 'TEXT', 'CLIENT_DATA', '', FALSE, 2, 'If petitioner is a permanent resident'),
(@i130_petition_id, 'petitioner_address', 'Petitioner Address', 'ADDRESS', 'CLIENT_DATA', '', TRUE, 3, 'Current U.S. address'),
(@i130_petition_id, 'petitioner_date_of_birth', 'Petitioner DOB', 'DATE', 'CLIENT_DATA', '', TRUE, 4, 'Petitioner date of birth'),
(@i130_petition_id, 'petitioner_place_of_birth', 'Petitioner Place of Birth', 'TEXT', 'CLIENT_DATA', '', TRUE, 5, 'City and country of birth'),
(@i130_petition_id, 'petitioner_citizenship', 'Petitioner Citizenship', 'TEXT', 'CLIENT_DATA', 'United States', TRUE, 6, 'Country of citizenship'),
(@i130_petition_id, 'beneficiary_name', 'Beneficiary Full Name', 'TEXT', 'USER_INPUT', '', TRUE, 7, 'Foreign relative beneficiary'),
(@i130_petition_id, 'beneficiary_alien_number', 'Beneficiary A-Number', 'TEXT', 'USER_INPUT', '', FALSE, 8, 'If beneficiary has A-Number'),
(@i130_petition_id, 'beneficiary_address', 'Beneficiary Address', 'ADDRESS', 'USER_INPUT', '', TRUE, 9, 'Current address of beneficiary'),
(@i130_petition_id, 'beneficiary_date_of_birth', 'Beneficiary DOB', 'DATE', 'USER_INPUT', '', TRUE, 10, 'Beneficiary date of birth'),
(@i130_petition_id, 'beneficiary_place_of_birth', 'Beneficiary Place of Birth', 'TEXT', 'USER_INPUT', '', TRUE, 11, 'City and country of birth'),
(@i130_petition_id, 'beneficiary_citizenship', 'Beneficiary Citizenship', 'TEXT', 'USER_INPUT', '', TRUE, 12, 'Country of citizenship'),
(@i130_petition_id, 'relationship', 'Relationship', 'TEXT', 'USER_INPUT', '', TRUE, 13, 'Relationship to beneficiary (spouse, child, parent, sibling)'),
(@i130_petition_id, 'marriage_date', 'Marriage Date', 'DATE', 'USER_INPUT', '', FALSE, 14, 'If spouse petition'),
(@i130_petition_id, 'marriage_place', 'Marriage Place', 'TEXT', 'USER_INPUT', '', FALSE, 15, 'City and country of marriage'),
(@i130_petition_id, 'prior_marriages', 'Prior Marriages', 'BOOLEAN', 'USER_INPUT', 'false', TRUE, 16, 'Either party previously married?'),
(@i130_petition_id, 'consular_processing', 'Consular Processing', 'BOOLEAN', 'USER_INPUT', 'true', TRUE, 17, 'Will beneficiary apply abroad?'),
(@i130_petition_id, 'priority_date', 'Priority Date', 'DATE', 'USER_INPUT', '', FALSE, 18, 'If previously filed petition');

-- Add generic Demand Letter - Personal Injury template (if not exists)
INSERT INTO ai_legal_templates (name, description, category, practice_area, jurisdiction, ma_jurisdiction_specific, template_content, ai_prompt_structure, is_public, is_approved, is_ma_certified)
SELECT 'Demand Letter - Personal Injury', 'Personal injury demand letter template for settlement negotiations', 'CORRESPONDENCE', 'Personal Injury', 'Massachusetts', TRUE,
'[LAW_FIRM_LETTERHEAD]\n\n[DATE]\n\n[INSURANCE_COMPANY]\n[ADDRESS]\n\nRe: [CLAIM_NUMBER]\n    Our Client: [CLIENT_NAME]\n    Date of Loss: [ACCIDENT_DATE]\n    Your Insured: [INSURED_NAME]\n\nDear Claims Adjuster:\n\nI represent [CLIENT_NAME] in connection with injuries sustained in the above-referenced motor vehicle accident...\n\n[DEMAND_BODY]',
'Generate a personal injury demand letter for insurance settlement negotiations in Massachusetts',
TRUE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM ai_legal_templates WHERE name = 'Demand Letter - Personal Injury');

-- Add variables for Demand Letter - Personal Injury
SET @demand_letter_id = (SELECT id FROM ai_legal_templates WHERE name = 'Demand Letter - Personal Injury' LIMIT 1);

-- Only insert if template exists and no variables exist yet
INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text)
SELECT @demand_letter_id, 'client_name', 'Client Name', 'TEXT', 'CLIENT_DATA', '', TRUE, 1, 'Your client''s full name'
WHERE @demand_letter_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_template_variables WHERE template_id = @demand_letter_id);

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text)
SELECT @demand_letter_id, 'accident_date', 'Date of Accident', 'DATE', 'CASE_DATA', '', TRUE, 2, 'Date the accident occurred'
WHERE @demand_letter_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_template_variables WHERE template_id = @demand_letter_id AND variable_name = 'accident_date');

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text)
SELECT @demand_letter_id, 'accident_location', 'Accident Location', 'TEXT', 'CASE_DATA', '', TRUE, 3, 'Location where accident occurred'
WHERE @demand_letter_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_template_variables WHERE template_id = @demand_letter_id AND variable_name = 'accident_location');

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text)
SELECT @demand_letter_id, 'insured_name', 'At-Fault Party Name', 'TEXT', 'USER_INPUT', '', TRUE, 4, 'Name of the at-fault party'
WHERE @demand_letter_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_template_variables WHERE template_id = @demand_letter_id AND variable_name = 'insured_name');

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text)
SELECT @demand_letter_id, 'insurance_company', 'Insurance Company', 'TEXT', 'USER_INPUT', '', TRUE, 5, 'Name of insurance company'
WHERE @demand_letter_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_template_variables WHERE template_id = @demand_letter_id AND variable_name = 'insurance_company');

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text)
SELECT @demand_letter_id, 'claim_number', 'Claim Number', 'TEXT', 'USER_INPUT', '', FALSE, 6, 'Insurance claim number'
WHERE @demand_letter_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_template_variables WHERE template_id = @demand_letter_id AND variable_name = 'claim_number');

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text)
SELECT @demand_letter_id, 'injuries_description', 'Injuries Description', 'TEXT', 'USER_INPUT', '', TRUE, 7, 'Detailed description of injuries'
WHERE @demand_letter_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_template_variables WHERE template_id = @demand_letter_id AND variable_name = 'injuries_description');

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text)
SELECT @demand_letter_id, 'medical_treatment', 'Medical Treatment', 'TEXT', 'USER_INPUT', '', TRUE, 8, 'Summary of medical treatment received'
WHERE @demand_letter_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_template_variables WHERE template_id = @demand_letter_id AND variable_name = 'medical_treatment');

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text)
SELECT @demand_letter_id, 'medical_expenses', 'Medical Expenses', 'NUMBER', 'USER_INPUT', '', TRUE, 9, 'Total medical expenses to date'
WHERE @demand_letter_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_template_variables WHERE template_id = @demand_letter_id AND variable_name = 'medical_expenses');

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text)
SELECT @demand_letter_id, 'lost_wages', 'Lost Wages', 'NUMBER', 'USER_INPUT', '0', FALSE, 10, 'Total lost wages if applicable'
WHERE @demand_letter_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_template_variables WHERE template_id = @demand_letter_id AND variable_name = 'lost_wages');

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text)
SELECT @demand_letter_id, 'property_damage', 'Property Damage', 'NUMBER', 'USER_INPUT', '0', FALSE, 11, 'Property damage amount if applicable'
WHERE @demand_letter_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_template_variables WHERE template_id = @demand_letter_id AND variable_name = 'property_damage');

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text)
SELECT @demand_letter_id, 'demand_amount', 'Settlement Demand', 'NUMBER', 'USER_INPUT', '', TRUE, 12, 'Total settlement amount demanded'
WHERE @demand_letter_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_template_variables WHERE template_id = @demand_letter_id AND variable_name = 'demand_amount');

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text)
SELECT @demand_letter_id, 'response_deadline', 'Response Deadline', 'DATE', 'USER_INPUT', '', TRUE, 13, 'Deadline for insurance response'
WHERE @demand_letter_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_template_variables WHERE template_id = @demand_letter_id AND variable_name = 'response_deadline');

-- Add Employment Authorization Document (EAD) template if needed
INSERT INTO ai_legal_templates (name, description, category, practice_area, jurisdiction, ma_jurisdiction_specific, template_content, ai_prompt_structure, is_public, is_approved, is_ma_certified)
SELECT 'Employment Authorization Document (I-765)', 'USCIS Form I-765 Application for Employment Authorization', 'IMMIGRATION_FORM', 'Immigration', 'Federal', FALSE,
'APPLICATION FOR EMPLOYMENT AUTHORIZATION\n\nApplicant Information:\n[APPLICANT_NAME]\n[APPLICANT_ADDRESS]\n\nEligibility Category: [ELIGIBILITY_CATEGORY]\n\n[APPLICATION_CONTENT]',
'Generate USCIS Form I-765 application for employment authorization',
TRUE, TRUE, FALSE
WHERE NOT EXISTS (SELECT 1 FROM ai_legal_templates WHERE name = 'Employment Authorization Document (I-765)');

-- Add variables for EAD
SET @ead_id = (SELECT id FROM ai_legal_templates WHERE name = 'Employment Authorization Document (I-765)' LIMIT 1);

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text)
SELECT @ead_id, 'applicant_name', 'Applicant Full Name', 'TEXT', 'CLIENT_DATA', '', TRUE, 1, 'Full legal name of applicant'
WHERE @ead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_template_variables WHERE template_id = @ead_id AND variable_name = 'applicant_name');

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text)
SELECT @ead_id, 'alien_number', 'A-Number', 'TEXT', 'CLIENT_DATA', '', FALSE, 2, 'USCIS Alien Registration Number'
WHERE @ead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_template_variables WHERE template_id = @ead_id AND variable_name = 'alien_number');

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text)
SELECT @ead_id, 'applicant_address', 'Current Address', 'ADDRESS', 'CLIENT_DATA', '', TRUE, 3, 'Current U.S. mailing address'
WHERE @ead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_template_variables WHERE template_id = @ead_id AND variable_name = 'applicant_address');

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text)
SELECT @ead_id, 'date_of_birth', 'Date of Birth', 'DATE', 'CLIENT_DATA', '', TRUE, 4, 'Applicant date of birth'
WHERE @ead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_template_variables WHERE template_id = @ead_id AND variable_name = 'date_of_birth');

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text)
SELECT @ead_id, 'place_of_birth', 'Place of Birth', 'TEXT', 'CLIENT_DATA', '', TRUE, 5, 'City and country of birth'
WHERE @ead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_template_variables WHERE template_id = @ead_id AND variable_name = 'place_of_birth');

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text)
SELECT @ead_id, 'citizenship', 'Country of Citizenship', 'TEXT', 'CLIENT_DATA', '', TRUE, 6, 'Current citizenship/nationality'
WHERE @ead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_template_variables WHERE template_id = @ead_id AND variable_name = 'citizenship');

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text)
SELECT @ead_id, 'eligibility_category', 'Eligibility Category', 'TEXT', 'USER_INPUT', '', TRUE, 7, 'EAD eligibility category (e.g., (c)(9), (c)(8), etc.)'
WHERE @ead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_template_variables WHERE template_id = @ead_id AND variable_name = 'eligibility_category');

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text)
SELECT @ead_id, 'ssn', 'Social Security Number', 'TEXT', 'CLIENT_DATA', '', FALSE, 8, 'SSN if previously issued'
WHERE @ead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_template_variables WHERE template_id = @ead_id AND variable_name = 'ssn');

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text)
SELECT @ead_id, 'previous_ead', 'Previous EAD', 'BOOLEAN', 'USER_INPUT', 'false', TRUE, 9, 'Has applicant had EAD before?'
WHERE @ead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_template_variables WHERE template_id = @ead_id AND variable_name = 'previous_ead');

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text)
SELECT @ead_id, 'previous_ead_number', 'Previous EAD Number', 'TEXT', 'USER_INPUT', '', FALSE, 10, 'Previous EAD card number if applicable'
WHERE @ead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_template_variables WHERE template_id = @ead_id AND variable_name = 'previous_ead_number');

-- Update template content field to include better structure for AI generation
UPDATE ai_legal_templates
SET ai_prompt_structure = CONCAT(ai_prompt_structure, '. Use the provided template variables to fill in the document. Ensure all Massachusetts-specific legal requirements are met.')
WHERE ma_jurisdiction_specific = TRUE;

-- Add template type and update column for better tracking
UPDATE ai_legal_templates
SET template_type = 'TEXT',
    updated_at = CURRENT_TIMESTAMP
WHERE template_type IS NULL;