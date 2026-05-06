-- V75: add practice_areas column to organization_invitations
ALTER TABLE organization_invitations
ADD COLUMN IF NOT EXISTS practice_areas TEXT;

COMMENT ON COLUMN organization_invitations.practice_areas IS
  'Comma-delimited PracticeArea enum values to assign to the invited attorney on accept.';
