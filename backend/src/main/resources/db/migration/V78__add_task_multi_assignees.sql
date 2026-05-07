-- V78: Multi-assignee support for case_tasks.
-- A task can now be assigned to N attorneys; the legacy `assigned_to_id`
-- column stays as the "primary" pointer for legacy callers + notifications.
--
-- Existing single-assignee data is backfilled into the new join table so
-- the multi-select picker shows the same person already there.

CREATE TABLE IF NOT EXISTS case_task_assignees (
  task_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, user_id),
  CONSTRAINT fk_cta_task FOREIGN KEY (task_id) REFERENCES case_tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_cta_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cta_user_id ON case_task_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_cta_task_id ON case_task_assignees(task_id);

-- Backfill: every task with a non-null assigned_to gets a row in the
-- join table so existing assignments survive the migration.
INSERT INTO case_task_assignees (task_id, user_id)
SELECT id, assigned_to
  FROM case_tasks
 WHERE assigned_to IS NOT NULL
ON CONFLICT (task_id, user_id) DO NOTHING;

COMMENT ON TABLE case_task_assignees IS
  'Many-to-many: tasks ↔ assigned attorneys. Replaces single assigned_to; '
  'assigned_to stays as the primary/lead pointer for notifications + legacy.';
