-- Phase 1 of PI case workflow migration: additive new fields on legal_cases.
-- All columns are NULL-able to preserve backwards compatibility for non-PI cases
-- and existing PI cases that don't have these data points yet.
--
-- New columns power:
--   - stage:                attorney workflow tracker (auto-derived; replaces ad-hoc state)
--   - mechanism_description: free-text mechanism narrative (currently scattered in description field)
--   - plaintiff_role:       restrained driver / passenger / pedestrian / cyclist / bystander
--   - er_visit_dol:         flag for ED visit on date of loss
--   - police_report_*:      whether obtained + report number
--   - client_insurance_um/uim/med_pay_limit: stacking coverage analysis on plaintiff's policy
--   - days_missed_work:     self-reported wage-loss day count
--   - statute_of_limitations: auto-computed at intake from DOL + jurisdiction (MA = 3y for PI)

ALTER TABLE legal_cases
    ADD COLUMN IF NOT EXISTS stage                          VARCHAR(32)    DEFAULT 'INTAKE',
    ADD COLUMN IF NOT EXISTS mechanism_description          TEXT,
    ADD COLUMN IF NOT EXISTS plaintiff_role                 VARCHAR(32),
    ADD COLUMN IF NOT EXISTS er_visit_dol                   BOOLEAN,
    ADD COLUMN IF NOT EXISTS police_report_obtained         BOOLEAN,
    ADD COLUMN IF NOT EXISTS police_report_number           VARCHAR(100),
    ADD COLUMN IF NOT EXISTS client_insurance_um_limit      NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS client_insurance_uim_limit     NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS client_insurance_med_pay_limit NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS days_missed_work               INTEGER,
    ADD COLUMN IF NOT EXISTS statute_of_limitations         DATE;

-- Backfill stage for existing PERSONAL_INJURY cases based on existing data.
-- Order matters: most-advanced state wins. CASE expression evaluates top-down.
--
-- pi_settlement_events schema: each row IS an event with demand_amount (always set)
-- and optional offer_amount / counter_amount. Presence of an offer/counter amount
-- means the carrier has responded → NEGOTIATION. Existence of any event row means
-- a demand has been logged at some point → DEMAND_SENT.
UPDATE legal_cases
SET stage = CASE
    WHEN settlement_final_amount IS NOT NULL THEN 'SETTLED'
    WHEN id IN (
        SELECT case_id FROM pi_settlement_events
        WHERE offer_amount IS NOT NULL OR counter_amount IS NOT NULL
    ) THEN 'NEGOTIATION'
    WHEN id IN (
        SELECT DISTINCT case_id FROM pi_settlement_events
    ) THEN 'DEMAND_SENT'
    WHEN id IN (
        SELECT case_id
        FROM pi_medical_records
        WHERE treatment_date IS NOT NULL
        GROUP BY case_id
        HAVING MAX(treatment_date) < CURRENT_DATE - INTERVAL '30 days'
    ) THEN 'PRE_DEMAND'
    WHEN id IN (
        SELECT case_id FROM pi_medical_records
        WHERE treatment_date >= CURRENT_DATE - INTERVAL '30 days'
    ) THEN 'TREATMENT'
    WHEN id IN (
        SELECT DISTINCT case_id FROM pi_medical_records
        WHERE treatment_date IS NOT NULL
    ) THEN 'INVESTIGATION'
    ELSE 'INTAKE'
END
WHERE practice_area = 'Personal Injury';

-- Backfill statute_of_limitations for existing PI cases where injury_date is known.
-- Default Massachusetts PI statute = 3 years from date of injury (M.G.L. c. 260, § 2A).
-- Manually overridable per-case via UI later.
UPDATE legal_cases
SET statute_of_limitations = injury_date + INTERVAL '3 years'
WHERE practice_area = 'Personal Injury'
  AND injury_date IS NOT NULL
  AND statute_of_limitations IS NULL;

-- Index for stage filtering (LegiPI Pipeline view will heavily query by stage).
-- Note: legal_cases.type stores the enum value (e.g. 'PERSONAL_INJURY'); practice_area
-- stores the display label (e.g. 'Personal Injury'). Index matches the enum column.
DROP INDEX IF EXISTS idx_legal_cases_stage_practice;
DROP INDEX IF EXISTS idx_legal_cases_stage_type;
CREATE INDEX IF NOT EXISTS idx_legal_cases_stage
    ON legal_cases (practice_area, stage)
    WHERE practice_area = 'Personal Injury';
