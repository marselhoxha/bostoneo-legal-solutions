-- V9: Backfill practice_area from type for old cases
-- After this migration, all cases will have a practice_area value

-- Exact matches from legacy type enum
UPDATE legal_cases SET practice_area = 'Personal Injury' WHERE practice_area IS NULL AND UPPER(type) IN ('PERSONAL_INJURY', 'PERSONAL INJURY');
UPDATE legal_cases SET practice_area = 'Criminal Defense' WHERE practice_area IS NULL AND UPPER(type) = 'CRIMINAL';
UPDATE legal_cases SET practice_area = 'Family Law' WHERE practice_area IS NULL AND UPPER(type) = 'FAMILY';
UPDATE legal_cases SET practice_area = 'Immigration Law' WHERE practice_area IS NULL AND UPPER(type) IN ('IMMIGRATION');
UPDATE legal_cases SET practice_area = 'Real Estate Law' WHERE practice_area IS NULL AND UPPER(type) IN ('REAL_ESTATE', 'REAL ESTATE');
UPDATE legal_cases SET practice_area = 'Intellectual Property' WHERE practice_area IS NULL AND UPPER(type) IN ('INTELLECTUAL_PROPERTY', 'IP');
UPDATE legal_cases SET practice_area = 'Civil Litigation' WHERE practice_area IS NULL AND UPPER(type) = 'CIVIL';
UPDATE legal_cases SET practice_area = 'Estate Planning' WHERE practice_area IS NULL AND UPPER(type) IN ('ESTATE_PLANNING', 'ESTATE');
UPDATE legal_cases SET practice_area = 'Employment Law' WHERE practice_area IS NULL AND UPPER(type) IN ('EMPLOYMENT', 'EMPLOYMENT_LITIGATION');
UPDATE legal_cases SET practice_area = 'Bankruptcy' WHERE practice_area IS NULL AND UPPER(type) = 'BANKRUPTCY';
UPDATE legal_cases SET practice_area = 'Business Law' WHERE practice_area IS NULL AND UPPER(type) IN ('BUSINESS', 'CORPORATE');
UPDATE legal_cases SET practice_area = 'Tax Law' WHERE practice_area IS NULL AND UPPER(type) = 'TAX';
UPDATE legal_cases SET practice_area = 'Environmental Law' WHERE practice_area IS NULL AND UPPER(type) = 'ENVIRONMENTAL';
UPDATE legal_cases SET practice_area = 'Class Action' WHERE practice_area IS NULL AND UPPER(type) = 'CLASS_ACTION';
UPDATE legal_cases SET practice_area = 'Contract Law' WHERE practice_area IS NULL AND UPPER(type) = 'CONTRACT';

-- Keyword-based catch for descriptive type strings
UPDATE legal_cases SET practice_area = 'Employment Law' WHERE practice_area IS NULL AND UPPER(type) LIKE '%EMPLOYMENT%';
UPDATE legal_cases SET practice_area = 'Immigration Law' WHERE practice_area IS NULL AND UPPER(type) LIKE '%IMMIGRATION%';
UPDATE legal_cases SET practice_area = 'Business Law' WHERE practice_area IS NULL AND UPPER(type) LIKE '%BUSINESS%';
UPDATE legal_cases SET practice_area = 'Business Law' WHERE practice_area IS NULL AND UPPER(type) LIKE '%MERGERS%';
UPDATE legal_cases SET practice_area = 'Civil Litigation' WHERE practice_area IS NULL AND UPPER(type) LIKE '%CIVIL%';

-- Final catch-all: any remaining cases get 'Other'
UPDATE legal_cases SET practice_area = 'Other' WHERE practice_area IS NULL AND type IS NOT NULL;
UPDATE legal_cases SET practice_area = 'Other' WHERE practice_area IS NULL AND type IS NULL;
