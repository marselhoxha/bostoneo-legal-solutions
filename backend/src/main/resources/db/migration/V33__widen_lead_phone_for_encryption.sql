-- V33: Widen leads.phone from VARCHAR(30) to TEXT to accommodate encrypted values
-- AES-256 CBC encrypted phone numbers produce ~120-150 char Base64 strings, exceeding the old 30-char limit.
ALTER TABLE leads ALTER COLUMN phone TYPE TEXT;
