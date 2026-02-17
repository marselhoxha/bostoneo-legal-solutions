-- Create document_relationships table for linking related documents
-- Examples: Amendment -> Original Contract, Answer -> Complaint, Exhibit -> Motion

CREATE TABLE document_relationships (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    source_analysis_id BIGINT NOT NULL,
    target_analysis_id BIGINT NOT NULL,
    relationship_type VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,

    CONSTRAINT fk_doc_rel_source FOREIGN KEY (source_analysis_id)
        REFERENCES ai_document_analysis(id) ON DELETE CASCADE,
    CONSTRAINT fk_doc_rel_target FOREIGN KEY (target_analysis_id)
        REFERENCES ai_document_analysis(id) ON DELETE CASCADE,
    CONSTRAINT uk_document_relationship UNIQUE (source_analysis_id, target_analysis_id, relationship_type)
);

-- Indexes for efficient querying
CREATE INDEX idx_doc_rel_source ON document_relationships(source_analysis_id);
CREATE INDEX idx_doc_rel_target ON document_relationships(target_analysis_id);
CREATE INDEX idx_doc_rel_type ON document_relationships(relationship_type);
