-- Create AI Document Analysis table for storing document analysis results
CREATE TABLE `ai_document_analysis` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `analysis_id` VARCHAR(255) NOT NULL UNIQUE,
    `file_name` VARCHAR(255),
    `file_type` VARCHAR(100),
    `file_size` BIGINT,
    `analysis_type` VARCHAR(100) NOT NULL,
    `document_content` TEXT,
    `analysis_result` TEXT,
    `summary` TEXT,
    `risk_score` INT,
    `risk_level` VARCHAR(50),
    `status` VARCHAR(50),
    `error_message` TEXT,
    `user_id` BIGINT,
    `case_id` BIGINT,
    `processing_time_ms` BIGINT,
    `tokens_used` INT,
    `cost_estimate` DECIMAL(10,5),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `is_archived` BOOLEAN NOT NULL DEFAULT FALSE,
    `key_findings` TEXT,
    `recommendations` TEXT,
    `compliance_issues` TEXT,
    `metadata` TEXT,
    PRIMARY KEY (`id`),
    INDEX `idx_analysis_id` (`analysis_id`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_case_id` (`case_id`),
    INDEX `idx_analysis_type` (`analysis_type`),
    INDEX `idx_status` (`status`),
    INDEX `idx_created_at` (`created_at`),
    INDEX `idx_risk_level` (`risk_level`)
);

-- Add comment to the table
ALTER TABLE `ai_document_analysis` COMMENT = 'Stores AI-powered document analysis results and metadata';