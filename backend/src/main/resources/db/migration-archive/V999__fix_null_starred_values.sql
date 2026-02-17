-- Update any null starred values to false
UPDATE file_items 
SET is_starred = false 
WHERE is_starred IS NULL;

-- Make sure the column has a default value
ALTER TABLE file_items 
ALTER COLUMN is_starred SET DEFAULT false;