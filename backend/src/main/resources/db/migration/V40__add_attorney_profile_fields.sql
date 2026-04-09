-- Add professional contact and office fields for attorney profiles
-- Used in demand letters, motions, and stationery
ALTER TABLE attorneys ADD COLUMN IF NOT EXISTS direct_phone VARCHAR(50);
ALTER TABLE attorneys ADD COLUMN IF NOT EXISTS fax VARCHAR(50);
ALTER TABLE attorneys ADD COLUMN IF NOT EXISTS office_street VARCHAR(255);
ALTER TABLE attorneys ADD COLUMN IF NOT EXISTS office_suite VARCHAR(100);
ALTER TABLE attorneys ADD COLUMN IF NOT EXISTS office_city VARCHAR(100);
ALTER TABLE attorneys ADD COLUMN IF NOT EXISTS office_state VARCHAR(50);
ALTER TABLE attorneys ADD COLUMN IF NOT EXISTS office_zip VARCHAR(20);
ALTER TABLE attorneys ADD COLUMN IF NOT EXISTS firm_name VARCHAR(255);
