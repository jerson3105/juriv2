-- Tabla de misiones
CREATE TABLE IF NOT EXISTS `missions` (
  `id` varchar(36) NOT NULL,
  `classroom_id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text NOT NULL,
  `icon` varchar(50) NOT NULL DEFAULT '🎯',
  `mission_type` enum('DAILY','WEEKLY','SPECIAL') NOT NULL DEFAULT 'DAILY',
  `mission_category` enum('PARTICIPATION','PROGRESS','SOCIAL','SHOP','BATTLE','STREAK','CUSTOM') NOT NULL DEFAULT 'PROGRESS',
  `objective_type` varchar(50) NOT NULL,
  `objective_target` int NOT NULL DEFAULT 1,
  `objective_config` json,
  `reward_xp` int NOT NULL DEFAULT 0,
  `reward_gp` int NOT NULL DEFAULT 0,
  `reward_hp` int NOT NULL DEFAULT 0,
  `attachment_url` varchar(500),
  `attachment_name` varchar(255),
  `is_repeatable` boolean NOT NULL DEFAULT true,
  `max_completions` int,
  `is_active` boolean NOT NULL DEFAULT true,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de misiones asignadas a estudiantes
CREATE TABLE IF NOT EXISTS `student_missions` (
  `id` varchar(36) NOT NULL,
  `student_profile_id` varchar(36) NOT NULL,
  `mission_id` varchar(36) NOT NULL,
  `mission_status` enum('ACTIVE','COMPLETED','EXPIRED','CLAIMED') NOT NULL DEFAULT 'ACTIVE',
  `current_progress` int NOT NULL DEFAULT 0,
  `target_progress` int NOT NULL,
  `assigned_at` datetime NOT NULL,
  `expires_at` datetime,
  `completed_at` datetime,
  `claimed_at` datetime,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de rachas de estudiantes
CREATE TABLE IF NOT EXISTS `student_streaks` (
  `id` varchar(36) NOT NULL,
  `student_profile_id` varchar(36) NOT NULL,
  `classroom_id` varchar(36) NOT NULL,
  `current_streak` int NOT NULL DEFAULT 0,
  `longest_streak` int NOT NULL DEFAULT 0,
  `last_completed_at` datetime,
  `streak_started_at` datetime,
  `claimed_milestones` json,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `student_streaks_student_classroom` (`student_profile_id`,`classroom_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
