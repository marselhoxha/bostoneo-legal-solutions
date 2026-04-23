-- V49 — Normalize ai_legal_templates.practice_area to canonical display names.
-- Follow-up to Sprint 1 (PracticeArea enum + legal-constants.ts single source of truth).
-- Template practice_area values drifted from three legacy sources (case-create had 12,
-- template.service had 10, practice-area-fields.config had 6). This consolidates them
-- to the 16-entry canonical list in src/app/modules/legal/shared/legal-constants.ts
-- so the Template Library's practice-area filter matches what cases store.

UPDATE ai_legal_templates SET practice_area = 'Personal Injury' WHERE practice_area = 'PERSONAL_INJURY';
UPDATE ai_legal_templates SET practice_area = 'Immigration'     WHERE practice_area = 'Immigration Law';
UPDATE ai_legal_templates SET practice_area = 'Real Estate'     WHERE practice_area = 'Real Estate Law';
