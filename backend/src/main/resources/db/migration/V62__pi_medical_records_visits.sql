-- Tier 6 — Visit-level extraction from itemized bills.
-- Multi-DOS billing summaries (e.g. a 22-visit Team Rehab procedure summary)
-- previously stored as a single PIMedicalRecord, making total visit count
-- understate clinical reality. This adds a visits JSONB array on each record;
-- per-line items extracted by the AI are stored as
-- [{date, code, provider, charge}, ...]. Visit count then sums visits.size()
-- across records (with a fallback of 1 for records without an itemized visit
-- list, e.g. a single ED encounter).

ALTER TABLE pi_medical_records
    ADD COLUMN IF NOT EXISTS visits JSONB;
