-- Add research_mode column to ai_research_cache table
-- This allows explicit filtering of cache entries by FAST/THOROUGH mode
-- Both modes use claude-sonnet-4.5, difference is in approach (quick vs agentic)

ALTER TABLE ai_research_cache ADD COLUMN research_mode VARCHAR(20);

-- Backfill existing entries based on confidence score
-- FAST mode typically has confidence_score = 0.85
-- THOROUGH mode has confidence_score = 0.90 (higher due to tool verification)
UPDATE ai_research_cache
SET research_mode = 'FAST'
WHERE confidence_score = 0.85;

UPDATE ai_research_cache
SET research_mode = 'THOROUGH'
WHERE confidence_score = 0.90;

-- Default any remaining nulls to FAST (legacy entries)
UPDATE ai_research_cache
SET research_mode = 'FAST'
WHERE research_mode IS NULL;
