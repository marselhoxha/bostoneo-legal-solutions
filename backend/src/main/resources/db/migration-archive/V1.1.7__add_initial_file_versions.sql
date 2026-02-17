-- Create initial versions for existing files that don't have any versions
INSERT INTO file_versions (
    file_id,
    version_number,
    file_name,
    file_path,
    size,
    mime_type,
    uploaded_by_id,
    uploaded_at,
    comment,
    is_current,
    checksum
)
SELECT 
    f.id,
    '1',
    f.name,
    f.file_path,
    f.size,
    f.mime_type,
    f.created_by,
    f.created_at,
    'Initial version',
    true,
    f.checksum
FROM file_items f
WHERE f.is_deleted = false
AND NOT EXISTS (
    SELECT 1 FROM file_versions v WHERE v.file_id = f.id
);