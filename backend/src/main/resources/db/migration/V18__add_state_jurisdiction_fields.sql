-- Add state field to organizations (2-letter US state code, e.g., 'TX', 'MA')
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS state VARCHAR(2);

-- Add jurisdiction field to legal_cases (full state name, e.g., 'Texas', 'Massachusetts')
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR(50);

-- Backfill existing organizations with 'MA' (backward compatible — current users are Massachusetts-based)
UPDATE organizations SET state = 'MA' WHERE state IS NULL;
