-- Create Case Activities Table
CREATE TABLE IF NOT EXISTS `case_activities` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `case_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED,
  `activity_type` VARCHAR(100) NOT NULL,
  `reference_id` BIGINT UNSIGNED,
  `reference_type` VARCHAR(50),
  `description` VARCHAR(255) NOT NULL,
  `metadata` JSON,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_case_activity_case_id` (`case_id`),
  INDEX `idx_case_activity_user_id` (`user_id`),
  INDEX `idx_case_activity_created_at` (`created_at`),
  CONSTRAINT `fk_case_activity_case_id` FOREIGN KEY (`case_id`) REFERENCES `legal_cases` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_case_activity_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample activity records to help with testing
INSERT INTO `case_activities` (`case_id`, `user_id`, `activity_type`, `description`, `created_at`) 
SELECT 
  id, 
  1, -- Admin user
  'CASE_CREATED',
  CONCAT('Case "', title, '" was created'),
  created_at
FROM `legal_cases`
LIMIT 10;
