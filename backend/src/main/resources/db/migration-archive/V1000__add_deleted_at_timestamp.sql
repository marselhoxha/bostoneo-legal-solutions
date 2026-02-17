-- Add deleted_at timestamp column to track when files were deleted
ALTER TABLE file_items 
ADD COLUMN deleted_at TIMESTAMP NULL;

-- Add index for efficient querying of deleted files by deletion time
CREATE INDEX idx_file_items_deleted_at ON file_items(deleted_at) WHERE deleted_at IS NOT NULL;

-- Add composite index for cleanup queries
CREATE INDEX idx_file_items_deleted_cleanup ON file_items(is_deleted, deleted_at) WHERE is_deleted = true;