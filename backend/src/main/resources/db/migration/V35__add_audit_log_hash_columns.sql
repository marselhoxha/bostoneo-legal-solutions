-- Add tamper-detection hash columns to audit_log table
-- These columns were added to the AuditLog JPA entity but missing from production schema
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS previous_hash VARCHAR(64);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS entry_hash VARCHAR(64);
