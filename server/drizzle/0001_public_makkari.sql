CREATE TABLE `battle_answers` (
	`id` varchar(36) NOT NULL,
	`battle_id` varchar(36) NOT NULL,
	`question_id` varchar(36) NOT NULL,
	`participant_id` varchar(36) NOT NULL,
	`selected_index` int,
	`is_correct` boolean NOT NULL DEFAULT false,
	`time_spent` int,
	`answered_at` datetime NOT NULL,
	CONSTRAINT `battle_answers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `battle_participants` (
	`id` varchar(36) NOT NULL,
	`battle_id` varchar(36) NOT NULL,
	`student_id` varchar(36) NOT NULL,
	`joined_at` datetime NOT NULL,
	`total_damage` int NOT NULL DEFAULT 0,
	`correct_answers` int NOT NULL DEFAULT 0,
	`wrong_answers` int NOT NULL DEFAULT 0,
	CONSTRAINT `battle_participants_id` PRIMARY KEY(`id`),
	CONSTRAINT `battle_participants_battle_id_student_id_unique` UNIQUE(`battle_id`,`student_id`)
);
--> statement-breakpoint
CREATE TABLE `event_logs` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`classroom_id` varchar(36) NOT NULL,
	`triggered_by` varchar(36) NOT NULL,
	`affected_students` json,
	`applied_effects` json,
	`triggered_at` datetime NOT NULL,
	CONSTRAINT `event_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `item_usages` (
	`id` varchar(36) NOT NULL,
	`purchase_id` varchar(36) NOT NULL,
	`student_id` varchar(36) NOT NULL,
	`item_id` varchar(36) NOT NULL,
	`classroom_id` varchar(36) NOT NULL,
	`status` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
	`used_at` datetime NOT NULL,
	`reviewed_at` datetime,
	`reviewed_by` varchar(36),
	CONSTRAINT `item_usages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`classroom_id` varchar(36),
	`notification_type` enum('ITEM_USED','GIFT_RECEIVED','BATTLE_STARTED','LEVEL_UP','POINTS','PURCHASE_APPROVED','PURCHASE_REJECTED') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`data` json,
	`is_read` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `random_events` MODIFY COLUMN `probability` int NOT NULL DEFAULT 100;--> statement-breakpoint
ALTER TABLE `random_events` MODIFY COLUMN `icon` varchar(50) DEFAULT '🎲';--> statement-breakpoint
ALTER TABLE `battle_questions` ADD `question_type` enum('TEXT','IMAGE') DEFAULT 'TEXT' NOT NULL;--> statement-breakpoint
ALTER TABLE `battle_questions` ADD `image_url` varchar(500);--> statement-breakpoint
ALTER TABLE `battle_questions` ADD `order_index` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `boss_battles` ADD `battle_status` enum('DRAFT','ACTIVE','COMPLETED','VICTORY','DEFEAT') DEFAULT 'DRAFT' NOT NULL;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `banner_url` varchar(500);--> statement-breakpoint
ALTER TABLE `classrooms` ADD `xp_per_level` int DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `allow_negative_hp` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `allow_negative_points` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `show_reason_to_student` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `notify_on_points` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `shop_enabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `require_purchase_approval` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `daily_purchase_limit` int;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `show_character_name` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `purchases` ADD `used_quantity` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `purchases` ADD `purchase_status` enum('PENDING','APPROVED','REJECTED') DEFAULT 'APPROVED' NOT NULL;--> statement-breakpoint
ALTER TABLE `random_events` ADD `category` enum('BONUS','CHALLENGE','ROULETTE','SPECIAL') DEFAULT 'BONUS' NOT NULL;--> statement-breakpoint
ALTER TABLE `random_events` ADD `target_type` enum('ALL','RANDOM_ONE','RANDOM_SOME','TOP','BOTTOM') DEFAULT 'ALL' NOT NULL;--> statement-breakpoint
ALTER TABLE `random_events` ADD `target_count` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `random_events` ADD `effects` json NOT NULL;--> statement-breakpoint
ALTER TABLE `random_events` ADD `color` varchar(20) DEFAULT 'violet';--> statement-breakpoint
ALTER TABLE `random_events` ADD `scheduled_at` datetime;--> statement-breakpoint
ALTER TABLE `random_events` ADD `repeat_type` enum('NONE','DAILY','WEEKLY') DEFAULT 'NONE';--> statement-breakpoint
ALTER TABLE `random_events` ADD `repeat_days` json;--> statement-breakpoint
ALTER TABLE `random_events` ADD `repeat_time` varchar(5);--> statement-breakpoint
ALTER TABLE `random_events` ADD `duration_type` enum('INSTANT','TIMED','SESSION') DEFAULT 'INSTANT';--> statement-breakpoint
ALTER TABLE `random_events` ADD `duration_minutes` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `random_events` ADD `expires_at` datetime;--> statement-breakpoint
ALTER TABLE `random_events` ADD `is_global` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `random_events` ADD `last_triggered_at` datetime;--> statement-breakpoint
ALTER TABLE `random_events` ADD `updated_at` datetime;--> statement-breakpoint
ALTER TABLE `battle_questions` DROP COLUMN `order`;--> statement-breakpoint
ALTER TABLE `boss_battles` DROP COLUMN `status`;--> statement-breakpoint
ALTER TABLE `random_events` DROP COLUMN `point_type`;--> statement-breakpoint
ALTER TABLE `random_events` DROP COLUMN `effect_value`;