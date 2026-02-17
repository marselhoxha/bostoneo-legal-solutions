-- V28: Fix image URLs and reset legacy unread counts
-- PostgreSQL migration

-- Fix 1: Convert absolute localhost image URLs to relative paths
UPDATE users
SET image_url = REPLACE(image_url, 'http://localhost:8085', '')
WHERE image_url LIKE 'http://localhost:8085%';

-- Fix 2: Ensure relative image paths start with /
UPDATE users
SET image_url = '/' || image_url
WHERE image_url IS NOT NULL
  AND image_url != ''
  AND image_url NOT LIKE '/%'
  AND image_url NOT LIKE 'http%';

-- Fix 3: Reset legacy unread_by_attorney to 0 for ALL threads
-- The per-attorney status table (thread_attorney_status) is the source of truth now
-- Non-zero values in this legacy field cause stale unread counts when
-- ensureAttorneyStatusExists() creates new records using this as fallback
UPDATE message_threads SET unread_by_attorney = 0 WHERE unread_by_attorney > 0;
