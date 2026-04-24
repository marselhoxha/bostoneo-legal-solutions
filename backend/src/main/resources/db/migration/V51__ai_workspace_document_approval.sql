-- V51: Per-document attorney review state for ai_workspace_documents
--
-- Before this migration, approvalStatus was a template-level property read from
-- the DocumentTypeTemplate JSON. That meant watermarks could only clear when an
-- engineer edited the template file — not when a specific attorney reviewed a
-- specific document. Per ABA Opinion 512 (attorney verification of AI output),
-- each generated draft needs its own reviewable state.
--
-- Mirrors the schema already on intake_submissions (reviewed_by/reviewed_at/notes)
-- and ai_conversation_messages (reviewed_by_user_id/reviewed_at).
--
-- Priority: doc.approval_status overrides template approvalStatus when set;
-- NULL falls back to the template default.

ALTER TABLE ai_workspace_documents
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(30) DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS reviewed_by_user_id BIGINT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS review_requested_by_user_id BIGINT,
  ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMP;

-- Foreign keys to users table — reviewer audit trail.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_ai_doc_reviewed_by'
      AND table_name = 'ai_workspace_documents'
  ) THEN
    ALTER TABLE ai_workspace_documents
      ADD CONSTRAINT fk_ai_doc_reviewed_by
      FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_ai_doc_review_requested_by'
      AND table_name = 'ai_workspace_documents'
  ) THEN
    ALTER TABLE ai_workspace_documents
      ADD CONSTRAINT fk_ai_doc_review_requested_by
      FOREIGN KEY (review_requested_by_user_id) REFERENCES users(id);
  END IF;
END $$;

-- Speed up dashboards / "awaiting review" filters.
CREATE INDEX IF NOT EXISTS idx_ai_workspace_docs_approval_status
  ON ai_workspace_documents(approval_status);

-- Backfill existing rows: any existing doc counts as 'draft' so watermark rules apply.
UPDATE ai_workspace_documents
  SET approval_status = 'draft'
  WHERE approval_status IS NULL;
