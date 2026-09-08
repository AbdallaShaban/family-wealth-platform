CREATE TABLE `platform_ownership` (
	`id` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `platform_ownership_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `platform_ownership` ADD CONSTRAINT `platform_ownership_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;