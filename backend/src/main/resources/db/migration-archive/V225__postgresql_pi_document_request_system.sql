-- V225: PI Document Request System
-- Transforms document checklist "Log Request" into smart document request system

-- 1. Add contact fields to pi_medical_records for records and billing departments
ALTER TABLE pi_medical_records ADD COLUMN IF NOT EXISTS records_email VARCHAR(255);
ALTER TABLE pi_medical_records ADD COLUMN IF NOT EXISTS records_phone VARCHAR(50);
ALTER TABLE pi_medical_records ADD COLUMN IF NOT EXISTS records_fax VARCHAR(50);
ALTER TABLE pi_medical_records ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255);
ALTER TABLE pi_medical_records ADD COLUMN IF NOT EXISTS billing_phone VARCHAR(50);

-- 2. Add employer fields to legal_cases for wage documentation requests
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS employer_name VARCHAR(255);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS employer_email VARCHAR(255);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS employer_phone VARCHAR(50);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS employer_hr_contact VARCHAR(255);

-- 3. Add insurance adjuster structured contact fields (if not exists)
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS insurance_adjuster_email VARCHAR(255);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS insurance_adjuster_phone VARCHAR(50);

-- 4. Create request log table for tracking all document request attempts
CREATE TABLE IF NOT EXISTS pi_document_request_log (
    id BIGSERIAL PRIMARY KEY,
    checklist_item_id BIGINT NOT NULL REFERENCES pi_document_checklist(id) ON DELETE CASCADE,
    case_id BIGINT NOT NULL,
    organization_id BIGINT NOT NULL,

    -- Recipient info
    recipient_type VARCHAR(50) NOT NULL, -- MEDICAL_PROVIDER, BILLING_DEPT, INSURANCE_ADJUSTER, EMPLOYER_HR, POLICE_DEPT, CLIENT, WITNESS
    recipient_name VARCHAR(255),
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(50),
    recipient_fax VARCHAR(50),

    -- Communication info
    channel VARCHAR(50) NOT NULL, -- EMAIL, SMS, FAX, IN_APP
    channel_status VARCHAR(50) DEFAULT 'SENT', -- SENT, DELIVERED, FAILED, BOUNCED
    external_message_id VARCHAR(255), -- Email/SMS provider message ID

    -- Template and content
    template_id BIGINT,
    template_code VARCHAR(100),
    request_subject VARCHAR(500),
    request_body TEXT,

    -- Cost tracking
    document_fee DECIMAL(10,2),
    fee_status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, PAID, WAIVED

    -- Metadata
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_request_log_case FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_request_log_checklist ON pi_document_request_log(checklist_item_id);
CREATE INDEX IF NOT EXISTS idx_request_log_case ON pi_document_request_log(case_id);
CREATE INDEX IF NOT EXISTS idx_request_log_org ON pi_document_request_log(organization_id);

-- 5. Create request templates table
CREATE TABLE IF NOT EXISTS pi_document_request_templates (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT, -- NULL for system templates

    template_code VARCHAR(100) NOT NULL,
    template_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(100), -- MEDICAL_RECORDS, MEDICAL_BILLS, INSURANCE, WAGE_DOCUMENTATION, POLICE_REPORT, etc.
    recipient_type VARCHAR(50), -- MEDICAL_PROVIDER, BILLING_DEPT, INSURANCE_ADJUSTER, EMPLOYER_HR, POLICE_DEPT, CLIENT, WITNESS

    -- Email template
    email_subject VARCHAR(500),
    email_body TEXT,

    -- SMS template
    sms_body VARCHAR(500),

    -- Metadata
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(organization_id, template_code)
);

CREATE INDEX IF NOT EXISTS idx_request_templates_org ON pi_document_request_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_request_templates_type ON pi_document_request_templates(document_type);

-- 6. Create provider directory for reusable provider contact info
CREATE TABLE IF NOT EXISTS pi_provider_directory (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,

    -- Provider info
    provider_name VARCHAR(255) NOT NULL,
    provider_type VARCHAR(100), -- HOSPITAL, CLINIC, SPECIALIST, IMAGING, PHARMACY, etc.
    npi VARCHAR(20),

    -- Main contact
    main_phone VARCHAR(50),
    main_email VARCHAR(255),
    main_fax VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),

    -- Records department
    records_contact_name VARCHAR(255),
    records_phone VARCHAR(50),
    records_email VARCHAR(255),
    records_fax VARCHAR(50),

    -- Billing department
    billing_contact_name VARCHAR(255),
    billing_phone VARCHAR(50),
    billing_email VARCHAR(255),
    billing_fax VARCHAR(50),

    -- Fee info
    base_fee DECIMAL(10,2),
    per_page_fee DECIMAL(10,2),
    rush_fee DECIMAL(10,2),

    -- Notes
    notes TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,

    UNIQUE(organization_id, provider_name)
);

CREATE INDEX IF NOT EXISTS idx_provider_directory_org ON pi_provider_directory(organization_id);
CREATE INDEX IF NOT EXISTS idx_provider_directory_name ON pi_provider_directory(provider_name);
CREATE INDEX IF NOT EXISTS idx_provider_directory_npi ON pi_provider_directory(npi);

-- 7. Seed default system templates
INSERT INTO pi_document_request_templates (template_code, template_name, document_type, recipient_type, email_subject, email_body, sms_body, is_system, is_active)
VALUES
-- Medical Records Request
('MEDICAL_RECORDS_REQUEST', 'Medical Records Request', 'MEDICAL_RECORDS', 'MEDICAL_PROVIDER',
 'Medical Records Request - {{clientName}} | DOA: {{accidentDate}}',
 E'Dear Records Department,\n\nPlease provide complete medical records for the following patient:\n\nPatient Name: {{clientName}}\nDate of Birth: {{clientDob}}\nDates of Treatment: {{treatmentDates}}\n\nPlease include:\n- All office visit notes\n- Diagnostic imaging reports and films\n- Laboratory results\n- Treatment records\n- Billing records\n\nPlease fax records to: {{firmFax}}\nOr email to: {{firmEmail}}\n\nEnclosed: HIPAA Authorization\n\nThank you for your assistance.\n\nSincerely,\n{{senderName}}\n{{firmName}}\n{{firmPhone}}',
 'Medical records request sent for {{clientName}}. Please check your email for details. {{firmName}}',
 true, true),

-- Medical Bills Request
('MEDICAL_BILLS_REQUEST', 'Medical Bills Request', 'MEDICAL_BILLS', 'BILLING_DEPT',
 'Itemized Bill Request - {{clientName}} | Account #{{accountNumber}}',
 E'Dear Billing Department,\n\nPlease provide itemized billing statements for the following patient:\n\nPatient Name: {{clientName}}\nDate of Birth: {{clientDob}}\nDates of Service: {{treatmentDates}}\nAccount Number: {{accountNumber}}\n\nPlease include:\n- Complete itemized bill with CPT codes\n- Payment history\n- Outstanding balance\n- Any lien information\n\nPlease fax to: {{firmFax}}\nOr email to: {{firmEmail}}\n\nThank you.\n\n{{senderName}}\n{{firmName}}',
 'Billing records request sent for {{clientName}}. Please check your email. {{firmName}}',
 true, true),

-- Insurance Policy Limits Request
('INSURANCE_POLICY_REQUEST', 'Insurance Policy Limits Request', 'INSURANCE', 'INSURANCE_ADJUSTER',
 'Policy Limits Disclosure Request - Claim #{{claimNumber}} | {{clientName}} v. {{defendantName}}',
 E'Dear {{adjusterName}},\n\nRe: {{clientName}} v. {{defendantName}}\nClaim Number: {{claimNumber}}\nDate of Loss: {{accidentDate}}\n\nI represent {{clientName}} in connection with the above-referenced claim.\n\nPursuant to your duty of good faith, please provide:\n1. The declarations page showing applicable policy limits\n2. Confirmation of coverage\n3. Any policy exclusions that may apply\n\nPlease respond within 30 days.\n\nThank you for your prompt attention to this matter.\n\nSincerely,\n{{senderName}}\n{{firmName}}\n{{firmAddress}}\n{{firmPhone}}',
 'Policy limits request sent for Claim #{{claimNumber}}. Please check your email. {{firmName}}',
 true, true),

-- Wage Documentation Request
('WAGE_DOCUMENTATION_REQUEST', 'Wage Documentation Request', 'WAGE_DOCUMENTATION', 'EMPLOYER_HR',
 'Employment Verification & Wage Documentation Request - {{clientName}}',
 E'Dear Human Resources Department,\n\nWe represent {{clientName}} regarding a personal injury matter.\n\nPlease provide the following documentation:\n\n1. Employment verification letter confirming:\n   - Dates of employment\n   - Job title and duties\n   - Regular work hours\n   - Rate of pay (hourly/salary)\n\n2. Wage documentation:\n   - Pay stubs for the past 12 months\n   - Any missed work due to injury\n   - Lost overtime/bonus opportunities\n\nEnclosed: Signed authorization from {{clientName}}\n\nPlease fax to: {{firmFax}}\nOr email to: {{firmEmail}}\n\nThank you.\n\n{{senderName}}\n{{firmName}}',
 'Wage documentation request sent to your employer. Please check your email. {{firmName}}',
 true, true),

-- Police Report Request
('POLICE_REPORT_REQUEST', 'Police Report Request', 'POLICE_REPORT', 'POLICE_DEPT',
 'Police Report Request - Report #{{reportNumber}} | Date: {{accidentDate}}',
 E'Records Department,\n\nPlease provide a copy of the accident/incident report for:\n\nReport Number: {{reportNumber}}\nDate of Incident: {{accidentDate}}\nLocation: {{accidentLocation}}\nParties Involved: {{clientName}}\n\nPayment: ${{reportFee}} enclosed/will follow\n\nPlease mail to:\n{{firmName}}\n{{firmAddress}}\n\nOr fax to: {{firmFax}}\n\nThank you.\n\n{{senderName}}\n{{firmName}}',
 NULL,
 true, true),

-- Client Document Request (Photos, Statements)
('CLIENT_DOCUMENT_REQUEST', 'Client Document Request', 'PHOTOGRAPHS', 'CLIENT',
 'Document Request - Your Case #{{caseNumber}}',
 E'Dear {{clientName}},\n\nAs we discussed, we need the following documents for your case:\n\n{{requestedDocuments}}\n\nPlease send these to:\nEmail: {{firmEmail}}\nFax: {{firmFax}}\nOr upload through your client portal.\n\nIf you have any questions, please call us at {{firmPhone}}.\n\nThank you,\n{{senderName}}\n{{firmName}}',
 'Hi {{clientName}}, we need additional documents for your case. Please check your email or call us at {{firmPhone}}. {{firmName}}',
 true, true),

-- Witness Statement Request
('WITNESS_STATEMENT_REQUEST', 'Witness Statement Request', 'WITNESS', 'WITNESS',
 'Witness Statement Request - {{caseNumber}} | Incident on {{accidentDate}}',
 E'Dear {{witnessName}},\n\nYou have been identified as a witness to an incident that occurred on {{accidentDate}} at {{accidentLocation}}.\n\nWe represent {{clientName}} who was involved in this incident. Your account of what you observed would be very helpful to our case.\n\nWould you be willing to provide a brief written statement or speak with us about what you witnessed?\n\nPlease contact us at:\nPhone: {{firmPhone}}\nEmail: {{firmEmail}}\n\nThank you for your time and consideration.\n\nSincerely,\n{{senderName}}\n{{firmName}}',
 'Hi, this is {{firmName}}. You may have witnessed an incident on {{accidentDate}}. Would you be willing to share what you saw? Please call {{firmPhone}}.',
 true, true)

ON CONFLICT (organization_id, template_code) DO NOTHING;

-- 8. Add request_count to document checklist for tracking
ALTER TABLE pi_document_checklist ADD COLUMN IF NOT EXISTS request_count INTEGER DEFAULT 0;
ALTER TABLE pi_document_checklist ADD COLUMN IF NOT EXISTS last_request_at TIMESTAMP;
ALTER TABLE pi_document_checklist ADD COLUMN IF NOT EXISTS total_fee DECIMAL(10,2);

-- 9. Create function to update request count on checklist
CREATE OR REPLACE FUNCTION update_checklist_request_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE pi_document_checklist
    SET request_count = request_count + 1,
        last_request_at = NEW.sent_at
    WHERE id = NEW.checklist_item_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating request count
DROP TRIGGER IF EXISTS trg_update_request_count ON pi_document_request_log;
CREATE TRIGGER trg_update_request_count
    AFTER INSERT ON pi_document_request_log
    FOR EACH ROW
    EXECUTE FUNCTION update_checklist_request_count();

COMMENT ON TABLE pi_document_request_log IS 'Tracks all document request attempts with communication channel, recipient, and status';
COMMENT ON TABLE pi_document_request_templates IS 'Email and SMS templates for document requests';
COMMENT ON TABLE pi_provider_directory IS 'Reusable directory of medical providers and their contact information';
