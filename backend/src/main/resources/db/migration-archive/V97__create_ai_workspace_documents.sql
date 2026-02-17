-- AI Workspace Documents and Versions Schema (MySQL)
-- Supports document generation, editing, versioning, and transformation tracking

-- Main documents table
CREATE TABLE IF NOT EXISTS ai_workspace_documents (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_id BIGINT UNSIGNED,
    case_id BIGINT UNSIGNED,
    user_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(500) NOT NULL,
    current_version INT DEFAULT 1,
    document_type VARCHAR(100),
    jurisdiction VARCHAR(100),
    status VARCHAR(50) DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    FOREIGN KEY (session_id) REFERENCES ai_conversation_sessions(id) ON DELETE SET NULL,
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Document versions table - stores all version history
CREATE TABLE IF NOT EXISTS ai_workspace_document_versions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    document_id BIGINT UNSIGNED NOT NULL,
    version_number INT NOT NULL,
    content TEXT NOT NULL,
    content_html TEXT,
    word_count INT,
    transformation_type VARCHAR(50),
    transformation_scope VARCHAR(20),
    selected_text TEXT,
    selection_start_index INT,
    selection_end_index INT,
    created_by_user BOOLEAN DEFAULT FALSE,
    tokens_used INT,
    cost_estimate DECIMAL(10,4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_doc_version (document_id, version_number),
    FOREIGN KEY (document_id) REFERENCES ai_workspace_documents(id) ON DELETE CASCADE
);

-- Document citations table - tracks all citations in document
CREATE TABLE IF NOT EXISTS ai_workspace_document_citations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    document_id BIGINT UNSIGNED NOT NULL,
    version_id BIGINT UNSIGNED,
    citation_text VARCHAR(500) NOT NULL,
    case_id BIGINT UNSIGNED,
    position_start INT,
    position_end INT,
    citation_format VARCHAR(50),
    is_verified BOOLEAN DEFAULT FALSE,
    verification_result TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES ai_workspace_documents(id) ON DELETE CASCADE,
    FOREIGN KEY (version_id) REFERENCES ai_workspace_document_versions(id) ON DELETE CASCADE
);

-- Document comments/annotations table (for Phase 4)
CREATE TABLE IF NOT EXISTS ai_workspace_document_comments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    document_id BIGINT UNSIGNED NOT NULL,
    version_id BIGINT UNSIGNED,
    user_id BIGINT UNSIGNED NOT NULL,
    comment_text TEXT NOT NULL,
    position_start INT,
    position_end INT,
    is_resolved BOOLEAN DEFAULT FALSE,
    parent_comment_id BIGINT UNSIGNED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES ai_workspace_documents(id) ON DELETE CASCADE,
    FOREIGN KEY (version_id) REFERENCES ai_workspace_document_versions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES ai_workspace_document_comments(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_workspace_docs_session ON ai_workspace_documents(session_id);
CREATE INDEX idx_workspace_docs_case ON ai_workspace_documents(case_id);
CREATE INDEX idx_workspace_docs_user ON ai_workspace_documents(user_id);
CREATE INDEX idx_workspace_docs_type ON ai_workspace_documents(document_type);
CREATE INDEX idx_workspace_docs_status ON ai_workspace_documents(status);
CREATE INDEX idx_workspace_docs_created ON ai_workspace_documents(created_at DESC);

CREATE INDEX idx_workspace_versions_doc ON ai_workspace_document_versions(document_id);
CREATE INDEX idx_workspace_versions_created ON ai_workspace_document_versions(created_at DESC);

CREATE INDEX idx_workspace_citations_doc ON ai_workspace_document_citations(document_id);
CREATE INDEX idx_workspace_citations_version ON ai_workspace_document_citations(version_id);
CREATE INDEX idx_workspace_citations_verified ON ai_workspace_document_citations(is_verified);

CREATE INDEX idx_workspace_comments_doc ON ai_workspace_document_comments(document_id);
CREATE INDEX idx_workspace_comments_user ON ai_workspace_document_comments(user_id);
CREATE INDEX idx_workspace_comments_resolved ON ai_workspace_document_comments(is_resolved);
