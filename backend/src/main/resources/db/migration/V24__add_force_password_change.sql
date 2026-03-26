-- Add force_password_change flag to users table
-- When true, user must change password on next login (used for superadmin-created temp passwords)
ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN NOT NULL DEFAULT FALSE;
