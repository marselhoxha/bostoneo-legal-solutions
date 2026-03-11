-- Allow treatment_date to be NULL so documents where AI can't extract a date
-- are still saved (instead of failing with DataIntegrityViolationException).
ALTER TABLE pi_medical_records ALTER COLUMN treatment_date DROP NOT NULL;
