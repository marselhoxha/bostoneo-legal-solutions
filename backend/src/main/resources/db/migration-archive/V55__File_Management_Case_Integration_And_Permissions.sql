-- File Management System - Case Integration and Enhanced Permissions
-- Version: V55
-- Description: Add case relationships, document management fields, and permission system to file management

-- Add case integration and document management fields to file_items table
ALTER TABLE file_items 
ADD COLUMN case_id BIGINT UNSIGNED,
ADD COLUMN department_id BIGINT,
ADD COLUMN practice_area VARCHAR(100),
ADD COLUMN document_category VARCHAR(50),
ADD COLUMN document_status VARCHAR(20) DEFAULT 'draft',
ADD COLUMN shared_with_client BOOLEAN DEFAULT FALSE,
ADD COLUMN client_access_expires TIMESTAMP NULL;

-- Add foreign key constraint for case relationship
ALTER TABLE file_items 
ADD CONSTRAINT fk_file_items_case_id 
FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE SET NULL;

-- Add indexes for better query performance
CREATE INDEX idx_file_items_case_id ON file_items(case_id);
CREATE INDEX idx_file_items_department_id ON file_items(department_id);
CREATE INDEX idx_file_items_practice_area ON file_items(practice_area);
CREATE INDEX idx_file_items_document_category ON file_items(document_category);
CREATE INDEX idx_file_items_document_status ON file_items(document_status);
CREATE INDEX idx_file_items_shared_with_client ON file_items(shared_with_client);

-- Create file_permissions table for granular access control
CREATE TABLE file_permissions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    file_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    permission_type ENUM('VIEW', 'DOWNLOAD', 'EDIT', 'DELETE', 'SHARE', 'ADMIN') NOT NULL,
    granted_by BIGINT UNSIGNED,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP NULL,
    revoked_by BIGINT UNSIGNED,
    notes TEXT,
    
    CONSTRAINT fk_file_permissions_file_id 
        FOREIGN KEY (file_id) REFERENCES file_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_file_permissions_user_id 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_file_permissions_granted_by 
        FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_file_permissions_revoked_by 
        FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Unique constraint to prevent duplicate permissions
    UNIQUE KEY unique_file_user_permission (file_id, user_id, permission_type)
);

-- Add indexes for file_permissions table
CREATE INDEX idx_file_permissions_file_id ON file_permissions(file_id);
CREATE INDEX idx_file_permissions_user_id ON file_permissions(user_id);
CREATE INDEX idx_file_permissions_permission_type ON file_permissions(permission_type);
CREATE INDEX idx_file_permissions_granted_by ON file_permissions(granted_by);
CREATE INDEX idx_file_permissions_expires_at ON file_permissions(expires_at);
CREATE INDEX idx_file_permissions_is_revoked ON file_permissions(is_revoked);

-- Insert document management authorities for file management
INSERT IGNORE INTO authorities (authority) VALUES 
('DOCUMENT:MANAGE_CASE_FILES'),
('DOCUMENT:MANAGE_PERMISSIONS'),
('DOCUMENT:SHARE_WITH_CLIENTS'),
('DOCUMENT:VIEW_DEPARTMENT_FILES'),
('DOCUMENT:ACCESS_ALL_FILES');

-- Grant permissions to existing roles
-- Admin gets all permissions
INSERT IGNORE INTO role_authorities (role_id, authority_name)
SELECT r.id, 'DOCUMENT:MANAGE_CASE_FILES'
FROM roles r WHERE r.name = 'ADMIN';

INSERT IGNORE INTO role_authorities (role_id, authority_name)
SELECT r.id, 'DOCUMENT:MANAGE_PERMISSIONS'
FROM roles r WHERE r.name = 'ADMIN';

INSERT IGNORE INTO role_authorities (role_id, authority_name)
SELECT r.id, 'DOCUMENT:SHARE_WITH_CLIENTS'
FROM roles r WHERE r.name = 'ADMIN';

INSERT IGNORE INTO role_authorities (role_id, authority_name)
SELECT r.id, 'DOCUMENT:VIEW_DEPARTMENT_FILES'
FROM roles r WHERE r.name = 'ADMIN';

INSERT IGNORE INTO role_authorities (role_id, authority_name)
SELECT r.id, 'DOCUMENT:ACCESS_ALL_FILES'
FROM roles r WHERE r.name = 'ADMIN';

-- Manager gets most permissions
INSERT IGNORE INTO role_authorities (role_id, authority_name)
SELECT r.id, 'DOCUMENT:MANAGE_CASE_FILES'
FROM roles r WHERE r.name = 'MANAGER';

INSERT IGNORE INTO role_authorities (role_id, authority_name)
SELECT r.id, 'DOCUMENT:MANAGE_PERMISSIONS'
FROM roles r WHERE r.name = 'MANAGER';

INSERT IGNORE INTO role_authorities (role_id, authority_name)
SELECT r.id, 'DOCUMENT:SHARE_WITH_CLIENTS'
FROM roles r WHERE r.name = 'MANAGER';

INSERT IGNORE INTO role_authorities (role_id, authority_name)
SELECT r.id, 'DOCUMENT:ACCESS_ALL_FILES'
FROM roles r WHERE r.name = 'MANAGER';

-- Attorney gets case and sharing permissions
INSERT IGNORE INTO role_authorities (role_id, authority_name)
SELECT r.id, 'DOCUMENT:MANAGE_CASE_FILES'
FROM roles r WHERE r.name = 'ATTORNEY';

INSERT IGNORE INTO role_authorities (role_id, authority_name)
SELECT r.id, 'DOCUMENT:SHARE_WITH_CLIENTS'
FROM roles r WHERE r.name = 'ATTORNEY';

INSERT IGNORE INTO role_authorities (role_id, authority_name)
SELECT r.id, 'DOCUMENT:VIEW_DEPARTMENT_FILES'
FROM roles r WHERE r.name = 'ATTORNEY';

-- Paralegal gets case files access
INSERT IGNORE INTO role_authorities (role_id, authority_name)
SELECT r.id, 'DOCUMENT:MANAGE_CASE_FILES'
FROM roles r WHERE r.name = 'PARALEGAL';

INSERT IGNORE INTO role_authorities (role_id, authority_name)
SELECT r.id, 'DOCUMENT:VIEW_DEPARTMENT_FILES'
FROM roles r WHERE r.name = 'PARALEGAL';

-- Update document categories with legal-specific values
INSERT IGNORE INTO document_categories (name, description, color, icon) VALUES
('discovery', 'Discovery Documents', 'info', 'ri-search-line'),
('pleadings', 'Pleadings and Motions', 'primary', 'ri-file-text-line'),
('evidence', 'Evidence and Exhibits', 'warning', 'ri-camera-line'),
('correspondence', 'Client Correspondence', 'success', 'ri-mail-line'),
('contracts', 'Contracts and Agreements', 'danger', 'ri-contract-line'),
('court-filings', 'Court Filings', 'dark', 'ri-government-line'),
('research', 'Legal Research', 'secondary', 'ri-book-line'),
('billing', 'Billing Documents', 'info', 'ri-money-dollar-circle-line');

-- Create document_categories table if it doesn't exist
CREATE TABLE IF NOT EXISTS document_categories (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(200),
    color VARCHAR(20) DEFAULT 'primary',
    icon VARCHAR(50) DEFAULT 'ri-file-line',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add sample document statuses for workflow management
CREATE TABLE IF NOT EXISTS document_statuses (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(20) NOT NULL UNIQUE,
    description VARCHAR(100),
    color VARCHAR(20) DEFAULT 'secondary',
    is_final BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO document_statuses (name, description, color, is_final) VALUES
('draft', 'Draft document', 'secondary', FALSE),
('review', 'Under review', 'warning', FALSE),
('approved', 'Approved for use', 'success', FALSE),
('final', 'Final version', 'primary', TRUE),
('filed', 'Filed with court', 'info', TRUE),
('archived', 'Archived document', 'dark', TRUE);

-- Add practice areas table for better organization
CREATE TABLE IF NOT EXISTS practice_areas (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    color VARCHAR(20) DEFAULT 'primary',
    icon VARCHAR(50) DEFAULT 'ri-scales-line',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO practice_areas (name, description, color, icon) VALUES
('Litigation', 'Civil and Commercial Litigation', 'danger', 'ri-hammer-line'),
('Corporate Law', 'Corporate and Business Law', 'primary', 'ri-building-line'),
('Real Estate', 'Real Estate Transactions', 'success', 'ri-home-line'),
('Family Law', 'Family and Domestic Relations', 'warning', 'ri-heart-line'),
('Criminal Law', 'Criminal Defense', 'dark', 'ri-shield-line'),
('Employment Law', 'Employment and Labor Law', 'info', 'ri-team-line'),
('Intellectual Property', 'IP and Technology Law', 'secondary', 'ri-lightbulb-line'),
('Estate Planning', 'Wills and Estate Planning', 'light', 'ri-file-paper-line');

-- Create audit trigger for file_permissions
DELIMITER //
CREATE TRIGGER file_permissions_audit_insert 
    AFTER INSERT ON file_permissions
    FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (
        entity_type, entity_id, action, changed_by, 
        changed_at, old_values, new_values
    ) VALUES (
        'FILE_PERMISSION', NEW.id, 'CREATE', NEW.granted_by,
        NEW.granted_at, NULL, 
        JSON_OBJECT('permission_type', NEW.permission_type, 'file_id', NEW.file_id, 'user_id', NEW.user_id)
    );
END//

CREATE TRIGGER file_permissions_audit_update
    AFTER UPDATE ON file_permissions
    FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (
        entity_type, entity_id, action, changed_by,
        changed_at, old_values, new_values
    ) VALUES (
        'FILE_PERMISSION', NEW.id, 'UPDATE', NEW.revoked_by,
        CURRENT_TIMESTAMP,
        JSON_OBJECT('is_revoked', OLD.is_revoked, 'revoked_at', OLD.revoked_at),
        JSON_OBJECT('is_revoked', NEW.is_revoked, 'revoked_at', NEW.revoked_at)
    );
END//
DELIMITER ;

-- Add comments to explain the schema changes
ALTER TABLE file_items 
COMMENT = 'Enhanced file management with case integration and document workflow support';

ALTER TABLE file_permissions 
COMMENT = 'Granular file access permissions for role-based document security';