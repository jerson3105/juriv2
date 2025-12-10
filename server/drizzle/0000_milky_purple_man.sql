CREATE TABLE `battle_questions` (
	`id` varchar(36) NOT NULL,
	`battle_id` varchar(36) NOT NULL,
	`question` text NOT NULL,
	`options` json NOT NULL,
	`correct_index` int NOT NULL,
	`damage` int NOT NULL DEFAULT 10,
	`time_limit` int NOT NULL DEFAULT 30,
	`order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL,
	CONSTRAINT `battle_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `battle_results` (
	`id` varchar(36) NOT NULL,
	`battle_id` varchar(36) NOT NULL,
	`student_id` varchar(36) NOT NULL,
	`score` int NOT NULL DEFAULT 0,
	`damage_dealt` int NOT NULL DEFAULT 0,
	`xp_earned` int NOT NULL DEFAULT 0,
	`gp_earned` int NOT NULL DEFAULT 0,
	`completed_at` datetime NOT NULL,
	CONSTRAINT `battle_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `battle_results_battle_id_student_id_unique` UNIQUE(`battle_id`,`student_id`)
);
--> statement-breakpoint
CREATE TABLE `behaviors` (
	`id` varchar(36) NOT NULL,
	`classroom_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`point_type` enum('XP','HP','GP') NOT NULL,
	`point_value` int NOT NULL,
	`is_positive` boolean NOT NULL,
	`icon` varchar(50),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL,
	CONSTRAINT `behaviors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `boss_battles` (
	`id` varchar(36) NOT NULL,
	`classroom_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`boss_name` varchar(255) NOT NULL,
	`boss_hp` int NOT NULL,
	`boss_image_url` varchar(500),
	`xp_reward` int NOT NULL DEFAULT 50,
	`gp_reward` int NOT NULL DEFAULT 20,
	`status` enum('DRAFT','ACTIVE','COMPLETED') NOT NULL DEFAULT 'DRAFT',
	`current_hp` int NOT NULL,
	`started_at` datetime,
	`ended_at` datetime,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `boss_battles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `classrooms` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`code` varchar(8) NOT NULL,
	`teacher_id` varchar(36) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`default_xp` int NOT NULL DEFAULT 100,
	`default_hp` int NOT NULL DEFAULT 100,
	`default_gp` int NOT NULL DEFAULT 0,
	`max_hp` int NOT NULL DEFAULT 100,
	`team_damage_share` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `classrooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `classrooms_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `point_logs` (
	`id` varchar(36) NOT NULL,
	`student_id` varchar(36) NOT NULL,
	`behavior_id` varchar(36),
	`point_type` enum('XP','HP','GP') NOT NULL,
	`action` enum('ADD','REMOVE') NOT NULL,
	`amount` int NOT NULL,
	`reason` text,
	`given_by` varchar(36),
	`created_at` datetime NOT NULL,
	CONSTRAINT `point_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `power_usages` (
	`id` varchar(36) NOT NULL,
	`power_id` varchar(36) NOT NULL,
	`student_id` varchar(36) NOT NULL,
	`target_id` varchar(36),
	`used_at` datetime NOT NULL,
	CONSTRAINT `power_usages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `powers` (
	`id` varchar(36) NOT NULL,
	`classroom_id` varchar(36),
	`name` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`character_class` enum('GUARDIAN','ARCANE','EXPLORER','ALCHEMIST') NOT NULL,
	`level_required` int NOT NULL DEFAULT 1,
	`gp_cost` int NOT NULL DEFAULT 0,
	`effect_type` varchar(50) NOT NULL,
	`effect_value` int NOT NULL,
	`cooldown_days` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL,
	CONSTRAINT `powers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` varchar(36) NOT NULL,
	`student_id` varchar(36) NOT NULL,
	`item_id` varchar(36) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`total_price` int NOT NULL,
	`purchase_type` enum('SELF','GIFT','TEACHER') NOT NULL DEFAULT 'SELF',
	`buyer_id` varchar(36),
	`gift_message` text,
	`purchased_at` datetime NOT NULL,
	CONSTRAINT `purchases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `random_events` (
	`id` varchar(36) NOT NULL,
	`classroom_id` varchar(36),
	`name` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`point_type` enum('XP','HP','GP') NOT NULL,
	`effect_value` int NOT NULL,
	`probability` int NOT NULL DEFAULT 10,
	`icon` varchar(50),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL,
	CONSTRAINT `random_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` varchar(36) NOT NULL,
	`token` varchar(500) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `refresh_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `refresh_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `shop_items` (
	`id` varchar(36) NOT NULL,
	`classroom_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`category` enum('AVATAR','ACCESSORY','CONSUMABLE','SPECIAL') NOT NULL,
	`rarity` enum('COMMON','RARE','LEGENDARY') NOT NULL DEFAULT 'COMMON',
	`price` int NOT NULL,
	`image_url` varchar(500),
	`icon` varchar(50),
	`effect_type` varchar(50),
	`effect_value` int,
	`stock` int,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `shop_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_profiles` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`classroom_id` varchar(36) NOT NULL,
	`character_class` enum('GUARDIAN','ARCANE','EXPLORER','ALCHEMIST') NOT NULL,
	`xp` int NOT NULL DEFAULT 0,
	`hp` int NOT NULL DEFAULT 100,
	`gp` int NOT NULL DEFAULT 0,
	`level` int NOT NULL DEFAULT 1,
	`character_name` varchar(100),
	`avatar_url` varchar(500),
	`team_id` varchar(36),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `student_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `student_profiles_user_id_classroom_id_unique` UNIQUE(`user_id`,`classroom_id`)
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`classroom_id` varchar(36) NOT NULL,
	`max_members` int NOT NULL DEFAULT 5,
	`avatar_url` varchar(500),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `teams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password` varchar(255),
	`first_name` varchar(100) NOT NULL,
	`last_name` varchar(100) NOT NULL,
	`role` enum('TEACHER','STUDENT') NOT NULL,
	`provider` enum('LOCAL','GOOGLE') NOT NULL DEFAULT 'LOCAL',
	`google_id` varchar(255),
	`avatar_url` varchar(500),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`),
	CONSTRAINT `users_google_id_unique` UNIQUE(`google_id`)
);
