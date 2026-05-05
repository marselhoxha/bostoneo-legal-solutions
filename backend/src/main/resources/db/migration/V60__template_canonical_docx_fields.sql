-- Path-C canonical pipeline: every template internally stored as DOCX.
-- These fields support the wizard preview (rendered_pdf_binary), the "re-derive after
-- variable rename" path (original_document_binary), and the "regenerate on edit" gate
-- (rendered_pdf_stale).
--
-- All columns NULL-able / default false: existing templates work as-is, only
-- get populated when re-imported or re-saved through the new pipeline.

ALTER TABLE ai_legal_templates
    ADD COLUMN IF NOT EXISTS original_document_binary BYTEA,
    ADD COLUMN IF NOT EXISTS original_document_format VARCHAR(16),
    ADD COLUMN IF NOT EXISTS rendered_pdf_binary       BYTEA,
    ADD COLUMN IF NOT EXISTS rendered_pdf_stale        BOOLEAN DEFAULT FALSE;
