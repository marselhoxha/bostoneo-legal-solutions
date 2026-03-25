-- Add adjuster defense analysis persistence to pi_medical_summaries
ALTER TABLE pi_medical_summaries ADD COLUMN IF NOT EXISTS adjuster_defense_analysis JSONB;
ALTER TABLE pi_medical_summaries ADD COLUMN IF NOT EXISTS adjuster_analysis_generated_at TIMESTAMP;
