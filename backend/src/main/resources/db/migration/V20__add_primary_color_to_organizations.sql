-- Add primary brand color for email template customization
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7) DEFAULT '#405189';
