-- Fix client email uniqueness: change from global unique to per-organization unique.
-- This allows different organizations to have clients with the same email.
-- Drop unique constraint on email (name may vary between environments)
DO $$
DECLARE
    cname text;
BEGIN
    SELECT tc.constraint_name INTO cname
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_name = 'clients' AND tc.constraint_type = 'UNIQUE' AND ccu.column_name = 'email'
    LIMIT 1;
    IF cname IS NOT NULL THEN
        EXECUTE 'ALTER TABLE clients DROP CONSTRAINT ' || cname;
    END IF;
END $$;

-- Also drop any unique index on email alone
DROP INDEX IF EXISTS uksrv16ica2c1csub334bxjjb59;

-- Create new unique index per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_email_org ON clients (email, organization_id) WHERE email IS NOT NULL;
