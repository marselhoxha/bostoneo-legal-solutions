-- Fix client email uniqueness: change from global unique to per-organization unique.
-- This allows different organizations to have clients with the same email.
ALTER TABLE clients DROP CONSTRAINT IF EXISTS uksrv16ica2c1csub334bxjjb59;
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_email_org ON clients (email, organization_id);
