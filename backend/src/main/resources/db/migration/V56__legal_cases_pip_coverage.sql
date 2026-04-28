-- ============================================================================
-- V56 — Add PIP coverage fields to legal_cases (Tier 3)
-- ============================================================================
-- Tier 3 of LegiPI medical records overhaul: structured insurance metadata
-- pulled from PIP logs / insurance payment ledgers. These fields populate the
-- "Coverage Summary" card on the Medical Records tab and feed the demand-letter
-- chronology's Case Header section.
--
-- The CLIENT-side insurance coverage (PIP / UIM) is what's tracked here, NOT
-- the defendant's bodily-injury policy. Existing client_insurance_company /
-- client_insurance_policy_number columns already exist on legal_cases — these
-- new columns extend that group with PIP-specific coverage data:
--   * Claim number (e.g., "AU10769451") — distinct from policy number
--   * PIP limit (typically $8,000 in MA)
--   * Deductible amount + amount actually paid
--
-- Paid-to-date is NOT stored here on purpose — it lives on the INSURANCE_LEDGER
-- record's paidAmount field, which is the source of truth from the PIP log
-- itself. Having two places to keep it in sync would create drift.
-- ============================================================================

-- Encrypted at the app layer (EncryptedStringConverter). Plain text stored as
-- TEXT to accommodate AES-GCM + base64 ciphertext expansion (~3-4× plaintext);
-- a typical claim number is 10-15 chars but encrypted lands around 60-80 bytes.
ALTER TABLE legal_cases
    ADD COLUMN IF NOT EXISTS client_insurance_claim_number TEXT;

-- Numeric coverage values — kept as DOUBLE to match the existing
-- insurance_policy_limit column convention. PIP limits in MA are typically
-- $8,000; deductibles vary $250–$2,000.
ALTER TABLE legal_cases
    ADD COLUMN IF NOT EXISTS client_insurance_pip_limit DOUBLE PRECISION;

ALTER TABLE legal_cases
    ADD COLUMN IF NOT EXISTS client_insurance_pip_deductible DOUBLE PRECISION;

ALTER TABLE legal_cases
    ADD COLUMN IF NOT EXISTS client_insurance_pip_deductible_paid DOUBLE PRECISION;

COMMENT ON COLUMN legal_cases.client_insurance_claim_number IS 'PIP claim number from insurance carrier (e.g., "AU10769451"). Encrypted at app layer. Populated from PIP_LOG documents during medical scan.';
COMMENT ON COLUMN legal_cases.client_insurance_pip_limit IS 'PIP coverage limit in dollars (typically $8,000 in MA). Populated from PIP_LOG documents.';
COMMENT ON COLUMN legal_cases.client_insurance_pip_deductible IS 'PIP deductible amount in dollars.';
COMMENT ON COLUMN legal_cases.client_insurance_pip_deductible_paid IS 'PIP deductible amount actually paid by client to date.';
