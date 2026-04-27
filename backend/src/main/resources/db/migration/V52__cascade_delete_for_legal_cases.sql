-- V52: Allow deleting a legal case without manual child-table cleanup.
--
-- Problem: 9 of the 19 FKs pointing at legal_cases default to NO ACTION,
-- so deleting a case with any related row (tasks, calendar events, file
-- items, etc.) fails with a DataIntegrityViolationException — surfaced
-- to the user as "Failed to delete case: A data integrity error occurred."
--
-- Strategy:
--   CASCADE  — intrinsic case data, meaningless once the parent case is gone
--             (assignments, tasks, calendar events, file items, folders,
--              transfer requests, workflow executions).
--   SET NULL — preserve for audit / CRM / billing trails but unlink from
--             the deleted case (leads in appointment_requests, expense
--             records). Both columns are already nullable; verified.
--
-- The 10 FKs that already had CASCADE/SET NULL are left alone.
-- Constraint names are preserved (drop + re-add with the same name) so
-- any external tooling that references them keeps working.
--
-- Postgres syntax. Each ALTER is wrapped to be safe on re-run via Flyway
-- (Flyway tracks versions, so this only runs once per environment, but
-- the IF EXISTS guard keeps it from breaking if a constraint name diverges
-- between environments).

-- ─── CASCADE: intrinsic case data ───────────────────────────────────────

ALTER TABLE case_assignments
  DROP CONSTRAINT IF EXISTS fkhcl4t6suiqof48nnlmcc61hpt;
ALTER TABLE case_assignments
  ADD CONSTRAINT fkhcl4t6suiqof48nnlmcc61hpt
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE;

ALTER TABLE case_tasks
  DROP CONSTRAINT IF EXISTS fkhjgqr4okgqeo1bow6hv97aaqf;
ALTER TABLE case_tasks
  ADD CONSTRAINT fkhjgqr4okgqeo1bow6hv97aaqf
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE;

ALTER TABLE case_transfer_requests
  DROP CONSTRAINT IF EXISTS fk3bmufwb08oht5qy3a1avysy0d;
ALTER TABLE case_transfer_requests
  ADD CONSTRAINT fk3bmufwb08oht5qy3a1avysy0d
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE;

ALTER TABLE case_workflow_executions
  DROP CONSTRAINT IF EXISTS fk339y3naqi309s75aayn7sov89;
ALTER TABLE case_workflow_executions
  ADD CONSTRAINT fk339y3naqi309s75aayn7sov89
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE;

ALTER TABLE calendar_events
  DROP CONSTRAINT IF EXISTS fkn4lm4uwirnxnk2elux6ujqay5;
ALTER TABLE calendar_events
  ADD CONSTRAINT fkn4lm4uwirnxnk2elux6ujqay5
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE;

ALTER TABLE file_items
  DROP CONSTRAINT IF EXISTS fkg96hxar4w5qh2eik6od1idnr9;
ALTER TABLE file_items
  ADD CONSTRAINT fkg96hxar4w5qh2eik6od1idnr9
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE;

ALTER TABLE folders
  DROP CONSTRAINT IF EXISTS fksfiyg2i0jerd42lof313ijlpd;
ALTER TABLE folders
  ADD CONSTRAINT fksfiyg2i0jerd42lof313ijlpd
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE;

-- ─── SET NULL: preserve audit / CRM / billing trails ────────────────────

ALTER TABLE appointment_requests
  DROP CONSTRAINT IF EXISTS fk5xqwydcrfsil3lsem93bg675w;
ALTER TABLE appointment_requests
  ADD CONSTRAINT fk5xqwydcrfsil3lsem93bg675w
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE SET NULL;

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS fkhg0j3kjwgln50hbykd0joq6kb;
ALTER TABLE expenses
  ADD CONSTRAINT fkhg0j3kjwgln50hbykd0joq6kb
    FOREIGN KEY (legal_case_id) REFERENCES legal_cases(id) ON DELETE SET NULL;
