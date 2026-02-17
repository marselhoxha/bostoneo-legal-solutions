-- Create folders table for organizing files
CREATE TABLE IF NOT EXISTS folders (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_folder_id BIGINT UNSIGNED,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    
    -- Case integration fields
    case_id BIGINT UNSIGNED,
    department_id BIGINT,
    practice_area VARCHAR(100),
    folder_type VARCHAR(50),
    template BOOLEAN DEFAULT FALSE NOT NULL,
    
    -- Foreign keys
    CONSTRAINT fk_folders_parent_folder 
        FOREIGN KEY (parent_folder_id) REFERENCES folders(id) ON DELETE CASCADE,
    CONSTRAINT fk_folders_created_by 
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_folders_case_id 
        FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_folders_parent_folder_id (parent_folder_id),
    INDEX idx_folders_created_by (created_by),
    INDEX idx_folders_case_id (case_id),
    INDEX idx_folders_deleted (deleted),
    INDEX idx_folders_department_id (department_id),
    INDEX idx_folders_practice_area (practice_area),
    INDEX idx_folders_folder_type (folder_type),
    INDEX idx_folders_template (template),
    
    -- Unique constraint to prevent duplicate folder names in same parent
    UNIQUE KEY unique_folder_name_parent (name, parent_folder_id, deleted)
);

-- Add folder_id to file_items table if it doesn't exist
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'file_items' 
    AND COLUMN_NAME = 'folder_id'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE file_items ADD COLUMN folder_id BIGINT UNSIGNED, ADD CONSTRAINT fk_file_items_folder_id FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL, ADD INDEX idx_file_items_folder_id (folder_id)',
    'SELECT "Column folder_id already exists in file_items"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create default root folders for common categories
INSERT INTO folders (name, parent_folder_id, created_by, deleted, template) 
SELECT 'Documents', NULL, 1, FALSE, FALSE
WHERE NOT EXISTS (SELECT 1 FROM folders WHERE name = 'Documents' AND parent_folder_id IS NULL);

INSERT INTO folders (name, parent_folder_id, created_by, deleted, template) 
SELECT 'Case Files', NULL, 1, FALSE, FALSE
WHERE NOT EXISTS (SELECT 1 FROM folders WHERE name = 'Case Files' AND parent_folder_id IS NULL);

INSERT INTO folders (name, parent_folder_id, created_by, deleted, template) 
SELECT 'Templates', NULL, 1, FALSE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM folders WHERE name = 'Templates' AND parent_folder_id IS NULL);