CREATE TABLE `missions` (
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
	CONSTRAINT `missions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_boss_battle_attempts` (
	`id` varchar(36) NOT NULL,
	`participant_id` varchar(36) NOT NULL,
	`damage_dealt` int NOT NULL DEFAULT 0,
	`correct_answers` int NOT NULL DEFAULT 0,
	`wrong_answers` int NOT NULL DEFAULT 0,
	`hp_lost` int NOT NULL DEFAULT 0,
	`questions_answered` json,
	`started_at` datetime NOT NULL,
	`completed_at` datetime,
	CONSTRAINT `student_boss_battle_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_boss_battle_participants` (
	`id` varchar(36) NOT NULL,
	`battle_id` varchar(36) NOT NULL,
	`student_profile_id` varchar(36) NOT NULL,
	`total_damage_dealt` int NOT NULL DEFAULT 0,
	`total_correct_answers` int NOT NULL DEFAULT 0,
	`total_wrong_answers` int NOT NULL DEFAULT 0,
	`attempts_used` int NOT NULL DEFAULT 0,
	`xp_earned` int NOT NULL DEFAULT 0,
	`gp_earned` int NOT NULL DEFAULT 0,
	`is_currently_battling` boolean NOT NULL DEFAULT false,
	`last_battle_at` datetime,
	`created_at` datetime NOT NULL,
	CONSTRAINT `student_boss_battle_participants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_boss_battles` (
	`id` varchar(36) NOT NULL,
	`classroom_id` varchar(36) NOT NULL,
	`boss_name` varchar(255) NOT NULL,
	`boss_image_url` varchar(500),
	`boss_max_hp` int NOT NULL,
	`boss_current_hp` int NOT NULL,
	`question_bank_id` varchar(36) NOT NULL,
	`questions_per_attempt` int NOT NULL DEFAULT 5,
	`damage_per_correct` int NOT NULL DEFAULT 10,
	`damage_to_student_on_wrong` int NOT NULL DEFAULT 5,
	`max_attempts` int NOT NULL DEFAULT 1,
	`xp_per_correct_answer` int NOT NULL DEFAULT 10,
	`gp_per_correct_answer` int NOT NULL DEFAULT 5,
	`bonus_xp_on_victory` int NOT NULL DEFAULT 50,
	`bonus_gp_on_victory` int NOT NULL DEFAULT 25,
	`status` enum('DRAFT','SCHEDULED','ACTIVE','COMPLETED','VICTORY','DEFEAT') NOT NULL DEFAULT 'DRAFT',
	`start_date` datetime,
	`end_date` datetime,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`completed_at` datetime,
	CONSTRAINT `student_boss_battles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_missions` (
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
	CONSTRAINT `student_missions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_streaks` (
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
	CONSTRAINT `student_streaks_id` PRIMARY KEY(`id`),
	CONSTRAINT `student_streaks_student_profile_id_classroom_id_unique` UNIQUE(`student_profile_id`,`classroom_id`)
);
--> statement-breakpoint
ALTER TABLE `timed_activities` MODIFY COLUMN `timed_activity_mode` enum('STOPWATCH','TIMER','BOMB','BOMB_RANDOM') NOT NULL;