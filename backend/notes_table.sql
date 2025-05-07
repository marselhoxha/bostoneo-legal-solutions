-- Create Case Notes Table
CREATE TABLE IF NOT EXISTS `case_notes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `case_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED,
  `title` VARCHAR(255) NOT NULL,
  `content` TEXT NOT NULL,
  `is_private` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` BIGINT UNSIGNED,
  PRIMARY KEY (`id`),
  INDEX `idx_case_notes_case_id` (`case_id`),
  INDEX `idx_case_notes_user_id` (`user_id`),
  INDEX `idx_case_notes_created_at` (`created_at`),
  CONSTRAINT `fk_case_notes_case_id` FOREIGN KEY (`case_id`) REFERENCES `legal_cases` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_case_notes_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_case_notes_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; 