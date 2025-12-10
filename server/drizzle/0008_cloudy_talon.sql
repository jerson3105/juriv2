CREATE TABLE `clan_logs` (
	`id` varchar(36) NOT NULL,
	`clan_id` varchar(36) NOT NULL,
	`student_id` varchar(36),
	`action` varchar(50) NOT NULL,
	`xp_amount` int NOT NULL DEFAULT 0,
	`gp_amount` int NOT NULL DEFAULT 0,
	`reason` text,
	`created_at` datetime NOT NULL,
	CONSTRAINT `clan_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `avatar_items` MODIFY COLUMN `avatar_slot` enum('HEAD','HAIR','EYES','TOP','BOTTOM','LEFT_HAND','RIGHT_HAND','SHOES','BACK','FLAG','BACKGROUND') NOT NULL;--> statement-breakpoint
ALTER TABLE `student_equipped_items` MODIFY COLUMN `avatar_slot` enum('HEAD','HAIR','EYES','TOP','BOTTOM','LEFT_HAND','RIGHT_HAND','SHOES','BACK','FLAG','BACKGROUND') NOT NULL;--> statement-breakpoint
ALTER TABLE `behaviors` ADD `xp_value` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `behaviors` ADD `hp_value` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `behaviors` ADD `gp_value` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `clans_enabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `clan_xp_percentage` int DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `clan_battles_enabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `clan_gp_reward_enabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `teams` ADD `color` varchar(7) DEFAULT '#6366f1' NOT NULL;--> statement-breakpoint
ALTER TABLE `teams` ADD `emblem` varchar(50) DEFAULT 'shield' NOT NULL;--> statement-breakpoint
ALTER TABLE `teams` ADD `motto` varchar(255);--> statement-breakpoint
ALTER TABLE `teams` ADD `total_xp` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `teams` ADD `total_gp` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `teams` ADD `wins` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `teams` ADD `losses` int DEFAULT 0 NOT NULL;