CREATE TABLE `platform_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int NOT NULL,
	`targetUserId` int,
	`action` varchar(120) NOT NULL,
	`beforeState` json,
	`afterState` json,
	`occurredAt` bigint NOT NULL,
	CONSTRAINT `platform_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `platform_audit_events` ADD CONSTRAINT `platform_audit_events_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `platform_audit_events` ADD CONSTRAINT `platform_audit_events_targetUserId_users_id_fk` FOREIGN KEY (`targetUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `platform_audit_occurred_idx` ON `platform_audit_events` (`occurredAt`);--> statement-breakpoint
CREATE INDEX `platform_audit_target_idx` ON `platform_audit_events` (`targetUserId`);