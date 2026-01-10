CREATE TABLE `objective_reflections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`level` text NOT NULL,
	`year` integer NOT NULL,
	`month` integer,
	`reflection` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `time_spent_ms` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `timer_started_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `week_start_day` text DEFAULT 'monday' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `timezone` text DEFAULT 'UTC' NOT NULL;