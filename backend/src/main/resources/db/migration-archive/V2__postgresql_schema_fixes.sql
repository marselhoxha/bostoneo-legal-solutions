-- PostgreSQL Migration Schema Fixes
-- This script documents all database changes made during MySQL to PostgreSQL migration
-- Run this on any PostgreSQL database that was migrated from MySQL

-- ============================================================================
-- 1. FIX EXPENSES TABLE
-- ============================================================================
-- Rename customer_id to client_id (entity expects client_id)
ALTER TABLE expenses RENAME COLUMN customer_id TO client_id;

-- Add missing currency column
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD';

-- Rename expense_date to date (entity expects date)
ALTER TABLE expenses RENAME COLUMN expense_date TO date;

-- ============================================================================
-- 2. FIX EXPENSE_CATEGORIES TABLE
-- ============================================================================
-- Add missing color column
ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT '#6c757d';

-- ============================================================================
-- 3. FIX PAYMENTS TABLE (camelCase to snake_case)
-- ============================================================================
ALTER TABLE payments RENAME COLUMN paymentmethod TO payment_method;
ALTER TABLE payments RENAME COLUMN transactionid TO transaction_id;

-- ============================================================================
-- 4. FIX DOCUMENTVERSION TABLE (camelCase to snake_case)
-- ============================================================================
ALTER TABLE documentversion RENAME COLUMN "documentId" TO document_id;
ALTER TABLE documentversion RENAME COLUMN "fileName" TO file_name;
ALTER TABLE documentversion RENAME COLUMN "fileSize" TO file_size;
ALTER TABLE documentversion RENAME COLUMN "fileType" TO file_type;
ALTER TABLE documentversion RENAME COLUMN "fileUrl" TO file_url;
ALTER TABLE documentversion RENAME COLUMN "uploadedAt" TO uploaded_at;
ALTER TABLE documentversion RENAME COLUMN "uploadedBy" TO uploaded_by;
ALTER TABLE documentversion RENAME COLUMN "versionNumber" TO version_number;

-- ============================================================================
-- 5. FIX INVOICEITEM TABLE (camelCase to snake_case)
-- ============================================================================
ALTER TABLE invoiceitem RENAME COLUMN "unitPrice" TO unit_price;

-- ============================================================================
-- 6. FIX INVOICE_ITEMS TABLE
-- ============================================================================
ALTER TABLE invoice_items RENAME COLUMN unitprice TO unit_price;

-- ============================================================================
-- 7. FIX FILE_VERSIONS TABLE - Add missing columns
-- ============================================================================
ALTER TABLE file_versions ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE file_versions ADD COLUMN IF NOT EXISTS change_notes TEXT;
ALTER TABLE file_versions ADD COLUMN IF NOT EXISTS encryption_metadata TEXT;

-- Copy data from existing columns
UPDATE file_versions SET file_size = size WHERE file_size IS NULL AND size IS NOT NULL;
UPDATE file_versions SET change_notes = comment WHERE change_notes IS NULL AND comment IS NOT NULL;

-- ============================================================================
-- 8. FIX FILE_COMMENTS TABLE - Add missing columns
-- ============================================================================
ALTER TABLE file_comments ADD COLUMN IF NOT EXISTS comment_text TEXT;
ALTER TABLE file_comments ADD COLUMN IF NOT EXISTS mention_users TEXT;

-- Copy data from existing column
UPDATE file_comments SET comment_text = content WHERE comment_text IS NULL AND content IS NOT NULL;

-- ============================================================================
-- 9. FIX FILE_SHARES TABLE - Add missing column
-- ============================================================================
ALTER TABLE file_shares ADD COLUMN IF NOT EXISTS share_message TEXT;

-- ============================================================================
-- 10. FIX DOCUMENTS TABLE - Add missing columns
-- ============================================================================
ALTER TABLE documents ADD COLUMN IF NOT EXISTS url VARCHAR(500);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_type VARCHAR(100);

-- Copy data from existing columns
UPDATE documents SET url = file_path WHERE url IS NULL AND file_path IS NOT NULL;
UPDATE documents SET file_type = mime_type WHERE file_type IS NULL AND mime_type IS NOT NULL;

-- ============================================================================
-- 11. FIX CASE_ACTIVITIES TABLE - Add missing column
-- ============================================================================
ALTER TABLE case_activities ADD COLUMN IF NOT EXISTS metadata_json TEXT;

-- Copy data from existing column
UPDATE case_activities SET metadata_json = metadata WHERE metadata_json IS NULL AND metadata IS NOT NULL;

-- ============================================================================
-- 12. FIX USER_EVENTS TABLE - Set NULL created_at values
-- ============================================================================
UPDATE user_events SET created_at = NOW() WHERE created_at IS NULL;

-- ============================================================================
-- 13. REMOVE DUPLICATE RECEIPT TABLE (keep receipts)
-- ============================================================================
-- Note: Only run if 'receipt' (singular) table exists and is empty or has duplicate data
-- DROP TABLE IF EXISTS receipt CASCADE;

-- ============================================================================
-- VERIFICATION QUERIES (optional - run to verify fixes)
-- ============================================================================
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'expenses' ORDER BY ordinal_position;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'expense_categories';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'payments';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'documentversion';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'file_versions';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'documents';

-- ============================================================================
-- 14. CONVERT ALL JSONB COLUMNS TO TEXT
-- ============================================================================
-- JPA entities use JsonMapConverter which converts Map<String,Object> to String
-- PostgreSQL JSONB columns expect JSONB type, causing type mismatch errors
-- Converting to TEXT ensures compatibility with the JPA converter

ALTER TABLE ai_audit_logs ALTER COLUMN request_payload TYPE TEXT USING request_payload::TEXT;
ALTER TABLE ai_conversation_messages ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE ai_criminal_cases ALTER COLUMN charge_codes TYPE TEXT USING charge_codes::TEXT;
ALTER TABLE ai_criminal_cases ALTER COLUMN criminal_history TYPE TEXT USING criminal_history::TEXT;
ALTER TABLE ai_criminal_cases ALTER COLUMN motion_deadlines TYPE TEXT USING motion_deadlines::TEXT;
ALTER TABLE ai_criminal_cases ALTER COLUMN plea_offer TYPE TEXT USING plea_offer::TEXT;
ALTER TABLE ai_criminal_cases ALTER COLUMN potential_defenses TYPE TEXT USING potential_defenses::TEXT;
ALTER TABLE ai_criminal_cases ALTER COLUMN sentencing_guidelines TYPE TEXT USING sentencing_guidelines::TEXT;
ALTER TABLE ai_criminal_cases ALTER COLUMN victim_information TYPE TEXT USING victim_information::TEXT;
-- ... (225 total columns - see /tmp/fix_jsonb_columns.sql for full list)
-- All JSONB columns converted to TEXT for JPA compatibility
