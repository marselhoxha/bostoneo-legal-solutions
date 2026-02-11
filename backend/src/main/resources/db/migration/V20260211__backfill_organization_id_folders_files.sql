-- Backfill organization_id on folders where it is NULL
-- Derive from the created_by user's organization
UPDATE folders f
SET organization_id = (
    SELECT u.organization_id
    FROM users u
    WHERE u.id = f.created_by
    LIMIT 1
)
WHERE f.organization_id IS NULL
  AND f.created_by IS NOT NULL;

-- Backfill organization_id on file_items where it is NULL
UPDATE file_items fi
SET organization_id = (
    SELECT u.organization_id
    FROM users u
    WHERE u.id = fi.created_by
    LIMIT 1
)
WHERE fi.organization_id IS NULL
  AND fi.created_by IS NOT NULL;
