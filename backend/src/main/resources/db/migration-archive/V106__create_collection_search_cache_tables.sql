-- Collection Search Cache Table
-- Stores cached search results to avoid repeated API calls
CREATE TABLE IF NOT EXISTS collection_search_cache (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    collection_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    query VARCHAR(500) NOT NULL,
    query_hash VARCHAR(64) NOT NULL,
    expanded_query VARCHAR(1000),
    results_json LONGTEXT,
    result_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    UNIQUE KEY uk_collection_query_user (collection_id, query_hash, user_id),
    INDEX idx_collection_id (collection_id),
    INDEX idx_expires_at (expires_at),
    FOREIGN KEY (collection_id) REFERENCES document_collections(id) ON DELETE CASCADE
);

-- Collection Search History Table
-- Stores search history for autocomplete suggestions
CREATE TABLE IF NOT EXISTS collection_search_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    collection_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    query VARCHAR(500) NOT NULL,
    result_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_collection_user (collection_id, user_id),
    INDEX idx_query (query(100)),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (collection_id) REFERENCES document_collections(id) ON DELETE CASCADE
);
