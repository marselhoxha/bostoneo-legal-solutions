-- Fix any NULL values in is_starred column
UPDATE file_items 
SET is_starred = false 
WHERE is_starred IS NULL;

-- Ensure the column has a default value
ALTER TABLE file_items 
ALTER COLUMN is_starred SET DEFAULT false;

-- Add NOT NULL constraint if not already present
ALTER TABLE file_items 
ALTER COLUMN is_starred SET NOT NULL;