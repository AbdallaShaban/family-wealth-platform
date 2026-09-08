CREATE TABLE `market_email_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`preferenceId` int NOT NULL,
	`workspaceId` int NOT NULL,
	`signalFingerprint` varchar(64) NOT NULL,
	`status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`attemptedAt` bigint NOT NULL,
	`sentAt` bigint,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `market_email_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `market_email_deliveries_preference_fingerprint_unique` UNIQUE(`preferenceId`,`signalFingerprint`)
);
--> statement-breakpoint
CREATE TABLE `market_email_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`userId` int NOT NULL,
	`origin` varchar(2048) NOT NULL,
	`enabled` enum('yes','no') NOT NULL DEFAULT 'no',
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `market_email_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `market_email_preferences_workspace_user_unique` UNIQUE(`workspaceId`,`userId`)
);
--> statement-breakpoint
ALTER TABLE `market_email_deliveries` ADD CONSTRAINT `market_email_deliv_pref_fk` FOREIGN KEY (`preferenceId`) REFERENCES `market_email_preferences`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `market_email_deliveries` ADD CONSTRAINT `market_email_deliv_ws_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `market_email_preferences` ADD CONSTRAINT `market_email_pref_ws_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `market_email_preferences` ADD CONSTRAINT `market_email_pref_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `market_email_deliveries_workspace_attempt_idx` ON `market_email_deliveries` (`workspaceId`,`attemptedAt`);--> statement-breakpoint
CREATE INDEX `market_email_preferences_enabled_idx` ON `market_email_preferences` (`enabled`);
