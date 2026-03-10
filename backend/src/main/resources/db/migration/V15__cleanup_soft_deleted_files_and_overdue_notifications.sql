-- V15: Clean up soft-deleted file_items and their related records,
-- and purge duplicate overdue workflow notifications.
-- Soft-delete is being replaced with hard-delete for case files.

-- 1. Delete related records for soft-deleted file_items
DELETE FROM file_access_logs
WHERE file_id IN (SELECT id FROM file_items WHERE is_deleted = true);

DELETE FROM file_comments
WHERE file_id IN (SELECT id FROM file_items WHERE is_deleted = true);

DELETE FROM file_tags
WHERE file_id IN (SELECT id FROM file_items WHERE is_deleted = true);

DELETE FROM file_shares
WHERE file_id IN (SELECT id FROM file_items WHERE is_deleted = true);

DELETE FROM file_versions
WHERE file_id IN (SELECT id FROM file_items WHERE is_deleted = true);

DELETE FROM file_permissions
WHERE file_id IN (SELECT id FROM file_items WHERE is_deleted = true);

DELETE FROM ai_editing_sessions
WHERE file_id IN (SELECT id FROM file_items WHERE is_deleted = true);

DELETE FROM ai_closing_documents
WHERE file_id IN (SELECT id FROM file_items WHERE is_deleted = true);

-- Clean up exhibit records pointing to soft-deleted files
DELETE FROM ai_workspace_document_exhibits
WHERE case_document_id IN (SELECT id FROM file_items WHERE is_deleted = true);

-- 2. Delete the soft-deleted file_items themselves
DELETE FROM file_items WHERE is_deleted = true;

-- 3. Delete all workflow suggestion notifications (scheduler disabled for now)
DELETE FROM user_notifications
WHERE type = 'WORKFLOW_SUGGESTION';
