-- Rename court_name column to county_name in legal_cases table
-- This change reflects that attorneys need county name instead of court name

ALTER TABLE legal_cases
    CHANGE COLUMN court_name county_name VARCHAR(255) DEFAULT NULL;
