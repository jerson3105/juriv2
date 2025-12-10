ALTER TABLE `student_badges` DROP INDEX `unique_student_badge`;--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `notification_type` enum('ITEM_USED','GIFT_RECEIVED','BATTLE_STARTED','LEVEL_UP','POINTS','PURCHASE_APPROVED','PURCHASE_REJECTED','BADGE') NOT NULL;--> statement-breakpoint
ALTER TABLE `badges` ADD `custom_image` varchar(500);--> statement-breakpoint
ALTER TABLE `users` ADD `notify_badges` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notify_level_up` boolean DEFAULT true NOT NULL;