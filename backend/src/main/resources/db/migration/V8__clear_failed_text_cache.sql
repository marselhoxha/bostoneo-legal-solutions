-- V8: Clear failed/pending text extraction cache entries so documents get re-processed
-- with the new Vision OCR pipeline. Only deletes failed entries, preserves successful ones.
DELETE FROM file_item_text_cache
WHERE extraction_status IN ('failed', 'pending');
