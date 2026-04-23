-- V48 — Sprint 1.5: Template import metadata + privacy scoping
-- Supports PDF/DOCX/DOC upload pipeline: traceability, dedup, per-user privacy
-- PostgreSQL (legience DB)

ALTER TABLE ai_legal_templates
  ADD COLUMN IF NOT EXISTS source_type         VARCHAR(20),         -- 'MANUAL' | 'IMPORTED_DOCX' | 'IMPORTED_PDF' | 'IMPORTED_DOC'
  ADD COLUMN IF NOT EXISTS source_filename     VARCHAR(512),        -- original filename (e.g. 'MA-LOR.docx')
  ADD COLUMN IF NOT EXISTS import_batch_id     UUID,                -- groups templates imported together
  ADD COLUMN IF NOT EXISTS import_confidence   NUMERIC(3,2),        -- Claude's classification confidence 0.00–1.00
  ADD COLUMN IF NOT EXISTS is_private          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS imported_by_user_id BIGINT,
  ADD COLUMN IF NOT EXISTS imported_at         TIMESTAMP,
  ADD COLUMN IF NOT EXISTS content_hash        VARCHAR(64);          -- SHA-256 of extracted body for dedup

-- Preserve referential integrity: if a user is deleted, keep the template, null out the reference
ALTER TABLE ai_legal_templates
  DROP CONSTRAINT IF EXISTS fk_templates_imported_by_user;

ALTER TABLE ai_legal_templates
  ADD CONSTRAINT fk_templates_imported_by_user
    FOREIGN KEY (imported_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Dedup lookups: find existing templates with same extracted-text hash, scoped per org
CREATE INDEX IF NOT EXISTS idx_templates_content_hash_org
  ON ai_legal_templates(organization_id, content_hash)
  WHERE content_hash IS NOT NULL;

-- Batch review: group templates by the import session they belong to
CREATE INDEX IF NOT EXISTS idx_templates_import_batch
  ON ai_legal_templates(import_batch_id)
  WHERE import_batch_id IS NOT NULL;

-- Private-template visibility checks: find private templates for a given user quickly
CREATE INDEX IF NOT EXISTS idx_templates_private_owner
  ON ai_legal_templates(imported_by_user_id)
  WHERE is_private = TRUE;

-- Source-filter in template library UI
CREATE INDEX IF NOT EXISTS idx_templates_source_type_org
  ON ai_legal_templates(organization_id, source_type)
  WHERE source_type IS NOT NULL;

-- Backfill: everything that existed before this migration is manual
UPDATE ai_legal_templates SET source_type = 'MANUAL' WHERE source_type IS NULL;
