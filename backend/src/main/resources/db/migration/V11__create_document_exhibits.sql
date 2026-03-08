CREATE TABLE IF NOT EXISTS ai_workspace_document_exhibits (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES ai_workspace_documents(id) ON DELETE CASCADE,
    organization_id BIGINT NOT NULL,
    case_document_id BIGINT REFERENCES documents(id) ON DELETE SET NULL,
    label VARCHAR(10) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    file_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000),
    mime_type VARCHAR(100),
    file_size BIGINT,
    extracted_text TEXT,
    text_extraction_status VARCHAR(20) DEFAULT 'PENDING',
    page_count INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_exhibits_document_id ON ai_workspace_document_exhibits(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_exhibits_org_id ON ai_workspace_document_exhibits(organization_id);
