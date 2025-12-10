CREATE TABLE `badge_progress` (
	`id` varchar(36) NOT NULL,
	`student_profile_id` varchar(36) NOT NULL,
	`badge_id` varchar(36) NOT NULL,
	`current_value` int NOT NULL DEFAULT 0,
	`target_value` int NOT NULL,
	`last_updated` datetime NOT NULL,
	CONSTRAINT `badge_progress_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_progress` UNIQUE(`student_profile_id`,`badge_id`)
);
--> statement-breakpoint
CREATE TABLE `badges` (
	`id` varchar(36) NOT NULL,
	`badge_scope` enum('SYSTEM','CLASSROOM') NOT NULL DEFAULT 'SYSTEM',
	`classroom_id` varchar(36),
	`created_by` varchar(36),
	`name` varchar(100) NOT NULL,
	`description` varchar(255) NOT NULL,
	`icon` varchar(50) NOT NULL,
	`badge_category` enum('PROGRESS','PARTICIPATION','SOCIAL','SHOP','SPECIAL','SECRET','CUSTOM') NOT NULL,
	`badge_rarity` enum('COMMON','RARE','EPIC','LEGENDARY') NOT NULL DEFAULT 'COMMON',
	`badge_assignment` enum('AUTOMATIC','MANUAL','BOTH') NOT NULL DEFAULT 'AUTOMATIC',
	`unlock_condition` json,
	`reward_xp` int NOT NULL DEFAULT 0,
	`reward_gp` int NOT NULL DEFAULT 0,
	`max_awards` int DEFAULT 1,
	`is_secret` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `badges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_badges` (
	`id` varchar(36) NOT NULL,
	`student_profile_id` varchar(36) NOT NULL,
	`badge_id` varchar(36) NOT NULL,
	`unlocked_at` datetime NOT NULL,
	`awarded_by` varchar(36),
	`award_reason` varchar(255),
	`is_displayed` boolean NOT NULL DEFAULT false,
	CONSTRAINT `student_badges_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_student_badge` UNIQUE(`student_profile_id`,`badge_id`)
);
