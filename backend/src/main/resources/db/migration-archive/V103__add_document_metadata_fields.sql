-- Add document metadata extraction and type detection fields to ai_document_analysis table

-- Add detected document type column
ALTER TABLE `ai_document_analysis`
ADD COLUMN `detected_type` VARCHAR(100) COMMENT 'Auto-detected document type (Complaint, Contract, Motion, etc.)' AFTER `metadata`;

-- Add extracted metadata column
ALTER TABLE `ai_document_analysis`
ADD COLUMN `extracted_metadata` TEXT COMMENT 'JSON structure containing extracted parties, dates, case numbers, etc.' AFTER `detected_type`;

-- Add OCR required flag
ALTER TABLE `ai_document_analysis`
ADD COLUMN `requires_ocr` BOOLEAN DEFAULT FALSE COMMENT 'Indicates if document requires OCR processing' AFTER `extracted_metadata`;

-- Add index for detected_type for faster filtering
CREATE INDEX `idx_detected_type` ON `ai_document_analysis` (`detected_type`);

-- Update table comment
ALTER TABLE `ai_document_analysis` COMMENT = 'Stores AI-powered document analysis with metadata extraction and type detection';
