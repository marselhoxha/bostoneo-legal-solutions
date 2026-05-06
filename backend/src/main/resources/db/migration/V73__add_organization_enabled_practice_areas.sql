-- V73: add enabled_practice_areas column to organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS enabled_practice_areas TEXT;

COMMENT ON COLUMN organizations.enabled_practice_areas IS
  'Comma-delimited PracticeArea enum values this org handles. NULL during transition; backfilled by V74.';
