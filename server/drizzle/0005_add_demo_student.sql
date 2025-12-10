CREATE TABLE `attendance_records` (
	`id` varchar(36) NOT NULL,
	`classroom_id` varchar(36) NOT NULL,
	`student_profile_id` varchar(36) NOT NULL,
	`date` datetime NOT NULL,
	`attendance_status` enum('PRESENT','ABSENT','LATE','EXCUSED') NOT NULL DEFAULT 'PRESENT',
	`notes` text,
	`xp_awarded` int DEFAULT 0,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `attendance_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `attendance_records_classroom_id_student_profile_id_date_unique` UNIQUE(`classroom_id`,`student_profile_id`,`date`)
);
--> statement-breakpoint
ALTER TABLE `student_profiles` DROP INDEX `student_profiles_user_id_classroom_id_unique`;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('ADMIN','TEACHER','STUDENT') NOT NULL;--> statement-breakpoint
ALTER TABLE `avatar_items` ADD `is_default` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `is_demo` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_classroom_id_classrooms_id_fk` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_student_profile_id_student_profiles_id_fk` FOREIGN KEY (`student_profile_id`) REFERENCES `student_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `avatar_items` DROP COLUMN `position_x`;--> statement-breakpoint
ALTER TABLE `avatar_items` DROP COLUMN `position_y`;--> statement-breakpoint
ALTER TABLE `avatar_items` DROP COLUMN `width`;--> statement-breakpoint
ALTER TABLE `avatar_items` DROP COLUMN `height`;