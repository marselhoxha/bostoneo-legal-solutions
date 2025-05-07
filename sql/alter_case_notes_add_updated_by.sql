-- Add updated_by column to case_notes table if it doesn't exist
ALTER TABLE case_notes 
ADD COLUMN IF NOT EXISTS updated_by BIGINT UNSIGNED NULL,
ADD CONSTRAINT FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL; 