-- Performance optimization indexes for AI Document Analysis system
-- These indexes were applied manually on 2025-12-15
-- This file is kept for reference and Flyway history

-- AI Document Analysis: idx_analysis_user_status_date, idx_analysis_case_created, idx_analysis_detected_type
-- Document Chunks: idx_chunks_collection_created, idx_chunks_section
-- Document Collections: idx_collections_user_updated, idx_collections_case_created
-- Collection Documents: idx_collection_docs_added, idx_collection_docs_analysis
-- Collection Search Cache: idx_search_cache_expires, idx_search_cache_lookup
-- Research Conversations: idx_research_conv_user_updated, idx_research_conv_case_updated
-- Research Session: idx_research_session_user_updated

SELECT 'Performance indexes already applied' AS status;
