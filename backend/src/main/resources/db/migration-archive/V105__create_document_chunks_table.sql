-- Create document_chunks table for semantic search (RAG)
-- Documents are split into chunks for efficient embedding and retrieval

CREATE TABLE IF NOT EXISTS document_chunks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    analysis_id BIGINT NOT NULL,
    collection_id BIGINT NULL,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    section_title VARCHAR(255) NULL,
    token_count INT NULL,
    embedding JSON NULL,
    embedding_model VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_chunk_analysis_id (analysis_id),
    INDEX idx_chunk_collection_id (collection_id),
    INDEX idx_chunk_analysis_index (analysis_id, chunk_index),

    CONSTRAINT fk_chunk_analysis FOREIGN KEY (analysis_id)
        REFERENCES ai_document_analysis(id) ON DELETE CASCADE,
    CONSTRAINT fk_chunk_collection FOREIGN KEY (collection_id)
        REFERENCES document_collections(id) ON DELETE SET NULL
);
