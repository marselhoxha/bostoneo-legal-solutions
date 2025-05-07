-- Case Activity Timeline Table
CREATE TABLE IF NOT EXISTS case_activities (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED,
  activity_type ENUM('NOTE_ADDED', 'DOCUMENT_ADDED', 'DOCUMENT_UPDATED', 'STATUS_CHANGED', 
                    'HEARING_SCHEDULED', 'HEARING_UPDATED', 'HEARING_CANCELLED', 
                    'PAYMENT_RECEIVED', 'CLIENT_CONTACTED', 'TASK_CREATED',
                    'TASK_COMPLETED', 'CUSTOM') NOT NULL,
  reference_id BIGINT UNSIGNED,
  reference_type VARCHAR(50),
  description TEXT NOT NULL,
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_case_activities_case_id (case_id),
  INDEX idx_case_activities_created_at (created_at),
  INDEX idx_case_activities_type (activity_type),
  INDEX idx_case_activities_reference (reference_id, reference_type(20))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Case Reminders Table for upcoming events and deadlines
CREATE TABLE IF NOT EXISTS case_reminders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATETIME NOT NULL,
  reminder_date DATETIME,
  status ENUM('PENDING', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING',
  priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') DEFAULT 'MEDIUM',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_case_reminders_case_id (case_id),
  INDEX idx_case_reminders_due_date (due_date),
  INDEX idx_case_reminders_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sample activity data (using user_id 1 for all records)
INSERT INTO case_activities (case_id, user_id, activity_type, reference_id, reference_type, description, metadata)
VALUES
  (1, 1, 'NOTE_ADDED', 1, 'case_notes', 'Added initial consultation notes', '{"note_title": "Initial consultation notes"}'),
  (1, 1, 'DOCUMENT_ADDED', 1, 'documents', 'Uploaded client contract', '{"document_name": "Client Agreement.pdf", "document_type": "CONTRACT"}'),
  (1, 1, 'STATUS_CHANGED', NULL, NULL, 'Case status changed from NEW to IN PROGRESS', '{"old_status": "NEW", "new_status": "IN_PROGRESS"}'),
  (1, 1, 'HEARING_SCHEDULED', NULL, NULL, 'Initial hearing scheduled for 2023-12-15', '{"date": "2023-12-15", "time": "10:00", "location": "County Courthouse, Room 304"}');

-- Sample reminder data (using user_id 1 for all records)
INSERT INTO case_reminders (case_id, user_id, title, description, due_date, reminder_date, priority)
VALUES
  (1, 1, 'File Motion for Summary Judgment', 'Prepare and file motion with supporting evidence', '2023-12-01 17:00:00', '2023-11-28 09:00:00', 'HIGH'),
  (1, 1, 'Client Follow-up Call', 'Discuss case progress and next steps', '2023-11-15 14:30:00', '2023-11-15 09:00:00', 'MEDIUM'),
  (1, 1, 'Prepare for Initial Hearing', 'Review all evidence and prepare arguments', '2023-12-10 17:00:00', '2023-12-08 09:00:00', 'URGENT');

-- Add permissions for activities and reminders
INSERT IGNORE INTO Roles (name, permission)
VALUES 
  ('ACTIVITIES_VIEW', 'activities:view'),
  ('REMINDERS_CREATE', 'reminders:create'),
  ('REMINDERS_READ', 'reminders:read'),
  ('REMINDERS_UPDATE', 'reminders:update'),
  ('REMINDERS_DELETE', 'reminders:delete'); 