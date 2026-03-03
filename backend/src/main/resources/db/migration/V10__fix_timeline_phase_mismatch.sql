-- V10: Fix timeline phase mismatch after practice_area migration
-- Cases that were initialized with the wrong template (e.g., PI cases initialized as "CIVIL" with 10 phases instead of 13)
-- Reset their timeline so it re-initializes with the correct template on next access.
-- Also fix Medical Malpractice cases that were backfilled to 'Other'.

-- Fix Medical Malpractice practice_area backfill
UPDATE legal_cases SET practice_area = 'Medical Malpractice'
WHERE practice_area = 'Other' AND UPPER(type) LIKE '%MALPRACTICE%';

-- Reset timelines for Personal Injury cases that have wrong phase count
-- PI template has 13 phases; cases initialized with old 'CIVIL' type got 10
UPDATE legal_cases
SET timeline_initialized = false, current_timeline_phase = NULL
WHERE practice_area = 'Personal Injury'
  AND timeline_initialized = true
  AND id IN (
    SELECT case_id FROM case_timeline_progress
    GROUP BY case_id
    HAVING COUNT(*) < 13
  );
