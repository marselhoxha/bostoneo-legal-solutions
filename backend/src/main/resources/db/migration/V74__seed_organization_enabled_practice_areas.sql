-- V74: backfill enabled_practice_areas from existing case data
--
-- legal_cases.practice_area contains mixed casing (display labels like "Personal Injury",
-- enum form like "PERSONAL_INJURY", and lowercase like "criminal_defense"). Normalize each
-- token to canonical PracticeArea enum form (uppercase + underscores) so
-- Organization.enabledPracticeAreas always matches the PracticeArea enum constants.
--
-- PostgreSQL note: STRING_AGG(DISTINCT x, ',' ORDER BY 1) is illegal — when DISTINCT is
-- used in an aggregate, ORDER BY must reference the same expression. We use a subquery
-- so DISTINCT happens first, then STRING_AGG with ORDER BY the already-distinct value.

-- (1) Backfill orgs that don't yet have enabled_practice_areas set, deriving from cases.
UPDATE organizations o
SET enabled_practice_areas = (
  SELECT STRING_AGG(area, ',' ORDER BY area)
  FROM (
    SELECT DISTINCT UPPER(REPLACE(TRIM(lc.practice_area), ' ', '_')) AS area
    FROM legal_cases lc
    WHERE lc.organization_id = o.id
      AND lc.practice_area IS NOT NULL
      AND TRIM(lc.practice_area) <> ''
  ) AS distinct_areas
)
WHERE o.enabled_practice_areas IS NULL;

-- (2) Defensive normalization for orgs whose enabled_practice_areas was already set
-- by a prior run / hand-edit and contains non-canonical tokens. Re-tokenize, uppercase,
-- replace spaces with underscores, dedupe, sort, re-join. Idempotent on already-canonical
-- values.
UPDATE organizations
SET enabled_practice_areas = (
  SELECT STRING_AGG(area, ',' ORDER BY area)
  FROM (
    SELECT DISTINCT UPPER(REPLACE(TRIM(token), ' ', '_')) AS area
    FROM unnest(string_to_array(enabled_practice_areas, ',')) AS token
    WHERE TRIM(token) <> ''
  ) AS distinct_tokens
)
WHERE enabled_practice_areas IS NOT NULL
  AND enabled_practice_areas <> '';

-- (3) Orgs with no cases yet → default to PERSONAL_INJURY (only fully-implemented v1 area).
UPDATE organizations
SET enabled_practice_areas = 'PERSONAL_INJURY'
WHERE enabled_practice_areas IS NULL OR enabled_practice_areas = '';
