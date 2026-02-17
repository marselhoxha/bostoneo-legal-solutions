-- Remove incorrect foreign key constraints from document_generations
-- These tables (drafting_sessions, document_templates) don't exist in this context
-- session_id and template_id are optional fields that don't need FK constraints

-- Note: These constraints were already dropped manually, this migration is for documentation
-- ALTER TABLE document_generations DROP FOREIGN KEY document_generations_ibfk_2;
-- ALTER TABLE document_generations DROP FOREIGN KEY document_generations_ibfk_3;

-- Nothing to do - constraints already removed
SELECT 'Foreign key constraints already removed' AS status;
