-- Drop FK constraint on case_document_id that references documents(id).
-- The column now stores IDs from file_items (current system) or documents (legacy).
-- Lookups already handle both tables via AiWorkspaceExhibitService.lookupCaseDocument().
ALTER TABLE ai_workspace_document_exhibits
    DROP CONSTRAINT IF EXISTS ai_workspace_document_exhibits_case_document_id_fkey;
