-- V47: Add client's own insurance fields to legal_cases
-- Supports PIP (Personal Injury Protection) and UIM (Underinsured Motorist) claims where the attorney writes to the CLIENT's own insurer, not the defendant's.
-- Existing insurance_* columns stay unchanged — they now represent the DEFENDANT's insurance.
-- PostgreSQL syntax.

ALTER TABLE legal_cases
    ADD COLUMN IF NOT EXISTS client_insurance_company VARCHAR(255),
    ADD COLUMN IF NOT EXISTS client_insurance_policy_number VARCHAR(255),
    ADD COLUMN IF NOT EXISTS client_insurance_adjuster_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS client_insurance_adjuster_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS client_insurance_adjuster_phone VARCHAR(50);

COMMENT ON COLUMN legal_cases.client_insurance_company
    IS 'Client own insurer — used for PIP and UIM claim correspondence. Separate from insurance_company (defendant-side).';
