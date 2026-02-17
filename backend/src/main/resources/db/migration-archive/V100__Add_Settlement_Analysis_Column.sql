-- V100: Add settlement_analysis column to pi_damage_calculations table
-- This stores the AI settlement analysis from case value calculation

ALTER TABLE pi_damage_calculations
ADD COLUMN IF NOT EXISTS settlement_analysis JSONB;

-- Add comment for documentation
COMMENT ON COLUMN pi_damage_calculations.settlement_analysis IS 'Stores AI settlement analysis including case strength, key factors, recommendations, and settlement ranges';
