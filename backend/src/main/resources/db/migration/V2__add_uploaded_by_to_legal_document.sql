-- Check if uploadedBy column exists before adding it
SET @exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'LegalDocument'
    AND COLUMN_NAME = 'uploadedBy'
);

SET @sql = IF(
    @exists = 0,
    'ALTER TABLE LegalDocument ADD COLUMN uploadedBy BIGINT UNSIGNED, ADD CONSTRAINT fk_document_user FOREIGN KEY (uploadedBy) REFERENCES Users(id) ON DELETE SET NULL',
    'SELECT ''Column already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt; 
 
 
 