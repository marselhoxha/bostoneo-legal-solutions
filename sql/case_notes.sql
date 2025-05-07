-- Case Notes Table
CREATE TABLE IF NOT EXISTS case_notes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  is_private BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by BIGINT UNSIGNED NULL,
  FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_case_notes_case_id (case_id),
  INDEX idx_case_notes_user_id (user_id),
  INDEX idx_case_notes_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sample data for testing (using user_id 1 for all notes)
INSERT INTO case_notes (case_id, user_id, title, content, is_private) 
VALUES 
  (1, 1, 'Initial consultation notes', 'Client described situation in detail. Key points to follow up: contract review, witness statements.', FALSE),
  (1, 1, 'Document review completed', 'Reviewed all provided documents. Found potential evidence in email correspondence from January.', FALSE),
  (1, 1, 'Strategy meeting notes', 'Discussed approach with senior partners. Decision to pursue settlement before filing motion.', FALSE),
  (1, 1, 'Private - Case concerns', 'Concerned about client withholding information regarding prior incidents.', TRUE);

-- Add permissions for notes
INSERT IGNORE INTO Roles (name, permission)
VALUES 
  ('NOTES_CREATE', 'notes:create'),
  ('NOTES_READ', 'notes:read'),
  ('NOTES_UPDATE', 'notes:update'),
  ('NOTES_DELETE', 'notes:delete'); 