CREATE TABLE `question_banks` (
	`id` varchar(36) NOT NULL,
	`classroom_id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`color` varchar(7) NOT NULL DEFAULT '#6366f1',
	`icon` varchar(50) NOT NULL DEFAULT 'book',
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `question_banks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` varchar(36) NOT NULL,
	`bank_id` varchar(36) NOT NULL,
	`type` enum('TRUE_FALSE','SINGLE_CHOICE','MULTIPLE_CHOICE','MATCHING') NOT NULL,
	`difficulty` enum('EASY','MEDIUM','HARD') NOT NULL DEFAULT 'MEDIUM',
	`points` int NOT NULL DEFAULT 10,
	`question_text` text NOT NULL,
	`image_url` varchar(500),
	`options` json,
	`correct_answer` json,
	`pairs` json,
	`explanation` text,
	`time_limit_seconds` int DEFAULT 30,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `timed_activities` (
	`id` varchar(36) NOT NULL,
	`classroom_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`timed_activity_mode` enum('STOPWATCH','TIMER','BOMB') NOT NULL,
	`timed_activity_status` enum('DRAFT','ACTIVE','PAUSED','COMPLETED') NOT NULL DEFAULT 'DRAFT',
	`time_limit_seconds` int,
	`bomb_min_seconds` int,
	`bomb_max_seconds` int,
	`actual_bomb_time` int,
	`behavior_id` varchar(36),
	`base_points` int DEFAULT 10,
	`point_type` varchar(10) DEFAULT 'XP',
	`use_multipliers` boolean NOT NULL DEFAULT false,
	`multiplier_50` int DEFAULT 200,
	`multiplier_75` int DEFAULT 150,
	`negative_behavior_id` varchar(36),
	`bomb_penalty_points` int DEFAULT 10,
	`bomb_penalty_type` varchar(10) DEFAULT 'HP',
	`started_at` datetime,
	`paused_at` datetime,
	`completed_at` datetime,
	`elapsed_seconds` int DEFAULT 0,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `timed_activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `timed_activity_results` (
	`id` varchar(36) NOT NULL,
	`activity_id` varchar(36) NOT NULL,
	`student_profile_id` varchar(36) NOT NULL,
	`completed_at` datetime,
	`elapsed_seconds` int,
	`multiplier_applied` int DEFAULT 100,
	`points_awarded` int DEFAULT 0,
	`was_exploded` boolean DEFAULT false,
	`penalty_applied` int DEFAULT 0,
	`created_at` datetime NOT NULL,
	CONSTRAINT `timed_activity_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `student_avatar_purchases` DROP INDEX `student_avatar_purchases_student_profile_id_avatar_item_id_unique`;--> statement-breakpoint
ALTER TABLE `battle_questions` MODIFY COLUMN `options` json;--> statement-breakpoint
ALTER TABLE `battle_questions` MODIFY COLUMN `correct_index` int NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `student_profiles` MODIFY COLUMN `user_id` varchar(36);--> statement-breakpoint
ALTER TABLE `battle_questions` ADD `battle_question_type` enum('TRUE_FALSE','SINGLE_CHOICE','MULTIPLE_CHOICE','MATCHING') DEFAULT 'SINGLE_CHOICE' NOT NULL;--> statement-breakpoint
ALTER TABLE `battle_questions` ADD `correct_indices` json;--> statement-breakpoint
ALTER TABLE `battle_questions` ADD `pairs` json;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `display_name` varchar(100);--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `link_code` varchar(8);--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `boss_kills` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `student_avatar_purchases` ADD CONSTRAINT `student_purchase_unique` UNIQUE(`student_profile_id`,`avatar_item_id`);--> statement-breakpoint
ALTER TABLE `student_profiles` ADD CONSTRAINT `student_profiles_link_code_unique` UNIQUE(`link_code`);