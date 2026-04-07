-- V38: Fix audit_log metadata column type from text to jsonb
-- The AuditLog JPA entity expects jsonb but staging DB has text.
-- Only runs the ALTER if the column is not already jsonb.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'audit_log' AND column_name = 'metadata' AND data_type = 'text'
    ) THEN
        -- Null out any non-JSON values before casting
        UPDATE audit_log SET metadata = NULL
        WHERE metadata IS NOT NULL AND metadata !~ '^\s*[\{\[]';
        -- Convert text → jsonb
        ALTER TABLE audit_log ALTER COLUMN metadata TYPE jsonb USING metadata::jsonb;
    END IF;
END $$;
