-- V227: Add practice area specific fields for case creation
-- Supports: Criminal Defense, Family Law, Immigration, Real Estate, Intellectual Property
-- Personal Injury fields already exist from V221

-- Add practice_area column if not exists
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS practice_area VARCHAR(50);

-- Criminal Defense fields
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS primary_charge VARCHAR(255);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS charge_level VARCHAR(50);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS docket_number VARCHAR(100);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS bail_amount DECIMAL(15,2);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS arrest_date DATE;
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS prosecutor_name VARCHAR(255);

-- Family Law fields
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS case_subtype VARCHAR(100);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS spouse_name VARCHAR(255);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS marriage_date DATE;
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS separation_date DATE;
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS has_minor_children BOOLEAN DEFAULT FALSE;
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS children_count INTEGER;
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS custody_arrangement VARCHAR(100);

-- Immigration fields
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS form_type VARCHAR(50);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS uscis_number VARCHAR(100);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS petitioner_name VARCHAR(255);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS beneficiary_name VARCHAR(255);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS priority_date DATE;
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS visa_category VARCHAR(100);

-- Real Estate fields
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS property_address TEXT;
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(15,2);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS closing_date DATE;
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS buyer_name VARCHAR(255);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS seller_name VARCHAR(255);

-- Intellectual Property fields
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS ip_type VARCHAR(50);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS application_number VARCHAR(100);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS ip_filing_date DATE;
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS inventor_name VARCHAR(255);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS technology_area VARCHAR(255);

-- Index for practice_area
CREATE INDEX IF NOT EXISTS idx_legal_cases_practice_area ON legal_cases(practice_area) WHERE practice_area IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN legal_cases.practice_area IS 'Practice area: Personal Injury, Criminal Defense, Family Law, Immigration Law, Real Estate Law, Intellectual Property';
COMMENT ON COLUMN legal_cases.primary_charge IS 'Criminal: Primary charge description';
COMMENT ON COLUMN legal_cases.charge_level IS 'Criminal: FELONY, MISDEMEANOR, VIOLATION, INFRACTION';
COMMENT ON COLUMN legal_cases.case_subtype IS 'Family: DIVORCE, CUSTODY, CHILD_SUPPORT, ALIMONY, ADOPTION, PATERNITY';
COMMENT ON COLUMN legal_cases.form_type IS 'Immigration: I-130, I-140, I-485, I-765, I-131, N-400';
COMMENT ON COLUMN legal_cases.transaction_type IS 'Real Estate: PURCHASE, SALE, LEASE, REFINANCE, TITLE_REVIEW';
COMMENT ON COLUMN legal_cases.ip_type IS 'IP: PATENT, TRADEMARK, COPYRIGHT, TRADE_SECRET';

-- Update existing cases with practice area based on type
UPDATE legal_cases
SET practice_area = CASE
    WHEN type = 'CRIMINAL' THEN 'Criminal Defense'
    WHEN type = 'FAMILY' THEN 'Family Law'
    WHEN type = 'IMMIGRATION' THEN 'Immigration Law'
    WHEN type = 'REAL_ESTATE' THEN 'Real Estate Law'
    WHEN type = 'INTELLECTUAL_PROPERTY' THEN 'Intellectual Property'
    WHEN type = 'CIVIL' THEN 'Personal Injury'
    ELSE NULL
END
WHERE practice_area IS NULL;
