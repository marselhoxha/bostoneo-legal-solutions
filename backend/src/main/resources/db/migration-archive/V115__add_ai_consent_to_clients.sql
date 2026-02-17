-- P0-3: ABA Rule 1.4 Client AI Disclosure Consent
-- Add consent tracking fields to clients table (PostgreSQL)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS ai_consent_given BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_consent_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS ai_consent_notes TEXT;
