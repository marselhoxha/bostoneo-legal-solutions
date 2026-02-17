-- PostgreSQL Comprehensive Seed Data Migration
-- Version: V203
-- Description: Populates all remaining empty tables with seed data

-- ===============================================
-- AI LEGAL TEMPLATES
-- ===============================================
INSERT INTO ai_legal_templates (
    name, description, category, practice_area, jurisdiction,
    ma_jurisdiction_specific, template_content, ai_prompt_structure,
    is_public, is_approved, is_ma_certified, template_type,
    organization_id, created_by, created_at, updated_at
) VALUES
-- Massachusetts Civil Complaint
('Massachusetts Civil Complaint', 'Standard civil complaint template for Massachusetts Superior Court', 'PLEADING', 'Civil Litigation', 'Massachusetts', TRUE,
'COMMONWEALTH OF MASSACHUSETTS

[COURT_NAME]

CIVIL ACTION NO. [CASE_NUMBER]

[PLAINTIFF_NAME],
	Plaintiff

v.

[DEFENDANT_NAME],
	Defendant

COMPLAINT

[COMPLAINT_BODY]',
'Generate a civil complaint for Massachusetts Superior Court with proper formatting and jurisdictional requirements', TRUE, TRUE, TRUE, 'TEXT', 1, 1, NOW(), NOW()),

-- Motion for Summary Judgment
('Motion for Summary Judgment - MA', 'Motion for Summary Judgment under Mass. R. Civ. P. 56', 'MOTION', 'Civil Litigation', 'Massachusetts', TRUE,
'COMMONWEALTH OF MASSACHUSETTS

[COURT_NAME]

CIVIL ACTION NO. [CASE_NUMBER]

[PLAINTIFF_NAME],
	Plaintiff

v.

[DEFENDANT_NAME],
	Defendant

MOTION FOR SUMMARY JUDGMENT

[MOTION_BODY]',
'Create a motion for summary judgment following Massachusetts Rules of Civil Procedure Rule 56', TRUE, TRUE, TRUE, 'TEXT', 1, 1, NOW(), NOW()),

-- Purchase and Sale Agreement
('Purchase and Sale Agreement - MA', 'Standard Massachusetts real estate purchase agreement', 'CONTRACT', 'Real Estate', 'Massachusetts', TRUE,
'MASSACHUSETTS PURCHASE AND SALE AGREEMENT

Property Address: [PROPERTY_ADDRESS]
Purchase Price: [PURCHASE_PRICE]
Buyer: [BUYER_NAME]
Seller: [SELLER_NAME]

[CONTRACT_TERMS]',
'Generate a Massachusetts-compliant real estate purchase and sale agreement', TRUE, TRUE, TRUE, 'TEXT', 1, 1, NOW(), NOW()),

-- Massachusetts Divorce Complaint
('Massachusetts Divorce Complaint', 'No-fault divorce complaint under M.G.L. c. 208', 'PLEADING', 'Family Law', 'Massachusetts', TRUE,
'COMMONWEALTH OF MASSACHUSETTS

PROBATE AND FAMILY COURT

[COUNTY] DIVISION

DOCKET NO. [DOCKET_NUMBER]

[PLAINTIFF_NAME],
	Plaintiff

v.

[DEFENDANT_NAME],
	Defendant

COMPLAINT FOR DIVORCE

[DIVORCE_GROUNDS]',
'Create a Massachusetts divorce complaint following M.G.L. Chapter 208 requirements', TRUE, TRUE, TRUE, 'TEXT', 1, 1, NOW(), NOW()),

-- Immigration I-130 Petition
('Immigration I-130 Petition', 'USCIS Form I-130 petition template', 'IMMIGRATION_FORM', 'Immigration', 'Federal', FALSE,
'I-130, Immigrant Petition for Alien Relative

Petitioner Information:
Name: [PETITIONER_NAME]
Address: [PETITIONER_ADDRESS]

Beneficiary Information:
Name: [BENEFICIARY_NAME]
Relationship: [RELATIONSHIP]

[FORM_CONTENT]',
'Generate USCIS Form I-130 petition with proper formatting and required information', TRUE, TRUE, FALSE, 'TEXT', 1, 1, NOW(), NOW()),

-- Demand Letter Personal Injury
('Demand Letter - Personal Injury', 'Personal injury demand letter template for settlement negotiations', 'CORRESPONDENCE', 'Personal Injury', 'Massachusetts', TRUE,
'[LAW_FIRM_LETTERHEAD]

[DATE]

[INSURANCE_COMPANY]
[ADDRESS]

Re: [CLAIM_NUMBER]
    Our Client: [CLIENT_NAME]
    Date of Loss: [ACCIDENT_DATE]
    Your Insured: [INSURED_NAME]

Dear Claims Adjuster:

I represent [CLIENT_NAME] in connection with injuries sustained in the above-referenced motor vehicle accident...

[DEMAND_BODY]',
'Generate a personal injury demand letter for insurance settlement negotiations in Massachusetts',
TRUE, TRUE, TRUE, 'TEXT', 1, 1, NOW(), NOW()),

-- Employment Authorization Document (I-765)
('Employment Authorization Document (I-765)', 'USCIS Form I-765 Application for Employment Authorization', 'IMMIGRATION_FORM', 'Immigration', 'Federal', FALSE,
'APPLICATION FOR EMPLOYMENT AUTHORIZATION

Applicant Information:
[APPLICANT_NAME]
[APPLICANT_ADDRESS]

Eligibility Category: [ELIGIBILITY_CATEGORY]

[APPLICATION_CONTENT]',
'Generate USCIS Form I-765 application for employment authorization',
TRUE, TRUE, FALSE, 'TEXT', 1, 1, NOW(), NOW()),

-- PDF Form Templates
('USCIS Form I-130 Petition for Alien Relative', 'Official USCIS form for petitioning for immigrant status for relatives', 'IMMIGRATION_FORM', 'Immigration Law', 'Federal', FALSE, 'PDF_FORM',
'https://www.uscis.gov/sites/default/files/document/forms/i-130.pdf', TRUE, TRUE, FALSE, 'PDF_FORM', 1, 1, NOW(), NOW()),

('Massachusetts Civil Complaint Form', 'Standard Massachusetts Superior Court civil complaint form', 'PLEADING', 'Civil Litigation', 'Massachusetts', TRUE, 'PDF_FORM',
'https://www.mass.gov/doc/civil-action-cover-sheet/download', TRUE, TRUE, TRUE, 'PDF_FORM', 1, 1, NOW(), NOW()),

('USCIS Form I-485 - Application to Register Permanent Residence', 'Official USCIS form for applying for permanent residence in the United States', 'IMMIGRATION_FORM', 'Immigration Law', 'Federal', FALSE, 'PDF_FORM',
'https://www.uscis.gov/sites/default/files/document/forms/i-485.pdf', TRUE, TRUE, FALSE, 'PDF_FORM', 1, 1, NOW(), NOW()),

('USCIS Form I-765 - Application for Employment Authorization', 'Official USCIS form for applying for work authorization in the United States', 'IMMIGRATION_FORM', 'Immigration Law', 'Federal', FALSE, 'PDF_FORM',
'https://www.uscis.gov/sites/default/files/document/forms/i-765.pdf', TRUE, TRUE, FALSE, 'PDF_FORM', 1, 1, NOW(), NOW()),

('Massachusetts Divorce Complaint Form (CJ-D 101)', 'Massachusetts Probate and Family Court divorce complaint form', 'PLEADING', 'Family Law', 'Massachusetts', TRUE, 'PDF_FORM',
'https://www.mass.gov/doc/divorce-complaint-cj-d-101/download', TRUE, TRUE, TRUE, 'PDF_FORM', 1, 1, NOW(), NOW()),

('Massachusetts Child Support Guidelines Worksheet', 'Massachusetts child support calculation worksheet', 'FAMILY_LAW_FORM', 'Family Law', 'Massachusetts', TRUE, 'PDF_FORM',
'https://www.mass.gov/doc/child-support-guidelines-worksheet/download', TRUE, TRUE, TRUE, 'PDF_FORM', 1, 1, NOW(), NOW()),

('Massachusetts Residential Lease Agreement', 'Standard Massachusetts residential lease agreement form', 'CONTRACT', 'Real Estate Law', 'Massachusetts', TRUE, 'PDF_FORM',
'https://www.mass.gov/doc/standard-form-lease/download', TRUE, TRUE, TRUE, 'PDF_FORM', 1, 1, NOW(), NOW()),

('Massachusetts Motion to Suppress Evidence', 'Motion to suppress evidence in Massachusetts criminal cases', 'MOTION', 'Criminal Defense', 'Massachusetts', TRUE, 'PDF_FORM',
'https://www.mass.gov/doc/motion-to-suppress-evidence/download', TRUE, TRUE, TRUE, 'PDF_FORM', 1, 1, NOW(), NOW()),

('Massachusetts Motion for Discovery', 'Motion for discovery in Massachusetts criminal cases', 'MOTION', 'Criminal Defense', 'Massachusetts', TRUE, 'PDF_FORM',
'https://www.mass.gov/doc/motion-for-discovery/download', TRUE, TRUE, TRUE, 'PDF_FORM', 1, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- AI STYLE GUIDES
-- ===============================================
INSERT INTO ai_style_guides (
    name, description, citation_style, is_default, is_active,
    rules_json, formatting_preferences, organization_id, created_by, created_at, updated_at
) VALUES (
    'Massachusetts Legal Standard',
    'Default style guide for Massachusetts legal documents',
    'MASSACHUSETTS',
    TRUE,
    TRUE,
    '{"citations": {"court_format": "Massachusetts format", "statute_format": "M.G.L. c. [chapter] § [section]"}, "formatting": {"margins": "1 inch all sides", "font": "Times New Roman 12pt", "line_spacing": "double"}}',
    '{"font_family": "Times New Roman", "font_size": 12, "line_spacing": 2.0, "margins": {"top": 1, "bottom": 1, "left": 1, "right": 1}}',
    1, 1, NOW(), NOW()
) ON CONFLICT DO NOTHING;

-- ===============================================
-- AI TEMPLATE VARIABLES
-- ===============================================
-- Insert variables using subqueries to get template IDs
INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text, created_at)
SELECT id, 'court_name', 'Court Name', 'TEXT', 'USER_INPUT', 'Suffolk Superior Court', TRUE, 1, 'Name of the Massachusetts court', NOW()
FROM ai_legal_templates WHERE name = 'Massachusetts Civil Complaint' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text, created_at)
SELECT id, 'case_number', 'Case Number', 'TEXT', 'CASE_DATA', '', FALSE, 2, 'Case docket number if already assigned', NOW()
FROM ai_legal_templates WHERE name = 'Massachusetts Civil Complaint' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text, created_at)
SELECT id, 'plaintiff_name', 'Plaintiff Name', 'TEXT', 'CLIENT_DATA', '', TRUE, 3, 'Full legal name of the plaintiff', NOW()
FROM ai_legal_templates WHERE name = 'Massachusetts Civil Complaint' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text, created_at)
SELECT id, 'defendant_name', 'Defendant Name', 'TEXT', 'USER_INPUT', '', TRUE, 5, 'Full legal name of the defendant', NOW()
FROM ai_legal_templates WHERE name = 'Massachusetts Civil Complaint' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text, created_at)
SELECT id, 'cause_of_action', 'Cause of Action', 'TEXT', 'USER_INPUT', '', TRUE, 8, 'Legal basis for the complaint', NOW()
FROM ai_legal_templates WHERE name = 'Massachusetts Civil Complaint' LIMIT 1
ON CONFLICT DO NOTHING;

-- Motion for Summary Judgment variables
INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text, created_at)
SELECT id, 'court_name', 'Court Name', 'TEXT', 'CASE_DATA', '', TRUE, 1, 'Name of the Massachusetts court', NOW()
FROM ai_legal_templates WHERE name = 'Motion for Summary Judgment - MA' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text, created_at)
SELECT id, 'case_number', 'Case Number', 'TEXT', 'CASE_DATA', '', TRUE, 2, 'Existing case docket number', NOW()
FROM ai_legal_templates WHERE name = 'Motion for Summary Judgment - MA' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text, created_at)
SELECT id, 'moving_party', 'Moving Party', 'TEXT', 'USER_INPUT', '', TRUE, 3, 'Party filing the motion', NOW()
FROM ai_legal_templates WHERE name = 'Motion for Summary Judgment - MA' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text, created_at)
SELECT id, 'legal_standard', 'Legal Standard', 'TEXT', 'USER_INPUT', 'Mass. R. Civ. P. 56', TRUE, 6, 'Applicable legal standard', NOW()
FROM ai_legal_templates WHERE name = 'Motion for Summary Judgment - MA' LIMIT 1
ON CONFLICT DO NOTHING;

-- Purchase and Sale Agreement variables
INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text, created_at)
SELECT id, 'property_address', 'Property Address', 'ADDRESS', 'USER_INPUT', '', TRUE, 1, 'Complete address of the property', NOW()
FROM ai_legal_templates WHERE name = 'Purchase and Sale Agreement - MA' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text, created_at)
SELECT id, 'purchase_price', 'Purchase Price', 'NUMBER', 'USER_INPUT', '', TRUE, 2, 'Total purchase price in dollars', NOW()
FROM ai_legal_templates WHERE name = 'Purchase and Sale Agreement - MA' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text, created_at)
SELECT id, 'buyer_name', 'Buyer Name(s)', 'TEXT', 'CLIENT_DATA', '', TRUE, 3, 'Full legal name(s) of buyer(s)', NOW()
FROM ai_legal_templates WHERE name = 'Purchase and Sale Agreement - MA' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text, created_at)
SELECT id, 'seller_name', 'Seller Name(s)', 'TEXT', 'USER_INPUT', '', TRUE, 5, 'Full legal name(s) of seller(s)', NOW()
FROM ai_legal_templates WHERE name = 'Purchase and Sale Agreement - MA' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text, created_at)
SELECT id, 'closing_date', 'Closing Date', 'DATE', 'USER_INPUT', '', TRUE, 8, 'Scheduled closing date', NOW()
FROM ai_legal_templates WHERE name = 'Purchase and Sale Agreement - MA' LIMIT 1
ON CONFLICT DO NOTHING;

-- Divorce Complaint variables
INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text, created_at)
SELECT id, 'county', 'County', 'TEXT', 'USER_INPUT', '', TRUE, 1, 'Massachusetts county for filing', NOW()
FROM ai_legal_templates WHERE name = 'Massachusetts Divorce Complaint' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text, created_at)
SELECT id, 'plaintiff_name', 'Plaintiff Name', 'TEXT', 'CLIENT_DATA', '', TRUE, 3, 'Full legal name of plaintiff spouse', NOW()
FROM ai_legal_templates WHERE name = 'Massachusetts Divorce Complaint' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text, created_at)
SELECT id, 'defendant_name', 'Defendant Name', 'TEXT', 'USER_INPUT', '', TRUE, 5, 'Full legal name of defendant spouse', NOW()
FROM ai_legal_templates WHERE name = 'Massachusetts Divorce Complaint' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text, created_at)
SELECT id, 'grounds', 'Grounds for Divorce', 'TEXT', 'USER_INPUT', 'Irretrievable breakdown of the marriage', TRUE, 10, 'Legal grounds under M.G.L. c. 208', NOW()
FROM ai_legal_templates WHERE name = 'Massachusetts Divorce Complaint' LIMIT 1
ON CONFLICT DO NOTHING;

-- I-130 Petition variables
INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text, created_at)
SELECT id, 'petitioner_name', 'Petitioner Full Name', 'TEXT', 'CLIENT_DATA', '', TRUE, 1, 'U.S. citizen or permanent resident petitioner', NOW()
FROM ai_legal_templates WHERE name = 'Immigration I-130 Petition' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text, created_at)
SELECT id, 'beneficiary_name', 'Beneficiary Full Name', 'TEXT', 'USER_INPUT', '', TRUE, 7, 'Foreign relative beneficiary', NOW()
FROM ai_legal_templates WHERE name = 'Immigration I-130 Petition' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ai_template_variables (template_id, variable_name, display_name, variable_type, data_source, default_value, is_required, display_order, help_text, created_at)
SELECT id, 'relationship', 'Relationship', 'TEXT', 'USER_INPUT', '', TRUE, 13, 'Relationship to beneficiary (spouse, child, parent, sibling)', NOW()
FROM ai_legal_templates WHERE name = 'Immigration I-130 Petition' LIMIT 1
ON CONFLICT DO NOTHING;

-- ===============================================
-- AI PDF FORM FIELDS
-- ===============================================
INSERT INTO ai_pdf_form_fields (template_id, pdf_field_name, case_data_path, field_type, is_required, display_order, created_at)
SELECT id, 'petitioner_family_name', 'clientName', 'TEXT', TRUE, 1, NOW()
FROM ai_legal_templates WHERE name = 'USCIS Form I-130 Petition for Alien Relative' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ai_pdf_form_fields (template_id, pdf_field_name, case_data_path, field_type, is_required, display_order, created_at)
SELECT id, 'petitioner_given_name', 'clientFirstName', 'TEXT', TRUE, 2, NOW()
FROM ai_legal_templates WHERE name = 'USCIS Form I-130 Petition for Alien Relative' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ai_pdf_form_fields (template_id, pdf_field_name, case_data_path, field_type, is_required, display_order, created_at)
SELECT id, 'petitioner_address', 'clientAddress', 'TEXT', TRUE, 3, NOW()
FROM ai_legal_templates WHERE name = 'USCIS Form I-130 Petition for Alien Relative' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ai_pdf_form_fields (template_id, pdf_field_name, case_data_path, field_type, is_required, display_order, created_at)
SELECT id, 'petitioner_dob', 'clientDateOfBirth', 'DATE', TRUE, 4, NOW()
FROM ai_legal_templates WHERE name = 'USCIS Form I-130 Petition for Alien Relative' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ai_pdf_form_fields (template_id, pdf_field_name, case_data_path, field_type, is_required, display_order, created_at)
SELECT id, 'plaintiff_name', 'clientName', 'TEXT', TRUE, 1, NOW()
FROM ai_legal_templates WHERE name = 'Massachusetts Civil Complaint Form' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ai_pdf_form_fields (template_id, pdf_field_name, case_data_path, field_type, is_required, display_order, created_at)
SELECT id, 'case_number', 'caseNumber', 'TEXT', TRUE, 2, NOW()
FROM ai_legal_templates WHERE name = 'Massachusetts Civil Complaint Form' LIMIT 1
ON CONFLICT DO NOTHING;

-- ===============================================
-- INVOICE WORKFLOW RULES
-- ===============================================
INSERT INTO invoice_workflow_rules (
    name, description, trigger_event, action_type, action_config, is_active,
    organization_id, created_at, updated_at
) VALUES
('Auto-send New Invoices', 'Automatically email invoice to client when created', 'CREATED', 'SEND_EMAIL',
'{"email_template": "invoice_created", "send_to_client": true, "attach_pdf": true}', TRUE, 1, NOW(), NOW()),

('Payment Reminder - 7 Days', 'Send payment reminder 7 days before due date', 'SCHEDULED', 'SEND_EMAIL',
'{"email_template": "payment_reminder", "days_before_due": 7, "send_to_client": true}', TRUE, 1, NOW(), NOW()),

('Payment Reminder - 1 Day', 'Send payment reminder 1 day before due date', 'SCHEDULED', 'SEND_EMAIL',
'{"email_template": "payment_reminder_urgent", "days_before_due": 1, "send_to_client": true}', TRUE, 1, NOW(), NOW()),

('Mark Overdue Invoices', 'Automatically mark invoices as overdue after due date', 'SCHEDULED', 'UPDATE_STATUS',
'{"new_status": "OVERDUE", "days_after_due": 1, "condition_status": ["ISSUED", "PENDING"]}', TRUE, 1, NOW(), NOW()),

('Overdue Notice', 'Send overdue notice 3 days after due date', 'SCHEDULED', 'SEND_EMAIL',
'{"email_template": "overdue_notice", "days_after_due": 3, "send_to_client": true, "cc_accounting": true}', TRUE, 1, NOW(), NOW()),

('Apply Late Fee', 'Apply 1.5% late fee 10 days after due date', 'SCHEDULED', 'APPLY_LATE_FEE',
'{"fee_percentage": 1.5, "days_after_due": 10, "fee_description": "Late payment fee (1.5%)", "max_fee_amount": 500.00}', TRUE, 1, NOW(), NOW()),

('Payment Thank You', 'Send thank you email when payment is received', 'STATUS_CHANGED', 'SEND_EMAIL',
'{"email_template": "payment_received", "trigger_status": "PAID", "send_to_client": true}', TRUE, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Update with proper scheduling values
UPDATE invoice_workflow_rules SET days_before_due = 7, execution_time = '09:00:00' WHERE name = 'Payment Reminder - 7 Days';
UPDATE invoice_workflow_rules SET days_before_due = 1, execution_time = '09:00:00' WHERE name = 'Payment Reminder - 1 Day';
UPDATE invoice_workflow_rules SET days_after_due = 1, execution_time = '00:01:00' WHERE name = 'Mark Overdue Invoices';
UPDATE invoice_workflow_rules SET days_after_due = 3, execution_time = '09:00:00' WHERE name = 'Overdue Notice';
UPDATE invoice_workflow_rules SET days_after_due = 10, execution_time = '00:01:00' WHERE name = 'Apply Late Fee';

-- ===============================================
-- TRUST ACCOUNTS
-- ===============================================
INSERT INTO trust_accounts (
    account_name, account_number, bank_name, account_type, current_balance,
    status, organization_id, created_by, created_at, updated_at
) VALUES
('Main IOLTA Account', 'IOLTA-001-2024', 'Bank of America', 'IOLTA', 0.00, 'ACTIVE', 1, 1, NOW(), NOW()),
('Client Trust Account', 'TRUST-002-2024', 'Citizens Bank', 'CLIENT_TRUST', 0.00, 'ACTIVE', 1, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- FOLDERS (Document Management)
-- ===============================================
INSERT INTO folders (
    name, parent_id, path, is_system, organization_id, owner_id, created_at, updated_at
) VALUES
('Root', NULL, '/', TRUE, 1, 1, NOW(), NOW()),
('Client Documents', NULL, '/Client Documents', FALSE, 1, 1, NOW(), NOW()),
('Case Files', NULL, '/Case Files', FALSE, 1, 1, NOW(), NOW()),
('Templates', NULL, '/Templates', TRUE, 1, 1, NOW(), NOW()),
('Legal Documents', NULL, '/Legal Documents', FALSE, 1, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- CASE NOTES
-- ===============================================
INSERT INTO case_notes (
    case_id, content, note_type, visibility,
    organization_id, created_by, created_at, updated_at
)
SELECT
    lc.id,
    'Initial consultation completed. Client provided overview of the matter.',
    'GENERAL',
    'PRIVATE',
    1, 1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

INSERT INTO case_notes (
    case_id, content, note_type, visibility,
    organization_id, created_by, created_at, updated_at
)
SELECT
    lc.id,
    'Filed initial pleadings with the court. Awaiting response.',
    'COURT_FILING',
    'TEAM',
    1, 1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 3
ON CONFLICT DO NOTHING;

-- ===============================================
-- COMMUNICATION LOGS
-- ===============================================
INSERT INTO communication_logs (
    case_id, client_id, communication_type, direction, subject,
    content, participants, organization_id, created_by, created_at
)
SELECT
    lc.id,
    lc.client_id,
    'EMAIL',
    'OUTBOUND',
    'Case Update - ' || lc.title,
    'Dear Client, This is to update you on the status of your case. Please contact us with any questions.',
    '["client@example.com"]',
    1, 1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

INSERT INTO communication_logs (
    case_id, client_id, communication_type, direction, subject,
    content, participants, organization_id, created_by, created_at
)
SELECT
    lc.id,
    lc.client_id,
    'PHONE',
    'INBOUND',
    'Client Phone Call',
    'Client called to discuss case progress. Provided updates and answered questions.',
    '[]',
    1, 1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 3
ON CONFLICT DO NOTHING;

-- ===============================================
-- CONFLICT CHECKS
-- ===============================================
INSERT INTO conflict_checks (
    case_id, client_id, check_type, status, result_summary,
    checked_parties, potential_conflicts, organization_id,
    checked_by, checked_at, created_at
)
SELECT
    lc.id,
    lc.client_id,
    'NEW_MATTER',
    'CLEARED',
    'No conflicts identified',
    '["client", "opposing_party"]',
    '[]',
    1, 1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- USER NOTIFICATIONS
-- ===============================================
INSERT INTO user_notifications (
    user_id, title, message, notification_type, is_read,
    organization_id, created_at
) VALUES
(1, 'Welcome to Bostoneo Legal Solutions', 'Your account has been successfully created.', 'SYSTEM', FALSE, 1, NOW()),
(1, 'New Case Assigned', 'You have been assigned to a new case. Please review the details.', 'CASE', FALSE, 1, NOW()),
(1, 'Task Due Soon', 'A task is due in the next 24 hours.', 'TASK', FALSE, 1, NOW()),
(1, 'Invoice Payment Received', 'A payment has been received for Invoice #INV-2024-001.', 'BILLING', FALSE, 1, NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- LEGAL DOCUMENTS (Case-specific documents)
-- ===============================================
INSERT INTO legal_documents (
    case_id, title, document_type, status, content,
    organization_id, created_by, created_at, updated_at
)
SELECT
    lc.id,
    'Engagement Letter - ' || lc.title,
    'ENGAGEMENT_LETTER',
    'SIGNED',
    'Engagement letter content for the legal matter.',
    1, 1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

INSERT INTO legal_documents (
    case_id, title, document_type, status, content,
    organization_id, created_by, created_at, updated_at
)
SELECT
    lc.id,
    'Initial Filing - ' || lc.title,
    'COURT_FILING',
    'FILED',
    'Initial court filing document content.',
    1, 1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 3
ON CONFLICT DO NOTHING;

-- ===============================================
-- ADDITIONAL VENDORS
-- ===============================================
INSERT INTO vendors (
    name, contact_name, email, phone, address,
    vendor_type, tax_id, payment_terms, is_active,
    organization_id, created_at, updated_at
) VALUES
('Court Filing Services', 'Filing Dept', 'filing@courts.gov', '617-555-0100', '123 Court St, Boston, MA', 'COURT_SERVICES', '12-3456789', 'NET_30', TRUE, 1, NOW(), NOW()),
('Process Server Inc', 'John Smith', 'service@processserver.com', '617-555-0101', '456 Main St, Boston, MA', 'SERVICE_PROVIDER', '23-4567890', 'NET_15', TRUE, 1, NOW(), NOW()),
('Legal Research Services', 'Research Team', 'research@legalresearch.com', '617-555-0102', '789 Law Ave, Boston, MA', 'RESEARCH', '34-5678901', 'NET_30', TRUE, 1, NOW(), NOW()),
('Court Reporter Services', 'Jane Doe', 'reports@courtreporter.com', '617-555-0103', '321 Transcript Ln, Boston, MA', 'COURT_SERVICES', '45-6789012', 'DUE_ON_RECEIPT', TRUE, 1, NOW(), NOW()),
('Expert Witness LLC', 'Dr. Expert', 'expert@expertwitness.com', '617-555-0104', '555 Expert Way, Cambridge, MA', 'EXPERT_WITNESS', '56-7890123', 'NET_45', TRUE, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- ADDITIONAL EXPENSES (linked to cases)
-- ===============================================
INSERT INTO expenses (
    case_id, description, amount, date, category_id,
    vendor_id, status, is_billable, organization_id, created_by, created_at
)
SELECT
    lc.id,
    'Court Filing Fee',
    175.00,
    CURRENT_DATE - INTERVAL '10 days',
    (SELECT id FROM expense_categories WHERE name = 'Court Costs' LIMIT 1),
    (SELECT id FROM vendors WHERE name = 'Court Filing Services' LIMIT 1),
    'APPROVED',
    TRUE,
    1, 1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 3
ON CONFLICT DO NOTHING;

INSERT INTO expenses (
    case_id, description, amount, date, category_id,
    vendor_id, status, is_billable, organization_id, created_by, created_at
)
SELECT
    lc.id,
    'Process Server Fee',
    85.00,
    CURRENT_DATE - INTERVAL '5 days',
    (SELECT id FROM expense_categories WHERE name = 'Process Server Fees' LIMIT 1),
    (SELECT id FROM vendors WHERE name = 'Process Server Inc' LIMIT 1),
    'APPROVED',
    TRUE,
    1, 1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 2
ON CONFLICT DO NOTHING;

-- ===============================================
-- RESEARCH SESSIONS
-- ===============================================
INSERT INTO research_sessions (
    title, description, case_id, status,
    organization_id, user_id, created_at, updated_at
)
SELECT
    'Legal Research - ' || lc.title,
    'Research session for case legal analysis',
    lc.id,
    'ACTIVE',
    1, 1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 3
ON CONFLICT DO NOTHING;

-- ===============================================
-- ADDITIONAL CALENDAR EVENTS
-- ===============================================
INSERT INTO calendar_events (
    title, description, start_time, end_time, event_type,
    case_id, location, is_all_day, reminder_minutes,
    organization_id, created_by, created_at
)
SELECT
    'Client Meeting - ' || lc.title,
    'Meeting with client to discuss case progress',
    NOW() + INTERVAL '7 days',
    NOW() + INTERVAL '7 days' + INTERVAL '1 hour',
    'MEETING',
    lc.id,
    'Office Conference Room A',
    FALSE,
    60,
    1, 1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 3
ON CONFLICT DO NOTHING;

INSERT INTO calendar_events (
    title, description, start_time, end_time, event_type,
    case_id, location, is_all_day, reminder_minutes,
    organization_id, created_by, created_at
)
SELECT
    'Deposition - ' || lc.title,
    'Witness deposition for case',
    NOW() + INTERVAL '14 days',
    NOW() + INTERVAL '14 days' + INTERVAL '4 hours',
    'DEPOSITION',
    lc.id,
    'Conference Room B',
    FALSE,
    1440,
    1, 1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE' AND lc.type = 'Civil Litigation'
LIMIT 2
ON CONFLICT DO NOTHING;

-- Print summary
DO $$
DECLARE
    template_count INT;
    variable_count INT;
    workflow_count INT;
    vendor_count INT;
    folder_count INT;
    note_count INT;
BEGIN
    SELECT COUNT(*) INTO template_count FROM ai_legal_templates;
    SELECT COUNT(*) INTO variable_count FROM ai_template_variables;
    SELECT COUNT(*) INTO workflow_count FROM invoice_workflow_rules;
    SELECT COUNT(*) INTO vendor_count FROM vendors;
    SELECT COUNT(*) INTO folder_count FROM folders;
    SELECT COUNT(*) INTO note_count FROM case_notes;

    RAISE NOTICE 'Data population summary:';
    RAISE NOTICE '  AI Legal Templates: %', template_count;
    RAISE NOTICE '  AI Template Variables: %', variable_count;
    RAISE NOTICE '  Invoice Workflow Rules: %', workflow_count;
    RAISE NOTICE '  Vendors: %', vendor_count;
    RAISE NOTICE '  Folders: %', folder_count;
    RAISE NOTICE '  Case Notes: %', note_count;
END $$;
