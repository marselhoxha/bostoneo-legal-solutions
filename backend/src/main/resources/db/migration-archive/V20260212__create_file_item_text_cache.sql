-- PostgreSQL: Create text cache table for extracted document text (used by AI research)
CREATE TABLE IF NOT EXISTS file_item_text_cache (
    id              BIGSERIAL PRIMARY KEY,
    file_item_id    BIGINT NOT NULL,
    organization_id BIGINT NOT NULL,
    extracted_text  TEXT,
    extraction_status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, success, failed, unsupported
    error_message   VARCHAR(500),
    char_count      INTEGER DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_file_item_text_cache_file_item
        FOREIGN KEY (file_item_id) REFERENCES file_items(id) ON DELETE CASCADE,

    CONSTRAINT uq_file_item_text_cache_file_org
        UNIQUE (file_item_id, organization_id)
);

-- Index for fast lookup by file_item_id + organization_id (covered by unique constraint)
-- Index for bulk lookup by multiple file_item_ids within an org
CREATE INDEX idx_file_item_text_cache_org_id ON file_item_text_cache(organization_id);
