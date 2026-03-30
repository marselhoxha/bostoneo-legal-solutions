-- V34: Add terms_accepted_at column to users table
-- Tracks when a user accepted the current Terms of Service
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP NULL;
