-- ============================================================================
-- V54 — Add clinical detail columns to pi_medical_records
-- ============================================================================
-- Tier 2 of LegiPI medical records overhaul: per-record clinical detail
-- (vitals, ROM, special tests, treating clinician, causation statements).
-- Without these, the chronology only shows a truncated keyFindings blurb;
-- with them, each row has structured data matching what an attorney would
-- write by hand from the source records.
--
-- All columns are NULLABLE so existing rows remain valid. Force-rescan
-- (introduced in Tier 1) will re-extract data into these fields.
-- ============================================================================

-- Treating clinician: the actual person who signed/co-signed the note.
-- Distinct from provider_name which is the FACILITY (e.g., "Team Rehab").
ALTER TABLE pi_medical_records
    ADD COLUMN IF NOT EXISTS treating_clinician VARCHAR(255);

-- Treating role: clinician's credential/role (PA-C, DPT, DC, MD, DO, etc.)
ALTER TABLE pi_medical_records
    ADD COLUMN IF NOT EXISTS treating_role VARCHAR(100);

-- Vitals snapshot for the encounter: BP, HR, weight, height, BMI, pain, temp, resp, SpO2.
-- Stored as a flat JSON object so we can query specific fields later
-- (e.g., trend pain scores across encounters).
ALTER TABLE pi_medical_records
    ADD COLUMN IF NOT EXISTS vitals JSONB;

-- Range of motion measurements grouped by joint/region:
-- {"cervical": {"flex": 60, "ext": 75, ...}, "lumbar": {"flex": 45, ...}}
ALTER TABLE pi_medical_records
    ADD COLUMN IF NOT EXISTS range_of_motion JSONB;

-- Orthopedic special tests with side and result:
-- [{"name": "Lasègue's", "side": "L", "result": "positive"}, ...]
ALTER TABLE pi_medical_records
    ADD COLUMN IF NOT EXISTS special_tests JSONB;

-- Medications administered IN THE ENCOUNTER (e.g., ED gave Motrin 600mg PO):
-- [{"name": "Motrin", "dose": "600 mg", "route": "PO", "frequency": "once"}, ...]
ALTER TABLE pi_medical_records
    ADD COLUMN IF NOT EXISTS medications_administered JSONB;

-- Medications PRESCRIBED for home use (separate from administered):
-- [{"name": "Ibuprofen", "dose": "600 mg", "frequency": "q8h", "duration": "10 days"}, ...]
ALTER TABLE pi_medical_records
    ADD COLUMN IF NOT EXISTS medications_prescribed JSONB;

-- Verbatim causation statement (e.g., "...injuries are a direct result of the
-- accident which reportedly occurred on 11/06/2025...").
-- Encrypted at the application layer (PHI per HIPAA); same convention as
-- key_findings/prognosis_notes/work_restrictions which are already encrypted.
ALTER TABLE pi_medical_records
    ADD COLUMN IF NOT EXISTS causation_statement TEXT;

-- Source attribution for the causation statement (clinician + date),
-- e.g., "PA Moy 11/11/2025". Plain text — not PHI on its own.
ALTER TABLE pi_medical_records
    ADD COLUMN IF NOT EXISTS causation_source VARCHAR(255);

-- Document the columns for future maintainers
COMMENT ON COLUMN pi_medical_records.treating_clinician IS 'Person who signed/co-signed the encounter note (e.g., "PA Willy Moy"). Distinct from provider_name (facility).';
COMMENT ON COLUMN pi_medical_records.treating_role IS 'Clinician credential/role: PA-C, DPT, DC, MD, DO, etc.';
COMMENT ON COLUMN pi_medical_records.vitals IS 'Vitals snapshot JSON: bp, hr, weight_lbs, height, bmi, pain, temp_f, resp, spo2.';
COMMENT ON COLUMN pi_medical_records.range_of_motion IS 'ROM measurements by region: cervical, lumbar, thoracic, shoulder, etc. Each region is an object of joint motion -> degrees.';
COMMENT ON COLUMN pi_medical_records.special_tests IS 'Orthopedic special tests array: [{name, side, result}].';
COMMENT ON COLUMN pi_medical_records.medications_administered IS 'Meds given during the encounter: [{name, dose, route, frequency}].';
COMMENT ON COLUMN pi_medical_records.medications_prescribed IS 'Meds prescribed for home use: [{name, dose, frequency, duration}].';
COMMENT ON COLUMN pi_medical_records.causation_statement IS 'Verbatim causation quote (PHI, encrypted at app layer).';
COMMENT ON COLUMN pi_medical_records.causation_source IS 'Attribution for causation_statement: clinician name + date.';
