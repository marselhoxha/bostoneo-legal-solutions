-- Add ai_consent_token column to clients table for email consent flow
-- PostgreSQL migration
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ai_consent_token VARCHAR(255);
