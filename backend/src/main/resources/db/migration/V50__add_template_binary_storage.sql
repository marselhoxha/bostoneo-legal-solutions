-- V50 — Sprint 1.6: Visual-fidelity template storage
-- Persists the tokenized DOCX/PDF binary alongside the plain-text template_content
-- so imported templates can be re-rendered with preserved formatting at draft time.
-- PostgreSQL (legience DB)

ALTER TABLE ai_legal_templates
  ADD COLUMN IF NOT EXISTS template_binary        BYTEA,            -- tokenized DOCX or PDF bytes
  ADD COLUMN IF NOT EXISTS template_binary_format VARCHAR(10),      -- 'DOCX' | 'PDF'
  ADD COLUMN IF NOT EXISTS has_binary_template    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS binary_sha256          VARCHAR(64),      -- SHA-256 of template_binary
  ADD COLUMN IF NOT EXISTS binary_size_bytes      INTEGER;          -- pre-computed size for UI

-- Cheap drafting-fork filter: "does this template have a binary?"
CREATE INDEX IF NOT EXISTS idx_templates_has_binary
  ON ai_legal_templates(id)
  WHERE has_binary_template = TRUE;
