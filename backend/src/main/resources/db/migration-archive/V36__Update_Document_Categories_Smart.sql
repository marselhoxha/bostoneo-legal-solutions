-- V36: Smart update of document categories to RBAC model

-- First, let's analyze what we have
SELECT 'Current category distribution:' as info;
SELECT category, COUNT(*) as count FROM legaldocument GROUP BY category;

-- Update documents based on both type AND existing category for better mapping
UPDATE legaldocument 
SET category = CASE 
    -- Map based on document type first
    WHEN type IN ('CONTRACT', 'COURT_ORDER', 'ORDER') THEN 'PUBLIC'
    WHEN type IN ('FILING') AND category NOT IN ('CONFIDENTIAL', 'ATTORNEY_CLIENT_PRIVILEGE') THEN 'PUBLIC'
    
    -- Financial documents should be confidential
    WHEN category = 'FINANCIAL' THEN 'CONFIDENTIAL'
    WHEN type IN ('INVOICE', 'EXPENSE_REPORT', 'FINANCIAL') THEN 'CONFIDENTIAL'
    
    -- Legal research and briefs are internal
    WHEN category = 'LEGAL' AND type IN ('BRIEF', 'MOTION', 'RESEARCH', 'PLEADING') THEN 'INTERNAL'
    WHEN type IN ('BRIEF', 'MOTION', 'RESEARCH') THEN 'INTERNAL'
    
    -- Correspondence depends on context - default to PUBLIC for client visibility
    WHEN category = 'CORRESPONDENCE' AND type = 'CORRESPONDENCE' THEN 'PUBLIC'
    WHEN type = 'CORRESPONDENCE' THEN 'PUBLIC'
    
    -- Reports are typically internal
    WHEN category = 'REPORT' THEN 'INTERNAL'
    
    -- Evidence could be sensitive
    WHEN type = 'EVIDENCE' THEN 'INTERNAL'
    
    -- Attorney notes and privileged communications
    WHEN type IN ('PRIVILEGED', 'ATTORNEY_NOTES', 'WORK_PRODUCT') THEN 'ATTORNEY_CLIENT_PRIVILEGE'
    WHEN description LIKE '%privileged%' OR description LIKE '%confidential%' THEN 'CONFIDENTIAL'
    WHEN description LIKE '%attorney%client%' THEN 'ATTORNEY_CLIENT_PRIVILEGE'
    
    -- Keep existing RBAC categories if already set
    WHEN category IN ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'ATTORNEY_CLIENT_PRIVILEGE') THEN category
    
    -- Default mapping for legacy categories
    WHEN category = 'OTHER' THEN 'INTERNAL'
    ELSE 'INTERNAL'
END
WHERE category NOT IN ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'ATTORNEY_CLIENT_PRIVILEGE')
   OR category IS NULL;

-- Show the results
SELECT 'Updated category distribution:' as info;
SELECT category, COUNT(*) as count FROM legaldocument GROUP BY category;

-- Add a column to track which documents were auto-categorized (MySQL compatible)
SET @dbname = DATABASE();
SET @tablename = 'legaldocument';
SET @columnname = 'category_updated_by';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE
    (table_name = @tablename) AND (table_schema = @dbname) AND (column_name = @columnname)
  ) > 0,
  "SELECT 1", -- Column exists, do nothing
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " VARCHAR(50) DEFAULT 'SYSTEM'")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

UPDATE legaldocument 
SET category_updated_by = 'V36_MIGRATION'
WHERE category_updated_by = 'SYSTEM' OR category_updated_by IS NULL; 