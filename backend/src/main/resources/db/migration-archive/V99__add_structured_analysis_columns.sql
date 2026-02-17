-- Add structured analysis columns for full-page document viewer
-- These columns store parsed sections from AI analysis for better performance and UX

ALTER TABLE ai_document_analysis
ADD COLUMN executive_summary TEXT COMMENT 'Executive summary section extracted from analysis',
ADD COLUMN weaknesses TEXT COMMENT 'Weaknesses/critical issues section extracted from analysis',
ADD COLUMN evidence_gaps TEXT COMMENT 'Evidence gaps/missing authorities section extracted from analysis',
ADD COLUMN recommended_strategy TEXT COMMENT 'Recommended strategy section extracted from analysis',
ADD COLUMN full_analysis TEXT COMMENT 'Complete analysis markdown (with JSON block removed)';

-- Add indexes for better query performance
CREATE INDEX idx_analysis_status ON ai_document_analysis(status);
CREATE INDEX idx_analysis_user_created ON ai_document_analysis(user_id, created_at);
