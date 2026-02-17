-- Migration: Add organization_id to document_chunks table
-- This is a critical security fix for multi-tenant data isolation (RAG/semantic search)

-- Add organization_id to document_chunks
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Backfill organization_id based on the analysis's document's organization
-- (DocumentChunk -> analysis_id -> ai_document_analysis -> document_id -> documents -> organization_id)
UPDATE document_chunks dc
SET organization_id = (
    SELECT d.organization_id
    FROM ai_document_analysis ada
    JOIN documents d ON d.id = ada.document_id
    WHERE ada.id = dc.analysis_id
)
WHERE dc.organization_id IS NULL AND dc.analysis_id IS NOT NULL;

-- Set default organization for any remaining records (fallback to org 1)
UPDATE document_chunks SET organization_id = 1 WHERE organization_id IS NULL;

-- Make the column NOT NULL after backfill
ALTER TABLE document_chunks ALTER COLUMN organization_id SET NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_chunks_org ON document_chunks(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_org_analysis ON document_chunks(organization_id, analysis_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_org_collection ON document_chunks(organization_id, collection_id);

-- Add foreign key constraint
ALTER TABLE document_chunks
    ADD CONSTRAINT fk_document_chunks_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);
