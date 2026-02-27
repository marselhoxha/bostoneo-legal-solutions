-- Fix user_events.created_at: add DEFAULT NOW() and backfill NULLs
-- Root cause: INSERT queries never included created_at, and column had no default

-- 1. Add default value so new inserts always get a timestamp
ALTER TABLE user_events ALTER COLUMN created_at SET DEFAULT NOW();

-- 2. Backfill existing NULLs with NOW() (approximate, but better than NULL)
UPDATE user_events SET created_at = NOW() WHERE created_at IS NULL;
