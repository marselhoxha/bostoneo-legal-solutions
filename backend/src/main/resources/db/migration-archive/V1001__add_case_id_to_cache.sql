-- Add case_id column to ai_research_cache table to prevent cross-case cache pollution
-- CRITICAL BUG FIX: Similarity matching was returning results from different cases
-- because there was no case_id filter

ALTER TABLE ai_research_cache ADD COLUMN case_id VARCHAR(50);

-- Add index for performance when filtering by case
CREATE INDEX idx_ai_research_cache_case_id ON ai_research_cache(case_id);

-- Note: Existing entries will have NULL case_id
-- This is okay - NULL means "general" (not tied to specific case)
-- New entries will store the actual case ID for proper isolation
