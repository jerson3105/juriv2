CREATE TABLE `avatar_items` (
	`id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`avatar_gender` enum('MALE','FEMALE') NOT NULL DEFAULT 'MALE',
	`avatar_slot` enum('HEAD','FACE','TOP','BOTTOM','LEFT_HAND','RIGHT_HAND','SHOES','BACK','PETS') NOT NULL,
	`image_path` varchar(500) NOT NULL,
	`layer_order` int NOT NULL,
	`base_price` int NOT NULL DEFAULT 100,
	`rarity` enum('COMMON','RARE','LEGENDARY') NOT NULL DEFAULT 'COMMON',
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `avatar_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `classroom_avatar_items` (
	`id` varchar(36) NOT NULL,
	`classroom_id` varchar(36) NOT NULL,
	`avatar_item_id` varchar(36) NOT NULL,
	`price` int NOT NULL,
	`is_available` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL,
	CONSTRAINT `classroom_avatar_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `classroom_avatar_items_classroom_id_avatar_item_id_unique` UNIQUE(`classroom_id`,`avatar_item_id`)
);
--> statement-breakpoint
CREATE TABLE `student_avatar_purchases` (
	`id` varchar(36) NOT NULL,
	`student_profile_id` varchar(36) NOT NULL,
	`avatar_item_id` varchar(36) NOT NULL,
	`classroom_id` varchar(36) NOT NULL,
	`price_paid` int NOT NULL,
	`purchased_at` datetime NOT NULL,
	CONSTRAINT `student_avatar_purchases_id` PRIMARY KEY(`id`),
	CONSTRAINT `student_avatar_purchases_student_profile_id_avatar_item_id_unique` UNIQUE(`student_profile_id`,`avatar_item_id`)
);
--> statement-breakpoint
CREATE TABLE `student_equipped_items` (
	`id` varchar(36) NOT NULL,
	`student_profile_id` varchar(36) NOT NULL,
	`avatar_item_id` varchar(36) NOT NULL,
	`avatar_slot` enum('HEAD','FACE','TOP','BOTTOM','LEFT_HAND','RIGHT_HAND','SHOES','BACK','PETS') NOT NULL,
	`equipped_at` datetime NOT NULL,
	CONSTRAINT `student_equipped_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `student_equipped_items_student_profile_id_avatar_slot_unique` UNIQUE(`student_profile_id`,`avatar_slot`)
);
--> statement-breakpoint
ALTER TABLE `battle_questions` ADD `hp_penalty` int DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `boss_battles` ADD `status` enum('DRAFT','ACTIVE','COMPLETED','VICTORY','DEFEAT') DEFAULT 'DRAFT' NOT NULL;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `avatar_gender` enum('MALE','FEMALE') DEFAULT 'MALE' NOT NULL;--> statement-breakpoint
ALTER TABLE `boss_battles` DROP COLUMN `battle_status`;